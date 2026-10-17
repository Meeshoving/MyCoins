import type { FirebaseOptions } from 'firebase/app';

/**
 * The Firebase project that stores signed-in collections.
 * This is not a secret: it only names the project. Access is guarded by firestore.rules,
 * which let each person read and write only their own data.
 * Leave it null to run without sign-in (coins stay in the browser only).
 */
const PROJECT: FirebaseOptions | null = null;

/** Local test setup: `VITE_FIREBASE_EMULATOR=1` talks to the Firebase emulators instead. */
export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export const FIREBASE_CONFIG: FirebaseOptions | null = USE_EMULATOR
  ? { apiKey: 'demo-key', authDomain: 'demo-mycoins.firebaseapp.com', projectId: 'demo-mycoins', appId: 'demo-app' }
  : PROJECT;
