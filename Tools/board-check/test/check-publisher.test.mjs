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
import { check, readPublisher, moduleSources, assemble, freeNames, ROOT, PAGE_035, PAGE_034, LEDGER }
  from '../check-publisher.mjs';
import { FORMAT, DATA_KEYS, PUBLISHED_KEYS, formatOf, validate, upgrade, readEmbedded, shapeOf }
  from '../../schedule-visualizer/test/published-contract.mjs';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

const html035 = fs.readFileSync(path.join(ROOT, PAGE_035), 'utf8').replace(/\r/g, '');
const html034 = fs.readFileSync(path.join(ROOT, PAGE_034), 'utf8').replace(/\r/g, '');
// Since Path 11 P2 increment 7 the publisher is a module the page imports;
// every break below edits it (b35) and hands the guard the edited copy.
const BROWSER = 'Tools/schedule-visualizer/sv-browser.js';
const modules035 = moduleSources(html035);
const browser035 = modules035.find(m => m.file === BROWSER).code;
const withBrowser = code => modules035.map(m => m.file === BROWSER ? { file: m.file, code } : m);
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
ok(JSON.stringify(pub.dataKeys) === JSON.stringify(PUBLISHED_KEYS), 'the publisher writes the contract\'s keys, format and tool first');
ok(pub.dataFormat === FORMAT, `the publisher writes format ${FORMAT} (got ${pub.dataFormat})`);
ok(pub.plan.items.find(e => e.kind === 'data').escaped === true, "PUBLISHED_DATA is written with every < escaped");
ok(assemble(pub, { school: '</script><b>' }).includes('"school":"\\u003c/script>\\u003cb>"'),
  'assemble() escapes < in the data as the page does');
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
function expect(label, codes, { h35 = html035, b35 = browser035, mods, h34 = html034, led = ledger, mention } = {}) {
  const r = check({ html035: h35, modules035: mods || withBrowser(b35), html034: h34, ledger: led });
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

// Path 11 P2 increment 7: the publisher lives in a module the page imports.
ok(modules035.some(m => m.file === BROWSER), 'moduleSources() follows the page\'s module script to ' + BROWSER);
ok(pub.fns.every(f => f.file === BROWSER), 'every listed function is declared in ' + BROWSER);
expect('the page read without its modules', ['SHAPE'], { mods: [] });
expect('export in front of a listed function', [], {
  b35: edit(browser035, 'function brSetGrpDay(', 'export function brSetGrpDay(', 'export')
    .replace('brGroupMapHTML, brSetGrpDay, ', 'brGroupMapHTML, '),
});
expect('a listed function also declared in the page', ['LIST'], {
  h35: edit(html035, '</head>', '<script>function brJumpGroup() {}</script>\n</head>', 'page'), mention: 'brJumpGroup',
});

// The Round 7 bug: escHtml left out of the published constants.
expect('escHtml taken out of consts', ['FREE'], {
  b35: edit(browser035, "    'const escHtml = '   + escHtml.toString()   + ';',\n", '', 'escHtml'),
  led: ledgerWithout('escHtml'), mention: 'escHtml',
});
expect('a listed function renamed at its declaration', ['LIST'], {
  // (renamed in the module's export list too, or the module would not parse)
  b35: edit(browser035, 'function brSetGrpDay(', 'function brSetGrpDayRenamed(', 'rename')
    .replace('brGroupMapHTML, brSetGrpDay, ', 'brGroupMapHTML, brSetGrpDayRenamed, '), mention: 'brSetGrpDay',
});
{
  // brFormatDateLong(d) { … } turned into an arrow constant.
  const m = /function brFormatDateLong\(([^)]*)\) \{/.exec(browser035);
  expect('a listed function turned into const f = () =>', ['LIST'], {
    b35: browser035.replace(m[0], `const brFormatDateLong = (${m[1]}) => {`), mention: 'brFormatDateLong',
  });
}
// In a module a second declaration is a syntax error, so this is PARSE now;
// LIST still catches the page declaring a name the module also declares (above).
expect('a listed function declared twice in the module', ['PARSE'], {
  b35: edit(browser035, 'function brJumpGroup(', 'function brJumpGroup() {}\nfunction brJumpGroup(', 'dup'), mention: 'brJumpGroup',
});
expect("'const brDColor = ' + brDeptInk.toString()", ['CONST'], {
  b35: edit(browser035, "'const brDColor = '  + brDColor.toString()", "'const brDColor = '  + brDeptInk.toString()", 'const'),
  mention: 'brDColor',
});
expect('AppState.settings read inside brRenderTeacher', ['LIVE'], {
  b35: edit(browser035, 'function brRenderTeacher(n) {', 'function brRenderTeacher(n) {\n  void AppState.settings;', 'appstate'),
  mention: 'AppState',
});
expect('a localStorage read in a published function', ['LIVE'], {
  b35: edit(browser035, 'function brRenderGroup(sec) {', "function brRenderGroup(sec) {\n  void localStorage.getItem('x');", 'ls'),
  mention: 'localStorage',
});
expect('a URL in BR_CSS', ['LIVE'], {
  b35: edit(browser035, 'const BR_CSS = `#app-browser {', 'const BR_CSS = `@import url(https://fonts.example.com/a.css);\n#app-browser {', 'url'),
});
expect('onclick="brNope()" in the markup template', ['HANDLER'], {
  b35: edit(browser035, '<p class="sub">Teacher Schedule Browser</p>', '<p class="sub" onclick="brNope()">Teacher Schedule Browser</p>', 'handler'),
  mention: 'brNope',
});
expect('br-view renamed in the markup', ['ID'], {
  // The publisher's template, in the module; 035's own embedded browser keeps its copy in the page.
  b35: edit(browser035, '<div id="br-view"', '<div id="br-viewport"', 'id'),
  mention: 'br-view',
});
expect("brGrpDay = 'B' in the preamble only", ['STATE'], {
  b35: edit(browser035, `"let brGrpDay = 'A', brMapFloorIdx = 0;",`, `"let brGrpDay = 'B', brMapFloorIdx = 0;",`, 'state'),
  mention: 'brGrpDay',
});
expect('an undeclared assignment in a published function', ['STRICT'], {
  b35: edit(browser035, 'function brSetGrpDay(', 'function brSetGrpDay__unused() { brStrayGlobal = 1; }\nfunction brSetGrpDay(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brSetGrpDay__unused,"),
  led: ledgerWith('absent', 'brSetGrpDay__unused'), mention: 'brStrayGlobal',
});
// The module is strict code itself, so a duplicate parameter no longer parses there.
expect('a duplicate parameter in a published function', ['PARSE'], {
  b35: edit(browser035, 'function brJumpGroup(', 'function brJumpGroup__unused(a, a) { return a; }\nfunction brJumpGroup(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brJumpGroup__unused,"),
  led: ledgerWith('absent', 'brJumpGroup__unused'),
});
expect('a <link> in the published head', ['HEAD'], {
  b35: edit(browser035, `+ '<meta charset="UTF-8">\\n'`, `+ '<meta charset="UTF-8">\\n<link rel="icon" href="x.png">\\n'`, 'head'),
});
expect('a spread in the function list', ['SHAPE'], {
  b35: edit(browser035, 'brFormatDateLong, brCheckStaleness\n  ];', 'brFormatDateLong, brCheckStaleness, ...[]\n  ];', 'spread'),
});
expect('a ternary in consts', ['SHAPE'], {
  b35: edit(browser035, "    'const BR_STALE_DAYS = ' + BR_STALE_DAYS + ';'", "    (1 ? 'const BR_STALE_DAYS = ' + BR_STALE_DAYS + ';' : '')", 'ternary'),
});
expect('a backtick in a BR_CSS comment', ['PARSE'], {
  b35: edit(browser035, 'const BR_CSS = `#app-browser {', 'const BR_CSS = `/* a `tick` */\n#app-browser {', 'tick'),
});
{
  const m = /function brOverviewHTML\([^)]*\) \{\n/.exec(browser035);
  expect('one character changed in brOverviewHTML in 035 only', ['FORK'], {
    b35: browser035.replace(m[0], m[0] + ' '), mention: 'brOverviewHTML',
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
  b35: edit(browser035, 'function brJumpGroup(', 'function brExtraPiece() { return 1; }\nfunction brJumpGroup(', 'x')
    .replace("brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brExtraPiece,"),
  mention: 'brExtraPiece',
});
// It brings its own holes with it (two free names, a handler for an
// unpublished function), which the guard names too; what this case holds is
// that the KNOWN_FREE entry is reported as expired.
expect('brRenderMapLegacy published after all (KNOWN_FREE expired)', ['FREE', 'HANDLER'], {
  // It is declared in 035 already, behind the dead door; listing it is enough.
  b35: edit(browser035, "brOpenMapFloorIdx, brSetMapFloorIdx,", "brOpenMapFloorIdx, brSetMapFloorIdx, brRenderMapLegacy,", 'x'),
  led: ledgerWith('absent', 'brRenderMapLegacy'), mention: 'KNOWN_FREE',
});
expect('the publisher writes a data key the contract does not have', ['DATA'], {
  b35: edit(browser035, 'bell: BR_BELL, geometry: BR_GEOM\n  };', 'bell: BR_BELL, geometry: BR_GEOM, extra: 1\n  };', 'data'),
});
expect('the publisher drops format from its data', ['DATA'], {
  b35: edit(browser035, '    format: 1, tool: TOOL_VERSION,\n', '    tool: TOOL_VERSION,\n', 'format'),
});
expect('the publisher writes format 2, past the contract', ['DATA'], {
  b35: edit(browser035, '    format: 1, tool: TOOL_VERSION,', '    format: 2, tool: TOOL_VERSION,', 'format'), mention: 'FORMAT is 1',
});
expect('PUBLISHED_DATA written without escaping <', ['DATA'], {
  b35: edit(browser035, "JSON.stringify(data).replace(/</g, '\\\\u003c')", 'JSON.stringify(data)', 'escape'), mention: 'u003c',
});
expect('PUBLISHED_DATA escaped with some other replacement', ['SHAPE'], {
  b35: edit(browser035, "JSON.stringify(data).replace(/</g, '\\\\u003c')", "JSON.stringify(data).replace(/</g, '&lt;')", 'escape'),
});
expect('a constant in consts written escaped', ['SHAPE'], {
  b35: edit(browser035, "'const BR_LEGACY_SHORT = ' + JSON.stringify(BR_LEGACY_SHORT) + ';'",
    "'const BR_LEGACY_SHORT = ' + JSON.stringify(BR_LEGACY_SHORT).replace(/</g, '\\\\u003c') + ';'", 'consts'),
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
{
  // Northwind as v61 published it (taken from the baseline before v62), the
  // file a later reader must still read (Devon, P11-5).
  const f0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'Tools/schedule-visualizer/test/fixture-published-format0.json'), 'utf8'));
  const r = validate(f0);
  ok(r.ok && r.format === 0 && r.warnings.length === 0, 'fixture-published-format0.json is valid format 0 with no warnings: ' + JSON.stringify(shapeOf(f0)));
  ok(!('format' in f0) && !('tool' in f0), 'and carries neither format nor tool');
  const u = upgrade(f0);
  ok(validate(u).ok && u.format === 1 && u.tool === 'unknown', 'it upgrades to a valid format 1');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
