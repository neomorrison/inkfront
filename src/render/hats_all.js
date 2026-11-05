// The cosmetic hats from data/hats.js. Bold shapes and colors so each reads at 20 px tall.
// Local figure space, head radius 8 at the origin, up is negative y, the figure faces +x.
// o: { col (team ink), light, dark, paper, lw, t (seconds, for little animations) }.
// OWNER: hero/hats builder (package E).
import { HAT_DRAW, withTilt, paint, ellipsePath, sparkle } from './hats.js';

const time = (o) => (o && o.t) || 0;
const lwOf = (o) => o.lw || 2.5;

// Round spectacles on the face (Professor Specs hat and the Professor boss accessory).
export function drawGlasses(ctx, hx, hy, tilt, o, scale = 1) {
  withTilt(ctx, hx, hy, tilt, () => {
    ctx.scale(scale, scale);
    const lw = lwOf(o);
    const eyes = [[2.2, -1.2], [5.8, -1.4]];
    ctx.strokeStyle = '#1b2240';
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    ctx.moveTo(eyes[0][0] + 0.4, eyes[0][1] - 0.8);
    ctx.lineTo(-7.8, -2.4); // arm to the ear
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyes[0][0] + 2.7, eyes[0][1] - 0.4);
    ctx.lineTo(eyes[1][0] - 2.7, eyes[1][1] - 0.4);
    ctx.stroke();
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      ctx.arc(ex, ey, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,215,255,.5)';
      ctx.fill();
      ctx.strokeStyle = '#1b2240';
      ctx.lineWidth = lw * 0.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(ex - 1.1, ey - 1.1, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// ---------------------------------------------------------------- boss and level hats
HAT_DRAW.party = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-7.4, -4.2);
  ctx.lineTo(1.4, -19.5);
  ctx.lineTo(7.6, -4.8);
  ctx.quadraticCurveTo(0, -2.6, -7.4, -4.2);
  ctx.closePath();
  ctx.fillStyle = '#ff6fb5';
  ctx.fill();
  ctx.clip();
  const cols = ['#ffd23a', '#4fd0ff', '#ffffff'];
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = cols[i % 3];
    ctx.beginPath();
    ctx.moveTo(-10, -2 - i * 3.2);
    ctx.lineTo(10, -9 - i * 3.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-7.4, -4.2);
  ctx.lineTo(1.4, -19.5);
  ctx.lineTo(7.6, -4.8);
  ctx.quadraticCurveTo(0, -2.6, -7.4, -4.2);
  ctx.closePath();
  paint(ctx, o, null, 0.75);
  // pom-pom bounces
  const b = Math.sin(time(o) * 6) * 0.5;
  ctx.beginPath(); ctx.arc(1.4, -20 + b, 2.2, 0, Math.PI * 2);
  paint(ctx, o, '#ffd23a', 0.5);
});

HAT_DRAW.red_plume = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const sw = Math.sin(time(o) * 3) * 1.4;
  ctx.beginPath();
  ctx.moveTo(-1, -9);
  ctx.quadraticCurveTo(-6, -22.5 + sw * 0.4, -15 + sw, -12);
  ctx.quadraticCurveTo(-13 + sw, -9, -8, -10.6);
  ctx.quadraticCurveTo(-11 + sw, -6, -4, -6);
  ctx.closePath();
  paint(ctx, o, '#e0362c', 0.7);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-3, -9.5); ctx.quadraticCurveTo(-7, -17, -12 + sw, -12); ctx.stroke();
  HAT_DRAW.helmet(ctx, 0, 0, 0, o);
});

HAT_DRAW.pencil_crown = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // five pencils standing around the head, tips up
  const xs = [-8.4, -4.2, 0, 4.2, 8.4];
  const hs = [9.5, 12.5, 14.5, 12.5, 9.5];
  xs.forEach((x, i) => {
    const top = -8 - hs[i] + (i === 2 ? 0 : 0);
    const w = 1.9;
    ctx.beginPath();
    ctx.moveTo(x - w, -6);
    ctx.lineTo(x - w, top + 4);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w, top + 4);
    ctx.lineTo(x + w, -6);
    ctx.closePath();
    paint(ctx, o, i % 2 ? '#ffb02e' : '#ffd23a', 0.5);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.55, top + 2.6); ctx.lineTo(x, top); ctx.lineTo(x + w * 0.55, top + 2.6);
    ctx.fillStyle = '#3a3f5c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - w * 0.4, top + 5); ctx.lineTo(x - w * 0.4, -7.5); ctx.stroke();
  });
  // band
  ctx.beginPath();
  ctx.moveTo(-9.6, -7);
  ctx.quadraticCurveTo(0, -4.4, 9.8, -7);
  ctx.lineTo(9.6, -3.6);
  ctx.quadraticCurveTo(0, -1, -9.6, -3.6);
  ctx.closePath();
  paint(ctx, o, '#ff7a8f', 0.65);
});

