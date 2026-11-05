// OWNER: AI/levels/modes builder (package C)
// Level modifiers (data/levels.js MODIFIERS): MODIFIER_IMPL[id] = { init?(b), update?(b, dt) }.
// init runs before wells and the AI exist, so anything that touches them goes through team fields.
import { MODIFIER_IMPL } from './registry.js';

MODIFIER_IMPL.wind_left = { init(b) { b.wind = -260; } };
MODIFIER_IMPL.wind_right = { init(b) { b.wind = 260; } };
MODIFIER_IMPL.double_fort = { init(b) { const f = b.teams[1].fort; f.maxHp *= 2; f.hp = f.maxHp; } };
MODIFIER_IMPL.gold_rush = { init(b) { b.centerYield = 3.5; } };

// Night: package F draws the darkness from this flag.
MODIFIER_IMPL.night = { init(b) { b.flags.night = true; } };

// Rain: wild ranged shots, but every Scribe trip pays 50% more for both teams.
MODIFIER_IMPL.rain = {
  init(b) {
    b.flags.rain = true;
    b.accuracyMult = 1.6;
    for (const t of b.teams) t.wellYield *= 1.5;
  },
};

// Ambush: the enemy's startUnits (from its config) are already on the field.
MODIFIER_IMPL.rush = {
  init(b) {
    b.flags.rush = true;
    b.emit('banner', { text: 'Ambush! The enemy is already marching.', team: 1 });
  },
};

// Inkflation: your units cost 25% more, but you start with 300 extra ink.
MODIFIER_IMPL.inkflation = {
  init(b) {
    const t = b.teams[0];
    t.mods.cost *= 1.25;
    t.ink += 300;
    b.flags.inkflation = true;
  },
};

// Swarm: the enemy draws units at half price and 40% faster.
MODIFIER_IMPL.swarm = {
  init(b) {
    const t = b.teams[1];
    t.mods.cost *= 0.5;
    t.mods.build *= 0.6;
    b.flags.swarm = true;
  },
};

// Coffee stains: 3 or 4 sticky puddles in the middle third slow everyone who walks through.
export const STAIN_SLOW = 0.6; // speed multiplier inside a stain (40% slower)

export function makeStains(b) {
  const n = b.rng.chance(0.5) ? 3 : 4;
  const lo = b.width * 0.3, hi = b.width * 0.7;
  for (let i = 0; i < n; i++) {
    const slot = (hi - lo) / n;
    const x = lo + slot * (i + 0.5) + b.rng.range(-slot * 0.25, slot * 0.25);
    b.areas.push({
      kind: 'coffee_stain', team: -1, x, radius: Math.round(b.rng.range(95, 135)), seed: b.rng.int(1, 9999), alive: true,
      update(bb) {
        const r = this.radius;
        for (const u of bb.units) {
          if (!u.alive || u.flying || u.y < -4 || u.state === 'spawn' || u.isBoss) continue;
          if (Math.abs(u.x - this.x) <= r) u.addBuff({ id: 'coffee_stain', t: 0.2, speed: STAIN_SLOW });
        }
      },
    });
  }
}

MODIFIER_IMPL.coffee_stains = {
  init(b) {
    b.flags.coffee = true;
    makeStains(b);
  },
};
