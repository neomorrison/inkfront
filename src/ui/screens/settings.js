// Settings: sound, game options, save export/import/reset, controls help.
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { setArmyHats } from '../../game/progression.js';
import { header, tabBar, dispose, replay, onEsc } from './meta_ui.js';

// Small confirm modal used for destructive actions.
UI.register('confirm', {
  mount(el, { title, text, yes = 'Yes', no = 'Cancel', onYes }) {
    el.append(h('div.confirm-card.sheet.plain', null,
      h('h2.marker', null, title),
      h('div.confirm-text', null, text),
      h('div.confirm-buttons', null,
        button(no, () => UI.closeModal('confirm'), 'white'),
        button(yes, () => { UI.closeModal('confirm'); onYes && onYes(); }, 'red'))));
  },
});

const KEYS = [
  ['1-0, -', 'Draw a unit (the key on its card)'], ['Z X C', 'Aim a supply, then click'], ['W', 'Charge'], ['S', 'Defend'], ['F', 'Hold a flag at the Captain'],
  ['A D', 'Walk the Captain'], ['Q', 'Rally Cry'], ['E', 'Ink Slam'], ['R', 'Inkstorm'], ['Space', 'Follow the Captain'], ['T', 'Speed 1x / 2x'], ['Esc', 'Pause'],
];
const TOUCH = [
  ['Tap a card', 'Draw that unit'], ['Tap a supply', 'Then tap the battlefield'], ['Drag', 'Slide the camera'], ['Hold', 'Plant a flag for HOLD'],
  ['Arrows', 'Walk the Captain'], ['Stance buttons', 'Defend, Hold, Charge'], ['2x button', 'Double speed'],
];
const MOUSE = [['Drag', 'Slide the camera'], ['Right click', 'Plant a flag'], ['Right click a card', 'Take one back'], ['Minimap', 'Jump the camera']];

function slider(label, value, onInput, onDone) {
  const out = h('b.marker.sl-val', null, Math.round(value * 100) + '%');
  const input = h('input.slider', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(value * 100)), 'aria-label': label });
  const paint = () => { input.style.setProperty('--fill', input.value + '%'); out.textContent = input.value + '%'; };
  input.addEventListener('input', () => { paint(); onInput(+input.value / 100); });
  input.addEventListener('change', () => onDone && onDone());
  paint();
  return h('div.set-row.probe', null, h('span.set-l', null, label), h('div.sl-wrap', null, input), out);
}

function toggle(label, on, onChange, hint) {
  const b = h('button.switch' + (on ? '.on' : ''), { role: 'switch', 'aria-checked': String(!!on), 'aria-label': label,
    onClick: () => {
      const v = !b.classList.contains('on');
      b.classList.toggle('on', v);
      b.setAttribute('aria-checked', String(v));
      Audio.play('toggle');
      onChange(v);
    } }, h('i'), h('span', null, on ? 'ON' : 'OFF'));
  const sync = () => { b.querySelector('span').textContent = b.classList.contains('on') ? 'ON' : 'OFF'; };
  b.addEventListener('click', sync);
  return h('div.set-row.probe', null, h('span.set-l', null, label, hint ? h('small', null, hint) : null), b);
}

