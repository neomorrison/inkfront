// Achievements grid (progress bars and rewards) and the lifetime stats panel.
import { UI } from '../ui.js';
import { h, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { ACHIEVEMENTS, STAT_LABELS } from '../../data/achievements.js';
import { HAT_BY_ID, HATS } from '../../data/hats.js';
import { LEVELS } from '../../data/levels.js';
import { PLAYER_ROSTER } from '../../data/units.js';
import { SPELL_ORDER } from '../../data/spells.js';
import { achievementProgress, achievementCounts, statValue } from '../../game/achievements.js';
import { campaignStars } from '../../game/progression.js';
import { icon, hatIcon } from '../../render/icons.js';
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
import { ico, header, tabBar, goldChip, dispose } from './meta_ui.js';

function fmtPlay(sec) {
  const m = Math.floor(sec / 60), hr = Math.floor(m / 60);
  return hr ? `${hr}h ${m % 60}m` : `${m}m`;
}

UI.register('achievements', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'ach-screen');
    const p = Save.data;
    let tab = params.tab === 'stats' ? 'stats' : 'ach';
    const gold = goldChip(el);
    const counts = achievementCounts(p);
    const body = h('div.ach-body');
    const tabs = tabBar([
      { id: 'ach', label: `Achievements ${counts.done}/${counts.total}`, tone: 'yellow', icon: 'menu_trophy' },
      { id: 'stats', label: 'Stats', tone: 'blue', icon: 'ach_clock' },
    ], tab, (id) => { tab = id; draw(); });

    function drawAch() {
      const rows = ACHIEVEMENTS.map((a) => ({ a, pr: achievementProgress(p, a) }));
      rows.sort((x, y) => (x.pr.done - y.pr.done) || (y.pr.pct - x.pr.pct));
      const grid = h('div.ach-grid.scroll');
      for (const { a, pr } of rows) {
        const isNew = p.seen['ach.' + a.id] === false;
        const card = h('div.ach.card.plain' + (pr.done ? '.done' : ''), { 'data-ach': a.id },
          h('img.ach-icon' + (pr.done ? '' : '.dim'), { src: icon('ach_' + a.icon, 128), alt: '' }),
          h('div.ach-main', null,
            h('div.ach-name.marker', null, a.name),
            h('div.ach-desc', null, a.desc),
            pr.done
              ? h('div.ach-done.marker', null, ico('check', 32), 'Done!')
              : h('div.ach-prog', null, h('div.bar.gold', null, h('i', { style: { width: Math.max(2, pr.pct * 100) + '%' } })), h('span', null, `${fmt(pr.value)}/${fmt(pr.goal)}`))),
          h('div.ach-rew', null,
            a.gold ? h('span.pill.yellow', null, h('img', { src: icon('gold', 32), alt: '' }), '+' + fmt(a.gold)) : null,
            a.hat ? h('img.ach-hat', { src: hatIcon(a.hat, 64), alt: '', title: HAT_BY_ID[a.hat].name }) : null));
        if (isNew) card.append(h('div.badge', null, '!'));
        grid.append(card);
      }
      body.append(grid);
    }

    function drawStats() {
      const panel = h('div.stats-panel.scroll');
      const stars = campaignStars(p);
      const hats = p.hats.filter((x) => x !== 'none').length;
      const cards = [
        ['Campaign stars', `${stars}/${LEVELS.length * 3}`, 'star'],
        ['Hats', `${hats}/${HATS.length - 1}`, 'menu_captain'],
        ['Units', `${p.unlockedUnits.length}/${PLAYER_ROSTER.length}`, 'menu_armory'],
        ['Supplies', `${p.unlockedSpells.length}/${SPELL_ORDER.length}`, 'spell_pencil_rain'],
        ['Captain level', String(p.hero.level), 'sword'],
        ['Achievements', `${counts.done}/${counts.total}`, 'menu_trophy'],
      ];
      panel.append(h('div.big-stats', null, cards.map(([l, v, i]) => h('div.big-stat.card.plain.probe', null, ico(i, 64), h('b.marker', null, v), h('span', null, l)))));
      const list = h('div.stat-list.card.plain');
      for (const [key, label] of STAT_LABELS) {
        let v = statValue(p, key);
        if (key === 'playTime') v = fmtPlay(v); else v = fmt(v);
        list.append(h('div.stat-line', null, h('span', null, label), h('i'), h('b.marker', null, String(v))));
      }
      panel.append(list);
      body.append(panel);
    }

    function draw() {
      tabs.set(tab);
      clear(body);
      if (tab === 'ach') drawAch(); else drawStats();
    }

    el.append(
      header({ title: 'Trophies', tone: 'yellow', onBack: () => App.goTitle(), right: [gold.el] }),
      tabs.el,
      h('div.sheet.plain.ach-sheet', null, body));
    draw();
  },
  unmount(el) {
    // Viewing clears the red "!" on new achievements.
    const p = Save.data;
    let changed = false;
    for (const k in p.seen) if (k.startsWith('ach.') && p.seen[k] === false) { p.seen[k] = true; changed = true; }
    if (changed) Save.save();
    dispose(el);
  },
});
