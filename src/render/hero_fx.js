// The Captain's look and juice: flowing cape, hero ring, Fury glint, Inkstorm blades, scripted
// attack poses, ability VFX (EVENT_FX heroAbility / heroHit / heroStormTick) and ability icons.
// OWNER: hero builder (package E).
import { EXTRAS_DRAW, ATTACKS } from './stickman.js';
import { EVENT_FX } from './renderer.js';
import { ICON_DRAW } from './icons.js';
import { DEPTH } from './camera.js';
import { drawGlasses } from './hats_all.js';

const GOLD = '#f2b01e';
const INK_DARK = '#1b2240';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- scripted poses
// Selected by u.anim.style (set by the hero behavior). The hit frame is at progress 0.5.
ATTACKS.hero_cut2 = [
  [0, {}],
  [0.42, { uF: -0.55, lF: 0.3, uB: 0.2, lean: -0.12, head: 0.05 }],
  [0.5, { uF: 1.9, lF: 0.1, lean: 0.28, tF: 0.5, sF: -0.3 }],
  [0.72, { uF: 2.55, lF: 0.2, lean: 0.2 }],
  [1, {}],
];
ATTACKS.hero_heavy = [
  [0, {}],
  [0.3, { uF: 2.2, lF: 0.5, uB: 2.0, lB: 0.5, lean: -0.16 }],
  [0.44, { uF: 3.55, lF: 0.2, uB: 3.2, lB: 0.3, lean: -0.3, head: -0.12, tF: 0.3, sF: -0.2 }],
  [0.5, { uF: 1.0, lF: 0.1, uB: 0.9, lB: 0.2, lean: 0.5, tF: 0.75, sF: -0.6, tB: -0.45, hipY: -22 }],
  [0.74, { uF: 0.8, lF: 0.1, uB: 0.7, lB: 0.2, lean: 0.45, tF: 0.7, sF: -0.55, hipY: -23 }],
  [1, {}],
];
ATTACKS.hero_rally = [
  [0, {}],
  [0.3, { uF: 3.0, lF: 0.15, uB: 2.6, lB: 0.3, lean: -0.14, head: -0.14 }],
  [0.7, { uF: 3.1, lF: 0.1, uB: 2.7, lB: 0.2, lean: -0.18, head: -0.18 }],
  [1, { uF: 2.5, lF: 0.2, uB: 2.2, lB: 0.3, lean: -0.05 }],
];
const CROUCH = { hipY: -17, lean: 0.55, uF: 1.05, lF: 0.0, uB: 0.9, lB: 0.1, tF: 1.25, sF: -1.9, tB: 0.5, sB: -1.5 };
ATTACKS.hero_land = [[0, CROUCH], [0.6, CROUCH], [1, {}]];
const SPIN_A = { hipY: -24, lean: 0.12, uF: 1.5, lF: 0.05, uB: -1.5, lB: -0.05, tF: 0.5, sF: -0.45, tB: -0.45, sB: -0.5 };
const SPIN_B = { ...SPIN_A, lean: 0.02, uF: 1.62, uB: -1.38, hipY: -25.5 };
ATTACKS.hero_spin = [[0, SPIN_A], [0.5, SPIN_B], [1, SPIN_A]];

// ---------------------------------------------------------------- cape
// Visual-only state per unit (smoothed streaming amount), never touches the sim.
const capeState = new WeakMap();

function streamOf(u, t) {
  let st = capeState.get(u);
  if (!st) { st = { s: 0, t }; capeState.set(u, st); }
  const dt = clamp(t - st.t, 0, 0.1);
  st.t = t;
  const v = ((u.moveV || 0) * (u.facing || 1)) / Math.max(40, u.speed || 100); // 1 = full walk speed forward
  let target = clamp(v, -0.5, 1.3);
  if (u.airborne) target = clamp(0.5 + (u.vy || 0) / 900, 0.1, 1.5); // falling lifts it, rising lets it hang
  if (u.data && u.data.storm) target = 1.6;
  st.s += (target - st.s) * Math.min(1, dt * 7);
  return st.s;
}

