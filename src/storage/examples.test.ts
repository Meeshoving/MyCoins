import { describe, expect, it } from 'vitest';
import { EXAMPLE_COINS, isExample } from './examples';
import { validateCoin } from '../domain/validate';
import collection from '../../data/coins.json';

describe('example coins', () => {
  it('are all valid and recognised as examples', () => {
    expect(EXAMPLE_COINS.length).toBeGreaterThan(0);
    for (const c of EXAMPLE_COINS) {
      expect(validateCoin(c)).toEqual([]);
      expect(isExample(c)).toBe(true);
    }
    expect(isExample({ id: 'my-own-coin' })).toBe(false);
  });

  it('are not in the default collection', () => {
    expect(collection.coins).toEqual([]);
  });
});
