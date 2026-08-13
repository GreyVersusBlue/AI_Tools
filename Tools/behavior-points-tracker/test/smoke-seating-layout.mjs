// smoke-seating-layout.mjs — pure data-transform coverage for
// Tools/behavior-points-tracker/seating-layout.js, the read-only bridge from
// Seating Chart Generator's saved room (`seating-chart-v1`) to this tool's
// tap board.
//
//   node Tools/behavior-points-tracker/test/smoke-seating-layout.mjs
//
// DOM-free by design (see the file under test): every export here is driven
// directly under plain Node, no Playwright involved. The "leave the board
// standing" contract — a missing, corrupt, or empty chart never breaks the
// board, it just has nothing to offer — gets explicit coverage of its own
// rather than being inferred from the happy path.
//
// No real student appears in this file. Every name is invented.
//
// Exits 1 on any failure.

import {
  SEATING_KEY, DESK_W, DESK_H,
  parseSeatingState, loosely, sameClass, pickSeatingSection, layoutSeats,
} from '../seating-layout.js';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
function group(name) { console.log('\n' + name); }

console.log('Behavior & Points Tracker — seating-chart board layout');

/* ── the constant itself ─────────────────────────────────────────────────── */
group('storage key');
eq(SEATING_KEY, 'seating-chart-v1', 'is the permanent, non-versioned key Seating Chart Generator owns');

/* ── parseSeatingState: never throws, degrades to null ──────────────────── */
group('parseSeatingState — leave the board standing');
eq(parseSeatingState(null), null, 'no key at all reads as null');
eq(parseSeatingState(''), null, 'empty string reads as null');
eq(parseSeatingState('{not json'), null, 'hand-corrupted JSON reads as null, not a throw');
eq(parseSeatingState('"just a string"'), null, 'valid JSON that is not an object reads as null');
eq(parseSeatingState('{}'), null, 'an object with no sections array reads as null');
eq(parseSeatingState(JSON.stringify({ sections: [] })), null, 'an empty sections array reads as null');
eq(parseSeatingState(JSON.stringify({ sections: 'nope' })), null, 'a non-array sections field reads as null');
const goodRaw = JSON.stringify({ sections: [{ id: 's1', name: 'Period 3', desks: [], students: [], assign: {} }], active: 's1' });
ok(parseSeatingState(goodRaw) !== null, 'a well-formed chart parses');

/* ── loosely / sameClass — matching a chart's class name to this tool's ──── */
group('sameClass — the room name vs. this tool\'s own name/roster');
ok(sameClass('Period 3 — Earth Science', 'period 3 earth science'), 'punctuation and case are ignored');
ok(sameClass('Homeroom', 'Ms. Alvarez — Homeroom'), 'a substring either direction counts');
ok(!sameClass('Period 3', 'Period 4'), 'different periods do not match');
ok(!sameClass('', 'Period 3'), 'an empty name never matches anything');
eq(loosely('  Period   3! '), 'period 3', 'loosely() collapses punctuation and whitespace');

/* ── pickSeatingSection ───────────────────────────────────────────────────── */
group('pickSeatingSection');
const chart = {
  sections: [
    { id: 'a', name: 'Period 3 — Earth Science', desks: [], students: [], assign: {} },
    { id: 'b', name: 'Period 5 — Honors GT', desks: [], students: [], assign: {} },
  ],
  active: 'b',
};
eq(pickSeatingSection(chart, { chosenId: 'a' }).id, 'a', 'an explicit remembered choice wins outright');
eq(pickSeatingSection(chart, { chosenId: 'not-real', rosterName: 'Period 5 — Honors GT' }).id, 'b',
   'a stale remembered id falls through to the roster-name guess');
