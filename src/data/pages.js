// Battlefield looks, one per chapter. The renderer (src/render/world.js) reads these.
// paletteOverride keeps every army readable on dark paper.

export const PAGES = {
  ruled: {
    id: 'ruled', name: 'Ruled Paper',
    paper: '#fffdf4', rule: '#bcd4ee', ruleGap: 34, margin: '#ef8f8f', grid: null,
    doodle: '#8d96ad', ground: '#4f5878', hatch: 'rgba(79,88,120,.16)', sky: null,
    doodles: ['cloud', 'sun', 'hill', 'tree', 'bird', 'kite', 'house', 'flower', 'heart', 'spiral', 'plane'],
    look: 'ruled', fiber: 'rgba(120,110,90,.10)', edge: 'rgba(150,130,90,.16)', wash: 'rgba(79,88,120,.07)', flora: ['tuft', 'tuft', 'pebble', 'flower'],
    horizon: { col: 'rgba(79,88,120,.30)', fill: 'rgba(188,212,238,.22)', amp: 46, par: 0.45 },
  },
  graph: {
    id: 'graph', name: 'Graph Paper',
    paper: '#f7fbf6', rule: null, ruleGap: 0, margin: null, grid: { gap: 26, color: '#cfe4d6', major: '#a9cdb5', every: 5 },
    doodle: '#7f9a8a', ground: '#4d5e55', hatch: 'rgba(77,94,85,.16)',
    doodles: ['cloud', 'mountain', 'tree', 'bird', 'axis', 'cube', 'triangle', 'bars', 'ruler', 'parabola'],
    look: 'graph', fiber: 'rgba(90,120,100,.07)', edge: 'rgba(90,130,100,.14)', wash: 'rgba(77,94,85,.07)', flora: ['tuft', 'pebble', 'pebble', 'star'],
    horizon: { col: 'rgba(77,94,85,.32)', fill: 'rgba(169,205,181,.20)', amp: 70, par: 0.4, jagged: true },
  },
  sketch: {
    id: 'sketch', name: 'Sketchbook',
    paper: '#fbf5e8', rule: null, ruleGap: 0, margin: null, grid: null, tooth: true,
    doodle: '#a59c8a', ground: '#6a5f4c', hatch: 'rgba(106,95,76,.16)',
    doodles: ['cloud', 'star', 'hill', 'tree', 'moon', 'butterfly', 'eye', 'vase', 'face', 'cube', 'bird'],
    look: 'sketch', fiber: 'rgba(120,100,70,.12)', edge: 'rgba(160,130,80,.20)', wash: 'rgba(106,95,76,.08)', flora: ['tuft', 'tuft', 'flower', 'pebble'],
    horizon: { col: 'rgba(106,95,76,.34)', fill: 'rgba(214,196,150,.20)', amp: 38, par: 0.5, shade: true },
  },
  chalk: {
    id: 'chalk', name: 'Chalkboard',
    paper: '#2e4a3d', rule: null, ruleGap: 0, margin: null, grid: null, chalky: true, frame: '#7a5634',
    doodle: 'rgba(240,240,230,.35)', ground: 'rgba(240,240,230,.75)', hatch: 'rgba(240,240,230,.10)',
    doodles: ['equation', 'formula', 'atom', 'triangle', 'apple', 'flask', 'globe', 'star', 'axis', 'pi', 'cloud'],
    look: 'chalk', fiber: 'rgba(255,255,255,.04)', edge: 'rgba(0,0,0,.28)', wash: 'rgba(0,0,0,.16)', flora: ['chalk', 'chalk', 'pebble', 'star'],
    horizon: { col: 'rgba(240,240,230,.22)', fill: 'rgba(255,255,255,.04)', amp: 30, par: 0.5, dashed: true },
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
    doodles: ['cloud', 'scribble', 'hill', 'bird', 'ghost', 'crossed', 'ring', 'unfinished', 'smudge'],
    look: 'last', fiber: 'rgba(110,80,40,.14)', edge: 'rgba(110,80,40,.30)', wash: 'rgba(92,82,66,.12)', flora: ['weed', 'weed', 'pebble', 'crack'],
    horizon: { col: 'rgba(92,82,66,.28)', fill: 'rgba(150,120,80,.10)', amp: 40, par: 0.45, dashed: true },
  },
};

export const CHAPTERS = [
  { n: 1, id: 'c1', name: 'Page 1: The Margin', page: 'ruled', faction: 'red', blurb: 'The Red Pen Rebels are scribbling over our margin.' },
  { n: 2, id: 'c2', name: 'Page 2: Graph Paper', page: 'graph', faction: 'graphite', blurb: 'A horde of pencil sketches pours out of the grid.' },
  { n: 3, id: 'c3', name: 'Page 3: The Sketchbook', page: 'sketch', faction: 'neon', blurb: 'The Highlighter Gang lights up the sketchbook.' },
  { n: 4, id: 'c4', name: 'Page 4: The Chalkboard', page: 'chalk', faction: 'chalk', blurb: 'Class is in session, and the Chalk Legion is teaching.' },
  { n: 5, id: 'c5', name: 'Page 5: The Last Page', page: 'last', faction: 'eraser', blurb: 'The Eraser Empire wants a blank page. So does the Hand.' },
];
