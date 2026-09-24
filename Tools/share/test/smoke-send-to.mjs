// smoke-send-to.mjs — Path 6 P4 in a real browser: the share sheet's
// "Send to…" row, 052 Cognates & False Friends -> 040 Vocabulary Flashcards.
//
//   node Tools/share/test/smoke-send-to.mjs      (or: npm run test:send-to)
//
// handoffs.test.mjs proves the table, the transform and the link in Node.
// This suite proves the two halves a page adds: the ROW — it exists in 052's
// sheet, it is absent from a page that has not loaded handoffs.js, and it
// opens the receiver in a new tab — and the ARRIVAL: 040 opens that link,
// saves the list under its own name without touching what it had, and
// renders the cognates as cards, which is the only reason to send them.
//
// Per section:
//   1. 052 with a saved list: the sheet has a data-share="send:…" row after
//      the four it always has; clicking it calls window.open with 040's page
//      and 040's parameter; the note under the toolbar says so; a blocked
//      pop-up is reported as an error.
//   2. 040 opens the captured link on a device that already has a list: the
//      arrival is filed under a new name, the existing list is untouched, and
//      the preview shows the cognates as flashcards — with a false friend's
//      trap on the definition side.
//   3. axe on 052's open sheet with the extra row (light and dark, since the
//      row is new chrome in a dialog the site-wide sweep never opens).
//   4. a page that loads share.js without handoffs.js has no Send row — the
//      row is opt-in per page, not a site-wide surprise.
//   5. no console errors and nothing left the site.
//   6. the rollout's rows: 046, 039 and 056 (sheet: false).
//   7. the roster chain: 002's sheet sends its grouping to 022, which files
//      it as a new lab class with roles (and survives a hostile link); 022's
//      "Seat these groups" button seats them in 005 as a new section.
//
// Exits 1 on any failure. Every name here is invented.

import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import fs from 'fs';
import path from 'path';

const PORT = 8416;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SENDER = '052-cognates-false-friends-builder.html';
const RECEIVER = '040-vocab-flashcard-generator.html';

/* ── 0. static: 052 loads the registry and the table after share.js ─────── */
console.log('Send to… — 052 → 040');
{
  const html = fs.readFileSync(path.join(SITE, 'Tools', SENDER), 'utf8');
  const at = ['_shared/share.js', '_shared/tool-registry.js', '_shared/handoffs.js'].map(s => html.indexOf(`src="../${s}"`));
  ok(at.every(i => i !== -1), '052 loads share.js, tool-registry.js and handoffs.js: ' + JSON.stringify(at));
  ok(at[0] < at[1] && at[1] < at[2], 'in that order');
}

const server = await serve(PORT);
const browser = await launch();
const pages = [];

const LIST = {
  lang: 'Portuguese',
  cognates: [{ id: 'c1', target: 'animal', english: 'animal' }, { id: 'c2', target: 'hospital', english: 'hospital' }],
  falseFriends: [{ id: 'f1', target: 'puxar', looksLike: 'push', actual: 'to pull' }],
};

/* ── 1. the row, on the sender ──────────────────────────────────────────── */
const sender = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['052', sender]);
await sender.addInitScript(v => { localStorage.setItem('cffb_list_v1', v); }, JSON.stringify(LIST));
await sender.goto(BASE + '/Tools/' + SENDER, { waitUntil: 'load' });
await settle(sender, 600);

await sender.click('#shareBtn');
await settle(sender, 250);
const rows = await sender.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('send:vocab-flashcard-generator'), 'the sheet has a Send to Vocabulary Flashcards row: ' + JSON.stringify(rows));
ok(rows.indexOf('send:vocab-flashcard-generator') > rows.indexOf('download'), 'after the rows the sheet always has');
eq(await sender.textContent('.share-sheet button[data-share="send:vocab-flashcard-generator"] span'),
  'Send to Vocabulary Flashcards', 'with the entry\'s label');

