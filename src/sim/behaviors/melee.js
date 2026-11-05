import { BEHAVIORS } from '../registry.js';
import { pickTarget, validTarget, gap, moveToward, beginAttack, updateAttack, meleeHit, slotX, face } from '../common.js';

// Standard fighter: hold your formation slot, engage what the stance allows, swing on cooldown.
// opts: { onHit(u, b, t), targetOpts (see findEnemy) }. Without opts.onHit a unit uses its
// perk-specific strike (u.data.hitFn, set in BEHAVIORS.melee.init) or the plain meleeHit.
export function meleeUpdate(u, b, dt, opts) {
  if (u.attacking) {
    updateAttack(u, b, dt, (opts && opts.onHit) || u.data.hitFn || meleeHit);
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

// Spearman skewer: the thrust also hits the enemy standing behind the target.
function skewerHit(u, b, t) {
  meleeHit(u, b, t);
  if (!t || t.isFort) return;
  let best = null, bd = 80;
  for (const e of b.byTeam[1 - u.team]) {
    if (e === t || !e.alive || !e.targetable || e.stealth || e.flying) continue;
    const ahead = (e.x - t.x) * u.facing;
    if (ahead <= 0 || ahead > bd) continue;
    bd = ahead;
    best = e;
  }
  if (best) b.damage(best, u.dmg * u.mod.dmg * 0.8, { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: u.kb * 0.5 });
}

// Colossus earthshaker: the splash also stuns.
function earthshakerHit(u, b, t) {
  if (!t || !t.alive || gap(u, t) > u.range + 16) return;
  const ao = u.def.aoe;
  if (!ao) { meleeHit(u, b, t); return; }
  b.meleeSplash(u, ao.radius, u.dmg * u.mod.dmg, !!ao.frontal, { kb: u.kb, stun: 0.5 });
}

function addTrait(u, id) {
  if (!u.traits.includes(id)) u.traits.push(id);
}

BEHAVIORS.melee = {
  // Perk-driven extras for any unit on the melee behavior (they check perk ids, so enemies
  // that reuse the roster at a high level get them too).
  init(u) {
    const p = u.perks;
    if (!p || p.size === 0) return;
    if (p.has('battle_rage')) addTrait(u, 'killHeal');
    if (p.has('shield_bash')) addTrait(u, 'shieldBash');
    if (p.has('bulwark')) addTrait(u, 'bulwark');
    if (p.has('phalanx')) addTrait(u, 'phalanx');
    if (p.has('unstoppable')) {
      u.immuneKb = true;
      u.immuneStun = true;
      addTrait(u, 'regen');
    }
    if (p.has('skewer')) u.data.hitFn = skewerHit;
    else if (p.has('earthshaker')) u.data.hitFn = earthshakerHit;
  },
  update: (u, b, dt) => meleeUpdate(u, b, dt),
};
