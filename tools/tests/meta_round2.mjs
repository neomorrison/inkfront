// Round-2 meta UI checks: stages the screens the QA round flagged (ending, worst-case results, captain,
// loadout 1-2, crate, map, armory, settings, daily, toasts), screenshots them at four viewports, runs the
// overlap probe, and on touch layouts measures every tap target (>= 44 px).
//   node tools/tests/meta_round2.mjs [screenPrefix[,prefix]] [--vp desktop|full|mobile|phone]
import path from 'node:path';
import { serve, launch, VIEWPORTS, out, probe } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const vpArg = args.indexOf('--vp') >= 0 ? args[args.indexOf('--vp') + 1] : null;
const VPS = {
  desktop: VIEWPORTS.desktop,
  full: VIEWPORTS.full,
  mobile: VIEWPORTS.mobile,
  phone: { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const { server, url } = await serve();
const browser = await launch();
const problems = [];
const failures = [];
const check = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); failures.push(msg); } };

const SEEDS = {
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
    S.data.gold = 1450; S.data.hero.level = 8; S.data.hero.points = 3; S.data.hero.xp = 120;
    S.data.units.brawler = 4; S.data.crates = 2; S.data.seen.ending = true;
  },
  early: async (S) => {
    // Fresh enough that 1-2 is next and no supply is unlocked yet.
    S.data.levels['1-1'] = { stars: 3, cleared: true, plays: 1 };
    S.data.gold = 200;
  },
  late: async (S) => {
    const { LEVELS } = await import('./src/data/levels.js');
    const P = await import('./src/game/progression.js');
    for (const l of LEVELS) {
      S.data.levels[l.id] = { stars: 3, hardStars: 0, cleared: true, hardCleared: false, bestTime: 90, plays: 3 };
      const u = l.rewards.unlock || {};
      if (u.unit) P.unlockUnit(S.data, u.unit);
      if (u.spell) P.unlockSpell(S.data, u.spell);
      if (u.hat) P.unlockHat(S.data, u.hat);
    }
    S.data.hardUnlocked = true; S.data.gold = 9000; S.data.hero.level = 24; S.data.hero.points = 5; S.data.crates = 1;
  },
};

const stage = (opts, setup, kind, after = '') => `
  const { applyBattleResult } = await import('./src/game/progression.js');
  App.startBattle(${JSON.stringify(opts)});
  const s = App.session;
  ${setup}
  s.battle.end(${kind}, 'test');
  s.ended = true;
  const summary = applyBattleResult(s.profile, s);
  ${after}
  UI.show('results', { session: s, summary });
`;
const WORST = `
  summary.unlocks = [{ type: 'unit', id: 'slinger' }, { type: 'spell', id: 'pencil_rain' }, { type: 'hat', id: 'crown' }];
  summary.features = ['armory', 'captain', 'endless'];
  summary.achievements = [{ id: 'first_blood', gold: 60 }, { id: 'untouchable', gold: 220 }, { id: 'speedrun', gold: 160, hat: 'chef' }];
  summary.crates = 2; s.profile.crates = 2; summary.xp = 900; s.profile.hero.level += 2;
`;

