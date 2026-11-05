// OWNER: units builder (package A): WEAPONS for bomb, satchel, quill, club, katana, lance.
// Also a few headgear fallbacks (goggles, nurse, wizard, headband) that the hats package replaces
// when it ships its own versions.
import { WEAPONS, dirOf, rot, line } from './weapons.js';
import { HAT_DRAW } from './hats.js';

const TAU = Math.PI * 2;
const RED = '#e23b34';
const SPARK = '#ffd23f';

function spark(ctx, x, y, r, t) {
  ctx.fillStyle = SPARK;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.4 : r * (1 + 0.25 * Math.sin(t * 38 + i));
    const a = (i / 8) * TAU + t * 9;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff8a1c';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- bomb
// Round bomb with a lit, sparking fuse. Flashes faster while the fuse is committed.
WEAPONS.bomb = {
  front(ctx, J, o) {
    const u = o.unit;
    const hot = !!(u && u.attacking);
    const [hx, hy] = J.hF;
    const r = 6.4 + (hot ? 0.8 * Math.sin(o.t * 50) : 0);
    const cx = hx + 1.5, cy = hy - r + 2.5;
    const flash = hot && Math.sin(o.t * 46) > 0.2;
    ctx.fillStyle = flash ? '#fff7e0' : (o.dark || '#1b2240');
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // shine
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    // cap and fuse
    ctx.fillStyle = o.col;
    ctx.fillRect(cx - 2, cy - r - 2, 4, 3);
    const wig = Math.sin(o.t * 12) * 1.2;
    const fx = cx + 6 + wig, fy = cy - r - 8;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 2);
    ctx.quadraticCurveTo(cx + 1, cy - r - 8, fx, fy);
    ctx.stroke();
    spark(ctx, fx, fy, hot ? 4.6 : 3.2, o.t);
    // flying sparks
    ctx.fillStyle = SPARK;
    for (let i = 0; i < 3; i++) {
      const a = o.t * 7 + i * 2.1;
      const d = 3 + ((o.t * 14 + i * 3.7) % 6);
      ctx.fillRect(fx + Math.cos(a) * d - 0.6, fy + Math.sin(a) * d - 0.6, 1.3, 1.3);
    }
  },
};

// ---------------------------------------------------------------- satchel (medic bag)
WEAPONS.satchel = {
  mid(ctx, J, o) {
    const [hx, hy] = J.hip;
    const [sx, sy] = J.sh;
    const bx = hx - 8, by = hy + 2;
    // strap
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy + 1);
    ctx.lineTo(bx + 2, by - 5);
    ctx.stroke();
    // bag
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.75;
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - 5);
    ctx.lineTo(bx + 7, by - 5);
    ctx.lineTo(bx + 7.5, by + 6);
    ctx.lineTo(bx - 7.5, by + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 7, by - 1);
    ctx.lineTo(bx + 7.2, by - 1);
    ctx.stroke();
    // cross
    ctx.fillStyle = RED;
    ctx.fillRect(bx - 1.3, by - 4.2, 2.6, 8.6);
    ctx.fillRect(bx - 4.2, by - 1.3, 8.4, 2.6);
  },
  front(ctx, J, o) {
    const u = o.unit;
    const casting = u && (u.attacking || (u.anim && u.anim.cast > 0.1));
    if (!casting) return;
    // rising plus signs around the raised hand
    ctx.strokeStyle = '#3ec46d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const k = (o.t * 1.6 + i / 3) % 1;
      const x = J.hF[0] + 6 + Math.sin(i * 2.3 + o.t * 3) * 5;
      const y = J.hF[1] - 3 - k * 16;
      const s = 2.2 * (1 - k * 0.5);
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    }
    ctx.stroke();
  },
};

