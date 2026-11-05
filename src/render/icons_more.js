// Menu, upgrade, currency and achievement icons. Bold doodles: thick dark outline, one strong
// color. Every icon is drawn in a 100x100 design space and scaled to the requested size.
import { ICON_DRAW, ICON_FALLBACK } from './icons.js';

const DARK = '#1b2240';

// Registers ICON_DRAW[name] as fn(ctx) in 100-unit space with a thick round outline.
function def(name, fn) {
  ICON_DRAW[name] = (ctx, s) => {
    ctx.save();
    ctx.scale(s / 100, s / 100);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = DARK;
    fn(ctx);
    ctx.restore();
  };
}

const fillStroke = (ctx, col) => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
const circle = (ctx, x, y, r, col) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (col) fillStroke(ctx, col); else ctx.stroke(); };
const rrect = (ctx, x, y, w, h, r, col) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (col) fillStroke(ctx, col);
};
const line = (ctx, x1, y1, x2, y2, w) => {
  if (w) ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
};
const shine = (ctx, x, y, w, h) => {
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x, y, w, h, -0.5, 0, 7); ctx.fill(); ctx.restore();
};

// ---------------------------------------------------------------- fort upgrades
def('upgrade_walls', (ctx) => {
  ctx.beginPath();
  ctx.moveTo(10, 88); ctx.lineTo(10, 32); ctx.lineTo(25, 32); ctx.lineTo(25, 40); ctx.lineTo(37, 40); ctx.lineTo(37, 32);
  ctx.lineTo(63, 32); ctx.lineTo(63, 40); ctx.lineTo(75, 40); ctx.lineTo(75, 32); ctx.lineTo(90, 32); ctx.lineTo(90, 88);
  ctx.closePath();
  fillStroke(ctx, '#ff9a47');
  ctx.lineWidth = 3.5;
  line(ctx, 10, 56, 90, 56); line(ctx, 10, 72, 90, 72);
  line(ctx, 30, 56, 30, 72); line(ctx, 62, 56, 62, 72); line(ctx, 46, 72, 46, 88); line(ctx, 78, 72, 78, 88); line(ctx, 18, 72, 18, 88);
  line(ctx, 46, 40, 46, 56); line(ctx, 74, 40, 74, 56); line(ctx, 18, 40, 18, 56);
});
def('upgrade_turret', (ctx) => {
  poly(ctx, [[30, 90], [36, 40], [64, 40], [70, 90]]); fillStroke(ctx, '#5b8cff');
  ctx.beginPath(); ctx.moveTo(28, 40); ctx.lineTo(28, 22); ctx.lineTo(38, 22); ctx.lineTo(38, 30); ctx.lineTo(46, 30); ctx.lineTo(46, 22);
  ctx.lineTo(54, 22); ctx.lineTo(54, 30); ctx.lineTo(62, 30); ctx.lineTo(62, 22); ctx.lineTo(72, 22); ctx.lineTo(72, 40); ctx.closePath();
  fillStroke(ctx, '#7aa2ff');
  rrect(ctx, 45, 52, 10, 18, 4, DARK);
  line(ctx, 72, 52, 94, 40, 5); poly(ctx, [[94, 40], [86, 38], [88, 46]]); ctx.fillStyle = '#d1342b'; ctx.fill();
});
def('upgrade_income', (ctx) => {
  rrect(ctx, 16, 78, 68, 12, 4, '#8a5cff');
  line(ctx, 50, 20, 50, 70, 8);
  line(ctx, 30, 24, 70, 24, 8);
  rrect(ctx, 28, 62, 44, 14, 4, '#c7b2ff');
  ctx.beginPath(); ctx.moveTo(80, 28); ctx.quadraticCurveTo(92, 44, 86, 52); ctx.arc(80, 52, 6, 0, Math.PI); ctx.quadraticCurveTo(68, 44, 80, 28); fillStroke(ctx, '#1f47c2');
});
def('upgrade_start_ink', (ctx) => {
  rrect(ctx, 42, 12, 16, 12, 3, '#d9a066');
  poly(ctx, [[40, 24], [60, 24], [60, 36], [76, 52], [76, 82], [24, 82], [24, 52], [40, 36]]); fillStroke(ctx, '#e6f0ff');
  ctx.save(); ctx.beginPath(); ctx.rect(20, 56, 60, 30); ctx.clip();
  poly(ctx, [[40, 24], [60, 24], [60, 36], [76, 52], [76, 82], [24, 82], [24, 52], [40, 36]]); ctx.fillStyle = '#1f47c2'; ctx.fill(); ctx.restore();
  poly(ctx, [[40, 24], [60, 24], [60, 36], [76, 52], [76, 82], [24, 82], [24, 52], [40, 36]]); ctx.stroke();
  shine(ctx, 36, 70, 4, 8);
  line(ctx, 82, 14, 82, 30, 5); line(ctx, 74, 22, 90, 22, 5);
});
def('upgrade_scribes', (ctx) => {
  circle(ctx, 40, 28, 14, '#fff');
  line(ctx, 40, 42, 40, 70, 6); line(ctx, 40, 70, 26, 90, 6); line(ctx, 40, 70, 54, 90, 6); line(ctx, 40, 52, 58, 62, 6);
  ctx.beginPath(); ctx.moveTo(24, 20); ctx.quadraticCurveTo(40, 4, 56, 20); ctx.closePath(); fillStroke(ctx, '#3fbf4f');
  ctx.beginPath(); ctx.moveTo(60, 70); ctx.quadraticCurveTo(70, 20, 92, 14); ctx.quadraticCurveTo(88, 52, 60, 70); fillStroke(ctx, '#a6ee9a');
  line(ctx, 60, 70, 82, 30, 3.5);
});
def('upgrade_pop', (ctx) => {
  poly(ctx, [[10, 88], [50, 26], [90, 88]]); fillStroke(ctx, '#ff7aa8');
  poly(ctx, [[38, 88], [50, 56], [62, 88]]); ctx.fillStyle = DARK; ctx.fill();
  line(ctx, 50, 26, 50, 8, 5);
  poly(ctx, [[50, 8], [72, 14], [50, 22]]); fillStroke(ctx, '#f2b01e');
  ctx.lineWidth = 3.5; line(ctx, 22, 70, 78, 70);
});
def('upgrade_wells', (ctx) => {
  poly(ctx, [[14, 36], [50, 10], [86, 36]]); fillStroke(ctx, '#d1342b');
  line(ctx, 24, 36, 24, 60, 7); line(ctx, 76, 36, 76, 60, 7);
  line(ctx, 50, 36, 50, 50, 4); rrect(ctx, 43, 50, 14, 12, 3, '#d9a066');
  rrect(ctx, 14, 58, 72, 32, 6, '#c9c3b6');
  ctx.beginPath(); ctx.ellipse(50, 62, 30, 7, 0, 0, 7); fillStroke(ctx, '#3ec6ff');
  ctx.lineWidth = 3.5; line(ctx, 14, 76, 86, 76); line(ctx, 36, 69, 36, 76); line(ctx, 64, 69, 64, 76); line(ctx, 50, 76, 50, 90);
});

