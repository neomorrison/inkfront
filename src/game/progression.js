// Rewards and purchases. Every gold/xp/unlock change goes through here, then Save.save().
// OWNER: meta UI/progression builder (package H) extends this (achievements, crates, daily/endless rewards).
import { bus } from '../core/events.js';
import { UNITS } from '../data/units.js';
import { LEVELS, LEVEL_BY_ID, starsFor, HARD_MODE } from '../data/levels.js';
import { heroXpToNext, HERO_MAX_LEVEL } from '../data/hero.js';
import { unitUpgradeCost, UNIT_MAX_LEVEL, fortUpgradeCost, FORT_UPGRADES, spellUpgradeCost } from '../data/upgrades.js';
import { MAX_LOADOUT, PLAYER_ROSTER, crewOf } from '../data/units.js';
import { squadCap, squadUsed } from './squad.js';
export { squadCap, squadUsed, fitSquad } from './squad.js';
import { SPELL_MAX_LEVEL, MAX_SPELL_SLOTS } from '../data/spells.js';
import { CRATE_HATS } from '../data/hats.js';
import { HERO_SKILL_BY_ID } from '../data/hero.js';
import { Save } from './save.js';

// REWARD_HOOKS: fn(profile, session, summary) for modes/features to add their own rewards.
export const REWARD_HOOKS = [];
// AFTER_HOOKS: fn(profile, summary|null) after a battle result or a purchase is applied
// (achievement checks live here). summary is null for purchases.
export const AFTER_HOOKS = [];

export function runAfterHooks(p, summary = null) {
  for (const hook of AFTER_HOOKS) {
    try { hook(p, summary); } catch (e) { console.error(e); }
  }
}

export const CRATE_GOLD = 300; // paid when every crate hat is already owned
export const CRATE_EVERY_STARS = 10;
export const FINAL_LEVEL = '5-6'; // beating the Hand ends the story
export const DAILY_CONSOLATION = { gold: 75, xp: 30, winXp: 60 };

export function addGold(p, n, why) {
  p.gold = Math.max(0, Math.round(p.gold + n));
  bus.emit('gold', { amount: n, total: p.gold, why });
}

export function addHeroXp(p, xp) {
  const h = p.hero;
  let ups = 0;
  h.xp += Math.round(xp);
  while (h.level < HERO_MAX_LEVEL && h.xp >= heroXpToNext(h.level)) {
    h.xp -= heroXpToNext(h.level);
    h.level++;
    h.points++;
    ups++;
  }
  if (h.level >= HERO_MAX_LEVEL) h.xp = 0;
  if (ups) bus.emit('heroLevel', { level: h.level, ups });
  return ups;
}

export function unlockUnit(p, id) {
  if (p.unlockedUnits.includes(id)) return false;
  p.unlockedUnits.push(id);
  p.units[id] = p.units[id] || 1;
  if (id !== 'scribe' && p.loadout.units.length < MAX_LOADOUT && !p.loadout.units.includes(id)
    && squadUsed(p.loadout.units) + crewOf(id) <= squadCap(p)) p.loadout.units.push(id);
  p.seen['new.unit.' + id] = false;
  return true;
}

export function unlockSpell(p, id) {
  if (p.unlockedSpells.includes(id)) return false;
  p.unlockedSpells.push(id);
  p.spells[id] = p.spells[id] || 1;
  if (p.loadout.spells.length < MAX_SPELL_SLOTS && !p.loadout.spells.includes(id)) p.loadout.spells.push(id);
  p.seen['new.spell.' + id] = false;
  return true;
}

export function unlockHat(p, id) {
  if (!id || p.hats.includes(id)) return false;
  p.hats.push(id);
  p.seen['new.hat.' + id] = false;
  return true;
}

export function isLevelUnlocked(p, id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i <= 0) return true;
  const prev = LEVELS[i - 1];
  return !!(p.levels[prev.id] && p.levels[prev.id].cleared);
}

export function totalStars(p) {
  let s = 0;
  for (const id in p.levels) s += (p.levels[id].stars || 0) + (p.levels[id].hardStars || 0);
  return s;
}

export function campaignStars(p) {
  let s = 0;
  for (const id in p.levels) s += p.levels[id].stars || 0;
  return s;
}

export function levelCleared(p, id) {
  return !!(p.levels[id] && p.levels[id].cleared);
}

