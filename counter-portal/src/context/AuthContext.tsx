import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/client';
import type { CounterUser, LoginResponse } from '../api/types';

type AuthContextValue = {
  token: string | null;
  user: CounterUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'counter-portal:token';
const USER_KEY = 'counter-portal:user';

function readStoredUser(): CounterUser | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as CounterUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Counter Portal is a long-lived operator app: the token is persisted to
  // localStorage so a page refresh does NOT force a re-login. This is the
  // deliberate opposite of guest-kiosk's stateless in-memory token.
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<CounterUser | null>(() => readStoredUser());

  const login = async (username: string, password: string) => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, login, logout }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
