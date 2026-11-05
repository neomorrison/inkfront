// Screen manager. A screen is { mount(el, params) -> api?, unmount?(el), update?(dt, el) }.
// show() swaps the base screen; modal() stacks an overlay (pause, confirm, draft) on top.
import { bus } from '../core/events.js';

export const UI = {
  root: null,
  screens: {},
  current: null,
  modals: [],
  toastLayer: null,

  init(root) {
    this.root = root;
    this.toastLayer = document.createElement('div');
    this.toastLayer.className = 'toast-layer';
    root.appendChild(this.toastLayer);
  },

  register(name, def) {
    this.screens[name] = def;
  },

  show(name, params = {}) {
    this.closeAllModals();
    if (this.current) {
      try { this.current.def.unmount?.(this.current.el); } catch (e) { console.error(e); }
      this.current.el.remove();
    }
    const def = this.screens[name];
    if (!def) throw new Error('No screen ' + name);
    const el = document.createElement('div');
    el.className = 'screen screen-' + name;
    this.root.insertBefore(el, this.toastLayer);
    const api = def.mount(el, params) || {};
    this.current = { name, def, el, api };
    bus.emit('screen', { name, params });
    return api;
  },

  modal(name, params = {}) {
    const def = this.screens[name];
    if (!def) throw new Error('No screen ' + name);
    const layer = document.createElement('div');
    layer.className = 'modal-layer modal-' + name;
    this.root.insertBefore(layer, this.toastLayer);
    const api = def.mount(layer, params) || {};
    const m = { name, def, el: layer, api };
    this.modals.push(m);
    bus.emit('modal', { name, params });
    return api;
  },

  closeModal(name) {
    const i = name ? this.modals.findIndex((m) => m.name === name) : this.modals.length - 1;
    if (i < 0) return;
    const [m] = this.modals.splice(i, 1);
    try { m.def.unmount?.(m.el); } catch (e) { console.error(e); }
    m.el.remove();
    bus.emit('modalClosed', { name: m.name });
  },

  closeAllModals() {
    while (this.modals.length) this.closeModal();
  },

  hasModal(name) {
    return name ? this.modals.some((m) => m.name === name) : this.modals.length > 0;
  },

  update(dt) {
    if (this.current && this.current.def.update) this.current.def.update(dt, this.current.el);
    for (const m of this.modals) if (m.def.update) m.def.update(dt, m.el);
  },

  // Short message near the top. kind: 'info' | 'good' | 'bad'
  toast(html, kind = 'info', ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast note toast-' + kind;
    el.innerHTML = html;
    this.toastLayer.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, ms);
    setTimeout(() => el.remove(), ms + 350);
  },
};
