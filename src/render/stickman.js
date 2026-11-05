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

// Extra animations other packages can add: ANIMS[name] = (u, t, base) -> pose angles,
// or -> { pose, planted: false, lift } . Selected by look.anim.
export const ANIMS = {};

// Accessories listed in look.extras (cape, glasses, scarf...): EXTRAS_DRAW[name] = { back?(ctx, J, o), front?(ctx, J, o) }
export const EXTRAS_DRAW = {};

const BASES = {};
// Base pose per attack style (cached: callers must copy before mutating, see computePose).
export function basePose(style) {
  return BASES[style] || (BASES[style] = { ...IDLE, ...(HOLD[style] || HOLD.slash) });
}

// Blend keyframes over a base pose. `out` lets hot paths reuse one object.
export function keyframes(frames, p, base, out = {}) {
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1][0]) i++;
  const [p0, f0] = frames[i];
  const [p1, f1] = frames[i + 1];
  const t = smooth(clamp((p - p0) / Math.max(1e-4, p1 - p0), 0, 1));
  for (let n = 0; n < KEYS.length; n++) {
    const k = KEYS[n];
    out[k] = lerp(f0[k] ?? base[k], f1[k] ?? base[k], t);
  }
  return out;
}

export function walkPose(base, phase, amp = 0.5, holdsWeapon = true, out = {}) {
  const s = Math.sin(phase), c = Math.cos(phase);
  for (let n = 0; n < KEYS.length; n++) out[KEYS[n]] = base[KEYS[n]];
  const p = out;
  p.tF = amp * s;
  p.tB = -amp * s;
  p.sF = -0.15 - 0.95 * Math.max(0, c);
  p.sB = -0.15 - 0.95 * Math.max(0, -c);
  p.uF = base.uF - (holdsWeapon ? 0.15 : 0.35) * s;
  p.uB = base.uB + 0.32 * s;
  p.lean = base.lean + 0.08 + amp * 0.12;
  return p;
}

// Forward kinematics. Writes joints into `out` as reused [x, y] pairs.
function put(out, k, x, y) {
  const p = out[k] || (out[k] = [0, 0]);
  p[0] = x;
  p[1] = y;
}

export function fk(a, out = {}) {
  const B = BODY;
  const hx = 0, hy = a.hipY;
  const lean = a.lean;
  const nx = hx + Math.sin(lean) * B.torso, ny = hy - Math.cos(lean) * B.torso;
  const hd = lean + a.head;
  put(out, 'hip', hx, hy);
  put(out, 'neck', nx, ny);
  put(out, 'head', nx + Math.sin(hd) * (B.neck + B.headR), ny - Math.cos(hd) * (B.neck + B.headR));
  out.headTilt = hd;
  const sx = hx + Math.sin(lean) * (B.torso - 2.5), sy = hy - Math.cos(lean) * (B.torso - 2.5);
  put(out, 'sh', sx, sy);
  limb(out, 'kF', 'fF', hx, hy, a.tF, a.sF, B.thigh, B.shin);
  limb(out, 'kB', 'fB', hx, hy, a.tB, a.sB, B.thigh, B.shin);
  limb(out, 'eF', 'hF', sx, sy, a.uF + lean, a.lF, B.upper, B.fore);
  limb(out, 'eB', 'hB', sx, sy, a.uB + lean, a.lB, B.upper, B.fore);
  return out;
}

function limb(out, j1, j2, x0, y0, a1, a2, l1, l2) {
  const kx = x0 + Math.sin(a1) * l1, ky = y0 + Math.cos(a1) * l1;
  put(out, j1, kx, ky);
  put(out, j2, kx + Math.sin(a1 + a2) * l2, ky + Math.cos(a1 + a2) * l2);
}

const JOINTS = ['hip', 'neck', 'head', 'sh', 'kF', 'fF', 'kB', 'fB', 'eF', 'hF', 'eB', 'hB'];

// Shift the pose so the lowest foot touches y = 0.
export function plant(j) {
  const low = Math.max(j.fF[1], j.fB[1]);
  for (const k of JOINTS) j[k][1] -= low;
  return j;
}

// Scratch objects reused every call (single-threaded; callers consume the result immediately).
const sBase = {}, sPose = {}, sLegs = {}, sJ = {};
const sRes = { j: sJ, lift: 0, dx: 0, planted: true };
const LUNGE = { slash: 2.6, thrust: 3.6, bash: 3, slam: 3, punch: 3.4 };

