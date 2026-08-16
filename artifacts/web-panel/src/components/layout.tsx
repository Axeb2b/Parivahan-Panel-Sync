import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocation, Link } from 'wouter';
import { LogOut, LayoutGrid, MessageSquare, Crown, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, isAdmin, username } = useAuth();
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Devices', icon: LayoutGrid, adminOnly: false },
    { href: '/all-sms', label: 'SMS', icon: MessageSquare, adminOnly: false },
    { href: '/subscriptions', label: 'Users', icon: Crown, adminOnly: true },
    { href: '/telegram', label: 'Telegram', icon: Send, adminOnly: false },
    { href: '/profile', label: 'Profile', icon: User, adminOnly: false },
  ];

  const visibleLinks = navLinks.filter((l) => !l.adminOnly || isAdmin);

  return (
    <div className="min-h-[100dvh] text-foreground flex flex-col font-sans pb-24 sm:pb-0 relative">
      {/* Ambient noise — fixed, never scrolls */}
      <div className="noise-overlay" aria-hidden />

      {/* ── Floating glass nav ── */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-30 px-4 lg:px-6 pt-4 transition-all duration-700 ease-spring'
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-6xl rounded-2xl flex items-center justify-between px-4 py-3 transition-all duration-700 ease-spring',
            'backdrop-blur-2xl border',
            scrolled
              ? 'bg-[#0a0a0f]/80 border-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]'
              : 'bg-[#0a0a0f]/50 border-white/[0.06]'
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#8b5cf6] flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(139,92,246,0.8)] group-hover:rotate-6 transition-transform duration-500 ease-spring">
              <span className="text-base font-bold text-white leading-none">C</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-semibold tracking-tight text-[15px] text-foreground">
                CyberCommand
              </span>
              <span className="text-[9px] font-medium tracking-[0.3em] text-muted-foreground uppercase mt-1">
                Panel
              </span>
            </div>
          </Link>

          {/* Desktop nav — floating island */}
          <nav className="hidden sm:flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.07] p-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const active = location === href || location.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-500 ease-spring',
                    active
                      ? 'bg-[#8b5cf6] text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.6} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              {isAdmin ? 'Admin' : username || 'User'}
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground border border-white/10 bg-white/[0.03] hover:text-[#f87171] hover:border-[#ef4444]/40 hover:bg-[#ef4444]/10 transition-all duration-500 ease-spring"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-x-hidden pt-28 lg:pt-32 px-4 lg:px-6 container mx-auto max-w-6xl">
        {children}
      </main>

      {/* ── Mobile bottom nav — floating glass pill ── */}
      <nav className="sm:hidden fixed bottom-4 left-4 right-4 z-30 rounded-2xl bg-[#0a0a0f]/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] flex items-stretch px-1.5 py-1.5">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[9px] font-medium rounded-xl transition-all duration-500 ease-spring',
                active ? 'text-white bg-[#8b5cf6]/25' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[9px] font-medium rounded-xl text-muted-foreground transition-all duration-500"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.6} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}
