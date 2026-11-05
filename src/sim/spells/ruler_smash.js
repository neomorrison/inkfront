// Ruler Smash: a giant ruler slams down across a strip. Damage, a small pop and a stun.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { foes, onGround, inStrip, burstDmg, spellFx } from './util.js';

const WINDUP = 0.75; // the ruler rises, tilts and falls; the strip is marked on the ground
const LINGER = 1.1; // it stays down a moment, then fades

SPELL_IMPL.ruler_smash = {
  cast(b, team, x, level, def) {
    const dmg = spellValue('ruler_smash', 'dmg', level);
    const stun = spellValue('ruler_smash', 'stun', level);
    const half = def.width / 2;
    spellFx(b, 'ruler_smash', 'cast', x, team, { width: def.width });
    b.areas.push({
      kind: 'ruler_smash', team, x, width: def.width, t: 0, windup: WINDUP, total: WINDUP + LINGER, hit: false, alive: true,
      update(b, dt) {
        this.t += dt;
        if (!this.hit && this.t >= this.windup) {
          this.hit = true;
          let n = 0;
          for (const e of foes(b, this.team)) {
            if (!onGround(e) || !inStrip(e, this.x, half)) continue;
            n++;
            const dir = Math.sign(e.x - this.x) || b.teams[this.team].dir;
            b.damage(e, burstDmg(e, dmg), { team: this.team, kind: 'blast', dir, kb: 60, kbUp: 340 });
            if (e.alive) e.addBuff({ id: 'ruler_stun', t: stun, stun: true });
          }
          spellFx(b, 'ruler_smash', 'impact', this.x, this.team, { width: this.width, hits: n });
        }
        if (this.t >= this.total) {
          spellFx(b, 'ruler_smash', 'end', this.x, this.team, { width: this.width });
          this.alive = false;
        }
      },
    });
    return true;
  },
};
