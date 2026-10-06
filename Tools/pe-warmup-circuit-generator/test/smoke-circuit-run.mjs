// smoke-circuit-run.mjs — 069 PE Warm-Up Circuit Card Generator: "Run the circuit".
//
//   node Tools/pe-warmup-circuit-generator/test/smoke-circuit-run.mjs        (port 8496)
//
// The projector view, driven in a browser with the page's clock mocked
// (page.clock) and Web Audio replaced by a recorder, so the sound is asserted
// as scheduled and when — it is NOT heard here, and no real speaker was used.
//
//   Settings: work / rest / groups saved with the circuit, only once edited; a
//   circuit saved before this loads and saves back byte for byte; a share
//   link carries them (clamped).
//   The view: opens as a dialog, page behind inert, focus on Start, the
//   station large, countdown, round, what is next; icons that are HTML
//   entities decode to the character; nothing a station says runs.
//   The clock: Space starts, pauses, resumes (once, with a button focused);
//   a jump of 95 s with no tick lands on the right second; paused time
//   does not count; skip, reset, groups, the end, Start again.
//   The signal: the screen's phase and colour change once per phase, no
//   animation, none under reduced motion; ROTATE shows with no rest.
//   Sound: off until turned on; scheduled tones and their times; a late
//   signal is not sounded.
//   Leaving: F, Esc and the button; focus back; the run stops.
//   Print, and axe in both phases.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8496;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/069-pe-warmup-circuit-generator.html';
const NAME = 'Gym Circuit';
const DATA = 'pe_circuit_v1:' + NAME;

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const stations = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: 's' + i, emoji: i === 0 ? '&#129354;' : '🏃', name: 'Move ' + (i + 1), duration: i + 1 + ' reps', instructions: 'Cue ' + (i + 1), ...extra,
}));
const circuit = (n, run) => {
  const o = { name: NAME, title: 'Monday Circuit', stations: stations(n), cardsPerPage: '4' };
  if (run) o.run = run;
  return o;
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.emulateMedia({ reducedMotion: 'reduce' }); // so a colour read is never mid-fade; the fade is its own check below
await page.addInitScript(() => {
  window.__pwned = 0; window.__printed = 0; window.print = () => { window.__printed++; };
  window.__audio = { made: 0, tones: [] };
  window.AudioContext = class {
    constructor() { window.__audio.made++; this.state = 'running'; this.destination = {}; }
    get currentTime() { return performance.now() / 1000; }
    resume() {}
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createOscillator() {
      const ctx = this; const o = { frequency: { value: 0 }, connect() {}, start(when) { window.__audio.tones.push({ freq: o.frequency.value, when, now: ctx.currentTime, dur: 0 }); this._i = window.__audio.tones.length - 1; }, stop(t) { window.__audio.tones[this._i].dur = t - window.__audio.tones[this._i].when; } };
      return o;
    }
  };
});

const T0 = Date.parse('2026-10-06T10:00:00Z');
async function load(data, { clock = true, url = URL_PAGE } = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (data !== undefined) {
    await page.evaluate(([k, d, n]) => {
      localStorage.clear();
      if (d) {
        localStorage.setItem('pe_circuits_v1', JSON.stringify([n]));
        localStorage.setItem(k, typeof d === 'string' ? d : JSON.stringify(d));
        localStorage.setItem('pe_circuit_current_v1', n);
      }
    }, [DATA, data, NAME]);
    await page.reload({ waitUntil: 'networkidle' });
  }
  await settle(page);
  if (clock) {
    await page.clock.install({ time: T0 }); await page.clock.pauseAt(T0 + 1000); await page.clock.runFor(500);
    // count the page's live intervals: a run that is paused, over or closed must hold none
    await page.evaluate(() => {
      const si = window.setInterval, ci = window.clearInterval;
      window.__iv = new Set();
      window.setInterval = (...a) => { const id = si(...a); window.__iv.add(id); return id; };
      window.clearInterval = (id) => { window.__iv.delete(id); return ci(id); };
    });
  }
}
const txt = (sel) => page.textContent(sel);
const stored = () => page.evaluate((k) => localStorage.getItem(k), DATA);
const stageState = () => page.evaluate(() => ({
  phase: document.getElementById('runStage').dataset.phase,
  parity: document.getElementById('runStage').dataset.parity,
  label: document.getElementById('runPhase').textContent,
  time: document.getElementById('runTime').textContent,
  round: document.getElementById('runRound').textContent,
  next: document.getElementById('runNext').textContent,
  btn: document.getElementById('runToggle').textContent,
  tiles: [...document.querySelectorAll('#runTiles .run-tile')].map((t) => [...t.children].map((c) => c.textContent).join(' ')),
  bg: getComputedStyle(document.getElementById('runStage')).backgroundColor,
}));
const tones = () => page.evaluate(() => window.__audio.tones.map((t) => ({ freq: t.freq, off: +(t.when - t.now).toFixed(3), dur: +t.dur.toFixed(3), now: t.now })));
const clearTones = () => page.evaluate(() => { window.__audio.tones.length = 0; });
const live = () => page.evaluate(() => window.__iv.size);
const run = (ms) => page.clock.runFor(ms);
// page.waitForFunction polls on the page's own rAF/timers, which page.clock
// has replaced, so it would wait forever; poll from Node on the real clock.
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(fn)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return ok(false, 'timed out waiting for ' + label);
}
const left = () => until(() => document.getElementById('runStage').hidden, 'the view to close');
const settled = () => until(() => document.getElementById('runStage').classList.contains('is-fullscreen'), 'the view to open');
const open = async () => { await page.click('#runBtn'); await settled(); await run(100); };

