// App shell: owns the loop, renderer, current battle session and screen routing.
// window.App is exposed for debugging and automated tests.
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { bus } from './core/events.js';
import { Save } from './game/save.js';
import { Session } from './game/session.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Audio } from './audio/audio.js';

export const App = {
  renderer: null,
  loop: null,
  session: null,
  demoSeed: 1,
  ready: false,

  init() {
    Save.load();
    Input.init();
    const canvas = document.getElementById('game');
    this.renderer = new Renderer(canvas);
    this.applySettings();
    UI.init(document.getElementById('ui'));
    this.loop = new Loop((dt) => this.update(dt), (fdt, a) => this.render(fdt, a));
    addEventListener('resize', () => this.renderer.resize());
    const unlock = () => {
      Audio.unlock();
      bus.emit('audioUnlocked');
    };
    addEventListener('pointerdown', unlock, { passive: true });
    addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.session && !this.session.isDemo && !this.session.paused && !this.session.ended) this.session.togglePause(true);
    });
    this.ready = true;
    this.goTitle();
    this.loop.start();
    bus.emit('appReady');
  },

  applySettings() {
    const s = Save.data.settings;
    this.renderer.settings = s;
    Audio.setVolumes(s.music, s.sfx);
  },

  update(dt) {
    if (this.session) this.session.update(dt);
    UI.update(dt);
  },

  render(fdt, alpha) {
    this.renderer.render(fdt, alpha);
  },

  endSession() {
    if (this.session) this.session.destroy();
    this.session = null;
    this.renderer.battle = null;
  },

  startBattle(opts) {
    this.endSession();
    UI.closeAllModals();
    this.session = new Session(this, opts);
    this.session.start();
    bus.emit('sessionStart', opts);
    return this.session;
  },

  startDemo() {
    this.endSession();
    this.demoSeed = (this.demoSeed % 9) + 1;
    this.session = new Session(this, { kind: 'demo', seed: this.demoSeed });
    // Fast-forward until the armies meet so the title opens mid-battle.
    const b = this.session.battle;
    b.setStance(0, 'charge');
    b.setStance(1, 'charge');
    for (let i = 0; i < 60 * 9 && !b.result; i++) { b.update(1 / 60); b.events.length = 0; }
    this.session.start();
  },

  restartDemo() {
    if (UI.current && UI.current.name === 'title') this.startDemo();
  },

  goTitle() {
    this.startDemo();
    UI.show('title');
    bus.emit('route', 'title');
  },

  goMap() {
    this.endSession();
    UI.show('map');
    bus.emit('route', 'map');
  },

  // Generic route for meta screens registered by packages (armory, hero, settings...).
  go(name, params) {
    this.endSession();
    UI.show(name, params);
    bus.emit('route', name);
  },
};

if (typeof window !== 'undefined') window.App = App;
