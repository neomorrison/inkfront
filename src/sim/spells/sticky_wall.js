// Sticky Wall: a stack of sticky notes slapped down at a point. Enemies must chew through it.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { spellFx } from './util.js';

SPELL_IMPL.sticky_wall = {
  cast(b, team, x, level) {
    const hp = spellValue('sticky_wall', 'hp', level);
    const dur = spellValue('sticky_wall', 'dur', level);
    const u = b.spawnUnit(team, 'sticky_wall', { x, z: 0, level: 1, lifetime: dur, spawnTime: 0.35, summoned: true });
    u.maxHp = hp;
    u.hp = hp;
    spellFx(b, 'sticky_wall', 'cast', x, team, {});
    spellFx(b, 'sticky_wall', 'impact', x, team, {});
    return true;
  },
};
