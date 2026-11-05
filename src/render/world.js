// The page: paper, parallax doodles, the ground, ink wells and forts.
// OWNER: world/FX builder (package F). Paper textures live in paper.js, doodles in doodles.js, forts in forts.js.
import { PAGES } from '../data/pages.js';
import { RNG } from '../core/rng.js';
import { clamp, TAU } from '../core/util.js';
import { DEPTH } from './camera.js';
import { splatPath, roundRect, wob } from './ink.js';
import { buildPaper } from './paper.js';

// FORT_DRAW[style] = (ctx, cam, fort, pal, t, world) ; DOODLE_DRAW[type] = (ctx, x, y, s, col, seed, frame)
export const FORT_DRAW = {};
export const DOODLE_DRAW = {};

// Doodles that sit on the horizon; everything else floats in the sky or margin.
const GROUNDED = new Set(['hill', 'mountain', 'tree', 'house', 'flower', 'vase', 'ghost', 'unfinished', 'cube', 'triangle', 'bars', 'apple', 'flask', 'globe', 'crossed']);
const BIG_BACK = new Set(['hill', 'mountain']);

export class World {
  constructor() {
    this.page = PAGES.ruled;
    this.doodles = [];
    this.flora = [];
    this.near = [];
    this.width = 3000;
    this.dpr = 1;
    this.paper = null;
    this.paperKey = '';
    this.btime = 0; // battle clock, set by the renderer each frame
    this.fortSt = [this.newFortState(), this.newFortState()];
    this.cur = { flash: 0, hp: 1 };
    this.smokeT = 0;
  }

  newFortState() {
    return { deadAt: null, hitT: -99, bell: 0, hp: 1 };
  }

  setup(battle) {
    this.page = PAGES[battle.page] || PAGES.ruled;
    this.width = battle.width;
    this.paperKey = '';
    this.fortSt = [this.newFortState(), this.newFortState()];
    const rng = new RNG((battle.seed || 1) * 31 + 7 + this.page.id.length * 101);
    const p = this.page;
    const types = p.doodles || ['cloud'];
    this.doodles = [];
    let sky = false;
    for (let x = -500; x < this.width + 700; x += rng.range(130, 260)) {
      const type = rng.pick(types);
      if ((type === 'sun' || type === 'moon') && sky) continue;
      if (type === 'sun' || type === 'moon') sky = true;
      const grounded = GROUNDED.has(type);
      const far = rng.chance(0.4);
      const par = type === 'sun' || type === 'moon' ? 0.08 : BIG_BACK.has(type) ? rng.range(0.35, 0.5) : grounded ? rng.range(0.28, 0.6) : far ? rng.range(0.1, 0.26) : rng.range(0.3, 0.7);
      const y = grounded ? -rng.range(18, 40) : type === 'sun' || type === 'moon' ? -rng.range(300, 380) : type === 'cloud' || type === 'bird' ? -rng.range(250, 400) : -rng.range(130, 340);
      const sc = (grounded ? rng.range(0.8, 1.3) : rng.range(0.8, 1.35)) * (par < 0.26 ? 0.8 : 1);
      this.doodles.push({ type, x, y, par, s: sc, seed: rng.int(1, 9999), a: par < 0.26 ? 0.5 : par < 0.42 ? 0.78 : 1 });
    }
    // Second pass: fill the sky with far-away light doodles so the top of the page is never bare.
    const skyTypes = types.filter((ty) => !GROUNDED.has(ty) && ty !== 'sun' && ty !== 'moon');
    if (skyTypes.length) {
      for (let x = -500; x < this.width + 700; x += rng.range(210, 380)) {
        this.doodles.push({ type: rng.pick(skyTypes), x, y: -rng.range(250, 440), par: rng.range(0.1, 0.3), s: rng.range(0.7, 1.1), seed: rng.int(1, 9999), a: 0.5 });
      }
    }
    this.doodles.sort((a, b) => a.par - b.par);
    // Ground details: tufts, pebbles, flowers... by page flavor.
    const kinds = p.flora || ['tuft'];
    this.flora = [];
    for (let x = 0; x < this.width; x += rng.range(14, 46)) {
      this.flora.push({ x, z: rng.range(-1.1, 1.8), seed: rng.int(1, 9999), kind: rng.pick(kinds), v: rng.int(0, 2), s: rng.range(0.8, 1.4) });
    }
    // Foreground band (below the ground rows): parallax > 1 so it slides past faster.
    this.near = [];
    for (let x = -300; x < this.width + 500; x += rng.range(90, 230)) {
      this.near.push({ x, y: rng.range(0.55, 1), kind: rng.pick(kinds), v: rng.int(0, 2), seed: rng.int(1, 9999), s: rng.range(1.3, 2.4) });
    }
  }