// ---------------------------------------------------------------- menu
def('menu_campaign', (ctx) => {
  ctx.beginPath(); ctx.moveTo(10, 24); ctx.lineTo(34, 16); ctx.lineTo(66, 24); ctx.lineTo(90, 16); ctx.lineTo(90, 76); ctx.lineTo(66, 84); ctx.lineTo(34, 76); ctx.lineTo(10, 84); ctx.closePath();
  fillStroke(ctx, '#ffd98a');
  ctx.lineWidth = 3.5; line(ctx, 34, 16, 34, 76); line(ctx, 66, 24, 66, 84);
  ctx.save(); ctx.setLineDash([5, 7]); ctx.lineWidth = 4.5; ctx.strokeStyle = '#1f47c2';
  ctx.beginPath(); ctx.moveTo(18, 66); ctx.quadraticCurveTo(34, 40, 50, 56); ctx.quadraticCurveTo(62, 66, 74, 38); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#d1342b'; ctx.lineWidth = 8; line(ctx, 70, 30, 82, 44); line(ctx, 82, 30, 70, 44);
});
def('menu_endless', (ctx) => {
  const path = () => {
    ctx.beginPath(); ctx.moveTo(50, 50);
    ctx.bezierCurveTo(60, 30, 92, 28, 92, 50); ctx.bezierCurveTo(92, 72, 60, 70, 50, 50);
    ctx.bezierCurveTo(40, 30, 8, 28, 8, 50); ctx.bezierCurveTo(8, 72, 40, 70, 50, 50);
  };
  ctx.lineWidth = 24; path(); ctx.stroke();
  ctx.lineWidth = 13; ctx.strokeStyle = '#4fa3ff'; path(); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(18, 40); ctx.quadraticCurveTo(26, 34, 34, 38); ctx.stroke();
});
def('menu_daily', (ctx) => {
  rrect(ctx, 12, 20, 76, 68, 9, '#fff');
  ctx.save(); rrect(ctx, 12, 20, 76, 22, 9); ctx.clip(); ctx.fillStyle = '#d1342b'; ctx.fillRect(0, 0, 100, 42); ctx.restore();
  rrect(ctx, 12, 20, 76, 68, 9); ctx.stroke(); line(ctx, 12, 42, 88, 42, 5);
  line(ctx, 30, 10, 30, 28, 7); line(ctx, 70, 10, 70, 28, 7);
  ctx.strokeStyle = '#2bb24c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(32, 66); ctx.lineTo(45, 77); ctx.lineTo(70, 53); ctx.stroke();
});
def('menu_armory', (ctx) => {
  ctx.beginPath(); ctx.moveTo(18, 22); ctx.lineTo(50, 14); ctx.lineTo(82, 22); ctx.lineTo(82, 52); ctx.quadraticCurveTo(82, 78, 50, 92); ctx.quadraticCurveTo(18, 78, 18, 52); ctx.closePath(); fillStroke(ctx, '#4fa3ff');
  ctx.beginPath(); ctx.moveTo(50, 14); ctx.lineTo(82, 22); ctx.lineTo(82, 52); ctx.quadraticCurveTo(82, 78, 50, 92); ctx.closePath(); ctx.fillStyle = 'rgba(31,71,194,.55)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(18, 22); ctx.lineTo(50, 14); ctx.lineTo(82, 22); ctx.lineTo(82, 52); ctx.quadraticCurveTo(82, 78, 50, 92); ctx.quadraticCurveTo(18, 78, 18, 52); ctx.closePath(); ctx.stroke();
  poly(ctx, [[50, 30], [56, 46], [72, 46], [59, 56], [64, 72], [50, 62], [36, 72], [41, 56], [28, 46], [44, 46]]); fillStroke(ctx, '#ffe56b');
});
def('menu_captain', (ctx) => {
  circle(ctx, 50, 62, 26, '#fff');
  circle(ctx, 41, 62, 3.5, DARK); circle(ctx, 59, 62, 3.5, DARK);
  ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(50, 68, 10, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 46); ctx.quadraticCurveTo(50, 36, 90, 46); ctx.quadraticCurveTo(80, 30, 66, 14); ctx.quadraticCurveTo(50, 22, 34, 14); ctx.quadraticCurveTo(20, 30, 10, 46); ctx.closePath(); fillStroke(ctx, '#2b3566');
  circle(ctx, 50, 32, 6, '#f2b01e');
});
def('menu_trophy', (ctx) => {
  ctx.beginPath(); ctx.moveTo(26, 14); ctx.lineTo(74, 14); ctx.quadraticCurveTo(74, 58, 50, 62); ctx.quadraticCurveTo(26, 58, 26, 14); fillStroke(ctx, '#f2b01e');
  ctx.beginPath(); ctx.moveTo(26, 24); ctx.quadraticCurveTo(6, 24, 12, 40); ctx.quadraticCurveTo(16, 48, 28, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(74, 24); ctx.quadraticCurveTo(94, 24, 88, 40); ctx.quadraticCurveTo(84, 48, 72, 48); ctx.stroke();
  line(ctx, 50, 62, 50, 76, 8); rrect(ctx, 28, 76, 44, 14, 4, '#9a6a00');
  shine(ctx, 38, 30, 4, 11);
});
def('menu_settings', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = i % 2 ? 31 : 42;
    const a2 = ((i + 0.5) / 16) * Math.PI * 2;
    ctx.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r);
    ctx.lineTo(50 + Math.cos(a2) * r, 50 + Math.sin(a2) * r);
  }
  ctx.closePath(); fillStroke(ctx, '#9db4d9');
  circle(ctx, 50, 50, 14, '#fff');
});
def('lock', (ctx) => {
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(30, 46); ctx.lineTo(30, 32); ctx.arc(50, 32, 20, Math.PI, 0); ctx.lineTo(70, 46); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = '#9db4d9'; ctx.beginPath(); ctx.moveTo(30, 46); ctx.lineTo(30, 32); ctx.arc(50, 32, 20, Math.PI, 0); ctx.lineTo(70, 46); ctx.stroke(); ctx.strokeStyle = DARK;
  rrect(ctx, 18, 44, 64, 44, 10, '#f2b01e');
  circle(ctx, 50, 62, 6, DARK); line(ctx, 50, 64, 50, 76, 6);
});
def('crate', (ctx) => {
  rrect(ctx, 10, 26, 80, 62, 6, '#d9a066');
  ctx.save(); rrect(ctx, 10, 26, 80, 62, 6); ctx.clip();
  ctx.lineWidth = 3.5; line(ctx, 10, 48, 90, 48); line(ctx, 10, 68, 90, 68);
  ctx.strokeStyle = 'rgba(27,34,64,.25)'; ctx.lineWidth = 2; line(ctx, 22, 34, 40, 34); line(ctx, 60, 56, 80, 56); ctx.restore();
  rrect(ctx, 10, 26, 80, 62, 6); ctx.stroke();
  rrect(ctx, 6, 18, 88, 16, 5, '#e8b87a');
  rrect(ctx, 42, 18, 16, 70, 3, '#d1342b');
  circle(ctx, 50, 54, 7, '#ffe56b');
});
def('arrow_left', (ctx) => {
  poly(ctx, [[12, 50], [44, 18], [44, 38], [88, 38], [88, 62], [44, 62], [44, 82]]); fillStroke(ctx, '#fff');
});
def('arrow_right', (ctx) => {
  poly(ctx, [[88, 50], [56, 18], [56, 38], [12, 38], [12, 62], [56, 62], [56, 82]]); fillStroke(ctx, '#fff');
});
def('check', (ctx) => {
  ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(20, 54); ctx.lineTo(42, 76); ctx.lineTo(82, 28); ctx.stroke();
  ctx.lineWidth = 10; ctx.strokeStyle = '#2bb24c'; ctx.beginPath(); ctx.moveTo(20, 54); ctx.lineTo(42, 76); ctx.lineTo(82, 28); ctx.stroke();
});
def('heart', (ctx) => {
  ctx.beginPath(); ctx.moveTo(50, 86); ctx.bezierCurveTo(6, 56, 8, 22, 30, 20); ctx.bezierCurveTo(42, 19, 48, 28, 50, 34);
  ctx.bezierCurveTo(52, 28, 58, 19, 70, 20); ctx.bezierCurveTo(92, 22, 94, 56, 50, 86); fillStroke(ctx, '#ff5a6e'); shine(ctx, 32, 36, 5, 9);
});
def('sword', (ctx) => {
  poly(ctx, [[74, 10], [90, 10], [90, 26], [44, 72], [34, 62]]); fillStroke(ctx, '#e6ecf5');
  line(ctx, 24, 56, 50, 82, 9);
  line(ctx, 30, 70, 12, 88, 9);
});
def('flame', (ctx) => {
  ctx.beginPath(); ctx.moveTo(50, 8); ctx.bezierCurveTo(54, 30, 84, 38, 80, 66); ctx.bezierCurveTo(78, 86, 62, 92, 50, 92); ctx.bezierCurveTo(30, 92, 18, 78, 22, 60);
  ctx.bezierCurveTo(24, 50, 30, 44, 32, 36); ctx.bezierCurveTo(40, 44, 42, 48, 44, 50); ctx.bezierCurveTo(46, 38, 46, 22, 50, 8); fillStroke(ctx, '#ff7a1a');
  ctx.beginPath(); ctx.moveTo(50, 50); ctx.bezierCurveTo(60, 62, 66, 70, 58, 82); ctx.bezierCurveTo(54, 86, 44, 86, 42, 78); ctx.bezierCurveTo(40, 68, 48, 62, 50, 50); ctx.fillStyle = '#ffe56b'; ctx.fill();
});
def('skull', (ctx) => {
  ctx.beginPath(); ctx.moveTo(50, 10); ctx.bezierCurveTo(14, 10, 12, 52, 28, 62); ctx.lineTo(28, 84); ctx.lineTo(72, 84); ctx.lineTo(72, 62); ctx.bezierCurveTo(88, 52, 86, 10, 50, 10); fillStroke(ctx, '#f4f1e6');
  circle(ctx, 36, 44, 9, DARK); circle(ctx, 64, 44, 9, DARK); poly(ctx, [[50, 54], [45, 64], [55, 64]]); ctx.fillStyle = DARK; ctx.fill();
  ctx.lineWidth = 4; line(ctx, 40, 84, 40, 72); line(ctx, 50, 84, 50, 72); line(ctx, 60, 84, 60, 72);
});
def('crown', (ctx) => {
  poly(ctx, [[10, 78], [10, 28], [32, 50], [50, 18], [68, 50], [90, 28], [90, 78]]); fillStroke(ctx, '#f2b01e');
  circle(ctx, 10, 26, 6, '#ff5a6e'); circle(ctx, 50, 16, 6, '#4fa3ff'); circle(ctx, 90, 26, 6, '#ff5a6e');
  rrect(ctx, 10, 70, 80, 14, 4, '#c98a00');
});
def('plus', (ctx) => { ctx.lineWidth = 16; line(ctx, 50, 18, 50, 82); line(ctx, 18, 50, 82, 50); ctx.lineWidth = 9; ctx.strokeStyle = '#fff'; line(ctx, 50, 18, 50, 82); line(ctx, 18, 50, 82, 50); });
def('star_red', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 20 : 45, a = -Math.PI / 2 + (i / 10) * Math.PI * 2; ctx.lineTo(50 + Math.cos(a) * r, 54 + Math.sin(a) * r); }
  ctx.closePath(); fillStroke(ctx, '#ff4d4d');
});
def('pen_red', (ctx) => {
  poly(ctx, [[14, 86], [20, 62], [70, 12], [88, 30], [38, 80]]); fillStroke(ctx, '#ff5a6e');
  poly(ctx, [[14, 86], [20, 62], [38, 80]]); fillStroke(ctx, '#f6d9b0');
  line(ctx, 62, 20, 80, 38, 4); circle(ctx, 16, 84, 3, DARK);
});

