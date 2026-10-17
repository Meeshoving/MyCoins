import { useMemo, useState } from 'react';
import { useCoins } from '../../hooks/useCoins';
import { useSettings } from '../../hooks/useSettings';
import { useValuations } from '../../hooks/useValuations';
import type { Coin, Metal } from '../../domain/types';
import type { CoinValuation } from '../../domain/valuation';
import { byMetal, byOrigin, bySearch, ORIGIN_OPTIONS, type Origin } from '../../lib/filters';
import { money, num, pct } from '../../lib/format';
import { coinThumb } from '../../lib/coinFace';
import { readJson, writeJson } from '../../lib/storage';
import { href } from '../../hooks/useRoute';
import { Button, Card, cx, GainText, Icon, Segmented } from '../ui/primitives';

type SortKey = 'value' | 'name' | 'year' | 'gain' | 'pure' | 'country';
type View = 'grid' | 'table';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'gain', label: 'Gain %' },
  { value: 'pure', label: 'Metal content' },
  { value: 'year', label: 'Year' },
  { value: 'name', label: 'Name' },
  { value: 'country', label: 'Country' },
];

function sortValue(c: Coin, v: CoinValuation, key: SortKey): number | string {
  switch (key) {
    case 'value':
      return v.valueTotal;
    case 'gain':
      return v.gainPct ?? -Infinity;
    case 'pure':
      return v.pureOzTotal;
    case 'year':
      return c.year ?? -Infinity;
    case 'name':
      return c.name.toLowerCase();
    case 'country':
      return c.country.toLowerCase();
  }
}

const PREFS_KEY = 'mycoins.collectionPrefs.v1';

export function Collection({ onAdd }: { onAdd: () => void }) {
  const { coins } = useCoins();
  const { settings } = useSettings();
  const cur = settings.currency;
  const saved = readJson<{ view?: View; sort?: SortKey; desc?: boolean }>(PREFS_KEY, {});
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState<Origin>('all');
  const [metal, setMetal] = useState<Metal | 'all'>('all');
  const [sort, setSortState] = useState<SortKey>(saved.sort ?? 'value');
  const [desc, setDesc] = useState(saved.desc ?? true);
  const [view, setViewState] = useState<View>(saved.view ?? 'grid');
  const { byId } = useValuations(coins);

  const save = (p: { view?: View; sort?: SortKey; desc?: boolean }) => writeJson(PREFS_KEY, { view, sort, desc, ...p });
  const setView = (v: View) => (setViewState(v), save({ view: v }));
  const setSort = (k: SortKey, d = desc) => (setSortState(k), setDesc(d), save({ sort: k, desc: d }));
  const toggleSort = (k: SortKey) => setSort(k, sort === k ? !desc : k === 'name' || k === 'country' ? false : true);

  const shown = useMemo(() => {
    const list = coins.filter(byOrigin(origin)).filter(byMetal(metal)).filter(bySearch(q));
    return list.sort((a, b) => {
      const x = sortValue(a, byId.get(a.id)!, sort);
      const y = sortValue(b, byId.get(b.id)!, sort);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return desc ? -r : r;
    });
  }, [coins, origin, metal, q, sort, desc, byId]);

  const metals = [...new Set(coins.map((c) => c.metal))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Collection</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {shown.length} of {coins.length} entries
          </p>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <Icon name="plus" /> Add coin
        </Button>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Search coins</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, country, year, mint…"
            className="h-10 w-full rounded-full border border-line bg-surface-2 pl-9 pr-4 text-sm placeholder:text-faint focus:outline-none focus-visible:border-gold"
          />
        </label>
        <Segmented label="Origin" size="sm" value={origin} onChange={setOrigin} options={ORIGIN_OPTIONS} />
        {metals.length > 1 && (
          <Segmented
            label="Metal"
            size="sm"
            value={metal}
            onChange={setMetal}
            options={[{ value: 'all', label: 'Any metal' }, ...metals.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))]}
          />
        )}
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-full border border-line bg-surface-2 px-3 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSort(sort, !desc)} className="rounded-full p-1.5 hover:bg-surface-2 hover:text-ink" aria-label={desc ? 'Sorted high to low, switch to low to high' : 'Sorted low to high, switch to high to low'}>
            <span aria-hidden>{desc ? '↓' : '↑'}</span>
          </button>
        </label>
        <Segmented
          label="View"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: 'Cards' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </Card>

      {coins.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted">You haven't added any coins yet.</p>
          <Button variant="primary" className="mt-4" onClick={onAdd}>
            <Icon name="plus" /> Add your first coin
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-muted">No coins match these filters.</p>
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((c, i) => (
            <CoinCard key={c.id} coin={c} v={byId.get(c.id)!} currency={cur} delay={Math.min(i, 12) * 30} />
          ))}
        </ul>
      ) : (
        <CoinTable coins={shown} byId={byId} currency={cur} sort={sort} desc={desc} onSort={toggleSort} />
      )}
    </div>
  );
}

