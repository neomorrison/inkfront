// OWNER: AI/levels/modes builder (package C): daily challenge generator (MODE_BUILDERS.daily) and rewards.
// Everything comes from the date string, so every player gets the same challenge that day.
import { RNG, seedFromString } from '../core/rng.js';
import { MODIFIERS } from '../data/levels.js';
import { FACTIONS } from '../data/factions.js';
import { PLAYER_ROSTER } from '../data/units.js';
import { SPELL_ORDER } from '../data/spells.js';
import { CHAPTERS } from '../data/pages.js';
import { deepClone } from '../core/util.js';
import { defaultProfile } from './save.js';
import { playerTeamConfig, enemyTeamConfig } from './teamcfg.js';
import { MODE_BUILDERS, enemyBlock } from './modes.js';
import { REWARD_HOOKS } from './progression.js';

export const DAILY_GOLD = 500;
export const DAILY_UNIT_LEVEL = 5;
export const DAILY_SPELL_LEVEL = 3;
const DAILY_FACTIONS = ['red', 'graphite', 'neon', 'chalk', 'eraser'];

// UTC calendar day, so everyone shares one challenge.
export function todayStr(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function roll(date) {
  const rng = new RNG(seedFromString('inkfront-daily-' + date));
  const faction = rng.pick(DAILY_FACTIONS);
  const mods = Object.keys(MODIFIERS);
  const chosen = [];
  while (chosen.length < 2) {
    const m = rng.pick(mods);
    if (chosen.includes(m)) continue;
    if ((m === 'wind_left' && chosen.includes('wind_right')) || (m === 'wind_right' && chosen.includes('wind_left'))) continue;
    chosen.push(m);
  }
  const pool = PLAYER_ROSTER.filter((id) => id !== 'scribe');
  const units = rng.shuffle(pool.slice()).slice(0, 6);
  const spells = rng.shuffle(SPELL_ORDER.slice()).slice(0, 2);
  const power = 0.46 + rng.next() * 0.22;
  return { rng, faction, modifiers: chosen, units, spells, power };
}

// -> { date, faction, modifiers, units, spells, title } plus names for the card.
export function dailyInfo(date = todayStr()) {
  const r = roll(date);
  const names = r.modifiers.map((m) => MODIFIERS[m].name);
  return {
    date, faction: r.faction, factionName: FACTIONS[r.faction].name,
    modifiers: r.modifiers.slice(), modifierNames: names,
    units: r.units.slice(), spells: r.spells.slice(),
    unitLevel: DAILY_UNIT_LEVEL, spellLevel: DAILY_SPELL_LEVEL,
    power: r.power,
    title: `${names.join(' + ')} vs ${FACTIONS[r.faction].short}`,
  };
}

// The same fort, hero and levels for everyone, so the leaderboard-of-friends stays fair.
function standardProfile(real) {
  const p = deepClone(defaultProfile());
  p.unlockedUnits = PLAYER_ROSTER.slice();
  p.unlockedSpells = SPELL_ORDER.slice();
  for (const id of p.unlockedUnits) p.units[id] = DAILY_UNIT_LEVEL;
  for (const id of p.unlockedSpells) p.spells[id] = DAILY_SPELL_LEVEL;
  p.fort = { walls: 3, turret: 3, income: 3, start_ink: 3, scribes: 1, pop: 3, wells: 3 };
  p.hero.level = 8;
  if (real) {
    p.hero.hat = real.hero.hat; p.hero.armyHat = real.hero.armyHat; p.hero.armyHats = real.hero.armyHats;
    p.settings.armyHats = real.settings.armyHats;
  }
  return p;
}

export function dailyConfig(opts = {}, profile = null) {
  const date = opts.date || todayStr();
  const info = dailyInfo(date);
  const std = standardProfile(profile);
  const player = playerTeamConfig(std, {
    loadout: { units: info.units, spells: info.spells },
    roster: ['scribe', ...info.units],
    unitLevelOverride: DAILY_UNIT_LEVEL,
  });
  // A fair start whatever the modifiers say: at least 320 ink for the first draws.
  player.startInk = Math.max(player.startInk || 0, 320);
  const rush = info.modifiers.includes('rush');
  const level = { id: 'daily', faction: info.faction, enemy: enemyBlock(info.faction, info.power, { rush }), win: 'fort', script: [] };
  const ch = CHAPTERS.find((c) => c.faction === info.faction);
  return {
    mode: 'daily', kind: 'daily', date, seed: seedFromString('inkfront-daily-' + date) >>> 0,
    width: 3200, page: ch.page, level: null, modifiers: info.modifiers.slice(), daily: info,
    teams: [player, enemyTeamConfig(level, {})],
  };
}

MODE_BUILDERS.daily = (opts, profile) => dailyConfig(opts, profile);

// One reward per day, plus the streak.
REWARD_HOOKS.push((p, session, summary) => {
  if (session.opts.kind !== 'daily') return;
  const date = session.battle.cfg.date;
  const win = session.battle.result.winner === 0;
  const d = p.daily;
  d.lastPlayed = date;
  d.attempts = (d.attempts || 0) + 1;
  summary.daily = { date, won: win, reward: false, streak: d.streak || 0 };
  if (!win) return;
  p.stats.dailyWins = (p.stats.dailyWins || 0) + 1;
  if (d.lastWin === date) return; // already paid today
  d.streak = d.lastWin === addDays(date, -1) ? (d.streak || 0) + 1 : 1;
  d.lastWin = date;
  p.stats.dailyStreak = Math.max(p.stats.dailyStreak || 0, d.streak);
  summary.gold = (summary.gold || 0) + DAILY_GOLD;
  summary.daily = { date, won: true, reward: true, streak: d.streak };
});
