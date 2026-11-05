// Browser smoke test with real clicks and keys (no debug shortcuts).
//   node tools/smoke.mjs                 title -> map -> 1-1 -> play ~25 s -> screenshots
//   node tools/smoke.mjs --level 2-3     start from the map on another level (save gets unlocked first)
//   node tools/smoke.mjs --mobile        iPhone-ish landscape viewport with touch
//   node tools/smoke.mjs --headed        watch it
// Writes screenshots to tools/out/ and exits non-zero on page errors or console errors.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const level = val('level', '1-1');
const mobile = flag('mobile');
const seconds = +val('seconds', 25);

// Serve the repo on a free port.
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
  const opts = { headless: !flag('headed') };
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
const ctx = await browser.newContext(mobile
  ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let shot = 0;
const snap = async (name) => {
  const f = path.join(out, `${String(++shot).padStart(2, '0')}-${name}${mobile ? '-mobile' : ''}.png`);
  await page.screenshot({ path: f });
  console.log('screenshot', path.relative(root, f));
};
const click = async (selector, opts) => {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  if (mobile) await el.tap(opts); else await el.click(opts);
};

try {
  await page.goto(url);
  if (level !== '1-1') {
    // Unlock levels up to the target by marking earlier ones cleared in a fresh save.
    await page.evaluate((id) => {
      const L = window.App && window.App.ready ? null : null;
      localStorage.removeItem('inkfront.save.v1');
      return id;
    }, level);
    await page.waitForFunction(() => window.App && window.App.ready);
    await page.evaluate(async (id) => {
      const { LEVELS } = await import('./src/data/levels.js');
      const { Save } = await import('./src/game/save.js');
      const { unlockUnit, unlockSpell } = await import('./src/game/progression.js');
      for (const l of LEVELS) {
        if (l.id === id) break;
        Save.data.levels[l.id] = { stars: 3, cleared: true, plays: 1 };
        const u = l.rewards.unlock || {};
        if (u.unit) unlockUnit(Save.data, u.unit);
        if (u.spell) unlockSpell(Save.data, u.spell);
      }
      Save.save();
    }, level);
    await page.reload();
  }
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await snap('title');
  await click('.screen-title button.btn');
  await page.waitForTimeout(600);
  await snap('map');
  // Click the level button by its id text.
  await click(`button.btn:has-text("${level}")`);
  await page.waitForTimeout(800);
  // A loadout screen may sit between the map and the battle.
  const startBtn = page.locator('.screen-loadout button.btn:has-text("Battle"), .screen-loadout button.btn:has-text("Start")');
  if (await startBtn.count()) { await snap('loadout'); await (mobile ? startBtn.first().tap() : startBtn.first().click()); await page.waitForTimeout(800); }
  await snap('battle-start');
  const cards = page.locator('.ucard');
  const n = await cards.count();
  console.log('unit cards:', n);
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < seconds * 1000) {
    if (n) { const c = cards.nth(i % n); if (mobile) await c.tap({ force: true }); else await c.click({ force: true }); }
    if (!mobile) {
      await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
      if (i % 6 === 3) await page.keyboard.press('KeyW');
      if (i % 9 === 5) await page.keyboard.press('KeyQ');
    }
    i++;
    await page.waitForTimeout(700);
    if (i === 8) await snap('battle-mid');
  }
  await snap('battle-late');
  // Pause menu via the real button.
  await click('.hud-sys button.btn:last-child');
  await page.waitForTimeout(400);
  await snap('pause');
  await click('.modal-pause button.btn:has-text("Resume")');
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
  await snap('failure').catch(() => {});
}

await browser.close();
server.close();
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('smoke ok');
