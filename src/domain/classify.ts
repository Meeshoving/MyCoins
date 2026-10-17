import type { Coin } from './types';

const DUTCH = new Set(['netherlands', 'nederland', 'the netherlands', 'holland']);

export function isDutch(coin: Pick<Coin, 'country'>): boolean {
  return DUTCH.has(coin.country.trim().toLowerCase());
}

const DUTCH_REIGNS: { from: number; label: string }[] = [
  { from: 2013, label: 'Willem-Alexander' },
  { from: 1980, label: 'Beatrix' },
  { from: 1948, label: 'Juliana' },
  { from: 1890, label: 'Wilhelmina' },
  { from: 1849, label: 'Willem III' },
  { from: 1840, label: 'Willem II' },
  { from: 1815, label: 'Willem I' },
];

/** Dutch coins are grouped by monarch; other coins by decade. */
export function eraOf(coin: Pick<Coin, 'country' | 'year'>): string {
  if (coin.year == null) return 'Unknown';
  if (isDutch(coin)) {
    const reign = DUTCH_REIGNS.find((r) => coin.year! >= r.from);
    return reign ? reign.label : 'Before 1815';
  }
  return `${Math.floor(coin.year / 10) * 10}s`;
}
