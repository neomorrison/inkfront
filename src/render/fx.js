// Visual-only effects driven by sim events: particles, verlet ragdolls, ink splat decals,
// floating text. Uses Math.random freely (never feeds back into the sim).
// OWNER: world/FX builder (package F) extends kinds and juice.
import { DEPTH } from './camera.js';
import { splatPath } from './ink.js';
import { BODY } from './stickman.js';

const G = 1500;
const MAX_PARTS = 700;
const MAX_RAGDOLLS = 70;

export class FX {
  constructor() {
    this.parts = [];
    this.ragdolls = [];
    this.texts = [];
    this.decal = null;
    this.decalCtx = null;
    this.width = 3000;
    this.quality = 1;
  }

  reset(width) {
    this.parts.length = 0;
    this.ragdolls.length = 0;
    this.texts.length = 0;
    this.width = width;
    if (typeof document === 'undefined') return;
    const c = this.decal || document.createElement('canvas');
    c.width = Math.ceil((width + 200) * 1.5);
    c.height = 120;
    this.decal = c;
    this.decalCtx = c.getContext('2d');
    this.decalCtx.clearRect(0, 0, c.width, c.height);
  }

  // ---- decals (persistent ink on the ground; band covers world y -40..40)
  splat(x, z, col, size = 14, alpha = 0.85) {
    if (!this.decalCtx) return;
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
      c.arc(px + (Math.random() * 2 - 1) * size * 2.6, py + (Math.random() * 2 - 1) * size * 0.6, 1 + Math.random() * size * 0.18, 0, Math.PI * 2);
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
    c.ellipse((x + 100) * 1.5, (z * DEPTH + 40) * 1.5, rx * 1.5, ry * 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  drawDecals(ctx, cam) {
    if (!this.decal) return;
    const sx0 = (cam.x + 100) * 1.5;
    const sw = cam.viewW * 1.5;
    ctx.drawImage(this.decal, sx0, 0, sw, this.decal.height, cam.ox, cam.sy(-40), cam.w, 80 * cam.zoom);
  }

  // ---- particles. kind: dot | line | puff | star | paper | crumb | ring
  add(p) {
    if (this.parts.length >= MAX_PARTS * this.quality) this.parts.shift();
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
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() * 2 - 1) * (extra.spread ?? 1.3);
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({ kind, x, y, z, vx: Math.cos(a) * v + (extra.vx || 0), vy: Math.sin(a) * v, col, size: (extra.size ?? 2.2) * (0.6 + Math.random() * 0.8), life: (extra.life ?? 0.55) * (0.6 + Math.random() * 0.8), g: extra.g, vr: (Math.random() * 2 - 1) * 10, drag: extra.drag });
    }
  }

  puff(x, y, z, col = 'rgba(80,80,90,.35)', n = 5, size = 10) {
    for (let i = 0; i < n * this.quality; i++) {
      this.add({ kind: 'puff', x: x + (Math.random() * 2 - 1) * 12, y: y - Math.random() * 10, z, vx: (Math.random() * 2 - 1) * 40, vy: -20 - Math.random() * 50, g: -40, col, size: size * (0.6 + Math.random() * 0.8), life: 0.7 + Math.random() * 0.5, drag: 2 });
    }
  }

  ring(x, y, z, col, r = 40, life = 0.35) {
    this.add({ kind: 'ring', x, y, z, vx: 0, vy: 0, g: 0, col, size: r, life });
  }

  text(x, y, str, col = '#1b2240', size = 18, o = {}) {
    this.texts.push({ x, y, str, col, size, life: o.life ?? 1.0, max: o.life ?? 1.0, vy: o.vy ?? -50, outline: o.outline ?? '#fff', bold: !!o.bold });
    if (this.texts.length > 60) this.texts.shift();
  }

