// Stick figure rig: angle poses -> joints (forward kinematics) -> hand-drawn strokes.
// Local space: facing right (+x), feet on y = 0, y negative is up. One unit = one world px at scale 1.
// Angle convention: 0 points straight down, +PI/2 points forward, PI points straight up.
import { smooth, lerp, clamp } from '../core/util.js';
import { wob } from './ink.js';
import { WEAPONS } from './weapons.js';
import { HAT_DRAW } from './hats.js';

export const BODY = { thigh: 14, shin: 14.5, torso: 22, upper: 12, fore: 11.5, headR: 8, neck: 2.5 };
const KEYS = ['hipY', 'lean', 'head', 'tF', 'sF', 'tB', 'sB', 'uF', 'lF', 'uB', 'lB'];

export const IDLE = { hipY: -27, lean: 0.04, head: 0, tF: 0.16, sF: -0.06, tB: -0.12, sB: -0.04, uF: 0.45, lF: 0.6, uB: 0.15, lB: 0.35 };
// Idle arm carriage per attack style (weapon held ready).
const HOLD = {
  slash: { uF: 0.55, lF: 0.7 },
  thrust: { uF: 0.75, lF: 0.95, uB: 0.6, lB: 0.9 },
  bash: { uB: 1.25, lB: 0.35, uF: 0.5, lF: 0.8 },
  bow: { uB: 0.85, lB: 0.5, uF: 0.35, lF: 0.5 },
  throw: { uF: 0.3, lF: 0.4 },
  cast: { uF: 0.55, lF: 0.95, uB: 0.2, lB: 0.4 },
  slam: { uF: 2.1, lF: 1.7, uB: 1.9, lB: 1.8, lean: 0.08 },
  punch: { uF: 0.6, lF: 1.6, uB: 0.5, lB: 1.6 },
};

// Attack keyframes: [progress, partial pose]. The hit lands at progress 0.5.
export const ATTACKS = {
  slash: [[0, {}], [0.42, { uF: 3.5, lF: 0.35, lean: -0.1, head: -0.1 }], [0.5, { uF: 1.5, lF: 0.15, lean: 0.25, tF: 0.45, sF: -0.35 }], [0.7, { uF: 0.95, lF: 0.25, lean: 0.18 }], [1, {}]],
  thrust: [[0, {}], [0.42, { uF: 0.9, lF: 1.5, lean: -0.08, uB: 0.9, lB: 0.6 }], [0.5, { uF: 1.55, lF: 0.0, lean: 0.28, uB: 1.4, lB: 0.1, tF: 0.5, sF: -0.3 }], [0.72, { uF: 1.4, lF: 0.2, lean: 0.15 }], [1, {}]],
  throw: [[0, {}], [0.25, { uF: -1.2, lF: 0.4, lean: -0.05 }], [0.45, { uF: 3.4, lF: 0.2, lean: -0.15 }], [0.5, { uF: 2.1, lF: 0.1, lean: 0.2 }], [0.65, { uF: 1.2, lF: 0.2, lean: 0.15 }], [1, {}]],
  bow: [[0, { uB: 1.55, lB: 0.02, uF: 1.45, lF: 0.2 }], [0.45, { uB: 1.6, lB: 0, uF: 1.25, lF: -2.5, lean: -0.05 }], [0.5, { uB: 1.62, lB: 0, uF: 1.3, lF: -1.2, lean: -0.08 }], [0.8, { uB: 1.55, lB: 0.02, uF: 1.4, lF: -0.4 }], [1, { uB: 1.5, lB: 0.05, uF: 1.45, lF: 0.2 }]],
  cast: [[0, {}], [0.42, { uF: 2.8, lF: 0.2, uB: 2.6, lB: 0.2, lean: -0.12, head: -0.15 }], [0.5, { uF: 1.65, lF: 0, uB: 1.5, lB: 0, lean: 0.18 }], [0.75, { uF: 1.5, lF: 0.1, uB: 1.35, lB: 0.1, lean: 0.1 }], [1, {}]],
  slam: [[0, {}], [0.42, { uF: 3.3, lF: 0.25, uB: 3.2, lB: 0.3, lean: -0.18, head: -0.1 }], [0.5, { uF: 1.2, lF: 0.1, uB: 1.1, lB: 0.1, lean: 0.4, tF: 0.55, sF: -0.5, hipY: -24 }], [0.72, { uF: 0.9, lF: 0.15, uB: 0.85, lB: 0.15, lean: 0.3, hipY: -25 }], [1, {}]],
  punch: [[0, {}], [0.4, { uF: 0.5, lF: 2.1, lean: -0.05 }], [0.5, { uF: 1.58, lF: 0.02, lean: 0.22, tF: 0.35 }], [0.7, { uF: 1.3, lF: 0.4, lean: 0.12 }], [1, {}]],
  bash: [[0, {}], [0.4, { uB: 1.0, lB: 0.6, uF: 2.6, lF: 0.6, lean: -0.08 }], [0.5, { uB: 1.5, lB: 0.1, uF: 1.4, lF: 0.2, lean: 0.3, tF: 0.45, sF: -0.3 }], [0.72, { uB: 1.35, lB: 0.25, uF: 1.1, lF: 0.3, lean: 0.15 }], [1, {}]],
};

