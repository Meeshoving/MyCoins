import { afterEach, describe, expect, it, vi } from 'vitest';
import { coinFieldsFromNumista, parseFineness, parseMetal, searchNumista, yearRange } from './numista';

afterEach(() => vi.unstubAllGlobals());

describe('Numista parsing', () => {
  it('reads fineness in the usual notations', () => {
    expect(parseFineness('Silver (.720)')).toBe(0.72);
    expect(parseFineness('Silver (0.999)')).toBe(0.999);
    expect(parseFineness('Silver 925')).toBe(0.925);
    expect(parseFineness('Gold (.9167)')).toBe(0.9167);
    expect(parseFineness('Silver 9999')).toBe(0.9999);
    expect(parseFineness('Silver 800/1000')).toBe(0.8);
    expect(parseFineness('Copper-nickel')).toBeUndefined();
    expect(parseFineness(undefined)).toBeUndefined();
  });

  it('reads the metal', () => {
    expect(parseMetal('Silver (.720)')).toBe('silver');
    expect(parseMetal('Gold (.9167)')).toBe('gold');
    expect(parseMetal('Bimetallic: nickel-brass')).toBeUndefined();
  });

  it('formats year ranges', () => {
    expect(yearRange({ min_year: 1929, max_year: 1945 })).toBe('1929–1945');
    expect(yearRange({ min_year: 1970, max_year: 1970 })).toBe('1970');
    expect(yearRange({})).toBe('');
  });

  it('maps a Numista coin onto our fields', () => {
    const f = coinFieldsFromNumista({
      id: 123,
      url: 'https://en.numista.com/catalogue/pieces123.html',
      title: '2½ Gulden - Wilhelmina',
      issuer: { name: 'Netherlands' },
      min_year: 1929,
      max_year: 1940,
      value: { text: '2½ Gulden' },
      composition: { text: 'Silver (.720)' },
      weight: 25,
      size: 38,
      thickness: 2.5,
      obverse: { picture: 'https://example.org/obv.jpg' },
      reverse: { picture: 'https://example.org/rev.jpg' },
    });
    expect(f).toEqual({
      name: '2½ Gulden - Wilhelmina',
      numistaId: 123,
      numistaUrl: 'https://en.numista.com/catalogue/pieces123.html',
      country: 'Netherlands',
      denomination: '2½ Gulden',
      metal: 'silver',
      purity: 0.72,
      grossWeightGrams: 25,
      diameterMm: 38,
      thicknessMm: 2.5,
      obverseImage: 'https://example.org/obv.jpg',
      reverseImage: 'https://example.org/rev.jpg',
    });
  });

  it('sends the key and explains a rejected key', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchNumista('eagle', 'k')).rejects.toThrow(/API key/);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/types?q=eagle');
    expect((init.headers as Record<string, string>)['Numista-API-Key']).toBe('k');
  });
});
