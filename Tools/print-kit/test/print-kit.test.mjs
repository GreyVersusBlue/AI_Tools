// print-kit.test.mjs — pure-logic tests for _shared/print-kit.js (Path 7 P1),
// plus the static rules print-kit.css must keep.
//
//   node Tools/print-kit/test/print-kit.test.mjs
//
// print-kit.js is a classic script that publishes window.PrintKit, so it runs
// here in a vm context with no document: plan(), chunk(), inkClass() and
// pageCss() are pure, and setPage()/setHeader() must not throw without a DOM.
// The browser half is smoke-print-kit.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(here, '..', '..', '..', '_shared');
const src = fs.readFileSync(path.join(shared, 'print-kit.js'), 'utf8');
const css = fs.readFileSync(path.join(shared, 'print-kit.css'), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const PK = ctx.window.PrintKit;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('PrintKit — shared print kit logic');

// ---- plan: one / class set / blanks ---------------------------------------
const roster = ['Ada', '  ', 'Grace', { name: 'Katherine Johnson', preferred: 'Kat' }, { name: 'Alan' }, null];
eq(PK.plan({ mode: 'set', roster }).map(s => s.name), ['Ada', 'Grace', 'Kat', 'Alan'],
   'a class set is one sheet per student, blank entries dropped, preferred name first');
eq(PK.plan({ mode: 'set', roster }).map(s => [s.n, s.of]), [[1, 4], [2, 4], [3, 4], [4, 4]], 'sheets are numbered N of M');
eq(PK.plan({ mode: 'set', roster: [] }), [], 'a class set of an empty roster is no sheets');
eq(PK.plan({ mode: 'set' }), [], 'a class set with no roster is no sheets');
eq(PK.plan({ mode: 'one', name: ' Ada ' }), [{ name: 'Ada', blank: false, n: 1, of: 1 }], 'one sheet for a name');
eq(PK.plan({ roster }), [{ name: 'Ada', blank: false, n: 1, of: 1 }], 'the default mode is one, and takes the first student');
eq(PK.plan({}), [{ name: '', blank: true, n: 1, of: 1 }], 'one sheet with no name is a blank');
eq(PK.plan(), [{ name: '', blank: true, n: 1, of: 1 }], 'plan() with nothing at all');
eq(PK.plan({ mode: 'blank', count: 3 }).map(s => [s.name, s.blank, s.n, s.of]),
   [['', true, 1, 3], ['', true, 2, 3], ['', true, 3, 3]], 'blanks by count');
eq(PK.plan({ mode: 'blank', roster }).length, 4, 'blanks default to one per student');
eq(PK.plan({ mode: 'blank' }).length, 1, 'blanks with no roster and no count is one');
eq(PK.plan({ mode: 'blank', count: -2 }).length, 1, 'a bad count falls back');
eq(PK.plan({ mode: 'blank', count: '7' }).length, 7, 'a count typed into an input is a string');
eq(PK.plan({ mode: 'blank', count: 99999 }).length, 400, 'blanks are capped');
eq(PK.plan({ mode: 'set', roster: Array.from({ length: 900 }, (_, i) => 'S' + i) }).length, 400, 'a set is capped');
eq(PK.plan({ mode: 'nonsense', name: 'Ada' }).length, 1, 'an unknown mode is one');

// ---- chunk ------------------------------------------------------------------
eq(PK.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], 'chunk by a number');
eq(PK.chunk(Array.from({ length: 11 }, (_, i) => i), '2x5').map(p => p.length), [10, 1], 'chunk by a preset name');
eq(PK.chunk([], '3x3'), [], 'chunk of nothing');
eq(PK.chunk([1, 2], 0), [[1], [2]], 'a bad page size never loops forever');

