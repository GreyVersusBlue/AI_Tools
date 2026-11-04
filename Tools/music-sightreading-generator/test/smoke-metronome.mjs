// smoke-metronome.mjs — 067's click track on the page (AI-47), port 8688.
//
//   node Tools/music-sightreading-generator/test/smoke-metronome.mjs   (npm run test:music-metronome-smoke)
//
// The scheduler's arithmetic is metronome.test.mjs's job. This suite drives the page with a
// fake AudioContext whose clock the suite sets by hand, and holds the wiring: no
// AudioContext until Play is pressed (nothing autoplays), a tempo field with no number
// plays nothing and says so, the clicks follow the field's number and are clamped to
// 30-240 with a sentence saying so, the beat indicator names the beat in text and marks it
// by more than colour, the measure being played is outlined, a count-in is one measure of
// the chosen time signature, and the track stops on Stop, on a new pattern, on a change of
// time signature or tempo, on the sight-reading tab and when the page is hidden. Reduced
// motion takes the pulse off, the controls are not on the printed sheet, the count-in
// setting rides in the settings record the page already had (no new key), and the page
// logs no errors. Nobody has listened to it: the sound itself is unverified.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8688;
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
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await page.addInitScript(FAKE_AUDIO);

const fa = () => page.evaluate(() => ({ made: window.__fa.made, oscs: window.__fa.oscs.map((o) => ({ at: o.at, f: o.frequency.log[0] && o.frequency.log[0][0] })) }));
const setT = async (t) => { await page.evaluate((v) => { window.__fa.t = v; }, t); await settle(page, 120); };
const state = () => page.evaluate(() => ({
  pressed: document.getElementById('metroBtn').getAttribute('aria-pressed'),
  btn: document.getElementById('metroBtn').textContent,
  status: document.getElementById('metroStatus').textContent,
  where: document.getElementById('metroWhere').textContent,
  dots: Array.from(document.querySelectorAll('#metroBeats .metro-beat')).map((d) => ({ n: d.textContent, on: d.classList.contains('on'), counting: d.classList.contains('counting'), accent: d.classList.contains('accent') })),
  playing: Array.from(document.querySelectorAll('#rhythmDisplay .measure')).map((m) => m.classList.contains('now-playing'))
}));
const press = async () => { await page.click('#metroBtn'); await settle(page, 80); };

console.log('Music Sight-Reading Generator — click track');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());

// ---- at rest ----
let s = await state();
ok((await fa()).made === 0, 'no AudioContext is made at load');
ok(s.pressed === 'false' && /Play click track/.test(s.btn), 'the button reads Play and is not pressed');
ok(/Nothing plays until you press Play/.test(s.status), 'the status says nothing plays until Play');
ok(s.dots.length === 4 && s.dots.map((d) => d.n).join('') === '1234' && s.dots[0].accent && !s.dots[1].accent, '4/4 shows four numbered beats, beat 1 marked as the accent');
ok(await page.evaluate(() => document.querySelector('label[for="tempo"]').textContent) === 'Tempo (printed, and used by the click track and the sight-reading play-through)', 'the tempo label no longer says "for the display only"');
ok(await page.evaluate(() => document.getElementById('metroBeats').getAttribute('aria-hidden') === 'true' && document.getElementById('metroStatus').getAttribute('aria-live') === 'polite'), 'the per-beat picture is hidden from screen readers; the status is a polite live region');
await page.click('#newRhythmBtn'); await settle(page, 80);
ok((await fa()).made === 0, 'a new pattern makes no AudioContext either');

// ---- a field with no number ----
await page.fill('#tempo', 'Allegro, please');
await press();
s = await state();
ok((await fa()).made === 0, 'no number: no AudioContext is made');
ok(s.pressed === 'false' && /no number/.test(s.status), 'no number: nothing plays and the status says why');
await page.fill('#tempo', '♪ = 92');

// ---- play at 92 ----
await press();
s = await state();
let a = await fa();
ok(a.made === 1, 'Play makes the AudioContext');
ok(s.pressed === 'true' && /Stop click track/.test(s.btn), 'while playing the button reads Stop and is pressed');
ok(/Playing 92 beats a minute in 4\/4/.test(s.status) && /higher click on beat 1/.test(s.status), 'the status names the tempo, the time signature and the accent');
ok(a.oscs.length >= 1 && Math.abs(a.oscs[0].at - 0.06) < 1e-9, 'the first click is scheduled just after Play, on the audio clock');
ok(!s.dots.some((d) => d.on), 'no beat is shown before its time');
await setT(0.07);
s = await state();
ok(s.dots[0].on && !s.dots[1].on, 'at the first beat\'s time, beat 1 is shown');
ok(s.where === 'Measure 1 of 4, beat 1', 'the text names the measure and the beat (' + s.where + ')');
ok(s.playing[0] && s.playing.filter(Boolean).length === 1, 'the first measure is outlined');
const spb = 60 / 92;
await setT(0.06 + spb * 5 + 0.001);
s = await state();
a = await fa();
ok(s.dots[1].on && s.where === 'Measure 2 of 4, beat 2' && s.playing[1], 'five beats later: measure 2, beat 2, measure 2 outlined');
ok(a.oscs.slice(0, 6).every((o, i) => Math.abs(o.at - (0.06 + i * spb)) < 1e-9), 'the clicks are 60/92 s apart');
ok(a.oscs[0].f > a.oscs[1].f && a.oscs[4].f === a.oscs[0].f, 'beat 1 of each measure is the higher click');
const onStyle = await page.evaluate(() => { const d = document.querySelector('.metro-beat.on'); const c = getComputedStyle(d); return { bw: c.borderTopWidth, bg: c.backgroundColor, tf: c.transform }; });
const offStyle = await page.evaluate(() => { const d = document.querySelector('.metro-beat:not(.on)'); const c = getComputedStyle(d); return { bw: c.borderTopWidth, bg: c.backgroundColor }; });
ok(onStyle.bg !== offStyle.bg && onStyle.tf !== 'none', 'the sounding beat is filled and pulses (motion allowed)');
await page.emulateMedia({ reducedMotion: 'reduce' });
ok(await page.evaluate(() => getComputedStyle(document.querySelector('.metro-beat.on')).transform) === 'none', 'reduced motion: the pulse is off, the fill and number stay');
await page.emulateMedia({ reducedMotion: 'no-preference' });

