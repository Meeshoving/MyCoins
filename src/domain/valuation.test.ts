import { describe, expect, it } from 'vitest';
import type { Coin, FxRates, SpotPrices } from './types';
import { GRAMS_PER_TROY_OZ, convert, groupValue, pureGrams, pureOz, summarize, valueCoin } from './valuation';
import { eraOf, isDutch } from './classify';
import { validateCoin } from './validate';

const fx: FxRates = { USD: 1, EUR: 0.9, GBP: 0.8, CHF: 0.85 };
const prices: SpotPrices = {
  currency: 'USD',
  perOz: { silver: 30, gold: 2500, platinum: 1000 },
  updatedAt: '2026-01-01T00:00:00Z',
  mode: 'live',
  source: 'test',
};

const eagle: Coin = {
  id: 'eagle',
  name: 'American Silver Eagle',
  country: 'United States',
  year: 2021,
  denomination: '1 dollar',
  metal: 'silver',
  purity: 0.999,
  grossWeightGrams: 31.103,
  quantity: 10,
  purchasePricePerCoin: 30,
  purchaseCurrency: 'EUR',
};

const rijksdaalder: Coin = {
  id: 'rd',
  name: 'Rijksdaalder',
  country: 'Netherlands',
  year: 1938,
  denomination: '2½ gulden',
  metal: 'silver',
  purity: 0.72,
  grossWeightGrams: 25,
  quantity: 2,
  purchasePricePerCoin: 20,
  purchaseCurrency: 'EUR',
  collectorValuePerCoin: 25,
};

describe('metal content', () => {
  it('computes pure grams and troy ounces from weight and fineness', () => {
    expect(pureGrams(rijksdaalder)).toBeCloseTo(18, 10);
    expect(pureOz(rijksdaalder)).toBeCloseTo(18 / GRAMS_PER_TROY_OZ, 10);
    expect(pureOz({ grossWeightGrams: GRAMS_PER_TROY_OZ, purity: 1 })).toBe(1);
  });
});

describe('convert', () => {
  it('goes through USD', () => {
    expect(convert(90, 'EUR', 'USD', fx)).toBeCloseTo(100);
    expect(convert(100, 'USD', 'GBP', fx)).toBeCloseTo(80);
    expect(convert(90, 'EUR', 'GBP', fx)).toBeCloseTo(80);
    expect(convert(5, 'CHF', 'CHF', fx)).toBe(5);
  });
});

describe('valueCoin', () => {
  it('uses melt value when no collector value is set', () => {
    const v = valueCoin(eagle, prices, 'EUR', fx);
    const oz = (31.103 * 0.999) / GRAMS_PER_TROY_OZ;
    expect(v.meltEach).toBeCloseTo(oz * 27, 6); // 30 USD = 27 EUR
    expect(v.valueTotal).toBeCloseTo(oz * 27 * 10, 6);
    expect(v.costTotal).toBe(300);
    expect(v.gain).toBeCloseTo(v.valueTotal - 300, 6);
    expect(v.gainPct).toBeCloseTo(v.gain / 300, 6);
    expect(v.premiumEach).toBeNull();
    expect(v.premiumPct).toBeNull();
  });

  it('uses collector value and reports the premium over melt', () => {
    const v = valueCoin(rijksdaalder, prices, 'EUR', fx);
    const melt = (18 / GRAMS_PER_TROY_OZ) * 27;
    expect(v.meltEach).toBeCloseTo(melt, 6);
    expect(v.valueEach).toBe(25);
    expect(v.premiumEach).toBeCloseTo(25 - melt, 6);
    expect(v.premiumPct).toBeCloseTo(25 / melt - 1, 6);
    expect(v.gain).toBeCloseTo(10, 6);
  });

  it('returns null gain percent for free coins', () => {
    const v = valueCoin({ ...eagle, purchasePricePerCoin: 0 }, prices, 'EUR', fx);
    expect(v.gainPct).toBeNull();
  });
});

describe('summarize', () => {
  it('adds up value, cost and metal content', () => {
    const gold: Coin = { ...eagle, id: 'g', metal: 'gold', purity: 0.9999, quantity: 1, purchasePricePerCoin: 2000 };
    const s = summarize([eagle, rijksdaalder, gold], prices, 'EUR', fx);
    expect(s.coinCount).toBe(13);
    expect(s.lineCount).toBe(3);
    expect(s.cost).toBe(300 + 40 + 2000);
    expect(s.pureOzByMetal.silver).toBeCloseTo(pureOz(eagle) * 10 + pureOz(rijksdaalder) * 2, 8);
    expect(s.pureOzByMetal.gold).toBeCloseTo(pureOz(gold), 8);
    expect(s.value).toBeCloseTo(s.valueByMetal.silver + s.valueByMetal.gold, 6);
    expect(s.gainPct).toBeCloseTo((s.value - s.cost) / s.cost, 8);
  });

  it('handles an empty collection', () => {
    const s = summarize([], prices, 'EUR', fx);
    expect(s.value).toBe(0);
    expect(s.gainPct).toBeNull();
  });
});

describe('groupValue', () => {
  it('groups and sorts largest first', () => {
    const g = groupValue([eagle, rijksdaalder], (c) => c.country, prices, 'EUR', fx);
    expect(g.map((x) => x.key)).toEqual(['United States', 'Netherlands']);
  });
});

describe('classify', () => {
  it('detects Dutch coins and reign eras', () => {
    expect(isDutch({ country: ' Netherlands ' })).toBe(true);
    expect(isDutch({ country: 'Canada' })).toBe(false);
    expect(eraOf({ country: 'Netherlands', year: 1938 })).toBe('Wilhelmina');
    expect(eraOf({ country: 'Netherlands', year: 1948 })).toBe('Juliana');
    expect(eraOf({ country: 'Netherlands', year: 1890 })).toBe('Wilhelmina');
    expect(eraOf({ country: 'Netherlands', year: 2024 })).toBe('Willem-Alexander');
    expect(eraOf({ country: 'Canada', year: 2017 })).toBe('2010s');
    expect(eraOf({ country: 'Canada', year: null })).toBe('Unknown');
  });
});

describe('validateCoin', () => {
  it('accepts a good coin and rejects bad fields', () => {
    expect(validateCoin(eagle)).toEqual([]);
    expect(validateCoin({ ...eagle, purity: 999 })).toContain('Purity must be between 0 and 1, e.g. 0.999');
    expect(validateCoin({ ...eagle, quantity: 0 }).length).toBe(1);
    expect(validateCoin({ ...eagle, name: ' ' })).toContain('Name is required');
  });
});