// ---- 1. settings and storage ----
console.log('settings');
const oldBlob = JSON.stringify(circuit(8));
await load(oldBlob, { clock: false });
eq(await stored(), oldBlob, 'a circuit saved before this existed loads and saves back byte for byte');
eq([await page.inputValue('#runWork'), await page.inputValue('#runRest'), await page.inputValue('#runGroups')], ['30', '10', '1'], 'defaults 30 / 10 / 1 show');
eq(await txt('#runSummary'), '8 stations: 30 s work + 10 s rest each, 5:10 in all.', 'the summary adds it up');
ok(await page.isEnabled('#runBtn'), 'Run the circuit is enabled with stations');
for (const id of ['runWork', 'runRest', 'runGroups']) {
  ok(await page.evaluate((i) => !!document.querySelector(`label[for="${i}"]`)?.textContent.trim(), id), `${id} has a label`);
}
await page.fill('#runWork', '45'); await page.fill('#runRest', '0'); await page.fill('#runGroups', '4');
eq(JSON.parse(await stored()).run, { workSecs: 45, restSecs: 0, groups: 4 }, 'editing saves run with the circuit');
eq(await txt('#runSummary'), '8 stations: 45 s work each, 6:00 in all, 4 groups.', 'summary with no rest and groups');
await page.fill('#runWork', '1'); await page.press('#runWork', 'Tab');
eq(await page.inputValue('#runWork'), '5', 'a value under the limit is corrected to 5 when the field is left');
await page.fill('#runGroups', '99'); await page.press('#runGroups', 'Tab');
eq(await page.inputValue('#runGroups'), '26', 'groups over the limit are 26');
eq(await txt('#runSummary'), '8 stations: 5 s work each, 0:40 in all, 8 groups (groups limited to the 8 stations).', 'groups beyond the stations say so');
await page.fill('#runWork', ''); await page.fill('#runRest', '');
eq(JSON.parse(await stored()).run, { workSecs: 30, restSecs: 10, groups: 26 }, 'empty fields take the defaults');
await page.fill('#runWork', '40'); await page.fill('#runRest', '5'); await page.fill('#runGroups', '1');
await page.reload({ waitUntil: 'networkidle' });
eq([await page.inputValue('#runWork'), await page.inputValue('#runRest'), await page.inputValue('#runGroups')], ['40', '5', '1'], 'settings survive a reload');
eq(JSON.parse(await stored()).stations.length, 8, 'stations untouched by editing settings');
// share arrival
const link = await page.evaluate((c) => StateLink.buildShareUrl('circuit', c), { ...circuit(3), name: 'Shared', run: { workSecs: 9999, restSecs: 'x', groups: 2 } });
await load(undefined, { clock: false, url: link });
eq(await page.evaluate(() => JSON.parse(localStorage.getItem('pe_circuit_v1:Shared')).run), { workSecs: 600, restSecs: 10, groups: 2 }, 'a share link carries the settings, clamped and defaulted');
const link2 = await page.evaluate((c) => StateLink.buildShareUrl('circuit', c), { ...circuit(3), name: 'Plain' });
await load(undefined, { clock: false, url: link2 });
eq(await page.evaluate(() => 'run' in JSON.parse(localStorage.getItem('pe_circuit_v1:Plain'))), false, 'a link without settings saves without them');

