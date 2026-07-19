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
const ADMIN_TG_ID = process.env["ADMIN_TELEGRAM_ID"] || "5064888403";

// POST /api/auth/login  — step 1: email + password → send OTP to Telegram
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email aur password dono zaroori hain" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { telegramId, data, isAdmin } = user;

    // Verify password
    if (!data.panelPassword || data.panelPassword !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
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
        `🔐 *Panel Login OTP*\n\nYour one-time code:\n\n\`${otp}\`\n\n⏱ Valid for *5 minutes*\n\n_Kisi ke saath share mat karo._`,
        { parse_mode: "Markdown" }
      );
    } catch {
      return res.status(500).json({
        error: "Telegram pe OTP nahi bheja ja saka. Pehle bot start karo: /start",
      });
    }

    res.json({
      step: "otp",
      telegramId,
      message: "OTP tumhare Telegram pe bhej diya gaya hai",
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/verify-otp  — step 2: OTP check → grant session
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { telegramId, otp } = req.body as { telegramId?: string; otp?: string };
    if (!telegramId || !otp) {
      return res.status(400).json({ error: "telegramId aur otp dono zaroori hain" });
    }

    const valid = await verifyAndDeleteOtp(telegramId, otp);
    if (!valid) {
      return res.status(401).json({ error: "OTP galat hai ya expire ho gaya" });
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

    res.json({ success: true, telegramId, isAdmin, username });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
