// smoke-board.mjs — the Classroom Timer's board: two to four independent
// timers on one screen.
//
//   node Tools/classroom-timer/test/smoke-board.mjs
//
// What is held here:
//   - the single-timer view is what it was: the markup of every part of it,
//     and the exact strings it writes to ct_prefs and ct_running_v1, are
//     compared with golden-single-view.json, captured from the v276 page,
//     before the board is opened and again after it has been opened and shut;
//   - the timers are independent, and each keeps wall-clock time: the page
//     clock is moved (fastForward, setSystemTime) and nothing is waited for
//     with page.waitForFunction, which polls on the page's own clock;
//   - a finish is announced once, shown by words and a border as well as
//     colour, rings once per tick however many timers ended in it, and obeys
//     the Alert Sound card (mute, none, flash);
//   - a reload picks running, paused and finished timers back up;
//   - the keyboard reaches everything and 1-4 never fire while typing.
// Exits 1 on any failure.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { capture } from './_single-view.mjs';

const PORT = 8513;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/004-Classroom%20Timer.html';
const GOLDEN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden-single-view.json'), 'utf8'));
const T0 = new Date('2026-03-02T15:00:00Z').getTime();
const NOW = T0 + 1000;     // the page clock is paused here at load

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

// A recording stand-in for Web Audio: a chime is three oscillators, so
// window.__osc / 3 is how many times the page rang.
const FAKE_AUDIO = () => {
  window.__osc = 0;
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() {}
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { window.__osc++; return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  };
};

async function fresh({ width = 1280, height = 900, seed, clock = true } = {}) {
  const page = await prepPage(browser, BASE, { width, height });
  await page.addInitScript(FAKE_AUDIO);
  if (seed) {
    await page.addInitScript((s) => {
      for (const k of Object.keys(s)) if (!localStorage.getItem(k) && !sessionStorage.getItem('seeded:' + k)) {
        localStorage.setItem(k, JSON.stringify(s[k]));
        sessionStorage.setItem('seeded:' + k, '1');
      }
    }, seed);
  }
  if (clock) {
    await page.clock.install({ time: T0 });
    await page.clock.pauseAt(NOW);
  }
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await page.waitForSelector('#timeDisplay', { state: 'attached' });
  return page;
}
const openBoard = async (page) => { await page.click('#boardBtn'); await page.waitForSelector('#board:not([hidden])'); };
const sel = (i, part) => `.bt[data-i="${i}"] ${part}`;
const time = (page, i) => page.textContent(sel(i, '.bt-time'));
const stateOf = (page, i) => page.evaluate((i) => document.querySelector(`.bt[data-i="${i}"]`).dataset.state, i);
const prefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ct_prefs') || 'null'));
const osc = (page) => page.evaluate(() => window.__osc);

console.log('Classroom Timer — timer board');

/* ── 1. the single-timer view is what it was ───────────────────────────── */
{
  const g = await capture(browser, BASE);
  eq(g.dom, GOLDEN.dom, 'the markup of the single-timer view is the v276 page\'s, part for part');
  eq(g.prefs, GOLDEN.prefs, 'ct_prefs after a fixed sequence is the same string, byte for byte');
  eq(g.running, GOLDEN.running, 'ct_running_v1 after the same sequence is the same string');
  eq(g.old, GOLDEN.old, 'a save written by the old page loads the same and is not rewritten by loading');
  ok(!('board' in JSON.parse(g.prefs)), 'and the single-timer view never writes a board');
}

