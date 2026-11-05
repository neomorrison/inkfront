// OWNER: AI/levels/modes builder (package C)
// Level modifiers (data/levels.js MODIFIERS): MODIFIER_IMPL[id] = { init?(b), update?(b, dt) }.
import { MODIFIER_IMPL } from './registry.js';

// Simple ones so early levels work before package C lands.
MODIFIER_IMPL.wind_left = { init(b) { b.wind = -260; } };
MODIFIER_IMPL.wind_right = { init(b) { b.wind = 260; } };
MODIFIER_IMPL.double_fort = { init(b) { const f = b.teams[1].fort; f.maxHp *= 2; f.hp = f.maxHp; } };
MODIFIER_IMPL.gold_rush = { init(b) { b.centerYield = 3.5; } };
