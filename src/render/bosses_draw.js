// OWNER: factions/bosses builder (package B)
// Boss visuals: AREA_DRAW for telegraphs and boss attacks (BODIES.wyrm and BODIES.hand live in bosses_bodies.js), and
// EVENT_FX for boss and enemy trait events (intro dust, slam rings, erase crumbs, chalk piles).
import { AREA_DRAW, EVENT_FX } from './renderer.js';
import { DEPTH } from './camera.js';
import { clamp, lerp, hash2, TAU } from '../core/util.js';
import './bosses_bodies.js';

const RED = '#e0281e';
const FONT = "'Permanent Marker', cursive";
const gy = (cam, z = 0) => cam.sy(z * DEPTH);

function ell(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
}

// ================================================================= telegraphs
function drawCircleT(ctx, cam, a, t, prog, label) {
  const z = cam.zoom;
  const cx = cam.sx(a.x), cy = gy(cam, 0) + 3 * z;
  const rx = a.radius * z, ry = Math.max(16 * z, rx * 0.22);
  ctx.fillStyle = `rgba(224,40,30,${0.07 + 0.2 * prog})`;
  ell(ctx, cx, cy, rx, ry);
  ctx.fill();
  // countdown ring closes in on the centre
  ctx.strokeStyle = `rgba(224,40,30,${0.45 + 0.4 * prog})`;
  ctx.lineWidth = 2 * z;
  ell(ctx, cx, cy, rx * (1 - prog * 0.92), ry * (1 - prog * 0.92));
  ctx.stroke();
  ctx.setLineDash([14 * z, 9 * z]);
  ctx.lineDashOffset = -t * 40 * z;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3 * z;
  ell(ctx, cx, cy, rx, ry);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label !== false) {
    ctx.fillStyle = RED;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4 * z;
    ctx.textAlign = 'center';
    const size = (26 + Math.sin(t * 14) * 2 * prog) * z;
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.strokeText(label || '!', cx, cy - 6 * z);
    ctx.fillText(label || '!', cx, cy - 6 * z);
    ctx.textAlign = 'left';
  }
}

function chevrons(ctx, cam, xa, xb, y, dirn, t, h) {
  const z = cam.zoom;
  const step = 64 * z;
  const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
  ctx.beginPath();
  const off = ((t * 90 * z) % step) * dirn;
  for (let x = lo + step * 0.5; x < hi; x += step) {
    const px = x + off;
    if (px < lo + 6 * z || px > hi - 6 * z) continue;
    ctx.moveTo(px - dirn * 7 * z, y - h);
    ctx.lineTo(px + dirn * 4 * z, y);
    ctx.lineTo(px - dirn * 7 * z, y + h);
  }
  ctx.stroke();
}

function drawBandT(ctx, cam, a, t, prog) {
  const z = cam.zoom;
  const boss = a.boss;
  const dirn = Math.sign(a.x - boss.x) || 1;
  const xa = cam.sx(a.x - a.width / 2), xb = cam.sx(a.x + a.width / 2);
  const y = gy(cam, 0), h = 24 * z;
  ctx.fillStyle = `rgba(224,40,30,${0.07 + 0.08 * prog})`;
  ctx.fillRect(xa, y - h, xb - xa, h * 2);
  // the stripe nearest the boss fills first, showing where the hit will travel
  const fx = dirn > 0 ? xa : xb - (xb - xa) * prog;
  ctx.fillStyle = `rgba(224,40,30,${0.1 + 0.2 * prog})`;
  ctx.fillRect(fx, y - h, (xb - xa) * prog, h * 2);
  ctx.strokeStyle = 'rgba(224,40,30,.7)';
  ctx.lineWidth = 2.4 * z;
  chevrons(ctx, cam, xa, xb, y, dirn, t, 9 * z);
  ctx.setLineDash([14 * z, 9 * z]);
  ctx.lineDashOffset = -t * 40 * z;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3 * z;
  ctx.strokeRect(xa, y - h, xb - xa, h * 2);
  ctx.setLineDash([]);
  if (prog > 0.85 && Math.sin(t * 50) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(xa, y - h, xb - xa, h * 2);
  }
}

