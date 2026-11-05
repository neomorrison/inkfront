// OWNER: hero builder (package E)
// Apply the Captain's skill tree (data/hero.js HERO_SKILLS) to a player team config.
// cfg.mods = team-wide multipliers (see src/sim/stats.js makeMods); cfg.hero = hero config.
export function applyHeroSkills(cfg, profile) {
  const s = (profile.hero && profile.hero.skills) || {};
  const r = (id) => s[id] || 0;
  if (cfg.hero) {
    cfg.hero.dmgMult *= 1 + 0.1 * r('sharp_nib');
    cfg.hero.hpMult *= 1 + 0.12 * r('thick_cape');
  }
  cfg.income += 0.3 * r('ink_saver');
}
