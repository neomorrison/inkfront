// Page doodles: the little drawings in the margins and sky. DOODLE_DRAW[type](ctx, x, y, s, col, seed, frame).
// x,y is the doodle's base point (feet on the line), s = scale incl. camera zoom, frame = slow boil clock.
import { DOODLE_DRAW } from './world.js';
import { wob, inkCircle } from './ink.js';
import { TAU } from '../core/util.js';

const D = DOODLE_DRAW;

// Wobbly polyline.
function poly(ctx, pts, seed, f, amp = 0.9, close = false) {
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] + wob(seed, i, f, amp), y = pts[i][1] + wob(seed, i + 30, f, amp);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (close) ctx.closePath();
}

function setup(ctx, col, lw = 1.7) {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;
}

D.cloud = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  const w = (i, a) => wob(seed, i, f, a);
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  ctx.quadraticCurveTo(x - 46 * s + w(1, 1), y - 18 * s, x - 22 * s, y - 17 * s);
  ctx.quadraticCurveTo(x - 14 * s, y - 36 * s + w(2, 1.5), x + 5 * s, y - 24 * s);
  ctx.quadraticCurveTo(x + 24 * s, y - 36 * s + w(3, 1.5), x + 31 * s, y - 15 * s);
  ctx.quadraticCurveTo(x + 50 * s + w(4, 1), y - 12 * s, x + 41 * s, y);
  ctx.closePath();
  ctx.stroke();
  // A couple of hatch strokes in the belly.
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.moveTo(x - 24 * s + i * 14 * s, y - 3 * s); ctx.lineTo(x - 18 * s + i * 14 * s, y - 10 * s); }
  ctx.stroke();
};

D.sun = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.9);
  ctx.beginPath();
  inkCircle(ctx, x, y, 22 * s, seed, f, 1);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + f * 0.04, r1 = 30 * s, r2 = (i % 2 ? 40 : 46) * s;
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a) * r2 + wob(seed, i, f, 1), y + Math.sin(a) * r2 + wob(seed, i + 9, f, 1));
  }
  ctx.stroke();
  // Smile.
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y + 2 * s, 11 * s, 0.3, Math.PI - 0.3);
  ctx.moveTo(x - 7 * s, y - 6 * s); ctx.lineTo(x - 7 * s, y - 3 * s);
  ctx.moveTo(x + 7 * s, y - 6 * s); ctx.lineTo(x + 7 * s, y - 3 * s);
  ctx.stroke();
};

D.moon = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.9);
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0.7, TAU - 0.7);
  ctx.quadraticCurveTo(x + 6 * s + wob(seed, 1, f, 1), y, x + Math.cos(0.7) * 22 * s, y + Math.sin(0.7) * 22 * s);
  ctx.stroke();
  D.star(ctx, x + 36 * s, y - 20 * s, 0.6 * s, col, seed + 1, f);
  D.star(ctx, x + 44 * s, y + 18 * s, 0.45 * s, col, seed + 2, f);
};

D.hill = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  ctx.moveTo(x - 130 * s, y);
  ctx.quadraticCurveTo(x - 50 * s, y - 80 * s + wob(seed, 1, f, 1), x + 30 * s, y - 44 * s);
  ctx.quadraticCurveTo(x + 84 * s, y - 76 * s + wob(seed, 2, f, 1), x + 150 * s, y);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { const hx = x - 60 * s + i * 18 * s; ctx.moveTo(hx, y - 6 * s); ctx.lineTo(hx - 6 * s, y - 22 * s); }
  ctx.stroke();
};

