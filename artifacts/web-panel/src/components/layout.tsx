import React from 'react';
import { useAuth } from '@/lib/auth';
import { useLocation, Link } from 'wouter';
import { ShieldAlert, LogOut, Terminal, Crown, Smartphone } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Devices', icon: Smartphone },
    { href: '/subscriptions', label: 'Subscriptions', icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <ShieldAlert className="w-4 h-4 text-primary" />
            </div>
            <span className="font-mono font-bold tracking-tight text-lg">CYBER<span className="text-primary">ZONE</span></span>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = location === href || location.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    active
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-xs font-mono text-muted-foreground">
            <Terminal className="w-3 h-3" />
            <span>sys.admin_active</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Terminate Session</span>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden p-4 lg:p-6 container mx-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
