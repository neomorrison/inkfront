// Stapler: a giant stapler thumps the page and staples every enemy in the area in place.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { foes, onGround, burstDmg, spellFx } from './util.js';

const WINDUP = 0.55;

SPELL_IMPL.stapler = {
  cast(b, team, x, level, def) {
    const dmg = spellValue('stapler', 'dmg', level);
    const root = spellValue('stapler', 'root', level);
    spellFx(b, 'stapler', 'cast', x, team, { radius: def.radius });
    b.areas.push({
      kind: 'stapler', team, x, radius: def.radius, t: 0, windup: WINDUP, root, targets: [], hit: false, alive: true,
      update(b, dt) {
        this.t += dt;
        if (!this.hit && this.t >= this.windup) {
          this.hit = true;
          for (const e of foes(b, this.team)) {
            if (!onGround(e) || Math.abs(e.x - this.x) > this.radius + e.radius * 0.5) continue;
            b.damage(e, burstDmg(e, dmg), { team: this.team, kind: 'pierce', dir: b.teams[this.team].dir, silent: false });
            if (!e.alive) continue;
            e.addBuff({ id: 'stapled', t: this.root, root: true });
            if (e.hasBuff('stapled')) this.targets.push(e);
          }
          spellFx(b, 'stapler', 'impact', this.x, this.team, { radius: this.radius, hits: this.targets.length });
        }
        if (this.hit) {
          this.targets = this.targets.filter((e) => e.alive && e.hasBuff('stapled'));
          if (!this.targets.length || this.t > this.windup + this.root + 0.2) {
            spellFx(b, 'stapler', 'end', this.x, this.team, { radius: this.radius });
            this.alive = false;
          }
        }
      },
    });
    return true;
  },
};
