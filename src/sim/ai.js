// Enemy commander. Plays by the same rules as the player: Scribes for ink, drawn units, stances,
// supplies. It musters an army, pushes as one group, falls back when a fight goes badly,
// counter-picks what it draws, protects its Scribes and casts its team spells.
// Profile = level.enemy + { boss, script }. Deterministic: only b.rng is used for randomness.
// OWNER: AI/levels builder (package C)
import { UNITS } from '../data/units.js';
import { SPELLS } from '../data/spells.js';
import { armyPower, DEFEND_OFFSET } from './common.js';

const FAST = 110; // speed that counts as "quick"

function isRanged(def) { return !!def.proj || def.behavior === 'caster' || def.tags?.includes('caster'); }
function hasTag(def, tag) { return !!def.tags && def.tags.includes(tag); }

// Read the opponent's army and describe it in a handful of numbers the counter-picker uses.
export function scoutArmy(b, oppIdx) {
  const s = { total: 0, ranged: 0, melee: 0, cav: 0, large: 0, swarm: 0, support: 0, tank: 0, stealth: 0 };
  for (const u of b.byTeam[oppIdx]) {
    if (!u.alive || u.type === 'scribe' || u.tags.has('structure')) continue;
    const w = u.def.pop || 1;
    s.total += w;
    if (isRanged(u.def)) s.ranged += w; else s.melee += w;
    if (u.tags.has('cavalry')) s.cav += 1;
    if (u.tags.has('large') || u.isBoss) s.large += 1;
    if (u.tags.has('swarm') || u.tags.has('small')) s.swarm += w;
    if (u.tags.has('support')) s.support += 1;
    if (u.tags.has('tank')) s.tank += 1;
    if (u.def.behavior === 'assassin') s.stealth += 1;
  }
  return s;
}

// Multiply a unit's pick weight by how well it answers what the opponent fields.
export function counterFactor(def, scout, mine, strength = 1) {
  if (!def || def.id === 'scribe') return 1;
  let f = 1;
  const up = (m) => { f *= 1 + (m - 1) * strength; };
  if (scout.total >= 4) {
    const rf = scout.ranged / scout.total;
    const mf = (scout.melee) / scout.total;
    if (rf > 0.4) {
      if (def.speed >= FAST || hasTag(def, 'cavalry') || def.behavior === 'assassin') up(2.4);
      if (hasTag(def, 'tank') && def.block) up(1.5);
      if (isRanged(def) && !def.aoe) up(0.8);
    }
    if (mf > 0.6) {
      if (isRanged(def) || def.aoe || hasTag(def, 'siege')) up(1.9);
      if (def.behavior === 'bomber' && scout.swarm > scout.total * 0.4) up(1.6);
      if (hasTag(def, 'melee') && !def.aoe && !hasTag(def, 'tank')) up(0.8);
    }
    if (scout.swarm > scout.total * 0.45 && (def.aoe || def.behavior === 'bomber' || def.behavior === 'caster')) up(1.8);
  }
  if (scout.cav > 0 && def.bonus && def.bonus.cavalry) up(1 + 1.6 * Math.min(1, scout.cav / 2));
  if (scout.large > 0 && def.bonus && def.bonus.large) up(1.8);
  if (scout.stealth > 0 && (hasTag(def, 'melee') && def.speed >= 90)) up(1.3);
  // Keep a sensible shape: a front line, ranged behind, a healer once the army is big.
  const front = mine.front, back = mine.ranged, sup = mine.support, n = mine.total;
  if (def.rank != null && def.rank <= 1 && !isRanged(def) && back > front + 1) up(2);
  if (isRanged(def) && front > 2 * back + 2) up(1.6);
  if (isRanged(def) && back > front * 1.3 + 2) up(0.4);
  if (hasTag(def, 'support')) {
    if (n < 6) up(0.2);
    else if (sup < Math.ceil(n / 9)) up(2.6);
    else up(0.3);
  }
  return Math.max(0.02, f);
}

function myShape(b, idx) {
  const m = { total: 0, front: 0, ranged: 0, support: 0 };
  for (const u of b.units) {
    if (!u.alive || u.team !== idx || u.type === 'scribe' || u.isBoss || u.tags.has('structure') || u.summoned) continue;
    m.total += 1;
    if (hasTag(u.def, 'support')) m.support++;
    else if (isRanged(u.def)) m.ranged++;
    else m.front++;
  }
  return m;
}

