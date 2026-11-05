// Hat drawers keyed by hat id (data/hats.js) plus unit headgear ids used in data/units.js looks
// (cap, helmet, hood, nurse, wizard, headband, goggles, visor, feather, mortarboard, general).
// Signature: (ctx, hx, hy, tilt, o) in the figure's local space; the head radius is 8.
// OWNER: hero/hats builder (package E) draws every hat in data/hats.js and the unit headgear.

export const HAT_DRAW = {};

function withTilt(ctx, hx, hy, tilt, fn) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  fn();
  ctx.restore();
}

HAT_DRAW.none = null;

HAT_DRAW.cap = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.fillStyle = o.col;
  ctx.beginPath();
  ctx.arc(0, -2, 8.4, Math.PI, 0);
  ctx.lineTo(13, -2);
  ctx.lineTo(13, 0);
  ctx.lineTo(-8.4, 0);
  ctx.closePath();
  ctx.fill();
});

HAT_DRAW.helmet = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.fillStyle = o.light || o.paper;
  ctx.strokeStyle = o.col;
  ctx.lineWidth = o.lw * 0.7;
  ctx.beginPath();
  ctx.arc(0, -1, 9.2, Math.PI * 1.02, Math.PI * 1.98);
  ctx.lineTo(9.6, 1);
  ctx.lineTo(-9.6, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -1);
  ctx.stroke();
});

HAT_DRAW.hood = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.strokeStyle = o.col;
  ctx.lineWidth = o.lw * 0.9;
  ctx.beginPath();
  ctx.arc(-1, 0, 10, Math.PI * 0.55, Math.PI * 1.9);
  ctx.quadraticCurveTo(-6, -16, -14, -6);
  ctx.stroke();
});

HAT_DRAW.captain = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.fillStyle = o.col;
  ctx.beginPath();
  ctx.moveTo(-14, -5);
  ctx.quadraticCurveTo(0, -11, 14, -5);
  ctx.quadraticCurveTo(8, -21, 0, -16);
  ctx.quadraticCurveTo(-8, -21, -14, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2b01e';
  ctx.beginPath();
  ctx.arc(1, -11, 2.4, 0, Math.PI * 2);
  ctx.fill();
});

// Upgrade gear (drawn when the unit has no headgear of its own).
HAT_DRAW.gear_helm = HAT_DRAW.helmet;
HAT_DRAW.gear_plume = (ctx, hx, hy, tilt, o) => {
  HAT_DRAW.helmet(ctx, hx, hy, tilt, o);
  withTilt(ctx, hx, hy, tilt, () => {
    ctx.strokeStyle = '#d1342b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(-6, -18, -13, -12);
    ctx.stroke();
  });
};
