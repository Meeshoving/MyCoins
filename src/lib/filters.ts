import type { Coin, Metal } from '../domain/types';
import { isDutch } from '../domain/classify';

export type Origin = 'all' | 'dutch' | 'international';

export function byOrigin(origin: Origin) {
  return (c: Coin) => origin === 'all' || (origin === 'dutch') === isDutch(c);
}

export function byMetal(metal: Metal | 'all') {
  return (c: Coin) => metal === 'all' || c.metal === metal;
}

export function bySearch(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return () => true;
  return (c: Coin) =>
    [c.name, c.country, c.mint, c.denomination, c.year, c.grade, c.notes].some((f) => f != null && String(f).toLowerCase().includes(s));
}

export const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'international', label: 'International' },
];
