import type { Coin, Metal } from '../domain/types';

/**
 * Numista coin catalogue (https://en.numista.com/api/).
 * Each person uses their own free API key, entered in Settings and kept in their browser.
 */
const API = 'https://api.numista.com/v3';

export interface NumistaSearchHit {
  id: number;
  title: string;
  issuer?: { name?: string };
  min_year?: number;
  max_year?: number;
  obverse_thumbnail?: string;
  reverse_thumbnail?: string;
}

interface NumistaSide {
  picture?: string;
  thumbnail?: string;
}

export interface NumistaType {
  id: number;
  url?: string;
  title: string;
  issuer?: { name?: string };
  min_year?: number;
  max_year?: number;
  value?: { text?: string };
  composition?: { text?: string };
  weight?: number;
  size?: number;
  thickness?: number;
  obverse?: NumistaSide;
  reverse?: NumistaSide;
}

async function call<T>(path: string, key: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { signal, headers: { 'Numista-API-Key': key, Accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Could not reach Numista. Check your internet connection and try again.');
  }
  if (res.status === 401 || res.status === 403) throw new Error('Numista did not accept the API key. Check it in Settings.');
  if (res.status === 429) throw new Error('Numista lookup limit reached for now. Try again later.');
  if (!res.ok) throw new Error(`Numista answered with an error (${res.status}).`);
  return (await res.json()) as T;
}

export async function searchNumista(query: string, key: string, signal?: AbortSignal): Promise<NumistaSearchHit[]> {
  const q = encodeURIComponent(query.trim());
  const data = await call<{ types?: NumistaSearchHit[] }>(`/types?q=${q}&category=coin&count=12&lang=en`, key, signal);
  return data.types ?? [];
}

export async function getNumistaType(id: number, key: string, signal?: AbortSignal): Promise<NumistaType> {
  return call<NumistaType>(`/types/${id}?lang=en`, key, signal);
}

/** "Silver (.720)" → 0.72, "Silver 925" → 0.925, "Gold (.9167)" → 0.9167. */
export function parseFineness(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const decimal = text.match(/(?:^|[^\d])(0?[.,]\d{2,4})(?!\d)/);
  if (decimal) {
    const n = Number(decimal[1].replace(',', '.'));
    if (n > 0 && n <= 1) return n;
  }
  const millesimal = text.match(/(?:^|[^\d.,])(\d{3,4})(?:\s*\/\s*1000)?(?![\d.,])/);
  if (millesimal) {
    const digits = millesimal[1];
    const n = Number(digits) / (digits.length === 4 ? 10000 : 1000);
    if (n >= 0.3 && n <= 1) return n;
  }
  return undefined;
}

export function parseMetal(text: string | undefined): Metal | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (t.includes('platinum')) return 'platinum';
  if (t.includes('gold')) return 'gold';
  if (t.includes('silver')) return 'silver';
  return undefined;
}

export function yearRange(t: { min_year?: number; max_year?: number }): string {
  if (t.min_year == null) return '';
  return t.max_year != null && t.max_year !== t.min_year ? `${t.min_year}–${t.max_year}` : String(t.min_year);
}

/** Fields of our coin record that a Numista type can fill in. */
export function coinFieldsFromNumista(t: NumistaType): Partial<Coin> {
  const out: Partial<Coin> = {
    name: t.title,
    numistaId: t.id,
    numistaUrl: t.url ?? `https://en.numista.com/catalogue/pieces${t.id}.html`,
  };
  if (t.issuer?.name) out.country = t.issuer.name;
  if (t.value?.text) out.denomination = t.value.text;
  if (t.min_year != null && t.min_year === t.max_year) out.year = t.min_year;
  const metal = parseMetal(t.composition?.text);
  if (metal) out.metal = metal;
  const purity = parseFineness(t.composition?.text);
  if (purity) out.purity = purity;
  if (t.weight) out.grossWeightGrams = t.weight;
  if (t.size) out.diameterMm = t.size;
  if (t.thickness) out.thicknessMm = t.thickness;
  if (t.obverse?.picture) out.obverseImage = t.obverse.picture;
  if (t.reverse?.picture) out.reverseImage = t.reverse.picture;
  return out;
}
