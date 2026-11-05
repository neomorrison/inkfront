// Cosmetic hats for the Captain (and, with the Army Hats toggle, every unit you draw).
// Drawn by HAT_DRAW[id] in src/render/hats.js. `from` explains how to unlock it.

export const HATS = [
  { id: 'none', name: 'No Hat', from: 'Always yours.' },
  { id: 'captain', name: 'Captain\'s Tricorn', from: 'Always yours.' },
  { id: 'party', name: 'Party Hat', from: 'Clear 3-5.' },
  { id: 'red_plume', name: 'Red Plume', from: 'Defeat General Redline.' },
  { id: 'pencil_crown', name: 'Pencil Crown', from: 'Defeat Old Smudge.' },
  { id: 'neon_horns', name: 'Neon Horns', from: 'Defeat the Neon Wyrm.' },
  { id: 'mortarboard', name: 'Mortarboard', from: 'Clear 4-5.' },
  { id: 'professor_glasses', name: 'Professor Specs', from: 'Defeat the Professor.' },
  { id: 'eraser_cap', name: 'Eraser Cap', from: 'Clear 5-1.' },
  { id: 'halo', name: 'Halo', from: 'Clear 5-3.' },
  { id: 'ninja_mask', name: 'Ninja Mask', from: 'Clear 5-4.' },
  { id: 'golden_quill', name: 'Golden Quill', from: 'Clear 5-5.' },
  { id: 'crown', name: 'Crown', from: 'Defeat the Hand.' },
  { id: 'top_hat', name: 'Top Hat', from: 'Achievement: Ink Tycoon.' },
  { id: 'viking', name: 'Viking Helm', from: 'Achievement: Warmonger.' },
  { id: 'chef', name: 'Chef Hat', from: 'Achievement: Coffee Break.' },
  { id: 'cowboy', name: 'Cowboy Hat', from: 'Achievement: Stampede.' },
  { id: 'pirate', name: 'Pirate Hat', from: 'Achievement: Plunderer.' },
  { id: 'propeller', name: 'Propeller Cap', from: 'Achievement: Frequent Flyer.' },
  { id: 'traffic_cone', name: 'Traffic Cone', from: 'Achievement: Oops.' },
  { id: 'paper_boat', name: 'Paper Boat', from: 'Supply crate.' },
  { id: 'beanie', name: 'Beanie', from: 'Supply crate.' },
  { id: 'wizard', name: 'Wizard Hat', from: 'Supply crate.' },
  { id: 'bucket', name: 'Bucket', from: 'Supply crate.' },
  { id: 'santa', name: 'Winter Cap', from: 'Supply crate.' },
  { id: 'fez', name: 'Fez', from: 'Supply crate.' },
  { id: 'headphones', name: 'Headphones', from: 'Daily challenge streak of 3.' },
  { id: 'samurai', name: 'Kabuto', from: 'Endless: reach wave 20.' },
  { id: 'astronaut', name: 'Space Helmet', from: 'Endless: reach wave 30.' },
];

export const HAT_BY_ID = Object.fromEntries(HATS.map((h) => [h.id, h]));
export const CRATE_HATS = ['paper_boat', 'beanie', 'wizard', 'bucket', 'santa', 'fez'];
