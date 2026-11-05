// OWNER: AI/levels/modes builder (package C): AREA_DRAW for modifier zones (coffee stains) and endless/daily visuals.
import { AREA_DRAW } from './renderer.js';
import { boilFrame, inkLine } from './ink.js';
import { hash2 } from '../core/util.js';

// Flat, lumpy puddle outline (an ellipse with wobbling lobes), squashed to sit on the ground.
function blob(ctx, x, y, rx, ry, seed, lobes = 9) {
  const n = lobes * 3;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.84 + hash2(seed, i % n) * 0.28 + Math.sin(a * 3 + seed) * 0.05;
    const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Coffee stain: a brown puddle with a darker ring, a few drips and gentle shimmer.
AREA_DRAW.coffee_stain = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 40)) return;
    const x = cam.sx(a.x), y = cam.sy(2), z = cam.zoom;
    const rx = a.radius * z, ry = a.radius * 0.26 * z;
    const fr = boilFrame(t);
    ctx.save();
    ctx.fillStyle = 'rgba(112,72,38,.42)';
    ctx.beginPath();
    blob(ctx, x, y, rx, ry, a.seed);
    ctx.fill();
    // Splashes around the edge.
    for (let i = 0; i < 4; i++) {
      const ang = hash2(a.seed, i + 60) * 6.28;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(ang) * rx * 1.08, y + Math.sin(ang) * ry * 1.25, (4 + hash2(a.seed, i + 70) * 6) * z, (2 + hash2(a.seed, i + 80) * 2.5) * z, 0, 0, 6.28);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(150,98,52,.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark ring where the coffee dried.
    ctx.strokeStyle = 'rgba(78,46,22,.75)';
    ctx.lineWidth = Math.max(1.5, 2.4 * z);
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Speckles and a shine so it reads as wet.
    ctx.fillStyle = 'rgba(70,40,18,.55)';
    for (let i = 0; i < 7; i++) {
      const ang = hash2(a.seed, i) * 6.28;
      const rr = (0.3 + hash2(a.seed, i + 20) * 0.7) * rx * 0.9;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.28, (1.5 + hash2(a.seed, i + 40) * 2.5) * z, 0, 6.28);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,240,215,.55)';
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    const sh = Math.sin(t * 1.6 + a.seed) * 4 * z;
    inkLine(ctx, x - rx * 0.4 + sh, y - ry * 0.35, x - rx * 0.12 + sh, y - ry * 0.42, a.seed, fr, 0.4);
    ctx.stroke();
    // Steam curls for a fresh, hot cup.
    ctx.strokeStyle = 'rgba(120,90,60,.35)';
    ctx.lineWidth = 2 * z;
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.5 + i * 0.5 + a.seed * 0.13) % 1;
      const sx = x + (i ? 24 : -26) * z;
      ctx.globalAlpha = 0.5 * (1 - ph);
      ctx.beginPath();
      ctx.moveTo(sx, y - ph * 30 * z);
      ctx.quadraticCurveTo(sx + 7 * z * Math.sin(ph * 6), y - ph * 30 * z - 8 * z, sx, y - ph * 30 * z - 16 * z);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// Storm Caller perk: a jagged bolt from the top of the page.
AREA_DRAW.storm_bolt = {
  over(ctx, cam, a, b, t) {
    const k = 1 - a.t / a.dur;
    if (k <= 0 || !cam.visible(a.x, 100)) return;
    const x = cam.sx(a.x), y0 = cam.sy(a.y ?? -20);
    const top = cam.sy(-560);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2);
    for (const [w, col] of [[9, 'rgba(255,240,120,.5)'], [4, '#fffbe0'], [1.8, '#e2b800']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * cam.zoom * 0.7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let px = x, py = top;
      ctx.moveTo(px, py);
      const n = 8;
      for (let i = 1; i <= n; i++) {
        px = x + (i === n ? 0 : (hash2(a.seed, i) - 0.5) * 46 * cam.zoom);
        py = top + ((y0 - top) * i) / n;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  },
};
