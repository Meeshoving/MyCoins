import { useAccount } from '../../sync/account';
import { Button, Card, Eyebrow } from '../ui/primitives';
import { Avatar } from './AccountButton';

/** Settings section for signing in and out. Hidden when sync isn't set up. */
export function AccountCard() {
  const { status, user, busy, error, signIn, signOut } = useAccount();
  if (status === 'off') return null;

  return (
    <Card className="space-y-4 p-6">
      <Eyebrow>Account and sync</Eyebrow>
      {status === 'signed-in' && user ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} photoUrl={user.photoUrl} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Your coins, photos and settings are saved to your account and show up on every device where you sign in. Only you can see them.
          </p>
          <Button onClick={signOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out on this device'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Sign in with Google to see the same collection on your phone, tablet and computer. Without signing in, coins stay in this browser only.
          </p>
          <Button variant="primary" onClick={signIn} disabled={busy || status === 'loading'}>
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      )}
    </Card>
  );
}
