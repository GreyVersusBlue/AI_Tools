// Path 11 P4 increments 2 and 3: the lockdown maps' and door signs' content,
// sv-model.js's lockdownPages() and doorSigns(). Pure Node, no browser; the
// layout and the print preview are smoke-evacuation.mjs's.
//
// One invented two-floor building. Floor 1 has 101 (one cell, Ms. Ames, ELA),
// 102 (a 3x2 room, Ms. Ames, MATH, with a note) and 103 (no teacher); floor 2
// has 201 (Mr. Bell, a code no subject has) and floor 3 has no numbered room.
// Each case says what a sheet must say, and every rule was broken on purpose
// before it was trusted (each block's header says how).
import * as M from '../sv-model.js';

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

function grid(cols, rows) { return Array.from({ length: rows }, () => Array(cols).fill(null)); }
function building() {
  const g1 = grid(8, 4);
  g1[0][0] = { type: 'classroom', roomNumber: '101', teacher: 'Ms. Ames', dept: 'ELA' };
  for (let r = 1; r <= 2; r++) for (let c = 3; c <= 5; c++) {
    g1[r][c] = { type: 'classroom', groupId: 'grp_x', teacher: 'Ms. Ames', dept: 'MATH', roomNumber: null };
  }
  g1[1][3].roomNumber = '102';
  g1[1][3].lockdownNote = '  Blinds down; see the binder.  ';
  g1[2][4].lockdownNote = 'a stale note on a non-anchor cell';
  g1[3][7] = { type: 'classroom', roomNumber: '103' };
  g1[3][0] = { type: 'hallway' };
  const g2 = grid(4, 2);
  g2[0][1] = { type: 'classroom', roomNumber: '201', teacher: 'Mr. Bell', dept: 'ART', lockdownNote: 42 };
  const g3 = grid(2, 2);
  g3[0][0] = { type: 'hallway' };
  return {
    floors: [
      { id: 'f1', gridCols: 8, gridRows: 4, gridData: g1 },
      { id: 'f2', gridCols: 4, gridRows: 2, gridData: g2 },
      { id: 'f3', gridCols: 2, gridRows: 2, gridData: g3 },
    ],
  };
}
const NAMES = { f1: 'Floor 1', f2: 'Floor 2', f3: 'Roof' };
const settings = () => M.normalizeSettings({ modCount: 3, modLabel: 'period',
  bellSchedule: { A: [{ start: '08:00', end: '08:50' }, { start: '09:00', end: '09:50' }, null] } });

/* -- Lockdown pages. (Broken on purpose: dropping the bounds walk drew 102's
      number in one cell; keeping empty floors printed a page for the roof.) -- */
{
  const d = M.lockdownPages(building(), { floorLabel: id => NAMES[id] });
  check(d.pages.length === 2 && d.pages.map(p => p.floorName).join() === 'Floor 1,Floor 2', 'one page per floor with a numbered room, in floor order (the roof has none)');
  check(d.roomCount === 4, `every numbered room is on a page (${d.roomCount})`);
  const f1 = d.pages[0];
  check(f1.rooms.map(r => r.room).join() === '101,102,103', 'rooms on a page in room-number order');
  const r102 = f1.rooms.find(r => r.room === '102');
  check(r102.minCol === 3 && r102.maxCol === 5 && r102.minRow === 1 && r102.maxRow === 2, 'a room of several cells covers all of them, so its number is drawn over the whole room');
  check(r102.note === 'Blinds down; see the binder.', 'a room\'s note is the anchor\'s, as typed, trimmed');
  check(f1.rooms.find(r => r.room === '101').note === '' && d.pages[1].rooms[0].note === '', 'no note, or a note that is not text, is empty: nothing is made up');
  check(Object.keys(r102).sort().join() === 'maxCol,maxRow,minCol,minRow,note,room', 'a room carries its number, its cells and its note, and nothing else (no shelter mark)');
  check(M.lockdownPages({ floors: [] }).pages.length === 0 && M.lockdownPages(null).pages.length === 0, 'no floors, no pages');
}

/* -- Door signs. (Broken on purpose: grouping by room instead of teacher
      gave Ms. Ames two sets; reading modsA on a B day lost a B-only room;
      showing a B day with no B lists printed every sign twice.) -- */
{
  const groups = [
    { name: '7A', modsA: ['101', '102', ''], modsB: [] },
    { name: '7B', modsA: ['102', '', '101'], modsB: [] },
    { name: '8C', modsA: ['', '101', ''], modsB: [] },
  ];
  const d = M.doorSigns({ blueprint: building(), groups, settings: settings() });
  check(d.teachers.map(t => t.teacher).join() === 'Mr. Bell,Ms. Ames', 'one set per teacher, by name');
  check(d.signCount === 3 && d.untaught === 1, `a sign per room with a teacher (3), and the room with none counted (${d.untaught})`);
  const ames = d.teachers.find(t => t.teacher === 'Ms. Ames');
  check(ames.signs.map(s => s.room).join() === '101,102', 'a teacher\'s signs in room order');
  const s101 = ames.signs[0];
  check(s101.subject === 'English / ELA' && d.teachers[0].signs[0].subject === 'ART', 'the subject is the room\'s, by its Settings name; an unknown code prints as typed');
  check(s101.days.length === 1 && s101.days[0].label === '', 'no group has a B day: one unlabelled day');
  const mods = s101.days[0].mods;
  check(mods.map(m => m.label).join() === 'Period 1,Period 2,Period 3', 'every mod by its label');
  check(mods.map(m => m.groups.join('+')).join('|') === '7A|8C|7B', 'each mod names the group the schedule puts in this room');
  check(mods[0].time === '8:00–8:50' && mods[2].time === '', 'each mod\'s bell time, or nothing when none is set');
  check(d.teachers[0].signs[0].days[0].mods.every(m => m.groups.length === 0), 'a room no group uses has a sign with every mod empty');

  groups[1].modsB = ['', '101', ''];
  const b = M.doorSigns({ blueprint: building(), groups, settings: settings() });
  const b101 = b.teachers.find(t => t.teacher === 'Ms. Ames').signs[0];
  check(b101.days.map(x => x.label).join() === 'A day,B day', 'a group with a B day of its own gives every sign an A and a B day');
  check(b101.days[1].mods.map(m => m.groups.join('+')).join('|') === '7A|7B+8C|', 'on a B day a group with no B list is where its A list says; one with a B list follows it');

  const shared = M.doorSigns({ blueprint: building(), groups: [{ name: 'X', modsA: ['101'] }, { name: 'Y', modsA: ['101'] }], settings: settings() });
  check(shared.teachers.find(t => t.teacher === 'Ms. Ames').signs[0].days[0].mods[0].groups.join() === 'X,Y', 'two groups in one room at once are both named');
  check(M.doorSigns({ blueprint: { floors: [] }, groups: [], settings: settings() }).signCount === 0, 'no rooms, no signs');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
