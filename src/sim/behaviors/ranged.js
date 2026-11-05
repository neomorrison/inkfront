import { BEHAVIORS } from '../registry.js';
import { Projectile } from '../projectile.js';
import { pickTarget, validTarget, gap, moveToward, beginAttack, updateAttack, slotX, face } from '../common.js';

// Slinger ricochet: the stone bounces to a second enemy for half damage.
function bounceFrom(b, p, target) {
  if (!target || target.isFort) return;
  let best = null, bd = 170;
  for (const e of b.byTeam[1 - p.team]) {
    if (e === target || !e.alive || !e.targetable || e.stealth || e.flying) continue;
    const d = Math.abs(e.x - target.x);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return;
  const sx = p.x, sy = p.y;
  const T = 0.3 + bd / 900;
  const g = 900;
  const ty = best.y - best.height * 0.55;
  const np = new Projectile({
    x: sx, y: sy, vx: (best.x - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T, g,
    team: p.team, dmg: p.dmg * 0.5, kind: p.kind, dmgKind: p.dmgKind, source: p.source, kb: 0, z: best.z, bonus: p.bonus,
  });
  np.hitIds = new Set([target.id]); // do not re-hit the stone's first victim
  b.projectiles.push(np);
}

// Default shot: one projectile from def.proj. Projectiles apply def.bonus themselves.
// Perks: eagle_eye (tighter aim), volley (two arrows), fire_arrows (burn), ricochet (bounce).
export function rangedShoot(u, b, t) {
  if (!t || !t.alive) return;
  const spec = u.def.proj;
  const dmg = u.dmg * u.mod.dmg;
  const p = u.perks;
  if (!p || p.size === 0) { b.shoot(u, t, spec, dmg); return; }
  const extra = {};
  if (p.has('eagle_eye')) extra.spreadMult = 0.5;
  if (p.has('fire_arrows')) extra.effects = { burn: { dps: 10, t: 3 } };
  if (p.has('ricochet')) extra.onImpact = (bb, pr, target) => bounceFrom(bb, pr, target);
  b.shoot(u, t, spec, dmg, extra);
  if (p.has('volley')) b.shoot(u, t, spec, dmg, { ...extra, spreadMult: (extra.spreadMult ?? 1) * 1.6 });
}

// Archer-style: stay at the back of the formation, shoot anything in range.
// opts: { onShoot(u, b, t), targetOpts }
export function rangedUpdate(u, b, dt, opts) {
  if (u.attacking) {
    updateAttack(u, b, dt, (opts && opts.onShoot) || rangedShoot);
    return;
  }
  u.retargetT -= dt;
  if (u.retargetT <= 0 || !validTarget(u, u.target)) {
    u.target = pickTarget(u, b, opts && opts.targetOpts);
    u.retargetT = 0.3 + (u.jitter + 1) * 0.08;
  }
  const t = u.target;
  if (t) {
    const g = gap(u, t);
    if (g <= u.range) {
      face(u, t);
      if (u.atkT <= 0) beginAttack(u, t);
    } else {
      const side = Math.sign(u.x - t.x) || -u.dir;
      moveToward(u, b, t.x + side * ((t.radius || 0) + u.radius + u.range * 0.85), dt);
    }
    return;
  }
  if (moveToward(u, b, slotX(u, b), dt)) u.facing = b.teams[u.team].dir;
}

BEHAVIORS.ranged = { update: (u, b, dt) => rangedUpdate(u, b, dt) };
