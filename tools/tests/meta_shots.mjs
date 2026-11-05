// Stages every menu screen with a seeded profile and screenshots it at 1280x720, 1920x1080 and
// 844x390 touch, running the overlap probe on each. Usage: node tools/tests/meta_shots.mjs [screen,screen] [--vp mobile]
import path from 'node:path';
import { serve, launch, VIEWPORTS, out, probe } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const vpArg = args.indexOf('--vp') >= 0 ? args[args.indexOf('--vp') + 1] : null;
const { server, url } = await serve();
const browser = await launch();
const problems = [];

// Profile seeds: fresh, mid (some campaign, gold) and late (everything open).
const SEEDS = {
  fresh: () => {},
  mid: async (S) => {
    const { LEVELS } = await import('./src/data/levels.js');
    const P = await import('./src/game/progression.js');
    for (const l of LEVELS.slice(0, 9)) {
      S.data.levels[l.id] = { stars: l.n % 3 + 1, hardStars: 0, cleared: true, hardCleared: false, bestTime: 90, plays: 2 };
      const u = l.rewards.unlock || {};
      if (u.unit) P.unlockUnit(S.data, u.unit);
      if (u.spell) P.unlockSpell(S.data, u.spell);
      if (u.hat) P.unlockHat(S.data, u.hat);
    }
    S.data.gold = 1450; S.data.hero.level = 6; S.data.hero.points = 3; S.data.hero.xp = 120;
    S.data.units.brawler = 4; S.data.units.slinger = 7; S.data.crates = 2;
    S.data.stats.battles = 14; S.data.stats.wins = 11; S.data.stats.kills = 640;
    S.data.fort.walls = 2;
  },
  late: async (S) => {
    const { LEVELS } = await import('./src/data/levels.js');
    const P = await import('./src/game/progression.js');
    for (const l of LEVELS) {
      S.data.levels[l.id] = { stars: 3, hardStars: l.n % 2 ? 2 : 0, cleared: true, hardCleared: !!(l.n % 2), bestTime: 90, plays: 3 };
      const u = l.rewards.unlock || {};
      if (u.unit) P.unlockUnit(S.data, u.unit);
      if (u.spell) P.unlockSpell(S.data, u.spell);
      if (u.hat) P.unlockHat(S.data, u.hat);
    }
    S.data.hardUnlocked = true; S.data.gold = 99000; S.data.hero.level = 24; S.data.hero.points = 5;
    for (const k in S.data.units) S.data.units[k] = 1 + (k.length % 10);
    S.data.stats.wins = 40; S.data.stats.kills = 2400; S.data.crates = 1;
  },
};

// Results are staged by running a real battle config to its end through the real progression code.
const stage = (opts, setup, kind) => `
  const { applyBattleResult } = await import('./src/game/progression.js');
  App.startBattle(${JSON.stringify(opts)});
  const s = App.session;
  ${setup}
  s.battle.end(${kind}, 'test');
  s.ended = true;
  const summary = applyBattleResult(s.profile, s);
  UI.show('results', { session: s, summary });
`;
const RESULTS_WIN = stage({ kind: 'campaign', levelId: '2-3' }, "s.battle.teams[0].fort.hp = s.battle.teams[0].fort.maxHp * 0.9; s.profile.levels['2-3'] = { stars: 0, cleared: false }; s.profile.levels['2-2'] = { stars: 3, cleared: true }; s.battle.teams[0].stats.kills = 41; s.battle.teams[0].stats.inkGathered = 880;", 0);
const RESULTS_LOSE = stage({ kind: 'campaign', levelId: '1-2' }, "", 1);
const RESULTS_ENDLESS = stage({ kind: 'campaign', levelId: '1-1' }, "s.opts = { kind: 'endless' }; s.battle.endless = { wave: 12 }; s.battle.teams[0].stats.kills = 120;", 1);

const SCREENS = [
  ['title-fresh', 'fresh', "App.goTitle()"],
  ['title-mid', 'mid', "App.goTitle()"],
  ['title-late', 'mid', "App.goTitle()"],
  ['map-mid', 'mid', "App.goMap()"],
  ['map-late', 'late', "App.goMap()"],
  ['loadout', 'mid', "App.go('loadout', { levelId: '3-1' })"],
  ['loadout-late', 'late', "App.go('loadout', { levelId: '5-6' })"],
  ['armory-units', 'mid', "App.go('armory')"],
  ['armory-fort', 'mid', "App.go('armory', { tab: 'fort' })"],
  ['armory-spells', 'mid', "App.go('armory', { tab: 'spells' })"],
  ['hero-skills', 'mid', "App.go('hero')"],
  ['hero-hats', 'late', "App.go('hero', { tab: 'hats' })"],
  ['achievements', 'mid', "App.go('achievements')"],
  ['stats', 'mid', "App.go('achievements', { tab: 'stats' })"],
  ['settings', 'mid', "App.go('settings')"],
  ['settings-save', 'mid', "App.go('settings', { tab: 'save' })"],
  ['settings-controls', 'mid', "App.go('settings', { tab: 'controls' })"],
  ['daily', 'mid', "App.go('daily')"],
  ['endless', 'late', "App.go('endless_menu')"],
  ['crate', 'mid', "App.go('title'); UI.modal('crate')"],
  ['results-win', 'mid', RESULTS_WIN],
  ['results-lose', 'mid', RESULTS_LOSE],
  ['results-endless', 'mid', RESULTS_ENDLESS],
];

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  if (vpArg && vpArg !== vpName) continue;
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load/.test(m.text())) errors.push('console: ' + m.text()); });
  for (const [name, seed, code] of SCREENS) {
    if (only && !only.split(',').some((o) => name.startsWith(o))) continue;
    await page.goto(url);
    await page.waitForFunction(() => window.App && window.App.ready);
    await page.evaluate(async ([seedFn, code]) => {
      const { Save } = await import('./src/game/save.js');
      Save.reset();
      await (0, eval)('(' + seedFn + ')')(Save);
      Save.save();
      const { UI } = await import('./src/ui/ui.js');
      window.UI = UI;
      await (0, eval)('(async () => {' + code + '})()');
    }, [SEEDS[seed].toString(), code]);
    await page.waitForTimeout(name.startsWith('results') ? 5200 : name === 'title-late' ? 9000 : 1600);
    const f = path.join(out, `meta-${name}-${vpName}.png`);
    await page.screenshot({ path: f });
    await probe(page, `${name} @${vpName}`, problems);
  }
  if (errors.length) { console.log('ERRORS (' + vpName + '):\n' + errors.join('\n')); problems.push(...errors); }
  await ctx.close();
}
await browser.close();
server.close();
console.log(problems.length ? `${problems.length} problem(s)` : 'shots ok');
