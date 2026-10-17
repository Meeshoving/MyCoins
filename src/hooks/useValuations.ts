import { useMemo } from 'react';
import type { Coin } from '../domain/types';
import { summarize, valueCoin, type CoinValuation } from '../domain/valuation';
import { usePrices } from './usePrices';
import { useSettings } from './useSettings';

export function useValuations(coins: Coin[]) {
  const { settings } = useSettings();
  const { prices, fx } = usePrices();
  return useMemo(() => {
    const byId = new Map<string, CoinValuation>();
    for (const c of coins) byId.set(c.id, valueCoin(c, prices, settings.currency, fx));
    return { byId, summary: summarize(coins, prices, settings.currency, fx) };
  }, [coins, prices, fx, settings.currency]);
}
