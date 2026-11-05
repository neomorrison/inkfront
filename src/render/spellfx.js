// OWNER: spells builder (package D): AREA_DRAW for spell zones, PROJ_DRAW for spell projectiles,
// BODIES.sticky_wall, EVENT_FX for spell casts, ICON_DRAW spell_<id> icons.
import { PROJ_DRAW, BODIES, EVENT_FX } from './renderer.js';
import { DEPTH } from './camera.js';
import { boilFrame, wob } from './ink.js';
import { ease, TAU, hash1 } from '../core/util.js';
import { INK, NOTE_COLORS, sat, style, fillStroke, rrect } from './spellkit.js';
import './spell_areas.js';
import './spell_icons.js';

const BROWN = '#5a3216';

// ------------------------------------------------------------------ projectiles
PROJ_DRAW.ink_bomb = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * DEPTH), z = cam.zoom;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(z * 1.15, z * 1.15);
  ctx.rotate(Math.sin(t * 9 + p.x * 0.01) * 0.35 + 0.25);
  // drip trail
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.5;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(-p.vx * 0.012 * i, -9 * i, 3.6 - i * 0.8, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // bottle
  ctx.beginPath();
  ctx.arc(0, 2, 9, 0, TAU);
  fillStroke(ctx, pal.ink, INK, 2.4);
  ctx.beginPath();
  rrect(ctx, -4.5, -12, 9, 7, 2);
  fillStroke(ctx, '#2a2f55', INK, 2);
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.beginPath(); ctx.ellipse(-3.5, 0, 2.2, 3.4, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
};

// ------------------------------------------------------------------ Sticky Wall body
const COLS = 2, ROWS = 6, NOTES = COLS * ROWS;

BODIES.sticky_wall = (ctx, u, o) => {
  const s = o.s;
  const hpK = sat(u.hp / u.maxHp);
  const keep = Math.max(1, Math.ceil(NOTES * hpK));
  const f = boilFrame(o.t);
  const pop = o.sketch == null ? 1 : o.sketch;
  const dying = u.lifetime > 0 && u.lifetime < 3 ? 0.6 + 0.4 * Math.sin(o.t * 22) : 1;
  const nw = 27, nh = 22;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  ctx.globalAlpha = dying;
  ctx.fillStyle = 'rgba(27,34,64,.2)';
  ctx.beginPath(); ctx.ellipse(0, 1, 34, 6, 0, 0, TAU); ctx.fill();
  // notes are removed from the top and the sides first as the wall loses hp
  const order = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) order.push({ r, c, k: r + hash1(u.id * 31 + r * 7 + c) * 1.3 });
  order.sort((a, b) => a.k - b.k);
  const alive = new Set(order.slice(0, keep).map((n) => n.r * COLS + n.c));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      if (!alive.has(id)) continue;
      const appear = sat((pop * (ROWS + 1) - r) / 1.2);
      if (appear <= 0) continue;
      const seed = u.id * 13 + id;
      const rot = (hash1(seed) * 2 - 1) * 0.07 + Math.sin(o.t * 2.6 + id * 1.3) * 0.015 * (1 + r * 0.25);
      const px = (c - 0.5) * (nw - 1) + (hash1(seed + 4) * 2 - 1) * 1.5;
      const py = -(r + 0.5) * (nh - 1) - 1 + (1 - ease.outBack(appear)) * -30;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.scale(0.6 + 0.4 * ease.outBack(appear), 0.6 + 0.4 * ease.outBack(appear));
      const col = NOTE_COLORS[(id + u.id) % NOTE_COLORS.length];
      ctx.beginPath();
      rrect(ctx, -nw / 2, -nh / 2, nw, nh, 2);
      fillStroke(ctx, col, INK, 2.2);
      // sticky strip at the top
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(-nw / 2 + 1.5, -nh / 2 + 1.5, nw - 3, 4);
      // scribbled text
      ctx.strokeStyle = 'rgba(27,34,64,.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, -1 + wob(seed, 1, f, 0.4)); ctx.lineTo(8, -1 + wob(seed, 2, f, 0.4));
      ctx.moveTo(-9, 5 + wob(seed, 3, f, 0.4)); ctx.lineTo(3, 5 + wob(seed, 4, f, 0.4));
      ctx.stroke();
      // curled corner flutters on the top row
      if (r >= ROWS - 2 || id % 3 === 0) {
        const curl = 4 + 1.8 * Math.sin(o.t * 5 + id);
        ctx.beginPath();
        ctx.moveTo(nw / 2, nh / 2 - curl); ctx.lineTo(nw / 2 - curl, nh / 2 - curl * 0.2); ctx.lineTo(nw / 2 - curl * 0.1, nh / 2);
        ctx.closePath();
        fillStroke(ctx, 'rgba(255,255,255,.75)', INK, 1.5);
      }
      ctx.restore();
    }
  }
  ctx.restore();
};

