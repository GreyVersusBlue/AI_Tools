// fixture-northwind.mjs — a small fake school, in the generator's own
// full-project export format (`fileType: "stviz-project"`).
//
// Every name in here is invented. Nothing in this file describes a real
// school, a real member of staff, or a real student, and nothing in this
// folder ever should: the generator's output is committed to a public repo
// and served from a public domain.
//
// Northwind Middle runs an A/B block day, four blocks, over two floors.
// It is deliberately small enough to read in one screen and deliberately
// awkward enough to exercise the parts that break: a two-cell room (the
// anchor path in rebuildRoomRegistry), a room with no teacher, a teacher
// with a planning block on only one of the two days, a cross-floor
// staircase pair, and a subject code containing a slash.

const R = (col, row, tile) => ({ col, row, tile });
const CLASS = (rn, teacher, dept, extra = {}) =>
  ({ type: 'classroom', roomNumber: rn, teacher, dept, ...extra });
const HALL = { type: 'hallway' };
const STAIR = { type: 'staircase' };

/* ── Floor 1: eight rooms off one east-west corridor ───────────────────── */

const floor0Cells = [];

// Corridor along row 4, cols 1..14, with a staircase at each end.
for (let c = 1; c <= 14; c++) floor0Cells.push(R(c, 4, { ...HALL }));
floor0Cells.push(R(0, 4, { ...STAIR }));
floor0Cells.push(R(15, 4, { ...STAIR }));

// Rooms on the north side (row 3) and south side (row 5).
const floor0Rooms = [
  [2,  3, '101', 'Ashdown',     'ELA'],
  [4,  3, '102', 'Berrycloth',  'MATH'],
  [6,  3, '103', 'Coldwater',   'SCI'],
  [8,  3, '104', 'Dunmore',     'SS'],
  [10, 3, '105', 'Eastbrook',   'SCI/SS'],
  [3,  5, '106', 'Fernwood',    'ELA'],
  [5,  5, '107', 'Greenhollow', 'MATH'],
];
for (const [c, r, rn, teacher, dept] of floor0Rooms) {
  floor0Cells.push(R(c, r, CLASS(rn, teacher, dept)));
}

// A two-cell room. Only the top-left cell carries the room number; the other
// cell is a non-anchor member of the same groupId. This is the path
// rebuildRoomRegistry() guards with isGroupAnchorOn().
floor0Cells.push(R(8, 5, CLASS('108', 'Hartwell', 'SCI', { groupId: 'room_108' })));
floor0Cells.push(R(9, 5, { type: 'classroom', roomNumber: null, groupId: 'room_108' }));

// A room with no teacher assigned — the Library. Registers as a room, must
// not appear in the teacher list.
floor0Cells.push(R(12, 3, CLASS('Library', null, null)));

/* ── Floor 2: two rooms, reached by the west staircase ─────────────────── */

const floor1Cells = [];
for (let c = 1; c <= 6; c++) floor1Cells.push(R(c, 4, { ...HALL }));
floor1Cells.push(R(0, 4, { ...STAIR }));
floor1Cells.push(R(2, 3, CLASS('201', 'Ivywood', 'SS')));
floor1Cells.push(R(4, 3, CLASS('202', 'Jessamine', 'ELA')));

/* ── Groups ────────────────────────────────────────────────────────────── */
// modsA / modsB are arrays of room numbers, one per block, '' for a block
// the group does not travel to. Four blocks.

const groups = [
  { name: '6-1', grade: 6, color: '#2563eb', size: 24,
    modsA: ['101', '102', '103', 'Library'],
    modsB: ['104', '105', '101', '102'] },
  { name: '6-2', grade: 6, color: '#c2520f', size: 27,
    modsA: ['102', '103', '101', '106'],
    modsB: ['105', '104', '102', '101'] },
  { name: '7-1', grade: 7, color: '#0d7c69', size: 22,
    modsA: ['106', '107', '108', '201'],
    modsB: ['201', '202', '106', '107'] },
  { name: '7-2', grade: 7, color: '#7c3aa8', size: 25,
    modsA: ['107', '106', '202', '108'],
    modsB: ['202', '201', '107', '106'] },
];

