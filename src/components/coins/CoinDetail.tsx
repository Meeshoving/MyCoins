import { lazy, Suspense } from 'react';
import { useCoins } from '../../hooks/useCoins';
import { useSettings } from '../../hooks/useSettings';
import { usePrices } from '../../hooks/usePrices';
import { valueCoin } from '../../domain/valuation';
import { eraOf, isDutch } from '../../domain/classify';
import type { Coin } from '../../domain/types';
import { money, num, pct, signedMoney } from '../../lib/format';
import { href } from '../../hooks/useRoute';
import { Button, Card, Eyebrow, GainText, Icon } from '../ui/primitives';

const CoinViewer = lazy(() => import('../viewer/CoinViewer'));

export default function CoinDetail({ id, onEdit }: { id: string; onEdit: (c: Coin) => void }) {
  const { coins } = useCoins();
  const { settings } = useSettings();
  const { prices, fx } = usePrices();
  const coin = coins.find((c) => c.id === id);
  const cur = settings.currency;

  if (!coin) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted">This coin isn't in your collection.</p>
        <a href={href({ name: 'collection' })} className="mt-4 inline-block font-semibold text-gold hover:underline">
          Back to collection
        </a>
      </div>
    );
  }

  const v = valueCoin(coin, prices, cur, fx);
  const specs: [string, string | undefined][] = [
    ['Country', coin.country],
    ['Year', coin.year != null ? String(coin.year) : undefined],
    ['Era', eraOf(coin)],
    ['Mint', coin.mint],
    ['Denomination', coin.denomination],
    ['Metal', `${coin.metal[0].toUpperCase()}${coin.metal.slice(1)}, ${num(coin.purity, 4).replace(/0+$/, '').replace(/[.,]$/, '')} fine`],
    ['Gross weight', `${num(coin.grossWeightGrams, 2)} g`],
    ['Pure content', `${num(v.pureGramsEach, 2)} g · ${num(v.pureOzEach, 4)} oz t`],
    ['Diameter', coin.diameterMm ? `${num(coin.diameterMm, 2)} mm` : undefined],
    ['Thickness', coin.thicknessMm ? `${num(coin.thicknessMm, 2)} mm` : undefined],
    ['Mintage', coin.mintage ? new Intl.NumberFormat('nl-NL').format(coin.mintage) : undefined],
    ['Grade', coin.grade],
    ['Purchased', coin.purchaseDate ? new Date(coin.purchaseDate).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : undefined],
  ];

  return (
    <div className="space-y-6">
      <a href={href({ name: 'collection' })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <Icon name="back" size={16} /> Collection
      </a>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="rise">
          <Suspense fallback={<div className="grid aspect-square place-items-center rounded-3xl border border-line bg-surface text-muted">Loading 3D view…</div>}>
            <CoinViewer key={coin.id} coin={coin} />
          </Suspense>
        </div>

        <div className="rise space-y-6" style={{ animationDelay: '80ms' }}>
          <div>
            <Eyebrow>
              {isDutch(coin) ? 'Dutch' : 'International'} · {coin.country} · {coin.year ?? 'Year unknown'}
            </Eyebrow>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{coin.name}</h1>
            <p className="mt-1 text-muted">
              {[`${coin.quantity} ${coin.quantity === 1 ? 'coin' : 'coins'}`, coin.denomination].filter(Boolean).join(' · ')}
            </p>
          </div>

          <Card className="p-6">
            <p className="font-display text-4xl font-semibold">
              <span className="metal-text">{money(v.valueTotal, cur)}</span>
            </p>
            <p className="mt-1">
              <GainText value={v.gain} className="font-semibold">
                {signedMoney(v.gain, cur)} · {pct(v.gainPct)}
              </GainText>
              <span className="text-muted"> vs. {money(v.costTotal, cur)} paid</span>
            </p>
            <div className="hairline my-5" />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Item label="Melt value each" value={money(v.meltEach, cur)} />
              <Item label="Value each" value={money(v.valueEach, cur)} sub={coin.collectorValuePerCoin != null ? 'collector value' : 'at melt'} />
              <Item label="Premium over melt" value={v.premiumEach != null ? `${signedMoney(v.premiumEach, cur)}` : '—'} sub={v.premiumPct != null ? pct(v.premiumPct) : 'no collector value set'} />
              <Item label="Paid each" value={money(v.costEach, cur)} />
              <Item label="Total pure metal" value={`${num(v.pureOzTotal, 3)} oz t`} sub={`${num(v.pureGramsEach * coin.quantity, 1)} g`} />
            </dl>
          </Card>

          <Card className="p-6">
            <Eyebrow>Specifications</Eyebrow>
            <dl className="mt-4 divide-y divide-line text-sm">
              {specs
                .filter(([, val]) => val)
                .map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-semibold">{val}</dd>
                  </div>
                ))}
            </dl>
            {coin.notes && <p className="mt-4 whitespace-pre-line rounded-2xl bg-surface-2 p-4 text-sm text-muted">{coin.notes}</p>}
            {coin.numistaUrl && (
              <p className="mt-4 text-xs text-faint">
                Catalogue details from{' '}
                <a className="font-semibold text-gold underline underline-offset-2" href={coin.numistaUrl} target="_blank" rel="noreferrer">
                  Numista
                </a>
                .
              </p>
            )}
          </Card>

          <Button variant="primary" onClick={() => onEdit(coin)}>
            <Icon name="edit" size={16} /> Edit coin
          </Button>
        </div>
      </div>
    </div>
  );
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-faint">{sub}</dd>}
    </div>
  );
}
