// Boss portraits: BODIES.wyrm/hand must draw with the minimal stub renderer the icon path passes.
import { serve, launch, out } from './lib.mjs';
import path from 'node:path';
const { server, url } = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 400, height: 200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
const res = await page.evaluate(async () => {
  const { BODIES } = await import('./src/render/renderer.js');
  const { unitIcon } = await import('./src/render/icons.js');
  const fails = [];
  for (const id of ['boss_wyrm', 'boss_hand']) {
    const look = (await import('./src/data/units.js')).UNITS[id].look;
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const ctx = c.getContext('2d');
    const fake = { id: 1, z: 0, y: 0, data: {}, anim: { flash: 0, atk: 0 }, state: 'idle', facing: 1, team: 1, attacking: false };
    const o = { x: 48, y: 80, s: 0.3, facing: 1, col: '#c0107a', back: '#fff', paper: '#fff', light: '#eee', dark: '#333', under: '#ff0', lw: 3, seed: 7, frame: 0, t: 0.4, look, unit: fake, pal: {} };
    const stub = { cam: { zoom: 0.3, x: 0, w: 96, h: 96, sx: () => 48, sy: () => 80, visible: () => true }, t: 0.4, settings: {}, pal: [{}, {}] };
    try { BODIES[look.body](ctx, fake, o, stub); } catch (e) { fails.push(id + ': ' + e.message); }
    const px = ctx.getImageData(0, 0, 96, 96).data; let n = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
    if (n < 100) fails.push(id + ' drew nothing');
    const icon = unitIcon(id, { size: 96 });
    if (!icon || icon.length < 500) fails.push(id + ' unitIcon empty');
  }
  return fails;
});
await browser.close(); server.close();
if (res.length || errors.length) { console.log('FAIL', res, errors); process.exit(1); }
console.log('boss icons ok');
