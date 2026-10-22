// student-flags.test.mjs — pure-logic tests for _shared/student-flags.js
// (Path 3 P5): the flag record on the shared student, its stored form, the
// day an absence holds, pruning, counts, and the read that never throws.
//
//   node Tools/roster/test/student-flags.test.mjs   (or: npm run test:student-flags)
//
// student-flags.js is a classic script ending in `})(window or globalThis)`,
// so it runs here in a vm context, as roster.test.mjs runs roster.js. The same
// checks are then run against deliberate breaks of the module (MUTANTS below):
// each break must turn at least one check red, or the suite fails, so a check
// that passes on a broken module is caught here rather than in a classroom.
// Days are fixed strings; nothing reads the real clock. The time zone is
// pinned, so dayKey() of a fixed Date is checked against a known local day. Every id is made up.
// Exits 1 on any failure.

// Pinned so a local day and a UTC day differ at 23:59, wherever this runs.
process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const SRC = fs.readFileSync(path.join(site, '_shared/student-flags.js'), 'utf8');

const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'student-flags.js' });
  return ctx.window.StudentFlags;
}

function fakeStorage(seed = {}, opts = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem(k) { if (opts.throws) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; },
  };
}

const T = '2026-10-21', Y = '2026-10-20';

/** Every check, against one copy of the module. Returns the failed labels. */
function checks(F) {
  const fails = [];
  const ok = (c, label) => { checks.count++; if (!c) fails.push(label); };
  const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

  // The contract other files name.
  eq(F.KEY, 'crh_flags_v1', 'KEY');
  eq(F.KINDS.map(k => k.id), ['absent', 'noCall'], 'KINDS ids, in order');
  ok(F.KINDS.every(k => k.label && k.short && k.describe), 'every kind has label, short and describe');

  // dayKey is the LOCAL date, zero-padded.
  eq(F.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05', 'dayKey pads month and day, local time');
  eq(F.dayKey(new Date(2026, 11, 31, 23, 30)), '2026-12-31', 'dayKey late on 31 December is still that year, local');

  // parse: never throws; cleans.
  for (const bad of [null, undefined, '', 'not json', '{"flags":', '[]', '42', 'null', '{"flags":[]}', '{"flags":"x"}']) {
    let d; try { d = F.parse(bad); } catch (e) { d = 'threw'; }
    eq(d, { version: 1, flags: {} }, `parse(${JSON.stringify(bad)}) is empty`);
  }
  const messy = JSON.stringify({ version: 7, extra: 1, flags: {
    a1: { absent: T, noCall: true, note: 'never kept' },
    a2: { absent: '21/10/2026' },             // wrong form: dropped
    a3: { noCall: 'yes' },                    // not true: dropped
    a4: { absent: Y },
    '': { noCall: true },                     // no id
    ['x'.repeat(65)]: { noCall: true },       // id too long
    a5: 'string',
    a6: { noCall: true },
  } });
  eq(F.parse(messy), { version: 1, flags: { a1: { absent: T, noCall: true }, a4: { absent: Y }, a6: { noCall: true } } },
    'parse keeps only the two flags in their stored forms');
  eq(F.parse(JSON.parse(messy)), F.parse(messy), 'parse takes an object as well as text');

  // get: absent holds only on its day.
  const d = F.parse(messy);
  eq(F.get(d, 'a1', T), { absent: true, noCall: true }, 'get: both on the day');
  eq(F.get(d, 'a1', '2026-10-22'), { absent: false, noCall: true }, 'get: absent gone the next day, noCall stays');
  eq(F.get(d, 'a4', T), { absent: false, noCall: false }, 'get: yesterday\'s absence does not hold today');
  eq(F.get(d, 'nobody', T), { absent: false, noCall: false }, 'get: unknown id');
  eq(F.get(d, 'toString', T), { absent: false, noCall: false }, 'get: a prototype name is not an entry');
  const ghost = { flags: Object.create({ inherited: { noCall: true } }) };
  eq(F.get(ghost, 'inherited', T), { absent: false, noCall: false }, 'get: an inherited property is not an entry');
  eq(F.get(null, 'a1', T), { absent: false, noCall: false }, 'get: no document');
  ok(F.any(d, 'a6', T) && !F.any(d, 'a4', T), 'any');

  // set: pure, stamps the day, removes empty entries.
  const before = JSON.stringify(d);
  const s1 = F.set(d, 'b1', 'absent', true, T);
  eq(JSON.stringify(d), before, 'set does not change its input');
  eq(s1.flags.b1, { absent: T }, 'set absent stamps today');
  const s2 = F.set(s1, 'b1', 'noCall', true, T);
  eq(s2.flags.b1, { absent: T, noCall: true }, 'set noCall beside absent');
  const s3 = F.set(F.set(s2, 'b1', 'absent', false, T), 'b1', 'noCall', false, T);
  ok(!('b1' in s3.flags), 'an entry with no flag left is removed');
  eq(F.set(d, 'b1', 'note', true, T), d, 'an unknown kind changes nothing');
  eq(F.set(d, '', 'noCall', true, T), d, 'an empty id changes nothing');
  eq(F.set(d, 'x'.repeat(65), 'noCall', true, T), d, 'a too-long id changes nothing');
  eq(F.set(d, 'a4', 'absent', true, T).flags.a4, { absent: T }, 'setting absent again moves an old day to today');
  eq(F.parse(JSON.stringify(s2)), s2, 'what set gives survives a store and read');

  // The cap: a full document takes no new student but still edits one it has.
  const full = { version: 1, flags: {} };
  for (let i = 0; i < F.MAX_ENTRIES; i++) full.flags['s' + i] = { noCall: true };
  const fp = F.parse(full);
  eq(Object.keys(fp.flags).length, F.MAX_ENTRIES, 'parse keeps MAX_ENTRIES');
  ok(!('new' in F.set(fp, 'new', 'noCall', true, T).flags), 'a full document takes no new student');
  ok(!('s0' in F.set(fp, 's0', 'noCall', false, T).flags), 'a full document still clears a flag');

  // prune.
  const p1 = F.prune(d, T);
  eq(p1.doc.flags, { a1: { absent: T, noCall: true }, a6: { noCall: true } }, 'prune drops an earlier day\'s absence');
  ok(p1.changed, 'prune reports a change');
  const p2 = F.prune(p1.doc, T);
  ok(!p2.changed, 'prune of a clean document reports no change');
  eq(p2.doc, p1.doc, 'prune is idempotent');
  const p3 = F.prune(p1.doc, T, ['a6']);
  eq(Object.keys(p3.doc.flags), ['a6'], 'prune drops a student on no roster (array)');
  ok(p3.changed, 'that is a change');
  eq(Object.keys(F.prune(p1.doc, T, { a1: true }).doc.flags), ['a1'], 'prune takes an id map');
  ok(F.prune(JSON.parse(messy), T).changed, 'prune counts an unreadable entry as a change');
  ok(!F.prune(null, T).changed, 'prune of nothing is no change');

  // counts.
  eq(F.counts(d, T), { absent: 1, noCall: 2, students: 2 }, 'counts over the document');
  eq(F.counts(d, T, ['a6', 'a6', 'a4', 'zz']), { absent: 0, noCall: 1, students: 1 }, 'counts among ids, a repeat once');

  // byName: a page's own names, through its id lookup.
  const idOf = n => ({ 'Ann': 'a', 'Ben': 'b', 'Cal': 'c', 'Dee': 'd' })[n] || null;
  const bdoc = { version: 1, flags: { a: { absent: T }, b: { noCall: true }, c: { absent: T, noCall: true }, d: { absent: Y } } };
  eq(F.byName(bdoc, ['Dee', 'Cal', 'Ben', 'Ann', 'Zed'], idOf, T), { absent: ['Cal', 'Ann'], noCall: ['Ben'] },
    'byName: absent today and no-call, in the page\'s order; both is absent; yesterday and no id are nothing');
  eq(F.byName(bdoc, ['Ann', 'Ann'], idOf, T), { absent: ['Ann'], noCall: [] }, 'byName lists a repeated name once');
  eq(F.byName(bdoc, ['Ann'], () => { throw new Error('x'); }, T), { absent: [], noCall: [] }, 'byName: a lookup that throws is no id');
  eq(F.byName(bdoc, ['Ann'], () => 'x'.repeat(65), T), { absent: [], noCall: [] }, 'byName: a bad id is no id');
  eq(F.byName(null, ['Ann'], idOf, T), { absent: [], noCall: [] }, 'byName of no document');
  eq(F.byName(bdoc, 'Ann', idOf, T), { absent: [], noCall: [] }, 'byName of a non-list');
  eq(F.byName(JSON.stringify(bdoc), ['Ann'], idOf, T), { absent: ['Ann'], noCall: [] }, 'byName reads stored text');

  // labels.
  eq(F.labels({ absent: true, noCall: true }), ['Absent today', 'Do not cold call'], 'labels');
  eq(F.labels({ noCall: true }, 'short'), ['No cold call'], 'short labels');
  eq(F.labels(null), [], 'labels of nothing');

  // read.
  eq(F.read(fakeStorage({ crh_flags_v1: JSON.stringify(s2) })), s2, 'read from storage');
  eq(F.read(fakeStorage({ crh_students_v1: '{}' })), F.empty(), 'read with no key');
  eq(F.read(fakeStorage({}, { throws: true })), F.empty(), 'read when storage throws');
  eq(F.read(null), F.empty(), 'read with no storage');

  return fails;
}

/* Deliberate breaks. Each must make checks() fail at least once. */
const MUTANTS = [
  ['absent holds on any day', "absent: !!(e && e.absent === t)", "absent: !!(e && e.absent)"],
  ['noCall held as truthy', "if (e.noCall === true) out.noCall = true;", "if (e.noCall) out.noCall = true;"],
  ['absent form not checked', "typeof e.absent === 'string' && DAY_RE.test(e.absent)", "typeof e.absent === 'string'"],
  ['own-property check gone in get', "&& own(doc.flags, id) ?", "?"],
  ['set mutates its input', "var next = parse(doc);\n    if (!goodId(id)", "var next = doc;\n    if (!goodId(id)"],
  ['empty entry kept', "    } else {\n      delete next.flags[id];\n    }", "    } else {\n      next.flags[id] = e;\n    }"],
  ['prune keeps old absences', "if (e.absent === t) out.absent = e.absent; else changed = true;", "out.absent = e.absent;"],
  ['prune ignores live ids', "if (live && !own(live, id)) { changed = true; return; }", ""],
  ['dayKey uses UTC', "d.getFullYear() + '-'", "d.getUTCFullYear() + '-'"],
  ['dayKey not padded', "(day < 10 ? '0' : '') + day", "day"],
  ['parse throws on bad text', "try { v = JSON.parse(raw); } catch (e) { return empty(); }", "v = JSON.parse(raw);"],
  ['read lets a throw out', "try { raw = storage && storage.getItem ? storage.getItem(KEY) : null; }\n    catch (e) { return empty(); }", "raw = storage && storage.getItem ? storage.getItem(KEY) : null;"],
  ['cap not enforced on set', "if (!own(next.flags, id) && Object.keys(next.flags).length >= MAX_ENTRIES) return next;", ""],
  ['ids too long accepted', "id.length <= MAX_ID", "true"],
  ['counts counts repeats', "if (!goodId(id) || seen[id]) return;", "if (!goodId(id)) return;"],
  ['byName: absent on any day', "if (f.absent) out.absent.push(n);", "if (doc && d.flags[id] && d.flags[id].absent) out.absent.push(n);"],
  ['byName: both listed twice', "else if (f.noCall) out.noCall.push(n);", "if (f.noCall) out.noCall.push(n);"],
  ['byName: repeats listed', "if (typeof n !== 'string' || own(seen, n)) return;", "if (typeof n !== 'string') return;"],
  ['byName: a throwing lookup throws', "try { id = idOf(n); } catch (e) { id = null; }", "id = idOf(n);"],
];

let failed = 0;
checks.count = 0;
const fails = checks(load(SRC));
const ran = checks.count;
fails.forEach(f => console.log('  FAIL ' + f));
failed += fails.length;

let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  let red;
  try { red = checks(load(SRC.replace(from, to))).length > 0; } catch (e) { red = true; }
  if (red) caught++;
  else { console.log(`  FAIL mutant "${name}" passed every check`); failed++; }
}

console.log(`student-flags: ${ran - fails.length}/${ran} checks passed; ${caught}/${MUTANTS.length} deliberate breaks caught`);
process.exit(failed ? 1 : 0);
