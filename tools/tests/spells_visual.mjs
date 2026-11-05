// Visual check for the Supplies: stage a battle, cast each spell and screenshot mid-effect.
//   node tools/tests/spells_visual.mjs                 all spells + icon sheet
//   node tools/tests/spells_visual.mjs eraser stapler  only these
//   add --mobile for 844x390 touch. Writes tools/out/spell-<id>-<n>.png. Exits non-zero on console errors.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const ids = args.filter((a) => !a.startsWith('--'));
const ALL = ['pencil_rain', 'coffee_spill', 'ruler_smash', 'paper_planes', 'sticky_wall', 'stapler', 'highlighter', 'doodle_drop', 'eraser'];
const run = ids.length ? ids : ALL;
// seconds after the cast at which to take pictures
const SHOTS = {
  pencil_rain: [0.35, 0.8], coffee_spill: [0.25, 0.7, 3, 9.5], ruler_smash: [0.4, 0.8, 1.3, 2.8], paper_planes: [1.2, 2.6, 4],
  sticky_wall: [0.15, 0.7, 'hurt'], stapler: [0.3, 0.62, 1.6], highlighter: [0.2, 1.4], doodle_drop: [0.35, 1.0], eraser: [0.3, 1.2, 2.4],
};

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
const ctx = await browser.newContext(mobile
  ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  for (const id of run) {
    // Stage: profile with the spell unlocked + equipped, a campaign battle, frozen armies in front of the camera.
    await page.evaluate(async ({ id }) => {
      const { Save } = await import('./src/game/save.js');
      if (!Save.data.unlockedSpells.includes(id)) Save.data.unlockedSpells.push(id);
      Save.data.loadout.spells = [id];
      Save.data.spells[id] = 3;
      window.App.startBattle({ kind: 'campaign', levelId: '1-1' });
      const s = window.App.session, b = s.battle;
      s.app.loop.paused = true;
      s.heroCamT = 0;
      for (const t of b.teams) t.ai = null;
      for (const u of b.units) if (!u.isHero) u.alive = false;
      b.units = b.units.filter((u) => u.isHero || u.alive);
      b.teams[0].spells[0].cd = 0;
      const S = b.width / 2 - 430 - 1160; // stage away from the middle ink well
      window.__S = S;
      const mk = (team, type, x, z) => { x += S; const u = b.spawnUnit(team, type, { x, z, instant: true, hpMult: 6 }); u.addBuff({ id: 'test_hold', t: 9999, root: true }); return u; };
      const foes = ['brawler', 'spearman', 'shieldbearer', 'slinger', 'brawler', 'spearman', 'brawler', 'archer', 'shieldbearer', 'brawler', 'spearman', 'slinger'];
      foes.forEach((t, i) => mk(1, t, 1180 + (i % 6) * 48 + (i < 6 ? 0 : 24), ((i * 5) % 7) / 3 - 1));
      ['brawler', 'spearman', 'brawler', 'shieldbearer', 'archer', 'brawler'].forEach((t, i) => mk(0, t, 960 + i * 34, ((i * 3) % 5) / 2 - 1));
      b.teams[0].hero && (b.teams[0].hero.x = 150);
      s.cam.centerOn(1160 + S);
      window.__s = s;
      window.__step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) s.update(1 / 60); };
    }, { id });
    await page.waitForTimeout(250);
    let cast = 1230;
    if (id === 'highlighter') cast = 1000;
    if (id === 'doodle_drop') cast = 1010;
    if (id === 'sticky_wall') cast = 1140;
    await page.evaluate(({ id, cast }) => {
      const b = window.__s.battle;
      if (id === 'sticky_wall') {
        // let the enemies walk so the wall has something to stop
        for (const u of b.units) if (u.team === 1) { u.buffs = u.buffs.filter((f) => f.id !== 'test_hold'); }
        b.setStance(1, 'charge');
      }
      b.castSpell(0, 0, cast + window.__S);
    }, { id, cast });
    let elapsed = 0;
    let n = 0;
    for (const at of SHOTS[id]) {
      if (at === 'hurt') {
        await page.evaluate(() => { const w = window.__s.battle.units.find((u) => u.type === 'sticky_wall'); if (w) w.hp = w.maxHp * 0.4; window.__step(0.4); });
      } else {
        await page.evaluate((d) => window.__step(d), at - elapsed);
        elapsed = at;
      }
      await page.waitForTimeout(120);
      const f = path.join(out, `spell-${id}-${++n}${mobile ? '-mobile' : ''}.png`);
      await page.screenshot({ path: f });
      console.log('screenshot', path.relative(root, f));
    }
    await page.evaluate(() => window.App.goTitle());
    await page.waitForTimeout(200);
  }
  if (!ids.length) {
    // icon sheet at 128, 64 and 48 px
    await page.evaluate(async (all) => {
      const { icon } = await import('./src/render/icons.js');
      const d = document.createElement('div');
      d.id = 'iconsheet';
      d.style.cssText = 'position:fixed;inset:0;background:#fffdf4;z-index:99999;padding:20px;display:grid;grid-template-columns:repeat(9,1fr);gap:8px;align-content:start';
      for (const id of all) {
        const cell = document.createElement('div');
        cell.style.cssText = 'text-align:center;font:12px sans-serif';
        for (const sz of [128, 64, 48]) { const im = new Image(); im.src = icon('spell_' + id, sz); im.style.cssText = `width:${sz}px;height:${sz}px;display:block;margin:6px auto;image-rendering:auto;`; cell.append(im); }
        cell.append(id);
        d.append(cell);
      }
      document.body.append(d);
    }, ALL);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `spell-icons${mobile ? '-mobile' : ''}.png`) });
    console.log('screenshot tools/out/spell-icons.png');
  }
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
}
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('spells visual ok');
