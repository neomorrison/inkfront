// Small HUD helpers: hover tooltip, spell reticle, minimap drawing. Used by hud.js.
import { h, setStyle, toggleClass } from '../dom.js';
import { SPELLS } from '../../data/spells.js';

// ---------------------------------------------------------------- tooltip (mouse hover only)
export function makeTooltip(root) {
  const tip = h('div.hud-tip');
  root.append(tip);
  let owner = null;
  let build = null;
  let anchor = null;
  let shownAt = 0;
  const SHOW_MS = 4500; // a tooltip never stays open for long
  const place = () => {
    if (!owner) return;
    const r = owner.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(innerWidth - tw - 8, x));
    let y;
    const an = typeof anchor === 'function' ? anchor() : anchor;
    if (an) {
      // Sit just above the whole row (cards, spells + abilities) so it never covers what you are pressing.
      const ar = an.getBoundingClientRect();
      y = ar.top - th - 8;
      if (y < 60) y = ar.bottom + 8;
    } else {
      const above = r.top > th + 16 + 70;
      y = above ? r.top - th - 12 : r.bottom + 12;
    }
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const refresh = () => {
    if (!owner || !build) return;
    const html = build();
    if (tip.__html !== html) { tip.innerHTML = html; tip.__html = html; }
    place();
  };
  const hide = () => { owner = null; anchor = null; tip.classList.remove('show'); };
  return {
    el: tip,
    // anchor: optional element (or function returning one) whose top edge the tooltip sits above.
    attach(el, fn, anchorEl) {
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        owner = el;
        build = fn;
        anchor = anchorEl || null;
        shownAt = performance.now();
        tip.__html = null;
        refresh();
        tip.classList.add('show');
      });
      el.addEventListener('pointerleave', () => { if (owner === el) hide(); });
      // A press (mouse, touch or pen) closes it; it only returns when the pointer comes back.
      el.addEventListener('pointerdown', () => { if (owner === el) hide(); });
    },
    tick() {
      if (!owner) return;
      if (performance.now() - shownAt > SHOW_MS) { hide(); return; }
      refresh();
    },
    hide,
  };
}

// ---------------------------------------------------------------- spell and flag reticle
// Follows the pointer; sized from SPELLS[id].radius or width times the camera zoom.
export function makeReticle(root) {
  const el = h('div.hud-reticle', null, h('i'));
  root.append(el);
  let kind = '';
  return {
    el,
    // t: the session.targeting object or null. pointer: { x, y } in CSS px.
    update(t, cam, pointer, vw) {
      if (!t) { toggleClass(el, 'on', false); return; }
      let cls = 'flag';
      let w = 46, hgt = 120;
      if (t.kind === 'spell') {
        const def = SPELLS[t.id];
        const z = cam.zoom;
        if (def.target === 'line') { cls = 'line'; w = Math.max(30, (def.width || 200) * z); hgt = Math.max(80, cam.groundY + 40 * z - 70); }
        else if (def.target === 'point') { cls = 'point'; w = hgt = 56 * Math.max(0.8, z); }
        else { cls = 'area' + (def.target === 'ally' ? ' ally' : ''); w = Math.max(40, (def.radius || 120) * 2 * z); hgt = Math.max(24, w * 0.4); }
      }
      if (cls !== kind) { el.className = 'hud-reticle on ' + cls; kind = cls; }
      toggleClass(el, 'on', true);
      const px = pointer.x == null ? vw / 2 : pointer.x;
      const gy = cam.groundY;
      let top;
      if (cls === 'line') top = 70;
      else if (cls === 'flag') top = gy - hgt + 8;
      else top = gy - hgt / 2 + 6 * cam.zoom;
      setStyle(el, 'width', Math.round(w) + 'px');
      setStyle(el, 'height', Math.round(hgt) + 'px');
      el.style.transform = `translate(${Math.round(px - w / 2)}px, ${Math.round(top)}px)`;
    },
  };
}

// ---------------------------------------------------------------- minimap
export function drawMinimap(c, b, cam, pal, flagX) {
  const w = c.clientWidth | 0, hgt = c.clientHeight | 0;
  if (!w || !hgt) return;
  if (c.width !== w * 2) { c.width = w * 2; c.height = hgt * 2; }
  const ctx = c.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  const sx = (x) => (x / b.width) * w;
  ctx.fillStyle = 'rgba(27,34,64,.08)';
  ctx.fillRect(0, 0, w, hgt);
  for (const well of b.wells) { ctx.fillStyle = '#1b2240'; ctx.fillRect(sx(well.x) - 1.5, hgt - 6, 3, 3); }
  for (const t of b.teams) {
    ctx.fillStyle = pal[t.index].ink;
    ctx.fillRect(sx(t.fort.x) - 4, hgt * 0.25, 8, hgt * 0.6);
  }
  if (flagX != null) {
    ctx.fillStyle = '#3ec46d';
    ctx.fillRect(sx(flagX) - 1, 3, 2, hgt - 8);
    ctx.fillRect(sx(flagX) + 1, 3, 5, 4);
  }
  for (const u of b.units) {
    if (!u.alive || (u.stealth && u.team === 1)) continue;
    ctx.fillStyle = pal[u.team].ink;
    const big = u.isHero || u.isBoss;
    const r = big ? 3 : 1.6;
    ctx.fillRect(sx(u.x) - r, hgt * 0.55 - r + u.z * 3 - (big ? 3 : 0), r * 2, r * 2);
  }
  ctx.strokeStyle = '#1b2240';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx(cam.x), 1, sx(cam.viewW), hgt - 2);
}
