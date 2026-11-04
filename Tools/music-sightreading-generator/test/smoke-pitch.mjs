// smoke-pitch.mjs — 067's reference pitch and note play-through on the page (AI-48), port 8696.
//
//   node Tools/music-sightreading-generator/test/smoke-pitch.mjs   (npm run test:music-pitch-smoke)
//
// The tone arithmetic is pitch.test.mjs's job. This suite drives the page with a fake
// AudioContext whose clock it sets by hand, and holds the wiring: no AudioContext until a
// button is pressed (nothing autoplays); each note's pitch is the pitch of the line or
// space it is DRAWN on (read back off the SVG's y and worked out here independently,
// both clefs); the notes are even quarter notes at the Rhythm tab's tempo, clamped with a
// sentence, and a field with no number plays nothing and says so; the note sounding is
// named in text and ringed on the staff without movement; the reference pitch is the
// range's lowest C, or the first note when the range has none, and says which; the two
// buttons never sound at once and share the click track's one AudioContext; it stops on
// Stop, at the end, on a new pattern, a clef change, the Rhythm tab and a hidden page; the
// controls and the ring are not on the printed sheet; no new storage key; no errors.
// Nobody has listened to it: the sound itself is unverified.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8696;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/067-music-sightreading-generator.html';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

const FAKE_AUDIO = () => {
  window.__fa = { made: 0, t: 0, oscs: [] };
  function Param() { this.log = []; }
  Param.prototype.setValueAtTime = function (v, t) { this.log.push([v, t]); };
  Param.prototype.exponentialRampToValueAtTime = function (v, t) { this.log.push([v, t]); };
  function FakeCtx() { window.__fa.made++; this.state = 'running'; this.destination = {}; }
  Object.defineProperty(FakeCtx.prototype, 'currentTime', { get() { return window.__fa.t; } });
  FakeCtx.prototype.createOscillator = function () {
    const o = { frequency: new Param(), connect() {}, disconnect() {}, start(t) { o.at = t; }, stop(t) { (o.stops = o.stops || []).push(t); } };
    window.__fa.oscs.push(o);
    return o;
  };
  FakeCtx.prototype.createGain = function () { return { gain: new Param(), connect() {}, disconnect() {} }; };
  window.AudioContext = FakeCtx;
  window.webkitAudioContext = FakeCtx;
  window.print = function () { window.__printed = (window.__printed || 0) + 1; window.__printHtml = document.getElementById('printPitchDisplay').innerHTML; };
};

// Independent of msrg-audio.js: staff position -> note -> equal temperament on A4 = 440.
const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI = [0, 2, 4, 5, 7, 9, 11];
const BOTTOM = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 }; // E4, G2
const noteAt = (pos, clef) => { const d = pos + BOTTOM[clef]; return LET[d % 7] + Math.floor(d / 7); };
const hz = (label) => 440 * Math.pow(2, ((Number(label.slice(1)) + 1) * 12 + SEMI[LET.indexOf(label[0])] - 69) / 12);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await page.addInitScript(FAKE_AUDIO);

const fa = () => page.evaluate(() => ({ made: window.__fa.made, oscs: window.__fa.oscs.map((o) => ({ at: o.at, f: o.frequency.log[0] && o.frequency.log[0][0], stops: o.stops || [] })) }));
const setT = async (t) => { await page.evaluate((v) => { window.__fa.t = v; }, t); await settle(page, 120); };
const now = () => page.evaluate(() => window.__fa.t);
const state = () => page.evaluate(() => ({
  pressed: document.getElementById('playNotesBtn').getAttribute('aria-pressed'),
  stopDisabled: document.getElementById('pitchStopBtn').disabled,
  status: document.getElementById('pitchAudioStatus').textContent,
  where: document.getElementById('pitchWhere').textContent,
  ringed: Array.from(document.querySelectorAll('#pitchDisplay ellipse')).map((e, i) => e.classList.contains('note-now') ? i : -1).filter((i) => i >= 0)
}));
// The notes as drawn: each notehead's staff position from its y (bottom line y 96, 7 px a step).
const drawn = () => page.evaluate(() => Array.from(document.querySelectorAll('#pitchDisplay ellipse')).map((e) => Math.round((96 - parseFloat(e.getAttribute('cy'))) / 7)));
const click = async (id) => { await page.click('#' + id); await settle(page, 80); };

