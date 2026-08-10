// smoke.mjs — the Schedule Visualizer's first test suite.
//
//   node Tools/schedule/test/smoke.mjs
//
// Exits non-zero on any failure (locked decision #13).
//
// What this covers and what it does not: the tool is 18,700 lines and this
// suite drives one path through it — import a project, publish a browser file,
// open that file, use it. That is the path that ships something to other
// people, so it is the one worth guarding first. The blueprint editor, the
// pathfinding engine, the congestion heatmap, the playback engine and the
// What-If lab are all untested here. See the notes file for the honest
// coverage account.
//
// Three things it asserts that only fail at the moment of use, which is why
// they are here rather than in a linter:
//   - a PDF actually comes out of the Export button (a vendored library with
//     a wrong path loads silently and fails on click)
//   - the published file makes zero network requests
//   - the published file still renders a teacher's day after being reloaded
//     from disk with no generator anywhere near it

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { publishFromFixture, generatorPath } from './publish.mjs';
import { EXPECTED, fixtureProject } from './fixture-northwind.mjs';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';

const PORT = 8138;

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? '\n        ' + detail : ''}`); }
};
const eq = (got, want, label) =>
  ok(got === want, label, got === want ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

console.log('schedule visualizer smoke\n');

/* ── 0. The hand-importable fixture matches the module ─────────────────── */
// fixture-northwind.json exists so the fixture can be loaded through the
// tool's own Import button. Two copies of the same data drift.
{
  const jsonPath = new URL('./fixture-northwind.json', import.meta.url);
  const onDisk = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : null;
  const fromModule = JSON.stringify(fixtureProject());
  ok(onDisk === fromModule,
     'fixture-northwind.json is current',
     'run: node Tools/schedule/test/fixture-northwind.mjs');
}

/* ── 1. The generator loads clean and publishes ────────────────────────── */

console.log('generator');
const run = await publishFromFixture({ quiet: true });

ok(run.blocked.length === 0, 'no offsite requests from the generator',
   run.blocked.join(', '));
ok(run.errs.length === 0, 'no page errors while loading and importing',
   run.errs.join('\n        '));
eq(run.applied.rooms, EXPECTED.roomCount, `fixture imports ${EXPECTED.roomCount} rooms`);
eq(run.applied.groups, EXPECTED.groups.length, `fixture imports ${EXPECTED.groups.length} groups`);

// The vendored font files are actually being used, not silently 404ing into a
// fallback. Not document.fonts.check(): that returns TRUE for a family with no
// @font-face at all, because the system can always fall back — point the
// stylesheet link at a missing file and all four still pass. Ask the
// FontFaceSet instead: a face has to be declared AND have reached 'loaded'.
const fontsLive = await run.page.evaluate(async () => {
  const want = [['DM Sans', '600'], ['DM Mono', '400'],
                ['Fraunces', '600'], ['Public Sans', '400']];
  await Promise.all(want.map(([f, w]) => document.fonts.load(`${w} 16px "${f}"`)));
  await document.fonts.ready;
  const loaded = ([family, weight]) => {
    for (const face of document.fonts) {
      if (face.family.replace(/['"]/g, '') === family &&
          face.weight === weight && face.status === 'loaded') return true;
    }
    return false;
  };
  const [dmSans, dmMono, fraunces, publicSans] = want.map(loaded);
  return { dmSans, dmMono, fraunces, publicSans };
});
ok(fontsLive.dmSans, 'DM Sans 600 resolves from schedule/fonts');
ok(fontsLive.dmMono, 'DM Mono 400 resolves from schedule/fonts');
ok(fontsLive.fraunces, 'Fraunces 600 resolves from schedule/fonts');
ok(fontsLive.publicSans, 'Public Sans 400 resolves (it was never loaded before v61)');

// The version shown in the header comes from the constant.
// TOOL_VERSION is a top-level const in a classic <script>. Those bind in the
// global lexical environment, not on window, so it has to be read by name.
// Same reason every BR_* read below is bare rather than window.BR_*.
const headerVer = await run.page.evaluate(() => ({
  shown: document.getElementById('header-version')?.textContent,
  constant: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : undefined,
}));
ok(headerVer.shown === headerVer.constant && !!headerVer.constant,
   'header version matches TOOL_VERSION',
   `header ${JSON.stringify(headerVer.shown)}, constant ${JSON.stringify(headerVer.constant)}`);

/* ── 2. jsPDF is present and produces a real PDF ───────────────────────── */
// A vendored library with a wrong path fails when you click, not when you
// load. Break it on purpose to watch this fail: change the src in the head to
// schedule/libs/jspdf/nope.js and re-run.

const pdf = await run.page.evaluate(() => {
  const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDF) return { ok: false, why: 'jsPDF global missing — the vendored script did not load' };
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [297, 210] });
    doc.text('Northwind Middle', 10, 10);
    const blob = doc.output('blob');
    return { ok: true, size: blob.size, type: blob.type };
  } catch (e) {
    return { ok: false, why: e.message };
  }
});
console.log('\njspdf');
ok(pdf.ok, 'vendored jsPDF constructs a document', pdf.why);
ok(pdf.ok && pdf.size > 500, `output is a non-trivial blob (${pdf.size} bytes)`);
eq(pdf.type, 'application/pdf', 'output blob is application/pdf');

/* ── 3. The published file, on its own ─────────────────────────────────── */

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-smoke-'));
const outFile = path.join(outDir, 'published.html');
fs.writeFileSync(outFile, run.html, 'utf8');
await run.close();

console.log('\npublished file');

// Grep the bytes before opening them. A hotlink that only fires on a cache
// miss would pass a network assertion on a warm run.
ok(!/cdnjs\.cloudflare\.com/.test(run.html), 'no cdnjs reference in the published bytes');
ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(run.html), 'no Google Fonts reference in the published bytes');
ok(/@font-face\{font-family:'Public Sans'/.test(run.html), 'fonts are embedded as @font-face');
ok(!/localStorage/.test(run.html), 'published file writes nothing to storage');

// Open it from file:// — no server, no origin, the way a teacher opens an
// email attachment. Anything relative in there breaks here.
const browser2 = await launch();
const page2 = await prepPage(browser2, 'http://127.0.0.1:' + PORT, { width: 1280, height: 1000, dsf: 1 });
await page2.goto(pathToFileURL(outFile).href, { waitUntil: 'load' });

const loaded = await page2.evaluate(async () => {
  await Promise.all(['600 16px "Fraunces"', '400 16px "Public Sans"']
    .map(f => document.fonts.load(f)));
  await document.fonts.ready;
  return {
    title: document.title,
    school: document.getElementById('br-mast-school')?.textContent,
    footnote: document.querySelector('#app-browser .footnote')?.textContent || '',
    teachers: Object.keys(BR_TEACHERS || {}),
    groups: Object.keys(BR_SECTIONS || {}),
    floors: (BR_GEOM?.floors || []).map(f => f.label),
    // Same reason as above: ask the FontFaceSet, not check().
    fraunces: [...document.fonts].some(f =>
      f.family.replace(/['"]/g, '') === 'Fraunces' && f.status === 'loaded'),
    publicSans: [...document.fonts].some(f =>
      f.family.replace(/['"]/g, '') === 'Public Sans' && f.status === 'loaded'),
  };
});

eq(loaded.school, EXPECTED.school, 'masthead shows the school name');
ok(loaded.title.includes(EXPECTED.school), 'title includes the school name');
ok(/Published .+ from the School Layout Visualizer v\d+/.test(loaded.footnote),
   'footnote carries the publish date and the tool version', loaded.footnote);
eq(loaded.teachers.slice().sort().join(','), EXPECTED.teachers.slice().sort().join(','),
   `all ${EXPECTED.teachers.length} teachers present, and only those`);
eq(loaded.groups.slice().sort().join(','), EXPECTED.groups.slice().sort().join(','),
   'all student groups present');
eq(loaded.floors.join(','), EXPECTED.floors.join(','), 'both floors in the geometry snapshot');
ok(loaded.fraunces, 'Fraunces resolves from the embedded data URI over file://');
ok(loaded.publicSans, 'Public Sans resolves from the embedded data URI over file://');

// Use it the way a teacher does: pick a name, read the day.
const teacherView = await page2.evaluate(() => {
  brChoose('Hartwell');
  const v = document.getElementById('br-view');
  return {
    visible: v.classList.contains('show'),
    text: v.textContent.replace(/\s+/g, ' ').trim(),
    dayCards: v.querySelectorAll('.daycard').length,
    blockRows: v.querySelectorAll('.blockrow').length,
  };
});
ok(teacherView.visible, 'choosing a teacher shows the schedule view');
eq(teacherView.dayCards, 2, 'an A day card and a B day card');
eq(teacherView.blockRows, 8, 'four blocks on each of the two days');
ok(teacherView.text.includes('108'), "Hartwell's room number appears", teacherView.text.slice(0, 160));
ok(teacherView.text.includes('7-1') && teacherView.text.includes('7-2'),
   'both groups Hartwell teaches appear', teacherView.text.slice(0, 160));

// The group view, and the building map, which is the part with no fallback.
// The group view is a table of the teachers a class sees, not a day grid.
const groupView = await page2.evaluate(() => {
  brSetMode('group');
  brChoose('6-1');
  const v = document.getElementById('br-view');
  return { text: v.textContent.replace(/\s+/g, ' ').trim(),
           rows: v.querySelectorAll('.gtable tr').length };
});
ok(groupView.rows > 0, `group view renders a teacher table (${groupView.rows} rows)`);
ok(groupView.text.includes('Ashdown'), 'group 6-1 lists its ELA teacher');

// Room cells in the Building Map are <g class="geo-room">. `.rcell` is the
// other, smaller floor plan drawn on an individual teacher's page — two
// renderers, two class names, easy to assert against the wrong one.
const mapView = await page2.evaluate(() => {
  brSetMode('map');
  const v = document.getElementById('br-view');
  return {
    svgs: v.querySelectorAll('svg').length,
    rooms: v.querySelectorAll('.geo-room').length,
    text: v.textContent.replace(/\s+/g, ' ').trim().slice(0, 200),
  };
});
ok(mapView.svgs > 0, 'building map renders an SVG');
ok(mapView.rooms > 0, `building map draws room cells (${mapView.rooms})`);

// Nothing reached for the network at any point.
ok((page2.__blocked || []).length === 0, 'published file made zero offsite requests',
   (page2.__blocked || []).join(', '));
ok((page2.__errs || []).length === 0, 'published file logged no errors',
   (page2.__errs || []).join('\n        '));

await page2.close();

/* The building map at 375px. Checking a room assignment on a phone is the
   main thing anyone does with a published file, and the map used to shrink to
   fit — a whole floor squeezed into 375px, room numbers about 4px tall. Break
   it on purpose by deleting the max-width:900px rule from BR_CSS: the SVG
   goes back to matching the container and `scrolls` goes false. */
const pageM = await prepPage(browser2, 'http://127.0.0.1:' + PORT,
  { width: 375, height: 812, dsf: 1, mobile: true });
await pageM.goto(pathToFileURL(outFile).href, { waitUntil: 'load' });
const mobileMap = await pageM.evaluate(() => {
  brSetMode('map');
  const svg = document.querySelector('.geoplan');
  const sc = document.querySelector('.mapscroll');
  const natural = parseFloat(getComputedStyle(svg).getPropertyValue('--geo-w'));
  return {
    svgW: Math.round(svg.getBoundingClientRect().width),
    containerW: Math.round(sc.clientWidth),
    natural: Math.round(natural),
    scrolls: sc.scrollWidth > sc.clientWidth + 1,
  };
});
ok(mobileMap.svgW === mobileMap.natural,
   `map draws at 1:1 on a 375px screen (${mobileMap.svgW}px)`,
   `svg ${mobileMap.svgW}, natural ${mobileMap.natural}`);
ok(mobileMap.scrolls, 'map scrolls horizontally rather than shrinking',
   `container ${mobileMap.containerW}, content ${mobileMap.svgW}`);
await pageM.close();

await browser2.close();
fs.rmSync(outDir, { recursive: true, force: true });

/* ── 4. The committed copy on the site ─────────────────────────────────── */
// 034-schedule-browser.html is a data file in a public repo. These two assertions
// are about the site, not the tool.

console.log('\ncommitted site copy');
const server = await serve(PORT);
const browser3 = await launch();
const page3 = await prepPage(browser3, 'http://127.0.0.1:' + PORT, { width: 1280, height: 1000, dsf: 1 });
await page3.goto(`http://127.0.0.1:${PORT}/Tools/034-schedule-browser.html`, { waitUntil: 'load' });
const committed = await page3.evaluate(() => ({
  teachers: Object.keys(BR_TEACHERS || {}).length,
  hasSocial: document.querySelector('meta[property="og:title"]') !== null,
}));
ok(committed.teachers > 0, `committed browser still has its data (${committed.teachers} teachers)`);
ok(committed.hasSocial, 'committed browser still carries its gvb:social block');
ok((page3.__blocked || []).length === 0, 'committed browser makes zero offsite requests',
   (page3.__blocked || []).join(', '));

// And the generator's own page, served from the site.
await page3.goto('http://127.0.0.1:' + PORT + generatorPath(), { waitUntil: 'load' });
ok((page3.__blocked || []).length === 0, 'committed visualizer makes zero offsite requests',
   (page3.__blocked || []).join(', '));

await page3.close();
await browser3.close();
server.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