function CoinCard({ coin: c, v, currency, delay }: { coin: Coin; v: CoinValuation; currency: Coin['purchaseCurrency']; delay: number }) {
  return (
    <li className="rise" style={{ animationDelay: `${delay}ms` }}>
      <a
        href={href({ name: 'coin', id: c.id })}
        className="group block h-full rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5 transition hover:-translate-y-0.5 hover:border-silver/50"
      >
        <div className="relative mx-auto aspect-square w-3/5">
          <img
            src={c.obverseImage || coinThumb(c)}
            alt={`${c.name} obverse`}
            className="size-full rounded-full object-cover shadow-[0_18px_30px_-18px_rgb(0_0_0/0.6)] transition duration-500 group-hover:rotate-6 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {c.quantity > 1 && (
            <span className="absolute -right-2 top-0 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-bold shadow-card">×{c.quantity}</span>
          )}
        </div>
        <h3 className="mt-4 truncate font-display text-base font-semibold sm:text-lg">{c.name}</h3>
        <p className="truncate text-xs text-muted sm:text-sm">
          {[c.country, c.year ?? '—', c.denomination].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2">
          <div>
            <p className="text-base font-bold sm:text-lg">{money(v.valueTotal, currency)}</p>
            <p className="text-xs text-faint">
              {num(v.pureOzTotal, 2)} oz t {c.metal}
            </p>
          </div>
          <GainText value={v.gain} className="text-sm font-semibold">
            {pct(v.gainPct)}
          </GainText>
        </div>
      </a>
    </li>
  );
}

type ThProps = { k?: SortKey; children: string; right?: boolean; sort: SortKey; desc: boolean; onSort: (k: SortKey) => void };

function Th({ k, children, right, sort, desc, onSort }: ThProps) {
  return (
    <th scope="col" aria-sort={k && sort === k ? (desc ? 'descending' : 'ascending') : undefined} className={cx('px-4 py-3 font-semibold', right && 'text-right')}>
      {k ? (
        <button type="button" onClick={() => onSort(k)} className={cx('inline-flex items-center gap-1 hover:text-ink', sort === k && 'text-ink')}>
          {children}
          <span aria-hidden className="text-[10px]">{sort === k ? (desc ? '▼' : '▲') : ''}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function CoinTable({
  coins,
  byId,
  currency,
  sort,
  desc,
  onSort,
}: {
  coins: Coin[];
  byId: Map<string, CoinValuation>;
  currency: Coin['purchaseCurrency'];
  sort: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const sp = { sort, desc, onSort };
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
          <tr>
            <Th {...sp} k="name">Coin</Th>
            <Th {...sp} k="country">Country</Th>
            <Th {...sp} k="year">Year</Th>
            <Th {...sp} right>Qty</Th>
            <Th {...sp} k="pure" right>
              Pure oz t
            </Th>
            <Th {...sp} right>Cost</Th>
            <Th {...sp} k="value" right>
              Value
            </Th>
            <Th {...sp} k="gain" right>
              Gain
            </Th>
          </tr>
        </thead>
        <tbody>
          {coins.map((c) => {
            const v = byId.get(c.id)!;
            return (
              <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-3">
                  <a href={href({ name: 'coin', id: c.id })} className="flex items-center gap-3 font-semibold hover:text-gold">
                    <img src={c.obverseImage || coinThumb(c, 'obverse', 96)} alt="" className="size-8 rounded-full object-cover" />
                    {c.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted">{c.country}</td>
                <td className="px-4 py-3 text-muted">{c.year ?? '—'}</td>
                <td className="px-4 py-3 text-right">{c.quantity}</td>
                <td className="px-4 py-3 text-right">{num(v.pureOzTotal, 3)}</td>
                <td className="px-4 py-3 text-right text-muted">{money(v.costTotal, currency)}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(v.valueTotal, currency)}</td>
                <td className="px-4 py-3 text-right">
                  <GainText value={v.gain} className="font-semibold">
                    {pct(v.gainPct)}
                  </GainText>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
