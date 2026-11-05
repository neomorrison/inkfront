// AREA_DRAW for the spell zones: pencil rain, coffee, ruler, planes, stapler, highlighter, doodle drop, eraser.
// Falling or flying objects draw in `over`; ground marks and glows draw in `under`.
import { AREA_DRAW } from './renderer.js';
import { DEPTH } from './camera.js';
import { boilFrame, wob } from './ink.js';
import { ease, TAU, hash2 } from '../core/util.js';
import { INK, PAPER, MARKER, sat, prog, place, style, fillStroke, blobPath, rrect, groundEllipse } from './spellkit.js';

const BAND = 24; // half depth of the battlefield band in world px

function dashedRing(ctx, cam, x, rx, ry, t, col, alpha, w = 2.4) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = w * cam.zoom;
  ctx.setLineDash([10 * cam.zoom, 8 * cam.zoom]);
  ctx.lineDashOffset = -t * 40 * cam.zoom;
  ctx.beginPath();
  ctx.ellipse(cam.sx(x), cam.sy(0), rx * cam.zoom, ry * cam.zoom, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ Pencil Rain
AREA_DRAW.pencil_rain = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 40)) return;
    const k = 1 - sat(a.t / a.dur);
    groundEllipse(ctx, cam, a.x, a.radius, BAND, '#3b3f58', 0.1 * k);
    dashedRing(ctx, cam, a.x, a.radius, BAND, a.t, '#d1342b', 0.7 * k);
    // little target crosses where pencils are about to land
    ctx.save();
    ctx.globalAlpha = 0.6 * k;
    ctx.strokeStyle = '#d1342b';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const px = a.x + (hash2(a.x | 0, i) * 2 - 1) * a.radius * 0.85;
      const py = (hash2(i, a.x | 0) * 2 - 1) * 12;
      const sx = cam.sx(px), sy = cam.sy(py), d = 5 * cam.zoom;
      ctx.moveTo(sx - d, sy - d * 0.5); ctx.lineTo(sx + d, sy + d * 0.5);
      ctx.moveTo(sx + d, sy - d * 0.5); ctx.lineTo(sx - d, sy + d * 0.5);
    }
    ctx.stroke();
    ctx.restore();
  },
};

// ------------------------------------------------------------------ Coffee Spill
function mug(ctx, steam, t) {
  // upright mug centered on its middle, in world px
  ctx.beginPath(); // handle
  ctx.ellipse(24, 0, 14, 17, 0, -Math.PI / 2, Math.PI / 2);
  style(ctx, 'rgba(0,0,0,0)', INK, 9);
  ctx.stroke();
  style(ctx, 'rgba(0,0,0,0)', '#f4ede2', 4.5);
  ctx.stroke();
  ctx.beginPath(); // body
  ctx.moveTo(-22, -26); ctx.lineTo(22, -26); ctx.lineTo(19, 24);
  ctx.quadraticCurveTo(0, 32, -19, 24); ctx.closePath();
  fillStroke(ctx, '#f4ede2', INK, 3);
  ctx.beginPath(); // red band
  ctx.moveTo(-21, -8); ctx.lineTo(21, -8); ctx.lineTo(20, 8); ctx.lineTo(-20, 8); ctx.closePath();
  style(ctx, '#e8483d', INK, 0);
  ctx.fill();
  ctx.beginPath(); // coffee in the mouth
  ctx.ellipse(0, -26, 22, 7, 0, 0, TAU);
  fillStroke(ctx, '#5a3216', INK, 3);
  if (steam) {
    ctx.strokeStyle = 'rgba(120,110,120,.6)';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let s = 0; s <= 6; s++) ctx.lineTo(i * 10 + Math.sin(t * 4 + s * 1.1 + i) * 4, -34 - s * 7);
      ctx.stroke();
    }
  }
}

