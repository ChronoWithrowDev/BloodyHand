import { useRef, useMemo, useReducer, useEffect, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DistanceCull, CulledPointLight, PRESET } from './perf';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  G, WEAPONS, HOUSES, GRAVEYARDS, TOWNS, CAVES, dayFactor, nightFactor, sunHeight,
  spawnEnemy, spawnSkyEye, spawnPickup, maxEnemiesForNight, maxSkyEyes, spawnYeti, isSnowy,
  randomNightEnemy, refreshChestRespawns, saveWorld, terrainHeight, surfaceHeight, caveAt, caveLocal, caveFloorHeight, lavaAt, populateCave,
  spawnNightMob, spawnMobAt, ruinAt, populateRuin,
  addLog, damageEnemy, explode, hurtPlayer, collideCircle, pointBlocked,
  type Enemy, type Ally, type Pickup, type Chest, type GraveyardDef,
} from './state';
import { MOB_BY_ID, mobHitHeight, mobHitRadius } from './monsters';
import { GunModel, MUZZLE, VM_OFFSET, ADS_OFFSET, ADS_FOV, SCOPED, setMinigunHeat } from './guns';
import {
  Terrain, Caves, Ruins, TownSigns, GhoulBody, WraithBody, BehemothBody, SpitterBody, YetiBody, MobBody,
  ProjectileView, BoltView,
} from './World';
import {
  playGun, playRocketLaunch, playClick, playStep, playLand, playPickup,
  playCharge, playLaser, playNightBell, updateMinigun, updateAmbience,
} from './audio';

/* ================= helpers ================= */
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();

const DAY_SKY = new THREE.Color('#8ec5f0');
const NIGHT_SKY = new THREE.Color('#101a33');
const DAY_FOG = new THREE.Color('#bcd8ef');
const NIGHT_FOG = new THREE.Color('#111c33');

function playerForward(out: THREE.Vector3) {
  return out.set(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
}
const TRACER_COLORS: Record<string, string> = {
  pistol: '#ffe6a8', shotgun: '#ffcf7a', smg: '#d8f7ff', ak47: '#ffc46b',
  m16a4: '#bfe3ff', m16a6: '#9db8ff', minigun: '#ff9a3c', bazooka: '#ffd27a', rpg: '#ff7a5a',
};

/* ================= Sky & light ================= */
function SkyAndLight() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const amb = useRef<THREE.AmbientLight>(null!);
  const sunDisc = useRef<THREE.Mesh>(null!);
  const moonDisc = useRef<THREE.Mesh>(null!);
  const starsGroup = useRef<THREE.Group>(null!);
  const lightTarget = useRef<THREE.Object3D>(null!);
  const bg = useMemo(() => new THREE.Color(), []);
  const fogC = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog('#bcd8ef', 20, 180);
    scene.background = new THREE.Color('#8ec5f0');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame(() => {
    const d = dayFactor(G.time);
    const n = 1 - d;
    const underground = G.inCave !== null;
    const h = sunHeight(G.time);
    const ang = (G.time - 0.25) * Math.PI * 2;
    bg.copy(NIGHT_SKY).lerp(DAY_SKY, d);
    fogC.copy(NIGHT_FOG).lerp(DAY_FOG, d);
    if (underground) { bg.set('#090d15'); fogC.set('#11131d'); }
    (scene.background as THREE.Color).copy(bg);
    const f = scene.fog as THREE.Fog;
    if (f) {
      f.color.copy(fogC);
      f.near = underground ? 9 : THREE.MathUtils.lerp(10, 34, d);
      f.far = underground ? 68 : THREE.MathUtils.lerp(85, 260, d);
    }
    const px = G.pos.x, pz = G.pos.z;
    lightTarget.current.position.set(px, 0, pz);
    lightTarget.current.updateMatrixWorld();
    sun.current.target = lightTarget.current;
    moon.current.target = lightTarget.current;
    const sx = Math.cos(ang) * 70, sy = h * 90, sz = -45;
    sun.current.position.set(px + sx, Math.max(sy, -20), pz + sz);
    sun.current.intensity = underground ? 0 : THREE.MathUtils.lerp(0, 2.7, d);
    // no point rendering a shadow pass when the sun is down
    sun.current.castShadow = PRESET.shadows && d > 0.08 && !underground;
    sun.current.color.setHSL(0.09 + 0.03 * d, 0.45 - 0.25 * d, 0.6 + 0.3 * d);
    sunDisc.current.position.set(px + sx * 2.6, sy * 2.6, pz + sz * 2.6);
    sunDisc.current.visible = sy > -10;
    const mx = -Math.cos(ang) * 70, my = -h * 90;
    moon.current.position.set(px + mx, Math.max(my, -20), pz + 45);
    moon.current.intensity = underground ? 0 : THREE.MathUtils.lerp(0, 1.1, n);
    moonDisc.current.position.set(px + mx * 2.6, my * 2.6, pz + 45 * 2.6);
    moonDisc.current.visible = my > -10;
    hemi.current.intensity = underground ? 0.28 : THREE.MathUtils.lerp(0.5, 1.45, d);
    (hemi.current.color as THREE.Color).setStyle(d > 0.5 ? '#cfe6ff' : '#5c7bb8');
    (hemi.current.groundColor as THREE.Color).setStyle(d > 0.5 ? '#6b7a4e' : '#1b2436');
    amb.current.intensity = underground ? 0.34 : THREE.MathUtils.lerp(0.38, 0.8, d);
    if (starsGroup.current) {
      starsGroup.current.visible = n > 0.15 && !underground;
      starsGroup.current.rotation.y = G.time * Math.PI * 2;
    }
  });

  return (
    <>
      <object3D ref={lightTarget} />
      <ambientLight ref={amb} intensity={0.5} color="#cfe3ff" />
      <hemisphereLight ref={hemi} intensity={1} />
      <directionalLight ref={sun} castShadow intensity={2} position={[60, 80, -60]}
        shadow-mapSize={[PRESET.shadowMap, PRESET.shadowMap]}
        shadow-camera-near={1} shadow-camera-far={200}
        shadow-camera-left={-55} shadow-camera-right={55}
        shadow-camera-top={55} shadow-camera-bottom={-55}
        shadow-bias={-0.0005} />
      <directionalLight ref={moon} intensity={0} color="#9fc0ff" position={[-60, 80, 60]} />
      <mesh ref={sunDisc}>
        <sphereGeometry args={[8, 20, 20]} />
        <meshBasicMaterial color="#fff6d8" fog={false} />
      </mesh>
      <mesh ref={moonDisc}>
        <sphereGeometry args={[6, 20, 20]} />
        <meshBasicMaterial color="#dfe8ff" fog={false} />
      </mesh>
      <group ref={starsGroup}>
        <Stars radius={200} depth={60} count={2400} factor={5} saturation={0} fade speed={0.4} />
      </group>
    </>
  );
}

/* ================= Ground texture ================= */
function makeGroundTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const s = Math.random() * 3 + 1;
    const v = 200 + Math.random() * 55;
    ctx.fillStyle = `rgb(${v * 0.92},${v},${v * 0.86})`;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 8 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(190,180,160,0.5)');
    g.addColorStop(1, 'rgba(190,180,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(90, 90);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================= Wilderness (wrapping props) ================= */
const TILE = 150;
type PropDef = { x: number; z: number; s: number; r: number };
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inTown = (x: number, z: number) =>
  TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.radius + 4) ||
  GRAVEYARDS.some((g) =>
    x > g.x - g.w / 2 - 3 && x < g.x + g.w / 2 + 3 &&
    z > g.z - g.d / 2 - 3 && z < g.z + g.d / 2 + 3) ||
  CAVES.some((c) => Math.hypot(x - c.x, z - c.z) < c.depth + 6);

function Wilderness() {
  const trunks = useRef<THREE.InstancedMesh>(null!);
  const leaves = useRef<THREE.InstancedMesh>(null!);
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const bushes = useRef<THREE.InstancedMesh>(null!);
  const grass = useRef<THREE.InstancedMesh>(null!);
  const last = useRef(new THREE.Vector3(999, 0, 999));
  const leafMat = useRef<THREE.MeshStandardMaterial>(null!);
  const tex = useMemo(() => makeGroundTexture(), []);

  const TREES = 120, ROCKS = 70, BUSHES = 100, GRASS = 260;
  const data = useMemo(() => {
    const rnd = mulberry(1337);
    const make = (n: number): PropDef[] =>
      Array.from({ length: n }, () => ({
        x: (rnd() - 0.5) * TILE, z: (rnd() - 0.5) * TILE,
        s: 0.6 + rnd() * 0.9, r: rnd() * Math.PI * 2,
      }));
    return { trees: make(TREES), rocks: make(ROCKS), bushes: make(BUSHES), grass: make(GRASS) };
  }, []);

  const place = (mesh: THREE.InstancedMesh, defs: PropDef[], p: THREE.Vector3,
    fy: (d: PropDef) => number, fs: (d: PropDef) => [number, number, number]) => {
    defs.forEach((d, i) => {
      let x = d.x - Math.round((d.x - p.x) / TILE) * TILE;
      let z = d.z - Math.round((d.z - p.z) / TILE) * TILE;
      if (inTown(x, z)) { x += 55; z += 55; }
      // nothing grows in town, in caves, or above the snow line
      const h = inTown(x, z) || isSnowy(x, z) ? -50 : terrainHeight(x, z);
      dummy.position.set(x, h + fy(d), z);
      dummy.rotation.set(0, d.r, 0);
      const s = fs(d);
      dummy.scale.set(s[0], s[1], s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useFrame(() => {
    const p = G.pos;
    const d = dayFactor(G.time);
    leafMat.current.color.setRGB(
      THREE.MathUtils.lerp(0.07, 0.21, d),
      THREE.MathUtils.lerp(0.11, 0.37, d),
      THREE.MathUtils.lerp(0.09, 0.16, d),
    );
    if (p.distanceToSquared(last.current) > 16) {
      last.current.copy(p);
      place(trunks.current, data.trees, p, (d2) => 2.2 * (0.7 + d2.s * 0.5), (d2) => [d2.s * 0.9, 0.7 + d2.s * 0.5, d2.s * 0.9]);
      place(leaves.current, data.trees, p, (d2) => 4.6 * (0.7 + d2.s * 0.5), (d2) => [d2.s * 1.5, d2.s * 1.6, d2.s * 1.5]);
      place(rocks.current, data.rocks, p, (d2) => d2.s * 0.3, (d2) => [d2.s * 0.8, d2.s * 0.6, d2.s * 0.8]);
      place(bushes.current, data.bushes, p, (d2) => d2.s * 0.35, (d2) => [d2.s * 0.9, d2.s * 0.7, d2.s * 0.9]);
      place(grass.current, data.grass, p, () => 0.2, (d2) => [d2.s, d2.s * 0.9, d2.s]);
    }
  });

  return (
    <group>
      <Terrain tex={tex} />
      <instancedMesh ref={trunks} args={[undefined, undefined, TREES]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.45, 4.4, 7]} />
        <meshStandardMaterial color="#4a3827" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, TREES]} castShadow>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshStandardMaterial ref={leafMat} color="#35612b" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, ROCKS]} receiveShadow>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#79808c" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={bushes} args={[undefined, undefined, BUSHES]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#3d5a34" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={grass} args={[undefined, undefined, GRASS]}>
        <coneGeometry args={[0.12, 0.55, 4]} />
        <meshStandardMaterial color="#4d6636" roughness={1} />
      </instancedMesh>
    </group>
  );
}

/* ================= Town ================= */
const LAMPS: [number, number][] = [[-6, -2], [6, -2], [-6, 8], [6, 8]];

function House({ h, church }: { h: { x: number; z: number; w: number; d: number; rot: number; wall: string; roof: string; trim: string }; church: boolean }) {
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a2f38', emissive: '#ffb45a', emissiveIntensity: 0, roughness: 0.4,
  }), []);
  useFrame(() => {
    winMat.emissiveIntensity = THREE.MathUtils.lerp(0, 2.2, nightFactor(G.time));
  });
  const hw = h.w / 2, hd = h.d / 2, doorW = 1.7;
  const roofR = Math.max(h.w, h.d) * 0.78;
  return (
    <group position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]}>
      {/* floor + porch */}
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[h.w + 0.6, 0.14, h.d + 0.6]} />
        <meshStandardMaterial color="#5d4c38" roughness={1} />
      </mesh>
      <mesh position={[0, 0.09, hd + 1]} receiveShadow>
        <boxGeometry args={[2.8, 0.12, 1.8]} />
        <meshStandardMaterial color="#6e6252" roughness={1} />
      </mesh>
      {/* walls */}
      <mesh position={[0, 1.5, -hd]} castShadow receiveShadow>
        <boxGeometry args={[h.w, 3, 0.4]} />
        <meshStandardMaterial color={h.wall} roughness={0.95} />
      </mesh>
      <mesh position={[-hw, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 3, h.d]} />
        <meshStandardMaterial color={h.wall} roughness={0.95} />
      </mesh>
      <mesh position={[hw, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 3, h.d]} />
        <meshStandardMaterial color={h.wall} roughness={0.95} />
      </mesh>
      <mesh position={[-(doorW / 2 + (hw - doorW / 2) / 2), 1.5, hd]} castShadow receiveShadow>
        <boxGeometry args={[hw - doorW / 2, 3, 0.4]} />
        <meshStandardMaterial color={h.wall} roughness={0.95} />
      </mesh>
      <mesh position={[(doorW / 2 + (hw - doorW / 2) / 2), 1.5, hd]} castShadow receiveShadow>
        <boxGeometry args={[hw - doorW / 2, 3, 0.4]} />
        <meshStandardMaterial color={h.wall} roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.7, hd]} castShadow>
        <boxGeometry args={[doorW + 0.3, 0.6, 0.4]} />
        <meshStandardMaterial color={h.trim} roughness={0.9} />
      </mesh>
      {/* door frame posts */}
      <mesh position={[-doorW / 2 - 0.1, 1.2, hd]} castShadow>
        <boxGeometry args={[0.22, 2.4, 0.5]} />
        <meshStandardMaterial color={h.trim} roughness={0.9} />
      </mesh>
      <mesh position={[doorW / 2 + 0.1, 1.2, hd]} castShadow>
        <boxGeometry args={[0.22, 2.4, 0.5]} />
        <meshStandardMaterial color={h.trim} roughness={0.9} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 4.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[roofR, 2.3, 4]} />
        <meshStandardMaterial color={h.roof} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[hw * 0.5, 4.6, -hd * 0.3]} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.7]} />
        <meshStandardMaterial color="#555049" roughness={1} />
      </mesh>
      {/* windows */}
      <mesh position={[-hw - 0.21, 1.7, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.1, 1]} />
        <primitive object={winMat} attach="material" />
      </mesh>
      <mesh position={[hw + 0.21, 1.7, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.1, 1]} />
        <primitive object={winMat} attach="material" />
      </mesh>
      <mesh position={[-hw - 0.22, 1.7, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[1.35, 1.25, 0.06]} />
        <meshStandardMaterial color={h.trim} roughness={0.9} />
      </mesh>
      <mesh position={[hw + 0.22, 1.7, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.35, 1.25, 0.06]} />
        <meshStandardMaterial color={h.trim} roughness={0.9} />
      </mesh>
      {/* interior props */}
      <mesh position={[-hw + 1, 0.5, -hd + 1]} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#6b5236" roughness={1} />
      </mesh>
      <mesh position={[hw - 1, 0.55, -hd + 1]} castShadow>
        <cylinderGeometry args={[0.42, 0.46, 1, 10]} />
        <meshStandardMaterial color="#54402c" roughness={1} />
      </mesh>
      {church && (
        <>
          <mesh position={[0, 6.4, hd - 1]} castShadow>
            <boxGeometry args={[2.4, 4.6, 2.4]} />
            <meshStandardMaterial color={h.wall} roughness={0.95} />
          </mesh>
          <mesh position={[0, 9.6, hd - 1]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2, 2.6, 4]} />
            <meshStandardMaterial color={h.roof} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 11.4, hd - 1]}>
            <boxGeometry args={[0.18, 1.1, 0.18]} />
            <meshStandardMaterial color="#d8c98a" emissive="#d8c98a" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 11.4, hd - 1]}>
            <boxGeometry args={[0.6, 0.16, 0.16]} />
            <meshStandardMaterial color="#d8c98a" emissive="#d8c98a" emissiveIntensity={0.4} />
          </mesh>
          {[-1.6, 1.6].map((bx) =>
            [0.5, 2.2].map((bz) => (
              <mesh key={`${bx}${bz}`} position={[bx, 0.5, bz]} castShadow>
                <boxGeometry args={[1.6, 0.5, 0.5]} />
                <meshStandardMaterial color="#4c3a28" roughness={1} />
              </mesh>
            )),
          )}
        </>
      )}
    </group>
  );
}

