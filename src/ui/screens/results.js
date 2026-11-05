// Victory/defeat screen: a stamp slams down, stars stamp in one by one, gold counts up, the
// Captain's XP bar fills (with a level-up flash), unlocks flip over, achievements and crates
// show up. Tap anywhere on the card to skip the show. Variants for endless and daily.
import { UI } from '../ui.js';
import { h, button } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { nextLevelId, LEVEL_BY_ID } from '../../data/levels.js';
import { UNITS } from '../../data/units.js';
import { SPELLS } from '../../data/spells.js';
import { HAT_BY_ID } from '../../data/hats.js';
import { ACH_BY_ID } from '../../data/achievements.js';
import { heroXpToNext, HERO_MAX_LEVEL } from '../../data/hero.js';
import { featureUnlocked, badgeCounts } from '../../game/progression.js';
import { icon, unitIcon, hatIcon } from '../../render/icons.js';
import { fmt, fmtTime } from '../../core/util.js';
import { ico, dispose, track, countUp, sparks, floatText, setBadge, replay } from './meta_ui.js';
import './crate.js';
import './ending.js';

const FEATURE_NAMES = { armory: 'Armory', captain: 'Captain', endless: 'Endless', daily: 'Daily', achievements: 'Trophies' };
const FEATURE_ICONS = { armory: 'menu_armory', captain: 'menu_captain', endless: 'menu_endless', daily: 'menu_daily', achievements: 'menu_trophy' };

// "Page" is the big moment (level 6 of a chapter, the boss); every other level is just a level.
function headline(summary, level) {
  const k = summary.kind;
  if (k === 'endless') return { text: summary.wave ? `Wave ${summary.wave}` : 'Run over', sub: 'Run over', tone: 'win' };
  if (k === 'daily') return { text: summary.win ? 'Daily done!' : 'Daily lost', tone: summary.win ? 'win' : 'lose' };
  const noun = level && level.boss ? 'Page' : 'Level';
  return { text: summary.win ? `${noun} cleared!` : `${noun} lost`, tone: summary.win ? 'win' : 'lose' };
}

