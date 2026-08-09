// smoke-seating.mjs — Node test for the Seating Chart Generator's pure logic and
// its save slot. No browser, no DOM.
//
//   node Tools/seating-chart/test/smoke-seating.mjs
//
// Exits 1 on any failure (locked decision #13). The browser half of the story —
// print, drag, reload, a real file picker — is test/drive-seating.mjs.

import {
  STORAGE_KEY, SCHEMA_VERSION, ROOM,
  freshState, newSection, validateState, repairState, createSeatingSlot,
  neighborMap, togetherGroups, apartMap, assignSeats, checkConstraints,
  pickNext, parseRoster, gridDesks, rowDesks, nextSpot, contentBox, snap,
} from '../seating.mjs';
import { defaultStorage } from '../../../assets/js/gvb-save.js';

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
  ok(a.sections.every(s => Array.isArray(s.students) && Array.isArray(s.desks)), 'sections start with empty arrays');
  eq(STORAGE_KEY, 'seating-chart-v1', 'storage key is seating-chart-v1');
  eq(SCHEMA_VERSION, 1, 'schema version is 1');
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:\n  ' + fails.join('\n  '));
  process.exit(1);
}
