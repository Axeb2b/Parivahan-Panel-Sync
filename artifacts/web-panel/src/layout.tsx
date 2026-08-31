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
    <div className="min-h-screen text-foreground flex flex-col font-sans pb-16 sm:pb-0">
      {/* ── Top header (glass) ── */}
      <header className="sticky top-0 z-10 glass-card px-4 lg:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6466f1] to-[#00c2ff] flex items-center justify-center shadow-lg shadow-[#6466f1]/30 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-lg text-white leading-tight brand-gradient">
                PARIVAHAN
              </span>
              <span className="text-[10px] font-medium tracking-[0.25em] text-[#7e86a3] uppercase leading-tight">
                Panel Pro
              </span>
            </div>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const active =
                location === href || location.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? "bg-[#6466f1] text-white shadow-md shadow-[#6466f1]/40 btn-glow"
                      : "text-[#7e86a3] hover:text-white hover:bg-white/10"
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
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#c5cbe0]">
            <User className="w-3 h-3 text-[#6466f1]" />
            <span>{isAdmin ? "Admin" : username || "User"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 rounded-full text-[#7e86a3] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-x-hidden p-4 lg:p-6 container mx-auto max-w-7xl">
        {children}
      </main>

      {/* ── Mobile bottom nav — visible only on mobile ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 glass-card border-t border-white/10 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-[#6466f1]" : "text-[#7e86a3]"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${active ? "bg-[#6466f1]/15" : ""}`}
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
          className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-[10px] font-medium text-[#7e86a3] transition-colors"
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
