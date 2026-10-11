import * as THREE from 'three';
import { playExplosion, playGore, playGroan, playHurt, playChest, playRecruit } from './audio';
import { MOBS, MOB_BY_ID, GOLEMS, mobsFor, type MobDef, type Habitat } from './monsters';

/* ============================ Weapons ============================ */
export type WeaponId =
  | 'pistol' | 'shotgun' | 'smg'
  | 'ak47' | 'm16a4' | 'm16a6' | 'minigun'
  | 'bazooka' | 'rpg'
  | 'revolver' | 'sniper' | 'crossbow' | 'flamer'
  | 'uzi' | 'saw' | 'm14' | 'aa12';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  short: string;
  damage: number;
  rpm: number;
  pellets: number;
  spread: number;
  auto: boolean;
  range: number;
  recoil: number;
  color: string;
  desc: string;
  explosive?: boolean;
  blastRadius?: number;
  projectileSpeed?: number;
  moveSlow?: number;
  burst?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'M119 PISTOL', short: 'M119', damage: 30, rpm: 240, pellets: 1,
    spread: 0.008, auto: false, range: 85, recoil: 0.07, color: '#9aa3b2',
    desc: 'Reliable sidearm. Infinite respect, limited punch.',
  },
  shotgun: {
    id: 'shotgun', name: 'BREACHER 12G', short: '12G', damage: 15, rpm: 78, pellets: 8,
    spread: 0.07, auto: false, range: 30, recoil: 0.22, color: '#8a6b4a',
    desc: 'Room-clearer. Devastating up close.',
  },
  smg: {
    id: 'smg', name: 'WHISPER SMG', short: 'SMG', damage: 14, rpm: 720, pellets: 1,
    spread: 0.028, auto: true, range: 52, recoil: 0.045, color: '#6f7686',
    desc: 'Bullet hose. Shreds stalkers that get close.',
  },
  ak47: {
    id: 'ak47', name: 'AK-47', short: 'AK', damage: 36, rpm: 600, pellets: 1,
    spread: 0.02, auto: true, range: 95, recoil: 0.085, color: '#a5763f',
    desc: 'Legendary workhorse. Heavy hits, wooden soul.',
  },
  m16a4: {
    id: 'm16a4', name: 'M16-A4', short: 'A4', damage: 30, rpm: 480, pellets: 1,
    spread: 0.005, auto: false, range: 140, recoil: 0.06, color: '#5a6478',
    desc: 'Surgical burst rifle. Laser-accurate, sky-eye killer.',
  },
  m16a6: {
    id: 'm16a6', name: 'M16-A6 VESPER', short: 'A6', damage: 46, rpm: 520, pellets: 1,
    spread: 0.013, auto: true, range: 125, recoil: 0.075, color: '#4e6fb0',
    desc: 'Prototype brawler. Fast, heavy, hungry for ammo.',
  },
  minigun: {
    id: 'minigun', name: 'M134 MINIGUN', short: 'MINI', damage: 17, rpm: 2000, pellets: 1,
    spread: 0.05, auto: true, range: 75, recoil: 0.028, color: '#3d434f',
    desc: 'Hold to spin up. Deletes everything in front of you.',
    moveSlow: 0.55,
  },
  bazooka: {
    id: 'bazooka', name: 'M9 BAZOOKA', short: 'ZOOK', damage: 170, rpm: 38, pellets: 1,
    spread: 0.004, auto: false, range: 170, recoil: 0.5, color: '#5c6650',
    desc: 'Fast straight rocket. Big boom, small mercy.',
    explosive: true, blastRadius: 6.5, projectileSpeed: 52,
  },
  rpg: {
    id: 'rpg', name: 'REAPER LAUNCHER', short: 'RPG', damage: 260, rpm: 30, pellets: 1,
    spread: 0.004, auto: false, range: 170, recoil: 0.62, color: '#7a3b2e',
    desc: 'Slow fat warhead. Levels crowds and sky-eyes.',
    explosive: true, blastRadius: 9.5, projectileSpeed: 34,
  },
  revolver: {
    id: 'revolver', name: 'JUDGE .454', short: '.454', damage: 92, rpm: 110, pellets: 1,
    spread: 0.006, auto: false, range: 110, recoil: 0.32, color: '#8c8f99',
    desc: 'Hand cannon. Six rounds of pure stopping power.',
  },
  sniper: {
    id: 'sniper', name: 'LONGSHOT .50', short: 'LONG', damage: 240, rpm: 42, pellets: 1,
    spread: 0.001, auto: false, range: 260, recoil: 0.55, color: '#4a5a4a',
    desc: 'Anti-material rifle. One shot, one grave.',
  },
  crossbow: {
    id: 'crossbow', name: 'SILENT WIDOW', short: 'XBOW', damage: 130, rpm: 55, pellets: 1,
    spread: 0.003, auto: false, range: 90, recoil: 0.12, color: '#3f3a30',
    desc: 'Silent bolts. Monsters never hear you coming.',
  },
  flamer: {
    id: 'flamer', name: 'HELLBREATH', short: 'FIRE', damage: 9, rpm: 1400, pellets: 3,
    spread: 0.09, auto: true, range: 14, recoil: 0.01, color: '#b8502a',
    desc: 'Short range inferno. The dead burn beautifully.',
    moveSlow: 0.8,
  },
  uzi: {
    id: 'uzi', name: 'MICRO UZI', short: 'UZI', damage: 12, rpm: 1100, pellets: 1,
    spread: 0.045, auto: true, range: 40, recoil: 0.04, color: '#3a3f47',
    desc: 'Machine pistol. Empties a mag before you blink.',
  },
  saw: {
    id: 'saw', name: 'M249 SAW', short: 'SAW', damage: 28, rpm: 780, pellets: 1,
    spread: 0.03, auto: true, range: 100, recoil: 0.06, color: '#4f5a46',
    desc: 'Belt-fed squad weapon. Suppress and destroy.',
    moveSlow: 0.78,
  },
  m14: {
    id: 'm14', name: 'M14 EBR', short: 'M14', damage: 78, rpm: 240, pellets: 1,
    spread: 0.003, auto: false, range: 190, recoil: 0.2, color: '#5c5a52',
    desc: 'Marksman rifle. Heavy 7.62 with a long reach.',
  },
  aa12: {
    id: 'aa12', name: 'AA-12 AUTO', short: 'AA12', damage: 13, rpm: 300, pellets: 8,
    spread: 0.08, auto: true, range: 26, recoil: 0.16, color: '#2f3338',
    desc: 'Full-auto drum shotgun. A wall of buckshot.',
  },
};

export const WORDER: WeaponId[] = [
  'pistol', 'revolver', 'uzi', 'smg', 'shotgun', 'aa12', 'ak47', 'm16a4', 'm16a6', 'm14', 'sniper',
  'crossbow', 'flamer', 'saw', 'minigun', 'bazooka', 'rpg',
];

export const EMPTY_OWNED: Record<WeaponId, boolean> = {
  pistol: true, shotgun: false, smg: false, ak47: false, m16a4: false, m16a6: false,
  minigun: false, bazooka: false, rpg: false, revolver: false, sniper: false, crossbow: false, flamer: false,
  uzi: false, saw: false, m14: false, aa12: false,
};
export const EMPTY_AMMO: Record<WeaponId, number> = {
  pistol: 120, shotgun: 0, smg: 0, ak47: 0, m16a4: 0, m16a6: 0,
  minigun: 0, bazooka: 0, rpg: 0, revolver: 0, sniper: 0, crossbow: 0, flamer: 0,
  uzi: 0, saw: 0, m14: 0, aa12: 0,
};

/* ============================ Entities ============================ */
export type EnemyType =
  | 'zombie' | 'stalker' | 'skeleton' | 'reaper' | 'zkorbus' | 'skyeye'
  | 'ghoul' | 'wraith' | 'behemoth' | 'spitter' | 'yeti' | 'mob';

export interface Enemy {
  id: number;
  type: EnemyType;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  charge: number;
  firing: number;
  cooldown: number;
  burn: number;
  dying: number;
  dead: boolean;
  wobble: number;
  frozen: boolean;
  hitFlash: number;
  knock: THREE.Vector3;
  target: THREE.Vector3; // skyeye ground target
  hoverPhase: number;
  frozenTimer: number;   // stun timer
  sunproof: boolean;     // cave dwellers do not burn
  mob?: MobDef;          // data-driven roster monster (type === 'mob')
  awake: boolean;        // golems/ambushers start dormant
  kids: number;          // summoner: live minions spawned
  home?: THREE.Vector3;  // golems return here
  caveId?: string;
}

export interface Projectile {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  kind: 'spit' | 'ice' | 'mob' | 'rock';
  color?: string;
}

export interface Bolt {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
}

export interface Ally {
  id: number;
  name: string;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  recruited: boolean;
  cooldown: number;
  wobble: number;
  dead: boolean;
  hitFlash: number;
  jacket: string;
  roam: number;
}

export interface Chest {
  id: number;
  pos: THREE.Vector3;
  rot: number;
  opened: boolean;
  label: string;
  weapon?: WeaponId;
  ammoWeapon?: WeaponId;
  ammoAmount: number;
  medkit: number;
  openAnim: number;
  respawnAtDay: number;
  seedLoot: number;
}

export type PickupKind = 'ammo' | 'medkit';

