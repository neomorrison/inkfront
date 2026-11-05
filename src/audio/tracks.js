// Procedural music tracks for music.js. A track is { bpm, bars, floor?, once?, layers: [...] }.
// A layer is { min, vol?, play(A, t, bar, step, dest) } called once per 16th note. `min` is the combat
// intensity (0..1) at which the layer fades in; 0 means always on.
import { mtof } from './audio.js';

// ---- instruments ---------------------------------------------------------------------------------
const I = {
  pizz(A, t, m, v, d) {
    A.tone(t, { type: 'triangle', f: mtof(m), dur: 0.2, vol: v, attack: 0.002, lp: 2600, dest: d });
    A.tone(t, { type: 'sine', f: mtof(m + 12), dur: 0.07, vol: v * 0.35, attack: 0.002, dest: d });
  },
  glock(A, t, m, v, d) { A.bell(t, mtof(m), { dur: 0.4, vol: v, dest: d, bright: 0.7 }); },
  wood(A, t, v, d, hi) {
    A.tone(t, { type: 'sine', f: hi ? 1150 : 820, f2: hi ? 930 : 640, dur: 0.045, vol: v, attack: 0.001, dest: d });
  },
  bass(A, t, m, dur, v, d, saw) {
    A.tone(t, { type: saw ? 'sawtooth' : 'triangle', f: mtof(m), dur, vol: v, attack: 0.006, lp: saw ? 520 : 700, dest: d });
    A.tone(t, { type: 'sine', f: mtof(m), dur, vol: v * 0.7, attack: 0.006, dest: d });
  },
  kick(A, t, v, d) {
    A.tone(t, { type: 'sine', f: 135, f2: 42, dur: 0.2, vol: v, attack: 0.002, dest: d });
    A.noise(t, { dur: 0.02, vol: v * 0.25, type: 'lowpass', f: 1500, dest: d });
  },
  snare(A, t, v, d) {
    A.noise(t, { dur: 0.13, vol: v, f: 2300, q: 0.6, attack: 0.001, dest: d });
    A.tone(t, { type: 'triangle', f: 210, f2: 150, dur: 0.08, vol: v * 0.7, attack: 0.001, dest: d });
  },
  tom(A, t, m, v, d) {
    A.tone(t, { type: 'sine', f: mtof(m), f2: mtof(m) * 0.62, dur: 0.3, vol: v, attack: 0.002, dest: d });
    A.noise(t, { dur: 0.03, vol: v * 0.2, f: 900, dest: d });
  },
  hat(A, t, v, d) { A.noise(t, { dur: 0.035, vol: v, type: 'highpass', f: 7000, attack: 0.001, dest: d }); },
  crash(A, t, v, d) { A.noise(t, { dur: 1.6, vol: v, type: 'highpass', f: 4500, attack: 0.002, dest: d }); },
  brass(A, t, m, dur, v, d, bright = 1) { A.brass(t, mtof(m), { dur, vol: v, attack: 0.03, bright, dest: d }); },
  pad(A, t, notes, dur, v, d, lp = 1300) {
    for (const m of notes) {
      A.tone(t, { type: 'sawtooth', f: mtof(m), dur, vol: v, attack: 0.4, hold: dur * 0.3, lp: lp * 0.5, lp2: lp, detune: -6, dest: d });
      A.tone(t, { type: 'sawtooth', f: mtof(m), dur, vol: v, attack: 0.4, hold: dur * 0.3, lp: lp * 0.5, lp2: lp, detune: 6, dest: d });
    }
  },
};

const spb = (bpm) => 60 / bpm / 4;
const has = (arr, v) => arr.indexOf(v) >= 0;

// ---- menu: jaunty pizzicato march ----------------------------------------------------------------
const MENU_CH = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67], [57, 60, 64], [60, 65, 69], [59, 62, 67], [60, 64, 67]];
const MENU_ROOT = [36, 41, 43, 36, 45, 41, 43, 36];
// [step, midi, length in 16ths]
const MENU_MEL = [
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 76, 2], [8, 72, 2], [10, 76, 2], [12, 79, 4]],
  [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 72, 2], [8, 69, 2], [10, 72, 2], [12, 77, 4]],
  [[0, 71, 2], [2, 74, 2], [4, 79, 2], [6, 74, 2], [8, 71, 2], [10, 74, 2], [12, 79, 2], [14, 77, 2]],
  [[0, 76, 3], [3, 74, 1], [4, 72, 4], [8, 67, 2], [10, 72, 6]],
  [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 72, 2], [8, 69, 2], [10, 72, 2], [12, 76, 4]],
  [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 81, 2], [8, 77, 2], [10, 72, 2], [12, 69, 4]],
  [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 71, 2], [10, 74, 2], [12, 79, 2], [14, 74, 2]],
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 84, 2], [8, 79, 4], [12, 72, 4]],
];