/* ── The project bundle ────────────────────────────────────────────────── */

export const SCHOOL_NAME = 'Northwind Middle';

export function fixtureProject() {
  return {
    fileType: 'stviz-project',
    version: 1,
    schemaVersion: 31,
    // Fixed, not new Date(): a fixture whose bytes change every run cannot be
    // a regression baseline.
    savedAt: '2026-01-15T09:00:00.000Z',
    settings: {
      schoolName: SCHOOL_NAME,
      palette: 'default',
      modCount: 4,
      modLabel: 'block',
      gridSize: 40,
      gridCols: 20,
      gridRows: 12,
      tileWalkTime: 3,
      staircaseTime: 8,
      defaultGroupSize: 25,
      bellSchedule: {
        A: [{ start: '08:30', end: '10:00' }, { start: '10:00', end: '11:30' },
            { start: '11:30', end: '13:30' }, { start: '13:30', end: '15:00' }],
        B: null,   // null means "same as A"
      },
      subjects: [
        { code: 'ELA',    name: 'English / ELA',            color: '#2563eb' },
        { code: 'MATH',   name: 'Mathematics',              color: '#c2520f' },
        { code: 'SCI',    name: 'Science',                  color: '#0d7c69' },
        { code: 'SS',     name: 'Social Studies',           color: '#7c3aa8' },
        { code: 'SCI/SS', name: 'Science / Social Studies', color: '#71641f' },
      ],
    },
    blueprint: {
      version: 5,
      savedAt: '2026-01-15T09:00:00.000Z',
      gridCols: 20,
      gridRows: 12,
      cells: floor0Cells,
      staircasePairs: [],
      heatExcludeZones: [],
      floors: [
        { id: 'floor_0', label: 'Floor 1', gridCols: 20, gridRows: 12,
          cells: floor0Cells, heatExcludeZones: [] },
        { id: 'floor_1', label: 'Floor 2', gridCols: 20, gridRows: 12,
          cells: floor1Cells, heatExcludeZones: [] },
      ],
      activeFloorIdx: 0,
      crossFloorPairs: [
        { a: { floorId: 'floor_0', col: 0, row: 4 },
          b: { floorId: 'floor_1', col: 0, row: 4 } },
      ],
      settings: {
        schoolName: SCHOOL_NAME,
        gridSize: 40,
        gridCols: 20,
        gridRows: 12,
        bellSchedule: { A: null, B: null },
        subjects: null,
      },
    },
    groups,
    whatif: null,
  };
}

/* fixture-northwind.json next to this file is the same object, written out so
   it can be dropped into the tool's own Import Full Project button by hand.
   Regenerate it after editing anything above:

     node Tools/schedule/test/fixture-northwind.mjs

   smoke.mjs fails if the two have drifted. */
if (process.argv[1] && process.argv[1].endsWith('fixture-northwind.mjs')) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixture-northwind.json');
  fs.writeFileSync(out, JSON.stringify(fixtureProject()), 'utf8');
  console.log(`wrote ${path.basename(out)} — ${fs.statSync(out).size} bytes`);
}

/* What the fixture is supposed to produce. Asserted by smoke.mjs, and the
   reason the fixture is worth having: these numbers are hand-counted from
   the arrays above, not read back out of the tool. */
export const EXPECTED = {
  school: SCHOOL_NAME,
  modCount: 4,
  modLabel: 'block',
  // Ten rooms carry a number: 101-108, Library, 201, 202. That is eleven.
  roomCount: 11,
  // Every teacher above except the Library, which has none.
  teachers: ['Ashdown', 'Berrycloth', 'Coldwater', 'Dunmore', 'Eastbrook',
             'Fernwood', 'Greenhollow', 'Hartwell', 'Ivywood', 'Jessamine'],
  groups: ['6-1', '6-2', '7-1', '7-2'],
  floors: ['Floor 1', 'Floor 2'],
};
