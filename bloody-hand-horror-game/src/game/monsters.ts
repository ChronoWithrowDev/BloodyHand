/* Data-driven monster roster. Each entry picks a behaviour ARCHETYPE (how it fights)
   and a BODY plan (how it's built procedurally), so dozens of distinct creatures share
   a handful of AI routines and one mesh builder. */

export type Archetype =
  | 'rusher'    // run at you, bite
  | 'brute'     // slow, heavy, ground slam
  | 'ranged'    // keep distance, lob projectiles
  | 'flyer'     // hover, swoop dive
  | 'ambusher'  // invisible until close, then pounce
  | 'swarm'     // weak, fast, spawns in packs
  | 'exploder'  // sprints in and detonates
  | 'summoner'  // hangs back, spawns minions
  | 'leech'     // latches, drains hp, slows you
  | 'phaser'    // blinks around you between strikes
  | 'screamer'  // shrieks: shakes screen, buffs nearby mobs
  | 'golem';    // dormant guardian, armored, boulder + slam

export type BodyPlan = 'biped' | 'quad' | 'floater' | 'serpent' | 'blob' | 'insect' | 'colossus';
export type Habitat = 'night' | 'cave' | 'snow' | 'ruin' | 'sky' | 'swamp';

export interface MobDef {
  id: string;
  name: string;
  arch: Archetype;
  body: BodyPlan;
  habitat: Habitat[];
  tier: number;          // minimum day for night spawns
  hp: number;
  speed: number;
  dmg: number;
  scale: number;
  skin: string;          // main body color
  accent: string;        // secondary / belly / plates
  eye: string;           // glowing eye color
  eyes: 1 | 2 | 3 | 4 | 6;
  horns?: boolean;
  spikes?: boolean;
  wings?: boolean;
  tail?: boolean;
  claws?: boolean;
  armor?: boolean;       // damage reduction vs small arms
  glow?: boolean;        // emissive body
  minion?: string;       // summoner: what it spawns
  packSize?: number;     // swarm group size
  projColor?: string;    // ranged projectile color
  desc: string;
}

const M = (d: MobDef) => d;

