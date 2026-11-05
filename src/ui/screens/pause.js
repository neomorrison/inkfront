// Pause menu and the "how to play" card (both modals). OWNER: HUD package (I).
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';

const KEYBOARD = [
  ['1 - 9', 'Draw a unit (right-click a card to cancel one)'],
  ['W / S / F', 'Charge / Defend / Hold at a flag'],
  ['A / D', 'Walk the Captain (or scroll if he is down)'],
  ['Q E R', 'Captain abilities'],
  ['Z X C', 'Cast a spell at the pointer'],
  ['Space', 'Center the camera on the Captain'],
  ['V', 'Camera: Follow or Free'],
  ['T', 'Normal or double speed'],
  ['Esc', 'Pause'],
  ['Mouse', 'Drag or wheel to scroll. Right-click plants a flag.'],
];
const TOUCH = [
  ['Cards', 'Tap to draw a unit'],
  ['Arrows', 'Hold to walk the Captain'],
  ['Stances', 'Defend, Hold (then tap the field), Charge'],
  ['Long-press', 'Hold a spot on the field to plant a flag'],
  ['Spells', 'Tap the spell, then tap the battlefield'],
  ['Drag', 'Scroll the battlefield, or tap the minimap'],
  ['Camera', 'Follow tracks the action. Free stays put.'],
];

// Settings live in the save: music/sfx are volumes, shake is a flag. A toggle remembers the last volume.
function toggleSetting(key) {
  const st = Save.data.settings;
  if (key === 'shake') st.shake = !st.shake;
  else {
    const last = key + 'Last';
    if (st[key] > 0) { st[last] = st[key]; st[key] = 0; } else st[key] = st[last] || (key === 'music' ? 0.55 : 0.8);
  }
  Save.save();
  App.applySettings();
}
const isOn = (key) => (key === 'shake' ? !!Save.data.settings.shake : Save.data.settings[key] > 0);

UI.register('pause', {
  mount(el, { session }) {
    el.classList.add('pause-layer');
    let tab = session.hud && session.hud.touch ? 'touch' : 'keys';
    const controls = h('dl.pause-controls');
    const tabs = h('div.tabs');
    const fillControls = () => {
      clear(controls);
      for (const [k, v] of tab === 'keys' ? KEYBOARD : TOUCH) controls.append(h('dt', null, k), h('dd', null, v));
      clear(tabs);
      tabs.append(
        button('Keyboard', () => { tab = 'keys'; fillControls(); }, 'white' + (tab === 'keys' ? ' on' : '')),
        button('Touch', () => { tab = 'touch'; fillControls(); }, 'white' + (tab === 'touch' ? ' on' : '')));
    };
    fillControls();

    const toggles = h('div.pause-toggles');
    const fillToggles = () => {
      clear(toggles);
      for (const [key, label] of [['music', 'Music'], ['sfx', 'Sound'], ['shake', 'Shake']]) {
        const on = isOn(key);
        toggles.append(button(label + (on ? ': On' : ': Off'), () => { toggleSetting(key); fillToggles(); }, 'white' + (on ? '' : ' off')));
      }
    };
    fillToggles();

    let giveUpArmed = 0;
    const giveUp = button('Give Up', () => {
      if (!giveUpArmed) {
        giveUpArmed = setTimeout(() => { giveUpArmed = 0; giveUp.firstChild.textContent = 'Give Up'; }, 3000);
        giveUp.firstChild.textContent = 'Really give up?';
        return;
      }
      clearTimeout(giveUpArmed);
      session.surrender();
    }, 'red');

    const card = h('div.pause-card.paper.tape', null,
      h('h1.marker', null, 'Paused'),
      h('div.pause-body', null,
        h('div.pause-left', null,
          h('div.pause-main', null,
            button('Resume', () => session.togglePause(false), 'big green wide'),
            button('Restart', () => App.startBattle(session.opts), 'blue'),
            button('How to Play', () => UI.modal('howto', { session }), 'yellow'),
            giveUp,
            button('Quit to Map', () => App.goMap(), 'white')),
          toggles),
        h('div.pause-right', null, tabs, controls)));
    el.append(card);
    // Esc / P resume. Closing happens on keydown; Input swallows the matching press on resume.
    const onKey = (e) => {
      if (UI.hasModal('howto')) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); session.togglePause(false); }
    };
    window.addEventListener('keydown', onKey);
    el.__off = () => window.removeEventListener('keydown', onKey);
  },
  unmount(el) { el.__off && el.__off(); },
});

// The "how to play" card body, shared by the pause menu modal and the first-battle quick card.
export function howtoCard(touch, label, onDone) {
  const item = (n, text) => h('li', null, h('b', null, n), h('span', null, text));
  return h('div.howto-card.paper.tape', null,
    h('h1.marker', null, 'How to Play'),
    h('ul.howto-list', null,
      item('1', touch ? 'Tap a card to draw a unit. It costs ink.' : 'Click a card or press 1-9 to draw a unit.'),
      item('2', 'Scribes carry ink home. Draw them first.'),
      item('3', 'Charge attacks the fort. Defend holds near yours.'),
      item('4', touch ? 'Hold the arrows to walk your Captain.' : 'Walk your Captain with A and D.'),
      item('5', touch ? 'Tap a spell, then tap the field.' : 'Press Z, X or C to cast a spell.'),
      item('6', 'Destroy the enemy fort to win.')),
    button(label, onDone, 'big green'));
}

export function markHowtoSeen() {
  try { Save.data.seen.howto = true; Save.save(); } catch (e) { /* storage may be blocked */ }
}

// From the pause menu: a modal on top of the pause card.
UI.register('howto', {
  mount(el, { session }) {
    const done = () => { markHowtoSeen(); UI.closeModal('howto'); };
    el.append(howtoCard(session.hud && session.hud.touch, 'Got it', done));
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); done(); }
    };
    window.addEventListener('keydown', onKey, true);
    el.__off = () => window.removeEventListener('keydown', onKey, true);
  },
  unmount(el) { el.__off && el.__off(); },
});
