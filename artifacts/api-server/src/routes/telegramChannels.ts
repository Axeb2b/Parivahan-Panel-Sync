// @ts-nocheck
import { Router } from "express";
import { fbGet, fbSet, fbDelete } from "../bot/firebase";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { isAdminTg } from "../lib/admin";

const router = Router();

function isValidTelegramId(id: string): boolean {
  return /^\d{5,20}$/.test(id);
}
function isValidChannelId(id: string): boolean {
  // Telegram channel: -100xxxx or numeric string
  return /^-?\d{5,20}$/.test(id);
}

// ── Helpers: normalize channel stored as string or {channelId} ──
async function getChannel(path: string): Promise<string | null> {
  const v = await fbGet(path);
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && (v as any).channelId)
    return String((v as any).channelId);
  if (typeof v === "object" && (v as any).channel)
    return String((v as any).channel);
  return null;
}

// ── User channels: personal SMS / finance / rules ──
router.get(
  "/telegram/user-channels/:telegramId",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!isValidTelegramId(tid))
        return res.status(400).json({ error: "Invalid telegramId" });
      const [sms, finance, rules] = await Promise.all([
        getChannel(`config/userChannels/${tid}/sms`),
        getChannel(`config/userChannels/${tid}/finance`),
        fbGet(`config/userChannels/${tid}/rules`).catch(() => null),
      ]);
      res.json({
        telegramId: tid,
        sms: sms || null,
        finance: finance || null,
        rules: rules || {},
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch user channels" });
    }
  }
);

router.get(
  "/telegram/user-channels/:telegramId/sms",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      if (!isValidTelegramId(tid))
        return res.status(400).json({ error: "Invalid telegramId" });
      const v = await getChannel(`config/userChannels/${tid}/sms`);
      res.json({ channelId: v });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.put(
  "/telegram/user-channels/:telegramId/sms",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      if (!isValidTelegramId(tid))
        return res.status(400).json({ error: "Invalid telegramId" });
      const { channelId } = req.body ?? {};
      if (
        channelId != null &&
        channelId !== "" &&
        !isValidChannelId(String(channelId))
      ) {
        return res
          .status(400)
          .json({ error: "Invalid channelId (expected -100...)" });
      }
      if (!channelId) await fbDelete(`config/userChannels/${tid}/sms`);
      else await fbSet(`config/userChannels/${tid}/sms`, String(channelId));
      res.json({ success: true, channelId: channelId || null });
    } catch {
      res.status(500).json({ error: "Failed to save" });
    }
  }
);

router.delete(
  "/telegram/user-channels/:telegramId/sms",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      await fbDelete(`config/userChannels/${tid}/sms`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.get(
  "/telegram/user-channels/:telegramId/finance",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      const v = await getChannel(`config/userChannels/${tid}/finance`);
      res.json({ channelId: v });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.put(
  "/telegram/user-channels/:telegramId/finance",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      const { channelId } = req.body ?? {};
      if (
        channelId != null &&
        channelId !== "" &&
        !isValidChannelId(String(channelId))
      ) {
        return res.status(400).json({ error: "Invalid channelId" });
      }
      if (!channelId) await fbDelete(`config/userChannels/${tid}/finance`);
      else await fbSet(`config/userChannels/${tid}/finance`, String(channelId));
      res.json({ success: true, channelId: channelId || null });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.delete(
  "/telegram/user-channels/:telegramId/finance",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      await fbDelete(`config/userChannels/${tid}/finance`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.get(
  "/telegram/user-channels/:telegramId/rules",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      const v = (await fbGet(`config/userChannels/${tid}/rules`)) || {};
      res.json({ rules: v });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.put(
  "/telegram/user-channels/:telegramId/rules/:key",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const key = String(req.params.key);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      const { keyword, channel } = req.body ?? {};
      if (!keyword || !channel)
        return res.status(400).json({ error: "keyword and channel required" });
      if (!isValidChannelId(String(channel)))
        return res.status(400).json({ error: "Invalid channelId" });
      const cleanKey = key.toLowerCase().replace(/\s+/g, "_");
      await fbSet(`config/userChannels/${tid}/rules/${cleanKey}`, {
        keyword: String(keyword),
        channel: String(channel),
      });
      res.json({ success: true, key: cleanKey });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

router.delete(
  "/telegram/user-channels/:telegramId/rules/:key",
  requireAuth,
  async (req, res) => {
    try {
      const tid = String(req.params.telegramId);
      const key = String(req.params.key);
      const auth = (req as any).auth as { telegramId: string };
      if (!isAdminTg(auth.telegramId) && auth.telegramId !== tid)
        return res.status(403).json({ error: "Forbidden" });
      await fbDelete(`config/userChannels/${tid}/rules/${key}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  }
);

// ── Global SMS channel (admin only) ──
router.get("/telegram/sms-channel", requireAuth, async (_req, res) => {
  try {
    const v = await getChannel("config/smsChannel");
    res.json({ channelId: v });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/telegram/sms-channel", requireAdmin, async (req, res) => {
  try {
    const { channelId } = req.body ?? {};
    if (
      channelId != null &&
      channelId !== "" &&
      !isValidChannelId(String(channelId))
    ) {
      return res.status(400).json({ error: "Invalid channelId" });
    }
    if (!channelId) await fbDelete("config/smsChannel");
    else await fbSet("config/smsChannel", String(channelId));
    res.json({ success: true, channelId: channelId || null });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.delete("/telegram/sms-channel", requireAdmin, async (_req, res) => {
  try {
    await fbDelete("config/smsChannel");
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