// ---------------------------------------------------------------- achievement glyphs (on a round badge)
function badge(ctx, col) {
  circle(ctx, 50, 50, 44, col);
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(50, 50, 36, Math.PI * 1.1, Math.PI * 1.65); ctx.stroke(); ctx.restore();
}
function glyph(name, col, fn) {
  def('ach_' + name, (ctx) => { badge(ctx, col); ctx.save(); ctx.translate(18, 18); ctx.scale(0.64, 0.64); fn(ctx); ctx.restore(); });
}
glyph('sword', '#93d1ff', (c) => ICON_DRAW.sword(c, 100));
glyph('skull', '#ff9cc6', (c) => ICON_DRAW.skull(c, 100));
glyph('drop', '#c7b2ff', (c) => ICON_DRAW.ink(c, 100));
glyph('crowd', '#a6ee9a', (c) => {
  for (const [x, y, k] of [[26, 50, 0.8], [74, 50, 0.8], [50, 52, 1]]) {
    circle(c, x, y - 18 * k, 9 * k, '#fff'); line(c, x, y - 8 * k, x, y + 18 * k, 6); line(c, x - 10 * k, y + 38 * k, x, y + 18 * k, 6); line(c, x + 10 * k, y + 38 * k, x, y + 18 * k, 6);
  }
});
glyph('shield', '#93d1ff', (c) => ICON_DRAW.menu_armory(c, 100));
glyph('clock', '#ffbd6b', (c) => { circle(c, 50, 54, 36, '#fff'); line(c, 50, 54, 50, 30, 7); line(c, 50, 54, 68, 62, 7); line(c, 40, 10, 60, 10, 8); line(c, 50, 10, 50, 18, 6); });
glyph('cup', '#ffbd6b', (c) => {
  c.beginPath(); c.moveTo(18, 30); c.lineTo(66, 30); c.lineTo(62, 78); c.quadraticCurveTo(42, 90, 22, 78); c.closePath(); fillStroke(c, '#fff');
  c.beginPath(); c.moveTo(66, 40); c.quadraticCurveTo(92, 40, 84, 62); c.quadraticCurveTo(80, 68, 64, 68); c.stroke();
  c.save(); c.beginPath(); c.moveTo(20, 40); c.lineTo(64, 40); c.lineTo(61, 76); c.quadraticCurveTo(42, 86, 24, 76); c.closePath(); c.fillStyle = '#8a5a2b'; c.fill(); c.restore();
  c.lineWidth = 4; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(30, 20); c.quadraticCurveTo(24, 10, 32, 4); c.moveTo(46, 20); c.quadraticCurveTo(40, 10, 48, 4); c.stroke();
});
glyph('horse', '#f2b01e', (c) => {
  c.lineWidth = 16; c.beginPath(); c.moveTo(22, 14); c.lineTo(22, 60); c.arc(50, 60, 28, Math.PI, 0, true); c.lineTo(78, 14); c.stroke();
  c.lineWidth = 8; c.strokeStyle = '#e6ecf5'; c.beginPath(); c.moveTo(22, 14); c.lineTo(22, 60); c.arc(50, 60, 28, Math.PI, 0, true); c.lineTo(78, 14); c.stroke();
  c.fillStyle = DARK; for (const y of [26, 44]) { circle(c, 22, y, 3, DARK); circle(c, 78, y, 3, DARK); }
});
glyph('bomb', '#ff9cc6', (c) => {
  circle(c, 46, 58, 32, '#2b3566'); shine(c, 34, 46, 6, 10);
  c.lineWidth = 7; c.beginPath(); c.moveTo(60, 30); c.quadraticCurveTo(72, 18, 80, 24); c.stroke();
  poly(c, [[82, 14], [86, 26], [96, 22], [88, 32], [96, 40], [84, 36], [80, 48], [78, 34], [68, 32], [78, 26]]); fillStroke(c, '#ffe56b');
});
glyph('quill', '#a6ee9a', (c) => { ICON_DRAW.upgrade_scribes(c, 100); });
glyph('wing', '#93d1ff', (c) => {
  c.beginPath(); c.moveTo(14, 70); c.quadraticCurveTo(10, 30, 50, 14); c.quadraticCurveTo(70, 8, 90, 16); c.quadraticCurveTo(80, 40, 70, 48); c.quadraticCurveTo(60, 44, 54, 52); c.quadraticCurveTo(48, 56, 40, 64); c.quadraticCurveTo(30, 66, 26, 78); c.closePath(); fillStroke(c, '#fff');
  c.lineWidth = 3.5; line(c, 34, 50, 62, 26); line(c, 28, 62, 70, 36);
});
glyph('cross', '#ff9cc6', (c) => ICON_DRAW.heart(c, 100));
glyph('crown', '#ffbd6b', (c) => ICON_DRAW.crown(c, 100));
glyph('boss', '#ff9cc6', (c) => ICON_DRAW.skull(c, 100));
glyph('star', '#ffe56b', (c) => ICON_DRAW.star(c, 100));
glyph('flame', '#ffbd6b', (c) => ICON_DRAW.flame(c, 100));
glyph('infinity', '#93d1ff', (c) => ICON_DRAW.menu_endless(c, 100));
glyph('calendar', '#a6ee9a', (c) => ICON_DRAW.menu_daily(c, 100));
glyph('anvil', '#c7b2ff', (c) => {
  c.beginPath(); c.moveTo(10, 30); c.lineTo(90, 30); c.quadraticCurveTo(80, 52, 62, 52); c.lineTo(62, 66); c.lineTo(76, 80); c.lineTo(76, 90); c.lineTo(24, 90); c.lineTo(24, 80); c.lineTo(38, 66); c.lineTo(38, 52); c.quadraticCurveTo(18, 52, 10, 30); c.closePath(); fillStroke(c, '#9db4d9');
  shine(c, 30, 38, 5, 3);
});
glyph('hat', '#c7b2ff', (c) => ICON_DRAW.menu_captain(c, 100));

