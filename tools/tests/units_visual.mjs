// Stages unit scenes in the real renderer and writes PNGs to tools/out/units-*.png.
//   node tools/tests/units_visual.mjs [scene ...]   scenes: gallery action icons (default: all)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const scenes = want.length ? want : ['gallery', 'action', 'icons'];

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
await page.goto(url);
await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
await page.waitForTimeout(500);

// Stage helpers live in the page.
await page.evaluate(async () => {
  const { Battle } = await import('./src/sim/index.js');
  const { UNITS } = await import('./src/data/units.js');
  window.__S = {
    Battle, UNITS,
    mk(opts = {}) {
      const tc = (f, o = {}) => ({ faction: f, startInk: 0, income: 0, popCap: 99, scribeCap: 4, roster: Object.keys(UNITS), unitLevels: {}, fort: { hp: 1e6, turret: false, invulnerable: true }, ...o });
      const b = new Battle({ mode: 'campaign', seed: opts.seed || 3, width: 2400, page: opts.page || 'ruled', level: null, modifiers: [], teams: [tc('ink', opts.p), tc(opts.faction || 'red', opts.e)] });
      window.App.loop.stop();
      document.getElementById('ui').style.display = 'none';
      window.App.endSession();
      window.App.renderer.setBattle(b, { camX: opts.camX ?? 300 });
      window.App.renderer.cam.targetX = null;
      window.__S.b = b;
      return b;
    },
    put(team, id, x, o = {}) { return window.__S.b.spawnUnit(team, id, { x, z: 0, instant: true, ...o }); },
    run(secs) {
      const b = window.__S.b, r = window.App.renderer;
      const n = Math.round(secs * 60);
      for (let i = 0; i < n; i++) { b.update(1 / 60); r.update(1 / 60); b.events.length = 0; }
    },
    shot(camX) {
      const r = window.App.renderer;
      if (camX != null) r.cam.x = camX;
      r.render(1 / 60, 1);
    },
  };
});

let n = 0;
const snap = async (name, camX, clip) => {
  await page.evaluate((cx) => window.__S.shot(cx), camX ?? null);
  const f = path.join(out, `units-${name}.png`);
  await page.screenshot({ path: f, clip: clip || { x: 0, y: 300, width: 1280, height: 300 } });
  console.log('screenshot', path.relative(root, f));
};

