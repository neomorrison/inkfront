# Inkfront: architecture and build contract

Static site, plain ES modules, no build step, no runtime dependencies. GitHub Pages serves the repo root. `index.html` loads `src/main.js`.

```
node tools/serve.mjs            # http://localhost:5330
node tools/sim.mjs all --runs 3 # headless battles for every level with the player bot
node tools/smoke.mjs            # real browser, real clicks: title -> map -> 1-1 -> battle -> pause
node tools/smoke.mjs --mobile   # 844x390 touch
```

## Layers (hard rules)
| Layer | Folder | Rules |
|---|---|---|
| data | `src/data` | Pure data + tiny pure helpers. No imports from other layers. |
| sim | `src/sim` | Pure game logic. No DOM, no `window`, no `Math.random`, no `Date`. Use `b.rng`. Must run in Node (tools/sim.mjs). |
| render | `src/render` | Canvas drawing. Reads sim state, never mutates it. Visual randomness (`Math.random`) is fine here. |
| audio | `src/audio` | WebAudio. Reacts to sim events. |
| ui | `src/ui` | DOM screens. Talks to a battle only through `Session` commands. |
| game | `src/game` | Save, progression, session, battle config builders, hooks. |

Import the sim via `src/sim/index.js` (fills registries). Every feature registers into a registry from its own file; plugin index files (`src/sim/index.js`, `src/render/plugins.js`, `src/audio/plugins.js`, `src/ui/screens/index.js`, `src/game/plugins.js`) already import every planned file, so **you never need to edit an index**.

## Coordinates
World x along the battlefield (0..width). y = height above ground, negative is up (units stand at y=0). z = depth row -1..1 (visual only: screen offset `z * DEPTH` (14 px), draw order by z). Team 0 = player (left, dir +1), team 1 = enemy (right, dir -1). Forts at x = 150 and width - 150 (`FORT_X`). Stick figure local space: facing right, feet at y=0, ~67 px tall at scale 1, head radius 8.

## Sim
- `Battle(cfg)` (`src/sim/battle.js`): `units`, `projectiles`, `areas`, `teams[2]`, `wells`, `events`, `rng`, `time`, `result`.
- Commands (the only way in from outside): `requestUnit(team, id)`, `cancelUnit(team, id)`, `setStance(team, 'defend'|'hold'|'charge', x?)`, `castSpell(team, slot, x)`, `control[team] = { heroMove: -1|0|1, heroAbility: id|null }`.
- Helpers for features: `spawnUnit(team, id, { x, z, instant, level, hpMult, dmgMult, lifetime, summoned, spawnTime })`, `damage(target, amount, info)`, `heal(unit, amount, source)`, `kill(unit, info)`, `explode(x, y, radius, dmg, info)`, `meleeSplash(u, radius, dmg, frontal, { kb, stun })`, `shoot(u, target, projSpec, dmg, extraFields)`, `bolt(u, target, dmg, extra)`, `knockback(t, power, dir, up, src)`, `emit(type, data)`.
- damage `info`: `{ source, team, kind: 'melee'|'pierce'|'blast'|'magic'|'true', dir, kb, kbUp, fortMult, silent, crit, proj }`. Armor reduces melee/pierce fully, blast half, magic/true not at all.
- `Unit` (`src/sim/unit.js`): `id team def type level perks(Set) hp maxHp dmg range atkCd windup speed armor mass kb aggro scale radius height tags(Set) traits x y z vx vy facing dir state stateT attacking anim{t walk atk style moving flash cast cheer} buffs mod{dmg speed atkSpeed armor dmgTaken heal stun root} data{} alive targetable stealth flying canHitAir blocker taunt isHero isBoss summoned lifetime immuneKb immuneStun kills`.
  - Buffs: `u.addBuff({ id, t, dmg?, speed?, atkSpeed?, armor?, dmgTaken?, heal?, stun?, root?, dot?, hot?, team?, source? })`. Same id refreshes. `u.mod` is recomputed every tick.
  - States used by the renderer: `'spawn'` (sketch-in), `'idle'`, `'cheer'`, `'dead'`; plus `attacking`, `anim.moving`, `airborne`, `data.phase` (Scribes).
