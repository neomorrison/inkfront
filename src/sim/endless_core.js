// OWNER: AI/levels/modes builder (package C)
// The Endless Notebook. Waves march in from the right edge; the enemy fort is invulnerable, has no
// tower and no economy (the only way to lose is to let your own fort fall). Between waves the fort
// heals 15%, the page may turn, and you draft 1 of 3 perks.
//
// Contract (docs/ARCHITECTURE.md): b.endless = { wave, state: 'fight'|'break'|'draft', enemiesLeft, offer, choose(id) }
// Events: waveStart{wave, boss, mini, faction, count}, waveClear{wave}, draftOffer{offer, wave}, pageChange{page, faction}.
// Extra fields for the HUD: breakT (seconds until the next wave), total (enemies in this wave), best.
import { UNITS } from '../data/units.js';
import { FACTIONS } from '../data/factions.js';
import { PERKS, RARITY_WEIGHT } from '../data/perks.js';
import { CHAPTERS } from '../data/pages.js';
import { PERK_IMPL } from './registry.js';
import { validTarget } from './common.js';
import { PERK_STACK } from './perks.js';

export const ENDLESS = {
  firstBreak: 5,     // seconds before wave 1
  breakTime: 8,      // seconds between waves, after the draft
  healFrac: 0.15,    // fort repair after each wave
  maxUnits: 56,      // on-field cap per wave so 150-unit battles stay smooth
  stragglerAfter: 85,  // seconds into a wave before leftovers start fading (the stall breaker)
  lastFewAfter: 40,    // same, when only one or two enemies are left
  huntEvery: 0.8,      // seconds between "go and find them" checks for wave units with nothing to shoot at
  inkCap: 1600,        // Endless lowers the ink cap so ink cannot pile up unspent
  spawnSpan: 7,      // base seconds a wave takes to file in
};

const BOSSES = ['boss_redline', 'boss_smudge', 'boss_wyrm', 'boss_professor', 'boss_hand'];
const MINIS = ['graphite_golem', 'board_brute', 'colossus'];

// Ink-worth of enemies in a wave.
// Past wave 8 the curve steepens so a strong account feels pressure by waves 12 to 15.
export function waveBudget(w) {
  return Math.round((150 + 78 * w + 3.2 * w * w) * (1 + 0.1 * Math.max(0, w - 8)));
}

// Upgrade level and stat multipliers for enemy units of wave w.
export function waveScaling(w) {
  const late = Math.max(0, w - 8);
  return {
    level: Math.min(14, 1 + Math.floor((w - 1) / 2.2) + Math.floor(late / 2.5)),
    hp: 1 + 0.03 * (w - 1) + 0.03 * late,
    dmg: 1 + 0.022 * (w - 1) + 0.025 * late,
  };
}

export function endlessGold(wave) {
  return Math.round(40 * wave + 15 * Math.pow(wave, 1.4));
}

export function pageIndexFor(w) { return Math.floor((w - 1) / 10) % CHAPTERS.length; }

// Which factions show up in wave w: [primary, ...secondary pool].
export function factionsForWave(w) {
  const idx = pageIndexFor(w);
  const primary = CHAPTERS[idx].faction;
  const pool = [];
  if (w > 50) { for (const c of CHAPTERS) if (c.faction !== primary) pool.push(c.faction); }
  else {
    for (let i = 0; i < idx; i++) pool.push(CHAPTERS[i].faction);
    if ((w - 1) % 10 >= 5 && idx + 1 < CHAPTERS.length) pool.push(CHAPTERS[idx + 1].faction);
  }
  return { primary, pool };
}

const ROLE_W = { melee: 3, tank: 1.5, ranged: 2.2, caster: 1, support: 0.7, heavy: 0.35, cavalry: 1, assassin: 0.7 };

