// smoke-share.mjs — the Bracket / Tournament Generator's "Share bracket…" sheet.
//
//   node Tools/bracket-tournament-generator/test/smoke-share.mjs
//
// Path 6 P2's third increment replaced two controls that stood side by side
// in this tool's toolbar with one: state-link.js's own mountShareControl (a
// copy-link button that module built itself, every message through alert())
// and a hand-rolled "QR code" modal with its own drawBracketQr.
//
// The QR is the part whose BEHAVIOUR changed, and section 3 is why this file
// exists. drawBracketQr drew whatever the vendored encoder accepted, at a
// fixed 6 px per module, and only refused when the encoder itself threw past
// version 40 — so a bracket big enough to reach version 30-plus was drawn,
// the overlay opened, and the tool called that a success. Nobody's phone
// reads a code at that density. qr-draw.js's budget is measured (see
// Tools/share/test/qr-draw.test.mjs, which blurs codes and decodes them with
// the vendored jsQR) and the row is greyed out with the reason instead.
//
// Section 5 scans the open sheet with axe: it is a dialog behind a saved
// bracket AND a click, so the site-wide sweep — which opens every page with
// empty storage and cannot click — has never seen it.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8232;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/020-bracket-tournament-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });

console.log('Bracket / Tournament Generator — share a bracket');

const build = async (p, name, entrants) => {
  await p.fill('#bracketName', name);
  await p.fill('#contestants', entrants.join('\n'));
  await p.click('#generateBtn');
  await settle(p, 500);
};

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await build(page, 'Period 3 Trivia', ['Cartographers', 'Navigators', 'Astronomers', 'Chroniclers']);

/* ── 1. the button is a real button in the toolbar ──────────────────────── */
eq(await page.isVisible('#shareBtn'), true, 'the toolbar has a Share bracket… button');
eq(await page.$('#qrBtn'), null, 'and the separate QR code button it replaced is gone');
eq(await page.$('#qrOverlay'), null, 'along with the hand-rolled QR modal');

/* Opens the sheet, clicks the Copy link row, and CLOSES it in the same call:
   the sheet is a real modal with a backdrop, and leaving it open makes the
   next click on the page miss. */
const shareLink = async (p = page) => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};

/* ── 2. the link round-trips a bracket, picks and all ───────────────────── */
/* Make a pick first, so "the bracket as it stands" is distinguishable from
   "the bracket as it was generated". */
await page.evaluate(() => {
  const slot = document.querySelector('.slot .name, .slot');
  if (slot) slot.click();
});
await settle(page, 300);

const url = await shareLink();
ok(url && url.indexOf('bracket=') !== -1, 'the Copy link row produces a ?bracket= link');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and the note under the toolbar says so, in place of the old alert()');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('bracket')), url);
eq(payload.name, 'Period 3 Trivia', 'the payload carries the bracket name');
ok(Array.isArray(payload.slots) && payload.slots.length > 0, 'and its slots');
ok(JSON.stringify(payload).includes('Cartographers'), 'with the entrants in them');

const other = await prepPage(browser, BASE, { width: 1300, height: 950 });
await other.goto(url, { waitUntil: 'load' });
await settle(other, 800);
ok(/Period 3 Trivia/.test(await other.textContent('#bracketSwitch')), 'the receiving browser has the bracket');
ok(/Loaded a shared bracket/.test(await other.textContent('#shareNote')), 'and says so where the alert() used to be');
eq(new URL(other.url()).searchParams.get('bracket'), null,
  'the parameter is consumed on open, so a refresh cannot import it twice');

