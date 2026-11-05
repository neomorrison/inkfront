// The Captain. Player input arrives via b.control[team] = { heroMove: -1|0|1, heroAbility: id|null }.
// While steered he goes exactly where told and fights whatever is in reach; after 5 s without
// input he rejoins the army AI. Owns: 3-hit combo, Fury, Rally Cry, Ink Slam, Inkstorm,
// Inspire aura and Ink Thirst. Pure sim: all randomness would come from b.rng (none needed).
//
// Events emitted: heroAbility { unit id phase('start'|'land'|'end') x z team radius? dur? },
// heroHit { unit combo x z team }, heroStormTick { unit x z team radius }, plus the generic 'slam'.
import { clamp } from '../../core/util.js';
import { BEHAVIORS, HERO_ABILITY_IMPL, TRAITS } from '../registry.js';
import { HERO_ABILITIES, HERO_COMBO, HERO_FURY, HERO_GROWTH, HERO_INSPIRE } from '../../data/hero.js';
import { findEnemy, gap, moveToward, beginAttack, updateAttack, bonusVs, clampToBlockers } from '../common.js';
import { GRAVITY } from '../unit.js';
import { meleeUpdate } from './melee.js';

const SWING_STYLE = [null, 'slash', 'hero_cut2', 'hero_heavy'];

export function heroAbilityReady(u, id) {
  const cfg = u.data.heroCfg || {};
  const ab = HERO_ABILITIES[id];
  if (!ab || !(cfg.abilities || []).includes(id)) return false;
  if (u.airborne || u.data.storm) return false;
  if (ab.fury) return (u.data.fury || 0) >= ab.fury;
  return (u.data.cds[id] || 0) <= 0;
}

// Ratio of the Captain's current damage to his base damage (level, skills, buffs).
function dmgScale(u) {
  return (u.dmg * u.mod.dmg) / Math.max(1, u.def.dmg);
}

// Fury is counted in level-1 numbers: hero level scales damage and health, and the meter must
// not fill faster just because the Captain grew (so a level 30 Captain still needs a real fight).
function addFury(u, amount, growth) {
  const d = u.data;
  d.fury = Math.min(HERO_FURY.max, (d.fury || 0) + (amount / growth) * ((d.heroCfg && d.heroCfg.furyRate) || 1));
}
const dealtGrowth = (u) => 1 + HERO_GROWTH.dmg * (((u.data.heroCfg && u.data.heroCfg.level) || 1) - 1);
const takenGrowth = (u) => 1 + HERO_GROWTH.hp * (((u.data.heroCfg && u.data.heroCfg.level) || 1) - 1);

// Credit damage the Captain dealt inside fn(): Fury and Ink Thirst. Measured through team
// stats so splash hits, forts and storm ticks are all covered.
function track(u, b, fn) {
  const st = b.teams[u.team].stats;
  const before = st.dmgDealt;
  fn();
  const dealt = st.dmgDealt - before;
  if (dealt > 0) {
    const d = u.data;
    if (!d.storm) addFury(u, dealt * HERO_FURY.perDealt, dealtGrowth(u));
    const ls = (d.heroCfg && d.heroCfg.lifesteal) || 0;
    if (ls > 0 && u.alive) b.heal(u, dealt * ls, u, dealt * ls < 2);
  }
  return dealt;
}

// ---------------------------------------------------------------- combo
function nextSwing(u, b) {
  const d = u.data;
  return b.time - d.lastHit < HERO_COMBO.window ? (d.combo % 3) + 1 : 1;
}

// Style and wind-up of the swing that is about to start (the heavy one is slower).
function prepSwing(u, b) {
  const n = nextSwing(u, b);
  u.anim.style = SWING_STYLE[n];
  u.windup = n === 3 ? u.data.windup0 * HERO_COMBO.heavyWindup : u.data.windup0;
}

