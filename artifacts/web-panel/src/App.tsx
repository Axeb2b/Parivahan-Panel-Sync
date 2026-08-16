import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Component, useEffect, type ReactNode } from 'react';

// Pages
import { Login } from '@/pages/login';
import { Dashboard } from '@/pages/dashboard';
import { DeviceDetail } from '@/pages/device-detail';
import { Subscriptions } from '@/pages/subscriptions';
import { Profile } from '@/pages/profile';
import { AllSms } from '@/pages/all-sms';
import { TelegramSettings } from '@/pages/telegram-settings';
import NotFound from '@/pages/not-found';

// Providers
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';

const queryClient = new QueryClient();

// Error Boundary — shows the actual error instead of a white screen
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>⚠️ Something went wrong</h2>
          <p><strong>Error name:</strong> {e.name || 'unknown'}</p>
          <p><strong>Error message:</strong> <span style={{ color: 'red' }}>{e.message || '(empty message)'}</span></p>
          <hr />
          <p style={{ fontSize: 12 }}><strong>Stack trace:</strong></p>
          <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8, overflow: 'auto' }}>
            {e.stack || String(e)}
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
    if (isAuthenticated === false) setLocation('/');
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground">Loading...</div>;
  }

  return isAuthenticated ? <Component {...rest} /> : null;
}

// Admin Guard — only admin
function AdminRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated === false) setLocation('/');
    else if (isAuthenticated === true && !isAdmin) setLocation('/dashboard');
  }, [isAuthenticated, isAdmin, setLocation]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground">Loading...</div>;
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
      <Route path="/telegram">
        {() => <ProtectedRoute component={TelegramSettings} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base="">

              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
