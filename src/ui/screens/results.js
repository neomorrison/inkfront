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

const FEATURE_NAMES = { armory: 'Armory', captain: 'Captain', endless: 'Endless', daily: 'Daily', achievements: 'Trophies' };
const FEATURE_ICONS = { armory: 'menu_armory', captain: 'menu_captain', endless: 'menu_endless', daily: 'menu_daily', achievements: 'menu_trophy' };

function headline(summary, session) {
  const k = summary.kind;
  if (k === 'endless') return { text: summary.wave ? `Wave ${summary.wave}` : 'Run over', sub: 'Run over', tone: 'win' };
  if (k === 'daily') return { text: summary.win ? 'Daily done!' : 'Daily lost', tone: summary.win ? 'win' : 'lose' };
  return { text: summary.win ? 'Page cleared!' : 'Page lost', tone: summary.win ? 'win' : 'lose' };
}

UI.register('results', {
  mount(el, { session, summary }) {
    el.classList.add('results-screen');
    const p = Save.data;
    const opts = session.opts;
    const win = summary.win;
    const hl = headline(summary, session);
    const level = opts.kind === 'campaign' ? LEVEL_BY_ID[opts.levelId] : null;

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
      h('div.rc-xp-main', null, h('div.rc-xp-top', null, h('span', null, 'Captain '), lvEl, xpTag), h('div.bar', null, xpFill)),
      h('div.levelup.marker.hidden', null, 'LEVEL UP!'));
    const unlocks = h('div.rc-unlocks');
    const achs = h('div.rc-achs');
    const right = h('div.rc-right', null, goldRow, xpRow, unlocks, achs);

    // ---- buttons
    const btns = h('div.rc-buttons.pre');
    const next = level ? nextLevelId(level.id) : null;
    const armory = featureUnlocked(p, 'armory')
      ? (() => { const b = button([ico('menu_armory', 48), h('span', null, 'Armory')], () => App.go('armory'), 'orange'); if (badgeCounts(p).armory) setBadge(b, true); return b; })()
      : null;
    if (summary.kind === 'campaign') {
      if (win && next) btns.append(button('Next Level', () => App.go('loadout', { levelId: next, hard: !!opts.hard }), 'big green'), button('Retry', () => App.startBattle(opts), 'white'));
      else if (win) btns.append(button('Retry', () => App.startBattle(opts), 'white'));
      else btns.append(button('Try Again', () => App.startBattle(opts), 'big green'));
      if (armory) btns.append(armory);
      btns.append(button('Map', () => App.goMap(), 'blue'));
    } else if (summary.kind === 'endless') {
      btns.append(button('Play Again', () => App.startBattle(opts), 'big green'));
      if (armory) btns.append(armory);
      btns.append(button('Title', () => App.goTitle(), 'blue'));
    } else {
      if (!win) btns.append(button('Try Again', () => App.startBattle(opts), 'big green'));
      if (armory) btns.append(armory);
      btns.append(button('Title', () => App.goTitle(), win ? 'big blue' : 'blue'));
    }

    const card = h('div.results-card.tape', { onClick: () => skip() }, h('div.rc-body', null, left, right), btns);
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
          floatText(lvEl, 'LEVEL UP!', 'good');
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

    // Supply crates.
    if (summary.crates > 0) {
      const crateBtn = button([ico('crate', 64), h('span', null, `Open crate${summary.crates > 1 ? 's' : ''}!`)], () => UI.modal('crate'), 'orange crate-open pre');
      left.append(crateBtn);
      at(t, (instant) => { crateBtn.classList.remove('pre'); if (!instant) Audio.play('crate'); });
      t += 300;
    }

    at(Math.min(t, 1500), () => { btns.classList.remove('pre'); });
    at(t + 200, () => { skipped = true; });
  },
  unmount(el) { dispose(el); },
});
