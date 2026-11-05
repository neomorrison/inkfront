// WebAudio engine: buses, helpers for procedural recipes (tone, noise, bell, brass), per-sound
// voice limits, ducking, volume handling. Starts on the first user gesture.
// Recipes live in sounds.js / sounds_spells.js, the event mapping in events.js, music in music.js.

// SFX[name] = (A, at, opts) -> void  where A = Audio engine, at = start time, opts = { vol, pitch, pan }
export const SFX = {};

// MIDI note number to Hz.
export const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

const MAX_VOICES = 110; // live oscillator/noise nodes before non-priority sounds are skipped
const DEFAULT_VARY = 0.07; // random pitch spread per play, so repeats never sound identical

export const Audio = {
  ctx: null,
  master: null,
  music: null, // music volume node
  musicIn: null, // music ducking node (music engine connects here)
  sfx: null, // sfx volume node
  verb: null, // reverb send input
  noiseBuf: null,
  brownBuf: null,
  ready: false,
  offline: false,
  voices: 0,
  vol: { music: 0.55, sfx: 0.8 },
  last: new Map(),
  recent: new Map(),
  limits: {}, // min seconds between plays of a name
  vary: {}, // per name pitch spread (default 0.07)
  poly: {}, // per name max plays inside a 0.3 s window (default 6)
  prio: new Set(), // names that ignore the global voice cap

  // Build the node graph on a context. `dest` is where the sfx bus ends (offline tests use the raw destination).
  _build(ctx, dest) {
    this.ctx = ctx;
    this.sfx = ctx.createGain();
    // Gentle glue compressor on the sfx bus so piles of hits stay punchy but not harsh.
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 12;
    glue.ratio.value = 3.5;
    glue.attack.value = 0.003;
    glue.release.value = 0.16;
    this.sfx.connect(glue);
    glue.connect(dest);
    // Short paper-room reverb.
    this.verb = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this._impulse(ctx, 1.1, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.verb.connect(conv);
    conv.connect(wet);
    wet.connect(this.sfx);
    // White and brown noise.
    const n = ctx.sampleRate * 3;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brownBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    const br = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = w;
      last = (last + 0.02 * w) / 1.02;
      br[i] = last * 3.5;
    }
  },

  _impulse(ctx, secs, decay) {
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    this.master.connect(comp);
    comp.connect(limiter);
    limiter.connect(ctx.destination);
    this._build(ctx, this.master);
    this.music = ctx.createGain();
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.music);
    this.music.connect(this.master);
    this.applyVolumes();
    this.ready = true;
  },

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  },

  has(name) { return !!SFX[name]; },

  get running() { return !!(this.ctx && this.ready && this.ctx.state === 'running'); },

  setVolumes(music, sfx) {
    this.vol.music = Math.max(0, Math.min(1, +music || 0));
    this.vol.sfx = Math.max(0, Math.min(1, +sfx || 0));
    this.applyVolumes();
    for (const fn of this.volListeners) fn();
  },
  volListeners: [],

  applyVolumes() {
    if (!this.ctx || !this.music) return;
    // Volume 0 is a true mute: the gain is exactly 0 and play() / the music scheduler skip work.
    this.music.gain.value = this.vol.music <= 0.001 ? 0 : this.vol.music * 0.45;
    this.sfx.gain.value = this.vol.sfx <= 0.001 ? 0 : this.vol.sfx * 1.35;
  },

  // Lower the music under a big sound, then let it come back.
  duck(depth = 0.45, hold = 0.12, release = 0.7) {
    if (!this.running || !this.musicIn) return;
    const g = this.musicIn.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(Math.max(0.15, 1 - depth), t, 0.025);
    g.setTargetAtTime(1, t + hold, release / 3);
  },

  // Play a named sound. opts: { vol, pitch, pan (-1..1), limit (min seconds between plays) }
  play(name, opts = {}) {
    if (!this.ready || this.ctx.state !== 'running') return;
    if (this.vol.sfx <= 0.001) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = this.ctx.currentTime;
    const gap = opts.limit ?? this.limits[name] ?? 0.035;
    const prev = this.last.get(name) || -1;
    if (now - prev < gap) return;
    const prio = this.prio.has(name);
    if (!prio && this.voices > MAX_VOICES) return;
    // Per-name polyphony inside a short window.
    let rec = this.recent.get(name);
    if (!rec) { rec = []; this.recent.set(name, rec); }
    while (rec.length && now - rec[0] > 0.3) rec.shift();
    if (!prio && rec.length >= (this.poly[name] ?? 6)) return;
    rec.push(now);
    this.last.set(name, now);
    const spread = this.vary[name] ?? DEFAULT_VARY;
    const o = {
      ...opts,
      vol: opts.vol ?? 1,
      pitch: (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * spread),
    };
    try { fn(this, now, o); } catch (e) { /* never let a sound break the game */ }
  },

  // Render one recipe on an OfflineAudioContext: { peak, rms, samples } for tests and tuning.
  async renderOffline(name, opts = {}, secs = 2.5) {
    const rate = 44100;
    const oc = new OfflineAudioContext(2, Math.ceil(rate * secs), rate);
    const eng = Object.create(Audio);
    eng.offline = true;
    eng.voices = 0;
    eng._build(oc, oc.destination);
    SFX[name](eng, 0, { vol: 1, pitch: 1, ...opts });
    const buf = await oc.startRendering();
    let peak = 0, sum = 0, n = 0, firstSound = -1;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
        sum += d[i] * d[i];
        n++;
        if (firstSound < 0 && a > 0.001) firstSound = i / rate;
      }
    }
    return { peak, rms: Math.sqrt(sum / n), start: firstSound };
  },

  // ---- Helpers for recipes -------------------------------------------------------------------

  rand(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // Output gain with optional pan and reverb send (wet 0..1).
  out(opts = {}) {
    const g = this.ctx.createGain();
    g.gain.value = opts.vol ?? 1;
    let tail = g;
    if (opts.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      tail = p;
    }
    tail.connect(opts.bus || this.sfx);
    if (opts.wet && this.verb) {
      const s = this.ctx.createGain();
      s.gain.value = opts.wet;
      tail.connect(s);
      s.connect(this.verb);
    }
    return g;
  },

  _count(node) {
    if (this.offline) return;
    this.voices++;
    node.onended = () => { this.voices--; };
  },

  // Oscillator note. f2 = glide target. hold = sustain time before the decay. lp/lp2 = lowpass sweep.
  // vib = [rateHz, cents]. detune in cents.
  tone(at, { type = 'sine', f = 440, f2 = null, dur = 0.15, vol = 0.3, attack = 0.005, hold = 0, lp = 0, lp2 = 0, q = 0.7, vib = null, detune = 0, lin = false, dest }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) {
      if (lin) o.frequency.linearRampToValueAtTime(Math.max(20, f2), at + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    }
    if (detune) o.detune.value = detune;
    let lfo = null;
    if (vib) {
      lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = vib[0];
      lg.gain.value = vib[1];
      lfo.connect(lg);
      lg.connect(o.detune);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + attack);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, vol), at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let head = o;
    if (lp) {
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.Q.value = q;
      flt.frequency.setValueAtTime(lp, at);
      if (lp2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, lp2), at + dur);
      o.connect(flt);
      head = flt;
    }
    head.connect(g);
    g.connect(dest || this.sfx);
    o.start(at);
    o.stop(at + dur + 0.05);
    this._count(o);
    return o;
  },

  // Filtered noise burst. color: 'white' | 'brown'. f2 = filter sweep target.
  noise(at, { dur = 0.2, vol = 0.3, type = 'bandpass', f = 1200, f2 = null, q = 1, attack = 0.003, hold = 0, color = 'white', trem = null, dest }) {
    const s = this.ctx.createBufferSource();
    s.buffer = color === 'brown' ? this.brownBuf : this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, at);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + dur);
    flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + attack);
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, vol), at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(flt);
    let tail = flt;
    if (trem) {
      // Amplitude wobble [rateHz, depth 0..1] for rubbing / whirling textures.
      const tg = this.ctx.createGain();
      tg.gain.value = 1 - trem[1] / 2;
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = trem[0];
      lg.gain.value = trem[1] / 2;
      lfo.connect(lg);
      lg.connect(tg.gain);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
      flt.connect(tg);
      tail = tg;
    }
    tail.connect(g);
    g.connect(dest || this.sfx);
    const room = Math.max(0, s.buffer.duration - dur - 0.1);
    s.start(at, Math.random() * room);
    s.stop(at + dur + 0.05);
    this._count(s);
    return s;
  },

  // Bright metallic bell / glockenspiel note (inharmonic partials).
  bell(at, f, { dur = 0.5, vol = 0.2, dest, bright = 1 } = {}) {
    this.tone(at, { type: 'sine', f, dur, vol, attack: 0.002, dest });
    this.tone(at, { type: 'sine', f: f * 2.76, dur: dur * 0.5, vol: vol * 0.35 * bright, attack: 0.002, dest });
    this.tone(at, { type: 'sine', f: f * 5.4, dur: dur * 0.25, vol: vol * 0.15 * bright, attack: 0.002, dest });
  },

  // Brass-like note: two detuned saws through a lowpass that opens with the swell.
  brass(at, f, { dur = 0.5, vol = 0.12, attack = 0.04, bright = 1, dest, vibrato = true, glide = 0 } = {}) {
    const lp = Math.min(6000, f * (3 + 3 * bright));
    const base = { type: 'sawtooth', f, dur, vol, attack, hold: Math.max(0, dur * 0.4 - attack), lp: lp * 0.4, lp2: lp, q: 1.2, dest, vib: vibrato ? [5.2, 8] : null };
    if (glide) base.f2 = f * glide;
    this.tone(at, { ...base, detune: -7 });
    this.tone(at, { ...base, detune: 7, vib: null });
  },
};

// Foundation sounds that other code calls before the library loads are replaced by sounds.js.
