// Every unit type in the game. Pure data: behaviors live in src/sim/behaviors, visuals in
// src/render. Stats are level-1 values; src/sim/stats.js applies upgrade level and modifiers.
//
// Field guide
//   faction   'ink' = player roster (the Red Pen Rebels reuse these ids in red). Others are enemy-only.
//   behavior  key into BEHAVIORS (src/sim/registry.js)
//   cost/pop/build  ink cost, army-size cost, build seconds
//   hp dmg range atkCd windup speed   range is edge-to-edge reach in world px; speed px/s
//   armor     0..0.85 fraction of melee/pierce damage ignored (blast takes half, magic/true ignore it)
//   mass      knockback resistance; kb = knockback this unit deals
//   rank      formation row: 0 front (tanks), 1 melee, 2 ranged, 3 support, 4 siege
//   tags      for bonuses and targeting: worker melee ranged tank cavalry support caster siege large small swarm assassin summon boss flying structure
//   bonus     { tag: damage multiplier vs that tag }
//   traits    ids in TRAITS (src/sim/traits.js)
//   proj      ranged projectile spec: kind speed arc gravity spread aoe dmgKind
//   look      scale weapon style(attack anim) hat mount body bulk eyes extras
//   upgrade   { base } gold for level 2 (curve in data/upgrades.js)
//   perks     unlocked at unit level 3 / 6 / 9; effects in src/sim/perks_units.js

