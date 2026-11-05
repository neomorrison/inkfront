// Procedural SFX library, part 2: one sound per spell id and the Captain's abilities.
import { Audio, SFX } from './audio.js';

const R = (a, b) => a + Math.random() * (b - a);
const P = (o) => o.pitch || 1;
const D = (A, o, wet = 0) => A.out({ pan: o.pan, vol: o.vol, wet });

// Pencil-stroke scribble used by several spells.
function scribble(A, at, d, n, span, vol, lo = 2200, hi = 5200) {
  for (let i = 0; i < n; i++) A.noise(at + (i / n) * span, { dur: 0.04, vol, f: R(lo, hi), q: 5, attack: 0.002, dest: d });
}

// A cheap shout: a saw through two vowel-ish bandpass filters.
function shout(A, at, d, f0, vol, dur, v1 = [700, 1200], v2 = [500, 1500]) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, at);
  o.frequency.linearRampToValueAtTime(f0 * 1.25, at + dur * 0.4);
  o.frequency.linearRampToValueAtTime(f0 * 1.05, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  for (let i = 0; i < 2; i++) {
    const b = ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.Q.value = 4;
    b.frequency.setValueAtTime(v1[i], at);
    b.frequency.linearRampToValueAtTime(v2[i], at + dur);
    o.connect(b);
    b.connect(g);
  }
  g.connect(d);
  o.start(at);
  o.stop(at + dur + 0.05);
  A._count(o);
}

// ------------------------------------------------------------------------------------ spells

SFX.spell_pencil_rain = (A, at, o) => {
  const d = D(A, o, 0.12), p = P(o);
  for (let i = 0; i < 7; i++) {
    const t = at + i * 0.07 + R(0, 0.05);
    A.tone(t, { type: 'sine', f: R(2200, 3200) * p, f2: 800, dur: 0.22, vol: 0.05, dest: d });
    A.tone(t + 0.24, { type: 'triangle', f: R(200, 260) * p, f2: 100, dur: 0.07, vol: 0.2, dest: d });
    A.noise(t + 0.24, { dur: 0.04, vol: 0.1, type: 'lowpass', f: 900, dest: d });
  }
};

SFX.spell_coffee_spill = (A, at, o) => {
  const d = D(A, o, 0.15), p = P(o);
  A.noise(at, { dur: 0.4, vol: 0.28, f: 1500, f2: 600, q: 0.8, attack: 0.01, dest: d });
  for (let i = 0; i < 4; i++) A.tone(at + 0.1 + i * 0.09, { type: 'sine', f: R(280, 420) * p, f2: R(600, 800) * p, dur: 0.08, vol: 0.12, dest: d });
  A.noise(at + 0.15, { dur: 0.9, vol: 0.09, type: 'highpass', f: 5000, hold: 0.3, trem: [30, 0.8], dest: d });
};

SFX.spell_ruler_smash = (A, at, o) => {
  const d = D(A, o, 0.12), p = P(o);
  A.noise(at, { dur: 0.16, vol: 0.2, f: 500, f2: 2500, attack: 0.1, dest: d });
  const w = at + 0.15;
  A.noise(w, { dur: 0.05, vol: 0.32, f: 2200, q: 1.2, dest: d });
  A.tone(w, { type: 'sine', f: 190 * p, f2: 65, dur: 0.16, vol: 0.45, dest: d });
  A.tone(w, { type: 'triangle', f: 520 * p, f2: 470 * p, dur: 0.55, vol: 0.1, vib: [24, 45], lp: 2000, dest: d });
  A.duck(0.3, 0.1, 0.5);
};

SFX.spell_paper_planes = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  for (let i = 0; i < 3; i++) {
    A.noise(at + i * 0.15, { dur: 0.55, vol: 0.1, type: 'bandpass', f: 1500 * p, f2: 3600, q: 0.8, attack: 0.22, dest: d });
    A.noise(at + i * 0.15 + 0.1, { dur: 0.1, vol: 0.05, type: 'highpass', f: 5000, dest: d });
  }
  A.tone(at + 0.4, { type: 'sine', f: 1800 * p, f2: 500, dur: 0.6, vol: 0.04, dest: d });
  A.tone(at + 0.55, { type: 'sine', f: 1500 * p, f2: 420, dur: 0.6, vol: 0.04, dest: d });
};

SFX.spell_sticky_wall = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.noise(at, { dur: 0.13, vol: 0.32, type: 'lowpass', f: 1300, f2: 300, dest: d });
  A.tone(at, { type: 'sine', f: 210 * p, f2: 90, dur: 0.22, vol: 0.3, vib: [30, 280], dest: d });
  A.tone(at + 0.1, { type: 'sine', f: 600 * p, f2: 250, dur: 0.26, vol: 0.07, lin: true, dest: d });
};

SFX.spell_stapler = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.noise(at, { dur: 0.025, vol: 0.28, type: 'highpass', f: 3000, dest: d });
  A.tone(at, { type: 'square', f: 1800 * p, f2: 900, dur: 0.035, vol: 0.07, lp: 4000, dest: d });
  const c = at + 0.055;
  A.tone(c, { type: 'sine', f: 135 * p, f2: 58, dur: 0.14, vol: 0.5, dest: d });
  A.noise(c, { dur: 0.07, vol: 0.28, f: 1000, q: 0.9, dest: d });
  A.bell(c, 3200 * p, { dur: 0.15, vol: 0.05, dest: d });
};