function startSwing(u, b, t) {
  prepSwing(u, b);
  beginAttack(u, t);
}

function swingHit(u, b, t) {
  if (!t || !t.alive || gap(u, t) > u.range + 16) return;
  const d = u.data;
  const idx = nextSwing(u, b);
  d.combo = idx;
  d.lastHit = b.time;
  const dmg = u.dmg * u.mod.dmg;
  track(u, b, () => {
    if (idx === 3) {
      b.meleeSplash(u, HERO_COMBO.heavyRadius, dmg * HERO_COMBO.heavyMult, true, { kb: u.kb * HERO_COMBO.heavyKb });
    } else {
      b.damage(t, dmg * bonusVs(u, t, b), { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: u.kb });
    }
  });
  // Swings 1 and 2 chain quickly, the heavy one needs a breath afterwards.
  u.atkT = idx === 3 ? Math.max(0, u.atkCd * 1.15 - u.windup) : Math.max(0, u.atkCd * 0.8 - u.windup);
  b.emit('heroHit', { unit: u, combo: idx, x: u.x + u.facing * 30, z: u.z, team: u.team });
}

// Enemy (or fort) within swing reach; dir 0 = either side, otherwise only that side.
function inReach(u, b, dir) {
  let t = findEnemy(u, b, u.range + 6);
  if (t && dir && Math.sign(t.x - u.x) !== dir && Math.abs(t.x - u.x) > u.radius) t = null;
  if (!t) {
    const ef = b.teams[1 - u.team].fort;
    if (ef.alive && gap(u, ef) <= u.range + 4 && (!dir || Math.sign(ef.x - u.x) === dir)) t = ef;
  }
  return t;
}

// ---------------------------------------------------------------- scripted poses (rally shout, slam landing)
function playPose(u, style, dur) {
  const d = u.data;
  d.busyT = dur;
  d.busyMax = dur;
  u.attacking = true;
  u.atkElapsed = 0;
  u.anim.style = style;
  u.anim.atk = 0;
}

function endPose(u) {
  u.data.busyT = 0;
  u.attacking = false;
  u.anim.atk = 0;
}

