/* Layered procedural gun / world audio built on Web Audio.
   Each gunshot = sharp high-frequency transient + band-limited body +
   low-end thump + convolution reverb tail, tuned per weapon. */

let C: AudioContext | null = null;
let master: GainNode;
let revSend: GainNode;
let noiseBuf: AudioBuffer;
let motorLow: OscillatorNode | null = null;
let motorHigh: OscillatorNode | null = null;
let motorGainLow: GainNode | null = null;
let motorGainHigh: GainNode | null = null;
let windGain: GainNode | null = null;
const lastPlay: Record<string, number> = {};

interface GunProfile {
  vol: number; crack: number; body: number; bodyQ: number; bodyDecay: number;
  thump: number; thumpDecay: number; rev: number; minGap: number; mech?: boolean;
}

const PROFILES: Record<string, GunProfile> = {
  pistol:  { vol: 0.62, crack: 1.0, body: 950,  bodyQ: 0.8, bodyDecay: 0.10, thump: 120, thumpDecay: 0.13, rev: 0.45, minGap: 40, mech: true },
  shotgun: { vol: 1.00, crack: 1.1, body: 320,  bodyQ: 0.6, bodyDecay: 0.26, thump: 62,  thumpDecay: 0.34, rev: 0.75, minGap: 60, mech: true },
  smg:     { vol: 0.42, crack: 0.8, body: 1300, bodyQ: 0.9, bodyDecay: 0.055, thump: 150, thumpDecay: 0.06, rev: 0.28, minGap: 35 },
  ak47:    { vol: 0.72, crack: 1.0, body: 520,  bodyQ: 0.7, bodyDecay: 0.13, thump: 85,  thumpDecay: 0.16, rev: 0.55, minGap: 40 },
  m16a4:   { vol: 0.60, crack: 1.1, body: 850,  bodyQ: 0.8, bodyDecay: 0.085, thump: 125, thumpDecay: 0.10, rev: 0.48, minGap: 30 },
  m16a6:   { vol: 0.66, crack: 1.0, body: 680,  bodyQ: 0.8, bodyDecay: 0.11, thump: 100, thumpDecay: 0.13, rev: 0.52, minGap: 35 },
  minigun: { vol: 0.34, crack: 0.6, body: 720,  bodyQ: 0.9, bodyDecay: 0.045, thump: 140, thumpDecay: 0.05, rev: 0.22, minGap: 42 },
  ally:    { vol: 0.30, crack: 0.8, body: 760,  bodyQ: 0.8, bodyDecay: 0.08, thump: 110, thumpDecay: 0.1, rev: 0.5, minGap: 60 },
};

const att = (dist: number, range = 60) => Math.pow(Math.max(0, 1 - dist / range), 1.4);
const now = () => (C ? C.currentTime : 0);

