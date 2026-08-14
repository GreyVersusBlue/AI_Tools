// smoke-case-file-packets.mjs — per-role case-file packets and the share link.
//
//   node Tools/civics-role-card-generator/test/smoke-case-file-packets.mjs
//
// The tool used to print only the role-card grid. Each role now carries an
// optional long-form Case file field, and printing appends one companion
// packet page per printed copy of any role that has case-file text — headed
// with the role name and (when assigned) the student's name for that copy.
// What this suite holds down:
//
//   The default Mock Trial template demos the feature out of the box: Judge,
//   both attorney roles, and the Witness carry sample case-file text; the
//   Juror does not (jurors shouldn't see outside case facts before a real
//   trial), so it prints no packets.
//
//   Packet count matches each role's copies, not one packet per role — a
//   4-copy Witness role prints 4 packets.
//
//   Every packet is set to start on its own fresh page (page-break-before:
//   always), never sharing a page with another packet or the card grid.
//
//   Assigned student names carry onto the matching packet, same index as the
//   card that printed for that copy.
//
//   Whitespace-only case-file text counts as "none" — no packet prints.
//
//   The share link/QR round-trips a full role set (role, position, points,
//   copies, and case-file text) through state-link.js, and — since this tool
//   has no multiple-named-save yet — asks with a confirm dialog before
//   replacing whatever role set is already on screen, and truly does nothing
//   if that confirm is declined.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8151;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/050-civics-role-card-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

/** One click of Print builds both the card grid and the packets into
 *  #printArea together, so a single pass reads both back. */
async function printedOutput(page) {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#printArea .role-print-card')).map(c => ({
      role: c.querySelector('h3').textContent,
      name: c.querySelector('.assigned') ? c.querySelector('.assigned').textContent : null,
    })),
    packets: Array.from(document.querySelectorAll('#printArea .role-packet')).map(p => ({
      role: p.querySelector('.role-packet-head h3').textContent,
      who: p.querySelector('.role-packet-who') ? p.querySelector('.role-packet-who').textContent : null,
      body: p.querySelector('.role-packet-body').textContent,
    })),
  }));
}
const printedPackets = async page => (await printedOutput(page)).packets;

console.log('Civics Role Card Generator — case-file packets and share link');

/* ── 1. the default template demos the feature ──────────────────────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

const packets = await printedPackets(page);
// Mock Trial ships Judge:1, Prosecution:2, Defense:2, Witness:4, Juror:12 —
// the first four carry case-file text, the jury does not.
eq(packets.length, 9, 'one packet per copy of Judge/Prosecution/Defense/Witness, none for the jury');
ok(packets.every(p => p.role !== 'Juror'), 'no juror packets — jurors get no outside case file');
ok(packets.filter(p => p.role.indexOf('Witness') !== -1).length === 4, 'all 4 witness copies get their own packet');
ok(/hall monitor/.test(packets.find(p => p.role.indexOf('Witness') !== -1).body),
   'the witness packet carries the witness-specific statement, not the shared fact pattern');
ok(/Locker #214/.test(packets.find(p => p.role.indexOf('Judge') !== -1).body),
   'the judge packet carries the shared case background');

/* ── 2. every packet starts on its own page ──────────────────────────────── */
const breakBefore = await page.evaluate(() => {
  const p = document.querySelector('#printArea .role-packet');
  return getComputedStyle(p).breakBefore || getComputedStyle(p).pageBreakBefore;
});
// Chromium normalizes `page-break-before: always` to the computed value
// "page" (the modern break-before keyword it aliases to) rather than
// echoing "always" back — either value means the same forced page break.
ok(breakBefore === 'always' || breakBefore === 'page', 'each packet is forced onto a fresh page (got ' + JSON.stringify(breakBefore) + ')');

