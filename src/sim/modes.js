// Battle modes: win/lose rules and per-mode updates.
// OWNER: AI/levels/modes builder (package C) adds 'endless', 'daily', 'skirmish' and refines these.
import { MODE_IMPL } from './registry.js';

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
