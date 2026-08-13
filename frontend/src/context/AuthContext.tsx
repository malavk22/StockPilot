// client/src/context/AuthContext.tsx

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "stockpilot.auth";

// sessionStorage (not localStorage): the token survives a page refresh
// mid-demo, but is gone the moment the tab/browser closes — a deliberate
// middle ground between "logged out on every refresh" (safest, but annoying
// to demo) and "token persists indefinitely" (localStorage, more exposure
// if the app is ever compromised by XSS).
function readStored(): { user: User; token: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [token, setToken] = useState<string | null>(stored?.token ?? null);

  const login = useCallback((newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user: newUser, token: newToken }));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
