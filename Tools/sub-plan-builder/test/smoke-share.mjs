// smoke-share.mjs — the Sub Plan Builder's share-by-link.
//
//   node Tools/sub-plan-builder/test/smoke-share.mjs
//
// A finished sub plan almost always has to reach somebody else — the front
// office, the department chair, whoever is covering first period — and the only
// ways out of the tool were a .docx download and a text blob to paste. Both
// mean an attachment. _shared/state-link.js puts the plan inside the URL, so a
// link opens it on another machine with no server and no file.
//
// The assertion that matters most is the last one: the Student Notes box must
// never be in the link. That box is documented on the page as never being
// stored anywhere, and a link is storage — it lands in a chat log, an email, a
// browser history. The saved history already draws that line; the link has to
// draw the same one.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8163;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/044-Sub%20Plan%20Builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });

const SECRET = 'Period 3 — Jane D. has extended time on all written work per her 504.';

/** The URL the copy button would put on the clipboard. Read through the page's
 *  own StateLink rather than the clipboard, which headless Chromium will not
 *  hand back without a permission grant. */
const shareLink = () => page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('btnCopyPlanLink').click();
  return new Promise(r => setTimeout(() => r(captured), 50));
});

console.log('Sub Plan Builder — share a plan by link or QR');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── fill in a two-day plan, plus the box that must not travel ─────────── */
await page.fill('#teacherName', 'D. Moore');
await page.fill('#roomNumber', '214');
await page.fill('#planDate', '2026-09-14');
await page.fill('#numDays', '2');
await page.dispatchEvent('#numDays', 'input');
await settle(page, 250);
await page.fill('#lessonTitle', 'Fall of Rome — video');
await page.fill('#overviewText', 'Play the video, then the written response.');
await page.fill('#scheduleText', '**First 10 min:** attendance and the do-now on the board.');
await page.fill('#materialsNote', 'Worksheets are stapled on my desk.');
await page.fill('#studentNotes', SECRET);
await settle(page, 300);

// Second day out gets its own content, so the link has to carry both.
const tabs = await page.$$('#dayTabs button[data-day]');
ok(tabs.length === 2, `a two-day absence shows two day tabs (got ${tabs.length})`);
await tabs[1].click();
await settle(page, 250);
await page.fill('#lessonTitle', 'Fall of Rome — written response');
await page.fill('#overviewText', 'Collect the response sheets at the end of the period.');
await settle(page, 300);

/* ── 1. the link is built, and decodes to the whole plan ───────────────── */
const url = await shareLink();
ok(url && url.indexOf('plan=') !== -1, 'the copy button produces a ?plan= link');
ok(/Link copied/.test(await page.textContent('#shareNote')), 'and says so');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('plan')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.standing.teacherName, 'D. Moore', 'standing details travel — a plan without them is not actionable');
eq(payload.standing.roomNumber, '214', 'including the room number');
eq(Object.keys(payload.days).length, 2, 'both days out are in the link');
eq(payload.days['2026-09-14'].lessonTitle, 'Fall of Rome — video', 'the first day keeps its lesson title');
ok(/written response/.test(payload.days['2026-09-15'].lessonTitle), 'and the second day its own');
ok(/First 10 min/.test(payload.days['2026-09-14'].scheduleText), 'the schedule text travels with its markdown intact');

/* ── 2. the Student Notes box is not in the link. At all. ──────────────── */
ok(!/504/.test(url), 'the student note is nowhere in the URL');
ok(JSON.stringify(payload).indexOf('504') === -1, 'nor anywhere in the decoded payload');
ok(JSON.stringify(payload).indexOf('Jane D') === -1, 'not even the name');
eq(await page.inputValue('#studentNotes'), SECRET, 'while still sitting in the box on this page');

/* ── 3. opening the link elsewhere rebuilds the plan ───────────────────── */
/* The parameter is stripped from the address bar the moment it is read, so a
   refresh — or a bookmark made after opening — cannot re-import the same plan
   over whatever the receiving teacher has done since. */
