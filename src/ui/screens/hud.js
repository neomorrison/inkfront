// Battle HUD: ink/army counters, minimap, fort bars, unit cards, stance buttons, spells, hero.
// Also owns pointer input on the battlefield (drag to pan, right-click/long-press for the flag,
// click to aim spells). OWNER: battle HUD builder (package I) polishes layout, touch controls,
// tutorial hooks and the endless draft overlay.
import { UI } from '../ui.js';
import { h, setText, setStyle, toggleClass, button } from '../dom.js';
import { bus } from '../../core/events.js';
import { fmt, fmtTime, clamp } from '../../core/util.js';
import { UNITS } from '../../data/units.js';
import { SPELLS } from '../../data/spells.js';
import { HERO_ABILITIES } from '../../data/hero.js';
import { unitIcon, icon } from '../../render/icons.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function mount(el, { session }) {
  const s = session;
  const b = s.battle;
  el.classList.add('passthrough', 'hud');

  // ---- top bar
  const inkVal = h('b', null, '0');
  const inkRate = h('small', null, '');
  const popVal = h('b', null, '0/0');
  const res = h('div.hud-res.interactive',
    null,
    h('div.chip.ink', { title: 'Ink: spend it to draw units' }, h('img', { src: icon('ink'), alt: '' }), inkVal, inkRate),
    h('div.chip.pop', { title: 'Army size' }, h('img', { src: icon('pop'), alt: '' }), popVal));
  const mapCanvas = h('canvas.minimap');
  const myBar = h('i'), foeBar = h('i');
  const timer = h('div.hud-timer', null, '0:00');
  const map = h('div.hud-map.interactive', null,
    h('div.fortbar.me', null, myBar), h('div.mapwrap', null, mapCanvas, timer), h('div.fortbar.foe', null, foeBar));
  const speedBtn = button('1x', () => s.toggleSpeed(), 'small white', { title: 'Game speed (T)' });
  const pauseBtn = button('II', () => s.togglePause(), 'small white', { title: 'Pause (Esc)' });
  const sys = h('div.hud-sys.interactive', null, speedBtn, pauseBtn);
  el.append(h('div.hud-top', null, res, map, sys));

  // ---- stance
  const stances = {};
  const mkStance = (id, label, key, cls) => {
    const btn = button(h('span', null, label, h('small.k', null, key)), () => s.stance(id), 'small ' + cls, { title: label });
    stances[id] = btn;
    return btn;
  };
  const stanceBox = h('div.hud-stance.interactive', null,
    mkStance('defend', 'Defend', 'S', 'blue'), mkStance('hold', 'Hold', 'F', 'green'), mkStance('charge', 'Charge', 'W', 'red'));

  // ---- unit cards
  const cards = s.roster.map((id, i) => {
    const def = UNITS[id];
    const cd = h('div.cd');
    const q = h('div.queue.hidden', null, '0');
    const cost = h('div.cost', null, String(b.unitCost(0, id)));
    const card = h('div.ucard.interactive', {
      title: `${def.name}: ${def.desc}`,
      onPointerdown: (e) => {
        e.preventDefault();
        if (e.button === 2) { s.cancel(id); return; }
        s.spawn(id);
        card.classList.remove('pop');
        void card.offsetWidth;
        card.classList.add('pop');
      },
      onContextmenu: (e) => e.preventDefault(),
    },
    h('img.portrait', { src: unitIcon(id, { level: b.teams[0].unitLevels[id] || 1 }), alt: def.name }),
    h('div.key', null, KEYS[i] || ''), cost, q, cd);
    return { id, card, cd, q, cost };
  });
  const cardRow = h('div.hud-cards.interactive', null, cards.map((c) => c.card));

  // ---- spells
  const spells = b.teams[0].spells.map((sp, i) => {
    const def = SPELLS[sp.id];
    const cd = h('div.cd');
    const btn = h('div.spell.interactive', { title: `${def.name}: ${def.desc}`, onPointerdown: (e) => { e.preventDefault(); s.beginSpell(i); } },
      h('img', { src: icon('spell_' + sp.id), alt: def.name }), h('div.key', null, ['Z', 'X', 'C'][i]), cd);
    return { btn, cd, sp };
  });
  const spellBox = h('div.hud-spells.interactive', null, spells.map((x) => x.btn));

  // ---- hero
  const heroHp = h('i');
  const heroBox = h('div.hud-hero.interactive');
  const abil = [];
  const hero = b.teams[0].cfg.hero;
  if (hero) {
    const portrait = h('img.hero-portrait', { src: unitIcon('captain', { hat: hero.hat }), alt: 'Captain' });
    const respawn = h('div.respawn.hidden', null, '');
    heroBox.append(h('div.hero-face', { onPointerdown: () => { s.heroCamT = 3; } }, portrait, respawn, h('div.bar.hero-hp', null, heroHp)));
    for (const id of hero.abilities || []) {
      const ab = HERO_ABILITIES[id];
      const cd = h('div.cd');
      const btn = h('div.ability', { title: `${ab.name} (${ab.key}): ${ab.desc}`, onPointerdown: (e) => { e.preventDefault(); s.heroAbility(id); } },
        h('img', { src: icon('ability_' + id), alt: ab.name }), h('div.key', null, ab.key), cd);
      heroBox.append(btn);
      abil.push({ id, ab, btn, cd });
    }
    heroBox.respawn = respawn;
  }
  // Touch move buttons for the hero (shown on touch devices by CSS).
  const moveL = h('div.hero-move.left.interactive', null, '◀');
  const moveR = h('div.hero-move.right.interactive', null, '▶');
  const hold = (el2, dir) => {
    el2.addEventListener('pointerdown', (e) => { e.preventDefault(); s.touchHero = dir; s.heroCamT = 3; el2.setPointerCapture(e.pointerId); });
    const up = () => { if (s.touchHero === dir) s.touchHero = 0; };
    el2.addEventListener('pointerup', up);
    el2.addEventListener('pointercancel', up);
  };
  hold(moveL, -1);
  hold(moveR, 1);

  el.append(h('div.hud-bottom', null, stanceBox, cardRow, spellBox));
  el.append(heroBox, moveL, moveR);
  const banner = h('div.hud-banner.marker.outline');
  const hint = h('div.target-hint.note.hidden', null, '');
  el.append(banner, hint);

  // ---- battlefield pointer input
  const canvas = s.app.renderer.canvas;
  let down = null;
  let pressTimer = null;
  const onDown = (e) => {
    if (e.target !== canvas) return;
    down = { x: e.clientX, y: e.clientY, cam: s.cam.x, moved: false, button: e.button, id: e.pointerId };
    s.dragging = false;
    if (e.pointerType === 'touch' && !s.targeting) {
      pressTimer = setTimeout(() => { if (down && !down.moved) { s.stance('hold', s.cam.worldX(down.x)); down = null; } }, 550);
    }
  };
  const onMove = (e) => {
    s.pointer.x = e.clientX;
    s.pointer.y = e.clientY;
    s.pointer.over = e.target === canvas;
    if (!down || down.id !== e.pointerId) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 7) { down.moved = true; s.dragging = true; s.heroCamT = 0; clearTimeout(pressTimer); }
    if (down.moved) { s.cam.targetX = null; s.cam.x = s.cam.clampX(down.cam - dx / s.cam.zoom); }
  };
  const onUp = (e) => {
    clearTimeout(pressTimer);
    if (!down || down.id !== e.pointerId) return;
    const d = down;
    down = null;
    s.dragging = false;
    if (d.moved) return;
    if (d.button === 2) {
      if (s.targeting) s.cancelTargeting();
      else s.stance('hold', s.cam.worldX(e.clientX));
      return;
    }
    s.clickWorld(e.clientX);
  };
  const onWheel = (e) => {
    if (e.target !== canvas) return;
    s.heroCamT = 0;
    s.cam.pan((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / s.cam.zoom);
  };
  const noMenu = (e) => { if (e.target === canvas) e.preventDefault(); };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('contextmenu', noMenu);
  mapCanvas.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * b.width;
    s.heroCamT = 0;
    s.cam.centerOn(wx);
  });

  const offTarget = bus.on('targeting', (t) => {
    toggleClass(hint, 'hidden', !t);
    canvas.style.cursor = t ? 'crosshair' : '';
    if (t) hint.textContent = t.kind === 'flag' ? 'Tap the battlefield to plant your flag' : `Tap the battlefield to cast ${SPELLS[t.id].name}`;
    spells.forEach((x, i) => toggleClass(x.btn, 'armed', t && t.kind === 'spell' && t.slot === i));
  });

  let bannerT = 0;
  const showBanner = (text, secs = 2.6) => {
    banner.textContent = text;
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
    bannerT = secs;
  };
  const offEv = s.listen((e) => {
    if (e.type === 'banner') showBanner(e.text);
    else if (e.type === 'bossArrive') showBanner(UNITS[e.id].name + '!', 3);
    else if (e.type === 'denied' && e.team === 0) {
      const c = cards.find((x) => x.id === e.id);
      if (c) { c.card.classList.remove('shake'); void c.card.offsetWidth; c.card.classList.add('shake'); }
      const why = { ink: 'Not enough ink', pop: 'Army is full. Upgrade Barracks in the Armory', scribes: 'Scribe limit reached' }[e.reason];
      if (why) showBanner(why, 1.4);
    }
  });
  if (b.level) showBanner(`${b.level.id}  ${b.level.name}`, 2.4);

  const api = {
    el,
    showBanner,
    destroy() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', noMenu);
      offTarget();
      offEv();
      canvas.style.cursor = '';
    },
    // Per-frame refresh, cheap: only touches changed values.
    tick(dt) {
      const t0 = b.teams[0];
      setText(inkVal, fmt(t0.ink));
      setText(inkRate, '+' + t0.income.toFixed(1) + '/s');
      setText(popVal, `${Math.round(t0.pop)}/${t0.popCap}`);
      setStyle(myBar, 'width', clamp((t0.fort.hp / t0.fort.maxHp) * 100, 0, 100) + '%');
      const f1 = b.teams[1].fort;
      setStyle(foeBar, 'width', clamp((f1.hp / f1.maxHp) * 100, 0, 100) + '%');
      const lv = b.level;
      setText(timer, lv && lv.win === 'survive' ? fmtTime((lv.surviveTime || 240) - b.time) : fmtTime(b.time));
      setText(speedBtn, s.speed + 'x');
      for (const st in stances) toggleClass(stances[st], 'active', t0.stance === st);
      for (const c of cards) {
        const can = b.canRequest(0, c.id);
        toggleClass(c.card, 'poor', !can.ok && can.reason === 'ink');
        toggleClass(c.card, 'full', !can.ok && (can.reason === 'pop' || can.reason === 'scribes'));
        const q = t0.queues[c.id];
        const n = q ? q.count : 0;
        toggleClass(c.q, 'hidden', n <= 0);
        setText(c.q, n);
        const prog = n > 0 ? 1 - q.t / b.buildTime(0, c.id) : 0;
        setStyle(c.cd, 'height', (prog * 100).toFixed(1) + '%');
      }
      for (const x of spells) {
        setStyle(x.cd, 'height', ((x.sp.cd / x.sp.maxCd) * 100).toFixed(1) + '%');
        toggleClass(x.btn, 'ready', x.sp.cd <= 0);
      }
      const hu = t0.hero;
      if (hero) {
        setStyle(heroHp, 'width', hu ? ((hu.hp / hu.maxHp) * 100).toFixed(1) + '%' : '0%');
        toggleClass(heroBox.respawn, 'hidden', !!hu);
        if (!hu) setText(heroBox.respawn, Math.ceil(t0.heroRespawnT));
        for (const a of abil) {
          let frac = 0;
          if (hu) {
            if (a.ab.fury) frac = 1 - Math.min(1, (hu.data.fury || 0) / a.ab.fury);
            else frac = (hu.data.cds[a.id] || 0) / a.ab.cd;
          } else frac = 1;
          setStyle(a.cd, 'height', (frac * 100).toFixed(1) + '%');
          toggleClass(a.btn, 'ready', frac <= 0);
        }
      }
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('show'); }
      drawMinimap(mapCanvas, b, s.cam, s.r.pal);
    },
  };
  el.__api = api;
  return api;
}

function drawMinimap(c, b, cam, pal) {
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

UI.register('hud', {
  mount,
  unmount(el) { el.__api && el.__api.destroy(); },
  update(dt, el) { el.__api && el.__api.tick(dt); },
});