// ---------------------------------------------------------------- the behavior
BEHAVIORS.hero = {
  init(u) {
    const d = u.data;
    d.cds = {};
    d.fury = HERO_FURY.start || 0;
    d.ctlIdle = 99;
    d.controlled = false;
    d.free = false;
    d.combo = 0;
    d.lastHit = -99;
    d.windup0 = u.windup;
    d.inspireT = 0;
    d.lastHp = u.hp;
    d.storm = null;
    d.leap = null;
    d.busyT = 0;
    u.traits.push('heroLeap');
  },
  update(u, b, dt) {
    const ctl = b.control[u.team];
    const d = u.data;
    const cfg = d.heroCfg || {};
    for (const k in d.cds) if (d.cds[k] > 0) d.cds[k] = Math.max(0, d.cds[k] - dt);

    // Fury from damage taken.
    if (d.lastHp > u.hp && !d.storm) addFury(u, (d.lastHp - u.hp) * HERO_FURY.perTaken, takenGrowth(u));
    d.lastHp = u.hp;

    // Inspire: passive aura.
    if (cfg.inspire > 0 && (d.inspireT -= dt) <= 0) {
      d.inspireT = HERO_INSPIRE.interval;
      for (const a of b.byTeam[u.team]) {
        if (a.alive && Math.abs(a.x - u.x) <= HERO_INSPIRE.radius) a.addBuff({ id: 'inspire', t: HERO_INSPIRE.interval + 0.3, dmg: 1 + cfg.inspire });
      }
    }

    if (ctl.heroAbility) {
      const id = ctl.heroAbility;
      ctl.heroAbility = null;
      if (heroAbilityReady(u, id) && HERO_ABILITY_IMPL[id] && d.busyT <= 0) {
        if (HERO_ABILITY_IMPL[id].cast(b, u) !== false) {
          const ab = HERO_ABILITIES[id];
          if (ab.fury) d.fury = 0;
          else d.cds[id] = ab.cd * (cfg.cdMult || 1);
          d.controlled = true;
          d.ctlIdle = 0;
          d.free = true;
          b.emit('heroAbility', { unit: u, id, phase: 'start', x: u.x, z: u.z, team: u.team, radius: d.fxRadius || 0, dur: d.fxDur || 0 });
          d.fxRadius = 0;
          d.fxDur = 0;
        }
      }
    }

    if (d.storm) { stormStep(u, b, dt, ctl.heroMove || 0); return; }
    if (d.busyT > 0) { // ability animations lock movement
      d.busyT -= dt;
      u.anim.atk = clamp(1 - d.busyT / d.busyMax, 0, 1);
      if (d.busyT <= 0) endPose(u);
      return;
    }

    const mv = ctl.heroMove || 0;
    if (mv !== 0) {
      d.controlled = true;
      d.ctlIdle = 0;
      d.free = true;
      if (u.attacking && mv !== u.facing) { u.attacking = false; u.anim.atk = 0; }
      if (u.attacking) {
        // Keep walking (slowly) through the swing: the Captain never feels glued to the ground.
        updateAttack(u, b, dt, swingHit);
        moveToward(u, b, u.x + mv * 120, dt, HERO_COMBO.steerAttackSpeed);
        u.facing = mv;
        return;
      }
      if (u.atkT <= 0) {
        const t = inReach(u, b, mv);
        if (t) startSwing(u, b, t);
      } else prepSwing(u, b);
      moveToward(u, b, u.x + mv * 120, dt);
      u.facing = mv;
      return;
    }
    d.ctlIdle += dt;
    if (d.controlled && d.ctlIdle < 5) {
      if (u.attacking) { updateAttack(u, b, dt, swingHit); return; }
      prepSwing(u, b);
      const t = inReach(u, b, 0);
      if (t && u.atkT <= 0) startSwing(u, b, t);
      return;
    }
    d.controlled = false;
    d.free = false;
    if (!u.attacking) prepSwing(u, b);
    meleeUpdate(u, b, dt, { onHit: swingHit });
  },
};

// ---------------------------------------------------------------- Rally Cry
HERO_ABILITY_IMPL.rally = {
  cast(b, u) {
    const ab = HERO_ABILITIES.rally;
    const cfg = u.data.heroCfg || {};
    const radius = ab.radius + (cfg.rallyRadius || 0);
    const dur = ab.dur + (cfg.rallyDur || 0);
    for (const a of b.units) {
      if (!a.alive || a.team !== u.team || Math.abs(a.x - u.x) > radius) continue;
      a.addBuff({ id: 'rally', t: dur, dmg: ab.dmg, speed: ab.speed });
    }
    u.attacking = false;
    playPose(u, 'hero_rally', 0.38);
    u.data.fxRadius = radius;
    u.data.fxDur = dur;
    return true;
  },
};

// ---------------------------------------------------------------- Ink Slam
// The leap uses the normal airborne physics (so the pose, gravity and shadows just work);
// the heroLeap trait below notices the landing and does the damage.
HERO_ABILITY_IMPL.slam = {
  cast(b, u) {
    const ab = HERO_ABILITIES.slam;
    const dir = u.facing || u.dir;
    const tx = clampToBlockers(u, b, clamp(u.x + dir * ab.leap, 30, b.width - 30));
    u.attacking = false;
    u.anim.atk = 0;
    u.airborne = true;
    u.y = -1;
    u.vy = -GRAVITY * ab.air * 0.5;
    u.vx = (tx - u.x) / ab.air;
    u.facing = dir;
    u.data.leap = { tx };
    return true;
  },
};

