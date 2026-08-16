import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  User, Mail, Shield, Calendar, Clock, Key, Send,
  Hash, CheckCircle, XCircle, Loader2, ExternalLink, Download, Fingerprint
} from 'lucide-react';
import { format } from 'date-fns';
import { Reveal, PageHeader, GlassCard, PillButton } from '@/components/ui/bezel';
import { cn } from '@/lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

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

  const [downloadingApk, setDownloadingApk] = useState(false);

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

  const handleDownloadApk = () => {
    if (!userId) return;
    setDownloadingApk(true);
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/apk/download?telegramId=${encodeURIComponent(userId)}`;
    a.download = `mParivahan_AxeCodi_${userId}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloadingApk(false), 2000);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <PageHeader eyebrow="Identity" title="Profile" description="Account details & settings" />

        {loadingProfile ? (
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-[1.75rem] animate-pulse bg-white/[0.03] border border-white/[0.05]" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <Reveal>
              <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
                <div className="flex items-center gap-2 mb-6">
                  <Fingerprint className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.6} />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Info</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
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
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3 h-3" strokeWidth={1.6} /> Status
                        </span>
                        <span className={cn('text-sm font-medium flex items-center gap-1.5', profile?.status === 'active' ? 'text-[#34d399]' : 'text-[#f87171]')}>
                          {profile?.status === 'active' ? (
                            <><CheckCircle className="w-4 h-4" strokeWidth={1.6} /> Active</>
                          ) : (
                            <><XCircle className="w-4 h-4" strokeWidth={1.6} /> Expired</>
                          )}
                          {profile?.expiresAt && profile?.status === 'active' && (
                            <span className="text-muted-foreground text-xs ml-1">({daysLeft(profile.expiresAt)}d left)</span>
                          )}
                        </span>
                      </div>
                      {profile?.expiresAt && (
                        <InfoRow icon={Calendar} label="Expires" value={formatDate(profile.expiresAt)} />
                      )}
                    </>
                  )}
                </div>
              </GlassCard>
            </Reveal>

            {/* Download APK */}
            <Reveal delay={60}>
              <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" strokeWidth={1.6} /> Download APK
                </h2>
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                  Apni unique APK download karo — isme aapka Telegram ID baked hai, isliye isse install karne pe connection aapki panel mein dikhega.
                  Pehli baar build hone mein ~30-60 seconds lag sakte hain, phir cached instant milega.
                </p>
                <PillButton
                  onClick={handleDownloadApk}
                  disabled={downloadingApk || !userId}
                  icon={downloadingApk ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <Download className="w-4 h-4" strokeWidth={1.8} />}
                >
                  {downloadingApk ? 'Building...' : 'Download APK'}
                </PillButton>
              </GlassCard>
            </Reveal>

            {/* Change Password */}
            <Reveal delay={120}>
              <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" strokeWidth={1.6} /> Change Password
                </h2>
                {!profile?.email ? (
                  <div className="text-sm text-muted-foreground bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                    ⚠️ Email not set. Admin se contact karo ya Telegram bot mein <code className="text-[#a78bfa]">/setpanel</code> ya <code className="text-[#a78bfa]">/reset_password</code> use karo.
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Current Password</label>
                        <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} required placeholder="••••••" className="field" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">New Password</label>
                        <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} required minLength={4} placeholder="••••••" className="field" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Confirm New</label>
                        <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))} required placeholder="••••••" className="field" />
                      </div>
                    </div>
                    <PillButton
                      type="submit"
                      disabled={changingPw}
                      icon={changingPw ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <Key className="w-4 h-4" strokeWidth={1.8} />}
                    >
                      {changingPw ? 'Changing...' : 'Change Password'}
                    </PillButton>
                  </form>
                )}
              </GlassCard>
            </Reveal>

            {/* SMS Channel — Admin only */}
            {isAdmin && (
              <Reveal delay={180}>
                <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" strokeWidth={1.6} /> SMS Forward Channel
                  </h2>
                  <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                    Sab devices ke naye SMS is Telegram channel pe automatically forward honge.
                    Pehle bot ko channel admin banao, phir channel ID yahan set karo.
                  </p>

                  {profile?.smsChannel && (
                    <div className="mb-4 bg-[#34d399]/[0.06] border border-[#34d399]/20 rounded-2xl p-3.5 font-medium text-sm flex items-center gap-2 text-foreground">
                      <CheckCircle className="w-4 h-4 text-[#34d399] flex-shrink-0" strokeWidth={1.6} />
                      <span>Active: <code className="text-[#a78bfa]">{profile.smsChannel}</code></span>
                    </div>
                  )}

                  <form onSubmit={handleSaveChannel} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                        Channel ID (e.g. -100xxxxxxxxxx or @channelname)
                      </label>
                      <input type="text" value={channelInput} onChange={(e) => setChannelInput(e.target.value)} placeholder="-100xxxxxxxxxx" className="field" />
                    </div>
                    <PillButton
                      type="submit"
                      disabled={savingChannel}
                      icon={savingChannel ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <Send className="w-4 h-4" strokeWidth={1.8} />}
                    >
                      {savingChannel ? 'Saving...' : channelInput.trim() ? 'Set Channel' : 'Remove Channel'}
                    </PillButton>
                  </form>

                  <div className="mt-5 text-xs text-muted-foreground bg-white/[0.03] rounded-2xl p-4 space-y-1.5 border border-white/[0.06]">
                    <p className="font-semibold text-foreground">Setup steps:</p>
                    <p>1. Apna Telegram channel banao</p>
                    <p>2. Bot ko channel admin banao (message bhejne ki permission do)</p>
                    <p>3. Channel ka ID yahan paste karo</p>
                    <p>4. "Set Channel" click karo</p>
                  </div>
                </GlassCard>
              </Reveal>
            )}

            {/* Bot Quick Actions */}
            <Reveal delay={240}>
              <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-7">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.6} /> Bot Quick Actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                    <p className="text-muted-foreground text-xs mb-1.5">Reset password via bot</p>
                    <code className="text-[#a78bfa] font-medium font-mono text-xs">/reset_password</code>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                        <p className="text-muted-foreground text-xs mb-1.5">Set SMS channel via bot</p>
                        <code className="text-[#a78bfa] font-medium font-mono text-xs">/setchannel -100xxx</code>
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                        <p className="text-muted-foreground text-xs mb-1.5">Add user</p>
                        <code className="text-[#a78bfa] font-medium font-mono text-xs">/adduser ID days @user email</code>
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                        <p className="text-muted-foreground text-xs mb-1.5">View all users</p>
                        <code className="text-[#a78bfa] font-medium font-mono text-xs">/listusers</code>
                      </div>
                    </>
                  )}
                </div>
              </GlassCard>
            </Reveal>
          </div>
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
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3 h-3" strokeWidth={1.6} /> {label}
      </span>
      <span className={cn('text-sm font-medium', mono && 'font-mono text-[13px]', highlight ? 'text-[#a78bfa]' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}
