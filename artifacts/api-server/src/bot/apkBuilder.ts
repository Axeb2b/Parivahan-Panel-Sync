import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const TEMPLATE_APK = path.join(OUTPUT_DIR, "mParivahan_yellowstone.apk");

export async function getApkPath(): Promise<string | null> {
  if (fs.existsSync(TEMPLATE_APK)) {
    return TEMPLATE_APK;
  }
  // Try alternate locations
  const altPaths = [
    path.join(WORKSPACE_ROOT, "output", "mParivahan_yellowstone.apk"),
    path.join(process.cwd(), "../../output/mParivahan_yellowstone.apk"),
  ];
  for (const p of altPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function getPanelApkPath(): Promise<string | null> {
  const panelPath = path.join(OUTPUT_DIR, "Panel_yellowstone.apk");
  if (fs.existsSync(panelPath)) return panelPath;
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