// Menu entries appear as the campaign opens them up. Settings is always there.
export const FEATURE_GATES = {
  armory: { level: '1-1', hint: 'Clear 1-1' },
  achievements: { level: '1-1', hint: 'Clear 1-1' },
  captain: { level: '1-2', hint: 'Clear 1-2' },
  endless: { level: '1-6', hint: 'Clear 1-6' },
  daily: { level: '2-1', hint: 'Clear 2-1' },
};

export function featureUnlocked(p, name) {
  const g = FEATURE_GATES[name];
  return !g || levelCleared(p, g.level);
}

export function chapterUnlocked(p, n) {
  return n <= 1 || isLevelUnlocked(p, n + '-1');
}

// The level the player should play next: first level that is open and not cleared.
export function nextPlayableLevel(p) {
  for (const l of LEVELS) if (isLevelUnlocked(p, l.id) && !levelCleared(p, l.id)) return l.id;
  return LEVELS[LEVELS.length - 1].id;
}

export function seen(p, key) {
  return p.seen[key] !== false;
}
export function markSeen(p, key) {
  if (p.seen[key] === false) { p.seen[key] = true; return true; }
  return false;
}

// UTC calendar day, the same key src/game/daily.js saves (lastWin / lastPlayed), so the card
// and the menu badge agree with the stored result in every time zone.
export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function skillAvailable(p, sk) {
  return (p.hero.skills[sk.id] || 0) < sk.max && p.hero.level >= sk.req;
}

export function canAffordUnit(p, id) {
  const lv = p.units[id] || 1;
  return p.unlockedUnits.includes(id) && lv < UNIT_MAX_LEVEL && p.gold >= unitUpgradeCost(UNITS[id], lv);
}
export function canAffordFort(p, id) {
  const lv = p.fort[id] || 0;
  return lv < FORT_UPGRADES[id].max && p.gold >= fortUpgradeCost(id, lv);
}
export function canAffordSpell(p, id) {
  const lv = p.spells[id] || 1;
  return p.unlockedSpells.includes(id) && lv < SPELL_MAX_LEVEL && p.gold >= spellUpgradeCost(lv);
}

// Red "!" badges for the menus.
export function badgeCounts(p) {
  const out = { armory: 0, units: 0, fort: 0, spells: 0, hero: 0, skills: 0, hats: 0, ach: 0, daily: 0, crates: p.crates || 0 };
  for (const id of PLAYER_ROSTER) {
    if (canAffordUnit(p, id)) out.units++;
    if (p.seen['new.unit.' + id] === false) out.units++;
  }
  for (const id in FORT_UPGRADES) if (canAffordFort(p, id)) out.fort++;
  for (const id of p.unlockedSpells) {
    if (canAffordSpell(p, id)) out.spells++;
    if (p.seen['new.spell.' + id] === false) out.spells++;
  }
  out.armory = out.units + out.fort + out.spells;
  if (p.hero.points > 0) for (const sk of Object.values(HERO_SKILL_BY_ID)) if (skillAvailable(p, sk)) { out.skills = p.hero.points; break; }
  for (const k in p.seen) if (k.startsWith('new.hat.') && p.seen[k] === false) out.hats++;
  out.hero = out.skills + out.hats;
  for (const k in p.seen) if (k.startsWith('ach.') && p.seen[k] === false) out.ach++;
  if (featureUnlocked(p, 'daily') && p.daily.lastWin !== todayKey()) out.daily = 1;
  return out;
}

// ---------------------------------------------------------------- crates
export function awardCrates(p, n = 1) {
  p.crates = (p.crates || 0) + n;
}

// Opens one crate. Random crate hat not owned yet, else gold. Returns the reward or null.
export function openCrate(p, rand = Math.random) {
  if ((p.crates || 0) <= 0) return null;
  p.crates--;
  const pool = CRATE_HATS.filter((id) => !p.hats.includes(id));
  let reward;
  if (pool.length) {
    const id = pool[Math.floor(rand() * pool.length)];
    unlockHat(p, id);
    reward = { type: 'hat', id };
  } else {
    addGold(p, CRATE_GOLD, 'crate');
    reward = { type: 'gold', amount: CRATE_GOLD };
  }
  Save.save();
  bus.emit('crateOpened', reward);
  runAfterHooks(p, null);
  return reward;
}

