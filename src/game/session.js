// One battle on screen: owns the Battle, feeds it player input, routes sim events to
// renderer/audio/HUD/tutorial, runs the camera, and hands off to the results screen.
import { Battle } from '../sim/index.js';
import { Input } from '../core/input.js';
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';
import { UI } from '../ui/ui.js';
import { Audio } from '../audio/audio.js';
import { handleBattleAudio } from '../audio/events.js';
import { buildBattleConfig } from './modes.js';
import { Save } from './save.js';
import { applyBattleResult } from './progression.js';

const UNIT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
const SPELL_KEYS = ['KeyZ', 'KeyX', 'KeyC'];

// SESSION_HOOKS: fn(session) called after a session starts (tutorial, trackers, modes add listeners).
export const SESSION_HOOKS = [];

export class Session {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.kind = opts.kind;
    this.isDemo = opts.kind === 'demo';
    this.profile = Save.data;
    this.cfg = buildBattleConfig(opts, this.profile);
    this.battle = new Battle(this.cfg);
    this.r = app.renderer;
    this.r.setBattle(this.battle, { camX: -60 });
    this.cam = this.r.cam;
    this.speed = 1;
    this.paused = false;
    this.hitStop = 0;
    this.ended = false;
    this.endT = 0;
    this.summary = null;
    this.targeting = null; // { kind: 'spell'|'flag', slot }
    this.pointer = { x: null, y: null, over: false };
    this.heroCamT = 0;
    this.listeners = [];
    this.roster = this.battle.teams[0].roster.slice(); // card order; index 0 is the Scribe
    this.touchHero = 0;
  }

  start() {
    if (!this.isDemo) {
      this.speed = (this.profile.settings && this.profile.settings.speed) || 1;
      this.app.loop.timeScale = this.speed;
      this.hud = UI.show('hud', { session: this });
    }
    this.cam.centerOn(this.battle.teams[0].fort.x + this.cam.viewW * 0.32);
    for (const hook of SESSION_HOOKS) hook(this);
    bus.emit('battleStart', this);
  }

  listen(fn) {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); };
  }

  // ---------------------------------------------------------------- commands (HUD calls these)
  spawn(id) {
    if (this.ended) return false;
    const ok = this.battle.requestUnit(0, id);
    if (ok) Audio.play('queue');
    else Audio.play('denied');
    return ok;
  }

  cancel(id) { return this.battle.cancelUnit(0, id); }

  stance(s, x) {
    if (this.ended) return;
    if (s === 'hold' && x == null) {
      this.targeting = { kind: 'flag' };
      bus.emit('targeting', this.targeting);
      return;
    }
    this.battle.setStance(0, s, x);
    Audio.play('stance_' + s);
  }

  beginSpell(slot) {
    const s = this.battle.teams[0].spells[slot];
    if (!s || s.cd > 0 || this.ended) { Audio.play('denied'); return; }
    if (this.targeting && this.targeting.kind === 'spell' && this.targeting.slot === slot) { this.cancelTargeting(); return; }
    this.targeting = { kind: 'spell', slot, id: s.id };
    bus.emit('targeting', this.targeting);
  }

  cancelTargeting() {
    this.targeting = null;
    bus.emit('targeting', null);
  }

  // Resolve a click on the battlefield at screen x.
  clickWorld(sx) {
    const x = clamp(this.cam.worldX(sx), 20, this.battle.width - 20);
    const t = this.targeting;
    if (!t) return false;
    if (t.kind === 'flag') {
      this.battle.setStance(0, 'hold', x);
      Audio.play('stance_hold');
    } else if (t.kind === 'spell') {
      if (!this.battle.castSpell(0, t.slot, x)) Audio.play('denied');
    }
    this.cancelTargeting();
    return true;
  }

  heroAbility(id) {
    if (this.ended) return;
    this.battle.control[0].heroAbility = id;
  }

  togglePause(force) {
    if (this.isDemo || this.ended) return;
    this.paused = force ?? !this.paused;
    this.app.loop.paused = this.paused;
    if (this.paused) UI.modal('pause', { session: this });
    else UI.closeModal('pause');
    bus.emit('pause', this.paused);
  }

  setSpeed(v) {
    this.speed = v;
    this.app.loop.timeScale = v;
    if (this.profile.settings) { this.profile.settings.speed = v; Save.save(); }
  }

  toggleSpeed() {
    this.setSpeed(this.speed >= 2 ? 1 : 2);
  }

  surrender() {
    if (this.ended) return;
    this.app.loop.paused = false;
    this.paused = false;
    UI.closeModal('pause');
    this.battle.teams[0].fort.hp = 0;
    this.battle.teams[0].fort.alive = false;
    this.battle.end(1, 'surrender');
  }

  // ---------------------------------------------------------------- loop
  readKeys() {
    const b = this.battle;
    const ctl = b.control[0];
    let mv = 0;
    if (Input.isDown('KeyA', 'ArrowLeft')) mv -= 1;
    if (Input.isDown('KeyD', 'ArrowRight')) mv += 1;
    if (this.touchHero) mv = this.touchHero;
    ctl.heroMove = this.ended ? 0 : mv;
    if (mv) this.heroCamT = 2.5;
    if (Input.take('KeyQ')) this.heroAbility('rally');
    if (Input.take('KeyE')) this.heroAbility('slam');
    if (Input.take('KeyR')) this.heroAbility('inkstorm');
    if (Input.take('KeyW', 'ArrowUp')) this.stance('charge');
    if (Input.take('KeyS', 'ArrowDown')) this.stance('defend');
    if (Input.take('KeyF')) {
      const h = b.teams[0].hero;
      this.stance('hold', h ? h.x : this.cam.x + this.cam.viewW / 2);
    }
    for (let i = 0; i < UNIT_KEYS.length; i++) if (Input.take(UNIT_KEYS[i]) && this.roster[i]) this.spawn(this.roster[i]);
    for (let i = 0; i < SPELL_KEYS.length; i++) {
      if (!Input.take(SPELL_KEYS[i])) continue;
      const s = b.teams[0].spells[i];
      if (!s) continue;
      if (this.pointer.over && this.pointer.x != null && s.cd <= 0) {
        if (!b.castSpell(0, i, this.cam.worldX(this.pointer.x))) Audio.play('denied');
      } else this.beginSpell(i);
    }
    if (Input.take('Space')) this.heroCamT = this.heroCamT > 0 ? 0 : 3;
    if (Input.take('Escape', 'KeyP')) {
      if (this.targeting) this.cancelTargeting();
      else this.togglePause();
    }
    if (Input.take('KeyT')) this.toggleSpeed();
  }

  update(dt) {
    const b = this.battle;
    if (!this.isDemo && !this.paused) this.readKeys();
    if (this.hitStop > 0) this.hitStop -= dt;
    else b.update(dt);
    this.r.update(dt);
    const evs = b.drainEvents();
    for (const e of evs) this.onEvent(e);
    this.updateCamera(dt);
    if (b.result && !this.ended) this.onEnd();
    if (this.ended) {
      this.endT += dt;
      if (this.isDemo && this.endT > 4) this.app.restartDemo();
    }
  }

  onEvent(e) {
    if (!this.isDemo || e.type === 'explode') handleBattleAudio(e, this);
    if (e.type === 'explode' || (e.type === 'hit' && e.amount >= 90) || e.type === 'fortDestroyed') this.hitStop = Math.max(this.hitStop, e.type === 'fortDestroyed' ? 0.12 : 0.045);
    for (const fn of this.listeners) fn(e, this);
  }

  updateCamera(dt) {
    const b = this.battle;
    if (this.isDemo) {
      // Drift toward the front line.
      let sum = 0, n = 0;
      for (const u of b.units) if (u.alive && u.type !== 'scribe') { sum += u.x; n++; }
      const fx = n ? sum / n : b.width / 2;
      this.cam.lookAt(fx, 0.5);
      return;
    }
    this.heroCamT -= dt;
    const h = b.teams[0].hero;
    if (h && this.heroCamT > 0 && !this.dragging) this.cam.lookAt(h.x, 0.42);
  }

  onEnd() {
    this.ended = true;
    this.cancelTargeting();
    const win = this.battle.result.winner === 0;
    if (this.isDemo) return;
    // Slow-motion beat, then results.
    this.app.loop.timeScale = 0.3;
    const lose = this.battle.teams[win ? 1 : 0].fort;
    this.cam.lookAt(lose.x, 0.5);
    Audio.play(win ? 'victory' : 'defeat');
    setTimeout(() => {
      this.app.loop.timeScale = 1;
      this.summary = applyBattleResult(this.profile, this);
      bus.emit('battleEnd', { session: this, summary: this.summary });
      UI.show('results', { session: this, summary: this.summary });
    }, 1900);
  }

  destroy() {
    this.listeners.length = 0;
    this.app.loop.paused = false;
    this.app.loop.timeScale = 1;
  }
}