UI.register('settings', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'settings-screen');
    const p = Save.data;
    const s = p.settings;
    let tab = ['opts', 'save', 'controls'].includes(params.tab) ? params.tab : 'opts';
    const body = h('div.set-body.scroll');
    const tabs = tabBar([
      { id: 'opts', label: 'Options', tone: 'blue', icon: 'menu_settings' },
      { id: 'save', label: 'Save', tone: 'green', icon: 'check' },
      { id: 'controls', label: 'Controls', tone: 'yellow', icon: 'sword' },
    ], tab, (id) => { tab = id; draw(); });

    const apply = () => { Save.save(); App.applySettings(); };

    function drawOpts() {
      const card = h('div.set-card.card.plain', null,
        h('h3.marker', null, 'Sound'),
        slider('Music', s.music, (v) => { s.music = v; App.applySettings(); }, () => Save.save()),
        slider('Sound effects', s.sfx, (v) => { s.sfx = v; App.applySettings(); }, () => { Save.save(); Audio.play('coin'); }));
      const game = h('div.set-card.card.plain', null,
        h('h3.marker', null, 'Game'),
        toggle('Screen shake', s.shake, (v) => { s.shake = v; apply(); }),
        toggle('Damage numbers', s.numbers, (v) => { s.numbers = v; apply(); }),
        toggle('Army hats', s.armyHats, (v) => { setArmyHats(p, v); apply(); }, 'Every unit wears your Captain hat'),
        h('div.set-row.probe', null, h('span.set-l', null, 'Quality', h('small', null, 'Low skips some effects')),
          h('div.seg', null, ['low', 'high'].map((q) => h('button.seg-b' + (s.quality === q ? '.on' : ''), {
            onClick: () => { s.quality = q; apply(); Audio.play('toggle'); draw(); },
          }, q === 'low' ? 'Low' : 'High')))));
      body.append(card, game);
    }

    function drawSave() {
      const out = h('textarea.code', { readonly: true, rows: '3', placeholder: 'Press Make code', spellcheck: 'false' });
      const msg = h('div.set-msg', null, '');
      const copyBtn = button('Copy code', async () => {
        out.value = Save.exportCode();
        out.select();
        let ok = false;
        try { await navigator.clipboard.writeText(out.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
        msg.className = 'set-msg good';
        msg.textContent = ok ? 'Copied! Keep it somewhere safe.' : 'Code is ready. Select it and copy.';
        Audio.play('coin');
      }, 'green');
      const inp = h('textarea.code', { rows: '3', placeholder: 'Paste a save code here', spellcheck: 'false', 'aria-label': 'Save code to import' });
      const loadBtn = button('Load code', () => {
        try {
          Save.importCode(inp.value);
          App.applySettings();
          Audio.play('unlock');
          UI.toast('Save loaded!', 'good', 1800);
          App.goTitle();
        } catch (e) {
          msg2.className = 'set-msg bad';
          msg2.textContent = e.message || 'That code did not work.';
          Audio.play('error'); replay(inp, 'shake-no');
        }
      }, 'blue');
      const msg2 = h('div.set-msg', null, '');
      const reset = button('Reset save', () => UI.modal('confirm', {
        title: 'Erase everything?', text: 'Your stars, gold, units and Captain will be gone for good.', yes: 'Erase it', no: 'Keep my save',
        onYes: () => { Save.reset(); App.applySettings(); UI.toast('Fresh notebook!', 'info', 1600); App.goTitle(); },
      }), 'red');
      body.append(
        h('div.set-card.card.plain', null, h('h3.marker', null, 'Save code'),
          h('div.small-note', null, 'Move your progress to another browser or device.'), out, h('div.set-actions', null, copyBtn, msg)),
        h('div.set-card.card.plain', null, h('h3.marker', null, 'Load a code'), inp, h('div.set-actions', null, loadBtn, msg2)),
        h('div.set-card.card.plain.danger', null, h('h3.marker', null, 'Danger zone'), h('div.small-note', null, 'This starts a brand new save.'), h('div.set-actions', null, reset)));
    }

    function drawControls() {
      const list = (rows, cls) => h('div.keys.' + cls, null, rows.map(([k, d]) => h('div.key-row', null,
        h('span.keycaps', null, k.split(' ').map((c) => h('kbd', null, c))), h('span', null, d))));
      body.append(
        h('div.set-card.card.plain', null, h('h3.marker', null, 'Keyboard'), list(KEYS, 'k')),
        h('div.set-card.card.plain', null, h('h3.marker', null, 'Touch'), list(TOUCH, 't'), h('h3.marker.sub', null, 'Mouse'), list(MOUSE, 'm')));
    }

    function draw() {
      tabs.set(tab);
      clear(body);
      body.className = 'set-body scroll ' + tab;
      if (tab === 'opts') drawOpts(); else if (tab === 'save') drawSave(); else drawControls();
    }

    el.append(
      header({ title: 'Settings', tone: 'blue', onBack: () => App.goTitle() }),
      tabs.el,
      h('div.sheet.plain.set-sheet', null, body));
    draw();
    onEsc(el, () => App.goTitle());
  },
  unmount(el) { Save.save(); dispose(el); },
});
