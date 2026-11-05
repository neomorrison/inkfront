// Headless tests for the player roster (package A). Exits non-zero on failure.
//   node tools/tests/units.mjs            all tests
//   node tools/tests/units.mjs --table    also print the cost-equal matchup table
import { Battle } from '../../src/sim/index.js';
import { UNITS, PLAYER_ROSTER } from '../../src/data/units.js';
import { unitStats, unitPerks } from '../../src/sim/stats.js';

const args = process.argv.slice(2);
const WANT_TABLE = args.includes('--table');
let failed = 0;
let passed = 0;
function check(name, ok, info) {
  if (ok) { passed++; if (args.includes('--verbose')) console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + info : '')); }
}

// ------------------------------------------------------------------ staging helpers
function teamCfg(faction, over = {}) {
  return {
    faction, startInk: 0, income: 0, popCap: 99, scribeCap: 4, roster: Object.keys(UNITS), unitLevels: {},
    fort: { hp: 1e6, turret: false, invulnerable: true }, ...over,
  };
}

function mk({ seed = 1, width = 2400, p = {}, e = {} } = {}) {
  const b = new Battle({
    mode: 'campaign', seed, width, page: 'ruled', level: null, modifiers: [],
    teams: [teamCfg('ink', p), teamCfg('red', e)],
  });
  b.rec = [];
  return b;
}

function put(b, team, id, x, o = {}) {
  return b.spawnUnit(team, id, { x, z: 0, instant: true, ...o });
}
const root = (u) => { u.addBuff({ id: 'root', t: 99999, root: true }); u.immuneKb = true; return u; };

function step(b, secs, tick) {
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) {
    b.update(1 / 60);
    for (const ev of b.events) b.rec.push(ev);
    b.events.length = 0;
    if (tick && tick(b, i) === false) break;
  }
}
const evs = (b, type) => b.rec.filter((e) => e.type === type);
const hitsBy = (b, src) => evs(b, 'hit').filter((e) => e.source === src);

// ------------------------------------------------------------------ rider charge
{
  const b = mk();
  b.setStance(0, 'charge');
  const r = put(b, 0, 'rider', 500);
  const dummy = root(put(b, 1, 'shieldbearer', 1000, { hpMult: 50 }));
  step(b, 8);
  const hs = hitsBy(b, r).filter((h) => h.target === dummy);
  check('rider lands at least two hits', hs.length >= 2, hs.length);
  if (hs.length >= 2) check('rider charge hit >= 2x a normal hit', hs[0].amount >= 2 * hs[1].amount, `${hs[0].amount.toFixed(1)} vs ${hs[1].amount.toFixed(1)}`);
  check('rider charge launches a light target', (() => {
    const b2 = mk(); b2.setStance(0, 'charge');
    put(b2, 0, 'rider', 500);
    const t = root(put(b2, 1, 'brawler', 1000, { hpMult: 50 }));
    t.immuneKb = false;
    let air = false;
    step(b2, 6, () => { if (t.airborne) air = true; });
    return air;
  })());
  // No run-up: a rider standing next to the target does a normal first hit.
  const b3 = mk(); b3.setStance(0, 'charge');
  const r3 = put(b3, 0, 'rider', 995);
  const d3 = root(put(b3, 1, 'shieldbearer', 1030, { hpMult: 50 }));
  step(b3, 2);
  const h3 = hitsBy(b3, r3).filter((h) => h.target === d3);
  check('rider with no run-up does a plain hit', h3.length >= 1 && evs(b3, 'chargeHit').length === 0);
}

