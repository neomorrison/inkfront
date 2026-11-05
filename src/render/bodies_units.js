// OWNER: units builder (package A): BODIES.catapult and BODIES.critter, MOUNTS.horse, ANIMS.ninja and
// ANIMS.rider, AREA_DRAW for ink_pot / mini_bomb / chain_jump, and EVENT_FX for the unit mechanics
// (chain, healBeam, aura, revive, backstab, smoke, chargeHit, chargeStart, trample, bomberBlast,
// summon, catapultFire).
import { clamp, lerp, ease, TAU } from '../core/util.js';
import { UNITS } from '../data/units.js';
import { BODIES, MOUNTS, AREA_DRAW, EVENT_FX } from './renderer.js';
import { ANIMS, ATTACKS, keyframes } from './stickman.js';
import { wob } from './ink.js';

// Riders sit on the horse: give any mounted unit the straddle pose unless data says otherwise.
for (const id in UNITS) {
  const look = UNITS[id].look;
  if (look && look.mount === 'horse' && !look.anim) look.anim = 'rider';
}

// Chain extra handlers onto an event type another package may also use.
function addFx(type, fn) {
  const prev = EVENT_FX[type];
  EVENT_FX[type] = prev ? (r, e, b) => { prev(r, e, b); fn(r, e, b); } : fn;
}

const sk01 = (o) => (o.sketch == null ? 1 : clamp(o.sketch, 0, 1));

// Begin a local-space transform (facing right, ground at y=0). Returns the sketch amount.
function beginLocal(ctx, o, dx = 0, dy = 0) {
  ctx.save();
  ctx.translate(o.x, o.y);
  const sq = o.squash || 0;
  ctx.scale(o.facing * o.s * (1 + sq * 0.5), o.s * (1 - sq));
  ctx.translate(dx, dy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sk = sk01(o);
  if (sk < 1) {
    // drawn from the ground up
    ctx.beginPath();
    ctx.rect(-120, -(130 * sk) - 4, 240, 130 * sk + 10);
    ctx.clip();
  }
  return sk;
}

// ---------------------------------------------------------------- poses
// Ninja: low crouch, runs with arms swept back.
ANIMS.ninja = (u, t, base) => {
  const crouch = { ...base, lean: 0.42, head: -0.3, uF: 0.75, lF: 1.25, uB: 0.35, lB: 0.8, hipY: -21 };
  let p = crouch;
  if (u.state === 'cheer') {
    return { ...base, uF: 2.9, lF: 0.3, uB: 2.8, lB: 0.3, lean: 0 };
  }
  if (u.airborne) {
    return { pose: { ...base, lean: -0.5, tF: 0.7, sF: -0.9, tB: -0.4, sB: -0.7, uF: 2.4 + 0.4 * Math.sin(t * 14), lF: 0.6, uB: 2.7, lB: 0.5, head: -0.2 }, planted: false };
  }
  if (u.attacking) {
    const legs = u.anim.moving ? runLegs(crouch, u.anim.walk / 8) : { ...crouch, tF: 0.8, sF: -1.1, tB: -0.5, sB: -0.6 };
    p = keyframes(ATTACKS.slash, u.anim.atk, legs);
    p.lean += 0.15;
  } else if (u.anim.moving) {
    p = runLegs(crouch, u.anim.walk / 8);
    p.lean = 0.62;
    p.uF = -1.05 + 0.2 * Math.sin(u.anim.walk / 8);
    p.lF = 0.5;
    p.uB = -1.25 - 0.2 * Math.sin(u.anim.walk / 8);
    p.lB = 0.35;
    p.head = -0.45;
  } else {
    // watchful idle: breathing crouch
    p = { ...crouch, tF: 0.75, sF: -1.0, tB: -0.45, sB: -0.55, lean: 0.38 + Math.sin(t * 2 + u.id) * 0.03 };
  }
  if (u.mod && u.mod.stun) p = { ...p, head: 0.25 * Math.sin(t * 8) };
  return p;
};

function runLegs(base, ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    ...base,
    tF: 1.0 * s + 0.2, tB: -1.0 * s + 0.2,
    sF: -0.3 - 1.25 * Math.max(0, c), sB: -0.3 - 1.25 * Math.max(0, -c),
  };
}

