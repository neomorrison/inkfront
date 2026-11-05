# Inkfront

**A stick figure war fought in the margins of a notebook.**

Draw an army in blue ink, lead it with your Captain, throw school supplies at the enemy, and conquer five notebook pages. Free, in your browser, on desktop and phone.

**Play it here: https://neomorrison.github.io/inkfront/**

## What's in it
- **30 campaign levels** across five pages (ruled paper, graph paper, a sketchbook, a chalkboard and the last page), each with its own enemy army and a boss at the end.
- **13 units** to draw: Scribes, Brawlers, Slingers, Shieldbearers, Spearmen, Archers, Bombers, Medics, Riders, Doodlers, Catapults, the Colossus and the Ninja.
- **The Captain**, a hero you steer yourself, with Rally Cry, Ink Slam and Inkstorm, a 12-skill tree and 29 hats.
- **Nine Supplies**: Pencil Rain, Coffee Spill, Ruler Smash, Paper Planes, Sticky Wall, Stapler, Highlighter, Doodle Drop and The Eraser.
- **Progression**: stars, gold, unit levels with perks and visible gear, fort upgrades, achievements, supply crates and Red Ink hard mode.
- **Endless Notebook**: survive wave after wave and draft a new perk between waves.
- **Daily Challenge**: a new seeded battle every day.

## Controls
| | Keyboard and mouse | Touch |
|---|---|---|
| Draw units | 1-9 or click a card (right-click a card to refund) | Tap a card |
| Army orders | W charge, S defend, F hold here, right-click to plant the flag | Stance buttons, long-press the battlefield to plant the flag |
| Captain | A / D to walk, Q, E, R abilities | Arrow buttons and ability buttons |
| Supplies | Z, X, C cast at the mouse, or click then click the battlefield | Tap the spell, then tap the battlefield |
| Camera | Drag, mouse wheel, click the minimap, Space follows the Captain | Drag, tap the minimap |
| Pause, speed | Esc, T | Buttons at the top right |

## Run it locally
No build step and no dependencies to play.

```bash
node tools/serve.mjs
```

Then open http://localhost:5330.

Developer tools (optional, needs `npm install` for the browser tests):

```bash
node tools/sim.mjs all --runs 3     # headless battles for every level with a bot player
node tools/smoke.mjs                # real-browser smoke test with real clicks
```

## How it's built
Plain JavaScript modules and a 2D canvas. The battle simulation is pure and deterministic, so it runs in the browser and headless in Node for balance testing. Everything you see is drawn in code with hand-drawn line wobble; sound effects are synthesized with WebAudio. See `docs/DESIGN.md` and `docs/ARCHITECTURE.md`.
