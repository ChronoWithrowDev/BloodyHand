import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { G } from './state';

/* ---------------- quality setting ---------------- */
export type Quality = 'low' | 'medium' | 'high';
const QKEY = 'bloody-hand-quality';

export function getQuality(): Quality {
  let q: Quality | null = null;
  try { q = localStorage.getItem(QKEY) as Quality | null; } catch { /* Storage may be blocked in a preview. */ }
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  // auto: weak machines start on low
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4 ? 'low' : 'medium';
}
export function setQuality(q: Quality) {
  try { localStorage.setItem(QKEY, q); } catch { /* The setting still applies for this session. */ }
}

export const QUALITY_PRESETS: Record<Quality, {
  dpr: [number, number]; shadowMap: number; shadows: boolean; bloom: boolean;
  lightRange: number; cullRange: number; sparkMax: number; terrainSegs: number;
}> = {
  low: { dpr: [0.75, 1], shadowMap: 512, shadows: false, bloom: false, lightRange: 28, cullRange: 150, sparkMax: 60, terrainSegs: 110 },
  medium: { dpr: [1, 1.15], shadowMap: 1024, shadows: true, bloom: true, lightRange: 38, cullRange: 200, sparkMax: 100, terrainSegs: 150 },
  high: { dpr: [1, 1.5], shadowMap: 2048, shadows: true, bloom: true, lightRange: 50, cullRange: 260, sparkMax: 140, terrainSegs: 190 },
};
export let PRESET = QUALITY_PRESETS[getQuality()];
export function applyQuality(q: Quality) {
  setQuality(q);
  PRESET = QUALITY_PRESETS[q];
}

/* ---------------- distance culling ---------------- */
/** Hides its children when the player is farther than `radius` from (x,z). Checks ~4×/sec. */
export function DistanceCull({ x, z, radius, children }: { x: number; z: number; radius: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  const acc = useRef(Math.random() * 0.25);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    if (!g.current) return;
    const dx = G.pos.x - x, dz = G.pos.z - z;
    g.current.visible = dx * dx + dz * dz < radius * radius;
  });
  return <group ref={g}>{children}</group>;
}

/* ---------------- budgeted point lights ---------------- */
/** A point light that only exists (visible) when the player is within `range`. Keeps the
    active light count in the shader small, which is the single biggest GPU cost saver. */
export function CulledPointLight({
  x, y, z, range, color, intensity, distance, decay = 1.5, lightRef,
}: {
  x: number; y: number; z: number; range?: number; color: string; intensity: number;
  distance: number; decay?: number; lightRef?: (el: THREE.PointLight | null) => void;
}) {
  const ref = useRef<THREE.PointLight>(null!);
  const acc = useRef(Math.random() * 0.3);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    if (!ref.current) return;
    const r = range ?? PRESET.lightRange;
    const dx = G.pos.x - x, dz = G.pos.z - z;
    const dy = G.pos.y + 1.7 - y;
    ref.current.visible = dx * dx + dy * dy + dz * dz < r * r;
  });
  return (
    <pointLight
      ref={(el) => { ref.current = el!; lightRef?.(el); }}
      position={[x, y, z]} color={color} intensity={intensity} distance={distance} decay={decay} visible={false}
    />
  );
}
