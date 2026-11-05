// The battle simulation. Pure logic: no DOM, no canvas, no Math.random (use this.rng).
// Runs in the browser and in Node (tools/sim.mjs). Presentation layers read state and drain
// `events` every frame; they never mutate the sim except through the public command methods:
//   requestUnit, cancelUnit, setStance, castSpell, and control[team] for the hero.
import { RNG } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { UNITS } from '../data/units.js';
import { SPELLS } from '../data/spells.js';
import { HERO_RESPAWN } from '../data/hero.js';
import { Unit } from './unit.js';
import { Fort, FORT_X } from './fort.js';
import { Projectile } from './projectile.js';
import { makeMods } from './stats.js';
import { BEHAVIORS, TRAITS, SPELL_IMPL, MODE_IMPL, MODIFIER_IMPL, PERK_IMPL, BATTLE_INIT_HOOKS } from './registry.js';
import { AICommander } from './ai.js';

export const PLAYER = 0;
export const ENEMY = 1;

export class Battle {
  // cfg: see docs/ARCHITECTURE.md "Battle config"
  constructor(cfg) {
    this.cfg = cfg;
    this.mode = cfg.mode || 'campaign';
    this.level = cfg.level || null;
    this.page = cfg.page || (this.level && this.level.page) || 'ruled';
    this.width = cfg.width || (this.level && this.level.width) || 3000;
    this.seed = cfg.seed ?? 1;
    this.rng = new RNG(this.seed);
    this.modifiers = (cfg.modifiers || (this.level && this.level.modifiers) || []).slice();
    this.time = 0;
    this.tick = 0;
    this.nextId = 1;
    this.units = [];
    this.projectiles = [];
    this.areas = []; // timed zones and spell effects: { kind, x, alive, update(b, dt), ... }
    this.events = []; // drained by presentation each frame
    this.byTeam = [[], []];
    this.blockers = [];
    this.wind = 0; // px/s^2 pushed onto every projectile
    this.accuracyMult = 1; // > 1 widens projectile spread
    this.centerYield = 1.8;
    this.result = null;
    this.bossDefeated = false;
    this.boss = null;
    this.flags = {};
    this.control = [
      { heroMove: 0, heroAbility: null },
      { heroMove: 0, heroAbility: null },
    ];
    this.teams = [this.makeTeam(0, cfg.teams[0]), this.makeTeam(1, cfg.teams[1])];
    this.modeImpl = MODE_IMPL[this.mode] || MODE_IMPL.campaign;

    for (const id of this.modifiers) MODIFIER_IMPL[id]?.init?.(this);
    for (const hook of BATTLE_INIT_HOOKS) hook(this);
    this.wells = this.makeWells();
    this.modeImpl?.init?.(this);
    for (const t of this.teams) {
      for (const p of t.perks) PERK_IMPL[p]?.apply?.(this, t.index);
      if (t.cfg.hero) this.spawnHero(t);
      const su = t.cfg.startUnits;
      if (su) for (const id in su) for (let i = 0; i < su[id]; i++) {
        const x = t.fort.x + t.dir * (300 + this.rng.range(0, 260));
        this.spawnUnit(t.index, id, { x, instant: true });
      }
      if (t.cfg.ai) t.ai = new AICommander(this, t.index, t.cfg.ai);
    }
    this.emit('start', {});
  }

  makeTeam(index, c) {
    const dir = index === 0 ? 1 : -1;
    const fortX = index === 0 ? FORT_X : this.width - FORT_X;
    const team = {
      index, dir, cfg: c,
      faction: c.faction || (index === 0 ? 'ink' : 'red'),
      ink: c.startInk ?? 200,
      inkCap: c.inkCap ?? 3000,
      income: c.income ?? 2.5,
      popCap: c.popCap ?? 20,
      scribeCap: c.scribeCap ?? 4,
      wellYield: c.wellYield ?? 1,
      unitLevels: c.unitLevels || {},
      roster: c.roster || [],
      queues: {},
      stance: 'defend',
      flagX: fortX + dir * 520,
      spells: [],
      fort: null,
      hero: null,
      heroRespawnT: 0,
      mods: makeMods(c.mods),
      perks: (c.perks || []).slice(),
      pop: 0,
      scribes: 0,
      spawnCount: 0,
      stats: { kills: 0, lost: 0, spawned: 0, inkGathered: 0, inkSpent: 0, dmgDealt: 0, healed: 0, heroKills: 0, spellsCast: 0, launches: 0, scribeKills: 0, maxArmy: 0 },
      ai: null,
    };
    team.fort = new Fort(this, index, fortX, c.fort || {});
    const cdMult = team.mods.spellCd;
    team.spells = (c.spells || []).filter((s) => SPELLS[s.id]).map((s) => {
      const maxCd = SPELLS[s.id].cd * cdMult;
      return { id: s.id, level: s.level || 1, cd: maxCd * 0.5, maxCd };
    });
    return team;
  }

