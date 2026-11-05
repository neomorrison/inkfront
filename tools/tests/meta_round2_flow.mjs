// Behaviour checks for the round-2 meta fixes, with real key presses and taps:
// ending (shown once, skippable), results headline and keyboard, toast cap, crate meter click,
// whole-card skill tap, lent supply, device-aware loadout copy.   node tools/tests/meta_round2_flow.mjs
import { serve, launch, VIEWPORTS } from './lib.mjs';

const { server, url } = await serve();
const browser = await launch();
const failures = [];
const check = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); failures.push(msg); } };
const PHONE = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(vp) {
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready);
  await page.evaluate(async () => { const m = await import('./src/ui/ui.js'); window.UI = m.UI; const s = await import('./src/game/save.js'); window.Save = s.Save; });
  return { ctx, page, errors };
}
const run = (page, code) => page.evaluate(async (c) => (0, eval)('(async () => {' + c + '})()'), code);

const RESULT = (levelId, win, setup = '', hard = false) => `
  Save.reset(); ${setup}
  const { applyBattleResult } = await import('./src/game/progression.js');
  App.startBattle({ kind: 'campaign', levelId: '${levelId}', hard: ${hard} });
  const s = App.session;
  s.battle.end(${win ? 0 : 1}, 'test'); s.ended = true;
  const summary = applyBattleResult(s.profile, s);
  UI.show('results', { session: s, summary });
`;

// ---------------------------------------------------------------- desktop
{
  console.log('\n== desktop 1280x720');
  const { ctx, page, errors } = await open(VIEWPORTS.desktop);
  const stamp = () => page.locator('.stamp').innerText();

  await run(page, RESULT('1-1', true));
  await page.waitForTimeout(1200);
  check(/LEVEL CLEARED/i.test(await stamp()), 'headline: 1-1 win says Level Cleared (' + (await stamp()).replace(/\n/g, ' ') + ')');
  await run(page, RESULT('1-3', false));
  await page.waitForTimeout(1200);
  check(/LEVEL LOST/i.test(await stamp()), 'headline: loss says Level Lost');
  await run(page, RESULT('1-6', true, "Save.data.levels['1-5'] = { cleared: true, stars: 3 };"));
  await page.waitForTimeout(1200);
  check(/PAGE CLEARED/i.test(await stamp()), 'headline: boss level says Page Cleared');

  // Keyboard: Enter = Next Level, Esc = Map
  await run(page, RESULT('1-1', true));
  await page.waitForTimeout(2500);
  await page.keyboard.press('Enter'); // first press may just finish the show
  await page.waitForTimeout(400);
  if (await page.locator('.screen-results').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
  check(await page.locator('.screen-loadout').count() === 1, 'results: Enter goes to the next level (loadout)');
  await run(page, RESULT('1-3', false));
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check(await page.locator('.screen-map').count() === 1, 'results: Esc goes to the map');
  await run(page, RESULT('1-3', false));
  await page.waitForTimeout(3000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => !!window.App.session && !window.App.session.isDemo && window.App.session.opts.levelId === '1-3'), 'results: Enter on a defeat is Try Again');

  // Ending: shown on the first win of 5-6, then results, then never again
  const final = (seen) => RESULT('5-6', true, `
    for (const l of (await import('./src/data/levels.js')).LEVELS) if (l.id !== '5-6') Save.data.levels[l.id] = { cleared: true, stars: 3 };
    ${seen ? 'Save.data.seen.ending = true;' : ''}`);
  await run(page, final(false));
  await page.waitForTimeout(900);
  check(await page.locator('.end-card').count() === 1, 'ending: shows after the Hand falls');
  const endText = await page.locator('.end-card').innerText();
  check(/The End/i.test(endText) && /Thanks for playing/i.test(endText) && /Red Ink/.test(endText) && /Endless/.test(endText) && !/—|–/.test(endText), 'ending: story, thanks and pointers, no em dashes');
  await page.waitForTimeout(6500);
  check(await page.locator('.end-go:not(.pre)').count() === 1, 'ending: Continue appears when the page is done');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  check(await page.locator('.end-card').count() === 0 && await page.locator('.results-card').count() === 1, 'ending: Enter continues to the results');
  check(await page.evaluate(() => Save.data.seen.ending === true), 'ending: remembered in profile.seen.ending');
  await run(page, final(true));
  await page.waitForTimeout(900);
  check(await page.locator('.end-card').count() === 0 && await page.locator('.results-card').count() === 1, 'ending: not shown again');
  // Skippable at once
  await run(page, final(false));
  await page.waitForTimeout(600);
  await page.locator('.end-skip').click();
  await page.waitForTimeout(700);
  check(await page.locator('.end-card').count() === 0 && await page.locator('.results-card').count() === 1, 'ending: Skip goes straight to the results');

  // Toasts: at most 3 at once, rest queued
  await run(page, "App.goTitle(); for (let i = 0; i < 7; i++) UI.toast('Toast ' + i, 'info', 3000);");
  await page.waitForTimeout(300);
  const nToast = await page.locator('.toast').count();
  check(nToast === 3, 'toasts: capped at 3 at once (' + nToast + ')');
  await page.waitForTimeout(3800);
  check((await page.locator('.toast').count()) >= 1, 'toasts: queued ones follow');

  // Map crate meter opens the crate modal
  await run(page, "Save.reset(); Save.data.levels['1-1'] = { cleared: true, stars: 3 }; Save.data.crates = 2; App.goMap();");
  await page.waitForTimeout(800);
  await page.locator('.crate-meter.ready').click();
  await page.waitForTimeout(500);
  check(await page.locator('.crate-layer').count() === 1, 'map: tapping the crate meter opens the crate modal');
  const closeBox = await page.locator('.crate-x').boundingBox();
  const stageBox = await page.locator('.crate-stage').boundingBox();
  check(closeBox && stageBox && closeBox.y >= stageBox.y + stageBox.height - 2, 'crate: Close sits below the stage in the modal flow');
  await page.locator('.crate-x').click();
  await page.waitForTimeout(400);
  check(await page.locator('.crate-layer').count() === 0, 'crate: Close works');

  // Captain: tapping the whole skill card spends the point
  await run(page, "Save.reset(); Save.data.hero.level = 5; Save.data.hero.points = 2; Save.data.levels['1-2'] = { cleared: true, stars: 3 }; App.go('hero');");
  await page.waitForTimeout(800);
  await page.locator('.skill[data-skill="sharp_nib"] .sk-desc').click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => Save.data.hero.skills.sharp_nib === 1 && Save.data.hero.points === 1), 'captain: tapping the card body spends a point');
  await page.locator('.skill[data-skill="sharp_nib"] .plus-btn').click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => Save.data.hero.skills.sharp_nib === 2 && Save.data.hero.points === 0), 'captain: the + spends exactly one point (no double count)');

  // Loadout: lent supply on 1-2, key badges on desktop
  await run(page, "Save.reset(); Save.data.levels['1-1'] = { cleared: true, stars: 3 }; App.go('loadout', { levelId: '1-2' });");
  await page.waitForTimeout(700);
  const lent = await page.locator('.scard.lent').innerText().catch(() => '');
  check(/Pencil Rain/.test(lent) && /Lent for this battle/.test(lent), 'loadout 1-2: Pencil Rain shown as lent');
  check(!(await page.locator('.lo-sheet').innerText()).includes('No supplies yet'), 'loadout 1-2: no "No supplies yet"');
  await run(page, "App.go('loadout', { levelId: '1-4' });");
  await page.waitForTimeout(500);
  check(/A and D/.test(await page.locator('.lo-intro').innerText()), 'loadout 1-4 (desktop): keyboard copy');

  // Daily card status
  await run(page, "Save.reset(); Save.data.levels['2-1'] = { cleared: true, stars: 3 }; const m = await import('./src/game/daily.js'); Save.data.daily.lastPlayed = m.todayStr(); App.go('daily');");
  await page.waitForTimeout(700);
  check(/Try again/i.test(await page.locator('.daily-screen').innerText()), 'daily: after a loss the card says Try again');
  await run(page, "const m = await import('./src/game/daily.js'); Save.data.daily.lastWin = m.todayStr(); App.go('daily');");
  await page.waitForTimeout(700);
  check(/Done for today/i.test(await page.locator('.daily-screen').innerText()), 'daily: after a win the card says Done for today');

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors[0] : ''));
  await ctx.close();
}

