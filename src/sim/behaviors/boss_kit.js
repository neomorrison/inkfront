// OWNER: factions/bosses builder (package B)
// Shared pieces for the five boss behaviors: setup, telegraph areas, ground hit helpers and the
// basic "walk up and hit it" loop. Bosses run ability sequences as `u.data.act`, an object with
// tick(u, b, dt) -> true when finished. While an act runs the normal melee loop is paused.
import { pickTarget, validTarget, gap, moveToward, beginAttack, updateAttack, meleeHit, face } from '../common.js';

export function initBoss(u, b, o = {}) {
  u.immuneStun = true; // scripted attacks must stay readable
  u.immuneKb = true;
  u.aggro = o.aggro ?? 520;
  u.data.free = true; // bosses never hold a leash
  u.data.cd = { ...(o.cd || {}) };
  u.data.act = null;
  u.data.escalated = false;
  u.z = o.z ?? 0.2;
  b.emit('bossIntro', { unit: u, id: u.type, x: u.x });
}

export function tickCooldowns(u, dt) {
  const cd = u.data.cd;
  for (const k in cd) if (cd[k] > 0) cd[k] -= dt;
}

// Run the current act. Returns true while one is in progress.
export function runAct(u, b, dt) {
  const a = u.data.act;
  if (!a) return false;
  if (a.tick(u, b, dt)) {
    u.data.act = null;
    u.attacking = false;
    u.anim.atk = 0;
  }
  return true;
}

export function startAct(u, act) {
  u.data.act = act;
  u.attacking = false;
}

// Visual pose for scripted attacks: u.anim.atk drives the attack keyframes (0.42 = raised, 0.5 = hit).
export function actPose(u, atk) {
  u.attacking = true;
  u.anim.atk = atk;
}

// A warning that stays alive as a sim area so the renderer can draw it, then resolves.
// shape: 'circle' { x, radius } | 'band' { x (center), width } | 'sweep' { x0, dirn, length, width } | 'quiz' { x, radius }
export function telegraph(b, boss, o) {
  const a = {
    kind: 'telegraph', shape: o.shape, tkind: o.kind, team: boss.team, boss,
    x: o.x ?? o.x0, radius: o.radius || 0, width: o.width || 0, x0: o.x0, dirn: o.dirn || 0, length: o.length || 0,
    t: 0, delay: o.delay, alive: true, fire: o.fire,
    update(bb, dt) {
      if (!this.boss.alive) { this.alive = false; return; }
      this.t += dt;
      if (this.t >= this.delay) {
        this.alive = false;
        if (this.fire) this.fire(bb, this);
      }
    },
  };
  b.areas.push(a);
  b.emit('telegraph', { x: a.x, radius: a.radius, width: a.width, delay: o.delay, kind: o.kind, team: boss.team });
  return a;
}

// Ground units of the boss's enemies that melee-type attacks and shockwaves can touch.
export function groundEnemies(b, boss) {
  const out = [];
  for (const e of b.byTeam[1 - boss.team]) {
    if (!e.alive || !e.targetable) continue;
    if (e.flying && !e.data.landed) continue;
    out.push(e);
  }
  return out;
}

export function nearestEnemy(b, boss) {
  let best = null, bd = Infinity;
  for (const e of groundEnemies(b, boss)) {
    const d = Math.abs(e.x - boss.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Scribes count little so the big attacks go after armies, not the economy.
const weight = (o) => (o.isHero ? 2 : o.type === 'scribe' ? 0.2 : 1);

// x of the enemy with the most neighbours within `radius`, among those within maxDist of the boss.
export function densest(b, boss, maxDist = 900, radius = 160) {
  const list = groundEnemies(b, boss).filter((e) => Math.abs(e.x - boss.x) <= maxDist);
  if (!list.some((e) => e.type !== 'scribe')) return null;
  let best = null, bn = 0;
  for (const e of list) {
    let n = 0;
    for (const o of list) if (Math.abs(o.x - e.x) <= radius) n += weight(o);
    if (n > bn) { bn = n; best = e; }
  }
  if (!best) return null;
  let sx = 0, c = 0;
  for (const o of list) if (Math.abs(o.x - best.x) <= radius) { sx += o.x * weight(o); c += weight(o); }
  return { x: sx / c, n: bn, unit: best };
}

// Damage everything on the ground within `radius` (edge to edge) of x. Returns the count.
export function hitGround(b, boss, x, radius, dmg, info = {}) {
  let n = 0;
  for (const e of groundEnemies(b, boss)) {
    if (Math.abs(e.x - x) - e.radius > radius) continue;
    const dir = Math.sign(e.x - x) || -boss.dir;
    b.damage(e, dmg, { source: boss, team: boss.team, kind: info.kind || 'blast', dir, kb: info.kb || 0, kbUp: info.kbUp });
    if (info.stun && e.alive) e.addBuff({ id: 'stun', t: info.stun, stun: true });
    n++;
  }
  return n;
}

// Bosses lead the push but never run far ahead of their own army: x they should not pass while
// marching on the enemy (null when the army is gone, then the boss goes alone).
export function marchLimit(b, boss, lead = 140) {
  let front = null;
  for (const a of b.byTeam[boss.team]) {
    if (!a.alive || a === boss || a.type === 'scribe' || a.tags.has('structure') || a.def.summon) continue;
    if (front === null || (a.x - front) * boss.dir < 0) front = a.x;
  }
  return front === null ? null : front + boss.dir * lead;
}

// Basic boss fighting: pick a target, walk up, swing. With no target, march on the enemy fort.
export function bossMelee(u, b, dt, o = {}) {
  if (u.attacking) {
    updateAttack(u, b, dt, o.onHit || meleeHit);
    return;
  }
  u.retargetT -= dt;
  if (u.retargetT <= 0 || !validTarget(u, u.target)) {
    u.target = pickTarget(u, b, o.targetOpts);
    u.retargetT = 0.3;
  }
  const t = u.target;
  if (t) {
    if (gap(u, t) <= u.range) {
      face(u, t);
      if (u.atkT <= 0) beginAttack(u, t);
    } else {
      const side = Math.sign(u.x - t.x) || -u.dir;
      moveToward(u, b, t.x + side * ((t.radius || 0) + u.radius + u.range * 0.6), dt);
    }
    return;
  }
  const ef = b.teams[1 - u.team].fort;
  if (!ef.alive) return;
  let goal = ef.x - u.dir * (ef.radius + u.radius + u.range * 0.5);
  const lim = marchLimit(b, u);
  if (lim !== null && (goal - lim) * u.dir > 0) goal = lim;
  if ((goal - u.x) * u.dir > 0) moveToward(u, b, goal, dt); // never walk backwards toward the army
}

// Remove this boss's lingering hazards (called when it dies).
export function clearBossAreas(b, boss) {
  for (const a of b.areas) if (a.boss === boss) a.alive = false;
}