const TYPICAL = `
  summary.unlocks = [{ type: 'unit', id: 'slinger' }];
  summary.achievements = [{ id: 'first_blood', gold: 60 }, { id: 'untouchable', gold: 220 }, { id: 'speedrun', gold: 160, hat: 'chef' }];
  summary.crates = 1; s.profile.crates = 1;
`;
const SCREENS = [
  ['ending', 'mid', "UI.modal('ending', { onDone: () => UI.closeModal('ending') })", 7500],
  ['results-worst', 'mid', stage({ kind: 'campaign', levelId: '2-3' }, "s.profile.levels['2-3'] = { stars: 0, cleared: false };", 0, WORST), 11000],
  ['results-typical', 'mid', stage({ kind: 'campaign', levelId: '2-3' }, "s.profile.levels['2-3'] = { stars: 0, cleared: false };", 0, TYPICAL), 9000],
  ['results-boss', 'mid', stage({ kind: 'campaign', levelId: '1-6' }, "s.profile.levels['1-6'] = { stars: 0, cleared: false };", 0), 5000],
  ['results-lose', 'mid', stage({ kind: 'campaign', levelId: '1-2' }, '', 1), 4500],
  ['results-final', 'late', stage({ kind: 'campaign', levelId: '5-6' }, "s.profile.levels['5-6'] = { stars: 0, cleared: false }; delete s.profile.seen.ending;", 0), 11500],
  ['hero', 'mid', "App.go('hero')", 1400],
  ['loadout-1-2', 'early', "App.go('loadout', { levelId: '1-2' })", 1400],
  ['loadout-1-4', 'mid', "App.go('loadout', { levelId: '1-4' })", 1400],
  ['crate', 'mid', "App.go('map'); UI.modal('crate')", 1200],
  ['map', 'mid', "App.goMap()", 1400],
  ['map-late', 'late', "App.goMap()", 1400, "!!document.querySelector('.node.boss .node-img') && !!document.querySelector('.boss-note img')"],
  ['map-ch3', 'late', "Save.data.ui.chapter = 2; Save.data.ui.chapterSet = true; App.goMap()", 1400, "!!document.querySelector('.node.boss .node-img') && !!document.querySelector('.boss-note img')"],
  ['map-ch5', 'late', "Save.data.ui.chapter = 4; Save.data.ui.chapterSet = true; App.goMap()", 1400, "!!document.querySelector('.node.boss .node-img') && !!document.querySelector('.boss-note img')"],
  ['loadout-3-6', 'late', "App.go('loadout', { levelId: '3-6' })", 1400, "!!document.querySelector('.lo-foe-row img.boss')"],
  ['loadout-5-6', 'late', "App.go('loadout', { levelId: '5-6' })", 1400, "!!document.querySelector('.lo-foe-row img.boss')"],
  ['armory', 'mid', "App.go('armory')", 1400, "[...document.querySelectorAll('.at-name')].every((e) => e.scrollWidth <= e.clientWidth + 1)"],
  ['armory-toasts', 'mid', "App.go('armory'); for (const t of ['Perk unlocked: <b>Tough</b>. +20% health.', 'Save loaded!', 'Achievement one', 'Achievement two', 'Fresh notebook!']) UI.toast(t, 'good', 4000);", 1200],
  ['settings', 'mid', "App.go('settings')", 1400],
  ['title', 'mid', "App.goTitle()", 2200],
  ['daily', 'mid', "App.go('daily')", 1400],
];

const TARGETS = `(() => {
  const layers = [...document.querySelectorAll('#ui > .modal-layer, #ui > .screen')];
  const top = layers.filter((l) => l.classList.contains('modal-layer')).pop() || layers[layers.length - 1];
  const bad = [];
  for (const el of top.querySelectorAll('button, .btn, .switch, .seg-b, a, input[type=range]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.closest('[data-probe-skip]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2) continue;
    if (el.classList.contains('hidden') || el.closest('.hidden')) continue;
    // Whole-card targets (.skill, .pcard) count as the card; the rest must be >= 44 on both axes (tabs excluded).
    if (el.matches('.tab, .badge')) continue;
    if (Math.min(r.width, r.height) < 43.5) bad.push((el.className || el.tagName).toString().slice(0, 40) + ' "' + (el.textContent || '').trim().slice(0, 14) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return bad;
})()`;

for (const [vpName, vp] of Object.entries(VPS)) {
  if (vpArg && vpArg !== vpName) continue;
  const touch = !!vp.hasTouch;
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load/.test(m.text())) errors.push('console: ' + m.text()); });
  for (const [name, seed, code, wait, expect] of SCREENS) {
    if (only && !only.split(',').some((o) => name.startsWith(o))) continue;
    await page.goto(url);
    await page.waitForFunction(() => window.App && window.App.ready);
    await page.evaluate(async ([seedFn, code]) => {
      const { Save } = await import('./src/game/save.js');
      window.Save = Save;
      Save.reset();
      await (0, eval)('(' + seedFn + ')')(Save);
      Save.save();
      const { UI } = await import('./src/ui/ui.js');
      window.UI = UI;
      await (0, eval)('(async () => {' + code + '})()');
    }, [SEEDS[seed].toString(), code]);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(out, `r2-${name}-${vpName}.png`) });
    await probe(page, `${name} @${vpName}`, problems);
    if (expect) check(await page.evaluate(expect), `${name} @${vpName}: ${expect.slice(0, 70)}`);
    if (touch && !/^(ending|results-final)$/.test(name)) {
      const bad = await page.evaluate(TARGETS);
      if (bad.length) { console.log(`TAP   ${name} @${vpName}: ${bad.length} target(s) under 44px`); bad.slice(0, 8).forEach((b) => console.log('   - ' + b)); problems.push(...bad.map((b) => `${name}@${vpName}: tap ${b}`)); }
      else console.log(`TAP   ${name} @${vpName}: all targets >= 44px`);
    }
  }
  if (errors.length) { console.log('ERRORS (' + vpName + '):\n' + errors.join('\n')); problems.push(...errors); }
  await ctx.close();
}
await browser.close();
server.close();
console.log(problems.length || failures.length ? `${problems.length} problem(s), ${failures.length} failure(s)` : 'round2 ok');
process.exit(failures.length ? 1 : 0);
