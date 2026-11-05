// Procedural music engine. Tracks are step sequencers (16th notes) built from layers; battle and boss
// layers fade in with combat intensity (measured from recent hit events). Optional streamed files:
// if assets/music/<track>.mp3 exists (and is listed in FILE_TRACKS) it is used instead.
import { Audio, mtof } from './audio.js';
import { bus } from '../core/events.js';
import { TRACKS } from './tracks.js';

// Tracks that may be replaced by assets/music/<name>.mp3. A missing file is probed once with fetch HEAD
// and the answer is cached. Opt-in (?musicfiles in the URL, or window.INKFRONT_MUSIC_FILES = [...] before
// boot) because a missing file shows up as a console 404.
// The game ships recorded tracks for these; ?nomusicfiles forces the procedural versions.
export const FILE_TRACKS = (typeof window !== 'undefined' && Array.isArray(window.INKFRONT_MUSIC_FILES))
  ? window.INKFRONT_MUSIC_FILES
  : (typeof location !== 'undefined' && /[?&]nomusicfiles\b/.test(location.search))
    ? [] : ['menu', 'battle', 'boss', 'final'];
// Alternate recordings picked at random each time a track starts.
const FILE_VARIANTS = { battle: ['battle', 'battle2'], boss: ['boss', 'boss2'] };
// Tracks with no procedural score of their own borrow one (used only if the file cannot play).
const SCORE_FOR = { final: 'boss' };
const FILE_GAIN = 0.8;

const TICK_MS = 50;
const LOOKAHEAD = 0.45;
const FADE = 1.4; // default crossfade seconds
const fileProbe = new Map();

function probeFile(name) {
  if (!FILE_TRACKS.includes(name) || typeof fetch === 'undefined') return Promise.resolve(false);
  if (!fileProbe.has(name)) {
    fileProbe.set(name, fetch(`assets/music/${name}.mp3`, { method: 'HEAD' })
      .then((r) => r.ok && !/text\/html/.test(r.headers.get('content-type') || ''))
      .catch(() => false));
  }
  return fileProbe.get(name);
}

