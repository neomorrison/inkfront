// Draws a Battle onto the canvas and turns sim events into effects.
// Registries let feature packages add visuals without touching this file:
//   PROJ_DRAW[kind](ctx, cam, p, pal, t)        projectile sprites
//   AREA_DRAW[kind] = { under?(ctx, cam, a, b, t), over?(ctx, cam, a, b, t) }  spell zones
//   BODIES[name](ctx, u, o)                     non-stick bodies (catapult, wyrm, hand, critter)
//   MOUNTS[name] = { draw(ctx, u, o), seat }    horses; seat = rider hip lift in local px
//   OVERLAY_DRAW[modifierId](ctx, cam, b, t, r) full-screen weather/night overlays (overlays.js)
//   EVENT_FX[type](r, e, b)                     sim event -> particles/shake/text (fxevents.js)
// OWNER: world/FX builder (package F).
import { lerp, mixHex } from '../core/util.js';
import { FACTIONS, paletteFor } from '../data/factions.js';
import { PAGES } from '../data/pages.js';
import { Camera, DEPTH } from './camera.js';
import { World } from './world.js';
import { FX } from './fx.js';
import { boilFrame } from './ink.js';
import { computePose, drawStick } from './stickman.js';
import { installFxEvents } from './fxevents.js';
import { DEPTH as D2 } from './camera.js';

export const PROJ_DRAW = {};
export const AREA_DRAW = {};
export const BODIES = {};
export const MOUNTS = {};
export const OVERLAY_DRAW = {};
export const EVENT_FX = {};

// Default event effects are installed now, before any feature package wraps them.
installFxEvents(EVENT_FX);

