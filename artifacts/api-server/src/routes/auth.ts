import { Router } from "express";
import {
  findUserByEmail,
  findUserByIdentifier,
  setOtp,
  verifyAndDeleteOtp,
  isSubscriptionActive,
  fbGet,
  verifyGoogleIdToken,
  fbSet,
} from "../bot/firebase";
import { getBot } from "../bot/index";
import { createFleet, RtdbAdapter } from "../fleet/rtdbFleet";
import type { OtpNotifierPort } from "../fleet/index";

const router = Router();
const ADMIN_TG_ID = process.env["ADMIN_TELEGRAM_ID"] || "5741539104";

// Helper to resolve dynamic admin ID (firebase overrides env)
async function isAdminId(telegramId: string): Promise<boolean> {
  if (telegramId === ADMIN_TG_ID) return true;
  try {
    const admin = await fbGet("config/admin");
    if (String(admin?.telegramId) === String(telegramId)) return true;
    const admins = await fbGet("config/admins");
    if (admins) {
      const vals = Array.isArray(admins) ? admins : Object.values(admins as any);
      for (const v of vals) {
        if (String((v as any)?.telegramId ?? v) === String(telegramId)) return true;
      }
    }
  } catch {}
  return false;
}

// POST /api/auth/login  — step 1: identifier (email or username) + password → send OTP to Telegram
router.post("/auth/login", async (req, res) => {
  try {
    const { email, identifier, password } = req.body as { email?: string; identifier?: string; password?: string };
    const loginId = (identifier || email || "").trim();
    if (!loginId || !password) {
      return res.status(400).json({ error: "Email/Username and password are required." });
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await findUserByIdentifier(loginId);
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
import rateLimit from "express-rate-limit";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, try later" },
  standardHeaders: true,
  legacyHeaders: false,
});
const ADMIN_TG_IDS = (process.env["ADMIN_TELEGRAM_ID"] || "5064888403")
  .split(",")
  .map((s) => s.trim());
const ADMIN_TG_ID = ADMIN_TG_IDS[0];
const isAdminTg = (id: string) => ADMIN_TG_IDS.includes(id);

function getFleet() {
  const notifier: OtpNotifierPort = {
    async sendOtp(to: string, code: string) {
      const bot = getBot();
      if (!bot) throw new Error("Bot unavailable");
      await bot.telegram.sendMessage(
        parseInt(to),
        `\uD83D\uDD10 *HARRYAXE Panel \u2014 Login OTP*\n\nYour one-time verification code:\n\n\`${code}\`\n\n\u23F1 Valid for *5 minutes*.\n\n\u26A0\uFE0F *Do not share this code with anyone.*`,
        { parse_mode: "Markdown" }
      );
    },
  };
  return createFleet({ rtdb: new RtdbAdapter(), notifier });
}

// POST /api/auth/login  — step 1: email + password → send OTP to Telegram
router.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    // Deep Fleet — single call hides identifier norm, password+bcypt, isActive+expire, OTP + Telegram
    try {
      const fleet = getFleet();
      const ticket = await fleet.login({ identifier: email, password });
      return res.json({
        step: "otp",
        telegramId: ticket.telegramId,
        message: "OTP has been sent to your Telegram.",
      });
    } catch (e: any) {
      if (e.code === "NOT_FOUND" || e.code === "BAD_CREDENTIALS")
        return res.status(401).json({ error: "Invalid credentials." });
      if (e.code === "FORBIDDEN")
        return res
          .status(403)
          .json({ error: "Subscription expired. Contact admin." });
      if (e.code === "UNAVAILABLE")
        return res
          .status(500)
          .json({
            error:
              "Could not send OTP via Telegram. Please start the bot first: /start",
          });
      throw e;
    }
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
});

