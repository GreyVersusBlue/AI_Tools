// smoke-seating.mjs — Node test for the Seating Chart Generator's pure logic and
// its save slot. No browser, no DOM.
//
//   node Tools/seating-chart/test/smoke-seating.mjs
//
// Exits 1 on any failure (locked decision #13). The browser half of the story —
// print, drag, reload, a real file picker — is test/drive-seating.mjs.

import {
  STORAGE_KEY, SCHEMA_VERSION, ROOM,
  freshState, newSection, newLayout, validateState, repairState, createSeatingSlot,
  neighborMap, togetherGroups, apartMap, assignSeats, checkConstraints,
  pickNext, parseRoster, gridDesks, rowDesks, nextSpot, contentBox, snap,
  QUOTA_BYTES, estimateStorageBytes, storageReport, matchPhotoFilenames,
  todayISO, suggestQuarter, seatKey, frontRowDeskIds, newHistoryEntry,
  seatHistoryMap, frontRowStatus, checkHistoryConstraints,
  studentHistoryRows, classHistorySummary,
} from '../seating.mjs';
import { defaultStorage } from '../../../_shared/gvb-save.js';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { passed++; return true; }
  failed++; fails.push(label);
  console.log('  FAIL ' + label);
  return false;
}
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const deep = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}\n       got  ${JSON.stringify(a)}\n       want ${JSON.stringify(b)}`);

/** Seeded rng so a passing run is a repeatable run. */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-memory localStorage stand-in. */
function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    __map: m,
  };
}

const NAMES28 = [
  'Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells', 'Hypatia Alexandria',
  'Sequoyah Guess', 'Nellie Bly', 'Bessie Coleman', 'Rosalind Franklin', 'Sojourner Truth',
  'Zheng He', 'Grace Hopper', 'Katsushika Hokusai', 'Wangari Maathai', 'Alan Turing',
  'Amelia Earhart', 'Benjamin Banneker', 'Clara Barton', 'Diego Rivera', 'Elena Cornaro',
  'Fatima al-Fihri', 'Garrett Morgan', 'Harriet Tubman', 'Isaac Newton', 'Jane Goodall',
  'Kwame Nkrumah', 'Lise Meitner', 'Malala Yousafzai',
];
const sectionWith = (names, desks, rng = rngFrom(7)) => {
  const s = newSection('Test', rng);
  s.students = names.map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false }));
  s.desks = desks;
  return s;
};

console.log('seating chart — pure logic\n');

/* ---------------------------------------------------------------- shape ---- */
{
  const a = freshState(rngFrom(1)), b = freshState(rngFrom(2));
  eq(a.sections.length, 3, 'freshState makes three sections');
  eq(a.active, a.sections[0].id, 'freshState activates the first section');
  ok(a.sections[0].id !== b.sections[0].id, 'freshState is a factory: two calls, different ids');
  ok(a.sections.every(s => Array.isArray(s.students) && Array.isArray(s.desks) && Array.isArray(s.layouts)), 'sections start with empty arrays, including layouts');
  eq(STORAGE_KEY, 'seating-chart-v1', 'storage key is seating-chart-v1');
  eq(SCHEMA_VERSION, 1, 'schema version is 1');
  eq(a.numbered, false, 'freshState starts unnumbered');
  eq(a.mirror, false, 'freshState starts unmirrored');
  ok(a.printNames && a.printPhotos && a.printViolations, 'freshState prints names, photos and conflicts by default');
}

/* ------------------------------------------------------------- validate ---- */
{
  ok(!validateState(null), 'validate rejects null');
  ok(!validateState({}), 'validate rejects an object with no sections');
  ok(!validateState({ sections: [] }), 'validate rejects an empty sections array');
  ok(!validateState({ sections: 'Honors' }), 'validate rejects sections that is not an array');
  ok(!validateState({ sections: [null] }), 'validate rejects a null section');
  ok(validateState(freshState()), 'validate accepts a fresh state');
  ok(!validateState({ students: [], desks: [] }), 'validate rejects a single bare section');
}

/* --------------------------------------------------------------- repair ---- */
{
  const raw = {
    active: 'nowhere',
    theme: 'neon',
    zoom: 'sideways',
    lastFirst: 'yes',
    numbered: 'yes',
    mirror: 1,
    printNames: 'no',       // junk, not the literal `false` — falls back to the true default
    printPhotos: false,     // the literal boolean — sticks
    printViolations: 0,     // junk, not the literal `false` — falls back to the true default
    sections: [
      'not a section',
      {
        name: '  Honors GT  ',
        students: [
          { id: 'a', name: 'Ada Lovelace', photo: 'data:image/jpeg;base64,AAAA' },
          { id: 'b', name: '   ' },                       // no name: dropped
          { name: 'Marco Polo' },                          // no id: generated
          { id: 'x', name: 'Zheng He', photo: 'https://evil.example/x.png' },  // not a data: URL: dropped
        ],
        apart: [['a', 'gone'], ['a', 'a'], ['a', 'x'], ['a', 'x']],
        together: [['a', 'x']],                            // also in apart: dropped
        desks: [
          { id: 'd1', x: 40, y: 110 },
          { id: 'd2', x: 'left', y: undefined },           // junk coordinates
          { id: 'd3', x: 99999, y: -400, rot: 45, locked: 'yes' },
        ],
        assign: { d1: 'a', d2: 'a', d9: 'a', d3: 'ghost' },
        layouts: [
          'not a layout',
          {
            name: '  Testing rows  ',
            desks: [{ id: 'ld1', x: 40, y: 110 }, { id: 'ld2', x: 'left', y: undefined }],
            assign: { ld1: 'a', ld2: 'a', ld9: 'a', ld1x: 'gone' },
          },
        ],
      },
    ],
  };
  const s = repairState(raw, rngFrom(3));

  eq(s.sections.length, 1, 'repair drops a non-object section');
  eq(s.sections[0].name, 'Honors GT', 'repair trims the section name');
  eq(s.sections[0].students.length, 3, 'repair drops a nameless student');
  ok(s.sections[0].students.every(st => st.id && typeof st.note === 'string' && typeof st.flag === 'boolean' && typeof st.photo === 'string'),
    'repair fills id, note, flag and photo on every student');
  eq(s.sections[0].students.find(st => st.id === 'a').photo, 'data:image/jpeg;base64,AAAA', 'repair keeps a real data: URL photo');
  eq(s.sections[0].students.find(st => st.id === 'x').photo, '', 'repair drops a photo that is not a data: URL');
  eq(s.sections[0].apart.length, 1, 'repair drops pairs pointing at removed students and dedupes');
  eq(s.sections[0].together.length, 0, 'repair drops a pair that is both apart and together');
  eq(s.active, s.sections[0].id, 'repair repoints an active id that goes nowhere');
  eq(s.theme, 'light', 'repair rejects an unknown theme');
  eq(s.zoom, 'fit', 'repair rejects an unknown zoom');
  eq(s.lastFirst, false, 'repair coerces lastFirst to a boolean');
  eq(s.numbered, false, 'repair coerces a non-boolean numbered to false (its default)');
  eq(s.mirror, false, 'repair coerces a non-boolean mirror to false (its default)');
  eq(s.printNames, true, 'a junk printNames value falls back to its true default, same as theme/zoom fall back to theirs');
  eq(s.printPhotos, false, 'repair keeps a real printPhotos:false rather than defaulting over it');
  eq(s.printViolations, true, 'a junk printViolations value falls back to its true default');

  eq(s.sections[0].layouts.length, 1, 'repair drops a non-object layout');
  const layout = s.sections[0].layouts[0];
  eq(layout.name, 'Testing rows', 'repair trims a layout name');
  ok(layout.id, 'repair generates a layout id when none is saved');
  ok(Number.isFinite(layout.desks[1].x), 'a layout desk with junk coordinates is repaired the same way a live desk is');
  deep(layout.assign, { ld1: 'a' }, 'a layout assign drops a desk that does not exist, a student seated twice, and a removed student');

  const [d1, d2, d3] = s.sections[0].desks;
  ok(Number.isFinite(d2.x) && Number.isFinite(d2.y), 'repair replaces junk desk coordinates with numbers');
  ok(d3.x <= ROOM.width - ROOM.deskW && d3.y >= 0, 'repair clamps a desk back inside the room');
  eq(d3.rot, 0, 'repair rejects a rotation that is not a quarter turn');
  eq(d3.locked, false, 'repair treats a non-boolean locked as unlocked rather than truthy');

  deep(s.sections[0].assign, { d1: 'a' }, 'repair drops seats for missing desks, missing students, and a student seated twice');

  // The bug class this exists for: a desk carrying a non-numeric coordinate must
  // not come back as a desk with no neighbours, because a desk with no
  // neighbours silently satisfies every keep-apart rule.
  const nbrs = neighborMap(s.sections[0].desks);
  ok(nbrs[d2.id].length > 0 || nbrs[d1.id].includes(d2.id),
    'a repaired desk still has neighbours (no silent constraint bypass)');

  ok(repairState(null).sections.length === 3, 'repair(null) hands back a fresh state rather than throwing');
  const twice = repairState(repairState(raw, rngFrom(3)), rngFrom(3));
  deep(twice.sections[0].assign, s.sections[0].assign, 'repair is idempotent');
}

/* ----------------------------------------------------------- neighbours ---- */
{
  const desks = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 128, y: 0 },     // 128 apart: neighbours
    { id: 'c', x: 400, y: 0 },                               // far away: nobody
  ];
  const m = neighborMap(desks);
  deep(m.a, ['b'], 'adjacent desks are neighbours');
  deep(m.c, [], 'a desk across the room has no neighbours');
  eq(neighborMap([]).length, undefined, 'neighborMap of an empty room is an empty map');

  const students = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
  const g = togetherGroups(students, [['x', 'y']]);
  eq(g.length, 2, 'union-find puts a pair in one group and the loner in another');
  ok(g.some(gr => gr.length === 2 && gr.includes('x') && gr.includes('y')), 'the pair share a group');
  const am = apartMap(students, [['x', 'z']]);
  ok(am.x.has('z') && am.z.has('x'), 'apartMap is symmetric');
}

/* --------------------------------------------------------------- solver ---- */
{
  // 30-desk grid with two pulled out: the real-shaped room from the print test.
  const desks = gridDesks(6, 5, rngFrom(11));
  desks.splice(28, 2);
  const s = sectionWith(NAMES28, desks);
  const r = assignSeats(s, { rng: rngFrom(4) });
  eq(Object.keys(r.assign).length, 28, '28 students into 28 desks seats everyone');
  eq(r.unseated.length, 0, 'nobody is left in the pool');
  eq(new Set(Object.values(r.assign)).size, 28, 'no student is seated twice');
}
{
  // Keep apart, in a room where it is satisfiable.
  const desks = [
    { id: 'd1', x: 0, y: 0 }, { id: 'd2', x: 110, y: 0 },
    { id: 'd3', x: 600, y: 0 }, { id: 'd4', x: 710, y: 0 },
  ];
  const s = sectionWith(['A', 'B', 'C', 'D'], desks);
  s.apart = [['s0', 's1']];
  const r = assignSeats(s, { rng: rngFrom(5) });
  ok(r.apartOK, 'keep-apart is honoured when the room allows it');
  eq(r.apartBroken.length, 0, 'no keep-apart violations reported');
  eq(Object.keys(r.assign).length, 4, 'all four are seated');
}
{
  // A row of ten adjacent desks, three keep-apart pairs, and ONE pass. With only
  // one pass there is no scoring to fall back on, so this pins the per-candidate
  // filter rather than the best-of-800 loop. Seeded, not retried (decision #40):
  // ten fixed seeds, every one of which must come out clean.
  const desks = Array.from({ length: 10 }, (_, i) => ({ id: 'd' + i, x: i * 110, y: 0 }));
  let clean = 0;
  for (let seed = 100; seed < 110; seed++) {
    const s = sectionWith(NAMES28.slice(0, 10), desks);
    s.apart = [['s0', 's1'], ['s2', 's3'], ['s4', 's5']];
    const r = assignSeats(s, { rng: rngFrom(seed), attempts: 1 });
    if (r.apartOK && Object.keys(r.assign).length === 10) clean++;
  }
  eq(clean, 10, 'one pass in a full row honours every keep-apart, on all ten seeds');
}
{
  // Put together.
  const desks = [
    { id: 'd1', x: 0, y: 0 }, { id: 'd2', x: 110, y: 0 },
    { id: 'd3', x: 600, y: 0 }, { id: 'd4', x: 710, y: 0 },
  ];
  const s = sectionWith(['A', 'B', 'C', 'D'], desks);
  s.together = [['s0', 's1']];
  const r = assignSeats(s, { rng: rngFrom(6) });
  ok(r.togetherOK, 'put-together seats a pair side by side');
}
{
  // A contradiction: two adjacent desks, two students who must not touch.
  const desks = [{ id: 'd1', x: 0, y: 0 }, { id: 'd2', x: 110, y: 0 }];
  const s = sectionWith(['A', 'B'], desks);
  s.apart = [['s0', 's1']];
  const r = assignSeats(s, { rng: rngFrom(7), attempts: 40 });
  eq(Object.keys(r.assign).length, 2, 'an impossible rule still produces a full chart');
  ok(!r.apartOK, 'and says the keep-apart could not be honoured');
  eq(r.apartBroken.length, 1, 'the broken pair is named');
}
{
  // More students than desks — the case the old solver could not express. It
  // gave up on constraints entirely and filled at random.
  const desks = gridDesks(3, 2, rngFrom(12));   // 6 desks
  const s = sectionWith(NAMES28, desks);
  const r = assignSeats(s, { rng: rngFrom(8) });
  eq(Object.keys(r.assign).length, 6, 'a short room seats as many as it has desks');
  eq(r.unseated.length, 22, 'the rest stay in the pool');
  ok(!Object.values(r.assign).some(sid => r.unseated.includes(sid)), 'nobody is both seated and unseated');
}
{
  // Locked desks keep their occupant through a shuffle.
  const desks = gridDesks(4, 2, rngFrom(13));
  desks[0].locked = true;
  const s = sectionWith(NAMES28.slice(0, 8), desks);
  s.assign = { [desks[0].id]: 's3' };
  const r = assignSeats(s, { rng: rngFrom(9) });
  eq(r.assign[desks[0].id], 's3', 'a pinned student does not move when the room is reshuffled');
  eq(Object.keys(r.assign).length, 8, 'the other seven are placed around the pin');
}
{
  // checkConstraints reads an assignment the teacher built by hand.
  const desks = [{ id: 'd1', x: 0, y: 0 }, { id: 'd2', x: 110, y: 0 }];
  const s = sectionWith(['A', 'B'], desks);
  s.apart = [['s0', 's1']];
  s.assign = { d1: 's0', d2: 's1' };
  const c = checkConstraints(s);
  ok(!c.apartOK, 'a hand-made chart that breaks a rule is reported');
  s.assign = { d1: 's0' };
  ok(checkConstraints(s).apartOK, 'a rule involving an unseated student is not a violation');
}

/* --------------------------------------------------------------- picker ---- */
{
  const seated = [['d1', 's1'], ['d2', 's2'], ['d3', 's3']];
  const picked = new Set();
  const got = [];
  for (let i = 0; i < 3; i++) {
    const p = pickNext(seated, picked, rngFrom(20 + i));
    got.push(p.studentId);
    picked.add(p.studentId);
    eq(p.wrapped, false, `pick ${i + 1} of 3 does not wrap`);
  }
  eq(new Set(got).size, 3, 'everyone is called once before anyone repeats');
  eq(pickNext(seated, picked, rngFrom(1)).wrapped, true, 'the fourth pick starts a new round');
  eq(pickNext([], new Set()), null, 'picking from an empty room returns null');
}

/* --------------------------------------------------------------- roster ---- */
{
  const plain = parseRoster('Ada Lovelace\nMarco Polo\n\n  Mansa Musa  \n');
  deep(plain.names, ['Ada Lovelace', 'Marco Polo', 'Mansa Musa'], 'a pasted column of names');

  const numbered = parseRoster('1. Ada Lovelace\n2) Marco Polo\n3 Mansa Musa');
  deep(numbered.names, ['Ada Lovelace', 'Marco Polo', 'Mansa Musa'], 'hand-typed numbering is stripped');

  const sheet = parseRoster('12\tLovelace, Ada\t7\n13\tPolo, Marco\t7', { lastFirst: true });
  deep(sheet.names, ['Ada Lovelace', 'Marco Polo'], 'a spreadsheet paste with an id column and Last, First');

  const keepComma = parseRoster('Lovelace, Ada');
  deep(keepComma.names, ['Lovelace, Ada'], 'without the flip, a comma is left alone');

  const dupes = parseRoster('Ada Lovelace\nada lovelace\nMarco Polo',
    { existing: ['Marco Polo'] });
  deep(dupes.names, ['Ada Lovelace'], 'duplicates inside the paste and against the roster are skipped');
  eq(dupes.duplicates.length, 2, 'and are reported back so the teacher knows');

  deep(parseRoster('').names, [], 'an empty paste adds nobody');
  deep(parseRoster('   \n\t\n').names, [], 'whitespace and a bare tab add nobody');
  deep(parseRoster('"Ada Lovelace"').names, ['Ada Lovelace'], 'wrapping quotes are stripped');
  deep(parseRoster('José Ángel Nuñez').names, ['José Ángel Nuñez'], 'accented names survive intact');
}

/* --------------------------------------------------------------- layout ---- */
{
  const g = gridDesks(6, 5, rngFrom(30));
  eq(g.length, 30, 'a 6x5 grid is 30 desks');
  ok(g.every(d => d.x >= 0 && d.x + ROOM.deskW <= ROOM.width), 'every grid desk is inside the room');
  ok(g.every(d => d.x === snap(d.x) && d.y === snap(d.y)), 'grid desks land on the snap grid');
  eq(new Set(g.map(d => d.id)).size, 30, 'every desk gets its own id');
  eq(gridDesks(99, 99, rngFrom(31)).length, 12 * 10, 'grid size is capped at 12x10');
  eq(gridDesks(0, 0, rngFrom(32)).length, 30, 'a zero grid falls back to 6x5');

  const row = rowDesks(6, g, rngFrom(33));
  eq(row.length, 6, 'a row of six is six desks');
  ok(row[0].y > Math.max(...g.map(d => d.y)), 'a new row lands below the deepest desk, not on top of it');
  eq(rowDesks(99, [], rngFrom(34)).length, 14, 'a row is capped at 14');

  const spot = nextSpot(g.slice(0, 3));
  ok(!g.slice(0, 3).some(d => d.x === spot.x && d.y === spot.y), 'nextSpot avoids occupied ground');
  ok(spot.x + ROOM.deskW <= ROOM.width, 'nextSpot stays inside the room');

  const box = contentBox([{ x: 100, y: 200 }, { x: 400, y: 300 }]);
  deep(box, { x: 100, y: 200, w: 400 + ROOM.deskW - 100, h: 300 + ROOM.deskH - 200 }, 'contentBox wraps the desks that exist');
  eq(contentBox([]).w, ROOM.width, 'contentBox on an empty floor falls back to the whole room');
}

/* --------------------------------------------------- saved layouts (MF2) ---- */
{
  const l = newLayout('Testing rows', [{ id: 'd1', x: 40, y: 110, rot: 0, locked: false }], { d1: 'a' }, rngFrom(35));
  eq(l.name, 'Testing rows', 'newLayout keeps the name given');
  ok(l.id, 'newLayout gets its own id');
  eq(l.desks[0].id, 'd1', 'newLayout copies the desks given');
  eq(l.assign.d1, 'a', 'newLayout copies the assign given');

  // A layout is a snapshot: mutating the section afterward must not reach
  // back into a saved layout, or "Save current as" would not really be a save.
  const sourceDesks = [{ id: 'd1', x: 40, y: 110, rot: 0, locked: false }];
  const sourceAssign = { d1: 'a' };
  const snap2 = newLayout('Snapshot', sourceDesks, sourceAssign, rngFrom(36));
  sourceDesks[0].x = 999;
  sourceAssign.d1 = 'b';
  eq(snap2.desks[0].x, 40, 'a saved layout does not move when the live desks move later');
  eq(snap2.assign.d1, 'a', 'a saved layout does not reseat when the live assign changes later');
}

/* -------------------------------------------------- storage usage (P12) ---- */
{
  eq(estimateStorageBytes('ab'), 4, 'estimateStorageBytes counts 2 bytes per UTF-16 code unit');
  eq(estimateStorageBytes(''), 0, 'an empty string is zero bytes');
  ok(QUOTA_BYTES > 1024 * 1024, 'the assumed quota is on the order of a few MB');

  const state = freshState(rngFrom(37));
  state.sections[0].students = [
    { id: 'a', name: 'Ada Lovelace', note: '', flag: false, photo: 'data:image/jpeg;base64,' + 'A'.repeat(1000) },
    { id: 'b', name: 'Marco Polo', note: '', flag: false, photo: '' },
  ];
  const report = storageReport(state);
  eq(report.quotaBytes, QUOTA_BYTES, 'storageReport reports against the shared quota constant');
  ok(report.totalBytes > 2000, 'storageReport counts the photo toward the total');
  eq(report.photoCount, 1, 'storageReport counts only students who actually have a photo');
  ok(report.photoBytes > 2000, 'storageReport isolates photo bytes so they can be called out separately');
  eq(report.bySection.length, 3, 'storageReport breaks the total down by section');
  eq(report.bySection[0].name, 'Honors GT', 'the per-section breakdown is named');
  ok(report.pct > 0 && report.pct < 1, 'a small chart reports well under 100% of quota');
}

/* --------------------------------------------- bulk photo import (P12/QW) ---- */
{
  const students = [
    { id: 'a', name: 'Ada Lovelace' }, { id: 'b', name: 'Marco Polo' }, { id: 'c', name: 'Mansa Musa' },
  ];
  const r = matchPhotoFilenames(
    ['Ada Lovelace.jpg', 'Lovelace, Marco (2).PNG', 'polo_marco_014.jpeg', 'nobody-here.jpg'],
    students,
  );
  // "Ada Lovelace.jpg" is an exact match for Ada. "Lovelace, Marco (2).PNG"
  // shares no full name with anyone (it is "Lovelace" + "Marco", which is
  // neither student's exact word set) so it is left for the token pass to
  // skip too — proving a partial name overlap is not treated as a match.
  ok(r.matches.some(m => m.filename === 'Ada Lovelace.jpg' && m.studentId === 'a'), 'an exact filename match finds the right student');
  ok(r.matches.some(m => m.filename === 'polo_marco_014.jpeg' && m.studentId === 'b'), 'underscores, a trailing id number and reversed word order all still match');
  ok(r.unmatched.includes('nobody-here.jpg'), 'a filename with no matching student is reported unmatched, not guessed at');
  ok(r.unmatched.includes('Lovelace, Marco (2).PNG'), 'a filename that mixes two different students\' names matches neither');
  eq(r.matches.length + r.unmatched.length, 4, 'every filename is accounted for exactly once');

  const oneEach = matchPhotoFilenames(['ada_lovelace.jpg', 'ADA LOVELACE (1).jpg'], [{ id: 'a', name: 'Ada Lovelace' }]);
  eq(oneEach.matches.length, 1, 'a student is matched at most once even if two filenames both fit');
  eq(oneEach.unmatched.length, 1, 'the second filename for an already-matched student is left unmatched rather than double-assigned');

  eq(matchPhotoFilenames([], students).matches.length, 0, 'no filenames means no matches');
  eq(matchPhotoFilenames(['x.jpg'], []).unmatched.length, 1, 'no students means everything is unmatched');
}

/* ------------------------------------------------------ save round trip ---- */
{
  const store = memStore();
  const slot = createSeatingSlot({ storage: store });
  eq(slot.key, 'seating-chart-v1', 'the slot uses the permanent key');

  const state = freshState(rngFrom(40));
  state.sections[0].students = [{ id: 'a', name: 'Ada Lovelace', note: 'front row, vision', flag: true }];
  state.sections[0].desks = gridDesks(2, 1, rngFrom(41));
  state.sections[0].assign = { [state.sections[0].desks[0].id]: 'a' };

  ok(slot.save(state), 'save reports success');
  ok(store.__map.has('seating-chart-v1'), 'the chart is written under the permanent key');
  const back = slot.load();
  ok(back, 'load returns a chart');
  eq(back.sections[0].students[0].name, 'Ada Lovelace', 'the roster came back');
  eq(back.sections[0].students[0].note, 'front row, vision', 'the note came back');
  eq(back.sections[0].assign[state.sections[0].desks[0].id], 'a', 'the seat came back');
  eq(back.sections.length, 3, 'all three sections came back');
  ok(!('__v' in back), 'the version stamp is stripped from loaded state');

  // Corrupt storage is refused, not parsed into the page.
  store.setItem('seating-chart-v1', 'this is not json');
  eq(slot.load(), null, 'a corrupt blob loads as null');
  store.setItem('seating-chart-v1', '{"sections":"Honors"}');
  eq(slot.load(), null, 'a plausible-looking blob that fails validate loads as null');
  store.setItem('seating-chart-v1', '{"sections":[]}');
  eq(slot.load(), null, 'a chart with no sections loads as null');
  store.removeItem('seating-chart-v1');
  eq(slot.load(), null, 'an empty key loads as null');

  // Export / import envelope.
  const text = slot.serialize(state);
  const env = JSON.parse(text);
  eq(env.format, 'gvb-save', 'an export carries the envelope format');
  eq(env.game, 'seating-chart', 'an export is stamped with the game slug');
  eq(env.version, 1, 'an export carries the schema version');
  const imported = slot.deserialize(text);
  ok(imported, 'a file exported by this build imports again');
  eq(imported.sections[0].students[0].name, 'Ada Lovelace', 'the imported roster is intact');

  eq(slot.deserialize('{'), null, 'a truncated file is refused');
  eq(slot.deserialize('{"format":"gvb-save","game":"closing-time","version":1,"state":{"sections":[{}]}}'), null,
    'a save file from another tool on the site is refused');
  eq(slot.deserialize(JSON.stringify({ format: 'gvb-save', game: 'seating-chart', version: 1, state: { sections: 'no' } })), null,
    'an envelope wrapped round garbage is refused');

  // The build before this one had its own "Save file" button that wrote the bare
  // state with no envelope and no version stamp. Those files are on teachers'
  // computers now, so they have to keep opening: normalize reads them as version
  // 0 and repair fills in everything added since.
  const legacy = JSON.stringify({
    sections: [{
      id: 'old1', name: 'Old Honors',
      students: [{ id: 'z', name: 'Zheng He', note: 'front row', flag: true }],
      apart: [], together: [],
      desks: [{ id: 'od1', x: 40, y: 110 }],        // no rot, no locked
      assign: { od1: 'z' },
    }],
    active: 'gone',
    theme: 'dark',
  });
  const old = slot.deserialize(legacy);
  ok(old, 'a file saved by the previous build still opens (version 0 path)');
  eq(old.sections[0].students[0].name, 'Zheng He', 'its roster survives');
  eq(old.sections[0].students[0].note, 'front row', 'its notes survive');
  eq(old.sections[0].assign.od1, 'z', 'its seating survives');
  eq(old.sections[0].desks[0].rot, 0, 'a desk from before rotation existed gets rot 0, not undefined');
  eq(old.sections[0].desks[0].locked, false, 'and locked false, not undefined');
  eq(old.theme, 'dark', 'its dark mode survives');
  eq(old.zoom, 'fit', 'and the zoom setting it never had gets a default');
  eq(old.active, old.sections[0].id, 'and its dangling active id is repaired');

  // reset() clears the key and hands back something usable.
  slot.save(state);
  const afterReset = slot.reset();
  eq(store.getItem('seating-chart-v1'), null, 'reset erases the key');
  eq(afterReset.sections.length, 3, 'reset hands back a fresh set of sections');
  ok(afterReset.sections[0].id !== state.sections[0].id, 'reset is a factory call, not the same object again');
  ok(afterReset.sections[0].students.length === 0, 'reset really is empty');
}

/* --------------------------------------------- storage blocked entirely ---- */
{
  // Chrome with site data blocked does not fail on setItem — reading the
  // `localStorage` property itself throws. Simulate that exactly.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError: storage is blocked'); },
  });
  try {
    const store = defaultStorage();
    ok(store.__memoryOnly, 'defaultStorage falls back to memory when the property throws');
    const slot = createSeatingSlot({ storage: store });
    ok(slot.memoryOnly, 'the slot knows it is memory-only, so the page can warn');
    const state = freshState(rngFrom(50));
    state.sections[0].students = [{ id: 'a', name: 'Ada Lovelace', note: '', flag: false }];
    ok(slot.save(state), 'saving still succeeds in memory');
    eq(slot.load().sections[0].students[0].name, 'Ada Lovelace', 'and loads back within the session');

    // And the reason the page passes `storage` explicitly instead of letting the
    // module probe: createSaveSlot's own `typeof localStorage` guard throws here.
    // Shared-file request is in the notes.
    let threw = false;
    try { createSeatingSlot(); } catch (e) { threw = true; }
    ok(threw, 'createSaveSlot without an explicit storage throws in this configuration (gvb-save gap)');
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
}

/* ================================================================
   Seating history and rotation — "not the same seat twice" and
   "front row once per quarter" as real, printable-evidence constraints.
================================================================ */

/* -------------------------------------------------- shape / defaults ---- */
{
  const s = newSection('Test', rngFrom(60));
  deep(s.history, [], 'a fresh section starts with no recorded history');
  const state = freshState(rngFrom(61));
  ok(typeof state.currentQuarter === 'string' && state.currentQuarter, 'freshState guesses a starting quarter');
}

/* ------------------------------------------------------ suggestQuarter --- */
{
  eq(suggestQuarter('2026-09-01'), 'Q1', 'September is Q1');
  eq(suggestQuarter('2026-10-31'), 'Q1', 'October is Q1');
  eq(suggestQuarter('2026-11-15'), 'Q2', 'November is Q2');
  eq(suggestQuarter('2026-12-25'), 'Q2', 'December is Q2');
  eq(suggestQuarter('2027-01-10'), 'Q2', 'January is Q2');
  eq(suggestQuarter('2026-02-20'), 'Q3', 'February is Q3');
  eq(suggestQuarter('2026-03-15'), 'Q3', 'March is Q3');
  eq(suggestQuarter('2026-05-01'), 'Q4', 'May is Q4');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(todayISO()), 'todayISO returns a plain YYYY-MM-DD string');
}

/* ---------------------------------------------------- seatKey / front row --- */
{
  const desks = gridDesks(3, 2, rngFrom(70));   // 3 cols x 2 rows: desks 0-2 are the front row
  const front = frontRowDeskIds(desks);
  eq(front.length, 3, 'the front row is exactly one row of desks');
  ok(front.includes(desks[0].id) && front.includes(desks[1].id) && front.includes(desks[2].id),
    'the front row is the three desks closest to the board');
  ok(!front.includes(desks[3].id), 'the second row is not the front row');
  eq(seatKey(desks[0]), seatKey({ id: 'other', x: desks[0].x, y: desks[0].y }),
    'seatKey identifies a seat by its room position, not its desk id');
  ok(seatKey(desks[0]) !== seatKey(desks[1]), 'two different desks have different seat keys');
}

/* ---------------------------------------- recording, repeats, front row --- */
{
  const desks = gridDesks(3, 2, rngFrom(71));   // desks[0..2] front, desks[3..5] back
  const s = sectionWith(NAMES28.slice(0, 6), desks, rngFrom(71));
  const [d0, d1, d2, d3, d4, d5] = desks;

  // Unit 1: s0/s1/s2 in front, s3/s4/s5 in back.
  s.assign = { [d0.id]: 's0', [d1.id]: 's1', [d2.id]: 's2', [d3.id]: 's3', [d4.id]: 's4', [d5.id]: 's5' };
  const entry1 = newHistoryEntry(s, { date: '2026-08-01', label: 'Unit 1', quarter: 'Q1' }, rngFrom(72));
  s.history.push(entry1);
  eq(entry1.students.length, 6, 'a recorded entry caches the roster names at the time');
  eq(Object.keys(entry1.assign).length, 6, 'a recorded entry snapshots the full assignment');

  // Unit 2: s0 keeps the SAME seat (repeat); front row rotates to s0/s3/s4.
  s.assign = { [d0.id]: 's0', [d1.id]: 's3', [d2.id]: 's4', [d3.id]: 's1', [d4.id]: 's5', [d5.id]: 's2' };
  const entry2 = newHistoryEntry(s, { date: '2026-08-08', label: 'Unit 2', quarter: 'Q1' }, rngFrom(73));
  s.history.push(entry2);

  // What's actually on the floor right now (not yet recorded): a THIRD
  // arrangement, built so only s0 (who has now had d0 twice) repeats one of
  // their own past seats, and the due student (s5, see below) is back-row
  // again rather than accidentally already covered by this arrangement.
  s.assign = { [d0.id]: 's0', [d1.id]: 's2', [d2.id]: 's1', [d3.id]: 's5', [d4.id]: 's3', [d5.id]: 's4' };

  const seatHist = seatHistoryMap(s.history);
  ok(seatHist.s0.has(seatKey(d0)), 's0 shows up as having sat at d0');
  eq(seatHist.s0.size, 1, 's0 sat at exactly one distinct seat across both units (it repeated)');
  eq(seatHist.s1.size, 2, 's1 sat at two distinct seats (no repeat)');

  const status = frontRowStatus(s, 'Q1');
  const dueNames = [...status.dueIds].sort();
  deep(dueNames, ['s5'], 'only the student never seated in front this quarter is due');

  const hc = checkHistoryConstraints(s, 'Q1');
  deep(hc.repeats.map(r => r.studentId), ['s0'], 'the live floor flags exactly the repeated seat');
  deep(hc.dueUnseated.map(d => d.studentId), ['s5'], "and flags the one student the live floor doesn't cover");

  eq(checkHistoryConstraints(s, '').dueUnseated.length, 0, 'an empty quarter skips the front-row half of the report');

  // The bug this guards: `currentQuarter` always has a default value (see
  // freshState), so a section that has never recorded anything must not
  // report students as "due" just because a quarter happens to be set —
  // that would nag every teacher who has never touched this feature, and it
  // did, once, until the gate below existed.
  const untouched = newSection('Untouched', rngFrom(74));
  untouched.students = s.students;
  untouched.desks = desks;
  untouched.assign = s.assign;
  eq(checkHistoryConstraints(untouched, 'Q1').dueUnseated.length, 0,
    'a section with zero recorded history reports nobody as overdue, even with a quarter set');

  const rowsS0 = studentHistoryRows(s, 's0');
  eq(rowsS0.length, 2, "s0's report has one row per recorded unit they were seated in");
  eq(rowsS0[0].frontRow, true, 'front row is read from that entry, not the live floor');
  eq(rowsS0[0].repeat, false, 'the first time in a seat is never a repeat');
  eq(rowsS0[1].repeat, true, 'the second time in the SAME seat is flagged as a repeat');

  const rowsS5 = studentHistoryRows(s, 's5');
  eq(rowsS5.length, 2, "s5's report also has two rows");
  ok(rowsS5.every(r => r.frontRow === false), 's5 never had a front-row row, matching the due check above');
  ok(rowsS5.every(r => r.repeat === false), 's5 never repeated a seat');

  const summary = classHistorySummary(s, 'Q1');
  const bySid = Object.fromEntries(summary.map(r => [r.studentId, r]));
  eq(bySid.s0.total, 2, "s0's summary counts both recorded units");
  eq(bySid.s0.repeats, 1, "s0's summary counts the one repeated seat");
  eq(bySid.s0.frontRowThisQuarter, 2, 's0 had front row both units');
  eq(bySid.s5.frontRowThisQuarter, 0, "s5's summary agrees with the due check: zero front-row units");
  ok(summary.every(r => r.total === 2), 'everyone on the roster shows up with both recorded units counted');
}

/* -------------------------------- assignSeats: the two solver nudges ---- */
{
  // Nudge 1 (no repeat seat): lock every other student down so only the
  // repeat-history student is left to place, between their old seat and one
  // fresh one — deterministic regardless of rng, since after the no-repeat
  // filter only one candidate desk remains.
  const oldSeat = { id: 'old', x: 0, y: 0 };
  const freshSeat = { id: 'fresh', x: 300, y: 0 };
  const lockedSeat = { id: 'locked', x: 600, y: 0, locked: true };
  const s = newSection('Repeat nudge', rngFrom(80));
  s.students = [{ id: 's0', name: 'A' }, { id: 's1', name: 'B' }];
  s.desks = [oldSeat, freshSeat, lockedSeat];
  s.assign = { locked: 's1' };   // s1 is pinned at the locked desk; s0 is the only one to place
  s.history = [newHistoryEntry(
    { desks: [oldSeat], assign: { old: 's0' }, students: s.students },
    { date: '2026-08-01', label: 'Unit 1', quarter: 'Q1' }, rngFrom(81),
  )];
  for (let seed = 1; seed <= 5; seed++) {
    const r = assignSeats(s, { rng: rngFrom(seed), attempts: 1 });
    eq(r.assign.fresh, 's0', `seed ${seed}: the repeat-history student takes the fresh seat, not the old one`);
    eq(r.assign.old, undefined, `seed ${seed}: the old seat is left empty rather than reused`);
  }

  // Nudge 2 (front row once per quarter): same trick — lock everyone else
  // down, leaving the overdue student a choice between one front-row desk
  // and one back-row desk.
  const front = { id: 'front', x: 0, y: 0 };
  const back = { id: 'back', x: 0, y: 300 };
  const takenFront = { id: 'takenFront', x: 200, y: 0, locked: true };
  const s2 = newSection('Front-row nudge', rngFrom(82));
  s2.students = [{ id: 's0', name: 'A' }, { id: 's1', name: 'B' }];
  s2.desks = [front, back, takenFront];
  s2.assign = { takenFront: 's1' };
  // s0 has one prior front-row appearance this quarter, so it isn't "due";
  // s1 has none — but s1 is locked in place, so the due student left to
  // place is s0 only if we make s0 the due one instead. Flip it: give s1
  // (the locked student) the prior front-row credit, leaving s0 overdue.
  s2.history = [newHistoryEntry(
    { desks: [{ id: 'x', x: 0, y: 0 }], assign: { x: 's1' }, students: s2.students },
    { date: '2026-08-01', label: 'Unit 1', quarter: 'Q1' }, rngFrom(83),
  )];
  for (let seed = 1; seed <= 5; seed++) {
    const r = assignSeats(s2, { rng: rngFrom(seed), attempts: 1, quarter: 'Q1' });
    eq(r.assign.front, 's0', `seed ${seed}: the student overdue for front row gets the free front desk`);
  }
  // Without a quarter, the nudge is off — assignSeats behaves as it always
  // has, i.e. it does NOT reach for frontRowStatus/quarter logic at all.
  const rNoQuarter = assignSeats(s2, { rng: rngFrom(1), attempts: 1 });
  eq(Object.keys(rNoQuarter.assign).length, 2, 'omitting quarter still seats both students normally');
}

/* -------------------------------------------------------- repair: history --- */
{
  const raw = {
    sections: [{
      name: 'Room',
      students: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Marco' }],
      desks: [{ id: 'd1', x: 40, y: 110 }, { id: 'd2', x: 150, y: 110 }],
      assign: { d1: 'a' },
      history: [
        'not an entry',
        {
          date: 'not-a-date',
          label: '  Unit 1  ',
          quarter: '',
          desks: [{ id: 'hd1', x: 40, y: 110 }, { id: 'hd2', x: 'junk', y: undefined }],
          assign: { hd1: 'a', hd9: 'a', hd2: 'gone-student' },
          students: [{ id: 'a', name: 'Ada' }, { id: 'ghost' }, { name: 'no id' }],
        },
      ],
    }],
  };
  const repaired = repairState(raw, rngFrom(90));
  const hist = repaired.sections[0].history;
  eq(hist.length, 1, 'repair drops a non-object history entry');
  eq(hist[0].label, 'Unit 1', 'repair trims a history entry label');
  ok(hist[0].id, 'repair generates a history entry id when none is saved');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(hist[0].date), 'repair replaces an unparseable date with a real one');
  eq(hist[0].quarter, suggestQuarter(hist[0].date), 'an empty quarter falls back to the calendar guess');
  ok(Number.isFinite(hist[0].desks[1].x) && Number.isFinite(hist[0].desks[1].y),
    'a history desk with junk coordinates is repaired the same way a live desk is');
  deep(hist[0].assign, { hd1: 'a' }, 'a history assign drops a desk that does not exist and an unnamed student id');
  eq(hist[0].students.length, 1, 'repair drops a nameless or idless student from the name cache');

  const twice = repairState(repairState(raw, rngFrom(90)), rngFrom(90));
  deep(twice.sections[0].history[0].assign, hist[0].assign, 'repairing history is idempotent');

  ok(validateState({ sections: [{ students: [], desks: [], history: 'not an array' }] }),
    'validateState does not inspect history shape at all — repair is where a junk value gets cleaned up');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:\n  ' + fails.join('\n  '));
  process.exit(1);
}
