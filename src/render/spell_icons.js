// ICON_DRAW spell_<id>: bold doodle icons for the nine Supplies. Drawn in a 100x100 box,
// thick dark outline, one strong color each, readable at 48 px.
import { ICON_DRAW } from './icons.js';
import { INK, rrect } from './spellkit.js';
import { TAU } from '../core/util.js';

const W = 6; // outline width in the 100 box

function frame(ctx, s, fn) {
  ctx.save();
  ctx.scale(s / 100, s / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fn(ctx);
  ctx.restore();
}

function fs(c, fill, w = W) {
  c.fillStyle = fill;
  c.strokeStyle = INK;
  c.lineWidth = w;
  c.fill();
  c.stroke();
}

// outlined thick stroke (dark under, color over)
function fat(c, col, w, path) {
  c.beginPath(); path(c);
  c.strokeStyle = INK; c.lineWidth = w + 5; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}

function pencil(c, x, y, rot, len = 56) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  // tip points down (+y)
  c.beginPath(); c.moveTo(0, len / 2 + 12); c.lineTo(-8, len / 2 - 6); c.lineTo(8, len / 2 - 6); c.closePath(); fs(c, '#f5d7b0', 4.5);
  c.beginPath(); c.moveTo(0, len / 2 + 12); c.lineTo(-3.2, len / 2 + 3); c.lineTo(3.2, len / 2 + 3); c.closePath(); c.fillStyle = INK; c.fill();
  c.beginPath(); rrect(c, -8, -len / 2, 16, len - 6, 2); fs(c, '#ffd21f', 4.5);
  c.strokeStyle = '#c99a00'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-0.5, -len / 2 + 5); c.lineTo(-0.5, len / 2 - 12); c.stroke();
  c.beginPath(); rrect(c, -8, -len / 2 - 13, 16, 13, 4); fs(c, '#ff8fa3', 4.5);
  c.beginPath(); c.rect(-8, -len / 2 - 2, 16, 6); fs(c, '#c7ccdb', 3.5);
  c.restore();
}

ICON_DRAW.spell_pencil_rain = (ctx, s) => frame(ctx, s, (c) => {
  c.strokeStyle = '#4aa8ff'; c.lineWidth = 5;
  for (const [x, y] of [[20, 6], [48, 14], [76, 4]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y + 14); c.stroke(); }
  pencil(c, 26, 38, 0.32);
  pencil(c, 78, 38, 0.32);
  pencil(c, 52, 46, 0.32, 64);
  c.strokeStyle = INK; c.lineWidth = 5;
  c.beginPath(); c.moveTo(8, 92); c.lineTo(30, 92); c.moveTo(40, 92); c.lineTo(62, 92); c.moveTo(72, 92); c.lineTo(92, 92); c.stroke();
});

ICON_DRAW.spell_coffee_spill = (ctx, s) => frame(ctx, s, (c) => {
  // puddle
  c.beginPath(); c.moveTo(10, 84); c.bezierCurveTo(8, 70, 40, 68, 56, 72); c.bezierCurveTo(80, 66, 96, 76, 92, 86); c.bezierCurveTo(80, 96, 24, 96, 10, 84); fs(c, '#7a4520');
  c.strokeStyle = 'rgba(255,235,200,.6)'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(24, 82); c.quadraticCurveTo(36, 76, 48, 79); c.stroke();
  // pour
  c.beginPath(); c.moveTo(60, 46); c.quadraticCurveTo(70, 52, 72, 72); c.lineTo(62, 72); c.quadraticCurveTo(58, 56, 52, 50); c.closePath(); fs(c, '#7a4520', 4);
  // tipped mug
  c.save();
  c.translate(40, 34); c.rotate(1.75);
  c.beginPath(); c.ellipse(24, 0, 12, 14, 0, -1.6, 1.6); c.strokeStyle = INK; c.lineWidth = 11; c.stroke(); c.strokeStyle = '#f4ede2'; c.lineWidth = 5; c.stroke();
  c.beginPath(); c.moveTo(-20, -22); c.lineTo(20, -22); c.lineTo(17, 22); c.quadraticCurveTo(0, 29, -17, 22); c.closePath(); fs(c, '#f4ede2');
  c.beginPath(); c.moveTo(-19, -4); c.lineTo(19, -4); c.lineTo(18, 9); c.lineTo(-18, 9); c.closePath(); c.fillStyle = '#c9762c'; c.fill();
  c.beginPath(); c.ellipse(0, -22, 20, 6, 0, 0, TAU); fs(c, '#7a4520', 4);
  c.restore();
  // drops
  c.fillStyle = '#7a4520'; c.strokeStyle = INK; c.lineWidth = 3;
  for (const [x, y, r] of [[82, 58, 4.5], [90, 70, 3.2], [20, 62, 3.6]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); }
});