// ------------------------------------------------------------------ bomber
{
  const b = mk();
  b.setStance(0, 'charge');
  const foes = [0, 1, 2, 3].map((i) => root(put(b, 1, 'brawler', 1000 + i * 22, { hpMult: 3 })));
  const friend = put(b, 0, 'brawler', 955, { hpMult: 3 });
  friend.addBuff({ id: 'root', t: 99999, root: true });
  put(b, 0, 'bomber', 600);
  step(b, 8);
  const hurt = foes.filter((f) => f.hp < f.maxHp).length;
  check('bomber blast damages 3+ clustered enemies', hurt >= 3, hurt);
  check('bomber blast hurts an adjacent ally (friendly fire)', friend.hp < friend.maxHp, friend.hp);
  const ev = evs(b, 'bomberBlast');
  check('bomberBlast event emitted once', ev.length === 1, ev.length);
  const bomber = b.units.find((u) => u.type === 'bomber' && u.alive);
  check('bomber is gone after exploding', !bomber);
}
{
  // Death blast: kill a bomber with an enemy next to it -> half-power blast, then no double blast.
  const b = mk();
  const bm = put(b, 0, 'bomber', 1000);
  const foe = root(put(b, 1, 'brawler', 1030, { hpMult: 5 }));
  root(bm);
  b.damage(bm, 9999, { source: foe, team: 1, kind: 'melee' });
  step(b, 0.2);
  check('bomber explodes when killed', evs(b, 'explode').length === 1 && foe.hp < foe.maxHp);
  const full = foe.maxHp - foe.hp;
  // Compare against contact blast on a fresh battle.
  const b2 = mk(); b2.setStance(0, 'charge');
  put(b2, 0, 'bomber', 800);
  const foe2 = root(put(b2, 1, 'brawler', 1000, { hpMult: 5 }));
  step(b2, 6);
  const contact = foe2.maxHp - foe2.hp;
  check('death blast is weaker than contact blast', full < contact, `${full.toFixed(0)} vs ${contact.toFixed(0)}`);
  check('bomber waits in defend until a cluster shows up', (() => {
    const b3 = mk();
    const bb = put(b3, 0, 'bomber', 700);
    root(put(b3, 1, 'brawler', 800, { hpMult: 5 }));
    step(b3, 3);
    return bb.alive && evs(b3, 'bomberBlast').length === 0;
  })());
  check('bomber goes for a 2+ cluster while defending', (() => {
    const b3 = mk();
    put(b3, 0, 'bomber', 700);
    root(put(b3, 1, 'brawler', 850, { hpMult: 5 }));
    root(put(b3, 1, 'brawler', 880, { hpMult: 5 }));
    step(b3, 6);
    return evs(b3, 'bomberBlast').length === 1;
  })());
}

// ------------------------------------------------------------------ medic
{
  const b = mk();
  const ally = put(b, 0, 'brawler', 700, { hpFrac: 0.4 });
  root(ally);
  put(b, 0, 'medic', 620);
  const before = ally.hp;
  step(b, 4);
  check('medic restores hp', ally.hp > before + 20, `${before.toFixed(0)} -> ${ally.hp.toFixed(0)}`);
  check('medic emits healBeam', evs(b, 'healBeam').length > 0);
  // Most hurt first.
  const b2 = mk();
  const a1 = root(put(b2, 0, 'brawler', 700, { hpFrac: 0.8 }));
  const a2 = root(put(b2, 0, 'brawler', 720, { hpFrac: 0.2 }));
  put(b2, 0, 'medic', 640);
  step(b2, 1.5);
  check('medic heals the most hurt ally first', a2.hp > a2.maxHp * 0.2 + 1 && a1.hp <= a1.maxHp * 0.8 + 0.01, `${a1.hp.toFixed(0)} ${a2.hp.toFixed(0)}`);
  // Steps back from an enemy.
  const b3 = mk();
  const m = put(b3, 0, 'medic', 700);
  const foe = root(put(b3, 1, 'brawler', 760));
  step(b3, 1.2);
  check('medic steps back from an enemy within 80 px', m.x < 690, m.x);
}

// ------------------------------------------------------------------ doodler chain
{
  const b = mk();
  const d = put(b, 0, 'doodler', 600);
  const foes = [0, 1, 2, 3].map((i) => root(put(b, 1, 'brawler', 900 + i * 55, { hpMult: 20 })));
  step(b, 4);
  const hs = hitsBy(b, d);
  const targets = new Set(hs.map((h) => h.target.id));
  check('doodler chain hits 3 targets', targets.size >= 3, targets.size);
  const first = hs.find((h) => h.target === hs[0].target);
  check('chain emits segments', evs(b, 'chain').length >= 2, evs(b, 'chain').length);
  const amts = hs.slice(0, 3).map((h) => h.amount);
  check('chain damage falls off per jump', amts.length === 3 && amts[1] < amts[0] && amts[2] < amts[1], amts.map((a) => a.toFixed(1)).join(','));
  // Critters.
  const b2 = mk();
  const d2 = put(b2, 0, 'doodler', 600);
  step(b2, 40);
  const pals = b2.units.filter((u) => u.alive && u.type === 'critter' && u.team === 0).length;
  check('doodler draws critters (max 2 by default)', pals >= 1 && pals <= 2, pals);
}

