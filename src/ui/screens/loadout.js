// Pre-battle loadout: level intro, enemy intel, modifiers, squad picker (squad points), spell picker
// (max 3) and the Captain summary. Picks are saved in the profile as they change.
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { LEVEL_BY_ID, LEVELS, MODIFIERS, HARD_MODE } from '../../data/levels.js';
import { UNITS, PLAYER_ROSTER, MAX_LOADOUT, SQUAD, crewOf } from '../../data/units.js';
import { squadCap, squadUsed, fitSquad } from '../../game/squad.js';
import { FORT_UPGRADES } from '../../data/upgrades.js';
import { SPELLS, SPELL_ORDER, MAX_SPELL_SLOTS } from '../../data/spells.js';
import { FACTIONS } from '../../data/factions.js';
import { heroXpToNext } from '../../data/hero.js';
import { icon, unitIcon, hatIcon } from '../../render/icons.js';
import { ico, header, goldChip, dispose, starRow, setBadge, replay, onEsc } from './meta_ui.js';

const SPELL_KEYS = ['Z', 'X', 'C'];
const LENT_SPELL = 'pencil_rain'; // the spell-tutorial level lends this when no supply is picked (see session.js)

// Phones and tablets have no keyboard: swap key hints for touch wording.
function isTouch() {
  try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
}
function deviceCopy(text, touch) {
  return touch ? text.replace(/Move him with A and D\./, 'Hold the arrow buttons to move him.') : text;
}

function winText(lv) {
  if (lv.win === 'survive') return `Survive ${Math.round((lv.surviveTime || 240) / 60)} minutes`;
  if (lv.win === 'boss') return 'Defeat the boss';
  return 'Destroy the enemy fort';
}

function unlockHint(kind, id) {
  const lv = LEVELS.find((l) => l.rewards && l.rewards.unlock && l.rewards.unlock[kind] === id);
  return lv ? 'Clear ' + lv.id : 'Locked';
}

