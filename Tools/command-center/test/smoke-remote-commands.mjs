// smoke-remote-commands.mjs — the Command Center's phone-remote command
// dispatch (window.__ccApplyRemoteCommand, wired to a real WebRTC data
// channel by Tools/command-center/cc-remote.js and the "Remote control…"
// modal in the dashboard's own <script type="module">).
//
//   node Tools/command-center/test/smoke-remote-commands.mjs
//
// Real WebRTC between two headless pages is not what needs proving here —
// _shared/webrtc-pair.js already exists and Classroom Timer's Mirror feature
// already exercises the same pairing primitives in production. What's new
// and worth a regression test is the *dispatch*: that each of the five named
// commands a phone can send produces exactly the state change the matching
// on-screen control produces. So this calls window.__ccApplyRemoteCommand
// directly — the same function the data-channel's onMessage handler calls —
// and checks it against the on-screen path for each of the five actions:
// start/pause the timer, call the next student, sign a student back in,
// pull up the next period's roster, and run the start-of-day reset.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8189;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/010-command-center-dashboard.html';

const SETTINGS_KEY = 'gvb-command-center:settings';
const HALLPASS_KEY = 'hall-pass-log-sections';
const ROSTERS_KEY = 'np_rosters';
const EXCLUDE_PREFIX = 'gvb-command-center:excluded:';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('Command Center — remote command dispatch');

const todayKey = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const pickedKey = (roster) => `${EXCLUDE_PREFIX}picked:${todayKey()}:${roster}`;

const ROSTER_NAME = 'Homeroom';
const ROSTER = ['Ana Diaz', 'Beto Cruz', 'Cara Nunez'];

/** hall-pass-log-sections shaped exactly the way 001-hall-pass-log.html and
    this dashboard's own signInFromDashboard() both read and write it. */
const hallPassSeed = () => ({
  sets: {
    [ROSTER_NAME]: {
      outNow: [{ id: 's1', name: 'Ana Diaz', destId: 'd1', destLabel: 'Restroom', outMs: Date.now() - 5 * 60000, outStr: '9:00 AM' }],
      destinations: [{ id: 'd1', label: 'Restroom', overtimeMin: 10 }],
      log: [],
    },
  },
});

const seedSettings = async (extra) => {
  await page.evaluate(([key, rosterKey, roster, rosterName, extraSettings]) => {
    localStorage.setItem(rosterKey, JSON.stringify({ [rosterName]: roster }));
    localStorage.setItem(key, JSON.stringify(extraSettings || {}));
  }, [SETTINGS_KEY, ROSTERS_KEY, ROSTER, ROSTER_NAME, extra]);
};

const reload = async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
};

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── malformed / unknown messages never throw and never do anything ────── */
await seedSettings({ rosterName: ROSTER_NAME });
await reload();
for (const bad of [null, undefined, 42, 'hello', {}, { cmd: 123 }, { cmd: 'not-a-real-command' }]) {
  const res = await page.evaluate((msg) => window.__ccApplyRemoteCommand(msg), bad);
  ok(res && res.ok === false, `a malformed/unknown message (${JSON.stringify(bad)}) is rejected, not thrown`);
}
eq(page.__errs.length, 0, 'rejecting bad messages produced no console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

/* ── 1. timer_toggle: same start/pause the on-screen button drives ─────── */
await seedSettings({});
await reload();
eq(await page.textContent('#startPauseBtn'), 'Start', 'timer starts idle');

let res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'timer_toggle' }));
ok(res.ok, 'timer_toggle (start) reports ok');
eq(await page.textContent('#startPauseBtn'), 'Pause', 'a remote start flips the button to Pause, same as clicking it would');
let stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
ok(stored.timer && stored.timer.running === true, 'and persists running:true the same way onStart() always has');

res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'timer_toggle' }));
ok(res.ok, 'timer_toggle (pause) reports ok');
eq(await page.textContent('#startPauseBtn'), 'Start', 'a second remote toggle pauses it back, same as clicking Pause would');

/* Equivalence with the on-screen path: clicking the button from here behaves
   identically to a third remote toggle would have. */
await page.click('#startPauseBtn');
eq(await page.textContent('#startPauseBtn'), 'Pause', 'and the on-screen button still works after remote toggles touched the same state');

/* Panel switched off: the guard that matches the existing keyboard-shortcut
   guard (`mounted.timer` in the Space-bar handler) also applies to remote. */
await seedSettings({ panels: [{ id: 'timer', on: false }] });
await reload();
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'timer_toggle' }));
ok(res.ok === false, 'timer_toggle is refused (not silently ignored, not thrown) when the Timer panel is switched off');