// ---------------------------------------------------------------- quill
// Big feather quill held point-up. The vane glows while the Doodler casts.
WEAPONS.quill = {
  front(ctx, J, o) {
    const u = o.unit;
    const casting = !!(u && (u.attacking || (u.anim && u.anim.cast > 0.1)));
    const base = dirOf(J.eF, J.hF);
    const d = rot(base, -0.9);
    const [hx, hy] = J.hF;
    const len = 36;
    const tx = hx + d[0] * len, ty = hy + d[1] * len;
    const nx = -d[1], ny = d[0];
    const bend = Math.sin(o.t * 2.4) * 1.2;
    if (casting) {
      const k = u.attacking ? Math.min(1, u.anim.atk * 2 + 0.3) : 0.5;
      const g = ctx.createRadialGradient(hx + d[0] * 24, hy + d[1] * 24, 1, hx + d[0] * 24, hy + d[1] * 24, 24);
      g.addColorStop(0, `rgba(255,255,255,${0.75 * k})`);
      g.addColorStop(0.35, (o.light || '#a9bdf5'));
      g.addColorStop(1, 'rgba(169,189,245,0)');
      ctx.globalAlpha = 0.65 * k;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx + d[0] * 24, hy + d[1] * 24, 24, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // shaft
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(hx - d[0] * 5, hy - d[1] * 5);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // vane (leaf shape) on the upper two thirds
    const s0 = 0.28, s1 = 1.0;
    const ax = hx + d[0] * len * s0, ay = hy + d[1] * len * s0;
    ctx.fillStyle = casting ? '#ffffff' : (o.light || o.paper);
    ctx.lineWidth = o.lw * 0.65;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax + nx * 11 + d[0] * 10, ay + ny * 11 + d[1] * 10 + bend, tx, ty);
    ctx.quadraticCurveTo(ax - nx * 3 + d[0] * 12, ay - ny * 3 + d[1] * 12, ax, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // barbs
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const k = s0 + (s1 - s0) * (i / 5) * 0.9;
      const px = hx + d[0] * len * k, py = hy + d[1] * len * k;
      line(ctx, px, py, px + nx * (8 - i) + d[0] * 3, py + ny * (8 - i) + d[1] * 3);
    }
    ctx.stroke();
    // ink nib at the hand
    ctx.fillStyle = o.dark || o.col;
    ctx.beginPath();
    ctx.moveTo(hx - d[0] * 9, hy - d[1] * 9);
    ctx.lineTo(hx - d[0] * 4 + nx * 1.5, hy - d[1] * 4 + ny * 1.5);
    ctx.lineTo(hx - d[0] * 4 - nx * 1.5, hy - d[1] * 4 - ny * 1.5);
    ctx.closePath();
    ctx.fill();
    if (casting) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const a = o.t * 9 + i * 2.2;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(a) * 7, ty + Math.sin(a) * 7, 1.2, 0, TAU);
        ctx.fill();
      }
    }
  },
};

