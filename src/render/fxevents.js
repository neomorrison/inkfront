// Event -> effect handlers. installFxEvents(EVENT_FX) is called from renderer.js before any other package wraps
// a handler, so wrapping packages keep their wrapper. No import of renderer.js here (no cycle).
// New events emitted by nothing but consumed here: pageChange{page} (endless).
import { DEPTH } from './camera.js';
import { FACTIONS } from '../data/factions.js';
import { computePose } from './stickman.js';
import { mixHex, clamp } from '../core/util.js';

const INK_DARK = '#1b2240';
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = (v) => (v < 0 ? -1 : 1);

// Chunk shapes for the collapse of each fort style: [fills, w range, h range].
const DEBRIS = {
  castle: { fills: null, w: [9, 17], h: [7, 11] },
  pencil_fort: { fills: ['#f4cf5a', '#f4cf5a', '#f1d4a8', '#f3a2b4'], w: [20, 36], h: [5, 7] },
  neon_fort: { fills: ['#ff4fa8', '#ffe94a', '#7be04d', '#ffa13b', '#38d6ff'], w: [14, 28], h: [8, 12] },
  chalk_fort: { fills: ['#f4f1e6', '#e6e2d2', '#f2c230'], w: [8, 15], h: [6, 9] },
  eraser_fort: { fills: ['#fbf6f3', '#f3a2b4', '#f8c6d1', '#ff4f4f', '#4fa3ff'], w: [10, 18], h: [8, 12] },
};

function fortStyle(b, team) {
  return (FACTIONS[b.teams[team].faction] || {}).fort || 'castle';
}