/* ── 2. the board is opt-in, and opens ─────────────────────────────────── */
{
  const page = await fresh();
  eq(await page.isVisible('#board'), false, 'the board is not on screen to begin with');
  eq(await page.isVisible('main.timer-stage'), true, 'the single timer is');
  eq((await page.textContent('#boardBtn')).trim(), 'Timer board', 'the header offers the board');
  eq(await prefs(page), null, 'opening the page wrote nothing');
  await openBoard(page);
  eq(await page.isVisible('main.timer-stage'), false, 'opening the board puts the single timer away');
  eq(await page.isVisible('nav.mode-tabs'), false, 'and its mode tabs');
  eq((await page.textContent('#boardBtn')).trim(), 'Single timer', 'the same button goes back');
  eq(await page.locator('.bt').count(), 2, 'two timers to begin with');
  eq(await page.inputValue('#boardCount'), '2', 'the count says two');
  eq(await time(page, 0), '05:00', 'each is five minutes');
  eq(await page.getAttribute('.bt[data-i="0"] .bt-label', 'placeholder'), 'Timer 1', 'a timer with no label is "Timer 1"');
  eq((await prefs(page)).board.open, true, 'the board is saved as open');
  for (const n of [3, 4, 2]) {
    await page.selectOption('#boardCount', String(n));
    eq(await page.locator('.bt').count(), n, `${n} timers when asked for ${n}`);
  }
  // Back to the single view and the same markup as before it was opened.
  await page.click('#boardBtn');
  eq(await page.isVisible('main.timer-stage'), true, 'going back shows the single timer');
  eq(await page.isVisible('#board'), false, 'and hides the board');
  const html = await page.evaluate(() => ({ stage: document.querySelector('main.timer-stage').outerHTML.length, bm: document.body.classList.contains('board-mode') }));
  eq(html.bm, false, 'the board-mode class is gone');
  ok(html.stage > 100, 'and the stage is back');
  await page.close();
}

