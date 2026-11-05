// Commander "supplies": school-supply spells. Free to cast, gated by cooldown.
// Implementations live in src/sim/spells/<id>.js and register into SPELL_IMPL.
// target: 'area' (click a spot, radius shown), 'line' (strip `width` wide centered on click),
//         'point' (exact spot), 'global' (no target), 'ally' (area that helps your units)
// lv: per-upgrade-level values, index 0 = level 1. Upgrade costs in data/upgrades.js.

export const SPELLS = {
  pencil_rain: {
    id: 'pencil_rain', name: 'Pencil Rain', target: 'area', radius: 140, cd: 28,
    desc: 'A dozen sharpened pencils drop on the target area.',
    lv: { dmg: [40, 47, 55, 64, 75], count: [12, 13, 14, 16, 18] },
  },
  coffee_spill: {
    id: 'coffee_spill', name: 'Coffee Spill', target: 'area', radius: 160, cd: 40,
    desc: 'Knock over a hot coffee. Enemies in the puddle burn and slow down for 6 seconds.',
    lv: { dps: [14, 17, 20, 24, 28], slow: [0.4, 0.42, 0.45, 0.48, 0.5], dur: [6, 6, 6.5, 7, 7.5] },
  },
  ruler_smash: {
    id: 'ruler_smash', name: 'Ruler Smash', target: 'line', width: 320, cd: 45,
    desc: 'A giant ruler slams down, damaging and stunning everything in a long strip.',
    lv: { dmg: [140, 165, 190, 220, 255], stun: [1.0, 1.1, 1.2, 1.35, 1.5] },
  },
  paper_planes: {
    id: 'paper_planes', name: 'Paper Planes', target: 'global', cd: 60,
    desc: 'A squadron of paper planes flies across the page, dropping ink bombs on enemies.',
    lv: { planes: [5, 6, 6, 7, 8], dmg: [55, 62, 70, 80, 92], radius: [70, 70, 75, 80, 85] },
  },
  sticky_wall: {
    id: 'sticky_wall', name: 'Sticky Wall', target: 'point', cd: 45,
    desc: 'Slap down a stack of sticky notes. Enemies must chew through it to pass.',
    lv: { hp: [900, 1100, 1300, 1550, 1850], dur: [20, 22, 24, 26, 28] },
  },
  stapler: {
    id: 'stapler', name: 'Stapler', target: 'area', radius: 130, cd: 35,
    desc: 'Staples enemies to the page. They cannot move for a few seconds.',
    lv: { dmg: [30, 36, 42, 50, 60], root: [3, 3.3, 3.6, 4, 4.5] },
  },
  highlighter: {
    id: 'highlighter', name: 'Highlighter', target: 'ally', radius: 200, cd: 45,
    desc: 'Highlights your units: more damage and steady healing for a few seconds.',
    lv: { dmg: [0.5, 0.55, 0.6, 0.7, 0.8], heal: [0.25, 0.28, 0.31, 0.35, 0.4], dur: [6, 6, 6.5, 7, 7.5] },
  },
  doodle_drop: {
    id: 'doodle_drop', name: 'Doodle Drop', target: 'point', cd: 60,
    desc: 'Quickly sketch a squad of Brawlers right where you need them.',
    lv: { count: [4, 4, 5, 5, 6], level: [0, 1, 2, 3, 4] },
  },
  eraser: {
    id: 'eraser', name: 'The Eraser', target: 'line', width: 220, cd: 80,
    desc: 'Rub out a whole section of the enemy army.',
    lv: { dmg: [320, 380, 450, 530, 620], dur: [2.2, 2.2, 2.4, 2.4, 2.6] },
  },
};

export const SPELL_ORDER = ['pencil_rain', 'coffee_spill', 'ruler_smash', 'paper_planes', 'sticky_wall', 'stapler', 'highlighter', 'doodle_drop', 'eraser'];
export const MAX_SPELL_SLOTS = 3;
export const SPELL_MAX_LEVEL = 5;

export function spellValue(id, key, level) {
  const arr = SPELLS[id].lv[key];
  return arr[Math.max(0, Math.min(arr.length - 1, (level | 0) - 1))];
}
