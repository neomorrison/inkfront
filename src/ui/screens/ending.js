// The ending: a scribbled "The End" notebook page shown once, right after the Hand falls and
// before the results. Skippable (Skip button, Esc, or Enter once it is all on the page).
// Opened as a modal: UI.modal('ending', { onDone }).
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { Audio } from '../../audio/audio.js';
import { icon } from '../../render/icons.js';
import { later, track, dispose, sparks, replay } from './meta_ui.js';

const LINES = [
  'The Hand set the pencil down.',
  'The margin is safe, and the page is yours again.',
  'Every last ink figure cheered, even the Scribes.',
];

// Hand-drawn little scene: the pencil lying still, the army with its arms up.
function sceneSvg() {
  const fig = (x, i, tall) => {
    const top = tall ? 56 : 64;
    return `<g class="end-fig" style="animation-delay:${(i * 0.17).toFixed(2)}s">
      <circle cx="${x}" cy="${top}" r="8"/>
      <path d="M${x} ${top + 8} L${x} ${top + 36} M${x} ${top + 36} L${x - 9} 124 M${x} ${top + 36} L${x + 9} 124 M${x} ${top + 17} L${x - 14} ${top - 4} M${x} ${top + 17} L${x + 14} ${top - 4}"/>
      ${tall ? `<path class="cape" d="M${x} ${top + 12} Q${x - 18} ${top + 26} ${x - 14} ${top + 40}"/>` : ''}
    </g>`;
  };
  return `<svg class="end-scene" viewBox="0 0 440 150" aria-hidden="true" data-probe-skip>
    <path class="ground" d="M8 126 Q58 120 108 127 T208 125 T308 128 T432 124"/>
    <g class="pencil" transform="rotate(-3 90 108)">
      <path d="M22 112 L50 98 L50 124 Z" fill="#f3d9a6"/>
      <path d="M22 112 L33 106.6 L33 117.4 Z" fill="#3a3a48"/>
      <rect x="50" y="98" width="104" height="26" fill="#ffd54a"/>
      <path d="M50 108 H154 M50 114 H154" class="thin"/>
      <rect x="154" y="98" width="14" height="26" fill="#c9ccd6"/>
      <rect x="168" y="98" width="20" height="26" rx="6" fill="#ff8fb4"/>
    </g>
    <path class="margin" d="M206 8 L206 132"/>
    ${[250, 292, 334, 376, 414].map((x, i) => fig(x, i, i === 2)).join('')}
    <path class="spark" d="M226 22 l6 -10 M246 14 l0 -12 M268 20 l10 -8 M330 10 l0 -10 M356 18 l8 -9 M392 14 l0 -12 M418 24 l9 -7"/>
  </svg>`;
}

UI.register('ending', {
  mount(el, { onDone } = {}) {
    el.classList.add('end-layer');
    let closed = false;
    let revealed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      if (onDone) onDone(); else UI.closeModal('ending');
    };

    const title = h('h1.end-title.marker', null, h('span', null, 'The End'));
    const squig = h('div');
    squig.innerHTML = '<svg class="end-squig" viewBox="0 0 300 16" preserveAspectRatio="none" data-probe-skip><path d="M4 9 Q 28 -3 52 9 T 100 9 T 148 9 T 196 9 T 244 9 T 296 9" fill="none" stroke="#d1342b" stroke-width="6" stroke-linecap="round"/></svg>';
    const scene = h('div.end-scene-wrap.pre');
    scene.innerHTML = sceneSvg();
    const lines = LINES.map((t) => h('p.end-line.pre', null, t));
    const thanks = h('div.end-thanks.marker.pre', null, 'Thanks for playing!');
    const chips = h('div.end-next.pre', null,
      h('div.end-chip.note.probe', null, h('img', { src: icon('pen_red', 64), alt: '' }), h('div', null, h('b.marker', null, 'Red Ink mode is open'), h('span', null, 'Replay every level, tougher.'))),
      h('div.end-chip.note.blue.probe', null, h('img', { src: icon('menu_endless', 64), alt: '' }), h('div', null, h('b.marker', null, 'The Endless Notebook'), h('span', null, 'See how far your army can go.'))));
    const cont = button('Continue', done, 'big green end-go pre');
    const skip = button('Skip', done, 'small white end-skip');

    const card = h('div.end-card.tape', { onClick: (e) => { if (e.target.closest('button')) return; showAll(); } },
      skip,
      h('div.end-head', null, title, squig.firstChild),
      scene,
      h('div.end-lines', null, lines),
      thanks, chips, cont);
    el.append(card);

    const reveal = (node) => {
      if (revealed) return; // skipped ahead: everything is already on the page
      node.classList.remove('pre');
      replay(node, 'end-in');
    };
    function showAll() {
      if (revealed) return;
      revealed = true;
      title.classList.add('in');
      for (const n of [scene, ...lines, thanks, chips, cont]) n.classList.remove('pre');
    }

    // The show: title stamps, then the story one line at a time.
    later(el, () => { title.classList.add('in'); Audio.play('stamp'); sparks(title, 8, ['#93d1ff', '#fff', '#ffd54a']); }, 250);
    later(el, () => reveal(scene), 900);
    lines.forEach((ln, i) => later(el, () => reveal(ln), 1500 + i * 1300));
    later(el, () => { reveal(thanks); Audio.play('levelup'); }, 1500 + LINES.length * 1300);
    later(el, () => { reveal(chips); Audio.play('unlock'); }, 1500 + LINES.length * 1300 + 600);
    later(el, () => { reveal(cont); revealed = true; }, 1500 + LINES.length * 1300 + 1000);

    const key = (e) => {
      if (!['Escape', 'Enter', 'Space'].includes(e.code) || !document.body.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' || (revealed && !cont.classList.contains('pre'))) done();
      else showAll();
    };
    document.addEventListener('keydown', key, true);
    track(el, () => document.removeEventListener('keydown', key, true));
  },
  unmount(el) { dispose(el); },
});
