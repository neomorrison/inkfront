import { BEHAVIORS } from '../registry.js';
import { findEnemy, moveToward } from '../common.js';

// Scribe loop: walk to an ink well, fill the bottle, carry it home, repeat. Runs home when an
// enemy fighter gets close (unless the army is charging). data.phase drives the renderer pose.
function release(d) {
  if (d.well) { d.well.users = Math.max(0, d.well.users - 1); d.well = null; }
}

function chooseWell(u, b) {
  let best = null, bestScore = Infinity;
  for (const w of b.wells) {
    if (w.users >= w.slots) continue;
    if (w.team !== u.team && w.team !== -1) continue;
    const score = Math.abs(w.x - u.x) + (w.team === -1 ? 500 : 0) + w.users * 60;
    if (score < bestScore) { bestScore = score; best = w; }
  }
  if (best) best.users++;
  return best;
}

function homeX(u, b) {
  const t = b.teams[u.team];
  return t.fort.x + t.dir * (t.fort.radius + 16 + (u.jitter + 1) * 6);
}

BEHAVIORS.worker = {
  init(u) {
    u.data.phase = 'toWell';
    u.data.carry = 0;
    u.data.well = null;
    u.data.gt = 0;
    u.data.dangerT = 0;
  },
  update(u, b, dt) {
    const d = u.data;
    const team = b.teams[u.team];
    d.dangerT -= dt;
    if (d.dangerT <= 0) {
      d.dangerT = 0.3;
      d.danger = !!findEnemy(u, b, 140, { fn: (e) => e.type !== 'scribe' });
    }
    if (d.danger && d.phase !== 'flee' && team.stance !== 'charge') {
      release(d);
      d.phase = 'flee';
    }
    if (d.phase === 'flee') {
      const h = homeX(u, b);
      moveToward(u, b, h, dt, 1.15);
      if (!d.danger && Math.abs(u.x - h) < 6) d.phase = d.carry > 0 ? 'toFort' : 'toWell';
      else if (Math.abs(u.x - h) < 6 && d.carry > 0) deposit(u, b, team);
      return;
    }
    if (d.phase === 'toWell') {
      if (!d.well) d.well = chooseWell(u, b);
      if (!d.well) {
        if (moveToward(u, b, homeX(u, b) + team.dir * 30, dt)) u.facing = team.dir;
        return;
      }
      if (moveToward(u, b, d.well.x + u.jitter * 12, dt)) { d.phase = 'gather'; d.gt = 0; }
      return;
    }
    if (d.phase === 'gather') {
      d.gt += dt;
      const need = u.def.gatherTime ?? 3;
      if (d.gt >= need) {
        const base = u.def.carry ?? 20;
        const perk = u.perks.has('big_bottle') ? 1.5 : 1;
        const flag = team.mods.flags.scribeCarry || 1;
        d.carry = base * perk * flag * team.wellYield * (d.well ? d.well.yield : 1);
        release(d);
        d.phase = 'toFort';
        b.emit('gather', { unit: u, x: u.x, z: u.z, team: u.team });
      }
      return;
    }
    if (d.phase === 'toFort') {
      if (moveToward(u, b, homeX(u, b), dt)) deposit(u, b, team);
    }
  },
  onDeath(u) {
    release(u.data);
  },
};

function deposit(u, b, team) {
  const d = u.data;
  if (d.carry > 0) {
    team.ink += d.carry;
    team.stats.inkGathered += d.carry;
    b.emit('deposit', { unit: u, amount: d.carry, team: u.team, x: u.x, z: u.z });
  }
  d.carry = 0;
  d.phase = 'toWell';
}
