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

/** Older versions saved here; kept as a fallback when IndexedDB is unavailable. */
export class LocalStorageStore implements CoinStore {
  readonly label = 'This browser (localStorage)';
  async load(): Promise<Coin[]> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return (JSON.parse(raw) as CoinFile).coins;
    } catch {
      /* storage blocked or corrupt: start empty */
    }
    return [];
  }
  async save(coins: Coin[]): Promise<void> {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, coins } satisfies CoinFile));
  }
}

const DB_NAME = 'mycoins';
const DB_STORE = 'data';
const DB_KEY = 'collection';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, mode);
    const req = run(t.objectStore(DB_STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Saving was cancelled by the browser'));
  });
}

/**
 * Saves in this browser's IndexedDB, which has room for many photos
 * (localStorage only holds about 5 MB). Every visitor has their own collection; it starts empty.
 */
export class IndexedDbStore implements CoinStore {
  readonly label = 'This browser';
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IndexedDbStore> {
    const store = new IndexedDbStore(await openDb());
    // Ask the browser not to clear the collection when space runs low.
    void navigator.storage?.persist?.().catch(() => undefined);
    return store;
  }

  async load(): Promise<Coin[]> {
    const file = await tx<CoinFile | undefined>(this.db, 'readonly', (s) => s.get(DB_KEY));
    if (file) return file.coins;
    // First run after the switch: carry over anything saved by the older localStorage version.
    const old = await new LocalStorageStore().load();
    if (old.length) await this.save(old);
    return old;
  }

  async save(coins: Coin[]): Promise<void> {
    await tx(this.db, 'readwrite', (s) => s.put({ version: 1, coins } satisfies CoinFile, DB_KEY));
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
  try {
    if (typeof indexedDB !== 'undefined') return await IndexedDbStore.open();
  } catch {
    /* private mode or blocked: fall back */
  }
  return new LocalStorageStore();
}
