// core.test.mjs — pure-logic tests for Tools/braille-trainer/bt-core.js.
//
//   node Tools/braille-trainer/test/core.test.mjs
//
// bt-core.js is a classic script that publishes window.BrailleCore, so it runs
// here in a vm context with a stand-in `window`. No browser. The translator
// cases are hand-checked Unified English Braille spellings, written in braille
// ASCII. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '..', 'bt-core.js'), 'utf8'), ctx);
const C = ctx.window.BrailleCore;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

console.log('Braille Reading Trainer — core logic');

// ── cells ────────────────────────────────────────────────────────────
eq(C.cells('A'), [1], 'a is dot 1');
eq(C.dotsOf(C.cells('=')[0]), '1-2-3-4-5-6', 'for is the full cell');
eq(C.dotsOf(C.cells('#')[0]), '3-4-5-6', 'number sign');
eq(C.dotsOf(C.cells('W')[0]), '2-4-5-6', 'w');
eq(C.unicode('HELLO'), '⠓⠑⠇⠇⠕', 'unicode rendering');
eq(C.mirror(C.cells('D')[0]), C.cells('F')[0], 'd mirrors to f');
eq(C.mirror(C.cells('E')[0]), C.cells('I')[0], 'e mirrors to i');
// The decade structure the alphabet unit teaches.
for (const [a, k] of [['a', 'k'], ['j', 't']]) eq(C.cells(k)[0], C.cells(a)[0] | 4, `${k} is ${a} plus dot 3`);
for (const [a, u] of [['a', 'u'], ['e', 'z']]) eq(C.cells(u)[0], C.cells(a)[0] | 36, `${u} is ${a} plus dots 3-6`);

// ── curriculum invariants ────────────────────────────────────────────
const ids = Object.keys(C.ITEMS);
eq(ids.length, 212, 'sign count');
ok(ids.every((id) => C.ITEMS[id].cells && C.cells(C.ITEMS[id].cells).length === C.ITEMS[id].cells.length), 'every sign is valid braille ASCII');
ok(C.UNITS.every((u) => u.items.length && C.STAGES.some((s) => s.id === u.stage)), 'every unit has signs and a stage');
eq(new Set(C.LESSONS.map((l) => l.id)).size, C.LESSONS.length, 'lesson ids unique');
ok(C.UNITS.every((u) => u.lessons[u.lessons.length - 1].kind === 'review'), 'every unit ends in a review');
const learnedOnce = C.LESSONS.filter((l) => l.kind === 'learn').flatMap((l) => l.items);
eq(learnedOnce.length, ids.length, 'every sign is taught exactly once');

