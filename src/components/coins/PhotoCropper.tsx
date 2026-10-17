import { useEffect, useRef, useState } from 'react';
import { clampCrop, MAX_ZOOM, MIN_ZOOM, sourceRect, zoomAround, type CropState } from '../../lib/crop';
import { Button, Modal } from '../ui/primitives';

/** Size of the saved square photo, in pixels. */
const OUTPUT = 800;

/**
 * Lets the person drag and zoom a photo so the coin fills the circle,
 * then returns the square crop as a JPEG data URL.
 */
export function PhotoCropper({
  src,
  title,
  onCancel,
  onDone,
}: {
  src: string | null;
  title: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [viewport, setViewport] = useState(320);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    setImg(null);
    setError(null);
    setCrop({ zoom: 1, x: 0, y: 0 });
    if (!src) return;
    // Web images: ask for permission to edit first (CORS); if the site refuses, load it plainly
    // so it still shows, and explain on save if the browser blocks the edit.
    const load = (anonymous: boolean) => {
      const i = new Image();
      if (anonymous) i.crossOrigin = 'anonymous';
      i.onload = () => setImg(i);
      i.onerror = () => (anonymous ? load(false) : setError('This image could not be opened.'));
      i.src = src;
    };
    load(/^https?:/i.test(src));
  }, [src]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  const update = (next: CropState) => setCrop(clampCrop(next, w, h, viewport));
  const scale = (viewport / Math.min(w, h)) * crop.zoom;

  function local(e: { clientX: number; clientY: number }) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      update(zoomAround(crop, (pinchStart.current.zoom * dist) / pinchStart.current.dist, mid.x, mid.y));
      return;
    }
    update({ ...crop, x: crop.x + e.clientX - prev.x, y: crop.y + e.clientY - prev.y });
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    const p = local(e);
    update(zoomAround(crop, crop.zoom * Math.exp(-e.deltaY * 0.0015), p.x, p.y));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      update({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] });
    } else if (e.key === '+' || e.key === '=') update({ ...crop, zoom: crop.zoom * 1.1 });
    else if (e.key === '-') update({ ...crop, zoom: crop.zoom / 1.1 });
  }

  function save() {
    if (!img) return;
    const { sx, sy, size } = sourceRect(crop, w, h, viewport);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);
    try {
      onDone(canvas.toDataURL('image/jpeg', 0.86));
    } catch {
      setError('This image comes from a website that does not allow editing. Download it and pick it as a photo instead.');
    }
  }

  return (
    <Modal open={src != null} onClose={onCancel} title={title}>
      <p className="text-sm text-muted">Drag to move and scroll or pinch to zoom, so the coin fills the circle.</p>
      {error ? (
        <p role="alert" className="mt-4 rounded-2xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : (
        <div
          ref={boxRef}
          tabIndex={0}
          role="application"
          aria-label="Photo crop area. Arrow keys move the photo, plus and minus zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          className="relative mx-auto mt-4 aspect-square w-full max-w-sm cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-black active:cursor-grabbing"
        >
          {img && (
            <img
              src={src!}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: w * scale,
                height: h * scale,
                transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
              }}
            />
          )}
          {/* Darken everything outside the circle */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)', outline: '2px solid rgb(255 255 255 / 0.85)', outlineOffset: '-1px' }}
          />
        </div>
      )}
      {!error && (
        <label className="mx-auto mt-4 flex max-w-sm items-center gap-3 text-sm text-muted">
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(e) => update(zoomAround(crop, Number(e.target.value), 0, 0))}
            className="flex-1 accent-[var(--gold)]"
          />
        </label>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={save} disabled={!img || !!error}>
          Use photo
        </Button>
      </div>
    </Modal>
  );
}
