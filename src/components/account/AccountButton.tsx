import { useAccount } from '../../sync/account';
import { href } from '../../hooks/useRoute';
import { Icon } from '../ui/primitives';

/** Small header control: "Sign in", or your picture once signed in. */
export function AccountButton() {
  const { status, user, signIn, busy } = useAccount();
  if (status === 'off' || status === 'loading') return null;

  if (status === 'signed-out') {
    return (
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-2 text-sm font-semibold text-muted shadow-card hover:text-ink sm:px-3"
        aria-label="Sign in to sync your coins"
      >
        <Icon name="user" size={16} />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  return (
    <a
      href={href({ name: 'settings' })}
      className="block rounded-full border border-line bg-surface shadow-card"
      aria-label={`Signed in as ${user?.name}. Account settings`}
      title={user?.email}
    >
      <Avatar name={user?.name ?? ''} photoUrl={user?.photoUrl ?? null} />
    </a>
  );
}

export function Avatar({ name, photoUrl, size = 34 }: { name: string; photoUrl: string | null; size?: number }) {
  return photoUrl ? (
    <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-gold/20 text-sm font-semibold text-ink" style={{ width: size, height: size }} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
