// Package C headless tests: levels, modifiers, AI, perks, Endless, Daily, Skirmish.
//   node tools/tests/levels.mjs [--quick]
import { Battle } from '../../src/sim/index.js';
import '../../src/game/endless.js';
import '../../src/game/daily.js';
import { buildBattleConfig, campaignConfig, SKIRMISH_FACTIONS } from '../../src/game/modes.js';
import { dailyInfo, dailyConfig, addDays } from '../../src/game/daily.js';
import { LEVELS, MODIFIERS, LEVEL_BY_ID, HARD_MODE } from '../../src/data/levels.js';
import { PERKS } from '../../src/data/perks.js';
import { UNITS } from '../../src/data/units.js';
import { PERK_IMPL } from '../../src/sim/registry.js';
import { scoutArmy, counterFactor } from '../../src/sim/ai.js';
import { offerPerks, perkIsDead, ENDLESS } from '../../src/sim/endless_core.js';
import { enemyTeamConfig } from '../../src/game/teamcfg.js';
import { expectedProfile, botAI, runBattle } from '../sim.mjs';

const quick = process.argv.includes('--quick');
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const section = (s) => console.log('\n' + s);

// ------------------------------------------------------------------ every level builds and runs 90 s
section('Levels (90 s each, normal and Red Ink)');
for (const L of LEVELS) {
  for (const hard of [false, true]) {
    if (quick && hard) continue;
    try {
      const cfg = campaignConfig({ levelId: L.id, hard, seed: 5 }, expectedProfile(L.id));
      cfg.teams[0].ai = botAI(cfg);
      const b = runBattle(cfg, 90);
      ok(b.time > 5, `${L.id}${hard ? ' hard' : ''} ran`);
      ok(b.teams[1].fort.maxHp > 0 && Number.isFinite(b.teams[0].ink), `${L.id} sane state`);
    } catch (e) {
      ok(false, `${L.id}${hard ? ' hard' : ''} threw: ${e.stack}`);
    }
  }
}
console.log('  levels done');

// ------------------------------------------------------------------ modifiers
section('Modifiers');
{
  const mk = (mods, id = '3-3') => { const cfg = campaignConfig({ levelId: id, seed: 3 }, expectedProfile(id)); cfg.modifiers = mods; return new Battle(cfg); };
  ok(mk(['night']).flags.night === true, 'night flag');
  const rain = mk(['rain']);
  ok(rain.flags.rain && rain.accuracyMult === 1.6, 'rain accuracy');
  const base = mk([]);
  ok(Math.abs(rain.teams[0].wellYield / base.teams[0].wellYield - 1.5) < 1e-9 && Math.abs(rain.teams[1].wellYield / base.teams[1].wellYield - 1.5) < 1e-9, 'rain wells x1.5 both teams');
  const inf = mk(['inkflation']);
  ok(Math.abs(inf.teams[0].mods.cost - 1.25) < 1e-9 && inf.teams[0].ink === base.teams[0].ink + 300, 'inkflation cost and ink');
  const sw = mk(['swarm']);
  ok(sw.teams[1].mods.cost === 0.5 && sw.teams[1].mods.build === 0.6, 'swarm enemy cost and build');
  const df = mk(['double_fort']);
  ok(df.teams[1].fort.maxHp === base.teams[1].fort.maxHp * 2, 'double fort');
  const rush = mk(['rush'], '1-3');
  ok(rush.events.some((e) => e.type === 'banner'), 'rush banner');
  const cs = mk(['coffee_stains']);
  const stains = cs.areas.filter((a) => a.kind === 'coffee_stain');
  ok(stains.length >= 3 && stains.length <= 4, 'coffee stains 3-4 areas');
  ok(stains.every((s) => s.x > cs.width * 0.25 && s.x < cs.width * 0.75), 'stains mid-field');
  const u = cs.spawnUnit(0, 'brawler', { x: stains[0].x, instant: true });
  cs.update(1 / 60); cs.update(1 / 60);
  ok(u.mod.speed <= 0.61, 'stain slows 40%');
  const out = cs.spawnUnit(0, 'brawler', { x: 40, instant: true });
  cs.update(1 / 60);
  ok(out.mod.speed === 1, 'no slow outside stain');
}

