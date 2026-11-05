// Endless draft modal ('draft'): on 'draftOffer' the session freezes the loop and opens this with
// 3 perk cards. Click or press 1/2/3 to pick -> b.endless.choose(id) -> resume. OWNER: HUD package (I).
import { UI } from '../ui.js';
import { h } from '../dom.js';
import { Audio } from '../../audio/audio.js';
import { PERKS } from '../../data/perks.js';

const INK = '#1b2240';
const RARITY = { common: 'Common', rare: 'Rare', epic: 'Epic' };

// ---------------------------------------------------------------- hand-drawn perk glyphs (100x100 space)
function path(ctx, pts, fill, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}
function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}
const GLYPHS = {
  sword(c) { path(c, [[50, 8], [58, 20], [58, 62], [42, 62], [42, 20]], '#dfe8ff'); path(c, [[30, 62], [70, 62], [70, 70], [30, 70]], '#f2b01e'); path(c, [[46, 70], [54, 70], [54, 90], [46, 90]], '#9a6a00'); },
  pencil(c) { path(c, [[64, 10], [86, 32], [36, 82], [14, 86], [18, 64]], '#ffe56b'); path(c, [[14, 86], [18, 64], [30, 76]], '#f6d6b0'); path(c, [[64, 10], [76, 6], [92, 22], [86, 32]], '#ff9cc6'); },
  heart(c) { c.beginPath(); c.moveTo(50, 86); c.bezierCurveTo(6, 56, 14, 14, 50, 34); c.bezierCurveTo(86, 14, 94, 56, 50, 86); c.closePath(); c.fillStyle = '#ff6b5e'; c.fill(); c.stroke(); },
  arrow(c) { path(c, [[12, 50], [76, 50]], null, false); path(c, [[72, 32], [92, 50], [72, 68]], '#dfe8ff'); path(c, [[12, 50], [24, 38]], null, false); path(c, [[12, 50], [24, 62]], null, false); },
  drop(c) { c.beginPath(); c.moveTo(50, 8); c.bezierCurveTo(88, 52, 84, 90, 50, 90); c.bezierCurveTo(16, 90, 12, 52, 50, 8); c.fillStyle = '#3a63db'; c.fill(); c.stroke(); path(c, [[34, 62], [38, 74]], null, false); },
  coin(c) { circle(c, 50, 50, 38, '#f2b01e'); circle(c, 50, 50, 26, '#ffe56b'); path(c, [[50, 34], [50, 66]], null, false); },
  boot(c) { path(c, [[30, 12], [58, 12], [58, 52], [90, 66], [90, 86], [24, 86], [24, 56]], '#c7b2ff'); path(c, [[24, 76], [90, 76]], null, false); },
  plus(c) { path(c, [[38, 12], [62, 12], [62, 38], [88, 38], [88, 62], [62, 62], [62, 88], [38, 88], [38, 62], [12, 62], [12, 38], [38, 38]], '#a6ee9a'); },
  house(c) { path(c, [[14, 46], [50, 12], [86, 46]], '#ff6b5e'); path(c, [[24, 46], [24, 88], [76, 88], [76, 46]], '#fff3c4'); path(c, [[42, 88], [42, 62], [58, 62], [58, 88]], '#9a6a00'); },
  cup(c) { path(c, [[20, 28], [76, 28], [70, 82], [26, 82]], '#fff'); path(c, [[22, 38], [74, 38], [70, 82], [26, 82]], '#8a5a2b'); c.beginPath(); c.arc(80, 52, 12, -Math.PI / 2, Math.PI / 2); c.stroke(); path(c, [[36, 8], [40, 20]], null, false); path(c, [[54, 8], [58, 20]], null, false); },
  shield(c) { path(c, [[14, 14], [86, 14], [86, 52], [50, 90], [14, 52]], '#93d1ff'); path(c, [[50, 14], [50, 86]], null, false); path(c, [[20, 40], [80, 40]], null, false); },
  hammer(c) { path(c, [[44, 38], [56, 38], [56, 90], [44, 90]], '#c98a4b'); path(c, [[14, 14], [86, 14], [86, 40], [14, 40]], '#aab3c8'); },
  flame(c) { c.beginPath(); c.moveTo(50, 6); c.bezierCurveTo(60, 30, 88, 40, 82, 68); c.bezierCurveTo(78, 92, 22, 92, 18, 68); c.bezierCurveTo(14, 48, 36, 44, 36, 28); c.bezierCurveTo(44, 34, 46, 22, 50, 6); c.fillStyle = '#ff8a2b'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(50, 50); c.bezierCurveTo(68, 62, 66, 84, 50, 84); c.bezierCurveTo(34, 84, 32, 64, 50, 50); c.fillStyle = '#ffe56b'; c.fill(); c.stroke(); },
  crown(c) { path(c, [[12, 76], [8, 28], [30, 50], [50, 18], [70, 50], [92, 28], [88, 76]], '#f2b01e'); circle(c, 50, 58, 7, '#ff6b5e'); },
  bomb(c) { circle(c, 46, 58, 30, '#3b4666'); path(c, [[62, 36], [76, 22]], null, false); path(c, [[72, 10], [86, 24]], null, false); path(c, [[82, 8], [92, 4]], null, false); },
  twin(c) { circle(c, 36, 56, 24, '#93d1ff'); circle(c, 64, 44, 24, '#a6ee9a'); },
  bolt(c) { path(c, [[58, 6], [22, 54], [46, 54], [38, 94], [80, 40], [54, 40]], '#ffe56b'); },
  jar(c) { path(c, [[34, 10], [66, 10], [66, 24], [34, 24]], '#c98a4b'); path(c, [[24, 24], [76, 24], [82, 84], [18, 84]], '#dfe8ff'); path(c, [[22, 52], [78, 52], [80, 84], [20, 84]], '#3a63db'); },
  wind(c) { path(c, [[10, 36], [64, 36]], null, false); c.beginPath(); c.arc(64, 26, 10, Math.PI / 2, -Math.PI * 0.3, true); c.stroke(); path(c, [[10, 60], [78, 60]], null, false); c.beginPath(); c.arc(78, 72, 10, -Math.PI / 2, Math.PI * 0.7); c.stroke(); },
  star(c) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 18 : 42; p.push([50 + Math.cos(a) * r, 54 + Math.sin(a) * r]); } path(c, p, '#ffe56b'); },
};
const PERK_GLYPH = {
  sharp_swords: 'sword', quick_quills: 'pencil', thick_paper: 'heart', long_arms: 'arrow', ink_flow: 'drop', cheap_ink: 'coin',
  fast_feet: 'boot', patch_up: 'plus', big_barracks: 'house', hot_coffee: 'cup', vampire_ink: 'heart', iron_scribes: 'shield',
  tower_volley: 'arrow', armor_plates: 'shield', heavy_hitters: 'hammer', fire_everything: 'flame', free_fifth: 'coin',
  hero_vigor: 'crown', martyrs: 'bomb', double_draw: 'twin', giant_slayer: 'hammer', second_wind: 'wind', storm_caller: 'bolt', ink_bank: 'jar',
};

