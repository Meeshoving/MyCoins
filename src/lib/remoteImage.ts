/**
 * Images from other websites (like Numista's photos) can be shown in a page, but the
 * 3D view and the cropper may only read their pixels when that website allows it (CORS).
 * When it doesn't, we fetch the image through wsrv.nl, a free public image service
 * that does allow it.
 */

const PROXY = 'https://wsrv.nl/';

export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

/** The same image, served through the image service, at most `size` pixels wide/high. */
export function proxiedUrl(url: string, size = 1024): string {
  const params = new URLSearchParams({ url, w: String(size), h: String(size), fit: 'inside', output: 'jpg', bg: 'white', we: '' });
  return `${PROXY}?${params}`;
}

function load(src: string, anonymous: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (anonymous) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be loaded.'));
    img.src = src;
  });
}

/**
 * Loads an image whose pixels we can read (for 3D textures and cropping).
 * Data URLs load directly; web images try the website first, then the image service.
 */
export async function loadReadableImage(src: string): Promise<HTMLImageElement> {
  if (!isWebUrl(src) || src.startsWith(PROXY)) return load(src, isWebUrl(src));
  try {
    return await load(src, true);
  } catch {
    return load(proxiedUrl(src), true);
  }
}

/**
 * Copies a web image into a square JPEG data URL (centre crop, at most `max` px),
 * so it's saved with the coin and works offline and in 3D.
 */
export async function webImageToDataUrl(src: string, max = 800): Promise<string> {
  const img = await loadReadableImage(src);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const out = Math.min(max, side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
  return canvas.toDataURL('image/jpeg', 0.84);
}
