// Headless battle runner for balance checks and crash tests. No browser needed.
//   node tools/sim.mjs demo              AI vs AI demo battle
//   node tools/sim.mjs 1-3               one campaign level with the player bot
//   node tools/sim.mjs all --runs 3      every level, 3 seeds each, table of results
// Options: --runs N  --hard  --unit-level N (player unit upgrade level, default = expected for the level)
//          --fort-level N  --hero-level N  --verbose
import { Battle } from '../src/sim/index.js';
import { campaignConfig, demoConfig } from '../src/game/modes.js';
import { defaultProfile } from '../src/game/save.js';
import { LEVELS, LEVEL_BY_ID, starsFor } from '../src/data/levels.js';
import { PLAYER_ROSTER } from '../src/data/units.js';
import { SPELL_ORDER } from '../src/data/spells.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : isNaN(+v) ? v : +v;
};
const target = args[0] && !args[0].startsWith('--') ? args[0] : 'demo';

// What a typical player has unlocked and upgraded when they reach a level.
export function expectedProfile(levelId, o = {}) {
  const p = defaultProfile();
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  for (let i = 0; i < idx; i++) {
    const u = LEVELS[i].rewards.unlock || {};
    if (u.unit && !p.unlockedUnits.includes(u.unit)) p.unlockedUnits.push(u.unit);
    if (u.spell && !p.unlockedSpells.includes(u.spell)) p.unlockedSpells.push(u.spell);
    p.levels[LEVELS[i].id] = { stars: 3, cleared: true, plays: 1 };
  }
  const chapter = LEVEL_BY_ID[levelId].chapter;
  const ulv = o.unitLevel ?? Math.min(10, 1 + Math.round((idx / 29) * 7));
  for (const id of p.unlockedUnits) p.units[id] = id === 'scribe' ? Math.min(ulv, 6) : ulv;
  const flv = o.fortLevel ?? Math.min(10, Math.round(idx / 4));
  for (const k in p.fort) p.fort[k] = k === 'scribes' ? Math.min(4, Math.floor(flv / 2)) : k === 'pop' ? Math.min(8, flv) : flv;
  p.hero.level = o.heroLevel ?? Math.min(30, 1 + Math.round(idx * 0.75));
  const combat = PLAYER_ROSTER.filter((id) => id !== 'scribe' && p.unlockedUnits.includes(id));
  p.loadout.units = combat.slice(-8);
  p.loadout.spells = SPELL_ORDER.filter((id) => p.unlockedSpells.includes(id)).slice(-3);
  for (const id of p.unlockedSpells) p.spells[id] = Math.min(5, chapter);
  return p;
}

// Bot that plays the player side using the same AI commander as the enemy.
export function botAI(cfg) {
  const roster = cfg.teams[0].roster.filter((id) => id !== 'scribe');
  const weights = {};
  for (const id of roster) weights[id] = ['brawler', 'spearman', 'archer', 'shieldbearer'].includes(id) ? 3 : 2;
  return { scribes: cfg.teams[0].scribeCap, weights, aggression: 1.05, firstAttack: 40, maxArmy: cfg.teams[0].popCap, useSpells: true };
}

export function runBattle(cfg, maxTime = 600) {
  const b = new Battle(cfg);
  const dt = 1 / 60;
  let spellT = 5;
  while (!b.result && b.time < maxTime) {
    b.update(dt);
    // Bot casts spells at the densest enemy cluster.
    if (cfg.teams[0].ai && cfg.teams[0].ai.useSpells && (spellT -= dt) <= 0) {
      spellT = 3;
      const t = b.teams[0];
      t.spells.forEach((s, i) => {
        if (s.cd > 0) return;
        let best = null, bestN = 2;
        for (const e of b.byTeam[1]) {
          if (!e.alive) continue;
          const n = b.byTeam[1].filter((o) => o.alive && Math.abs(o.x - e.x) < 140).length;
          if (n > bestN) { bestN = n; best = e; }
        }
        const ally = ['highlighter'].includes(s.id);
        if (ally) { const a = b.byTeam[0].find((u) => u.alive && u.attacking); if (a) b.castSpell(0, i, a.x); }
        else if (best) b.castSpell(0, i, best.x);
      });
    }
  }
  if (b.events.length > 5000) b.events.length = 0;
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

async function main() {
  const t0 = Date.now();
  if (target === 'demo') {
    for (let s = 1; s <= (opt('runs', 3)); s++) {
      const b = runBattle(demoConfig({ seed: s }), 400);
      console.log('demo seed', s, summarize(b));
    }
  } else {
    const ids = target === 'all' ? LEVELS.map((l) => l.id) : target.split(',');
    const runs = opt('runs', 1);
    for (const id of ids) {
      const rows = [];
      for (let s = 0; s < runs; s++) {
        const p = expectedProfile(id, { unitLevel: opt('unit-level'), fortLevel: opt('fort-level'), heroLevel: opt('hero-level') });
        const cfg = campaignConfig({ levelId: id, seed: 1000 + s * 17, hard: !!opt('hard') }, p);
        cfg.teams[0].ai = botAI(cfg);
        const b = runBattle(cfg);
        rows.push(summarize(b));
      }
      const wins = rows.filter((r) => r.winner === 'PLAYER').length;
      console.log(id.padEnd(5), `wins ${wins}/${runs}`, rows.map((r) => `${r.winner[0]} ${r.time}s ${r.stars}* fort ${r.fort} efort ${r.efort} k ${r.kills}`).join(' | '));
    }
  }
  console.log('done in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

if (import.meta.url === 'file://' + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
