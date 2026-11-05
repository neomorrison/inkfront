// Audio test (real browser): every SFX plays, every music track starts and switches, volume 0 mutes,
// battle events map to sounds without errors, and each recipe renders non-silent without clipping.
//   node tools/tests/audio.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

async function launch() {
  const opts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
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

const errors = [];
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.ready, null, { timeout: 10000 });
  await page.mouse.click(640, 360); // user gesture: unlocks audio
  await page.waitForTimeout(500);

  const info = await page.evaluate(async () => {
    const { Audio, SFX } = await import('./src/audio/audio.js');
    await Audio.ctx.resume();
    return { state: Audio.ctx.state, names: Object.keys(SFX), ready: Audio.ready };
  });
  check(info.ready && info.state === 'running', 'AudioContext not running: ' + info.state);
  console.log(`sfx recipes: ${info.names.length}`);

  // Required names from the brief.
  const required = ['click', 'tab', 'buy', 'error', 'stamp', 'star', 'levelup', 'unlock', 'crate', 'page', 'toggle', 'whoosh',
    'queue', 'denied', 'spawn', 'stance_defend', 'stance_hold', 'stance_charge', 'hit', 'hit_melee', 'hit_thud', 'hit_pierce', 'hit_blast', 'hit_magic',
    'sword_swing', 'shoot', 'sling', 'throw', 'bolt', 'boulder', 'impact_ground', 'boom', 'death', 'launch', 'land', 'blocked', 'heal', 'coin', 'gather',
    'fortHit', 'fortDestroyed', 'gallop', 'poof', 'chain', 'summon', 'victory', 'defeat', 'boss_arrive', 'telegraph',
    'spell_pencil_rain', 'spell_coffee_spill', 'spell_ruler_smash', 'spell_paper_planes', 'spell_sticky_wall', 'spell_stapler', 'spell_highlighter', 'spell_doodle_drop', 'spell_eraser',
    'ability_rally', 'ability_slam', 'ability_inkstorm'];
  for (const n of required) check(info.names.includes(n), 'missing SFX ' + n);

  // Offline renders: non-silent, no clipping.
  const renders = await page.evaluate(async (names) => {
    const { Audio } = await import('./src/audio/audio.js');
    const out = {};
    for (const n of names) {
      try {
        const secs = ['victory', 'defeat', 'boss_arrive', 'fortDestroyed', 'ability_inkstorm', 'boom'].includes(n) ? 3.5 : 2;
        // Several random takes: recipes randomize timbre.
        let peak = 0, rms = 0, start = 0;
        for (let i = 0; i < 3; i++) {
          const r = await Audio.renderOffline(n, { vol: 1, pitch: 1 }, secs);
          peak = Math.max(peak, r.peak); rms = Math.max(rms, r.rms); start = r.start;
        }
        out[n] = { peak, rms, start };
      } catch (e) { out[n] = { error: String(e && e.stack || e) }; }
    }
    return out;
  }, info.names);
  let loud = 0;
  for (const [n, r] of Object.entries(renders)) {
    if (r.error) { fails.push(`render ${n}: ${r.error}`); continue; }
    check(r.peak > 0.02 && r.rms > 0.0005, `${n} is silent (peak ${r.peak.toFixed(3)} rms ${r.rms.toFixed(4)})`);
    check(r.peak < 1.0, `${n} clips (peak ${r.peak.toFixed(3)})`);
    check(r.start >= 0 && r.start < 0.25, `${n} starts late (${r.start})`);
    loud = Math.max(loud, r.peak);
  }
  console.log('offline renders ok, loudest peak', loud.toFixed(3));
  const sorted = Object.entries(renders).filter(([, r]) => !r.error).sort((a, b) => b[1].peak - a[1].peak).slice(0, 5);
  console.log('loudest:', sorted.map(([n, r]) => `${n} ${r.peak.toFixed(2)}`).join(', '));

  // Play every SFX live.
  const live = await page.evaluate(async (names) => {
    const { Audio } = await import('./src/audio/audio.js');
    let played = 0; const missed = [];
    for (const n of names) {
      for (let w = 0; w < 100 && Audio.voices > 30; w++) await new Promise((r) => setTimeout(r, 50));
      Audio.last.delete(n); Audio.recent.delete(n);
      const before = Audio.voices;
      Audio.play(n, { vol: 0.6, pan: Math.random() * 2 - 1 });
      if (Audio.voices > before) played++; else missed.push(n);
      await new Promise((r) => setTimeout(r, 25));
    }
    return { played, total: names.length, state: Audio.ctx.state, missed };
  }, info.names);
  console.log('missed', live.missed.join(' '));
  check(live.played >= live.total - 2, `only ${live.played}/${live.total} sounds scheduled voices`);
  check(live.state === 'running', 'context stopped after SFX');

  // Voice cap: a flood must not blow up the node count.
  const flood = await page.evaluate(async () => {
    const { Audio } = await import('./src/audio/audio.js');
    await new Promise((r) => setTimeout(r, 2500));
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      Audio.play(['hit_melee', 'hit_thud', 'death', 'shoot', 'hit_magic'][i % 5], { vol: 0.8, limit: 0 });
      peak = Math.max(peak, Audio.voices);
    }
    return peak;
  });
  check(flood < 140, 'voice cap exceeded: ' + flood);
  console.log('flood peak voices', flood);

  // Music: every track starts, switches and schedules notes.
  const music = await page.evaluate(async () => {
    const { Music } = await import('./src/audio/music.js');
    const { TRACKS } = await import('./src/audio/tracks.js');
    const res = {};
    for (const name of Object.keys(TRACKS)) {
      Music.request(name);
      await new Promise((r) => setTimeout(r, 900));
      res[name] = { cur: Music.cur && Music.cur.name, step: Music.cur ? Music.cur.step : -1 };
    }
    // Intensity layers fade in.
    Music.request('battle');
    await new Promise((r) => setTimeout(r, 400));
    for (let i = 0; i < 12; i++) Music.noteHit(0.3);
    await new Promise((r) => setTimeout(r, 1500));
    const hi = { intensity: Music.intensity, layers: Music.cur.layers.map((l) => +l.cur.toFixed(2)) };
    return { res, hi };
  });
  for (const [n, r] of Object.entries(music.res)) check(r.cur === n && r.step > 0, `music ${n} did not play: ${JSON.stringify(r)}`);
  check(music.hi.intensity > 0.5 && music.hi.layers.filter((v) => v > 0.5).length >= 4, 'intensity layers did not fade in: ' + JSON.stringify(music.hi));
  console.log('music ok', JSON.stringify(music.hi));

  // Stinger hands back to the menu.
  const sting = await page.evaluate(async () => {
    const { Music } = await import('./src/audio/music.js');
    Music.stinger('victory', 'menu');
    await new Promise((r) => setTimeout(r, 800));
    const during = Music.cur && Music.cur.name;
    await new Promise((r) => setTimeout(r, 9500));
    return { during, after: Music.cur && Music.cur.name };
  });
  check(sting.during === 'victory' && sting.after === 'menu', 'stinger flow wrong: ' + JSON.stringify(sting));

  // Volume 0 mutes.
  const mute = await page.evaluate(async () => {
    const { Audio } = await import('./src/audio/audio.js');
    const { Music } = await import('./src/audio/music.js');
    Audio.setVolumes(0, 0);
    const g = { music: Audio.music.gain.value, sfx: Audio.sfx.gain.value };
    const v0 = Audio.voices;
    Audio.last.clear();
    Audio.play('boom');
    const stepBefore = Music.cur ? Music.cur.step : 0;
    await new Promise((r) => setTimeout(r, 600));
    const stepAfter = Music.cur ? Music.cur.step : 0;
    const out = { g, newVoices: Audio.voices - v0, musicAdvanced: stepAfter - stepBefore };
    Audio.setVolumes(0.55, 0.8);
    await new Promise((r) => setTimeout(r, 500));
    out.back = { music: Audio.music.gain.value, sfx: Audio.sfx.gain.value, step: (Music.cur ? Music.cur.step : 0) - stepAfter };
    return out;
  });
  check(mute.g.music === 0 && mute.g.sfx === 0, 'volume 0 does not zero the gains: ' + JSON.stringify(mute.g));
  check(mute.newVoices <= 0, 'sfx scheduled while muted');
  check(mute.musicAdvanced <= 1, 'music kept scheduling while muted');
  check(mute.back.music > 0.2 && mute.back.sfx > 0.7 && mute.back.step > 0, 'volumes did not come back: ' + JSON.stringify(mute.back));

  // Event mapping: every event type, no throw, sounds get scheduled.
  const ev = await page.evaluate(async () => {
    const { Audio } = await import('./src/audio/audio.js');
    const { handleBattleAudio } = await import('./src/audio/events.js');
    const session = { cam: { sx: (x) => x - 100, w: 1280 } };
    const fakeUnit = { scale: 1, isHero: false, def: { look: { weapon: 'sword' } }, tags: new Set(['cavalry']) };
    const events = [
      { type: 'hit', amount: 30, kind: 'melee', x: 400, source: fakeUnit, target: fakeUnit }, { type: 'hit', amount: 30, kind: 'pierce', x: 500 },
      { type: 'hit', amount: 30, kind: 'blast', x: 500 }, { type: 'hit', amount: 30, kind: 'magic', x: 500, crit: true },
      { type: 'shoot', kind: 'arrow', x: 300, team: 0 }, { type: 'shoot', kind: 'stone', x: 300, team: 1 }, { type: 'shoot', kind: 'boulder', x: 300, team: 1 },
      { type: 'shoot', kind: 'bolt', x: 300, team: 0 }, { type: 'projLand', kind: 'arrow', x: 600 }, { type: 'projLand', kind: 'boulder', x: 600 },
      { type: 'spawn', unit: fakeUnit, team: 0, x: 300 }, { type: 'death', unit: fakeUnit, x: 700 }, { type: 'launch', x: 700 }, { type: 'land', x: 700 },
      { type: 'slam', x: 700, radius: 120 }, { type: 'explode', x: 700, radius: 100 }, { type: 'bomberBlast', x: 700 }, { type: 'blocked', x: 700 }, { type: 'immune', x: 700 },
      { type: 'gather', x: 500, team: 0 }, { type: 'deposit', x: 300, team: 0 }, { type: 'heal', x: 500, amount: 10 }, { type: 'fortHit', x: 300, amount: 40 },
      { type: 'fortDestroyed', x: 300 }, { type: 'heroAbility', id: 'rally', x: 500 }, { type: 'heroAbility', id: 'slam', x: 500 }, { type: 'heroAbility', id: 'inkstorm', x: 500 },
      { type: 'spell', id: 'pencil_rain', x: 500, team: 0 }, { type: 'spell', id: 'eraser', x: 500, team: 0 }, { type: 'spellFx', id: 'stapler', phase: 'impact', x: 500, team: 0 },
      { type: 'telegraph', x: 800 }, { type: 'chain', x: 800 }, { type: 'bossArrive' }, { type: 'bossDefeated' }, { type: 'waveStart' }, { type: 'draftOffer' },
      { type: 'pageChange' }, { type: 'poof', x: 500 }, { type: 'summon', x: 500 }, { type: 'gallop', x: 500 }, { type: 'banner' }, { type: 'end' },
    ];
    let scheduled = 0, thrown = 0; const quiet = [];
    for (const e of events) {
      for (let w = 0; w < 100 && Audio.voices > 30; w++) await new Promise((r) => setTimeout(r, 50));
      Audio.last.clear(); Audio.recent.clear();
      const v = Audio.voices;
      try { handleBattleAudio(e, session); } catch (err) { thrown++; }
      if (Audio.voices > v) scheduled++; else quiet.push(e.type + (e.kind || e.id || ''));
    }
    return { scheduled, thrown, total: events.length, quiet };
  });
  check(ev.thrown === 0, 'event mapping threw');
  check(ev.scheduled >= ev.total - 3, `only ${ev.scheduled}/${ev.total} events made sound`);
  console.log('events', JSON.stringify(ev));

  // Real battle: music routes to battle, then back to menu.
  const flow = await page.evaluate(async () => {
    const { Music } = await import('./src/audio/music.js');
    const { Audio } = await import('./src/audio/audio.js');
    const out = {};
    window.App.startBattle({ kind: 'campaign', levelId: '1-1' });
    await new Promise((r) => setTimeout(r, 2500));
    out.battle = Music.cur && Music.cur.name;
    out.voices = Audio.voices;
    window.App.goMap();
    await new Promise((r) => setTimeout(r, 1200));
    out.menu = Music.cur && Music.cur.name;
    return out;
  });
  check(flow.battle === 'battle', 'battle music did not start: ' + JSON.stringify(flow));
  check(flow.menu === 'menu', 'menu music did not return: ' + JSON.stringify(flow));
  console.log('flow', JSON.stringify(flow));
} catch (e) {
  errors.push('test: ' + (e.stack || e.message));
}

await browser.close();
server.close();
const all = [...errors, ...fails];
if (all.length) {
  console.log('FAILED:\n' + all.join('\n'));
  process.exit(1);
}
console.log('audio tests ok');