D.mountain = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  poly(ctx, [[x - 120 * s, y], [x - 34 * s, y - 128 * s], [x + 8 * s, y - 74 * s], [x + 52 * s, y - 108 * s], [x + 130 * s, y]], seed, f, 0.9);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 50 * s, y - 96 * s); ctx.lineTo(x - 34 * s, y - 86 * s); ctx.lineTo(x - 20 * s, y - 100 * s);
  ctx.moveTo(x - 34 * s, y - 128 * s); ctx.lineTo(x - 34 * s, y - 86 * s);
  for (let i = 0; i < 5; i++) { ctx.moveTo(x - 10 * s + i * 8 * s, y - 20 * s); ctx.lineTo(x - 16 * s + i * 8 * s, y - 52 * s + i * 4 * s); }
  ctx.stroke();
};

D.tree = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.8);
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 2 * s, y - 42 * s);
  ctx.moveTo(x + 3 * s, y); ctx.lineTo(x + 2 * s, y - 42 * s);
  ctx.stroke();
  ctx.beginPath();
  inkCircle(ctx, x, y - 62 * s, 22 * s, seed, f, 1.6, 12);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x - 4 * s, y - 60 * s, 11 * s, 2.4, 4.4);
  ctx.moveTo(x - 6 * s, y - 24 * s); ctx.lineTo(x + 6 * s, y - 22 * s);
  ctx.stroke();
};

D.bird = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  const fl = f % 2 ? 4 : 0;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - fl * s); ctx.quadraticCurveTo(x - 4 * s, y - 7 * s, x, y);
  ctx.quadraticCurveTo(x + 4 * s, y - 7 * s, x + 10 * s, y - fl * s);
  ctx.stroke();
};

D.star = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; pts.push([x + Math.cos(a) * 13 * s, y + Math.sin(a) * 13 * s]); }
  poly(ctx, pts, seed, f, 0.6, true);
  ctx.stroke();
};

D.axis = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 56 * s, y + 34 * s); ctx.lineTo(x + 56 * s, y + 34 * s);
  ctx.moveTo(x + 52 * s, y + 31 * s); ctx.lineTo(x + 56 * s, y + 34 * s); ctx.lineTo(x + 52 * s, y + 37 * s);
  ctx.moveTo(x - 56 * s, y + 34 * s); ctx.lineTo(x - 56 * s, y - 56 * s);
  ctx.moveTo(x - 59 * s, y - 52 * s); ctx.lineTo(x - 56 * s, y - 56 * s); ctx.lineTo(x - 53 * s, y - 52 * s);
  for (let i = 1; i < 6; i++) { ctx.moveTo(x - 56 * s + i * 18 * s, y + 31 * s); ctx.lineTo(x - 56 * s + i * 18 * s, y + 37 * s); }
  ctx.stroke();
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(x - 56 * s, y + 24 * s);
  ctx.quadraticCurveTo(x - 10 * s, y + 10 * s + wob(seed, 1, f, 1), x + 10 * s, y - 22 * s);
  ctx.quadraticCurveTo(x + 26 * s, y - 44 * s, x + 50 * s, y - 48 * s);
  ctx.stroke();
};

D.parabola = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 50 * s, y + 20 * s); ctx.lineTo(x + 50 * s, y + 20 * s);
  ctx.moveTo(x, y + 26 * s); ctx.lineTo(x, y - 60 * s);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -10; i <= 10; i++) {
    const px = x + i * 4.4 * s, py = y + 10 * s - (100 - i * i) * 0.5 * s * 0.9;
    if (i === -10) ctx.moveTo(px, py); else ctx.lineTo(px, py + wob(seed, i + 20, f, 0.4));
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 35 * s, 3 * s, 0, TAU);
  ctx.fill();
};

D.cube = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  const a = 26 * s, h = 30 * s;
  ctx.beginPath();
  poly(ctx, [[x, y], [x - a, y - h * 0.45], [x - a, y - h * 1.45], [x, y - h], [x + a, y - h * 1.45], [x + a, y - h * 0.45]], seed, f, 0.7, true);
  ctx.moveTo(x - a, y - h * 1.45); ctx.lineTo(x, y - h * 1.9); ctx.lineTo(x + a, y - h * 1.45);
  ctx.moveTo(x, y - h); ctx.lineTo(x, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { ctx.moveTo(x + 4 * s + i * 4 * s, y - 4 * s - i * 2 * s); ctx.lineTo(x + 4 * s + i * 4 * s, y - h + 2 * s - i * 2 * s); }
  ctx.stroke();
};

