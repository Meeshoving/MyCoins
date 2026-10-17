import type { Coin } from './types';
import { CURRENCIES, METALS } from './types';

/** Returns a list of problems; empty means the coin is valid. */
export function validateCoin(c: Partial<Coin>): string[] {
  const errors: string[] = [];
  if (!c.id) errors.push('id is missing');
  if (!c.name?.trim()) errors.push('Name is required');
  if (!c.country?.trim()) errors.push('Country is required');
  if (!c.metal || !METALS.includes(c.metal)) errors.push('Metal must be silver, gold or platinum');
  if (c.purity == null || !(c.purity > 0 && c.purity <= 1)) errors.push('Purity must be between 0 and 1, e.g. 0.999');
  if (c.grossWeightGrams == null || !(c.grossWeightGrams > 0)) errors.push('Weight must be more than 0 g');
  if (c.quantity == null || !Number.isInteger(c.quantity) || c.quantity < 1) errors.push('Quantity must be a whole number of at least 1');
  if (c.purchasePricePerCoin == null || c.purchasePricePerCoin < 0) errors.push('Purchase price cannot be negative');
  if (!c.purchaseCurrency || !CURRENCIES.includes(c.purchaseCurrency)) errors.push('Unknown purchase currency');
  if (c.year != null && (!Number.isInteger(c.year) || c.year < 1000 || c.year > 3000)) errors.push('Year looks wrong');
  return errors;
}

export function newCoinId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `coin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
