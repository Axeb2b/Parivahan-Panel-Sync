import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Plus, Trash2, Users, Crown, Clock, RefreshCw, CheckCircle, XCircle, Copy, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Reveal, Eyebrow, PageHeader, StatTile, GlassCard, PillButton } from '@/components/ui/bezel';

interface Subscription {
  telegramId: string;
  username: string;
  plan: string;
  status: 'active' | 'expired';
  expiresAt: number | null;
  createdAt: number | null;
  daysLeft: number | null;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}/api${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' IST';
}

export function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    telegramId: '',
    username: '',
    email: '',
    panelPassword: '',
    days: '30',
    plan: '1 Month',
  });

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/subscriptions');
      setSubs(data.subscriptions || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load subscriptions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.telegramId || !form.days) return;

    setSubmitting(true);
    try {
      await apiFetch('/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      toast({ title: 'Success', description: `Subscription added for ${form.username || form.telegramId}` });
      setShowForm(false);
      setForm({ telegramId: '', username: '', email: '', panelPassword: '', days: '30', plan: '1 Month' });
      fetchSubs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Remove subscription for ${username || id}?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
      toast({ title: 'Removed', description: `Subscription for ${username || id} removed` });
      setSubs(prev => prev.filter(s => s.telegramId !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: 'Copied', description: 'Telegram ID copied' });
  };

  const activeSubs = subs.filter(s => s.status === 'active');
  const expiredSubs = subs.filter(s => s.status === 'expired');

  return (
    <Layout>
      <PageHeader
        eyebrow="Access Control"
        title="Users"
        description={`${activeSubs.length} active / ${subs.length} total subscriptions`}
        actions={
          <>
            <PillButton
              variant="ghost"
              onClick={fetchSubs}
              icon={loading ? <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <RefreshCw className="w-4 h-4" strokeWidth={1.8} />}
            >
              Refresh
            </PillButton>
            <PillButton
              onClick={() => setShowForm(!showForm)}
              icon={<Plus className="w-4 h-4" strokeWidth={1.8} />}
            >
              Add User
            </PillButton>
          </>
        }
      />

      {showForm && (
        <Reveal className="mb-8">
          <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
            <Eyebrow dot className="mb-6">New Subscription</Eyebrow>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Telegram ID *
                </label>
                <input type="text" placeholder="123456789" value={form.telegramId}
                  onChange={e => setForm(f => ({ ...f, telegramId: e.target.value }))}
                  required className="field" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Username
                </label>
                <input type="text" placeholder="@username" value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.replace('@', '') }))}
                  className="field" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Days
                </label>
                <div className="relative">
                  <select
                    value={form.days}
                    onChange={e => {
                      const d = e.target.value;
                      const labels: Record<string, string> = { '7': '1 Week', '30': '1 Month', '90': '3 Months', '180': '6 Months', '365': '1 Year', '36500': 'Lifetime' };
                      setForm(f => ({ ...f, days: d, plan: labels[d] || `${d} Days` }));
                    }}
                    className="field appearance-none pr-10"
                  >
                    <option value="7" className="bg-[#0b0b10]">7 Days</option>
                    <option value="30" className="bg-[#0b0b10]">1 Month (30 Days)</option>
                    <option value="90" className="bg-[#0b0b10]">3 Months</option>
                    <option value="180" className="bg-[#0b0b10]">6 Months</option>
                    <option value="365" className="bg-[#0b0b10]">1 Year</option>
                    <option value="36500" className="bg-[#0b0b10]">Lifetime</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" strokeWidth={1.6} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Panel Email <span className="text-[#a78bfa] normal-case tracking-normal">(login ke liye)</span>
                </label>
                <input type="email" placeholder="user@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="field" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Panel Password <span className="text-muted-foreground/60 normal-case tracking-normal">(optional)</span>
                </label>
                <input type="text" placeholder="User /reset_password se bhi set kar sakta hai" value={form.panelPassword}
                  onChange={e => setForm(f => ({ ...f, panelPassword: e.target.value }))}
                  className="field" />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-island flex-1 bg-[#8b5cf6] text-white px-6 py-3 text-sm shadow-[0_10px_30px_-12px_rgba(139,92,246,0.7)] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {submitting ? 'Adding...' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-island px-5 py-3 text-sm bg-white/[0.04] border border-white/10 text-foreground hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        </Reveal>
      )}

      {/* Bento stats */}
      <Reveal className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Users', value: subs.length, icon: <Users className="w-5 h-5" strokeWidth={1.6} />, tone: 'default' },
            { label: 'Active', value: activeSubs.length, icon: <CheckCircle className="w-5 h-5" strokeWidth={1.6} />, tone: 'accent' },
            { label: 'Expired', value: expiredSubs.length, icon: <XCircle className="w-5 h-5" strokeWidth={1.6} />, tone: 'danger' },
            { label: 'Expiring Soon', value: activeSubs.filter(s => s.daysLeft !== null && s.daysLeft <= 3).length, icon: <Clock className="w-5 h-5" strokeWidth={1.6} />, tone: 'warn' },
          ].map((s) => (
            <GlassCard key={s.label} className="rounded-3xl" innerClassName="rounded-3xl p-5">
              <StatTile label={s.label} value={s.value} icon={s.icon} tone={s.tone as any} />
            </GlassCard>
          ))}
        </div>
      </Reveal>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-3xl animate-pulse bg-white/[0.03] border border-white/[0.05]" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] py-20 text-center">
          <div className="bezel mx-auto w-fit mb-5">
            <div className="bezel-inner w-16 h-16 flex items-center justify-center">
              <Crown className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">No subscriptions yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Add User" to grant access</p>
        </GlassCard>
      ) : (
        <Reveal>
          <GlassCard className="rounded-[1.75rem] overflow-hidden" innerClassName="rounded-[1.75rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    {['User', 'Telegram ID', 'Plan', 'Status', 'Expires', 'Days Left', 'Action'].map(h => (
                      <th key={h} className="text-left px-5 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub, i) => (
                    <tr
                      key={sub.telegramId}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-500 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                    >
                      <td className="px-5 py-4 font-semibold text-foreground">@{sub.username || '—'}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => copyId(sub.telegramId)}
                          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors duration-500 group"
                        >
                          {sub.telegramId}
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.6} />
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{sub.plan}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          sub.status === 'active'
                            ? 'bg-[#34d399]/12 text-[#34d399] border border-[#34d399]/20'
                            : 'bg-[#ef4444]/12 text-[#f87171] border border-[#ef4444]/25'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-[#f87171]'}`} />
                          {sub.status === 'active' ? 'Active' : 'Expired'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{formatDate(sub.expiresAt)}</td>
                      <td className="px-5 py-4 text-sm">
                        {sub.daysLeft === null ? (
                          <span className="text-[#a78bfa]">∞</span>
                        ) : sub.daysLeft <= 3 ? (
                          <span className="text-[#fbbf24] font-semibold">{sub.daysLeft}d</span>
                        ) : (
                          <span className="text-muted-foreground">{sub.daysLeft}d</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleDelete(sub.telegramId, sub.username)}
                          disabled={deleting === sub.telegramId}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#f87171] border border-[#ef4444]/30 rounded-full hover:bg-[#ef4444]/10 disabled:opacity-50 transition-all duration-500 ease-spring"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.6} />
                          {deleting === sub.telegramId ? '...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </Reveal>
      )}

      <Reveal className="mt-8">
        <GlassCard className="rounded-3xl" innerClassName="rounded-3xl p-5 flex items-start gap-4">
          <div className="bezel shrink-0">
            <div className="bezel-inner w-11 h-11 flex items-center justify-center">
              <span className="text-[#a78bfa] text-xs font-bold tracking-tight">TG</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Telegram Bot Active</p>
            <p className="text-xs text-muted-foreground mt-1">
              Users can interact via the bot. Commands: /start · /apk · /reset_password
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1.5 font-mono">
              Admin: /adduser {'{'}telegramId{'}'} {'{'}days{'}'} {'{'}username{'}'} · /removeuser · /listusers · /stats
            </p>
          </div>
        </GlassCard>
      </Reveal>
    </Layout>
  );
}