HAT_DRAW.neon_horns = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const glow = 0.65 + 0.35 * Math.sin(time(o) * 5);
  for (const s of [-1, 1]) {
    // a sharp devil horn: out, then up and curling back in to a point
    ctx.beginPath();
    ctx.moveTo(s * 6.8, -5);
    ctx.quadraticCurveTo(s * 15.4, -6.4, s * 11.6, -19.6);
    ctx.quadraticCurveTo(s * 9.6, -11.4, s * 3.6, -6);
    ctx.closePath();
    paint(ctx, o, s < 0 ? '#ff4fd8' : '#46f0ff', 0.75);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * glow})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s * 7.4, -6.4);
    ctx.quadraticCurveTo(s * 12.6, -7.4, s * 10.8, -15.4);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-8, -3.6); ctx.quadraticCurveTo(0, -1.2, 8.2, -3.8);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = lwOf(o) * 1.4;
  ctx.stroke();
  ctx.strokeStyle = '#c8ff3a';
  ctx.lineWidth = lwOf(o) * 0.7;
  ctx.stroke();
});

HAT_DRAW.professor_glasses = (ctx, hx, hy, tilt, o) => {
  // a little tuft of white hair on top for the full professor look
  withTilt(ctx, hx, hy, tilt, () => {
    ctx.beginPath();
    ctx.moveTo(-5, -6.6);
    ctx.quadraticCurveTo(-4, -12.2, -1, -9.4);
    ctx.quadraticCurveTo(1, -13.6, 3, -8.6);
    ctx.quadraticCurveTo(5, -10, 6, -6.4);
    ctx.closePath();
    paint(ctx, o, '#f2f2f2', 0.55);
  });
  drawGlasses(ctx, hx, hy, tilt, o);
};

HAT_DRAW.eraser_cap = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // pencil-end eraser sitting on the head
  ctx.beginPath();
  ctx.moveTo(-7.4, -5.5);
  ctx.lineTo(-7, -14.5);
  ctx.quadraticCurveTo(0, -18.4, 7, -14.5);
  ctx.lineTo(7.4, -5.5);
  ctx.closePath();
  paint(ctx, o, '#ff8fa8', 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-4.4, -7.4); ctx.lineTo(-4.2, -14); ctx.stroke();
  // metal ferrule with ridges
  ctx.beginPath();
  ctx.rect(-8.4, -5.8, 16.8, 5);
  paint(ctx, o, '#b9c2d6', 0.7);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = lwOf(o) * 0.35;
  for (const y of [-4.1, -2.5]) { ctx.beginPath(); ctx.moveTo(-8.4, y); ctx.lineTo(8.4, y); ctx.stroke(); }
});

HAT_DRAW.halo = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const bob = Math.sin(time(o) * 3) * 0.9;
  const y = -15.5 + bob;
  ellipsePath(ctx, 0, y, 8.8, 2.9);
  ctx.strokeStyle = 'rgba(255,214,70,.4)';
  ctx.lineWidth = 6.4;
  ctx.stroke();
  ellipsePath(ctx, 0, y, 8.8, 2.9);
  ctx.strokeStyle = o.col;
  ctx.lineWidth = lwOf(o) * 1.7;
  ctx.stroke();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = lwOf(o) * 1.0;
  ctx.stroke();
  const tw = 0.5 + 0.5 * Math.sin(time(o) * 5);
  sparkle(ctx, 8.8, y - 2.2, 1.2 + tw * 1.4, '#ffffff');
});

