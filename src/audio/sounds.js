// Procedural SFX library, part 1: UI and battle sounds. Part 2 (spells, hero, stingers) is sounds_spells.js.
// Recipe signature: SFX[name] = (A, at, o) with o = { vol, pitch, pan }. Pitch already has a small random
// spread from Audio.play. Each recipe also varies timbre a little so repeats do not sound identical.
import { Audio, SFX } from './audio.js';
import './sounds_spells.js';

const R = (a, b) => a + Math.random() * (b - a);
const P = (o) => o.pitch || 1;
// Output bus for a recipe: carries the overall volume, pan and a reverb send.
const D = (A, o, wet = 0, gain = 1) => A.out({ pan: o.pan, vol: o.vol * gain, wet });

// ---------------------------------------------------------------------------------------- UI

SFX.click = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'triangle', f: 900 * p, f2: 560 * p, dur: 0.055, vol: 0.2, dest: d });
  A.noise(at, { dur: 0.02, vol: 0.07, type: 'highpass', f: 4200, dest: d });
};

SFX.tab = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'sine', f: 560 * p, f2: 420 * p, dur: 0.05, vol: 0.22, dest: d });
  A.tone(at + 0.05, { type: 'sine', f: 760 * p, f2: 600 * p, dur: 0.06, vol: 0.18, dest: d });
};

SFX.buy = (A, at, o) => {
  const d = D(A, o, 0.15), p = P(o);
  A.noise(at, { dur: 0.03, vol: 0.12, type: 'highpass', f: 5000, dest: d });
  A.bell(at, 1318 * p, { dur: 0.22, vol: 0.13, dest: d });
  A.bell(at + 0.07, 1760 * p, { dur: 0.3, vol: 0.13, dest: d });
  A.bell(at + 0.14, 2349 * p, { dur: 0.4, vol: 0.09, dest: d });
  A.tone(at, { type: 'sine', f: 200, f2: 120, dur: 0.1, vol: 0.2, dest: d });
};

SFX.error = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'square', f: 210 * p, f2: 170 * p, dur: 0.12, vol: 0.14, lp: 700, dest: d });
  A.tone(at + 0.11, { type: 'square', f: 160 * p, f2: 120 * p, dur: 0.16, vol: 0.14, lp: 600, dest: d });
};

SFX.stamp = (A, at, o) => {
  const d = D(A, o, 0.08), p = P(o);
  A.tone(at, { type: 'sine', f: 160 * p, f2: 45, dur: 0.2, vol: 0.5, dest: d });
  A.noise(at, { dur: 0.09, vol: 0.3, type: 'lowpass', f: 1000, f2: 300, dest: d });
  A.noise(at, { dur: 0.05, vol: 0.16, type: 'highpass', f: 3000, dest: d });
  A.noise(at + 0.05, { dur: 0.14, vol: 0.08, f: 500, q: 0.7, dest: d }); // ink squish
};

SFX.star = (A, at, o) => {
  const d = D(A, o, 0.3), p = P(o);
  A.bell(at, 1568 * p, { dur: 0.5, vol: 0.14, dest: d });
  A.bell(at + 0.08, 2093 * p, { dur: 0.6, vol: 0.12, dest: d });
  A.noise(at, { dur: 0.25, vol: 0.05, type: 'highpass', f: 8000, dest: d });
};

SFX.levelup = (A, at, o) => {
  const d = D(A, o, 0.3), p = P(o);
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => {
    A.tone(at + i * 0.075, { type: 'triangle', f: f * p, dur: 0.25, vol: 0.16, dest: d });
    A.bell(at + i * 0.075, f * 2 * p, { dur: 0.35, vol: 0.05, dest: d });
  });
  A.tone(at, { type: 'sine', f: 130, f2: 260, dur: 0.5, vol: 0.18, dest: d });
  A.bell(at + 0.4, 2093 * p, { dur: 0.9, vol: 0.12, dest: d });
};

SFX.unlock = (A, at, o) => {
  const d = D(A, o, 0.25), p = P(o);
  A.noise(at, { dur: 0.025, vol: 0.2, type: 'highpass', f: 3500, dest: d });
  A.tone(at, { type: 'square', f: 320, f2: 200, dur: 0.05, vol: 0.1, lp: 1500, dest: d });
  A.tone(at + 0.07, { type: 'sine', f: 140, f2: 70, dur: 0.1, vol: 0.3, dest: d });
  A.bell(at + 0.16, 1568 * p, { dur: 0.4, vol: 0.14, dest: d });
  A.bell(at + 0.24, 2093 * p, { dur: 0.6, vol: 0.14, dest: d });
};