export interface Pickup {
  id: number;
  kind: PickupKind;
  weapon?: WeaponId;
  amount: number;
  pos: THREE.Vector3;
  spin: number;
}

export interface Rocket {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  radius: number;
  spin: number;
}

export interface Explosion {
  id: number;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
}

export interface Tracer { a: THREE.Vector3; b: THREE.Vector3; life: number; color: string }
export interface Spark { p: THREE.Vector3; v: THREE.Vector3; life: number; maxLife: number; color: string; size: number }
export interface LogLine { id: number; text: string; life: number }
export interface Ring { id: number; pos: THREE.Vector3; life: number; maxLife: number; radius: number; color: string }

/* -------- colliders -------- */
export interface BoxCollider { x1: number; z1: number; x2: number; z2: number; bottom?: number; top?: number }
export interface CircleCollider { x: number; z: number; r: number; bottom?: number; top?: number }

export interface HouseDef {
  x: number; z: number; w: number; d: number; rot: number;
  wall: string; roof: string; trim: string;
}

/* ============================ World layout ============================ */
export interface TownDef { id: string; name: string; x: number; z: number; radius: number; wellZ: number; church: boolean }
export const TOWNS: TownDef[] = [
  { id: 'vesper', name: 'VESPER', x: 0, z: 0, radius: 30, wellZ: 2, church: true },
  { id: 'ashford', name: 'ASHFORD HOLLOW', x: 150, z: 90, radius: 26, wellZ: 2, church: false },
  { id: 'brimstone', name: 'BRIMSTONE CROSSING', x: -170, z: 110, radius: 26, wellZ: 2, church: true },
  { id: 'mourn', name: 'MOURNWICK', x: 40, z: -210, radius: 24, wellZ: 2, church: false },
];

export const HOUSES: HouseDef[] = [
  // Vesper
  { x: -13, z: -8, w: 8, d: 7, rot: 0.35, wall: '#8d7f6a', roof: '#5e2f28', trim: '#3d3128' },
  { x: 13, z: -8, w: 8, d: 7, rot: -0.35, wall: '#7d8a94', roof: '#33414e', trim: '#2b2620' },
  { x: -15, z: 13, w: 7, d: 8, rot: -0.3, wall: '#93826a', roof: '#4a3320', trim: '#3a2d22' },
  { x: 15, z: 13, w: 7, d: 8, rot: 0.3, wall: '#857768', roof: '#63282a', trim: '#33291f' },
  { x: 0, z: -26, w: 10, d: 13, rot: 0, wall: '#9a938a', roof: '#3d3a4a', trim: '#2e2b36' }, // church
  // Ashford Hollow
  { x: 138, z: 80, w: 8, d: 7, rot: 0.2, wall: '#7f6f5c', roof: '#4a2a22', trim: '#2f2620' },
  { x: 163, z: 82, w: 7, d: 7, rot: -0.4, wall: '#8a8c86', roof: '#2f3a44', trim: '#262522' },
  { x: 150, z: 108, w: 9, d: 8, rot: 0.05, wall: '#9b8b73', roof: '#5a3a26', trim: '#3a2d22' },
  { x: 132, z: 103, w: 6, d: 6, rot: -0.6, wall: '#766a5a', roof: '#3f2b25', trim: '#2b2420' },
  // Brimstone Crossing
  { x: -182, z: 98, w: 8, d: 8, rot: 0.5, wall: '#8d7067', roof: '#4e2420', trim: '#33241f' },
  { x: -158, z: 100, w: 7, d: 7, rot: -0.2, wall: '#7a7470', roof: '#3a3a44', trim: '#26262a' },
  { x: -170, z: 128, w: 11, d: 13, rot: 0, wall: '#9c948b', roof: '#2e2a3a', trim: '#2a2630' }, // church
  { x: -186, z: 122, w: 6, d: 7, rot: 0.9, wall: '#86765f', roof: '#5a3324', trim: '#352a22' },
  // Mournwick
  { x: 28, z: -222, w: 8, d: 7, rot: 0.3, wall: '#6f6f78', roof: '#2a2f3a', trim: '#1f2229' },
  { x: 54, z: -220, w: 7, d: 8, rot: -0.3, wall: '#7c7466', roof: '#4a3024', trim: '#2c2520' },
  { x: 40, z: -196, w: 9, d: 7, rot: 0.1, wall: '#8d8577', roof: '#3b2f2a', trim: '#2a2420' },
];

export interface GraveyardDef { x: number; z: number; w: number; d: number; gate: 'south' | 'west'; crypt: boolean }
export const GRAVEYARDS: GraveyardDef[] = [
  { x: 34, z: -20, w: 26, d: 22, gate: 'south', crypt: true },
  { x: 26.5, z: -3.5, w: 13, d: 10, gate: 'west', crypt: false },
  { x: 180, z: 108, w: 18, d: 14, gate: 'west', crypt: false },
  { x: -140, z: 128, w: 20, d: 16, gate: 'west', crypt: true },
  { x: 70, z: -210, w: 22, d: 18, gate: 'west', crypt: true },
];
export const GRAVEYARD = GRAVEYARDS[0];

/* -------- ruins: fallen temples guarded by golems -------- */
export interface RuinDef { id: string; name: string; x: number; z: number; r: number; rot: number; golem: string; swamp: boolean }
export const RUINS: RuinDef[] = [
  { id: 'r1', name: 'THE SUNKEN CHAPEL', x: -70, z: 50, r: 16, rot: 0.4, golem: 'mossgolem', swamp: true },
  { id: 'r2', name: 'KING\'S FOLLY', x: 95, z: 10, r: 18, rot: -0.7, golem: 'stonegolem', swamp: false },
  { id: 'r3', name: 'THE BROKEN CROWN', x: -40, z: -110, r: 20, rot: 1.2, golem: 'stonegolem', swamp: false },
  { id: 'r4', name: 'IRONWORKS OF VESSEL', x: 190, z: -40, r: 20, rot: 0.1, golem: 'irongolem', swamp: false },
  { id: 'r5', name: 'MIRE OF THE DROWNED', x: 120, z: 170, r: 18, rot: 2.3, golem: 'mossgolem', swamp: true },
  { id: 'r6', name: 'THE EMBER THRONE', x: -230, z: 200, r: 22, rot: -1.6, golem: 'obsidiangolem', swamp: false },
  { id: 'r7', name: 'HOLLOW BASILICA', x: 40, z: 250, r: 20, rot: 0.9, golem: 'irongolem', swamp: false },
];
export function ruinAt(x: number, z: number): RuinDef | null {
  for (const r of RUINS) if (Math.hypot(x - r.x, z - r.z) < r.r + 6) return r;
  return null;
}

export interface RuinPiece { kind: 'column' | 'stump' | 'wall' | 'arch' | 'altar' | 'statue'; x: number; z: number; rot: number; h: number; w: number }
/** Deterministic layout for a ruin: ring of columns (some broken), wall fragments, a central altar. */
export function ruinPieces(r: RuinDef): RuinPiece[] {
  let s = r.x * 7.13 + r.z * 3.71 + 11;
  const rnd = () => { s = Math.sin(s * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const out: RuinPiece[] = [];
  const cols = 10 + Math.floor(rnd() * 4);
  for (let i = 0; i < cols; i++) {
    const a = r.rot + (i / cols) * Math.PI * 2;
    const rad = r.r * 0.72;
    const broken = rnd() < 0.4;
    out.push({ kind: broken ? 'stump' : 'column', x: r.x + Math.cos(a) * rad, z: r.z + Math.sin(a) * rad, rot: a, h: broken ? 1 + rnd() * 2 : 6 + rnd() * 2, w: 0.7 });
  }
  const walls = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < walls; i++) {
    const a = r.rot + rnd() * Math.PI * 2;
    const rad = r.r * (0.85 + rnd() * 0.15);
    out.push({ kind: 'wall', x: r.x + Math.cos(a) * rad, z: r.z + Math.sin(a) * rad, rot: a + Math.PI / 2, h: 2 + rnd() * 2.5, w: 4 + rnd() * 4 });
  }
  const a0 = r.rot + Math.PI * 0.5;
  out.push({ kind: 'arch', x: r.x + Math.cos(a0) * r.r * 0.95, z: r.z + Math.sin(a0) * r.r * 0.95, rot: a0 + Math.PI / 2, h: 7, w: 5 });
  out.push({ kind: 'altar', x: r.x, z: r.z, rot: r.rot, h: 1.2, w: 3 });
  for (let i = 0; i < 2; i++) {
    const a = r.rot + Math.PI * (0.15 + i * 0.7);
    out.push({ kind: 'statue', x: r.x + Math.cos(a) * r.r * 0.35, z: r.z + Math.sin(a) * r.r * 0.35, rot: a + Math.PI, h: 3.4, w: 1 });
  }
  return out;
}

/* -------- terrain: hills + caves -------- */
export interface HillDef { x: number; z: number; r: number; h: number }
export const HILLS: HillDef[] = [
  // foothills near the towns
  { x: 80, z: -60, r: 42, h: 11 }, { x: -90, z: -40, r: 50, h: 14 }, { x: 110, z: 40, r: 36, h: 8 },
  { x: -60, z: 70, r: 44, h: 10 }, { x: 20, z: 140, r: 55, h: 15 }, { x: -200, z: 40, r: 48, h: 12 },
  { x: 200, z: 160, r: 46, h: 13 }, { x: -20, z: -150, r: 40, h: 9 }, { x: 120, z: -170, r: 52, h: 16 },
  { x: -150, z: 190, r: 40, h: 10 },
  // the Greywall mountain range (east) and the Widow's Teeth (west)
  { x: 250, z: -40, r: 70, h: 34 }, { x: 290, z: 20, r: 60, h: 42 }, { x: 320, z: -90, r: 75, h: 48 },
  { x: 270, z: 110, r: 55, h: 30 }, { x: 350, z: 60, r: 80, h: 56 },
  { x: -250, z: -120, r: 62, h: 30 }, { x: -300, z: -60, r: 70, h: 46 }, { x: -330, z: -170, r: 80, h: 52 },
  { x: -280, z: -220, r: 60, h: 38 }, { x: -210, z: -200, r: 50, h: 26 },
  // northern peaks
  { x: 60, z: -300, r: 80, h: 44 }, { x: -40, z: -330, r: 70, h: 50 }, { x: 150, z: -280, r: 60, h: 36 },
  // the Pale Crown — true mountains, permanently snow-capped
  { x: -120, z: -330, r: 95, h: 72 }, { x: 240, z: -260, r: 90, h: 66 }, { x: 330, z: -180, r: 85, h: 78 },
  { x: -340, z: 60, r: 90, h: 70 }, { x: 60, z: 330, r: 100, h: 64 }, { x: -220, z: 320, r: 88, h: 68 },
];

export const SNOW_LINE = 22;

/** raw hill height (no towns / caves / bumps) */
function hillHeight(x: number, z: number): number {
  let h = 0;
  for (const hill of HILLS) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d < hill.r) {
      const k = 1 - d / hill.r;
      h += hill.h * k * k * (3 - 2 * k);
    }
  }
  return h;
}

