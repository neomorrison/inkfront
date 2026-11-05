// The Captain. Player input arrives via b.control[team] = { heroMove: -1|0|1, heroAbility: id|null }.
// While steered he goes exactly where told and fights whatever is in reach; after 5 s without
// input he rejoins the army AI. OWNER: hero builder (package E) adds Ink Slam, Inkstorm, Fury,
// skill effects and polish. Abilities live in HERO_ABILITY_IMPL.
import { BEHAVIORS, HERO_ABILITY_IMPL } from '../registry.js';
import { HERO_ABILITIES } from '../../data/hero.js';
import { findEnemy, gap, moveToward, beginAttack, updateAttack, meleeHit } from '../common.js';
import { meleeUpdate } from './melee.js';

export function heroAbilityReady(u, id) {
  const cfg = u.data.heroCfg || {};
  const ab = HERO_ABILITIES[id];
  if (!ab || !(cfg.abilities || []).includes(id)) return false;
  if (ab.fury) return (u.data.fury || 0) >= ab.fury;
  return (u.data.cds[id] || 0) <= 0;
}

BEHAVIORS.hero = {
  init(u) {
    u.data.cds = {};
    u.data.fury = 0;
    u.data.ctlIdle = 99;
    u.data.controlled = false;
    u.data.free = false;
  },
  update(u, b, dt) {
    const ctl = b.control[u.team];
    const d = u.data;
    for (const k in d.cds) if (d.cds[k] > 0) d.cds[k] = Math.max(0, d.cds[k] - dt);
    if (ctl.heroAbility) {
      const id = ctl.heroAbility;
      ctl.heroAbility = null;
      if (heroAbilityReady(u, id) && HERO_ABILITY_IMPL[id]) {
        if (HERO_ABILITY_IMPL[id].cast(b, u) !== false) {
          const ab = HERO_ABILITIES[id];
          if (ab.fury) d.fury = 0;
          else d.cds[id] = ab.cd * (d.heroCfg && d.heroCfg.cdMult ? d.heroCfg.cdMult : 1);
          b.emit('heroAbility', { unit: u, id, x: u.x, z: u.z, team: u.team });
        }
      }
    }
    if (d.busyT > 0) { d.busyT -= dt; return; } // ability animations lock movement
    const mv = ctl.heroMove || 0;
    if (mv !== 0) {
      d.controlled = true;
      d.ctlIdle = 0;
      d.free = true;
      if (u.attacking && mv !== u.facing) u.attacking = false;
      if (u.attacking) { updateAttack(u, b, dt, meleeHit); return; }
      moveToward(u, b, u.x + mv * 120, dt);
      u.facing = mv;
      return;
    }
    d.ctlIdle += dt;
    if (d.controlled && d.ctlIdle < 5) {
      if (u.attacking) { updateAttack(u, b, dt, meleeHit); return; }
      let t = findEnemy(u, b, u.range + 6);
      if (!t) {
        const ef = b.teams[1 - u.team].fort;
        if (ef.alive && gap(u, ef) <= u.range + 4) t = ef;
      }
      if (t && u.atkT <= 0) beginAttack(u, t);
      return;
    }
    d.controlled = false;
    d.free = false;
    meleeUpdate(u, b, dt);
  },
};

// Rally Cry: buff nearby allies.
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
    return true;
  },
};
