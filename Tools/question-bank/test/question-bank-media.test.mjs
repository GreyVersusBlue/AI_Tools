// question-bank-media.test.mjs — pure-logic tests for the picture a question
// may carry (Path 12 P4): _shared/question-bank.js's imageOf(), withImage(),
// imageProblem(), cleanMedia(), applyImages() and leftSentence(), and that
// the rest of the module (normalize, upsert, merge, the JSON file, a link)
// treats `media` as it always did.
//
//   node Tools/question-bank/test/question-bank-media.test.mjs   (or: npm run test:question-bank-media)
//
// The module runs in a vm context with a fake localStorage, as
// question-bank.test.mjs runs it. Every question is made up; the pictures are
// 1x1 PNGs. The browser half is 030's smoke-bank-media.mjs. Exits 1 on any
// failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const src = f => fs.readFileSync(path.join(site, f), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (a, b, label) => ok(JSON.stringify(plain(a)) === JSON.stringify(plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function makeWindow() {
  const data = new Map();
  const win = {
    localStorage: {
      getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: k => { data.delete(k); }, key: i => Array.from(data.keys())[i] ?? null, get length() { return data.size; },
    },
    addEventListener() {}, removeEventListener() {},
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(src('_shared/store.js'), win);
  vm.runInContext(src('_shared/question-bank.js'), win);
  return { win, data };
}
const { win } = makeWindow();
const QB = win.QuestionBank;

const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';
const REF = 'idb:h0123456789abcdef0123456789abcdef';
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"></svg>').toString('base64');
const SVG_TEXT = 'data:image/svg+xml,<svg onload=alert(1)>';
const HTML = 'data:text/html;base64,' + Buffer.from('<script>window.__pwned=1</script>').toString('base64');
const BREAKOUT = 'data:image/png;base64,AAAA" onerror="window.__pwned=1';

console.log('question bank — the picture a question may carry');

/* ── what counts as a picture ───────────────────────────────────────────── */
eq(QB.MEDIA_NS, 'rgb', 'the bank\'s pictures are in 030\'s namespace of the media store');
for (const [v, want, why] of [
  [RED, true, 'a PNG data URL'], ['data:image/jpeg;base64,/9j/4AAQ', true, 'a JPEG'], ['data:image/gif;base64,R0lGODlh', true, 'a GIF'],
  ['data:image/webp;base64,UklGRg==', true, 'a WebP'],
  [SVG, false, 'an SVG with an onload'], [SVG_TEXT, false, 'an SVG written as text'], [HTML, false, 'a data:text/html URL'],
  [BREAKOUT, false, 'a value that breaks out of an attribute'], ['data:image/png,notbase64', false, 'a PNG that is not base64'],
  ['data:image/png;base64,', false, 'a PNG with no data'], ['DATA:IMAGE/PNG;base64,AAAA', false, 'another letter case'],
  ['data:image/png;charset=x;base64,AAAA', false, 'a parameter before base64'], ['https://example.invalid/a.png', false, 'a web address'],
  ['javascript:alert(1)', false, 'a javascript: URL'], ['', false, 'nothing'], [null, false, 'null'], [12, false, 'a number'],
  [' ' + RED, false, 'a leading space'], [RED + '\n<svg>', false, 'a second line'],
]) eq(QB.isInlineImage(v), want, `isInlineImage: ${why}`);
for (const [v, want, why] of [
  [REF, true, 'a content-hash reference'], ['idb:rAbc_-9', true, 'a random-id reference'], ['idb:', false, 'no id'],
  ['idb:a/b', false, 'a slash'], ['idb:' + 'a'.repeat(41), false, 'an id of 41'], ['IDB:abc', false, 'another case'], [RED, false, 'a data URL'],
]) eq(QB.isImageRef(v), want, `isImageRef: ${why}`);

