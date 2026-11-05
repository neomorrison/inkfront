// Stages package C visuals in a real browser and screenshots them to tools/out/:
// coffee stains + rain, night, Endless waves and the storm perk. Look at the PNGs.
//   node tools/tests/modes_shots.mjs [--mobile]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const mobile = process.argv.includes('--mobile');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

async function launch() {
  const opts = { headless: true };
  try { return await chromium.launch({ ...opts, channel: 'chrome' }); } catch (e) { /* fall back */ }
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort() : [];
  for (const d of dirs.reverse()) {
    for (const sub of ['chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
      const exe = path.join(cache, d, sub);
      if (fs.existsSync(exe)) return chromium.launch({ ...opts, executablePath: exe });
    }
  }
  throw new Error('No Chrome or Chromium found');
}

const browser = await launch();
const ctx = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const snap = async (name) => { const f = path.join(out, `modes-${name}${mobile ? '-mobile' : ''}.png`); await page.screenshot({ path: f }); console.log('screenshot', path.relative(root, f)); };

try {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  // A mid-game save so the loadout is rich.
  await page.evaluate(async () => {
    const { Save } = await import('./src/game/save.js');
    const { LEVELS } = await import('./src/data/levels.js');
    const { unlockUnit, unlockSpell } = await import('./src/game/progression.js');
    for (const l of LEVELS.slice(0, 18)) {
      Save.data.levels[l.id] = { stars: 3, cleared: true, plays: 1 };
      const u = l.rewards.unlock || {};
      if (u.unit) unlockUnit(Save.data, u.unit);
      if (u.spell) unlockSpell(Save.data, u.spell);
    }
    for (const id of Save.data.unlockedUnits) Save.data.units[id] = 4;
    Save.data.hero.level = 8;
    Save.save();
  });

  // 1. Coffee stains + rain on the Sketchbook, fast-forwarded to the middle of the fight.
  await page.evaluate(async () => {
    const { LEVEL_BY_ID } = await import('./src/data/levels.js');
    LEVEL_BY_ID['3-3'].modifiers = ['coffee_stains', 'rain'];
    window.App.startBattle({ kind: 'campaign', levelId: '3-3' });
    window.App.loop.timeScale = 1;
    const b = window.App.session.battle;
    const st = b.areas.find((a) => a.kind === 'coffee_stain');
    window.App.session.cam.centerOn(st.x);
    // Park a few units in a stain so the slow is visible.
    for (let i = 0; i < 4; i++) { b.spawnUnit(0, 'brawler', { x: st.x - 30 + i * 25, instant: true }); b.spawnUnit(1, 'glowrunner', { x: st.x + 60 + i * 25, instant: true }); }
  });
  await page.waitForTimeout(1800);
  await snap('coffee-rain');

  // 2. Night.
  await page.evaluate(async () => {
    const { LEVEL_BY_ID } = await import('./src/data/levels.js');
    LEVEL_BY_ID['3-3'].modifiers = ['night', 'coffee_stains'];
    window.App.startBattle({ kind: 'campaign', levelId: '3-3' });
    const b = window.App.session.battle;
    const st = b.areas.find((a) => a.kind === 'coffee_stain');
    window.App.session.cam.centerOn(st.x - 200);
    for (let i = 0; i < 5; i++) b.spawnUnit(0, 'brawler', { x: st.x - 260 + i * 30, instant: true });
  });
  await page.waitForTimeout(1500);
  await snap('night-stains');

  // 3. Endless: let waves roll, auto-pick perks, add the storm perk, screenshot in the thick of it.
  await page.evaluate(async () => {
    window.App.startBattle({ kind: 'endless' });
    const s = window.App.session;
    s.battle.teams[0].perks.push('storm_caller', 'fire_everything');
    window.__pick = setInterval(() => {
      const E = window.App.session && window.App.session.battle.endless;
      if (E && E.state === 'draft') { window.App.session.togglePause && 0; E.choose(E.offer[0]); window.App.loop.paused = false; }
    }, 200);
    window.App.loop.timeScale = 4;
    const b = s.battle;
    for (let i = 0; i < 5; i++) b.requestUnit(0, 'brawler');
  });
  await page.waitForTimeout(16000);
  const info = await page.evaluate(() => { const E = window.App.session.battle.endless; return { wave: E.wave, state: E.state, left: E.enemiesLeft }; });
  console.log('endless', JSON.stringify(info));
  await snap('endless');
  await page.waitForTimeout(3000);
  await snap('endless-2');
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
  await snap('failure').catch(() => {});
}
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('modes shots ok');