const sent = await sender.evaluate(() => {
  const opened = [];
  window.open = (url, target, features) => { opened.push({ url, target, features }); return {}; };
  document.querySelector('.share-sheet button[data-share="send:vocab-flashcard-generator"]').click();
  return { opened, status: document.querySelector('.share-sheet-status').textContent };
});
eq(sent.opened.length, 1, 'clicking it opens exactly one tab');
const url = sent.opened[0] && sent.opened[0].url;
ok(url && url.indexOf(BASE + '/Tools/' + RECEIVER + '?deck=') === 0, 'at 040\'s page with 040\'s parameter: ' + JSON.stringify(url));
eq(sent.opened[0] && sent.opened[0].features, 'noopener', 'as a noopener tab');
ok(/new tab/.test(sent.status), 'and the sheet says so: ' + JSON.stringify(sent.status));
ok(/new tab/.test(await sender.textContent('#shareNote')), 'as does the note under the toolbar');
const payload = await sender.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('deck')), url);
eq(payload.name, 'Portuguese cognates & false friends', 'the payload is a named word list');
ok(payload.words.split('\n').length === 3 && payload.words.indexOf('puxar: to pull (not “push”)') !== -1,
  'with one line per pair and the false friend\'s trap: ' + JSON.stringify(payload.words));

const blocked = await sender.evaluate(() => {
  window.open = () => null;
  document.querySelector('.share-sheet button[data-share="send:vocab-flashcard-generator"]').click();
  const s = document.querySelector('.share-sheet-status');
  return { text: s.textContent, error: s.classList.contains('error') };
});
ok(/pop-ups/.test(blocked.text) && blocked.error, 'a blocked pop-up is reported as an error with what to do: ' + JSON.stringify(blocked.text));

/* ── 3. axe on the open sheet, light and dark ───────────────────────────── */
const light = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
eq(light.length, 0, 'no serious/critical axe violations on the open sheet with the Send row (light): ' + JSON.stringify(light.map(v => v.id)));
await sender.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await settle(sender, 200);
const dark = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
eq(dark.length, 0, 'and in dark: ' + JSON.stringify(dark.map(v => v.id)));
await sender.keyboard.press('Escape');
await settle(sender, 200);

/* ── 2. the arrival, on a device that already has a list ────────────────── */
console.log('\n040 — the arrival');
const receiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['040', receiver]);
await receiver.goto(BASE + '/Tools/' + RECEIVER, { waitUntil: 'load' });
await settle(receiver, 600);
const before = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:list') || '[]'));
await receiver.goto(url, { waitUntil: 'load' });
await settle(receiver, 900);
const after = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:list') || '[]'));
eq(after.length, before.length + 1, `040 files the arrival as one new list (had ${before.length}): ` + JSON.stringify(after));
const newName = after.find(n => before.indexOf(n) === -1);
ok(newName && newName.indexOf('Portuguese cognates & false friends') === 0, 'under the name the sender gave it: ' + JSON.stringify(newName));
ok(/saved here as/.test(await receiver.textContent('#shareNote')), '040 says what it did: ' + JSON.stringify(await receiver.textContent('#shareNote')));
eq(await receiver.inputValue('#wordInput'), payload.words, 'the word list on screen is exactly what was sent');
eq(new URL(receiver.url()).searchParams.get('deck'), null, 'the parameter is consumed on open');
const preview = await receiver.textContent('#previewArea');
ok(preview && preview.indexOf('animal') !== -1 && preview.indexOf('hospital') !== -1, 'and the preview shows the cognates as cards');
const words = await receiver.inputValue('#wordInput');
ok(words.indexOf('not “push”') !== -1, 'the false friend\'s trap arrived on the definition side');

/* ── 4. no handoffs.js, no row ──────────────────────────────────────────── */
console.log('\n054 — a page that has not opted in');
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
pages.push(['054', other]);
await other.goto(BASE + '/Tools/054-current-events-discussion-guide-generator.html', { waitUntil: 'load' });
await settle(other, 600);
eq(await other.evaluate(() => typeof window.Handoffs), 'undefined', '054 has not loaded handoffs.js');
await other.click('#shareBtn');
await settle(other, 250);
const otherRows = await other.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(!otherRows.some(r => r.indexOf('send:') === 0), 'and its sheet has no Send row: ' + JSON.stringify(otherRows));
await other.keyboard.press('Escape');

/* ── 6. the rollout's rows (2026-09-24) ─────────────────────────────────── */
/* 046 -> 015 and 039 -> 040 are rows in their senders' sheets; 056 -> 028 is
   declared with `sheet: false` and must NOT be one, because it sends a single
   source from that source's own button. The full 046 flow on a calibrated map
   is smoke-timeline-handoff.mjs; 056's button is smoke-essay-levels.mjs. */
