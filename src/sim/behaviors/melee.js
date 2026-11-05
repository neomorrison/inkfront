import { BEHAVIORS } from '../registry.js';
import { pickTarget, validTarget, gap, moveToward, beginAttack, updateAttack, meleeHit, slotX, face } from '../common.js';

// Standard fighter: hold your formation slot, engage what the stance allows, swing on cooldown.
// opts: { onHit(u, b, t), targetOpts (see findEnemy) }
export function meleeUpdate(u, b, dt, opts) {
  if (u.attacking) {
    updateAttack(u, b, dt, (opts && opts.onHit) || meleeHit);
    return;
  }
  u.retargetT -= dt;
  if (u.retargetT <= 0 || !validTarget(u, u.target)) {
    u.target = pickTarget(u, b, opts && opts.targetOpts);
    u.retargetT = 0.22 + (u.jitter + 1) * 0.06;
  }
  const t = u.target;
  if (t) {
    if (gap(u, t) <= u.range) {
      face(u, t);
      if (u.atkT <= 0) beginAttack(u, t);
    } else {
      // Spread attackers out so a crowd reads as a crowd, not one blob.
      const stop = Math.max(4, Math.min(u.range - 2, u.range * (0.2 + 0.7 * (u.jitter + 1) * 0.5)));
      const side = Math.sign(u.x - t.x) || -u.dir;
      moveToward(u, b, t.x + side * ((t.radius || 0) + u.radius + stop), dt);
    }
    return;
  }
  if (moveToward(u, b, slotX(u, b), dt)) u.facing = b.teams[u.team].dir;
}

BEHAVIORS.melee = { update: (u, b, dt) => meleeUpdate(u, b, dt) };
