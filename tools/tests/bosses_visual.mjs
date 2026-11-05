// Visual check for package B: stages each boss level in the real game, forces the boss in early,
// centres the camera and screenshots telegraphs and attacks into tools/out/boss-*.png.
//   node tools/tests/bosses_visual.mjs [--mobile] [redline|smudge|wyrm|professor|hand|factions|all]
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
const which = args.find((a) => !a.startsWith('--')) || 'all';

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

await page.goto(url);
await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
// Unlock everything so the staged army has real units.
await page.evaluate(async () => {
  const { UNITS, PLAYER_ROSTER } = await import('./src/data/units.js');
  const { SPELL_ORDER } = await import('./src/data/spells.js');
  const { Save } = await import('./src/game/save.js');
  const d = Save.data;
  d.unlockedUnits = PLAYER_ROSTER.slice();
  d.unlockedSpells = SPELL_ORDER.slice();
  for (const id of PLAYER_ROSTER) d.units[id] = 6;
  d.loadout.units = PLAYER_ROSTER.filter((x) => x !== 'scribe').slice(0, 8);
  window.__UNITS = UNITS;
});

let shot = 0;
const snap = async (name) => {
  await page.waitForTimeout(90);
  const f = path.join(out, `boss-${name}${mobile ? '-mobile' : ''}.png`);
  await page.screenshot({ path: f });
  shot++;
  console.log('screenshot', path.relative(root, f));
};

// Stage a boss level: pause the loop, drop the boss in, build a player army in front of it.
async function stage(levelId, opts = {}) {
  await page.evaluate(({ levelId, opts }) => {
    const A = window.App;
    const s = A.startBattle({ kind: 'campaign', levelId });
    const b = s.battle;
    A.loop.paused = true;
    const ai = b.teams[1].ai;
    ai.spawnBoss();
    const boss = b.boss;
    boss.x = opts.bossX ?? 1750;
    boss.setState('idle');
    b.teams[1].ai = null; // no enemy army: focus on the boss
    b.teams[0].ai = null;
    const army = opts.army || ['shieldbearer', 'brawler', 'spearman', 'brawler', 'archer', 'slinger', 'brawler', 'medic', 'shieldbearer', 'archer'];
    army.forEach((id, i) => b.spawnUnit(0, id, { x: (opts.armyX ?? 1180) + i * 38 - (i % 3) * 10, instant: true, z: ((i * 7) % 5) / 2 - 1 }));
    b.setStance(0, 'hold', opts.armyX ?? 1180);
    s.heroCamT = -1e9;
    s.cam.centerOn(opts.camX ?? 1380);
    window.__ev = {};
    s.listen((e) => { const k = e.type + (e.kind ? ':' + e.kind : ''); window.__ev[k] = (window.__ev[k] || 0) + 1; });
    window.__adv = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) A.update(1 / 60); };
    window.__until = (key, max = 40) => {
      const n0 = window.__ev[key] || 0;
      for (let i = 0; i < max * 60; i++) { A.update(1 / 60); if ((window.__ev[key] || 0) > n0) return true; }
      return false;
    };
    // keep the player's side alive so attacks always have targets
    window.__heal = () => { for (const u of b.units) if (u.alive && u.team === 0) u.hp = u.maxHp; };
    window.__follow = (dx = -250) => { s.cam.centerOn(b.boss.x + dx); };
  }, { levelId, opts });
  await page.waitForTimeout(150);
}

const adv = (sec) => page.evaluate((s) => window.__adv(s), sec);
const until = (key, max) => page.evaluate(([k, m]) => window.__until(k, m), [key, max]);
const follow = (dx) => page.evaluate((d) => window.__follow(d), dx);
const call = (js) => page.evaluate(js);

async function redline() {
  await stage('1-6', { bossX: 2000, camX: 1450 });
  await snap('redline-1-arrive');
  await until('telegraph:dash', 30); await adv(0.55); await snap('redline-2-dash-telegraph');
  await until('bossDash', 5); await adv(0.12); await snap('redline-3-dash');
  await adv(0.9); await call('window.__heal()'); await until('bossRoar:warcry', 30); await adv(0.25); await snap('redline-4-warcry');
  await call('App.session.battle.boss.hp = App.session.battle.boss.maxHp * 0.49; window.__heal()'); await adv(0.3); await snap('redline-5-escalate');
}

async function smudge() {
  await stage('2-6', { bossX: 1750, camX: 1380 });
  await snap('smudge-1-arrive');
  await until('telegraph:slam', 30); await adv(0.6); await snap('smudge-2-slam-telegraph');
  await until('bossSlam:slam', 5); await adv(0.35); await snap('smudge-3-wave');
  await adv(0.8); await snap('smudge-4-smears');
  await until('bossBelch', 40); await adv(0.15); await snap('smudge-5-belch');
  await call('App.session.battle.boss.hp = App.session.battle.boss.maxHp * 0.49; window.__heal()'); await adv(2.5); await snap('smudge-6-escalated');
}

async function wyrm() {
  await stage('3-6', { bossX: 1750, camX: 1380 });
  await adv(1.6); await snap('wyrm-1-fly');
  await until('telegraph:breath', 30); await adv(0.8); await snap('wyrm-2-breath-telegraph');
  await until('bossBreath', 5); await adv(0.7); await snap('wyrm-3-breath');
  await call('window.__heal()'); await adv(1.5); await snap('wyrm-4-burning');
  await until('telegraph:land', 40); await adv(0.7); await snap('wyrm-5-land-telegraph');
  await until('bossSlam:land', 5); await adv(0.35); await snap('wyrm-6-stomp');
  await adv(1.8); await snap('wyrm-7-ground');
  await call('App.session.battle.boss.data.mouthT = 1'); await adv(0.6); await snap('wyrm-8-mouth');
}

