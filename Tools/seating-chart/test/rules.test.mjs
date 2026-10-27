// The page's half of the rule language (Path 14 P3 increment 2): pure Node.
import { buildRule, addRule, removeRule, pruneRules, describeRule, forShare, subRules } from '../seating-rules.mjs';
import { absorbLegacy } from '../seating.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}  got ${JSON.stringify(a)}`);
const sec = (over = {}) => ({
  id: 'x', name: 'P1', students: ['A', 'B', 'C', 'D'].map((n, i) => ({ id: 's' + i, name: n })),
  desks: ['d0', 'd1', 'd2'].map(id => ({ id })), assign: {}, apart: [], together: [], layouts: [], history: [], ...over,
});
let n = 0; const uid = () => 'u' + (++n);
const nameOf = id => ({ s0: 'A', s1: 'B', s2: 'C', s3: 'D' }[id] || '(removed)');
const deskNo = id => ['d0', 'd1', 'd2'].indexOf(id) + 1;

// errors, one per kind
eq(buildRule({ kind: 'apart', students: ['s0'] }, sec(), uid).error, 'Pick at least two students.', 'apart needs two');
eq(buildRule({ kind: 'partner', students: ['s0', 's1'], anyOf: ['s2'] }, sec(), uid).error, 'Pick one student who needs a partner.', 'partner takes one student');
eq(buildRule({ kind: 'partner', students: ['s0'], anyOf: ['s0'] }, sec(), uid).error, 'Pick at least one student who could be the partner.', 'the partner cannot be the student');
eq(buildRule({ kind: 'zone', students: ['s0'], zone: 'desks', desks: [] }, sec(), uid).error, 'Tap at least one desk on the floor.', 'desks zone needs desks');
eq(buildRule({ kind: 'zone', students: ['s0'], zone: 'nowhere' }, sec(), uid).error, 'Pick a zone.', 'an unknown zone is refused');
eq(buildRule({ kind: 'space', students: [] }, sec(), uid).error, 'Pick at least one student.', 'space needs a student');
eq(buildRule({ kind: 'bogus', students: ['s0'] }, sec(), uid).error, 'Pick a kind of rule.', 'unknown kind');

// a chart with a legacy pair: adding a rule turns the pair into a Must rule and keeps the lists
const s = sec({ apart: [['s0', 's1']] });
const z = buildRule({ kind: 'zone', students: ['s2'], zone: 'front', hard: true, weight: 3, why: 'vision' }, s, uid);
ok(z.rule && z.rule.kind === 'zone' && z.rule.zone === 'front' && z.rule.hard && z.rule.why === 'vision', 'a zone rule builds');
addRule(s, z.rule);
eq(s.rules.map(r => r.kind), ['apart', 'zone'], 'the legacy pair became a rule, then the new one');
ok(s.rules[0].hard && s.rules[0].id === 'legacy:apart:s0|s1', 'the pair is Must with its legacy id');
eq(s.apart, [['s0', 's1']], 'the apart list still holds the pair');

// duplicate and clash
eq(buildRule({ kind: 'apart', students: ['s1', 's0'], hard: true }, s, uid).error, 'That rule is already there.', 'the same pair twice');
eq(buildRule({ kind: 'together', students: ['s0', 's1'], hard: true }, s, uid).error, 'That clashes with a keep-apart rule on the same students.', 'hard together on hard apart');
ok(buildRule({ kind: 'together', students: ['s0', 's1'], hard: false, weight: 1 }, s, uid).rule, 'a Want together on a Must apart is allowed (the solver names the conflict)');

// soft pair and pod: soft pair mirrors, a pod does not
const soft = buildRule({ kind: 'together', students: ['s2', 's3'], hard: false, weight: 2 }, s, uid).rule;
addRule(s, soft);
eq(s.together, [['s2', 's3']], 'a Want pair is mirrored into the together list');
const pod = buildRule({ kind: 'together', students: ['s0', 's2', 's3'], hard: true }, s, uid).rule;
addRule(s, pod);
eq(s.together, [['s2', 's3']], 'a pod is not mirrored');
ok(describeRule(pod, nameOf, deskNo).text === 'Pod: A, C, D', 'a pod is worded as a pod');

// the round trip an older page makes: lists win on load, the rules stay
const back = absorbLegacy(JSON.parse(JSON.stringify(s)));
ok(back.rules.some(r => r.id === pod.id) && back.rules.some(r => r.id === soft.id && !r.hard), 'after absorbLegacy the pod and the soft pair are still rules');

// removal
ok(removeRule(s, soft.id) && s.together.length === 0, 'removing the soft pair empties the together list');
ok(!removeRule(s, 'nope'), 'removing an unknown id does nothing');

// prune: a gone student and a gone desk
const t = sec();
addRule(t, buildRule({ kind: 'zone', students: ['s0'], zone: 'desks', desks: ['d0', 'd1'] }, t, uid).rule);
addRule(t, buildRule({ kind: 'apart', students: ['s1', 's2'], hard: true }, t, uid).rule);
t.desks = t.desks.filter(d => d.id !== 'd0');
ok(pruneRules(t) && t.rules[0].desks.join() === 'd1', 'a gone desk leaves the zone rule');
t.students = t.students.filter(x => x.id !== 's2');
ok(pruneRules(t) && t.rules.length === 1 && t.apart.length === 0, 'a pair loses a student and goes, from the list too');
ok(!pruneRules(t), 'pruning twice changes nothing');
ok(!pruneRules(sec()), 'a chart with no rules is not touched');

// wording
eq(describeRule(z.rule, nameOf, deskNo), { text: 'C in the front row', strength: 'Must', why: 'vision' }, 'zone wording');
const pt = buildRule({ kind: 'partner', students: ['s0'], anyOf: ['s1', 's2'], hard: false, weight: 3 }, sec(), uid).rule;
eq(describeRule(pt, nameOf, deskNo), { text: 'A needs a partner from: B, C', strength: 'Want: really want', why: '' }, 'partner wording');

// forShare: reasons out, rules in, the chart itself untouched
const w = sec(); addRule(w, buildRule({ kind: 'space', students: ['s0'], hard: true, why: 'a private reason' }, w, uid).rule);
const shared = forShare(w);
ok(shared.rules.length === 1 && shared.rules[0].why === '' && w.rules[0].why === 'a private reason', 'forShare blanks the reason on the copy only');
ok(forShare(sec()).rules === undefined, 'a section with no rules is returned as it is');

// subRules: kinds and names, no reason; pairs are left to checkConstraints
const q = sec({ assign: { d0: 's0', d1: 's1', d2: 's2' } });
q.desks = [{ id: 'd0', x: 40, y: 110 }, { id: 'd1', x: 150, y: 110 }, { id: 'd2', x: 40, y: 260 }];
addRule(q, buildRule({ kind: 'space', students: ['s0'], hard: true, why: 'a private reason' }, q, uid).rule);
addRule(q, buildRule({ kind: 'zone', students: ['s0'], zone: 'front', hard: true }, q, uid).rule);
addRule(q, buildRule({ kind: 'apart', students: ['s0', 's1'], hard: true }, q, uid).rule);
addRule(q, buildRule({ kind: 'zone', students: ['s2'], zone: 'back', hard: false, weight: 1 }, q, uid).rule);
const sr = subRules(q);
eq(sr.broken, ['Needs room (no neighbour): A'], 'a broken Must space rule is named, the pair and the Want rule are not');
eq(sr.kept, ['A in the front row'], 'a kept Must rule is named');
ok(!JSON.stringify(sr).includes('private'), 'and neither carries a reason');

console.log(`seating-rules: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
