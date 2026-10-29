// roster-join.test.mjs — hand-worked cases for roster-join.mjs. Every name is invented.
//   node Tools/final-grade-checker/roster-join.test.mjs
import { nameKey, joinRoster } from './roster-join.mjs';

let passed = 0, failed = 0;
const eq = (a, b, what) => {
  if (JSON.stringify(a) === JSON.stringify(b)) { passed++; return; }
  failed++; console.log(`  FAIL ${what}\n     want ${JSON.stringify(b)}\n     got  ${JSON.stringify(a)}`);
};
const rows = names => names.map(name => ({ name }));

eq(nameKey('Lovelace, Ada'), nameKey('Ada Lovelace'), 'Last, First is First Last');
eq(nameKey('  ADA   lovelace '), nameKey('ada lovelace'), 'case and spacing');
eq(nameKey('José Núñez'), nameKey('Jose Nunez'), 'accents');
eq(nameKey("O'Brien, Mary-Ann"), 'ann brien mary o', 'an apostrophe splits a word; both sides get the same treatment');
eq(nameKey(''), '', 'empty');
eq(nameKey(null), '', 'null');

// a clean match
let r = joinRoster(rows(['Lovelace, Ada', 'Polo, Marco']), ['Ada Lovelace', 'Marco Polo']);
eq([r.matched.length, r.missing, r.extra.length, r.ambiguous.length, r.duplicates.length], [2, [], 0, 0, 0], 'two for two');
eq(r.matched, [{ index: 0, roster: 'Ada Lovelace' }, { index: 1, roster: 'Marco Polo' }], 'matched to the roster spelling');

// missing and extra
r = joinRoster(rows(['Lovelace, Ada', 'Hopper, Grace']), ['Ada Lovelace', 'Marco Polo', 'Nellie Bly']);
eq(r.missing, ['Marco Polo', 'Nellie Bly'], 'roster students with no row are flagged');
eq(r.extra.map(e => e.name), ['Hopper, Grace'], 'a row not on the roster is flagged');
eq(r.rosterSize, 3, 'roster size');

// a near spelling is a hint, never a match
r = joinRoster(rows(['Marko Polo']), ['Marco Polo', 'Nellie Bly']);
eq(r.matched, [], 'Marko is not matched to Marco');
eq(r.extra, [{ index: 0, name: 'Marko Polo', closeTo: 'Marco Polo' }], 'but he is offered as the close one');
eq(r.missing, ['Marco Polo', 'Nellie Bly'], 'and Marco is still missing until a person decides');
eq(joinRoster(rows(['Sam Lee']), ['Pam Lee', 'Tam Lee']).extra[0].closeTo, null, 'two equally close names offer neither');
eq(joinRoster(rows(['Al']), ['Bl']).extra[0].closeTo, null, 'a name under four letters gets no edit budget');

// the same student twice in the paste
r = joinRoster(rows(['Ada Lovelace', 'Lovelace, Ada']), ['Ada Lovelace']);
eq(r.duplicates, [{ name: 'Ada Lovelace', indexes: [0, 1] }], 'a pasted name twice is named');
eq(r.matched.length, 2, 'both rows still match the one roster name');
eq(r.missing, [], 'and it is not missing');

// two roster names that fit one row
r = joinRoster(rows(['Jordan Lee']), ['Jordan Lee', 'Lee, Jordan']);
eq(r.rosterSize, 2, 'two spellings are two roster entries');
eq(r.ambiguous, [{ index: 0, name: 'Jordan Lee', candidates: ['Jordan Lee', 'Lee, Jordan'] }], 'the row is ambiguous, not resolved');
eq(r.missing, [], 'both are accounted for, not called missing');
eq(joinRoster([], ['Jordan Lee', 'jordan  lee']).rosterSize, 1, 'a name listed twice on the roster is one student');

// no name, no roster
r = joinRoster([{ name: '' }, { name: '   ' }, { name: 'Ada Lovelace' }], ['Ada Lovelace']);
eq([r.unnamed, r.matched.length], [2, 1], 'rows with no name are counted, not matched');
eq(joinRoster(rows(['A B']), []).extra.length, 1, 'an empty roster makes every row extra');
eq(joinRoster(null, null).rosterSize, 0, 'nothing in, nothing out');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