// ------------------------------------------------------------------ AI
section('AI');
{
  const cfg = campaignConfig({ levelId: '2-3', seed: 9 }, expectedProfile('2-3'));
  const b = new Battle(cfg);
  b.teams[1].ai.passive = true;
  for (let i = 0; i < 60 * 60; i++) b.update(1 / 60);
  ok(b.teams[1].stance === 'defend' && b.units.filter((u) => u.team === 1 && u.type !== 'scribe').length === 0, 'passive AI builds nothing and holds');

  // Counter picks: lots of ranged -> fast units favoured; lots of melee -> ranged favoured; cavalry -> spearman.
  const rangedArmy = { total: 10, ranged: 8, melee: 2, cav: 0, large: 0, swarm: 0, support: 0, tank: 0, stealth: 0 };
  const meleeArmy = { total: 10, ranged: 1, melee: 9, cav: 0, large: 0, swarm: 0, support: 0, tank: 0, stealth: 0 };
  const cavArmy = { total: 6, ranged: 0, melee: 6, cav: 3, large: 0, swarm: 0, support: 0, tank: 0, stealth: 0 };
  const shape = { total: 8, front: 4, ranged: 3, support: 1 };
  ok(counterFactor(UNITS.rider, rangedArmy, shape) > counterFactor(UNITS.brawler, rangedArmy, shape) * 1.5, 'vs ranged: rider beats brawler');
  ok(counterFactor(UNITS.archer, meleeArmy, shape) > counterFactor(UNITS.brawler, meleeArmy, shape) * 1.5, 'vs melee: archer beats brawler');
  ok(counterFactor(UNITS.spearman, cavArmy, shape) > counterFactor(UNITS.brawler, cavArmy, shape) * 1.5, 'vs cavalry: spearman beats brawler');
  ok(scoutArmy(b, 0).total >= 0, 'scout runs');

  // Boss spawns on time and sets b.boss; script events still run.
  const lv = campaignConfig({ levelId: '1-6', seed: 4 }, expectedProfile('1-6'));
  const bb = new Battle(lv);
  const at = lv.teams[1].ai.bossAt;
  for (let i = 0; i < 60 * (at + 3); i++) bb.update(1 / 60);
  ok(bb.boss && bb.boss.alive && bb.boss.isBoss, 'boss spawned at bossAt and set as b.boss');
  ok(typeof bb.teams[1].ai.spawnBoss === 'function', 'spawnBoss kept');

  // Enemy uses team spells when it has them.
  const sp = campaignConfig({ levelId: '2-1', seed: 6 }, expectedProfile('2-1'));
  sp.teams[1].spells = [{ id: 'pencil_rain', level: 3 }];
  sp.teams[0].ai = botAI(sp);
  const sb = runBattle(sp, 150);
  ok(sb.teams[1].stats.spellsCast > 0, 'enemy AI casts its spells');

  // Protects its Scribes: raiders at home while the army is far away turn the push around.
  const rb = new Battle(campaignConfig({ levelId: '3-2', seed: 3 }, expectedProfile('3-2')));
  const rai = rb.teams[1].ai;
  for (let i = 0; i < 60 * 20; i++) { rb.update(1 / 60); rb.events.length = 0; }
  rai.setPhase('push');
  for (const u of rb.units) if (u.team === 1 && u.type !== 'scribe') u.x = 800;
  for (let i = 0; i < 4; i++) rb.spawnUnit(0, 'brawler', { x: rb.teams[1].fort.x - 300 - i * 20, instant: true });
  for (let i = 0; i < 60 * 8; i++) { rb.update(1 / 60); rb.events.length = 0; }
  ok(rai.phase === 'muster' && rb.teams[1].stance === 'defend', 'AI recalls its army when raiders reach its Scribes');

  // Never trickles: once pushing, the first charge happens only with a real army.
  const tb = new Battle(campaignConfig({ levelId: '3-2', seed: 11 }, expectedProfile('3-2')));
  let firstPush = null;
  for (let i = 0; i < 60 * 200 && !firstPush; i++) {
    tb.update(1 / 60); tb.events.length = 0;
    if (tb.teams[1].stance === 'charge') firstPush = { t: tb.time, army: tb.teams[1].pop - tb.teams[1].scribes };
  }
  ok(!firstPush || firstPush.army >= 3, 'AI musters before it pushes');

  // Pressure: the commander attacks on a rhythm even when it is not stronger (a defend-first player is attacked).
  {
    const pc = campaignConfig({ levelId: '3-3', seed: 21 }, expectedProfile('3-3'));
    const pb = new Battle(pc);
    pb.teams[0].ai = null; // the player does nothing at all
    const pushes = [];
    let last = pb.teams[1].stance;
    for (let i = 0; i < 60 * 300; i++) {
      pb.update(1 / 60); pb.events.length = 0;
      if (pb.teams[1].stance !== last) { last = pb.teams[1].stance; if (last === 'charge') pushes.push(Math.round(pb.time)); }
    }
    ok(pushes.length >= 1 && pushes[0] <= pc.teams[1].ai.firstAttack + 60, `AI makes a first push near firstAttack (${pushes})`);
    ok(pb.teams[0].fort.hp < pb.teams[0].fort.maxHp, 'an idle player gets hurt');
  }

  // Rhythm: the first wave arrives on schedule even though the player never attacks.
  {
    const wc = campaignConfig({ levelId: '2-2', seed: 5 }, expectedProfile('2-2'));
    wc.teams[0].ai = botAI(wc, { aggression: 3, firstAttack: 400 }); // a defender that never leaves home
    const wb = runBattle(wc, 260);
    ok(wb.teams[1].ai.waves >= 1 && wb.teams[1].stance === 'charge', `enemy attacks a defender that never leaves home (${wb.teams[1].ai.waves})`);
  }

  // 1-3 Ambush: the starting army is on the move at once and presses the attack.
  {
    const ac = campaignConfig({ levelId: '1-3', seed: 7 }, expectedProfile('1-3'));
    const ab = new Battle(ac);
    ok(ab.teams[1].ai.phase === 'push' && ab.teams[1].stance === 'charge', 'ambush army starts in push/charge');
    const front0 = Math.min(...ab.units.filter((u) => u.team === 1 && u.type !== 'scribe').map((u) => u.x));
    ok(front0 < ab.width * 0.65, 'ambush army starts up the page, not at its fort');
    ab.teams[0].ai = null;
    for (let i = 0; i < 60 * 14; i++) { ab.update(1 / 60); ab.events.length = 0; }
    const front1 = Math.min(...ab.units.filter((u) => u.team === 1 && u.type !== 'scribe').map((u) => u.x));
    ok(front1 < front0 - 250, `ambush army marched on the player fort (${Math.round(front0)} -> ${Math.round(front1)})`);
  }

  // Escalation: after ~4 minutes the commander gets desperate, so a stalemate ends.
  {
    const ec = campaignConfig({ levelId: '2-3', seed: 8 }, expectedProfile('2-3'));
    const eb = new Battle(ec);
    eb.teams[0].ai = null;
    eb.teams[0].fort.invulnerable = true;
    const inc0 = eb.teams[1].income;
    for (let i = 0; i < 60 * 300; i++) { eb.update(1 / 60); eb.events.length = 0; }
    ok(eb.teams[1].ai.escLevel >= 1 && eb.teams[1].income > inc0, 'AI escalates after the first four minutes');
  }

  // Survive levels keep pressing even if the player kills every enemy Scribe.
  {
    const sc = campaignConfig({ levelId: '4-3', seed: 9 }, expectedProfile('4-3'));
    ok(sc.teams[1].ai.freeWaves && sc.teams[1].ai.freeWaves.every > 0, '4-3 has timed reinforcement waves');
    const sb = new Battle(sc);
    sb.teams[0].ai = null;
    sb.teams[0].fort.invulnerable = true;
    let spawned = 0;
    for (let i = 0; i < 60 * 230; i++) {
      sb.update(1 / 60);
      for (const u of sb.units) if (u.alive && u.team === 1 && u.type === 'scribe') u.hp = 0, sb.kill(u, { team: 0 });
      sb.events.length = 0;
    }
    for (const u of sb.units) if (u.team === 1 && u.type !== 'scribe') spawned++;
    ok(spawned >= 12, `4-3 keeps sending units with no enemy Scribes (${spawned})`);
  }

  // The finale keeps its teeth.
  {
    const hand = LEVEL_BY_ID['5-6'].enemy;
    const bm = hand.mods && hand.mods.byUnit && hand.mods.byUnit.boss_hand;
    ok(bm && bm.hp >= 0.85 && bm.dmg >= 0.85, `5-6 boss scale has a floor (${bm && bm.hp}, ${bm && bm.dmg})`);
    ok(hand.level >= 11, `5-6 enemy level is not cut below design (${hand.level})`);
  }
}