export const UNITS = {
  // ------------------------------------------------------------ Blue Ink roster (player)
  scribe: {
    id: 'scribe', name: 'Scribe', faction: 'ink', role: 'worker', behavior: 'worker',
    desc: 'Fills ink bottles at the ink wells and carries them home. More Scribes, more ink.',
    cost: 50, pop: 1, build: 3, hp: 70, dmg: 5, range: 22, atkCd: 1.2, windup: 0.3, speed: 84,
    armor: 0, mass: 1, kb: 10, rank: 3, carry: 20, gatherTime: 2.0,
    tags: ['worker'], look: { weapon: 'bottle', style: 'punch', hat: 'cap' },
    upgrade: { base: 80 },
    perks: {
      3: { id: 'big_bottle', name: 'Big Bottle', desc: '+50% ink per trip.' },
      6: { id: 'quick_feet', name: 'Quick Feet', desc: '+25% move speed.' },
      9: { id: 'ink_tap', name: 'Ink Tap', desc: 'Each living Scribe adds +0.3 ink/s.' },
    },
  },
  brawler: {
    id: 'brawler', name: 'Brawler', faction: 'ink', role: 'melee', behavior: 'melee',
    desc: 'Cheap, quick to draw, and happy to get stuck in. The backbone of any army.',
    cost: 45, pop: 1, build: 2.2, hp: 130, dmg: 14, range: 30, atkCd: 1.0, windup: 0.32, speed: 80,
    armor: 0, mass: 1, kb: 30, rank: 1,
    tags: ['melee'], look: { weapon: 'sword', style: 'slash' },
    upgrade: { base: 90 },
    perks: {
      3: { id: 'tough', name: 'Tough', desc: '+20% health.' },
      6: { id: 'knuckle', name: 'Heavy Hands', desc: '+15% damage and bigger knockback.' },
      9: { id: 'battle_rage', name: 'Battle Rage', desc: 'Heals 20 on a kill and attacks 20% faster.' },
    },
  },
  slinger: {
    id: 'slinger', name: 'Slinger', faction: 'ink', role: 'ranged', behavior: 'ranged',
    desc: 'Lobs stones from behind the front line. Cheap ranged support.',
    cost: 55, pop: 1, build: 2.6, hp: 80, dmg: 11, range: 300, atkCd: 1.5, windup: 0.45, speed: 76,
    armor: 0, mass: 1, kb: 8, rank: 2,
    tags: ['ranged'], look: { weapon: 'sling', style: 'throw' },
    proj: { kind: 'stone', speed: 520, arc: 0.45, gravity: 900, spread: 16, dmgKind: 'pierce' },
    upgrade: { base: 90 },
    perks: {
      3: { id: 'heavy_stones', name: 'Heavy Stones', desc: '+20% damage.' },
      6: { id: 'long_sling', name: 'Long Sling', desc: '+60 range.' },
      9: { id: 'ricochet', name: 'Ricochet', desc: 'Stones bounce to a second enemy for half damage.' },
    },
  },
  shieldbearer: {
    id: 'shieldbearer', name: 'Shieldbearer', faction: 'ink', role: 'tank', behavior: 'melee',
    desc: 'A walking wall. Blocks most arrows from the front and draws enemy attention.',
    cost: 110, pop: 2, build: 4, hp: 460, dmg: 10, range: 30, atkCd: 1.3, windup: 0.35, speed: 60,
    armor: 0.25, mass: 2.5, kb: 40, rank: 0, block: 0.8,
    tags: ['melee', 'tank'], traits: ['shieldBlock', 'taunt'], look: { weapon: 'sword_shield', style: 'bash', hat: 'helmet' },
    upgrade: { base: 120 },
    perks: {
      3: { id: 'tower_shield', name: 'Tower Shield', desc: 'Blocks 90% of frontal arrows.' },
      6: { id: 'shield_bash', name: 'Shield Bash', desc: 'Every third hit stuns for 0.6s.' },
      9: { id: 'bulwark', name: 'Bulwark', desc: 'Allies just behind take 25% less arrow damage.' },
    },
  },
  spearman: {
    id: 'spearman', name: 'Spearman', faction: 'ink', role: 'melee', behavior: 'melee',
    desc: 'Long reach lets him poke over your front line. Wrecks riders and big things.',
    cost: 85, pop: 1, build: 3, hp: 170, dmg: 20, range: 62, atkCd: 1.25, windup: 0.38, speed: 76,
    armor: 0.05, mass: 1.2, kb: 30, rank: 1, bonus: { cavalry: 2.2, large: 1.8 },
    tags: ['melee'], look: { weapon: 'spear', style: 'thrust', hat: 'helmet' },
    upgrade: { base: 110 },
    perks: {
      3: { id: 'long_pike', name: 'Long Pike', desc: '+15 reach.' },
      6: { id: 'phalanx', name: 'Phalanx', desc: '+15% armor while 2 other Spearmen are close.' },
      9: { id: 'skewer', name: 'Skewer', desc: 'Thrusts also hit the enemy behind the target.' },
    },
  },
  archer: {
    id: 'archer', name: 'Archer', faction: 'ink', role: 'ranged', behavior: 'ranged',
    desc: 'High arcing arrows from far behind the lines. Great against slow crowds.',
    cost: 100, pop: 1, build: 3.5, hp: 95, dmg: 25, range: 540, atkCd: 2.1, windup: 0.7, speed: 72,
    armor: 0, mass: 1, kb: 6, rank: 2,
    tags: ['ranged'], look: { weapon: 'bow', style: 'bow', hat: 'hood' },
    proj: { kind: 'arrow', speed: 640, arc: 0.9, gravity: 900, spread: 22, dmgKind: 'pierce' },
    upgrade: { base: 130 },
    perks: {
      3: { id: 'eagle_eye', name: 'Eagle Eye', desc: '+15% damage and tighter aim.' },
      6: { id: 'volley', name: 'Volley', desc: 'Fires two arrows per shot.' },
      9: { id: 'fire_arrows', name: 'Fire Arrows', desc: 'Arrows set targets alight (burn 30 over 3s).' },
    },
  },
  rider: {
    id: 'rider', name: 'Rider', faction: 'ink', role: 'cavalry', behavior: 'cavalry',
    desc: 'Fast and heavy. The first hit of a charge deals huge damage and sends enemies flying.',
    cost: 165, pop: 2, build: 5, hp: 340, dmg: 26, range: 42, atkCd: 1.1, windup: 0.25, speed: 150,
    armor: 0.1, mass: 3, kb: 60, rank: 1, chargeMult: 2.5, chargeKb: 320,
    tags: ['melee', 'cavalry'], traits: ['charge'], look: { weapon: 'lance', style: 'thrust', mount: 'horse', hat: 'helmet', anim: 'rider' },
    upgrade: { base: 160 },
    perks: {
      3: { id: 'barding', name: 'Barding', desc: '+15% armor.' },
      6: { id: 'trample', name: 'Trample', desc: 'A charge hits every enemy in its path.' },
      9: { id: 'lancer', name: 'Lancer', desc: 'Charge hits deal 3.5x damage.' },
    },
  },
  bomber: {
    id: 'bomber', name: 'Bomber', faction: 'ink', role: 'melee', behavior: 'bomber',
    desc: 'Runs at the biggest crowd and goes boom. Also explodes when killed, so mind the front line.',
    cost: 120, pop: 1, build: 4, hp: 75, dmg: 210, range: 26, atkCd: 1, windup: 0.15, speed: 128,
    armor: 0, mass: 1, kb: 220, rank: 0, aoe: { radius: 110 },
    tags: ['melee'], traits: ['deathBlast'], look: { weapon: 'bomb', style: 'punch', hat: 'goggles' },
    upgrade: { base: 130 },
    perks: {
      3: { id: 'bigger_bombs', name: 'Bigger Bombs', desc: '+25% blast radius.' },
      6: { id: 'shrapnel', name: 'Shrapnel', desc: '+30% blast damage.' },
      9: { id: 'cluster', name: 'Cluster Bomb', desc: 'Scatters three mini bombs after the blast.' },
    },
  },
  medic: {
    id: 'medic', name: 'Medic', faction: 'ink', role: 'support', behavior: 'support',
    desc: 'Patches up the most hurt ally nearby. Keep him behind the fighting.',
    cost: 120, pop: 1, build: 4, hp: 115, dmg: 0, range: 230, atkCd: 1.4, windup: 0.4, speed: 74,
    armor: 0, mass: 1, kb: 0, rank: 3, heal: 24,
    tags: ['support'], look: { weapon: 'satchel', style: 'cast', hat: 'nurse' },
    upgrade: { base: 130 },
    perks: {
      3: { id: 'bandages', name: 'Better Bandages', desc: '+30% healing.' },
      6: { id: 'triage', name: 'Triage', desc: 'Heals two allies at once.' },
      9: { id: 'revive', name: 'Second Draft', desc: 'Redraws a fallen ally every 25 seconds.' },
    },
  },
  doodler: {
    id: 'doodler', name: 'Doodler', faction: 'ink', role: 'caster', behavior: 'caster',
    desc: 'Scribbles lightning that jumps between enemies, and doodles little critters to help.',
    cost: 230, pop: 2, build: 6, hp: 150, dmg: 46, range: 380, atkCd: 3.0, windup: 0.8, speed: 66,
    armor: 0, mass: 1, kb: 20, rank: 3, chain: 3, chainFalloff: 0.7, summonEvery: 12, summonId: 'critter', summonMax: 2,
    tags: ['caster'], look: { weapon: 'quill', style: 'cast', hat: 'wizard' },
    upgrade: { base: 170 },
    perks: {
      3: { id: 'extra_scribble', name: 'Extra Scribble', desc: 'Lightning jumps to one more enemy.' },
      6: { id: 'doodle_pals', name: 'Doodle Pals', desc: 'Keeps up to three critters.' },
      9: { id: 'storm_scribble', name: 'Storm Scribble', desc: 'Lightning stuns for 0.5s.' },
    },
  },
  catapult: {
    id: 'catapult', name: 'Catapult', faction: 'ink', role: 'siege', behavior: 'siege',
    desc: 'Hurls boulders across the page. Triple damage to forts. Cannot hit anything too close.',
    cost: 330, pop: 3, build: 10, hp: 320, dmg: 95, range: 780, minRange: 140, radius: 22, atkCd: 4.6, windup: 1.0, speed: 40,
    armor: 0.1, mass: 6, kb: 120, rank: 4, fortMult: 3,
    tags: ['siege', 'large'], look: { body: 'catapult', scale: 1, style: 'slam' },
    proj: { kind: 'boulder', speed: 560, arc: 1.2, gravity: 900, spread: 30, aoe: 85, dmgKind: 'blast' },
    upgrade: { base: 220 },
    perks: {
      3: { id: 'heavier_rocks', name: 'Heavier Rocks', desc: '+20% damage.' },
      6: { id: 'ink_pots', name: 'Ink Pots', desc: 'Impacts leave a puddle that slows enemies.' },
      9: { id: 'double_load', name: 'Double Load', desc: 'Throws two boulders.' },
    },
  },
  colossus: {
    id: 'colossus', name: 'Colossus', faction: 'ink', role: 'heavy', behavior: 'melee',
    desc: 'A giant doodle with a giant club. Every swing hits a crowd and knocks it flat.',
    cost: 550, pop: 5, build: 14, hp: 1600, dmg: 80, range: 70, atkCd: 2.6, windup: 0.8, speed: 46,
    armor: 0.15, mass: 12, kb: 300, rank: 0, aoe: { radius: 100, frontal: true },
    tags: ['melee', 'large'], look: { weapon: 'club', style: 'slam', scale: 2.5, bulk: 1.25 },
    upgrade: { base: 260 },
    perks: {
      3: { id: 'thick_skin', name: 'Thick Skin', desc: '+10% armor.' },
      6: { id: 'earthshaker', name: 'Earthshaker', desc: 'Swings stun for 0.5s.' },
      9: { id: 'unstoppable', name: 'Unstoppable', desc: 'Immune to knockback and stuns; regenerates 1% health per second.' },
    },
  },
  ninja: {
    id: 'ninja', name: 'Ninja', faction: 'ink', role: 'assassin', behavior: 'assassin',
    desc: 'Invisible until he strikes. Slips past the front line to cut down archers and healers.',
    cost: 250, pop: 2, build: 7, hp: 170, dmg: 62, range: 30, atkCd: 1.0, windup: 0.2, speed: 128,
    armor: 0, mass: 1, kb: 40, rank: 1, backstab: 2,
    tags: ['melee', 'assassin'], traits: ['stealth'], look: { weapon: 'katana', style: 'slash', hat: 'headband', anim: 'ninja' },
    upgrade: { base: 200 },
    perks: {
      3: { id: 'smoke_bomb', name: 'Smoke Bomb', desc: 'Vanishes again after each kill.' },
      6: { id: 'shadow_step', name: 'Shadow Step', desc: 'Teleports behind the first target.' },
      9: { id: 'death_mark', name: 'Death Mark', desc: 'Backstabs deal 4x damage.' },
    },
  },

  // Summon (Doodler critter). Not buildable.
  critter: {
    id: 'critter', name: 'Scribble Critter', faction: 'ink', role: 'melee', behavior: 'melee', summon: true,
    desc: 'A small angry scribble.', cost: 0, pop: 0, build: 0, hp: 60, dmg: 8, range: 22, atkCd: 0.8, windup: 0.2,
    speed: 105, armor: 0, mass: 0.6, kb: 10, rank: 1, lifetime: 14,
    tags: ['melee', 'small', 'summon'], look: { body: 'critter', scale: 0.7, style: 'punch' },
  },

  // Structures (spawned by spells and bosses). behavior 'structure', drawn by BODIES[look.body].
  sticky_wall: {
    id: 'sticky_wall', name: 'Sticky Wall', faction: 'ink', role: 'structure', behavior: 'structure', summon: true,
    desc: 'A stack of sticky notes. Enemies must chew through it.', cost: 0, pop: 0, build: 0, hp: 900, dmg: 0, range: 0,
    atkCd: 99, windup: 0, speed: 0, armor: 0, mass: 999, kb: 0, rank: 0, radius: 24, height: 120, lifetime: 20,
    tags: ['structure'], look: { body: 'sticky_wall' },
  },
  chalk_wall: {
    id: 'chalk_wall', name: 'Detention Wall', faction: 'chalk', role: 'structure', behavior: 'structure', summon: true,
    desc: 'A chalk-drawn wall. Break it to pass.', cost: 0, pop: 0, build: 0, hp: 1400, dmg: 0, range: 0,
    atkCd: 99, windup: 0, speed: 0, armor: 0.1, mass: 999, kb: 0, rank: 0, radius: 26, height: 130, lifetime: 25,
    tags: ['structure'], look: { body: 'chalk_wall' },
  },

  // ------------------------------------------------------------ Hero (one per team at most)
  captain: {
    id: 'captain', name: 'The Captain', faction: 'ink', role: 'hero', behavior: 'hero', hero: true,
    desc: 'Your commander. Move with A/D, fight automatically, and use abilities with Q, E and R.',
    cost: 0, pop: 0, build: 0, hp: 650, dmg: 32, range: 40, atkCd: 0.75, windup: 0.22, speed: 115,
    armor: 0.1, mass: 2.5, kb: 50, rank: 1,
    tags: ['melee', 'hero'], look: { weapon: 'sword', style: 'slash', hat: 'captain', extras: ['cape'], scale: 1.18, bulk: 1.1 },
  },

  // ------------------------------------------------------------ Graphite Horde (chapter 2)
  smudgeling: {
    id: 'smudgeling', name: 'Smudgeling', faction: 'graphite', role: 'melee', behavior: 'melee',
    desc: 'Tiny, fast, and there are always more of them.',
    cost: 18, pop: 0.5, build: 1, hp: 55, dmg: 7, range: 22, atkCd: 0.8, windup: 0.2, speed: 96,
    armor: 0, mass: 0.6, kb: 10, rank: 1,
    tags: ['melee', 'small', 'swarm'], look: { weapon: 'claws', style: 'punch', scale: 0.72 },
  },
  sharpener: {
    id: 'sharpener', name: 'Sharpener', faction: 'graphite', role: 'melee', behavior: 'melee',
    desc: 'Gets faster and meaner the more he is hurt.',
    cost: 70, pop: 1, build: 2.5, hp: 160, dmg: 16, range: 32, atkCd: 0.9, windup: 0.25, speed: 86,
    armor: 0, mass: 1, kb: 25, rank: 1,
    tags: ['melee'], traits: ['berserk'], look: { weapon: 'pencil_blade', style: 'slash' },
  },
  lead_thrower: {
    id: 'lead_thrower', name: 'Lead Thrower', faction: 'graphite', role: 'ranged', behavior: 'ranged',
    desc: 'Flings sharp pencil leads in flat, fast arcs.',
    cost: 65, pop: 1, build: 2.8, hp: 85, dmg: 15, range: 340, atkCd: 1.7, windup: 0.45, speed: 74,
    armor: 0, mass: 1, kb: 6, rank: 2,
    tags: ['ranged'], look: { weapon: 'lead_dart', style: 'throw' },
    proj: { kind: 'lead', speed: 700, arc: 0.25, gravity: 700, spread: 14, dmgKind: 'pierce' },
  },
  graphite_golem: {
    id: 'graphite_golem', name: 'Graphite Golem', faction: 'graphite', role: 'heavy', behavior: 'melee',
    desc: 'A lumbering pile of pencil shavings. Breaks into Smudgelings when it falls.',
    cost: 380, pop: 4, build: 12, hp: 1500, dmg: 60, range: 66, atkCd: 2.4, windup: 0.75, speed: 48,
    armor: 0.1, mass: 10, kb: 240, rank: 0, aoe: { radius: 90, frontal: true },
    tags: ['melee', 'large'], traits: ['shatter'], look: { weapon: 'fists', style: 'slam', scale: 2.2, bulk: 1.5 },
  },

  // ------------------------------------------------------------ Highlighter Gang (chapter 3)
  glowrunner: {
    id: 'glowrunner', name: 'Glowrunner', faction: 'neon', role: 'melee', behavior: 'melee',
    desc: 'Neon-fast. Reaches your lines before you are ready.',
    cost: 50, pop: 1, build: 2, hp: 110, dmg: 13, range: 30, atkCd: 0.8, windup: 0.22, speed: 125,
    armor: 0, mass: 1, kb: 20, rank: 1,
    tags: ['melee'], look: { weapon: 'glowstick', style: 'slash' },
  },
  neon_archer: {
    id: 'neon_archer', name: 'Neon Archer', faction: 'neon', role: 'ranged', behavior: 'ranged',
    desc: 'Fires glowing arrows that keep burning after they land.',
    cost: 120, pop: 1, build: 3.5, hp: 90, dmg: 18, range: 520, atkCd: 2.0, windup: 0.65, speed: 72,
    armor: 0, mass: 1, kb: 6, rank: 2,
    tags: ['ranged'], traits: ['burnHit'], look: { weapon: 'bow', style: 'bow', hat: 'visor' },
    proj: { kind: 'neon_arrow', speed: 640, arc: 0.85, gravity: 900, spread: 22, dmgKind: 'pierce' },
  },
  marker_knight: {
    id: 'marker_knight', name: 'Marker Knight', faction: 'neon', role: 'tank', behavior: 'melee',
    desc: 'Thick marker armor and a glowing shield.',
    cost: 140, pop: 2, build: 4.5, hp: 520, dmg: 18, range: 34, atkCd: 1.2, windup: 0.35, speed: 62,
    armor: 0.3, mass: 2.5, kb: 40, rank: 0, block: 0.75,
    tags: ['melee', 'tank'], traits: ['shieldBlock'], look: { weapon: 'marker_shield', style: 'bash', hat: 'helmet' },
  },
  glow_shaman: {
    id: 'glow_shaman', name: 'Glow Shaman', faction: 'neon', role: 'support', behavior: 'support',
    desc: 'Pulses light that speeds up and heals nearby allies.',
    cost: 160, pop: 2, build: 5, hp: 140, dmg: 0, range: 260, atkCd: 2.0, windup: 0.5, speed: 70,
    armor: 0, mass: 1, kb: 0, rank: 3, heal: 14, auraBuff: { speed: 1.2, dmg: 1.15, dur: 3 },
    tags: ['support'], look: { weapon: 'staff', style: 'cast', hat: 'feather' },
  },

  // ------------------------------------------------------------ Chalk Legion (chapter 4)
  dustborn: {
    id: 'dustborn', name: 'Dustborn', faction: 'chalk', role: 'melee', behavior: 'melee',
    desc: 'Crumbles when beaten, then pulls itself back together once.',
    cost: 60, pop: 1, build: 2.4, hp: 120, dmg: 14, range: 30, atkCd: 1.0, windup: 0.3, speed: 76,
    armor: 0, mass: 1, kb: 20, rank: 1,
    tags: ['melee'], traits: ['reassemble'], look: { weapon: 'chalk', style: 'slash', anim: 'dustborn' },
  },
  chalk_thrower: {
    id: 'chalk_thrower', name: 'Chalk Thrower', faction: 'chalk', role: 'ranged', behavior: 'ranged',
    desc: 'Chalk dust slows whatever it hits.',
    cost: 75, pop: 1, build: 3, hp: 85, dmg: 13, range: 360, atkCd: 1.8, windup: 0.5, speed: 74,
    armor: 0, mass: 1, kb: 6, rank: 2,
    tags: ['ranged'], traits: ['slowHit'], look: { weapon: 'chalk', style: 'throw' },
    proj: { kind: 'chalk', speed: 560, arc: 0.5, gravity: 900, spread: 16, dmgKind: 'pierce' },
  },
  board_brute: {
    id: 'board_brute', name: 'Board Brute', faction: 'chalk', role: 'tank', behavior: 'melee',
    desc: 'Carries a whole board eraser as a club.',
    cost: 200, pop: 3, build: 7, hp: 900, dmg: 40, range: 46, atkCd: 1.8, windup: 0.55, speed: 52,
    armor: 0.2, mass: 4, kb: 120, rank: 0,
    tags: ['melee', 'tank', 'large'], look: { weapon: 'board', style: 'slam', scale: 1.5, bulk: 1.2 },
  },
  dust_mage: {
    id: 'dust_mage', name: 'Dust Mage', faction: 'chalk', role: 'caster', behavior: 'caster',
    desc: 'Conjures choking clouds of chalk dust.',
    cost: 210, pop: 2, build: 6, hp: 150, dmg: 40, range: 400, atkCd: 3.2, windup: 0.8, speed: 64,
    armor: 0, mass: 1, kb: 20, rank: 3, aoe: { radius: 80 },
    tags: ['caster'], look: { weapon: 'staff', style: 'cast', hat: 'mortarboard' },
  },

  // ------------------------------------------------------------ Eraser Empire (chapter 5)
  crumb: {
    id: 'crumb', name: 'Crumb', faction: 'eraser', role: 'melee', behavior: 'melee',
    desc: 'A rubbery little eraser crumb with a grudge.',
    cost: 22, pop: 0.5, build: 1, hp: 70, dmg: 8, range: 22, atkCd: 0.8, windup: 0.2, speed: 92,
    armor: 0.05, mass: 0.7, kb: 10, rank: 1,
    tags: ['melee', 'small', 'swarm'], look: { weapon: 'fists', style: 'punch', scale: 0.7, bulk: 1.3 },
  },
  eraser_knight: {
    id: 'eraser_knight', name: 'Eraser Knight', faction: 'eraser', role: 'tank', behavior: 'melee',
    desc: 'Its hits rub out buffs and stop healing for a moment.',
    cost: 170, pop: 2, build: 5, hp: 640, dmg: 24, range: 36, atkCd: 1.3, windup: 0.38, speed: 58,
    armor: 0.3, mass: 3, kb: 50, rank: 0,
    tags: ['melee', 'tank'], traits: ['cleanse'], look: { weapon: 'eraser_shield', style: 'bash', hat: 'helmet', bulk: 1.2 },
  },
  shaving_slinger: {
    id: 'shaving_slinger', name: 'Shaving Slinger', faction: 'eraser', role: 'ranged', behavior: 'ranged',
    desc: 'Whips curly pencil shavings across the page.',
    cost: 80, pop: 1, build: 3, hp: 100, dmg: 16, range: 380, atkCd: 1.7, windup: 0.45, speed: 74,
    armor: 0, mass: 1, kb: 6, rank: 2,
    tags: ['ranged'], look: { weapon: 'sling', style: 'throw' },
    proj: { kind: 'shaving', speed: 600, arc: 0.4, gravity: 800, spread: 16, dmgKind: 'pierce' },
  },
  whiteout_priest: {
    id: 'whiteout_priest', name: 'Whiteout Priest', faction: 'eraser', role: 'support', behavior: 'support',
    desc: 'Heals with correction fluid and paints fallen allies back onto the page.',
    cost: 220, pop: 2, build: 6, hp: 170, dmg: 0, range: 260, atkCd: 1.5, windup: 0.4, speed: 68,
    armor: 0.05, mass: 1, kb: 0, rank: 3, heal: 30, reviveEvery: 20,
    tags: ['support'], look: { weapon: 'whiteout', style: 'cast', hat: 'hood' },
  },

  // ------------------------------------------------------------ Bosses (behavior code in src/sim/behaviors/bosses.js)
  boss_redline: {
    id: 'boss_redline', name: 'General Redline', faction: 'red', role: 'boss', behavior: 'boss_redline', boss: true,
    desc: 'Leader of the Red Pen Rebels. Charges with a red pen lance and rallies his troops.',
    cost: 0, pop: 0, build: 0, hp: 4000, dmg: 50, range: 64, atkCd: 1.4, windup: 0.4, speed: 70,
    armor: 0.15, mass: 8, kb: 160, rank: 0,
    tags: ['melee', 'boss', 'large'], look: { weapon: 'red_lance', style: 'thrust', scale: 1.7, hat: 'general', extras: ['cape'] },
  },
  boss_smudge: {
    id: 'boss_smudge', name: 'Old Smudge', faction: 'graphite', role: 'boss', behavior: 'boss_smudge', boss: true,
    desc: 'A mountain of graphite. Slams the ground and belches Smudgelings.',
    cost: 0, pop: 0, build: 0, hp: 7000, dmg: 90, range: 90, atkCd: 2.8, windup: 0.9, speed: 40,
    armor: 0.15, mass: 30, kb: 320, rank: 0, aoe: { radius: 130, frontal: true },
    tags: ['melee', 'boss', 'large'], look: { weapon: 'fists', style: 'slam', scale: 3.2, bulk: 1.7 },
  },
  boss_wyrm: {
    id: 'boss_wyrm', name: 'The Neon Wyrm', faction: 'neon', role: 'boss', behavior: 'boss_wyrm', boss: true,
    desc: 'A highlighter dragon. Only arrows and spells reach it in the air; it lands to stomp.',
    cost: 0, pop: 0, build: 0, hp: 5200, dmg: 70, range: 110, atkCd: 2.4, windup: 0.7, speed: 90,
    armor: 0.1, mass: 30, kb: 260, rank: 0,
    tags: ['boss', 'large', 'flying'], look: { body: 'wyrm', scale: 1 },
  },
  boss_professor: {
    id: 'boss_professor', name: 'The Professor', faction: 'chalk', role: 'boss', behavior: 'boss_professor', boss: true,
    desc: 'Gives pop quizzes that freeze your army, and rains chalk equations.',
    cost: 0, pop: 0, build: 0, hp: 10000, dmg: 70, range: 80, atkCd: 2.0, windup: 0.6, speed: 50,
    armor: 0.2, mass: 30, kb: 200, rank: 0,
    tags: ['melee', 'boss', 'large'], look: { weapon: 'pointer', style: 'slash', scale: 2.6, hat: 'mortarboard', extras: ['glasses'] },
  },
  boss_hand: {
    id: 'boss_hand', name: 'The Hand', faction: 'eraser', role: 'boss', behavior: 'boss_hand', boss: true,
    desc: 'The hand that draws the page. It wants to erase this war.',
    cost: 0, pop: 0, build: 0, hp: 9000, dmg: 120, range: 0, atkCd: 3, windup: 1, speed: 0,
    armor: 0.1, mass: 999, kb: 300, rank: 0,
    tags: ['boss', 'large', 'flying'], look: { body: 'hand', scale: 1 },
  },
};

// Player-facing roster order (cards, armory). Scribe is always first.
export const PLAYER_ROSTER = ['scribe', 'brawler', 'slinger', 'shieldbearer', 'spearman', 'archer', 'bomber', 'medic', 'rider', 'doodler', 'catapult', 'colossus', 'ninja'];

export const MAX_LOADOUT = 8; // combat unit cards per battle, plus the Scribe

export function unitDef(id) {
  const d = UNITS[id];
  if (!d) throw new Error('Unknown unit ' + id);
  return d;
}
