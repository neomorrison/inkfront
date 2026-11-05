// OWNER: units builder (package A); enemy support units (glow_shaman, whiteout_priest) by package B via def fields
// behavior 'support' (Medic and enemy healers): stay behind, heal the most hurt ally in range (def.heal), auraBuff, reviveEvery.
// Until implemented, the sim falls back to plain melee/ranged behavior for these units.
import { BEHAVIORS } from '../registry.js';

export {}; // register into BEHAVIORS here
