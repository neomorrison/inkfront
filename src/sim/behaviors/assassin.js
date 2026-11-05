// OWNER: units builder (package A)
// behavior 'assassin' (Ninja): spawns stealthed (TRAITS.stealth), slips past the front line to hunt
// ranged / support / caster / siege / worker targets, and opens with a backstab (def.backstab x;
// death_mark 4x) that reveals him. Perks: smoke_bomb (re-stealth after a kill), shadow_step
// (teleport behind the first target), death_mark.
// Events: backstab { unit target x y z team mult }, smoke { x z team }.
import { BEHAVIORS } from '../registry.js';
import { gap, moveToward, beginAttack, updateAttack, slotX, face, meleeHit, bonusVs } from '../common.js';

const PREY = ['ranged', 'support', 'caster', 'siege', 'worker'];

function isPrey(e) {
  for (const t of PREY) if (e.tags.has(t)) return true;
  return false;
}

function pickPrey(u, b) {
  const team = b.teams[u.team];
  const reach = team.stance === 'charge' ? 900 : 650;
  let best = null, bestScore = Infinity;
  for (const e of b.byTeam[1 - u.team]) {
    if (!e.alive || !e.targetable || e.stealth || e.flying) continue;
    const g = gap(u, e);
    const prey = isPrey(e);
    if (g > (prey ? reach : 260)) continue;
    const score = g - (prey ? 600 : 0) + (e.taunt ? 80 : 0);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (best) return best;
  const ef = b.teams[1 - u.team].fort;
  if (ef.alive) {
    const g = gap(u, ef);
    if (g <= u.range + 4 || (team.stance === 'charge' && g <= u.aggro + 200)) return ef;
  }
  return null;
}

function strike(u, b, t) {
  if (!t || !t.alive) return;
  if (gap(u, t) > u.range + 16) return;
  if (u.stealth && !t.isFort) {
    const mult = u.perks.has('death_mark') ? 4 : (u.def.backstab ?? 2);
    const dmg = u.dmg * u.mod.dmg * mult * bonusVs(u, t, b);
    u.stealth = false;
    b.damage(t, dmg, { source: u, team: u.team, kind: 'melee', dir: u.facing, kb: u.kb * 1.5, crit: true });
    b.emit('backstab', { unit: u, target: t, x: t.x, y: t.y - t.height * 0.55, z: t.z, team: u.team, mult });
    b.emit('smoke', { x: u.x, z: u.z, team: u.team });
  } else {
    meleeHit(u, b, t);
  }
  if (!t.alive && !t.isFort && u.perks.has('smoke_bomb')) {
    u.stealth = true;
    u.data.stepped = false;
    b.emit('smoke', { x: u.x, z: u.z, team: u.team });
  }
}

BEHAVIORS.assassin = {
  init(u) {
    u.data.stepped = false;
  },
  update(u, b, dt) {
    if (u.attacking) {
      updateAttack(u, b, dt, strike);
      return;
    }
    u.retargetT -= dt;
    if (u.retargetT <= 0 || !u.target || !u.target.alive) {
      u.target = pickPrey(u, b);
      u.retargetT = 0.3;
    }
    const t = u.target;
    if (t) {
      let g = gap(u, t);
      // Shadow step: blink to the far side of the first target once it is close.
      if (u.stealth && !u.data.stepped && !t.isFort && u.perks.has('shadow_step') && g < 240) {
        u.data.stepped = true;
        b.emit('smoke', { x: u.x, z: u.z, team: u.team });
        const side = Math.sign(t.x - u.x) || u.dir;
        u.x = t.x + side * (t.radius + u.radius + 8);
        u.facing = -side;
        b.emit('smoke', { x: u.x, z: u.z, team: u.team });
        g = gap(u, t);
      }
      if (g <= u.range) {
        face(u, t);
        if (u.atkT <= 0) beginAttack(u, t);
      } else {
        const side = Math.sign(u.x - t.x) || -u.dir;
        moveToward(u, b, t.x + side * ((t.radius || 0) + u.radius + Math.max(4, u.range * 0.5)), dt);
      }
      return;
    }
    if (moveToward(u, b, slotX(u, b), dt)) u.facing = b.teams[u.team].dir;
  },
};