console.log('Music Sight-Reading Generator — reference pitch and play-through');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
await click('pitchTabBtn');

// ---- at rest ----
let s = await state();
ok((await fa()).made === 0, 'no AudioContext is made at load or on opening the tab');
ok(s.pressed === 'false' && s.stopDisabled, 'Play the notes is not pressed and Stop is disabled');
ok(/Nothing plays until you press a button/.test(s.status), 'the status says nothing plays until a button is pressed');
ok(await page.evaluate(() => document.getElementById('pitchWhere').getAttribute('aria-hidden') === 'true' && document.getElementById('pitchAudioStatus').getAttribute('aria-live') === 'polite'), 'the per-note text is hidden from screen readers; the status is a polite live region');
await click('newPitchBtn');
ok((await fa()).made === 0, 'a new pattern makes no AudioContext either');

// ---- no tempo number ----
await page.evaluate(() => { document.getElementById('tempo').value = 'Moderato'; });
await click('playNotesBtn');
s = await state();
ok((await fa()).made === 0 && s.pressed === 'false' && /tempo field on the Rhythm Warm-Up tab has no number/.test(s.status), 'no number in the tempo field: nothing plays, no context, and the status says why');
await page.evaluate(() => { document.getElementById('tempo').value = '♪ = 92'; });

// ---- play the notes, treble ----
await page.check('#showNames');
await settle(page, 60);
let positions = await drawn();
const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#pitchDisplay .note-name-cap')).map((t) => t.textContent));
ok(positions.length === 12 && labels.length === 12, 'twelve notes are drawn, with their names');
ok(positions.every((p, i) => noteAt(p, 'treble') === labels[i]), 'the name under each note is the note at its drawn position (the test\'s own sum agrees with the drawing)');
await click('playNotesBtn');
s = await state();
let a = await fa();
ok(a.made === 1, 'Play the notes makes the AudioContext');
ok(s.pressed === 'true' && !s.stopDisabled, 'while playing, the button is pressed and Stop is enabled');
ok(/Playing the 12 notes in order, one a beat at 92 beats a minute/.test(s.status), 'the status names the count and the tempo (' + s.status + ')');
ok(a.oscs.length >= 1 && Math.abs(a.oscs[0].at - 0.06) < 1e-9, 'the first note is scheduled just after the press, on the audio clock');
ok(s.ringed.length === 0 && s.where === '', 'no note is shown before its time');
await setT(0.07);
s = await state();
ok(s.ringed.join() === '0' && s.where === 'Note 1 of 12: ' + labels[0], 'at its time, note 1 is ringed and named (' + s.where + ')');
const spb = 60 / 92;
await setT(0.06 + spb * 11 + 0.001);
a = await fa();
s = await state();
ok(a.oscs.length === 12, 'twelve tones, one per note');
ok(a.oscs.every((o, i) => Math.abs(o.at - (0.06 + i * spb)) < 1e-9), 'even quarter notes: 60/92 s apart');
ok(a.oscs.every((o, i) => Math.abs(o.f - hz(noteAt(positions[i], 'treble'))) < 1e-6), 'each tone is the pitch of the line or space its note is drawn on (treble)');
ok(s.ringed.join() === '11' && s.where === 'Note 12 of 12: ' + labels[11], 'the last note is ringed and named');
const ring = await page.evaluate(() => { const on = getComputedStyle(document.querySelector('#pitchDisplay ellipse.note-now')); const off = getComputedStyle(document.querySelector('#pitchDisplay ellipse:not(.note-now)')); return { onFill: on.fill, offFill: off.fill, onStroke: on.strokeWidth, offStroke: off.strokeWidth, anim: on.animationName, tr: on.transitionDuration, tf: on.transform }; });
ok(ring.onFill !== ring.offFill && ring.onStroke !== ring.offStroke, 'the sounding note is filled differently and ringed, not colour alone');
ok(ring.anim === 'none' && /^0s/.test(ring.tr) && ring.tf === 'none', 'nothing moves: no animation, transition or transform to take away under reduced motion');
await page.emulateMedia({ reducedMotion: 'reduce' });
ok(await page.evaluate(() => getComputedStyle(document.querySelector('#pitchDisplay ellipse.note-now')).transform) === 'none', 'reduced motion: still nothing moves');
await page.emulateMedia({ reducedMotion: 'no-preference' });
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
  await settle(page, 60);
  const scan = await a11yScan(page, { include: '#pitchPanel' });
  const v = scan.violations || scan;
  ok(Array.isArray(v) && v.length === 0, 'axe: the sight-reading tab mid-play has no serious violation (' + theme + ')' + (Array.isArray(v) && v.length ? ': ' + v.map((x) => x.id).join(', ') : ''));
}
await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });

// ---- print while playing: the sheet is unchanged ----
await click('printBtn');
const printHtml = await page.evaluate(() => window.__printHtml);
ok(await page.evaluate(() => window.__printed) === 1 && !/note-now/.test(printHtml) && /<ellipse/.test(printHtml), 'printing mid-play draws the sheet without the ring');
await page.emulateMedia({ media: 'print' });
ok(await page.evaluate(() => getComputedStyle(document.getElementById('pitchPanel')).display === 'none' && !document.querySelector('.print-only #pitchAudioBox, .print-only #refPitchBtn')), 'the play controls are not on the printed sheet');
await page.emulateMedia({ media: 'screen' });

// ---- the end ----
await setT(0.06 + spb * 11 + spb * 0.85 + 0.01);
s = await state();
ok(s.pressed === 'false' && s.stopDisabled && s.ringed.length === 0 && s.where === '' && s.status === 'Played all 12 notes.', 'after the last note it ends by itself, clears the ring and says so');

// ---- Stop ----
let t0 = await now();
await click('playNotesBtn');
await setT(t0 + 0.07);
ok((await state()).ringed.join() === '0', 'Play again starts again from the first note');
ok((await fa()).made === 1, 'the same AudioContext is used again');
await click('pitchStopBtn');
s = await state();
let count = (await fa()).oscs.length;
ok(s.pressed === 'false' && s.stopDisabled && s.status === 'Stopped.' && s.ringed.length === 0, 'Stop stops it and clears the ring');
await setT(t0 + 30);
ok((await fa()).oscs.length === count, 'nothing more is scheduled once stopped');
t0 = await now();
await click('playNotesBtn');
await click('playNotesBtn');
ok((await state()).status === 'Stopped.', 'pressing Play the notes again while it plays stops it too');

// ---- reference pitch ----
await page.selectOption('#minNote', 'C4');
await page.selectOption('#maxNote', 'G5');
await settle(page, 60);
let before = (await fa()).oscs.length;
await click('refPitchBtn');
a = await fa();
s = await state();
ok(a.oscs.length === before + 1 && Math.abs(a.oscs[before].f - hz('C4')) < 1e-6, 'treble C4-G5: the reference pitch is C4, 261.63 Hz');
ok(/Playing C4, the reference pitch: C is home \(do\)/.test(s.status) && !s.stopDisabled && s.pressed === 'false', 'the status names it and says why C; Stop is enabled');
t0 = await now();
await setT(t0 + 2);
s = await state();
ok(s.status === 'Played the reference pitch, C4.' && s.stopDisabled, 'it ends by itself after its tone');
await page.selectOption('#minNote', 'D4');
await page.selectOption('#maxNote', 'B4');
await settle(page, 60);
positions = await drawn();
before = (await fa()).oscs.length;
await click('refPitchBtn');
a = await fa();
s = await state();
const first = noteAt(positions[0], 'treble');
ok(a.oscs.length === before + 1 && Math.abs(a.oscs[before].f - hz(first)) < 1e-6, 'D4-B4 has no C: the reference is the first note drawn, ' + first);
ok(new RegExp('Playing ' + first + ', the first note: the range D4–B4 has no C').test(s.status), 'and the status says so (' + s.status + ')');

