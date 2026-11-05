// OWNER: factions/bosses builder (package B)
// behaviors boss_redline, boss_smudge, boss_wyrm, boss_professor, boss_hand.
// Every big attack is telegraphed: a 'telegraph' area stays alive (so the renderer can draw the
// warning) and the attack resolves from the boss's act when the delay is up. At 50% hp each boss
// escalates once (summons, shorter cooldowns). New events: bossIntro, bossDash, bossStep,
// bossSlam, bossRoar, bossBelch, bossBreath, bossEscalate, bossDown, quizStun, handStab, handRedraw, erased.
import { BEHAVIORS } from '../registry.js';
import { clamp, approach, smooth } from '../../core/util.js';
import { clampToBlockers } from '../common.js';
import { initBoss, marchLimit, tickCooldowns, runAct, startAct, actPose, telegraph, groundEnemies, nearestEnemy, densest, hitGround, bossMelee, clearBossAreas, fortFocus, hitFortAt } from './boss_kit.js';
import { Projectile } from '../projectile.js';

const sgn = (v, d = 1) => Math.sign(v) || d;
const countOf = (b, team, type) => { let n = 0; for (const u of b.units) if (u.alive && u.team === team && u.type === type) n++; return n; };
const dmgOf = (u, m = 1) => u.dmg * u.mod.dmg * m;

function banner(b, u, text) {
  b.emit('banner', { text, team: u.team });
  b.emit('bossEscalate', { unit: u, id: u.type, x: u.x });
}

// Sketch `n` helpers in front of the boss (toward the enemy).
function summon(b, u, id, n, o = {}) {
  if (countOf(b, u.team, id) >= (o.cap ?? 12)) return;
  for (let i = 0; i < n; i++) {
    const x = clamp(u.x + u.dir * (o.base ?? 70) + u.dir * i * (o.step ?? 30), 40, b.width - 40);
    b.spawnUnit(u.team, id, { x, spawnTime: o.spawnTime ?? 0.8, summoned: true });
  }
}

function onBossDeath(u, b) {
  clearBossAreas(b, u);
  b.emit('bossDown', { unit: u, id: u.type, x: u.x, y: u.y, z: u.z });
}

// ================================================================= General Redline
// Dash at a unit 180-760 px away, preferring the soft back line (ranged, support, the Captain), and
// run through everything standing in between.
function dashTarget(u, b) {
  let best = null, bs = -Infinity;
  for (const e of groundEnemies(b, u)) {
    const dist = Math.abs(e.x - u.x);
    if (dist < 180 || dist > 760) continue;
    const soft = e.isHero || e.tags.has('ranged') || e.tags.has('support') || e.tags.has('caster') ? 400 : 0;
    const sc = soft + dist * 0.3 + (e.type === 'scribe' ? -300 : 0);
    if (sc > bs) { bs = sc; best = e; }
  }
  // Close to the player's fort with nobody worth chasing (or now and then anyway): charge the gate.
  const ff = fortFocus(b, u, 740);
  if (ff && ff.near && Math.abs(ff.x - u.x) >= 200 && (!best || b.rng.next() < 0.3)) return { x: ff.x };
  return best;
}

function redlineDash(u, b, tgt) {
  const dirn = sgn(tgt.x - u.x, u.dir);
  const len = clamp(Math.abs(tgt.x - u.x) + 90, 320, 680), wind = 0.9, speed = 800;
  u.facing = dirn;
  u.data.cd.dash = (u.data.escalated ? 9 : 13) + b.rng.range(0, 2);
  telegraph(b, u, { shape: 'band', kind: 'dash', x: u.x + dirn * (len / 2), width: len, delay: wind });
  startAct(u, {
    t: 0, phase: 0, traveled: 0, dust: 0, hit: new Set(), hitFort: false,
    tick(u, b, dt) {
      this.t += dt;
      if (this.phase === 0) {
        actPose(u, 0.42 * Math.min(1, this.t / wind));
        u.facing = dirn;
        if (this.t >= wind) { this.phase = 1; this.t = 0; b.emit('bossDash', { unit: u, x: u.x, dirn, z: u.z }); }
        return false;
      }
      if (this.phase === 1) {
        actPose(u, 0.5);
        const step = speed * dt;
        const nx = clampToBlockers(u, b, u.x + dirn * step);
        const moved = Math.abs(nx - u.x);
        u.x = nx;
        u.facing = dirn;
        u.anim.moving = true;
        u.anim.walk += moved;
        this.traveled += moved;
        for (const e of groundEnemies(b, u)) {
          if (this.hit.has(e.id) || Math.abs(e.x - u.x) > e.radius + u.radius + 16) continue;
          this.hit.add(e.id);
          b.damage(e, dmgOf(u, 1.1), { source: u, team: u.team, kind: 'melee', dir: dirn, kb: 360 });
        }
        const ef = b.teams[1 - u.team].fort;
        if (!this.hitFort && ef.alive && Math.abs(ef.x - u.x) - ef.radius - u.radius <= 12) {
          this.hitFort = true;
          b.damageFort(ef, dmgOf(u, 2), { source: u, kind: 'melee' });
        }
        if ((this.dust -= dt) <= 0) { this.dust = 0.05; b.emit('bossStep', { x: u.x, z: u.z, dirn }); }
        if (moved < step * 0.5 || this.traveled >= len) { this.phase = 2; this.t = 0; b.emit('bossSlam', { x: u.x + dirn * 30, radius: 80, kind: 'dashEnd', unit: u, z: u.z }); }
        return false;
      }
      actPose(u, 0.5 + 0.5 * Math.min(1, this.t / 0.5));
      return this.t >= 0.5;
    },
  });
}

