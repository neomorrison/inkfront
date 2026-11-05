// Campaign map: notebook-divider tabs per chapter, a drawn path of level nodes with stars,
// bigger boss nodes, a pulsing current level and an optional Red Ink (hard) view.
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { LEVELS, LEVEL_BY_ID } from '../../data/levels.js';
import { CHAPTERS } from '../../data/pages.js';
import { FACTIONS } from '../../data/factions.js';
import { UNITS } from '../../data/units.js';
import { isLevelUnlocked, nextPlayableLevel, chapterUnlocked, campaignStars, CRATE_EVERY_STARS } from '../../game/progression.js';
import { DOODLE_DRAW } from '../../render/world.js';
import { PAGES } from '../../data/pages.js';
import { icon, unitIcon } from '../../render/icons.js';
import { ico, header, tabBar, goldChip, dispose, starRow, onEsc, track } from './meta_ui.js';

// Node centers in percent of the board: a gentle zig-zag toward the boss.
const SPOTS = [[9, 66], [26, 32], [43, 66], [59, 32], [74, 64], [90, 44]];
const TONES = ['pink', 'blue', 'green', 'orange', 'purple'];

// Smooth curve through the points (Catmull-Rom converted to cubic beziers).
function curve(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function bossPortrait(lv) {
  try { return unitIcon(lv.boss, { size: 128 }); } catch (e) { return null; }
}

UI.register('map', {
  mount(el) {
    el.classList.add('menu-screen', 'map-screen');
    const p = Save.data;
    const ui = p.ui;
    const startCh = (LEVEL_BY_ID[nextPlayableLevel(p)] || LEVELS[0]).chapter - 1;
    let chapter = Math.min(CHAPTERS.length - 1, Math.max(0, ui.chapter != null && ui.chapterSet ? ui.chapter : startCh));
    if (!chapterUnlocked(p, chapter + 1)) chapter = startCh;
    let hard = !!(ui.redInk && p.hardUnlocked);

    const board = h('div.map-board');
    const side = h('div.map-side');
    const gold = goldChip(el);
    const totalStars = h('div.chip.probe', null, h('img.ico', { src: icon('star', 48), alt: '' }), String(campaignStars(p)));
    const tabs = tabBar(CHAPTERS.map((c, i) => ({
      id: String(i), label: 'Page ' + c.n, tone: TONES[i], locked: !chapterUnlocked(p, c.n),
      onLocked: () => UI.toast(`Clear Page ${c.n - 1} to open Page ${c.n}.`, 'info', 2200),
    })), String(chapter), (id) => { chapter = +id; ui.chapter = chapter; ui.chapterSet = true; Save.save(); draw(); });

    function recOf(id) { return p.levels[id] || {}; }
    const isCleared = (id) => (hard ? !!recOf(id).hardCleared : !!recOf(id).cleared);
    const starsOf = (id) => (hard ? recOf(id).hardStars || 0 : recOf(id).stars || 0);
    const isOpen = (id) => (hard ? true : isLevelUnlocked(p, id));

    function draw() {
      tabs.set(String(chapter));
      const ch = CHAPTERS[chapter];
      const levels = LEVELS.filter((l) => l.chapter === ch.n);
      clear(board);
      board.className = 'map-board page-' + ch.page + (hard ? ' red-ink' : '');

      // Path under the nodes: dashed ground line plus a solid marching line to the current level.
      const firstOpen = levels.findIndex((l) => !isCleared(l.id) && isOpen(l.id));
      const reach = firstOpen < 0 ? levels.length - 1 : firstOpen;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'map-path');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      const d = curve(SPOTS.slice(0, levels.length));
      const mk = (cls, extra) => { const pa = document.createElementNS(svgNS, 'path'); pa.setAttribute('class', cls); pa.setAttribute('d', d); if (extra) pa.setAttribute('clip-path', extra); svg.append(pa); };
      const clip = document.createElementNS(svgNS, 'clipPath');
      clip.setAttribute('id', 'map-clip');
      clip.innerHTML = `<rect x="0" y="0" width="${SPOTS[reach][0]}" height="100"/>`;
      svg.append(clip);
      mk('base');
      if (reach > 0) mk('done', 'url(#map-clip)');
      const doodles = h('canvas.map-doodles');
      board.append(doodles, svg);
      sizeDoodles(doodles, ch);

      levels.forEach((lv, i) => {
        const [x, y] = SPOTS[i];
        const open = isOpen(lv.id);
        const cleared = isCleared(lv.id);
        const current = i === firstOpen;
        const cls = ['node', lv.boss ? 'boss' : '', cleared ? 'cleared' : '', current ? 'current' : '', open ? '' : 'locked'].filter(Boolean).join(' ');
        const portrait = lv.boss && open ? bossPortrait(lv) : null;
        const node = button([
          portrait ? h('img.node-img', { src: portrait, alt: '' }) : null,
          open ? h('span.node-id.marker', null, lv.id) : ico('lock', 64, 'lock-ico'),
          current ? h('i.ring') : null,
        ], () => {
          if (!open) {
            Audio.play('error');
            node.classList.remove('shake-no'); void node.offsetWidth; node.classList.add('shake-no');
            UI.toast(`Clear ${LEVELS[LEVELS.findIndex((l) => l.id === lv.id) - 1].id} first.`, 'info', 1800);
            return;
          }
          ui.loadoutLevel = lv.id; ui.chapter = chapter; ui.chapterSet = true; Save.save();
          App.go('loadout', { levelId: lv.id, hard });
        }, cls, { 'data-level': lv.id, 'aria-label': `Level ${lv.id} ${lv.name}` });
        const cap = h('div.node-cap.probe' + (y > 50 ? '.below' : '.above') + (open ? '' : '.locked'), null,
          h('div.nm.marker', null, lv.name),
          open ? starRow(starsOf(lv.id), 3, 20) : null);
        const wrap = h('div.node-wrap' + (lv.boss ? '.boss' : ''), { style: { left: x + '%', top: y + '%' } }, node, cap);
        board.append(wrap);
      });
      drawSide(ch, levels);
    }

    // Scenery doodles from the battlefield renderer, scattered along the top and bottom edges.
    function sizeDoodles(cv, ch) {
      const paint = () => {
        const w = board.clientWidth, hh = board.clientHeight;
        if (!w || !hh) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = w * dpr; cv.height = hh * dpr;
        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const page = PAGES[ch.page];
        const col = page.doodle;
        const k = hh / 300;
        const top = page.doodles.filter((t) => ['cloud', 'sun', 'moon', 'bird', 'star'].includes(t));
        const bottom = page.doodles.filter((t) => ['hill', 'mountain', 'tree', 'axis', 'equation', 'scribble'].includes(t));
        const slotsTop = [[0.12, 0.13, 0.9], [0.38, 0.1, 0.7], [0.62, 0.15, 1], [0.86, 0.1, 0.8]];
        const slotsBot = [[0.14, 0.97, 0.8], [0.42, 0.98, 0.9], [0.7, 0.97, 0.7], [0.92, 0.98, 0.8]];
        slotsTop.forEach(([x, y, sc], i) => { const fn = DOODLE_DRAW[top[i % top.length]]; if (fn) { ctx.lineWidth = 2; fn(ctx, x * w, y * hh, sc * k * 1.1, col, i * 7 + 3, 0); } });
        slotsBot.forEach(([x, y, sc], i) => { const fn = DOODLE_DRAW[bottom[i % bottom.length]]; if (fn) { ctx.lineWidth = 2; fn(ctx, x * w, y * hh, sc * k * 0.5, col, i * 5 + 1, 0); } });
      };
      requestAnimationFrame(paint);
      if (board.__ro) board.__ro.disconnect();
      board.__ro = new ResizeObserver(() => paint());
      board.__ro.observe(board);
    }

    function drawSide(ch, levels) {
      clear(side);
      const fac = FACTIONS[ch.faction];
      const roster = fac.roster.filter((id) => id !== 'scribe' && UNITS[id]).slice(0, 6);
      const got = levels.reduce((n, l) => n + starsOf(l.id), 0);
      side.append(
        h('div.note.yellow', null, h('h2.marker', null, ch.name.replace(/^Page \d+: /, '')), h('div', null, ch.blurb)),
        h('div.note.probe', { style: { background: '#fff' } },
          h('div.map-foe-name', null, fac.name),
          h('div.map-foes', null, roster.map((id) => h('img', { src: unitIcon(id, { faction: ch.faction, size: 96 }), alt: UNITS[id].name, title: UNITS[id].name })))),
        h('div.map-stars.probe', null, h('img', { src: icon(hard ? 'star_red' : 'star', 48), alt: '' }), `${got}/${levels.length * 3}`));
      const bossDef = UNITS[fac.boss];
      if (bossDef) {
        const bimg = bossPortrait({ boss: fac.boss });
        side.append(h('div.boss-note.probe', null,
          bimg ? h('img', { src: bimg, alt: '' }) : null,
          h('div', null, h('div.map-foe-name', null, 'Boss'), h('div.boss-name.marker', null, bossDef.name))));
      }
      const into = campaignStars(p) % CRATE_EVERY_STARS;
      side.append(h('div.crate-meter.probe', { title: 'Every 10 stars and every boss win gives a Supply Crate.' },
        ico('crate', 64),
        h('div.grow', null,
          h('div.crate-meter-t', null, p.crates > 0 ? `${p.crates} crate${p.crates > 1 ? 's' : ''} waiting!` : 'Next crate'),
          h('div.bar.gold', null, h('i', { style: { width: (into / CRATE_EVERY_STARS) * 100 + '%' } })),
        ),
        h('b.marker', null, `${into}/${CRATE_EVERY_STARS}`)));
      if (p.hardUnlocked) {
        const t = button([ico('pen_red', 48), h('span', null, hard ? 'Red Ink: ON' : 'Red Ink')], () => {
          hard = !hard; ui.redInk = hard; Save.save(); draw();
        }, 'red-toggle' + (hard ? ' on' : ''));
        side.insertBefore(t, side.querySelector('.crate-meter'));
      }
    }

    el.append(
      header({ title: 'Campaign', tone: 'pink', onBack: () => App.goTitle(), right: [totalStars, gold.el] }),
      tabs.el,
      h('div.sheet.plain.map-sheet', null, side, board));
    draw();
    onEsc(el, () => App.goTitle());
    track(el, () => { if (board.__ro) board.__ro.disconnect(); });
  },
  unmount(el) { dispose(el); },
});