function Graveyard({ gy, seed }: { gy: GraveyardDef; seed: number }) {
  const graves = useMemo(() => {
    const rnd = mulberry(seed);
    const count = Math.floor((gy.w * gy.d) / 17);
    return Array.from({ length: count }, () => ({
      x: gy.x + (rnd() - 0.5) * (gy.w - 4),
      z: gy.z + (rnd() - 0.5) * (gy.d - 4),
      r: (rnd() - 0.5) * 0.5,
      t: (rnd() - 0.5) * 0.25,
      s: 0.8 + rnd() * 0.5,
      cross: rnd() < 0.3,
    })).filter((g) => !gy.crypt || Math.abs(g.x - gy.x) > 3.4 || g.z > gy.z - gy.d / 2 + 7);
  }, [gy, seed]);
  const graveMesh = useRef<THREE.InstancedMesh>(null!);
  const crossMesh = useRef<THREE.InstancedMesh>(null!);
  const crossBar = useRef<THREE.InstancedMesh>(null!);
  const moundMesh = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    let gi = 0, ci = 0;
    graves.forEach((g) => {
      if (g.cross) {
        dummy.position.set(g.x, 0.6 * g.s, g.z);
        dummy.rotation.set(g.t, g.r, g.t * 0.7);
        dummy.scale.set(g.s, g.s, g.s);
        dummy.updateMatrix();
        crossMesh.current.setMatrixAt(ci, dummy.matrix);
        crossBar.current.setMatrixAt(ci, dummy.matrix);
        ci++;
      } else {
        dummy.position.set(g.x, 0.45 * g.s, g.z);
        dummy.rotation.set(g.t, g.r, g.t * 0.7);
        dummy.scale.set(g.s, g.s, g.s * 0.4);
        dummy.updateMatrix();
        graveMesh.current.setMatrixAt(gi, dummy.matrix);
        gi++;
      }
      dummy.position.set(g.x - Math.sin(g.r) * 0.9, 0.08, g.z + Math.cos(g.r) * 0.9);
      dummy.rotation.set(0, g.r, 0);
      dummy.scale.set(0.7 * g.s, 0.18, 1.5 * g.s);
      dummy.updateMatrix();
      moundMesh.current.setMatrixAt(gi + ci - 1, dummy.matrix);
    });
    graveMesh.current.count = gi;
    crossMesh.current.count = ci;
    crossBar.current.count = ci;
    moundMesh.current.count = graves.length;
    graveMesh.current.instanceMatrix.needsUpdate = true;
    crossMesh.current.instanceMatrix.needsUpdate = true;
    crossBar.current.instanceMatrix.needsUpdate = true;
    moundMesh.current.instanceMatrix.needsUpdate = true;
  }, [graves]);

  const gx1 = gy.x - gy.w / 2, gx2 = gy.x + gy.w / 2;
  const gz1 = gy.z - gy.d / 2, gz2 = gy.z + gy.d / 2;
  const gap = 2.2;
  const n = Math.max(1, graves.length);
  const fenceMat = <meshStandardMaterial color="#2c2620" roughness={1} />;
  const gateX = gy.gate === 'south' ? gy.x : gx1;
  const gateZ = gy.gate === 'south' ? gz2 : gy.z;

  return (
    <group>
      {/* dirt patch */}
      <mesh position={[gy.x, 0.012, gy.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[gy.w, gy.d]} />
        <meshStandardMaterial color="#4a4a3a" roughness={1} />
      </mesh>
      {/* rails */}
      <mesh position={[gy.x, 0.55, gz1]} castShadow><boxGeometry args={[gy.w, 0.12, 0.14]} />{fenceMat}</mesh>
      <mesh position={[gx2, 0.55, gy.z]} castShadow><boxGeometry args={[0.14, 0.12, gy.d]} />{fenceMat}</mesh>
      {gy.gate === 'south' ? (
        <>
          <mesh position={[(gx1 + gy.x - gap) / 2, 0.55, gz2]} castShadow><boxGeometry args={[gy.x - gap - gx1, 0.12, 0.14]} />{fenceMat}</mesh>
          <mesh position={[(gx2 + gy.x + gap) / 2, 0.55, gz2]} castShadow><boxGeometry args={[gx2 - gy.x - gap, 0.12, 0.14]} />{fenceMat}</mesh>
          <mesh position={[gx1, 0.55, gy.z]} castShadow><boxGeometry args={[0.14, 0.12, gy.d]} />{fenceMat}</mesh>
        </>
      ) : (
        <>
          <mesh position={[gy.x, 0.55, gz2]} castShadow><boxGeometry args={[gy.w, 0.12, 0.14]} />{fenceMat}</mesh>
          <mesh position={[gx1, 0.55, (gz1 + gy.z - gap) / 2]} castShadow><boxGeometry args={[0.14, 0.12, gy.z - gap - gz1]} />{fenceMat}</mesh>
          <mesh position={[gx1, 0.55, (gz2 + gy.z + gap) / 2]} castShadow><boxGeometry args={[0.14, 0.12, gz2 - gy.z - gap]} />{fenceMat}</mesh>
        </>
      )}
      {/* fence posts */}
      {Array.from({ length: Math.floor(gy.w / 2.2) + 1 }).map((_, i) => {
        const x = gx1 + i * 2.2;
        return (
          <group key={`p${i}`}>
            <mesh position={[x, 0.5, gz1]} castShadow><boxGeometry args={[0.16, 1.0, 0.16]} />{fenceMat}</mesh>
            {!(gy.gate === 'south' && Math.abs(x - gy.x) < gap) && (
              <mesh position={[x, 0.5, gz2]} castShadow><boxGeometry args={[0.16, 1.0, 0.16]} />{fenceMat}</mesh>
            )}
          </group>
        );
      })}
      {Array.from({ length: Math.floor(gy.d / 2.2) + 1 }).map((_, i) => {
        const z = gz1 + i * 2.2;
        return (
          <group key={`q${i}`}>
            <mesh position={[gx2, 0.5, z]} castShadow><boxGeometry args={[0.16, 1.0, 0.16]} />{fenceMat}</mesh>
            {!(gy.gate === 'west' && Math.abs(z - gy.z) < gap) && (
              <mesh position={[gx1, 0.5, z]} castShadow><boxGeometry args={[0.16, 1.0, 0.16]} />{fenceMat}</mesh>
            )}
          </group>
        );
      })}
      {/* gate arch */}
      <group position={[gateX, 0, gateZ]} rotation={[0, gy.gate === 'west' ? Math.PI / 2 : 0, 0]}>
        <mesh position={[-gap, 1.4, 0]} castShadow><boxGeometry args={[0.3, 2.8, 0.3]} /><meshStandardMaterial color="#3a3430" roughness={1} /></mesh>
        <mesh position={[gap, 1.4, 0]} castShadow><boxGeometry args={[0.3, 2.8, 0.3]} /><meshStandardMaterial color="#3a3430" roughness={1} /></mesh>
        <mesh position={[0, 2.7, 0]} castShadow><boxGeometry args={[gap * 2 + 0.3, 0.35, 0.3]} /><meshStandardMaterial color="#3a3430" roughness={1} /></mesh>
        <mesh position={[0, 3.05, 0]}><boxGeometry args={[0.1, 0.4, 0.1]} /><meshStandardMaterial color="#6b7280" roughness={0.8} /></mesh>
        <mesh position={[0, 3.1, 0]}><boxGeometry args={[0.28, 0.08, 0.08]} /><meshStandardMaterial color="#6b7280" roughness={0.8} /></mesh>
      </group>
      {/* graves */}
      <instancedMesh ref={graveMesh} args={[undefined, undefined, n]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.1, 0.35]} />
        <meshStandardMaterial color="#8e969e" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crossMesh} args={[undefined, undefined, n]} castShadow>
        <boxGeometry args={[0.14, 1.3, 0.14]} />
        <meshStandardMaterial color="#5a4a3a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crossBar} args={[undefined, undefined, n]} castShadow>
        <boxGeometry args={[0.6, 0.14, 0.14]} />
        <meshStandardMaterial color="#5a4a3a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={moundMesh} args={[undefined, undefined, n]} receiveShadow>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshStandardMaterial color="#3d3326" roughness={1} />
      </instancedMesh>
      {/* mausoleum */}
      {gy.crypt && (
        <group position={[gy.x, 0, gz1 + 3]}>
          <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.8, 2.6, 4]} />
            <meshStandardMaterial color="#7e8894" roughness={0.95} />
          </mesh>
          <mesh position={[0, 3.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[3.6, 1.2, 4]} />
            <meshStandardMaterial color="#4a4f5a" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 1, 2.01]}>
            <planeGeometry args={[1.4, 1.9]} />
            <meshStandardMaterial color="#0a0a0e" roughness={1} />
          </mesh>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 1.3, 2.05]} castShadow>
              <cylinderGeometry args={[0.2, 0.22, 2.6, 10]} />
              <meshStandardMaterial color="#8e969e" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 3.9, 0]}>
            <boxGeometry args={[0.14, 0.8, 0.14]} />
            <meshStandardMaterial color="#aab2bc" roughness={0.8} />
          </mesh>
        </group>
      )}
      {/* dead trees */}
      {(gy.crypt ? [[-8, -5], [8, -4], [-6, 6], [7, 6]] : [[-4.5, -3], [4.5, 3]]).map(([ox, oz], i) => (
        <group key={i} position={[gy.x + ox, 0, gy.z + oz]}>
          <mesh position={[0, 2, 0]} rotation={[0, 0, 0.08 * (i % 2 ? 1 : -1)]} castShadow>
            <cylinderGeometry args={[0.18, 0.34, 4, 7]} />
            <meshStandardMaterial color="#241d16" roughness={1} />
          </mesh>
          {[0.6, 1.6, 2.4].map((by, b) => (
            <mesh key={b} position={[(b % 2 ? 0.5 : -0.5), 2.4 + by * 0.5, 0]} rotation={[0, 0, (b % 2 ? -0.7 : 0.7)]} castShadow>
              <cylinderGeometry args={[0.03, 0.09, 1.6, 5]} />
              <meshStandardMaterial color="#241d16" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const Town = memo(function Town() {
  const lampLights = useRef<THREE.PointLight[]>([]);
  const lampMats = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame(() => {
    const n = nightFactor(G.time);
    const li = THREE.MathUtils.lerp(0, 26, n);
    for (const l of lampLights.current) if (l) l.intensity = li;
    const em = THREE.MathUtils.lerp(0.15, 2.4, n);
    for (const m of lampMats.current) if (m) m.emissiveIntensity = em;
  });

  const churchIdx = useMemo(() => new Set([4, 11]), []);

  return (
    <group>
      {TOWNS.map((t, ti) => (
        <DistanceCull key={t.id} x={t.x} z={t.z} radius={PRESET.cullRange + t.radius}>
        <group position={[t.x, 0, t.z]}>
          {/* roads + plaza */}
          <mesh position={[0, 0.02, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4.4, 62]} />
            <meshStandardMaterial color="#4d463d" roughness={1} />
          </mesh>
          <mesh position={[0, 0.02, 3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 3.6]} />
            <meshStandardMaterial color="#4d463d" roughness={1} />
          </mesh>
          <mesh position={[0, 0.025, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[6.5, 24]} />
            <meshStandardMaterial color="#5b554c" roughness={1} />
          </mesh>
          {/* well */}
          <group position={[0, 0, t.wellZ]}>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[1.15, 1.25, 1.1, 12, 1, true]} />
              <meshStandardMaterial color="#7b7f85" roughness={1} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <circleGeometry args={[1.1, 12]} />
              <meshStandardMaterial color="#06090e" roughness={0.2} metalness={0.6} />
            </mesh>
            {[-1.15, 1.15].map((x) => (
              <mesh key={x} position={[x, 1.6, 0]} castShadow>
                <boxGeometry args={[0.16, 2.2, 0.16]} />
                <meshStandardMaterial color="#4c3a28" roughness={1} />
              </mesh>
            ))}
            <mesh position={[0, 2.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[1.7, 1, 4]} />
              <meshStandardMaterial color="#5e2f28" roughness={1} flatShading />
            </mesh>
          </group>
          {/* lamps */}
          {LAMPS.map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 2, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.13, 4, 8]} />
                <meshStandardMaterial color="#23262e" roughness={0.7} metalness={0.5} />
              </mesh>
              <mesh position={[0, 4.1, 0]}>
                <sphereGeometry args={[0.28, 10, 10]} />
                <meshStandardMaterial
                  ref={(el) => { if (el) lampMats.current[ti * 4 + i] = el; }}
                  color="#ffe9c4" emissive="#ffca7a" emissiveIntensity={2.4} toneMapped={false} />
              </mesh>
              <mesh position={[0, 4.45, 0]}>
                <coneGeometry args={[0.45, 0.4, 8]} />
                <meshStandardMaterial color="#23262e" roughness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
        </DistanceCull>
      ))}
      {/* lamp lights live outside the per-town groups so they use world coords for culling */}
      {TOWNS.map((t, ti) => LAMPS.map(([x, z], i) => (
        <CulledPointLight key={`${t.id}${i}`} x={t.x + x} y={4.1} z={t.z + z}
          color="#ffca7a" intensity={0} distance={20} decay={1.4}
          lightRef={(el) => { if (el) lampLights.current[ti * 4 + i] = el; }} />
      )))}

      {HOUSES.map((h, i) => (
        <DistanceCull key={i} x={h.x} z={h.z} radius={PRESET.cullRange}>
          <House h={h} church={churchIdx.has(i)} />
        </DistanceCull>
      ))}
      {GRAVEYARDS.map((gy, i) => (
        <DistanceCull key={i} x={gy.x} z={gy.z} radius={PRESET.cullRange}>
          <Graveyard gy={gy} seed={777 + i * 131} />
        </DistanceCull>
      ))}
      <TownSigns />
      <Caves />
      <Ruins />
    </group>
  );
});

/* ================= Shooting ================= */
function hitHeight(e: Enemy) {
  if (e.mob) return mobHitHeight(e.mob) + (e.mob.body === 'floater' || e.mob.arch === 'flyer' ? 0 : 0);
  switch (e.type) {
    case 'zkorbus': return 2.25;
    case 'reaper': return 1.55;
    case 'behemoth': return 1.9;
    case 'yeti': return 1.8;
    case 'wraith': return 1.6;
    case 'ghoul': return 0.9;
    case 'spitter': return 1.1;
    default: return 1.0;
  }
}
function hitRadius(e: Enemy) {
  if (e.mob) return mobHitRadius(e.mob);
  switch (e.type) {
    case 'skyeye': return 3.1;
    case 'zkorbus': return 1.2;
    case 'behemoth': return 1.5;
    case 'yeti': return 1.4;
    case 'reaper': return 0.85;
    case 'wraith': return 0.8;
    case 'spitter': return 0.85;
    default: return 0.7;
  }
}

function rayWallDist(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number): number {
  // march along the ray; stop at first blocked point below roof height
  let t = 1;
  while (t < maxT) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    const g = terrainHeight(x, z, y);
    if (y < g + 0.05) return t;
    if (pointBlocked(x, z, y)) return t;
    t += 1;
  }
  return maxT;
}

function fire(camera: THREE.Camera) {
  const w = WEAPONS[G.weapon];
  const now = performance.now();
  if (now - G.lastShot < 60000 / w.rpm) return;
  if (w.id === 'minigun' && G.minigunSpin < 0.65) return;
  if (G.ammo[G.weapon] <= 0) {
    if (now - G.lastShot > 500) { G.lastShot = now; addLog('*click* — OUT OF AMMO'); playClick(); }
    return;
  }
  G.lastShot = now;
  G.muzzle = 0.06;
  G.recoil = Math.min(0.6, G.recoil + w.recoil * (G.aiming ? 0.62 : 1));

  const origin = camera.position.clone();
  const base = new THREE.Vector3();
  camera.getWorldDirection(base);

  if (w.explosive) {
    playRocketLaunch();
    G.ammo[G.weapon] -= 1;
    const dir = base.clone();
    const spreadScale = G.aiming ? 0.3 : 1;
    dir.x += (Math.random() - 0.5) * w.spread * 2 * spreadScale;
    dir.y += (Math.random() - 0.5) * w.spread * 2 * spreadScale;
    dir.normalize();
    G.rockets.push({
      id: G.rockets.length + Math.random(),
      pos: origin.clone().addScaledVector(dir, 1).add(new THREE.Vector3(0, -0.15, 0)),
      vel: dir.multiplyScalar(w.projectileSpeed ?? 45),
      life: 5, dmg: w.damage, radius: w.blastRadius ?? 6, spin: 0,
    });
    G.shake = Math.min(1, G.shake + 0.35);
    G.bump();
    return;
  }

  if (w.id === 'crossbow') {
    G.ammo[G.weapon] -= 1;
    playGun('crossbow');
    const dir = base.clone();
    dir.x += (Math.random() - 0.5) * w.spread * (G.aiming ? 0.6 : 2);
    dir.y += (Math.random() - 0.5) * w.spread * (G.aiming ? 0.6 : 2);
    dir.normalize();
    G.bolts.push({
      id: Math.random(),
      pos: origin.clone().addScaledVector(dir, 0.8).add(new THREE.Vector3(0, -0.1, 0)),
      vel: dir.multiplyScalar(62), life: 3, dmg: w.damage,
    });
    G.bump();
    return;
  }

  if (w.id === 'flamer') {
    G.ammo[G.weapon] -= 1;
    playGun('flamer');
    // cone of flame: damage everything in a short arc, spawn fire particles
    for (let i = 0; i < 6; i++) {
      const dir = base.clone();
      dir.x += (Math.random() - 0.5) * 0.3;
      dir.y += (Math.random() - 0.5) * 0.2 + 0.03;
      dir.z += (Math.random() - 0.5) * 0.3;
      dir.normalize();
      G.sparks.push({
        p: origin.clone().addScaledVector(dir, 0.9).add(new THREE.Vector3(0.2, -0.2, 0)),
        v: dir.multiplyScalar(14 + Math.random() * 8),
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        color: ['#ffd27a', '#ff9a3c', '#ff5a2a', '#ff3a1a'][Math.floor(Math.random() * 4)],
        size: 2.2 + Math.random() * 1.5,
      });
    }
    for (const e of G.enemies) {
      if (e.dead) continue;
      tmpV.set(e.pos.x - origin.x, 0, e.pos.z - origin.z);
      const d = tmpV.length();
      if (d > w.range) continue;
      tmpV.normalize();
      tmpV2.set(base.x, 0, base.z).normalize();
      if (tmpV.dot(tmpV2) > 0.82) {
        e.burn = Math.min(1, e.burn + 0.08);
        damageEnemy(e, w.damage * w.pellets, tmpV, 0.4);
      }
    }
    return;
  }

  playGun(w.id);
  const shots = w.id === 'm16a4' ? 3 : 1;
  for (let s = 0; s < shots; s++) {
    if (G.ammo[G.weapon] <= 0) break;
    G.ammo[G.weapon] -= 1;
    for (let i = 0; i < w.pellets; i++) {
      const dir = base.clone();
      const spreadScale = G.aiming ? 0.28 : G.sprinting ? 1.7 : 1;
      dir.x += (Math.random() - 0.5) * w.spread * 2 * spreadScale;
      dir.y += (Math.random() - 0.5) * w.spread * 2 * spreadScale;
      dir.z += (Math.random() - 0.5) * w.spread * 2 * spreadScale;
      dir.normalize();

      let best: Enemy | null = null;
      let bestT = w.range;
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (e.type === 'skyeye') {
          tmpV.copy(e.pos).sub(origin);
        } else {
          tmpV.copy(e.pos);
          tmpV.y += hitHeight(e);
          tmpV.sub(origin);
        }
        const t = tmpV.dot(dir);
        if (t < 0.4 || t > bestT) continue;
        tmpV2.copy(dir).multiplyScalar(t);
        const perp = tmpV.sub(tmpV2).length();
        if (perp < hitRadius(e)) { best = e; bestT = t; }
      }
      const wallT = rayWallDist(origin, dir, w.range);
      if (wallT < bestT) {
        const end = origin.clone().addScaledVector(dir, wallT);
        G.tracers.push({ a: origin.clone(), b: end, life: 0.06, color: TRACER_COLORS[w.id] });
        G.sparks.push({
          p: end, v: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
          life: 0.35, maxLife: 0.35, color: '#c9c2b2', size: 0.8,
        });
        continue;
      }
      const end = origin.clone().addScaledVector(dir, best ? bestT : w.range);
      G.tracers.push({ a: origin.clone(), b: end, life: 0.06, color: TRACER_COLORS[w.id] });
      if (best) {
        const b: Enemy = best;
        tmpV3.copy(dir).setY(0).normalize();
        damageEnemy(b, w.damage, tmpV3, w.id === 'shotgun' ? 7 : 2.2);
        for (let k = 0; k < 4; k++) {
          G.sparks.push({
            p: end.clone(),
            v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
            life: 0.45, maxLife: 0.45, color: b.type === 'skyeye' ? '#ff5a4a' : '#c2261f', size: 1.1,
          });
        }
      } else if (Math.random() < 0.4) {
        G.sparks.push({
          p: end.clone(),
          v: new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2),
          life: 0.35, maxLife: 0.35, color: '#b9b2a0', size: 0.7,
        });
      }
    }
  }
}

/* ================= Player ================= */
const GRAV = 24, JUMP = 8;

function Player() {
  const { camera } = useThree();
  const flash = useRef<THREE.SpotLight>(null!);
  const target = useRef<THREE.Object3D>(null!);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!G.running || G.gameOver) return;
    const k = G.keys;
    let fx = 0, fz = 0;
    if (k.has('w') || k.has('arrowup')) fz += 1;
    if (k.has('s') || k.has('arrowdown')) fz -= 1;
    if (k.has('a') || k.has('arrowleft')) fx -= 1;
    if (k.has('d') || k.has('arrowright')) fx += 1;

    const w = WEAPONS[G.weapon];
    const wantsSprint = k.has('shift') && (fx !== 0 || fz !== 0) && G.stamina > 0.02 && G.minigunSpin < 0.3;
    G.sprinting = wantsSprint;
    G.stamina = THREE.MathUtils.clamp(G.stamina + (wantsSprint ? -dt * 0.22 : dt * 0.18), 0, 1);

    let speed = wantsSprint ? 8.4 : 4.8;
    if (w.moveSlow && G.minigunSpin > 0.25) speed *= w.moveSlow;
    if (G.aiming) speed *= 0.72;
    if (!G.grounded) speed *= 0.85;
    const sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
    const dx = -sin * fz + cos * fx;
    const dz = -cos * fz - sin * fx;
    const len = Math.hypot(dx, dz) || 1;
    if (fx !== 0 || fz !== 0) {
      const nx = G.pos.x + (dx / len) * speed * dt;
      const nz = G.pos.z + (dz / len) * speed * dt;
      const [cx, cz] = collideCircle(nx, nz, 0.45, G.pos.y);
      G.pos.x = cx; G.pos.z = cz;
      const before = Math.floor(G.bob / Math.PI);
      G.bob += dt * (wantsSprint ? 13 : 8.5);
      if (G.grounded && Math.floor(G.bob / Math.PI) !== before) playStep(wantsSprint);
    } else {
      G.bob += dt * 1.6;
    }

    // jump / gravity
    if ((k.has(' ') || k.has('space')) && G.grounded) {
      G.velY = JUMP;
      G.grounded = false;
    }
    G.velY -= GRAV * dt;
    G.pos.y += G.velY * dt;
    const activeCave = G.inCave ? CAVES.find((c) => c.id === G.inCave) : undefined;
    if (activeCave) {
      const [lx, lz] = caveLocal(activeCave, G.pos.x, G.pos.z);
      const floor = caveFloorHeight(activeCave, -lz);
      const ceiling = floor + Math.max(2.8, 8.4 * Math.sqrt(Math.max(0, 1 - (lx / (activeCave.width / 2 + 0.2)) ** 2))) - 1.9;
      if (-lz > 1 && Math.abs(lx) < activeCave.width / 2 && G.pos.y > ceiling) {
        G.pos.y = ceiling;
        G.velY = Math.min(0, G.velY);
      }
    }
    const groundY = terrainHeight(G.pos.x, G.pos.z, G.pos.y);
    if (G.pos.y <= groundY) {
      if (!G.grounded && G.velY < -4) playLand();
      G.pos.y = groundY; G.velY = 0; G.grounded = true;
    }

    // cave detection + first-visit population
    const cave = caveAt(G.pos.x, G.pos.z, G.pos.y);
    const caveId = cave ? cave.id : null;
    if (caveId !== G.inCave) {
      G.inCave = caveId;
      if (cave) populateCave(cave);
    }
    if (cave) {
      const [lx, lz] = caveLocal(cave, G.pos.x, G.pos.z);
      if (G.pos.y < groundY + 0.8 && lavaAt(cave, lx, -lz)) {
        hurtPlayer(42 * dt);
        G.boomFlash = Math.max(G.boomFlash, 0.16);
      }
    }
    // ruin detection: golems wake on first visit
    const ruin = ruinAt(G.pos.x, G.pos.z);
    const ruinId = ruin ? ruin.id : null;
    if (ruinId !== G.inRuin) {
      G.inRuin = ruinId;
      if (ruin) populateRuin(ruin);
    }

    // minigun spin
    if (G.weapon === 'minigun' && G.shooting) G.minigunSpin = Math.min(1, G.minigunSpin + dt * 2.2);
    else G.minigunSpin = Math.max(0, G.minigunSpin - dt * 1.6);
    updateMinigun(G.weapon === 'minigun' ? G.minigunSpin : 0);
    updateAmbience(nightFactor(G.time));

    G.recoil = THREE.MathUtils.lerp(G.recoil, 0, dt * 9);
    G.muzzle = Math.max(0, G.muzzle - dt);

    const bobY = Math.sin(G.bob) * (G.sprinting ? 0.075 : 0.045);
    const bobX = Math.cos(G.bob * 0.5) * 0.03;
    const sh = G.shake;
    const shx = (Math.random() - 0.5) * sh * 0.12;
    const shy = (Math.random() - 0.5) * sh * 0.12;
    camera.position.set(G.pos.x + bobX + shx, 1.7 + G.pos.y + bobY + shy, G.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(G.pitch - G.recoil * 0.5, G.yaw, (Math.random() - 0.5) * sh * 0.02);
    const perspective = camera as THREE.PerspectiveCamera;
    const targetFov = G.aiming ? ADS_FOV[G.weapon] : 76;
    perspective.fov = THREE.MathUtils.damp(perspective.fov, targetFov, G.aiming ? 12 : 8, dt);
    perspective.updateProjectionMatrix();

    if (G.shooting) {
      if (w.auto || performance.now() - G.lastShot > 130) fire(camera);
      if (!w.auto) G.shooting = false;
    }

    const nf = G.inCave ? 1 : nightFactor(G.time);
    flash.current.target = target.current;
    flash.current.visible = G.flashlight && nf > 0.2;
    flash.current.intensity = THREE.MathUtils.lerp(0, 80, nf) + G.muzzle * 700;
    flash.current.position.copy(camera.position);
    camera.getWorldDirection(tmpV);
    target.current.position.copy(camera.position).addScaledVector(tmpV, 12);
    target.current.updateMatrixWorld();
  });

  return (
    <>
      <object3D ref={target} />
      <spotLight ref={flash} angle={0.55} penumbra={0.55} distance={46} decay={1.1}
        color="#ffe9c4" intensity={0} />
    </>
  );
}

/* ================= Gun view model (models live in guns.tsx) ================= */
function ViewModel() {
  const g = useRef<THREE.Group>(null!);
  const flashMesh = useRef<THREE.Mesh>(null!);
  const flashCore = useRef<THREE.Mesh>(null!);
  const flashLight = useRef<THREE.PointLight>(null!);
  const rotor = useRef<THREE.Group | null>(null);
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const swapAnim = useRef({ last: G.weapon, t: 0 });
  const adsBlend = useRef(0);

  useFrame(({ camera }, dt) => {
    if (!g.current) return;
    const id = G.weapon;
    adsBlend.current = THREE.MathUtils.damp(adsBlend.current, G.aiming ? 1 : 0, 12, dt);
    if (swapAnim.current.last !== id) { swapAnim.current.last = id; swapAnim.current.t = 1; }
    swapAnim.current.t = Math.max(0, swapAnim.current.t - dt * 3.2);
    const raise = swapAnim.current.t;
    for (const k of Object.keys(groups.current)) {
      const grp = groups.current[k];
      if (grp) grp.visible = k === id;
    }
    g.current.position.copy(camera.position);
    g.current.quaternion.copy(camera.quaternion);
    const spinShake = id === 'minigun' ? G.minigunSpin * 0.008 : 0;
    const sprintK = G.sprinting ? 1 : 0;
    const sway = Math.sin(G.bob) * 0.012 + (Math.random() - 0.5) * spinShake;
    const swayY = Math.cos(G.bob * 2) * 0.009 + (Math.random() - 0.5) * spinShake;
    const off = VM_OFFSET[id];
    const ads = ADS_OFFSET[id];
    const aimBlend = adsBlend.current;
    const px = THREE.MathUtils.lerp(off[0], ads[0], aimBlend);
    const py = THREE.MathUtils.lerp(off[1], ads[1], aimBlend);
    const pz = THREE.MathUtils.lerp(off[2], ads[2], aimBlend);
    g.current.translateX(px + sway - sprintK * 0.04);
    g.current.translateY(py + swayY - G.recoil * 0.1 - raise * 0.35 - sprintK * 0.05);
    g.current.translateZ(pz + G.recoil * 0.55);
    g.current.rotateX(G.recoil * 0.9 - raise * 0.6);
    g.current.rotateY(sprintK * 0.35 + raise * 0.2);
    g.current.rotateZ(Math.sin(G.bob * 0.5) * 0.01 + sprintK * 0.1);
    const m = MUZZLE[id];
    flashMesh.current.position.set(m[0], m[1], m[2] - 0.08);
    flashCore.current.position.set(m[0], m[1], m[2] - 0.03);
    flashLight.current.position.set(m[0], m[1], m[2] + 0.2);
    const flashing = G.muzzle > 0;
    const suppressFrontFlash = G.aiming && (!!SCOPED[id] || id === 'bazooka' || id === 'rpg');
    flashMesh.current.visible = flashing && !suppressFrontFlash;
    flashCore.current.visible = flashing && !suppressFrontFlash;
    flashLight.current.intensity = flashing ? (suppressFrontFlash ? 8 : 30) : 0;
    if (flashing && !suppressFrontFlash) {
      const big = id === 'shotgun' || id === 'ak47' || id === 'bazooka' || id === 'rpg';
      flashMesh.current.scale.set(0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8, (big ? 1.5 : 1) * (0.8 + Math.random() * 0.8));
      flashMesh.current.rotation.z = Math.random() * Math.PI;
      flashCore.current.scale.setScalar(0.6 + Math.random() * 0.6);
    }
    if (rotor.current) rotor.current.rotation.z += (0.2 + G.minigunSpin * 30) * dt;
    setMinigunHeat(id === 'minigun' ? G.minigunSpin : 0);
  });

  return (
    <group ref={g}>
      {WORDER_IDS.map((id) => (
        <group key={id} ref={(el) => { groups.current[id] = el; }} visible={id === 'pistol'}>
          <GunModel id={id} rotorRef={rotor} />
        </group>
      ))}
      <mesh ref={flashMesh} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.3, 6]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={flashCore}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fff2c4" transparent opacity={0.95} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={flashLight} color="#ffb45a" intensity={0} distance={11} decay={1.4} />
    </group>
  );
}
const WORDER_IDS = ['pistol', 'revolver', 'uzi', 'smg', 'shotgun', 'aa12', 'ak47', 'm16a4', 'm16a6', 'm14', 'sniper', 'crossbow', 'flamer', 'saw', 'minigun', 'bazooka', 'rpg'] as const;

