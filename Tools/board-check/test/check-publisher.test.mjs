// check-publisher.test.mjs — the publisher guard and the data contract, held
// on the real tree and on edited copies of it (Path 11 P1).
//
//   node Tools/board-check/test/check-publisher.test.mjs   (or: npm run test:check-publisher)
//
// Pure Node, no browser. Every break on purpose edits 035's (or 034's) text
// in memory and asserts the guard fails with its own code and no other. The
// contract cases use built data with made-up names only.

import fs from 'node:fs';
import path from 'node:path';
import { check, readPublisher, assemble, freeNames, ROOT, PAGE_035, PAGE_034, LEDGER }
  from '../check-publisher.mjs';
import { FORMAT, DATA_KEYS, formatOf, validate, upgrade, readEmbedded, shapeOf }
  from '../../schedule/test/published-contract.mjs';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

const html035 = fs.readFileSync(path.join(ROOT, PAGE_035), 'utf8').replace(/\r/g, '');
const html034 = fs.readFileSync(path.join(ROOT, PAGE_034), 'utf8').replace(/\r/g, '');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, LEDGER), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

console.log('check-publisher — the guard on the tree');
const real = check();
ok(real.failures.length === 0, 'the tree passes: ' + JSON.stringify(real.failures));
const pub = readPublisher(html035);
ok(pub.fns.length === 28, `28 listed functions (got ${pub.fns.length})`);
ok(pub.consts.length === 7, `7 .toString() constants (got ${pub.consts.length})`);
ok(pub.json.filter(j => j.name !== 'BR_STALE_DAYS').length === 2, '2 JSON constants');
ok(pub.json.some(j => j.name === 'BR_STALE_DAYS'), 'BR_STALE_DAYS is read');
ok(JSON.stringify(pub.state.map(s => s.name)) === JSON.stringify(['brMode', 'brCurrent', 'brActiveIdx', 'brOpts', 'brGrpDay', 'brMapFloorIdx']),
  '6 state names: ' + pub.state.map(s => s.name).join(','));
ok(pub.boot.filter(b => /^\w+\(\);$/.test(b)).length === 5, '5 boot calls');
ok(JSON.stringify(pub.dataKeys) === JSON.stringify(DATA_KEYS), 'the publisher writes the contract\'s keys');
const c = s => real.fork.filter(f => f.state === s).length;
ok(c('same') === 21 && c('forked') === 12 && c('absent') === 2, `034: 21 same, 12 forked, 2 absent (got ${c('same')}/${c('forked')}/${c('absent')})`);
const script = assemble(pub, {});
ok(script.startsWith("'use strict';\n"), 'the assembled script is strict');
const free = freeNames(script);
ok(JSON.stringify([...new Set(free.map(f => f.name))].sort()) === '["brRenderMapLegacy","document"]',
  'the only free names are document and brRenderMapLegacy: ' + JSON.stringify([...new Set(free.map(f => f.name))]));

/* ── breaks on purpose ──────────────────────────────────────────────── */

console.log('check-publisher — breaks on purpose');
function edit(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`fixture edit not found (${label}): ${from.slice(0, 60)}`);
  return text.replace(from, to);
}
function expect(label, codes, { h35 = html035, h34 = html034, led = ledger, mention } = {}) {
  const r = check({ html035: h35, html034: h34, ledger: led });
  const got = [...new Set(r.failures.map(f => f.code))].sort();
  const want = [...codes].sort();
  const same = JSON.stringify(got) === JSON.stringify(want);
  const named = !mention || r.failures.some(f => f.message.includes(mention));
  ok(same && named, `${label}: want ${want.join('+')}${mention ? ' naming ' + mention : ''}, got `
    + JSON.stringify(r.failures.map(f => f.code + ' ' + f.message.slice(0, 120))));
}
const ledgerWith = (group, name, why = 'test') => {
  const l = clone(ledger);
  if (group === 'same') l.same.push(name); else l[group][name] = why;
  return l;
};
const ledgerWithout = name => {
  const l = clone(ledger);
  l.same = l.same.filter(n => n !== name);
  delete l.forked[name]; delete l.absent[name];
  return l;
};

