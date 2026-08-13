// smoke-worksheet-mode.mjs — the graph paper tool's graphing-worksheet mode:
// a problem printed above each small coordinate plane, plus a matching
// answer-key sheet with the line/curve already plotted.
//
//   node Tools/graph-paper-generator/test/smoke-worksheet-mode.mjs
//
// gpg-render.js has no DOM dependency (every render function is pure: opts
// in, an SVG string out), so — same approach as
// Tools/graph-paper-generator/test/smoke-calibration.mjs's DOM-free half —
// this suite loads it directly in plain Node with no browser involved at
// all, and asserts geometry straight off the returned SVG string.
//
// Covers three layers: the ported expression parser (tokenizeGraphExpr /
// parseGraphExpression), random problem generation (generateProblem), and
// the worksheet render itself (renderWorksheet) — caption placement, the
// worksheet/answer-key toggle, and that onePlaneSvg's new plotFn hook is a
// true no-op for every pre-existing caller.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);

console.log('Graph Paper — worksheet mode (problem + answer key)');

const here = path.dirname(fileURLToPath(import.meta.url));
const renderSrc = readFileSync(path.join(here, '..', 'gpg-render.js'), 'utf8');
const sandbox = {};
new Function('global', renderSrc + '\n;return global;')(sandbox);
const R = sandbox.GraphPaperRender;

['renderWorksheet', 'tokenizeGraphExpr', 'parseGraphExpression', 'generateProblem'].forEach(name => {
  ok(typeof R[name] === 'function', `the renderer exposes ${name}`);
});

/* ── 1. the expression parser ──────────────────────────────────────────── */

function evalAt(text, x) {
  const fn = R.parseGraphExpression(text);
  return fn ? fn(x) : null;
}

near(evalAt('y = 2x + 3', 5), 13, 1e-9, 'y = 2x + 3 at x=5');
near(evalAt('y=2x+3', 5), 13, 1e-9, 'the same with no spaces and no "y = " padding');
near(evalAt('  y = 2x + 3  ', 5), 13, 1e-9, 'and with stray whitespace');
near(evalAt('f(x) = 2x + 3', 5), 13, 1e-9, 'an "f(x) =" prefix is stripped the same way');
near(evalAt('2x + 3', 5), 13, 1e-9, 'and a bare right-hand side with no prefix at all');
near(evalAt('y = -3x - 1', 2), -7, 1e-9, 'negative slope and negative intercept: y = -3x - 1 at x=2');
near(evalAt('y = x', 4), 4, 1e-9, 'bare x (slope 1, no intercept)');
near(evalAt('y = -x', 4), -4, 1e-9, 'bare -x (slope -1)');
near(evalAt('y = x^2 - 4', 3), 5, 1e-9, 'a quadratic: y = x^2 - 4 at x=3');
near(evalAt('y = -2x^2 + 3x - 1', 2), -3, 1e-9, 'a full quadratic: y = -2x^2 + 3x - 1 at x=2 (-8+6-1)');
near(evalAt('2(x + 1)', 3), 8, 1e-9, 'implicit multiplication: 2(x+1) at x=3');
near(evalAt('x(x + 2)', 3), 15, 1e-9, 'implicit multiplication with x on both sides: x(x+2) at x=3');
near(evalAt('(x - 1)(x + 1)', 3), 8, 1e-9, 'implicit multiplication between two parenthesized groups: (x-1)(x+1) at x=3');
near(evalAt('3 × x + 1', 2), 7, 1e-9, 'the × symbol works as multiplication');
near(evalAt('x ÷ 2', 8), 4, 1e-9, 'the ÷ symbol works as division');
near(evalAt('(2 + 3) * x', 4), 20, 1e-9, 'parentheses around plain numbers still work');
near(evalAt('x^2^1', 3), 9, 1e-9, '^ is right-associative: x^2^1 = x^(2^1) = x^2 at x=3');

