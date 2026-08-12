// smoke-copy-chart.mjs — copying a distribution chart to the clipboard.
//
//   node Tools/grade-distribution-visualizer/test/smoke-copy-chart.mjs
//
// The tool already downloaded the charts as SVG and PNG. The download is the
// whole friction: save it, find it, insert it, remember to delete it. A PLC
// agenda gets written in one sitting, and what that sitting wants is a paste.
//
// Two things under test:
//
//   1. What lands on the clipboard is the SAME image the download produces.
//      A "copy" that quietly rendered a different picture from "download"
//      would be a small betrayal in a document somebody presents from.
//   2. The failure path. Clipboard image writes need a secure context and a
//      permission that can be refused, so this cannot be a button that
//      silently does nothing — it has to point at the download beside it.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8204;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/037-grade-distribution-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const PASTE = [
  'Student\tScore',
  'Ada Lovelace\t95',
  'Marco Polo\t83',
  'Nellie Bly\t71',
  'Zheng He\t64',
  'Grace Hopper\t0',
  'Ida B Wells\t88',
].join('\n');

const server = await serve(PORT);
const browser = await launch();
const context = browser;
const page = await prepPage(context, BASE, { width: 1500, height: 1100 });

/** Records every ClipboardItem the page writes, without needing real
 *  clipboard permission (which headless Chromium will not grant over http). */
const installClipboardSpy = (p) => p.evaluate(() => {
  window.__clip = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      write: async (items) => {
        for (const item of items) {
          for (const type of item.types) {
            const blob = await item.getType(type);
            const buf = new Uint8Array(await blob.arrayBuffer());
            window.__clip.push({ type, size: buf.length, head: Array.from(buf.slice(0, 8)) });
          }
        }
      },
    },
  });
  // Over plain http a browser exposes neither isSecureContext nor
  // ClipboardItem — both are secure-context-only, which is exactly why the
  // tool checks for them. Stand both up so the happy path can be exercised;
  // the insecure case is tested for real further down, unpatched.
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  if (!window.ClipboardItem) {
    window.ClipboardItem = class ClipboardItemStub {
      constructor(map) { this._map = map; this.types = Object.keys(map); }
      // The tool hands in a Promise<Blob> rather than a Blob (Safari needs
      // the item created inside the click's own task), so this must await.
      async getType(type) { return await this._map[type]; }
    };
  }
});

console.log('Grade Distribution Visualizer — copy chart to clipboard');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
await page.fill('#scoreInput', PASTE);
await page.dispatchEvent('#scoreInput', 'input');
await settle(page, 600);

/* ── 1. the buttons sit beside the downloads, on both charts ───────────── */
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('#outputBody [data-dl]')].map(b => ({ dl: b.dataset.dl, text: b.textContent })));
ok(buttons.some(b => b.dl === 'letter-copy'), 'the letter-grade chart offers a copy: ' + JSON.stringify(buttons.map(b => b.dl)));
ok(buttons.some(b => b.dl === 'hist-copy'), 'and so does the histogram');
ok(buttons.some(b => b.dl === 'letter-png') && buttons.some(b => b.dl === 'hist-svg'),
   'without displacing the existing downloads');
eq(buttons.find(b => b.dl === 'letter-copy').text, 'Copy chart', 'labelled plainly');

/* ── 2. copying puts a real PNG on the clipboard ───────────────────────── */
await installClipboardSpy(page);
await page.click('[data-dl="letter-copy"]');
await settle(page, 1600);

const clip = await page.evaluate(() => window.__clip);
eq(clip.length, 1, 'one item was written to the clipboard');
eq(clip[0].type, 'image/png', 'as a PNG — what a document editor pastes as a picture');
ok(clip[0].size > 1000, `with real image data in it (${clip[0].size} bytes)`);
eq(JSON.stringify(clip[0].head.slice(0, 4)), JSON.stringify([137, 80, 78, 71]),
   'starting with the PNG magic number, so it really is a PNG');

eq(await page.evaluate(() => document.querySelector('[data-dl="letter-copy"]').textContent), '✓ Copied',
   'and the button says it worked');
await settle(page, 2000);
eq(await page.evaluate(() => document.querySelector('[data-dl="letter-copy"]').textContent), 'Copy chart',
   'then goes back to its label rather than staying stuck on the confirmation');

/* ── 3. the histogram copies its own, larger chart ─────────────────────── */
await page.evaluate(() => { window.__clip = []; });
await page.click('[data-dl="hist-copy"]');
await settle(page, 1600);
const histClip = await page.evaluate(() => window.__clip);
eq(histClip.length, 1, 'the histogram copies too');
ok(histClip[0].size !== clip[0].size,
   `and copies its own chart, not the other one (${histClip[0].size} vs ${clip[0].size} bytes)`);

/* ── 4. it is the same image the download produces ─────────────────────── */
const downloadSize = await page.evaluate(async () => {
  // Drive the tool's own download path and measure what it would have saved.
  let captured = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return realCreate.call(URL, blob); };
  document.querySelector('[data-dl="hist-png"]').click();
  await new Promise(r => setTimeout(r, 700));
  URL.createObjectURL = realCreate;
  return captured ? captured.size : null;
});
eq(downloadSize, histClip[0].size,
   'the copied bytes are byte-for-byte the size of the downloaded PNG — one rasteriser, one picture');

/* ── 5. a refused clipboard says so, and points at the download ────────── */
await page.evaluate(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write: () => Promise.reject(new Error('NotAllowedError')) },
  });
});
await page.click('[data-dl="letter-copy"]');
await settle(page, 500);
const refused = await page.evaluate(() => {
  const b = document.querySelector('[data-dl="letter-copy"]');
  return { text: b.textContent, failed: b.classList.contains('copy-failed') };
});
eq(refused.text, 'Use Download PNG', 'a refused copy names the thing that does work instead');
eq(refused.failed, true, 'and marks itself as failed rather than looking successful');

/* A browser without image-clipboard support is refused before anything is
   rendered at all. 127.0.0.1 counts as a secure context, so this simulates
   the real gap: Chromium before 76, and any http:// deployment, expose no
   ClipboardItem at all. */
const insecure = await prepPage(context, BASE, { width: 1400, height: 1000 });
await insecure.goto(URL_PAGE, { waitUntil: 'networkidle' });
await insecure.evaluate(() => { delete window.ClipboardItem; });
await settle(insecure, 400);
await insecure.fill('#scoreInput', PASTE);
await insecure.dispatchEvent('#scoreInput', 'input');
await settle(insecure, 600);
eq(await insecure.evaluate(() => typeof window.ClipboardItem), 'undefined',
   'a browser with no image-clipboard support');
await insecure.click('[data-dl="letter-copy"]');
await settle(insecure, 400);
eq(await insecure.evaluate(() => document.querySelector('[data-dl="letter-copy"]').textContent), 'Use Download PNG',
   'is refused up front rather than rasterising a chart it can never deliver');

/* ── 6. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['insecure', insecure]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
