import { useEffect, useState } from 'react';
import type { Coin } from '../../domain/types';
import { useAccount } from '../../sync/account';
import { useCoins } from '../../hooks/useCoins';
import { pickStore } from '../../storage/coinStore';
import { coinsToOffer } from '../../sync/diff';
import { readJson, writeJson } from '../../lib/storage';
import { Button } from '../ui/primitives';

const handledKey = (uid: string) => `mycoins.sync.handled.${uid}`;

/**
 * After signing in: offers to copy coins saved in this browser into the account.
 * Asks once per coin, so declined coins don't keep coming back.
 */
export function SyncOffer() {
  const { status, user } = useAccount();
  const { coins, loading, replaceAll } = useCoins();
  const uid = status === 'signed-in' ? user?.uid : undefined;
  const [browserCoins, setBrowserCoins] = useState<Coin[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [handled, setHandled] = useState<string[]>([]);

  useEffect(() => {
    setBrowserCoins(null);
    setDone(null);
    if (!uid) return;
    setHandled(readJson<string[]>(handledKey(uid), []));
    let cancelled = false;
    pickStore()
      .then((s) => s.load())
      .then((list) => !cancelled && setBrowserCoins(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (!uid) return null;
  if (done) {
    return (
      <p role="status" className="mb-4 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
        {done}
      </p>
    );
  }
  if (loading || !browserCoins) return null;
  const offer = coinsToOffer(browserCoins, coins, handled);
  if (offer.length === 0) return null;

  const markHandled = () => {
    const next = [...handled, ...offer.map((c) => c.id)];
    writeJson(handledKey(uid), next);
    setHandled(next);
  };

  return (
    <div role="region" aria-label="Coins in this browser" className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
      <p>
        This browser has {offer.length} {offer.length === 1 ? 'coin' : 'coins'} that {offer.length === 1 ? "isn't" : "aren't"} in your account yet. Add{' '}
        {offer.length === 1 ? 'it' : 'them'} so {offer.length === 1 ? 'it shows' : 'they show'} up on all your devices?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await replaceAll([...coins, ...offer]);
              markHandled();
              setDone(`Added ${offer.length} ${offer.length === 1 ? 'coin' : 'coins'} to your account.`);
            } catch {
              /* the error is shown at the top of the page */
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Adding…' : `Add ${offer.length === 1 ? 'it' : `all ${offer.length}`} to my account`}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={markHandled}>
          No, leave {offer.length === 1 ? 'it' : 'them'}
        </Button>
      </div>
    </div>
  );
}