/* ── 3. the timers are independent ─────────────────────────────────────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.selectOption('#boardCount', '3');
  await page.fill(sel(0, '.bt-label'), 'Station A'); await page.dispatchEvent(sel(0, '.bt-label'), 'change');
  await page.fill(sel(1, '.bt-label'), 'Station B'); await page.dispatchEvent(sel(1, '.bt-label'), 'change');
  await page.fill(sel(0, 'input[aria-label="Timer 1 minutes"]'), '1'); await page.dispatchEvent(sel(0, 'input[aria-label="Timer 1 minutes"]'), 'change');
  await page.fill(sel(1, 'input[aria-label="Timer 2 minutes"]'), '2'); await page.dispatchEvent(sel(1, 'input[aria-label="Timer 2 minutes"]'), 'change');
  await page.fill(sel(1, 'input[aria-label="Timer 2 seconds"]'), '30'); await page.dispatchEvent(sel(1, 'input[aria-label="Timer 2 seconds"]'), 'change');
  eq([await time(page, 0), await time(page, 1), await time(page, 2)], ['01:00', '02:30', '05:00'], 'each timer has its own length');
  eq(await page.getAttribute(sel(0, '.bt-time'), 'aria-label'), 'Station A', 'a labelled timer is named for its label');
  eq(await page.getAttribute(sel(2, '.bt-time'), 'aria-label'), 'Timer 3', 'an unlabelled one for its number');
  const saved = (await prefs(page)).board;
  eq([saved.timers[0].label, saved.timers[1].minutes, saved.timers[1].seconds, saved.count], ['Station A', 2, 30, 3], 'labels and lengths are saved in ct_prefs');

  await page.click(sel(0, '.bt-go'));
  await page.clock.runFor(10000);
  eq(await time(page, 0), '00:50', 'timer 1 counts down');
  eq(await time(page, 1), '02:30', 'timer 2, never started, does not move');
  eq([await stateOf(page, 0), await stateOf(page, 1), await stateOf(page, 2)], ['running', 'idle', 'idle'], 'only the one started is running');
  await page.click(sel(1, '.bt-go'));
  await page.clock.runFor(5000);
  eq([await time(page, 0), await time(page, 1)], ['00:45', '02:25'], 'two run side by side');
  await page.click(sel(0, '.bt-go'));
  eq(await stateOf(page, 0), 'paused', 'timer 1 pauses');
  eq((await page.textContent(sel(0, '.bt-go'))).trim(), 'Resume', 'its button says Resume');
  await page.clock.runFor(20000);
  eq([await time(page, 0), await time(page, 1)], ['00:45', '02:05'], 'a paused timer stands still while the other runs');
  await page.click(sel(0, '.bt-go'));
  await page.clock.runFor(5000);
  eq(await time(page, 0), '00:40', 'resume carries on from where it stopped');
  eq(await page.isDisabled(sel(0, 'input[aria-label="Timer 1 minutes"]')), true, 'a running timer\'s length is locked');
  await page.click(sel(1, '.bt-reset'));
  eq([await stateOf(page, 1), await time(page, 1), await stateOf(page, 0)], ['idle', '02:30', 'running'], 'reset puts one back and leaves the other');
  eq(await page.isDisabled(sel(1, 'input[aria-label="Timer 2 minutes"]')), false, 'and unlocks its length');
  // The count cannot hide a running timer.
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#boardCount option')).map(o => [o.value, o.disabled]));
  eq(opts, [['2', false], ['3', false], ['4', false]], 'with timer 1 running any count is allowed');
  await page.click(sel(2, '.bt-go'));
  const opts2 = await page.evaluate(() => Array.from(document.querySelectorAll('#boardCount option')).map(o => [o.value, o.disabled]));
  eq(opts2, [['2', true], ['3', false], ['4', false]], 'with timer 3 running, two is refused');
  await page.click(sel(2, '.bt-reset'));
  await page.click('#boardResetAll');
  eq([await stateOf(page, 0), await stateOf(page, 1), await stateOf(page, 2)], ['idle', 'idle', 'idle'], 'Reset all puts every timer back');
  eq(await time(page, 0), '01:00', 'at its own length');
  await page.close();
}

/* ── 4. wall-clock time: a sleeping device, a hidden tab ───────────────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.click(sel(0, '.bt-go'));
  await page.clock.runFor(1000);
  // The laptop sleeps for two minutes: the clock jumps, no tick runs in between.
  await page.clock.setSystemTime(NOW + 1000 + 120000);
  await page.clock.runFor(300);
  eq(await time(page, 0), '02:59', 'after a two-minute sleep the timer shows what the clock says, not what was counted');
  await page.clock.fastForward(150000);
  eq(await stateOf(page, 0), 'running', 'a gap that does not pass the end leaves it running');
  eq(await time(page, 0), '00:29', 'at the right time');
  await page.clock.fastForward(60000);
  eq(await stateOf(page, 0), 'done', 'a gap past the end finishes it');
  eq(await time(page, 0), '00:00', 'at zero, not negative');
  await page.close();
}

/* ── 5. finishing: announced once, shown without colour, rung once ─────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.evaluate(() => {
    window.__live = [];
    new MutationObserver(() => { const t = document.getElementById('boardLive').textContent; if (t) window.__live.push(t); })
      .observe(document.getElementById('boardLive'), { childList: true, characterData: true, subtree: true });
  });
  for (const i of [0, 1]) {
    await page.fill(sel(i, `input[aria-label="Timer ${i + 1} minutes"]`), '0'); await page.dispatchEvent(sel(i, `input[aria-label="Timer ${i + 1} minutes"]`), 'change');
    await page.fill(sel(i, `input[aria-label="Timer ${i + 1} seconds"]`), '20'); await page.dispatchEvent(sel(i, `input[aria-label="Timer ${i + 1} seconds"]`), 'change');
  }
  await page.fill(sel(0, '.bt-label'), 'Group A'); await page.dispatchEvent(sel(0, '.bt-label'), 'change');
  await page.fill(sel(1, '.bt-label'), 'Group B'); await page.dispatchEvent(sel(1, '.bt-label'), 'change');
  await page.click(sel(0, '.bt-go'));
  await page.click(sel(1, '.bt-go'));
  eq(await osc(page), 0, 'nothing rings at the start');
  await page.clock.runFor(21000);
  eq([await stateOf(page, 0), await stateOf(page, 1)], ['done', 'done'], 'both finish');
  eq(await osc(page), 3, 'two timers ending in the same tick ring once (one chime is three tones)');
  const live = await page.evaluate(() => window.__live);
  eq(live, ["Group A and Group B: time's up"], 'a screen reader is told once, naming both');
  await page.clock.runFor(30000);
  eq((await page.evaluate(() => window.__live)).length, 1, 'and nothing more is said while they sit finished');
  eq(await osc(page), 3, 'or rung');
  const looks = await page.evaluate(() => {
    const c = document.querySelector('.bt[data-i="0"]');
    const cs = getComputedStyle(c);
    return { border: parseFloat(cs.borderTopWidth), plain: parseFloat(getComputedStyle(document.querySelector('.bt[data-i="1"]')).borderTopWidth),
      text: c.querySelector('.bt-state').textContent, time: c.querySelector('.bt-time').textContent };
  });
  ok(looks.border >= 6, `a finished timer has a thick border (${looks.border}px), not only a colour`);
  ok(/Time's up/.test(looks.text), `and says so in words (${JSON.stringify(looks.text)})`);
  eq(looks.time, '00:00', 'at 00:00');
  // a third and a fourth, finishing in different ticks, ring once each
  await page.selectOption('#boardCount', '4');
  for (const i of [2, 3]) {
    await page.fill(sel(i, `input[aria-label="Timer ${i + 1} minutes"]`), '0'); await page.dispatchEvent(sel(i, `input[aria-label="Timer ${i + 1} minutes"]`), 'change');
    await page.fill(sel(i, `input[aria-label="Timer ${i + 1} seconds"]`), String(i === 2 ? 10 : 15)); await page.dispatchEvent(sel(i, `input[aria-label="Timer ${i + 1} seconds"]`), 'change');
    await page.click(sel(i, '.bt-go'));
  }
  await page.clock.runFor(16000);
  eq(await osc(page), 9, 'timers that end in different ticks ring once each');
  eq((await page.evaluate(() => window.__live)).slice(1), ["Timer 3: time's up", "Timer 4: time's up"], 'and are announced one at a time');
  // starting a finished timer again runs it from its full length
  await page.click(sel(0, '.bt-go'));
  eq([await stateOf(page, 0), await time(page, 0)], ['running', '00:20'], 'a finished timer starts again from its length');
  await page.close();
}

/* ── 6. the Alert Sound card decides ───────────────────────────────────── */
{
  const cases = [
    ['muted', { sound: { choice: 'chime', volume: 0.7, muted: true, flashEnabled: false } }, 0, false],
    ['none', { sound: { choice: 'none', volume: 0.7, muted: false, flashEnabled: false } }, 0, false],
    ['zero volume', { sound: { choice: 'bell', volume: 0, muted: false, flashEnabled: false } }, 0, false],
    ['flash only', { sound: { choice: 'none', volume: 0.7, muted: false, flashEnabled: true } }, 0, true],
    ['buzzer', { sound: { choice: 'buzzer', volume: 0.5, muted: false, flashEnabled: false } }, 3, false],
    ['bell', { sound: { choice: 'bell', volume: 0.5, muted: false, flashEnabled: true } }, 2, true],
  ];
  for (const [name, p, tones, flash] of cases) {
    const page = await fresh({ seed: { ct_prefs: { v: 1, ...p } } });
    await openBoard(page);
    await page.fill(sel(0, 'input[aria-label="Timer 1 minutes"]'), '0'); await page.dispatchEvent(sel(0, 'input[aria-label="Timer 1 minutes"]'), 'change');
    await page.fill(sel(0, 'input[aria-label="Timer 1 seconds"]'), '5'); await page.dispatchEvent(sel(0, 'input[aria-label="Timer 1 seconds"]'), 'change');
    await page.click(sel(0, '.bt-go'));
    await page.clock.runFor(6000);
    eq(await osc(page), tones, `${name}: ${tones} tone(s)`);
    eq(await page.evaluate(() => document.getElementById('zeroFlashOverlay').classList.contains('active')), flash, `${name}: the flash is ${flash ? 'on' : 'off'}`);
    await page.close();
  }
}

