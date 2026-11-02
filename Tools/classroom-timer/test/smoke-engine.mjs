// smoke-engine.mjs — what the Classroom Timer's phase engine does, pinned.
//
//   node Tools/classroom-timer/test/smoke-engine.mjs
//
// Path 22 P13 moved the arithmetic of 004's phase (countdown, transition, round
// robin, agenda, and overtime past zero) onto _shared/countdown.js. A refactor
// of a tool a teacher runs live must not change what it does, so this suite was
// written FIRST and passed on the old code (the commit before the port) before
// the port was made; it passes unchanged on the new.
//
// It drives the real page on a fake clock (Playwright's page.clock), so every
// number below is exact rather than "about". Sound and the flash are counted by
// event: a stand-in AudioContext counts the sounds Sounds.play() starts, and
// DOMTokenList.add is wrapped to count the flash classes ('flash' on the time,
// 'active' on the zero-flash overlay). Nothing is judged by ear.
//
// What is pinned: start, pause, resume and reset; the saved shape in
// ct_running_v1 (a strip window, an older open tab and a refresh all read it);
// a refresh mid-run, paused, in overtime and after the end time has passed;
// round robin with and without loop; agenda advance, early skip (running and
// paused) and the last segment; overtime, paused and resumed; random; and the
// instant just past zero before the tick has noticed.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8654;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/004-Classroom%20Timer.html';
const T0 = Date.UTC(2026, 10, 2, 14, 0, 0);
const B = T0 + 10000;   // the instant every scenario starts at, once the page is up

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const PREFS_BASE = {
  v: 1,
  sound: { choice: 'chime', volume: 0.7, muted: false, flashEnabled: true },
  display: { amberPct: 25, redPct: 10, overtimeEnabled: false, endMessage: '' }
};

/** A page whose clock stands still at `now` until the scenario moves it. */
async function open(prefs, { now = B, running = null, ctx = null } = {}) {
  const page = ctx ? await ctx.newPage() : await prepPage(browser, BASE, { width: 1100, height: 800 });
  if (ctx) {
    page.__errs = [];
    page.on('pageerror', e => page.__errs.push(String(e)));
  }
  await page.addInitScript(({ prefs, running }) => {
    if (prefs && !localStorage.getItem('ct_prefs')) localStorage.setItem('ct_prefs', JSON.stringify(prefs));
    if (running && !localStorage.getItem('ct_running_v1')) localStorage.setItem('ct_running_v1', JSON.stringify(running));
    window.__plays = 0;
    window.__flash = 0;
    window.__overlay = 0;
    const fake = {
      state: 'running', currentTime: 0, destination: {},
      resume() {},
      createGain() {
        return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
                 connect(d) { if (d === fake.destination) window.__plays++; } };
      },
      createOscillator() {
        return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
      }
    };
    window.AudioContext = function () { return fake; };
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...a) {
      if (a.includes('flash')) window.__flash++;
      if (a.includes('active') && this.__id === 'zeroFlashOverlay') window.__overlay++;
      return add.apply(this, a);
    };
    // The overlay is the one element with this id; count 'active' being added to it.
    const cl = Object.getOwnPropertyDescriptor(Element.prototype, 'classList');
    Object.defineProperty(Element.prototype, 'classList', {
      get() { const l = cl.get.call(this); try { l.__id = this.id; } catch (e) { /* ignore */ } return l; }
    });
    Math.random = () => 0.5;
  }, { prefs, running });
  await page.clock.install({ time: now - 10000 });
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await page.clock.pauseAt(now);
  await settle(page, 50);
  return page;
}

