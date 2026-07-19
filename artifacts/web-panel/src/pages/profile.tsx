import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  User, Mail, Shield, Calendar, Clock, Key, Send,
  Hash, CheckCircle, XCircle, Loader2, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function Profile() {
  const { userId, isAdmin, username } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);

  const [channelInput, setChannelInput] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  useEffect(() => {
    if (!userId) return;
    apiFetch(`/auth/profile?telegramId=${userId}`)
      .then((data) => {
        setProfile(data);
        if (data.smsChannel) setChannelInput(data.smsChannel);
      })
      .catch(() => toast({ title: 'Error', description: 'Profile load nahi hua', variant: 'destructive' }))
      .finally(() => setLoadingProfile(false));
  }, [userId]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: 'Error', description: 'New passwords match nahi kar rahe', variant: 'destructive' });
      return;
    }
    if (pwForm.newPassword.length < 4) {
      toast({ title: 'Error', description: 'Password kam se kam 4 characters ka hona chahiye', variant: 'destructive' });
      return;
    }
    setChangingPw(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile?.email,
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      toast({ title: '✅ Password Changed', description: 'Naya password set ho gaya' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setChangingPw(false);
    }
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingChannel(true);
    try {
      await apiFetch('/auth/set-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: userId,
          channelId: channelInput.trim() || null,
        }),
      });
      toast({
        title: channelInput.trim() ? '✅ Channel Set' : '✅ Channel Removed',
        description: channelInput.trim()
          ? 'Ab naye SMS is channel pe forward honge'
          : 'SMS forwarding band kar diya',
      });
      setProfile((p: any) => ({ ...p, smsChannel: channelInput.trim() || null }));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingChannel(false);
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return '—';
    return format(new Date(ts), 'dd MMM yyyy, HH:mm') + ' IST';
  };

  const daysLeft = (expiresAt: number | null) => {
    if (!expiresAt) return null;
    const diff = expiresAt - Date.now();
    return Math.max(0, Math.floor(diff / 86_400_000));
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2d1b4e] flex items-center gap-2">
            <User className="w-6 h-6 text-[#7c3aed]" />
            Profile
          </h1>
          <p className="text-[#6b5b7d] text-sm mt-1">Account details & settings</p>
        </div>

        {loadingProfile ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Account Info Card */}
            <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden">
              <div className="h-1 w-full bg-[#7c3aed]" />
              <div className="p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#6b5b7d] mb-4">Account Info</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={User} label="Username" value={profile?.username || username} />
                  <InfoRow icon={Hash} label="Telegram ID" value={userId || '—'} mono />
                  <InfoRow icon={Mail} label="Email" value={profile?.email || '—'} />
                  <InfoRow
                    icon={Shield}
                    label="Role"
                    value={isAdmin ? 'Administrator' : 'Subscriber'}
                    highlight={isAdmin}
                  />
                  {!isAdmin && (
                    <>
                      <InfoRow icon={Calendar} label="Plan" value={profile?.plan || '—'} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Status
                        </span>
                        <span className={`text-sm font-medium flex items-center gap-1.5 ${
                          profile?.status === 'active' ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}>
                          {profile?.status === 'active' ? (
                            <><CheckCircle className="w-4 h-4" /> Active</>
                          ) : (
                            <><XCircle className="w-4 h-4" /> Expired</>
                          )}
                          {profile?.expiresAt && profile?.status === 'active' && (
                            <span className="text-[#6b5b7d] text-xs ml-1">
                              ({daysLeft(profile.expiresAt)}d left)
                            </span>
                          )}
                        </span>
                      </div>
                      {profile?.expiresAt && (
                        <InfoRow
                          icon={Calendar}
                          label="Expires"
                          value={formatDate(profile.expiresAt)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden">
              <div className="p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#6b5b7d] mb-4 flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" /> Change Password
                </h2>
                {!profile?.email ? (
                  <div className="text-sm text-[#6b5b7d] bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-4">
                    ⚠️ Email not set. Admin se contact karo ya Telegram bot mein <code className="text-[#7c3aed]">/setpanel</code> ya <code className="text-[#7c3aed]">/reset_password</code> use karo.
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] block mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={pwForm.currentPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                          required
                          placeholder="••••••"
                          className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] block mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={pwForm.newPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                          required
                          minLength={4}
                          placeholder="••••••"
                          className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] block mb-1">
                          Confirm New
                        </label>
                        <input
                          type="password"
                          value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          required
                          placeholder="••••••"
                          className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={changingPw}
                      className="flex items-center gap-2 bg-[#7c3aed] text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-[#6d28d9] disabled:opacity-50 transition-colors shadow-md shadow-purple-200"
                    >
                      {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      {changingPw ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* SMS Channel Config — Admin only */}
            {isAdmin && (
              <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden">
                <div className="p-5">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#6b5b7d] mb-1 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> SMS Forward Channel
                  </h2>
                  <p className="text-xs text-[#6b5b7d] mb-4">
                    Sab devices ke naye SMS is Telegram channel pe automatically forward honge.
                    Pehle bot ko channel admin banao, phir channel ID yahan set karo.
                  </p>

                  {profile?.smsChannel && (
                    <div className="mb-4 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3 font-medium text-sm flex items-center gap-2 text-[#2d1b4e]">
                      <CheckCircle className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                      <span>Active: <code className="text-[#7c3aed]">{profile.smsChannel}</code></span>
                    </div>
                  )}

                  <form onSubmit={handleSaveChannel} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] block mb-1">
                        Channel ID (e.g. -100xxxxxxxxxx or @channelname)
                      </label>
                      <input
                        type="text"
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value)}
                        placeholder="-100xxxxxxxxxx"
                        className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingChannel}
                      className="flex items-center gap-2 bg-[#7c3aed] text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#6d28d9] disabled:opacity-50 transition-colors shadow-md shadow-purple-200 whitespace-nowrap"
                    >
                      {savingChannel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {savingChannel ? 'Saving...' : channelInput.trim() ? 'Set Channel' : 'Remove Channel'}
                    </button>
                  </form>

                  <div className="mt-4 text-xs text-[#6b5b7d] bg-[#f5efff] rounded-2xl p-3 space-y-1">
                    <p className="font-semibold text-[#2d1b4e]">Setup steps:</p>
                    <p>1. Apna Telegram channel banao</p>
                    <p>2. Bot ko channel admin banao (message bhejne ki permission do)</p>
                    <p>3. Channel ka ID yahan paste karo</p>
                    <p>4. "Set Channel" click karo</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bot Quick Actions */}
            <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#6b5b7d] mb-3 flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Bot Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                  <p className="text-[#6b5b7d] text-xs mb-1">Reset password via bot</p>
                  <code className="text-[#7c3aed] font-medium">/reset_password</code>
                </div>
                {isAdmin && (
                  <>
                    <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                      <p className="text-[#6b5b7d] text-xs mb-1">Set SMS channel via bot</p>
                      <code className="text-[#7c3aed] font-medium">/setchannel -100xxx</code>
                    </div>
                    <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                      <p className="text-[#6b5b7d] text-xs mb-1">Add user</p>
                      <code className="text-[#7c3aed] font-medium">/adduser ID days @user email</code>
                    </div>
                    <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                      <p className="text-[#6b5b7d] text-xs mb-1">View all users</p>
                      <code className="text-[#7c3aed] font-medium">/listusers</code>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
  highlight = false,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b5b7d] flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${highlight ? 'text-[#7c3aed]' : 'text-[#2d1b4e]'}`}>
        {value}
      </span>
    </div>
  );
}
