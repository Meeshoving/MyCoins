import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FIREBASE_CONFIG } from './firebaseConfig';
import type { CloudUser } from './cloud';

type CloudModule = typeof import('./cloud');

/** off: sync not set up · loading: checking who is signed in */
export type AccountStatus = 'off' | 'loading' | 'signed-out' | 'signed-in';

interface AccountState {
  status: AccountStatus;
  user: CloudUser | null;
  cloud: CloudModule | null;
  busy: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>(FIREBASE_CONFIG ? 'loading' : 'off');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [cloud, setCloud] = useState<CloudModule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!FIREBASE_CONFIG) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    import('./cloud')
      .then((m) => {
        if (cancelled) return;
        setCloud(m);
        unsub = m.watchUser((u) => {
          setUser(u);
          setStatus(u ? 'signed-in' : 'signed-out');
        });
      })
      .catch(() => {
        // Couldn't load sign-in (offline on a first visit): carry on with this browser's coins.
        if (!cancelled) setStatus('off');
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!cloud) return;
    setBusy(true);
    setError(null);
    try {
      await cloud.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [cloud]);

  const signOut = useCallback(async () => {
    if (!cloud) return;
    setBusy(true);
    try {
      await cloud.signOutAndForget();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [cloud]);

  const value = useMemo(() => ({ status, user, cloud, busy, error, signIn, signOut }), [status, user, cloud, busy, error, signIn, signOut]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}