eq(pickSeatingSection(chart, { sectionName: 'earth science' }).id, 'a', 'this tool\'s own section name is tried too');
eq(pickSeatingSection(chart, {}).id, 'b', 'with nothing to go on, the chart\'s own active section wins');
eq(pickSeatingSection({ sections: [] }, {}), null, 'no sections at all comes back null, not a throw');
const oneSection = { sections: [{ id: 'only', name: 'X', desks: [], students: [], assign: {} }] };
eq(pickSeatingSection(oneSection, {}).id, 'only', 'a chart with exactly one class needs nothing picked');

/* ── layoutSeats: the happy path ─────────────────────────────────────────── */
group('layoutSeats — matched desks become percentage boxes');
function section(overrides) {
  return Object.assign({
    id: 's1', name: 'Period 3',
    students: [
      { id: 'st-a', name: 'Aiden Whitfield' },
      { id: 'st-b', name: 'Brooklyn Bell' },
      { id: 'st-c', name: 'Casey Nguyen' },
    ],
    desks: [
      { id: 'd1', x: 100, y: 200, rot: 0 },
      { id: 'd2', x: 300, y: 200, rot: 0 },
      { id: 'd3', x: 500, y: 200, rot: 90 },
      { id: 'd4', x: 700, y: 200, rot: 0 },   // never assigned
    ],
    assign: { d1: 'st-a', d2: 'st-b', d3: 'st-c' },
  }, overrides);
}

const roster = ['Aiden Whitfield', 'Brooklyn Bell', 'Casey Nguyen'];
let L = layoutSeats(section(), roster);
eq(L.seats.length, 3, 'three assigned desks match three roster names');
eq(L.unseated, [], 'nobody is left over when the chart knows everyone');
ok(L.box && L.box.w > 0 && L.box.h > 0, 'a bounding box comes back sized to the desks actually used');
const seatA = L.seats.find(s => s.name === 'Aiden Whitfield');
ok(seatA.leftPct >= 0 && seatA.leftPct <= 100, 'a seat\'s left offset is a valid percentage');
ok(seatA.topPct >= 0 && seatA.topPct <= 100, 'and its top offset too');
ok(seatA.wPct > 0 && seatA.hPct > 0, 'and it has a nonzero size');
const seatC = L.seats.find(s => s.name === 'Casey Nguyen');
eq(seatC.rot, 90, 'a rotated desk keeps its rotation');
eq(L.seats.find(s => s.name === 'Brooklyn Bell').leftPct < seatC.leftPct, true, 'left-to-right desk order is preserved left-to-right');

/* ── mirror: reflect about the room's own bounds ─────────────────────────── */
group('layoutSeats — mirror');
const plain = layoutSeats(section(), roster, { mirror: false });
const mirrored = layoutSeats(section(), roster, { mirror: true });
const a1 = plain.seats.find(s => s.name === 'Aiden Whitfield').leftPct;
const c1 = plain.seats.find(s => s.name === 'Casey Nguyen').leftPct;
const a2 = mirrored.seats.find(s => s.name === 'Aiden Whitfield').leftPct;
const c2 = mirrored.seats.find(s => s.name === 'Casey Nguyen').leftPct;
ok(a1 < c1, 'unmirrored: Aiden (leftmost desk) sits left of Casey');
ok(a2 > c2, 'mirrored: the same pair flips left-right');
eq(mirrored.seats.find(s => s.name === 'Casey Nguyen').rot, -90, 'a rotated desk\'s rotation sign flips with the mirror too');

/* ── name matching: normalization and preferred-name fallback ───────────── */
group('layoutSeats — name matching');
const roomWithMessyName = section({
  students: [
    { id: 'st-a', name: '  aiden   WHITFIELD ' },   // same student, different case/spacing
    { id: 'st-b', name: 'Brooklyn Bell' },
    { id: 'st-c', name: 'Casey Nguyen' },
  ],
});
L = layoutSeats(roomWithMessyName, roster);
ok(L.seats.some(s => s.name === 'Aiden Whitfield'), 'case/whitespace differences still match (same normalize() as Class Roster Hub)');

