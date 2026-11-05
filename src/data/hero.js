// The Captain: stats growth, abilities and the skill tree. Ability and skill effects are
// implemented in src/sim/behaviors/hero.js (abilities) and src/game/teamcfg.js (passives).

export const HERO_MAX_LEVEL = 30;

// XP needed to go from `level` to `level + 1`.
export function heroXpToNext(level) {
  return Math.round(80 * Math.pow(level, 1.45));
}

export const HERO_GROWTH = { hp: 0.07, dmg: 0.06 }; // per level above 1, multiplicative on base
export const HERO_RESPAWN = 14; // seconds

export const HERO_ABILITIES = {
  rally: {
    id: 'rally', key: 'Q', name: 'Rally Cry', unlockLevel: 2, cd: 18,
    desc: 'Nearby allies deal 30% more damage and move 20% faster for 6 seconds.',
    radius: 320, dur: 6, dmg: 1.3, speed: 1.2,
  },
  slam: {
    id: 'slam', key: 'E', name: 'Ink Slam', unlockLevel: 4, cd: 10,
    desc: 'Leap forward and slam the ground, damaging and knocking back enemies.',
    leap: 170, radius: 120, dmg: 90, air: 0.35, kb: 320, stun: 0.3,
  },
  inkstorm: {
    id: 'inkstorm', key: 'R', name: 'Inkstorm', unlockLevel: 7, fury: 100,
    desc: 'When the Fury meter is full: spin into a storm of blades for 4 seconds.',
    dur: 4, dps: 120, radius: 95, tick: 0.25, speedMul: 1.15,
  },
};

// Basic combat feel: a 3-hit combo (the third swing is heavy), Fury meter, Inspire aura.
export const HERO_COMBO = { window: 1.3, heavyMult: 1.7, heavyRadius: 80, heavyKb: 2.4, heavyWindup: 1.45, steerAttackSpeed: 0.4 };
// Playtests: Inkstorm almost never came up in a normal fight, so Fury fills faster and starts a quarter full.
export const HERO_FURY = { max: 100, perDealt: 1 / 3.5, perTaken: 1 / 6, start: 25 };
export const HERO_INSPIRE = { radius: 260, interval: 0.5, perRank: 0.05 };

// Skill tree. Each level-up grants one point. req = minimum hero level.
export const HERO_SKILLS = [
  // Blade: the Captain himself
  { id: 'sharp_nib', branch: 'blade', name: 'Sharp Nib', max: 3, req: 1, desc: (r) => `+${r * 10}% Captain damage` },
  { id: 'thick_cape', branch: 'blade', name: 'Thick Cape', max: 3, req: 3, desc: (r) => `+${r * 12}% Captain health` },
  { id: 'lifesteal', branch: 'blade', name: 'Ink Thirst', max: 3, req: 6, desc: (r) => `Captain heals ${r * 6}% of damage dealt` },
  { id: 'whirlwind', branch: 'blade', name: 'Whirlwind', max: 2, req: 10, desc: (r) => `Inkstorm lasts +${r} s and fills Fury ${r * 25}% faster` },
  // Banner: the army
  { id: 'loud_voice', branch: 'banner', name: 'Loud Voice', max: 3, req: 2, desc: (r) => `Rally Cry +${r * 2} s and +${r * 60} radius` },
  { id: 'inspire', branch: 'banner', name: 'Inspire', max: 3, req: 4, desc: (r) => `Allies near the Captain deal +${r * 5}% damage` },
  { id: 'drill', branch: 'banner', name: 'Drill Sergeant', max: 3, req: 7, desc: (r) => `Units draw ${r * 6}% faster` },
  { id: 'warlord', branch: 'banner', name: 'Warlord', max: 2, req: 12, desc: (r) => `Units cost ${r * 6}% less ink` },
  // Quill: economy and spells
  { id: 'ink_saver', branch: 'quill', name: 'Ink Saver', max: 3, req: 2, desc: (r) => `+${(r * 0.3).toFixed(1)} passive ink/s` },
  { id: 'quick_return', branch: 'quill', name: 'Quick Return', max: 3, req: 5, desc: (r) => `Captain respawns ${r * 3} s faster` },
  { id: 'spell_mastery', branch: 'quill', name: 'Spell Mastery', max: 3, req: 8, desc: (r) => `Spells recharge ${r * 8}% faster` },
  { id: 'deep_pockets', branch: 'quill', name: 'Deep Pockets', max: 2, req: 11, desc: (r) => `+${r * 15}% gold from battles` },
];

export const HERO_SKILL_BY_ID = Object.fromEntries(HERO_SKILLS.map((s) => [s.id, s]));
export const HERO_BRANCHES = [
  { id: 'blade', name: 'Blade', color: '#ff9cc6' },
  { id: 'banner', name: 'Banner', color: '#93d1ff' },
  { id: 'quill', name: 'Quill', color: '#a6ee9a' },
];