- Behavior helpers in `src/sim/common.js`: `gap`, `slotX`, `stanceAnchor`, `findEnemy`, `pickTarget`, `validTarget`, `moveToward`, `clampToBlockers`, `face`, `beginAttack`, `updateAttack`, `meleeHit`, `bonusVs(u, t, b)`, `countUnits`, `armyPower`. Reuse `meleeUpdate(u, b, dt, { onHit, targetOpts })` (`behaviors/melee.js`) and `rangedUpdate(u, b, dt, { onShoot, targetOpts })` (`behaviors/ranged.js`) for custom units.
- `team`: `index dir cfg faction ink income popCap scribeCap wellYield unitLevels roster queues stance flagX spells[{id level cd maxCd}] fort hero heroRespawnT mods perks pop scribes stats ai`.
- `team.mods` (`makeMods` in `src/sim/stats.js`): `hp dmg speed atkSpeed armor cost build kb rangedRange spellCd heroHp heroDmg vsLarge lifesteal byUnit{id:{hp dmg range atkSpeed speed armor cost build}} flags{}`.

### Registries (`src/sim/registry.js`)
`BEHAVIORS`, `TRAITS`, `SPELL_IMPL`, `MODE_IMPL`, `MODIFIER_IMPL`, `STAT_HOOKS`, `PERK_IMPL`, `HERO_ABILITY_IMPL`, `BATTLE_INIT_HOOKS`. Signatures are documented at the top of that file.

### Events (`battle.events`, drained once per frame)
Every event has `type` and `t`. Positional events carry `x` (and often `y`, `z`, `team`).
`start`, `spawn{unit id team x z instant}`, `queued{team id}`, `canceled`, `denied{team id reason}`, `stance{team stance x}`, `spell{team id x level}`, `hit{target amount kind x y z team source crit}`, `heal{target amount x y z team}`, `death{unit killer kind dir power x y z team id}`, `launch{unit x z}`, `land{unit x z}`, `shoot{unit|fort kind x y z team}`, `projHit{kind x y z team target fort}`, `projLand{kind x z vx vy team}`, `explode{x y radius team fx}`, `slam{unit x radius team z}`, `blocked{unit x y z team}`, `gather{unit x z team}`, `deposit{unit amount team x z}`, `fortHit{fort amount team x kind}`, `fortDestroyed{fort team x}`, `immune{x team}`, `heroAbility{unit id x z team}`, `bossArrive{unit id}`, `bossDefeated{unit id x}`, `banner{text team}`, `end{result winner}`.
Add new event types freely (document them in your report); consumers ignore unknown types.

## Render
`Renderer` (`src/render/renderer.js`) owns `Camera` (`camera.js`), `World` (`world.js`), `FX` (`fx.js`). Registries:
- `PROJ_DRAW[kind](ctx, cam, p, pal, t)`, `AREA_DRAW[kind] = { under?, over? }(ctx, cam, area, battle, t, renderer)`, `BODIES[name](ctx, u, o, renderer)`, `MOUNTS[name] = { draw(ctx, u, o, r), seat }`, `OVERLAY_DRAW[modifierId](ctx, cam, b, t, r)`, `EVENT_FX[type](renderer, event, battle)` (one handler per type: wrap the previous one if you extend a type).
- `world.js`: `FORT_DRAW[style](ctx, cam, fort, pal, t, world)`, `DOODLE_DRAW[type](ctx, x, y, s, col, seed, frame)`.
- `stickman.js`: `computePose(u, t)`, `drawStick(ctx, joints, o)`, `ATTACKS[style]` keyframes (add new styles from your own file), `ANIMS[look.anim]` custom poses (ninja, dustborn), `EXTRAS_DRAW[look.extras[i]] = { back?, front? }` (cape, glasses), `fk`, `plant`, `walkPose`, `keyframes`, `BODY`.
- `weapons.js`: `WEAPONS[look.weapon] = { back?, mid?, front? }(ctx, J, o)`; helpers `dirOf`, `rot`, `line`.
- `hats.js`: `HAT_DRAW[id](ctx, hx, hy, tilt, o)` in local figure space.
- `icons.js`: `unitIcon(id, opts)`, `hatIcon(id)`, `icon(name)` with `ICON_DRAW[name](ctx, size)`. Expected names: `spell_<id>`, `ability_<id>`, `upgrade_<fortUpgradeId>`, `ink`, `gold`, `star`, `star_empty`, `pop`, plus menu icons.
- Palettes: `renderer.pal[team] = { ink, dark, light, back, paper, under }`.
- FX API: `fx.burst(x, y, z, n, col, speed, kind, extra)`, `fx.puff`, `fx.ring`, `fx.text(x, y, str, col, size, o)`, `fx.splat(x, z, col, size)`, `fx.stain(x, z, col, rx, ry)`, `fx.ragdoll(worldJoints, o)`, `renderer.shake(a)`.