// ---- presets agree with the stylesheet ---------------------------------------
for (const [name, p] of Object.entries(PK.PRESETS)) {
  eq(p.perPage, p.cols * p.rows, `preset ${name}: perPage is cols x rows`);
  const m = css.match(new RegExp('\\.' + p.cls + '\\s*\\{\\s*--pk-cols:\\s*(\\d+);\\s*--pk-rows:\\s*(\\d+);'));
  ok(m && +m[1] === p.cols && +m[2] === p.rows, `preset ${name}: print-kit.css has .${p.cls} with the same cols and rows`);
}
const cssPresets = [...css.matchAll(/\.(pk-cards-\d+x\d+)\s*\{\s*--pk-cols/g)].map(m => m[1]).sort();
eq(cssPresets, Object.values(PK.PRESETS).map(p => p.cls).sort(), 'no preset exists in only one of the two files');

// ---- inkClass ----------------------------------------------------------------
const ink = Array.from({ length: 24 }, (_, i) => PK.inkClass(i));
eq(new Set(ink).size, 24, '24 categories get 24 distinct encodings');
eq(PK.inkClass(0), 'pk-hatch-1 pk-ink-solid', 'the first category');
eq(PK.inkClass(6), 'pk-hatch-1 pk-ink-dashed', 'the border style changes when the hatches wrap');
eq(PK.inkClass(-3), PK.inkClass(0), 'a bad index is the first category');
eq(PK.inkClass('x'), PK.inkClass(0), 'a non-number is the first category');
for (const cls of new Set(ink.join(' ').split(' '))) ok(css.includes('.' + cls + ' ') || css.includes('.' + cls + ','), `print-kit.css defines .${cls}`);

// ---- pageCss / setPage ---------------------------------------------------------
eq(PK.pageCss(), { paper: 'letter', orientation: 'portrait', w: '8.5in', h: '11in', margin: '0.5in',
                   css: '@page { size: letter portrait; margin: 0.5in; }' }, 'the default page is Letter portrait');
eq(PK.pageCss({ paper: 'A4', orientation: 'Landscape', margin: '10mm' }),
   { paper: 'a4', orientation: 'landscape', w: '297mm', h: '210mm', margin: '10mm',
     css: '@page { size: A4 landscape; margin: 10mm; }' }, 'A4 landscape swaps width and height');
eq(PK.pageCss({ margin: 0.25 }).margin, '0.25in', 'a numeric margin is inches');
eq(PK.pageCss({ margin: 0 }).margin, '0in', 'a zero margin is allowed');
eq(PK.pageCss({ margin: '1in; } body { display: none' }).margin, '0.5in', 'a margin that is not a length never reaches the stylesheet');
eq(PK.pageCss({ paper: 'tabloid' }).paper, 'letter', 'an unknown paper is Letter');
eq(PK.setPage({ paper: 'legal' }).h, '14in', 'setPage without a document still resolves the page');

// ---- header --------------------------------------------------------------------
eq(PK.setHeader({ class: ' Period 3 ', title: 'Exit ticket' }), { class: 'Period 3', date: '', title: 'Exit ticket' }, 'setHeader trims and stores');
eq(PK.setHeader({ date: '2026-10-03' }), { class: 'Period 3', date: '2026-10-03', title: 'Exit ticket' }, 'a field left out keeps its value');
eq(PK.setHeader({ class: '' }).class, '', 'an empty string clears a field');
eq(PK.setHeader().title, 'Exit ticket', 'setHeader() with nothing changes nothing');

// ---- the stylesheet's own rules ---------------------------------------------------
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/overflow(-[xy])?\s*:\s*(hidden|clip)/.test(bare), 'print-kit.css never clips: no overflow hidden or clip');
ok(!/(^|[;{\s])(max-)?height\s*:/.test(bare), 'print-kit.css sizes with min-height only: no height or max-height');
ok(!/@page\b/.test(bare), 'print-kit.css sets no @page rule (setPage() owns it)');
ok(!/(^|[},])\s*(body|html|\*)[\s,{]/m.test(bare), 'print-kit.css has no body, html or bare * rule: linking it changes nothing by itself');
const selectors = [...bare.matchAll(/(^|[}{])\s*([^{}@]+)\{/g)].map(m => m[2].trim()).filter(s => s && !/^(from|to|\d+%)$/.test(s));
const stray = selectors.flatMap(s => s.split(',')).map(s => s.trim()).filter(s => s && s !== ':root' && !/\.pk-/.test(s));
eq(stray, [], 'every selector is scoped to a pk- class');
const literals = [...bare.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map(m => m[0]);
eq(literals.sort(), ['#000', '#000', '#fff'], 'the only colour literals are the ink-safe black and white');
const beforePrint = bare.slice(0, bare.lastIndexOf('#fff'));
ok(/@media print\s*\{[^@]*$/.test(beforePrint), 'and they are inside @media print');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
