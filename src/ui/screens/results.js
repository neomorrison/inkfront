// Victory/defeat screen. OWNER: meta UI builder (package H) adds the stamp animation, count-ups,
// XP bar, unlock reveals, crates and achievement toasts.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';
import { nextLevelId } from '../../data/levels.js';
import { UNITS } from '../../data/units.js';
import { SPELLS } from '../../data/spells.js';
import { icon, unitIcon } from '../../render/icons.js';
import { fmtTime } from '../../core/util.js';

UI.register('results', {
  mount(el, { session, summary }) {
    el.classList.add('results-screen');
    const win = summary.win;
    const card = h('div.results-card.paper.tape');
    card.append(h('h1.marker.' + (win ? 'win' : 'lose'), null, win ? 'Page Cleared!' : 'Page Lost'));
    if (summary.kind === 'campaign') {
      card.append(h('div.stars.big', null, [0, 1, 2].map((i) => h('img', { src: icon(i < summary.stars ? 'star' : 'star_empty'), alt: '' }))));
    }
    const st = summary.stats;
    card.append(h('div.results-stats', null,
      h('div', null, h('b', null, String(st.kills)), ' enemies defeated'),
      h('div', null, h('b', null, String(Math.round(st.inkGathered))), ' ink gathered'),
      h('div', null, h('b', null, fmtTime(summary.time)), ' battle time')));
    card.append(h('div.results-rewards', null,
      h('div.chip.gold', null, h('img', { src: icon('gold'), alt: '' }), '+' + summary.gold),
      h('div.chip', null, '+' + summary.xp + ' XP'),
      summary.heroLevelUps ? h('div.chip', null, 'Captain level up!') : null));
    for (const u of summary.unlocks) {
      let label = '', img = null;
      if (u.type === 'unit') { label = 'New unit: ' + UNITS[u.id].name; img = unitIcon(u.id); }
      else if (u.type === 'spell') { label = 'New spell: ' + SPELLS[u.id].name; img = icon('spell_' + u.id); }
      else if (u.type === 'hat') { label = 'New hat!'; }
      else if (u.type === 'mode') { label = 'Red Ink mode unlocked!'; }
      card.append(h('div.unlock.note', null, img ? h('img', { src: img, alt: '' }) : null, h('span', null, label)));
    }
    const next = session.opts.kind === 'campaign' ? nextLevelId(session.opts.levelId) : null;
    const btns = h('div.results-buttons');
    if (win && next) btns.append(button('Next Level', () => App.startBattle({ kind: 'campaign', levelId: next }), 'big green'));
    if (!win) btns.append(button('Try Again', () => App.startBattle(session.opts), 'big'));
    btns.append(button('Map', () => App.goMap(), 'blue'));
    card.append(btns);
    el.append(card);
  },
});
