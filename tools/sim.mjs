// Headless battle runner for balance checks and crash tests. No browser needed.
//   node tools/sim.mjs demo              AI vs AI demo battle
//   node tools/sim.mjs 1-3               one campaign level with the player bot
//   node tools/sim.mjs all --runs 3      every level, 3 seeds each, table of results
// Options: --runs N  --hard  --unit-level N (player unit upgrade level, default = expected for the level)
//          --fort-level N  --hero-level N  --under N (N unit levels below expected)  --skill X (bot speed, 1 = full)
//          --scribes N (cap the bot's Scribes: 1 = a casual player who barely draws them)
//          --defend (a defend-first player: waits for a big edge, attacks late)
//          --report (compact table)  --json (writes tools/out/balance.json)
//   node tools/sim.mjs endless [--at 4-1]   endless run with the bot picking perks
//   node tools/sim.mjs daily | skirmish    daily dates / every faction x difficulty
import { Battle } from '../src/sim/index.js';
import { campaignConfig, demoConfig } from '../src/game/modes.js';
import { defaultProfile } from '../src/game/save.js';
import { LEVELS, LEVEL_BY_ID, starsFor } from '../src/data/levels.js';
import { PLAYER_ROSTER, UNITS } from '../src/data/units.js';
import { unitUpgradeCost, fortUpgradeCost, spellUpgradeCost, FORT_UPGRADES, UNIT_MAX_LEVEL } from '../src/data/upgrades.js';
import { heroXpToNext, HERO_MAX_LEVEL } from '../src/data/hero.js';
import { SPELL_ORDER, SPELL_MAX_LEVEL } from '../src/data/spells.js';
import { heroAbilityReady } from '../src/sim/behaviors/hero.js';
import { fitSquad } from '../src/game/squad.js';

// How the bot picks a squad: SIM_SQUAD=newest (heaviest new units first), oldest, or
// balanced (default: a front line, ranged and a healer first, then the newest units).
function squadOrder(combat) {
  const mode = process.env.SIM_SQUAD || 'balanced';
  if (mode === 'newest') return combat.slice().reverse();
  if (mode === 'oldest') return combat.slice();
  const core = ['shieldbearer', 'archer', 'medic', 'spearman', 'brawler'].filter((id) => combat.includes(id));
  return [...core, ...combat.slice().reverse().filter((id) => !core.includes(id))];
}
import { roleWeights } from '../src/sim/ai.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : isNaN(+v) ? v : +v;
};
const target = args[0] && !args[0].startsWith('--') ? args[0] : 'demo';

// What a typical player has unlocked and upgraded when they reach a level. Gold and XP come from the
// real rewards of the levels before it (3-star first clears plus 25% for replays, crates and defeats),
// spent the way a casual player does: 55% on units (evenly), 30% on the fort, 15% on spells.
export const ECON = { replay: 1.25, stars: 1.5, units: 0.55, fort: 0.30, spells: 0.15, heroXp: 1.3 };