export function initAudio() {
  if (C) { if (C.state === 'suspended') void C.resume(); return; }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  C = new AC();
  const sr = C.sampleRate;

  master = C.createGain();
  master.gain.value = 0.85;
  const comp = C.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 8;
  comp.attack.value = 0.002; comp.release.value = 0.22;
  master.connect(comp); comp.connect(C.destination);

  noiseBuf = C.createBuffer(1, sr * 2, sr);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const irLen = Math.floor(sr * 1.9);
  const ir = C.createBuffer(2, irLen, sr);
  for (let ch = 0; ch < 2; ch++) {
    const a = ir.getChannelData(ch);
    for (let i = 0; i < irLen; i++) {
      const t = i / irLen;
      const early = i < 400 ? i / 400 : 1;
      a[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * early * (0.6 + 0.4 * Math.sin(i * 0.001 * (ch + 1)));
    }
  }
  const conv = C.createConvolver();
  conv.buffer = ir;
  revSend = C.createGain(); revSend.gain.value = 1;
  const revOut = C.createGain(); revOut.gain.value = 0.55;
  revSend.connect(conv); conv.connect(revOut); revOut.connect(master);

  // minigun motor
  motorLow = C.createOscillator(); motorLow.type = 'sawtooth'; motorLow.frequency.value = 25;
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  motorGainLow = C.createGain(); motorGainLow.gain.value = 0;
  motorLow.connect(lp); lp.connect(motorGainLow); motorGainLow.connect(master); motorLow.start();
  motorHigh = C.createOscillator(); motorHigh.type = 'triangle'; motorHigh.frequency.value = 300;
  motorGainHigh = C.createGain(); motorGainHigh.gain.value = 0;
  motorHigh.connect(motorGainHigh); motorGainHigh.connect(master); motorHigh.start();

  // wind bed
  const wind = C.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
  const wlp = C.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 380; wlp.Q.value = 0.6;
  windGain = C.createGain(); windGain.gain.value = 0.0;
  const lfo = C.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
  const lfoG = C.createGain(); lfoG.gain.value = 160;
  lfo.connect(lfoG); lfoG.connect(wlp.frequency); lfo.start();
  wind.connect(wlp); wlp.connect(windGain); windGain.connect(master); wind.start();
}

/* ---------- building blocks ---------- */
function noiseSrc(dur: number) {
  const s = C!.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const t = now();
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.1);
  return s;
}
function env(g: GainNode, t0: number, peak: number, decay: number, attack = 0.0015) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}
function out(node: AudioNode, vol: number, rev: number) {
  const g = C!.createGain(); g.gain.value = vol;
  node.connect(g); g.connect(master);
  if (rev > 0) { const r = C!.createGain(); r.gain.value = rev; g.connect(r); r.connect(revSend); }
}
function gate(key: string, gapMs: number) {
  const t = performance.now();
  if (t - (lastPlay[key] ?? 0) < gapMs) return false;
  lastPlay[key] = t;
  return true;
}

/* ---------- guns ---------- */
export function playGun(id: string, dist = 0) {
  if (!C) return;
  const P = PROFILES[id];
  if (!P || !gate('gun_' + id, P.minGap)) return;
  const vol = P.vol * (dist > 0 ? att(dist) : 1);
  if (vol <= 0.01) return;
  const t = now();

  { // transient crack
    const s = noiseSrc(0.06);
    const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1700;
    const g = C.createGain(); env(g, t, P.crack, 0.028, 0.0008);
    s.connect(f); f.connect(g); out(g, vol, P.rev);
  }
  { // body
    const s = noiseSrc(P.bodyDecay + 0.15);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = P.bodyQ;
    f.frequency.setValueAtTime(P.body, t);
    f.frequency.exponentialRampToValueAtTime(P.body * 0.32, t + P.bodyDecay);
    const g = C.createGain(); env(g, t, 1.0, P.bodyDecay, 0.002);
    s.connect(f); f.connect(g); out(g, vol * 1.1, P.rev);
  }
  { // low-end thump
    const o = C.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(P.thump, t);
    o.frequency.exponentialRampToValueAtTime(P.thump * 0.35, t + P.thumpDecay);
    const g = C.createGain(); env(g, t, 1.0, P.thumpDecay, 0.003);
    o.connect(g); out(g, vol * 0.95, P.rev * 0.4);
    o.start(t); o.stop(t + P.thumpDecay + 0.05);
  }
  if (P.mech && dist === 0) { // slide / pump mechanical click
    const dt = id === 'shotgun' ? 0.22 : 0.055;
    const s = noiseSrc(0.05);
    const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3200;
    const g = C.createGain(); env(g, t + dt, 0.35, 0.02, 0.001);
    s.connect(f); f.connect(g); out(g, vol * 0.6, 0.1);
    if (id === 'shotgun') {
      const g2 = C.createGain(); env(g2, t + dt + 0.09, 0.3, 0.02, 0.001);
      const s2 = noiseSrc(0.05); s2.connect(f); f.connect(g2); out(g2, vol * 0.6, 0.1);
    }
  }
}

export function playRocketLaunch() {
  if (!C) return;
  const t = now();
  const s = noiseSrc(0.7);
  const f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
  f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(140, t + 0.55);
  const g = C.createGain(); env(g, t, 1.0, 0.55, 0.01);
  s.connect(f); f.connect(g); out(g, 0.8, 0.5);
  const o = C.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.3);
  const g2 = C.createGain(); env(g2, t, 1, 0.3, 0.004);
  o.connect(g2); out(g2, 0.7, 0.2); o.start(t); o.stop(t + 0.4);
}

