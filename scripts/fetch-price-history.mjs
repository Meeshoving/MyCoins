/**
 * Downloads 60+ years of monthly gold, silver and platinum prices and writes
 * public/data/price-history.json for the price charts page.
 *
 *   Metal prices: World Bank Commodity Price Data ("Pink Sheet"), monthly averages, CC BY 4.0.
 *   Exchange rates: Federal Reserve via FRED (EUR, GBP, CHF per US dollar).
 *
 * Runs before every website build. If a download fails it keeps the existing file
 * and never fails the build. Run locally with: npm run history
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { buildHistory, currenciesPerUsd, parseFredCsv, parsePinkSheet } from './price-history-lib.mjs';

const OUT = new URL('../public/data/price-history.json', import.meta.url);
const PINK_SHEET_PAGE = 'https://www.worldbank.org/en/research/commodity-markets';
// Used when the link can't be found on the page; the World Bank renames it now and then.
const PINK_SHEET_FALLBACK = 'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx';
const FRED = (id) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
const HEADERS = { 'User-Agent': 'MyCoins price history (https://github.com/Meeshoving/MyCoins)' };

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text();
}

async function pinkSheetUrl() {
  try {
    const html = await get(PINK_SHEET_PAGE);
    const m = html.match(/https?:\/\/thedocs\.worldbank\.org\/[^"'\s<>]*CMO-Historical-Data-Monthly\.xlsx/i);
    if (m) return m[0];
    console.warn('Pink Sheet link not found on the page; using the known address.');
  } catch (err) {
    console.warn(`Could not read ${PINK_SHEET_PAGE}: ${err.message}; using the known address.`);
  }
  return PINK_SHEET_FALLBACK;
}

/** The "Monthly Prices" sheet as rows of plain values. */
export async function sheetRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets.find((s) => /monthly prices/i.test(s.name)) ?? wb.worksheets[0];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const v = cell.value;
      cells[col - 1] = typeof v === 'number' ? v : v && typeof v === 'object' && 'result' in v ? v.result : cell.text;
    });
    rows.push(cells);
  });
  return rows;
}

async function metalPrices() {
  const url = await pinkSheetUrl();
  const rows = await sheetRows(await get(url, 'buffer'));
  return { url, prices: parsePinkSheet(rows) };
}

async function main() {
  const [{ url, prices }, usdPerEur, demPerUsd, usdPerGbp, chfPerUsd] = await Promise.all([
    metalPrices(),
    get(FRED('EXUSEU')).then(parseFredCsv),
    get(FRED('EXGEUS')).then(parseFredCsv),
    get(FRED('EXUSUK')).then(parseFredCsv),
    get(FRED('EXSZUS')).then(parseFredCsv),
  ]);
  const history = buildHistory(prices, currenciesPerUsd({ usdPerEur, demPerUsd, usdPerGbp, chfPerUsd }), {
    generatedAt: new Date().toISOString(),
    sources: {
      metals: { name: 'World Bank Commodity Price Data (The Pink Sheet)', url, license: 'CC BY 4.0' },
      fx: { name: 'Board of Governors of the Federal Reserve System, via FRED', url: 'https://fred.stlouisfed.org/' },
    },
  });
  const last = history.usd.gold.findLastIndex((v) => v != null);
  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(history));
  console.log(
    `Price history: ${history.months} months from ${history.start}; last gold $${history.usd.gold[last]}, silver $${history.usd.silver[last]}; ` +
      `EUR rates for ${history.perUsd.EUR.filter((v) => v != null).length} months.`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main().catch(async (err) => {
  const existing = await readFile(OUT, 'utf8').catch(() => null);
  console.warn(`::warning::Price history not updated: ${err.message}. ${existing ? 'Keeping the previous file.' : 'The charts page will say it has no data.'}`);
});