export function expectedProfile(levelId, o = {}) {
  const p = defaultProfile();
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  let gold = 0, xp = 0;
  for (let i = 0; i < idx; i++) {
    const L = LEVELS[i];
    const u = L.rewards.unlock || {};
    if (u.unit && !p.unlockedUnits.includes(u.unit)) p.unlockedUnits.push(u.unit);
    if (u.spell && !p.unlockedSpells.includes(u.spell)) p.unlockedSpells.push(u.spell);
    p.levels[L.id] = { stars: 3, cleared: true, plays: 1 };
    gold += L.rewards.gold * ECON.stars * ECON.replay;
    xp += L.rewards.xp * ECON.heroXp;
  }
  const chapter = LEVEL_BY_ID[levelId].chapter;
  const combat = PLAYER_ROSTER.filter((id) => id !== 'scribe' && p.unlockedUnits.includes(id));
  // Newest units first, as many as the squad points allow (no War Table yet).
  p.loadout.units = fitSquad(p, squadOrder(combat));
  p.loadout.spells = SPELL_ORDER.filter((id) => p.unlockedSpells.includes(id)).slice(-3);
  for (const id of p.unlockedUnits) p.units[id] = 1;
  for (const id of p.unlockedSpells) p.spells[id] = 1;

  // Spend the gold.
  const spend = (budget, buyNext) => { let guard = 500; while (guard-- > 0 && buyNext(() => budget, (c) => { budget -= c; })) { /* keep buying */ } };
  const pool = ['scribe', ...p.loadout.units];
  spend(gold * ECON.units, (left, pay) => {
    const lows = pool.filter((id) => (p.units[id] || 1) < UNIT_MAX_LEVEL).sort((a, c) => (p.units[a] || 1) - (p.units[c] || 1));
    for (const id of lows) {
      if (id === 'scribe' && (p.units.scribe || 1) >= 6) continue;
      const cost = unitUpgradeCost(UNITS[id], p.units[id] || 1);
      if (cost <= left()) { pay(cost); p.units[id] = (p.units[id] || 1) + 1; return true; }
    }
    return false;
  });
  const fortOrder = ['walls', 'turret', 'income', 'start_ink', 'pop', 'squad', 'wells', 'scribes'];
  spend(gold * ECON.fort, (left, pay) => {
    const lows = fortOrder.filter((k) => (p.fort[k] || 0) < FORT_UPGRADES[k].max).sort((a, c) => (p.fort[a] || 0) - (p.fort[c] || 0));
    for (const k of lows) {
      const cost = fortUpgradeCost(k, p.fort[k] || 0);
      if (cost <= left()) { pay(cost); p.fort[k] = (p.fort[k] || 0) + 1; return true; }
    }
    return false;
  });
  spend(gold * ECON.spells, (left, pay) => {
    const lows = p.loadout.spells.filter((id) => (p.spells[id] || 1) < SPELL_MAX_LEVEL).sort((a, c) => (p.spells[a] || 1) - (p.spells[c] || 1));
    for (const id of lows) {
      const cost = spellUpgradeCost(p.spells[id] || 1);
      if (cost <= left()) { pay(cost); p.spells[id] = (p.spells[id] || 1) + 1; return true; }
    }
    return false;
  });
  if (o.unitLevel != null) for (const id of p.unlockedUnits) p.units[id] = id === 'scribe' ? Math.min(o.unitLevel, 6) : o.unitLevel;
  if (o.under) for (const id of p.unlockedUnits) p.units[id] = Math.max(1, (p.units[id] || 1) - o.under);
  if (o.fortLevel != null) for (const k in p.fort) p.fort[k] = k === 'scribes' ? Math.min(4, Math.floor(o.fortLevel / 2)) : k === 'pop' ? Math.min(8, o.fortLevel) : k === 'squad' ? Math.min(3, o.fortLevel) : o.fortLevel;
  let lv = 1, rest = xp;
  while (lv < HERO_MAX_LEVEL && rest >= heroXpToNext(lv)) { rest -= heroXpToNext(lv); lv++; }
  p.hero.level = o.heroLevel ?? lv;
  p.hero.points = 0;
  p.loadout.units = fitSquad(p, squadOrder(combat));
  return p;
}

// Bot that plays the player side. It is the enemy commander class with a balanced composition
// (front line, ranged, healer), spell casting on clusters and, below, hero abilities.
// opts.skill < 1 slows its thinking so the measuring stick is closer to a casual human.
export function botAI(cfg, o = {}) {
  const roster = cfg.teams[0].roster.filter((id) => id !== 'scribe');
  return {
    scribes: o.scribes ?? cfg.teams[0].scribeCap,
    weights: roleWeights(roster),
    aggression: o.aggression ?? 1.1,
    firstAttack: o.firstAttack ?? 40,
    maxArmy: cfg.teams[0].popCap,
    counter: true,
    spellMin: 5, spellAfter: 25, // casts on real clusters, not the first stragglers
    thinkMul: 1 / (o.skill ?? 1),
    sally: !!o.sally,
    raid: 0,
  };
}

