import { describe, expect, it } from 'vitest';
import { addMonths, buildHistory, currenciesPerUsd, parseFredCsv, parsePinkSheet, pinkSheetMonth } from './price-history-lib.mjs';

describe('price history building', () => {
  it('reads World Bank month labels', () => {
    expect(pinkSheetMonth('1960M01')).toBe('1960-01');
    expect(pinkSheetMonth(' 2026M09 ')).toBe('2026-09');
    expect(pinkSheetMonth('Description')).toBeNull();
    expect(addMonths('1999-11', 3)).toBe('2000-02');
  });

  it('finds the metal columns and monthly rows in the sheet', () => {
    const rows = [
      ['World Bank Commodity Price Data (The Pink Sheet)'],
      ['monthly prices in nominal US dollars'],
      ['', 'Crude oil, average', 'Gold', 'Platinum', 'Silver'],
      ['', '($/bbl)', '($/troy oz)', '($/troy oz)', '($/troy oz)'],
      ['1960M01', 1.63, 35.27, 83.5, 0.9137],
      ['1960M02', 1.63, '35.27', '…', 0.9137],
      ['2026M10', 70, '', '', ''],
    ];
    expect(parsePinkSheet(rows)).toEqual({
      '1960-01': { gold: 35.27, silver: 0.9137, platinum: 83.5 },
      '1960-02': { gold: 35.27, silver: 0.9137, platinum: null },
    });
    expect(() => parsePinkSheet([['nothing here']])).toThrow(/Gold/);
  });

  it('reads FRED CSV files in both header styles', () => {
    expect(parseFredCsv('observation_date,EXUSEU\n1999-01-01,1.1591\n1999-02-01,.\n')).toEqual({ '1999-01': 1.1591 });
    expect(parseFredCsv('DATE,EXSZUS\r\n1971-01-01,4.3053\r\n')).toEqual({ '1971-01': 4.3053 });
  });

  it('turns exchange rates into units per dollar, with Deutsche Mark-based euros before 1999', () => {
    const fx = currenciesPerUsd({
      usdPerEur: { '1999-01': 1.25 },
      demPerUsd: { '1998-12': 1.95583 * 0.85, '1999-01': 1.5 },
      usdPerGbp: { '1998-12': 2 },
      chfPerUsd: { '1998-12': 1.4 },
    });
    expect(fx['1999-01'].EUR).toBeCloseTo(0.8); // euro series wins once it exists
    expect(fx['1998-12']).toEqual({ EUR: expect.closeTo(0.85, 6), GBP: 0.5, CHF: 1.4 });
  });

  it('lines up months and fills gaps with null', () => {
    const h = buildHistory(
      { '2000-01': { gold: 280.123, silver: 5.2, platinum: null }, '2000-03': { gold: 290, silver: 5, platinum: 450 } },
      { '2000-01': { EUR: 0.98765, GBP: null, CHF: 1.6 } },
      { source: 'test' },
    );
    expect(h.start).toBe('2000-01');
    expect(h.months).toBe(3);
    expect(h.usd.gold).toEqual([280.12, null, 290]);
    expect(h.perUsd.EUR).toEqual([0.98765, null, null]);
    expect(h.source).toBe('test');
  });
});