function redlineWarCry(u, b) {
  u.data.cd.cry = u.data.escalated ? 15 : 20;
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      actPose(u, 0.42);
      if (!this.fired && this.t >= 0.5) {
        this.fired = true;
        b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'warcry', team: u.team });
        for (const a of b.byTeam[u.team]) {
          if (a.alive && Math.abs(a.x - u.x) <= 650) a.addBuff({ id: 'warcry', t: 5, dmg: 1.15, atkSpeed: 1.1, speed: 1.08 });
        }
      }
      return this.t >= 1.0;
    },
  });
}

BEHAVIORS.boss_redline = {
  init(u, b) { initBoss(u, b, { cd: { dash: 6, cry: 11 } }); },
  update(u, b, dt) {
    const d = u.data;
    tickCooldowns(u, dt);
    if (!d.escalated && u.hp <= u.maxHp * 0.5) {
      d.escalated = true;
      banner(b, u, 'Redline calls for backup!');
      summon(b, u, 'brawler', 3, { base: 60 });
      d.cd.dash = Math.min(d.cd.dash, 2.5);
      u.speed *= 1.15;
      u.atkCd *= 0.8;
      b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'rally', team: u.team });
    }
    if (runAct(u, b, dt)) return;
    if (!u.attacking) {
      if (d.cd.cry <= 0) { redlineWarCry(u, b); return; }
      if (d.cd.dash <= 0) {
        const tgt = dashTarget(u, b);
        if (tgt) { redlineDash(u, b, tgt); return; }
        d.cd.dash = 0.6;
      }
    }
    bossMelee(u, b, dt);
  },
  onDeath: onBossDeath,
};

// ================================================================= Old Smudge
function addSmear(b, u, x) {
  b.areas.push({
    kind: 'smear', team: u.team, boss: u, x, radius: 52, t: 0, dur: 10, alive: true, seed: b.rng.int(0, 999),
    update(bb, dt) {
      this.t += dt;
      if (this.t >= this.dur) { this.alive = false; return; }
      for (const e of groundEnemies(bb, this.boss)) {
        if (Math.abs(e.x - this.x) <= this.radius + e.radius * 0.5) e.addBuff({ id: 'smear', t: 0.5, speed: 0.55 });
      }
    },
  });
}

// Slam toward the thickest part of the army when it is close, else the nearest unit or the fort gate.
function slamFocus(b, u) {
  const c = densest(b, u, 430, 180);
  if (c) return c;
  const e = nearestEnemy(b, u);
  const ff = fortFocus(b, u, 560);
  if (e && (!ff || !ff.near || Math.abs(e.x - u.x) <= Math.abs(ff.x - u.x))) return e;
  return ff && ff.near ? ff : e;
}

function smudgeSlam(u, b, rounds) {
  const esc = u.data.escalated;
  const tgt = slamFocus(b, u);
  const dirn = tgt ? sgn(tgt.x - u.x, u.dir) : u.dir;
  const dist = esc ? 520 : 400, wind = 1.0;
  const x0 = u.x + dirn * (u.radius + 10);
  u.facing = dirn;
  u.data.cd.slam = (esc ? 9 : 12) + b.rng.range(0, 2);
  telegraph(b, u, { shape: 'band', kind: 'slam', x: x0 + dirn * dist / 2, width: dist, delay: wind });
  startAct(u, {
    t: 0, phase: 0,
    tick(u, b, dt) {
      this.t += dt;
      u.facing = dirn;
      if (this.phase === 0) {
        actPose(u, 0.42 * Math.min(1, this.t / wind));
        if (this.t >= wind) {
          this.phase = 1;
          this.t = 0;
          b.emit('bossSlam', { x: x0, radius: 140, kind: 'slam', unit: u, z: u.z, dirn });
          hitGround(b, u, x0, 80, dmgOf(u, 0.8), { kb: 200, kbUp: 300 });
          startWave(b, u, x0, dirn, dist, esc);
        }
        return false;
      }
      actPose(u, 0.5 + 0.5 * Math.min(1, this.t / 0.7));
      if (this.t < 0.7) return false;
      if (rounds > 1) { smudgeSlam(u, b, rounds - 1); return false; }
      return true;
    },
  });
}

