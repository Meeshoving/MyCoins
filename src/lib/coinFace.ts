import type { Coin } from '../domain/types';
import { METAL_TONE } from './metalStyle';

export type Side = 'obverse' | 'reverse';

function textOnArc(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, top: boolean) {
  const chars = [...text.toUpperCase()];
  // Space letters by their measured width, capped so long text never wraps past a half circle.
  const widths = chars.map((ch) => ctx.measureText(ch).width * 1.12);
  const spacing = Math.min(widths.reduce((a, b) => a + b, 0) / chars.length / r, Math.PI / Math.max(1, chars.length));
  const total = spacing * (chars.length - 1);
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + (top ? -total / 2 : total / 2);
  for (const ch of chars) {
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += top ? spacing : -spacing;
  }
}

function engrave(ctx: CanvasRenderingContext2D, draw: () => void, dark: string, light: string) {
  ctx.save();
  ctx.fillStyle = light;
  ctx.translate(-1.5, -1.5);
  draw();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = dark;
  ctx.translate(1.5, 1.5);
  draw();
  ctx.restore();
}

/**
 * Draws a placeholder coin face (name, year, country, denomination) on a square canvas.
 * Used for thumbnails and as the 3D texture when no photo is provided.
 */
export function drawCoinFace(coin: Coin, side: Side, size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tone = METAL_TONE[coin.metal];
  const c = size / 2;
  const r = size / 2;

  // Field
  const g = ctx.createRadialGradient(c * 0.7, c * 0.6, size * 0.05, c, c, r);
  g.addColorStop(0, tone.light);
  g.addColorStop(0.55, tone.base);
  g.addColorStop(1, tone.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // Fine brushed texture
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 220; i++) {
    ctx.strokeStyle = i % 2 ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(c, c, (r * i) / 220, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Rim and beaded border
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = tone.dark;
  ctx.beginPath();
  ctx.arc(c, c, r - size * 0.03, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = tone.dark;
  const beads = 90;
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c + (r - size * 0.075) * Math.cos(a), c + (r - size * 0.075) * Math.sin(a), size * 0.006, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const serif = '"Fraunces Variable", Georgia, serif';
  const sans = '"Manrope Variable", system-ui, sans-serif';
  const shadow = 'rgba(0,0,0,0.38)';
  const hi = 'rgba(255,255,255,0.55)';

  if (side === 'obverse') {
    ctx.font = `600 ${size * 0.062}px ${sans}`;
    engrave(ctx, () => textOnArc(ctx, coin.country, c, c, r * 0.72, true), shadow, hi);
    ctx.font = `500 ${size * 0.052}px ${sans}`;
    engrave(ctx, () => textOnArc(ctx, coin.mint ?? '', c, c, r * 0.72, false), shadow, hi);
    ctx.font = `600 ${size * 0.2}px ${serif}`;
    engrave(ctx, () => ctx.fillText(coin.year != null ? String(coin.year) : '—', c, c), shadow, hi);
  } else {
    ctx.font = `600 ${size * 0.13}px ${serif}`;
    engrave(ctx, () => ctx.fillText(coin.denomination, c, c - size * 0.04, size * 0.6), shadow, hi);
    ctx.font = `500 ${size * 0.05}px ${sans}`;
    engrave(ctx, () => textOnArc(ctx, coin.name, c, c, r * 0.72, true), shadow, hi);
    ctx.font = `600 ${size * 0.05}px ${sans}`;
    const fine = `${coin.metal.toUpperCase()} ${Math.round(coin.purity * 1000)}`;
    engrave(ctx, () => ctx.fillText(fine, c, c + size * 0.1), shadow, hi);
    ctx.font = `500 ${size * 0.045}px ${sans}`;
    engrave(ctx, () => textOnArc(ctx, `${coin.grossWeightGrams} g`, c, c, r * 0.72, false), shadow, hi);
  }
  return canvas;
}

const thumbCache = new Map<string, string>();

/** Data URL thumbnail, cached by the fields that affect the drawing. */
export function coinThumb(coin: Coin, side: Side = 'obverse', size = 256): string {
  const key = [side, size, coin.metal, coin.country, coin.mint, coin.year, coin.name, coin.denomination, coin.purity, coin.grossWeightGrams].join('|');
  let url = thumbCache.get(key);
  if (!url) {
    url = drawCoinFace(coin, side, size).toDataURL('image/png');
    thumbCache.set(key, url);
  }
  return url;
}
