import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  G, TOWNS, RUINS, SNOW_LINE, terrainHeight, caveOpening, dayFactor, nightFactor, ruinPieces,
  type Enemy, type Projectile, type Bolt, type RuinDef,
} from './state';
import type { MobDef } from './monsters';
import { DistanceCull, PRESET } from './perf';
export { default as Caves } from './DeepCaves';

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/* ================= Terrain (hills + flattened towns) ================= */
const DAY_GROUND = new THREE.Color('#67784c');
const NIGHT_GROUND = new THREE.Color('#1c2940');

export function Terrain({ tex }: { tex: THREE.Texture }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const geo = useMemo(() => {
    // the world now spans ±400 with mountains out at the rim
    const size = 900, segs = Math.round(PRESET.terrainSegs * 1.2);
    const g = new THREE.PlaneGeometry(size, size, segs, segs);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    // Only the doorway is cut. The mountain above the underground tunnel remains whole.
    const index = g.getIndex()!;
    const triangles: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      if (!caveOpening(x, z)) triangles.push(a, b, c);
    }
    g.setIndex(triangles);
    g.computeVertexNormals();
    return g;
  }, []);

  /* Height/slope-based rock + snow blend injected into the standard shader, so
     snow stays white regardless of the day/night grass tint. */
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex, color: '#67784c', roughness: 1, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nvarying vec3 vWNormal;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(position, 1.0)).y;\nvWNormal = normalize(mat3(modelMatrix) * normal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nvarying vec3 vWNormal;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float steep = 1.0 - smoothstep(0.62, 0.9, vWNormal.y);
          float high = smoothstep(7.0, 18.0, vWorldY);
          vec3 rockCol = vec3(0.40, 0.38, 0.36) * (0.85 + 0.15 * vWNormal.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, rockCol, clamp(max(steep * 0.9, high * 0.8), 0.0, 1.0));
          float snow = smoothstep(${(SNOW_LINE - 3).toFixed(1)}, ${(SNOW_LINE + 6).toFixed(1)}, vWorldY) * smoothstep(0.3, 0.72, vWNormal.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 1.0), snow);
          float frost = smoothstep(${(SNOW_LINE + 6).toFixed(1)}, ${(SNOW_LINE + 30).toFixed(1)}, vWorldY);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.98, 1.0), frost * 0.6);
        `);
    };
    return m;
  }, [tex]);

  useFrame(() => {
    const d = dayFactor(G.time);
    material.color.copy(NIGHT_GROUND).lerp(DAY_GROUND, d);
  });

  return <mesh geometry={geo} material={material} receiveShadow ref={() => { mat.current = material; }} />;
}

/* ================= Town signposts ================= */
export function TownSigns() {
  return (
    <>
      {TOWNS.map((t) => (
        <group key={t.id} position={[t.x, 0, t.z + t.radius - 4]}>
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[0.14, 2.8, 0.14]} />
            <meshStandardMaterial color="#3a2a1c" roughness={1} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <boxGeometry args={[1.9, 0.5, 0.08]} />
            <meshStandardMaterial color="#5a4330" roughness={1} />
          </mesh>
          <mesh position={[0, 2.4, 0.045]}>
            <planeGeometry args={[1.7, 0.32]} />
            <meshStandardMaterial color="#d8c9a3" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ================= New monster models ================= */
export function GhoulBody() {
  return (
    <>
      <mesh castShadow position={[0, 0.78, 0.1]} rotation={[0.55, 0, 0]}>
        <capsuleGeometry args={[0.26, 0.7, 5, 10]} />
        <meshStandardMaterial color="#6f5f4a" roughness={0.95} />
      </mesh>
      {[0.6, 0.8, 1.0].map((y, i) => (
        <mesh key={y} position={[0, y + 0.1, -0.08 - i * 0.05]}>
          <coneGeometry args={[0.05, 0.22, 5]} />
          <meshStandardMaterial color="#3a3028" roughness={1} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.25, 0.42]}>
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshStandardMaterial color="#8a7a60" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.15, 0.62]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.12, 0.3, 6]} />
        <meshStandardMaterial color="#5a1a1a" roughness={0.9} />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 1.32, 0.62]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#e8ff5a" emissive="#c8ff2a" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.5, 0.35]} rotation={[0.9, 0, x * 0.5]} castShadow>
          <capsuleGeometry args={[0.07, 0.55, 4, 8]} />
          <meshStandardMaterial color="#5c4e3c" roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

export function WraithBody({ skinRef }: { skinRef: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  return (
    <>
      <mesh position={[0, 1.4, 0]}>
        <coneGeometry args={[0.55, 2.2, 10, 1, true]} />
        <meshStandardMaterial ref={skinRef} color="#1a1f3a" transparent opacity={0.62} side={THREE.DoubleSide} roughness={0.4} emissive="#2a3a7a" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 2.35, 0.05]}>
        <sphereGeometry args={[0.26, 14, 12]} />
        <meshStandardMaterial color="#0b0d1a" roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[0.4, 0.7, 8, 1, true]} />
        <meshStandardMaterial color="#141833" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 2.37, 0.25]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#7ad8ff" emissive="#4ac8ff" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.6, 0.2]} rotation={[0, 0, x * 0.6]}>
          <capsuleGeometry args={[0.06, 0.8, 4, 8]} />
          <meshStandardMaterial color="#1a1f3a" transparent opacity={0.7} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

export function BehemothBody() {
  return (
    <>
      <mesh castShadow position={[0, 1.9, 0]}>
        <boxGeometry args={[1.7, 1.6, 1.1]} />
        <meshStandardMaterial color="#4a3f38" roughness={0.95} />
      </mesh>
      {/* bone armor plates */}
      <mesh position={[0, 2.75, 0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[1.9, 0.3, 1.2]} />
        <meshStandardMaterial color="#c9bea0" roughness={0.9} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 2.5, 0]} rotation={[0, 0, x * 0.4]}>
          <boxGeometry args={[0.5, 0.9, 0.9]} />
          <meshStandardMaterial color="#c9bea0" roughness={0.9} />
        </mesh>
      ))}
      {/* head */}
      <mesh castShadow position={[0, 2.5, 0.65]}>
        <boxGeometry args={[0.8, 0.7, 0.7]} />
        <meshStandardMaterial color="#5a4c42" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.25, 0.95]}>
        <boxGeometry args={[0.7, 0.25, 0.3]} />
        <meshStandardMaterial color="#3a1a1a" roughness={1} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 2.6, 1.0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#ff6a1a" emissive="#ff4a00" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {/* tusks */}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 2.15, 1.05]} rotation={[-0.6, 0, x]}>
          <coneGeometry args={[0.07, 0.5, 6]} />
          <meshStandardMaterial color="#e8dcc0" roughness={0.8} />
        </mesh>
      ))}
      {/* arms */}
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 2.0, 0.1]}>
          <mesh rotation={[0.2, 0, x * 0.2]} castShadow>
            <capsuleGeometry args={[0.28, 1.2, 5, 10]} />
            <meshStandardMaterial color="#4a3f38" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.95, 0.2]} castShadow>
            <boxGeometry args={[0.55, 0.5, 0.55]} />
            <meshStandardMaterial color="#3a302a" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* legs */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.28, 0.9, 5, 10]} />
          <meshStandardMaterial color="#3a302a" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

export function SpitterBody() {
  return (
    <>
      <mesh castShadow position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.55, 14, 12]} />
        <meshStandardMaterial color="#5f6b3a" roughness={0.9} />
      </mesh>
      {/* bloated acid sacs */}
      {[[0.35, 1.1, 0.25], [-0.3, 0.8, 0.35], [0.1, 1.3, -0.3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.2 + i * 0.04, 10, 8]} />
          <meshStandardMaterial color="#b8e23a" emissive="#9adf1a" emissiveIntensity={1.2} roughness={0.3} transparent opacity={0.85} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.6, 0.25]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#6f7a46" roughness={0.9} />
      </mesh>
      {/* open maw */}
      <mesh position={[0, 1.5, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.09, 0.14, 10]} />
        <meshStandardMaterial color="#1a0a0a" roughness={1} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.68, 0.48]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#d8ff5a" emissive="#b8ff2a" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color="#4a5530" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/* ================= Projectiles (acid spit / yeti ice) & bolts ================= */
export function ProjectileView({ p }: { p: Projectile }) {
  const g = useRef<THREE.Group>(null!);
  const ice = p.kind === 'ice';
  useFrame(() => {
    if (!g.current) return;
    g.current.position.copy(p.pos);
    g.current.rotation.y += ice ? 0.12 : 0.2;
    g.current.rotation.x += ice ? 0.09 : 0;
  });
  return (
    <group ref={g}>
      {ice ? (
        <>
          <mesh castShadow>
            <dodecahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color="#dff3ff" roughness={0.25} metalness={0.1} emissive="#8fd3ff" emissiveIntensity={0.35} />
          </mesh>
          <mesh>
            <dodecahedronGeometry args={[0.7, 0]} />
            <meshBasicMaterial color="#bfe8ff" transparent opacity={0.18} toneMapped={false} depthWrite={false} />
          </mesh>
        </>
      ) : p.kind === 'rock' ? (
        <mesh castShadow>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color={p.color ?? '#7a7a78'} roughness={1} />
        </mesh>
      ) : (
        <>
          <mesh>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshBasicMaterial color={p.color ?? '#b8ff2a'} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshBasicMaterial color={p.color ?? '#6adf1a'} transparent opacity={0.35} toneMapped={false} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ================= Yeti ================= */
export function YetiBody() {
  return (
    <>
      {/* hulking shaggy torso */}
      <mesh castShadow position={[0, 1.55, 0]}>
        <capsuleGeometry args={[0.72, 1.1, 7, 14]} />
        <meshStandardMaterial color="#e9eef2" roughness={1} />
      </mesh>
      {/* fur tufts */}
      {[[0.5, 1.9, 0.35], [-0.5, 1.9, 0.35], [0.3, 1.2, 0.6], [-0.35, 1.3, 0.58], [0, 2.3, -0.5], [0.55, 1.5, -0.45], [-0.55, 1.5, -0.45]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[x * 0.4, y, z * 0.6]}>
          <coneGeometry args={[0.16, 0.5, 5]} />
          <meshStandardMaterial color="#f4f7fa" roughness={1} />
        </mesh>
      ))}
      {/* dark chest + belly skin */}
      <mesh position={[0, 1.45, 0.62]}>
        <capsuleGeometry args={[0.32, 0.6, 5, 10]} />
        <meshStandardMaterial color="#3b3a44" roughness={0.9} />
      </mesh>
      {/* head, brow, face */}
      <mesh castShadow position={[0, 2.62, 0.18]}>
        <sphereGeometry args={[0.46, 16, 14]} />
        <meshStandardMaterial color="#edf1f5" roughness={1} />
      </mesh>
      <mesh position={[0, 2.5, 0.5]}>
        <sphereGeometry args={[0.3, 14, 12]} />
        <meshStandardMaterial color="#44424c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.78, 0.5]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.62, 0.14, 0.26]} />
        <meshStandardMaterial color="#dfe5ea" roughness={1} />
      </mesh>
      {/* ice-blue eyes */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 2.6, 0.74]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#9fe0ff" emissive="#4ac8ff" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {/* open maw with tusks */}
      <mesh position={[0, 2.33, 0.66]}>
        <boxGeometry args={[0.3, 0.12, 0.2]} />
        <meshStandardMaterial color="#2a0f12" roughness={1} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={`t${x}`} position={[x, 2.36, 0.78]} rotation={[-0.3, 0, 0]}>
          <coneGeometry args={[0.03, 0.16, 5]} />
          <meshStandardMaterial color="#f2eedc" roughness={0.8} />
        </mesh>
      ))}
      {/* huge arms */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.92, 1.95, 0.1]}>
          <mesh rotation={[0.4, 0, s * 0.25]} castShadow>
            <capsuleGeometry args={[0.26, 1.3, 6, 10]} />
            <meshStandardMaterial color="#e3e9ee" roughness={1} />
          </mesh>
          <mesh position={[s * 0.1, -0.95, 0.45]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshStandardMaterial color="#3b3a44" roughness={0.9} />
          </mesh>
          {[-0.12, 0, 0.12].map((cx) => (
            <mesh key={cx} position={[s * 0.1 + cx, -1.15, 0.68]} rotation={[-0.9, 0, 0]}>
              <coneGeometry args={[0.035, 0.22, 5]} />
              <meshStandardMaterial color="#d8d2c4" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* legs */}
      {[-0.4, 0.4].map((x) => (
        <group key={x} position={[x, 0.55, 0]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.27, 0.7, 6, 10]} />
            <meshStandardMaterial color="#dfe5ea" roughness={1} />
          </mesh>
          <mesh position={[0, -0.5, 0.15]}>
            <boxGeometry args={[0.5, 0.2, 0.7]} />
            <meshStandardMaterial color="#3b3a44" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function BoltView({ b }: { b: Bolt }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!g.current) return;
    g.current.position.copy(b.pos);
    tmpV.copy(b.vel).normalize();
    tmpQ.setFromUnitVectors(UP, tmpV);
    g.current.quaternion.copy(tmpQ);
  });
  return (
    <group ref={g}>
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <coneGeometry args={[0.025, 0.1, 6]} />
        <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.006]} />
        <meshStandardMaterial color="#a02020" />
      </mesh>
    </group>
  );
}

export function enemyIsCaveDweller(e: Enemy) { return e.sunproof; }
export const nightOf = nightFactor;

/* ================= Ruins ================= */
function RuinView({ r }: { r: RuinDef }) {
  const pieces = useMemo(() => ruinPieces(r), [r]);
  const baseY = useMemo(() => terrainHeight(r.x, r.z), [r]);
  const stone = r.swamp ? '#5a6a58' : '#8a877e';
  const dark = r.swamp ? '#3a4a3a' : '#5a574f';
  return (
    <group>
      {/* cracked flagstone floor + moss / bog ring */}
      <mesh position={[r.x, baseY + 0.03, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r.r * 0.95, 28]} />
        <meshStandardMaterial color={r.swamp ? '#4a5a44' : '#6e6a60'} roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {r.swamp && (
        <mesh position={[r.x, baseY + 0.02, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r.r * 0.95, r.r + 8, 32]} />
          <meshStandardMaterial color="#2a3a2c" roughness={0.3} metalness={0.2} transparent opacity={0.85} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      )}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2 + r.rot, d = r.r * (0.2 + ((i * 7) % 5) * 0.14);
        return (
          <mesh key={`fl${i}`} position={[r.x + Math.cos(a) * d, baseY + 0.05, r.z + Math.sin(a) * d]} rotation={[-Math.PI / 2, 0, a]}>
            <planeGeometry args={[1.6 + (i % 3) * 0.5, 1.2 + (i % 2) * 0.6]} />
            <meshStandardMaterial color={dark} roughness={1} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        );
      })}
      {pieces.map((p, i) => {
        const y = baseY;
        if (p.kind === 'column' || p.kind === 'stump') {
          return (
            <group key={i} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[p.w * 0.85, p.w * 0.95, 0.5, 10]} />
                <meshStandardMaterial color={dark} roughness={1} />
              </mesh>
              <mesh position={[0, 0.5 + p.h / 2, 0]} rotation={[p.kind === 'stump' ? (i % 2 ? 0.08 : -0.06) : 0, 0, p.kind === 'stump' ? 0.05 : 0]} castShadow>
                <cylinderGeometry args={[p.w * 0.55, p.w * 0.65, p.h, 12]} />
                <meshStandardMaterial color={stone} roughness={0.95} />
              </mesh>
              {Array.from({ length: 8 }).map((_, f) => (
                <mesh key={f} position={[Math.cos((f / 8) * 6.283) * p.w * 0.6, 0.5 + p.h / 2, Math.sin((f / 8) * 6.283) * p.w * 0.6]} rotation={[0, -(f / 8) * 6.283, 0]}>
                  <boxGeometry args={[0.08, p.h * 0.96, 0.14]} />
                  <meshStandardMaterial color={dark} roughness={1} />
                </mesh>
              ))}
              {p.kind === 'column' && (
                <mesh position={[0, 0.5 + p.h + 0.25, 0]} castShadow>
                  <boxGeometry args={[p.w * 1.8, 0.5, p.w * 1.8]} />
                  <meshStandardMaterial color={stone} roughness={0.95} />
                </mesh>
              )}
              {r.swamp && (
                <mesh position={[0, 0.5 + Math.min(p.h, 2.5) / 2, 0]}>
                  <cylinderGeometry args={[p.w * 0.6, p.w * 0.72, Math.min(p.h, 2.5), 10, 1, true]} />
                  <meshStandardMaterial color="#3e5a30" roughness={1} transparent opacity={0.75} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          );
        }
        if (p.kind === 'wall') {
          return (
            <group key={i} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              <mesh position={[0, p.h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[p.w, p.h, 0.7]} />
                <meshStandardMaterial color={stone} roughness={1} />
              </mesh>
              {/* jagged top */}
              {[-0.35, -0.1, 0.2, 0.4].map((f, k) => (
                <mesh key={k} position={[f * p.w, p.h + 0.3 + (k % 2) * 0.4, 0]} castShadow>
                  <boxGeometry args={[p.w * 0.18, 0.6 + (k % 2) * 0.8, 0.72]} />
                  <meshStandardMaterial color={stone} roughness={1} />
                </mesh>
              ))}
              <mesh position={[p.w * 0.1, p.h * 0.5, 0.36]}>
                <planeGeometry args={[p.w * 0.5, p.h * 0.6]} />
                <meshStandardMaterial color={dark} roughness={1} transparent opacity={0.5} />
              </mesh>
            </group>
          );
        }
        if (p.kind === 'arch') {
          return (
            <group key={i} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * p.w / 2, p.h / 2, 0]} castShadow>
                  <boxGeometry args={[1.0, p.h, 1.0]} />
                  <meshStandardMaterial color={stone} roughness={1} />
                </mesh>
              ))}
              <mesh position={[0, p.h, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[p.w / 2, 0.5, 8, 16, Math.PI]} />
                <meshStandardMaterial color={stone} roughness={1} />
              </mesh>
              <mesh position={[0, p.h + p.w / 2 + 0.3, 0]} castShadow>
                <boxGeometry args={[1.2, 0.8, 1.1]} />
                <meshStandardMaterial color={dark} roughness={1} />
              </mesh>
            </group>
          );
        }
        if (p.kind === 'altar') {
          return (
            <group key={i} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[p.w, p.w + 0.6, 0.6, 8]} />
                <meshStandardMaterial color={dark} roughness={1} />
              </mesh>
              <mesh position={[0, 0.6 + p.h / 2, 0]} castShadow>
                <boxGeometry args={[p.w * 0.9, p.h, p.w * 0.6]} />
                <meshStandardMaterial color={stone} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.6 + p.h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 0.9, 24]} />
                <meshStandardMaterial color="#5a1a1a" roughness={1} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        }
        // statue: hooded figure, head missing
        return (
          <group key={i} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[1.4, 0.8, 1.4]} />
              <meshStandardMaterial color={dark} roughness={1} />
            </mesh>
            <mesh position={[0, 0.8 + p.h / 2, 0]} castShadow>
              <coneGeometry args={[0.6, p.h, 8]} />
              <meshStandardMaterial color={stone} roughness={1} />
            </mesh>
            <mesh position={[0, 0.8 + p.h * 0.55, 0.42]} rotation={[0.9, 0, 0]}>
              <capsuleGeometry args={[0.12, 0.7, 4, 8]} />
              <meshStandardMaterial color={stone} roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Ruins() {
  return (
    <>
      {RUINS.map((r) => (
        <DistanceCull key={r.id} x={r.x} z={r.z} radius={PRESET.cullRange + r.r}>
          <RuinView r={r} />
        </DistanceCull>
      ))}
    </>
  );
}

/* ================= Procedural monster bodies ================= */
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; ei?: number } = {}) {
  const key = `${color}|${opts.rough ?? 0.9}|${opts.metal ?? 0}|${opts.emissive ?? ''}|${opts.ei ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.ei ?? 0,
      toneMapped: !opts.emissive,
    });
    matCache.set(key, m);
  }
  return m;
}