SFX.crate = (A, at, o) => {
  const d = D(A, o, 0.25), p = P(o);
  for (let i = 0; i < 4; i++) A.noise(at + i * 0.07, { dur: 0.05, vol: 0.14, f: R(1200, 2200), q: 2, dest: d });
  A.tone(at + 0.3, { type: 'sine', f: 300 * p, f2: 900 * p, dur: 0.1, vol: 0.22, dest: d });
  [1568, 1976, 2349, 3136].forEach((f, i) => A.bell(at + 0.36 + i * 0.06, f * p, { dur: 0.5, vol: 0.09, dest: d }));
};

SFX.page = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.noise(at, { dur: 0.2, vol: 0.12, f: 1600 * p, f2: 5200, q: 0.9, attack: 0.04, dest: d });
  A.noise(at + 0.14, { dur: 0.12, vol: 0.07, type: 'highpass', f: 4200, dest: d });
  A.tone(at + 0.17, { type: 'sine', f: 140, f2: 90, dur: 0.07, vol: 0.12, dest: d });
};

SFX.toggle = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'triangle', f: 620 * p, dur: 0.04, vol: 0.18, dest: d });
  A.tone(at + 0.04, { type: 'triangle', f: 930 * p, dur: 0.05, vol: 0.16, dest: d });
};

SFX.whoosh = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  A.noise(at, { dur: 0.42, vol: 0.24, f: 300 * p, f2: 2800, q: 1.1, attack: 0.14, dest: d });
  A.noise(at + 0.05, { dur: 0.3, vol: 0.08, type: 'highpass', f: 2500, dest: d });
};

// ------------------------------------------------------------------------------------ battle

// Pencil scribble: a few quick strokes that climb in pitch.
function scribble(A, at, d, n, span, vol, lo = 2200, hi = 4800) {
  for (let i = 0; i < n; i++) {
    const t = at + (i / n) * span;
    A.noise(t, { dur: 0.035, vol, f: R(lo, hi), q: 5, attack: 0.002, dest: d });
  }
}

SFX.queue = (A, at, o) => {
  const d = D(A, o), p = P(o);
  scribble(A, at, d, 4, 0.13, 0.1);
  A.tone(at + 0.14, { type: 'triangle', f: 700 * p, f2: 900 * p, dur: 0.05, vol: 0.14, dest: d });
};

SFX.denied = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'square', f: 190 * p, f2: 150 * p, dur: 0.13, vol: 0.13, lp: 650, dest: d });
  A.tone(at + 0.1, { type: 'square', f: 150 * p, f2: 110 * p, dur: 0.15, vol: 0.12, lp: 550, dest: d });
};

SFX.spawn = (A, at, o) => {
  const d = D(A, o), p = P(o);
  scribble(A, at, d, 7, 0.24, 0.1, 2000, 5200);
  A.noise(at + 0.24, { dur: 0.1, vol: 0.14, f: 700, q: 0.8, dest: d });
  A.tone(at + 0.24, { type: 'sine', f: 380 * p, f2: 720 * p, dur: 0.09, vol: 0.14, dest: d });
};

SFX.stance_defend = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'triangle', f: 160 * p, f2: 105 * p, dur: 0.13, vol: 0.34, dest: d });
  A.tone(at + 0.11, { type: 'triangle', f: 130 * p, f2: 85 * p, dur: 0.18, vol: 0.34, dest: d });
  A.noise(at + 0.11, { dur: 0.07, vol: 0.1, type: 'lowpass', f: 1500, dest: d });
};

SFX.stance_hold = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'triangle', f: 340 * p, f2: 300 * p, dur: 0.11, vol: 0.26, dest: d });
  A.noise(at, { dur: 0.025, vol: 0.12, type: 'highpass', f: 3000, dest: d });
  A.bell(at + 0.02, 680 * p, { dur: 0.2, vol: 0.05, dest: d });
};

