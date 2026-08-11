// smoke-copy-chart.mjs — copying a chart to the clipboard as an image.
//
//   node Tools/grade-distribution-visualizer/test/smoke-copy-chart.mjs
//
// A downloaded PNG is three steps from where it is going: save it, find it in
// Downloads, insert it. A PLC agenda or a data-meeting doc wants it pasted.
//
// The interesting part is the failure path, not the happy one. Clipboard image
// writes need a secure context and are unsupported or permission-gated in some
// browsers, so this checks all three outcomes: a real write, a browser with no
// ClipboardItem at all, and a write that is rejected — the last two must fall
// back to the download that already worked and say so, not silently do nothing.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8199;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/037-grade-distribution-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Grade Distribution — copy chart to clipboard');

/** A page with the clipboard API replaced by a recorder, so the test can see
    exactly what the tool tried to put on it. `mode` picks which browser this
    is pretending to be. */
async function pageWithClipboard(mode) {
  const p = await prepPage(browser, BASE, { width: 1300, height: 1100 });
  await p.addInitScript((m) => {
    window.__copied = [];
    window.__downloads = [];
    // Downloads go through an <a download> click; intercept it rather than
    // letting the browser write files during a test run.
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__downloads.push(this.download); return; }
      return realClick.apply(this, arguments);
    };
    if (m === 'none') {
      delete window.ClipboardItem;
      try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) {}
    } else {
      window.ClipboardItem = function (items) { this.items = items; };
      const write = (items) => {
        if (m === 'reject') return Promise.reject(new Error('blocked'));
        return Promise.all(Object.entries(items[0].items).map(async ([type, blob]) => {
          const buf = await blob.arrayBuffer();
          window.__copied.push({ type, bytes: buf.byteLength, sig: new Uint8Array(buf.slice(0, 8)).join(',') });
        }));
      };
      Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    }
  }, mode);
  await p.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(p, 400);
  return p;
}

/** Paste a class's scores in so there is a chart to copy. */
async function enterScores(p) {
  await p.fill("#listName", "Unit 4 Test");
  await p.fill('#scoreInput', ['92', '88', '76', '64', '55', '0', '98', '81', '73', '69'].join('\n'));
  await p.dispatchEvent('#scoreInput', 'input');
  await settle(p, 500);
}

/* ── 1. a browser that can do it ───────────────────────────────────────── */
const page = await pageWithClipboard('ok');
await enterScores(page);

const buttons = await page.$$eval('[data-dl]', els => els.map(e => e.dataset.dl));
ok(buttons.includes('letter-copy') && buttons.includes('hist-copy'),
   'both charts offer a copy button: ' + JSON.stringify(buttons));
ok(buttons.includes('letter-png') && buttons.includes('hist-svg'),
   'and the existing downloads are still there');

await page.click('[data-dl="letter-copy"]');
await page.waitForFunction(() => window.__copied.length > 0, null, { timeout: 10000 });
const copied = await page.evaluate(() => window.__copied);
eq(copied.length, 1, 'one item went to the clipboard');
eq(copied[0].type, 'image/png', 'as a PNG image, not as text or an SVG string');
ok(copied[0].bytes > 1000, `a real image, not an empty blob (${copied[0].bytes} bytes)`);
eq(copied[0].sig, '137,80,78,71,13,10,26,10', 'and it really is PNG — the file signature says so');

const status = await page.textContent('.chart-dl-row .copy-status');
ok(/Copied/.test(status), 'the button says it worked: ' + status);
eq(await page.evaluate(() => window.__downloads.length), 0,
   'and nothing was downloaded — the whole point is skipping that step');

// The histogram is a different chart and copies its own image.
await page.click('[data-dl="hist-copy"]');
await page.waitForFunction(() => window.__copied.length > 1, null, { timeout: 10000 });
const both = await page.evaluate(() => window.__copied);
ok(both[1].bytes !== both[0].bytes, 'the histogram copies a different image from the letter bar');

// Copying does not disturb the charts or the page.
ok((await page.textContent('#outputBody')).includes('Letter-grade breakdown'), 'the page is unchanged after copying');

/* ── 2. a browser with no clipboard image support ──────────────────────── */
const noClip = await pageWithClipboard('none');
await enterScores(noClip);
await noClip.click('[data-dl="letter-copy"]');
await noClip.waitForFunction(() => window.__downloads.length > 0, null, { timeout: 10000 });
const noClipStatus = await noClip.textContent('.chart-dl-row .copy-status');
ok(/can’t put an image on the clipboard/.test(noClipStatus),
   'an unsupported browser is told why: ' + noClipStatus);
ok(/\.png$/.test((await noClip.evaluate(() => window.__downloads))[0]),
   'and gets the PNG downloaded instead of nothing happening');
ok(await noClip.$eval('.chart-dl-row .copy-status', e => e.classList.contains('error')),
   'the message reads as a problem, not a success');

/* ── 3. a browser that refuses the write ───────────────────────────────── */
const denied = await pageWithClipboard('reject');
await enterScores(denied);
await denied.click('[data-dl="hist-copy"]');
await denied.waitForFunction(() => window.__downloads.length > 0, null, { timeout: 10000 });
ok(/clipboard was blocked/.test(await denied.textContent('.chart-dl-row .copy-status')),
   'a blocked clipboard is reported');
ok((await denied.evaluate(() => window.__downloads))[0].includes('histogram'),
   'and the right chart is downloaded as the fallback');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['ok', page], ['no-clipboard', noClip], ['denied', denied]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
