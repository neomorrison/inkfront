// End-to-end meta UI test with real clicks/taps and an overlap probe on every screen.
//   node tools/tests/meta.mjs            runs 1280x720 mouse and 844x390 touch
//   node tools/tests/meta.mjs --only mobile|desktop
// Flow: fresh save -> title -> campaign -> 1-1 -> loadout -> Battle -> forced win -> results -> next ->
// armory buy -> (1-2 win) -> captain point + hat -> achievements -> settings export/import/reset.
import path from 'node:path';
import { serve, launch, VIEWPORTS, out, probe } from './lib.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const { server, url } = await serve();
const browser = await launch();
const failures = [];
const probeIssues = [];

function check(cond, msg) {
  if (cond) console.log('  ok   ' + msg);
  else { console.log('  FAIL ' + msg); failures.push(msg); }
}

async function run(vpName, vp) {
  console.log(`\n== ${vpName} ${vp.viewport.width}x${vp.viewport.height}`);
  const touch = !!vp.hasTouch;
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });
  const tag = vpName === 'mobile' ? 'm' : 'd';
  let n = 0;
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `metae2e-${tag}-${String(++n).padStart(2, '0')}-${name}.png`) }); };
  const P = (name) => probe(page, `${name} @${vpName}`, probeIssues);
  const click = async (sel, opts = {}) => {
    const el = page.locator(sel).first();
    await el.waitFor({ state: 'visible', timeout: 8000 });
    if (touch) await el.tap(opts); else await el.click(opts);
  };
  const profile = (fn) => page.evaluate(async (code) => {
    const { Save } = await import('./src/game/save.js');
    return (0, eval)('(' + code + ')')(Save.data);
  }, fn.toString());
  const settle = (ms = 450) => page.waitForTimeout(ms);

  try {
    await page.goto(url);
    await page.evaluate(() => localStorage.removeItem('inkfront.save.v1'));
    await page.reload();
    await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 15000 });
    await settle(1400);

    // ---------- title (fresh)
    const firstBtn = await page.locator('.screen-title button.btn').first().innerText();
    check(/play/i.test(firstBtn), 'title: first button is Play');
    const lockedTiles = await page.locator('.screen-title .tile.locked').count();
    check(lockedTiles === 5, 'title: all 5 mode tiles locked on a fresh save (' + lockedTiles + ')');
    const hints = await page.locator('.screen-title .tile .hint').allInnerTexts();
    check(hints.includes('Clear 1-1') && hints.includes('Clear 2-1'), 'title: lock hints shown');
    await P('title-fresh'); await shot('title');

    // ---------- map
    await click('.screen-title button.btn');
    await settle(700);
    check(await page.locator('.screen-map .node').count() === 6, 'map: 6 nodes for page 1');
    check(await page.locator('.screen-map .node.locked').count() === 5, 'map: 5 locked nodes');
    check(await page.locator('.screen-map .node.current').count() === 1, 'map: one current node');
    await P('map'); await shot('map');

    // ---------- loadout 1-1
    await click('button.btn:has-text("1-1")');
    await settle(700);
    check(await page.locator('.screen-loadout .battle-btn').count() === 1, 'loadout: opens for 1-1');
    check(await page.locator('.screen-loadout .pcard.on').count() >= 2, 'loadout: Scribe and Brawler selected');
    await P('loadout'); await shot('loadout');
    await click('.screen-loadout button.btn:has-text("Battle")');
    await page.waitForSelector('.hud', { timeout: 8000 });
    await settle(1200);
    // the first-battle how-to card holds the battle until it is dismissed
    await page.evaluate(() => window.App.session.hud && window.App.session.hud.closeQuickCard && window.App.session.hud.closeQuickCard());
    check(await page.evaluate(() => !!window.App.session && !window.App.session.isDemo), 'battle: started from loadout');
    check(await page.evaluate(() => !!window.App.session.ach), 'achievements: battle trackers attached');

    // ---------- forced win -> results (with synthetic events for the achievement trackers)
    await page.evaluate(() => {
      const s = window.App.session;
      const emit = (e) => s.listeners.forEach((fn) => fn(e, s));
      for (let i = 0; i < 7; i++) emit({ type: 'death', t: 0, killer: { type: 'bomber', team: 0, id: 77 }, team: 1, x: 100 });
      for (let i = 0; i < 3; i++) emit({ type: 'death', t: 0, killer: { type: 'bomber', team: 0, id: 77 }, team: 0, x: 100 });
      emit({ type: 'bomberBlast', team: 0, enemies: 2, friendly: 1 });
      emit({ type: 'spell', t: 0, team: 0, id: 'coffee_spill', x: 0, level: 1 });
      s.battle.end(0);
    });
    await page.waitForSelector('.screen-results', { timeout: 10000 });
    await settle(5600);
    check(await page.locator('.screen-results .stamp.in').count() === 1, 'results: stamp landed');
    check(await page.locator('.screen-results .rc-stars img[src^="data"]').count() === 3, 'results: three stars shown');
    const g = await profile((p) => p.gold);
    check(g > 0, 'results: gold paid (' + g + ')');
    check(await profile((p) => p.levels['1-1'] && p.levels['1-1'].cleared), 'results: 1-1 cleared in save');
    check(await profile((p) => p.stats.bomberMulti === 7 && p.stats.friendlyBombs === 4), 'trackers: bomber kills and friendly blasts recorded');
    check(await profile((p) => p.unlockedUnits.includes('slinger')), 'results: Slinger unlocked');
    check(await page.locator('.screen-results .flipcard.flipped').count() >= 2, 'results: unlock cards flipped (unit + new menu)');
    check(await page.locator('.screen-results .rc-ach').count() >= 1, 'results: achievement shown');
    await P('results'); await shot('results');

    // ---------- next level -> loadout -> back to title
    await click('.screen-results button.btn:has-text("Next Level")');
    await settle(700);
    check(await page.locator('.screen-loadout .battle-btn').count() === 1, 'next: opens the loadout for 1-2');
    check(/1-2/.test(await page.locator('.screen-loadout .mh-title').innerText()), 'next: title says 1-2');
    await click('.screen-loadout button.btn:has-text("Back")');
    await settle(500);
    await click('.screen-map button.btn:has-text("Back")');
    await settle(900);

    // ---------- title now shows armory
    check(await page.locator('.screen-title .tile[data-tile="armory"]:not(.locked)').count() === 1, 'title: Armory open after 1-1');
    check(await page.locator('.screen-title .tile[data-tile="captain"].locked').count() === 1, 'title: Captain still locked');
    await P('title-after-1-1'); await shot('title-armory');

    // ---------- armory buy
    await click('.screen-title .tile[data-tile="armory"]');
    await settle(600);
    await P('armory-units'); await shot('armory');
    const goldBefore = await profile((p) => p.gold);
    await click('.screen-armory .athumb[data-unit="brawler"]');
    await settle(250);
    await click('.screen-armory .btn.upgrade');
    await settle(700);
    const after = await profile((p) => ({ gold: p.gold, lv: p.units.brawler }));
    check(after.lv === 2 && after.gold < goldBefore, `armory: Brawler upgraded to Lv 2 (gold ${goldBefore} -> ${after.gold})`);
    await shot('armory-bought');
    await click('.screen-armory .tab:has-text("Fort")');
    await settle(400);
    await P('armory-fort');
    await click('.screen-armory .tab:has-text("Supplies")');
    await settle(400);
    await P('armory-spells');
    await click('.screen-armory button.btn:has-text("Back")');
    await settle(800);

    // ---------- play 1-2 (forced win) to open the Captain
    await click('.screen-title button.btn');
    await settle(600);
    await click('button.btn:has-text("1-2")');
    await settle(600);
    check(await page.locator('.screen-loadout .scard:not(.lent)').count() === 0, 'loadout 1-2: no owned supplies yet');
    check(await page.locator('.screen-loadout .scard.lent').count() === 1, 'loadout 1-2: Pencil Rain shown as lent for this battle');
    await click('.screen-loadout button.btn:has-text("Battle")');
    await page.waitForSelector('.hud', { timeout: 8000 });
    await settle(900);
    await page.evaluate(() => window.App.session.battle.end(0));
    await page.waitForSelector('.screen-results', { timeout: 10000 });
    await settle(5600);
    check(await profile((p) => p.unlockedSpells.includes('pencil_rain')), 'results: Pencil Rain unlocked by 1-2');
    await P('results-2'); await shot('results-2');
    await click('.screen-results button.btn:has-text("Map")');
    await settle(500);
    await click('.screen-map button.btn:has-text("Back")');
    await settle(900);

    // ---------- captain
    check(await page.locator('.screen-title .tile[data-tile="captain"]:not(.locked)').count() === 1, 'title: Captain open after 1-2');
    await click('.screen-title .tile[data-tile="captain"]');
    await settle(600);
    const points = await profile((p) => p.hero.points);
    check(points >= 1, 'captain: has skill points (' + points + ')');
    await P('hero-skills'); await shot('captain');
    await click('.screen-hero .skill[data-skill="sharp_nib"] .plus-btn');
    await settle(500);
    check(await profile((p) => p.hero.skills.sharp_nib === 1), 'captain: spent a point on Sharp Nib');
    check(await profile((p) => p.hero.points) === points - 1, 'captain: point deducted');
    await click('.screen-hero .tab:has-text("Hats")');
    await settle(400);
    await click('.screen-hero .htile[data-hat="none"]');
    await settle(400);
    check(await profile((p) => p.hero.hat) === 'none', 'captain: equipped No Hat');
    await click('.screen-hero .htile[data-hat="captain"]');
    await settle(400);
    check(await profile((p) => p.hero.hat) === 'captain', 'captain: equipped the tricorn again');
    await click('.screen-hero button.btn:has-text("Army Hats")');
    await settle(300);
    check(await profile((p) => p.settings.armyHats) === true, 'captain: Army Hats on');
    await P('hero-hats'); await shot('captain-hats');
    await click('.screen-hero button.btn:has-text("Back")');
    await settle(700);

    // ---------- achievements
    await click('.screen-title .tile[data-tile="achievements"]');
    await settle(600);
    check(await page.locator('.screen-achievements .ach.done').count() >= 1, 'achievements: First Blood is done');
    await P('achievements'); await shot('achievements');
    await click('.screen-achievements .tab:has-text("Stats")');
    await settle(400);
    check(await page.locator('.screen-achievements .stat-line').count() > 10, 'stats: lifetime stats listed');
    await P('stats'); await shot('stats');
    await click('.screen-achievements button.btn:has-text("Back")');
    await settle(700);

    // ---------- settings
    await click('.screen-title button.gear');
    await settle(600);
    await page.locator('.screen-settings input.slider').first().fill('30');
    await settle(200);
    check(Math.abs((await profile((p) => p.settings.music)) - 0.3) < 0.02, 'settings: music slider saved');
    await click('.screen-settings .switch[aria-label="Screen shake"]');
    check(await profile((p) => p.settings.shake) === false, 'settings: screen shake toggled off');
    await P('settings'); await shot('settings');
    await click('.screen-settings .tab:has-text("Controls")');
    await settle(300);
    await P('settings-controls');
    await click('.screen-settings .tab:has-text("Save")');
    await settle(300);
    await click('.screen-settings button.btn:has-text("Copy code")');
    await settle(300);
    const code = await page.locator('.screen-settings textarea.code').first().inputValue();
    check(code.startsWith('INK1:') && code.length > 100, 'settings: export code produced');
    await P('settings-save'); await shot('settings-save');
    const goldNow = await profile((p) => p.gold);
    // Change something, then restore it by importing the code.
    await profile((p) => { p.gold = 7; });
    await page.locator('.screen-settings textarea.code').nth(1).fill('garbage');
    await click('.screen-settings button.btn:has-text("Load code")');
    await settle(300);
    check(/not/i.test(await page.locator('.screen-settings .set-msg.bad').innerText()), 'settings: bad code is rejected with a message');
    await page.locator('.screen-settings textarea.code').nth(1).fill(code);
    await click('.screen-settings button.btn:has-text("Load code")');
    await page.waitForSelector('.screen-title', { timeout: 5000 });
    await settle(500);
    check(await profile((p) => p.gold) === goldNow, 'settings: import restored the save (gold ' + goldNow + ')');
    await click('.screen-title button.gear');
    await settle(500);
    await click('.screen-settings .tab:has-text("Save")');
    await click('.screen-settings button.btn:has-text("Reset save")');
    await page.waitForSelector('.modal-confirm', { timeout: 3000 });
    await P('confirm'); await shot('confirm');
    await click('.modal-confirm button.btn:has-text("Erase it")');
    await page.waitForSelector('.screen-title', { timeout: 5000 });
    await settle(500);
    check(await profile((p) => Object.keys(p.levels).length === 0 && p.gold === 0), 'settings: reset wiped the save');

    // ---------- daily + endless entry cards and the crate modal (staged profile)
    await profile((p) => {
      for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '2-1']) p.levels[id] = { stars: 3, cleared: true, plays: 1 };
      p.crates = 2;
    });
    await page.evaluate(() => window.App.goTitle());
    await settle(900);
    await P('title-mid'); await shot('title-mid');
    await click('.screen-title .tile[data-tile="daily"]');
    await settle(500);
    await P('daily'); await shot('daily');
    await click('.screen-daily button.btn:has-text("Back")');
    await settle(500);
    await click('.screen-title .tile[data-tile="endless"]');
    await settle(500);
    await P('endless'); await shot('endless');
    await click('.screen-endless_menu button.btn:has-text("Back")');
    await settle(700);
    await click('.screen-title button.crate-btn');
    await page.waitForSelector('.modal-crate', { timeout: 3000 });
    await settle(400);
    await P('crate'); await shot('crate');
    await click('.modal-crate .crate-box');
    await page.waitForSelector('.modal-crate .reward-card', { timeout: 6000 });
    await settle(900);
    check(await profile((p) => p.crates) === 1, 'crate: one crate consumed');
    check(await profile((p) => p.hats.some((h) => ['paper_boat', 'beanie', 'wizard', 'bucket', 'santa', 'fez'].includes(h))), 'crate: awarded a crate hat');
    await P('crate-open'); await shot('crate-open');
    await click('.modal-crate button.btn:has-text("Keep")');
    await settle(500);
  } catch (e) {
    failures.push(`${vpName}: ${e.message.split('\n')[0]}`);
    console.log('  FAIL exception: ' + e.message.split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: path.join(out, `metae2e-${tag}-failure.png`) }).catch(() => {});
  }
  if (errors.length) { console.log('  console/page errors:\n    ' + errors.slice(0, 6).join('\n    ')); failures.push(...errors.slice(0, 6).map((e) => `${vpName}: ${e}`)); }
  await ctx.close();
}

for (const [name, vp] of Object.entries({ desktop: VIEWPORTS.desktop, mobile: VIEWPORTS.mobile })) {
  if (only && only !== name) continue;
  await run(name, vp);
}
await browser.close();
server.close();
console.log(`\nprobe issues: ${probeIssues.length}`);
if (failures.length || probeIssues.length) {
  console.log('FAILED:\n' + [...failures, ...probeIssues].map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('meta ok');
