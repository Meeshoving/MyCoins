import { describe, expect, it } from 'vitest';
import type { Coin } from '../domain/types';
import { coinsToOffer, diffCoins, stableJson } from './diff';

const coin = (id: string, extra: Partial<Coin> = {}): Coin => ({
  id, name: id, country: 'Netherlands', year: 1960, denomination: '1 gulden', metal: 'silver', purity: 0.72,
  grossWeightGrams: 6.5, quantity: 1, purchasePricePerCoin: 5, purchaseCurrency: 'EUR', ...extra,
});

describe('sync diff', () => {
  it('ignores key order', () => {
    expect(stableJson({ b: 1, a: { d: 2, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('writes only new or changed coins and deletes removed ones', () => {
    const a = coin('a');
    const b = coin('b');
    const known = new Map([
      ['a', stableJson(a)],
      ['b', stableJson(b)],
      ['gone', stableJson(coin('gone'))],
    ]);
    const changed = { ...b, quantity: 3 };
    const fresh = coin('c');
    expect(diffCoins(known, [a, changed, fresh])).toEqual({ put: [changed, fresh], remove: ['gone'] });
  });

  it('offers only browser coins the account lacks and that were not offered before', () => {
    const local = [coin('a'), coin('b'), coin('c')];
    expect(coinsToOffer(local, [coin('a')], ['c']).map((c) => c.id)).toEqual(['b']);
  });
});