export class AICommander {
  constructor(b, teamIdx, profile) {
    this.b = b;
    this.teamIdx = teamIdx;
    this.opp = 1 - teamIdx;
    this.team = b.teams[teamIdx];
    this.p = profile;
    this.t = 0;
    this.thinkT = 0.5;
    this.spellT = 3;
    this.next = null;
    this.nextSince = 0;
    this.script = (profile.script || []).map((e) => ({ ...e, done: false }));
    this.bossSpawned = false;
    this.bossT = -1;
    this.passive = false; // the tutorial holds the AI back by setting this
    this.phase = 'muster'; // muster -> push -> (fall back) muster
    this.phaseT = 0; // time spent in the current phase
    this.penalty = 1; // after a failed push the next one wants a bigger edge
    this.badTicks = 0;
    // Pressure: timed attack waves, raids on the Scribes, and an escalation that ends long stalemates.
    this.nextWave = (profile.firstAttack ?? 45) * (0.9 + b.rng.next() * 0.2);
    this.nextRaid = (profile.firstAttack ?? 45) + 20 + b.rng.next() * 25;
    this.nextFree = profile.freeWaves ? (profile.freeWaves.first ?? 25) : Infinity;
    this.freeCount = 0;
    this.raiders = new Map(); // unit -> time the raid ends
    this.escLevel = 0;
    this.waves = 0;
    this.noRetreatUntil = 0;
    if (teamIdx === 1 && b.flags && b.flags.rush && b.cfg.teams[1].startUnits) this.beginRush();
  }

  // Ambush: the starting army is already out on the field. Move it up the page and send it at the
  // player's fort right now, without turning back until the opening clash is settled.
  beginRush() {
    const t = this.team;
    for (const u of this.b.units) {
      if (u.team !== this.teamIdx || u.type === 'scribe' || u.isHero) continue;
      u.x = t.fort.x + t.dir * (850 + this.b.rng.range(0, 300));
    }
    this.rush = true;
    this.noRetreatUntil = 50;
    this.setPhase('push');
    this.nextWave = Math.max(this.nextWave, 55);
  }

  say(text) {
    this.b.emit('banner', { text, team: this.teamIdx });
  }

  runEvent(ev) {
    const b = this.b;
    if (ev.spawn) {
      for (const id in ev.spawn) for (let i = 0; i < ev.spawn[id]; i++) {
        b.spawnUnit(this.teamIdx, id, { x: this.team.fort.x + this.team.dir * (70 + i * 14) });
      }
    }
    if (ev.stance) b.setStance(this.teamIdx, ev.stance, ev.x);
    if (ev.say) this.say(ev.say);
  }

  spawnBoss() {
    const id = this.p.boss;
    if (!id || this.bossSpawned) return;
    this.bossSpawned = true;
    this.bossT = this.t;
    const u = this.b.spawnUnit(this.teamIdx, id, { x: this.team.fort.x + this.team.dir * 90, spawnTime: 1.2, level: 1 });
    this.b.boss = u;
    this.b.emit('bossArrive', { unit: u, id });
  }

  setPhase(ph) {
    if (this.phase === ph) return;
    this.phase = ph;
    this.phaseT = 0;
    this.badTicks = 0;
    this.b.setStance(this.teamIdx, ph === 'push' ? 'charge' : 'defend');
  }

  update(dt) {
    const b = this.b, t = this.team, p = this.p;
    this.t += dt;
    this.phaseT += dt;
    for (const ev of this.script) if (!ev.done && this.t >= ev.t) { ev.done = true; this.runEvent(ev); }
    if (p.boss && !this.bossSpawned && this.t >= (p.bossAt ?? 30)) this.spawnBoss();
    if (this.passive || p.passive) { t.stance = 'defend'; return; }

    this.spellT -= dt;
    if (this.spellT <= 0 && t.spells.length) { this.spellT = 1.2; this.castSpells(); }

    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = (0.4 + b.rng.next() * 0.3) * (p.thinkMul ?? 1);

    this.escalate();
    this.economy();
    this.draw();
    this.stance();
    this.raids();
    this.freeWave();
  }

  // ------------------------------------------------------------------ pressure
  // After a few minutes without a result the commander gets desperate: faster ink, faster drawing,
  // a bigger army cap, shorter gaps between waves and, from the second step, no more retreating.
  escalate() {
    const p = this.p, t = this.team;
    const at = p.escalateAt ?? (p.waveEvery > 0 ? 240 : Infinity);
    if (this.t < at) return;
    const lvl = Math.min(5, 1 + Math.floor((this.t - at) / 50));
    while (this.escLevel < lvl) {
      this.escLevel++;
      t.income *= 1.15;
      t.mods.build *= 0.88;
      t.popCap += 3;
      this.penalty = 1;
      if (this.escLevel === 1) this.say('The enemy is throwing everything at you!');
    }
  }

