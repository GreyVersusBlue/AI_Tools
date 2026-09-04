// seating-read.test.mjs — _shared/seating-read.js: the parse guard, the
// section chain, the room maths and the printed table. Plain Node, no browser.
//
//   node Tools/seating-read/test/seating-read.test.mjs
//
// seating-read.js is a classic browser script ending in `})(window)`, so it
// cannot be imported; it is evaluated in a `vm` context over a fake window
// carrying a localStorage and an addEventListener.
//
// Every number this file asserts was read off the readers it replaces, not
// invented: the viewBox arithmetic and the rotated-desk overhang from 010's
// inline panel, the percentage boxes from 008's seating-layout.js, the
// reading-order desk table from 045. Where those three disagreed the choice is
// stated in the module's header and asserted here, so the disagreement is a
// decision on the record rather than something a later reader has to
// rediscover by diffing three files.
//
// No real student appears in this file. Every name is invented.
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

const SRC = fs.readFileSync(path.join(SITE, '_shared', 'seating-read.js'), 'utf8');

function load({ seed = null, noStorage = false } = {}) {
  const listeners = {};
  const map = new Map();
  if (seed !== null) map.set('seating-chart-v1', seed);
  const win = {
    localStorage: noStorage
      ? { getItem() { throw new Error('blocked'); } }
      : { getItem: k => (map.has(k) ? map.get(k) : null) },
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
    console,
  };
  const ctx = vm.createContext(win);
  vm.runInContext('var window = this;', ctx);
  vm.runInContext(SRC, ctx, { filename: '_shared/seating-read.js' });
  return {
    S: ctx.SeatingRead,
    fire: (key, newValue) => (listeners.storage || []).forEach(fn => fn({ key, newValue })),
    count: () => (listeners.storage || []).length,
  };
}
const { S } = load();

console.log('The shared seating-chart reader (Path 14 P2)');

/* A room a teacher could actually have: two rows of three, one desk turned
   sideways, one student with no desk, one flagged. */
const CHART = {
  active: 's2',
  mirror: false,
  numbered: false,
  sections: [
    { id: 's1', name: 'Period 1 — Homeroom', desks: [], students: [], assign: {} },
    {
      id: 's2',
      name: 'Period 3 — Earth Science',
      students: [
        { id: 'a', name: 'Ada Lovelace', note: 'front, please', flag: false },
        { id: 'b', name: 'Grace Hopper', note: '', flag: true },
        { id: 'c', name: 'Katherine Johnson', note: '', flag: false },
        { id: 'd', name: 'Mary Jackson', note: 'no desk yet', flag: false },
      ],
      desks: [
        { id: 'd1', x: 100, y: 200, rot: 0 },
        { id: 'd2', x: 240, y: 200, rot: 0 },
        { id: 'd3', x: 380, y: 200, rot: 90 },
        { id: 'd4', x: 100, y: 320, rot: 0 },
      ],
      assign: { d1: 'a', d2: 'b', d4: 'c' },
    },
  ],
};
const SECTION = CHART.sections[1];

/* ── 1. Reading never throws ─────────────────────────────────────────────── */
{
  eq(S.KEY, 'seating-chart-v1', '1: the permanent key 005 owns');
  eq(S.parse(null), null, '1: no key reads as null');
  eq(S.parse(''), null, '1: an empty string reads as null');
  eq(S.parse('{not json'), null, '1: hand-corrupted JSON reads as null rather than throwing');
  eq(S.parse('"a string"'), null, '1: valid JSON that is not a chart reads as null');
  eq(S.parse('{}'), null, '1: no sections array reads as null');
  eq(S.parse(JSON.stringify({ sections: [] })), null, '1: an empty chart reads as null');
  ok(S.parse(JSON.stringify(CHART)) !== null, '1: a real chart parses');

  const seeded = load({ seed: JSON.stringify(CHART) });
  eq(seeded.S.read().sections.length, 2, '1: read() goes to the key itself');
  eq(load({ seed: null }).S.read(), null, '1: ...and an unwritten key is null, not an error');
  eq(load({ noStorage: true }).S.read(), null, '1: a browser blocking storage reads as null too');
}

/* ── 2. Class-name matching, as every reader already does it ─────────────── */
{
  eq(S.loosely('  Period   3! '), 'period 3', '2: punctuation and doubled spaces collapse');
  ok(S.sameClass('Period 3 — Earth Science', 'period 3 earth science'), '2: case and punctuation are ignored');
  ok(S.sameClass('Homeroom', 'Ms. Alvarez — Homeroom'), '2: a substring either direction counts');
  ok(!S.sameClass('Period 3', 'Period 4'), '2: different periods do not match');
  ok(!S.sameClass('', 'Period 3'), '2: an empty name matches nothing — a blank period label must not claim a chart');
}