// ---- the two never sound at once ----
t0 = await now();
await click('playNotesBtn');
a = await fa();
const refOsc = a.oscs[before];
ok(refOsc.stops.includes(0), 'Play the notes cuts the reference pitch off');
ok((await state()).pressed === 'true', 'and plays the notes');
before = a.oscs.length;
await click('refPitchBtn');
s = await state();
a = await fa();
ok(s.pressed === 'false' && a.oscs.length === before + 1 && a.oscs.slice(0, before).some((o) => o.stops.includes(0)), 'the reference pitch stops the notes and sounds alone');
await click('pitchStopBtn');

// ---- bass clef ----
await page.selectOption('#clefSelect', 'bass');
await settle(page, 80);
positions = await drawn();
before = (await fa()).oscs.length;
await click('refPitchBtn');
a = await fa();
ok(Math.abs(a.oscs[before].f - hz('C2')) < 1e-6, 'bass C2-C4: the reference pitch is C2, 65.41 Hz');
await click('pitchStopBtn');
t0 = await now();
before = (await fa()).oscs.length;
await click('playNotesBtn');
await setT(t0 + 0.06 + spb * 11 + 0.001);
a = await fa();
ok(a.oscs.length - before === 12 && a.oscs.slice(before).every((o, i) => Math.abs(o.f - hz(noteAt(positions[i], 'bass'))) < 1e-6), 'each tone is the pitch of the line or space its note is drawn on (bass)');

// ---- stops on a new pattern and a clef change ----
await click('newPitchBtn');
s = await state();
ok(s.pressed === 'false' && /new pattern/.test(s.status) && s.ringed.length === 0, 'a new pattern stops it and says so');
await click('playNotesBtn');
await page.selectOption('#clefSelect', 'treble');
await settle(page, 80);
ok((await state()).pressed === 'false', 'a clef change (a new pattern) stops it');

// ---- clamped tempo ----
await page.evaluate(() => { document.getElementById('tempo').value = '♩ = 300'; });
t0 = await now();
before = (await fa()).oscs.length;
await click('playNotesBtn');
s = await state();
await setT(t0 + 0.4);
a = await fa();
ok(/says 300/.test(s.status) && /30 to 240/.test(s.status) && /240 beats a minute/.test(s.status), 'a tempo of 300 plays at 240 and says so');
ok(Math.abs(a.oscs[before + 1].at - a.oscs[before].at - 0.25) < 1e-9, 'and the notes are 0.25 s apart');

// ---- hidden page ----
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await settle(page, 60);
s = await state();
ok(s.pressed === 'false' && /hidden/.test(s.status), 'hiding the page stops it');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });

// ---- the Rhythm tab stops it; the click track shares the context ----
await page.evaluate(() => { document.getElementById('tempo').value = '92'; });
await click('playNotesBtn');
await click('rhythmTabBtn');
ok(/sight-reading tab was closed/.test((await state()).status) && (await state()).pressed === 'false', 'opening the Rhythm tab stops it and says so');
await click('metroBtn');
ok((await fa()).made === 1, 'the click track plays through the same AudioContext');
await click('metroBtn');

// ---- storage ----
const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
ok(keysAfter.filter((k) => !keysBefore.includes(k)).length === 0, 'no new storage key (' + keysAfter.join(', ') + ')');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 200);
ok((await fa()).made === 0, 'a reload plays nothing');

ok(page.__errs.length === 0, 'no page or console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));

await browser.close();
server.close();
console.log(failed ? `music-pitch-smoke: ${failed} FAILED, ${passed} passed` : `music-pitch-smoke: OK — ${passed} checks`);
process.exit(failed ? 1 : 0);
