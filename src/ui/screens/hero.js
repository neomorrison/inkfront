// The Captain: portrait in the equipped hat, level and XP, abilities, the 3-branch skill tree
// and the hat wardrobe (locked hats are silhouettes with their unlock hint).
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { HERO_SKILLS, HERO_BRANCHES, HERO_ABILITIES, heroXpToNext, HERO_MAX_LEVEL } from '../../data/hero.js';
import { HATS } from '../../data/hats.js';
import { spendHeroPoint, respecHero, equipHat, setArmyHats, badgeCounts, markSeen } from '../../game/progression.js';
import { icon, unitIcon, hatIcon } from '../../render/icons.js';
import { ico, header, tabBar, goldChip, dispose, pips, floatText, sparks, replay, onEsc } from './meta_ui.js';

const BRANCH_ICON = { blade: 'sword', banner: 'upgrade_pop', quill: 'upgrade_scribes' };
const BRANCH_TONE = { blade: 'pink', banner: 'blue', quill: 'green' };

UI.register('hero', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'hero-screen');
    const p = Save.data;
    let tab = params.tab || p.ui.heroTab || 'skills';
    if (!['skills', 'hats'].includes(tab)) tab = 'skills';
    const gold = goldChip(el);
    const ptsNum = h('b', null, '');
    const pts = h('div.chip.probe.pts', { title: 'Skill points' }, h('img.ico', { src: icon('star', 48), alt: '' }), ptsNum, h('span.small-note', null, 'points'));
    const resetBtn = button('Reset', () => {
      const n = respecHero(p);
      if (n) { Audio.play('whoosh'); UI.toast(`Skills reset. ${n} point${n > 1 ? 's' : ''} back.`, 'info', 1800); drawRight(); drawLeft(); }
      else Audio.play('error');
    }, 'small white reset-btn', { title: 'Take back all skill points' });
    const left = h('div.hero-left');
    const right = h('div.hero-right');
    const tabs = tabBar([
      { id: 'skills', label: 'Skills', tone: 'pink', icon: 'sword' },
      { id: 'hats', label: 'Hats', tone: 'purple', icon: 'menu_captain' },
    ], tab, (id) => { tab = id; p.ui.heroTab = id; Save.save(); drawRight(); });

    function badges() {
      const b = badgeCounts(p);
      tabs.badge('skills', b.skills > 0);
      tabs.badge('hats', b.hats > 0);
      ptsNum.textContent = String(p.hero.points);
      pts.classList.toggle('has', p.hero.points > 0);
    }

    // ---------------------------------------------------------------- left: portrait and abilities
    function drawLeft() {
      clear(left);
      const hero = p.hero;
      const need = heroXpToNext(hero.level);
      const maxed = hero.level >= HERO_MAX_LEVEL;
      const pct = maxed ? 100 : Math.min(100, (hero.xp / need) * 100);
      let portrait = '';
      try { portrait = unitIcon('captain', { hat: hero.hat || 'captain', size: 256, level: 1 }); } catch (e) { portrait = hatIcon(hero.hat || 'captain', 192); }
      left.append(
        h('div.hero-card.card.plain', null,
          h('div.hero-art', null, h('img', { src: portrait, alt: '' })),
          h('div.hero-name.marker', null, 'The Captain'),
          h('div.hero-lv', null, h('span.pill.yellow', null, 'Lv ' + hero.level), maxed ? h('span.pill.green', null, 'MAX') : h('span.small-note', null, `${hero.xp}/${need} XP`)),
          h('div.bar', null, h('i', { style: { width: pct + '%' } }))),
        h('div.abil-row', null, Object.values(HERO_ABILITIES).map((a) => {
          const open = hero.level >= a.unlockLevel;
          return h('div.abil' + (open ? '' : '.locked'), { title: `${a.name}: ${a.desc}` },
            h('img', { src: icon('ability_' + a.id, 96), alt: '' }),
            h('b.marker', null, a.key),
            h('span', null, open ? a.name : 'Lv ' + a.unlockLevel));
        })));
    }

    // ---------------------------------------------------------------- right: skills
    function drawSkills() {
      const wrap = h('div.skills');
      for (const br of HERO_BRANCHES) {
        const col = h('div.branch.' + BRANCH_TONE[br.id], null,
          h('div.br-head.marker', null, ico(BRANCH_ICON[br.id], 48), br.name));
        for (const sk of HERO_SKILLS.filter((s) => s.branch === br.id)) {
          const r = p.hero.skills[sk.id] || 0;
          const locked = p.hero.level < sk.req;
          const maxed = r >= sk.max;
          const can = !locked && !maxed && p.hero.points > 0;
          // The whole card is the button: tap anywhere to spend a point. The + is the visual cue.
          const spend = () => {
            if (!can) {
              Audio.play('error'); replay(card, 'shake-no');
              floatText(card, locked ? `Reach level ${sk.req}` : maxed ? 'Maxed' : 'No points', 'bad');
              return;
            }
            if (!spendHeroPoint(p, sk.id)) return;
            Audio.play('buy');
            floatText(card, sk.name + ' ' + p.hero.skills[sk.id], 'good');
            sparks(card, 10);
            drawRight(); drawLeft();
            const nc = right.querySelector(`[data-skill="${sk.id}"]`); if (nc) replay(nc, 'bounce');
          };
          const card = h('div.skill.card.plain' + (locked ? '.locked' : '') + (can ? '.can' : '') + (maxed ? '.maxed' : '') + (!locked && !maxed && !can ? '.nopts' : ''), {
            'data-skill': sk.id, onClick: spend,
            title: can ? `Tap to add a point to ${sk.name}` : locked ? `Unlocks at Captain level ${sk.req}` : maxed ? 'Maxed out' : 'Earn a skill point first',
          },
            h('div.sk-top', null, h('b.sk-name.marker', null, sk.name)),
            h('div.sk-desc' + (r ? '' : '.dim'), null, sk.desc(Math.max(1, r))),
            h('div.sk-bot', null, pips(r, sk.max)));
          const plus = h('button.btn.green.icon.plus-btn' + (can ? '' : '.off'), { 'aria-label': 'Add point to ' + sk.name, type: 'button' }, h('span.plus-dot', null, ico('plus', 48)));
          card.querySelector('.sk-top').append(locked ? h('span.sk-req', null, ico('lock', 32), 'Lv ' + sk.req) : maxed ? h('span.pill.yellow', null, 'MAX') : plus);
          col.append(card);
        }
        wrap.append(col);
      }
      right.append(wrap);
    }

    // ---------------------------------------------------------------- right: hats
    function drawHats() {
      const sel = { id: p.hero.hat };
      const info = h('div.hat-info.note.probe');
      const grid = h('div.hats.scroll');
      const showInfo = (id) => {
        const hat = HATS.find((x) => x.id === id);
        const own = p.hats.includes(id);
        info.textContent = '';
        info.append(own
          ? h('span', null, h('b.marker', null, hat.name), p.hero.hat === id ? '  (equipped)' : '')
          : h('span', null, h('b.marker', null, '???  '), hat.from));
      };
      for (const hat of HATS) {
        const own = p.hats.includes(hat.id);
        const on = p.hero.hat === hat.id;
        const isNew = p.seen['new.hat.' + hat.id] === false;
        const b = h('button.htile' + (on ? '.on' : '') + (own ? '' : '.locked'), {
          title: own ? hat.name : hat.from, 'data-hat': hat.id,
          onClick: () => {
            sel.id = hat.id;
            if (!own) { Audio.play('error'); replay(b, 'shake-no'); showInfo(hat.id); return; }
            equipHat(p, hat.id);
            Audio.play('toggle');
            drawLeft(); drawRight();
            const nb = right.querySelector(`[data-hat="${hat.id}"]`); if (nb) { replay(nb, 'bounce'); sparks(nb, 6); }
          },
        }, hat.id === 'none'
          ? h('span.no-hat.marker', null, 'None')
          : h('img' + (own ? '' : '.silhouette'), { src: hatIcon(hat.id, 96), alt: '' }),
        on ? h('span.ht-on', null, ico('check', 32)) : null,
        own ? null : ico('lock', 32, 'ht-lock'));
        if (isNew) b.append(h('div.badge', null, '!'));
        grid.append(b);
        if (isNew && own) { /* cleared when the tab is left */ }
      }
      showInfo(sel.id);
      const toggle = button([ico('menu_captain', 32), h('span', null, p.settings.armyHats ? 'Army Hats: ON' : 'Army Hats: OFF')], () => {
        setArmyHats(p, !p.settings.armyHats);
        Audio.play('toggle');
        drawRight();
      }, 'small ' + (p.settings.armyHats ? 'green' : 'white') + ' army-toggle', { title: 'Every unit you draw wears your hat' });
      right.append(grid, h('div.hat-foot', null, info, toggle));
      // Hats seen: clear the new flags once the wardrobe is on screen.
      let changed = false;
      for (const hat of HATS) if (p.hats.includes(hat.id) && markSeen(p, 'new.hat.' + hat.id)) changed = true;
      if (changed) { Save.save(); setTimeout(() => badges(), 0); }
    }

    function drawRight() {
      clear(right);
      tabs.set(tab);
      resetBtn.classList.toggle('hidden', tab !== 'skills');
      if (tab === 'skills') drawSkills(); else drawHats();
      badges();
    }

    const sheet = h('div.sheet.plain.hero-sheet', null, left, right);
    el.append(
      header({ title: 'Captain', tone: 'pink', onBack: () => App.goTitle(), right: [resetBtn, pts, gold.el] }),
      tabs.el,
      sheet);
    drawLeft();
    drawRight();
    onEsc(el, () => App.goTitle());
  },
  unmount(el) { dispose(el); },
});