eq(evalAt('1 / (x - 2)', 2), null, 'division by zero at the pole evaluates to null, not Infinity/NaN');
eq(R.parseGraphExpression(''), null, 'an empty problem does not parse');
eq(R.parseGraphExpression('   '), null, 'whitespace-only does not parse');
eq(R.parseGraphExpression('this is a word problem'), null, 'free text does not parse');
eq(R.parseGraphExpression('2x +'), null, 'a dangling operator does not parse');
eq(R.parseGraphExpression('(2x + 3'), null, 'an unbalanced open paren does not parse');
eq(R.parseGraphExpression('2x + 3)'), null, 'an unbalanced close paren does not parse');
eq(R.parseGraphExpression('2 % 3'), null, 'an unsupported symbol does not parse');
eq(R.parseGraphExpression('y = 2x + y'), null, 'a second variable (y on the RHS) does not parse — only x is a variable here');

const tokens = R.tokenizeGraphExpr('2x+3');
ok(Array.isArray(tokens), 'tokenizeGraphExpr returns a token array for valid input');
eq(tokens.map(t => t.type).join(','), 'num,op,var,op,num',
  'implicit multiplication is inserted between the number and the variable (num,*,var,+,num)');
eq(R.tokenizeGraphExpr('nonsense!!'), null, 'tokenizeGraphExpr rejects unrecognized characters');

/* ── 2. random problem generation ────────────────────────────────────────── */

// A fixed sequence makes generateProblem's rng-injection deterministic —
// the same reason renderCalibration's tests don't depend on real timers.
function fakeRng(seq) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

const lin1 = R.generateProblem('linear', {}, fakeRng([0.1, 0.9]));
const lin2 = R.generateProblem('linear', {}, fakeRng([0.1, 0.9]));
eq(lin1, lin2, 'generateProblem is deterministic given the same rng sequence');
ok(/^y = /.test(lin1), 'a linear problem is printed as "y = ..."');
ok(R.parseGraphExpression(lin1) !== null, 'every generated linear problem is itself parseable');

// Not [0.5, 0.5, 0.5]: nonZeroRandInt's reroll-until-nonzero loop for the
// leading coefficient (range -2..2, 5 buckets) maps r=0.5 to bucket 0 every
// time, so a constant-0.5 rng never terminates. 0.9 lands the first draw on
// a nonzero bucket in one try; 0.5 is fine for the two draws after it (b, c
// are allowed to be zero).
const quad = R.generateProblem('quadratic', {}, fakeRng([0.9, 0.5, 0.5]));
ok(/x\^2/.test(quad), 'a quadratic problem includes an x^2 term');
ok(R.parseGraphExpression(quad) !== null, 'every generated quadratic problem is itself parseable');

// Real Math.random(), many draws — the leading coefficient must never be
// zero (a "linear" problem with m=0 isn't a line worth graphing) and every
// draw must still round-trip through the parser.
let allLinearParse = true, everZeroSlope = false, everZeroLeadingQuad = false, allQuadParse = true;
for (let i = 0; i < 200; i++) {
  const l = R.generateProblem('linear', {});
  if (!R.parseGraphExpression(l)) allLinearParse = false;
  if (/^y = 0(\s|$)/.test(l)) everZeroSlope = true;
  const q = R.generateProblem('quadratic', {});
  if (!R.parseGraphExpression(q)) allQuadParse = false;
  if (!/x\^2/.test(q)) everZeroLeadingQuad = true;
}
ok(allLinearParse, '200 randomly generated linear problems all parse');
ok(allQuadParse, '200 randomly generated quadratic problems all parse');
ok(!everZeroSlope, 'a generated linear problem never has a zero slope (y = 0 + b is not a line worth plotting)');
ok(!everZeroLeadingQuad, 'a generated quadratic problem always keeps its x^2 term');

/* ── 3. renderWorksheet geometry ─────────────────────────────────────────── */

const straightProblems = ['y = 2x + 3', 'y = -x + 1', 'y = 0.5x - 2', 'y = -2x - 4'];

