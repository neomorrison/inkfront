// HUD package test: real clicks and taps in a real browser.
//   node tools/tests/hud.mjs            all scenarios
//   node tools/tests/hud.mjs --only tut  (substring of a scenario name)
// Screenshots go to tools/out/hud-*.png. Exits non-zero on any failed check or console error.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';

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
const failures = [];
const errors = [];
let checks = 0;
const check = (name, ok, info = '') => {
  checks++;
  if (!ok) { failures.push(name + (info ? ': ' + info : '')); console.log('  FAIL', name, info); } else console.log('  ok  ', name);
};

const SIZES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  hd: { viewport: { width: 1920, height: 1080 } },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function open(sizeName, { fresh = true, safe = false } = {}) {
  const ctx = await browser.newContext(SIZES[sizeName]);
  const page = await ctx.newPage();
  const tag = sizeName;
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.stack || e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  await page.goto(url);
  if (fresh) await page.evaluate(() => localStorage.removeItem('inkfront.save.v1'));
  await page.reload();
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  if (safe) await page.addStyleTag({ content: ':root { --safe-l: 44px; --safe-r: 44px; --safe-b: 21px; }' });
  const touch = !!SIZES[sizeName].hasTouch;
  const api = {
    page, ctx, touch, tag,
    async snap(name) { await page.screenshot({ path: path.join(out, `hud-${name}-${tag}${safe ? '-safe' : ''}.png`) }); },
    async click(sel, opts = {}) {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: 6000 });
      if (touch) await el.tap(opts); else await el.click(opts);
    },
    async close() { await ctx.close(); },
  };
  return api;
}

// Unlock everything and set a rich loadout, then start a campaign level directly (staging only).
async function richBattle(t, levelId, { spells = ['pencil_rain', 'ruler_smash', 'highlighter'], heroLevel = 10, units } = {}) {
  await t.page.evaluate(async ({ levelId, spells, heroLevel, units }) => {
    const { Save } = await import('./src/game/save.js');
    const { App } = await import('./src/app.js');
    const d = Save.data;
    const all = ['scribe', 'brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'bomber', 'medic', 'rider', 'doodler', 'catapult', 'colossus', 'ninja'];
    d.unlockedUnits = all;
    for (const id of all) d.units[id] = 3;
    d.unlockedSpells = ['pencil_rain', 'coffee_spill', 'ruler_smash', 'paper_planes', 'sticky_wall', 'stapler', 'highlighter', 'doodle_drop', 'eraser'];
    d.loadout = { units: units || ['brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'medic', 'rider', 'bomber'], spells };
    d.fort.squad = 3; // War Table maxed: squad points 10, plus 3 per boss below
    for (const id of ['1-6', '2-6', '3-6', '4-6']) if (!d.levels[id]) d.levels[id] = { stars: 1, cleared: true, plays: 1 };
    d.hero.level = heroLevel;
    d.seen.howto = true;
    for (const k of ['basics', 'spells', 'stance', 'hero']) d.seen['tut.' + k] = true;
    Save.save();
    App.startBattle({ kind: 'campaign', levelId });
  }, { levelId, spells, heroLevel, units });
  await t.page.waitForSelector('.hud');
  await t.page.waitForTimeout(500);
}

// All visible HUD blocks must stay inside the viewport and never overlap each other.
async function overlapProbe(t, label) {
  const res = await t.page.evaluate(() => {
    const sels = ['.hud .ucard', '.hud .spell', '.hud .ability', '.hud .hero-face', '.hud-stance .btn', '.hud-sys .btn', '.hud .hero-move',
      '.hud .mapwrap', '.hud-res .chip', '.hud-sub .sub-chip:not(.hidden)', '.hud-boss:not(.hidden)', '.fortbar'];
    const els = [];
    for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      els.push({ name: sel.replace('.hud ', '').replace(/:not\(.*\)/, '') + (el.dataset.unit ? '#' + el.dataset.unit : ''), r: { l: r.left, t: r.top, r: r.right, b: r.bottom }, el });
    }
    const probs = [];
    const W = innerWidth, H = innerHeight;
    for (const a of els) {
      if (a.r.l < -0.5 || a.r.t < -0.5 || a.r.r > W + 0.5 || a.r.b > H + 0.5) probs.push(`${a.name} outside viewport (${a.r.l | 0},${a.r.t | 0},${a.r.r | 0},${a.r.b | 0})`);
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l);
      const hh = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t);
      if (w > 3 && hh > 3) probs.push(`${a.name} overlaps ${b.name} (${w | 0}x${hh | 0})`);
    }
    // nothing may spill out of its own card: children must sit inside the card box
    for (const card of document.querySelectorAll('.hud .ucard, .hud .spell, .hud .ability')) {
      const cr = card.getBoundingClientRect();
      for (const ch of card.querySelectorAll('.cd, .queue, .cost, .num')) {
        const r = ch.getBoundingClientRect();
        if (r.width && (r.left < cr.left - 1 || r.right > cr.right + 1 || r.top < cr.top - 1 || r.bottom > cr.bottom + 1)) probs.push(`${ch.className} spills out of ${card.className}`);
      }
    }
    return probs;
  });
  check(`overlap probe ${label}`, res.length === 0, res.slice(0, 6).join(' | '));
  return res;
}

async function minTargets(t, label) {
  const bad = await t.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.hud .ucard, .hud .spell, .hud .ability, .hud-stance .btn, .hud-sys .btn, .hud .hero-move, .hud .hero-face')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.className.split(' ')[0]} ${r.width | 0}x${r.height | 0}`);
    }
    return out;
  });
  check(`touch targets >= 44px ${label}`, bad.length === 0, bad.join(', '));
}

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