// Hero abilities: Rally when allies are clustered in a fight, Slam into a crowd, Inkstorm at full Fury.
function botHero(b) {
  const h = b.teams[0].hero;
  if (!h || !h.alive) return;
  const ctl = b.control[0];
  if (ctl.heroAbility) return;
  const foes = b.byTeam[1].filter((e) => e.alive && Math.abs(e.x - h.x) < 320);
  if (!foes.length) return;
  const close = foes.filter((e) => Math.abs(e.x - h.x) < 130).length;
  const allies = b.byTeam[0].filter((u) => u.alive && Math.abs(u.x - h.x) < 320 && u.type !== 'scribe').length;
  if (close >= 1 && heroAbilityReady(h, 'inkstorm')) ctl.heroAbility = 'inkstorm';
  else if (allies >= 4 && heroAbilityReady(h, 'rally')) ctl.heroAbility = 'rally';
  else if (close >= 2 && heroAbilityReady(h, 'slam')) ctl.heroAbility = 'slam';
}

export function runBattle(cfg, maxTime = 600, hooks = {}) {
  const b = new Battle(cfg);
  const dt = 1 / 60;
  let heroT = 0;
  while (!b.result && b.time < maxTime) {
    b.update(dt);
    if (cfg.teams[0].ai && (heroT -= dt) <= 0) { heroT = 0.4; botHero(b); }
    if (hooks.tick) hooks.tick(b);
    b.events.length = 0;
  }
  return b;
}

function summarize(b) {
  const r = b.result;
  const t0 = b.teams[0], t1 = b.teams[1];
  return {
    winner: r ? (r.winner === 0 ? 'PLAYER' : 'ENEMY') : 'TIMEOUT',
    time: Math.round(b.time),
    stars: r ? starsFor(r) : 0,
    fort: Math.round((t0.fort.hp / t0.fort.maxHp) * 100) + '%',
    efort: Math.round((t1.fort.hp / t1.fort.maxHp) * 100) + '%',
    kills: t0.stats.kills + '/' + t1.stats.kills,
    ink: Math.round(t0.stats.inkGathered) + '/' + Math.round(t1.stats.inkGathered),
    units: b.units.filter((u) => u.alive && u.team === 0).length + '/' + b.units.filter((u) => u.alive && u.team === 1).length,
  };
}

const pct = (n, d) => Math.round((100 * n) / Math.max(1, d));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// One level, N seeds -> aggregate row used by the table, --report and --json.
export function measureLevel(id, runs, o = {}) {
  const rows = [];
  for (let s = 0; s < runs; s++) {
    // Red Ink unlocks after the Hand, so the player has everything unlocked (default profile = end of campaign).
    const p = expectedProfile(o.hard ? '5-6' : id, { unitLevel: o.unitLevel, fortLevel: o.fortLevel, heroLevel: o.heroLevel, under: o.under });
    const cfg = campaignConfig({ levelId: id, seed: 1000 + s * 17, hard: !!o.hard }, p);
    cfg.teams[0].ai = botAI(cfg, { skill: o.skill, scribes: o.scribes, ...(o.defend ? { aggression: 2.2, firstAttack: 150 } : {}) });
    const b = runBattle(cfg);
    const r = summarize(b);
    r.fortPct = (b.teams[0].fort.hp / b.teams[0].fort.maxHp) * 100;
    rows.push(r);
  }
  const wins = rows.filter((r) => r.winner === 'PLAYER');
  return {
    id, runs, wins: wins.length, winPct: pct(wins.length, runs),
    avgTime: Math.round(avg(rows.map((r) => r.time))),
    stars: +avg(rows.map((r) => r.stars)).toFixed(2),
    fortLeft: Math.round(avg(wins.map((r) => r.fortPct))),
    rows,
  };
}

