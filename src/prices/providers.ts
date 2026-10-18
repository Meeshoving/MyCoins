import type { Currency, FxRates, Metal, SpotPrices } from '../domain/types';
import { CURRENCIES } from '../domain/types';

export interface PriceQuote {
  prices: SpotPrices;
  /** Units of each currency per 1 USD, if the provider supplies them. */
  fx?: FxRates;
}

/** A source of spot prices. Add a new one by implementing this and listing it in PROVIDERS. */
export interface PriceProvider {
  id: string;
  label: string;
  description: string;
  /** Name of the .env variable holding the key, if one is needed. */
  envKey?: string;
  fetchQuote(signal?: AbortSignal): Promise<PriceQuote>;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as T;
}

/** USD-based exchange rates from the European Central Bank via frankfurter.dev (free, no key). */
export async function fetchFx(signal?: AbortSignal): Promise<FxRates> {
  const symbols = CURRENCIES.filter((c) => c !== 'USD').join(',');
  const data = await getJson<{ rates: Partial<Record<Currency, number>> }>(
    `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`,
    signal,
  );
  const fx = { USD: 1 } as FxRates;
  for (const c of CURRENCIES) {
    if (c === 'USD') continue;
    const r = data.rates[c];
    if (typeof r !== 'number' || !(r > 0)) throw new Error(`No exchange rate for ${c}`);
    fx[c] = r;
  }
  return fx;
}

const GOLD_API_SYMBOLS: Record<Metal, string> = { silver: 'XAG', gold: 'XAU', platinum: 'XPT' };

/** gold-api.com: free, no key, USD per troy ounce. */
export const goldApiProvider: PriceProvider = {
  id: 'gold-api',
  label: 'gold-api.com',
  description: 'Free, no key needed. Prices in USD, converted with ECB exchange rates.',
  async fetchQuote(signal) {
    const metals = Object.keys(GOLD_API_SYMBOLS) as Metal[];
    const [quotes, fx] = await Promise.all([
      Promise.all(
        metals.map((m) =>
          getJson<{ price: number; updatedAt?: string }>(`https://api.gold-api.com/price/${GOLD_API_SYMBOLS[m]}`, signal),
        ),
      ),
      fetchFx(signal),
    ]);
    const perOz = {} as Record<Metal, number>;
    metals.forEach((m, i) => {
      const p = quotes[i].price;
      if (typeof p !== 'number' || !(p > 0)) throw new Error(`gold-api.com returned no ${m} price`);
      perOz[m] = p;
    });
    return {
      prices: { currency: 'USD', perOz, updatedAt: new Date().toISOString(), mode: 'live', source: 'gold-api.com' },
      fx,
    };
  },
};

/** metals.dev: free tier with a key (VITE_METALS_DEV_API_KEY). */
export const metalsDevProvider: PriceProvider = {
  id: 'metals-dev',
  label: 'metals.dev',
  description: 'Free tier, needs a key in .env (VITE_METALS_DEV_API_KEY).',
  envKey: 'VITE_METALS_DEV_API_KEY',
  async fetchQuote(signal) {
    const key = import.meta.env.VITE_METALS_DEV_API_KEY as string | undefined;
    if (!key) throw new Error('Add VITE_METALS_DEV_API_KEY to .env to use metals.dev');
    const [data, fx] = await Promise.all([
      getJson<{ status: string; metals?: Partial<Record<Metal, number>>; error_message?: string }>(
        `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(key)}&currency=USD&unit=toz`,
        signal,
      ),
      fetchFx(signal),
    ]);
    if (data.status !== 'success' || !data.metals) throw new Error(data.error_message ?? 'metals.dev request failed');
    const { silver, gold, platinum } = data.metals;
    if (!silver || !gold || !platinum) throw new Error('metals.dev returned incomplete prices');
    return {
      prices: {
        currency: 'USD',
        perOz: { silver, gold, platinum },
        updatedAt: new Date().toISOString(),
        mode: 'live',
        source: 'metals.dev',
      },
      fx,
    };
  },
};

export const PROVIDERS: PriceProvider[] = [goldApiProvider, metalsDevProvider];

/** The chosen provider, or the default one when the id is unknown. */
export function providerById(id: string): PriceProvider {
  return PROVIDERS.find((p) => p.id === id) ?? goldApiProvider;
}

/** Rough prices (USD per troy ounce, Sep 2026) used only until live or historical prices load. */
export const OFFLINE_ESTIMATE: SpotPrices = {
  currency: 'USD',
  perOz: { silver: 64, gold: 4300, platinum: 1600 },
  updatedAt: '2026-09-15T00:00:00.000Z',
  mode: 'offline',
  source: 'Built-in estimate',
};
