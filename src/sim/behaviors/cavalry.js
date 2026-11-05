// OWNER: units builder (package A)
// behavior 'cavalry' (Rider): the first hit after a run-up of 120+ px deals def.chargeMult x damage
// (lancer perk: 3.5x) and launches the target. Trample perk: a charging rider damages every
// enemy it passes once. data.charging is read by the renderer (speed lines, dust).
import { BEHAVIORS } from '../registry.js';
import { gap, meleeHit, bonusVs } from '../common.js';
import { meleeUpdate } from './melee.js';

export const RUN_UP = 120;

function chargeHit(u, b, t) {
  const d = u.data;
  if (!t || !t.alive) return;
  if (gap(u, t) > u.range + 16) return;
  if (d.run < RUN_UP) {
    meleeHit(u, b, t);
    d.run = 0;
    return;
  }
  const mult = u.perks.has('lancer') ? 3.5 : (u.def.chargeMult ?? 2.5);
  const dmg = u.dmg * u.mod.dmg * mult * bonusVs(u, t, b);
  b.damage(t, dmg, { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: u.def.chargeKb ?? 320, kbUp: t.mass <= 4 ? 520 : undefined, crit: true });
  b.emit('chargeHit', { unit: u, target: t, x: t.x, y: t.y - t.height * 0.5, z: t.z, team: u.team, mult });
  d.run = 0;
  d.trampled.clear();
}

function trample(u, b) {
  const d = u.data;
  const dmg = u.dmg * u.mod.dmg * 0.7;
  for (const e of b.byTeam[1 - u.team]) {
    if (!e.alive || !e.targetable || e.stealth || e.flying || d.trampled.has(e.id)) continue;
    if (Math.abs(e.x - u.x) > e.radius + u.radius + 10) continue;
    d.trampled.add(e.id);
    if (e === u.target) continue; // the lance handles the target
    b.damage(e, dmg * bonusVs(u, e, b), { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: 110, kbUp: 260 });
    b.emit('trample', { unit: u, x: e.x, z: e.z, team: u.team });
  }
}

BEHAVIORS.cavalry = {
  init(u) {
    u.data.run = 0;
    u.data.idleT = 0;
    u.data.charging = false;
    u.data.trampled = new Set();
  },
  update(u, b, dt) {
    const d = u.data;
    const x0 = u.x;
    meleeUpdate(u, b, dt, { onHit: chargeHit });
    const moved = Math.abs(u.x - x0);
    if (moved > 0.05 && u.anim.moving) {
      d.run += moved;
      d.idleT = 0;
    } else if (!u.attacking) {
      // Standing around loses momentum.
      d.idleT += dt;
      if (d.idleT > 0.5) { d.run = 0; d.trampled.clear(); }
    }
    const was = d.charging;
    d.charging = d.run >= RUN_UP && u.anim.moving && !u.attacking;
    if (d.charging && !was) b.emit('chargeStart', { unit: u, x: u.x, z: u.z, team: u.team });
    if (d.charging && u.perks.has('trample')) trample(u, b);
  },
};