HAT_DRAW.ninja_mask = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const t = time(o);
  // face mask: dark cloth over the lower face, eyes stay visible
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 8.6, 0, Math.PI * 2); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-10, 1.2);
  ctx.quadraticCurveTo(0, 0.2, 10, 1.2);
  ctx.lineTo(10, 10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fillStyle = '#23283f';
  ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 8.3, 0.1, Math.PI - 0.1);
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 0.9; ctx.stroke();
  // headband with flowing tails
  for (const [dy, ph, len] of [[-1, 0, 8.5], [1.5, 1.7, 7]]) {
    const w = Math.sin(t * 8 + ph) * 2.2;
    ctx.beginPath();
    ctx.moveTo(-7.5, -3.8);
    ctx.quadraticCurveTo(-7.5 - len * 0.5, -3.8 + dy * 2 + w, -7.5 - len, -2.5 + dy * 4 + w * 1.7);
    ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 1.3; ctx.stroke();
    ctx.strokeStyle = '#23283f'; ctx.lineWidth = lwOf(o) * 0.65; ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-8.2, -3.4); ctx.quadraticCurveTo(0, -1.4, 8.4, -3.8);
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 1.6; ctx.stroke();
  ctx.strokeStyle = '#23283f'; ctx.lineWidth = lwOf(o) * 0.9; ctx.stroke();
  ctx.fillStyle = '#c9d0e6';
  ctx.beginPath(); ctx.rect(2.8, -5.1, 4, 3); ctx.fill();
  ctx.strokeStyle = o.col; ctx.lineWidth = 0.9; ctx.stroke();
});

HAT_DRAW.golden_quill = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.3, -2.8); ctx.quadraticCurveTo(0, -0.7, 8.3, -3);
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 1.5; ctx.stroke();
  ctx.strokeStyle = '#f2b01e'; ctx.lineWidth = lwOf(o) * 0.8; ctx.stroke();
  // a big golden feather
  const sw = Math.sin(time(o) * 2.6) * 0.9;
  ctx.beginPath();
  ctx.moveTo(2, -3.6);
  ctx.quadraticCurveTo(-1 + sw, -14, 10 + sw, -19.6);
  ctx.quadraticCurveTo(13, -9, 4, -3.4);
  ctx.closePath();
  paint(ctx, o, '#ffd23a', 0.75);
  ctx.beginPath();
  ctx.moveTo(2.2, -3.8); ctx.quadraticCurveTo(3 + sw, -11, 10 + sw, -19);
  ctx.strokeStyle = '#a56a00'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
  for (const [a, b, c, d] of [[4, -7, 9, -10], [4.6, -10, 9.4, -13.4], [5.6, -13, 9.6, -16.2]]) {
    ctx.beginPath(); ctx.moveTo(a, b + sw * 0.3); ctx.lineTo(c, d + sw * 0.6); ctx.stroke();
  }
  sparkle(ctx, 11.5, -15, 1.4 + 0.8 * Math.sin(time(o) * 5), '#ffffff');
});

HAT_DRAW.crown = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-9.4, -3.4);
  ctx.lineTo(-10.6, -15);
  ctx.lineTo(-5, -9.6);
  ctx.lineTo(0, -18);
  ctx.lineTo(5, -9.6);
  ctx.lineTo(10.6, -15);
  ctx.lineTo(9.4, -3.4);
  ctx.quadraticCurveTo(0, -1.2, -9.4, -3.4);
  ctx.closePath();
  paint(ctx, o, '#ffcf2e', 0.8);
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-7.6, -5.4); ctx.lineTo(-8.4, -12); ctx.stroke();
  // jewels
  const gems = [[-5.5, -5, '#e03a5a'], [0, -5.4, '#3a8bff'], [5.5, -5, '#3ec46d']];
  for (const [x, y, c] of gems) {
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    paint(ctx, o, c, 0.4);
  }
  for (const [x, y] of [[-10.6, -15.4], [0, -18.5], [10.6, -15.4]]) {
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    paint(ctx, o, '#ffffff', 0.4);
  }
  sparkle(ctx, 4, -12.5, 1 + 0.8 * Math.sin(time(o) * 4 + 1), '#ffffff');
});