// ---- print: the controls are not on the paper ----
await page.emulateMedia({ media: 'print' });
ok(await page.evaluate(() => getComputedStyle(document.getElementById('rhythmPanel')).display === 'none' && !document.querySelector('#printRhythmArea #metroBox, #printRhythmArea .metro-beat')), 'the click track is not on the printed sheet');
await page.emulateMedia({ media: 'screen' });

// ---- stop on a new pattern ----
await page.click('#newRhythmBtn'); await settle(page, 80);
s = await state();
let count = (await fa()).oscs.length;
ok(s.pressed === 'false' && /new pattern/.test(s.status), 'a new pattern stops the click track and says so');
ok(!s.dots.some((d) => d.on) && !s.playing.some(Boolean) && s.where === '', 'stopping clears the beat and the measure outline');
await setT(9);
ok((await fa()).oscs.length === count, 'nothing more is scheduled once stopped');

// ---- Stop button ----
await press();
ok((await state()).pressed === 'true', 'Play again starts again');
ok((await fa()).made === 1, 'the same AudioContext is used again');
await press();
s = await state();
ok(s.pressed === 'false' && s.status === 'Stopped.', 'Stop stops it');

// ---- the page is hidden ----
await press();
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await settle(page, 60);
s = await state();
ok(s.pressed === 'false' && /hidden/.test(s.status), 'hiding the page stops it');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });

// ---- tempo and time signature changes stop it ----
await press();
await page.fill('#tempo', '♪ = 100');
await settle(page, 60);
s = await state();
ok(s.pressed === 'false' && /tempo changed/.test(s.status), 'typing in the tempo field stops it');
await press();
await page.selectOption('#timeSig', '3');
await settle(page, 60);
s = await state();
ok(s.pressed === 'false' && /time signature/.test(s.status), 'a new time signature stops it');
ok(s.dots.length === 3, 'and the beat picture shows three beats for 3/4');

// ---- clamped ----
await page.fill('#tempo', '♩ = 300');
const firstOsc = (await fa()).oscs.length;
let t0 = await page.evaluate(() => window.__fa.t);
await press();
s = await state();
ok(/says 300/.test(s.status) && /30 to 240/.test(s.status) && /playing 240 beats a minute/.test(s.status), 'a tempo of 300 plays at 240 and says so (' + s.status + ')');
await setT(t0 + 0.3);
a = await fa();
ok(Math.abs(a.oscs[firstOsc + 1].at - a.oscs[firstOsc].at - 0.25) < 1e-9, 'and the clicks are 0.25 s apart');
await press();

// ---- count-in, 3/4 ----
await page.fill('#tempo', '60');
await page.check('#countInToggle');
await settle(page, 60);
t0 = await page.evaluate(() => window.__fa.t);
await press();
await setT(t0 + 0.07);
s = await state();
ok(s.where === 'Count-in, beat 1' && s.dots.every((d) => d.counting) && s.dots[0].on, 'count-in: the first beat is named as the count-in and drawn dashed');
ok(!s.playing.some(Boolean), 'no measure is outlined during the count-in');
await setT(t0 + 0.06 + 3 + 0.001);
s = await state();
ok(s.where === 'Measure 1 of 4, beat 1' && !s.dots.some((d) => d.counting) && s.playing[0], 'after three beats of count-in, measure 1 begins');
ok(/after one measure of count-in/.test(s.status), 'the status says it counts in');

// ---- the sight-reading tab stops it ----
await page.click('#pitchTabBtn'); await settle(page, 60);
s = await state();
ok(s.pressed === 'false' && /rhythm tab was closed/.test(s.status), 'opening the sight-reading tab stops it');
await page.click('#rhythmTabBtn'); await settle(page, 60);

// ---- storage ----
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('msrg_settings_v1')));
ok(saved && saved.rhythm && saved.rhythm.countIn === true, 'the count-in choice is saved in the settings record the page already had');
const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
ok(keysAfter.filter((k) => !keysBefore.includes(k)).length === 0, 'no new storage key (' + keysAfter.join(', ') + ')');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 200);
ok(await page.evaluate(() => document.getElementById('countInToggle').checked), 'the count-in choice survives a reload');
ok((await fa()).made === 0, 'and the reload plays nothing');

ok(page.__errs.length === 0, 'no page or console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));

await browser.close();
server.close();
console.log(failed ? `music-metronome-smoke: ${failed} FAILED, ${passed} passed` : `music-metronome-smoke: OK — ${passed} checks`);
process.exit(failed ? 1 : 0);