D.triangle = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  ctx.beginPath();
  poly(ctx, [[x - 44 * s, y], [x + 44 * s, y], [x + 44 * s, y - 62 * s]], seed, f, 0.8, true);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 36 * s, y); ctx.lineTo(x + 36 * s, y - 8 * s); ctx.lineTo(x + 44 * s, y - 8 * s);
  ctx.moveTo(x - 26 * s, y); ctx.arc(x - 44 * s, y, 18 * s, 0, -0.95, true);
  ctx.stroke();
  ctx.font = `${Math.round(13 * s)}px 'Patrick Hand', cursive`;
  ctx.fillText('a', x - 4 * s, y + 15 * s);
  ctx.fillText('b', x + 51 * s, y - 28 * s);
};

D.bars = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 46 * s, y - 62 * s); ctx.lineTo(x - 46 * s, y); ctx.lineTo(x + 50 * s, y);
  const hs = [28, 48, 36, 62, 44];
  hs.forEach((hh, i) => { const bx = x - 40 * s + i * 18 * s; ctx.rect(bx + wob(seed, i, f, 0.5), y - hh * s, 13 * s, hh * s); });
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  hs.forEach((hh, i) => { const bx = x - 40 * s + i * 18 * s; for (let k = 4; k < hh; k += 6) { ctx.moveTo(bx, y - k * s); ctx.lineTo(bx + 13 * s, y - k * s - 5 * s); } });
  ctx.stroke();
};

D.ruler = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 70 * s, y - 12 * s); ctx.lineTo(x + 70 * s, y - 12 * s); ctx.lineTo(x + 70 * s, y + 6 * s); ctx.lineTo(x - 70 * s, y + 6 * s); ctx.closePath();
  for (let i = 0; i <= 28; i++) { const tx = x - 66 * s + i * 4.7 * s; ctx.moveTo(tx, y - 12 * s); ctx.lineTo(tx, y - (i % 5 ? 7 : 3) * s); }
  ctx.stroke();
};

D.kite = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  const cy = y - 90 * s + Math.sin(f * 0.7 + seed) * 3 * s;
  ctx.beginPath();
  poly(ctx, [[x, cy - 28 * s], [x + 20 * s, cy], [x, cy + 32 * s], [x - 20 * s, cy]], seed, f, 0.8, true);
  ctx.moveTo(x, cy - 28 * s); ctx.lineTo(x, cy + 32 * s);
  ctx.moveTo(x - 20 * s, cy); ctx.lineTo(x + 20 * s, cy);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x, cy + 32 * s);
  for (let i = 1; i <= 8; i++) ctx.lineTo(x - i * 6 * s + Math.sin(i + f * 0.5) * 5 * s, cy + 32 * s + i * 9 * s);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 2; i <= 6; i += 2) { const bx = x - i * 6 * s + Math.sin(i + f * 0.5) * 5 * s, by = cy + 32 * s + i * 9 * s; ctx.moveTo(bx - 4 * s, by - 3 * s); ctx.lineTo(bx + 4 * s, by + 3 * s); ctx.moveTo(bx + 4 * s, by - 3 * s); ctx.lineTo(bx - 4 * s, by + 3 * s); }
  ctx.stroke();
};

