// Battle modes: win/lose rules and per-mode updates.
// OWNER: AI/levels/modes builder (package C) adds 'endless', 'daily', 'skirmish' and refines these.
import { MODE_IMPL } from './registry.js';
import { initEndless, updateEndless } from './endless_core.js';

function campaignCheck(b) {
  const lv = b.level;
  if (!b.teams[0].fort.alive) return { winner: 1, reason: 'fort' };
  if (lv && lv.win === 'survive') return b.time >= (lv.surviveTime || 240) ? { winner: 0, reason: 'survive' } : null;
  if (lv && lv.win === 'boss') return b.bossDefeated ? { winner: 0, reason: 'boss' } : null;
  if (!b.teams[1].fort.alive) return { winner: 0, reason: 'fort' };
  return null;
}

MODE_IMPL.campaign = { check: campaignCheck };

// Title-screen background battle: AI vs AI, ends quietly when a fort falls.
MODE_IMPL.demo = {
  check(b) {
    if (!b.teams[0].fort.alive) return { winner: 1, reason: 'fort' };
    if (!b.teams[1].fort.alive) return { winner: 0, reason: 'fort' };
    return null;
  },
};

// ---------------------------------------------------------------- Endless, Daily, Skirmish

// Endless: the only way to lose is to lose your fort. Waves come from the right (endless_core.js).
MODE_IMPL.endless = {
  init(b) { initEndless(b); },
  update(b, dt) { updateEndless(b, dt); },
  check(b) { return b.teams[0].fort.alive ? null : { winner: 1, reason: 'fort' }; },
};

// Daily and Skirmish are ordinary fort battles with their own configs (src/game/daily.js, modes.js).
MODE_IMPL.daily = { check: campaignCheck };
MODE_IMPL.skirmish = { check: campaignCheck };