/* ── 7. a reload picks the board up ────────────────────────────────────── */
{
  const seed = { ct_prefs: { v: 1, board: { open: true, count: 4, timers: [
    { label: 'Running', minutes: 5, seconds: 0, endAt: NOW + 90000, leftMs: 0 },
    { label: 'Paused', minutes: 5, seconds: 0, endAt: 0, leftMs: 45000 },
    { label: 'Ran out', minutes: 5, seconds: 0, endAt: NOW - 60000, leftMs: 0 },
    { label: 'Fresh', minutes: 2, seconds: 30, endAt: 0, leftMs: 150000 },
  ] } } };
  const page = await fresh({ seed });
  eq(await page.isVisible('#board'), true, 'a board left open comes back open');
  eq(await page.locator('.bt').count(), 4, 'with its four timers');
  eq([await stateOf(page, 0), await stateOf(page, 1), await stateOf(page, 2), await stateOf(page, 3)], ['running', 'paused', 'done', 'idle'], 'each in the state it was left in');
  eq(await time(page, 0), '01:30', 'a running timer is read off its end time');
  eq(await time(page, 1), '00:45', 'a paused one shows what was left');
  eq(await time(page, 2), '00:00', 'one that ran out while closed is finished');
  eq(await time(page, 3), '02:30', 'a fresh one is its length');
  eq(await page.inputValue(sel(0, '.bt-label')), 'Running', 'labels come back');
  eq(await osc(page), 0, 'nothing rings for a timer that ran out while the page was closed');
  eq(await page.evaluate(() => document.getElementById('boardLive').textContent), '', 'and nothing is announced');
  await page.clock.runFor(30000);
  eq([await time(page, 0), await time(page, 1)], ['01:00', '00:45'], 'the running one carries on and the paused one does not');
  eq(await osc(page), 0, 'still silent');
  // The running timer finishes after the reload and rings.
  await page.click(sel(3, '.bt-go'));   // a click unlocks audio, as a teacher's would
  await page.clock.runFor(61000);
  eq(await stateOf(page, 0), 'done', 'it finishes');
  eq(await osc(page), 3, 'and rings once');
  await page.close();
}
{
  // a real round trip through the page's own save, not a seeded one
  const page = await fresh();
  await openBoard(page);
  await page.fill(sel(1, '.bt-label'), 'Lab'); await page.dispatchEvent(sel(1, '.bt-label'), 'change');
  await page.click(sel(1, '.bt-go'));
  await page.clock.runFor(20000);
  const before = await prefs(page);
  eq(before.board.timers[1].endAt, NOW + 300000, 'the end time is saved, not the countdown');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#timeDisplay', { state: 'attached' });
  eq(await page.isVisible('#board'), true, 'a reload reopens the board');
  eq(await stateOf(page, 1), 'running', 'and the timer is still running');
  ok(/^0[45]:[0-5]\d$/.test(await time(page, 1)), `at about the right time (${await time(page, 1)})`);
  eq(await page.inputValue(sel(1, '.bt-label')), 'Lab', 'with its label');
  await page.close();
}

