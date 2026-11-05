// Endless mode draft perks. Between waves you pick 1 of 3. Effects are implemented in
// src/sim/perks.js (PERK_IMPL) and applied to the player team when picked.

export const PERKS = [
  { id: 'sharp_swords', rarity: 'common', name: 'Sharpened Swords', desc: 'Melee units deal +15% damage.' },
  { id: 'quick_quills', rarity: 'common', name: 'Quick Quills', desc: 'Units draw 15% faster.' },
  { id: 'thick_paper', rarity: 'common', name: 'Thick Paper', desc: 'All units +15% health.' },
  { id: 'long_arms', rarity: 'common', name: 'Long Arms', desc: 'Ranged units +60 range.' },
  { id: 'ink_flow', rarity: 'common', name: 'Ink Flow', desc: '+1.5 passive ink per second.' },
  { id: 'cheap_ink', rarity: 'common', name: 'Bulk Ink', desc: 'Units cost 10% less.' },
  { id: 'fast_feet', rarity: 'common', name: 'Fast Feet', desc: 'All units move 12% faster.' },
  { id: 'patch_up', rarity: 'common', name: 'Patch Up', desc: 'Repair 25% of your fort now.' },
  { id: 'big_barracks', rarity: 'common', name: 'Big Barracks', desc: '+5 army size.' },
  { id: 'hot_coffee', rarity: 'rare', name: 'Extra Shot', desc: 'Spells recharge 20% faster.' },
  { id: 'vampire_ink', rarity: 'rare', name: 'Vampire Ink', desc: 'Melee hits heal for 10% of damage.' },
  { id: 'iron_scribes', rarity: 'rare', name: 'Iron Scribes', desc: 'Scribes carry double ink and have triple health.' },
  { id: 'tower_volley', rarity: 'rare', name: 'Tower Volley', desc: 'Your fort tower fires 2 extra arrows.' },
  { id: 'armor_plates', rarity: 'rare', name: 'Armor Plates', desc: 'All units +10% armor.' },
  { id: 'heavy_hitters', rarity: 'rare', name: 'Heavy Hitters', desc: 'Knockback +50% and +10% damage to large enemies.' },
  { id: 'fire_everything', rarity: 'rare', name: 'Fire Everything', desc: 'Ranged hits burn for 3 seconds.' },
  { id: 'free_fifth', rarity: 'rare', name: 'Buy Four', desc: 'Every fifth unit you draw is free.' },
  { id: 'hero_vigor', rarity: 'rare', name: 'Captain\'s Vigor', desc: 'Captain +40% health and damage.' },
  { id: 'martyrs', rarity: 'epic', name: 'Martyrs', desc: 'Your Brawlers explode when they fall.' },
  { id: 'double_draw', rarity: 'epic', name: 'Carbon Copy', desc: '20% chance to draw a unit twice.' },
  { id: 'giant_slayer', rarity: 'epic', name: 'Giant Slayer', desc: 'All units deal double damage to bosses and large enemies.' },
  { id: 'second_wind', rarity: 'epic', name: 'Second Wind', desc: 'Once per wave, your fort heals 40% when it drops under 30%.' },
  { id: 'storm_caller', rarity: 'epic', name: 'Storm Caller', desc: 'Every 12 seconds lightning strikes the strongest enemy.' },
  { id: 'ink_bank', rarity: 'epic', name: 'Ink Bank', desc: 'Gain 10% of your unspent ink every 10 seconds.' },
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const RARITY_WEIGHT = { common: 60, rare: 30, epic: 10 };