  waveGap() {
    const p = this.p;
    return (p.waveEvery ?? 60) * (0.85 + this.b.rng.next() * 0.3) * Math.pow(0.78, this.escLevel);
  }

  startWave() {
    this.waves++;
    this.nextWave = this.t + this.waveGap();
    this.setPhase('push');
  }

  // Fast units sometimes dash past the front line, either for the player's Scribes and wells or straight at the
  // fort, while the rest of the army fights or musters. Defending the home line matters because of them.
  raids() {
    const b = this.b, p = this.p, now = this.t;
    const foes = b.byTeam[this.opp].filter((u) => u.alive && u.targetable && !u.stealth && u.type === 'scribe');
    const fort = b.teams[this.opp].fort;
    for (const [u, r] of this.raiders) {
      let prey = null;
      if (r.fort && fort.alive) prey = fort;
      else {
        let bd = Infinity;
        for (const f of foes) { const d = Math.abs(f.x - u.x); if (d < bd) { bd = d; prey = f; } }
        if (!prey && fort.alive) prey = fort;
      }
      if (!u.alive || now > r.end || !prey || u.hp < u.maxHp * 0.35 || this.passive) {
        this.raiders.delete(u);
        if (u.alive) { u.target = null; u.retargetT = 0; }
        continue;
      }
      u.target = prey;
      u.retargetT = 1.2;
    }
    const rc = p.raid ?? (p.waveEvery > 0 ? 0.7 : 0);
    if (!(rc > 0) || now < this.nextRaid || this.raiders.size || !fort.alive) return;
    this.nextRaid = now + 26 + b.rng.next() * 24;
    if (!b.rng.chance(rc)) return;
    const pool = b.byTeam[this.teamIdx].filter((u) => u.alive && !u.isBoss && !u.isHero && !u.summoned && !u.attacking
      && u.def.speed >= 76 && !u.tags.has('tank') && !u.tags.has('large') && (u.def.behavior === 'melee' || u.def.behavior === 'cavalry'));
    pool.sort((a, c) => c.def.speed - a.def.speed || a.id - c.id); // the quickest runners go
    const n = this.escLevel >= 1 ? 3 : 2;
    const atFort = !foes.length || b.rng.chance(0.4);
    for (const u of pool.slice(0, n)) this.raiders.set(u, { end: now + 24, fort: atFort });
  }

  // Survive levels: reinforcements arrive on a timer even if the player has wrecked the enemy economy.
  freeWave() {
    const fw = this.p.freeWaves;
    if (!fw || this.t < this.nextFree) return;
    this.nextFree = this.t + fw.every * (0.9 + this.b.rng.next() * 0.2);
    const b = this.b, t = this.team;
    let budget = fw.budget * (1 + 0.1 * this.freeCount++);
    const weights = this.pickWeights();
    let i = 0;
    for (let guard = 0; guard < 12 && budget > 40; guard++) {
      const id = b.rng.weighted(weights);
      if (!id || !UNITS[id]) break;
      if (UNITS[id].cost > budget + 60) continue;
      budget -= UNITS[id].cost;
      b.spawnUnit(this.teamIdx, id, { x: t.fort.x + t.dir * (70 + (i++) * 14) });
    }
    if (fw.say && this.freeCount % 2 === 1) this.say(fw.say);
    if (this.phase !== 'push') this.setPhase('push');
  }

  // ------------------------------------------------------------------ economy and drawing
  economy() {
    const b = this.b, t = this.team, p = this.p;
    const want = Math.min(p.scribes ?? 3, t.scribeCap);
    if (t.scribes < want && t.roster.includes('scribe')) {
      if (b.canRequest(this.teamIdx, 'scribe').ok) b.requestUnit(this.teamIdx, 'scribe');
    }
  }

  pickWeights() {
    const b = this.b, p = this.p;
    const scout = scoutArmy(b, this.opp);
    const mine = myShape(b, this.teamIdx);
    const base = p.weights || { brawler: 1 };
    const out = {};
    for (const id in base) {
      if (!this.team.roster.includes(id) || !UNITS[id]) continue;
      out[id] = base[id] * (p.counter === false ? 1 : counterFactor(UNITS[id], scout, mine, p.counterStrength ?? 1));
      if (this.rich) out[id] *= 1 + UNITS[id].cost / 120;
    }
    return out;
  }