async function professor() {
  await stage('4-6', { bossX: 1650, camX: 1300 });
  await snap('professor-1-arrive');
  await until('telegraph:quiz', 30); await adv(0.7); await snap('professor-2-quiz-marks');
  await until('quizStun', 5); await adv(0.25); await snap('professor-3-quiz-stun');
  await call('window.__heal()'); await until('telegraph:rain', 40); await adv(0.6); await snap('professor-4-rain-telegraph');
  await until('bossRoar:rain', 5); await adv(1.3); await snap('professor-5-rain');
  await call('App.session.battle.boss.hp = App.session.battle.boss.maxHp * 0.49; window.__heal()'); await adv(1.4); await snap('professor-6-walls');
}

async function hand() {
  await stage('5-6', { bossX: 1500, camX: 1300 });
  await adv(2); await snap('hand-1-hover');
  await until('telegraph:erase', 40); await adv(1.1); await snap('hand-2-erase-telegraph');
  await until('bossSlam:erase', 5); await adv(0.9); await snap('hand-3-erase-sweep');
  await adv(1.4); await call('window.__heal()'); await snap('hand-4-after-sweep');
  await until('telegraph:stab', 40); await adv(0.8); await snap('hand-5-stab-telegraph');
  await until('handStab', 5); await adv(0.25); await snap('hand-6-stab');
  await adv(1.2); await snap('hand-7-stuck');
  await call('window.__heal()'); await until('handRedraw', 60); await adv(0.7); await snap('hand-8-redraw');
}

// Every enemy unit type per faction, side by side with a few blue figures.
async function factions() {
  const sets = [
    ['1-2', 'red', ['brawler', 'slinger']],
    ['2-2', 'graphite', ['smudgeling', 'sharpener', 'lead_thrower', 'graphite_golem']],
    ['3-2', 'neon', ['glowrunner', 'neon_archer', 'marker_knight', 'glow_shaman']],
    ['4-2', 'chalk', ['dustborn', 'chalk_thrower', 'board_brute', 'dust_mage']],
    ['5-2', 'eraser', ['crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest']],
  ];
  for (const [lv, name, ids] of sets) {
    await page.evaluate(({ lv, ids }) => {
      const A = window.App;
      const s = A.startBattle({ kind: 'campaign', levelId: lv });
      const b = s.battle;
      A.loop.paused = true;
      b.teams[1].ai = null; b.teams[0].ai = null;
      ids.forEach((id, i) => b.spawnUnit(1, id, { x: 1500 + i * 95, instant: true, z: ((i % 3) - 1) * 0.6 }));
      ['brawler', 'archer'].forEach((id, i) => b.spawnUnit(0, id, { x: 1100 + i * 80, instant: true, z: 0 }));
      s.heroCamT = -1e9;
      s.cam.centerOn(1450);
      window.__adv = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) A.update(1 / 60); };
    }, { lv, ids });
    await page.waitForTimeout(150);
    await adv(0.2);
    await snap('faction-' + name);
    await adv(1.6);
    await snap('faction-' + name + '-fight');
  }
}

// Dustborn chalk pile and reform, Golem shatter, Eraser Knight cleanse.
async function traits() {
  await page.evaluate(() => {
    const A = window.App;
    const s = A.startBattle({ kind: 'campaign', levelId: '4-2' });
    const b = s.battle;
    A.loop.paused = true;
    b.teams[1].ai = null; b.teams[0].ai = null;
    window.__d = [0, 1, 2].map((i) => b.spawnUnit(1, 'dustborn', { x: 1500 + i * 70, instant: true, z: (i - 1) * 0.6 }));
    b.spawnUnit(0, 'brawler', { x: 1000, instant: true });
    s.heroCamT = -1e9;
    s.cam.centerOn(1450);
    window.__adv = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) A.update(1 / 60); };
    window.__b = b;
    window.__d.forEach((u, i) => { if (i < 2) b.damage(u, 9999, { source: b.units.find((x) => x.team === 0), team: 0, kind: 'melee' }); });
  });
  await page.waitForTimeout(150);
  await adv(0.3); await snap('trait-dustborn-pile');
  await adv(1.9); await snap('trait-dustborn-rising');
  await adv(0.5); await snap('trait-dustborn-reformed');
  await page.evaluate(() => {
    const A = window.App;
    const s = A.startBattle({ kind: 'campaign', levelId: '2-2' });
    const b = s.battle;
    A.loop.paused = true;
    b.teams[1].ai = null; b.teams[0].ai = null;
    const g = b.spawnUnit(1, 'graphite_golem', { x: 1500, instant: true });
    b.spawnUnit(0, 'brawler', { x: 1100, instant: true });
    s.heroCamT = -1e9;
    s.cam.centerOn(1400);
    window.__adv = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) A.update(1 / 60); };
    b.kill(g, { kind: 'melee' });
  });
  await page.waitForTimeout(150);
  await adv(0.25); await snap('trait-golem-shatter');
}

const runs = { redline, smudge, wyrm, professor, hand, factions, traits };
try {
  for (const k of Object.keys(runs)) if (which === 'all' || which === k) await runs[k]();
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
  await snap('failure').catch(() => {});
}
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('boss visuals ok,', shot, 'screenshots');