/* Caves are defined by the hill they bore into. The entrance sits on the hill's
   slope (not the peak) and the tunnel runs straight toward the summit. All cave
   math uses local axes: +X right, -Z into the tunnel, world = R(-rot) * local. */
export interface CaveDef {
  id: string; x: number; z: number; rot: number; depth: number; width: number;
  boss: boolean; name: string; floorY: number; drop: number; lava: boolean; crystal: string;
}
interface CaveSpec {
  id: string; hill: number; rot: number; depth: number; width: number; boss: boolean;
  name: string; drop: number; lava: boolean; crystal: string; inset?: number;
}
const CAVE_SPECS: CaveSpec[] = [
  { id: 'c1', hill: 0, rot: Math.PI * 0.9, depth: 260, width: 8, drop: 88, lava: false, crystal: '#66d9ff', boss: false, name: 'HOWLING CAVE' },
  { id: 'c2', hill: 1, rot: Math.PI * 0.15, depth: 310, width: 10, drop: 108, lava: true, crystal: '#b8a0ff', boss: false, name: 'BONE HOLLOW' },
  { id: 'c3', hill: 4, rot: -Math.PI * 0.5, depth: 290, width: 9, drop: 95, lava: false, crystal: '#6ae6ca', boss: false, name: 'DROWNED GROTTO' },
  { id: 'c4', hill: 8, rot: Math.PI * 0.6, depth: 330, width: 10, drop: 120, lava: true, crystal: '#76ed99', boss: false, name: 'SPITTER DEN' },
  { id: 'c5', hill: 15, rot: Math.PI * 0.3, depth: 390, width: 12, drop: 150, lava: true, crystal: '#c5a9ff', boss: true, name: 'THE GREYWALL MINE' },
  { id: 'c6', hill: 11, rot: -Math.PI * 0.7, depth: 420, width: 12, drop: 165, lava: true, crystal: '#ffbb66', boss: true, name: 'IRONJAW SHAFT' },
  { id: 'c7', hill: 20, rot: Math.PI * 0.7, depth: 360, width: 10, drop: 134, lava: false, crystal: '#bdeaff', boss: false, name: 'FROSTBITE HOLLOW' },
];
export const CAVES: CaveDef[] = CAVE_SPECS.map((s) => {
  const hill = HILLS[s.hill];
  // tunnel direction in world space for local -Z under R(-rot)
  const dx = Math.sin(s.rot), dz = -Math.cos(s.rot);
  const inset = s.inset ?? 0.78;
  const x = hill.x - dx * hill.r * inset;
  const z = hill.z - dz * hill.r * inset;
  const floorY = surfaceHeight(x, z);
  return {
    id: s.id, x, z, rot: s.rot, depth: s.depth, width: s.width, boss: s.boss,
    name: s.name, floorY, drop: s.drop, lava: s.lava, crystal: s.crystal,
  };
});

/** The surface never follows the underground floor: mountain silhouettes stay intact. */
export function surfaceHeight(x: number, z: number): number {
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.radius + 6) return 0;
  }
  for (const g of GRAVEYARDS) {
    if (x > g.x - g.w / 2 - 4 && x < g.x + g.w / 2 + 4 && z > g.z - g.d / 2 - 4 && z < g.z + g.d / 2 + 4) return 0;
  }
  const h = hillHeight(x, z);
  // ruins sit on a level plinth (swamp ruins sink slightly into the bog)
  for (const r of RUINS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d < r.r + 10) {
      const base = (r.swamp ? -0.6 : 0.4) + hillHeight(r.x, r.z);
      const t = THREE.MathUtils.smoothstep(d, r.r + 2, r.r + 10);
      return THREE.MathUtils.lerp(base, h, t);
    }
  }
  // soft bumpiness in the wild
  const bump = Math.sin(x * 0.045) * Math.cos(z * 0.038) * 0.9 + Math.sin(x * 0.11 + z * 0.07) * 0.4;
  const townFade = Math.min(1, ...TOWNS.map((t) => Math.max(0, (Math.hypot(x - t.x, z - t.z) - t.radius - 6) / 25)));
  return h + bump * townFade;
}

export function isSnowy(x: number, z: number) {
  return hillHeight(x, z) > SNOW_LINE;
}

export function caveFloorHeight(c: CaveDef, distance: number): number {
  return c.floorY - c.drop * THREE.MathUtils.smoothstep(distance, 8, c.depth - 28);
}

export function caveWorld(c: CaveDef, lx: number, distance: number, aboveFloor = 0): THREE.Vector3 {
  const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
  return new THREE.Vector3(
    c.x + lx * cos + distance * sin,
    caveFloorHeight(c, distance) + aboveFloor,
    c.z + lx * sin - distance * cos,
  );
}

export function caveAt(x: number, z: number, y?: number): CaveDef | null {
  let nearest: CaveDef | null = null;
  let nearestFloor = Infinity;
  for (const c of CAVES) {
    const [lx, lz] = caveLocal(c, x, z);
    const distance = -lz;
    if (Math.abs(lx) >= c.width / 2 + 0.5 || distance < -2 || distance > c.depth - 1) continue;
    if (y === undefined) return c;
    const gap = y - caveFloorHeight(c, distance);
    if (gap < -4 || gap > 7) continue;
    if (distance > 8 && y >= surfaceHeight(x, z) - 0.6) continue;
    if (Math.abs(gap) < nearestFloor) { nearestFloor = Math.abs(gap); nearest = c; }
  }
  return nearest;
}
export function caveLocal(c: CaveDef, x: number, z: number): [number, number] {
  const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
  return [(x - c.x) * cos + (z - c.z) * sin, -(x - c.x) * sin + (z - c.z) * cos];
}

/** Supply an actor's height to sample its floor without dropping surface walkers into caves. */
export function terrainHeight(x: number, z: number, y?: number): number {
  if (y !== undefined) {
    const c = caveAt(x, z, y);
    if (c) return caveFloorHeight(c, -caveLocal(c, x, z)[1]);
  }
  return surfaceHeight(x, z);
}

export function caveOpening(x: number, z: number): boolean {
  for (const c of CAVES) {
    const [lx, lz] = caveLocal(c, x, z);
    const distance = -lz;
    if (Math.abs(lx) >= c.width / 2 + 0.3 || distance <= -2 || distance >= 48) continue;
    const arch = 8.8 * Math.sqrt(Math.max(0, 1 - (lx / (c.width / 2 + 0.3)) ** 2));
    if (surfaceHeight(x, z) < caveFloorHeight(c, distance) + arch + 0.2) return true;
  }
  return false;
}

export function lavaAt(c: CaveDef, lx: number, distance: number): boolean {
  if (!c.lava || Math.abs(lx) < 2.1) return false;
  const side = Math.sign(lx);
  return (distance > c.depth * 0.48 && distance < c.depth * 0.57 && side < 0)
    || (distance > c.depth * 0.72 && distance < c.depth * 0.81 && side > 0);
}

/* ============================ Global state ============================ */
let idc = 1;
export const nextId = () => idc++;