D.house = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  poly(ctx, [[x - 30 * s, y], [x - 30 * s, y - 36 * s], [x + 30 * s, y - 36 * s], [x + 30 * s, y]], seed, f, 0.8);
  ctx.moveTo(x - 38 * s, y - 34 * s); ctx.lineTo(x, y - 66 * s); ctx.lineTo(x + 38 * s, y - 34 * s);
  ctx.rect(x - 7 * s, y - 24 * s, 14 * s, 24 * s);
  ctx.rect(x + 14 * s, y - 30 * s, 10 * s, 10 * s);
  ctx.moveTo(x + 14 * s, y - 25 * s); ctx.lineTo(x + 24 * s, y - 25 * s);
  ctx.rect(x + 14 * s, y - 62 * s, 7 * s, 16 * s);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.arc(x + 17 * s + i * 4 * s, y - 70 * s - i * 8 * s, (3 + i) * s, 0, TAU); }
  ctx.stroke();
};

D.flower = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  const sway = Math.sin(f * 0.5 + seed) * 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway, y - 24 * s, x + sway, y - 46 * s);
  ctx.moveTo(x, y - 14 * s); ctx.quadraticCurveTo(x + 12 * s, y - 24 * s, x + 18 * s, y - 14 * s); ctx.quadraticCurveTo(x + 8 * s, y - 8 * s, x, y - 14 * s);
  ctx.stroke();
  const fx = x + sway, fy = y - 52 * s;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.moveTo(fx, fy);
    ctx.ellipse(fx + Math.cos(a) * 8 * s, fy + Math.sin(a) * 8 * s, 6 * s, 4 * s, a, 0, TAU);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fx, fy, 3 * s, 0, TAU);
  ctx.fill();
};

D.heart = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 30 * s, y - 22 * s + wob(seed, 1, f, 1), x - 16 * s, y - 44 * s, x, y - 28 * s);
  ctx.bezierCurveTo(x + 16 * s, y - 44 * s, x + 30 * s, y - 22 * s + wob(seed, 2, f, 1), x, y);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 24 * s); ctx.lineTo(x + 4 * s, y - 14 * s);
  ctx.stroke();
};

D.spiral = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const a = i * 0.32, r = (2 + i * 0.5) * s;
    const px = x + Math.cos(a) * r, py = y - 30 * s + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
};

D.plane = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  const by = y - 120 * s + Math.sin(f * 0.4 + seed) * 4 * s;
  ctx.beginPath();
  poly(ctx, [[x - 30 * s, by - 6 * s], [x + 34 * s, by], [x - 16 * s, by + 14 * s]], seed, f, 0.6, true);
  ctx.moveTo(x + 34 * s, by); ctx.lineTo(x - 12 * s, by + 4 * s); ctx.lineTo(x - 16 * s, by + 14 * s);
  ctx.stroke();
  ctx.setLineDash([3 * s, 4 * s]);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - 36 * s, by - 4 * s);
  ctx.bezierCurveTo(x - 80 * s, by + 10 * s, x - 100 * s, by - 16 * s, x - 150 * s, by + 8 * s);
  ctx.stroke();
  ctx.setLineDash([]);
};

D.butterfly = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  const fl = 0.6 + 0.4 * Math.abs(Math.sin(f * 1.4 + seed));
  const by = y - 90 * s + Math.sin(f * 0.6 + seed) * 5 * s;
  ctx.beginPath();
  for (const d of [-1, 1]) {
    ctx.moveTo(x, by);
    ctx.bezierCurveTo(x + d * 30 * s * fl, by - 26 * s, x + d * 34 * s * fl, by + 2 * s, x, by + 2 * s);
    ctx.moveTo(x, by + 2 * s);
    ctx.bezierCurveTo(x + d * 22 * s * fl, by + 4 * s, x + d * 20 * s * fl, by + 22 * s, x, by + 10 * s);
  }
  ctx.moveTo(x, by - 6 * s); ctx.lineTo(x, by + 14 * s);
  ctx.moveTo(x, by - 6 * s); ctx.quadraticCurveTo(x - 4 * s, by - 14 * s, x - 8 * s, by - 14 * s);
  ctx.moveTo(x, by - 6 * s); ctx.quadraticCurveTo(x + 4 * s, by - 14 * s, x + 8 * s, by - 14 * s);
  ctx.stroke();
};