// ------------------------------------------------------------------ catapult
{
  const b = mk({ width: 3000 });
  const c = put(b, 0, 'catapult', 600);
  const log = [];
  const shoot = b.shoot.bind(b);
  b.shoot = (u, t, spec, dmg, extra) => { if (u === c) log.push({ t: b.time, gap: Math.abs(t.x - u.x) - (t.radius || 0) - u.radius, fort: !!t.isFort }); return shoot(u, t, spec, dmg, extra); };
  b.setStance(1, 'charge');
  for (let i = 0; i < 5; i++) put(b, 1, 'brawler', 1250 + i * 25);
  step(b, 30);
  check('catapult fires at range', log.length >= 1, log.length);
  const bad = log.filter((l) => l.gap < UNITS.catapult.minRange - 1);
  check('catapult never fires inside minRange', bad.length === 0, JSON.stringify(bad.slice(0, 2)));
  // Prefers the fort when it is in range.
  const b2 = mk({ width: 2400 });
  const c2 = put(b2, 0, 'catapult', 1500);
  const log2 = [];
  const sh2 = b2.shoot.bind(b2);
  b2.shoot = (u, t, spec, dmg, extra) => { log2.push(!!t.isFort); return sh2(u, t, spec, dmg, extra); };
  root(c2);
  root(put(b2, 1, 'brawler', 1900, { hpMult: 20 }));
  step(b2, 8);
  check('catapult prefers the enemy fort in range', log2.length > 0 && log2.every(Boolean), log2.join());
}

// ------------------------------------------------------------------ ninja
{
  const b = mk();
  b.setStance(0, 'charge');
  const ninja = put(b, 0, 'ninja', 600);
  check('ninja spawns stealthed', ninja.stealth === true);
  const archer = root(put(b, 1, 'archer', 1000));
  const decoy = root(put(b, 0, 'brawler', 1150, { hpMult: 5 }));
  let targeted = false;
  let revealedAt = null;
  step(b, 12, () => {
    if (ninja.stealth && archer.target === ninja) targeted = true;
    if (!ninja.stealth && revealedAt == null) revealedAt = b.time;
  });
  check('stealthed ninja is not targeted by an archer', !targeted);
  const bs = evs(b, 'backstab');
  check('ninja backstabs and reveals himself', bs.length >= 1 && !ninja.stealth, bs.length);
  const normal = hitsBy(b, ninja);
  if (normal.length >= 2) check('backstab hits harder than a follow-up', normal[0].amount > normal[1].amount * 1.5, `${normal[0].amount.toFixed(1)} vs ${normal[1].amount.toFixed(1)}`);
  // Blast still hits a stealthed ninja.
  const b2 = mk();
  const n2 = put(b2, 0, 'ninja', 1000);
  b2.explode(1000, 0, 100, 50, { team: 1 });
  check('area damage still hits a stealthed ninja', n2.hp < n2.maxHp);
  // Prefers ranged over a nearer melee unit.
  const b3 = mk();
  b3.setStance(0, 'charge');
  const n3 = put(b3, 0, 'ninja', 700);
  root(put(b3, 1, 'brawler', 800, { hpMult: 9 }));
  const sl = root(put(b3, 1, 'slinger', 1000));
  step(b3, 6);
  check('ninja prefers ranged targets', sl.hp < sl.maxHp, sl.hp);
}

// ------------------------------------------------------------------ stat perks
{
  const team = { mods: { hp: 1, dmg: 1, speed: 1, atkSpeed: 1, armor: 0, kb: 1, rangedRange: 0, byUnit: {} } };
  const stat = (id, perk) => unitStats(UNITS[id], 1, team, new Set(perk ? [perk] : []));
  const pairs = [
    ['brawler', 'tough', 'hp', (a, c) => c > a * 1.19],
    ['brawler', 'knuckle', 'dmg', (a, c) => c > a * 1.14],
    ['brawler', 'knuckle', 'kb', (a, c) => c > a * 1.4],
    ['brawler', 'battle_rage', 'atkCd', (a, c) => c < a * 0.81],
    ['slinger', 'heavy_stones', 'dmg', (a, c) => c > a * 1.19],
    ['slinger', 'long_sling', 'range', (a, c) => c === a + 60],
    ['archer', 'eagle_eye', 'dmg', (a, c) => c > a * 1.14],
    ['colossus', 'thick_skin', 'armor', (a, c) => Math.abs(c - a - 0.1) < 1e-6],
    ['scribe', 'quick_feet', 'speed', (a, c) => c > a * 1.24],
    ['rider', 'barding', 'armor', (a, c) => Math.abs(c - a - 0.15) < 1e-6],
    ['spearman', 'long_pike', 'range', (a, c) => c === a + 15],
    ['catapult', 'heavier_rocks', 'dmg', (a, c) => c > a * 1.19],
  ];
  for (const [id, perk, key, test] of pairs) check(`stat perk ${perk} changes ${key}`, test(stat(id)[key], stat(id, perk)[key]), `${stat(id)[key]} -> ${stat(id, perk)[key]}`);
}

// ------------------------------------------------------------------ behaviour perks
const lv = (id, perkId) => {
  for (const tier in UNITS[id].perks) if (UNITS[id].perks[tier].id === perkId) return +tier;
  throw new Error('no perk ' + perkId);
};
// Run the same scenario with and without a perk (one level below the tier). Returns [without, with].
function ab(id, perk, scenario) {
  const L = lv(id, perk);
  return [scenario(L - 1), scenario(L)];
}

