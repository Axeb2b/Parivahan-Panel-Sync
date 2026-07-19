import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { ShieldAlert, Lock, ArrowRight, Loader2 } from 'lucide-react';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const pwdRef = ref(db, 'config/password');
      const snapshot = await get(pwdRef);
      const storedPassword = snapshot.val();

      if (!storedPassword) {
        // First run mode: accept any password and store it
        await set(pwdRef, password);
        login();
        setLocation('/dashboard');
      } else if (storedPassword === password) {
        login();
        setLocation('/dashboard');
      } else {
        setError('ACCESS DENIED: Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setError('SYSTEM ERROR: Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-card border border-border shadow-lg mb-6 shadow-primary/5">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">CYBER<span className="text-primary">ZONE</span></h1>
          <p className="text-muted-foreground font-mono text-sm tracking-wider uppercase">Command & Control Center</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card border border-border p-6 rounded-lg shadow-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">Operator Passkey</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  placeholder="Enter passcode..."
                  autoFocus
                />
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>AUTHENTICATE</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-[10px] font-mono text-muted-foreground/50">
              UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
