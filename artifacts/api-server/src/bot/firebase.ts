/**
 * Firebase Realtime Database REST API helpers (no SDK needed)
 */

const DB_URL = process.env["FIREBASE_DB_URL"] || "https://yellowstone-7a62e-default-rtdb.firebaseio.com";

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
  const normalEmail = email.toLowerCase().trim();

  // Check admin config
  const admin = await fbGet("config/admin");
  if (admin?.email?.toLowerCase() === normalEmail) {
    return {
      telegramId: admin.telegramId || "5741539104",
      data: admin,
      isAdmin: true,
    };
  }

  // Check subscriptions
  const subs = await getAllSubscriptions();
  for (const [telegramId, sub] of Object.entries(subs)) {
    if ((sub as any).email?.toLowerCase() === normalEmail) {
      return { telegramId, data: sub, isAdmin: false };
    }
  }

  return null;
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
