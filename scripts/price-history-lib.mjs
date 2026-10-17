/**
 * Pure helpers for building public/data/price-history.json (no network here, so they're testable).
 *
 * Output shape:
 *   { start: "1960-01", months: n, usd: { gold, silver, platinum }, perUsd: { EUR, GBP, CHF }, ... }
 * Every array has one entry per month from `start`, or null where there is no data.
 */

export const METALS = ['gold', 'silver', 'platinum'];
const DEM_PER_EUR = 1.95583; // fixed conversion rate when the euro started

/** "1960M01" → "1960-01" */
export function pinkSheetMonth(label) {
  const m = /^(\d{4})M(\d{2})$/.exec(String(label ?? '').trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

export function monthDiff(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * Reads the World Bank "Monthly Prices" sheet, given as rows of cell texts/values.
 * Finds the header row naming Gold/Silver/Platinum and the rows labelled like 1960M01.
 * Returns { [month]: { gold, silver, platinum } } in US$ per troy ounce.
 */
export function parsePinkSheet(rows) {
  let cols = null;
  const out = {};
  for (const row of rows) {
    if (!cols) {
      const names = row.map((c) => String(c ?? '').trim().toLowerCase());
      const gold = names.indexOf('gold');
      if (gold !== -1) cols = { gold, silver: names.indexOf('silver'), platinum: names.indexOf('platinum') };
      continue;
    }
    const month = pinkSheetMonth(row[0]);
    if (!month) continue;
    const entry = {};
    for (const metal of METALS) entry[metal] = cols[metal] >= 0 ? toNumber(row[cols[metal]]) : null;
    if (METALS.some((m) => entry[m] != null)) out[month] = entry;
  }
  if (!cols) throw new Error('No Gold column found in the World Bank sheet');
  return out;
}

/** FRED CSV ("observation_date,SERIES" or "DATE,SERIES"; "." means missing) → { [month]: value } */
export function parseFredCsv(text) {
  const out = {};
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, value] = line.split(',');
    const n = toNumber(value);
    if (/^\d{4}-\d{2}/.test(date) && n != null && n > 0) out[date.slice(0, 7)] = n;
  }
  return out;
}

/**
 * Units of each currency per US dollar, by month.
 * EUR before 1999 comes from the Deutsche Mark at the fixed rate, as is common for long euro series.
 */
export function currenciesPerUsd({ usdPerEur, demPerUsd, usdPerGbp, chfPerUsd }) {
  const months = new Set([...Object.keys(usdPerEur), ...Object.keys(demPerUsd), ...Object.keys(usdPerGbp), ...Object.keys(chfPerUsd)]);
  const out = {};
  for (const m of months) {
    const eur = usdPerEur[m] ? 1 / usdPerEur[m] : demPerUsd[m] ? demPerUsd[m] / DEM_PER_EUR : null;
    out[m] = { EUR: eur, GBP: usdPerGbp[m] ? 1 / usdPerGbp[m] : null, CHF: chfPerUsd[m] ?? null };
  }
  return out;
}

const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Lines everything up month by month from the first metal price to the last. */
export function buildHistory(metals, fx, meta = {}) {
  const months = Object.keys(metals).sort();
  if (!months.length) throw new Error('No monthly prices to write');
  const start = months[0];
  const n = monthDiff(start, months[months.length - 1]) + 1;
  const usd = Object.fromEntries(METALS.map((m) => [m, []]));
  const perUsd = { EUR: [], GBP: [], CHF: [] };
  for (let i = 0; i < n; i++) {
    const month = addMonths(start, i);
    for (const m of METALS) usd[m].push(round(metals[month]?.[m], 2));
    for (const c of Object.keys(perUsd)) perUsd[c].push(round(fx[month]?.[c], 5));
  }
  return { ...meta, start, months: n, usd, perUsd };
}