SFX.stance_charge = (A, at, o) => {
  const d = D(A, o, 0.3), p = P(o);
  A.tone(at, { type: 'sine', f: 90, f2: 55, dur: 0.25, vol: 0.4, dest: d });
  A.brass(at, 196 * p, { dur: 0.38, vol: 0.15, attack: 0.05, dest: d });
  A.brass(at + 0.3, 294 * p, { dur: 0.7, vol: 0.16, attack: 0.05, bright: 1.3, dest: d });
  A.brass(at + 0.3, 392 * p, { dur: 0.7, vol: 0.07, attack: 0.06, dest: d });
};

// Hit variants by damage kind and weapon.
SFX.hit_melee = (A, at, o) => {
  const d = D(A, o, 0, 1.5), p = P(o);
  const j = R(0.9, 1.15);
  A.tone(at, { type: 'sine', f: 1900 * p * j, dur: 0.09, vol: 0.1, dest: d });
  A.tone(at, { type: 'sine', f: 2750 * p * j, dur: 0.06, vol: 0.08, dest: d });
  A.noise(at, { dur: 0.05, vol: 0.2, f: R(2000, 3000), q: 1.4, dest: d });
  A.tone(at, { type: 'sine', f: 170 * p, f2: 80, dur: 0.09, vol: 0.3, dest: d });
};

SFX.hit_thud = (A, at, o) => {
  const d = D(A, o, 0, 1.5), p = P(o);
  A.tone(at, { type: 'sine', f: 150 * p, f2: 55, dur: 0.13, vol: 0.42, dest: d });
  A.noise(at, { dur: 0.06, vol: 0.25, type: 'lowpass', f: R(600, 900), dest: d });
};

SFX.hit_pierce = (A, at, o) => {
  const d = D(A, o, 0, 1.5), p = P(o);
  A.noise(at, { dur: 0.06, vol: 0.3, type: 'lowpass', f: 1000 * p, f2: 300, dest: d });
  A.tone(at, { type: 'sine', f: 270 * p, f2: 120, dur: 0.09, vol: 0.25, dest: d });
  A.tone(at, { type: 'triangle', f: 1400 * p, dur: 0.02, vol: 0.07, dest: d });
};

SFX.hit_blast = (A, at, o) => {
  const d = D(A, o, 0, 1.4), p = P(o);
  A.tone(at, { type: 'sine', f: 120 * p, f2: 40, dur: 0.24, vol: 0.45, dest: d });
  A.noise(at, { dur: 0.2, vol: 0.3, type: 'lowpass', f: 1500, f2: 200, dest: d });
};

SFX.hit_magic = (A, at, o) => {
  const d = D(A, o, 0.1, 1.5), p = P(o);
  A.tone(at, { type: 'sawtooth', f: 1400 * p, f2: 250, dur: 0.14, vol: 0.1, lp: 3000, dest: d });
  A.tone(at, { type: 'sine', f: 820 * p, f2: 400, dur: 0.1, vol: 0.14, dest: d });
  A.noise(at, { dur: 0.06, vol: 0.1, type: 'highpass', f: 3200, dest: d });
};

SFX.hit_crit = (A, at, o) => {
  const d = D(A, o, 0.15), p = P(o);
  A.bell(at, 2200 * p, { dur: 0.3, vol: 0.12, dest: d });
  A.tone(at, { type: 'sine', f: 120, f2: 45, dur: 0.16, vol: 0.4, dest: d });
  A.noise(at, { dur: 0.04, vol: 0.2, type: 'highpass', f: 2500, dest: d });
};

SFX.hit = (A, at, o) => (Math.random() < 0.55 ? SFX.hit_melee : SFX.hit_thud)(A, at, o);

SFX.sword_swing = (A, at, o) => {
  const d = D(A, o, 0, 1.4), p = P(o);
  A.noise(at, { dur: 0.14, vol: 0.17, f: 1200 * p, f2: 3600, q: 1.4, attack: 0.05, dest: d });
};

SFX.shoot = (A, at, o) => {
  const d = D(A, o, 0, 1.6), p = P(o);
  A.tone(at, { type: 'triangle', f: 310 * p, f2: 190 * p, dur: 0.2, vol: 0.22, vib: [38, 35], lp: 1600, dest: d });
  A.noise(at, { dur: 0.1, vol: 0.09, type: 'highpass', f: 2600, f2: 1000, dest: d });
};