function startWave(b, u, x0, dirn, dist, esc) {
  const dmg = dmgOf(u, 0.9);
  b.areas.push({
    kind: 'shockwave', team: u.team, boss: u, x: x0, x0, dirn, dist, speed: esc ? 600 : 500, w: 44, t: 0, alive: true,
    hit: new Set(), nextSmear: 40, hitFort: false,
    update(bb, dt) {
      this.t += dt;
      const step = this.speed * dt;
      this.x += this.dirn * step;
      for (const e of groundEnemies(bb, this.boss)) {
        if (this.hit.has(e.id) || Math.abs(e.x - this.x) > this.w * 0.5 + e.radius + step) continue;
        this.hit.add(e.id);
        bb.damage(e, dmg, { source: this.boss, team: this.team, kind: 'blast', dir: this.dirn, kb: 220, kbUp: 300 });
        e.addBuff({ id: 'smear', t: 1.5, speed: 0.55 });
      }
      const f = bb.teams[1 - this.team].fort;
      if (!this.hitFort && f.alive && Math.abs(f.x - this.x) <= f.radius + 10) { this.hitFort = true; bb.damageFort(f, dmg, { source: this.boss, kind: 'blast' }); }
      const run = Math.abs(this.x - this.x0);
      while (run >= this.nextSmear && this.nextSmear < this.dist) { addSmear(bb, this.boss, this.x0 + this.dirn * this.nextSmear); this.nextSmear += 95; }
      if (run >= this.dist || this.x < 20 || this.x > bb.width - 20) this.alive = false;
    },
  });
}

function smudgeBelch(u, b) {
  const esc = u.data.escalated;
  u.data.cd.belch = (esc ? 11 : 15) + b.rng.range(0, 2);
  const tgt = nearestEnemy(b, u);
  const dirn = tgt ? sgn(tgt.x - u.x, u.dir) : u.dir;
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      u.facing = dirn;
      actPose(u, 0.3 + 0.1 * Math.sin(this.t * 12));
      if (!this.fired && this.t >= 0.8) {
        this.fired = true;
        const n = esc ? 4 : 3;
        b.emit('bossBelch', { unit: u, x: u.x + dirn * u.radius, y: -u.height * 0.7, z: u.z, dirn });
        if (countOf(b, u.team, 'smudgeling') < 16) {
          for (let i = 0; i < n; i++) {
            const s = b.spawnUnit(u.team, 'smudgeling', { x: u.x + dirn * (u.radius + 6), z: u.z + b.rng.range(-0.6, 0.6), instant: true, summoned: true });
            s.airborne = true;
            s.y = -50;
            s.vy = -(280 + b.rng.range(0, 160));
            s.vx = dirn * (110 + i * 45 + b.rng.range(0, 40));
          }
        }
      }
      return this.t >= 1.3;
    },
  });
}

BEHAVIORS.boss_smudge = {
  init(u, b) { initBoss(u, b, { cd: { slam: 5, belch: 9 } }); },
  update(u, b, dt) {
    const d = u.data;
    tickCooldowns(u, dt);
    if (!d.escalated && u.hp <= u.maxHp * 0.5) {
      d.escalated = true;
      banner(b, u, 'Old Smudge is spreading!');
      u.speed *= 1.25;
      u.atkCd *= 0.8;
      d.cd.belch = 0.4;
      b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'rage', team: u.team });
    }
    if (runAct(u, b, dt)) return;
    if (!u.attacking) {
      if (d.cd.slam <= 0) {
        const tgt = slamFocus(b, u);
        if (tgt && Math.abs(tgt.x - u.x) <= 620) { smudgeSlam(u, b, 1); return; }
        d.cd.slam = 0.6;
      }
      if (d.cd.belch <= 0) { smudgeBelch(u, b); return; }
    }
    bossMelee(u, b, dt);
  },
  onDeath: onBossDeath,
};

// ================================================================= The Neon Wyrm
// Cycle: hover low over the army and breathe (one line per flight), swoop down onto the thickest
// cluster and stay on the ground for a long window (melee can hit it), stomping, then take off again.
const ALT = 125; // wings and head stay below the top of a 720 px screen and the boss bar
const FLY_T = 4.5, FLY_T_ESC = 3.8, GROUND_T = 12, GROUND_T_ESC = 11;