/* ── 8. switching views is guarded ─────────────────────────────────────── */
{
  const page = await fresh();
  await page.click('#startBtn');
  await page.click('#boardBtn');
  eq(await page.isVisible('#board'), false, 'the board does not open over a running single timer');
  ok(/single timer/i.test(await page.textContent('#boardNote')), 'and says why, in words');
  eq(await page.isVisible('#boardNote'), true, 'where it can be seen');
  await page.click('#resetBtn');
  await openBoard(page);
  eq(await page.isVisible('#boardNote'), false, 'the note goes once the board opens');
  await page.click(sel(0, '.bt-go'));
  await page.click('#boardBtn');
  eq(await page.isVisible('#board'), true, 'the board does not close over a running timer');
  ok(/board timers/i.test(await page.textContent('#boardNote')), 'and says why');
  await page.click(sel(0, '.bt-go'));
  await page.click('#boardBtn');
  eq(await page.isVisible('#board'), true, 'nor over a paused one');
  await page.click(sel(0, '.bt-reset'));
  await page.click('#boardBtn');
  eq(await page.isVisible('#board'), false, 'it closes once nothing is running');
  // and the single view after all that is the same
  await page.close();
}
{
  const g = await capture(browser, BASE);
  eq(g.dom, GOLDEN.dom, 'the single-timer markup is still the v276 page\'s');
}

