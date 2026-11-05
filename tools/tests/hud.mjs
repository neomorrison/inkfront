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
  check('1-3 asks for DEFEND', /DEFEND/.test(await text()), await text());
  await t.click('.hud-stance .btn.blue');
  await page.waitForTimeout(400);
  check('1-3 then asks for units', /Brawlers/.test(await text()), await text());
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