// ------------------------------------------------------------------ events
const prevDeath = EVENT_FX.death;
EVENT_FX.death = (r, e, b) => {
  const u = e.unit;
  if (e.kind === 'erase') {
    for (let i = 0; i < 14; i++) {
      r.fx.add({ kind: 'crumb', x: u.x + (Math.random() * 2 - 1) * 8, y: u.y - Math.random() * u.height, z: u.z, vx: (Math.random() * 2 - 1) * 90, vy: -40 - Math.random() * 120, col: Math.random() < 0.6 ? '#ffb3c4' : '#c9c4d8', size: 2 + Math.random() * 2, life: 1.4, g: 600 });
    }
    r.fx.puff(u.x, u.y - u.height * 0.4, u.z, 'rgba(255,240,245,.8)', 4, 12);
    return;
  }
  if (u.type === 'sticky_wall') {
    for (let i = 0; i < 16; i++) r.fx.add({ kind: 'paper', x: u.x + (Math.random() * 2 - 1) * 24, y: -10 - Math.random() * 90, z: u.z, vx: (Math.random() * 2 - 1) * 220, vy: -80 - Math.random() * 220, col: NOTE_COLORS[i % NOTE_COLORS.length], size: 5 + Math.random() * 3, life: 1.2, g: 520, vr: (Math.random() * 2 - 1) * 12 });
    r.fx.puff(u.x, -20, u.z, 'rgba(140,140,150,.4)', 4, 12);
    if (e.kind !== 'expire') r.shake(3);
    return;
  }
  prevDeath?.(r, e, b);
};

const prevHit = EVENT_FX.hit;
EVENT_FX.hit = (r, e, b) => {
  const t = e.target;
  if (t && t.type === 'sticky_wall') {
    for (let i = 0; i < 2; i++) r.fx.add({ kind: 'paper', x: t.x + (Math.random() * 2 - 1) * 20, y: -30 - Math.random() * 70, z: t.z, vx: (Math.random() * 2 - 1) * 120, vy: -60 - Math.random() * 120, col: NOTE_COLORS[(Math.random() * 5) | 0], size: 4, life: 0.7, g: 520 });
    return;
  }
  prevHit?.(r, e, b);
};

const prevLand = EVENT_FX.projLand;
EVENT_FX.projLand = (r, e, b) => {
  if (e.kind === 'pencil') {
    r.stuck.push({ x: e.x, z: e.z, ang: -1.45 + (Math.random() * 2 - 1) * 0.35, life: 3.5, col: '#e0a800' });
    if (r.stuck.length > 120) r.stuck.shift();
    r.fx.burst(e.x, -2, e.z, 4, '#f2c230', 140, 'crumb', { size: 1.6, life: 0.4 });
    return;
  }
  prevLand?.(r, e, b);
};

function stampText(r, x, str, col) {
  r.fx.text(x, -150, str, col, 30, { life: 0.9, vy: -40, bold: true });
}