## Cross-package contracts
- **Boss**: the AI sets `b.boss` (the boss unit) when it spawns it; the HUD shows a boss bar from `b.boss` (name `UNITS[b.boss.type].name`). Bosses warn with `telegraph{x, radius|width, delay, kind, team}` events and draw their own warning areas.
- **Endless** (C): `b.endless = { wave, state: 'fight'|'break'|'draft', enemiesLeft, offer: [perkId,...]|null, choose(id) }`; events `waveStart{wave}`, `waveClear{wave}`, `draftOffer{offer}`, `pageChange{page}`. The HUD (I) shows the draft modal on `draftOffer`, pauses the loop while open, then calls `b.endless.choose(id)`. The renderer (F) handles `pageChange` by re-running world setup and palettes.
- **Spells** (D): spell impacts emit `spellFx{id, phase, x, z, team}` so audio and FX can react; targeting shape comes from `SPELLS[id].target/radius/width` and the HUD draws the reticle.
- **UI sounds** (G implements, H/I call `Audio.play`): `click tab buy error stamp star levelup unlock crate page toggle whoosh`.
- **Night** (C flags, F draws): `b.flags.night = true`; lights around player units, the player fort and the hero; neon units glow.

## Audio
`Audio.play(name, { vol, pitch, pan, limit })`; recipes in `SFX[name] = (A, at, opts)`; helpers `A.tone`, `A.noise`, `A.out`. Sim events map to sounds in `src/audio/events.js` (`handleBattleAudio(e, session)`). Names already called by foundation code: `click queue denied stance_defend stance_hold stance_charge hit shoot spawn death boom coin victory defeat`.

## Game layer
- `Save.data` profile shape: see `defaultProfile()` in `src/game/save.js`. Add fields there (the migration fills missing keys).
- `progression.js`: `applyBattleResult`, `addGold`, `addHeroXp`, `unlockUnit/Spell/Hat`, `buyUnitUpgrade/FortUpgrade/SpellUpgrade`, `isLevelUnlocked`, `totalStars`, `REWARD_HOOKS`.
- `teamcfg.js`: `playerTeamConfig(profile, opts)`, `enemyTeamConfig(level, { hard })`. `hero_skills.js`: `applyHeroSkills(cfg, profile)`.
- `modes.js`: `buildBattleConfig(opts, profile)`, `MODE_BUILDERS[kind]`. Battle opts: `{ kind: 'campaign', levelId, hard }`, `{ kind: 'endless' }`, `{ kind: 'daily' }`, `{ kind: 'skirmish', ... }`, `{ kind: 'demo', seed }`.
- `session.js`: `Session` commands `spawn(id) cancel(id) stance(s, x?) beginSpell(slot) cancelTargeting() clickWorld(screenX) heroAbility(id) togglePause(force?) setSpeed(v) toggleSpeed() surrender() listen(fn)`; fields `battle cam r roster targeting speed paused ended summary touchHero heroCamT dragging`. `SESSION_HOOKS: fn(session)` run on start.
- `app.js`: `App.startBattle(opts)`, `App.goTitle()`, `App.goMap()`, `App.go(screenName, params)`, `App.applySettings()`, `App.session`, `App.renderer`, `App.loop`.
- App bus (`src/core/events.js` `bus`): `appReady route screen modal modalClosed battleStart battleEnd sessionStart pause targeting gold heroLevel upgraded battleApplied audioUnlocked`.

## UI
`UI.register(name, { mount(el, params), unmount?(el), update?(dt, el) })`, `UI.show(name, params)`, `UI.modal(name, params)`, `UI.closeModal(name)`, `UI.toast(html, kind)`. DOM helpers in `src/ui/dom.js`: `h`, `button(label, onClick, 'big blue')`, `setText`, `setStyle`, `toggleClass`, `clear`. Shared components and tokens in `css/style.css` (`.btn` + color/size variants, `.paper`, `.tape`, `.note`, `.chip`, `.ucard`, `.badge`, `.bar`, `.outline`). Screen CSS: `css/hud.css` (HUD package), `css/screens.css` (meta package). Battle HUD is `passthrough` so the canvas gets pointer input; interactive children need class `interactive` (or be buttons).

## Packages and file ownership
Only edit files you own. If you truly must touch another file, keep the change minimal, and list it in your report under "touched outside my files".

