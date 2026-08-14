// smoke-essay-levels.mjs — DBQ / Source Packet Builder: the essay planning
// organizer, the scoring rubric page, the three differentiation levels, and
// the one-click handoff to Primary Source Analysis (028).
//
//   node Tools/dbq-source-packet-builder/test/smoke-essay-levels.mjs
//
// What's under test:
//
//   1. the organizer page references the packet's REAL source letters and
//      titles, not placeholder slots
//   2. the rubric page prints when it is toggled on and vanishes when it is
//      toggled off
//   3. the level changes the printed output — a word gloss and sentence
//      starters appear at Academic and are absent at Honors (the baseline),
//      and Honors GT gets the outside-evidence row and the missing-voice
//      question instead of paragraph frames
//   4. "Print all three levels" emits all three class sets in one pass, each
//      page footer-tagged with its level
//   5. a ROUND-1 share link (a payload with no level / organizer / rubric
//      fields at all) still imports and lands on the Honors baseline
//   6. the 028 handoff URL is a valid 028 ?worksheet= payload, and 028
//      really does open it
//
// window.print() and window.open() are both stubbed in an init script, so
// the print path can be inspected without a print dialog and the handoff can
// be captured without an unrouted popup escaping the harness.
//
// Exits 1 on any failure. Every name and quote here is invented for the test.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8216;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/056-dbq-source-packet-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const STUBS = () => {
  window.__printed = 0;
  window.print = () => { window.__printed++; };
  window.__opened = [];
  window.open = (url) => { window.__opened.push(url); return { closed: false }; };
};

const server = await serve(PORT);
const browser = await launch();

console.log('DBQ / Source Packet Builder — essay organizer, rubric page, levels, 028 handoff');

/* ── boot on the worked example (3 sources, an essay prompt, organizer and
   rubric both on) ─────────────────────────────────────────────────────── */
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await page.addInitScript(STUBS);
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

eq(await page.inputValue('#levelSelect'), 'honors', 'the level defaults to Honors, the baseline');
ok(await page.isChecked('#organizerToggle'), 'the organizer page is on by default when the packet has an essay prompt');
ok(await page.isChecked('#rubricToggle'), 'the example packet ships with the rubric page on');

const printAt = async (level) => {
  await page.selectOption('#levelSelect', level);
  await settle(page, 120);
  await page.click('#printBtn');
  await settle(page, 200);
  return page.evaluate(() => Array.from(document.querySelectorAll('#printArea .source-page')).map(p => p.textContent));
};

/* ── 1. Honors baseline: page order and organizer content ──────────────── */
const honors = await printAt('honors');
eq(honors.length, 7, 'Honors prints cover + 3 sources + essay prompt + organizer + rubric');
ok(/Child Labor in the Industrial Revolution/.test(honors[0]), 'page 1 is the cover');
ok(/^\s*Source A/.test(honors[1].trim()), 'pages 2-4 are the sources');
ok(/Synthesis \/ Essay Prompt/.test(honors[4]), 'page 5 is the essay prompt');
ok(/Essay Planning Organizer/.test(honors[5]), 'page 6 is the essay planning organizer');
ok(/Scoring Rubric/.test(honors[6]), 'page 7 is the scoring rubric');

const organizer = honors[5];
ok(/Source A — A Factory Inspector/.test(organizer),
   `the organizer names the packet's real Source A by letter and title (got: ${JSON.stringify(organizer.slice(0, 260))})`);
ok(/Source B — A Mill Owner/.test(organizer), 'and Source B');
ok(/Source C — A Child Worker/.test(organizer), 'and Source C');
ok(/Body paragraph 1/.test(organizer) && /Body paragraph 3/.test(organizer), 'it has a three-body-paragraph planning grid');
ok(/Thesis/.test(organizer), 'a thesis section');
ok(/Counterargument/.test(organizer), 'a counterargument box');
ok(/Conclusion/.test(organizer), 'and a conclusion line');
ok(/Strongest evidence/.test(organizer), 'the grid asks for the strongest evidence per claim');
const docBoxes = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .plan-table tbody tr'))
    .map(tr => tr.children[2].textContent.replace(/\s+/g, ' ').trim()));
ok(docBoxes.every(t => /A/.test(t) && /B/.test(t) && /C/.test(t)),
   `each planning row offers the packet's own document letters to check off (got ${JSON.stringify(docBoxes)})`);
ok(!/Whose voice is missing/.test(organizer), 'the missing-voice question is a GT extension, not on the Honors organizer');
ok(!/Start with:/.test(honors[1]), 'no sentence starters at Honors — the baseline output is unchanged');
ok(!/Before you read/.test(honors[1]), 'and no word gloss at Honors');

