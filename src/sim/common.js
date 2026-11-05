// Shared behavior helpers: targeting, formation slots, movement, attack timing.
// Every behavior should build on these so stances, blockers and stuns work the same everywhere.
import { clamp } from '../core/util.js';

export const RANK_OFFSET = [40, 0, -100, -160, -230]; // formation rows relative to the anchor
export const DEFEND_OFFSET = 260; // defend line distance in front of your own fort
export const LEASH = 260; // how far from its post a unit chases in defend/hold

// Edge-to-edge gap between a unit and a target (unit, fort or structure). Negative = overlapping.
export function gap(u, t) {
  return Math.abs(t.x - u.x) - (t.radius || 0) - u.radius;
}

export function stanceAnchor(b, team) {
  if (team.stance === 'hold') return team.flagX;
  return team.fort.x + team.dir * DEFEND_OFFSET;
}

// Where this unit wants to stand when nothing is in reach.
export function slotX(u, b) {
  const team = b.teams[u.team];
  const dir = team.dir;
  if (team.stance === 'charge') {
    const ef = b.teams[1 - u.team].fort;
    return ef.x - dir * (ef.radius + u.radius + u.range * 0.7);
  }
  const rank = u.def.rank ?? 1;
  const spread = rank === 4 ? 30 : 34;
  const x = stanceAnchor(b, team) + dir * (RANK_OFFSET[rank] + u.jitter * spread);
  return clamp(x, 40, b.width - 40);
}

// Nearest valid enemy within maxGap. opts: { fn(e) -> bool, prefer(e) -> bool, preferBonus, seeStealth, ground }
export function findEnemy(u, b, maxGap, opts) {
  const list = b.byTeam[1 - u.team];
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive || !e.targetable) continue;
    if (e.stealth && !(opts && opts.seeStealth)) continue;
    if (e.flying && !u.canHitAir) continue;
    if (opts && opts.fn && !opts.fn(e)) continue;
    const g = gap(u, e);
    if (g > maxGap) continue;
    let score = g;
    if (e.taunt && g < 100) score -= 140;
    if (opts && opts.prefer && opts.prefer(e)) score -= opts.preferBonus ?? 220;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

// The standard "what should I fight" rule, honoring stance and leash.
export function pickTarget(u, b, opts) {
  const team = b.teams[u.team];
  let t = findEnemy(u, b, u.aggro, opts);
  if (t && team.stance !== 'charge' && !u.data.free) {
    const post = slotX(u, b);
    const reach = u.def.proj ? u.range + 30 : LEASH;
    if (Math.abs(t.x - post) > reach && gap(u, t) > u.range) t = null;
  }
  if (!t) {
    const ef = b.teams[1 - u.team].fort;
    if (ef.alive) {
      const g = gap(u, ef);
      if (g <= u.range + 4 || (team.stance === 'charge' && g <= u.aggro)) t = ef;
    }
  }
  return t;
}

export function validTarget(u, t) {
  return !!t && t.alive && t.targetable !== false && !(t.stealth) && !(t.flying && !u.canHitAir);
}

// Walk toward x. Returns true once there. Respects root, enemy forts and enemy structures.
export function moveToward(u, b, x, dt, mul = 1) {
  const dx = x - u.x;
  if (Math.abs(dx) < 2) return true;
  if (u.mod.root) return false;
  const step = u.speed * u.mod.speed * mul * dt;
  let nx = u.x + Math.sign(dx) * Math.min(step, Math.abs(dx));
  nx = clampToBlockers(u, b, nx);
  if (nx !== u.x) {
    u.facing = Math.sign(nx - u.x);
    u.anim.moving = true;
    u.anim.walk += Math.abs(nx - u.x);
    u.x = nx;
  }
  return Math.abs(x - u.x) < 2;
}