function drawSweepT(ctx, cam, a, t, prog) {
  const z = cam.zoom;
  const xs = a.x0, xe = a.x0 + a.dirn * a.length;
  const xa = cam.sx(Math.min(xs, xe) - a.width / 2), xb = cam.sx(Math.max(xs, xe) + a.width / 2);
  const y = gy(cam, 0), h = 30 * z;
  // the whole path the eraser will travel
  ctx.fillStyle = `rgba(224,40,30,${0.05 + 0.07 * prog})`;
  ctx.fillRect(xa, y - h, xb - xa, h * 2);
  ctx.strokeStyle = 'rgba(224,40,30,.6)';
  ctx.lineWidth = 2.4 * z;
  chevrons(ctx, cam, xa, xb, y, a.dirn, t, 10 * z);
  ctx.setLineDash([14 * z, 9 * z]);
  ctx.lineDashOffset = -t * 40 * z;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3 * z;
  ctx.strokeRect(xa, y - h, xb - xa, h * 2);
  ctx.setLineDash([]);
  // shadow of the hand where the sweep starts, darkening as it lands
  const sx0 = cam.sx(xs - a.width / 2), sx1 = cam.sx(xs + a.width / 2);
  const g = ctx.createLinearGradient(0, y - 190 * z, 0, y);
  g.addColorStop(0, 'rgba(40,36,60,0)');
  g.addColorStop(1, `rgba(40,36,60,${0.12 + 0.22 * prog})`);
  ctx.fillStyle = g;
  ctx.fillRect(sx0, y - 190 * z, sx1 - sx0, 190 * z);
  ctx.fillStyle = `rgba(40,36,60,${0.2 + 0.28 * prog})`;
  ctx.fillRect(sx0, y - h, sx1 - sx0, h * 2);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3 * z;
  ctx.strokeRect(sx0, y - h, sx1 - sx0, h * 2);
  ctx.fillStyle = RED;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4 * z;
  ctx.textAlign = 'center';
  ctx.font = `${Math.round((28 + Math.sin(t * 14) * 2) * z)}px ${FONT}`;
  ctx.strokeText('ERASE!', (sx0 + sx1) / 2, y - h - 10 * z);
  ctx.fillText('ERASE!', (sx0 + sx1) / 2, y - h - 10 * z);
  ctx.textAlign = 'left';
}

AREA_DRAW.telegraph = {
  under(ctx, cam, a, b, t) {
    const prog = clamp(a.t / a.delay, 0, 1);
    ctx.save();
    if (a.shape === 'circle') drawCircleT(ctx, cam, a, t, prog, a.tkind === 'stab' ? 'X' : a.tkind === 'rain' ? 'x²' : '!');
    else if (a.shape === 'quiz') drawCircleT(ctx, cam, a, t, prog, 'POP QUIZ');
    else if (a.shape === 'band') drawBandT(ctx, cam, a, t, prog);
    else if (a.shape === 'sweep') drawSweepT(ctx, cam, a, t, prog);
    ctx.restore();
  },
  over(ctx, cam, a, b, t) {
    if (a.shape !== 'quiz') return;
    const prog = clamp(a.t / a.delay, 0, 1);
    const z = cam.zoom;
    ctx.save();
    ctx.textAlign = 'center';
    for (const u of b.units) {
      if (!u.alive || !u.targetable || u.team === a.team || (u.flying && !u.data.landed)) continue;
      if (Math.abs(u.x - a.x) - u.radius > a.radius) continue;
      const bounce = Math.abs(Math.sin(t * 9 + u.id)) * 7;
      const x = cam.sx(u.x), y = cam.sy(u.y + u.z * DEPTH - u.height - 14) - bounce * z;
      const size = (22 + prog * 12) * z;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.strokeStyle = '#2d2a45';
      ctx.lineWidth = 5 * z;
      ctx.strokeText('?', x, y);
      ctx.fillStyle = prog > 0.8 && Math.sin(t * 40) > 0 ? '#ffe14a' : '#ffffff';
      ctx.fillText('?', x, y);
    }
    ctx.restore();
  },
};