// ---- 2. open ----
console.log('open');
await load(circuit(8, { workSecs: 30, restSecs: 10, groups: 1 }));
await page.evaluate(() => document.activeElement.blur());
for (const k of ['Space', 'n', 'r', 'm', 'ArrowRight']) await page.keyboard.press(k); // hotkeys must not exist before the view is open
await run(100);
ok(await page.evaluate(() => document.getElementById('runStage').hidden && !document.body.classList.contains('stage-presenting')), 'the run keys on the page do nothing while the view is closed');
await page.click('#runBtn');
await settled();
await run(100);
ok(await page.evaluate(() => !document.getElementById('runStage').hidden && document.getElementById('runStage').classList.contains('is-fullscreen')), 'the view opens');
eq(await page.evaluate(() => [document.getElementById('runStage').getAttribute('role'), document.getElementById('runStage').getAttribute('aria-modal'), !!document.getElementById('runStage').getAttribute('aria-label')]), ['dialog', 'true', true], 'it is a labelled modal dialog');
ok(await page.evaluate(() => document.querySelector('.wrap').inert), 'the page behind is inert');
eq(await page.evaluate(() => document.activeElement.id), 'runToggle', 'focus is on Start');
let st = await stageState();
eq([st.phase, st.label, st.time, st.round, st.btn], ['work', 'Work', '0:30', 'Round 1 of 8', 'Start'], 'ready: work, 0:30, round 1 of 8, Start');
eq(st.next, 'Next: Station 2 Move 2', 'next station named');
eq(st.tiles.length, 1, 'one group: one large card');
ok(st.tiles[0].includes('Station 1') && st.tiles[0].includes('Move 1') && st.tiles[0].includes('1 reps') && st.tiles[0].includes('Cue 1'), 'the card has number, name, reps and cue');
eq(await txt('.rt-emoji'), String.fromCodePoint(129354), 'an entity icon is shown as the character');
ok(!(await page.evaluate(() => document.getElementById('runStage').innerText)).includes('&#'), 'no raw entity on the view');
eq(await page.evaluate(() => document.getElementById('runTitle').textContent), 'Monday Circuit', 'the title');
eq(await page.evaluate(() => document.getElementById('runTime').getAttribute('role')), 'timer', 'the clock is a timer');
eq(await page.evaluate(() => document.getElementById('runTime').getAttribute('aria-live')), 'off', 'the clock is not read out every second');
eq(await stored().then((s) => JSON.parse(s).run), { workSecs: 30, restSecs: 10, groups: 1 }, 'opening the view changes no saved data');

