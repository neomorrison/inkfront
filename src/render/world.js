// The page: paper, ruled lines, parallax doodles, the ground, ink wells and forts.
// OWNER: world/FX builder (package F) adds faction forts, chapter doodles, weather and polish.
import { PAGES } from '../data/pages.js';
import { RNG } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { DEPTH } from './camera.js';
import { inkCircle, splatPath, roundRect, wob } from './ink.js';

// FORT_DRAW[style] = (ctx, cam, fort, pal, t, world) ; DOODLE_DRAW[type] = (ctx, x, y, s, col, seed, t)
export const FORT_DRAW = {};
export const DOODLE_DRAW = {};

export class World {
  constructor() {
    this.page = PAGES.ruled;
    this.doodles = [];
    this.tufts = [];
    this.width = 3000;
  }

  setup(battle) {
    this.page = PAGES[battle.page] || PAGES.ruled;
    this.width = battle.width;
    const rng = new RNG((battle.seed || 1) * 31 + 7);
    this.doodles = [];
    const types = this.page.doodles || ['cloud'];
    for (let x = -400; x < this.width + 600; x += rng.range(160, 320)) {
      const type = rng.pick(types);
      const par = type === 'hill' || type === 'mountain' ? rng.range(0.35, 0.55) : type === 'sun' || type === 'moon' ? 0.1 : rng.range(0.2, 0.7);
      const yBase = type === 'hill' || type === 'mountain' || type === 'tree' ? -20 : -rng.range(240, 400);
      this.doodles.push({ type, x, y: yBase, par, s: rng.range(0.8, 1.4), seed: rng.int(1, 9999) });
    }
    // Keep at most one sun/moon.
    let sky = false;
    this.doodles = this.doodles.filter((d) => {
      if (d.type !== 'sun' && d.type !== 'moon') return true;
      if (sky) return false;
      sky = true;
      return true;
    });
    this.tufts = [];
    for (let x = 0; x < this.width; x += rng.range(18, 60)) this.tufts.push({ x, z: rng.range(-1, 1.6), seed: rng.int(1, 9999), k: rng.int(0, 2) });
  }

