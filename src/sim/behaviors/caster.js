// OWNER: units builder (package A)
// behavior 'caster' (Doodler, Dust Mage): homing bolts.
//   def.chain N          the bolt jumps to the next nearest enemy within 150 px, N targets in all,
//                        damage x def.chainFalloff per jump. Emits chain { x1 y1 x2 y2 team }.
//   def.aoe {radius}     the bolt splashes on impact instead (Dust Mage).
//   def.summonId/Every/Max  the Doodler draws critters.
// Perks: extra_scribble (+1 chain), doodle_pals (3 critters), storm_scribble (stun 0.5 s).
import { BEHAVIORS } from '../registry.js';
import { rangedUpdate } from './ranged.js';

const JUMP_RANGE = 150;
const JUMP_DELAY = 0.09;

function chainCount(u) {
  return (u.def.chain || 0) + (u.perks.has('extra_scribble') ? 1 : 0);
}

function stunIf(u, t) {
  if (u.perks.has('storm_scribble') && t.alive && !t.isFort) t.addBuff({ id: 'stun', t: 0.5, stun: true });
}

// Lightning continues from `from` to the next enemies, one jump every JUMP_DELAY seconds.
function startChain(b, u, first, dmg, targets) {
  const hit = new Set([first.id]);
  const fall = u.def.chainFalloff ?? 0.7;
  b.areas.push({
    // segs are kept for the renderer (AREA_DRAW.chain_jump) and fade out after the last jump
    kind: 'chain_jump', x: first.x, team: u.team, alive: true, from: first, left: targets - 1, t: JUMP_DELAY, dmg, segs: [],
    update(bb, dt) {
      for (let i = this.segs.length - 1; i >= 0; i--) {
        this.segs[i].age += dt;
        if (this.segs[i].age > 0.5) this.segs.splice(i, 1);
      }
      if (this.left <= 0) {
        if (this.segs.length === 0) this.alive = false;
        return;
      }
      this.t -= dt;
      if (this.t > 0) return;
      this.t = JUMP_DELAY;
      const f = this.from;
      let best = null, bd = JUMP_RANGE;
      for (const e of bb.byTeam[1 - u.team]) {
        if (!e.alive || !e.targetable || hit.has(e.id) || e.stealth) continue;
        if (e.flying && !(e.data && e.data.landed)) continue;
        const d = Math.abs(e.x - f.x) - e.radius;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) { this.left = 0; return; }
      hit.add(best.id);
      this.dmg *= fall;
      const seg = { x1: f.x, y1: f.y - f.height * 0.55, x2: best.x, y2: best.y - best.height * 0.55, z: best.z, age: 0 };
      this.segs.push(seg);
      bb.emit('chain', { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, z: best.z, team: u.team });
      bb.damage(best, this.dmg, { source: u, team: u.team, kind: 'magic', dir: Math.sign(best.x - f.x) || 1, kb: u.kb * 0.5 });
      stunIf(u, best);
      this.from = best;
      this.left--;
    },
  });
}

function castBolt(u, b, t) {
  if (!t || !t.alive) return;
  const dmg = u.dmg * u.mod.dmg;
  const aoe = u.def.aoe;
  if (aoe) {
    b.bolt(u, t, dmg, { aoe: aoe.radius, speed: 460 });
    return;
  }
  const n = chainCount(u);
  const p = b.bolt(u, t, dmg);
  p.onImpact = (bb, pr, target) => {
    if (!target || target.isFort) return;
    stunIf(u, target);
    if (n > 1) startChain(bb, u, target, pr.dmg, n);
  };
}

function summon(u, b, dt) {
  const def = u.def;
  const d = u.data;
  if (!def.summonId || b.result) return;
  const max = def.summonMax + (u.perks.has('doodle_pals') ? 1 : 0);
  const every = def.summonEvery || 16;
  d.pals = (d.pals || []).filter((p) => p.alive);
  d.summonT = (d.summonT ?? every * 0.5) + dt;
  if (d.summonT < every || d.pals.length >= max) return;
  d.summonT = 0;
  const c = b.spawnUnit(u.team, def.summonId, { x: u.x + u.dir * 26, summoned: true, lifetime: every * 3 });
  d.pals.push(c);
  b.emit('summon', { unit: c, x: c.x, z: c.z, team: u.team, by: u });
}

BEHAVIORS.caster = {
  init(u) {
    u.data.pals = [];
  },
  update(u, b, dt) {
    summon(u, b, dt);
    rangedUpdate(u, b, dt, { onShoot: castBolt });
    u.anim.cast = u.attacking ? 1 : Math.max(0, (u.anim.cast || 0) - dt * 3);
  },
};