const consumed = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await consumed.goto(url, { waitUntil: 'networkidle' });
await settle(consumed, 400);
eq(new URL(consumed.url()).searchParams.get('plan'), null, 'the link parameter is consumed on open');

const arrival = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await arrival.addInitScript(() => { window.confirm = () => true; });
await arrival.goto(url, { waitUntil: 'networkidle' });
await settle(arrival, 600);
eq(await arrival.inputValue('#teacherName'), 'D. Moore', 'the receiving browser gets the standing details');
eq(await arrival.inputValue('#roomNumber'), '214', 'including the room');
eq(await arrival.inputValue('#planDate'), '2026-09-14', 'and the dates');
eq(await arrival.inputValue('#numDays'), '2', 'and how many days out');
eq(await arrival.inputValue('#lessonTitle'), 'Fall of Rome — video', 'and the first day it lands on');
eq(await arrival.inputValue('#studentNotes'), '', 'and an empty Student Notes box, because that never travelled');
ok(/Opened a shared plan/.test(await arrival.textContent('#shareNote')), 'with a note saying where it came from');

const arrivalTabs = await arrival.$$('#dayTabs button[data-day]');
eq(arrivalTabs.length, 2, 'both days out arrive');
await arrivalTabs[1].click();
await settle(arrival, 250);
ok(/written response/.test(await arrival.inputValue('#lessonTitle')), 'and the second day has its own content');

/* ── 4. declining leaves the receiving browser alone ───────────────────── */
const declined = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await declined.addInitScript(() => { window.confirm = () => false; });
await declined.goto(url, { waitUntil: 'networkidle' });
await settle(declined, 500);
eq(await declined.inputValue('#roomNumber'), '', 'declining the confirm changes nothing on the page');
ok(/not opened/.test(await declined.textContent('#shareNote')), 'and says so plainly');

/* ── 5. a mangled link fails loudly, not silently ──────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 1000 });
await broken.goto(URL_PAGE + '?plan=this-is-not-base64-%%%', { waitUntil: 'networkidle' });
await settle(broken, 400);
ok(/could not be read/.test(await broken.textContent('#shareNote')), 'a truncated or mangled link says so');

/* ── 6. the QR path ────────────────────────────────────────────────────── */
await page.click('#btnPlanQr');
await settle(page, 400);
const qr = await page.evaluate(() => {
  const c = document.getElementById('qrCanvas');
  const overlayOpen = !document.getElementById('qrOverlay').hidden;
  return { overlayOpen, w: c.width, h: c.height, note: document.getElementById('shareNote').textContent };
});
console.log(`  link is ${(url.length / 1024).toFixed(1)} KB; QR ${qr.overlayOpen ? 'drawn' : 'refused as too long'}`);
if (qr.overlayOpen) {
  ok(qr.w > 100 && qr.w === qr.h, `a square QR was drawn (${qr.w}x${qr.h})`);
  await page.click('#qrCloseBtn');
  await settle(page, 200);
  eq(await page.evaluate(() => document.getElementById('qrOverlay').hidden), true, 'and closes again');
} else {
  // A long plan is legitimately past what a QR can hold; the tool has to say
  // so rather than draw an unscannable square.
  ok(/too long to fit in a QR/.test(qr.note), 'an over-long plan is refused by name, pointing at the link instead');
}

/* A QR holds far less than a URL bar does, and a plan with several days of
   detailed notes runs past what any scanner will read. The failure has to be
   named — an unscannable grey square is worse than a refusal. */
await page.fill('#overviewText', 'Detailed instructions. '.repeat(220));
await settle(page, 300);
await page.click('#btnPlanQr');
await settle(page, 400);
ok(/too long to fit in a QR/.test(await page.textContent('#shareNote')),
   'an over-long plan is refused by name, pointing at the copy-link button instead');
eq(await page.evaluate(() => document.getElementById('qrOverlay').hidden), true,
   'and no unscannable square is shown');
ok((await shareLink()).length > 4000, 'while the link itself still works at that size');

/* ── 7. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['builder', page], ['arrival', arrival], ['declined', declined], ['broken', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