// ---------------------------------------------------------------- captain
export function spendHeroPoint(p, skillId) {
  const sk = HERO_SKILL_BY_ID[skillId];
  if (!sk || p.hero.points <= 0 || !skillAvailable(p, sk)) return false;
  p.hero.skills[skillId] = (p.hero.skills[skillId] || 0) + 1;
  p.hero.points--;
  Save.save();
  bus.emit('upgraded', { kind: 'skill', id: skillId, level: p.hero.skills[skillId] });
  return true;
}

export function respecHero(p) {
  let n = 0;
  for (const id in p.hero.skills) n += p.hero.skills[id] || 0;
  p.hero.skills = {};
  p.hero.points += n;
  Save.save();
  return n;
}

export function equipHat(p, id) {
  if (!p.hats.includes(id)) return false;
  p.hero.hat = id;
  if (p.settings.armyHats) p.hero.armyHat = id;
  markSeen(p, 'new.hat.' + id);
  Save.save();
  return true;
}

export function setArmyHats(p, on) {
  p.settings.armyHats = !!on;
  p.hero.armyHats = !!on;
  p.hero.armyHat = on ? p.hero.hat : 'none';
  Save.save();
}

// Called once when a battle ends. Returns a summary for the results screen.
export function applyBattleResult(p, session) {
  const b = session.battle;
  const r = b.result;
  const win = r.winner === 0;
  const st = r.stats;
  const summary = {
    kind: session.opts.kind, win, stars: 0, prevStars: 0, gold: 0, xp: 0, heroLevelUps: 0, unlocks: [], firstClear: false, time: r.time, stats: st,
    heroBefore: { level: p.hero.level, xp: p.hero.xp }, crates: 0, achievements: [], boss: !!r.bossDefeated, features: [],
  };
  const featuresBefore = Object.keys(FEATURE_GATES).filter((f) => featureUnlocked(p, f));

  p.stats.battles++;
  if (win) p.stats.wins++; else p.stats.losses++;
  p.stats.kills += st.kills;
  p.stats.lost += st.lost;
  p.stats.inkGathered += Math.round(st.inkGathered);
  p.stats.spawned += st.spawned;
  p.stats.healed += Math.round(st.healed);
  p.stats.heroKills += st.heroKills;
  p.stats.launches += st.launches;
  p.stats.scribeKills += st.scribeKills;
  p.stats.maxArmy = Math.max(p.stats.maxArmy, st.maxArmy);
  if (win && !r.fortDamaged) p.stats.flawless++;
  if (win && r.time < 120) p.stats.fastWin++;
  if (r.bossDefeated && r.boss) p.stats[r.boss] = (p.stats[r.boss] || 0) + 1;

  if (session.opts.kind === 'campaign') {
    const lv = LEVEL_BY_ID[session.opts.levelId];
    const hard = !!session.opts.hard;
    const rec = p.levels[lv.id] || (p.levels[lv.id] = { stars: 0, hardStars: 0, cleared: false, hardCleared: false, bestTime: 0, bestTimeHard: 0, plays: 0 });
    rec.plays++;
    const stars = starsFor(r);
    const prev = hard ? rec.hardStars : rec.stars;
    const first = win && !(hard ? rec.hardCleared : rec.cleared);
    summary.stars = stars;
    summary.prevStars = prev;
    summary.firstClear = first;
    const goldMult = (hard ? HARD_MODE.gold : 1) * (1 + 0.15 * ((p.hero.skills && p.hero.skills.deep_pockets) || 0));
    if (win) {
      if (hard) { rec.hardStars = Math.max(rec.hardStars, stars); rec.hardCleared = true; p.stats.hardWins++; }
      else { rec.stars = Math.max(rec.stars, stars); rec.cleared = true; }
      // Red Ink keeps its own record so a hard win never overwrites the normal best time.
      const timeKey = hard ? 'bestTimeHard' : 'bestTime';
      if (!rec[timeKey] || r.time < rec[timeKey]) rec[timeKey] = Math.round(r.time);
      const base = lv.rewards.gold * (first ? 1 : 0.45);
      summary.gold = Math.round(base * (1 + 0.25 * (stars - 1)) * goldMult);
      summary.xp = Math.round(lv.rewards.xp * (first ? 1 : 0.5));
      if (first && !hard) {
        const u = lv.rewards.unlock || {};
        if (u.unit && unlockUnit(p, u.unit)) summary.unlocks.push({ type: 'unit', id: u.unit });
        if (u.spell && unlockSpell(p, u.spell)) summary.unlocks.push({ type: 'spell', id: u.spell });
        if (u.hat && unlockHat(p, u.hat)) summary.unlocks.push({ type: 'hat', id: u.hat });
        if (u.mode === 'hard' && !p.hardUnlocked) { p.hardUnlocked = true; summary.unlocks.push({ type: 'mode', id: 'hard' }); }
        if (lv.boss) summary.crates++; // a crate after each boss first clear
        if (lv.id === FINAL_LEVEL && !p.seen.ending) summary.ending = true; // the story ending, once
      }
      if (!hard) {
        const owed = Math.floor(campaignStars(p) / CRATE_EVERY_STARS) - (p.crateStars || 0);
        if (owed > 0) { p.crateStars = (p.crateStars || 0) + owed; summary.crates += owed; }
      }
      if (summary.crates) awardCrates(p, summary.crates);
    } else {
      // A loss still pays a little so progress never stalls, but only for a real attempt.
      const effort = r.time < 20 ? 0 : Math.min(1, r.time / 120);
      summary.gold = Math.round(lv.rewards.gold * 0.2 * effort * goldMult);
      summary.xp = Math.round(lv.rewards.xp * 0.3 * effort);
    }
  }
  if (session.opts.kind === 'endless') {
    const wave = (b.endless && b.endless.wave) || summary.wave || 0;
    summary.wave = wave;
    summary.prevBest = Math.max(p.endless.bestWave || 0, p.stats.endlessBest || 0);
    summary.newBest = wave > summary.prevBest;
    if (summary.newBest) { p.endless.bestWave = wave; p.stats.endlessBest = wave; }
    p.endless.runs = (p.endless.runs || 0) + 1;
  }
  if (session.opts.kind === 'daily') {
    summary.date = session.opts.date || todayKey();
    // Like a campaign defeat: a small consolation scaled by time survived, nothing for a quick give-up.
    // (The day's 500 gold prize for a win is paid by the daily reward hook in src/game/daily.js.)
    if (win) summary.xp = DAILY_CONSOLATION.winXp;
    else {
      const effort = r.time < 20 ? 0 : Math.min(1, r.time / 120);
      summary.gold = Math.round(DAILY_CONSOLATION.gold * effort);
      summary.xp = Math.round(DAILY_CONSOLATION.xp * effort);
    }
  }
  for (const hook of REWARD_HOOKS) hook(p, session, summary);
  // Endless pays by wave even if the mode builder did not add a reward.
  if (summary.kind === 'endless' && !summary.gold && summary.wave) summary.gold = Math.round(summary.wave * 30 + Math.max(0, summary.wave - 10) * 20);
  if (summary.gold) addGold(p, summary.gold, 'battle');
  if (summary.xp) summary.heroLevelUps = addHeroXp(p, summary.xp);
  summary.features = Object.keys(FEATURE_GATES).filter((f) => featureUnlocked(p, f) && !featuresBefore.includes(f));
  p.stats.playTime += Math.round(r.time);
  runAfterHooks(p, summary);
  Save.save();
  bus.emit('battleApplied', summary);
  return summary;
}

