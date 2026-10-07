// smoke-teams-core.mjs — team / house points arithmetic, in pure Node.
//
//   node Tools/behavior-points-tracker/test/smoke-teams-core.mjs
//
// teams.js decides what a house total is, and a house total is read aloud to a
// class: every tap counts for the student's team once, an undo takes it off the
// same team, an archive keeps the totals, a reset zeroes only the teams, and a
// section that never made a team is never given a field. TEAMS_FILE points the
// suite at another copy of the module (the deliberate-break runs use it).
// Every name is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.TEAMS_FILE || path.join(here, '..', 'teams.js');
await import(pathToFileURL(file).href);
const T = globalThis.BPTeams;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

console.log('Teams — arithmetic, standings, deal, reset');

/* 1. A section with no teams is never touched. */
const plain = { name: 'P3', points: { Ann: 2 }, log: [] };
const before = JSON.stringify(plain);
T.normalize(plain);
eq(JSON.stringify(plain), before, 'normalize leaves a section with no teams byte for byte');
eq(T.award(plain, 'Ann', 3), null, 'a tap in a section with no teams counts for nobody');
T.unaward(plain, { team: 'tm1', delta: 1 }); T.archiveDay(plain); T.clearDay(plain); T.resetTotals(plain);
eq(JSON.stringify(plain), before, 'award, unaward, archive, clear and reset add no field to a section with no teams');
same(T.standings(plain), [], 'no teams, no standings');
eq(T.active(plain), false, 'no teams is not active');

/* 2. Adding and removing teams. */
const s = { name: 'P3' };
const a = T.addTeam(s, 'Falcons');
eq(a.id, 'tm1', 'first id');
eq(T.active(s), false, 'one team is not enough for a board');
const b = T.addTeam(s, '  Herons  ');
eq(b.name, 'Herons', 'a name is trimmed');
eq(T.active(s), true, 'two teams make a board');
ok(a.color && b.color && a.color !== b.color, 'each new team takes a colour no team has');
const long = T.addTeam(s, 'X'.repeat(60));
eq(long.name.length, 24, 'a long name is cut to 24 letters');
eq(T.NAME_MAX, 24, 'the limit is 24');
eq(T.addTeam(s, '').name, 'Team 4', 'an empty name gets a numbered default');
for (let i = 0; i < 4; i++) T.addTeam(s, 'T' + i);
eq(s.teams.length, 8, 'eight teams');
eq(T.addTeam(s, 'Ninth'), null, 'a ninth team is refused');
eq(s.teams.length, 8, 'and not added');
T.removeTeam(s, 'tm3');
eq(T.addTeam(s, 'Again').id, 'tm3', 'a freed id is reused, never one in use');
same(s.teams.map(t => t.id), ['tm1', 'tm2', 'tm4', 'tm5', 'tm6', 'tm7', 'tm8', 'tm3'], 'the new team goes last');

/* 3. A tap counts for the student's team; an undo takes it off the same one. */
const g = { name: 'P3' };
const red = T.addTeam(g, 'Reds'), blue = T.addTeam(g, 'Blues');
T.setTeamOf(g, 'Ann Lee', red.id);
T.setTeamOf(g, 'Bo Park', blue.id);
eq(T.award(g, 'Ann Lee', 2), 'tm1', 'a tap returns the team it counted for');
eq(T.award(g, 'Bo Park', -1), 'tm2', 'a negative tap too');
eq(T.award(g, 'Cy Roe', 5), null, 'a student with no team counts for nobody');
eq(T.totalOf(g, 'tm1'), 2, 'red has 2');
eq(T.totalOf(g, 'tm2'), -1, 'blue has -1');
eq(T.award(g, 'Ann Lee', 1.5), null, 'a fractional tap is refused');
eq(T.totalOf(g, 'tm1'), 2, 'and changes nothing');
T.setTeamOf(g, 'Ann Lee', blue.id);          // moved after the tap
T.unaward(g, { team: 'tm1', delta: 2 });     // the entry says tm1
eq(T.totalOf(g, 'tm1'), 0, 'an undo takes the points off the team the entry was stamped with');
eq(T.totalOf(g, 'tm2'), -1, 'and not off the team the student is on now');
eq(T.unaward(g, { delta: 2 }), false, 'an entry with no team stamp takes nothing off');
eq(T.unaward(g, { team: 'gone', delta: 2 }), false, 'an entry for a removed team takes nothing off');
eq(T.setTeamOf(g, 'Dee', 'gone'), false, 'a student cannot be put on a team that is not there');
T.setTeamOf(g, 'Ann Lee', '');
ok(!('Ann Lee' in g.teamOf), 'an empty team takes a student off');
g.teamOf.Zed = 'gone';                       // a stale assignment that never went through normalize
eq(T.award(g, 'Zed', 4), null, 'a tap for a student whose team is gone counts for nobody');
ok(!('gone' in g.teamDay), 'and invents no total for it');

