import { Projectile } from './projectile.js';

export const FORT_X = 150; // fort center distance from the battlefield edge

// A team's base. Losing it loses the battle. Its tower shoots the nearest enemy in range.
export class Fort {
  constructor(b, team, x, c = {}) {
    this.id = -1 - team;
    this.team = team;
    this.x = x;
    this.y = 0;
    this.z = -0.6;
    this.radius = 62;
    this.height = 200;
    this.top = -200;
    this.maxHp = Math.round(c.hp ?? 2000);
    this.hp = this.maxHp;
    this.armor = c.armor ?? 0;
    this.alive = true;
    this.isFort = true;
    this.targetable = true;
    this.invulnerable = !!c.invulnerable;
    this.tags = new Set(['structure', 'fort']);
    this.mod = { dmgTaken: 1 };
    this.lastHitT = -99;
    this.turret = {
      dmg: c.turretDmg ?? 12,
      range: c.turretRange ?? 470,
      cd: c.turretCd ?? 1.6,
      shots: c.turretShots ?? 1,
      t: 1.5,
      on: c.turret !== false,
    };
  }

  update(b, dt) {
    if (!this.alive || !this.turret.on || b.result) return;
    const tu = this.turret;
    tu.t -= dt;
    if (tu.t > 0) return;
    const enemies = b.byTeam[1 - this.team];
    let best = null, bd = tu.range;
    for (const e of enemies) {
      if (!e.alive || !e.targetable || e.stealth) continue;
      const d = Math.abs(e.x - this.x) - e.radius;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { tu.t = 0.25; return; }
    tu.t = tu.cd;
    const dir = Math.sign(best.x - this.x) || 1;
    for (let i = 0; i < tu.shots; i++) {
      const sx = this.x + dir * 18, sy = -178;
      const T = 0.55 + bd / 1400 + i * 0.05;
      const tx = best.x + (best.moveV || 0) * T + b.rng.range(-12, 12) + i * dir * 14;
      const ty = best.y - best.height * 0.5;
      const g = 900;
      b.projectiles.push(new Projectile({
        x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T, g,
        team: this.team, dmg: tu.dmg, kind: 'arrow', dmgKind: 'pierce', kb: 8, z: best.z, source: null,
      }));
    }
    b.emit('shoot', { fort: this, kind: 'arrow', x: this.x, y: -178, z: this.z, team: this.team });
  }
}