export function playExplosion(dist = 0) {
  if (!C || !gate('boom', 50)) return;
  const vol = 1.15 * att(dist, 110);
  if (vol < 0.02) return;
  const t = now();
  { const s = noiseSrc(0.08); const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = C.createGain(); env(g, t, 1.0, 0.05, 0.001); s.connect(f); f.connect(g); out(g, vol * 0.8, 0.8); }
  { const s = noiseSrc(1.2); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(70, t + 0.9);
    const g = C.createGain(); env(g, t, 1.2, 0.95, 0.004); s.connect(f); f.connect(g); out(g, vol, 0.9); }
  { const o = C.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(18, t + 0.7);
    const g = C.createGain(); env(g, t, 1.2, 0.7, 0.004); o.connect(g); out(g, vol, 0.3); o.start(t); o.stop(t + 0.8); }
}

/* ---------- monsters ---------- */
export function playCharge(dur: number, dist = 0, big = false) {
  if (!C) return;
  const vol = (big ? 0.28 : 0.14) * att(dist, big ? 120 : 45);
  if (vol < 0.01) return;
  const t = now();
  const o = C.createOscillator(); o.type = big ? 'sawtooth' : 'sine';
  o.frequency.setValueAtTime(big ? 60 : 180, t);
  o.frequency.exponentialRampToValueAtTime(big ? 520 : 1100, t + dur);
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + dur);
  const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.1);
}

export function playLaser(dur: number, dist = 0, big = false) {
  if (!C) return;
  const vol = (big ? 0.42 : 0.2) * att(dist, big ? 140 : 50);
  if (vol < 0.01) return;
  const t = now();
  const o1 = C.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = big ? 88 : 240;
  const o2 = C.createOscillator(); o2.type = 'square'; o2.frequency.value = big ? 89.7 : 243;
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
  f.frequency.setValueAtTime(big ? 2600 : 3200, t); f.frequency.exponentialRampToValueAtTime(big ? 380 : 500, t + dur);
  const g = C.createGain(); env(g, t, vol, dur, 0.03);
  o1.connect(f); o2.connect(f); f.connect(g); out(g, 1, 0.5);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  const s = noiseSrc(dur); const nf = C.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3400; nf.Q.value = 2;
  const ng = C.createGain(); env(ng, t, vol * 0.35, dur, 0.02); s.connect(nf); nf.connect(ng); out(ng, 1, 0.3);
}

export function playGore(dist = 0) {
  if (!C || !gate('gore', 70)) return;
  const vol = 0.5 * att(dist, 50); if (vol < 0.01) return;
  const t = now();
  const s = noiseSrc(0.25); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.18);
  const g = C.createGain(); env(g, t, 1, 0.18, 0.003); s.connect(f); f.connect(g); out(g, vol, 0.3);
}

export function playGroan(dist = 0) {
  if (!C || !gate('groan', 400)) return;
  const vol = 0.22 * att(dist, 40); if (vol < 0.01) return;
  const t = now();
  const o = C.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(70 + Math.random() * 30, t); o.frequency.linearRampToValueAtTime(48, t + 0.9);
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 3;
  const g = C.createGain(); env(g, t, vol, 0.9, 0.15);
  o.connect(f); f.connect(g); out(g, 1, 0.5); o.start(t); o.stop(t + 1.1);
}

/* ---------- player / world ---------- */
export function playHurt() {
  if (!C || !gate('hurt', 220)) return;
  const t = now();
  const s = noiseSrc(0.25); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
  const g = C.createGain(); env(g, t, 1, 0.2, 0.003); s.connect(f); f.connect(g); out(g, 0.55, 0.2);
  const o = C.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  const g2 = C.createGain(); env(g2, t, 1, 0.2, 0.004); o.connect(g2); out(g2, 0.5, 0.1); o.start(t); o.stop(t + 0.3);
}