/* ================= New monsters (ghoul / wraith / behemoth / spitter / yeti) ================= */
const NEW_TYPES = new Set(['ghoul', 'wraith', 'behemoth', 'spitter', 'yeti']);

function NewMonsterView({ e }: { e: Enemy }) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const hpBar = useRef<THREE.Mesh>(null!);
  const wraithSkin = useRef<THREE.MeshStandardMaterial | null>(null);
  const frost = useRef<THREE.Mesh>(null!);
  const isBoss = e.type === 'behemoth' && e.maxHp > 900;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!root.current) return;
    const t = performance.now() / 1000;
    const sink = e.dying > 0 ? (1 - e.dying) * 1.4 : 0;
    const hover = e.type === 'wraith' ? 0.5 + Math.sin(t * 2 + e.wobble) * 0.25 : 0;
    root.current.position.set(e.pos.x, e.pos.y - sink + hover, e.pos.z);
    const sc = e.dying > 0 ? Math.max(0.01, e.dying) : 1 - e.burn * 0.3;
    root.current.scale.setScalar(sc * (isBoss ? 1.45 : e.type === 'behemoth' ? 1.15 : 1));
    const ang = Math.atan2(G.pos.x - e.pos.x, G.pos.z - e.pos.z);
    body.current.rotation.y = THREE.MathUtils.lerp(body.current.rotation.y, ang, dt * 6);
    if (e.type === 'ghoul') {
      body.current.position.y = Math.abs(Math.sin(t * 12 + e.wobble)) * 0.12;
      body.current.rotation.x = Math.sin(t * 12 + e.wobble) * 0.08;
    } else if (e.type === 'behemoth') {
      body.current.position.y = Math.abs(Math.sin(t * 3 + e.wobble)) * 0.08;
      body.current.rotation.z = Math.sin(t * 3 + e.wobble) * 0.05;
      if (e.firing > 0) body.current.rotation.x = -0.5 + e.firing * 0.6;
      else body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, 0, dt * 6);
    } else if (e.type === 'spitter') {
      const k = Math.max(0, e.charge);
      body.current.scale.set(1 + k * 0.15, 1 - k * 0.1, 1 + k * 0.15);
    } else if (e.type === 'yeti') {
      // heavy lope; rear back while winding up a throw; lunge forward on a charge
      body.current.position.y = Math.abs(Math.sin(t * 4 + e.wobble)) * 0.1;
      body.current.rotation.z = Math.sin(t * 4 + e.wobble) * 0.06;
      const wind = Math.max(0, e.charge);
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, e.firing > 0 ? 0.35 : -wind * 0.4, dt * 8);
    } else if (e.type === 'wraith' && wraithSkin.current) {
      wraithSkin.current.opacity = e.frozen ? 0.25 : 0.55 + Math.sin(t * 3) * 0.1;
    }
    if (hpBar.current) {
      const pct = Math.max(0.001, e.hp / e.maxHp);
      hpBar.current.scale.x = pct;
      hpBar.current.position.x = -(1 - pct) * 0.5;
      (hpBar.current.material as THREE.MeshBasicMaterial).color.set(pct > 0.5 ? '#5bd98a' : pct > 0.25 ? '#ffd166' : '#ff4444');
    }
    if (frost.current) {
      frost.current.visible = e.frozenTimer > 0;
      if (e.frozenTimer > 0) frost.current.rotation.y = t * 0.5;
    }
  });

  const barY = e.type === 'behemoth' ? 3.6 : e.type === 'yeti' ? 3.5 : e.type === 'wraith' ? 3.1 : e.type === 'spitter' ? 2.2 : 1.9;
  return (
    <group ref={root}>
      <group ref={body}>
        {e.type === 'ghoul' && <GhoulBody />}
        {e.type === 'wraith' && <WraithBody skinRef={wraithSkin} />}
        {e.type === 'behemoth' && <BehemothBody />}
        {e.type === 'spitter' && <SpitterBody />}
        {e.type === 'yeti' && <YetiBody />}
        <group position={[0, barY, 0]}>
          <mesh>
            <planeGeometry args={[isBoss ? 1.6 : 1, 0.09]} />
            <meshBasicMaterial color="#1a0505" transparent opacity={0.8} depthWrite={false} />
          </mesh>
          <mesh ref={hpBar} position={[0, 0, 0.005]}>
            <planeGeometry args={[isBoss ? 1.6 : 1, 0.09]} />
            <meshBasicMaterial color="#5bd98a" depthWrite={false} />
          </mesh>
        </group>
      </group>
      {/* frost shell */}
      <mesh ref={frost} visible={false} position={[0, barY * 0.5, 0]}>
        <icosahedronGeometry args={[barY * 0.45, 1]} />
        <meshStandardMaterial color="#bff1ff" transparent opacity={0.35} roughness={0.1} metalness={0.2} emissive="#8fe3ff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/* ================= Roster monsters (data-driven) ================= */
function MobView({ e }: { e: Enemy }) {
  const m = e.mob!;
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const hpBar = useRef<THREE.Mesh>(null!);
  const skin = useRef<THREE.MeshStandardMaterial | null>(null);
  const yaw = useRef(Math.random() * 6);
  const isGolem = m.arch === 'golem';
  const flyer = m.arch === 'flyer';
  const hidden = m.arch === 'ambusher';

  useFrame(({ camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!root.current) return;
    const t = performance.now() / 1000;
    const dx = e.pos.x - G.pos.x, dz = e.pos.z - G.pos.z;
    const d2 = dx * dx + dz * dz;
    const near = d2 < 140 * 140;
    root.current.visible = near;
    if (!near) return;

    const sink = e.dying > 0 ? (1 - e.dying) * 1.4 * m.scale : 0;
    const hover = flyer ? Math.sin(t * 2.2 + e.wobble) * 0.3 : m.body === 'floater' ? 0.3 + Math.sin(t * 2 + e.wobble) * 0.2 : 0;
    root.current.position.set(e.pos.x, e.pos.y - sink + hover, e.pos.z);
    const sc = e.dying > 0 ? Math.max(0.01, e.dying) : 1 - e.burn * 0.3;
    root.current.scale.setScalar(sc);

    // facing
    const want = Math.atan2(G.pos.x - e.pos.x, G.pos.z - e.pos.z);
    let diff = want - yaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw.current += diff * Math.min(1, dt * (isGolem ? 2.5 : 7));
    body.current.rotation.y = yaw.current;

    // gait
    if (isGolem) {
      if (!e.awake) {
        body.current.rotation.x = 0.35; body.current.position.y = -0.4 * m.scale; // crouched, dormant
      } else {
        body.current.position.y = Math.abs(Math.sin(t * 2.4 + e.wobble)) * 0.12;
        body.current.rotation.z = Math.sin(t * 2.4 + e.wobble) * 0.05;
        body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, e.firing > 0 ? -0.5 + e.firing * 0.7 : -e.charge * 0.35, dt * 6);
      }
    } else if (m.body === 'quad' || m.body === 'insect') {
      body.current.position.y = Math.abs(Math.sin(t * (6 + e.speed) + e.wobble)) * 0.08 * m.scale;
      body.current.rotation.x = Math.sin(t * (6 + e.speed) + e.wobble) * 0.05;
    } else if (m.body === 'blob') {
      const sq = 1 + Math.sin(t * 5 + e.wobble) * 0.08;
      body.current.scale.set(1 / sq, sq, 1 / sq);
    } else if (m.body === 'serpent') {
      body.current.rotation.z = Math.sin(t * 6 + e.wobble) * 0.1;
    } else {
      body.current.position.y = Math.abs(Math.sin(t * 5 + e.wobble)) * 0.06 * m.scale;
      body.current.rotation.z = Math.sin(t * 2.5 + e.wobble) * 0.06;
    }
    if (m.arch === 'exploder') {
      const k = Math.max(0, e.charge);
      body.current.scale.setScalar(1 + k * 0.35 + Math.sin(t * (10 + k * 30)) * k * 0.08);
    }

    // skin fx
    const sk = skin.current;
    if (sk) {
      if (e.frozenTimer > 0) { sk.emissive.set('#8fe3ff'); sk.emissiveIntensity = 1.4; }
      else if (e.hitFlash > 0) { sk.emissive.set('#ff6060'); sk.emissiveIntensity = e.hitFlash * 6; }
      else if (e.burn > 0.02) { sk.emissive.set('#ff7a1a'); sk.emissiveIntensity = e.burn * 4; }
      else if (m.arch === 'exploder') { sk.emissive.set(m.accent); sk.emissiveIntensity = 0.6 + Math.max(0, e.charge) * 3; }
      else if (isGolem && !e.awake) { sk.emissive.set('#000000'); sk.emissiveIntensity = 0; }
      else { sk.emissive.set(m.glow ? m.accent : '#000000'); sk.emissiveIntensity = m.glow ? 0.9 : 0; }
      if (hidden) {
        const vis = e.awake ? 1 : THREE.MathUtils.clamp(1 - Math.sqrt(d2) / 14, 0, 0.35);
        sk.transparent = true; sk.opacity = vis;
      }
    }

    if (hpBar.current) {
      const pct = Math.max(0.001, e.hp / e.maxHp);
      hpBar.current.scale.x = pct;
      hpBar.current.position.x = -(1 - pct) * 0.5;
      (hpBar.current.material as THREE.MeshBasicMaterial).color.set(pct > 0.5 ? '#5bd98a' : pct > 0.25 ? '#ffd166' : '#ff4444');
      hpBar.current.parent!.visible = e.awake && !(hidden && (skin.current?.opacity ?? 1) < 0.5);
      hpBar.current.parent!.lookAt(camera.position);
    }
  });

  const barY = (m.body === 'colossus' ? 2.6 : m.body === 'floater' ? 2.3 : m.body === 'quad' ? 1.4 : m.body === 'insect' ? 1.1 : m.body === 'blob' ? 1.5 : m.body === 'serpent' ? 1.5 : 2.1) * m.scale;
  const barW = m.scale > 1.6 ? 1.6 : 1;
  return (
    <group ref={root}>
      <group ref={body}>
        <MobBody m={m} skinRef={skin} />
      </group>
      <group position={[0, barY, 0]}>
        <mesh>
          <planeGeometry args={[barW, 0.09]} />
          <meshBasicMaterial color="#1a0505" transparent opacity={0.8} depthWrite={false} />
        </mesh>
        <mesh ref={hpBar} position={[0, 0, 0.005]}>
          <planeGeometry args={[barW, 0.09]} />
          <meshBasicMaterial color="#5bd98a" depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ================= Enemies ================= */
function EnemyView({ e }: { e: Enemy }) {
  if (e.type === 'mob' && e.mob) return <MobView e={e} />;
  if (NEW_TYPES.has(e.type)) return <NewMonsterView e={e} />;
  return <LegacyEnemyView e={e} />;
}

function LegacyEnemyView({ e }: { e: Enemy }) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const beamOuter = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const eyeL = useRef<THREE.MeshStandardMaterial>(null!);
  const eyeR = useRef<THREE.MeshStandardMaterial>(null!);
  const skin = useRef<THREE.MeshStandardMaterial>(null!);
  const iris = useRef<THREE.MeshStandardMaterial>(null!);
  const glow = useRef<THREE.PointLight>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const hpBar = useRef<THREE.Mesh>(null!);
  const isSky = e.type === 'skyeye';
  const isZombie = e.type === 'zombie';
  const isSkeleton = e.type === 'skeleton';
  const isReaper = e.type === 'reaper';
  const isZkorbus = e.type === 'zkorbus';

  useFrame(({ camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!root.current) return;
    const t = performance.now() / 1000;

    if (isSky) {
      root.current.position.copy(e.pos);
      const s = e.dying > 0 ? Math.max(0.01, e.dying) : 1 - e.burn * 0.3;
      root.current.scale.setScalar(s);
      body.current.lookAt(camera.position);
      body.current.position.y = Math.sin(t * 1.4 + e.hoverPhase) * 0.7;
      const ch = e.firing > 0 ? 1 : Math.max(0, e.charge);
      iris.current.emissiveIntensity = 2 + ch * 12;
      glow.current.intensity = 4 + ch * 30;
      glow.current.distance = 26;
      if (e.hitFlash > 0) {
        skin.current.emissive.set('#ff6060');
        skin.current.emissiveIntensity = e.hitFlash * 5;
      } else if (e.burn > 0.02) {
        skin.current.emissive.set('#ff7a1a');
        skin.current.emissiveIntensity = e.burn * 3;
      } else skin.current.emissiveIntensity = 0;

      const showRing = (e.charge > 0.05 || e.firing > 0) && e.dying <= 0;
      ring.current.visible = showRing;
      const gy = showRing || e.firing > 0 ? terrainHeight(e.target.x, e.target.z) : 0;
      if (showRing) {
        ring.current.position.set(e.target.x - e.pos.x, gy + 0.15 - e.pos.y, e.target.z - e.pos.z);
        const pulse = 1 + Math.sin(t * 10) * 0.12;
        ring.current.scale.setScalar((e.firing > 0 ? 3.4 : 2 + e.charge * 1.6) * pulse);
      }
      const showBeam = e.firing > 0 && e.dying <= 0;
      beam.current.visible = showBeam;
      beamOuter.current.visible = showBeam;
      if (showBeam) {
        tmpV.set(e.target.x - e.pos.x, gy + 0.3 - e.pos.y, e.target.z - e.pos.z);
        const len = tmpV.length();
        tmpV2.copy(tmpV).normalize();
        tmpQ.setFromUnitVectors(UP, tmpV2);
        for (const [m, w] of [[beam.current, 0.22], [beamOuter.current, 0.55]] as const) {
          m.quaternion.copy(tmpQ);
          m.position.set(tmpV.x / 2, tmpV.y / 2, tmpV.z / 2);
          m.scale.set(w + Math.random() * 0.08, len, w + Math.random() * 0.08);
        }
      }
      return;
    }

    // ground enemies
    const sink = e.dying > 0 ? (1 - e.dying) * 1.2 : 0;
    root.current.position.set(e.pos.x, e.pos.y - sink, e.pos.z);
    const typeScale = isZkorbus ? 1.62 : isReaper ? 1.14 : 1;
    const scale = (e.dying > 0 ? Math.max(0.01, e.dying) : 1 - e.burn * 0.35) * typeScale;
    root.current.scale.setScalar(scale);
    const ang = Math.atan2(G.pos.x - e.pos.x, G.pos.z - e.pos.z);
    body.current.rotation.y = THREE.MathUtils.lerp(body.current.rotation.y, ang, dt * 6);
    const sw = Math.sin(t * (isZombie ? 5 : isSkeleton ? 11 : 8) + e.wobble);
    if (legL.current) {
      legL.current.rotation.x = sw * (isZombie ? 0.5 : isSkeleton ? 0.8 : 0.62);
      legR.current.rotation.x = -sw * (isZombie ? 0.5 : isSkeleton ? 0.8 : 0.62);
      armL.current.rotation.x = (isZombie ? -1.15 : isZkorbus ? -0.45 : -0.25) + sw * 0.18;
      armR.current.rotation.x = (isZombie ? -1.15 : isZkorbus ? -0.45 : -0.25) - sw * 0.18;
    }
    body.current.rotation.z = isZombie ? Math.sin(t * 2.6 + e.wobble) * 0.1 : Math.sin(t * 8 + e.wobble) * 0.04;
    body.current.position.y = isZombie ? Math.abs(Math.sin(t * 5 + e.wobble)) * 0.06 : Math.sin(t * 6 + e.wobble) * 0.08;

    const chargeGlow = isZombie ? (e.firing > 0 ? 14 : 1.2 + Math.max(0, e.charge) * 9)
      : isReaper ? 3.5 + e.charge * 8 + (e.firing > 0 ? 5 : 0)
      : isZkorbus ? 2.8 : isSkeleton ? 2.2 : e.frozen ? 5 : 2.2;
    const col = isZombie ? '#ff2a18' : isReaper ? '#ff293f' : isZkorbus ? '#c6f5ff' : isSkeleton ? '#a9d7ff' : '#b06bff';
    eyeL.current.emissive.set(col);
    eyeR.current.emissive.set(col);
    eyeL.current.emissiveIntensity = chargeGlow;
    eyeR.current.emissiveIntensity = chargeGlow;
    if (e.frozenTimer > 0) {
      skin.current.emissive.set('#8fe3ff');
      skin.current.emissiveIntensity = 1.6 + Math.sin(t * 10) * 0.4;
    } else if (e.hitFlash > 0) {
      skin.current.emissive.set('#ff6060');
      skin.current.emissiveIntensity = e.hitFlash * 6;
    } else if (e.burn > 0.02) {
      skin.current.emissive.set('#ff7a1a');
      skin.current.emissiveIntensity = e.burn * 4;
    } else skin.current.emissiveIntensity = 0;
    skin.current.opacity = !isZombie && e.frozen ? 0.5 : 1;

    if (hpBar.current) {
      const pct = Math.max(0.001, e.hp / e.maxHp);
      hpBar.current.scale.x = pct;
      hpBar.current.position.x = -(1 - pct) * 0.5;
      (hpBar.current.material as THREE.MeshBasicMaterial).color.set(pct > 0.5 ? '#5bd98a' : pct > 0.25 ? '#ffd166' : '#ff4444');
    }

    if (isZombie && e.firing > 0 && e.dying <= 0) {
      beam.current.visible = true;
      beamOuter.current.visible = false;
      tmpV.set(G.pos.x - e.pos.x, 1.6 - 1.55, G.pos.z - e.pos.z);
      const len = tmpV.length();
      tmpV2.copy(tmpV).normalize();
      tmpQ.setFromUnitVectors(UP, tmpV2);
      beam.current.quaternion.copy(tmpQ);
      beam.current.position.set(tmpV.x / 2, 1.55 + tmpV.y / 2, tmpV.z / 2);
      const w = 0.05 + Math.random() * 0.05;
      beam.current.scale.set(w, len, w);
    } else {
      beam.current.visible = false;
      beamOuter.current.visible = false;
    }
  });

  if (isSky) {
    return (
      <group ref={root}>
        <group ref={body}>
          <mesh castShadow>
            <sphereGeometry args={[2.6, 24, 18]} />
            <meshStandardMaterial ref={skin} color="#e4d9c8" roughness={0.35} />
          </mesh>
          {[0.5, 1.4, 2.3, 3.4, 4.4, 5.3].map((a) => (
            <mesh key={a} rotation={[a, a * 0.7, 0]}>
              <torusGeometry args={[2.62, 0.035, 6, 32]} />
              <meshStandardMaterial color="#a01818" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0, 2.1]}>
            <sphereGeometry args={[1.15, 18, 14]} />
            <meshStandardMaterial ref={iris} color="#c01414" emissive="#ff2a18" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 2.95]}>
            <sphereGeometry args={[0.5, 14, 12]} />
            <meshStandardMaterial color="#050505" roughness={0.15} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 2.2]} rotation={[0, 0, 0]}>
            <torusGeometry args={[1.2, 0.12, 8, 24]} />
            <meshStandardMaterial color="#5e0d0d" roughness={0.6} />
          </mesh>
          {/* tentacles */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.6, -2.4, Math.sin(a) * 1.6]} rotation={[0.35, 0, Math.cos(a) * 0.3]}>
                <coneGeometry args={[0.28, 2.2, 7]} />
                <meshStandardMaterial color="#8a4a3a" roughness={0.8} />
              </mesh>
            );
          })}
          {/* fins */}
          <mesh position={[2.8, 0.6, -0.6]} rotation={[0, 0.5, 0.5]}>
            <boxGeometry args={[0.25, 2.4, 1.4]} />
            <meshStandardMaterial color="#3a2030" roughness={0.85} />
          </mesh>
          <mesh position={[-2.8, 0.6, -0.6]} rotation={[0, -0.5, -0.5]}>
            <boxGeometry args={[0.25, 2.4, 1.4]} />
            <meshStandardMaterial color="#3a2030" roughness={0.85} />
          </mesh>
        </group>
        <pointLight ref={glow} intensity={4} distance={26} color="#ff2a18" />
        <mesh ref={beam} visible={false}>
          <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
          <meshBasicMaterial color="#fff0e8" transparent opacity={0.95} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh ref={beamOuter} visible={false}>
          <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
          <meshBasicMaterial color="#ff3a22" transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color="#ff3a22" transparent opacity={0.8} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={root}>
      <group ref={body}>
        {isZombie ? (
          <>
            <mesh castShadow position={[0, 1.05, 0]}>
              <boxGeometry args={[0.62, 0.85, 0.4]} />
              <meshStandardMaterial ref={skin} color="#4a3b32" roughness={0.95} transparent />
            </mesh>
            <mesh position={[0, 1.05, 0.21]}>
              <boxGeometry args={[0.3, 0.6, 0.03]} />
              <meshStandardMaterial color="#6e1a1a" roughness={1} />
            </mesh>
            <mesh position={[0, 0.68, 0.01]}>
              <boxGeometry args={[0.64, 0.1, 0.42]} />
              <meshStandardMaterial color="#241d16" roughness={1} />
            </mesh>
            <mesh castShadow position={[0, 1.75, 0]}>
              <sphereGeometry args={[0.27, 14, 12]} />
              <meshStandardMaterial color="#7c9263" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.6, 0.16]}>
              <boxGeometry args={[0.2, 0.09, 0.12]} />
              <meshStandardMaterial color="#2a1a1a" roughness={1} />
            </mesh>
            <mesh position={[0.2, 1.32, -0.2]} rotation={[0, 0, -0.5]}>
              <coneGeometry args={[0.05, 0.25, 5]} />
              <meshStandardMaterial color="#c9c2b2" roughness={0.9} />
            </mesh>
            <mesh position={[-0.2, 1.32, -0.2]} rotation={[0, 0, 0.5]}>
              <coneGeometry args={[0.05, 0.25, 5]} />
              <meshStandardMaterial color="#c9c2b2" roughness={0.9} />
            </mesh>
          </>
        ) : isSkeleton ? (
          <>
            {/* exposed rib cage and vertebrae */}
            <mesh castShadow position={[0, 1.02, 0]}>
              <capsuleGeometry args={[0.22, 0.62, 5, 10]} />
              <meshStandardMaterial ref={skin} color="#d8cfad" roughness={0.9} />
            </mesh>
            {[0.78, 0.98, 1.18, 1.38].map((y, i) => (
              <mesh key={y} position={[0, y, 0.03]} rotation={[0, 0, (i % 2 ? 0.035 : -0.035)]}>
                <torusGeometry args={[0.28 - i * 0.012, 0.035, 6, 16, Math.PI]} />
                <meshStandardMaterial color="#e0d7bc" roughness={0.92} />
              </mesh>
            ))}
            {[0.82, 1.04, 1.26].map((y) => (
              <mesh key={`v${y}`} position={[0, y, -0.04]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#c7b991" roughness={0.95} />
              </mesh>
            ))}
            <mesh castShadow position={[0, 1.82, 0.02]}>
              <sphereGeometry args={[0.28, 16, 14]} />
              <meshStandardMaterial color="#e2d9c1" roughness={0.88} />
            </mesh>
            <mesh position={[0, 1.68, 0.12]}>
              <boxGeometry args={[0.21, 0.11, 0.12]} />
              <meshStandardMaterial color="#b8ad91" roughness={0.9} />
            </mesh>
            {[0.11, -0.11].map((x) => (
              <mesh key={x} position={[x, 1.86, 0.23]}>
                <sphereGeometry args={[0.082, 10, 8]} />
                <meshBasicMaterial color="#090e18" toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, 0.49, 0]}>
              <boxGeometry args={[0.38, 0.17, 0.23]} />
              <meshStandardMaterial color="#c7b991" roughness={0.95} />
            </mesh>
            {[0.16, -0.16].map((x) => (
              <mesh key={`hip${x}`} position={[x, 0.48, 0]} rotation={[0, 0, x > 0 ? -0.25 : 0.25]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#d1c7aa" roughness={0.95} />
              </mesh>
            ))}
          </>
        ) : isReaper ? (
          <>
            <mesh castShadow position={[0, 1.08, 0]}>
              <capsuleGeometry args={[0.38, 1.04, 6, 12]} />
              <meshStandardMaterial ref={skin} color="#171820" roughness={0.96} />
            </mesh>
            <mesh position={[0, 0.58, 0]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.72, 0.52, 9]} />
              <meshStandardMaterial color="#101117" roughness={1} />
            </mesh>
            <mesh castShadow position={[0, 1.93, 0.02]}>
              <sphereGeometry args={[0.31, 14, 12]} />
              <meshStandardMaterial color="#111218" roughness={0.65} />
            </mesh>
            <mesh position={[0, 1.83, 0.17]} rotation={[0.16, 0, 0]}>
              <coneGeometry args={[0.22, 0.42, 7]} />
              <meshStandardMaterial color="#d4d0c3" roughness={0.9} />
            </mesh>
            <mesh position={[0.1, 1.99, 0.31]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#ff1739" toneMapped={false} />
            </mesh>
            <mesh position={[-0.1, 1.99, 0.31]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#ff1739" toneMapped={false} />
            </mesh>
            {/* iron scythe: long haft, socket, crescent blade */}
            <group position={[-0.62, 0.42, 0.12]} rotation={[0, 0, -0.08]}>
              <mesh position={[0, 1.02, 0]}>
                <cylinderGeometry args={[0.035, 0.045, 2.15, 8]} />
                <meshStandardMaterial color="#49352b" roughness={0.8} />
              </mesh>
              <mesh position={[0, 2.08, 0]}>
                <cylinderGeometry args={[0.07, 0.035, 0.24, 8]} />
                <meshStandardMaterial color="#626a75" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0.35, 2.28, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.42, 0.055, 8, 24, Math.PI * 0.85]} />
                <meshStandardMaterial color="#c5ccd2" metalness={0.92} roughness={0.18} />
              </mesh>
              <mesh position={[0.77, 2.28, 0]} rotation={[0, 0, -0.8]}>
                <coneGeometry args={[0.075, 0.3, 6]} />
                <meshStandardMaterial color="#dce2e6" metalness={0.9} roughness={0.16} />
              </mesh>
            </group>
          </>
        ) : isZkorbus ? (
          <>
            {/* tall, smooth chalk-white figure */}
            <mesh castShadow position={[0, 1.55, 0]}>
              <capsuleGeometry args={[0.25, 1.35, 8, 14]} />
              <meshStandardMaterial ref={skin} color="#e9f1ef" roughness={0.34} metalness={0.04} />
            </mesh>
            <mesh castShadow position={[0, 2.67, 0.02]}>
              <sphereGeometry args={[0.25, 18, 14]} />
              <meshStandardMaterial color="#f0f4ef" roughness={0.28} />
            </mesh>
            <mesh position={[0, 2.63, 0.24]}>
              <boxGeometry args={[0.12, 0.025, 0.025]} />
              <meshBasicMaterial color="#17242a" />
            </mesh>
            {/* open umbrella with visible ribs */}
            <group position={[0.68, 0.9, -0.08]}>
              <mesh position={[0, 1.92, 0]}>
                <cylinderGeometry args={[0.025, 0.035, 2.05, 8]} />
                <meshStandardMaterial color="#29262b" metalness={0.48} roughness={0.45} />
              </mesh>
              <mesh position={[0, 2.97, 0]}>
                <sphereGeometry args={[1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#26232a" side={THREE.DoubleSide} roughness={0.5} metalness={0.18} />
              </mesh>
              <mesh position={[0, 2.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.0, 0.025, 6, 24]} />
                <meshStandardMaterial color="#9d2830" metalness={0.6} roughness={0.35} />
              </mesh>
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.49, 3.1, Math.sin(a) * 0.49]} rotation={[0, -a, 0.05]}>
                    <boxGeometry args={[0.018, 0.035, 0.98]} />
                    <meshStandardMaterial color="#96919a" metalness={0.78} roughness={0.3} />
                  </mesh>
                );
              })}
              <mesh position={[0, 1.92, 0]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#b7333d" metalness={0.5} roughness={0.3} />
              </mesh>
            </group>
            {/* long knife held in its left hand */}
            <group position={[-0.45, 0.72, 0.16]} rotation={[0.06, 0, -0.18]}>
              <mesh position={[0, 0.18, 0]}>
                <boxGeometry args={[0.035, 0.28, 0.045]} />
                <meshStandardMaterial color="#4a352b" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.52, 0]} rotation={[0, 0, -0.025]}>
                <boxGeometry args={[0.052, 0.56, 0.025]} />
                <meshStandardMaterial color="#dce5e5" metalness={0.92} roughness={0.16} />
              </mesh>
              <mesh position={[0, 0.82, 0]}>
                <coneGeometry args={[0.04, 0.16, 4]} />
                <meshStandardMaterial color="#f3f7f6" metalness={0.9} roughness={0.15} />
              </mesh>
              <mesh position={[0, 0.34, 0.018]}>
                <boxGeometry args={[0.008, 0.3, 0.004]} />
                <meshStandardMaterial color="#75828b" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          </>
        ) : isReaper ? (
          <>
            <mesh castShadow position={[0, 1.08, 0]}>
              <capsuleGeometry args={[0.38, 1.04, 6, 12]} />
              <meshStandardMaterial ref={skin} color="#171820" roughness={0.96} />
            </mesh>
            <mesh position={[0, 0.58, 0]}>
              <coneGeometry args={[0.72, 0.52, 9]} />
              <meshStandardMaterial color="#101117" roughness={1} />
            </mesh>
            <mesh castShadow position={[0, 1.93, 0.02]}>
              <sphereGeometry args={[0.31, 14, 12]} />
              <meshStandardMaterial color="#111218" roughness={0.65} />
            </mesh>
            <mesh position={[0, 1.83, 0.17]} rotation={[0.16, 0, 0]}>
              <coneGeometry args={[0.22, 0.42, 7]} />
              <meshStandardMaterial color="#d4d0c3" roughness={0.9} />
            </mesh>
            <mesh position={[0.1, 1.99, 0.31]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#ff1739" toneMapped={false} /></mesh>
            <mesh position={[-0.1, 1.99, 0.31]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#ff1739" toneMapped={false} /></mesh>
            <group position={[-0.62, 0.42, 0.12]} rotation={[0, 0, -0.08]}>
              <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.035, 0.045, 2.15, 8]} /><meshStandardMaterial color="#49352b" roughness={0.8} /></mesh>
              <mesh position={[0, 2.08, 0]}><cylinderGeometry args={[0.07, 0.035, 0.24, 8]} /><meshStandardMaterial color="#626a75" metalness={0.8} roughness={0.3} /></mesh>
              <mesh position={[0.35, 2.28, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.42, 0.055, 8, 24, Math.PI * 0.85]} /><meshStandardMaterial color="#c5ccd2" metalness={0.92} roughness={0.18} /></mesh>
              <mesh position={[0.77, 2.28, 0]} rotation={[0, 0, -0.8]}><coneGeometry args={[0.075, 0.3, 6]} /><meshStandardMaterial color="#dce2e6" metalness={0.9} roughness={0.16} /></mesh>
            </group>
          </>
        ) : isZkorbus ? (
          <>
            <mesh castShadow position={[0, 1.55, 0]}>
              <capsuleGeometry args={[0.25, 1.35, 8, 14]} />
              <meshStandardMaterial ref={skin} color="#e9f1ef" roughness={0.34} metalness={0.04} />
            </mesh>
            <mesh castShadow position={[0, 2.67, 0.02]}>
              <sphereGeometry args={[0.25, 18, 14]} />
              <meshStandardMaterial color="#f0f4ef" roughness={0.28} />
            </mesh>
            <mesh position={[0, 2.63, 0.24]}><boxGeometry args={[0.12, 0.025, 0.025]} /><meshBasicMaterial color="#17242a" /></mesh>
            <group position={[0.68, 0.9, -0.08]}>
              <mesh position={[0, 1.92, 0]}><cylinderGeometry args={[0.025, 0.035, 2.05, 8]} /><meshStandardMaterial color="#29262b" metalness={0.48} roughness={0.45} /></mesh>
              <mesh position={[0, 2.97, 0]}><sphereGeometry args={[1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#26232a" side={THREE.DoubleSide} roughness={0.5} metalness={0.18} /></mesh>
              <mesh position={[0, 2.98, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.0, 0.025, 6, 24]} /><meshStandardMaterial color="#9d2830" metalness={0.6} roughness={0.35} /></mesh>
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return <mesh key={i} position={[Math.cos(a) * 0.49, 3.1, Math.sin(a) * 0.49]} rotation={[0, -a, 0.05]}><boxGeometry args={[0.018, 0.035, 0.98]} /><meshStandardMaterial color="#96919a" metalness={0.78} roughness={0.3} /></mesh>;
              })}
              <mesh position={[0, 1.92, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#b7333d" metalness={0.5} roughness={0.3} /></mesh>
            </group>
            <group position={[-0.45, 0.72, 0.16]} rotation={[0.06, 0, -0.18]}>
              <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.035, 0.28, 0.045]} /><meshStandardMaterial color="#4a352b" roughness={0.8} /></mesh>
              <mesh position={[0, 0.52, 0]}><boxGeometry args={[0.052, 0.56, 0.025]} /><meshStandardMaterial color="#dce5e5" metalness={0.92} roughness={0.16} /></mesh>
              <mesh position={[0, 0.82, 0]}><coneGeometry args={[0.04, 0.16, 4]} /><meshStandardMaterial color="#f3f7f6" metalness={0.9} roughness={0.15} /></mesh>
              <mesh position={[0, 0.34, 0.018]}><boxGeometry args={[0.008, 0.3, 0.004]} /><meshStandardMaterial color="#75828b" metalness={0.9} roughness={0.2} /></mesh>
            </group>
          </>
        ) : (
          <>
            <mesh castShadow position={[0, 1.25, 0]}>
              <boxGeometry args={[0.4, 1.3, 0.3]} />
              <meshStandardMaterial ref={skin} color="#15161f" roughness={0.6} transparent />
            </mesh>
            <mesh castShadow position={[0, 2.2, 0]}>
              <boxGeometry args={[0.3, 0.55, 0.32]} />
              <meshStandardMaterial color="#0c0d14" roughness={0.5} />
            </mesh>
            {[1.5, 1.8, 2.05].map((y) => (
              <mesh key={y} position={[0, y, -0.2]} rotation={[0.5, 0, 0]}>
                <coneGeometry args={[0.05, 0.3, 5]} />
                <meshStandardMaterial color="#2a2f45" roughness={0.6} />
              </mesh>
            ))}
          </>
        )}
        {/* arms */}
        <group ref={armL} position={[isZombie ? 0.4 : isZkorbus ? 0.42 : 0.28, isZombie ? 1.3 : isZkorbus ? 2.2 : 1.75, 0]}>
          <mesh position={[0, -0.3, 0.1]} castShadow>
            <capsuleGeometry args={[isZombie ? 0.1 : isSkeleton ? 0.075 : 0.06, isZombie ? 0.5 : isZkorbus ? 1.15 : 0.9, 4, 8]} />
            <meshStandardMaterial color={isZombie ? '#53704a' : isSkeleton ? '#d8cfad' : isZkorbus ? '#e8f1ef' : isReaper ? '#111218' : '#11121a'} roughness={0.9} />
          </mesh>
        </group>
        <group ref={armR} position={[isZombie ? -0.4 : isZkorbus ? -0.42 : -0.28, isZombie ? 1.3 : isZkorbus ? 2.2 : 1.75, 0]}>
          <mesh position={[0, -0.3, 0.1]} castShadow>
            <capsuleGeometry args={[isZombie ? 0.1 : isSkeleton ? 0.075 : 0.06, isZombie ? 0.5 : isZkorbus ? 1.15 : 0.9, 4, 8]} />
            <meshStandardMaterial color={isZombie ? '#53704a' : isSkeleton ? '#d8cfad' : isZkorbus ? '#e8f1ef' : isReaper ? '#111218' : '#11121a'} roughness={0.9} />
          </mesh>
        </group>
        {/* legs */}
        <group ref={legL} position={[0.15, 0.62, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.42, 4, 8]} />
            <meshStandardMaterial color={isZombie ? '#3f4a35' : isSkeleton ? '#cfc5a6' : isZkorbus ? '#e8f1ef' : isReaper ? '#111218' : '#0d0e15'} roughness={0.95} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.15, 0.62, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.42, 4, 8]} />
            <meshStandardMaterial color={isZombie ? '#3f4a35' : isSkeleton ? '#cfc5a6' : isZkorbus ? '#e8f1ef' : isReaper ? '#111218' : '#0d0e15'} roughness={0.95} />
          </mesh>
        </group>
        {/* eyes */}
        <mesh position={[0.1, isZombie ? 1.8 : isSkeleton ? 1.88 : isReaper ? 1.98 : isZkorbus ? 2.7 : 2.28, isZombie ? 0.23 : isSkeleton ? 0.21 : isZkorbus ? 0.23 : 0.17]}>
          <sphereGeometry args={[isZombie ? 0.055 : isZkorbus ? 0.065 : 0.045, 8, 8]} />
          <meshStandardMaterial ref={eyeL} color="#ff2a18" emissive="#ff2a18" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <mesh position={[-0.1, isZombie ? 1.8 : isSkeleton ? 1.88 : isReaper ? 1.98 : isZkorbus ? 2.7 : 2.28, isZombie ? 0.23 : isSkeleton ? 0.21 : isZkorbus ? 0.23 : 0.17]}>
          <sphereGeometry args={[isZombie ? 0.055 : isZkorbus ? 0.065 : 0.045, 8, 8]} />
          <meshStandardMaterial ref={eyeR} color="#ff2a18" emissive="#ff2a18" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* hp bar */}
        <group position={[0, isZombie ? 2.25 : isZkorbus ? 4.25 : isReaper ? 3.05 : isSkeleton ? 2.5 : 2.75, 0]}>
          <mesh>
            <planeGeometry args={[1, 0.09]} />
            <meshBasicMaterial color="#1a0505" transparent opacity={0.8} depthWrite={false} />
          </mesh>
          <mesh ref={hpBar} position={[0, 0, 0.005]}>
            <planeGeometry args={[1, 0.09]} />
            <meshBasicMaterial color="#5bd98a" depthWrite={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
        <meshBasicMaterial color="#ff3a22" transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={beamOuter} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
        <meshBasicMaterial color="#ff3a22" transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ================= Allies ================= */
function AllyView({ a }: { a: Ally }) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const marker = useRef<THREE.Mesh>(null!);
  const hpBar = useRef<THREE.Mesh>(null!);
  const yaw = useRef(0);

  useFrame(({ camera }) => {
    if (!root.current) return;
    root.current.visible = !a.dead && Math.abs(a.pos.y - G.pos.y) < 30;
    if (a.dead) return;
    const t = performance.now() / 1000;
    root.current.position.set(a.pos.x, a.pos.y, a.pos.z);
    // face player or nearest enemy
    let tx = G.pos.x, tz = G.pos.z;
    let bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
      if (d < bd) { bd = d; tx = e.pos.x; tz = e.pos.z; }
    }
    const want = Math.atan2(tx - a.pos.x, tz - a.pos.z);
    let diff = want - yaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw.current += diff * 0.08;
    body.current.rotation.y = yaw.current;
    body.current.position.y = Math.abs(Math.sin(t * 6 + a.wobble)) * 0.04;
    const walking = a.pos.distanceTo(G.pos) > 4.2;
    const stride = walking ? Math.sin(t * 8 + a.wobble) * 0.42 : Math.sin(t * 2 + a.wobble) * 0.025;
    legL.current.rotation.x = stride;
    legR.current.rotation.x = -stride;
    armL.current.rotation.x = -0.9 - stride * 0.28;
    armR.current.rotation.x = -0.75 + stride * 0.28;
    marker.current.position.y = 2.5 + Math.sin(t * 2.5) * 0.12;
    marker.current.rotation.y = t * 2;
    (marker.current.material as THREE.MeshBasicMaterial).color.set(a.recruited ? '#5bd98a' : '#ffd166');
    if (hpBar.current && a.recruited) {
      const pct = Math.max(0.001, a.hp / a.maxHp);
      hpBar.current.scale.x = pct;
      hpBar.current.position.x = -(1 - pct) * 0.45;
    }
    marker.current.lookAt(camera.position);
  });

  if (a.dead) return null;
  return (
    <group ref={root}>
      <group ref={body}>
        {/* layered field jacket, plate carrier and pack */}
        <mesh castShadow position={[0, 1.04, 0]}>
          <capsuleGeometry args={[0.29, 0.56, 6, 12]} />
          <meshStandardMaterial color={a.jacket} roughness={0.92} />
        </mesh>
        <mesh position={[0, 1.04, 0.245]}>
          <boxGeometry args={[0.4, 0.5, 0.08]} />
          <meshStandardMaterial color="#454644" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.76, 0.285]}>
          <boxGeometry args={[0.42, 0.09, 0.1]} />
          <meshStandardMaterial color="#34312d" metalness={0.25} roughness={0.8} />
        </mesh>
        {[-0.15, 0.15].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.98, 0.3]}>
              <boxGeometry args={[0.12, 0.18, 0.07]} />
              <meshStandardMaterial color="#58554d" roughness={0.9} />
            </mesh>
            <mesh position={[x, 1.08, 0.34]}>
              <boxGeometry args={[0.1, 0.025, 0.02]} />
              <meshStandardMaterial color="#282a2b" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.08, -0.25]}>
          <boxGeometry args={[0.34, 0.58, 0.2]} />
          <meshStandardMaterial color="#393d3b" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.15, -0.36]}>
          <boxGeometry args={[0.28, 0.22, 0.08]} />
          <meshStandardMaterial color="#4f514b" roughness={1} />
        </mesh>
        {/* neck, face, ears and cap */}
        <mesh position={[0, 1.52, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.18, 10]} />
          <meshStandardMaterial color="#a97d64" roughness={0.86} />
        </mesh>
        <mesh castShadow position={[0, 1.75, 0.015]}>
          <sphereGeometry args={[0.235, 18, 14]} />
          <meshStandardMaterial color="#c99c7d" roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.65, 0.207]}>
          <boxGeometry args={[0.17, 0.055, 0.06]} />
          <meshStandardMaterial color="#765643" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.73, 0.225]}>
          <boxGeometry args={[0.06, 0.1, 0.03]} />
          <meshStandardMaterial color="#b28769" roughness={0.9} />
        </mesh>
        {[-0.085, 0.085].map((x) => (
          <mesh key={x} position={[x, 1.79, 0.218]}>
            <sphereGeometry args={[0.022, 7, 7]} />
            <meshBasicMaterial color="#191a1d" />
          </mesh>
        ))}
        <mesh position={[0, 1.96, -0.005]} rotation={[0.05, 0, 0]}>
          <sphereGeometry args={[0.25, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          <meshStandardMaterial color="#342c25" roughness={0.98} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <boxGeometry args={[0.48, 0.08, 0.34]} />
          <meshStandardMaterial color="#4e493f" roughness={0.95} />
        </mesh>
        <mesh position={[-0.24, 1.74, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#bd9073" roughness={0.9} />
        </mesh>
        <mesh position={[0.24, 1.74, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#bd9073" roughness={0.9} />
        </mesh>
        {/* articulated arms */}
        <group ref={armL} position={[0.32, 1.34, 0]}>
          <mesh position={[0, -0.2, 0]} rotation={[0, 0, -0.12]} castShadow>
            <capsuleGeometry args={[0.12, 0.4, 5, 9]} />
            <meshStandardMaterial color={a.jacket} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.57, 0.1]} rotation={[0.15, 0, 0.04]} castShadow>
            <capsuleGeometry args={[0.085, 0.34, 5, 8]} />
            <meshStandardMaterial color="#5b574e" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.79, 0.15]}>
            <boxGeometry args={[0.1, 0.11, 0.08]} />
            <meshStandardMaterial color="#292a2a" roughness={0.95} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.32, 1.34, 0]}>
          <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0.12]} castShadow>
            <capsuleGeometry args={[0.12, 0.4, 5, 9]} />
            <meshStandardMaterial color={a.jacket} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.57, 0.1]} rotation={[0.15, 0, -0.04]} castShadow>
            <capsuleGeometry args={[0.085, 0.34, 5, 8]} />
            <meshStandardMaterial color="#5b574e" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.79, 0.15]}>
            <boxGeometry args={[0.1, 0.11, 0.08]} />
            <meshStandardMaterial color="#292a2a" roughness={0.95} />
          </mesh>
        </group>
        {/* detailed rifle, held across the chest */}
        <group position={[0.15, 1.31, 0.39]} rotation={[0.08, 0, 0.06]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.1, 0.42]} />
            <meshStandardMaterial color="#30343a" metalness={0.72} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.02, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.42, 9]} />
            <meshStandardMaterial color="#17191d" metalness={0.9} roughness={0.26} />
          </mesh>
          <mesh position={[0, 0.07, -0.17]}>
            <boxGeometry args={[0.075, 0.07, 0.21]} />
            <meshStandardMaterial color="#282c30" metalness={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.105, 0.02]}>
            <boxGeometry args={[0.035, 0.035, 0.16]} />
            <meshStandardMaterial color="#141619" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.1, -0.01]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.055, 0.15, 0.06]} />
            <meshStandardMaterial color="#262a2f" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.02, 0.29]}>
            <boxGeometry args={[0.07, 0.12, 0.17]} />
            <meshStandardMaterial color="#32363a" roughness={0.8} />
          </mesh>
        </group>
        {/* articulated legs, trousers, knee pads and boots */}
        <group ref={legL} position={[0.15, 0.58, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.4, 5, 9]} />
            <meshStandardMaterial color="#343b3b" roughness={0.96} />
          </mesh>
          <mesh position={[0, -0.13, 0.102]}>
            <boxGeometry args={[0.17, 0.13, 0.035]} />
            <meshStandardMaterial color="#4f514b" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.48, 0.08]}>
            <boxGeometry args={[0.16, 0.14, 0.25]} />
            <meshStandardMaterial color="#252729" roughness={0.88} />
          </mesh>
          <mesh position={[0, -0.54, 0.16]}>
            <boxGeometry args={[0.17, 0.045, 0.29]} />
            <meshStandardMaterial color="#151719" roughness={0.95} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.15, 0.58, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.4, 5, 9]} />
            <meshStandardMaterial color="#343b3b" roughness={0.96} />
          </mesh>
          <mesh position={[0, -0.13, 0.102]}>
            <boxGeometry args={[0.17, 0.13, 0.035]} />
            <meshStandardMaterial color="#4f514b" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.48, 0.08]}>
            <boxGeometry args={[0.16, 0.14, 0.25]} />
            <meshStandardMaterial color="#252729" roughness={0.88} />
          </mesh>
          <mesh position={[0, -0.54, 0.16]}>
            <boxGeometry args={[0.17, 0.045, 0.29]} />
            <meshStandardMaterial color="#151719" roughness={0.95} />
          </mesh>
        </group>
        {a.recruited && (
          <group position={[0, 2.15, 0]}>
            <mesh>
              <planeGeometry args={[0.9, 0.08]} />
              <meshBasicMaterial color="#06250f" transparent opacity={0.85} depthWrite={false} />
            </mesh>
            <mesh ref={hpBar} position={[0, 0, 0.005]}>
              <planeGeometry args={[0.9, 0.08]} />
              <meshBasicMaterial color="#5bd98a" depthWrite={false} />
            </mesh>
          </group>
        )}
      </group>
      <mesh ref={marker} position={[0, 2.5, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ================= Chests ================= */
function ChestView({ c }: { c: Chest }) {
  const lid = useRef<THREE.Group>(null!);
  const marker = useRef<THREE.Mesh>(null!);
  const trim = useRef<THREE.MeshStandardMaterial>(null!);
  const root = useRef<THREE.Group>(null!);
  const baseY = c.pos.y;

  useFrame(() => {
    if (!root.current) return;
    const dx = c.pos.x - G.pos.x, dz = c.pos.z - G.pos.z;
    const dy = c.pos.y - G.pos.y;
    const near = dx * dx + dy * dy + dz * dz < 100 * 100 && Math.abs(dy) < 25;
    root.current.visible = near;
    if (!near) return;
    const want = c.opened ? 1 : 0;
    c.openAnim = THREE.MathUtils.lerp(c.openAnim, want, 0.08);
    if (lid.current) lid.current.rotation.x = -c.openAnim * 1.9;
    if (marker.current) {
      marker.current.visible = !c.opened;
      marker.current.position.y = 1.5 + Math.sin(performance.now() / 400) * 0.12;
      marker.current.rotation.y += 0.03;
    }
    if (trim.current) {
      trim.current.emissiveIntensity = c.opened ? 0 : 0.7 + Math.sin(performance.now() / 300) * 0.35;
    }
  });

  return (
    <group ref={root} position={[c.pos.x, baseY, c.pos.z]} rotation={[0, c.rot, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.55, 0.75]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.85} />
      </mesh>
      <mesh position={[-0.35, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.57, 0.77]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.35, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.57, 0.77]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.35} />
      </mesh>
      <group ref={lid} position={[0, 0.575, -0.375]}>
        <mesh position={[0, 0.12, 0.375]}>
          <boxGeometry args={[1.15, 0.24, 0.75]} />
          <meshStandardMaterial color="#7a5535" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.12, 0.74]}>
          <boxGeometry args={[0.16, 0.2, 0.06]} />
          <meshStandardMaterial color="#c9a227" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
      <mesh ref={marker} position={[0, 1.5, 0]}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[1.18, 0.05, 0.78]} />
        <meshStandardMaterial ref={trim} color="#c9a227" emissive="#c9a227" emissiveIntensity={0.7} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ================= Pickups ================= */
