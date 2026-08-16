import { Router } from "express";
import { buildUserApk, isTemplateReady } from "../bot/apkBuilder";
import { isSubscriptionActive } from "../bot/firebase";

const router = Router();
const ADMIN_ID = process.env["ADMIN_TELEGRAM_ID"] || "5064888403";

/**
 * GET /api/apk/download?telegramId=xxx
 * Builds the per-user APK (ownerTelegramId baked in) and streams it back
 * as a file download. Validates that the user has an active subscription
 * (or is the admin), same rules as the bot's /apk command.
 */
router.get("/apk/download", async (req, res) => {
  try {
    const telegramId = (req.query.telegramId as string) || "";
    if (!telegramId) {
      res.status(400).json({ error: "telegramId query parameter is required." });
      return;
    }

    const isAdmin = telegramId === ADMIN_ID;
    const active = isAdmin || (await isSubscriptionActive(telegramId));
    if (!active) {
      res
        .status(403)
        .json({ error: "Subscription expired or not found. Contact admin." });
      return;
    }

    if (!isTemplateReady()) {
      res.status(503).json({
        error: "APK system is initializing (first-time setup ~2 min). Please try again shortly.",
      });
      return;
    }

    const apkPath = await buildUserApk(telegramId);
    if (!apkPath) {
      res.status(500).json({ error: "APK build failed. Contact admin." });
      return;
    }

    res.download(apkPath, `mParivahan_AxeCodi_${telegramId}.apk`);
  } catch (err: any) {
    console.error("APK download route error:", err);
    res.status(500).json({
      error: err?.message || "APK build failed. Check server logs.",
    });
  }
});

// GET /api/apk/status?telegramId=xxx — returns whether a cached APK exists
router.get("/apk/status", async (_req, res) => {
  res.json({ ready: isTemplateReady() });
});

export default router;
