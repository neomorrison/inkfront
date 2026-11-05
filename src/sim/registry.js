// Plug-in registries for the battle sim. Feature files register into these at import time;
// src/sim/index.js imports every feature file so the registries are full before a Battle starts.
// No imports here, so any sim file can import this without cycles.

// BEHAVIORS[name] = { init?(u, b), update(u, b, dt), onDeath?(u, b, info) }
// A unit whose behavior is not registered falls back to 'ranged' (has proj) or 'melee'.
export const BEHAVIORS = {};

// TRAITS[name] = hooks, all optional:
//   init(u, b)                         once at spawn
//   update(u, b, dt)                   every tick after the behavior
//   onDamaged(u, b, dmg, info) -> dmg  adjust incoming damage (shield block, etc.)
//   onHit(u, b, target, info)          after this unit damages something
//   onLethal(u, b, info) -> true       cancel a death (reassemble); you must restore hp yourself
//   onDeath(u, b, info)                after death (death blast, shatter)
export const TRAITS = {};

// SPELL_IMPL[id] = { cast(b, teamIdx, x, level, def) -> bool }  (false = refund the cooldown)
export const SPELL_IMPL = {};

// MODE_IMPL[mode] = { init?(b), update?(b, dt), check(b) -> null | { winner, reason } }
export const MODE_IMPL = {};

// MODIFIER_IMPL[id] = { init?(b), update?(b, dt) }  level modifiers like night, rain, wind
export const MODIFIER_IMPL = {};

// STAT_HOOKS: fn(def, level, stats, team, perks) mutating stats when a unit is created.
export const STAT_HOOKS = [];

// PERK_IMPL[id] = { apply?(b, teamIdx), update?(b, teamIdx, dt) }  endless draft perks
export const PERK_IMPL = {};

// HERO_ABILITY_IMPL[id] = { cast(b, hero) -> bool }
export const HERO_ABILITY_IMPL = {};

// Hooks run on every Battle constructor after teams exist: fn(b)
export const BATTLE_INIT_HOOKS = [];