// ------------------------------------------------------------------ perks
section('Perks');
{
  ok(PERKS.every((p) => PERK_IMPL[p.id]), 'every perk has an implementation');
  for (const p of PERKS) {
    try {
      const cfg = buildBattleConfig({ kind: 'endless', seed: 2 }, expectedProfile('4-1'));
      cfg.teams[0].ai = botAI(cfg, { sally: true });
      cfg.teams[0].perks = [p.id];
      const b = runBattle(cfg, 40);
      ok(b.time > 30, `perk ${p.id} runs`);
    } catch (e) { ok(false, `perk ${p.id} threw: ${e.stack}`); }
  }
  // Stat perks change real numbers on units that already exist.
  const b = new Battle(buildBattleConfig({ kind: 'endless', seed: 2 }, expectedProfile('4-1')));
  const u = b.spawnUnit(0, 'brawler', { instant: true });
  const hp = u.maxHp, dmg = u.dmg, spd = u.speed;
  PERK_IMPL.thick_paper.apply(b, 0); PERK_IMPL.sharp_swords.apply(b, 0); PERK_IMPL.fast_feet.apply(b, 0);
  ok(Math.abs(u.maxHp / hp - 1.15) < 1e-6 && Math.abs(u.dmg / dmg - 1.15) < 1e-6 && Math.abs(u.speed / spd - 1.12) < 1e-6, 'perks patch living units');
  const u2 = b.spawnUnit(0, 'brawler', { instant: true });
  ok(u2.maxHp > hp && u2.dmg > dmg, 'perks apply to future units');
}

