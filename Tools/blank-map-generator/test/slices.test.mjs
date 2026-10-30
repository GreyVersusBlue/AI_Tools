// slices.test.mjs — bmg-slices.js on its own (Path 20 P4), pure Node, no port.
// Named cases for the time-slice store: a project with no slices is untouched, switching keeps each slice's
// annotations apart and exact, copy versus blank, the limit, deleting, naming and years, ordering, reading a
// slice's content, and cleaning what arrives from a link or file. Then each MUTANT re-imports the source with
// one deliberate defect and the suite must notice.
//
//   node Tools/blank-map-generator/test/slices.test.mjs   (npm run test:blank-map-slices)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Real from '../bmg-slices.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'bmg-slices.js'), 'utf8');

const proj = () => ({
  mapId: 'vector:world:x', view: { x: 0, y: 0, scale: 1 },
  labels: [{ id: 'a', text: 'Rome', x: 10, y: 20 }], markers: [{ id: 'm', x: 1, y: 2 }], regions: [{ id: 'r', rings: [[[0, 0], [1, 1], [0, 1]]] }], lines: [],
  legendText: { blue: 'City' }, regionLegendText: {}, lineLegendText: {}, choroLegendText: {}, labelLegendText: {}, legendOrder: ['x'],
});

function suite(M) {
  const bad = [];
  const t = (c, l) => { if (!c) bad.push(l); };
  const j = v => JSON.stringify(v);

  // no slices: nothing changes
  let p = proj();
  t(!M.hasSlices(p) && M.activeSlice(p) === null && M.contentOf(p, 's1') === null, 'a project with no slices has none');
  t(M.switchTo(p, 's1') === false && M.removeSlice(p, 's1') === false, 'and switching or removing on it does nothing');

  // enable: the current map is slice 1
  p = proj();
  const first = M.enableSlices(p, { name: 'Roman Republic', year: -44 });
  t(p.slices.list.length === 1 && first.id === 's1' && p.slices.active === 's1' && first.year === -44 && first.name === 'Roman Republic', 'enabling makes the current map the first slice');
  t(p.labels.length === 1, 'and leaves the live fields alone');
  t(M.enableSlices(p) === first, 'enabling twice changes nothing');

  // add blank, switch, edit, switch back
  const id2 = M.addSlice(p, { name: 'Roman Empire', year: 117 });
  t(id2 === 's2' && p.slices.list.map(s => s.id).join() === 's1,s2', 'a new slice goes after the active one');
  t(p.slices.active === 's1', 'adding does not switch');
  t(M.switchTo(p, 's2') && p.labels.length === 0 && p.markers.length === 0 && j(p.legendText) === '{}' && p.legendOrder.length === 0, 'a blank slice has no labels, markers, key text or order');
  t(p.mapId === 'vector:world:x' && p.view.scale === 1, 'the map and the view are the project\'s, not the slice\'s');
  p.labels.push({ id: 'b', text: 'Constantinople', x: 5, y: 5 });
  p.legendText.blue = 'Capital';
  t(M.switchTo(p, 's1') && p.labels.length === 1 && p.labels[0].text === 'Rome' && p.legendText.blue === 'City', 'switching back brings the first slice back exactly');
  t(M.switchTo(p, 's2') && p.labels.length === 1 && p.labels[0].text === 'Constantinople' && p.legendText.blue === 'Capital', 'and the second one keeps what it was given');
  t(p.slices.list.find(s => s.id === 's2').content === null && p.slices.list.find(s => s.id === 's1').content !== null, 'only the inactive slice holds a stored copy');

  // stored copies are independent of live edits
  M.switchTo(p, 's1');
  const stored = p.slices.list.find(s => s.id === 's2').content;
  p.labels[0].text = 'Roma';
  t(stored.labels[0].text === 'Constantinople', 'editing the live map does not reach another slice\'s copy');
  t(M.contentOf(p, 's1').labels[0].text === 'Roma', 'contentOf reads the live fields for the active slice');
  t(M.contentOf(p, 's2').labels[0].text === 'Constantinople', 'and the stored copy for the other');
  const c = M.contentOf(p, 's2'); c.labels.push({ id: 'z' });
  t(M.contentOf(p, 's2').labels.length === 1, 'what contentOf returns is a copy');

  // copy
  const id3 = M.addSlice(p, { copy: true });
  t(id3 === 's3' && p.slices.list.map(s => s.id).join() === 's1,s3,s2', 'a copy goes after the active slice');
  M.switchTo(p, 's3');
  t(p.labels.length === 1 && p.labels[0].text === 'Roma', 'a copied slice starts as what was on the map');
  p.labels[0].text = 'Copy';
  M.switchTo(p, 's1');
  t(p.labels[0].text === 'Roma', 'and editing the copy leaves the original');
  t(p.slices.list.find(s => s.id === 's3').name === 'Slice 3', 'an unnamed slice is named by its place in the list: ' + p.slices.list.find(s => s.id === 's3').name);

  // names unique, years parsed
  t(M.setSliceMeta(p, 's2', { name: 'Roman Republic' }) && p.slices.list.find(s => s.id === 's2').name === 'Roman Republic (2)', 'a name already in use gets a number');
  M.setSliceMeta(p, 's2', { year: '117' });
  t(p.slices.list.find(s => s.id === 's2').year === 117, 'a year typed as text is read');
  t(M.parseYear('12.5') === null && M.parseYear('abc') === null && M.parseYear('') === null && M.parseYear(1e9) === null && M.parseYear(' -44 ') === -44, 'a year is a whole number in range or nothing');
  t(M.yearText(-44) === '44 BCE' && M.yearText(1803) === '1803' && M.yearText(null) === '', 'years read as dates');
  M.setSliceMeta(p, 's3', { name: 'x'.repeat(200) });
  t(p.slices.list.find(s => s.id === 's3').name.length === 80, 'a name is cut at 80 characters');

  // order
  M.setSliceMeta(p, 's3', { year: 500 });
  M.setSliceMeta(p, 's1', { year: -44 });
  M.sortByYear(p);
  t(p.slices.list.map(s => s.id).join() === 's1,s2,s3' && p.slices.active === 's1', 'sorting by year puts the oldest first and keeps the active slice');
  const q = proj(); M.enableSlices(q); M.addSlice(q, { year: 10 }); M.addSlice(q, {}); M.addSlice(q, { year: 5 }); M.setSliceMeta(q, 's1', { year: null });
  M.sortByYear(q);
  t(q.slices.list.map(s => s.year).join() === '5,10,,' && q.slices.list.slice(2).map(s => s.id).join() === 's1,s3', 'dated slices come oldest first, then the undated in their order: ' + q.slices.list.map(s => s.id + ':' + s.year).join());

  // limit
  const r = proj(); M.enableSlices(r);
  let made = 0; while (made < 40 && M.addSlice(r, {}) !== null) made++;
  t(r.slices.list.length === M.MAX_SLICES && made === M.MAX_SLICES - 1, 'at most ' + M.MAX_SLICES + ' slices: ' + r.slices.list.length);

  // remove
  const u = proj(); M.enableSlices(u); M.addSlice(u, { name: 'B' }); M.addSlice(u, { name: 'C' });
  t(M.removeSlice(u, 's9') === false, 'removing an unknown slice does nothing');
  M.switchTo(u, 's2');
  u.labels.push({ id: 'q', text: 'B' });
  t(M.removeSlice(u, 's2') && u.slices.list.length === 2 && u.slices.active !== 's2' && u.labels.every(l => l.text !== 'B'), 'removing the active slice shows a neighbour and drops its labels');
  t(M.removeSlice(u, u.slices.list[0].id) && !M.removeSlice(u, u.slices.list[0].id), 'the last slice cannot be removed');

  // clean
  const dirty = {
    list: [
      { id: 's1', name: 'One', year: 1803.5, content: { labels: [{ id: 'x' }], markers: 'nope', legendText: { a: 'b' }, evil: 1 } },
      { id: 's1', name: 'Dup', year: 5 },
      { id: '__proto__', name: 'bad' },
      { id: 's7', name: 'One', year: '12' },
      7, null,
    ],
    active: 'nope', next: 'x',
  };
  const cl = M.cleanSlices(dirty);
  t(cl && cl.list.length === 2 && cl.active === 's1' && cl.next === 8, 'cleaning keeps the usable slices, falls back to the first as active and numbers the next after the highest: ' + j(cl && { n: cl.list.length, a: cl.active, nx: cl.next }));
  t(cl.list[0].year === null && cl.list[1].year === 12 && cl.list[1].name === 'One (2)', 'a fractional year is dropped, a text year read, a repeated name numbered');
  t(cl.list[0].content === null, 'the active slice carries no stored content (the project\'s own fields are it)');
  const inact = M.cleanSlices({ list: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', content: { labels: [{ id: 'x' }], markers: 'nope', legendText: { a: 'b' }, evil: 1 } }], active: 's1' });
  const ic = inact.list[1].content;
  t(j(ic.labels) === '[{"id":"x"}]' && j(ic.markers) === '[]' && j(ic.legendText) === '{"a":"b"}' && !('evil' in ic), 'stored content keeps its known fields, blanks the wrong ones and drops the unknown');
  t(M.cleanSlices(null) === undefined && M.cleanSlices({}) === undefined && M.cleanSlices({ list: [] }) === undefined && M.cleanSlices({ list: [1] }) === undefined, 'nothing usable cleans to nothing');
  t(M.cleanSlices({ list: Array.from({ length: 40 }, (_, i) => ({ id: 's' + (i + 1), name: 'n' + i })) }).list.length === M.MAX_SLICES, 'a flood of slices is cut at the limit');
  t(M.cleanSlices({ list: [{ id: 's1', name: 'A' }, { id: 's2', content: { labels: new Array(5001).fill({}) } }] }).list[1].content.labels.length === 0, 'a stored list of over 5,000 items is dropped');
  return bad;
}

const MUTANTS = [
  ['switching does not capture the live fields', 'captureLive(project);\n  const c = target.content', 'const c = target.content'],
  ['a blank slice is a copy', "content: copy ? clone(activeSlice(project).content) : blankContent()", "content: clone(activeSlice(project).content)"],
  ['the limit is off', 'if (S.list.length >= MAX_SLICES) return null;', ';'],
  ['the last slice can be removed', 'project.slices.list.length < 2', 'project.slices.list.length < 1'],
  ['names may repeat', 'if (!taken.has(base)) return base;', 'return base;'],
  ['a fractional year passes', 'Number.isInteger(n) && n >= MIN_YEAR', 'n >= MIN_YEAR'],
  ['undated slices sort first', "if (ay === null) return 1;", "if (ay === null) return -1;"],
  ['contentOf returns the stored object, not a copy', "clone(s.content || blankContent())", "(s.content || blankContent())"],
  ['cleaning keeps unknown ids', "/^s\\d{1,6}$/.test(r.id)", "true"],
  ['cleaning keeps a wrong-shaped field', "ARRAY_FIELDS.has(f) ? Array.isArray(v) && v.length <= MAX_ITEMS : isObj(v)", "v !== undefined"],
  ['cleaning has no count limit', 'raw.list.slice(0, MAX_SLICES)', 'raw.list'],
  ['next does not follow the highest id', 'Math.max(top + 1, Number.isInteger(raw.next) ? raw.next : 0)', 'Number.isInteger(raw.next) ? raw.next : 0'],
  ['a new slice is placed at the end', 'S.list.splice(at, 0,', 'S.list.splice(S.list.length, 0,'],
  ['the active slice keeps a stale stored copy', 'target.content = null; // the live', '; // the live'],
];

let failed = 0;
const realBad = suite(Real);
failed += realBad.length;
realBad.forEach(m => console.error('FAIL  ' + m));

for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { failed++; console.error(`FAIL  mutant "${name}": the text it changes is not in bmg-slices.js any more`); continue; }
  const mod = await import('data:text/javascript;base64,' + Buffer.from(SRC.replace(from, to)).toString('base64'));
  let caught;
  try { caught = suite(mod); } catch (e) { caught = ['threw ' + e.message]; }
  if (!caught.length) { failed++; console.error(`FAIL  mutant "${name}" was NOT caught`); }
}

console.log(failed ? `slices: ${failed} FAILED` : `slices: OK — every case passes, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
