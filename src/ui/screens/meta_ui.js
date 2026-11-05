// Shared pieces for the menu screens: header, tabs, chips, badges, floating numbers, count-ups.
// Everything here only builds DOM; styles live in css/screens.css.
import { h, button } from '../dom.js';
import { bus } from '../../core/events.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { icon } from '../../render/icons.js';
import { fmt } from '../../core/util.js';

export function ico(name, size = 64, cls = '') {
  return h('img.ico' + (cls ? '.' + cls : ''), { src: icon(name, size), alt: '', draggable: 'false' });
}

export function badgeEl(text = '!') {
  return h('div.badge', null, text);
}

// Set or clear the red "!" on a host element (buttons, tabs, tiles).
export function setBadge(host, on, text = '!') {
  let b = host.querySelector(':scope > .badge');
  if (on && !b) host.append(badgeEl(text));
  else if (on && b) b.textContent = text;
  else if (!on && b) b.remove();
}

// Cleanup registry per screen element: UI calls unmount(el), the screen runs dispose(el).
export function track(el, fn) {
  (el.__ds || (el.__ds = [])).push(fn);
  return fn;
}
export function dispose(el) {
  const list = el.__ds || [];
  el.__ds = [];
  for (const fn of list) { try { fn(); } catch (e) { console.error(e); } }
}
export function onBus(el, type, fn) {
  track(el, bus.on(type, fn));
}
export function later(el, fn, ms) {
  const id = setTimeout(fn, ms);
  track(el, () => clearTimeout(id));
  return id;
}

// Gold counter chip that follows the profile's gold and pops when it changes.
export function goldChip(el) {
  const num = h('b', null, fmt(Save.data.gold));
  const chip = h('div.chip.gold.probe', { title: 'Gold' }, h('img.ico', { src: icon('gold', 48), alt: '' }), num);
  let shown = Save.data.gold;
  let raf = 0;
  const set = (to) => {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 420);
      shown = Math.round(from + (to - from) * k);
      num.textContent = fmt(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  };
  if (el) {
    onBus(el, 'gold', (e) => set(e.total));
    track(el, () => cancelAnimationFrame(raf));
  }
  return { el: chip, set };
}

// Screen header: Back button, ribbon title, right-side extras.
export function header({ title, tone = 'yellow', onBack, backLabel = 'Back', right = [] }) {
  const back = onBack ? button([ico('arrow_left', 32), h('span', null, backLabel)], onBack, 'small blue back') : null;
  return h('div.mh', null,
    back,
    h('h1.mh-title.marker.' + tone, null, title),
    h('div.mh-right', null, right));
}

// Notebook divider tabs. tabs: [{ id, label, tone, badge, locked }].
export function tabBar(tabs, active, onPick) {
  const row = h('div.tab-row');
  const btns = {};
  for (const t of tabs) {
    const b = h('button.tab.' + (t.tone || 'blue') + (t.locked ? '.locked' : ''), {
      onClick: () => {
        if (t.locked) { Audio.play('error'); if (t.onLocked) t.onLocked(); return; }
        Audio.play('tab');
        onPick(t.id, t);
      },
    }, t.locked ? ico('lock', 32) : t.icon ? ico(t.icon, 32) : null, h('span', null, t.label));
    if (t.badge) b.append(badgeEl());
    btns[t.id] = b;
    row.append(b);
  }
  const api = {
    el: row,
    set(id) { for (const k in btns) btns[k].classList.toggle('active', k === id); },
    badge(id, on) { setBadge(btns[id], on); },
  };
  api.set(active);
  return api;
}

// Floating "+123" style number that rises from an element and fades.
export function floatText(anchor, text, cls = '') {
  const host = document.getElementById('ui');
  if (!host || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const el = h('div.float-text.marker' + (cls ? '.' + cls : ''), { style: { left: r.left - hr.left + r.width / 2 + 'px', top: r.top - hr.top + r.height * 0.3 + 'px' } }, text);
  host.append(el);
  setTimeout(() => el.remove(), 1100);
}

// A little pop of paper confetti dots around an element.
export function sparks(anchor, n = 10, colors = ['#f2b01e', '#ff9cc6', '#93d1ff', '#a6ee9a', '#fff']) {
  const host = document.getElementById('ui');
  if (!host || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const cx = r.left - hr.left + r.width / 2, cy = r.top - hr.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = 40 + Math.random() * 50;
    const s = 6 + Math.random() * 7;
    const el = h('i.spark', { style: { left: cx + 'px', top: cy + 'px', width: s + 'px', height: s + 'px', background: colors[i % colors.length], '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px' } });
    host.append(el);
    setTimeout(() => el.remove(), 760);
  }
}

// Restarts a CSS animation class on an element.
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Counts a number up in `ms`. Returns a cancel function. onTick(value, k).
export function countUp(from, to, ms, onTick, onDone) {
  let raf = 0, dead = false;
  const t0 = performance.now();
  const step = (now) => {
    if (dead) return;
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    onTick(Math.round(from + (to - from) * e), k);
    if (k < 1) raf = requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  raf = requestAnimationFrame(step);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

export function starRow(n, total = 3, size = 40) {
  const row = h('div.star-row');
  for (let i = 0; i < total; i++) row.append(h('img', { src: icon(i < n ? 'star' : 'star_empty', size * 2), alt: '', style: { width: size + 'px', height: size + 'px' } }));
  return row;
}

// Level pips: filled up to `n` of `max`.
export function pips(n, max, cls = '') {
  const row = h('div.pips' + (cls ? '.' + cls : ''));
  for (let i = 0; i < max; i++) row.append(h('i' + (i < n ? '.on' : '')));
  return row;
}

export function scrollArea(cls, ...kids) {
  return h('div.scroll' + (cls ? '.' + cls : ''), null, ...kids);
}