const ROSTER = ['scribe', 'brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'rider', 'bomber', 'medic', 'doodler', 'catapult', 'colossus', 'ninja', 'critter'];

if (scenes.includes('gallery')) {
  for (const [team, tag] of [[0, 'blue'], [1, 'red']]) {
    await page.evaluate(({ ROSTER, team }) => {
      const S = window.__S;
      S.mk({ camX: 220 });
      let x = 330;
      for (const id of ROSTER) {
        const u = S.put(team, id, x, { z: 0, level: 1 });
        if (id === 'ninja') u.stealth = false;
        u.facing = 1;
        u.addBuff({ id: 'root', t: 99, root: true });
        x += id === 'catapult' ? 150 : id === 'colossus' ? 130 : id === 'rider' ? 100 : 78;
      }
      S.run(0.3);
    }, { ROSTER, team });
    await snap(`gallery-${tag}`);
  }
  await page.evaluate(() => {
    const S = window.__S;
    S.mk({ camX: 150 });
    const r = S.put(0, 'rider', 400, { level: 1 }); r.addBuff({ id: 'root', t: 99, root: true });
    S.run(0.2);
  });
  await snap('rider-closeup', 150, { x: 200, y: 360, width: 300, height: 200 });
  // levelled gear
  await page.evaluate(({ ROSTER }) => {
    const S = window.__S;
    S.mk({ camX: 220 });
    let x = 330;
    for (const id of ROSTER) {
      const u = S.put(0, id, x, { z: 0, level: 10 });
      if (id === 'ninja') u.stealth = false;
      u.addBuff({ id: 'root', t: 99, root: true });
      x += id === 'catapult' ? 150 : id === 'colossus' ? 130 : id === 'rider' ? 100 : 78;
    }
    S.run(0.3);
  }, { ROSTER });
  await snap('gallery-lv10');
}

if (scenes.includes('icons')) {
  const urls = await page.evaluate(async ({ ROSTER }) => {
    const { unitIcon } = await import('./src/render/icons.js');
    const res = {};
    for (const id of ROSTER) res[id] = unitIcon(id, { size: 140 });
    return res;
  }, { ROSTER });
  const html = `<body style="margin:0;background:#f4eed8;display:flex;flex-wrap:wrap;gap:6px;padding:10px;width:1180px">${ROSTER.map((id) => `<div style="text-align:center;font:14px sans-serif"><img src="${urls[id]}" width="140" height="140" style="background:#fffdf4;border:2px solid #1b2240"><br>${id}</div>`).join('')}<div style="width:100%"></div>${ROSTER.map((id) => `<img src="${urls[id]}" width="70" height="70" style="background:#fffdf4;border:2px solid #1b2240">`).join('')}</body>`;
  const p2 = await ctx.newPage();
  await p2.setContent(html);
  await p2.setViewportSize({ width: 1200, height: 520 });
  await p2.screenshot({ path: path.join(out, 'units-icons.png') });
  console.log('screenshot tools/out/units-icons.png');
  await p2.close();
}

if (scenes.includes('action')) {
  // Rider charge.
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 150 });
    b.setStance(0, 'charge');
    S.put(0, 'rider', 300, { level: 6 });
    for (let i = 0; i < 4; i++) S.put(1, 'brawler', 800 + i * 40, { hpMult: 4 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(1.3);
  });
  await snap('rider-run', 100);
  await page.evaluate(() => { window.__S.run(0.9); });
  await snap('rider-hit', 350);
  await page.evaluate(() => { window.__S.run(0.25); });
  await snap('rider-hit2', 350);

  // Bomber blast.
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 500 });
    b.setStance(0, 'charge');
    S.put(0, 'bomber', 650, { level: 9 });
    for (let i = 0; i < 5; i++) S.put(1, 'brawler', 1000 + i * 24, { hpMult: 3, z: (i % 3) - 1 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(2.4);
  });
  await snap('bomber-run');
  await page.evaluate(() => {
    const S = window.__S;
    let guard = 0;
    while (!S.b.units.some((u) => u.type === 'bomber' && u.attacking) && guard++ < 600) S.run(0.016);
    S.run(0.2);
  });
  await snap('bomber-blast');
  await page.evaluate(() => { window.__S.run(0.35); });
  await snap('bomber-after');

  // Medic + doodler chain.
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 450 });
    b.setStance(0, 'hold', 800);
    const a = S.put(0, 'brawler', 800, { hpFrac: 0.3 });
    S.put(0, 'medic', 720, { level: 6 });
    S.put(0, 'doodler', 640, { level: 6 });
    for (let i = 0; i < 4; i++) S.put(1, 'brawler', 1000 + i * 55, { hpMult: 10, z: (i % 3) - 1 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(1.5);
  });
  await snap('medic-doodler-a');
  await page.evaluate(() => {
    const S = window.__S;
    let guard = 0;
    while (!S.b.areas.some((a) => a.kind === 'chain_jump') && guard++ < 600) S.run(0.016);
    S.run(0.12);
  });
  await snap('chain');
  await page.evaluate(() => { window.__S.run(1.6); });
  await snap('medic-doodler-b');

  // Catapult windup, throw, ink pot.
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 350 });
    S.put(0, 'catapult', 600, { level: 6 }).facing = 1;
    for (let i = 0; i < 4; i++) S.put(1, 'brawler', 1050 + i * 30, { hpMult: 10 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(0.3);
  });
  await snap('catapult-idle');
  await page.evaluate(() => {
    const S = window.__S;
    let guard = 0;
    const c = S.b.units.find((u) => u.type === 'catapult');
    while (!(c.attacking && c.anim.atk > 0.35) && guard++ < 900) S.run(0.016);
  });
  await snap('catapult-windup');
  await page.evaluate(() => {
    const S = window.__S;
    const c = S.b.units.find((u) => u.type === 'catapult');
    let guard = 0;
    while (!(c.attacking && c.anim.atk > 0.56) && guard++ < 300) S.run(0.008);
  });
  await snap('catapult-throw');
  await page.evaluate(() => { window.__S.run(0.8); });
  await snap('catapult-flight');
  await page.evaluate(() => { window.__S.run(0.9); });
  await snap('catapult-after');
  // ink pot puddle
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 350 });
    S.put(0, 'catapult', 600, { level: 6 });
    for (let i = 0; i < 3; i++) S.put(1, 'brawler', 1050 + i * 30, { hpMult: 10 }).addBuff({ id: 'root', t: 99, root: true });
    let g = 0;
    while (!b.areas.some((a) => a.kind === 'ink_pot') && g++ < 1500) S.run(0.016);
    S.run(0.7);
  });
  await snap('ink-pot', 500);

  // Ninja.
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 300 });
    b.setStance(0, 'charge');
    S.put(0, 'ninja', 450, { level: 9 });
    S.put(0, 'brawler', 520);
    S.put(1, 'brawler', 900, { hpMult: 6 }).addBuff({ id: 'root', t: 99, root: true });
    const a = S.put(1, 'archer', 1000, { hpMult: 3 });
    a.addBuff({ id: 'root', t: 99, root: true });
    S.run(1.0);
  });
  await snap('ninja-run');
  await page.evaluate(() => {
    const S = window.__S;
    let g = 0;
    while (!S.b.rec_bs && g++ < 900) { S.run(0.016); if (S.b.units.some((u) => u.type === 'ninja' && !u.stealth)) { S.b.rec_bs = true; } }
  });
  await snap('ninja-strike');

  // Colossus
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 300 });
    b.setStance(0, 'charge');
    S.put(0, 'colossus', 500, { level: 6 });
    for (let i = 0; i < 4; i++) S.put(1, 'brawler', 700 + i * 22, { hpMult: 3, z: (i % 3) - 1 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(1.2);
  });
  await snap('colossus-a');
  await page.evaluate(() => {
    const S = window.__S;
    const c = S.b.units.find((u) => u.type === 'colossus');
    let g = 0;
    while (!(c.attacking && c.anim.atk > 0.42) && g++ < 900) S.run(0.016);
  });
  await snap('colossus-windup');
  await page.evaluate(() => { const S = window.__S; const c = S.b.units.find((u) => u.type === 'colossus'); let g = 0; while (!(c.attacking && c.anim.atk > 0.55) && g++ < 900) S.run(0.008); });
  await snap('colossus-slam');

  // Doodler critters
  await page.evaluate(() => {
    const S = window.__S;
    const b = S.mk({ camX: 300 });
    b.setStance(0, 'charge');
    S.put(0, 'doodler', 500, { level: 6 });
    for (let i = 0; i < 2; i++) { const c = S.put(0, 'critter', 580 + i * 40, { level: 6 }); c.lifetime = 30; }
    for (let i = 0; i < 2; i++) S.put(1, 'brawler', 800 + i * 40, { hpMult: 5 }).addBuff({ id: 'root', t: 99, root: true });
    S.run(2.0);
  });
  await snap('critters');
}

await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('visual ok');
