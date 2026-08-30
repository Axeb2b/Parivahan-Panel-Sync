import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  LogOut,
  Crown,
  LayoutGrid,
  MessageSquare,
  Send,
  Search,
  Settings,
  Zap,
  ScanLine,
  KeyRound,
  Database,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";

const THEME_KEY = "harryaxe-theme";

function getInitialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark"; // dark tech is the default look
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, isAdmin, username } = useAuth();
  const [location, setLocation] = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    // Close the mobile drawer when the route changes
    setDrawerOpen(false);
  }, [location]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    { href: "/otps", label: "OTP", icon: KeyRound, adminOnly: false },
    { href: "/firebases", label: "Firebases", icon: Database, adminOnly: true },
    { href: "/data", label: "Data", icon: ScanLine, adminOnly: false },
    { href: "/subscriptions", label: "Users", icon: Crown, adminOnly: true },
    { href: "/telegram", label: "Telegram", icon: Send, adminOnly: false },
    { href: "/user-search", label: "Search", icon: Search, adminOnly: false },
    { href: "/profile", label: "Profile", icon: Settings, adminOnly: false },
  ];

  const visibleLinks = navLinks.filter((l) => !l.adminOnly || isAdmin);

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const ThemeButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="w-[18px] h-[18px]" />
      ) : (
        <Moon className="w-[18px] h-[18px]" />
      )}
    </button>
  );

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {visibleLinks.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`nav-chip px-3 py-2.5 ${active ? "nav-chip-active" : "nav-chip-idle hover:bg-muted"}`}
          >
            <Icon className="w-[18px] h-[18px]" />
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans md:flex">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 sticky top-0 h-dvh bg-card border-r border-card-border px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-3 mb-8 px-2">
          <span className="brand-mark w-10 h-10 rounded-xl shadow-sm shadow-primary/30">
            <Zap className="w-5 h-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display font-bold text-lg tracking-tight brand-gradient">
              HARRYAXE
            </span>
            <span className="page-eyebrow">Control Panel</span>
          </span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1">
          <NavList />
        </nav>

        <div className="mt-4 pt-4 border-t border-card-border space-y-1">
          <div className="px-3 py-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold uppercase">
              {(username || "U").slice(0, 1)}
            </span>
            <span className="truncate">
              {isAdmin ? "Admin" : username || "User"}
            </span>
            <span className="ml-auto">
              <ThemeButton />
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="nav-chip px-3 py-2.5 w-full text-left nav-chip-idle hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-30 glass-card flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="brand-mark w-8 h-8 rounded-lg shadow-sm shadow-primary/30">
            <Zap className="w-4 h-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display font-bold text-base tracking-tight brand-gradient">
              HARRYAXE
            </span>
            <span className="page-eyebrow" style={{ fontSize: 9 }}>
              Control Panel
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeButton />
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground active:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer (slide-in, accessible from the top bar) ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card border-l border-card-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-4 h-14 border-b border-card-border">
              <span className="font-display font-bold tracking-tight brand-gradient">
                HARRYAXE
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="px-3 py-4 border-t border-card-border space-y-1">
              <div className="px-3 py-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold uppercase">
                  {(username || "U").slice(0, 1)}
                </span>
                <span className="truncate">
                  {isAdmin ? "Admin" : username || "User"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="nav-chip px-3 py-2.5 w-full text-left nav-chip-idle hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 md:px-8 py-5 md:py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