// ---------------------------------------------------------------- purchases
export function buyUnitUpgrade(p, id) {
  const lv = p.units[id] || 1;
  if (lv >= UNIT_MAX_LEVEL) return false;
  const cost = unitUpgradeCost(UNITS[id], lv);
  if (p.gold < cost) return false;
  addGold(p, -cost, 'upgrade');
  p.units[id] = lv + 1;
  Save.save();
  bus.emit('upgraded', { kind: 'unit', id, level: lv + 1 });
  runAfterHooks(p, null);
  return true;
}

export function buyFortUpgrade(p, id) {
  const lv = p.fort[id] || 0;
  if (lv >= FORT_UPGRADES[id].max) return false;
  const cost = fortUpgradeCost(id, lv);
  if (p.gold < cost) return false;
  addGold(p, -cost, 'upgrade');
  p.fort[id] = lv + 1;
  Save.save();
  bus.emit('upgraded', { kind: 'fort', id, level: lv + 1 });
  runAfterHooks(p, null);
  return true;
}

export function buySpellUpgrade(p, id) {
  const lv = p.spells[id] || 1;
  if (lv >= SPELL_MAX_LEVEL) return false;
  const cost = spellUpgradeCost(lv);
  if (p.gold < cost) return false;
  addGold(p, -cost, 'upgrade');
  p.spells[id] = lv + 1;
  Save.save();
  bus.emit('upgraded', { kind: 'spell', id, level: lv + 1 });
  runAfterHooks(p, null);
  return true;
}
