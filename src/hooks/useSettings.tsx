import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount } from '../sync/account';
import type { Currency } from '../domain/types';
import { readJson, writeJson } from '../lib/storage';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  currency: Currency;
  theme: ThemeSetting;
  /** A provider id from prices/providers.ts. */
  priceSource: string;
  /** Minutes between automatic refreshes of live prices. */
  refreshMinutes: number;
  /** Personal Numista API key for the coin lookup. Kept in this browser, and in your account when signed in. */
  numistaKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  theme: 'system',
  priceSource: 'gold-api',
  refreshMinutes: 15,
  numistaKey: '',
};

const KEY = 'mycoins.settings.v1';

/** Settings that follow a signed-in person to every device. Theme stays per device. */
const SYNCED = ['currency', 'priceSource', 'refreshMinutes', 'numistaKey'] as const;
type SyncedKey = (typeof SYNCED)[number];

/** Keeps only synced keys whose value has the expected type. */
function pickSynced(source: Partial<Settings> | Record<string, unknown>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of SYNCED) {
    const v = (source as Record<string, unknown>)[k];
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[k]) out[k] = v;
  }
  // "manual" was a price source in older versions.
  if (out.priceSource === 'manual') delete out.priceSource;
  return out as Partial<Settings>;
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resolvedTheme: 'light' | 'dark';
  /** Set when settings could not be saved to the account. */
  syncError: string | null;
}

const SettingsContext = createContext<Ctx | null>(null);

function systemTheme(): 'light' | 'dark' {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = readJson<Partial<Settings>>(KEY, {});
    // "manual" was a price source in older versions.
    if (stored.priceSource === 'manual') delete stored.priceSource;
    return { ...DEFAULT_SETTINGS, ...stored };
  });
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

  const { status, user, cloud } = useAccount();
  const uid = status === 'signed-in' ? user?.uid : undefined;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncRef = useRef<{ uid: string; cloud: NonNullable<typeof cloud> } | null>(null);
  syncRef.current = uid && cloud ? { uid, cloud } : null;
  const [syncError, setSyncError] = useState<string | null>(null);

  const apply = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJson(KEY, next);
      return next;
    });
  }, []);

  // Signed in: take the account's settings, and fill in any it doesn't have yet from this device.
  useEffect(() => {
    if (!uid || !cloud) return;
    let first = true;
    return cloud.watchSyncedSettings(
      uid,
      (remote) => {
        const fromAccount = pickSynced(remote ?? {});
        if (first) {
          first = false;
          const missing = Object.fromEntries(
            SYNCED.filter((k) => !(k in fromAccount)).map((k) => [k, settingsRef.current[k]]),
          ) as Partial<Record<SyncedKey, unknown>>;
          if (Object.keys(missing).length) cloud.saveSyncedSettings(uid, missing, setSyncError);
        }
        apply(fromAccount);
      },
      setSyncError,
    );
  }, [uid, cloud, apply]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      apply(patch);
      const sync = syncRef.current;
      const synced = pickSynced(patch);
      if (sync && Object.keys(synced).length) sync.cloud.saveSyncedSettings(sync.uid, synced, setSyncError);
    },
    [apply],
  );

  const value = useMemo(() => ({ settings, update, resolvedTheme, syncError }), [settings, update, resolvedTheme, syncError]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
