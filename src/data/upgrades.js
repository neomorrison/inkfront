// Gold sinks and their effects. Effects are applied when a battle config is built
// (src/game/teamcfg.js), never inside the sim loop.

export const UNIT_MAX_LEVEL = 10;
export const UNIT_LEVEL = { hpPer: 0.09, dmgPer: 0.08 }; // +9% hp and +8% damage per level above 1

// Gold to go from `level` to `level + 1`.
export function unitUpgradeCost(def, level) {
  const base = (def.upgrade && def.upgrade.base) || 100;
  return Math.round((base * Math.pow(1.42, level - 1)) / 5) * 5;
}

// Visible gear by unit level (drawn by src/render/stickman.js): helmet at 4, plume at 7, gold trim at 10.
export const GEAR_TIERS = [{ level: 4, gear: 'helm' }, { level: 7, gear: 'plume' }, { level: 10, gear: 'gilded' }];

export const FORT_UPGRADES = {
  walls: {
    id: 'walls', name: 'Thicker Walls', icon: 'walls', max: 10, base: 120, growth: 1.45,
    desc: (lv) => `Fort health +${lv * 15}%`,
    apply: (cfg, lv) => { cfg.fort.hp = Math.round(cfg.fort.hp * (1 + 0.15 * lv)); },
  },
  turret: {
    id: 'turret', name: 'Tower Archer', icon: 'turret', max: 10, base: 150, growth: 1.45,
    desc: (lv) => `Tower damage +${lv * 20}%${lv >= 4 ? ', extra arrows' : ''}`,
    apply: (cfg, lv) => {
      cfg.fort.turretDmg *= 1 + 0.2 * lv;
      cfg.fort.turretRange += lv * 12;
      cfg.fort.turretShots = 1 + (lv >= 4 ? 1 : 0) + (lv >= 8 ? 1 : 0);
    },
  },
  income: {
    id: 'income', name: 'Ink Press', icon: 'income', max: 10, base: 140, growth: 1.5,
    desc: (lv) => `Passive ink +${(lv * 0.4).toFixed(1)}/s`,
    apply: (cfg, lv) => { cfg.income += 0.4 * lv; },
  },
  start_ink: {
    id: 'start_ink', name: 'Ink Reserves', icon: 'start_ink', max: 10, base: 100, growth: 1.4,
    desc: (lv) => `Start each battle with +${lv * 30} ink`,
    apply: (cfg, lv) => { cfg.startInk += 30 * lv; },
  },
  scribes: {
    id: 'scribes', name: 'Scribe Quarters', icon: 'scribes', max: 4, base: 250, growth: 1.8,
    desc: (lv) => `Up to ${4 + lv} Scribes`,
    apply: (cfg, lv) => { cfg.scribeCap += lv; },
  },
  pop: {
    id: 'pop', name: 'Barracks', icon: 'pop', max: 8, base: 200, growth: 1.5,
    desc: (lv) => `Army size ${20 + lv * 3}`,
    apply: (cfg, lv) => { cfg.popCap += 3 * lv; },
  },
  wells: {
    id: 'wells', name: 'Deeper Wells', icon: 'wells', max: 10, base: 130, growth: 1.45,
    desc: (lv) => `+${lv * 10}% ink per Scribe trip`,
    apply: (cfg, lv) => { cfg.wellYield *= 1 + 0.1 * lv; },
  },
};

export const FORT_UPGRADE_ORDER = ['walls', 'turret', 'income', 'start_ink', 'scribes', 'pop', 'wells'];

export function fortUpgradeCost(id, level) {
  const u = FORT_UPGRADES[id];
  return Math.round((u.base * Math.pow(u.growth, level)) / 5) * 5;
}

// Spells upgrade 1 -> 5.
export function spellUpgradeCost(level) {
  return [0, 200, 420, 800, 1400][level] ?? Infinity;
}

// Base player team numbers before upgrades.
export const PLAYER_BASE = {
  startInk: 200, income: 2.5, popCap: 20, scribeCap: 4, wellYield: 1,
  fort: { hp: 2000, armor: 0, turretDmg: 12, turretRange: 470, turretCd: 1.6, turretShots: 1 },
};
