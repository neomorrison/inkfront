import { clamp } from '../core/util.js';
import { UNIT_LEVEL } from '../data/upgrades.js';
import { STAT_HOOKS } from './registry.js';

// Team-wide stat multipliers. Built from difficulty, endless perks, hero skills and modifiers.
export function makeMods(m = {}) {
  return {
    hp: 1, dmg: 1, speed: 1, atkSpeed: 1, armor: 0, cost: 1, build: 1, kb: 1,
    rangedRange: 0, spellCd: 1, heroHp: 1, heroDmg: 1, vsLarge: 1, lifesteal: 0,
    ...m,
    byUnit: { ...(m.byUnit || {}) }, // { unitId: { hp, dmg, range, atkSpeed, speed, armor, cost, build } }
    flags: { ...(m.flags || {}) },  // free-form switches for perks
  };
}

// Perk ids a unit has at its upgrade level (tiers 3, 6, 9).
export function unitPerks(def, level) {
  const set = new Set();
  if (def.perks) for (const tier in def.perks) if (level >= +tier) set.add(def.perks[tier].id);
  return set;
}

export function unitStats(def, level, team, perks) {
  const lv = Math.max(1, level | 0);
  const m = team.mods;
  const bu = m.byUnit[def.id] || {};
  const s = {
    hp: def.hp * (1 + UNIT_LEVEL.hpPer * (lv - 1)) * m.hp * (bu.hp ?? 1),
    dmg: def.dmg * (1 + UNIT_LEVEL.dmgPer * (lv - 1)) * m.dmg * (bu.dmg ?? 1),
    range: def.range + (bu.range ?? 0) + (def.proj ? m.rangedRange : 0),
    atkCd: def.atkCd / (m.atkSpeed * (bu.atkSpeed ?? 1)),
    windup: def.windup,
    speed: def.speed * m.speed * (bu.speed ?? 1),
    armor: (def.armor ?? 0) + m.armor + (bu.armor ?? 0),
    mass: def.mass ?? 1,
    kb: (def.kb ?? 20) * m.kb,
    aggro: def.aggro ?? (def.proj ? def.range + 90 : 300),
  };
  for (const hook of STAT_HOOKS) hook(def, lv, s, team, perks);
  s.hp = Math.max(1, Math.round(s.hp));
  s.armor = clamp(s.armor, 0, 0.85);
  return s;
}
