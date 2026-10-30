// stations-bank.test.mjs — pure-logic tests for _shared/stations-bank.js (Path 12 P2, increment 6).
//
//   node Tools/stations/test/stations-bank.test.mjs      (or: npm run test:stations-bank)
//
// stations-bank.js is a classic script publishing window.StationsBank; the pure half runs here in a vm
// context with no document, beside _shared/stations.js so a made station is read and checked by the same
// module a page uses. The suite runs itself against deliberately broken copies of the module and requires
// each to fail (break-on-purpose). Every name is invented. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as F from './_fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(site, f), 'utf8');
const SRC = read('_shared/stations-bank.js');
const STATIONS = read('_shared/stations.js');

function load(src) {
  const win = {};
  const ctx = { window: win, btoa, unescape, encodeURIComponent, URL, Math, Date, JSON, Object, Array, String, parseInt, parseFloat, isNaN, isFinite, RegExp, Error, TextEncoder };
  vm.createContext(ctx);
  vm.runInContext(read('_shared/vendor/qrcode/qrcode.js'), ctx);
  win.qrcode = ctx.qrcode;
  vm.runInContext(read('_shared/qr-draw.js'), ctx);
  vm.runInContext(read('_shared/list-sentence.js'), ctx);
  vm.runInContext(STATIONS, ctx);
  vm.runInContext(src, ctx);
  return win;
}

const Q = (o) => ({ id: 'q1', prompt: 'What is the capital of France?', answer: 'Paris', choices: [], unit: 'Europe', ...o });

