// smoke-story-worksheet.mjs — Timeline Builder's story mode (the projector
// playthrough) and the timeline worksheet print.
//
//   node Tools/timeline-builder/test/smoke-story-worksheet.mjs
//
// Sibling of smoke-map-print.mjs, which covers places / the map+timeline page /
// share links. What is worth a machine's attention here:
//
//   1. Story mode steps through every event in chronological order, once each,
//      and stops at both ends. Off-by-one here means a class watches the last
//      event twice, or never sees the first.
//   2. The map highlights the pin belonging to the event on screen — not the
//      pin belonging to the previous one. Since the base map is rendered once
//      and moved with a CSS transform, "highlights nothing" and "highlights
//      the wrong thing" both still look like a working map from across a room.
//   3. An event with no place keeps the previous map view and dims the map,
//      rather than snapping back to a world view. That's the documented rule
//      and it is easy to lose in a refactor.
//   4. Esc leaves cleanly and, crucially, UNBINDS the arrow keys — story mode
//      binds keydown on the document, so a leak would leave a teacher unable
//      to type an arrow key or a space into the event form afterwards. That
//      is the failure this file exists to prevent.
//   5. The worksheet blanks exactly the count asked for, its word bank holds
//      exactly the removed titles, and the answer key matches the blanks —
//      including across versions, and identically on a reprint (the seeded
//      shuffle's entire purpose: reprinting a lost copy of version 2 has to
//      give back the same paper the answer key on the desk was made for).
//
// window.print is stubbed before any print click, for the same reason the
// sibling suite documents: headless Chromium's print() is a no-op that never
// fires afterprint, so assertions read the built DOM.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8189;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/015-timeline-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

console.log('Timeline Builder — story mode + timeline worksheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(() => {
  window.__printCalls = 0;
  window.print = () => { window.__printCalls++; };
});

// The shipped American Revolution example is the demo case the feature was
// built against: eleven events, ten with places, one deliberately without.
page.once('dialog', d => d.accept());
await page.click('#loadExampleBtn');
await settle(page, 500);

const timeline = await page.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  return JSON.parse(localStorage.getItem('gvb-timeline:data:' + name));
});
const chrono = timeline.events.slice().sort((a, b) => a.yearStart - b.yearStart);
const placedIds = chrono.filter(e => e.place && typeof e.place.lat === 'number').map(e => e.id);
ok(chrono.length >= 8, 'the example timeline loaded: ' + chrono.length + ' events');
ok(placedIds.length > 0 && placedIds.length < chrono.length,
  'with some placed and at least one unplaced: ' + placedIds.length + ' of ' + chrono.length);

/* ── 1. story mode opens on the first event ────────────────────────────── */

const blockedBefore = page.__blocked.length;
await page.click('#presentBtn');
await settle(page, 300);

ok(await page.isVisible('#storyOverlay'), 'Present opens the story overlay');
eq(await page.textContent('#storyCounter'), '1 of ' + chrono.length, 'it opens on step 1');
eq(await page.textContent('#storyEventTitle'), chrono[0].title, 'showing the earliest event');
eq(await page.textContent('#storyTitle'), timeline.title || timeline.name, 'with the timeline name in the header');
ok((await page.textContent('#storyDesc')).length > 0, 'and that event’s description');
eq(await page.isDisabled('#storyPrevBtn'), true, 'Back is disabled on the first step');
eq(await page.isDisabled('#storyNextBtn'), false, 'Next is not');

// The base map is a real vector render off the vendored data; give it room.
await page.waitForSelector('#storyMapLayer img', { timeout: 60000 });
await settle(page, 900);