AREA_DRAW.coffee_spill = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 60)) return;
    const fallK = sat(a.t / a.tip);
    if (!a.landed) {
      groundEllipse(ctx, cam, a.x, 12 + 34 * fallK, 8 + 6 * fallK, '#2b1a0f', 0.12 + 0.25 * fallK);
      return;
    }
    const grow = ease.outCubic(prog(a.t, a.tip, a.tip + 0.55));
    const fade = 1 - prog(a.t, a.tip + a.dur, a.total);
    const R = a.radius * (0.15 + 0.85 * grow);
    const seed = (a.x | 0) + 5;
    const f = boilFrame(t);
    ctx.save();
    ctx.globalAlpha = 0.94 * fade;
    ctx.translate(cam.sx(a.x), cam.sy(0));
    ctx.scale(cam.zoom, cam.zoom);
    ctx.beginPath();
    blobPath(ctx, 0, 0, R, BAND * 0.95 * (0.4 + 0.6 * grow), seed, 22, 0.13, 0);
    fillStroke(ctx, '#5a3216', INK, 2.8);
    // lighter sloshing pool
    ctx.beginPath();
    blobPath(ctx, -R * 0.06, -2, R * 0.78, BAND * 0.62 * grow, seed + 9, 18, 0.12 + 0.02 * Math.sin(t * 3 + f), 0);
    ctx.fillStyle = '#7d4a22';
    ctx.fill();
    // sheen
    ctx.strokeStyle = 'rgba(255,235,200,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, -6, R * 0.22, BAND * 0.2, 0, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    // bubbles
    ctx.strokeStyle = 'rgba(255,230,190,.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const ph = (t * 1.4 + hash2(seed, i)) % 1;
      const bx = (hash2(seed, i + 30) * 2 - 1) * R * 0.75, by = (hash2(seed, i + 60) * 2 - 1) * BAND * 0.45;
      ctx.beginPath();
      ctx.arc(bx, by - ph * 4, (2 + 5 * Math.sin(ph * Math.PI)) * grow, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // hot edge pulse
    if (a.t < a.tip + a.dur) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6);
      ctx.strokeStyle = '#ff6a2b';
      ctx.lineWidth = 3 * cam.zoom;
      ctx.setLineDash([6 * cam.zoom, 10 * cam.zoom]);
      ctx.lineDashOffset = -t * 30 * cam.zoom;
      ctx.beginPath();
      ctx.ellipse(cam.sx(a.x), cam.sy(0), R * cam.zoom * 1.02, BAND * 1.0 * cam.zoom * (0.4 + 0.6 * grow), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  },
  over(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 60)) return;
    const fall = sat(a.t / a.tip);
    const fade = 1 - prog(a.t, a.tip + a.dur - 0.2, a.tip + a.dur + 0.5);
    if (fade <= 0) return;
    const y = -(300 * (1 - ease.inQuad(fall))) - 24 * ease.inQuad(fall);
    const rot = ease.outCubic(fall) * 1.85;
    ctx.globalAlpha = fade;
    // pour stream right after the tip
    if (a.landed && a.t < a.tip + 0.5) {
      const k = 1 - prog(a.t, a.tip, a.tip + 0.5);
      ctx.strokeStyle = '#5a3216';
      ctx.lineWidth = 11 * k * cam.zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cam.sx(a.x + 26), cam.sy(-12));
      ctx.quadraticCurveTo(cam.sx(a.x + 46), cam.sy(-10), cam.sx(a.x + 52), cam.sy(2));
      ctx.stroke();
    }
    place(ctx, cam, a.x - 6, y, 0, rot, 1.15, (c) => mug(c, fall < 0.25, t));
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ Ruler Smash
function rulerBody(ctx, w, t) {
  const h = 46, th = 9;
  // front thickness
  ctx.beginPath();
  rrect(ctx, -w / 2, h / 2 - 8, w, th + 8, 5);
  fillStroke(ctx, '#d98a1a', INK, 3);
  // top face
  ctx.beginPath();
  rrect(ctx, -w / 2, -h / 2, w, h, 6);
  fillStroke(ctx, '#ffc93c', INK, 3.2);
  // grain
  ctx.strokeStyle = 'rgba(190,120,20,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const y = -10 + i * 9; ctx.moveTo(-w / 2 + 14, y); ctx.lineTo(w / 2 - 14, y + 1); }
  ctx.stroke();
  // ticks
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const step = 10;
  for (let i = 0, x = -w / 2 + 12; x < w / 2 - 8; i++, x += step) {
    const long = i % 4 === 0;
    ctx.moveTo(x, h / 2 - 3); ctx.lineTo(x, h / 2 - (long ? 17 : i % 2 ? 8 : 12));
  }
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `15px ${MARKER}`;
  ctx.textAlign = 'center';
  for (let i = 0, x = -w / 2 + 12; x < w / 2 - 20; i++, x += step * 4) ctx.fillText(String(i + 1), x + 1, h / 2 - 22);
  ctx.textAlign = 'left';
}

