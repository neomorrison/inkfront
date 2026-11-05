import { Audio } from '../audio/audio.js';

// h('div.class1.class2', { attrs, onClick, style: {...}, text, html }, ...children)
export function h(tag, props, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// Button that plays the click sound. kind = extra classes ('big blue', 'small pink'...)
export function button(label, onClick, kind = '', attrs = {}) {
  return h('button.btn' + (kind ? '.' + kind.trim().split(/\s+/).join('.') : ''), {
    ...attrs,
    onClick: (e) => {
      if (e.currentTarget.classList.contains('disabled')) return;
      Audio.play('click');
      onClick && onClick(e);
    },
  }, label);
}

// Only touch the DOM when a value changes (HUD updates every frame).
export function setText(el, v) {
  const s = String(v);
  if (el.__t !== s) { el.textContent = s; el.__t = s; }
}

export function setStyle(el, k, v) {
  if (el.__s === undefined) el.__s = {};
  if (el.__s[k] !== v) { el.style[k] = v; el.__s[k] = v; }
}

export function toggleClass(el, c, on) {
  if (el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on);
}
