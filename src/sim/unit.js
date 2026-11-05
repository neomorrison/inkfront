import { clamp, hash1 } from '../core/util.js';
import { BEHAVIORS, TRAITS } from './registry.js';
import { unitStats, unitPerks } from './stats.js';

export const GRAVITY = 1500;

// One soldier (or worker, hero, boss, structure). The sim mutates these; the renderer only reads.
// Coordinates: x along the battlefield, y = height above ground (negative is up), z = depth -1..1
// (purely visual row; combat ignores z).
export class Unit {
  constructor(b, team, def, o = {}) {
    this.id = b.nextId++;
    this.team = team;
    this.def = def;
    this.type = def.id;
    const T = b.teams[team];
    this.level = o.level ?? T.unitLevels[def.id] ?? 1;
    this.perks = unitPerks(def, this.level);
    const s = unitStats(def, this.level, T, this.perks);
    this.maxHp = s.hp * (o.hpMult ?? 1);
    this.hp = this.maxHp * (o.hpFrac ?? 1);
    this.dmg = s.dmg * (o.dmgMult ?? 1);
    this.range = s.range;
    this.atkCd = s.atkCd;
    this.windup = s.windup;
    this.speed = s.speed;
    this.armor = s.armor;
    this.mass = s.mass;
    this.kb = s.kb;
    this.aggro = s.aggro;

    this.scale = (def.look && def.look.scale) || 1;
    this.radius = def.radius ?? 9 * this.scale;
    this.height = def.height ?? 66 * this.scale;
    this.tags = new Set(def.tags || []);
    this.traits = def.traits ? def.traits.slice() : [];

    this.dir = T.dir;
    this.facing = this.dir;
    this.x = o.x ?? T.fort.x + this.dir * (T.fort.radius + 14);
    this.px = this.x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.moveV = 0;
    this.z = o.z ?? b.rng.range(-1, 1);
    this.jitter = hash1(this.id * 7 + 3) * 2 - 1; // stable -1..1, spreads formation slots

    this.alive = true;
    this.targetable = true;
    this.stealth = false;
    this.flying = this.tags.has('flying');
    this.canHitAir = !!def.proj || def.behavior === 'caster' || !!def.canHitAir;
    this.blocker = this.tags.has('structure');
    this.taunt = this.traits.includes('taunt');
    this.isHero = !!def.hero;
    this.isBoss = !!def.boss;
    this.summoned = !!def.summon || !!o.summoned;
    this.lifetime = o.lifetime ?? def.lifetime ?? 0;
    this.immuneKb = false;
    this.immuneStun = false;

    this.state = o.instant ? 'idle' : 'spawn';
    this.stateT = 0;
    this.spawnTime = o.spawnTime ?? 0.5;
    this.target = null;
    this.retargetT = 0;
    this.atkT = 0;
    this.attacking = false;
    this.atkElapsed = 0;
    this.atkHit = false;
    this.atkTarget = null;
    this.staggerT = 0;
    this.airborne = false;

    this.buffs = [];
    this.mod = { dmg: 1, speed: 1, atkSpeed: 1, armor: 0, dmgTaken: 1, heal: 1, stun: false, root: false };
    // Animation cues for the renderer. walk = distance walked; atk = attack progress 0..1
    // (0.5 is the hit frame); style = attack animation; flash = hit flash timer.
    this.anim = { t: 0, walk: 0, atk: 0, style: (def.look && def.look.style) || 'slash', moving: false, flash: 0, cast: 0, cheer: 0 };
    this.data = {}; // behavior/trait scratch space
    this.lastHitBy = null;
    this.lastHitT = -99;
    this.kills = 0;
  }

  setState(s) {
    if (this.state !== s) { this.state = s; this.stateT = 0; }
  }

  addBuff(f) {
    if (this.immuneStun && (f.stun || f.root)) return;
    const ex = this.buffs.find((x) => x.id === f.id);
    if (ex) { const t = Math.max(ex.t, f.t); Object.assign(ex, f); ex.t = t; }
    else this.buffs.push({ ...f });
  }

  removeBuffs(pred) {
    this.buffs = this.buffs.filter((f) => !pred(f));
  }

  hasBuff(id) {
    return this.buffs.some((f) => f.id === id);
  }

  updateBuffs(b, dt) {
    const m = this.mod;
    m.dmg = 1; m.speed = 1; m.atkSpeed = 1; m.armor = 0; m.dmgTaken = 1; m.heal = 1; m.stun = false; m.root = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const f = this.buffs[i];
      f.t -= dt;
      if (f.dmg) m.dmg *= f.dmg;
      if (f.speed) m.speed *= f.speed;
      if (f.atkSpeed) m.atkSpeed *= f.atkSpeed;
      if (f.armor) m.armor += f.armor;
      if (f.dmgTaken) m.dmgTaken *= f.dmgTaken;
      if (f.heal != null) m.heal *= f.heal;
      if (f.stun) m.stun = true;
      if (f.root) m.root = true;
      if (f.hot) b.heal(this, f.hot * dt, f.source, true);
      if (f.dot && this.alive) b.damage(this, f.dot * dt, { kind: 'true', team: f.team ?? 1 - this.team, source: f.source || null, silent: true, dot: f.id });
      if (f.t <= 0) this.buffs.splice(i, 1);
    }
  }

  update(b, dt) {
    this.px = this.x;
    this.stateT += dt;
    this.anim.t += dt;
    if (this.anim.flash > 0) this.anim.flash -= dt;
    this.updateBuffs(b, dt);
    if (!this.alive) return;
    if (this.lifetime > 0) {
      this.lifetime -= dt;
      if (this.lifetime <= 0) { b.kill(this, { kind: 'expire' }); return; }
    }
    if (this.state === 'spawn') {
      if (this.stateT >= this.spawnTime) this.setState('idle');
      else return;
    }
    if (this.state === 'cheer') { this.anim.cheer += dt; return; }

    // Knockback and airtime.
    if (this.airborne) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.y >= 0) {
        this.y = 0; this.vy = 0; this.vx *= 0.25; this.airborne = false;
        this.staggerT = Math.max(this.staggerT, 0.35);
        b.emit('land', { unit: this, x: this.x, z: this.z });
      }
    } else if (this.vx !== 0) {
      this.x += this.vx * dt;
      this.vx *= Math.pow(0.003, dt);
      if (Math.abs(this.vx) < 5) this.vx = 0;
    }
    this.x = clamp(this.x, 8, b.width - 8);

    if (this.atkT > 0) this.atkT -= dt * this.mod.atkSpeed;
    this.anim.moving = false;
    if (this.airborne || this.mod.stun) {
      // Launched or stunned: the current swing is lost.
      if (this.staggerT > 0) this.staggerT -= dt;
      this.attacking = false;
      this.anim.atk = 0;
    } else if (this.staggerT > 0) {
      // Staggered: frozen for a moment, but a swing in progress resumes afterwards.
      this.staggerT -= dt;
    } else {
      const beh = BEHAVIORS[this.def.behavior] || (this.def.proj ? BEHAVIORS.ranged : BEHAVIORS.melee);
      beh.update(this, b, dt);
    }
    if (!this.alive) return;
    for (let i = 0; i < this.traits.length; i++) {
      const tr = TRAITS[this.traits[i]];
      if (tr && tr.update) tr.update(this, b, dt);
    }
    this.moveV = (this.x - this.px) / dt;
  }
}
