// Armies. palette.ink = main stroke, dark = outline/shadow, light = fills/highlights,
// under = optional wide underlay stroke (highlighter look). Pages may override palettes for contrast.

export const FACTIONS = {
  ink: {
    id: 'ink', name: 'Blue Ink', short: 'Blue',
    palette: { ink: '#1f47c2', dark: '#132a73', light: '#a9bdf5', under: null },
    fort: 'castle', eyes: 'dot',
  },
  red: {
    id: 'red', name: 'Red Pen Rebels', short: 'Red',
    palette: { ink: '#cf2d24', dark: '#7a140f', light: '#f6b0aa', under: null },
    fort: 'castle', eyes: 'angry',
    roster: ['scribe', 'brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'rider', 'bomber', 'medic'],
    boss: 'boss_redline',
  },
  graphite: {
    id: 'graphite', name: 'Graphite Horde', short: 'Graphite',
    palette: { ink: '#4b4b52', dark: '#1f1f23', light: '#c4c4cc', under: null },
    fort: 'pencil_fort', eyes: 'angry',
    roster: ['scribe', 'smudgeling', 'sharpener', 'lead_thrower', 'graphite_golem', 'spearman', 'shieldbearer'],
    boss: 'boss_smudge',
  },
  neon: {
    id: 'neon', name: 'Highlighter Gang', short: 'Neon',
    palette: { ink: '#e0177d', dark: '#7d0a45', light: '#ffc2e0', under: 'rgba(255,236,40,.55)' },
    fort: 'neon_fort', eyes: 'angry',
    roster: ['scribe', 'glowrunner', 'neon_archer', 'marker_knight', 'glow_shaman', 'bomber', 'rider'],
    boss: 'boss_wyrm',
  },
  chalk: {
    id: 'chalk', name: 'Chalk Legion', short: 'Chalk',
    palette: { ink: '#f4f1e6', dark: '#b9b39e', light: '#ffffff', under: null },
    fort: 'chalk_fort', eyes: 'angry',
    roster: ['scribe', 'dustborn', 'chalk_thrower', 'board_brute', 'dust_mage', 'spearman', 'archer'],
    boss: 'boss_professor',
  },
  eraser: {
    id: 'eraser', name: 'Eraser Empire', short: 'Eraser',
    palette: { ink: '#d9667f', dark: '#7e2a41', light: '#f8c6d1', under: null },
    fort: 'eraser_fort', eyes: 'angry',
    roster: ['scribe', 'crumb', 'eraser_knight', 'shaving_slinger', 'whiteout_priest', 'colossus', 'ninja'],
    boss: 'boss_hand',
  },
};

export function paletteFor(factionId, page) {
  const f = FACTIONS[factionId] || FACTIONS.ink;
  const o = page && page.paletteOverride && page.paletteOverride[factionId];
  return o ? { ...f.palette, ...o } : f.palette;
}
