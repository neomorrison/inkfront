// Headless tests for the nine Supplies. node tools/tests/spells.mjs
import { Battle } from '../../src/sim/index.js';
import { SPELLS, SPELL_ORDER } from '../../src/data/spells.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL: ' + msg); } else console.log('  ok: ' + msg); };

const FOREVER = 9999;

function stage(spellId, level = 1, o = {}) {
  const team = (faction, spells) => ({
    faction, startInk: 0, income: 0, popCap: 40, scribeCap: 0, roster: ['brawler', 'archer'], unitLevels: {},
    spells, fort: { hp: 99999, turret: false, invulnerable: true }, ai: null,
  });
  const b = new Battle({
    mode: 'skirmish', kind: 'skirmish', seed: 7, width: o.width || 2600, page: 'ruled', modifiers: [],
    teams: [team('ink', [{ id: spellId, level }]), team('red', [])],
  });
  b.update(1 / 60);
  b.teams[0].spells[0].cd = 0;
  return b;
}

// A rooted dummy: stays put, survives long enough to measure.
function dummy(b, team, x, id = 'brawler', hpMult = 30) {
  const u = b.spawnUnit(team, id, { x, z: 0, instant: true, hpMult });
  u.addBuff({ id: 'test_hold', t: FOREVER, root: true });
  u.dmg = 0; // harmless, so only the spell can hurt anyone
  return u;
}

const lost = (u) => u.maxHp - u.hp;
function run(b, sec) { for (let i = 0; i < sec * 60; i++) b.update(1 / 60); }

function areaSpell(id, level, opts = {}) {
  const def = SPELLS[id];
  const b = stage(id, level);
  const X = 1200;
  const reach = def.radius ?? def.width / 2;
  const inn = dummy(b, 1, X + reach * 0.3);
  const near = dummy(b, 1, X - reach * 0.7);
  const out = dummy(b, 1, X + reach + 260);
  const out2 = dummy(b, 1, X - reach - 260);
  const ally = dummy(b, 0, X + reach * 0.2);
  const ally2 = dummy(b, 0, X - reach * 0.4);
  const evs = [];
  const ok1 = b.castSpell(0, 0, X);
  ok(ok1, id + ' casts');
  const ticks = Math.ceil((opts.seconds || 4) * 60);
  for (let i = 0; i < ticks; i++) { b.update(1 / 60); for (const e of b.drainEvents()) evs.push(e); }
  return { b, inn, near, out, out2, ally, ally2, evs, X };
}

function cooldown(id) {
  const b = stage(id);
  b.castSpell(0, 0, 900);
  ok(b.castSpell(0, 0, 900) === false, id + ' respects cooldown');
  b.teams[0].spells[0].cd = 0;
  ok(b.castSpell(0, 0, 900) === true, id + ' casts again once ready');
}

// ---------------------------------------------------------------- tests
console.log('Pencil Rain');
{
  const r = areaSpell('pencil_rain', 3, { seconds: 3 });
  ok(lost(r.inn) > 0 || lost(r.near) > 0, 'enemies inside take damage');
  ok(lost(r.out) === 0 && lost(r.out2) === 0, 'enemies outside untouched');
}

console.log('Coffee Spill');
{
  const r = areaSpell('coffee_spill', 1, { seconds: 3 });
  ok(lost(r.inn) > 0 && lost(r.near) > 0, 'puddle burns enemies inside');
  ok(r.inn.hasBuff('coffee_slow') && r.inn.mod.speed < 0.7, 'puddle slows enemies');
  ok(lost(r.out) === 0 && lost(r.out2) === 0, 'enemies outside untouched');
  ok(lost(r.ally) === 0 && lost(r.ally2) === 0, 'allies untouched');
  run(r.b, 6);
  ok(!r.b.areas.some((a) => a.kind === 'coffee_spill'), 'puddle area ends');
  ok(r.evs.some((e) => e.type === 'spellFx' && e.id === 'coffee_spill' && e.phase === 'impact'), 'emits spellFx impact');
  const burnAfter = lost(r.inn);
  run(r.b, 2);
  ok(lost(r.inn) === burnAfter, 'burn stops after the puddle dries');
  cooldown('coffee_spill');
}

console.log('Ruler Smash');
{
  const r = areaSpell('ruler_smash', 1, { seconds: 1.2 });
  ok(lost(r.inn) > 100 && lost(r.near) > 100, 'ruler damages the strip');
  ok(r.inn.hasBuff('ruler_stun') || r.inn.hasBuff('stun') || r.inn.mod.stun, 'ruler stuns');
  ok(lost(r.out) === 0 && lost(r.out2) === 0, 'enemies outside the strip untouched');
  ok(lost(r.ally) === 0 && lost(r.ally2) === 0, 'allies untouched');
  cooldown('ruler_smash');
}

console.log('Paper Planes');
{
  const b = stage('paper_planes', 2);
  const a = dummy(b, 1, 700), c = dummy(b, 1, 1700);
  const ally = dummy(b, 0, 1200);
  b.castSpell(0, 0, 1300);
  run(b, 9);
  ok(lost(a) > 0 && lost(c) > 0, 'bombs hit enemies along the whole path');
  ok(lost(ally) === 0, 'allies untouched');
  ok(!b.areas.some((x) => x.kind === 'paper_planes'), 'planes leave the page');
  cooldown('paper_planes');
}