/* ── 9. the single timer's keys and remote leave the board alone ───────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Space');
  eq(await page.evaluate(() => localStorage.getItem('ct_running_v1')), null, 'Space does not start the hidden single timer');
  await page.keyboard.press('r');
  eq(await page.evaluate(async () => { const m = await import('./classroom-timer/ct-app.js'); m.applyRemoteCommand('start'); return localStorage.getItem('ct_running_v1'); }), null, 'nor does a command from the paired phone');
  eq(await page.evaluate(async () => { const m = await import('./classroom-timer/ct-app.js'); return m.getDisplaySnapshot().text; }), '05:00', 'the mirror keeps showing the single timer');
  await page.close();
}

/* ── 10. the keyboard ──────────────────────────────────────────────────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.selectOption('#boardCount', '4');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('4');
  eq(await stateOf(page, 3), 'running', '4 starts timer 4 when there are four');
  await page.keyboard.press('Digit4');
  await page.click(sel(3, '.bt-reset'));
  await page.selectOption('#boardCount', '3');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('2');
  eq([await stateOf(page, 0), await stateOf(page, 1), await stateOf(page, 2)], ['idle', 'running', 'idle'], '2 starts timer 2');
  await page.keyboard.press('2');
  eq(await stateOf(page, 1), 'paused', '2 again pauses it');
  await page.keyboard.press('2');
  eq(await stateOf(page, 1), 'running', 'and again resumes');
  await page.keyboard.press('4');
  eq(await page.locator('.bt').count(), 3, '4 with three timers does nothing');
  eq(await stateOf(page, 0), 'idle', 'to any of them');
  await page.keyboard.press('Numpad1');
  eq(await stateOf(page, 0), 'running', 'the number pad works');
  await page.keyboard.press('Control+3');
  eq(await stateOf(page, 2), 'idle', 'a digit with Control is left to the browser');
  // typing in a label never fires a timer
  await page.focus(sel(2, '.bt-label'));
  await page.keyboard.type('Room 3');
  eq(await page.inputValue(sel(2, '.bt-label')), 'Room 3', 'a digit typed in a label lands in it');
  eq(await stateOf(page, 2), 'idle', 'and starts nothing');
  await page.focus(sel(2, 'input[aria-label="Timer 3 minutes"]'));
  await page.keyboard.press('1');
  eq(await stateOf(page, 0), 'running', 'nor does a digit in a minutes field toggle timer 1');
  await page.focus('#boardCount');
  await page.keyboard.press('1');
  eq(await stateOf(page, 0), 'running', 'nor one on the count');
  // the shortcuts dialog is a modal: keys behind it stay put
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('?');
  eq(await page.isVisible('#helpOverlay'), true, 'the shortcuts dialog opens over the board');
  await page.keyboard.press('3');
  eq(await stateOf(page, 2), 'idle', 'and a digit behind it does nothing');
  await page.keyboard.press('Escape');
  // every control is reachable by Tab
  await page.evaluate(() => { document.body.focus(); document.activeElement && document.activeElement.blur(); });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.id || (a.className + ':' + a.textContent.trim().slice(0, 12))) : ''; });
    seen.add(d);
  }
  // (timers 1 and 2 are running, so their lengths are locked and rightly skipped)
  for (const want of ['boardBtn', 'boardCount', 'boardResetAll', 'Timer 1 label', 'Timer 2 label', 'Timer 3 label', 'Timer 3 minutes', 'Timer 3 seconds']) {
    ok(seen.has(want), `Tab reaches ${want}`);
  }
  ok([...seen].some((s) => /bt-go/.test(s)) && [...seen].some((s) => /bt-reset/.test(s)), 'and every timer\'s Start and Reset buttons');
  await page.close();
}

/* ── 11. layout: side by side on a projector, stacked on a phone ───────── */
{
  const page = await fresh({ width: 1280, height: 720 });
  await openBoard(page);
  const geo = async () => page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.bt')).map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; });
    return { cards, over: document.documentElement.scrollWidth - window.innerWidth,
      font: parseFloat(getComputedStyle(document.querySelector('.bt-time')).fontSize) };
  });
  let g = await geo();
  eq(g.cards.length, 2, 'two timers');
  ok(g.cards[0].y === g.cards[1].y && g.cards[1].x > g.cards[0].x, 'sit side by side at 1280 wide');
  ok(g.font >= 80, `with digits big enough for the back of a room (${g.font}px)`);
  eq(g.over <= 0, true, 'and nothing scrolls sideways');
  await page.selectOption('#boardCount', '4');
  g = await geo();
  eq(new Set(g.cards.map((c) => c.y)).size, 2, 'four make two rows of two');
  ok(g.font >= 80, `still large (${g.font}px)`);
  await page.selectOption('#boardCount', '3');
  g = await geo();
  eq(new Set(g.cards.map((c) => c.y)).size, 1, 'three sit in a row on a wide screen');
  await page.setViewportSize({ width: 375, height: 700 });
  await settle(page, 100);
  await page.selectOption('#boardCount', '4');
  g = await geo();
  eq(new Set(g.cards.map((c) => c.x)).size, 1, 'at 375 wide they stack in one column');
  eq(new Set(g.cards.map((c) => c.y)).size, 4, 'one under another');
  eq(g.over <= 0, true, 'with nothing scrolling sideways');
  ok(g.font >= 36, `and digits still readable (${g.font}px)`);
  // the longest time the board can show still fits its card
  await page.fill(sel(0, 'input[aria-label="Timer 1 minutes"]'), '180'); await page.dispatchEvent(sel(0, 'input[aria-label="Timer 1 minutes"]'), 'change');
  eq(await time(page, 0), '3:00:00', 'three hours reads as h:mm:ss');
  const fit = await page.evaluate(() => { const t = document.querySelector('.bt[data-i="0"] .bt-time'); return t.scrollWidth <= t.clientWidth + 1; });
  eq(fit, true, 'and fits on a phone');
  await page.close();
}