const view = (page) => page.evaluate(() => ({
  time: document.getElementById('timeDisplay').textContent,
  sub: document.getElementById('subDisplay').textContent,
  seg: document.getElementById('agendaCurrent').textContent,
  endMsg: document.getElementById('subDisplay').classList.contains('end-message'),
  plays: window.__plays,
  flash: window.__flash,
  overlay: window.__overlay,
  overlayOn: document.getElementById('zeroFlashOverlay').classList.contains('active'),
  start: !document.getElementById('startBtn').hidden,
  pause: !document.getElementById('pauseBtn').hidden,
  resume: !document.getElementById('resumeBtn').hidden,
  run: JSON.parse(localStorage.getItem('ct_running_v1') || 'null')
}));
const run = async (page, ms) => { await page.clock.runFor(ms); };

console.log('Classroom Timer — phase engine, pinned');

/* ── 1. countdown: start, run, pause, resume, ring, flash ──────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } });
  let v = await view(page);
  eq(v.time, '01:00', '1: idle shows the length'); eq(v.run, null, '1: nothing saved while idle');
  await page.click('#startBtn');
  v = await view(page);
  eq(v.run.mode, 'countdown', '1: saved as countdown');
  eq(v.run.phase.status, 'running', '1: saved running');
  eq(v.run.phase.totalMs, 60000, '1: saved total');
  eq(v.run.phase.endAt, B + 60000, '1: saved end time is start + length');
  ok(v.pause && !v.start && !v.resume, '1: Pause is the visible button');
  await run(page, 30000);
  v = await view(page);
  eq(v.time, '00:30', '1: 30 s in');
  await page.click('#pauseBtn');
  v = await view(page);
  eq(v.run.phase.status, 'paused', '1: saved paused');
  eq(v.run.phase.remainingAtPause, 30000, '1: saved what is left');
  ok(v.resume && !v.pause, '1: Resume is the visible button');
  await run(page, 10000);
  v = await view(page);
  eq(v.time, '00:30', '1: paused time does not move'); eq(v.plays, 0, '1: nothing rang while paused');
  await page.click('#resumeBtn');
  v = await view(page);
  eq(v.run.phase.status, 'running', '1: resumed');
  eq(v.run.phase.endAt, B + 70000, '1: resume ends 30 s from now');
  await run(page, 29000);
  v = await view(page);
  eq(v.time, '00:01', '1: one second to go'); eq(v.plays, 0, '1: not ringing yet'); eq(v.flash, 0, '1: not flashing yet');
  await run(page, 1000);
  v = await view(page);
  eq(v.time, '00:00', '1: zero'); eq(v.plays, 1, '1: one sound at zero'); eq(v.flash, 1, '1: one flash of the time');
  eq(v.overlay, 1, '1: the zero-flash overlay came on once'); eq(v.overlayOn, true, '1: and is showing');
  eq(v.sub, "Time's up!", '1: end text'); eq(v.endMsg, true, '1: end style');
  eq(v.run, null, '1: nothing saved once done'); ok(v.start && !v.pause, '1: Start is back');
  await run(page, 4000);
  v = await view(page);
  eq(v.overlayOn, false, '1: the overlay goes after 4 s'); eq(v.plays, 1, '1: and nothing rang again');
  await run(page, 5000);
  eq((await view(page)).plays, 1, '1: a finished timer never rings twice');
  await page.click('#startBtn');
  v = await view(page);
  eq(v.run.phase.endAt, B + 79000 + 60000, '1: a finished timer starts again from its full length');
  await run(page, 100);
  eq((await view(page)).time, '01:00', '1: and shows it');
  await page.click('#pauseBtn');
  await page.click('#resetBtn');
  v = await view(page);
  eq(v.time, '01:00', '1: reset goes back to the length'); eq(v.run, null, '1: reset clears the save');
  eq(page.__errs.length, 0, '1: no errors ' + page.__errs.join('|'));
  await page.context().close();
}

/* ── 2. zero length does not start ─────────────────────────────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 0, seconds: 0 } });
  await page.click('#startBtn');
  const v = await view(page);
  eq(v.run, null, '2: a zero length starts nothing'); ok(v.start, '2: Start is still showing');
  await page.context().close();
}

/* ── 3. transition has its own text at the end ─────────────────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'transition', transition: { minutes: 0, seconds: 5 } });
  await page.click('#startBtn');
  let v = await view(page);
  eq(v.run.mode, 'transition', '3: saved as transition'); eq(v.run.phase.endAt, B + 5000, '3: ends in 5 s');
  await run(page, 5000);
  v = await view(page);
  eq(v.sub, "Time's up — let's move on!", '3: transition end text'); eq(v.plays, 1, '3: one sound');
  await page.context().close();
}

/* ── 4. overtime: counts up, pauses, resumes ───────────────────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 0, seconds: 10 },
    display: { amberPct: 25, redPct: 10, overtimeEnabled: true, endMessage: 'Pencils down.' } });
  await page.click('#startBtn');
  await run(page, 10000);
  let v = await view(page);
  eq(v.plays, 1, '4: one sound entering overtime'); eq(v.flash, 1, '4: one flash');
  eq(v.run.phase.status, 'running', '4: overtime is still "running"');
  eq(v.run.phase.overtimeStarted, true, '4: saved as overtime');
  eq(v.run.phase.endAt, B + 10000, '4: the zero instant is kept');
  eq(v.sub, 'Pencils down.', '4: the teacher\'s end message'); eq(v.endMsg, true, '4: end style');
  await run(page, 5000);
  v = await view(page);
  eq(v.time, '+00:05', '4: 5 s over'); eq(v.plays, 1, '4: overtime does not ring again');
  await page.click('#pauseBtn');
  v = await view(page);
  eq(v.run.phase.status, 'paused', '4: paused in overtime');
  eq(v.run.phase.remainingAtPause, -5000, '4: saved as minus the time over');
  await run(page, 7000);
  eq((await view(page)).time, '+00:05', '4: overtime holds while paused');
  await page.click('#resumeBtn');
  v = await view(page);
  eq(v.run.phase.endAt, B + 17000, '4: resume moves the zero instant by the pause');
  await run(page, 3000);
  eq((await view(page)).time, '+00:08', '4: overtime goes on from where it was');
  await page.click('#pauseBtn');
  await page.click('#resetBtn');
  v = await view(page);
  eq(v.time, '00:10', '4: reset is the way out'); eq(v.run, null, '4: nothing saved');
  await page.context().close();
}

/* ── 5. the instant just past zero, before the tick has noticed ────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } });
  await page.click('#startBtn');
  await page.clock.setFixedTime(B + 60050);   // Date.now() moves; the interval has not run yet
  await page.click('#pauseBtn');
  let v = await view(page);
  eq(v.run.phase.status, 'paused', '5: a pause 50 ms past zero is a pause');
  eq(v.run.phase.remainingAtPause, -50, '5: and saves what it measured, minus 50 ms');
  await page.clock.setFixedTime(B + 70000);
  await page.click('#resumeBtn');
  v = await view(page);
  eq(v.run.phase.endAt, B + 69950, '5: resume puts the end 50 ms behind now');
  await run(page, 200);
  v = await view(page);
  eq(v.plays, 1, '5: the next tick rings once'); eq(v.run, null, '5: and the timer is done');
  await page.context().close();
}

/* ── 6. round robin, no loop, then loop ────────────────────────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'roundrobin', roundrobin: { minutes: 0, seconds: 10, stations: 3, loop: false } });
  await page.click('#startBtn');
  let v = await view(page);
  eq(v.sub, 'Station 1 of 3', '6: starts at station 1'); eq(v.run.phase.station, 1, '6: saved station');
  eq(v.run.phase.stations, 3, '6: saved stations'); eq(v.run.phase.endAt, B + 10000, '6: saved end');
  await run(page, 10000);
  v = await view(page);
  eq(v.sub, 'Station 2 of 3', '6: station 2'); eq(v.plays, 1, '6: a sound at the change');
  eq(v.run.phase.endAt, B + 20000, '6: the next station runs a full length from the change');
  await run(page, 100);
  eq((await view(page)).time, '00:10', '6: and shows it');
  v = await view(page);
  await run(page, 10000);
  v = await view(page);
  eq(v.sub, 'Station 3 of 3', '6: station 3'); eq(v.plays, 2, '6: second sound');
  await run(page, 10000);
  v = await view(page);
  eq(v.sub, 'All stations complete!', '6: the last station ends the rotation'); eq(v.plays, 3, '6: third sound');
  eq(v.run, null, '6: nothing saved once done'); eq(v.time, '00:00', '6: shows zero');
  await page.context().close();
}
{
  const page = await open({ ...PREFS_BASE, activeTab: 'roundrobin', roundrobin: { minutes: 0, seconds: 10, stations: 2, loop: true } });
  await page.click('#startBtn');
  await run(page, 20000);
  const v = await view(page);
  eq(v.sub, 'Station 1 of 2', '6: with loop it goes back to station 1'); eq(v.run.phase.status, 'running', '6: and keeps running');
  eq(v.run.phase.station, 1, '6: saved station 1'); eq(v.plays, 2, '6: a sound at each change');
  eq(v.run.phase.endAt, B + 30000, '6: a full length from the wrap');
  await page.context().close();
}

/* ── 7. agenda: advance, skip, last segment ────────────────────────────── */
const AGENDA = { segments: [{ name: 'Warm up', minutes: 0, seconds: 10 }, { name: 'Notes', minutes: 0, seconds: 20 }] };
{
  const page = await open({ ...PREFS_BASE, activeTab: 'agenda', agenda: AGENDA });
  let v = await view(page);
  eq(v.time, '00:10', '7: idle shows the first segment'); eq(v.seg, 'Warm up', '7: and names it'); eq(v.sub, 'Next: Notes', '7: and the next');
  await page.click('#startBtn');
  v = await view(page);
  eq(v.run.phase.segIndex, 0, '7: saved segment index'); eq(v.run.phase.totalMs, 10000, '7: saved segment length');
  eq(v.run.phase.agendaTotalMs, 30000, '7: saved whole length'); eq(v.run.phase.agendaElapsedBase, 0, '7: saved elapsed base');
  eq(v.run.phase.endAt, B + 10000, '7: saved end');
  await run(page, 10000);
  v = await view(page);
  eq(v.seg, 'Notes', '7: moved to the next segment'); eq(v.sub, 'Last segment', '7: the last is named so');
  eq(v.plays, 1, '7: a sound at the change'); eq(v.run.phase.segIndex, 1, '7: saved index 1');
  eq(v.run.phase.totalMs, 20000, '7: the new length'); eq(v.run.phase.endAt, B + 30000, '7: a full segment from the change');
  eq(v.run.phase.agendaElapsedBase, 10000, '7: elapsed base grew by the segment');
  eq(v.time, '00:20', '7: shows the new length');
  await run(page, 20000);
  v = await view(page);
  eq(v.sub, 'Agenda complete!', '7: the last segment ends the agenda'); eq(v.plays, 2, '7: second sound');
  eq(v.run, null, '7: nothing saved once done');
  await page.context().close();
}
{
  const page = await open({ ...PREFS_BASE, activeTab: 'agenda', agenda: AGENDA,
    display: { amberPct: 25, redPct: 10, overtimeEnabled: true, endMessage: '' } });
  await page.click('#startBtn');
  await run(page, 30000);
  let v = await view(page);
  eq(v.run.phase.status, 'running', '7: the last segment goes into overtime when it is on');
  eq(v.run.phase.overtimeStarted, true, '7: saved as overtime'); eq(v.plays, 2, '7: two sounds so far');
  await run(page, 3000);
  eq((await view(page)).time, '+00:03', '7: counting up past the agenda');
  await page.context().close();
}
{
  const page = await open({ ...PREFS_BASE, activeTab: 'agenda', agenda: AGENDA });
  await page.click('#startBtn');
  await run(page, 3000);
  await page.evaluate(async () => { (await import('/Tools/classroom-timer/ct-app.js')).applyRemoteCommand('next'); });
  let v = await view(page);
  eq(v.seg, 'Notes', '7: the phone\'s Next segment skips ahead'); eq(v.plays, 0, '7: a skip does not ring');
  eq(v.run.phase.endAt, B + 3000 + 20000, '7: the skipped-to segment starts a full length from now');
  eq(v.run.phase.agendaElapsedBase, 10000, '7: elapsed base counts the skipped segment whole');
  eq(v.time, '00:20', '7: shows it at once');
  await page.evaluate(async () => { (await import('/Tools/classroom-timer/ct-app.js')).applyRemoteCommand('next'); });
  eq((await view(page)).seg, 'Notes', '7: Next on the last segment does nothing');
  await page.context().close();
}
{
  const page = await open({ ...PREFS_BASE, activeTab: 'agenda', agenda: AGENDA });
  await page.click('#startBtn');
  await run(page, 4000);
  await page.click('#pauseBtn');
  await page.evaluate(async () => { (await import('/Tools/classroom-timer/ct-app.js')).applyRemoteCommand('next'); });
  let v = await view(page);
  eq(v.run.phase.status, 'paused', '7: a skip while paused stays paused');
  eq(v.run.phase.remainingAtPause, 20000, '7: and holds the new segment whole');
  eq(v.time, '00:20', '7: shows it'); eq(v.seg, 'Notes', '7: names it');
  await run(page, 5000);
  eq((await view(page)).time, '00:20', '7: holds while paused');
  await page.click('#resumeBtn');
  v = await view(page);
  eq(v.run.phase.endAt, B + 9000 + 20000, '7: resume runs the new segment from the resume instant');
  await page.context().close();
}

