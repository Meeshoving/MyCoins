import type { Coin, Currency, FxRates, Metal, SpotPrices } from './types';
import { METALS } from './types';

export const GRAMS_PER_TROY_OZ = 31.1034768;

/** Rough rates used only until live rates are available. */
export const FALLBACK_FX: FxRates = { USD: 1, EUR: 0.92, GBP: 0.78, CHF: 0.88 };

export function convert(amount: number, from: Currency, to: Currency, fx: FxRates): number {
  if (from === to) return amount;
  return (amount / fx[from]) * fx[to];
}

export function pureGrams(coin: Pick<Coin, 'grossWeightGrams' | 'purity'>): number {
  return coin.grossWeightGrams * coin.purity;
}

export function pureOz(coin: Pick<Coin, 'grossWeightGrams' | 'purity'>): number {
  return pureGrams(coin) / GRAMS_PER_TROY_OZ;
}

/** Spot price for one troy ounce of `metal`, in `currency`. */
export function spotIn(prices: SpotPrices, metal: Metal, currency: Currency, fx: FxRates): number {
  return convert(prices.perOz[metal], prices.currency, currency, fx);
}

export interface CoinValuation {
  pureGramsEach: number;
  pureOzEach: number;
  pureOzTotal: number;
  meltEach: number;
  meltTotal: number;
  /** Collector value if entered, otherwise melt value. */
  valueEach: number;
  valueTotal: number;
  costEach: number;
  costTotal: number;
  gain: number;
  /** Gain as a fraction of cost, or null when cost is zero. */
  gainPct: number | null;
  /** Collector value above melt, or null when no collector value is entered. */
  premiumEach: number | null;
  premiumPct: number | null;
}

export function valueCoin(coin: Coin, prices: SpotPrices, currency: Currency, fx: FxRates): CoinValuation {
  const qty = Math.max(0, coin.quantity);
  const pureGramsEach = pureGrams(coin);
  const pureOzEach = pureOz(coin);
  const meltEach = pureOzEach * spotIn(prices, coin.metal, currency, fx);
  const collectorEach =
    coin.collectorValuePerCoin != null
      ? convert(coin.collectorValuePerCoin, coin.purchaseCurrency, currency, fx)
      : null;
  const valueEach = collectorEach ?? meltEach;
  const costEach = convert(coin.purchasePricePerCoin, coin.purchaseCurrency, currency, fx);
  const valueTotal = valueEach * qty;
  const costTotal = costEach * qty;
  const gain = valueTotal - costTotal;
  return {
    pureGramsEach,
    pureOzEach,
    pureOzTotal: pureOzEach * qty,
    meltEach,
    meltTotal: meltEach * qty,
    valueEach,
    valueTotal,
    costEach,
    costTotal,
    gain,
    gainPct: costTotal > 0 ? gain / costTotal : null,
    premiumEach: collectorEach != null ? collectorEach - meltEach : null,
    premiumPct: collectorEach != null && meltEach > 0 ? collectorEach / meltEach - 1 : null,
  };
}

export interface PortfolioSummary {
  coinCount: number;
  lineCount: number;
  value: number;
  melt: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  pureOzByMetal: Record<Metal, number>;
  valueByMetal: Record<Metal, number>;
}

export function summarize(coins: Coin[], prices: SpotPrices, currency: Currency, fx: FxRates): PortfolioSummary {
  const zero = () => Object.fromEntries(METALS.map((m) => [m, 0])) as Record<Metal, number>;
  const s: PortfolioSummary = {
    coinCount: 0,
    lineCount: coins.length,
    value: 0,
    melt: 0,
    cost: 0,
    gain: 0,
    gainPct: null,
    pureOzByMetal: zero(),
    valueByMetal: zero(),
  };
  for (const coin of coins) {
    const v = valueCoin(coin, prices, currency, fx);
    s.coinCount += Math.max(0, coin.quantity);
    s.value += v.valueTotal;
    s.melt += v.meltTotal;
    s.cost += v.costTotal;
    s.pureOzByMetal[coin.metal] += v.pureOzTotal;
    s.valueByMetal[coin.metal] += v.valueTotal;
  }
  s.gain = s.value - s.cost;
  s.gainPct = s.cost > 0 ? s.gain / s.cost : null;
  return s;
}

/** Sum `valueTotal` per group key, largest first. */
export function groupValue(
  coins: Coin[],
  keyOf: (coin: Coin) => string,
  prices: SpotPrices,
  currency: Currency,
  fx: FxRates,
): { key: string; value: number }[] {
  const map = new Map<string, number>();
  for (const coin of coins) {
    const k = keyOf(coin);
    map.set(k, (map.get(k) ?? 0) + valueCoin(coin, prices, currency, fx).valueTotal);
  }
  return [...map].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}
