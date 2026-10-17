import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { METALS, type Currency, type Metal } from '../../domain/types';
import { spotIn } from '../../domain/valuation';
import { usePrices } from '../../hooks/usePrices';
import { useSettings } from '../../hooks/useSettings';
import { navigate } from '../../hooks/useRoute';
import { loadPriceHistory, niceTicks, rangeStats, seriesFor, startForYears, timeTicks, type PriceHistoryFile, type PricePoint } from '../../history/priceHistory';
import { METAL_TONE } from '../../lib/metalStyle';
import { money, pct, signedMoney } from '../../lib/format';
import { Card, Eyebrow, GainText, Segmented } from '../ui/primitives';

const PRESETS = [
  { value: '1', label: '1Y' },
  { value: '5', label: '5Y' },
  { value: '10', label: '10Y' },
  { value: '20', label: '20Y' },
  { value: '30', label: '30Y' },
  { value: '0', label: 'All' },
] as const;
type Preset = (typeof PRESETS)[number]['value'] | 'custom';

const NOW = 'now';
const COLOR: Record<Metal, string> = { silver: 'var(--silver)', gold: 'var(--gold)', platinum: 'var(--faint)' };

const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const label = (p: PricePoint) => (p.month === NOW ? 'Today' : monthFmt.format(p.t));

/** One price per month, plus today's spot price as the last point when prices are live. */
function usePoints(file: PriceHistoryFile | null, metal: Metal, currency: Currency): PricePoint[] {
  const { prices, fx } = usePrices();
  const live = prices.mode === 'live' ? spotIn(prices, metal, currency, fx) : 0;
  return useMemo(() => {
    if (!file) return [];
    const pts = seriesFor(file, metal, currency);
    if (live > 0) pts.push({ month: NOW, t: Date.now(), value: live });
    return pts;
  }, [file, metal, currency, live]);
}