/* ── 2. Academic adds support to the same questions ────────────────────── */
const academic = await printAt('academic');
eq(academic.length, 7, 'Academic prints the same seven pages, not fewer');
ok(/Before you read:/.test(academic[1]), 'Academic adds a "before you read" gloss line to a source page');
ok(/machinery/.test(academic[1]) && /machines, or the moving parts/.test(academic[1]),
   'the gloss defines a hard word taken from that source\'s own text');
ok(/Start with:/.test(academic[1]), 'Academic adds a sentence starter under the source questions');
ok(/One reason is that/.test(academic[1]),
   'the starter is matched to how the teacher worded the question (a "why" question gets a reason starter)');
const academicQs = await page.evaluate(() =>
  document.querySelectorAll('#printArea .source-page:nth-child(2) .q-item').length);
const honorsQs = 3; // one source-specific + two shared, same at every level
eq(academicQs, honorsQs, 'Academic asks exactly the same questions as Honors — support added, nothing removed');
ok(/Break the prompt into steps/.test(academic[4]), 'the essay prompt is chunked into steps at Academic');
ok(/Use at least two of the sources above \(Source A through Source C\)/.test(academic[4]),
   'and the steps reference the packet\'s real source range');
ok(/Although some people argued/.test(academic[5]), 'the Academic organizer pre-fills paragraph frames');

/* ── 3. Honors GT extends instead ──────────────────────────────────────── */
const gt = await printAt('gt');
const gtOrganizer = gt[5];
ok(!/Before you read:/.test(gt[1]), 'no gloss line at Honors GT');
ok(/Outside evidence/.test(gtOrganizer), 'the GT organizer adds an outside-evidence row');
ok(/Whose voice is missing from this packet/.test(gtOrganizer), 'and the missing-voice question');
ok(!/First, the sources show that/.test(gtOrganizer), 'and drops the pre-filled paragraph frames');
ok(/Push further/.test(gt[4]), 'the GT essay page adds a synthesis "so what" question');

/* ── 4. the rubric page is genuinely optional ──────────────────────────── */
await page.uncheck('#rubricToggle');
await settle(page, 120);
const noRubric = await printAt('honors');
eq(noRubric.length, 6, 'turning the rubric off drops exactly one page');
ok(!noRubric.some(t => /Scoring Rubric/.test(t)), 'and the rubric page is gone from the packet');
await page.check('#rubricToggle');
await settle(page, 120);

await page.selectOption('#rubricStyle', 'checklist');
await settle(page, 120);
const checklist = await printAt('honors');
ok(/Before you turn it in/.test(checklist[6]), 'the rubric can print as a student-facing checklist instead of the grid');
ok(/Use of the documents/.test(checklist[6]), 'the checklist still carries the rubric\'s own criteria');
await page.selectOption('#rubricStyle', 'grid');
await settle(page, 120);

/* the rubric grid is editable, and the edit reaches paper */
await page.fill('#rubricGrid tbody tr:nth-child(1) textarea[data-rci="0"]', 'Devon\'s own wording for a 4.');
await page.dispatchEvent('#rubricGrid tbody tr:nth-child(1) textarea[data-rci="0"]', 'input');
await settle(page, 150);
const editedRubric = await printAt('honors');
ok(/Devon's own wording for a 4\./.test(editedRubric[6]), 'an edited rubric cell prints');

/* ── 5. print all three levels, footer-tagged ──────────────────────────── */
await page.click('#printAllLevelsBtn');
await settle(page, 300);
const allPages = await page.evaluate(() => document.querySelectorAll('#printArea .source-page').length);
eq(allPages, 21, 'Print all three levels emits three full seven-page class sets');
const tags = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .level-tag')).map(t => t.textContent.split('·')[0].trim()));
eq(tags.length, 21, 'every page in the all-levels run carries a footer tag');
eq(tags.filter(t => t === 'Academic set').length, 7, 'seven Academic-tagged pages');
eq(tags.filter(t => t === 'Honors set').length, 7, 'seven Honors-tagged pages');
eq(tags.filter(t => t === 'Honors GT set').length, 7, 'seven Honors GT-tagged pages');
ok(await page.evaluate(() => Array.from(document.querySelectorAll('#printArea .source-page'))
     .every(p => p.lastElementChild && p.lastElementChild.classList.contains('level-tag'))),
   'the tag sits at the foot of each page, inside the page itself, so it lands on paper');

/* the level and the two toggles survive a reload with the packet */
await page.selectOption('#levelSelect', 'academic');
await settle(page, 200);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#levelSelect'), 'academic', 'the level is stored with the packet and survives a reload');
ok(await page.isChecked('#organizerToggle'), 'and so are the page toggles');
ok(await page.evaluate(() => /Devon's own wording/.test(localStorage.getItem('dbq:data:' + localStorage.getItem('dbq:current')))),
   'the edited rubric is saved with the named packet, not in a separate key');

/* ── 6. the new fields travel in the share link, and a ROUND-1 link (with
   none of them) still imports and lands on the Honors baseline ─────────── */
const shareUrl = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});
const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('packet')), shareUrl);
eq(payload.level, 'academic', 'the level rides the share link');
eq(payload.rubricEnabled, true, 'so does the rubric toggle');
ok(payload.rubric && Array.isArray(payload.rubric.rows), 'and the rubric itself');
ok(/Devon's own wording/.test(JSON.stringify(payload.rubric)), 'including the teacher\'s edits to it');

