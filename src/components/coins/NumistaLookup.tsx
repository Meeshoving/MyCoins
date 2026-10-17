import { useEffect, useRef, useState } from 'react';
import type { Coin } from '../../domain/types';
import { coinFieldsFromNumista, getNumistaType, searchNumista, yearRange, type NumistaSearchHit } from '../../catalog/numista';
import { href } from '../../hooks/useRoute';
import { Button } from '../ui/primitives';

const inputCls =
  'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus-visible:border-gold';

/**
 * Search the Numista catalogue and hand the chosen coin's details to the form.
 * Not a <form> itself, because it sits inside the coin form.
 */
export function NumistaLookup({
  apiKey,
  initialQuery,
  autoFocus,
  onPick,
  onOpenSettings,
}: {
  apiKey: string;
  initialQuery: string;
  autoFocus?: boolean;
  onPick: (fields: Partial<Coin>, hit: NumistaSearchHit) => void;
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<NumistaSearchHit[] | null>(null);
  const [busy, setBusy] = useState<'search' | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        Want the details and photos filled in for you? Add a free Numista API key in{' '}
        <a
          className="font-semibold text-gold underline underline-offset-2"
          href={href({ name: 'settings' })}
          onClick={onOpenSettings}
        >
          Settings
        </a>{' '}
        to look coins up in the Numista catalogue.
      </div>
    );
  }

  async function run<T>(kind: 'search' | number, job: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(kind);
    setError(null);
    try {
      return await job(ctrl.signal);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abort.current === ctrl) setBusy(null);
    }
  }

  async function search() {
    if (!query.trim()) return;
    const found = await run('search', (signal) => searchNumista(query, apiKey, signal));
    if (found) setHits(found);
  }

  async function pick(hit: NumistaSearchHit) {
    const detail = await run(hit.id, (signal) => getNumistaType(hit.id, apiKey, signal));
    if (!detail) return;
    onPick(coinFieldsFromNumista(detail), hit);
    setHits(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-4">
      <label htmlFor="numista-q" className="text-xs font-semibold uppercase tracking-wider text-faint">
        Look up in Numista
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="numista-q"
          className={inputCls}
          type="search"
          autoFocus={autoFocus}
          value={query}
          placeholder="e.g. 2½ gulden 1938 or Maple Leaf"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" onClick={search} disabled={busy != null || !query.trim()}>
          {busy === 'search' ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-down">
          {error}
        </p>
      )}

      {hits && (
        <div className="mt-3" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted">No coins found. Try fewer words, or the name in another language.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Numista results">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    disabled={busy != null}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface focus-visible:bg-surface focus-visible:outline-none disabled:opacity-60"
                  >
                    {h.obverse_thumbnail ? (
                      <img src={h.obverse_thumbnail} alt="" loading="lazy" className="size-11 shrink-0 rounded-full bg-surface object-cover" />
                    ) : (
                      <span className="size-11 shrink-0 rounded-full border border-dashed border-line" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {[h.issuer?.name, yearRange(h)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {busy === h.id && <span className="text-xs text-muted">Loading…</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-faint">
            Catalogue data and photos from{' '}
            <a className="underline underline-offset-2" href="https://en.numista.com" target="_blank" rel="noreferrer">
              Numista
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
