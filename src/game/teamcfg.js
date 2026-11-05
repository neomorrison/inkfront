// Turns the saved profile into a Battle team config for the player, and a level's enemy block
// into the AI team config. All upgrades apply here, once, before the battle starts.
import { deepClone } from '../core/util.js';
import { UNITS } from '../data/units.js';
import { FORT_UPGRADES, PLAYER_BASE } from '../data/upgrades.js';
import { HERO_ABILITIES, HERO_GROWTH } from '../data/hero.js';
import { HARD_MODE } from '../data/levels.js';
import { applyHeroSkills } from './hero_skills.js';

// opts: { loadout?: {units, spells}, roster? (force a roster), noHero, noSpells, unitLevelOverride }
export function playerTeamConfig(profile, opts = {}) {
  const cfg = deepClone(PLAYER_BASE);
  cfg.faction = 'ink';
  for (const id in FORT_UPGRADES) {
    const lv = profile.fort[id] || 0;
    if (lv > 0) FORT_UPGRADES[id].apply(cfg, lv);
  }
  const loadout = opts.loadout || profile.loadout;
  const roster = opts.roster || ['scribe', ...loadout.units.filter((id) => profile.unlockedUnits.includes(id))];
  cfg.roster = Array.from(new Set(roster));
  cfg.unitLevels = {};
  for (const id of cfg.roster) cfg.unitLevels[id] = opts.unitLevelOverride ?? (profile.units[id] || 1);
  cfg.unitLevels.critter = cfg.unitLevels.doodler || 1;
  cfg.spells = opts.noSpells ? [] : (loadout.spells || [])
    .filter((id) => profile.unlockedSpells.includes(id))
    .map((id) => ({ id, level: profile.spells[id] || 1 }));
  cfg.mods = { byUnit: {}, flags: {} };
  if (!opts.noHero) {
    const lv = profile.hero.level || 1;
    cfg.hero = {
      id: 'captain', level: lv,
      hpMult: 1 + HERO_GROWTH.hp * (lv - 1),
      dmgMult: 1 + HERO_GROWTH.dmg * (lv - 1),
      abilities: Object.values(HERO_ABILITIES).filter((a) => lv >= a.unlockLevel).map((a) => a.id),
      hat: profile.hero.hat || 'captain',
      skills: { ...(profile.hero.skills || {}) },
    };
  }
  cfg.armyHat = profile.settings.armyHats ? profile.hero.armyHat || 'none' : 'none';
  applyHeroSkills(cfg, profile);
  return cfg;
}

// level.enemy block -> AI team config. hard = Red Ink mode.
export function enemyTeamConfig(level, opts = {}) {
  const e = level.enemy;
  const hard = !!opts.hard;
  const H = hard ? HARD_MODE : null;
  const lvl = (e.level || 1) + (hard ? H.levelBonus : 0);
  const roster = Array.from(new Set(['scribe', ...(e.roster || [])]));
  const unitLevels = {};
  for (const id of roster) unitLevels[id] = lvl;
  if (level.boss) unitLevels[level.boss] = 1;
  const cfg = {
    faction: level.faction,
    startInk: e.startInk ?? 150,
    income: (e.income ?? 1.5) * (H ? H.enemyIncome : 1),
    popCap: Math.max(10, (e.maxArmy ?? 20) + (e.scribes ?? 3) + 4),
    scribeCap: e.scribes ?? 3,
    wellYield: 1,
    roster,
    unitLevels,
    fort: {
      hp: Math.round((e.fortHp ?? 1500) * (H ? H.fortHp : 1)),
      turretDmg: (e.turret && e.turret.dmg) ?? 10,
      turretRange: (e.turret && e.turret.range) ?? 440,
      turretCd: (e.turret && e.turret.cd) ?? 1.8,
      invulnerable: !!e.invulnerableFort || level.win === 'survive',
    },
    spells: e.spells || [],
    mods: { hp: H ? H.enemyHp : 1, dmg: H ? H.enemyDmg : 1, ...(e.mods || {}) },
    startUnits: e.startUnits || null,
    ai: { ...e, boss: level.boss || null, script: level.script || [] },
  };
  if (cfg.mods.byUnit == null) cfg.mods.byUnit = {};
  return cfg;
}

export function knownUnit(id) {
  return !!UNITS[id];
}
