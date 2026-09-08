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
  ok(Array.isArray(H.all) && H.all.length >= 1, 'at least one handoff is declared');
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