const menu = {
  bpm: 112, bars: 8,
  layers: [
    { min: 0, play(A, t, bar, st, d) {
      const r = MENU_ROOT[bar];
      if (st === 0 || st === 8) I.bass(A, t, r, 0.2, 0.2, d);
      if (st === 4 || st === 12) I.bass(A, t, r + 7, 0.2, 0.15, d);
    } },
    { min: 0, play(A, t, bar, st, d) {
      if (st === 4 || st === 12 || st === 10 && bar % 2) for (const m of MENU_CH[bar]) I.pizz(A, t, m, 0.05, d);
    } },
    { min: 0, play(A, t, bar, st, d) {
      for (const [s, m] of MENU_MEL[bar]) if (s === st) {
        I.pizz(A, t, m, 0.12, d);
        I.glock(A, t, m + 12, 0.04, d);
      }
    } },
    { min: 0, play(A, t, bar, st, d) {
      if (st % 4 === 0) I.wood(A, t, 0.07, d, st % 8 !== 0);
      if (st % 4 === 2) I.hat(A, t, 0.018, d);
    } },
  ],
};

// ---- battle: snare and tom march with a bass ostinato ---------------------------------------------
const BAT_CH = [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];
const BAT_ROOT = [38, 34, 43, 45];
const BAT_BASS_ST = [0, 2, 3, 6, 8, 10, 11, 14];
const BAT_BASS_SEMI = [0, 0, 12, 0, 7, 0, 12, 5];

const battle = {
  bpm: 138, bars: 8,
  layers: [
    { min: 0, play(A, t, bar, st, d) {
      if (st === 0 || st === 8) I.kick(A, t, 0.5, d);
      if (st === 4 || st === 12) I.snare(A, t, 0.2, d);
      if (st === 15 && bar % 2) I.snare(A, t, 0.08, d);
    } },
    { min: 0, play(A, t, bar, st, d) {
      const i = BAT_BASS_ST.indexOf(st);
      if (i >= 0) I.bass(A, t, BAT_ROOT[bar >> 1] + BAT_BASS_SEMI[i], 0.13, i === 0 ? 0.22 : 0.15, d, true);
    } },
    { min: 0.22, play(A, t, bar, st, d) {
      const tm = { 3: 50, 6: 47, 11: 45, 14: 43 };
      if (tm[st]) I.tom(A, t, tm[st], 0.26, d);
      if (st === 7 || st === 15) I.snare(A, t, 0.06, d);
      if (st % 2 === 0) I.hat(A, t, st % 4 === 0 ? 0.04 : 0.025, d);
    } },
    { min: 0.5, play(A, t, bar, st, d) {
      const c = BAT_CH[bar >> 1];
      const notes = bar % 2 === 0 ? [[0, c[2] + 12, 6], [8, c[1] + 12, 4], [12, c[2] + 12, 4]] : [[0, c[0] + 24, 4], [4, c[2] + 12, 4], [8, c[1] + 12, 6]];
      for (const [s, m, len] of notes) if (s === st) I.brass(A, t, m, len * spb(138) * 0.9, 0.075, d);
      if (st === 0 || st === 3 || st === 6) I.brass(A, t, c[0], 0.12, 0.05, d, 0.7);
    } },
    { min: 0.78, play(A, t, bar, st, d) {
      const c = BAT_CH[bar >> 1];
      if (st === 0 && bar % 2 === 0) { I.crash(A, t, 0.07, d); I.pad(A, t, c.map((m) => m + 12), 4 * 16 * spb(138) * 0.5, 0.025, d); }
      if (st % 2 === 1) I.hat(A, t, 0.02, d);
      if (st === 10 || st === 14) I.kick(A, t, 0.32, d);
      if (has([0, 8], st)) I.bass(A, t, BAT_ROOT[bar >> 1] + 12, 0.16, 0.08, d, true);
      if (bar % 4 === 3 && st >= 12) I.snare(A, t, 0.14, d);
    } },
  ],
};

// ---- boss: faster, minor, heavier -----------------------------------------------------------------
const BOSS_CH = [[64, 67, 71], [64, 67, 71], [65, 69, 72], [64, 67, 71], [67, 71, 74], [65, 69, 72], [64, 67, 71], [58, 62, 65]];
const BOSS_ROOT = [40, 40, 41, 40, 43, 41, 40, 34];
const BOSS_BASS_ST = [0, 2, 3, 4, 6, 8, 10, 11, 12, 14];
const BOSS_BASS_SEMI = [0, 12, 0, 1, 0, 0, 12, 0, 7, 6];