console.log('\n046, 039, 056 — the rollout\'s rows');
const openRows = async (p) => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
};
const clickSend = (p, slug) => p.evaluate((s) => {
  const opened = [];
  window.open = (u, target, features) => { opened.push({ u, features }); return {}; };
  document.querySelector('.share-sheet button[data-share="send:' + s + '"]').click();
  const st = document.querySelector('.share-sheet-status');
  const out = { opened, status: st.textContent, error: st.classList.contains('error') };
  window.Share.close();
  return out;
}, slug);

{
  const map = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['046', map]);
  /* An uncalibrated project with labels: the row is there, and refuses in words. */
  await map.addInitScript(v => { if (!localStorage.getItem('bmg_workspace_v1')) localStorage.setItem('bmg_workspace_v1', v); }, JSON.stringify({
    __v: 1, activeId: 'p1', labelSets: [],
    projects: [{ id: 'p1', name: 'Rivers', updatedAt: 1, data: { __v: 1, mapId: 'vector:europe:72,34,-25,45:land', view: { x: 0, y: 0, scale: 1 }, labels: [{ id: 'l1', x: 10, y: 10, text: 'Danube' }], markers: [] } }],
  }));
  await map.goto(BASE + '/Tools/046-blank-map-generator.html', { waitUntil: 'load' });
  await settle(map, 900);
  const mapRows = await openRows(map);
  ok(mapRows.includes('send:timeline-builder'), '046\'s sheet has a Send places to Timeline Builder row: ' + JSON.stringify(mapRows));
  const refused = await clickSend(map, 'timeline-builder');
  eq(refused.opened.length, 0, 'an uncalibrated map opens no tab');
  ok(refused.error && /latitude and longitude/.test(refused.status), 'and says what to do first, as an error: ' + JSON.stringify(refused.status));

  const drill = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['039', drill]);
  await drill.addInitScript(() => {
    if (localStorage.getItem('gvb-vocab-conj:list')) return;
    localStorage.setItem('gvb-vocab-conj:list', JSON.stringify(['Food words']));
    localStorage.setItem('gvb-vocab-conj:data:Food words', JSON.stringify({ name: 'Food words', mode: 'vocab', vocabText: 'la manzana: apple\nel pan: bread', persons: ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos'], conjugations: [] }));
    localStorage.setItem('gvb-vocab-conj:current', 'Food words');
  });
  await drill.goto(BASE + '/Tools/039-vocab-conjugation-drill.html', { waitUntil: 'load' });
  await settle(drill, 800);
  const drillRows = await openRows(drill);
  ok(drillRows.includes('send:vocab-flashcard-generator'), '039\'s sheet has a Send to Vocabulary Flashcards row: ' + JSON.stringify(drillRows));
  const sentDrill = await clickSend(drill, 'vocab-flashcard-generator');
  eq(sentDrill.opened.length, 1, 'clicking it opens one tab');
  const dUrl = sentDrill.opened[0] && sentDrill.opened[0].u;
  ok(dUrl && dUrl.indexOf(BASE + '/Tools/' + RECEIVER + '?deck=') === 0, 'at 040 with 040\'s parameter: ' + JSON.stringify(dUrl));
  const dPayload = await drill.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('deck')), dUrl);
  eq(JSON.stringify(dPayload), JSON.stringify({ name: 'Food words', words: 'la manzana: apple\nel pan: bread' }), 'carrying the set\'s name and its words');

  const packet = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['056', packet]);
  await packet.goto(BASE + '/Tools/056-dbq-source-packet-builder.html', { waitUntil: 'load' });
  await settle(packet, 800);
  eq(await packet.evaluate(() => window.Handoffs.from('dbq-source-packet-builder').length), 1, '056 declares one handoff');
  const packetRows = await openRows(packet);
  ok(!packetRows.some(r => r.indexOf('send:') === 0), 'but its sheet has no Send row — that handoff is one source, from its own button: ' + JSON.stringify(packetRows));
  await packet.keyboard.press('Escape');
}

/* ── 7. the roster chain: 002 -> 022 -> 005 (2026-09-24) ────────────────── */
/* 006/007 -> 002 is deliberately NOT a handoff (002 reads the same saved
   class lists through roster.js, on the same device, with no URL); that is
   asserted in handoffs.test.mjs. What is driven here is the two hops that
   are: 002's sheet sends its grouping to 022, 022 files it as a new lab class
   with roles, and 022's own button seats those groups in 005 as a section. */
