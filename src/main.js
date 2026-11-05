// Boot. Import order matters: sim/render/audio/ui plugin indexes fill their registries first.
import './sim/index.js';
import './render/plugins.js';
import './audio/plugins.js';
import './ui/screens/index.js';
import './game/plugins.js';
import { App } from './app.js';

function boot() {
  try {
    App.init();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:20px;background:#fff;padding:20px;z-index:999;white-space:pre-wrap">Inkfront failed to start.\n${String(e && e.stack || e)}</pre>`);
  }
}

if (document.fonts && document.fonts.ready) {
  // Wait briefly for the marker font so canvas text does not flash in a fallback face.
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(boot);
} else boot();
