import seed from '../../data/coins.json';
import type { Coin } from '../domain/types';

export interface CoinFile {
  version: number;
  coins: Coin[];
}

/** Where the collection is saved. Add a Tauri or Capacitor store here later. */
export interface CoinStore {
  /** Short label shown in Settings. */
  readonly label: string;
  load(): Promise<Coin[]>;
  save(coins: Coin[]): Promise<void>;
}

const seedFile = seed as CoinFile;

/** Saves into data/coins.json through the dev server (npm run dev only). */
export class DevFileStore implements CoinStore {
  readonly label = 'data/coins.json (dev server)';
  async load(): Promise<Coin[]> {
    const res = await fetch('/api/coins');
    if (!res.ok) throw new Error(`Could not read coins.json (${res.status})`);
    return ((await res.json()) as CoinFile).coins;
  }
  async save(coins: Coin[]): Promise<void> {
    const res = await fetch('/api/coins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, coins } satisfies CoinFile),
    });
    if (!res.ok) throw new Error(`Could not save coins.json (${res.status})`);
  }
}

const LS_KEY = 'mycoins.coins.v1';

/** Saves in this browser. Starts from the bundled data/coins.json. */
export class LocalStorageStore implements CoinStore {
  readonly label = 'This browser (localStorage)';
  async load(): Promise<Coin[]> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return (JSON.parse(raw) as CoinFile).coins;
    } catch {
      /* storage blocked or corrupt: fall through to seed */
    }
    return structuredClone(seedFile.coins);
  }
  async save(coins: Coin[]): Promise<void> {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, coins } satisfies CoinFile));
  }
}

export async function pickStore(): Promise<CoinStore> {
  if (import.meta.env.DEV) {
    try {
      const res = await fetch('/api/coins', { method: 'GET' });
      if (res.ok) return new DevFileStore();
    } catch {
      /* dev API not available */
    }
  }
  return new LocalStorageStore();
}
