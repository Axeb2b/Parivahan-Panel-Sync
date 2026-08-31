import React from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  LogOut,
  Crown,
  User,
  LayoutGrid,
  MessageSquare,
  Settings,
  Send,
  Zap,
  Wrench,
  ShieldCheck,
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, isAdmin, username } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const navLinks = [
    {
      href: "/dashboard",
      label: "Devices",
      icon: LayoutGrid,
      adminOnly: false,
    },
    { href: "/all-sms", label: "SMS", icon: MessageSquare, adminOnly: false },
    { href: "/subscriptions", label: "Users", icon: Crown, adminOnly: true },
    { href: "/telegram", label: "Telegram", icon: Send, adminOnly: false },
    { href: "/tool", label: "Aadhaar", icon: ShieldCheck, adminOnly: false },
    { href: "/pam", label: "PAM", icon: Wrench, adminOnly: true },
    { href: "/profile", label: "Profile", icon: Settings, adminOnly: false },
  ];

  const visibleLinks = navLinks.filter((l) => !l.adminOnly || isAdmin);

  return (
    <div className="app-shell min-h-screen text-foreground flex flex-col font-sans pb-16 sm:pb-0">
      {/* ── Top header (glass) ── */}
      <header className="app-header sticky top-0 z-30 px-4 lg:px-7 h-[4.5rem] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="brand-mark w-10 h-10 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-tight text-lg text-foreground leading-tight">
                PARIVAHAN
              </span>
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-muted-foreground uppercase leading-tight">
                Panel Pro
              </span>
            </div>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1 rounded-2xl border border-border/70 bg-card/60 p-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const active =
                location === href || location.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-chip px-3.5 py-2 ${
                    active
                      ? "nav-chip-active shadow-sm btn-glow"
                      : "nav-chip-idle hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground">
            <User className="w-3 h-3 text-primary" />
            <span>{isAdmin ? "Admin" : username || "User"}</span>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 container mx-auto max-w-[88rem]">
        {children}
      </main>

      {/* ── Mobile bottom nav — visible only on mobile ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 app-header flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${active ? "bg-primary/12" : ""}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
        {/* Logout at the end of mobile nav */}
        <button
          onClick={handleLogout}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <div className="p-1.5 rounded-xl">
            <LogOut className="w-5 h-5" />
          </div>
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}
