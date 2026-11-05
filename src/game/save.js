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
    crates: 0, // unopened supply crates
    crateStars: 0, // how many 10-star crate milestones were already paid out
    ui: { redInk: false, chapter: 0, armoryTab: 'units', armoryPick: '', heroTab: 'skills', loadoutLevel: '' }, // remembered menu state
    seen: {}, // tutorial and "new" flags: { 'tut.basics': true, 'new.unit.slinger': true }
    settings: { music: 0.55, sfx: 0.8, shake: true, numbers: true, quality: 'high', speed: 1, armyHats: false },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Repair a parsed save: any section that is missing or the wrong type falls back to its default,
// so a damaged or very old save never stops the game from booting.
function migrate(p) {
  const d = defaultProfile();
  if (!isObj(p)) return d;
  for (const k in d) {
    const want = d[k];
    const have = p[k];
    if (Array.isArray(want)) { if (!Array.isArray(have)) p[k] = deepClone(want); continue; }
    if (isObj(want)) {
      if (!isObj(have)) { p[k] = deepClone(want); continue; }
      for (const kk in want) {
        const w = want[kk], h = have[kk];
        if (h === undefined || h === null || (typeof w !== 'object' && typeof h !== typeof w) || (Array.isArray(w) && !Array.isArray(h)) || (isObj(w) && !isObj(h))) have[kk] = deepClone(w);
      }
      continue;
    }
    if (typeof have !== typeof want) p[k] = deepClone(want);
  }
  for (const id in p.levels) {
    const r = p.levels[id];
    if (!isObj(r)) { delete p.levels[id]; continue; }
    r.stars = r.stars | 0; r.hardStars = r.hardStars | 0;
    r.cleared = !!r.cleared; r.hardCleared = !!r.hardCleared; r.plays = r.plays | 0;
  }
  for (const id in p.units) if (typeof p.units[id] !== 'number') p.units[id] = 1;
  if (!p.unlockedUnits.includes('scribe')) p.unlockedUnits.unshift('scribe');
  if (!p.unlockedUnits.includes('brawler')) p.unlockedUnits.push('brawler');
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
    try {
      this.data = p ? migrate(p) : defaultProfile();
    } catch (e) {
      // Keep the broken save aside instead of losing it, then start fresh.
      try { localStorage.setItem(KEY + '.broken', raw); } catch (err) { /* ignore */ }
      this.data = defaultProfile();
    }
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode or full: play on */ }
  },
  reset() {
    this.data = defaultProfile();
    this.save();
  },
  // Save code: "INK1:" + base64 of the JSON, safe for unicode and easy to paste anywhere.
  exportCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(this.data));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'INK1:' + btoa(bin);
  },
  importCode(code) {
    let text = String(code || '').trim().replace(/\s+/g, '');
    if (text.startsWith('INK1:')) text = text.slice(5);
    let p = null;
    try {
      const bin = atob(text);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      p = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { throw new Error('That is not a save code.'); }
    if (!p || typeof p !== 'object' || !p.units || !p.levels || !p.hero) throw new Error('That is not an Inkfront save.');
    this.data = migrate(p);
    this.save();
    return this.data;
  },
};