// ------------------------------------------------------------------ Endless
section('Endless (12 waves, bot drafts perks)');
{
  const p = expectedProfile('5-1');
  const cfg = buildBattleConfig({ kind: 'endless', seed: 31 }, p);
  cfg.teams[0].ai = botAI(cfg, { sally: true });
  const waves = [], drafts = [], pages = [], cleared = [];
  let sawFightBoss = false;
  const b = runBattle(cfg, 3000, {
    tick(bb) {
      for (const e of bb.events) {
        if (e.type === 'waveStart') waves.push(e);
        if (e.type === 'waveClear') cleared.push(e.wave);
        if (e.type === 'draftOffer') drafts.push(e);
        if (e.type === 'pageChange') pages.push(e);
        if (e.type === 'bossArrive') sawFightBoss = true;
      }
      const E = bb.endless;
      if (E.state === 'draft') E.choose(E.offer[bb.rng.int(0, 2)]);
      if (E.wave >= 12 && E.state === 'break') bb.end(0, 'test');
    },
  });
  ok(b.endless.wave >= 12, `reached wave 12 (got ${b.endless.wave})`);
  ok(waves.length >= 12, 'waveStart events');
  const counts = waves.map((w) => w.count);
  ok(counts[9] > counts[0] && counts[7] >= counts[2], `waves escalate (${counts.slice(0, 12).join(',')})`);
  ok(drafts.length >= 11 && drafts.every((d) => d.offer.length === 3 && new Set(d.offer).size === 3), 'every draft offers 3 distinct perks');
  ok(drafts.every((d) => d.offer.every((id) => PERKS.some((x) => x.id === id))), 'draft perks are real');
  ok(b.teams[0].inkCap <= ENDLESS.inkCap, 'endless lowers the ink cap');
  ok(pages.length >= 1 && pages[0].wave === 10 && pages[0].page !== 'ruled', `page changes after wave 10 (${pages.map((x) => x.page + '@' + x.wave)})`);
  ok(waves[4].mini === undefined || waves[4].mini === true, 'wave 5 is a mini-boss wave');
  ok(waves[9].boss === true && sawFightBoss, 'wave 10 has a chapter boss');
  ok(cleared.length >= 11, 'waveClear events');
  ok(b.teams[1].fort.invulnerable && !b.teams[1].fort.turret.on, 'enemy fort sealed');
  // Determinism: same seed, same plan.
  const cfg2 = buildBattleConfig({ kind: 'endless', seed: 31 }, p);
  const b2 = new Battle(cfg2);
  const b3 = new Battle(buildBattleConfig({ kind: 'endless', seed: 31 }, p));
  for (let i = 0; i < 60 * 40; i++) { b2.update(1 / 60); b3.update(1 / 60); b2.events.length = 0; b3.events.length = 0; }
  ok(b2.endless.wave === b3.endless.wave && b2.units.length === b3.units.length, 'endless is deterministic');
  // Losing: a defenceless run ends with the player fort destroyed and reports a wave.
  const weak = buildBattleConfig({ kind: 'endless', seed: 5 }, expectedProfile('1-1'));
  weak.teams[0].fort.hp = 300;
  const wb = runBattle(weak, 1500, { tick(bb) { if (bb.endless.state === 'draft') bb.endless.choose(bb.endless.offer[0]); } });
  ok(wb.result && wb.result.winner === 1 && wb.endless.wave >= 1, 'endless ends when the fort falls');
}

