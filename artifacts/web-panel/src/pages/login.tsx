import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f5f0ff] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Soft background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#ecdbfd]/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#d4f5ff]/40 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#ecdbfd] border border-[#d8c8f0] shadow-lg mb-6">
            <span className="text-4xl font-bold text-[#7c3aed]">N</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-[#2d1b4e]">NEXUS</h1>
          <p className="text-sm font-medium tracking-[0.25em] text-[#6b5b7d] uppercase">Panel</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {(['credentials', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                step === s
                  ? 'bg-[#7c3aed] text-white shadow-md shadow-purple-200'
                  : i < (['credentials', 'otp'] as Step[]).indexOf(step)
                  ? 'bg-[#ecdbfd] text-[#7c3aed] border border-[#b8a0e0]'
                  : 'bg-white border border-[#d8c8f0] text-[#9ca3af]'
              }`}>
                {i + 1}
              </div>
              {i < 1 && <div className={`w-12 h-px rounded-full ${step === 'otp' ? 'bg-[#7c3aed]' : 'bg-[#d8c8f0]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-[#ecdbfd] border border-[#b8a0e0] p-6 rounded-3xl shadow-xl shadow-purple-100/50">
          {/* ── Step 1: Credentials ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#2d1b4e]">Welcome Back</h2>
                <p className="text-sm text-[#6b5b7d] mt-1">Sign in to your account</p>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#ede4fa] border border-[#d8c8f0] rounded-2xl py-3.5 pl-12 pr-4 text-[#2d1b4e] placeholder:text-[#6b5b7d] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                  placeholder="Email"
                  autoFocus
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b7d]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#ede4fa] border border-[#d8c8f0] rounded-2xl py-3.5 pl-12 pr-4 text-[#2d1b4e] placeholder:text-[#6b5b7d] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                  placeholder="Password"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-500 text-sm rounded-2xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
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
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#2d1b4e]">Verification</h2>
                <p className="text-sm text-[#6b5b7d] mt-1">6-digit OTP tumhare Telegram pe bheja gaya hai</p>
              </div>

              <div className="p-3 bg-[#f5efff] border border-[#d8c8f0] rounded-2xl text-sm text-[#6b5b7d]">
                Bot open karo → OTP copy karo → yahan paste karo. OTP 5 minute mein expire ho jaata hai.
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#ede4fa] border border-[#d8c8f0] rounded-2xl py-3.5 px-4 text-[#2d1b4e] text-center text-xl tracking-[0.5em] placeholder:text-[#6b5b7d] placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all"
                placeholder="000000"
                autoFocus
                required
              />

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-500 text-sm rounded-2xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-200"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                className="w-full text-sm text-[#6b5b7d] hover:text-[#2d1b4e] transition-colors py-1"
              >
                ← Wapas jaao
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6b5b7d]">
          <span className="hover:text-[#7c3aed] cursor-pointer transition-colors">Contact Support</span>
          <span className="text-[#d8c8f0]">|</span>
          <span className="hover:text-[#7c3aed] cursor-pointer transition-colors">Join Telegram</span>
        </div>
      </div>
    </div>
  );
}
