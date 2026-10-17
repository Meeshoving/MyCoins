import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Coin } from '../../domain/types';
import { coinThumb } from '../../lib/coinFace';
import type { Side } from '../../lib/coinFace';
import { METAL_TONE } from '../../lib/metalStyle';

/**
 * A coin built from plain page elements turned in 3D with CSS.
 * Used when a photo comes from a website (like Numista) that lets pages show its images
 * but not hand them to the WebGL viewer. Pages may always *show* such images, so this works.
 */

const EDGE_SEGMENTS = 72;

/** Shortest-way target angle (degrees) for showing `side`, starting from `current`. */
export function targetAngle(current: number, side: Side): number {
  const base = side === 'obverse' ? 0 : 180;
  return base + Math.round((current - base) / 360) * 360;
}

export function PhotoCoin({
  coin,
  side,
  autoRotate,
  polish,
}: {
  coin: Coin;
  side: Side;
  autoRotate: boolean;
  /** 0 = matte, 1 = mirror-like sheen. */
  polish: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(400);
  const [rot, setRot] = useState({ x: -8, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const target = useRef<number | null>(0);
  const rotRef = useRef(rot);
  rotRef.current = rot;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Turning to the chosen side.
  useEffect(() => {
    target.current = targetAngle(rotRef.current.y, side);
  }, [side]);

  // One animation loop for side flips and auto-rotate.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!drag.current) {
        setRot((r) => {
          if (autoRotate) return { x: r.x + (-8 - r.x) * Math.min(1, dt * 3), y: r.y + dt * 40 };
          const t = target.current;
          if (t == null) return r;
          const k = Math.min(1, dt * 6);
          const y = r.y + (t - r.y) * k;
          if (Math.abs(t - y) < 0.05) target.current = null;
          return { x: r.x + (-8 - r.x) * k, y };
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  const size = box * 0.66 * zoom;
  const diameter = coin.diameterMm ?? 38;
  const thick = Math.max(3, size * ((coin.thicknessMm ?? Math.max(1.8, diameter * 0.075)) / diameter));
  const tone = METAL_TONE[coin.metal];

  const faces = useMemo(
    () => ({
      obverse: coin.obverseImage || coinThumb(coin, 'obverse', 512),
      reverse: coin.reverseImage || coinThumb(coin, 'reverse', 512),
    }),
    [coin],
  );

  // Light comes from the upper left; the sheen slides across as the coin turns.
  const sheenShift = ((((rot.y % 360) + 360) % 360) / 360) * 200 - 50;
  const face = (which: Side): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    transform: which === 'obverse' ? `translateZ(${thick / 2}px)` : `rotateY(180deg) translateZ(${thick / 2}px)`,
    background: tone.base,
    boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.006)}px rgba(255,255,255,.25)`,
  });

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full touch-none select-none"
      style={{ perspective: `${box * 2.4}px`, cursor: drag.current ? 'grabbing' : 'grab' }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
        target.current = null;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setRot({ x: Math.max(-60, Math.min(60, d.rx - (e.clientY - d.y) * 0.4)), y: d.ry + (e.clientX - d.x) * 0.5 });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onWheel={(e) => setZoom((z) => Math.max(0.6, Math.min(1.4, z * (e.deltaY > 0 ? 0.94 : 1.06))))}
    >
      {/* Soft shadow on the "table" */}
      <div
        aria-hidden
        className="absolute left-1/2 rounded-[50%] bg-black/40 blur-xl"
        style={{ width: size * 0.8, height: size * 0.12, top: box / 2 + size * 0.55, transform: 'translateX(-50%)' }}
      />
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        }}
      >
        {/* Edge: thin strips around the rim, shaded by their angle to the light. */}
        {Array.from({ length: EDGE_SEGMENTS }, (_, i) => {
          const a = (i / EDGE_SEGMENTS) * 360;
          const light = 0.55 + 0.45 * Math.cos(((a - 135) * Math.PI) / 180);
          const seg = (Math.PI * size) / EDGE_SEGMENTS + 1;
          return (
            <div
              key={i}
              aria-hidden
              style={{
                position: 'absolute',
                left: size / 2 - seg / 2,
                top: size / 2 - thick / 2,
                width: seg,
                height: thick,
                transform: `rotateZ(${a}deg) translateY(${-size / 2}px) rotateX(90deg)`,
                background: `repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px), ${tone.base}`,
                filter: `brightness(${light.toFixed(3)})`,
              }}
            />
          );
        })}
        {(['obverse', 'reverse'] as const).map((s) => (
          <div key={s} style={face(s)}>
            <img src={faces[s]} alt="" draggable={false} className="h-full w-full object-cover" style={{ transform: 'scale(1.01)' }} />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'soft-light',
                opacity: 0.25 + polish * 0.65,
                background: `linear-gradient(115deg, transparent ${sheenShift - 30}%, rgba(255,255,255,.95) ${sheenShift}%, transparent ${sheenShift + 30}%), radial-gradient(circle at 30% 25%, rgba(255,255,255,.6), transparent 55%)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