// ---------------------------------------------------------------- achievement hats
HAT_DRAW.top_hat = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ellipsePath(ctx, 0, -4.4, 12.6, 2.9);
  paint(ctx, o, '#23283f', 0.7);
  ctx.beginPath();
  ctx.moveTo(-7, -5);
  ctx.lineTo(-6.4, -18.4);
  ctx.quadraticCurveTo(0, -20, 6.4, -18.4);
  ctx.lineTo(7, -5);
  ctx.quadraticCurveTo(0, -2.8, -7, -5);
  ctx.closePath();
  paint(ctx, o, '#2f3552', 0.75);
  ctx.beginPath();
  ctx.moveTo(-6.9, -8.8);
  ctx.quadraticCurveTo(0, -6.8, 6.9, -8.8);
  ctx.lineTo(7, -5.4);
  ctx.quadraticCurveTo(0, -3.2, -7, -5.4);
  ctx.closePath();
  paint(ctx, o, '#d1342b', 0.55);
  ctx.fillStyle = '#f2b01e';
  ctx.fillRect(1.6, -8.4, 3.6, 3.4);
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-4.2, -10); ctx.lineTo(-4, -17); ctx.stroke();
});

HAT_DRAW.viking = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 7.4, -4);
    ctx.quadraticCurveTo(s * 15.4, -3.4, s * 12.4, -14.6);
    ctx.quadraticCurveTo(s * 11, -7.4, s * 5.4, -6.4);
    ctx.closePath();
    paint(ctx, o, '#f4ecd0', 0.7);
  }
  ctx.beginPath();
  ctx.arc(0, -0.4, 9, Math.PI, 0);
  ctx.lineTo(9, 1);
  ctx.lineTo(-9, 1);
  ctx.closePath();
  paint(ctx, o, '#9aa6bd', 0.75);
  ctx.beginPath();
  ctx.rect(-9.2, -2.6, 18.4, 3.4);
  paint(ctx, o, '#7a5a34', 0.6);
  ctx.fillStyle = '#e8d28a';
  for (const x of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.arc(x, -0.9, 0.9, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-1.5, -0.4, 7, Math.PI * 1.2, Math.PI * 1.42); ctx.stroke();
});

HAT_DRAW.chef = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-7.6, -4);
  ctx.bezierCurveTo(-14.6, -6, -12.4, -16.6, -5.6, -15);
  ctx.bezierCurveTo(-4.4, -21, 4.4, -21, 5.6, -15);
  ctx.bezierCurveTo(12.4, -16.6, 14.6, -6, 7.6, -4);
  ctx.closePath();
  paint(ctx, o, '#ffffff', 0.75);
  ctx.beginPath();
  ctx.rect(-7.6, -6.4, 15.2, 4.4);
  paint(ctx, o, '#f1f4ff', 0.7);
  ctx.strokeStyle = 'rgba(27,34,64,.28)';
  ctx.lineWidth = 1;
  for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x, -6.4); ctx.lineTo(x, -2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-6, -11); ctx.quadraticCurveTo(-3, -14, 0, -11); ctx.stroke();
});

HAT_DRAW.cowboy = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // wide brim curled up at both ends
  ctx.beginPath();
  ctx.moveTo(-15, -7);
  ctx.quadraticCurveTo(-11, -2.6, -5, -4.2);
  ctx.quadraticCurveTo(0, -3, 5, -4.2);
  ctx.quadraticCurveTo(11, -2.6, 15, -7);
  ctx.quadraticCurveTo(10, -0.8, 0, -1.6);
  ctx.quadraticCurveTo(-10, -0.8, -15, -7);
  ctx.closePath();
  paint(ctx, o, '#b8793a', 0.75);
  // dented crown
  ctx.beginPath();
  ctx.moveTo(-6.6, -4.2);
  ctx.quadraticCurveTo(-8, -12.4, -4.4, -15);
  ctx.quadraticCurveTo(0, -12.6, 4.4, -15);
  ctx.quadraticCurveTo(8, -12.4, 6.6, -4.2);
  ctx.quadraticCurveTo(0, -2.8, -6.6, -4.2);
  ctx.closePath();
  paint(ctx, o, '#c98a4a', 0.75);
  ctx.beginPath();
  ctx.moveTo(-6.9, -6.6);
  ctx.quadraticCurveTo(0, -5, 6.9, -6.6);
  ctx.lineTo(6.7, -4.4);
  ctx.quadraticCurveTo(0, -3, -6.7, -4.4);
  ctx.closePath();
  paint(ctx, o, '#5a3216', 0.5);
  ctx.fillStyle = '#f2b01e';
  ctx.fillRect(-1, -6.3, 2.4, 2.2);
});