function candidates(faction, wave) {
  const out = [];
  for (const id of (FACTIONS[faction] && FACTIONS[faction].roster) || []) {
    const d = UNITS[id];
    if (!d || id === 'scribe' || d.boss || d.summon || d.hero) continue;
    let w = ROLE_W[d.role] ?? 1;
    if (d.role === 'heavy' && wave < 12) w = 0;
    if (d.cost >= 300 && wave < 8) w = 0;
    if (w > 0) out.push({ id, w, cost: d.cost });
  }
  return out;
}

// Pure planner: the list of unit ids for wave w (without boss). Uses the battle rng.
export function planWave(b, w, budgetMult = 1) {
  const { primary, pool } = factionsForWave(w);
  let budget = waveBudget(w) * budgetMult;
  const list = [];
  const prim = candidates(primary, w);
  const sec = pool.flatMap((f) => candidates(f, w));
  let guard = 0;
  while (budget > 15 && list.length < ENDLESS.maxUnits && guard++ < 400) {
    const src = sec.length && b.rng.chance(0.3) ? sec : prim;
    const afford = src.filter((c) => c.cost <= budget);
    if (!afford.length) {
      const any = prim.filter((c) => c.cost <= budget);
      if (!any.length) break;
      const pick = pickWeighted(b, any);
      list.push(pick.id); budget -= pick.cost;
      continue;
    }
    // Late waves lean toward the big units once the headcount cap is near.
    const crowd = list.length / ENDLESS.maxUnits;
    const pick = pickWeighted(b, afford, crowd > 0.6 ? (c) => c.w * (1 + c.cost / 120) : null);
    list.push(pick.id);
    budget -= pick.cost;
  }
  return list;
}

function pickWeighted(b, arr, wf) {
  let total = 0;
  for (const c of arr) total += wf ? wf(c) : c.w;
  let r = b.rng.next() * total;
  for (const c of arr) {
    r -= wf ? wf(c) : c.w;
    if (r <= 0) return c;
  }
  return arr[arr.length - 1];
}

const INK_PERKS = new Set(['ink_flow', 'cheap_ink', 'ink_bank', 'free_fifth', 'iron_scribes']);

// A perk that would do nothing right now (fort already full, ink already at the cap, no ranged units to buff...).
export function perkIsDead(p, b) {
  const t = b.teams[0];
  const f = t.fort;
  const defs = t.roster.map((id) => UNITS[id]).filter((d) => d && d.id !== 'scribe');
  if (INK_PERKS.has(p.id) && t.ink >= t.inkCap * 0.7) return true;
  if (p.id === 'patch_up') return !f.alive || f.hp >= f.maxHp * 0.8;
  if (p.id === 'long_arms' || p.id === 'fire_everything') return !defs.some((d) => d.proj);
  if (p.id === 'sharp_swords' || p.id === 'vampire_ink') return !defs.some((d) => d.tags && d.tags.includes('melee'));
  if (p.id === 'martyrs') return !t.roster.includes('brawler');
  if (p.id === 'hot_coffee') return !t.spells.length;
  if (p.id === 'hero_vigor') return !t.cfg.hero;
  if (p.id === 'tower_volley') return !f.turret || f.turret.on === false;
  if (p.id === 'iron_scribes') return !t.scribeCap;
  return false;
}

// Offer 3 distinct perks. owned = array of ids (duplicates count as stacks).
export function offerPerks(b, owned, wave) {
  const count = (id) => owned.filter((x) => x === id).length;
  const avail = PERKS.filter((p) => PERK_IMPL[p.id] && count(p.id) < (PERK_STACK[p.id] || 1));
  const live = avail.filter((p) => !perkIsDead(p, b));
  const ok = live.length >= 3 ? live : avail; // never offer fewer than three cards
  const weight = (p) => {
    let w = RARITY_WEIGHT[p.rarity] || 10;
    if (wave >= 10 && p.rarity !== 'common') w *= 1.25;
    if (count(p.id) > 0) w *= 0.5;
    return w;
  };
  const pool = ok.slice();
  const picks = [];
  const take = (filter) => {
    const cand = filter ? pool.filter(filter) : pool;
    if (!cand.length) return;
    let total = 0;
    for (const p of cand) total += weight(p);
    let r = b.rng.next() * total;
    let chosen = cand[cand.length - 1];
    for (const p of cand) { r -= weight(p); if (r <= 0) { chosen = p; break; } }
    pool.splice(pool.indexOf(chosen), 1);
    picks.push(chosen.id);
  };
  // After a mini-boss or boss wave, at least one rare or better.
  if (wave % 5 === 0) take((p) => p.rarity !== 'common');
  while (picks.length < 3 && pool.length) take();
  return picks;
}