export const G = {
  running: false,
  gameOver: false,

  time: 0.30,
  dayLength: 170,
  day: 1,
  isNight: false,

  health: 100,
  maxHealth: 100,
  kills: 0,
  nightsSurvived: 0,

  weapon: 'pistol' as WeaponId,
  owned: { ...EMPTY_OWNED } as Record<WeaponId, boolean>,
  ammo: { ...EMPTY_AMMO } as Record<WeaponId, number>,

  inCave: null as string | null,
  caveFound: new Set<string>(),
  ruinsFound: new Set<string>(),
  inRuin: null as string | null,
  bossesSlain: 0,
  golemsSlain: 0,
  lastShot: 0,
  burstLeft: 0,
  burstTimer: 0,
  minigunSpin: 0,
  recoil: 0,
  muzzle: 0,
  shake: 0,
  boomFlash: 0,

  pos: new THREE.Vector3(0, 0, 9),
  velY: 0,
  grounded: true,
  yaw: 0,
  pitch: 0,
  bob: 0,
  keys: new Set<string>(),
  shooting: false,
  aiming: false,
  flashlight: true,
  sprinting: false,
  stamina: 1,

  enemies: [] as Enemy[],
  allies: [] as Ally[],
  chests: [] as Chest[],
  pickups: [] as Pickup[],
  rockets: [] as Rocket[],
  projectiles: [] as Projectile[],
  bolts: [] as Bolt[],
  explosions: [] as Explosion[],
  tracers: [] as Tracer[],
  sparks: [] as Spark[],
  rings: [] as Ring[],
  logs: [] as LogLine[],

  boxes: [] as BoxCollider[],
  circles: [] as CircleCollider[],

  hurt: 0,
  spawnTimer: 0,
  skyTimer: 12,
  pickupTimer: 0,
  interactPrompt: null as string | null,
  interactTarget: null as { kind: 'chest' | 'ally'; id: number } | null,
  worldSeed: 1337,
  saveStamp: 0,
  slot: 0,
  yetiTimer: 6,

  bump: () => {},
};

export function addLog(text: string) {
  G.logs.push({ id: nextId(), text, life: 4.5 });
  if (G.logs.length > 4) G.logs.shift();
}

/* ============================ Physics ============================ */
export function collideCircle(px: number, pz: number, r: number, y?: number): [number, number] {
  let x = px, z = pz;
  if (y !== undefined) {
    for (const cave of CAVES) {
      const [lx, lz] = caveLocal(cave, x, z);
      const distance = -lz;
      const floor = caveFloorHeight(cave, distance);
      if (distance < -1 || distance > cave.depth + 2 || Math.abs(lx) > cave.width / 2 + r + 2) continue;
      if (y < floor - 3 || y > floor + 6 || (distance > 8 && y >= surfaceHeight(x, z) - 0.6)) continue;
      const cx = THREE.MathUtils.clamp(lx, -cave.width / 2 + r, cave.width / 2 - r);
      const cd = Math.min(distance, cave.depth - 2 - r);
      x = cave.x + cx * Math.cos(cave.rot) + cd * Math.sin(cave.rot);
      z = cave.z + cx * Math.sin(cave.rot) - cd * Math.cos(cave.rot);
      return [x, z];
    }
  }
  for (const b of G.boxes) {
    if (y !== undefined && (y + 1.8 < (b.bottom ?? -Infinity) || y > (b.top ?? Infinity))) continue;
    const cx = THREE.MathUtils.clamp(x, b.x1, b.x2);
    const cz = THREE.MathUtils.clamp(z, b.z1, b.z2);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // inside box: push out along smallest penetration
        const pl = x - b.x1, pr = b.x2 - x, pt = z - b.z1, pb = b.z2 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x1 - r;
        else if (m === pr) x = b.x2 + r;
        else if (m === pt) z = b.z1 - r;
        else z = b.z2 + r;
      }
    }
  }
  for (const c of G.circles) {
    if (y !== undefined && (y + 1.8 < (c.bottom ?? -Infinity) || y > (c.top ?? Infinity))) continue;
    const dx = x - c.x, dz = z - c.z;
    const rr = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * rr;
      z = c.z + (dz / d) * rr;
    }
  }
  return [x, z];
}

