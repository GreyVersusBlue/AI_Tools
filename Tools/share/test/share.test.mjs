// share.test.mjs — _shared/share.js: the image policy, the link, the file.
// Plain Node, no browser.
//
//   node Tools/share/test/share.test.mjs
//
// share.js is a classic browser script, evaluated in a `vm` context with the
// REAL _shared/state-link.js (the link) and _shared/qr-draw.js + the vendored
// encoder (the QR budget), in the order a page loads them. The sheet itself
// — rows, focus, the clipboard fallback, the greyed QR row — is DOM
// behaviour and is driven in a real page by the adopter's suite,
// Tools/historical-trading-card-maker/test/smoke-share.mjs.
//
// The assertion this file exists for is in section 1: a data: image never
// reaches a link. Four tools each hand-strip images before building theirs;
// the day one forgets, a teacher gets a 200 KB URL that nothing accepts.
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
const ENCODER = read('_shared/vendor/qrcode/qrcode.js');
const STATE_LINK = read('_shared/state-link.js');
const QRDRAW = read('_shared/qr-draw.js');
const SHARE = read('_shared/share.js');

function make({ noStateLink = false } = {}) {
  const els = [];
  const win = {
    location: { href: 'https://aspermylessonplan.com/Tools/064-historical-trading-card-maker.html#x', search: '' },
    navigator: {},
    devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 900,
    document: {
      getElementById() { return null; },
      createElement(tag) { const e = { tag, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {}, click() {}, focus() {} }; els.push(e); return e; },
      head: { appendChild() {} },
      body: { appendChild() {} },
      addEventListener() {}, removeEventListener() {},
    },
    URL, URLSearchParams, TextEncoder, Blob, JSON, Object, Array, String, Number, Math, Date, Error, Promise, RegExp,
    btoa: s => Buffer.from(s, 'latin1').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('latin1'),
    unescape, escape, encodeURIComponent, decodeURIComponent, setTimeout,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(ENCODER + '\n;this.qrcode = qrcode;', ctx, { filename: 'qrcode.js' });
  if (!noStateLink) vm.runInContext(STATE_LINK, ctx, { filename: '_shared/state-link.js' });
  vm.runInContext(QRDRAW, ctx, { filename: '_shared/qr-draw.js' });
  vm.runInContext(SHARE, ctx, { filename: '_shared/share.js' });
  return { Share: win.Share, StateLink: win.StateLink, win, els };
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('share.js — images never ride in a link, and the file carries everything');

/* ── 1. stripImages: the policy ───────────────────────────────────────── */
{
  const { Share } = make();
  const state = {
    v: 1, name: 'Deck', settings: { theme: 'parchment' },
    cards: [
      { id: 'a', name: 'Harriet Tubman', image: PNG, stats: [{ label: 'Born', value: '1822' }] },
      { id: 'b', name: 'No photo', image: null, stats: [] },
      { id: 'c', name: 'Blob', image: 'blob:https://aspermylessonplan.com/1234-5678' },
    ],
    nested: { deep: [[PNG, 'keep me']] },
    notAnImage: 'data:text/plain;base64,aGk=',
    dataInText: 'this string mentions data:image/png but is prose',
  };
  const before = JSON.stringify(state);
  const s = Share.stripImages(state);
  eq(s.stripped, 3, '1: two data:image/ strings and one blob: URL are stripped');
  eq(s.value.cards[0].image, null, '1: the photo becomes null, not an empty string');
  eq(s.value.cards[2].image, null, '1: so does a blob: URL');
  eq(s.value.nested.deep[0], [null, 'keep me'], '1: nested arrays are walked; other strings survive');
  eq(s.value.notAnImage, state.notAnImage, '1: a data: URL that is not an image is not an image');
  eq(s.value.dataInText, state.dataInText, '1: prose that mentions data:image/ is prose');
  eq(s.value.cards[0].stats, state.cards[0].stats, '1: everything else is intact');
  eq(JSON.stringify(state), before, '1: the input is never mutated');
  eq(Share.stripImages(null), { value: null, stripped: 0 }, '1: null passes through');
  eq(Share.stripImages([1, 'x', true]).value, [1, 'x', true], '1: primitives pass through');
}

/* ── 2. buildLink: the URL, and what it says it dropped ───────────────── */
{
  const { Share, StateLink } = make();
  const state = { v: 1, cards: [{ name: 'A', image: PNG }, { name: 'B', image: PNG }] };
  const link = Share.buildLink({ getState: () => state, param: 'deck' });
  ok(link.url.startsWith('https://aspermylessonplan.com/Tools/064-historical-trading-card-maker.html?deck='),
    '2: the link is this page plus the param: ' + link.url.slice(0, 90));
  ok(!link.url.includes('#'), '2: with the hash dropped');
  eq(link.stripped, 2, '2: it counts what it stripped');
  const back = StateLink.decodeState(new URL(link.url).searchParams.get('deck'));
  eq(back, { v: 1, cards: [{ name: 'A', image: null }, { name: 'B', image: null }] }, '2: the payload decodes with the images gone');
  ok(link.url.length < 300 && !link.url.includes('base64'), '2: so the link is short (' + link.url.length + ' chars)');
  eq(link.bytes, Buffer.byteLength(link.url), '2: bytes is the URL length in UTF-8');
  eq(link.state, state, '2: the untouched state rides along for the download');

  const kept = Share.buildLink({ getState: () => state, param: 'deck', stripImages: false });
  eq(kept.stripped, 0, '2: stripImages:false keeps them (a tool that has measured its own case)');
  ok(kept.url.length > 300, '2: and the link is long');

  eq(Share.buildLink({ getState: () => null }), null, '2: nothing to share is null, not a link to nothing');
  eq(Share.buildLink({ getState: () => undefined }), null, '2: undefined too');
  const based = Share.buildLink({ getState: () => ({ a: 1 }), param: 'timeline', base: 'https://aspermylessonplan.com/Tools/015-timeline-builder.html' });
  ok(based.url.startsWith('https://aspermylessonplan.com/Tools/015-timeline-builder.html?timeline='), '2: base sends the link to another tool');
  const dflt = Share.buildLink({ getState: () => ({ a: 1 }) });
  ok(dflt.url.includes('?state='), '2: the param defaults to state, like state-link.js');
}

/* ── 3. the file: full state, and it says whose it is ─────────────────── */
{
  const { Share } = make();
  const state = { v: 1, cards: [{ name: 'A', image: PNG }] };
  const text = Share.fileContents({ tool: 'historical-trading-card-maker', param: 'deck' }, state);
  const parsed = JSON.parse(text);
  eq(parsed.state, state, '3: the file carries the state untouched, image included');
  eq(parsed.aplp.tool, 'historical-trading-card-maker', '3: and names the tool');
  eq(parsed.aplp.param, 'deck', '3: and the param the tool reads');
  eq(parsed.aplp.v, 1, '3: versioned');
  ok(/^\d{4}-\d\d-\d\dT/.test(parsed.aplp.exported), '3: with an ISO timestamp');
  ok(text.includes('\n  '), '3: pretty-printed, so a teacher can read it');

  eq(Share.filename('My Deck: Period 3!'), 'My Deck Period 3.json', '3: the filename is sanitised and gets .json');
  eq(Share.filename('', '.civics.json'), 'shared.civics.json', '3: an empty name falls back; the extension is the caller\'s');
  eq(Share.filename('  a   b  '), 'a b.json', '3: whitespace collapses');
}

/* ── 4. the missing-dependency mistake is loud, at mount ──────────────── */
{
  const { Share } = make({ noStateLink: true });
  let msg = '';
  try { Share.mount({ addEventListener() {} }, { getState: () => ({}) }); } catch (e) { msg = e.message; }
  ok(/state-link\.js loaded first/.test(msg), '4: a page that loads share.js without state-link.js is told at mount, not at the first click');
}

/* ── 5. open() with nothing to share does not open a sheet ────────────── */
{
  const { Share, els } = make();
  const messages = [];
  const before = els.length;
  const h = Share.open({ getState: () => null, onMessage: m => messages.push(m) });
  eq(h.root, null, '5: no sheet');
  eq(h.link, null, '5: no link');
  eq(els.length, before, '5: nothing was built');
  eq(messages, ['There is nothing to share yet.'], '5: and the page is told why');
  const h2 = Share.open({ getState: () => null, emptyMessage: 'Add a card first.', onMessage: m => messages.push(m) });
  eq(h2.root, null, '5: emptyMessage overrides the wording');
  eq(messages[1], 'Add a card first.', '5: verbatim');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
