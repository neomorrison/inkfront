// Builds Battle configs for each way to play. OWNER: AI/levels/modes builder (package C)
// registers 'endless', 'daily' and 'skirmish' into MODE_BUILDERS.
import { seedFromString } from '../core/rng.js';
import { LEVEL_BY_ID } from '../data/levels.js';
import { FACTIONS } from '../data/factions.js';
import { playerTeamConfig, enemyTeamConfig } from './teamcfg.js';

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
    teams: [playerTeamConfig(profile), enemyTeamConfig(level, { hard: opts.hard })],
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
  const team = (faction, roster) => ({
    faction, startInk: 300, income: 4, popCap: 24, scribeCap: 3, roster: ['scribe', ...roster],
    unitLevels: {}, fort: { hp: 2600, turretDmg: 8, turretRange: 420, turretCd: 2 },
    ai: { scribes: 3, weights: weights(roster), aggression: 0.9, firstAttack: 8, maxArmy: 18 },
  });
  return {
    mode: 'demo', kind: 'demo', seed: opts.seed || 1, width: 2200, page: set.page, level: null, modifiers: [],
    teams: [team('ink', set.a), team(set.b, enemyRoster)],
  };
}
