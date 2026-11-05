// Hat drawers keyed by hat id (data/hats.js) plus unit headgear ids used in data/units.js looks
// (cap, helmet, hood, nurse, wizard, headband, goggles, visor, feather, mortarboard, general).
// Signature: (ctx, hx, hy, tilt, o) in the figure's local space; the head radius is 8.
// This file holds the shared helpers and the unit headgear; the 29 cosmetic hats live in hats_all.js.
// Everything stays within about 20 units above the head and 15 to each side so the wardrobe icon fits.
// OWNER: hero/hats builder (package E).

export const HAT_DRAW = {};

export function withTilt(ctx, hx, hy, tilt, fn) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  fn();
  ctx.restore();
}

// Fill the current path and outline it in the team ink. k scales the outline weight.
export function paint(ctx, o, fill, k = 0.7) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = o.col;
  ctx.lineWidth = (o.lw || 2.5) * k;
  ctx.stroke();
}

export const ellipsePath = (ctx, x, y, rx, ry, rot = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
};

// Little four-point sparkle used on magic hats.
export function sparkle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = fill;
  ctx.fill();
}

const time = (o) => (o && o.t) || 0;

HAT_DRAW.none = null;

// ---------------------------------------------------------------- unit headgear
HAT_DRAW.cap = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.arc(0, -1.6, 8.6, Math.PI, 0);
  ctx.lineTo(8.6, -1.6);
  ctx.closePath();
  paint(ctx, o, o.col, 0.6);
  // brim
  ctx.beginPath();
  ctx.moveTo(4, -2.4);
  ctx.quadraticCurveTo(11, -4.2, 14.2, -1.2);
  ctx.quadraticCurveTo(9, 0.6, 3, -0.4);
  ctx.closePath();
  paint(ctx, o, o.dark || o.col, 0.6);
  // top button and a paper-white highlight
  ctx.fillStyle = o.light || '#fff';
  ctx.beginPath(); ctx.arc(0, -10, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-1, -1.6, 6, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
});

HAT_DRAW.helmet = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.arc(0, -0.6, 9.4, Math.PI * 1.0, Math.PI * 2.0);
  ctx.lineTo(9.4, 1.2);
  ctx.lineTo(-9.4, 1.2);
  ctx.closePath();
  paint(ctx, o, o.light || '#d6dcec', 0.75);
  ctx.beginPath();
  ctx.moveTo(-9.4, -1);
  ctx.lineTo(9.4, -1);
  ctx.lineTo(9.4, 1.4);
  ctx.lineTo(-9.4, 1.4);
  ctx.closePath();
  paint(ctx, o, o.dark || o.col, 0.6);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = (o.lw || 2.5) * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, -9.8); ctx.lineTo(0, -1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-1.5, -0.6, 7, Math.PI * 1.15, Math.PI * 1.38); ctx.stroke();
});

HAT_DRAW.hood = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(4.5, -7);
  ctx.quadraticCurveTo(-3, -16.5, -13, -6);
  ctx.quadraticCurveTo(-14.5, 2, -10, 9);
  ctx.lineTo(-5.4, 6.4);
  ctx.arc(0, 0, 8.5, 2.5, 5.13);
  ctx.closePath();
  paint(ctx, o, o.dark || o.col, 0.65);
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-3, -11); ctx.quadraticCurveTo(-9, -8, -11, -1); ctx.stroke();
});

HAT_DRAW.nurse = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.4, -2.4);
  ctx.quadraticCurveTo(-10, -11.6, 0, -11.2);
  ctx.quadraticCurveTo(10, -11.6, 8.8, -2.4);
  ctx.quadraticCurveTo(0, -4.6, -8.4, -2.4);
  ctx.closePath();
  paint(ctx, o, '#ffffff', 0.7);
  ctx.fillStyle = '#e03a3a';
  ctx.fillRect(-0.9, -9.6, 2.2, 5.6);
  ctx.fillRect(-2.6, -8, 5.6, 2.2);
});

HAT_DRAW.wizard = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ellipsePath(ctx, 0, -4.2, 13, 3.2, -0.04);
  paint(ctx, o, '#5a32b8', 0.7);
  ctx.beginPath();
  ctx.moveTo(-7.6, -4.6);
  ctx.quadraticCurveTo(-6.6, -13, -0.5, -17.6);
  ctx.quadraticCurveTo(3.5, -20.6, 7.4, -17.4);
  ctx.quadraticCurveTo(3, -17.2, 1.4, -13);
  ctx.quadraticCurveTo(5, -9, 7.6, -4.6);
  ctx.quadraticCurveTo(0, -2.4, -7.6, -4.6);
  ctx.closePath();
  paint(ctx, o, '#7a4fe0', 0.7);
  // gold band and stars
  ctx.beginPath();
  ctx.moveTo(-7.4, -6.2);
  ctx.quadraticCurveTo(0, -3.9, 7.4, -6.2);
  ctx.lineTo(7.6, -4.6);
  ctx.quadraticCurveTo(0, -2.4, -7.6, -4.6);
  ctx.closePath();
  ctx.fillStyle = '#f2b01e';
  ctx.fill();
  const tw = 0.6 + 0.4 * Math.sin(time(o) * 4);
  sparkle(ctx, -1.5, -11, 2.1 * tw + 0.4, '#ffe56b');
  sparkle(ctx, 2.2, -14.5, 1.4, '#ffe56b');
});