export function PricesPage({ metal }: { metal: Metal }) {
  const { settings } = useSettings();
  const cur = settings.currency;
  const [file, setFile] = useState<PriceHistoryFile | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    void loadPriceHistory().then((f) => on && setFile(f));
    return () => {
      on = false;
    };
  }, []);

  const points = usePoints(file ?? null, metal, cur);
  const [preset, setPreset] = useState<Preset>('30');
  // A custom span is kept as months, so it survives switching metal or currency.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);

  const [startIndex, endIndex] = useMemo(() => {
    const last = points.length - 1;
    if (preset !== 'custom' || !custom) return [startForYears(points, Number(preset)), last];
    const from = points.findIndex((p) => p.month >= custom.from);
    const inSpan = (p: PricePoint) => (p.month === NOW ? custom.to === NOW : p.month <= custom.to);
    let to = last;
    while (to > 0 && !inSpan(points[to])) to--;
    const s = from === -1 ? 0 : from;
    return [Math.min(s, to), Math.max(s, to)];
  }, [points, preset, custom]);

  const shown = points.slice(startIndex, endIndex + 1);
  const yTicks = useMemo(() => (shown.length ? niceTicks(Math.min(...shown.map((p) => p.value)), Math.max(...shown.map((p) => p.value))) : []), [shown]);
  const axis = useMemo(() => timeTicks(shown.filter((p) => p.month !== NOW).map((p) => p.month)), [shown]);
  const stats = rangeStats(shown);
  const months = points.filter((p) => p.month !== NOW);
  const firstMonth = months[0]?.month ?? '';
  const lastMonth = months[months.length - 1]?.month ?? '';

  const choosePreset = (p: Preset) => {
    setPreset(p);
    setCustom(null);
  };
  const setSpan = (from: string, to: string) => {
    setPreset('custom');
    setCustom({ from, to });
  };
  const monthOf = (i: number) => points[i]?.month ?? '';

  return (
    <div className="rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Price history</Eyebrow>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{METAL_TONE[metal].label} price</h1>
          <p className="mt-1 text-sm text-muted">Per troy ounce, in {cur}. Change the currency in Settings.</p>
        </div>
        <Segmented
          label="Metal"
          value={metal}
          onChange={(m) => navigate({ name: 'prices', metal: m })}
          options={METALS.map((m) => ({ value: m, label: METAL_TONE[m].label }))}
        />
      </div>

      {file === undefined ? (
        <Card className="p-10 text-center text-muted">Loading price history…</Card>
      ) : file === null || points.length < 2 ? (
        <Card className="p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Price history isn't available yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            The history is downloaded when the site is published. On your own computer, start MyCoins with <b>Start MyCoins.bat</b> while you're online and it will be fetched.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat title={stats!.last.month === NOW ? 'Today' : label(stats!.last)} value={money(stats!.last.value, cur)} />
            <Stat
              title={`Change since ${label(stats!.first)}`}
              value={
                <GainText value={stats!.change}>
                  {signedMoney(stats!.change, cur)} <span className="text-sm">({pct(stats!.changePct)})</span>
                </GainText>
              }
            />
            <Stat title={`Highest · ${label(stats!.high)}`} value={money(stats!.high.value, cur)} />
            <Stat title={`Lowest · ${label(stats!.low)}`} value={money(stats!.low.value, cur)} />
          </div>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented label="Time span" size="sm" value={preset} onChange={choosePreset} options={[...PRESETS]} />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-muted">From</span>
                  <input
                    type="month"
                    className="h-8 rounded-full border border-line bg-surface-2 px-3 text-sm"
                    min={firstMonth}
                    max={lastMonth}
                    value={monthOf(startIndex) === NOW ? lastMonth : monthOf(startIndex)}
                    onChange={(e) => e.target.value && (setSpan(e.target.value, monthOf(endIndex)))}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted">To</span>
                  <input
                    type="month"
                    className="h-8 rounded-full border border-line bg-surface-2 px-3 text-sm"
                    min={firstMonth}
                    max={lastMonth}
                    value={monthOf(endIndex) === NOW ? lastMonth : monthOf(endIndex)}
                    onChange={(e) => e.target.value && (setSpan(monthOf(startIndex), e.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 h-80 sm:h-96" role="img" aria-label={`${METAL_TONE[metal].label} price from ${label(stats!.first)} to ${label(stats!.last)}: ${money(stats!.first.value, cur)} to ${money(stats!.last.value, cur)}`}>
              <ResponsiveContainer>
                <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`fill-${metal}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLOR[metal]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLOR[metal]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    ticks={axis.ticks}
                    interval={0}
                    tick={{ fill: 'var(--muted)', fontSize: 12 }}
                    tickFormatter={axis.format}
                  />
                  <YAxis
                    width={72}
                    tickLine={false}
                    axisLine={false}
                    domain={[yTicks[0] ?? 'auto', yTicks[yTicks.length - 1] ?? 'auto']}
                    ticks={yTicks}
                    allowDataOverflow
                    tick={{ fill: 'var(--muted)', fontSize: 12 }}
                    tickFormatter={(v: number) => money(v, cur, { decimals: yTicks[1] - yTicks[0] < 1 ? 2 : 0 })}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--faint)', strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      const p = active && (payload?.[0]?.payload as PricePoint | undefined);
                      if (!p) return null;
                      return (
                        <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card">
                          <p className="font-semibold">{label(p)}</p>
                          <p className="text-muted">{money(p.value, cur)}{p.month === NOW ? ' · spot' : ' · monthly average'}</p>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke={COLOR[metal]} strokeWidth={2} fill={`url(#fill-${metal})`} isAnimationActive={false} />
                  <Brush
                    dataKey="month"
                    startIndex={startIndex}
                    endIndex={endIndex}
                    height={44}
                    travellerWidth={10}
                    stroke="var(--faint)"
                    fill="var(--surface-2)"
                    tickFormatter={(m: string) => (m === NOW ? 'Today' : m.slice(0, 4))}
                    onChange={(r) => {
                      if (r.startIndex == null || r.endIndex == null) return;
                      if (r.startIndex === startIndex && r.endIndex === endIndex) return;
                      setSpan(monthOf(r.startIndex), monthOf(r.endIndex));
                    }}
                  >
                    <AreaChart data={points}>
                      {/* Its own axis, so the small chart always shows the whole history. */}
                      <YAxis yAxisId="mini" hide domain={[0, 'dataMax']} />
                      <Area yAxisId="mini" type="monotone" dataKey="value" stroke={COLOR[metal]} fill={COLOR[metal]} fillOpacity={0.15} isAnimationActive={false} />
                    </AreaChart>
                  </Brush>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-faint">Drag the handles of the small chart, pick a span above, or type the months, to change the time span.</p>
          </Card>

          <p className="text-xs text-faint">
            Monthly average prices from the{' '}
            <a className="underline hover:text-ink" href={file.sources.metals.url} target="_blank" rel="noreferrer">
              {file.sources.metals.name}
            </a>{' '}
            ({file.sources.metals.license}), converted with monthly exchange rates from{' '}
            <a className="underline hover:text-ink" href={file.sources.fx.url} target="_blank" rel="noreferrer">
              {file.sources.fx.name}
            </a>
            . The last point is today's spot price. Updated {new Date(file.generatedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs font-semibold text-faint" title={title}>
        {title}
      </p>
      <p className="mt-1 font-display text-xl font-semibold sm:text-2xl">{value}</p>
    </Card>
  );
}
