'use client';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { authApi } from '../api';
import {
  clearLearnProgress,
  clearPerAccountCaches,
  clearTokens,
  getRefreshToken,
  hasSession,
  onSessionChange,
  setTokens,
  TokenPair,
} from '../session';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, username: string, password: string) => Promise<User>;
  /** Store a token pair obtained elsewhere (Google callback, password reset). */
  adoptTokens: (pair: TokenPair) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  /** Patch the cached user without a round-trip (e.g. after PATCH /users/me). */
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

let cachedUser: User | null = null;
let fetchPromise: Promise<User | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  const fetchUser = useCallback(async () => {
    if (!hasSession()) {
      cachedUser = null;
      setUserState(null);
      setLoading(false);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = authApi
        .me()
        .then((res) => {
          cachedUser = res.data;
          return res.data as User;
        })
        .catch(() => {
          // api.ts already tried a silent refresh; if we land here the
          // session is dead.
          if (!hasSession()) cachedUser = null;
          return cachedUser;
        })
        .finally(() => {
          fetchPromise = null;
        });
    }
    const result = await fetchPromise;
    setUserState(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Keep tabs in sync: a logout in one tab logs out the others.
  useEffect(() => {
    const unsub = onSessionChange(() => {
      if (!hasSession() && cachedUser) {
        cachedUser = null;
        setUserState(null);
      }
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('eloquence_') && e.key.endsWith('_token')) {
        if (!hasSession()) {
          cachedUser = null;
          setUserState(null);
        } else if (!cachedUser) {
          fetchUser();
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
    };
  }, [fetchUser]);

  const adoptTokens = useCallback(async (pair: TokenPair): Promise<User | null> => {
    clearPerAccountCaches();
    setTokens(pair);
    const meRes = await authApi.me();
    cachedUser = meRes.data;
    setUserState(meRes.data);
    setLoading(false);
    return meRes.data;
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authApi.login({ email, password });
    return (await adoptTokens(res.data)) as User;
  };

  const register = async (email: string, username: string, password: string): Promise<User> => {
    const res = await authApi.register({ email, username, password });
    return (await adoptTokens(res.data)) as User;
  };

  const logout = async () => {
    const refresh = getRefreshToken();
    // Revoke server-side first (best effort), then forget locally.
    try {
      await authApi.logout(refresh);
    } catch {
      /* offline or already revoked — local logout still proceeds */
    }
    clearTokens();
    clearPerAccountCaches();
    clearLearnProgress();
    cachedUser = null;
    setUserState(null);
  };

  const refreshUser = async (): Promise<User | null> => {
    cachedUser = null;
    fetchPromise = null;
    await fetchUser();
    return cachedUser;
  };

  const setUser = (u: User | null) => {
    cachedUser = u;
    setUserState(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, adoptTokens, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