// Rider: straddles the horse. The horse draws below; the mount seat lifts the figure onto its back.
const RIDE = { hipY: -22, lean: 0.08, head: 0, tF: 1.2, sF: -1.45, tB: 0.95, sB: -1.3 };
ANIMS.rider = (u, t, base) => {
  const charging = !!(u.data && u.data.charging);
  let p = { ...base, ...RIDE };
  if (u.state === 'cheer') {
    p = { ...p, uF: 2.9 + 0.15 * Math.sin(t * 12), lF: 0.3, uB: 2.8, lB: 0.3, lean: 0 };
  } else if (u.attacking) {
    p = keyframes(ATTACKS.thrust, u.anim.atk, p);
  } else if (u.airborne) {
    p = { ...p, lean: -0.45, uF: 2.4, lF: 0.6, uB: 2.7, lB: 0.5 };
  } else if (charging) {
    p = { ...p, lean: 0.42, head: -0.3, uF: 1.35, lF: 0.2, uB: 0.9, lB: 0.5 };
  } else if (u.anim.moving) {
    p.lean = 0.18 + 0.03 * Math.sin(u.anim.walk / 7);
    p.uF = 0.9; p.lF = 0.6;
  }
  if (u.mod && u.mod.stun) p.head = 0.25 * Math.sin(t * 8);
  return { pose: p };
};

// ---------------------------------------------------------------- horse
function leg(ctx, x0, y0, a1, a2, col, lw) {
  const kx = x0 + Math.sin(a1) * 12, ky = y0 + Math.cos(a1) * 12;
  const fx = kx + Math.sin(a1 + a2) * 11.5, fy = ky + Math.cos(a1 + a2) * 11.5;
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(fx + 0.8, fy, lw * 0.62, 0, TAU);
  ctx.fill();
}

