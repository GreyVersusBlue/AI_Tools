// Seating storage migration (Path 14 P3, increment 1 step 2): pure Node.
// A chart saved by the page before rules existed (fixtures/saved-v357.json, written by the
// v357 repairState, not by this build) loads unchanged, seats as before where no rule is used,
// and rules, prefs and desk.empty survive a save and a load, and the old pair lists stay a
// faithful mirror so a cached older page still reads them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairState, assignSeats, checkConstraints } from '../seating.mjs';
import { solve, normalizeRules, rulesToLegacy, absorbLegacy, syncLegacy, rng } from '../seating-solve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const old = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'saved-v357.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}  got ${JSON.stringify(a).slice(0, 300)}  want ${JSON.stringify(b).slice(0, 300)}`);
const clone = x => JSON.parse(JSON.stringify(x));

// 1. the old chart loads unchanged, and the load is idempotent
const once = repairState(clone(old), rng(1));
eq(once, old, 'old format: loads exactly as saved');
eq(repairState(clone(once), rng(2)), once, 'old format: loading twice changes nothing');
ok(once.sections.every(s => !('rules' in s) && !('prefs' in s)), 'old format: no rules or prefs field appears from loading');
ok(once.sections.every(s => s.desks.every(d => !('empty' in d))), 'old format: no desk.empty appears');

// 2. it seats as before: pairs honoured, the pinned desk kept, everyone seated
const sec = once.sections[0];
const r = solve(sec, { seed: 5 });
ok(r.score[0] === 0 && r.unseated.length === 0, 'old format: solve seats everyone with the pairs kept');
ok(r.assign.d0 === sec.assign.d0, 'old format: the pinned desk keeps its occupant');
const chk = checkConstraints({ ...sec, assign: r.assign });
ok(chk.apartOK && chk.togetherOK, 'old format: today\'s checker agrees with the new solver');
const a = assignSeats(sec, { rng: rng(3) });
ok(a.apartOK && a.togetherOK, 'old format: today\'s assignSeats still seats it cleanly (unchanged)');
eq(normalizeRules(sec).rules.map(x => x.id).sort(), ['legacy:apart:s0|s1', 'legacy:apart:s4|s5', 'legacy:together:s6|s7', 'legacy:together:s7|s8', 'seat:d0'], 'old format: its pairs and pin are the rules, all Must');

// 3. rules survive a save and load, with the lists mirrored
const withRules = clone(old);
withRules.sections[0].rules = [
  { id: 'r1', kind: 'zone', hard: true, weight: 2, students: ['s2'], zone: 'front', why: 'front row, vision' },
  { id: 'r2', kind: 'together', hard: false, weight: 3, students: ['s0', 's1', 's9'] },
  { id: 'r3', kind: 'apart', hard: false, weight: 1, students: ['s4', 's5'] },
  { id: 'bad', kind: 'nonsense', students: ['s0'] },
];
withRules.sections[0].prefs = { newNeighbours: 2, spreadEmpty: 9 };
withRules.sections[0].desks[5].empty = true;
const loaded = repairState(withRules, rng(4));
const ls = loaded.sections[0];
eq(ls.rules.map(x => x.id).sort(), ['legacy:apart:s0|s1', 'legacy:together:s6|s7', 'legacy:together:s7|s8', 'r1', 'r2', 'r3'],
  'rules: an unknown kind is dropped; stored rules kept; list pairs with no rule arrive as Must rules; the lists win for a pair (r3 is the s4|s5 pair)');
eq(ls.prefs, { noRepeatSeat: 2, frontRowRotation: 2, newNeighbours: 2, spreadEmpty: 3 }, 'prefs: clamped to 0-3, the rest default');
ok(ls.desks[5].empty === true && !('empty' in ls.desks[4]), 'desk.empty: kept where set, absent elsewhere');
eq(repairState(clone(loaded), rng(5)), loaded, 'rules: loading a saved chart with rules changes nothing');
const r1 = ls.rules.find(x => x.id === 'r1');
ok(r1.why === 'front row, vision' && r1.hard === true, 'rules: the reason and hardness are kept');

// 4. the mirror: lists written from rules; an older page's list edits are honoured on the next load
const synced = syncLegacy(ls);
eq(synced.apart.map(p => p.join('|')).sort(), ['s0|s1', 's4|s5'], 'mirror: syncLegacy writes the 2-member apart rules out as the old list');
eq(synced.together.map(p => p.join('|')).sort(), ['s6|s7', 's7|s8'], 'mirror: and the together pairs; a three-member rule is not a pair and stays out of the lists');
const olderPage = clone(synced);
olderPage.apart = olderPage.apart.filter(p => p.join('|') !== 's0|s1').concat([['s2', 's3']]);   // removed one, added one
delete olderPage.rules;                                                                          // an older page drops what it does not know
eq(repairState({ sections: [olderPage] }, rng(6)).sections[0].apart.map(p => p.join('|')).sort(), ['s2|s3', 's4|s5'], 'mirror: an older page\'s list edit stands');
const keepsRules = clone(synced);
keepsRules.apart = keepsRules.apart.filter(p => p.join('|') !== 's0|s1').concat([['s2', 's3']]);
const merged = repairState({ sections: [keepsRules] }, rng(7)).sections[0];
ok(!merged.rules.some(x => x.id === 'legacy:apart:s0|s1') && merged.rules.some(x => x.id === 'legacy:apart:s2|s3'), 'mirror: a page that kept the rules still loses the removed pair and gains the added one (the lists win)');
ok(merged.rules.some(x => x.id === 'r2'), 'mirror: and the pod, which lives only in rules, survives');
eq(rulesToLegacy(absorbLegacy(ls).rules).apart.length, 2, 'mirror: absorb then mirror is stable');

// 5. a load with no rules is not given any; a hand-edited rules field cannot break the load
for (const bad of [null, 5, 'x', {}, [null, 7, 'x', { kind: 'apart' }]]) {
  const s = clone(old); s.sections[0].rules = bad;
  let out; try { out = repairState(s, rng(8)); } catch (e) { out = null; }
  ok(out && out.sections[0].students.length === 10, `rules: ${JSON.stringify(bad)} does not break the load`);
  ok(out && !('rules' in out.sections[0]), `rules: ${JSON.stringify(bad)} leaves no rules field`);
}

console.log(`seating migration: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
