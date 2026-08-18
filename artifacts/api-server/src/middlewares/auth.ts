import { type Request, type Response, type NextFunction } from "express";
import { fbGet } from "../bot/firebase";

const ADMIN_TG_ID = process.env["ADMIN_TELEGRAM_ID"] || "5064888403";

/**
 * Session-based bearer auth.
 * The web panel stores { telegramId, sessionId } from /api/auth/verify-otp and
 * sends them joined by ":" as:  Authorization: Bearer <telegramId>:<sessionId>
 * The session must exist under config/sessions/{telegramId} in Firebase.
 */
function parseBearer(authHeader?: string): { telegramId: string; sessionId: string } | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) return null;
  const token = m[1];
  const idx = token.indexOf(":");
  if (idx <= 0 || idx === token.length - 1) return null;
  return { telegramId: token.slice(0, idx), sessionId: token.slice(idx + 1) };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cred = parseBearer(req.headers.authorization);
  if (!cred) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  try {
    const sessions = (await fbGet(`config/sessions/${cred.telegramId}`)) || {};
    const session = sessions[cred.sessionId];
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    (req as any).auth = { telegramId: cred.telegramId, sessionId: cred.sessionId, session };
    next();
  } catch (err) {
    res.status(500).json({ error: "Session check failed." });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    const auth = (req as any).auth as { telegramId: string } | undefined;
    if (!auth || auth.telegramId !== ADMIN_TG_ID) {
      res.status(403).json({ error: "Admin only." });
      return;
    }
    next();
  });
}