function landSlam(u, b) {
  const d = u.data;
  const ab = HERO_ABILITIES.slam;
  d.leap = null;
  u.vx = 0;
  u.staggerT = 0;
  const dmg = ab.dmg * dmgScale(u);
  track(u, b, () => {
    for (const e of b.byTeam[1 - u.team]) {
      if (!e.alive || !e.targetable || (e.flying && !e.data.landed)) continue;
      if (Math.abs(e.x - u.x) - e.radius > ab.radius) continue;
      const dir = Math.sign(e.x - u.x) || u.facing;
      b.damage(e, dmg * bonusVs(u, e, b), { source: u, team: u.team, kind: 'melee', dir, kb: ab.kb });
      if (e.alive && !e.immuneStun) e.addBuff({ id: 'stun', t: ab.stun, stun: true });
    }
    const f = b.teams[1 - u.team].fort;
    if (f.alive && Math.abs(f.x - u.x) - f.radius <= ab.radius) b.damageFort(f, dmg, { source: u, kind: 'melee' });
  });
  b.emit('slam', { unit: u, x: u.x, radius: ab.radius, team: u.team, z: u.z });
  b.emit('heroAbility', { unit: u, id: 'slam', phase: 'land', x: u.x, z: u.z, team: u.team, radius: ab.radius });
  playPose(u, 'hero_land', 0.28);
}

TRAITS.heroLeap = {
  update(u, b) {
    if (u.data.leap && !u.airborne) landSlam(u, b);
  },
};

// ---------------------------------------------------------------- Inkstorm
HERO_ABILITY_IMPL.inkstorm = {
  cast(b, u) {
    const ab = HERO_ABILITIES.inkstorm;
    const cfg = u.data.heroCfg || {};
    const dur = ab.dur + (cfg.stormDur || 0);
    u.data.storm = { t: dur, dur, tick: 0.05 };
    u.attacking = true;
    u.anim.style = 'hero_spin';
    u.immuneKb = true;
    u.immuneStun = true;
    u.removeBuffs((f) => f.stun || f.root);
    u.data.fxRadius = ab.radius;
    u.data.fxDur = dur;
    return true;
  },
};

function stormStep(u, b, dt, mv) {
  const d = u.data;
  const ab = HERO_ABILITIES.inkstorm;
  const s = d.storm;
  s.t -= dt;
  s.tick -= dt;
  if (mv !== 0) {
    d.controlled = true;
    d.ctlIdle = 0;
    moveToward(u, b, u.x + mv * 120, dt, ab.speedMul);
    u.facing = mv;
  }
  u.attacking = true;
  u.anim.style = 'hero_spin';
  u.anim.atk = (b.time * 2.2) % 1;
  if (s.tick <= 0) {
    s.tick += ab.tick;
    const dmg = ab.dps * ab.tick * dmgScale(u);
    track(u, b, () => {
      for (const e of b.byTeam[1 - u.team]) {
        if (!e.alive || !e.targetable || (e.flying && !e.data.landed)) continue;
        if (Math.abs(e.x - u.x) - e.radius > ab.radius) continue;
        b.damage(e, dmg * bonusVs(u, e, b), { source: u, team: u.team, kind: 'melee', dir: Math.sign(e.x - u.x) || u.facing, kb: 70 });
      }
      const f = b.teams[1 - u.team].fort;
      if (f.alive && Math.abs(f.x - u.x) - f.radius <= ab.radius) b.damageFort(f, dmg * 0.5, { source: u, kind: 'melee' });
    });
    b.emit('heroStormTick', { unit: u, x: u.x, z: u.z, team: u.team, radius: ab.radius });
  }
  if (s.t <= 0) {
    d.storm = null;
    u.immuneKb = false;
    u.immuneStun = false;
    u.attacking = false;
    u.anim.atk = 0;
    u.atkT = Math.max(u.atkT, 0.3);
    b.emit('heroAbility', { unit: u, id: 'inkstorm', phase: 'end', x: u.x, z: u.z, team: u.team });
  }
}
