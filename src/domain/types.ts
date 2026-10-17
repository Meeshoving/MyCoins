export const METALS = ['silver', 'gold', 'platinum'] as const;
export type Metal = (typeof METALS)[number];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** One line in the collection. A line can hold several identical coins (quantity). */
export interface Coin {
  id: string;
  name: string;
  country: string;
  year: number | null;
  mint?: string;
  /** Face value as written on the coin, e.g. "2½ gulden" or "1 dollar". */
  denomination: string;
  metal: Metal;
  /** Fineness as a fraction, e.g. 0.720 or 0.999. */
  purity: number;
  /** Gross weight of one coin in grams. */
  grossWeightGrams: number;
  quantity: number;
  /** Price paid for one coin, in `purchaseCurrency`. */
  purchasePricePerCoin: number;
  purchaseCurrency: Currency;
  /** ISO date, e.g. "2024-05-01". */
  purchaseDate?: string;
  /** Optional collector (numismatic) value for one coin, in `purchaseCurrency`. Overrides melt value. */
  collectorValuePerCoin?: number;
  notes?: string;
  obverseImage?: string;
  reverseImage?: string;
  diameterMm?: number;
  thicknessMm?: number;
  mintage?: number;
  grade?: string;
}

/** Spot prices per troy ounce, quoted in `currency`. */
export interface SpotPrices {
  currency: Currency;
  perOz: Record<Metal, number>;
  /** ISO timestamp of when the prices were fetched or entered. */
  updatedAt: string;
  /** "live" = fetched from a provider, "manual" = typed in Settings. */
  mode: 'live' | 'manual';
  source: string;
}

/** Exchange rates: units of each currency per 1 USD. */
export type FxRates = Record<Currency, number>;