/* ── imageOf: the only reader ───────────────────────────────────────────── */
eq(QB.imageOf({ media: { image: REF } }), REF, 'imageOf gives a stored picture\'s reference');
eq(QB.imageOf({ media: { image: RED, alt: 'A map' } }), RED, 'and a data URL of an allowed type');
for (const [q, why] of [
  [{}, 'no media'], [{ media: null }, 'null'], [{ media: RED }, 'a media that is itself a string'], [{ media: [RED] }, 'a list'],
  [{ media: { kind: 'image', ref: 'idb:rgb/made-up' } }, 'a media of the shape no page read'], [{ media: { image: SVG } }, 'an SVG'],
  [{ media: { image: SVG_TEXT } }, 'an SVG as text'], [{ media: { image: HTML } }, 'a data:text/html URL'], [{ media: { image: BREAKOUT } }, 'a break-out'],
  [{ media: { image: 'https://example.invalid/a.png' } }, 'a web address'], [{ media: { image: { src: RED } } }, 'an object'],
  [{ media: { src: RED } }, 'a picture under another name'], [null, 'no question'], ['x', 'a string'],
]) eq(QB.imageOf(q), '', `imageOf gives nothing for ${why}`);
{
  const inherited = Object.create({ image: RED });
  eq(QB.imageOf({ media: inherited }), '', 'nor for an `image` the media only inherits');
}

/* ── withImage ──────────────────────────────────────────────────────────── */
{
  const q = { id: 'q1', prompt: 'p', answer: 'a', hint: 'h' };
  const a = QB.withImage(q, REF);
  eq(a, { id: 'q1', prompt: 'p', answer: 'a', hint: 'h', media: { image: REF } }, 'withImage puts the picture on a copy');
  eq(q, { id: 'q1', prompt: 'p', answer: 'a', hint: 'h' }, 'and leaves the question it was given alone');
  eq(QB.withImage(a, ''), q, 'no value takes the picture, and the empty media, off');
  eq(QB.withImage({ prompt: 'p', media: { image: REF, alt: 'A map' } }, ''), { prompt: 'p', media: { alt: 'A map' } }, 'what else media holds is kept');
  eq(QB.withImage({ prompt: 'p', media: { image: REF, alt: 'A map' } }, RED), { prompt: 'p', media: { alt: 'A map', image: RED } }, 'and kept when the picture is changed');
  eq(QB.withImage({ prompt: 'p', media: { image: REF } }, SVG), { prompt: 'p' }, 'an SVG is not put on: the picture comes off');
  eq(QB.withImage({ prompt: 'p' }, HTML), { prompt: 'p' }, 'a data:text/html URL is not put on');
  eq(QB.withImage({ prompt: 'p', media: 'old text' }, ''), { prompt: 'p', media: 'old text' }, 'a media of another shape is left as it is when there is no picture');
  eq(QB.withImage({ prompt: 'p', media: 'old text' }, REF), { prompt: 'p', media: { image: REF } }, 'and replaced when there is one');
  const same = QB.withImage(a, REF);
  eq(JSON.stringify(same), JSON.stringify(a), 'the same picture again is the same question, key for key');
}

/* ── imageProblem: a picture in a file ──────────────────────────────────── */
eq(QB.imageProblem(RED), '', 'a PNG data URL may come in a file');
eq(QB.imageProblem(REF), 'it names a picture kept in another browser', 'a reference may not: it names another browser\'s store');
eq(QB.imageProblem(SVG), 'it is not a PNG, JPEG, GIF or WebP picture', 'an SVG is refused by type');
eq(QB.imageProblem(HTML), 'it is not a PNG, JPEG, GIF or WebP picture', 'a data:text/html URL is refused by type');
eq(QB.imageProblem('https://example.invalid/a.png'), 'it is not a PNG, JPEG, GIF or WebP picture', 'a web address is refused: nothing is fetched');
eq(QB.imageProblem(BREAKOUT), 'its data is damaged', 'a PNG whose data is not base64 is damaged');
eq(QB.imageProblem('data:image/png;base64,'), 'its data is damaged', 'and so is one with no data');
eq(QB.imageProblem({}), 'it is not a picture', 'an object is not a picture');
eq(QB.imageProblem(''), 'it is not a picture', 'nor is nothing');
{
  const head = 'data:image/png;base64,';
  const atLimit = head + 'A'.repeat(QB.IMAGE_MAX - head.length);
  eq([atLimit.length, QB.imageProblem(atLimit)], [QB.IMAGE_MAX, ''], 'a picture of exactly IMAGE_MAX characters is taken');
  eq(QB.imageProblem(atLimit + 'A'), 'it is larger than 3 MB', 'one character more is too large, and the sentence says the size');
  eq(QB.imageProblem(head + 'A'.repeat(QB.IMAGE_MAX) + '"><script>'), 'it is larger than 3 MB', 'a huge damaged one is called too large, without the whole of it being tested');
  eq(QB.IMAGE_MAX, 4000000, 'the limit is four million characters');
}