// Extra animations other packages can add: ANIMS[name] = (u, t, base) -> pose angles
export const ANIMS = {};

export function basePose(style) {
  return { ...IDLE, ...(HOLD[style] || HOLD.slash) };
}

// Blend keyframes over a base pose.
export function keyframes(frames, p, base) {
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1][0]) i++;
  const [p0, f0] = frames[i];
  const [p1, f1] = frames[i + 1];
  const t = smooth(clamp((p - p0) / Math.max(1e-4, p1 - p0), 0, 1));
  const out = { ...base };
  for (const k of KEYS) {
    const a = f0[k] ?? base[k], b = f1[k] ?? base[k];
    out[k] = lerp(a, b, t);
  }
  return out;
}

export function walkPose(base, phase, amp = 0.5, holdsWeapon = true) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const p = { ...base };
  p.tF = amp * s;
  p.tB = -amp * s;
  p.sF = -0.15 - 0.95 * Math.max(0, c);
  p.sB = -0.15 - 0.95 * Math.max(0, -c);
  p.uF = base.uF - (holdsWeapon ? 0.15 : 0.35) * s;
  p.uB = base.uB + 0.32 * s;
  p.lean = base.lean + 0.08 + amp * 0.12;
  return p;
}

const tmp = {};
// Forward kinematics. Writes joints into `out` as [x, y] pairs.
export function fk(a, out = {}) {
  const B = BODY;
  const hx = 0, hy = a.hipY;
  const lean = a.lean;
  const nx = hx + Math.sin(lean) * B.torso, ny = hy - Math.cos(lean) * B.torso;
  const hd = lean + a.head;
  out.hip = [hx, hy];
  out.neck = [nx, ny];
  out.head = [nx + Math.sin(hd) * (B.neck + B.headR), ny - Math.cos(hd) * (B.neck + B.headR)];
  out.headTilt = hd;
  const sx = hx + Math.sin(lean) * (B.torso - 2.5), sy = hy - Math.cos(lean) * (B.torso - 2.5);
  out.sh = [sx, sy];
  limb(out, 'kF', 'fF', hx, hy, a.tF, a.sF, B.thigh, B.shin);
  limb(out, 'kB', 'fB', hx, hy, a.tB, a.sB, B.thigh, B.shin);
  limb(out, 'eF', 'hF', sx, sy, a.uF + lean, a.lF, B.upper, B.fore);
  limb(out, 'eB', 'hB', sx, sy, a.uB + lean, a.lB, B.upper, B.fore);
  return out;
}

function limb(out, j1, j2, x0, y0, a1, a2, l1, l2) {
  const kx = x0 + Math.sin(a1) * l1, ky = y0 + Math.cos(a1) * l1;
  const fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
  out[j1] = [kx, ky];
  out[j2] = [fx, fy];
}

const JOINTS = ['hip', 'neck', 'head', 'sh', 'kF', 'fF', 'kB', 'fB', 'eF', 'hF', 'eB', 'hB'];

