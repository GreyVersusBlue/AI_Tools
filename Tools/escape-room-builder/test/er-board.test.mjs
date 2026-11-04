// er-board.test.mjs — pure-logic tests for er-board.js, the teacher monitor's teams, clock and
// leaderboard (Path 18 P3), and for Stations.rank(), the order it shares with 018's leaderboard.
//
//   node Tools/escape-room-builder/test/er-board.test.mjs      (or: npm run test:er-board)
//
// Both are classic scripts publishing on window, so they run in a vm context with no document.
// Deliberately broken copies of er-board.js must each make the suite fail. Exits 1 on failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(site, f), 'utf8');
const BOARD = read('Tools/escape-room-builder/er-board.js');

function load(src, stationsSrc) {
  const win = {};
  const ctx = { window: win, Math, Date, JSON, Object, Array, String, parseInt, parseFloat, isNaN, isFinite, RegExp, Error, btoa, unescape, encodeURIComponent, URL, TextEncoder };
  vm.createContext(ctx);
  vm.runInContext(read('_shared/vendor/qrcode/qrcode.js'), ctx);
  win.qrcode = ctx.qrcode;
  vm.runInContext(read('_shared/qr-draw.js'), ctx);
  vm.runInContext(read('_shared/list-sentence.js'), ctx);
  vm.runInContext(stationsSrc || read('_shared/stations.js'), ctx);
  vm.runInContext(src, ctx);
  return win;
}

