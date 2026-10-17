import { useMemo, useState } from 'react';
import { useCoins } from '../../hooks/useCoins';
import { useSettings } from '../../hooks/useSettings';
import { usePrices } from '../../hooks/usePrices';
import { useValuations } from '../../hooks/useValuations';
import { GRAMS_PER_TROY_OZ, groupValue } from '../../domain/valuation';
import { EXAMPLE_COINS } from '../../storage/examples';
import { METALS } from '../../domain/types';
import { money, num, pct, signedMoney } from '../../lib/format';
import { byOrigin, ORIGIN_OPTIONS, type Origin } from '../../lib/filters';
import { METAL_TONE } from '../../lib/metalStyle';
import { coinThumb } from '../../lib/coinFace';
import { href } from '../../hooks/useRoute';
import { Button, Card, Eyebrow, GainText, Icon, Segmented } from '../ui/primitives';
import { PriceStatusBadge } from '../PricePill';
import { BarBreakdown, DonutBreakdown } from './Charts';
import { useAccount } from '../../sync/account';

export function Overview({ onAdd }: { onAdd: () => void }) {
  const { coins: all, replaceAll } = useCoins();
  const { status } = useAccount();
  const { settings } = useSettings();
  const { prices, fx } = usePrices();
  const [origin, setOrigin] = useState<Origin>('all');
  const coins = useMemo(() => all.filter(byOrigin(origin)), [all, origin]);
  const { summary: s, byId } = useValuations(coins);
  const cur = settings.currency;

  const byMetal = METALS.map((m) => ({ key: METAL_TONE[m].label, value: s.valueByMetal[m], color: m === 'gold' ? 'var(--gold)' : m === 'platinum' ? 'var(--faint)' : 'var(--silver)' })).filter((x) => x.value > 0);
  const byCountry = useMemo(() => groupValue(coins, (c) => c.country, prices, cur, fx), [coins, prices, cur, fx]);
  const top = [...coins].sort((a, b) => byId.get(b.id)!.valueTotal - byId.get(a.id)!.valueTotal).slice(0, 5);

  if (all.length === 0) {
    return (
      <Card className="rise mx-auto mt-10 max-w-lg p-10 text-center">
        <img src="./favicon.svg" alt="" className="mx-auto size-16" />
        <h1 className="mt-5 font-display text-3xl font-semibold">Start your collection</h1>
        <p className="mt-3 text-muted">
          Add your first coin to track its value and silver content. {status === 'signed-in' ? 'Your coins are saved to your account, so only you see them, on every device where you sign in.' : 'Your coins are saved in this browser only, so nobody else sees them.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={onAdd}>
            <Icon name="plus" /> Add a coin
          </Button>
          <Button onClick={() => void replaceAll(EXAMPLE_COINS)}>Try with example coins</Button>
        </div>
        <p className="mt-4 text-xs text-faint">You can remove the examples again in Settings.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Show coins from" value={origin} onChange={setOrigin} options={ORIGIN_OPTIONS} />
        <Button variant="primary" onClick={onAdd}>
          <Icon name="plus" /> Add coin
        </Button>
      </div>

      <Card className="rise relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--silver-hi), transparent 60%)' }} />
        <div className="relative flex flex-wrap items-center gap-2">
          <Eyebrow>Portfolio value</Eyebrow>
          <PriceStatusBadge />
        </div>
        <p className="relative mt-3 font-display text-5xl font-semibold tracking-tight sm:text-7xl">
          <span className="metal-text">{money(s.value, cur)}</span>
        </p>
        <p className="relative mt-3 text-lg">
          <GainText value={s.gain} className="font-semibold">
            {signedMoney(s.gain, cur)} · {pct(s.gainPct)}
          </GainText>
          <span className="text-muted"> unrealised, on {money(s.cost, cur)} cost basis</span>
        </p>
        <div className="hairline relative my-8" />
        <dl className="relative grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          <Stat label="Pure silver" value={`${num(s.pureOzByMetal.silver, 2)} oz t`} sub={`${num(s.pureOzByMetal.silver * GRAMS_PER_TROY_OZ, 0)} g`} />
          <Stat label="Pure gold" value={`${num(s.pureOzByMetal.gold, 3)} oz t`} sub={`${num(s.pureOzByMetal.gold * GRAMS_PER_TROY_OZ, 1)} g`} />
          <Stat label="Melt value" value={money(s.melt, cur)} sub={s.value > s.melt + 0.01 ? `${money(s.value - s.melt, cur)} collector premium` : 'at spot'} />
          <Stat label="Coins" value={String(s.coinCount)} sub={`${s.lineCount} different`} />
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rise p-6">
          <Eyebrow>By metal</Eyebrow>
          <DonutBreakdown data={byMetal} currency={cur} />
        </Card>
        <Card className="rise p-6">
          <Eyebrow>By country</Eyebrow>
          <BarBreakdown data={byCountry} currency={cur} layout="horizontal" />
        </Card>
        <Card className="rise p-6">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Largest holdings</Eyebrow>
            <a href={href({ name: 'collection' })} className="text-xs font-semibold text-gold hover:underline">
              See all
            </a>
          </div>
          <ul className="mt-4 space-y-1">
            {top.map((c) => {
              const v = byId.get(c.id)!;
              return (
                <li key={c.id}>
                  <a href={href({ name: 'coin', id: c.id })} className="-mx-2 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2">
                    <img src={c.obverseImage || coinThumb(c, 'obverse', 96)} alt="" className="size-10 rounded-full object-cover shadow-card" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block text-xs text-faint">
                        {c.quantity} × {c.year ?? '—'}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold">{money(v.valueTotal, cur)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold">{value}</dd>
      <dd className="text-sm text-muted">{sub}</dd>
    </div>
  );
}
