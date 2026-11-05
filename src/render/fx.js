// Visual-only effects driven by sim events: particles, verlet ragdolls, ink splat decals, floating text.
// Uses Math.random freely (never feeds back into the sim).
// OWNER: world/FX builder (package F).
import { DEPTH } from './camera.js';
import { splatPath } from './ink.js';
import { BODY } from './stickman.js';
import { TAU } from '../core/util.js';

const G = 1500;
const MAX_PARTS = 600;
const MAX_RAGDOLLS = 70;
const MAX_TEXTS = 40;
const NAMES = ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];
const FRONT = [['head', 'neck'], ['neck', 'hip'], ['neck', 'eF'], ['eF', 'hF'], ['hip', 'kF'], ['kF', 'fF']];
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class FX {
  constructor() {
    this.parts = [];
    this.ragdolls = [];
    this.texts = [];
    this.decal = null;
    this.decalCtx = null;
    this.decalCount = 0;
    this.width = 3000;
    this.quality = 1;
    this.dustCol = 'rgba(110,105,95,.30)';
    this.smokeCol = 'rgba(70,70,80,.30)';
    this.crumbCol = '#efe3d6';
    this.onThud = null; // (x, power) called when something heavy lands
  }

  reset(width, page) {
    this.parts.length = 0;
    this.ragdolls.length = 0;
    this.texts.length = 0;
    this.width = width;
    this.decalCount = 0;
    const chalky = page && page.chalky;
    this.dustCol = chalky ? 'rgba(235,240,230,.26)' : 'rgba(110,105,95,.30)';
    this.smokeCol = chalky ? 'rgba(220,225,220,.22)' : 'rgba(70,70,80,.30)';
    this.crumbCol = chalky ? '#e9eee6' : '#efe3d6';
    if (typeof document === 'undefined') return;
    const c = this.decal || document.createElement('canvas');
    c.width = Math.ceil((width + 200) * 1.5);
    c.height = 120;
    this.decal = c;
    this.decalCtx = c.getContext('2d');
    this.decalCtx.clearRect(0, 0, c.width, c.height);
  }

  // ---- decals (persistent ink on the ground; band covers world y -40..40)
  fadeDecals() {
    // Keep the page from turning solid: every so often wash the old marks a little.
    if (++this.decalCount < 160) return;
    this.decalCount = 0;
    const c = this.decalCtx;
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.fillRect(0, 0, this.decal.width, this.decal.height);
    c.globalCompositeOperation = 'source-over';
  }

  splat(x, z, col, size = 14, alpha = 0.85) {
    if (!this.decalCtx) return;
    this.fadeDecals();
    const c = this.decalCtx;
    const px = (x + 100) * 1.5, py = (z * DEPTH + 40) * 1.5;
    c.globalAlpha = alpha;
    c.fillStyle = col;
    c.beginPath();
    splatPath(c, px, py, size * 1.5, (Math.random() * 1e6) | 0);
    c.fill();
    const drops = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < drops; i++) {
      c.beginPath();
      c.arc(px + (Math.random() * 2 - 1) * size * 2.6, py + (Math.random() * 2 - 1) * size * 0.6, 1 + Math.random() * size * 0.18, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  stain(x, z, col, rx, ry, alpha = 0.35) {
    if (!this.decalCtx) return;
    const c = this.decalCtx;
    c.globalAlpha = alpha;
    c.fillStyle = col;
    c.beginPath();
    c.ellipse((x + 100) * 1.5, (z * DEPTH + 40) * 1.5, rx * 1.5, ry * 1.5, 0, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }

  // Scorch mark: dark soft ellipse plus a few char flecks.
  scorch(x, z, r) {
    if (!this.decalCtx) return;
    this.fadeDecals();
    const c = this.decalCtx;
    const px = (x + 100) * 1.5, py = (z * DEPTH + 40) * 1.5;
    const g = c.createRadialGradient(px, py, 0, px, py, r * 1.5);
    g.addColorStop(0, 'rgba(25,22,30,.5)');
    g.addColorStop(1, 'rgba(25,22,30,0)');
    c.save();
    c.translate(px, py);
    c.scale(1, 0.32);
    c.translate(-px, -py);
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, r * 1.5, 0, TAU);
    c.fill();
    c.restore();
  }

  // Bake a settled chunk into the ground layer (rubble that stays).
  bakeRect(x, z, w, h, rot, fill, stroke) {
    if (!this.decalCtx) return;
    const c = this.decalCtx;
    c.save();
    c.translate((x + 100) * 1.5, (z * DEPTH + 40 - h * 0.5) * 1.5);
    c.rotate(rot);
    c.scale(1.5, 1.5);
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = 1.6;
    c.beginPath();
    c.rect(-w / 2, -h / 2, w, h);
    c.fill();
    c.stroke();
    c.restore();
  }

  drawDecals(ctx, cam) {
    if (!this.decal) return;
    const sx0 = (cam.x + 100) * 1.5;
    const sw = cam.viewW * 1.5;
    ctx.drawImage(this.decal, sx0, 0, sw, this.decal.height, cam.ox, cam.sy(-40), cam.w, 80 * cam.zoom);
  }

  // ---- particles. kind: dot spark drop line puff star paper crumb ring cross flame scribble brick
  add(p) {
    const cap = MAX_PARTS * this.quality;
    if (this.parts.length >= cap) {
      // Drop the oldest cheap particle but never bricks (they become rubble).
      for (let i = 0; i < 12 && i < this.parts.length; i++) if (this.parts[i].kind !== 'brick') { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); break; }
      if (this.parts.length >= cap + 40) return p;
    }
    p.life = p.life ?? 0.6;
    p.max = p.life;
    p.g = p.g ?? G * 0.6;
    p.size = p.size ?? 2;
    p.rot = p.rot ?? Math.random() * 6.28;
    p.vr = p.vr ?? 0;
    p.z = p.z ?? 0;
    p.drag = p.drag ?? 0;
    this.parts.push(p);
    return p;
  }

  burst(x, y, z, n, col, speed = 220, kind = 'dot', extra = {}) {
    n = Math.ceil(n * this.quality);
    const dirBias = extra.dir || 0;
    for (let i = 0; i < n; i++) {
      const a = (extra.angle ?? -Math.PI / 2) + (Math.random() * 2 - 1) * (extra.spread ?? 1.3);
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({ kind, x, y, z, vx: Math.cos(a) * v + (extra.vx || 0) + dirBias * speed * 0.35, vy: Math.sin(a) * v, col, size: (extra.size ?? 2.2) * (0.6 + Math.random() * 0.8), life: (extra.life ?? 0.55) * (0.6 + Math.random() * 0.8), g: extra.g, vr: (Math.random() * 2 - 1) * 10, drag: extra.drag });
    }
  }

  puff(x, y, z, col = 'rgba(80,80,90,.35)', n = 5, size = 10) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'puff', x: x + (Math.random() * 2 - 1) * 12, y: y - Math.random() * 10, z, vx: (Math.random() * 2 - 1) * 40, vy: -20 - Math.random() * 50, g: -40, col, size: size * (0.6 + Math.random() * 0.8), life: 0.7 + Math.random() * 0.5, drag: 2 });
    }
  }

  // Low ground dust that rolls outward.
  dust(x, z, n = 4, spread = 1, size = 7) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? 1 : -1;
      this.add({ kind: 'puff', x: x + d * 4, y: z * DEPTH - 2, z, vx: d * (30 + Math.random() * 90) * spread, vy: -8 - Math.random() * 22, g: -10, col: this.dustCol, size: size * (0.6 + Math.random() * 0.7), life: 0.45 + Math.random() * 0.35, drag: 3 });
    }
  }

  ring(x, y, z, col, r = 40, life = 0.35, width = 3) {
    this.add({ kind: 'ring', x, y, z, vx: 0, vy: 0, g: 0, col, size: r, life, w: width });
  }

  flame(x, y, z) {
    this.add({ kind: 'flame', x, y, z, vx: (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 40, g: -60, col: '#ff8a2b', size: 4 + Math.random() * 4, life: 0.5 + Math.random() * 0.5, drag: 1 });
  }

  crumbs(x, y, z, n, col, speed = 90) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) this.add({ kind: 'crumb', x: x + (Math.random() * 2 - 1) * 10, y: y + (Math.random() * 2 - 1) * 14, z, vx: (Math.random() * 2 - 1) * speed, vy: -Math.random() * speed, col, size: 1.2 + Math.random() * 1.6, life: 0.7 + Math.random() * 0.6, vr: (Math.random() * 2 - 1) * 12, g: 500 });
  }

  // A chunk of a destroyed building: falls, bounces, settles, then bakes into the ground layer.
  brick(x, y, z, w, h, vx, vy, fill, stroke) {
    return this.add({ kind: 'brick', x, y, z, w, h, vx, vy, g: G, fill, col: stroke, size: Math.max(w, h) * 0.5, life: 7, vr: (Math.random() * 2 - 1) * 9, onEnd: (p, fx) => { if (p.settled) fx.bakeRect(p.x, p.z, p.w, p.h, p.rot, p.fill, p.col); } });
  }

  // Pencil marks scribbled on the page while something sketches in.
  scribble(x, y, z, col) {
    this.add({ kind: 'scribble', x: x + (Math.random() * 2 - 1) * 16, y, z, vx: 0, vy: -8, g: 0, col, size: 3 + Math.random() * 3, life: 0.5 + Math.random() * 0.3, rot: (Math.random() - 0.5) * 1.2 });
  }

  // Big text pops. o: { life, vy, vx, crit, pop, outline, bold }
  text(x, y, str, col = '#1b2240', size = 18, o = {}) {
    const t = { x, y, str, col, size, life: o.life ?? 1.0, max: o.life ?? 1.0, vy: o.vy ?? -50, vx: o.vx ?? 0, outline: o.outline ?? '#fff', bold: !!o.bold, age: 0, pop: o.pop ?? 0.18, crit: !!o.crit, tilt: o.tilt ?? (Math.random() - 0.5) * 0.18 };
    this.texts.push(t);
    if (this.texts.length > MAX_TEXTS) this.texts.shift();
    return t;
  }

  // ---- ragdolls: built from a posed figure's world-space joints
  // o: { vx, vy, ground, col, back, paper, lw, scale, life, dismember, mass, spin, under, crumbCol }
  ragdoll(joints, o) {
    const cap = Math.round(MAX_RAGDOLLS * this.quality);
    if (this.ragdolls.length >= cap) {
      const old = this.ragdolls[0];
      if (old.life > 0.9) old.life = 0.9;
      // The oldest corpse is erasing; make room for the newest anyway if we are far over.
      if (this.ragdolls.length >= cap + 8) this.ragdolls.shift();
      else {
        // Rotate so the "erasing" one stays and the next-oldest starts fading too.
        for (const r of this.ragdolls) if (r.life > 0.9) { r.life = Math.min(r.life, 0.9); break; }
      }
    }
    const pts = {};
    const dt = 1 / 60;
    const vx0 = o.vx || 0, vy0 = o.vy || 0;
    const mass = o.mass || 1;
    const spin = o.spin || 0;
    const hip = joints.hip;
    for (const n of NAMES) {
      const j = joints[n];
      const jx = (Math.random() * 2 - 1) * 40, jy = (Math.random() * 2 - 1) * 40;
      const extra = n === 'head' ? 1.4 : n === 'neck' ? 1.2 : 1;
      const rx = j[0] - hip[0], ry = j[1] - hip[1];
      const svx = -ry * spin, svy = rx * spin;
      pts[n] = { x: j[0], y: j[1], ox: j[0] - (vx0 * extra + jx + svx) * dt, oy: j[1] - (vy0 * extra + jy + svy) * dt };
    }
    const link = (a, b, back) => ({ a, b, len: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y), on: true, back: !!back });
    const sticks = [link('head', 'neck'), link('neck', 'hip'), link('neck', 'eF'), link('eF', 'hF'), link('neck', 'eB', 1), link('eB', 'hB', 1), link('hip', 'kF'), link('kF', 'fF'), link('hip', 'kB', 1), link('kB', 'fB', 1)];
    const brace = link('head', 'hip');
    brace.soft = true;
    sticks.push(brace);
    if (o.dismember) {
      const cuts = [2, 4, 6, 8];
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const s = sticks[cuts[(Math.random() * cuts.length) | 0]];
        s.on = false;
        const p = pts[s.b];
        this.burst(p.x, p.y, 0, 6, o.col, 200, 'drop', { size: 1.8, life: 0.5, spread: 3 });
      }
    }
    const sc = o.scale || 1;
    this.ragdolls.push({ pts, sticks, ground: o.ground ?? 0, col: o.col, back: o.back || o.col, paper: o.paper, lw: o.lw, scale: sc, life: o.life ?? 5, max: o.life ?? 5, headR: BODY.headR * sc * (o.headScale || 1), under: o.under || null, settled: 0, mass, grav: 0.92 + 0.22 * mass, thud: false, erased: false, crumb: o.crumbCol || this.crumbCol, seed: (Math.random() * 1000) | 0 });
  }

  update(dt) {
    // Particles (swap-remove: order does not matter).
    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.life <= 0) {
        if (p.onEnd) p.onEnd(p, this);
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      if (p.settled) continue;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = p.kind;
      if (k !== 'puff' && k !== 'ring' && k !== 'flame' && k !== 'cross' && k !== 'scribble' && p.y > p.z * DEPTH && p.vy > 0) {
        p.y = p.z * DEPTH;
        if (k === 'brick') {
          if (p.vy > 70) this.dust(p.x, p.z, 1, 0.5, 4);
          p.vy *= -0.32; p.vx *= 0.6; p.vr *= 0.55;
          if (Math.abs(p.vy) < 36) { p.settled = true; p.vy = 0; p.vx = 0; p.vr = 0; p.rot = Math.round(p.rot / 1.5708) * 1.5708 + (Math.random() - 0.5) * 0.2; }
        } else { p.vy *= -0.3; p.vx *= 0.5; p.vr *= 0.5; }
      }
    }
    const rags = this.ragdolls;
    for (let i = rags.length - 1; i >= 0; i--) {
      const r = rags[i];
      r.life -= dt;
      if (r.life <= 0) { rags[i] = rags[rags.length - 1]; rags.pop(); continue; }
      if (!r.erased && r.life < 0.9) {
        r.erased = true;
        const h = r.pts.hip;
        this.crumbs(h.x, h.y - 6, 0, 8, r.crumb, 80);
        this.puff(h.x, h.y - 4, 0, this.dustCol, 2, 6);
      }
      if (r.settled > 1.2) continue;
      let moving = 0;
      const gdt = G * r.grav * dt * dt;
      const fric = r.mass > 1.6 ? 0.42 : 0.6;
      for (const k in r.pts) {
        const p = r.pts[k];
        const vx = (p.x - p.ox) * 0.995, vy = (p.y - p.oy) * 0.995;
        p.ox = p.x; p.oy = p.y;
        p.x += vx; p.y += vy + gdt;
        if (p.y > r.ground) {
          if (vy > 6 && !r.thud && (k === 'hip' || k === 'head')) {
            r.thud = true;
            if (this.onThud) this.onThud(p.x, vy * 60 * r.mass, r);
          }
          p.y = r.ground;
          // A little bounce for light figures, almost none for heavy ones.
          const bounce = vy > 7 ? 0.18 / r.mass : 0;
          p.ox = p.x - vx * fric;
          p.oy = p.y + vy * bounce;
        }
        moving += Math.abs(vx) + Math.abs(vy);
      }
      for (let it = 0; it < 3; it++) {
        for (const s of r.sticks) {
          if (!s.on) continue;
          const a = r.pts[s.a], b = r.pts[s.b];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (s.soft && d < s.len * 0.75) continue;
          const diff = ((d - s.len) / d) * (s.soft ? 0.1 : 0.5);
          a.x += dx * diff; a.y += dy * diff;
          b.x -= dx * diff; b.y -= dy * diff;
        }
      }
      r.settled = moving < 0.6 ? r.settled + dt : 0;
    }
    const tx = this.texts;
    for (let i = tx.length - 1; i >= 0; i--) {
      const t = tx[i];
      t.life -= dt;
      t.age += dt;
      t.y += t.vy * dt;
      t.x += t.vx * dt;
      t.vy *= Math.pow(0.04, dt);
      if (t.life <= 0) { tx[i] = tx[tx.length - 1]; tx.pop(); }
    }
  }

  drawRagdolls(ctx, cam) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const zoom = cam.zoom;
    for (const r of this.ragdolls) {
      const P = r.pts;
      if (!cam.visible(P.hip.x, 150)) continue;
      const a = Math.min(1, r.life / 0.9);
      ctx.globalAlpha = a;
      // Erasing: a little rubbing jitter.
      const jx = r.life < 0.9 ? Math.sin(r.life * 70 + r.seed) * 1.4 : 0;
      const sx = (p) => cam.sx(p.x) + jx, sy = (p) => cam.sy(p.y);
      const lw = r.lw * zoom * r.scale;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? r.back : r.col;
        ctx.lineWidth = lw * (pass === 0 ? 0.92 : 1);
        ctx.beginPath();
        for (const s of r.sticks) {
          if (s.soft || !s.on || (pass === 0) !== s.back) continue;
          const A = P[s.a], B = P[s.b];
          ctx.moveTo(sx(A), sy(A)); ctx.lineTo(sx(B), sy(B));
        }
        ctx.stroke();
        if (pass === 0) continue;
      }
      const hx = sx(P.head), hy = sy(P.head);
      const hr = r.headR * zoom;
      ctx.fillStyle = r.paper;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, TAU);
      ctx.fill();
      ctx.lineWidth = lw * 0.95;
      ctx.strokeStyle = r.col;
      ctx.stroke();
      // X eyes, tilted with the head (neck to head direction).
      const N = P.neck;
      const ang = Math.atan2(P.head.y - N.y, P.head.x - N.x) + Math.PI / 2;
      const e = hr * 0.2;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(ang);
      ctx.lineWidth = Math.max(1, hr * 0.15);
      ctx.beginPath();
      for (const dx of [-hr * 0.34, hr * 0.34]) {
        ctx.moveTo(dx - e, -e - hr * 0.05); ctx.lineTo(dx + e, e - hr * 0.05);
        ctx.moveTo(dx + e, -e - hr * 0.05); ctx.lineTo(dx - e, e - hr * 0.05);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx, cam) {
    const z = cam.zoom;
    const parts = this.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.delay > 0 || !cam.visible(p.x, 60)) continue;
      const a = Math.min(1, p.life / (p.max * 0.5));
      const x = cam.sx(p.x), y = cam.sy(p.y);
      const s = p.size * z;
      ctx.globalAlpha = a;
      switch (p.kind) {
        case 'dot':
        case 'drop':
          ctx.fillStyle = p.col;
          ctx.beginPath();
          if (p.kind === 'drop') ctx.ellipse(x, y, s * 1.5, s * 0.8, Math.atan2(p.vy, p.vx), 0, TAU);
          else ctx.arc(x, y, s, 0, TAU);
          ctx.fill();
          break;
        case 'line':
        case 'spark':
          ctx.strokeStyle = p.col;
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1, s * (p.kind === 'spark' ? 0.9 : 0.6));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.035 * z, y - p.vy * 0.035 * z); ctx.stroke();
          break;
        case 'puff': {
          // Pencil-scribbled smoke: a faint fill with a thin loop around it.
          const rr = s * (1.5 - a * 0.5);
          ctx.fillStyle = p.col;
          ctx.globalAlpha = a * 0.55;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
          ctx.globalAlpha = a * 0.8;
          ctx.strokeStyle = p.col;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(x, y, rr * 0.92, p.rot, p.rot + 5.2); ctx.stroke();
          break;
        }
        case 'star':
          ctx.fillStyle = p.col;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.beginPath();
          for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.45 : s * 1.2; const an = (k / 8) * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          ctx.closePath(); ctx.fill(); ctx.restore();
          break;
        case 'paper':
        case 'crumb':
          ctx.fillStyle = p.col;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillRect(-s, -s * (p.kind === 'paper' ? 0.6 : 0.8), s * 2, s * (p.kind === 'paper' ? 1.2 : 1.6));
          ctx.restore();
          break;
        case 'ring': {
          const k = 1 - p.life / p.max;
          ctx.strokeStyle = p.col;
          ctx.lineWidth = (p.w || 3) * (1 - k) + 0.5;
          const rr = s * (0.25 + k * 0.95);
          ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.38, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'cross':
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = s * 0.9 + 2.4;
          ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
          ctx.strokeStyle = p.col;
          ctx.lineWidth = s * 0.9;
          ctx.stroke();
          break;
        case 'flame': {
          const k = p.life / p.max;
          const h = s * (1.4 + Math.sin(p.rot * 3) * 0.2) * (0.4 + k);
          const w = s * 0.9 * (0.5 + k * 0.5);
          ctx.fillStyle = k > 0.5 ? '#ff7a1f' : '#d1342b';
          ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.7, x, y - h * 1.8); ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.7, x + w, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd34a';
          ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.5, x, y - h * 1.1); ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.5, x + w * 0.5, y); ctx.closePath(); ctx.fill();
          break;
        }
        case 'scribble': {
          ctx.strokeStyle = p.col;
          ctx.lineWidth = Math.max(1, z * 1.1);
          ctx.beginPath();
          for (let k = 0; k < 5; k++) { const px = x + (k - 2) * s * 0.9, py = y + (k % 2 ? -1 : 1) * s * 0.7; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.stroke();
          break;
        }
        case 'brick':
          ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(x, y - (p.settled ? p.h * 0.5 * z : 0)); ctx.rotate(p.rot);
          ctx.fillStyle = p.fill; ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1.2, 1.6 * z);
          ctx.beginPath(); ctx.rect(-p.w * 0.5 * z, -p.h * 0.5 * z, p.w * z, p.h * z); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        default:
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, cam) {
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.35));
      ctx.globalAlpha = a;
      // Pop: overshoot in, settle, then shrink slightly while fading.
      const k = Math.min(1, t.age / t.pop);
      const sc = (0.4 + 0.6 * easeOutBack(k)) * (t.crit ? 1.15 : 1) * (a < 1 ? 0.85 + 0.15 * a : 1);
      const size = Math.max(9, Math.round(t.size * Math.max(0.75, cam.zoom * 0.9) * sc));
      ctx.font = `${size}px 'Permanent Marker', cursive`;
      const x = cam.sx(t.x), y = cam.sy(t.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.tilt);
      if (t.outline) { ctx.strokeStyle = t.outline; ctx.lineWidth = Math.max(3.5, size * 0.28); ctx.strokeText(t.str, 0, 0); }
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
