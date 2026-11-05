// Campaign: 5 chapters x 6 levels. Level 6 of each chapter is a boss.
// enemy.income = passive ink/s for the AI; it also runs `scribes` workers like the player.
// enemy.level = upgrade level of every enemy unit. aggression = how much stronger than you
// its army must be before it charges (lower = more aggressive). firstAttack = seconds of calm.
// script: timed events run by the AI commander: spawn (free units), stance, say (banner text).
// win: 'fort' (destroy the enemy fort), 'survive' (hold out for surviveTime), 'boss' (beat the boss).
// Hard mode ("Red Ink") replays every level with HARD_MODE multipliers.

export const MODIFIERS = {
  night: { name: 'Night Shift', desc: 'Lights out. You only see near your own army and fort.' },
  rain: { name: 'Rainy Page', desc: 'Ranged attacks are less accurate. Ink wells yield 50% more.' },
  wind_left: { name: 'Headwind', desc: 'A strong wind pushes every projectile left.' },
  wind_right: { name: 'Tailwind', desc: 'A strong wind pushes every projectile right.' },
  rush: { name: 'Ambush', desc: 'The enemy starts with an army already on the field.' },
  double_fort: { name: 'Fortified', desc: 'The enemy fort has double health.' },
  gold_rush: { name: 'Ink Rush', desc: 'The center ink well is huge. Fight for it.' },
  inkflation: { name: 'Inkflation', desc: 'Units cost 25% more, but you start with 300 extra ink.' },
  swarm: { name: 'Swarm', desc: 'Enemy units cost half, so expect a lot of them.' },
  coffee_stains: { name: 'Coffee Stains', desc: 'Sticky stains on the ground slow everyone who walks through.' },
};

