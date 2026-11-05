// Armory: spend gold on unit levels (with perks at 3/6/9), fort upgrades and supply levels.
// Master-detail for units, card lists for the fort and supplies. Every buy pops, bounces and chimes.
import { UI } from '../ui.js';
import { h, button, clear } from '../dom.js';
import { App } from '../../app.js';
import { Save } from '../../game/save.js';
import { Audio } from '../../audio/audio.js';
import { UNITS, PLAYER_ROSTER } from '../../data/units.js';
import { SPELLS, SPELL_ORDER } from '../../data/spells.js';
import { LEVELS } from '../../data/levels.js';
import { UNIT_MAX_LEVEL, UNIT_LEVEL, unitUpgradeCost, GEAR_TIERS, FORT_UPGRADES, FORT_UPGRADE_ORDER, fortUpgradeCost, spellUpgradeCost } from '../../data/upgrades.js';
import { SPELL_MAX_LEVEL, spellValue } from '../../data/spells.js';
import { buyUnitUpgrade, buyFortUpgrade, buySpellUpgrade, badgeCounts, markSeen, canAffordUnit } from '../../game/progression.js';
import { icon, unitIcon } from '../../render/icons.js';
import { fmt } from '../../core/util.js';
import { ico, header, tabBar, goldChip, dispose, pips, floatText, sparks, replay, setBadge, onBus, onEsc } from './meta_ui.js';

const hpAt = (def, lv) => Math.round(def.hp * (1 + UNIT_LEVEL.hpPer * (lv - 1)));
const dmgAt = (def, lv) => Math.round(def.dmg * (1 + UNIT_LEVEL.dmgPer * (lv - 1)) * 10) / 10;

const SPELL_STAT = {
  dmg: ['Damage', ''], count: ['Count', ''], dps: ['Burn per second', ''], slow: ['Slow', '%'], dur: ['Lasts', 's'], stun: ['Stun', 's'],
  planes: ['Planes', ''], radius: ['Blast size', ''], hp: ['Wall health', ''], root: ['Stuck for', 's'], heal: ['Healing', '%'], level: ['Squad level', ''],
};
function spellStat(id, key, v) {
  const unit = SPELL_STAT[key] ? SPELL_STAT[key][1] : '';
  if (unit === '%' || (id === 'highlighter' && key === 'dmg')) return '+' + Math.round(v * 100) + '%';
  const n = Math.round(v * 10) / 10;
  return n.toLocaleString('en-US') + unit;
}

function unlockHintFor(kind, id) {
  const lv = LEVELS.find((l) => l.rewards && l.rewards.unlock && l.rewards.unlock[kind] === id);
  return lv ? `Clear level ${lv.id} to unlock.` : 'Not unlocked yet.';
}