// ---- 3. clock and signal ----
console.log('clock');
await page.keyboard.press('Space');       // focus is on the Start button: still exactly one toggle
await run(1000);
st = await stageState();
eq([st.btn, st.time], ['Pause', '0:29'], 'Space with the button focused starts once (not start then pause)');
eq(await live(), 1, 'a running run holds exactly one timer');
await run(28000);
eq((await stageState()).time, '0:01', 'at 29 s: 0:01');
st = await stageState();
eq([st.phase, st.parity, st.bg], ['work', 'even', 'rgb(11, 74, 44)'], 'work colour (even round)');
await run(1000);
st = await stageState();
eq([st.phase, st.label, st.time, st.bg], ['rest', 'Rotate — move now', '0:10', 'rgb(255, 213, 74)'], 'at 30 s: rotate, 0:10, the bright field');
eq(st.round, 'Round 2 of 8', 'during the rest the view is the round being moved to');
ok(st.tiles[0].includes('Station 2'), 'and the card is station 2');
eq(st.next, 'Then: Station 3 Move 3', 'then station 3');
eq(await txt('#runLive'), 'Rotate. Move to Station 2 Move 2.', 'the screen reader hears the rotation once');
await run(10000);
st = await stageState();
eq([st.phase, st.parity, st.time, st.bg, st.round], ['work', 'odd', '0:30', 'rgb(11, 63, 102)', 'Round 2 of 8'], 'at 40 s: round 2 works on the second dark field');
eq(await txt('#runLive'), 'Work. Round 2 of 8. Station 2 Move 2.', 'announced');
eq(st.label, 'Work', 'with a rest the work phase never says Rotate (the rest said it)');
// pause
await page.keyboard.press('Space');
await run(5000);
st = await stageState();
eq([st.btn, st.time], ['Resume', '0:30'], 'paused at 40 s: Resume, 0:30');
eq(await live(), 0, 'a paused run holds no timer');
await run(600000);
eq((await stageState()).time, '0:30', 'ten paused minutes move nothing');
await page.keyboard.press('Space');
await run(10000);
eq((await stageState()).time, '0:20', 'resumed: 10 s later 0:20');
// drift
await page.keyboard.press('r');
st = await stageState();
eq([st.btn, st.time, st.phase, st.label], ['Start', '0:30', 'work', 'Work'], 'R resets');
await page.keyboard.press('Space');
await page.clock.fastForward(95000);       // a frozen tab: no tick for 95 s
await run(100);
st = await stageState();
eq([st.time, st.round, st.phase], ['0:15', 'Round 3 of 8', 'work'], '95 s with no tick: the right second, 15 s into round 3');
// skip
await page.keyboard.press('ArrowRight');
st = await stageState();
eq([st.phase, st.time], ['rest', '0:10'], 'Right arrow skips to the rest');
await page.keyboard.press('n');
st = await stageState();
eq([st.phase, st.round, st.time], ['work', 'Round 4 of 8', '0:30'], 'N skips to the next round');
await page.click('#runSkip');
eq((await stageState()).phase, 'rest', 'the Skip button too');
await run(2100);
eq((await stageState()).time, '0:08', 'still running after a skip');
// end
await page.clock.fastForward(400000);
await run(100);
st = await stageState();
eq([st.phase, st.label, st.time, st.btn, st.tiles.length, st.next], ['done', 'Circuit complete', '0:00', 'Start again', 0, ''], 'the end: complete, 0:00, Start again, no card');
eq(await txt('#runLive'), 'Circuit complete.', 'announced');
eq(await live(), 0, 'a finished run holds no timer');
await page.keyboard.press('Space');
await run(100);
st = await stageState();
eq([st.phase, st.btn, st.round], ['work', 'Pause', 'Round 1 of 8'], 'Space after the end starts a fresh run');
await page.keyboard.press('r');
// the last round
for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight');
st = await stageState();
eq([st.phase, st.round, st.next], ['rest', 'Round 8 of 8', 'Last station'], 'moving to the last station: nothing comes after it');
await page.keyboard.press('ArrowRight');
st = await stageState();
eq([st.phase, st.round, st.next], ['work', 'Round 8 of 8', 'Last station'], 'the last round says it is the last');
await page.keyboard.press('r');

// ---- 4. groups ----
console.log('groups');
await page.keyboard.press('f'); await left();
await page.fill('#runGroups', '4');
await open();
st = await stageState();
eq(st.tiles.length, 4, 'four groups: four cards');
ok(st.tiles[0].startsWith('Group A') && st.tiles[0].includes('Station 1') && st.tiles[1].includes('Station 3') && st.tiles[3].includes('Station 7'), 'A at 1, B at 3, C at 5, D at 7');
eq(st.next, 'Next: Group A → Station 2 Move 2  ·  Group B → Station 4 Move 4  ·  Group C → Station 6 Move 6  ·  Group D → Station 8 Move 8', 'where each group goes next');
await page.keyboard.press('ArrowRight');
st = await stageState();
ok(st.tiles[0].startsWith('Group A') && st.tiles[0].includes('Station 2') && st.tiles[3].includes('Station 8'), 'in the rest the cards show the stations they are moving to');
await page.keyboard.press('f'); await left();