// A payload shaped exactly like round 1's: no level, no organizerEnabled, no
// rubricEnabled, no rubric. These links are already in teachers' email.
const roundOneUrl = await page.evaluate(() => window.StateLink.buildShareUrl('packet', {
  v: 1,
  name: 'Round One Packet',
  title: 'A Round-One Packet',
  context: 'Saved and shared before levels or the organizer existed.',
  essayPrompt: 'Was the change worth the cost? Use the sources to defend your answer.',
  sharedQuestions: [{ id: 'sq1', text: 'What is the main idea of this source?' }],
  sources: [{
    id: 's1', title: 'An Old Source', type: 'text', text: 'A short source saved back in round one.',
    citation: 'Invented for a test, 1900.', questions: [{ id: 'q1', text: 'Why does this source matter?' }]
  }]
}));

const legacy = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await legacy.addInitScript(STUBS);
await legacy.goto(roundOneUrl, { waitUntil: 'networkidle' });
await settle(legacy, 500);
ok(/Opened from a shared link/.test(await legacy.textContent('#shareNote')),
   'a round-1 share link still opens after the payload gained new fields');
eq(await legacy.inputValue('#packetTitle'), 'A Round-One Packet', 'with its content intact');
eq(await legacy.inputValue('#levelSelect'), 'honors', 'and lands on the Honors baseline, since it carries no level');
ok(await legacy.isChecked('#organizerToggle'),
   'the organizer defaults on for it, because the round-1 packet does have an essay prompt');
ok(!await legacy.isChecked('#rubricToggle'),
   'but the rubric page stays off — an old packet never grows a page by surprise');
await legacy.click('#printBtn');
await settle(legacy, 200);
const legacyPages = await legacy.evaluate(() => Array.from(document.querySelectorAll('#printArea .source-page')).map(p => p.textContent));
eq(legacyPages.length, 4, 'the round-1 packet prints cover + its one source + essay prompt + organizer');
ok(/An Old Source/.test(legacyPages[3]), 'and its organizer names that packet\'s own source');

/* ── 7. send a source to Primary Source Analysis (028) ─────────────────── */
await page.click('#sourcesWrap .source-block:nth-child(1) [data-to-psa]');
await settle(page, 250);
const handoff = await page.evaluate(() => window.__opened[0] || null);
ok(handoff && handoff.indexOf('028-primary-source-analysis-generator.html') !== -1,
   `the handoff opens 028 (got ${JSON.stringify(handoff)})`);
ok(handoff && handoff.indexOf('worksheet=') !== -1, 'using 028\'s own ?worksheet= link format');
const psaPayload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('worksheet')), handoff);
eq(psaPayload.framework, 'soapstone', 'a text source arrives on 028\'s SOAPSTone framework');
ok(typeof psaPayload.name === 'string' && psaPayload.name.length > 0, 'the payload carries a worksheet name');
ok(typeof psaPayload.notes === 'object' && psaPayload.notes !== null, 'and a notes object, which 028\'s validator requires');
ok(/cotton mills/.test(psaPayload.sourceText), 'the source text travels');
ok(/1833/.test(psaPayload.citationOrigin), 'and the citation travels as the worksheet\'s origin line');
ok(/Factory Inspector/.test(psaPayload.sourceTitle), 'and the source title');
ok(/Sent Source A to Primary Source Analysis/.test(await page.textContent('#shareNote')),
   'the tool says where the source went');

// and 028 really opens it — the payload is not merely well-shaped, it imports
const psa = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await psa.goto(handoff, { waitUntil: 'networkidle' });
await settle(psa, 600);
ok(/Opened from a shared link/.test(await psa.textContent('#shareNote')),
   'Primary Source Analysis accepts the handoff link as a valid worksheet');
ok(/cotton mills/.test(await psa.inputValue('#sourceText')), 'and lands with the packet source\'s text in it');
eq(await psa.evaluate(() => {
  const checked = document.querySelector('input[name="framework"]:checked');
  return checked ? checked.value : null;
}), 'soapstone', 'on the SOAPSTone framework the handoff asked for');

/* ── 8. no console noise anywhere ──────────────────────────────────────── */
for (const [name, p] of [['builder', page], ['round-1 link', legacy], ['028 handoff', psa]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
