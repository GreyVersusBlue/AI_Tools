// smoke-cycle-labels-core.mjs — a calendar that names its own cycle letters, in pure Node.
//
//   node Tools/school-calendar/test/smoke-cycle-labels-core.mjs   (or: npm run test:school-calendar-cycle-labels-core)
//
// `abCycle.labels` is one optional field of `scv_calendar_v1` (AI-87). Held here, for both readers of the
// rule (scv-weeks.js, which 032 uses, and _shared/school-day.js, which 010 and the other tools use):
//   older   A record with no `labels` field gives exactly the letters it always did: the field-free result
//           equals the result with labels ["A","B"] written out, and equals a walk done here by hand.
//   walk    With A-B-C-D (and 1-6) the anchor date has its own letter, every school day after it steps one
//           place round, weekends and no-school days neither take a letter nor advance it, and days before
//           the anchor run backward round the same ring.
//   guard   An unusable list (one letter, nine, a repeat, a blank, a long word, not strings, not an array)
//           falls back to A and B; an anchor letter that is not in the list takes the first label.
//   typed   parseLabels() reads "A, B, C" and "1 2 3 4", and refuses what cycleLabels() would not keep.
//   twin    The two readers agree on every day of a whole year for several rings and anchors.
//   round   A calendar with labels survives JSON.stringify/parse and gives the same letters.
// Everything here is made up. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { seedCalendar2026 } from '../scv-seed.js';
import { abLetters, cycleLabels, parseLabels } from '../scv-weeks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '..', '..', '..', '_shared/school-day.js'), 'utf8'), ctx);
const SD = ctx.window.SchoolDay;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const clone = (v) => JSON.parse(JSON.stringify(v));
const plain = (v) => clone(v);

const base = seedCalendar2026();
const withCycle = (ac) => { const c = clone(base); c.abCycle = ac; return c; };
const days = (cal) => Object.keys(abLetters(cal)).sort();
const isSchool = (iso) => SD.isSchoolDay(base, iso);

/* older: no field is the two-letter cycle */
for (const letter of ['A', 'B']) {
  const old = withCycle({ enabled: true, anchorDate: '2026-09-16', anchorLetter: letter });
  const written = withCycle({ enabled: true, anchorDate: '2026-09-16', anchorLetter: letter, labels: ['A', 'B'] });
  eq(abLetters(old), abLetters(written), `no field equals ["A","B"] written out (anchor ${letter})`);
  eq(plain(SD.abLetters(old)), abLetters(old), `school-day.js reads the older record as scv-weeks.js does (anchor ${letter})`);
  eq(abLetters(old)['2026-09-16'], letter, `the anchor has its letter (${letter})`);
  const d = days(old);
  ok(d.every((iso, i) => i === 0 || abLetters(old)[iso] !== abLetters(old)[d[i - 1]]), `the older record still alternates on every school day (${letter})`);
}
eq(cycleLabels(undefined), ['A', 'B'], 'no cycle: A and B');
eq(cycleLabels({ enabled: true }), ['A', 'B'], 'no labels: A and B');
eq(abLetters(withCycle({ enabled: false, anchorDate: '2026-09-16', anchorLetter: 'A', labels: ['A', 'B', 'C'] })), {}, 'the cycle off still gives nothing, labels or not');