/* ── cleanMedia: a file's questions ─────────────────────────────────────── */
{
  const file = [
    { id: 'a', prompt: 'A', answer: '1', media: { image: RED } },
    { id: 'b', prompt: 'B', answer: '2' },
    { id: 'c', prompt: 'C', answer: '3', media: { image: SVG, alt: 'x' } },
    { id: 'd', prompt: 'D', answer: '4', media: { image: REF } },
    { id: 'e', prompt: 'E', answer: '5', media: { kind: 'image', ref: 'idb:rgb/made-up' } },
    { id: 'f', prompt: 'F', answer: '6', media: { image: RED } },
    { id: 'g', prompt: 'G', answer: '7', media: { image: BLUE } },
    { id: 'h', prompt: 'H', answer: '8', media: { image: HTML } },
    { id: 'i', prompt: 'I', answer: '9', media: 'text' },
  ];
  const before = JSON.stringify(file);
  const res = QB.cleanMedia(file, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  eq(JSON.stringify(file), before, 'cleanMedia changes nothing it was given');
  eq(res.questions.length, file.length, 'every question comes through, in order');
  eq(res.questions.map(q => q.id), file.map(q => q.id), 'with its id');
  eq(res.images, [RED, BLUE], 'the pictures that stay are listed once each');
  eq(res.left, [{ row: 4, why: 'it is not a PNG, JPEG, GIF or WebP picture' }, { row: 5, why: 'it names a picture kept in another browser' }, { row: 9, why: 'it is not a PNG, JPEG, GIF or WebP picture' }],
    'the three left out are named by the file\'s own row and the reason');
  eq([res.questions[2], res.questions[3], res.questions[7]], [{ id: 'c', prompt: 'C', answer: '3' }, { id: 'd', prompt: 'D', answer: '4' }, { id: 'h', prompt: 'H', answer: '8' }],
    'a refused picture takes the whole `media` off that question, and nothing else');
  ok(res.questions[0] === file[0] && res.questions[4] === file[4] && res.questions[8] === file[8], 'a question with a good picture, a media of another shape or a media that is text is handed on as it is');
  eq(QB.cleanMedia(file).left.map(x => x.row), [3, 4, 8], 'with no row numbers the place in the list is used, counted from 1');
  eq(QB.cleanMedia(null), { questions: [], images: [], left: [] }, 'nothing in, nothing out');
  ok(res.questions.every(q => { const v = q.media && q.media.image; return v === undefined || QB.isInlineImage(v); }), 'no question leaves with a picture that is not one');

  // A question the bank has keeps its own picture when the file's is refused.
  const bank = [{ id: 'c', prompt: 'C', answer: '3', media: { image: REF }, unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: 't' }];
  const merged = QB.merge(bank, QB.cleanMedia([{ id: 'c', prompt: 'C changed', answer: '3', media: { image: SVG } }]).questions, { now: 'n' });
  eq([merged.updated, merged.questions[0].prompt, merged.questions[0].media], [1, 'C changed', { image: REF }], 'merged, its words change and the picture the bank had stays');
  const unclean = QB.merge(bank, [{ id: 'c', prompt: 'C', answer: '3', media: { image: SVG } }], { now: 'n' });
  eq(QB.imageOf(unclean.questions[0]), '', 'and even stored uncleaned, an SVG is never given out as a picture');
}

/* ── applyImages and the round trip of ids ──────────────────────────────── */
{
  const list = [{ id: 'a', prompt: 'A', answer: '1', media: { image: RED } }, { id: 'b', prompt: 'B', answer: '2' }, { id: 'c', prompt: 'C', answer: '3', media: { image: BLUE } }];
  const out = QB.applyImages(list, { [RED]: REF });
  eq(out.map(QB.imageOf), [REF, '', BLUE], 'applyImages swaps each data URL the map names for its reference');
  ok(out[1] === list[1] && out[2] === list[2] && out[0] !== list[0], 'and copies only the question it changed');
  eq(list[0].media.image, RED, 'the list it was given is unchanged');
  eq(QB.applyImages(list, { constructor: REF }).map(QB.imageOf), [RED, '', BLUE], 'a map with odd keys changes nothing');

  // The same file twice: the second time every question is the same.
  const T = { now: '2026-10-07T12:00:00.000Z', nowMs: 1, random: () => 0.5 };
  const first = QB.merge([], QB.applyImages(list, { [RED]: REF, [BLUE]: 'idb:hbbbb' }), T);
  const again = QB.merge(first.questions, QB.applyImages(list, { [RED]: REF, [BLUE]: 'idb:hbbbb' }), T);
  eq([first.added, again.added, again.updated, again.same], [3, 0, 0, 3], 'a file with pictures merged twice adds three, then changes nothing');
  eq(first.questions.map(QB.imageOf), [REF, '', 'idb:hbbbb'], 'and the bank holds references');
  // A spreadsheet row for a question with a picture leaves the picture alone.
  const sheet = QB.merge(first.questions, QB.fromRows(QB.toRows(first.questions)).questions, T);
  eq([sheet.same, sheet.questions.map(QB.imageOf)], [3, [REF, '', 'idb:hbbbb']], 'the spreadsheet, which has no picture column, changes no picture');
  ok(QB.toRows(first.questions).every(r => r.every(c => String(c).indexOf('idb:') === -1 && String(c).indexOf('data:') === -1)), 'and no picture or reference is written into a spreadsheet cell');
}

/* ── the rest of the module is as it was ────────────────────────────────── */
{
  const media = { kind: 'image', ref: 'idb:rgb/abc', alt: 'A map', nested: [1, { two: 2 }] };
  eq(QB.normalize({ prompt: 'p', answer: 'a', media }).media, media, 'normalize still carries a media of any shape as given');
  eq(QB.normalize({ prompt: 'p', answer: 'a', media: { image: SVG } }).media, { image: SVG }, 'an SVG included: it is carried, and imageOf() is what never gives it out');
  eq(QB.normalize({ prompt: 'p', answer: 'a', media: null }).media, undefined, 'a null media is no media, which is how a save takes a picture off');
  const up = QB.upsert([{ id: 'x', prompt: 'p', answer: 'a', media: { image: REF }, unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: 't' }], { id: 'x', media: null }, { now: 'n' });
  eq('media' in up.question, false, 'upsert with media: null takes it off');
  const keep = QB.upsert([{ id: 'x', prompt: 'p', answer: 'a', media: { image: REF }, unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: 't' }], { id: 'x', prompt: 'p2' }, { now: 'n' });
  eq(keep.question.media, { image: REF }, 'and an edit that does not name media keeps the picture');
  const link = QB.fromLink({ v: 1, from: 'cultural-trivia-card-generator', name: 'n', questions: [{ prompt: 'p', answer: 'a', media: { image: RED } }, { prompt: 'q', answer: 'b', media: { image: SVG } }] });
  eq(link.questions.map(q => 'media' in q), [false, false], 'a link still brings no media at all');
  const json = QB.toJSON([{ id: 'x', prompt: 'p', answer: 'a', media: { image: RED } }], { exported: 'X' });
  eq(QB.parse(json).questions[0].media, { image: RED }, 'the JSON file carries media.image as it is given it');
  const seed = QB.registerSet({ id: 'pics', title: 'Pics', questions: [{ id: '1', prompt: 'p', answer: 'a', media: { image: RED } }, { id: '2', prompt: 'q', answer: 'b', media: { image: SVG } }] });
  eq([seed.count, QB.setQuestions('pics').map(QB.imageOf)], [2, [RED, '']], 'a seed set\'s question may carry a picture, by the same rule');
}

/* ── leftSentence ───────────────────────────────────────────────────────── */
eq(QB.leftSentence([]), '', 'nothing left out, nothing said');
eq(QB.leftSentence(null), '', 'nor for no list');
eq(QB.leftSentence([{ row: 4, why: 'it is larger than 3 MB' }]), 'A picture was left out, and the question is here without it: row 4 (it is larger than 3 MB).', 'one is said in the singular');
eq(QB.leftSentence([{ row: 4, why: 'x' }, { row: 9, why: 'y' }]), '2 pictures were left out, and the questions are here without them: row 4 (x); row 9 (y).', 'two in the plural');
{
  const ten = Array.from({ length: 10 }, (_, i) => ({ row: i + 2, why: 'w' }));
  const s = QB.leftSentence(ten);
  ok(/^10 pictures were left out/.test(s) && /row 9 \(w\); and 2 more\.$/.test(s) && !/row 10 /.test(s), 'ten names the first eight and counts the rest');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