// Where the Wyrm wants to be: over the thickest enemy cluster, else the nearest unit, else the fort.
function wyrmFocus(b, u) {
  const c = densest(b, u, 1800, 220);
  if (c) return { x: c.x, army: true };
  const e = nearestEnemy(b, u);
  if (e) return { x: e.x, army: true };
  const ff = fortFocus(b, u, 1e9);
  return ff ? { x: ff.x + u.dir * 120, army: false } : null;
}

function wyrmBreath(u, b, aim, chain) {
  const dirn = sgn(aim.x - u.x, u.dir);
  const len = 460, delay = 1.1, grow = 0.8;
  const x0 = aim.x - dirn * (aim.fort ? 300 : 140);
  u.facing = dirn;
  u.data.cd.breath = ((u.data.escalated ? 3.6 : 5.4) + b.rng.range(0, 1));
  telegraph(b, u, { shape: 'band', kind: 'breath', x: x0 + dirn * len / 2, width: len, delay });
  const dps = 16 * (u.dmg / 70) * u.mod.dmg;
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      u.facing = dirn;
      u.data.mouthT = this.t > 0.4 ? 1 : 0.4;
      if (!this.fired && this.t >= delay) {
        this.fired = true;
        b.emit('bossBreath', { unit: u, x: u.x, y: u.y, x0, dirn, len });
        b.areas.push({
          kind: 'burnline', team: u.team, boss: u, x0, x: x0, dirn, len, mx: u.x, my: u.y - 30, t: 0, grow, dur: 6, tickT: 0, alive: true,
          update(bb, d2) {
            this.t += d2;
            this.tickT -= d2;
            if (this.t >= this.dur) { this.alive = false; return; }
            if (this.tickT > 0) return;
            this.tickT = 0.25;
            const reach = this.len * Math.min(1, this.t / this.grow);
            for (const e of groundEnemies(bb, this.boss)) {
              const pos = (e.x - this.x0) * this.dirn;
              if (pos >= -e.radius && pos <= reach + e.radius) e.addBuff({ id: 'burn', t: 2, dot: dps, team: this.team, source: this.boss });
            }
            // The flames scorch the player's fort too when the line reaches it.
            const f = bb.teams[1 - this.team].fort;
            const fp = (f.x - this.x0) * this.dirn;
            if (f.alive && fp >= -f.radius && fp <= reach + f.radius) bb.damageFort(f, dps * 0.25 * 0.35, { source: this.boss, kind: 'blast' });
          },
        });
      }
      if (this.t >= delay + grow + 0.2) {
        u.data.mouthT = 0;
        if (chain > 1) { const e = densest(b, u, 900, 200) || nearestEnemy(b, u); if (e) { wyrmBreath(u, b, e, chain - 1); return false; } }
        return true;
      }
      return false;
    },
  });
}

// Breath aim: the thickest cluster in range, or the fort when it is close and the army is not.
function wyrmBreathAim(u, b) {
  const ff = fortFocus(b, u, 520);
  const c = densest(b, u, 900, 200);
  if (ff && ff.near && (!c || b.rng.next() < 0.2)) return { x: ff.x, fort: true };
  return c || (nearestEnemy(b, u) ? { x: nearestEnemy(b, u).x } : null);
}

function wyrmLand(u, b) {
  const d = u.data;
  const delay = 1.2;
  telegraph(b, u, { shape: 'circle', kind: 'land', x: u.x, radius: 190, delay });
  d.mode = 'land';
  startAct(u, {
    t: 0,
    tick(u, b, dt) {
      this.t += dt;
      const k = clamp((this.t - (delay - 0.6)) / 0.6, 0, 1);
      d.alt = ALT * (1 - smooth(k));
      u.y = -d.alt;
      d.mouthT = k > 0.5 ? 0.3 : 0;
      if (this.t < delay) return false;
      d.alt = 0;
      u.y = 0;
      u.flying = false;
      d.landed = true;
      d.mode = 'ground';
      d.modeT = 0;
      d.cd.stomp = 1.6;
      hitGround(b, u, u.x, 190, dmgOf(u, 1.1), { kb: 420, kbUp: 480 });
      hitFortAt(b, u, u.x, 190, dmgOf(u, 0.6));
      b.emit('bossSlam', { x: u.x, radius: 190, kind: 'land', unit: u, z: u.z });
      u.atkT = 0.6;
      return true;
    },
  });
}