export function clampToBlockers(u, b, nx) {
  const ef = b.teams[1 - u.team].fort;
  const dir = b.teams[u.team].dir;
  if (ef.alive) {
    const front = ef.x - dir * (ef.radius + u.radius);
    if (dir > 0 ? nx > front && u.x <= front + 1 : nx < front && u.x >= front - 1) nx = front;
  }
  for (let i = 0; i < b.blockers.length; i++) {
    const w = b.blockers[i];
    if (!w.alive || w.team === u.team) continue;
    const side = Math.sign(u.x - w.x) || -dir;
    const edge = w.x + side * (w.radius + u.radius);
    if (side < 0 && nx > edge && u.x <= edge + 1) nx = edge;
    if (side > 0 && nx < edge && u.x >= edge - 1) nx = edge;
  }
  return nx;
}

export function face(u, t) {
  const s = Math.sign(t.x - u.x);
  if (s) u.facing = s;
}

export function recoverTime(u) {
  return clamp(u.atkCd - u.windup, 0.14, 0.36);
}

export function beginAttack(u, t) {
  u.attacking = true;
  u.atkElapsed = 0;
  u.atkHit = false;
  u.atkTarget = t;
  u.atkT = u.atkCd;
  face(u, t);
}

// Advance the current attack. onHit(u, b, target) fires once at the windup mark.
export function updateAttack(u, b, dt, onHit) {
  u.atkElapsed += dt * u.mod.atkSpeed;
  const wind = Math.max(0.01, u.windup);
  const total = wind + recoverTime(u);
  if (!u.atkHit && u.atkElapsed >= wind) {
    u.atkHit = true;
    onHit(u, b, u.atkTarget);
  }
  u.anim.atk = u.atkElapsed < wind ? 0.5 * (u.atkElapsed / wind) : 0.5 + 0.5 * Math.min(1, (u.atkElapsed - wind) / (total - wind));
  if (u.atkElapsed >= total) {
    u.attacking = false;
    u.anim.atk = 0;
  }
}

// Damage multiplier for unit u hitting t: the unit's own bonus table plus team-wide vsLarge.
export function bonusVs(u, t, b) {
  if (!t || t.isFort) return 1;
  const bn = u.def.bonus;
  let m = 1;
  if (bn) for (const tag in bn) if (t.tags && t.tags.has(tag)) m = Math.max(m, bn[tag]);
  const vs = b.teams[u.team].mods.vsLarge;
  if (vs !== 1 && t.tags && (t.tags.has('large') || t.tags.has('boss'))) m *= vs;
  return m;
}

// Standard melee strike (single target or frontal splash when def.aoe is set).
export function meleeHit(u, b, t) {
  if (!t || !t.alive) return;
  if (gap(u, t) > u.range + 16) return; // target slipped away
  const dmg = u.dmg * u.mod.dmg;
  if (u.def.aoe) {
    b.meleeSplash(u, u.def.aoe.radius, dmg, !!u.def.aoe.frontal, { kb: u.kb });
    return;
  }
  b.damage(t, dmg * bonusVs(u, t, b), { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: u.kb });
}

// Count living units on a team, optionally filtered.
export function countUnits(b, teamIdx, fn) {
  let n = 0;
  for (const u of b.units) if (u.alive && u.team === teamIdx && (!fn || fn(u))) n++;
  return n;
}

// Rough fighting strength used by AI and HUD: sum of sqrt(hp * dps).
export function armyPower(b, teamIdx, near) {
  let p = 0;
  for (const u of b.units) {
    if (!u.alive || u.team !== teamIdx || u.type === 'scribe' || u.tags.has('structure')) continue;
    if (near != null && Math.abs(u.x - near) > 700) continue;
    const dps = (u.dmg * (u.def.aoe ? 2.2 : 1) * (u.def.chain || 1)) / Math.max(0.3, u.atkCd) + (u.def.heal || 0);
    p += Math.sqrt(Math.max(1, u.hp) * Math.max(1, dps));
  }
  return p;
}