// ------------------------------------------------------------------ tutorial 1-1 through real clicks
async function tutorialBasics(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  await t.snap('title');
  await t.click('.screen-title button.btn');
  await t.click('button.btn:has-text("1-1")');
  await page.waitForTimeout(500);
  const startBtn = page.locator('.screen-loadout button.btn:has-text("Battle"), .screen-loadout button.btn:has-text("Start")');
  if (await startBtn.count()) { await (t.touch ? startBtn.first().tap() : startBtn.first().click()); }
  await page.waitForSelector('.hud');
  await page.waitForTimeout(700);
  // first battle: quick how-to card, tutorial arrow waits behind it
  check('how-to card shows on first battle', await page.locator('.howto-float').count() === 1);
  check('tutorial hides while how-to card is open', await page.evaluate(() => getComputedStyle(document.querySelector('.tut-layer')).visibility === 'hidden'));
  await t.snap('t1-howto');
  await t.click('.howto-float button.btn');
  await page.waitForTimeout(500);
  check('how-to card dismissed', await page.locator('.howto-float').count() === 0);
  const text = () => page.locator('.tut-text').innerText();
  const ringShown = () => page.evaluate(() => {
    const r = document.querySelector('.tut-ring');
    const a = document.querySelector('.tut-arrow');
    const rr = r.getBoundingClientRect();
    return { ring: getComputedStyle(r).display !== 'none', arrow: getComputedStyle(a).display !== 'none', inView: rr.left >= 0 && rr.top >= 0 && rr.right <= innerWidth && rr.bottom <= innerHeight };
  });
  check('step 1 asks for a Scribe', /Scribe/.test(await text()), await text());
  const pt = await ringShown();
  check('step 1 ring + arrow point at the Scribe card', pt.ring && pt.arrow && pt.inView, JSON.stringify(pt));
  // the ring must sit on the actual scribe card
  const onCard = await page.evaluate(() => {
    const r = document.querySelector('.tut-ring').getBoundingClientRect();
    const c = document.querySelector('.ucard[data-unit="scribe"]').getBoundingClientRect();
    return Math.abs((r.left + r.width / 2) - (c.left + c.width / 2)) < 4 && Math.abs((r.top + r.height / 2) - (c.top + c.height / 2)) < 4;
  });
  check('ring is centered on the Scribe card', onCard);
  check('enemy AI is held passive', await page.evaluate(() => window.App.session.battle.teams[1].ai.passive === true));
  await t.snap('t1-step1');
  await t.click('.ucard[data-unit="scribe"]');
  await page.waitForTimeout(500);
  check('step 2 asks for Brawlers', /Brawlers/.test(await text()), await text());
  await t.snap('t1-step2');
  for (let i = 0; i < 3; i++) { await t.click('.ucard[data-unit="brawler"]'); await page.waitForTimeout(250); }
  await page.waitForTimeout(500);
  check('step 3 asks for CHARGE', /CHARGE/.test(await text()), await text());
  const pt3 = await ringShown();
  check('step 3 ring points at the Charge button', pt3.ring && pt3.inView);
  check('AI released after 3 Brawlers', await page.evaluate(() => window.App.session.battle.teams[1].ai.passive === false));
  await t.snap('t1-step3');
  await t.click('.hud-stance .btn.red');
  await page.waitForTimeout(500);
  check('step 4 points at the enemy fort', /enemy fort/i.test(await text()), await text());
  check('tutorial marked seen once the goal is known', await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.seen['tut.basics'] === true));
  await t.snap('t1-step4');
  // keep drawing while the army marches; speed up with the real button
  await t.click('.hud-sys .btn:first-child');
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => !!window.App.session.battle.result);
    if (done) break;
    for (const id of ['brawler', 'scribe']) await page.locator(`.ucard[data-unit="${id}"]`).first().dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const result = await page.evaluate(() => (window.App.session.battle.result ? window.App.session.battle.result.winner : -1));
  check('battle ends (tutorial run)', result >= 0, 'result ' + result);
  if (result === 0) {
    await page.waitForSelector('.screen-results', { timeout: 8000 }).catch(() => {});
    check('victory reaches results', await page.locator('.screen-results').count() === 1);
  }
  await t.close();
}
scenario('tutorial 1-1 desktop', () => tutorialBasics('desktop'));
scenario('tutorial 1-1 phone', () => tutorialBasics('phone'));

// ------------------------------------------------------------------ the other three tutorials show and advance
async function otherTutorials(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  const seenAll = async (skip) => {
    await page.evaluate(async (skip) => {
      const { Save } = await import('./src/game/save.js');
      Save.data.seen.howto = true;
      for (const k of ['basics', 'spells', 'stance', 'hero']) delete Save.data.seen['tut.' + k];
      for (const k of skip) Save.data.seen['tut.' + k] = true;
      Save.data.unlockedUnits = ['scribe', 'brawler', 'slinger'];
      Save.data.loadout = { units: ['brawler', 'slinger'], spells: [] };
      Save.save();
    }, skip);
  };
  const start = (id) => page.evaluate(async (id) => { const { App } = await import('./src/app.js'); App.startBattle({ kind: 'campaign', levelId: id }); }, id);
  const text = () => page.locator('.tut-text').innerText();
  // 1-2: spells (fresh save has none, the tutorial lends Pencil Rain)
  await seenAll(['basics', 'stance', 'hero']);
  await start('1-2');
  await page.waitForTimeout(600);
  check('1-2 gives a spell button', await page.locator('.hud .spell').count() === 1);
  check('1-2 starts on the charging step', /charging/i.test(await text()), await text());
  await page.evaluate(() => { window.App.session.battle.teams[0].spells[0].cd = 0; });
  await page.waitForTimeout(500);
  check('1-2 points at the spell when it is ready', /ready/i.test(await text()), await text());
  await t.snap('t2-spell-ready');
  await t.click('.hud .spell');
  await page.waitForTimeout(400);
  check('1-2 asks to aim', /(enemy|battlefield)/i.test(await text()), await text());
  check('reticle follows the pointer', await page.locator('.hud-reticle.on').count() === 1);
  await t.snap('t2-aim');
  await page.mouse.move(700, 300).catch(() => {});
  const box = await page.evaluate(() => window.App.renderer.canvas.getBoundingClientRect().toJSON());
  if (t.touch) await page.touchscreen.tap(520, 250); else await page.mouse.click(520, 250);
  await page.waitForTimeout(400);
  check('1-2 spell cast ends the lesson', /Nice/.test(await text()), await text());
  check('spell tutorial marked seen', await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.seen['tut.spells'] === true));
  void box;
  // 1-3: stance
  await seenAll(['basics', 'spells', 'hero']);
  await start('1-3');
  await page.waitForTimeout(600);
  check('1-3 starts with the real situation', /(gathering|marching)/i.test(await text()) && !/Press CHARGE/.test(await text()), await text());
  check('1-3 points the player at units', /Brawlers/.test(await text()), await text());
  await t.snap('t3-stance');
  // 1-4: hero
  await seenAll(['basics', 'spells', 'stance']);
  await start('1-4');
  await page.waitForTimeout(600);
  check('1-4 teaches walking', /Captain/.test(await text()), await text());
  const heroPt = await page.evaluate(() => {
    const r = document.querySelector('.tut-ring');
    return getComputedStyle(r).display !== 'none';
  });
  check('1-4 points at something visible', heroPt);
  await t.snap('t4-hero');
  if (t.touch) {
    // hold the real arrow
    const el = page.locator('.hud-move .hero-move:nth-child(2)');
    const b = await el.boundingBox();
    await page.evaluate(({ x, y }) => {
      const e = document.querySelector('.hud-move .hero-move:nth-child(2)');
      e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y }));
    }, { x: b.x + 10, y: b.y + 10 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('.hud-move .hero-move:nth-child(2)').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' })));
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyD');
  }
  await page.waitForTimeout(300);
  check('1-4 advances after the Captain walks', /front line|Nice/.test(await text()), await text());
  // already seen: no tutorial
  await seenAll(['basics', 'spells', 'stance', 'hero']);
  await start('1-4');
  await page.waitForTimeout(500);
  check('completed tutorials do not return', await page.locator('.tut-layer').count() === 0);
  await t.close();
}
scenario('tutorials 1-2..1-4 desktop', () => otherTutorials('desktop'));
scenario('tutorials 1-2..1-4 phone', () => otherTutorials('phone'));