/* ── 2. next_student: same pickStudent() the Pick button drives ────────── */
await page.evaluate(() => sessionStorage.clear()); // isolate this section's turn-order state from any other
await seedSettings({ rosterName: ROSTER_NAME });
await reload();
eq(await page.textContent('#pickedName'), '—', 'nobody picked yet');

await page.click('#pickBtn');
let onScreenPick = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) || '{}'), pickedKey(ROSTER_NAME));
eq(Object.keys(onScreenPick).length, 1, 'clicking Pick a student marks exactly one student picked this round');
ok(ROSTER.includes(await page.textContent('#pickedName')), 'and shows a real roster name');

await page.click('#resetPicksBtn'); // back to a clean round before trying the remote path
await reload();
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'next_student' }));
ok(res.ok, 'next_student reports ok');
let remotePick = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) || '{}'), pickedKey(ROSTER_NAME));
eq(Object.keys(remotePick).length, 1, 'a remote next_student marks exactly one student picked, same as the on-screen click did');
ok(ROSTER.includes(await page.textContent('#pickedName')), 'and updates #pickedName the same way pickStudent() always has');

await seedSettings({}); // no roster chosen at all
await reload();
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'next_student' }));
ok(res.ok === false, 'next_student is refused when no roster is loaded, rather than picking from an empty list');

/* ── 3. sign_in: same signInFromDashboard() the Sign in button drives ──── */
await page.evaluate(([hpKey, seed]) => localStorage.setItem(hpKey, JSON.stringify(seed)), [HALLPASS_KEY, hallPassSeed()]);
await seedSettings({ rosterName: ROSTER_NAME });
await reload();
ok((await page.textContent('[data-panel="hallpass"] .panel-body')).includes('Ana Diaz'), 'the seeded student shows up as out');

await page.click('[data-panel="hallpass"] [data-signin]');
await settle(page, 150);
let afterClick = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), HALLPASS_KEY);
eq(afterClick.sets[ROSTER_NAME].outNow.length, 0, 'clicking Sign in empties outNow');
eq(afterClick.sets[ROSTER_NAME].log.length, 1, 'and appends exactly one log row');
eq(afterClick.sets[ROSTER_NAME].log[0].name, 'Ana Diaz', 'with the right student on it');

/* Same starting state, this time signed in over the remote command instead
   of the on-screen button. */
await page.evaluate(([hpKey, seed]) => localStorage.setItem(hpKey, JSON.stringify(seed)), [HALLPASS_KEY, hallPassSeed()]);
await reload();
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'sign_in', section: 'Homeroom', id: 's1' }));
ok(res.ok, 'sign_in reports ok');
let afterRemote = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), HALLPASS_KEY);
eq(afterRemote.sets[ROSTER_NAME].outNow.length, 0, 'a remote sign_in empties outNow the same way the click did');
eq(afterRemote.sets[ROSTER_NAME].log.length, 1, 'and appends exactly one log row, same shape');
eq(afterRemote.sets[ROSTER_NAME].log[0].name, 'Ana Diaz', 'for the same student');
eq(afterRemote.sets[ROSTER_NAME].log[0].destLabel, afterClick.sets[ROSTER_NAME].log[0].destLabel, 'with the same mirrored fields signInFromDashboard() always writes');
ok(!(await page.textContent('[data-panel="hallpass"] .panel-body')).includes('Ana Diaz'), 'and the panel itself reflects it, the same as the on-screen path');

res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'sign_in', section: 'Homeroom', id: 'not-a-real-id' }));
ok(res.ok === false, 'sign_in for a student who is not out is refused rather than corrupting the log');
let unchanged = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), HALLPASS_KEY);
eq(unchanged.sets[ROSTER_NAME].log.length, 1, 'and the log is untouched by the refused attempt');

/* ── 4. advance_period: pulls up the *next* period's roster early ──────── */
/* Baseline: the ordinary, non-remote way a roster gets applied is the bell
   itself — a period that is *already current* when the page loads triggers
   onPeriodChange() and switches to its mapped roster automatically. */
