// Shared Playwright harness for the meta UI tests: static server, browser launch, overlap probe.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json' };

export async function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(d);
    });
  });
  await new Promise((r) => server.listen(0, r));
  return { server, url: `http://localhost:${server.address().port}/` };
}

export async function launch(headless = true) {
  const opts = { headless };
  try { return await chromium.launch({ ...opts, channel: 'chrome' }); } catch (e) { /* fall back */ }
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort() : [];
  for (const d of dirs.reverse()) {
    for (const sub of ['chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
      const exe = path.join(cache, d, sub);
      if (fs.existsSync(exe)) return chromium.launch({ ...opts, executablePath: exe });
    }
  }
  throw new Error('No Chrome or Chromium found');
}

export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 } },
  full: { viewport: { width: 1920, height: 1080 } },
  mobile: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Runs in the page: reports overlaps between visible UI blocks and anything outside the viewport.
// Only the topmost screen layer (or modal) is probed. Elements marked [data-probe-skip] and their
// children are ignored (decorations, animated stamps in flight).
export const PROBE_SRC = `(() => {
  const vw = innerWidth, vh = innerHeight, issues = [];
  const layers = [...document.querySelectorAll('#ui > .modal-layer, #ui > .screen')];
  const top = layers.filter((l) => l.classList.contains('modal-layer')).pop() || layers[layers.length - 1];
  if (!top) return { issues: ['no screen'], count: 0 };
  const sel = 'button, .btn, .probe, .card, .chip, h1, h2, h3, .tab, .tile, .note, .ach, .skill, .hat, .node, .ucard, label';
  const label = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 3).join('.') : el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
  const vis = (el) => {
    if (el.closest('[data-probe-skip]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const scroller = (el) => { let p = el.parentElement; while (p && p !== top) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p; p = p.parentElement; } return null; };
  const els = [...top.querySelectorAll(sel)].filter(vis);
  const rects = els.map((el) => ({ el, r: el.getBoundingClientRect(), sc: scroller(el) }));
  for (const { el, r, sc } of rects) {
    // Clipped by its scroll container is fine; outside the viewport without a scroller is not.
    if (!sc && (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2)) issues.push('outside viewport: ' + label(el) + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round) + ']');
    if (sc) { const s = sc.getBoundingClientRect(); if (r.left < s.left - 3 || r.right > s.right + 3) issues.push('clipped sideways in scroller: ' + label(el)); }
    if (el.matches('button, .btn, .chip, .tab, h1, h2, h3, .pill')) {
      // Text that pokes out of its own box (badges and decorations excluded).
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const box = el.getBoundingClientRect();
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim() || n.parentElement.closest('.badge, [data-probe-skip]') || getComputedStyle(n.parentElement).textOverflow === 'ellipsis') continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        const t = rg.getBoundingClientRect();
        if (t.width && (t.right > box.right + 2 || t.left < box.left - 2 || t.bottom > box.bottom + box.height * 0.5 || t.top < box.top - box.height * 0.5)) { issues.push('text overflows: ' + label(el)); break; }
      }
    }
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.sc !== b.sc && (a.sc || b.sc) && (a.sc && !a.sc.contains(b.el) || b.sc && !b.sc.contains(a.el))) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const hgt = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 4 && hgt > 4) {
      // Hidden-by-scroller parts do not count.
      const sc = a.sc || b.sc;
      if (sc) { const s = sc.getBoundingClientRect(); const ix = Math.max(a.r.left, b.r.left), iy = Math.max(a.r.top, b.r.top); if (iy > s.bottom || iy + hgt < s.top || ix > s.right) continue; }
      issues.push('overlap: ' + label(a.el) + ' x ' + label(b.el) + ' (' + Math.round(w) + 'x' + Math.round(hgt) + ')');
    }
  }
  return { issues, count: els.length };
})()`;

export async function probe(page, name, report) {
  const res = await page.evaluate(PROBE_SRC);
  const tag = name.padEnd(28);
  if (res.issues.length) {
    console.log(`PROBE ${tag} ${res.count} blocks, ${res.issues.length} issue(s)`);
    for (const i of res.issues.slice(0, 14)) console.log('   - ' + i);
    if (report) report.push(...res.issues.map((i) => `${name}: ${i}`));
  } else console.log(`PROBE ${tag} ${res.count} blocks, clean`);
  return res.issues;
}
