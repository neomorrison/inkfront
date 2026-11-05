// OWNER: AI/levels/modes builder (package C): endless mode config builder (MODE_BUILDERS.endless) and rewards.
// Rules live in src/sim/endless_core.js. Here: the Battle config and the gold/best-wave hook.
import { seedFromString } from '../core/rng.js';
import { playerTeamConfig } from './teamcfg.js';
import { MODE_BUILDERS } from './modes.js';
import { REWARD_HOOKS } from './progression.js';
import { endlessGold, ENDLESS } from '../sim/endless_core.js';

export { endlessGold };

MODE_BUILDERS.endless = (opts, profile) => {
  const run = (profile.endless && profile.endless.runs) || 0;
  const mine = playerTeamConfig(profile);
  mine.inkCap = Math.min(mine.inkCap ?? Infinity, ENDLESS.inkCap); // ink cannot pile up in Endless
  return {
    mode: 'endless', kind: 'endless',
    seed: opts.seed ?? ((seedFromString('endless') + run * 104729) >>> 0),
    width: 3000, page: 'ruled', level: null, modifiers: [],
    endless: { best: (profile.endless && profile.endless.bestWave) || 0 },
    teams: [
      mine,
      {
        // No tower, no economy, no AI: waves are spawned by the mode and march left on their own.
        faction: 'red', startInk: 0, income: 0, popCap: 999, scribeCap: 0, wellYield: 1,
        roster: [], unitLevels: {}, spells: [],
        fort: { hp: 99999, turret: false, invulnerable: true },
        mods: { byUnit: {}, flags: {} },
        ai: null,
      },
    ],
  };
};

REWARD_HOOKS.push((p, session, summary) => {
  if (session.opts.kind !== 'endless') return;
  const wave = Math.max(0, (session.battle.endless && session.battle.endless.wave) || 0);
  const prev = (p.endless && p.endless.bestWave) || 0;
  summary.wave = wave;
  summary.newBest = wave > prev;
  summary.best = Math.max(prev, wave);
  summary.gold = endlessGold(wave);
  summary.xp = Math.round(wave * 7);
  p.endless.bestWave = summary.best;
  p.endless.runs = (p.endless.runs || 0) + 1;
  p.stats.endlessBest = Math.max(p.stats.endlessBest || 0, wave);
});
