import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, ArrowRight, Loader2, Zap, Eye, EyeOff } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// Bot configuration
const BOT_USERNAME = "AxeBot";

// Telegram Login Widget container
function TelegramLoginWidget() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Declare global callback BEFORE script loads
    (window as any).onTelegramAuth = (user: any) => {
      if (!user?.id) return;
      fetch(`${API_BASE}/api/auth/telegram-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      })
        .then(r => r.json())
        .then(data => {
          if (data.accessToken) {
            login({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              telegramId: data.telegramId,
              isAdmin: data.isAdmin,
              username: data.username,
              expiresIn: data.expiresIn || 900,
            });
            setLocation("/dashboard");
          }
        })
        .catch(console.error);
    };

    // Load Telegram widget script with parameters directly in URL for reliability
    const script = document.createElement("script");
    script.src = `https://telegram.org/js/telegram-widget.js?22`;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", "en");
    script.setAttribute("data-onauth", "onTelegramAuth");
    script.async = true;

    const container = document.getElementById("telegram-login-widget");
    if (container) {
      // Clear any existing content
      container.innerHTML = "";
      container.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
      const existing = document.querySelector(`script[src*="telegram.org/js/telegram-widget"]`);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div id="telegram-login-widget" className="w-full max-w-sm" />
      <p className="text-xs text-muted-foreground text-center">Sign in with your Telegram account</p>
    </div>
  );
}

// Particle background
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
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
      for (let i = 0; i < pts.length; i++) {
        pts[i].x += pts[i].vx;
        pts[i].y += pts[i].vy;
        if (pts[i].x < 0 || pts[i].x > 1) pts[i].vx *= -1;
        if (pts[i].y < 0 || pts[i].y > 1) pts[i].vy *= -1;
        ctx.beginPath();
        ctx.arc(pts[i].x * w, pts[i].y * h, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(109, 99, 255, 0.35)";
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
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />
  );
}

export function Login() {
  const [step] = useState<"credentials">("credentials");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated === true) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  const requestLogin = async (): Promise<boolean> => {
    if (!email.trim()) return false;
    setLoading(true);
    setError("");

    try {
      // Determine if this is telegram ID or email
      const loginBody: any = {};

      if (/^[0-9]{10,15}$/.test(email.trim())) {
        loginBody.telegramId = email.trim();
      } else {
        loginBody.email = email.trim().toLowerCase();
      }

      // Passcode is either telegram ID or API key
      if (/^[0-9]{10,15}$/.test(passcode.trim())) {
        loginBody.telegramId = passcode.trim();
      } else {
        loginBody.apiKey = passcode.trim();
      }

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return false;
      }

      login({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        telegramId: data.telegramId,
        isAdmin: data.isAdmin,
        username: data.username,
        expiresIn: data.expiresIn || 900,
      });

      setLocation("/dashboard");
      return true;
    } catch {
      setError("Could not connect to server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestLogin();
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center p-4 py-8 relative overflow-hidden">
      <ParticleField />
      <div className="absolute inset-0 pointer-events-none opacity-[0.5]" aria-hidden>
        <div style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 m-auto">
        <div className="text-center mb-7">
          <div className="brand-mark w-16 h-16 rounded-2xl mx-auto mb-5 shadow-lg shadow-primary/25">
            <Zap className="w-7 h-7" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
            HARRYAXE
          </h1>
          <p className="page-eyebrow">Panel · Sign in</p>
        </div>

        {/* Telegram Login Widget */}
        <div className="mb-6">
          <TelegramLoginWidget />
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-px bg-border rounded-full w-16" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="h-px bg-border rounded-full w-16" />
        </div>

        <div className="stat-card p-6 shadow-xl shadow-primary/5">
          {step === "credentials" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-5">
                <h2 className="font-display text-xl font-bold text-foreground">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in with your telegram ID or access key</p>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/40 border border-input rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  placeholder="Telegram ID or Email"
                  autoFocus
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <button type="button" onClick={() => setShowPasscode((v) => !v)}>
                    {showPasscode ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                    )}
                  </button>
                </div>
                {showPasscode ? (
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-muted/40 border border-input rounded-xl py-3.5 pl-12 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                    placeholder="Access Key (10-digit ID)"
                    autoComplete="off"
                    required
                    autoFocus
                  />
                ) : (
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-muted/40 border border-input rounded-xl py-3.5 pl-12 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                    placeholder="Access Key (10-digit ID)"
                    autoComplete="off"
                    required
                    autoFocus
                  />
                )}
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 text-destructive text-sm rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !passcode.trim()}
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
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="hover:text-primary cursor-pointer transition-colors">Contact Support</span>
          <span className="text-card-border">|</span>
          <a href="https://t.me/axecodi" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Join Telegram
          </a>
        </div>
      </div>
    </div>
  );
}