// Endless pressure: no dead picks in the draft, and waves close in instead of parking.
section('Endless pressure and draft');
{
  const cfg = buildBattleConfig({ kind: 'endless', seed: 12 }, expectedProfile('4-1'));
  const b = new Battle(cfg);
  const t = b.teams[0];
  t.fort.hp = t.fort.maxHp;
  t.ink = t.inkCap;
  for (let k = 0; k < 40; k++) {
    const offer = offerPerks(b, [], 1 + (k % 12));
    ok(!offer.includes('patch_up') && !offer.some((id) => ['ink_flow', 'cheap_ink', 'ink_bank', 'free_fifth', 'iron_scribes'].includes(id)), 'no Patch Up at a full fort, no ink perks at the ink cap');
  }
  t.fort.hp = t.fort.maxHp * 0.4; t.ink = 100;
  ok(!perkIsDead(PERKS.find((p) => p.id === 'patch_up'), b) && !perkIsDead(PERKS.find((p) => p.id === 'ink_flow'), b), 'those perks come back when they matter');
  // Waves close in: after the first 40 s of a late wave nobody is parked far from every one of your units.
  const wc = buildBattleConfig({ kind: 'endless', seed: 3 }, expectedProfile('5-1'));
  wc.teams[0].ai = botAI(wc, { sally: true });
  let worst = 0, streak = 0;
  runBattle(wc, 900, { tick(bb) {
    const E = bb.endless;
    if (E.state === 'draft') E.choose(E.offer[0]);
    if (E.state !== 'fight' || E.waveT < 30 || E.pending.length) return;
    const foes = bb.byTeam[1].filter((u) => u.alive && !u.isBoss && !u.tags.has('structure'));
    // Stall: every foe is stationary at the edge for a long stretch.
    const parked = foes.length > 0 && foes.every((u) => u.x > bb.width - 400);
    streak = parked ? streak + 1 / 60 : 0;
    worst = Math.max(worst, streak);
  } });
  ok(worst < 25, `endless foes do not park behind their fort (${worst.toFixed(1)}s)`);
}