HAT_DRAW.pirate = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-15.4, -3.6);
  ctx.quadraticCurveTo(-13.6, -12, -7, -10.6);
  ctx.quadraticCurveTo(0, -19.4, 7, -10.6);
  ctx.quadraticCurveTo(13.6, -12, 15.4, -3.6);
  ctx.quadraticCurveTo(0, -0.4, -15.4, -3.6);
  ctx.closePath();
  paint(ctx, o, '#23283f', 0.8);
  ctx.strokeStyle = '#f2b01e';
  ctx.lineWidth = lwOf(o) * 0.5;
  ctx.beginPath(); ctx.moveTo(-14.4, -4); ctx.quadraticCurveTo(0, -1.2, 14.4, -4); ctx.stroke();
  // skull and crossbones
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.6, -11); ctx.lineTo(4, -6.6);
  ctx.moveTo(4, -11); ctx.lineTo(-3.6, -6.6);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0.2, -9.6, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#23283f';
  ctx.beginPath(); ctx.arc(-0.9, -9.8, 0.8, 0, Math.PI * 2); ctx.arc(1.3, -9.8, 0.8, 0, Math.PI * 2); ctx.fill();
});

HAT_DRAW.propeller = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.save();
  ctx.beginPath(); ctx.arc(0, -1.6, 8.6, Math.PI, 0); ctx.lineTo(8.6, -1.6); ctx.closePath();
  ctx.fillStyle = '#ff5d4e'; ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(-3, -12, 3.2, 12);
  ctx.fillStyle = '#3a8bff';
  ctx.fillRect(3.2, -12, 3.2, 12);
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, -1.6, 8.6, Math.PI, 0); ctx.lineTo(8.6, -1.6); ctx.closePath();
  paint(ctx, o, null, 0.7);
  // stem and spinning blades (squashed by the spin so they look like they rotate)
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 0.6;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -13.6); ctx.stroke();
  const sp = Math.cos(time(o) * 22);
  ctx.save();
  ctx.translate(0, -14);
  for (const [c, a] of [['#3ec46d', 0], ['#ffd23a', Math.PI]]) {
    ctx.save();
    ctx.rotate(a);
    ctx.scale(sp, 1);
    ctx.beginPath();
    ctx.ellipse(5.4, -0.4, 5.6, 1.9, -0.1, 0, Math.PI * 2);
    paint(ctx, o, c, 0.5);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); paint(ctx, o, '#ffffff', 0.4);
  ctx.restore();
});

HAT_DRAW.traffic_cone = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // base slab
  ctx.beginPath(); ctx.rect(-9, -5.4, 18, 2.6);
  paint(ctx, o, '#ff8a1e', 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-7, -5.4);
  ctx.lineTo(-1.6, -19.4);
  ctx.quadraticCurveTo(0.6, -20.6, 2.6, -19.4);
  ctx.lineTo(7, -5.4);
  ctx.closePath();
  ctx.fillStyle = '#ff7a12';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(8, -13.2); ctx.lineTo(-8, -13.2); ctx.fill();
  ctx.fillRect(-8, -17.4, 16, 1.4);
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.beginPath(); ctx.moveTo(2, -20); ctx.lineTo(8, -5.4); ctx.lineTo(1, -5.4); ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-7, -5.4);
  ctx.lineTo(-1.6, -19.4);
  ctx.quadraticCurveTo(0.6, -20.6, 2.6, -19.4);
  ctx.lineTo(7, -5.4);
  ctx.closePath();
  paint(ctx, o, null, 0.75);
});

// ---------------------------------------------------------------- crate hats
HAT_DRAW.paper_boat = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // the classic folded newspaper hat
  ctx.beginPath();
  ctx.moveTo(-13.6, -5);
  ctx.lineTo(-9, -14.4);
  ctx.quadraticCurveTo(0, -17.4, 9, -14.4);
  ctx.lineTo(13.6, -5);
  ctx.quadraticCurveTo(0, -2.2, -13.6, -5);
  ctx.closePath();
  paint(ctx, o, '#fffdf4', 0.75);
  ctx.beginPath();
  ctx.moveTo(-13.6, -5);
  ctx.quadraticCurveTo(0, -2.2, 13.6, -5);
  ctx.lineTo(11.6, -8.6);
  ctx.quadraticCurveTo(0, -6.2, -11.6, -8.6);
  ctx.closePath();
  paint(ctx, o, '#e9e2c6', 0.6);
  // fake newsprint
  ctx.strokeStyle = 'rgba(27,34,64,.35)';
  ctx.lineWidth = 1;
  for (const y of [-10.2, -12, -13.6]) { ctx.beginPath(); ctx.moveTo(-5.4, y); ctx.lineTo(5.4 - (y === -13.6 ? 4 : 0), y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(27,34,64,.5)';
  ctx.fillRect(-6, -10.8, 3, 1.6);
});

