// Entry cards for the two replayable modes: the Daily Challenge and the Endless Notebook.
// dailyInfo(date) comes from src/game/daily.js (written by the modes package); until it exists
// a friendly fallback card is shown.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import * as DailyMod from '../../game/daily.js';
import { MODE_BUILDERS } from '../../game/modes.js';
import { FACTIONS } from '../../data/factions.js';
import { MODIFIERS } from '../../data/levels.js';
import { UNITS } from '../../data/units.js';
import { SPELLS } from '../../data/spells.js';
import { HAT_BY_ID } from '../../data/hats.js';
import { todayKey } from '../../game/progression.js';
import { icon, unitIcon, hatIcon } from '../../render/icons.js';
import { ico, header, goldChip, dispose, replay, onEsc } from './meta_ui.js';

const DAILY_REWARD = 500;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${dt.toLocaleString('en-US', { month: 'long' })} ${d}`;
}

// The challenge turns over at UTC midnight (src/game/daily.js), the same moment for everyone.
function untilTomorrow() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, next - now.getTime());
  const hrs = Math.floor(ms / 3600000), mins = Math.floor((ms % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

UI.register('daily', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'daily-screen');
    const p = Save.data;
    const date = todayKey();
    let info = params.info || null;
    if (!info && typeof DailyMod.dailyInfo === 'function') {
      try { info = DailyMod.dailyInfo(date); } catch (e) { console.error(e); }
    }
    const won = p.daily.lastWin === date;
    const triedToday = !won && p.daily.lastPlayed === date;
    const streak = p.daily.streak || 0;
    const gold = goldChip(el);
    const canPlay = !!info && !!MODE_BUILDERS.daily;

    // ---- today's challenge
    const mods = info ? (info.modifiers || info.mods || []) : [];
    const units = info ? (info.units || info.roster || []).filter((id) => UNITS[id]) : [];
    const spells = info ? (info.spells || []).map((s) => (typeof s === 'string' ? s : s.id)).filter((id) => SPELLS[id]) : [];
    const factionId = info ? info.faction : null;
    const fac = FACTIONS[factionId];
    const unitLevel = info ? (info.unitLevel || info.level || 1) : 1;
    const reward = (info && info.reward) || DAILY_REWARD;

    const today = h('div.dl-card.card.plain.grow', null,
      h('div.dl-head', null, h('div.mode-art', null, ico('menu_daily', 128)), h('div.dl-titles', null, h('div.dl-date.marker', null, prettyDate(date)), h('div.small-note', null, 'One challenge a day, the same for everyone.'))),
      info
        ? h('div.dl-body', null,
          fac ? h('div.dl-row', null, h('span.dl-k', null, 'Enemy'), h('span.pill.pink', null, fac.name)) : null,
          mods.length ? h('div.dl-row', null, h('span.dl-k', null, 'Twists'), h('div.dl-chips', null, mods.map((m) => h('span.pill.orange', { title: MODIFIERS[m] ? MODIFIERS[m].desc : '' }, MODIFIERS[m] ? MODIFIERS[m].name : m)))) : null,
          units.length ? h('div.dl-row', null, h('span.dl-k', null, 'Your army'), h('div.dl-icons', null, units.map((id) => h('img', { src: unitIcon(id, { size: 96, level: unitLevel }), alt: UNITS[id].name, title: UNITS[id].name })), h('span.pill.yellow', null, 'All Lv ' + unitLevel))) : null,
          spells.length ? h('div.dl-row', null, h('span.dl-k', null, 'Supplies'), h('div.dl-icons', null, spells.map((id) => h('img', { src: icon('spell_' + id, 96), alt: SPELLS[id].name, title: SPELLS[id].name })))) : null,
          mods.length ? h('div.small-note.dl-explain', null, mods.map((m) => (MODIFIERS[m] ? `${MODIFIERS[m].name}: ${MODIFIERS[m].desc}` : '')).filter(Boolean).join(' ')) : null)
        : h('div.dl-body', null, h('div.dl-wait', null, ico('menu_daily', 96), h('div', null, h('b.marker', null, 'Today\'s challenge is being drawn.'), h('div.small-note', null, 'Check back in a moment.')))));

    // ---- streak
    const goal = 3;
    const streakCard = h('div.dl-card.card.plain.dl-streak.grow', null,
      h('div.dl-streak-top', null, ico('flame', 96), h('div', null, h('div.dl-big.marker', null, `${streak} day${streak === 1 ? '' : 's'}`), h('div.small-note', null, 'Win streak'))),
      h('div.pips.streak', null, Array.from({ length: goal }, (_, i) => h('i' + (i < Math.min(goal, streak) ? '.on' : '')))),
      h('div.dl-prize', null, h('img', { src: hatIcon('headphones', 64), alt: '' }), h('span.small-note', null, streak >= goal ? `You earned ${HAT_BY_ID.headphones.name}!` : `Win ${goal} days in a row for ${HAT_BY_ID.headphones.name}.`)));

    // ---- play / done
    const play = won
      ? h('div.dl-done.note', null, ico('check', 64), h('div', null, h('b.marker', null, 'Done for today!'), h('div.small-note', null, `Next challenge in ${untilTomorrow()}.`)))
      : button([ico('menu_armory', 64), h('span', null, triedToday ? 'Try again' : 'Play today')], () => {
        if (!canPlay) { Audio.play('error'); replay(play, 'shake-no'); UI.toast('Today\'s challenge is not ready yet.', 'info', 1800); return; }
        App.startBattle({ kind: 'daily', date });
      }, 'big green' + (canPlay ? '' : ' poor'));

    el.append(
      header({ title: 'Daily', tone: 'green', onBack: () => App.goTitle(), right: [gold.el] }),
      h('div.sheet.plain.mode-sheet', null,
        h('div.mode-main', null, today, h('div.dl-actions', null, play,
          h('div.dl-reward.chip.gold.probe', { title: won ? 'Claimed today' : 'Prize for winning today' }, h('img.ico', { src: icon('gold', 48), alt: '' }), won ? 'Claimed' : '+' + reward),
          triedToday ? h('div.small-note.dl-tried', null, 'Not this time. Give it another go, the prize is still yours to win.') : null)),
        h('div.mode-side', null, streakCard)));
    onEsc(el, () => App.goTitle());
  },
  unmount(el) { dispose(el); },
});

// ---------------------------------------------------------------- endless
UI.register('endless_menu', {
  mount(el) {
    el.classList.add('menu-screen', 'daily-screen', 'endless-screen');
    const p = Save.data;
    const best = Math.max(p.endless.bestWave || 0, p.stats.endlessBest || 0);
    const gold = goldChip(el);
    const MARKS = [[10, null, 'Long Scroll'], [20, 'samurai', 'Endless Notebook'], [30, 'astronaut', 'Bottomless']];
    const track = h('div.eb-track', null, MARKS.map(([w, hat, name]) => h('div.eb-mark' + (best >= w ? '.got' : ''), null,
      h('div.eb-dot.marker', null, String(w)),
      hat ? h('img', { src: hatIcon(hat, 64), alt: '', title: HAT_BY_ID[hat].name }) : ico('star', 64),
      h('span', null, hat ? HAT_BY_ID[hat].name : name))));
    const start = button([ico('menu_endless', 64), h('span', null, 'Start run')], () => {
      if (!MODE_BUILDERS.endless) { Audio.play('error'); UI.toast('Endless is not ready yet.', 'info', 1600); return; }
      App.startBattle({ kind: 'endless' });
    }, 'big blue');
    el.append(
      header({ title: 'Endless', tone: 'blue', onBack: () => App.goTitle(), right: [gold.el] }),
      h('div.sheet.plain.mode-sheet', null,
        h('div.mode-main', null,
          h('div.dl-card.card.plain.grow', null,
            h('div.dl-head', null, h('div.mode-art', null, ico('menu_endless', 128)), h('div.dl-titles', null, h('div.dl-date.marker', null, 'The Endless Notebook'), h('div.small-note', null, 'How far can your army go?'))),
            h('div.dl-body', null,
              h('ul.eb-rules', null,
                h('li', null, 'Waves from every enemy army, each one bigger.'),
                h('li', null, 'Pick one of three perks between waves.'),
                h('li', null, 'A mini-boss every 5 waves, a boss every 10.'),
                h('li', null, 'Your fort heals a little after each wave.')),
              track)),
          h('div.dl-actions', null, start)),
        h('div.mode-side', null,
          h('div.dl-card.card.plain.dl-streak.grow.center-card', null,
            h('div.wave-ring', null, h('b.marker', null, best ? String(best) : '-'), h('span.marker', null, 'Best wave')),
            h('div.small-note', null, `${p.endless.runs || 0} run${(p.endless.runs || 0) === 1 ? '' : 's'} so far. Gold grows with every wave.`)))));
    onEsc(el, () => App.goTitle());
  },
  unmount(el) { dispose(el); },
});
