// Apply the Captain's skill tree (data/hero.js HERO_SKILLS) to a player team config.
// cfg.mods = team-wide multipliers (see src/sim/stats.js makeMods); cfg.hero = hero config.
// Hero-only numbers live on cfg.hero and are read by src/sim/behaviors/hero.js.
// Deep Pockets (gold) is applied in progression.js when a battle result is paid out.
import { HERO_RESPAWN } from '../data/hero.js';

export function applyHeroSkills(cfg, profile) {
  const s = (profile.hero && profile.hero.skills) || {};
  const r = (id) => s[id] || 0;
  const mods = cfg.mods || (cfg.mods = {});
  const mul = (key, f) => { mods[key] = (mods[key] ?? 1) * f; };

  if (cfg.hero) {
    const h = cfg.hero;
    h.dmgMult *= 1 + 0.1 * r('sharp_nib');
    h.hpMult *= 1 + 0.12 * r('thick_cape');
    h.lifesteal = 0.06 * r('lifesteal');
    h.stormDur = r('whirlwind');
    h.furyRate = 1 + 0.25 * r('whirlwind');
    h.rallyDur = 2 * r('loud_voice');
    h.rallyRadius = 60 * r('loud_voice');
    h.inspire = 0.05 * r('inspire');
    h.respawn = Math.max(4, HERO_RESPAWN - 3 * r('quick_return'));
  }
  mul('build', 1 - 0.06 * r('drill'));
  mul('cost', 1 - 0.06 * r('warlord'));
  mul('spellCd', 1 - 0.08 * r('spell_mastery'));
  cfg.income += 0.3 * r('ink_saver');
}