// ---- 5. signal: no rest, no flashing ----
console.log('signal');
await page.fill('#runRest', '0'); await page.fill('#runWork', '5'); await page.fill('#runGroups', '1');
await open();
await page.keyboard.press('Space');
const seen = [];
for (let i = 0; i < 25; i++) { await run(1000); const s = await stageState(); seen.push(`${s.phase}/${s.parity}/${s.label}`); }
const fieldOf = (v) => v.split('/').slice(0, 2).join('/');
const changes = seen.filter((v, i) => i && fieldOf(v) !== fieldOf(seen[i - 1])).length;
eq(changes, 5, `no rest: the field changes once per 5 s round, never more (${changes} changes in 25 s)`);
ok(seen.some((v) => v.endsWith('Rotate — new station')) && seen.some((v) => v.endsWith('/Work')), 'with no rest, ROTATE shows at the start of a round, then Work');
eq((await stageState()).parity, 'odd', 'round 6 is on the odd field');
const anim = await page.evaluate(() => [...document.querySelectorAll('#runStage, #runStage *')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
eq(anim, 0, 'no CSS animation anywhere on the view');
await page.emulateMedia({ reducedMotion: 'no-preference' });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('runStage')).transitionDuration), '0.6s', 'the field fades over 0.6 s, once');
await page.emulateMedia({ reducedMotion: 'reduce' });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('runStage')).transitionDuration), '0s', 'under reduced motion the change is instant');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.keyboard.press('f'); await left();

// ---- 6. sound ----
console.log('sound');
await page.fill('#runRest', '10'); await page.fill('#runWork', '30');
await open();
eq(await page.getAttribute('#runSound', 'aria-pressed'), 'false', 'beep is off at first');
eq(await txt('#runSound'), 'Beep: off', 'and says so');
await page.keyboard.press('Space');
await run(31000);                           // through the first rotation
eq(await page.evaluate(() => [window.__audio.made, window.__audio.tones.length]), [0, 0], 'off: no audio context made and nothing sounded through a rotation');
await page.keyboard.press('r');
await page.keyboard.press('m');
eq([await page.getAttribute('#runSound', 'aria-pressed'), await txt('#runSound')], ['true', 'Beep: on'], 'M turns it on');
let tn = await tones();
eq(tn.map((t) => [t.freq, t.off, t.dur]), [[880, 0, 0.15]], 'turning it on sounds one test beep, scheduled now');
await clearTones();
await page.keyboard.press('Space');         // start: the go beep
await run(200);
tn = await tones();
eq(tn.map((t) => [t.freq, t.off, t.dur]), [[1175, 0, 0.5]], 'start: one go beep, 0.5 s, at the moment of the signal');
await clearTones();
const before = await page.evaluate(() => performance.now() / 1000);
await run(30000);                           // work ends at 30 s of the run
tn = await tones();
eq(tn.map((t) => [t.freq, t.off, t.dur]), [[880, 0, 0.2], [880, 0.3, 0.2]], 'rotation: two beeps, the second 0.3 s after the first');
const boundary = before + 30 - 0.2;         // the run began ~0.2 s before `before`
ok(tn.length && tn[0].now >= boundary - 0.05 && tn[0].now <= boundary + 0.16, `the rotation beep is scheduled within a tick of the boundary (at ${tn[0] && tn[0].now.toFixed(2)}, boundary ${boundary.toFixed(2)})`);
await clearTones();
await run(10000);
eq((await tones()).map((t) => [t.freq, t.off]), [[1175, 0]], 'rest over: the go beep');
await clearTones();
await page.clock.fastForward(60000);        // a frozen tab wakes in the middle of a round
await run(100);
eq((await tones()).length, 0, 'a signal noticed 15+ s late is not sounded');
await clearTones();
await page.click('#runSkip');
eq((await tones()).map((t) => t.freq), [880, 880], 'a skip does sound its signal');
await clearTones();
await page.clock.fastForward(1000000); await run(100);
eq((await tones()).map((t) => [t.freq, t.off, t.dur]).length, 0, 'the end reached by a long jump: late, silent');
await page.keyboard.press('r'); await page.keyboard.press('Space'); await clearTones();
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
eq((await tones()).slice(-3).map((t) => [t.freq, t.off, t.dur]), [[660, 0, 0.2], [880, 0.3, 0.2], [1175, 0.6, 0.4]], 'the end: three rising beeps');
await page.keyboard.press('m');
eq(await page.getAttribute('#runSound', 'aria-pressed'), 'false', 'M turns it off again');
await clearTones();
await page.keyboard.press('r'); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
eq((await tones()).length, 0, 'off again: silent');

