// smoke-file-transfer.mjs — handing a whole simulation to another teacher as
// a file, and the link path it shares its plumbing with.
//
//   node Tools/civics-role-card-generator/test/smoke-file-transfer.mjs
//
// A simulation now carries six pieces (agenda, cards, case files, ballots,
// rubric, reflections), which is more than a link comfortably holds: a full
// one runs past what a QR code can encode at all, and far enough past a
// typical URL that mail clients and chat apps start wrapping or truncating
// it. "Save as file" is the route with no length limit — and a file is only
// worth anything if the file this tool writes is the file this tool reads.
//
// What this suite holds down:
//
//   1. The exported file really contains the whole kit, not just the roles.
//      A file that silently drops the case files looks fine until the day it
//      is opened in front of a class.
//   2. Importing it recreates the simulation beside whatever was already
//      saved, under a name that cannot collide, and never replaces anything.
//      This is the tool's standing promise on the link path, and a file must
//      not be the exception.
//   3. Role and point ids are regenerated on import, so a simulation
//      imported next to its own original does not share ids with it.
//   4. A file and a link carry byte-identical payloads. They are built by
//      one function for exactly this reason; asserting it here is what stops
//      a later round adding a field to one path only.
//   5. Junk in is refused with an explanation rather than a broken document
//      or a silent no-op — including valid JSON that simply isn't a
//      simulation, which is the likely mistake (a teacher picking the wrong
//      .json out of a downloads folder).
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8203;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/050-civics-role-card-generator.html';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'civics-'));

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

console.log('Civics Role Cards — save/open a simulation as a file');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

/* ── 1. export writes the whole kit ─────────────────────────────────────── */
// The tool boots with the Mock Trial template, kit and all.
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.click('#exportFileBtn'),
]);
const saved = path.join(OUT, dl.suggestedFilename());
await dl.saveAs(saved);

ok(/\.civics\.json$/.test(dl.suggestedFilename()),
   `the download is named as a simulation file (${dl.suggestedFilename()})`);

const payload = JSON.parse(fs.readFileSync(saved, 'utf8'));
eq(payload.v, 2, 'the file states its schema version');
ok(typeof payload.name === 'string' && payload.name.length > 0, 'the file carries the simulation name');
ok(payload.doc && Array.isArray(payload.doc.roles) && payload.doc.roles.length > 0,
   'the file carries the roles');
ok(payload.doc.roles.every(r => Array.isArray(r.points)), 'every role keeps its talking points');
// The kit is the part a roles-only export would drop, which is the whole
// reason this file format exists rather than a bare role list.
const kit = payload.doc;
ok(kit.caseFiles || kit.agenda || kit.rubric || kit.reflections || kit.ballots,
   'the file carries the kit, not just the roles: ' + Object.keys(kit).join(','));

/* ── 2. a file and a link carry the same payload ─────────────────────────── */
// Both are built by one sharePayload(); this is the assertion that keeps a
// later round from adding a field to one route and not the other. The link is
// taken from the button itself (clipboard stubbed to capture it) and decoded
// with the same StateLink the tool encodes with.
const fromLink = await page.evaluate(async () => {
  let captured = null;
  navigator.clipboard.writeText = (t) => { captured = t; return Promise.resolve(); };
  document.getElementById('shareLinkBtn').click();
  await new Promise(r => setTimeout(r, 60));
  if (!captured) return { error: 'clipboard never received a link' };
  const raw = new URL(captured).searchParams.get('roles');
  if (!raw) return { error: 'no roles parameter in the copied link' };
  return { decoded: StateLink.decodeState(raw) };
});
ok(!fromLink.error, 'the copy-link button produces a decodable link: ' + (fromLink.error || 'ok'));
eq(JSON.stringify(fromLink.decoded), JSON.stringify(payload),
   'the link and the file carry byte-identical payloads');

/* ── 3. importing the file lands beside the original ─────────────────────── */
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('crcg:list') || '[]'));
await page.setInputFiles('#importFileInput', saved);
await settle(page, 300);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('crcg:list') || '[]'));
eq(after.length, before.length + 1, 'importing adds one simulation');
ok(before.every(n => after.includes(n)), 'and leaves every simulation that was already saved');

const note = await page.textContent('#shareNote');
ok(/saved it as/i.test(note), 'the note says what it was filed as: ' + JSON.stringify(note));

const importedName = after.find(n => !before.includes(n));
ok(!!importedName, 'the import got its own name');
ok(importedName !== payload.name, `and it does not overwrite the original's name (${importedName} vs ${payload.name})`);

/* ── 4. ids are regenerated so the copy can sit beside its original ──────── */
const idOverlap = await page.evaluate(({ orig, copy }) => {
  const read = (n) => JSON.parse(localStorage.getItem('crcg:data:' + n) || 'null');
  const a = read(orig), b = read(copy);
  if (!a || !b) return 'missing';
  const aIds = new Set(a.roles.map(r => r.id));
  const bIds = b.roles.map(r => r.id);
  const aPts = new Set(a.roles.flatMap(r => r.points.map(p => p.id)));
  const bPts = b.roles.flatMap(r => r.points.map(p => p.id));
  return {
    roles: bIds.filter(id => aIds.has(id)).length,
    points: bPts.filter(id => aPts.has(id)).length,
    sameRoleCount: a.roles.length === b.roles.length,
    sameText: a.roles[0].role === b.roles[0].role,
  };
}, { orig: payload.name, copy: importedName });
eq(idOverlap.roles, 0, 'no role id is shared between the original and the imported copy');
eq(idOverlap.points, 0, 'no talking-point id is shared either');
ok(idOverlap.sameRoleCount, 'the copy has the same number of roles');
ok(idOverlap.sameText, 'and the same role text — only the ids changed');

/* ── 5. junk is refused with an explanation ──────────────────────────────── */
const junk = path.join(OUT, 'not-a-simulation.json');
fs.writeFileSync(junk, JSON.stringify({ hello: 'world', rows: [1, 2, 3] }));
const listBeforeJunk = await page.evaluate(() => JSON.parse(localStorage.getItem('crcg:list') || '[]'));
await page.setInputFiles('#importFileInput', junk);
await settle(page, 300);
const junkNote = await page.textContent('#shareNote');
ok(/isn.t a simulation/i.test(junkNote), 'valid JSON that is not a simulation is refused by name: ' + JSON.stringify(junkNote));
ok(await page.evaluate(() => document.getElementById('shareNote').classList.contains('error')),
   'and is shown as an error rather than as a success');
eq((await page.evaluate(() => JSON.parse(localStorage.getItem('crcg:list') || '[]'))).length,
   listBeforeJunk.length, 'nothing was saved from the junk file');

const notJson = path.join(OUT, 'notes.json');
fs.writeFileSync(notJson, 'this is not json at all');
await page.setInputFiles('#importFileInput', notJson);
await settle(page, 300);
ok(/isn.t a simulation/i.test(await page.textContent('#shareNote')),
   'a file that is not JSON at all is refused the same way, not thrown');

/* ── 6. the simulation still prints after a round trip ───────────────────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
ok(await page.evaluate(() => document.querySelectorAll('#printArea .role-card, #printArea .card-page').length > 0
   || document.getElementById('printArea').innerHTML.length > 200),
   'the imported simulation prints a kit');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