D.eye = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  const ey = y - 50 * s;
  ctx.beginPath();
  ctx.moveTo(x - 38 * s, ey);
  ctx.quadraticCurveTo(x, ey - 34 * s, x + 38 * s, ey);
  ctx.quadraticCurveTo(x, ey + 30 * s, x - 38 * s, ey);
  ctx.moveTo(x + 12 * s, ey); ctx.arc(x, ey, 12 * s, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + wob(seed, 1, f, 1), ey, 5 * s, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = -2.5 + i * 0.4; ctx.moveTo(x + Math.cos(a) * 30 * s, ey - 6 * s + Math.sin(a) * 26 * s); ctx.lineTo(x + Math.cos(a) * 38 * s, ey - 8 * s + Math.sin(a) * 34 * s); }
  ctx.stroke();
};

D.vase = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - 70 * s);
  ctx.bezierCurveTo(x - 8 * s, y - 56 * s, x - 34 * s, y - 50 * s, x - 28 * s, y - 24 * s);
  ctx.bezierCurveTo(x - 26 * s, y - 8 * s, x - 16 * s, y, x - 14 * s, y);
  ctx.lineTo(x + 14 * s, y);
  ctx.bezierCurveTo(x + 16 * s, y, x + 26 * s, y - 8 * s, x + 28 * s, y - 24 * s);
  ctx.bezierCurveTo(x + 34 * s, y - 50 * s, x + 8 * s, y - 56 * s, x + 10 * s, y - 70 * s);
  ctx.moveTo(x - 14 * s, y - 70 * s); ctx.lineTo(x + 14 * s, y - 70 * s);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { ctx.moveTo(x + 8 * s + i * 2.5 * s, y - 40 * s + i * 4 * s); ctx.lineTo(x + 20 * s - i * 0.6 * s, y - 32 * s + i * 4 * s); }
  ctx.stroke();
};

D.face = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.4);
  const cy = y - 52 * s;
  ctx.beginPath();
  ctx.ellipse(x, cy, 22 * s, 28 * s, 0, 0, TAU);
  ctx.moveTo(x, cy - 34 * s); ctx.lineTo(x, cy + 34 * s);
  ctx.moveTo(x - 26 * s, cy - 6 * s); ctx.lineTo(x + 26 * s, cy - 6 * s);
  ctx.moveTo(x - 26 * s, cy + 10 * s); ctx.lineTo(x + 26 * s, cy + 10 * s);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(x - 9 * s, cy - 6 * s, 5 * s, 3 * s, 0, 0, TAU);
  ctx.ellipse(x + 9 * s, cy - 6 * s, 5 * s, 3 * s, 0, 0, TAU);
  ctx.moveTo(x - 7 * s, cy + 18 * s); ctx.quadraticCurveTo(x, cy + 22 * s, x + 7 * s, cy + 18 * s);
  ctx.stroke();
};

D.equation = (ctx, x, y, s, col, seed, f) => {
  ctx.fillStyle = col;
  ctx.font = `${Math.round(22 * s)}px 'Patrick Hand', cursive`;
  ctx.fillText(['a² + b² = c²', '2x + 3 = 11', 'sin² + cos² = 1', 'x = 4', '∑ n = n(n+1)/2'][seed % 5], x - 56 * s, y);
};

D.formula = (ctx, x, y, s, col, seed, f) => {
  ctx.fillStyle = col;
  ctx.font = `${Math.round(26 * s)}px 'Permanent Marker', cursive`;
  ctx.fillText(['E = mc²', 'F = ma', 'V = IR', 'PV = nRT'][seed % 4], x - 40 * s, y);
  setup(ctx, col, 1.4);
  ctx.beginPath();
  ctx.moveTo(x - 44 * s, y + 6 * s); ctx.quadraticCurveTo(x, y + 10 * s, x + 56 * s, y + 4 * s);
  ctx.stroke();
};