HAT_DRAW.beanie = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-8.4, -4.4);
  ctx.quadraticCurveTo(-9.6, -15.4, 0, -15.6);
  ctx.quadraticCurveTo(9.6, -15.4, 8.8, -4.4);
  ctx.closePath();
  paint(ctx, o, '#2fb5a8', 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.3;
  for (const x of [-4.6, 0, 4.6]) { ctx.beginPath(); ctx.moveTo(x * 0.9, -14.8); ctx.quadraticCurveTo(x * 1.2, -9, x, -5); ctx.stroke(); }
  ctx.beginPath(); ctx.rect(-9.4, -6.2, 19, 4.6);
  paint(ctx, o, '#ff6a5a', 0.75);
  ctx.strokeStyle = 'rgba(27,34,64,.35)';
  ctx.lineWidth = 1;
  for (let x = -7.6; x <= 8; x += 2.8) { ctx.beginPath(); ctx.moveTo(x, -6.2); ctx.lineTo(x, -1.6); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, -17.4, 2.6, 0, Math.PI * 2);
  paint(ctx, o, '#ffffff', 0.55);
});

HAT_DRAW.bucket = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // upside-down metal bucket with a swinging handle
  const sw = Math.sin(time(o) * 3) * 1.2;
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 0.55;
  ctx.beginPath(); ctx.moveTo(-6, -15); ctx.quadraticCurveTo(-1 + sw, -22, 7 + sw, -14); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6.4, -17);
  ctx.lineTo(-9.2, -2.6);
  ctx.quadraticCurveTo(0, -0.6, 9.2, -2.6);
  ctx.lineTo(6.4, -17);
  ctx.quadraticCurveTo(0, -18.6, -6.4, -17);
  ctx.closePath();
  paint(ctx, o, '#aab4c8', 0.75);
  ctx.beginPath();
  ctx.moveTo(-9.6, -4.6); ctx.quadraticCurveTo(0, -2.6, 9.6, -4.6);
  ctx.lineTo(9.2, -2.4); ctx.quadraticCurveTo(0, -0.4, -9.2, -2.4);
  ctx.closePath();
  paint(ctx, o, '#8d98b0', 0.6);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-4.4, -15.6); ctx.lineTo(-6.2, -6.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(27,34,64,.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-7.8, -10.4); ctx.quadraticCurveTo(0, -8.8, 7.8, -10.4); ctx.stroke();
});

HAT_DRAW.santa = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  const sw = Math.sin(time(o) * 3) * 1;
  ctx.beginPath();
  ctx.moveTo(-8.2, -4.6);
  ctx.quadraticCurveTo(-9.6, -15.4, -0.6, -16.4);
  ctx.quadraticCurveTo(7, -17, 11.6 + sw, -10.6);
  ctx.quadraticCurveTo(7.6, -9.6, 8.6, -4.6);
  ctx.closePath();
  paint(ctx, o, '#e0362c', 0.75);
  ctx.beginPath(); ctx.arc(11.8 + sw, -9.6, 3, 0, Math.PI * 2);
  paint(ctx, o, '#ffffff', 0.6);
  // fluffy trim
  ctx.beginPath();
  ctx.moveTo(-9.6, -4.2);
  ctx.bezierCurveTo(-11, -8.2, -6, -8.4, -4.8, -6.6);
  ctx.bezierCurveTo(-3.4, -8.6, 0.6, -8.6, 1.6, -6.6);
  ctx.bezierCurveTo(3, -8.6, 7, -8.6, 8, -6.6);
  ctx.bezierCurveTo(10, -8.4, 11, -4, 9.6, -2.6);
  ctx.quadraticCurveTo(0, -0.6, -9.6, -2.6);
  ctx.closePath();
  paint(ctx, o, '#ffffff', 0.7);
});

