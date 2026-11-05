// Player-roster traits. OWNER: units builder (package A) adds charge, deathBlast, stealth.
// Hook signatures are documented in src/sim/registry.js.
import { TRAITS } from './registry.js';

// Frontal arrow block (Shieldbearer, Marker Knight). def.block = fraction blocked.
TRAITS.shieldBlock = {
  onDamaged(u, b, dmg, info) {
    if (info.kind !== 'pierce' || !info.proj || u.attacking) return dmg;
    const from = -Math.sign(info.proj.vx || 0); // side the projectile came from
    if (from !== u.facing) return dmg;
    let block = u.def.block ?? 0.8;
    if (u.perks.has('tower_shield')) block = Math.max(block, 0.9);
    b.emit('blocked', { unit: u, x: u.x + u.facing * 8, y: info.proj.y, z: u.z, team: u.team });
    return dmg * (1 - block);
  },
};

// Taunt is a flag read by findEnemy (enemies within 100 px prefer this unit).
TRAITS.taunt = {};
