import type { Metal } from '../domain/types';

/** Base colours per metal, used for 2D placeholders and the 3D material tint. */
export const METAL_TONE: Record<Metal, { base: string; light: string; dark: string; label: string }> = {
  silver: { base: '#c9ccd1', light: '#f4f5f7', dark: '#7d828a', label: 'Silver' },
  gold: { base: '#d9b25f', light: '#f7e3a8', dark: '#8f6a24', label: 'Gold' },
  platinum: { base: '#b9bfc6', light: '#e9edf1', dark: '#6f7780', label: 'Platinum' },
};
