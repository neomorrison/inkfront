// Hand-drawn drawing helpers. "Boil" = lines re-jitter a few times a second like a flipbook.
import { hash2, hash3, TAU } from '../core/util.js';

export const BOIL_FPS = 7;
export const boilFrame = (t) => Math.floor(t * BOIL_FPS);

// Stable pseudo-random offset in [-amp, amp] for (seed, i, frame).
export function wob(seed, i, frame, amp) {
  return (hash3(seed, i, frame) * 2 - 1) * amp;
}

export function inkLine(ctx, x1, y1, x2, y2, seed = 1, frame = 0, amp = 0.8) {
  const mx = (x1 + x2) / 2 + wob(seed, 1, frame, amp * 1.4);
  const my = (y1 + y2) / 2 + wob(seed, 2, frame, amp * 1.4);
  ctx.moveTo(x1 + wob(seed, 3, frame, amp), y1 + wob(seed, 4, frame, amp));
  ctx.quadraticCurveTo(mx, my, x2 + wob(seed, 5, frame, amp), y2 + wob(seed, 6, frame, amp));
}

// Wobbly closed circle path (does not stroke/fill).
export function inkCircle(ctx, x, y, r, seed = 1, frame = 0, amp = 0.6, steps = 12) {
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU + 0.3;
    const k = i % steps;
    const rr = r + wob(seed, k + 10, frame, amp);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Irregular ink splat blob path.
export function splatPath(ctx, x, y, r, seed) {
  const n = 9;
  ctx.moveTo(x + r, y);
  for (let i = 1; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU;
    const spike = i % 2 === 0 ? 0.55 + hash2(seed, i) * 0.6 : 0.95 + hash2(seed, i + 40) * 0.5;
    ctx.lineTo(x + Math.cos(a) * r * spike, y + Math.sin(a) * r * spike * 0.55);
  }
  ctx.closePath();
}

// Parallel hatching inside a rect, clipped by the caller if needed.
export function hatch(ctx, x, y, w, h, gap = 7, slope = 0.6) {
  for (let i = -h; i < w; i += gap) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h * slope, y);
  }
}

export function star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i / (n * 2)) * TAU;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