// On the ground: a telegraphed stomp that catches everything around the Wyrm.
function wyrmStomp(u, b) {
  const esc = u.data.escalated;
  const r = 175, delay = 0.85;
  u.data.cd.stomp = ((esc ? 3.6 : 4.8) + b.rng.range(0, 1));
  const x = u.x + u.facing * 40;
  telegraph(b, u, { shape: 'circle', kind: 'stomp', x, radius: r, delay });
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      actPose(u, this.fired ? 0.5 : 0.42);
      if (!this.fired && this.t >= delay) {
        this.fired = true;
        hitGround(b, u, x, r, dmgOf(u, 0.9), { kb: 340, kbUp: 420 });
        hitFortAt(b, u, x, r, dmgOf(u, 0.4));
        b.emit('bossSlam', { x, radius: r, kind: 'stomp', unit: u, z: u.z });
      }
      return this.t >= delay + 0.5;
    },
  });
}

BEHAVIORS.boss_wyrm = {
  init(u, b) {
    initBoss(u, b, { cd: { breath: 3.0 } });
    u.flying = true;
    u.radius = 64;
    u.height = 84;
    u.data.landed = false;
    u.data.alt = 0;
    u.data.mode = 'fly';
    u.data.modeT = 0;
    u.data.mouth = 0;
    u.data.mouthT = 0;
  },
  update(u, b, dt) {
    const d = u.data;
    tickCooldowns(u, dt);
    d.modeT += dt;
    d.mouth = approach(d.mouth, d.mouthT, dt * 4);
    if (!d.escalated && u.hp <= u.maxHp * 0.5) {
      d.escalated = true;
      banner(b, u, 'The Wyrm calls the gang!');
      summon(b, u, 'glowrunner', 3, { base: 40, cap: 10 });
      b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'rage', team: u.team });
    }
    const esc = d.escalated;
    if (d.mode === 'fly') {
      d.alt = approach(d.alt, ALT, 220 * dt);
      u.y = -d.alt;
      if (runAct(u, b, dt)) return;
      const foc = wyrmFocus(b, u);
      const lim = marchLimit(b, u, 450); // lead its own army, never fly in alone
      if (foc && lim !== null && (foc.x - lim) * u.dir > 0) foc.x = lim;
      const landing = d.modeT >= (esc ? FLY_T_ESC : FLY_T);
      if (foc) {
        // Hover just short of the cluster; once it is time to land, go right on top of it.
        let tx = landing ? foc.x : foc.x - u.dir * 170;
        if (!foc.army) tx = foc.x;
        const far = Math.abs(foc.x - u.x) > 700;
        const step = u.speed * (far ? 3 : esc ? 1.9 : 1.6) * dt;
        const dx = tx - u.x;
        u.x = clamp(u.x + Math.sign(dx) * Math.min(Math.abs(dx), step), 60, b.width - 60);
        if (Math.abs(foc.x - u.x) > 30) u.facing = sgn(foc.x - u.x);
        u.anim.moving = true;
        if (landing && d.alt >= ALT * 0.95 && (Math.abs(tx - u.x) < 60 || d.modeT >= (esc ? FLY_T_ESC : FLY_T) + 6)) { wyrmLand(u, b); return; }
        if (!landing && d.cd.breath <= 0 && d.alt > ALT * 0.9) {
          const aim = wyrmBreathAim(u, b);
          if (aim && Math.abs(aim.x - u.x) <= 720) { wyrmBreath(u, b, aim, esc ? 2 : 1); return; }
        }
      }
      return;
    }
    if (d.mode === 'land') { runAct(u, b, dt); return; }
    // On the ground: bite and stomp until it is time to fly again.
    if (runAct(u, b, dt)) return;
    d.mouthT = u.attacking ? 0.7 : 0;
    if (d.modeT >= (esc ? GROUND_T_ESC : GROUND_T) && !u.attacking) {
      d.mode = 'fly';
      d.modeT = 0;
      u.flying = true;
      d.landed = false;
      d.cd.breath = 1.2;
      b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'takeoff', team: u.team });
      return;
    }
    if (!u.attacking && d.cd.stomp <= 0 && groundEnemies(b, u).some((e) => Math.abs(e.x - u.x) - e.radius <= 230)) { wyrmStomp(u, b); return; }
    bossMelee(u, b, dt, { onHit: wyrmBite });
  },
  onDeath: onBossDeath,
};

// The bite: a frontal splash that chews units but only nibbles at the fort.
function wyrmBite(u, b) {
  const x = u.x + u.facing * (u.radius + 57);
  hitGround(b, u, x, 115, dmgOf(u), { kind: 'melee', kb: u.kb });
  hitFortAt(b, u, x, 115, dmgOf(u, 0.3), 'melee');
  b.emit('slam', { unit: u, x, radius: 115, team: u.team, z: u.z });
}

