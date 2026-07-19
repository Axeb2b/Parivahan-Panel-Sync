import React from 'react';
import { useAuth } from '@/lib/auth';
import { useLocation, Link } from 'wouter';
import { LogOut, Smartphone, Crown, User, LayoutGrid, MessageSquare, Settings } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, isAdmin, username } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Devices', icon: LayoutGrid, adminOnly: false },
    { href: '/subscriptions', label: 'Users', icon: Crown, adminOnly: true },
    { href: '/profile', label: 'Profile', icon: Settings, adminOnly: false },
  ];

  const visibleLinks = navLinks.filter(l => !l.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-b border-[#e8d8ff] px-4 lg:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-[#ecdbfd] border border-[#d8c8f0] flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-[#7c3aed]">N</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-lg text-[#2d1b4e] leading-tight">NEXUS</span>
              <span className="text-[10px] font-medium tracking-[0.25em] text-[#6b5b7d] uppercase leading-tight">Panel</span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 bg-[#f5efff] border border-[#e8d8ff] rounded-full p-1">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const active = location === href || location.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#7c3aed] text-white shadow-md shadow-purple-200'
                      : 'text-[#6b5b7d] hover:text-[#2d1b4e] hover:bg-white/60'
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
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ede4fa] border border-[#d8c8f0] text-xs font-medium text-[#4a3b5c]">
            <User className="w-3 h-3" />
            <span>{isAdmin ? 'Admin' : username || 'User'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 rounded-full text-[#6b5b7d] hover:text-[#ef4444] hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden p-4 lg:p-6 container mx-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