function PickupView({ p }: { p: Pickup }) {
  const g = useRef<THREE.Group>(null!);
  const color = p.kind === 'ammo' ? '#79c0ff' : '#5bd98a';
  const baseY = p.pos.y;
  useFrame((_, dt) => {
    if (!g.current) return;
    const dx = p.pos.x - G.pos.x, dz = p.pos.z - G.pos.z;
    const dy = p.pos.y - G.pos.y;
    const near = dx * dx + dy * dy + dz * dz < 90 * 90 && Math.abs(dy) < 25;
    g.current.visible = near;
    if (!near) return;
    p.spin += dt * 1.6;
    g.current.position.set(p.pos.x, baseY + 0.55 + Math.sin(p.spin) * 0.12, p.pos.z);
    g.current.rotation.y = p.spin;
  });
  return (
    <group ref={g}>
      {p.kind === 'ammo' ? (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.44, 0.28, 0.32]} />
            <meshStandardMaterial color="#3f5b36" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.3, 0.08, 0.05]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.38, 0.28, 0.28]} />
            <meshStandardMaterial color="#e9eef2" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.15]}>
            <boxGeometry args={[0.2, 0.06, 0.02]} />
            <meshStandardMaterial color="#d33" emissive="#d33" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.15]}>
            <boxGeometry args={[0.06, 0.18, 0.02]} />
            <meshStandardMaterial color="#d33" emissive="#d33" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}
      <mesh position={[0, 0.5, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ================= Rockets & explosions ================= */
function RocketView({ id, pos }: { id: number; pos: THREE.Vector3 }) {
  const g = useRef<THREE.Group>(null!);
  const flame = useRef<THREE.Mesh>(null!);
  const r = G.rockets.find((x) => x.id === id);
  useFrame(() => {
    if (!g.current || !r) return;
    g.current.position.copy(pos);
    tmpV.copy(r.vel).normalize();
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpV);
    g.current.quaternion.copy(tmpQ);
    flame.current.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 1 + Math.random());
  });
  return (
    <group ref={g}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.6, 8]} />
        <meshStandardMaterial color="#8a8f98" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.3, 8]} />
        <meshStandardMaterial color="#c23b2a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={flame} position={[0, 0, -0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.5, 8]} />
        <meshBasicMaterial color="#ff9a3c" toneMapped={false} />
      </mesh>
      <pointLight color="#ff9a3c" intensity={8} distance={8} decay={1.6} />
    </group>
  );
}