// ================================================================= The Professor
function professorQuiz(u, b) {
  const r = 380, delay = 1.0;
  u.data.cd.quiz = (u.data.escalated ? 10 : 13) + b.rng.range(0, 2);
  const x = u.x;
  telegraph(b, u, { shape: 'quiz', kind: 'quiz', x, radius: r, delay });
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      actPose(u, 0.42);
      if (!this.fired && this.t >= delay) {
        this.fired = true;
        actPose(u, 0.5);
        let n = 0;
        for (const e of groundEnemies(b, u)) {
          if (Math.abs(e.x - x) - e.radius > r) continue;
          e.addBuff({ id: 'quiz', t: 2, stun: true });
          b.emit('quizStun', { unit: e, x: e.x, y: e.y - e.height, z: e.z, team: e.team });
          n++;
        }
        b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'quiz', team: u.team, n });
      }
      return this.t >= delay + 0.4;
    },
  });
}

function professorRain(u, b, c) {
  const esc = u.data.escalated;
  const r = 200, delay = 0.9;
  u.data.cd.rain = (esc ? 9.5 : 13) + b.rng.range(0, 2);
  telegraph(b, u, { shape: 'circle', kind: 'rain', x: c.x, radius: r, delay });
  const n = esc ? 14 : 10;
  const dmg = dmgOf(u, 0.4);
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      actPose(u, 0.42);
      if (!this.fired && this.t >= delay) {
        this.fired = true;
        b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'rain', team: u.team });
        b.areas.push({
          kind: 'chalkrain', team: u.team, boss: u, x: c.x, radius: r, t: 0, dur: 2.4, n, spawned: 0, alive: true,
          update(bb, d2) {
            this.t += d2;
            const want = Math.min(this.n, Math.ceil((this.t / (this.dur - 0.6)) * this.n));
            while (this.spawned < want) {
              this.spawned++;
              const tx = this.x + bb.rng.range(-1, 1) * this.radius;
              const fallT = 0.6;
              bb.projectiles.push(new Projectile({
                x: tx - 30, y: -720, vx: 30 / fallT, vy: 720 / fallT - 0.5 * 1100 * fallT, g: 1100, team: this.team, dmg,
                kind: 'chalk_eq', dmgKind: 'pierce', aoe: 46, kb: 60, z: bb.rng.range(-1, 1), source: this.boss, sym: this.spawned % 5,
              }));
            }
            if (this.t >= this.dur) this.alive = false;
          },
        });
      }
      return this.t >= delay + 0.6;
    },
  });
}

function professorWalls(u, b) {
  u.data.cd.walls = 22;
  if (countOf(b, u.team, 'chalk_wall') >= 2) return;
  for (let i = 0; i < 2; i++) b.spawnUnit(u.team, 'chalk_wall', { x: clamp(u.x + u.dir * (120 + i * 95), 40, b.width - 40), z: 0, spawnTime: 0.6 });
  b.emit('bossRoar', { unit: u, x: u.x, z: u.z, kind: 'detention', team: u.team });
}

BEHAVIORS.boss_professor = {
  init(u, b) { initBoss(u, b, { cd: { quiz: 7, rain: 12, walls: 99 } }); },
  update(u, b, dt) {
    const d = u.data;
    tickCooldowns(u, dt);
    if (!d.escalated && u.hp <= u.maxHp * 0.5) {
      d.escalated = true;
      banner(b, u, 'Detention!');
      d.cd.walls = 0;
      d.cd.quiz = Math.min(d.cd.quiz, 3);
      summon(b, u, 'dustborn', 3, { base: 90 });
      u.atkCd *= 0.85;
    }
    if (runAct(u, b, dt)) return;
    if (!u.attacking) {
      if (d.escalated && d.cd.walls <= 0) professorWalls(u, b);
      if (d.cd.quiz <= 0) {
        if (groundEnemies(b, u).some((e) => Math.abs(e.x - u.x) - e.radius <= 380)) { professorQuiz(u, b); return; }
        d.cd.quiz = 1;
      }
      if (d.cd.rain <= 0) {
        // Rain on the thickest cluster; with none in reach, on the player's fort gate.
        const ff = fortFocus(b, u, 800);
        const c = densest(b, u, 1100, 200) || (ff && ff.near ? { x: ff.x + u.dir * 70 } : null);
        if (c) { professorRain(u, b, c); return; }
        d.cd.rain = 1.5;
      }
    }
    bossMelee(u, b, dt);
  },
  onDeath: onBossDeath,
};

// ================================================================= The Hand
const HOVER = 215;

