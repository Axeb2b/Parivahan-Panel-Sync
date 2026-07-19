import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem('cyberzone_auth') === 'true';
    setIsAuthenticated(authStatus);
  }, []);

  const login = () => {
    localStorage.setItem('cyberzone_auth', 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('cyberzone_auth');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout };
}