console.log('Sticky Wall');
{
  const b = stage('sticky_wall', 1);
  const walker = b.spawnUnit(1, 'brawler', { x: 1400, z: 0, instant: true });
  b.setStance(1, 'charge');
  b.castSpell(0, 0, 1000);
  const wall = b.units.find((u) => u.type === 'sticky_wall');
  ok(!!wall && wall.team === 0, 'wall spawns on the casting team');
  ok(wall && wall.maxHp === SPELLS.sticky_wall.lv.hp[0], 'wall has the spell hp');
  let minX = 1e9;
  for (let i = 0; i < 60 * 12; i++) { b.update(1 / 60); minX = Math.min(minX, walker.x); }
  ok(wall.alive && minX >= 1000 + wall.radius, 'enemy is held in front of the wall (min x ' + Math.round(minX) + ')');
  ok(wall.hp < wall.maxHp, 'enemy attacks the wall');
  wall.hp = 1;
  run(b, 1);
  ok(!wall.alive, 'wall can be destroyed');
  run(b, 6);
  ok(walker.x < 1000, 'enemy advances once the wall is gone');
  cooldown('sticky_wall');
  // lifetime
  const b2 = stage('sticky_wall', 1);
  b2.castSpell(0, 0, 900);
  run(b2, SPELLS.sticky_wall.lv.dur[0] + 1);
  ok(!b2.units.some((u) => u.type === 'sticky_wall' && u.alive), 'wall expires after its duration');
}

console.log('Stapler');
{
  const r = areaSpell('stapler', 1, { seconds: 1.5 });
  ok(lost(r.inn) > 0 && lost(r.near) > 0, 'stapler damages enemies inside');
  ok(r.inn.hasBuff('stapled'), 'stapled enemies are pinned');
  ok(lost(r.out) === 0 && lost(r.out2) === 0, 'enemies outside untouched');
  ok(!r.ally.hasBuff('stapled') && lost(r.ally) === 0, 'allies untouched');
  // A walker actually stops.
  const b = stage('stapler', 1);
  const w = b.spawnUnit(1, 'brawler', { x: 1500, z: 0, instant: true, hpMult: 30 });
  b.setStance(1, 'charge');
  b.castSpell(0, 0, 1450);
  run(b, 0.7);
  const x0 = w.x;
  run(b, 2);
  ok(Math.abs(w.x - x0) < 2, 'stapled walker cannot move');
  cooldown('stapler');
}

console.log('Highlighter');
{
  const b = stage('highlighter', 1);
  const a = dummy(b, 0, 1200), a2 = dummy(b, 0, 1300), far = dummy(b, 0, 1200 + 400);
  const e = dummy(b, 1, 1250);
  a.hp = a.maxHp * 0.3; a2.hp = a2.maxHp * 0.3; far.hp = far.maxHp * 0.3; const hp0 = a.hp;
  b.castSpell(0, 0, 1250);
  b.update(1 / 60);
  ok(a.mod.dmg > 1.4 && a2.mod.dmg > 1.4, 'allies in the area deal more damage');
  ok(far.mod.dmg === 1, 'allies outside get nothing');
  ok(e.mod.dmg === 1, 'enemies get nothing');
  run(b, 3);
  ok(a.hp > hp0 && far.hp === far.maxHp * 0.3, 'allies heal over time');
  run(b, 8);
  ok(a.mod.dmg === 1, 'buff wears off');
  cooldown('highlighter');
}

console.log('Doodle Drop');
{
  const b = stage('doodle_drop', 1);
  const before = b.units.filter((u) => u.team === 0).length;
  const popBefore = b.teams[0].pop;
  b.castSpell(0, 0, 1000);
  const made = b.units.filter((u) => u.team === 0 && u.type === 'brawler');
  ok(made.length === 4, 'level 1 sketches 4 brawlers (got ' + made.length + ')');
  ok(made.every((u) => Math.abs(u.x - 1000) <= 140), 'brawlers land near the target');
  ok(made.every((u) => u.state === 'spawn'), 'they sketch in');
  b.update(1 / 60);
  ok(b.teams[0].pop === popBefore, 'doodles do not use army size');
  const b5 = stage('doodle_drop', 5);
  b5.castSpell(0, 0, 1000);
  const m5 = b5.units.filter((u) => u.type === 'brawler');
  ok(m5.length === 6 && m5[0].level === 5, 'level 5: 6 brawlers at level 5 (got ' + m5.length + ', lv ' + (m5[0] && m5[0].level) + ')');
  ok(before >= 0, 'sanity');
  cooldown('doodle_drop');
}

console.log('The Eraser');
{
  const r = areaSpell('eraser', 1, { seconds: 1.0 });
  run(r.b, 3);
  ok(lost(r.inn) > 200 && lost(r.near) > 100, 'eraser wears down the strip');
  ok(lost(r.out) === 0 && lost(r.out2) === 0, 'enemies outside the strip untouched');
  ok(lost(r.ally) === 0 && lost(r.ally2) === 0, 'allies untouched');
  // erased units leave crumbs (death kind erase)
  const b = stage('eraser', 5);
  const weak = b.spawnUnit(1, 'brawler', { x: 1200, z: 0, instant: true });
  weak.addBuff({ id: 'test_hold', t: FOREVER, root: true });
  b.castSpell(0, 0, 1200);
  let erased = false;
  for (let i = 0; i < 600; i++) { b.update(1 / 60); for (const e of b.drainEvents()) if (e.type === 'death' && e.kind === 'erase') erased = true; }
  ok(!weak.alive && erased, 'erased units die with kind erase');
  cooldown('eraser');
}

console.log('Registry');
for (const id of SPELL_ORDER) {
  const b = stage(id);
  let threw = false;
  try { b.castSpell(0, 0, 1000); run(b, 12); } catch (e) { threw = true; console.log(e); }
  ok(!threw, id + ' runs 12 s without throwing');
}

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nspells ok');