ICON_DRAW.spell_ruler_smash = (ctx, s) => frame(ctx, s, (c) => {
  // impact burst
  c.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 14 : 28; const a = (i / 16) * TAU; c.lineTo(66 + Math.cos(a) * r, 78 + Math.sin(a) * r * 0.6); }
  c.closePath(); fs(c, '#fff3b0', 4);
  // ruler
  c.save(); c.translate(48, 40); c.rotate(-0.5);
  c.beginPath(); rrect(c, -50, -14, 100, 28, 4); fs(c, '#ff9f1c');
  c.strokeStyle = INK; c.lineWidth = 3.5; c.beginPath();
  for (let i = 0; i < 9; i++) { const x = -42 + i * 10.5; c.moveTo(x, 14); c.lineTo(x, i % 2 ? 7 : 0); }
  c.stroke();
  c.restore();
  // motion lines
  c.strokeStyle = INK; c.lineWidth = 4.5;
  c.beginPath(); c.moveTo(12, 8); c.lineTo(22, 20); c.moveTo(30, 4); c.lineTo(36, 14); c.stroke();
});

ICON_DRAW.spell_paper_planes = (ctx, s) => frame(ctx, s, (c) => {
  const plane = (x, y, sc, rot, shade) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc);
    c.beginPath(); c.moveTo(-30, -2); c.lineTo(36, 2); c.lineTo(-20, -20); c.closePath(); fs(c, '#a8d4ff', 5);
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(38, 2); c.lineTo(-16, 18); c.closePath(); fs(c, shade, 5);
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(38, 2); c.lineTo(-24, 7); c.closePath(); fs(c, '#2f8de8', 4);
    c.restore();
  };
  c.strokeStyle = '#2f8de8'; c.lineWidth = 4; c.setLineDash([6, 7]);
  c.beginPath(); c.moveTo(4, 78); c.quadraticCurveTo(24, 60, 38, 62); c.stroke();
  c.beginPath(); c.moveTo(6, 40); c.quadraticCurveTo(20, 28, 34, 30); c.stroke();
  c.setLineDash([]);
  plane(38, 24, 0.55, -0.12, '#ffffff');
  plane(54, 62, 0.95, -0.12, '#ffffff');
  // bomb
  c.beginPath(); c.arc(58, 88, 7, 0, TAU); fs(c, '#1f47c2', 4.5);
});

ICON_DRAW.spell_sticky_wall = (ctx, s) => frame(ctx, s, (c) => {
  const note = (x, y, rot, col) => {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); rrect(c, -28, -26, 56, 52, 4); fs(c, col, 5);
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-24, -22, 48, 8);
    c.restore();
  };
  note(34, 70, -0.1, '#6fd68a');
  note(66, 64, 0.08, '#6fd68a');
  note(40, 38, 0.06, '#8be3a0');
  note(68, 30, -0.07, '#8be3a0');
  // front note with scribbles and a curl
  c.save(); c.translate(50, 50); c.rotate(-0.05);
  c.beginPath(); c.moveTo(-30, -28); c.lineTo(30, -28); c.lineTo(30, 14); c.lineTo(12, 30); c.lineTo(-30, 30); c.closePath(); fs(c, '#4cc46c', 5);
  c.beginPath(); c.moveTo(30, 14); c.lineTo(12, 30); c.lineTo(14, 12); c.closePath(); fs(c, '#d8f5e0', 4);
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(-20, -12); c.lineTo(18, -12); c.moveTo(-20, 2); c.lineTo(8, 2); c.moveTo(-20, 16); c.lineTo(-4, 16); c.stroke();
  c.restore();
});

ICON_DRAW.spell_stapler = (ctx, s) => frame(ctx, s, (c) => {
  // base
  c.beginPath(); rrect(c, 8, 62, 84, 16, 7); fs(c, '#b7bfd1');
  // arm
  c.save(); c.translate(14, 62); c.rotate(-0.22);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(76, 0); c.quadraticCurveTo(88, 0, 86, -12); c.quadraticCurveTo(80, -28, 62, -29); c.lineTo(10, -29); c.quadraticCurveTo(-6, -29, -6, -12); c.closePath(); fs(c, '#e8352b');
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.beginPath(); c.moveTo(8, -21); c.lineTo(58, -21); c.stroke();
  c.restore();
  // staple falling
  c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.moveTo(60, 86); c.lineTo(60, 80); c.lineTo(84, 80); c.lineTo(84, 90); c.stroke();
  c.strokeStyle = '#e6ebf7'; c.lineWidth = 5.5; c.beginPath(); c.moveTo(60, 86); c.lineTo(60, 80); c.lineTo(84, 80); c.lineTo(84, 90); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(26, 8); c.lineTo(26, 20); c.moveTo(14, 12); c.lineTo(14, 20); c.stroke();
});