function suite(src, stationsSrc) {
  const W = load(src, stationsSrc), B = W.ErBoard, S = W.Stations;
  let passed = 0; const fails = [];
  const ok = (c, l) => { if (c) passed++; else fails.push(l); };
  const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const dev = (id, extra) => ({ id, station: 0, total: 0, done: false, connected: true, score: null, ...extra });

  // Stations.rank: 018's comparator, as it was before it moved
  const r = (name, done, count, eff) => ({ name, done, count, effectiveMark: eff });
  eq(S.rank([r('a', 1, 1, 5), r('b', 3, 3, 9), r('c', 2, 2, 1)]).map(x => x.name), ['b', 'c', 'a'], 'R: more required stations first');
  eq(S.rank([r('a', 2, 2, 5), r('b', 2, 4, 9)]).map(x => x.name), ['b', 'a'], 'R: equal done, more reached first');
  eq(S.rank([r('a', 2, 2, 9), r('b', 2, 2, 5)]).map(x => x.name), ['b', 'a'], 'R: equal count, the earlier time first');
  eq(S.rank([r('a', 0, 0, null), r('b', 0, 0, 5)]).map(x => x.name), ['b', 'a'], 'R: no time goes last');
  eq(S.rank([r('a', 1, 1, 5), r('b', 1, 1, 5), r('c', 1, 1, 5)]).map(x => x.name), ['a', 'b', 'c'], 'R: ties keep their order');
  const given = [r('a', 1, 1, 5), r('b', 2, 2, 5)]; S.rank(given);
  eq(given.map(x => x.name), ['a', 'b'], 'R: the argument is left alone');

  // applyMessage
  const d = dev(1);
  B.applyMessage(d, { station: 0, id: 'abcd', total: 4, done: false }, 1000);
  eq([d.firstAt, d.lastAt, d.doneAt], [1000, 1000, null], 'A: the first message sets first and last');
  B.applyMessage(d, { station: 0, id: 'abcd', total: 4, done: false, score: 3 }, 2000);
  eq([d.lastAt, d.score], [1000, 3], 'A: a message with no progress does not move the last time');
  B.applyMessage(d, { station: 2, id: 'efgh', total: 4, done: false }, 3000);
  eq([d.lastAt, d.stationId, d.score], [3000, 'efgh', null], 'A: progress moves the last time (and a dropped score reads as none)');
  B.applyMessage(d, { station: 3, total: 4, done: true }, 4000);
  eq([d.doneAt, d.lastAt, d.stationId], [4000, 4000, null], 'A: done sets the finish time; a missing id is none');
  B.applyMessage(d, { station: 3, total: 4, done: true }, 5000);
  eq(d.doneAt, 4000, 'A: the finish time is the first one');
  B.applyMessage(d, { station: 0, total: 4, done: false }, 6000);
  eq([d.doneAt, d.lastAt], [null, 6000], 'A: a restarted room is no longer finished');

  // the record (Path 18 P4)
  const m = dev(1, { name: 'Owls', total: 3 });
  B.applyMessage(m, { station: 0, id: 'aaaa', total: 3 }, 1000);
  eq(m.marks, {}, 'M: nothing is solved on arrival');
  B.applyMessage(m, { station: 0, id: 'aaaa', total: 3, score: 1 }, 1500);
  eq(m.marks, {}, 'M: a message from the same station solves nothing');
  B.applyMessage(m, { station: 1, id: 'bbbb', total: 3 }, 2000);
  eq(m.marks, { aaaa: { at: 2000 } }, 'M: moving on solves the station left, at the monitor\'s clock');
  B.applyMessage(m, { station: 0, id: 'aaaa', total: 3 }, 2500);
  eq(m.marks, { aaaa: { at: 2000 }, bbbb: { at: 2500 } }, 'M: a team sent back to an earlier station keeps its first solve and solves the one it left');
  B.applyMessage(m, { station: 2, id: 'cccc', total: 3 }, 3000);
  eq(m.marks.aaaa, { at: 2000 }, 'M: a station solved twice keeps the first time');
  B.applyMessage(m, { station: 3, total: 3, done: true }, 4000);
  eq(m.marks.cccc, { at: 4000 }, 'M: finishing solves the last station');
  B.applyMessage(m, { station: 3, total: 3, done: true }, 4500);
  eq(Object.keys(m.marks).length, 4 - 1, 'M: a repeated done message adds nothing');
  const noId = dev(2, { total: 3 });
  B.applyMessage(noId, { station: 0, total: 3 }, 100); B.applyMessage(noId, { station: 1, total: 3 }, 200);
  eq(noId.marks, {}, 'M: a code with no station ids records nothing (it names no station)');
  B.applyMessage(m, { station: 0, id: 'aaaa', total: 3 }, 5000);
  eq(m.marks, {}, 'M: a room restarted after it finished starts its record again');

  const rec = B.toRecord([Object.assign(dev(1, { name: 'Owls' }), { marks: { aaaa: { at: 2000 }, bbbb: { at: 2500 } } }), dev(2, { name: 'Quiet' })], 1000, 9999);
  eq([rec.v, rec.at, rec.raceStartAt, rec.teams.length], [1, 9999, 1000, 1], 'T: a record holds the clock start and only the teams that solved something');
  eq(rec.teams[0], { name: 'Owls', code: '', marks: { aaaa: { at: 2000 }, bbbb: { at: 2500 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }, 'T: a team is the run shape Stations.debrief reads');
  eq(B.toRecord([], null, null).raceStartAt, null, 'T: no clock, no start');
  eq(B.cleanRecord(JSON.parse(JSON.stringify(rec))), rec, 'T: a record survives JSON');
  eq(B.cleanRecord({ v: 2, teams: [] }), null, 'T: another version is not read');
  eq(B.cleanRecord('x'), null, 'T: a string is not a record');
  eq(B.cleanRecord({ v: 1, teams: [{ name: 'a', marks: { x: { at: 'soon' }, y: { at: 5, extra: 1 } }, hintsUsed: { x: 1 } }, null, { name: 'no marks' }] }).teams,
    [{ name: 'a', code: '', marks: { y: { at: 5 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }], 'T: a stored record keeps only well-formed marks and drops what else it carried');
  const rooms = { Alpha: { stations: [{ id: 'zzzz' }] }, Beta: { stations: [{ id: 'aaaa' }, { id: 'bbbb' }] }, Gamma: { stations: [{ id: 'aaaa' }] }, Delta: { stations: [{ id: 'aaaa' }, { id: 'bbbb' }] } };
  eq(B.roomFor(rooms, rec), 'Beta', 'T: the room that holds most of the record\'s stations (a tie goes to the first)');
  eq(B.roomFor({ Alpha: rooms.Alpha }, rec), null, 'T: no room holds any: none');
  eq(B.roomFor({}, rec), null, 'T: no rooms: none');

  // the record feeds Stations.debrief unchanged
  const room = S.read({ kind: 'room', name: 'Beta', stations: [{ id: 'aaaa', clue: 'c1', answers: ['one'], next: 'bbbb' }, { id: 'bbbb', clue: 'c2', answers: ['two'] }] });
  const deb = S.debrief(room, rec);
  eq(deb.length, 1, 'D: one team');
  eq(deb[0].path.map(p => [p.id, p.sinceStartMs, p.legMs]), [['aaaa', 1000, 1000], ['bbbb', 1500, 500]], 'D: the path, from the clock the teacher started');
  eq([deb[0].finished, deb[0].misses, deb[0].hints], [true, 0, 0], 'D: all stations reached; nothing counted for tries or hints');

  // leaderboard
  const a = dev(1, { name: 'Owls', total: 4 }), b = dev(2, { name: '  ', total: 4 }), c = dev(3, { name: 'Hawks', total: 4 });
  B.applyMessage(a, { station: 2, total: 4 }, 100);
  B.applyMessage(b, { station: 3, total: 4, done: true }, 150);   // done at 150
  B.applyMessage(c, { station: 3, total: 4, done: true }, 90);    // done at 90
  let rows = B.leaderboard([a, b, c], 50);
  eq(rows.map(x => x.name), ['Hawks', 'Team 2', 'Owls'], 'L: finishers first, the earlier finish first; a blank name reads Team n');
  eq(rows.map(x => x.elapsedMs), [40, 100, null], 'L: elapsed is finish minus the teacher\'s start');
  eq(rows.map(x => x.finished), [true, true, false], 'L: finished flags');
  eq(B.leaderboard([c], null)[0].elapsedMs, null, 'L: no start, no time');
  eq(B.leaderboard([c], 95)[0].elapsedMs, null, 'L: a team that finished before the clock started has no time');
  eq(B.leaderboard([dev(9, { total: 0 })], 0)[0].finished, false, 'L: a device with no total is not finished');
  const s1 = dev(4, { total: 4, score: 7, name: 'x' }); B.applyMessage(s1, { station: 1, total: 4, score: 7 }, 10);
  eq(B.leaderboard([s1], null)[0].score, 7, 'L: the score is shown');
  const lo = dev(5, { total: 4 }), hi = dev(6, { total: 4 });
  B.applyMessage(lo, { station: 1, total: 4, score: 100 }, 10); B.applyMessage(hi, { station: 2, total: 4, score: 0 }, 20);
  eq(B.leaderboard([lo, hi], null).map(x => x.id), [6, 5], 'L: a higher score does not outrank more stations (minutes decide, score is beside it)');
  eq(B.leaderboard([], null), [], 'L: no devices, no rows');

  // H3: what a device sends is read as numbers or refused whole
  const h = dev(20, { total: 4 });
  B.applyMessage(h, { station: 1, id: 'bbbb', total: 4 }, 10);
  for (const bad of [{ station: '<img src=x onerror=alert(1)>', total: 4 }, { station: 1, total: '4<b>' }, { station: '1<b>', total: 4 },
    { station: { toString: () => 2 }, total: 4 }, { station: [2], total: 4 }, { station: 1.5, total: 4 }, { station: -1, total: 4 },
    { station: NaN, total: 4 }, { station: 1, total: Infinity }, { station: true, total: 4 }, 'x', null, [1, 4]]) {
    eq(B.applyMessage(h, bad, 20), null, 'H: refused: ' + JSON.stringify(bad));
  }
  eq([h.station, h.total, h.stationId, h.lastAt], [1, 4, 'bbbb', 10], 'H: a refused message changes nothing on the device');
  eq(B.readMessage({ station: '2', total: '4', done: 'yes', score: 'lots', id: 'x'.repeat(65) }),
    { station: 2, total: 4, done: false, id: null, score: null }, 'H: a numeric string is a number; the rest falls back to safe values');
  ok(typeof B.readMessage({ station: 0, total: 0 }).station === 'number', 'H: a station is always a number');
  eq([B.readMessage({ total: 3 }), B.readMessage({ station: null, total: 3 }), B.readMessage({ station: '', total: 3 }), B.readMessage({ station: ' 1', total: 3 })], [null, null, null, null], 'H: a missing, null, empty or padded station is refused');

  // M7: a record carried over a reload, and a team paired again as itself
  const baseRec = { v: 1, at: 1000, raceStartAt: 500, teams: [
    { name: 'Owls', code: '', marks: { aaaa: { at: 700 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 },
    { name: 'Foxes', code: '', marks: { aaaa: { at: 800 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }] };
  const back = dev(1, { kept: 0, marks: { aaaa: { at: 1900 }, bbbb: { at: 2000 } } }), fresh = dev(2, { marks: { aaaa: { at: 2100 } } });
  const merged = B.toRecord([back, fresh, dev(3)], 500, 3000, baseRec);
  eq(merged.teams.map(t => [t.name, t.marks]), [['Owls', { aaaa: { at: 700 }, bbbb: { at: 2000 } }], ['Foxes', { aaaa: { at: 800 } }], ['Team 2', { aaaa: { at: 2100 } }]],
    'R: kept teams stay, a team paired as a kept one adds to its sheet (its first solve of a station kept), new teams follow');
  eq(Object.keys(merged.teams[0].marks).join(), 'aaaa,bbbb', 'R: in order');
  eq(merged.raceStartAt, 500, 'R: the start given is the start kept');
  back.name = 'Night Owls';
  eq(B.toRecord([back], 500, 3000, baseRec).teams[0].name, 'Night Owls', 'R: a name typed on the device wins');
  eq(B.toRecord([], 500, 3000, baseRec).teams.length, 2, 'R: with no device yet, nothing kept is dropped');
  eq(B.toRecord([dev(4, { kept: 7, marks: { cccc: { at: 1 } } })], null, 1, baseRec).teams.length, 3, 'R: a kept place that is not in the record is a new team');
  eq(baseRec.teams[0].marks, { aaaa: { at: 700 } }, 'R: the kept record is not changed by a save');
  eq(B.toRecord([fresh], null, 1, null).teams.length, 1, 'R: no base, only the devices');
  eq([B.carries(baseRec, 1000 + 60000), B.carries(baseRec, 1000 + B.CARRY_MS + 1), B.carries(baseRec, 999), B.carries(null, 1)], [true, false, false, false],
    'R: a record is carried for two hours after it was kept, not from the future, and nothing is carried from nothing');
  const ch = B.rejoinChoices([dev(1, { name: 'Owls' }), dev(2, { connected: false }), dev(3, { kept: 1 })], baseRec);
  eq(ch.map(c => c.value), ['d:2', 'd:1', 'd:3', 'k:0'], 'J: the disconnected team first, then the rest, then the kept teams no device has taken');
  eq(ch.map(c => c.label), ['Team 2 (disconnected)', 'Owls (still connected)', 'Team 3 (still connected)', 'Owls (kept before this page was opened)'], 'J: labels');
  eq(B.rejoinChoices([], null), [], 'J: nothing to rejoin, no choices');

  eq(B.formatElapsed(83000), '1:23', 'F: minutes and seconds');
  eq(B.formatElapsed(3723000), '1:02:03', 'F: hours');
  eq(B.formatElapsed(-5), '0:00', 'F: never negative');
  return { passed, fails };
}

const real = suite(BOARD);
console.log(`er-board: ${real.passed} passed, ${real.fails.length} failed`);
real.fails.forEach(f => console.log('  FAIL ' + f));

const MUTANTS = [
  ['the finish time follows every done message', "if (device.done && !wasDone) device.doneAt = now;", "if (device.done) device.doneAt = now;"],
  ['a message with no progress moves the last time', "if (after !== before || typeof device.lastAt !== 'number') device.lastAt = now;", "device.lastAt = now;"],
  ['a finish before the start gets a negative time', "d.doneAt >= clockStart ? d.doneAt - clockStart : null", "true ? d.doneAt - clockStart : null"],
  ['a blank name stays blank', "(typeof d.name === 'string' && d.name.trim()) || ('Team ' + d.id)", "d.name"],
  ['a station is solved on every message', "if (wasId && (device.stationId !== wasId || (device.done && !wasDone))) {", "if (wasId) {"],
  ['a restart keeps the old record', "if (wasDone && !device.done) device.marks = {};", "if (false) device.marks = {};"],
  ['a later solve overwrites the first', "if (!device.marks[wasId]) device.marks[wasId] = { at: now };", "device.marks[wasId] = { at: now };"],
  ['a stored mark with a text time is kept', "typeof m.at === 'number' && isFinite(m.at)", "m.at !== undefined"],
  ['the room is the last one with a match', "if (n > bestN) { best = name; bestN = n; }", "if (n >= bestN && n > 0) { best = name; bestN = n; }"],
  ['a station is not checked', "var station = count(msg.station), total = count(msg.total);", "var station = msg.station || 0, total = count(msg.total);"],
  ['a total is not checked', "var station = count(msg.station), total = count(msg.total);", "var station = count(msg.station), total = msg.total || 0;"],
  ['an object is read with Number', "if (typeof v !== 'number' && !(typeof v === 'string' && /^[0-9]{1,6}$/.test(v))) return NaN;", ""],
  ['a missing count is 0', "if (typeof v !== 'number' && !(typeof v === 'string' && /^[0-9]{1,6}$/.test(v))) return NaN;", "if (v == null) return 0; if (typeof v !== 'number' && typeof v !== 'string') return NaN;"],
  ['a fraction is a count', "isFinite(n) && n >= 0 && Math.floor(n) === n ? n : NaN", "isFinite(n) && n >= 0 ? n : NaN"],
  ['a refused message still changes the device', "if (!msg) return null;\n    var before", "if (!msg) msg = { station: 0, total: 0, done: false, id: null, score: null, team: null };\n    var before"],
  ['the kept teams are dropped', "var teams = (base && Array.isArray(base.teams) ? base.teams : []).map(", "var teams = [].map("],
  ['a team paired as a kept one overwrites its first solves', "return sheet(typed || t.name, copy(copy({}, t.marks), d.marks));", "return sheet(typed || t.name, copy(copy({}, d.marks), t.marks));"],
  ['a team paired as a kept one is a second sheet', "mine.forEach(function (d) { if (!used[d.id])", "mine.forEach(function (d) { if (true)"],
  ['a record is carried for ever', "now - record.at < CARRY_MS", "true"],
  ['a kept team is offered twice', "if (devices.some(function (d) { return d.kept === i; })) return;", ""],
  ['the score ranks', "done: p, count: p,", "done: p + (typeof d.score === 'number' ? d.score : 0), count: p,"]
];
let mutantFail = 0;
for (const [label, from, to] of MUTANTS) {
  if (!BOARD.includes(from)) { console.log(`  FAIL mutant "${label}": its anchor text is gone from er-board.js, update the mutant`); mutantFail++; continue; }
  let r; try { r = suite(BOARD.replace(from, to)); } catch (e) { r = { fails: ['threw: ' + e.message] }; }
  if (!r.fails.length) { console.log(`  FAIL mutant "${label}" was not caught`); mutantFail++; }
  else console.log(`  ok   mutant "${label}" caught by ${r.fails.length} assertion(s)`);
}
{ // the shared order, broken in stations.js
  const ST = read('_shared/stations.js'), from = "if (b.count !== a.count) return b.count - a.count;\n      var an";
  if (!ST.includes(from)) { console.log('  FAIL mutant "rank ignores the count": its anchor text is gone from stations.js'); mutantFail++; }
  else {
    const r = suite(BOARD, ST.replace(from, "var an"));
    if (!r.fails.length) { console.log('  FAIL mutant "rank ignores the count" was not caught'); mutantFail++; }
    else console.log(`  ok   mutant "rank ignores the count" caught by ${r.fails.length} assertion(s)`);
  }
}
process.exit(real.fails.length || mutantFail ? 1 : 0);
