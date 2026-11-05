// OWNER: factions/bosses builder (package B)
// Enemy faction traits: berserk, shatter, burnHit, reassemble, slowHit, cleanse (+ hoverHalf for the Hand).
// Hook signatures are documented in src/sim/registry.js.
import { TRAITS } from './registry.js';
import { clamp } from '../core/util.js';

// onHit also fires for damage-over-time ticks (info.dot). Never chain debuffs off those or a
// burn would refresh itself forever.
const hostile = (u, t, info) => !!t && t.alive && !t.isFort && t.team !== u.team && !(info && info.dot);

// Sharpener: the more hurt, the meaner. +100% damage and +60% attack speed at 10% hp.
TRAITS.berserk = {
  update(u) {
    const k = clamp((1 - u.hp / u.maxHp) / 0.9, 0, 1);
    u.data.rage = k;
    if (k > 0.02) u.addBuff({ id: 'berserk', t: 0.3, dmg: 1 + k, atkSpeed: 1 + 0.6 * k });
  },
};

// Graphite Golem: breaks into three Smudgelings that hop away.
TRAITS.shatter = {
  onDeath(u, b, info) {
    if (info.kind === 'expire') return;
    for (let i = 0; i < 3; i++) {
      const s = b.spawnUnit(u.team, 'smudgeling', { x: u.x + (i - 1) * 24, z: u.z, instant: true, summoned: true });
      s.airborne = true;
      s.y = -2;
      s.vy = -(260 + b.rng.range(0, 140));
      s.vx = (i - 1) * 120 + b.rng.range(-30, 30);
    }
    b.emit('shatter', { unit: u, x: u.x, z: u.z, team: u.team });
  },
};

// Neon Archer: hits (and arrows) set the target on fire, 6 dps for 4 s.
TRAITS.burnHit = {
  onHit(u, b, t, info) {
    if (hostile(u, t, info)) t.addBuff({ id: 'burn', t: 4, dot: 6, team: u.team, source: u });
  },
};

// Chalk Thrower: 30% slow for 2 s.
TRAITS.slowHit = {
  onHit(u, b, t, info) {
    if (hostile(u, t, info)) t.addBuff({ id: 'slow', t: 2, speed: 0.7 });
  },
};

// Eraser Knight: rubs out the target's positive buffs and blocks healing for 2 s.
const positive = (f) => !f.dot && !f.stun && !f.root &&
  ((f.dmg || 1) > 1 || (f.speed || 1) > 1 || (f.atkSpeed || 1) > 1 || f.armor > 0 || f.hot > 0 || (f.dmgTaken && f.dmgTaken < 1));
TRAITS.cleanse = {
  onHit(u, b, t, info) {
    if (!hostile(u, t, info)) return;
    const n = t.buffs.filter(positive).length;
    if (n) t.removeBuffs(positive);
    t.addBuff({ id: 'noheal', t: 2, heal: 0 });
    if (n) b.emit('cleanse', { unit: t, x: t.x, y: t.y - t.height * 0.6, z: t.z, team: t.team });
  },
};

// Dustborn: the first lethal hit leaves a chalk pile for 2.5 s, then it sketches itself back
// at half health. The pile is untargetable and does nothing. State lives in u.data for the renderer:
// downed (bool), downT (seconds left), reassembled (already used).
const DOWN_TIME = 2.5;
TRAITS.reassemble = {
  onLethal(u, b, info) {
    if (u.data.reassembled || u.data.downed || info.kind === 'expire') return false;
    u.data.reassembled = true;
    u.data.downed = true;
    u.data.downT = DOWN_TIME;
    u.hp = u.maxHp * 0.5;
    u.targetable = false;
    u.attacking = false;
    u.anim.atk = 0;
    u.target = null;
    u.buffs.length = 0;
    b.emit('reassemble', { unit: u, x: u.x, z: u.z, team: u.team, phase: 'down' });
    return true;
  },
  update(u, b, dt) {
    if (!u.data.downed) return;
    // Staggered units skip their behavior, so the pile never fights or walks.
    u.staggerT = Math.max(u.staggerT, 0.2);
    u.attacking = false;
    u.data.downT -= dt;
    if (u.data.downT > 0) return;
    u.data.downed = false;
    u.targetable = true;
    u.spawnTime = 0.7;
    u.setState('spawn'); // the renderer sketches spawning units in
    b.emit('reassemble', { unit: u, x: u.x, z: u.z, team: u.team, phase: 'up' });
  },
};

// The Hand takes half damage from anything while it hovers (spells and arrows still always hit).
TRAITS.hoverHalf = {
  onDamaged(u, b, dmg) {
    return u.flying && !u.data.landed ? dmg * 0.5 : dmg;
  },
};
