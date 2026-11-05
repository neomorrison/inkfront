// OWNER: units builder (package A)
// behavior 'bomber': finds the biggest cluster of enemies, runs at it and blows up on contact
// (friendly fire 50%). Also blows up at half power when killed (TRAITS.deathBlast).
// Perks: bigger_bombs (+25% radius), shrapnel (+30% damage), cluster (3 mini bombs after the blast).
// Emits bomberBlast { kills, friendlyKills, x, team, unit } once the blast has resolved.
import { BEHAVIORS } from '../registry.js';
import { gap, moveToward, beginAttack, updateAttack, slotX, face, validTarget } from '../common.js';

const WAIT_CLUSTER = 260; // defend/hold: wait until 2+ enemies are this close
const DETONATE_GAP = 12; // closer than this to any enemy and the fuse is lit

export function blastRadius(u) {
  return (u.def.aoe ? u.def.aoe.radius : 100) * (u.perks.has('bigger_bombs') ? 1.25 : 1);
}

// Count enemies within `radius` of x (ground units only, stealth units are still hurt by blasts).
function crowd(b, team, x, radius) {
  let n = 0;
  for (const e of b.byTeam[1 - team]) if (e.alive && !e.flying && Math.abs(e.x - x) - e.radius <= radius) n++;
  return n;
}

// Set off the bomb. mult 1 = full contact blast, 0.5 = death blast.
export function detonate(u, b, mult = 1, fromDeath = false) {
  const d = u.data;
  if (d.exploded) return;
  d.exploded = true;
  const radius = blastRadius(u);
  const dmg = u.dmg * u.mod.dmg * mult * (u.perks.has('shrapnel') ? 1.3 : 1);
  const before = b.units.filter((e) => e.alive && e !== u);
  const wasTargetable = u.targetable;
  u.targetable = false; // do not blast ourselves
  b.explode(u.x, 0, radius, dmg, {
    team: u.team, source: u, friendlyFire: 0.5, kb: u.kb, fx: 'bomb', fortMult: u.def.fortMult ?? 2,
  });
  u.targetable = wasTargetable;
  let kills = 0, friendlyKills = 0;
  for (const e of before) {
    if (e.alive) continue;
    if (e.team === u.team) friendlyKills++;
    else kills++;
  }
  if (u.perks.has('cluster')) scatterMinis(u, b, dmg * 0.4, radius * 0.55);
  b.emit('bomberBlast', { kills, friendlyKills, x: u.x, team: u.team, unit: u, death: fromDeath });
  if (u.alive) {
    b.kill(u, { kind: 'blast', kb: 300, source: null });
    if (!fromDeath) b.teams[u.team].stats.lost = Math.max(0, b.teams[u.team].stats.lost - 1); // a used bomb is not a casualty
  }
}

// Cluster perk: three small bombs fly out, land, and go off a moment later.
function scatterMinis(u, b, dmg, radius) {
  for (let i = 0; i < 3; i++) {
    const vx = (i - 1) * 150 + b.rng.range(-40, 40);
    b.areas.push({
      kind: 'mini_bomb', x: u.x, y: -10, vx, vy: -420 - b.rng.range(0, 120), fuse: 0.55 + i * 0.12 + b.rng.range(0, 0.1),
      team: u.team, alive: true, landed: false, z: u.z,
      update(bb, dt) {
        if (!this.landed) {
          this.vy += 1500 * dt;
          this.y += this.vy * dt;
          this.x += this.vx * dt;
          if (this.y >= 0) { this.y = 0; this.landed = true; this.vx = 0; }
        } else this.fuse -= dt;
        if (this.landed && this.fuse <= 0) {
          this.alive = false;
          bb.explode(this.x, 0, radius, dmg, { team: u.team, source: u, friendlyFire: 0.5, kb: u.kb * 0.4, fx: 'bomb' });
        }
      },
    });
  }
}

// Best crowd to run at: most enemies inside the blast radius, nearest on ties. The enemy fort
// counts as a big crowd once it is close.
function pickSpot(u, b) {
  const R = blastRadius(u);
  let best = null, bestScore = -1;
  for (const e of b.byTeam[1 - u.team]) {
    if (!e.alive || e.stealth || e.flying) continue;
    const g = gap(u, e);
    if (g > u.aggro) continue;
    const n = crowd(b, u.team, e.x, R);
    const score = n * 1000 - g;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (best) return { t: best, n: crowd(b, u.team, best.x, R) };
  const f = b.teams[1 - u.team].fort;
  if (f.alive && gap(u, f) <= u.aggro) return { t: f, n: 3 };
  return null;
}

function nearestGap(u, b) {
  let g = Infinity;
  for (const e of b.byTeam[1 - u.team]) {
    if (!e.alive || e.stealth || e.flying) continue;
    g = Math.min(g, gap(u, e));
  }
  const f = b.teams[1 - u.team].fort;
  if (f.alive) g = Math.min(g, gap(u, f));
  return g;
}

BEHAVIORS.bomber = {
  init(u) {
    u.data.exploded = false;
  },
  update(u, b, dt) {
    const d = u.data;
    if (d.exploded) return;
    if (u.attacking) {
      updateAttack(u, b, dt, (uu, bb) => detonate(uu, bb, 1));
      return;
    }
    const team = b.teams[u.team];
    u.retargetT -= dt;
    if (u.retargetT <= 0) {
      u.retargetT = 0.25;
      d.spot = pickSpot(u, b);
      d.hurryUp = u.hp < u.maxHp * 0.45;
    }
    const spot = d.spot;
    const t = spot && spot.t;
    const ok = t && (t.isFort ? t.alive : validTarget(u, t));
    let go = false;
    if (ok) {
      if (team.stance === 'charge') go = true;
      else if (t.isFort) go = gap(u, t) <= 200;
      else go = (spot.n >= 2 && gap(u, t) <= WAIT_CLUSTER) || (d.hurryUp && gap(u, t) < 160);
    }
    if (go) {
      u.target = spot.t;
      face(u, spot.t);
      if (nearestGap(u, b) <= DETONATE_GAP + u.range * 0.4) {
        beginAttack(u, spot.t);
        d.fuse = true;
        return;
      }
      moveToward(u, b, spot.t.x, dt, 1.0);
      return;
    }
    u.target = null;
    if (moveToward(u, b, slotX(u, b), dt)) u.facing = team.dir;
  },
};