HAT_DRAW.headband = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const t = time(o);
  const w1 = Math.sin(t * 9) * 2, w2 = Math.sin(t * 9 + 1.6) * 2.4;
  ctx.lineCap = 'round';
  for (const [dy, w, len] of [[-1, w1, 13], [1, w2, 11]]) {
    ctx.beginPath();
    ctx.moveTo(-7.6, -3.6);
    ctx.quadraticCurveTo(-7.6 - len * 0.5, -3.6 + dy * 2 + w, -7.6 - len, -2 + dy * 4 + w * 1.6);
    ctx.strokeStyle = o.col;
    ctx.lineWidth = (o.lw || 2.5) * 1.35;
    ctx.stroke();
    ctx.strokeStyle = '#d1342b';
    ctx.lineWidth = (o.lw || 2.5) * 0.7;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-8.2, -3.4);
  ctx.quadraticCurveTo(0, -1, 8.3, -3.6);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = (o.lw || 2.5) * 1.55;
  ctx.stroke();
  ctx.strokeStyle = '#d1342b';
  ctx.lineWidth = (o.lw || 2.5) * 0.85;
  ctx.stroke();
  ctx.fillStyle = '#ddd';
  ctx.fillRect(3.4, -4.7, 3.6, 2.6);
});

HAT_DRAW.goggles = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.3, -2.6);
  ctx.quadraticCurveTo(0, -0.5, 8.5, -3);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = (o.lw || 2.5) * 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#7a4a22';
  ctx.lineWidth = (o.lw || 2.5) * 0.8;
  ctx.stroke();
  // big brass-rimmed lens on the forehead
  ctx.beginPath(); ctx.arc(2.6, -6.6, 4.4, 0, Math.PI * 2);
  paint(ctx, o, '#c98a2c', 0.7);
  ctx.beginPath(); ctx.arc(2.6, -6.6, 2.9, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe36b';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath(); ctx.arc(1.6, -7.6, 1.1, 0, Math.PI * 2); ctx.fill();
});

HAT_DRAW.visor = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.4, -3);
  ctx.quadraticCurveTo(0, -6.6, 8.6, -3.2);
  ctx.lineTo(8.4, -0.8);
  ctx.quadraticCurveTo(0, -3.8, -8.2, -0.6);
  ctx.closePath();
  paint(ctx, o, '#d7ff3a', 0.65);
  ctx.beginPath();
  ctx.moveTo(5, -3.4);
  ctx.quadraticCurveTo(13, -5.2, 15, -1.6);
  ctx.quadraticCurveTo(10, -0.2, 4.6, -1);
  ctx.closePath();
  paint(ctx, o, '#ff4fb8', 0.65);
});

HAT_DRAW.feather = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.3, -2.8);
  ctx.quadraticCurveTo(0, -0.8, 8.3, -3);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = (o.lw || 2.5) * 1.4;
  ctx.stroke();
  ctx.strokeStyle = '#8a5cff';
  ctx.lineWidth = (o.lw || 2.5) * 0.7;
  ctx.stroke();
  // plume swaying a little
  const sway = Math.sin(time(o) * 3) * 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.quadraticCurveTo(-9 + sway, -12, -5 + sway, -19);
  ctx.quadraticCurveTo(1 + sway, -13, -2, -4);
  ctx.closePath();
  paint(ctx, o, '#ff6fd1', 0.6);
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-3.2, -5); ctx.quadraticCurveTo(-6.4 + sway, -11, -5 + sway, -18); ctx.stroke();
});

HAT_DRAW.mortarboard = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // skull cap
  ctx.beginPath();
  ctx.moveTo(-7, -3.2);
  ctx.lineTo(-7, -8);
  ctx.quadraticCurveTo(0, -6, 7, -8);
  ctx.lineTo(7, -3.2);
  ctx.quadraticCurveTo(0, -1.6, -7, -3.2);
  ctx.closePath();
  paint(ctx, o, '#2b2f45', 0.65);
  // flat board in perspective
  ctx.beginPath();
  ctx.moveTo(-14, -9.6);
  ctx.lineTo(1, -13.6);
  ctx.lineTo(14.4, -9.2);
  ctx.lineTo(-0.5, -5.8);
  ctx.closePath();
  paint(ctx, o, '#3a3f5c', 0.7);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-9, -9.6); ctx.lineTo(1, -12.2); ctx.stroke();
  // tassel
  const sw = Math.sin(time(o) * 4) * 0.8;
  ctx.strokeStyle = '#f2b01e';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0.5, -9.8); ctx.lineTo(11.5, -8.6); ctx.lineTo(12 + sw, -3.4); ctx.stroke();
  ctx.fillStyle = '#f2b01e';
  ctx.fillRect(10.7 + sw, -3.6, 2.6, 4);
});

