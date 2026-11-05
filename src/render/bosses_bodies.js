// OWNER: factions/bosses builder (package B)
// BODIES.wyrm (the Neon Wyrm) and BODIES.hand (the Hand): the two bosses that are not stick figures.
import { BODIES } from './renderer.js';
import { DEPTH } from './camera.js';
import { clamp, lerp, TAU } from '../core/util.js';
import { wob } from './ink.js';

function ell(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
}

// ================================================================= the Neon Wyrm
function ink(o, flash) {
  return { line: o.col, fill: flash ? '#ffffff' : (o.light || o.paper), under: o.under || 'rgba(255,236,40,.5)' };
}

function wingPts(rootX, rootY, flap, fold, scale) {
  const L = [92, 80, 62];
  const base = [-2.45, -1.95, -1.45];
  const tips = [];
  for (let i = 0; i < 3; i++) {
    const ang = lerp(base[i] + flap * (0.55 + i * 0.12), -3.0 + i * 0.12, fold);
    const len = L[i] * lerp(1, 0.4, fold) * scale;
    tips.push([rootX + Math.cos(ang) * len, rootY + Math.sin(ang) * len]);
  }
  return tips;
}

function drawWing(ctx, rootX, rootY, tips, c, lw, alpha) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(rootX, rootY);
  ctx.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) {
    const [px, py] = tips[i - 1], [qx, qy] = tips[i];
    ctx.quadraticCurveTo((px + qx) / 2 + (rootX - qx) * 0.12, (py + qy) / 2 + (rootY - qy) * -0.04 + 8, qx, qy);
  }
  ctx.quadraticCurveTo((tips[2][0] + rootX) / 2, (tips[2][1] + rootY) / 2 + 16, rootX, rootY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,214,235,.78)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,40,.3)';
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (const [x, y] of tips) { ctx.moveTo(rootX, rootY); ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

BODIES.wyrm = (ctx, u, o, r) => {
  const cam = r.cam;
  const s = o.s;
  const d = u.data;
  const t = o.t;
  const k = 1 - clamp((d.alt || 0) / 190, 0, 1); // 1 = on the ground
  const mouth = d.mouth || 0;
  const flash = u.anim.flash > 0;
  const c = ink(o, flash);
  const lw = 3.2;
  const dead = u.state === 'dead';

  // shadow on the page
  const groundY = cam.sy(u.z * DEPTH);
  ctx.fillStyle = `rgba(40,36,60,${0.1 + 0.14 * k})`;
  ell(ctx, o.x - o.facing * 50 * s, groundY + 3 * s, (120 - (1 - k) * 25) * s, 12 * s);
  ctx.fill();

  ctx.save();
  if (o.sketch != null && o.sketch < 1) ctx.globalAlpha = clamp(o.sketch, 0.05, 1);
  ctx.translate(o.x, o.y);
  ctx.scale(o.facing * s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // attack lunge: pull back, then jab the head forward
  let lunge = 0;
  if (u.attacking) {
    const p = u.anim.atk;
    lunge = p < 0.45 ? -14 * (p / 0.45) : p < 0.55 ? lerp(-14, 38, (p - 0.45) / 0.1) : lerp(38, 0, (p - 0.55) / 0.45);
  }

  const N = 12;
  const P = [];
  for (let i = 0; i < N; i++) {
    const neck = i < 4 ? 4 - i : 0;
    let x = 62 - i * 23 + (i < 4 ? lunge * (1 - i / 4) : 0) + Math.sin(t * 1.3 - i * 0.7) * i * 1.3 * k;
    const fly = -56 + Math.sin(t * 3.1 - i * 0.62) * (7 + i * 1.5) - neck * 7;
    const gnd = -20 - neck * 14 + Math.sin(t * 1.1 - i * 0.5) * 1.6;
    P.push({ x, y: lerp(fly, gnd, k), w: Math.max(3.4, 15 - i * 0.98) });
  }

  // far wing and legs go behind the body
  const flap = k > 0.9 ? Math.sin(t * 2) * 0.1 : Math.sin(t * 7.5);
  const fold = clamp(k * 1.2, 0, 1);
  const sh = P[3];
  const farTips = wingPts(sh.x - 8, sh.y - 6, flap * 0.9 - 0.2, fold, 0.92);
  drawWing(ctx, sh.x - 8, sh.y - 6, farTips, { line: c.line }, lw * 0.8, 0.8);
  if (k > 0.15) {
    ctx.strokeStyle = c.line;
    ctx.lineWidth = lw;
    for (const li of [3, 7]) {
      const q = P[li];
      const kn = q.x - 8, ky = (q.y + 0) * 0.5 - 4;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y + q.w * 0.4);
      ctx.lineTo(kn - 6, ky + 8);
      ctx.lineTo(q.x + 10 * k, -1);
      ctx.lineTo(q.x + 18 * k, -1);
      ctx.stroke();
    }
  }

  // highlighter underlay, outline pass, fill pass
  ctx.strokeStyle = c.under;
  for (let i = 0; i < N - 1; i++) {
    ctx.lineWidth = P[i].w * 2 + 20;
    ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[i + 1].x, P[i + 1].y); ctx.stroke();
  }
  ctx.strokeStyle = c.line;
  for (let i = 0; i < N - 1; i++) {
    ctx.lineWidth = P[i].w * 2 + lw * 2;
    ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[i + 1].x, P[i + 1].y); ctx.stroke();
  }
  ctx.strokeStyle = c.fill;
  for (let i = 0; i < N - 1; i++) {
    ctx.lineWidth = P[i].w * 2;
    ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[i + 1].x, P[i + 1].y); ctx.stroke();
  }
  // belly band and back spikes
  for (let i = 1; i < N - 1; i++) {
    const a = P[i], b2 = P[i + 1];
    const dx = b2.x - a.x, dy = b2.y - a.y, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // normal; flip so it points up
    const up = ny > 0 ? -1 : 1;
    ctx.strokeStyle = 'rgba(255,236,40,.85)';
    ctx.lineWidth = a.w * 0.7;
    ctx.beginPath();
    ctx.moveTo(a.x - nx * up * a.w * 0.55, a.y - ny * up * a.w * 0.55);
    ctx.lineTo(b2.x - nx * up * b2.w * 0.55, b2.y - ny * up * b2.w * 0.55);
    ctx.stroke();
    ctx.fillStyle = c.line;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * up * a.w - dx * 0.2, a.y + ny * up * a.w - dy * 0.2);
    ctx.lineTo(a.x + nx * up * (a.w + 8 + (i % 2) * 2) + dx * 0.15, a.y + ny * up * (a.w + 8 + (i % 2) * 2) + dy * 0.15);
    ctx.lineTo(a.x + nx * up * a.w + dx * 0.55, a.y + ny * up * a.w + dy * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  // marker-nib tail tip
  const tp = P[N - 1], tq = P[N - 2];
  const ta = Math.atan2(tp.y - tq.y, tp.x - tq.x);
  ctx.save();
  ctx.translate(tp.x, tp.y);
  ctx.rotate(ta);
  ctx.fillStyle = '#ffec28';
  ctx.strokeStyle = c.line;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-2, -7); ctx.lineTo(14, -4); ctx.lineTo(20, 5); ctx.lineTo(-2, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // near wing
  const nearTips = wingPts(sh.x, sh.y - 8, flap, fold, 1);
  drawWing(ctx, sh.x, sh.y - 8, nearTips, { line: c.line }, lw, 0.95);

  // head
  const hd = P[0], nk = P[1];
  const ah = clamp(Math.atan2(hd.y - nk.y, hd.x - nk.x) * 0.7, -0.5, 0.5);
  ctx.save();
  ctx.translate(hd.x + 4, hd.y - 2);
  ctx.rotate(ah);
  const jaw = mouth * 0.62 + (u.attacking ? 0.25 : 0);
  // lower jaw (behind skull)
  ctx.save();
  ctx.translate(2, 6);
  ctx.rotate(jaw);
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(38, -2); ctx.lineTo(42, 4); ctx.lineTo(32, 8); ctx.lineTo(0, 9);
  ctx.closePath();
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(8 + i * 8, -3); ctx.lineTo(11 + i * 8, -9); ctx.lineTo(14 + i * 8, -3); ctx.fill(); }
  ctx.restore();
  if (mouth > 0.4) {
    ctx.fillStyle = `rgba(255,150,30,${0.5 + 0.4 * Math.sin(t * 30)})`;
    ctx.beginPath();
    ctx.arc(36, 4, 6 + mouth * 5, 0, TAU);
    ctx.fill();
  }
  // skull and upper snout
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-12, -20, 8, -17);
  ctx.lineTo(36, -9); ctx.lineTo(48, -2); ctx.lineTo(40, 3); ctx.lineTo(4, 6);
  ctx.quadraticCurveTo(-12, 12, -14, -2);
  ctx.closePath();
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,236,40,.75)';
  ctx.beginPath(); ctx.ellipse(18, -9, 11, 3.4, 0.2, 0, TAU); ctx.fill();
  // teeth
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(14 + i * 8, 5 - i * 0.4); ctx.lineTo(17 + i * 8, 11); ctx.lineTo(20 + i * 8, 4 - i * 0.4); ctx.fill(); ctx.stroke(); }
  // horns
  ctx.fillStyle = c.line;
  ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-26, -30); ctx.lineTo(-12, -9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, -17); ctx.lineTo(-12, -36); ctx.lineTo(8, -14); ctx.fill();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(10, -8, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.line;
  ctx.beginPath(); ctx.arc(11.5, -7.6, 2.2, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(4, -15); ctx.lineTo(16, -10); ctx.stroke();
  ctx.beginPath(); ctx.arc(40, -5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = 1;
  if (dead) return;
};

// ================================================================= the Hand
const HAND_INK = '#26233a';
const SKIN = '#fff1e4';
const SKIN_SHADE = '#f0cdb8';
const SLEEVE = '#4f5379';

function pencil(ctx, x, yTip, len, flash) {
  // vertical pencil, tip at (x, yTip), barrel going up
  const hw = 10;
  ctx.fillStyle = '#f0d4a0';
  ctx.beginPath();
  ctx.moveTo(x, yTip); ctx.lineTo(x - hw, yTip - 30); ctx.lineTo(x + hw, yTip - 30); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2f2f37';
  ctx.beginPath();
  ctx.moveTo(x, yTip); ctx.lineTo(x - 3.4, yTip - 10); ctx.lineTo(x + 3.4, yTip - 10); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = flash ? '#fff' : '#f2c230';
  ctx.beginPath();
  ctx.rect(x - hw, yTip - 30 - len, hw * 2, len);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,100,0,.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 3, yTip - 30); ctx.lineTo(x - 3, yTip - 30 - len);
  ctx.moveTo(x + 4, yTip - 30); ctx.lineTo(x + 4, yTip - 30 - len);
  ctx.stroke();
  ctx.strokeStyle = HAND_INK;
  ctx.lineWidth = 3.2;
  // ferrule + eraser
  ctx.fillStyle = '#c8ccd4';
  ctx.beginPath(); ctx.rect(x - hw, yTip - 30 - len - 14, hw * 2, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff8fa3';
  ctx.beginPath(); ctx.rect(x - hw + 1, yTip - 30 - len - 30, hw * 2 - 2, 16); ctx.fill(); ctx.stroke();
}

function eraserBlock(ctx, x, yTip, flash) {
  const w = 76, h = 50;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w, yTip - h, w * 2, h, 9) : ctx.rect(x - w, yTip - h, w * 2, h);
  ctx.fillStyle = flash ? '#fff' : '#f7a9bb';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#4d6fd1';
  ctx.fillRect(x - w, yTip - h * 0.78, w * 2, h * 0.5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w, yTip - h * 0.6, w * 2, 3);
  ctx.fillRect(x - w, yTip - h * 0.34, w * 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(x - w, yTip - 8, w * 2, 8);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w, yTip - h, w * 2, h, 9) : ctx.rect(x - w, yTip - h, w * 2, h);
  ctx.stroke();
}

function fist(ctx, bottom, press, flash, o) {
  const top = bottom - 104;
  const sq = 1 - 0.07 * press;
  ctx.save();
  ctx.translate(0, bottom);
  ctx.scale(1, sq);
  ctx.translate(0, -bottom);
  // back of the hand and wrist
  ctx.beginPath();
  ctx.moveTo(-60, bottom - 14);
  ctx.quadraticCurveTo(-72, top + 30, -50, top + 4);
  ctx.lineTo(-40, top - 36);
  ctx.lineTo(40, top - 36);
  ctx.lineTo(50, top + 4);
  ctx.quadraticCurveTo(72, top + 30, 60, bottom - 14);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : SKIN;
  ctx.fill();
  ctx.stroke();
  // four curled fingers
  for (let i = 0; i < 4; i++) {
    const fx = -48 + i * 32;
    const fy = bottom - 54 + (i === 1 || i === 2 ? -3 : 3);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(fx - 15, fy, 30, 54 + (i === 1 ? 0 : -4), 13) : ctx.rect(fx - 15, fy, 30, 52);
    ctx.fillStyle = flash ? '#fff' : SKIN;
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy + 20); ctx.quadraticCurveTo(fx, fy + 25, fx + 8, fy + 20);
    ctx.stroke();
    ctx.lineWidth = 3.2;
  }
  // thumb wrapped across the front
  ctx.beginPath();
  ctx.ellipse(-52, bottom - 56, 15, 30, -0.5, 0, TAU);
  ctx.fillStyle = flash ? '#fff' : SKIN_SHADE;
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-60, bottom - 74); ctx.lineTo(-52, bottom - 78);
  ctx.stroke();
  ctx.lineWidth = 3.2;
  // knuckle dimples
  ctx.fillStyle = 'rgba(180,120,100,.35)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-48 + i * 32, top + 16, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
  return top - 36;
}

