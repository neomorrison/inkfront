import { BEHAVIORS } from '../registry.js';
import { pickTarget, validTarget, gap, moveToward, beginAttack, updateAttack, slotX, face } from '../common.js';

// Default shot: one projectile from def.proj. Projectiles apply def.bonus themselves.
export function rangedShoot(u, b, t) {
  if (!t || !t.alive) return;
  b.shoot(u, t, u.def.proj, u.dmg * u.mod.dmg);
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
