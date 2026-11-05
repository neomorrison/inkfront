// Title screen over the live AI-vs-AI demo battle. One obvious Play button; the rest of the
// menu opens up as the campaign does (progressive disclosure), locked entries show a hint.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { LEVEL_BY_ID } from '../../data/levels.js';
import { featureUnlocked, FEATURE_GATES, nextPlayableLevel, badgeCounts } from '../../game/progression.js';
import { ico, setBadge, goldChip, dispose, track } from './meta_ui.js';
import { icon } from '../../render/icons.js';
import './crate.js';

const TILES = [
  { id: 'endless', label: 'Endless', icon: 'menu_endless', tone: 'blue', go: () => App.go('endless_menu') },
  { id: 'daily', label: 'Daily', icon: 'menu_daily', tone: 'green', go: () => App.go('daily') },
  { id: 'armory', label: 'Armory', icon: 'menu_armory', tone: 'orange', go: () => App.go('armory') },
  { id: 'captain', label: 'Captain', icon: 'menu_captain', tone: 'pink', go: () => App.go('hero') },
  { id: 'achievements', label: 'Trophies', icon: 'menu_trophy', tone: 'yellow', go: () => App.go('achievements') },
];

function logo() {
  const word = h('h1.logo.marker', { 'aria-label': 'Inkfront', 'data-probe-skip': '' });
  [...'INKFRONT'].forEach((c, i) => word.append(h('span', { style: { animationDelay: i * 0.06 + 's' } }, c)));
  const squig = h('div');
  squig.innerHTML = '<svg class="squiggle" viewBox="0 0 300 16" preserveAspectRatio="none"><path d="M4 9 Q 28 -3 52 9 T 100 9 T 148 9 T 196 9 T 244 9 T 296 9" fill="none" stroke="#d1342b" stroke-width="6" stroke-linecap="round"/></svg>';
  return h('div.title-logo', null, word, squig.firstChild, h('div.tagline', null, 'A stick figure war fought in the margins.'));
}

UI.register('title', {
  mount(el) {
    el.classList.add('title-screen');
    const p = Save.data;
    const fresh = !Object.values(p.levels).some((l) => l.cleared);
    const next = nextPlayableLevel(p);
    const lv = LEVEL_BY_ID[next];

    // Play is the first button in the DOM on purpose: it is what the eye and the tab key find first.
    const play = button([
      ico('menu_campaign', 64),
      fresh ? h('span', null, 'Play') : h('span.col', null, h('span', null, 'Campaign'), h('small', null, `Next: ${next} ${lv.name}`)),
    ], () => App.goMap(), 'big green play');

    const badges = badgeCounts(p);
    const dock = h('div.dock');
    for (const t of TILES) {
      const open = featureUnlocked(p, t.id);
      const gate = FEATURE_GATES[t.id];
      const b = button([
        ico(t.icon, 96),
        h('span', null, t.label),
        open ? null : h('span.hint', null, gate.hint),
      ], () => {
        if (open) t.go();
        else { Audio.play('error'); UI.toast(`${t.label} opens when you ${gate.hint.toLowerCase()}.`, 'info', 2200); }
      }, `tile ${t.tone}${open ? '' : ' locked'}`, { 'data-tile': t.id });
      if (!open) b.append(ico('lock', 48, 'lockmark'));
      else if ((t.id === 'armory' && badges.armory) || (t.id === 'captain' && badges.hero) || (t.id === 'achievements' && badges.ach) || (t.id === 'daily' && badges.daily)) setBadge(b, true);
      dock.append(b);
    }

    const gold = goldChip(el);
    const right = h('div.title-corner.r', null, gold.el);
    if (p.crates > 0) {
      right.append(button([ico('crate', 48), h('span', null, 'Crate x' + p.crates)], () => UI.modal('crate'), 'small orange crate-btn'));
    }
    const gear = button(h('img', { src: icon('menu_settings', 64), alt: 'Settings' }), () => App.go('settings'), 'icon gear', { 'aria-label': 'Settings', title: 'Settings' });

    el.append(
      logo(),
      play,
      dock,
      h('div.title-corner.l', null, gear),
      right);
    track(el, () => {});
  },
  unmount(el) { dispose(el); },
});
