import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, ArrowRight, Loader2, Zap } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type Step = "credentials" | "otp";

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0,
      h = 0,
      raf = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const count = Math.min(60, Math.floor(window.innerWidth / 24));
    const pts = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
      r: 0.8 + Math.random() * 1.6,
    }));
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(109, 99, 255, 0.35)";
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i],
            b = pts[j];
          const dx = (a.x - b.x) * w,
            dy = (a.y - b.y) * h;
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
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  );
}

export function Login() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isAuthenticated === true) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      setTelegramId(data.telegramId);
      setStep("otp");
    } catch {
      setError("Could not connect to server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !telegramId) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          otp: otp.trim(),
          sessionId,
          device: (navigator.userAgent || "Unknown").slice(0, 60),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "OTP verification failed");
        return;
      }

      login({
        telegramId: data.telegramId,
        isAdmin: data.isAdmin,
        username: data.username,
        sessionId: data.sessionId || sessionId,
        firebaseToken: data.firebaseToken || null,
      });
      setLocation("/dashboard");
    } catch {
      setError("Could not connect to server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <ParticleField />
      {/* Subtle telemetry backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.5]"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
            HARRYAXE
          </h1>
          <p className="page-eyebrow">Panel · Sign in</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {(["credentials", "otp"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full font-mono text-xs font-bold transition-all ${
                  step === s
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : i < (["credentials", "otp"] as Step[]).indexOf(step)
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-card border border-card-border text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 1 && (
                <div
                  className={`w-12 h-px rounded-full ${step === "otp" ? "bg-primary" : "bg-card-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="stat-card p-6 shadow-xl shadow-primary/5">
          {/* ── Step 1: Credentials ── */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="mb-5">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Welcome back
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign in to your account
                </p>
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
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div className="mb-5">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Verification
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  6-digit OTP sent to your Telegram
                </p>
              </div>

              <div className="p-3 bg-muted/40 border border-card-border rounded-xl text-sm text-muted-foreground">
                Open the bot → copy the OTP → paste it here. It expires in 5
                minutes.
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
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
                onClick={() => {
                  setStep("credentials");
                  setError("");
                  setOtp("");
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ← Wapas jaao
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="hover:text-primary cursor-pointer transition-colors">
            Contact Support
          </span>
          <span className="text-card-border">|</span>
          <a
            href="https://t.me/axecodi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Join Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