UI.register('armory', {
  mount(el, params = {}) {
    el.classList.add('menu-screen', 'armory-screen');
    const p = Save.data;
    let tab = params.tab || p.ui.armoryTab || 'units';
    if (!['units', 'fort', 'spells'].includes(tab)) tab = 'units';
    let pick = params.unit || p.ui.armoryPick || 'brawler';
    if (!UNITS[pick]) pick = 'brawler';
    const gold = goldChip(el);
    const body = h('div.arm-body');
    const tabs = tabBar([
      { id: 'units', label: 'Units', tone: 'blue', icon: 'menu_captain' },
      { id: 'fort', label: 'Fort', tone: 'orange', icon: 'upgrade_walls' },
      { id: 'spells', label: 'Supplies', tone: 'pink', icon: 'spell_pencil_rain' },
    ], tab, (id) => { tab = id; p.ui.armoryTab = id; Save.save(); draw(); });

    function refreshBadges() {
      const b = badgeCounts(p);
      tabs.badge('units', b.units > 0);
      tabs.badge('fort', b.fort > 0);
      tabs.badge('spells', b.spells > 0);
    }

    // Feedback shared by every purchase.
    function buyFx(anchor, text, card) {
      Audio.play('buy');
      if (card) replay(card, 'bounce');
      floatText(anchor, text, 'good');
      sparks(anchor, 12);
    }
    function deny(btn, msg) {
      Audio.play('error');
      replay(btn, 'shake-no');
      if (msg) floatText(btn, msg, 'bad');
    }

    // ================= units
    function drawUnits() {
      const list = h('div.arm-list.scroll');
      const grid = h('div.athumbs');
      for (const id of PLAYER_ROSTER) {
        const def = UNITS[id];
        const open = p.unlockedUnits.includes(id);
        const lvl = p.units[id] || 1;
        const b = h('button.athumb' + (id === pick ? '.sel' : '') + (open ? '' : '.locked'), {
          title: def.name, 'data-unit': id,
          onClick: () => { pick = id; p.ui.armoryPick = id; if (markSeen(p, 'new.unit.' + id)) Save.save(); Audio.play('click'); draw(); },
        },
        h('img' + (open ? '' : '.silhouette'), { src: unitIcon(id, { level: lvl, size: 96 }), alt: '' }),
        open ? h('span.at-lv', null, String(lvl)) : ico('lock', 32, 'at-lock'),
        h('span.at-name', null, open ? def.name : '???'));
        if (open && (canAffordUnit(p, id) || p.seen['new.unit.' + id] === false)) b.append(h('div.badge', null, '!'));
        grid.append(b);
      }
      list.append(grid);
      const detail = h('div.arm-detail');
      fillUnit(detail);
      body.append(list, detail);
    }

    function fillUnit(detail) {
      clear(detail);
      const def = UNITS[pick];
      const open = p.unlockedUnits.includes(pick);
      const lvl = p.units[pick] || 1;
      const maxed = lvl >= UNIT_MAX_LEVEL;
      const portrait = h('div.arm-portrait.card.plain', null,
        h('img' + (open ? '' : '.silhouette'), { src: unitIcon(pick, { level: lvl, size: 256 }), alt: '' }));
      const gearRow = h('div.gear-row', null, GEAR_TIERS.map((g) => h('span.pill.' + (lvl >= g.level ? 'yellow' : ''), { class: lvl >= g.level ? '' : 'off' }, `Lv ${g.level} ${g.gear === 'helm' ? 'Helmet' : g.gear === 'plume' ? 'Plume' : 'Gold'}`)));
      const left = h('div.arm-left', null, portrait, open ? pips(lvl, UNIT_MAX_LEVEL) : null, open ? gearRow : null);
      if (!open) {
        detail.append(left, h('div.arm-info', null,
          h('h2.marker', null, def.name),
          h('div.arm-desc', null, def.desc),
          h('div.arm-lock.note', null, ico('lock', 48), h('span', null, unlockHintFor('unit', pick)))));
        return;
      }
      const row = (icn, label, now, next, key) => h('div.stat-row', { 'data-stat': key }, ico(icn, 48), h('span.st-l', null, label), h('b.st-now', null, String(now)),
        next != null && !maxed ? [h('span.st-arrow', null, '>'), h('b.st-next', null, String(next))] : null);
      const stats = h('div.stats', null,
        row('heart', 'Health', hpAt(def, lvl), hpAt(def, lvl + 1), 'hp'),
        def.dmg > 0 ? row('sword', 'Damage', dmgAt(def, lvl), dmgAt(def, lvl + 1), 'dmg') : null,
        h('div.stat-row.hide-sm', null, ico('ink', 48), h('span.st-l', null, 'Ink cost'), h('b.st-now', null, String(def.cost))));
      const perks = h('div.perks', null, [3, 6, 9].map((tier) => {
        const pk = def.perks && def.perks[tier];
        if (!pk) return null;
        const on = lvl >= tier;
        return h('div.perk' + (on ? '.on' : ''), { 'data-tier': tier },
          h('span.pk-lv', null, on ? ico('check', 32) : ico('lock', 32), 'Lv ' + tier),
          h('span.pk-t', null, h('b.marker', null, pk.name), h('span', null, pk.desc)));
      }));
      const cost = unitUpgradeCost(def, lvl);
      const can = !maxed && p.gold >= cost;
      const buy = maxed
        ? h('div.maxed.marker', null, ico('star', 48), 'MAXED OUT')
        : button([h('span', null, 'Upgrade'), h('span.cost', null, h('img', { src: icon('gold', 48), alt: '' }), fmt(cost))], () => {
          if (!can && p.gold < cost) { deny(buy, `Need ${fmt(cost - p.gold)} more`); return; }
          if (!buyUnitUpgrade(p, pick)) return;
          const nl = p.units[pick];
          buyFx(buy, `Level ${nl}!`, portrait);
          const stat = def.perks && def.perks[nl];
          if (stat) { UI.toast(`Perk unlocked: <b>${stat.name}</b>. ${stat.desc}`, 'good', 3000); Audio.play('unlock'); }
          if (GEAR_TIERS.some((g) => g.level === nl)) { Audio.play('levelup'); }
          draw();
          const pop = body.querySelector('.arm-portrait'); if (pop) replay(pop, 'bounce');
          for (const k of ['hp', 'dmg']) { const e = body.querySelector(`[data-stat="${k}"] .st-now`); if (e) replay(e, 'num-pop'); }
          const pk = body.querySelector(`.perk[data-tier="${nl}"]`); if (pk) replay(pk, 'perk-flash');
        }, 'big green upgrade' + (can ? '' : ' poor'));
      const info = h('div.arm-info', null,
        h('div.arm-title', null, h('h2.marker', null, def.name), h('span.pill.blue', null, def.role), h('span.pill.yellow', null, `Lv ${lvl}/${UNIT_MAX_LEVEL}`)),
        h('div.arm-desc.hide-sm', null, def.desc), stats, perks, buy);
      detail.append(left, info);
    }

    // ================= fort
    function drawFort() {
      const grid = h('div.arm-cards.scroll');
      for (const id of FORT_UPGRADE_ORDER) {
        const up = FORT_UPGRADES[id];
        const lv = p.fort[id] || 0;
        const maxed = lv >= up.max;
        const cost = fortUpgradeCost(id, lv);
        const can = !maxed && p.gold >= cost;
        const card = h('div.ucard-wide.card.plain' + (can ? '.can' : ''), { 'data-fort': id },
          h('div.uc-icon', null, h('img', { src: icon('upgrade_' + up.icon, 128), alt: '' })),
          h('div.uc-main', null,
            h('div.uc-name.marker', null, up.name, h('span.pill.yellow', null, `${lv}/${up.max}`)),
            h('div.uc-now', null, up.desc(lv)),
            maxed ? h('div.uc-next.maxed-t', null, 'Maxed out!') : h('div.uc-next', null, h('b', null, 'Next: '), up.desc(lv + 1)),
            pips(lv, up.max, 'sm')));
        let btn;
        if (maxed) btn = h('div.maxed.marker.small', null, ico('check', 48), 'MAX');
        else {
          btn = button([h('img', { src: icon('gold', 48), alt: '' }), fmt(cost)], () => {
            if (p.gold < cost) { deny(btn, `Need ${fmt(cost - p.gold)}`); return; }
            if (!buyFortUpgrade(p, id)) return;
            buyFx(btn, up.desc(p.fort[id]).split(',')[0], card);
            draw();
            const nc = body.querySelector(`[data-fort="${id}"]`); if (nc) replay(nc, 'bounce');
          }, 'green buy' + (can ? '' : ' poor'));
          if (can) setBadge(card, true);
        }
        card.append(btn);
        grid.append(card);
      }
      body.append(grid);
    }

    // ================= spells
    function drawSpells() {
      const grid = h('div.arm-cards.scroll.spells');
      const open = SPELL_ORDER.filter((id) => p.unlockedSpells.includes(id));
      const locked = SPELL_ORDER.filter((id) => !p.unlockedSpells.includes(id));
      for (const id of open) {
        const def = SPELLS[id];
        const lv = p.spells[id] || 1;
        const maxed = lv >= SPELL_MAX_LEVEL;
        const cost = spellUpgradeCost(lv);
        const can = !maxed && p.gold >= cost;
        const keys = Object.keys(def.lv).filter((k) => SPELL_STAT[k]).slice(0, 2);
        const card = h('div.ucard-wide.card.plain' + (can ? '.can' : ''), { 'data-spell': id },
          h('div.uc-icon', null, h('img', { src: icon('spell_' + id, 128), alt: '' })),
          h('div.uc-main', null,
            h('div.uc-name.marker', null, def.name, h('span.pill.yellow', null, `${lv}/${SPELL_MAX_LEVEL}`)),
            ...keys.map((k) => h('div.uc-now', null, SPELL_STAT[k][0] + ': ', h('b', null, spellStat(id, k, spellValue(id, k, lv))),
              maxed ? null : [h('span.st-arrow', null, ' > '), h('b.st-next', null, spellStat(id, k, spellValue(id, k, lv + 1)))])),
            h('div.uc-next', null, 'Recharge: ' + def.cd + 's'),
            pips(lv, SPELL_MAX_LEVEL, 'sm')));
        let btn;
        if (maxed) btn = h('div.maxed.marker.small', null, ico('check', 48), 'MAX');
        else {
          btn = button([h('img', { src: icon('gold', 48), alt: '' }), fmt(cost)], () => {
            if (p.gold < cost) { deny(btn, `Need ${fmt(cost - p.gold)}`); return; }
            if (!buySpellUpgrade(p, id)) return;
            buyFx(btn, `Level ${p.spells[id]}!`, card);
            draw();
            const nc = body.querySelector(`[data-spell="${id}"]`); if (nc) replay(nc, 'bounce');
          }, 'green buy' + (can ? '' : ' poor'));
          if (can) setBadge(card, true);
        }
        card.append(btn);
        grid.append(card);
        if (p.seen['new.spell.' + id] === false) { markSeen(p, 'new.spell.' + id); }
      }
      for (const id of locked) {
        const def = SPELLS[id];
        grid.append(h('div.ucard-wide.card.plain.locked', null,
          h('div.uc-icon', null, h('img.silhouette', { src: icon('spell_' + id, 128), alt: '' })),
          h('div.uc-main', null, h('div.uc-name.marker', null, '???'), h('div.uc-next', null, unlockHintFor('spell', id))),
          ico('lock', 48, 'uc-lock')));
      }
      Save.save();
      body.append(grid);
      if (!open.length) grid.prepend(h('div.note.arm-empty', null, 'No supplies yet. Win levels to find school supplies to throw.'));
    }

    function draw() {
      tabs.set(tab);
      clear(body);
      body.className = 'arm-body ' + tab;
      if (tab === 'units') drawUnits(); else if (tab === 'fort') drawFort(); else drawSpells();
      refreshBadges();
    }

    el.append(
      header({ title: 'Armory', tone: 'orange', onBack: () => App.goTitle(), right: [gold.el] }),
      tabs.el,
      h('div.sheet.plain.arm-sheet', null, body));
    onEsc(el, () => App.goTitle());
    draw();
  },
  unmount(el) { dispose(el); },
});