AREA_DRAW.ruler_smash = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.width)) return;
    const p = sat(a.t / a.windup);
    const fade = 1 - prog(a.t, a.total - 0.5, a.total);
    const half = a.width / 2;
    if (!a.hit) {
      // warning strip
      const pulse = 0.55 + 0.45 * Math.sin(a.t * 18);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cam.sx(a.x - half), cam.sy(-BAND), a.width * cam.zoom, BAND * 2 * cam.zoom);
      ctx.fillStyle = `rgba(209,52,43,${0.1 + 0.12 * p * pulse})`;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = `rgba(209,52,43,${0.45 + 0.3 * pulse})`;
      ctx.lineWidth = 3 * cam.zoom;
      ctx.beginPath();
      for (let x = -half - 60; x < half + 60; x += 22) {
        ctx.moveTo(cam.sx(a.x + x), cam.sy(BAND)); ctx.lineTo(cam.sx(a.x + x + 30), cam.sy(-BAND));
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#d1342b';
      ctx.lineWidth = 3 * cam.zoom;
      ctx.setLineDash([12 * cam.zoom, 8 * cam.zoom]);
      ctx.strokeRect(cam.sx(a.x - half), cam.sy(-BAND), a.width * cam.zoom, BAND * 2 * cam.zoom);
      ctx.setLineDash([]);
    } else {
      // shadow under the lying ruler
      groundEllipse(ctx, cam, a.x, half + 6, 14, '#1b2240', 0.28 * fade);
    }
  },
  over(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.width)) return;
    const fade = 1 - prog(a.t, a.total - 0.45, a.total);
    if (fade <= 0) return;
    const p = prog(a.t, 0.08, a.windup);
    const dropK = ease.inCubic(p);
    const y = a.hit ? 0 : -520 * (1 - dropK) - 6;
    const rot = a.hit ? 0 : 0.32 * (1 - ease.inQuad(p));
    let sy = 1, sx = 1;
    if (a.hit) {
      const k = Math.exp(-(a.t - a.windup) * 11) * Math.cos((a.t - a.windup) * 38);
      sy = 1 + 0.35 * k; sx = 1 - 0.04 * k;
    }
    ctx.globalAlpha = fade * (a.hit ? 1 : sat(a.t / 0.12));
    ctx.save();
    ctx.translate(cam.sx(a.x), cam.sy(y - 4));
    ctx.scale(cam.zoom * sx, cam.zoom * sy);
    ctx.rotate(rot);
    rulerBody(ctx, a.width, t);
    ctx.restore();
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ Paper Planes
export function planeShape(ctx, col, fold) {
  // pointing right, centered; ~60 wide
  ctx.beginPath(); // far wing
  ctx.moveTo(-26, -2); ctx.lineTo(30, 2); ctx.lineTo(-18, -16); ctx.closePath();
  fillStroke(ctx, fold, INK, 2.4);
  ctx.beginPath(); // near wing
  ctx.moveTo(-26, 0); ctx.lineTo(32, 2); ctx.lineTo(-14, 14); ctx.closePath();
  fillStroke(ctx, col, INK, 2.6);
  ctx.beginPath(); // keel
  ctx.moveTo(-26, 0); ctx.lineTo(32, 2); ctx.lineTo(-22, 6); ctx.closePath();
  fillStroke(ctx, fold, INK, 2.2);
  ctx.beginPath(); // fold line
  ctx.moveTo(-8, 1); ctx.lineTo(24, 2);
  ctx.strokeStyle = 'rgba(27,34,64,.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

AREA_DRAW.paper_planes = {
  under(ctx, cam, a, b, t) {
    for (const p of a.planes) {
      if (!p.started || p.done || !cam.visible(p.x, 60)) continue;
      const k = 1 + p.y / 400; // farther up -> fainter, smaller
      groundEllipse(ctx, cam, p.x, 26 * (0.6 + k * 0.4), 5, INK, 0.16, p.z);
    }
  },
  over(ctx, cam, a, b, t, r) {
    const pal = r.pal[a.team];
    for (const p of a.planes) {
      if (!p.started || p.done || !cam.visible(p.x, 140)) continue;
      const bob = Math.sin(t * 5 + p.i * 1.7) * 6;
      const tilt = Math.sin(t * 3 + p.i) * 0.08 + 0.08;
      const dir = a.dir;
      // dashed contrail behind
      ctx.save();
      ctx.strokeStyle = 'rgba(80,100,160,.55)';
      ctx.lineWidth = 2.4 * cam.zoom;
      ctx.setLineDash([7 * cam.zoom, 9 * cam.zoom]);
      ctx.lineDashOffset = -t * 50 * cam.zoom;
      ctx.beginPath();
      ctx.moveTo(cam.sx(p.x - dir * 26), cam.sy(p.y + bob + 2 + p.z * DEPTH));
      for (let i = 1; i <= 8; i++) {
        const dx = i * 17;
        ctx.lineTo(cam.sx(p.x - dir * (26 + dx)), cam.sy(p.y + bob + 2 + Math.sin(t * 4 + i * 0.7 + p.i) * 4 + p.z * DEPTH));
      }
      ctx.stroke();
      ctx.restore();
      place(ctx, cam, p.x, p.y + bob, p.z, tilt * dir, 1.25, (c) => {
        c.scale(dir, 1);
        planeShape(c, '#ffffff', '#c9dbff');
      });
      // bomb hanging under the belly while it still has some
      if (p.bombs > 0) {
        place(ctx, cam, p.x + dir * 4, p.y + bob + 16, p.z, 0, 1, (c) => {
          c.beginPath(); c.arc(0, 0, 4 + p.bombs, 0, TAU);
          fillStroke(c, pal.ink, INK, 1.8);
        });
      }
    }
  },
};

// ------------------------------------------------------------------ Stapler
function staplerBody(ctx, open) {
  // base (silver) and arm (red), nose to the right, ~170 wide
  ctx.beginPath();
  rrect(ctx, -86, 6, 172, 18, 8);
  fillStroke(ctx, '#aeb7c9', INK, 3);
  ctx.beginPath(); // anvil strip
  rrect(ctx, 40, 2, 40, 6, 3);
  fillStroke(ctx, '#7c869c', INK, 2.2);
  ctx.save();
  ctx.translate(-80, 8); // hinge
  ctx.rotate(-open);
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(150, -4);
  ctx.quadraticCurveTo(170, -4, 168, -22);
  ctx.quadraticCurveTo(160, -42, 130, -44);
  ctx.lineTo(18, -44);
  ctx.quadraticCurveTo(-8, -44, -8, -20);
  ctx.closePath();
  fillStroke(ctx, '#e0382f', INK, 3.2);
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, -36); ctx.lineTo(120, -36); ctx.stroke();
  ctx.restore();
}

