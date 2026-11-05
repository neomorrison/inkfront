// Screenshots for the AI/levels fixes: the new intro texts on the loadout screen and the 1-3 ambush marching in.
//   node tools/tests/ai_shots.mjs [--mobile]    -> tools/out/ai-*.png
import path from 'node:path';
import { serve, launch, VIEWPORTS, out } from './lib.mjs';

const mobile = process.argv.includes('--mobile');
const { server, url } = await serve();
const browser = await launch();
const ctx = await browser.newContext(mobile ? VIEWPORTS.mobile : VIEWPORTS.desktop);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const snap = async (name) => { const f = path.join(out, `ai-${name}${mobile ? '-mobile' : ''}.png`); await page.screenshot({ path: f }); console.log('screenshot', f); };
try {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  await page.evaluate(async () => {
    const { Save } = await import('./src/game/save.js');
    const { LEVELS } = await import('./src/data/levels.js');
    const { unlockUnit, unlockSpell } = await import('./src/game/progression.js');
    for (const l of LEVELS.slice(0, 12)) {
      Save.data.levels[l.id] = { stars: 3, cleared: true, plays: 1 };
      const u = l.rewards.unlock || {};
      if (u.unit) unlockUnit(Save.data, u.unit);
      if (u.spell) unlockSpell(Save.data, u.spell);
    }
    Save.data.tutorialDone = true;
    Save.data.seen = { ...(Save.data.seen || {}), 'tut.basics': true, 'tut.spells': true, 'tut.stance': true, 'tut.hero': true };
  });
  for (const id of ['1-3', '1-4', '3-1']) {
    await page.evaluate((lv) => window.App.go('loadout', { levelId: lv }), id);
    await page.waitForTimeout(700);
    await snap('loadout-' + id);
    const text = await page.evaluate(() => (document.querySelector('.lo-intro') || {}).textContent);
    console.log(id, 'intro:', text);
  }
  // The ambush: 1-3 enemies are already marching 6 seconds in.
  await page.evaluate(() => window.App.startBattle({ kind: 'campaign', levelId: '1-3' }));
  await page.waitForSelector('.hud', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await snap('ambush-t2');
  await page.waitForTimeout(5000);
  await snap('ambush-t7');
  const st = await page.evaluate(() => {
    const b = window.App.session.battle;
    const xs = b.units.filter((u) => u.team === 1 && u.type !== 'scribe').map((u) => Math.round(u.x));
    return { t: Math.round(b.time), phase: b.teams[1].ai.phase, xs };
  });
  console.log('ambush state', JSON.stringify(st));
} catch (e) {
  errors.push('script: ' + (e.stack || e.message));
}
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no console errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
