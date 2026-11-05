// Highlighter: allies in the area get more damage and steady healing for a few seconds.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { friends, spellFx } from './util.js';

const SWEEP = 0.45; // the marker stroke draws across the area

SPELL_IMPL.highlighter = {
  cast(b, team, x, level, def) {
    const dmg = spellValue('highlighter', 'dmg', level);
    const heal = spellValue('highlighter', 'heal', level);
    const dur = spellValue('highlighter', 'dur', level);
    const members = [];
    for (const u of friends(b, team)) {
      if (Math.abs(u.x - x) > def.radius + u.radius) continue;
      u.addBuff({ id: 'highlighted', t: dur, dmg: 1 + dmg, hot: (u.maxHp * heal) / dur });
      members.push(u);
    }
    spellFx(b, 'highlighter', 'cast', x, team, { radius: def.radius, hits: members.length });
    spellFx(b, 'highlighter', 'impact', x, team, { radius: def.radius, units: members });
    b.areas.push({
      kind: 'highlighter', team, x, radius: def.radius, t: 0, sweep: SWEEP, dur, members, fxT: 0.3, alive: true,
      update(b, dt) {
        this.t += dt;
        this.fxT -= dt;
        this.members = this.members.filter((u) => u.alive);
        if (this.fxT <= 0 && this.t < this.dur) {
          this.fxT = 0.5;
          spellFx(b, 'highlighter', 'tick', this.x, this.team, { radius: this.radius, units: this.members });
        }
        if (this.t >= this.dur + 0.6) {
          spellFx(b, 'highlighter', 'end', this.x, this.team, { radius: this.radius });
          this.alive = false;
        }
      },
    });
    return true;
  },
};