/* 4. Direct points, undo of a direct award, the log. */
const d = { name: 'P3' };
T.addTeam(d, 'Reds'); T.addTeam(d, 'Blues');
const e1 = T.give(d, 'tm1', 3, '  Quiet line ', '9:00 AM', 'g1');
eq(e1.label, 'Quiet line', 'the reason is trimmed');
eq(T.totalOf(d, 'tm1'), 3, 'a direct award counts');
eq(T.give(d, 'tm1', 0, '', '', 'g2'), null, '0 is refused');
eq(T.give(d, 'tm1', 1.5, '', '', 'g2'), null, 'a fraction is refused');
eq(T.give(d, 'nope', 1, '', '', 'g2'), null, 'a team that is not there is refused');
T.give(d, 'tm2', -2, '', '9:05 AM', 'g3');
eq(T.totalOf(d, 'tm2'), -2, 'a direct award can be negative');
same(d.teamLog.map(x => x.id), ['g3', 'g1'], 'newest first');
eq(T.undoGive(d, 'g1'), true, 'undo a direct award');
eq(T.totalOf(d, 'tm1'), 0, 'its points come off');
eq(T.undoGive(d, 'g1'), false, 'it cannot be undone twice');
eq(T.totalOf(d, 'tm1'), 0, 'and the second try changes nothing');
for (let i = 0; i < 60; i++) T.give(d, 'tm1', 1, '', '', 'x' + i);
eq(d.teamLog.length, 50, 'the direct log is capped');
eq(T.totalOf(d, 'tm1'), 60, 'the cap never loses points');

/* 5. Archive keeps the totals; clear-day drops only today; reset zeroes the teams. */
const h = { name: 'P3', points: { Ann: 4 } };
T.addTeam(h, 'Reds'); T.addTeam(h, 'Blues');
T.setTeamOf(h, 'Ann', 'tm1');
T.award(h, 'Ann', 4); T.give(h, 'tm2', 3, '', '', 'g1');
T.archiveDay(h);
eq(T.totalOf(h, 'tm1'), 4, 'archive keeps red total');
eq(T.totalOf(h, 'tm2'), 3, 'archive keeps blue total');
eq(h.teamLog.length, 0, 'archive files the direct log');
eq(h.teamDay.tm1, 0, 'today starts again at 0');
T.award(h, 'Ann', 1); T.archiveDay(h);
eq(T.totalOf(h, 'tm1'), 5, 'a second archive adds to the bank, it does not replace it');
T.award(h, 'Ann', -1); T.archiveDay(h);
eq(T.totalOf(h, 'tm1'), 4, 'and a third takes a bad day off it');
T.award(h, 'Ann', 2); T.give(h, 'tm2', 1, '', '', 'g2');
eq(T.totalOf(h, 'tm1'), 6, 'today adds to the bank');
T.clearDay(h);
eq(T.totalOf(h, 'tm1'), 4, 'undo the whole day drops only today (red)');
eq(T.totalOf(h, 'tm2'), 3, 'undo the whole day drops only today (blue)');
same(h.points, { Ann: 4 }, 'no team function reads or writes student points');
T.award(h, 'Ann', 1);
T.resetTotals(h);
eq(T.totalOf(h, 'tm1') + T.totalOf(h, 'tm2'), 0, 'reset zeroes every team, bank and today');
eq(h.teams.length, 2, 'reset keeps the teams');
eq(h.teamOf.Ann, 'tm1', 'reset keeps who is on them');
same(h.points, { Ann: 4 }, 'reset leaves the students alone');
T.give(h, 'tm1', 2, '', '', 'g9');
T.removeTeam(h, 'tm1');
ok(!('Ann' in h.teamOf), 'removing a team puts its students back to none');
ok(!('tm1' in h.teamBank) && !('tm1' in h.teamDay), 'and drops its totals');
eq(h.teamLog.length, 0, 'and its direct log');
eq(T.totalOf(h, 'tm1'), 0, 'a removed team totals 0');
eq(T.removeTeam(h, 'tm1'), false, 'removing it twice is refused');