MOUNTS.horse = {
  seat: 19,
  draw(ctx, u, o) {
    const t = o.t || 0;
    const charging = !!(u.data && u.data.charging);
    const moving = !!u.anim.moving;
    const ph = (u.anim.walk || 0) / 10.5;
    const air = !!u.airborne;
    const sk = beginLocal(ctx, o);
    ctx.scale(1.2, 1.2);
    const lw = o.lw * 0.8;
    const j = (i, a = 0.5) => wob(o.seed, i, o.frame, a);
    const idle = !moving && !air;
    const bob = moving ? -Math.abs(Math.sin(ph)) * (charging ? 3.5 : 2.2) : Math.sin(t * 2 + u.id) * 0.6;
    const amp = charging ? 1.05 : 0.72;
    const stretch = charging ? 1 : 0;
    // far-side legs first
    const paw = idle && Math.sin(t * 0.9 + u.id * 1.7) > 0.93;
    const legAngles = (off, front) => {
      if (air) return [front ? 0.9 : -0.8, front ? -1.2 : 1.0];
      if (idle) {
        const p = paw && front ? Math.sin(t * 14) * 0.35 : 0;
        return [0.03 + p, -0.04 - Math.max(0, p) * 1.5];
      }
      const s = Math.sin(ph + off);
      const lift = Math.max(0, Math.cos(ph + off));
      const a1 = s * amp + (front ? 0.1 : -0.05);
      const a2 = (front ? -1 : 1) * lift * (0.5 + 0.7 * amp);
      return [a1, a2 * (front ? 1 : -1)];
    };
    const farCol = o.back;
    const offs = charging ? [0, 0.4, Math.PI * 0.9, Math.PI * 1.3] : [Math.PI * 0.5, 0, Math.PI * 1.5, Math.PI];
    const L = [
      [13, -21 + bob, offs[0], true, farCol], // far front
      [-17, -22 + bob, offs[1], false, farCol], // far hind
    ];
    for (const [x, y, off, front, col] of L) {
      const [a1, a2] = legAngles(off, front);
      leg(ctx, x, y, a1, a2, col, lw);
    }
    // tail
    const tailSwing = moving ? Math.sin(ph * 1.2) * (charging ? 0.5 : 0.25) : Math.sin(t * 1.7 + u.id) * 0.25;
    const tx = -26, ty = -33 + bob;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw * 1.05;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.bezierCurveTo(tx - 10 - stretch * 8, ty + 2 - stretch * 3, tx - 12 - stretch * 8 + tailSwing * 10, ty + 14 - stretch * 8, tx - 8 - stretch * 10 + tailSwing * 14, ty + 22 - stretch * 12);
    ctx.stroke();
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty + 1);
    ctx.bezierCurveTo(tx - 12, ty + 6, tx - 15 + tailSwing * 8, ty + 14 - stretch * 6, tx - 12 + tailSwing * 12, ty + 20 - stretch * 10);
    ctx.stroke();

    // body
    const tilt = charging ? -0.07 : 0;
    ctx.save();
    ctx.translate(-2, -28 + bob);
    ctx.rotate(tilt);
    ctx.fillStyle = o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(15, -10 + j(1));
    ctx.bezierCurveTo(4, -11, -12, -10, -21, -8 + j(2));
    ctx.bezierCurveTo(-30, -4, -30, 8, -22, 10);
    ctx.bezierCurveTo(-14, 11, -4, 7, 6 + j(3), 10);
    ctx.bezierCurveTo(16, 11, 23, 5, 21, -3);
    ctx.bezierCurveTo(21, -6, 19, -7, 15, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // belly shading scribbles
    ctx.lineWidth = lw * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(-16 + i * 7, 3 + j(i + 5, 0.3));
      ctx.lineTo(-13 + i * 7, 6.5);
    }
    ctx.stroke();
    // saddle blanket in team color
    ctx.fillStyle = o.light;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(-9, -8.5);
    ctx.lineTo(7, -8.5);
    ctx.lineTo(8, 1);
    ctx.quadraticCurveTo(-1, 3.4, -10, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    ctx.moveTo(-9.4, -4); ctx.lineTo(7.6, -4);
    ctx.stroke();
    ctx.restore();

    // neck + head
    const headDip = charging ? 6 : moving ? Math.sin(ph) * 1.8 : Math.sin(t * 1.3 + u.id) * 1.2;
    const nx0 = 15, ny0 = -34 + bob;
    const hx = 29 + (charging ? 5 : 0), hy = -51 + bob + headDip + (charging ? 7 : 0);
    ctx.fillStyle = o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(nx0 - 6, ny0 + 2);
    ctx.quadraticCurveTo(nx0 - 3, ny0 - 13, hx - 8, hy - 2);
    ctx.lineTo(hx + 1, hy + 6);
    ctx.quadraticCurveTo(nx0 + 8, ny0 - 6, nx0 + 7, ny0 + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // head
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(charging ? 0.85 : 0.6);
    ctx.fillStyle = o.paper;
    ctx.beginPath();
    ctx.ellipse(4, 0, 11, 5.4, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // eye, nostril
    ctx.fillStyle = o.col;
    ctx.beginPath();
    ctx.arc(2, -1.2, 1.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13.2, 0.6, 0.9, 0, TAU);
    ctx.fill();
    // ears (second ear behind)
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    const earBack = charging ? -3 : 0;
    ctx.moveTo(-2, -4); ctx.lineTo(-5 + earBack, -11); ctx.lineTo(1, -5);
    ctx.moveTo(-5, -3.2); ctx.lineTo(-8 + earBack, -9); ctx.lineTo(-3, -4.6);
    ctx.stroke();
    ctx.restore();
    // mane: scribbled spikes down the back of the neck
    ctx.strokeStyle = o.col;
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    const flow = moving ? Math.sin(ph * 2) * 1.2 + (charging ? 3 : 0) : Math.sin(t * 2 + u.id) * 0.6;
    for (let i = 0; i < 6; i++) {
      const k = i / 5;
      const px = lerp(nx0 - 4, hx - 8, k) - 2 - k * 1.5;
      const py = lerp(ny0 + 1, hy - 3, Math.pow(k, 0.85)) - Math.sin(k * 3.1) * 6;
      ctx.moveTo(px, py);
      ctx.lineTo(px - 6 - flow - j(i + 12, 0.8), py + 3.5 + j(i + 20, 0.8));
    }
    ctx.stroke();

    // near-side legs over the body
    const N = [
      [13, -21 + bob, offs[2], true, o.col],
      [-17, -22 + bob, offs[3], false, o.col],
    ];
    for (const [x, y, off, front, col] of N) {
      const [a1, a2] = legAngles(off, front);
      leg(ctx, x, y, a1, a2, col, lw);
    }

    // charge speed lines and dust
    if (charging && sk >= 1) {
      ctx.strokeStyle = 'rgba(80,80,90,.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const yy = -46 + i * 12 + ((t * 40 + i * 9) % 5);
        const xx = -34 - ((t * 160 + i * 31) % 30);
        ctx.moveTo(xx, yy); ctx.lineTo(xx - 16, yy);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,115,105,.28)';
      for (let i = 0; i < 4; i++) {
        const k = ((t * 3 + i * 0.25) % 1);
        ctx.beginPath();
        ctx.arc(-26 - k * 34, -3 - k * 8, 3 + k * 6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------- catapult
function operator(ctx, o, x, y, state, a, t) {
  // tiny stick operator: state 'idle' | 'crank' | 'cheer'
  const lean = state === 'crank' ? -0.35 : 0;
  const col = o.col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  const hx = x + Math.sin(lean) * 3, hy = y - 11;
  const nx = x + Math.sin(lean) * 11, ny = y - 22;
  ctx.moveTo(x - 4, y); ctx.lineTo(hx, hy); ctx.lineTo(x + 4, y);
  ctx.moveTo(hx, hy); ctx.lineTo(nx, ny);
  // arms
  if (state === 'cheer') {
    ctx.moveTo(nx, ny + 2); ctx.lineTo(nx - 6, ny - 6);
    ctx.moveTo(nx, ny + 2); ctx.lineTo(nx + 6, ny - 6);
  } else if (state === 'crank') {
    const k = Math.sin(a * 40) * 2;
    ctx.moveTo(nx, ny + 3); ctx.lineTo(nx - 8, ny + 4 + k);
    ctx.moveTo(nx, ny + 3); ctx.lineTo(nx - 7, ny + 8 - k);
  } else {
    ctx.moveTo(nx, ny + 3); ctx.lineTo(nx - 6, ny + 8);
    ctx.moveTo(nx, ny + 3); ctx.lineTo(nx + 3, ny + 9);
  }
  ctx.stroke();
  ctx.fillStyle = o.paper;
  ctx.beginPath();
  ctx.arc(nx + Math.sin(lean) * 2, ny - 4.4, 4.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(nx + 1.6 + Math.sin(lean) * 2, ny - 4.8, 0.9, 0, TAU);
  ctx.fill();
  // little cap
  ctx.beginPath();
  ctx.arc(nx + Math.sin(lean) * 2, ny - 6.4, 4.4, Math.PI, 0);
  ctx.fill();
}

function wheel(ctx, o, x, y, r, rot) {
  ctx.fillStyle = o.paper;
  ctx.strokeStyle = o.col;
  ctx.lineWidth = o.lw * 1.05;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = o.lw * 0.6;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1));
  }
  ctx.stroke();
  ctx.fillStyle = o.col;
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, TAU);
  ctx.fill();
}

const REST_PHI = 2.72; // arm cocked back and down
const THROW_PHI = 5.6; // arm swung forward and up

BODIES.catapult = (ctx, u, o) => {
  const t = o.t || 0;
  const a = u.attacking ? u.anim.atk : 0;
  let phi = REST_PHI, loaded = true, recoil = 0, shake = 0;
  let opState = 'idle';
  if (u.attacking) {
    if (a < 0.5) {
      const k = a / 0.5; // slow, creaking wind-up
      phi = REST_PHI - 0.42 * ease.inOutSine(k);
      shake = Math.sin(t * 70) * 0.9 * k;
      opState = 'crank';
    } else {
      const k = clamp((a - 0.5) / 0.14, 0, 1);
      phi = lerp(REST_PHI - 0.42, THROW_PHI, ease.outQuad(k));
      loaded = k < 0.42;
      recoil = (1 - clamp((a - 0.5) / 0.3, 0, 1)) * 5;
      opState = 'cheer';
    }
  } else {
    const cd = u.atkCd || 1;
    const frac = (u.atkT || 0) > 0 ? 1 - u.atkT / cd : 1; // 0 just fired, 1 ready
    if (frac < 1) {
      phi = lerp(THROW_PHI, REST_PHI, ease.inOutSine(clamp(frac * 1.5, 0, 1)));
      loaded = frac > 0.62;
      if (frac < 0.25) opState = 'cheer';
    }
  }
  const sk = beginLocal(ctx, o, -recoil + shake, 0);
  const wr = (u.anim.walk || 0) / 13;
  const ink = o.col, lw = o.lw;
  const P = [4, -52];

  // far wheel
  wheel(ctx, o, -26, -13, 13, wr);
  // frame base
  ctx.fillStyle = o.light;
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.moveTo(-40, -28); ctx.lineTo(38, -28); ctx.lineTo(44, -22); ctx.lineTo(38, -18); ctx.lineTo(-38, -18); ctx.lineTo(-44, -23);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = lw * 0.4;
  ctx.beginPath();
  for (let i = -32; i < 36; i += 12) { ctx.moveTo(i, -28); ctx.lineTo(i + 3, -18); }
  ctx.stroke();
  // operator behind the near frame post
  operator(ctx, o, 30, -28, opState, a, t);
  // uprights (A frame)
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw * 1.5;
  ctx.beginPath();
  ctx.moveTo(-16, -28); ctx.lineTo(P[0], P[1]); ctx.lineTo(22, -28);
  ctx.stroke();
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-9, -39); ctx.lineTo(15, -39);
  ctx.stroke();

  // throwing arm: long throw side, short counterweight side
  const ax = Math.cos(phi), ay = Math.sin(phi);
  const Lt = 46, Lc = 15;
  const bx = P[0] + ax * Lt, by = P[1] + ay * Lt;
  const cx = P[0] - ax * Lc, cy = P[1] - ay * Lc;
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw * 1.9;
  ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.strokeStyle = o.light;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(cx + ax * 2, cy + ay * 2); ctx.lineTo(bx - ax * 3, by - ay * 3);
  ctx.stroke();
  // counterweight
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(phi);
  ctx.fillStyle = o.dark || ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw * 0.8;
  ctx.fillRect(-9, -5.5, 9, 11);
  ctx.strokeRect(-9, -5.5, 9, 11);
  ctx.restore();
  // bucket and boulder
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(phi + Math.PI / 2);
  ctx.strokeStyle = ink;
  ctx.fillStyle = o.light;
  ctx.lineWidth = lw * 1.0;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.quadraticCurveTo(-7, 6, 0, 6);
  ctx.quadraticCurveTo(7, 6, 7, -2);
  ctx.stroke();
  ctx.restore();
  if (loaded) {
    ctx.fillStyle = o.light;
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.arc(bx, by - 6.5, 7, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(bx - 3, by - 8.5); ctx.lineTo(bx + 1, by - 6.5); ctx.lineTo(bx + 4, by - 9);
    ctx.stroke();
  }
  // pivot hub
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(P[0], P[1], 3.4, 0, TAU);
  ctx.fill();
  // strain lines during the wind-up
  if (u.attacking && a < 0.5 && sk >= 1) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const s = (i - 1) * 6;
      ctx.moveTo(P[0] - 13 + s * 0.4, P[1] - 10 - i * 2);
      ctx.lineTo(P[0] - 18 + s * 0.4, P[1] - 14 - i * 2);
    }
    ctx.stroke();
  }
  // near wheel
  wheel(ctx, o, 28, -13, 13, wr);
  ctx.restore();
};

// ---------------------------------------------------------------- critter
BODIES.critter = (ctx, u, o) => {
  const t = o.t || 0;
  const moving = !!u.anim.moving;
  const ph = (u.anim.walk || 0) / 5.5;
  const hop = moving ? Math.abs(Math.sin(ph)) * 7 : Math.abs(Math.sin(t * 3 + u.id)) * 1.4;
  const land = moving ? 1 - Math.abs(Math.sin(ph)) : 0.4;
  const atk = u.attacking ? Math.sin(clamp(u.anim.atk, 0, 1) * Math.PI) : 0;
  const lifeBlink = u.lifetime > 0 && u.lifetime < 2.5 && Math.sin(t * 22) > 0.4;
  if (lifeBlink) ctx.globalAlpha *= 0.5;
  const sk = beginLocal(ctx, o, atk * 9, 0);
  const R = 12;
  const cy = -R - 7 - hop;
  const sx = 1 + land * 0.1 + atk * 0.12, sy = 1 - land * 0.1 - atk * 0.08;
  // stick legs
  ctx.strokeStyle = o.col;
  ctx.lineWidth = o.lw * 0.8;
  ctx.beginPath();
  for (const [off, back] of [[0, 1], [Math.PI, -1]]) {
    const s = moving ? Math.sin(ph + off) : 0.1 * back;
    const x0 = 3 * back * 1.2;
    const y0 = cy + R * 0.7;
    const kx = x0 + s * 6, ky = Math.min(-1, y0 + 6);
    ctx.moveTo(x0, y0 + 1);
    ctx.lineTo(kx, ky);
    ctx.lineTo(kx + 3 + (moving ? Math.max(0, Math.cos(ph + off)) * 2 : 0), -0.5);
  }
  ctx.stroke();
  // scribble ball
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(sx, sy);
  ctx.fillStyle = o.light;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = o.col;
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = o.lw * (k === 0 ? 0.9 : 0.55);
    ctx.beginPath();
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * TAU + k * 0.9;
      const rr = R + wob(o.seed + k * 7, i % steps, o.frame, 1.4) + (k ? -1.5 * k : 0);
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // fur spikes on top
  ctx.lineWidth = o.lw * 0.6;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + (i - 2) * 0.42;
    ctx.moveTo(Math.cos(ang) * (R - 1), Math.sin(ang) * (R - 1));
    ctx.lineTo(Math.cos(ang) * (R + 4 + wob(o.seed, i + 30, o.frame, 1.2)), Math.sin(ang) * (R + 4 + wob(o.seed, i + 40, o.frame, 1.2)));
  }
  ctx.stroke();
  // face: dot eyes, angry brows, zigzag mouth
  ctx.fillStyle = o.col;
  ctx.beginPath();
  ctx.arc(2.5, -3, 1.9, 0, TAU);
  ctx.arc(8, -2.6, 1.9, 0, TAU);
  ctx.fill();
  ctx.lineWidth = o.lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -7.6); ctx.lineTo(4.4, -5.6);
  ctx.moveTo(10.6, -7.4); ctx.lineTo(6.4, -5.5);
  ctx.moveTo(2, 3.4);
  for (let i = 0; i < 5; i++) ctx.lineTo(2 + (i + 1) * 1.7, 3.4 + (i % 2 ? 0 : 2.4));
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (lifeBlink) ctx.globalAlpha /= 0.5;
  void sk;
};

