// Builds Battle configs for each way to play. OWNER: AI/levels/modes builder (package C)
// registers 'endless', 'daily' and 'skirmish' into MODE_BUILDERS.
import { seedFromString } from '../core/rng.js';
import { LEVEL_BY_ID } from '../data/levels.js';
import { FACTIONS } from '../data/factions.js';
import { UNITS } from '../data/units.js';
import { CHAPTERS } from '../data/pages.js';
import { roleWeights } from '../sim/ai.js';
import { playerTeamConfig, enemyTeamConfig } from './teamcfg.js';
import { REWARD_HOOKS } from './progression.js';

// MODE_BUILDERS[kind] = (opts, profile) -> battle cfg
export const MODE_BUILDERS = {};

export function buildBattleConfig(opts, profile) {
  if (opts.kind === 'campaign') return campaignConfig(opts, profile);
  if (opts.kind === 'demo') return demoConfig(opts);
  const fn = MODE_BUILDERS[opts.kind];
  if (!fn) throw new Error('Unknown battle kind ' + opts.kind);
  return fn(opts, profile);
}

export function campaignConfig(opts, profile) {
  const level = LEVEL_BY_ID[opts.levelId];
  if (!level) throw new Error('Unknown level ' + opts.levelId);
  const plays = (profile.levels[level.id] && profile.levels[level.id].plays) || 0;
  return {
    mode: 'campaign',
    kind: 'campaign',
    seed: opts.seed ?? (seedFromString(level.id) + plays * 7919),
    width: level.width,
    page: level.page,
    level,
    hard: !!opts.hard,
    tutorial: opts.hard ? null : level.tutorial || null,
    modifiers: (level.modifiers || []).slice(),
    teams: [playerTeamConfig(profile), enemyTeamConfig(level, { hard: opts.hard, profile })],
  };
}

// Title-screen background battle between two AI armies.
const DEMO_SETS = [
  { page: 'ruled', a: ['brawler', 'slinger', 'spearman', 'archer', 'shieldbearer'], b: 'red' },
  { page: 'graph', a: ['brawler', 'archer', 'rider', 'medic', 'spearman'], b: 'graphite' },
  { page: 'sketch', a: ['brawler', 'archer', 'bomber', 'shieldbearer', 'rider'], b: 'neon' },
];

export function demoConfig(opts) {
  const n = (opts.seed || 1) % DEMO_SETS.length;
  const set = DEMO_SETS[n];
  const enemyRoster = FACTIONS[set.b].roster.filter((id) => id !== 'scribe').slice(0, 5);
  const weights = (r) => Object.fromEntries(r.map((id, i) => [id, i === 0 ? 3 : 2]));
  // Both armies start on the field so the title screen opens on a fight, not an empty page.
  const army = (roster) => Object.fromEntries(roster.slice(0, 4).map((id, i) => [id, i === 0 ? 5 : 3]));
  const team = (faction, roster) => ({
    faction, startInk: 300, income: 4, popCap: 30, scribeCap: 3, roster: ['scribe', ...roster],
    unitLevels: {}, fort: { hp: 2600, turretDmg: 8, turretRange: 420, turretCd: 2 },
    startUnits: army(roster),
    ai: { scribes: 3, weights: weights(roster), aggression: 0.6, firstAttack: 0, maxArmy: 22 },
  });
  return {
    mode: 'demo', kind: 'demo', seed: opts.seed || 1, width: 2200, page: set.page, level: null, modifiers: [],
    teams: [team('ink', set.a), team(set.b, enemyRoster)],
  };
}

// ---------------------------------------------------------------- shared enemy generator (Daily, Skirmish)
const mix = (a, b, p) => a + (b - a) * p;

// A level.enemy-style block for any faction at a given power (0 = chapter 1 feel, 1 = chapter 5 feel).
export function enemyBlock(faction, power, o = {}) {
  const p = Math.max(0, Math.min(1, power));
  const ids = ((FACTIONS[faction] && FACTIONS[faction].roster) || []).filter((id) => id !== 'scribe' && UNITS[id]);
  const roster = ids.filter((id) => UNITS[id].role !== 'heavy' || p > 0.45);
  const weights = roleWeights(roster);
  const maxArmy = Math.round(mix(8, 32, p));
  const e = {
    fortHp: Math.round(mix(1500, 9000, p) / 50) * 50,
    turret: { dmg: Math.round(mix(8, 30, p)), range: Math.round(mix(420, 550, p)), cd: +mix(1.9, 1.2, p).toFixed(2) },
    startInk: Math.round(mix(100, 520, p)),
    income: +mix(1.1, 5.0, p).toFixed(2),
    scribes: Math.round(mix(2, 8, p)),
    level: Math.max(1, Math.round(mix(1, 10, p))),
    roster, weights,
    aggression: +mix(1.4, 0.92, p).toFixed(2),
    firstAttack: Math.round(mix(60, 38, p)),
    maxArmy,
    waveEvery: Math.round(mix(72, 42, p)),
  };
  if (o.rush) {
    // A fair ambush: a small raiding party (3 to 5 units), never the whole page.
    const front = roster.filter((id) => UNITS[id].role === 'melee' || UNITS[id].role === 'tank').slice(0, 2);
    e.startUnits = {};
    const total = Math.round(mix(3, 5, p));
    front.forEach((id, i) => { e.startUnits[id] = i === 0 ? Math.ceil(total * 0.6) : Math.floor(total * 0.4); });
    e.firstAttack = Math.min(e.firstAttack, 25);
  }
  return Object.assign(e, o.override || {});
}

// ---------------------------------------------------------------- Skirmish
export const SKIRMISH = {
  easy: { power: 0.14, gold: 40 },
  normal: { power: 0.4, gold: 80 },
  hard: { power: 0.66, gold: 130 },
  brutal: { power: 0.9, gold: 200 },
};
export const SKIRMISH_FACTIONS = ['red', 'graphite', 'neon', 'chalk', 'eraser'];

MODE_BUILDERS.skirmish = (opts, profile) => {
  const faction = SKIRMISH_FACTIONS.includes(opts.faction) ? opts.faction : 'red';
  const diff = SKIRMISH[opts.difficulty] ? opts.difficulty : 'normal';
  const ch = CHAPTERS.find((c) => c.faction === faction);
  const level = { id: 'skirmish', faction, enemy: enemyBlock(faction, SKIRMISH[diff].power), win: 'fort', script: [] };
  const width = Math.max(2200, Math.min(4200, opts.width || 3000));
  return {
    mode: 'skirmish', kind: 'skirmish', seed: opts.seed ?? ((seedFromString(faction + diff) + (profile.stats?.battles || 0) * 31) >>> 0),
    width, page: ch.page, level: null, difficulty: diff, modifiers: [],
    teams: [playerTeamConfig(profile), enemyTeamConfig(level, {})],
  };
};

REWARD_HOOKS.push((p, session, summary) => {
  if (session.opts.kind !== 'skirmish') return;
  const diff = SKIRMISH[session.opts.difficulty] ? session.opts.difficulty : 'normal';
  const win = session.battle.result.winner === 0;
  summary.gold = win ? SKIRMISH[diff].gold : 8;
  summary.xp = win ? Math.round(SKIRMISH[diff].gold * 0.4) : 0;
  summary.difficulty = diff;
});