function ExplosionView({ id }: { id: number }) {
  const g = useRef<THREE.Group>(null!);
  const outer = useRef<THREE.Mesh>(null!);
  const inner = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const ex = G.explosions.find((x) => x.id === id);
    if (!ex || !g.current) return;
    const k = 1 - ex.life / ex.maxLife;
    g.current.position.copy(ex.pos);
    outer.current.scale.setScalar(0.5 + k * ex.radius);
    inner.current.scale.setScalar(0.3 + k * ex.radius * 0.55);
    (outer.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.75;
    (inner.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.95;
    light.current.intensity = (1 - k) * 90;
  });
  return (
    <group ref={g}>
      <mesh ref={outer}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#ff7a2a" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={inner}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color="#ffe9c4" transparent opacity={0.95} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#ff9a3c" intensity={60} distance={24} decay={1.3} />
    </group>
  );
}

/* ================= Effects pools ================= */
function Effects() {
  const tracerRefs = useRef<THREE.Mesh[]>([]);
  const sparkRefs = useRef<THREE.Mesh[]>([]);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const TMAX = 24, SMAX = PRESET.sparkMax, RMAX = 8;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    for (let i = G.tracers.length - 1; i >= 0; i--) {
      G.tracers[i].life -= dt;
      if (G.tracers[i].life <= 0) G.tracers.splice(i, 1);
    }
    if (G.tracers.length > TMAX) G.tracers.splice(0, G.tracers.length - TMAX);
    // hard cap on live particles: drop the oldest instead of simulating hundreds
    if (G.sparks.length > SMAX) G.sparks.splice(0, G.sparks.length - SMAX);
    for (let i = G.sparks.length - 1; i >= 0; i--) {
      const s = G.sparks[i];
      s.life -= dt;
      s.v.y -= 9 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.v.y < 0) {
        const g = terrainHeight(s.p.x, s.p.z, s.p.y) + 0.03;
        if (s.p.y < g) { s.p.y = g; s.v.y *= -0.3; s.v.x *= 0.7; s.v.z *= 0.7; }
      }
      if (s.life <= 0) G.sparks.splice(i, 1);
    }
    for (let i = 0; i < TMAX; i++) {
      const m = tracerRefs.current[i];
      if (!m) continue;
      const t = G.tracers[i];
      if (!t) { m.visible = false; continue; }
      m.visible = true;
      tmpV.copy(t.b).sub(t.a);
      const len = tmpV.length();
      tmpV2.copy(tmpV).normalize();
      tmpQ.setFromUnitVectors(UP, tmpV2);
      m.quaternion.copy(tmpQ);
      m.position.copy(t.a).addScaledVector(tmpV, 0.5);
      m.scale.set(1, len, 1);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(t.color);
      mat.opacity = Math.max(0, t.life / 0.06) * 0.85;
    }
    for (let i = 0; i < SMAX; i++) {
      const m = sparkRefs.current[i];
      if (!m) continue;
      const s = G.sparks[i];
      if (!s) { m.visible = false; continue; }
      m.visible = true;
      m.position.copy(s.p);
      const k = Math.max(0, s.life / s.maxLife);
      m.scale.setScalar(0.03 + k * 0.09 * s.size);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(s.color);
      mat.opacity = Math.min(1, k * 2.5);
    }
    for (let i = 0; i < RMAX; i++) {
      const m = ringRefs.current[i];
      if (!m) continue;
      const r = G.rings[i];
      if (!r) { m.visible = false; continue; }
      m.visible = true;
      const k = 1 - r.life / r.maxLife;
      m.position.copy(r.pos);
      m.scale.setScalar(0.5 + k * r.radius);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(r.color);
      mat.opacity = (1 - k) * 0.7;
    }
  });

  return (
    <>
      {Array.from({ length: TMAX }).map((_, i) => (
        <mesh key={`t${i}`} visible={false} ref={(el) => { if (el) tracerRefs.current[i] = el; }}>
          <cylinderGeometry args={[0.014, 0.014, 1, 5, 1, true]} />
          <meshBasicMaterial color="#ffe6a8" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: SMAX }).map((_, i) => (
        <mesh key={`sp${i}`} visible={false} ref={(el) => { if (el) sparkRefs.current[i] = el; }}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={1} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: RMAX }).map((_, i) => (
        <mesh key={`r${i}`} visible={false} rotation={[-Math.PI / 2, 0, 0]} ref={(el) => { if (el) ringRefs.current[i] = el; }}>
          <ringGeometry args={[0.85, 1, 40]} />
          <meshBasicMaterial color="#ffb25a" transparent opacity={0.7} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/* ================= Director ================= */
function allyFire(a: Ally, e: Enemy) {
  playGun('ally', Math.hypot(a.pos.x - G.pos.x, a.pos.z - G.pos.z) + 1);
  tmpV.set(a.pos.x, 1.45, a.pos.z);
  const ey = e.type === 'skyeye' ? e.pos.y : 1.1;
  tmpV2.set(e.pos.x, ey, e.pos.z);
  G.tracers.push({ a: tmpV.clone(), b: tmpV2.clone(), life: 0.07, color: '#a8ffc8' });
  tmpV3.set(e.pos.x - a.pos.x, 0, e.pos.z - a.pos.z).normalize();
  damageEnemy(e, 17, tmpV3, 1.5);
  for (let i = 0; i < 2; i++) {
    G.sparks.push({
      p: tmpV2.clone(),
      v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3),
      life: 0.35, maxLife: 0.35, color: '#c2261f', size: 1,
    });
  }
}

function Director({ onDeath }: { onDeath: () => void }) {
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!G.running || G.gameOver) return;

    /* time */
    G.time += dt / G.dayLength;
    if (G.time >= 1) { G.time -= 1; G.day += 1; addLog(`DAY ${G.day}`); }
    const df = dayFactor(G.time);
    const nightNow = 1 - df > 0.5;
    if (nightNow !== G.isNight) {
      G.isNight = nightNow;
      if (nightNow) {
        addLog(`NIGHT ${G.day} — THEY RISE FROM THE GRAVEYARDS`);
        playNightBell();
        G.skyTimer = 10;
      } else {
        G.nightsSurvived += 1;
        addLog('SUNRISE — THE DEAD BURN');
        for (let i = 0; i < 4; i++) spawnPickup(G.pos);
        refreshChestRespawns();
        saveWorld();
      }
    }
    for (let i = G.logs.length - 1; i >= 0; i--) {
      G.logs[i].life -= dt;
      if (G.logs[i].life <= 0) G.logs.splice(i, 1);
    }
    for (let i = G.explosions.length - 1; i >= 0; i--) {
      G.explosions[i].life -= dt;
      if (G.explosions[i].life <= 0) { G.explosions.splice(i, 1); G.bump(); }
    }
    for (let i = G.rings.length - 1; i >= 0; i--) {
      G.rings[i].life -= dt;
      if (G.rings[i].life <= 0) G.rings.splice(i, 1);
    }

    /* spawning */
    const groundAlive = G.enemies.filter((e) => !e.dead && e.type !== 'skyeye').length;
    const skyAlive = G.enemies.filter((e) => !e.dead && e.type === 'skyeye').length;
    if (nightNow && !G.inCave && groundAlive < maxEnemiesForNight()) {
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) {
        G.spawnTimer = Math.max(3.5, 9 - G.day * 0.5);
        if (Math.random() < 0.55) { if (!spawnNightMob(G.pos)) spawnEnemy(G.pos, randomNightEnemy()); }
        else spawnEnemy(G.pos, randomNightEnemy());
      }
    } else G.spawnTimer = Math.max(G.spawnTimer, 2.5);
    if (nightNow && !G.inCave && skyAlive < maxSkyEyes()) {
      G.skyTimer -= dt;
      if (G.skyTimer <= 0) {
        G.skyTimer = 22 + Math.random() * 14;
        spawnSkyEye();
      }
    }
    // yetis: whenever you're up in the snow, day or night
    if (isSnowy(G.pos.x, G.pos.z) && !G.inCave) {
      const yetis = G.enemies.filter((e) => !e.dead && e.type === 'yeti').length;
      if (yetis < 2 + Math.floor(G.day / 3)) {
        G.yetiTimer -= dt;
        if (G.yetiTimer <= 0) {
          G.yetiTimer = 14 + Math.random() * 10;
          spawnYeti(G.pos);
        }
      }
    } else G.yetiTimer = Math.max(G.yetiTimer, 4);

    G.pickupTimer -= dt;
    if (G.pickupTimer <= 0) {
      G.pickupTimer = 9;
      const near = G.pickups.filter((p) => p.pos.distanceTo(G.pos) < 70).length;
      if (near < 6) spawnPickup(G.pos);
      const before = G.pickups.length;
      G.pickups = G.pickups.filter((p) => Math.hypot(p.pos.x - G.pos.x, p.pos.z - G.pos.z) < 140);
      if (G.pickups.length !== before) G.bump();
    }

    playerForward(fwd);
    let listDirty = false;

    /* ---- enemies ---- */
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      if (e.dying > 0) {
        e.dying -= dt * (e.type === 'skyeye' ? 0.7 : e.mob?.arch === 'golem' ? 0.6 : 1.1);
        if (e.type === 'skyeye') e.pos.y -= dt * 6;
        if (e.mob?.arch === 'flyer') e.pos.y = Math.max(terrainHeight(e.pos.x, e.pos.z, e.pos.y), e.pos.y - dt * 8);
        if (e.dying <= 0) {
          // free up the summoner's minion slot
          if (e.mob && e.mob.arch !== 'summoner') {
            const parent = G.enemies.find((o) => o.mob?.arch === 'summoner' && o.mob.minion === e.mob!.id && o.kids > 0);
            if (parent) parent.kids -= 1;
          }
          G.enemies.splice(i, 1); listDirty = true;
        }
        continue;
      }
      if (e.dead) { G.enemies.splice(i, 1); listDirty = true; continue; }
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      const dxp = G.pos.x - e.pos.x;
      const dzp = G.pos.z - e.pos.z;
      const dist = Math.hypot(dxp, dzp);
      if (e.caveId && (e.caveId !== G.inCave || dist > 75)) continue;
      if (!e.caveId && G.inCave && Math.abs(e.pos.y - G.pos.y) > 12) continue;

      // cave dwellers stay home; wandering mobs despawn when far
      if (dist > 110 && !e.sunproof) { G.enemies.splice(i, 1); listDirty = true; continue; }
      // cave dwellers don't chase you back into the daylight; yetis won't leave the snow
      if (e.type === 'yeti') {
        if (dist > 70) { G.enemies.splice(i, 1); listDirty = true; continue; }
        if (!isSnowy(e.pos.x, e.pos.z) && dist > 14) { e.charge = 0; continue; }
      } else if (e.sunproof && !G.inCave && dist > 40) continue;

      if (df > 0.42 && !e.sunproof) {
        e.burn = Math.min(1, e.burn + dt * 0.5);
        e.hp -= dt * 30 * df;
        if (Math.random() < dt * 9) {
          G.sparks.push({
            p: new THREE.Vector3(e.pos.x + (Math.random() - 0.5), (e.type === 'skyeye' ? e.pos.y : 1) + Math.random(), e.pos.z + (Math.random() - 0.5)),
            v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.5, (Math.random() - 0.5) * 0.4),
            life: 0.7, maxLife: 0.7, color: '#ff9a3c', size: 1.2,
          });
        }
        if (e.hp <= 0) { damageEnemy(e, 9999); continue; }
      } else e.burn = Math.max(0, e.burn - dt * 0.6);

      const nx = dist > 0.001 ? dxp / dist : 0;
      const nz = dist > 0.001 ? dzp / dist : 0;

      if (e.type === 'skyeye') {
        // drift above player in a slow orbit
        e.hoverPhase += dt * 0.25;
        const wantX = G.pos.x + Math.cos(e.hoverPhase) * 16;
        const wantZ = G.pos.z + Math.sin(e.hoverPhase) * 16;
        const wantY = Math.max(surfaceHeight(wantX, wantZ), G.pos.y) + 25 + Math.sin(e.hoverPhase * 1.7) * 3;
        e.pos.x = THREE.MathUtils.lerp(e.pos.x, wantX, dt * 0.5);
        e.pos.z = THREE.MathUtils.lerp(e.pos.z, wantZ, dt * 0.5);
        e.pos.y = THREE.MathUtils.lerp(e.pos.y, wantY, dt * 0.5);
        if (e.cooldown > 0) { e.cooldown -= dt; e.charge = Math.max(0, e.charge - dt); }
        if (e.firing > 0) {
          e.firing -= dt;
          e.target.x = THREE.MathUtils.lerp(e.target.x, G.pos.x, dt * 0.55);
          e.target.z = THREE.MathUtils.lerp(e.target.z, G.pos.z, dt * 0.55);
          const pd = Math.hypot(G.pos.x - e.target.x, G.pos.z - e.target.z);
          if (pd < 3.4 && !G.inCave) {
            hurtPlayer(30 * dt);
            G.shake = Math.min(1, G.shake + dt * 2);
            if (Math.random() < dt * 24) {
              G.sparks.push({
                p: new THREE.Vector3(G.pos.x + (Math.random() - 0.5) * 2, 0.5 + Math.random(), G.pos.z + (Math.random() - 0.5) * 2),
                v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4),
                life: 0.35, maxLife: 0.35, color: '#ff5a3a', size: 1.3,
              });
            }
          }
          for (const a of G.allies) {
            if (!a.recruited || a.dead) continue;
            if (Math.hypot(a.pos.x - e.target.x, a.pos.z - e.target.z) < 3.2) {
              a.hp -= 22 * dt;
              a.hitFlash = 0.1;
            }
          }
        } else if (e.cooldown <= 0 && e.burn < 0.4) {
          e.target.x = THREE.MathUtils.lerp(e.target.x, G.pos.x, dt * 4);
          e.target.z = THREE.MathUtils.lerp(e.target.z, G.pos.z, dt * 4);
          const prevC = e.charge;
          e.charge += dt / 3.2;
          if (prevC <= 0 && e.charge > 0) playCharge(3.2, dist, true);
          if (e.charge >= 1) {
            e.charge = 1;
            e.firing = 1.35;
            e.cooldown = 4.5 + Math.random() * 2.5;
            addLog('⚠ SKY-EYE FIRING — RUN!');
            playLaser(1.35, dist, true);
          }
        }
        continue;
      }

      // knockback physics
      if (e.knock.lengthSq() > 0.01) {
        e.pos.x += e.knock.x * dt;
        e.pos.z += e.knock.z * dt;
        e.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
      }
      const isMobFlyer = e.type === 'mob' && (e.mob!.arch === 'flyer' || e.mob!.arch === 'phaser');
      if (e.type !== 'wraith' && !isMobFlyer) {
        const [ex, ez] = collideCircle(e.pos.x, e.pos.z, e.type === 'behemoth' ? 0.9 : e.mob ? Math.min(1.2, 0.4 * e.mob.scale) : 0.4, e.pos.y);
        e.pos.x = ex; e.pos.z = ez;
      }
      if (!(e.type === 'mob' && e.mob!.arch === 'flyer')) {
        const cave = e.caveId ? CAVES.find((c) => c.id === e.caveId) : undefined;
        e.pos.y = cave ? caveFloorHeight(cave, -caveLocal(cave, e.pos.x, e.pos.z)[1]) : terrainHeight(e.pos.x, e.pos.z, e.pos.y);
      }

      /* ---------- data-driven roster AI ---------- */
      if (e.type === 'mob' && e.mob) {
        const m = e.mob;
        const reach = 1.3 * Math.max(0.6, m.scale) + 0.4;
        const canSee = dist < 60;
        const bite = (mult = 1) => { if (dist < reach) hurtPlayer(m.dmg * mult * dt); };
        const walk = (sp: number, dir = 1) => { e.pos.x += nx * sp * dir * dt; e.pos.z += nz * sp * dir * dt; };
        // nearest recruited ally for mobs that target allies too
        let allyT: Ally | null = null, ad = 1e9;
        for (const a of G.allies) {
          if (!a.recruited || a.dead) continue;
          const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
          if (d < ad) { ad = d; allyT = a; }
        }
        const nipAlly = () => { if (allyT && ad < reach + 0.3) { allyT.hp -= m.dmg * 0.6 * dt; allyT.hitFlash = 0.1; } };

        switch (m.arch) {
          case 'rusher':
          case 'swarm': {
            // weave slightly so packs don't stack
            const wob = Math.sin(performance.now() / 220 + e.wobble) * (m.arch === 'swarm' ? 0.9 : 0.35);
            if (dist > reach) { e.pos.x += (nx + -nz * wob) * e.speed * dt; e.pos.z += (nz + nx * wob) * e.speed * dt; }
            bite(); nipAlly();
            break;
          }
          case 'brute': {
            if (e.firing > 0) {
              e.firing -= dt;
              if (e.firing <= 0) {
                G.rings.push({ id: Math.random(), pos: new THREE.Vector3(e.pos.x, e.pos.y + 0.2, e.pos.z), life: 0.6, maxLife: 0.6, radius: 4 + m.scale * 2, color: m.accent });
                if (dist < 4 + m.scale * 2) { hurtPlayer(m.dmg); G.velY = Math.max(G.velY, 5); G.shake = 1; }
                for (const a of G.allies) if (a.recruited && !a.dead && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < 4 + m.scale * 2) { a.hp -= m.dmg; a.hitFlash = 0.2; }
                e.cooldown = 3;
              }
            } else if (e.cooldown > 0) {
              e.cooldown -= dt;
              if (dist > reach) walk(e.speed);
            } else if (dist < 3 + m.scale * 1.5) {
              e.firing = 0.8;
            } else walk(e.speed);
            if (dist < reach && e.firing <= 0) hurtPlayer(m.dmg * 0.4 * dt);
            break;
          }
          case 'ranged': {
            const ideal = 14;
            if (dist < ideal - 4) walk(e.speed, -1);
            else if (dist > ideal + 6) walk(e.speed);
            if (e.cooldown > 0) { e.cooldown -= dt; e.charge = 0; }
            else if (dist < 36 && canSee) {
              e.charge += dt / 1.3;
              if (e.charge >= 1) {
                e.charge = 0; e.cooldown = 1.8 + Math.random() * 1.4;
                const from = new THREE.Vector3(e.pos.x, e.pos.y + hitHeight(e) + 0.3, e.pos.z);
                const to = new THREE.Vector3(G.pos.x, G.pos.y + 1.2, G.pos.z);
                const vel = to.sub(from).normalize().multiplyScalar(24);
                vel.y += dist * 0.1;
                G.projectiles.push({ id: Math.random(), kind: 'mob', pos: from, vel, life: 4, dmg: m.dmg, color: m.projColor ?? m.accent });
                listDirty = true;
              }
            }
            bite(0.5);
            break;
          }
          case 'flyer': {
            // orbit above, then dive through the player
            const flyerCave = e.caveId ? CAVES.find((c) => c.id === e.caveId) : undefined;
            const g = flyerCave ? caveFloorHeight(flyerCave, -caveLocal(flyerCave, e.pos.x, e.pos.z)[1])
              : terrainHeight(e.pos.x, e.pos.z, e.pos.y - 1);
            if (e.firing > 0) {
              e.firing -= dt;
              const ty = G.pos.y + 1.2;
              e.pos.x += nx * e.speed * 1.6 * dt; e.pos.z += nz * e.speed * 1.6 * dt;
              e.pos.y += (ty - e.pos.y) * Math.min(1, dt * 4);
              if (dist < reach + 0.5 && Math.abs(e.pos.y - ty) < 1.5) { hurtPlayer(m.dmg * dt * 2.5); }
              if (e.firing <= 0) e.cooldown = 2.5 + Math.random() * 1.5;
            } else {
              e.hoverPhase += dt * 0.9;
              const ox = Math.cos(e.hoverPhase) * 9, oz = Math.sin(e.hoverPhase) * 9;
              const wx = G.pos.x + ox, wz = G.pos.z + oz;
              const ddx = wx - e.pos.x, ddz = wz - e.pos.z, dd = Math.hypot(ddx, ddz) || 1;
              e.pos.x += (ddx / dd) * Math.min(e.speed, dd) * dt; e.pos.z += (ddz / dd) * Math.min(e.speed, dd) * dt;
              const wantY = Math.max(g, G.pos.y) + 6 + Math.sin(e.hoverPhase * 2) * 1.2;
              e.pos.y += (wantY - e.pos.y) * Math.min(1, dt * 2);
              if (e.cooldown > 0) e.cooldown -= dt;
              else if (dist < 16) { e.firing = 1.1; }
            }
            if (e.pos.y < g + 0.5) e.pos.y = g + 0.5;
            break;
          }
          case 'ambusher': {
            if (!e.awake) {
              if (dist < 7) { e.awake = true; e.firing = 0.5; addLog(`⚠ ${m.name}!`); G.shake = Math.min(1, G.shake + 0.4); }
              break;
            }
            if (e.firing > 0) { e.firing -= dt; walk(e.speed * 2.2); if (dist < reach) hurtPlayer(m.dmg * 1.5 * dt); }
            else { if (dist > reach) walk(e.speed); bite(); }
            if (dist > 45) { e.awake = false; } // re-hide if you escape
            break;
          }
          case 'exploder': {
            if (dist > reach + 0.5) walk(e.speed);
            e.charge = THREE.MathUtils.clamp(1 - (dist - 2) / 10, 0, 1);
            if (dist < 2.2 || e.hp < m.hp * 0.15) {
              explode(new THREE.Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z), m.dmg * 1.4, 5.5 * Math.max(0.8, m.scale), true);
              e.dead = true; e.dying = 0.3; G.kills += 1; addLog(`${m.name} DETONATED`);
              listDirty = true;
            }
            break;
          }
          case 'summoner': {
            if (dist < 10) walk(e.speed, -1);
            else if (dist > 22) walk(e.speed);
            e.cooldown -= dt;
            if (e.cooldown <= 0 && dist < 40 && e.kids < 6) {
              e.cooldown = 4 + Math.random() * 2;
              const kid = MOB_BY_ID[m.minion ?? 'imp'];
              if (kid) {
                const spawned = spawnMobAt({ ...kid, packSize: Math.min(kid.packSize ?? 1, 3) }, e.pos.x + nx * 1.5, e.pos.z + nz * 1.5, e.caveId ? CAVES.find((c) => c.id === e.caveId) : undefined);
                e.kids += spawned.length;
                for (let k = 0; k < 10; k++) G.sparks.push({ p: new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.6, maxLife: 0.6, color: m.accent, size: 1.3 });
                listDirty = true;
              }
            }
            bite(0.6);
            break;
          }
          case 'leech': {
            if (dist > reach) walk(e.speed);
            else {
              // latched: drain, heal self, slow player
              const drain = m.dmg * dt;
              hurtPlayer(drain);
              e.hp = Math.min(e.maxHp * 1.5, e.hp + drain * 1.2);
              G.stamina = Math.max(0, G.stamina - dt * 0.25);
              if (Math.random() < dt * 6) G.sparks.push({ p: new THREE.Vector3(G.pos.x, G.pos.y + 1.2, G.pos.z), v: new THREE.Vector3(-nx * 3, 1, -nz * 3), life: 0.4, maxLife: 0.4, color: '#b01e1e', size: 1 });
            }
            break;
          }
          case 'phaser': {
            if (e.cooldown > 0) {
              e.cooldown -= dt;
              if (dist > reach) walk(e.speed);
              bite();
            } else if (dist < 30) {
              // blink to a random point 3-5 m from the player
              const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 2;
              let bx = G.pos.x + Math.cos(a) * r, bz = G.pos.z + Math.sin(a) * r;
              if (pointBlocked(bx, bz, G.pos.y + 0.5)) { bx = e.pos.x; bz = e.pos.z; }
              for (const at of [e.pos, new THREE.Vector3(bx, terrainHeight(bx, bz, G.pos.y), bz)]) {
                for (let k = 0; k < 8; k++) G.sparks.push({ p: at.clone().add(new THREE.Vector3(0, 1, 0)), v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.4, maxLife: 0.4, color: m.accent, size: 1.1 });
              }
              e.pos.set(bx, terrainHeight(bx, bz, G.pos.y), bz);
              e.cooldown = 2.2 + Math.random();
              e.firing = 0.4;
            } else walk(e.speed);
            break;
          }
          case 'screamer': {
            if (dist > 9) walk(e.speed); else if (dist < 5) walk(e.speed, -1);
            e.cooldown -= dt;
            if (e.cooldown <= 0 && dist < 28) {
              e.cooldown = 6 + Math.random() * 2;
              G.shake = Math.min(1, G.shake + 0.8);
              G.rings.push({ id: Math.random(), pos: new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), life: 0.8, maxLife: 0.8, radius: 18, color: m.accent });
              addLog(`${m.name} SHRIEKS — THE DEAD QUICKEN`);
              for (const o of G.enemies) {
                if (o === e || o.dead) continue;
                if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 24) { o.speed *= 1.25; o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); }
              }
              hurtPlayer(m.dmg * (dist < 10 ? 1 : 0.4));
            }
            break;
          }
          case 'golem': {
            const home = e.home ?? e.pos;
            const hd = Math.hypot(e.pos.x - home.x, e.pos.z - home.z);
            if (!e.awake) {
              if (dist < 9) { e.awake = true; e.cooldown = 1.2; addLog(`🏛 ${m.name} AWAKENS`); G.shake = 1; }
              break;
            }
            // leash: won't chase beyond ~40 m of its altar
            if (dist > 45 || hd > 40) {
              const hx = home.x - e.pos.x, hz = home.z - e.pos.z, hl = Math.hypot(hx, hz) || 1;
              if (hl > 1) { e.pos.x += (hx / hl) * e.speed * dt; e.pos.z += (hz / hl) * e.speed * dt; }
              else e.awake = false;
              break;
            }
            if (e.firing > 0) {
              e.firing -= dt;
              if (e.firing <= 0) {
                G.rings.push({ id: Math.random(), pos: new THREE.Vector3(e.pos.x, e.pos.y + 0.2, e.pos.z), life: 0.7, maxLife: 0.7, radius: 9, color: m.eye });
                if (dist < 8.5) { hurtPlayer(m.dmg); G.velY = 7; G.shake = 1; }
                for (const a of G.allies) if (a.recruited && !a.dead && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < 8.5) { a.hp -= m.dmg; a.hitFlash = 0.2; }
                e.cooldown = 3.2;
              }
            } else if (e.cooldown > 0) {
              e.cooldown -= dt;
              if (dist > reach) walk(e.speed);
            } else if (dist < 6.5) {
              e.firing = 1.0; addLog('⚠ GOLEM SLAM — GET BACK');
            } else if (dist < 34) {
              // tear a boulder from itself and throw
              e.charge += dt / 1.6;
              if (dist > reach) walk(e.speed * 0.5);
              if (e.charge >= 1) {
                e.charge = 0; e.cooldown = 2.6;
                const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.6 * m.scale * 0.8, e.pos.z);
                const to = new THREE.Vector3(G.pos.x, G.pos.y + 1, G.pos.z);
                const vel = to.sub(from).normalize().multiplyScalar(22);
                vel.y += dist * 0.18;
                G.projectiles.push({ id: Math.random(), kind: 'rock', pos: from, vel, life: 4, dmg: m.dmg * 0.8, color: m.skin });
                listDirty = true;
              }
            } else walk(e.speed);
            if (dist < reach && e.firing <= 0) hurtPlayer(m.dmg * 0.35 * dt);
            break;
          }
        }
        continue;
      }

      if (e.type === 'ghoul') {
        // pack hunter: zig-zag sprint, lunge when close
        const wob = Math.sin(performance.now() / 180 + e.wobble) * 0.6;
        const px = -nz, pz = nx;
        if (e.firing > 0) {
          e.firing -= dt;
          e.pos.x += nx * 13 * dt; e.pos.z += nz * 13 * dt;
          if (dist < 1.6) { hurtPlayer(26 * dt); }
        } else if (e.cooldown > 0) {
          e.cooldown -= dt;
          if (dist > 1.5) { e.pos.x += (nx + px * wob) * e.speed * 0.6 * dt; e.pos.z += (nz + pz * wob) * e.speed * 0.6 * dt; }
        } else if (dist < 6 && dist > 1.6) {
          e.firing = 0.35; e.cooldown = 1.6;
        } else if (dist > 1.4) {
          e.pos.x += (nx + px * wob) * e.speed * dt; e.pos.z += (nz + pz * wob) * e.speed * dt;
        }
        if (dist < 1.5) hurtPlayer(14 * dt);
        continue;
      }
      if (e.type === 'wraith') {
        // phases through walls, fades when watched, drains health on touch
        const dot = -nx * fwd.x + -nz * fwd.z;
        e.frozen = dot > 0.86 && dist < 30;
        const sp = e.frozen ? e.speed * 0.35 : e.speed;
        if (dist > 1.2) { e.pos.x += nx * sp * dt; e.pos.z += nz * sp * dt; }
        if (dist < 1.6) { hurtPlayer(11 * dt); G.hurt = Math.min(1, G.hurt + dt * 0.5); }
        continue;
      }
      if (e.type === 'spitter') {
        // keeps distance, charges acid, spits a projectile
        if (dist < 9) { e.pos.x -= nx * e.speed * dt; e.pos.z -= nz * e.speed * dt; }
        else if (dist > 18) { e.pos.x += nx * e.speed * dt; e.pos.z += nz * e.speed * dt; }
        if (e.cooldown > 0) { e.cooldown -= dt; e.charge = 0; }
        else if (dist < 34) {
          e.charge += dt / 1.4;
          if (e.charge >= 1) {
            e.charge = 0; e.cooldown = 2.2 + Math.random();
            const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z);
            const to = new THREE.Vector3(G.pos.x, G.pos.y + 1.2, G.pos.z);
            const vel = to.sub(from).normalize().multiplyScalar(22);
            vel.y += dist * 0.12;
            G.projectiles.push({ id: Math.random(), kind: 'spit', pos: from, vel, life: 4, dmg: 18 });
            listDirty = true;
          }
        }
        if (dist < 1.6) hurtPlayer(10 * dt);
        continue;
      }
      if (e.type === 'behemoth') {
        // armored giant: slow walk, ground slam shockwave
        if (e.firing > 0) {
          e.firing -= dt;
          if (e.firing <= 0) {
            explode(new THREE.Vector3(e.pos.x + nx * 2, e.pos.y + 0.3, e.pos.z + nz * 2), 0, 0.1, false);
            G.rings.push({ id: Math.random(), pos: new THREE.Vector3(e.pos.x, e.pos.y + 0.2, e.pos.z), life: 0.6, maxLife: 0.6, radius: 7, color: '#c9a27a' });
            if (dist < 7) { hurtPlayer(38); G.velY = 6; G.shake = 1; }
            for (const a of G.allies) if (a.recruited && !a.dead && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < 7) { a.hp -= 40; a.hitFlash = 0.2; }
            e.cooldown = 3.5;
          }
        } else if (e.cooldown > 0) {
          e.cooldown -= dt;
          if (dist > 2.4) { e.pos.x += nx * e.speed * dt; e.pos.z += nz * e.speed * dt; }
        } else if (dist < 5) {
          e.firing = 0.9;
          addLog('⚠ BEHEMOTH SLAM — BACK OFF!');
        } else {
          e.pos.x += nx * e.speed * dt; e.pos.z += nz * e.speed * dt;
        }
        if (dist < 2.4 && e.firing <= 0) hurtPlayer(16 * dt);
        continue;
      }
      if (e.type === 'yeti') {
        // mountain brute: lopes in, hurls ice chunks at range, charges when close
        if (e.firing > 0) {
          // charge
          e.firing -= dt;
          e.pos.x += nx * 11 * dt; e.pos.z += nz * 11 * dt;
          if (dist < 2.6) { hurtPlayer(34 * dt); G.shake = Math.min(1, G.shake + dt * 1.5); }
        } else if (e.cooldown > 0) {
          e.cooldown -= dt;
          if (dist > 2.4) { e.pos.x += nx * e.speed * dt; e.pos.z += nz * e.speed * dt; }
        } else if (dist > 12 && dist < 42) {
          // wind up and throw
          e.charge += dt / 1.1;
          if (e.charge >= 1) {
            e.charge = 0; e.cooldown = 2.4 + Math.random() * 1.2;
            const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.8, e.pos.z);
            const to = new THREE.Vector3(G.pos.x, G.pos.y + 1.0, G.pos.z);
            const vel = to.sub(from).normalize().multiplyScalar(26);
            vel.y += dist * 0.16;
            G.projectiles.push({ id: Math.random(), kind: 'ice', pos: from, vel, life: 4, dmg: 30 });
            listDirty = true;
          }
        } else if (dist <= 12 && dist > 2.4) {
          e.charge += dt / 0.7;
          if (e.charge >= 1) { e.charge = 0; e.firing = 0.8; e.cooldown = 1.8; addLog('❄ YETI CHARGE!'); }
        } else {
          e.charge = Math.max(0, e.charge - dt);
          if (dist > 2.4) { e.pos.x += nx * e.speed * dt; e.pos.z += nz * e.speed * dt; }
        }
        if (dist < 2.4 && e.firing <= 0) hurtPlayer(20 * dt);
        continue;
      }

      if (e.type === 'zombie') {
        // target nearest: player or ally
        let td = dist, tnx = nx, tnz = nz, allyT: Ally | null = null;
        for (const a of G.allies) {
          if (!a.recruited || a.dead) continue;
          const ad = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
          if (ad < td) { td = ad; allyT = a; }
        }
        if (allyT) {
          const ax = allyT.pos.x - e.pos.x, az = allyT.pos.z - e.pos.z;
          const al = Math.hypot(ax, az) || 1;
          tnx = ax / al; tnz = az / al;
        }
        if (td > 1.6 && td < 70) {
          const sp = e.speed * (1 - e.burn * 0.5) * (e.firing > 0 ? 0.25 : 1);
          e.pos.x += tnx * sp * dt;
          e.pos.z += tnz * sp * dt;
        }
        if (td < 1.8) {
          if (allyT) { allyT.hp -= 14 * dt; allyT.hitFlash = 0.1; }
          else hurtPlayer(13 * dt);
        }
        if (e.firing > 0) {
          e.firing -= dt;
          if (dist < 30 && Math.abs(e.pos.y - G.pos.y) < 6) {
            hurtPlayer(16 * dt);
            if (Math.random() < dt * 20) {
              G.sparks.push({
                p: new THREE.Vector3(G.pos.x + (Math.random() - 0.5), 1.3 + Math.random() * 0.6, G.pos.z + (Math.random() - 0.5)),
                v: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
                life: 0.3, maxLife: 0.3, color: '#ff5a3a', size: 1,
              });
            }
          }
        } else if (e.cooldown > 0) { e.cooldown -= dt; e.charge = 0; }
        else if (dist < 24 && dist > 2.2 && e.burn < 0.4) {
          const prevC = e.charge;
          e.charge += dt / 2.6;
          if (prevC <= 0 && e.charge > 0) playCharge(2.6, dist, false);
          if (e.charge >= 1) {
            e.charge = 1; e.firing = 0.8; e.cooldown = 3.6 + Math.random() * 2;
            addLog('⚠ ZOMBIE EYES CHARGED');
            playLaser(0.8, dist, false);
          }
        } else e.charge = Math.max(0, e.charge - dt * 0.4);
      } else if (e.type === 'stalker') {
        // The stalker freezes in your gaze, then lunges when you turn away.
        const dot = -nx * fwd.x + -nz * fwd.z;
        const viewRange = G.isNight ? 26 : 45;
        e.frozen = dot > 0.84 && dist < viewRange && dist > 2.0;
        if (!e.frozen && dist > 1.4) {
          const sp = e.speed * (1 - e.burn * 0.6);
          e.pos.x += nx * sp * dt;
          e.pos.z += nz * sp * dt;
        }
        if (dist < 1.7) hurtPlayer(19 * dt);
      } else {
        e.frozen = false;
        if (e.type === 'reaper') {
          if (e.firing > 0) {
            e.firing -= dt;
            e.pos.x += nx * 10.5 * dt;
            e.pos.z += nz * 10.5 * dt;
            if (dist < 2.2) hurtPlayer(38 * dt);
          } else if (e.cooldown > 0) {
            e.cooldown -= dt;
            e.charge = 0;
          } else if (dist < 15 && dist > 2.2) {
            e.charge += dt / 0.9;
            if (e.charge >= 1) {
              e.charge = 0;
              e.firing = 0.72;
              e.cooldown = 4.2;
              addLog('THE REAPER LEAPS — DODGE!');
            }
          } else {
            e.charge = Math.max(0, e.charge - dt * 0.8);
          }
          if (dist > 2 && e.firing <= 0) {
            e.pos.x += nx * e.speed * dt;
            e.pos.z += nz * e.speed * dt;
          }
          if (dist < 2.25 && e.firing <= 0) hurtPlayer(27 * dt);
        } else {
          const reach = e.type === 'zkorbus' ? 2.5 : 1.45;
          const speed = e.type === 'zkorbus' ? e.speed : e.speed * (e.burn > 0 ? 0.65 : 1);
          if (dist > reach) {
            e.pos.x += nx * speed * dt;
            e.pos.z += nz * speed * dt;
          }
          if (dist < reach) {
            const damage = e.type === 'zkorbus' ? 31 : 17;
            hurtPlayer(damage * dt);
          }
        }
      }
    }

    /* ---- allies ---- */
    const recruited = G.allies.filter((a) => a.recruited && !a.dead);
    const slots: [number, number][] = [[-1.7, 2.3], [1.7, 2.5], [0, 3.8]];
    for (const a of G.allies) {
      if (a.dead) continue;
      a.hitFlash = Math.max(0, a.hitFlash - dt);
      if (a.hp <= 0 && a.recruited) {
        a.dead = true;
        addLog(`☠ ${a.name} HAS FALLEN`);
        for (let i = 0; i < 10; i++) {
          G.sparks.push({
            p: new THREE.Vector3(a.pos.x, 1, a.pos.z),
            v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
            life: 0.6, maxLife: 0.6, color: '#b01e1e', size: 1.2,
          });
        }
        listDirty = true;
        continue;
      }
      if (!a.recruited) {
        // idle sway near home
        a.roam += dt;
        continue;
      }
      const slot = slots[recruited.indexOf(a) % slots.length];
      // desired follow point behind player
      const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
      const rx = Math.cos(G.yaw), rz = -Math.sin(G.yaw);
      const wantX = G.pos.x - fx * slot[1] + rx * slot[0];
      const wantZ = G.pos.z - fz * slot[1] + rz * slot[0];
      const ddx = wantX - a.pos.x, ddz = wantZ - a.pos.z;
      const dd = Math.hypot(ddx, ddz);
      // combat: nearest enemy in 40m
      let best: Enemy | null = null, bd = 40;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const ed = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
        if (ed < bd && Math.abs(e.pos.y - a.pos.y) < 15) { bd = ed; best = e; }
      }
      a.cooldown -= dt;
      if (best && a.cooldown <= 0) {
        a.cooldown = 0.55 + Math.random() * 0.4;
        allyFire(a, best);
      }
      if (dd > 1.4) {
        const sp = dd > 12 ? 8 : 5.4;
        const mx = a.pos.x + (ddx / dd) * sp * dt;
        const mz = a.pos.z + (ddz / dd) * sp * dt;
        const [ax, az] = collideCircle(mx, mz, 0.4, a.pos.y);
        a.pos.x = ax; a.pos.z = az;
        a.pos.y = terrainHeight(ax, az, a.pos.y);
      }
    }

    /* ---- rockets ---- */
    for (let i = G.rockets.length - 1; i >= 0; i--) {
      const r = G.rockets[i];
      r.life -= dt;
      r.spin += dt * 12;
      r.vel.y -= 6 * dt;
      r.pos.addScaledVector(r.vel, dt);
      if (Math.random() < 0.8) {
        G.sparks.push({
          p: r.pos.clone(),
          v: new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)),
          life: 0.3, maxLife: 0.3, color: Math.random() < 0.5 ? '#ff9a3c' : '#888888', size: 1,
        });
      }
      let boom = r.life <= 0 || r.pos.y <= terrainHeight(r.pos.x, r.pos.z, r.pos.y) + 0.25;
      if (!boom && pointBlocked(r.pos.x, r.pos.z, r.pos.y)) boom = true;
      if (!boom) {
        for (const e of G.enemies) {
          if (e.dead) continue;
          const ey = e.type === 'skyeye' ? e.pos.y : e.pos.y + 1;
          const d = Math.hypot(e.pos.x - r.pos.x, ey - r.pos.y, e.pos.z - r.pos.z);
          if (d < (e.type === 'skyeye' ? 3.6 : 1.3)) { boom = true; break; }
        }
      }
      if (boom) {
        explode(r.pos.clone(), r.dmg, r.radius, true);
        G.rockets.splice(i, 1);
        listDirty = true;
      }
    }

    /* ---- magic fireballs & acid spit ---- */
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];
      const ice = p.kind === 'ice';
      const rock = p.kind === 'rock';
      p.life -= dt;
      p.vel.y -= (ice ? 11 : rock ? 13 : 9) * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (Math.random() < 0.6) {
        G.sparks.push({
          p: p.pos.clone(),
          v: new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5),
          life: 0.3, maxLife: 0.3, color: ice ? '#dff3ff' : '#9adf1a', size: 1.1,
        });
      }
      const ground = terrainHeight(p.pos.x, p.pos.z, p.pos.y);
      let hit = p.life <= 0 || p.pos.y <= ground + 0.15 || pointBlocked(p.pos.x, p.pos.z, p.pos.y);
      const pd = Math.hypot(G.pos.x - p.pos.x, G.pos.y + 1.2 - p.pos.y, G.pos.z - p.pos.z);
      if (pd < (ice || rock ? 1.5 : 1.1)) {
        hurtPlayer(p.dmg);
        G.hurt = 1;
        if (ice || rock) { G.velY = Math.max(G.velY, rock ? 6 : 4); G.shake = 1; }
        hit = true;
      }
      if (hit) {
        if (rock) {
          explode(p.pos.clone(), p.dmg * 0.5, 4.5, true);
        } else if (ice) {
          // ice shatters: splash damage to anyone nearby
          const pd2 = Math.hypot(G.pos.x - p.pos.x, G.pos.z - p.pos.z);
          if (pd2 < 3.5 && pd >= 1.5) hurtPlayer(p.dmg * 0.4);
          G.rings.push({ id: Math.random(), pos: new THREE.Vector3(p.pos.x, ground + 0.2, p.pos.z), life: 0.4, maxLife: 0.4, radius: 4, color: '#bfe8ff' });
        }
        for (let k = 0; k < (ice ? 16 : 10); k++) {
          G.sparks.push({
            p: p.pos.clone(),
            v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6),
            life: 0.55, maxLife: 0.55, color: ice ? '#eaf6ff' : '#b8ff2a', size: ice ? 1.6 : 1.3,
          });
        }
        G.projectiles.splice(i, 1); listDirty = true;
      }
    }

    /* ---- crossbow bolts ---- */
    for (let i = G.bolts.length - 1; i >= 0; i--) {
      const b = G.bolts[i];
      b.life -= dt;
      b.vel.y -= 4 * dt;
      b.pos.addScaledVector(b.vel, dt);
      let gone = b.life <= 0 || b.pos.y <= terrainHeight(b.pos.x, b.pos.z, b.pos.y) || pointBlocked(b.pos.x, b.pos.z, b.pos.y);
      if (!gone) {
        for (const e of G.enemies) {
          if (e.dead) continue;
          const ey = e.type === 'skyeye' ? e.pos.y : e.pos.y + hitHeight(e);
          if (Math.hypot(e.pos.x - b.pos.x, ey - b.pos.y, e.pos.z - b.pos.z) < hitRadius(e) + 0.25) {
            tmpV3.copy(b.vel).setY(0).normalize();
            damageEnemy(e, b.dmg, tmpV3, 3);
            gone = true;
            break;
          }
        }
      }
      if (gone) { G.bolts.splice(i, 1); listDirty = true; }
    }

    /* ---- pickups ---- */
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const p = G.pickups[i];
      if (p.pos.distanceTo(G.pos) < 1.8) {
        playPickup();
        if (p.kind === 'ammo' && p.weapon) {
          G.ammo[p.weapon] += p.amount;
          addLog(`+${p.amount} ${WEAPONS[p.weapon].short} AMMO`);
        } else {
          G.health = Math.min(G.maxHealth, G.health + p.amount);
          addLog(`+${p.amount} HEALTH`);
        }
        G.pickups.splice(i, 1);
        listDirty = true;
      }
    }

    /* ---- interact scan ---- */
    let prompt: string | null = null;
    let target: { kind: 'chest' | 'ally'; id: number } | null = null;
    let bestD = 3;
    for (const c of G.chests) {
      if (c.opened) continue;
      const d = c.pos.distanceTo(G.pos);
      if (d < bestD) {
        bestD = d;
        prompt = `[E] OPEN ${c.label} — ${c.weapon ? WEAPONS[c.weapon].name : 'SUPPLIES'}`;
        target = { kind: 'chest', id: c.id };
      }
    }
    for (const a of G.allies) {
      if (a.recruited || a.dead) continue;
      const d = a.pos.distanceTo(G.pos);
      if (d < bestD) {
        bestD = d;
        prompt = `[E] RECRUIT ${a.name}`;
        target = { kind: 'ally', id: a.id };
      }
    }
    G.interactPrompt = prompt;
    G.interactTarget = target;

    /* ---- damage / death ---- */
    if (G.health <= 0 && !G.gameOver) {
      G.health = 0;
      G.gameOver = true;
      G.running = false;
      onDeath();
      return;
    }
    G.hurt = Math.max(0, G.hurt - dt * 1.2);
    G.shake = Math.max(0, G.shake - dt * 2.2);
    G.boomFlash = Math.max(0, G.boomFlash - dt * 1.8);

    if (listDirty) G.bump();
  });

  return null;
}