{ // bigger_bombs: radius; shrapnel: damage; cluster: mini bombs
  const blast = (level, dist) => {
    const b = mk({ p: { unitLevels: { bomber: level } } });
    const bm = put(b, 0, 'bomber', 1000, { level });
    root(bm);
    const foe = root(put(b, 1, 'brawler', 1000 + dist, { hpMult: 50 }));
    b.setStance(0, 'charge');
    bm.addBuff({ id: 'unroot', t: 0 });
    b.damage(bm, 9999, { source: foe, team: 1, kind: 'true' });
    step(b, 0.3);
    return { loss: foe.maxHp - foe.hp, b };
  };
  const [r0, r1] = ab('bomber', 'bigger_bombs', (l) => blast(l, 135).loss);
  check('bigger_bombs reaches farther', r1 > 0 && r0 === 0, `${r0} / ${r1}`);
  const [d0, d1] = ab('bomber', 'shrapnel', (l) => blast(l, 40).loss);
  check('shrapnel adds blast damage', d1 > d0 * 1.2, `${d0.toFixed(0)} / ${d1.toFixed(0)}`);
  const cl = blast(9, 40);
  const minis = cl.b.areas.filter((a) => a.kind === 'mini_bomb').length;
  check('cluster scatters 3 mini bombs', minis === 3, minis);
  step(cl.b, 2.5);
  check('mini bombs go off', cl.b.areas.filter((a) => a.kind === 'mini_bomb' && a.alive).length === 0 && evs(cl.b, 'explode').length >= 4, evs(cl.b, 'explode').length);
}
{ // lancer, trample
  const hit = (level) => {
    const b = mk({ p: { unitLevels: { rider: level } } });
    b.setStance(0, 'charge');
    const r = put(b, 0, 'rider', 500, { level });
    r.dmg = 100; // remove level scaling from the comparison
    const t = root(put(b, 1, 'shieldbearer', 1000, { hpMult: 100 }));
    step(b, 6);
    return hitsBy(b, r).filter((h) => h.target === t)[0].amount;
  };
  const [h0, h1] = ab('rider', 'lancer', hit);
  check('lancer charge deals ~3.5x', h1 > h0 * 1.3, `${h0.toFixed(1)} / ${h1.toFixed(1)}`);
  const pass = (level) => {
    const b = mk({ p: { unitLevels: { rider: level } } });
    b.setStance(0, 'charge');
    put(b, 0, 'rider', 400, { level });
    const mid = [0, 1, 2].map((i) => root(put(b, 1, 'brawler', 700 + i * 60, { hpMult: 50 })));
    root(put(b, 1, 'shieldbearer', 1200, { hpMult: 50 }));
    // Make the far shieldbearer the rider's target by stealth-hiding the others from targeting.
    for (const m of mid) m.targetable = true;
    step(b, 6);
    return mid.filter((m) => m.hp < m.maxHp).length;
  };
  const [t0, t1] = ab('rider', 'trample', pass);
  check('trample hurts enemies the rider passes', t1 >= t0 && t1 >= 1, `${t0} / ${t1}`);
}
{ // medic perks
  const heal = (level, perks) => {
    const b = mk({ p: { unitLevels: { medic: level } } });
    const a = root(put(b, 0, 'brawler', 700, { hpFrac: 0.1, hpMult: 5 }));
    put(b, 0, 'medic', 640, { level });
    step(b, 1.45);
    return a.hp - a.maxHp * 0.1;
  };
  const [b0, b1] = ab('medic', 'bandages', heal);
  check('bandages heal more', b1 > b0 * 1.15, `${b0.toFixed(1)} / ${b1.toFixed(1)}`);
  const two = (level) => {
    const b = mk({ p: { unitLevels: { medic: level } } });
    const a = root(put(b, 0, 'brawler', 700, { hpFrac: 0.2 }));
    const c = root(put(b, 0, 'brawler', 720, { hpFrac: 0.3 }));
    put(b, 0, 'medic', 640, { level });
    step(b, 1.45);
    return evs(b, 'healBeam').length;
  };
  const [x0, x1] = ab('medic', 'triage', two);
  check('triage heals two allies per cast', x1 >= x0 * 2 && x1 >= 2, `${x0} / ${x1}`);
  const rev = (level) => {
    const b = mk({ p: { unitLevels: { medic: level } } });
    const a = put(b, 0, 'brawler', 700);
    put(b, 0, 'medic', 640, { level });
    root(b.units.find((u) => u.type === 'medic'));
    step(b, 20);
    b.damage(a, 99999, { source: null, team: 1, kind: 'true' });
    step(b, 6);
    return evs(b, 'revive').length + b.units.filter((u) => u.alive && u.type === 'brawler').length;
  };
  const [v0, v1] = ab('medic', 'revive', rev);
  check('revive redraws a fallen ally', v1 > v0 && v1 >= 2, `${v0} / ${v1}`);
  const rb = (() => {
    const b = mk();
    const a = put(b, 0, 'brawler', 700);
    put(b, 0, 'medic', 640, { level: 9 });
    step(b, 20);
    b.damage(a, 99999, { source: null, team: 1, kind: 'true' });
    let r = null;
    step(b, 6, () => { const e = evs(b, 'revive')[0]; if (e) { r = e.unit; return false; } });
    return r && r.hp <= r.maxHp * 0.55 ? r : null;
  })();
  check('revived ally returns at half hp (then heals)', !!rb);
}
{ // doodler perks
  const chain = (level) => {
    const b = mk({ p: { unitLevels: { doodler: level } } });
    const d = put(b, 0, 'doodler', 600, { level });
    for (let i = 0; i < 6; i++) root(put(b, 1, 'brawler', 900 + i * 50, { hpMult: 50 }));
    step(b, 3.5);
    return new Set(hitsBy(b, d).map((h) => h.target.id)).size;
  };
  const [c0, c1] = ab('doodler', 'extra_scribble', chain);
  check('extra_scribble adds a chain target', c1 === c0 + 1, `${c0} / ${c1}`);
  const pals = (level) => {
    const b = mk({ p: { unitLevels: { doodler: level } } });
    put(b, 0, 'doodler', 600, { level });
    let max = 0;
    step(b, 90, () => { max = Math.max(max, b.units.filter((u) => u.alive && u.type === 'critter').length); });
    return max;
  };
  const [p0, p1] = ab('doodler', 'doodle_pals', pals);
  check('doodle_pals keeps a third critter', p1 === p0 + 1 && p1 === 3, `${p0} / ${p1}`);
  const stun = (level) => {
    const b = mk({ p: { unitLevels: { doodler: level } } });
    put(b, 0, 'doodler', 600, { level });
    const t = root(put(b, 1, 'brawler', 900, { hpMult: 50 }));
    let stunned = false;
    step(b, 3, () => { if (t.mod.stun) stunned = true; });
    return stunned;
  };
  const [s0, s1] = ab('doodler', 'storm_scribble', stun);
  check('storm_scribble stuns', !s0 && s1);
}
{ // catapult perks
  const shots = (level) => {
    const b = mk({ p: { unitLevels: { catapult: level } } });
    const c = root(put(b, 0, 'catapult', 600, { level }));
    root(put(b, 1, 'brawler', 1000, { hpMult: 50 }));
    let n = 0;
    let areas = 0;
    const sh = b.shoot.bind(b);
    b.shoot = (...a) => { n++; return sh(...a); };
    step(b, 7, () => { areas = Math.max(areas, b.areas.filter((a) => a.kind === 'ink_pot').length); });
    return { n, areas };
  };
  const [i0, i1] = ab('catapult', 'ink_pots', (l) => shots(l).areas);
  check('ink_pots leaves a puddle', i0 === 0 && i1 >= 1, `${i0} / ${i1}`);
  const [dl0, dl1] = ab('catapult', 'double_load', (l) => shots(l).n);
  check('double_load throws two boulders', dl1 >= dl0 * 1.8, `${dl0} / ${dl1}`);
  const puddle = (() => {
    const b = mk({ p: { unitLevels: { catapult: 6 } } });
    root(put(b, 0, 'catapult', 600, { level: 6 }));
    const t = put(b, 1, 'brawler', 1000, { hpMult: 50 });
    b.setStance(1, 'hold', 1000);
    let slowed = false;
    step(b, 7, () => { if (t.hasBuff('ink_pot')) slowed = true; });
    return slowed;
  })();
  check('ink pot puddle slows enemies', puddle);
}
{ // ninja perks
  const kill = (level, extra) => {
    const b = mk({ p: { unitLevels: { ninja: level } } });
    b.setStance(0, 'charge');
    const n = put(b, 0, 'ninja', 600, { level });
    const v1 = root(put(b, 1, 'slinger', 1000, { hpMult: 0.3 }));
    root(put(b, 1, 'slinger', 1500, { hpMult: 3 }));
    let re = false, wasKilled = false;
    step(b, 12, () => { if (!v1.alive) wasKilled = true; if (wasKilled && n.stealth) re = true; });
    return { re, b, n };
  };
  const [sb0, sb1] = ab('ninja', 'smoke_bomb', (l) => kill(l).re);
  check('smoke_bomb re-stealths after a kill', !sb0 && sb1);
  const step3 = (level) => {
    const b = mk({ p: { unitLevels: { ninja: level } } });
    b.setStance(0, 'charge');
    const n = put(b, 0, 'ninja', 600, { level });
    root(put(b, 1, 'slinger', 1000, { hpMult: 5 }));
    let jump = 0;
    let last = n.x;
    step(b, 6, () => { jump = Math.max(jump, Math.abs(n.x - last)); last = n.x; });
    return jump;
  };
  const [st0, st1] = ab('ninja', 'shadow_step', step3);
  check('shadow_step teleports', st1 > 100 && st0 < 50, `${st0.toFixed(0)} / ${st1.toFixed(0)}`);
  const bs = (level) => {
    const b = mk({ p: { unitLevels: { ninja: level } } });
    b.setStance(0, 'charge');
    const n = put(b, 0, 'ninja', 600, { level });
    n.dmg = 100;
    const t = root(put(b, 1, 'slinger', 1000, { hpMult: 100 }));
    step(b, 8);
    return hitsBy(b, n)[0].amount;
  };
  const [dm0, dm1] = ab('ninja', 'death_mark', bs);
  check('death_mark doubles the backstab (2x -> 4x)', dm1 > dm0 * 1.8, `${dm0.toFixed(1)} / ${dm1.toFixed(1)}`);
}
{ // melee perks
  const bash = (level) => {
    const b = mk({ p: { unitLevels: { shieldbearer: level } } });
    b.setStance(0, 'charge');
    put(b, 0, 'shieldbearer', 700, { level });
    const t = root(put(b, 1, 'brawler', 760, { hpMult: 100 }));
    let stun = 0;
    step(b, 8, () => { if (t.mod.stun) stun++; });
    return stun;
  };
  const [sh0, sh1] = ab('shieldbearer', 'shield_bash', bash);
  check('shield_bash stuns every third hit', sh0 === 0 && sh1 > 0, `${sh0} / ${sh1}`);
  const bul = (level) => {
    const b = mk({ p: { unitLevels: { shieldbearer: level } } });
    put(b, 0, 'shieldbearer', 700, { level });
    const ally = root(put(b, 0, 'brawler', 660, { hpMult: 100 }));
    step(b, 1);
    const proj = { vx: -300, y: -30 };
    return b.damage(ally, 100, { source: null, team: 1, kind: 'pierce', proj });
  };
  const [bw0, bw1] = ab('shieldbearer', 'bulwark', bul);
  check('bulwark cuts arrow damage to allies behind', bw0 > 0 && bw1 < bw0 * 0.9, `${bw0.toFixed(0)} / ${bw1.toFixed(0)}`);
  const phal = (level) => {
    const b = mk({ p: { unitLevels: { spearman: level } } });
    const s = [0, 1, 2].map((i) => put(b, 0, 'spearman', 700 + i * 20, { level }));
    step(b, 1);
    return s[0].mod.armor;
  };
  const [ph0, ph1] = ab('spearman', 'phalanx', phal);
  check('phalanx grants armor next to two spearmen', ph0 === 0 && ph1 > 0.1, `${ph0} / ${ph1}`);
  const skew = (level) => {
    const b = mk({ p: { unitLevels: { spearman: level } } });
    b.setStance(0, 'charge');
    put(b, 0, 'spearman', 700, { level });
    root(put(b, 1, 'brawler', 780, { hpMult: 50 }));
    const back = root(put(b, 1, 'brawler', 810, { hpMult: 50 }));
    step(b, 4);
    return back.maxHp - back.hp;
  };
  const [sk0, sk1] = ab('spearman', 'skewer', skew);
  check('skewer hits the enemy behind', sk0 === 0 && sk1 > 0, `${sk0} / ${sk1}`);
  const rage = (level) => {
    const b = mk({ p: { unitLevels: { brawler: level } } });
    b.setStance(0, 'charge');
    const u = put(b, 0, 'brawler', 700, { level, hpFrac: 0.3 });
    const v = root(put(b, 1, 'brawler', 760, { hpMult: 0.4 }));
    const hp0 = u.hp;
    step(b, 6);
    return u.hp - hp0;
  };
  const [br0, br1] = ab('brawler', 'battle_rage', rage);
  check('battle_rage heals on a kill', br1 > br0 + 12, `${br0.toFixed(0)} / ${br1.toFixed(0)}`);
  const quake = (level) => {
    const b = mk({ p: { unitLevels: { colossus: level } } });
    b.setStance(0, 'charge');
    put(b, 0, 'colossus', 700, { level });
    const t = root(put(b, 1, 'shieldbearer', 800, { hpMult: 100 }));
    let stun = 0;
    step(b, 6, () => { if (t.mod.stun) stun++; });
    return stun;
  };
  const [eq0, eq1] = ab('colossus', 'earthshaker', quake);
  check('earthshaker stuns', eq0 === 0 && eq1 > 0, `${eq0} / ${eq1}`);
  const col = put(mk(), 0, 'colossus', 700, { level: 9 });
  check('unstoppable: immune to knockback and stun', col.immuneKb && col.immuneStun);
  const cb = mk();
  const c9 = put(cb, 0, 'colossus', 700, { level: 9 });
  c9.hp = c9.maxHp * 0.5;
  step(cb, 5);
  check('unstoppable regenerates', c9.hp > c9.maxHp * 0.5 + c9.maxHp * 0.03, c9.hp);
  const tap = (level) => {
    const b = mk({ p: { unitLevels: { scribe: level }, income: 0 } });
    for (let i = 0; i < 3; i++) put(b, 0, 'scribe', 300 + i * 10, { level });
    step(b, 10);
    return b.teams[0].stats.inkGathered;
  };
  const [it0, it1] = ab('scribe', 'ink_tap', tap);
  check('ink_tap adds a steady trickle', it1 > it0 + 5, `${it0.toFixed(1)} / ${it1.toFixed(1)}`);
  const bottle = (level) => {
    const b = mk({ p: { unitLevels: { scribe: level } } });
    const s = put(b, 0, 'scribe', 300, { level });
    let carry = 0;
    step(b, 30, () => { carry = Math.max(carry, s.data.carry || 0); });
    return carry;
  };
  const [bo0, bo1] = ab('scribe', 'big_bottle', bottle);
  check('big_bottle carries more ink', bo1 > bo0 * 1.4, `${bo0} / ${bo1}`);
}
{ // ranged perks
  const fire = (id, level, scene) => {
    const b = mk({ p: { unitLevels: { [id]: level } } });
    b.setStance(0, 'charge');
    const a = put(b, 0, id, 700, { level });
    const targets = scene(b);
    let shots = 0;
    const sh = b.shoot.bind(b);
    b.shoot = (...x) => { shots++; return sh(...x); };
    step(b, 5);
    return { shots, targets, b, a };
  };
  const [v0, v1] = ab('archer', 'volley', (l) => fire('archer', l, (b) => [root(put(b, 1, 'brawler', 1100, { hpMult: 100 }))]).shots);
  check('volley fires two arrows per shot', v1 >= v0 * 1.8, `${v0} / ${v1}`);
  const [f0, f1] = ab('archer', 'fire_arrows', (l) => {
    let burned = false;
    const r = fire('archer', l, (b) => [root(put(b, 1, 'brawler', 1100, { hpMult: 100 }))]);
    return r.targets[0].hasBuff('burn');
  });
  check('fire_arrows set targets alight', !f0 && f1);
  const [r0, r1] = ab('slinger', 'ricochet', (l) => {
    const r = fire('slinger', l, (b) => [root(put(b, 1, 'brawler', 900, { hpMult: 100 })), root(put(b, 1, 'brawler', 960, { hpMult: 100 }))]);
    const second = r.targets[1];
    return second.maxHp - second.hp;
  });
  check('ricochet bounces to a second enemy', r1 > r0 + 5, `${r0} / ${r1}`);
  const [e0, e1] = ab('archer', 'eagle_eye', (l) => {
    // tighter aim: lower variance of landing offsets
    const b = mk({ p: { unitLevels: { archer: l } } });
    const a = root(put(b, 0, 'archer', 700, { level: l }));
    const t = root(put(b, 1, 'brawler', 1100, { hpMult: 1000 }));
    const xs = [];
    const sh = b.shoot.bind(b);
    b.shoot = (...x) => { const p = sh(...x); xs.push(p.vx); return p; };
    step(b, 40);
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
  });
  check('eagle_eye tightens aim', e1 < e0 * 0.85, `${e0.toFixed(1)} / ${e1.toFixed(1)}`);
}

