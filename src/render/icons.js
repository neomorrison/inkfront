// Small canvas-drawn icons for the DOM UI, cached as data URLs.
// ICON_DRAW[name](ctx, size) lets packages add icons (spells, upgrades, currencies).
import { UNITS } from '../data/units.js';
import { FACTIONS } from '../data/factions.js';
import { PAGES } from '../data/pages.js';
import { computePose, drawStick } from './stickman.js';
import { BODIES, MOUNTS, makePalette } from './renderer.js';
import { HAT_DRAW } from './hats.js';

export const ICON_DRAW = {};
// ICON_FALLBACK.spell / .ability(ctx, size, name): drawn when another package has not supplied that icon.
export const ICON_FALLBACK = {};
const cache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// Portrait of a unit in its idle pose. opts: { faction, level, hat, size, pose }
export function unitIcon(id, opts = {}) {
  const size = opts.size || 128;
  const key = `u:${id}:${opts.faction || 'ink'}:${opts.level || 1}:${opts.hat || ''}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const def = UNITS[id];
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const fid = opts.faction || def.faction;
  // Chalk is white ink: on a white card it needs the chalkboard's green instead.
  const basePal = fid === 'chalk' ? { ink: '#2e5a46', dark: '#1b3328', light: '#cfe0d4', under: null } : (FACTIONS[fid] || FACTIONS.ink).palette;
  const pal = makePalette(basePal, PAGES.ruled);
  const look = def.look || {};
  const fake = {
    id: 1, type: id, def, team: 0, level: opts.level || 1, scale: 1, facing: 1, z: 0, x: 0, y: 0,
    // Overhead "slam" carry makes giants too tall for a card; portraits hold the weapon forward.
    anim: { t: 0.4, walk: 0, atk: 0, style: look.style === 'slam' ? 'thrust' : look.style || 'slash', moving: false, flash: 0, cheer: 0 },
    attacking: false, state: 'idle', data: {}, mod: {}, perks: new Set(), tags: new Set(def.tags || []), alive: true,
  };
  // Giants fill the card and read as bigger and bulkier than regular units.
  const big = (look.scale || 1) > 1.5;
  const fit = big ? 1.12 : 1;
  const s = (size / 100) * fit * (look.mount ? 0.8 : 1) * (look.scale && look.scale < 1 ? 1.2 : 1);
  const o = {
    x: size * 0.5, y: size * 0.9, s, facing: 1, col: pal.ink, back: pal.back, paper: '#ffffff', light: pal.light, dark: pal.dark,
    under: pal.under, lw: 2.6 * (look.bulk || 1) * (big ? 1.35 : 1), seed: 7, frame: 0, t: 0.4, eyes: 'dot', look, unit: fake,
    // Upgrade gear shows on the portrait too, so upgrading visibly changes the card.
    hat: opts.hat || look.hat || ((opts.level || 1) >= 7 ? 'gear_plume' : (opts.level || 1) >= 4 ? 'gear_helm' : null),
    gilded: (opts.level || 1) >= 10, inkDrop: pal.dark, pal,
  };
  const body = look.body && BODIES[look.body];
  if (body) {
    // Huge boss bodies are drawn smaller so they fit the portrait.
    const shrink = BODY_ICON_SCALE[look.body];
    if (shrink) { o.s = (size / 100) * shrink; o.y = size * (BODY_ICON_Y[look.body] ?? 0.9); }
    // Bodies may read a renderer for the ground line; give them a minimal stand-in.
    const stub = { cam: { zoom: o.s, x: 0, w: size, h: size, sx: () => o.x, sy: () => o.y, visible: () => true }, t: 0.4, settings: {}, pal: [pal, pal] };
    try { body(ctx, fake, o, stub); } catch (e) { drawFallbackPortrait(ctx, size, pal); }
  } else {
    const pose = computePose(fake, 0.4);
    const mount = look.mount && MOUNTS[look.mount];
    if (mount) { mount.draw(ctx, fake, o, null); o.y -= (mount.seat || 26) * s; }
    drawStick(ctx, pose.j, o);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

const BODY_ICON_SCALE = { wyrm: 0.3, hand: 0.42 };
const BODY_ICON_Y = { wyrm: 0.78, hand: 1.02 };

function drawFallbackPortrait(ctx, size, pal) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = pal.light;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = size / 18;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.font = `${Math.round(size * 0.4)}px 'Permanent Marker', cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2);
}