const roomWithPreferredName = section({
  students: [
    { id: 'st-a', name: 'AJ' },   // the chart was labeled with what the class calls him
    { id: 'st-b', name: 'Brooklyn Bell' },
    { id: 'st-c', name: 'Casey Nguyen' },
  ],
});
const noAlt = layoutSeats(roomWithPreferredName, roster);
ok(!noAlt.seats.some(s => s.name === 'Aiden Whitfield'), 'without an alt name offered, "AJ" does not match "Aiden Whitfield"');
const withAlt = layoutSeats(roomWithPreferredName, roster, { altNames: { 'Aiden Whitfield': 'AJ' } });
ok(withAlt.seats.some(s => s.name === 'Aiden Whitfield'), 'offering the preferred name as an alt makes the same match the card display already uses');

/* ── the fallback contract: a student not in the chart never takes the ──────
   rest of the board down with it ────────────────────────────────────────── */
group('layoutSeats — "a student isn\'t in it" stays isolated');
const biggerRoster = roster.concat(['Devon Ruiz']);   // not in the chart at all
L = layoutSeats(section(), biggerRoster);
eq(L.seats.length, 3, 'the three seated students still get seats');
eq(L.unseated, ['Devon Ruiz'], 'the student the chart has never heard of comes back as unseated, not silently dropped');

const roomWithExtraStudent = section({
  students: [
    { id: 'st-a', name: 'Aiden Whitfield' },
    { id: 'st-b', name: 'Brooklyn Bell' },
    { id: 'st-c', name: 'Casey Nguyen' },
    { id: 'st-d', name: 'Someone Else Entirely' },
  ],
  desks: [
    { id: 'd1', x: 100, y: 200, rot: 0 },
    { id: 'd2', x: 300, y: 200, rot: 0 },
    { id: 'd3', x: 500, y: 200, rot: 0 },
    { id: 'd4', x: 700, y: 200, rot: 0 },
  ],
  assign: { d1: 'st-a', d2: 'st-b', d3: 'st-c', d4: 'st-d' },
});
L = layoutSeats(roomWithExtraStudent, roster);
eq(L.seats.length, 3, 'a chart student who is not on this roster simply has no seat rendered for them');
eq(L.unseated, [], 'and nobody on the roster is falsely reported unseated because of it');

/* ── the "no chart / no usable chart" cases the caller must fall back on ─── */
group('layoutSeats — empty inputs');
eq(layoutSeats(null, roster), { seats: [], unseated: roster, box: null }, 'no section at all: everyone unseated, no box — the caller\'s cue to fall back entirely');
eq(layoutSeats(section({ desks: [] }), roster), { seats: [], unseated: roster, box: null }, 'a section with no desks placed yet: same empty result');
eq(layoutSeats(section(), []), { seats: [], unseated: [], box: null }, 'an empty roster: nothing to seat, nothing left over either');
eq(layoutSeats(section({ assign: {} }), roster), { seats: [], unseated: roster, box: null }, 'desks exist but nothing is assigned to any of them yet');

/* ── duplicate desk claims: first match wins, no duplicate seat ─────────── */
group('layoutSeats — a name cannot claim two desks');
const doubleAssign = section({
  students: [
    { id: 'st-a', name: 'Aiden Whitfield' },
    { id: 'st-a2', name: 'Aiden Whitfield' },   // same normalized name, different chart id
    { id: 'st-b', name: 'Brooklyn Bell' },
    { id: 'st-c', name: 'Casey Nguyen' },
  ],
  desks: [
    { id: 'd1', x: 100, y: 200, rot: 0 },
    { id: 'd2', x: 300, y: 200, rot: 0 },
    { id: 'd3', x: 500, y: 200, rot: 0 },
    { id: 'd4', x: 700, y: 200, rot: 0 },
  ],
  assign: { d1: 'st-a', d2: 'st-a2', d3: 'st-b', d4: 'st-c' },
});
L = layoutSeats(doubleAssign, roster);
eq(L.seats.filter(s => s.name === 'Aiden Whitfield').length, 1, 'only the first matching desk claims the name — no duplicate card');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