ICON_DRAW.spell_highlighter = (ctx, s) => frame(ctx, s, (c) => {
  // yellow stroke
  c.beginPath(); c.moveTo(8, 86); c.lineTo(14, 66); c.lineTo(92, 70); c.lineTo(86, 90); c.closePath(); fs(c, '#fff04d', 5);
  c.strokeStyle = 'rgba(200,150,0,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(24, 76); c.lineTo(78, 79); c.stroke();
  // pen
  c.save(); c.translate(62, 62); c.rotate(0.65);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -20); c.lineTo(10, -22); c.closePath(); fs(c, '#fff04d', 5);
  c.beginPath(); rrect(c, -13, -62, 26, 44, 6); fs(c, '#ee4fd5');
  c.beginPath(); rrect(c, -13, -86, 26, 26, 6); fs(c, '#2a2f55');
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-5, -52); c.lineTo(-5, -28); c.stroke();
  c.restore();
  // sparkles
  c.fillStyle = '#fff04d'; c.strokeStyle = INK; c.lineWidth = 3;
  for (const [x, y, r] of [[18, 24, 9], [34, 12, 6]]) {
    c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.35 : r; const a = (i / 8) * TAU; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke();
  }
});

ICON_DRAW.spell_doodle_drop = (ctx, s) => frame(ctx, s, (c) => {
  // dashed ground ring
  c.strokeStyle = '#7a5cf0'; c.lineWidth = 5; c.setLineDash([9, 8]);
  c.beginPath(); c.ellipse(50, 86, 38, 9, 0, 0, TAU); c.stroke(); c.setLineDash([]);
  // stick figure doodle
  fat(c, '#7a5cf0', 7, (p) => { p.moveTo(46, 38); p.lineTo(46, 62); });
  fat(c, '#7a5cf0', 7, (p) => { p.moveTo(46, 46); p.lineTo(32, 56); p.moveTo(46, 46); p.lineTo(62, 40); });
  fat(c, '#7a5cf0', 7, (p) => { p.moveTo(46, 62); p.lineTo(36, 82); p.moveTo(46, 62); p.lineTo(58, 82); });
  c.beginPath(); c.arc(46, 26, 12, 0, TAU); fs(c, '#ffffff', 5);
  // sword line
  fat(c, '#c8ccdc', 4, (p) => { p.moveTo(62, 40); p.lineTo(76, 22); });
  // pencil drawing it
  pencil(c, 80, 40, -2.4, 40);
  c.fillStyle = '#7a5cf0'; c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath(); c.arc(14, 24, 4, 0, TAU); c.fill(); c.stroke();
});

ICON_DRAW.spell_eraser = (ctx, s) => frame(ctx, s, (c) => {
  // rub marks
  c.strokeStyle = '#ffb3c4'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(8, 90); c.quadraticCurveTo(50, 80, 92, 90); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 4; c.setLineDash([2, 9]);
  c.beginPath(); c.moveTo(10, 96); c.lineTo(90, 96); c.stroke(); c.setLineDash([]);
  // block
  c.save(); c.translate(50, 54); c.rotate(-0.18);
  c.beginPath(); rrect(c, -40, -26, 80, 52, 10); fs(c, '#ff7f9c');
  c.beginPath(); c.rect(-14, -26, 30, 52); fs(c, '#3a74e6', 5);
  c.fillStyle = '#fff'; c.font = "bold 15px 'Permanent Marker', cursive"; c.textAlign = 'center'; c.fillText('E', 1, 6);
  c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-34, -17); c.lineTo(-22, -17); c.stroke();
  c.restore();
  // crumbs
  c.fillStyle = '#ffb3c4'; c.strokeStyle = INK; c.lineWidth = 2.5;
  for (const [x, y] of [[10, 70], [22, 82], [84, 72], [92, 84], [74, 88]]) { c.beginPath(); c.rect(x - 4, y - 3, 8, 6); c.fill(); c.stroke(); }
});