const boss = {
  bpm: 152, bars: 8, floor: 0.35, fade: 0.8, fadeIn: 0.6,
  layers: [
    { min: 0, play(A, t, bar, st, d) {
      if (st % 4 === 0) I.kick(A, t, 0.55, d);
      if (st === 6 || st === 10) I.kick(A, t, 0.32, d);
      if (st === 4 || st === 12) { I.snare(A, t, 0.26, d); I.tom(A, t, 41, 0.2, d); }
    } },
    { min: 0, play(A, t, bar, st, d) {
      const i = BOSS_BASS_ST.indexOf(st);
      if (i >= 0) I.bass(A, t, BOSS_ROOT[bar] + BOSS_BASS_SEMI[i], 0.1, i === 0 ? 0.24 : 0.17, d, true);
    } },
    { min: 0.2, play(A, t, bar, st, d) {
      const tm = { 0: 38, 6: 43, 10: 38, 14: 43 };
      if (tm[st]) I.tom(A, t, tm[st], 0.34, d);
      if (st % 2 === 0) I.hat(A, t, 0.04, d);
    } },
    { min: 0.45, play(A, t, bar, st, d) {
      const c = BOSS_CH[bar];
      if (st === 0 || st === 3 || st === 6 || (st === 10 && bar % 2)) for (const m of c) I.brass(A, t, m - 12, 0.11, 0.05, d, 1.5);
    } },
    { min: 0.6, play(A, t, bar, st, d) {
      if (st === 0) I.pad(A, t, BOSS_CH[bar].map((m) => m + 12), 16 * spb(152) * 0.95, 0.03, d, 1700);
      if (st % 2 === 1) I.hat(A, t, 0.022, d);
    } },
    { min: 0.85, play(A, t, bar, st, d) {
      if (st === 0 && bar % 2 === 0) I.crash(A, t, 0.09, d);
      if (bar % 4 === 3 && st >= 12) I.tom(A, t, 50 - (st - 12) * 2, 0.3, d);
      if (st === 8) I.brass(A, t, BOSS_CH[bar][0] + 12, 0.3, 0.06, d, 1.4);
    } },
  ],
};

// ---- stingers -------------------------------------------------------------------------------------
// [bar, step, midi, length in 16ths]
const VIC_MEL = [
  [0, 0, 67, 3], [0, 4, 72, 3], [0, 8, 76, 3], [0, 12, 79, 4],
  [1, 0, 77, 3], [1, 4, 81, 3], [1, 8, 84, 4], [1, 12, 81, 4],
  [2, 0, 79, 3], [2, 4, 76, 3], [2, 8, 74, 3], [2, 12, 71, 4],
  [3, 0, 72, 14],
];
const VIC_PAD = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55, 60]];
const victory = {
  bpm: 124, bars: 4, once: true, tail: 1.5, fade: 0.5, fadeIn: 0.15,
  layers: [{ min: 0, play(A, t, bar, st, d) {
    const s = spb(124);
    for (const [b, q, m, len] of VIC_MEL) if (b === bar && q === st) {
      I.brass(A, t, m, len * s * 0.95, 0.08, d, 1.1);
      I.glock(A, t, m + 12, 0.04, d);
    }
    if (st === 0) { I.pad(A, t, VIC_PAD[bar], 16 * s, 0.025, d); I.kick(A, t, 0.4, d); }
    if (st === 8 && bar < 3) I.tom(A, t, 48, 0.25, d);
    if (bar === 3 && st === 0) I.crash(A, t, 0.08, d);
    if (st % 4 === 0 && bar < 3) I.wood(A, t, 0.05, d, st % 8 !== 0);
  } }],
};

const DEF_MEL = [
  [0, 0, 69, 6], [0, 8, 67, 6],
  [1, 0, 65, 6], [1, 8, 64, 6],
  [2, 0, 62, 8], [2, 8, 64, 6],
  [3, 0, 57, 14],
];
const DEF_PAD = [[45, 48, 52], [41, 45, 48], [38, 41, 45], [40, 44, 47]];
const defeat = {
  bpm: 70, bars: 4, once: true, tail: 2.0, fade: 0.5, fadeIn: 0.2,
  layers: [{ min: 0, play(A, t, bar, st, d) {
    const s = spb(70);
    for (const [b, q, m, len] of DEF_MEL) if (b === bar && q === st) {
      A.brass(t, mtof(m), { dur: len * s * 0.95, vol: 0.07, attack: 0.08, bright: 0.5, dest: d });
    }
    if (st === 0) { I.pad(A, t, DEF_PAD[bar], 16 * s, 0.03, d, 800); I.tom(A, t, 38, 0.3, d); }
    if (st === 8 && bar < 3) I.tom(A, t, 36, 0.18, d);
  } }],
};

export const TRACKS = { menu, battle, boss, victory, defeat };