export function pointBlocked(x: number, z: number, y?: number): boolean {
  if (y !== undefined) {
    for (const cave of CAVES) {
      const [lx, lz] = caveLocal(cave, x, z);
      const distance = -lz;
      const floor = caveFloorHeight(cave, distance);
      if (distance < 0 || distance > cave.depth + 1 || Math.abs(lx) > cave.width / 2 + 2) continue;
      if (y >= surfaceHeight(x, z) + 0.1 || y < floor - 2) continue;
      if (Math.abs(lx) >= cave.width / 2 || distance > cave.depth - 2 || y > floor + 8) return true;
      return false;
    }
  }
  for (const b of G.boxes) {
    if (y !== undefined && (y < (b.bottom ?? -Infinity) || y > (b.top ?? Infinity))) continue;
    if (x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2) return true;
  }
  for (const c of G.circles) {
    if (y !== undefined && (y < (c.bottom ?? -Infinity) || y > (c.top ?? Infinity))) continue;
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

/* house walls -> colliders (leave a doorway gap on the front side) */
function buildTownColliders() {
  G.boxes = [];
  G.circles = [];
  const T = 0.28; // tighter wall thickness to avoid blocked doors
  for (const h of HOUSES) {
    const hw = h.w / 2, hd = h.d / 2;
    const doorW = 2.35;
    const cos = Math.cos(h.rot), sin = Math.sin(h.rot);
    const toWorld = (lx: number, lz: number) => [h.x + lx * cos - lz * sin, h.z + lx * sin + lz * cos] as const;
    const addRotBox = (lx1: number, lz1: number, lx2: number, lz2: number) => {
      const pts = [[lx1, lz1], [lx2, lz1], [lx1, lz2], [lx2, lz2]].map(([lx, lz]) => toWorld(lx, lz));
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[1]);
      G.boxes.push({ x1: Math.min(...xs), z1: Math.min(...zs), x2: Math.max(...xs), z2: Math.max(...zs) });
    };
    // back wall, side walls, and split front wall with a larger doorway gap
    addRotBox(-hw, -hd - T / 2, hw, -hd + T / 2);
    addRotBox(-hw - T / 2, -hd, -hw + T / 2, hd);
    addRotBox(hw - T / 2, -hd, hw + T / 2, hd);
    addRotBox(-hw, hd - T / 2, -doorW / 2, hd + T / 2);
    addRotBox(doorW / 2, hd - T / 2, hw, hd + T / 2);
    // Door posts only near the edges so the center remains fully open
    addRotBox(-doorW / 2 - 0.14, hd - 0.22, -doorW / 2 + 0.02, hd + 0.22);
    addRotBox(doorW / 2 - 0.02, hd - 0.22, doorW / 2 + 0.14, hd + 0.22);
  }
  // town wells
  for (const t of TOWNS) G.circles.push({ x: t.x, z: t.z + t.wellZ, r: 1.15 });
  // Underground walls are resolved in cave-local coordinates, not surface AABBs.
  // graveyard fences (thin wall segments with a gate gap)
  for (const gy of GRAVEYARDS) {
    const gx1 = gy.x - gy.w / 2, gx2 = gy.x + gy.w / 2;
    const gz1 = gy.z - gy.d / 2, gz2 = gy.z + gy.d / 2;
    const T = 0.12, gap = 2.2;
    // north wall (full)
    G.boxes.push({ x1: gx1, z1: gz1 - T, x2: gx2, z2: gz1 + T });
    // south wall
    if (gy.gate === 'south') {
      G.boxes.push({ x1: gx1, z1: gz2 - T, x2: gy.x - gap, z2: gz2 + T });
      G.boxes.push({ x1: gy.x + gap, z1: gz2 - T, x2: gx2, z2: gz2 + T });
    } else G.boxes.push({ x1: gx1, z1: gz2 - T, x2: gx2, z2: gz2 + T });
    // west wall
    if (gy.gate === 'west') {
      G.boxes.push({ x1: gx1 - T, z1: gz1, x2: gx1 + T, z2: gy.z - gap });
      G.boxes.push({ x1: gx1 - T, z1: gy.z + gap, x2: gx1 + T, z2: gz2 });
    } else G.boxes.push({ x1: gx1 - T, z1: gz1, x2: gx1 + T, z2: gz2 });
    // east wall (full)
    G.boxes.push({ x1: gx2 - T, z1: gz1, x2: gx2 + T, z2: gz2 });
    if (gy.crypt) G.boxes.push({ x1: gy.x - 2.4, z1: gz1 + 1, x2: gy.x + 2.4, z2: gz1 + 5 });
  }
  // lamp posts
  for (const [lx, lz] of [[-6, -2], [6, -2], [-6, 8], [6, 8]] as const) {
    G.circles.push({ x: lx, z: lz, r: 0.3 });
  }
  // ruins: columns, stumps, statues and altars block; walls are thin boxes
  for (const r of RUINS) {
    for (const p of ruinPieces(r)) {
      if (p.kind === 'column' || p.kind === 'stump') G.circles.push({ x: p.x, z: p.z, r: p.w * 0.75 });
      else if (p.kind === 'statue') G.circles.push({ x: p.x, z: p.z, r: 0.7 });
      else if (p.kind === 'altar') G.circles.push({ x: p.x, z: p.z, r: 1.7 });
      else if (p.kind === 'wall') {
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        const hw = p.w / 2, T = 0.35;
        const pts = [[-hw, -T], [hw, -T], [-hw, T], [hw, T]].map(([lx, lz]) => [p.x + lx * cos - lz * sin, p.z + lx * sin + lz * cos]);
        const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
        G.boxes.push({ x1: Math.min(...xs), z1: Math.min(...zs), x2: Math.max(...xs), z2: Math.max(...zs) });
      } else if (p.kind === 'arch') {
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        for (const side of [-1, 1]) {
          const lx = side * p.w / 2;
          G.circles.push({ x: p.x + lx * cos, z: p.z + lx * sin, r: 0.55 });
        }
      }
    }
  }
  for (const b of G.boxes) {
    b.bottom = surfaceHeight((b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2) - 0.25;
    b.top = b.bottom + 4;
  }
  for (const c of G.circles) {
    c.bottom = surfaceHeight(c.x, c.z) - 0.25;
    c.top = c.bottom + 4;
  }
}

/* ============================ Daylight ============================ */
export function sunHeight(t: number) {
  return Math.sin((t - 0.25) * Math.PI * 2);
}
export function dayFactor(t: number) {
  return THREE.MathUtils.smoothstep(sunHeight(t), -0.18, 0.22);
}
export function nightFactor(t: number) {
  return 1 - dayFactor(t);
}
export function clockString(t: number) {
  const total = t * 24 * 60;
  const h = Math.floor(total / 60) % 24;
  const m = Math.floor(total % 60);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/* ============================ Spawning ============================ */
const CHEST_LOOT: { weapon: WeaponId; ammo: number }[] = [
  { weapon: 'shotgun', ammo: 24 },
  { weapon: 'smg', ammo: 120 },
  { weapon: 'ak47', ammo: 120 },
  { weapon: 'm16a4', ammo: 90 },
  { weapon: 'm16a6', ammo: 120 },
  { weapon: 'minigun', ammo: 300 },
  { weapon: 'bazooka', ammo: 8 },
  { weapon: 'revolver', ammo: 36 },
  { weapon: 'crossbow', ammo: 30 },
  { weapon: 'sniper', ammo: 18 },
  { weapon: 'flamer', ammo: 400 },
  { weapon: 'rpg', ammo: 6 },
];

/* deterministic chest ids so saves line up */
let chestSeq = 0;
function pushChest(x: number, z: number, loot: number, label: string, medkit = 25, y?: number) {
  const l = CHEST_LOOT[loot === 999 ? CHEST_LOOT.length - 1 : loot % CHEST_LOOT.length];
  G.chests.push({
    id: 100000 + chestSeq++, pos: new THREE.Vector3(x, y ?? terrainHeight(x, z), z), rot: ((chestSeq * 1.7) % 3.1),
    opened: false, label, weapon: l.weapon,
    ammoWeapon: l.weapon, ammoAmount: l.ammo, medkit, openAnim: 0,
    respawnAtDay: 0, seedLoot: loot,
  });
}
let allySeq = 0;
function pushAlly(name: string, x: number, z: number, jacket: string) {
  G.allies.push({
    id: 200000 + allySeq++, name, pos: new THREE.Vector3(x, 0, z),
    hp: 120, maxHp: 120, recruited: false, cooldown: 0,
    wobble: Math.random() * 10, dead: false, hitFlash: 0, jacket, roam: Math.random() * 10,
  });
}

function seedTown() {
  G.chests = [];
  G.allies = [];
  chestSeq = 0; allySeq = 0;
  // Vesper
  pushChest(-13, -10.5, 0, 'DUSTY CHEST');
  pushChest(13, -10.5, 1, 'DUSTY CHEST');
  pushChest(-15, 10.5, 2, 'OLD CHEST');
  pushChest(15, 10.5, 7, 'OLD CHEST');
  pushChest(-2.5, -29, 4, 'CHAPEL CACHE', 40);
  pushChest(2.5, -29, 5, 'CHAPEL CACHE', 40);
  pushChest(GRAVEYARD.x, GRAVEYARD.z - GRAVEYARD.d / 2 + 6.5, 6, 'CRYPT CHEST');
  pushChest(-42, -34, 999, 'RANGER CACHE', 40);
  // Ashford Hollow
  pushChest(138, 77.5, 3, 'MILLER\'S CHEST');
  pushChest(163, 79.5, 8, 'HUNTER\'S CHEST');
  pushChest(150, 105, 1, 'TAVERN CHEST');
  pushChest(132, 100.5, 7, 'SHED CHEST');
  // Brimstone Crossing
  pushChest(-182, 95, 9, 'SMITH\'S CHEST');
  pushChest(-158, 97.5, 2, 'OLD CHEST');
  pushChest(-172, 125, 10, 'ALTAR CACHE', 40);
  pushChest(-168, 125, 5, 'ALTAR CACHE', 40);
  pushChest(-140, 128 - 8 + 6.5, 6, 'CRYPT CHEST');
  // Mournwick
  pushChest(28, -224.5, 8, 'WIDOW\'S CHEST');
  pushChest(54, -222.5, 9, 'MARSHAL\'S CHEST');
  pushChest(40, -198.5, 11, 'WARDEN\'S CHEST', 40);
  pushChest(70, -210 - 9 + 6.5, 6, 'CRYPT CHEST');
  // ruin reliquaries, at the altar the golem guards
  for (const r of RUINS) {
    const dx = Math.cos(r.rot) * 2.2, dz = Math.sin(r.rot) * 2.2;
    pushChest(r.x + dx, r.z + dz, 10 + RUINS.indexOf(r), 'RELIQUARY', 50);
  }
  // cave hoards (deep inside each tunnel)
  for (const c of CAVES) {
    const p = caveWorld(c, 0, c.depth - 9);
    pushChest(p.x, p.z, c.boss ? 11 : 10 + CAVES.indexOf(c), c.boss ? 'ARMORY STRONGBOX' : 'CAVE HOARD', 50, p.y);
  }

  pushAlly('MAYA', -11, -4, '#c25e4e');
  pushAlly('DREK', 11.5, -4, '#4e7ec2');
  pushAlly('SISTER ANNE', 0, -24, '#8a6fc2');
  pushAlly('OLD FINN', 3.5, 5.5, '#5ea36a');
  pushAlly('HARLOW', 148, 92, '#b58a3c');
  pushAlly('TESS', 156, 96, '#3c8a9e');
  pushAlly('BROTHER CASS', -170, 118, '#7b5aa6');
  pushAlly('RUTH', -176, 104, '#a64e4e');
  pushAlly('MARSHAL KANE', 42, -206, '#4f6b8f');
  pushAlly('WREN', 34, -214, '#6b9a4f');

  for (let i = 0; i < 5; i++) spawnPickup(G.pos);
}

export function nearestTown(x: number, z: number): TownDef {
  let best = TOWNS[0], bd = 1e9;
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function spawnPickup(nearPos: THREE.Vector3) {
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 30;
    const x = nearPos.x + Math.cos(a) * d;
    const z = nearPos.z + Math.sin(a) * d;
    if (pointBlocked(x, z, nearPos.y + 0.5)) continue;
    const floor = terrainHeight(x, z, nearPos.y);
    const r = Math.random();
    if (r < 0.62) {
      const ownedList = (Object.keys(G.owned) as WeaponId[]).filter((w) => G.owned[w]);
      const weapon = ownedList[Math.floor(Math.random() * ownedList.length)];
      const amount =
        weapon === 'minigun' ? 150 : weapon === 'smg' ? 60
        : weapon === 'bazooka' || weapon === 'rpg' ? 4
        : weapon === 'shotgun' ? 14 : 30;
      G.pickups.push({ id: nextId(), kind: 'ammo', weapon, amount, pos: new THREE.Vector3(x, floor, z), spin: Math.random() * 6 });
    } else {
      G.pickups.push({ id: nextId(), kind: 'medkit', amount: 35, pos: new THREE.Vector3(x, floor, z), spin: Math.random() * 6 });
    }
    G.bump();
    return;
  }
}

const ENEMY_STATS: Record<Exclude<EnemyType, 'skyeye'>, { hp: number; speed: [number, number] }> = {
  zombie: { hp: 75, speed: [1.35, 0.45] },
  stalker: { hp: 55, speed: [3.7, 0.9] },
  skeleton: { hp: 46, speed: [4.5, 0.6] },
  reaper: { hp: 145, speed: [2.5, 0.4] },
  zkorbus: { hp: 125, speed: [2.9, 0.35] },
  ghoul: { hp: 60, speed: [5.4, 0.8] },      // pack hunter, lunges
  wraith: { hp: 90, speed: [3.2, 0.5] },     // floats, phases through walls
  behemoth: { hp: 520, speed: [1.6, 0.2] },  // armored giant, ground slam
  spitter: { hp: 70, speed: [2.2, 0.4] },    // ranged acid
  yeti: { hp: 340, speed: [3.4, 0.5] },      // mountain brute, hurls ice
  mob: { hp: 50, speed: [3, 0] },            // overridden by MobDef
};

export function makeEnemy(type: Exclude<EnemyType, 'skyeye'>, x: number, z: number, sunproof = false, hpMul = 1, cave?: CaveDef): Enemy {
  const tough = 1 + (G.day - 1) * 0.14;
  const st = ENEMY_STATS[type];
  const hp = st.hp * tough * hpMul;
  return {
    id: nextId(), type, pos: new THREE.Vector3(x, cave ? caveFloorHeight(cave, -caveLocal(cave, x, z)[1]) : terrainHeight(x, z), z), hp, maxHp: hp,
    speed: st.speed[0] + Math.random() * st.speed[1],
    charge: -Math.random() * 1.4, firing: 0, cooldown: 0, burn: 0,
    dying: 0, dead: false, wobble: Math.random() * 10, frozen: false, hitFlash: 0,
    knock: new THREE.Vector3(), target: new THREE.Vector3(), hoverPhase: Math.random() * 10,
    frozenTimer: 0, sunproof, awake: true, kids: 0, caveId: cave?.id,
  };
}

/** Build a roster monster. Golems/ambushers start dormant; cave/snow/ruin dwellers are sunproof. */
export function makeMob(def: MobDef, x: number, z: number, cave?: CaveDef): Enemy {
  const tough = 1 + (G.day - 1) * 0.12;
  const hp = def.hp * tough;
  const sunproof = def.habitat.some((h) => h === 'cave' || h === 'snow' || h === 'ruin') || def.arch === 'golem';
  const e: Enemy = {
    id: nextId(), type: 'mob', mob: def, pos: new THREE.Vector3(x, cave ? caveFloorHeight(cave, -caveLocal(cave, x, z)[1]) : terrainHeight(x, z), z), hp, maxHp: hp,
    speed: def.speed * (0.9 + Math.random() * 0.2),
    charge: 0, firing: 0, cooldown: 1 + Math.random() * 2, burn: 0,
    dying: 0, dead: false, wobble: Math.random() * 10, frozen: false, hitFlash: 0,
    knock: new THREE.Vector3(), target: new THREE.Vector3(), hoverPhase: Math.random() * 10,
    frozenTimer: 0, sunproof, awake: def.arch !== 'golem' && def.arch !== 'ambusher', kids: 0, caveId: cave?.id,
  };
  if (def.arch === 'golem') e.home = e.pos.clone();
  if (def.arch === 'flyer') e.pos.y += 3 + Math.random() * 3;
  return e;
}

/** Spawn a mob (and its pack, if any) near a point, respecting colliders. */
export function spawnMobAt(def: MobDef, x: number, z: number, cave?: CaveDef): Enemy[] {
  const out: Enemy[] = [];
  const n = def.packSize ?? 1;
  for (let i = 0; i < n; i++) {
    let px = x, pz = z;
    for (let t = 0; t < 6; t++) {
      const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : 1.5 + Math.random() * 3;
      px = x + Math.cos(a) * d; pz = z + Math.sin(a) * d;
      if (!pointBlocked(px, pz, cave ? caveFloorHeight(cave, -caveLocal(cave, px, pz)[1]) + 0.5 : undefined)) break;
    }
    const e = makeMob(def, px, pz, cave);
    G.enemies.push(e);
    out.push(e);
  }
  return out;
}

export function pickMob(habitat: Habitat): MobDef | null {
  const pool = mobsFor(habitat, G.day);
  if (!pool.length) return null;
  // weight toward lower tiers so late-game lists don't drown in bosses
  const weights = pool.map((m) => 1 / (1 + (m.tier - 1) * 0.6));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** First visit to a ruin: wake its golem and seed a few ruin-dwellers. */
export function populateRuin(r: RuinDef) {
  if (G.ruinsFound.has(r.id)) return;
  G.ruinsFound.add(r.id);
  const golem = MOB_BY_ID[r.golem] ?? GOLEMS[0];
  const g = makeMob(golem, r.x, r.z + 2.4);
  g.home = new THREE.Vector3(r.x, g.pos.y, r.z + 2.4);
  G.enemies.push(g);
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const def = pickMob(r.swamp && Math.random() < 0.5 ? 'swamp' : 'ruin');
    if (!def) continue;
    const a = Math.random() * Math.PI * 2, d = r.r * (0.4 + Math.random() * 0.4);
    spawnMobAt(def, r.x + Math.cos(a) * d, r.z + Math.sin(a) * d);
  }
  addLog(`🏛 ${r.name} — SOMETHING STONE IS WATCHING`);
  G.bump();
}

export const MOB_COUNT = MOBS.length;

export function spawnEnemy(playerPos: THREE.Vector3, type: Exclude<EnemyType, 'skyeye'>) {
  let x = 0, z = 0;
  // nearest graveyards first
  const nearGy = GRAVEYARDS.filter((g) => Math.hypot(g.x - playerPos.x, g.z - playerPos.z) < 90);
  if (nearGy.length && Math.random() < 0.5) {
    const gy = nearGy[Math.floor(Math.random() * nearGy.length)];
    x = gy.x + (Math.random() - 0.5) * gy.w * 0.75;
    z = gy.z + (Math.random() - 0.5) * gy.d * 0.75;
    if (pointBlocked(x, z)) { x += 4; z += 4; }
    playGroan(Math.hypot(x - playerPos.x, z - playerPos.z));
  } else {
    const a = Math.random() * Math.PI * 2;
    const d = 26 + Math.random() * 14;
    x = playerPos.x + Math.cos(a) * d;
    z = playerPos.z + Math.sin(a) * d;
    if (pointBlocked(x, z)) { x += 3; }
  }
  G.enemies.push(makeEnemy(type, x, z));
  // dirt burst
  for (let i = 0; i < 8; i++) {
    G.sparks.push({
      p: new THREE.Vector3(x + (Math.random() - 0.5), 0.3, z + (Math.random() - 0.5)),
      v: new THREE.Vector3((Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2),
      life: 0.6, maxLife: 0.6, color: '#5a4632', size: 1.4,
    });
  }
  G.bump();
}

export function spawnSkyEye() {
  const a = Math.random() * Math.PI * 2;
  const d = 20 + Math.random() * 18;
  const x = G.pos.x + Math.cos(a) * d;
  const z = G.pos.z + Math.sin(a) * d;
  const hp = 420 * (1 + (G.day - 1) * 0.18);
  G.enemies.push({
    id: nextId(), type: 'skyeye', pos: new THREE.Vector3(x, terrainHeight(G.pos.x, G.pos.z) + 26 + Math.random() * 8, z),
    hp, maxHp: hp, speed: 2.2 + Math.random(), charge: -2 - Math.random() * 2,
    firing: 0, cooldown: 0, burn: 0, dying: 0, dead: false,
    wobble: Math.random() * 10, frozen: false, hitFlash: 0,
    knock: new THREE.Vector3(), target: new THREE.Vector3(G.pos.x, 0, G.pos.z),
    hoverPhase: Math.random() * 10, frozenTimer: 0, sunproof: false, awake: true, kids: 0,
  });
  addLog('👁 A GIANT EYE OPENS IN THE SKY');
  G.bump();
}

export function maxEnemiesForNight() {
  return Math.min(11, 3 + Math.floor((G.day - 1) * 0.9));
}

/** Night roster spawn from the data table (swamp near swamp ruins, snow on peaks, else night pool). */
export function spawnNightMob(playerPos: THREE.Vector3): boolean {
  const habitat: Habitat = isSnowy(playerPos.x, playerPos.z) ? 'snow'
    : RUINS.some((r) => r.swamp && Math.hypot(r.x - playerPos.x, r.z - playerPos.z) < r.r + 40) && Math.random() < 0.5 ? 'swamp'
    : 'night';
  const def = pickMob(habitat);
  if (!def) return false;
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 28 + Math.random() * 16;
    const x = playerPos.x + Math.cos(a) * d, z = playerPos.z + Math.sin(a) * d;
    if (pointBlocked(x, z) || caveAt(x, z)) continue;
    spawnMobAt(def, x, z);
    if (def.arch === 'exploder' || def.arch === 'summoner' || def.scale >= 1.6) addLog(`⚠ ${def.name} — ${def.desc}`);
    G.bump();
    return true;
  }
  return false;
}

export function randomNightEnemy(): Exclude<EnemyType, 'skyeye'> {
  const roll = Math.random();
  const late = G.day >= 3;
  if (roll < 0.26) return 'zombie';
  if (roll < 0.40) return 'stalker';
  if (roll < 0.54) return 'skeleton';
  if (roll < 0.64) return 'ghoul';
  if (roll < 0.74) return 'spitter';
  if (roll < 0.83) return 'reaper';
  if (roll < 0.90) return 'wraith';
  if (roll < 0.96) return 'zkorbus';
  return late ? 'behemoth' : 'reaper';
}

/* ---------- caves ---------- */
const CAVE_DWELLERS: Exclude<EnemyType, 'skyeye'>[] = ['ghoul', 'spitter', 'skeleton', 'wraith'];
export function populateCave(c: CaveDef) {
  if (G.caveFound.has(c.id)) return;
  G.caveFound.add(c.id);
  const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
  const at = (lx: number, lz: number) => [c.x + lx * cos - lz * sin, c.z + lx * sin + lz * cos] as const;
  const n = c.boss ? 8 : 6;
  for (let i = 0; i < n; i++) {
    const distance = 28 + (i / n) * (c.depth - 60);
    const [x, z] = at((Math.random() - 0.5) * (c.width - 4), -distance);
    if (Math.random() < 0.55) {
      const def = pickMob('cave');
      if (def) { spawnMobAt({ ...def, packSize: Math.min(def.packSize ?? 1, 2) }, x, z, c); continue; }
    }
    const type = CAVE_DWELLERS[Math.floor(Math.random() * CAVE_DWELLERS.length)];
    G.enemies.push(makeEnemy(type, x, z, true, 1, c));
  }
  if (c.boss) {
    // an alpha behemoth guards the strongbox at the bottom of the shaft
    const [x, z] = at(0, -c.depth + 7);
    G.enemies.push(makeEnemy('behemoth', x, z, true, 2.2, c));
    addLog(`⛰ ${c.name} — SOMETHING HUGE BREATHES IN THE DARK`);
  } else {
    if (Math.random() < 0.5) {
      const [x, z] = at(0, -c.depth + 6);
      G.enemies.push(makeEnemy('behemoth', x, z, true, 1, c));
    }
    addLog(`⛰ ENTERED ${c.name} — THE DARK IS NOT EMPTY`);
  }
  G.bump();
}

export function maxSkyEyes() {
  return Math.min(3, 1 + Math.floor((G.day - 1) / 2));
}

/* ---------- mountains ---------- */
/** Yetis roam the snow line day and night. Spawns one on nearby high ground. */
export function spawnYeti(playerPos: THREE.Vector3): boolean {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 22;
    const x = playerPos.x + Math.cos(a) * d;
    const z = playerPos.z + Math.sin(a) * d;
    if (!isSnowy(x, z) || pointBlocked(x, z) || caveAt(x, z)) continue;
    const y = makeEnemy('yeti', x, z, true, 1);
    y.cooldown = 2 + Math.random() * 2;
    G.enemies.push(y);
    for (let i = 0; i < 10; i++) {
      G.sparks.push({
        p: new THREE.Vector3(x + (Math.random() - 0.5) * 2, y.pos.y + 0.5, z + (Math.random() - 0.5) * 2),
        v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3),
        life: 0.8, maxLife: 0.8, color: '#eef4ff', size: 1.6,
      });
    }
    addLog('❄ A YETI ROARS ACROSS THE SNOW');
    G.bump();
    return true;
  }
  return false;
}

/* ---------- combat ---------- */
export function damageEnemy(e: Enemy, dmg: number, dir?: THREE.Vector3, knockPower = 0) {
  if (e.dead) return;
  if (e.mob?.armor) dmg *= dmg >= 60 ? 0.8 : 0.45; // plate shrugs off small arms; big hits get through
  if (e.mob && !e.awake) { e.awake = true; e.cooldown = 0.6; }
  e.hp -= dmg;
  e.hitFlash = 0.16;
  if (dir && knockPower > 0 && e.type !== 'skyeye' && !(e.mob && (e.mob.arch === 'golem' || e.mob.scale > 1.6))) {
    e.knock.addScaledVector(dir, knockPower / (e.mob ? Math.max(1, e.mob.scale) : 1));
  }
  if (e.hp <= 0) {
    e.dead = true;
    e.dying = 1.0;
    e.firing = 0;
    G.kills += 1;
    const killLabel = e.type === 'zombie' ? 'ZOMBIE DOWN'
      : e.type === 'stalker' ? 'STALKER DOWN'
      : e.type === 'skeleton' ? 'SKELETON SHATTERED'
      : e.type === 'reaper' ? 'REAPER BANISHED'
      : e.type === 'zkorbus' ? 'ZKORBUS SLAIN'
      : e.type === 'ghoul' ? 'GHOUL PUT DOWN'
      : e.type === 'wraith' ? 'WRAITH DISPELLED'
      : e.type === 'behemoth' ? '💀 BEHEMOTH FELLED'
      : e.type === 'spitter' ? 'SPITTER BURST'
      : e.type === 'yeti' ? '❄ YETI FELLED'
      : e.type === 'mob' && e.mob ? (e.mob.arch === 'golem' ? `🏛 ${e.mob.name} SHATTERED` : `${e.mob.name} DOWN`)
      : '👁 SKY-EYE DESTROYED';
    if (e.mob?.arch === 'golem') {
      G.golemsSlain += 1;
      explode(new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z), 0, 0.1, false);
    }
    if (e.type === 'behemoth' && e.sunproof && e.maxHp > 900) {
      G.bossesSlain += 1;
      addLog('🏆 ALPHA BEHEMOTH SLAIN — THE STRONGBOX IS YOURS');
    }
    addLog(killLabel);
    playGore(Math.hypot(e.pos.x - G.pos.x, e.pos.z - G.pos.z));
    // gore burst
    const col = e.type === 'skyeye' ? '#ff5a4a' : e.type === 'skeleton' ? '#e7dfbd'
      : e.mob ? (e.mob.arch === 'golem' ? e.mob.skin : e.mob.accent) : '#b01e1e';
    for (let i = 0; i < 14; i++) {
      G.sparks.push({
        p: new THREE.Vector3(e.pos.x, (e.type === 'skyeye' ? e.pos.y : 1) + (Math.random() - 0.5), e.pos.z),
        v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6),
        life: 0.7, maxLife: 0.7, color: col, size: e.type === 'skyeye' || e.type === 'zkorbus' ? 2.2 : 1.2,
      });
    }
    if (e.type === 'skyeye') {
      explode(new THREE.Vector3(e.pos.x, Math.max(2, e.pos.y - 6), e.pos.z), 120, 8, false);
    }
  }
}