// ---------------------------------------------------------------- areas
function teamInk(r, team) {
  return (r && r.pal && r.pal[team] && r.pal[team].ink) || '#1f47c2';
}

AREA_DRAW.ink_pot = {
  under(ctx, cam, a, b, t, r) {
    if (!cam.visible(a.x, a.r + 20)) return;
    const age = a.max - a.t;
    const grow = ease.outQuad(clamp(age / 0.3, 0, 1));
    const fade = clamp(a.t / 0.8, 0, 1);
    const x = cam.sx(a.x), y = cam.sy(0.6);
    const rx = a.r * cam.zoom * grow, ry = a.r * 0.2 * cam.zoom * grow;
    const col = teamInk(r, a.team);
    ctx.globalAlpha = 0.5 * fade;
    ctx.fillStyle = col;
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * TAU;
      const k = 1 + wob(a.x | 0, i % n, Math.floor(t * 4), 0.08);
      const px = x + Math.cos(ang) * rx * k, py = y + Math.sin(ang) * ry * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.globalAlpha = 0.7 * fade;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // ripples and bubbles
    ctx.globalAlpha = 0.5 * fade;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.9 + i / 3) % 1);
      ctx.beginPath();
      ctx.ellipse(x, y, rx * k, ry * k, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.7 + i * 0.27) % 1);
      const bx = x + Math.sin(i * 5.1) * rx * 0.6, by = y - k * 16 * cam.zoom;
      ctx.beginPath();
      ctx.arc(bx, by, (1.6 + (i % 2)) * cam.zoom * (1 - k * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

AREA_DRAW.mini_bomb = {
  over(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, 40)) return;
    const x = cam.sx(a.x), y = cam.sy(a.y + (a.z || 0) * 14) - 4 * cam.zoom;
    const z = cam.zoom;
    const blink = a.landed && Math.sin(t * (30 - Math.min(20, a.fuse * 18))) > 0.1;
    ctx.fillStyle = blink ? '#fff7e0' : '#1b2240';
    ctx.strokeStyle = '#1b2240';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 4.2 * z, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#1b2240';
    ctx.beginPath();
    ctx.moveTo(x, y - 4 * z); ctx.quadraticCurveTo(x + 2 * z, y - 7 * z, x + 4 * z, y - 7.5 * z);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x + 4 * z, y - 7.8 * z, (1.6 + Math.sin(t * 40) * 0.6) * z, 0, TAU);
    ctx.fill();
  },
};

