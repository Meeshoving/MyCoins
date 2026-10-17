import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Currency } from '../../domain/types';
import { money } from '../../lib/format';

/** Restrained palette: silver tones first, gold as the accent. */
const PALETTE = ['var(--silver)', 'var(--gold)', 'var(--silver-hi)', 'var(--gold-hi)', 'var(--faint)', 'var(--muted)'];

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: { key: string; value: number } }[]; currency: Currency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-semibold">{d.key}</p>
      <p className="text-muted">{money(d.value, currency)}</p>
    </div>
  );
}

export function DonutBreakdown({ data, currency }: { data: { key: string; value: number; color: string }[]; currency: Currency }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="h-48" role="img" aria-label={data.map((d) => `${d.key} ${money(d.value, currency)}`).join(', ')}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="key" innerRadius="62%" outerRadius="90%" paddingAngle={data.length > 1 ? 3 : 0} stroke="none" isAnimationActive>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="flex-1">{d.key}</span>
            <span className="text-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarBreakdown({ data, currency, layout }: { data: { key: string; value: number }[]; currency: Currency; layout: 'horizontal' | 'vertical' }) {
  const horizontal = layout === 'horizontal';
  const height = horizontal ? Math.max(160, data.length * 40) : 240;
  return (
    <div className="mt-4" style={{ height }} role="img" aria-label={data.map((d) => `${d.key} ${money(d.value, currency)}`).join(', ')}>
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="key" width={110} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="key" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} interval={0} />
              <YAxis hide />
            </>
          )}
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip currency={currency} />} />
          <Bar dataKey="value" radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]} barSize={horizontal ? 18 : 28}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={PALETTE[i % 2 === 0 ? 0 : 1]} fillOpacity={1 - Math.min(i, 6) * 0.08} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
