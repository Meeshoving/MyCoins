import { useRef, useState } from 'react';
import { useSettings, type ThemeSetting } from '../../hooks/useSettings';
import { usePrices } from '../../hooks/usePrices';
import { useCoins } from '../../hooks/useCoins';
import { CURRENCIES, METALS, type Currency, type Metal } from '../../domain/types';
import { validateCoin } from '../../domain/validate';
import type { Coin } from '../../domain/types';
import { PROVIDERS } from '../../prices/providers';
import { isExample } from '../../storage/examples';
import { dateTime, money } from '../../lib/format';
import { spotIn } from '../../domain/valuation';
import { Button, Card, Eyebrow, Segmented } from '../ui/primitives';
import { PriceStatusBadge } from '../PricePill';

const inputCls = 'h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink focus:outline-none focus-visible:border-gold';

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { prices, fx, loading, error, refresh, fallback } = usePrices();
  const { coins, storeLabel, replaceAll } = useCoins();
  const [manual, setManual] = useState(() =>
    Object.fromEntries(METALS.map((m) => [m, String(settings.manualPerOz[m])])) as Record<Metal, string>,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Coin[] | null>(null);
  const [confirmRemoveExamples, setConfirmRemoveExamples] = useState(false);
  const exampleCount = coins.filter(isExample).length;
  const fileRef = useRef<HTMLInputElement>(null);

  function saveManual() {
    const perOz = {} as Record<Metal, number>;
    for (const m of METALS) {
      const n = Number(manual[m].replace(',', '.'));
      if (!(n > 0)) {
        setMsg(`Enter a positive ${m} price`);
        return;
      }
      perOz[m] = n;
    }
    update({ manualPerOz: perOz, manualUpdatedAt: new Date().toISOString() });
    setMsg('Manual prices saved');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: 1, coins }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mycoins-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function readImport(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list: Coin[] = Array.isArray(data) ? data : data.coins;
      if (!Array.isArray(list)) throw new Error('No coins list found in that file');
      const bad = list.map((c, i) => ({ i, e: validateCoin(c) })).filter((x) => x.e.length);
      if (bad.length) throw new Error(`Entry ${bad[0].i + 1}: ${bad[0].e[0]}`);
      setPendingImport(list);
    } catch (err) {
      setMsg(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
      {msg && (
        <p role="status" className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
          {msg}
        </p>
      )}

      <Card className="space-y-5 p-6">
        <Eyebrow>Display</Eyebrow>
        <Row label="Currency" hint="All values are shown in this currency.">
          <Segmented label="Currency" value={settings.currency} onChange={(c: Currency) => update({ currency: c })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Row>
        <Row label="Theme">
          <Segmented
            label="Theme"
            value={settings.theme}
            onChange={(t: ThemeSetting) => update({ theme: t })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </Card>

      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Spot prices</Eyebrow>
          <PriceStatusBadge />
        </div>
        <Row label="Price source">
          <select className={inputCls} value={settings.priceSource} onChange={(e) => update({ priceSource: e.target.value })}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (live)
              </option>
            ))}
            <option value="manual">Manual prices only</option>
          </select>
        </Row>
        <p className="text-sm text-muted">
          {PROVIDERS.find((p) => p.id === settings.priceSource)?.description ?? 'Values use the prices you enter below.'}
        </p>

        <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-4">
          {METALS.map((m) => (
            <div key={m}>
              <dt className="text-xs uppercase tracking-wider text-faint">{m}</dt>
              <dd className="font-semibold">{money(spotIn(prices, m, settings.currency, fx), settings.currency)} / oz t</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs uppercase tracking-wider text-faint">Last updated</dt>
            <dd className="font-semibold">{dateTime(prices.updatedAt)}</dd>
            <dd className="text-xs text-faint">{prices.source}</dd>
          </div>
        </dl>
        {error && (
          <p role="alert" className="text-sm text-down">
            Could not fetch live prices: {error}. {fallback ? 'Using your manual prices for now.' : 'Showing the last prices that loaded.'}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {settings.priceSource !== 'manual' && (
            <Button onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh now'}
            </Button>
          )}
          {settings.priceSource !== 'manual' && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Auto-refresh every
              <select className="h-9 rounded-xl border border-line bg-surface-2 px-2 text-ink" value={settings.refreshMinutes} onChange={(e) => update({ refreshMinutes: Number(e.target.value) })}>
                {[5, 15, 30, 60, 240].map((n) => (
                  <option key={n} value={n}>
                    {n < 60 ? `${n} min` : `${n / 60} h`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="hairline" />
        <div>
          <p className="font-semibold">Manual prices</p>
          <p className="mt-1 text-sm text-muted">Used when the source is set to manual, or as a fallback when live prices can't be fetched. Per troy ounce.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {METALS.map((m) => (
              <label key={m}>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">{m}</span>
                <input className={inputCls} inputMode="decimal" value={manual[m]} onChange={(e) => setManual((x) => ({ ...x, [m]: e.target.value }))} />
              </label>
            ))}
            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">Currency</span>
              <select className={inputCls} value={settings.manualCurrency} onChange={(e) => update({ manualCurrency: e.target.value as Currency })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <Button className="mt-4" onClick={saveManual}>
            Save manual prices
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <Eyebrow>Data</Eyebrow>
        <p className="text-sm text-muted">
          Saving to: <span className="font-semibold text-ink">{storeLabel}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportJson}>Export JSON backup</Button>
          <Button onClick={() => fileRef.current?.click()}>Import JSON…</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => readImport(e.target.files?.[0])} />
        </div>
        {exampleCount > 0 && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm">
            <p>
              Your collection includes {exampleCount} example {exampleCount === 1 ? 'coin' : 'coins'}. Remove them to keep only your own coins.
            </p>
            <div className="mt-3 flex gap-2">
              {confirmRemoveExamples ? (
                <>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await replaceAll(coins.filter((c) => !isExample(c)));
                      setConfirmRemoveExamples(false);
                      setMsg(`Removed ${exampleCount} example ${exampleCount === 1 ? 'coin' : 'coins'}`);
                    }}
                  >
                    Yes, remove examples
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirmRemoveExamples(false)}>
                    Keep them
                  </Button>
                </>
              ) : (
                <Button onClick={() => setConfirmRemoveExamples(true)}>Remove example coins</Button>
              )}
            </div>
          </div>
        )}
        {pendingImport && (
          <div role="alertdialog" aria-label="Confirm import" className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
            <p>
              Replace your {coins.length} current entries with {pendingImport.length} from the file? Export a backup first if you might want them back.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  await replaceAll(pendingImport);
                  setPendingImport(null);
                  setMsg(`Imported ${pendingImport.length} entries`);
                }}
              >
                Replace collection
              </Button>
              <Button variant="quiet" onClick={() => setPendingImport(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className="sm:min-w-64 sm:text-right">{children}</div>
    </div>
  );
}
