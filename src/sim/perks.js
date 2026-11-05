// OWNER: AI/levels/modes builder (package C)
// Endless draft perk effects (data/perks.js). PERK_IMPL[id] = { apply(b, teamIdx), update?(b, teamIdx, dt) }.
// apply runs once per pick (stackable perks run it again); future units pick the change up through
// the team mods / STAT_HOOKS below, and apply also patches the units that are already alive.
import { PERK_IMPL, STAT_HOOKS, TRAITS } from './registry.js';
import { clamp } from '../core/util.js';

// How many times a perk may be offered again after it is owned. Anything missing is unique.
export const PERK_STACK = {
  sharp_swords: 4, quick_quills: 3, thick_paper: 4, long_arms: 2, ink_flow: 4, cheap_ink: 3,
  fast_feet: 2, patch_up: 99, big_barracks: 4, hot_coffee: 3, armor_plates: 3,
};

const flags = (b, i) => b.teams[i].mods.flags;
const state = (b, i, id) => {
  const t = b.teams[i];
  const s = t.perkState || (t.perkState = {});
  return s[id] || (s[id] = {});
};
const mine = (b, i) => b.units.filter((u) => u.alive && u.team === i && !u.def.structure && !u.tags.has('structure'));

// Future melee units and Scribes read these team flags when they are created.
STAT_HOOKS.push((def, lv, s, team) => {
  const f = team.mods.flags || {};
  if (f.meleeDmg && def.tags && def.tags.includes('melee') && !def.hero && !def.boss) s.dmg *= f.meleeDmg;
  if (f.scribeHp && def.id === 'scribe') s.hp *= f.scribeHp;
});

// Units that were already on the field.
function scale(b, i, key, k, pred) {
  for (const u of mine(b, i)) {
    if (pred && !pred(u)) continue;
    if (key === 'hp') { u.maxHp *= k; u.hp *= k; } else u[key] *= k;
  }
}

const P = PERK_IMPL;

P.sharp_swords = {
  apply(b, i) {
    const f = flags(b, i);
    f.meleeDmg = (f.meleeDmg || 1) * 1.15;
    scale(b, i, 'dmg', 1.15, (u) => u.tags.has('melee') && !u.isHero && !u.isBoss);
  },
};
P.quick_quills = { apply(b, i) { b.teams[i].mods.build *= 0.85; } };
P.thick_paper = {
  apply(b, i) {
    b.teams[i].mods.hp *= 1.15;
    scale(b, i, 'hp', 1.15, (u) => !u.isHero && !u.isBoss);
  },
};
P.long_arms = {
  apply(b, i) {
    b.teams[i].mods.rangedRange += 60;
    for (const u of mine(b, i)) if (u.def.proj) u.range += 60;
  },
};
P.ink_flow = { apply(b, i) { b.teams[i].income += 1.5; } };
P.cheap_ink = { apply(b, i) { b.teams[i].mods.cost *= 0.9; } };
P.fast_feet = {
  apply(b, i) {
    b.teams[i].mods.speed *= 1.12;
    scale(b, i, 'speed', 1.12);
  },
};
P.patch_up = {
  apply(b, i) {
    const f = b.teams[i].fort;
    if (f.alive) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.25);
  },
};
P.big_barracks = { apply(b, i) { b.teams[i].popCap += 5; } };
P.hot_coffee = {
  apply(b, i) {
    const t = b.teams[i];
    t.mods.spellCd *= 0.8;
    for (const s of t.spells) { s.cd *= 0.8; s.maxCd *= 0.8; }
  },
};
P.vampire_ink = { apply(b, i) { b.teams[i].mods.lifesteal += 0.1; } };
P.iron_scribes = {
  apply(b, i) {
    const f = flags(b, i);
    f.scribeCarry = 2;
    f.scribeHp = 3;
    scale(b, i, 'hp', 3, (u) => u.type === 'scribe');
  },
};
P.tower_volley = { apply(b, i) { const tu = b.teams[i].fort.turret; tu.shots += 2; } };
P.armor_plates = {
  apply(b, i) {
    b.teams[i].mods.armor += 0.1;
    for (const u of mine(b, i)) u.armor = clamp(u.armor + 0.1, 0, 0.85);
  },
};
P.heavy_hitters = {
  apply(b, i) {
    const t = b.teams[i];
    t.mods.kb *= 1.5;
    t.mods.vsLarge *= 1.1;
    scale(b, i, 'kb', 1.5);
  },
};
P.giant_slayer = { apply(b, i) { b.teams[i].mods.vsLarge *= 2; } };
P.hero_vigor = {
  apply(b, i) {
    const t = b.teams[i];
    t.mods.heroHp *= 1.4;
    t.mods.heroDmg *= 1.4;
    if (t.hero && t.hero.alive) { t.hero.maxHp *= 1.4; t.hero.hp *= 1.4; t.hero.dmg *= 1.4; }
  },
};