// The Round 7 bug: escHtml left out of the published constants.
expect('escHtml taken out of consts', ['FREE'], {
  h35: edit(html035, "    'const escHtml = '   + escHtml.toString()   + ';',\n", '', 'escHtml'),
  led: ledgerWithout('escHtml'), mention: 'escHtml',
});
expect('a listed function renamed at its declaration', ['LIST'], {
  h35: edit(html035, 'function brSetGrpDay(', 'function brSetGrpDayRenamed(', 'rename'), mention: 'brSetGrpDay',
});
{
  // brFormatDateLong(d) { … } turned into an arrow constant.
  const m = /function brFormatDateLong\(([^)]*)\) \{/.exec(html035);
  expect('a listed function turned into const f = () =>', ['LIST'], {
    h35: html035.replace(m[0], `const brFormatDateLong = (${m[1]}) => {`), mention: 'brFormatDateLong',
  });
}
expect('a listed function declared twice', ['LIST'], {
  h35: edit(html035, 'function brJumpGroup(', 'function brJumpGroup() {}\nfunction brJumpGroup(', 'dup'), mention: 'brJumpGroup',
});
expect("'const brDColor = ' + brDeptInk.toString()", ['CONST'], {
  h35: edit(html035, "'const brDColor = '  + brDColor.toString()", "'const brDColor = '  + brDeptInk.toString()", 'const'),
  mention: 'brDColor',
});
expect('AppState.settings read inside brRenderTeacher', ['LIVE'], {
  h35: edit(html035, 'function brRenderTeacher(n) {', 'function brRenderTeacher(n) {\n  void AppState.settings;', 'appstate'),
  mention: 'AppState',
});
expect('a localStorage read in a published function', ['LIVE'], {
  h35: edit(html035, 'function brRenderGroup(sec) {', "function brRenderGroup(sec) {\n  void localStorage.getItem('x');", 'ls'),
  mention: 'localStorage',
});
expect('a URL in BR_CSS', ['LIVE'], {
  h35: edit(html035, 'const BR_CSS = `#app-browser {', 'const BR_CSS = `@import url(https://fonts.example.com/a.css);\n#app-browser {', 'url'),
});
expect('onclick="brNope()" in the markup template', ['HANDLER'], {
  h35: edit(html035, '<p class="sub">Teacher Schedule Browser</p>', '<p class="sub" onclick="brNope()">Teacher Schedule Browser</p>', 'handler'),
  mention: 'brNope',
});
expect('br-view renamed in the markup', ['ID'], {
  // The second copy is the publisher's template; the first is 035's own embedded browser.
  h35: html035.slice(0, html035.lastIndexOf('<div id="br-view"'))
    + html035.slice(html035.lastIndexOf('<div id="br-view"')).replace('<div id="br-view"', '<div id="br-viewport"'),
  mention: 'br-view',
});
expect("brGrpDay = 'B' in the preamble only", ['STATE'], {
  h35: edit(html035, `"let brGrpDay = 'A', brMapFloorIdx = 0;",`, `"let brGrpDay = 'B', brMapFloorIdx = 0;",`, 'state'),
  mention: 'brGrpDay',
});
expect('an undeclared assignment in a published function', ['STRICT'], {
  h35: edit(html035, 'function brSetGrpDay(', 'function brSetGrpDay__unused() { brStrayGlobal = 1; }\nfunction brSetGrpDay(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brSetGrpDay__unused,"),
  led: ledgerWith('absent', 'brSetGrpDay__unused'), mention: 'brStrayGlobal',
});
expect('a duplicate parameter in a published function', ['STRICT'], {
  h35: edit(html035, 'function brJumpGroup(', 'function brJumpGroup__unused(a, a) { return a; }\nfunction brJumpGroup(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brJumpGroup__unused,"),
  led: ledgerWith('absent', 'brJumpGroup__unused'),
});
expect('a <link> in the published head', ['HEAD'], {
  h35: edit(html035, `+ '<meta charset="UTF-8">\\n'`, `+ '<meta charset="UTF-8">\\n<link rel="icon" href="x.png">\\n'`, 'head'),
});
expect('a spread in the function list', ['SHAPE'], {
  h35: edit(html035, 'brFormatDateLong, brCheckStaleness\n  ];', 'brFormatDateLong, brCheckStaleness, ...[]\n  ];', 'spread'),
});
expect('a ternary in consts', ['SHAPE'], {
  h35: edit(html035, "    'const BR_STALE_DAYS = ' + BR_STALE_DAYS + ';'", "    (1 ? 'const BR_STALE_DAYS = ' + BR_STALE_DAYS + ';' : '')", 'ternary'),
});
expect('a backtick in a BR_CSS comment', ['PARSE'], {
  h35: edit(html035, 'const BR_CSS = `#app-browser {', 'const BR_CSS = `/* a `tick` */\n#app-browser {', 'tick'),
});
{
  const m = /function brOverviewHTML\([^)]*\) \{\n/.exec(html035);
  expect('one character changed in brOverviewHTML in 035 only', ['FORK'], {
    h35: html035.replace(m[0], m[0] + ' '), mention: 'brOverviewHTML',
  });
  const m34 = /function brOverviewHTML\([^)]*\) \{\n/.exec(html034);
  expect('one character changed in brOverviewHTML in 034 only', ['FORK'], {
    h34: html034.replace(m34[0], m34[0] + ' '), mention: 'brOverviewHTML',
  });
}
{
  const p = readPublisher(html035);
  const mine = p.fns.find(f => f.name === 'brMiniMapHTML').text;
  const theirs = /function brMiniMapHTML\([\s\S]*?\n\}/.exec(html034)[0];
  expect('a forked function made identical in 034', ['FORK'], {
    h34: html034.replace(theirs, mine), mention: 'lower the ledger',
  });
}
expect('a new name in the list and in no ledger group', ['FORK'], {
  h35: edit(html035, 'function brJumpGroup(', 'function brExtraPiece() { return 1; }\nfunction brJumpGroup(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brExtraPiece,"),
  mention: 'brExtraPiece',
});
// It brings its own holes with it (two free names, a handler for an
// unpublished function), which the guard names too; what this case holds is
// that the KNOWN_FREE entry is reported as expired.
expect('brRenderMapLegacy published after all (KNOWN_FREE expired)', ['FREE', 'HANDLER'], {
  // It is declared in 035 already, behind the dead door; listing it is enough.
  h35: edit(html035, "brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brRenderMapLegacy,", 'x'),
  led: ledgerWith('absent', 'brRenderMapLegacy'), mention: 'KNOWN_FREE',
});
expect('the publisher writes a data key the contract does not have', ['DATA'], {
  h35: edit(html035, 'bell: BR_BELL, geometry: BR_GEOM\n  };', 'bell: BR_BELL, geometry: BR_GEOM, extra: 1\n  };', 'data'),
});
{
  const d = readEmbedded(html034);
  const name = Object.keys(d.teachers)[0];
  d.teachers[name].A = d.teachers[name].A.slice(1);
  const line = html034.split('\n').find(l => l.startsWith('const PUBLISHED_DATA = '));
  const r = check({ html034: html034.replace(line, 'const PUBLISHED_DATA = ' + JSON.stringify(d) + ';'), ledger });
  ok(r.failures.length === 1 && r.failures[0].code === 'DATA', "034's data with a short day fails DATA");
  ok(r.failures.every(f => !f.message.includes(name)), 'and the failure does not print the teacher\'s name');
}

/* ── the contract ───────────────────────────────────────────────────── */

console.log('published-contract — on made-up data');
function sample() {
  return {
    school: 'Northwind Middle', publishedOn: '2026-01-15',
    dept: { ELA: { c: '#2563eb', name: 'English' }, MATH: { c: '#c2520f', name: 'Math' } },
    order: { ELA: 0, MATH: 1 },
    teachers: {
      'Ms. Okafor': { dept: 'ELA', room: '204', plan: 'A2', sec: ['7-3'], A: ['7-3', 'Planning'], B: ['7-3', '7-4'], co: ['Mr. Lund'] },
      'Mr. Lund': { dept: 'MATH', room: '205', plan: 'B1', sec: ['7-4'], A: ['Planning', '7-4'], B: ['Planning', '7-3'], co: ['Ms. Okafor'] },
    },
    sections: { '7-3': ['Ms. Okafor', 'Mr. Lund'], '7-4': ['Mr. Lund', 'Ms. Okafor'] },
    room2teacher: { 204: 'Ms. Okafor', 205: 'Mr. Lund' },
    groupRooms: { '7-3': { A: ['204', null], B: ['204', '205'] }, '7-4': { A: [null, '205'], B: ['204', null] } },
    modCount: 2, modLabel: 'Block',
    bell: { A: ['8:00', '9:30'], B: ['8:00', '9:30'] },
    geometry: { floors: [{ id: 'f1', label: 'Floor 1', cols: 4, rows: 3, hall: [[0, 1]], stair: [[3, 1]],
      rooms: [{ rn: '204', dept: 'ELA', teacher: 'Ms. Okafor', cells: [[1, 0]] },
        { rn: '205', dept: 'MATH', teacher: 'Mr. Lund', cells: [[2, 0], [2, 1]] }] }] },
  };
}
const base = validate(sample());
ok(base.ok && base.format === 0 && base.warnings.length === 0, 'the sample is valid format 0 with no warnings: ' + JSON.stringify(base));
const errCase = (label, mutate) => {
  const d = sample(); mutate(d);
  const r = validate(d);
  ok(!r.ok && r.errors.length >= 1, `error: ${label} (${JSON.stringify(r.errors)})`);
};
errCase('a wrong type', d => { d.modLabel = 3; });
errCase('a slot array not modCount long', d => { d.teachers['Ms. Okafor'].A.push('7-3'); });
errCase('a slot naming no group', d => { d.teachers['Ms. Okafor'].B[1] = '8-1'; });
errCase('a sec entry that does not exist', d => { d.teachers['Mr. Lund'].sec.push('9-9'); });
errCase('a sections teacher that does not exist', d => { d.sections['7-3'].push('Dr. Nobody'); });
errCase("room2teacher[t.room] not the teacher", d => { d.room2teacher[204] = 'Mr. Lund'; });
errCase('a cell outside cols by rows', d => { d.geometry.floors[0].rooms[0].cells.push([4, 0]); });
errCase('a room number on two rooms', d => { d.geometry.floors[0].rooms[1].rn = '204'; });
errCase('a missing key', d => { delete d.teachers; });
errCase('a newer format', d => { d.format = 2; d.tool = 'v99'; });
const warnCase = (label, mutate) => {
  const d = sample(); mutate(d);
  const r = validate(d);
  ok(r.ok && r.warnings.length >= 1, `warning, not error: ${label} (${JSON.stringify(r)})`);
};
warnCase('a department code with no entry', d => { d.teachers['Mr. Lund'].dept = 'ART'; });
warnCase('a co list that is not mirrored', d => { d.teachers['Mr. Lund'].co = []; });
warnCase("a section listing a teacher whose day never shows it", d => { d.sections['7-4'].push('Ms. Okafor'); d.teachers['Ms. Okafor'].B[1] = 'Planning'; });
warnCase('a teacher with no day at all', d => { d.teachers['Mr. Lund'].A = []; });
{
  const d = sample();
  for (const k of ['groupRooms', 'bell', 'geometry']) delete d[k];
  ok(validate(d).ok, 'format 0 without groupRooms, bell and geometry is valid (pre-R60 files)');
  const d1 = upgrade(d);
  ok(!validate(d1).ok, 'format 1 needs them');
}
{
  const d = sample();
  const u = upgrade(d);
  ok(u.format === FORMAT && u.tool === 'unknown' && formatOf(u) === 1, 'upgrade() 0 → 1 adds format and tool');
  ok(JSON.stringify(upgrade(u)) === JSON.stringify(u), 'upgrade() is idempotent');
  const without = { ...u }; delete without.format; delete without.tool;
  ok(JSON.stringify(without) === JSON.stringify(d), 'upgrade() changes no field it was given');
  ok(validate(u).ok, 'an upgraded sample is valid format 1');
  ok(JSON.stringify(sample()) === JSON.stringify(d), 'upgrade() does not touch its input');
  let threw = false;
  try { upgrade({ ...d, format: 2 }); } catch { threw = true; }
  ok(threw, 'upgrade() throws on format 2');
  const t = upgrade({ ...d, tool: 'v61' });
  ok(t.tool === 'v61', 'upgrade() keeps a tool it was given');
}
{
  const d = sample();
  const shape = JSON.stringify(shapeOf(d));
  const strings = [];
  (function walk(v, k) {
    if (k) strings.push(k);
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, Array.isArray(v) ? null : kk);
  })(d);
  // Field names are the schema, not data; everything else (names, rooms,
  // groups, colours, dates) must not appear.
  const SCHEMA = new Set(DATA_KEYS.concat(['dept', 'room', 'plan', 'sec', 'A', 'B', 'co', 'c', 'name', 'id', 'label',
    'cols', 'rows', 'hall', 'stair', 'rooms', 'rn', 'teacher', 'cells', 'floors']));
  const leaked = strings.filter(s => !SCHEMA.has(s) && shape.includes(s));
  ok(leaked.length === 0, 'shapeOf() prints no string from its input: ' + JSON.stringify(leaked));
}
{
  const d = readEmbedded(html034);
  const r = validate(d);
  ok(r.ok && r.format === 0, "034's committed data is valid format 0");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