// ------------------------------------------------------------------ overlap probes at 3 sizes (+ safe area)
async function probes(sizeName, safe = false) {
  const t = await open(sizeName, { safe });
  const { page } = t;
  await richBattle(t, '1-6');
  // stage a boss, an endless chip and a damaged fort so every HUD part is on screen
  await page.evaluate(() => {
    const b = window.App.session.battle;
    const boss = b.spawnUnit(1, 'boss_redline', { x: b.width - 500, spawnTime: 0.1 });
    b.boss = boss;
    b.endless = { wave: 12, state: 'fight', enemiesLeft: 8, offer: null, choose() {} };
    b.teams[0].queues.brawler = { count: 6, t: 1, paid: [40, 40, 40, 40, 40, 40] };
    b.teams[0].pop = 12;
    b.teams[0].fort.hp = b.teams[0].fort.maxHp * 0.25;
  });
  await page.waitForTimeout(1500);
  await t.snap('full-hud');
  await overlapProbe(t, `${sizeName}${safe ? ' safe-area' : ''} (1-6 boss, endless, low hp)`);
  check(`boss bar visible ${sizeName}`, await page.locator('.hud-boss:not(.hidden)').count() === 1);
  check(`boss bar names the boss ${sizeName}`, /redline/i.test(await page.locator('.hud-boss .name').innerText()));
  check(`wave chip visible ${sizeName}`, /Wave 12/.test(await page.locator('.sub-chip.wave').innerText()));
  check(`low fort warning ${sizeName}`, await page.locator('.hud-vignette.on').count() === 1);
  check(`queue badge shows ${sizeName}`, +(await page.locator('.ucard[data-unit="brawler"] .queue').innerText()) >= 2 && await page.locator('.ucard[data-unit="brawler"].building').count() === 1);
  if (t.touch) {
    check('touch arrows visible', await page.locator('.hud-move .hero-move').first().isVisible());
    await minTargets(t, `${sizeName}${safe ? ' safe-area' : ''}`);
  }
  // full tooltips: hover a card (mouse only)
  if (!t.touch) {
    await page.locator('.ucard[data-unit="archer"]').hover();
    await page.waitForTimeout(250);
    check('card hover tooltip', await page.locator('.hud-tip.show').count() === 1 && /Archer/.test(await page.locator('.hud-tip').innerText()));
    const tipBox = await page.locator('.hud-tip').boundingBox();
    check('tooltip stays in view', tipBox.x >= 0 && tipBox.y >= 0 && tipBox.x + tipBox.width <= SIZES[sizeName].viewport.width);
    await t.snap('tooltip');
    await page.mouse.move(600, 200);
  }
  // survive level countdown
  await richBattle(t, '4-3', { heroLevel: 4 });
  await page.waitForTimeout(500);
  check(`survive countdown visible ${sizeName}`, /Survive/.test(await page.locator('.sub-chip.survive').innerText()));
  await overlapProbe(t, `${sizeName}${safe ? ' safe-area' : ''} (4-3 survive)`);
  // no spells, no hero abilities (fresh-ish): still fine
  await richBattle(t, '1-1', { spells: [], heroLevel: 1, units: ['brawler'] });
  await overlapProbe(t, `${sizeName}${safe ? ' safe-area' : ''} (1-1 minimal)`);
  await t.snap('minimal-hud');
  await t.close();
}
scenario('overlap probe 1280x720', () => probes('desktop'));
scenario('overlap probe 1920x1080', () => probes('hd'));
scenario('overlap probe 844x390 touch', () => probes('phone'));
scenario('overlap probe 844x390 safe area', () => probes('phone', true));

// ------------------------------------------------------------------ spell targeting by real click / tap
async function targeting(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  await richBattle(t, '1-2', { spells: ['pencil_rain', 'ruler_smash', 'highlighter'] });
  const st = () => page.evaluate(() => {
    const s = window.App.session;
    return { cd: s.battle.teams[0].spells.map((x) => +x.cd.toFixed(1)), cast: s.battle.teams[0].stats.spellsCast, tg: s.targeting ? s.targeting.kind : null, zoom: s.cam.zoom };
  });
  await page.evaluate(() => window.App.session.battle.teams[0].spells.forEach((s) => { s.cd = 0; }));
  await page.waitForTimeout(200);
  // area spell
  await t.click('.hud .spell[data-spell="0"]');
  await page.waitForTimeout(150);
  const view = SIZES[sizeName].viewport;
  const px = Math.round(view.width * 0.55), py = Math.round(view.height * 0.5);
  if (!t.touch) await page.mouse.move(px, py);
  else await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'touch', bubbles: true })), { x: px, y: py });
  await page.waitForTimeout(120);
  const ret = await page.evaluate(() => { const r = document.querySelector('.hud-reticle'); const b = r.getBoundingClientRect(); return { on: r.classList.contains('on'), cls: r.className, w: b.width, cx: b.left + b.width / 2 }; });
  const z = (await st()).zoom;
  check(`area reticle shows and is radius*2*zoom wide (${sizeName})`, ret.on && Math.abs(ret.w - 140 * 2 * z) < 3 && Math.abs(ret.cx - px) < 3, JSON.stringify(ret));
  await t.snap('reticle-area');
  if (t.touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
  await page.waitForTimeout(300);
  const a = await st();
  check(`click on the field casts the spell (${sizeName})`, a.cast === 1 && a.cd[0] > 5 && a.tg === null, JSON.stringify(a));
  // line spell reticle width
  await t.click('.hud .spell[data-spell="1"]');
  await page.waitForTimeout(150);
  const line = await page.evaluate(() => document.querySelector('.hud-reticle').getBoundingClientRect().width);
  check(`line reticle is width*zoom (${sizeName})`, Math.abs(line - 320 * z) < 3, String(line));
  await t.snap('reticle-line');
  // cancel by tapping the same spell
  await t.click('.hud .spell[data-spell="1"]');
  await page.waitForTimeout(150);
  check(`tapping the spell again cancels (${sizeName})`, (await st()).tg === null && await page.locator('.hud-reticle.on').count() === 0);
  // ally spell is green
  await t.click('.hud .spell[data-spell="2"]');
  await page.waitForTimeout(150);
  check(`ally spell reticle is green (${sizeName})`, await page.locator('.hud-reticle.ally.on').count() === 1);
  await t.snap('reticle-ally');
  if (!t.touch) await page.keyboard.press('Escape'); else await t.click('.hud .spell[data-spell="2"]');
  await page.waitForTimeout(150);
  check(`escape or tapping the spell leaves aiming (${sizeName})`, (await st()).tg === null);
  await t.close();
}
scenario('spell targeting desktop', () => targeting('desktop'));
scenario('spell targeting phone', () => targeting('phone'));