console.log('\n002 → 022 → 005 — the roster chain');
{
  const NAMES = ['Ada Quill', 'Bram Sorrel', 'Cleo Varga', 'Dov Ansel', 'Esme Pruitt', 'Fitz Morrow', 'Gus Halden', 'Hana Obi'];
  const groupsGen = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['002', groupsGen]);
  await groupsGen.goto(BASE + '/Tools/002-group-team-generator.html', { waitUntil: 'load' });
  await settle(groupsGen, 700);
  await groupsGen.fill('#names-input', NAMES.join('\n'));
  await groupsGen.dispatchEvent('#names-input', 'input');
  await settle(groupsGen, 200);
  await groupsGen.click('#generate-btn');
  await settle(groupsGen, 400);
  await groupsGen.click('#share-btn');
  await settle(groupsGen, 250);
  const gRows = await groupsGen.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
  ok(gRows.includes('send:lab-group-role-randomizer'), '002\'s sheet has a Send to Lab Group & Role Randomizer row: ' + JSON.stringify(gRows));
  const sentG = await clickSend(groupsGen, 'lab-group-role-randomizer');
  eq(sentG.opened.length, 1, 'clicking it opens one tab');
  const gUrl = sentG.opened[0] && sentG.opened[0].u;
  ok(gUrl && gUrl.indexOf(BASE + '/Tools/022-lab-group-role-randomizer.html?labgroups=') === 0, 'at 022 with 022\'s parameter, off the registry: ' + JSON.stringify(gUrl && gUrl.slice(0, 90)));
  const gPayload = await groupsGen.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('labgroups')), gUrl);
  const sentNames = (gPayload.groups || []).flatMap(g => g.members).sort();
  eq(JSON.stringify(sentNames), JSON.stringify(NAMES.slice().sort()), 'every name in the grouping travels, once');
  eq(Object.keys(gPayload).sort().join(','), 'groups,name,v', 'and nothing but the name, the groups and a version');
  ok(gPayload.groups.every(g => Object.keys(g).sort().join(',') === 'label,members'), 'each group is its label and members — no skill numbers, no pairing memory');

  /* 022, on a device that already has a class with role history. */
  const EXISTING = { name: 'Period 1', students: 'Ivo Lark\nJuno Pell', roles: [{ name: 'Recorder', description: '' }], stations: [], mode: 'count', splitValue: 2,
    history: { 'Ivo Lark': ['Recorder'] }, lastGroups: null, checkoutLog: [], keepApart: [], absent: [] };
  const lab = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['022', lab]);
  await lab.addInitScript(v => {
    if (localStorage.getItem('lgrr_rosters')) return;
    localStorage.setItem('lgrr_rosters', JSON.stringify({ 'Period 1': JSON.parse(v) }));
    localStorage.setItem('lgrr_current', 'Period 1');
  }, JSON.stringify(EXISTING));
  await lab.goto(BASE + '/Tools/022-lab-group-role-randomizer.html', { waitUntil: 'load' });
  await settle(lab, 600);
  const labBefore = await lab.evaluate(() => localStorage.getItem('lgrr_rosters'));
  await lab.goto(gUrl, { waitUntil: 'load' });
  await settle(lab, 800);
  const labAll = await lab.evaluate(() => JSON.parse(localStorage.getItem('lgrr_rosters')));
  eq(Object.keys(labAll).length, 2, '022 files the arrival as one new lab class: ' + JSON.stringify(Object.keys(labAll)));
  eq(JSON.stringify(labAll['Period 1']), JSON.stringify(JSON.parse(labBefore)['Period 1']), 'the class already here is untouched, role history and all');
  const arrivedName = Object.keys(labAll).find(n => n !== 'Period 1');
  const arrivedClass = labAll[arrivedName];
  eq(await lab.evaluate(() => localStorage.getItem('lgrr_current')), arrivedName, 'and the arrival is the class on screen');
  eq(JSON.stringify(arrivedClass.lastGroups.map(g => g.members.map(m => m.name))), JSON.stringify(gPayload.groups.map(g => g.members)),
    'the groups are kept exactly as 002 made them');
  const roleNames = arrivedClass.roles.map(r => r.name);
  ok(arrivedClass.lastGroups.every(g => g.members.every(m => roleNames.indexOf(m.role) !== -1)), 'every member was handed one of 022\'s roles');
  ok(arrivedClass.lastGroups.every(g => new Set(g.members.map(m => m.role)).size === g.members.length), 'and no role twice in a group');
  eq(arrivedClass.students.split('\n').sort().join('|'), NAMES.slice().sort().join('|'), 'its roster is the names that arrived');
  eq((await lab.$$('#resultsArea .group-card')).length, gPayload.groups.length, 'the groups are on screen');
  ok(/new lab class/.test(await lab.textContent('#msg')), '022 says what it did: ' + JSON.stringify(await lab.textContent('#msg')));
  eq(new URL(lab.url()).searchParams.get('labgroups'), null, 'the parameter is consumed on open');

  /* A hostile link: markup in a name renders as text; a prototype key is dropped rather than breaking the page. */
  const hostileUrl = await lab.evaluate(() => window.StateLink.buildShareUrl('labgroups',
    { v: 1, name: 'Hostile', groups: [{ label: 'x', members: ['<img src=x onerror="window.__pwned=1">', '__proto__', 'constructor', 'Real Kid'] }] },
    { base: location.origin + location.pathname }));
  await lab.goto(hostileUrl, { waitUntil: 'load' });
  await settle(lab, 700);
  eq(await lab.evaluate(() => document.querySelectorAll('#resultsArea img').length), 0, 'markup in an arriving name is text, not an element');
  eq(await lab.evaluate(() => window.__pwned), undefined, 'and runs nothing');
  const hostile = await lab.evaluate(() => JSON.parse(localStorage.getItem('lgrr_rosters'))['Hostile']);
  eq(JSON.stringify(hostile && hostile.lastGroups[0].members.map(m => m.name)), JSON.stringify(['<img src=x onerror="window.__pwned=1">', 'Real Kid']),
    'a name that is a key of Object.prototype is dropped, the rest arrive');

  /* 022 -> 005, from 022's own button, on the arrived class. */
  await lab.evaluate(n => { const sel = document.getElementById('rosterSwitch'); sel.value = n; sel.dispatchEvent(new Event('change')); }, arrivedName);
  await settle(lab, 300);
  const seat = await lab.evaluate(() => {
    const opened = [];
    window.open = (u, target, features) => { opened.push({ u, features }); return {}; };
    document.getElementById('seatBtn').click();
    return { opened, msg: document.getElementById('msg').textContent };
  });
  eq(seat.opened.length, 1, '"Seat these groups" opens one tab');
  const sUrl = seat.opened[0] && seat.opened[0].u;
  ok(sUrl && sUrl.indexOf(BASE + '/Tools/005-Seating%20Chart%20Generator.html?section=') === 0, 'at 005 with 005\'s parameter: ' + JSON.stringify(sUrl && sUrl.slice(0, 90)));
  ok(/new tab/.test(seat.msg), 'and 022 says so: ' + JSON.stringify(seat.msg));
  const sPayload = await lab.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('section')), sUrl);
  const flat = JSON.stringify(sPayload);
  ok(!/Recorder|Materials|Safety|Reporter/.test(flat), 'no role travels to the seating chart');

  const seating = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['005', seating]);
  await seating.goto(BASE + '/Tools/005-Seating%20Chart%20Generator.html', { waitUntil: 'load' });
  await settle(seating, 800);
  const secBefore = await seating.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1')).sections.length);
  await seating.goto(sUrl, { waitUntil: 'load' });
  await settle(seating, 900);
  const seatState = await seating.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1')));
  eq(seatState.sections.length, secBefore + 1, `005 adds the groups as one new section (had ${secBefore})`);
  const sec = seatState.sections.find(x => x.id === seatState.active);
  eq(sec && sec.name, arrivedName + ' — lab groups', 'named after the lab class, and it is the section on screen');
  eq(sec && sec.students.length, NAMES.length, 'with every student');
  eq(sec && Object.keys(sec.assign).length, NAMES.length, 'and every student seated');
  const byId = Object.fromEntries((sec ? sec.students : []).map(x => [x.id, x.name]));
  const deskOf = {};
  for (const [d, sid] of Object.entries(sec ? sec.assign : {})) deskOf[byId[sid]] = sec.desks.find(k => k.id === d);
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= 142 * 1.5;
  ok(arrivedClass.lastGroups.every(g => g.members.every(m => g.members.every(o => near(deskOf[m.name], deskOf[o.name])))),
    'each group sits together at its own pod');
  ok(arrivedClass.lastGroups.every((g, i) => arrivedClass.lastGroups.every((h, j) => i === j ||
    g.members.every(m => h.members.every(o => Math.hypot(deskOf[m.name].x - deskOf[o.name].x, deskOf[m.name].y - deskOf[o.name].y) > 10)))),
    'and no two students share a desk position');
}

/* ── 5. no console noise, nowhere ───────────────────────────────────────── */
console.log('');
for (const [name, p] of pages) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
