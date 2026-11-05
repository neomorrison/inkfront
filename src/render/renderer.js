// Draws a Battle onto the canvas and turns sim events into effects.
// Registries let feature packages add visuals without touching this file:
//   PROJ_DRAW[kind](ctx, cam, p, pal, t)        projectile sprites
//   AREA_DRAW[kind] = { under?(ctx, cam, a, b, t), over?(ctx, cam, a, b, t) }  spell zones
//   BODIES[name](ctx, u, o)                     non-stick bodies (catapult, wyrm, hand, critter)
//   MOUNTS[name] = { draw(ctx, u, o), seat }    horses; seat = rider hip lift in local px
//   OVERLAY_DRAW[modifierId](ctx, cam, b, t, r) full-screen weather/night overlays
//   EVENT_FX[type](r, e, b)                     sim event -> particles/shake/text
import { lerp, mixHex } from '../core/util.js';
import { FACTIONS, paletteFor } from '../data/factions.js';
import { PAGES } from '../data/pages.js';
import { Camera, DEPTH } from './camera.js';
import { World } from './world.js';
import { FX } from './fx.js';
import { boilFrame } from './ink.js';
import { computePose, drawStick } from './stickman.js';
import { DEPTH as D2 } from './camera.js';

export const PROJ_DRAW = {};
export const AREA_DRAW = {};
export const BODIES = {};
export const MOUNTS = {};
export const OVERLAY_DRAW = {};
export const EVENT_FX = {};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = new Camera();
    this.world = new World();
    this.fx = new FX();
    this.pal = [null, null];
    this.dpr = 1;
    this.battle = null;
    this.t = 0;
    this.settings = { shake: true, numbers: true, quality: 'high' };
    this.stuck = []; // arrows stuck in the ground: { x, z, kind, ang, life, col }
    this.armyHat = 'none';
    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.cam.resize(w, h);
  }

  setBattle(b, opts = {}) {
    this.battle = b;
    this.world.setup(b);
    this.fx.reset(b.width);
    this.fx.quality = this.settings.quality === 'low' ? 0.5 : 1;
    this.stuck.length = 0;
    this.cam.setWorld(b.width);
    this.cam.x = this.cam.clampX(opts.camX ?? -40);
    this.cam.targetX = null;
    const page = PAGES[b.page] || PAGES.ruled;
    this.page = page;
    this.pal = b.teams.map((t) => makePalette(paletteFor(t.faction, page), page));
    this.armyHat = (b.teams[0].cfg && b.teams[0].cfg.armyHat) || 'none';
  }

  // Called from the fixed update so effects respect pause and game speed.
  update(dt) {
    this.t += dt;
    const b = this.battle;
    if (b) for (const e of b.events) this.onEvent(e, b);
    this.fx.update(dt);
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      s.life -= dt;
      if (s.life <= 0) this.stuck.splice(i, 1);
    }
  }

  onEvent(e, b) {
    const fn = EVENT_FX[e.type];
    if (fn) fn(this, e, b);
  }

  shake(a) {
    if (this.settings.shake) this.cam.addShake(a);
  }

  render(frameDt, alpha = 1) {
    const ctx = this.ctx, cam = this.cam, b = this.battle;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cam.update(frameDt, this.settings.shake);
    const t = this.t;
    this.world.drawBackground(ctx, cam, t);
    if (!b) return;
    this.world.drawGround(ctx, cam, t);
    this.fx.drawDecals(ctx, cam);
    for (const a of b.areas) AREA_DRAW[a.kind]?.under?.(ctx, cam, a, b, t, this);
    for (const w of b.wells) this.world.drawWell(ctx, cam, w, w.team >= 0 ? this.pal[w.team] : this.pal[0], t);
    const fs = (i) => FACTIONS[b.teams[i].faction]?.fort || 'castle';
    this.world.drawFort(ctx, cam, b.teams[1].fort, this.pal[1], t, fs(1));
    this.world.drawFort(ctx, cam, b.teams[0].fort, this.pal[0], t, fs(0));
    this.drawTurretGuards(ctx, b, t);
    const pt = b.teams[0];
    if (b.mode !== 'demo') this.world.drawFlag(ctx, cam, pt.flagX, this.pal[0], t, pt.stance === 'hold');
    this.drawStuck(ctx);
    this.fx.drawRagdolls(ctx, cam);

    const units = b.units.filter((u) => u.alive && cam.visible(u.x, 160 * u.scale));
    units.sort((a, c) => (a.flying ? 2 : 0) + a.z - ((c.flying ? 2 : 0) + c.z));
    for (const u of units) this.drawUnit(ctx, u, alpha, t);
    for (const p of b.projectiles) {
      if (!p.alive || !cam.visible(p.x, 60)) continue;
      const fn = PROJ_DRAW[p.kind] || PROJ_DRAW.default;
      fn(ctx, cam, p, this.pal[p.team], t, alpha);
    }
    for (const a of b.areas) AREA_DRAW[a.kind]?.over?.(ctx, cam, a, b, t, this);
    this.fx.drawParticles(ctx, cam);
    this.drawBars(ctx, units);
    for (const id of b.modifiers) OVERLAY_DRAW[id]?.(ctx, cam, b, t, this);
    this.fx.drawTexts(ctx, cam);
  }

  hatFor(u) {
    const look = u.def.look || {};
    if (u.isHero) return (u.data.heroCfg && u.data.heroCfg.hat) || look.hat || 'captain';
    if (u.team === 0 && this.armyHat && this.armyHat !== 'none' && !u.isBoss && u.type !== 'scribe') return this.armyHat;
    if (look.hat) return look.hat;
    if (u.level >= 7) return 'gear_plume';
    if (u.level >= 4) return 'gear_helm';
    return null;
  }

  drawUnit(ctx, u, alpha, t) {
    const cam = this.cam;
    const pal = this.pal[u.team];
    const look = u.def.look || {};
    const x = lerp(u.px, u.x, alpha);
    const sc = u.scale * (1 + u.z * 0.035);
    const s = cam.zoom * sc;
    const sx = cam.sx(x), sy = cam.sy(u.y + u.z * DEPTH);
    let ga = 1;
    if (u.stealth) ga = u.team === 0 ? 0.4 : 0.12;
    if (ga < 1) ctx.globalAlpha = ga;
    const o = {
      x: sx, y: sy, s, facing: u.facing, col: pal.ink, back: pal.back, paper: pal.paper, light: pal.light, dark: pal.dark,
      under: pal.under, lw: 2.5 * (look.bulk || 1), seed: u.id, frame: boilFrame(t + (u.id % 7) * 0.05), t,
      eyes: u.team === 0 ? 'dot' : (FACTIONS[this.battle.teams[u.team].faction] || {}).eyes || 'angry',
      sketch: u.state === 'spawn' ? u.stateT / Math.max(0.01, u.spawnTime) : null,
      squash: u.anim.flash > 0 ? 0.09 : 0, look, unit: u, hat: this.hatFor(u), gilded: u.level >= 10, inkDrop: pal.dark, pal,
    };
    const body = look.body && BODIES[look.body];
    if (body) {
      body(ctx, u, o, this);
    } else {
      const pose = computePose(u, t);
      o.y += pose.lift * s;
      const mount = look.mount && MOUNTS[look.mount];
      if (mount) {
        mount.draw(ctx, u, o, this);
        o.y -= (mount.seat || 26) * s;
      }
      drawStick(ctx, pose.j, o);
    }
    if (ga < 1) ctx.globalAlpha = 1;
    if (u.mod.stun && !u.isBoss) this.drawDizzy(ctx, sx, sy - (u.height + 6) * s, s, t);
  }

  drawDizzy(ctx, x, y, s, t) {
    ctx.fillStyle = '#f2b01e';
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 3 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBars(ctx, units) {
    const cam = this.cam;
    const now = this.battle.time;
    for (const u of units) {
      if (u.isBoss || u.type === 'scribe' && u.hp >= u.maxHp) continue;
      const recent = now - u.lastHitT < 2.5;
      if (!(u.isHero || (recent && u.hp < u.maxHp))) continue;
      const s = cam.zoom * u.scale;
      const w = Math.max(18, 26 * u.scale) * cam.zoom, h = Math.max(3, 3.5 * cam.zoom);
      const x = cam.sx(u.x) - w / 2, y = cam.sy(u.y + u.z * DEPTH) - (u.height + 14) * s;
      ctx.fillStyle = 'rgba(27,34,64,.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = u.team === 0 ? '#3ec46d' : '#ff5a4d';
      ctx.fillRect(x, y, w * Math.max(0, u.hp / u.maxHp), h);
    }
  }

  drawTurretGuards(ctx, b, t) {
    // A tiny archer on each fort tower.
    const cam = this.cam;
    for (const tm of b.teams) {
      const f = tm.fort;
      if (!f.alive || !f.turret.on || !cam.visible(f.x, 150)) continue;
      const dir = tm.dir;
      const tx = f.x + (dir > 0 ? -62 + 17 : 62 - 17);
      const pal = this.pal[tm.index];
      const fake = { id: 9000 + tm.index, def: { look: { weapon: 'bow', style: 'bow' }, speed: 0 }, anim: { t, walk: 0, atk: Math.max(0, 1 - f.turret.t / f.turret.cd) * 0.9, style: 'bow', moving: false }, attacking: f.turret.t > f.turret.cd - 0.6, state: 'idle', data: {}, mod: {}, type: 'guard' };
      const pose = computePose(fake, t);
      drawStick(ctx, pose.j, { x: cam.sx(tx), y: cam.sy(f.z * DEPTH - 205), s: cam.zoom * 0.85, facing: dir, col: pal.ink, back: pal.back, paper: pal.paper, light: pal.light, lw: 2.4, seed: 9000 + tm.index, frame: boilFrame(t), look: fake.def.look, unit: fake, eyes: tm.index === 0 ? 'dot' : 'angry', t });
    }
  }

  drawStuck(ctx) {
    const cam = this.cam;
    ctx.lineCap = 'round';
    for (const s of this.stuck) {
      if (!cam.visible(s.x, 40)) continue;
      const x = cam.sx(s.x), y = cam.sy(s.z * DEPTH);
      ctx.globalAlpha = Math.min(1, s.life);
      ctx.strokeStyle = s.col;
      ctx.lineWidth = 1.6 * cam.zoom;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(s.ang) * 12 * cam.zoom, y - Math.sin(s.ang) * 12 * cam.zoom);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // World x under a screen x (for clicks).
  worldX(sx) { return this.cam.worldX(sx); }
}

export function makePalette(p, page) {
  const paper = page.chalky ? page.paper : '#fffdf4';
  return {
    ink: p.ink, dark: p.dark, light: p.light, under: p.under || null,
    back: mixHex(p.ink, page.chalky ? page.paper : '#fffdf4', 0.38),
    paper: page.chalky ? page.paper : (page.paper || paper),
  };
}

// ---------------------------------------------------------------- default projectile sprites
PROJ_DRAW.default = (ctx, cam, p, pal) => {
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(cam.sx(p.x), cam.sy(p.y + p.z * D2), 2.5 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
};

PROJ_DRAW.arrow = (ctx, cam, p, pal) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * D2);
  const a = Math.atan2(p.vy, p.vx);
  const L = 15 * cam.zoom;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.6 * cam.zoom;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * 4 * cam.zoom, y + Math.sin(a) * 4 * cam.zoom);
  ctx.lineTo(x + Math.cos(a + 2.5) * 4 * cam.zoom, y + Math.sin(a + 2.5) * 4 * cam.zoom);
  ctx.lineTo(x + Math.cos(a - 2.5) * 4 * cam.zoom, y + Math.sin(a - 2.5) * 4 * cam.zoom);
  ctx.fill();
};
PROJ_DRAW.neon_arrow = PROJ_DRAW.arrow;