export function hatIcon(id, size = 96) {
  const key = `h:${id}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size * 0.62);
  const s = size / 34;
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1f47c2';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const fn = HAT_DRAW[id];
  if (fn) fn(ctx, 0, 0, 0, { col: '#1f47c2', light: '#a9bdf5', paper: '#ffffff', dark: '#132a73', lw: 2.4 });
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

// Generic named icon (spells, upgrades, ink, gold, star...). Falls back to a blank note.
export function icon(name, size = 64) {
  const key = `i:${name}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fn = ICON_DRAW[name];
  const fb = !fn && (name.startsWith('spell_') ? ICON_FALLBACK.spell : name.startsWith('ability_') ? ICON_FALLBACK.ability : null);
  if (fn) fn(ctx, size);
  else if (fb) fb(ctx, size, name);
  else {
    ctx.fillStyle = '#ffe56b';
    ctx.strokeStyle = '#1b2240';
    ctx.lineWidth = size / 16;
    ctx.fillRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);
    ctx.strokeRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function clearIconCache() { cache.clear(); }

ICON_DRAW.ink = (ctx, s) => {
  ctx.fillStyle = '#1f47c2';
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = s / 14;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.1);
  ctx.quadraticCurveTo(s * 0.86, s * 0.52, s * 0.8, s * 0.66);
  ctx.arc(s * 0.5, s * 0.66, s * 0.3, 0, Math.PI);
  ctx.quadraticCurveTo(s * 0.14, s * 0.52, s * 0.5, s * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.ellipse(s * 0.38, s * 0.62, s * 0.06, s * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
};

ICON_DRAW.gold = (ctx, s) => {
  ctx.fillStyle = '#f2b01e';
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = s / 14;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#9a6a00';
  ctx.lineWidth = s / 18;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9a6a00';
  ctx.font = `bold ${Math.round(s * 0.34)}px 'Permanent Marker', cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', s / 2, s / 2 + s * 0.02);
};

ICON_DRAW.star = (ctx, s) => {
  ctx.fillStyle = '#f2b01e';
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = s / 14;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.2 : s * 0.44;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    ctx.lineTo(s / 2 + Math.cos(a) * r, s * 0.53 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

ICON_DRAW.star_empty = (ctx, s) => {
  ctx.fillStyle = 'rgba(27,34,64,.12)';
  ctx.strokeStyle = 'rgba(27,34,64,.45)';
  ctx.lineWidth = s / 16;
  ctx.setLineDash([s / 12, s / 14]);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.2 : s * 0.44;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    ctx.lineTo(s / 2 + Math.cos(a) * r, s * 0.53 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

ICON_DRAW.pop = (ctx, s) => {
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = s / 12;
  for (const [dx, k] of [[-0.18, 0.85], [0.18, 0.85], [0, 1]]) {
    const x = s * (0.5 + dx), sc = k;
    ctx.beginPath();
    ctx.arc(x, s * 0.3 * (2 - sc), s * 0.1 * sc, 0, Math.PI * 2);
    ctx.moveTo(x, s * 0.42); ctx.lineTo(x, s * 0.7);
    ctx.moveTo(x - s * 0.1, s * 0.86); ctx.lineTo(x, s * 0.7); ctx.lineTo(x + s * 0.1, s * 0.86);
    ctx.stroke();
  }
};
