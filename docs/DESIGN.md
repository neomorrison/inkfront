# Inkfront: design

A stick figure war fought in the margins of a notebook. You draw an army in blue ink, command a hero, throw school supplies at the enemy, and conquer five notebook pages. Free, in the browser, on GitHub Pages.

## Pillars
1. **Fun in the first 30 seconds.** Tap a card, a stick figure sketches itself onto the page and runs into battle. Hits land with ink splats, ragdolls fly, numbers pop. No reading required to have fun.
2. **Low friction.** Battles are 2 to 5 minutes. One goal at a time in the early game. Speed toggle (1x/2x). Retry is one tap. Never auto-move the player's hero.
3. **Juicy feedback everywhere.** Hit flash and squash, knockback, hit-stop on big hits, screen shake, ink splats that stay on the page, X_X ragdolls, sketch-in spawns, line boil (lines re-jitter like a flipbook), stamped results.
4. **Always something to work toward.** Stars, gold, unit levels with visible gear, perks at levels 3/6/9, fort upgrades, spells, a hero with levels and a skill tree, 29 hats, 31 achievements, Red Ink hard mode, Endless with a roguelite draft, and a Daily Challenge.
5. **Original identity.** Notebook pages, ink armies, school-supply spells, the Hand as final boss. Never copy another game's names, units or look.

