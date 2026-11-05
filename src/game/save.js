// Player profile persisted in localStorage. Everything progression-related lives here.
// Bump VERSION and add a step to migrate() whenever the shape changes.
import { deepClone } from '../core/util.js';

const KEY = 'inkfront.save.v1';
export const VERSION = 1;

export function defaultProfile() {
  return {
    version: VERSION,
    created: Date.now(),
    gold: 0,
    // campaign
    levels: {}, // '1-1': { stars, hardStars, cleared, hardCleared, bestTime, plays }
    hardUnlocked: false,
    // armory
    unlockedUnits: ['scribe', 'brawler'],
    units: { scribe: 1, brawler: 1 }, // unit id -> upgrade level
    fort: { walls: 0, turret: 0, income: 0, start_ink: 0, scribes: 0, pop: 0, wells: 0 },
    unlockedSpells: [],
    spells: {}, // spell id -> level
    loadout: { units: ['brawler'], spells: [] },
    // hero
    hero: { level: 1, xp: 0, points: 0, skills: {}, hat: 'captain', armyHat: 'none', armyHats: false },
    hats: ['none', 'captain'],
    // meta
    achievements: {}, // id -> timestamp claimed
    stats: {
      battles: 0, wins: 0, losses: 0, kills: 0, lost: 0, inkGathered: 0, spawned: 0, healed: 0, heroKills: 0,
      launches: 0, scribeKills: 0, maxArmy: 0, playTime: 0, flawless: 0, fastWin: 0, coffeeMulti: 0,
      maxRiders: 0, bomberMulti: 0, friendlyBombs: 0, hardWins: 0, endlessBest: 0, dailyWins: 0, dailyStreak: 0,
      boss_redline: 0, boss_smudge: 0, boss_wyrm: 0, boss_professor: 0, boss_hand: 0,
    },
    endless: { bestWave: 0, runs: 0 },
    daily: { lastWin: '', streak: 0, lastPlayed: '', attempts: 0 },
    crates: 0,
    seen: {}, // tutorial and "new" flags: { 'tut.basics': true, 'new.unit.slinger': true }
    settings: { music: 0.55, sfx: 0.8, shake: true, numbers: true, quality: 'high', speed: 1, armyHats: false },
  };
}

function migrate(p) {
  const d = defaultProfile();
  // Fill any missing keys from defaults (shallow per section) so old saves keep working.
  for (const k in d) {
    if (p[k] === undefined) p[k] = deepClone(d[k]);
    else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) {
      for (const kk in d[k]) if (p[k][kk] === undefined) p[k][kk] = deepClone(d[k][kk]);
    }
  }
  p.version = VERSION;
  return p;
}

export const Save = {
  data: null,
  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    let p = null;
    if (raw) {
      try { p = JSON.parse(raw); } catch (e) { p = null; }
    }
    this.data = p ? migrate(p) : defaultProfile();
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode or full: play on */ }
  },
  reset() {
    this.data = defaultProfile();
    this.save();
  },
  exportCode() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  },
  importCode(code) {
    const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!p || typeof p !== 'object' || !p.units) throw new Error('Not an Inkfront save');
    this.data = migrate(p);
    this.save();
    return this.data;
  },
};
