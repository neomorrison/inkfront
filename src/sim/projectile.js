// Ballistic projectiles: arrows, stones, boulders, falling pencils, magic bolts.
// kind picks the sprite and sound; dmgKind picks armor rules; aoe > 0 explodes on impact.
export class Projectile {
  constructor(o) {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.g = 900; this.z = 0;
    this.team = 0; this.dmg = 0; this.kind = 'arrow'; this.dmgKind = 'pierce';
    this.aoe = 0; this.fortMult = 1; this.kb = 0; this.source = null; this.bonus = null;
    this.effects = null; // { burn: {dps, t}, slow: {mult, t}, stun: t, root: t }
    this.pierce = 0; this.life = 4; this.alive = true; this.homing = null; this.hitAir = true;
    this.onImpact = null; // optional fn(b, p, target|null)
    Object.assign(this, o);
    this.px = this.x; this.py = this.y;
    this.hitIds = null;
  }

  update(b, dt) {
    this.px = this.x; this.py = this.y;
    if (this.homing && this.homing.alive) {
      const h = this.homing;
      const ty = h.y - h.height * 0.55;
      const dx = h.x - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(this.vx, this.vy);
      this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 8);
      this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 8);
    } else {
      this.vy += this.g * dt;
      if (b.wind) this.vx += b.wind * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    const enemies = b.byTeam[1 - this.team];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || !e.targetable || e.stealth) continue;
      if (this.hitIds && this.hitIds.has(e.id)) continue;
      if (Math.abs(e.x - this.x) > e.radius + 4) continue;
      const top = e.y - e.height;
      if (this.y < top || this.y > e.y + 4) continue;
      this.impact(b, e);
      if (!this.alive) return;
    }
    const fort = b.teams[1 - this.team].fort;
    if (fort.alive && Math.abs(this.x - fort.x) <= fort.radius && this.y >= fort.top) {
      this.impact(b, fort);
      return;
    }
    for (let i = 0; i < b.blockers.length; i++) {
      const w = b.blockers[i];
      if (!w.alive || w.team === this.team) continue;
      if (Math.abs(this.x - w.x) <= w.radius && this.y >= w.y - w.height) { this.impact(b, w); return; }
    }
    if (this.y >= 0) {
      this.y = 0;
      if (this.aoe > 0) this.explodeHere(b);
      else if (this.onImpact) this.onImpact(b, this, null);
      b.emit('projLand', { kind: this.kind, x: this.x, z: this.z, vx: this.vx, vy: this.vy, team: this.team });
      this.alive = false;
      return;
    }
    if (this.life <= 0 || this.x < -300 || this.x > b.width + 300) this.alive = false;
  }

  explodeHere(b) {
    b.explode(this.x, this.y, this.aoe, this.dmg, { team: this.team, source: this.source, fortMult: this.fortMult, kb: this.kb, fx: this.kind });
    if (this.onImpact) this.onImpact(b, this, null);
  }

  impact(b, target) {
    if (this.aoe > 0) {
      this.explodeHere(b);
      this.alive = false;
      return;
    }
    let dmg = this.dmg;
    if (this.bonus && !target.isFort) for (const tag in this.bonus) if (target.tags && target.tags.has(tag)) dmg *= this.bonus[tag];
    if (target.isFort) dmg *= this.fortMult;
    else if (this.source) {
      const vs = b.teams[this.team].mods.vsLarge;
      if (vs !== 1 && (target.tags.has('large') || target.tags.has('boss'))) dmg *= vs;
    }
    b.damage(target, dmg, { source: this.source, team: this.team, kind: this.dmgKind, dir: Math.sign(this.vx) || 1, kb: this.kb, proj: this });
    if (this.effects && target.alive && !target.isFort) applyEffects(target, this.effects, this.team, this.source);
    if (this.onImpact) this.onImpact(b, this, target);
    b.emit('projHit', { kind: this.kind, x: this.x, y: this.y, z: this.z, team: this.team, target, fort: !!target.isFort });
    if (this.pierce > 0 && !target.isFort) {
      this.pierce--;
      (this.hitIds || (this.hitIds = new Set())).add(target.id);
    } else this.alive = false;
  }
}

export function applyEffects(t, fx, team, source) {
  if (fx.burn) t.addBuff({ id: 'burn', t: fx.burn.t, dot: fx.burn.dps, team, source });
  if (fx.slow) t.addBuff({ id: 'slow', t: fx.slow.t, speed: fx.slow.mult });
  if (fx.stun) t.addBuff({ id: 'stun', t: fx.stun, stun: true });
  if (fx.root) t.addBuff({ id: 'root', t: fx.root, root: true });
}