  makeWells() {
    const W = this.width;
    const wells = [];
    const mk = (x, team, yieldMult, slots) => wells.push({ id: wells.length, x, team, yield: yieldMult, slots, users: 0 });
    mk(FORT_X + 200, 0, 1, 2);
    mk(FORT_X + 340, 0, 1, 2);
    mk(W - FORT_X - 200, 1, 1, 2);
    mk(W - FORT_X - 340, 1, 1, 2);
    mk(W / 2, -1, this.centerYield, 3);
    return wells;
  }

  emit(type, data) {
    data.type = type;
    data.t = this.time;
    this.events.push(data);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ------------------------------------------------------------------ commands
  unitCost(teamIdx, id) {
    const t = this.teams[teamIdx];
    const bu = t.mods.byUnit[id];
    return Math.max(0, Math.round(UNITS[id].cost * t.mods.cost * ((bu && bu.cost) ?? 1)));
  }

  buildTime(teamIdx, id) {
    const t = this.teams[teamIdx];
    const bu = t.mods.byUnit[id];
    return Math.max(0.3, UNITS[id].build * t.mods.build * ((bu && bu.build) ?? 1));
  }

  // -> { ok, reason } reason: 'locked' | 'ink' | 'pop' | 'scribes' | 'over'
  canRequest(teamIdx, id) {
    const t = this.teams[teamIdx];
    const def = UNITS[id];
    if (this.result) return { ok: false, reason: 'over' };
    if (!def || !t.roster.includes(id)) return { ok: false, reason: 'locked' };
    if (t.ink < this.unitCost(teamIdx, id)) return { ok: false, reason: 'ink' };
    if (id === 'scribe' && t.scribes >= t.scribeCap) return { ok: false, reason: 'scribes' };
    if (t.pop + (def.pop || 0) > t.popCap + 1e-6) return { ok: false, reason: 'pop' };
    return { ok: true };
  }

  requestUnit(teamIdx, id) {
    const c = this.canRequest(teamIdx, id);
    if (!c.ok) {
      this.emit('denied', { team: teamIdx, id, reason: c.reason });
      return false;
    }
    const t = this.teams[teamIdx];
    const cost = this.unitCost(teamIdx, id);
    t.ink -= cost;
    t.stats.inkSpent += cost;
    const q = t.queues[id] || (t.queues[id] = { count: 0, t: 0, paid: [] });
    q.count++;
    q.paid.push(cost);
    t.pop += UNITS[id].pop || 0;
    if (id === 'scribe') t.scribes++;
    this.emit('queued', { team: teamIdx, id });
    return true;
  }

  cancelUnit(teamIdx, id) {
    const t = this.teams[teamIdx];
    const q = t.queues[id];
    if (!q || q.count <= 0) return false;
    q.count--;
    const refund = q.paid.pop() ?? this.unitCost(teamIdx, id);
    t.ink += refund;
    t.stats.inkSpent -= refund;
    if (q.count === 0) q.t = 0;
    this.emit('canceled', { team: teamIdx, id });
    return true;
  }

  setStance(teamIdx, stance, x) {
    const t = this.teams[teamIdx];
    if (stance === 'hold' && x != null) t.flagX = clamp(x, 80, this.width - 80);
    if (t.stance === stance && stance !== 'hold') return;
    t.stance = stance;
    for (const u of this.units) if (u.team === teamIdx) u.retargetT = 0;
    this.emit('stance', { team: teamIdx, stance, x: t.flagX });
  }

  castSpell(teamIdx, slot, x) {
    const t = this.teams[teamIdx];
    const s = t.spells[slot];
    if (!s || s.cd > 0 || this.result) return false;
    const impl = SPELL_IMPL[s.id];
    if (!impl) return false;
    const ok = impl.cast(this, teamIdx, clamp(x ?? this.width / 2, 20, this.width - 20), s.level, SPELLS[s.id]);
    if (ok === false) return false;
    s.cd = s.maxCd;
    t.stats.spellsCast++;
    this.emit('spell', { team: teamIdx, id: s.id, x, level: s.level });
    return true;
  }

  // ------------------------------------------------------------------ spawning
  spawnUnit(teamIdx, id, o = {}) {
    const def = UNITS[id];
    if (!def) throw new Error('Unknown unit ' + id);
    const t = this.teams[teamIdx];
    const u = new Unit(this, teamIdx, def, o);
    const beh = BEHAVIORS[def.behavior];
    if (beh && beh.init) beh.init(u, this);
    for (const tr of u.traits) TRAITS[tr]?.init?.(u, this);
    this.units.push(u);
    if (!u.summoned && !u.isHero && !u.isBoss) {
      t.stats.spawned++;
      t.spawnCount++;
    }
    this.emit('spawn', { unit: u, team: teamIdx, id, x: u.x, z: u.z, instant: !!o.instant });
    return u;
  }

  spawnHero(t) {
    const h = t.cfg.hero;
    const u = this.spawnUnit(t.index, h.id || 'captain', {
      hpMult: (h.hpMult ?? 1) * t.mods.heroHp, dmgMult: (h.dmgMult ?? 1) * t.mods.heroDmg, level: 1, spawnTime: 0.8,
    });
    u.data.heroCfg = h;
    t.hero = u;
    return u;
  }

  // ------------------------------------------------------------------ combat
  // info: { source, team, kind: melee|pierce|blast|magic|true, dir, kb, kbUp, fortMult, silent, crit }
  damage(t, amount, info = {}) {
    if (!t || !t.alive || amount <= 0) return 0;
    if (this.result && !info.force) return 0;
    if (t.isFort) return this.damageFort(t, amount, info);
    const kind = info.kind || 'melee';
    let dmg = amount;
    const armor = clamp(t.armor + t.mod.armor, 0, 0.9);
    if (kind === 'melee' || kind === 'pierce') dmg *= 1 - armor;
    else if (kind === 'blast') dmg *= 1 - armor * 0.5;
    dmg *= t.mod.dmgTaken;
    for (let i = 0; i < t.traits.length; i++) {
      const h = TRAITS[t.traits[i]];
      if (h && h.onDamaged) dmg = h.onDamaged(t, this, dmg, info);
    }
    if (!(dmg > 0)) return 0;
    t.hp -= dmg;
    t.anim.flash = 0.12;
    t.lastHitBy = info.source || null;
    t.lastHitT = this.time;
    const src = info.source;
    if (src && src.team !== t.team) this.teams[src.team].stats.dmgDealt += dmg;
    if (src && src.alive && src.traits) for (let i = 0; i < src.traits.length; i++) {
      const h = TRAITS[src.traits[i]];
      if (h && h.onHit) h.onHit(src, this, t, info, dmg);
    }
    if (src && src.team !== t.team) {
      const ls = this.teams[src.team].mods.lifesteal;
      if (ls > 0 && kind === 'melee' && src.alive) this.heal(src, dmg * ls, src, true);
    }
    if (!info.silent) {
      this.emit('hit', { target: t, amount: dmg, kind, x: t.x, y: t.y - t.height * 0.6, z: t.z, team: t.team, source: src, crit: !!info.crit });
    }
    if (info.kb && !t.immuneKb) this.knockback(t, info.kb, info.dir ?? -t.facing, info.kbUp, src);
    if (t.hp <= 0) this.kill(t, info);
    return dmg;
  }

  damageFort(f, amount, info) {
    if (!f.alive) return 0;
    if (f.invulnerable) {
      this.emit('immune', { x: f.x, team: f.team });
      return 0;
    }
    const dmg = amount * (1 - f.armor) * (f.mod.dmgTaken ?? 1);
    f.hp -= dmg;
    f.lastHitT = this.time;
    if (info.source && info.source.team !== f.team) this.teams[info.source.team].stats.dmgDealt += dmg;
    this.emit('fortHit', { fort: f, amount: dmg, team: f.team, x: f.x, kind: info.kind || 'melee' });
    if (f.hp <= 0) {
      f.hp = 0;
      f.alive = false;
      this.emit('fortDestroyed', { fort: f, team: f.team, x: f.x });
    }
    return dmg;
  }

  knockback(t, power, dir, up, src) {
    const v = power / Math.max(0.5, t.mass);
    if (v < 25) return;
    t.vx += dir * v * 1.3;
    if (v > 110 || up) {
      t.vy = -(up ?? Math.min(900, v * 1.7));
      t.y = Math.min(t.y, -1);
      t.airborne = true;
      t.attacking = false;
      if (src && src.team !== t.team) this.teams[src.team].stats.launches++;
      this.emit('launch', { unit: t, x: t.x, z: t.z });
    } else if (v >= 60) {
      t.staggerT = Math.max(t.staggerT, Math.min(0.35, v / 400));
    }
  }

  heal(t, amount, source, silent) {
    if (!t || !t.alive || t.isFort || amount <= 0) return 0;
    const h = Math.min(t.maxHp - t.hp, amount * t.mod.heal);
    if (h <= 0) return 0;
    t.hp += h;
    if (source) this.teams[source.team].stats.healed += h;
    if (!silent) this.emit('heal', { target: t, amount: h, x: t.x, y: t.y - t.height, z: t.z, team: t.team });
    return h;
  }

  kill(t, info = {}) {
    if (!t.alive) return;
    for (let i = 0; i < t.traits.length; i++) {
      const h = TRAITS[t.traits[i]];
      if (h && h.onLethal && h.onLethal(t, this, info)) return;
    }
    t.alive = false;
    t.hp = 0;
    t.state = 'dead';
    t.attacking = false;
    const team = this.teams[t.team];
    if (info.kind !== 'expire') team.stats.lost++;
    const killer = info.source;
    if (killer && killer.team !== t.team) {
      const kt = this.teams[killer.team];
      kt.stats.kills++;
      killer.kills++;
      if (killer.isHero) kt.stats.heroKills++;
      if (t.type === 'scribe') kt.stats.scribeKills++;
    }
    for (let i = 0; i < t.traits.length; i++) TRAITS[t.traits[i]]?.onDeath?.(t, this, info);
    BEHAVIORS[t.def.behavior]?.onDeath?.(t, this, info);
    if (t.isHero && team.hero === t) {
      team.hero = null;
      team.heroRespawnT = (team.cfg.hero && team.cfg.hero.respawn) ?? HERO_RESPAWN;
    }
    if (t.isBoss) {
      this.bossDefeated = true;
      this.emit('bossDefeated', { unit: t, id: t.type, x: t.x });
    }
    const dir = info.dir ?? (killer ? Math.sign(t.x - killer.x) || -t.facing : -t.facing);
    this.emit('death', { unit: t, killer, kind: info.kind || 'melee', dir, power: info.kb || 0, x: t.x, y: t.y, z: t.z, team: t.team, id: t.type });
  }

  // Area damage around (x, y). info: { team, source, kb, fortMult, friendlyFire (0..1), fx }
  explode(x, y, radius, dmg, info) {
    const ff = info.friendlyFire || 0;
    for (const e of this.units) {
      if (!e.alive || !e.targetable) continue;
      const enemy = e.team !== info.team;
      if (!enemy && !ff) continue;
      const d = Math.abs(e.x - x) - e.radius;
      if (d > radius) continue;
      if (e.flying && y > -60 && !e.data.landed && !e.isBoss) continue; // spells always reach flying bosses
      const fall = 1 - 0.5 * clamp(d / radius, 0, 1);
      this.damage(e, dmg * fall * (enemy ? 1 : ff), {
        source: info.source, team: info.team, kind: 'blast', dir: Math.sign(e.x - x) || 1, kb: (info.kb || 0) * fall, friendly: !enemy,
      });
    }
    const f = this.teams[1 - info.team].fort;
    if (f.alive && Math.abs(f.x - x) - f.radius <= radius) this.damageFort(f, dmg * (info.fortMult || 1), { source: info.source, kind: 'blast' });
    for (const w of this.blockers) if (w.alive && w.team !== info.team && Math.abs(w.x - x) - w.radius <= radius) this.damage(w, dmg, { source: info.source, team: info.team, kind: 'blast' });
    this.emit('explode', { x, y, radius, team: info.team, fx: info.fx || 'ink' });
  }

  // Melee splash in front of a unit (Colossus, Golem, bosses).
  meleeSplash(u, radius, dmg, frontal, extra = {}) {
    const hitX = u.x + u.facing * (u.radius + radius * 0.5);
    let n = 0;
    for (const e of this.byTeam[1 - u.team]) {
      if (!e.alive || !e.targetable || (e.flying && !e.data.landed)) continue;
      const dx = e.x - u.x;
      if (frontal && Math.sign(dx) !== u.facing && Math.abs(dx) > u.radius + 10) continue;
      if (Math.abs(e.x - hitX) - e.radius > radius * 0.75 && Math.abs(dx) - e.radius - u.radius > u.range) continue;
      let m = 1;
      const bn = u.def.bonus;
      if (bn) for (const tag in bn) if (e.tags.has(tag)) m = Math.max(m, bn[tag]);
      this.damage(e, dmg * m, { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: extra.kb ?? u.kb });
      if (extra.stun && e.alive) e.addBuff({ id: 'stun', t: extra.stun, stun: true });
      n++;
    }
    const f = this.teams[1 - u.team].fort;
    if (f.alive && Math.abs(f.x - u.x) - f.radius - u.radius <= u.range + 10) this.damageFort(f, dmg, { source: u, kind: 'melee' });
    this.emit('slam', { unit: u, x: hitX, radius, team: u.team, z: u.z });
    return n;
  }

  // Fire a ballistic projectile from unit u at target t. spec = def.proj; extra overrides fields.
  shoot(u, t, spec, dmg, extra = {}) {
    const sx = u.x + u.facing * 10 * u.scale;
    const sy = u.y - 44 * u.scale;
    const ty = t.isFort ? -70 : t.y - t.height * 0.55;
    const speed = spec.speed || 600;
    const g = spec.gravity ?? 900;
    const T = clamp(Math.abs(t.x - sx) / speed, 0.15, 2.4) * (1 + (spec.arc ?? 0.5) * 0.5);
    let tx = t.x + (t.isFort ? 0 : (t.moveV || 0) * T * 0.9);
    const spread = (spec.spread || 0) * this.accuracyMult * (extra.spreadMult ?? 1);
    tx += this.rng.range(-1, 1) * spread;
    const p = new Projectile({
      x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T, g,
      team: u.team, dmg, kind: spec.kind || 'arrow', dmgKind: spec.dmgKind || 'pierce', aoe: spec.aoe || 0,
      fortMult: u.def.fortMult || 1, source: u, bonus: u.def.bonus || null, kb: u.kb, z: u.z,
      ...extra,
    });
    delete p.spreadMult;
    this.projectiles.push(p);
    this.emit('shoot', { unit: u, kind: p.kind, x: sx, y: sy, z: u.z, team: u.team });
    return p;
  }

  // Straight homing bolt (casters).
  bolt(u, t, dmg, extra = {}) {
    const sx = u.x + u.facing * 12 * u.scale, sy = u.y - 50 * u.scale;
    const ty = t.isFort ? -70 : t.y - t.height * 0.55;
    const d = Math.hypot(t.x - sx, ty - sy) || 1;
    const sp = extra.speed || 520;
    const p = new Projectile({
      x: sx, y: sy, vx: ((t.x - sx) / d) * sp, vy: ((ty - sy) / d) * sp, g: 0, homing: t.isFort ? null : t,
      team: u.team, dmg, kind: extra.kind || 'bolt', dmgKind: 'magic', source: u, kb: u.kb, z: u.z, life: 3, ...extra,
    });
    this.projectiles.push(p);
    this.emit('shoot', { unit: u, kind: p.kind, x: sx, y: sy, z: u.z, team: u.team });
    return p;
  }

  // ------------------------------------------------------------------ loop
  index() {
    const a = this.byTeam[0], c = this.byTeam[1];
    a.length = 0; c.length = 0;
    this.blockers.length = 0;
    const pop = [0, 0], scribes = [0, 0];
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.targetable) (u.team === 0 ? a : c).push(u);
      if (u.blocker) this.blockers.push(u);
      if (!u.isHero && !u.isBoss) pop[u.team] += u.def.pop || 0;
      if (u.type === 'scribe') scribes[u.team]++;
    }
    for (const t of this.teams) {
      let qp = 0, qs = 0;
      for (const id in t.queues) {
        qp += t.queues[id].count * (UNITS[id].pop || 0);
        if (id === 'scribe') qs += t.queues[id].count;
      }
      t.pop = pop[t.index] + qp;
      t.scribes = scribes[t.index] + qs;
      const army = pop[t.index] - scribes[t.index];
      if (army > t.stats.maxArmy) t.stats.maxArmy = army;
    }
  }

  updateTeam(t, dt) {
    t.ink += t.income * dt;
    for (const id in t.queues) {
      const q = t.queues[id];
      if (q.count <= 0) { q.t = 0; continue; }
      q.t += dt;
      const bt = this.buildTime(t.index, id);
      if (q.t >= bt) {
        q.t = 0;
        q.count--;
        q.paid.shift();
        this.spawnUnit(t.index, id);
      }
    }
    for (const s of t.spells) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    if (t.cfg.hero && !t.hero) {
      t.heroRespawnT -= dt;
      if (t.heroRespawnT <= 0) this.spawnHero(t);
    }
    for (const p of t.perks) PERK_IMPL[p]?.update?.(this, t.index, dt);
  }

  update(dt) {
    this.time += dt;
    this.tick++;
    if (this.result) {
      this.index();
      for (const u of this.units) if (u.alive) u.update(this, dt);
      for (const p of this.projectiles) p.update(this, dt);
      this.cleanup();
      return;
    }
    this.index();
    for (const t of this.teams) {
      this.updateTeam(t, dt);
      if (t.ink > t.inkCap) t.ink = t.inkCap;
    }
    for (const id of this.modifiers) MODIFIER_IMPL[id]?.update?.(this, dt);
    this.modeImpl?.update?.(this, dt);
    for (const t of this.teams) if (t.ai) t.ai.update(dt);
    // Alternate iteration order so neither army always moves (and strikes) first.
    const n = this.units.length;
    if (this.tick & 1) {
      for (let i = 0; i < n; i++) { const u = this.units[i]; if (u.alive) u.update(this, dt); }
    } else {
      for (let i = n - 1; i >= 0; i--) { const u = this.units[i]; if (u.alive) u.update(this, dt); }
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (p.alive) p.update(this, dt);
    }
    for (let i = 0; i < this.areas.length; i++) {
      const a = this.areas[i];
      if (a.alive) a.update(this, dt);
    }
    this.teams[0].fort.update(this, dt);
    this.teams[1].fort.update(this, dt);
    this.cleanup();
    const r = this.modeImpl ? this.modeImpl.check(this) : null;
    if (r) this.end(r.winner, r.reason);
  }

  cleanup() {
    if (this.tick % 2 === 0) {
      this.units = this.units.filter((u) => u.alive);
      this.projectiles = this.projectiles.filter((p) => p.alive);
      this.areas = this.areas.filter((a) => a.alive);
    }
  }

  end(winner, reason) {
    if (this.result) return;
    const f0 = this.teams[0].fort;
    this.result = {
      winner, reason, time: this.time,
      fortHpPct: f0.maxHp > 0 ? f0.hp / f0.maxHp : 0,
      fortDamaged: f0.hp < f0.maxHp,
      stats: { ...this.teams[0].stats },
      enemyStats: { ...this.teams[1].stats },
      bossDefeated: this.bossDefeated,
      boss: this.boss ? this.boss.type : null,
    };
    for (const u of this.units) {
      if (!u.alive) continue;
      u.attacking = false;
      u.anim.atk = 0;
      if (u.team === winner) u.setState('cheer');
    }
    this.emit('end', { result: this.result, winner });
  }
}