/* ================= Scene root ================= */
/* Memoized wrappers: G.bump() re-renders the root, but static/world pieces and
   per-entity views skip reconciliation unless their (stable) props change. */
const MSky = memo(SkyAndLight);
const MWild = memo(Wilderness);
const MPlayer = memo(Player);
const MViewModel = memo(ViewModel);
const MEffects = memo(Effects);
const MEnemy = memo(EnemyView);
const MAlly = AllyView;
const MChest = memo(ChestView);
const MPickup = memo(PickupView);
const MRocket = memo(RocketView);
const MProjectile = memo(ProjectileView);
const MBolt = memo(BoltView);
const MExplosion = memo(ExplosionView);

/* Dynamic entity lists live in their own subscriber so a bump never touches the world. */
function Entities() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    G.bump = force;
    return () => { G.bump = () => {}; };
  }, []);
  return (
    <>
      {G.enemies.map((e) => <MEnemy key={e.id} e={e} />)}
      {G.allies.map((a) => <MAlly key={a.id} a={a} />)}
      {G.chests.map((c) => <MChest key={c.id} c={c} />)}
      {G.pickups.map((p) => <MPickup key={p.id} p={p} />)}
      {G.rockets.map((r) => <MRocket key={r.id} id={r.id} pos={r.pos} />)}
      {G.projectiles.map((p) => <MProjectile key={p.id} p={p} />)}
      {G.bolts.map((b) => <MBolt key={b.id} b={b} />)}
      {G.explosions.map((x) => <MExplosion key={x.id} id={x.id} />)}
    </>
  );
}

export default function Scene({ onDeath }: { onDeath: () => void }) {
  return (
    <>
      <MSky />
      <MWild />
      <Town />
      <MPlayer />
      <MViewModel />
      <Director onDeath={onDeath} />
      <MEffects />
      <Entities />
    </>
  );
}