export function installFxEvents(E) {
  // ------------------------------------------------------------ combat
  E.hit = (r, e, b) => {
    if (e.kind === 'true') return;
    const pal = r.pal[e.team] || r.pal[0];
    const src = e.source;
    const dir = src ? sgn(e.x - src.x) : (e.target && -e.target.facing) || 1;
    const big = e.amount >= 40;
    const k = e.kind;
    if (k === 'blast') {
      r.fx.burst(e.x, e.y, e.z, big ? 9 : 5, pal.ink, 260, 'drop', { size: 2.4, life: 0.5, dir: dir * 0.6 });
      r.fx.burst(e.x, e.y, e.z, 3, INK_DARK, 180, 'dot', { size: 2, life: 0.4 });
    } else if (k === 'magic') {
      r.fx.burst(e.x, e.y, e.z, big ? 7 : 4, pal.light, 190, 'star', { size: 2.4, life: 0.45, g: 100 });
      r.fx.burst(e.x, e.y, e.z, 3, pal.ink, 150, 'spark', { size: 1.8, life: 0.25, dir });
    } else if (k === 'pierce') {
      r.fx.burst(e.x, e.y, e.z, big ? 6 : 3, pal.ink, 190, 'drop', { size: 1.7, life: 0.4, dir: dir * 0.8, spread: 0.9 });
      r.fx.burst(e.x, e.y, e.z, 2, '#ffffff', 220, 'spark', { size: 1.4, life: 0.16, dir });
    } else {
      // Melee: ink drops fling away from the attacker, plus a quick white slash spark.
      r.fx.burst(e.x, e.y, e.z, big ? 8 : 4, pal.ink, 210, 'drop', { size: 2, life: 0.45, dir: dir * 0.9, spread: 1.0 });
      r.fx.burst(e.x, e.y, e.z, big ? 3 : 2, pal.dark, 160, 'dot', { size: 1.6, life: 0.35, dir });
      if (big) r.fx.burst(e.x, e.y, e.z, 3, '#ffffff', 300, 'spark', { size: 1.5, life: 0.14, dir });
    }
    if (e.amount >= 22 && Math.random() < 0.4) r.fx.stain(e.x + dir * rnd(8, 26), e.z, pal.ink, rnd(2, 5), rnd(1, 2), 0.3);
    if (e.amount >= 50) r.shake(Math.min(5, e.amount / 30));
    if (!r.settings.numbers || e.amount < 1) return;
    const mine = src && src.team === 0;
    const taken = e.team === 0 && e.target && e.target.isHero;
    if (!mine && !taken) return;
    const amt = Math.round(e.amount);
    const crit = e.crit;
    const size = clamp(12 + amt * 0.2, 13, 26) * (crit ? 1.25 : 1);
    r.fx.text(e.x + rnd(-9, 9), e.y - 14, String(amt) + (crit ? '!' : ''), taken ? '#d1342b' : crit ? '#ff5a1f' : INK_DARK, size, {
      life: crit ? 0.95 : 0.7, vy: crit ? -85 : -62, vx: rnd(-14, 14), crit, outline: r.page.chalky ? '#102018' : '#fffdf4', pop: crit ? 0.24 : 0.16,
    });
  };

  E.death = (r, e, b) => {
    const u = e.unit;
    const pal = r.pal[u.team];
    const heavy = u.mass > 1.6 || u.scale > 1.3;
    r.fx.splat(u.x, u.z, pal.ink, 9 + 5 * u.scale);
    if (u.def.look && u.def.look.body) {
      r.fx.burst(u.x, u.y - u.height * 0.5, u.z, 16, pal.ink, 280, 'drop', { size: 2.6, spread: 3 });
      r.fx.puff(u.x, u.y - u.height * 0.4, u.z, r.fx.dustCol, 4, 12);
      return;
    }
    const pose = computePose(u, r.t);
    const j = pose.j;
    const s = u.scale;
    const ground = u.z * DEPTH;
    const world = {};
    for (const k of ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB']) {
      world[k] = [u.x + u.facing * j[k][0] * s, u.y + ground + j[k][1] * s];
    }
    const power = Math.min(900, 120 + (e.power || 0) * 1.6);
    const blast = e.kind === 'blast';
    const launched = u.airborne || u.vy < -80;
    const mass = clamp(u.mass || 1, 0.6, 12);
    // Heavy units get less of the push.
    const push = 1 / Math.sqrt(Math.max(1, mass));
    const dirv = e.dir || 1;
    r.fx.ragdoll(world, {
      vx: dirv * power * (blast ? 1.1 : 0.7) * push + (u.vx || 0) * 0.5, vy: -power * (blast ? 1.2 : 0.55) * push - 60 + Math.min(0, (u.vy || 0) * 0.5),
      ground, col: pal.ink, back: pal.back, paper: pal.paper, lw: 2.5 * ((u.def.look && u.def.look.bulk) || 1), scale: s,
      dismember: blast && power > 380, life: 5.5, mass: Math.max(1, Math.sqrt(mass) * (s > 1.3 ? 1.3 : 1)),
      spin: launched || blast ? dirv * rnd(0.05, 0.1) * (1 / Math.sqrt(mass)) * (launched ? 1.2 : 0.6) : 0, headScale: (u.def.look && u.def.look.head) || 1,
    });
    r.fx.burst(u.x, u.y - u.height * 0.5, u.z, heavy ? 10 : 6, pal.ink, 200, 'drop', { size: 2.2, life: 0.5, dir: dirv, spread: 2.2 });
    r.fx.puff(u.x, u.y - 6, u.z, r.fx.dustCol, heavy ? 3 : 2, 8 * Math.max(1, s * 0.7));
    if (heavy) r.shake(2.5);
  };

  E.explode = (r, e) => {
    const pal = r.pal[e.team] || r.pal[0];
    const rad = e.radius;
    const big = clamp(rad / 100, 0.6, 2.5);
    r.fx.burst(e.x, e.y - 6, 0, Math.round(16 * big), INK_DARK, 460, 'drop', { size: 2.8, life: 0.7, spread: 1.8, g: 1100 });
    r.fx.burst(e.x, e.y - 6, 0, Math.round(8 * big), pal.ink, 360, 'dot', { size: 2.4, life: 0.6, spread: 1.5 });
    r.fx.burst(e.x, e.y - 6, 0, Math.round(10 * big), '#ffd34a', 380, 'spark', { size: 2, life: 0.22, spread: 3 });
    r.fx.puff(e.x, e.y - 4, 0, 'rgba(55,55,66,.42)', Math.round(6 * big), 15 * big);
    r.fx.puff(e.x, e.y - 14, 0, 'rgba(95,95,105,.30)', Math.round(4 * big), 11 * big);
    r.fx.ring(e.x, 0, 0, pal.ink, rad, 0.45, 5);
    r.fx.ring(e.x, 0, 0, INK_DARK, rad * 0.6, 0.3, 3);
    r.fx.splat(e.x, 0, INK_DARK, Math.min(44, rad * 0.38), 0.75);
    r.fx.scorch(e.x, 0, Math.min(70, rad * 0.7));
    r.fx.dust(e.x, 0, 5, 1.6, 8);
    r.shake(Math.min(11, rad / 13));
  };

  E.slam = (r, e) => {
    const rad = e.radius || 80;
    r.fx.dust(e.x, e.z || 0, 6, 1.4, 8);
    r.fx.ring(e.x, 0, e.z || 0, r.fx.dustCol, rad, 0.4, 4);
    r.fx.burst(e.x, -2, e.z || 0, 6, r.page.ground, 220, 'crumb', { size: 2, life: 0.5, spread: 1.1, g: 900 });
    r.fx.scorch(e.x, e.z || 0, rad * 0.35);
    r.shake(Math.min(7, 2 + rad / 30));
  };

  E.projHit = (r, e) => {
    const pal = r.pal[e.team] || r.pal[0];
    if (e.fort) {
      r.fx.burst(e.x, e.y, e.z, 3, '#f1d4a8', 130, 'crumb', { size: 1.6, life: 0.4, g: 800 });
      return;
    }
    const k = e.kind;
    if (k === 'boulder') {
      r.fx.burst(e.x, e.y, e.z, 8, pal.dark, 260, 'dot', { size: 2.4, life: 0.5, g: 1000 });
      r.fx.dust(e.x, e.z, 3, 1.3, 7);
      r.shake(3);
    } else {
      r.fx.burst(e.x, e.y, e.z, 2, '#ffffff', 180, 'spark', { size: 1.3, life: 0.12, spread: 2.5 });
    }
  };

  E.projLand = (r, e) => {
    if (e.kind === 'arrow' || e.kind === 'neon_arrow' || e.kind === 'lead') {
      r.stuck.push({ x: e.x, z: e.z, ang: Math.atan2(e.vy, e.vx), life: 4, col: r.pal[e.team].ink });
      if (r.stuck.length > 120) r.stuck.shift();
      r.fx.burst(e.x, e.z * DEPTH - 1, e.z, 2, r.fx.dustCol, 60, 'crumb', { size: 1.2, life: 0.3, g: 400 });
    } else if (e.kind === 'stone' || e.kind === 'chalk') {
      r.fx.burst(e.x, e.z * DEPTH - 2, e.z, 3, 'rgba(80,80,90,.6)', 90, 'dot', { size: 1.4, life: 0.35 });
    } else if (e.kind === 'boulder') {
      r.fx.dust(e.x, e.z, 4, 1.4, 8);
      r.fx.scorch(e.x, e.z, 22);
    }
  };

  E.blocked = (r, e) => {
    r.fx.burst(e.x, e.y, e.z, 6, '#ffd34a', 260, 'spark', { size: 2, life: 0.22, spread: 2.2 });
    r.fx.burst(e.x, e.y, e.z, 2, '#ffffff', 160, 'spark', { size: 1.6, life: 0.14, spread: 2.2 });
    r.fx.ring(e.x, e.y, e.z, '#f2b01e', 18, 0.2, 2.4);
  };

  E.heal = (r, e) => {
    if (Math.random() < 0.65) r.fx.add({ kind: 'cross', x: e.x + rnd(-8, 8), y: e.y + 4, z: e.z, vx: 0, vy: -46, g: 0, col: '#3ec46d', size: rnd(3, 4.6), life: 0.8 });
  };

  E.launch = (r, e) => {
    r.fx.dust(e.x, e.z, 3, 1, 6);
    r.fx.burst(e.x, -4, e.z, 3, r.fx.dustCol, 100, 'line', { size: 1.6, life: 0.2, spread: 0.6, angle: Math.PI / 2 });
  };

  E.land = (r, e) => {
    const u = e.unit;
    const heavy = u && u.mass > 2;
    r.fx.dust(e.x, e.z, heavy ? 6 : 3, heavy ? 1.5 : 1, heavy ? 9 : 6);
    if (heavy) { r.fx.ring(e.x, 0, e.z, r.fx.dustCol, 50, 0.3, 3); r.shake(2.5); }
  };

  // ------------------------------------------------------------ economy
  E.deposit = (r, e) => {
    if (e.team !== 0) return;
    const pal = r.pal[0];
    r.fx.text(e.x, -86, '+' + Math.round(e.amount), r.page.chalky ? pal.ink : '#1f47c2', 19, { life: 1.15, vy: -48, outline: r.page.chalky ? '#102018' : '#fffdf4', pop: 0.2 });
    r.fx.burst(e.x, -40, e.z || 0, 6, pal.ink, 150, 'drop', { size: 1.8, life: 0.5, spread: 1.0 });
    r.fx.burst(e.x, -48, e.z || 0, 2, pal.light, 90, 'star', { size: 2, life: 0.5, g: 0 });
  };

  E.gather = (r, e) => {
    if (Math.random() < 0.4) r.fx.burst(e.x + 14, -6, e.z || 0, 1, r.pal[e.team].ink, 70, 'drop', { size: 1.4, life: 0.35 });
  };

  // ------------------------------------------------------------ forts
  E.fortHit = (r, e, b) => {
    const f = e.fort;
    const dir = b.teams[e.team].dir;
    const hx = e.x - dir * rnd(-6, 56) * -1 + dir * 10;
    if (Math.random() < 0.5) r.fx.dust(f.x + rnd(-40, 40), f.z, 1, 0.8, 7);
    if (Math.random() < 0.45) r.fx.burst(hx, rnd(-130, -30) + f.z * DEPTH, f.z, 3, r.pal[e.team].light, 140, 'crumb', { size: 1.8, life: 0.5, g: 900, spread: 1.6 });
    if (e.amount > 40) r.shake(2);
    r.world.fortSt[e.team] && (r.world.fortSt[e.team].bell = r.t);
  };

  E.fortDestroyed = (r, e, b) => {
    const f = e.fort;
    const pal = r.pal[e.team];
    const style = fortStyle(b, e.team);
    const D = DEBRIS[style] || DEBRIS.castle;
    const st = r.world.fortSt[e.team];
    if (st) st.deadAt = r.t;
    const base = mixHex(pal.light, '#fffdf4', 0.5);
    const n = r.low ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const w = rnd(D.w[0], D.w[1]), h = rnd(D.h[0], D.h[1]);
      const fill = D.fills ? D.fills[i % D.fills.length] : base;
      const px = f.x + rnd(-62, 62), py = f.z * DEPTH + rnd(-200, -8);
      const p = r.fx.brick(px, py, f.z, w, h, rnd(-260, 260), rnd(-320, -40), fill, style === 'neon_fort' ? pal.dark : pal.ink);
      p.delay = rnd(0, 0.35) * (1 - (py - f.z * DEPTH) / -200 * 0.3);
    }
    for (let i = 0; i < 5; i++) r.fx.burst(f.x + rnd(-60, 60), -80 - rnd(0, 90), -0.6, 8, pal.ink, 420, 'paper', { size: 4, life: 1.3, g: 500, spread: 2.2 });
    r.fx.dust(f.x, f.z, 12, 2.5, 14);
    r.fx.puff(f.x, -40, f.z, 'rgba(80,80,90,.42)', 14, 26);
    r.fx.puff(f.x, -110, f.z, 'rgba(100,100,110,.32)', 8, 22);
    r.fx.ring(f.x, 0, f.z, r.fx.dustCol, 190, 0.7, 6);
    r.fx.scorch(f.x, f.z, 80);
    r.shake(16);
    if (e.team === 1) r.fx.text(f.x, -230, 'CRASH!', pal.ink, 30, { life: 1.4, vy: -30, pop: 0.3, crit: true, outline: r.page.chalky ? '#102018' : '#fffdf4' });
  };

  E.immune = (r, e) => {
    r.fx.ring(e.x, -90, 0, '#9aa3ba', 60, 0.3, 3);
    r.fx.burst(e.x, -90, 0, 4, '#9aa3ba', 140, 'spark', { size: 1.6, life: 0.2, spread: 3 });
  };

  // ------------------------------------------------------------ spawning and orders
  E.spawn = (r, e) => {
    const u = e.unit;
    if (!u) return;
    const pal = r.pal[e.team] || r.pal[0];
    const T = e.instant ? 0.05 : Math.max(0.2, u.spawnTime || 0.8);
    const h = (u.height || 60) * 0.5;
    if (!e.instant) {
      // Pencil scribbles around the figure while it sketches in, then a sparkle at the pencil tip.
      const n = Math.min(6, 3 + Math.round(T * 3));
      for (let i = 0; i < n; i++) {
        const p = r.fx.add({ kind: 'scribble', x: e.x + rnd(-14, 14), y: e.z * DEPTH - rnd(2, h * 1.5), z: e.z, vx: 0, vy: -6, g: 0, col: pal.ink, size: rnd(2.6, 4.6), life: rnd(0.35, 0.55), rot: rnd(-0.5, 0.5) });
        p.delay = (i / n) * T;
      }
    }
    for (let i = 0; i < 4; i++) {
      const p = r.fx.add({ kind: 'star', x: e.x + rnd(-6, 6), y: e.z * DEPTH - h * 1.6 + rnd(-6, 6), z: e.z, vx: rnd(-50, 50), vy: rnd(-90, -30), g: 140, col: i % 2 ? '#ffd34a' : pal.light, size: rnd(2, 3.2), life: 0.5, vr: rnd(-8, 8) });
      p.delay = T;
    }
    const ring = r.fx.add({ kind: 'ring', x: e.x, y: e.z * DEPTH, z: e.z, vx: 0, vy: 0, g: 0, col: pal.ink, size: 24, life: 0.3, w: 2 });
    ring.delay = T;
  };

  E.stance = (r, e, b) => {
    if (e.team !== 0) return;
    const tm = b.teams[0];
    const names = { defend: 'DEFEND', hold: 'HOLD', charge: 'CHARGE!' };
    const x = e.stance === 'hold' ? (e.x ?? tm.flagX) : e.stance === 'charge' ? tm.fort.x + 220 : tm.fort.x + 330;
    const pal = r.pal[0];
    r.fx.text(x, -118, names[e.stance] || '', pal.ink, 24, { life: 0.95, vy: -22, pop: 0.28, crit: e.stance === 'charge', outline: r.page.chalky ? '#102018' : '#fffdf4' });
    r.fx.ring(x, 0, 0, pal.ink, e.stance === 'hold' ? 46 : 70, 0.5, 4);
    r.fx.burst(x, -50, 0, 7, pal.light, 220, 'paper', { size: 3, life: 0.8, g: 400, spread: 2 });
    r.fx.burst(x, -50, 0, 4, pal.ink, 200, 'star', { size: 2.4, life: 0.6, g: 200, spread: 2 });
  };

  E.bossArrive = (r, e, b) => {
    const u = e.unit;
    if (!u) return;
    r.shake(11);
    r.fx.dust(u.x, u.z, 12, 2.4, 14);
    r.fx.ring(u.x, 0, u.z, r.fx.dustCol, 180, 0.7, 6);
    r.fx.burst(u.x, -60, u.z, 10, r.pal[u.team].ink, 300, 'paper', { size: 3.4, life: 1, g: 500, spread: 2.4 });
  };

  E.bossDefeated = (r, e) => {
    r.shake(14);
    const pal = r.pal[1];
    r.fx.burst(e.x, -60, 0, 26, pal.ink, 520, 'drop', { size: 3.4, life: 0.9, spread: 3, g: 1000 });
    r.fx.burst(e.x, -70, 0, 14, '#ffd34a', 420, 'star', { size: 3.4, life: 0.9, spread: 3, g: 500 });
    r.fx.ring(e.x, -40, 0, pal.ink, 200, 0.8, 6);
  };

  E.pageChange = (r, e, b) => r.changePage(b, e.page);
}
