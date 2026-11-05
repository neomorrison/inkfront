// Pause menu (modal). OWNER: battle HUD builder (package I) adds settings toggles and the controls card.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';

UI.register('pause', {
  mount(el, { session }) {
    const card = h('div.pause-card.paper.tape', null,
      h('h1.marker', null, 'Paused'),
      h('div.col', null,
        button('Resume', () => session.togglePause(false), 'big green'),
        button('Restart', () => App.startBattle(session.opts), 'blue'),
        button('Give Up', () => session.surrender(), 'red'),
        button('Quit to Map', () => App.goMap(), 'white')));
    el.append(card);
  },
});