function staple(ctx, w) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-w, 4); ctx.lineTo(-w, -6); ctx.lineTo(w, -6); ctx.lineTo(w, 4); ctx.stroke();
  ctx.strokeStyle = '#d8dff0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w, 4); ctx.lineTo(-w, -6); ctx.lineTo(w, -6); ctx.lineTo(w, 4); ctx.stroke();
}

AREA_DRAW.stapler = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 60) || a.hit) return;
    const p = sat(a.t / a.windup);
    groundEllipse(ctx, cam, a.x, a.radius, BAND, '#3b3f58', 0.1 * p);
    dashedRing(ctx, cam, a.x, a.radius, BAND, a.t, '#6b7488', 0.8);
  },
  over(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, a.radius + 80)) return;
    const p = sat(a.t / a.windup);
    const after = a.hit ? a.t - a.windup : 0;
    const press = prog(a.t, a.windup - 0.14, a.windup);
    const leave = prog(after, 0.12, 0.5);
    const y = -230 * (1 - ease.outCubic(sat(a.t / 0.35))) - 190 - 120 * ease.inQuad(leave);
    ctx.globalAlpha = (1 - leave) * sat(a.t / 0.1);
    if (ctx.globalAlpha > 0) {
      place(ctx, cam, a.x - 6, y, 0, -0.04, 1.25, (c) => staplerBody(c, 0.5 * (1 - ease.inCubic(press))));
    }
    ctx.globalAlpha = 1;
    // staples shooting down to each target, then pinned on their feet
    const shoot = a.hit ? prog(after, 0, 0.14) : 0;
    for (const u of a.targets) {
      if (!cam.visible(u.x, 60)) continue;
      const gyU = u.y + u.z * DEPTH;
      const sy = (-205 + 205 * ease.inQuad(shoot)) + gyU * shoot;
      const pop = shoot >= 1 ? 1 + 0.5 * Math.exp(-(after - 0.14) * 14) : 1;
      place(ctx, cam, u.x, shoot >= 1 ? gyU : sy, 0, 0, 1.05 * pop, (c) => {
        if (shoot < 1) { c.strokeStyle = 'rgba(210,220,240,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -4); c.stroke(); }
        staple(c, 9);
      });
    }
  },
};

