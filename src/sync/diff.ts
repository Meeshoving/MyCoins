import type { Coin } from '../domain/types';

/** JSON with sorted keys, so the same coin always gives the same text. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

export interface CoinChanges {
  put: Coin[];
  remove: string[];
}

/** What to write so the saved collection (`known`, by id) matches `next`. */
export function diffCoins(known: Map<string, string>, next: Coin[]): CoinChanges {
  const put = next.filter((c) => known.get(c.id) !== stableJson(c));
  const ids = new Set(next.map((c) => c.id));
  const remove = [...known.keys()].filter((id) => !ids.has(id));
  return { put, remove };
}

/** Coins in `local` that the account doesn't have yet and weren't offered before. */
export function coinsToOffer(local: Coin[], account: Coin[], handled: string[]): Coin[] {
  const have = new Set(account.map((c) => c.id));
  const done = new Set(handled);
  return local.filter((c) => !have.has(c.id) && !done.has(c.id));
}
