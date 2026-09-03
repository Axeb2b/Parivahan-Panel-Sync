import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthState {
  isAuthenticated: boolean | null;
  userId: string | null;
  isAdmin: boolean;
  username: string;
  sessionId: string | null;
  firebaseToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (data: {
    telegramId: string;
    isAdmin: boolean;
    username: string;
    sessionId?: string;
    firebaseToken?: string | null;
  }) => void;
  logout: () => void;
}

const AUTH_KEY = "cyberzone_auth";
const AuthContext = createContext<AuthContextValue | null>(null);

async function revalidateSession(): Promise<AuthState | null> {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!parsed.telegramId || !parsed.sessionId) return null;
  try {
    const r = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${parsed.telegramId}:${parsed.sessionId}`,
      },
    });
    // Only 401 means "session is dead" — anything else (503 store blip,
    // 429, 5xx, or network failure below) keeps the stored session so a
    // refresh during a backend hiccup never logs the user out.
    if (r.status === 401) return null;
    if (!r.ok) {
      return {
        isAuthenticated: true,
        userId: parsed.telegramId,
        isAdmin: !!parsed.isAdmin,
        username: parsed.username || "",
        sessionId: parsed.sessionId,
        firebaseToken: parsed.firebaseToken || null,
      };
    }
    const me = await r.json();
    return {
      isAuthenticated: true,
      userId: me.telegramId || parsed.telegramId,
      isAdmin: !!me.isAdmin,
      sessionId: me.sessionId || parsed.sessionId,
      firebaseToken: parsed.firebaseToken || null,
      username: me.username || parsed.username || "",
    };
  } catch {
    // Network blip — keep the stored session rather than force-logging out.
    return {
      isAuthenticated: true,
      userId: parsed.telegramId,
      isAdmin: !!parsed.isAdmin,
      sessionId: parsed.sessionId,
      firebaseToken: parsed.firebaseToken || null,
      username: parsed.username || "",
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: null,
    userId: null,
    isAdmin: false,
    username: "",
    sessionId: null,
    firebaseToken: null,
  });

  useEffect(() => {
    let alive = true;
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) {
      setState((s) => ({ ...s, isAuthenticated: false }));
      return;
    }
    // Validate the session server-side on load so a refresh doesn't show a
    // stale/revoked login.
    revalidateSession().then((res) => {
      if (!alive) return;
      if (res) {
        setState(res);
      } else {
        localStorage.removeItem(AUTH_KEY);
        setState((s) => ({ ...s, isAuthenticated: false }));
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const login = (data: {
    telegramId: string;
    isAdmin: boolean;
    username: string;
    sessionId?: string;
    firebaseToken?: string | null;
  }) => {
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
    setState({
      isAuthenticated: false,
      userId: null,
      isAdmin: false,
      username: "",
      sessionId: null,
      firebaseToken: null,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