  draw() {
    const b = this.b, t = this.team, p = this.p;
    const want = Math.min(p.scribes ?? 3, t.scribeCap);
    if (t.scribes < Math.min(1, want) && this.t < 30) return; // economy first (but never freeze if the Scribes get wiped out)
    const army = t.pop - t.scribes;
    // Sitting on a fortune? Field a few more, and lean toward the pricey units.
    const rich = t.ink > 450;
    if (army >= (p.maxArmy ?? 20) * (rich ? 1.3 : 1) * (1 + 0.12 * this.escLevel)) return;
    this.rich = rich;
    this.nextSince += this.thinkT;
    // Re-pick often enough that counters track the fight, and never sit saving for something far off.
    if (this.next) {
      const cost = b.unitCost(this.teamIdx, this.next);
      const wait = (cost - t.ink) / Math.max(0.5, t.income + t.scribes * 1.2);
      if (!t.roster.includes(this.next) || wait > 14 || this.nextSince > 18) this.next = null;
    }
    if (!this.next) {
      this.next = b.rng.weighted(this.pickWeights());
      this.nextSince = 0;
    }
    if (!this.next) return;
    const c = b.canRequest(this.teamIdx, this.next);
    if (c.ok) { b.requestUnit(this.teamIdx, this.next); this.next = null; }
    else if (c.reason === 'pop' || c.reason === 'locked') this.next = null;
  }

  // ------------------------------------------------------------------ stance: muster, push as a group, fall back
  stance() {
    const b = this.b, t = this.team, p = this.p, idx = this.teamIdx;
    const mine = armyPower(b, idx);
    const theirs = armyPower(b, this.opp);
    const army = t.pop - t.scribes;
    const maxArmy = p.maxArmy ?? 20;
    const pushSize = p.pushSize ?? Math.max(3, Math.round(maxArmy * 0.6));
    const aggr = (p.aggression ?? 1.2) * this.penalty;
    const calm = this.t < (p.firstAttack ?? 45);
    const bossOut = !!(b.boss && b.boss.alive && b.boss.team === idx);

    if (this.phase === 'muster') {
      if (t.stance !== 'defend') b.setStance(idx, 'defend');
      if (calm && !bossOut) return;
      if (p.sally) {
        // Invulnerable enemy fort (Endless): only go out to meet a wave, never to siege.
        if (theirs > 0 && mine > theirs * aggr + 60 && this.phaseT > 4) this.setPhase('push');
        return;
      }
      // The bar for "big enough" drops the longer it musters, so an AI that cannot reach its ideal size still attacks.
      const need = pushSize * Math.max(0.35, 1 - this.phaseT / 160);
      const full = army >= need;
      const edge = mine > theirs * aggr + 60 || this.escLevel >= 1;
      const stale = this.phaseT > 120 && army >= maxArmy * 0.8 && mine > theirs * 0.7;
      const withBoss = bossOut && this.t > this.bossT + 6 && mine > theirs * 0.6 && army >= pushSize * 0.4;
      // On a rhythm the commander attacks with whatever it has, as long as it is a real force.
      const minForce = p.minForce ?? Math.max(2, Math.min(7, Math.round(maxArmy * 0.22)));
      const timed = p.waveEvery > 0 && this.t >= this.nextWave && army >= minForce;
      if (timed) this.startWave();
      else if ((full && edge) || stale || withBoss) {
        this.setPhase('push');
        if (p.waveEvery > 0) this.nextWave = Math.max(this.nextWave, this.t + this.waveGap() * 0.7);
      }
      return;
    }

    // phase === 'push'
    if (p.sally && theirs === 0) { this.setPhase('muster'); return; }
    const front = this.frontX();
    const mineNear = armyPower(b, idx, front);
    const theirsNear = armyPower(b, this.opp, front);
    const ef = b.teams[this.opp].fort;
    const finishing = ef.alive && ef.hp < ef.maxHp * 0.3 && mineNear > theirsNear * 0.6;
    const committed = this.t < this.noRetreatUntil || this.escLevel >= 2;
    if (!finishing && !committed && this.phaseT > 3 && mineNear < theirsNear * 0.55) this.badTicks++;
    else this.badTicks = Math.max(0, this.badTicks - 1);
    if (this.badTicks >= 3) {
      this.penalty = Math.min(1.6, this.penalty * 1.2);
      this.nextWave = Math.max(this.nextWave, this.t + this.waveGap() * 0.6); // regroup before trying again
      this.setPhase('muster');
      return;
    }

    // Protect the Scribes: raiders at the wells while the army is away means turn around.
    const home = t.fort.x;
    const raid = armyPower(b, this.opp, home);
    if (raid > 0) {
      const defenders = armyPower(b, idx, home);
      const away = Math.abs(front - home) > 900;
      if (away && !committed && raid > defenders * 0.9 && raid > mine * 0.3) { this.setPhase('muster'); return; }
    }
    // Everything dead on both sides and nothing left to push with: regroup at home.
    // A spent wave falls back and regroups with the new units instead of feeding them in one by one.
    const minForce = p.minForce ?? Math.max(2, Math.min(7, Math.round(maxArmy * 0.22)));
    const spent = p.waveEvery > 0 && !finishing && !committed && this.phaseT > 8 && army < Math.max(2, Math.ceil(minForce * 0.5));
    if ((army <= 1 || spent) && !bossOut) this.setPhase('muster');
    else if (this.phaseT > 3) this.penalty = Math.max(1, this.penalty * 0.999);
  }