SFX.spell_highlighter = (A, at, o) => {
  const d = D(A, o, 0.2), p = P(o);
  A.tone(at, { type: 'sine', f: 1800 * p, f2: 2600 * p, dur: 0.25, vol: 0.09, vib: [14, 60], dest: d });
  A.tone(at + 0.12, { type: 'sine', f: 2000 * p, f2: 1500 * p, dur: 0.2, vol: 0.07, dest: d });
  A.noise(at, { dur: 0.32, vol: 0.06, f: 3500, q: 3, trem: [20, 0.8], dest: d });
  A.bell(at + 0.25, 1568 * p, { dur: 0.5, vol: 0.09, dest: d });
};

SFX.spell_doodle_drop = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  scribble(A, at, d, 10, 0.5, 0.1);
  A.tone(at + 0.2, { type: 'sine', f: 900 * p, f2: 150, dur: 0.35, vol: 0.12, dest: d });
  const t = at + 0.55;
  A.tone(t, { type: 'sine', f: 110 * p, f2: 44, dur: 0.26, vol: 0.52, dest: d });
  A.noise(t, { dur: 0.22, vol: 0.3, type: 'lowpass', f: 650, dest: d });
  A.duck(0.3, 0.1, 0.5);
};

SFX.spell_eraser = (A, at, o) => {
  const d = D(A, o, 0.1);
  A.noise(at, { dur: 0.95, vol: 0.28, f: 1500, f2: 2400, q: 2.5, attack: 0.05, hold: 0.5, trem: [11, 0.9], dest: d });
  A.noise(at, { dur: 0.9, vol: 0.07, type: 'highpass', f: 5000, hold: 0.5, trem: [11, 0.9], dest: d });
  A.noise(at, { dur: 0.9, vol: 0.2, type: 'lowpass', f: 400, color: 'brown', hold: 0.4, trem: [11, 0.9], dest: d });
  A.tone(at + 0.9, { type: 'sine', f: 140, f2: 80, dur: 0.1, vol: 0.12, dest: d });
};

// ------------------------------------------------------------------------------ hero abilities

SFX.ability_rally = (A, at, o) => {
  const d = D(A, o, 0.28), p = P(o);
  A.brass(at, 262 * p, { dur: 0.5, vol: 0.14, dest: d });
  A.brass(at + 0.16, 392 * p, { dur: 0.75, vol: 0.14, bright: 1.3, dest: d });
  shout(A, at + 0.05, d, 150 * p, 0.2, 0.4);
  A.tone(at, { type: 'sine', f: 100, f2: 62, dur: 0.25, vol: 0.3, dest: d });
  A.duck(0.3, 0.3, 0.8);
};

SFX.ability_slam = (A, at, o) => {
  const d = D(A, o, 0.15), p = P(o);
  A.noise(at, { dur: 0.26, vol: 0.2, f: 400, f2: 2000, attack: 0.12, dest: d });
  const t = at + 0.22;
  A.tone(t, { type: 'sine', f: 100 * p, f2: 33, dur: 0.55, vol: 0.55, dest: d });
  A.noise(t, { dur: 0.5, vol: 0.4, type: 'lowpass', f: 550, color: 'brown', dest: d });
  A.noise(t, { dur: 0.08, vol: 0.28, type: 'highpass', f: 1800, dest: d });
  A.duck(0.4, 0.4, 0.8);
};

SFX.ability_inkstorm = (A, at, o) => {
  const d = D(A, o, 0.15), p = P(o);
  A.noise(at, { dur: 1.9, vol: 0.16, f: 900 * p, f2: 1500, q: 2, attack: 0.45, hold: 0.7, trem: [8, 0.7], dest: d });
  A.tone(at, { type: 'sine', f: 150 * p, f2: 320 * p, dur: 1.7, vol: 0.1, attack: 0.4, vib: [8, 200], lin: true, dest: d });
  for (let i = 0; i < 8; i++) {
    const t = at + 0.3 + i * 0.2;
    A.bell(t, R(2400, 3400) * p, { dur: 0.1, vol: 0.04, dest: d });
    A.noise(t, { dur: 0.1, vol: 0.06, type: 'highpass', f: 4000, dest: d });
  }
  A.duck(0.35, 1.0, 1.0);
};

Object.assign(Audio.limits, {
  spell_pencil_rain: 0.3, spell_coffee_spill: 0.3, spell_ruler_smash: 0.3, spell_paper_planes: 0.3, spell_sticky_wall: 0.3,
  spell_stapler: 0.3, spell_highlighter: 0.3, spell_doodle_drop: 0.3, spell_eraser: 0.3,
  ability_rally: 0.5, ability_slam: 0.4, ability_inkstorm: 1,
});
for (const k of Object.keys(SFX)) if (k.startsWith('spell_') || k.startsWith('ability_')) { Audio.prio.add(k); Audio.vary[k] = 0.03; }
