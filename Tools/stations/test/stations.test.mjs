// stations.test.mjs — pure-logic tests for _shared/stations.js (Path 18 P1).
//
//   node Tools/stations/test/stations.test.mjs      (or: npm run test:stations)
//
// stations.js is a classic script publishing window.Stations, so it runs here in a vm
// context with no document, the way export.test.mjs loads export.js. Parity is held against
// the pages' OWN functions, cut out of the HTML by name at run time (018's validStations and
// 019's validStations / buildRoomPayload / stationPayloadFor / trStationNext), and against
// the frozen v382 er-match (_old-er-match.txt), so a drift in either shows here instead of being retyped
// here. P2 deletes those page functions; this suite then reads `Stations` alone (its header
// says so where it matters).
//
// The suite also runs itself against three deliberately broken copies of the module and
// requires each to fail (the "break-on-purpose" checks): a green suite that cannot go red is
// no suite. Every name is invented. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as F from './_fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(site, f), 'utf8');
const SRC = read('_shared/stations.js');

const BASE = 'http://127.0.0.1:1/Tools/019-escape-room-builder.html';

function loadModule(src) {
  const win = {};
  const ctx = { window: win, btoa, unescape, encodeURIComponent, URL, Math, Date, JSON, Object, Array, String, parseInt, parseFloat, isNaN, isFinite, RegExp, Error };
  vm.createContext(ctx);
  vm.runInContext(read('_shared/vendor/qrcode/qrcode.js'), ctx);
  win.qrcode = ctx.qrcode;   // a vm top-level var lands on the context; qr-draw.js reads it off window
  ctx.TextEncoder = TextEncoder;
  vm.runInContext(read('_shared/qr-draw.js'), ctx);
  vm.runInContext(src, ctx);
  // the matcher as it stood before it was folded into the module (v382's er-match.js, frozen), in its own
  // context, so the module's copy is held to it and cannot drift unseen
  const old = { window: {} };
  vm.createContext(old);
  vm.runInContext(read('Tools/stations/test/_old-er-match.txt'), old);
  return { S: win.Stations, M: old.window.EscapeRoomMatch, ctx };
}

/* A function cut out of a page by name (brace matching; none of these hold a brace in a string). */
function cut(html, name) {
  const at = html.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('page function not found: ' + name);
  let i = html.indexOf('{', at), depth = 0;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(at, i + 1);
}

const jc = (o) => JSON.parse(JSON.stringify(o));

