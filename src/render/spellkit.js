// Small drawing helpers shared by the spell visuals (areas, bodies, icons).
// Objects are drawn in "world pixels" inside a translated + scaled context, so line widths are world units.
import { DEPTH } from './camera.js';
import { hash2, TAU } from '../core/util.js';

export const INK = '#1b2240';
export const PAPER = '#fffdf4';
export const NOTE_COLORS = ['#ffe94d', '#ff9fc4', '#8be3a0', '#7fd0ff', '#ffb066'];

export const sat = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const prog = (t, a, b) => sat((t - a) / (b - a));

// Run fn in a local frame: origin at world (x, y, z), scaled by camera zoom * sc, rotated by rot.
export function place(ctx, cam, x, y, z, rot, sc, fn) {
  ctx.save();
  ctx.translate(cam.sx(x), cam.sy(y + (z || 0) * DEPTH));
  const s = cam.zoom * (sc || 1);
  ctx.scale(s, s);
  if (rot) ctx.rotate(rot);
  fn(ctx);
  ctx.restore();
}

export function style(ctx, fill, stroke = INK, w = 2.6) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Fill + outline the current path.
export function fillStroke(ctx, fill, stroke = INK, w = 2.6) {
  style(ctx, fill, stroke, w);
  ctx.fill();
  ctx.stroke();
}

// Stable wobbly closed blob (puddles, smears). Returns nothing; builds the path.
export function blobPath(ctx, cx, cy, rx, ry, seed, n = 18, amp = 0.16, spin = 0) {
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * TAU + spin;
    const k = 1 + (hash2(seed, i % n) * 2 - 1) * amp;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Ground-plane ellipse: radius in world px along x, depth band ry.
export function groundEllipse(ctx, cam, x, rx, ry, fill, alpha = 1, z = 0) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cam.sx(x), cam.sy(z * DEPTH), rx * cam.zoom, ry * cam.zoom, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export const MARKER = "'Permanent Marker', cursive";
