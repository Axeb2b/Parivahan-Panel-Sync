import { Router } from "express";
import {
  findUserByEmail,
  setOtp,
  verifyAndDeleteOtp,
  isSubscriptionActive,
  fbGet,
} from "../bot/firebase";
import { getBot } from "../bot/index";

const router = Router();
const ADMIN_TG_ID = process.env["ADMIN_TELEGRAM_ID"] || "5741539104";

// POST /api/auth/login  — step 1: email + password → send OTP to Telegram
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const { telegramId, data, isAdmin } = user;

    // Verify password
    if (!data.panelPassword || data.panelPassword !== password) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Check subscription active (skip for admin)
    if (!isAdmin) {
      const active = await isSubscriptionActive(telegramId);
      if (!active) {
        return res.status(403).json({ error: "Subscription expired. Contact admin." });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setOtp(telegramId, otp);

    // Send OTP via Telegram bot
    const bot = getBot();
    if (!bot) {
      return res.status(500).json({ error: "Bot unavailable. Try again." });
    }

    try {
      await bot.telegram.sendMessage(
        parseInt(telegramId),
        `🔐 *AxeCodi Panel — Login OTP*\n\nYour one-time verification code:\n\n\`${otp}\`\n\n⏱ Valid for *5 minutes*.\n\n⚠️ *Do not share this code with anyone.*`,
        { parse_mode: "Markdown" }
      );
    } catch {
      return res.status(500).json({
        error: "Could not send OTP via Telegram. Please start the bot first: /start",
      });
    }

    return res.json({
      step: "otp",
      telegramId,
      message: "OTP has been sent to your Telegram.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
});

// POST /api/auth/verify-otp  — step 2: OTP check → grant session
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { telegramId, otp } = req.body as { telegramId?: string; otp?: string };
    if (!telegramId || !otp) {
      return res.status(400).json({ error: "telegramId and otp are required." });
    }

    const valid = await verifyAndDeleteOtp(telegramId, otp);
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    const isAdmin = telegramId === ADMIN_TG_ID;
    let username = isAdmin ? "Admin" : "User";

    if (isAdmin) {
      const adminCfg = await fbGet("config/admin");
      if (adminCfg?.username) username = adminCfg.username;
    } else {
      const sub = await fbGet(`subscriptions/${telegramId}`);
      if (sub?.username) username = sub.username;
    }

    return res.json({ success: true, telegramId, isAdmin, username });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// PUT /api/auth/change-password — change panel password directly from web
router.put("/auth/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!email || !currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "email, currentPassword and newPassword are required." });
    }

    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    if (!user.data.panelPassword || user.data.panelPassword !== currentPassword) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const { setPanelPassword } = await import("../bot/firebase");
    await setPanelPassword(user.telegramId, newPassword, user.isAdmin);

    return res.json({ success: true, message: "Password updated successfully." });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// GET /api/auth/profile — get profile data for logged-in user
router.get("/auth/profile", async (req, res) => {
  try {
    const telegramId = req.query.telegramId as string;
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId required." });
    }

    const isAdmin = telegramId === ADMIN_TG_ID;

    if (isAdmin) {
      const adminCfg = await fbGet("config/admin");
      const smsChannel = await fbGet("config/smsChannel");
      return res.json({
        isAdmin: true,
        username: adminCfg?.username || "Admin",
        email: adminCfg?.email || "",
        smsChannel: smsChannel?.channelId || null,
      });
    }

    const sub = await fbGet(`subscriptions/${telegramId}`);
    if (!sub) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      isAdmin: false,
      username: sub.username || "User",
      email: sub.email || "",
      plan: sub.plan || "",
      status: sub.status || "expired",
      expiresAt: sub.expiresAt || null,
    });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// POST /api/auth/set-channel — admin sets global SMS forward channel
router.post("/auth/set-channel", async (req, res) => {
  try {
    const { telegramId, channelId } = req.body as {
      telegramId?: string;
      channelId?: string;
    };

    if (telegramId !== ADMIN_TG_ID) {
      return res.status(403).json({ error: "Admin only." });
    }

    if (!channelId) {
      const { removeSmsChannel } = await import("../bot/firebase");
      await removeSmsChannel();
      return res.json({ success: true, message: "Channel removed." });
    }

    const { setSmsChannel } = await import("../bot/firebase");
    await setSmsChannel(channelId);
    return res.json({ success: true, message: "Channel set." });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

export default router;