D.pi = (ctx, x, y, s, col, seed, f) => {
  ctx.fillStyle = col;
  ctx.font = `${Math.round(54 * s)}px 'Permanent Marker', cursive`;
  ctx.fillText('π', x - 14 * s, y);
  ctx.font = `${Math.round(15 * s)}px 'Patrick Hand', cursive`;
  ctx.fillText('3.14159', x - 24 * s, y + 18 * s);
};

D.atom = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  const cy = y - 50 * s;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { ctx.moveTo(x + 34 * s, cy); ctx.ellipse(x, cy, 34 * s, 12 * s, (i * Math.PI) / 3 + f * 0.01, 0, TAU); }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, cy, 5 * s, 0, TAU);
  ctx.fill();
  const a = f * 0.9 + seed;
  ctx.beginPath();
  ctx.arc(x + Math.cos(a) * 34 * s, cy + Math.sin(a) * 12 * s, 3 * s, 0, TAU);
  ctx.fill();
};

D.apple = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  ctx.moveTo(x, y - 36 * s);
  ctx.bezierCurveTo(x - 10 * s, y - 46 * s, x - 34 * s, y - 40 * s, x - 30 * s, y - 16 * s);
  ctx.bezierCurveTo(x - 26 * s, y, x - 10 * s, y + 2 * s, x, y - 4 * s);
  ctx.bezierCurveTo(x + 10 * s, y + 2 * s, x + 26 * s, y, x + 30 * s, y - 16 * s);
  ctx.bezierCurveTo(x + 34 * s, y - 40 * s, x + 10 * s, y - 46 * s, x, y - 36 * s);
  ctx.moveTo(x, y - 36 * s); ctx.quadraticCurveTo(x + 2 * s, y - 48 * s, x + 6 * s, y - 52 * s);
  ctx.moveTo(x + 4 * s, y - 44 * s); ctx.quadraticCurveTo(x + 16 * s, y - 54 * s, x + 22 * s, y - 44 * s); ctx.quadraticCurveTo(x + 12 * s, y - 40 * s, x + 4 * s, y - 44 * s);
  ctx.stroke();
};

D.flask = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.7);
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - 62 * s); ctx.lineTo(x - 9 * s, y - 36 * s); ctx.lineTo(x - 30 * s, y - 4 * s); ctx.quadraticCurveTo(x - 32 * s, y, x - 26 * s, y);
  ctx.lineTo(x + 26 * s, y); ctx.quadraticCurveTo(x + 32 * s, y, x + 30 * s, y - 4 * s); ctx.lineTo(x + 9 * s, y - 36 * s); ctx.lineTo(x + 9 * s, y - 62 * s);
  ctx.moveTo(x - 13 * s, y - 62 * s); ctx.lineTo(x + 13 * s, y - 62 * s);
  ctx.moveTo(x - 20 * s, y - 14 * s); ctx.lineTo(x + 20 * s, y - 14 * s);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const t = (f * 0.4 + i * 0.33 + seed * 0.1) % 1;
    ctx.beginPath();
    ctx.arc(x + (i - 1) * 7 * s, y - 14 * s - t * 36 * s, (3 - t * 2) * s, 0, TAU);
    ctx.stroke();
  }
};

D.globe = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  const cy = y - 44 * s;
  ctx.beginPath();
  ctx.arc(x, cy, 26 * s, 0, TAU);
  ctx.ellipse(x, cy, 26 * s, 9 * s, 0, 0, TAU);
  ctx.ellipse(x, cy, 10 * s, 26 * s, 0, 0, TAU);
  ctx.moveTo(x - 24 * s, cy - 10 * s); ctx.lineTo(x + 24 * s, cy - 10 * s);
  ctx.moveTo(x - 24 * s, cy + 10 * s); ctx.lineTo(x + 24 * s, cy + 10 * s);
  ctx.moveTo(x, y - 18 * s); ctx.lineTo(x, y);
  ctx.moveTo(x - 14 * s, y); ctx.lineTo(x + 14 * s, y);
  ctx.stroke();
};

