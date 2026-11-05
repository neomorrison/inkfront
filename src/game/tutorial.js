// Tutorial for the first four levels, driven by level.tutorial ('basics', 'spells', 'stance', 'hero').
// One goal at a time: a short note bubble plus an animated arrow that points at the real HUD element
// (or a world position). Steps advance on the actual action. It never blocks input, never moves the
// hero and never points at something hidden. OWNER: HUD package (I).
import { SESSION_HOOKS } from './session.js';
import { h } from '../ui/dom.js';
import { bus } from '../core/events.js';
import { Audio } from '../audio/audio.js';
import { Save } from './save.js';

const ARROW_SVG = '<svg viewBox="0 0 52 64"><path d="M14 4h24v28h14L26 62 0 32h14z" fill="#ffe56b" stroke="#1b2240" stroke-width="4" stroke-linejoin="round"/></svg>';

const verb = (t) => (t.touch ? 'Tap' : 'Click');
const mine = (b) => b.teams[0];

const defendLine = (b) => b.teams[0].fort.x + 260; // sim/common.js DEFEND_OFFSET
function nearestFoeX(b) {
  let x = 1e9;
  for (const u of b.units) if (u.alive && u.team === 1 && u.type !== 'scribe' && !u.isBoss && !(u.tags && u.tags.has('structure')) && u.x < x) x = u.x;
  return x;
}

function enemyArmy(b) {
  let n = 0;
  for (const u of b.units) if (u.alive && u.team === 1 && u.type !== 'scribe' && !u.isBoss) n++;
  return n;
}

