// Coffee Spill: a cup tips over, the puddle burns and slows enemies standing in it.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { foes, onGround, spellFx } from './util.js';

const TIP = 0.5; // seconds for the cup to fall and tip
const FADE = 1.2; // visual drying time after the effect ends

SPELL_IMPL.coffee_spill = {
  cast(b, team, x, level, def) {
    const dur = spellValue('coffee_spill', 'dur', level);
    const dps = spellValue('coffee_spill', 'dps', level);
    const slow = spellValue('coffee_spill', 'slow', level);
    spellFx(b, 'coffee_spill', 'cast', x, team, { radius: def.radius });
    b.areas.push({
      kind: 'coffee_spill', team, x, radius: def.radius, t: 0, tip: TIP, dur, total: TIP + dur + FADE,
      landed: false, ended: false, tickT: 0, fxT: 0, alive: true,
      update(b, dt) {
        this.t += dt;
        if (this.t >= this.tip && !this.landed) {
          this.landed = true;
          spellFx(b, 'coffee_spill', 'impact', this.x, this.team, { radius: this.radius });
        }
        if (this.landed && !this.ended) {
          if (this.t >= this.tip + this.dur) {
            this.ended = true;
            spellFx(b, 'coffee_spill', 'end', this.x, this.team, { radius: this.radius });
          } else {
            this.tickT -= dt;
            this.fxT -= dt;
            if (this.tickT <= 0) {
              this.tickT = 0.25;
              for (const e of foes(b, this.team)) {
                if (!onGround(e) || Math.abs(e.x - this.x) > this.radius + e.radius * 0.5) continue;
                e.addBuff({ id: 'coffee_burn', t: 0.6, dot: dps, team: this.team, source: null });
                e.addBuff({ id: 'coffee_slow', t: 0.6, speed: 1 - slow });
              }
            }
            if (this.fxT <= 0) {
              this.fxT = 0.5;
              spellFx(b, 'coffee_spill', 'tick', this.x, this.team, { radius: this.radius });
            }
          }
        }
        if (this.t >= this.total) this.alive = false;
      },
    });
    return true;
  },
};