// ---------------------------------------------------------------------------------------------
// BALANCE KNOBS. The level definitions below hold each level's identity (roster, weights, modifiers,
// script). Difficulty is tuned HERE and applied at load, so re-balancing after other packages land
// means re-running:   node tools/tune.mjs --write     (then check:  node tools/sim.mjs all --runs 5 --report)
//   level      added to enemy unit upgrade level (can be negative)
//   income, fortHp, startInk, army (maxArmy), turret (tower dmg)   multipliers
//   aggression added (lower = attacks sooner); firstAttack seconds added; bossAt seconds added
//   bossHp, bossDmg  multipliers on the level's boss (written into enemy.mods.byUnit)
// Scopes combine in this order: all, chapter (1-5), single level id, auto (written by the tuner).
export const TUNE = {
  all: { level: 0, income: 1, fortHp: 1, startInk: 1, army: 1, turret: 1, aggression: 0, firstAttack: 0, bossAt: 0, bossHp: 1, bossDmg: 1 },
  chapter: {}, // e.g. { 3: { level: -1 } }
  level: {}, // hand overrides, same keys as `all`
  // Written by `node tools/tune.mjs --write`: one dial per level found by bisection against the bot.
  auto: {
    // AUTOTUNE:BEGIN
    '1-1': {income: 1, startInk: 1, army: 1, fortHp: 1, turret: 1, level: 0},
    '1-2': {income: 1.145, startInk: 1.099, army: 1.114, fortHp: 1.077, turret: 1.049, level: 0},
    '1-3': {income: 1.289, startInk: 1.195, army: 1.225, fortHp: 1.15, turret: 1.093, level: 1},
    '1-4': {income: 1.385, startInk: 1.256, army: 1.298, fortHp: 1.196, turret: 1.121, level: 1},
    '1-5': {income: 1.481, startInk: 1.316, army: 1.369, fortHp: 1.241, turret: 1.147, level: 1},
    '1-6': {income: 1.433, startInk: 1.287, army: 1.334, fortHp: 1.219, turret: 1.134, level: 1, bossHp: 1.241, bossDmg: 1.155},
    '2-1': {income: 1.767, startInk: 1.49, army: 1.577, fortHp: 1.368, turret: 1.221, level: 1},
    '2-2': {income: 1.767, startInk: 1.49, army: 1.577, fortHp: 1.368, turret: 1.221, level: 1},
    '2-3': {income: 1.767, startInk: 1.49, army: 1.577, fortHp: 1.368, turret: 1.221, level: 1},
    '2-4': {income: 1.672, startInk: 1.433, army: 1.509, fortHp: 1.327, turret: 1.197, level: 1},
    '2-5': {income: 0.47, startInk: 0.59, army: 0.547, fortHp: 0.66, turret: 0.768, level: -2},
    '2-6': {income: 0.425, startInk: 0.55, army: 0.505, fortHp: 0.625, turret: 0.741, level: -2, bossHp: 0.599, bossDmg: 0.71},
    '3-1': {income: 1.674, startInk: 1.434, army: 1.51, fortHp: 1.328, turret: 1.198, level: 1},
    '3-2': {income: 1.154, startInk: 1.105, army: 1.121, fortHp: 1.082, turret: 1.051, level: 0},
    '3-3': {income: 1.029, startInk: 1.02, army: 1.023, fortHp: 1.016, turret: 1.01, level: 0},
    '3-4': {income: 1.581, startInk: 1.378, army: 1.443, fortHp: 1.287, turret: 1.174, level: 1},
    '3-5': {income: 1.988, startInk: 1.618, army: 1.733, fortHp: 1.459, turret: 1.272, level: 1},
    '3-6': {income: 0.904, startInk: 0.932, army: 0.923, fortHp: 0.946, turret: 0.965, level: 0, bossHp: 0.941, bossDmg: 0.961},
    '4-1': {income: 2.294, startInk: 1.788, army: 1.943, fortHp: 1.579, turret: 1.337, level: 2},
    '4-2': {income: 0.74, startInk: 0.81, army: 0.786, fortHp: 0.847, turret: 0.9, level: -1},
    '4-3': {income: 0.818, startInk: 0.869, army: 0.851, fortHp: 0.895, turret: 0.932, level: 0},
    '4-4': {income: 0.605, startInk: 0.703, army: 0.669, fortHp: 0.758, turret: 0.839, level: -1},
    '4-5': {income: 0.778, startInk: 0.839, army: 0.818, fortHp: 0.871, turret: 0.916, level: -1},
    '4-6': {income: 0.669, startInk: 0.755, army: 0.725, fortHp: 0.801, turret: 0.869, level: -1, bossHp: 0.786, bossDmg: 0.851},
    '5-1': {income: 0.447, startInk: 0.569, army: 0.525, fortHp: 0.642, turret: 0.755, level: -2},
    '5-2': {income: 0.21, startInk: 0.336, army: 0.287, fortHp: 0.424, turret: 0.579, level: -3},
    '5-3': {income: 1, startInk: 1, army: 1, fortHp: 1, turret: 1, level: 0},
    '5-4': {income: 0.86, startInk: 0.9, army: 0.886, fortHp: 0.92, turret: 0.949, level: 0},
    '5-5': {income: 0.495, startInk: 0.611, army: 0.569, fortHp: 0.679, turret: 0.782, level: -1},
    '5-6': {income: 0.447, startInk: 0.569, army: 0.525, fortHp: 0.642, turret: 0.755, level: -2, bossHp: 0.617, bossDmg: 0.725},
    // AUTOTUNE:END
  },
};

export const HARD_MODE = { enemyHp: 1.6, enemyDmg: 1.35, enemyIncome: 1.45, fortHp: 1.5, levelBonus: 2, gold: 1.8 };

const L = (o) => o;

