// Achievements. stat = lifetime counter in profile.stats (see src/game/save.js) or a
// special check key; goal = threshold. Tracking lives in src/game/achievements.js.

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Win your first battle.', stat: 'wins', goal: 1, gold: 100 },
  { id: 'veteran', name: 'Veteran', desc: 'Win 25 battles.', stat: 'wins', goal: 25, gold: 600 },
  { id: 'warmonger', name: 'Warmonger', desc: 'Defeat 1,000 enemies.', stat: 'kills', goal: 1000, gold: 500, hat: 'viking' },
  { id: 'page_turner', name: 'Page Turner', desc: 'Defeat 10,000 enemies.', stat: 'kills', goal: 10000, gold: 2000 },
  { id: 'ink_tycoon', name: 'Ink Tycoon', desc: 'Gather 25,000 ink with Scribes.', stat: 'inkGathered', goal: 25000, gold: 500, hat: 'top_hat' },
  { id: 'big_army', name: 'Big Army', desc: 'Have 30 army size on the field at once.', stat: 'maxArmy', goal: 30, gold: 300 },
  { id: 'untouchable', name: 'Untouchable', desc: 'Win a battle without your fort taking damage.', stat: 'flawless', goal: 1, gold: 400 },
  { id: 'speedrun', name: 'Speed Sketch', desc: 'Win a battle in under 2 minutes.', stat: 'fastWin', goal: 1, gold: 300 },
  { id: 'coffee_break', name: 'Coffee Break', desc: 'Hit 10 enemies with one Coffee Spill.', stat: 'coffeeMulti', goal: 10, gold: 300, hat: 'chef' },
  { id: 'stampede', name: 'Stampede', desc: 'Have 8 Riders on the field at once.', stat: 'maxRiders', goal: 8, gold: 300, hat: 'cowboy' },
  { id: 'kaboom', name: 'Kaboom', desc: 'Defeat 6 enemies with a single Bomber.', stat: 'bomberMulti', goal: 6, gold: 300 },
  { id: 'plunderer', name: 'Plunderer', desc: 'Defeat 50 enemy Scribes.', stat: 'scribeKills', goal: 50, gold: 300, hat: 'pirate' },
  { id: 'frequent_flyer', name: 'Frequent Flyer', desc: 'Send 100 enemies flying with knockback.', stat: 'launches', goal: 100, gold: 300, hat: 'propeller' },
  { id: 'oops', name: 'Oops', desc: 'Lose 10 of your own units to your own Bombers.', stat: 'friendlyBombs', goal: 10, gold: 150, hat: 'traffic_cone' },
  { id: 'medic', name: 'Paper Cuts', desc: 'Heal 10,000 health with Medics.', stat: 'healed', goal: 10000, gold: 400 },
  { id: 'hero_slayer', name: 'Captain Fantastic', desc: 'Defeat 500 enemies with the Captain.', stat: 'heroKills', goal: 500, gold: 500 },
  { id: 'boss_1', name: 'Red Out', desc: 'Defeat General Redline.', stat: 'boss_redline', goal: 1, gold: 200 },
  { id: 'boss_2', name: 'Unsmudged', desc: 'Defeat Old Smudge.', stat: 'boss_smudge', goal: 1, gold: 300 },
  { id: 'boss_3', name: 'Lights Out', desc: 'Defeat the Neon Wyrm.', stat: 'boss_wyrm', goal: 1, gold: 400 },
  { id: 'boss_4', name: 'Class Dismissed', desc: 'Defeat the Professor.', stat: 'boss_professor', goal: 1, gold: 500 },
  { id: 'boss_5', name: 'Still Drawing', desc: 'Defeat the Hand.', stat: 'boss_hand', goal: 1, gold: 1000 },
  { id: 'all_stars_1', name: 'Gold Stars', desc: 'Earn 3 stars on every level of Page 1.', stat: 'chapterStars1', goal: 18, gold: 400 },
  { id: 'star_student', name: 'Star Student', desc: 'Earn 60 campaign stars.', stat: 'stars', goal: 60, gold: 1000 },
  { id: 'hard_1', name: 'Red Ink', desc: 'Win a level in Red Ink mode.', stat: 'hardWins', goal: 1, gold: 500 },
  { id: 'endless_10', name: 'Long Scroll', desc: 'Reach wave 10 in Endless.', stat: 'endlessBest', goal: 10, gold: 300 },
  { id: 'endless_20', name: 'Endless Notebook', desc: 'Reach wave 20 in Endless.', stat: 'endlessBest', goal: 20, gold: 800, hat: 'samurai' },
  { id: 'endless_30', name: 'Bottomless', desc: 'Reach wave 30 in Endless.', stat: 'endlessBest', goal: 30, gold: 1500, hat: 'astronaut' },
  { id: 'daily_1', name: 'Homework', desc: 'Win a Daily Challenge.', stat: 'dailyWins', goal: 1, gold: 200 },
  { id: 'daily_3', name: 'Good Habits', desc: 'Win Daily Challenges 3 days in a row.', stat: 'dailyStreak', goal: 3, gold: 500, hat: 'headphones' },
  { id: 'max_unit', name: 'Masterpiece', desc: 'Upgrade any unit to level 10.', stat: 'maxUnitLevel', goal: 10, gold: 500 },
  { id: 'hat_trick', name: 'Hat Trick', desc: 'Collect 12 hats.', stat: 'hats', goal: 12, gold: 500 },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
