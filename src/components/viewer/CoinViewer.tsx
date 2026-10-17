import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Coin } from '../../domain/types';
import { drawCoinFace, type Side } from '../../lib/coinFace';
import { METAL_TONE } from '../../lib/metalStyle';
import { useSettings } from '../../hooks/useSettings';
import { cx } from '../ui/primitives';

/** World units per millimetre. */
const MM = 0.1;

function canvasTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Loads a photo as a texture, falling back to a generated face if there is none or it fails. */
function useFaceTexture(coin: Coin, side: Side): { map: THREE.Texture; bump: THREE.Texture | null } {
  const url = side === 'obverse' ? coin.obverseImage : coin.reverseImage;
  const placeholder = useMemo(() => canvasTexture(drawCoinFace(coin, side, 1024)), [coin, side]);
  const [photo, setPhoto] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    setPhoto(null);
    if (!url) return;
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (t) => {
        if (!alive) return t.dispose();
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setPhoto(t);
      },
      undefined,
      () => alive && setPhoto(null),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => () => placeholder.dispose(), [placeholder]);
  useEffect(() => () => photo?.dispose(), [photo]);

  // Placeholder doubles as a bump map, so lettering reads as raised relief.
  return photo ? { map: photo, bump: null } : { map: placeholder, bump: placeholder };
}

/** Coin body: a lathe profile with a raised rim and bevelled edges. */
function useBodyGeometry(radius: number, thickness: number) {
  return useMemo(() => {
    const h = thickness / 2;
    const bevel = Math.min(thickness * 0.35, radius * 0.04);
    const rimWidth = radius * 0.06;
    const ri = radius - rimWidth;
    const field = h - thickness * 0.12;
    const pts = [
      [0.0001, field],
      [ri, field],
      [ri, h],
      [radius - bevel, h],
      [radius, h - bevel],
      [radius, -h + bevel],
      [radius - bevel, -h],
      [ri, -h],
      [ri, -field],
      [0.0001, -field],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    // Only the rim part is drawn from the lathe; the fields are separate textured discs.
    const rimPts = pts.slice(1, -1);
    const g = new THREE.LatheGeometry(rimPts, 160);
    g.computeVertexNormals();
    return { rim: g, fieldRadius: ri, fieldY: field };
  }, [radius, thickness]);
}

function CoinMesh({ coin, side, roughness }: { coin: Coin; side: Side; roughness: number }) {
  const group = useRef<THREE.Group>(null);
  const radius = ((coin.diameterMm ?? 38) / 2) * MM;
  const thickness = (coin.thicknessMm ?? Math.max(1.8, (coin.diameterMm ?? 38) * 0.075)) * MM;
  const { rim, fieldRadius, fieldY } = useBodyGeometry(radius, thickness);
  const obv = useFaceTexture(coin, 'obverse');
  const rev = useFaceTexture(coin, 'reverse');
  const tone = METAL_TONE[coin.metal];
  const disc = useMemo(() => new THREE.CircleGeometry(fieldRadius, 128), [fieldRadius]);

  useEffect(() => () => {
    rim.dispose();
    disc.dispose();
  }, [rim, disc]);

  // Smoothly flip to the requested side.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = side === 'obverse' ? 0 : Math.PI;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 6, dt);
  });

  const common = { metalness: 1, roughness, envMapIntensity: 1.25 } as const;
  // Faces keep a little diffuse colour so the design stays readable head-on.
  const face = { metalness: 0.88, roughness: Math.min(1, roughness + 0.08), envMapIntensity: 1.35 } as const;
  return (
    <group ref={group}>
      {/* Lathe is built around Y; rotate so the faces look along Z (towards the camera). */}
      <mesh geometry={rim} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color={tone.base} {...common} />
      </mesh>
      <mesh geometry={disc} position={[0, 0, fieldY]}>
        {/* Keyed so switching between placeholder (with bump map) and photo rebuilds the shader. */}
        <meshStandardMaterial key={obv.bump ? 'drawn' : 'photo'} map={obv.map} bumpMap={obv.bump ?? undefined} bumpScale={1.5} color="#ffffff" {...face} />
      </mesh>
      <mesh geometry={disc} position={[0, 0, -fieldY]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial key={rev.bump ? 'drawn' : 'photo'} map={rev.map} bumpMap={rev.bump ?? undefined} bumpScale={1.5} color="#ffffff" {...face} />
      </mesh>
    </group>
  );
}

/** Studio lighting built from light panels, so it works offline (no HDR download). */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#2a2d33']} />
      {/* Large soft panel behind the camera so the flat faces catch light. */}
      <Lightformer form="rect" intensity={1.6} position={[0, 0.5, 8]} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={3} position={[0, 4, 4]} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={1.4} position={[5, -1, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
      <Lightformer form="ring" intensity={2.5} position={[2, 3, -4]} scale={2} />
      <Lightformer form="rect" intensity={0.6} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
    </Environment>
  );
}

export default function CoinViewer({ coin }: { coin: Coin }) {
  const { resolvedTheme } = useSettings();
  const [side, setSide] = useState<Side>('obverse');
  const [autoRotate, setAutoRotate] = useState(false);
  const [roughness, setRoughness] = useState(coin.metal === 'gold' ? 0.22 : 0.28);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="relative">
      <div
        className="aspect-square w-full overflow-hidden rounded-3xl border border-line"
        style={{
          background:
            resolvedTheme === 'dark'
              ? 'radial-gradient(circle at 50% 40%, #232831 0%, #0d0f12 70%)'
              : 'radial-gradient(circle at 50% 40%, #ffffff 0%, #e7e3da 75%)',
        }}
        role="img"
        aria-label={`3D view of ${coin.name}, ${side} side. Drag to rotate, scroll or pinch to zoom.`}
      >
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 7.6], fov: 32 }} gl={{ antialias: true, preserveDrawingBuffer: false }}>
          <Suspense fallback={null}>
            <Studio />
            <CoinMesh coin={coin} side={side} roughness={roughness} />
            <ContactShadows position={[0, -2.4, 0]} opacity={resolvedTheme === 'dark' ? 0.6 : 0.35} scale={8} blur={2.6} far={4} />
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan
            enableDamping
            minDistance={3}
            maxDistance={14}
            autoRotate={autoRotate && !reduced}
            autoRotateSpeed={1.4}
          />
        </Canvas>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Coin side" className="inline-flex rounded-full border border-line bg-surface-2 p-1">
          {(['obverse', 'reverse'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cx('h-8 rounded-full px-4 text-sm font-semibold capitalize transition', side === s ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={autoRotate}
          onClick={() => setAutoRotate((a) => !a)}
          className={cx('h-10 rounded-full border px-4 text-sm font-semibold transition', autoRotate ? 'border-gold text-gold' : 'border-line text-muted hover:text-ink')}
        >
          Auto-rotate
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Polish
          <input
            type="range"
            min={0.05}
            max={0.7}
            step={0.01}
            value={0.75 - roughness}
            onChange={(e) => setRoughness(0.75 - Number(e.target.value))}
            className="w-28 accent-[var(--gold)]"
            aria-label="Surface polish (lower roughness)"
          />
        </label>
      </div>
    </div>
  );
}
