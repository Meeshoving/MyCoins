import { METALS, type Currency, type Metal, type SpotPrices } from '../domain/types';

/** public/data/price-history.json, written by scripts/fetch-price-history.mjs. */
export interface PriceHistoryFile {
  generatedAt: string;
  sources: { metals: { name: string; url: string; license: string }; fx: { name: string; url: string } };
  /** First month, "YYYY-MM"; every array has one value per month from here. */
  start: string;
  months: number;
  usd: Record<Metal, (number | null)[]>;
  /** Units of each currency per US dollar. */
  perUsd: Record<Exclude<Currency, 'USD'>, (number | null)[]>;
}

export interface PricePoint {
  /** "YYYY-MM", or "now" for today's spot price. */
  month: string;
  /** Milliseconds since 1970, for the chart's time axis. */
  t: number;
  value: number;
}

let cached: Promise<PriceHistoryFile | null> | null = null;

/** Loads the history file once. Resolves to null when it hasn't been downloaded. */
export function loadPriceHistory(): Promise<PriceHistoryFile | null> {
  cached ??= fetch('./data/price-history.json')
    .then((r) => (r.ok ? (r.json() as Promise<PriceHistoryFile>) : null))
    .catch(() => null)
    .then((f) => {
      if (!f) cached = null; // try again next time
      return f;
    });
  return cached;
}

/** The newest monthly average of each metal, in USD, as offline spot prices. */
export function latestPrices(file: PriceHistoryFile): SpotPrices | null {
  const perOz = {} as Record<Metal, number>;
  let newest = -1;
  for (const m of METALS) {
    let i = file.usd[m].length - 1;
    while (i >= 0 && file.usd[m][i] == null) i--;
    if (i === -1) return null;
    perOz[m] = file.usd[m][i]!;
    newest = Math.max(newest, i);
  }
  const month = addMonths(file.start, newest);
  return {
    currency: 'USD',
    perOz,
    updatedAt: new Date(monthTime(month)).toISOString(),
    mode: 'offline',
    source: `${file.sources.metals.name}, ${monthLabel(month)} average`,
  };
}

export const latestHistoryPrices = () => loadPriceHistory().then((f) => (f ? latestPrices(f) : null));

const monthLabel = (month: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthTime(month));

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Middle of the month, so monthly averages sit in the right place on a time axis. */
export const monthTime = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return Date.UTC(y, m - 1, 15);
};

/** Monthly prices of one metal in one currency; months without a price or rate are skipped. */
export function seriesFor(file: PriceHistoryFile, metal: Metal, currency: Currency): PricePoint[] {
  const out: PricePoint[] = [];
  const usd = file.usd[metal];
  const rate = currency === 'USD' ? null : file.perUsd[currency];
  for (let i = 0; i < file.months; i++) {
    const price = usd[i];
    const r = rate ? rate[i] : 1;
    if (price == null || r == null) continue;
    const month = addMonths(file.start, i);
    out.push({ month, t: monthTime(month), value: price * r });
  }
  return out;
}

/** Index of the first point at or after `years` before the last point (0 = all). */
export function startForYears(points: PricePoint[], years: number): number {
  if (!points.length || years <= 0) return 0;
  const last = points[points.length - 1];
  const from = new Date(last.t);
  from.setUTCFullYear(from.getUTCFullYear() - years);
  // Months are placed mid-month; allow a few weeks so "30 years before 17 Oct 2026" starts at Oct 1996.
  const i = points.findIndex((p) => p.t >= from.getTime() - 28 * 86_400_000);
  return i === -1 ? 0 : i;
}

export interface RangeStats {
  first: PricePoint;
  last: PricePoint;
  change: number;
  changePct: number;
  high: PricePoint;
  low: PricePoint;
}

export function rangeStats(points: PricePoint[]): RangeStats | null {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  let high = first;
  let low = first;
  for (const p of points) {
    if (p.value > high.value) high = p;
    if (p.value < low.value) low = p;
  }
  return { first, last, change: last.value - first.value, changePct: first.value ? (last.value - first.value) / first.value : 0, high, low };
}

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/** About six evenly spaced axis labels for a run of "YYYY-MM" months. */
export function timeTicks(months: string[]): { ticks: string[]; format: (m: string) => string } {
  if (months.length > 36) {
    const years = months.length / 12;
    const step = [1, 2, 5, 10, 20].find((s) => years / s <= 7) ?? 20;
    return { ticks: months.filter((m) => m.endsWith('-01') && Number(m.slice(0, 4)) % step === 0), format: (m) => m.slice(0, 4) };
  }
  const step = [1, 2, 3, 6, 12].find((s) => months.length / s <= 6) ?? 12;
  return {
    ticks: months.filter((m) => (Number(m.slice(5)) - 1) % step === 0),
    format: (m) => `${monthName.format(monthTime(m))} '${m.slice(2, 4)}`,
  };
}

/** Round axis bounds and about `count` round-numbered ticks covering min…max. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [Math.floor(min), Math.ceil(min) + 1];
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v < max + step - 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
