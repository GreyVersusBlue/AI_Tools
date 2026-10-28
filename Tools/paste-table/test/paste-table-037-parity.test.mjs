// paste-table-037-parity.test.mjs — 037 Grade Distribution Visualizer's score reader now splits a
// tab line through _shared/paste-table.js (Path 16 P2). The page's own parseScores is cut out of the
// HTML and run here against PasteTable, and held to a frozen copy of the old reader over a hand-written
// corpus and 5000 seeded random pastes: scores, seen and skipped must be equal. The page also gained
// `unreadable` (the skipped lines, numbered), which the note under the box prints; that is pinned
// separately, with its wording.
//
//   node Tools/paste-table/test/paste-table-037-parity.test.mjs   (npm run test:paste-table-037-parity)
// Pure Node. Exits 1 on any difference.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseScores as oldParse } from './_legacy-037-parse.mjs';
import { loadPasteTable } from './_load-paste-table.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'Tools', '037-grade-distribution-visualizer.html'), 'utf8');
const a = html.indexOf('function tryNumber(raw)'), b = html.indexOf('/* ---------- stats', a);
// ends at the next section comment: describeUnreadable is the last reader function before the item-analysis page code
const c = html.indexOf('function describeUnreadable'), d = html.indexOf('/* ---------- per-question item analysis', c);
if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('cannot find the reader in 037');

function page(PasteTable) {
  const ctx = { PasteTable };
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + html.slice(c, d) + '\nthis.parseScores = parseScores; this.describe = describeUnreadable;', ctx);
  return ctx;
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const live = page(loadPasteTable());
let failed = 0, n = 0;
const strip = r => ({ scores: r.scores, seen: r.seen, skipped: r.skipped });
const ctl = (label, text, pg = live) => {
  n++;
  const o = oldParse(text), x = strip(pg.parseScores(text));
  if (!same(o, x)) { failed++; console.error(`FAIL ${label}\n  text: ${JSON.stringify(text)}\n  old: ${JSON.stringify(o)}\n  new: ${JSON.stringify(x)}`); }
};

const HAND = [
  '', 'Ann, 87\nBo: 92\nCy\t75', '87\n92\n75', 'Name\tScore\nAnn\t87\nBo\t', 'Ann\t87\t\n', 'Ann\t\t87%', 'Ann\t 87 \tabsent', 'Ann 87', 'Ann Lee 87.5',
  'Ann, "87"', 'Ann,87,90', 'Ann: 87, 90', '  \n\n', 'x\ty\tz', '-5\n105\n1e3', '87.\n.5', 'a\t1\r\nb\t2\r\n', '\t\t', '\t87', 'Ann\t87 ',
  'Total: 12 students', 'Name\tPeriod\tScore\nA\t3\t88\nB\t3\tabsent',
];
HAND.forEach((t, i) => ctl('hand ' + (i + 1), t));

let seed = 37037037;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = x => x[Math.floor(rnd() * x.length)];
const NAMES = ['Ann', 'Bo Lee', 'Name', 'Score', 'Total', ''];
const VALS = ['87', '92.5', '75%', 'absent', '', ' ', '-3', '100', '1,000', '$5', 'n/a', '0'];
for (let i = 0; i < 5000; i++) {
  const lines = [];
  for (let l = 0, L = Math.floor(rnd() * 7); l < L; l++) {
    const sep = pick(['\t', ', ', ': ', ' ', '\t\t', ',']);
    const cells = [pick(NAMES), pick(VALS)];
    if (rnd() < 0.25) cells.push(pick(VALS));
    lines.push(cells.join(sep));
    if (rnd() < 0.1) lines.push(pick(['', '  ']));
  }
  ctl('random ' + i, lines.join(rnd() < 0.2 ? '\r\n' : '\n'));
}

// the skipped lines are named, by line number in what was pasted
{
  const r = live.parseScores('Name\tScore\nAnn\t87\n\nBo\tabsent\nCy\t90');
  n++;
  if (!same(r.unreadable, [{ line: 1, text: 'Name\tScore' }, { line: 4, text: 'Bo\tabsent' }])) { failed++; console.error('FAIL unreadable: ' + JSON.stringify(r.unreadable)); }
  const msg = live.describe(live.parseScores('a\nb\nc\nd\ne').unreadable);
  n++;
  if (msg !== 'line 1 “a”, line 2 “b”, line 3 “c” and 2 more') { failed++; console.error('FAIL describe: ' + msg); }
  const long = live.describe([{ line: 7, text: 'x'.repeat(40) }]);
  n++;
  if (long !== 'line 7 “' + 'x'.repeat(23) + '…”') { failed++; console.error('FAIL describe long: ' + long); }
}

// Break on purpose (cell trimming is not observable here: tryNumber trims, and the line is trimmed first)
for (const [label, mutate] of [
  ['quotes honoured in tab lines', s => s.replace('var quotes = !opts || opts.quotes !== false;', 'var quotes = true;')],
]) {
  const m = page(loadPasteTable(mutate));
  const caught = HAND.concat(['"a"\t"87"']).some(t => !same(oldParse(t), strip(m.parseScores(t))));
  if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught`); }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-037-parity: ${n} comparisons identical or as pinned`);