const byDepth = (a, c) => (a.flying ? 2 : 0) + a.z - ((c.flying ? 2 : 0) + c.z);

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
    this.page = PAGES.ruled;
    this.eyes = ['dot', 'angry'];
    this.vis = [];
    this.o = {}; // reused draw options for stick figures
    this.fx.onThud = (x, power, rag) => {
      this.fx.dust(x, 0, 3 + Math.min(5, power / 500), 1.2, 6);
      if (rag && rag.mass > 1.6) this.shake(Math.min(5, 1.5 + rag.mass));
    };
    this.resize();
  }

  get low() { return this.settings.quality === 'low'; }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.world.dpr = this.dpr;
    this.cam.resize(w, h);
  }

  setBattle(b, opts = {}) {
    this.battle = b;
    this.world.dpr = this.dpr;
    this.world.setup(b);
    this.stuck.length = 0;
    this.cam.setWorld(b.width);
    this.cam.x = this.cam.clampX(opts.camX ?? -40);
    this.cam.targetX = null;
    this.rebuildPalettes(b);
    this.fx.reset(b.width, this.page);
    this.fx.quality = this.low ? 0.5 : 1;
    this.armyHat = (b.teams[0].cfg && b.teams[0].cfg.armyHat) || 'none';
    this._night = null;
  }

  rebuildPalettes(b) {
    const page = PAGES[b.page] || PAGES.ruled;
    this.page = page;
    this.pal = b.teams.map((t) => makePalette(paletteFor(t.faction, page), page));
    this.eyes = b.teams.map((t, i) => (i === 0 ? 'dot' : (FACTIONS[t.faction] || {}).eyes || 'angry'));
  }

  // Endless mode swaps the page every 10 waves: redo the world and the palettes, keep the effects.
  changePage(b, page) {
    if (page) b.page = page;
    this.world.setup(b);
    this.rebuildPalettes(b);
    this.fx.reset(b.width, this.page);
    this.stuck.length = 0;
    this._night = null;
  }

  // Called from the fixed update so effects respect pause and game speed.
  update(dt) {
    this.t += dt;
    const b = this.battle;
    this.fx.quality = this.low ? 0.5 : 1;
    if (b) {
      for (const e of b.events) this.onEvent(e, b);
      this.world.updateForts(b, this.fx, dt);
    }
    this.fx.update(dt);
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      s.life -= dt;
      if (s.life <= 0) { this.stuck[i] = this.stuck[this.stuck.length - 1]; this.stuck.pop(); }
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
    const bt = this.low ? 0 : t; // low quality: no line boil
    this.world.btime = b ? b.time : 0;
    this.world.drawBackground(ctx, cam, bt);
    if (!b) return;
    this.world.drawGround(ctx, cam, bt);
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

    const units = this.vis;
    units.length = 0;
    for (const u of b.units) if (u.alive && cam.visible(u.x, 160 * u.scale)) units.push(u);
    units.sort(byDepth);
    this.drawShadows(ctx, units, alpha);
    for (const u of units) this.drawUnit(ctx, u, alpha, t);
    for (const p of b.projectiles) {
      if (!p.alive || !cam.visible(p.x, 60)) continue;
      const fn = PROJ_DRAW[p.kind] || PROJ_DRAW.default;
      fn(ctx, cam, p, this.pal[p.team], t, alpha);
    }
    for (const a of b.areas) AREA_DRAW[a.kind]?.over?.(ctx, cam, a, b, t, this);
    this.fx.drawParticles(ctx, cam);
    this.drawOverlays(ctx, b, t);
    this.drawBars(ctx, units);
    this.fx.drawTexts(ctx, cam);
  }

  drawOverlays(ctx, b, t) {
    const cam = this.cam, mods = b.modifiers;
    for (const id of mods) OVERLAY_DRAW[id]?.(ctx, cam, b, t, this);
    const f = b.flags || {};
    if (f.night && !mods.includes('night')) OVERLAY_DRAW.night?.(ctx, cam, b, t, this);
    if (f.rain && !mods.includes('rain')) OVERLAY_DRAW.rain?.(ctx, cam, b, t, this);
    if (b.wind && !mods.includes('wind_left') && !mods.includes('wind_right')) OVERLAY_DRAW.wind_right?.(ctx, cam, b, t, this);
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

  // Soft ground shadows for every visible unit in one fill.
  drawShadows(ctx, units, alpha) {
    const cam = this.cam, z = cam.zoom;
    ctx.fillStyle = this.page.chalky ? 'rgba(0,0,0,.26)' : 'rgba(40,40,70,.13)';
    ctx.beginPath();
    for (const u of units) {
      if (u.stealth && u.team !== 0) continue;
      const lift = Math.min(0.6, Math.max(0, -u.y) / 160);
      const rx = (u.radius ? Math.max(8, u.radius * 0.9) : 10) * u.scale * z * (1 - lift);
      const x = cam.sx(lerp(u.px, u.x, alpha)), y = cam.sy(u.z * DEPTH);
      ctx.moveTo(x + rx, y);
      ctx.ellipse(x, y, rx, rx * 0.26, 0, 0, Math.PI * 2);
    }
    ctx.fill();
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
    const body = look.body && BODIES[look.body];
    const low = this.low;
    const o = body ? {} : this.o;
    o.x = sx; o.y = sy; o.s = s; o.facing = u.facing;
    o.col = pal.ink; o.back = pal.back; o.paper = pal.paper; o.light = pal.light; o.dark = pal.dark;
    o.under = pal.under; o.lw = 2.5 * (look.bulk || 1); o.seed = u.id;
    o.frame = low ? 0 : boilFrame(t + (u.id % 7) * 0.05); o.t = t;
    o.eyes = this.eyes[u.team] || 'angry';
    o.sketch = u.state === 'spawn' ? u.stateT / Math.max(0.01, u.spawnTime) : null;
    o.flash = u.anim.flash > 0 ? Math.min(1, u.anim.flash / 0.12) : 0;
    o.flashCol = pal.flash;
    o.squash = 0;
    o.look = look; o.unit = u; o.hat = this.hatFor(u); o.gilded = u.level >= 10; o.inkDrop = pal.dark; o.pal = pal;
    o.boil = low ? 0 : 0.5;
    o.headFill = undefined; o.hurt = 0; o.dx = 0;
    if (body) {
      body(ctx, u, o, this);
    } else {
      const pose = computePose(u, t);
      o.y += pose.lift * s;
      o.dx = pose.dx;
      o.hurt = pose.hurt;
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
      ctx.fillStyle = 'rgba(27,34,64,.78)';
      ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(x, y, w, h);
      const k = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 0 ? (k < 0.3 ? '#e8b422' : '#3ec46d') : '#ff5a4d';
      ctx.fillRect(x, y, w * k, h);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(x, y, w * k, h * 0.35);
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
      drawStick(ctx, pose.j, { x: cam.sx(tx), y: cam.sy(f.z * DEPTH - 205), s: cam.zoom * 0.85, facing: dir, col: pal.ink, back: pal.back, paper: pal.paper, light: pal.light, lw: 2.4, seed: 9000 + tm.index, frame: this.low ? 0 : boilFrame(t), boil: this.low ? 0 : 0.5, look: fake.def.look, unit: fake, eyes: this.eyes[tm.index], t });
    }
  }

  drawStuck(ctx) {
    const cam = this.cam;
    if (!this.stuck.length) return;
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
    // Hit pulse colour: a much darker ink on paper, bright chalk on the board.
    flash: page.chalky ? '#ffffff' : mixHex(p.ink, '#06091c', 0.5),
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