// ---- The last page: things that were erased, crossed out or never finished.
D.ghost = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.setLineDash([4 * s, 5 * s]);
  ctx.beginPath();
  ctx.arc(x, y - 56 * s, 8 * s, 0, TAU);
  ctx.moveTo(x, y - 48 * s); ctx.lineTo(x, y - 24 * s); ctx.lineTo(x - 9 * s, y); ctx.moveTo(x, y - 24 * s); ctx.lineTo(x + 9 * s, y);
  ctx.moveTo(x, y - 42 * s); ctx.lineTo(x - 12 * s, y - 28 * s); ctx.moveTo(x, y - 42 * s); ctx.lineTo(x + 14 * s, y - 34 * s);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 6 * s;
  ctx.globalAlpha *= 0.12;
  ctx.beginPath();
  ctx.moveTo(x - 22 * s, y - 30 * s); ctx.lineTo(x + 24 * s, y - 62 * s);
  ctx.stroke();
  ctx.globalAlpha /= 0.12;
};

D.crossed = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.6);
  ctx.beginPath();
  inkCircle(ctx, x, y - 36 * s, 22 * s, seed, f, 1.2, 10);
  ctx.moveTo(x - 6 * s, y - 40 * s); ctx.lineTo(x - 6 * s, y - 36 * s);
  ctx.moveTo(x + 6 * s, y - 40 * s); ctx.lineTo(x + 6 * s, y - 36 * s);
  ctx.moveTo(x - 8 * s, y - 28 * s); ctx.quadraticCurveTo(x, y - 24 * s, x + 8 * s, y - 28 * s);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, y - 64 * s); ctx.lineTo(x + 34 * s, y - 8 * s);
  ctx.moveTo(x + 34 * s, y - 64 * s); ctx.lineTo(x - 34 * s, y - 8 * s);
  ctx.stroke();
};

D.ring = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, 'rgba(120,70,25,.30)', 3);
  ctx.beginPath();
  ctx.arc(x, y - 20 * s, 34 * s, 0.3, TAU - 0.5);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x + 2 * s, y - 20 * s, 31 * s, 1, TAU - 1.2);
  ctx.stroke();
};

D.unfinished = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  poly(ctx, [[x - 40 * s, y], [x - 40 * s, y - 50 * s], [x - 26 * s, y - 50 * s], [x - 26 * s, y - 60 * s], [x - 12 * s, y - 60 * s]], seed, f, 0.7);
  ctx.stroke();
  ctx.setLineDash([3 * s, 5 * s]);
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y - 60 * s); ctx.lineTo(x + 6 * s, y - 60 * s); ctx.lineTo(x + 6 * s, y - 50 * s); ctx.lineTo(x + 40 * s, y - 50 * s); ctx.lineTo(x + 40 * s, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 50 * s, y + 8 * s); ctx.lineTo(x + 52 * s, y + 8 * s);
  ctx.stroke();
};

D.smudge = (ctx, x, y, s, col, seed, f) => {
  ctx.fillStyle = 'rgba(80,60,40,.07)';
  ctx.beginPath();
  ctx.ellipse(x, y - 24 * s, 56 * s, 18 * s, -0.25, 0, TAU);
  ctx.ellipse(x + 30 * s, y - 34 * s, 36 * s, 12 * s, -0.4, 0, TAU);
  ctx.fill();
};

D.scribble = (ctx, x, y, s, col, seed, f) => {
  setup(ctx, col, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - 44 * s, y - 20 * s);
  for (let i = 0; i < 12; i++) ctx.lineTo(x - 44 * s + i * 8 * s + wob(seed, i, f, 1.2), y - 20 * s + (i % 2 ? -16 : 12) * s);
  ctx.stroke();
};