  frontX() {
    let sum = 0, n = 0;
    for (const u of this.b.byTeam[this.teamIdx]) {
      if (!u.alive || u.type === 'scribe' || u.tags.has('structure')) continue;
      sum += u.x; n++;
    }
    return n ? sum / n : this.team.fort.x;
  }

  // ------------------------------------------------------------------ team supplies
  castSpells() {
    const b = this.b, t = this.team, idx = this.teamIdx;
    const foes = b.byTeam[this.opp].filter((u) => u.alive && u.type !== 'scribe' && !u.stealth);
    if (this.t < (this.p.spellAfter ?? 0)) return;
    if (foes.length < 3 && !foes.some((u) => u.isBoss || u.tags.has('large'))) return;
    for (let i = 0; i < t.spells.length; i++) {
      const s = t.spells[i];
      if (s.cd > 0) continue;
      const def = SPELLS[s.id];
      if (!def) continue;
      const x = this.spellTarget(def, foes);
      if (x != null && b.castSpell(idx, i, x)) return; // one cast per think
    }
  }

  spellTarget(def, foes) {
    const b = this.b, t = this.team;
    const value = (u) => (u.tags.has('large') || u.isBoss ? 3 : u.def.pop >= 2 ? 1.6 : u.def.pop < 1 ? 0.5 : 1);
    if (def.target === 'area' || def.target === 'line') {
      const r = (def.radius || (def.width || 200) / 2);
      let best = null, bestV = 0;
      for (let i = 0; i < foes.length; i += Math.max(1, Math.floor(foes.length / 24))) {
        const c = foes[i];
        let v = 0;
        for (const o of foes) if (Math.abs(o.x - c.x) <= r) v += value(o);
        if (v > bestV) { bestV = v; best = c; }
      }
      return bestV >= (this.p.spellMin ?? 3.5) ? best.x : null;
    }
    if (def.target === 'ally') {
      let best = null, bestN = 0;
      const mine = b.byTeam[this.teamIdx].filter((u) => u.alive && u.type !== 'scribe' && u.attacking);
      for (const c of mine) {
        const n = mine.filter((o) => Math.abs(o.x - c.x) <= (def.radius || 200)).length;
        if (n > bestN) { bestN = n; best = c; }
      }
      return bestN >= 4 ? best.x : null;
    }
    if (def.target === 'global') return foes.length >= 5 ? b.width / 2 : null;
    // 'point': a wall in front of the home line when they push in, reinforcements at the front otherwise.
    const nearHome = foes.filter((u) => Math.abs(u.x - t.fort.x) < 900);
    if (def.id === 'sticky_wall') {
      if (nearHome.length < 4) return null;
      return t.fort.x + t.dir * (DEFEND_OFFSET + 90);
    }
    const mineFront = this.frontX();
    const close = foes.filter((u) => Math.abs(u.x - mineFront) < 420).length;
    return close >= 3 ? mineFront : null;
  }
}

export function unitCostOf(id) {
  return UNITS[id] ? UNITS[id].cost : Infinity;
}

// Default pick weights for a list of unit ids, by role. Used by the player bot, Daily and Skirmish.
const ROLE_WEIGHT = { melee: 3, tank: 1.6, ranged: 2.4, cavalry: 1.2, assassin: 0.8, support: 1, caster: 1, siege: 0.8, heavy: 0.6 };
export function roleWeights(ids, o = {}) {
  const w = {};
  for (const id of ids) {
    const d = UNITS[id];
    if (!d || d.summon || d.hero || d.boss || id === 'scribe') continue;
    let x = ROLE_WEIGHT[d.role] ?? 1;
    if (d.behavior === 'bomber') x = 0.9;
    if (d.role === 'heavy' && o.noHeavy) x = 0;
    if (x > 0) w[id] = x;
  }
  return w;
}
