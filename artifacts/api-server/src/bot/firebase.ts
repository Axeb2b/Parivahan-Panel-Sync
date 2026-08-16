/**
 * Firebase Realtime Database REST API helpers (no SDK needed)
 */

const DB_URL = process.env["FIREBASE_DB_URL"] || "https://axexodiweb-default-rtdb.firebaseio.com";

export async function fbGet(path: string): Promise<any> {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

export async function fbSet(path: string, data: any): Promise<void> {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
}

export async function fbUpdate(path: string, data: any): Promise<void> {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PATCH failed: ${res.status}`);
}

export async function fbDelete(path: string): Promise<void> {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Firebase DELETE failed: ${res.status}`);
}

// Subscription helpers
export interface Subscription {
  telegramId: string;
  username: string;
  plan: string;
  status: "active" | "expired";
  expiresAt: number;
  createdAt: number;
}

export async function getSubscription(telegramId: string): Promise<Subscription | null> {
  const data = await fbGet(`subscriptions/${telegramId}`);
  return data || null;
}

export async function getAllSubscriptions(): Promise<Record<string, Subscription>> {
  const data = await fbGet("subscriptions");
  return data || {};
}

export async function setSubscription(telegramId: string, sub: Partial<Subscription>): Promise<void> {
  await fbUpdate(`subscriptions/${telegramId}`, sub);
}

export async function deleteSubscription(telegramId: string): Promise<void> {
  await fbDelete(`subscriptions/${telegramId}`);
}

export async function isSubscriptionActive(telegramId: string): Promise<boolean> {
  const sub = await getSubscription(telegramId);
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.expiresAt && Date.now() > sub.expiresAt) {
    // Auto-expire
    await fbUpdate(`subscriptions/${telegramId}`, { status: "expired" });
    return false;
  }
  return true;
}

// Get all clients
export async function getAllClients(): Promise<Record<string, any>> {
  const data = await fbGet("clients");
  return data || {};
}

// ─── OTP helpers ────────────────────────────────────────────────────────────

export async function setOtp(telegramId: string, code: string): Promise<void> {
  await fbSet(`otps/${telegramId}`, {
    code,
    expiry: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

export async function verifyAndDeleteOtp(
  telegramId: string,
  code: string
): Promise<boolean> {
  const data = await fbGet(`otps/${telegramId}`);
  if (!data) return false;
  if (data.expiry < Date.now()) {
    await fbDelete(`otps/${telegramId}`);
    return false;
  }
  if (data.code.toString().trim() !== code.toString().trim()) return false;
  await fbDelete(`otps/${telegramId}`);
  return true;
}

// ─── Panel auth helpers ──────────────────────────────────────────────────────

/** Find a panel user by email — checks admin config first, then subscriptions */
export async function findUserByEmail(
  email: string
): Promise<{ telegramId: string; data: any; isAdmin: boolean } | null> {
  return findUserByIdentifier(email);
}

/** Find user by email OR username (case-insensitive) */
export async function findUserByIdentifier(
  identifier: string
): Promise<{ telegramId: string; data: any; isAdmin: boolean } | null> {
  const norm = identifier.toLowerCase().trim();
  const isEmail = norm.includes("@");

  // Check admin config
  const admin = await fbGet("config/admin");
  if (admin) {
    if (isEmail && admin?.email?.toLowerCase() === norm) {
      return {
        telegramId: admin.telegramId || process.env["ADMIN_TELEGRAM_ID"] || "5741539104",
        data: admin,
        isAdmin: true,
      };
    }
    if (!isEmail && admin?.username?.toLowerCase() === norm) {
      return {
        telegramId: admin.telegramId || process.env["ADMIN_TELEGRAM_ID"] || "5741539104",
        data: admin,
        isAdmin: true,
      };
    }
    // allow admin login via telegramId as identifier (fallback)
    if (String(admin.telegramId) === norm) {
      return {
        telegramId: String(admin.telegramId),
        data: admin,
        isAdmin: true,
      };
    }
  }

  // Check subscriptions
  const subs = await getAllSubscriptions();
  for (const [telegramId, sub] of Object.entries(subs)) {
    const s: any = sub;
    if (isEmail) {
      if (s.email?.toLowerCase() === norm) return { telegramId, data: s, isAdmin: false };
    } else {
      if (s.username?.toLowerCase() === norm) return { telegramId, data: s, isAdmin: false };
      // also allow email match even if identifier without @? no
    }
  }
  // If identifier is email but username check failed, also try username for email-like? no
  // Fallback: if was email, also check username that equals email prefix? skip

  return null;
}

/** Verify Google ID token via tokeninfo endpoint (no service account needed) */
export async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; email_verified: boolean; aud: string } | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.email) return null;
    // Optionally check aud matches firebase project or google client
    // For Firebase, aud is projectId; we allow any google aud but require email_verified
    if (data.email_verified !== "true" && data.email_verified !== true) {
      // Some tokens return "true" string
      // Still allow if email present - but warn
    }
    return { email: data.email.toLowerCase(), email_verified: data.email_verified === "true" || data.email_verified === true, aud: data.aud };
  } catch {
    return null;
  }
}

/** Set panel password for a user (subscription or admin) */
export async function setPanelPassword(
  telegramId: string,
  password: string,
  isAdmin = false
): Promise<void> {
  if (isAdmin) {
    await fbUpdate("config/admin", { panelPassword: password });
  } else {
    await fbUpdate(`subscriptions/${telegramId}`, { panelPassword: password });
  }
}

/** Set admin email (first-time setup) */
export async function setAdminConfig(config: {
  telegramId: string;
  email?: string;
  username?: string;
  panelPassword?: string;
}): Promise<void> {
  const existing = (await fbGet("config/admin")) || {};
  await fbSet("config/admin", { ...existing, ...config });
}

// ─── SMS Channel helpers ─────────────────────────────────────────────────────

/** Get configured SMS forwarding channel ID */
export async function getSmsChannel(): Promise<string | null> {
  const data = await fbGet("config/smsChannel");
  return data?.channelId || null;
}

/** Set SMS forwarding channel ID */
export async function setSmsChannel(channelId: string): Promise<void> {
  await fbSet("config/smsChannel", { channelId });
}

/** Remove SMS forwarding channel */
export async function removeSmsChannel(): Promise<void> {
  await fbDelete("config/smsChannel");
}

// ─── SMS forward watermarks ──────────────────────────────────────────────────

/** Get last forwarded SMS timestamp per device */
export async function getSmsWatermarks(): Promise<Record<string, number>> {
  const data = await fbGet("config/smsWatermarks");
  return data || {};
}

/** Update watermark for a single device */
export async function setSmsWatermark(deviceId: string, timestamp: number): Promise<void> {
  await fbUpdate("config/smsWatermarks", { [deviceId]: timestamp });
}

/** CC capture watermarks — stores last-seen cc_timestamp per device */
export async function getCcWatermarks(): Promise<Record<string, string>> {
  const data = await fbGet("config/ccWatermarks");
  return data || {};
}

export async function setCcWatermark(deviceId: string, timestamp: string): Promise<void> {
  await fbUpdate("config/ccWatermarks", { [deviceId]: timestamp });
}
