// smoke-csv-adopters.mjs — the pages that save a CSV through ExportKit.toCsv()
// (Path 7 P4): 003, 008, 018, 033, 068 and 075.
//
//   node Tools/export/test/smoke-csv-adopters.mjs      (npm run test:csv-adopters)
//
// Each of these wrote its own CSV until v249, and each file had something a
// spreadsheet gets wrong: no byte order mark (Excel reads "Zoë" as "ZoÃ«"), a
// bare carriage return left unquoted (the row breaks in two), and in all six
// a typed cell that starts = + - or @, which a spreadsheet runs as a formula.
// A parent-contact outcome typed "-left voicemail" opened as #NAME?.
//
// This opens each page with cells built to break a CSV, presses its export
// button, and reads the bytes the page saves: the mark, the line ends, the
// quoting, the apostrophe before a typed formula and nowhere else (a negative
// score is still a number), and the table itself, cell for cell. 075 is the
// one with an Import button, so its own file goes back in and has to give the
// directory it came from.
//
// The table and the fixtures are in _csv-adopters.mjs. Exits 1 on any failure.
// Every name here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { ADOPTERS, GUARD, parseCsv, writeCsv, unguard, capture } from './_csv-adopters.mjs';

const PORT = 8486;
const BASE = `http://127.0.0.1:${PORT}`;
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const sorted = rows => rows.map(r => JSON.stringify(r)).sort();

/* The pages, by name. CI's selector runs a suite when a page its source names
   changes (select-suites.mjs, rule 3) and does not follow imports, so the six
   are written here as well as in the table, and the two lists have to agree. */
const PAGES = [
  'Tools/003-rubric-builder.html',
  'Tools/008-behavior-points-tracker.html',
  'Tools/018-qr-scavenger-hunt-builder.html',
  'Tools/033-ssr-log-tracker.html',
  'Tools/068-parent-contact-log.html',
  'Tools/075-staff-directory-builder.html',
];
eq(ADOPTERS.map(a => a.file), PAGES, 'the table and this file name the same pages');

const server = await serve(PORT);
const browser = await launch();

async function open(a, seed) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const k of Object.keys(s)) localStorage.setItem(k, s[k]);
  }, seed);
  await page.goto(`${BASE}/${a.file}`, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return { page, errors };
}

for (const a of ADOPTERS) {
  if (ONLY && ONLY !== a.tool) continue;
  console.log(`${a.tool} — ${a.file}`);
  const T = `${a.tool}:`;

  /* the page itself: the shared file, and no quoting of its own left */
  const src = fs.readFileSync(path.join(SITE, a.file), 'utf8');
  ok(/<script src="\.\.\/_shared\/export\.js"><\/script>/.test(src), `${T} the page loads _shared/export.js`);
  ok(src.includes('ExportKit.toCsv('), `${T} the page calls ExportKit.toCsv()`);
  ok(!/\.replace\(\/"\/g,\s*'""'\)/.test(src), `${T} the page doubles no quotes itself`);

  const { page, errors } = await open(a, a.seed);
  const file = await capture(page, a.button);
  const want = a.table, cols = want[0].length;

  /* the file */
  eq([...file.bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF], `${T} the file starts with a UTF-8 byte order mark`);
  eq(file.type, 'text/csv;charset=utf-8', `${T} the file's type`);
  ok(a.name.test(file.name), `${T} the file's name (got ${JSON.stringify(file.name)})`);
  const body = file.text.replace(/^﻿/, '');
  ok(!body.includes('﻿'), `${T} one byte order mark, not two`);
  const { rows, faults } = parseCsv(body);
  eq(faults, [], `${T} strict RFC 4180: CRLF after every record, nothing bare, nothing unquoted`);
  eq(rows.length, want.length, `${T} records in the file`);
  ok(rows.every(r => r.length === cols), `${T} every record has the header's ${cols} cells`);

  /* the guard: an apostrophe before a typed formula, and nowhere else */
  let guarded = 0, wantGuarded = 0, bare = [], wrong = [];
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    const number = ri > 0 && a.numeric(ci);
    if (GUARD.test(c) && !(number && /^-\d+(\.\d+)?$/.test(c))) bare.push(c);
    if (/^'[=+\-@\t\r]/.test(c)) { guarded++; if (number) wrong.push(c); }
  }));
  want.forEach((r, ri) => r.forEach((c, ci) => { if (GUARD.test(c) && !(ri > 0 && a.numeric(ci))) wantGuarded++; }));
  eq(bare, [], `${T} no cell a spreadsheet would run as a formula`);
  eq(wrong, [], `${T} no apostrophe on a number`);
  eq(guarded, wantGuarded, `${T} cells that got the apostrophe`);
  ok(wantGuarded > 0, `${T} the fixture has typed formulas to guard`);
  const negatives = want.slice(1).flatMap(r => r.filter((c, ci) => a.numeric(ci) && /^-\d/.test(c)));
  for (const n of negatives) ok(rows.some(r => r.includes(n)), `${T} the negative number ${n} is written as a number`);

  /* the table, cell for cell (a tool may order its rows; the header is first) */
  const plain = rows.map(r => r.map(unguard));
  eq(plain[0], want[0], `${T} the header row`);
  eq(sorted(plain.slice(1)), sorted(want.slice(1)), `${T} every row as it was typed`);
  for (const r of want.slice(1)) for (const c of r) if (/[^\x00-\x7f]/.test(c)) ok(plain.some(p => p.includes(c)), `${T} ${JSON.stringify(c)} is in the file letter for letter`);

  /* byte for byte: the reference writer on the rows in the file's own order */
  const inOrder = plain.map(r => want.find(w => JSON.stringify(w) === JSON.stringify(r)) || r);
  eq(body, writeCsv(inOrder, { numeric: a.numeric }), `${T} the file is the reference writer's, byte for byte`);

  /* its own file goes back in through Import */
  if (a.roundTrip) {
    const rt = a.roundTrip;
    const fresh = await open(a, {});
    eq(await fresh.page.evaluate(k => localStorage.getItem(k), rt.key), null, `${T} round trip starts with nothing saved`);
    await fresh.page.setInputFiles(rt.input, { name: file.name, mimeType: 'text/csv', buffer: file.bytes });
    await fresh.page.waitForFunction(k => localStorage.getItem(k), rt.key, { timeout: 5000 }).catch(() => {});
    await settle(fresh.page, 200);
    const back = await fresh.page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), rt.key);
    eq(sorted(back.map(p => rt.fields.map(f => p[f]))), sorted(want.slice(1)), `${T} its own file imports to the directory it came from`);
    const again = await capture(fresh.page, a.button);
    ok(Buffer.compare(again.bytes, file.bytes) === 0, `${T} exported again after the import, the same bytes`);
    eq(fresh.errors, [], `${T} no page error on import`);
    await fresh.page.context().close();
  }

  eq(errors, [], `${T} no page error`);
  await page.context().close();
}

await browser.close();
server.close();
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
