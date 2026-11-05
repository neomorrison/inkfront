// Balance auto-tuner. For each level it finds, by bisection against the player bot, the hardest
// setting that still gives the target win rate, then (with --write) stores the result in the
// AUTOTUNE block of src/data/levels.js.
//   node tools/tune.mjs                      tune every level, print the TUNE.auto block
//   node tools/tune.mjs 2-6,3-6 --write      tune some levels and write them into levels.js
// Options: --runs N (battles per probe, default 10)  --iters N (bisection steps, default 6)  --under N
// The dial scales enemy income, starting ink and army size; on boss levels it also scales the boss's health and damage. Targets are in TARGETS below.
import fs from 'node:fs';
import { LEVELS, TUNE, retune } from '../src/data/levels.js';
import { measureLevel } from './sim.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; return v === undefined || v.startsWith('--') ? true : isNaN(+v) ? v : +v; };
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',') : LEVELS.map((l) => l.id);
const runs = opt('runs', 10), iters = opt('iters', 6);

// Win-rate target per chapter (%) for regular and boss levels. 1-1..1-4 stay near 100 so a new player is never stuck.
// Chapters 2-5 sit a little lower than a pure "bot wins" bar so a human feels pressure; the finale is meant to be a
// real fight (the bot cannot dodge the Hand's sweeps, so ~50% for the bot is a fair fight for a person who can).
const TARGETS = {
  regular: { 1: 97, 2: 90, 3: 85, 4: 80, 5: 75 },
  boss: { 1: 80, 2: 75, 3: 70, 4: 65, 5: 50 },
};
const targetFor = (L) => (L.boss ? TARGETS.boss[L.chapter] : L.id === '1-1' ? 100 : TARGETS.regular[L.chapter]);
const BOUNDS = { lo: 0.2, hi: 2.5 };
// The finale never drops below its design: the Hand is a real fight (boss hp/dmg scale >= 0.85, no negative enemy
// level). Its escort (income, ink, army) can still scale down to land the bot at a fair rate.
// The Hand fights alone: its escort may shrink to almost nothing so a bot that cannot dodge still lands around 30-50%.
const LOWS = { '5-6': 0.05 };
const FLOORS = { '5-6': { boss: 0.85, level: 0 } }; // past ~2.5 a level is no longer the level it was designed as
// A new player must never meet a punishing opening, however strong the bot is.
const CAPS = { '1-1': 1.0, '1-2': 1.15, '1-3': 1.3, '1-4': 1.4, '1-5': 1.5, '1-6': 1.45, '2-1': 1.8, '2-2': 1.8, '2-3': 1.8, '2-4': 1.7 };

// One dial k (1 = as designed). Higher k = stronger enemy: more income, ink and army, a tougher fort and tower,
// and (every ~1.6x) one more upgrade level on every enemy unit. Boss levels also scale the boss.
export function dialToTune(L, k) {
  const t = {
    income: +k.toFixed(3), startInk: +Math.pow(k, 0.7).toFixed(3), army: +Math.pow(k, 0.8).toFixed(3),
    fortHp: +Math.pow(k, 0.55).toFixed(3), turret: +Math.pow(k, 0.35).toFixed(3),
    level: Math.round(Math.log(k) / Math.log(1.6)),
  };
  if (L.boss) { t.bossHp = +Math.pow(k, 0.6).toFixed(3); t.bossDmg = +Math.pow(k, 0.4).toFixed(3); }
  t.waves = +Math.pow(k, -0.5).toFixed(3);
  const fl = FLOORS[L.id];
  if (fl) {
    t.level = Math.max(fl.level, t.level);
    if (L.boss) { t.bossHp = Math.max(fl.boss, t.bossHp); t.bossDmg = Math.max(fl.boss, t.bossDmg); }
  }
  return t;
}

function setDial(L, k) {
  TUNE.auto[L.id] = dialToTune(L, k);
  retune();
}

const result = {};
for (const id of ids) {
  const L = LEVELS.find((l) => l.id === id);
  const target = targetFor(L);
  const top = Math.min(BOUNDS.hi, CAPS[id] ?? BOUNDS.hi);
  const floor = LOWS[id] ?? BOUNDS.lo;
  let lo = floor, hi = top, best = 1;
  // Win rate falls as the dial rises: keep the largest dial that still meets the target.
  let found = null;
  for (let it = 0; it < iters; it++) {
    const k = it === 0 ? Math.min(1, top) : Math.sqrt(lo * hi);
    setDial(L, k);
    const m = measureLevel(id, runs, { under: opt('under', 0) });
    const ok = m.winPct >= target;
    if (ok) { found = { k, m }; lo = k; } else hi = k;
    if (it === 0 && !ok) { lo = floor; hi = 1; }
    if (it === 0 && ok) { lo = 1; hi = top; }
  }
  best = found ? found.k : floor;
  setDial(L, best);
  const fin = measureLevel(id, runs, { under: opt('under', 0) });
  result[id] = TUNE.auto[id];
  console.log(id.padEnd(5), `dial ${best.toFixed(2)}`, `win ${fin.winPct}% (target ${target})`, `${fin.avgTime}s`, `stars ${fin.stars}`);
}

const block = Object.entries(result).map(([id, v]) => `    '${id}': ${JSON.stringify(v).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ')},`).join('\n');
if (opt('write')) {
  const f = new URL('../src/data/levels.js', import.meta.url);
  let src = fs.readFileSync(f, 'utf8');
  const a = src.indexOf('// AUTOTUNE:BEGIN'), z = src.indexOf('// AUTOTUNE:END');
  // Keep entries for levels not tuned this time.
  const old = src.slice(a + '// AUTOTUNE:BEGIN'.length, z);
  const keep = old.split('\n').filter((ln) => ln.trim() && !ids.some((id) => ln.includes(`'${id}'`)));
  const all = [...keep, ...block.split('\n')].sort((p, q) => p.localeCompare(q, undefined, { numeric: true }));
  src = src.slice(0, a) + '// AUTOTUNE:BEGIN\n' + all.join('\n') + '\n    ' + src.slice(z);
  fs.writeFileSync(f, src);
  console.log('wrote', ids.length, 'levels into src/data/levels.js');
} else console.log('\n' + block);