const mapState = await page.evaluate(() => ({
  src: (document.querySelector('#storyMapLayer img') || {}).src || '',
  pins: document.querySelectorAll('#storyMapLayer .story-pin').length,
  currentPin: (document.querySelector('#storyMapLayer .story-pin.current') || {}).dataset?.eventId || null,
  currentPins: document.querySelectorAll('#storyMapLayer .story-pin.current').length,
  transform: document.getElementById('storyMapLayer').style.transform,
  ticks: document.querySelectorAll('#storyStrip .story-tick').length,
  currentTicks: document.querySelectorAll('#storyStrip .story-tick.current').length,
}));
ok(mapState.src.startsWith('data:image/png'), 'the map is a locally rendered PNG data URL, not a fetched image');
eq(mapState.pins, placedIds.length, 'one pin per placed event');
eq(mapState.currentPins, 1, 'exactly one pin is highlighted');
eq(mapState.currentPin, String(chrono[0].id), 'and it is the pin for the event on screen');
ok(/scale\(/.test(mapState.transform), 'the map layer carries a pan/zoom transform: ' + mapState.transform);

// The context strip is the whole timeline, so students keep the sequence in
// view while one event fills the screen.
eq(mapState.ticks, chrono.length, 'the context strip has one tick per event');
eq(mapState.currentTicks, 1, 'with the current one highlighted');

eq(page.__blocked.length - blockedBefore, 0,
  'nothing offsite was requested to present: ' + JSON.stringify(page.__blocked.slice(-3)));

/* ── 2. it steps in order, by click and by arrow key ───────────────────── */

const step = async () => {
  await settle(page, 850); // let the pan finish so the transform read below is the settled one
  return page.evaluate(() => ({
    counter: document.getElementById('storyCounter').textContent,
    title: document.getElementById('storyEventTitle').textContent,
    currentPin: (document.querySelector('#storyMapLayer .story-pin.current') || {}).dataset?.eventId || null,
    dimmed: document.getElementById('storyMap').classList.contains('dimmed'),
    transform: document.getElementById('storyMapLayer').style.transform,
    doneTicks: document.querySelectorAll('#storyStrip .story-tick.done').length,
  }));
};

await page.click('#storyNextBtn');
const s2 = await step();
eq(s2.counter, '2 of ' + chrono.length, 'Next advances one step');
eq(s2.title, chrono[1].title, 'to the second event chronologically');
eq(s2.doneTicks, 1, 'and the strip marks the step already covered');

await page.keyboard.press('ArrowRight');
const s3 = await step();
eq(s3.counter, '3 of ' + chrono.length, 'the right arrow advances too');
eq(s3.title, chrono[2].title, 'to the third event');

await page.keyboard.press('ArrowLeft');
const back2 = await step();
eq(back2.counter, '2 of ' + chrono.length, 'the left arrow goes back');
eq(back2.title, chrono[1].title, 'to the event it came from');

await page.keyboard.press('Space');
const fwd3 = await step();
eq(fwd3.counter, '3 of ' + chrono.length, 'space advances as well (a presenter remote sends it)');

// Walk the whole thing and check every step lines up with the chronological
// order and with its own pin. A single off-by-one anywhere shows up here.
await page.keyboard.press('Home');
await settle(page, 400);
const walked = [];
for (let i = 0; i < chrono.length; i++) {
  if (i) await page.keyboard.press('ArrowRight');
  walked.push(await step());
}
ok(walked.every((w, i) => w.title === chrono[i].title),
  'every step shows its own event, in order: ' + JSON.stringify(walked.map(w => w.title).slice(0, 3)) + '…');
ok(walked.every((w, i) => (placedIds.includes(chrono[i].id) ? w.currentPin === String(chrono[i].id) : true)),
  'and every placed event highlights its own pin');

// An unplaced event keeps the previous view and dims the map — the documented
// rule, and the reason a class isn't thrown back to a world view mid-story.
const unplacedIdx = chrono.findIndex(e => !(e.place && typeof e.place.lat === 'number'));
ok(unplacedIdx > 0, 'the example has an unplaced event to check, at step ' + (unplacedIdx + 1));
eq(walked[unplacedIdx].dimmed, true, 'the map dims on the event with no place');
eq(walked[unplacedIdx].transform, walked[unplacedIdx - 1].transform,
  'and holds the previous event’s view rather than jumping');
eq(walked[unplacedIdx].currentPin, null, 'with no pin highlighted');
ok(walked.filter((w, i) => placedIds.includes(chrono[i].id)).every(w => w.dimmed === false),
  'placed events do not dim the map');

// Different places really do move the map, rather than every step rendering
// the same view with a different caption.
const placedTransforms = new Set(walked.filter((w, i) => placedIds.includes(chrono[i].id)).map(w => w.transform));
ok(placedTransforms.size > 1, 'the map view actually changes between places: ' + placedTransforms.size + ' distinct views');

// Both ends stop rather than wrapping or running off.
await page.keyboard.press('End');
await settle(page, 850);
eq(await page.textContent('#storyCounter'), chrono.length + ' of ' + chrono.length, 'End jumps to the last step');
eq(await page.isDisabled('#storyNextBtn'), true, 'where Next is disabled');
await page.keyboard.press('ArrowRight');
await settle(page, 300);
eq(await page.textContent('#storyCounter'), chrono.length + ' of ' + chrono.length, 'and stepping past the end does nothing');

/* ── 3. Esc exits cleanly and gives the keyboard back ──────────────────── */

await page.keyboard.press('Escape');
await settle(page, 300);
const afterExit = await page.evaluate(() => ({
  hidden: document.getElementById('storyOverlay').hidden,
  layer: document.getElementById('storyMapLayer').innerHTML.length,
  transform: document.getElementById('storyMapLayer').style.transform,
  dimmed: document.getElementById('storyMap').classList.contains('dimmed'),
}));
eq(afterExit.hidden, true, 'Esc closes story mode');
eq(afterExit.layer, 0, 'and releases the base map bitmap');
eq(afterExit.transform, '', 'and clears the pan transform');
eq(afterExit.dimmed, false, 'and the dim state');

// The whole point of binding keydown only while presenting: arrow keys and
// space have to reach the teacher's own form afterwards.
await page.click('#evTitle');
await page.keyboard.type('Battle of');
await page.keyboard.press('Space');
await page.keyboard.type('Trenton');
await page.keyboard.press('ArrowLeft');
eq(await page.inputValue('#evTitle'), 'Battle of Trenton',
  'arrow keys and space reach the event form again after exiting');
eq(await page.isVisible('#storyOverlay'), false, 'and do not reopen story mode');
await page.fill('#evTitle', '');

/* ── 4. the worksheet blanks the chosen count, with a matching key ─────── */

await page.click('#worksheetToggleBtn');
await settle(page, 150);
await page.fill('#wsBlankCount', '4');
await page.dispatchEvent('#wsBlankCount', 'change');
await page.selectOption('#wsVersions', '2');
await settle(page, 150);
ok(/4 of \d+/.test(await page.textContent('#wsCountNote')),
  'the panel says how many will be blanked: ' + (await page.textContent('#wsCountNote')));

await page.evaluate(() => { window.__printCalls = 0; });
await page.click('#btnWorksheetGo');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 30000 });
await settle(page, 300);