## Core battle
Side view lane battle. Your fort on the left, the enemy fort on the right. Destroy theirs (or win the level's special condition).

- **Ink** is the battle currency. Passive trickle plus **Scribes** who walk to ink wells, fill bottles, and carry ink home (+20 per trip). Two wells per side, one rich contested well in the middle. Scribes run home when enemy fighters get close unless the army is charging.
- **Unit cards** (keys 1-9, 0, -) cost ink and take build time; tapping several times queues them (right-click a card refunds one). Army size (pop) caps how many are alive.
- **Stances**: DEFEND (S) holds a line in front of your fort, HOLD (F, or right-click / long-press the battlefield) holds at a flag you plant, CHARGE (W) pushes to the enemy fort. Units sort into formation rows: tanks front, melee, ranged, support, siege.
- **The Captain** (hero): A/D or arrows (touch: on-screen arrows) to walk him; he fights whatever he reaches. Q Rally Cry (hero level 2), E Ink Slam (level 4), R Inkstorm when the Fury meter is full (level 7). After 5 s without input he rejoins the army AI. Respawns at the fort.
- **Supplies (spells)**: up to 3 per battle, keys Z/X/C or tap then tap the battlefield. Free, on cooldown, start half charged.
- **Camera**: drag the battlefield, mouse wheel, click or drag the minimap; follows the Captain while you steer him, and eases toward the action when left alone (Follow/Free toggle, V).
- **The enemy commander** plays by the same rules (Scribes, ink, stances) and attacks in waves on a rhythm set by the level, raids your Scribes with fast units, regroups after a lost push, and goes all-in after about four minutes so stalemates end. Bosses advance on your army and fort.
- **Ink cap**: banked ink stops at 3,000, so ink is always meant to be spent.

## Units (player roster)
Unlock order through the campaign: Scribe and Brawler at start, then Slinger, Shieldbearer, Spearman, Archer, Bomber, Medic, Rider, Doodler, Catapult, Colossus, Ninja. Stats and perks live in `src/data/units.js`.

| Unit | Role | Hook |
|---|---|---|
| Scribe | worker | Ink economy; vulnerable, raidable |
| Brawler | melee | Cheap, fast to draw |
| Slinger | ranged | Cheap low-arc stones |
| Shieldbearer | tank | Blocks most frontal arrows, taunts |
| Spearman | reach melee | Pokes over the front line, x2.2 vs cavalry, x1.8 vs large |
| Archer | ranged | High arcs, long range |
| Rider | cavalry | Charge: first hit after a run-up deals 2.5x and launches |
| Bomber | suicide | Runs at crowds, explodes (also on death; 50% friendly fire) |
| Medic | support | Heals the most hurt ally nearby |
| Doodler | caster | Chain scribble lightning; doodles critters |
| Catapult | siege | 780 range boulders, 3x vs forts, dead zone up close |
| Colossus | heavy | Frontal club splash, huge knockback |
| Ninja | assassin | Invisible until he strikes, hunts ranged/support |

**Squad points** (pick your crew, Clash style): every unit you bring costs squad points (Brawler/Slinger 1; Shieldbearer, Spearman, Archer, Bomber, Medic 2; Rider, Doodler, Ninja 3; Catapult 4; Colossus 5; Scribe free). Capacity starts at 7, +3 for each chapter boss beaten (1-6 to 4-6) and +1 per War Table level (Armory, 3 levels), so 22 at most against 30 for the full roster: you always choose. Up to 10 combat units per squad. Old saves are trimmed to fit (later picks drop first).

Upgrades: levels 1-10 with gold (+9% hp, +8% damage per level). Gear shows on the unit: helmet at 4, plume at 7, gold trim at 10. Perks at 3/6/9 (see data).

## Enemies
- **Red Pen Rebels** (Page 1, ruled paper): the same roster in red ink. Boss: **General Redline** (lance dash every ~10 s, war cry buff, summons brawlers at half health).
- **Graphite Horde** (Page 2, graph paper): Smudgeling swarms, Sharpener berserkers (stronger as they lose hp), Lead Throwers, Graphite Golems (shatter into 3 Smudgelings). Boss: **Old Smudge** (ground slam shockwave that rolls 400 px along the ground, belches Smudgelings, leaves slowing smears).
- **Highlighter Gang** (Page 3, sketchbook): fast Glowrunners, Neon Archers (burning arrows), Marker Knights (shielded tanks), Glow Shamans (speed/damage aura + small heals). Boss: **the Neon Wyrm**, a doodled dragon that flies out of melee reach (only projectiles, spells and the tower hit it), breathes a burning line of highlighter, then lands for ~6 s to stomp (melee can hit it then).
- **Chalk Legion** (Page 4, chalkboard): Dustborn (reassemble once at half hp after 2.5 s), Chalk Throwers (slow on hit), Board Brutes, Dust Mages (splash). Boss: **the Professor**: "Pop Quiz!" (question marks appear over your units in a radius for 1 s, then they freeze 2 s), chalk equation rain, Detention walls at half health.
- **Eraser Empire** (Page 5, the last page): Crumb swarms, Eraser Knights (hits cleanse buffs and block healing 2 s), Shaving Slingers, Whiteout Priests (heal, revive a fallen ally every 20 s). Final boss: **the Hand** that draws the page. It hovers above the battlefield; its shadow telegraphs an Erase sweep (massive damage in a band; retreat your army!), Pencil Stab (big telegraphed AoE), Redraw (sketches Eraser Knights). Its fingertips touch the ground when it attacks: that is when melee can hit it; projectiles and spells can always hit it at half damage. Beating the Hand wins the campaign.

## Campaign
30 levels (5 chapters x 6), data in `src/data/levels.js`. Level 6 of each chapter is a boss. Modifiers add variety: Night Shift, Rainy Page, Headwind/Tailwind, Ambush, Fortified, Ink Rush, Inkflation, Swarm, Coffee Stains. Some levels are special: 4-3 Detention is survive 4 minutes; 5-6 is beat the Hand.

Stars: 1 = win, 2 = fort above 50%, 3 = fort above 80%. First clear gives full gold, unlocks (unit/spell/hat) and XP; replays pay 45%. Defeat still pays a little gold so progress never stalls.

Tutorial (one goal at a time, arrows that point at real UI):
- 1-1 basics: draw a Scribe, draw Brawlers, press CHARGE, push the enemy fort. AI stays passive until the player has 3 Brawlers or 40 s pass.
- 1-2 spells: cast Pencil Rain. 1-3 stance: DEFEND vs an ambush, then CHARGE. 1-4 hero: walk the Captain with A/D.

Beating the Hand plays a short scribbled ending ("The End") before the results.

**Red Ink mode** (hard) unlocks after the Hand: every level again with stronger enemies that scale with your army's upgrade level, separate stars, 1.8x gold.

## Progression and economy
- **Gold** from battles, achievements, crates, endless and daily. Spent in the Armory: unit levels, fort upgrades (walls, tower, ink press, reserves, scribe quarters, barracks, deeper wells), spell levels 1-5.
- **Captain XP** from battles: levels 1-30, one skill point each, 12 skills in 3 branches (Blade, Banner, Quill).
- **Hats**: 29 cosmetic hats from bosses, levels, achievements, crates, streaks. Equip on the Captain; optional "Army Hats" toggle puts your chosen hat on every unit you draw.
- **Supply crates**: one every 10 campaign stars and after each boss: random crate hat or gold.
- **Achievements**: 31 with gold and hat rewards.
- A red "!" badge marks anything new or affordable (menus, armory cards).

## Endless: "The Endless Notebook"
Waves from mixed factions with rising budgets; mini-boss every 5 waves, a chapter boss every 10. Between waves the game pauses for a 1-of-3 perk draft (`src/data/perks.js`). Your army stays; the fort heals 15%. The page changes every 10 waves. Rewards scale with the wave reached. Best wave is recorded.

## Daily Challenge
Seeded by the date (same for everyone): a faction, 2 modifiers, 6 allowed units at a fixed level, fixed spells. One reward per day (500 gold) and a streak counter.

## Screens
Title (live demo battle behind the logo), Campaign map (notebook map with chapters and stars), Loadout (pick up to 8 units and 3 spells, see enemy intel and modifiers), Battle HUD, Pause, Results (stamp, stars, gold count-up, XP bar, unlock reveal), Armory, Captain (skills + hat wardrobe), Achievements + stats, Settings (music, sound, shake, damage numbers, quality, army hats, export/import/reset save), Endless and Daily cards.

**UI look**: notebook paper panels with tape, sticky-note buttons with thick marker outlines (`.btn`), bold Permanent Marker headings, Patrick Hand body text, index-card unit cards, hand-drawn canvas icons, red "!" badges. Saturated, chunky, polished; never thin flat rectangles. Everything readable at 844x390 (phone landscape) and 1920x1080.

**Copy**: plain, short, friendly. No em dashes in any player-facing text. Never show the owner's name or company anywhere in the game.

## Audio
Procedural WebAudio SFX for everything (pencil scribble spawns, sword clanks, bow twangs, thuds, ink splats, explosions, coin clinks, paper flips, stamp thumps) plus music: a jaunty march on menus, a driving battle loop that layers up when armies clash, boss tracks. Music files (if present in `assets/music/`) override the procedural tracks.

## Quality bar (before anything is called done)
- Player's-eye playthrough from a fresh save through real buttons (no debug shortcuts), every screen captured, at 1280x720 and 844x390 touch.
- Overlap probe: no clipped or overlapping UI, no cooldown overlays spilling outside buttons, no tutorial arrow pointing at nothing.
- No console errors. 60 fps with 150 units on a laptop.