// ------------------------------------------------------------------ flag: HOLD button flow and long-press
async function holdFlow() {
  const t = await open('phone');
  const { page } = t;
  await richBattle(t, '1-2');
  await t.click('.hud-stance .btn.green');
  await page.waitForTimeout(200);
  check('HOLD button asks for a tap on the field', await page.locator('.target-hint:not(.hidden)').count() === 1 && await page.locator('.hud-reticle.flag.on').count() === 1);
  await t.snap('hold-aim');
  await page.touchscreen.tap(520, 200);
  await page.waitForTimeout(300);
  const stance = await page.evaluate(() => ({ s: window.App.session.battle.teams[0].stance, x: window.App.session.battle.teams[0].flagX }));
  check('second tap plants the flag', stance.s === 'hold', JSON.stringify(stance));
  // long-press with a real touch hold (CDP touch events)
  const cdp = await t.ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 180 }] });
  await page.waitForTimeout(250);
  check('long-press shows a ring', await page.locator('.hud-press').count() === 1);
  await t.snap('long-press');
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => { window.App.session.battle.setStance(0, 'defend'); });
  await t.close();
}
scenario('hold flow and long-press (phone)', holdFlow);

// ------------------------------------------------------------------ pause / resume / toggles
async function pauseTest(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  await richBattle(t, '1-2');
  const loopPaused = () => page.evaluate(() => window.App.loop.paused);
  await t.click('.hud-sys .btn:last-child');
  await page.waitForTimeout(300);
  check(`pause opens the modal and freezes the loop (${sizeName})`, await page.locator('.modal-pause').count() === 1 && await loopPaused());
  await t.snap('pause');
  // toggles
  const music0 = await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.settings.music);
  await t.click('.pause-toggles .btn:has-text("Music")');
  const music1 = await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.settings.music);
  check(`music toggle works (${sizeName})`, music0 > 0 && music1 === 0, `${music0} -> ${music1}`);
  await t.click('.pause-toggles .btn:has-text("Music")');
  const music2 = await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.settings.music);
  check(`music toggle restores the volume (${sizeName})`, Math.abs(music2 - music0) < 0.001);
  await t.click('.pause-toggles .btn:has-text("Shake")');
  check(`shake toggle works (${sizeName})`, await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.settings.shake === false));
  await t.click('.pause-toggles .btn:has-text("Shake")');
  // controls card both tabs
  await t.click('.pause-card .tabs .btn:has-text("Touch")');
  check(`controls card touch tab (${sizeName})`, /Long-press/.test(await page.locator('.pause-controls').innerText()));
  await t.click('.pause-card .tabs .btn:has-text("Keyboard")');
  check(`controls card keyboard tab (${sizeName})`, /Walk the Captain/.test(await page.locator('.pause-controls').innerText()));
  // how to play from pause
  await t.click('.pause-card button:has-text("How to Play")');
  check(`how to play opens from pause (${sizeName})`, await page.locator('.modal-howto').count() === 1);
  await t.snap('pause-howto');
  await t.click('.modal-howto button.btn');
  check(`how to play closes, pause stays (${sizeName})`, await page.locator('.modal-howto').count() === 0 && await page.locator('.modal-pause').count() === 1);
  await t.click('.modal-pause button:has-text("Resume")');
  await page.waitForTimeout(200);
  check(`resume closes the modal and runs the loop (${sizeName})`, await page.locator('.modal-pause').count() === 0 && !(await loopPaused()));
  if (!t.touch) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('Esc pauses', await loopPaused());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check('Esc resumes and does not re-pause', !(await loopPaused()));
    await page.waitForTimeout(400);
    check('still running after Esc resume', !(await loopPaused()));
  }
  // give up needs two taps
  await t.click('.hud-sys .btn:last-child');
  await t.click('.pause-card button:has-text("Give Up")');
  check(`give up asks to confirm (${sizeName})`, await page.evaluate(() => !window.App.session.ended) && /Really/.test(await page.locator('.pause-card .btn.red').innerText()));
  await t.click('.pause-card .btn.red');
  await page.waitForTimeout(400);
  check(`give up ends the battle (${sizeName})`, await page.evaluate(() => !!window.App.session.battle.result));
  await t.close();
}
scenario('pause desktop', () => pauseTest('desktop'));
scenario('pause phone', () => pauseTest('phone'));

