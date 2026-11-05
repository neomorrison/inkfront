// WebAudio engine: master/music/sfx buses, procedural SFX recipes (SFX[name]), positional
// panning by screen position, per-sound voice limits. Starts on the first user gesture.
// OWNER: audio builder (package G) adds the full SFX library, music and event mapping
// (src/audio/sounds.js, src/audio/music.js, src/audio/events.js).

// SFX[name] = (A, at, opts) -> void  where A = Audio engine, at = start time, opts = { vol, pitch, pan }
export const SFX = {};

export const Audio = {
  ctx: null,
  master: null,
  music: null,
  sfx: null,
  noiseBuf: null,
  ready: false,
  vol: { music: 0.55, sfx: 0.8 },
  last: new Map(),
  limits: {},

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.applyVolumes();
    const n = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.ready = true;
  },

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolumes(music, sfx) {
    this.vol.music = music;
    this.vol.sfx = sfx;
    this.applyVolumes();
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.music.gain.value = this.vol.music * 0.6;
    this.sfx.gain.value = this.vol.sfx;
  },

  // Play a named sound. opts: { vol, pitch, pan (-1..1), limit (min seconds between plays) }
  play(name, opts = {}) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = this.ctx.currentTime;
    const gap = opts.limit ?? this.limits[name] ?? 0.035;
    const prev = this.last.get(name) || 0;
    if (now - prev < gap) return;
    this.last.set(name, now);
    try { fn(this, now, opts); } catch (e) { /* never let a sound break the game */ }
  },

  // Helpers for recipes.
  out(opts = {}) {
    const g = this.ctx.createGain();
    g.gain.value = opts.vol ?? 1;
    if (opts.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      p.connect(opts.bus || this.sfx);
    } else g.connect(opts.bus || this.sfx);
    return g;
  },

  tone(at, { type = 'sine', f = 440, f2 = null, dur = 0.15, vol = 0.3, attack = 0.005, dest }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  },

  noise(at, { dur = 0.2, vol = 0.3, type = 'bandpass', f = 1200, f2 = null, q = 1, attack = 0.003, dest }) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, at);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(flt);
    flt.connect(g);
    g.connect(dest || this.sfx);
    s.start(at, Math.random() * 0.5);
    s.stop(at + dur + 0.05);
    return s;
  },
};

// A few basics so the foundation has sound; package G replaces and extends these.
SFX.click = (A, at, o) => A.tone(at, { type: 'triangle', f: 820, f2: 520, dur: 0.06, vol: 0.25 * (o.vol ?? 1), dest: A.out(o) });
SFX.hit = (A, at, o) => {
  const d = A.out(o);
  A.noise(at, { dur: 0.08, vol: 0.35 * (o.vol ?? 1), f: 900 * (o.pitch || 1), q: 0.8, dest: d });
  A.tone(at, { type: 'sine', f: 180 * (o.pitch || 1), f2: 70, dur: 0.1, vol: 0.4 * (o.vol ?? 1), dest: d });
};
SFX.shoot = (A, at, o) => A.noise(at, { dur: 0.12, vol: 0.18 * (o.vol ?? 1), type: 'highpass', f: 2400, f2: 900, dest: A.out(o) });
SFX.spawn = (A, at, o) => {
  const d = A.out(o);
  for (let i = 0; i < 4; i++) A.noise(at + i * 0.05, { dur: 0.05, vol: 0.12 * (o.vol ?? 1), f: 3000 + Math.random() * 2000, q: 3, dest: d });
};
SFX.death = (A, at, o) => A.tone(at, { type: 'triangle', f: 420 * (o.pitch || 1), f2: 120, dur: 0.22, vol: 0.18 * (o.vol ?? 1), dest: A.out(o) });
SFX.coin = (A, at, o) => {
  const d = A.out(o);
  A.tone(at, { type: 'square', f: 1320, dur: 0.07, vol: 0.08 * (o.vol ?? 1), dest: d });
  A.tone(at + 0.06, { type: 'square', f: 1760, dur: 0.12, vol: 0.08 * (o.vol ?? 1), dest: d });
};
SFX.boom = (A, at, o) => {
  const d = A.out(o);
  A.noise(at, { dur: 0.6, vol: 0.6 * (o.vol ?? 1), type: 'lowpass', f: 1800, f2: 80, dest: d });
  A.tone(at, { type: 'sine', f: 90, f2: 35, dur: 0.5, vol: 0.6 * (o.vol ?? 1), dest: d });
};
