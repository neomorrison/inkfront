// Doodle Drop: sketch a squad of Brawlers right where you need them.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { spellFx } from './util.js';

const SKETCH = 0.9;

SPELL_IMPL.doodle_drop = {
  cast(b, team, x, level) {
    return castDoodles(b, team, x, level);
  },
};

function castDoodles(b, team, x, lv) {
  const t = b.teams[team];
  const count = spellValue('doodle_drop', 'count', lv);
  const bonus = spellValue('doodle_drop', 'level', lv);
  const level = Math.min(10, (t.unitLevels.brawler ?? 1) + bonus);
  spellFx(b, 'doodle_drop', 'cast', x, team, { count });
  const spread = 26 * count;
  for (let i = 0; i < count; i++) {
    const px = Math.max(30, Math.min(b.width - 30, x + ((i + 0.5) / count - 0.5) * 2 * spread * 0.5 + b.rng.range(-6, 6)));
    const u = b.spawnUnit(team, 'brawler', { x: px, z: ((i % 3) - 1) * 0.7, level, summoned: true, spawnTime: SKETCH + i * 0.05 });
    // Doodles do not use up army size.
    u.def = { ...u.def, pop: 0 };
    u.data.doodle = true;
  }
  b.areas.push({
    kind: 'doodle_drop', team, x, count, t: 0, total: SKETCH + 0.9, alive: true,
    update(b, dt) {
      this.t += dt;
      if (this.t >= this.total) {
        spellFx(b, 'doodle_drop', 'end', this.x, this.team, {});
        this.alive = false;
      }
    },
  });
  spellFx(b, 'doodle_drop', 'impact', x, team, { count });
  return true;
}