HAT_DRAW.general = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // white plume
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.quadraticCurveTo(-8 + Math.sin(time(o) * 3), -21, -14, -13);
  ctx.quadraticCurveTo(-8, -15, -2, -9);
  ctx.closePath();
  paint(ctx, o, '#ffffff', 0.55);
  // big red bicorne
  ctx.beginPath();
  ctx.moveTo(-15, -4);
  ctx.quadraticCurveTo(-13, -11, -7.5, -10);
  ctx.quadraticCurveTo(0, -17, 7.5, -10);
  ctx.quadraticCurveTo(13, -11, 15, -4);
  ctx.quadraticCurveTo(0, -0.6, -15, -4);
  ctx.closePath();
  paint(ctx, o, '#b3261e', 0.75);
  ctx.strokeStyle = '#f2b01e';
  ctx.lineWidth = (o.lw || 2.5) * 0.55;
  ctx.beginPath(); ctx.moveTo(-14, -4.4); ctx.quadraticCurveTo(0, -1.2, 14, -4.4); ctx.stroke();
  ctx.fillStyle = '#f2b01e';
  ctx.beginPath(); ctx.arc(1, -10.4, 2.3, 0, Math.PI * 2); ctx.fill();
});

// The Captain's tricorn: team ink with gold trim, a red-and-white plume and a badge.
HAT_DRAW.captain = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const sway = Math.sin(time(o) * 3.2) * 1.1;
  // plume behind
  ctx.beginPath();
  ctx.moveTo(-9, -9.5);
  ctx.quadraticCurveTo(-17 + sway, -16, -15 + sway, -5.5);
  ctx.quadraticCurveTo(-11, -9.5, -9, -9.5);
  ctx.closePath();
  paint(ctx, o, '#ff5d4e', 0.55);
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.quadraticCurveTo(-17.5 + sway, -17.5, -17 + sway, -8);
  ctx.quadraticCurveTo(-13, -12, -10, -10);
  ctx.closePath();
  paint(ctx, o, '#ffffff', 0.5);
  ctx.beginPath();
  ctx.moveTo(-15.5, -3.6);
  ctx.quadraticCurveTo(-14.8, -10.6, -8.6, -9.6);
  ctx.quadraticCurveTo(0, -18, 8.6, -9.6);
  ctx.quadraticCurveTo(14.8, -10.6, 15.5, -3.6);
  ctx.quadraticCurveTo(0, -0.6, -15.5, -3.6);
  ctx.closePath();
  paint(ctx, o, o.dark || o.col, 0.8);
  // lighter crown panel
  ctx.beginPath();
  ctx.moveTo(-8, -9.3);
  ctx.quadraticCurveTo(0, -17, 8, -9.3);
  ctx.quadraticCurveTo(0, -7.4, -8, -9.3);
  ctx.closePath();
  ctx.fillStyle = o.col;
  ctx.fill();
  // gold trim along the brim
  ctx.strokeStyle = '#f2b01e';
  ctx.lineWidth = (o.lw || 2.5) * 0.6;
  ctx.beginPath();
  ctx.moveTo(-14.6, -3.2);
  ctx.quadraticCurveTo(0, -0.1, 14.6, -3.2);
  ctx.stroke();
  // badge
  ctx.beginPath();
  ctx.arc(0.5, -8.6, 2.8, 0, Math.PI * 2);
  paint(ctx, o, '#f2b01e', 0.5);
  sparkle(ctx, 0.5, -8.6, 1.7, '#fff6c8');
});

// Upgrade gear (drawn when the unit has no headgear of its own).
HAT_DRAW.gear_helm = HAT_DRAW.helmet;
HAT_DRAW.gear_plume = (ctx, hx, hy, tilt, o) => {
  withTilt(ctx, hx, hy, tilt, () => {
    ctx.beginPath();
    ctx.moveTo(-1, -9.5);
    ctx.quadraticCurveTo(-5, -20.5, -14, -12);
    ctx.quadraticCurveTo(-7, -14, -3, -8);
    ctx.closePath();
    paint(ctx, o, '#d1342b', 0.55);
  });
  HAT_DRAW.helmet(ctx, hx, hy, tilt, o);
};