BODIES.hand = (ctx, u, o, r) => {
  const cam = r.cam;
  const s = o.s;
  const d = u.data;
  const t = o.t;
  const press = d.press || 0;
  const tool = d.tool || 'pencil';
  const flash = u.anim.flash > 0;
  const seed = u.id;
  const J = (i) => wob(seed, i, o.frame, 0.9);

  // shadow of the hand on the page: it grows and fades as the hand rises
  const groundY = cam.sy(u.z * DEPTH);
  const lift = 1 - press;
  ctx.fillStyle = `rgba(40,36,60,${0.1 + 0.22 * press})`;
  ell(ctx, o.x, groundY + 4 * s, (62 + lift * 55) * s, (9 + lift * 7) * s);
  ctx.fill();
  if (lift > 0.1) {
    ctx.fillStyle = `rgba(40,36,60,${0.06 * lift})`;
    ell(ctx, o.x, groundY + 4 * s, (110 + lift * 90) * s, (16 + lift * 10) * s);
    ctx.fill();
  }

  ctx.save();
  if (o.sketch != null && o.sketch < 1) ctx.globalAlpha = clamp(o.sketch, 0.05, 1);
  const bob = press < 0.3 ? Math.sin(t * 2.2) * 5 : 0;
  const tilt = clamp((d.driftV || 0) / 900, -0.12, 0.12) + Math.sin(t * 1.3) * 0.018 * lift;
  ctx.translate(o.x, o.y + bob * s);
  ctx.scale(s, s);
  ctx.rotate(tilt);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = HAND_INK;
  ctx.lineWidth = 3.4;

  let fistBottom;
  if (tool === 'eraser') {
    eraserBlock(ctx, J(1), 0, flash);
    fistBottom = -46;
  } else {
    pencil(ctx, J(2), 0 + press * 4, 110, flash);
    fistBottom = -66;
  }
  const wristTop = fist(ctx, fistBottom + J(3) * 0.5, press, flash, o);

  // cuff and sleeve running off the top of the screen
  const topLocal = -(o.y / s) - 80;
  const cuffTop = wristTop - 30;
  ctx.beginPath();
  ctx.moveTo(-46, wristTop + 2); ctx.lineTo(-62, cuffTop); ctx.lineTo(62, cuffTop); ctx.lineTo(46, wristTop + 2);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : '#fffdf4';
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-54, wristTop - 10); ctx.lineTo(54, wristTop - 10);
  ctx.moveTo(-58, wristTop - 20); ctx.lineTo(58, wristTop - 20);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-62, cuffTop + 2);
  ctx.lineTo(-92, topLocal);
  ctx.lineTo(92, topLocal);
  ctx.lineTo(62, cuffTop + 2);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : SLEEVE;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let y = cuffTop - 8; y > topLocal; y -= 14) { ctx.moveTo(-100, y + 26); ctx.lineTo(100, y - 14); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-24, cuffTop); ctx.lineTo(-40, topLocal);
  ctx.moveTo(30, cuffTop); ctx.lineTo(52, topLocal);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = HAND_INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-62, cuffTop + 2); ctx.lineTo(-92, topLocal);
  ctx.moveTo(62, cuffTop + 2); ctx.lineTo(92, topLocal);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
};

