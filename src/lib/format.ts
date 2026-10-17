import type { Currency } from '../domain/types';

const moneyCache = new Map<string, Intl.NumberFormat>();

export function money(amount: number, currency: Currency, opts: { compact?: boolean; decimals?: number } = {}): string {
  const key = `${currency}|${opts.compact}|${opts.decimals}`;
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      minimumFractionDigits: opts.decimals ?? (opts.compact ? 0 : 2),
      maximumFractionDigits: opts.decimals ?? (opts.compact ? 1 : 2),
    });
    moneyCache.set(key, f);
  }
  return f.format(amount);
}

export function signedMoney(amount: number, currency: Currency): string {
  const s = money(Math.abs(amount), currency);
  return amount > 0.004 ? `+${s}` : amount < -0.004 ? `−${s}` : s;
}

export function num(n: number, decimals = 2): string {
  return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

export function pct(fraction: number | null, signed = true): string {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  const v = num(Math.abs(fraction) * 100, 1) + '%';
  if (!signed) return v;
  return fraction > 0.0004 ? `+${v}` : fraction < -0.0004 ? `−${v}` : v;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(diff)) return 'unknown';
  if (diff < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