// Shift the pose so the lowest foot touches y = 0.
export function plant(j) {
  const low = Math.max(j.fF[1], j.fB[1]);
  for (const k of JOINTS) j[k][1] -= low;
  return j;
}

// Pick the pose for a sim unit. Returns { j (joints), lift (extra y offset), plant }.
export function computePose(u, time) {
  const look = u.def.look || {};
  const style = u.anim.style || look.style || 'slash';
  const base = basePose(style);
  const t = u.anim.t;
  base.lean += Math.sin(t * 2.4 + u.id) * 0.015;
  base.uF += Math.sin(t * 2.4 + u.id) * 0.03;
  let p = base;
  let planted = true;
  let lift = 0;
  const custom = ANIMS[look.anim];
  const fast = u.def.speed > 110;
  if (custom) {
    const r = custom(u, t, base);
    p = r.pose || r;
    if (r.planted === false) planted = false;
    if (r.lift) lift = r.lift;
  } else if (u.airborne) {
    p = { ...base, lean: -0.5 + 0.1 * Math.sin(t * 9), tF: 0.7, sF: -0.9, tB: -0.4, sB: -0.7, uF: 2.4 + 0.4 * Math.sin(t * 14), lF: 0.6, uB: 2.7 + 0.4 * Math.cos(t * 13), lB: 0.5, head: -0.2 };
    planted = false;
  } else if (u.state === 'cheer') {
    const h = Math.abs(Math.sin(u.anim.cheer * 6 + u.id));
    p = { ...base, uF: 2.9 + 0.15 * Math.sin(t * 12), lF: 0.3, uB: 2.8 + 0.15 * Math.cos(t * 12), lB: 0.3, lean: 0 };
    lift = -h * 7;
  } else if (u.type === 'scribe' && u.data.phase === 'gather') {
    p = { ...base, hipY: -18, lean: 0.75, head: 0.25, tF: 1.1, sF: -2.0, tB: 0.45, sB: -1.7, uF: 0.5 + 0.25 * Math.sin(t * 7), lF: 0.3, uB: 0.4, lB: 0.4 };
  } else if (u.attacking) {
    const legs = u.anim.moving ? walkPose(base, u.anim.walk / 8.5, fast ? 0.7 : 0.5) : base;
    p = keyframes(ATTACKS[style] || ATTACKS.slash, u.anim.atk, legs);
  } else if (u.anim.moving) {
    p = walkPose(base, u.anim.walk / (fast ? 10 : 8.5), fast ? 0.72 : 0.5);
    if (fast) { p.lean += 0.12; p.uF = 0.9 - 0.6 * Math.sin(u.anim.walk / 10); p.lF = 1.5; }
  }
  if (u.type === 'scribe' && u.data.carry > 0 && u.data.phase !== 'gather') {
    p = { ...p, uF: 2.9, lF: 0.35, uB: 2.85, lB: 0.4 };
  }
  if (u.mod && u.mod.stun) {
    p = { ...p, head: 0.25 * Math.sin(t * 8), lean: 0.15 * Math.sin(t * 5) };
  }
  const j = fk(p, {});
  if (planted) plant(j);
  return { j, lift, planted };
}

