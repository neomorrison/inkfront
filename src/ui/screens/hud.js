// Battle HUD: ink/army counters, minimap, fort bars, unit cards, stances, spells, hero, boss bar,
// endless wave chip, spell reticle, tooltips and touch controls. Also owns pointer input on the
// battlefield (drag to pan, right-click/long-press for the flag, click to aim spells).
// OWNER: HUD package (I).
import { UI } from '../ui.js';
import { h, setText, setStyle, toggleClass, button } from '../dom.js';
import { bus } from '../../core/events.js';
import { fmt, fmtTime, clamp } from '../../core/util.js';
import { UNITS } from '../../data/units.js';
import { SPELLS } from '../../data/spells.js';
import { HERO_ABILITIES } from '../../data/hero.js';
import { unitIcon, icon } from '../../render/icons.js';
import { howtoCard, markHowtoSeen } from './pause.js';
import { makeTooltip, makeReticle, drawMinimap } from './hud_parts.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPELL_KEYS = ['Z', 'X', 'C'];
const ARROW_L = '<svg viewBox="0 0 24 24"><path d="M15.5 3.5 6 12l9.5 8.5v-5.2h2.5v-6.6h-2.5z" transform="translate(-0.5 0)"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24"><path d="M8.5 3.5 18 12l-9.5 8.5v-5.2H6v-6.6h2.5z" transform="translate(0.5 0)"/></svg>';
const STANCE_TIPS = {
  defend: ['Defend', 'Your army holds the line near your fort.'],
  hold: ['Hold', 'Plant a flag. Your army holds there. Right-click or long-press the field also works.'],
  charge: ['Charge', 'Your whole army pushes to the enemy fort.'],
};