function perkCanvas(perk) {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  ctx.scale(1.92 * 0.82, 1.92 * 0.82);
  ctx.translate(11, 11);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  (GLYPHS[PERK_GLYPH[perk.id]] || GLYPHS.star)(ctx);
  return c;
}

UI.register('draft', {
  mount(el, { session, offer }) {
    el.classList.add('draft-layer');
    const b = session.battle;
    const en = b.endless;
    const perks = (offer || []).map((id) => PERKS.find((p) => p.id === id) || { id, name: id, desc: '', rarity: 'common' });
    let picked = false;
    const born = performance.now();
    const pick = (perk, node) => {
      if (picked || performance.now() - born < 350) return;
      picked = true;
      node.classList.add('picked');
      Audio.play('stamp');
      setTimeout(() => {
        try { en && en.choose && en.choose(perk.id); } catch (e) { console.error(e); }
        UI.closeModal('draft');
        session.holdLoop(false);
      }, 240);
    };
    const nodes = perks.map((p, i) => {
      const node = h('button.perk-card.' + (p.rarity || 'common'), { onClick: () => pick(p, node), 'data-perk': p.id },
        h('div.num', null, String(i + 1)),
        h('div.rarity', null, RARITY[p.rarity] || 'Common'),
        perkCanvas(p),
        h('h3.marker', null, p.name),
        h('p', null, p.desc));
      return node;
    });
    el.append(
      h('h1.draft-title.marker.outline', null, 'Pick a Perk'),
      h('div.draft-sub', null, en && en.wave ? `Wave ${en.wave} cleared. Your army stays.` : 'Choose one.'),
      h('div.draft-row', null, nodes));
    const onKey = (e) => {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code) && perks[i]) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(perks[i], nodes[i]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    el.__off = () => window.removeEventListener('keydown', onKey, true);
    Audio.play('page');
  },
  unmount(el) { el.__off && el.__off(); },
});