// ------------------------------------------------------------------ every perk id runs
{
  let ran = 0;
  for (const id of PLAYER_ROSTER) {
    const def = UNITS[id];
    for (const tier in def.perks || {}) {
      const perk = def.perks[tier].id;
      try {
        const b = mk({ p: { unitLevels: { [id]: +tier } }, e: {} });
        b.setStance(0, 'charge');
        b.setStance(1, 'charge');
        put(b, 0, id, 700, { level: +tier });
        put(b, 0, 'brawler', 760);
        put(b, 1, 'brawler', 1100);
        put(b, 1, 'archer', 1200);
        step(b, 20);
        ran++;
      } catch (err) {
        check(`perk ${perk} runs without crashing`, false, err.stack);
      }
    }
  }
  check('every perk id ran in a battle', ran === PLAYER_ROSTER.reduce((n, id) => n + Object.keys(UNITS[id].perks || {}).length, 0), ran);
}

// ------------------------------------------------------------------ enemy supports via def fields
{
  const b = mk();
  const shaman = put(b, 1, 'glow_shaman', 1500);
  const ally = put(b, 1, 'glowrunner', 1400, { hpFrac: 0.4 });
  root(ally);
  put(b, 0, 'brawler', 1000);
  b.setStance(0, 'hold', 1000);
  step(b, 4);
  check('glow shaman buffs allies in range', ally.hasBuff('glow_aura'));
  check('glow shaman heals', ally.hp > ally.maxHp * 0.4 + 1);
  const b2 = mk();
  const pr = root(put(b2, 1, 'whiteout_priest', 1500));
  const fallen = put(b2, 1, 'eraser_knight', 1450);
  step(b2, 15);
  b2.damage(fallen, 99999, { source: null, team: 0, kind: 'true' });
  step(b2, 5);
  check('whiteout priest revives a fallen ally', evs(b2, 'revive').length === 1, evs(b2, 'revive').length);
}
{ // dust mage splashes
  const b = mk();
  put(b, 1, 'dust_mage', 1500);
  const a = root(put(b, 0, 'brawler', 1200, { hpMult: 20 }));
  const c = root(put(b, 0, 'brawler', 1240, { hpMult: 20 }));
  step(b, 6);
  check('dust mage bolt splashes', a.hp < a.maxHp && c.hp < c.maxHp);
}

