/**
 * Firebase sign-in and the synced collection. Loaded on demand, so the app stays small
 * for visitors who never sign in.
 */
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  terminate,
  writeBatch,
} from 'firebase/firestore';
import type { Coin } from '../domain/types';
import type { CoinStore } from '../storage/coinStore';
import { FIREBASE_CONFIG, USE_EMULATOR } from './firebaseConfig';
import { diffCoins, stableJson } from './diff';

if (!FIREBASE_CONFIG) throw new Error('Sync is not set up');

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
// Keeps a copy on the device, so the collection opens offline and syncs when back online.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // Automated tests sign in with a fake Google account (the emulator accepts unsigned tokens).
  (window as unknown as Record<string, unknown>).__mycoinsTestSignIn = (sub: string, email: string, name: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, name, email_verified: true })));
}

export interface CloudUser {
  uid: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

export function watchUser(cb: (user: CloudUser | null) => void): () => void {
  return onAuthStateChanged(auth, (u) =>
    cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'You', email: u.email ?? '', photoUrl: u.photoURL } : null),
  );
}

/** Firebase error codes in plain words. */
export function explain(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    'auth/unauthorized-domain': 'This website is not on the Firebase list of authorized domains yet (Authentication → Settings).',
    'auth/operation-not-allowed': 'Google sign-in is not switched on in Firebase yet (Authentication → Sign-in method).',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'permission-denied': 'Your account refused this change. Check the security rules in Firebase.',
    unavailable: 'No connection right now. Changes are kept on this device and sync when you are back online.',
    'resource-exhausted': 'The free Firebase limit for today is reached. Try again tomorrow.',
  };
  return messages[code] ?? (err instanceof Error ? err.message : String(err));
}

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw new Error(explain(err));
  }
}

/** Signs out and removes the account's copy from this device, then restarts the app. */
export async function signOutAndForget(): Promise<void> {
  await signOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(() => undefined);
  location.reload();
}

/** Firestore limits each saved item to about 1 MB. */
const MAX_COIN_BYTES = 900_000;

/** The collection in the signed-in person's account: users/{uid}/coins/{coinId}. */
export class CloudStore implements CoinStore {
  readonly label = 'Your account (synced across devices)';
  /** Last saved version of each coin, to write only what changed. */
  private known = new Map<string, string>();
  private onError: (err: Error) => void = () => undefined;

  constructor(private uid: string) {}

  private get coins() {
    return collection(db, 'users', this.uid, 'coins');
  }

  async load(): Promise<Coin[]> {
    const snap = await getDocs(this.coins);
    const coins = snap.docs.map((d) => d.data() as Coin);
    this.known = new Map(coins.map((c) => [c.id, stableJson(c)]));
    return coins;
  }

  subscribe(onCoins: (coins: Coin[]) => void, onError: (err: Error) => void): () => void {
    this.onError = (err) => onError(new Error(explain(err)));
    return onSnapshot(
      this.coins,
      (snap) => {
        const coins = snap.docs.map((d) => d.data() as Coin);
        this.known = new Map(coins.map((c) => [c.id, stableJson(c)]));
        onCoins(coins);
      },
      this.onError,
    );
  }

  async save(next: Coin[]): Promise<void> {
    const { put, remove } = diffCoins(this.known, next);
    const tooBig = put.find((c) => stableJson(c).length > MAX_COIN_BYTES);
    if (tooBig) throw new Error(`"${tooBig.name}" is too large to sync. Its photos are too big; try adding them again.`);

    const ops = [
      ...put.map((c) => (b: ReturnType<typeof writeBatch>) => b.set(doc(this.coins, c.id), c)),
      ...remove.map((id) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(this.coins, id))),
    ];
    const commits: Promise<void>[] = [];
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(batch));
      commits.push(batch.commit());
    }
    const done = Promise.all(commits);
    done.catch((err) => this.onError(err));
    // Offline, Firestore keeps the change on the device and only confirms once it reaches
    // the server. Don't make the screen wait for that.
    await Promise.race([done, new Promise((r) => setTimeout(r, 1500))]);
  }
}

/** Settings that follow you to every device (users/{uid} → settings). */
export function watchSyncedSettings(
  uid: string,
  cb: (settings: Record<string, unknown> | null) => void,
  onError: (msg: string) => void,
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => cb((snap.data()?.settings as Record<string, unknown> | undefined) ?? null),
    (err) => onError(explain(err)),
  );
}

export function saveSyncedSettings(uid: string, patch: Record<string, unknown>, onError: (msg: string) => void): void {
  setDoc(doc(db, 'users', uid), { settings: patch }, { merge: true }).catch((err) => onError(explain(err)));
}