function Eyes({ m, y, z, spread, r }: { m: MobDef; y: number; z: number; spread: number; r: number }) {
  const eyeMat = mat(m.eye, { emissive: m.eye, ei: 3.2, rough: 0.3 });
  const pos: [number, number, number][] =
    m.eyes === 1 ? [[0, y, z]]
    : m.eyes === 2 ? [[-spread, y, z], [spread, y, z]]
    : m.eyes === 3 ? [[-spread, y, z], [spread, y, z], [0, y + spread * 0.9, z]]
    : m.eyes === 4 ? [[-spread, y, z], [spread, y, z], [-spread * 0.5, y + spread * 0.8, z], [spread * 0.5, y + spread * 0.8, z]]
    : [[-spread, y, z], [spread, y, z], [-spread * 1.6, y + spread * 0.5, z - 0.02], [spread * 1.6, y + spread * 0.5, z - 0.02], [-spread * 0.5, y + spread * 0.9, z], [spread * 0.5, y + spread * 0.9, z]];
  return (
    <>
      {pos.map((p, i) => (
        <mesh key={i} position={p} material={eyeMat}>
          <sphereGeometry args={[m.eyes === 1 ? r * 1.8 : r, 8, 8]} />
        </mesh>
      ))}
    </>
  );
}

export function MobBody({ m, skinRef }: { m: MobDef; skinRef?: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const skin = useMemo(() => new THREE.MeshStandardMaterial({
    color: m.skin, roughness: m.armor ? 0.45 : 0.9, metalness: m.armor ? 0.5 : 0,
    emissive: m.glow ? m.accent : '#000000', emissiveIntensity: m.glow ? 0.9 : 0,
  }), [m]);
  useEffect(() => { if (skinRef) (skinRef as React.MutableRefObject<THREE.MeshStandardMaterial | null>).current = skin; }, [skin, skinRef]);
  const acc = mat(m.accent, { rough: m.armor ? 0.4 : 0.85, metal: m.armor ? 0.6 : 0 });
  const dark = mat('#141216');
  const bone = mat('#d8d2c0');
  const s = m.scale;

  const horns = m.horns && (
    <>
      <mesh position={[-0.16 * s, 0, 0]} rotation={[0.2, 0, 0.7]} material={bone}><coneGeometry args={[0.06 * s, 0.4 * s, 6]} /></mesh>
      <mesh position={[0.16 * s, 0, 0]} rotation={[0.2, 0, -0.7]} material={bone}><coneGeometry args={[0.06 * s, 0.4 * s, 6]} /></mesh>
    </>
  );
  const wings = m.wings && (
    <>
      {[-1, 1].map((d) => (
        <group key={d} position={[d * 0.3 * s, 0, -0.1 * s]} rotation={[0, 0, d * 0.5]}>
          <mesh position={[d * 0.55 * s, 0.1 * s, 0]} rotation={[0, 0, d * 0.2]} material={acc}>
            <boxGeometry args={[1.1 * s, 0.05 * s, 0.6 * s]} />
          </mesh>
          <mesh position={[d * 0.3 * s, 0.1 * s, 0.05 * s]} rotation={[0, 0, d * 0.1]} material={dark}>
            <cylinderGeometry args={[0.03 * s, 0.03 * s, 1.1 * s, 5]} />
          </mesh>
        </group>
      ))}
    </>
  );
  const spikes = m.spikes && (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.15 * s, (-0.25 + i * 0.16) * s]} rotation={[-0.6, 0, 0]} material={bone}>
          <coneGeometry args={[0.05 * s, 0.3 * s, 5]} />
        </mesh>
      ))}
    </>
  );

  switch (m.body) {
    case 'quad':
      return (
        <group>
          <mesh castShadow position={[0, 0.7 * s, 0]} rotation={[Math.PI / 2, 0, 0]} material={skin}>
            <capsuleGeometry args={[0.32 * s, 0.9 * s, 6, 10]} />
          </mesh>
          <mesh position={[0, 0.6 * s, 0.1 * s]} rotation={[Math.PI / 2, 0, 0]} material={acc}>
            <capsuleGeometry args={[0.2 * s, 0.8 * s, 4, 8]} />
          </mesh>
          <group position={[0, 0.95 * s, 0.6 * s]}>
            <mesh castShadow material={skin}><sphereGeometry args={[0.26 * s, 12, 10]} /></mesh>
            <mesh position={[0, -0.08 * s, 0.26 * s]} material={dark}><boxGeometry args={[0.22 * s, 0.12 * s, 0.26 * s]} /></mesh>
            {[-0.06, 0, 0.06].map((x) => <mesh key={x} position={[x * s, -0.16 * s, 0.34 * s]} rotation={[0.3, 0, 0]} material={bone}><coneGeometry args={[0.02 * s, 0.08 * s, 4]} /></mesh>)}
            <Eyes m={m} y={0.06 * s} z={0.22 * s} spread={0.1 * s} r={0.045 * s} />
            <group position={[0, 0.2 * s, -0.05 * s]}>{horns}</group>
            {[-1, 1].map((d) => <mesh key={d} position={[d * 0.18 * s, 0.22 * s, -0.05 * s]} rotation={[0, 0, d * 0.4]} material={skin}><coneGeometry args={[0.06 * s, 0.18 * s, 5]} /></mesh>)}
          </group>
          {[[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]].map(([x, z], i) => (
            <group key={i} position={[x * s, 0.45 * s, z * s]}>
              <mesh castShadow position={[0, -0.2 * s, 0]} material={skin}><capsuleGeometry args={[0.08 * s, 0.4 * s, 4, 8]} /></mesh>
              {m.claws && <mesh position={[0, -0.46 * s, 0.08 * s]} rotation={[-1.2, 0, 0]} material={bone}><coneGeometry args={[0.03 * s, 0.14 * s, 4]} /></mesh>}
            </group>
          ))}
          {m.tail && <mesh position={[0, 0.75 * s, -0.75 * s]} rotation={[0.6, 0, 0]} material={acc}><coneGeometry args={[0.07 * s, 0.7 * s, 6]} /></mesh>}
          <group position={[0, 0.95 * s, -0.1 * s]}>{spikes}</group>
          <group position={[0, 0.95 * s, -0.2 * s]}>{wings}</group>
        </group>
      );
    case 'insect':
      return (
        <group>
          <mesh castShadow position={[0, 0.45 * s, -0.1 * s]} material={skin}><sphereGeometry args={[0.42 * s, 12, 10]} /></mesh>
          <mesh castShadow position={[0, 0.5 * s, 0.4 * s]} material={acc}><sphereGeometry args={[0.26 * s, 10, 8]} /></mesh>
          <mesh position={[0, 0.5 * s, 0.68 * s]} material={skin}><sphereGeometry args={[0.16 * s, 10, 8]} /></mesh>
          <Eyes m={m} y={0.55 * s} z={0.8 * s} spread={0.07 * s} r={0.035 * s} />
          {[-1, 1].map((d) => <mesh key={d} position={[d * 0.1 * s, 0.42 * s, 0.82 * s]} rotation={[0.5, 0, d * 0.6]} material={dark}><coneGeometry args={[0.03 * s, 0.2 * s, 4]} /></mesh>)}
          {[0, 1, 2].map((i) => [-1, 1].map((d) => (
            <group key={`${i}${d}`} position={[d * 0.35 * s, 0.4 * s, (0.25 - i * 0.28) * s]} rotation={[0, 0, d * 0.9]}>
              <mesh material={dark}><capsuleGeometry args={[0.035 * s, 0.6 * s, 3, 6]} /></mesh>
              <mesh position={[d * 0.3 * s, -0.42 * s, 0]} rotation={[0, 0, -d * 1.3]} material={dark}><capsuleGeometry args={[0.03 * s, 0.5 * s, 3, 6]} /></mesh>
            </group>
          )))}
          {m.armor && [0, 1, 2].map((i) => <mesh key={i} position={[0, (0.78 - i * 0.06) * s, (-0.25 + i * 0.1) * s]} rotation={[-0.3 + i * 0.15, 0, 0]} material={acc}><boxGeometry args={[0.7 * s, 0.06 * s, 0.3 * s]} /></mesh>)}
          <group position={[0, 0.7 * s, 0]}>{wings}</group>
          <group position={[0, 0.75 * s, -0.2 * s]}>{spikes}</group>
        </group>
      );
    case 'floater':
      return (
        <group position={[0, 1.4 * s, 0]}>
          <mesh castShadow material={skin}><sphereGeometry args={[0.45 * s, 14, 12]} /></mesh>
          <mesh position={[0, -0.3 * s, 0]} rotation={[Math.PI, 0, 0]} material={acc}><coneGeometry args={[0.35 * s, 0.9 * s, 10, 1, true]} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return <mesh key={i} position={[Math.cos(a) * 0.25 * s, -0.75 * s, Math.sin(a) * 0.25 * s]} rotation={[0.2, 0, Math.cos(a) * 0.3]} material={acc}><coneGeometry args={[0.05 * s, 0.6 * s, 5]} /></mesh>;
          })}
          <Eyes m={m} y={0.05 * s} z={0.4 * s} spread={0.14 * s} r={0.06 * s} />
          <mesh position={[0, -0.14 * s, 0.4 * s]} material={dark}><boxGeometry args={[0.24 * s, 0.08 * s, 0.1 * s]} /></mesh>
          <group position={[0, 0.3 * s, 0]}>{horns}</group>
          <group position={[0, 0.1 * s, -0.2 * s]}>{wings}</group>
          <group position={[0, 0.3 * s, -0.1 * s]}>{spikes}</group>
        </group>
      );
    case 'serpent':
      return (
        <group>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} castShadow position={[Math.sin(i * 0.9) * 0.25 * s, (0.3 + (i === 0 ? 0.5 : 0)) * s + Math.max(0, 0.6 - i * 0.15) * s, (0.5 - i * 0.45) * s]} material={i % 2 ? acc : skin}>
              <sphereGeometry args={[(0.3 - i * 0.03) * s, 10, 8]} />
            </mesh>
          ))}
          <group position={[0, 0.95 * s, 0.75 * s]}>
            <mesh castShadow material={skin}><sphereGeometry args={[0.3 * s, 12, 10]} /></mesh>
            <mesh position={[0, -0.06 * s, 0.26 * s]} rotation={[0.4, 0, 0]} material={dark}><coneGeometry args={[0.18 * s, 0.3 * s, 8]} /></mesh>
            {[-0.08, 0.08].map((x) => <mesh key={x} position={[x * s, -0.1 * s, 0.4 * s]} rotation={[0.8, 0, 0]} material={bone}><coneGeometry args={[0.025 * s, 0.14 * s, 4]} /></mesh>)}
            <Eyes m={m} y={0.08 * s} z={0.25 * s} spread={0.11 * s} r={0.05 * s} />
            <group position={[0, 0.25 * s, 0]}>{horns}</group>
            <group position={[0, 0.1 * s, -0.1 * s]}>{wings}</group>
          </group>
          <group position={[0, 0.9 * s, 0.2 * s]}>{spikes}</group>
        </group>
      );
    case 'blob':
      return (
        <group>
          <mesh castShadow position={[0, 0.65 * s, 0]} scale={[1.15, 0.9, 1.05]} material={skin}><sphereGeometry args={[0.62 * s, 14, 12]} /></mesh>
          {[[0.35, 0.8, 0.3], [-0.3, 0.55, 0.4], [0.1, 1.0, -0.3], [-0.4, 0.9, -0.2]].map(([x, y, z], i) => (
            <mesh key={i} position={[x * s, y * s, z * s]} material={acc}><sphereGeometry args={[(0.16 + (i % 2) * 0.06) * s, 10, 8]} /></mesh>
          ))}
          <mesh position={[0, 0.5 * s, 0.6 * s]} rotation={[Math.PI / 2, 0, 0]} material={dark}><cylinderGeometry args={[0.2 * s, 0.14 * s, 0.14 * s, 10]} /></mesh>
          {[-0.1, 0, 0.1].map((x) => <mesh key={x} position={[x * s, 0.6 * s, 0.68 * s]} rotation={[0.5, 0, 0]} material={bone}><coneGeometry args={[0.025 * s, 0.1 * s, 4]} /></mesh>)}
          <Eyes m={m} y={0.8 * s} z={0.56 * s} spread={0.14 * s} r={0.055 * s} />
          {[-1, 1].map((d) => <mesh key={d} position={[d * 0.55 * s, 0.3 * s, 0.1 * s]} rotation={[0.4, 0, d * 0.8]} material={skin}><capsuleGeometry args={[0.1 * s, 0.4 * s, 4, 8]} /></mesh>)}
          <group position={[0, 1.1 * s, -0.1 * s]}>{spikes}</group>
          <group position={[0, 1.15 * s, 0]}>{horns}</group>
        </group>
      );
    case 'colossus':
      return (
        <group>
          {/* stacked boulder body */}
          <mesh castShadow position={[0, 2.0 * s * 0.55, 0]} material={skin}><dodecahedronGeometry args={[0.62 * s, 1]} /></mesh>
          <mesh castShadow position={[0, 2.6 * s * 0.55, 0.05 * s]} material={skin}><dodecahedronGeometry args={[0.5 * s, 1]} /></mesh>
          <mesh castShadow position={[0, 1.4 * s * 0.55, 0]} material={acc}><dodecahedronGeometry args={[0.46 * s, 0]} /></mesh>
          {/* glowing cracks */}
          {[[0.3, 1.2, 0.5], [-0.35, 1.0, 0.45], [0.1, 1.5, -0.55], [-0.2, 0.8, 0.5]].map(([x, y, z], i) => (
            <mesh key={i} position={[x * s, y * s, z * s]} rotation={[0, i, 0.4]} material={mat(m.eye, { emissive: m.eye, ei: 2.2 })}>
              <boxGeometry args={[0.05 * s, 0.4 * s, 0.05 * s]} />
            </mesh>
          ))}
          {/* head */}
          <group position={[0, 1.78 * s, 0.1 * s]}>
            <mesh castShadow material={skin}><dodecahedronGeometry args={[0.3 * s, 1]} /></mesh>
            <Eyes m={m} y={0.02 * s} z={0.25 * s} spread={0.12 * s} r={0.06 * s} />
            <mesh position={[0, -0.14 * s, 0.26 * s]} material={dark}><boxGeometry args={[0.22 * s, 0.06 * s, 0.08 * s]} /></mesh>
            <group position={[0, 0.25 * s, 0]}>{horns}</group>
          </group>
          {/* arms of boulders */}
          {[-1, 1].map((d) => (
            <group key={d} position={[d * 0.82 * s, 1.35 * s, 0.05 * s]}>
              <mesh castShadow material={skin}><dodecahedronGeometry args={[0.3 * s, 0]} /></mesh>
              <mesh castShadow position={[d * 0.1 * s, -0.55 * s, 0.1 * s]} material={acc}><dodecahedronGeometry args={[0.26 * s, 0]} /></mesh>
              <mesh castShadow position={[d * 0.15 * s, -1.05 * s, 0.2 * s]} material={skin}><dodecahedronGeometry args={[0.36 * s, 0]} /></mesh>
            </group>
          ))}
          {/* legs */}
          {[-0.35, 0.35].map((x) => (
            <group key={x} position={[x * s, 0.45 * s, 0]}>
              <mesh castShadow material={acc}><dodecahedronGeometry args={[0.3 * s, 0]} /></mesh>
              <mesh castShadow position={[0, -0.35 * s, 0.08 * s]} material={skin}><boxGeometry args={[0.45 * s, 0.3 * s, 0.6 * s]} /></mesh>
            </group>
          ))}
          <group position={[0, 1.95 * s, -0.3 * s]}>{spikes}</group>
        </group>
      );
    default: // biped
      return (
        <group>
          <mesh castShadow position={[0, 1.05 * s, 0]} material={skin}><capsuleGeometry args={[0.28 * s, 0.6 * s, 6, 10]} /></mesh>
          <mesh position={[0, 1.0 * s, 0.2 * s]} material={acc}><boxGeometry args={[0.3 * s, 0.5 * s, 0.14 * s]} /></mesh>
          {m.armor && <mesh position={[0, 1.4 * s, 0]} material={acc}><boxGeometry args={[0.72 * s, 0.14 * s, 0.5 * s]} /></mesh>}
          <group position={[0, 1.7 * s, 0.02 * s]}>
            <mesh castShadow material={skin}><sphereGeometry args={[0.24 * s, 12, 10]} /></mesh>
            <mesh position={[0, -0.1 * s, 0.17 * s]} material={dark}><boxGeometry args={[0.16 * s, 0.07 * s, 0.1 * s]} /></mesh>
            <Eyes m={m} y={0.04 * s} z={0.2 * s} spread={0.09 * s} r={0.045 * s} />
            <group position={[0, 0.2 * s, 0]}>{horns}</group>
          </group>
          {[-1, 1].map((d) => (
            <group key={d} position={[d * 0.36 * s, 1.3 * s, 0]}>
              <mesh castShadow position={[0, -0.3 * s, 0.1 * s]} rotation={[-0.5, 0, d * 0.1]} material={skin}><capsuleGeometry args={[0.08 * s, 0.55 * s, 4, 8]} /></mesh>
              {m.claws && [-0.05, 0, 0.05].map((cx) => (
                <mesh key={cx} position={[cx * s + d * 0.02 * s, -0.6 * s, 0.42 * s]} rotation={[-1.4, 0, 0]} material={bone}><coneGeometry args={[0.02 * s, 0.22 * s, 4]} /></mesh>
              ))}
            </group>
          ))}
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} castShadow position={[x * s, 0.4 * s, 0]} material={acc}><capsuleGeometry args={[0.09 * s, 0.5 * s, 4, 8]} /></mesh>
          ))}
          {m.tail && <mesh position={[0, 0.7 * s, -0.4 * s]} rotation={[1.0, 0, 0]} material={acc}><coneGeometry args={[0.06 * s, 0.6 * s, 6]} /></mesh>}
          <group position={[0, 1.45 * s, -0.25 * s]}>{wings}</group>
          <group position={[0, 1.5 * s, -0.15 * s]}>{spikes}</group>
        </group>
      );
  }
}