// ── translator ───────────────────────────────────────────────────────
const t = (s, k) => C.translate(s, k === undefined ? null : k).ascii;
const UEB = {
  near: 'N1R', year: 'Y1R', there: '"!', other: 'O!R', brother: 'BRO!R', found: 'F.D', stand: '/&', off: '(F', egg: 'EGG',
  bread: 'BR1D', each: 'EA*', thing: '?+', nation: 'NA;N', sentence: 'S5T;E', kindness: 'K9D;S', full: 'FULL', careful: 'C>E;L',
  city: 'C;Y', into: '9TO', being: '2+', become: '2COME', discover: '4COV]', consider: '3SID]', bed: 'B$', the: '!', them: '!M',
  then: '!N', without: ')\\T', enough: '5', children: '*N', days: '"DS', braille: 'BRL', strong: '/R;G', question: '"Q',
  rabbit: 'RA2IT', effect: 'E6ECT', long: 'L;G', moment: 'MO;T', house: 'H\\SE', know: '"K', whose: '^:', their: '_!',
  could: 'CD', must: 'M/', good: 'GD', it: 'X', you: 'Y', as: 'Z', but: 'B', was: '0', his: '8', were: '7', in: '9'
};
for (const [w, want] of Object.entries(UEB)) eq(t(w), want, `"${w}"`);
// Capitals, numbers, punctuation.
eq(t('The'), ',!', 'capitalised contraction');
eq(t('BIG'), ',,BIG', 'capitalised word');
eq(t('12'), '#AB', 'number');
eq(t('1,809'), '#A1HJI', 'number with a comma');
eq(t('Hi.'), ',HI4', 'period');
eq(t('"Hi"'), '8,HI0', 'quotation marks');
eq(t('Why?'), ',:Y8', 'question mark');
eq(t('x-ray'), ';X-RAY', 'a lone letter that is a word sign gets the grade 1 indicator');
// Lower word signs need nothing touching them.
eq(t('was.'), 'WAS4', '"was" touching a period is spelled');
eq(t('in.'), 'IN4', '"in" touching a period is spelled');
eq(t('enough.'), '5\\<4', '"enough" touching a period uses group signs');
// Positional rules.
eq(t('ingot'), '9GOT', 'ing never starts a word, so it is in-g-o-t');
ok(!t('ear').startsWith('1'), 'ea never starts a word');
ok(!t('bee').includes('1'), 'ea is not found where it is not');
eq(t('bed'), 'B$', 'ed anywhere');
eq(t('beach'), 'B1*', 'be- is not contracted where it is not a syllable');
// Only what is known.
const letters = new Set('abcdefghijklmnopqrstuvwxyz'.split('').map((c) => 'l-' + c));
eq(t('the house', letters), '!E HOUSE'.replace('!E', 'THE'), 'nothing contracted with letters only');
const withThe = new Set([...letters, 'sc-the']);
eq(t('the other', withThe), '! O!R', 'only the learned contraction is used');
ok(C.translate('the', withThe).used.has('sc-the'), 'translate reports the signs it used');
// Every passage translates to braille ASCII only.
for (const p of C.PASSAGES) ok(/^[ A-Z0-9#!"$%&'()*+,\-./:;<=>?@[\\\]^_\n]*$/.test(t(p.text)), `passage ${p.id} is clean braille ASCII`);

// ── lessons ──────────────────────────────────────────────────────────
for (const l of C.LESSONS) {
  const ex = C.buildLesson(l.id, { rng, items: {} });
  ok(ex.length >= 8, `${l.id} has at least 8 exercises (${ex.length})`);
  const known = C.knownThrough(l.id);
  for (const e of ex) {
    if (e.options) {
      if (!e.options.includes(e.answer)) { ok(false, `${l.id} ${e.type} options include the answer`); break; }
      if (new Set(e.options).size !== e.options.length) { ok(false, `${l.id} ${e.type} options are distinct`); break; }
      if (e.type === 'pickMeaning' && e.options.some((o) => o !== e.answer && Object.values(C.ITEMS).some((it) => it.label === o && it.cells === e.cells))) {
        ok(false, `${l.id} a distractor means the same cells`); break;
      }
    }
    if (e.type === 'readWord' || e.type === 'readSentence') {
      if (e.ascii !== C.translate(e.text, known).ascii) { ok(false, `${l.id} reading uses only known signs`); break; }
      if (!e.text.toLowerCase().split('').every((c) => !/[a-z]/.test(c) || known.has('l-' + c))) { ok(false, `${l.id} reading uses only learned letters: ${e.text}`); break; }
    }
  }
  if (l.kind === 'learn') ok(ex.filter((e) => e.type === 'learn').length === l.items.length, `${l.id} introduces each new sign`);
}
// Mirror images are preferred distractors.
let mirrored = 0;
for (let i = 0; i < 40; i++) if (C.distractors('l-d', new Set(['l-a', 'l-b', 'l-c', 'l-d', 'l-e', 'l-f', 'l-g', 'l-h', 'l-i', 'l-j']), rng, 3).includes('l-f')) mirrored++;
eq(mirrored, 40, 'd always offers its mirror f');
ok(C.readingMatches('Hello', 'hello', letters), 'reading answers ignore case');
ok(C.readingMatches('  cab ', 'cab', letters), 'reading answers ignore spaces');
ok(!C.readingMatches('cad', 'cab', letters), 'a wrong word is wrong');

// ── spaced repetition, XP, streak ────────────────────────────────────
let r = C.grade(null, true, 1500, 100);
eq([r.b, r.due], [1, 101], 'a fast right answer moves up a box');
r = C.grade(r, true, 9000, 101);
eq([r.b, r.due], [1, 102], 'a slow right answer stays in its box');
r = C.grade({ b: 5, due: 0, n: 5, ok: 5, ms: 1000 }, false, 1000, 200);
eq([r.b, r.due], [3, 200], 'a miss drops two boxes and is due now');
eq(C.dueItems(new Set(['l-a', 'l-b']), { 'l-a': { due: 5 }, 'l-b': { due: 50 } }, 10), ['l-a'], 'due items');
const s = C.normalizeState(null);
C.addXp(s, 15, 300); eq([s.today.xp, s.streak.days], [15, 0], 'below the goal, no streak yet');
C.addXp(s, 10, 300); eq([s.streak.days, s.streak.last], [1, 300], 'reaching the goal starts a streak');
C.addXp(s, 30, 300); eq(s.streak.days, 1, 'one day counts once');
C.addXp(s, 30, 301); eq(s.streak.days, 2, 'the next day extends it');
C.addXp(s, 30, 305); eq(s.streak.days, 1, 'a gap restarts it');
eq(C.currentStreak(s, 307), 0, 'a streak not kept up shows zero');
eq(s.xp, 115, 'total XP');

// ── normalizeState ───────────────────────────────────────────────────
const n = C.normalizeState({ xp: -5, goal: 7, done: { 'u1-1': true, bogus: true }, items: { 'l-a': { b: 99, due: 'x' }, nope: {} }, reading: { p1: { best: 12.5, times: 2 }, zz: {} }, settings: { ghost: 'weird', size: 9 } });
eq(n.xp, 0, 'negative XP clamped');
eq(n.goal, 20, 'unknown goal falls back');
eq(Object.keys(n.done), ['u1-1'], 'unknown lessons dropped');
eq(n.items['l-a'].b, C.INTERVALS.length - 1, 'box clamped');
ok(!('nope' in n.items), 'unknown signs dropped');
eq(Object.keys(n.reading), ['p1'], 'unknown passages dropped');
eq([n.settings.ghost, n.settings.size], ['auto', 5], 'settings cleaned');
ok(C.normalizeState('garbage').v === 1, 'garbage gives a fresh state');
ok(!C.readingOpen({}), 'reading room starts closed');
const allTo8 = {}; for (const l of C.LESSONS) { allTo8[l.id] = true; if (l.id === 'u8-r') break; }
ok(C.readingOpen(allTo8), 'reading room opens after punctuation');
eq(C.wpm('one two three four', 30000), 8, 'words per minute');

console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
