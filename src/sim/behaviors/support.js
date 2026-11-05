// OWNER: units builder (package A)
// behavior 'support': Medic heals the most hurt ally in range on its cast cooldown and stays behind
// the melee line. The same code runs enemy supports through def fields:
//   def.heal                   hp restored per cast
//   def.auraBuff {speed,dmg,dur}  Glow Shaman: buffs every ally in range each cast
//   def.reviveEvery (s)        Whiteout Priest: redraws a recently fallen ally
// Medic perks: bandages (+30% heal), triage (two targets), revive (every 25 s).
// Events: healBeam { x1 y1 x2 y2 team }, aura { x radius team kind }, revive { unit x z team }.
import { BEHAVIORS, BATTLE_INIT_HOOKS } from '../registry.js';
import { gap, moveToward, beginAttack, updateAttack, slotX, face, findEnemy } from '../common.js';
import { UNIT_LEVEL } from '../../data/upgrades.js';

const REVIVE_WINDOW = 10; // only allies that fell this recently can come back
const REVIVE_RANGE = 450;
const THREAT_GAP = 80;

// Battle-wide record of recent deaths. Dead units leave b.units quickly, so wrap kill() once.
BATTLE_INIT_HOOKS.push((b) => {
  b.graveyard = [];
  const kill = b.kill.bind(b);
  b.kill = (t, info = {}) => {
    const was = t.alive;
    kill(t, info);
    if (was && !t.alive && info.kind !== 'expire' && !t.isHero && !t.isBoss && !t.summoned && !t.isFort && !t.tags.has('structure') && !t.data.noRevive) {
      b.graveyard.push({ id: t.type, team: t.team, x: t.x, z: t.z, level: t.level, t: b.time, cost: t.def.cost || 0 });
      if (b.graveyard.length > 60) b.graveyard.shift();
    }
  };
});

export function healAmount(u) {
  let h = u.def.heal || 0;
  h *= 1 + UNIT_LEVEL.dmgPer * (u.level - 1);
  if (u.perks.has('bandages')) h *= 1.3;
  return h;
}

function hurtAllies(u, b, range) {
  const out = [];
  for (const a of b.byTeam[u.team]) {
    if (!a.alive || a === u || a.isFort || a.hp >= a.maxHp * 0.995) continue;
    if (gap(u, a) > range) continue;
    out.push(a);
  }
  out.sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
  return out;
}

function frontlineX(u, b) {
  const dir = b.teams[u.team].dir;
  let front = null;
  for (const a of b.byTeam[u.team]) {
    if (!a.alive || a === u || a.type === 'scribe' || a.tags.has('support') || a.tags.has('siege')) continue;
    if (front === null || (a.x - front) * dir > 0) front = a.x;
  }
  return front;
}

function castHeal(u, b) {
  const def = u.def;
  const range = u.range;
  const amt = healAmount(u);
  const targets = hurtAllies(u, b, range);
  const maxT = u.perks.has('triage') ? 2 : 1;
  if (def.heal) {
    for (let i = 0; i < Math.min(maxT, targets.length); i++) {
      const a = targets[i];
      b.heal(a, amt, u);
      b.emit('healBeam', { x1: u.x + u.facing * 8, y1: u.y - 46 * u.scale, x2: a.x, y2: a.y - a.height * 0.6, z: u.z, team: u.team });
    }
  }
  if (def.auraBuff) {
    const ab = def.auraBuff;
    for (const a of b.byTeam[u.team]) {
      if (!a.alive || a.isFort || gap(u, a) > range) continue;
      a.addBuff({ id: 'glow_aura', t: ab.dur ?? 3, speed: ab.speed, dmg: ab.dmg });
    }
    b.emit('aura', { x: u.x, radius: range, team: u.team, kind: 'glow', z: u.z });
  }
}

function threatened(u, b) {
  return findEnemy(u, b, THREAT_GAP) !== null;
}

function needsCast(u, b) {
  if (u.def.auraBuff) {
    // Pulse while a fight is on.
    const near = findEnemy(u, b, 650);
    if (near) return true;
  }
  return u.def.heal > 0 && hurtAllies(u, b, u.range).length > 0;
}

function tryRevive(u, b, dt) {
  const d = u.data;
  const every = u.def.reviveEvery ?? (u.perks.has('revive') ? 25 : 0);
  if (!every) return;
  d.reviveT = (d.reviveT ?? every * 0.5) + dt;
  if (d.reviveT < every) return;
  const g = b.graveyard;
  if (!g) return;
  let bi = -1, bv = -1;
  for (let i = 0; i < g.length; i++) {
    const e = g[i];
    if (e.team !== u.team || b.time - e.t > REVIVE_WINDOW || Math.abs(e.x - u.x) > REVIVE_RANGE) continue;
    if (e.cost > bv) { bv = e.cost; bi = i; }
  }
  if (bi < 0) return;
  const e = g.splice(bi, 1)[0];
  d.reviveT = 0;
  const r = b.spawnUnit(u.team, e.id, { x: e.x, z: e.z, level: e.level, hpFrac: 0.5 });
  b.emit('revive', { unit: r, x: e.x, z: e.z, team: u.team, by: u });
}

BEHAVIORS.support = {
  init(u) {
    u.data.reviveT = undefined;
  },
  update(u, b, dt) {
    const team = b.teams[u.team];
    if (u.attacking) {
      updateAttack(u, b, dt, (uu, bb) => castHeal(uu, bb));
      u.anim.cast = 1;
      tryRevive(u, b, dt);
      return;
    }
    u.anim.cast = 0;
    tryRevive(u, b, dt);
    // An enemy in our face: step back toward our own side.
    if (threatened(u, b)) {
      const fortEdge = team.fort.x + team.dir * (team.fort.radius + 24);
      const back = u.x - team.dir * 120;
      const limit = team.dir > 0 ? Math.max(back, fortEdge) : Math.min(back, fortEdge);
      moveToward(u, b, limit, dt, 1.15);
      return;
    }
    u.retargetT -= dt;
    if (u.retargetT <= 0) {
      u.retargetT = 0.25;
      u.data.cast = needsCast(u, b);
    }
    if (u.data.cast && u.atkT <= 0) {
      const t = hurtAllies(u, b, u.range)[0] || u;
      face(u, t === u ? { x: u.x + team.dir } : t);
      beginAttack(u, t);
      u.facing = Math.sign(t.x - u.x) || team.dir;
      return;
    }
    // Follow the army from behind. A hurt ally just out of reach pulls us forward (never past the line).
    const front = frontlineX(u, b);
    let want = slotX(u, b);
    if (team.stance === 'charge') want = front !== null ? front - team.dir * 110 : want;
    const hurt = hurtAllies(u, b, u.range + 160)[0];
    if (hurt && gap(u, hurt) > u.range * 0.8) {
      want = hurt.x - Math.sign(hurt.x - u.x) * (u.range * 0.7);
      if (front !== null) want = team.dir > 0 ? Math.min(want, front - 40) : Math.max(want, front + 40);
    }
    if (moveToward(u, b, want, dt)) u.facing = team.dir;
  },
};
