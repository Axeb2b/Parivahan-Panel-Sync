import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { signInWithFirebaseToken } from '@/lib/firebase';

interface AuthState {
  isAuthenticated: boolean | null;
  userId: string | null;
  isAdmin: boolean;
  username: string;
  sessionId: string | null;
  firebaseToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (data: { telegramId: string; isAdmin: boolean; username: string; sessionId?: string; firebaseToken?: string | null }) => void;
  logout: () => void;
}

const AUTH_KEY = 'cyberzone_auth';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: null,
    userId: null,
    isAdmin: false,
    username: '',
    sessionId: null,
    firebaseToken: null,
  });

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState({
          isAuthenticated: true,
          userId: parsed.telegramId || null,
          isAdmin: parsed.isAdmin || false,
          sessionId: parsed.sessionId || null,
          firebaseToken: parsed.firebaseToken || null,
          username: parsed.username || '',
        });
        if (parsed.firebaseToken) {
          void signInWithFirebaseToken(parsed.firebaseToken);
        } else {
          // No stored token (older session) — mint one from the server and sign in.
          void (async () => {
            try {
              const r = await fetch("/api/auth/firebase-token?telegramId=" + encodeURIComponent(parsed.telegramId || ""), { headers: authHeaders() });
              const d = await r.json();
              if (d.firebaseToken) {
                localStorage.setItem(AUTH_KEY, JSON.stringify({ ...parsed, firebaseToken: d.firebaseToken }));
                await signInWithFirebaseToken(d.firebaseToken);
              }
            } catch { /* ignore */ }
          })();
        }
      } catch {
        setState(s => ({ ...s, isAuthenticated: false }));
      }
    } else {
      setState(s => ({ ...s, isAuthenticated: false }));
    }
  }, []);

  const login = (data: { telegramId: string; isAdmin: boolean; username: string; sessionId?: string; firebaseToken?: string | null }) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    setState({
      isAuthenticated: true,
      userId: data.telegramId,
      isAdmin: data.isAdmin,
      username: data.username,
      sessionId: data.sessionId || null,
      firebaseToken: data.firebaseToken || null,
    });
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setState({ isAuthenticated: false, userId: null, isAdmin: false, username: '', sessionId: null, firebaseToken: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
