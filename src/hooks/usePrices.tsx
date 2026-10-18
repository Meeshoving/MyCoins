import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FxRates, SpotPrices } from '../domain/types';
import { FALLBACK_FX } from '../domain/valuation';
import { readJson, writeJson } from '../lib/storage';
import { OFFLINE_ESTIMATE, providerById } from '../prices/providers';
import { latestHistoryPrices } from '../history/priceHistory';
import { useSettings } from './useSettings';

interface PriceCache {
  prices: SpotPrices | null;
  fx: FxRates | null;
  fxUpdatedAt: string | null;
}

const KEY = 'mycoins.prices.v1';

export interface PriceState {
  /** The prices used for all values right now. */
  prices: SpotPrices;
  fx: FxRates;
  /** True when live prices could not be refreshed and older cached ones are shown. */
  stale: boolean;
  /** True when live prices have never loaded, so the latest monthly average (or a built-in estimate) is used. */
  fallback: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const PriceContext = createContext<PriceState | null>(null);

export function PriceProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [cache, setCache] = useState<PriceCache>(() => readJson<PriceCache>(KEY, { prices: null, fx: null, fxUpdatedAt: null }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const provider = providerById(settings.priceSource);
  // Until live prices first load, use the latest monthly average from the price history.
  const [offline, setOffline] = useState<SpotPrices>(OFFLINE_ESTIMATE);
  useEffect(() => {
    if (cache.prices) return;
    let on = true;
    void latestHistoryPrices().then((p) => on && p && setOffline(p));
    return () => {
      on = false;
    };
  }, [cache.prices]);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const q = await provider.fetchQuote(ac.signal);
      const next: PriceCache = {
        prices: q.prices,
        fx: q.fx ?? cache.fx,
        fxUpdatedAt: q.fx ? q.prices.updatedAt : cache.fxUpdatedAt,
      };
      setCache(next);
      writeJson(KEY, next);
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [provider, cache.fx, cache.fxUpdatedAt]);

  // Refresh on start, when the source changes, and on a timer.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const fresh =
      cache.prices?.source === provider.label &&
      Date.now() - new Date(cache.prices.updatedAt).getTime() < settings.refreshMinutes * 60_000;
    if (!fresh) void refreshRef.current();
    const t = setInterval(() => void refreshRef.current(), Math.max(1, settings.refreshMinutes) * 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, settings.refreshMinutes]);

  const value = useMemo<PriceState>(() => {
    const fx = cache.fx ?? FALLBACK_FX;
    // The last live prices that loaded, even from another source, beat an estimate.
    const live = cache.prices?.mode === 'live' ? cache.prices : null;
    return {
      prices: live ?? offline,
      fx,
      stale: !!live && (!!error || live.source !== provider.label),
      fallback: !live,
      loading,
      error,
      refresh: () => void refresh(),
    };
  }, [cache, provider, offline, loading, error, refresh]);

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

export function usePrices(): PriceState {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error('usePrices must be used inside PriceProvider');
  return ctx;
}
