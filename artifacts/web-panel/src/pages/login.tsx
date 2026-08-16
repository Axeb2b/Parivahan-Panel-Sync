import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, ArrowRight, Loader2, User } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { ArrowRight, Mail, Lock, Loader2, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Eyebrow } from '@/components/ui/bezel';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const IS_API_CONFIGURED = API_BASE.length > 0;

type Step = 'credentials' | 'otp';

export function Login() {
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [telegramId, setTelegramId] = useState('');
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
      setError('Server se connect nahi ho paya. Try again.');
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient mesh — fixed orbs + noise, pointer-events-none */}
      <div className="noise-overlay" aria-hidden />
      <div className="absolute -top-40 -left-40 w-[42rem] h-[42rem] rounded-full bg-[#8b5cf6]/18 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-48 -right-32 w-[38rem] h-[38rem] rounded-full bg-[#34d399]/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#22d3ee]/10 blur-[110px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Reveal className="text-center mb-10">
          <div className="inline-flex flex-col items-center">
            <div className="bezel mb-6">
              <div className="bezel-inner w-20 h-20 flex items-center justify-center">
                <div className="w-11 h-11 rounded-2xl bg-[#8b5cf6] flex items-center justify-center shadow-[0_14px_40px_-12px_rgba(139,92,246,0.9)]">
                  <Fingerprint className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              CyberCommand
            </h1>
            <span className="eyebrow mt-4">Unified Command Surface</span>
          </div>
        </Reveal>

        {/* Step indicator — hairlines + live node */}
        <div className="flex items-center justify-center gap-3 mb-7">
          {(['credentials', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all duration-700 ease-spring',
                  step === s
                    ? 'bg-[#8b5cf6] text-white shadow-[0_6px_20px_-6px_rgba(139,92,246,0.8)]'
                    : i < (['credentials', 'otp'] as Step[]).indexOf(step)
                      ? 'bg-[#34d399] text-black'
                      : 'bg-white/[0.04] border border-white/10 text-muted-foreground'
                )}
              >
                {i + 1}
              </div>
              {i < 1 && (
                <div
                  className={cn(
                    'w-12 h-px rounded-full transition-colors duration-700 ease-smooth',
                    step === 'otp' ? 'bg-[#34d399]' : 'bg-white/15'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {!IS_API_CONFIGURED && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-2xl text-center">
            ⚠️ VITE_API_URL not set — API calls will fail on GitHub Pages. Set repo variable VITE_API_URL (e.g. https://parivahan-api.onrender.com)
          </div>
        )}
        <div className="bg-[#ecdbfd] border border-[#b8a0e0] p-6 rounded-3xl shadow-xl shadow-purple-100/50">
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

                  <div className="relative group">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-[#a78bfa] transition-colors duration-500 ease-smooth"
                      strokeWidth={1.6}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field pl-12"
                      placeholder="Email"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-[#a78bfa] transition-colors duration-500 ease-smooth"
                      strokeWidth={1.6}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field pl-12"
                      placeholder="Password"
                      required
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#f87171] text-sm rounded-2xl">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="btn-island w-full bg-[#8b5cf6] text-white px-6 py-3.5 text-sm shadow-[0_14px_40px_-14px_rgba(139,92,246,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <span className="island w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
                        </span>
                      </>
                    )}
                  </button>
                </form>
              )}

              <button
                type="submit"
                disabled={loading || !identifier || !password}
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-200"
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

                  <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-[13px] text-muted-foreground leading-relaxed">
                    Bot open karo → OTP copy karo → yahan paste karo. OTP 5 minute mein expire
                    ho jaata hai.
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="field text-center text-2xl tracking-[0.55em] placeholder:text-base placeholder:tracking-normal py-4"
                    placeholder="000000"
                    autoFocus
                    required
                  />

                  {error && (
                    <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#f87171] text-sm rounded-2xl">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="btn-island w-full bg-[#8b5cf6] text-white px-6 py-3.5 text-sm shadow-[0_14px_40px_-14px_rgba(139,92,246,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#7c3aed] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Login</span>
                        <span className="island w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors duration-500 ease-smooth py-1.5"
                  >
                    ← Wapas jaao
                  </button>
                </form>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={200} className="mt-7 flex items-center justify-center gap-3 text-[13px] text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer transition-colors duration-500 ease-smooth">
            Contact Support
          </span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <a
            href="https://t.me/axecodi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#a78bfa] transition-colors duration-500 ease-smooth"
          >
            Join Telegram
          </a>
        </Reveal>
      </div>
    </div>
  );
}