function cases(win, t) {
  const SB = win.StationsBank, S = win.Stations;
  const room = (stations) => ({ name: 'Room', roomId: 'r1', stations });
  const blankRoom = () => F.rSt({});
  const blankHunt = () => F.hSt('', '');

  // ── 019: a question becomes a text station ─────────────────────────────
  const r = SB.toStation(Q(), 'room');
  t(r.ok && r.station.clue === 'What is the capital of France?' && r.station.answers === 'Paris' && r.station.type === 'text', 'room: prompt is the clue, answer the accepted answer, type text');
  t(r.station.bankId === 'q1', 'room: bankId is the question id');
  t(r.station.hint === '' && r.station.next === null && r.station.hintCost === 0 && r.station.maxAttempts === 0 && !r.station.image, 'room: no hint, branch, picture or limit is set');
  const seeded = SB.toStation(Q({ id: 'seed:053:b3' }), 'room');
  t(seeded.station.bankId === 'seed:053:b3', 'room: a seed question keeps its seed id');
  t(SB.toStation(Q({ prompt: '  ' }), 'room').ok === false && /no question/.test(SB.toStation(Q({ prompt: '' }), 'room').why), 'a question with no question is refused, with a sentence');
  t(SB.toStation(Q({ answer: '' }), 'room').ok === false && /no answer/.test(SB.toStation(Q({ answer: ' ' }), 'hunt').why), 'a question with no answer is refused on both kinds');
  t(SB.toStation({ prompt: 'x', answer: 'y' }, 'room').ok === false, 'a question with no id is refused');

  // commas: an answer with a comma is ONE accepted answer, matched as typed
  for (const [answer, typed] of [['Paris, France', 'paris france'], ['Paris, France', 'Paris, France'], ['1,000', '1000'], ['1,000', '1,000'], ['Washington, D.C.', 'Washington, D.C.']]) {
    const made = SB.toStation(Q({ answer }), 'room');
    const set = S.read(room([made.station]));
    t(made.station.answers.indexOf(',') === -1, `room: "${answer}" leaves no comma to split on`);
    t(S.check(set.stations[0], typed).correct === true, `room: "${answer}" accepts "${typed}"`);
    t(S.check(set.stations[0], 'London').correct === false, `room: "${answer}" rejects a wrong answer`);
  }
  t(SB.toStation(Q({ answer: 'Paris, France' }), 'room').commas === true && SB.toStation(Q(), 'room').commas === false, 'room: a rewritten comma is flagged, a plain answer is not');
  t(S.read(room([r.station])).stations[0].answer.accepted.length === 1, 'room: one accepted answer for a plain answer');
  t(S.read(room([SB.toStation(Q({ answer: 'A, B, C' }), 'room').station])).stations[0].answer.accepted.length === 1, 'room: "A, B, C" is one accepted answer, not three');

  // bankId survives the module's own read/write and the share state
  const w = S.write(S.read(room([r.station])));
  t(w.stations[0].bankId === 'q1', 'room: bankId survives Stations.read then write');
  t(JSON.stringify(S.toDisk(room([r.station]))).indexOf('"bankId":"q1"') !== -1, 'room: bankId is saved by toDisk, the page\'s own save');
  t(JSON.stringify(S.shareState(room([r.station]), { kind: 'room' })).indexOf('bankId') === -1, 'room: bankId does not ride a share link (a link\'s bytes are what they were)');

  // ── 018: typed or choice ───────────────────────────────────────────────
  const typed = SB.toStation(Q(), 'hunt');
  t(typed.station.qType === 'text' && typed.station.content === 'What is the capital of France?' && typed.station.note === 'Answer: Paris' && typed.station.choices.length === 0, 'hunt: a typed question is a text station with the answer in the note');
  const mc = SB.toStation(Q({ choices: ['London', 'Paris', 'Rome', 'Oslo'] }), 'hunt');
  t(mc.station.qType === 'choice' && mc.station.choices.join('|') === 'London|Paris|Rome|Oslo' && mc.station.correctChoice === 1 && mc.station.note === '', 'hunt: a multiple-choice question is a choice station, the right one marked');
  const hs = S.read({ name: 'H', stations: [mc.station] });
  t(S.check(hs.stations[0], 1).correct === true && S.check(hs.stations[0], 0).correct === false, 'hunt: the choice station accepts the answer\'s place only');
  t(SB.toStation(Q({ choices: ['London', ' PARIS ', 'Rome'] }), 'hunt').station.correctChoice === 1, 'hunt: the answer matches a choice by case and spacing');
  const none = SB.toStation(Q({ choices: ['London', 'Rome'] }), 'hunt');
  t(none.station.qType === 'text' && none.station.note === 'Answer: Paris' && none.choices === true, 'hunt: an answer that is none of the choices is a text station');
  const seven = SB.toStation(Q({ choices: ['a', 'b', 'c', 'd', 'e', 'f', 'Paris'] }), 'hunt');
  t(seven.station.qType === 'text' && seven.station.choices.length === 0, 'hunt: more than six choices is a text station');
  t(SB.toStation(Q({ choices: ['Paris'] }), 'hunt').station.qType === 'text', 'hunt: one choice is not a choice question');
  t(SB.toStation(Q({ answer: '42' }), 'hunt').station.qType === 'text', 'hunt: a number-looking answer does not become a numeric station');
  t(SB.toStation(Q({ prompt: 'Line one\n  line two' }), 'hunt').station.content === 'Line one line two', 'hunt: a multi-line prompt is one line');
  t(SB.toStation(Q({ choices: ['London', 'Paris'] }), 'room').choices === true, 'room: a question with choices says the choices were not carried');
  t(typed.station.bankId === 'q1', 'hunt: bankId is the question id');
  t(S.write(S.read({ name: 'H', stations: [typed.station] })).stations[0].bankId === 'q1', 'hunt: bankId survives read then write');

  // ── addTo ──────────────────────────────────────────────────────────────
  let set = room([blankRoom()]);
  let res = SB.addTo(set, [Q(), Q({ id: 'q2', prompt: 'Two?', answer: '2' })], 'room');
  t(res.added === 2 && res.replacedBlank === true && set.stations.length === 2 && set.stations[0].bankId === 'q1' && set.stations[1].bankId === 'q2', 'addTo: a lone empty station is replaced, the rest in the bank\'s order');
  res = SB.addTo(set, [Q(), Q({ id: 'q3', prompt: 'Three?', answer: '3' })], 'room');
  t(res.added === 1 && res.already === 1 && set.stations.length === 3 && set.stations[2].bankId === 'q3', 'addTo: a question already a station is skipped, a new one goes on the end');
  res = SB.addTo(set, [Q({ id: 'q4', answer: '' })], 'room');
  t(res.added === 0 && res.refused === 1 && set.stations.length === 3, 'addTo: a refused question adds nothing');
  const typedBy = room([F.rSt({ clue: 'My own', answers: 'x' })]);
  res = SB.addTo(typedBy, [Q()], 'room');
  t(res.replacedBlank === false && typedBy.stations.length === 2 && typedBy.stations[0].clue === 'My own', 'addTo: a station typed by hand is kept');
  const withHint = room([F.rSt({ hint: 'a hint' })]);
  SB.addTo(withHint, [Q()], 'room');
  t(withHint.stations.length === 2, 'addTo: an otherwise empty station with a hint is not "empty"');
  const hunt = { name: 'H', stations: [blankHunt()] };
  res = SB.addTo(hunt, [mc.station && Q({ choices: ['London', 'Paris'] }), Q({ id: 'q9', prompt: 'p', answer: 'a, b' })], 'hunt');
  t(res.added === 2 && hunt.stations.length === 2 && hunt.stations[0].qType === 'choice' && hunt.stations[1].qType === 'text' && hunt.stations[1].note === 'Answer: a, b', 'addTo hunt: the blank is replaced; a comma stays in a hunt note');
  t(res.commas === 0, 'addTo hunt: a comma is not rewritten on a hunt');
  res = SB.addTo(set, [Q({ id: 'q5', choices: ['a', 'b'], answer: 'a' }), Q({ id: 'q6' })], 'room', { imageOf: (q) => q.id === 'q6' ? 'idb:1' : '' });
  t(res.withChoices === 1 && res.withPicture === 1, 'addTo: choices and pictures that did not come are counted');
  const before = JSON.stringify(set);
  SB.addTo(set, [], 'room'); SB.addTo(set, [Q()], 'room');
  t(JSON.stringify(set) === before, 'addTo: nothing to add, or only held questions, changes nothing');
  t(SB.heldIds(null) && Object.keys(SB.heldIds(null)).length === 0, 'heldIds: a null set holds none');

  // ── old rooms and hunts are untouched by the module's existence ────────
  const old = F.R2(), oldJson = JSON.stringify(old);
  SB.heldIds(old); SB.isBlank(old.stations[0], 'room');
  t(JSON.stringify(old) === oldJson, 'a saved room is not changed by reading it');
  t(!JSON.stringify(S.write(S.read(F.R2()))).includes('bankId') && !JSON.stringify(S.write(S.read(F.H2()))).includes('bankId'), 'a room and a hunt from before carry no bankId');

  // the status sentence
  t(/Added 2 stations/.test(SB.statusText({ added: 2, already: 0, commas: 0, withChoices: 0, withPicture: 0 }, 'Room')) && /bank itself was not changed/.test(SB.statusText({ added: 0 })), 'statusText: says what was added and that the bank is unchanged');
}

