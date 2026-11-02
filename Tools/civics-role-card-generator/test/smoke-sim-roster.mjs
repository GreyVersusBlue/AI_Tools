// smoke-sim-roster.mjs — 050 remembers which class list each simulation was
// assigned from.
//
//   node Tools/civics-role-card-generator/test/smoke-sim-roster.mjs
//
// A debate and a mock trial are built for different periods. Each simulation
// now keeps the NAME of the class list it was last assigned from (an optional
// `roster` on its saved document), and reopening it points the picker there;
// it assigns nothing by itself. This suite holds down: nothing stored until an
// assignment is made, the memory per simulation, a list that has gone being
// named rather than guessed, Clear names keeping the memory, a simulation
// saved before this being byte for byte what it was, and the memory staying out
// of a shared file and an opened one. Every name is invented. Exits 1 on any
// failure.
import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 8644;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/050-civics-role-card-generator.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ROSTERS = {
  '3rd Period': ['Ann Lee', 'Bo Park', 'Cy Ode', 'Dee Fox'],
  '5th Period': ['Eli Roe', 'Fay Gil', 'Gus Hu'],
};

const server = await serve(PORT);
const browser = await launch();
console.log('Civics Role Card Generator — a class list per simulation');

const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
page.__errs = [];
page.on('pageerror', e => page.__errs.push(String(e)));
let promptAnswer = 'Debate';
page.on('dialog', async d => { await d.accept(d.type() === 'prompt' ? promptAnswer : undefined); });
await page.addInitScript(r => { if (!localStorage.getItem('np_rosters')) localStorage.setItem('np_rosters', JSON.stringify(r)); }, ROSTERS);

const current = () => page.evaluate(() => { const n = localStorage.getItem('crcg:current'); return { name: n, doc: JSON.parse(localStorage.getItem('crcg:data:' + n) || 'null') }; });
const picked = () => page.$eval('#rosterSelect', s => s.value);
const summary = () => page.$eval('#assignSummary', s => s.textContent);
const names = async () => (await current()).doc.roles.flatMap(r => r.students);
const edit = async () => { await page.fill('#kitTitle', 'Edited'); await page.dispatchEvent('#kitTitle', 'input'); };

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* nothing is remembered until a class is assigned */
eq(await picked(), '', 'a fresh simulation has no class list chosen');
eq(await summary(), '', '...and says nothing about one');
await page.selectOption('#rosterSelect', '3rd Period');
await edit();
ok(!('roster' in (await current()).doc), 'choosing a list in the picker stores nothing: a simulation that never assigned has no roster field');

/* assign: the mock trial remembers 3rd Period */
await page.click('#assignBtn');
await settle(page);
let cur = await current();
eq(cur.doc.roster, '3rd Period', 'assigning stores the list’s name');
ok(!('roster' in cur.doc.roles[0]), 'the name is on the simulation, not on a role');
const mockName = cur.name;
const mockNames = await names();

/* a new simulation starts with nothing chosen, and keeps its own memory */
await page.click('#newSimBtn');
await settle(page, 300);
eq(await picked(), '', 'a new simulation does not suggest the last one’s period');
ok(!('roster' in (await current()).doc), '...and has no memory yet');
await page.selectOption('#rosterSelect', '5th Period');
await page.click('#assignBtn');
await settle(page);
eq((await current()).doc.roster, '5th Period', 'the debate remembers 5th Period');

/* switching back and forth */
await page.selectOption('#simSelect', mockName);
await settle(page, 300);
eq(await picked(), '3rd Period', 'reopening the mock trial points the picker at 3rd Period');
ok(/last assigned from “3rd Period”/.test(await summary()), 'and says so: ' + (await summary()));
eq(await names(), mockNames, 'its students are untouched by looking');
eq((await current()).doc.roster, '3rd Period', 'its memory is still 3rd Period');
await page.selectOption('#simSelect', 'Debate');
await settle(page, 300);
eq(await picked(), '5th Period', 'the debate reopens for 5th Period');

/* Clear names keeps the memory */
await page.click('#clearAssignBtn');
eq((await current()).doc.roster, '5th Period', 'Clear names keeps which list it was for');
eq(await names(), [], '...while the names are gone');

/* Reassign deals that class again */
await page.click('#assignBtn');
await settle(page);
eq((await names()).sort(), ROSTERS['5th Period'].slice().sort(), 'Assign students deals the remembered class');

/* it survives a reload */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await picked(), '5th Period', 'after a reload the picker is still on 5th Period');

/* a list that has gone is named, not guessed */
await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('np_rosters')); delete r['5th Period']; localStorage.setItem('np_rosters', JSON.stringify(r)); });
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await picked(), '', 'a list that is no longer saved is not picked');
ok(/last assigned from “5th Period”, which is not saved on this device now/.test(await summary()), 'and the tool says which one has gone: ' + (await summary()));
eq((await current()).doc.roster, '5th Period', '...without forgetting its name');

/* the memory stays out of a shared file */
const shared = JSON.parse(await downloadText(page, '#exportFileBtn', { what: 'the saved file' }));
ok(!('roster' in shared.doc), 'a saved file does not carry the class list’s name');
ok(!JSON.stringify(shared).includes('5th Period'), '...anywhere');

/* an opened file does not bring one in */
const tmp = path.join(os.homedir(), '.cache', 'selector-scratch', 'AI-31');
fs.mkdirSync(tmp, { recursive: true });
const file = path.join(tmp, 'incoming.civics.json');
const incoming = JSON.parse(JSON.stringify(shared));
incoming.name = 'Incoming';
incoming.doc.roster = 'Somebody else’s period';
fs.writeFileSync(file, JSON.stringify(incoming));
await page.setInputFiles('#importFileInput', file);
await settle(page, 400);
cur = await current();
eq(cur.name, 'Incoming', 'the file opened under its own name');
ok(!('roster' in cur.doc), 'and brought no class list with it');
fs.rmSync(file, { force: true });

/* a simulation saved before this is what it was */
await page.evaluate(() => {
  const old = { v: 2, title: 'Old', roles: [{ id: 'r1', role: 'Judge', position: '', copies: 1, students: ['Ann Lee'], caseFile: '', ballot: false, points: [] }],
    agenda: [], ballot: { title: '', question: '', instructions: '', options: [], names: false, extra: '' },
    rubric: { levels: ['', '', '', ''], criteria: [] }, reflection: { title: '', prompts: [] },
    print: { agenda: true, cards: true, caseFiles: true, ballots: true, rubric: true, reflections: true } };
  localStorage.setItem('crcg:data:Old one', JSON.stringify(old));
  localStorage.setItem('crcg:list', JSON.stringify(JSON.parse(localStorage.getItem('crcg:list')).concat(['Old one'])));
  window.__old = JSON.stringify(old);
});
await page.reload({ waitUntil: 'networkidle' });
await page.selectOption('#simSelect', 'Old one');
await settle(page, 300);
eq(await picked(), '', 'an older simulation opens with no list chosen');
await edit();
cur = await current();
ok(!('roster' in cur.doc), 'and saving it adds no roster field');
const keys = Object.keys(cur.doc).sort();
eq(keys, ['agenda', 'ballot', 'print', 'reflection', 'roles', 'rubric', 'title', 'v'], 'its saved shape is the one it had');

eq(page.__errs, [], 'no page errors');
await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