SFX.sling = (A, at, o) => {
  const d = D(A, o, 0, 1.4), p = P(o);
  A.noise(at, { dur: 0.26, vol: 0.12, f: 400 * p, f2: 1800, q: 1.5, attack: 0.16, trem: [14, 0.6], dest: d });
  A.noise(at + 0.25, { dur: 0.06, vol: 0.12, type: 'highpass', f: 3200, dest: d });
};

SFX.throw = (A, at, o) => {
  const d = D(A, o, 0, 1.3), p = P(o);
  A.noise(at, { dur: 0.17, vol: 0.17, type: 'lowpass', f: 500 * p, f2: 1900, attack: 0.07, dest: d });
};

SFX.bolt = (A, at, o) => {
  const d = D(A, o, 0.1, 1.4), p = P(o);
  A.tone(at, { type: 'sawtooth', f: 1200 * p, f2: 180, dur: 0.17, vol: 0.12, lp: 2600, dest: d });
  A.tone(at, { type: 'square', f: 90, dur: 0.15, vol: 0.05, lp: 400, dest: d });
  A.noise(at, { dur: 0.1, vol: 0.08, type: 'highpass', f: 4000, dest: d });
};

SFX.boulder = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  A.tone(at, { type: 'sawtooth', f: 62 * p, f2: 92 * p, dur: 0.55, vol: 0.16, lp: 380, vib: [9, 60], dest: d });
  A.tone(at, { type: 'sawtooth', f: 65 * p, f2: 88 * p, dur: 0.55, vol: 0.1, lp: 350, dest: d });
  A.noise(at + 0.1, { dur: 0.5, vol: 0.28, type: 'lowpass', f: 300, f2: 1000, color: 'brown', attack: 0.22, dest: d });
};

SFX.impact_ground = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'sine', f: 105 * p, f2: 42, dur: 0.24, vol: 0.5, dest: d });
  A.noise(at, { dur: 0.28, vol: 0.28, type: 'lowpass', f: 650, color: 'brown', dest: d });
};

SFX.boom = (A, at, o) => {
  const d = D(A, o, 0.2), p = P(o);
  A.noise(at, { dur: 0.9, vol: 0.4, type: 'lowpass', f: 3200, f2: 90, dest: d });
  A.noise(at, { dur: 1.1, vol: 0.32, type: 'lowpass', f: 420, color: 'brown', dest: d });
  A.tone(at, { type: 'sine', f: 95 * p, f2: 30, dur: 0.85, vol: 0.45, dest: d });
  A.noise(at, { dur: 0.05, vol: 0.22, type: 'highpass', f: 1500, dest: d });
  A.duck(0.45, 0.2, 1.0);
};

SFX.death = (A, at, o) => {
  const d = D(A, o, 0, 1.8), p = P(o);
  const v = Math.floor(Math.random() * 3);
  if (v === 0) { // pop
    A.tone(at, { type: 'sine', f: 720 * p, f2: 180, dur: 0.14, vol: 0.24, dest: d });
    A.noise(at, { dur: 0.05, vol: 0.1, f: 1500, dest: d });
  } else if (v === 1) { // boing
    A.tone(at, { type: 'sine', f: 260 * p, f2: 760 * p, dur: 0.1, vol: 0.18, lin: true, dest: d });
    A.tone(at + 0.1, { type: 'sine', f: 760 * p, f2: 200 * p, dur: 0.2, vol: 0.18, vib: [22, 80], dest: d });
  } else { // squeak and puff
    A.tone(at, { type: 'sine', f: 1500 * p, f2: 900 * p, dur: 0.1, vol: 0.09, dest: d });
    A.noise(at + 0.04, { dur: 0.18, vol: 0.18, type: 'lowpass', f: 900, f2: 300, dest: d });
  }
};

SFX.launch = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.noise(at, { dur: 0.36, vol: 0.2, f: 300, f2: 3000, q: 1, attack: 0.13, dest: d });
  A.tone(at, { type: 'sine', f: 180 * p, f2: 700 * p, dur: 0.3, vol: 0.12, dest: d });
};

SFX.land = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'sine', f: 125 * p, f2: 50, dur: 0.16, vol: 0.4, dest: d });
  A.noise(at, { dur: 0.12, vol: 0.2, type: 'lowpass', f: 550, dest: d });
};

