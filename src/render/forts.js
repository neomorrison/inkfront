// Fort drawers. FORT_DRAW[style](ctx, cam, fort, pal, t, world). Local fort space: origin at the fort's ground
// point, +x points toward the enemy (mirrored for team 1), y up is negative. The archer deck sits at y = -205
// on the home-side tower (local x = -45). Damage: cracks at 70/40/15 %, soot, smoke and flames come from FX.
import { FORT_DRAW } from './world.js';
import { DEPTH } from './camera.js';
import { wob } from './ink.js';
import { mixHex, hash2, TAU } from '../core/util.js';

const TOP = -205;
const TX = -45; // tower center

function begin(ctx, cam, f, t) {
  const z = cam.zoom;
  const dir = f.team === 0 ? 1 : -1;
  ctx.save();
  ctx.translate(cam.sx(f.x), cam.sy(f.z * DEPTH));
  ctx.scale(dir * z, z);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { dir, z, pct: f.maxHp > 0 ? f.hp / f.maxHp : 0, fr: Math.floor(t * 3), t };
}

// Colors derived from the army palette, cached on it per page.
function colors(pal, world) {
  const pid = world.page.id;
  if (pal._fc && pal._fc.pid === pid) return pal._fc;
  const chalky = !!world.page.chalky;
  const paper = world.page.paper;
  pal._fc = {
    pid, chalky,
    line: chalky ? pal.ink : pal.ink,
    dark: pal.dark,
    stone: chalky ? mixHex(pal.light, paper, 0.78) : mixHex(pal.light, '#fffdf4', 0.55),
    stone2: chalky ? mixHex(pal.light, paper, 0.65) : mixHex(pal.light, '#fffdf4', 0.3),
    ink: pal.ink,
    shade: chalky ? 'rgba(255,255,255,.18)' : 'rgba(27,34,64,.22)',
    hole: chalky ? '#16241d' : mixHex(pal.dark, '#0b1030', 0.5),
  };
  return pal._fc;
}

// Wobbly polyline in local units.
function pl(ctx, pts, seed, fr, amp = 0.8, close = false) {
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] + wob(seed, i, fr, amp), y = pts[i][1] + wob(seed, i + 40, fr, amp);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (close) ctx.closePath();
}

function box(ctx, x0, y0, x1, y1, seed, fr, amp) {
  pl(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], seed, fr, amp, true);
}

function hatchRect(ctx, x0, y0, x1, y1, gap, col, alpha = 0.5) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.strokeStyle = col;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const h = y1 - y0, w = x1 - x0;
  for (let i = -h * 0.6; i < w; i += gap) { ctx.moveTo(x0 + i, y1); ctx.lineTo(x0 + i + h * 0.6, y0); }
  ctx.stroke();
  ctx.restore();
}