// What the Hand goes for: the thickest part of the army, or the fort when the army hides next to it
// (or now and then in phase 2). Returns { x, fort } or null.
function handFocus(u, b) {
  const pf = b.teams[1 - u.team].fort;
  const c = densest(b, u, 2600, 200);
  // Only an army huddled against the fort (closer than the normal defend line) counts as hiding.
  const hiding = !c || Math.abs(c.x - pf.x) < 300;
  if (pf.alive && (hiding || (u.data.escalated && b.rng.next() < 0.25))) return { x: c ? Math.min(c.x, pf.x + 260) : pf.x + 120, fort: true, army: !!c };
  return c ? { x: c.x, fort: false, army: true } : null;
}

function handSweep(u, b) {
  const c = handFocus(u, b);
  if (!c) return false;
  const esc = u.data.escalated;
  const dirn = u.dir;
  const len = esc ? 560 : 480, w = esc ? 250 : 220, delay = 2.3, dur = 2.8;
  const pf = b.teams[1 - u.team].fort;
  // Centered on the army so the pass crosses it; aimed to run into the fort when it is the goal.
  let xs = c.x - dirn * len * 0.5;
  if (c.fort) xs = pf.x + 30 - dirn * len;
  xs = clamp(xs, 100, b.width - 100);
  u.data.tool = 'eraser';
  telegraph(b, u, { shape: 'sweep', kind: 'erase', x0: xs, dirn, length: len, width: w, delay });
  const dmg = dmgOf(u, 1.6);
  startAct(u, {
    t: 0, phase: 0, area: null,
    tick(u, b, dt) {
      this.t += dt;
      const d = u.data;
      if (this.phase === 0) {
        u.x += Math.sign(xs - u.x) * Math.min(Math.abs(xs - u.x), 520 * dt);
        d.pressT = this.t > delay - 0.45 ? 0.7 : 0.2;
        if (this.t >= delay) {
          this.phase = 1;
          this.t = 0;
          d.pressT = 1;
          b.emit('bossSlam', { x: xs, radius: w, kind: 'erase', unit: u, z: u.z });
          this.area = {
            kind: 'erase', team: u.team, boss: u, x: xs, x0: xs, dirn, len, w, t: 0, dur, hit: new Set(), alive: true, crumbT: 0, hitFort: false,
            update(bb, d2) {
              this.t += d2;
              const p = smooth(Math.min(1, this.t / this.dur));
              this.x = this.x0 + this.dirn * this.len * p;
              for (const e of groundEnemies(bb, this.boss)) {
                if (this.hit.has(e.id) || Math.abs(e.x - this.x) > this.w / 2 + e.radius * 0.5) continue;
                this.hit.add(e.id);
                // Fair but scary: one pass never erases a healthy unit outright.
                const capped = e.isHero || e.hp < e.maxHp * 0.75 ? dmg : Math.min(dmg, e.maxHp * 0.7);
                bb.damage(e, capped, { source: this.boss, team: this.team, kind: 'magic', dir: this.dirn });
                bb.emit('erased', { x: e.x, y: e.y - e.height * 0.5, z: e.z, unit: e });
              }
              if (!this.hitFort && Math.abs(bb.teams[1 - this.team].fort.x - this.x) <= this.w / 2 + 20) {
                this.hitFort = true;
                bb.damageFort(bb.teams[1 - this.team].fort, dmgOf(this.boss, 0.6), { source: this.boss, kind: 'magic' });
              }
              if (this.t >= this.dur) this.alive = false;
            },
          };
          b.areas.push(this.area);
        }
        return false;
      }
      if (this.area && this.area.alive) u.x = this.area.x;
      d.pressT = 1;
      return this.t >= dur + 1.0; // rubbed-out pause: the Hand stays down and can be hit
    },
  });
  return true;
}

function handStab(u, b, n) {
  const c = handFocus(u, b);
  if (!c) return false;
  const esc = u.data.escalated;
  const r = 110, delay = 1.7;
  const tx = clamp(c.fort ? b.teams[1 - u.team].fort.x + u.dir * 45 : c.x + b.rng.range(-40, 40), 80, b.width - 80);
  u.data.tool = 'pencil';
  telegraph(b, u, { shape: 'circle', kind: 'stab', x: tx, radius: r, delay });
  const dmg = dmgOf(u, 1.6);
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      const d = u.data;
      if (!this.fired) {
        u.x += Math.sign(tx - u.x) * Math.min(Math.abs(tx - u.x), 560 * dt);
        d.pressT = this.t > delay - 0.5 ? 0.7 : 0.2;
        if (this.t >= delay) {
          this.fired = true;
          this.t = 0;
          d.pressT = 1;
          u.x = tx;
          hitGround(b, u, tx, r, dmg, { kb: 520, kbUp: 640 });
          hitFortAt(b, u, tx, r, dmgOf(u, 0.5), 'magic');
          b.emit('handStab', { x: tx, radius: r, unit: u, z: u.z });
          b.areas.push({ kind: 'stab', team: u.team, boss: u, x: tx, t: 0, dur: 1.8, alive: true, update(bb, d2) { this.t += d2; if (this.t >= this.dur) this.alive = false; } });
        }
        return false;
      }
      d.pressT = 1;
      if (n > 1 && this.t >= 0.6) {
        if (handStab(u, b, n - 1)) return false;
      }
      return this.t >= (n > 1 ? 0.6 : 2.2);
    },
  });
  return true;
}

