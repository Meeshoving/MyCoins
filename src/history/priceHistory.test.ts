import { describe, expect, it } from 'vitest';
import { addMonths, latestPrices, niceTicks, rangeStats, seriesFor, startForYears, timeTicks, type PriceHistoryFile } from './priceHistory';

const file: PriceHistoryFile = {
  generatedAt: '',
  sources: { metals: { name: '', url: '', license: '' }, fx: { name: '', url: '' } },
  start: '1998-11',
  months: 4,
  usd: { silver: [5, 5.5, null, 6], gold: [290, 291, 288, 287], platinum: [null, null, null, null] },
  perUsd: { EUR: [0.85, 0.86, 0.87, 0.9], GBP: [0.6, null, 0.6, 0.6], CHF: [1.4, 1.4, 1.4, 1.4] },
};

describe('price history', () => {
  it('builds a series in the chosen currency and skips gaps', () => {
    expect(seriesFor(file, 'silver', 'USD').map((p) => [p.month, p.value])).toEqual([
      ['1998-11', 5],
      ['1998-12', 5.5],
      ['1999-02', 6],
    ]);
    expect(seriesFor(file, 'gold', 'GBP').map((p) => p.month)).toEqual(['1998-11', '1999-01', '1999-02']);
    expect(seriesFor(file, 'silver', 'EUR')[2].value).toBeCloseTo(5.4);
    expect(addMonths('1998-11', 14)).toBe('2000-01');
  });

  it('uses the newest monthly averages as offline prices', () => {
    expect(latestPrices(file)).toBeNull(); // no platinum at all
    const p = latestPrices({ ...file, usd: { ...file.usd, platinum: [900, 910, null, null] } })!;
    expect(p.perOz).toEqual({ silver: 6, gold: 287, platinum: 910 });
    expect(p.mode).toBe('offline');
    expect(p.updatedAt.slice(0, 7)).toBe('1999-02');
  });

  it('picks the start of a range and its stats', () => {
    const pts = Array.from({ length: 61 }, (_, i) => ({ month: addMonths('2020-01', i), t: Date.UTC(2020, i, 15), value: 10 + i }));
    expect(pts[startForYears(pts, 1)].month).toBe('2024-01');
    expect(startForYears(pts, 0)).toBe(0);
    expect(startForYears(pts, 30)).toBe(0);
    const s = rangeStats(pts.slice(48))!;
    expect(s.change).toBe(12);
    expect(s.high.month).toBe('2025-01');
    expect(s.low.month).toBe('2024-01');
  });

  it('spaces axis labels out', () => {
    const months = (from: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(from, i));
    expect(timeTicks(months('1996-10', 361)).ticks).toEqual(['2000-01', '2005-01', '2010-01', '2015-01', '2020-01', '2025-01']);
    expect(timeTicks(months('2021-11', 60)).ticks).toEqual(['2022-01', '2023-01', '2024-01', '2025-01', '2026-01']);
    const year = timeTicks(months('2025-09', 12));
    expect(year.ticks).toEqual(['2025-09', '2025-11', '2026-01', '2026-03', '2026-05', '2026-07']);
    expect(year.format('2026-01')).toBe("Jan '26");
  });

  it('rounds the price axis', () => {
    expect(niceTicks(3515, 3901)).toEqual([3500, 3600, 3700, 3800, 3900, 4000]);
    expect(niceTicks(3.6, 60.5)).toEqual([0, 20, 40, 60, 80]);
    expect(niceTicks(0.9, 1.4)).toEqual([0.8, 1, 1.2, 1.4]);
  });
});