/* ── 3. The section chain, which is where the three readers differed ─────── */
{
  eq(S.pickSection(CHART, { chosenId: 's1' }).id, 's1', '3: an explicit choice wins');
  eq(S.pickSection(CHART, { chosenId: 'deleted-in-005' }).id, 's2',
    '3: ...but a choice the chart no longer has falls through instead of blanking');
  eq(S.pickSection(CHART, { names: ['Earth Science'] }).id, 's2', '3: a name match wins next');
  eq(S.pickSection(CHART, { names: ['Homeroom', 'Earth Science'] }).id, 's1',
    '3: the caller\'s order decides — the roster it set deliberately is tried before the period label');
  eq(S.pickSection(CHART, { names: [null, '', 'Earth Science'] }).id, 's2',
    '3: an empty name in the chain is skipped, not treated as a failure to match');
  eq(S.pickSection(CHART, { names: ['Band'] }).id, 's2', '3: no match falls back to the chart\'s active section');
  eq(S.pickSection({ sections: [{ id: 'only' }] }, {}).id, 'only',
    '3: a chart with one class and no active id just works');
  eq(S.pickSection(null, {}), null, '3: no chart, no section');
  eq(S.pickSection({ sections: [] }, {}), null, '3: an empty chart has none either');
}

/* ── 4. Where the desks are ──────────────────────────────────────────────── */
{
  const placed = S.placeDesks(SECTION, {});
  eq(placed.length, 4, '4: every desk is placed, empty ones included');
  eq(placed.map(p => p.x), [100, 240, 380, 100], '4: unmirrored, x is what the chart saved');
  eq(placed.map(p => (p.student ? p.student.name : null)),
    ['Ada Lovelace', 'Grace Hopper', null, 'Katherine Johnson'],
    '4: each desk carries its assigned student, or null');
  eq(placed.map(p => p.index), [0, 1, 2, 3],
    '4: index is the saved order — what 005 and 010 both number a seat by');
  eq(S.placeDesks({ desks: [] }, {}), [], '4: a section with no desks placed is empty, not an error');
  eq(S.placeDesks(null, {}), [], '4: ...and so is no section at all');

  /* Mirroring reflects the coordinates about the room's own bounds, so labels
     stay the right way round and the room does not move. minX 100,
     maxX 380+106=486: a desk at 100 lands at 486+100-100-106 = 380. */
  const mirrored = S.placeDesks(SECTION, { mirror: true });
  eq(mirrored.map(p => p.x), [380, 240, 100, 380], '4: mirrored, the row reverses about the room');
  eq(mirrored.map(p => p.rot), [0, 0, -90, 0], '4: a turned desk turns the other way with it');
  eq(mirrored.map(p => p.index), [0, 1, 2, 3], '4: seat numbers do not renumber when the view flips');
  eq(mirrored.map(p => p.y), placed.map(p => p.y), '4: nothing moves up or down');
}

/* ── 5. The box to draw it in ────────────────────────────────────────────── */
{
  const placed = S.placeDesks(SECTION, {});
  const box = S.bounds(placed, { frontBand: S.FRONT_BAND });
  // minX 100, maxX 486, minY 200, maxY 390; one desk is rotated, so
  // overhang = (106-70)/2 = 18. These are 010's numbers.
  eq(box.overhang, 18, '5: a rotated desk overhangs its own box by (w-h)/2');
  eq([box.vx, box.vy], [100 - 26 - 18, 200 - 26 - 62 - 18], '5: the viewBox origin leaves room for it and for the front band');
  eq([box.vw, box.vh], [(486 - 100) + 2 * (26 + 18), (390 - 200) + 2 * (26 + 18) + 62], '5: ...and so does its size');

  const square = S.bounds(S.placeDesks({
    desks: [{ id: 'x', x: 0, y: 0, rot: 0 }, { id: 'y', x: 200, y: 0, rot: 180 }], students: [], assign: {}
  }, {}), {});
  eq(square.overhang, 0, '5: a desk turned 180° does not overhang — only an odd quarter turn does');
  eq([square.vw, square.vh], [306 + 52, 70 + 52], '5: no front band unless one is asked for');

  eq(S.bounds([], {}), null, '5: nothing to measure, no box');

  /* 008 measures only the desks it matched to its own roster, 010 measures
     every desk. bounds() measures what it is handed, so both keep their own
     behaviour — the difference is real and is recorded in the module header. */
  const subset = S.bounds(placed.filter(p => p.student), {});
  ok(subset.maxX < box.maxX, '5: measuring a subset gives a different room, which is the disagreement to resolve when 008 migrates');
}

