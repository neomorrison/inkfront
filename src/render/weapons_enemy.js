// OWNER: factions/bosses builder (package B)
// Enemy faction weapons (WEAPONS) and projectile sprites (PROJ_DRAW), plus the Dustborn animation.
// Weapon signature: (ctx, J, o) in the figure's local space, facing right, y negative is up.
import { WEAPONS, dirOf, rot, line } from './weapons.js';
import { PROJ_DRAW } from './renderer.js';
import { ANIMS, ATTACKS, keyframes, walkPose } from './stickman.js';
import { DEPTH } from './camera.js';
import { clamp, lerp } from '../core/util.js';

const NEON = '#d9ff3a';
const WOOD = '#f0d4a0';

// A bar along direction d from hand point (hx, hy): s0..s1 along, half width w. Fill + outline.
function bar(ctx, hx, hy, d, s0, s1, w, fill, stroke, lw) {
  const nx = -d[1], ny = d[0];
  ctx.beginPath();
  ctx.moveTo(hx + d[0] * s0 + nx * w, hy + d[1] * s0 + ny * w);
  ctx.lineTo(hx + d[0] * s1 + nx * w, hy + d[1] * s1 + ny * w);
  ctx.lineTo(hx + d[0] * s1 - nx * w, hy + d[1] * s1 - ny * w);
  ctx.lineTo(hx + d[0] * s0 - nx * w, hy + d[1] * s0 - ny * w);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function cone(ctx, hx, hy, d, s0, s1, w, fill, stroke, lw) {
  const nx = -d[1], ny = d[0];
  ctx.beginPath();
  ctx.moveTo(hx + d[0] * s0 + nx * w, hy + d[1] * s0 + ny * w);
  ctx.lineTo(hx + d[0] * s1, hy + d[1] * s1);
  ctx.lineTo(hx + d[0] * s0 - nx * w, hy + d[1] * s0 - ny * w);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

const throwing = (o) => !!(o.unit && o.unit.attacking && o.unit.anim.atk > 0.5);

// ---------------------------------------------------------------- graphite
WEAPONS.pencil_blade = {
  front(ctx, J, o) {
    const d = rot(dirOf(J.eF, J.hF), -0.6);
    const [hx, hy] = J.hF;
    const lw = o.lw * 0.5;
    bar(ctx, hx, hy, d, -7, 15, 2.8, '#f2c230', o.col, lw);
    ctx.strokeStyle = 'rgba(120,80,0,.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    line(ctx, hx + d[0] * -6 - d[1] * 0.4, hy + d[1] * -6 + d[0] * 0.4, hx + d[0] * 14 - d[1] * 0.4, hy + d[1] * 14 + d[0] * 0.4);
    ctx.stroke();
    cone(ctx, hx, hy, d, 15, 29, 2.8, WOOD, o.col, lw);
    cone(ctx, hx, hy, d, 24.5, 29, 1.15, '#3b3b44', null, 0);
    bar(ctx, hx, hy, d, -11, -7, 2.8, '#ff8fa3', o.col, lw);
    bar(ctx, hx, hy, d, -7.6, -6.6, 2.8, '#c8ccd4', null, 0);
  },
};

WEAPONS.lead_dart = {
  front(ctx, J, o) {
    if (throwing(o)) return;
    const d = rot(dirOf(J.eF, J.hF), -0.15);
    const [hx, hy] = J.hF;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.45;
    ctx.beginPath();
    line(ctx, hx - d[0] * 3, hy - d[1] * 3, hx + d[0] * 13, hy + d[1] * 13);
    ctx.stroke();
    cone(ctx, hx, hy, d, 12, 19, 1.6, '#3b3b44', o.col, 0.6);
    ctx.beginPath();
    line(ctx, hx - d[0] * 3, hy - d[1] * 3, hx - d[0] * 6 - d[1] * 2.5, hy - d[1] * 6 + d[0] * 2.5);
    line(ctx, hx - d[0] * 3, hy - d[1] * 3, hx - d[0] * 6 + d[1] * 2.5, hy - d[1] * 6 - d[0] * 2.5);
    ctx.stroke();
  },
};

// ---------------------------------------------------------------- neon
WEAPONS.glowstick = {
  front(ctx, J, o) {
    const d = rot(dirOf(J.eF, J.hF), -0.55);
    const [hx, hy] = J.hF;
    const pulse = 0.35 + 0.15 * Math.sin(o.t * 6 + (o.seed || 0));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(190,255,50,${pulse})`;
    ctx.lineWidth = o.lw * 3.6;
    ctx.beginPath();
    line(ctx, hx, hy, hx + d[0] * 21, hy + d[1] * 21);
    ctx.stroke();
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 1.5;
    ctx.beginPath();
    line(ctx, hx - d[0] * 2, hy - d[1] * 2, hx + d[0] * 22, hy + d[1] * 22);
    ctx.stroke();
    ctx.strokeStyle = NEON;
    ctx.lineWidth = o.lw * 0.8;
    ctx.beginPath();
    line(ctx, hx, hy, hx + d[0] * 20, hy + d[1] * 20);
    ctx.stroke();
  },
};

function shieldPath(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 17);
  ctx.quadraticCurveTo(x + 9, y - 17, x + 9, y - 5);
  ctx.quadraticCurveTo(x + 9, y + 11, x + 1, y + 17);
  ctx.quadraticCurveTo(x - 6, y + 10, x - 5, y - 5);
  ctx.closePath();
}

WEAPONS.marker_shield = {
  mid(ctx, J, o) {
    const [x, y] = J.hB;
    shieldPath(ctx, x, y);
    ctx.fillStyle = o.light || o.paper;
    ctx.fill();
    ctx.save();
    shieldPath(ctx, x, y);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,236,40,.8)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    line(ctx, x - 8, y - 12, x + 12, y + 6);
    line(ctx, x - 8, y - 2, x + 12, y + 16);
    ctx.stroke();
    ctx.restore();
    shieldPath(ctx, x, y);
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.9;
    ctx.stroke();
  },
  front(ctx, J, o) {
    // A fat marker used as a club.
    const d = rot(dirOf(J.eF, J.hF), -0.7);
    const [hx, hy] = J.hF;
    bar(ctx, hx, hy, d, -3, 13, 3.4, o.light || o.paper, o.col, o.lw * 0.6);
    bar(ctx, hx, hy, d, 13, 18, 2.4, o.col, o.col, 0.5);
    bar(ctx, hx, hy, d, 5, 8, 3.5, 'rgba(255,236,40,.9)', null, 0);
  },
};

WEAPONS.staff = {
  front(ctx, J, o) {
    const u = o.unit;
    const [hx, hy] = J.hF;
    const casting = u && u.attacking;
    const d = casting ? rot(dirOf(J.eF, J.hF), -0.35) : [0.16, -0.987];
    const len = 36;
    const tx = hx + d[0] * len, ty = hy + d[1] * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    line(ctx, hx - d[0] * 14, hy - d[1] * 14, tx, ty);
    ctx.stroke();
    const f = u && u.def.faction;
    if (f === 'chalk') {
      // Dust mage: a swirling cloud of chalk on the tip.
      ctx.fillStyle = 'rgba(245,245,235,.9)';
      for (let i = 0; i < 5; i++) {
        const a = o.t * 3 + i * 1.26;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(a) * 4.5, ty + Math.sin(a) * 3.2, 1.9 + (i % 2), 0, 6.3);
        ctx.fill();
      }
      ctx.strokeStyle = o.col;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(tx, ty, 6.5, 0, 6.3);
      ctx.stroke();
    } else {
      const pulse = 0.3 + 0.15 * Math.sin(o.t * 5);
      ctx.fillStyle = `rgba(255,236,40,${pulse})`;
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#fff35a';
      ctx.strokeStyle = o.col;
      ctx.lineWidth = o.lw * 0.6;
      ctx.beginPath();
      ctx.arc(tx, ty, 4.6, 0, 6.3);
      ctx.fill();
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- chalk
WEAPONS.chalk = {
  front(ctx, J, o) {
    const u = o.unit;
    const thrower = u && u.def.look && u.def.look.style === 'throw';
    if (thrower && throwing(o)) return;
    const d = rot(dirOf(J.eF, J.hF), thrower ? -0.2 : -0.6);
    const [hx, hy] = J.hF;
    const len = thrower ? 9 : 19;
    bar(ctx, hx, hy, d, -2, len, 2.5, '#ffffff', o.col, o.lw * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    if (!thrower && u && u.attacking && u.anim.atk > 0.4 && u.anim.atk < 0.8) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(hx + d[0] * (len + 3 + i * 4) + Math.sin(o.t * 30 + i) * 2, hy + d[1] * (len + 3 + i * 4) + 2 + i, 1.5, 0, 6.3);
        ctx.fill();
      }
    }
  },
};

WEAPONS.board = {
  front(ctx, J, o) {
    // Board eraser: wooden back, felt face, a puff of dust when it swings.
    const d = rot(dirOf(J.eF, J.hF), -0.15);
    const [hx, hy] = J.hF;
    const nx = -d[1], ny = d[0];
    bar(ctx, hx, hy, d, 2, 26, 6.5, '#b88652', o.col, o.lw * 0.6);
    bar(ctx, hx, hy, d, 2, 26, 3.2, null, null, 0);
    // felt strip on the far side
    ctx.beginPath();
    ctx.moveTo(hx + d[0] * 2 + nx * 6.5, hy + d[1] * 2 + ny * 6.5);
    ctx.lineTo(hx + d[0] * 26 + nx * 6.5, hy + d[1] * 26 + ny * 6.5);
    ctx.lineTo(hx + d[0] * 26 + nx * 10, hy + d[1] * 26 + ny * 10);
    ctx.lineTo(hx + d[0] * 2 + nx * 10, hy + d[1] * 2 + ny * 10);
    ctx.closePath();
    ctx.fillStyle = '#9ca3a3';
    ctx.fill();
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) line(ctx, hx + d[0] * (6 + i * 7) + nx * 7, hy + d[1] * (6 + i * 7) + ny * 7, hx + d[0] * (8 + i * 7) + nx * 9, hy + d[1] * (8 + i * 7) + ny * 9);
    ctx.stroke();
  },
};

// ---------------------------------------------------------------- eraser
WEAPONS.eraser_shield = {
  mid(ctx, J, o) {
    const [x, y] = J.hB;
    // A pink eraser block with a blue cardboard sleeve.
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - 6, y - 17, 15, 34, 4) : ctx.rect(x - 6, y - 17, 15, 34);
    ctx.fillStyle = '#f7a9bb';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#4d6fd1';
    ctx.fillRect(x - 6, y - 5, 15, 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 6, y - 1.5, 15, 1.6);
    ctx.fillRect(x - 6, y + 4, 15, 1.6);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - 6, y - 17, 15, 34, 4) : ctx.rect(x - 6, y - 17, 15, 34);
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.9;
    ctx.stroke();
  },
  front(ctx, J, o) {
    // Worn corner of a second eraser as a fist guard.
    const [x, y] = J.hF;
    ctx.fillStyle = '#f7a9bb';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, 6.3);
    ctx.fill();
    ctx.stroke();
  },
};

WEAPONS.whiteout = {
  front(ctx, J, o) {
    const [x, y] = J.hF;
    const u = o.unit;
    // bottle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.55;
    ctx.beginPath();
    ctx.rect(x - 3.2, y - 8, 6.4, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4d6fd1';
    ctx.fillRect(x - 3.2, y - 5, 6.4, 4);
    ctx.fillStyle = o.col;
    ctx.fillRect(x - 1.8, y - 11.5, 3.6, 3.5);
    if (u && u.attacking) {
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.strokeStyle = o.col;
      ctx.lineWidth = 0.7;
      const k = u.anim.atk;
      ctx.beginPath();
      ctx.arc(x + 5 + k * 10, y - 10 - Math.sin(k * 3.14) * 6, 2.6, 0, 6.3);
      ctx.fill();
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- bosses
WEAPONS.red_lance = {
  front(ctx, J, o) {
    // A giant red pen held like a lance.
    const d = rot(dirOf(J.eF, J.hF), -0.12);
    const [hx, hy] = J.hF;
    const lw = o.lw * 0.45;
    bar(ctx, hx, hy, d, -16, -9, 2.7, '#2b2b36', o.col, lw);
    bar(ctx, hx, hy, d, -9, 40, 3.3, '#d3342c', o.col, lw);
    bar(ctx, hx, hy, d, 12, 16, 3.35, '#f6b0aa', null, 0);
    cone(ctx, hx, hy, d, 40, 54, 3.3, '#8d1c16', o.col, lw);
    cone(ctx, hx, hy, d, 49, 57, 1.3, '#2b2b36', null, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    line(ctx, hx + d[0] * -6 - d[1] * 1.6, hy + d[1] * -6 + d[0] * 1.6, hx + d[0] * 36 - d[1] * 1.6, hy + d[1] * 36 + d[0] * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

WEAPONS.pointer = {
  front(ctx, J, o) {
    const d = rot(dirOf(J.eF, J.hF), -0.55);
    const [hx, hy] = J.hF;
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.55;
    ctx.beginPath();
    line(ctx, hx - d[0] * 6, hy - d[1] * 6, hx + d[0] * 52, hy + d[1] * 52);
    ctx.stroke();
    ctx.lineWidth = o.lw * 0.9;
    ctx.beginPath();
    line(ctx, hx - d[0] * 6, hy - d[1] * 6, hx + d[0] * 6, hy + d[1] * 6);
    ctx.stroke();
    // tiny pointing hand at the tip
    const tx = hx + d[0] * 52, ty = hy + d[1] * 52;
    ctx.fillStyle = o.paper;
    ctx.lineWidth = o.lw * 0.45;
    ctx.beginPath();
    ctx.arc(tx + d[0] * 2, ty + d[1] * 2, 2.6, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    line(ctx, tx + d[0] * 3, ty + d[1] * 3, tx + d[0] * 9, ty + d[1] * 9);
    ctx.stroke();
  },
};

// ---------------------------------------------------------------- projectiles
const trail = (ctx, x, y, a, len, col, w) => {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
  ctx.lineTo(x, y);
  ctx.stroke();
};

PROJ_DRAW.lead = (ctx, cam, p, pal) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  const a = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.8 * z;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-15 * z, 0);
  ctx.lineTo(1 * z, 0);
  ctx.stroke();
  ctx.fillStyle = '#2f2f37';
  ctx.beginPath();
  ctx.moveTo(8 * z, 0);
  ctx.lineTo(0, -2.4 * z);
  ctx.lineTo(0, 2.4 * z);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1 * z;
  ctx.beginPath();
  ctx.moveTo(-15 * z, 0); ctx.lineTo(-18 * z, -3 * z);
  ctx.moveTo(-15 * z, 0); ctx.lineTo(-18 * z, 3 * z);
  ctx.stroke();
  ctx.restore();
};

PROJ_DRAW.chalk = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  const a = Math.atan2(p.vy, p.vx);
  trail(ctx, x, y, a, 14 * z, 'rgba(255,255,255,.35)', 3.2 * z);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 14 + p.x * 0.05);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.1 * z;
  ctx.beginPath();
  ctx.rect(-4.5 * z, -2.2 * z, 9 * z, 4.4 * z);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

PROJ_DRAW.shaving = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.strokeStyle = '#d9a95c';
  ctx.lineWidth = 2.2 * z;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const k = i / 18;
    const a = k * Math.PI * 5 + t * 18;
    const px = -k * 18 * z + Math.cos(a) * 2 * z;
    const py = Math.sin(a) * 5.5 * z * (1 - k * 0.3);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 0.9 * z;
  ctx.stroke();
  ctx.restore();
};

PROJ_DRAW.neon_arrow = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  const a = Math.atan2(p.vy, p.vx);
  trail(ctx, x, y, a, 22 * z, 'rgba(255,236,40,.35)', 6 * z);
  trail(ctx, x, y, a, 16 * z, pal.ink, 2 * z);
  ctx.fillStyle = 'rgba(255,236,40,.5)';
  ctx.beginPath();
  ctx.arc(x, y, (6 + Math.sin(t * 30) * 1) * z, 0, 6.3);
  ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * 5 * z, y + Math.sin(a) * 5 * z);
  ctx.lineTo(x + Math.cos(a + 2.5) * 4.5 * z, y + Math.sin(a + 2.5) * 4.5 * z);
  ctx.lineTo(x + Math.cos(a - 2.5) * 4.5 * z, y + Math.sin(a - 2.5) * 4.5 * z);
  ctx.fill();
};

const SYMS = ['x²', 'π', '∑', '√', '÷'];
PROJ_DRAW.chalk_eq = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  const a = Math.atan2(p.vy, p.vx);
  trail(ctx, x, y, a, 34 * z, 'rgba(255,255,255,.28)', 5 * z);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 8 + p.x) * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.4 * z;
  ctx.beginPath();
  ctx.arc(0, 0, 11 * z, 0, 6.3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#34503f';
  ctx.font = `${Math.round(13 * z)}px 'Permanent Marker', cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SYMS[(p.sym || 0) % SYMS.length], 0, 1 * z);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
};

// ---------------------------------------------------------------- Dustborn: pile and reform
// Defined here (not in stickman.js) so the pile pose and the walk/attack share one place.
const PILE = { hipY: -4, lean: 1.5, head: 0.2, tF: 1.4, sF: 0.15, tB: -1.35, sB: -0.2, uF: 1.9, lF: 0.2, uB: -1.7, lB: 0.1 };
ANIMS.dustborn = (u, t, base) => {
  if (u.data.downed) {
    const k = clamp(1 - u.data.downT / 0.8, 0, 1);
    const wob = Math.sin(t * 40) * 0.05 * k * 3;
    const pile = {};
    for (const key in base) pile[key] = lerp(PILE[key] ?? base[key], base[key], k * k) + (typeof base[key] === 'number' && k > 0.3 ? wob : 0);
    // jumble the sticks a little per unit so every pile is different
    const j = ((u.id * 37) % 11) / 11 - 0.5;
    pile.uB += j * 0.6 * (1 - k);
    pile.tB += j * 0.5 * (1 - k);
    return { pose: pile, planted: true };
  }
  const style = u.anim.style || 'slash';
  if (u.airborne) {
    return { pose: { ...base, lean: -0.5 + 0.1 * Math.sin(t * 9), tF: 0.7, sF: -0.9, tB: -0.4, sB: -0.7, uF: 2.4, lF: 0.6, uB: 2.7, lB: 0.5, head: -0.2 }, planted: false };
  }
  if (u.state === 'cheer') {
    return { ...base, uF: 2.9, lF: 0.3, uB: 2.8, lB: 0.3, lean: 0 };
  }
  const legs = u.anim.moving ? walkPose(base, u.anim.walk / 8.5, 0.5) : base;
  if (u.attacking) return keyframes(ATTACKS[style] || ATTACKS.slash, u.anim.atk, legs);
  // a loose, crumbly shamble
  return u.anim.moving ? { ...legs, lean: legs.lean + 0.06 * Math.sin(t * 5 + u.id) } : legs;
};
