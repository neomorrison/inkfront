// Full-screen overlays for modifiers: night, rain, wind, coffee stains. OVERLAY_DRAW[id](ctx, cam, b, t, r).
// The renderer calls these after units and particles. Night and rain keep their state on the renderer (r._night, r._rain)
// and reset it when a battle or a page changes.
import { OVERLAY_DRAW } from './renderer.js';
import { DEPTH } from './camera.js';
import { TAU } from '../core/util.js';

function sprite(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

let LIGHT = null; // erases darkness
const GLOWS = new Map(); // color -> additive glow sprite
function glowFor(col) {
  let s = GLOWS.get(col);
  if (!s) {
    s = sprite(96, [[0, col], [1, 'rgba(0,0,0,0)']]);
    GLOWS.set(col, s);
  }
  return s;
}

// ---------------------------------------------------------------- night
OVERLAY_DRAW.night = (ctx, cam, b, t, r) => {
  if (!LIGHT) LIGHT = sprite(128, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,.78)'], [0.75, 'rgba(0,0,0,.28)'], [1, 'rgba(0,0,0,0)']]);
  const SC = 0.5;
  let n = r._night;
  const w = Math.max(2, Math.round(cam.w * SC)), h = Math.max(2, Math.round(cam.h * SC));
  if (!n || n.c.width !== w || n.c.height !== h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    n = r._night = { c, g: c.getContext('2d') };
  }
  const g = n.g;
  const chalky = r.page.chalky;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.fillStyle = chalky ? 'rgba(4,10,24,.68)' : 'rgba(8,12,40,.80)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  const z = cam.zoom;
  const lit = (x, y, rad) => {
    const s = rad * SC;
    g.drawImage(LIGHT, x * SC - s, y * SC - s, s * 2, s * 2);
  };
  const flick = 1 + Math.sin(t * 9) * 0.02;
  const pf = b.teams[0].fort;
  if (pf.alive) lit(cam.sx(pf.x), cam.sy(-90), 280 * z * flick);
  // Enemy fort glows faintly through the dark so you know where to go (and neon forts glow for real).
  const ef = b.teams[1].fort;
  if (ef.alive && r.pal[1].under) lit(cam.sx(ef.x), cam.sy(-90), 170 * z);
  for (const u of b.units) {
    if (!u.alive || !cam.visible(u.x, 200)) continue;
    const neon = u.team === 1 && r.pal[1].under;
    if (u.team !== 0 && !neon) continue;
    if (u.stealth) continue;
    const rad = (u.isHero ? 175 : u.isBoss ? 190 : neon ? 80 : 98) * Math.max(0.8, u.scale) * z;
    lit(cam.sx(u.x), cam.sy(u.y - u.height * 0.5 + u.z * DEPTH), rad);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(n.c, 0, 0, cam.w, cam.h);
  // Warm lantern glow around the fort and Captain; neon units add their own colour.
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, rad, col, a) => {
    ctx.globalAlpha = a;
    ctx.drawImage(glowFor(col), x - rad, y - rad, rad * 2, rad * 2);
  };
  if (pf.alive) glow(cam.sx(pf.x), cam.sy(-110), 190 * z * flick, 'rgba(255,196,110,.9)', 0.16);
  for (const u of b.units) {
    if (!u.alive || !cam.visible(u.x, 200)) continue;
    if (u.team === 0 && u.isHero) glow(cam.sx(u.x), cam.sy(u.y - u.height * 0.5 + u.z * DEPTH), 110 * z, 'rgba(255,214,140,.9)', 0.2);
    else if (u.team === 1 && r.pal[1].under) glow(cam.sx(u.x), cam.sy(u.y - u.height * 0.5 + u.z * DEPTH), 70 * z * Math.max(1, u.scale * 0.6), r.pal[1].ink, 0.32);
  }
  if (ef.alive && r.pal[1].under) glow(cam.sx(ef.x), cam.sy(-90), 150 * z, r.pal[1].ink, 0.22);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

// ---------------------------------------------------------------- rain
function rainState(r, cam) {
  let s = r._rain;
  const n = r.low ? 70 : 150;
  if (!s || s.n !== n) {
    s = r._rain = { n, x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), l: new Float32Array(n), gy: new Float32Array(n), splashes: [], t: 0 };
    for (let i = 0; i < n; i++) resetDrop(s, i, cam, true);
  }
  return s;
}

function resetDrop(s, i, cam, anywhere) {
  s.x[i] = Math.random() * (cam.w + 200) - 100;
  s.y[i] = anywhere ? Math.random() * cam.h : -20 - Math.random() * 80;
  s.v[i] = 620 + Math.random() * 380;
  s.l[i] = 10 + Math.random() * 14;
  s.gy[i] = cam.groundY + (Math.random() * 2.6 - 1.2) * DEPTH * cam.zoom + 4;
}

OVERLAY_DRAW.rain = (ctx, cam, b, t, r) => {
  const s = rainState(r, cam);
  const dt = Math.min(0.05, Math.max(0, t - s.t));
  s.t = t;
  const chalky = r.page.chalky;
  // Wet, slightly darker page.
  ctx.fillStyle = chalky ? 'rgba(0,10,20,.16)' : 'rgba(40,64,110,.12)';
  ctx.fillRect(0, 0, cam.w, cam.h);
  const slant = 0.16 + (b.wind || 0) / 260 * 0.16;
  ctx.strokeStyle = chalky ? 'rgba(220,235,255,.42)' : 'rgba(86,120,176,.55)';
  ctx.lineWidth = Math.max(1, cam.zoom * 1.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const z = cam.zoom;
  for (let i = 0; i < s.n; i++) {
    const v = s.v[i] * dt;
    s.y[i] += v;
    s.x[i] += v * slant;
    if (s.y[i] > s.gy[i] && s.y[i] - v < s.gy[i] + 2 && s.splashes.length < 50 && s.gy[i] > cam.groundY - 20 * z) {
      s.splashes.push({ x: s.x[i], y: s.gy[i], age: 0 });
    }
    if (s.y[i] > cam.h + 10 || s.y[i] > s.gy[i] + 40 * z) { resetDrop(s, i, cam, false); continue; }
    const l = s.l[i] * z;
    ctx.moveTo(s.x[i], s.y[i]);
    ctx.lineTo(s.x[i] - l * slant, s.y[i] - l);
  }
  ctx.stroke();
  // Splashes: tiny expanding ellipses at ground level.
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = chalky ? 'rgba(220,235,255,.5)' : 'rgba(86,120,176,.6)';
  ctx.beginPath();
  for (let i = s.splashes.length - 1; i >= 0; i--) {
    const sp = s.splashes[i];
    sp.age += dt;
    if (sp.age > 0.3) { s.splashes[i] = s.splashes[s.splashes.length - 1]; s.splashes.pop(); continue; }
    const k = sp.age / 0.3;
    const rx = (2 + k * 7) * z;
    ctx.moveTo(sp.x + rx, sp.y);
    ctx.ellipse(sp.x, sp.y, rx, rx * 0.34, 0, 0, TAU);
  }
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- wind
function windState(r, cam) {
  let s = r._wind;
  if (!s) {
    s = r._wind = { scraps: [], lines: [], t: 0 };
    for (let i = 0; i < 26; i++) s.scraps.push({ x: Math.random() * cam.w, y: Math.random() * cam.h * 0.9, v: 0.5 + Math.random(), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 5, s: 2.5 + Math.random() * 3, ph: Math.random() * 6 });
    for (let i = 0; i < 12; i++) s.lines.push({ x: Math.random() * cam.w, y: Math.random() * cam.h * 0.8, l: 60 + Math.random() * 120, v: 1.6 + Math.random() * 1.6 });
  }
  return s;
}

const windDraw = (ctx, cam, b, t, r) => {
  const wind = b.wind || 0;
  if (!wind) return;
  const s = windState(r, cam);
  const dt = Math.min(0.05, Math.max(0, t - s.t));
  s.t = t;
  const dir = Math.sign(wind), str = Math.min(1.5, Math.abs(wind) / 260);
  const z = cam.zoom;
  const chalky = r.page.chalky;
  // Speed lines.
  ctx.strokeStyle = chalky ? 'rgba(255,255,255,.18)' : 'rgba(70,86,130,.16)';
  ctx.lineWidth = Math.max(1, 1.4 * z);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const l of s.lines) {
    l.x += dir * 900 * l.v * str * dt;
    if (dir > 0 && l.x - l.l > cam.w) { l.x = -20; l.y = Math.random() * cam.h * 0.8; }
    else if (dir < 0 && l.x + l.l < 0) { l.x = cam.w + 20; l.y = Math.random() * cam.h * 0.8; }
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x - dir * l.l * str * z, l.y + Math.sin(t * 2 + l.y) * 2);
  }
  ctx.stroke();
  // Paper scraps tumbling along.
  ctx.fillStyle = chalky ? 'rgba(240,240,230,.7)' : 'rgba(255,253,244,.92)';
  ctx.strokeStyle = chalky ? 'rgba(200,200,190,.6)' : 'rgba(79,88,120,.45)';
  ctx.lineWidth = 1;
  for (const p of s.scraps) {
    p.x += dir * 260 * p.v * str * dt;
    p.y += Math.sin(t * 2.2 + p.ph) * 24 * dt + 8 * dt;
    p.rot += p.vr * dt * (1 + str);
    if (p.x > cam.w + 20 || p.x < -20 || p.y > cam.h * 0.95) { p.x = dir > 0 ? -10 : cam.w + 10; p.y = Math.random() * cam.h * 0.8; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.abs(Math.cos(p.rot * 0.7 + p.ph)) * 0.8 + 0.2);
    ctx.beginPath();
    ctx.rect(-p.s * z, -p.s * 0.7 * z, p.s * 2 * z, p.s * 1.4 * z);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
};
OVERLAY_DRAW.wind_left = windDraw;
OVERLAY_DRAW.wind_right = windDraw;
OVERLAY_DRAW.wind = windDraw;

// ---------------------------------------------------------------- coffee stains (zones themselves are drawn by modes_draw.js)
OVERLAY_DRAW.coffee_stains = (ctx, cam, b, t, r) => {
  let c = r._coffee;
  if (!c || c.w !== cam.w || c.h !== cam.h) {
    const g = ctx.createRadialGradient(cam.w / 2, cam.h / 2, cam.h * 0.35, cam.w / 2, cam.h / 2, cam.w * 0.62);
    g.addColorStop(0, 'rgba(120,70,25,0)');
    g.addColorStop(1, 'rgba(120,70,25,.16)');
    c = r._coffee = { w: cam.w, h: cam.h, g };
  }
  ctx.fillStyle = c.g;
  ctx.fillRect(0, 0, cam.w, cam.h);
};