// ================================================================= boss attack areas
AREA_DRAW.shockwave = {
  over(ctx, cam, a, b, t, r) {
    const pal = r.pal[a.team];
    const z = cam.zoom;
    const y = gy(cam, 0);
    const x = cam.sx(a.x), x0 = cam.sx(a.x0);
    // cracked ridge left behind
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = 2.4 * z;
    ctx.beginPath();
    const n = Math.max(2, Math.floor(Math.abs(x - x0) / (16 * z)));
    for (let i = 0; i <= n; i++) {
      const px = lerp(x0, x, i / n);
      const py = y + 4 * z + (i % 2 ? -3 : 3) * z;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // the rolling hump
    const hw = 46 * z, hh = (30 + Math.sin(t * 22) * 3) * z;
    ctx.beginPath();
    ctx.moveTo(x - a.dirn * hw * 1.5, y + 6 * z);
    ctx.quadraticCurveTo(x - a.dirn * hw * 0.2, y - hh * 1.5, x + a.dirn * hw * 0.5, y - hh * 0.4);
    ctx.lineTo(x + a.dirn * hw * 0.6, y + 6 * z);
    ctx.closePath();
    ctx.fillStyle = pal.light;
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3 * z;
    ctx.stroke();
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const px = x - a.dirn * hw * (0.9 - i * 0.35);
      ctx.moveTo(px, y - hh * (0.3 + 0.1 * i)); ctx.lineTo(px + a.dirn * 8 * z, y - 1 * z);
    }
    ctx.stroke();
    // flung chunks
    ctx.fillStyle = pal.ink;
    for (let i = 0; i < 6; i++) {
      const k = (t * 3 + i * 0.37) % 1;
      ctx.fillRect(x - a.dirn * (10 + i * 12) * z, y - (6 + Math.sin(k * 3.14) * 34) * z - (i % 3) * 4 * z, 4 * z, 4 * z);
    }
  },
};