/* walk: an independent count of school days from the anchor */
for (const [labels, anchorLetter, anchor] of [
  [['A', 'B', 'C', 'D'], 'C', '2026-09-16'],
  [['1', '2', '3', '4', '5', '6'], '1', '2026-08-31'],
  [['A', 'B', 'C'], 'B', '2026-10-12'],          // a holiday-adjacent anchor
  [['Rd', 'Bl'], 'Bl', '2026-09-16'],
]) {
  const cal = withCycle({ enabled: true, anchorDate: anchor, anchorLetter, labels });
  const map = abLetters(cal);
  const L = labels.length, a0 = labels.indexOf(anchorLetter);
  const all = days(cal);
  // first school day on or after the anchor takes the anchor letter
  const first = all.find((iso) => iso >= anchor);
  eq(map[first], anchorLetter, `${labels.join('')}: the anchor (or the first school day after it) takes ${anchorLetter}`);
  let k = all.indexOf(first), bad = 0;
  all.forEach((iso, i) => { if (map[iso] !== labels[(((a0 + (i - k)) % L) + L) % L]) bad++; });
  eq(bad, 0, `${labels.join('')}: every school day steps one place round the ring, before and after the anchor`);
  ok(all.every(isSchool), `${labels.join('')}: only school days have a letter`);
  ok(all.length > 150, `${labels.join('')}: a whole year is lettered`);
  eq(plain(SD.abLetters(cal)), map, `${labels.join('')}: school-day.js gives the same letters`);
}

/* guard */
for (const [bad, why] of [
  [['A'], 'one letter'], [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 'nine letters'], [['A', 'A'], 'a repeat'],
  [['A', ' '], 'a blank'], [['A', 'Long'], 'four characters'], [['A', 3], 'not a string'], ['AB', 'not an array'], [[], 'empty'],
]) {
  eq(cycleLabels({ labels: bad }), ['A', 'B'], `${why}: falls back to A and B`);
  eq(plain(SD.cycleLabels({ labels: bad })), ['A', 'B'], `${why}: school-day.js falls back too`);
}
eq(cycleLabels({ labels: [' x ', 'y'] }), ['x', 'y'], 'labels are trimmed');
eq(cycleLabels({ labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }).length, 8, 'eight is allowed');
{
  const cal = withCycle({ enabled: true, anchorDate: '2026-09-16', anchorLetter: 'Z', labels: ['A', 'B', 'C'] });
  eq(abLetters(cal)['2026-09-16'], 'A', 'an anchor letter not in the list takes the first label');
  const old = withCycle({ enabled: true, anchorDate: '2026-09-16', anchorLetter: 'C' });
  eq(abLetters(old)['2026-09-16'], 'A', 'with no labels, a "C" anchor is an A day, as before');
}

/* typed */
eq(parseLabels('A, B, C'), ['A', 'B', 'C'], 'commas');
eq(parseLabels('1 2 3 4'), ['1', '2', '3', '4'], 'spaces');
eq(parseLabels('  a;b  '), ['a', 'b'], 'semicolons and padding');
eq(parseLabels('A'), null, 'one letter is refused');
eq(parseLabels('A, A'), null, 'a repeat is refused');
eq(parseLabels(''), null, 'blank is refused');
eq(parseLabels('Mon, Tues'), null, 'a word over three characters is refused');

/* twin: whole-year agreement */
for (const labels of [undefined, ['A', 'B'], ['A', 'B', 'C', 'D'], ['1', '2', '3', '4', '5', '6'], ['X', 'Y', 'Z']]) {
  for (const anchor of ['2026-08-20', '2026-09-16', '2026-12-25', '2027-02-14', '2027-06-30']) {
    const ac = { enabled: true, anchorDate: anchor, anchorLetter: labels ? labels[labels.length - 1] : 'B' };
    if (labels) ac.labels = labels;
    const cal = withCycle(ac);
    eq(plain(SD.abLetters(cal)), abLetters(cal), `twin agrees: ${labels ? labels.join('') : 'none'} anchored ${anchor}`);
  }
}

/* round trip */
{
  const cal = withCycle({ enabled: true, anchorDate: '2026-09-16', anchorLetter: '3', labels: ['1', '2', '3', '4'] });
  const back = JSON.parse(JSON.stringify(cal));
  eq(back.abCycle.labels, ['1', '2', '3', '4'], 'labels survive JSON');
  eq(abLetters(back), abLetters(cal), 'and give the same letters');
}

console.log(failed ? `${passed} passed, ${failed} FAILED` : `${passed} passed`);
process.exit(failed ? 1 : 0);