export function initEndless(b) {
  const E = {
    wave: 0,
    state: 'break',
    enemiesLeft: 0,
    total: 0,
    offer: null,
    breakT: ENDLESS.firstBreak,
    best: (b.cfg.endless && b.cfg.endless.best) || 0,
    pending: [],       // { t, id, x, o } units still to enter
    waveT: 0,
    boss: false,
    choose(id) {
      if (E.state !== 'draft' || !E.offer || !E.offer.includes(id)) return false;
      addPerk(b, id);
      E.offer = null;
      E.state = 'break';
      E.breakT = ENDLESS.breakTime;
      b.emit('perkChosen', { id, wave: E.wave });
      return true;
    },
  };
  b.endless = E;
  const foe = b.teams[1];
  foe.cfg.fort = { ...(foe.cfg.fort || {}), invulnerable: true };
  foe.fort.invulnerable = true;
  foe.fort.turret.on = false;
  foe.income = 0;
  foe.ink = 0;
  b.setStance(1, 'charge');
  // Ink cannot pile up forever: Endless caps it lower so spending stays a decision.
  const mine = b.teams[0];
  mine.inkCap = Math.min(mine.inkCap, b.cfg.inkCap ?? ENDLESS.inkCap);
}

export function addPerk(b, id) {
  const t = b.teams[0];
  t.perks.push(id);
  PERK_IMPL[id]?.apply?.(b, 0);
}

function startWave(b, E) {
  const w = ++E.wave;
  const sc = waveScaling(w);
  const foe = b.teams[1];
  foe.mods.hp = sc.hp;
  foe.mods.dmg = sc.dmg;
  const mini = w % 5 === 0 && w % 10 !== 0;
  const chapter = w % 10 === 0;
  const plan = planWave(b, w, chapter ? 0.55 : mini ? 0.7 : 1);
  E.pending = [];
  E.boss = chapter;
  const span = ENDLESS.spawnSpan + Math.min(8, plan.length * 0.12);
  // They file out in front of the (sealed) enemy fort so nothing ever hides behind it.
  const spawnX = () => b.teams[1].fort.x - 80 - b.rng.range(0, 160);
  plan.forEach((id, i) => {
    E.pending.push({ at: (i / Math.max(1, plan.length)) * span + b.rng.range(0, 0.6), id, level: sc.level });
  });
  if (mini) {
    const id = MINIS[(((w - 5) / 10) | 0) % MINIS.length];
    E.pending.push({ at: span * 0.35, id, level: sc.level, hpMult: 1 + 0.045 * w, dmgMult: 1 + 0.03 * w, mini: true });
  }
  if (chapter) {
    const k = w / 10 - 1;
    const id = BOSSES[k % BOSSES.length];
    const cycle = Math.floor(k / BOSSES.length);
    E.pending.push({ at: 1.5, id, level: 1, hpMult: 0.75 + 0.05 * w + cycle * 0.6, dmgMult: 0.85 + 0.03 * w + cycle * 0.3, boss: true });
  }
  E.pending.sort((a, c) => a.at - c.at);
  E.total = E.pending.length;
  E.enemiesLeft = E.total;
  E.waveT = 0;
  E.erasing = false;
  E.state = 'fight';
  E.spawnX = spawnX;
  const { primary } = factionsForWave(w);
  b.emit('waveStart', { wave: w, boss: chapter, mini, faction: primary, count: E.total });
  if (chapter) b.emit('banner', { text: `Wave ${w}: a chapter boss arrives!`, team: 1 });
  else if (mini) b.emit('banner', { text: `Wave ${w}: something big is coming`, team: 1 });
}

