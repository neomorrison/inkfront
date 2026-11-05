// Rewards and purchases. Every gold/xp/unlock change goes through here, then Save.save().
// OWNER: meta UI/progression builder (package H) extends this (achievements, crates, daily/endless rewards).
import { bus } from '../core/events.js';
import { UNITS } from '../data/units.js';
import { LEVELS, LEVEL_BY_ID, starsFor, HARD_MODE } from '../data/levels.js';
import { heroXpToNext, HERO_MAX_LEVEL } from '../data/hero.js';
import { unitUpgradeCost, UNIT_MAX_LEVEL, fortUpgradeCost, FORT_UPGRADES, spellUpgradeCost } from '../data/upgrades.js';
import { MAX_LOADOUT } from '../data/units.js';
import { SPELL_MAX_LEVEL, MAX_SPELL_SLOTS } from '../data/spells.js';
import { Save } from './save.js';

// REWARD_HOOKS: fn(profile, session, summary) for modes/features to add their own rewards.
export const REWARD_HOOKS = [];

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
  if (id !== 'scribe' && p.loadout.units.length < MAX_LOADOUT && !p.loadout.units.includes(id)) p.loadout.units.push(id);
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

// Called once when a battle ends. Returns a summary for the results screen.
export function applyBattleResult(p, session) {
  const b = session.battle;
  const r = b.result;
  const win = r.winner === 0;
  const st = r.stats;
  const summary = { kind: session.opts.kind, win, stars: 0, prevStars: 0, gold: 0, xp: 0, heroLevelUps: 0, unlocks: [], firstClear: false, time: r.time, stats: st };

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
    const rec = p.levels[lv.id] || (p.levels[lv.id] = { stars: 0, hardStars: 0, cleared: false, hardCleared: false, bestTime: 0, plays: 0 });
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
      if (!rec.bestTime || r.time < rec.bestTime) rec.bestTime = Math.round(r.time);
      const base = lv.rewards.gold * (first ? 1 : 0.45);
      summary.gold = Math.round(base * (1 + 0.25 * (stars - 1)) * goldMult);
      summary.xp = Math.round(lv.rewards.xp * (first ? 1 : 0.5));
      if (first && !hard) {
        const u = lv.rewards.unlock || {};
        if (u.unit && unlockUnit(p, u.unit)) summary.unlocks.push({ type: 'unit', id: u.unit });
        if (u.spell && unlockSpell(p, u.spell)) summary.unlocks.push({ type: 'spell', id: u.spell });
        if (u.hat && unlockHat(p, u.hat)) summary.unlocks.push({ type: 'hat', id: u.hat });
        if (u.mode === 'hard' && !p.hardUnlocked) { p.hardUnlocked = true; summary.unlocks.push({ type: 'mode', id: 'hard' }); }
      }
    } else {
      summary.gold = Math.round(lv.rewards.gold * 0.2 * Math.min(1, r.time / 120) * goldMult);
      summary.xp = Math.round(lv.rewards.xp * 0.3);
    }
  }
  for (const hook of REWARD_HOOKS) hook(p, session, summary);
  if (summary.gold) addGold(p, summary.gold, 'battle');
  if (summary.xp) summary.heroLevelUps = addHeroXp(p, summary.xp);
  p.stats.playTime += Math.round(r.time);
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
  return true;
}
