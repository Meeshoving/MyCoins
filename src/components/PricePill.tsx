import { usePrices } from '../hooks/usePrices';
import { useSettings } from '../hooks/useSettings';
import { spotIn } from '../domain/valuation';
import { dateTime, money, relativeTime } from '../lib/format';
import { cx, Icon } from './ui/primitives';

export function PriceStatusBadge() {
  const { prices, stale, fallback } = usePrices();
  const live = prices.mode === 'live' && !stale;
  const label = live ? 'Live' : stale ? 'Stale' : fallback ? 'Manual (offline)' : 'Manual';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        live ? 'bg-up/12 text-up' : 'bg-gold/12 text-gold',
      )}
    >
      <span className={cx('size-1.5 rounded-full', live ? 'bg-up animate-pulse' : 'bg-gold')} aria-hidden />
      {label}
    </span>
  );
}

export function PricePill() {
  const { prices, fx, loading, error, refresh } = usePrices();
  const { settings } = useSettings();
  const ag = spotIn(prices, 'silver', settings.currency, fx);
  const au = spotIn(prices, 'gold', settings.currency, fx);
  const canRefresh = settings.priceSource !== 'manual';
  return (
    <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-3 py-1.5 text-xs shadow-card" title={error ?? `Updated ${dateTime(prices.updatedAt)} · ${prices.source}`}>
      <PriceStatusBadge />
      <span className="hidden sm:inline">
        <span className="text-faint">Ag</span> <span className="font-semibold">{money(ag, settings.currency)}</span>
      </span>
      <span className="hidden md:inline">
        <span className="text-faint">Au</span> <span className="font-semibold">{money(au, settings.currency, { decimals: 0 })}</span>
      </span>
      <span className="text-faint">{relativeTime(prices.updatedAt)}</span>
      {canRefresh && (
        <button type="button" onClick={refresh} disabled={loading} className="rounded-full p-1 text-muted hover:text-ink disabled:opacity-60" aria-label="Refresh spot prices">
          <Icon name={loading ? 'spin' : 'refresh'} size={14} />
        </button>
      )}
    </div>
  );
}
