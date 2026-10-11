import { useEffect, useState } from 'react';
import { G, WEAPONS, WORDER, CAVES, RUINS, clockString, dayFactor, nearestTown, type WeaponId } from './state';
import { SCOPED } from './guns';

interface Blip { x: number; y: number; type: string }
interface AllySnap { name: string; hp: number; maxHp: number }

interface Snap {
  health: number; stamina: number; kills: number; day: number;
  clock: string; df: number; isNight: boolean;
  weapon: WeaponId; ammo: Record<WeaponId, number>; owned: Record<WeaponId, boolean>;
  blips: Blip[]; logs: { id: number; text: string; life: number }[];
  hurt: number; boom: number; flashlight: boolean; time: number;
  prompt: string | null; allies: AllySnap[]; squad: number; spin: number;
  aiming: boolean; recoil: number;
  town: string; cave: string | null; bosses: number;
  depth: number | null; exitDistance: number; caveLength: number;
  nearbyMine: { name: string; distance: number } | null;
}

export default function HUD() {
  const [s, setS] = useState<Snap | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const yaw = G.yaw;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const blips: Blip[] = [];
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.pos.y - G.pos.y) > 18) continue;
        if (e.mob && !e.awake && e.mob.arch === 'ambusher') continue; // hidden from radar
        const dx = e.pos.x - G.pos.x, dz = e.pos.z - G.pos.z;
        if (Math.hypot(dx, dz) > 55) continue;
        const type = e.mob ? (e.mob.arch === 'golem' ? 'golem' : e.mob.scale >= 1.6 ? 'bigmob' : e.mob.arch === 'flyer' ? 'flymob' : 'mob') : e.type;
        blips.push({ x: dx * cos - dz * sin, y: -dx * sin - dz * cos, type });
      }
      for (const p of G.pickups) {
        if (Math.abs(p.pos.y - G.pos.y) > 18) continue;
        const dx = p.pos.x - G.pos.x, dz = p.pos.z - G.pos.z;
        if (Math.hypot(dx, dz) > 55) continue;
        blips.push({ x: dx * cos - dz * sin, y: -dx * sin - dz * cos, type: p.kind });
      }
      for (const c of G.chests) {
        if (c.opened) continue;
        if (Math.abs(c.pos.y - G.pos.y) > 18) continue;
        const dx = c.pos.x - G.pos.x, dz = c.pos.z - G.pos.z;
        if (Math.hypot(dx, dz) > 55) continue;
        blips.push({ x: dx * cos - dz * sin, y: -dx * sin - dz * cos, type: 'chest' });
      }
      for (const a of G.allies) {
        if (a.dead) continue;
        if (Math.abs(a.pos.y - G.pos.y) > 18) continue;
        const dx = a.pos.x - G.pos.x, dz = a.pos.z - G.pos.z;
        if (Math.hypot(dx, dz) > 55) continue;
        blips.push({ x: dx * cos - dz * sin, y: -dx * sin - dz * cos, type: a.recruited ? 'ally' : 'survivor' });
      }
      const currentCave = G.inCave ? CAVES.find((c) => c.id === G.inCave) : undefined;
      let nearbyMine: Snap['nearbyMine'] = null;
      if (!currentCave) {
        for (const c of CAVES) {
          const distance = Math.hypot(c.x - G.pos.x, c.z - G.pos.z, c.floorY - G.pos.y);
          if (distance < 150 && (!nearbyMine || distance < nearbyMine.distance)) nearbyMine = { name: c.name, distance };
        }
      }
      setS({
        health: G.health, stamina: G.stamina, kills: G.kills, day: G.day,
        clock: clockString(G.time), df: dayFactor(G.time), isNight: G.isNight,
        weapon: G.weapon, ammo: { ...G.ammo }, owned: { ...G.owned },
        blips, logs: G.logs.map((l) => ({ ...l })), hurt: G.hurt, boom: G.boomFlash,
        flashlight: G.flashlight, time: G.time,
        prompt: G.interactPrompt,
        allies: G.allies.filter((a) => a.recruited && !a.dead).map((a) => ({ name: a.name, hp: a.hp, maxHp: a.maxHp })),
        squad: G.allies.filter((a) => a.recruited && !a.dead).length,
        spin: G.minigunSpin,
        aiming: G.aiming, recoil: G.recoil,
        town: (() => { const t = nearestTown(G.pos.x, G.pos.z); return Math.hypot(G.pos.x - t.x, G.pos.z - t.z) < t.radius + 8 ? t.name : ''; })(),
        cave: G.inCave ? (CAVES.find((c) => c.id === G.inCave)?.name ?? null)
          : G.inRuin ? `🏛 ${RUINS.find((r) => r.id === G.inRuin)?.name ?? 'RUINS'}` : null,
        bosses: G.bossesSlain,
        depth: currentCave ? Math.max(0, Math.round(currentCave.floorY - G.pos.y)) : null,
        exitDistance: currentCave ? Math.round(Math.hypot(currentCave.x - G.pos.x, currentCave.z - G.pos.z)) : 0,
        caveLength: currentCave?.depth ?? 0,
        nearbyMine,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  if (!s) return null;
  const w = WEAPONS[s.weapon];
  const lowHp = s.health < 35;
  const explosive = !!w.explosive;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* damage vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          opacity: Math.min(0.85, s.hurt * 1.3 + (lowHp ? 0.25 : 0)),
          background: 'radial-gradient(circle at 50% 50%, rgba(140,0,0,0) 35%, rgba(150,0,0,0.75) 100%)',
        }}
      />
      {/* explosion flash */}
      <div
        className="absolute inset-0"
        style={{
          opacity: Math.min(0.55, s.boom),
          background: 'radial-gradient(circle at 50% 55%, rgba(255,180,80,0.9) 0%, rgba(255,120,30,0.25) 50%, transparent 75%)',
        }}
      />
      {/* night vignette */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.22 + (1 - s.df) * 0.45,
          background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,6,0.95) 100%)',
        }}
      />

      {/* hip-fire crosshair / ADS reticle */}
      {!s.aiming && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {explosive ? (
            <div className="relative h-10 w-10">
              <span className="absolute inset-0 rounded-full border-2 border-orange-300/80" />
              <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-300" />
            </div>
          ) : (
            <div className="relative h-1 w-1">
              <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-300 shadow-[0_0_5px_#ff5555]" />
              {[-1, 1].map((dir) => (
                <span key={dir} className="absolute top-1/2 h-[2px] w-2 -translate-y-1/2 bg-white/80"
                  style={{ [dir < 0 ? 'right' : 'left']: `${5 + s.recoil * 18}px` }} />
              ))}
              {[-1, 1].map((dir) => (
                <span key={dir} className="absolute left-1/2 h-2 w-[2px] -translate-x-1/2 bg-white/80"
                  style={{ [dir < 0 ? 'bottom' : 'top']: `${5 + s.recoil * 18}px` }} />
              ))}
            </div>
          )}
        </div>
      )}
      {s.aiming && !SCOPED[s.weapon] && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-9 w-9 rounded-full border border-white/45 shadow-[0_0_12px_rgba(255,255,255,.18)]">
            <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white/80" />
            <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-white/80" />
            <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/80" />
            <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/80" />
            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-300" />
          </div>
        </div>
      )}
      {s.aiming && SCOPED[s.weapon] && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <div className="relative h-[min(78vmin,78vh)] w-[min(78vmin,78vh)] rounded-full border-[10px] border-black/95 bg-transparent shadow-[0_0_0_100vmax_rgba(0,0,0,.92)]">
            <div className="absolute inset-3 rounded-full border border-sky-100/30" />
            {/* mil-dot reticle */}
            <span className="absolute left-1/2 top-1/2 h-[70%] w-px -translate-x-1/2 -translate-y-1/2 bg-black/80" />
            <span className="absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 -translate-y-1/2 bg-black/80" />
            {[-3, -2, -1, 1, 2, 3].map((i) => (
              <span key={`h${i}`} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-black/80" style={{ left: `calc(50% + ${i * 8}% - 3px)` }} />
            ))}
            {[-3, -2, -1, 1, 2, 3].map((i) => (
              <span key={`v${i}`} className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black/80" style={{ top: `calc(50% + ${i * 8}% - 3px)` }} />
            ))}
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300 bg-red-500/40 shadow-[0_0_10px_#ef4444]" />
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 font-[Cinzel,serif] text-[9px] tracking-[0.3em] text-white/60">
              {s.weapon === 'sniper' ? 'LONGSHOT 12× · HOLD RIGHT CLICK' : s.weapon === 'm14' ? 'EBR 4× · HOLD RIGHT CLICK' : 'VESPER OPTIC · HOLD RIGHT CLICK'}
            </span>
          </div>
        </div>
      )}

      {/* location tag */}
      {(s.town || s.cave) && (
        <div className="absolute left-5 top-5 rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 font-[Cinzel,serif] text-xs tracking-[0.3em] text-white/70 backdrop-blur-md">
          {s.cave ? `⛰ ${s.cave}` : `⌂ ${s.town}`}
          {s.depth !== null && (
            <div className="mt-2 border-t border-white/10 pt-2 font-mono text-[10px] tracking-wide text-sky-100/70">
              DEPTH {s.depth} m / EXIT {s.exitDistance} m / SHAFT {s.caveLength} m
              <div className="mt-1 text-amber-200/70">Follow the green EXIT signs. Keep off the lava.</div>
            </div>
          )}
        </div>
      )}
      {s.nearbyMine && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded border border-white/10 bg-black/55 px-3 py-2 text-center text-xs text-white/65">
          Nearest cave: <span className="text-sky-100">{s.nearbyMine.name}</span> / {Math.round(s.nearbyMine.distance)} m
        </div>
      )}

      {/* interact prompt */}
      {s.prompt && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-lg border border-amber-300/40 bg-black/60 px-4 py-2 font-[Cinzel,serif] text-sm tracking-[0.15em] text-amber-100 backdrop-blur-md">
          {s.prompt}
        </div>
      )}

      {/* top center: clock */}
      <div className="absolute left-1/2 top-4 w-[340px] -translate-x-1/2 rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center justify-between font-[Cinzel,serif] text-sm tracking-widest">
          <span className={s.isNight ? 'text-indigo-300' : 'text-amber-200'}>
            {s.isNight ? '🌙 NIGHT' : '☀ DAY'} {s.day}
          </span>
          <span className="text-white/80">{s.clock}</span>
        </div>
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: '100%',
              background: 'linear-gradient(90deg,#1b2a4a 0%,#2f4a7a 18%,#ffcc77 25%,#8ec5f0 50%,#ff9a5a 75%,#2f4a7a 82%,#1b2a4a 100%)',
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded bg-white shadow-[0_0_6px_white]"
            style={{ left: `${s.time * 100}%` }}
          />
        </div>
        <div className="mt-1 text-center font-[Crimson_Pro,serif] text-[11px] italic text-white/50">
          {s.isNight ? 'Eyes open in the sky. Keep moving.' : 'Loot chests · recruit survivors [E] · the dead burn in sunlight.'}
        </div>
      </div>

      {/* bottom-left: vitals + squad */}
      <div className="absolute bottom-5 left-5 w-64 rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
        <div className="flex items-end justify-between">
          <span className="font-[Cinzel,serif] text-xs tracking-[0.2em] text-red-300">HEALTH</span>
          <span className={`font-[Cinzel,serif] text-lg ${lowHp ? 'animate-pulse text-red-400' : 'text-white'}`}>
            {Math.ceil(s.health)}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-red-900/50 bg-red-950/60">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${s.health}%`,
              background: lowHp ? 'linear-gradient(90deg,#7f1d1d,#ef4444)' : 'linear-gradient(90deg,#991b1b,#dc2626)',
            }}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-[Cinzel,serif] text-[10px] tracking-[0.2em] text-sky-300">STAMINA</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sky-950/70">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-700 to-sky-400" style={{ width: `${s.stamina * 100}%` }} />
          </div>
        </div>
        {s.weapon === 'minigun' && (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-[Cinzel,serif] text-[10px] tracking-[0.2em] text-orange-300">SPIN</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-orange-950/70">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-700 to-amber-300" style={{ width: `${s.spin * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span>KILLS <b className="text-red-300">{s.kills}</b></span>
          <span>SQUAD <b className="text-emerald-300">{s.squad}/3</b></span>
          <span className={s.flashlight ? 'text-amber-200' : 'text-white/35'}>🔦 {s.flashlight ? 'ON' : 'OFF'}</span>
        </div>
        {s.allies.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            {s.allies.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-[10px]">
                <span className="w-24 truncate font-[Cinzel,serif] tracking-wider text-emerald-200">{a.name}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-emerald-950/70">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(a.hp / a.maxHp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* bottom-right: weapons */}
      <div
        className="absolute bottom-5 right-5 w-72 rounded-xl border border-white/10 bg-black/45 p-3 text-right backdrop-blur-md"
        style={{ transform: 'scale(0.45921)', transformOrigin: 'bottom right' }}
      >
        <div className="font-[Cinzel,serif] text-sm tracking-[0.18em] text-amber-200">{w.name}</div>
        <div className="font-[Cinzel,serif] text-4xl leading-none text-white">
          {s.ammo[s.weapon]}
          <span className="ml-1 text-sm text-white/40">{explosive ? 'rockets' : 'rds'}</span>
        </div>
        <div className="mt-1 text-right font-[Crimson_Pro,serif] text-[11px] italic text-white/45">{w.desc}</div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {WORDER.map((id, i) => (
            <div
              key={id}
              className={`rounded-md border px-1 py-1 text-center text-[10px] tracking-wider transition ${
                !s.owned[id]
                  ? 'border-white/5 bg-black/30 text-white/20'
                  : id === s.weapon
                  ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                  : 'border-white/15 bg-black/30 text-white/55'
              }`}
            >
              {i + 1} · {WEAPONS[id].short}
            </div>
          ))}
        </div>
      </div>

      {/* radar */}
      <div className="absolute right-5 top-5 h-36 w-36 rounded-full border border-white/15 bg-black/50 backdrop-blur-md">
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <div className="absolute inset-9 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        {s.blips.map((b, i) => {
          const px = 72 + (b.x / 55) * 66;
          const py = 72 + (b.y / 55) * 66;
          const color =
            b.type === 'zombie' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
            : b.type === 'stalker' ? 'bg-fuchsia-400 shadow-[0_0_8px_#e879f9]'
            : b.type === 'skeleton' ? 'bg-slate-200 shadow-[0_0_8px_#e2e8f0]'
            : b.type === 'reaper' ? 'bg-rose-500 shadow-[0_0_8px_#fb7185]'
            : b.type === 'zkorbus' ? 'bg-cyan-100 shadow-[0_0_10px_#a5f3fc]'
            : b.type === 'skyeye' ? 'bg-orange-500 shadow-[0_0_10px_#f97316]'
            : b.type === 'yeti' ? 'bg-sky-100 shadow-[0_0_10px_#bae6fd]'
            : b.type === 'behemoth' ? 'bg-amber-700 shadow-[0_0_10px_#b45309]'
            : b.type === 'golem' ? 'bg-stone-300 shadow-[0_0_12px_#fbbf24] ring-2 ring-amber-400/70'
            : b.type === 'bigmob' ? 'bg-rose-700 shadow-[0_0_10px_#be123c]'
            : b.type === 'flymob' ? 'bg-violet-400 shadow-[0_0_8px_#a78bfa]'
            : b.type === 'mob' ? 'bg-red-400 shadow-[0_0_6px_#f87171]'
            : b.type === 'medkit' ? 'bg-emerald-400'
            : b.type === 'chest' ? 'bg-amber-300 shadow-[0_0_8px_#fcd34d]'
            : b.type === 'ally' ? 'bg-green-400'
            : b.type === 'survivor' ? 'bg-yellow-200'
            : 'bg-sky-400';
          const size = ['skyeye', 'zkorbus', 'yeti', 'behemoth', 'golem', 'bigmob'].includes(b.type) ? 'h-2.5 w-2.5' : ['zombie', 'stalker', 'skeleton', 'reaper', 'ghoul', 'wraith', 'spitter', 'mob', 'flymob'].includes(b.type) ? 'h-2 w-2' : 'h-1.5 w-1.5';
          return (
            <span
              key={i}
              className={`absolute rounded-full ${color} ${size}`}
              style={{ left: px, top: py, transform: 'translate(-50%,-50%)' }}
            />
          );
        })}
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        <span className="absolute left-1/2 top-1 -translate-x-1/2 font-[Cinzel,serif] text-[9px] tracking-widest text-white/50">N</span>
      </div>

      {/* event log */}
      <div className="absolute left-1/2 top-28 flex -translate-x-1/2 flex-col items-center gap-1">
        {s.logs.map((l) => (
          <div
            key={l.id}
            className="rounded-md border border-white/10 bg-black/55 px-3 py-1 font-[Cinzel,serif] text-xs tracking-[0.18em] text-red-200 backdrop-blur-md"
            style={{ opacity: Math.min(1, l.life) }}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