// Decal crack drawn straight onto the ground decal canvas.
function crack(r, x, w) {
  const c = r.fx.decalCtx;
  if (!c) return;
  c.save();
  c.strokeStyle = 'rgba(27,34,64,.8)';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const X = (wx) => (wx + 100) * 1.5;
  const Y = (z) => (z * DEPTH + 40) * 1.5;
  for (let k = 0; k < 4; k++) {
    c.lineWidth = 3.2 - k * 0.5;
    c.beginPath();
    let px = x - w / 2 + Math.random() * 12, py = (Math.random() * 2 - 1) * 1.4;
    c.moveTo(X(px), Y(py));
    while (px < x + w / 2) {
      px += 10 + Math.random() * 18;
      py = Math.max(-1.6, Math.min(1.6, py + (Math.random() * 2 - 1) * 0.8));
      c.lineTo(X(px), Y(py));
      if (Math.random() < 0.12) { c.moveTo(X(px), Y(py)); c.lineTo(X(px + 8), Y(py + (Math.random() * 2 - 1) * 1.5)); c.moveTo(X(px), Y(py)); }
    }
    c.stroke();
  }
  c.restore();
}

const prevSpellFx = EVENT_FX.spellFx;
EVENT_FX.spellFx = (r, e, b) => {
  prevSpellFx?.(r, e, b);
  const fx = r.fx;
  const rnd = (a, c) => a + Math.random() * (c - a);
  switch (e.id + ':' + e.phase) {
    case 'pencil_rain:impact':
      r.shake(2);
      break;
    case 'coffee_spill:impact':
      fx.burst(e.x, -6, 0, 26, BROWN, 330, 'dot', { size: 3.4, life: 0.8, spread: 1.5 });
      fx.burst(e.x, -6, 0, 10, '#8a5a2b', 260, 'dot', { size: 2.4, life: 0.7, spread: 1.5 });
      fx.puff(e.x, -8, 0, 'rgba(255,255,255,.4)', 3, 12);
      fx.ring(e.x, 0, 0, '#8a5a2b', e.radius * 0.5, 0.5);
      fx.splat(e.x, 0, BROWN, 26, 0.7);
      stampText(r, e.x, 'SPLASH!', '#8a5a2b');
      r.shake(4);
      break;
    case 'coffee_spill:tick': {
      const x = e.x + rnd(-1, 1) * e.radius * 0.8;
      fx.puff(x, -4, rnd(-1, 1), 'rgba(255,255,255,.5)', 2, 10);
      fx.add({ kind: 'dot', x, y: -2, z: rnd(-1, 1), vx: 0, vy: -70, g: -20, col: '#a9784a', size: 2.4, life: 0.5 });
      break;
    }
    case 'coffee_spill:end': {
      fx.stain(e.x, 0, BROWN, e.radius * 0.8, 15, 0.34);
      fx.stain(e.x - e.radius * 0.2, 0.2, '#7d4a22', e.radius * 0.5, 9, 0.22);
      for (let i = 0; i < 4; i++) fx.splat(e.x + rnd(-1, 1) * e.radius * 0.7, rnd(-0.8, 0.8), BROWN, 5, 0.4);
      break;
    }
    case 'ruler_smash:impact': {
      const w = e.width;
      r.shake(14);
      for (let i = 0; i < 9; i++) {
        const x = e.x + (i / 8 - 0.5) * w;
        fx.puff(x, 0, rnd(-1, 1), 'rgba(150,140,130,.28)', 1, 9);
        fx.burst(x, -4, rnd(-1, 1), 2, '#ffc93c', 260, 'paper', { size: 2.6, life: 0.7 });
      }
      fx.ring(e.x, 0, 0, '#e0a020', w * 0.45, 0.5);
      crack(r, e.x, w);
      stampText(r, e.x, 'SMASH!', '#d1342b');
      break;
    }
    case 'paper_planes:launch':
      fx.burst(e.x, -170, 0, 4, '#c9dbff', 160, 'paper', { size: 3, life: 0.7, spread: 2 });
      break;
    case 'paper_planes:drop':
      fx.burst(e.x, e.y + 8, 0, 3, r.pal[e.team].ink, 90, 'dot', { size: 2, life: 0.5, spread: 2.2 });
      break;
    case 'sticky_wall:impact':
      fx.puff(e.x, -4, 0, 'rgba(140,140,150,.4)', 5, 14);
      for (let i = 0; i < 14; i++) fx.add({ kind: 'paper', x: e.x + rnd(-1, 1) * 26, y: -rnd(60, 130), z: rnd(-0.5, 0.5), vx: rnd(-1, 1) * 160, vy: rnd(-60, 40), col: NOTE_COLORS[i % 5], size: 5, life: 0.7, g: 600, vr: rnd(-1, 1) * 12 });
      fx.ring(e.x, 0, 0, '#f2b01e', 50, 0.4);
      r.shake(5);
      break;
    case 'stapler:impact': {
      r.shake(8);
      fx.ring(e.x, 0, 0, '#aeb7c9', e.radius * 0.6, 0.45);
      fx.burst(e.x, -6, 0, 18, '#d8dff0', 360, 'line', { size: 3, life: 0.35, spread: 1.7 });
      fx.puff(e.x, -4, 0, 'rgba(120,120,130,.4)', 5, 14);
      stampText(r, e.x, 'KA-CHUNK!', '#6b7488');
      break;
    }
    case 'highlighter:impact':
    case 'highlighter:tick':
      for (const u of e.units || []) {
        if (!u.alive) continue;
        if (e.phase === 'tick' && Math.random() < 0.5) continue;
        fx.add({ kind: 'star', x: u.x + rnd(-1, 1) * 12, y: u.y - rnd(0.2, 1) * u.height, z: u.z, vx: rnd(-1, 1) * 20, vy: -50, g: 0, col: '#ffd400', size: 3.2, life: 0.6 });
      }
      if (e.phase === 'impact') fx.ring(e.x, 0, 0, '#ffd400', e.radius * 0.6, 0.5);
      break;
    case 'doodle_drop:impact':
      fx.burst(e.x, -4, 0, 12, '#4b4f66', 150, 'crumb', { size: 1.6, life: 0.6, spread: 2.2 });
      fx.puff(e.x, -4, 0, 'rgba(160,160,170,.4)', 4, 12);
      break;
    case 'doodle_drop:end':
      fx.ring(e.x, 0, 0, '#7a5cf0', 60, 0.4);
      break;
    case 'eraser:impact':
      r.shake(5);
      fx.puff(e.x, -4, 0, 'rgba(255,225,235,.55)', 3, 12);
      break;
    case 'eraser:tick': {
      const x = e.rubX ?? e.x;
      r.shake(2.4);
      for (let i = 0; i < 5; i++) fx.add({ kind: 'crumb', x: x + rnd(-1, 1) * 60, y: -rnd(2, 14), z: rnd(-1, 1), vx: rnd(-1, 1) * 110, vy: -rnd(40, 140), col: i % 2 ? '#ffb3c4' : '#d9d3e6', size: 2 + Math.random() * 1.8, life: 1.1, g: 600, vr: rnd(-8, 8) });
      fx.puff(x, -4, rnd(-1, 1), 'rgba(255,225,235,.5)', 1, 9);
      break;
    }
    case 'eraser:end':
      fx.puff(e.x, -6, 0, 'rgba(255,225,235,.5)', 4, 14);
      r.shake(4);
      break;
    default:
  }
};


const prevExplode = EVENT_FX.explode;
EVENT_FX.explode = (r, e, b) => {
  if (e.fx === 'pencil') {
    r.fx.burst(e.x, -3, 0, 5, '#6b7080', 150, 'dot', { size: 1.8, life: 0.4 });
    r.fx.puff(e.x, -2, 0, 'rgba(110,110,120,.3)', 1, 8);
    return;
  }
  if (e.fx === 'ink_bomb') {
    const ink = r.pal[e.team].ink;
    r.fx.burst(e.x, -6, 0, 22, ink, 420, 'dot', { size: 3.4, life: 0.8, spread: 1.6 });
    r.fx.ring(e.x, 0, 0, ink, e.radius, 0.4);
    r.fx.splat(e.x, 0, ink, e.radius * 0.45, 0.8);
    r.fx.puff(e.x, -6, 0, 'rgba(60,70,110,.3)', 3, 14);
    r.shake(3);
    return;
  }
  prevExplode?.(r, e, b);
};
