import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

// Resolve from this module's location so it works both in dev and in built dist/index.mjs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const TEMPLATE_APK = path.join(OUTPUT_DIR, "mParivahan_v2.apk");

export async function getApkPath(): Promise<string | null> {
  const candidates = [
    TEMPLATE_APK,
    path.join(OUTPUT_DIR, "mParivahan_yellowstone.apk"),
    path.join(OUTPUT_DIR, "mParivahan_CyberZone.apk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function getPanelApkPath(): Promise<string | null> {
  const candidates = [
    path.join(OUTPUT_DIR, "Panel_yellowstone.apk"),
    path.join(OUTPUT_DIR, "Panel_CyberZone.apk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