// Pick the pose for a sim unit. Returns { j (joints), lift (extra y offset), dx (local forward shove), planted }.
export function computePose(u, time) {
  const look = u.def.look || {};
  const style = u.anim.style || look.style || 'slash';
  const bp = basePose(style);
  const base = sBase;
  for (let n = 0; n < KEYS.length; n++) base[KEYS[n]] = bp[KEYS[n]];
  const t = u.anim.t;
  const sway = Math.sin(t * 2.4 + u.id);
  base.lean += sway * 0.015;
  base.uF += sway * 0.03;
  base.hipY += sway * 0.45; // breathing
  // Hurt posture: hunched and drooping when low on health.
  const hpPct = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  const hurt = u.isBoss ? 0 : clamp((0.34 - hpPct) / 0.34, 0, 1);
  if (hurt > 0) {
    base.lean += 0.11 * hurt;
    base.head += 0.2 * hurt;
    base.hipY += 1.6 * hurt;
    base.uF -= 0.18 * hurt;
  }
  let p = base;
  let planted = true;
  let lift = 0;
  let dx = 0;
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
    const legs = u.anim.moving ? walkPose(base, u.anim.walk / 8.5, fast ? 0.7 : 0.5, true, sLegs) : base;
    p = keyframes(ATTACKS[style] || ATTACKS.slash, u.anim.atk, legs, sPose);
    const lg = LUNGE[style];
    if (lg) dx = lg * Math.sin(Math.PI * clamp((u.anim.atk - 0.28) / 0.5, 0, 1));
  } else if (u.anim.moving) {
    p = walkPose(base, u.anim.walk / (fast ? 10 : 8.5), fast ? 0.72 : 0.5, true, sPose);
    if (fast) { p.lean += 0.12; p.uF = 0.9 - 0.6 * Math.sin(u.anim.walk / 10); p.lF = 1.5; }
    // Tired legs drag when hurt.
    if (hurt > 0) { p.sF -= 0.12 * hurt; p.lean += 0.05 * hurt; }
  }
  if (u.type === 'scribe' && u.data.carry > 0 && u.data.phase !== 'gather') {
    p = { ...p, uF: 2.9, lF: 0.35, uB: 2.85, lB: 0.4 };
  }
  if (u.mod && u.mod.stun) {
    p = { ...p, head: 0.25 * Math.sin(t * 8), lean: 0.15 * Math.sin(t * 5) };
  }
  fk(p, sJ);
  if (planted) plant(sJ);
  sRes.lift = lift;
  sRes.dx = dx;
  sRes.planted = planted;
  sRes.hurt = hurt;
  return sRes;
}

// Joint scratch for drawing (reused every call: weapons and hats read it but must not keep it).
const tmp = {};
for (const k of JOINTS) tmp[k] = [0, 0];

// Draw a figure. o: { x, y, s (px per local unit), facing, col, back, paper, under, lw, seed, frame,
//   eyes ('dot'|'angry'|'x'|'none'), sketch (0..1 or null), squash, flash (0..1 hit pulse), flashCol, hurt (0..1),
//   dx (local forward shove), look, unit, hat, gear, t, boil }
export function drawStick(ctx, j, o) {
  const fl = o.flash || 0;
  const sq = (o.squash || 0) + fl * 0.1;
  ctx.save();
  // Recoil: a hit pushes the figure back a touch (local -x).
  ctx.translate(o.x, o.y);
  ctx.scale(o.facing * o.s * (1 + sq * 0.55), o.s * (1 - sq));
  if (fl > 0 || o.dx) ctx.translate((o.dx || 0) - fl * 2.4, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const amp = o.boil ?? 0.5;
  const J = tmp;
  let n = 0;
  const seed = o.seed, frame = o.frame;
  for (let i = 0; i < JOINTS.length; i++) {
    const k = JOINTS[i];
    const p = j[k], d = J[k];
    d[0] = p[0] + (amp ? wob(seed, n, frame, amp) : 0);
    d[1] = p[1] + (amp ? wob(seed, n + 20, frame, amp) : 0);
    n++;
  }
  J.headTilt = j.headTilt;
  const sk = o.sketch == null ? 1 : clamp(o.sketch, 0, 1);
  const col = fl > 0.02 && o.flashCol ? o.flashCol : o.col;
  const lw = o.lw * (1 + 0.2 * fl);
  const weapon = WEAPONS[(o.look && o.look.weapon) || 'none'];
  const oc = o.col;
  if (col !== oc) o.col = col; // weapons draw with the pulse colour too
  o.lwDraw = lw;

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

  const extras = (o.look && o.look.extras) || null;
  if (extras && sk >= 1) for (const ex of extras) EXTRAS_DRAW[ex]?.back?.(ctx, J, o);
  // Back limbs (one stroke, a bit thinner and lighter: they are farther away).
  const backCol = fl > 0.02 && o.flashCol ? o.flashCol : o.back;
  if (sk >= 1) {
    ctx.strokeStyle = backCol;
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    poly(ctx, [J.hip, J.kB, J.fB]);
    poly(ctx, [J.sh, J.eB, J.hB]);
    ctx.stroke();
  } else {
    strokeSk(ctx, [J.hip, J.kB, J.fB], backCol, lw * 0.9, sk, 0.0);
    strokeSk(ctx, [J.sh, J.eB, J.hB], backCol, lw * 0.9, sk, 0.15);
  }
  if (weapon && weapon.back && sk > 0.8) weapon.back(ctx, J, o);
  // Torso and front leg, with a firmer line on the torso (pen pressure).
  if (sk >= 1) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.96;
    ctx.beginPath();
    poly(ctx, [J.fF, J.kF, J.hip, J.neck]);
    ctx.stroke();
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    poly(ctx, [J.hip, J.neck]);
    ctx.stroke();
  } else strokeSk(ctx, [J.fF, J.kF, J.hip, J.neck], col, lw, sk, 0.05);
  // Head.
  drawHead(ctx, J, o, sk, col, lw);
  const hat = o.hat && HAT_DRAW[o.hat];
  if (hat && sk > 0.6) hat(ctx, J.head[0], J.head[1], J.headTilt, o);
  if (weapon && weapon.mid && sk > 0.8) weapon.mid(ctx, J, o);
  // Front arm on top.
  if (sk >= 1) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.98;
    ctx.beginPath();
    poly(ctx, [J.sh, J.eF, J.hF]);
    ctx.stroke();
  } else strokeSk(ctx, [J.sh, J.eF, J.hF], col, lw, sk, 0.3);
  if (weapon && weapon.front && sk > 0.8) weapon.front(ctx, J, o);
  if (extras && sk >= 1) for (const ex of extras) EXTRAS_DRAW[ex]?.front?.(ctx, J, o);
  if (sk < 1) drawPencil(ctx, J, sk);
  o.col = oc;
  ctx.restore();
}