  // ---- ragdolls: built from a posed figure's world-space joints
  ragdoll(joints, o) {
    if (this.ragdolls.length >= MAX_RAGDOLLS) this.ragdolls.shift();
    const names = ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];
    const pts = {};
    const dt = 1 / 60;
    const vx0 = o.vx || 0, vy0 = o.vy || 0;
    for (const n of names) {
      const j = joints[n];
      const jx = (Math.random() * 2 - 1) * 40, jy = (Math.random() * 2 - 1) * 40;
      const extra = n === 'head' ? 1.4 : n === 'neck' ? 1.2 : 1;
      pts[n] = { x: j[0], y: j[1], ox: j[0] - (vx0 * extra + jx) * dt, oy: j[1] - (vy0 * extra + jy) * dt };
    }
    const link = (a, b) => ({ a, b, len: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y), on: true });
    const sticks = [link('head', 'neck'), link('neck', 'hip'), link('neck', 'eF'), link('eF', 'hF'), link('neck', 'eB'), link('eB', 'hB'), link('hip', 'kF'), link('kF', 'fF'), link('hip', 'kB'), link('kB', 'fB')];
    const brace = link('head', 'hip');
    brace.soft = true;
    sticks.push(brace);
    if (o.dismember) {
      const cuts = [2, 4, 6, 8];
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) sticks[cuts[(Math.random() * cuts.length) | 0]].on = false;
    }
    this.ragdolls.push({ pts, sticks, ground: o.ground ?? 0, col: o.col, back: o.back || o.col, paper: o.paper, lw: o.lw, scale: o.scale || 1, life: o.life ?? 5, max: o.life ?? 5, headR: BODY.headR * (o.scale || 1) * (o.headScale || 1), under: o.under || null, settled: 0 });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (p.drag) { p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt); }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind !== 'puff' && p.kind !== 'ring' && p.y > p.z * DEPTH && p.vy > 0) {
        p.y = p.z * DEPTH; p.vy *= -0.3; p.vx *= 0.5; p.vr *= 0.5;
        if (p.kind === 'dot' && p.onGround) p.onGround(p);
      }
    }
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const r = this.ragdolls[i];
      r.life -= dt;
      if (r.life <= 0) { this.ragdolls.splice(i, 1); continue; }
      if (r.settled > 1.2) continue;
      let moving = 0;
      for (const k in r.pts) {
        const p = r.pts[k];
        const vx = (p.x - p.ox) * 0.995, vy = (p.y - p.oy) * 0.995;
        p.ox = p.x; p.oy = p.y;
        p.x += vx; p.y += vy + G * dt * dt;
        if (p.y > r.ground) { p.y = r.ground; p.ox = p.x - vx * 0.6; }
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
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  drawRagdolls(ctx, cam) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of this.ragdolls) {
      const a = Math.min(1, r.life / 1.2);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      const P = r.pts;
      if (!cam.visible(P.hip.x, 150)) continue;
      const S = (p) => [cam.sx(p.x), cam.sy(p.y)];
      ctx.lineWidth = r.lw * cam.zoom * r.scale;
      ctx.strokeStyle = r.col;
      ctx.beginPath();
      for (const s of r.sticks) {
        if (s.soft) continue;
        const A = S(P[s.a]), B = S(P[s.b]);
        ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
      }
      ctx.stroke();
      const [hx, hy] = S(P.head);
      const hr = r.headR * cam.zoom;
      ctx.fillStyle = r.paper;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = r.lw * cam.zoom * r.scale * 0.95;
      ctx.stroke();
      // X eyes.
      const e = hr * 0.18;
      ctx.lineWidth = Math.max(1, hr * 0.14);
      ctx.beginPath();
      for (const dx of [-hr * 0.3, hr * 0.25]) {
        ctx.moveTo(hx + dx - e, hy - e - hr * 0.1); ctx.lineTo(hx + dx + e, hy + e - hr * 0.1);
        ctx.moveTo(hx + dx + e, hy - e - hr * 0.1); ctx.lineTo(hx + dx - e, hy + e - hr * 0.1);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx, cam) {
    for (const p of this.parts) {
      if (!cam.visible(p.x, 60)) continue;
      const a = Math.min(1, p.life / (p.max * 0.5));
      const x = cam.sx(p.x), y = cam.sy(p.y);
      const s = p.size * cam.zoom;
      ctx.globalAlpha = a;
      if (p.kind === 'dot') {
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'line') {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = Math.max(1, s * 0.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03 * cam.zoom, y - p.vy * 0.03 * cam.zoom); ctx.stroke();
      } else if (p.kind === 'puff') {
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(x, y, s * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.45 : s * 1.2; const an = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.kind === 'paper' || p.kind === 'crumb') {
        ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.fillRect(-s, -s * (p.kind === 'paper' ? 0.6 : 0.8), s * 2, s * (p.kind === 'paper' ? 1.2 : 1.6));
        ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 3 * a;
        ctx.beginPath(); ctx.ellipse(x, y, s * (1.6 - a), s * 0.35 * (1.6 - a), 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, cam) {
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.4));
      ctx.globalAlpha = a;
      const size = Math.round(t.size * Math.max(0.75, cam.zoom * 0.9));
      ctx.font = `${size}px 'Permanent Marker', cursive`;
      const x = cam.sx(t.x), y = cam.sy(t.y);
      if (t.outline) { ctx.strokeStyle = t.outline; ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeText(t.str, x, y); }
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