SFX.blocked = (A, at, o) => {
  const d = D(A, o, 0, 1.4), p = P(o);
  A.tone(at, { type: 'sine', f: 2400 * p, dur: 0.09, vol: 0.12, dest: d });
  A.tone(at, { type: 'sine', f: 3600 * p, dur: 0.06, vol: 0.08, dest: d });
  A.tone(at, { type: 'triangle', f: 300 * p, f2: 240, dur: 0.06, vol: 0.12, dest: d });
  A.noise(at, { dur: 0.025, vol: 0.12, type: 'highpass', f: 5000, dest: d });
};

SFX.heal = (A, at, o) => {
  const d = D(A, o, 0.35), p = P(o);
  [784, 988, 1175].forEach((f, i) => A.bell(at + i * 0.07, f * p, { dur: 0.45, vol: 0.09, dest: d }));
  A.tone(at, { type: 'sine', f: 400 * p, f2: 600 * p, dur: 0.3, vol: 0.05, dest: d });
};

SFX.coin = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  A.bell(at, 1568 * p, { dur: 0.14, vol: 0.12, dest: d });
  A.bell(at + 0.06, 2349 * p, { dur: 0.28, vol: 0.12, dest: d });
};

SFX.gather = (A, at, o) => {
  const d = D(A, o, 0, 1.2), p = P(o);
  A.tone(at, { type: 'sine', f: 160 * p, f2: 430 * p, dur: 0.09, vol: 0.28, dest: d });
  A.tone(at + 0.1, { type: 'sine', f: 220 * p, f2: 520 * p, dur: 0.08, vol: 0.2, dest: d });
  A.noise(at, { dur: 0.15, vol: 0.05, type: 'lowpass', f: 500, dest: d });
};

SFX.fortHit = (A, at, o) => {
  const d = D(A, o), p = P(o);
  A.tone(at, { type: 'sine', f: 95 * p, f2: 45, dur: 0.24, vol: 0.5, dest: d });
  A.noise(at, { dur: 0.2, vol: 0.3, type: 'lowpass', f: 950, f2: 150, dest: d });
  A.noise(at + 0.03, { dur: 0.3, vol: 0.1, type: 'lowpass', f: 400, color: 'brown', dest: d });
};

SFX.fortDestroyed = (A, at, o) => {
  const d = D(A, o, 0.25), p = P(o);
  A.noise(at, { dur: 1.5, vol: 0.4, type: 'lowpass', f: 900, f2: 80, color: 'brown', hold: 0.3, dest: d });
  for (let i = 0; i < 6; i++) {
    A.noise(at + i * 0.12 + R(0, 0.05), { dur: 0.16, vol: 0.2, f: R(500, 3000), q: 1.2, dest: d });
    A.tone(at + i * 0.12, { type: 'sine', f: R(90, 140) * p, f2: 40, dur: 0.2, vol: 0.2, dest: d });
  }
  A.tone(at, { type: 'sine', f: 75 * p, f2: 28, dur: 1.3, vol: 0.42, dest: d });
  A.noise(at, { dur: 0.06, vol: 0.2, type: 'highpass', f: 1800, dest: d });
  A.duck(0.55, 0.3, 1.4);
};

SFX.gallop = (A, at, o) => {
  const d = D(A, o, 0, 1.3), p = P(o);
  [0, 0.11, 0.2, 0.31].forEach((t, i) => {
    const w = i % 2 ? 0.85 : 1;
    A.noise(at + t, { dur: 0.045, vol: 0.18 * w, f: R(900, 1300), q: 3, dest: d });
    A.tone(at + t, { type: 'sine', f: 230 * p, f2: 130, dur: 0.06, vol: 0.2 * w, dest: d });
  });
};

SFX.poof = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  A.noise(at, { dur: 0.32, vol: 0.28, f: 900, f2: 250, q: 0.8, attack: 0.012, dest: d });
  A.tone(at, { type: 'sine', f: 520 * p, f2: 200, dur: 0.1, vol: 0.1, dest: d });
  A.noise(at + 0.03, { dur: 0.2, vol: 0.05, type: 'highpass', f: 6000, dest: d });
};

