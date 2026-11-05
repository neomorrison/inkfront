// Achievement tracking. Per-battle trackers (SESSION_HOOKS) watch battle events, lifetime stats
// are merged in REWARD_HOOKS, and AFTER_HOOKS check every achievement after a battle or purchase.
import { bus } from '../core/events.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { HAT_BY_ID } from '../data/hats.js';
import { LEVELS } from '../data/levels.js';
import { UI } from '../ui/ui.js';
import { Audio } from '../audio/audio.js';
import { icon, hatIcon } from '../render/icons.js';
import { Save } from './save.js';
import { SESSION_HOOKS } from './session.js';
import { REWARD_HOOKS, AFTER_HOOKS, addGold, unlockHat, campaignStars } from './progression.js';

const COFFEE_RADIUS = 160;

// ---------------------------------------------------------------- per-battle trackers
function attachTrackers(session) {
  if (session.isDemo) return;
  const b = session.battle;
  const t = { coffeeMulti: 0, bomberMulti: 0, friendlyBombs: 0, maxRiders: 0 };
  session.ach = t;
  const bomberKills = new Map();
  session.listen((e) => {
    switch (e.type) {
      case 'spell': {
        // Count enemies standing in the puddle when Coffee Spill lands.
        if (e.team !== 0 || e.id !== 'coffee_spill') break;
        let n = 0;
        for (const u of b.units) if (u.alive && u.team === 1 && Math.abs(u.x - e.x) <= COFFEE_RADIUS) n++;
        t.coffeeMulti = Math.max(t.coffeeMulti, n);
        break;
      }
      case 'coffeeHit': // optional: a spell that reports its own hit count
        t.coffeeMulti = Math.max(t.coffeeMulti, e.count || e.hits || 0);
        break;
      case 'spawn': {
        if (e.team !== 0) break;
        let n = 0;
        for (const u of b.units) if (u.alive && u.team === 0 && u.type === 'rider') n++;
        t.maxRiders = Math.max(t.maxRiders, n);
        break;
      }
      case 'bomberBlast': { // optional event from the bomber behavior: { team, enemies|kills, friendly }
        const hits = e.enemies ?? e.kills ?? e.hits ?? 0;
        if (e.team === 0) {
          t.bomberMulti = Math.max(t.bomberMulti, hits);
          t.friendlyBombs += e.friendly ?? e.friendlyKills ?? 0;
        }
        break;
      }
      case 'death': {
        // Fallback when no bomberBlast event exists: credit each kill to the bomber that made it.
        const k = e.killer;
        if (!k || k.type !== 'bomber' || k.team !== 0) break;
        if (e.team === 1) {
          const n = (bomberKills.get(k.id) || 0) + 1;
          bomberKills.set(k.id, n);
          t.bomberMulti = Math.max(t.bomberMulti, n);
        } else if (e.team === 0) t.friendlyBombs++;
        break;
      }
      default:
    }
  });
}
SESSION_HOOKS.push(attachTrackers);

// ---------------------------------------------------------------- lifetime stats
REWARD_HOOKS.push((p, session) => {
  const t = session.ach;
  if (!t) return;
  p.stats.coffeeMulti = Math.max(p.stats.coffeeMulti || 0, t.coffeeMulti);
  p.stats.bomberMulti = Math.max(p.stats.bomberMulti || 0, t.bomberMulti);
  p.stats.maxRiders = Math.max(p.stats.maxRiders || 0, t.maxRiders);
  p.stats.friendlyBombs = (p.stats.friendlyBombs || 0) + t.friendlyBombs;
});

// Current value of the stat an achievement tracks (profile.stats key or a derived one).
export function statValue(p, stat) {
  switch (stat) {
    case 'stars': return campaignStars(p);
    case 'chapterStars1': {
      let s = 0;
      for (const l of LEVELS) if (l.chapter === 1) s += (p.levels[l.id] && p.levels[l.id].stars) || 0;
      return s;
    }
    case 'maxUnitLevel': return Math.max(1, ...Object.values(p.units));
    case 'hats': return p.hats.filter((id) => id !== 'none').length;
    case 'endlessBest': return Math.max(p.stats.endlessBest || 0, p.endless.bestWave || 0);
    case 'dailyStreak': return Math.max(p.stats.dailyStreak || 0, p.daily.streak || 0);
    default: return p.stats[stat] || 0;
  }
}

export function achievementProgress(p, a) {
  const value = Math.min(a.goal, statValue(p, a.stat));
  return { value, goal: a.goal, pct: Math.min(1, value / a.goal), done: !!p.achievements[a.id] };
}

export function achievementCounts(p) {
  let done = 0;
  for (const a of ACHIEVEMENTS) if (p.achievements[a.id]) done++;
  return { done, total: ACHIEVEMENTS.length };
}

// Claims every achievement that just reached its goal. Returns the list of claimed entries.
export function checkAchievements(p, { toast = true } = {}) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (statValue(p, a.stat) < a.goal) continue;
    p.achievements[a.id] = Date.now();
    p.seen['ach.' + a.id] = false;
    if (a.gold) addGold(p, a.gold, 'achievement');
    const gotHat = a.hat ? unlockHat(p, a.hat) : false;
    earned.push({ id: a.id, gold: a.gold || 0, hat: gotHat ? a.hat : null });
  }
  if (earned.length) {
    Save.save();
    bus.emit('achievement', earned);
    if (toast) {
      const show = () => earned.forEach((e, i) => setTimeout(() => toastAchievement(e), i * 650));
      if (UI.hasModal('crate')) {
        // Do not cover the crate reveal: show the toasts once it closes.
        const off = bus.on('modalClosed', (m) => { if (m.name === 'crate') { off(); show(); } });
      } else show();
    }
  }
  return earned;
}

export function toastAchievement(e) {
  const a = ACHIEVEMENTS.find((x) => x.id === e.id);
  if (!a) return;
  Audio.play('unlock');
  const bits = [];
  if (e.gold) bits.push(`<span class="ach-toast-bit"><img src="${icon('gold', 48)}" alt="">+${e.gold}</span>`);
  if (e.hat) bits.push(`<span class="ach-toast-bit"><img src="${hatIcon(e.hat, 64)}" alt="">${HAT_BY_ID[e.hat].name}</span>`);
  UI.toast(
    `<div class="ach-toast"><img class="ach-toast-icon" src="${icon('ach_' + a.icon, 64)}" alt=""><div><b>Achievement!</b><div>${a.name}</div><div class="ach-toast-bits">${bits.join('')}</div></div></div>`,
    'good', 3400);
}

AFTER_HOOKS.push((p, summary) => {
  const earned = checkAchievements(p, { toast: !summary });
  if (summary) summary.achievements.push(...earned);
});
