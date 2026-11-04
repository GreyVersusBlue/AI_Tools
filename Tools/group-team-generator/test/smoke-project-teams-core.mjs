// smoke-project-teams-core.mjs — 002's project-team model (gtg-teams.js), in pure Node.
//
//   node Tools/group-team-generator/test/smoke-project-teams-core.mjs
//
// Devon's answers of 2026-10-07 (DEVON-ANSWERS-2026-10-07.md 4.1 to 4.6) are the spec this holds down:
// named teams of the same students (4.1); a printed task list (4.2); a contract that is his text with blanks, signed on
// paper, with nothing recording who signed (4.3); a day counts once, Monday to Friday, never twice for one date (4.4);
// a student is moved by hand and is on one team only (4.6). TEAMS_FILE points it at another copy of the module (the
// deliberate-break runs use it). Every name is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.TEAMS_FILE || path.join(here, '..', 'gtg-teams.js');
await import(pathToFileURL(file).href);
const T = globalThis.GtgTeams;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

console.log('Group / Team Generator — project teams (pure logic)');

/* ── 1. school days ───────────────────────────────────────────────────── */
eq(T.isSchoolDay('2026-11-02'), true, 'Monday is a school day');
eq(T.isSchoolDay('2026-11-06'), true, 'Friday is a school day');
eq(T.isSchoolDay('2026-11-07'), false, 'Saturday is not');
eq(T.isSchoolDay('2026-11-08'), false, 'Sunday is not');
eq(T.isSchoolDay('2026-13-40'), false, 'a date that does not exist is not');
eq(T.isSchoolDay('11/03/2026'), false, 'a date in another shape is not');
eq(T.isSchoolDay(undefined), false, 'no date is not');
eq(T.localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05', 'localDate pads month and day, and is the local day, not UTC');
eq(T.localDate(new Date(2026, 11, 31, 0, 1)), '2026-12-31', 'localDate just after local midnight');

/* ── 2. reading a saved record defensively ────────────────────────────── */
const base = { v: 1, since: '2026-11-03', counted: '2026-11-03', days: 2, teams: [{ name: 'Owls', members: ['Ada', 'Bo', 'Cy'], tasks: 'Plan\nBuild' }, { name: 'Wrens', members: ['Di', 'Eli'], tasks: '' }] };
same(T.normalize(base), base, 'a well-formed record reads back unchanged');
eq(T.normalize(null), null, 'null is no teams');
eq(T.normalize('x'), null, 'a string is no teams');
eq(T.normalize({ teams: 'x' }), null, 'teams that are not a list are no teams');
eq(T.normalize({ teams: [] }), null, 'an empty list is no teams');
eq(T.normalize({ teams: [null, 7, 'x'] }), null, 'a list of junk is no teams');
const dup = T.normalize({ teams: [{ name: 'A', members: ['Ada', 'Bo'] }, { name: 'B', members: ['Bo', 'Cy'] }] });
same(dup.teams.map(t => t.members), [['Ada', 'Bo'], ['Cy']], 'a student is on the first team only');
eq(T.normalize({ teams: [{ name: '', members: ['Ada'] }] }).teams[0].name, 'Team 1', 'an empty team name becomes Team 1');
same(T.normalize({ teams: [{ name: 'A', members: ['Ada', 5, '', null, '  '] }] }).teams[0].members, ['Ada'], 'non-name members are dropped');
eq(T.normalize({ teams: [{ name: 'A', members: ['Ada'] }], days: -3 }).days, 0, 'a negative day count is 0');
eq(T.normalize({ teams: [{ name: 'A', members: ['Ada'] }], days: 1.5 }).days, 0, 'a fractional day count is 0');
eq(T.normalize({ teams: [{ name: 'A', members: ['Ada'] }], counted: 'yesterday' }).counted, '', 'a counted date that is not a date is none');
eq(T.normalize({ teams: Array.from({ length: 40 }, (_, i) => ({ name: 'T' + i, members: ['S' + i] })) }).teams.length, T.MAX_TEAMS, 'teams are capped');
eq(T.normalize({ teams: [{ name: 'x'.repeat(500), members: ['Ada'] }] }).teams[0].name.length, 60, 'a team name is capped at 60 characters');
eq(T.normalize({ teams: [{ name: 'A', members: ['Ada'], tasks: 'y'.repeat(9000) }] }).teams[0].tasks.length, 4000, 'tasks are capped at 4000 characters');
const before = JSON.stringify(base);
T.normalize(base);
eq(JSON.stringify(base), before, 'normalize does not change what it reads');

/* ── 3. teams from groups on screen ───────────────────────────────────── */
const made = T.fromGroups([{ label: 'Red Team', members: ['Ada', 'Bo'] }, { label: 'Blue Team', members: ['Cy', 'Di'] }, { label: 'Gold Team', members: [] }], '2026-11-03');
same(made.teams.map(t => [t.name, t.members]), [['Red Team', ['Ada', 'Bo']], ['Blue Team', ['Cy', 'Di']]], 'groups become teams, and an empty group is not a team');
eq(made.since, '2026-11-03', 'a new team set starts on the day it was made');
eq(made.counted, '', 'and has counted nothing yet');
eq(made.days, 0, 'with no days counted');
eq(T.fromGroups([], '2026-11-03'), null, 'no groups is no teams');
const src = [{ label: 'A', members: ['Ada', 'Bo'] }];
T.fromGroups(src, '2026-11-03').teams[0].members.push('Zed');
same(src[0].members, ['Ada', 'Bo'], 'a team does not share its member list with the groups it came from');

/* ── 4. once a day ────────────────────────────────────────────────────── */
const mk = counted => ({ teams: base.teams, counted });
eq(T.isDue(mk(''), '2026-11-03'), true, 'a Tuesday with nothing counted is due');
eq(T.isDue(mk('2026-11-03'), '2026-11-03'), false, 'the same day again is not due');
eq(T.isDue(mk('2026-11-03'), '2026-11-04'), true, 'the next school day is due');
eq(T.isDue(mk('2026-11-03'), '2026-11-02'), false, 'a clock set back is not due, so a day is never counted twice');
eq(T.isDue(mk('2026-11-06'), '2026-11-07'), false, 'Saturday is not due');
eq(T.isDue(mk('2026-11-06'), '2026-11-08'), false, 'Sunday is not due');
eq(T.isDue(mk('2026-11-06'), '2026-11-09'), true, 'the Monday after is due');
eq(T.isDue(mk('2026-11-03'), '2026-11-10'), true, 'a week of days not opened is due, and counts once, not five times');
eq(T.isDue(null, '2026-11-03'), false, 'no teams is never due');

/* ── 5. who counts on a day ───────────────────────────────────────────── */
const nobodyAbsent = () => true;
same(T.dayGroups(base, nobodyAbsent), [['Ada', 'Bo', 'Cy'], ['Di', 'Eli']], 'every team of two or more counts');
same(T.dayGroups(base, n => n !== 'Bo'), [['Ada', 'Cy'], ['Di', 'Eli']], 'an absent student is left out of that day');
same(T.dayGroups(base, n => n !== 'Di'), [['Ada', 'Bo', 'Cy']], 'a team down to one student counts nothing that day');
same(T.dayGroups(base, () => false), [], 'nobody here counts nothing');
same(T.dayGroups(base, n => n === 'Ada'), [], 'one student alone makes no pair');

/* ── 6. by hand ───────────────────────────────────────────────────────── */
const moved = T.move(base, 'Bo', 1);
same(moved.teams.map(t => t.members), [['Ada', 'Cy'], ['Di', 'Eli', 'Bo']], 'a student moves to another team');
same(base.teams[0].members, ['Ada', 'Bo', 'Cy'], 'and the record moved from is not changed');
same(T.move(base, 'Bo', -1).teams.map(t => t.members), [['Ada', 'Cy'], ['Di', 'Eli']], 'a student is taken off the teams');
same(T.move(base, 'Zed', 1).teams.map(t => t.members), [['Ada', 'Bo', 'Cy'], ['Di', 'Eli', 'Zed']], 'a student on no team is added');
same(T.move(base, 'Bo', 9).teams.map(t => t.members), [['Ada', 'Cy'], ['Di', 'Eli']], 'moving to a team that is not there takes the student off, and adds them nowhere');
const ren = JSON.parse(JSON.stringify(base));
eq(T.rename(ren, 'Bo', 'Bobby'), true, 'a rename reports it moved something');
same(ren.teams[0].members, ['Ada', 'Bobby', 'Cy'], 'a rename keeps the place on the team');
eq(T.rename(ren, 'Nobody', 'X'), false, 'a rename of a student on no team moves nothing');
const ren2 = JSON.parse(JSON.stringify(base));
T.rename(ren2, 'Bo', 'Ada');
same(ren2.teams[0].members, ['Ada', 'Cy'], 'a rename onto a name already on the team does not list them twice');

/* ── 7. the task list ─────────────────────────────────────────────────── */
same(T.parseTasks('  Plan \n\n  \nBuild\r\n'), ['Plan', 'Build'], 'tasks are lines, trimmed, blanks gone');
eq(T.parseTasks(Array.from({ length: 90 }, (_, i) => 't' + i).join('\n')).length, T.MAX_TASKS, 'tasks are capped');
same(T.parseTasks(undefined), [], 'no text is no tasks');
const sheet = T.taskSheetHtml({ name: 'Owls <b>', members: ['Ada', 'Bo & Cy'], tasks: 'Plan <i>it</i>\nBuild' });
ok(sheet.includes('Owls &lt;b&gt;') && !sheet.includes('<b>'), 'a team name is escaped on the task list');
ok(sheet.includes('Bo &amp; Cy') && sheet.includes('Ada and Bo &amp; Cy'), 'member names are escaped and joined');
ok(sheet.includes('Plan &lt;i&gt;it&lt;/i&gt;') && !sheet.includes('<i>'), 'a task is escaped');
eq((sheet.match(/class="p-check"/g) || []).length, 2, 'every task has a box to tick in pen');
eq((sheet.match(/<tr>/g) || []).length, 3, 'a header row and a row for each task');
ok(T.taskSheetHtml({ name: 'A', members: ['Ada'], tasks: '' }).includes('No tasks written for this team yet.'), 'a team with no tasks says so, and prints an empty sheet');
ok(!/<input|<button|<script/i.test(sheet), 'the printed task list has no control on it (printed only, nothing for students to tick on a screen)');

/* ── 8. the contract ──────────────────────────────────────────────────── */
const team = { name: 'Owls', members: ['Ada', 'Bo', 'Cy'], tasks: '' };
const c = T.contractHtml(T.DEFAULT_CONTRACT, team);
ok(c.includes('<h2>Team contract for Owls</h2>'), 'the first line is the heading, with {team} filled in');
ok(c.includes('We are Ada, Bo and Cy.'), '{members} is filled in as a list');
ok((c.match(/class="p-blank"/g) || []).length >= 6, 'the starter wording has blanks to write on');
eq((c.match(/class="p-sig"/g) || []).length, 3, 'a signature line for each student');
ok(!c.includes('____'), 'no raw run of underscores is left');
ok(!/\{team\}|\{members\}/.test(c), 'no placeholder is left');
ok(!/<input|<button|<script/i.test(c), 'a contract has no control on it: signed on paper, nothing records who signed');
const own = T.contractHtml('Our deal\nWe will ___ and {team} {members} ____', { name: 'A<b>', members: ['X&Y', 'Z'], tasks: '' });
ok(own.includes('<h2>Our deal</h2>'), 'the teacher’s own first line is the heading');
ok(own.includes('A&lt;b&gt; X&amp;Y and Z') && !own.includes('<b>'), 'names are escaped in the teacher’s own text');
eq((own.match(/class="p-blank"/g) || []).length, 2, 'a run of three underscores is a blank, wherever it is');
ok(T.contractHtml('Deal\nA name ____ here', { name: 'Under___score', members: ['A___B', 'C'], tasks: '' }).split('p-blank').length === 2, 'underscores inside a student’s name are not turned into blanks');
ok(T.contractHtml('', team).includes('Team contract for Owls'), 'empty wording falls back to the starter wording');
ok(T.contractHtml('Two __ underscores', team).includes('Two __ underscores'), 'two underscores are left alone');

/* ── 9. nothing in the module reaches out ─────────────────────────────── */
import fs from 'node:fs';
const srcText = fs.readFileSync(file, 'utf8');
ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|document\.|Math\.random|Date\.now|new Date\(\)/.test(srcText.replace(/\/\*[\s\S]*?\*\//g, '')), 'the module has no storage, network, DOM, randomness or clock of its own');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