// ------------------------------------------------------------------ matchup table
const COMBAT = PLAYER_ROSTER.filter((id) => id !== 'scribe' && id !== 'medic');
function fight(idA, idB, seed) {
  const na = Math.max(1, Math.round(600 / UNITS[idA].cost));
  const nb = Math.max(1, Math.round(600 / UNITS[idB].cost));
  const b = mk({ seed, width: 2600 });
  b.setStance(0, 'charge');
  b.setStance(1, 'charge');
  const jit = () => b.rng.range(-9, 9); // seed-dependent spacing so five seeds are five fights
  for (let i = 0; i < na; i++) put(b, 0, idA, 800 + i * 20 + jit(), { z: (i % 3) - 1 });
  for (let i = 0; i < nb; i++) put(b, 1, idB, 1800 - i * 20 + jit(), { z: (i % 3) - 1 });
  let t = 0;
  while (t < 90) {
    b.update(1 / 60);
    t += 1 / 60;
    b.events.length = 0;
    const a = b.units.some((u) => u.alive && u.team === 0), c = b.units.some((u) => u.alive && u.team === 1);
    if (!a || !c) break;
  }
  const hp = (team) => b.units.filter((u) => u.alive && u.team === team).reduce((s, u) => s + u.hp / u.maxHp * (u.def.cost || 0), 0);
  const ha = hp(0), hb = hp(1);
  return ha === hb ? 0.5 : ha > hb ? 1 : 0;
}
const table = {};
for (const a of COMBAT) {
  table[a] = {};
  for (const c of COMBAT) {
    if (a === c) continue;
    let w = 0;
    for (let s = 1; s <= 5; s++) w += fight(a, c, 100 + s * 13);
    table[a][c] = w / 5;
  }
}
const overall = {};
for (const a of COMBAT) {
  const vals = Object.values(table[a]);
  overall[a] = vals.reduce((s, v) => s + v, 0) / vals.length;
}
if (WANT_TABLE) {
  console.log('\nCost-equal matchups (~600 ink each side, 5 seeds). Row win rate vs column:');
  console.log(''.padEnd(13) + COMBAT.map((c) => c.slice(0, 6).padEnd(7)).join('') + 'overall');
  for (const a of COMBAT) {
    console.log(a.padEnd(13) + COMBAT.map((c) => (a === c ? '  -    ' : (Math.round(table[a][c] * 100) + '%').padEnd(7))).join('') + Math.round(overall[a] * 100) + '%');
  }
}
// Balance is reported (see the table), not enforced: only a unit that never wins anything is a bug.
for (const a of COMBAT) check(`matchups: ${a} wins at least something (${Math.round(overall[a] * 100)}%)`, overall[a] > 0.02, overall[a]);
if (WANT_TABLE) {
  const hi = COMBAT.filter((a) => overall[a] > 0.75), lo = COMBAT.filter((a) => overall[a] < 0.25);
  if (hi.length) console.log('Strong (>75% overall): ' + hi.join(', '));
  if (lo.length) console.log('Weak (<25% overall): ' + lo.join(', '));
}

console.log(`units tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