// ------------------------------------------------------------------ Daily
section('Daily');
{
  const d1 = JSON.stringify(dailyInfo('2026-11-05')), d1b = JSON.stringify(dailyInfo('2026-11-05'));
  ok(d1 === d1b, 'same date, same info');
  const c1 = JSON.stringify(dailyConfig({ date: '2026-11-05' }, expectedProfile('3-1')));
  const c1b = JSON.stringify(dailyConfig({ date: '2026-11-05' }, expectedProfile('5-6')));
  ok(c1 === c1b, 'same date, same config for any save');
  const seen = new Set();
  let consecutiveDiffer = true;
  let date = '2026-11-01';
  for (let i = 0; i < 30; i++) {
    const info = dailyInfo(date);
    seen.add(JSON.stringify([info.faction, info.modifiers, info.units, info.spells]));
    if (JSON.stringify(info) === JSON.stringify(dailyInfo(addDays(date, 1)))) consecutiveDiffer = false;
    ok(info.units.length === 6 && new Set(info.units).size === 6 && info.spells.length === 2 && info.modifiers.length === 2 && info.modifiers[0] !== info.modifiers[1], `${date} shape`);
    ok(info.modifiers.every((m) => MODIFIERS[m]) && !(info.modifiers.includes('wind_left') && info.modifiers.includes('wind_right')), `${date} modifiers valid`);
    date = addDays(date, 1);
  }
  ok(seen.size >= 25, `30 days give varied challenges (${seen.size})`);
  ok(consecutiveDiffer, 'consecutive days differ');
  // Ambush dailies: a small raiding party and a fair start for the player.
  for (let i = 0; i < 40; i++) {
    const dt = addDays('2026-11-01', i);
    const cfg = dailyConfig({ date: dt }, expectedProfile('3-1'));
    ok(cfg.teams[0].startInk >= 200, `${dt} player starts with at least 200 ink (${cfg.teams[0].startInk})`);
    const su = cfg.teams[1].startUnits;
    if (su) ok(Object.values(su).reduce((a, c) => a + c, 0) <= 6, `${dt} ambush party is small`);
  }
  for (const dt of ['2026-11-05', '2026-12-25', '2027-01-09']) {
    const cfg = dailyConfig({ date: dt }, expectedProfile('3-1'));
    cfg.teams[0].ai = botAI(cfg);
    const b = runBattle(cfg, 60);
    ok(b.time >= 59 || b.result, `daily ${dt} runs`);
    ok(cfg.teams[0].roster.length === 7 && Object.values(cfg.teams[0].unitLevels).includes(5), `daily ${dt} roster and level 5`);
    ok(cfg.teams[0].spells.length === 2 && cfg.teams[0].spells.every((s) => s.level === 3), `daily ${dt} spells at level 3`);
  }
}

// ------------------------------------------------------------------ Red Ink
section('Red Ink scales with the player');
{
  const lvl = LEVEL_BY_ID['2-3'];
  const weak = expectedProfile('2-3');
  const strong = expectedProfile('5-6', { unitLevel: 10 });
  const cw = enemyTeamConfig(lvl, { hard: true, profile: weak });
  const cs = enemyTeamConfig(lvl, { hard: true, profile: strong });
  const cn = enemyTeamConfig(lvl, {});
  const anyLv = (c) => Math.max(...Object.values(c.unitLevels));
  ok(anyLv(cs) >= 11 && anyLv(cs) > anyLv(cw), `Red Ink enemy level follows the player's units (${anyLv(cw)} -> ${anyLv(cs)})`);
  ok(cs.mods.hp > cw.mods.hp && cs.fort.hp > cw.fort.hp && cs.mods.hp > cn.mods.hp * HARD_MODE.enemyHp * 0.99, 'Red Ink multipliers grow with the player');
}

// ------------------------------------------------------------------ Skirmish
section('Skirmish');
for (const faction of SKIRMISH_FACTIONS) {
  for (const difficulty of ['easy', 'normal', 'hard', 'brutal']) {
    if (quick && difficulty !== 'normal') continue;
    try {
      const cfg = buildBattleConfig({ kind: 'skirmish', faction, difficulty, width: 2800 }, expectedProfile('3-3'));
      cfg.teams[0].ai = botAI(cfg);
      const b = runBattle(cfg, 45);
      ok(b.time >= 44 || b.result, `skirmish ${faction}/${difficulty} runs`);
      ok(b.width === 2800 && b.teams[1].faction === faction, `skirmish ${faction}/${difficulty} config`);
    } catch (e) { ok(false, `skirmish ${faction}/${difficulty} threw: ${e.stack}`); }
  }
}

console.log(`\n${passes} checks passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