UI.register('results', {
  mount(el, { session, summary }) {
    el.classList.add('results-screen');
    const p = Save.data;
    const opts = session.opts;
    const win = summary.win;
    const level = opts.kind === 'campaign' ? LEVEL_BY_ID[opts.levelId] : null;
    const hl = headline(summary, level);

    // The story ending plays once, right after the Hand falls, then the results come up as usual.
    if (summary.ending && !p.seen.ending) {
      p.seen.ending = true;
      Save.save();
      UI.modal('ending', { onDone: () => UI.show('results', { session, summary: { ...summary, ending: false } }) });
      return;
    }

    // ---- animation timeline (skippable)
    const queue = [];
    const cancels = [];
    let skipped = false;
    const at = (ms, fn) => {
      const it = { fn, done: false };
      it.id = setTimeout(() => { it.done = true; fn(false); }, ms);
      queue.push(it);
    };
    const skip = () => {
      if (skipped) return;
      skipped = true;
      for (const c of cancels) c();
      for (const it of queue) if (!it.done) { clearTimeout(it.id); it.done = true; it.fn(true); }
    };
    track(el, () => { for (const it of queue) clearTimeout(it.id); for (const c of cancels) c(); });

    // ---- left column: stamp, stars, quick stats
    const stamp = h('div.stamp.' + hl.tone + (summary.kind === 'endless' ? '.wave' : ''), null, h('span', null, hl.text.toUpperCase()), hl.sub ? h('small', null, hl.sub) : null);
    const starImgs = [0, 1, 2].map(() => h('img.rs', { src: icon('star_empty', 128), alt: '' }));
    const starRowEl = summary.kind === 'campaign' ? h('div.rc-stars', null, starImgs) : null;
    const best = summary.kind === 'endless'
      ? h('div.rc-best' + (summary.newBest ? '.new' : ''), null, summary.newBest ? 'NEW BEST!' : `Best: wave ${Math.max(summary.prevBest || 0, summary.wave || 0)}`)
      : null;
    const streak = summary.kind === 'daily' && win
      ? h('div.rc-best.new', null, ico('flame', 48), `Streak: ${p.daily.streak || 1} day${(p.daily.streak || 1) > 1 ? 's' : ''}`)
      : null;
    const st = summary.stats;
    const stats = h('div.rc-stats', null,
      h('div.rc-stat.probe', null, ico('skull', 48), h('b', null, fmt(st.kills)), h('span', null, 'defeated')),
      h('div.rc-stat.probe', null, ico('ink', 48), h('b', null, fmt(Math.round(st.inkGathered))), h('span', null, 'ink')),
      h('div.rc-stat.probe', null, ico('ach_clock', 48), h('b', null, fmtTime(summary.time)), h('span', null, 'time')));
    const left = h('div.rc-left', null,
      level ? h('div.rc-level', null, `${level.id} ${level.name}${opts.hard ? ' (Red Ink)' : ''}`) : null,
      stamp, starRowEl, best, streak, stats);

    // ---- right column: rewards
    const goldNum = h('b', null, '0');
    const goldRow = h('div.rc-row.rc-gold.probe', null, h('img.ico', { src: icon('gold', 96), alt: '' }), goldNum, h('span.rc-sub', null, summary.gold ? 'gold' : 'no gold'));
    goldRow.classList.add('pre');
    const lvEl = h('b.marker', null, 'Lv ' + summary.heroBefore.level);
    const xpFill = h('i');
    const xpTag = h('span.pill.blue', null, '+' + summary.xp + ' XP');
    const xpRow = h('div.rc-row.rc-xp.probe.pre', null,
      h('img.ico', { src: hatIcon(p.hero.hat || 'captain', 96), alt: '' }),
      h('div.rc-xp-main', null, h('div.rc-xp-top', null, h('span', null, 'Captain '), lvEl, h('div.levelup.marker.hidden', null, 'LEVEL UP!'), xpTag), h('div.bar', null, xpFill)));
    const unlocks = h('div.rc-unlocks');
    const achs = h('div.rc-achs');
    const right = h('div.rc-right', null, goldRow, xpRow, unlocks, achs);

    // ---- buttons
    const btns = h('div.rc-buttons.pre');
    const next = level ? nextLevelId(level.id) : null;
    const armory = featureUnlocked(p, 'armory')
      ? (() => { const b = button([ico('menu_armory', 48), h('span', null, 'Armory')], () => App.go('armory'), 'orange'); if (badgeCounts(p).armory) setBadge(b, true); return b; })()
      : null;
    // Enter does the primary action, Esc goes back to the map (or the title for the other modes).
    let primary = null, escAct = null;
    const act = (fn) => () => fn();
    const goMap = () => App.goMap(), goTitle = () => App.goTitle(), retry = () => App.startBattle(opts);
    if (summary.kind === 'campaign') {
      const toNext = () => App.go('loadout', { levelId: next, hard: !!opts.hard });
      if (win && next) { btns.append(button('Next Level', toNext, 'big green'), button('Retry', retry, 'white')); primary = toNext; }
      else if (win) { btns.append(button('Retry', retry, 'white')); primary = goMap; }
      else { btns.append(button('Try Again', retry, 'big green')); primary = retry; }
      if (armory) btns.append(armory);
      btns.append(button('Map', goMap, win && !next ? 'big blue' : 'blue'));
      escAct = goMap;
    } else if (summary.kind === 'endless') {
      btns.append(button('Play Again', retry, 'big green'));
      if (armory) btns.append(armory);
      btns.append(button('Title', goTitle, 'blue'));
      primary = retry; escAct = goTitle;
    } else {
      if (!win) { btns.append(button('Try Again', retry, 'big green')); primary = retry; } else primary = goTitle;
      if (armory) btns.append(armory);
      btns.append(button('Title', goTitle, win ? 'big blue' : 'blue'));
      escAct = goTitle;
    }
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !document.body.contains(el)) return;
      if (UI.hasModal && UI.hasModal()) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (e.target && e.target.closest && e.target.closest('button')) return; // a focused button handles its own Enter
        e.preventDefault();
        if (btns.classList.contains('pre')) skip(); else if (primary) act(primary)();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (escAct) act(escAct)();
      }
    };
    document.addEventListener('keydown', onKey);
    track(el, () => document.removeEventListener('keydown', onKey));

    // The body scrolls on small screens; a fade and arrow at the bottom say there is more.
    const body = h('div.rc-body', null, left, right);
    const more = h('button.rc-more.hidden', { 'data-probe-skip': '', 'aria-label': 'Scroll down', onClick: (ev) => { ev.stopPropagation(); body.scrollBy({ top: body.clientHeight * 0.7, behavior: 'smooth' }); } }, h('span', null, 'More'), h('i'));
    const scroller = h('div.rc-scroller', null, body, more);
    const checkMore = () => {
      const left_ = body.scrollHeight - body.clientHeight - body.scrollTop;
      more.classList.toggle('hidden', left_ < 6);
    };
    body.addEventListener('scroll', checkMore, { passive: true });
    body.addEventListener('transitionend', checkMore); // rows slide in with a transform, which counts as overflow until they land
    const ro = new ResizeObserver(checkMore);
    ro.observe(body); ro.observe(right); ro.observe(left);
    track(el, () => ro.disconnect());

    const card = h('div.results-card.tape', { onClick: () => skip() }, scroller, btns);
    el.append(card);

    // ================= the show
    const slam = (instant) => {
      stamp.classList.add('in');
      if (instant) return;
      Audio.play('stamp');
      replay(card, 'thud');
      sparks(stamp, 8, win ? ['#93d1ff', '#fff', '#a6ee9a'] : ['#ff9cc6', '#fff', '#ff8f86']);
    };
    at(250, slam);

    // Stars stamp in one by one.
    let t = 950;
    if (starRowEl) {
      for (let i = 0; i < 3; i++) {
        if (i < summary.stars) {
          at(t, (instant) => {
            starImgs[i].src = icon('star', 128);
            starImgs[i].classList.add('hit');
            if (!instant) { Audio.play('star', { pitch: 1 + i * 0.18 }); sparks(starImgs[i], 6); }
          });
          t += 420;
        }
      }
      if (summary.stars > (summary.prevStars || 0) && summary.prevStars > 0) {
        at(t, () => { starRowEl.append(h('span.pill.green.rc-new', null, 'New best!')); });
      }
    }

    // Gold count-up.
    at(t + 150, (instant) => {
      goldRow.classList.remove('pre');
      const total = summary.gold;
      if (instant || !total) { goldNum.textContent = '+' + fmt(total); return; }
      Audio.play('coin');
      const tick = { last: 0 };
      cancels.push(countUp(0, total, Math.min(1400, 500 + total), (v) => {
        goldNum.textContent = '+' + fmt(v);
        if (v - tick.last > Math.max(8, total / 14)) { tick.last = v; Audio.play('coin', { limit: 0.06, pitch: 1 + v / total * 0.4 }); }
      }));
    });
    t += 450;

    // XP bar with level-ups.
    const lvBefore = summary.heroBefore.level, xpBefore = summary.heroBefore.xp;
    const finalFill = () => (p.hero.level >= HERO_MAX_LEVEL ? 100 : (p.hero.xp / heroXpToNext(p.hero.level)) * 100);
    xpFill.style.width = Math.min(100, (xpBefore / heroXpToNext(lvBefore)) * 100) + '%';
    xpFill.style.transition = 'none';
    at(t, (instant) => {
      xpRow.classList.remove('pre');
      const finish = () => { xpFill.style.transition = 'none'; xpFill.style.width = finalFill() + '%'; lvEl.textContent = 'Lv ' + p.hero.level; if (p.hero.level > lvBefore) xpRow.querySelector('.levelup').classList.remove('hidden'); };
      if (instant || !summary.xp) { finish(); return; }
      let lvl = lvBefore;
      const ups = p.hero.level - lvBefore;
      const seg = (n) => {
        // Fill from the current width to full, flash, reset, continue.
        xpFill.style.transition = 'width .55s cubic-bezier(.2,.8,.3,1)';
        const last = n >= ups;
        xpFill.style.width = (last ? finalFill() : 100) + '%';
        const id = setTimeout(() => {
          if (last) return;
          lvl++;
          lvEl.textContent = 'Lv ' + lvl;
          Audio.play('levelup');
          xpRow.classList.add('flash');
          const lu = xpRow.querySelector('.levelup');
          lu.classList.remove('hidden'); replay(lu, 'pop');
          sparks(lvEl, 12);
          floatText(lvEl, 'Lv ' + lvl, 'good');
          xpFill.style.transition = 'none'; xpFill.style.width = '0%';
          void xpFill.offsetWidth;
          setTimeout(() => { xpRow.classList.remove('flash'); seg(n + 1); }, 420);
        }, 620);
        cancels.push(() => clearTimeout(id));
      };
      requestAnimationFrame(() => seg(0));
    });
    t += 900 + (p.hero.level - lvBefore) * 1000;

    // Unlock reveals (units, spells, hats, modes, new menu entries).
    const reveals = [];
    for (const u of summary.unlocks) {
      if (u.type === 'unit') reveals.push({ img: unitIcon(u.id, { size: 128 }), tag: 'New unit!', name: UNITS[u.id].name });
      else if (u.type === 'spell') reveals.push({ img: icon('spell_' + u.id, 128), tag: 'New supply!', name: SPELLS[u.id].name });
      else if (u.type === 'hat') reveals.push({ img: hatIcon(u.id, 128), tag: 'New hat!', name: (HAT_BY_ID[u.id] || {}).name || 'Hat' });
      else if (u.type === 'mode') reveals.push({ img: icon('pen_red', 128), tag: 'New mode!', name: 'Red Ink' });
    }
    for (const f of summary.features || []) reveals.push({ img: icon(FEATURE_ICONS[f], 128), tag: 'Now open!', name: FEATURE_NAMES[f], feature: true });
    if (reveals.length > 3) unlocks.classList.add('many');
    for (const r of reveals) {
      const front = h('div.flip-face.front.card.plain', { 'data-probe-skip': '' }, h('span.marker', null, '?'));
      const back = h('div.flip-face.back.card.plain' + (r.feature ? '.feature' : ''), null,
        h('div.fl-tag.marker', null, r.tag), h('img', { src: r.img, alt: '' }), h('div.fl-name.marker', null, r.name));
      const fc = h('div.flipcard.probe', null, h('div.flip-in', null, front, back));
      unlocks.append(fc);
      at(t, (instant) => {
        fc.classList.add('flipped');
        if (!instant) { Audio.play('unlock'); sparks(fc, 10); }
      });
      t += 520;
    }

    // Achievements earned in this battle.
    for (const a of summary.achievements || []) {
      const def = ACH_BY_ID[a.id];
      if (!def) continue;
      const row = h('div.rc-ach.note.probe.pre', null,
        h('img', { src: icon('ach_' + def.icon, 96), alt: '' }),
        h('div.grow', null, h('div.rc-ach-t.marker', null, 'Achievement: ' + def.name), h('div.small-note', null, def.desc)),
        a.gold ? h('span.pill.yellow', null, '+' + a.gold) : null,
        a.hat ? h('img.rc-ach-hat', { src: hatIcon(a.hat, 64), alt: '' }) : null);
      achs.append(row);
      at(t, (instant) => { row.classList.remove('pre'); if (!instant) Audio.play('unlock'); });
      t += 450;
    }

    // Supply crates: the button lives in the button row (never scrolled out of sight) and shows with it.
    let crateBtn = null;
    if (summary.crates > 0) {
      crateBtn = button([ico('crate', 64), h('span', null, `Open crate${summary.crates > 1 ? 's' : ''}!`)], () => UI.modal('crate'), 'orange crate-open');
      btns.prepend(crateBtn);
    }

    at(Math.min(t, 1500), (instant) => { btns.classList.remove('pre'); if (crateBtn && !instant) Audio.play('crate'); });
    at(t + 200, () => { skipped = true; checkMore(); });
    at(t + 700, checkMore);
  },
  unmount(el) { dispose(el); },
});
