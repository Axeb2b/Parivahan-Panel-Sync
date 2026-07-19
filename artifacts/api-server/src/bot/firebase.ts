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