// ------------------------------------------------------------------ Highlighter
function penBody(ctx) {
  // pen with chisel tip at the origin, body going up-right
  ctx.beginPath(); // tip
  ctx.moveTo(0, 0); ctx.lineTo(-6, -16); ctx.lineTo(10, -20); ctx.closePath();
  fillStroke(ctx, '#fff04d', INK, 2.6);
  ctx.beginPath(); // body
  rrect(ctx, -9, -66, 26, 48, 6);
  fillStroke(ctx, '#e84bd0', INK, 3);
  ctx.beginPath();
  rrect(ctx, -9, -86, 26, 24, 6);
  fillStroke(ctx, '#2a2f55', INK, 3);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-3, -58); ctx.lineTo(-3, -26); ctx.stroke();
}

AREA_DRAW.highlighter = {
  under(ctx, cam, a, b, t, r) {
    if (!cam.visible(a.x, a.radius + 80)) return;
    const sweep = ease.outCubic(sat(a.t / a.sweep));
    const fade = 1 - prog(a.t, a.dur, a.dur + 0.55);
    if (fade <= 0) return;
    const x0 = a.x - a.radius, x1 = x0 + a.radius * 2 * sweep;
    const f = boilFrame(t);
    // the stroke: one fat chiselled band
    ctx.save();
    ctx.globalAlpha = 0.5 * fade;
    ctx.fillStyle = '#fff04d';
    ctx.beginPath();
    const top = -86, bot = 16;
    ctx.moveTo(cam.sx(x0 - 8 + wob(1, 1, f, 1)), cam.sy(bot));
    ctx.lineTo(cam.sx(x0 + 10), cam.sy(top));
    ctx.lineTo(cam.sx(x1 + 10 + wob(2, 2, f, 1)), cam.sy(top));
    ctx.lineTo(cam.sx(x1 - 8), cam.sy(bot));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 * fade;
    ctx.strokeStyle = '#f4c20a';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const y = top + 14 + i * 24; ctx.moveTo(cam.sx(x0 + 14), cam.sy(y)); ctx.lineTo(cam.sx(x1 - 4), cam.sy(y + 2)); }
    ctx.stroke();
    ctx.restore();
    // glow rectangle behind every highlighted ally, like marked-up text
    const pulse = 0.5 + 0.12 * Math.sin(t * 5);
    for (const u of a.members) {
      if (!cam.visible(u.x, 60)) continue;
      const x = r.cam.sx(u.x), gy = r.cam.sy(u.y + u.z * DEPTH), z = cam.zoom * u.scale;
      ctx.globalAlpha = pulse * fade;
      ctx.fillStyle = '#fff04d';
      ctx.beginPath();
      rrect(ctx, x - 22 * z, gy - (u.height + 8) * z, 44 * z, (u.height + 12) * z, 8 * z);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = '#f4c20a';
      ctx.lineWidth = 2 * cam.zoom;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  over(ctx, cam, a, b, t) {
    if (a.t > a.sweep + 0.3) return;
    const sweep = ease.outCubic(sat(a.t / a.sweep));
    const x = a.x - a.radius + a.radius * 2 * sweep;
    const k = 1 - prog(a.t, a.sweep, a.sweep + 0.3);
    ctx.globalAlpha = k;
    place(ctx, cam, x + 6, -4 - Math.sin(a.t * 40) * 3, 0, 0.55, 1.3, penBody);
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ Doodle Drop
function pencilBig(ctx) {
  // tip at origin, body up-right
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-7, -18); ctx.lineTo(7, -18); ctx.closePath();
  fillStroke(ctx, '#f5d7b0', INK, 2.6);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-2.4, -6); ctx.lineTo(2.4, -6); ctx.closePath();
  ctx.fillStyle = '#4b4f66';
  ctx.fill();
  ctx.beginPath();
  rrect(ctx, -7, -78, 14, 62, 2);
  fillStroke(ctx, '#f2c230', INK, 2.8);
  ctx.beginPath();
  rrect(ctx, -7, -92, 14, 14, 3);
  fillStroke(ctx, '#ff8fa3', INK, 2.8);
  ctx.fillStyle = '#c0c6d6';
  ctx.fillRect(-7, -80, 14, 4);
}

AREA_DRAW.doodle_drop = {
  under(ctx, cam, a, b, t) {
    if (!cam.visible(a.x, 120)) return;
    const k = prog(a.t, 0, 0.5);
    const fade = 1 - prog(a.t, a.total - 0.6, a.total);
    const R = 20 + a.count * 11;
    ctx.save();
    ctx.globalAlpha = 0.8 * fade;
    ctx.strokeStyle = '#4b4f66';
    ctx.lineWidth = 2.6 * cam.zoom;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      const end = k * TAU * (pass ? 0.9 : 1);
      for (let s = 0; s <= 28; s++) {
        const an = -2.2 + (s / 28) * end + pass * 0.1;
        const rr = R + pass * 3 + Math.sin(an * 3 + pass) * 1.5;
        const px = cam.sx(a.x + Math.cos(an) * rr), py = cam.sy(Math.sin(an) * rr * 0.34);
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // spark marks where each doodle will stand
    ctx.fillStyle = '#4b4f66';
    ctx.globalAlpha = 0.1 * fade * k;
    ctx.beginPath();
    ctx.ellipse(cam.sx(a.x), cam.sy(0), R * cam.zoom, R * 0.34 * cam.zoom, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  over(ctx, cam, a, b, t) {
    if (a.t > 0.75 || !cam.visible(a.x, 120)) return;
    const k = prog(a.t, 0, 0.5);
    const R = 20 + a.count * 11;
    const an = -2.2 + k * TAU;
    const x = a.x + Math.cos(an) * R, y = Math.sin(an) * R * 0.34;
    ctx.globalAlpha = 1 - prog(a.t, 0.5, 0.75);
    place(ctx, cam, x, y, 0, 0.5 + Math.sin(a.t * 30) * 0.05, 1.2, pencilBig);
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ The Eraser
function eraserBlock(ctx, lean) {
  ctx.save();
  ctx.rotate(lean);
  // shadow side face
  ctx.beginPath();
  rrect(ctx, -64, -52, 128, 54, 10);
  fillStroke(ctx, '#ff7f9c', INK, 3.4);
  // blue paper sleeve
  ctx.beginPath();
  ctx.moveTo(-24, -52); ctx.lineTo(24, -52); ctx.lineTo(24, 2); ctx.lineTo(-24, 2); ctx.closePath();
  fillStroke(ctx, '#3a74e6', INK, 3);
  ctx.fillStyle = '#fff';
  ctx.font = `15px ${MARKER}`;
  ctx.textAlign = 'center';
  ctx.fillText('ERASE', 0, -20);
  ctx.textAlign = 'left';
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-58, -44); ctx.lineTo(-34, -44); ctx.stroke();
  ctx.restore();
}

AREA_DRAW.eraser = {
  under(ctx, cam, a, b, t, r) {
    if (!cam.visible(a.x, a.width)) return;
    const half = a.width / 2;
    const cover = prog(a.t, a.drop, a.drop + a.dur);
    const fade = 1 - prog(a.t, a.total - 0.2, a.total + 0.0);
    // shadow of the eraser
    const x = a.rubX();
    const down = a.t < a.drop ? ease.inQuad(a.t / a.drop) : a.t > a.drop + a.dur ? 1 - ease.inQuad(prog(a.t, a.drop + a.dur, a.total)) : 1;
    groundEllipse(ctx, cam, x, 70, 12, INK, 0.16 + 0.2 * down);
    if (a.t < a.drop) {
      // landing marker
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff7f9c';
      ctx.lineWidth = 3 * cam.zoom;
      ctx.setLineDash([10 * cam.zoom, 8 * cam.zoom]);
      ctx.strokeRect(cam.sx(a.x - half), cam.sy(-BAND), a.width * cam.zoom, BAND * 2 * cam.zoom);
      ctx.restore();
    }
    if (cover <= 0) return;
    // erased band: the page shows through, fading back as the ink returns
    const wipe = a.t > a.drop + a.dur ? 1 - prog(a.t, a.drop + a.dur, a.total + 0.4) : 1;
    ctx.save();
    ctx.globalAlpha = 0.82 * wipe;
    ctx.fillStyle = r.page ? r.page.paper : PAPER;
    ctx.beginPath();
    const f = boilFrame(t);
    const w = a.width * ease.outCubic(sat(cover * 3));
    ctx.rect(cam.sx(a.x - w / 2), cam.sy(-BAND - 2), w * cam.zoom, (BAND * 2 + 6) * cam.zoom);
    ctx.fill();
    ctx.globalAlpha = 0.5 * wipe;
    ctx.strokeStyle = '#ffb3c4';
    ctx.lineWidth = 3 * cam.zoom;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const y = -BAND + 4 + i * 8 + wob(5, i, f, 1);
      ctx.moveTo(cam.sx(a.x - w / 2 + 6), cam.sy(y)); ctx.lineTo(cam.sx(a.x + w / 2 - 6), cam.sy(y + 3));
    }
    ctx.stroke();
    ctx.restore();
  },
  over(ctx, cam, a, b, t, r) {
    if (!cam.visible(a.x, a.width)) return;
    const x = a.rubX();
    // everything under the eraser fades toward blank paper
    const cov = prog(a.t, a.drop, a.drop + a.dur * 0.6);
    const back = a.t > a.drop + a.dur ? 1 - prog(a.t, a.drop + a.dur, a.total + 0.3) : 1;
    if (cov > 0 && back > 0) {
      ctx.globalAlpha = 0.5 * cov * back;
      ctx.fillStyle = r.page ? r.page.paper : PAPER;
      const w = a.width * ease.outCubic(sat(prog(a.t, a.drop, a.drop + a.dur) * 3));
      ctx.fillRect(cam.sx(a.x - w / 2), cam.sy(-86), w * cam.zoom, 110 * cam.zoom);
      ctx.globalAlpha = 1;
    }
    let y;
    if (a.t < a.drop) y = -480 * (1 - ease.inCubic(a.t / a.drop));
    else if (a.t > a.drop + a.dur) y = -480 * ease.inQuad(prog(a.t, a.drop + a.dur, a.total));
    else y = Math.sin(a.t * 38) * 1.6;
    const k = Math.min(a.t, a.drop + a.dur) - a.drop;
    const lean = a.t > a.drop && a.t < a.drop + a.dur ? -Math.sin((k / a.dur) * TAU * Math.max(1.5, a.dur * 1.4)) * 0.1 : 0;
    place(ctx, cam, x, y - 2, 0, 0, 1.15, (c) => eraserBlock(c, lean));
  },
};