function countTags(svg, tag) {
  return (svg.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
}

// Blank worksheet: the problems print, nothing is plotted.
const blank = R.renderWorksheet({
  orientation: 'portrait', copies: 4, quadrants: 'four',
  xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5,
  problems: straightProblems, showAnswer: false
});
eq(blank.copies, 4, 'the blank worksheet reports 4 copies');
eq(blank.plottedCount, 0, 'and nothing plotted, since showAnswer is off');
eq(countTags(blank.svg, 'polyline'), 0, 'no <polyline> at all on the blank worksheet');
straightProblems.forEach((p, i) => {
  ok(blank.svg.includes(`${i + 1}) ${p}`), `problem ${i + 1} is printed above its plane, numbered: "${i + 1}) ${p}"`);
});
ok(!/NaN/.test(blank.svg) && !/undefined/.test(blank.svg), 'the blank worksheet SVG has no NaN/undefined');

// Answer key: the same four problems, now plotted. Each is a straight line
// that stays comfortably inside [-10, 10] across the whole domain, so each
// should come back as exactly one contiguous <polyline>.
const answer = R.renderWorksheet({
  orientation: 'portrait', copies: 4, quadrants: 'four',
  xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5,
  problems: straightProblems, showAnswer: true
});
eq(answer.plottedCount, 4, 'all 4 problems parsed and got plotted on the answer key');
eq(countTags(answer.svg, 'polyline'), 4, 'exactly one polyline per plane for these in-range straight lines');
straightProblems.forEach((p, i) => {
  ok(answer.svg.includes(`${i + 1}) ${p}`), `the answer key still prints problem ${i + 1} above its plane`);
});
ok(!/NaN/.test(answer.svg) && !/undefined/.test(answer.svg), 'the answer key SVG has no NaN/undefined');

// The two should differ only by the plotted lines — same page, same
// captions, same grid — so their SVGs should be identical with every
// <polyline>...</polyline> stripped out.
const stripPolylines = s => s.replace(/<polyline[^/]*\/>/g, '');
eq(stripPolylines(blank.svg), stripPolylines(answer.svg),
  'blank worksheet and answer key render identically once the plotted lines are removed');

// An unparseable problem is skipped (no polyline for it) without breaking
// the others or throwing.
const mixed = R.renderWorksheet({
  orientation: 'portrait', copies: 4, quadrants: 'four',
  xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5,
  problems: ['y = 2x + 3', 'not graphable', 'y = -x + 1', ''],
  showAnswer: true
});
eq(mixed.plottedCount, 2, 'only the 2 parseable, non-empty problems get plotted');
eq(countTags(mixed.svg, 'polyline'), 2, 'and only 2 polylines are drawn');
ok(mixed.svg.includes('2) not graphable'), 'the unparseable problem still prints as text above its (blank) plane');
ok(!/NaN/.test(mixed.svg) && !/undefined/.test(mixed.svg), 'mixed valid/invalid problems still produce a clean SVG');

// A quadratic whose vertex runs off the top of a small plane should still
// plot the parts of the curve that fit, and stay clipped inside the page.
const clipped = R.renderWorksheet({
  orientation: 'portrait', copies: 1, quadrants: 'four',
  xMin: -5, xMax: 5, yMin: -5, yMax: 5, interval: 1, labelEvery: 1,
  problems: ['y = x^2'], showAnswer: true
});
eq(clipped.plottedCount, 1, 'the out-of-range parabola still counts as plotted (some of it is in range)');
ok(countTags(clipped.svg, 'polyline') >= 1, 'at least one polyline segment is drawn for the in-range part of the curve');
const ptNums = [...clipped.svg.matchAll(/points="([^"]+)"/g)]
  .flatMap(m => m[1].trim().split(/\s+/).map(pair => pair.split(',').map(Number)));
ok(ptNums.length > 0, 'the polyline has plotted points');
const pageP = R.renderWorksheet({ orientation: 'portrait', copies: 1, problems: [''], showAnswer: false });
const [pw, ph] = [8.5, 11];
ok(ptNums.every(([x, y]) => x >= -1e-6 && x <= pw + 1e-6 && y >= -1e-6 && y <= ph + 1e-6),
  'every plotted point stays on the physical page (nothing drawn past the edge)');

// copies falls back to 1 for a value PLANE_LAYOUTS doesn't recognize —
// same contract as renderCoordinatePlane's `copies`.
const oddCopies = R.renderWorksheet({ orientation: 'portrait', copies: 3, problems: ['y = x'], showAnswer: false });
eq(oddCopies.copies, 1, 'an unsupported copies value (3) falls back to 1, same as renderCoordinatePlane');

// A shorter/longer problems array than `copies` is padded/truncated rather
// than throwing or leaving stale captions.
const shortProblems = R.renderWorksheet({ orientation: 'portrait', copies: 4, problems: ['y = x'], showAnswer: false });
eq(countTags(shortProblems.svg, 'text') > 0, true, 'a problems array shorter than copies does not throw');
eq(shortProblems.copies, 4, 'still renders all 4 planes');
const longProblems = R.renderWorksheet({
  orientation: 'portrait', copies: 2, problems: ['y = x', 'y = 2x', 'y = 3x', 'y = 4x'], showAnswer: false
});
eq(longProblems.copies, 2, 'a problems array longer than copies is truncated to copies');
ok(!longProblems.svg.includes('3) '), 'the truncated extra problems are not printed');

// Landscape swaps the page like every other mode.
const land = R.renderWorksheet({ orientation: 'landscape', copies: 2, problems: ['y = x', 'y = -x'], showAnswer: false });
ok(/width="11in" height="8.5in"/.test(land.svg), 'landscape swaps the page dimensions');
ok(/viewBox="0 0 11 8.5"/.test(land.svg), 'and the viewBox matches');

// Header + ink-saving mode combine without breaking (mirrors the
// header/faded/copies interaction check Round 3 ran for renderCoordinatePlane).
// (Same xMin/xMax/yMin/yMax/interval/labelEvery as the other renderWorksheet
// calls in this suite — every real caller supplies them, so leaving them out
// here would just prove that onePlaneSvg quietly clips every point when the
// range collapses to NaN, not that plotting survives a dressed-up sheet.)
const dressed = R.renderWorksheet({
  orientation: 'portrait', copies: 6, quadrants: 'four',
  xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5,
  problems: straightProblems.concat(['y = x', 'y = -2x + 5']),
  showAnswer: true, faded: true,
  header: { title: 'Unit 4 Graphing', showName: true, showDate: true }
});
eq(dressed.copies, 6, '6-plane layout still works with header + ink-saving + answer key all on');
ok(!/NaN/.test(dressed.svg) && !/undefined/.test(dressed.svg), 'no NaN/undefined with every option combined');
ok(dressed.svg.includes('Unit 4 Graphing'), 'the header title still renders');
ok(dressed.svg.includes('color="#a8a8a8"'), 'ink-saving mode still fades the grid');
ok(dressed.svg.includes('#c43a2f'), 'but the plotted answer lines use their own fixed color, not the faded one');

// The plotted lines are NOT inside the faded <g>, so they read at full
// strength regardless of ink-saving mode — same "answer stays legible"
// contract as the header.
const fadedGroupMatch = dressed.svg.match(/<g color="#a8a8a8">([\s\S]*)<\/g>\s*<\/svg>$/);
ok(fadedGroupMatch !== null, 'the faded group is present and is the last thing before </svg> (so the check below is meaningful)');
if (fadedGroupMatch) {
  // Every polyline appears inside the faded <g> in the concatenated markup
  // (onePlaneSvg's parts are wrapped as a whole), but each polyline element
  // itself carries an explicit stroke="#c43a2f" rather than
  // stroke="currentColor" — so it ignores the <g>'s color override.
  const polylines = [...dressed.svg.matchAll(/<polyline[^>]*>/g)];
  ok(polylines.length > 0, 'there are plotted polylines to check');
  ok(polylines.every(m => m[0].includes('stroke="#c43a2f"')), 'every plotted polyline has its own explicit stroke color');
  ok(polylines.every(m => !m[0].includes('currentColor')), 'and none of them rely on currentColor (so fading the group cannot fade them)');
}

/* ── 4. onePlaneSvg's new plotFn hook is a no-op for existing callers ──── */

const planeBefore = R.renderCoordinatePlane({
  orientation: 'portrait', quadrants: 'four', xMin: -10, xMax: 10, yMin: -10, yMax: 10,
  interval: 1, labelEvery: 5, copies: 4
});
eq(countTags(planeBefore.svg, 'polyline'), 0, 'renderCoordinatePlane (which never sets plotFn) still draws zero polylines');
eq(planeBefore.copies, 4, 'and its own return shape is unchanged');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
