// Node-only checks for the progression rules (no DOM): crates, captain points, feature gates,
// battle results. Run: node tools/tests/meta_logic.mjs
import { defaultProfile, Save } from '../../src/game/save.js';
import * as P from '../../src/game/progression.js';
import { CRATE_HATS } from '../../src/data/hats.js';

let bad = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const fakeSession = (opts, result) => ({
  opts,
  battle: { result: { winner: 0, time: 150, fortHpPct: 1, fortDamaged: false, bossDefeated: false, boss: null, stats: { kills: 5, lost: 1, inkGathered: 100, spawned: 8, healed: 0, heroKills: 1, launches: 0, scribeKills: 0, maxArmy: 6 }, ...result } },
});
const win = (p, id, extra) => P.applyBattleResult(p, fakeSession({ kind: 'campaign', levelId: id }, extra));

Save.data = defaultProfile();
let p = Save.data;
check(!P.featureUnlocked(p, 'armory') && !P.featureUnlocked(p, 'daily'), 'gates: closed on a fresh save');
let s = win(p, '1-1');
check(s.stars === 3 && s.firstClear, '1-1: 3 stars and first clear');
check(P.featureUnlocked(p, 'armory') && P.featureUnlocked(p, 'achievements') && !P.featureUnlocked(p, 'captain'), 'gates: armory + trophies open after 1-1');
check(s.features.includes('armory'), 'result lists the newly opened menu entries');
check(p.unlockedUnits.includes('slinger') && p.loadout.units.includes('slinger'), 'slinger unlocked and added to the loadout');
win(p, '1-2');
check(P.featureUnlocked(p, 'captain'), 'gates: captain opens after 1-2');
check(p.hero.level >= 2 && p.hero.points >= 1, 'captain gained a level and a point (lv ' + p.hero.level + ')');

// Captain points
const before = p.hero.points;
check(P.spendHeroPoint(p, 'sharp_nib') && p.hero.skills.sharp_nib === 1 && p.hero.points === before - 1, 'skill: point spent');
check(!P.spendHeroPoint(p, 'whirlwind'), 'skill: level requirement enforced');
const n = P.respecHero(p);
check(n === 1 && p.hero.points === before && !p.hero.skills.sharp_nib, 'skill: respec refunds');

// Crates: one per 10 stars and one per boss first clear
const q = defaultProfile(); Save.data = q;
const ids = ['1-1', '1-2', '1-3', '1-4', '1-5'];
let crates = 0;
for (const id of ids) crates += win(q, id).crates;
check(crates === 1 && q.crates === 1 && q.crateStars === 1, '15 stars -> 1 crate (' + crates + ')');
const boss = win(q, '1-6', { bossDefeated: true, boss: 'boss_redline' });
check(boss.crates >= 1, 'boss first clear -> crate (' + boss.crates + ')');
const replay = win(q, '1-6', { bossDefeated: true, boss: 'boss_redline' });
check(replay.crates === 0, 'boss replay -> no crate');
q.crates = 20;
const owned = new Set();
for (let i = 0; i < CRATE_HATS.length; i++) { const r = P.openCrate(q, Math.random); if (r.type === 'hat') owned.add(r.id); }
check(owned.size === CRATE_HATS.length, 'crates give each crate hat once');
const last = P.openCrate(q);
check(last.type === 'gold' && last.amount === P.CRATE_GOLD, 'all crate hats owned -> gold');

// Purchases and badges
const r = defaultProfile(); Save.data = r;
r.gold = 50;
check(!P.buyUnitUpgrade(r, 'brawler'), 'buy: refused when poor');
r.gold = 500;
check(P.buyUnitUpgrade(r, 'brawler') && r.units.brawler === 2 && r.gold < 500, 'buy: unit upgrade');
check(P.badgeCounts(r).units > 0, 'badge: affordable upgrades flagged');
check(P.todayKey(new Date(Date.UTC(2026, 0, 5))) === '2026-01-05', 'todayKey pads month and day');

// Round 2: ending flag, Red Ink best time, daily consolation, achievement pay
import { ACHIEVEMENTS } from '../../src/data/achievements.js';
{
  const e = defaultProfile(); Save.data = e;
  for (const l of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '5-1', '5-2', '5-3', '5-4', '5-5']) win(e, l);
  const earlier = win(e, '5-5');
  check(!earlier.ending, 'ending: not after an ordinary level');
  const fin = win(defaultProfile(), '5-6', { bossDefeated: true, boss: 'boss_hand' });
  check(fin.ending === true, 'ending: first win of 5-6 sets summary.ending');
  const seenAlready = defaultProfile(); Save.data = seenAlready; seenAlready.seen.ending = true;
  check(!win(seenAlready, '5-6', { bossDefeated: true, boss: 'boss_hand' }).ending, 'ending: not again once seen');
  const h = defaultProfile(); Save.data = h;
  win(h, '1-1', { time: 100 });
  const hs = P.applyBattleResult(h, fakeSession({ kind: 'campaign', levelId: '1-1', hard: true }, { time: 60 }));
  check(h.levels['1-1'].bestTime === 100 && h.levels['1-1'].bestTimeHard === 60, 'Red Ink win keeps its own best time (' + h.levels['1-1'].bestTime + ' / ' + h.levels['1-1'].bestTimeHard + ')');
  check(!hs.ending, 'ending: never from Red Ink');
}
{
  const d = defaultProfile(); Save.data = d;
  const dailyLoss = (time) => P.applyBattleResult(d, fakeSession({ kind: 'daily', date: '2026-01-05' }, { winner: 1, time }));
  const quick = dailyLoss(10);
  check(quick.gold === 0 && quick.xp === 0, 'daily loss under 20 s pays nothing');
  const mid = dailyLoss(60);
  check(mid.gold > 0 && mid.xp > 0 && mid.gold < 500, 'daily loss pays a small consolation (' + mid.gold + ' gold, ' + mid.xp + ' xp)');
  const full = dailyLoss(200);
  check(full.gold >= mid.gold && full.gold <= P.DAILY_CONSOLATION.gold, 'daily consolation scales with time and is capped');
}
{
  const early = ACHIEVEMENTS.filter((a) => ['first_blood', 'untouchable', 'speedrun', 'kaboom', 'big_army'].includes(a.id));
  check(early.every((a) => a.gold <= 220), 'early achievements pay modestly (' + early.map((a) => a.gold).join('/') + ')');
  check(ACHIEVEMENTS.find((a) => a.id === 'boss_5').gold >= 1000 && ACHIEVEMENTS.find((a) => a.id === 'endless_30').gold >= 1500, 'big late achievements stay meaningful');
}

console.log(bad ? `${bad} FAILED` : 'meta logic ok');
process.exit(bad ? 1 : 0);
