// Visual staging for the Captain package. Writes PNGs to tools/out/hero-*.png.
//   node tools/tests/hero_shots.mjs [hats|battle|abilities|all]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const which = process.argv[2] || 'all';
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const snap = async (name, clip) => {
  const f = path.join(out, `hero-${name}.png`);
  await page.screenshot({ path: f, clip });
  console.log('screenshot', path.relative(root, f));
};

try {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  await page.waitForTimeout(500);

  if (which === 'hats' || which === 'all') {
    await page.evaluate(async () => {
      const { HATS } = await import('./src/data/hats.js');
      const { hatIcon, unitIcon } = await import('./src/render/icons.js');
      const wrap = document.createElement('div');
      wrap.id = 'hatgrid';
      wrap.style.cssText = 'position:fixed;inset:0;background:#fffdf4;z-index:99999;overflow:auto;padding:8px;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start';
      const cell = (src, label, w) => {
        const d = document.createElement('div');
        d.style.cssText = `width:${w}px;text-align:center;border:1px solid #ddd;background:#fff`;
        d.innerHTML = `<img src="${src}" width="${w - 6}" height="${w - 6}"><div>${label}</div>`;
        wrap.appendChild(d);
      };
      for (const h of HATS) cell(hatIcon(h.id, 128), h.id, 120);
      for (const h of HATS) cell(unitIcon('captain', { hat: h.id, size: 128 }), h.id, 120);
      const { icon } = await import('./src/render/icons.js');
      for (const n of ['ability_rally', 'ability_slam', 'ability_inkstorm']) cell(icon(n, 128), n, 120);
      document.body.appendChild(wrap);
    });
    await page.waitForTimeout(300);
    await snap('hats-icons', { x: 0, y: 0, width: 1280, height: 720 });
    await page.evaluate(() => { document.getElementById('hatgrid').scrollTop = 720; });
    await page.waitForTimeout(200);
    await snap('hats-captains', { x: 0, y: 0, width: 1280, height: 720 });
    await page.evaluate(async () => {
      document.getElementById('hatgrid').remove();
    });
  }

  if (which === 'battle' || which === 'abilities' || which === 'all') {
    // Stage a battle with a level 30 Captain and drive the session by hand (loop paused, fixed steps).
    await page.evaluate(async () => {
      const { Save } = await import('./src/game/save.js');
      Save.data.hero.level = 30;
      Save.data.hero.hat = 'captain';
      Save.data.settings.shake = false;
      window.App.startBattle({ kind: 'campaign', levelId: '2-1' });
      const S = window.App.session;
      window.App.loop.paused = true;
      S.heroCamT = 999;
      const b = S.battle;
      const h = () => b.teams[0].hero;
      window.__S = S;
      window.__step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) S.update(1 / 60); };
      window.__until = (fn, maxSec = 6) => { for (let i = 0; i < maxSec * 60; i++) { if (fn()) return true; S.update(1 / 60); } return false; };
      window.__dummy = (x, hp = 80) => {
        const e = b.spawnUnit(1, 'brawler', { x, z: (Math.random() - 0.5) * 1.2, instant: true, hpMult: hp });
        e.speed = 0; e.dmg = 0; e.atkCd = 99;
        return e;
      };
      window.__clear = () => { for (const u of b.units) if (u.team === 1 && u.type !== 'scribe') u.alive = false; b.teams[1].fort.hp = b.teams[1].fort.maxHp; };
      window.__frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.__clip = () => {
        const hh = h();
        const cam = window.App.renderer.cam;
        return { x: Math.max(0, cam.sx(hh.x) - 200), y: Math.max(0, cam.groundY - 190), width: 400, height: 240 };
      };
      // quiet: no enemy AI, no player AI
      b.teams[1].ai = null;
      b.teams[0].fort.turret.on = false;
      b.teams[1].fort.turret.on = false;
      window.__clear();
      window.__step(1.2);
      const hero = h();
      hero.x = 1100; hero.px = 1100;
      window.__step(0.1);
    });
    const shot = async (name) => {
      await page.evaluate(() => window.__frame());
      const clip = await page.evaluate(() => window.__clip());
      await snap(name, clip);
    };
    console.log(await page.evaluate(() => { const h = window.__S.battle.teams[0].hero; return JSON.stringify({ st: h.anim.style, att: h.attacking, state: h.state, air: h.airborne, busy: h.data.busyT, atk: h.anim.atk, moving: h.anim.moving, x: h.x, y: h.y, hp: h.hp, ctl: h.data.controlled, t: h.anim.t }); }));
    // Idle Captain with cape, ring, hat.
    await shot('idle');
    // Walking right: cape streams.
    await page.evaluate(() => { window.__S.touchHero = 1; window.__step(1.0); });
    await shot('run');
    await page.evaluate(() => { window.__S.touchHero = 0; window.__step(0.1); });
    // Walking left (cape flips side with the figure).
    await page.evaluate(() => { window.__S.touchHero = -1; window.__step(0.8); });
    await shot('run-left');
    await page.evaluate(() => { window.__S.touchHero = 0; window.__step(0.1); });

    // Combo: three swings at a dummy line.
    await page.evaluate(() => {
      const h = window.__S.battle.teams[0].hero;
      window.__clear();
      for (const d of [28, 70, 110]) window.__dummy(h.x + d);
      window.__S.touchHero = 1; window.__step(0.05); window.__S.touchHero = 0;
      window.__combo = 0;
      window.__S.listen((e) => { if (e.type === 'heroHit') window.__combo = e.combo; });
    });
    for (const n of [1, 2, 3]) {
      await page.evaluate((n) => { window.__until(() => window.__combo === n, 3); window.__step(0.06); }, n);
      await shot('combo-' + n);
    }
    await page.evaluate(() => { window.__clear(); window.__step(0.5); });
  }

  if (which === 'abilities' || which === 'all') {
    const shot = async (name) => {
      await page.evaluate(() => window.__frame());
      const clip = await page.evaluate(() => window.__clip());
      await snap(name, clip);
    };
    // Rally
    await page.evaluate(() => {
      const b = window.__S.battle, h = b.teams[0].hero;
      for (const d of [-120, -70, 90, 150]) b.spawnUnit(0, 'brawler', { x: h.x + d, instant: true });
      window.__S.heroAbility('rally'); window.__step(0.12);
    });
    await shot('rally-1');
    await page.evaluate(() => window.__step(0.2));
    await shot('rally-2');
    await page.evaluate(() => window.__step(0.8));
    // Slam
    await page.evaluate(() => {
      const b = window.__S.battle, h = b.teams[0].hero;
      window.__clear();
      h.facing = 1;
      for (const d of [180, 215, 250, 150]) window.__dummy(h.x + d, 20);
      window.__S.heroAbility('slam'); window.__step(0.15);
    });
    await shot('slam-air');
    await page.evaluate(() => { window.__until(() => window.__S.battle.teams[0].hero.data.busyT > 0, 1); window.__step(0.1); });
    await shot('slam-land');
    await page.evaluate(() => window.__step(0.3));
    await shot('slam-after');
    // Fury full glint
    await page.evaluate(() => { window.__clear(); const h = window.__S.battle.teams[0].hero; h.data.fury = 100; window.__step(1.0); });
    await shot('fury-full');
    // Inkstorm
    await page.evaluate(() => {
      const b = window.__S.battle, h = b.teams[0].hero;
      h.data.fury = 100;
      for (const d of [-60, 40, 75]) window.__dummy(h.x + d, 200);
      window.__S.heroAbility('inkstorm'); window.__step(0.3);
    });
    await shot('storm-1');
    await page.evaluate(() => window.__step(0.13));
    await shot('storm-2');
    await page.evaluate(() => { window.__S.touchHero = 1; window.__step(0.5); });
    await shot('storm-move');
    await page.evaluate(() => { window.__S.touchHero = 0; window.__step(4); });
    // Every hat in battle: crop the Captain from the live canvas into one grid.
    const grid = await page.evaluate(async () => {
      const { HATS } = await import('./src/data/hats.js');
      const b = window.__S.battle, h = b.teams[0].hero;
      window.__clear();
      for (const u of b.units) if (u.team === 0 && u !== h) u.alive = false;
      h.hp = h.maxHp; h.x = 1100; h.px = 1100;
      window.__step(0.3);
      const cam = window.App.renderer.cam;
      const game = document.getElementById('game');
      const cw = 150, ch = 190;
      const g = document.createElement('canvas');
      const cols = 8;
      g.width = cols * cw; g.height = Math.ceil(HATS.length / cols) * ch;
      const gx = g.getContext('2d');
      gx.fillStyle = '#fffdf4'; gx.fillRect(0, 0, g.width, g.height);
      gx.font = '13px sans-serif'; gx.fillStyle = '#1b2240';
      let i = 0;
      for (const hat of HATS) {
        h.data.heroCfg.hat = hat.id;
        await window.__frame();
        const sx = cam.sx(h.x), sy = cam.groundY;
        const k = window.devicePixelRatio || 1;
        gx.drawImage(game, (sx - 75) * k, (sy - 150) * k, 150 * k, 190 * k, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
        gx.fillText(hat.id, (i % cols) * cw + 6, Math.floor(i / cols) * ch + 14);
        i++;
      }
      return g.toDataURL();
    });
    fs.writeFileSync(path.join(out, 'hero-hats-battle.png'), Buffer.from(grid.split(',')[1], 'base64'));
    console.log('screenshot tools/out/hero-hats-battle.png');
  }
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
  await snap('failure').catch(() => {});
}
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('shots ok');