// Each step: { text(t), target(t) -> element | { world, label } | null, done(t) -> bool, enter?(t), final?, auto? }
const TUTORIALS = {
  basics: {
    setup(t) {
      const ai = t.b.teams[1].ai;
      if (ai) ai.passive = true; // the enemy waits until you have drawn 3 Brawlers (or 45 s)
      t.releaseAi = () => { if (ai && ai.passive) ai.passive = false; };
    },
    tick(t) {
      if (t.total.brawler >= 3 || t.b.time >= 45) t.releaseAi();
    },
    steps: [
      { text: (t) => `${verb(t)} the Scribe card. Scribes carry ink home.`, target: (t) => t.find('card:scribe'), done: (t) => t.total.scribe >= 1 },
      {
        text: (t) => `Now draw 3 Brawlers (${Math.min(3, t.total.brawler)}/3).${mine(t.b).ink < t.b.unitCost(0, 'brawler') && t.total.brawler < 3 ? ' Wait for ink.' : ''}`,
        target: (t) => t.find('card:brawler'), done: (t) => t.total.brawler >= 3,
      },
      { text: () => 'Press CHARGE. Your army marches on the enemy fort.', target: (t) => t.find('stance:charge'), done: (t) => t.step.charge },
      {
        text: () => 'Keep drawing Brawlers. Destroy the enemy fort to win!',
        target: (t) => ({ world: t.b.teams[1].fort.x, label: 'Enemy fort' }), done: (t) => !!t.b.result, final: true,
      },
    ],
  },
  spells: {
    steps: [
      {
        text: (t) => 'Your spell is charging. Draw some units while you wait.',
        target: (t) => t.find('card:' + (t.s.roster[1] || t.s.roster[0])), done: (t) => mine(t.b).spells.length === 0 || mine(t.b).spells[0].cd <= 0,
      },
      {
        text: (t) => `Spell ready! ${verb(t)} ${t.spellName()}${t.touch ? '.' : ' (or press [Z]).'}`,
        target: (t) => t.find('spell:0'), done: (t) => t.targeting || t.total.spell > 0,
      },
      {
        text: (t) => `Now ${t.touch ? 'tap' : 'click'} ${t.enemyOnScreen() ? 'an enemy' : 'the battlefield'} to cast it.`,
        target: (t) => ({ world: t.enemyX(), label: 'Aim here' }),
        done: (t) => t.total.spell > 0,
        // Cancelled the aim? Go back one step.
        tick: (t) => { if (!t.targeting && t.total.spell === 0 && t.stepAge > 0.6) t.go(t.i - 1); },
      },
      { text: () => 'Nice! Spells are free. They just recharge.', target: () => null, done: (t) => t.stepAge > 4.5, final: true },
    ],
  },
  // 1-3: the AI really marches at your fort, so every note reacts to what the armies are doing.
  stance: {
    setup(t) { t.peak = 0; t.reached = false; },
    tick(t) {
      const n = enemyArmy(t.b);
      if (n > t.peak) t.peak = n;
      if (nearestFoeX(t.b) <= defendLine(t.b) + 330) t.reached = true;
    },
    steps: [
      {
        // They are coming. Tell the player what DEFEND means instead of pressing it for them.
        min: 2.5,
        text: (t) => {
          if (!t.marching()) return 'An enemy army is gathering. Draw Brawlers while you wait.';
          if (mine(t.b).stance !== 'defend') return 'Enemies are marching in! Press DEFEND to hold the line.';
          return 'Enemies are marching in! DEFEND keeps your army at the fort. Draw Brawlers.';
        },
        target: (t) => (t.marching() && mine(t.b).stance !== 'defend' ? t.find('stance:defend') : t.find('card:' + (t.s.roster[1] || t.s.roster[0]))),
        done: (t) => t.reached || (t.peak > 0 && enemyArmy(t.b) === 0),
      },
      {
        min: 2.5,
        text: (t) => (mine(t.b).stance === 'charge'
          ? 'They are at your line! Press DEFEND to pull back, then draw Brawlers.'
          : `They hit your line! ${verb(t)} cards to draw Brawlers and stop them.`),
        target: (t) => (mine(t.b).stance === 'charge' ? t.find('stance:defend') : t.find('card:' + (t.s.roster[1] || t.s.roster[0]))),
        done: (t) => t.attackBroken(),
      },
      {
        text: () => 'The attack is broken. Press CHARGE and finish the job!',
        target: (t) => t.find('stance:charge'),
        done: (t) => t.step.charge || mine(t.b).stance === 'charge',
      },
      {
        text: () => 'Destroy the enemy fort to win!',
        target: (t) => ({ world: t.b.teams[1].fort.x, label: 'Enemy fort' }), done: (t) => !!t.b.result, final: true,
      },
    ],
  },
  hero: {
    steps: [
      {
        text: (t) => (t.touch ? 'Hold the arrows to walk your Captain.' : 'Walk your Captain with [A] and [D].'),
        target: (t) => (t.touch ? t.find('move') : t.find('hero')),
        // Only the player's own steering counts (keys A/D, arrows, touch arrows), never the Captain's own walking.
        min: 2.5,
        enter: (t) => { t.steer0 = t.s.steerTotal; },
        done: (t) => t.s.steerTotal - t.steer0 >= 0.45 && !!mine(t.b).hero,
      },
      {
        min: 2.5,
        text: () => 'He fights anything he reaches. Lead him to the front line!',
        target: () => null,
        done: (t) => {
          const u = mine(t.b).hero;
          if (!u) return t.stepAge > 3;
          for (const e of t.b.units) if (e.alive && e.team === 1 && Math.abs(e.x - u.x) < 260) return true;
          return t.stepAge > 25;
        },
      },
      { min: 2.5, text: (t) => `Nice! Let go and he rejoins the army${t.touch ? '' : ' after a moment'}.`, target: () => null, done: (t) => t.stepAge > 4.5, final: true },
    ],
  },
};

