// Battlefield looks, one per chapter. The renderer (src/render/world.js) reads these.
// paletteOverride keeps every army readable on dark paper.

export const PAGES = {
  ruled: {
    id: 'ruled', name: 'Ruled Paper',
    paper: '#fffdf4', rule: '#bcd4ee', ruleGap: 34, margin: '#ef8f8f', grid: null,
    doodle: '#8d96ad', ground: '#4f5878', hatch: 'rgba(79,88,120,.16)', sky: null,
    doodles: ['cloud', 'sun', 'hill', 'tree', 'bird'],
  },
  graph: {
    id: 'graph', name: 'Graph Paper',
    paper: '#f7fbf6', rule: null, ruleGap: 0, margin: null, grid: { gap: 26, color: '#cfe4d6', major: '#a9cdb5', every: 5 },
    doodle: '#7f9a8a', ground: '#4d5e55', hatch: 'rgba(77,94,85,.16)',
    doodles: ['cloud', 'mountain', 'tree', 'bird', 'axis'],
  },
  sketch: {
    id: 'sketch', name: 'Sketchbook',
    paper: '#fbf5e8', rule: null, ruleGap: 0, margin: null, grid: null, tooth: true,
    doodle: '#a59c8a', ground: '#6a5f4c', hatch: 'rgba(106,95,76,.16)',
    doodles: ['cloud', 'star', 'hill', 'tree', 'moon'],
  },
  chalk: {
    id: 'chalk', name: 'Chalkboard',
    paper: '#2e4a3d', rule: null, ruleGap: 0, margin: null, grid: null, chalky: true, frame: '#7a5634',
    doodle: 'rgba(240,240,230,.35)', ground: 'rgba(240,240,230,.75)', hatch: 'rgba(240,240,230,.10)',
    doodles: ['equation', 'cloud', 'star', 'axis'],
    paletteOverride: {
      ink: { ink: '#a8d4ff', dark: '#5d97d6', light: '#e1f0ff' },
      red: { ink: '#ff9c8f', dark: '#c45a4d', light: '#ffd9d3' },
      graphite: { ink: '#c9c9cf', dark: '#8a8a92', light: '#eeeeee' },
      eraser: { ink: '#ffb3c4', dark: '#c46a80', light: '#ffe1e8' },
      neon: { ink: '#ff6cb5', dark: '#c42d77', light: '#ffd0e6' },
    },
  },
  last: {
    id: 'last', name: 'The Last Page',
    paper: '#f1e6cf', rule: '#cfc4a8', ruleGap: 34, margin: '#c98a7a', grid: null, stains: true, vignette: true, crumpled: true,
    doodle: '#9b8f78', ground: '#5c5242', hatch: 'rgba(92,82,66,.18)',
    doodles: ['cloud', 'scribble', 'hill', 'bird'],
  },
};

export const CHAPTERS = [
  { n: 1, id: 'c1', name: 'Page 1: The Margin', page: 'ruled', faction: 'red', blurb: 'The Red Pen Rebels are scribbling over our margin.' },
  { n: 2, id: 'c2', name: 'Page 2: Graph Paper', page: 'graph', faction: 'graphite', blurb: 'A horde of pencil sketches pours out of the grid.' },
  { n: 3, id: 'c3', name: 'Page 3: The Sketchbook', page: 'sketch', faction: 'neon', blurb: 'The Highlighter Gang lights up the sketchbook.' },
  { n: 4, id: 'c4', name: 'Page 4: The Chalkboard', page: 'chalk', faction: 'chalk', blurb: 'Class is in session, and the Chalk Legion is teaching.' },
  { n: 5, id: 'c5', name: 'Page 5: The Last Page', page: 'last', faction: 'eraser', blurb: 'The Eraser Empire wants a blank page. So does the Hand.' },
];