/* 6. Standings: ranks, ties, the lead, and the cue in words. */
const st = { name: 'P3' };
['Reds', 'Blues', 'Greens', 'Golds'].forEach(n => T.addTeam(st, n));
same(T.standings(st).map(r => r.lead), ['', '', '', ''], 'nobody leads while every total is 0');
same(T.standings(st).map(r => r.cue), ['Tied for 1st', 'Tied for 1st', 'Tied for 1st', 'Tied for 1st'], 'all at 0 is one big tie');
T.give(st, 'tm2', 5, '', '', 'a'); T.give(st, 'tm3', 3, '', '', 'b'); T.give(st, 'tm4', 3, '', '', 'c'); T.give(st, 'tm1', -1, '', '', 'd');
let rows = T.standings(st);
same(rows.map(r => r.name), ['Blues', 'Greens', 'Golds', 'Reds'], 'best first, a tie in team order');
same(rows.map(r => r.rank), [1, 2, 2, 4], 'competition ranks: 1, 2, 2, 4');
same(rows.map(r => r.cue), ['1st', 'Tied for 2nd', 'Tied for 2nd', '4th'], 'cues in words');
same(rows.map(r => r.lead), ['sole', '', '', ''], 'one sole leader');
T.give(st, 'tm1', 6, '', '', 'e');
rows = T.standings(st);
same(rows.map(r => r.lead), ['tied', 'tied', '', ''], 'two at the top are tied for the lead');
same(rows.map(r => r.cue).slice(0, 2), ['Tied for 1st', 'Tied for 1st'], 'and say so');
same(rows.map(r => r.name).slice(0, 2), ['Reds', 'Blues'], 'a tie keeps team order');
const neg = { name: 'P3' };
T.addTeam(neg, 'A'); T.addTeam(neg, 'B'); T.addTeam(neg, 'C');
T.give(neg, 'tm1', 4, '', '', 'a'); T.give(neg, 'tm2', -2, '', '', 'b'); T.give(neg, 'tm3', -5, '', '', 'c');
same(T.standings(neg).map(r => r.total), [4, -2, -5], 'negatives show by default');
same(T.standings(neg, { hideNegative: true }).map(r => r.total), [4, 0, 0], 'hideNegative floors every total at 0');
same(T.standings(neg, { hideNegative: true }).map(r => r.cue), ['1st', 'Tied for 2nd', 'Tied for 2nd'], 'and ranks on what is shown');
const allNeg = { name: 'P3' };
T.addTeam(allNeg, 'A'); T.addTeam(allNeg, 'B');
T.give(allNeg, 'tm1', -1, '', '', 'a');
same(T.standings(allNeg).map(r => r.lead), ['sole', ''], 'a team ahead of a worse total leads even below 0');
same(T.standings(allNeg, { hideNegative: true }).map(r => r.lead), ['', ''], 'but nobody leads while every shown total is 0');
const lone = { name: 'P3' };
T.addTeam(lone, 'Solo'); T.give(lone, 'tm1', 5, '', '', 'a');
same(T.standings(lone).map(r => r.lead), [''], 'a lone team has nothing to lead');
eq(T.ordinal(1), '1st', 'ordinal 1'); eq(T.ordinal(2), '2nd', 'ordinal 2'); eq(T.ordinal(3), '3rd', 'ordinal 3');
eq(T.ordinal(4), '4th', 'ordinal 4'); eq(T.ordinal(11), '11th', 'ordinal 11'); eq(T.ordinal(12), '12th', 'ordinal 12');
eq(T.ordinal(13), '13th', 'ordinal 13'); eq(T.ordinal(21), '21st', 'ordinal 21'); eq(T.ordinal(22), '22nd', 'ordinal 22');