export function explode(at: THREE.Vector3, dmg: number, radius: number, canHurtPlayer: boolean) {
  G.explosions.push({ id: nextId(), pos: at.clone(), life: 0.55, maxLife: 0.55, radius });
  G.rings.push({ id: nextId(), pos: new THREE.Vector3(at.x, Math.max(0.25, at.y - 1), at.z), life: 0.5, maxLife: 0.5, radius: radius * 1.6, color: '#ffb25a' });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 9;
    G.sparks.push({
      p: at.clone(),
      v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 7, Math.sin(a) * sp),
      life: 0.5 + Math.random() * 0.5, maxLife: 1,
      color: ['#ffd27a', '#ff9a3c', '#ff5a2a', '#555555'][Math.floor(Math.random() * 4)],
      size: 1.6 + Math.random(),
    });
  }
  tmpDir.set(0, 0, 0);
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ey = e.type === 'skyeye' ? e.pos.y : 1;
    const d = Math.hypot(e.pos.x - at.x, ey - at.y, e.pos.z - at.z);
    if (d < radius + (e.type === 'skyeye' ? 3 : 0.5)) {
      const fall = 1 - (d / (radius + 3)) * 0.6;
      tmpDir.set(e.pos.x - at.x, 0, e.pos.z - at.z).normalize();
      damageEnemy(e, dmg * fall, tmpDir, 9);
    }
  }
  if (canHurtPlayer) {
    const pd = Math.hypot(G.pos.x - at.x, 1.4 - at.y, G.pos.z - at.z);
    if (pd < radius) {
      const fall = 1 - (pd / radius) * 0.7;
      hurtPlayer(dmg * 0.45 * fall);
      const d = Math.max(0.5, pd);
      G.velY += (3.5 * (1 - pd / radius)) + 1;
      void d;
    }
  }
  const cd = Math.hypot(G.pos.x - at.x, G.pos.z - at.z);
  playExplosion(cd);
  G.shake = Math.min(1, G.shake + Math.max(0, 1 - cd / 30) * 0.9);
  G.boomFlash = Math.min(1, G.boomFlash + Math.max(0, 1 - cd / 22));
  G.bump();
}