function drawCape(ctx, J, o) {
  const u = o.unit || {};
  const t = o.t || 0;
  const st = streamOf(u, t);
  const stream = clamp(st, -0.4, 1.7);
  const lw = o.lw || 2.5;
  const [nx, ny] = J.neck;
  const [hpx, hpy] = J.hip;
  const A = [nx - 1.3, ny + 0.9];
  const P = [nx + (hpx - nx) * 0.5 - 1.6, ny + (hpy - ny) * 0.5];
  const L = 30 + stream * 4;
  const th = 0.3 + Math.max(0, stream) * 1.12 + Math.min(0, stream) * 0.5 + Math.sin(t * 2 + (u.id || 0)) * 0.03;
  const dx = -Math.sin(th), dy = Math.cos(th); // trailing direction
  const ox = -Math.cos(th), oy = -Math.sin(th); // outward (away from the body)
  const flap = (k, amp) => Math.sin(t * (9 + stream * 4) + k * 1.9 + (u.id || 0)) * amp;
  const fl = 0.8 + Math.max(0, stream) * 3.2;
  const T1 = [A[0] + dx * L + ox * (5 + stream * 5) + flap(0, fl) * ox, A[1] + dy * L + oy * (5 + stream * 5) + flap(0, fl) * oy];
  const T2 = [P[0] + dx * L * 0.8 + ox * (1 + stream * 2) + flap(2, fl) * ox, P[1] + dy * L * 0.8 + oy * (1 + stream * 2) + flap(2, fl) * oy];
  const c1 = [A[0] + dx * L * 0.45 + ox * (2 + stream * 5 + flap(1, fl * 0.6)), A[1] + dy * L * 0.45 + oy * (2 + stream * 5 + flap(1, fl * 0.6))];
  const c2 = [P[0] + dx * L * 0.4 + ox * (0.4 + stream * 1.5), P[1] + dy * L * 0.4 + oy * (0.4 + stream * 1.5)];
  // hem scallops between T1 and T2
  const hem = (k) => {
    const f = k / 3;
    const bx = T1[0] + (T2[0] - T1[0]) * f, by = T1[1] + (T2[1] - T1[1]) * f;
    const sag = (k % 2 ? 1 : -1) * 2.6 + flap(k + 3, fl * 0.7);
    return [bx + dx * sag, by + dy * sag];
  };
  const h1 = hem(1), h2 = hem(2);
  const dark = o.dark || o.col;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.quadraticCurveTo(c1[0], c1[1], T1[0], T1[1]);
  ctx.quadraticCurveTo(h1[0], h1[1] + 2.2, (T1[0] + h2[0]) / 2 * 0.5 + h1[0] * 0.5, (T1[1] + h2[1]) / 2 * 0.5 + h1[1] * 0.5);
  ctx.quadraticCurveTo(h2[0], h2[1] - 2.2, T2[0], T2[1]);
  ctx.quadraticCurveTo(c2[0], c2[1], P[0], P[1]);
  ctx.closePath();
  ctx.fillStyle = o.col;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // folds
  ctx.strokeStyle = o.light || 'rgba(255,255,255,.45)';
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = lw * 0.45;
  ctx.beginPath();
  ctx.moveTo(A[0] + dx * 5 + ox * 0.6, A[1] + dy * 5 + oy * 0.6);
  ctx.quadraticCurveTo(c1[0] * 0.55 + c2[0] * 0.45, c1[1] * 0.55 + c2[1] * 0.45, h1[0] - dx * 2, h1[1] - dy * 2);
  ctx.moveTo(P[0] + dx * 8, P[1] + dy * 8);
  ctx.lineTo(h2[0] - dx * 3, h2[1] - dy * 3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // gold hem
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = lw * 0.55;
  ctx.beginPath();
  ctx.moveTo(T1[0], T1[1]);
  ctx.quadraticCurveTo(h1[0], h1[1] + 2.2, (T1[0] + h2[0]) / 2 * 0.5 + h1[0] * 0.5, (T1[1] + h2[1]) / 2 * 0.5 + h1[1] * 0.5);
  ctx.quadraticCurveTo(h2[0], h2[1] - 2.2, T2[0], T2[1]);
  ctx.stroke();
  ctx.restore();
}

// Gold ring under the Captain's feet so he is easy to find in a crowd.
function drawHeroRing(ctx, o) {
  const t = o.t || 0;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 19, 4.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(242,176,30,${0.12 + 0.06 * pulse})`;
  ctx.fill();
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -t * 8;
  ctx.strokeStyle = `rgba(242,176,30,${0.65 + 0.25 * pulse})`;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.restore();
}

// Fury full: a warm pulse behind the body.
function drawFuryAura(ctx, o) {
  const t = o.t || 0;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const g = ctx.createRadialGradient(0, -34, 4, 0, -34, 40);
  g.addColorStop(0, `rgba(255,214,70,${0.42 + 0.2 * pulse})`);
  g.addColorStop(1, 'rgba(255,214,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -34, 40, 0, Math.PI * 2);
  ctx.fill();
}

function drawFurySparks(ctx, o) {
  const t = o.t || 0;
  for (let i = 0; i < 3; i++) {
    const a = t * 2.2 + i * 2.1;
    const x = Math.cos(a) * 15, y = -36 + Math.sin(a * 1.3) * 26;
    const r = 2 + 1.6 * Math.abs(Math.sin(t * 7 + i * 1.7));
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.6); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r * 1.6); ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r * 1.6);
    ctx.fillStyle = '#fff6c8';
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
}

// Inkstorm: spinning blades in two orbits plus an inked ground ring that shows the damage radius.
const ORBITS = [
  { cy: -14, rx: 52, ry: 9, speed: 15, n: 2, base: 0 },
  { cy: -41, rx: 44, ry: 9, speed: -19, n: 2, base: 1.2 },
];

function drawBlade(ctx, o, cx, cy, rx, ry, a, dir) {
  // trail: a tapering ribbon along the orbit behind the blade
  const col = o.col, light = o.light || '#fff';
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const f0 = i / steps, f1 = (i + 1) / steps;
    const a0 = a - dir * (1 - f0) * 1.1, a1 = a - dir * (1 - f1) * 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    ctx.lineTo(cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.15 + 0.7 * f1;
    ctx.lineWidth = 1.6 + 6 * f1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
  const tx = -Math.sin(a) * rx * dir, ty = Math.cos(a) * ry * dir;
  const ang = Math.atan2(ty, tx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.quadraticCurveTo(1, -5.4, -8, -2);
  ctx.lineTo(-8, 2);
  ctx.quadraticCurveTo(1, 5.4, 13, 0);
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = o.dark || col;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function stormGround(ctx, o, u) {
  const t = o.t || 0;
  const R = 95 / (u.scale || 1);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, R, R * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(31,71,194,.10)';
  ctx.fill();
  ctx.setLineDash([9, 6]);
  ctx.lineDashOffset = -t * 40;
  ctx.strokeStyle = o.col;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function stormBlades(ctx, o, front) {
  const t = o.t || 0;
  for (const orb of ORBITS) {
    const dir = Math.sign(orb.speed);
    for (let i = 0; i < orb.n; i++) {
      const a = t * orb.speed + orb.base + (i * Math.PI * 2) / orb.n;
      if ((Math.sin(a) > 0) !== front) continue;
      drawBlade(ctx, o, 0, orb.cy, orb.rx, orb.ry, a, dir);
    }
  }
}

EXTRAS_DRAW.cape = {
  back(ctx, J, o) {
    const u = o.unit || {};
    if (u.isHero) {
      drawHeroRing(ctx, o);
      if (u.data && u.data.storm) { stormGround(ctx, o, u); stormBlades(ctx, o, false); }
      else if (u.data && u.data.fury >= 100) drawFuryAura(ctx, o);
    }
    drawCape(ctx, J, o);
  },
  front(ctx, J, o) {
    const u = o.unit || {};
    // gold clasp at the throat
    const [nx, ny] = J.neck;
    ctx.beginPath();
    ctx.arc(nx + 1.4, ny + 1.5, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.strokeStyle = o.dark || o.col;
    ctx.lineWidth = (o.lw || 2.5) * 0.5;
    ctx.stroke();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath(); ctx.arc(nx + 0.9, ny + 0.9, 0.7, 0, Math.PI * 2); ctx.fill();
    if (u.isHero && u.data) {
      if (u.data.storm) stormBlades(ctx, o, true);
      else if (u.data.fury >= 100) drawFurySparks(ctx, o);
    }
  },
};

EXTRAS_DRAW.glasses = {
  front(ctx, J, o) {
    const r = ((o.look && o.look.head) || 1);
    drawGlasses(ctx, J.head[0], J.head[1], J.headTilt, o, r);
  },
};

// ---------------------------------------------------------------- event FX
const dirOf = (e) => (e.unit && e.unit.facing) || 1;

function lines(r, x, y, z, n, col, speed, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.a0 != null ? o.a0 + (Math.random() - 0.5) * (o.spread ?? 0.6) : (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const v = speed * (0.7 + Math.random() * 0.6);
    r.fx.add({ kind: 'line', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (o.flat ?? 0.6), g: 0, col, size: 2.2, life: o.life ?? 0.35, drag: 3 });
  }
}

function crack(r, x, z) {
  const c = r.fx.decalCtx;
  if (!c) return;
  const px = (x + 100) * 1.5, py = (z * DEPTH + 40) * 1.5;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = INK_DARK;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      let cx = px, cy = py + (k - 1) * 4;
      const len = 70 + Math.random() * 90;
      c.globalAlpha = 0.8;
      c.lineWidth = 3.2 - k * 0.7;
      c.beginPath();
      c.moveTo(cx, cy);
      for (let d = 0; d < len; d += 11 + Math.random() * 9) {
        cx += side * (11 + Math.random() * 9);
        cy += (Math.random() - 0.5) * 12 + (k - 1) * 2;
        cy = clamp(cy, 8, 112);
        c.lineTo(cx, cy);
        if (Math.random() < 0.28) {
          c.moveTo(cx, cy);
          c.lineTo(cx + side * 8, cy + (Math.random() - 0.5) * 20);
          c.moveTo(cx, cy);
        }
      }
      c.stroke();
    }
  }
  c.restore();
}

const prevAbility = EVENT_FX.heroAbility;
EVENT_FX.heroAbility = (r, e, b) => {
  if (prevAbility) prevAbility(r, e, b);
  const pal = r.pal[e.team] || r.pal[0];
  const x = e.x, z = e.z || 0;
  if (e.id === 'rally' && e.phase === 'start') {
    const R = e.radius || 320;
    r.fx.text(x, -112, 'RALLY!', pal.ink, 28, { life: 1.0, vy: -38, bold: true });
    [[0.62, 0.55], [0.5, 0.45], [0.36, 0.35]].forEach(([k, life], i) => r.fx.ring(x, -4 - i * 3, z, i === 0 ? GOLD : pal.ink, R * k, life));
    lines(r, x, -46, z, 16, pal.ink, 460, { life: 0.4, flat: 0.5 });
    for (const dx of [-26, 4, 30]) r.fx.text(x + dx, -92 - Math.abs(dx) * 0.2, '!', pal.ink, 30, { life: 0.8, vy: -30 });
    for (let i = 0; i < 3; i++) r.fx.splat(x + (i - 1) * 50, z, pal.ink, 6, 0.6);
    if (b) {
      for (const a of b.units) {
        if (!a.alive || a.team !== e.team || Math.abs(a.x - x) > R) continue;
        r.fx.add({ kind: 'star', x: a.x, y: a.y - a.height - 8, z: a.z, vx: 0, vy: -34, g: 0, col: GOLD, size: 3.2, life: 0.9 });
      }
    }
    r.shake(3);
  } else if (e.id === 'slam' && e.phase === 'start') {
    r.fx.puff(x, -2, z, 'rgba(110,100,85,.45)', 4, 9);
    r.fx.burst(x, -4, z, 6, pal.ink, 200, 'dot', { size: 1.8, life: 0.3, spread: 0.9 });
  } else if (e.id === 'slam' && e.phase === 'land') {
    const R = e.radius || 120;
    r.fx.ring(x, 0, z, INK_DARK, R * 0.62, 0.5);
    r.fx.ring(x, 0, z, GOLD, R * 0.42, 0.4);
    r.fx.puff(x, -2, z, 'rgba(120,108,90,.36)', 9, 13);
    r.fx.burst(x, -4, z, 22, '#8a7658', 380, 'dot', { size: 2.6, life: 0.7, spread: 1.4 });
    r.fx.burst(x, -4, z, 14, pal.ink, 320, 'dot', { size: 2.4, life: 0.6, spread: 1.4 });
    lines(r, x, -4, z, 12, INK_DARK, 520, { a0: -Math.PI / 2, spread: 3, life: 0.3, flat: 0.5 });
    r.fx.splat(x, z, pal.ink, 26, 0.85);
    r.fx.stain(x, z, INK_DARK, R * 0.8, 6, 0.25);
    crack(r, x, z);
    r.fx.text(x, -92, 'SLAM!', pal.ink, 30, { life: 0.9, vy: -34, bold: true });
    r.shake(12);
  } else if (e.id === 'inkstorm' && e.phase === 'start') {
    const R = e.radius || 95;
    r.fx.text(x, -120, 'INKSTORM!', pal.ink, 30, { life: 1.1, vy: -36, bold: true });
    r.fx.ring(x, -4, z, GOLD, R * 0.9, 0.5);
    r.fx.ring(x, -4, z, pal.ink, R * 0.6, 0.4);
    r.fx.burst(x, -34, z, 26, pal.ink, 420, 'dot', { size: 3, life: 0.7, spread: 3 });
    lines(r, x, -34, z, 18, '#ffffff', 520, { life: 0.35, flat: 0.7 });
    r.fx.splat(x, z, pal.ink, 22, 0.8);
    r.shake(7);
  } else if (e.id === 'inkstorm' && e.phase === 'end') {
    r.fx.puff(x, -30, z, 'rgba(60,70,110,.35)', 6, 12);
    r.fx.ring(x, -4, z, pal.ink, 60, 0.35);
  }
};

const prevTick = EVENT_FX.heroStormTick;
EVENT_FX.heroStormTick = (r, e) => {
  if (prevTick) prevTick(r, e);
  const pal = r.pal[e.team] || r.pal[0];
  const R = e.radius || 95;
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = R * (0.6 + Math.random() * 0.45);
    r.fx.add({ kind: 'dot', x: e.x + Math.cos(a) * rr, y: -6 - Math.random() * 40, z: e.z || 0, vx: Math.cos(a) * 140, vy: -90 - Math.random() * 120, col: pal.ink, size: 1.6 + Math.random() * 1.8, life: 0.5 });
  }
  r.fx.splat(e.x + (Math.random() * 2 - 1) * R * 0.9, (e.z || 0) + (Math.random() - 0.5) * 0.4, pal.ink, 5 + Math.random() * 4, 0.55);
  r.shake(1.2);
};

const prevHit = EVENT_FX.heroHit;
EVENT_FX.heroHit = (r, e) => {
  if (prevHit) prevHit(r, e);
  const pal = r.pal[e.team] || r.pal[0];
  const dir = dirOf(e);
  const a0 = dir > 0 ? -0.35 : Math.PI + 0.35;
  if (e.combo === 3) {
    r.fx.ring(e.x, 0, e.z, GOLD, 34, 0.35);
    r.fx.puff(e.x, -2, e.z, 'rgba(110,100,85,.4)', 5, 11);
    lines(r, e.x, -34, e.z, 10, pal.ink, 520, { a0, spread: 1.3, life: 0.3, flat: 0.8 });
    r.fx.burst(e.x, -30, e.z, 8, pal.ink, 300, 'dot', { size: 2.4, life: 0.5, spread: 1.2, vx: dir * 140 });
    r.shake(5);
  } else {
    lines(r, e.x, -36, e.z, 5, '#ffffff', 420, { a0, spread: 0.9, life: 0.22, flat: 0.8 });
  }
};

// ---------------------------------------------------------------- icons
const lineW = (s) => s / 19;

ICON_DRAW.ability_rally = (ctx, s) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = lineW(s);
  // golden shout burst behind the flag
  ctx.fillStyle = '#ffd23a';
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? s * 0.26 : s * 0.46;
    ctx.lineTo(s * 0.52 + Math.cos(a) * r, s * 0.42 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // pole
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw * 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.92);
  ctx.lineTo(s * 0.3, s * 0.12);
  ctx.stroke();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
  // flag
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.14);
  ctx.quadraticCurveTo(s * 0.5, s * 0.06, s * 0.66, s * 0.17);
  ctx.quadraticCurveTo(s * 0.8, s * 0.24, s * 0.92, s * 0.18);
  ctx.lineTo(s * 0.86, s * 0.34);
  ctx.lineTo(s * 0.92, s * 0.52);
  ctx.quadraticCurveTo(s * 0.74, s * 0.58, s * 0.6, s * 0.5);
  ctx.quadraticCurveTo(s * 0.46, s * 0.43, s * 0.3, s * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#2f6bff';
  ctx.fill();
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw;
  ctx.stroke();
  // star on the flag
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? s * 0.045 : s * 0.1;
    ctx.lineTo(s * 0.6 + Math.cos(a) * r, s * 0.31 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  // base mound
  ctx.beginPath();
  ctx.ellipse(s * 0.3, s * 0.92, s * 0.2, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#b9a98a';
  ctx.fill();
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
};

ICON_DRAW.ability_slam = (ctx, s) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = lineW(s);
  // impact star
  ctx.fillStyle = '#ffd23a';
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = i % 2 ? s * 0.22 : s * 0.46;
    ctx.lineTo(s * 0.5 + Math.cos(a) * r, s * 0.7 + Math.sin(a) * r * 0.78);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // ground slab with a crack
  ctx.beginPath();
  ctx.rect(s * 0.06, s * 0.78, s * 0.88, s * 0.16);
  ctx.fillStyle = '#b9a98a';
  ctx.fill();
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.78);
  ctx.lineTo(s * 0.44, s * 0.85);
  ctx.lineTo(s * 0.54, s * 0.88);
  ctx.lineTo(s * 0.48, s * 0.94);
  ctx.stroke();
  // fist coming down
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.3);
  ctx.quadraticCurveTo(s * 0.3, s * 0.18, s * 0.42, s * 0.18);
  ctx.lineTo(s * 0.62, s * 0.18);
  ctx.quadraticCurveTo(s * 0.74, s * 0.18, s * 0.74, s * 0.3);
  ctx.lineTo(s * 0.74, s * 0.56);
  ctx.quadraticCurveTo(s * 0.74, s * 0.7, s * 0.6, s * 0.7);
  ctx.lineTo(s * 0.44, s * 0.7);
  ctx.quadraticCurveTo(s * 0.3, s * 0.7, s * 0.3, s * 0.56);
  ctx.closePath();
  ctx.fillStyle = '#2f6bff';
  ctx.fill();
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw;
  ctx.stroke();
  // knuckle lines and highlight
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  for (const x of [0.43, 0.54, 0.65]) { ctx.moveTo(s * x, s * 0.5); ctx.lineTo(s * x, s * 0.7); }
  ctx.moveTo(s * 0.3, s * 0.5); ctx.lineTo(s * 0.74, s * 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath(); ctx.moveTo(s * 0.37, s * 0.26); ctx.lineTo(s * 0.37, s * 0.4); ctx.stroke();
  // speed lines
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (const x of [0.38, 0.52, 0.66]) { ctx.moveTo(s * x, s * 0.03); ctx.lineTo(s * x, s * 0.12); }
  ctx.stroke();
};

ICON_DRAW.ability_inkstorm = (ctx, s) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = lineW(s);
  const cx = s * 0.5, cy = s * 0.52;
  // swirl of ink
  ctx.fillStyle = '#c9dcff';
  ctx.strokeStyle = INK_DARK;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // three crescent blades chasing each other
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI * 2) / 3 - 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, -0.15, 1.75);
    ctx.arc(0, 0, s * 0.19, 1.6, -0.1, true);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? '#ffffff' : '#2f6bff';
    ctx.fill();
    ctx.strokeStyle = INK_DARK;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.restore();
  }
  // ink drop in the eye of the storm
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.15);
  ctx.quadraticCurveTo(cx + s * 0.13, cy + s * 0.02, cx + s * 0.1, cy + s * 0.07);
  ctx.arc(cx, cy + s * 0.07, s * 0.1, 0, Math.PI);
  ctx.quadraticCurveTo(cx - s * 0.13, cy + s * 0.02, cx, cy - s * 0.15);
  ctx.fillStyle = '#1b2240';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.ellipse(cx - s * 0.035, cy + s * 0.06, s * 0.02, s * 0.04, -0.3, 0, Math.PI * 2); ctx.fill();
};
