import { Router } from "express";
import { mintFirebaseToken } from "../lib/firebaseAdmin";
import {
  findUserByEmail,
  setOtp,
  verifyAndDeleteOtp,
  isSubscriptionActive,
  fbGet,
  fbSet,
} from "../bot/firebase";
import { getBot } from "../bot/index";
import { createFleet, RtdbAdapter } from "../fleet/rtdbFleet";
import type { OtpNotifierPort } from "../fleet/index";

const router = Router();
import rateLimit from "express-rate-limit";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, try later" },
  standardHeaders: true,
  legacyHeaders: false,
});
import { isAdminTg } from "../lib/admin";

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
      firebaseToken: null,
    });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
});

// GET /api/auth/firebase-token — mint a fresh Firebase custom token for the authed user
router.get("/auth/firebase-token", async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId?: string } | undefined;
    const tid = auth?.telegramId || String(req.query.telegramId || "");
    if (!tid) return res.status(400).json({ error: "telegramId required" });
    const firebaseToken = await mintFirebaseToken(tid).catch(() => null);
    return res.json({ firebaseToken });
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
    const { email, currentPassword, newPassword } = (req.body ?? {}) as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!email || !currentPassword || !newPassword) {
      return res
        .status(400)
        .json({
          error: "email, currentPassword and newPassword are required.",
        });
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

    const isAdmin = isAdminTg(telegramId);

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
    const { telegramId, channelId } = (req.body ?? {}) as {
      telegramId?: string;
      channelId?: string;
    };

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
