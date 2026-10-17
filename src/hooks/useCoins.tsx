import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Coin } from '../domain/types';
import { pickStore, type CoinStore } from '../storage/coinStore';

interface CoinsState {
  coins: Coin[];
  loading: boolean;
  error: string | null;
  storeLabel: string;
  upsert: (coin: Coin) => Promise<void>;
  remove: (id: string) => Promise<void>;
  replaceAll: (coins: Coin[]) => Promise<void>;
}

const CoinsContext = createContext<CoinsState | null>(null);

export function CoinsProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<CoinStore | null>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await pickStore();
        const loaded = await store.load();
        if (cancelled) return;
        storeRef.current = store;
        setStoreLabel(store.label);
        setCoins(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: Coin[]) => {
    const prev = coins;
    setCoins(next);
    try {
      await storeRef.current?.save(next);
      setError(null);
    } catch (err) {
      setCoins(prev);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [coins]);

  const upsert = useCallback(
    (coin: Coin) => {
      const i = coins.findIndex((c) => c.id === coin.id);
      const next = i === -1 ? [...coins, coin] : coins.map((c) => (c.id === coin.id ? coin : c));
      return persist(next);
    },
    [coins, persist],
  );

  const remove = useCallback((id: string) => persist(coins.filter((c) => c.id !== id)), [coins, persist]);

  const value = useMemo(
    () => ({ coins, loading, error, storeLabel, upsert, remove, replaceAll: persist }),
    [coins, loading, error, storeLabel, upsert, remove, persist],
  );
  return <CoinsContext.Provider value={value}>{children}</CoinsContext.Provider>;
}

export function useCoins(): CoinsState {
  const ctx = useContext(CoinsContext);
  if (!ctx) throw new Error('useCoins must be used inside CoinsProvider');
  return ctx;
}
