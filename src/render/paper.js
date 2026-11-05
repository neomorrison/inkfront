// Pre-rendered page textures. Each page is painted once into an offscreen canvas (paper, fibers, grain,
// stains, ground shading, board frame) and blitted every frame. Only things that scroll with the
// camera (grid lines, margin, ground details) are drawn live by world.js.
import { RNG } from '../core/rng.js';
import { seedFromString } from '../core/rng.js';
import { TAU } from '../core/util.js';

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function blob(c, x, y, r, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function fibers(c, rng, w, h, col, n, len) {
  c.strokeStyle = col;
  c.lineWidth = 0.8;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w), y = rng.range(0, h);
    const a = rng.range(0, TAU), l = rng.range(len * 0.4, len);
    c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  c.stroke();
}

function speckles(c, rng, w, h, col, n, size) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const s = rng.range(size * 0.4, size);
    c.fillRect(rng.range(0, w), rng.range(0, h), s, s);
  }
}

function edgeShade(c, w, h, col, strength = 1) {
  const r = Math.hypot(w, h) * 0.62;
  const g = c.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, col);
  c.globalAlpha = strength;
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;
}

function wood(c, rng, x, y, w, h, base, dark, light, horizontal = true) {
  c.fillStyle = base;
  c.fillRect(x, y, w, h);
  c.strokeStyle = dark;
  c.lineWidth = 1;
  c.globalAlpha = 0.45;
  c.beginPath();
  const n = Math.max(3, Math.round((horizontal ? h : w) / 5));
  for (let i = 0; i < n; i++) {
    if (horizontal) {
      const yy = y + (i + 0.5) * (h / n) + rng.range(-1, 1);
      c.moveTo(x, yy);
      for (let xx = x; xx < x + w; xx += 40) c.quadraticCurveTo(xx + 20, yy + rng.range(-1.5, 1.5), xx + 40, yy);
    } else {
      const xx = x + (i + 0.5) * (w / n) + rng.range(-1, 1);
      c.moveTo(xx, y);
      for (let yy = y; yy < y + h; yy += 40) c.quadraticCurveTo(xx + rng.range(-1.5, 1.5), yy + 20, xx, yy + 40);
    }
  }
  c.stroke();
  c.globalAlpha = 1;
  c.fillStyle = light;
  c.globalAlpha = 0.5;
  if (horizontal) c.fillRect(x, y, w, 2); else c.fillRect(x, y, 2, h);
  c.fillStyle = dark;
  if (horizontal) c.fillRect(x, y + h - 2, w, 2); else c.fillRect(x + w - 2, y, 2, h);
  c.globalAlpha = 1;
}

