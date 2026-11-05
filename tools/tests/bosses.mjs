// Package B tests: enemy traits (unit tests) and the five boss fights (headless, player bot).
//   node tools/tests/bosses.mjs            full run (3 seeds per boss, natural + boss-kill modes)
//   node tools/tests/bosses.mjs --quick    1 seed
//   node tools/tests/bosses.mjs 4-6        one boss level
// Exits non-zero on exceptions, missing abilities, or an unkillable boss.
import { Battle } from '../../src/sim/index.js';
import { campaignConfig } from '../../src/game/modes.js';
import { UNITS } from '../../src/data/units.js';
import { LEVEL_BY_ID } from '../../src/data/levels.js';
import { expectedProfile, botAI } from '../sim.mjs';

const PROPOSED = {
  ...(process.env.WYRM_HP ? { boss_wyrm: { hp: +process.env.WYRM_HP } } : {}),
  ...(process.env.HAND_HP ? { boss_hand: { hp: +process.env.HAND_HP } } : {}),
};

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const trace = args.includes('--trace');
if (args.includes('--base')) { const { BEHAVIORS } = await import('../../src/sim/registry.js'); for (const k of Object.keys(BEHAVIORS)) if (k.startsWith('boss_')) delete BEHAVIORS[k]; }
const only = args.find((a) => /^\d-\d$/.test(a));
const SEEDS = quick ? 1 : +(process.env.SEEDS || 3);
let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL', msg); };
const check = (cond, msg) => { if (!cond) fail(msg); return cond; };

// ---------------------------------------------------------------- trait unit tests
function arena(levelId = '1-1') {
  const p = expectedProfile(levelId);
  const cfg = campaignConfig({ levelId, seed: 7 }, p);
  const b = new Battle(cfg);
  for (const t of b.teams) t.ai = null;
  b.teams[0].hero = null;
  return b;
}
const step = (b, n = 1) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
const idle = (b, team, id, x) => b.spawnUnit(team, id, { x, instant: true, z: 0 });

function traitTests() {
  console.log('traits');
  {
    const b = arena();
    const u = idle(b, 1, 'sharpener', 2300);
    step(b, 3);
    check(Math.abs(u.mod.dmg - 1) < 0.05, 'berserk: no bonus at full hp');
    u.hp = u.maxHp * 0.1;
    step(b, 3);
    check(Math.abs(u.mod.dmg - 2) < 0.1 && Math.abs(u.mod.atkSpeed - 1.6) < 0.1, `berserk: +100% dmg +60% atk speed at 10% hp (got ${u.mod.dmg.toFixed(2)}, ${u.mod.atkSpeed.toFixed(2)})`);
  }
  {
    const b = arena();
    const g = idle(b, 1, 'graphite_golem', 2300);
    const before = b.units.filter((u) => u.type === 'smudgeling').length;
    b.kill(g, { kind: 'melee' });
    const sm = b.units.filter((u) => u.type === 'smudgeling' && u.alive);
    check(sm.length - before === 3, 'shatter: spawns 3 smudgelings');
    check(sm.every((s) => s.airborne), 'shatter: smudgelings hop');
  }
  {
    const b = arena();
    const a = idle(b, 1, 'neon_archer', 2300);
    const t = idle(b, 0, 'brawler', 400);
    b.damage(t, 5, { source: a, team: 1, kind: 'pierce' });
    check(t.hasBuff('burn'), 'burnHit: applies burn');
    const burn = t.buffs.find((f) => f.id === 'burn');
    check(burn && burn.dot === 6 && burn.t >= 3.9, 'burnHit: 6 dps for 4 s');
    const hp0 = t.hp;
    step(b, 30);
    check(t.hp < hp0, 'burnHit: burn ticks damage');
    // the burn tick must not refresh itself
    step(b, 60 * 5);
    check(!t.hasBuff('burn'), 'burnHit: burn expires (no self refresh)');
  }
  {
    const b = arena();
    const d = idle(b, 1, 'dustborn', 2300);
    const foe = idle(b, 0, 'brawler', 450);
    b.damage(d, 9999, { source: foe, team: 0, kind: 'melee' });
    check(d.alive && d.data.downed && !d.targetable, 'reassemble: becomes untargetable pile');
    check(Math.abs(d.hp - d.maxHp * 0.5) < 1, 'reassemble: half hp');
    step(b, 60);
    check(d.data.downed, 'reassemble: still down at 1 s');
    const x0 = d.x;
    step(b, 60 * 2);
    check(!d.data.downed && d.targetable && d.state !== 'dead', 'reassemble: revived after 2.5 s');
    check(d.state === 'spawn' || d.state === 'idle', 'reassemble: sketch-in state');
    step(b, 60);
    b.damage(d, 9999, { source: foe, team: 0, kind: 'melee' });
    check(!d.alive, 'reassemble: second death is final');
    check(Math.abs(d.x - x0) < 60, 'reassemble: pile did not walk away');
  }
  {
    const b = arena();
    const a = idle(b, 1, 'chalk_thrower', 2300);
    const t = idle(b, 0, 'brawler', 400);
    b.damage(t, 5, { source: a, team: 1, kind: 'pierce' });
    const s = t.buffs.find((f) => f.id === 'slow');
    check(s && Math.abs(s.speed - 0.7) < 1e-6 && s.t >= 1.9, 'slowHit: 30% slow for 2 s');
    step(b, 2);
    check(Math.abs(t.mod.speed - 0.7) < 1e-6, 'slowHit: mod.speed 0.7');
  }
  {
    const b = arena();
    const k = idle(b, 1, 'eraser_knight', 2300);
    const t = idle(b, 0, 'brawler', 450);
    t.addBuff({ id: 'rally', t: 10, dmg: 1.3, speed: 1.2 });
    t.addBuff({ id: 'stuff', t: 10, dot: 1 });
    b.damage(t, 5, { source: k, team: 1, kind: 'melee' });
    check(!t.hasBuff('rally'), 'cleanse: removes positive buffs');
    check(t.hasBuff('stuff'), 'cleanse: keeps negative buffs');
    step(b, 1);
    check(t.mod.heal === 0, 'cleanse: noheal buff blocks healing');
    const hp = (t.hp -= 10);
    check(b.heal(t, 20, null, true) === 0 && t.hp === hp, 'cleanse: heal does nothing');
  }
}