AREA_DRAW.smear = {
  under(ctx, cam, a, b, t, r) {
    const pal = r.pal[a.team];
    const z = cam.zoom;
    const fade = Math.min(1, a.t / 0.25, (a.dur - a.t) / 1.5);
    if (fade <= 0) return;
    const cx = cam.sx(a.x), cy = gy(cam, 0) + 5 * z;
    ctx.globalAlpha = 0.55 * fade;
    ctx.fillStyle = pal.dark;
    ell(ctx, cx, cy, a.radius * z, 14 * z);
    ctx.fill();
    ctx.globalAlpha = 0.9 * fade;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5 * z;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const px = cx + (hash2(a.seed, i) - 0.5) * a.radius * 1.6 * z;
      ctx.moveTo(px - 10 * z, cy - 5 * z + (i % 3) * 4 * z);
      ctx.lineTo(px + 10 * z, cy - 1 * z + (i % 3) * 4 * z);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

AREA_DRAW.burnline = {
  under(ctx, cam, a, b, t, r) {
    const z = cam.zoom;
    const fade = Math.min(1, (a.dur - a.t) / 1.2);
    if (fade <= 0) return;
    const reach = a.len * Math.min(1, a.t / a.grow);
    const xa = cam.sx(a.x0), xb = cam.sx(a.x0 + a.dirn * reach);
    const y = gy(cam, 0);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(255,236,40,.55)';
    ctx.fillRect(Math.min(xa, xb), y - 12 * z, Math.abs(xb - xa), 26 * z);
    ctx.fillStyle = 'rgba(224,23,125,.35)';
    ctx.fillRect(Math.min(xa, xb), y - 3 * z, Math.abs(xb - xa), 12 * z);
    ctx.globalAlpha = 1;
  },
  over(ctx, cam, a, b, t, r) {
    const z = cam.zoom;
    const fade = Math.min(1, (a.dur - a.t) / 1.2);
    if (fade <= 0) return;
    const reach = a.len * Math.min(1, a.t / a.grow);
    const y = gy(cam, 0);
    ctx.globalAlpha = fade;
    // flames along the line
    for (let px = 0; px < reach; px += 17) {
      const i = px / 17;
      const fx = cam.sx(a.x0 + a.dirn * px);
      const hgt = (14 + 14 * (0.5 + 0.5 * Math.sin(t * 13 + i * 1.7))) * z;
      const w = 9 * z;
      ctx.fillStyle = i % 2 ? '#e0177d' : '#ff7a2b';
      ctx.beginPath();
      ctx.moveTo(fx - w, y + 6 * z);
      ctx.quadraticCurveTo(fx - w * 0.7, y - hgt * 0.5, fx + Math.sin(t * 9 + i) * 3 * z, y - hgt);
      ctx.quadraticCurveTo(fx + w * 0.7, y - hgt * 0.4, fx + w, y + 6 * z);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffec28';
      ctx.beginPath();
      ctx.moveTo(fx - w * 0.5, y + 6 * z);
      ctx.quadraticCurveTo(fx, y - hgt * 0.65, fx + w * 0.5, y + 6 * z);
      ctx.closePath();
      ctx.fill();
    }
    // the stream from the wyrm's mouth while it breathes
    if (a.t < a.grow + 0.25) {
      const sx = cam.sx(a.mx + a.dirn * 64), sy = cam.sy(a.my);
      const ex = cam.sx(a.x0 + a.dirn * Math.min(reach + 20, a.len)), ey = y;
      for (let k = 0; k < 32; k++) {
        const f = ((t * 2.6 + k / 32) % 1);
        const px = lerp(sx, ex, f) + Math.sin(t * 30 + k) * 5 * z;
        const py = lerp(sy, ey, f * f) + Math.cos(t * 26 + k) * 4 * z;
        ctx.fillStyle = k % 3 === 0 ? '#e0177d' : k % 3 === 1 ? '#ffec28' : '#ff7a2b';
        ctx.beginPath();
        ctx.arc(px, py, (2.5 + f * 6) * z, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};

AREA_DRAW.erase = {
  under(ctx, cam, a, b, t, r) {
    const z = cam.zoom;
    const y = gy(cam, 0);
    const xa = cam.sx(a.x0), xb = cam.sx(a.x);
    const fade = clamp((a.dur - a.t) / 0.5 + 1, 0, 1);
    // the ground line rubbed out behind the eraser
    ctx.fillStyle = r.page && r.page.paper ? r.page.paper : '#f1e6cf';
    ctx.globalAlpha = 0.9 * fade;
    ctx.fillRect(Math.min(xa, xb), y - 12 * z, Math.abs(xb - xa), 34 * z);
    ctx.globalAlpha = 1;
  },
  over(ctx, cam, a, b, t) {
    const z = cam.zoom;
    const y = gy(cam, 0);
    const x = cam.sx(a.x);
    const w = a.w * z;
    ctx.fillStyle = 'rgba(40,36,60,.2)';
    ctx.fillRect(x - w / 2, y - 26 * z, w, 52 * z);
    ctx.strokeStyle = 'rgba(224,40,30,.55)';
    ctx.lineWidth = 2.5 * z;
    ctx.strokeRect(x - w / 2, y - 26 * z, w, 52 * z);
    // pink eraser flakes drifting down
    for (let i = 0; i < 26; i++) {
      const ph = (t * 1.6 + hash2(i, 11)) % 1;
      const fx = x + (hash2(i, 3) - 0.5) * w;
      const fy = y - (70 - ph * 80) * z;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(t * 5 + i);
      ctx.fillStyle = i % 3 ? '#f7a9bb' : '#ffffff';
      ctx.fillRect(-3 * z, -2 * z, 6 * z, 4 * z);
      ctx.restore();
    }
  },
};

AREA_DRAW.stab = {
  under(ctx, cam, a, b, t, r) {
    const z = cam.zoom;
    const fade = Math.min(1, (a.dur - a.t) / 0.8);
    if (fade <= 0) return;
    const cx = cam.sx(a.x), cy = gy(cam, 0) + 4 * z;
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(30,30,40,.5)';
    ell(ctx, cx, cy, 24 * z, 7 * z);
    ctx.fill();
    ctx.strokeStyle = '#2a2a38';
    ctx.lineWidth = 2.4 * z;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU + hash2(i, 5) * 0.4;
      const len = (40 + hash2(i, 9) * 70) * z;
      const mx = cx + Math.cos(ang) * len * 0.5, my = cy + Math.sin(ang) * len * 0.16;
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx + (hash2(i, 2) - 0.5) * 10 * z, my);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len * 0.2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

// ================================================================= event effects
const PAPER_BITS = '#f6f1e2';

function pal(r, team) { return r.pal[team] || r.pal[1]; }

EVENT_FX.bossIntro = (r, e) => {
  const u = e.unit;
  r.fx.puff(u.x, 0, u.z, 'rgba(80,80,90,.4)', 10, 22);
  r.fx.ring(u.x, 0, u.z, pal(r, u.team).ink, 90, 0.5);
  r.shake(5);
};

EVENT_FX.bossStep = (r, e) => {
  r.fx.puff(e.x - e.dirn * 20, 0, e.z, 'rgba(120,80,70,.3)', 2, 10);
  if (Math.random() < 0.5) r.fx.burst(e.x, -4, e.z, 2, '#cf2d24', 160, 'line', { size: 2, life: 0.25, spread: 0.6 });
};

EVENT_FX.bossDash = (r, e) => {
  r.fx.burst(e.x, -6, e.z, 8, '#cf2d24', 300, 'line', { size: 2.4, life: 0.35, spread: 1.0, vx: e.dirn * 260 });
  r.fx.puff(e.x, 0, e.z, 'rgba(120,80,70,.4)', 5, 14);
  r.shake(3);
};

EVENT_FX.bossSlam = (r, e) => {
  const p = pal(r, e.unit ? e.unit.team : 1);
  const z = e.z || 0;
  if (e.kind === 'slam') {
    r.fx.ring(e.x, 0, z, p.ink, 150, 0.55);
    r.fx.ring(e.x, 0, z, p.dark, 90, 0.4);
    r.fx.burst(e.x, -4, z, 22, p.ink, 420, 'dot', { size: 3.4, life: 0.8 });
    r.fx.puff(e.x, 0, z, 'rgba(70,70,76,.5)', 10, 20);
    r.fx.splat(e.x, z, p.ink, 36, 0.7);
    r.shake(11);
  } else if (e.kind === 'land') {
    r.fx.ring(e.x, 0, z, p.ink, e.radius * 0.8, 0.6);
    r.fx.ring(e.x, 0, z, '#ffec28', e.radius * 0.5, 0.45);
    r.fx.burst(e.x, -4, z, 26, p.ink, 460, 'paper', { size: 4, life: 1.0 });
    r.fx.puff(e.x, 0, z, 'rgba(110,100,90,.45)', 12, 24);
    r.shake(13);
  } else if (e.kind === 'erase') {
    r.fx.puff(e.x, 0, z, 'rgba(247,169,187,.5)', 8, 16);
    r.fx.burst(e.x, -10, z, 18, '#f7a9bb', 360, 'crumb', { size: 3, life: 0.9 });
    r.shake(9);
  } else {
    r.fx.puff(e.x, 0, z, 'rgba(120,80,70,.4)', 6, 14);
    r.fx.burst(e.x, -4, z, 10, '#cf2d24', 300, 'dot', { size: 2.6, life: 0.5 });
    r.shake(6);
  }
};

EVENT_FX.bossRoar = (r, e) => {
  const u = e.unit;
  const p = pal(r, e.team ?? u.team);
  const top = u.y - u.height * u.scale - 20;
  if (e.kind === 'warcry' || e.kind === 'rally') {
    r.fx.ring(u.x, 0, u.z, '#cf2d24', 260, 0.7);
    r.fx.ring(u.x, 0, u.z, '#f6b0aa', 160, 0.5);
    r.fx.text(u.x, top, e.kind === 'rally' ? 'RALLY!' : 'WAR CRY!', '#cf2d24', 26, { life: 1.1, vy: -30, bold: true });
    r.shake(5);
  } else if (e.kind === 'rage') {
    r.fx.ring(u.x, 0, u.z, p.ink, 240, 0.6);
    r.fx.burst(u.x, top + 30, u.z, 16, p.ink, 380, 'dot', { size: 3, life: 0.7, spread: 2.4 });
    r.fx.text(u.x, top, 'ROAR!', p.ink, 30, { life: 1.1, vy: -30 });
    r.shake(9);
  } else if (e.kind === 'takeoff') {
    r.fx.puff(u.x, 0, u.z, 'rgba(110,100,90,.45)', 10, 22);
    r.fx.burst(u.x, -6, u.z, 14, '#ffec28', 360, 'line', { size: 2.4, life: 0.4, spread: 1.6 });
    r.shake(6);
  } else if (e.kind === 'quiz') {
    r.fx.ring(u.x, 0, u.z, '#ffffff', 380, 0.7);
    r.fx.text(u.x, top, 'POP QUIZ!', '#ffe14a', 28, { life: 1.1, vy: -30 });
    r.shake(6);
  } else if (e.kind === 'rain') {
    r.fx.puff(u.x, top + 20, u.z, 'rgba(255,255,255,.5)', 6, 14);
    r.fx.text(u.x, top, 'EQUATIONS!', '#ffffff', 22, { life: 1.0, vy: -30 });
  } else if (e.kind === 'detention') {
    r.fx.ring(u.x, 0, u.z, '#ffffff', 200, 0.6);
    r.fx.text(u.x, top, 'DETENTION!', '#ffffff', 26, { life: 1.2, vy: -30 });
    r.shake(8);
  }
};

EVENT_FX.bossBelch = (r, e) => {
  const p = pal(r, e.unit.team);
  r.fx.burst(e.x, e.y, e.z, 14, p.ink, 380, 'dot', { size: 3, life: 0.6, vx: e.dirn * 160, spread: 0.9 });
  r.fx.puff(e.x, e.y, e.z, 'rgba(60,60,66,.5)', 5, 14);
  r.shake(3);
};

EVENT_FX.bossBreath = (r, e) => {
  const mx = e.x + e.dirn * 64;
  r.fx.burst(mx, e.y - 30, 0, 18, '#ff7a2b', 420, 'dot', { size: 3.4, life: 0.5, vx: e.dirn * 200, spread: 1.0 });
  r.fx.burst(mx, e.y - 30, 0, 10, '#ffec28', 340, 'star', { size: 3, life: 0.6, vx: e.dirn * 160 });
  r.shake(4);
};

EVENT_FX.bossEscalate = (r, e) => {
  const u = e.unit;
  const p = pal(r, u.team);
  r.fx.ring(u.x, u.y, u.z, p.ink, 300, 0.8);
  r.fx.ring(u.x, u.y, u.z, '#ffec28', 180, 0.6);
  r.fx.burst(u.x, u.y - u.height * 0.5, u.z, 24, p.ink, 520, 'star', { size: 3.6, life: 0.9, spread: 3 });
  r.shake(14);
};

EVENT_FX.quizStun = (r, e) => {
  r.fx.burst(e.x, e.y, e.z, 6, '#ffffff', 160, 'star', { size: 2.6, life: 0.6 });
};

EVENT_FX.handStab = (r, e) => {
  r.fx.ring(e.x, 0, e.z, '#26233a', e.radius, 0.5);
  r.fx.ring(e.x, 0, e.z, '#ffffff', e.radius * 0.6, 0.4);
  r.fx.burst(e.x, -4, e.z, 24, '#26233a', 520, 'dot', { size: 3.4, life: 0.8 });
  r.fx.puff(e.x, 0, e.z, 'rgba(60,56,70,.5)', 10, 20);
  r.fx.splat(e.x, e.z, '#26233a', 38, 0.8);
  r.shake(14);
};

EVENT_FX.handRedraw = (r, e) => {
  for (let i = 0; i < 3; i++) r.fx.burst(e.x - 40 + i * 50, -30, e.z, 8, '#26233a', 200, 'line', { size: 2, life: 0.5, spread: 2.2 });
  r.fx.text(e.x, -240, 'REDRAW!', '#d9667f', 24, { life: 1.0, vy: -26 });
  r.shake(4);
};

EVENT_FX.erased = (r, e) => {
  r.fx.burst(e.x, e.y, e.z, 10, '#f7a9bb', 260, 'crumb', { size: 3, life: 0.8, spread: 2.4 });
  r.fx.burst(e.x, e.y, e.z, 5, '#ffffff', 200, 'crumb', { size: 2.4, life: 0.6, spread: 2.4 });
};

EVENT_FX.bossDown = (r, e) => {
  const u = e.unit;
  const p = pal(r, u.team);
  const y = e.y - 60;
  r.fx.ring(e.x, 0, e.z, p.ink, 420, 0.9);
  r.fx.ring(e.x, 0, e.z, '#ffffff', 260, 0.7);
  const col = u.type === 'boss_hand' ? PAPER_BITS : p.ink;
  for (let i = 0; i < 4; i++) r.fx.burst(e.x + (Math.random() * 2 - 1) * 70, y - Math.random() * 40, e.z, 20, i % 2 ? col : p.ink, 560, i % 2 ? 'paper' : 'dot', { size: 4.4, life: 1.5, spread: 3 });
  r.fx.puff(e.x, y, e.z, 'rgba(80,80,90,.5)', 14, 28);
  r.shake(18);
};

// Dustborn pile and reform; Golem shatter; Eraser Knight cleanse.
EVENT_FX.reassemble = (r, e) => {
  const u = e.unit;
  const p = pal(r, u.team);
  if (e.phase === 'down') {
    r.fx.puff(u.x, 0, u.z, 'rgba(235,235,225,.6)', 9, 14);
    r.fx.burst(u.x, -14, u.z, 12, p.ink, 240, 'crumb', { size: 2.6, life: 0.7 });
    // chalk crumbs that stay where the pile is
    for (let i = 0; i < 9; i++) {
      r.fx.add({ kind: 'crumb', x: u.x + (Math.random() * 2 - 1) * 20, y: -1 - Math.random() * 3, z: u.z, vx: 0, vy: 0, g: 0, col: i % 2 ? p.ink : '#ffffff', size: 1.6 + Math.random() * 1.8, life: 2.4, rot: Math.random() * 6 });
    }
  } else {
    r.fx.puff(u.x, -10, u.z, 'rgba(235,235,225,.6)', 8, 14);
    r.fx.ring(u.x, 0, u.z, p.ink, 50, 0.45);
  }
};

EVENT_FX.shatter = (r, e) => {
  const p = pal(r, e.team);
  r.fx.burst(e.x, -40, e.z, 24, p.ink, 420, 'dot', { size: 3.4, life: 0.8, spread: 2.4 });
  r.fx.puff(e.x, -30, e.z, 'rgba(70,70,76,.5)', 8, 18);
  r.fx.ring(e.x, 0, e.z, p.dark, 80, 0.4);
  r.shake(6);
};

EVENT_FX.cleanse = (r, e) => {
  r.fx.burst(e.x, e.y, e.z, 7, '#f7a9bb', 220, 'crumb', { size: 2.4, life: 0.5, spread: 2.4 });
  r.fx.text(e.x, e.y - 14, 'NO HEAL', '#d9667f', 12, { life: 0.6, vy: -40 });
};
