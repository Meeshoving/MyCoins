import type { FirebaseOptions } from 'firebase/app';

/**
 * The Firebase project that stores signed-in collections.
 * This is not a secret: it only names the project. Access is guarded by firestore.rules,
 * which let each person read and write only their own data.
 * Leave it null to run without sign-in (coins stay in the browser only).
 */
const PROJECT: FirebaseOptions | null = {
  apiKey: 'AIzaSyCvHv5MD-kk5IeMzUvnySYmd4ZQPVuS2cc',
  authDomain: 'mycoins-2026.firebaseapp.com',
  projectId: 'mycoins-2026',
  storageBucket: 'mycoins-2026.firebasestorage.app',
  messagingSenderId: '651329360572',
  appId: '1:651329360572:web:6dd7f90e556cf73d0fb6b9',
};

/** Local test setup: `VITE_FIREBASE_EMULATOR=1` talks to the Firebase emulators instead. */
export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export const FIREBASE_CONFIG: FirebaseOptions | null = USE_EMULATOR
  ? { apiKey: 'demo-key', authDomain: 'demo-mycoins.firebaseapp.com', projectId: 'demo-mycoins', appId: 'demo-app' }
  : PROJECT;