const at = (offsetMin) => {
  const d = new Date(Date.now() + offsetMin * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};
await seedSettings({
  periods: [{ id: 'p1', label: 'Period 1', start: at(-10), end: at(30), roster: ROSTER_NAME }],
});
await reload();
let baseline = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
eq(baseline.rosterName, ROSTER_NAME, 'baseline: a period that is already current applies its mapped roster on its own, with no button pressed');

/* Remote path: the *next* period (not yet current) is mapped to the same
   roster. advance_period should produce the identical settings.rosterName —
   just early, instead of waiting for the actual bell to reach it. */
await seedSettings({
  periods: [
    { id: 'p1', label: 'Period 1', start: at(-60), end: at(-10), roster: '' },
    { id: 'p2', label: 'Period 2', start: at(-5), end: at(30), roster: '' },
    { id: 'p3', label: 'Period 3', start: at(35), end: at(80), roster: ROSTER_NAME },
  ],
});
await reload();
let before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
ok(before.rosterName !== ROSTER_NAME, 'sanity check: the next period’s roster is not already applied before advancing');

res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'advance_period' }));
ok(res.ok, 'advance_period reports ok when there is a next period');
let afterAdvance = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
eq(afterAdvance.rosterName, ROSTER_NAME, 'and settings.rosterName ends up exactly where the baseline bell-triggered switch left it');
eq(await page.inputValue('[data-panel="roster"] #rosterSelect'), ROSTER_NAME, 'with the Roster panel itself reflecting the switch');

await seedSettings({ periods: [] });
await reload();
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'advance_period' }));
ok(res.ok === false, 'advance_period is refused when no bell schedule is set up at all');

/* ── 5. start_day: same reset the Start the Day button drives ──────────── */
await page.evaluate(() => sessionStorage.clear()); // isolate from section 2's turn-order state
await seedSettings({ rosterName: ROSTER_NAME, dayStartedOn: '2000-01-01' });
await reload();
await page.click('[data-panel="roster"] #pickBtn'); // leaves a non-empty picked round to reset
await page.click('#panelConfigBtn'); // no-op, just exercising header chrome doesn't interfere
await page.click('#panelConfigBtn');
let beforeStart = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) || '{}'), pickedKey(ROSTER_NAME));
eq(Object.keys(beforeStart).length, 1, 'a round is in progress before Start the Day is pressed');

await page.click('[data-panel="startday"] #startDayBtn');
await settle(page, 150);
let afterStartClick = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) || '{}'), pickedKey(ROSTER_NAME));
eq(Object.keys(afterStartClick).length, 0, 'clicking Start the Day clears the picked round');
let settingsAfterClick = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
eq(settingsAfterClick.dayStartedOn, todayKey(), 'and stamps dayStartedOn with today');

/* Same setup, this time via the remote command. */
await seedSettings({ rosterName: ROSTER_NAME, dayStartedOn: '2000-01-01' });
await reload();
await page.click('[data-panel="roster"] #pickBtn');
res = await page.evaluate(() => window.__ccApplyRemoteCommand({ cmd: 'start_day' }));
ok(res.ok, 'start_day reports ok');
let afterStartRemote = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) || '{}'), pickedKey(ROSTER_NAME));
eq(Object.keys(afterStartRemote).length, 0, 'a remote start_day clears the picked round the same way the click did');
let settingsAfterRemote = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
eq(settingsAfterRemote.dayStartedOn, todayKey(), 'and stamps dayStartedOn the same way');

/* ── the snapshot the phone renders itself from is shaped sensibly ─────── */
await page.evaluate(([hpKey, seed]) => localStorage.setItem(hpKey, JSON.stringify(seed)), [HALLPASS_KEY, hallPassSeed()]);
await seedSettings({ rosterName: ROSTER_NAME, periods: [{ id: 'p1', label: 'Period 1', start: at(-10), end: at(30), roster: '' }] });
await reload();
const snap = await page.evaluate(() => window.__ccRemoteSnapshot());
ok(snap.timer && snap.timer.panelOn === true, 'the snapshot reports the timer panel is on');
ok(snap.roster && snap.roster.panelOn === true && snap.roster.count === ROSTER.length, 'and the roster panel with the right headcount');
ok(Array.isArray(snap.hallpass) && snap.hallpass.some((s) => s.name === 'Ana Diaz'), 'and lists who is currently out, for the phone’s sign-in buttons');
eq(snap.period.current, 'Period 1', 'and the current period label, for the phone’s "Pull up next period" button');

/* ── the Remote control modal exists and opens (pairing itself is untested
      here — see the file header for why) ─────────────────────────────── */
await page.click('#remoteBtn');
await settle(page, 150);
ok(await page.isVisible('#remoteOverlay'), 'the Remote control modal opens');
ok((await page.textContent('#remoteBody')).includes('Start pairing'), 'with the pairing entry point');
await page.click('#remoteCloseBtn');
await settle(page, 100);
ok(!(await page.isVisible('#remoteOverlay')), 'and closes');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