// ---- 7. a11y, print ----
console.log('a11y and print');
await page.keyboard.press('r');
await page.clock.resume();                 // axe waits on timers of its own, which a paused clock never fires
eq((await a11yScan(page)).map((v) => v.id), [], 'axe: no serious violation in the work phase');
await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
eq((await a11yScan(page)).map((v) => v.id), [], 'axe: none in the rotate phase');
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('runStage')).display), 'none', 'the view never prints');
await page.emulateMedia({ media: 'screen' });
for (const sel of ['#runToggle', '#runSkip', '#runReset', '#runSound', '#runClose']) {
  ok(await page.evaluate((s) => document.querySelector(s).textContent.trim().length > 0, sel), `${sel} has a name`);
}
const tabOrder = [];
await page.focus('#runToggle');
for (let i = 0; i < 5; i++) { tabOrder.push(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press('Tab'); }
eq(tabOrder, ['runToggle', 'runSkip', 'runReset', 'runSound', 'runClose'], 'Tab goes through the five controls in order');

// ---- 8. leaving ----
console.log('leaving');
if ((await stageState()).btn !== 'Pause') await page.keyboard.press('Space');
eq((await stageState()).btn, 'Pause', 'left while running');
eq(await live(), 1, 'one timer while it runs');
await page.keyboard.press('f');
await left();
ok(await page.evaluate(() => document.getElementById('runStage').hidden), 'F leaves');
eq(await live(), 0, 'leaving a running view stops its timer');
ok(await page.evaluate(() => !document.querySelector('.wrap').inert), 'the page is live again');
eq(await page.evaluate(() => document.activeElement.id), 'runBtn', 'focus is back on Run the circuit');
await run(60000);
await open();
eq((await stageState()).time, '0:30', 'it stopped when left: opening again is a fresh run');
await page.click('#runClose'); await left();
ok(await page.evaluate(() => document.getElementById('runStage').hidden), 'the Exit button leaves');
await open();
const fallback = await page.evaluate(() => document.getElementById('runStage').classList.contains('stage-fallback'));
await page.keyboard.press('Escape');
if (fallback) { await left(); ok(true, 'Esc leaves the overlay'); }
else { await page.click('#runClose'); await left(); }

// ---- 9. text is text ----
console.log('text');
await load({ ...circuit(2), stations: [
  { id: 'a', emoji: '<b id="x">B</b>', name: '<img src=x onerror="window.__pwned=1">Hop', duration: '<script>window.__pwned=2</script>', instructions: '=1+1 &amp; <i>go</i>' },
  { id: 'b', emoji: '&lt;', name: 'Two', duration: '', instructions: '' },
] });
await open();
st = await stageState();
ok(st.tiles[0].includes('<img src=x onerror="window.__pwned=1">Hop') && st.tiles[0].includes('<script>window.__pwned=2</script>') && st.tiles[0].includes('=1+1 &amp; <i>go</i>'), 'markup in a station is shown as characters');
eq(await page.evaluate(() => [document.querySelectorAll('#runStage img, #runStage script, #runStage b, #runStage i').length, window.__pwned]), [0, 0], 'no element made from it and nothing ran');
eq(await txt('.rt-emoji'), '<b id="x">B</b>', 'an icon that is markup is text');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
eq(await txt('.rt-emoji'), '<', 'an icon of &lt; is the character');
await page.keyboard.press('f'); await left();

eq(page.__errs, [], 'no page errors, console errors or failed requests');
eq(page.__blocked, [], 'no offsite request');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