const LOOKS = {
  ruled(c, rng, w, h, g, page) {
    blob(c, w * 0.3, h * 0.3, w * 0.5, '255,240,200', 0.18);
    fibers(c, rng, w, h, page.fiber, (w * h) / 5500, 11);
    speckles(c, rng, w, h, 'rgba(120,110,90,.07)', (w * h) / 5000, 1.4);
    edgeShade(c, w, h, page.edge, 0.9);
    // Blue rules, continuing (fainter) under the ground.
    c.lineWidth = 1.3;
    const gap = page.ruleGap * g.zoom;
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = page.rule;
      c.globalAlpha = pass === 0 ? 1 : 0.5;
      c.beginPath();
      if (pass === 0) for (let y = g.groundY - gap * 0.5; y > 0; y -= gap) { c.moveTo(0, y); c.lineTo(w, y); }
      else for (let y = g.groundY - gap * 0.5 + gap; y < h; y += gap) { c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
    }
    c.globalAlpha = 1;
  },
  graph(c, rng, w, h, g, page) {
    blob(c, w * 0.7, h * 0.3, w * 0.5, '230,255,240', 0.2);
    fibers(c, rng, w, h, page.fiber, (w * h) / 7000, 9);
    speckles(c, rng, w, h, 'rgba(60,90,70,.06)', (w * h) / 6000, 1.3);
    edgeShade(c, w, h, page.edge, 0.7);
  },
  sketch(c, rng, w, h, g, page) {
    blob(c, w * 0.5, h * 0.35, w * 0.6, '255,248,225', 0.3);
    blob(c, w * 0.1, h * 0.9, w * 0.4, '200,170,110', 0.08);
    fibers(c, rng, w, h, page.fiber, (w * h) / 2600, 8);
    // Paper tooth: fine grain in two tones.
    speckles(c, rng, w, h, 'rgba(110,90,60,.10)', (w * h) / 700, 1.6);
    speckles(c, rng, w, h, 'rgba(255,255,255,.35)', (w * h) / 900, 1.8);
    edgeShade(c, w, h, page.edge, 1);
    // Spiral binding across the top.
    const step = 34;
    for (let x = step / 2; x < w; x += step) {
      c.fillStyle = 'rgba(90,76,50,.55)';
      c.beginPath(); c.ellipse(x, 9, 4.2, 3.2, 0, 0, TAU); c.fill();
      c.strokeStyle = '#8f8f98';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(x - 6, -2);
      c.bezierCurveTo(x - 7, 14, x + 7, 14, x + 6, -2);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 4.5, 1); c.bezierCurveTo(x - 5, 9, x - 1, 11, x + 1, 11); c.stroke();
    }
  },
  chalk(c, rng, w, h, g, page) {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#30503f');
    bg.addColorStop(0.6, '#2c4839');
    bg.addColorStop(1, '#27403a');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    blob(c, w * 0.35, h * 0.38, w * 0.55, '120,170,140', 0.12);
    // Old erased swipes and chalk dust.
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      c.strokeStyle = `rgba(235,240,230,${rng.range(0.025, 0.06)})`;
      c.lineWidth = rng.range(28, 70);
      const x = rng.range(-50, w), y = rng.range(40, h * 0.75), l = rng.range(120, 360);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + l * 0.5, y + rng.range(-40, 40), x + l, y + rng.range(-30, 30));
      c.stroke();
    }
    for (let i = 0; i < 22; i++) blob(c, rng.range(0, w), rng.range(0, h), rng.range(40, 140), '230,240,230', rng.range(0.025, 0.06));
    speckles(c, rng, w, h, 'rgba(240,245,235,.10)', (w * h) / 2200, 1.4);
    speckles(c, rng, w, h, 'rgba(0,0,0,.10)', (w * h) / 3000, 1.5);
    edgeShade(c, w, h, page.edge, 1);
    // Wooden frame: top strip, side strips and the chalk ledge at the bottom.
    const f = Math.max(8, 12 * g.zoom);
    const led = Math.max(26, 44 * g.zoom);
    wood(c, rng, 0, 0, w, f, page.frame, '#4a3016', '#a77c4d');
    wood(c, rng, 0, 0, f * 0.8, h, page.frame, '#4a3016', '#a77c4d', false);
    wood(c, rng, w - f * 0.8, 0, f * 0.8, h, page.frame, '#4a3016', '#a77c4d', false);
    const ly = h - led;
    c.fillStyle = 'rgba(0,0,0,.30)';
    c.fillRect(0, ly - 5, w, 5);
    wood(c, rng, 0, ly, w, led, '#7a5634', '#4a3016', '#b58957');
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.fillRect(0, ly + led * 0.55, w, led * 0.45);
    // Chalk pieces and an eraser on the ledge.
    const chalks = [['#f4f1e6', 0.15], ['#ffd978', 0.27], ['#ff9c8f', 0.62], ['#a8d4ff', 0.7], ['#f4f1e6', 0.9]];
    for (const [col, fx] of chalks) {
      const x = w * fx + rng.range(-8, 8), y = ly + led * 0.28;
      c.save();
      c.translate(x, y);
      c.rotate(rng.range(-0.15, 0.15));
      c.fillStyle = col;
      c.strokeStyle = 'rgba(0,0,0,.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.rect(-14, -4, 28, 8);
      c.fill(); c.stroke();
      c.restore();
    }
    c.save();
    c.translate(w * 0.42, ly + led * 0.2);
    c.fillStyle = '#d9c9a4';
    c.fillRect(-24, 0, 48, 14);
    c.fillStyle = '#3b3b44';
    c.fillRect(-24, 9, 48, 5);
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.fillRect(-24, 0, 48, 2);
    c.restore();
  },
  last(c, rng, w, h, g, page) {
    blob(c, w * 0.5, h * 0.4, w * 0.7, '255,235,190', 0.25);
    for (let i = 0; i < 14; i++) blob(c, rng.range(0, w), rng.range(0, h), rng.range(80, 240), '170,130,70', rng.range(0.04, 0.09));
    fibers(c, rng, w, h, page.fiber, (w * h) / 3000, 12);
    speckles(c, rng, w, h, 'rgba(110,70,30,.12)', (w * h) / 2500, 1.6);
    // Faint rules.
    c.strokeStyle = page.rule;
    c.lineWidth = 1.2;
    c.globalAlpha = 0.6;
    const gap = page.ruleGap * g.zoom;
    c.beginPath();
    for (let y = g.groundY - gap * 0.5; y > 0; y -= gap) { c.moveTo(0, y); c.lineTo(w, y); }
    for (let y = g.groundY - gap * 0.5 + gap; y < h; y += gap) { c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();
    c.globalAlpha = 1;
    // Crumple creases: pairs of light and dark lines through shared points.
    for (let i = 0; i < 9; i++) {
      const pts = [];
      let x = rng.range(-40, w), y = rng.range(-40, h);
      const a = rng.range(0, TAU);
      for (let k = 0; k < 6; k++) { pts.push([x, y]); x += Math.cos(a + rng.range(-0.7, 0.7)) * rng.range(60, 190); y += Math.sin(a + rng.range(-0.7, 0.7)) * rng.range(60, 190); }
      for (const [col, off, lw] of [['rgba(80,50,20,.16)', 0, 1.4], ['rgba(255,255,245,.45)', 1.6, 1.4]]) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.beginPath();
        pts.forEach(([px, py], k) => (k ? c.lineTo(px + off, py + off) : c.moveTo(px + off, py + off)));
        c.stroke();
      }
    }
    // Fold lines.
    for (const fx of [0.33, 0.66]) {
      const x = w * fx;
      const gr = c.createLinearGradient(x - 6, 0, x + 6, 0);
      gr.addColorStop(0, 'rgba(90,60,20,0)');
      gr.addColorStop(0.5, 'rgba(90,60,20,.07)');
      gr.addColorStop(1, 'rgba(255,255,255,.06)');
      c.fillStyle = gr;
      c.fillRect(x - 6, 0, 12, h);
    }
    // Coffee rings.
    for (let i = 0; i < 3; i++) {
      const x = rng.range(w * 0.1, w * 0.9), y = rng.range(h * 0.1, h * 0.5), r = rng.range(36, 62);
      c.fillStyle = 'rgba(120,70,25,.035)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      for (let k = 0; k < 2; k++) {
        c.strokeStyle = `rgba(110,60,20,${0.28 - k * 0.1})`;
        c.lineWidth = 3 - k;
        c.beginPath();
        c.arc(x + k * 1.5, y, r - k * 2, rng.range(0, 1), rng.range(5, 6.2) + 0.8);
        c.stroke();
      }
    }
    // Ink blots with spatter.
    for (let i = 0; i < 4; i++) {
      const x = rng.range(w * 0.05, w * 0.95), y = rng.range(h * 0.08, h * 0.55), r = rng.range(5, 13);
      c.fillStyle = 'rgba(25,30,70,.78)';
      c.beginPath();
      for (let k = 0; k <= 22; k++) {
        const a = (k / 22) * TAU, rr = r * rng.range(0.85, 1.15) * (k % 5 === 0 ? 1.35 : 1);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.fill();
      for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(x + rng.range(-3, 3) * r, y + rng.range(-3, 3) * r, rng.range(0.6, 2.2), 0, TAU); c.fill(); }
    }
    edgeShade(c, w, h, 'rgba(70,40,10,.55)', 1);
    edgeShade(c, w, h, 'rgba(70,40,10,.35)', 1);
  },
};

