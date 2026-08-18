import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, ArrowRight, Loader2, User } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { ArrowRight, Mail, Lock, Loader2, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Eyebrow } from '@/components/ui/bezel';
import { Mail, Lock, ArrowRight, Loader2, Zap } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const IS_API_CONFIGURED = API_BASE.length > 0;

type Step = 'credentials' | 'otp';

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const count = Math.min(60, Math.floor(window.innerWidth / 24));
    const pts = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
      r: 0.8 + Math.random() * 1.6,
    }));
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(109, 99, 255, 0.35)';
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h;
          const d = Math.hypot(dx, dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.strokeStyle = `rgba(109, 99, 255, ${0.16 * (1 - d / 130)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />;
}

export function Login() {
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [sessionId] = useState(() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const isEmail = identifier.includes('@');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), email: identifier.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      setTelegramId(data.telegramId);
      setStep('otp');
    } catch {
      setError('Could not connect to server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const email = result.user.email || '';

      // Send to backend for verification + subscription check
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Google login failed. Ensure your Google email is linked to panel account. Contact admin.');
        return;
      }

      login({ telegramId: data.telegramId, isAdmin: data.isAdmin, username: data.username });
      setLocation('/dashboard');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('popup-closed') || msg.includes('cancelled')) {
        setError('Google sign-in cancelled.');
      } else if (msg.includes('auth/')) {
        setError(`Google auth error: ${msg}`);
      } else {
        setError(err?.message || 'Google sign-in failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !telegramId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, otp: otp.trim(), sessionId, device: (navigator.userAgent || 'Unknown').slice(0,60) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'OTP verification failed');
        return;
      }

      login({ telegramId: data.telegramId, isAdmin: data.isAdmin, username: data.username, sessionId: data.sessionId || sessionId });
      setLocation('/dashboard');
    } catch {
      setError('Could not connect to server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <ParticleField />
      {/* Subtle telemetry backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.5]" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="brand-mark w-16 h-16 rounded-2xl mx-auto mb-5 shadow-lg shadow-primary/25">
            <Zap className="w-7 h-7" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">HARRYAXE</h1>
          <p className="page-eyebrow">Panel · Sign in</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {(['credentials', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full font-mono text-xs font-bold transition-all ${
                step === s
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : i < (['credentials', 'otp'] as Step[]).indexOf(step)
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-card border border-card-border text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 1 && <div className={`w-12 h-px rounded-full ${step === 'otp' ? 'bg-primary' : 'bg-card-border'}`} />}
            </div>
          ))}
        </div>

        {!IS_API_CONFIGURED && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-2xl text-center">
            ⚠️ VITE_API_URL not set — API calls will fail on GitHub Pages. Set repo variable VITE_API_URL (e.g. https://parivahan-api.onrender.com)
          </div>
        )}
        <div className="bg-[#ecdbfd] border border-[#b8a0e0] p-6 rounded-3xl shadow-xl shadow-purple-100/50">
        <div className="stat-card p-6 shadow-xl shadow-primary/5">
          {/* ── Step 1: Credentials ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#2d1b4e]">Welcome Back</h2>
                <p className="text-sm text-[#6b5b7d] mt-1">Sign in with Email / Username or Google</p>
              </div>

              <div className="relative">
                {isEmail ? (
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
                ) : (
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-[#ede4fa] border border-[#d8c8f0] rounded-2xl py-3.5 pl-12 pr-4 text-[#2d1b4e] placeholder:text-[#6b5b7d] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                  placeholder="Email or Username"
                  autoFocus
                  required
                />
              </div>
        <Reveal delay={120}>
          <div className="bezel">
            <div className="bezel-inner p-8">
              {step === 'credentials' && (
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Welcome back
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Authenticate to enter the command surface
                    </p>
                  </div>
                <h2 className="font-display text-xl font-bold text-foreground">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/40 border border-input rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  placeholder="Email"
                  autoFocus
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted/40 border border-input rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  placeholder="Password"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !identifier || !password}
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-200"
                disabled={loading || !email || !password}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#d8c8f0]" />
                <span className="text-xs text-[#6b5b7d]">or</span>
                <div className="flex-1 h-px bg-[#d8c8f0]" />
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || !IS_API_CONFIGURED}
                className="w-full bg-white hover:bg-gray-50 text-[#2d1b4e] font-semibold py-3.5 rounded-full flex items-center justify-center gap-3 border border-[#d8c8f0] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <p className="text-[11px] text-center text-[#6b5b7d] leading-relaxed">
                Username: apka Telegram username / Email: admin ya subscription email.<br />
                Google email must be linked to panel account (ask admin via /adduser).
              </p>
            </form>
          )}
              {step === 'otp' && (
                <form onSubmit={handleOtp} className="space-y-4">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Verification
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      6-digit OTP tumhare Telegram pe bheja gaya hai
                    </p>
                  </div>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div className="mb-5">
                <h2 className="font-display text-xl font-bold text-foreground">Verification</h2>
                <p className="text-sm text-muted-foreground mt-1">6-digit OTP sent to your Telegram</p>
              </div>

              <div className="p-3 bg-muted/40 border border-card-border rounded-xl text-sm text-muted-foreground">
                Open the bot → copy the OTP → paste it here. It expires in 5 minutes.
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-muted/40 border border-input rounded-xl py-3.5 px-4 text-foreground text-center font-mono text-xl tracking-[0.5em] placeholder:text-muted-foreground placeholder:font-sans placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                placeholder="000000"
                autoFocus
                required
              />

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify &amp; Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ← Wapas jaao
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="hover:text-primary cursor-pointer transition-colors">Contact Support</span>
          <span className="text-card-border">|</span>
          <a href="https://t.me/axecodi" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Join Telegram</a>
        </div>
      </div>
    </div>
  );
}
