// smoke-share.mjs — the Group / Team Generator's share-a-grouping link.
//
//   node Tools/group-team-generator/test/smoke-share.mjs
//
// The tool could print a grouping or copy it as text. What it could not do is
// hand somebody the arrangement itself: a co-teacher or a substitute reading a
// copied-text version has to retype it, and re-running the shuffle on their
// machine gives a different answer, which defeats the point.
//
// The design decision under test is what travels. The link carries the RESULT
// — the group labels and who is in each one — and nothing else. Not the
// roster, not the keep-apart list, not the skill numbers, not the pairing
// memory. A shared grouping is a read-only artifact, and nobody wants their
// keep-apart pairs leaving with it.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8167;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

const NAMES = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida B Wells'];

/** The URL the Copy Link button would put on the clipboard. */
const shareLink = () => page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('share-link-btn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});

const groupsOnScreen = (p) => p.evaluate(() =>
  Array.from(document.querySelectorAll('#results .group-card')).map(c => ({
    label: (c.querySelector('h3 span') || {}).textContent || '',
    members: Array.from(c.querySelectorAll('li, .member, .student')).map(n => n.textContent.trim()).filter(Boolean),
  })));

console.log('Group / Team Generator — share a grouping by link');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

/* ── build a grouping, with a keep-apart pair that must not travel ─────── */
await page.fill('#names-input', NAMES.join('\n'));
await page.dispatchEvent('#names-input', 'input');
await settle(page, 300);
/* A real keep-apart pair, added through the tool's own control — the point of
   the payload assertions below is that it does not travel with the grouping. */
await page.selectOption('#pair-a', 'Ada Lovelace');
await page.selectOption('#pair-b', 'Marco Polo');
await page.click('#add-pair-btn');
await settle(page, 300);
ok(/Ada Lovelace/.test(await page.textContent('#pair-list')), 'a keep-apart pair is on file before sharing');
await page.click('#generate-btn');
await settle(page, 600);

const made = await groupsOnScreen(page);
ok(made.length >= 2, `a grouping was generated (${made.length} groups)`);
const totalMembers = made.reduce((n, g) => n + g.members.length, 0);
eq(totalMembers, NAMES.length, 'with everybody in it');

/* ── 1. the link is built from the arrangement on screen ───────────────── */
const url = await shareLink();
ok(url && url.indexOf('groups=') !== -1, 'Copy Link produces a ?groups= link');
ok(/Link copied/.test(await page.textContent('#share-note')), 'and says so');

const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('groups')), url);
eq(payload.v, 1, 'the payload is versioned');
eq(payload.groups.length, made.length, 'it carries every group');
eq(payload.groups.reduce((n, g) => n + g.members.length, 0), NAMES.length, 'and every student');
eq(payload.groups[0].label, made[0].label, 'with the labels as they read on screen');

/* ── 2. what does NOT travel is the point ──────────────────────────────── */
const asText = JSON.stringify(payload);
ok(!/keepApart|keep_apart|apart/i.test(asText), 'the keep-apart list is not in the payload');
ok(!/pairHistory|history/i.test(asText), 'nor the pairing memory');
ok(!/skill/i.test(asText), 'nor skill numbers');
ok(!/strategy|oddMode|splitValue/i.test(asText), 'nor the generator settings');
ok(asText.indexOf('"members"') !== -1, 'what it does carry is the members of each group');

/* ── 3. opening it elsewhere gives the identical arrangement ───────────── */
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await other.goto(url, { waitUntil: 'networkidle' });
await settle(other, 700);

const arrived = await groupsOnScreen(other);
eq(arrived.length, made.length, 'the receiving browser shows the same number of groups');
eq(JSON.stringify(arrived.map(g => g.members.sort())), JSON.stringify(made.map(g => g.members.sort())),
   'with exactly the same people in exactly the same groups');
eq(arrived[0].label, made[0].label, 'and the same labels');
ok(/read-only copy/.test(await other.textContent('#explain-area')), 'flagged as somebody else\'s arrangement');
ok(/shared link/.test(await other.textContent('#explain-area')), 'and as having come from a link');

eq(new URL(other.url()).searchParams.get('groups'), null,
   'the parameter is consumed on open, so a refresh cannot re-import it');

/* ── 4. nothing is written to the receiving browser ────────────────────── */
const stored = await other.evaluate(() => {
  const out = {};
  for (const k of Object.keys(localStorage)) if (/^gtg/.test(k)) out[k] = localStorage.getItem(k);
  return out;
});
ok(!JSON.stringify(stored).includes('Nellie Bly'),
   'no student from the shared grouping was saved into this browser: ' + JSON.stringify(Object.keys(stored)));

/* ── 5. the receiving browser can still print and copy it ──────────────── */
eq(await other.isVisible('#print-btn'), true, 'the print button is available on a shared grouping');
eq(await other.isVisible('#print-tents-btn'), true, 'and table tents');

/* ── 6. sharing before generating anything says so ─────────────────────── */
const fresh = await prepPage(browser, BASE, { width: 1200, height: 900 });
await fresh.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(fresh, 500);
eq(await fresh.isVisible('#share-link-btn'), false, 'the share buttons are hidden until there is a grouping');

/* ── 7. a mangled link fails loudly ────────────────────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?groups=not-base64-%%%', { waitUntil: 'networkidle' });
await settle(broken, 500);
ok(/could not be read/.test(await broken.textContent('#share-note')), 'a mangled link says so rather than opening blank');

/* ── 8. the QR path ────────────────────────────────────────────────────── */
await page.click('#share-qr-btn');
await settle(page, 400);
const qr = await page.evaluate(() => ({
  open: !document.getElementById('share-overlay').hidden,
  w: document.getElementById('share-canvas').width,
  note: document.getElementById('share-note').textContent,
}));
if (qr.open) {
  ok(qr.w > 100, `a QR was drawn (${qr.w}px)`);
  await page.click('#share-close-btn');
  await settle(page, 200);
  eq(await page.evaluate(() => document.getElementById('share-overlay').hidden), true, 'and closes again');
} else {
  ok(/too big to fit in a QR/.test(qr.note), 'an over-large grouping is refused by name');
}

/* ── 9. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