// ---------------------------------------------------------------- fallbacks for icons other packages own
// Used only when a spell_<id> / ability_<id> icon has not been drawn, so menus never show blanks.
const SPELL_COLORS = ['#ff9cc6', '#ffbd6b', '#93d1ff', '#a6ee9a', '#c7b2ff', '#ffe56b'];
ICON_FALLBACK.spell = (ctx, s, name) => {
  let hsh = 0;
  for (let i = 0; i < name.length; i++) hsh = (hsh * 31 + name.charCodeAt(i)) >>> 0;
  ctx.save(); ctx.scale(s / 100, s / 100); ctx.lineWidth = 6; ctx.strokeStyle = DARK; ctx.lineJoin = 'round';
  rrect(ctx, 14, 14, 72, 72, 12, SPELL_COLORS[hsh % SPELL_COLORS.length]);
  poly(ctx, [[50, 24], [58, 42], [78, 42], [62, 54], [68, 74], [50, 62], [32, 74], [38, 54], [22, 42], [42, 42]]); fillStroke(ctx, '#fff');
  ctx.restore();
};
ICON_FALLBACK.ability = (ctx, s) => {
  ctx.save(); ctx.scale(s / 100, s / 100); ctx.lineWidth = 6; ctx.strokeStyle = DARK; ctx.lineJoin = 'round';
  circle(ctx, 50, 50, 40, '#ffe56b');
  poly(ctx, [[56, 16], [30, 54], [48, 54], [42, 84], [70, 44], [52, 44]]); fillStroke(ctx, '#fff');
  ctx.restore();
};