/* ── 6. Percentage boxes, for a caller laying out divs ───────────────────── */
{
  const placed = S.placeDesks(SECTION, {});
  const box = S.bounds(placed, {});
  const pct = S.toPercent(placed, box);
  eq(pct.length, 4, '6: one box per desk');
  ok(pct.every(p => p.leftPct >= 0 && p.leftPct + p.wPct <= 100.0001),
    '6: every desk sits inside its own room, left to right');
  ok(pct.every(p => p.topPct >= 0 && p.topPct + p.hPct <= 100.0001),
    '6: ...and top to bottom');
  eq(Math.round(pct[0].wPct * 100) / 100, Math.round((106 / box.vw) * 10000) / 100,
    '6: a desk is its own width as a fraction of the room');
  eq(pct.map(p => (p.student ? p.student.name : null))[1], 'Grace Hopper', '6: the student comes along');
  eq(S.toPercent(placed, null), [], '6: no box, nothing to place');
}

/* ── 7. Who is not sitting down ──────────────────────────────────────────── */
{
  eq(S.unseatedNames(SECTION), ['Mary Jackson'], '7: a student with no desk is named');
  eq(S.fill(SECTION), { filled: 3, total: 4 }, '7: three of four seats filled');
  eq(S.unseatedNames({ students: [], assign: {} }), [], '7: an empty section has nobody unseated');
  eq(S.fill({ desks: [], students: [], assign: {} }), { filled: 0, total: 0 },
    '7: a section with no desks is 0 of 0, not a division by zero');

  /* A desk assigned to a student the roster no longer has: 005 can leave one
     behind. It must not count as filled, and must not resurrect the name. */
  const stale = { students: [{ id: 'a', name: 'Ada Lovelace' }], desks: [{ id: 'd1', x: 0, y: 0 }], assign: { d1: 'ghost' } };
  eq(S.fill(stale), { filled: 0, total: 1 }, '7: a desk assigned to a student who is gone reads as empty');
  eq(S.unseatedNames(stale), ['Ada Lovelace'], '7: ...and the student who IS on the roster is unseated');
}

/* ── 8. The printed table (045's sub binder) ─────────────────────────────── */
{
  const t = S.deskRows(SECTION);
  eq(t.rows.map(r => r.label), ['Desk 1', 'Desk 2', 'Desk 3', 'Desk 4'],
    '8: desks are numbered 1..n in the order they are printed');
  eq(t.rows.map(r => r.name), ['Ada Lovelace', 'Grace Hopper', '', 'Katherine Johnson'],
    '8: reading order is down the room then across — a substitute reads front to back, not in drag order');
  eq(t.rows[0].note, 'front, please', '8: a note prints with its student');
  eq(t.rows.map(r => r.flag), [false, true, false, false], '8: a flag prints too');
  eq(t.rows[2].name, '', '8: an empty desk is a blank row, not a missing one — a gap is information');
  eq(t.unseated.map(s => s.name), ['Mary Jackson'], '8: and whoever has no desk is listed');
  eq(S.deskRows({ desks: [], students: [], assign: {} }), { rows: [], unseated: [] },
    '8: no desks, no rows');
}

/* ── 9. Another tab editing the chart ────────────────────────────────────── */
{
  const { S: S2, fire, count } = load();
  let seen = 0, last = null;
  const off = S2.onChange(state => { seen++; last = state; });
  eq(count(), 1, '9: one listener wired');
  fire('seating-chart-v1', JSON.stringify(CHART));
  eq(seen, 1, '9: a write in another tab arrives');
  eq(last.sections.length, 2, '9: ...already parsed');
  fire('np_rosters', '{}');
  eq(seen, 1, '9: another key is not ours');
  fire(null, null);
  eq(seen, 1, '9: a cleared storage carries no key and is ignored');
  fire('seating-chart-v1', '{corrupt');
  eq(seen, 2, '9: a corrupt write still fires');
  eq(last, null, '9: ...as null, so the caller falls back rather than rendering rubbish');
  off();
  eq(count(), 0, '9: unsubscribing removes the listener');
  fire('seating-chart-v1', JSON.stringify(CHART));
  eq(seen, 2, '9: ...and nothing arrives after');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
