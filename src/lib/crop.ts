/**
 * Maths for the photo cropper. The photo is shown in a square viewport,
 * scaled to cover it, then zoomed and moved by the person.
 */
export interface CropState {
  /** 1 = photo just covers the viewport. */
  zoom: number;
  /** Offset of the photo's centre from the viewport centre, in viewport pixels. */
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/** Scale from photo pixels to viewport pixels. */
export function scaleFor(imgW: number, imgH: number, viewport: number, zoom: number): number {
  return (viewport / Math.min(imgW, imgH)) * zoom;
}

/** Keeps the zoom in range and the photo covering the whole viewport. */
export function clampCrop(s: CropState, imgW: number, imgH: number, viewport: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom));
  const scale = scaleFor(imgW, imgH, viewport, zoom);
  const maxX = Math.max(0, (imgW * scale - viewport) / 2);
  const maxY = Math.max(0, (imgH * scale - viewport) / 2);
  return { zoom, x: Math.min(maxX, Math.max(-maxX, s.x)), y: Math.min(maxY, Math.max(-maxY, s.y)) };
}

/** The square of the photo (in photo pixels) that is visible in the viewport. */
export function sourceRect(s: CropState, imgW: number, imgH: number, viewport: number) {
  const scale = scaleFor(imgW, imgH, viewport, s.zoom);
  const size = viewport / scale;
  return {
    sx: imgW / 2 - (viewport / 2 + s.x) / scale,
    sy: imgH / 2 - (viewport / 2 + s.y) / scale,
    size,
  };
}

/** Zoom around a point (in viewport pixels from the viewport centre) so that point stays put. */
export function zoomAround(s: CropState, nextZoom: number, px: number, py: number): CropState {
  const k = nextZoom / s.zoom;
  return { zoom: nextZoom, x: px - (px - s.x) * k, y: py - (py - s.y) * k };
}