function handRedraw(u, b) {
  const esc = u.data.escalated;
  u.data.cd.redraw = esc ? 15 : 28;
  if (esc) u.data.next = 'stab'; // phase 2: stab right after, while the knights march
  u.data.tool = 'pencil';
  startAct(u, {
    t: 0, fired: false,
    tick(u, b, dt) {
      this.t += dt;
      const d = u.data;
      d.pressT = 0.95;
      if (!this.fired && this.t >= 0.8) {
        this.fired = true;
        b.emit('handRedraw', { unit: u, x: u.x, z: u.z });
        const n = esc ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const x = clamp(u.x + u.dir * (30 + i * 40), 60, b.width - 60);
          b.spawnUnit(u.team, 'eraser_knight', { x, z: 0.3 + i * 0.3, spawnTime: 1.0, summoned: true });
        }
      }
      return this.t >= 2.0;
    },
  });
}

function handPickAttack(u, b) {
  const d = u.data;
  const knights = countOf(b, u.team, 'eraser_knight');
  if (d.next) {
    const nx = d.next;
    d.next = null;
    if (nx === 'stab' && handStab(u, b, 2)) { d.last = 'stab'; return true; }
  }
  const w = { sweep: 3, stab: 3, redraw: d.cd.redraw <= 0 && knights < (d.escalated ? 6 : 4) ? 3 : 0 };
  // Avoid repeating the same attack twice in a row.
  if (d.last && w[d.last] > 0 && Object.values(w).filter((v) => v > 0).length > 1) w[d.last] = 0.6;
  const pick = b.rng.weighted(w);
  let ok = false;
  if (pick === 'sweep') ok = handSweep(u, b);
  else if (pick === 'stab') ok = handStab(u, b, d.escalated ? 2 : 1);
  else { handRedraw(u, b); ok = true; }
  if (ok) d.last = pick;
  return ok;
}

BEHAVIORS.boss_hand = {
  init(u, b) {
    initBoss(u, b, { cd: { attack: 3.5, redraw: 8 } });
    u.traits.push('hoverHalf');
    u.flying = true;
    u.radius = 72;
    u.height = 170;
    u.data.landed = false;
    u.data.press = 0;
    u.data.pressT = 0;
    u.data.tool = 'pencil';
    u.data.driftV = 0;
  },
  update(u, b, dt) {
    const d = u.data;
    tickCooldowns(u, dt);
    if (!d.escalated && u.hp <= u.maxHp * 0.5) {
      d.escalated = true;
      banner(b, u, 'The Hand is erasing everything!');
      summon(b, u, 'eraser_knight', 2, { base: 80, step: 40, cap: 6 });
      d.cd.attack = Math.min(d.cd.attack, 1.5);
    }
    const acting = !!d.act;
    if (!acting) d.pressT = 0;
    d.press = approach(d.press, d.pressT, dt * (d.pressT > d.press ? 3.4 : 1.7));
    u.y = -HOVER * (1 - d.press);
    const landed = d.press >= 0.85;
    u.flying = !landed;
    d.landed = landed;
    if (acting) {
      runAct(u, b, dt);
      if (!u.data.act) d.cd.attack = d.next ? 0.5 : d.escalated ? 4.2 : 6.0;
      return;
    }
    // Hover and drift over the player's army.
    const c = densest(b, u, 3000, 260);
    const pf = b.teams[1 - u.team].fort;
    // Press toward the fort when the army hides beside it.
    let tx = Math.max(pf.x + 230, c ? c.x - u.dir * 40 : pf.x + 420);
    const lim = marchLimit(b, u, 700); // stay near its own army's front, not alone over yours
    if (lim !== null && (tx - lim) * u.dir > 0) tx = lim;
    const far = Math.abs(tx - u.x) > 900;
    const sp = far ? 260 : d.escalated ? 125 : 100;
    d.driftV = approach(d.driftV, Math.sign(tx - u.x) * (Math.abs(tx - u.x) > 24 ? sp : 0), 400 * dt);
    u.x += d.driftV * dt;
    u.facing = sgn(d.driftV, u.facing);
    if (d.cd.attack <= 0 && Math.abs(tx - u.x) < 1100) {
      if (!handPickAttack(u, b)) d.cd.attack = 1;
    }
  },
  onDeath: onBossDeath,
};