| Pkg | Scope | Owns |
|---|---|---|
| A Units | player unit behaviors (incl. the generic melee/ranged/worker ones everyone reuses: keep `meleeUpdate`/`rangedUpdate` signatures stable), traits, unit perks, their visuals | `src/sim/behaviors/{melee,ranged,worker,cavalry,bomber,support,caster,siege,assassin}.js`, `src/sim/traits.js`, `src/sim/perks_units.js`, `src/render/weapons_units.js`, `src/render/bodies_units.js`, `tools/tests/units.mjs` |
| B Factions | enemy traits, 5 bosses, enemy visuals | `src/sim/traits_enemy.js`, `src/sim/behaviors/bosses.js`, `src/render/weapons_enemy.js`, `src/render/bosses_draw.js`, `tools/tests/bosses.mjs` |
| C AI/levels/modes | AI commander, 30 levels tuning, modifiers, endless, daily, skirmish, endless perks, player bot | `src/sim/ai.js`, `src/sim/modes.js`, `src/sim/modifiers.js`, `src/sim/perks.js`, `src/data/levels.js`, `src/data/perks.js`, `src/game/modes.js`, `src/game/endless.js`, `src/game/daily.js`, `src/render/modes_draw.js`, `tools/sim.mjs`, `tools/tests/levels.mjs` |
| D Spells | 9 spells (sim + visuals + icons), structure behavior | `src/sim/spells/*.js`, `src/sim/behaviors/structure.js`, `src/data/spells.js`, `src/render/spellfx.js`, `tools/tests/spells.mjs` |
| E Hero | Captain abilities, fury, skills, cape, all hats and unit headgear | `src/sim/behaviors/hero.js`, `src/game/hero_skills.js`, `src/data/hero.js`, `src/data/hats.js`, `src/render/hats.js`, `src/render/hats_all.js`, `src/render/hero_fx.js`, `tools/tests/hero.mjs` |
| F World/FX | pages, doodles, ground, forts, ragdolls, particles, weather/night overlays, event FX, stickman polish, perf | `src/render/world.js`, `src/render/forts.js`, `src/render/doodles.js`, `src/render/overlays.js`, `src/render/fxevents.js`, `src/render/fx.js`, `src/render/ink.js`, `src/render/stickman.js`, `src/render/camera.js`, `src/render/renderer.js`, `src/data/pages.js` |
| G Audio | SFX library, music, event mapping | `src/audio/*.js`, `assets/music/` |
| H Meta UI | title, map, loadout, results, armory, hero screen, achievements, settings, daily card, progression extensions, achievement tracking, menu icons | `src/ui/screens/{title,map,loadout,results,armory,hero,achievements,settings,daily}.js`, `css/screens.css`, `src/game/progression.js`, `src/game/achievements.js`, `src/game/save.js`, `src/data/achievements.js`, `src/render/icons_more.js`, `src/render/icons.js`, `tools/tests/meta.mjs` |
| I HUD | battle HUD, pause, tutorial, touch controls, camera follow modes, endless draft modal | `src/ui/screens/{hud,pause,endless}.js`, `css/hud.css`, `src/game/tutorial.js`, `src/game/session.js`, `tools/tests/hud.mjs` |

Shared (orchestrator only): `index.html`, `css/style.css`, `src/main.js`, `src/app.js`, `src/core/*`, `src/sim/{battle,unit,common,stats,projectile,fort,registry,index}.js`, `src/data/{units,factions,upgrades}.js`, `src/ui/{ui,dom}.js`, plugin index files, `docs/`.
Unit stat tuning requests for `src/data/units.js`: put them in your report; the orchestrator applies them.

## Code style
Match the foundation: 2-space indent, single quotes, semicolons, `const`/`let`, small functions, sparse comments that explain why. No new dependencies, no build tools, no TypeScript. Keep files under ~900 lines (split into more owned files if needed, and import them from a file you own).

## Testing (every package)
1. `node tools/sim.mjs demo --runs 3` and `node tools/sim.mjs all --runs 1` must not throw.
2. Your own headless test in `tools/tests/<pkg>.mjs` (node script, exits non-zero on failure) covering your mechanics in the sim.
3. `node tools/smoke.mjs` and `node tools/smoke.mjs --mobile` must pass (no console errors). Look at the screenshots in `tools/out/` with your own eyes for anything you changed.
4. For visual work, write a small Playwright script (copy the launch code from `tools/smoke.mjs`) that stages your feature (via `window.App` and dynamic imports is fine for staging) and screenshots it; check it visually.

## Git
You work in your own git worktree on your own branch. Commit when you finish (and at checkpoints). Never use `git stash` (it is shared across worktrees). Never push. Never rewrite history.