const tmpDir = new THREE.Vector3();

export function hurtPlayer(dmg: number) {
  if (G.gameOver || !G.running) return;
  G.health -= dmg;
  G.hurt = Math.min(1, G.hurt + dmg * 0.05 + 0.12);
  if (dmg > 0.3) playHurt();
}

export function rollChestLoot(c: Chest) {
  const pool = CHEST_LOOT[c.seedLoot === 999 ? CHEST_LOOT.length - 1 : c.seedLoot % CHEST_LOOT.length];
  c.weapon = pool.weapon;
  c.ammoWeapon = pool.weapon;
  c.ammoAmount = pool.ammo;
  c.medkit = c.label.includes('CACHE') ? 40 : 25;
}

export function tryInteract(): boolean {
  const t = G.interactTarget;
  if (!t) return false;
  if (t.kind === 'chest') {
    const c = G.chests.find((x) => x.id === t.id);
    if (!c || c.opened) return false;
    c.opened = true;
    c.respawnAtDay = G.day + 2;
    playChest();
    if (c.weapon) {
      const had = G.owned[c.weapon];
      G.owned[c.weapon] = true;
      if (c.ammoWeapon) G.ammo[c.ammoWeapon] += c.ammoAmount;
      G.weapon = c.weapon;
      addLog(had ? `+${c.ammoAmount} ${WEAPONS[c.weapon].short} AMMO` : `LOOTED ${WEAPONS[c.weapon].name}!`);
    }
    if (c.medkit) {
      G.health = Math.min(G.maxHealth, G.health + c.medkit * 0.4);
    }
    for (let i = 0; i < 10; i++) {
      G.sparks.push({
        p: new THREE.Vector3(c.pos.x, 0.8, c.pos.z),
        v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3),
        life: 0.6, maxLife: 0.6, color: '#ffd166', size: 1,
      });
    }
    saveWorld();
    G.bump();
    return true;
  } else {
    const a = G.allies.find((x) => x.id === t.id);
    if (!a || a.recruited || a.dead) return false;
    const count = G.allies.filter((x) => x.recruited && !x.dead).length;
    if (count >= 3) { addLog('SQUAD FULL (MAX 3)'); return false; }
    a.recruited = true;
    playRecruit();
    addLog(`${a.name} JOINS THE FIGHT!`);
    saveWorld();
    G.bump();
    return true;
  }
}

