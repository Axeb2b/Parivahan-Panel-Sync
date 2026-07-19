import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

// Pages
import { Login } from '@/pages/login';
import { Dashboard } from '@/pages/dashboard';
import { DeviceDetail } from '@/pages/device-detail';
import { Subscriptions } from '@/pages/subscriptions';
import NotFound from '@/pages/not-found';

// Providers
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

// Auth Guard
function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated === false) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <Component {...rest} /> : null;
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