// Cracks grow with damage: one at <70 %, more at <40 %, many (and soot) at <15 %.
function cracks(ctx, rects, pct, col, seed) {
  if (pct >= 0.7) return;
  const n = pct < 0.15 ? 3 : pct < 0.4 ? 2 : 1;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  rects.forEach((r, ri) => {
    const h = r[3] - r[1], w = r[2] - r[0];
    for (let k = 0; k < n; k++) {
      let x = r[0] + w * (0.18 + 0.27 * k + hash2(seed + ri, k) * 0.12);
      let y = r[1] + (k === 1 ? h * 0.25 : 0);
      ctx.moveTo(x, y);
      const len = h * (0.35 + 0.12 * k);
      const segs = 4;
      for (let s = 1; s <= segs; s++) {
        x += (hash2(seed + ri * 7 + k, s) - 0.5) * 16;
        y += len / segs;
        ctx.lineTo(x, y);
        if (s === 2 && pct < 0.4) { ctx.moveTo(x, y); ctx.lineTo(x + 9 * (k % 2 ? 1 : -1), y + 8); ctx.moveTo(x, y); }
      }
    }
  });
  ctx.stroke();
  if (pct < 0.3) {
    ctx.fillStyle = 'rgba(20,16,12,.16)';
    for (const r of rects) {
      ctx.beginPath();
      ctx.ellipse((r[0] + r[2]) / 2, r[1] + 8, (r[2] - r[0]) * 0.38, 12, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function archway(ctx, x, w, hgt, fill, ring, seed, fr, lw) {
  ctx.beginPath();
  ctx.moveTo(x - w, 0);
  ctx.lineTo(x - w, -hgt + w);
  ctx.arc(x, -hgt + w, w, Math.PI, 0);
  ctx.lineTo(x + w, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = lw; ctx.stroke(); }
}

// Counter-mirror so text reads left to right on both teams.
function textAt(ctx, S, str, x, y, font, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(S.dir, 1);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = col;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- castle (blue and red armies)
FORT_DRAW.castle = (ctx, cam, f, pal, t, world) => {
  const S = begin(ctx, cam, f, t);
  const C = colors(pal, world);
  const { pct, fr } = S;
  const seed = f.team * 13 + 5;
  ctx.fillStyle = C.stone;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  // Tower (home side), taller than the wall.
  ctx.beginPath(); box(ctx, -68, TOP, -22, 0, seed, fr, 0.8); ctx.fill(); ctx.stroke();
  // Wall.
  ctx.beginPath(); box(ctx, -62, -118, 62, 0, seed + 3, fr, 0.8); ctx.fill(); ctx.stroke();
  // Stone courses.
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  for (let y = -14, row = 0; y > -118; y -= 14, row++) {
    ctx.moveTo(-62, y); ctx.lineTo(62, y);
    for (let x = -62 + (row % 2 ? 12 : 0); x < 62; x += 24) { ctx.moveTo(x, y); ctx.lineTo(x, y + 14); }
  }
  for (let y = -118, row = 0; y > TOP; y -= 14, row++) {
    ctx.moveTo(-68, y); ctx.lineTo(-22, y);
    for (let x = -68 + (row % 2 ? 10 : 0); x < -22; x += 20) { ctx.moveTo(x, y); ctx.lineTo(x, y + 14); }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  hatchRect(ctx, 40, -118, 62, 0, 6, C.shade, 0.7);
  hatchRect(ctx, -34, TOP, -22, -118, 6, C.shade, 0.7);
  // Merlons on the wall (a couple fall off when badly hurt).
  ctx.fillStyle = C.stone;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    if ((pct < 0.4 && i === 1) || (pct < 0.15 && i === 4)) continue;
    const x0 = -62 + i * 22.7;
    ctx.beginPath(); box(ctx, x0, -130, x0 + 13, -118, seed + i, fr, 0.5); ctx.fill(); ctx.stroke();
  }
  // Tower top: deck with end posts (the archer stands here).
  ctx.beginPath(); box(ctx, -68, TOP - 12, -60, TOP, seed + 20, fr, 0.5); ctx.fill(); ctx.stroke();
  if (pct >= 0.15) { ctx.beginPath(); box(ctx, -30, TOP - 12, -22, TOP, seed + 21, fr, 0.5); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = C.line;
  ctx.fillRect(-70, TOP - 2, 50, 4);
  ctx.beginPath();
  for (let x = -66; x < -24; x += 10) { ctx.moveTo(x, TOP + 2); ctx.lineTo(x + 5, TOP + 9); ctx.lineTo(x + 10, TOP + 2); }
  ctx.fill();
  // Arrow slits.
  ctx.fillStyle = C.hole;
  ctx.beginPath();
  for (const y of [-165, -135]) { ctx.rect(TX - 3, y, 6, 20); ctx.arc(TX, y, 3, Math.PI, 0); }
  ctx.rect(-40, -96, 6, 18); ctx.rect(46, -96, 6, 18);
  ctx.fill();
  // Gate toward the enemy.
  archway(ctx, 14, 17, 52, C.hole, C.line, seed, fr, 3);
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = -2; x <= 30; x += 8) { ctx.moveTo(x, -2); ctx.lineTo(x, -34); }
  ctx.stroke();
  // Banner on the wall.
  ctx.fillStyle = C.ink;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, -108); ctx.lineTo(48, -108); ctx.lineTo(48, -78); ctx.lineTo(39, -86); ctx.lineTo(30, -78); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.chalky ? '#2e4a3d' : '#fffdf4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 2.4 : 5.5; ctx.lineTo(39 + Math.cos(a) * r, -97 + Math.sin(a) * r); }
  ctx.fill();
  cracks(ctx, [[-62, -118, 62, 0], [-68, TOP, -22, -118]], pct, C.line, seed);
  // Flag on the tower post.
  const fx = -64, fy = TOP - 12;
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 46); ctx.stroke();
  const wv = Math.sin(t * 5 + f.team) * 4;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 46);
  ctx.quadraticCurveTo(fx - 18, fy - 50 + wv, fx - 40, fy - 40 + wv);
  ctx.lineTo(fx - 32, fy - 33 + wv * 0.6);
  ctx.quadraticCurveTo(fx - 18, fy - 32 - wv, fx, fy - 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------- pencil fort (graphite)
const WOOD = '#f1d4a8', YEL = '#f4cf5a', PINK = '#f3a2b4', SILVER = '#c9ccd6';

function pencil(ctx, x, w, h, tipLen, C, seed, fr, opts = {}) {
  const x0 = x - w / 2, x1 = x + w / 2;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.line;
  ctx.fillStyle = YEL;
  ctx.beginPath(); box(ctx, x0, -h, x1, 0, seed, fr, 0.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120,80,0,.18)';
  ctx.fillRect(x, -h, w / 2, h);
  ctx.strokeStyle = 'rgba(80,60,0,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, 0); ctx.stroke();
  if (opts.broken) {
    ctx.fillStyle = WOOD;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, -h); ctx.lineTo(x0 + w * 0.2, -h - 9); ctx.lineTo(x0 + w * 0.45, -h - 3); ctx.lineTo(x0 + w * 0.7, -h - 12); ctx.lineTo(x1, -h);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    return;
  }
  ctx.fillStyle = WOOD;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x0, -h); ctx.lineTo(x, -h - tipLen); ctx.lineTo(x1, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.line;
  ctx.beginPath(); ctx.moveTo(x - w * 0.19, -h - tipLen * 0.68); ctx.lineTo(x, -h - tipLen); ctx.lineTo(x + w * 0.19, -h - tipLen * 0.68); ctx.closePath(); ctx.fill();
}

FORT_DRAW.pencil_fort = (ctx, cam, f, pal, t, world) => {
  const S = begin(ctx, cam, f, t);
  const C = colors(pal, world);
  const { pct, fr } = S;
  const seed = f.team * 17 + 2;
  // Tower: three upright pencils, eraser ends up to form the flat archer deck.
  for (let i = 0; i < 3; i++) {
    const x = -60 + i * 15, x0 = x - 7.5, x1 = x + 7.5;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = C.line;
    ctx.fillStyle = YEL;
    ctx.beginPath(); box(ctx, x0, -191, x1, 0, seed + i, fr, 0.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(120,80,0,.2)';
    ctx.fillRect(x, -191, 7.5, 191);
    ctx.fillStyle = SILVER;
    ctx.beginPath(); box(ctx, x0 - 0.5, -197, x1 + 0.5, -191, seed + i, fr, 0.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.moveTo(x0, -197); ctx.lineTo(x0, -203); ctx.quadraticCurveTo(x0, TOP, x0 + 3, TOP); ctx.lineTo(x1 - 3, TOP); ctx.quadraticCurveTo(x1, TOP, x1, -203); ctx.lineTo(x1, -197); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,60,0,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, -191); ctx.lineTo(x, -20); ctx.moveTo(x0 + 2, -191); ctx.lineTo(x0 + 2, -150); ctx.stroke();
  }
  ctx.fillStyle = C.line;
  ctx.fillRect(-69, TOP - 1, 48, 3);
  // Wall of sharpened pencils (the palisade).
  const hs = [96, 108, 92, 112, 100, 110, 94, 104];
  for (let i = 0; i < 8; i++) {
    const broken = (pct < 0.4 && i === 2) || (pct < 0.15 && i === 5);
    pencil(ctx, -54 + i * 15.4, 15.4, hs[i] - (broken ? 14 : 0), 20, C, seed + 10 + i, fr, { broken });
  }
  // Gate: a pencil sharpener with a slow crank and shavings.
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = C.line;
  ctx.fillStyle = '#b7bfd1';
  ctx.beginPath(); box(ctx, -8, -50, 38, 0, seed + 50, fr, 0.6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9aa3ba';
  ctx.beginPath(); box(ctx, -8, -50, 38, -40, seed + 51, fr, 0.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.hole;
  ctx.beginPath(); ctx.ellipse(15, -22, 12, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = WOOD;
  ctx.beginPath(); ctx.ellipse(15, -22, 6, 5.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.line;
  ctx.beginPath(); ctx.arc(-1, -45, 1.8, 0, TAU); ctx.arc(31, -45, 1.8, 0, TAU); ctx.fill();
  // Crank.
  const ca = t * 0.9 + f.team;
  const cx = 38, cy = -28;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 10 + Math.cos(ca) * 9, cy + Math.sin(ca) * 9); ctx.stroke();
  ctx.fillStyle = PINK;
  ctx.beginPath(); ctx.arc(cx + 10 + Math.cos(ca) * 9, cy + Math.sin(ca) * 9, 3.2, 0, TAU); ctx.fill();
  // Shavings.
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { ctx.moveTo(-14 - i * 7, -2); ctx.arc(-18 - i * 7, -3, 4 + i, 0, Math.PI * 1.6); }
  ctx.stroke();
  cracks(ctx, [[-56, -110, 62, 0], [-68, TOP, -22, -100]], pct, C.line, seed);
  ctx.restore();
};

// ---------------------------------------------------------------- neon fort (highlighter gang)
const NEON = ['#ff4fa8', '#ffe94a', '#7be04d', '#ffa13b'];

FORT_DRAW.neon_fort = (ctx, cam, f, pal, t, world) => {
  const S = begin(ctx, cam, f, t);
  const C = colors(pal, world);
  const { pct, fr } = S;
  const seed = f.team * 19 + 4;
  // Glow behind.
  const flick = 0.85 + 0.15 * Math.sin(t * 7 + f.team) * Math.sin(t * 3.1);
  const g = ctx.createRadialGradient(0, -80, 10, 0, -80, 170);
  g.addColorStop(0, `rgba(255,70,170,${0.2 * flick})`);
  g.addColorStop(1, 'rgba(255,70,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-190, -260, 380, 270);
  // Tower: two upright markers with flat caps.
  const TW = [['#38d6ff', '#1b9bc4'], ['#ff4fa8', '#c42d77']];
  for (let i = 0; i < 2; i++) {
    const x0 = -68 + i * 23, x1 = x0 + 23;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = C.dark;
    ctx.fillStyle = TW[i][0];
    ctx.beginPath(); box(ctx, x0, -188, x1, 0, seed + i, fr, 0.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(x0 + 4, -184, 4, 176);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.fillRect(x1 - 7, -188, 7, 188);
    ctx.fillStyle = TW[i][1];
    ctx.beginPath(); box(ctx, x0 - 1.5, TOP, x1 + 1.5, -186, seed + 5 + i, fr, 0.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(x0 + 3, -150, x1 - x0 - 6, 26);
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 + 6, -143); ctx.lineTo(x1 - 6, -143); ctx.moveTo(x0 + 6, -135); ctx.lineTo(x1 - 10, -135); ctx.stroke();
  }
  // Wall: stacked highlighters lying on their sides, caps alternate.
  for (let i = 0; i < 4; i++) {
    const y1 = -i * 29.5, y0 = y1 - 29.5;
    if (pct < 0.4 && i === 3) { /* top marker rolled away */ continue; }
    const col = NEON[i];
    const capRight = i % 2 === 0;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = C.dark;
    ctx.fillStyle = col;
    ctx.beginPath(); box(ctx, -62, y0, 62, y1, seed + 20 + i, fr, 0.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(-58, y0 + 4, 116, 4);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(-62, y1 - 8, 124, 8);
    // Cap.
    const cx0 = capRight ? 38 : -62, cx1 = capRight ? 62 : -38;
    ctx.fillStyle = mixHex(col, '#000000', 0.18);
    ctx.beginPath(); box(ctx, cx0, y0 - 1.5, cx1, y1 + 1.5, seed + 30 + i, fr, 0.4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(capRight ? 44 : -44, y0 + 3); ctx.lineTo(capRight ? 44 : -44, y1 - 3); ctx.stroke();
    // Label stripe.
    ctx.fillStyle = '#fffdf4';
    const lx = capRight ? -48 : -26;
    ctx.fillRect(lx, y0 + 9, 48, 11);
    ctx.fillStyle = C.dark;
    ctx.fillRect(lx + 4, y0 + 12, 22, 2); ctx.fillRect(lx + 4, y0 + 16, 34, 2);
  }
  // Gate.
  archway(ctx, 14, 15, 44, '#15101f', C.dark, seed, fr, 2.6);
  // Glowing sign.
  const sy = -92;
  ctx.fillStyle = '#241a3a';
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); box(ctx, -8, sy - 15, 38, sy + 10, seed + 60, fr, 0.4); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = (k === 0 ? 0.18 : k === 1 ? 0.3 : 1) * flick;
    ctx.strokeStyle = k === 2 ? '#fff0fa' : '#ff4fd0';
    ctx.lineWidth = k === 0 ? 8 : k === 1 ? 4 : 1.6;
    ctx.save();
    ctx.translate(15, sy + 5);
    ctx.scale(S.dir, 1);
    ctx.font = "15px 'Permanent Marker', cursive";
    ctx.textAlign = 'center';
    ctx.strokeText('GLOW', 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  cracks(ctx, [[-62, -118, 62, 0], [-68, TOP, -22, -120]], pct, C.dark, seed);
  ctx.restore();
};

// ---------------------------------------------------------------- chalk fort (schoolhouse with a bell)
FORT_DRAW.chalk_fort = (ctx, cam, f, pal, t, world) => {
  const S = begin(ctx, cam, f, t);
  const C = colors(pal, world);
  const { pct, fr } = S;
  const seed = f.team * 23 + 6;
  const line = C.chalky ? '#f4f1e6' : C.dark;
  const fill = C.chalky ? 'rgba(255,255,255,.09)' : '#fffdf4';
  const brick = C.chalky ? 'rgba(255,255,255,.22)' : 'rgba(27,34,64,.18)';
  ctx.strokeStyle = line;
  ctx.fillStyle = fill;
  ctx.lineWidth = 3;
  // Bell tower with an open belfry.
  ctx.beginPath(); box(ctx, -68, TOP, -22, 0, seed, fr, 0.8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = brick;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let y = -12, r = 0; y > TOP; y -= 12, r++) { ctx.moveTo(-68, y); ctx.lineTo(-22, y); for (let x = -68 + (r % 2 ? 8 : 0); x < -22; x += 16) { ctx.moveTo(x, y); ctx.lineTo(x, y + 12); } }
  ctx.stroke();
  // Schoolhouse body and roof.
  ctx.strokeStyle = line;
  ctx.fillStyle = C.chalky ? '#2e4a3d' : '#fffdf4';
  ctx.lineWidth = 3;
  ctx.beginPath(); box(ctx, -62, -90, 62, 0, seed + 3, fr, 0.8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fill;
  ctx.beginPath(); box(ctx, -62, -90, 62, 0, seed + 4, fr, 0.8); ctx.fill();
  ctx.beginPath();
  pl(ctx, [[-70, -88], [0, -134], [70, -88]], seed + 5, fr, 0.8, true);
  ctx.fillStyle = C.chalky ? 'rgba(255,255,255,.16)' : mixHex(pal.light, '#fffdf4', 0.3);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = brick;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { ctx.moveTo(-60 + i * 14, -94 - (i < 5 ? i * 2.6 : (8 - i) * 2.6) - 3); ctx.lineTo(-56 + i * 14 + 4, -90); }
  ctx.stroke();
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  // Windows with cross panes.
  for (const wx of [6, 40]) {
    ctx.beginPath(); ctx.rect(wx, -72, 16, 22); ctx.moveTo(wx + 8, -72); ctx.lineTo(wx + 8, -50); ctx.moveTo(wx, -61); ctx.lineTo(wx + 16, -61); ctx.stroke();
  }
  // Door.
  archway(ctx, -32, 11, 40, C.chalky ? '#16241d' : '#3a3550', line, seed, fr, 2.6);
  // Belfry opening and bell (swings idle, harder when hit).
  ctx.fillStyle = C.chalky ? '#16241d' : '#3a3550';
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.6;
  archway(ctx, TX, 15, 62, ctx.fillStyle, line, seed, fr, 2.6);
  ctx.save();
  ctx.translate(TX, -158);
  const st = world.cur.st;
  const hit = st ? Math.max(0, 1 - (t - st.hitT) / 0.7) : 0;
  ctx.rotate(Math.sin(t * 1.4 + f.team) * 0.07 + Math.sin(t * 22) * 0.4 * hit * hit);
  ctx.fillStyle = '#f2c230';
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -10); ctx.quadraticCurveTo(-4, -2, -11, 12); ctx.lineTo(11, 12); ctx.quadraticCurveTo(4, -2, 3, -10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = line;
  ctx.beginPath(); ctx.arc(0, 14, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
  // Deck with railing.
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-72, TOP); ctx.lineTo(-18, TOP);
  ctx.moveTo(-70, TOP); ctx.lineTo(-70, TOP - 12); ctx.moveTo(-20, TOP); ctx.lineTo(-20, TOP - 12);
  ctx.stroke();
  // Chalk lettering and bunting.
  textAt(ctx, S, 'ABC', 22, -26, "20px 'Permanent Marker', cursive", C.chalky ? 'rgba(255,255,255,.55)' : 'rgba(27,34,64,.5)');
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-60, -84); ctx.quadraticCurveTo(0, -70, 60, -84); ctx.stroke();
  const flags = ['#ff9c8f', '#ffd978', '#a8d4ff', '#bff0c8', '#ff9c8f', '#ffd978'];
  flags.forEach((c, i) => {
    const px = -50 + i * 20, py = -84 + Math.sin((px + 60) / 120 * Math.PI) * 11 - 0;
    const sway = Math.sin(t * 3 + i) * 1.2;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(px - 5, py - 1); ctx.lineTo(px + 5, py - 1); ctx.lineTo(px + sway, py + 9); ctx.closePath(); ctx.fill();
  });
  cracks(ctx, [[-62, -90, 62, 0], [-68, TOP, -22, -100]], pct, line, seed);
  ctx.restore();
};

// ---------------------------------------------------------------- eraser fort (pencil case with a zipper)
FORT_DRAW.eraser_fort = (ctx, cam, f, pal, t, world) => {
  const S = begin(ctx, cam, f, t);
  const C = colors(pal, world);
  const { pct, fr } = S;
  const seed = f.team * 29 + 8;
  const CASE = mixHex(pal.light, '#ffffff', 0.25), CASE2 = mixHex(pal.light, pal.ink, 0.35);
  // Tower: a big eraser with a cardboard sleeve.
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.line;
  ctx.fillStyle = '#fbf6f3';
  ctx.beginPath(); box(ctx, -68, TOP, -22, 0, seed, fr, 0.7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = CASE2;
  ctx.beginPath(); box(ctx, -68, -140, -22, 0, seed + 1, fr, 0.7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-34, TOP, 12, 65);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(-62, -134, 5, 130);
  // Smudges and a bite on the eraser top.
  ctx.fillStyle = 'rgba(80,80,90,.18)';
  ctx.beginPath(); ctx.ellipse(-52, -178, 9, 5, 0.3, 0, TAU); ctx.ellipse(-36, -156, 7, 4, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = C.line;
  ctx.font = "13px 'Permanent Marker', cursive";
  textAt(ctx, S, 'PINK', TX, -80, "13px 'Permanent Marker', cursive", 'rgba(255,255,255,.85)');
  // The case: rounded body, stitched edge.
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.line;
  ctx.fillStyle = CASE;
  ctx.beginPath();
  ctx.moveTo(-62, 0); ctx.lineTo(-62, -100); ctx.quadraticCurveTo(-62, -110, -52, -110); ctx.lineTo(52, -110); ctx.quadraticCurveTo(62, -110, 62, -100); ctx.lineTo(62, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(34, -108, 26, 108);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.rect(-55, -103, 110, 96); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // Colored pencil tips poking out of the top are the battlements.
  const cols = ['#ff4f4f', '#f2c230', '#3ec46d', '#4fa3ff', '#b05bff', '#ff8a2b'];
  for (let i = 0; i < 6; i++) {
    if ((pct < 0.4 && i === 1) || (pct < 0.15 && i === 4)) continue;
    const x = -44 + i * 17.6;
    ctx.fillStyle = cols[i];
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 6, -110); ctx.lineTo(x - 6, -122); ctx.lineTo(x, -134); ctx.lineTo(x + 6, -122); ctx.lineTo(x + 6, -110); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = WOOD;
    ctx.beginPath(); ctx.moveTo(x - 6, -122); ctx.lineTo(x, -134); ctx.lineTo(x + 6, -122); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Zipper along the top and a gate where it is pulled open.
  ctx.strokeStyle = '#6e6e7a';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(-58, -96); ctx.lineTo(58, -96); ctx.stroke();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = -58, i = 0; x < 58; x += 4, i++) { ctx.moveTo(x, -96 + (i % 2 ? -3 : 3)); ctx.lineTo(x + 2, -96 + (i % 2 ? 3 : -3)); }
  ctx.stroke();
  ctx.fillStyle = C.hole;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-6, 0); ctx.lineTo(-6, -48); ctx.quadraticCurveTo(14, -62, 34, -48); ctx.lineTo(34, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Zipper pull swinging at the gate.
  const sw = Math.sin(t * 2 + f.team) * 0.18;
  ctx.save();
  ctx.translate(14, -58);
  ctx.rotate(sw);
  ctx.fillStyle = '#c9ccd6';
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(-4, 0, 8, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 16, 5, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  // Eraser crumbs at the base.
  ctx.fillStyle = '#f3dcd6';
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = -66 + hash2(seed, i) * 140, y = -2 - hash2(seed, i + 9) * 4;
    ctx.beginPath(); ctx.ellipse(x, y, 3, 1.8, hash2(seed, i + 3), 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = C.line;
  ctx.fillRect(-70, TOP - 1, 52, 3);
  cracks(ctx, [[-62, -110, 62, 0], [-68, TOP, -22, -140]], pct, C.line, seed);
  ctx.restore();
};

// ---------------------------------------------------------------- rubble after the collapse
function rubbleBase(ctx, cam, f, pal, world, drawProps) {
  const C = colors(pal, world);
  const z = cam.zoom;
  ctx.save();
  ctx.translate(cam.sx(f.x), cam.sy(f.z * DEPTH));
  ctx.scale((f.team === 0 ? 1 : -1) * z, z);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = C.stone;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-70, 0); ctx.lineTo(-58, -16); ctx.lineTo(-40, -12); ctx.lineTo(-30, -30); ctx.lineTo(-12, -18); ctx.lineTo(4, -34); ctx.lineTo(24, -16); ctx.lineTo(44, -24); ctx.lineTo(54, -10); ctx.lineTo(70, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.shade;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-40, -12); ctx.lineTo(-30, -4); ctx.moveTo(4, -34); ctx.lineTo(10, -20); ctx.moveTo(44, -24); ctx.lineTo(36, -12); ctx.stroke();
  if (drawProps) drawProps(ctx, C);
  ctx.restore();
}

FORT_DRAW['pencil_fort:rubble'] = (ctx, cam, f, pal, t, world) => rubbleBase(ctx, cam, f, pal, world, (c, C) => {
  c.fillStyle = YEL; c.strokeStyle = C.line; c.lineWidth = 2;
  for (const [x, y, a, l] of [[-34, -22, -0.5, 36], [18, -26, 0.4, 30], [52, -8, 1.2, 24]]) {
    c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.rect(0, -3.5, l, 7); c.fill(); c.stroke();
    c.fillStyle = WOOD; c.beginPath(); c.moveTo(l, -3.5); c.lineTo(l + 9, 0); c.lineTo(l, 3.5); c.closePath(); c.fill(); c.stroke(); c.fillStyle = YEL; c.restore();
  }
});
FORT_DRAW['neon_fort:rubble'] = (ctx, cam, f, pal, t, world) => rubbleBase(ctx, cam, f, pal, world, (c, C) => {
  c.strokeStyle = C.dark; c.lineWidth = 2;
  [[-30, -26, -0.3, '#ff4fa8'], [14, -30, 0.25, '#ffe94a'], [46, -10, -0.1, '#7be04d']].forEach(([x, y, a, col]) => {
    c.fillStyle = col; c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.rect(-22, -5, 44, 10); c.fill(); c.stroke(); c.restore();
  });
});
FORT_DRAW['chalk_fort:rubble'] = (ctx, cam, f, pal, t, world) => rubbleBase(ctx, cam, f, pal, world, (c, C) => {
  c.fillStyle = '#f2c230'; c.strokeStyle = '#f4f1e6'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-8, -6); c.quadraticCurveTo(-4, -22, 4, -22); c.quadraticCurveTo(12, -22, 16, -6); c.closePath(); c.fill(); c.stroke();
});
FORT_DRAW['eraser_fort:rubble'] = (ctx, cam, f, pal, t, world) => rubbleBase(ctx, cam, f, pal, world, (c, C) => {
  c.fillStyle = '#fbf6f3'; c.strokeStyle = C.line; c.lineWidth = 2;
  c.beginPath(); c.rect(-48, -26, 28, 20); c.fill(); c.stroke();
  c.fillStyle = '#f3dcd6';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-60 + i * 22, -3, 4, 2.4, i, 0, TAU); c.fill(); c.stroke(); }
});