PROJ_DRAW.stone = (ctx, cam, p, pal) => {
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.arc(cam.sx(p.x), cam.sy(p.y + p.z * D2), 3 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
};

PROJ_DRAW.boulder = (ctx, cam, p, pal) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * D2), r = 9 * cam.zoom;
  ctx.fillStyle = pal.light;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

PROJ_DRAW.pencil = (ctx, cam, p) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * D2), z = cam.zoom;
  const a = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#f2c230';
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-34 * z, -3.5 * z, 26 * z, 7 * z);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5d7b0';
  ctx.beginPath();
  ctx.moveTo(-8 * z, -3.5 * z); ctx.lineTo(2 * z, 0); ctx.lineTo(-8 * z, 3.5 * z);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff8fa3';
  ctx.fillRect(-40 * z, -3.5 * z, 6 * z, 7 * z);
  ctx.restore();
};

PROJ_DRAW.bolt = (ctx, cam, p, pal, t) => {
  const x = cam.sx(p.x), y = cam.sy(p.y + p.z * D2), z = cam.zoom;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2 * z;
  ctx.beginPath();
  const a = Math.atan2(p.vy, p.vx);
  for (let i = 0; i < 6; i++) {
    const d = -i * 5 * z;
    const off = (i % 2 ? 4 : -4) * z * Math.sin(t * 40 + i);
    const px = x + Math.cos(a) * d - Math.sin(a) * off, py = y + Math.sin(a) * d + Math.cos(a) * off;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
};

// ---------------------------------------------------------------- default event effects
const INK_DARK = '#1b2240';

EVENT_FX.hit = (r, e, b) => {
  if (e.kind === 'true') return;
  const pal = r.pal[e.team];
  r.fx.burst(e.x, e.y, e.z, e.amount > 40 ? 6 : 3, pal.ink, 160, 'dot', { size: 1.8, life: 0.4 });
  if (e.amount >= 50) r.shake(Math.min(5, e.amount / 30));
  if (r.settings.numbers && e.source && e.source.team === 0 && e.amount >= 1) {
    r.fx.text(e.x + (Math.random() * 2 - 1) * 8, e.y - 12, String(Math.round(e.amount)), e.crit ? '#d1342b' : '#1b2240', e.amount >= 60 ? 20 : 14, { life: 0.7, vy: -60 });
  }
};

EVENT_FX.death = (r, e, b) => {
  const u = e.unit;
  const pal = r.pal[u.team];
  r.fx.splat(u.x, u.z, pal.ink, 9 + 5 * u.scale);
  if (u.def.look && u.def.look.body) {
    r.fx.burst(u.x, u.y - u.height * 0.5, u.z, 14, pal.ink, 260, 'dot', { size: 2.6 });
    return;
  }
  const pose = computePose(u, r.t);
  const j = pose.j;
  const s = u.scale;
  const ground = u.z * DEPTH;
  const world = {};
  for (const k of ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB']) {
    world[k] = [u.x + u.facing * j[k][0] * s, u.y + ground + j[k][1] * s];
  }
  const power = Math.min(900, 120 + (e.power || 0) * 1.6);
  const blast = e.kind === 'blast';
  r.fx.ragdoll(world, {
    vx: e.dir * power * (blast ? 1.1 : 0.7), vy: -power * (blast ? 1.2 : 0.55) - 60,
    ground, col: pal.ink, paper: pal.paper, lw: 2.5 * ((u.def.look && u.def.look.bulk) || 1), scale: s,
    dismember: blast && power > 380, life: 5,
  });
};

EVENT_FX.explode = (r, e) => {
  const pal = r.pal[e.team] || r.pal[0];
  r.fx.burst(e.x, e.y - 4, 0, 18, INK_DARK, 420, 'dot', { size: 3, life: 0.7 });
  r.fx.puff(e.x, e.y, 0, 'rgba(60,60,70,.35)', 6, 14);
  r.fx.ring(e.x, 0, 0, pal.ink, e.radius, 0.4);
  r.fx.splat(e.x, 0, INK_DARK, Math.min(40, e.radius * 0.35), 0.7);
  r.shake(Math.min(10, e.radius / 14));
};

EVENT_FX.projLand = (r, e) => {
  if (e.kind === 'arrow' || e.kind === 'neon_arrow' || e.kind === 'lead') {
    r.stuck.push({ x: e.x, z: e.z, ang: Math.atan2(e.vy, e.vx), life: 4, col: r.pal[e.team].ink });
    if (r.stuck.length > 120) r.stuck.shift();
  } else if (e.kind === 'stone' || e.kind === 'chalk') {
    r.fx.burst(e.x, -2, e.z, 3, 'rgba(80,80,90,.6)', 90, 'dot', { size: 1.4, life: 0.35 });
  }
};

EVENT_FX.deposit = (r, e) => {
  if (e.team !== 0) return;
  r.fx.text(e.x, -80, '+' + Math.round(e.amount), '#1f47c2', 18, { life: 1.1, vy: -45 });
};

EVENT_FX.fortHit = (r, e) => {
  if (Math.random() < 0.35) r.fx.puff(e.x + (Math.random() * 2 - 1) * 50, -40 - Math.random() * 60, -0.6, 'rgba(90,90,100,.3)', 2, 9);
  if (e.amount > 40) r.shake(2);
};

EVENT_FX.fortDestroyed = (r, e) => {
  const pal = r.pal[e.team];
  for (let i = 0; i < 4; i++) r.fx.burst(e.x + (Math.random() * 2 - 1) * 60, -80 - Math.random() * 80, -0.6, 16, pal.ink, 520, 'paper', { size: 5, life: 1.4 });
  r.fx.puff(e.x, -60, -0.6, 'rgba(80,80,90,.4)', 16, 26);
  r.shake(16);
};

EVENT_FX.blocked = (r, e) => {
  r.fx.burst(e.x, e.y, e.z, 4, '#f2b01e', 140, 'line', { size: 2, life: 0.25 });
};

EVENT_FX.heal = (r, e) => {
  if (Math.random() < 0.5) r.fx.add({ kind: 'star', x: e.x, y: e.y - 6, z: e.z, vx: 0, vy: -50, g: 0, col: '#3ec46d', size: 3.2, life: 0.6 });
};

EVENT_FX.launch = (r, e) => {
  r.fx.burst(e.x, -6, e.z, 4, 'rgba(80,80,90,.5)', 120, 'dot', { size: 1.6, life: 0.3 });
};

EVENT_FX.land = (r, e) => {
  r.fx.puff(e.x, 0, e.z, 'rgba(80,80,90,.25)', 2, 7);
};