export const LEVELS = [
  // ---------------------------------------------------------------- Chapter 1: The Margin (Red)
  L({ id: '1-1', chapter: 1, n: 1, name: 'First Strokes', page: 'ruled', faction: 'red', width: 2400, tutorial: 'basics',
    intro: 'A few Red Pen Rebels are scribbling in our margin. Draw Scribes for ink, then Brawlers, and push them off the page.',
    enemy: { fortHp: 1000, turret: { dmg: 6, range: 400, cd: 2 }, startInk: 60, income: 0.8, scribes: 1, level: 1,
      roster: ['brawler'], weights: { brawler: 1 }, aggression: 1.6, firstAttack: 75, maxArmy: 6 },
    rewards: { gold: 120, xp: 60, unlock: { unit: 'slinger' } }, win: 'fort' }),
  L({ id: '1-2', chapter: 1, n: 2, name: 'Margin Skirmish', page: 'ruled', faction: 'red', width: 2600, tutorial: 'spells',
    intro: 'The Rebels brought slingers. Keep your Brawlers in front and your Slingers behind them.',
    enemy: { fortHp: 1300, turret: { dmg: 8, range: 420, cd: 1.9 }, startInk: 100, income: 1.1, scribes: 2, level: 1,
      roster: ['brawler', 'slinger'], weights: { brawler: 2, slinger: 1 }, aggression: 1.4, firstAttack: 60, maxArmy: 9 },
    rewards: { gold: 140, xp: 70, unlock: { spell: 'pencil_rain' } }, win: 'fort' }),
  L({ id: '1-3', chapter: 1, n: 3, name: 'Hold the Line', page: 'ruled', faction: 'red', width: 2600, tutorial: 'stance',
    intro: 'Ambush! They are already marching. Stay on DEFEND until your army is ready, then CHARGE.',
    enemy: { fortHp: 1400, turret: { dmg: 8, range: 420, cd: 1.9 }, startInk: 120, income: 1.2, scribes: 2, level: 1,
      roster: ['brawler', 'slinger'], weights: { brawler: 3, slinger: 2 }, aggression: 1.3, firstAttack: 20, maxArmy: 10,
      startUnits: { brawler: 4, slinger: 2 } },
    modifiers: ['rush'], rewards: { gold: 160, xp: 80, unlock: { unit: 'shieldbearer' } }, win: 'fort' }),
  L({ id: '1-4', chapter: 1, n: 4, name: 'Red Tide', page: 'ruled', faction: 'red', width: 2800, tutorial: 'hero',
    intro: 'A big Rebel push is coming. Your Captain can fight on the front line. Move him with A and D.',
    enemy: { fortHp: 1700, turret: { dmg: 10, range: 440, cd: 1.8 }, startInk: 150, income: 1.5, scribes: 3, level: 2,
      roster: ['brawler', 'slinger', 'shieldbearer'], weights: { brawler: 3, slinger: 2, shieldbearer: 1 }, aggression: 1.25, firstAttack: 55, maxArmy: 12 },
    script: [{ t: 100, spawn: { brawler: 4, shieldbearer: 1 }, say: 'Red tide incoming!' }],
    rewards: { gold: 180, xp: 90, unlock: { spell: 'coffee_spill' } }, win: 'fort' }),
  L({ id: '1-5', chapter: 1, n: 5, name: 'Ink Wells', page: 'ruled', faction: 'red', width: 3000,
    intro: 'A huge ink well sits in the middle of the page. Whoever holds it wins the ink race.',
    enemy: { fortHp: 1900, turret: { dmg: 11, range: 450, cd: 1.8 }, startInk: 160, income: 1.6, scribes: 4, level: 2,
      roster: ['brawler', 'slinger', 'shieldbearer', 'spearman'], weights: { brawler: 3, slinger: 2, shieldbearer: 1, spearman: 1 }, aggression: 1.2, firstAttack: 50, maxArmy: 14 },
    modifiers: ['gold_rush'], rewards: { gold: 200, xp: 100, unlock: { unit: 'spearman' } }, win: 'fort' }),
  L({ id: '1-6', chapter: 1, n: 6, name: 'General Redline', page: 'ruled', faction: 'red', width: 3000, boss: 'boss_redline',
    intro: 'General Redline himself takes the field. Spearmen hit big targets hard. Bring them.',
    enemy: { fortHp: 2400, turret: { dmg: 12, range: 460, cd: 1.7 }, startInk: 200, income: 1.8, scribes: 4, level: 3,
      roster: ['brawler', 'slinger', 'shieldbearer', 'spearman'], weights: { brawler: 3, slinger: 2, shieldbearer: 1, spearman: 1 }, aggression: 1.2, firstAttack: 45, maxArmy: 14,
      bossAt: 40 },
    rewards: { gold: 320, xp: 160, unlock: { unit: 'archer', hat: 'red_plume' } }, win: 'fort' }),

  // ---------------------------------------------------------------- Chapter 2: Graph Paper (Graphite)
  L({ id: '2-1', chapter: 2, n: 1, name: 'The Smudge', page: 'graph', faction: 'graphite', width: 3000,
    intro: 'Smudgelings come in swarms. Archers and splash damage are your friends.',
    enemy: { fortHp: 2400, turret: { dmg: 12, range: 460, cd: 1.7 }, startInk: 180, income: 2.0, scribes: 4, level: 3,
      roster: ['smudgeling', 'lead_thrower'], weights: { smudgeling: 5, lead_thrower: 1 }, aggression: 1.15, firstAttack: 50, maxArmy: 18 },
    rewards: { gold: 260, xp: 120, unlock: { unit: 'bomber' } }, win: 'fort' }),
  L({ id: '2-2', chapter: 2, n: 2, name: 'Grid Lock', page: 'graph', faction: 'graphite', width: 3000,
    intro: 'A headwind is blowing across the grid. Your arrows will fall short, theirs will fly far.',
    enemy: { fortHp: 2600, turret: { dmg: 13, range: 470, cd: 1.7 }, startInk: 200, income: 2.1, scribes: 4, level: 3,
      roster: ['smudgeling', 'lead_thrower', 'spearman'], weights: { smudgeling: 4, lead_thrower: 2, spearman: 1 }, aggression: 1.15, firstAttack: 45, maxArmy: 18 },
    modifiers: ['wind_left'], rewards: { gold: 270, xp: 125, unlock: { spell: 'ruler_smash' } }, win: 'fort' }),
  L({ id: '2-3', chapter: 2, n: 3, name: 'Sharpened', page: 'graph', faction: 'graphite', width: 3100,
    intro: 'Sharpeners get deadlier as they get hurt. Finish them fast.',
    enemy: { fortHp: 2800, turret: { dmg: 14, range: 470, cd: 1.6 }, startInk: 220, income: 2.3, scribes: 5, level: 4,
      roster: ['smudgeling', 'sharpener', 'lead_thrower'], weights: { smudgeling: 3, sharpener: 3, lead_thrower: 2 }, aggression: 1.1, firstAttack: 45, maxArmy: 18 },
    rewards: { gold: 280, xp: 130, unlock: { unit: 'medic' } }, win: 'fort' }),
  L({ id: '2-4', chapter: 2, n: 4, name: 'Lead Rain', page: 'graph', faction: 'graphite', width: 3100,
    intro: 'It is pouring. Ranged shots are wild, but the ink wells overflow.',
    enemy: { fortHp: 3000, turret: { dmg: 15, range: 480, cd: 1.6 }, startInk: 240, income: 2.4, scribes: 5, level: 4,
      roster: ['smudgeling', 'sharpener', 'lead_thrower', 'shieldbearer'], weights: { smudgeling: 3, sharpener: 2, lead_thrower: 3, shieldbearer: 1 }, aggression: 1.1, firstAttack: 40, maxArmy: 20 },
    modifiers: ['rain'], rewards: { gold: 290, xp: 135, unlock: { spell: 'paper_planes' } }, win: 'fort' }),
  L({ id: '2-5', chapter: 2, n: 5, name: 'Golem Grounds', page: 'graph', faction: 'graphite', width: 3200,
    intro: 'Graphite Golems shatter into Smudgelings when they fall. Have a plan for the pieces.',
    enemy: { fortHp: 3300, turret: { dmg: 16, range: 480, cd: 1.6 }, startInk: 260, income: 2.6, scribes: 5, level: 4,
      roster: ['smudgeling', 'sharpener', 'lead_thrower', 'graphite_golem'], weights: { smudgeling: 3, sharpener: 2, lead_thrower: 2, graphite_golem: 1 }, aggression: 1.1, firstAttack: 45, maxArmy: 22 },
    script: [{ t: 120, spawn: { graphite_golem: 1 }, say: 'A Golem rises from the shavings!' }],
    rewards: { gold: 300, xp: 140, unlock: { unit: 'rider' } }, win: 'fort' }),
  L({ id: '2-6', chapter: 2, n: 6, name: 'Old Smudge', page: 'graph', faction: 'graphite', width: 3200, boss: 'boss_smudge',
    intro: 'Old Smudge is waking up. Its slams roll along the ground. Do not bunch up in front of it.',
    enemy: { fortHp: 3800, turret: { dmg: 17, range: 490, cd: 1.5 }, startInk: 280, income: 2.7, scribes: 5, level: 5,
      roster: ['smudgeling', 'sharpener', 'lead_thrower'], weights: { smudgeling: 4, sharpener: 2, lead_thrower: 2 }, aggression: 1.1, firstAttack: 40, maxArmy: 22,
      bossAt: 35 },
    rewards: { gold: 480, xp: 220, unlock: { hat: 'pencil_crown' } }, win: 'fort' }),

  // ---------------------------------------------------------------- Chapter 3: The Sketchbook (Neon)
  L({ id: '3-1', chapter: 3, n: 1, name: 'Glow Up', page: 'sketch', faction: 'neon', width: 3200,
    intro: 'Glowrunners are fast. Get a front line down early or they will be at your Scribes.',
    enemy: { fortHp: 3800, turret: { dmg: 18, range: 490, cd: 1.5 }, startInk: 280, income: 2.8, scribes: 5, level: 5,
      roster: ['glowrunner', 'neon_archer'], weights: { glowrunner: 4, neon_archer: 2 }, aggression: 1.05, firstAttack: 35, maxArmy: 22 },
    rewards: { gold: 360, xp: 160, unlock: { unit: 'doodler' } }, win: 'fort' }),
  L({ id: '3-2', chapter: 3, n: 2, name: 'Night Highlights', page: 'sketch', faction: 'neon', width: 3200,
    intro: 'Lights out. You can only see near your own units. The neon glows, though.',
    enemy: { fortHp: 4000, turret: { dmg: 18, range: 490, cd: 1.5 }, startInk: 300, income: 2.9, scribes: 5, level: 5,
      roster: ['glowrunner', 'neon_archer', 'marker_knight'], weights: { glowrunner: 3, neon_archer: 2, marker_knight: 1 }, aggression: 1.05, firstAttack: 40, maxArmy: 22 },
    modifiers: ['night'], rewards: { gold: 370, xp: 165, unlock: { spell: 'sticky_wall' } }, win: 'fort' }),
  L({ id: '3-3', chapter: 3, n: 3, name: 'Burning Bright', page: 'sketch', faction: 'neon', width: 3300,
    intro: 'Neon arrows keep burning. Medics help, and so does killing the archers first.',
    enemy: { fortHp: 4300, turret: { dmg: 19, range: 500, cd: 1.5 }, startInk: 320, income: 3.0, scribes: 6, level: 6,
      roster: ['glowrunner', 'neon_archer', 'marker_knight', 'bomber'], weights: { glowrunner: 3, neon_archer: 3, marker_knight: 1, bomber: 1 }, aggression: 1.0, firstAttack: 40, maxArmy: 24 },
    rewards: { gold: 380, xp: 170, unlock: { unit: 'catapult' } }, win: 'fort' }),
  L({ id: '3-4', chapter: 3, n: 4, name: 'Marker Wall', page: 'sketch', faction: 'neon', width: 3300,
    intro: 'Their fort is reinforced and guarded by Marker Knights. Bring siege.',
    enemy: { fortHp: 4500, turret: { dmg: 20, range: 500, cd: 1.4 }, startInk: 340, income: 3.1, scribes: 6, level: 6,
      roster: ['glowrunner', 'neon_archer', 'marker_knight', 'glow_shaman'], weights: { glowrunner: 2, neon_archer: 2, marker_knight: 3, glow_shaman: 1 }, aggression: 1.05, firstAttack: 45, maxArmy: 24 },
    modifiers: ['double_fort'], rewards: { gold: 390, xp: 175, unlock: { spell: 'stapler' } }, win: 'fort' }),
  L({ id: '3-5', chapter: 3, n: 5, name: 'Shaman Circle', page: 'sketch', faction: 'neon', width: 3400,
    intro: 'Glow Shamans keep the Gang fresh. Ninjas would be handy here. So would Riders.',
    enemy: { fortHp: 4800, turret: { dmg: 21, range: 510, cd: 1.4 }, startInk: 360, income: 3.3, scribes: 6, level: 6,
      roster: ['glowrunner', 'neon_archer', 'marker_knight', 'glow_shaman', 'rider'], weights: { glowrunner: 3, neon_archer: 2, marker_knight: 2, glow_shaman: 2, rider: 1 }, aggression: 1.0, firstAttack: 40, maxArmy: 26 },
    rewards: { gold: 400, xp: 180, unlock: { hat: 'party' } }, win: 'fort' }),
  L({ id: '3-6', chapter: 3, n: 6, name: 'The Neon Wyrm', page: 'sketch', faction: 'neon', width: 3400, boss: 'boss_wyrm',
    intro: 'The Wyrm flies out of reach of swords. Archers, Slingers and spells can hit it. It lands to stomp.',
    enemy: { fortHp: 5200, turret: { dmg: 22, range: 510, cd: 1.4 }, startInk: 380, income: 3.4, scribes: 6, level: 7,
      roster: ['glowrunner', 'neon_archer', 'marker_knight'], weights: { glowrunner: 3, neon_archer: 2, marker_knight: 2 }, aggression: 1.0, firstAttack: 40, maxArmy: 24,
      bossAt: 30 },
    rewards: { gold: 600, xp: 280, unlock: { hat: 'neon_horns' } }, win: 'fort' }),

  // ---------------------------------------------------------------- Chapter 4: The Chalkboard (Chalk)
  L({ id: '4-1', chapter: 4, n: 1, name: 'Dust to Dust', page: 'chalk', faction: 'chalk', width: 3400,
    intro: 'Dustborn get back up once. Hit them twice as hard. The Colossus is ready to help.',
    enemy: { fortHp: 5200, turret: { dmg: 22, range: 510, cd: 1.4 }, startInk: 380, income: 3.5, scribes: 6, level: 7,
      roster: ['dustborn', 'chalk_thrower'], weights: { dustborn: 4, chalk_thrower: 2 }, aggression: 1.0, firstAttack: 40, maxArmy: 26 },
    rewards: { gold: 450, xp: 200, unlock: { unit: 'colossus' } }, win: 'fort' }),
  L({ id: '4-2', chapter: 4, n: 2, name: 'Pop Quiz', page: 'chalk', faction: 'chalk', width: 3400,
    intro: 'Chalk dust slows your army. Keep moving and keep your ranged units safe.',
    enemy: { fortHp: 5500, turret: { dmg: 23, range: 520, cd: 1.35 }, startInk: 400, income: 3.6, scribes: 6, level: 7,
      roster: ['dustborn', 'chalk_thrower', 'board_brute'], weights: { dustborn: 3, chalk_thrower: 3, board_brute: 1 }, aggression: 1.0, firstAttack: 40, maxArmy: 26 },
    rewards: { gold: 460, xp: 205, unlock: { spell: 'highlighter' } }, win: 'fort' }),
  L({ id: '4-3', chapter: 4, n: 3, name: 'Detention', page: 'chalk', faction: 'chalk', width: 3200,
    intro: 'Survive four minutes of detention. Their fort cannot be hurt, so hold your ground.',
    enemy: { fortHp: 5500, turret: { dmg: 23, range: 520, cd: 1.35 }, startInk: 500, income: 4.6, scribes: 6, level: 7,
      roster: ['dustborn', 'chalk_thrower', 'board_brute', 'dust_mage'], weights: { dustborn: 4, chalk_thrower: 3, board_brute: 1, dust_mage: 1 }, aggression: 0.8, firstAttack: 20, maxArmy: 30 },
    script: [{ t: 60, spawn: { board_brute: 1, dustborn: 3 }, say: 'More students arrive!' }, { t: 150, spawn: { board_brute: 2, dust_mage: 1 }, say: 'The final bell is near!' }],
    win: 'survive', surviveTime: 240, rewards: { gold: 470, xp: 210, unlock: { unit: 'ninja' } } }),
  L({ id: '4-4', chapter: 4, n: 4, name: 'Board Meeting', page: 'chalk', faction: 'chalk', width: 3500,
    intro: 'Board Brutes lead this push. Spearmen and Ninjas cut them down.',
    enemy: { fortHp: 6000, turret: { dmg: 24, range: 520, cd: 1.3 }, startInk: 420, income: 3.8, scribes: 7, level: 8,
      roster: ['dustborn', 'chalk_thrower', 'board_brute', 'dust_mage'], weights: { dustborn: 3, chalk_thrower: 2, board_brute: 3, dust_mage: 1 }, aggression: 1.0, firstAttack: 40, maxArmy: 28 },
    rewards: { gold: 480, xp: 215, unlock: { spell: 'doodle_drop' } }, win: 'fort' }),
  L({ id: '4-5', chapter: 4, n: 5, name: 'Dust Storm', page: 'chalk', faction: 'chalk', width: 3500,
    intro: 'A tailwind carries chalk across the board. Your arrows fly far today.',
    enemy: { fortHp: 6300, turret: { dmg: 25, range: 530, cd: 1.3 }, startInk: 440, income: 4.0, scribes: 7, level: 8,
      roster: ['dustborn', 'chalk_thrower', 'board_brute', 'dust_mage', 'archer'], weights: { dustborn: 3, chalk_thrower: 2, board_brute: 2, dust_mage: 2, archer: 1 }, aggression: 0.95, firstAttack: 40, maxArmy: 28 },
    modifiers: ['wind_right'], rewards: { gold: 490, xp: 220, unlock: { hat: 'mortarboard' } }, win: 'fort' }),
  L({ id: '4-6', chapter: 4, n: 6, name: 'The Professor', page: 'chalk', faction: 'chalk', width: 3500, boss: 'boss_professor',
    intro: 'The Professor freezes anyone standing near him when he calls a pop quiz. Watch for the question marks.',
    enemy: { fortHp: 6800, turret: { dmg: 26, range: 530, cd: 1.3 }, startInk: 460, income: 4.1, scribes: 7, level: 9,
      roster: ['dustborn', 'chalk_thrower', 'board_brute'], weights: { dustborn: 3, chalk_thrower: 2, board_brute: 2 }, aggression: 0.95, firstAttack: 40, maxArmy: 26,
      bossAt: 30 },
    rewards: { gold: 760, xp: 340, unlock: { hat: 'professor_glasses' } }, win: 'fort' }),

  // ---------------------------------------------------------------- Chapter 5: The Last Page (Eraser)
  L({ id: '5-1', chapter: 5, n: 1, name: 'Rubbed Out', page: 'last', faction: 'eraser', width: 3500,
    intro: 'Eraser Knights rub out your buffs and stop your healing. Overwhelm them.',
    enemy: { fortHp: 6800, turret: { dmg: 26, range: 530, cd: 1.3 }, startInk: 460, income: 4.2, scribes: 7, level: 9,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger'], weights: { crumb: 3, eraser_knight: 3, shaving_slinger: 2 }, aggression: 0.95, firstAttack: 40, maxArmy: 28 },
    rewards: { gold: 540, xp: 240, unlock: { hat: 'eraser_cap' } }, win: 'fort' }),
  L({ id: '5-2', chapter: 5, n: 2, name: 'Crumbs', page: 'last', faction: 'eraser', width: 3500,
    intro: 'A flood of crumbs. Splash damage, splash damage, splash damage.',
    enemy: { fortHp: 7200, turret: { dmg: 27, range: 540, cd: 1.25 }, startInk: 480, income: 4.4, scribes: 7, level: 9,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger'], weights: { crumb: 6, eraser_knight: 1, shaving_slinger: 2 }, aggression: 0.9, firstAttack: 35, maxArmy: 32 },
    modifiers: ['swarm'], rewards: { gold: 550, xp: 245, unlock: { spell: 'eraser' } }, win: 'fort' }),
  L({ id: '5-3', chapter: 5, n: 3, name: 'Correction', page: 'last', faction: 'eraser', width: 3600,
    intro: 'Whiteout Priests paint fallen Erasers back onto the page. Take them out first.',
    enemy: { fortHp: 7600, turret: { dmg: 28, range: 540, cd: 1.25 }, startInk: 500, income: 4.6, scribes: 7, level: 10,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest'], weights: { crumb: 3, eraser_knight: 3, shaving_slinger: 2, whiteout_priest: 2 }, aggression: 0.95, firstAttack: 40, maxArmy: 30 },
    rewards: { gold: 560, xp: 250, unlock: { hat: 'halo' } }, win: 'fort' }),
  L({ id: '5-4', chapter: 5, n: 4, name: 'Smudged Ink', page: 'last', faction: 'eraser', width: 3600,
    intro: 'Night and rain at once. Keep your army together and your Medics close.',
    enemy: { fortHp: 8000, turret: { dmg: 29, range: 540, cd: 1.2 }, startInk: 520, income: 4.8, scribes: 8, level: 10,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest', 'ninja'], weights: { crumb: 3, eraser_knight: 2, shaving_slinger: 2, whiteout_priest: 1, ninja: 1 }, aggression: 0.9, firstAttack: 40, maxArmy: 30 },
    modifiers: ['night', 'rain'], rewards: { gold: 570, xp: 255, unlock: { hat: 'ninja_mask' } }, win: 'fort' }),
  L({ id: '5-5', chapter: 5, n: 5, name: 'The Last Margin', page: 'last', faction: 'eraser', width: 3800,
    intro: 'Everything they have left. This is the last margin before the Hand.',
    enemy: { fortHp: 8800, turret: { dmg: 30, range: 550, cd: 1.2 }, startInk: 560, income: 5.0, scribes: 8, level: 10,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest', 'colossus', 'ninja'], weights: { crumb: 3, eraser_knight: 2, shaving_slinger: 2, whiteout_priest: 1, colossus: 1, ninja: 1 }, aggression: 0.9, firstAttack: 40, maxArmy: 34 },
    script: [{ t: 150, spawn: { colossus: 1, eraser_knight: 2 }, say: 'The Empire throws everything at you!' }],
    rewards: { gold: 600, xp: 270, unlock: { hat: 'golden_quill' } }, win: 'fort' }),
  L({ id: '5-6', chapter: 5, n: 6, name: 'The Hand', page: 'last', faction: 'eraser', width: 3600, boss: 'boss_hand',
    intro: 'The Hand that draws the page has come to erase it. Watch for its shadow and get out of the way.',
    enemy: { fortHp: 9000, turret: { dmg: 30, range: 550, cd: 1.2 }, startInk: 500, income: 4.6, scribes: 8, level: 11,
      roster: ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest'], weights: { crumb: 3, eraser_knight: 2, shaving_slinger: 2, whiteout_priest: 1 }, aggression: 0.95, firstAttack: 40, maxArmy: 30,
      bossAt: 20, invulnerableFort: true },
    win: 'boss', rewards: { gold: 1200, xp: 500, unlock: { hat: 'crown', mode: 'hard' } } }),
];

const BASE_ENEMY = LEVELS.map((l) => JSON.parse(JSON.stringify(l.enemy)));

// Re-derive every level's enemy block from its untuned base and the current TUNE (tools/tune.mjs calls this).
export function retune() {
  LEVELS.forEach((L, i) => {
    const e = (L.enemy = JSON.parse(JSON.stringify(BASE_ENEMY[i])));
    const t = { level: 0, income: 1, fortHp: 1, startInk: 1, army: 1, turret: 1, aggression: 0, firstAttack: 0, bossAt: 0, bossHp: 1, bossDmg: 1 };
    for (const src of [TUNE.all, TUNE.chapter[L.chapter], TUNE.level[L.id], TUNE.auto[L.id]]) {
      if (!src) continue;
      for (const k in src) t[k] = ['level', 'aggression', 'firstAttack', 'bossAt'].includes(k) ? t[k] + src[k] : t[k] * src[k];
    }
    e.level = Math.max(1, Math.round((e.level || 1) + t.level));
    e.income = +((e.income ?? 1.5) * t.income).toFixed(3);
    e.fortHp = Math.round((e.fortHp ?? 1500) * t.fortHp);
    e.startInk = Math.round((e.startInk ?? 150) * t.startInk);
    e.maxArmy = Math.max(3, Math.round((e.maxArmy ?? 20) * t.army));
    if (e.turret) e.turret = { ...e.turret, dmg: Math.round(e.turret.dmg * t.turret) };
    e.aggression = +((e.aggression ?? 1.2) + t.aggression).toFixed(2);
    e.firstAttack = Math.max(5, Math.round((e.firstAttack ?? 45) + t.firstAttack));
    if (e.bossAt != null) e.bossAt = Math.max(5, e.bossAt + t.bossAt);
    if (L.boss && (t.bossHp !== 1 || t.bossDmg !== 1)) {
      e.mods = { ...(e.mods || {}), byUnit: { ...((e.mods && e.mods.byUnit) || {}), [L.boss]: { hp: t.bossHp, dmg: t.bossDmg } } };
    }
  });
  return LEVELS;
}
retune();

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function nextLevelId(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}

// Stars: 1 = win, 2 = fort above 50%, 3 = fort above 80%.
export function starsFor(result) {
  if (!result || result.winner !== 0) return 0;
  const f = result.fortHpPct ?? 1;
  return f >= 0.8 ? 3 : f >= 0.5 ? 2 : 1;
}