UI.register('loadout', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'loadout-screen');
    const touch = isTouch();
    if (touch) el.classList.add('touch-ui');
    const tapWord = touch ? 'Tap' : 'Click';
    const p = Save.data;
    const lv = LEVEL_BY_ID[params.levelId] || LEVELS[0];
    const hard = !!params.hard;
    const gold = goldChip(el);
    const ch = lv.chapter;

    // ---- intel column
    const rec = p.levels[lv.id] || {};
    const foeIds = Array.from(new Set(lv.enemy.roster || []));
    const faction = FACTIONS[lv.faction];
    const enemyLevel = (lv.enemy.level || 1) + (hard ? HARD_MODE.levelBonus : 0);
    const intel = h('div.lo-col.lo-intel.scroll', null,
      h('div.note.lo-intro', null, h('div', null, deviceCopy(lv.intro, touch))),
      h('div.card.plain.lo-foes.probe', null,
        h('div.lo-h', null, faction.name, h('span.pill.pink', null, 'Lv ' + enemyLevel)),
        h('div.lo-foe-row', null,
          foeIds.filter((id) => UNITS[id]).map((id) => h('img', { src: unitIcon(id, { faction: lv.faction, size: 96 }), alt: UNITS[id].name, title: UNITS[id].name })),
          lv.boss && UNITS[lv.boss] ? h('img.boss', { src: unitIcon(lv.boss, { size: 128 }), alt: UNITS[lv.boss].name, title: UNITS[lv.boss].name }) : null),
        h('div.small-note', null, winText(lv))),
      ...((lv.modifiers || []).map((m) => h('div.mod.probe', null,
        h('span.pill.orange', null, MODIFIERS[m] ? MODIFIERS[m].name : m),
        h('span.small-note', null, MODIFIERS[m] ? MODIFIERS[m].desc : '')))),
      hard ? h('div.mod.probe', null, h('span.pill.red', null, 'Red Ink'), h('span.small-note', null, 'Tougher enemies. Gold x' + HARD_MODE.gold + '.')) : null);

    // ---- army column
    const countEl = h('span.lo-count.marker', null, '');
    const grid = h('div.pgrid');
    const note = h('div.small-note.lo-more', null, '');
    const chip = button([h('img', { src: hatIcon(p.hero.hat || 'captain', 64), alt: '' }), h('span', null, 'Lv ' + p.hero.level)], () => App.go('hero'), 'small white captain-chip', { title: 'Captain' });
    if (p.hero.points > 0) setBadge(chip, true);
    const army = h('div.lo-col.lo-army', null,
      h('div.lo-h', null, 'Your squad', countEl, h('span.small-note', null, `${tapWord} to add or remove. Bigger units cost more squad points.`), chip),
      h('div.scroll.pscroll', null, grid, note));

    // ---- right column
    const spellGrid = h('div.sgrid');
    const spellCount = h('span.lo-count.marker', null, '');
    const spellNote = h('div.small-note', null, '');
    const xpNeed = heroXpToNext(p.hero.level);
    const heroBtn = button([
      h('img.captain-hat', { src: hatIcon(p.hero.hat || 'captain', 96), alt: '' }),
      h('div.col.tight', null, h('b.marker', null, 'Captain Lv ' + p.hero.level), h('div.bar', null, h('i', { style: { width: Math.min(100, (p.hero.xp / xpNeed) * 100) + '%' } }))),
    ], () => App.go('hero'), 'white captain-card');
    if (p.hero.points > 0) setBadge(heroBtn, true);
    const go = button([ico('menu_armory', 64), h('span', null, 'Battle!')], () => start(), 'big green battle-btn');
    const right = h('div.lo-col.lo-right', null,
      h('div.lo-h', null, 'Supplies', spellCount),
      spellGrid, spellNote, heroBtn, go);

    const cap = squadCap(p);
    function save() {
      p.loadout.units = p.loadout.units.filter((id) => p.unlockedUnits.includes(id));
      p.loadout.units.sort((a, b) => PLAYER_ROSTER.indexOf(a) - PLAYER_ROSTER.indexOf(b));
      Save.save();
    }
    // Old saves (or a squad picked before the cap existed) may hold more than fits.
    p.loadout.units = fitSquad(p, p.loadout.units.filter((id) => p.unlockedUnits.includes(id)));
    save();

    // How the squad grows: the next boss not yet beaten, then the War Table.
    function growHint() {
      const boss = SQUAD.bossLevels.find((id) => !(p.levels[id] && p.levels[id].cleared));
      const table = (p.fort.squad || 0) < FORT_UPGRADES.squad.max;
      if (boss) return `Beat ${boss} for +${SQUAD.perBoss} squad points.`;
      if (table) return 'Build the War Table in the Armory for more squad points.';
      return '';
    }

    function drawArmy() {
      clear(grid);
      const picked = p.loadout.units;
      const used = squadUsed(picked);
      countEl.textContent = `${used}/${cap} pts`;
      countEl.title = 'Squad points used';
      countEl.classList.toggle('full', used >= cap);
      // Scribe is always along for the ride.
      grid.classList.toggle('roomy', PLAYER_ROSTER.filter((id) => id !== 'scribe' && p.unlockedUnits.includes(id)).length <= 3);
      grid.append(card('scribe', { fixed: true }));
      const open = PLAYER_ROSTER.filter((id) => id !== 'scribe' && p.unlockedUnits.includes(id));
      const locked = PLAYER_ROSTER.filter((id) => id !== 'scribe' && !p.unlockedUnits.includes(id));
      for (const id of open) grid.append(card(id));
      for (const id of locked.slice(0, 2)) grid.append(card(id, { locked: true }));
      note.textContent = [locked.length > 2 ? `${locked.length - 2} more units to find.` : '', growHint()].filter(Boolean).join(' ');
    }

    function card(id, { fixed = false, locked = false } = {}) {
      const def = UNITS[id];
      const lvl = p.units[id] || 1;
      const on = fixed || p.loadout.units.includes(id);
      const crew = crewOf(id);
      const fits = on || squadUsed(p.loadout.units) + crew <= cap;
      const b = h('button.pcard' + (on ? '.on' : '') + (locked ? '.locked' : '') + (fixed ? '.fixed' : '') + (!locked && !fits ? '.nofit' : ''), {
        title: def.name, 'data-unit': id,
        onClick: () => {
          if (locked || fixed) { Audio.play('error'); replay(b, 'shake-no'); return; }
          const list = p.loadout.units;
          const i = list.indexOf(id);
          if (i >= 0) list.splice(i, 1);
          else if (list.length >= MAX_LOADOUT) { Audio.play('error'); replay(b, 'shake-no'); UI.toast(`Squad is full (${MAX_LOADOUT} units). ${tapWord} a unit to remove it.`, 'info', 1800); return; }
          else if (squadUsed(list) + crew > cap) {
            Audio.play('error'); replay(b, 'shake-no');
            const free = cap - squadUsed(list);
            UI.toast(`${def.name} needs ${crew} squad point${crew === 1 ? '' : 's'}, you have ${free} left. ${tapWord} a unit to remove it.`, 'info', 2400);
            return;
          }
          else list.push(id);
          Audio.play(i >= 0 ? 'click' : 'toggle');
          save(); drawArmy();
          const nb = grid.querySelector(`[data-unit="${id}"]`);
          if (nb) replay(nb, 'bounce');
        },
      },
      h('img.pc-img' + (locked ? '.silhouette' : ''), { src: unitIcon(id, { level: lvl, size: 128 }), alt: '' }),
      locked ? ico('lock', 48, 'pc-lock') : h('span.pc-lv', null, 'Lv ' + lvl),
      on && !fixed ? h('span.pc-tick', null, ico('check', 48)) : null,
      h('span.pc-name', null, locked ? unlockHint('unit', id) : def.name),
      locked || fixed ? null : h('span.pc-crew', { title: `${crew} squad point${crew === 1 ? '' : 's'}` }, crew + ' pt'),
      locked ? null : h('span.pc-cost', null, h('img', { src: icon('ink', 32), alt: '' }), String(def.cost)));
      return b;
    }

    function drawSpells() {
      clear(spellGrid);
      const picked = p.loadout.spells;
      const open = SPELL_ORDER.filter((id) => p.unlockedSpells.includes(id));
      // The spell tutorial lends Pencil Rain when nothing is picked, so show it instead of "no supplies".
      const lentNow = lv.tutorial === 'spells' && !hard && !picked.some((id) => p.unlockedSpells.includes(id));
      spellCount.textContent = lentNow ? 'Lent' : `${picked.length}/${MAX_SPELL_SLOTS}`;
      if (lentNow && !open.includes(LENT_SPELL)) {
        spellGrid.append(h('div.scard.lent.probe', { 'data-spell': LENT_SPELL, title: SPELLS[LENT_SPELL].name + ': ' + SPELLS[LENT_SPELL].desc },
          h('img', { src: icon('spell_' + LENT_SPELL, 96), alt: '' }),
          h('div.sc-lent-t', null, h('b.marker', null, SPELLS[LENT_SPELL].name), h('span.sc-lent-tag', null, 'Lent for this battle'))));
      } else if (!open.length) spellGrid.append(h('div.small-note', null, 'No supplies yet. Win levels to find some.'));
      for (const id of open) {
        const slot = picked.indexOf(id);
        const b = h('button.scard' + (slot >= 0 ? '.on' : ''), {
          title: SPELLS[id].name + ': ' + SPELLS[id].desc, 'data-spell': id,
          onClick: () => {
            const i = picked.indexOf(id);
            if (i >= 0) picked.splice(i, 1);
            else if (picked.length >= MAX_SPELL_SLOTS) { Audio.play('error'); replay(b, 'shake-no'); UI.toast(`Only ${MAX_SPELL_SLOTS} supplies per battle.`, 'info', 1600); return; }
            else picked.push(id);
            Audio.play(i >= 0 ? 'click' : 'toggle');
            Save.save(); drawSpells();
            const nb = spellGrid.querySelector(`[data-spell="${id}"]`);
            if (nb) replay(nb, 'bounce');
          },
        }, h('img', { src: icon('spell_' + id, 96), alt: '' }), h('span.sc-name', null, SPELLS[id].name),
        // Z/X/C only mean something with a keyboard; touch shows the slot number.
        slot >= 0 ? h('span.sc-key.marker', null, touch ? String(slot + 1) : SPELL_KEYS[slot]) : null,
        lentNow && id === LENT_SPELL && slot < 0 ? h('span.sc-lent-flag.marker', null, 'Lent') : null);
        spellGrid.append(b);
      }
      const locked = SPELL_ORDER.length - open.length;
      spellNote.textContent = lentNow && !open.includes(LENT_SPELL) ? `Clear ${lv.id} to keep ${SPELLS[LENT_SPELL].name}.` : locked > 0 && open.length ? `${locked} more supplies to find.` : '';
    }

    function start() {
      if (!p.loadout.units.length) {
        Audio.play('error'); replay(go, 'shake-no');
        UI.toast('Pick at least one unit to fight with.', 'info', 1800);
        return;
      }
      Audio.play('whoosh');
      App.startBattle({ kind: 'campaign', levelId: lv.id, hard });
    }

    el.append(
      header({
        title: `${lv.id}  ${lv.name}`, tone: hard ? 'orange' : ['pink', 'blue', 'green', 'yellow', 'purple'][ch - 1] || 'yellow',
        onBack: () => App.goMap(),
        right: [rec.cleared || rec.hardCleared ? h('div.chip.probe', null, starRow(hard ? rec.hardStars || 0 : rec.stars || 0, 3, 24)) : null, gold.el],
      }),
      h('div.sheet.plain.lo-sheet', null, intel, army, right));
    drawArmy();
    drawSpells();
    onEsc(el, () => App.goMap());
  },
  unmount(el) { dispose(el); },
});
