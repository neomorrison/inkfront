// Supply crate modal: tap the crate, it shakes, the lid pops, a hat (or gold) is revealed.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { openCrate, equipHat } from '../../game/progression.js';
import { HAT_BY_ID } from '../../data/hats.js';
import { icon, hatIcon } from '../../render/icons.js';
import { later, dispose, sparks } from './meta_ui.js';

UI.register('crate', {
  mount(el) {
    el.classList.add('crate-layer');
    const p = Save.data;
    let opened = false;
    const stage = h('div.crate-stage');
    const rays = h('div.crate-rays', { 'data-probe-skip': '' });
    const src = icon('crate', 256);
    const lid = h('img.crate-lid', { src, alt: '' });
    const body = h('img.crate-body', { src, alt: '' });
    const box = h('button.crate-box', { 'aria-label': 'Open crate', onClick: () => open() }, h('div.crate-art', null, body, lid));
    const title = h('h2.marker.crate-title', null, 'Supply Crate');
    const sub = h('div.crate-sub', null, 'Tap to open!');
    const reveal = h('div.crate-reveal.hidden');
    const actions = h('div.crate-actions');
    const left = () => p.crates;

    function render() {
      sub.textContent = left() > 1 ? `Tap to open! ${left()} crates waiting.` : 'Tap to open!';
    }

    function showReward(r) {
      reveal.classList.remove('hidden');
      reveal.innerHTML = '';
      actions.innerHTML = '';
      if (r.type === 'hat') {
        const hat = HAT_BY_ID[r.id];
        reveal.append(
          h('div.reward-card.card.plain', null,
            h('div.reward-glow', { 'data-probe-skip': '' }),
            h('img.reward-img', { src: hatIcon(r.id, 192), alt: '' }),
            h('div.reward-name.marker', null, hat.name),
            h('div.reward-tag', null, 'New hat!')));
        actions.append(
          ...[button('Equip it', () => { equipHat(p, r.id); close(); }, 'green'), again(), button('Keep', () => close(), 'white')].filter(Boolean));
      } else {
        reveal.append(
          h('div.reward-card.card.plain', null,
            h('div.reward-glow', { 'data-probe-skip': '' }),
            h('img.reward-img', { src: icon('gold', 192), alt: '' }),
            h('div.reward-name.marker', null, '+' + r.amount + ' gold'),
            h('div.reward-tag', null, 'You own every crate hat!')));
        actions.append(...[again(), button('Nice!', () => close(), 'green')].filter(Boolean));
      }
      Audio.play('unlock');
    }
    function again() {
      return left() > 0 ? button('Open another', () => reset(), 'yellow') : null;
    }
    function reset() {
      opened = false;
      reveal.classList.add('hidden');
      actions.innerHTML = '';
      box.classList.remove('shaking', 'popped');
      title.textContent = 'Supply Crate';
      stage.classList.remove('done');
      render();
    }
    function close() {
      UI.closeModal('crate');
      if (UI.current && UI.current.name === 'title') UI.show('title');
    }
    function open() {
      if (opened || left() <= 0) return;
      opened = true;
      Audio.play('crate');
      box.classList.add('shaking');
      sub.textContent = '';
      later(el, () => {
        const r = openCrate(p);
        box.classList.remove('shaking');
        box.classList.add('popped');
        sparks(box, 18);
        Audio.play('whoosh');
        title.textContent = r && r.type === 'hat' ? 'A new hat!' : 'Bonus gold!';
        later(el, () => { stage.classList.add('done'); if (r) showReward(r); }, 520);
      }, 950);
    }

    stage.append(rays, title, box, sub, reveal, actions);
    el.append(stage, button('Close', () => close(), 'small white crate-x'));
    render();
    if (left() <= 0) { sub.textContent = 'No crates right now.'; }
  },
  unmount(el) { dispose(el); },
});