class Tutorial {
  constructor(s, name, def) {
    this.s = s;
    this.b = s.battle;
    this.name = name;
    this.def = def;
    this.steps = def.steps;
    this.i = -1;
    this.age = 0;
    this.stepAge = 0;
    this.total = { scribe: 0, brawler: 0, army: 0, spell: 0 };
    this.step = {};
    this.targeting = false;
    this.dead = false;

    const hud = s.hud;
    this.hud = hud;
    this.dots = this.steps.map(() => h('i'));
    this.textEl = h('div.tut-text');
    this.skip = h('button.tut-skip', { onClick: () => this.finish(true) }, 'Skip');
    this.note = h('div.tut-note.note', null, this.skip, h('div.tut-dots', null, this.dots), this.textEl);
    this.ring = h('div.tut-ring');
    this.arrow = h('div.tut-arrow', { html: ARROW_SVG });
    this.label = h('div.tut-label.marker');
    this.layer = h('div.tut-layer', null, this.ring, this.arrow, this.label, this.note);
    this.layer.style.visibility = 'hidden'; // shown by the first render (the loop may be held by the how-to card)
    hud.el.append(this.layer);

    this.offEv = s.listen((e) => this.onEvent(e));
    this.offTarget = bus.on('targeting', (tg) => { this.targeting = !!(tg && tg.kind === 'spell'); });
    this.onPress = (e) => {
      const d = hud.find('stance:defend');
      if (d && d.contains(e.target)) this.step.pressedDefend = true;
    };
    hud.el.addEventListener('pointerdown', this.onPress, true);
    s.tickers.push(this.tickFn = (dt) => this.tick(dt));
    def.setup && def.setup(this);
    this.go(0);
  }

  get touch() { return !!this.hud.touch; }
  find(key) { return this.hud.find(key); }
  spellName() { const sp = mine(this.b).spells[0]; return sp ? { pencil_rain: 'Pencil Rain' }[sp.id] || 'the spell' : 'the spell'; }

  // Nearest enemy on screen, else a spot ahead of your army inside the view.
  enemyX() {
    const cam = this.s.cam;
    let best = null;
    for (const u of this.b.units) {
      if (u.alive && u.team === 1 && u.type !== 'scribe' && u.x > cam.x + 60 && u.x < cam.x + cam.viewW - 60 && (!best || u.x < best.x)) best = u;
    }
    return best ? best.x : cam.x + cam.viewW * 0.6;
  }
  // Enemies are really on the move: the nearest one has left its fort.
  marching() { return nearestFoeX(this.b) < this.b.teams[1].fort.x - 500; }
  // The attackers are beaten: most of the peak army is dead, or the survivors fell back.
  attackBroken() {
    const n = enemyArmy(this.b);
    if (this.peak > 0 && n <= Math.max(1, Math.round(this.peak * 0.34))) return true;
    return this.reached && nearestFoeX(this.b) > defendLine(this.b) + 750;
  }
  enemyOnScreen() {
    const cam = this.s.cam;
    for (const u of this.b.units) if (u.alive && u.team === 1 && u.type !== 'scribe' && u.x > cam.x + 60 && u.x < cam.x + cam.viewW - 60) return true;
    return false;
  }

  onEvent(e) {
    if (this.dead) return;
    if (e.team === 0 || e.type === 'stance') {
      if (e.type === 'queued') {
        this.total[e.id] = (this.total[e.id] || 0) + 1;
        if (e.id !== 'scribe') this.total.army++;
      } else if (e.type === 'stance' && e.team === 0 && e.stance === 'charge') this.step.charge = true;
      else if (e.type === 'spell') this.total.spell++;
    }
  }