export function playStep(sprint: boolean) {
  if (!C) return;
  const t = now();
  const s = noiseSrc(0.12); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 300;
  const g = C.createGain(); env(g, t, 1, 0.07, 0.002); s.connect(f); f.connect(g); out(g, sprint ? 0.28 : 0.18, 0.08);
  const o = C.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  const g2 = C.createGain(); env(g2, t, 1, 0.08, 0.003); o.connect(g2); out(g2, sprint ? 0.22 : 0.14, 0); o.start(t); o.stop(t + 0.12);
}

export function playLand() {
  if (!C) return;
  const t = now();
  const o = C.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.18);
  const g = C.createGain(); env(g, t, 1, 0.18, 0.004); o.connect(g); out(g, 0.5, 0.1); o.start(t); o.stop(t + 0.25);
  const s = noiseSrc(0.15); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
  const g2 = C.createGain(); env(g2, t, 1, 0.1, 0.002); s.connect(f); f.connect(g2); out(g2, 0.3, 0.1);
}

export function playClick() {
  if (!C || !gate('click', 150)) return;
  const t = now();
  const s = noiseSrc(0.04); const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2800;
  const g = C.createGain(); env(g, t, 1, 0.018, 0.001); s.connect(f); f.connect(g); out(g, 0.35, 0.1);
}

export function playPickup() {
  if (!C) return;
  const t = now();
  [660, 990].forEach((fr, i) => {
    const o = C!.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const g = C!.createGain(); env(g, t + i * 0.07, 0.25, 0.14, 0.005);
    o.connect(g); out(g, 1, 0.3); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
  });
}

export function playChest() {
  if (!C) return;
  const t = now();
  // creak
  const o = C.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(170, t + 0.4);
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 5;
  const g = C.createGain(); env(g, t, 0.16, 0.42, 0.04);
  o.connect(f); f.connect(g); out(g, 1, 0.4); o.start(t); o.stop(t + 0.5);
  // latch thunk
  const o2 = C.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(160, t + 0.42); o2.frequency.exponentialRampToValueAtTime(60, t + 0.55);
  const g2 = C.createGain(); env(g2, t + 0.42, 0.6, 0.15, 0.003); o2.connect(g2); out(g2, 1, 0.3); o2.start(t + 0.42); o2.stop(t + 0.62);
  // shimmer
  [880, 1320, 1760].forEach((fr, i) => {
    const s = C!.createOscillator(); s.type = 'sine'; s.frequency.value = fr;
    const sg = C!.createGain(); env(sg, t + 0.5 + i * 0.06, 0.12, 0.35, 0.01);
    s.connect(sg); out(sg, 1, 0.6); s.start(t + 0.5 + i * 0.06); s.stop(t + 1.1 + i * 0.06);
  });
}

export function playRecruit() {
  if (!C) return;
  const t = now();
  [523, 659, 784, 1046].forEach((fr, i) => {
    const o = C!.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
    const g = C!.createGain(); env(g, t + i * 0.09, 0.22, 0.3, 0.01);
    o.connect(g); out(g, 1, 0.5); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.4);
  });
}

export function playNightBell() {
  if (!C) return;
  const t = now();
  [196, 392, 587].forEach((fr, i) => {
    const o = C!.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const g = C!.createGain(); env(g, t, 0.25 / (i + 1), 2.4, 0.01);
    o.connect(g); out(g, 1, 0.9); o.start(t); o.stop(t + 2.6);
  });
}

/* ---------- continuous ---------- */
export function updateMinigun(spin: number) {
  if (!C || !motorLow || !motorHigh || !motorGainLow || !motorGainHigh) return;
  const t = now();
  motorLow.frequency.setTargetAtTime(22 + spin * 120, t, 0.05);
  motorGainLow.gain.setTargetAtTime(spin * 0.16, t, 0.05);
  motorHigh.frequency.setTargetAtTime(260 + spin * 1100, t, 0.05);
  motorGainHigh.gain.setTargetAtTime(spin * 0.035, t, 0.05);
}

export function updateAmbience(night: number) {
  if (!C || !windGain) return;
  windGain.gain.setTargetAtTime(0.03 + night * 0.09, now(), 0.5);
}