const readWorksheet = () => page.evaluate(() => {
  const pages = Array.from(document.querySelectorAll('#worksheetPages .wsPage'));
  return {
    count: pages.length,
    bodyClass: document.body.className,
    pages: pages.map(p => ({
      heading: p.querySelector('h2').textContent,
      badges: Array.from(p.querySelectorAll('.blank-num')).map(b => b.textContent).sort((a, b) => a - b),
      blanked: p.querySelectorAll('.lbl-blank').length,
      titlesShown: Array.from(p.querySelectorAll('.wsStrip .lbl-title')).map(t => t.textContent.trim()).filter(Boolean).length,
      items: p.querySelectorAll('.wsItem').length,
      answers: Array.from(p.querySelectorAll('.wsAnswer')).map(a => a.textContent),
      bank: Array.from(p.querySelectorAll('.wsBankWord')).map(w => w.textContent),
      photos: p.querySelectorAll('.wsStrip .event-label img').length,
    })),
  };
});
const ws = await readWorksheet();

eq(ws.count, 4, 'two versions with answer keys build four pages');
ok(/worksheet/i.test(ws.pages[0].heading), 'page 1 is the worksheet: ' + ws.pages[0].heading);
ok(/answer key/i.test(ws.pages[1].heading), 'page 2 is its answer key: ' + ws.pages[1].heading);

const v1 = ws.pages[0], k1 = ws.pages[1], v2 = ws.pages[2], k2 = ws.pages[3];
eq(v1.badges.join(','), '1,2,3,4', 'the strip carries numbered blanks 1-4');
eq(v1.blanked, 4, 'exactly four titles are blanked out on the strip');
eq(v1.items, 4, 'with four numbered answer lines');
eq(v1.answers.length, 0, 'and no answers printed on the student copy');
eq(v1.bank.length, 4, 'the word bank holds four words');

// The key is the same paper with the answers filled in — same numbers, no
// blanks, and the answer text in number order.
eq(k1.badges.join(','), '1,2,3,4', 'the key carries the same four numbers');
eq(k1.blanked, 0, 'with nothing blanked out on its strip');
eq(k1.answers.length, 4, 'and four answers listed');
eq(k1.bank.length, 0, 'no word bank on the key (it already lists every answer)');
eq([...v1.bank].sort().join('|'), [...k1.answers].sort().join('|'),
  'the word bank is exactly the set of removed titles');