/* ── 12. accessibility ─────────────────────────────────────────────────── */
{
  // no fake clock here: axe waits on the page's own timers, which a paused clock never fires
  const real = Date.now();
  const page = await fresh({ clock: false, seed: { ct_prefs: { v: 1, board: { open: true, count: 4, timers: [
    { label: 'Running', minutes: 5, seconds: 0, endAt: real + 3600000, leftMs: 0 },
    { label: 'Paused', minutes: 5, seconds: 0, endAt: 0, leftMs: 45000 },
    { label: 'Ran out', minutes: 5, seconds: 0, endAt: real - 60000, leftMs: 0 },
    { label: '', minutes: 2, seconds: 30, endAt: 0, leftMs: 150000 },
  ] } } } });
  const v = await a11yScan(page, { impact: 'serious' });
  eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe finds nothing serious on the board in every state');
  const names = await page.evaluate(() => Array.from(document.querySelectorAll('#board input, #board select, #board button')).filter((e) => !(e.getAttribute('aria-label') || (e.labels && e.labels.length) || e.textContent.trim())).length);
  eq(names, 0, 'every control on the board has a name');
  const live = await page.evaluate(() => ({ role: document.getElementById('boardLive').getAttribute('role'), live: document.getElementById('boardLive').getAttribute('aria-live'),
    timerLive: Array.from(document.querySelectorAll('.bt-time')).some((t) => t.hasAttribute('aria-live')) }));
  eq(live, { role: 'status', live: 'polite', timerLive: false }, 'one polite live region, and the ticking digits are not live');
  const dark = await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); return getComputedStyle(document.querySelector('.bt')).backgroundColor; });
  ok(dark !== 'rgb(255, 255, 255)', `dark mode paints the cards from the page's tokens (${dark})`);
  await settle(page, 500);   // the page fades its colours; axe must not sample mid-fade
  const v2 = await a11yScan(page, { impact: 'serious' });
  eq(v2.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'and axe is clean in dark too');
  await page.close();
}

/* ── 13. nothing leaves the page, nothing throws ───────────────────────── */
{
  const page = await fresh();
  await openBoard(page);
  await page.click(sel(0, '.bt-go'));
  await page.clock.runFor(2000);
  await page.click('#boardBtn');
  await page.click(sel(0, '.bt-reset'));
  await page.click('#boardBtn');
  eq(page.__errs, [], 'no console or page errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked, [], 'no request left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