// ── run: the module, then each broken copy must fail ──────────────────────
function run(src) {
  let pass = 0, fail = 0; const fails = [];
  const t = (c, l) => { if (c) pass++; else { fail++; fails.push(l); } };
  try { cases(load(src), t); } catch (e) { fail++; fails.push('threw: ' + e.message); }
  return { pass, fail, fails };
}

const real = run(SRC);
real.fails.forEach((l) => console.log('  FAIL ' + l));
console.log(`stations-bank: ${real.pass} passed, ${real.fail} failed`);
let bad = real.fail > 0;

const MUTANTS = [
  ['commas are left in', "return str(answer).replace(/(\\d),(\\d)/g, '$1$2').replace(/,/g, ' ').replace(/\\s+/g, ' ').trim();", 'return str(answer).trim();'],
  ['comma between digits becomes a space', ".replace(/(\\d),(\\d)/g, '$1$2')", ".replace(/(\\d),(\\d)/g, '$1 $2')"],
  ['the right choice is off by one', 'st.correctChoice = at;', 'st.correctChoice = at + 1;'],
  ['a held question is added again', 'if (q && held[q.id]) { res.already++; return; }', 'if (false) { return; }'],
  ['the blank station is kept', 'set.stations.length === 1 && isBlank(set.stations[0], kind)', 'false'],
  ['bankId is dropped from a room', 'awardLetter: \'\', cipherPlain: \'\', cipherShift: 0, maxAttempts: 0, numericTolerance: null, bankId: q.id }', 'awardLetter: \'\', cipherPlain: \'\', cipherShift: 0, maxAttempts: 0, numericTolerance: null }'],
  ['a hunt answer is not written to the note', "else st.note = 'Answer: ' + answer;", ''],
  ['a question with no answer is allowed', "if (!str(q.answer).trim()) return 'It has no answer.';", ''],
  ['seven choices are a choice station', 'choices.length <= 6', 'choices.length <= 9'],
  ['a choice list is made for any question', 'if (at >= 0) {', 'if (choices.length >= 2) { at = Math.max(at, 0);'],
  ['the choice match is case-sensitive', 'norm(c) === norm(answer)', 'c === answer'],
  ['a station typed by hand is replaced', "!str(s.clue).trim() && !str(s.answers).trim() && !str(s.hint).trim() && !s.image", '!str(s.hint).trim() && !s.image'],
];
for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { console.log('  FAIL mutant "' + name + '": its anchor text is not in the module'); bad = true; continue; }
  const m = run(SRC.replace(from, to));
  if (m.fail === 0) { console.log('  FAIL mutant "' + name + '" was not caught'); bad = true; } else console.log(`  caught: ${name} (${m.fail})`);
}
process.exit(bad ? 1 : 0);