ok(k1.answers.every(a => chrono.some(e => e.title === a)),
  'every answer is a real event from this timeline: ' + JSON.stringify(k1.answers));

// The answers run in chronological order, because the numbers run left to
// right along the strip.
const answerYears = k1.answers.map(a => chrono.find(e => e.title === a).yearStart);
ok(answerYears.every((y, i) => i === 0 || y >= answerYears[i - 1]),
  'the numbering runs chronologically along the strip: ' + JSON.stringify(answerYears));

// A photo on a blanked event would answer the question the blank is asking.
eq(v1.photos, 0, 'no event photos are printed on the strip (a photo gives the answer away)');

// Versions differ, or a class of thirty gets thirty identical papers.
ok([...v2.bank].sort().join('|') !== [...v1.bank].sort().join('|'),
  'version 2 blanks a different set of events');
eq(k2.answers.length, 4, 'and its key lists its own four answers');
eq([...v2.bank].sort().join('|'), [...k2.answers].sort().join('|'),
  'with its own matching word bank');

eq(/worksheet-printing/.test(ws.bodyClass), true, 'the page is in worksheet-print mode');

/* ── 5. a reprint gives back the same paper (the seeded shuffle's point) ── */

await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
const afterWsTeardown = await page.evaluate(() => ({
  bodyClass: document.body.className,
  pages: document.getElementById('worksheetPages').innerHTML.length,
  pageStyle: !!document.getElementById('tiledPageSizeStyle'),
}));
ok(!/worksheet-printing/.test(afterWsTeardown.bodyClass), 'afterprint clears worksheet-print mode');
eq(afterWsTeardown.pages, 0, 'and empties the built pages');
eq(afterWsTeardown.pageStyle, false, 'and removes the landscape @page rule');

await page.click('#worksheetToggleBtn');
await settle(page, 150);
await page.evaluate(() => { window.__printCalls = 0; });
await page.click('#btnWorksheetGo');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 30000 });
await settle(page, 300);
const reprint = await readWorksheet();
eq(reprint.pages[1].answers.join('|'), k1.answers.join('|'),
  'reprinting version 1 gives back the identical paper the answer key was made for');
eq(reprint.pages[0].bank.join('|'), v1.bank.join('|'), 'including the same word-bank order');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 6. the blank count is clamped to what exists ──────────────────────── */

await page.click('#worksheetToggleBtn');
await settle(page, 150);
await page.fill('#wsBlankCount', '99');
await page.dispatchEvent('#wsBlankCount', 'change');
await settle(page, 200);
eq(await page.inputValue('#wsBlankCount'), String(chrono.length),
  'asking for more blanks than there are events clamps to the events that exist');

await page.selectOption('#wsVersions', '1');
await page.evaluate(() => { window.__printCalls = 0; });
await page.click('#btnWorksheetGo');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 30000 });
await settle(page, 300);
const allBlank = await readWorksheet();
eq(allBlank.count, 2, 'one version plus its key');
eq(allBlank.pages[0].blanked, chrono.length, 'blanking everything blanks every event');
eq(allBlank.pages[0].items, chrono.length, 'with an answer line each');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 7. the print paths that already existed still work ────────────────── */

// A fourth print container that leaves the other three broken is the obvious
// way this change could go wrong.
await page.evaluate(() => { window.__printCalls = 0; });
await page.click('#printBtn');
await settle(page, 200);
const plain = await page.evaluate(() => ({
  calls: window.__printCalls,
  printAreaLen: document.getElementById('printArea').innerHTML.length,
  bodyClass: document.body.className,
}));
eq(plain.calls, 1, 'the plain Print button still prints');
ok(plain.printAreaLen > 200, 'and still fills #printArea');
ok(!/map-printing|tiled-printing|worksheet-printing/.test(plain.bodyClass),
  'without leaving the page in a special print mode: ' + JSON.stringify(plain.bodyClass));

await page.click('#mapPrintToggleBtn');
await settle(page, 150);
await page.click('#btnMapPrintGo');
await page.waitForFunction(() => window.__printCalls > 1, null, { timeout: 60000 });
await settle(page, 300);
const stillMaps = await page.evaluate(() => ({
  pins: document.querySelectorAll('#mapPrintPages .mapPin').length,
  bodyClass: document.body.className,
}));
ok(stillMaps.pins > 0, 'the map + timeline print still builds its pins: ' + stillMaps.pins);
ok(/map-printing/.test(stillMaps.bodyClass), 'and enters map-print mode');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 8. no console noise anywhere in all of that ───────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
