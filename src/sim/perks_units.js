// OWNER: units builder (package A)
// Effects of unit upgrade perks (data/units.js perks at levels 3/6/9). Stat-only perks go in a
// STAT_HOOKS entry; behavior perks are checked with u.perks.has('id') inside behaviors/traits.
import { STAT_HOOKS } from './registry.js';

// perk id -> function(stats) for perks that only change numbers.
const STAT_PERKS = {
  tough: (s) => { s.hp *= 1.2; },
  knuckle: (s) => { s.dmg *= 1.15; s.kb *= 1.5; },
  battle_rage: (s) => { s.atkCd *= 0.8; },
  heavy_stones: (s) => { s.dmg *= 1.2; },
  long_sling: (s) => { s.range += 60; s.aggro += 60; },
  eagle_eye: (s) => { s.dmg *= 1.15; },
  thick_skin: (s) => { s.armor += 0.1; },
  quick_feet: (s) => { s.speed *= 1.25; },
  barding: (s) => { s.armor += 0.15; },
  long_pike: (s) => { s.range += 15; },
  heavier_rocks: (s) => { s.dmg *= 1.2; },
};

STAT_HOOKS.push((def, level, stats, team, perks) => {
  if (!perks || perks.size === 0) return;
  for (const id of perks) {
    const fn = STAT_PERKS[id];
    if (fn) fn(stats);
  }
});
