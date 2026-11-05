// Headless tests for the Captain: control feel, combo, Ink Slam, Inkstorm, Fury and every skill.
//   node tools/tests/hero.mjs
import { Battle } from '../../src/sim/index.js';
import { campaignConfig } from '../../src/game/modes.js';
import { defaultProfile } from '../../src/game/save.js';
import { HERO_ABILITIES, HERO_SKILLS, HERO_SKILL_BY_ID } from '../../src/data/hero.js';
import { HATS } from '../../src/data/hats.js';

let fails = 0;
let checks = 0;
function ok(cond, msg, extra) {
  checks++;
  if (cond) console.log('  ok  ' + msg);
  else { fails++; console.log('  FAIL ' + msg + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DT = 1 / 60;

function profile(level = 30, skills = {}) {
  const p = defaultProfile();
  p.hero.level = level;
  p.hero.skills = { ...skills };
  p.unlockedUnits = ['scribe', 'brawler'];
  p.loadout.units = ['brawler'];
  return p;
}

// A quiet arena: no AI, hero placed mid-field, enemy dummies that never move or hurt.
function arena(prof = profile(), opts = {}) {
  const cfg = campaignConfig({ levelId: '1-1', seed: 5 }, prof);
  cfg.tutorial = null;
  cfg.teams[0].ai = null;
  cfg.teams[1].ai = null;
  cfg.teams[1].startUnits = null;
  const b = new Battle(cfg);
  run(b, 1.0); // let the hero finish sketching in
  const h = b.teams[0].hero;
  h.x = opts.x ?? 1000;
  h.px = h.x;
  b.teams[0].fort.turret.on = false;
  b.teams[1].fort.turret.on = false;
  return { b, h };
}

function dummy(b, x, hpMult = 60) {
  const e = b.spawnUnit(1, 'brawler', { x, z: 0, instant: true, hpMult });
  e.speed = 0;
  e.dmg = 0;
  e.atkCd = 99;
  return e;
}

function run(b, sec, each) {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) {
    b.update(DT);
    if (each) each(b);
    if (b.events.length > 4000) b.events.length = 0;
  }
}

function collect(b, sec, types) {
  const out = [];
  run(b, sec, () => {
    for (const e of b.events) if (!types || types.includes(e.type)) out.push(e);
    b.events.length = 0;
  });
  return out;
}

// ---------------------------------------------------------------- control feel
console.log('Control feel');
{
  const { b, h } = arena();
  const x0 = h.x;
  b.control[0].heroMove = 1;
  run(b, 1);
  const dx = h.x - x0;
  ok(near(dx, h.speed, 12), 'steering right moves about one speed per second', dx);
  b.control[0].heroMove = -1;
  run(b, 1);
  ok(h.x < x0 + dx - h.speed * 0.8, 'steering left reverses', h.x);
  ok(h.facing === -1, 'faces the steering direction');
  b.control[0].heroMove = 0;
  const x1 = h.x;
  run(b, 3);
  ok(Math.abs(h.x - x1) < 1, 'does not walk by himself during the 5 s grace', h.x - x1);
  b.teams[0].stance = 'charge';
  run(b, 3);
  ok(h.x > x1 + 40, 'rejoins the army AI after 5 s idle (walks to the charge line)', h.x - x1);
}

// ---------------------------------------------------------------- combo
console.log('Combo');
{
  const { b, h } = arena();
  const e = dummy(b, h.x + 30);
  const e2 = dummy(b, h.x + 70);
  b.control[0].heroMove = 1; // taps once to take control, then stands and auto-fights
  run(b, 0.05);
  b.control[0].heroMove = 0;
  h.facing = 1;
  const hits = [];
  const t1 = e2.hp;
  const ev = collect(b, 3.5, ['hit', 'heroHit']);
  for (const x of ev) if (x.type === 'hit' && x.source === h && x.target === e) hits.push(x.amount);
  const combos = ev.filter((x) => x.type === 'heroHit').map((x) => x.combo);
  ok(combos.length >= 3 && combos[0] === 1 && combos[1] === 2 && combos[2] === 3, 'swings cycle 1, 2, 3', combos);
  ok(hits.length >= 3 && hits[2] > hits[0] * 1.4, 'the third hit is much stronger', hits.slice(0, 4).map(Math.round));
  ok(hits[0] > 0 && near(hits[0], hits[1], hits[0] * 0.05), 'hits 1 and 2 match', hits.slice(0, 2));
  ok(t1 - e2.hp > 0, 'the heavy swing splashes a second enemy');
  const splashHits = ev.filter((x) => x.type === 'hit' && x.source === h && x.target === e2).length;
  const ownHits = ev.filter((x) => x.type === 'hit' && x.source === h && x.target === e).length;
  ok(splashHits > 0 && splashHits < ownHits, 'splash only happens on heavy swings', { splashHits, ownHits });
}
{
  // Heavy swing pushes a light enemy back.
  const { b, h } = arena();
  const e = dummy(b, h.x + 30);
  e.mass = 0.8;
  b.control[0].heroMove = 1; run(b, 0.05); b.control[0].heroMove = 0;
  const ev = collect(b, 3.5, ['heroHit', 'launch']);
  ok(ev.some((x) => x.type === 'launch') || e.x > h.x + 45, 'heavy swing knocks a light enemy back');
}
{
  // Moving into an enemy swings while walking.
  const { b, h } = arena();
  const e = dummy(b, h.x + 120);
  b.control[0].heroMove = 1;
  const ev = collect(b, 2, ['heroHit']);
  ok(ev.length >= 2, 'swings at enemies while steering into them', ev.length);
  ok(h.x > 1000 + 40, 'and keeps moving forward while doing so', h.x);
}

// ---------------------------------------------------------------- slam
console.log('Ink Slam');
{
  const { b, h } = arena();
  const inside = dummy(b, h.x + 175);
  const edge = dummy(b, h.x + 175 + 100);
  const outside = dummy(b, h.x + 175 + 260);
  const behind = dummy(b, h.x - 60);
  h.facing = 1;
  b.control[0].heroMove = 1; run(b, 0.05); b.control[0].heroMove = 0;
  const x0 = h.x;
  b.control[0].heroAbility = 'slam';
  const ev = collect(b, 1.0, ['heroAbility', 'slam']);
  const ph = ev.filter((x) => x.type === 'heroAbility').map((x) => x.phase);
  ok(ph[0] === 'start' && ph.includes('land'), 'emits start then land', ph);
  const land = ev.find((x) => x.type === 'heroAbility' && x.phase === 'land');
  ok(land && near(land.x - x0, 170, 28), 'leaps about 170 px', land && land.x - x0);
  ok(inside.hp < inside.maxHp, 'enemy under the landing is damaged');
  ok(outside.hp === outside.maxHp, 'enemy far outside the radius is untouched');
  ok(behind.hp === behind.maxHp, 'enemy behind the Captain is untouched');
  ok(inside.x > land.x + 3 || inside.airborne, 'enemy under the landing is shoved away', [inside.x, land.x]);
  ok(h.data.cds.slam > 8, 'goes on cooldown', h.data.cds.slam);
  ok(!h.airborne && h.y === 0, 'lands on the ground');
}
{
  // damage amount, knockback and stun on a plain fresh enemy
  const { b, h } = arena();
  const e = dummy(b, h.x + 150, 1);
  e.maxHp = e.hp = 5000;
  e.mass = 1;
  h.facing = 1;
  b.control[0].heroMove = 1; run(b, 0.05); b.control[0].heroMove = 0;
  b.control[0].heroAbility = 'slam';
  let stunned = false, launched = false, hpAfter = e.hp;
  run(b, 0.8, () => {
    if (e.hasBuff('stun')) stunned = true;
    if (e.airborne) launched = true;
  });
  const lost = e.maxHp - e.hp;
  ok(near(lost, HERO_ABILITIES.slam.dmg * (h.dmg / h.def.dmg) * (1 - e.armor), 25), 'slam damage = ability damage scaled by hero damage', Math.round(lost));
  ok(stunned, 'slam stuns for 0.3 s');
  ok(launched || e.x > h.x + 100, 'slam knocks the enemy away', e.x - h.x);
}

// ---------------------------------------------------------------- fury + inkstorm
console.log('Fury and Inkstorm');
{
  const { b, h } = arena();
  const e = dummy(b, h.x + 30);
  ok(h.data.fury === 0, 'fury starts empty');
  b.control[0].heroMove = 1; run(b, 0.05); b.control[0].heroMove = 0;
  const dealtBefore = b.teams[0].stats.dmgDealt;
  run(b, 3);
  const dealt = b.teams[0].stats.dmgDealt - dealtBefore;
  ok(dealt > 50 && near(h.data.fury, dealt / 6 / (1 + 0.06 * 29), 0.8), 'fury grows 1 per 6 damage dealt (in level-1 numbers)', { fury: h.data.fury, expect: dealt / 6 / (1 + 0.06 * 29) });
  // Not full: inkstorm refuses.
  h.data.fury = 60;
  b.control[0].heroAbility = 'inkstorm';
  run(b, 0.2);
  ok(!h.data.storm && h.data.fury >= 60, 'inkstorm needs full fury');
  // Taking damage fills fury too.
  const f0 = h.data.fury;
  h.hp -= 100;
  run(b, 0.1);
  ok(near(h.data.fury - f0, 100 / 10 / (1 + 0.07 * 29), 1), 'fury grows 1 per 10 damage taken (in level-1 numbers)', h.data.fury - f0);
  h.data.fury = 100;
  const crowd = [dummy(b, h.x + 50), dummy(b, h.x - 60), dummy(b, h.x + 120)];
  const far = dummy(b, h.x + 400);
  for (const c of crowd) { c.maxHp = c.hp = 9000; }
  const hp0 = crowd.map((c) => c.hp);
  b.control[0].heroAbility = 'inkstorm';
  run(b, 0.1);
  ok(h.data.storm && h.data.fury === 0, 'full fury starts the storm and empties the meter');
  ok(h.immuneKb, 'immune to knockback while spinning');
  const x0 = h.x;
  b.control[0].heroMove = 1;
  run(b, 1);
  ok(h.x - x0 > 80, 'can move while spinning', h.x - x0);
  b.control[0].heroMove = 0;
  const ev = collect(b, 4, ['heroAbility']);
  ok(ev.some((x) => x.phase === 'end'), 'storm ends with an end event');
  ok(!h.immuneKb && !h.data.storm, 'immunity ends with the storm');
  const lost = crowd[0].maxHp - crowd[0].hp;
  const expect = HERO_ABILITIES.inkstorm.dps * HERO_ABILITIES.inkstorm.dur * (h.dmg / h.def.dmg);
  ok(lost > expect * 0.5 && lost < expect * 1.3, 'storm deals roughly dps x duration to a unit in the ring', { lost: Math.round(lost), expect: Math.round(expect) });
  ok(far.hp === far.maxHp, 'enemies outside the ring are untouched');
}

// ---------------------------------------------------------------- skills
console.log('Skills');
const maxed = (id) => ({ [id]: HERO_SKILL_BY_ID[id].max });
const mk = (skills) => arena(profile(30, skills)).b;
{
  const base = mk({}), t = base.teams[0];
  for (const sk of HERO_SKILLS) ok(!!sk.desc(1), `skill ${sk.id} has a description`);

  // sharp_nib / thick_cape
  const a = mk({}).teams[0].hero, a2 = mk(maxed('sharp_nib')).teams[0].hero;
  ok(near(a2.dmg / a.dmg, 1.3, 0.01), 'Sharp Nib: +10% damage per rank', a2.dmg / a.dmg);
  const c2 = mk(maxed('thick_cape')).teams[0].hero;
  ok(near(c2.maxHp / a.maxHp, 1.36, 0.01), 'Thick Cape: +12% health per rank', c2.maxHp / a.maxHp);

  // quick_return
  const q = mk(maxed('quick_return'));
  ok(near(q.teams[0].cfg.hero.respawn, 14 - 9, 0.01), 'Quick Return: respawn 14 s -> 5 s at rank 3');
  q.kill(q.teams[0].hero, { kind: 'true' });
  ok(near(q.teams[0].heroRespawnT, 5, 0.01), 'Quick Return: the dead hero waits 5 s', q.teams[0].heroRespawnT);
  base.kill(base.teams[0].hero, { kind: 'true' });
  ok(near(base.teams[0].heroRespawnT, 14, 0.01), 'no skill: respawn 14 s');

  // economy and spells
  const w = mk(maxed('warlord'));
  ok(w.unitCost(0, 'brawler') < mk({}).unitCost(0, 'brawler'), 'Warlord: units cost less', [w.unitCost(0, 'brawler'), mk({}).unitCost(0, 'brawler')]);
  ok(near(w.teams[0].mods.cost, 0.88, 0.001), 'Warlord: 6% per rank');
  const d = mk(maxed('drill'));
  ok(near(d.teams[0].mods.build, 1 - 0.18, 0.001) && d.buildTime(0, 'brawler') < mk({}).buildTime(0, 'brawler'), 'Drill Sergeant: units draw faster');
  const sm = mk(maxed('spell_mastery'));
  ok(near(sm.teams[0].mods.spellCd, 1 - 0.24, 0.001), 'Spell Mastery: spells recharge faster');
  const ik = mk(maxed('ink_saver'));
  ok(near(ik.teams[0].income - mk({}).teams[0].income, 0.9, 0.001), 'Ink Saver: +0.3 ink/s per rank');

  // loud voice: radius and duration
  const base2 = arena();
  const lv = arena(profile(30, maxed('loud_voice')));
  for (const [A, expR, expD, label] of [[base2, 320, 6, 'base'], [lv, 320 + 180, 6 + 6, 'Loud Voice 3']]) {
    const hero = A.h;
    const near1 = A.b.spawnUnit(0, 'brawler', { x: hero.x + expR - 20, instant: true });
    const outside = A.b.spawnUnit(0, 'brawler', { x: hero.x + expR + 40, instant: true });
    A.b.control[0].heroAbility = 'rally';
    run(A.b, 0.1);
    const b1 = near1.buffs.find((f) => f.id === 'rally');
    ok(!!b1 && near(b1.t, expD, 0.3), `Rally (${label}): ally at ${expR - 20} px is buffed for ${expD} s`, b1 && b1.t);
    ok(!outside.hasBuff('rally'), `Rally (${label}): ally at ${expR + 40} px is not buffed`);
  }

  // inspire
  const ins = arena(profile(30, maxed('inspire')));
  const ally = ins.b.spawnUnit(0, 'brawler', { x: ins.h.x + 240, instant: true });
  const faraway = ins.b.spawnUnit(0, 'brawler', { x: ins.h.x + 300, instant: true });
  run(ins.b, 1);
  ok(near(ally.mod.dmg, 1.15, 0.001), 'Inspire: allies within 260 px deal +5% per rank', ally.mod.dmg);
  ok(faraway.mod.dmg === 1, 'Inspire: not beyond 260 px');
  const noIns = arena();
  const al2 = noIns.b.spawnUnit(0, 'brawler', { x: noIns.h.x + 100, instant: true });
  run(noIns.b, 1);
  ok(al2.mod.dmg === 1, 'no Inspire: no aura');

  // lifesteal is hero-only
  const ls = arena(profile(30, maxed('lifesteal')));
  const e = dummy(ls.b, ls.h.x + 30);
  const mate = ls.b.spawnUnit(0, 'brawler', { x: ls.h.x + 20, instant: true });
  ls.h.hp = ls.h.maxHp * 0.5;
  const hp0 = ls.h.hp;
  ls.b.control[0].heroMove = 1; run(ls.b, 0.05); ls.b.control[0].heroMove = 0;
  const dealt0 = ls.b.teams[0].stats.dmgDealt;
  run(ls.b, 3);
  ok(ls.h.hp > hp0 + 5, 'Ink Thirst: the Captain heals from damage', ls.h.hp - hp0);
  ok(ls.b.teams[0].mods.lifesteal === 0, 'Ink Thirst does not leak into team lifesteal');
  mate.hp = mate.maxHp * 0.5;
  const m0 = mate.hp;
  run(ls.b, 1);
  ok(mate.hp <= m0 + 0.001, 'Ink Thirst does not heal other units');

  // whirlwind
  const ww = arena(profile(30, maxed('whirlwind')));
  ok(ww.h.data.heroCfg.stormDur === 2 && near(ww.h.data.heroCfg.furyRate, 1.5, 0.001), 'Whirlwind: +2 s storm, +50% fury rate');
  ww.h.data.fury = 100;
  ww.b.control[0].heroAbility = 'inkstorm';
  run(ww.b, 0.1);
  ok(near(ww.h.data.storm.dur, 6, 0.01), 'Whirlwind: storm lasts 6 s at rank 2', ww.h.data.storm && ww.h.data.storm.dur);
  // Fury rate, measured on fresh arenas so the storm does not interfere.
  const rate = (skills) => {
    const A = arena(profile(30, skills));
    dummy(A.b, A.h.x + 30);
    A.b.control[0].heroMove = 1; run(A.b, 0.05); A.b.control[0].heroMove = 0;
    run(A.b, 3);
    return A.h.data.fury / A.b.teams[0].stats.dmgDealt;
  };
  const r0 = rate({}), r2 = rate(maxed('whirlwind'));
  ok(near(r2 / r0, 1.5, 0.05), 'Whirlwind: fury fills 50% faster per damage dealt', r2 / r0);
}

// ---------------------------------------------------------------- data sanity
console.log('Data');
{
  const ids = new Set(HATS.map((h) => h.id));
  ok(HATS.length === 29 + 1 - 1 || HATS.length >= 29, `${HATS.length} hats defined`);
  ok(ids.size === HATS.length, 'hat ids are unique');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