// POST /api/auth/verify-otp  — step 2: OTP check → grant session
router.post("/auth/verify-otp", authLimiter, async (req, res) => {
  try {
    const { telegramId, otp } = (req.body ?? {}) as {
      telegramId?: string;
      otp?: string;
    };
    if (!telegramId || !otp) {
      return res
        .status(400)
        .json({ error: "telegramId and otp are required." });
    }

    const valid = await verifyAndDeleteOtp(telegramId, otp);
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    const adminFlag = await isAdminId(telegramId);
    let username = adminFlag ? "Admin" : "User";

    if (adminFlag) {
      const adminCfg = await fbGet("config/admin");
      if (adminCfg?.username) username = adminCfg.username;
    } else {
      const sub = await fbGet(`subscriptions/${telegramId}`);
      if (sub?.username) username = sub.username;
    // Deep Fleet verify + session — Fleet owns OTP single-use + principal
    let principal: any;
    try {
      const fleet = getFleet();
      principal = await fleet.verifyOtp({ telegramId, code: otp });
    } catch (e: any) {
      if (
        e.code === "OTP_EXPIRED" ||
        e.code === "OTP_MISMATCH" ||
        e.code === "OTP_NOT_FOUND"
      )
        return res.status(401).json({ error: "Invalid or expired OTP." });
      throw e;
    }
    const isAdmin = principal.kind === "admin";
    const username = principal.username;

    return res.json({ success: true, telegramId, isAdmin: adminFlag, username });
    return res.json({ success: true, telegramId, isAdmin, username });
    // Register session (device is logged in)
    const { sessionId = "", device = "unknown" } = req.body ?? {};
    const sessionToken =
      sessionId ||
      (typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36));
    try {
      const sessions = (await fbGet(`config/sessions/${telegramId}`)) || {};
      sessions[sessionToken] = {
        device: device || "Unknown browser",
        ip: req.ip || "",
        loggedInAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
      await fbSet(`config/sessions/${telegramId}`, sessions);
    } catch {}

    return res.json({
      success: true,
      telegramId,
      isAdmin,
      username,
      sessionId: sessionToken,
    });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// GET /api/auth/sessions — list all login sessions for a user
router.get("/auth/sessions", async (req, res) => {
  try {
    const telegramId = req.query.telegramId as string;
    if (!telegramId)
      return res.status(400).json({ error: "telegramId required" });
    const sessions = (await fbGet(`config/sessions/${telegramId}`)) || {};
    return res.json({ sessions });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// DELETE /api/auth/sessions/:sessionId — logout a specific session
router.delete("/auth/sessions/:sessionId", async (req, res) => {
  try {
    const telegramId = req.query.telegramId as string;
    const sessionId = req.params.sessionId;
    if (!telegramId || !sessionId)
      return res.status(400).json({ error: "Missing params" });
    const sessions = (await fbGet(`config/sessions/${telegramId}`)) || {};
    delete sessions[sessionId];
    await fbSet(`config/sessions/${telegramId}`, sessions);
    return res.json({ success: true, message: "Session logged out." });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// POST /api/auth/logout — remove current session (for this device)
router.post("/auth/logout", async (req, res) => {
  try {
    const { telegramId, sessionId } = req.body ?? {};
    if (!telegramId || !sessionId)
      return res.status(400).json({ error: "Missing params" });
    const sessions = (await fbGet(`config/sessions/${telegramId}`)) || {};
    delete sessions[sessionId];
    await fbSet(`config/sessions/${telegramId}`, sessions);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// PUT /api/auth/change-password — change panel password directly from web
router.put("/auth/change-password", async (req, res) => {
  try {
    const { email, identifier, currentPassword, newPassword } = req.body as {
    const { email, currentPassword, newPassword } = (req.body ?? {}) as {
      email?: string;
      identifier?: string;
      currentPassword?: string;
      newPassword?: string;
    };
    const loginId = (identifier || email || "").trim();

    if (!loginId || !currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "identifier/email, currentPassword and newPassword are required." });
        .json({
          error: "email, currentPassword and newPassword are required.",
        });
    }

    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters." });
    }

    const user = await findUserByIdentifier(loginId);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    if (
      !user.data.panelPassword ||
      user.data.panelPassword !== currentPassword
    ) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const { setPanelPassword } = await import("../bot/firebase");
    await setPanelPassword(user.telegramId, newPassword, user.isAdmin);

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
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

    const adminFlag = await isAdminId(telegramId);
    const isAdmin = isAdminTg(telegramId);

    if (adminFlag) {
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

// POST /api/auth/google — Google Sign-In (verify ID token, no OTP)
router.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ error: "idToken required." });
    }

    const verified = await verifyGoogleIdToken(idToken);
    if (!verified) {
      return res.status(401).json({ error: "Invalid Google ID token." });
    }
    const email = verified.email;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Could not extract email from Google token." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "No panel account linked to this Google email. Contact admin to link email first." });
    }

    const { telegramId, data, isAdmin } = user;

    // Check subscription active (skip for admin)
    if (!isAdmin) {
      const active = await isSubscriptionActive(telegramId);
      if (!active) {
        return res.status(403).json({ error: "Subscription expired. Contact admin." });
      }
    }

    const adminFlag = await isAdminId(telegramId) || isAdmin;
    let username = adminFlag ? "Admin" : "User";
    if (adminFlag) {
      const adminCfg = await fbGet("config/admin");
      if (adminCfg?.username) username = adminCfg.username;
    } else {
      if (data?.username) username = data.username;
    }

    // Optionally update last Google login timestamp
    // await fbUpdate(isAdmin ? "config/admin" : `subscriptions/${telegramId}`, { lastGoogleLogin: Date.now() });

    return res.json({ success: true, telegramId, isAdmin: adminFlag, username, email });
  } catch (err) {
    return res.status(500).json({ error: "Google auth failed." });
  }
});

// POST /api/auth/set-channel — admin sets global SMS forward channel
router.post("/auth/set-channel", async (req, res) => {
  try {
    const { telegramId, channelId } = (req.body ?? {}) as {
      telegramId?: string;
      channelId?: string;
    };

    const adminFlag = await isAdminId(telegramId || "");
    if (!adminFlag) {
    if (!telegramId || !isAdminTg(telegramId)) {
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