async function main() {
  const t0 = Date.now();
  const fmt = { under: opt('under', 0), skill: opt('skill', 1), scribes: opt('scribes') === undefined ? undefined : opt('scribes'), defend: !!opt('defend') };
  if (target === 'demo') {
    for (let s = 1; s <= (opt('runs', 3)); s++) {
      const b = runBattle(demoConfig({ seed: s }), 400);
      console.log('demo seed', s, summarize(b));
    }
  } else if (target === 'endless') {
    await import('../src/game/endless.js');
    const { buildBattleConfig } = await import('../src/game/modes.js');
    const at = opt('at', '4-1');
    for (let s = 0; s < opt('runs', 1); s++) {
      const p = expectedProfile(at, { unitLevel: opt('unit-level'), under: fmt.under });
      const cfg = buildBattleConfig({ kind: 'endless', seed: 77 + s }, p);
      cfg.teams[0].ai = botAI(cfg, { sally: true, skill: fmt.skill });
      const b = runBattle(cfg, opt('max', 1800), { tick(bb) { const E = bb.endless; if (E.state === 'draft') E.choose(E.offer[0]); } });
      console.log('endless from', at, 'reached wave', b.endless.wave, 'time', Math.round(b.time) + 's', 'perks', b.teams[0].perks.length);
    }
  } else if (target === 'daily' || target === 'skirmish') {
    await import('../src/game/daily.js');
    const { buildBattleConfig, SKIRMISH_FACTIONS } = await import('../src/game/modes.js');
    const runs = opt('runs', 5);
    const keys = target === 'daily' ? Array.from({ length: runs }, (_, i) => '2026-11-' + String(1 + i).padStart(2, '0')) : SKIRMISH_FACTIONS.flatMap((f) => ['easy', 'normal', 'hard', 'brutal'].map((d) => f + ':' + d));
    for (const k of keys) {
      const o = target === 'daily' ? { kind: 'daily', date: k } : { kind: 'skirmish', faction: k.split(':')[0], difficulty: k.split(':')[1] };
      const p = expectedProfile(opt('at', '3-3'));
      const cfg = buildBattleConfig(o, p);
      cfg.teams[0].ai = botAI(cfg, { skill: fmt.skill });
      const b = runBattle(cfg);
      const r = summarize(b);
      console.log(String(k).padEnd(18), r.winner, r.time + 's', 'fort', r.fort, 'efort', r.efort, cfg.daily ? cfg.daily.title : '');
    }
  } else {
    const ids = target === 'all' ? LEVELS.map((l) => l.id) : target.split(',');
    const runs = opt('runs', 1);
    const report = [];
    for (const id of ids) {
      const m = measureLevel(id, runs, { unitLevel: opt('unit-level'), fortLevel: opt('fort-level'), heroLevel: opt('hero-level'), hard: !!opt('hard'), ...fmt });
      report.push(m);
      if (!opt('report')) console.log(id.padEnd(5), `wins ${m.wins}/${runs}`, m.rows.map((r) => `${r.winner[0]} ${r.time}s ${r.stars}* fort ${r.fort} efort ${r.efort} k ${r.kills}`).join(' | '));
    }
    if (opt('report')) {
      console.log('level  win%  avg time  stars  fort left  (bot, ' + runs + ' runs' + (fmt.under ? ', ' + fmt.under + ' unit levels under' : '') + ')');
      for (const m of report) console.log(m.id.padEnd(6), String(m.winPct + '%').padStart(4), String(m.avgTime + 's').padStart(9), String(m.stars).padStart(6), String(m.fortLeft + '%').padStart(10), m.winPct < 50 ? '  <-- hard' : m.winPct === 100 && m.stars > 2.9 && m.id.endsWith('6') ? '  <-- easy' : '');
      const ch = (c) => report.filter((m) => m.id.startsWith(c + '-'));
      console.log('chapter win%:', [1, 2, 3, 4, 5].map((c) => Math.round(avg(ch(c).map((m) => m.winPct)))).join(' '));
    }
    if (opt('json')) {
      const fs = await import('node:fs');
      fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
      fs.writeFileSync(new URL('./out/balance.json', import.meta.url), JSON.stringify(report.map(({ rows, ...m }) => m), null, 2));
      console.log('wrote tools/out/balance.json');
    }
  }
  console.log('done in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

if (import.meta.url === 'file://' + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
