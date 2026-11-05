// Render test (Playwright): stages each page with armies fighting, plus night, rain and a perf benchmark.
//   node tools/tests/render.mjs            all shots + perf
//   node tools/tests/render.mjs --only perf
// Screenshots go to tools/out/render-*.png. Exits non-zero on page errors.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// Armies per chapter (player side is always blue; the enemy roster follows the chapter).
const SCENES = [
  { name: 'ruled', level: '1-4', foe: ['brawler', 'slinger', 'shieldbearer', 'spearman', 'brawler'] },
  { name: 'graph', level: '2-3', foe: ['smudgeling', 'sharpener', 'lead_thrower', 'graphite_golem', 'smudgeling'] },
  { name: 'sketch', level: '3-3', foe: ['glowrunner', 'neon_archer', 'marker_knight', 'glow_shaman', 'glowrunner'] },
  { name: 'chalk', level: '4-2', foe: ['dustborn', 'chalk_thrower', 'board_brute', 'dust_mage', 'dustborn'] },
  { name: 'last', level: '5-2', foe: ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest', 'crumb'] },
];
const MINE = ['brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'medic', 'bomber', 'rider', 'brawler', 'scribe'];

async function boot() {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 15000 });
  await page.waitForTimeout(500);
}

// Start a campaign level, hide the HUD, drop armies into the middle and let them fight for a while.
async function stage(level, foe, opts = {}) {
  await page.evaluate(async ({ level, foe, mine, opts }) => {
    const App = window.App;
    App.startBattle({ kind: 'campaign', levelId: level });
    const s = App.session, b = s.battle;
    document.getElementById('ui').style.display = 'none';
    if (opts.modifiers) for (const m of opts.modifiers) { b.modifiers.push(m); }
    if (opts.flags) Object.assign(b.flags, opts.flags);
    if (opts.wind) b.wind = opts.wind;
    if (opts.page) { b.page = opts.page; }
    const mid = b.width / 2 + (opts.shift || 0);
    const n = opts.count || 1;
    for (let k = 0; k < n; k++) {
      mine.forEach((id, i) => b.spawnUnit(0, id, { x: mid - 60 - i * 34 - k * 20, z: ((i + k) % 5) / 2 - 1, instant: true }));
      foe.forEach((id, i) => b.spawnUnit(1, id, { x: mid + 60 + i * 34 + k * 20, z: ((i + k) % 5) / 2 - 1, instant: true }));
    }
    s.cam.centerOn(mid);
    s.r.setBattle(b, { camX: s.cam.x });
    s.cam.centerOn(mid);
    App.loop.timeScale = opts.speed || 1;
  }, { level, foe, mine: MINE, opts });
}

const snap = async (name) => {
  const f = path.join(out, `render-${name}.png`);
  await page.screenshot({ path: f });
  console.log('screenshot', path.relative(root, f));
};

try {
  await boot();
  if (!only || only === 'pages') {
    for (const sc of SCENES) {
      await stage(sc.level, sc.foe);
      await page.waitForTimeout(3500);
      await snap(sc.name);
    }
    // Forts up close with damage: hit the enemy fort hard.
    for (const sc of SCENES) {
      await page.evaluate(async ({ level }) => {
        const App = window.App;
        App.startBattle({ kind: 'campaign', levelId: level });
        document.getElementById('ui').style.display = 'none';
        const b = App.session.battle;
        b.teams[1].fort.hp = b.teams[1].fort.maxHp * 0.25;
        b.teams[0].fort.hp = b.teams[0].fort.maxHp * 0.6;
        App.session.cam.centerOn(b.width - 330);
      }, { level: sc.level });
      await page.waitForTimeout(900);
      await snap('fort-' + sc.name);
    }
  }
  if (!only || only === 'weather') {
    await stage('3-3', SCENES[2].foe, { flags: { night: true }, modifiers: ['night'] });
    await page.waitForTimeout(3000);
    await snap('night');
    await stage('4-4', SCENES[3].foe, { modifiers: ['rain'] });
    await page.waitForTimeout(3000);
    await snap('rain');
    await stage('2-4', SCENES[1].foe, { modifiers: ['wind_right'], wind: 260 });
    await page.waitForTimeout(3000);
    await snap('wind');
  }
  if (!only || only === 'perf') {
    await stage('1-4', SCENES[0].foe, { count: 11, speed: 1 });
    const res = await page.evaluate(async () => {
      const App = window.App, b = App.session.battle, r = App.renderer;
      const fx = r.fx;
      // Keep the scene stuffed: ragdolls, particles.
      const feed = () => {
        for (let i = 0; i < 4; i++) fx.burst(b.width / 2 + (Math.random() - 0.5) * 500, -40, 0, 8, '#1b2240', 260, 'dot');
        if (fx.ragdolls.length < 60) {
          const u = b.units.find((x) => x.alive && x.team === 1);
          if (u) { const j = {}; for (const k of ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB']) j[k] = [u.x + Math.random() * 20, -30 - Math.random() * 40]; fx.ragdoll(j, { vx: 200, vy: -400, ground: 0, col: '#1b2240', paper: '#fff', lw: 2.5, scale: 1, life: 6 }); }
        }
      };
      // Wait a moment so the armies are mid-fight, then measure real frame times.
      await new Promise((r2) => setTimeout(r2, 1500));
      const times = [];
      let last = performance.now();
      const t0 = last;
      await new Promise((done) => {
        const tick = (now) => {
          times.push(now - last); last = now;
          feed();
          if (now - t0 < 5000) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      times.shift();
      const avg = times.reduce((a, c) => a + c, 0) / times.length;
      const sorted = times.slice().sort((a, c) => a - c);
      const live = b.units.filter((u) => u.alive).length;
      // CPU cost of render() alone, independent of vsync.
      const r0 = performance.now();
      for (let i = 0; i < 60; i++) { r.render(1 / 60, 1); r.ctx.getImageData(0, 0, 1, 1); } // readback forces the GPU to finish
      const cpu = (performance.now() - r0) / 60;
      return { avg, p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1], frames: times.length, live, ragdolls: fx.ragdolls.length, particles: fx.parts.length, renderCpu: cpu };
    });
    await snap('perf');
    console.log(`PERF live=${res.live} ragdolls=${res.ragdolls} particles=${res.particles} frames=${res.frames} avg=${res.avg.toFixed(2)}ms p95=${res.p95.toFixed(2)}ms max=${res.max.toFixed(1)}ms renderCpu=${res.renderCpu.toFixed(2)}ms`);
  }
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
}
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('render ok');
