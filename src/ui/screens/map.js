// Campaign map: chapters and levels. OWNER: meta UI builder (package H) replaces this simple
// version with the drawn notebook map and routes level clicks through the loadout screen.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { LEVELS } from '../../data/levels.js';
import { CHAPTERS } from '../../data/pages.js';
import { isLevelUnlocked } from '../../game/progression.js';
import { icon } from '../../render/icons.js';

UI.register('map', {
  mount(el) {
    el.classList.add('paper-bg', 'map-screen');
    const p = Save.data;
    const body = h('div.map-body');
    for (const ch of CHAPTERS) {
      const row = h('div.map-chapter');
      row.append(h('h2.marker', null, ch.name));
      const list = h('div.map-levels');
      for (const lv of LEVELS.filter((l) => l.chapter === ch.n)) {
        const rec = p.levels[lv.id] || {};
        const open = isLevelUnlocked(p, lv.id);
        const stars = h('div.stars', null, [0, 1, 2].map((i) => h('img', { src: icon(i < (rec.stars || 0) ? 'star' : 'star_empty'), alt: '' })));
        const b = button(h('span.col', null, h('b', null, lv.id), h('small', null, lv.name), stars), () => App.startBattle({ kind: 'campaign', levelId: lv.id }), open ? (lv.boss ? 'pink' : 'white') : 'white disabled');
        list.append(b);
      }
      row.append(list);
      body.append(row);
    }
    el.append(h('div.map-top', null, button('Back', () => App.goTitle(), 'small blue'), h('div.chip.gold', null, h('img', { src: icon('gold'), alt: '' }), String(p.gold))), body);
  },
});