// ---------------------------------------------------------------- club (Colossus)
// A huge lumpy doodle club held in both hands. Slam style swings it over the head.
WEAPONS.club = {
  front(ctx, J, o) {
    const hx = (J.hF[0] + J.hB[0]) / 2, hy = (J.hF[1] + J.hB[1]) / 2;
    const d = rot(dirOf(J.eF, J.hF), 1.2);
    const nx = -d[1], ny = d[0];
    const L = 46;
    const P = (k, w) => [hx + d[0] * L * k + nx * w, hy + d[1] * L * k + ny * w];
    ctx.fillStyle = o.light || o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.9;
    ctx.beginPath();
    let p = P(-0.12, 2);
    ctx.moveTo(p[0], p[1]);
    p = P(0.35, 2.3); ctx.lineTo(p[0], p[1]);
    p = P(0.62, 7); ctx.quadraticCurveTo(p[0], p[1], ...P(0.82, 9.5));
    p = P(1.0, 8); ctx.quadraticCurveTo(...P(1.04, 5), p[0], p[1]);
    p = P(1.06, 0); ctx.lineTo(p[0], p[1]);
    p = P(1.0, -8); ctx.lineTo(p[0], p[1]);
    p = P(0.82, -9.5); ctx.quadraticCurveTo(...P(1.04, -5), p[0], p[1]);
    p = P(0.62, -7); ctx.quadraticCurveTo(...P(0.7, -9), p[0], p[1]);
    p = P(0.35, -2.3); ctx.lineTo(p[0], p[1]);
    p = P(-0.12, -2); ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // wood grain and knots
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const k of [0.55, 0.72, 0.9]) { const a = P(k, -3), b = P(k + 0.08, 4); line(ctx, a[0], a[1], b[0], b[1]); }
    ctx.stroke();
    // studs
    ctx.fillStyle = o.col;
    for (const [k, w] of [[0.8, 5], [0.9, -4], [0.72, -3], [0.95, 2]]) {
      const q = P(k, w);
      ctx.beginPath();
      ctx.moveTo(q[0] + nx * 0 + d[0] * 2.4, q[1] + d[1] * 2.4);
      ctx.lineTo(q[0] - nx * 1.6 - d[0] * 1.2, q[1] - ny * 1.6 - d[1] * 1.2);
      ctx.lineTo(q[0] + nx * 1.6 - d[0] * 1.2, q[1] + ny * 1.6 - d[1] * 1.2);
      ctx.closePath();
      ctx.fill();
    }
    // fists over the handle
    ctx.beginPath();
    ctx.arc(J.hF[0], J.hF[1], 2.6, 0, TAU);
    ctx.arc(J.hB[0], J.hB[1], 2.4, 0, TAU);
    ctx.fill();
  },
};