// Chain lightning: jagged scribble bolts that fade. Segments are recorded by behaviors/caster.js.
AREA_DRAW.chain_jump = {
  over(ctx, cam, a, b, t, r) {
    if (!a.segs || !a.segs.length) return;
    const col = teamInk(r, a.team);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const fr = Math.floor(t * 28);
    for (let si = 0; si < a.segs.length; si++) {
      const s = a.segs[si];
      const fade = clamp(1 - s.age / 0.45, 0, 1);
      if (fade <= 0) continue;
      const x1 = cam.sx(s.x1), y1 = cam.sy(s.y1 + s.z * 14), x2 = cam.sx(s.x2), y2 = cam.sy(s.y2 + s.z * 14);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const n = Math.max(4, Math.round(len / (13 * cam.zoom)));
      const pts = [[x1, y1]];
      for (let i = 1; i < n; i++) {
        const k = i / n;
        const off = wob(si * 31 + (a.x | 0), i, fr, 9 * cam.zoom);
        pts.push([lerp(x1, x2, k) + nx * off, lerp(y1, y2, k) + ny * off]);
      }
      pts.push([x2, y2]);
      ctx.globalAlpha = fade * 0.85;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * cam.zoom;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6 * cam.zoom;
      ctx.stroke();
      // a second thin scribble for the hand-drawn feel
      ctx.lineWidth = 1.1 * cam.zoom;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const jx = wob(si + i * 5, i, fr + 3, 3 * cam.zoom);
        return i ? ctx.lineTo(p[0] + jx, p[1] - jx) : ctx.moveTo(p[0], p[1]);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- event effects
const GREEN = '#3ec46d';

addFx('chain', (r, e) => {
  const col = teamInk(r, e.team);
  r.fx.burst(e.x2, e.y2, e.z, 5, col, 200, 'dot', { size: 1.8, life: 0.35, spread: 3 });
  r.fx.burst(e.x2, e.y2, e.z, 3, '#ffffff', 140, 'star', { size: 2, life: 0.3, spread: 3 });
});

addFx('healBeam', (r, e) => {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    r.fx.add({ kind: 'star', x: lerp(e.x1, e.x2, k), y: lerp(e.y1, e.y2, k) - Math.sin(k * Math.PI) * 14, z: e.z, vx: 0, vy: -20, g: 0, col: GREEN, size: 2.2, life: 0.3 + k * 0.35 });
  }
});

addFx('aura', (r, e) => {
  r.fx.ring(e.x, 0, e.z, '#ffe84a', e.radius * 0.5, 0.7);
  r.fx.burst(e.x, -30, e.z, 8, '#ff4fa8', 120, 'star', { size: 2.2, life: 0.7, spread: 2.6 });
});

addFx('revive', (r, e) => {
  r.fx.ring(e.x, 0, e.z, '#ffffff', 36, 0.6);
  r.fx.burst(e.x, -20, e.z, 12, '#ffd23f', 160, 'star', { size: 2.4, life: 0.8, spread: 2.4 });
  r.fx.text(e.x, -86, 'Redrawn!', '#1f9d55', 18, { life: 1.0, vy: -40 });
});

addFx('backstab', (r, e) => {
  r.fx.burst(e.x, e.y, e.z, 7, '#ffffff', 320, 'line', { size: 2.4, life: 0.25, spread: 3 });
  r.fx.puff(e.x, e.y + 20, e.z, 'rgba(40,40,60,.35)', 5, 9);
  r.fx.text(e.x, e.y - 18, e.mult >= 4 ? 'DEATH MARK!' : 'BACKSTAB!', '#d1342b', 20, { life: 0.8, vy: -50 });
  r.shake(3);
});

addFx('smoke', (r, e) => {
  r.fx.puff(e.x, -14, e.z, 'rgba(60,60,75,.4)', 6, 11);
});

addFx('chargeHit', (r, e) => {
  r.fx.ring(e.x, 0, e.z, '#f2b01e', 54, 0.4);
  r.fx.burst(e.x, e.y, e.z, 9, '#f2b01e', 300, 'star', { size: 2.4, life: 0.5, spread: 3 });
  r.fx.puff(e.x, -4, e.z, 'rgba(110,100,90,.4)', 5, 12);
  r.shake(6);
  if (e.team === 0) r.fx.text(e.x, e.y - 24, 'CHARGE!', '#b3720a', 20, { life: 0.8, vy: -55 });
});

addFx('chargeStart', (r, e) => {
  r.fx.puff(e.x, -2, e.z, 'rgba(110,100,90,.35)', 4, 10);
});

addFx('trample', (r, e) => {
  r.fx.puff(e.x, -4, e.z, 'rgba(110,100,90,.4)', 3, 9);
  r.fx.burst(e.x, -12, e.z, 4, '#f2b01e', 160, 'dot', { size: 1.8, life: 0.35 });
});

addFx('bomberBlast', (r, e) => {
  r.fx.burst(e.x, -20, 0, 14, '#ffd23f', 460, 'star', { size: 2.6, life: 0.6, spread: 2.8 });
  r.fx.puff(e.x, -10, 0, 'rgba(50,50,60,.45)', 8, 18);
  if (e.team === 0 && e.kills >= 2) r.fx.text(e.x, -110, `${e.kills} KO!`, '#b3720a', 24 + Math.min(10, e.kills * 2), { life: 1.1, vy: -45 });
  if (e.friendlyKills > 0) r.fx.text(e.x, -76, 'Oops!', '#d1342b', 16, { life: 0.9, vy: -35 });
});

addFx('summon', (r, e) => {
  r.fx.burst(e.x, -16, e.z, 8, teamInk(r, e.team), 160, 'dot', { size: 1.8, life: 0.45 });
  r.fx.puff(e.x, -6, e.z, 'rgba(60,60,70,.3)', 3, 8);
});

addFx('catapultFire', (r, e) => {
  r.fx.puff(e.x, -4, e.z, 'rgba(110,100,90,.4)', 5, 12);
  r.shake(2.5);
});