export const Music = {
  wanted: null, // track name the game asked for (null = silence)
  cur: null, // live instance
  old: [], // instances fading out
  timer: 0,
  energy: 0, // decaying combat energy
  energyT: 0,
  intensity: 0, // smoothed 0..1
  paused: false,
  mix: null,
  lastDuck: 0,

  // Ask for a track. Safe to call before audio is unlocked; it starts once the context runs.
  request(name) {
    if (name === this.wanted && (this.cur || !name)) return;
    this.wanted = name || null;
    if (!name) this.fadeOutCurrent(0.8);
    this.ensureTimer();
    this.sync();
  },

  ensureTimer() {
    if (this.timer || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  },

  get active() { return Audio.running && Audio.vol.music > 0.001; },

  getMix() {
    if (!this.mix || this.mix.context !== Audio.ctx) {
      this.mix = Audio.ctx.createGain();
      this.mix.connect(Audio.musicIn);
    }
    return this.mix;
  },

  sync() {
    if (!this.active) return;
    if (this.wanted && (!this.cur || this.cur.name !== this.wanted)) this.start(this.wanted);
  },

  start(name) {
    const def = TRACKS[name] || TRACKS[SCORE_FOR[name]];
    if (!def) return;
    const ctx = Audio.ctx;
    const t = ctx.currentTime;
    const mix = this.getMix();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.connect(mix);
    const inst = {
      name, def, gain, t0: t, dead: false, step: 0, nextTime: t + 0.06, layers: [], file: null,
      finished: false, doneAt: 0, waitFile: FILE_TRACKS.includes(name),
    };
    for (const L of def.layers) {
      const lg = ctx.createGain();
      lg.gain.value = L.min > 0 ? 0 : (L.vol ?? 1);
      lg.connect(gain);
      inst.layers.push({ L, g: lg, cur: lg.gain.value });
    }
    // Crossfade: old out, new in.
    if (this.cur) this.retire(this.cur, def.fade ?? FADE);
    this.cur = inst;
    const fade = def.fadeIn ?? FADE;
    gain.gain.setTargetAtTime(1, t, fade / 3);
    probeFile(name).then((ok) => {
      if (!ok) { inst.waitFile = false; return; }
      if (inst.dead || this.cur !== inst) return;
      this.useFile(inst);
    });
  },

  useFile(inst) {
    try {
      const vars = FILE_VARIANTS[inst.name] || [inst.name];
      const pick = vars[Math.floor(Math.random() * vars.length)];
      const el = document.createElement('audio');
      el.src = `assets/music/${pick}.mp3`;
      el.loop = !inst.def.once;
      el.preload = 'auto';
      const src = Audio.ctx.createMediaElementSource(el);
      const g = Audio.ctx.createGain();
      g.gain.value = FILE_GAIN;
      src.connect(g);
      g.connect(inst.gain);
      inst.waitFile = true;
      el.play().then(() => { inst.file = el; inst.waitFile = false; }).catch(() => { inst.waitFile = false; });
    } catch (e) { inst.waitFile = false; /* stay procedural */ }
  },

  retire(inst, secs) {
    if (inst.dead) return;
    const ctx = Audio.ctx;
    inst.retiring = true;
    inst.gain.gain.cancelScheduledValues(ctx.currentTime);
    inst.gain.gain.setTargetAtTime(0, ctx.currentTime, secs / 3);
    this.old.push(inst);
    setTimeout(() => this.kill(inst), secs * 1000 + 400);
  },

  kill(inst) {
    inst.dead = true;
    if (inst.file) { try { inst.file.pause(); } catch (e) { /* ignore */ } }
    try { inst.gain.disconnect(); } catch (e) { /* ignore */ }
    const i = this.old.indexOf(inst);
    if (i >= 0) this.old.splice(i, 1);
    if (this.cur === inst) this.cur = null;
  },

  fadeOutCurrent(secs) {
    if (this.cur && Audio.ctx) { this.retire(this.cur, secs); this.cur = null; }
  },

  // One-shot stinger, then back to `after` (default menu).
  stinger(name, after = 'menu') {
    const def = TRACKS[name];
    if (!def) { this.request(after); return; }
    this.after = after;
    this.wanted = name;
    this.ensureTimer();
    this.sync();
    // If audio is off, still land on the follow-up track.
    if (!this.active) this.wanted = after;
  },

  noteHit(w) {
    const t = Audio.ctx ? Audio.ctx.currentTime : 0;
    this.energy = this.energy * Math.exp(-(t - this.energyT) / 3) + w;
    this.energyT = t;
    if (this.energy > 1.3) this.energy = 1.3;
  },

  setPaused(p) {
    this.paused = !!p;
    if (!this.mix || !Audio.ctx) return;
    const g = this.mix.gain;
    g.cancelScheduledValues(Audio.ctx.currentTime);
    g.setTargetAtTime(this.paused ? 0.3 : 1, Audio.ctx.currentTime, 0.12);
  },

  tick() {
    if (!Audio.ctx) return;
    if (Audio.ctx.state !== 'running') return;
    this.sync();
    const ctx = Audio.ctx;
    const t = ctx.currentTime;
    // Intensity follows combat energy, quick up and slower down.
    const e = this.energy * Math.exp(-(t - this.energyT) / 3);
    const target = Math.max(0, Math.min(1, e));
    this.intensity += (target - this.intensity) * (target > this.intensity ? 0.25 : 0.05);
    const insts = this.cur ? [this.cur, ...this.old] : this.old;
    for (const inst of insts) {
      if (inst.dead) continue;
      if (this.active && !inst.file && !inst.waitFile) this.schedule(inst, t);
      if (inst === this.cur) this.updateLayers(inst, t);
    }
    // A finished stinger hands over to the next track.
    const c = this.cur;
    if (c && c.def.once && c.finished && t > c.doneAt && this.wanted === c.name) {
      this.wanted = this.after || 'menu';
      this.sync();
    }
  },

  updateLayers(inst, t) {
    const base = inst.def.floor || 0;
    const I = Math.max(base, this.intensity);
    for (const l of inst.layers) {
      if (l.L.min <= 0) continue;
      const k = Math.max(0, Math.min(1, (I - l.L.min) / 0.2));
      const v = k * (l.L.vol ?? 1);
      if (Math.abs(v - l.cur) > 0.02) {
        l.cur = v;
        l.g.gain.setTargetAtTime(v, t, 0.35);
      }
    }
  },

  schedule(inst, now) {
    const def = inst.def;
    const spb = 60 / def.bpm / 4; // seconds per 16th
    if (inst.nextTime < now - 0.25) inst.nextTime = now + 0.05; // tab was asleep: skip ahead, do not burst
    const total = def.bars * 16;
    while (inst.nextTime < now + LOOKAHEAD) {
      if (def.once && inst.step >= total) {
        if (!inst.finished) { inst.finished = true; inst.doneAt = inst.nextTime + (def.tail || 0.8); }
        break;
      }
      const s = inst.step % total;
      const bar = Math.floor(s / 16);
      const st = s % 16;
      for (const l of inst.layers) {
        if (l.cur < 0.03) continue; // silent layer: do not even create nodes
        l.L.play(Audio, inst.nextTime, bar, st, l.g, inst.step);
      }
      inst.step++;
      inst.nextTime += spb;
    }
  },

  // Session hooks.
  attach(session) {
    this.detach();
    this.session = session;
    this.unlisten = session.listen((e) => this.onEvent(e, session));
    this.energy = 0;
    this.intensity = 0;
    this.request('battle');
  },

  detach() {
    if (this.unlisten) { this.unlisten(); this.unlisten = null; }
    this.session = null;
    clearTimeout(this.bossT);
  },

  onEvent(e, session) {
    switch (e.type) {
      case 'hit': this.noteHit(0.05 + Math.min(0.25, (e.amount || 0) / 300)); break;
      case 'death': this.noteHit(0.05); break;
      case 'explode': this.noteHit(0.14); break;
      case 'fortHit': this.noteHit(0.05); break;
      case 'fortDestroyed': this.noteHit(0.5); break;
      case 'bossArrive':
        clearTimeout(this.bossT);
        this.bossT = setTimeout(() => { if (this.session === session && !session.ended) this.request(e.id === 'boss_hand' ? 'final' : 'boss'); }, 1100);
        break;
      case 'bossDefeated':
        clearTimeout(this.bossT);
        if (this.session === session && !session.ended) this.request('battle');
        break;
      case 'end':
        clearTimeout(this.bossT);
        this.wanted = null;
        this.fadeOutCurrent(0.7);
        break;
      default: break;
    }
  },
};

// Volume changes: 0 mutes at once, raising it brings the track back in.
Audio.volListeners.push(() => {
  if (!Audio.ctx) return;
  if (Audio.vol.music <= 0.001) {
    for (const i of [Music.cur, ...Music.old]) if (i && i.file) { try { i.file.pause(); } catch (e) { /* ignore */ } }
  } else if (Music.cur && Music.cur.file) Music.cur.file.play().catch(() => {});
  Music.sync();
});

// ---- routing -----------------------------------------------------------------------------------
const MENU_SKIP = new Set(['hud', 'pause', 'endless']);
bus.on('screen', ({ name }) => {
  if (MENU_SKIP.has(name)) return;
  // The results screen opens while the win/lose stinger is still playing.
  if (name === 'results' && Music.wanted && (Music.wanted === 'victory' || Music.wanted === 'defeat')) return;
  if (name === 'results' && Music.cur && Music.cur.def.once && !Music.cur.finished) return;
  Music.detach();
  Music.request('menu');
});
bus.on('battleStart', (session) => {
  if (!session || session.isDemo) return;
  Music.attach(session);
});
bus.on('battleEnd', ({ session }) => {
  const win = session && session.battle && session.battle.result && session.battle.result.winner === 0;
  Music.detach();
  Music.stinger(win ? 'victory' : 'defeat', 'menu');
});
bus.on('pause', (p) => Music.setPaused(p));
bus.on('audioUnlocked', () => { Music.ensureTimer(); Music.sync(); });

export { mtof };
