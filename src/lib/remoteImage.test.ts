import { describe, expect, it } from 'vitest';
import { isWebUrl, proxiedUrl } from './remoteImage';

describe('remote images', () => {
  it('builds an image-service link that keeps the original address intact', () => {
    const src = 'https://en.numista.com/catalogue/photos/pays-bas/123-original.jpg?x=1&y=2';
    const u = new URL(proxiedUrl(src, 800));
    expect(u.origin).toBe('https://wsrv.nl');
    expect(u.searchParams.get('url')).toBe(src);
    expect(u.searchParams.get('w')).toBe('800');
    expect(u.searchParams.get('output')).toBe('jpg');
  });

  it('tells web links from data URLs', () => {
    expect(isWebUrl('https://x.org/a.jpg')).toBe(true);
    expect(isWebUrl('data:image/jpeg;base64,abc')).toBe(false);
  });
});