// Ground shading under the horizon line, shared by every page.
function groundWash(c, w, h, g, page) {
  const y0 = g.groundY - 22 * g.zoom;
  const gr = c.createLinearGradient(0, y0, 0, h);
  gr.addColorStop(0, page.wash);
  gr.addColorStop(0.35, page.wash);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr;
  c.fillRect(0, y0, w, h - y0);
}

// Returns an offscreen canvas of size (w*dpr, h*dpr) painted in css pixel units.
export function buildPaper(page, w, h, dpr, groundY, zoom) {
  const cv = canvasOf(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)));
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const rng = new RNG(seedFromString(page.id) + 17);
  c.fillStyle = page.paper;
  c.fillRect(0, 0, w, h);
  (LOOKS[page.look] || LOOKS.ruled)(c, rng, w, h, { groundY, zoom }, page);
  if (page.look !== 'chalk') groundWash(c, w, h, { groundY, zoom }, page);
  else {
    // Lighter chalk dust band along the ground.
    const y0 = groundY - 22 * zoom;
    const gr = c.createLinearGradient(0, y0, 0, y0 + 110 * zoom);
    gr.addColorStop(0, 'rgba(235,240,230,.09)');
    gr.addColorStop(1, 'rgba(235,240,230,0)');
    c.fillStyle = gr;
    c.fillRect(0, y0, w, 110 * zoom);
  }
  return cv;
}
