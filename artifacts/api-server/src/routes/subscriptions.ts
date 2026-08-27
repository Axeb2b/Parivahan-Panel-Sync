import { Router } from "express";
import {
  getAllSubscriptions,
  getSubscription,
  setSubscription,
  deleteSubscription,
} from "../bot/firebase";
import { getBot } from "../bot/index";

const router = Router();

const ADMIN_ID = parseInt(process.env["ADMIN_TELEGRAM_ID"] || "5741539104");

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " IST";
}

// GET /api/subscriptions — list all
router.get("/subscriptions", async (_req, res) => {
  try {
    const subs = await getAllSubscriptions();
    const now = Date.now();
    const result = Object.entries(subs).map(([id, s]: [string, any]) => ({
      telegramId: id,
      username: s.username || "unknown",
      plan: s.plan || "Custom",
      status: s.status === "active" && (!s.expiresAt || now < s.expiresAt) ? "active" : "expired",
      expiresAt: s.expiresAt || null,
      createdAt: s.createdAt || null,
      daysLeft: s.expiresAt ? Math.max(0, Math.floor((s.expiresAt - now) / (1000 * 60 * 60 * 24))) : null,
    }));
    res.json({ subscriptions: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// POST /api/subscriptions — add/extend
router.post("/subscriptions", async (req, res) => {
  try {
    const { telegramId, username, days, plan, email, panelPassword } = req.body;

    if (!telegramId || !days) {
      return res.status(400).json({ error: "telegramId and days are required" });
    }

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0) {
      return res.status(400).json({ error: "days must be a positive number" });
    }

    const existing = await getSubscription(telegramId);
    const now = Date.now();
    const baseTime =
      existing?.status === "active" && existing.expiresAt && existing.expiresAt > now
        ? existing.expiresAt
        : now;

    const expiresAt = baseTime + daysToMs(daysNum);

    await setSubscription(telegramId, {
      telegramId,
      username: username || "unknown",
      plan: plan || `${daysNum} Days`,
      status: "active",
      expiresAt,
      createdAt: existing?.createdAt || now,
      ...(email ? { email: email.toLowerCase() } : {}),
      ...(panelPassword ? { panelPassword } : {}),
    } as any);

    // Send Telegram notification to user
    const bot = getBot();
    if (bot) {
      try {
        await bot.telegram.sendMessage(
          parseInt(telegramId),
          `🎉 *Subscription Activated!*\n\n` +
          `Plan: ${plan || daysNum + " Days"}\n` +
          `Expires: ${formatDate(expiresAt)}\n\n` +
          `📱 /apk — APK download karo\n` +
          `🔑 /reset\\_password — Web panel password set karo`,
          { parse_mode: "Markdown" }
        );
      } catch {
        // User hasn't started the bot yet
      }
    }

    return res.json({ success: true, telegramId, expiresAt });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add subscription" });
  }
});

// DELETE /api/subscriptions/:id — remove
router.delete("/subscriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await getSubscription(id);
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    await deleteSubscription(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete subscription" });
  }
});

export default router;