/* ── 3. THE ASSERTION THIS FILE EXISTS FOR: the QR budget ───────────────── */
/* A four-team bracket is small; its code must actually be drawn. */
await page.click('#shareBtn');
await settle(page, 250);
const smallQr = await page.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return { disabled: b.disabled, sub: b.querySelector('small').textContent };
});
eq(smallQr.disabled, false, 'a four-team bracket is inside the budget, so the QR row is live');
ok(/\d+×\d+/.test(smallQr.sub), 'and the row states the module count: ' + JSON.stringify(smallQr.sub));
await page.click('.share-sheet button[data-share="qr"]');
await settle(page, 250);
const drawn = await page.evaluate(() => {
  const c = document.querySelector('.share-sheet-qr canvas');
  return { w: c.width, cssW: parseInt(c.style.width, 10) };
});
ok(drawn.w > 100, `a QR was drawn (${drawn.w} device px)`);
ok(drawn.cssW > 0 && drawn.w % 1 === 0, 'at an integer number of device pixels per module, which is what a decoder needs');
await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');

/* Now a bracket the old code would have drawn anyway. 32 entrants with long
   names is well past what a code can be READ at on a sheet this wide. */
const big = await prepPage(browser, BASE, { width: 1300, height: 950 });
await big.goto(URL_PAGE, { waitUntil: 'load' });
await settle(big, 500);
const many = Array.from({ length: 32 }, (_, i) =>
  'Expedition Team ' + String(i + 1).padStart(2, '0') + ' — Cartography and Navigation');
await build(big, 'Whole Grade Championship', many);
await big.click('#shareBtn');
await settle(big, 300);
const bigQr = await big.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return {
    disabled: b.disabled,
    sub: b.querySelector('small').textContent,
    reason: (document.querySelector('.share-sheet-reason') || {}).textContent || '',
  };
});
eq(bigQr.disabled, true, 'a 32-entrant bracket is past the readable budget, so the QR row is disabled');
ok(/(KB|modules)/.test(bigQr.reason), 'with a reason naming the size: ' + JSON.stringify(bigQr.reason));
ok(/Copy the link|download the file/.test(bigQr.reason), 'and the way round it');
ok(await big.isVisible('.share-sheet button[data-share="copy"]'),
  'while copy-link, which has no such limit, stays available');
/* The row a disabled control needs to be readable at all. */
const describedBy = await big.evaluate(() =>
  document.querySelector('.share-sheet button[data-share="qr"]').getAttribute('aria-describedby'));
ok(describedBy && describedBy.length > 0, 'the greyed row points at that reason for a screen reader');

/* ── 4. the download is the whole bracket, in the shared envelope ───────── */
const file = await big.evaluate(() => {
  let text = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
  document.querySelector('.share-sheet button[data-share="download"]').click();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 200));
});
const parsed = JSON.parse(file);
eq(parsed.aplp.tool, 'bracket-tournament-generator', 'the file says which tool it belongs to');
eq(parsed.aplp.param, 'bracket', 'and which parameter it is a payload for');
eq(parsed.state.name, 'Whole Grade Championship', 'and carries the bracket');
const unwrapped = await big.evaluate(t => window.Share.unwrap(JSON.parse(t)), file);
eq(unwrapped.name, 'Whole Grade Championship', 'Share.unwrap() reads that envelope back as a plain payload');

/* ── 5. axe, on the open sheet — a state the site-wide sweep cannot reach ── */
const sheetViolations = await a11yScan(big, { impact: 'serious', include: '.share-sheet' });
eq(sheetViolations.length, 0, 'no serious/critical axe violations on the open sheet: ' +
  JSON.stringify(sheetViolations.map(v => v.id)));
await big.keyboard.press('Escape');
await settle(big, 200);

/* ── 6. a mangled link fails in words, once ─────────────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?bracket=not-base64-%%%', { waitUntil: 'load' });
await settle(broken, 700);
ok(/could not be read/.test(await broken.textContent('#shareNote')),
  'a mangled link says so rather than opening blank: ' + JSON.stringify(await broken.textContent('#shareNote')));
eq(new URL(broken.url()).searchParams.get('bracket'), null,
  'and is cleared even though it was unusable, so a refresh does not repeat the failure');

/* ── 7. no console noise ────────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['big', big], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