interface SaveChest { id: number; opened: boolean; respawnAtDay: number; weapon?: WeaponId; ammoWeapon?: WeaponId; ammoAmount: number; medkit: number }
interface SaveAlly { id: number; recruited: boolean; dead: boolean; hp: number }
type SaveEnemy = Omit<Enemy, 'pos' | 'knock' | 'target' | 'home' | 'mob'> & {
  pos: [number, number, number]; knock: [number, number, number]; target: [number, number, number];
  home?: [number, number, number]; mobId?: string;
};
interface SaveWorldState {
  day: number; time: number; health: number; kills: number; nightsSurvived: number;
  pos: [number, number, number]; yaw: number; pitch: number; weapon: WeaponId;
  owned: Record<WeaponId, boolean>; ammo: Record<WeaponId, number>;
  chests: SaveChest[]; allies: SaveAlly[]; seed: number;
  cavesFound?: string[]; bossesSlain?: number;
  ruinsFound?: string[]; golemsSlain?: number;
  savedAt?: number; townName?: string;
  caveId?: string; enemies?: SaveEnemy[];
}

/* ---------- save slots ---------- */
export const SAVE_SLOTS = 3;
const slotKey = (slot: number) => `bloody-hand-save-v6-slot${slot}`;
const sessionSaves = new Map<number, string>();
function readSave(slot: number): string | null {
  try { return sessionSaves.get(slot) ?? localStorage.getItem(slotKey(slot)); }
  catch { return sessionSaves.get(slot) ?? null; }
}

export interface SaveMeta {
  slot: number; empty: boolean; day: number; kills: number; nights: number;
  health: number; weapons: number; savedAt: number; town: string;
}

export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (let s = 0; s < SAVE_SLOTS; s++) {
    const raw = readSave(s);
    if (!raw) { out.push({ slot: s, empty: true, day: 0, kills: 0, nights: 0, health: 0, weapons: 0, savedAt: 0, town: '' }); continue; }
    try {
      const d = JSON.parse(raw) as SaveWorldState;
      out.push({
        slot: s, empty: false, day: d.day, kills: d.kills, nights: d.nightsSurvived, health: d.health,
        weapons: Object.values(d.owned).filter(Boolean).length, savedAt: d.savedAt ?? 0,
        town: d.townName ?? '',
      });
    } catch {
      out.push({ slot: s, empty: true, day: 0, kills: 0, nights: 0, health: 0, weapons: 0, savedAt: 0, town: '' });
    }
  }
  return out;
}

export function saveWorld(slot: number = G.slot) {
  if (G.gameOver || G.health <= 0) return false;
  const t = nearestTown(G.pos.x, G.pos.z);
  const inTown = Math.hypot(G.pos.x - t.x, G.pos.z - t.z) < t.radius + 10;
  const cave = G.inCave ? CAVES.find((c) => c.id === G.inCave) : null;
  const data: SaveWorldState = {
    day: G.day, time: G.time, health: G.health, kills: G.kills, nightsSurvived: G.nightsSurvived,
    pos: [G.pos.x, G.pos.y, G.pos.z], yaw: G.yaw, pitch: G.pitch, weapon: G.weapon,
    owned: { ...G.owned }, ammo: { ...G.ammo }, seed: G.worldSeed,
    chests: G.chests.map((c) => ({
      id: c.id, opened: c.opened, respawnAtDay: c.respawnAtDay,
      weapon: c.weapon, ammoWeapon: c.ammoWeapon, ammoAmount: c.ammoAmount, medkit: c.medkit,
    })),
    allies: G.allies.map((a) => ({ id: a.id, recruited: a.recruited, dead: a.dead, hp: a.hp })),
    cavesFound: [...G.caveFound], bossesSlain: G.bossesSlain,
    ruinsFound: [...G.ruinsFound], golemsSlain: G.golemsSlain,
    savedAt: Date.now(), townName: cave ? cave.name : inTown ? t.name : (G.inRuin ? RUINS.find((r) => r.id === G.inRuin)?.name ?? 'RUINS' : 'THE WILDS'),
    caveId: G.inCave ?? undefined,
    enemies: G.enemies.map(({ pos, knock, target, home, mob, ...rest }) => ({
      ...rest, pos: [pos.x, pos.y, pos.z], knock: [knock.x, knock.y, knock.z], target: [target.x, target.y, target.z],
      home: home ? [home.x, home.y, home.z] : undefined, mobId: mob?.id,
    })),
  };
  const json = JSON.stringify(data);
  sessionSaves.set(slot, json);
  G.slot = slot;
  G.saveStamp = performance.now();
  try { localStorage.setItem(slotKey(slot), json); return true; }
  catch { return false; }
}

export function hasSave(slot: number = G.slot): boolean {
  return !!readSave(slot);
}
export function clearSave(slot: number) {
  sessionSaves.delete(slot);
  try { localStorage.removeItem(slotKey(slot)); } catch { /* The in-memory slot was removed. */ }
}

export function loadWorld(slot: number = G.slot): boolean {
  const raw = readSave(slot);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as SaveWorldState;
    if (!data.pos || !WEAPONS[data.weapon] || !Number.isFinite(data.day) || data.health <= 0) return false;
    resetGame();
    G.slot = slot;
    G.day = data.day;
    G.time = data.time;
    G.health = data.health;
    G.kills = data.kills;
    G.nightsSurvived = data.nightsSurvived;
    G.pos.set(data.pos[0], data.pos[1], data.pos[2]);
    G.yaw = data.yaw;
    G.pitch = data.pitch;
    G.weapon = data.weapon;
    G.owned = { ...G.owned, ...data.owned };
    G.ammo = { ...G.ammo, ...data.ammo };
    G.worldSeed = data.seed;
    for (const s of data.chests) {
      const c = G.chests.find((x) => x.id === s.id);
      if (!c) continue;
      c.opened = s.opened;
      c.respawnAtDay = s.respawnAtDay;
      c.weapon = s.weapon;
      c.ammoWeapon = s.ammoWeapon;
      c.ammoAmount = s.ammoAmount;
      c.medkit = s.medkit;
    }
    for (const s of data.allies) {
      const a = G.allies.find((x) => x.id === s.id);
      if (!a) continue;
      a.recruited = s.recruited;
      a.dead = s.dead;
      a.hp = s.hp;
    }
    G.caveFound = new Set(data.cavesFound ?? []);
    G.bossesSlain = data.bossesSlain ?? 0;
    G.ruinsFound = new Set(data.ruinsFound ?? []);
    G.golemsSlain = data.golemsSlain ?? 0;
    G.inCave = data.caveId && CAVES.some((c) => c.id === data.caveId) ? data.caveId : null;
    const savedCave = G.inCave ? CAVES.find((c) => c.id === G.inCave) : null;
    G.pos.y = savedCave ? caveFloorHeight(savedCave, -caveLocal(savedCave, G.pos.x, G.pos.z)[1])
      : Math.max(G.pos.y, terrainHeight(G.pos.x, G.pos.z, G.pos.y));
    G.isNight = nightFactor(G.time) > 0.5;
    if (data.enemies) {
      G.enemies = data.enemies.filter((s) => !s.dead).map((s) => ({
        ...s, pos: new THREE.Vector3(...s.pos), knock: new THREE.Vector3(...s.knock), target: new THREE.Vector3(...s.target),
        home: s.home ? new THREE.Vector3(...s.home) : undefined, mob: s.mobId ? MOB_BY_ID[s.mobId] : undefined,
      }));
      idc = Math.max(idc, ...G.enemies.map((e) => e.id + 1));
    }
    addLog('WORLD LOADED');
    return true;
  } catch {
    return false;
  }
}

export function refreshChestRespawns() {
  let changed = false;
  for (const c of G.chests) {
    if (c.opened && c.respawnAtDay > 0 && G.day >= c.respawnAtDay) {
      c.opened = false;
      c.openAnim = 0;
      c.respawnAtDay = G.day + 2;
      rollChestLoot(c);
      changed = true;
    }
  }
  if (changed) {
    addLog('CHEST LOOT RESTOCKED');
    saveWorld();
  }
}

export function resetGame() {
  G.running = true;
  G.gameOver = false;
  G.time = 0.30;
  G.day = 1;
  G.isNight = false;
  G.health = 100;
  G.kills = 0;
  G.nightsSurvived = 0;
  G.weapon = 'pistol';
  G.owned = { ...EMPTY_OWNED };
  G.ammo = { ...EMPTY_AMMO };
  G.inCave = null;
  G.caveFound = new Set();
  G.ruinsFound = new Set();
  G.inRuin = null;
  G.bossesSlain = 0;
  G.golemsSlain = 0;
  G.yetiTimer = 6;
  G.projectiles = [];
  G.bolts = [];
  G.pos.set(0, 0, 9);
  G.velY = 0;
  G.grounded = true;
  G.yaw = 0;
  G.pitch = 0;
  G.keys.clear();
  G.shooting = false;
  G.aiming = false;
  G.flashlight = true;
  G.stamina = 1;
  G.minigunSpin = 0;
  G.burstLeft = 0;
  G.enemies = [];
  G.allies = [];
  G.chests = [];
  G.pickups = [];
  G.rockets = [];
  G.explosions = [];
  G.tracers = [];
  G.sparks = [];
  G.rings = [];
  G.logs = [];
  G.hurt = 0;
  G.recoil = 0;
  G.shake = 0;
  G.boomFlash = 0;
  G.spawnTimer = 2;
  G.skyTimer = 14;
  G.pickupTimer = 0;
  G.interactPrompt = null;
  G.interactTarget = null;
  buildTownColliders();
  seedTown();
  addLog('DAY 1 — LOOT THE TOWN. RECRUIT HELP. [E] INTERACTS');
}
