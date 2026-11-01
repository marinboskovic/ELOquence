'use client';
/**
 * Simple / Detailed view.
 *
 * Every screen shows its simple version by default: words instead of numbers,
 * "Rating" instead of "ELO", no bits. Flipping to Detailed reveals the full
 * statistics everywhere. Persisted per device; the toggle lives in the user
 * menu and on the screens that have a detailed layer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ViewMode = 'simple' | 'detailed';
const KEY = 'eloquence_view';

interface Ctx {
  mode: ViewMode;
  detailed: boolean;
  setMode: (m: ViewMode) => void;
  toggle: () => void;
}

const ViewModeContext = createContext<Ctx>({ mode: 'simple', detailed: false, setMode: () => {}, toggle: () => {} });

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('simple');

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'detailed' || v === 'simple') setModeState(v);
    } catch {}
  }, []);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {}
    document.documentElement.setAttribute('data-view', m);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-view', mode);
  }, [mode]);

  const value = useMemo<Ctx>(
    () => ({ mode, detailed: mode === 'detailed', setMode, toggle: () => setMode(mode === 'simple' ? 'detailed' : 'simple') }),
    [mode, setMode]
  );
  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
