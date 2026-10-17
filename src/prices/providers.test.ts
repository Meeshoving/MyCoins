import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFx, goldApiProvider } from './providers';

function mockFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  });
}

afterEach(() => vi.unstubAllGlobals());

const fxBody = { base: 'USD', rates: { EUR: 0.9, GBP: 0.8, CHF: 0.85 } };

describe('price providers', () => {
  it('reads frankfurter exchange rates', async () => {
    vi.stubGlobal('fetch', mockFetch({ frankfurter: fxBody }));
    expect(await fetchFx()).toEqual({ USD: 1, EUR: 0.9, GBP: 0.8, CHF: 0.85 });
  });

  it('builds a live quote from gold-api.com', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/price/XAG': { price: 31.5 },
        '/price/XAU': { price: 2600 },
        '/price/XPT': { price: 990 },
        frankfurter: fxBody,
      }),
    );
    const q = await goldApiProvider.fetchQuote();
    expect(q.prices.perOz).toEqual({ silver: 31.5, gold: 2600, platinum: 990 });
    expect(q.prices.mode).toBe('live');
    expect(q.prices.currency).toBe('USD');
    expect(q.fx?.EUR).toBe(0.9);
  });

  it('fails clearly when the service is down', async () => {
    vi.stubGlobal('fetch', mockFetch({ frankfurter: fxBody }));
    await expect(goldApiProvider.fetchQuote()).rejects.toThrow(/404/);
  });
});
