// Enemy commander. Reads a profile (level.enemy + level.script) and plays the same rules as
// the player: Scribes for ink, weighted unit picks, stance changes, timed script events.
// OWNER: AI/levels builder (package C) extends this (counter-picking, spells, boss timing).
import { UNITS } from '../data/units.js';
import { armyPower } from './common.js';

export class AICommander {
  constructor(b, teamIdx, profile) {
    this.b = b;
    this.teamIdx = teamIdx;
    this.team = b.teams[teamIdx];
    this.p = profile;
    this.t = 0;
    this.thinkT = 0.5;
    this.next = null;
    this.script = (profile.script || []).map((e) => ({ ...e, done: false }));
    this.bossSpawned = false;
    this.passive = false; // tutorial can hold the AI back
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
    const u = this.b.spawnUnit(this.teamIdx, id, { x: this.team.fort.x + this.team.dir * 90, spawnTime: 1.2, level: 1 });
    this.b.boss = u;
    this.b.emit('bossArrive', { unit: u, id });
  }

  update(dt) {
    const b = this.b, t = this.team, p = this.p;
    this.t += dt;
    for (const ev of this.script) if (!ev.done && this.t >= ev.t) { ev.done = true; this.runEvent(ev); }
    if (p.boss && !this.bossSpawned && this.t >= (p.bossAt ?? 30)) this.spawnBoss();
    if (this.passive) { t.stance = 'defend'; return; }

    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.4 + b.rng.next() * 0.3;

    // Economy first: keep the Scribe count up.
    const wantScribes = Math.min(p.scribes ?? 3, t.scribeCap);
    if (t.scribes < wantScribes && t.roster.includes('scribe')) {
      if (b.canRequest(this.teamIdx, 'scribe').ok) b.requestUnit(this.teamIdx, 'scribe');
      if (t.scribes < 1) return;
    }

    // Army: pick a unit by weight, save up for it, then draw it.
    const army = t.pop - t.scribes;
    if (army < (p.maxArmy ?? 20)) {
      if (!this.next || !t.roster.includes(this.next)) this.next = b.rng.weighted(p.weights || { brawler: 1 });
      if (this.next) {
        const c = b.canRequest(this.teamIdx, this.next);
        if (c.ok) { b.requestUnit(this.teamIdx, this.next); this.next = null; }
        else if (c.reason === 'pop' || c.reason === 'locked') this.next = null;
      }
    }

    // Stance.
    const mine = armyPower(b, this.teamIdx);
    const theirs = armyPower(b, 1 - this.teamIdx);
    if (this.t < (p.firstAttack ?? 45) && !this.b.boss) {
      if (t.stance !== 'defend') b.setStance(this.teamIdx, 'defend');
    } else if (t.stance !== 'charge' && mine > theirs * (p.aggression ?? 1.2) + 60) {
      b.setStance(this.teamIdx, 'charge');
    } else if (t.stance === 'charge' && mine < theirs * 0.55) {
      b.setStance(this.teamIdx, 'defend');
    }
  }
}

export function unitCostOf(id) {
  return UNITS[id] ? UNITS[id].cost : Infinity;
}
