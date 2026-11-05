// Player-roster traits. OWNER: units builder (package A).
// Hook signatures are documented in src/sim/registry.js.
import { TRAITS } from './registry.js';
import { detonate } from './behaviors/bomber.js';

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

// Rider: the run-up logic lives in behaviors/cavalry.js. The trait marks the unit for the AI.
TRAITS.charge = {};

// Bomber: explodes at half power when killed unless it already went off.
TRAITS.deathBlast = {
  onDeath(u, b, info) {
    if (u.data.exploded || (info && info.kind === 'expire')) return;
    detonate(u, b, 0.5, true);
  },
};

// Ninja: spawns invisible. Enemies cannot target it; area damage still hits.
TRAITS.stealth = {
  init(u) {
    u.stealth = true;
  },
};

// Brawler battle_rage: heal on kill. onHit runs just before the kill is processed.
TRAITS.killHeal = {
  onHit(u, b, t, info) {
    if (t.hp <= 0 && !t.isFort && info && info.kind === 'melee') b.heal(u, 20, u);
  },
};

// Shieldbearer shield_bash: every third melee hit stuns for 0.6 s.
TRAITS.shieldBash = {
  onHit(u, b, t, info) {
    if (!info || info.kind !== 'melee' || t.isFort) return;
    u.data.bashHits = (u.data.bashHits || 0) + 1;
    if (u.data.bashHits % 3 === 0) {
      t.addBuff({ id: 'stun', t: 0.6, stun: true });
      b.emit('blocked', { unit: u, x: t.x, y: t.y - t.height * 0.6, z: t.z, team: u.team });
    }
  },
};

// Shieldbearer bulwark: stamps nearby allies behind it; they carry the 'bulwarkWard' trait.
TRAITS.bulwark = {
  update(u, b, dt) {
    u.data.bwT = (u.data.bwT || 0) - dt;
    if (u.data.bwT > 0) return;
    u.data.bwT = 0.25;
    for (const a of b.byTeam[u.team]) {
      if (a === u || !a.alive) continue;
      const behind = (a.x - u.x) * -u.facing;
      if (behind < -10 || behind > 80) continue;
      a.data.bulwarkUntil = b.time + 0.45;
      if (!a.traits.includes('bulwarkWard')) a.traits.push('bulwarkWard');
    }
  },
};

TRAITS.bulwarkWard = {
  onDamaged(u, b, dmg, info) {
    if (info.kind === 'pierce' && info.proj && b.time < (u.data.bulwarkUntil || 0)) return dmg * 0.75;
    return dmg;
  },
};

// Spearman phalanx: +15% armor while two other spearmen stand close.
TRAITS.phalanx = {
  update(u, b, dt) {
    u.data.phT = (u.data.phT || 0) - dt;
    if (u.data.phT > 0) return;
    u.data.phT = 0.3;
    let n = 0;
    for (const a of b.byTeam[u.team]) if (a !== u && a.alive && a.type === u.type && Math.abs(a.x - u.x) < 100) n++;
    if (n >= 2) u.addBuff({ id: 'phalanx', t: 0.5, armor: 0.15 });
  },
};

// Colossus unstoppable: regenerates 1% of max health per second.
TRAITS.regen = {
  update(u, b, dt) {
    if (u.hp < u.maxHp) b.heal(u, u.maxHp * 0.01 * dt, u, true);
  },
};
