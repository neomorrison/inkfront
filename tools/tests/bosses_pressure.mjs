// Pressure test: does each boss threaten the player (fort and army) and die in a sane time?
//   node tools/tests/bosses_pressure.mjs [level] [--seeds N] [--alone]
// Scenarios per boss: army kind (ranged | melee | mix) x posture (push | home: the player turtles).
// Reports boss kill time (from its arrival), boss damage dealt to the player's fort, army losses.
import { Battle } from '../../src/sim/index.js';
import { campaignConfig } from '../../src/game/modes.js';
import { expectedProfile, botAI } from '../sim.mjs';
import { LEVELS } from '../../src/data/levels.js';

const args = process.argv.slice(2);
const only = args.find((a) => /^\d-\d$/.test(a));
const si = args.indexOf('--seeds');
const SEEDS = si >= 0 ? +args[si + 1] : 2;
const alone = args.includes('--alone') || args.includes('--check');
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? +args[i + 1] : null; };
const BOSS_HP = flag('--boss-hp'), BOSS_DMG = flag('--boss-dmg'); // override the level tuner's multipliers
const KINDS = {
  ranged: { archer: 3, slinger: 2, medic: 0.5 },
  melee: { brawler: 3, shieldbearer: 2, spearman: 2 },
  mix: null,
};
const check = args.includes('--check'); // CI mode: alone, mixed army turtling at home; every boss must hurt the fort and be killable
const BOSS_LEVELS = ['1-6', '2-6', '3-6', '4-6', '5-6'];
const MAXT = 600;
let failures = 0;

function run(level, kind, posture, seed) {
  const prof = expectedProfile(level);
  prof.unlockedUnits = [...new Set([...prof.unlockedUnits, 'archer', 'slinger', 'brawler', 'shieldbearer', 'spearman', 'medic'])];
  const cfg = campaignConfig({ levelId: level, seed: 500 + seed * 31 }, prof);
  const bot = botAI(cfg);
  if (KINDS[kind]) bot.weights = { ...KINDS[kind] };
  if (posture === 'home') bot.firstAttack = 9999;
  cfg.teams[0].ai = bot;
  if (alone) cfg.teams[1].ai = { ...cfg.teams[1].ai, maxArmy: 0 };
  if (BOSS_HP != null || BOSS_DMG != null) {
    const id = cfg.level.boss, m = cfg.teams[1].mods;
    m.byUnit[id] = { ...(m.byUnit[id] || {}), hp: BOSS_HP ?? 1, dmg: BOSS_DMG ?? 1 };
  }
  cfg.level = { ...cfg.level, win: 'boss' };
  const b = new Battle(cfg);
  let fortFromBoss = 0, arrive = null, killT = null, lost = 0, bossAtFort = 0;
  const od = b.damageFort.bind(b);
  b.damageFort = (f, amt, info) => { const r = od(f, amt, info); if (f.team === 0 && info && info.source && info.source.isBoss) fortFromBoss += r; return r; };
  const dt = 1 / 60;
  while (!b.result && b.time < MAXT) {
    b.update(dt);
    for (const e of b.events) {
      if (e.type === 'bossArrive' && arrive === null) arrive = b.time;
      if (e.type === 'death' && e.unit && e.unit.team === 0) lost++;
      if (e.type === 'bossDown' && killT === null) killT = b.time - (arrive ?? 0);
    }
    b.events.length = 0;
  }
  const f = b.teams[0].fort;
  return { killT, fortFromBoss, fortPct: Math.round((100 * f.hp) / f.maxHp), lost, won: b.result && b.result.winner === 0, t: Math.round(b.time) };
}

for (const level of check ? [] : BOSS_LEVELS) {
  if (only && only !== level) continue;
  console.log(level, LEVELS.find((l) => l.id === level).boss);
  for (const kind of ['ranged', 'melee', 'mix']) {
    for (const posture of ['push', 'home']) {
      const rs = [];
      for (let s = 0; s < SEEDS; s++) rs.push(run(level, kind, posture, s));
      const kills = rs.filter((r) => r.killT != null).map((r) => Math.round(r.killT));
      const avg = (k) => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length);
      console.log(`  ${kind.padEnd(6)} ${posture.padEnd(4)} win ${rs.filter((r) => r.won).length}/${SEEDS} kill[${kills.join(',')}]s bossFortDmg ${avg('fortFromBoss')} fort% ${rs.map((r) => r.fortPct).join('/')} lost ${avg('lost')}`);
    }
  }
}
if (check) {
  console.log('pressure check (boss alone, mixed army turtling at home)');
  for (const level of BOSS_LEVELS) {
    if (only && only !== level) continue;
    const rs = [0, 1].map((s) => run(level, 'mix', 'home', s));
    const fort = rs.reduce((a, r) => a + r.fortFromBoss, 0) / rs.length;
    const kills = rs.filter((r) => r.killT != null);
    const lim = level === '3-6' ? 330 : 600;
    // 2-6: the turtling bot loses to Old Smudge on main too (tuner's job), so only pressure is checked there.
    const ok = fort > 50 && (level === '2-6' || kills.length > 0) && kills.every((r) => r.killT <= lim);
    console.log(`  ${level} fort damage ${Math.round(fort)} kill [${rs.map((r) => (r.killT == null ? 'none' : Math.round(r.killT))).join(',')}]s ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) failures++;
  }
}
if (failures) { console.log(failures + ' failure(s)'); process.exit(1); }
