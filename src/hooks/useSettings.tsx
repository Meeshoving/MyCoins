import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Currency, Metal } from '../domain/types';
import { readJson, writeJson } from '../lib/storage';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  currency: Currency;
  theme: ThemeSetting;
  /** A provider id from prices/providers.ts, or "manual". */
  priceSource: string;
  /** Prices typed in by hand, per troy ounce, in `manualCurrency`. */
  manualPerOz: Record<Metal, number>;
  manualCurrency: Currency;
  manualUpdatedAt: string;
  /** Minutes between automatic refreshes of live prices. */
  refreshMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  theme: 'system',
  priceSource: 'gold-api',
  manualPerOz: { silver: 30, gold: 2400, platinum: 900 },
  manualCurrency: 'EUR',
  manualUpdatedAt: '2026-10-17T00:00:00.000Z',
  refreshMinutes: 15,
};

const KEY = 'mycoins.settings.v1';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resolvedTheme: 'light' | 'dark';
}

const SettingsContext = createContext<Ctx | null>(null);

function systemTheme(): 'light' | 'dark' {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJson(KEY, {}) }));
  const [sys, setSys] = useState(systemTheme);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const on = () => setSys(systemTheme());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolvedTheme = settings.theme === 'system' ? sys : settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#0d0f12' : '#f6f4ef');
  }, [resolvedTheme]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJson(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, resolvedTheme }), [settings, update, resolvedTheme]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