// ------------------------------------------------------------------ endless draft modal
async function draftTest(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(() => {
    const b = window.App.session.battle;
    window.__chosen = [];
    b.endless = { wave: 4, state: 'draft', enemiesLeft: 0, offer: ['sharp_swords', 'vampire_ink', 'storm_caller'], choose(id) { window.__chosen.push(id); this.state = 'fight'; } };
    b.emit('draftOffer', { offer: b.endless.offer });
  });
  await page.waitForTimeout(700);
  check(`draft modal opens (${sizeName})`, await page.locator('.modal-draft .perk-card').count() === 3);
  check(`loop is frozen while drafting (${sizeName})`, await page.evaluate(() => window.App.loop.paused));
  check(`rarity classes (${sizeName})`, await page.evaluate(() => [...document.querySelectorAll('.perk-card')].map((c) => c.classList.contains('common') || c.classList.contains('rare') || c.classList.contains('epic')).every(Boolean))
    && await page.locator('.perk-card.rare').count() === 1 && await page.locator('.perk-card.epic').count() === 1);
  check(`each card has a drawn icon (${sizeName})`, await page.evaluate(() => [...document.querySelectorAll('.perk-card canvas')].every((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n > 800;
  })));
  await t.snap('draft');
  // the cards fit on screen
  const fits = await page.evaluate(() => [...document.querySelectorAll('.perk-card')].every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
  check(`draft cards fit in the viewport (${sizeName})`, fits);
  if (!t.touch) await page.keyboard.press('Digit2'); else await t.click('.perk-card:nth-child(2)');
  await page.waitForTimeout(600);
  const chosen = await page.evaluate(() => window.__chosen.slice());
  check(`pick calls endless.choose with that perk (${sizeName})`, chosen.length === 1 && chosen[0] === 'vampire_ink', JSON.stringify(chosen));
  check(`modal closes and the loop resumes (${sizeName})`, await page.locator('.modal-draft').count() === 0 && !(await page.evaluate(() => window.App.loop.paused)));
  // second offer: click the third card
  await page.evaluate(() => { const b = window.App.session.battle; b.emit('draftOffer', { offer: ['ink_flow', 'tower_volley', 'martyrs'] }); });
  await page.waitForTimeout(700);
  await t.click('.perk-card:nth-child(3)');
  await page.waitForTimeout(600);
  const chosen2 = await page.evaluate(() => window.__chosen.slice());
  check(`clicking the third card picks it (${sizeName})`, chosen2[1] === 'martyrs', JSON.stringify(chosen2));
  // keys 1/2/3 must not draw units while the modal is up
  await t.close();
}
scenario('draft modal desktop', () => draftTest('desktop'));
scenario('draft modal phone', () => draftTest('phone'));

// ------------------------------------------------------------------ camera
async function cameraTest() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  const camx = () => page.evaluate(() => window.App.session.cam.x);
  // spawn a push far from the start so "the action" is clearly to the right
  await page.evaluate(() => {
    const b = window.App.session.battle;
    for (let i = 0; i < 4; i++) b.spawnUnit(0, 'brawler', { x: 1500 + i * 30, instant: true });
    for (let i = 0; i < 4; i++) b.spawnUnit(1, 'brawler', { x: 1700 + i * 30, instant: true });
    window.App.session.camIdle = 0;
  });
  const x0 = await camx();
  await page.waitForTimeout(2500);
  const x1 = await camx();
  check('camera waits while recently touched (no auto move < 4 s)', Math.abs(x1 - x0) < 60, `${x0} -> ${x1}`);
  await page.waitForTimeout(3500);
  const x2 = await camx();
  check('camera eases toward the action after idle', x2 > x1 + 300, `${x1} -> ${x2}`);
  await t.snap('cam-action');
  // manual control: wheel resets the idle timer
  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(400);
  const x3 = await camx();
  await page.waitForTimeout(2500);
  const x4 = await camx();
  check('wheel takes manual control again', x3 < x2 && Math.abs(x4 - x3) < 40, `${x2} -> ${x3} -> ${x4}`);
  // Free mode never moves by itself
  await t.click('.hud-sys .btn.cam');
  await page.waitForTimeout(200);
  check('camera button reads Free', /Free/.test(await page.locator('.hud-sys .btn.cam').innerText()));
  const f0 = await camx();
  await page.waitForTimeout(5500);
  const f1 = await camx();
  check('Free camera stays put', Math.abs(f1 - f0) < 20, `${f0} -> ${f1}`);
  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, -1500);
  await page.waitForTimeout(300);
  const f2 = await camx();
  await page.evaluate(() => {
    const b = window.App.session.battle;
    for (let i = 0; i < 4; i++) b.spawnUnit(0, 'brawler', { x: 1700 + i * 30, instant: true });
    for (let i = 0; i < 4; i++) b.spawnUnit(1, 'brawler', { x: 1900 + i * 30, instant: true });
  });
  await t.click('.hud-sys .btn.cam');
  await page.waitForTimeout(5000);
  check('Follow again moves toward the action', (await camx()) > f2 + 300, `${f2} -> ${await camx()}`);
  // steering follows the Captain
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  const heroInView = await page.evaluate(() => { const s = window.App.session; const h = s.battle.teams[0].hero; const sx = s.cam.sx(h.x); return sx > 0 && sx < s.cam.w; });
  check('camera keeps the Captain in view while steering', heroInView);
  // dead Captain: A/D scroll the camera
  await page.evaluate(() => { const b = window.App.session.battle; const h = b.teams[0].hero; b.kill(h, {}); });
  await page.waitForTimeout(400);
  const d0 = await camx();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  check('A/D pan the camera when the Captain is dead', (await camx()) > d0 + 200, `${d0} -> ${await camx()}`);
  await t.close();
}
scenario('camera follow modes', cameraTest);

// ------------------------------------------------------------------ feedback: ink pulse, army full, not enough ink
async function feedbackTest() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(() => { const b = window.App.session.battle; b.teams[0].ink = 5; });
  await t.click('.ucard[data-unit="archer"]');
  await page.waitForTimeout(150);
  check('not enough ink shows a notice', /Not enough ink/.test(await page.locator('.hud-notice').innerText()) && await page.locator('.hud-notice.show').count() === 1);
  check('ink chip flashes', await page.locator('.chip.ink.flash').count() === 1);
  await t.snap('no-ink');
  await page.evaluate(() => { const b = window.App.session.battle; b.teams[0].ink = 900; b.teams[0].popCap = 0; });
  await t.click('.ucard[data-unit="brawler"]');
  await page.waitForTimeout(150);
  check('army full shows a notice', /Army is full/.test(await page.locator('.hud-notice').innerText()) && await page.locator('.chip.pop.flash').count() === 1);
  await t.snap('army-full');
  await page.evaluate(() => { const b = window.App.session.battle; b.emit('deposit', { team: 0, amount: 20, x: 300, z: 0 }); });
  await page.waitForTimeout(100);
  check('ink pulse when Scribes deliver', await page.locator('.chip.ink.pulse').count() === 1 && await page.locator('.hud-float').count() >= 1);
  await t.close();
}
scenario('feedback', feedbackTest);