export const MOBS: MobDef[] = [
  /* ---------- rushers ---------- */
  M({ id: 'hound', name: 'GRAVE HOUND', arch: 'rusher', body: 'quad', habitat: ['night'], tier: 1, hp: 55, speed: 6.2, dmg: 12, scale: 0.9, skin: '#3a2f2a', accent: '#6e1a1a', eye: '#ff3a1a', eyes: 2, tail: true, claws: true, desc: 'Fast. Hunts in loose packs.' }),
  M({ id: 'ripper', name: 'RIPPER', arch: 'rusher', body: 'biped', habitat: ['night'], tier: 2, hp: 95, speed: 5.0, dmg: 18, scale: 1.05, skin: '#5a3a3a', accent: '#2a1a1a', eye: '#ffaa2a', eyes: 2, claws: true, spikes: true, desc: 'Blade-armed sprinter.' }),
  M({ id: 'crawler', name: 'CRAWLER', arch: 'rusher', body: 'insect', habitat: ['night', 'cave'], tier: 1, hp: 40, speed: 5.6, dmg: 9, scale: 0.8, skin: '#2b2f26', accent: '#8ab02a', eye: '#c8ff2a', eyes: 6, desc: 'Skitters low under your sights.' }),
  M({ id: 'hollow', name: 'HOLLOW MAN', arch: 'rusher', body: 'biped', habitat: ['night'], tier: 1, hp: 80, speed: 3.2, dmg: 14, scale: 1.0, skin: '#6a6454', accent: '#2a2622', eye: '#ffffff', eyes: 2, desc: 'An empty coat that still walks.' }),
  M({ id: 'bonewolf', name: 'BONE WOLF', arch: 'rusher', body: 'quad', habitat: ['night', 'snow'], tier: 2, hp: 70, speed: 6.8, dmg: 15, scale: 1.0, skin: '#d8cfad', accent: '#8a8070', eye: '#9fe0ff', eyes: 2, tail: true, spikes: true, desc: 'All ribs and teeth.' }),
  M({ id: 'flayed', name: 'THE FLAYED', arch: 'rusher', body: 'biped', habitat: ['night'], tier: 3, hp: 140, speed: 4.4, dmg: 22, scale: 1.1, skin: '#a3302a', accent: '#5a1212', eye: '#ffd27a', eyes: 2, claws: true, desc: 'Skinless and screaming.' }),
  M({ id: 'scuttler', name: 'TOMB SCUTTLER', arch: 'rusher', body: 'insect', habitat: ['cave', 'ruin'], tier: 1, hp: 60, speed: 4.8, dmg: 11, scale: 1.0, skin: '#4a3a2a', accent: '#c9a227', eye: '#ffb13a', eyes: 4, armor: true, desc: 'Armored beetle-thing.' }),
  M({ id: 'frostwolf', name: 'FROST WOLF', arch: 'rusher', body: 'quad', habitat: ['snow'], tier: 1, hp: 85, speed: 7.0, dmg: 16, scale: 1.05, skin: '#e3ecf2', accent: '#8fb8d8', eye: '#4ac8ff', eyes: 2, tail: true, claws: true, packSize: 3, desc: 'White death on the drifts.' }),

  /* ---------- brutes ---------- */
  M({ id: 'ogre', name: 'GRAVE OGRE', arch: 'brute', body: 'biped', habitat: ['night'], tier: 2, hp: 380, speed: 1.9, dmg: 34, scale: 1.7, skin: '#5a6a4a', accent: '#3a2a1a', eye: '#ff6a1a', eyes: 2, horns: true, desc: 'Drags a headstone as a club.' }),
  M({ id: 'bloatlord', name: 'BLOAT LORD', arch: 'brute', body: 'blob', habitat: ['night', 'swamp'], tier: 2, hp: 320, speed: 1.4, dmg: 26, scale: 1.6, skin: '#7a8a3a', accent: '#b8e23a', eye: '#d8ff5a', eyes: 3, glow: true, desc: 'Swollen with grave gas.' }),
  M({ id: 'ironhide', name: 'IRONHIDE', arch: 'brute', body: 'quad', habitat: ['cave'], tier: 3, hp: 460, speed: 2.4, dmg: 30, scale: 1.6, skin: '#4a4f57', accent: '#8a8f98', eye: '#ff4a1a', eyes: 2, horns: true, armor: true, desc: 'A boar plated in scrap iron.' }),
  M({ id: 'mammoth', name: 'DEAD MAMMOTH', arch: 'brute', body: 'quad', habitat: ['snow'], tier: 3, hp: 620, speed: 1.8, dmg: 40, scale: 2.4, skin: '#7a6a5a', accent: '#d8cfad', eye: '#9fe0ff', eyes: 2, horns: true, desc: 'Thawed out angry.' }),
  M({ id: 'juggernaut', name: 'JUGGERNAUT', arch: 'brute', body: 'biped', habitat: ['night'], tier: 4, hp: 700, speed: 2.1, dmg: 45, scale: 1.9, skin: '#2a2a30', accent: '#6a0f0f', eye: '#ff1739', eyes: 2, armor: true, spikes: true, desc: 'Riot-armored corpse. Shoot the joints.' }),
  M({ id: 'tombcrab', name: 'TOMB CRAB', arch: 'brute', body: 'insect', habitat: ['ruin', 'swamp'], tier: 2, hp: 300, speed: 2.0, dmg: 28, scale: 1.7, skin: '#6a3a2a', accent: '#c9a227', eye: '#ffb13a', eyes: 2, armor: true, claws: true, desc: 'Headstones for a shell.' }),

  /* ---------- ranged ---------- */
  M({ id: 'hexer', name: 'HEXER', arch: 'ranged', body: 'biped', habitat: ['night'], tier: 2, hp: 70, speed: 2.6, dmg: 16, scale: 1.0, skin: '#2a1a3a', accent: '#8a5aff', eye: '#c9b2ff', eyes: 2, projColor: '#b06bff', desc: 'Throws screaming skulls.' }),
  M({ id: 'bileweaver', name: 'BILE WEAVER', arch: 'ranged', body: 'insect', habitat: ['cave', 'swamp'], tier: 1, hp: 60, speed: 2.4, dmg: 14, scale: 1.1, skin: '#2b2f26', accent: '#b8e23a', eye: '#d8ff5a', eyes: 6, projColor: '#9adf1a', desc: 'Spits webs of acid.' }),
  M({ id: 'bonecaster', name: 'BONECASTER', arch: 'ranged', body: 'biped', habitat: ['night', 'ruin'], tier: 2, hp: 85, speed: 2.5, dmg: 20, scale: 1.0, skin: '#d8cfad', accent: '#4a3a2a', eye: '#a9d7ff', eyes: 2, projColor: '#e7dfbd', desc: 'Flings its own ribs.' }),
  M({ id: 'icecaller', name: 'ICE CALLER', arch: 'ranged', body: 'biped', habitat: ['snow'], tier: 2, hp: 90, speed: 2.4, dmg: 22, scale: 1.1, skin: '#bfe8ff', accent: '#4a6a8a', eye: '#4ac8ff', eyes: 2, horns: true, projColor: '#dff3ff', desc: 'Hurls shards of black ice.' }),
  M({ id: 'cinderling', name: 'CINDERLING', arch: 'ranged', body: 'floater', habitat: ['cave'], tier: 2, hp: 50, speed: 2.8, dmg: 18, scale: 0.7, skin: '#3a1a0a', accent: '#ff6a1a', eye: '#ffd27a', eyes: 1, glow: true, projColor: '#ff8a2a', desc: 'A coal that hates you.' }),
  M({ id: 'pusher', name: 'GUT PUSHER', arch: 'ranged', body: 'blob', habitat: ['swamp', 'night'], tier: 3, hp: 160, speed: 1.6, dmg: 24, scale: 1.3, skin: '#5a4a3a', accent: '#8a2a2a', eye: '#ff6a6a', eyes: 3, projColor: '#8a1a1a', desc: 'Vomits its last meal at you.' }),

  /* ---------- flyers ---------- */
  M({ id: 'carrionbat', name: 'CARRION BAT', arch: 'flyer', body: 'floater', habitat: ['night', 'cave'], tier: 1, hp: 35, speed: 7.5, dmg: 9, scale: 0.7, skin: '#2a2226', accent: '#5a3a3a', eye: '#ff3a1a', eyes: 2, wings: true, packSize: 3, desc: 'Comes in flocks.' }),
  M({ id: 'harpy', name: 'GRAVE HARPY', arch: 'flyer', body: 'biped', habitat: ['night', 'ruin'], tier: 2, hp: 90, speed: 6.5, dmg: 18, scale: 1.0, skin: '#4a3a3a', accent: '#8a6a4a', eye: '#ffaa2a', eyes: 2, wings: true, claws: true, desc: 'Dives, rakes, climbs.' }),
  M({ id: 'skullmoth', name: 'SKULL MOTH', arch: 'flyer', body: 'insect', habitat: ['night'], tier: 1, hp: 45, speed: 5.5, dmg: 10, scale: 0.9, skin: '#d8cfad', accent: '#3a3a3a', eye: '#ffffff', eyes: 2, wings: true, desc: 'Powder in your eyes.' }),
  M({ id: 'gargoyle', name: 'GARGOYLE', arch: 'flyer', body: 'biped', habitat: ['ruin'], tier: 3, hp: 220, speed: 5.0, dmg: 28, scale: 1.3, skin: '#6a6a70', accent: '#3a3a40', eye: '#ff6a1a', eyes: 2, wings: true, horns: true, armor: true, desc: 'Stone that remembers how to fly.' }),
  M({ id: 'frostwyrm', name: 'FROST WYRM', arch: 'flyer', body: 'serpent', habitat: ['snow'], tier: 4, hp: 420, speed: 6.0, dmg: 36, scale: 1.8, skin: '#bfe8ff', accent: '#3a5a7a', eye: '#4ac8ff', eyes: 2, wings: true, tail: true, desc: 'Blizzard with a spine.' }),
  M({ id: 'eyelet', name: 'EYELET', arch: 'flyer', body: 'floater', habitat: ['sky', 'night'], tier: 2, hp: 60, speed: 4.0, dmg: 14, scale: 0.8, skin: '#e4d9c8', accent: '#a01818', eye: '#ff2a18', eyes: 1, glow: true, desc: 'A sky-eye\'s spawn.' }),

  /* ---------- ambushers ---------- */
  M({ id: 'lurker', name: 'LURKER', arch: 'ambusher', body: 'biped', habitat: ['night'], tier: 2, hp: 110, speed: 6.0, dmg: 30, scale: 1.1, skin: '#101418', accent: '#1a2a3a', eye: '#4ac8ff', eyes: 2, claws: true, desc: 'You won\'t see it until it\'s on you.' }),
  M({ id: 'mimic', name: 'CHEST MIMIC', arch: 'ambusher', body: 'blob', habitat: ['ruin', 'cave'], tier: 2, hp: 180, speed: 4.5, dmg: 32, scale: 1.0, skin: '#6b4a2e', accent: '#c9a227', eye: '#ff3a1a', eyes: 2, desc: 'That loot had teeth.' }),
  M({ id: 'sandling', name: 'DUST SANDLING', arch: 'ambusher', body: 'serpent', habitat: ['ruin'], tier: 1, hp: 70, speed: 5.5, dmg: 18, scale: 1.0, skin: '#b8a070', accent: '#7a6a4a', eye: '#ffd27a', eyes: 2, tail: true, desc: 'Rises from the rubble.' }),
  M({ id: 'snowstalker', name: 'SNOW STALKER', arch: 'ambusher', body: 'quad', habitat: ['snow'], tier: 2, hp: 130, speed: 6.5, dmg: 26, scale: 1.2, skin: '#f0f4f8', accent: '#c8d8e8', eye: '#9fe0ff', eyes: 2, tail: true, claws: true, desc: 'White on white.' }),
  M({ id: 'wallcrawler', name: 'WALL CRAWLER', arch: 'ambusher', body: 'insect', habitat: ['cave'], tier: 2, hp: 95, speed: 5.8, dmg: 22, scale: 1.1, skin: '#3a3630', accent: '#59524a', eye: '#ff6a1a', eyes: 6, claws: true, desc: 'Drops from the ceiling.' }),

  /* ---------- swarm ---------- */
  M({ id: 'ratking', name: 'PLAGUE RATS', arch: 'swarm', body: 'quad', habitat: ['night', 'cave', 'swamp'], tier: 1, hp: 18, speed: 7.2, dmg: 5, scale: 0.45, skin: '#4a4036', accent: '#8a2a2a', eye: '#ff3a1a', eyes: 2, tail: true, packSize: 7, desc: 'Never just one.' }),
  M({ id: 'imp', name: 'GRAVE IMP', arch: 'swarm', body: 'biped', habitat: ['night'], tier: 1, hp: 25, speed: 6.0, dmg: 7, scale: 0.55, skin: '#6a2a2a', accent: '#2a1a1a', eye: '#ffd27a', eyes: 2, horns: true, tail: true, packSize: 5, desc: 'Cackling little knives.' }),
  M({ id: 'leechlet', name: 'LEECHLETS', arch: 'swarm', body: 'blob', habitat: ['swamp', 'cave'], tier: 1, hp: 20, speed: 5.5, dmg: 6, scale: 0.4, skin: '#2a3a2a', accent: '#4a6a2a', eye: '#c8ff2a', eyes: 1, packSize: 6, desc: 'Wet and hungry.' }),
  M({ id: 'bonebird', name: 'BONE BIRDS', arch: 'swarm', body: 'floater', habitat: ['night', 'ruin'], tier: 2, hp: 22, speed: 8.0, dmg: 6, scale: 0.5, skin: '#d8cfad', accent: '#8a8070', eye: '#ffffff', eyes: 2, wings: true, packSize: 6, desc: 'A murder of skeletons.' }),
  M({ id: 'snowmite', name: 'SNOW MITES', arch: 'swarm', body: 'insect', habitat: ['snow'], tier: 1, hp: 16, speed: 6.5, dmg: 5, scale: 0.4, skin: '#e8f0f8', accent: '#9fc8e8', eye: '#4ac8ff', eyes: 4, packSize: 8, desc: 'The drifts are moving.' }),

  /* ---------- exploders ---------- */
  M({ id: 'boomer', name: 'BOOMER', arch: 'exploder', body: 'blob', habitat: ['night'], tier: 1, hp: 60, speed: 4.2, dmg: 40, scale: 1.1, skin: '#7a8a3a', accent: '#ff8a2a', eye: '#ffd27a', eyes: 2, glow: true, desc: 'Keep it away from you.' }),
  M({ id: 'cinderhusk', name: 'CINDER HUSK', arch: 'exploder', body: 'biped', habitat: ['cave'], tier: 2, hp: 80, speed: 4.8, dmg: 50, scale: 1.0, skin: '#2a1a0a', accent: '#ff5a1a', eye: '#ffd27a', eyes: 2, glow: true, desc: 'Burning from the inside.' }),
  M({ id: 'gasbag', name: 'GAS BAG', arch: 'exploder', body: 'floater', habitat: ['swamp', 'night'], tier: 1, hp: 40, speed: 3.6, dmg: 35, scale: 1.2, skin: '#8a9a4a', accent: '#d8ff5a', eye: '#d8ff5a', eyes: 1, glow: true, desc: 'Drifts in. Pops.' }),
  M({ id: 'frostbomb', name: 'FROST BOMB', arch: 'exploder', body: 'quad', habitat: ['snow'], tier: 2, hp: 70, speed: 5.5, dmg: 45, scale: 0.9, skin: '#bfe8ff', accent: '#ffffff', eye: '#4ac8ff', eyes: 2, glow: true, desc: 'Shatters into shrapnel.' }),

  /* ---------- summoners ---------- */
  M({ id: 'necro', name: 'NECROMANCER', arch: 'summoner', body: 'biped', habitat: ['night'], tier: 3, hp: 160, speed: 2.2, dmg: 12, scale: 1.1, skin: '#1a1a2a', accent: '#6a5aaa', eye: '#b06bff', eyes: 2, horns: true, minion: 'imp', desc: 'Raises imps while it watches.' }),
  M({ id: 'broodmother', name: 'BROODMOTHER', arch: 'summoner', body: 'insect', habitat: ['cave', 'swamp'], tier: 3, hp: 260, speed: 1.6, dmg: 16, scale: 1.8, skin: '#3a2a26', accent: '#b8e23a', eye: '#d8ff5a', eyes: 6, minion: 'crawler', desc: 'The nest walks.' }),
  M({ id: 'ratmother', name: 'RAT MOTHER', arch: 'summoner', body: 'quad', habitat: ['night', 'swamp'], tier: 2, hp: 180, speed: 2.4, dmg: 14, scale: 1.3, skin: '#4a4036', accent: '#8a2a2a', eye: '#ff3a1a', eyes: 2, tail: true, minion: 'ratking', desc: 'Where the rats come from.' }),
  M({ id: 'hivequeen', name: 'MOTH QUEEN', arch: 'summoner', body: 'floater', habitat: ['night', 'ruin'], tier: 3, hp: 200, speed: 3.0, dmg: 14, scale: 1.4, skin: '#d8cfad', accent: '#3a3a3a', eye: '#ffffff', eyes: 2, wings: true, minion: 'skullmoth', desc: 'Her children blind you first.' }),

  /* ---------- leeches ---------- */
  M({ id: 'lamprey', name: 'GRAVE LAMPREY', arch: 'leech', body: 'serpent', habitat: ['swamp', 'night'], tier: 2, hp: 90, speed: 4.4, dmg: 10, scale: 1.0, skin: '#3a4a3a', accent: '#8a2a2a', eye: '#ff6a6a', eyes: 1, tail: true, desc: 'Latches on and drinks.' }),
  M({ id: 'tickbeast', name: 'TICK BEAST', arch: 'leech', body: 'insect', habitat: ['cave', 'swamp'], tier: 1, hp: 70, speed: 4.0, dmg: 8, scale: 0.9, skin: '#5a3a2a', accent: '#8a1a1a', eye: '#ff3a1a', eyes: 4, desc: 'Swells as you shrink.' }),
  M({ id: 'shadowleech', name: 'SHADOW LEECH', arch: 'leech', body: 'floater', habitat: ['night'], tier: 3, hp: 110, speed: 4.8, dmg: 12, scale: 0.9, skin: '#0a0a14', accent: '#2a2a4a', eye: '#b06bff', eyes: 1, glow: true, desc: 'Drinks warmth and light.' }),

  /* ---------- phasers ---------- */
  M({ id: 'blinker', name: 'BLINKER', arch: 'phaser', body: 'biped', habitat: ['night'], tier: 2, hp: 100, speed: 4.0, dmg: 24, scale: 1.0, skin: '#2a1a3a', accent: '#b06bff', eye: '#e0d2ff', eyes: 2, claws: true, desc: 'Here. There. Behind you.' }),
  M({ id: 'ghostknight', name: 'GHOST KNIGHT', arch: 'phaser', body: 'biped', habitat: ['ruin'], tier: 3, hp: 240, speed: 3.6, dmg: 34, scale: 1.25, skin: '#4a5a7a', accent: '#9fc0ff', eye: '#9fe0ff', eyes: 2, armor: true, spikes: true, desc: 'Still guarding a dead king.' }),
  M({ id: 'poltergeist', name: 'POLTERGEIST', arch: 'phaser', body: 'floater', habitat: ['ruin', 'night'], tier: 2, hp: 80, speed: 5.0, dmg: 18, scale: 0.8, skin: '#c8d8f0', accent: '#8fa8d8', eye: '#ffffff', eyes: 2, glow: true, desc: 'Throws itself at you.' }),

  /* ---------- screamers ---------- */
  M({ id: 'banshee', name: 'BANSHEE', arch: 'screamer', body: 'floater', habitat: ['night', 'ruin'], tier: 2, hp: 120, speed: 3.4, dmg: 10, scale: 1.1, skin: '#d8e8f8', accent: '#8fa8d8', eye: '#ffffff', eyes: 2, glow: true, desc: 'Her wail rallies the dead.' }),
  M({ id: 'howler', name: 'HOWLER', arch: 'screamer', body: 'quad', habitat: ['snow', 'night'], tier: 2, hp: 140, speed: 4.0, dmg: 16, scale: 1.2, skin: '#3a3a44', accent: '#8a8a9a', eye: '#ff3a1a', eyes: 2, tail: true, desc: 'The pack comes when it calls.' }),
  M({ id: 'drummer', name: 'BONE DRUMMER', arch: 'screamer', body: 'biped', habitat: ['ruin', 'night'], tier: 3, hp: 170, speed: 2.8, dmg: 14, scale: 1.1, skin: '#d8cfad', accent: '#6a1a1a', eye: '#ff6a1a', eyes: 2, desc: 'Beats its own ribcage.' }),

  /* ---------- golems (ruins) ---------- */
  M({ id: 'stonegolem', name: 'STONE GOLEM', arch: 'golem', body: 'colossus', habitat: ['ruin'], tier: 1, hp: 900, speed: 1.6, dmg: 48, scale: 2.2, skin: '#7a7a78', accent: '#4a4a48', eye: '#ffb13a', eyes: 2, armor: true, desc: 'The ruin\'s oldest tenant.' }),
  M({ id: 'mossgolem', name: 'MOSS GOLEM', arch: 'golem', body: 'colossus', habitat: ['ruin', 'swamp'], tier: 1, hp: 760, speed: 1.9, dmg: 40, scale: 2.0, skin: '#4a6a3a', accent: '#8a7a4a', eye: '#c8ff2a', eyes: 2, armor: true, desc: 'Overgrown and furious.' }),
  M({ id: 'irongolem', name: 'IRON GOLEM', arch: 'golem', body: 'colossus', habitat: ['ruin'], tier: 3, hp: 1400, speed: 1.5, dmg: 60, scale: 2.4, skin: '#3a3f47', accent: '#8a3a1a', eye: '#ff4a1a', eyes: 2, armor: true, spikes: true, desc: 'Rusted war-engine of a lost age.' }),
  M({ id: 'obsidiangolem', name: 'OBSIDIAN GOLEM', arch: 'golem', body: 'colossus', habitat: ['ruin'], tier: 4, hp: 1800, speed: 1.7, dmg: 70, scale: 2.5, skin: '#15151c', accent: '#ff4a1a', eye: '#ff2a18', eyes: 2, armor: true, glow: true, desc: 'Lava in the cracks. Do not get close.' }),
];

export const MOB_BY_ID: Record<string, MobDef> = Object.fromEntries(MOBS.map((m) => [m.id, m]));

export function mobsFor(habitat: Habitat, day: number): MobDef[] {
  return MOBS.filter((m) => m.habitat.includes(habitat) && m.tier <= Math.max(1, day) && m.arch !== 'golem');
}
export const GOLEMS = MOBS.filter((m) => m.arch === 'golem');

/** hit-height / radius helpers derived from body plan + scale */
export function mobHitHeight(m: MobDef) {
  const base = m.body === 'quad' ? 0.7 : m.body === 'insect' ? 0.5 : m.body === 'blob' ? 0.7
    : m.body === 'serpent' ? 0.6 : m.body === 'floater' ? 1.6 : m.body === 'colossus' ? 2.0 : 1.0;
  return base * m.scale;
}
export function mobHitRadius(m: MobDef) {
  const base = m.body === 'colossus' ? 1.3 : m.body === 'blob' ? 0.9 : m.body === 'quad' ? 0.75 : 0.65;
  return base * m.scale;
}
