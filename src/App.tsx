import { lazy, Suspense, useState } from 'react';
import { useRoute, href, navigate } from './hooks/useRoute';
import { useSettings } from './hooks/useSettings';
import { useCoins } from './hooks/useCoins';
import { PricePill } from './components/PricePill';
import { AccountButton } from './components/account/AccountButton';
import { SyncOffer } from './components/account/SyncOffer';
import { Overview } from './components/dashboard/Overview';
import { Collection } from './components/coins/Collection';
import { SettingsPage } from './components/settings/SettingsPage';
import { CoinForm } from './components/coins/CoinForm';
import { cx, Icon } from './components/ui/primitives';
import type { Coin } from './domain/types';

const CoinDetail = lazy(() => import('./components/coins/CoinDetail'));

export default function App() {
  const route = useRoute();
  const { settings, update, resolvedTheme } = useSettings();
  const { loading, error } = useCoins();
  const [editing, setEditing] = useState<Coin | 'new' | null>(null);

  const tabs = [
    { name: 'overview', label: 'Overview', href: href({ name: 'overview' }) },
    { name: 'collection', label: 'Collection', href: href({ name: 'collection' }) },
    { name: 'settings', label: 'Settings', href: href({ name: 'settings' }) },
  ] as const;
  const activeTab = route.name === 'coin' ? 'collection' : route.name;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href={href({ name: 'overview' })} className="flex items-center gap-2.5" aria-label="MyCoins home">
            <img src="./favicon.svg" alt="" className="size-8" />
            <span className="hidden font-display text-xl font-semibold tracking-tight min-[420px]:inline">MyCoins</span>
          </a>
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <a
                key={t.name}
                href={t.href}
                aria-current={activeTab === t.name ? 'page' : undefined}
                className={cx(
                  'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                  activeTab === t.name ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <PricePill />
            <button
              type="button"
              onClick={() => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
              className="rounded-full border border-line bg-surface p-2 text-muted shadow-card hover:text-ink"
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <AccountButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">
        {error && (
          <p role="alert" className="mb-4 rounded-2xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
            {error}
          </p>
        )}
        <SyncOffer />
        {loading ? (
          <p className="py-24 text-center text-muted">Loading your collection…</p>
        ) : route.name === 'overview' ? (
          <Overview onAdd={() => setEditing('new')} />
        ) : route.name === 'collection' ? (
          <Collection onAdd={() => setEditing('new')} />
        ) : route.name === 'coin' ? (
          <Suspense fallback={<p className="py-24 text-center text-muted">Loading…</p>}>
            <CoinDetail id={route.id} onEdit={(c) => setEditing(c)} />
          </Suspense>
        ) : (
          <SettingsPage />
        )}
      </main>

      {/* Bottom tab bar on phones */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {tabs.map((t) => (
            <a
              key={t.name}
              href={t.href}
              aria-current={activeTab === t.name ? 'page' : undefined}
              className={cx('rounded-full px-4 py-2 text-sm font-semibold', activeTab === t.name ? 'bg-surface-2 text-ink' : 'text-muted')}
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      <CoinForm
        coin={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onDeleted={() => navigate({ name: 'collection' })}
        currency={settings.currency}
      />
    </div>
  );
}