function suite(src) {
  const { S, M } = loadModule(src);
  const fails = []; let passed = 0;
  const ok = (c, l) => { if (c) passed++; else { fails.push(l); } };
  const sortK = (v) => Array.isArray(v) ? v.map(sortK) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortK(v[k])])) : v;
  const eq = (a, b, l) => ok(JSON.stringify(sortK(a)) === JSON.stringify(sortK(b)), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

  const html019 = fs.readFileSync(path.join(here, '_old-019-functions.txt'), 'utf8');   // 019's v379 functions, frozen (P2 deleted two from the page)
  const html018 = read('Tools/018-qr-scavenger-hunt-builder.html');
  // 019's own functions, run against a `state` we set
  const pageCtx = { state: null, ER: { src: (x) => x }, btoa, unescape, encodeURIComponent, JSON, Math, parseInt, parseFloat, String, Object };
  vm.createContext(pageCtx);
  vm.runInContext([cut(html019, 'splitAnswers'), cut(html019, 'clampShift'), cut(html019, 'validStations'),
    cut(html019, 'buildRoomPayload'), cut(html019, 'stationPayloadFor'), cut(html019, 'trStationNext'), cut(html019, 'unreachableStations')].join('\n'), pageCtx);
  const huntCtx = { state: null, Stations: { ensureIds: () => false }, HI: { src: (v) => v }, ensureStationDefaults: (s) => s, ensureStationCodeWords: () => {}, parseFloat, JSON, String, Object };
  vm.createContext(huntCtx);
  vm.runInContext([cut(html018, 'looksLikeUrl'), cut(html018, 'normalizeContent'), cut(html018, 'validStations')].join('\n'), huntCtx);

  const rooms = { R2: F.R2, R3: F.R3, R4: F.R4, R5: F.R5, R6: F.R6, R7: F.R7, R8: F.R8, R9: F.R9, R11: F.R11 };
  const hunts = { H2: F.H2, H4: F.H4, H5: F.H5 };

  // detect
  eq(S.detect(F.H2()), 'hunt', 'detect hunt'); eq(S.detect(F.R2()), 'room', 'detect room');
  eq(S.detect({ stations: [] }), null, 'detect empty is not a set'); eq(S.detect(null), null, 'detect null');
  eq(S.detect(F.H4()), 'hunt', 'detect cardsPerPage 9');

  // ids: four [a-z0-9], unique, drawn only where missing, kept on a second read, duplicates redrawn
  for (const [n, mk] of Object.entries({ ...rooms, ...hunts })) {
    const set = S.read(mk());
    ok(set.stations.every(s => /^[a-z0-9]{4}$/.test(s.id)), `${n}: ids are four [a-z0-9]`);
    ok(new Set(set.stations.map(s => s.id)).size === set.stations.length, `${n}: ids unique`);
    eq(set._drew >= set.stations.length, true, `${n}: _drew counts what was drawn`);
    const o = mk(); o.stations.forEach((s, i) => { s.id = 'k' + (100 + i); });
    const s2 = S.read(o);
    eq(s2.stations.map(s => s.id), o.stations.map(s => s.id), `${n}: ids already there are kept`);
  }
  {
    const o = F.R2(); o.stations[0].id = 'aaaa'; o.stations[1].id = 'aaaa'; o.stations[2].id = 'bad id';
    const set = S.read(o);
    eq(set.stations[0].id, 'aaaa', 'duplicate: the first keeps its id');
    ok(set.stations[1].id !== 'aaaa' && /^[a-z0-9]{4}$/.test(set.stations[1].id), 'duplicate: the later one is redrawn');
    ok(/^[a-z0-9]{4}$/.test(set.stations[2].id), 'malformed id is redrawn');
    const e = F.R2(); e.stations[0].id = 'aaaa'; e.stations[1].id = 'aaaa';
    eq(S.ensureIds(e), true, 'ensureIds reports a draw'); ok(e.stations.every(s => /^[a-z0-9]{4}$/.test(s.id)) && e.stations[0].id === 'aaaa' && e.stations[1].id !== 'aaaa', 'ensureIds fixes in place');
    eq(S.ensureIds(e), false, 'ensureIds is quiet the second time');
    const h = F.H2(); eq(S.ensureIds(h), true, 'ensureIds on a hunt'); ok(typeof h.id === 'string' && h.id.length >= 8, 'a hunt gets a set id');
    { const r = F.R2(); S.ensureIds(r); eq(r.id, undefined, 'a room object gets no id field of its own (roomId is its id)'); }
  }
  { let seq = 0; const r = () => ((seq++ * 7919) % 1000) / 1000; ok(/^[a-z0-9]{4}$/.test(S.newId([], r)), 'newId(rng)'); ok(S.newId(['aaaa']) !== 'aaaa', 'newId avoids used'); }

  // read(): the fields each case names
  const R2 = S.read(F.R2());
  eq(R2.kind, 'room', 'R2 kind'); eq(R2.id, 'cryptammon1', 'R2 keeps roomId as the set id'); eq(R2.title, 'Crypt of Ammon', 'R2 title');
  eq(R2.stations[1].next, R2.stations[3].id, 'R2: next 3 becomes the id of the raw list\'s fourth station');
  eq(R2.stations[0].hint.points, 10, 'R2: hintCost -> hint.points'); eq(R2.stations[0].letter, 'S', 'R2: awardLetter -> letter');
  eq(R2.stations[0].answer.accepted, ['amun', 'ammon'], 'R2: accepted is the split list'); eq(R2.stations[0].encode, 'player', 'room encodes the player link');
  eq(S.read(F.R3()).stations[0].next, null, 'R3: a dangling next is null');
  eq(S.read(F.R4()).stations[0].next, 'end', 'R4: end is kept');
  { const s = S.read(F.R5()); eq(s.stations[0].answer.accepted, ['typed before switching'], 'R5: cipher keeps the hidden answers'); eq(s.stations[0].answer.cipher.plain, 'Hello World, hi', 'R5: cipherPlain'); eq(s.stations[1].answer.cipher.plain, 'leftover', 'R5: a text station keeps its leftover cipherPlain'); }
  { const s = S.read(F.R6()); eq(s.stations.map(x => x.answer.cipher.shift), [0, null, 7], 'R6: shift 0, missing, 7 stay different');
    eq(S.playable(s).map(x => x._norm.cipherShift), [13, 3, 7], 'R6: clampShift at play time gives 13, 3, 7'); }
  { const s = S.read(F.R7()); eq(s.stations[0].answer.tolerance, 0.5, 'R7: tolerance kept on a digits station'); const p = S.playPayload(s, {}); ok(!('numericTolerance' in p.stations[0]), 'R7: left out of the payload on digits'); eq(p.stations[1].numericTolerance, 0.01, 'R7: in the payload on text'); }
  eq(S.read(F.R8()).stations.map(s => s.image), ['idb:abc123', 'data:image/png;base64,AAAA', ''], 'R8: images verbatim');
  { const s = S.read(F.R9()); eq(s.stations[0].answer.type, 'maze', 'R9: an unknown type is kept');
    eq(S.check(s.stations[0], 'x').correct, M.checkAnswer({ answers: ['x'], type: 'maze' }, 'x').correct, 'R9: check() treats it as er-match does (exact)');
    eq(S.check(s.stations[0], 'x y').correct, false, 'R9: exact, not forgiving'); }
  { const a = S.read(F.R10()), b = S.read(F.R10()); ok(typeof a.id === 'string' && a.id.length >= 8, 'R10: no roomId gets a new id'); ok(a.id !== b.id, 'R10: a new id each time'); }
  { const s = S.read(F.R11()); eq([s.entry, s.countdown, s.intro], ['any', { enabled: true, minutes: 35 }, 'You wake in a crypt.'], 'R11: entry, countdown, intro'); eq(S.playPayload(s, {}).timerMinutes, 35, 'R11: timerMinutes in the payload'); }
  { const s = S.read(F.H2());
    eq(s.stations.map(x => x.answer.type), ['none', 'number', 'choice'], 'H2: types map');
    eq(s.stations[1].answer.accepted, ['5'], 'H2: the numeric target stays a string'); eq(s.stations[1].answer.tolerance, 1.5, 'H2: tolerance parsed'); eq(s.stations[1].answer.toleranceText, '1.50', 'H2: tolerance text kept');
    eq(s.stations[0].hint.minutes, 30, 'H2: hintPenalty parsed'); eq(s.print.cardsPerPage, '4', 'H2: cardsPerPage stays a string');
    const idOf = (i) => s.stations[i].id;
    eq(Object.keys(s.run.teams[0].marks).sort(), [idOf(0), idOf(1)].sort(), 'H2: run keyed by id');
    eq(s.run.teams[1].marks[idOf(2)], { at: 3000, correct: true }, 'H2: an old numeric mark is upgraded');
    eq(s.run.teams[0].hintsUsed[idOf(0)], { at: 900, penaltyMin: 30 }, 'H2: hintsUsed by id'); eq(s.run.checkinStation, idOf(0), 'H2: checkinStation is an id'); eq(s._dropped, 0, 'H2: nothing dropped'); }
  { const s = S.read(F.H3()); eq(s._dropped, 1, 'H3: the mark past the end is dropped and counted'); eq(Object.keys(s.run.teams[2].marks).length, 1, 'H3: the other mark stays'); }
  { const s = S.read(F.H4()); const v = S.playable(s);
    eq(v.length, 2, 'H4: the blank row is not playable'); ok(/^[a-z0-9]{4}$/.test(s.stations[1].id), 'H4: the blank row gets an id too');
    eq(Object.keys(s.run.teams[0].marks), [v[1].id], 'H4: marks map by the VALID list (index 1 is the third row)'); eq(s.run.checkinStation, v[1].id, 'H4: checkinStation by the valid list'); }
  { const s = S.read(F.H5()); eq([s.stations[0].hint.text, s.stations[0].hint.minutes, s.stations[0].codeWord], ['', 0, ''], 'H5: an old station gets defaults'); eq(s.run, null, 'H5: no run'); }
  eq(S.read(F.H6()).run.checkinStation, null, 'H6: checkinStation out of range is null');

  // write(read(f)) is f plus ids; read(write(read(f))) is read(f); the other kind and back
  for (const [n, mk] of Object.entries(rooms)) {
    const f = mk(), set = S.read(f), out = S.write(set);
    const noIds = jc(out); noIds.stations.forEach(s => delete s.id);
    const want = jc(f); want.stations.forEach(s => { if (typeof s.next === 'number' && s.next >= want.stations.length) s.next = null; });   // R3: a dangling jump is null, which is what the payload made of it
    delete noIds.roomId; delete want.roomId;
    eq(noIds, want, `${n}: write(read(f)) is f plus ids`);
    eq(out.roomId, set.id, `${n}: roomId is the set id`);
    const again = S.read(out); eq(stripIdsDeep(again), stripIdsDeep(set), `${n}: read(write(read(f))) is read(f)`);
    const hunt = S.write(set, 'hunt'); const back = S.read(S.write(S.read(hunt), 'room'));
    eq(back.stations.map(s => s.id), set.stations.map(s => s.id), `${n}: ids survive room -> hunt -> room`);
    eq(back.stations.map(s => [s.prompt, s.answer, s.hint, s.letter, s.next, s.image]), set.stations.map(s => [s.prompt, s.answer, s.hint, s.letter, s.next, s.image]), `${n}: the room survives a trip through the hunt shape`);
    eq([back.title, back.id, back.entry, back.countdown, back.print, back.intro], [set.title, set.id, set.entry, set.countdown, set.print, set.intro], `${n}: set fields survive the trip`);
  }
  function stripIdsDeep(s) { const c = jc(s); delete c._drew; return c; }
  for (const [n, mk] of Object.entries(hunts)) {
    const f = mk(), set = S.read(f), out = S.write(set);
    const got = jc(out); delete got.id; got.stations.forEach(s => delete s.id); delete got.run;
    const want = jc(f); delete want.run;
    if (n !== 'H5') eq(got, want, `${n}: write(read(f)) is f plus ids (run aside)`);
    else eq(got.stations[0], { ...want.stations[0], hint: '', hintPenalty: '0', codeWord: '' }, 'H5: an old station comes back with the defaults filled in');
    if (f.run) {
      const ids = S.playable(set).map(s => s.id);
      eq(out.run, (() => { const r = S.remapRun(f.run, ids); delete r._dropped; return writeRunShape(r); })(), `${n}: run is written id-keyed`);
      eq(stripIdsDeep(S.read(out)), stripIdsDeep(set), `${n}: an id-keyed run reads back to the same set`);
    }
    const room = S.write(set, 'room'); const back = S.read(S.write(S.read(room), 'hunt'));
    eq(back.stations.map(s => s.id), set.stations.map(s => s.id), `${n}: ids survive hunt -> room -> hunt`);
    eq(back.stations.map(s => [s.label, s.prompt, s.note, s.codeWord, s.answer, s.hint]), set.stations.map(s => [s.label, s.prompt, s.note, s.codeWord, s.answer, s.hint]), `${n}: the hunt survives a trip through the room shape`);
  }
  function writeRunShape(r) { // what write() must emit for a remapped run
    const o = { by: 'id', teams: r.teams, timerRunning: r.timer.running, timerStartedAt: r.timer.startedAt, timerElapsedMs: r.timer.elapsedMs, raceStartAt: r.timer.raceStartAt, checkinStation: r.checkinStation };
    if (r.stagger !== undefined) o.stagger = r.stagger; return o;
  }
  { // fields the module has no name for survive
    const f = F.R2(); f.mystery = { a: 1 }; f.stations[0].flair = 'x';
    const out = S.write(S.read(f)); eq([out.mystery, out.stations[0].flair], [{ a: 1 }, 'x'], 'unknown fields survive a round trip');
    const h = F.H2(); h.run.vibes = 3; h.stations[1].flair = 'y'; const ho = S.write(S.read(h)); eq([ho.run.vibes, ho.stations[1].flair], [3, 'y'], 'unknown hunt and run fields survive');
  }
  { // editing the visible fields of a foreign-shaped copy wins over the carried copy
    const set = S.read(F.R2()); const hunt = S.write(set, 'hunt'); hunt.stations[0].content = 'Edited in the other page';
    const back = S.read(S.write(S.read(hunt), 'room')); eq(back.stations[0].prompt, 'Edited in the other page', 'a foreign edit to the prompt is kept');
  }

  // playable: parity with the pages' own validStations, on every fixture
  for (const [n, mk] of Object.entries(rooms)) {
    const f = mk(); pageCtx.state = f;
    const want = vm.runInContext('validStations()', pageCtx);
    const got = S.playable(S.read(f)).map(s => s._norm);
    want.forEach(w => { if (typeof w.next === 'number' && w.next >= f.stations.length) w.next = null; });
    eq(got, jc(want), `${n}: playable() is 019's validStations()`);
  }
  for (const [n, mk] of Object.entries(hunts)) {
    const f = mk(); huntCtx.state = f;
    const want = vm.runInContext('validStations()', huntCtx);
    const got = S.playable(S.read(f)).map(s => s._norm);
    got.forEach(g => delete g.codeWord); want.forEach(w => delete w.codeWord);   // the page's ensureStationCodeWords() is stubbed here
    eq(got, jc(want), `${n}: playable() is 018's validStations()`);
    f.stations[0].image = 'data:image/png;base64,AA'; huntCtx.state = f;
    const want2 = vm.runInContext('validStations()', huntCtx), got2 = S.playable(S.read(f), { imageSrc: (v) => v }).map(s => s._norm);
    got2.forEach(g => delete g.codeWord); want2.forEach(w => delete w.codeWord);
    eq(got2, jc(want2), `${n}: and with a station picture`);
  }

  // playPayload: today's buildRoomPayload then stationPayloadFor, plus v, ids, 'end'
  const thirty = { name: 'Thirty', roomId: 'thirtyroom1', ...F.R2(), stations: [] };
  for (let i = 0; i < 30; i++) thirty.stations.push(F.rSt({ clue: 'Station ' + i + ' clue text of ordinary length?', answers: 'answer ' + i + ', alt ' + i, hint: i % 3 ? '' : 'a hint', hintCost: i % 3 ? 0 : 5, awardLetter: i % 5 ? '' : 'Q', next: i === 4 ? 9 : null }));
  thirty.roomId = 'thirtyroom1'; thirty.name = 'Thirty';
  for (const [n, f] of [['R2', F.R2()], ['R11', F.R11()], ['R6', F.R6()], ['thirty', thirty]]) {
    pageCtx.state = f;
    const set = S.read(f), valid = vm.runInContext('validStations()', pageCtx);
    pageCtx.valid = valid;
    const whole = vm.runInContext('buildRoomPayload(valid)', pageCtx);
    const got0 = S.playPayload(set, {});
    const strip = (p) => { const c = jc(p); delete c.v; delete c.ids; return c; };
    eq(strip(got0), jc(whole), `${n}: the whole-room payload is buildRoomPayload() plus v and ids`);
    eq(got0.v, 2, `${n}: v is 2`); eq(got0.ids, S.playable(set).map(s => s.id).join(''), `${n}: ids is one fixed-width string`); eq(got0.ids.length, 4 * valid.length, `${n}: four characters a station`);
    pageCtx.room = whole;
    for (let k = 0; k < valid.length; k++) {
      pageCtx.k = k;
      const want = vm.runInContext('stationPayloadFor(room, k)', pageCtx);
      eq(strip(S.playPayload(set, { station: k })), jc(want), `${n}: station ${k}'s code payload is stationPayloadFor()`);
    }
  }
  { const set = S.read(F.R4()); eq(S.playPayload(set, {}).stations[0].next, 'end', "R4: 'end' is kept in the payload");
    const d = S.read(F.R3()); eq(S.playPayload(d, {}).stations[0].next, null, 'R3: a dangling next is still null in the payload (the player reads it as auto)'); }

  // playUrl round-trips through the same decode the player uses
  { const set = S.read(F.R11()), url = new URL(S.playUrl(set, 2, { base: BASE, start: true })), r = url.searchParams.get('r');
    const dec = JSON.parse(decodeURIComponent(escape(atob(r))));
    eq([url.pathname, url.searchParams.get('s'), url.searchParams.get('start')], ['/Tools/escape-room-builder/lock.html', '2', '1'], 'playUrl: path, s and start');
    eq(dec.id, 'cryptammon1', 'playUrl: the payload decodes'); eq(dec.ids.length, 16, 'playUrl: carries ids');
    const whole = new URL(S.playUrl(set, null, { base: BASE })); eq([whole.searchParams.get('s'), whole.searchParams.get('start')], [null, null], 'playUrl(null): no s, no start');
    eq(new URL(S.playUrl(set, 1, { base: BASE })).searchParams.get('start'), null, 'playUrl: start only when asked'); }

  // playRead: C1 (a whole room from before #320), C2 (a #320 stub code), C3 (v2)
  { const f = F.R2(); pageCtx.state = f; pageCtx.valid = vm.runInContext('validStations()', pageCtx);
    const c1 = jc(vm.runInContext('buildRoomPayload(valid)', pageCtx)); pageCtx.room = c1; const c2 = jc(vm.runInContext('stationPayloadFor(room, 1)', pageCtx));
    const c3 = S.playPayload(S.read(f), { station: 1 });
    eq(S.playRead(c1).ids, null, 'C1: a whole-room code reads with ids null'); eq(S.playRead(c2).ids, null, 'C2: a #320 stub code reads with ids null');
    eq(S.playRead(c1).stations.length, 4, 'C1: stations intact'); eq(S.playRead(c2).stations[1].clue, c2.stations[1].clue, 'C2: the played station intact');
    eq(S.playRead(c3).ids.length, 4, 'C3: v2 reads with an ids array'); ok(S.playRead(c3).ids.every(i => /^[a-z0-9]{4}$/.test(i)), 'C3: ids are ids');
    const bad = jc(c3); bad.ids = bad.ids.slice(1); eq(S.playRead(bad).ids, null, 'C3: a malformed ids string is read as no ids');
    eq(S.playRead(null), null, 'playRead(null)'); eq(S.playRead({ stations: 'no' }), null, 'playRead: not a room'); }

  // upgradeProgress
  { const ids = ['aaaa', 'bbbb', 'cccc', 'dddd'];
    const p = { current: 2, misses: { 0: 1, 2: 3 }, solved: { 0: true, 1: true }, hintsUsed: { 1: 1 }, letters: { 0: 'S' }, lockUntil: { 2: 99 }, startedAt: 5 };
    const u = S.upgradeProgress(p, ids);
    eq([u.current, u.misses, u.solved, u.hintsUsed, u.letters, u.lockUntil, u.startedAt], ['cccc', { aaaa: 1, cccc: 3 }, { aaaa: true, bbbb: true }, { bbbb: 1 }, { aaaa: 'S' }, { cccc: 99 }, 5], 'G1: index keys become ids');
    eq(S.upgradeProgress({ current: 'done', solved: { 0: true } }, ids).current, 'done', "G1: 'done' stays 'done'");
    eq(S.upgradeProgress(p, null), p, 'G1: opened by a v1 code (no ids) nothing changes');
    eq(S.upgradeProgress(u, ids), u, 'G2: an id-keyed progress is not upgraded twice'); }

  // nextOf, reachable
  { const s = S.read(F.R2()); eq(S.reachable(s), [s.stations[0].id, s.stations[1].id, s.stations[3].id], 'R2: station 3 is unreachable');
    pageCtx.state = F.R2(); pageCtx.room = vm.runInContext('(function(){var v=validStations();return buildRoomPayload(v);})()', pageCtx);
    eq(vm.runInContext('unreachableStations(room)', pageCtx), [3], "019's own unreachableStations() agrees (station 3)");
    const e = S.read(F.R4()); eq(S.nextOf(e, e.stations[0]), 'end', 'R4: nextOf says end'); eq(S.reachable(e), [e.stations[0].id], 'R4: the walk stops at End here');
    const last = e.stations[1]; eq(S.nextOf(e, last), null, 'the last station has no next');
    const d = S.read(F.R3()); eq(S.nextOf(d, d.stations[0]), d.stations[1].id, 'R3: a dangling jump is auto'); }

  // check(): parity with er-match (loaded from its file) and 018's rules
  {
    const mk = (f) => S.read({ name: 'c', roomId: 'checkroom1', ...F.R2(), stations: [F.rSt(f)] }).stations[0];
    const cases = [
      [{ clue: 'q', answers: 'Amun, Ammon' }, ['amun', 'AMMON', ' ammon ', 'amon', 'amen', 'x', '', 'café']],
      [{ clue: 'q', answers: 'café' }, ['cafe', 'CAFÉ', 'caf']],
      [{ clue: 'q', answers: "it's a keyboard" }, ['its a keyboard', 'it’s a keyboard', "it's"]],
      [{ clue: 'q', answers: '3.14' }, ['314', '3.14', '3,14', '3.15']],
      [{ clue: 'q', answers: '1,000' }, ['1000', '1,000', '1 000']],
      [{ clue: 'q', answers: '10', numericTolerance: 2 }, ['9', '12', '12.5', 'abc', ' ']],
      [{ clue: 'q', type: 'digits', answers: '1234' }, ['1234', '12 34', '1235', '']],
      [{ clue: 'q', type: 'cipher', cipherPlain: "Don't Panic", answers: 'hidden', cipherShift: 5 }, ["don't panic", 'DONT PANIC', 'hidden']],
      [{ clue: 'q', type: 'maze', answers: 'x' }, ['x', 'X']]
    ];
    for (const [f, givens] of cases) {
      const st = mk(f);
      for (const g of givens) {
        const want = M.checkAnswer({ answers: f.type === 'cipher' ? S.read(F.R2()) && f.cipherPlain.split(',').map(a => a.trim()).filter(Boolean) : f.answers.split(',').map(a => a.trim()).filter(Boolean), type: f.type || 'text', numericTolerance: (f.type || 'text') === 'text' ? f.numericTolerance : undefined }, g);
        const got = S.check(st, g);
        eq([got.correct, got.nearMiss], [want.correct, want.nearMiss], `check(${JSON.stringify(f.type || 'text')}, ${JSON.stringify(f.answers)}, ${JSON.stringify(g)}) is er-match's verdict`);
      }
    }
    // 018's rules, copied line for line from submitCheckinCode / the answer panel
    const hunt = S.read(F.H2());
    const [ign, num, ch] = hunt.stations;
    const old = (val, target, tol) => { const v = parseFloat(val), t = parseFloat(target), to = parseFloat(tol) || 0; return !isNaN(v) && !isNaN(t) && Math.abs(v - t) <= to; };
    for (const g of ['5', '6', '6.5', '6.6', '4', '3.4', 'abc', '', '5.0', ' 5 ', 'NaN', 5, 6.5]) eq(S.check(num, g).correct, old(g, '5', '1.50'), `check(number, ${JSON.stringify(g)}) is 018's parseFloat rule`);
    eq(old('x', 'NaN', '0'), false, 'sanity: NaN is never correct');
    for (const g of [0, 1, 2, 3, -1]) eq(S.check(ch, g).correct, g === 0, `check(choice, ${g}) is index equality`);
    eq(S.check(ign, 'anything'), { correct: false, nearMiss: false, reached: true }, "check(none) is 'reached'");
    eq(S.check(S.read(F.H2()).stations[0], '').reached, true, 'check(none, "") is reached too'); }

  // codeText / teamCodeText
  { const h = S.read(F.H4()); eq(S.codeText(h, h.stations[0]), 'https://example.org/a', 'codeText: a URL as is'); eq(S.codeText(h, h.stations[2]), 'plain clue text', 'codeText: plain text as typed');
    eq(S.codeText(h, h.stations[1]), '', 'codeText: a blank station has no code');
    const r = S.read(F.R2()); eq(S.codeText(r, r.stations[3], { base: BASE }), S.playUrl(r, 3, { base: BASE }), 'codeText: a room station is its player link (position in play order)');
    eq(S.teamCodeText({ code: 'K7Q' }), 'HUNT-TEAM:K7Q', 'teamCodeText');
    const cases = { 'example.org/x': 'https://example.org/x', 'tel:123': 'tel:123', 'two words.here': 'two words.here' };
    for (const [raw, want] of Object.entries(cases)) { huntCtx.raw = raw; eq(vm.runInContext('normalizeContent(raw)', huntCtx), want, `sanity: 018 normalizeContent(${raw})`); const x = F.H2(); x.stations[0].content = raw; const s = S.read(x); eq(S.codeText(s, s.stations[0]), want, `codeText(${raw}) is 018's normalizeContent`); } }

  // constants and the reserved name
  eq(S.ID_LENGTH, 4, 'ID_LENGTH'); eq(S.CODE_WORDS.length, 30, 'CODE_WORDS is 018\'s thirty');
  { const m = /var CODE_WORDS = \[([\s\S]*?)\];/.exec(read('Tools/018-qr-scavenger-hunt-builder.html')); eq(S.CODE_WORDS, [...m[1].matchAll(/'([A-Z]+)'/g)].map(x => x[1]), 'CODE_WORDS is 018\'s list, in order'); }
  {   // budget() (P2): one row per playable station, planned at the printed canvas
    const room = S.read(jc(F.R2()));
    const rows = S.budget(room, { ecLevel: 'Q', base: BASE });
    ok(rows.length === S.playable(room).length && rows.every((r, i) => r.n === i && /^[a-z0-9]{4}$/.test(r.id)), 'budget(): a row per playable station, in play order, with its id');
    ok(rows.every(r => r.ok && r.px >= 4 && r.bytes > 0 && r.version >= 1 && r.reason === ''), 'budget(): an ordinary room is inside the budget');
    ok(rows[0].bytes === S.playUrl(room, 0, { base: BASE }).length, 'budget(): the bytes are the printed code\u2019s own link');
    const fat = jc(F.R2()); fat.stations[1].clue = 'x'.repeat(700);
    const fr = S.budget(S.read(fat), { ecLevel: 'Q', base: BASE });
    ok(!fr[1].ok && /Station 2\u2019s code is \d+ bytes, \d+ modules across/.test(fr[1].reason) && /Shorten/.test(fr[1].reason) && fr[0].ok, 'budget(): a fat station is refused by number, with what to shorten, and only that station');
    const huge = jc(F.R2()); huge.stations[0].clue = 'x'.repeat(4000);
    const hr = S.budget(S.read(huge), { ecLevel: 'Q', base: BASE });
    ok(!hr[0].ok && hr[0].modules === null && /more than any QR code can hold/.test(hr[0].reason), 'budget(): past every version it says so');
    const hunt = S.budget(S.read(jc(F.H2())), { ecLevel: 'Q' });
    ok(hunt.length > 0 && hunt.every(r => r.ok), 'budget(): a hunt\u2019s codes (the content) are inside it');
    ok(S.budget(room, { ecLevel: 'L', base: BASE })[0].bytes === rows[0].bytes && S.budget(room, { ecLevel: 'Q', px: 100, base: BASE }).some(r => !r.ok), 'budget(): the printed size matters (a 100 px canvas refuses what 600 px takes)');
  }

  {   // P3 schema fields (AI-26, v384): additive, absent until used, round-tripped, and read by nextOf()/reachable()
    const plain = S.read(jc(F.R2()));
    ok(plain.stations.every(st => st.branches === undefined && st.bankId === undefined) && plain.required === undefined && plain.flow === 'chain', 'P3: a room that never used the fields reads without them');
    const w0 = S.write(plain);
    ok(w0.flow === undefined && w0.required === undefined && w0.stations.every(st => st.branches === undefined && st.bankId === undefined), 'P3: and writes without them (the bytes of a saved room do not move)');
    const raw = jc(F.R2());
    const ids = S.read(raw).stations.map(st => st.id);
    raw.stations.forEach((st, i) => { st.id = ids[i]; });
    raw.stations[0].branches = { byAnswer: { 'the sphinx': ids[2], 'bogus': 'zzzz' } };
    raw.stations[0].bankId = 'q-17';
    raw.flow = 'free'; raw.required = [ids[1], ids[2], 'nope'];
    raw.run = { teams: [{ name: 'Red' }] };
    const set = S.read(raw);
    eq(set.stations[0].branches, { byAnswer: { 'the sphinx': ids[2], 'bogus': 'zzzz' } }, 'P3: branches read as saved');
    eq([set.stations[0].bankId, set.flow, set.required, set.run], ['q-17', 'free', [ids[1], ids[2]], { teams: [{ name: 'Red' }] }], 'P3: bankId, flow, required (a stranger dropped) and a room\u2019s run read');
    const back = S.write(set);
    eq(back.stations[0].branches, { byAnswer: { 'the sphinx': ids[2] } }, 'P3: write drops a branch to a station that is gone');
    eq([back.stations[0].bankId, back.flow, back.required, back.run], ['q-17', 'free', [ids[1], ids[2]], { teams: [{ name: 'Red' }] }], 'P3: and carries bankId, flow, required and run');
    const chain = S.read(jc(back));
    const first = chain.stations[0];
    const pl = S.playable(chain);
    eq(S.nextOf(chain, first, 'The Sphinx!'), ids[2], 'P3: nextOf(given) takes the branch an answer names, forgiving case and punctuation');
    eq(S.nextOf(chain, first, 'a riddle'), S.nextOf(chain, first), 'P3: an answer with no branch goes where it always went');
    eq(S.nextOf(chain, first, ''), S.nextOf(chain, first), 'P3: a blank answer is no branch');
    ok(pl.length > 2, 'P3: the fixture has the stations the tests above name');
    const c2 = S.read(jc(back)); c2.flow = 'chain';
    ok(S.reachable(c2).indexOf(ids[2]) !== -1, 'P3: a chain set reaches a station only a branch leads to');
    eq(S.reachable(set).length, S.playable(set).length, 'P3: a free set reaches every playable station');
    const hunt = jc(F.H2());
    const hset0 = S.read(hunt);
    hunt.stations[0].image = 'idb:abc'; hunt.stations[0].encode = 'player';
    const hset = S.read(hunt);
    eq([hset.stations[0].image, hset.stations[0].encode, hset0.stations[0].image, hset0.stations[0].encode], ['idb:abc', 'player', '', 'prompt'], 'P3: a hunt station reads an image and encode:player, and defaults without them');
    const hw = S.write(hset);
    eq([hw.stations[0].image, hw.stations[0].encode, S.write(hset0).stations[0].image], ['idb:abc', 'player', undefined], 'P3: and writes them only when set');
  }

  { // v389: progress(), the free-order required set
    const h = S.read(jc(F.H2())), ids = h.stations.map(x => x.id);
    ok(ids.length >= 3, 'PR: the hunt fixture has three stations');
    const none = S.progress(h, {});
    eq([none.total, none.done, none.bonus, none.explicit, none.finished, none.nextId], [ids.length, 0, 0, false, false, ids[0]], 'PR: no required set means every station is required');
    const all = {}; ids.forEach(i => { all[i] = { at: 1, correct: true }; });
    ok(S.progress(h, all).finished && S.progress(h, all).done === ids.length, 'PR: every station reached is finished');
    h.required = [ids[1], ids[2]];
    const p1 = S.progress(h, { [ids[0]]: { at: 1 } });
    eq([p1.total, p1.done, p1.bonus, p1.explicit, p1.finished, p1.nextId], [2, 0, 1, true, false, ids[1]], 'PR: an unrequired mark is a bonus and does not finish the hunt');
    const p2 = S.progress(h, { [ids[1]]: { at: 1 }, [ids[2]]: { at: 2 } });
    eq([p2.done, p2.bonus, p2.finished, p2.nextId], [2, 0, true, null], 'PR: the required stations reached finish the hunt without the rest');
    const p3 = S.progress(h, { [ids[2]]: { at: 1 } });
    eq([p3.done, p3.finished, p3.nextId], [1, false, ids[1]], 'PR: next is the first required station not yet reached, whatever the order reached in');
    h.required = ['nope'];
    ok(!S.progress(h, {}).explicit && S.progress(h, {}).total === ids.length, 'PR: a required id no station has falls back to every station');
    eq(S.progress(h, null).done, 0, 'PR: no marks object is no marks');
  }

  { // v385: a go-to stored as the target's id
    const room = jc(F.R2());
    room.stations[0].next = 2; room.stations[1].next = 'end'; room.stations[2].next = 0;
    const d = S.toDisk(room);
    const ids = d.stations.map(x => x.id);
    eq([d.stations[0].next, d.stations[1].next, d.stations[2].next], [ids[2], 'end', ids[0]], 'D: toDisk stores a position as the target id and keeps end');
    eq(room.stations[0].next, 2, 'D: toDisk leaves its argument alone');
    const mem = S.write(S.read(d));
    eq(mem.stations.map(x => x.next), [2, 'end', 0, null], 'D: read/write of the disk form gives the positions back');
    d.stations.unshift(jc(d.stations[2])); d.stations[0].id = 'zzzz'; d.stations[0].next = null;
    eq(S.write(S.read(d)).stations.map(x => x.next), [null, 3, 'end', 1, null], 'D: a station inserted above keeps every go-to on its target');
    const old = jc(room);
    eq(S.write(S.read(old)).stations.map(x => x.next), [2, 'end', 0, null], 'D: an old numeric go-to still reads');
    d.stations[1].next = 'nope';
    eq(S.write(S.read(d)).stations[1].next, null, 'D: an id no station has reads as auto');
    eq(S.toDisk(F.H2()).stations.length, F.H2().stations.length, 'D: toDisk of a hunt is a copy');
  }

  { // v386: shareState / fromShare are the pages' getState / normalize functions, to the letter
    const txt = fs.readFileSync(path.join(here, '_old-share-functions.txt'), 'utf8');
    const part = (name) => txt.split('//@@' + name + '\n')[1].split('//@@')[0];
    const STATION_TYPES = ['text', 'digits', 'cipher'], Q_TYPES = ['text', 'choice', 'numeric', 'photo'];
    const ER = { src: (v) => v, isInline: (v) => typeof v === 'string' && v.slice(0, 11) === 'data:image/' };
    const uniq = (n) => n + ' (2)', rid = () => 'newroom001';
    const blankStation = () => ({ label: '', content: '', note: '', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '' });
    const mk = (body, names) => new Function('STATION_TYPES', 'Q_TYPES', 'ER', 'uniqueRoomName', 'uniqueHuntName', 'makeRoomId', 'blankStation', 'state', body + '\nreturn ' + names + ';');
    const oldRoomNorm = mk(part('019 normalizeRoom'), 'normalizeRoom')(STATION_TYPES, Q_TYPES, ER, uniq, uniq, rid, blankStation, null);
    const oldHuntNorm = mk(part('018 normalizeHunt'), 'normalizeHunt')(STATION_TYPES, Q_TYPES, ER, uniq, uniq, rid, blankStation, null);
    const oldShare = (body, state) => { let got; const Share = { mount: (el, o) => { got = o; } }; new Function('Share', 'els', 'state', 'ER', 'SHARE_PARAM', 'var x = {' + body.replace(/^\s*getState:/, 'getState:') + ' param: 1 }; Share.mount(null, x);')(Share, {}, state, ER, 'p'); return got.getState(); };
    const rooms = [F.R2(), F.R3(), { name: 'Odd', roomId: 'x', stations: [{ clue: 'c', answers: 'a', next: 'end', type: 'cipher', cipherShift: 0, numericTolerance: 0.5, image: 'data:image/png;base64,AA', id: 'abcd' }, {}, null, { type: 'weird', next: 7, image: 'idb:zz', numericTolerance: 'x', hintCost: '4', maxAttempts: 'q' }] }];
    const hunts = [F.H2(), F.H3(), { name: 'Odd', stations: [{ label: 7, qType: 'zz', choices: [1, null, 'c'], correctChoice: '2', tolerance: null, hintPenalty: undefined, id: 'wxyz' }, null, [], {}] }];
    rooms.forEach((r, i) => {
      const rs = { ...r, stations: r.stations.filter(x => x && typeof x === 'object') };   // a saved set holds no null row
      eq(jc(S.shareState(rs, { kind: 'room' })), jc(oldShare(part('019 getState'), rs)), 'S: shareState of room ' + i + ' is 019\'s getState');
      const a = { name: i % 2 ? '  ' : 'Zed', cardsPerPage: 8, showNumber: false, countdownMinutes: '0', stations: r.stations };
      eq(jc(S.fromShare(a, { kind: 'room', uniqueName: uniq, roomId: rid, isInline: ER.isInline })), jc(oldRoomNorm(a)), 'S: fromShare of room ' + i + ' is 019\'s normalizeRoom');
    });
    hunts.forEach((h, i) => {
      const hs = { ...h, stations: h.stations.filter(x => x && typeof x === 'object' && !Array.isArray(x)) };
      eq(jc(S.shareState(hs, { kind: 'hunt' })), jc(oldShare(part('018 getState'), hs)), 'S: shareState of hunt ' + i + ' is 018\'s getState');
      const a = { name: i % 2 ? '' : 'Hunt', cardsPerPage: 9, stations: h.stations };
      eq(jc(S.fromShare(a, { kind: 'hunt', uniqueName: uniq })), jc(oldHuntNorm(a)), 'S: fromShare of hunt ' + i + ' is 018\'s normalizeHunt');
    });
    eq(S.shareState(null, { kind: 'room' }), null, 'S: no state, no link');
    { // v390: a hunt's required set rides in the link (ids of its own stations), and only then
      const h0 = F.H3(), h = { ...h0, stations: h0.stations.map((x, i) => ({ ...x, id: 'req' + i + 'abc' })) }, ids = h.stations.map(x => x.id);
      const none = S.shareState(h, { kind: 'hunt' });
      ok(!('required' in none), 'S: a hunt with no star carries no required field (old links unchanged)');
      const withReq = S.shareState({ ...h, required: [ids[1], 'gone'] }, { kind: 'hunt' });
      eq(withReq.required, [ids[1]], 'S: shareState carries the starred ids that exist');
      const back = S.fromShare({ ...withReq, stations: withReq.stations }, { kind: 'hunt' });
      eq(back.required, [ids[1]], 'S: fromShare restores the required set');
      eq(S.fromShare({ ...withReq, required: [ids[1], ids[1], 7, 'nope'] }, { kind: 'hunt' }).required, [ids[1]], 'S: fromShare drops repeats, non-ids and unknown ids');
      ok(!('required' in S.fromShare({ ...withReq, required: ['nope'] }, { kind: 'hunt' })), 'S: an arrival whose required ids are all unknown has none');
      ok(!('required' in S.shareState({ ...F.R3(), required: ['x'] }, { kind: 'room' })), 'S: a room link carries no required field');
    }
  }

  { // v391: per-answer branching on a hunt's choice stations
    const h0 = F.H2(), h = { ...h0, stations: h0.stations.map((x, i) => ({ ...x, id: 'b' + i + 'xx' })) };
    h.stations[2].choices = ['Limestone', 'Shale', 'Granite'];
    const id = (n) => 'b' + n + 'xx';
    const withBranch = (by) => { const c = jc(h); c.stations[2].branches = { byAnswer: by }; return S.read(c); };
    let set = withBranch({ Shale: id(0) });
    eq(S.branchOf(set, set.stations[2], 'shale '), id(0), 'B: an accepted answer is matched as text (case and spacing)');
    eq(S.branchOf(set, set.stations[2], 'Granite'), null, 'B: an answer with no branch has none');
    eq(S.branchOf(set, set.stations[2], ''), null, 'B: a blank answer has none');
    eq(S.branchOf(set, set.stations[2]), null, 'B: no answer given has none');
    eq(S.nextOf(set, set.stations[2], 'Shale'), id(0), 'B: nextOf takes the branch');
    eq(S.nextOf(set, set.stations[2], 'Granite'), null, 'B: nextOf without a branch goes where it always went (the last station ends)');
    eq(S.branchProblems(set), [], 'B: a plain branch is fine');
    eq(S.branchProblems(S.read(h)), [], 'B: a hunt with no branches has no problems');
    set = withBranch({ Shale: id(2) });
    eq(S.branchProblems(set).length, 1, 'B: a choice sent back to its own station is refused');
    ok(/Station 3: choice \u201cShale\u201d sends a team back to Station 3 itself/.test(S.branchProblems(set)[0]), 'B: and said with the station and the choice');
    set = withBranch({ Shale: id(0), Limestone: id(1) });
    eq(S.branchProblems(set), [], 'B: the right answer branched is fine while the target can finish');
    { // a closed loop: station 2 (choice) -> right answer to 3 -> right answer back to 2
      const c = jc(h);
      c.stations[1] = { ...c.stations[1], qType: 'choice', choices: ['A', 'B'], correctChoice: 0, numericAnswer: '' };
      c.stations[1].branches = { byAnswer: { A: id(2) } };
      c.stations[2].branches = { byAnswer: { Limestone: id(1) } };
      const p = S.branchProblems(S.read(c));
      eq(p.length, 1, 'B: two stations whose right answers only lead to each other are refused');
      ok(/Stations 2 and 3 send its right answer only to each other/.test(p[0]), 'B: and named together');
      c.stations[1].branches = { byAnswer: { A: id(2), B: id(0) } };
      eq(S.branchProblems(S.read(c)), [], 'B: another branched choice out of the loop is an accepted answer, so it is a way out');
      c.stations[2].branches = { byAnswer: { Limestone: id(1), Shale: id(0) } };
      c.stations[1].branches = { byAnswer: { A: id(2) } };
      eq(S.branchProblems(S.read(c)), [], 'B: station 3 with a second branched choice to a finishing station opens the loop');
      c.stations[1].branches = { byAnswer: { A: id(2) } };
      c.stations[2].branches = { byAnswer: { Limestone: id(1) } };
      eq(S.branchProblems(S.read(c)).length, 1, 'B: back to the closed loop');
      c.stations[2].branches = { byAnswer: { Shale: id(0) } };
      eq(S.branchProblems(S.read(c)), [], 'B: leaving one right answer unbranched opens the way');
    }
    { // two choices that read alike
      const c = jc(h); c.stations[2].choices = ['Shale', ' shale', 'Granite']; c.stations[2].branches = { byAnswer: { Shale: id(0) } };
      ok(S.branchProblems(S.read(c)).some(m => /read \u201cShale\u201d/.test(m)), 'B: twin choices with a branch are refused');
    }
    { // a branch to a station with nothing on its card
      const c = jc(h); c.stations[0].content = '   '; c.stations[2].branches = { byAnswer: { Shale: id(0) } };
      ok(S.branchProblems(S.read(c)).some(m => /nothing on its card/.test(m)), 'B: a branch to an empty station is refused');
    }
    const rt = jc(S.write(S.read(Object.assign(jc(h), { stations: jc(h).stations.map((x, i) => i === 2 ? { ...x, branches: { byAnswer: { Shale: id(0) } } } : x) }))));
    eq(rt.stations[2].branches, { byAnswer: { Shale: id(0) } }, 'B: branches survive read and write');
    ok(!('branches' in rt.stations[0]), 'B: a station without one gets none');
    // the link
    const hb = jc(h); hb.stations[2].branches = { byAnswer: { Shale: id(0), Granite: 'zzzz' } };
    const link = S.shareState(hb, { kind: 'hunt' });
    eq(link.stations[2].branches, { byAnswer: { Shale: id(0) } }, 'B: shareState carries a branch, only to a station in the link');
    ok(!('branches' in S.shareState(h, { kind: 'hunt' }).stations[2]), 'B: a hunt without branches carries none (old links unchanged)');
    eq(S.fromShare(link, { kind: 'hunt' }).stations[2].branches, { byAnswer: { Shale: id(0) } }, 'B: fromShare restores it');
    const bad = jc(link); bad.stations[2].branches = { byAnswer: { Nope: id(0), Granite: id(2), Shale: id(0) } };
    eq(S.fromShare(bad, { kind: 'hunt' }).stations[2].branches, { byAnswer: { Shale: id(0) } }, 'B: fromShare drops a choice the station lacks and a branch to itself');
    const bad2 = jc(link); bad2.stations[1].branches = { byAnswer: { x: id(0) } };
    ok(!('branches' in S.fromShare(bad2, { kind: 'hunt' }).stations[1]), 'B: and a branch on a station that is not a choice');
    ok(!JSON.stringify(S.fromShare(link, { kind: 'hunt' })).includes('_by'), 'B: no scratch field is left on an arrival');
  }

  return { passed, fails };
}