  ensurePaper(cam) {
    const key = `${this.page.id}|${cam.w}|${cam.h}|${this.dpr}|${cam.groundY}`;
    if (key !== this.paperKey) {
      this.paperKey = key;
      this.paper = buildPaper(this.page, cam.w, cam.h, this.dpr, cam.groundY, cam.zoom);
    }
  }

  drawBackground(ctx, cam, t) {
    const p = this.page;
    const z = cam.zoom;
    this.ensurePaper(cam);
    ctx.drawImage(this.paper, 0, 0, cam.w, cam.h);
    if (p.grid) this.drawGrid(ctx, cam);
    if (p.margin) {
      const mx = cam.sx(-30);
      if (mx > -4 && mx < cam.w + 4) {
        ctx.strokeStyle = p.margin;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, cam.h); ctx.moveTo(mx + 5, 0); ctx.lineTo(mx + 5, cam.h);
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Punch holes in the margin strip (left of the line).
        ctx.fillStyle = 'rgba(0,0,0,.10)';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) ctx.arc(mx - 22, cam.h * (0.18 + i * 0.33), 10, 0, TAU);
        ctx.fill();
      }
    }
    // Page edge: beyond the world, show where the paper ends.
    const f = Math.floor(t * 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawHorizon(ctx, cam, f);
    for (const d of this.doodles) {
      const sx = (d.x - cam.x * d.par) * z;
      if (sx < -260 * z || sx > cam.w + 260 * z) continue;
      const fn = DOODLE_DRAW[d.type];
      if (!fn) continue;
      ctx.globalAlpha = d.a;
      fn(ctx, sx, cam.groundY + d.y * z, d.s * z, p.doodle, d.seed, f);
    }
    ctx.globalAlpha = 1;
  }

  drawGrid(ctx, cam) {
    const p = this.page, g = p.grid, z = cam.zoom;
    const gap = g.gap * z;
    const ox = -((cam.x * z) % gap);
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? g.color : g.major;
      ctx.beginPath();
      let i = Math.floor(cam.x / g.gap);
      for (let x = ox; x < cam.w; x += gap, i++) {
        if ((pass === 1) !== (i % g.every === 0)) continue;
        ctx.moveTo(x, 0); ctx.lineTo(x, cam.h);
      }
      let k = 0;
      for (let y = cam.groundY; y > -gap; y -= gap, k++) {
        if ((pass === 1) !== (k % g.every === 0)) continue;
        ctx.moveTo(0, y); ctx.lineTo(cam.w, y);
      }
      k = 1;
      for (let y = cam.groundY + gap; y < cam.h; y += gap, k++) {
        if ((pass === 1) !== (k % g.every === 0 && false)) continue;
        ctx.moveTo(0, y); ctx.lineTo(cam.w, y);
      }
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }

  // Distant rolling silhouette behind the armies.
  drawHorizon(ctx, cam, f) {
    const h = this.page.horizon;
    if (!h) return;
    const z = cam.zoom, base = cam.groundY - 22 * z;
    const step = 14 * z;
    const sh = (wx) => {
      const a = Math.sin(wx * 0.0042) + 0.55 * Math.sin(wx * 0.0113 + 2) + 0.25 * Math.sin(wx * 0.027 + 1);
      if (h.jagged) return Math.abs(Math.sin(wx * 0.0049 + 1)) * 0.8 + Math.abs(Math.sin(wx * 0.013)) * 0.3 + 0.1;
      return (a + 1.8) / 3.6;
    };
    const x0 = -step;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    for (let x = x0; x <= cam.w + step; x += step) {
      const wx = x / z + cam.x * h.par;
      ctx.lineTo(x, base - sh(wx) * h.amp * z);
    }
    ctx.lineTo(cam.w + step, base);
    ctx.closePath();
    ctx.fillStyle = h.fill;
    ctx.fill();
    ctx.strokeStyle = h.col;
    ctx.lineWidth = 1.7;
    if (h.dashed) ctx.setLineDash([9 * z, 6 * z]);
    ctx.beginPath();
    for (let x = x0, i = 0; x <= cam.w + step; x += step, i++) {
      const wx = x / z + cam.x * h.par;
      const y = base - sh(wx) * h.amp * z;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (h.shade) {
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let x = x0; x <= cam.w + step; x += step * 1.4) {
        const wx = x / z + cam.x * h.par;
        const y = base - sh(wx) * h.amp * z;
        ctx.moveTo(x, y + 3); ctx.lineTo(x - 6 * z, y + Math.min(22 * z, base - y));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawGround(ctx, cam, t) {
    const p = this.page, z = cam.zoom;
    const gy = cam.sy(-DEPTH - 8);
    const chalky = !!p.chalky;
    // Short pencil hatch strokes just under the line.
    ctx.strokeStyle = p.hatch;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const step = 9 * z;
    const x0 = -((cam.x * z) % step) - step;
    const band = 46 * z;
    for (let x = x0, i = Math.floor(cam.x / 9); x < cam.w + step; x += step, i++) {
      const len = band * (0.4 + ((i * 7919) % 13) / 22);
      ctx.moveTo(x, gy + 5);
      ctx.lineTo(x - len * 0.55, gy + 5 + len);
    }
    ctx.stroke();
    this.drawNear(ctx, cam, t);
    // Ground line: two confident passes with different wobble, like a pen going over it twice.
    const fr = Math.floor(t * 2);
    const seg = 48;
    const startW = Math.floor(cam.x / seg) * seg - seg;
    ctx.strokeStyle = p.ground;
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass === 0 ? 2.8 : 1.3;
      ctx.globalAlpha = pass === 0 ? 1 : 0.55;
      ctx.beginPath();
      for (let wx = startW; wx < cam.x + cam.viewW + seg; wx += seg) {
        const yy = gy + wob(wx | 0, 1 + pass * 7, fr, 1.3) + pass * 2.5 * z;
        if (wx === startW) ctx.moveTo(cam.sx(wx), yy);
        else ctx.lineTo(cam.sx(wx), yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.drawFlora(ctx, cam, chalky);
  }

  drawFlora(ctx, cam, chalky) {
    const p = this.page, z = cam.zoom;
    const col = p.ground;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    // Tufts and weeds (one path).
    ctx.beginPath();
    for (const tf of this.flora) {
      if (!cam.visible(tf.x, 40)) continue;
      const x = cam.sx(tf.x), y = cam.sy(tf.z * DEPTH + 6);
      const s = z * 3.2 * tf.s;
      if (tf.kind === 'tuft' || tf.kind === 'flower') {
        ctx.moveTo(x - s, y - s * 1.4); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.4, y - s * 1.8);
        if (tf.v > 0) { ctx.moveTo(x + s * 0.8, y); ctx.lineTo(x + s * 1.6, y - s * 1.2); }
      } else if (tf.kind === 'weed') {
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.3, y - s * 1.6, x + s * 1.2, y - s * 2.2);
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.5, y - s * 1.2, x - s * 1.4, y - s * 1.6);
        ctx.moveTo(x, y); ctx.lineTo(x - s * 0.1, y - s * 2.4);
      } else if (tf.kind === 'crack') {
        ctx.moveTo(x - s * 2, y); ctx.lineTo(x - s * 0.6, y + s * 0.7); ctx.lineTo(x + s * 0.3, y - s * 0.3); ctx.lineTo(x + s * 2.2, y + s * 0.4);
      } else if (tf.kind === 'star') {
        ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      } else if (tf.kind === 'chalk') {
        ctx.moveTo(x - s * 1.5, y); ctx.lineTo(x + s * 1.4, y - s * 0.3);
        ctx.moveTo(x - s * 0.8, y + s * 0.7); ctx.lineTo(x + s * 0.6, y + s * 0.5);
      }
      if (tf.kind === 'flower') { ctx.moveTo(x + s * 2.4, y); ctx.lineTo(x + s * 2.4, y - s * 3.2); }
    }
    ctx.stroke();
    // Pebbles (stroked ovals), then flower heads (filled, 3 colors).
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const tf of this.flora) {
      if (tf.kind !== 'pebble' || !cam.visible(tf.x, 40)) continue;
      const x = cam.sx(tf.x), y = cam.sy(tf.z * DEPTH + 7);
      const s = z * 3.4 * tf.s;
      ctx.moveTo(x + s * 1.6, y);
      ctx.ellipse(x, y, s * 1.6, s * 1.0, 0.2 * tf.v, 0, TAU);
      if (tf.v === 1) { ctx.moveTo(x + s * 4.6, y + s * 0.4); ctx.ellipse(x + s * 3.6, y + s * 0.4, s * 0.9, s * 0.6, 0, 0, TAU); }
    }
    ctx.stroke();
    const heads = chalky ? ['#fff', '#ffd978', '#ffb3c4'] : ['#ef6a6a', '#f2c230', '#e98fc1'];
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = heads[c];
      ctx.beginPath();
      let any = false;
      for (const tf of this.flora) {
        if (tf.kind !== 'flower' || tf.v !== c || !cam.visible(tf.x, 40)) continue;
        const s = z * 3.2 * tf.s;
        const x = cam.sx(tf.x) + s * 2.4, y = cam.sy(tf.z * DEPTH + 6) - s * 3.6;
        ctx.moveTo(x + s * 1.3, y);
        ctx.arc(x, y, s * 1.3, 0, TAU);
        any = true;
      }
      if (any) ctx.fill();
    }
  }

  // Big blurry-ish things in the bottom band that scroll faster than the ground.
  drawNear(ctx, cam, t) {
    const z = cam.zoom, p = this.page;
    ctx.strokeStyle = p.ground;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const room = cam.h - cam.groundY - 40 * z;
    for (const n of this.near) {
      const sx = (n.x - cam.x * 1.3) * z;
      if (sx < -60 || sx > cam.w + 60) continue;
      const y = cam.groundY + 38 * z + n.y * room * 0.8;
      const s = z * 3.4 * n.s;
      if (n.kind === 'pebble' || n.kind === 'crack') { ctx.moveTo(sx + s * 1.6, y); ctx.ellipse(sx, y, s * 1.6, s, 0, 0, TAU); }
      else if (n.kind === 'chalk') { ctx.moveTo(sx - s * 2, y); ctx.lineTo(sx + s * 2, y - s * 0.4); }
      else if (n.kind === 'star') { ctx.moveTo(sx - s, y - s); ctx.lineTo(sx + s, y + s); ctx.moveTo(sx + s, y - s); ctx.lineTo(sx - s, y + s); }
      else {
        ctx.moveTo(sx - s * 1.2, y - s * 2); ctx.lineTo(sx, y); ctx.lineTo(sx + s * 0.5, y - s * 2.6);
        ctx.moveTo(sx, y); ctx.lineTo(sx + s * 1.6, y - s * 1.6);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawWell(ctx, cam, w, pal, t) {
    if (!cam.visible(w.x, 80)) return;
    const big = w.team === -1;
    const chalky = !!this.page.chalky;
    const x = cam.sx(w.x), y = cam.sy(-4);
    const s = cam.zoom * (big ? 1.5 : 1);
    const pool = chalky ? ((pal && pal.dark) || '#5d97d6') : '#1b2240';
    ctx.fillStyle = pool;
    ctx.beginPath();
    splatPath(ctx, x, y + 2 * s, 30 * s, w.id * 17 + 3);
    ctx.fill();
    // Shine and ripples.
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath();
    ctx.ellipse(x - 8 * s, y - 2 * s, 7 * s, 2.2 * s, -0.2, 0, TAU);
    ctx.fill();
    const rp = (t * 0.8 + w.id * 0.4) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - rp)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x + 4 * s, y + 2 * s, (6 + rp * 18) * s, (2 + rp * 5) * s, 0, 0, TAU);
    ctx.stroke();
    // Tipped ink bottle with a label.
    ctx.save();
    ctx.translate(x + 20 * s, y - 6 * s);
    ctx.rotate(-1.1);
    ctx.fillStyle = (pal && pal.light) || '#c8d4f5';
    ctx.strokeStyle = chalky ? '#e8f0e6' : '#1b2240';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, -9 * s, -11 * s, 18 * s, 20 * s, 4 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pool;
    ctx.fillRect(-7 * s, -2 * s, 14 * s, 9 * s);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(-5 * s, 0, 10 * s, 5 * s);
    ctx.fillStyle = pal && pal.light ? pal.light : '#c8d4f5';
    ctx.beginPath();
    ctx.rect(-4 * s, -16 * s, 8 * s, 5 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Bubbles.
    for (let i = 0; i < 2; i++) {
      const b = (t * 1.3 + w.id * 0.37 + i * 0.5) % 1;
      ctx.strokeStyle = chalky ? 'rgba(255,255,255,.6)' : 'rgba(27,34,64,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - (6 - i * 9) * s, y - 4 * s - b * 14 * s, (1 - b) * 3 * s + 1, 0, TAU);
      ctx.stroke();
    }
  }

  // ---- forts: state, collapse transform, rubble. Styles live in forts.js.
  drawFort(ctx, cam, f, pal, t, style) {
    if (!cam.visible(f.x, 220)) return;
    const st = this.fortSt[f.team] || (this.fortSt[f.team] = this.newFortState());
    const fn = FORT_DRAW[style] || FORT_DRAW.castle;
    if (!fn) return;
    const sx = cam.sx(f.x), sy = cam.sy(f.z * DEPTH);
    if (f.alive) {
      if (f.hp < st.hp - 0.5) st.hitT = t;
      st.hp = f.hp;
      const hk = Math.max(0, 1 - (t - st.hitT) / 0.16);
      this.cur = { flash: hk, hp: f.maxHp > 0 ? f.hp / f.maxHp : 0, t, st };
      if (hk > 0) {
        ctx.save();
        ctx.translate(sx + Math.sin(t * 90) * 2.2 * hk * cam.zoom, sy);
        ctx.scale(1 + 0.012 * hk, 1 - 0.018 * hk);
        ctx.translate(-sx, -sy);
        fn(ctx, cam, f, pal, t, this);
        ctx.restore();
      } else fn(ctx, cam, f, pal, t, this);
      return;
    }
    // Destroyed: first a quick collapse of the damaged building, then rubble.
    if (st.deadAt == null) st.deadAt = t - 99;
    const age = t - st.deadAt;
    this.cur = { flash: 0, hp: 0.04, t, st };
    this.drawRubble(ctx, cam, f, pal, style);
    if (age < 0.6) {
      const k = age / 0.6, e = k * k;
      const view = { ...f, alive: true, hp: f.maxHp * 0.04, turret: { ...f.turret, on: false } };
      ctx.save();
      ctx.translate(sx + Math.sin(t * 70) * (1 - k) * 3 * cam.zoom, sy);
      ctx.scale(1 + 0.16 * e, 1 - 0.8 * e);
      ctx.translate(-sx, -sy);
      ctx.globalAlpha = 1 - e * 0.5;
      fn(ctx, cam, view, pal, t, this);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawRubble(ctx, cam, f, pal, style) {
    const z = cam.zoom;
    const x = cam.sx(f.x), y = cam.sy(f.z * DEPTH);
    const rub = FORT_DRAW[style + ':rubble'];
    if (rub) { rub(ctx, cam, f, pal, this.cur.t, this); return; }
    ctx.lineJoin = 'round';
    ctx.fillStyle = pal.light;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - 66 * z, y);
    ctx.lineTo(x - 52 * z, y - 18 * z); ctx.lineTo(x - 30 * z, y - 12 * z); ctx.lineTo(x - 14 * z, y - 34 * z);
    ctx.lineTo(x + 8 * z, y - 20 * z); ctx.lineTo(x + 28 * z, y - 28 * z); ctx.lineTo(x + 50 * z, y - 10 * z); ctx.lineTo(x + 68 * z, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Smoke and flames on damaged forts; embers on rubble. Called from the fixed update.
  updateForts(b, fx, dt) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.07;
    for (const tm of b.teams) {
      const f = tm.fort;
      const st = this.fortSt[f.team];
      const dir = tm.dir;
      if (f.alive) {
        const pct = f.maxHp > 0 ? f.hp / f.maxHp : 1;
        if (pct >= 0.3) continue;
        const heavy = pct < 0.15;
        if (Math.random() < (heavy ? 0.9 : 0.5)) {
          const top = Math.random() < 0.4;
          const px = top ? f.x - dir * 45 + (Math.random() - 0.5) * 30 : f.x + (Math.random() - 0.5) * 100;
          const py = (top ? -196 : -118) + 4 + f.z * DEPTH;
          fx.flame(px, py, f.z);
        }
        if (Math.random() < 0.5) fx.add({ kind: 'puff', x: f.x + (Math.random() - 0.5) * 90, y: -120 - Math.random() * 60, z: f.z, vx: dir * -(5 + Math.random() * 25), vy: -40 - Math.random() * 30, g: -20, col: 'rgba(70,70,80,.30)', size: 9 + Math.random() * 7, life: 1.4 + Math.random(), drag: 1 });
      } else if (st && st.deadAt != null && this.cur.t - st.deadAt < 9 && Math.random() < 0.4) {
        fx.add({ kind: 'puff', x: f.x + (Math.random() - 0.5) * 80, y: -20 - Math.random() * 20, z: f.z, vx: (Math.random() - 0.5) * 20, vy: -35 - Math.random() * 30, g: -15, col: 'rgba(70,70,80,.26)', size: 8 + Math.random() * 6, life: 1.6, drag: 1 });
      }
    }
  }

  drawFlag(ctx, cam, x, pal, t, solid) {
    const sx = cam.sx(x), sy = cam.sy(-DEPTH - 6), z = cam.zoom;
    ctx.globalAlpha = solid ? 1 : 0.35;
    ctx.strokeStyle = this.page.chalky ? '#e8f0e6' : '#1b2240';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 70 * z);
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    const w = Math.sin(t * 6) * 3 * z;
    ctx.moveTo(sx, sy - 70 * z);
    ctx.quadraticCurveTo(sx + 16 * z, sy - 74 * z + w, sx + 34 * z, sy - 64 * z + w);
    ctx.quadraticCurveTo(sx + 16 * z, sy - 56 * z - w, sx, sy - 50 * z);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (solid) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * z, 14 * z, 4 * z, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export function clampWorld(x, w) { return clamp(x, 0, w); }
