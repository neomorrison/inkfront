// Squad points: which units fit in the crew you bring to a battle. Data-only imports so the
// sim tools and teamcfg can use it without pulling in the save or the UI.
import { MAX_LOADOUT, SQUAD, crewOf } from '../data/units.js';

// Squad capacity: base + chapter bosses beaten + War Table levels.
export function squadCap(p) {
  const bosses = SQUAD.bossLevels.filter((id) => p.levels && p.levels[id] && p.levels[id].cleared).length;
  return SQUAD.base + SQUAD.perBoss * bosses + SQUAD.perTable * ((p.fort && p.fort.squad) || 0);
}
export function squadUsed(ids) {
  return ids.reduce((n, id) => n + crewOf(id), 0);
}
// The picked units that fit the squad, in order (later picks drop first). Used when a save
// holds more than the squad allows (old saves, or a lower cap).
export function fitSquad(p, ids = p.loadout.units) {
  const cap = squadCap(p);
  const out = [];
  let used = 0;
  for (const id of ids) {
    if (out.length >= MAX_LOADOUT || used + crewOf(id) > cap) continue;
    out.push(id); used += crewOf(id);
  }
  return out;
}