// ---------------------------------------------------------------- phone
{
  console.log('\n== phone 667x375 touch');
  const { ctx, page, errors } = await open(PHONE);
  await run(page, "Save.reset(); Save.data.levels['1-1'] = { cleared: true, stars: 3 }; Save.data.hero.level = 5; Save.data.hero.points = 1; Save.data.levels['1-2'] = { cleared: true, stars: 3 }; Save.data.unlockedSpells = ['pencil_rain']; Save.data.loadout.spells = ['pencil_rain']; App.go('loadout', { levelId: '1-4' });");
  await page.waitForTimeout(700);
  check(!/A and D/.test(await page.locator('.lo-intro').innerText()), 'loadout 1-4 (touch): no A and D copy');
  check(/arrow/i.test(await page.locator('.lo-intro').innerText()), 'loadout 1-4 (touch): arrow-button copy');
  check(!/^[ZXC]$/.test(await page.locator('.scard .sc-key').first().innerText()), 'loadout (touch): no Z/X/C key badge');
  await run(page, "App.go('hero');");
  await page.waitForTimeout(700);
  await page.locator('.skill[data-skill="sharp_nib"] .sk-desc').tap();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => Save.data.hero.skills.sharp_nib === 1), 'captain (phone): tapping the card body spends a point');
  const plus = await page.locator('.skill[data-skill="thick_cape"] .plus-btn').boundingBox();
  check(plus && plus.width >= 44 && plus.height >= 44, 'captain (phone): + target is at least 44 px (' + Math.round(plus.width) + 'x' + Math.round(plus.height) + ')');
  await run(page, "App.goTitle(); for (let i = 0; i < 5; i++) UI.toast('Toast ' + i, 'info', 3000);");
  await page.waitForTimeout(300);
  check(await page.locator('.toast').count() === 2, 'toasts (phone): at most 2 at once');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors[0] : ''));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nmeta round2 flow ok');
process.exit(failures.length ? 1 : 0);