// the real module
const real = suite(SRC);
console.log(`stations: ${real.passed} passed, ${real.fails.length} failed`);
real.fails.forEach(f => console.log('  FAIL ' + f));

// break-on-purpose: each broken copy must make the suite fail
const MUTANTS = [
  ['cipherShift null collapses to 0', "a.cipher = { plain: str(st.cipherPlain), shift: st.cipherShift === undefined ? null : st.cipherShift };", "a.cipher = { plain: str(st.cipherPlain), shift: st.cipherShift === undefined ? 0 : st.cipherShift };"],
  ['a duplicate id is kept', "var id = isObj(st) && validId(st.id) && seen[st.id] === 1 ? st.id : null;", "var id = isObj(st) && validId(st.id) ? st.id : null;"],
  ['the ids string is dropped from the payload', "out.ids = valid.map(function (s) { return s.id; }).join('');", "out.ids = '';"],
  ['a numeric tolerance is ignored', "Math.abs(val - target) <= tol", "Math.abs(val - target) <= 0"],
  ['budget ignores the readable floor', "ok: plan.ok, reason: '' }", "ok: true, reason: '' }"],
  ['a branch to a gone station is kept on write', "if (ids.indexOf(st.branches.byAnswer[k]) !== -1) by[k]", "if (true) by[k]"],
  ['nextOf ignores the answer', "if (given !== undefined && station.branches", "if (false && station.branches"],
  ['a go-to id is ignored on read', "out.next = n;   // stored as an id on disk (v385)", "out.next = null;"],
  ['toDisk keeps the position', "st.next = out.stations[st.next].id;", "st.next = st.next;"],
  ['fromShare keeps an unknown room type', "type: ROOM_TYPES.indexOf(st.type) !== -1 ? st.type : 'text',", "type: st.type,"],
  ['shareState carries the run', "      name: state.name,\n      cardsPerPage: state.cardsPerPage, ecLevel: state.ecLevel, showNumber: state.showNumber !== false,\n      stations: state.stations.map(function (s) {\n        var o = {\n          id: s.id,", "      name: state.name, run: state.run,\n      cardsPerPage: state.cardsPerPage, ecLevel: state.ecLevel, showNumber: state.showNumber !== false,\n      stations: state.stations.map(function (s) {\n        var o = {\n          id: s.id,"],
  ['shareState drops the required set', "if (reqIds.length) out.required = reqIds;", ""],
  ['fromShare keeps an unknown required id', "a.indexOf(r) === i && hunt.stations.some(function (st) { return st.id === r; })", "a.indexOf(r) === i"],
  ['progress counts a bonus mark as required', "if (marked && isReq) done++;", "if (marked) done++;"],
  ['progress ignores the required set', "var explicit = req.length > 0;", "var explicit = false; req = [];"],
  ['a branch to a station outside the link rides along', "has(by[k])", "true"],
  ['a self branch is not refused', "if (t === st.id) out.push(", "if (false) out.push("],
  ['a closed loop of right answers is not refused', "if (stuck.length) {", "if (false) {"],
  ['an unmatched answer takes the branch', "normalizeTextAnswer(keys[k]) === want && (by[keys[k]]", "(by[keys[k]]"],
  ['an orphan mark is kept', "if (id === undefined || String(parseInt(k, 10)) !== k) { dropped++; return; }", "if (id === undefined) id = k;"]
];
let mutantFail = 0;
for (const [label, ...pairs] of MUTANTS) {
  let src = SRC;
  for (let i = 0; i < pairs.length; i += 2) { if (!src.includes(pairs[i])) { console.log(`  FAIL mutant "${label}": its anchor text is gone from stations.js, update the mutant`); mutantFail++; src = null; break; } src = src.replace(pairs[i], pairs[i + 1]); }
  if (src === null) continue;
  let r; try { r = suite(src); } catch (e) { r = { fails: ['threw: ' + e.message] }; }
  if (!r.fails.length) { console.log(`  FAIL mutant "${label}" was not caught: the suite stayed green on a broken module`); mutantFail++; }
  else console.log(`  ok   mutant "${label}" caught by ${r.fails.length} assertion(s)`);
}
process.exit(real.fails.length || mutantFail ? 1 : 0);