HAT_DRAW.fez = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.moveTo(-7.6, -3.6);
  ctx.lineTo(-5.6, -15);
  ctx.quadraticCurveTo(0, -16.6, 5.6, -15);
  ctx.lineTo(7.6, -3.6);
  ctx.quadraticCurveTo(0, -1.4, -7.6, -3.6);
  ctx.closePath();
  paint(ctx, o, '#c4272d', 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-4.6, -13); ctx.lineTo(-5.6, -6); ctx.stroke();
  // tassel
  const sw = Math.sin(time(o) * 4) * 1.4;
  ctx.strokeStyle = '#23283f'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -15.6); ctx.quadraticCurveTo(7, -17.6, 9.6, -12); ctx.lineTo(10 + sw, -6.6); ctx.stroke();
  ctx.fillStyle = '#f2b01e';
  ctx.beginPath(); ctx.arc(0, -15.8, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#23283f';
  ctx.fillRect(8.8 + sw, -7, 2.6, 4.4);
});

// ---------------------------------------------------------------- streak and endless hats
HAT_DRAW.headphones = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  ctx.beginPath();
  ctx.arc(-0.5, 0.4, 10, Math.PI * 1.02, Math.PI * 1.98);
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 1.7; ctx.stroke();
  ctx.strokeStyle = '#3a3f5c'; ctx.lineWidth = lwOf(o) * 0.95; ctx.stroke();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-4.6, -3.4, 8.2, 9.8, 3) : ctx.rect(-4.6, -3.4, 8.2, 9.8);
  paint(ctx, o, '#ff5d6f', 0.75);
  ctx.beginPath(); ctx.arc(-0.5, 1.5, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = '#3a3f5c'; ctx.fill();
  // music notes drift up
  const t = (time(o) * 0.9) % 1;
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = '#3a3f5c';
  ctx.beginPath(); ctx.arc(-1 + t * 3, -12 - t * 6, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-0.1 + t * 3, -16.6 - t * 6, 1, 4.6);
  ctx.globalAlpha = 1;
});

HAT_DRAW.samurai = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // neck guard
  ctx.beginPath();
  ctx.moveTo(-8.4, -2);
  ctx.lineTo(-13.4, 5.4);
  ctx.quadraticCurveTo(-6, 3.6, -3.4, 4.4);
  ctx.closePath();
  paint(ctx, o, '#8f2a2a', 0.6);
  // dome
  ctx.beginPath();
  ctx.arc(0, -0.4, 9.4, Math.PI, 0);
  ctx.lineTo(9.4, 1);
  ctx.lineTo(-9.4, 1);
  ctx.closePath();
  paint(ctx, o, '#4a4f6e', 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
  for (const x of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x * 1.1, -0.6); ctx.stroke(); }
  // gold brow plate and crescent crest
  ctx.beginPath();
  ctx.rect(-9.8, -2.4, 19.6, 3.4);
  paint(ctx, o, '#e0a21e', 0.6);
  ctx.beginPath();
  ctx.moveTo(-0.4, -8.6);
  ctx.quadraticCurveTo(-9, -15, -9, -19.6);
  ctx.quadraticCurveTo(-3.4, -14, 0.6, -13.4);
  ctx.quadraticCurveTo(4.6, -14, 10.4, -19.6);
  ctx.quadraticCurveTo(9.4, -14, 0.8, -8.6);
  ctx.closePath();
  paint(ctx, o, '#ffcf2e', 0.7);
});

HAT_DRAW.astronaut = (ctx, hx, hy, tilt, o) => withTilt(ctx, hx, hy, tilt, () => {
  // glass bubble
  ctx.beginPath(); ctx.arc(0, -0.4, 11.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(150,215,255,.28)'; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lwOf(o) * 1.5; ctx.stroke();
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 0.55; ctx.stroke();
  // reflection
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-0.4, -0.6, 8.6, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.4, -0.6, 8.6, Math.PI * 1.5, Math.PI * 1.56); ctx.stroke();
  // neck ring
  ctx.beginPath(); ctx.rect(-8.8, 6.2, 17.6, 3.6);
  paint(ctx, o, '#e6ebf7', 0.7);
  ctx.beginPath(); ctx.rect(-8.8, 7.4, 17.6, 1.2);
  ctx.fillStyle = '#ff6a5a'; ctx.fill();
  // antenna
  ctx.strokeStyle = o.col; ctx.lineWidth = lwOf(o) * 0.5;
  ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-9.4, -15.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(-9.6, -16.2, 1.6, 0, Math.PI * 2);
  paint(ctx, o, 0.5 + 0.5 * Math.sin(time(o) * 5) > 0.5 ? '#ff4d4d' : '#ffb0b0', 0.4);
});