// ------------------------------------------------------------------ QA round fixes
async function seenOnly(page, skip) {
  await page.evaluate(async (skip) => {
    const { Save } = await import('./src/game/save.js');
    Save.data.seen.howto = true;
    for (const k of ['basics', 'spells', 'stance', 'hero']) delete Save.data.seen['tut.' + k];
    for (const k of skip) Save.data.seen['tut.' + k] = true;
    Save.data.unlockedUnits = ['scribe', 'brawler', 'slinger'];
    Save.data.loadout = { units: ['brawler', 'slinger'], spells: [] };
    Save.save();
  }, skip);
}
const startLevel = (page, id) => page.evaluate(async (id) => { const { App } = await import('./src/app.js'); App.startBattle({ kind: 'campaign', levelId: id }); }, id);

async function heroTutorialInput(sizeName) {
  const t = await open(sizeName);
  const { page } = t;
  const text = () => page.locator('.tut-text').innerText();
  await seenOnly(page, ['basics', 'spells', 'stance']);
  await startLevel(page, '1-4');
  await page.waitForTimeout(3600);
  check(`1-4 walking step does not complete by itself (${sizeName})`, /Walk|Hold the arrows/.test(await text()), await text());
  // really steer
  if (t.touch) {
    const b = await page.locator('.hud-move .hero-move:nth-child(2)').boundingBox();
    await page.evaluate(({ x, y }) => document.querySelector('.hud-move .hero-move:nth-child(2)').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y })), { x: b.x + 10, y: b.y + 10 });
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('.hud-move .hero-move:nth-child(2)').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch' })));
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyD');
  }
  await page.waitForTimeout(300);
  check(`1-4 advances after real steering (${sizeName})`, /front line/.test(await text()), await text());
  // each note stays at least ~2.5 s
  const born = await page.evaluate(() => window.App.session.battle.time);
  await page.waitForTimeout(1200);
  check(`1-4 second note stays readable (${sizeName})`, /front line|Nice/.test(await text()) && (await page.evaluate(() => window.App.session.battle.time)) - born < 2.5 ? /front line/.test(await text()) : true);
  await t.close();
}
scenario('hero tutorial needs steering desktop', () => heroTutorialInput('desktop'));
scenario('hero tutorial needs steering phone', () => heroTutorialInput('phone'));

async function stanceTutorial() {
  const t = await open('desktop');
  const { page } = t;
  const text = () => page.locator('.tut-text').innerText();
  await seenOnly(page, ['basics', 'spells', 'hero']);
  await startLevel(page, '1-3');
  await page.evaluate(() => { const b = window.App.session.battle; b.teams[1].ai.passive = true; for (const u of b.units) if (u.team === 1) u.x = b.teams[1].fort.x - 20; });
  await page.waitForTimeout(500);
  check('1-3 does not claim a march before one starts', !/marching/i.test(await text()) && !/Press CHARGE/.test(await text()), await text());
  // enemies march in while the army is already on DEFEND
  await page.evaluate(() => { const b = window.App.session.battle; for (const u of b.units) if (u.team === 1 && u.type !== 'scribe') u.x = 1500; });
  await page.waitForTimeout(500);
  const t1 = await text();
  check('1-3 says enemies are marching and explains DEFEND (already active)', /marching/i.test(t1) && !/Press DEFEND/.test(t1) && /DEFEND/.test(t1), t1);
  await t.click('.hud-stance .btn.red');
  await page.waitForTimeout(400);
  check('1-3 asks for DEFEND when the army is not on it', /Press DEFEND/.test(await text()), await text());
  await t.click('.hud-stance .btn.blue');
  await page.waitForTimeout(2700);
  // they reach the defense line
  await page.evaluate(() => { const b = window.App.session.battle; let x = b.teams[0].fort.x + 330; for (const u of b.units) if (u.team === 1 && u.type !== 'scribe') { u.x = x; x += 25; } });
  await page.waitForTimeout(600);
  check('1-3 advances when they reach the line', /hit your line/i.test(await text()), await text());
  check('1-3 does not say CHARGE yet', !/Press CHARGE/.test(await text()));
  await page.waitForTimeout(2300);
  await page.evaluate(() => { const b = window.App.session.battle; const foes = b.units.filter((u) => u.team === 1 && u.type !== 'scribe' && u.alive); foes.slice(1).forEach((u) => b.kill(u, {})); });
  await page.waitForTimeout(600);
  check('1-3 says CHARGE once the attack is broken', /CHARGE/.test(await text()) && /broken/i.test(await text()), await text());
  await t.snap('t3-broken');
  await t.close();
}
scenario('stance tutorial reacts', stanceTutorial);

async function endedInputs() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  const before = await page.evaluate(async () => (await import('./src/game/save.js')).Save.data.settings.speed || 1);
  const cds0 = await page.evaluate(() => window.App.session.battle.teams[0].spells.map((x) => x.cd));
  await page.evaluate(() => { const s = window.App.session; for (const sp of s.battle.teams[0].spells) sp.cd = 0; s.battle.end(0, 'test'); });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyT');
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyZ');
  await t.click('.hud-sys .btn:first-child').catch(() => {});
  await page.waitForTimeout(200);
  const st = await page.evaluate(async () => {
    const s = window.App.session;
    return { speed: s.speed, ts: window.App.loop.timeScale, saved: (await import('./src/game/save.js')).Save.data.settings.speed || 1, ab: s.battle.control[0].heroAbility || null, cast: s.battle.teams[0].spells.some((x) => x.cd > 0) };
  });
  check('speed unchanged after the battle ends', st.speed === 1 && st.saved === before && st.ts <= 0.3 + 1e-6, JSON.stringify(st));
  check('abilities and spells ignored after the end', !st.ab && !st.cast, JSON.stringify(st));
  await t.close();
}
scenario('inputs ignored after the end', endedInputs);

async function endedTutorial() {
  const t = await open('desktop');
  const { page } = t;
  await seenOnly(page, ['basics', 'spells', 'stance']);
  await startLevel(page, '1-4');
  await page.waitForTimeout(800);
  check('tutorial note shows', await page.locator('.tut-note').count() === 1);
  await page.evaluate(() => window.App.session.battle.end(1, 'test'));
  await page.waitForTimeout(400);
  check('tutorial note and arrow hide when the battle ends', await page.locator('.tut-layer').count() === 0);
  await t.close();
}
scenario('tutorial hides at the end', endedTutorial);

