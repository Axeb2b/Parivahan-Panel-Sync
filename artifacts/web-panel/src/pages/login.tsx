import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { ShieldAlert, Lock, Mail, ArrowRight, Loader2, KeyRound, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Step = 'credentials' | 'otp';

export function Login() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // Step 1: Email + Password → send OTP
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      setTelegramId(data.telegramId);
      setStep('otp');
    } catch {
      setError('Server se connect nahi ho paya. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP verify
  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !telegramId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, otp: otp.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'OTP verification failed');
        return;
      }

      login({ telegramId: data.telegramId, isAdmin: data.isAdmin, username: data.username });
      setLocation('/dashboard');
    } catch {
      setError('Server se connect nahi ho paya. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-card border border-border shadow-lg mb-6 shadow-primary/5">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">
            CYBER<span className="text-primary">ZONE</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm tracking-wider uppercase">
            Command & Control Center
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {(['credentials', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full border text-xs font-mono font-bold transition-all ${
                step === s
                  ? 'border-primary bg-primary/15 text-primary'
                  : i < (['credentials', 'otp'] as Step[]).indexOf(step)
                  ? 'border-primary/50 bg-primary/10 text-primary/70'
                  : 'border-border bg-secondary text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 1 && <div className={`w-12 h-px ${step === 'otp' ? 'bg-primary/40' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border p-6 rounded-lg shadow-xl">
          {/* ── Step 1: Credentials ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="mb-5">
                <h2 className="text-sm font-mono font-semibold text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Login Credentials
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Apna email aur password enter karo
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    placeholder="user@example.com"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Enter password..."
                    required
                  />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground/60">
                  Password set nahi? Telegram bot mein /reset_password bhejo
                </p>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>CONTINUE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div className="mb-5">
                <h2 className="text-sm font-mono font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Telegram OTP
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  6-digit OTP tumhare Telegram pe bheja gaya hai
                </p>
              </div>

              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs font-mono text-muted-foreground">
                  Bot open karo → OTP copy karo → yahan paste karo.<br />
                  OTP 5 minute mein expire ho jaata hai.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  One-Time Password
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-background border border-border rounded-md py-2.5 px-4 text-foreground font-mono text-center text-xl tracking-[0.5em] placeholder:text-muted-foreground placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>VERIFY & LOGIN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                className="w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ← Wapas jaao
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-[10px] font-mono text-muted-foreground/50">
              UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
