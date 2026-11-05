// The Eraser: a giant eraser rubs back and forth across a strip, wearing everything in it down.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { foes, onGround, inStrip, burstDmg, spellFx } from './util.js';

const DROP = 0.45; // eraser comes down
const LIFT = 0.5; // and goes back up

SPELL_IMPL.eraser = {
  cast(b, team, x, level, def) {
    const dmg = spellValue('eraser', 'dmg', level);
    const dur = spellValue('eraser', 'dur', level);
    const half = def.width / 2;
    spellFx(b, 'eraser', 'cast', x, team, { width: def.width });
    b.areas.push({
      kind: 'eraser', team, x, width: def.width, t: 0, drop: DROP, dur, lift: LIFT, total: DROP + dur + LIFT, rubT: 0, started: false, alive: true,
      update(b, dt) {
        this.t += dt;
        if (this.t >= this.drop && this.t < this.drop + this.dur) {
          if (!this.started) {
            this.started = true;
            spellFx(b, 'eraser', 'impact', this.x, this.team, { width: this.width });
          }
          const rate = dmg / this.dur;
          for (const e of foes(b, this.team)) {
            if (!onGround(e) || !inStrip(e, this.x, half)) continue;
            b.damage(e, burstDmg(e, rate * dt), { team: this.team, kind: 'erase', silent: true, dir: b.teams[this.team].dir });
            if (e.alive) e.addBuff({ id: 'erased_slow', t: 0.3, speed: 0.55 });
          }
          this.rubT -= dt;
          if (this.rubT <= 0) {
            this.rubT = 0.3;
            spellFx(b, 'eraser', 'tick', this.x, this.team, { width: this.width });
          }
        }
        if (this.t >= this.total) {
          spellFx(b, 'eraser', 'end', this.x, this.team, { width: this.width });
          this.alive = false;
        }
      },
    });
    return true;
  },
};