// ---------------------------------------------------------------- boss fights
// Proposed boss stat changes (see the package B report). Applied here so the numbers below are what ships
// once the orchestrator merges src/data/units.js.
for (const id in PROPOSED) Object.assign(UNITS[id], PROPOSED[id]);

const STRONG = { unitLevel: 8, fortLevel: 8, heroLevel: 22 };
const BOSSES = [
  { level: '1-6', id: 'boss_redline', need: [['bossDash'], ['bossRoar', 'warcry'], ['bossEscalate'], ['telegraph', 'dash']] },
  { level: '2-6', id: 'boss_smudge', need: [['bossSlam', 'slam'], ['bossBelch'], ['bossEscalate'], ['telegraph', 'slam']] },
  { level: '3-6', id: 'boss_wyrm', need: [['bossBreath'], ['bossSlam', 'land'], ['bossSlam', 'stomp'], ['bossEscalate'], ['telegraph', 'breath'], ['telegraph', 'land'], ['telegraph', 'stomp']] },
  { level: '4-6', id: 'boss_professor', need: [['quizStun'], ['bossRoar', 'rain'], ['bossEscalate'], ['telegraph', 'quiz'], ['telegraph', 'rain'], ['spawn', 'chalk_wall']] },
  { level: '5-6', id: 'boss_hand', need: [['bossSlam', 'erase'], ['handStab'], ['handRedraw'], ['bossEscalate'], ['telegraph', 'erase'], ['telegraph', 'stab']] },
];

function tally(fn) {
  const counts = {};
  const orig = Battle.prototype.emit;
  Battle.prototype.emit = function (type, data) {
    const key2 = data && (data.kind || data.id);
    counts[type] = (counts[type] || 0) + 1;
    if (key2) counts[type + ':' + key2] = (counts[type + ':' + key2] || 0) + 1;
    return orig.call(this, type, data);
  };
  try { return { value: fn(), counts }; } finally { Battle.prototype.emit = orig; }
}

// A player who reads the red warnings: units inside a telegraph walk out of it after a short
// reaction time (the real game gives you stances and a Captain to do the same).
function dodge(b, dt) {
  for (const a of b.areas) {
    if (!a.alive || a.kind !== 'telegraph' || a.t < 0.45) continue;
    let lo, hi;
    if (a.shape === 'circle') { lo = a.x - a.radius - 30; hi = a.x + a.radius + 30; }
    else if (a.shape === 'band') { lo = a.x - a.width / 2 - 30; hi = a.x + a.width / 2 + 30; }
    else if (a.shape === 'sweep') { lo = Math.min(a.x0, a.x0 + a.dirn * a.length) - a.width / 2 - 30; hi = Math.max(a.x0, a.x0 + a.dirn * a.length) + a.width / 2 + 30; }
    else continue; // quiz: cannot be dodged by walking
    for (const u of b.byTeam[0]) {
      if (!u.alive || u.type === 'scribe' || u.x < lo || u.x > hi) continue;
      const out = (u.x - lo < hi - u.x) ? -1 : 1;
      u.x += out * Math.max(u.speed, 60) * 1.15 * dt;
    }
  }
}