// Ranged hits set targets alight for 3 seconds.
P.fire_everything = {
  update(b, i) {
    for (const p of b.projectiles) {
      if (!p.alive || p.team !== i || p._fire || !p.source || !p.source.def.proj) continue;
      p._fire = true;
      p.effects = { ...(p.effects || {}), burn: { dps: 10, t: 3 } };
    }
  },
};

// Brawlers go out with a bang.
TRAITS.perkMartyr = {
  onDeath(u, b, info) {
    if (info && info.kind === 'expire') return;
    b.explode(u.x, 0, 105, 90 + 4 * (u.level || 1), { team: u.team, source: u, kb: 160, friendlyFire: 0.25, fx: 'ink' });
  },
};
P.martyrs = {
  update(b, i) {
    for (const u of b.units) {
      if (u.alive && u.team === i && u.type === 'brawler' && !u.traits.includes('perkMartyr')) u.traits.push('perkMartyr');
    }
  },
};

// Units drawn after the perk was taken: handle each exactly once.
function freshUnits(b, i, st) {
  const out = [];
  if (st.lastId == null) { st.lastId = b.nextId - 1; return out; }
  for (let k = b.units.length - 1; k >= 0; k--) {
    const u = b.units[k];
    if (u.id <= st.lastId) break;
    if (u.team === i && !u.isHero && !u.isBoss && !u.summoned && !u.data.dup && u.type !== 'scribe') out.push(u);
  }
  st.lastId = b.nextId - 1;
  return out;
}

// Every fifth unit you draw gives its ink back.
P.free_fifth = {
  update(b, i) {
    const st = state(b, i, 'free_fifth');
    for (const u of freshUnits(b, i, st)) {
      st.n = (st.n || 0) + 1;
      if (st.n % 5 === 0) {
        b.teams[i].ink += b.unitCost(i, u.type);
        b.emit('perkProc', { id: 'free_fifth', x: u.x, z: u.z, team: i });
      }
    }
  },
};

// 20% of drawn units arrive as a pair.
P.double_draw = {
  update(b, i) {
    const st = state(b, i, 'double_draw');
    for (const u of freshUnits(b, i, st)) {
      if (!b.rng.chance(0.2)) continue;
      const c = b.spawnUnit(i, u.type, { x: u.x - u.dir * 18, z: clamp(u.z + b.rng.range(-0.5, 0.5), -1, 1) });
      c.data.dup = true;
      b.emit('perkProc', { id: 'double_draw', x: u.x, z: u.z, team: i });
    }
    st.lastId = b.nextId - 1; // the copy is not eligible either
  },
};

// Once per wave the fort heals 40% when it drops under 30%.
P.second_wind = {
  update(b, i) {
    const st = state(b, i, 'second_wind');
    const f = b.teams[i].fort;
    const wave = b.endless ? b.endless.wave : 0;
    if (st.wave !== wave) { st.wave = wave; st.used = false; }
    if (!st.used && f.alive && f.hp < f.maxHp * 0.3) {
      st.used = true;
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.4);
      b.emit('perkProc', { id: 'second_wind', x: f.x, z: 0, team: i });
      b.emit('banner', { text: 'Second Wind!', team: i });
    }
  },
};

// Every 12 seconds lightning hits the strongest enemy.
P.storm_caller = {
  update(b, i, dt) {
    const st = state(b, i, 'storm_caller');
    st.t = (st.t ?? 8) - dt;
    if (st.t > 0) return;
    let best = null;
    for (const e of b.byTeam[1 - i]) if (e.alive && e.targetable && (!best || e.hp > best.hp)) best = e;
    if (!best) { st.t = 1; return; }
    st.t = 12;
    const wave = b.endless ? b.endless.wave : 1;
    b.damage(best, 150 + 14 * wave, { team: i, kind: 'magic', kb: 160, dir: best.x > b.teams[i].fort.x ? 1 : -1 });
    b.areas.push({ kind: 'storm_bolt', x: best.x, y: best.y, seed: b.rng.int(1, 999), t: 0, dur: 0.5, alive: true, update(bb, dt2) { this.t += dt2; if (this.t >= this.dur) this.alive = false; } });
    b.emit('spellFx', { id: 'storm_caller', phase: 'impact', x: best.x, z: best.z, team: i });
  },
};

// Every 10 seconds, 10% of the ink you are sitting on.
P.ink_bank = {
  update(b, i, dt) {
    const st = state(b, i, 'ink_bank');
    st.t = (st.t ?? 10) - dt;
    if (st.t > 0) return;
    st.t = 10;
    const t = b.teams[i];
    t.ink += t.ink * 0.1;
  },
};