async function pauseLayout(sizeName, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${sizeName}] pageerror: ${e.stack || e.message}`));
  await page.goto(url);
  await page.evaluate(() => localStorage.removeItem('inkfront.save.v1'));
  await page.reload();
  await page.waitForFunction(() => window.App && window.App.ready);
  await page.evaluate(async () => { const { App } = await import('./src/app.js'); App.startBattle({ kind: 'campaign', levelId: '1-1' }); });
  await page.waitForSelector('.howto-float');
  await page.waitForTimeout(500);
  const q = await page.evaluate(() => {
    const card = document.querySelector('.howto-float .howto-card').getBoundingClientRect();
    const h1 = document.querySelector('.howto-float h1').getBoundingClientRect();
    const cards = document.querySelector('.hud-cards').getBoundingClientRect();
    const tape = 13;
    return { top: card.top, bottom: card.bottom, h1top: h1.top, cardsTop: cards.top, H: innerHeight, tape };
  });
  check(`quick card has bottom margin (${sizeName})`, q.cardsTop - q.bottom >= 8, JSON.stringify(q));
  check(`quick card heading clear of the tape (${sizeName})`, q.h1top - q.top >= 14, JSON.stringify(q));
  const t0 = await page.evaluate(() => window.App.session.battle.time);
  await page.waitForTimeout(700);
  const t1 = await page.evaluate(() => ({ t: window.App.session.battle.time, held: window.App.loop.paused }));
  check(`battle waits while the first how-to card is open (${sizeName})`, t1.held && Math.abs(t1.t - t0) < 0.05, JSON.stringify({ t0, t1 }));
  await page.screenshot({ path: path.join(out, `hud-quick-${sizeName}.png`) });
  await page.locator('.howto-float button.btn').tap();
  await page.waitForTimeout(700);
  const t2 = await page.evaluate(() => ({ t: window.App.session.battle.time, held: window.App.loop.paused }));
  check(`battle resumes when the card is dismissed (${sizeName})`, !t2.held && t2.t > t1.t + 0.2, JSON.stringify(t2));
  await page.evaluate(() => window.App.session.togglePause(true));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const c = document.querySelector('.pause-card').getBoundingClientRect();
    const h1 = document.querySelector('.pause-card h1').getBoundingClientRect();
    const tape = c.top - 13;
    return { top: c.top, bottom: c.bottom, left: c.left, right: c.right, h1top: h1.top, h1bottom: h1.bottom, H: innerHeight, W: innerWidth, tapeTop: tape, sh: document.querySelector('.pause-card').scrollHeight, ch: document.querySelector('.pause-card').clientHeight };
  });
  check(`pause card has a margin and its tape fits (${sizeName})`, r.tapeTop >= 4 && r.bottom <= r.H - 12 && r.left >= 12 && r.right <= r.W - 12 && r.sh <= r.ch + 1, JSON.stringify(r));
  check(`Paused title stays inside the card (${sizeName})`, r.h1top >= r.top + 8 && r.h1bottom <= r.bottom, JSON.stringify(r));
  await page.screenshot({ path: path.join(out, `hud-pause-${sizeName}.png`) });
  await page.locator('.pause-main .btn.yellow').tap();
  await page.waitForTimeout(300);
  const stack = await page.evaluate(() => ({ pauseVisible: getComputedStyle(document.querySelector('.modal-pause')).display !== 'none', howto: document.querySelectorAll('.modal-howto .howto-card').length, label: document.querySelector('.modal-howto .btn').innerText }));
  check(`How to Play replaces the pause card (${sizeName})`, !stack.pauseVisible && stack.howto === 1 && /Back/i.test(stack.label), JSON.stringify(stack));
  await page.screenshot({ path: path.join(out, `hud-pause-howto-${sizeName}.png`) });
  await page.locator('.modal-howto .btn').tap();
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ pauseVisible: getComputedStyle(document.querySelector('.modal-pause')).display !== 'none', howto: document.querySelectorAll('.modal-howto').length, paused: window.App.session.paused }));
  check(`Back returns to the pause card (${sizeName})`, back.pauseVisible && back.howto === 0 && back.paused, JSON.stringify(back));
  await ctx.close();
}
scenario('pause + how-to layout 844x390', () => pauseLayout('844', { width: 844, height: 390 }));
scenario('pause + how-to layout 667x375', () => pauseLayout('667', { width: 667, height: 375 }));

async function quitLabels() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(() => window.App.session.togglePause(true));
  await page.waitForTimeout(200);
  check('campaign pause says Quit to Map', /Quit to Map/i.test(await page.locator('.pause-main').innerText()));
  await page.evaluate(async () => { const { App } = await import('./src/app.js'); App.startBattle({ kind: 'endless' }); });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.App.session.togglePause(true));
  await page.waitForTimeout(200);
  const label = await page.locator('.pause-main').innerText();
  check('endless pause says Quit to Title, not Map', /Quit to Title/i.test(label) && !/Map/i.test(label), label);
  await page.locator('.pause-main .btn:has-text("Quit to Title")').click();
  await page.waitForTimeout(400);
  check('Quit to Title goes to the title', await page.locator('.screen-title').count() === 1);
  await t.close();
}
scenario('quit label matches destination', quitLabels);

async function tooltips() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.hover('.ucard[data-unit="slinger"]');
  await page.waitForTimeout(250);
  const shown = await page.evaluate(() => { const e = document.querySelector('.hud-tip'); const r = e.getBoundingClientRect(); const row = document.querySelector('.hud-cards').getBoundingClientRect(); return { show: e.classList.contains('show'), bottom: r.bottom, rowTop: row.top }; });
  check('card tooltip sits just above the card row', shown.show && shown.bottom <= shown.rowTop, JSON.stringify(shown));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(150);
  check('tooltip closes on click', await page.locator('.hud-tip.show').count() === 0);
  await page.mouse.move(640, 300);
  await page.hover('.ucard[data-unit="archer"]');
  await page.waitForTimeout(250);
  check('tooltip shows again on a fresh hover', await page.locator('.hud-tip.show').count() === 1);
  await page.waitForTimeout(5000);
  check('tooltip times out by itself', await page.locator('.hud-tip.show').count() === 0);
  await page.hover('.hud-spells .spell');
  await page.waitForTimeout(250);
  const sp = await page.evaluate(() => { const e = document.querySelector('.hud-tip').getBoundingClientRect(); const a = [...document.querySelectorAll('.hud-abil .ability')].map((x) => x.getBoundingClientRect()); const hit = a.some((r) => !(e.right < r.left || e.left > r.right || e.bottom < r.top || e.top > r.bottom)); return { hit, tipBottom: e.bottom, abilTop: Math.min(...a.map((r) => r.top)) }; });
  check('spell tooltip does not cover the Captain abilities', !sp.hit, JSON.stringify(sp));
  await t.snap('tip-spell');
  await t.close();
}
scenario('tooltips', tooltips);

async function inkFloatAndMax() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(() => { window.App.session.battle.emit('deposit', { team: 0, amount: 20, x: 300, z: 0 }); });
  await page.waitForTimeout(150);
  const f = await page.evaluate(() => {
    const fl = document.querySelector('.hud-float').getBoundingClientRect();
    const n = document.querySelector('.chip.ink b').getBoundingClientRect();
    const badge = document.querySelector('.hud-hero .lv').getBoundingClientRect();
    const ov = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    return { onNumber: ov(fl, n), onBadge: ov(fl, badge) };
  });
  check('ink pop does not cover the ink number or the Captain badge', !f.onNumber && !f.onBadge, JSON.stringify(f));
  await page.evaluate(() => { const t0 = window.App.session.battle.teams[0]; t0.ink = t0.inkCap; });
  await page.waitForTimeout(300);
  check('MAX tag shows at the ink cap', await page.locator('.chip.ink.maxed .max-tag').isVisible());
  check('ink full hint shows', /Ink full/.test(await page.locator('.hud-notice').innerText()) && await page.locator('.hud-notice.show').count() === 1);
  await page.evaluate(() => { const t0 = window.App.session.battle.teams[0]; t0.ink = 100; });
  await page.waitForTimeout(200);
  check('MAX tag hides below the cap', !(await page.locator('.chip.ink .max-tag').isVisible()));
  await t.close();
}
scenario('ink pop and cap', inkFloatAndMax);

async function phoneSky() {
  const t = await open('phone');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(() => { for (const s of window.App.session.battle.teams[0].spells) s.cd = 0; });
  await t.click('.hud .spell');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = window.App.session.battle; b.teams[0].ink = 0; b.emit('denied', { team: 0, id: 'brawler', reason: 'ink' }); });
  await page.waitForTimeout(250);
  const g = await page.evaluate(() => {
    const hint = document.querySelector('.target-hint').getBoundingClientRect();
    const note = document.querySelector('.hud-notice').getBoundingClientRect();
    return { hint: [hint.top, hint.bottom], note: [note.top, note.bottom], ground: window.App.session.cam.groundY, hintText: document.querySelector('.target-hint').innerText, W: innerWidth, hl: hint.left, hr: hint.right };
  });
  check('phone: hint and notice sit in the sky above the ground row', g.hint[1] < g.ground - 40 && g.note[1] < g.ground - 40 && g.note[0] >= g.hint[1] - 2, JSON.stringify(g));
  check('phone: hint is short', g.hintText.length <= 34 && !/Click|Esc/.test(g.hintText), g.hintText);
  await t.snap('phone-hint');
  await t.close();
}
scenario('phone hint in the sky', phoneSky);

async function orientationHold() {
  const t = await open('phone');
  const { page } = t;
  await richBattle(t, '1-2');
  const time = () => page.evaluate(() => window.App.session.battle.time);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const a = await time();
  await page.waitForTimeout(600);
  check('portrait overlay pauses the battle', (await time()) - a < 0.05 && await page.evaluate(() => window.App.loop.paused));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  const b2 = await time();
  await page.waitForTimeout(500);
  check('landscape again resumes it', (await time()) - b2 > 0.2);
  // self-paused stays paused through a rotation
  await page.evaluate(() => window.App.session.togglePause(true));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  check('own pause menu survives a rotation', await page.evaluate(() => window.App.session.paused && window.App.loop.paused) && await page.locator('.pause-card').count() === 1);
  await t.close();
}
scenario('portrait auto-pause', orientationHold);

async function minimapDrag() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  const box = await page.locator('canvas.minimap').boundingBox();
  const cx = () => page.evaluate(() => window.App.session.cam.x);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  const c1 = await cx();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 });
  const c2 = await cx();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 6 });
  const c3 = await cx();
  await page.mouse.up();
  check('minimap scrubs while dragging', c2 > c1 + 100 && c3 > c2 + 100, [c1, c2, c3].join(' '));
  await t.close();
}
scenario('minimap drag', minimapDrag);

async function bigScreen() {
  const t = await open('hd');
  const { page } = t;
  await richBattle(t, '1-2');
  const m = await page.evaluate(() => ({ card: document.querySelector('.ucard').getBoundingClientRect().width, top: document.querySelector('.hud-top').getBoundingClientRect().height, chip: document.querySelector('.chip.ink').getBoundingClientRect().height }));
  check('HUD scales up at 1920x1080', m.card >= 95 && m.chip >= 50, JSON.stringify(m));
  await overlapProbe(t, 'hd zoom');
  await t.snap('hd-zoom');
  await t.close();
}
scenario('big screen scaling', bigScreen);

async function endlessStall() {
  const t = await open('desktop');
  const { page } = t;
  await richBattle(t, '1-2');
  await page.evaluate(async () => { const { App } = await import('./src/app.js'); App.startBattle({ kind: 'endless' }); });
  await page.waitForFunction(() => { const e = window.App.session.battle.endless; return e && e.state === 'fight'; }, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  check('no stall hint right away', !/CHARGE to finish/.test(await page.locator('.hud-banner').innerText()));
  await page.evaluate(() => { window.App.session.battle.time += 30; });
  await page.waitForTimeout(400);
  check('stalled wave shows the CHARGE hint', /Press CHARGE to finish the wave/.test(await page.locator('.hud-banner').innerText()), await page.locator('.hud-banner').innerText());
  await t.close();
}
scenario('endless stall hint', endlessStall);

const wanted = scenarios.filter((s) => !only || s.name.includes(only));
for (const s of wanted) {
  console.log('\n# ' + s.name);
  try { await s.fn(); } catch (e) { failures.push(s.name + ' crashed: ' + (e.stack || e.message)); console.log('  CRASH', e.message); }
}
await browser.close();
server.close();
if (errors.length) { console.log('\nBROWSER ERRORS:\n' + [...new Set(errors)].join('\n')); }
console.log(`\n${checks - failures.length}/${checks} checks passed`);
if (failures.length || errors.length) {
  console.log('FAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('hud tests ok');