// The pencil that draws a figure in: its tip rides the stroke currently being drawn.
function drawPencil(ctx, J, sk) {
  let tx, ty;
  if (sk < 0.5) {
    const a = -Math.PI / 2 + Math.PI * 2 * (sk / 0.5);
    const r = BODY.headR;
    tx = J.head[0] + Math.cos(a) * r; ty = J.head[1] + Math.sin(a) * r;
  } else {
    // Torso and front leg: fF -> kF -> hip -> neck, then the front arm.
    const pts = sk < 0.72 ? [J.fF, J.kF, J.hip, J.neck] : [J.sh, J.eF, J.hF];
    const local = sk < 0.72 ? clamp((sk - 0.05) / 0.55, 0, 1) : clamp((sk - 0.3) / 0.55, 0, 1);
    const L = polyLen(pts);
    let d = L * local;
    tx = pts[pts.length - 1][0]; ty = pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= seg) { const k = seg ? d / seg : 0; tx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k; ty = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k; break; }
      d -= seg;
    }
  }
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(0.9);
  ctx.fillStyle = '#f2c230';
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(4, -1.8, 16, 3.6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1d4a8';
  ctx.beginPath(); ctx.moveTo(4, -1.8); ctx.lineTo(0, 0); ctx.lineTo(4, 1.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b2240';
  ctx.beginPath(); ctx.moveTo(1.6, -0.7); ctx.lineTo(0, 0); ctx.lineTo(1.6, 0.7); ctx.fill();
  ctx.fillStyle = '#f3a2b4';
  ctx.fillRect(20, -1.8, 3, 3.6);
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

function drawHead(ctx, J, o, sk, col, lw) {
  const [hx, hy] = J.head;
  const r = BODY.headR * ((o.look && o.look.head) || 1);
  ctx.lineWidth = lw * 0.97;
  ctx.strokeStyle = col;
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
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  const k = r / 8;
  const ex = hx + 2.2 * k, ey = hy - 1.2 * k;
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
  // Eyes sit on the facing side so the direction reads at a glance.
  ctx.beginPath();
  ctx.arc(ex, ey, 1.3, 0, Math.PI * 2);
  ctx.arc(ex + 3.6, ey - 0.2, 1.3, 0, Math.PI * 2);
  ctx.fill();
  if (eyes === 'angry') {
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ex - 1.6, ey - 3.6); ctx.lineTo(ex + 1.2, ey - 2.2);
    ctx.moveTo(ex + 5.2, ey - 3.8); ctx.lineTo(ex + 2.4, ey - 2.4);
    ctx.stroke();
  }
  const hurt = o.hurt || 0;
  if (hurt > 0.15) {
    // Wobbly frown and a sweat drop.
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ex - 0.5, ey + 5.2); ctx.quadraticCurveTo(ex + 2, ey + 3.6, ex + 4.6, ey + 5.2);
    ctx.stroke();
    ctx.fillStyle = '#6fb6ff';
    ctx.beginPath();
    ctx.ellipse(hx - 5 * k, hy - 2.5 * k + (o.t * 6 % 3), 1.1, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
