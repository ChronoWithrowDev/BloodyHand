import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Scene from './game/Scene';
import HUD from './game/HUD';
import {
  G, WORDER, resetGame, tryInteract, loadWorld, saveWorld, listSaves, clearSave,
  type SaveMeta,
} from './game/state';
import { initAudio } from './game/audio';
import { getQuality, applyQuality, QUALITY_PRESETS, type Quality } from './game/perf';

type Phase = 'menu' | 'playing' | 'paused' | 'dead';
type SlotMode = 'load' | 'save' | 'new';

function fmtAgo(ts: number) {
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function SlotMenu({ mode, onPick, onClose, current }: {
  mode: SlotMode; onPick: (slot: number) => void; onClose: () => void; current: number;
}) {
  const [saves, setSaves] = useState<SaveMeta[]>(() => listSaves());
  const [confirm, setConfirm] = useState<number | null>(null);
  const title = mode === 'load' ? 'LOAD GAME' : mode === 'save' ? 'SAVE GAME' : 'NEW GAME';
  const sub = mode === 'load' ? 'Choose a world to return to.'
    : mode === 'save' ? 'Choose a slot to write this world into.'
    : 'Choose a slot. A new world will be carved here.';
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="w-[min(720px,92vw)] rounded-2xl border border-white/10 bg-[#0b0d16]/95 p-6 shadow-[0_0_80px_rgba(150,20,20,.25)]">
        <div className="text-center">
          <h2 className="font-[Cinzel_Decorative,serif] text-3xl text-red-400" style={{ textShadow: '0 0 20px rgba(220,38,38,.45)' }}>{title}</h2>
          <p className="mt-1 font-[Crimson_Pro,serif] text-sm italic text-white/55">{sub}</p>
        </div>
        <div className="mt-5 space-y-3">
          {saves.map((s) => {
            const disabled = mode === 'load' && s.empty;
            const willOverwrite = !s.empty && mode !== 'load';
            const isCurrent = s.slot === current && !s.empty;
            return (
              <div key={s.slot}
                className={`flex items-center gap-4 rounded-xl border p-4 transition ${
                  disabled ? 'border-white/5 bg-black/30 opacity-50' : 'border-white/10 bg-white/[0.03] hover:border-red-400/50 hover:bg-red-950/20'}`}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 font-[Cinzel,serif] text-xl text-red-300">
                  {s.slot + 1}
                </div>
                <div className="min-w-0 flex-1">
                  {s.empty ? (
                    <div className="font-[Cinzel,serif] text-sm tracking-[0.25em] text-white/35">— EMPTY SLOT —</div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-3 font-[Cinzel,serif] text-sm tracking-wider text-white/90">
                        <span>DAY {s.day}</span>
                        <span className="text-white/40">·</span>
                        <span className="text-emerald-300">{s.nights} NIGHTS</span>
                        <span className="text-white/40">·</span>
                        <span className="text-red-300">{s.kills} KILLS</span>
                        {isCurrent && <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[9px] tracking-[0.3em] text-red-200">CURRENT</span>}
                      </div>
                      <div className="mt-0.5 font-[Crimson_Pro,serif] text-xs text-white/50">
                        {s.town || 'THE WILDS'} · {s.weapons} weapons · HP {Math.ceil(s.health)} · saved {fmtAgo(s.savedAt)}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {confirm === s.slot ? (
                    <>
                      <button onClick={() => { onPick(s.slot); }}
                        className="rounded-md border border-red-400/60 bg-red-800/60 px-3 py-2 font-[Cinzel,serif] text-[11px] tracking-[0.2em] text-red-50 hover:bg-red-700/70">
                        OVERWRITE
                      </button>
                      <button onClick={() => setConfirm(null)}
                        className="rounded-md border border-white/15 bg-white/5 px-3 py-2 font-[Cinzel,serif] text-[11px] tracking-[0.2em] text-white/60 hover:bg-white/10">
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <>
                      <button disabled={disabled}
                        onClick={() => (willOverwrite ? setConfirm(s.slot) : onPick(s.slot))}
                        className="rounded-md border border-red-500/40 bg-red-900/40 px-4 py-2 font-[Cinzel,serif] text-[11px] tracking-[0.2em] text-red-100 transition hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-40">
                        {mode === 'load' ? 'LOAD' : mode === 'save' ? 'SAVE' : 'START'}
                      </button>
                      {!s.empty && (
                        <button onClick={() => { clearSave(s.slot); setSaves(listSaves()); setConfirm(null); }}
                          title="Delete this save"
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-[Cinzel,serif] text-[11px] tracking-[0.2em] text-white/45 hover:bg-white/10 hover:text-white/80">
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 text-center">
          <button onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-8 py-2.5 font-[Cinzel,serif] text-xs tracking-[0.25em] text-white/70 hover:bg-white/10">
            BACK
          </button>
        </div>
      </div>
    </div>
  );
}

function QualityPicker({ quality, onChange }: { quality: Quality; onChange: (q: Quality) => void }) {
  const opts: { id: Quality; label: string; hint: string }[] = [
    { id: 'low', label: 'LOW', hint: 'no shadows · no bloom · 1× pixels' },
    { id: 'medium', label: 'MEDIUM', hint: 'soft shadows · bloom · balanced' },
    { id: 'high', label: 'HIGH', hint: 'sharp shadows · bloom · hi-res' },
  ];
  return (
    <div className="mt-5 inline-flex flex-col items-center gap-2">
      <span className="font-[Cinzel,serif] text-[10px] tracking-[0.4em] text-white/45">GRAPHICS QUALITY</span>
      <div className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            title={o.hint}
            className={`rounded-md border px-4 py-1.5 font-[Cinzel,serif] text-xs tracking-[0.2em] transition ${
              quality === o.id
                ? 'border-red-400/70 bg-red-900/50 text-red-100 shadow-[0_0_14px_rgba(220,38,38,.35)]'
                : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="font-[Crimson_Pro,serif] text-[11px] italic text-white/35">{opts.find((o) => o.id === quality)?.hint}</span>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [session, setSession] = useState(0);
  const [mouseHint, setMouseHint] = useState(false);
  const [stats, setStats] = useState({ kills: 0, day: 1, nights: 0 });
  const [quality, setQualityState] = useState<Quality>(() => getQuality());
  const preset = QUALITY_PRESETS[quality];
  const changeQuality = useCallback((q: Quality) => {
    applyQuality(q);
    setQualityState(q);
  }, []);
  const gameRef = useRef<HTMLDivElement>(null);
  const capturedRef = useRef(false);
  const phaseRef = useRef<Phase>('menu');
  phaseRef.current = phase;

  const lock = useCallback(() => {
    gameRef.current?.focus({ preventScroll: true });
    try {
      if (!gameRef.current?.requestPointerLock) { setMouseHint(true); return; }
      const result = gameRef.current?.requestPointerLock?.();
      Promise.resolve(result).catch(() => setMouseHint(true));
    } catch {
      setMouseHint(true);
    }
  }, []);

  const [slotMenu, setSlotMenu] = useState<SlotMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const beginPlay = useCallback(() => {
    G.running = false;
    G.gameOver = false;
    phaseRef.current = 'playing';
    setSession((n) => n + 1);
    setPhase('playing');
    lock();
  }, [lock]);

  const newGame = useCallback((slot: number) => {
    initAudio();
    resetGame();
    G.slot = slot;
    saveWorld(slot);
    setSlotMenu(null);
    beginPlay();
  }, [beginPlay]);

  const loadGame = useCallback((slot: number) => {
    initAudio();
    if (!loadWorld(slot)) { flash('THAT SLOT IS EMPTY'); return; }
    setSlotMenu(null);
    beginPlay();
  }, [beginPlay, flash]);

  const saveGame = useCallback((slot: number) => {
    const durable = saveWorld(slot);
    setSlotMenu(null);
    flash(durable ? `WORLD SAVED / SLOT ${slot + 1}` : 'WORLD SAVED FOR THIS TAB ONLY');
  }, [flash]);

  // "Continue": most recently saved slot, else a fresh world in slot 1
  const start = useCallback(() => {
    initAudio();
    const saves = listSaves().filter((s) => !s.empty).sort((a, b) => b.savedAt - a.savedAt);
    if (saves.length && loadWorld(saves[0].slot)) { beginPlay(); return; }
    resetGame();
    G.slot = 0;
    saveWorld(0);
    beginPlay();
  }, [beginPlay]);

  const resume = useCallback(() => {
    initAudio();
    G.running = true;
    phaseRef.current = 'playing';
    setPhase('playing');
    lock();
  }, [lock]);

  const onDeath = useCallback(() => {
    setStats({ kills: G.kills, day: G.day, nights: G.nightsSurvived });
    setPhase('dead');
    document.exitPointerLock?.();
  }, []);

  useEffect(() => {
    const onChange = () => {
      const locked = !!document.pointerLockElement;
      const wasLocked = capturedRef.current;
      capturedRef.current = locked;
      if (locked) setMouseHint(false);
      if (G.gameOver) return;
      if (wasLocked && !locked && phaseRef.current === 'playing') {
        G.running = false;
        G.keys.clear();
        G.shooting = false;
        G.aiming = false;
        setPhase('paused');
      }
    };
    const onError = () => setMouseHint(true);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('pointerlockerror', onError);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('pointerlockerror', onError);
    };
  }, []);

  useEffect(() => {
    const cycle = (dir: 1 | -1) => {
      const owned = WORDER.filter((w) => G.owned[w]);
      if (owned.length < 2) return;
      const i = owned.indexOf(G.weapon);
      G.weapon = owned[(i + dir + owned.length) % owned.length];
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      G.keys.add(k === 'shift' ? 'shift' : k);
      if (phaseRef.current !== 'playing') return;
      if (k === 'escape') {
        G.running = false; G.keys.clear(); G.shooting = false; G.aiming = false;
        setPhase('paused'); document.exitPointerLock?.();
        return;
      }
      if (e.repeat) return;
      if (k === 'f5') { e.preventDefault(); const durable = saveWorld(); flash(durable ? `QUICKSAVED / SLOT ${G.slot + 1}` : 'WORLD SAVED FOR THIS TAB ONLY'); }
      if (k === 'f') G.flashlight = !G.flashlight;
      if (k === 'e') tryInteract();
      if (k === 'q') cycle(1);
      const n = parseInt(k, 10);
      if (n >= 1 && n <= WORDER.length) {
        const id = WORDER[n - 1];
        if (G.owned[id]) { G.weapon = id; G.minigunSpin = 0; }
      }
    };
    const up = (e: KeyboardEvent) => G.keys.delete(e.key.toLowerCase() === 'shift' ? 'shift' : e.key.toLowerCase());
    const blur = () => { G.keys.clear(); G.shooting = false; G.aiming = false; };

    const mdown = (e: MouseEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (!document.pointerLockElement) {
        lock();
      }
      if (e.button === 0) G.shooting = true;
      if (e.button === 2) G.aiming = true;
    };
    const mup = (e: MouseEvent) => {
      if (e.button === 0) G.shooting = false;
      if (e.button === 2) G.aiming = false;
    };
    const mmove = (e: MouseEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (!document.pointerLockElement && e.buttons === 0) return;
      const sensitivity = G.aiming ? 0.00082 : 0.0022;
      G.yaw -= e.movementX * sensitivity;
      G.pitch -= e.movementY * sensitivity;
      G.pitch = THREE.MathUtils.clamp(G.pitch, -1.25, 1.25);
    };
    const wheel = (e: WheelEvent) => {
      if (phaseRef.current !== 'playing') return;
      cycle(e.deltaY > 0 ? 1 : -1);
    };
    const ctx = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('mousedown', mdown);
    window.addEventListener('mouseup', mup);
    window.addEventListener('mousemove', mmove);
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('contextmenu', ctx);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mousedown', mdown);
      window.removeEventListener('mouseup', mup);
      window.removeEventListener('mousemove', mmove);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('contextmenu', ctx);
    };
  }, [lock, flash]);

  const playing = phase === 'playing' || phase === 'paused' || phase === 'dead';
  const hasAnySave = listSaves().some((s) => !s.empty);

  return (
    <div ref={gameRef} tabIndex={-1} className="relative h-screen w-full overflow-hidden bg-[#070a12] text-white outline-none">
      {playing && (
        <Canvas
          key={`${quality}-${session}`}
          shadows={preset.shadows ? { type: THREE.PCFShadowMap } : false}
          dpr={preset.dpr}
          gl={{ antialias: !preset.bloom, powerPreference: 'high-performance', stencil: false, depth: true }}
          camera={{ fov: 76, near: 0.08, far: 420, position: [0, 1.7, 9] }}
          onCreated={({ gl, camera }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.15;
            camera.rotation.order = 'YXZ';
            camera.position.set(G.pos.x, G.pos.y + 1.7, G.pos.z);
            camera.rotation.set(G.pitch, G.yaw, 0);
            G.running = phaseRef.current === 'playing';
          }}
        >
          <Scene onDeath={onDeath} />
          {preset.bloom && (
            <EffectComposer multisampling={0} resolutionScale={0.5}>
              <Bloom intensity={0.5} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur levels={5} />
              <Vignette darkness={0.5} offset={0.22} />
            </EffectComposer>
          )}
        </Canvas>
      )}

      {phase === 'playing' && <HUD />}
      {phase === 'playing' && mouseHint && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 w-[min(500px,88vw)] -translate-x-1/2 rounded border border-white/15 bg-black/70 px-4 py-2 text-center text-sm text-white/85">
          Hold a mouse button and drag to look. Esc pauses the game.
        </div>
      )}

      {phase === 'menu' && (
        <div className="absolute inset-0 z-50">
          <img src="/bloody-hand-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/80 via-[#0a0d18]/75 to-[#070a12]" />
          <div className="relative flex h-full w-full items-center justify-center overflow-y-auto p-6">
            <div className="w-full max-w-5xl py-6 text-center">
              <p className="font-[Cinzel,serif] text-xs tracking-[0.4em] text-red-400/80">EXPLORE BY DAY. SURVIVE THE NIGHT.</p>
              <h1
                className="mt-2 font-[Cinzel_Decorative,serif] text-6xl leading-none text-red-600 md:text-8xl"
                style={{ textShadow: '0 0 28px rgba(220,38,38,.55), 0 6px 0 rgba(0,0,0,.6)' }}
              >
                BLOODY HAND
              </h1>
              <div className="mx-auto mt-4 h-px w-64 bg-gradient-to-r from-transparent via-red-700 to-transparent" />

              <p className="mx-auto mt-5 max-w-3xl font-[Crimson_Pro,serif] text-lg italic text-white/70">
                Scavenge the towns, brave the snowy peaks, and descend into crystal-lit caves.
                The deeper you go, the hotter the dark becomes.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-[Crimson_Pro,serif] text-sm text-white/55">
                <span><b className="text-white/80">WASD</b> move</span>
                <span><b className="text-white/80">SPACE</b> jump</span>
                <span><b className="text-white/80">SHIFT</b> sprint</span>
                <span><b className="text-white/80">CLICK</b> shoot</span>
                <span><b className="text-white/80">RIGHT CLICK</b> aim / sights</span>
                <span><b className="text-white/80">1-9 / Q / WHEEL</b> guns</span>
                <span><b className="text-white/80">E</b> chest / recruit</span>
                <span><b className="text-white/80">F</b> flashlight</span>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={start}
                  className="group relative overflow-hidden rounded-xl border-2 border-red-600/50 bg-gradient-to-br from-red-900 via-[#3b0a0a] to-black px-12 py-5 font-[Cinzel,serif] text-2xl tracking-[0.25em] text-red-100 shadow-[0_0_60px_rgba(150,20,20,.45)] transition hover:scale-[1.03] hover:border-red-400"
                >
                  <span className="relative z-10">{hasAnySave ? 'CONTINUE' : 'PLAY NOW'}</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-red-500/25 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                </button>
                <button
                  onClick={() => setSlotMenu('new')}
                  className="rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-[Cinzel,serif] text-sm tracking-[0.3em] text-white/85 transition hover:scale-105 hover:border-red-400/60 hover:bg-red-950/30"
                >
                  NEW GAME
                </button>
                <button
                  onClick={() => setSlotMenu('load')}
                  disabled={!hasAnySave}
                  className="rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-[Cinzel,serif] text-sm tracking-[0.3em] text-white/85 transition hover:scale-105 hover:border-red-400/60 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
                >
                  LOAD GAME
                </button>
              </div>
              <p className="mt-3 font-[Crimson_Pro,serif] text-xs text-white/35">
                Starting loadout: M119 PISTOL · 120 rounds · 3 save slots · F5 quicksaves · autosaves at dawn
              </p>
              <QualityPicker quality={quality} onChange={changeQuality} />
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
          <h2 className="font-[Cinzel_Decorative,serif] text-5xl text-red-400" style={{ textShadow: '0 0 24px rgba(220,38,38,.5)' }}>
            PAUSED
          </h2>
          <p className="mt-3 font-[Crimson_Pro,serif] text-white/60 italic">The night waits for you. · Slot {G.slot + 1}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={resume}
              className="rounded-lg border border-red-600/50 bg-red-900/50 px-8 py-3 font-[Cinzel,serif] tracking-[0.2em] text-red-100 transition hover:scale-105 hover:bg-red-800/60"
            >
              RESUME
            </button>
            <button
              onClick={() => saveGame(G.slot)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-900/30 px-6 py-3 font-[Cinzel,serif] tracking-[0.2em] text-emerald-100 transition hover:scale-105 hover:bg-emerald-800/40"
            >
              QUICK SAVE
            </button>
            <button
              onClick={() => setSlotMenu('save')}
              className="rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-[Cinzel,serif] tracking-[0.2em] text-white/70 transition hover:scale-105 hover:bg-white/10"
            >
              SAVE AS…
            </button>
            <button
              onClick={() => setSlotMenu('load')}
              className="rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-[Cinzel,serif] tracking-[0.2em] text-white/70 transition hover:scale-105 hover:bg-white/10"
            >
              LOAD
            </button>
            <button
              onClick={() => { saveWorld(); G.running = false; setPhase('menu'); }}
              className="rounded-lg border border-white/15 bg-white/5 px-6 py-3 font-[Cinzel,serif] tracking-[0.2em] text-white/70 transition hover:scale-105 hover:bg-white/10"
            >
              SAVE & QUIT
            </button>
          </div>
          <QualityPicker quality={quality} onChange={changeQuality} />
          <p className="mt-6 font-[Crimson_Pro,serif] text-xs text-white/35">Click RESUME to recapture the mouse · F5 quicksaves in-game</p>
        </div>
      )}

      {phase === 'dead' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-red-950/60 to-black/90 backdrop-blur-md">
          <h2
            className="font-[Cinzel_Decorative,serif] text-7xl text-red-700 md:text-9xl"
            style={{ textShadow: '0 0 40px rgba(220,38,38,.6)' }}
          >
            YOU DIED
          </h2>
          <p className="mt-3 font-[Crimson_Pro,serif] text-xl italic text-white/60">A bloody hand closes over Vesper.</p>
          <div className="mt-8 flex gap-8 rounded-xl border border-white/10 bg-black/50 px-10 py-5 text-center backdrop-blur-sm">
            <div>
              <div className="font-[Cinzel,serif] text-3xl text-red-300">{stats.day}</div>
              <div className="text-[11px] tracking-[0.2em] text-white/45">DAYS</div>
            </div>
            <div>
              <div className="font-[Cinzel,serif] text-3xl text-red-300">{stats.nights}</div>
              <div className="text-[11px] tracking-[0.2em] text-white/45">NIGHTS SURVIVED</div>
            </div>
            <div>
              <div className="font-[Cinzel,serif] text-3xl text-red-300">{stats.kills}</div>
              <div className="text-[11px] tracking-[0.2em] text-white/45">KILLS</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => loadGame(G.slot)}
              className="rounded-lg border-2 border-red-600/50 bg-gradient-to-br from-red-900 to-black px-10 py-4 font-[Cinzel,serif] text-lg tracking-[0.2em] text-red-100 transition hover:scale-105 hover:border-red-400"
            >
              RELOAD LAST SAVE
            </button>
            <button
              onClick={() => setSlotMenu('load')}
              className="rounded-lg border border-white/15 bg-white/5 px-8 py-4 font-[Cinzel,serif] text-lg tracking-[0.2em] text-white/70 transition hover:scale-105 hover:bg-white/10"
            >
              LOAD…
            </button>
            <button
              onClick={() => setPhase('menu')}
              className="rounded-lg border border-white/15 bg-white/5 px-8 py-4 font-[Cinzel,serif] text-lg tracking-[0.2em] text-white/70 transition hover:scale-105 hover:bg-white/10"
            >
              MAIN MENU
            </button>
          </div>
          <p className="mt-4 font-[Crimson_Pro,serif] text-xs text-white/35">Reloading restores the world as of your last save — the dead you killed since will be back.</p>
        </div>
      )}

      {slotMenu && (
        <SlotMenu
          mode={slotMenu}
          current={G.slot}
          onClose={() => setSlotMenu(null)}
          onPick={(slot) => (slotMenu === 'new' ? newGame(slot) : slotMenu === 'load' ? loadGame(slot) : saveGame(slot))}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-[70] -translate-x-1/2 rounded-lg border border-emerald-300/40 bg-black/70 px-5 py-2 font-[Cinzel,serif] text-sm tracking-[0.3em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,.3)] backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
}