/* ── 3. assigned names carry onto the matching packet ────────────────────── */
await page.evaluate(names => {
  localStorage.setItem('np_rosters', JSON.stringify({ Class: names }));
}, Array.from({ length: 21 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`));
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
await page.selectOption('#rosterSelect', 'Class');
await page.click('#assignBtn');
await settle(page);

const { cards, packets: namedPackets } = await printedOutput(page);
const witnessCardNames = cards.filter(c => c.role === 'Witness').map(c => c.name);
const witnessPacketNames = namedPackets.filter(p => p.role.indexOf('Witness') !== -1).map(p => p.who);
eq(witnessPacketNames.join(','), witnessCardNames.join(','), 'each witness packet names the same student as the matching card, in the same order');

/* ── 4. whitespace-only case-file text prints no packet ──────────────────── */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('crcg_roles_v1'));
  s.roles.forEach(r => { r.caseFile = '   '; });
  localStorage.setItem('crcg_roles_v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq((await printedPackets(page)).length, 0, 'whitespace-only case-file text counts as none — no packets print');

/* ── 5. typing a case file, and it surviving a reload ─────────────────────── */
await page.evaluate(() => {
  localStorage.clear();
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
const firstTextarea = await page.evaluate(() => {
  const ta = document.querySelector('#rolesWrap textarea[data-field="caseFile"]');
  return ta ? ta.getAttribute('data-role') : null;
});
ok(!!firstTextarea, 'the first role has a case-file textarea');
await page.fill(`textarea[data-role="${firstTextarea}"][data-field="caseFile"]`, 'Custom case-file text for this role.');
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
const survived = await page.evaluate(id => {
  const ta = document.querySelector(`textarea[data-role="${id}"][data-field="caseFile"]`);
  return ta ? ta.value : null;
}, firstTextarea);
eq(survived, 'Custom case-file text for this role.', 'typed case-file text survives a reload');

/* ── 6. share link round-trips a full role set ───────────────────────────── */
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('crcg_roles_v1', JSON.stringify({
    roles: [
      { id: 'r1', role: 'Town Mayor', position: 'Runs the council meeting', copies: 2, students: ['Ari', 'Bo'],
        caseFile: 'The town budget is short by $4,000 this year.',
        points: [{ id: 'p1', text: 'Open the session' }, { id: 'p2', text: 'Call for a vote' }] },
      { id: 'r2', role: 'Council Member', position: 'Votes on proposals', copies: 1, students: [],
        caseFile: '', points: [{ id: 'p3', text: 'Raise questions' }] },
    ],
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page);

await page.evaluate(() => {
  window.__copied = null;
  navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };
});
await page.click('#shareLinkBtn');
await settle(page);
const link = await page.evaluate(() => window.__copied);
ok(!!link && link.indexOf('roles=') !== -1, 'Copy link produces a URL carrying the roles= payload');

// 6a. opening the link on a fresh page with nothing loaded: no roles yet
// (localStorage empty) still boots the default template first, so the
// confirm dialog fires — accept it and the shared set replaces the default.
const fresh = await prepPage(browser, BASE, { width: 1280, height: 1000 });
let dialogSeen = false;
fresh.on('dialog', d => { dialogSeen = true; d.accept(); });
await fresh.goto(link, { waitUntil: 'networkidle' });
await settle(fresh);
ok(dialogSeen, 'opening a shared link while roles already exist asks for confirmation first');
const imported = await fresh.evaluate(() => JSON.parse(localStorage.getItem('crcg_roles_v1')));
eq(imported.roles.length, 2, 'both shared roles arrived');
eq(imported.roles[0].role, 'Town Mayor', 'role name round-tripped');
eq(imported.roles[0].position, 'Runs the council meeting', 'position round-tripped');
eq(imported.roles[0].copies, 2, 'copies round-tripped');
eq(imported.roles[0].caseFile, 'The town budget is short by $4,000 this year.', 'case-file text round-tripped');
eq(imported.roles[0].points.map(p => p.text).join(','), 'Open the session,Call for a vote', 'talking points round-tripped');
eq(imported.roles[1].caseFile, '', 'an empty case file round-trips as empty, not missing');

// 6b. declining the confirm leaves the current roles untouched.
const declined = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await declined.goto(URL_PAGE, { waitUntil: 'networkidle' });
await declined.evaluate(() => {
  localStorage.setItem('crcg_roles_v1', JSON.stringify({
    roles: [{ id: 'keep1', role: 'Keep Me', position: '', copies: 1, students: [], caseFile: '',
      points: [{ id: 'kp1', text: 'stay' }] }],
  }));
});
await declined.reload({ waitUntil: 'networkidle' });
await settle(declined);
declined.on('dialog', d => d.dismiss());
await declined.goto(link, { waitUntil: 'networkidle' });
await settle(declined);
const afterDecline = await declined.evaluate(() => JSON.parse(localStorage.getItem('crcg_roles_v1')));
eq(afterDecline.roles.length, 1, 'declining the confirm keeps the existing role set');
eq(afterDecline.roles[0].role, 'Keep Me', 'and it is still the original role, not the shared one');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
for (const [label, p] of [['main', page], ['fresh-import', fresh], ['declined-import', declined]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