  go(i) {
    if (i < 0) i = 0;
    if (i >= this.steps.length) { this.finish(); return; }
    const first = this.i < 0;
    this.i = i;
    this.stepAge = 0;
    this.step = {};
    const st = this.steps[i];
    st.enter && st.enter(this);
    this.dots.forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'on' : ''; });
    this.lastText = null;
    if (!first) Audio.play('star');
    if (st.final) this.markSeen();
    this.note.style.animation = 'none';
    void this.note.offsetWidth;
    this.note.style.animation = '';
  }

  markSeen() {
    const p = this.s.profile;
    if (p.seen['tut.' + this.name]) return;
    p.seen['tut.' + this.name] = true;
    try { Save.save(); } catch (e) { /* storage may be blocked */ }
  }

  finish(skipped) {
    if (this.dead) return;
    this.markSeen();
    this.def.release && this.def.release(this);
    if (this.releaseAi) this.releaseAi();
    this.destroy();
  }

  destroy() {
    this.dead = true;
    this.offEv && this.offEv();
    this.offTarget && this.offTarget();
    this.hud.el.removeEventListener('pointerdown', this.onPress, true);
    const k = this.s.tickers.indexOf(this.tickFn);
    if (k >= 0) this.s.tickers.splice(k, 1);
    this.layer.remove();
  }

  tick(dt) {
    if (this.dead) return;
    this.age += dt;
    this.stepAge += dt;
    this.def.tick && this.def.tick(this);
    const st = this.steps[this.i];
    st.tick && st.tick(this);
    if (this.dead || this.steps[this.i] !== st) return;
    // The battle is over (slow-motion beat): the note and arrow go away.
    if (this.s.ended) { this.destroy(); return; }
    // A note stays up long enough to read, even when its goal is already met.
    if (st.done(this) && this.stepAge >= (st.min || 0)) {
      if (st.final && this.i === this.steps.length - 1) { this.finish(); return; }
      this.go(this.i + 1);
      return;
    }
    this.render(st);
  }

  setText(text) {
    if (text === this.lastText) return;
    this.lastText = text;
    this.textEl.innerHTML = '';
    const parts = text.split(/\[(.+?)\]/);
    parts.forEach((p, k) => this.textEl.append(k % 2 ? h('kbd', null, p) : document.createTextNode(p)));
  }

  render(st) {
    this.setText(st.text(this));
    this.layer.style.visibility = this.hud.quickCardOpen ? 'hidden' : '';
    const tg = st.target ? st.target(this) : null;
    const W = innerWidth, H = innerHeight;
    const ring = this.ring, arrow = this.arrow, label = this.label;
    let ax = null, ay = null, rot = 0, text = '';
    ring.style.display = 'none';
    if (tg && tg.nodeType === 1) {
      const r = tg.getBoundingClientRect();
      const shown = r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.left < W && r.top < H && getComputedStyle(tg).visibility !== 'hidden';
      if (shown) {
        const pad = 6;
        ring.style.display = 'block';
        ring.style.left = r.left - pad + 'px';
        ring.style.top = r.top - pad + 'px';
        ring.style.width = r.width + pad * 2 + 'px';
        ring.style.height = r.height + pad * 2 + 'px';
        ring.classList.toggle('round', tg.classList.contains('spell') || tg.classList.contains('ability'));
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (r.right < 210) { ax = r.right + pad + 8 + 32; ay = cy; rot = 90; }
        else if (r.left > W - 230) { ax = r.left - pad - 8 - 32; ay = cy; rot = -90; }
        else if (cy > H * 0.45) { ax = cx; ay = r.top - pad - 8 - 32; rot = 0; }
        else { ax = cx; ay = r.bottom + pad + 8 + 32; rot = 180; }
      }
    } else if (tg && tg.world != null) {
      const cam = this.s.cam;
      const sx = cam.sx(tg.world);
      text = tg.label || '';
      if (sx > 40 && sx < W - 40) { ax = sx; ay = Math.max(130, cam.sy(-250) - 40); rot = 0; }
      else if (sx <= 40) { ax = 52; ay = cam.groundY - 130 * cam.zoom; rot = 90; }
      else { ax = W - 52; ay = cam.groundY - 130 * cam.zoom; rot = -90; }
    }
    if (ax == null) { arrow.style.display = 'none'; label.style.display = 'none'; return; }
    arrow.style.display = 'block';
    arrow.style.left = ax + 'px';
    arrow.style.top = ay - 32 + 'px';
    arrow.style.transform = `rotate(${rot}deg)`;
    if (text) {
      label.style.display = 'block';
      label.textContent = text;
      const off = rot === 0 ? -56 : 40;
      label.style.left = (rot === 0 ? ax : ax + (rot === 90 ? 70 : -70)) + 'px';
      label.style.top = (rot === 0 ? ay + off : ay - 12) + 'px';
      if (rot !== 0) label.style.transform = 'translateX(' + (rot === 90 ? '0' : '-100%') + ')';
      else label.style.transform = 'translateX(-50%)';
    } else label.style.display = 'none';
  }
}

SESSION_HOOKS.push((s) => {
  if (s.isDemo || s.kind !== 'campaign') return;
  const seen = s.profile.seen || (s.profile.seen = {});
  const name = s.cfg.tutorial;
  const def = name && TUTORIALS[name];
  if (def && !seen['tut.' + name]) new Tutorial(s, name, def);
  // Very first battle: one quick how-to card, dismissable (also reachable from the pause menu).
  if (!seen.howto && s.hud) s.hud.showQuickCard();
});