/* ── 8. random ─────────────────────────────────────────────────────────── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'random', random: { minMinutes: 1, maxMinutes: 3 } });
  await page.click('#startBtn');
  let v = await view(page);
  eq(v.run.phase.targetMs, 120000, '8: the cue is set from the random draw'); eq(v.run.phase.startAt, B, '8: saved start');
  await run(page, 30000);
  await page.click('#pauseBtn');
  v = await view(page);
  eq(v.run.phase.elapsedBase, 30000, '8: pause banks the elapsed time');
  await page.click('#resumeBtn');
  await run(page, 89900);
  eq((await view(page)).plays, 0, '8: not yet');
  await run(page, 100);
  v = await view(page);
  eq(v.plays, 1, '8: the cue rings once'); eq(v.sub, 'Triggered at 02:00', '8: and says when');
  await page.context().close();
}

/* ── 9. a refresh in every state ───────────────────────────────────────── */
async function refresh(prefs, steps, at) {
  const page = await open(prefs);
  await steps(page);
  const ctx = page.context();
  const saved = await page.evaluate(() => ({ p: localStorage.getItem('ct_prefs'), r: localStorage.getItem('ct_running_v1') }));
  await page.close();
  const page2 = await open(null, { now: at, ctx });
  return { page: page2, saved };
}
{ // running, 20 s in, reloaded at 25 s
  const { page, saved } = await refresh({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } },
    async (p) => { await p.click('#startBtn'); await run(p, 20000); }, B + 25000);
  let v = await view(page);
  eq(v.time, '00:35', '9: a refresh mid-run shows what is left now'); ok(v.pause && !v.start, '9: Pause is showing');
  eq(v.run.phase.endAt, B + 60000, '9: and the same end time');
  eq(v.plays, 0, '9: nothing rang on the refresh');
  await run(page, 34900);
  eq((await view(page)).plays, 0, '9: it carries on');
  await run(page, 100);
  v = await view(page);
  eq(v.flash, 1, '9: it signals once at the original end (a refresh has no sound until a click unlocks audio)'); eq(v.run, null, '9: and finishes');
  JSON.parse(saved.r);
  await page.context().close();
}
{ // paused, reloaded much later
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } },
    async (p) => { await p.click('#startBtn'); await run(p, 20000); await p.click('#pauseBtn'); }, B + 500000);
  let v = await view(page);
  eq(v.time, '00:40', '9: a paused timer comes back with what it had'); ok(v.resume && !v.pause, '9: Resume is showing');
  await run(page, 60000);
  v = await view(page);
  eq(v.time, '00:40', '9: and does not move'); eq(v.plays, 0, '9: or ring');
  await page.click('#resumeBtn');
  v = await view(page);
  eq(v.run.phase.endAt, B + 500000 + 60000 + 40000, '9: resume ends 40 s from now');
  await page.context().close();
}
{ // overtime, running, reloaded
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 0, seconds: 10 },
      display: { amberPct: 25, redPct: 10, overtimeEnabled: true, endMessage: '' } },
    async (p) => { await p.click('#startBtn'); await run(p, 14000); }, B + 20000);
  const v = await view(page);
  eq(v.time, '+00:10', '9: a refresh in overtime shows the time over'); eq(v.endMsg, true, '9: end style');
  eq(v.plays, 0, '9: no sound on the refresh');
  await run(page, 2000);
  eq((await view(page)).time, '+00:12', '9: overtime carries on');
  await page.context().close();
}
{ // overtime, paused, reloaded
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 0, seconds: 10 },
      display: { amberPct: 25, redPct: 10, overtimeEnabled: true, endMessage: '' } },
    async (p) => { await p.click('#startBtn'); await run(p, 14000); await p.click('#pauseBtn'); }, B + 99000);
  const v = await view(page);
  eq(v.time, '+00:04', '9: paused overtime comes back as it was'); ok(v.resume, '9: Resume is showing');
  await page.context().close();
}
{ // the end time passed while the page was closed
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } },
    async (p) => { await p.click('#startBtn'); await run(p, 20000); }, B + 90000);
  let v = await view(page);
  eq(v.time, '00:00', '9: past its end, the refresh shows zero'); eq(v.plays, 0, '9: with nothing yet rung');
  await run(page, 200);
  v = await view(page);
  eq(v.flash, 1, '9: the first tick after a refresh past the end signals once (as it always has)');
  eq(v.run, null, '9: and the timer is done');
  await page.context().close();
}
{ // agenda, running, reloaded in the second segment
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'agenda', agenda: AGENDA },
    async (p) => { await p.click('#startBtn'); await run(p, 15000); }, B + 20000);
  const v = await view(page);
  eq(v.seg, 'Notes', '9: an agenda refresh keeps its segment'); eq(v.time, '00:10', '9: and what is left of it');
  eq(v.sub, 'Last segment', '9: and the next');
  await run(page, 10000);
  eq((await view(page)).sub, 'Agenda complete!', '9: and ends on time');
  await page.context().close();
}
{ // round robin, reloaded
  const { page } = await refresh({ ...PREFS_BASE, activeTab: 'roundrobin', roundrobin: { minutes: 0, seconds: 10, stations: 3, loop: false } },
    async (p) => { await p.click('#startBtn'); await run(p, 12000); }, B + 14000);
  const v = await view(page);
  eq(v.sub, 'Station 2 of 3', '9: a round robin refresh keeps its station'); eq(v.time, '00:06', '9: and what is left of it');
  await page.context().close();
}

/* ── 10. the strip window and an older tab read the same saved shape ───── */
{
  const page = await open({ ...PREFS_BASE, activeTab: 'countdown', countdown: { minutes: 1, seconds: 0 } });
  await page.click('#startBtn');
  await run(page, 10000);
  const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ct_running_v1')).phase).sort());
  ok(['endAt', 'status', 'totalMs', 'laps'].every(k => keys.includes(k)), '10: a running countdown still saves endAt, status, totalMs and laps: ' + keys.join(','));
  await page.click('#pauseBtn');
  const k2 = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ct_running_v1')).phase).sort());
  ok(k2.includes('remainingAtPause'), '10: a paused countdown still saves remainingAtPause');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
