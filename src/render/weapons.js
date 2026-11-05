// Weapon and prop drawers, keyed by look.weapon. Each entry may define layers:
//   back(ctx, J, o)   drawn after the back limbs (bows held in the far hand)
//   mid(ctx, J, o)    drawn after the head, before the front arm (shields)
//   front(ctx, J, o)  drawn last (swords, spears)
// J = jittered joints in local space (facing right); o = draw options from drawStick
// (o.col ink, o.back far-limb ink, o.paper, o.light, o.dark, o.lw, o.unit, o.t).
// OWNER: foundation drew the basics; units (A) and factions (B) builders add the rest.

export const WEAPONS = {};

export function dirOf(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}

// Rotate a direction; negative turns it upward when facing right.
export function rot(d, th) {
  const c = Math.cos(th), s = Math.sin(th);
  return [d[0] * c - d[1] * s, d[0] * s + d[1] * c];
}

export function line(ctx, x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function blade(ctx, J, o, len, tilt, guard = 7) {
  const d = rot(dirOf(J.eF, J.hF), tilt);
  const [hx, hy] = J.hF;
  ctx.strokeStyle = o.col;
  ctx.lineWidth = o.lw * 0.75;
  ctx.beginPath();
  line(ctx, hx - d[0] * 3, hy - d[1] * 3, hx + d[0] * len, hy + d[1] * len);
  ctx.stroke();
  ctx.lineWidth = o.lw * 0.9;
  ctx.beginPath();
  const gx = hx + d[0] * 2.5, gy = hy + d[1] * 2.5;
  line(ctx, gx - d[1] * guard * 0.5, gy + d[0] * guard * 0.5, gx + d[1] * guard * 0.5, gy - d[0] * guard * 0.5);
  ctx.stroke();
}

WEAPONS.none = {};

WEAPONS.fists = {
  front(ctx, J, o) {
    ctx.fillStyle = o.col;
    ctx.beginPath();
    ctx.arc(J.hF[0], J.hF[1], 2.3, 0, Math.PI * 2);
    ctx.arc(J.hB[0], J.hB[1], 2.1, 0, Math.PI * 2);
    ctx.fill();
  },
};

WEAPONS.claws = {
  front(ctx, J, o) {
    const d = dirOf(J.eF, J.hF);
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.6;
    ctx.beginPath();
    for (const a of [-0.5, 0, 0.5]) {
      const r = rot(d, a);
      line(ctx, J.hF[0], J.hF[1], J.hF[0] + r[0] * 5, J.hF[1] + r[1] * 5);
    }
    ctx.stroke();
  },
};

WEAPONS.sword = { front: (ctx, J, o) => blade(ctx, J, o, 24, -0.6) };

WEAPONS.sword_shield = {
  mid(ctx, J, o) {
    const [x, y] = J.hB;
    ctx.fillStyle = o.light || o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 15);
    ctx.quadraticCurveTo(x + 8, y - 15, x + 8, y - 4);
    ctx.quadraticCurveTo(x + 8, y + 10, x + 1, y + 15);
    ctx.quadraticCurveTo(x - 5, y + 9, x - 4, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = o.lw * 0.6;
    ctx.beginPath();
    line(ctx, x + 2, y - 10, x + 2, y + 9);
    line(ctx, x - 2, y - 2, x + 6, y - 2);
    ctx.stroke();
  },
  front: (ctx, J, o) => blade(ctx, J, o, 18, -0.6, 6),
};

WEAPONS.spear = {
  front(ctx, J, o) {
    const u = o.unit;
    const d = u && u.attacking ? rot(dirOf(J.eF, J.hF), -0.15) : [Math.sin(1.72), Math.cos(1.72)];
    const [hx, hy] = J.hF;
    const tx = hx + d[0] * 42, ty = hy + d[1] * 42;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.7;
    ctx.beginPath();
    line(ctx, hx - d[0] * 16, hy - d[1] * 16, tx, ty);
    ctx.stroke();
    ctx.fillStyle = o.col;
    ctx.beginPath();
    ctx.moveTo(tx + d[0] * 8, ty + d[1] * 8);
    ctx.lineTo(tx - d[1] * 3, ty + d[0] * 3);
    ctx.lineTo(tx + d[1] * 3, ty - d[0] * 3);
    ctx.closePath();
    ctx.fill();
  },
};

WEAPONS.bow = {
  back(ctx, J, o) {
    const [x, y] = J.hB;
    const u = o.unit;
    const drawing = u && u.attacking && u.anim.atk < 0.5;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = o.lw * 0.8;
    ctx.beginPath();
    ctx.arc(x - 9, y, 17, -1.05, 1.05);
    ctx.stroke();
    const ax = x - 9 + Math.cos(-1.05) * 17, ay = y + Math.sin(-1.05) * 17;
    const bx = ax, by = y - (ay - y);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    if (drawing) {
      ctx.moveTo(ax, ay); ctx.lineTo(J.hF[0], J.hF[1]); ctx.lineTo(bx, by);
    } else {
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke();
    if (drawing) {
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      line(ctx, J.hF[0], J.hF[1], x + 10, y);
      ctx.stroke();
    }
  },
};

WEAPONS.sling = {
  front(ctx, J, o) {
    const u = o.unit;
    const [hx, hy] = J.hF;
    let px, py;
    if (u && u.attacking && u.anim.atk < 0.5) {
      const d = dirOf(J.eF, J.hF);
      px = hx + d[0] * 11; py = hy + d[1] * 11;
    } else {
      px = hx + Math.sin(o.t * 3) * 1.5; py = hy + 10;
    }
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    line(ctx, hx, hy, px, py);
    ctx.stroke();
    ctx.fillStyle = o.col;
    ctx.beginPath();
    ctx.arc(px, py, 2.4, 0, Math.PI * 2);
    ctx.fill();
  },
};

WEAPONS.bottle = {
  front(ctx, J, o) {
    const u = o.unit;
    if (u && u.data && u.data.carry > 0 && u.data.phase !== 'gather') {
      // Big ink drop carried overhead.
      const x = (J.hF[0] + J.hB[0]) / 2, y = Math.min(J.hF[1], J.hB[1]) - 5;
      ctx.fillStyle = o.inkDrop || '#1b2240';
      ctx.strokeStyle = o.col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.quadraticCurveTo(x + 7, y - 1, x + 6, y + 3);
      ctx.arc(x, y + 3, 6, 0, Math.PI);
      ctx.quadraticCurveTo(x - 7, y - 1, x, y - 9);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const [x, y] = J.hF;
    ctx.fillStyle = o.light || o.paper;
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.rect(x - 2.6, y - 1, 5.2, 6.5);
    ctx.rect(x - 1.3, y - 3.2, 2.6, 2.2);
    ctx.fill();
    ctx.stroke();
  },
};
