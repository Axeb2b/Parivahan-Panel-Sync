import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Plus, Trash2, Users, Crown, Clock, RefreshCw, CheckCircle, XCircle, Copy, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2d1b4e] flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#7c3aed]" />
            Users
          </h1>
          <p className="text-[#6b5b7d] text-sm mt-1">
            {activeSubs.length} active / {subs.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSubs}
            className="flex items-center gap-2 px-4 py-2 border border-[#d8c8f0] rounded-full text-sm text-[#6b5b7d] hover:text-[#2d1b4e] hover:border-[#b8a0e0] transition-all bg-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2 bg-[#7c3aed] text-white rounded-full text-sm font-semibold hover:bg-[#6d28d9] transition-all shadow-md shadow-purple-200"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl p-5">
          <h3 className="text-sm font-bold text-[#7c3aed] mb-4 uppercase tracking-widest">
            New Subscription
          </h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block mb-1">
                Telegram ID *
              </label>
              <input
                type="text"
                placeholder="123456789"
                value={form.telegramId}
                onChange={e => setForm(f => ({ ...f, telegramId: e.target.value }))}
                required
                className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block mb-1">
                Username
              </label>
              <input
                type="text"
                placeholder="@username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.replace('@', '') }))}
                className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block mb-1">
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
                  className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all appearance-none"
                >
                  <option value="7">7 Days</option>
                  <option value="30">1 Month (30 Days)</option>
                  <option value="90">3 Months</option>
                  <option value="180">6 Months</option>
                  <option value="365">1 Year</option>
                  <option value="36500">Lifetime</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block mb-1">
                Panel Email <span className="text-[#7c3aed]">(login ke liye)</span>
              </label>
              <input
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block mb-1">
                Panel Password <span className="text-[#9ca3af]">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="User /reset_password se bhi set kar sakta hai"
                value={form.panelPassword}
                onChange={e => setForm(f => ({ ...f, panelPassword: e.target.value }))}
                className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#7c3aed] text-white rounded-full text-sm font-semibold hover:bg-[#6d28d9] disabled:opacity-50 transition-all shadow-md shadow-purple-200"
              >
                {submitting ? 'Adding...' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 border border-[#d8c8f0] rounded-full text-sm text-[#6b5b7d] hover:text-[#2d1b4e] transition-all bg-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Users', value: subs.length, icon: Users, color: 'text-[#2d1b4e]' },
          { label: 'Active', value: activeSubs.length, icon: CheckCircle, color: 'text-[#10b981]' },
          { label: 'Expired', value: expiredSubs.length, icon: XCircle, color: 'text-[#ef4444]' },
          { label: 'Expiring Soon', value: activeSubs.filter(s => s.daysLeft !== null && s.daysLeft <= 3).length, icon: Clock, color: 'text-[#f59e0b]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-semibold">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl h-16 animate-pulse" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#ecdbfd] border border-dashed border-[#d8c8f0] rounded-3xl py-20">
          <Crown className="w-10 h-10 text-[#6b5b7d] mb-3" />
          <p className="text-sm text-[#6b5b7d]">No subscriptions yet</p>
          <p className="text-xs text-[#6b5b7d]/70 mt-1">Click "Add User" to grant access</p>
        </div>
      ) : (
        <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8c8f0] bg-[#f5efff]">
                {['User', 'Telegram ID', 'Plan', 'Status', 'Expires', 'Days Left', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#6b5b7d] uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((sub, i) => (
                <tr
                  key={sub.telegramId}
                  className={`border-b border-[#d8c8f0]/50 hover:bg-[#f5efff]/60 transition-colors ${i % 2 === 0 ? '' : 'bg-white/40'}`}
                >
                  <td className="px-4 py-3 font-semibold text-[#2d1b4e]">
                    @{sub.username || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyId(sub.telegramId)}
                      className="flex items-center gap-1 font-mono text-xs text-[#6b5b7d] hover:text-[#2d1b4e] transition-colors group"
                    >
                      {sub.telegramId}
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b5b7d]">{sub.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      sub.status === 'active'
                        ? 'bg-[#10b981]/10 text-[#10b981]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
                      {sub.status === 'active' ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#6b5b7d]">
                    {formatDate(sub.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {sub.daysLeft === null ? (
                      <span className="text-[#7c3aed]">∞</span>
                    ) : sub.daysLeft <= 3 ? (
                      <span className="text-[#f59e0b] font-semibold">{sub.daysLeft}d</span>
                    ) : (
                      <span className="text-[#6b5b7d]">{sub.daysLeft}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(sub.telegramId, sub.username)}
                      disabled={deleting === sub.telegramId}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#ef4444] border border-[#ef4444]/30 rounded-full hover:bg-[#ef4444]/10 disabled:opacity-50 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      {deleting === sub.telegramId ? '...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#f5efff] border border-[#d8c8f0] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#7c3aed] text-xs font-bold">TG</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2d1b4e]">Telegram Bot Active</p>
          <p className="text-xs text-[#6b5b7d] mt-0.5">
            Users can interact via the bot. Commands: /start · /apk · /reset_password
          </p>
          <p className="text-xs text-[#6b5b7d]/70 mt-1">
            Admin commands: /adduser {'{'}telegramId{'}'} {'{'}days{'}'} {'{'}username{'}'} · /removeuser · /listusers · /stats
          </p>
        </div>
      </div>
    </Layout>
  );
}
