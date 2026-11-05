// Pencil Rain: sharpened pencils fall across the target area over ~1 second.
// This is the reference spell; the others in this folder follow the same shape.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { Projectile } from '../projectile.js';
import { spellFx } from './util.js';

SPELL_IMPL.pencil_rain = {
  cast(b, team, x, level, def) {
    const n = spellValue('pencil_rain', 'count', level);
    const dmg = spellValue('pencil_rain', 'dmg', level);
    spellFx(b, 'pencil_rain', 'cast', x, team, { radius: def.radius });
    b.areas.push({
      kind: 'pencil_rain', team, x, radius: def.radius, t: 0, dur: 1.3, n, spawned: 0, alive: true,
      update(b, dt) {
        this.t += dt;
        const want = Math.min(this.n, Math.ceil((this.t / 1.0) * this.n));
        while (this.spawned < want) {
          this.spawned++;
          const tx = this.x + b.rng.range(-1, 1) * this.radius;
          const fallT = 0.55;
          b.projectiles.push(new Projectile({
            x: tx - 60, y: -760, vx: 60 / fallT, vy: 760 / fallT - 0.5 * 1200 * fallT, g: 1200,
            team: this.team, dmg, kind: 'pencil', dmgKind: 'pierce', aoe: 26, kb: 30, z: b.rng.range(-1, 1),
          }));
        }
        if (!this.hit && this.t >= 0.55) { this.hit = true; spellFx(b, 'pencil_rain', 'impact', this.x, this.team, { radius: this.radius }); }
        if (this.t >= this.dur) { spellFx(b, 'pencil_rain', 'end', this.x, this.team, { radius: this.radius }); this.alive = false; }
      },
    });
    return true;
  },
};