SFX.chain = (A, at, o) => {
  const d = D(A, o, 0.1), p = P(o);
  for (let i = 0; i < 9; i++) {
    const t = at + i * R(0.02, 0.032);
    A.tone(t, { type: 'square', f: R(500, 2600) * p, dur: 0.03, vol: 0.05, lp: 4000, dest: d });
    if (i % 2 === 0) A.noise(t, { dur: 0.025, vol: 0.06, type: 'highpass', f: 4500, dest: d });
  }
  A.tone(at, { type: 'sawtooth', f: 900 * p, f2: 200, dur: 0.25, vol: 0.05, lp: 2500, dest: d });
};

SFX.summon = (A, at, o) => {
  const d = D(A, o, 0.35), p = P(o);
  A.tone(at, { type: 'sine', f: 220 * p, f2: 440 * p, dur: 0.6, vol: 0.12, attack: 0.15, dest: d });
  A.tone(at, { type: 'sine', f: 223 * p, f2: 449 * p, dur: 0.6, vol: 0.1, attack: 0.15, dest: d });
  A.noise(at, { dur: 0.5, vol: 0.06, type: 'highpass', f: 3000, f2: 7000, attack: 0.2, dest: d });
  A.bell(at + 0.4, 880 * p, { dur: 0.5, vol: 0.08, dest: d });
};

SFX.immune = (A, at, o) => SFX.blocked(A, at, o);

SFX.victory = (A, at, o) => {
  const d = D(A, o, 0.3), p = P(o);
  const n = (f, t, dur, v = 0.14) => A.brass(at + t, f * p, { dur, vol: v, attack: 0.025, bright: 1.2, dest: d });
  n(392, 0, 0.16); n(392, 0.18, 0.16); n(392, 0.36, 0.16);
  n(523, 0.54, 1.1); n(659, 0.54, 1.1, 0.08); n(784, 0.54, 1.1, 0.07);
  A.tone(at, { type: 'sine', f: 110, f2: 70, dur: 0.3, vol: 0.4, dest: d });
  A.tone(at + 0.54, { type: 'sine', f: 110, f2: 65, dur: 0.5, vol: 0.4, dest: d });
  A.noise(at + 0.54, { dur: 1.3, vol: 0.1, type: 'highpass', f: 6000, hold: 0.1, dest: d });
  A.bell(at + 0.7, 2093 * p, { dur: 0.9, vol: 0.08, dest: d });
  A.duck(0.5, 0.8, 1.2);
};

SFX.defeat = (A, at, o) => {
  const d = D(A, o, 0.35), p = P(o);
  const n = (f, t, dur, g) => A.brass(at + t, f * p, { dur, vol: 0.13, attack: 0.07, bright: 0.55, glide: g, dest: d });
  n(311, 0, 0.45, 0.96); n(294, 0.5, 0.45, 0.96); n(277, 1.0, 0.45, 0.96); n(247, 1.5, 1.2, 0.84);
  A.tone(at + 1.5, { type: 'sine', f: 82, f2: 55, dur: 1.2, vol: 0.3, dest: d });
  A.duck(0.5, 1.2, 1.3);
};

SFX.boss_arrive = (A, at, o) => {
  const d = D(A, o, 0.3), p = P(o);
  A.tone(at, { type: 'sine', f: 58 * p, f2: 38, dur: 2.2, vol: 0.4, attack: 0.3, dest: d });
  A.noise(at, { dur: 1.6, vol: 0.3, type: 'lowpass', f: 180, f2: 650, color: 'brown', attack: 0.9, dest: d });
  [0, 0.2, 0.35, 0.46, 0.55, 0.62].forEach((t) => A.tone(at + t, { type: 'sine', f: 95, f2: 52, dur: 0.25, vol: 0.3, dest: d }));
  A.brass(at + 0.7, 131 * p, { dur: 1.3, vol: 0.13, attack: 0.08, bright: 1.4, dest: d });
  A.brass(at + 0.7, 185 * p, { dur: 1.3, vol: 0.1, attack: 0.08, bright: 1.4, dest: d });
  A.noise(at + 0.7, { dur: 1.6, vol: 0.14, type: 'highpass', f: 5000, hold: 0.2, dest: d });
  A.duck(0.6, 0.8, 2.0);
};

SFX.boss_down = (A, at, o) => {
  const d = D(A, o, 0.35), p = P(o);
  A.tone(at, { type: 'sine', f: 90, f2: 28, dur: 1.2, vol: 0.45, dest: d });
  A.noise(at, { dur: 1.2, vol: 0.3, type: 'lowpass', f: 2000, f2: 100, dest: d });
  [440, 392, 330, 262].forEach((f, i) => A.brass(at + 0.3 + i * 0.22, f * p, { dur: 0.5, vol: 0.1, bright: 0.8, dest: d }));
  A.duck(0.5, 0.6, 1.4);
};

