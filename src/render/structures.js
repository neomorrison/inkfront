// Structures without their own package art: the Professor's Detention wall.
import { BODIES } from './renderer.js';
import { boilFrame, wob } from './ink.js';
import { clamp, hash1 } from '../core/util.js';

// A chalk-drawn brick wall with a DETENTION sign. Cracks spread as it loses health.
BODIES.chalk_wall = (ctx, u, o) => {
  const s = o.s;
  const hpK = clamp(u.hp / u.maxHp, 0, 1);
  const pop = o.sketch == null ? 1 : clamp(o.sketch, 0, 1);
  const f = boilFrame(o.t);
  const W = 52, H = 120, rows = 8, bh = H / rows;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(0, 1, W * 0.65, 5, 0, 0, Math.PI * 2); ctx.fill();
  const shown = Math.ceil(rows * pop);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = 2.2;
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let r = 0; r < shown; r++) {
    const y = -(r + 1) * bh;
    const off = r % 2 ? bh * 0.9 : 0;
    ctx.fillRect(-W / 2, y, W, bh);
    ctx.beginPath();
    ctx.moveTo(-W / 2 + wob(u.id, r, f, 0.8), y + wob(u.id, r + 30, f, 0.6));
    ctx.lineTo(W / 2 + wob(u.id, r + 60, f, 0.8), y + wob(u.id, r + 90, f, 0.6));
    for (let x = -W / 2 + off + 18; x < W / 2 - 4; x += 18) {
      ctx.moveTo(x + wob(u.id, x | 0, f, 0.7), y);
      ctx.lineTo(x + wob(u.id, (x | 0) + 7, f, 0.7), y + bh);
    }
    ctx.stroke();
  }
  if (shown >= rows) {
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0); ctx.lineTo(-W / 2, -H);
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, -H);
    ctx.stroke();
    // Sign.
    ctx.save();
    ctx.translate(0, -H - 14);
    ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(46,74,61,.85)';
    ctx.fillRect(-36, -11, 72, 22);
    ctx.strokeRect(-36, -11, 72, 22);
    ctx.fillStyle = o.col;
    ctx.font = "15px 'Permanent Marker', cursive";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DETENTION', 0, 1);
    ctx.restore();
  }
  // Cracks.
  const cracks = Math.floor((1 - hpK) * 6);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < cracks; i++) {
    const cx = (hash1(u.id * 7 + i) - 0.5) * W * 0.8, cy = -hash1(u.id * 13 + i) * H * 0.9 - 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 6, cy + 9);
    ctx.lineTo(cx + 2, cy + 16);
    ctx.lineTo(cx + 9, cy + 24);
    ctx.stroke();
  }
  ctx.restore();
};
