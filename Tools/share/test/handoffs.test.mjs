// handoffs.test.mjs — _shared/handoffs.js and the registry's `share.param`.
// Plain Node, no browser.
//
//   node Tools/share/test/handoffs.test.mjs      (part of: npm run test:share)
//
// Path 6 P4's claim is that a cross-tool "Send to…" is a DECLARED entry — the
// receiver's page and parameter come from _shared/tool-registry.js — rather
// than a file name and a parameter hard-coded in the sender the way 046 and
// 056 did it. That claim is only worth anything if the registry cannot drift
// from the pages, so section 1 reads every tool page that calls
// Share.receive(), finds the parameter it reads, and checks the registry says
// the same. A receiver that renames its parameter fails here, not in a
// teacher's browser.
//
// Sections 2-4 drive the module itself in a vm with the REAL state-link.js
// and tool-registry.js: the one declared handoff (052 -> 040) transforms a
// cognate list into 040's "term: definition" lines, the link is built against
// 040's page with 040's parameter, and a handoff to a tool that cannot
// receive is refused with a sentence rather than a dead link.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const read = f => fs.readFileSync(path.join(SITE, ...f.split('/')), 'utf8');

function make({ noRegistry = false } = {}) {
  const opened = [];
  const win = {
    location: { href: 'https://aspermylessonplan.com/Tools/052-cognates-false-friends-builder.html' },
    history: { replaceState() {} },
    open(url) { opened.push(url); return win.__block ? null : {}; },
    __opened: opened,
    URL, encodeURIComponent, decodeURIComponent, btoa, atob, TextEncoder, TextDecoder,
    console,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(read('_shared/state-link.js'), ctx, { filename: 'state-link.js' });
  if (!noRegistry) vm.runInContext(read('_shared/tool-registry.js'), ctx, { filename: 'tool-registry.js' });
  vm.runInContext(read('_shared/handoffs.js'), ctx, { filename: 'handoffs.js' });
  return win;
}

/* ── 1. the registry's share.param matches every receiving page ──────────── */
console.log('handoffs — the registry cannot drift from the pages');
{
  const win = make();
  const reg = win.ToolRegistry;
  const pages = fs.readdirSync(path.join(SITE, 'Tools')).filter(f => /^\d{3}-.*\.html$/.test(f)).sort();
  let receivers = 0;
  for (const file of pages) {
    const html = read('Tools/' + file);
    /* The registry writes a space as %20, the way sw.js's precache list does. */
    const row = reg.tools.find(t => t.file === 'Tools/' + file.replace(/ /g, '%20'));
    ok(row, `every tool page has a registry row: ${file}`);
    if (!row) continue;
    /* 064, P1's own adopter, consumes the parameter through StateLink.getParam
       directly; every later adopter goes through Share.receive(). */
    const receives = html.indexOf('Share.receive(') !== -1 || html.indexOf('StateLink.getParam(SHARE_PARAM)') !== -1;
    /* The parameter the page reads, off its own source: a SHARE_PARAM
       constant, or the literal in its Share.receive({ param }) call (007). */
    const m = html.match(/SHARE_PARAM\s*=\s*'([a-z]+)'/) || html.match(/Share\.receive\(\{\s*param\s*:\s*'([a-z]+)'/);
    if (receives) {
      receivers++;
      ok(m, `${file.slice(0, 3)}: a page that consumes a share parameter names its parameter in a way this suite can read`);
      ok(row.share && row.share.param, `${file.slice(0, 3)}: its registry row declares share.param`);
      if (m && row.share) eq(row.share.param, m[1], `${file.slice(0, 3)}: and the registry's parameter is the one the page reads`);
    } else {
      ok(!row.share, `${file.slice(0, 3)}: a page with no receiver declares no share.param (a handoff to it would be a dead link)`);
    }
  }
  ok(receivers >= 24, `at least the 24 receivers known on 2026-09-08 were found: ${receivers}`);
}

/* ── 2. the declared table ──────────────────────────────────────────────── */
console.log('\nhandoffs — the table');
{
  const win = make();
  const H = win.Handoffs;
  ok(Array.isArray(H.all) && H.all.length >= 6, 'the six handoffs of 2026-09-24 are declared');
  for (const h of H.all) {
    ok(win.ToolRegistry.bySlug(h.from), `entry ${h.from} -> ${h.to}: the sender is a registry slug`);
    const t = win.ToolRegistry.bySlug(h.to);
    ok(t, `entry ${h.from} -> ${h.to}: the receiver is a registry slug`);
    ok(t && t.share && t.share.param, `entry ${h.from} -> ${h.to}: the receiver can receive a link`);
    ok(typeof h.transform === 'function', `entry ${h.from} -> ${h.to}: has a transform`);
    ok(typeof h.label === 'string' && h.label.length > 4, `entry ${h.from} -> ${h.to}: has a row label`);
  }
  eq(H.from('cognates-false-friends-builder').map(h => h.to), ['vocab-flashcard-generator'],
    '052 has exactly one handoff, to 040');
  eq(H.from('no-such-tool'), [], 'an unknown sender has none');
}

/* ── 3. 052 -> 040: the transform and the link ──────────────────────────── */
console.log('\nhandoffs — cognates to flashcards');
{
  const win = make();
  const H = win.Handoffs;
  const entry = H.from('cognates-false-friends-builder')[0];
  const state = {
    lang: 'Portuguese',
    cognates: [{ id: 'c1', target: 'animal', english: 'animal' }, { id: 'c2', target: '  ', english: 'blank, skipped' },
               { id: 'c3', target: 'nota: bene', english: 'note' }],
    falseFriends: [{ id: 'f1', target: 'puxar', looksLike: 'push', actual: 'to pull' },
                   { id: 'f2', target: 'pasta', looksLike: '', actual: 'folder' }],
  };
  const payload = entry.transform(state);
  eq(payload.name, 'Portuguese cognates & false friends', 'the list is named after the language');
  const lines = payload.words.split('\n');
  eq(lines[0], 'animal: animal', 'a cognate is one "term: definition" line, 040\'s own format');
  eq(lines.length, 4, 'a blank target is skipped, not sent as an empty card');
  ok(lines[1].indexOf('nota') === 0 && lines[1].indexOf(': note') !== -1 && lines[1].indexOf('nota:') === -1,
    'a colon inside a term is softened so 040 does not split the card there: ' + JSON.stringify(lines[1]));
  eq(lines[2], 'puxar: to pull (not “push”)', 'a false friend carries its trap on the back');
  eq(lines[3], 'pasta: folder', 'and one with no look-alike carries only its meaning');
  eq(entry.transform({ lang: '', cognates: [], falseFriends: [] }).words, '', 'an empty list transforms to no lines');
  eq(entry.transform({}).name, 'cognates & false friends', 'and a state with no language still has a name');

  const built = H.url(entry, state);
  ok(built.url.indexOf('https://aspermylessonplan.com/Tools/040-vocab-flashcard-generator.html?deck=') === 0,
    'the link opens 040\'s page with 040\'s parameter, both read off the registry: ' + built.url.slice(0, 90));
  const decoded = win.StateLink.decodeState(new URL(built.url).searchParams.get('deck'));
  eq(decoded, payload, 'and decodes to exactly the transformed payload');
  eq(built.target.slug, 'vocab-flashcard-generator', 'the receiver row comes back with it');
  ok(JSON.stringify(decoded).indexOf('"id"') === -1, 'no editor ids from the sender travel');

  const r = H.open(entry, state);
  eq(r.ok, true, 'open() reports success when the tab opened');
  eq(win.__opened, [built.url], 'and opened exactly that link');
  ok(/new tab/.test(r.message), 'with the entry\'s own sentence: ' + JSON.stringify(r.message));
  win.__block = true;
  const b = H.open(entry, state);
  eq(b.ok, false, 'a blocked pop-up is reported, not swallowed');
  ok(/pop-ups/.test(b.message), 'and says what to do: ' + JSON.stringify(b.message));
}

/* ── 3b. the rollout's entries (2026-09-24) ─────────────────────────────── */
console.log('\nhandoffs — map places to a timeline, a source to a worksheet, drill words to cards');
{
  const win = make();
  const H = win.Handoffs;
  const one = (from, to) => H.all.filter(h => h.from === from && h.to === to);

  /* 046 -> 015. The page supplies the coordinates; the entry builds 015's timeline. */
  const map = one('blank-map-generator', 'timeline-builder');
  eq(map.length, 1, '046 -> 015 is declared once');
  const tl = map[0].transform({ name: 'Silk Road', places: [
    { name: 'Samarkand', lat: 39.65, lon: 66.96 }, { name: '  ', lat: 1, lon: 1 }, { name: 'Nowhere', lat: NaN, lon: 0 },
    { name: 'Kashgar', lat: 39.47, lon: 75.99 }] });
  eq(tl.name, 'Silk Road', 'the timeline is named after the map');
  eq(tl.events.map(e => e.title), ['Samarkand', 'Kashgar'], 'every named place with real coordinates becomes an event; a blank or unplaced one does not');
  eq(tl.events[0].place, { name: 'Samarkand', lat: 39.65, lon: 66.96 }, 'with its name and coordinates as 015 files a place');
  ok(tl.events.every(e => e.yearStart === 0 && e.yearEnd === null), 'every event lands at year 0, the visible placeholder');
  eq(tl.events.map(e => e.id), [1, 2], 'with 015-local ids from 1');
  eq(map[0].transform({ places: [] }).name, 'Places from a map', 'an unnamed map still gives the timeline a name');
  const tlUrl = H.url(map[0], { name: 'Silk Road', places: [{ name: 'Samarkand', lat: 39.65, lon: 66.96 }] }).url;
  ok(tlUrl.indexOf('https://aspermylessonplan.com/Tools/015-timeline-builder.html?timeline=') === 0,
    '015\'s page and ?timeline= come off the registry, not out of 046: ' + tlUrl.slice(0, 90));

  /* 056 -> 028. One source, from its own row button; no row in the sheet. */
  const psa = one('dbq-source-packet-builder', 'primary-source-analysis-generator');
  eq(psa.length, 1, '056 -> 028 is declared once');
  eq(psa[0].sheet, false, 'and it has no row in the share sheet — it sends one source, not the packet');
  const ws = psa[0].transform({ source: { title: '', text: 'We the People…', citation: 'U.S. Constitution, 1787' }, letter: 'Source B', packetTitle: 'Founding documents' });
  eq(ws.sourceTitle, 'Source B', 'an untitled source goes by its letter');
  eq(ws.name, 'Source B — Founding documents', 'and the worksheet is named after it and the packet');
  eq(ws.sourceText, 'We the People…', 'its text travels as typed');
  eq(ws.citationOrigin, 'U.S. Constitution, 1787', 'its citation too');
  eq(ws.framework, 'soapstone', 'as a SOAPSTone worksheet, 028\'s framework for written sources');
  eq(ws.imageDataUrl, '', 'and never with a picture');
  ok(H.url(psa[0], { source: { text: 'x' } }).url.indexOf('/Tools/028-primary-source-analysis-generator.html?worksheet=') !== -1,
    '028\'s page and ?worksheet= come off the registry');

  /* 039 -> 040. The words, not the verbs. */
  const drill = one('vocab-conjugation-drill', 'vocab-flashcard-generator');
  eq(drill.length, 1, '039 -> 040 is declared once');
  const deck = drill[0].transform({ name: 'Spanish 1 — food', vocabText: 'la manzana: apple\n\n  el pan: bread  \n', conjugations: [{ verb: 'comer' }] });
  eq(deck, { name: 'Spanish 1 — food', words: 'la manzana: apple\nel pan: bread' }, 'the vocabulary travels as 040\'s "term: definition" lines, blank lines dropped');
  ok(JSON.stringify(deck).indexOf('comer') === -1, 'and the conjugation verbs do not travel');

  /* The decided exception: no entry writes 037's grades. */
  eq(H.all.filter(h => h.to === 'grade-distribution-visualizer').length, 0,
    '003 -> 037 is NOT a link: it carries student names beside their scores, which are not written to be published');
}

/* ── 3c. the roster chain (2026-09-24) ──────────────────────────────────── */
console.log('\nhandoffs — groups to lab roles, lab groups to a seating chart');
{
  const win = make();
  const H = win.Handoffs;
  const one = (from, to) => H.all.filter(h => h.from === from && h.to === to);

  /* 006/007 -> 002 is decided NOT to be a link: 002 reads the same saved
     class lists through roster.js on the same device. */
  eq(H.all.filter(h => h.to === 'group-team-generator').length, 0,
    '006/007 -> 002 is NOT a link: the roster already reaches 002 through roster.js, with no URL');

  /* 002 -> 022: exactly 002's own share payload, cleaned. */
  const lab = one('group-team-generator', 'lab-group-role-randomizer');
  eq(lab.length, 1, '002 -> 022 is declared once');
  ok(lab[0].sheet !== false, 'and it is a row in 002\'s sheet');
  const lg = lab[0].transform({ v: 1, title: 'Period 3', groups: [
    { label: 'Red', members: ['Ada', '  ', 'Bram'] }, { label: 'Blue', members: [] }, { label: 'Green', members: ['Cleo'] }],
    roster: 'must not travel', pairHistory: {} });
  eq(lg, { v: 1, name: 'Period 3', groups: [{ label: 'Red', members: ['Ada', 'Bram'] }, { label: 'Green', members: ['Cleo'] }] },
    'labels and names travel; a blank name and an empty group do not, and nothing outside the groups does');
  eq(lab[0].transform({}).name, 'Groups from the Group Generator', 'an untitled grouping still gives the class a name');
  ok(H.url(lab[0], lg).url.indexOf('/Tools/022-lab-group-role-randomizer.html?labgroups=') !== -1,
    '022\'s page and ?labgroups= come off the registry');

  /* 022 -> 005: a whole section, one pod per group, everyone seated. */
  const seat = one('lab-group-role-randomizer', 'seating-chart');
  eq(seat.length, 1, '022 -> 005 is declared once');
  eq(seat[0].sheet, false, 'with no sheet row: 022 sends from its own button');
  const groups = [['Ada', 'Bram', 'Cleo', 'Dov'], ['Esme', 'Fitz', 'Gus', 'Hana', 'Ivo'], ['Juno']];
  const sec = seat[0].transform({ name: 'Period 3', groups, roles: ['Recorder'], history: { Ada: ['Recorder'] } });
  eq(sec.name, 'Period 3 — lab groups', 'the section is named after the lab class');
  eq(sec.students.map(x => x.name), groups.flat(), 'every student, in group order');
  eq(new Set(sec.students.map(x => x.id)).size, sec.students.length, 'with distinct ids');
  eq(Object.keys(sec.assign).length, sec.students.length, 'and every one seated');
  eq(new Set(Object.values(sec.assign)).size, sec.students.length, 'at a desk of their own');
  const at = Object.fromEntries(Object.entries(sec.assign).map(([d, s]) => [sec.students.find(x => x.id === s).name, sec.desks.find(k => k.id === d)]));
  const dist = (a, b) => Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y);
  ok(dist('Ada', 'Dov') < 142 * 1.2 && dist('Ada', 'Bram') < 142, 'a group of four is a 2×2 pod, within 005\'s neighbour distance');
  ok(dist('Esme', 'Ivo') < 3 * 80 + 1, 'a group of five is a pod three rows deep');
  ok(dist('Dov', 'Esme') > 106 + 40, 'and pods do not touch');
  ok(sec.desks.every(d => d.x >= 0 && d.x <= 1280 - 106 && d.y >= 0 && d.y <= 900 - 70), 'every desk is inside 005\'s room');
  ok(!/Recorder/.test(JSON.stringify(sec)), 'no role and no role history travels');
  eq(sec.history, [], '(005\'s own seating history starts empty)');
  eq(sec.apart, [], 'and no keep-apart pair');
  const many = seat[0].transform({ name: 'Big', groups: Array.from({ length: 14 }, (_, i) => ['a' + i, 'b' + i, 'c' + i, 'd' + i]) });
  ok(many.desks.every(d => d.x <= 1280 - 106 && d.y <= 900 - 70), 'fourteen groups of four still fit the room');
  eq(seat[0].transform({ groups: [['  '], []] }).students, [], 'a blank group seats nobody');
  ok(H.url(seat[0], { name: 'x', groups }).url.indexOf('/Tools/005-Seating%20Chart%20Generator.html?section=') !== -1,
    '005\'s page and ?section= come off the registry');
}

/* ── 4. refusals ────────────────────────────────────────────────────────── */
console.log('\nhandoffs — refusals');
{
  const win = make();
  const H = win.Handoffs;
  const bad = { from: 'x', to: 'hall-pass-log', transform: s => s };
  let msg = null;
  try { H.url(bad, {}); } catch (e) { msg = e.message; }
  ok(msg && /cannot receive/.test(msg), 'a receiver with no share.param is refused with the reason: ' + JSON.stringify(msg));
  const r = H.open(bad, {});
  eq(r.ok, false, 'open() turns that into a result rather than throwing');
  ok(/cannot receive/.test(r.message), 'carrying the same sentence');
  eq(win.__opened, [], 'and no tab was opened');
  msg = null;
  try { H.url({ from: 'x', to: 'no-such-slug' }, {}); } catch (e) { msg = e.message; }
  ok(msg && /no tool with slug/.test(msg), 'an unknown receiver is refused by name');

  const bare = make({ noRegistry: true });
  msg = null;
  try { bare.Handoffs.url(bare.Handoffs.all[0], {}); } catch (e) { msg = e.message; }
  ok(msg && /tool-registry\.js/.test(msg), 'without the registry the module says which file is missing');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
