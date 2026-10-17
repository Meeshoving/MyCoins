import { describe, expect, it } from 'vitest';
import { clampCrop, sourceRect, zoomAround } from './crop';

describe('photo crop', () => {
  it('shows the centred square of a landscape photo at zoom 1', () => {
    const r = sourceRect({ zoom: 1, x: 0, y: 0 }, 400, 200, 100);
    expect(r).toEqual({ sx: 100, sy: 0, size: 200 });
  });

  it('zooming in shows a smaller part of the photo', () => {
    const r = sourceRect({ zoom: 2, x: 0, y: 0 }, 200, 200, 100);
    expect(r).toEqual({ sx: 50, sy: 50, size: 100 });
  });

  it('moving the photo right shows more of its left side', () => {
    const r = sourceRect({ zoom: 1, x: 50, y: 0 }, 400, 200, 100);
    expect(r.sx).toBe(0);
  });

  it('never lets the photo leave a gap in the viewport', () => {
    expect(clampCrop({ zoom: 1, x: 999, y: 999 }, 400, 200, 100)).toEqual({ zoom: 1, x: 50, y: 0 });
    expect(clampCrop({ zoom: 0.2, x: 0, y: 0 }, 200, 200, 100).zoom).toBe(1);
    expect(clampCrop({ zoom: 50, x: 0, y: 0 }, 200, 200, 100).zoom).toBe(6);
  });

  it('zooms around the pointer', () => {
    const s = zoomAround({ zoom: 1, x: 0, y: 0 }, 2, 20, 0);
    expect(s).toEqual({ zoom: 2, x: -20, y: 0 });
  });
});