function runBattle(cfg, maxTime) {
  const b = new Battle(cfg);
  const dt = 1 / 60;
  let spellT = 5, lastTrace = -1;
  while (!b.result && b.time < maxTime) {
    b.update(dt);
    if (cfg.dodge) dodge(b, dt);
    if (cfg.teams[0].ai && cfg.teams[0].ai.useSpells && (spellT -= dt) <= 0) {
      spellT = 3;
      b.teams[0].spells.forEach((s, i) => {
        if (s.cd > 0) return;
        if (s.id === 'highlighter') { const a = b.byTeam[0].find((u) => u.alive && u.attacking); if (a) b.castSpell(0, i, a.x); return; }
        let best = null, bestN = 1;
        for (const e of b.byTeam[1]) {
          if (!e.alive) continue;
          const n = b.byTeam[1].filter((o) => o.alive && Math.abs(o.x - e.x) < 140).length + (e.isBoss ? 3 : 0);
          if (n > bestN) { bestN = n; best = e; }
        }
        if (best) b.castSpell(0, i, best.x);
      });
    }
    b.events.length = 0;
    if (trace && cfg.dodge && Math.floor(b.time) % 10 === 0 && Math.floor(b.time) !== lastTrace) {
      lastTrace = Math.floor(b.time);
      const bs = b.boss;
      console.log('   t', lastTrace, bs ? `boss ${Math.round(bs.hp)}/${bs.maxHp} x${Math.round(bs.x)}` : 'no boss', 'player', b.units.filter((u) => u.alive && u.team === 0).length, 'enemy', b.units.filter((u) => u.alive && u.team === 1).length);
    }
  }
  return b;
}

function fight(def, seed, killMode) {
  const prof = expectedProfile(def.level, killMode ? STRONG : {});
  const cfg = campaignConfig({ levelId: def.level, seed: 1000 + seed * 17 }, prof);
  cfg.teams[0].ai = botAI(cfg);
  if (killMode) {
    cfg.dodge = true;
    cfg.level = { ...cfg.level, win: 'boss' };
    cfg.teams[1].fort = { ...cfg.teams[1].fort, invulnerable: true };
    cfg.teams[1].ai = { ...cfg.teams[1].ai, maxArmy: 0 }; // the boss alone (plus its own summons): isolates its kit
  }
  const { value: b, counts } = tally(() => runBattle(cfg, 900));
  return { b, counts };
}

function bossTests() {
  const need = new Map(); // boss id -> Set of satisfied requirement keys
  for (const def of BOSSES) {
    if (only && only !== def.level) continue;
    console.log(def.level, def.id);
    const seen = {};
    let natural = 0, kills = 0, killWins = 0;
    const times = [];
    for (let s = 0; s < SEEDS; s++) {
      try {
        const n = fight(def, s, false);
        if (n.b.result && n.b.result.winner === 0) natural++;
        for (const k in n.counts) seen[k] = (seen[k] || 0) + n.counts[k];
        const k = fight(def, s, true);
        for (const key in k.counts) seen[key] = (seen[key] || 0) + k.counts[key];
        if (k.b.bossDefeated) { kills++; times.push(Math.round(k.b.time)); } else if (k.b.boss) times.push('left ' + Math.round((100 * k.b.boss.hp) / k.b.boss.maxHp) + '%');
        if (k.b.result && k.b.result.winner === 0) killWins++;
      } catch (e) {
        fail(`${def.level} seed ${s} threw: ${e.stack}`);
      }
    }
    console.log(`  natural wins ${natural}/${SEEDS}, boss killed in boss-only mode ${kills}/${SEEDS} (times ${times.join(', ')} s), player won ${killWins}/${SEEDS}`);
    for (const r of def.need) {
      const key = r.length > 1 ? r[0] + ':' + r[1] : r[0];
      check(seen[key] > 0, `${def.id}: event ${key} fired at least once`);
    }
    check(kills > 0, `${def.id}: can be killed`);
  }
}

// The Wyrm flies low: wings and head never leave the top of a 720 px screen (and the boss bar).
function wyrmAltitude() {
  console.log('wyrm altitude');
  const b = arena('3-6');
  b.spawnUnit(0, 'brawler', { x: 900, instant: true });
  const w = b.spawnUnit(1, 'boss_wyrm', { x: 1400, instant: true });
  let minY = 0, landed = 0;
  for (let i = 0; i < 60 * 60; i++) { b.update(1 / 60); minY = Math.min(minY, w.y); if (w.data.landed) landed++; b.events.length = 0; w.hp = w.maxHp; }
  check(minY >= -141, `wyrm altitude cap 140 px (got ${Math.round(-minY)})`);
  check(landed > 60 * 12, `wyrm spends real time on the ground (${Math.round(landed / 60)} s of 60)`);
}

traitTests();
wyrmAltitude();
bossTests();
if (failures) { console.log(failures + ' failure(s)'); process.exit(1); }
console.log('bosses ok');