SFX.telegraph = (A, at, o) => {
  const d = D(A, o), p = P(o);
  [0, 0.15, 0.3].forEach((t, i) => A.tone(at + t, { type: 'triangle', f: (i % 2 ? 520 : 700) * p, dur: 0.11, vol: 0.12, lp: 2200, dest: d }));
};

SFX.wave_start = (A, at, o) => {
  const d = D(A, o, 0.25), p = P(o);
  for (let i = 0; i < 6; i++) A.noise(at + i * 0.05, { dur: 0.06, vol: 0.12, f: 1800, q: 1.5, dest: d });
  A.tone(at, { type: 'sine', f: 100, f2: 60, dur: 0.3, vol: 0.3, dest: d });
  A.brass(at + 0.3, 262 * p, { dur: 0.35, vol: 0.12, dest: d });
  A.brass(at + 0.3, 392 * p, { dur: 0.6, vol: 0.1, dest: d });
};

SFX.draft_offer = (A, at, o) => {
  const d = D(A, o, 0.35), p = P(o);
  [784, 988, 1175, 1568].forEach((f, i) => A.bell(at + i * 0.08, f * p, { dur: 0.5, vol: 0.1, dest: d }));
  A.noise(at, { dur: 0.4, vol: 0.04, type: 'highpass', f: 7000, attack: 0.1, dest: d });
};

SFX.spell_cast = (A, at, o) => {
  const d = D(A, o, 0.2), p = P(o);
  A.tone(at, { type: 'sine', f: 300 * p, f2: 900 * p, dur: 0.22, vol: 0.14, dest: d });
  A.noise(at, { dur: 0.2, vol: 0.1, f: 800, f2: 4000, attack: 0.08, dest: d });
};

SFX.sizzle = (A, at, o) => {
  A.noise(at, { dur: 0.5, vol: 0.06, type: 'highpass', f: 5500, trem: [28, 0.8], dest: D(A, o) });
};

// -------------------------------------------------------------------------------- tuning data

Object.assign(Audio.limits, {
  click: 0.03, tab: 0.05, toggle: 0.05, star: 0.07, coin: 0.06, buy: 0.1,
  queue: 0.05, spawn: 0.07, denied: 0.15, stance_defend: 0.2, stance_hold: 0.2, stance_charge: 0.4,
  hit: 0.04, hit_melee: 0.045, hit_thud: 0.045, hit_pierce: 0.04, hit_blast: 0.08, hit_magic: 0.05, hit_crit: 0.12,
  sword_swing: 0.07, shoot: 0.05, sling: 0.09, throw: 0.09, bolt: 0.06, boulder: 0.3, impact_ground: 0.1,
  boom: 0.09, death: 0.045, launch: 0.15, land: 0.12, blocked: 0.07, heal: 0.15, gather: 0.1, fortHit: 0.12,
  fortDestroyed: 0.6, gallop: 0.4, poof: 0.1, chain: 0.12, summon: 0.2, victory: 1, defeat: 1, boss_arrive: 2,
  boss_down: 2, telegraph: 0.5, wave_start: 1, draft_offer: 1, spell_cast: 0.2, sizzle: 0.3, immune: 0.15,
});
Object.assign(Audio.poly, { hit: 4, hit_melee: 3, hit_thud: 3, hit_pierce: 3, hit_magic: 3, hit_blast: 2, death: 4, shoot: 4, boom: 3, coin: 3, spawn: 3, gather: 2 });
Object.assign(Audio.vary, { click: 0.04, star: 0.0, levelup: 0.0, victory: 0.0, defeat: 0.0, boss_arrive: 0.02, hit: 0.12, hit_melee: 0.12, hit_thud: 0.12, death: 0.14, shoot: 0.1 });
for (const n of ['boom', 'fortDestroyed', 'victory', 'defeat', 'boss_arrive', 'boss_down', 'stance_charge', 'levelup', 'wave_start', 'telegraph', 'error', 'denied', 'click', 'buy', 'tab', 'stamp', 'star', 'unlock', 'crate', 'page', 'toggle', 'whoosh', 'queue']) Audio.prio.add(n);