function mount(el, { session }) {
  const s = session;
  const b = s.battle;
  const t0 = b.teams[0];
  el.classList.add('passthrough', 'hud');
  let coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; }
  if (coarse) el.classList.add('touch');
  const tip = makeTooltip(el);
  const isTouch = () => el.classList.contains('touch');
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const vignette = h('div.hud-vignette');
  el.append(vignette);

  // ---- top row
  const inkVal = h('b', null, '0');
  const inkRate = h('small', null, '');
  const popVal = h('b', null, '0/0');
  const inkMax = h('em.max-tag', null, 'MAX');
  const inkChip = h('div.chip.ink', null, h('img', { src: icon('ink'), alt: '' }), inkVal, inkRate, inkMax);
  const popChip = h('div.chip.pop', null, h('img', { src: icon('pop'), alt: '' }), popVal);
  tip.attach(inkChip, () => '<h4>Ink</h4>Spend ink to draw units. Scribes carry more ink home from the wells.' + (t0.ink >= t0.inkCap - 0.5 ? '<div class="bad">Ink is full. Spend it or upgrade.</div>' : ''));
  tip.attach(popChip, () => '<h4>Army size</h4>How many units you can have at once. Upgrade Barracks in the Armory for more.');
  const res = h('div.hud-res', null, inkChip, popChip);
  const mapCanvas = h('canvas.minimap');
  const myBar = h('i'), foeBar = h('i');
  const myBarBox = h('div.fortbar.me', null, myBar);
  const map = h('div.hud-map.interactive', null,
    myBarBox, h('div.mapwrap', null, mapCanvas), h('div.fortbar.foe', null, foeBar));
  tip.attach(myBarBox, () => '<h4>Your fort</h4>If it falls, the page is lost.');
  const speedBtn = button('1x', () => s.toggleSpeed(), 'small white', { title: 'Game speed (T)' });
  const camBtn = button('Follow', () => s.toggleCamMode(), 'small white cam', { title: 'Camera: Follow or Free (V)' });
  const pauseBtn = button('II', () => s.togglePause(), 'small white', { title: 'Pause (Esc)' });
  tip.attach(camBtn, () => '<h4>Camera <span>V</span></h4>Follow: the camera tracks your Captain, then the action. Free: it stays where you put it.');
  tip.attach(pauseBtn, () => '<h4>Pause <span>Esc</span></h4>');
  tip.attach(speedBtn, () => '<h4>Speed <span>T</span></h4>Switch between normal and double speed.');
  const sys = h('div.hud-sys.interactive', null, speedBtn, camBtn, pauseBtn);
  el.append(h('div.hud-top', null, res, map, sys));

  const timer = h('div.sub-chip', null, '0:00');
  const waveChip = h('div.sub-chip.wave.hidden', null, '');
  const surviveChip = h('div.sub-chip.survive.hidden', null, '');
  el.append(h('div.hud-sub', null, timer, waveChip, surviveChip));

  // boss bar
  const bossName = h('div.name.marker.outline-thin', null, '');
  const bossFill = h('i'), bossGhost = h('b');
  const bossBar = h('div.hud-boss.hidden', null, bossName, h('div.bar', null, bossGhost, bossFill));
  el.append(bossBar);

  // ---- hero portrait (top left)
  const hero = t0.cfg.hero;
  let heroFace = null;
  const heroHp = h('i');
  const respawn = h('div.respawn.hidden', null, '');
  if (hero) {
    const portrait = h('img', { src: unitIcon('captain', { hat: hero.hat }), alt: 'Captain' });
    heroFace = h('div.hero-face', {
      onPointerdown: (e) => { e.preventDefault(); s.followHero(); },
    }, portrait, respawn, h('div.bar.hero-hp', null, heroHp));
    tip.attach(heroFace, () => '<h4>The Captain</h4>' + (isTouch() ? 'Hold the arrows to walk him. Tap to center the camera on him.' : 'Walk him with A and D. Click to center the camera on him.'));
    el.append(h('div.hud-hero', null, heroFace, h('div.lv', null, String(hero.level || 1))));
  }

  // ---- left column: touch arrows over the stance buttons
  const moveL = h('div.hero-move.interactive', { html: ARROW_L, 'aria-label': 'Move left' });
  const moveR = h('div.hero-move.interactive', { html: ARROW_R, 'aria-label': 'Move right' });
  const holdBtn = (el2, dir) => {
    el2.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('touch');
      s.touchHero = dir;
      s.followHero();
      el2.classList.add('down');
      try { el2.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    });
    const up = () => { if (s.touchHero === dir) s.touchHero = 0; el2.classList.remove('down'); };
    el2.addEventListener('pointerup', up);
    el2.addEventListener('pointercancel', up);
    el2.addEventListener('lostpointercapture', up);
    el2.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  holdBtn(moveL, -1);
  holdBtn(moveR, 1);
  const moveBox = h('div.hud-move', null, moveL, moveR);

  const stances = {};
  const mkStance = (id, label, key, cls) => {
    const btn = button(h('span', null, label, h('small.k', null, key)), () => s.stance(id), 'small ' + cls, { 'aria-label': label });
    tip.attach(btn, () => `<h4>${STANCE_TIPS[id][0]} <span>${key}</span></h4>${STANCE_TIPS[id][1]}`);
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
      'data-unit': id,
      onPointerdown: (e) => {
        e.preventDefault();
        if (e.button === 2) { s.cancel(id); return; }
        if (e.button > 0) return;
        if (e.pointerType === 'touch') el.classList.add('touch');
        s.spawn(id);
        card.classList.remove('pop');
        void card.offsetWidth;
        card.classList.add('pop');
      },
      onContextmenu: (e) => e.preventDefault(),
    },
    h('img.portrait', { src: unitIcon(id, { level: t0.unitLevels[id] || 1 }), alt: def.name }),
    h('div.key', null, KEYS[i] || ''), cost, q, cd);
    const entry = { id, def, card, cd, q, cost, last: '' };
    tip.attach(card, () => {
      const c = b.canRequest(0, id);
      const price = b.unitCost(0, id);
      let status = '';
      if (!c.ok && c.reason === 'ink') status = `<div class="bad">Need ${Math.ceil(price - t0.ink)} more ink</div>`;
      else if (!c.ok && c.reason === 'pop') status = '<div class="bad">Army is full</div>';
      else if (!c.ok && c.reason === 'scribes') status = '<div class="bad">Scribe limit reached</div>';
      else status = isTouch() ? '<div class="good">Tap to draw a unit.</div>' : '<div class="good">Click to draw. Right-click to cancel one.</div>';
      const lv = t0.unitLevels[id] || 1;
      return `<h4>${def.name} <span>${KEYS[i] || ''}</span></h4>${def.desc}<div class="stats">Cost ${price} ink | Draw ${b.buildTime(0, id).toFixed(1)}s | Level ${lv}<br>HP ${def.hp} | Damage ${def.dmg}</div>${status}`;
    }, () => cardRow);
    return entry;
  });
  const cardRow = h('div.hud-cards.interactive', null, cards.map((c) => c.card));

  // ---- spells and hero abilities (right side)
  const spells = t0.spells.map((sp, i) => {
    const def = SPELLS[sp.id];
    const cd = h('div.cd');
    const num = h('div.num');
    const btn = h('div.spell.interactive', {
      'data-spell': i,
      onPointerdown: (e) => { e.preventDefault(); if (e.pointerType === 'touch') el.classList.add('touch'); s.beginSpell(i); },
    }, h('img', { src: icon('spell_' + sp.id), alt: def.name }), h('div.key', null, SPELL_KEYS[i]), cd, num);
    tip.attach(btn, () => `<h4>${def.name} <span>${SPELL_KEYS[i]}</span></h4>${def.desc}<div class="stats">${sp.cd > 0 ? 'Ready in ' + Math.ceil(sp.cd) + 's' : (isTouch() ? 'Ready. Tap it, then tap the battlefield.' : 'Ready. Click it, then click the battlefield.')}</div>`, () => rightCol);
    return { btn, cd, num, sp };
  });
  const spellBox = h('div.hud-spells.interactive', null, spells.map((x) => x.btn));
  const abil = [];
  const abilBox = h('div.hud-abil.interactive');
  if (hero) {
    for (const id of hero.abilities || []) {
      const ab = HERO_ABILITIES[id];
      const cd = h('div.cd');
      const num = h('div.num');
      const btn = h('div.ability.interactive', {
        'data-ability': id,
        onPointerdown: (e) => { e.preventDefault(); if (e.pointerType === 'touch') el.classList.add('touch'); s.heroAbility(id); },
      }, h('img', { src: icon('ability_' + id), alt: ab.name }), h('div.key', null, ab.key), cd, num);
      tip.attach(btn, () => `<h4>${ab.name} <span>${ab.key}</span></h4>${ab.desc}`, () => rightCol);
      abilBox.append(btn);
      abil.push({ id, ab, btn, cd, num });
    }
  }
  if (!abil.length) abilBox.classList.add('hidden');
  if (!spells.length) spellBox.classList.add('hidden');

  // the target hint and the notice live above the card row
  const hintText = h('span', null, '');
  const hint = h('div.target-hint.note.hidden', null, hintText);
  const notice = h('div.hud-notice.note', null, '');
  const center = h('div.hud-center', null, cardRow, hint, notice);
  const rightCol = h('div.hud-right', null, abilBox, spellBox);
  el.append(h('div.hud-bottom', null, h('div.hud-left', null, moveBox, stanceBox), center, rightCol));

  const banner = h('div.hud-banner.marker.outline');
  const reticle = makeReticle(el);
  el.append(banner);

  // ---- feedback helpers
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  let bannerT = 0;
  const showBanner = (text, secs = 2.6) => {
    banner.textContent = text;
    retrigger(banner, 'show');
    bannerT = secs;
  };
  let noticeT = 0;
  const showNotice = (text, secs = 1.6, tone = '') => {
    notice.textContent = text;
    notice.classList.toggle('info', tone === 'info');
    notice.classList.add('show');
    noticeT = secs;
  };
  const floatAt = (node, text) => {
    // Beside and below the chip, drifting down, so the number and the Captain badge stay readable.
    const r = node.getBoundingClientRect();
    const f = h('div.hud-float', { style: { left: r.right + 30 + 'px', top: r.bottom + 2 + 'px' } }, text);
    el.append(f);
    setTimeout(() => f.remove(), 1000);
  };

  // ---- battlefield pointer input
  const canvas = s.app.renderer.canvas;
  let down = null;
  let pressTimer = null;
  let pressRing = null;
  const clearPress = () => {
    clearTimeout(pressTimer);
    if (pressRing) { pressRing.remove(); pressRing = null; }
  };
  const onDown = (e) => {
    if (e.target !== canvas) return;
    if (e.pointerType === 'touch') el.classList.add('touch');
    s.pointer.x = e.clientX;
    s.pointer.y = e.clientY;
    s.pointer.over = true;
    down = { x: e.clientX, y: e.clientY, cam: s.cam.x, moved: false, button: e.button, id: e.pointerId };
    s.dragging = false;
    if (e.pointerType === 'touch' && !s.targeting) {
      pressRing = h('div.hud-press', { style: { left: e.clientX + 'px', top: e.clientY + 'px' } });
      el.append(pressRing);
      pressTimer = setTimeout(() => {
        if (down && !down.moved) {
          const x = s.cam.worldX(down.x);
          down = null;
          s.stance('hold', x);
          showNotice('Flag planted', 1.2);
        }
        clearPress();
      }, 550);
    }
  };
  const onMove = (e) => {
    s.pointer.x = e.clientX;
    s.pointer.y = e.clientY;
    s.pointer.over = e.target === canvas || (!!down && down.id === e.pointerId);
    if (!down || down.id !== e.pointerId) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 9 && !down.moved) {
      if (s.targeting && e.pointerType === 'mouse') { /* keep aiming */ } else {
        down.moved = true;
        s.dragging = true;
        s.camTouch();
        clearPress();
      }
    }
    if (down.moved) { s.cam.targetX = null; s.cam.x = s.cam.clampX(down.cam - dx / s.cam.zoom); }
  };
  const onUp = (e) => {
    clearPress();
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
  const onCancel = (e) => { clearPress(); if (down && down.id === e.pointerId) { down = null; s.dragging = false; } };
  const onWheel = (e) => {
    if (e.target !== canvas) return;
    s.camTouch();
    s.cam.pan((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / s.cam.zoom);
  };
  const noMenu = (e) => { if (e.target === canvas) e.preventDefault(); };
  const noGesture = (e) => e.preventDefault();
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('contextmenu', noMenu);
  document.addEventListener('gesturestart', noGesture);
  document.addEventListener('gesturechange', noGesture);
  // Minimap: tap to jump, press and drag to scrub.
  let scrubbing = null;
  const scrubTo = (e) => {
    const r = mapCanvas.getBoundingClientRect();
    s.camTouch();
    s.cam.centerOn(clamp((e.clientX - r.left) / r.width, 0, 1) * b.width);
  };
  mapCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    scrubbing = e.pointerId;
    try { mapCanvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    scrubTo(e);
  });
  mapCanvas.addEventListener('pointermove', (e) => { if (scrubbing === e.pointerId) scrubTo(e); });
  const scrubEnd = (e) => { if (scrubbing === e.pointerId) scrubbing = null; };
  mapCanvas.addEventListener('pointerup', scrubEnd);
  mapCanvas.addEventListener('pointercancel', scrubEnd);
  mapCanvas.addEventListener('lostpointercapture', scrubEnd);

  const offTarget = bus.on('targeting', (t) => {
    toggleClass(hint, 'hidden', !t);
    canvas.style.cursor = t ? 'crosshair' : '';
    if (t) {
      tip.hide();
      if (isTouch()) hintText.textContent = t.kind === 'flag' ? 'Tap the field for your flag' : `Tap the field to cast ${SPELLS[t.id].name}`;
      else hintText.textContent = (t.kind === 'flag' ? 'Click the battlefield to plant your flag' : `Click the battlefield to cast ${SPELLS[t.id].name}`) + '. Esc cancels';
    }
    spells.forEach((x, i) => toggleClass(x.btn, 'armed', t && t.kind === 'spell' && t.slot === i));
    if (t && coarse) { s.pointer.x = null; s.pointer.y = null; }
  });

  const offEv = s.listen((e) => {
    if (e.type === 'banner') showBanner(e.text);
    else if (e.type === 'bossArrive') showBanner(UNITS[e.id].name + '!', 3);
    else if (e.type === 'waveStart') { showBanner('Wave ' + e.wave, 2); retrigger(waveChip, 'pop'); lastKillT = b.time; }
    else if (e.type === 'death') lastKillT = b.time;
    else if (e.type === 'waveClear') showNotice('Wave ' + e.wave + ' cleared', 2);
    else if (e.type === 'draftOffer') { s.openDraft(e.offer || (b.endless && b.endless.offer) || []); }
    else if (e.type === 'deposit' && e.team === 0) {
      retrigger(inkChip, 'pulse');
      floatAt(inkChip, '+' + Math.round(e.amount || 20));
    } else if (e.type === 'queued' && e.team === 0) closeQuick();
    else if (e.type === 'denied' && e.team === 0) {
      const c = cards.find((x) => x.id === e.id);
      if (c) retrigger(c.card, 'shake');
      if (e.reason === 'ink') {
        retrigger(inkChip, 'flash');
        const need = Math.ceil(b.unitCost(0, e.id) - t0.ink);
        showNotice(`Not enough ink. Need ${Math.max(1, need)} more`, 1.5);
      } else if (e.reason === 'pop') {
        retrigger(popChip, 'flash');
        showNotice('Army is full. Upgrade Barracks in the Armory', 1.8);
      } else if (e.reason === 'scribes') showNotice('Scribe limit reached', 1.5);
    }
  });
  if (b.level) showBanner(`${b.level.id}  ${b.level.name}`, 2.4);

  // ---- per-frame refresh, cheap: only touches changed values
  let lastKillT = 0; // endless: last time anything died, to spot a stalled wave
  let wasFull = false;
  let lastFullHint = -99;
  let lastBossHp = 1;
  let lastBoss = null;
  let lastWave = -1;
  const tick = (dt) => {
    setText(inkVal, fmt(t0.ink));
    setText(inkRate, '+' + t0.income.toFixed(1) + '/s');
    setText(popVal, `${Math.round(t0.pop)}/${t0.popCap}`);
    const full = t0.inkCap != null && t0.ink >= t0.inkCap - 0.5;
    toggleClass(inkChip, 'maxed', full);
    if (full && !wasFull && b.time - lastFullHint > 20) { lastFullHint = b.time; showNotice('Ink full: spend it or upgrade', 2.6, 'info'); }
    wasFull = full;
    const fortFrac = clamp(t0.fort.hp / t0.fort.maxHp, 0, 1);
    setStyle(myBar, 'width', fortFrac * 100 + '%');
    setStyle(foeBar, 'width', clamp(b.teams[1].fort.hp / b.teams[1].fort.maxHp, 0, 1) * 100 + '%');
    const low = fortFrac < 0.3 && t0.fort.alive !== false && !b.result;
    toggleClass(vignette, 'on', low);
    toggleClass(vignette, 'crit', low && fortFrac < 0.15);
    toggleClass(myBarBox, 'low', low);
    const lv = b.level;
    if (lv && lv.win === 'survive') {
      const left = Math.max(0, (lv.surviveTime || 240) - b.time);
      toggleClass(surviveChip, 'hidden', false);
      toggleClass(surviveChip, 'late', left < 30);
      setText(surviveChip, 'Survive ' + fmtTime(left));
      toggleClass(timer, 'hidden', true);
    } else setText(timer, fmtTime(b.time));
    const en = b.endless;
    toggleClass(waveChip, 'hidden', !en);
    if (en) {
      setText(waveChip, en.state === 'break' || en.state === 'draft' ? `Wave ${en.wave} cleared` : `Wave ${en.wave}, ${en.enemiesLeft ?? 0} left`);
      if (en.wave !== lastWave) { lastWave = en.wave; retrigger(waveChip, 'pop'); }
      // A wave with no kills for ~25 s: tell the player how to finish it.
      if (en.state === 'fight' && !s.ended && t0.stance !== 'charge' && b.time - lastKillT > 25) {
        lastKillT = b.time;
        showBanner('Press CHARGE to finish the wave', 4);
      }
    }
    setText(speedBtn, s.speed + 'x');
    setText(camBtn, s.camMode === 'follow' ? 'Follow' : 'Free');
    toggleClass(camBtn, 'free', s.camMode !== 'follow');
    for (const st in stances) toggleClass(stances[st], 'active', t0.stance === st);
    toggleClass(moveL, 'off', !t0.hero);
    toggleClass(moveR, 'off', !t0.hero);

    for (const c of cards) {
      const can = b.canRequest(0, c.id);
      toggleClass(c.card, 'poor', !can.ok && can.reason === 'ink');
      toggleClass(c.card, 'full', !can.ok && (can.reason === 'pop' || can.reason === 'scribes'));
      const q = t0.queues[c.id];
      const n = q ? q.count : 0;
      toggleClass(c.q, 'hidden', n <= 0);
      setText(c.q, n);
      toggleClass(c.card, 'building', n > 0);
      const prog = n > 0 ? clamp(1 - q.t / b.buildTime(0, c.id), 0, 1) : 0;
      setStyle(c.cd, 'height', (prog * 100).toFixed(1) + '%');
      setText(c.cost, b.unitCost(0, c.id));
    }
    for (const x of spells) {
      const frac = x.sp.maxCd > 0 ? x.sp.cd / x.sp.maxCd : 0;
      setStyle(x.cd, 'height', (frac * 100).toFixed(1) + '%');
      setText(x.num, x.sp.cd > 0 ? Math.ceil(x.sp.cd) : '');
      toggleClass(x.btn, 'ready', x.sp.cd <= 0);
    }
    const hu = t0.hero;
    if (hero) {
      setStyle(heroHp, 'width', hu ? ((hu.hp / hu.maxHp) * 100).toFixed(1) + '%' : '0%');
      toggleClass(respawn, 'hidden', !!hu);
      toggleClass(heroFace, 'dead', !hu);
      toggleClass(heroFace, 'follow', s.camMode === 'follow' && s.heroCamT > 0 && !!hu);
      if (!hu) setText(respawn, Math.ceil(t0.heroRespawnT));
      for (const a of abil) {
        let frac = 0;
        let secs = 0;
        if (hu) {
          if (a.ab.fury) frac = 1 - Math.min(1, (hu.data.fury || 0) / a.ab.fury);
          else { secs = hu.data.cds[a.id] || 0; frac = secs / a.ab.cd; }
        } else frac = 1;
        setStyle(a.cd, 'height', (frac * 100).toFixed(1) + '%');
        setText(a.num, secs > 0 ? Math.ceil(secs) : '');
        toggleClass(a.btn, 'ready', frac <= 0);
      }
    }

    // boss bar
    const bs = b.boss && b.boss.alive ? b.boss : null;
    toggleClass(bossBar, 'hidden', !bs);
    if (bs) {
      if (bs !== lastBoss) { lastBoss = bs; lastBossHp = 1; setText(bossName, (UNITS[bs.type] && UNITS[bs.type].name) || 'Boss'); }
      const f = clamp(bs.hp / bs.maxHp, 0, 1);
      setStyle(bossFill, 'width', f * 100 + '%');
      setStyle(bossGhost, 'width', Math.max(f, lastBossHp) * 100 + '%');
      if (f < lastBossHp - 0.002) { lastBossHp = f; retrigger(bossBar, 'hit'); } else if (f > lastBossHp) lastBossHp = f;
    }

    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('show'); }
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) notice.classList.remove('show'); }
    drawMinimap(mapCanvas, b, s.cam, s.r.pal, t0.stance === 'hold' ? t0.flagX : null);
    reticle.update(s.targeting, s.cam, s.pointer, innerWidth);
    tip.tick();
  };

  // First battle only: a small dismissable card. The battle keeps running behind it.
  let quick = null;
  const closeQuick = () => {
    if (!quick) return;
    quick.remove();
    quick = null;
    window.removeEventListener('keydown', quickKey);
    s.hold('howto', false);
    markHowtoSeen();
  };
  const quickKey = (e) => {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); closeQuick(); }
  };
  const showQuickCard = () => {
    if (quick) return;
    quick = h('div.howto-float', null, howtoCard(el.classList.contains('touch'), "Let's go", closeQuick));
    el.append(quick);
    // Reading moment: the battle waits until the card is dismissed.
    s.hold('howto', true);
    window.addEventListener('keydown', quickKey);
  };

  const find = (key) => {
    const [kind, id] = key.split(':');
    if (kind === 'card') return (cards.find((c) => c.id === id) || {}).card || null;
    if (kind === 'stance') return stances[id] || null;
    if (kind === 'spell') return (spells[+id] || {}).btn || null;
    if (kind === 'ability') return (abil.find((a) => a.id === id) || {}).btn || null;
    if (kind === 'move') return moveBox;
    if (kind === 'hero') return heroFace;
    if (kind === 'cam') return camBtn;
    if (kind === 'pause') return pauseBtn;
    return null;
  };

  const api = {
    el,
    showBanner,
    showNotice,
    find,
    showQuickCard,
    closeQuickCard: closeQuick,
    get quickCardOpen() { return !!quick; },
    get touch() { return el.classList.contains('touch'); },
    destroy() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('gesturestart', noGesture);
      document.removeEventListener('gesturechange', noGesture);
      clearPress();
      window.removeEventListener('keydown', quickKey);
      quick = null;
      offTarget();
      offEv();
      s.touchHero = 0;
      canvas.style.cursor = '';
    },
    tick,
  };
  el.__api = api;
  return api;
}

UI.register('hud', {
  mount,
  unmount(el) { el.__api && el.__api.destroy(); },
  update(dt, el) { el.__api && el.__api.tick(dt); },
});
