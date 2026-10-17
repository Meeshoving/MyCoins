import examples from '../../data/examples.json';
import type { Coin } from '../domain/types';
import type { CoinFile } from './coinStore';

/** Example coins people can load to try the app. Not part of anyone's collection by default. */
export const EXAMPLE_COINS: Coin[] = (examples as CoinFile).coins;

const EXAMPLE_IDS = new Set(EXAMPLE_COINS.map((c) => c.id));

export function isExample(coin: Pick<Coin, 'id'>): boolean {
  return EXAMPLE_IDS.has(coin.id);
}
