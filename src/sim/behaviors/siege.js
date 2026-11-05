// OWNER: units builder (package A)
// behavior 'siege' (Catapult): prefers the enemy fort when it is in range, otherwise lobs at the
// biggest cluster. Never fires at anything closer than def.minRange and backs off when enemies
// close in. Perks: heavier_rocks (stat), ink_pots (slowing puddle, area kind 'ink_pot'), double_load.
import { BEHAVIORS } from '../registry.js';
import { gap, moveToward, beginAttack, updateAttack, slotX, face, validTarget } from '../common.js';

const POT_TIME = 4;
const POT_RADIUS = 70;

function minRange(u) {
  return u.def.minRange ?? 140;
}

function inWindow(u, t) {
  const g = gap(u, t);
  return g >= minRange(u) && g <= u.range;
}

// Fort first, then the spot with the most (cost-weighted) enemies inside the boulder splash.
export function pickSiegeTarget(u, b) {
  const ef = b.teams[1 - u.team].fort;
  if (ef.alive && inWindow(u, ef)) return ef;
  const splash = (u.def.proj && u.def.proj.aoe) || 85;
  const list = b.byTeam[1 - u.team];
  let best = null, bestScore = 0;
  for (const e of list) {
    if (!e.alive || !e.targetable || e.stealth || (e.flying && !e.data.landed)) continue;
    if (!inWindow(u, e)) continue;
    let score = 0;
    for (const o of list) {
      if (!o.alive || o.flying || o.stealth) continue;
      if (Math.abs(o.x - e.x) - o.radius <= splash) score += 1 + (o.def.cost || 0) / 120;
    }
    score -= gap(u, e) * 0.0004; // nearest wins ties
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function addPuddle(b, x, team) {
  b.areas.push({
    kind: 'ink_pot', x, team, r: POT_RADIUS, t: POT_TIME, max: POT_TIME, alive: true,
    update(bb, dt) {
      this.t -= dt;
      if (this.t <= 0) { this.alive = false; return; }
      for (const e of bb.byTeam[1 - this.team]) {
        if (!e.alive || e.flying || e.isBoss) continue;
        if (Math.abs(e.x - this.x) - e.radius <= this.r) e.addBuff({ id: 'ink_pot', t: 0.35, speed: 0.55 });
      }
    },
  });
}

function throwRock(u, b, t) {
  if (!t || !t.alive || (t.isFort ? false : !validTarget(u, t)) || !inWindow(u, t)) {
    // The target moved into the dead zone (or away) during the wind-up: look for another.
    t = pickSiegeTarget(u, b);
    if (!t) { u.atkT = Math.min(u.atkT, 0.4); return; }
  }
  const dmg = u.dmg * u.mod.dmg;
  const extra = {};
  if (u.perks.has('ink_pots')) extra.onImpact = (bb, p) => addPuddle(bb, p.x, u.team);
  b.shoot(u, t, u.def.proj, dmg, extra);
  if (u.perks.has('double_load')) b.shoot(u, t, u.def.proj, dmg, { ...extra, spreadMult: 2.6 });
  b.emit('catapultFire', { unit: u, x: u.x, z: u.z, team: u.team });
}

BEHAVIORS.siege = {
  update(u, b, dt) {
    const team = b.teams[u.team];
    if (u.attacking) {
      updateAttack(u, b, dt, throwRock);
      return;
    }
    // Enemies too close for the arm to reach: back off toward home.
    let close = false;
    for (const e of b.byTeam[1 - u.team]) {
      if (e.alive && !e.flying && !e.stealth && gap(u, e) < minRange(u) + 20) { close = true; break; }
    }
    if (close) {
      const edge = team.fort.x + team.dir * (team.fort.radius + 30);
      const back = u.x - team.dir * 100;
      moveToward(u, b, team.dir > 0 ? Math.max(back, edge) : Math.min(back, edge), dt, 1.3);
    }
    u.retargetT -= dt;
    if (u.retargetT <= 0) {
      u.retargetT = 0.4;
      u.target = pickSiegeTarget(u, b);
    }
    const t = u.target;
    if (t && (t.isFort ? t.alive : validTarget(u, t)) && inWindow(u, t)) {
      face(u, t);
      if (u.atkT <= 0 && !close) beginAttack(u, t);
      else if (u.atkT <= 0 && close) {
        // Cornered and cannot back off any further: throw at the best thing left in range.
        const edge = team.fort.x + team.dir * (team.fort.radius + 30);
        if (Math.abs(u.x - edge) < 6) beginAttack(u, t);
      }
      return;
    }
    if (close) return;
    if (moveToward(u, b, slotX(u, b), dt)) u.facing = team.dir;
  },
};