// Draw a figure. o: { x, y, s (px per local unit), facing, col, back, paper, under, lw, seed, frame,
//   eyes ('dot'|'angry'|'x'|'none'), sketch (0..1 or null), squash, look, unit, hat, gear, t }
export function drawStick(ctx, j, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  const sq = o.squash || 0;
  ctx.scale(o.facing * o.s * (1 + sq * 0.5), o.s * (1 - sq));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const amp = o.boil ?? 0.5;
  const J = tmp;
  let n = 0;
  for (const k of JOINTS) {
    const p = j[k];
    J[k] = [p[0] + wob(o.seed, n, o.frame, amp), p[1] + wob(o.seed, n + 20, o.frame, amp)];
    n++;
  }
  J.headTilt = j.headTilt;
  const sk = o.sketch == null ? 1 : clamp(o.sketch, 0, 1);
  const lw = o.lw;
  const weapon = WEAPONS[(o.look && o.look.weapon) || 'none'];

  if (o.under && sk >= 1) {
    ctx.strokeStyle = o.under;
    ctx.lineWidth = lw * 3.4;
    ctx.beginPath();
    poly(ctx, [J.fB, J.kB, J.hip, J.kF, J.fF]);
    poly(ctx, [J.hip, J.neck]);
    poly(ctx, [J.hB, J.eB, J.sh, J.eF, J.hF]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(J.head[0], J.head[1], BODY.headR + lw * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = o.under;
    ctx.fill();
  }
  if (o.gilded && sk >= 1) {
    ctx.strokeStyle = 'rgba(242,176,30,.55)';
    ctx.lineWidth = lw * 2.4;
    ctx.beginPath();
    poly(ctx, [J.fB, J.kB, J.hip, J.kF, J.fF]);
    poly(ctx, [J.hip, J.neck]);
    ctx.stroke();
  }

  // Back limbs.
  strokeSk(ctx, [J.hip, J.kB, J.fB], o.back, lw, sk, 0.0);
  strokeSk(ctx, [J.sh, J.eB, J.hB], o.back, lw, sk, 0.15);
  if (weapon && weapon.back && sk > 0.8) weapon.back(ctx, J, o);
  // Torso and front leg.
  strokeSk(ctx, [J.fF, J.kF, J.hip, J.neck], o.col, lw, sk, 0.05);
  // Head.
  drawHead(ctx, J, o, sk);
  const hat = o.hat && HAT_DRAW[o.hat];
  if (hat && sk > 0.6) hat(ctx, J.head[0], J.head[1], J.headTilt, o);
  if (weapon && weapon.mid && sk > 0.8) weapon.mid(ctx, J, o);
  // Front arm on top.
  strokeSk(ctx, [J.sh, J.eF, J.hF], o.col, lw, sk, 0.3);
  if (weapon && weapon.front && sk > 0.8) weapon.front(ctx, J, o);
  ctx.restore();
}

function poly(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Stroke with optional "being drawn" reveal: sk 0..1 overall progress, start = when this part begins.
function strokeSk(ctx, pts, col, lw, sk, start) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  poly(ctx, pts);
  if (sk < 1) {
    const local = clamp((sk - start) / 0.55, 0, 1);
    if (local <= 0) return;
    const L = polyLen(pts);
    ctx.setLineDash([L * local, L + 10]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else ctx.stroke();
}

function drawHead(ctx, J, o, sk) {
  const [hx, hy] = J.head;
  const r = BODY.headR * ((o.look && o.look.head) || 1);
  ctx.lineWidth = o.lw * 0.95;
  ctx.strokeStyle = o.col;
  ctx.beginPath();
  if (sk < 1) {
    const local = clamp(sk / 0.5, 0, 1);
    ctx.arc(hx, hy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * local);
    ctx.stroke();
    return;
  }
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fillStyle = o.headFill || o.paper;
  ctx.fill();
  ctx.stroke();
  const eyes = o.eyes || 'dot';
  if (eyes === 'none') return;
  ctx.fillStyle = o.col;
  ctx.strokeStyle = o.col;
  const ex = hx + 2.2 * (r / 8), ey = hy - 1.2 * (r / 8);
  if (eyes === 'x') {
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const dx of [0, 3.6]) {
      ctx.moveTo(ex + dx - 1.3, ey - 1.3); ctx.lineTo(ex + dx + 1.3, ey + 1.3);
      ctx.moveTo(ex + dx + 1.3, ey - 1.3); ctx.lineTo(ex + dx - 1.3, ey + 1.3);
    }
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(ex, ey, 1.25, 0, Math.PI * 2);
  ctx.arc(ex + 3.6, ey - 0.2, 1.25, 0, Math.PI * 2);
  ctx.fill();
  if (eyes === 'angry') {
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ex - 1.6, ey - 3.6); ctx.lineTo(ex + 1.2, ey - 2.2);
    ctx.moveTo(ex + 5.2, ey - 3.8); ctx.lineTo(ex + 2.4, ey - 2.4);
    ctx.stroke();
  }
}
