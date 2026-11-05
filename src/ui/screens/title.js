// Title screen over a live AI-vs-AI demo battle. OWNER: meta UI builder (package H) polishes it
// and adds Endless, Daily, Armory, Hero, Achievements and Settings entry points.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';

UI.register('title', {
  mount(el) {
    el.classList.add('title-screen');
    el.append(
      h('div.title-card', null,
        h('h1.logo.marker', null, 'INKFRONT'),
        h('div.tagline', null, 'A stick figure war fought in the margins.'),
        h('div.title-buttons', null,
          button('Play', () => App.goMap(), 'big'),
        ),
      ),
    );
  },
});
