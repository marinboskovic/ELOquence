'use client';
import { useState, useEffect, useCallback } from 'react';

export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEME_OPTIONS)[number];

export interface Settings {
  hardMode: boolean;
  highContrast: boolean;
  keyboardOnly: boolean;
  /** 'system' follows `prefers-color-scheme`; stored as `eloquence_theme`. */
  theme: Theme;
  reducedMotion: boolean;
}

const STORAGE_KEYS: Record<keyof Settings, string> = {
  hardMode: 'eloquence_hard_mode',
  highContrast: 'eloquence_colorblind',
  keyboardOnly: 'eloquence_keyboard_only',
  theme: 'eloquence_theme',
  reducedMotion: 'eloquence_reduced_motion',
};

const DEFAULTS: Settings = {
  hardMode: false,
  highContrast: false,
  keyboardOnly: false,
  theme: 'system',
  reducedMotion: false,
};

const DARK_MQ = '(prefers-color-scheme: dark)';

function parseTheme(raw: string | null): Theme {
  return raw === 'dark' || raw === 'light' ? raw : 'system';
}

function readFromStorage(): Settings {
  if (typeof window === 'undefined') return DEFAULTS;
  return {
    hardMode: localStorage.getItem(STORAGE_KEYS.hardMode) === 'true',
    highContrast: localStorage.getItem(STORAGE_KEYS.highContrast) === 'true',
    keyboardOnly: localStorage.getItem(STORAGE_KEYS.keyboardOnly) === 'true',
    theme: parseTheme(localStorage.getItem(STORAGE_KEYS.theme)),
    reducedMotion: localStorage.getItem(STORAGE_KEYS.reducedMotion) === 'true',
  };
}

/** Resolve a theme preference to the concrete scheme to render. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia(DARK_MQ).matches ? 'dark' : 'light';
  }
  return theme;
}

function setDomTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.dataset.theme = 'dark';
  } else {
    delete root.dataset.theme;
  }
  // The <meta theme-color> tags from layout.tsx only follow the OS; a theme forced
  // in Settings must recolour the browser chrome too, or a light bar sits on a dark page.
  const colour = resolved === 'dark' ? '#121211' : '#f3f3f1';
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', colour));
}

// Module-level listener so that only one `change` handler is attached no
// matter how many components mount `useSettings`. Active only in system mode.
let systemThemeCleanup: (() => void) | null = null;

function watchSystemTheme(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }
  if (!enabled) return;
  const mq = window.matchMedia(DARK_MQ);
  const handler = (e: MediaQueryListEvent) => setDomTheme(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', handler);
  systemThemeCleanup = () => mq.removeEventListener('change', handler);
}

function applyDomSideEffects(key: keyof Settings, value: boolean | string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  switch (key) {
    case 'theme': {
      const theme = parseTheme(typeof value === 'string' ? value : null);
      setDomTheme(resolveTheme(theme));
      watchSystemTheme(theme === 'system');
      break;
    }
    case 'highContrast':
      root.classList.toggle('colorblind', value === true);
      if (value === true) {
        root.dataset.highContrast = 'true';
      } else {
        delete root.dataset.highContrast;
      }
      break;
    case 'reducedMotion':
      root.classList.toggle('reduce-motion', value === true);
      break;
    case 'keyboardOnly':
      if (value === true) {
        root.dataset.keyboardOnly = 'true';
      } else {
        delete root.dataset.keyboardOnly;
      }
      break;
  }
}

export function useSettings(): [Settings, <K extends keyof Settings>(key: K, value: Settings[K]) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // Read from localStorage on mount (client-only). The inline bootstrap
  // script in app/layout.tsx has already applied the DOM attributes, but we
  // (re)attach the system-theme listener here so OS changes propagate.
  useEffect(() => {
    const stored = readFromStorage();
    setSettings(stored);
    applyDomSideEffects('theme', stored.theme);
  }, []);

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      const entry = Object.entries(STORAGE_KEYS).find(([, storageKey]) => storageKey === e.key);
      if (!entry) return;
      const [settingKey] = entry as [keyof Settings, string];
      const newSettings = readFromStorage();
      setSettings(newSettings);
      applyDomSideEffects(settingKey, newSettings[settingKey]);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const storageKey = STORAGE_KEYS[key];

    if (typeof value === 'boolean') {
      localStorage.setItem(storageKey, String(value));
    } else {
      localStorage.setItem(storageKey, value as string);
    }

    applyDomSideEffects(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return [settings, setSetting];
}