/* 7. The even, seeded deal. */
const names = ['Ann Lee', 'Bo Park', 'Cy Roe', 'Dee Fay', 'Eli Moss', 'Fay Dunn', 'Gus Hill', 'Hal Ives', 'Ida Joy', 'Jon Kerr', 'Kai Lund'];
const ids = ['tm1', 'tm2', 'tm3'];
const dl = T.deal(names, ids, 7);
eq(Object.keys(dl).length, 11, 'everyone is dealt');
const sizes = ids.map(i => Object.values(dl).filter(v => v === i).length);
ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `sizes differ by at most one (${sizes})`);
same(sizes.slice().sort(), [3, 4, 4], '11 across 3 is 4, 4, 3');
same(T.deal(names, ids, 7), dl, 'the same seed gives the same teams');
same(T.deal(names.slice().reverse(), ids, 7), dl, 'the order the names come in makes no difference');
ok(JSON.stringify(T.deal(names, ids, 8)) !== JSON.stringify(dl), 'another seed gives another deal');
ok(JSON.stringify(T.deal(names, ids, 9)) !== JSON.stringify(T.deal(names, ids, 8)), 'and another');
same(T.deal(['Ann', 'Ann', 'Bo'], ['tm1', 'tm2'], 1), T.deal(['Ann', 'Bo'], ['tm1', 'tm2'], 1), 'a name twice on the roster is dealt once');
same(T.deal([], ids, 1), {}, 'nobody to deal');
eq(Object.keys(T.deal(names, [], 1)).length, 0, 'no teams to deal to');
eq(Object.keys(T.deal(['Solo'], ids, 1)).length, 1, 'one student is dealt');
same(T.deal(names, ['tm1', 'tm2'], 3), T.deal(names, ['tm1', 'tm2'], 3), 'two teams, repeatable');
/* Fair: over many seeds a student is as likely to land on either of two teams,
   and two students share a team a third of the time (4 names, 2 teams). */
const four = ['A', 'B', 'C', 'D'];
let aOnOne = 0, abTogether = 0;
const RUNS = 3000;
for (let sd = 1; sd <= RUNS; sd++) {
  const x = T.deal(four, ['tm1', 'tm2'], sd);
  if (x.A === 'tm1') aOnOne++;
  if (x.A === x.B) abTogether++;
}
ok(aOnOne / RUNS > 0.45 && aOnOne / RUNS < 0.55, `a student lands on either team about half the time (${(aOnOne / RUNS).toFixed(3)})`);
ok(abTogether / RUNS > 0.29 && abTogether / RUNS < 0.37, `two students share a team about a third of the time (${(abTogether / RUNS).toFixed(3)})`);
const seen = new Set();
for (let sd = 1; sd <= 30; sd++) seen.add(JSON.stringify(T.deal(names, ids, sd)));
ok(seen.size >= 25, `thirty seeds give at least 25 different deals (${seen.size})`);
const counts = T.counts({ teams: [{ id: 'tm1' }, { id: 'tm2' }], teamOf: { Ann: 'tm1', Bo: 'tm1', Cy: 'tm2', Old: 'tm9' } }, ['Ann', 'Bo', 'Cy', 'Dee', 'Old']);
same(counts, { none: 2, byTeam: { tm1: 2, tm2: 1 } }, 'counts: two, one, and two with no team (one on a team that is gone)');

/* 8. normalize cleans a hand-edited section. */
const dirty = {
  teams: [{ id: 'tm1', name: '  Reds ', color: 'red' }, { id: 'tm1', name: 'Dup' }, null, { id: 7 },
    { id: 'tm2', name: '', color: 'chartreuse' }, { id: 'tm3', name: 'Blues', color: 'blue' }],
  teamOf: { Ann: 'tm1', Bo: 'gone', Cy: 5, Di: 'tm3' },
  teamBank: { tm1: 4, tm2: 'x', tm9: 3 },
  teamDay: { tm1: 1.5, tm3: 2 },
  teamLog: [{ id: 'g1', team: 'tm1', delta: 2, label: 'ok', ts: '9' }, { id: 'g2', team: 'gone', delta: 1 }, { id: 'g3', team: 'tm1', delta: 'x' }],
  teamSeed: 'abc',
};
T.normalize(dirty);
same(dirty.teams.map(t => t.id), ['tm1', 'tm2', 'tm3'], 'duplicate, null and non-string ids are dropped');
same(dirty.teams.map(t => t.name), ['Reds', 'Team 2', 'Blues'], 'names are trimmed and an empty one numbered');
same(dirty.teams.map(t => t.color), ['red', '', 'blue'], 'an unknown colour becomes none');
same(dirty.teamOf, { Ann: 'tm1', Di: 'tm3' }, 'assignments to a missing team are dropped');
same(dirty.teamBank, { tm1: 4, tm2: 0, tm3: 0 }, 'bank: whole numbers for known teams only');
same(dirty.teamDay, { tm1: 0, tm2: 0, tm3: 2 }, 'today: a fraction becomes 0');
same(dirty.teamLog.map(e => e.id), ['g1'], 'a log entry for a missing team or with a bad delta is dropped');
eq(dirty.teamSeed, 1, 'a bad seed becomes 1');
const many = { teams: Array.from({ length: 12 }, (_, i) => ({ id: 'tm' + (i + 1), name: 'T' + i })) };
T.normalize(many);
eq(many.teams.length, 8, 'a hand-made twelve is cut to eight');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