// ---------------------------------------------------------------- katana (Ninja)
WEAPONS.katana = {
  front(ctx, J, o) {
    const u = o.unit;
    const d = rot(dirOf(J.eF, J.hF), -0.5);
    const [hx, hy] = J.hF;
    const nx = -d[1], ny = d[0];
    const len = 28;
    // wrapped handle
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.9;
    ctx.beginPath();
    line(ctx, hx - d[0] * 6, hy - d[1] * 6, hx + d[0] * 2, hy + d[1] * 2);
    ctx.stroke();
    // guard
    ctx.lineWidth = o.lw * 0.8;
    ctx.beginPath();
    const gx = hx + d[0] * 3, gy = hy + d[1] * 3;
    line(ctx, gx - nx * 3.4, gy - ny * 3.4, gx + nx * 3.4, gy + ny * 3.4);
    ctx.stroke();
    // curved blade
    const slashing = u && u.attacking && u.anim.atk > 0.38 && u.anim.atk < 0.8;
    ctx.strokeStyle = '#eef3ff';
    ctx.lineWidth = o.lw * 1.15;
    ctx.beginPath();
    ctx.moveTo(gx + d[0] * 1, gy + d[1] * 1);
    ctx.quadraticCurveTo(gx + d[0] * len * 0.55 + nx * 3.2, gy + d[1] * len * 0.55 + ny * 3.2, gx + d[0] * len, gy + d[1] * len);
    ctx.stroke();
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.6;
    ctx.stroke();
    if (slashing) {
      // slash arc trail
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(gx + d[0] * len, gy + d[1] * len);
      ctx.quadraticCurveTo(gx + d[0] * len * 0.4 - d[1] * 26, gy + d[1] * len * 0.4 + d[0] * 26, gx - d[0] * 8 - nx * 12, gy - d[1] * 8 - ny * 12);
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- lance (Rider)
// Long couched lance with a pennant. Levels out when the rider is in a charge.
WEAPONS.lance = {
  front(ctx, J, o) {
    const u = o.unit;
    const charging = !!(u && u.data && u.data.charging);
    let d;
    if (u && u.attacking) d = rot(dirOf(J.eF, J.hF), -0.1);
    else if (charging) d = [Math.cos(0.04), Math.sin(0.04)];
    else d = [Math.cos(-0.5), Math.sin(-0.5)];
    const [hx, hy] = J.hF;
    const len = 58;
    const tx = hx + d[0] * len, ty = hy + d[1] * len;
    const nx = -d[1], ny = d[0];
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.85;
    ctx.beginPath();
    line(ctx, hx - d[0] * 20, hy - d[1] * 20, tx, ty);
    ctx.stroke();
    // grip guard
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    line(ctx, hx + d[0] * 6 - nx * 3.5, hy + d[1] * 6 - ny * 3.5, hx + d[0] * 6 + nx * 3.5, hy + d[1] * 6 + ny * 3.5);
    ctx.stroke();
    // head
    ctx.fillStyle = '#eef3ff';
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(tx + d[0] * 11, ty + d[1] * 11);
    ctx.lineTo(tx + nx * 3.3, ty + ny * 3.3);
    ctx.lineTo(tx - nx * 3.3, ty - ny * 3.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // pennant streaming back
    const px = hx + d[0] * (len - 10), py = hy + d[1] * (len - 10);
    const flut = (k) => Math.sin(o.t * (charging ? 22 : 9) - k * 1.6) * (charging ? 3 : 2);
    ctx.fillStyle = o.col;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - d[0] * 8 + ny * 0 + flut(1) * -nx, py - d[1] * 8 + flut(1) * -ny + 3, px - d[0] * 17 + flut(2) * -nx, py - d[1] * 17 + flut(2) * -ny + (charging ? 1 : 5));
    ctx.quadraticCurveTo(px - d[0] * 9 + flut(1.5) * -nx, py - d[1] * 9 + flut(1.5) * -ny + 6, px + nx * 0, py + ny * 0 + 6);
    ctx.closePath();
    ctx.fill();
  },
};

// ---------------------------------------------------------------- headgear fallbacks
function tilted(ctx, hx, hy, tilt, fn) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  fn();
  ctx.restore();
}

if (!HAT_DRAW.goggles) {
  HAT_DRAW.goggles = (ctx, hx, hy, tilt, o) => tilted(ctx, hx, hy, tilt, () => {
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(-8, -2); ctx.lineTo(9, -2);
    ctx.stroke();
    ctx.fillStyle = o.light || '#a9bdf5';
    for (const x of [0.5, 5.6]) {
      ctx.beginPath();
      ctx.arc(x + 2, -2, 3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  });
}
if (!HAT_DRAW.nurse) {
  HAT_DRAW.nurse = (ctx, hx, hy, tilt, o) => tilted(ctx, hx, hy, tilt, () => {
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.65;
    ctx.beginPath();
    ctx.moveTo(-7, -4); ctx.lineTo(-6, -11); ctx.lineTo(7, -11); ctx.lineTo(8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.fillRect(-1, -10, 2, 5.4);
    ctx.fillRect(-2.7, -8.3, 5.4, 2);
  });
}
if (!HAT_DRAW.wizard) {
  HAT_DRAW.wizard = (ctx, hx, hy, tilt, o) => tilted(ctx, hx, hy, tilt, () => {
    ctx.fillStyle = o.light || o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-2, -22);
    ctx.quadraticCurveTo(2, -16, 10, -4);
    ctx.quadraticCurveTo(0, -1, -10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SPARK;
    ctx.beginPath();
    ctx.arc(-1, -11, 1.6, 0, TAU);
    ctx.fill();
  });
}
if (!HAT_DRAW.headband) {
  HAT_DRAW.headband = (ctx, hx, hy, tilt, o) => tilted(ctx, hx, hy, tilt, () => {
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 1.1;
    ctx.beginPath();
    ctx.moveTo(-8.2, -2); ctx.lineTo(8.2, -2.4);
    ctx.stroke();
    ctx.lineWidth = o.lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-14, 0 + Math.sin(o.t * 8) * 2, -18, 3);
    ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-13, -4 + Math.sin(o.t * 8 + 1) * 2, -17, -3);
    ctx.stroke();
  });
}