  drawBackground(ctx, cam, t) {
    const p = this.page;
    ctx.fillStyle = p.paper;
    ctx.fillRect(0, 0, cam.w, cam.h);
    const z = cam.zoom;
    if (p.rule) {
      ctx.strokeStyle = p.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gap = (p.ruleGap || 34) * z;
      for (let y = cam.groundY - gap * 0.5; y > 0; y -= gap) { ctx.moveTo(0, y); ctx.lineTo(cam.w, y); }
      ctx.stroke();
    }
    if (p.grid) {
      const g = p.grid, gap = g.gap * z;
      const ox = -((cam.x * z) % gap);
      ctx.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? g.color : g.major;
        ctx.beginPath();
        let i = Math.floor(cam.x / g.gap);
        for (let x = ox; x < cam.w; x += gap, i++) {
          if ((pass === 1) !== (i % g.every === 0)) continue;
          ctx.moveTo(x, 0); ctx.lineTo(x, cam.groundY);
        }
        let k = 0;
        for (let y = cam.groundY; y > 0; y -= gap, k++) {
          if ((pass === 1) !== (k % g.every === 0)) continue;
          ctx.moveTo(0, y); ctx.lineTo(cam.w, y);
        }
        ctx.stroke();
      }
    }
    if (p.margin) {
      const mx = cam.sx(-30);
      if (mx > -4 && mx < cam.w + 4) {
        ctx.strokeStyle = p.margin;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, cam.h); ctx.stroke();
      }
    }
    // Parallax doodles.
    const f = Math.floor(t * 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of this.doodles) {
      const sx = (d.x - cam.x * d.par) * z;
      if (sx < -300 * z || sx > cam.w + 300 * z) continue;
      const fn = DOODLE_DRAW[d.type];
      if (fn) fn(ctx, sx, cam.groundY + d.y * z, d.s * z, p.doodle, d.seed, f);
    }
  }

  drawGround(ctx, cam, t) {
    const p = this.page;
    const gy = cam.sy(-DEPTH - 8);
    // Pencil-shaded ground: light wash plus short hatch strokes near the ground line.
    ctx.fillStyle = p.hatch;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, gy, cam.w, cam.h - gy);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.hatch;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const step = 9 * cam.zoom;
    const x0 = -((cam.x * cam.zoom) % step) - step;
    const band = 46 * cam.zoom;
    for (let x = x0, i = Math.floor(cam.x / 9); x < cam.w + step; x += step, i++) {
      const len = band * (0.45 + ((i * 7919) % 13) / 24);
      ctx.moveTo(x, gy + 5);
      ctx.lineTo(x - len * 0.55, gy + 5 + len);
    }
    ctx.stroke();
    // Ground line.
    ctx.strokeStyle = p.ground;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const fr = Math.floor(t * 2);
    const seg = 60;
    const startW = Math.floor(cam.x / seg) * seg - seg;
    for (let wx = startW; wx < cam.x + cam.viewW + seg; wx += seg) {
      const yy = gy + wob(wx | 0, 1, fr, 1.2);
      if (wx === startW) ctx.moveTo(cam.sx(wx), yy);
      else ctx.lineTo(cam.sx(wx), yy);
    }
    ctx.stroke();
    // Grass tufts.
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const tf of this.tufts) {
      if (!cam.visible(tf.x, 40)) continue;
      const x = cam.sx(tf.x), y = cam.sy(tf.z * DEPTH + 6);
      const s = cam.zoom * 3.2;
      ctx.moveTo(x - s, y - s * 1.4); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.4, y - s * 1.8);
      if (tf.k > 0) { ctx.moveTo(x + s * 0.8, y); ctx.lineTo(x + s * 1.6, y - s * 1.2); }
    }
    ctx.stroke();
  }

  drawWell(ctx, cam, w, pal, t) {
    if (!cam.visible(w.x, 80)) return;
    const big = w.team === -1;
    const x = cam.sx(w.x), y = cam.sy(-4);
    const s = cam.zoom * (big ? 1.5 : 1);
    ctx.fillStyle = '#1b2240';
    ctx.beginPath();
    splatPath(ctx, x, y + 2 * s, 30 * s, w.id * 17 + 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.ellipse(x - 8 * s, y - 2 * s, 7 * s, 2.2 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tipped ink bottle.
    ctx.save();
    ctx.translate(x + 20 * s, y - 6 * s);
    ctx.rotate(-1.1);
    ctx.fillStyle = (pal && pal.light) || '#c8d4f5';
    ctx.strokeStyle = '#1b2240';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, -9 * s, -11 * s, 18 * s, 20 * s, 4 * s);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-4 * s, -16 * s, 8 * s, 5 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Bubbling.
    const b = (t * 1.3 + w.id * 0.37) % 1;
    ctx.strokeStyle = 'rgba(27,34,64,.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - 6 * s, y - 4 * s - b * 14 * s, (1 - b) * 3 * s + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawFort(ctx, cam, f, pal, t, style) {
    if (!cam.visible(f.x, 200)) return;
    const fn = FORT_DRAW[style] || FORT_DRAW.castle;
    fn(ctx, cam, f, pal, t, this);
  }

  drawFlag(ctx, cam, x, pal, t, solid) {
    const sx = cam.sx(x), sy = cam.sy(-DEPTH - 6), z = cam.zoom;
    ctx.globalAlpha = solid ? 1 : 0.35;
    ctx.strokeStyle = '#1b2240';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 70 * z);
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    const w = Math.sin(t * 6) * 3 * z;
    ctx.moveTo(sx, sy - 70 * z);
    ctx.quadraticCurveTo(sx + 16 * z, sy - 74 * z + w, sx + 34 * z, sy - 64 * z + w);
    ctx.quadraticCurveTo(sx + 16 * z, sy - 56 * z - w, sx, sy - 50 * z);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- default castle
FORT_DRAW.castle = (ctx, cam, f, pal, t) => {
  const z = cam.zoom;
  const dir = f.team === 0 ? 1 : -1;
  const x = cam.sx(f.x), y = cam.sy(f.z * DEPTH);
  const hpPct = f.maxHp > 0 ? f.hp / f.maxHp : 0;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const W = 124 * z, H = 118 * z;
  const left = x - W / 2;
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.paper;
  ctx.lineWidth = 3;
  if (!f.alive) {
    // Rubble.
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.moveTo(left - 10 * z, y);
    ctx.lineTo(left + 10 * z, y - 30 * z);
    ctx.lineTo(left + 40 * z, y - 18 * z);
    ctx.lineTo(left + 62 * z, y - 44 * z);
    ctx.lineTo(left + 90 * z, y - 20 * z);
    ctx.lineTo(left + W + 10 * z, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  // Tower on the home side.
  const tw = 46 * z, th = 196 * z;
  const tx = dir > 0 ? left - 6 * z : left + W - tw + 6 * z;
  ctx.beginPath();
  ctx.rect(tx, y - th, tw, th);
  ctx.fill();
  ctx.stroke();
  crenels(ctx, tx, y - th, tw, 9 * z);
  // Wall.
  ctx.beginPath();
  ctx.rect(left, y - H, W, H);
  ctx.fill();
  ctx.stroke();
  crenels(ctx, left, y - H, W, 10 * z);
  // Door.
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  const dx = x + dir * 14 * z;
  ctx.moveTo(dx - 16 * z, y);
  ctx.lineTo(dx - 16 * z, y - 34 * z);
  ctx.arc(dx, y - 34 * z, 16 * z, Math.PI, 0);
  ctx.lineTo(dx + 16 * z, y);
  ctx.closePath();
  ctx.fill();
  // Windows.
  ctx.beginPath();
  ctx.rect(tx + tw / 2 - 5 * z, y - th + 40 * z, 10 * z, 18 * z);
  ctx.rect(tx + tw / 2 - 5 * z, y - th + 86 * z, 10 * z, 18 * z);
  ctx.fill();
  // Flag.
  const fx = tx + tw / 2, fy = y - th - 9 * z;
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 46 * z);
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  const wv = Math.sin(t * 5 + f.team) * 4 * z;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 46 * z);
  ctx.quadraticCurveTo(fx + dir * 18 * z, fy - 50 * z + wv, fx + dir * 38 * z, fy - 40 * z + wv);
  ctx.quadraticCurveTo(fx + dir * 18 * z, fy - 32 * z - wv, fx, fy - 26 * z);
  ctx.closePath();
  ctx.fill();
  // Damage cracks.
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  if (hpPct < 0.7) {
    ctx.beginPath();
    ctx.moveTo(left + 20 * z, y - H + 12 * z); ctx.lineTo(left + 32 * z, y - H + 36 * z); ctx.lineTo(left + 24 * z, y - H + 54 * z);
    ctx.stroke();
  }
  if (hpPct < 0.4) {
    ctx.beginPath();
    ctx.moveTo(left + W - 26 * z, y - H + 8 * z); ctx.lineTo(left + W - 40 * z, y - H + 40 * z); ctx.lineTo(left + W - 30 * z, y - H + 70 * z);
    ctx.moveTo(tx + 8 * z, y - th + 20 * z); ctx.lineTo(tx + 20 * z, y - th + 60 * z);
    ctx.stroke();
  }
};

function crenels(ctx, x, y, w, s) {
  const n = Math.max(3, Math.round(w / (s * 2)));
  const step = w / n;
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) ctx.rect(x + i * step, y - s, step, s);
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------- basic doodles
DOODLE_DRAW.cloud = (ctx, x, y, s, col, seed, f) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  ctx.quadraticCurveTo(x - 44 * s, y - 18 * s, x - 22 * s, y - 16 * s);
  ctx.quadraticCurveTo(x - 14 * s, y - 34 * s, x + 4 * s, y - 22 * s);
  ctx.quadraticCurveTo(x + 22 * s, y - 34 * s, x + 30 * s, y - 14 * s);
  ctx.quadraticCurveTo(x + 48 * s, y - 12 * s, x + 40 * s, y);
  ctx.closePath();
  ctx.stroke();
};
DOODLE_DRAW.sun = (ctx, x, y, s, col, seed, f) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  inkCircle(ctx, x, y, 22 * s, seed, f, 1);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + f * 0.05;
    ctx.moveTo(x + Math.cos(a) * 30 * s, y + Math.sin(a) * 30 * s);
    ctx.lineTo(x + Math.cos(a) * 42 * s, y + Math.sin(a) * 42 * s);
  }
  ctx.stroke();
};
DOODLE_DRAW.moon = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0.6, Math.PI * 2 - 0.6);
  ctx.quadraticCurveTo(x + 2 * s, y, x + Math.cos(0.6) * 22 * s, y + Math.sin(0.6) * 22 * s);
  ctx.stroke();
};
DOODLE_DRAW.hill = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 120 * s, y);
  ctx.quadraticCurveTo(x - 40 * s, y - 70 * s, x + 30 * s, y - 40 * s);
  ctx.quadraticCurveTo(x + 80 * s, y - 70 * s, x + 140 * s, y);
  ctx.stroke();
};
DOODLE_DRAW.mountain = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 110 * s, y);
  ctx.lineTo(x - 30 * s, y - 120 * s);
  ctx.lineTo(x + 10 * s, y - 70 * s);
  ctx.lineTo(x + 50 * s, y - 100 * s);
  ctx.lineTo(x + 120 * s, y);
  ctx.moveTo(x - 46 * s, y - 92 * s); ctx.lineTo(x - 30 * s, y - 84 * s); ctx.lineTo(x - 16 * s, y - 96 * s);
  ctx.stroke();
};
DOODLE_DRAW.tree = (ctx, x, y, s, col, seed, f) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - 40 * s);
  ctx.stroke();
  ctx.beginPath();
  inkCircle(ctx, x, y - 58 * s, 20 * s, seed, f, 1.5, 10);
  ctx.stroke();
};
DOODLE_DRAW.bird = (ctx, x, y, s, col, seed, f) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  const fl = f % 2 ? 4 : 0;
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - fl * s); ctx.quadraticCurveTo(x - 4 * s, y - 6 * s, x, y);
  ctx.quadraticCurveTo(x + 4 * s, y - 6 * s, x + 9 * s, y - fl * s);
  ctx.stroke();
};
DOODLE_DRAW.star = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const px = x + Math.cos(a) * 12 * s, py = y + Math.sin(a) * 12 * s;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
};
DOODLE_DRAW.axis = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 50 * s, y + 30 * s); ctx.lineTo(x + 50 * s, y + 30 * s);
  ctx.moveTo(x - 50 * s, y + 30 * s); ctx.lineTo(x - 50 * s, y - 50 * s);
  ctx.moveTo(x - 50 * s, y + 20 * s);
  ctx.quadraticCurveTo(x - 10 * s, y + 10 * s, x + 10 * s, y - 20 * s);
  ctx.quadraticCurveTo(x + 25 * s, y - 40 * s, x + 45 * s, y - 44 * s);
  ctx.stroke();
};
DOODLE_DRAW.equation = (ctx, x, y, s, col) => {
  ctx.fillStyle = col;
  ctx.font = `${Math.round(22 * s)}px 'Patrick Hand', cursive`;
  ctx.fillText('a² + b² = c²', x - 50 * s, y);
};
DOODLE_DRAW.scribble = (ctx, x, y, s, col) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  for (let i = 0; i < 9; i++) ctx.lineTo(x - 40 * s + i * 10 * s, y + (i % 2 ? -14 : 8) * s);
  ctx.stroke();
};

export function clampWorld(x, w) { return clamp(x, 0, w); }