// Wave units with nothing in reach would otherwise park at the sealed fort's slot (ranged units stopped
// out of reach of everything). Give them the nearest of your units, or your fort, to walk at.
const HUNTERS = new Set(['melee', 'ranged', 'cavalry']);
function hunt(b) {
  const prey = [];
  for (const u of b.byTeam[0]) if (u.alive && u.targetable && !u.stealth && !u.tags.has('structure')) prey.push(u);
  const fort = b.teams[0].fort;
  for (const u of b.byTeam[1]) {
    if (!u.alive || u.isBoss || !HUNTERS.has(u.def.behavior) || u.attacking || u.state === 'spawn') continue;
    if (validTarget(u, u.target) && !(u.target.isFort && prey.length)) continue;
    let best = null, bd = Infinity;
    for (const e of prey) {
      if (e.flying && !u.canHitAir) continue;
      const d = Math.abs(e.x - u.x);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best && fort.alive) best = fort;
    if (best) { u.target = best; u.retargetT = ENDLESS.huntEvery + 0.3; }
  }
}

function aliveFoes(b) {
  let n = 0;
  for (const u of b.units) if (u.alive && u.team === 1 && !u.tags.has('structure') && !(u.lifetime > 0)) n++;
  return n;
}

function clearWave(b, E) {
  const t = b.teams[0];
  const f = t.fort;
  b.emit('waveClear', { wave: E.wave });
  if (f.alive) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * ENDLESS.healFrac);
  t.ink += 60 + 6 * E.wave; // a little ink for the break so the next wave can be met
  if (E.wave % 10 === 0) {
    const idx = Math.floor(E.wave / 10) % CHAPTERS.length;
    const ch = CHAPTERS[idx];
    b.page = ch.page;
    b.teams[1].faction = ch.faction;
    b.emit('pageChange', { page: ch.page, faction: ch.faction, wave: E.wave });
  }
  E.offer = offerPerks(b, t.perks, E.wave);
  E.state = 'draft';
  b.boss = null;
  b.emit('draftOffer', { offer: E.offer.slice(), wave: E.wave });
}

export function updateEndless(b, dt) {
  const E = b.endless;
  if (!E) return;
  if (E.state === 'break') {
    E.breakT -= dt;
    if (E.breakT <= 0) startWave(b, E);
    return;
  }
  if (E.state !== 'fight') return;
  E.waveT += dt;
  while (E.pending.length && E.pending[0].at <= E.waveT) {
    const p = E.pending.shift();
    const x = p.boss ? b.teams[1].fort.x - 110 : E.spawnX();
    const u = b.spawnUnit(1, p.id, { x, level: p.level, hpMult: p.hpMult, dmgMult: p.dmgMult, spawnTime: p.boss ? 1.2 : 0.45 });
    if (p.boss) { b.boss = u; b.emit('bossArrive', { unit: u, id: p.id }); }
  }
  E.huntT = (E.huntT ?? 0) - dt;
  if (E.huntT <= 0) { E.huntT = ENDLESS.huntEvery; hunt(b); }
  // Failsafe: anything still alive well into the wave gets erased by the margin, so a wave can never stall.
  const left = E.pending.length + aliveFoes(b);
  // One or two stragglers (say, an archer knocked behind its own fort) are erased sooner than a whole stalled wave.
  const stalled = E.waveT > ENDLESS.stragglerAfter || (left <= 2 && E.waveT > ENDLESS.lastFewAfter);
  if (stalled && !E.pending.length) {
    if (!E.erasing) { E.erasing = true; b.emit('banner', { text: 'The margin erases the stragglers', team: 1 }); }
    for (const u of b.units) if (u.alive && u.team === 1 && !u.tags.has('structure')) b.damage(u, u.maxHp * 0.06 * dt, { kind: 'true', team: 0, silent: true });
  }
  E.enemiesLeft = E.pending.length + aliveFoes(b);
  if (!E.pending.length && E.enemiesLeft === 0) clearWave(b, E);
}

