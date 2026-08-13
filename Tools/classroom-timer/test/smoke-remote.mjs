// smoke-remote.mjs — the Classroom Timer's phone-as-remote over the existing
// "Mirror to a device" pairing.
//
//   node Tools/classroom-timer/test/smoke-remote.mjs
//
// Before this feature, the WebRTC data channel the mirror already opens
// (004-Classroom Timer.html as HOST, classroom-timer/mirror.html as JOIN —
// see ct-mirror.js) only ever carried getDisplaySnapshot() one way, host to
// join. This suite pairs the two pages for real — same offer/answer/ICE
// flow a teacher and a phone would go through, minus the camera (the QR
// offer is read back off its own canvas with the vendored jsQR decoder, the
// same library a real phone camera would use; the answer is read straight
// out of its visible textarea, since mirror.html shows the reply as both a
// QR and readable text) — then drives the paired page's own on-screen
// remote buttons (#remoteStart/#remotePause/#remoteResume/#remoteNext) and
// checks the *other* page's own on-screen timer state changes to match,
// exactly as if a teacher had clicked Start/Pause/Resume, or waited for an
// Agenda segment to finish.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8165;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_MAIN = BASE + '/Tools/004-Classroom%20Timer.html';
const URL_MIRROR = BASE + '/Tools/classroom-timer/mirror.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Classroom Timer — phone-as-remote (mirror pairing, bidirectional)');

const teacher = await prepPage(browser, BASE, { width: 1000, height: 900 });
const phone = await prepPage(browser, BASE, { width: 420, height: 800 });
await teacher.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });

await teacher.goto(URL_MAIN, { waitUntil: 'networkidle' });
await phone.goto(URL_MIRROR, { waitUntil: 'networkidle' });
await settle(teacher, 300);
await settle(phone, 300);

/* ── 1. pair the two pages for real, through the actual UI ─────────────── */
await teacher.click('#mirrorBtn');
await teacher.click('#mStart');
await teacher.waitForSelector('#mOfferCanvas', { timeout: 5000 });
await settle(teacher, 1800); // ICE gathering (ICE_GATHER_TIMEOUT_MS in webrtc-pair.js)

// Read the offer the same way a phone camera would — decode the QR canvas
// with the same jsQR build the page itself loads for camera scanning.
const offerPayload = await teacher.evaluate(() => {
  const canvas = document.getElementById('mOfferCanvas');
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = window.jsQR(img.data, canvas.width, canvas.height);
  return result ? result.data : null;
});
ok(typeof offerPayload === 'string' && offerPayload.length > 0, 'the offer QR decodes back to a pairing code');

await phone.fill('#pastePayload', offerPayload || '');
await phone.click('#connectBtn');
await phone.waitForSelector('#answerText', { timeout: 5000 });
await settle(phone, 1800); // ICE gathering on the join side too

const answerPayload = await phone.inputValue('#answerText');
ok(typeof answerPayload === 'string' && answerPayload.length > 0, 'the join side produced a reply code');

await teacher.fill('#mAnswerPaste', answerPayload);
await teacher.click('#mConnect');

await teacher.waitForSelector('#mStop', { timeout: 8000 });
await phone.waitForSelector('.mirror-stage.show', { timeout: 8000 });
ok(true, 'both sides report connected');

// Close the pairing modal — it stays open (by design; "Stop mirroring" lives
// there) after connecting, but would otherwise sit on top of the on-screen
// timer controls the rest of this suite drives.
await teacher.click('#mirrorCloseBtn');
await settle(teacher, 200);

/* ── 2. Countdown: remote Start reaches the same state Start would ─────── */
await teacher.fill('#cdMinutes', '5');
await teacher.fill('#cdSeconds', '0');
await teacher.evaluate(() => document.getElementById('cdSeconds').dispatchEvent(new Event('change')));
await settle(teacher, 200);

await settle(teacher, 400); // let a snapshot reach the phone so its buttons reflect idle
eq(await phone.isHidden('#remoteStart'), false, 'phone shows Start while idle');
eq(await phone.isHidden('#remotePause'), true, 'and not Pause');

await phone.click('#remoteStart');
await settle(teacher, 300);
eq(await teacher.isHidden('#startBtn'), true, 'remote Start hid the on-screen Start button');
eq(await teacher.isHidden('#pauseBtn'), false, 'and showed Pause — same as clicking Start would');
const runningAfterRemoteStart = await teacher.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
ok(runningAfterRemoteStart && runningAfterRemoteStart.phase.status === 'running', 'ct_running_v1 shows a running countdown');
eq(runningAfterRemoteStart.mode, 'countdown', 'in countdown mode');

await settle(teacher, 400); // next push tick carries running:true to the phone
eq(await phone.isHidden('#remoteStart'), true, 'phone hides Start once running');
eq(await phone.isHidden('#remotePause'), false, 'and shows Pause');

/* ── 3. remote Pause / Resume match the on-screen buttons ───────────────── */
await phone.click('#remotePause');
await settle(teacher, 300);
eq(await teacher.isHidden('#pauseBtn'), true, 'remote Pause hid the on-screen Pause button');
eq(await teacher.isHidden('#resumeBtn'), false, 'and showed Resume');
const runningAfterRemotePause = await teacher.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
eq(runningAfterRemotePause.phase.status, 'paused', 'ct_running_v1 shows paused');

await settle(teacher, 400);
eq(await phone.isHidden('#remoteResume'), false, 'phone now offers Resume');

await phone.click('#remoteResume');
await settle(teacher, 300);
eq(await teacher.isHidden('#resumeBtn'), true, 'remote Resume hid the on-screen Resume button');
eq(await teacher.isHidden('#pauseBtn'), false, 'and showed Pause again — running once more');
const runningAfterRemoteResume = await teacher.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
eq(runningAfterRemoteResume.phase.status, 'running', 'ct_running_v1 shows running again');

/* ── 4. a stray Next-segment command outside Agenda mode is a no-op ─────── */
// The phone hides #remoteNext outside Agenda mode (nothing to advance), but
// a stale command could still arrive in flight — dispatch the click via
// .click() straight through that hidden state (Playwright's own click
// can't target a display:none element even with force:true) to prove the
// *handler* guards it too, not just the button visibility.
await phone.evaluate(() => document.getElementById('remoteNext').click());
await settle(teacher, 300);
eq(await teacher.isHidden('#pauseBtn'), false, 'countdown keeps running — an out-of-mode "next" did nothing');

await teacher.click('#resetBtn');
await settle(teacher, 300);

/* ── 5. Agenda: remote Next-segment advances, same as onPhaseZero would ── */
await teacher.click('.mode-tab[data-mode="agenda"]');
await settle(teacher, 300);
const segNames = await teacher.$$eval('.agenda-seg-row input[type="text"]', els => els.map(e => e.value));
ok(segNames.length >= 2, `the sample agenda has at least two segments (got ${segNames.length})`);

await teacher.click('#startBtn');
await settle(teacher, 400);
eq(await teacher.textContent('#agendaCurrent'), segNames[0], 'agenda starts on its first segment');

await settle(teacher, 500); // let a push reach the phone with mode:'agenda', running:true
eq(await phone.isHidden('#remoteNext'), false, 'phone offers Next segment once an agenda is running');

await phone.click('#remoteNext');
await settle(teacher, 300);
eq(await teacher.textContent('#agendaCurrent'), segNames[1], 'remote Next-segment advanced to the second segment');
const runningAfterNext = await teacher.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
eq(runningAfterNext.phase.segIndex, 1, 'ct_running_v1 agrees the segment index advanced');
eq(runningAfterNext.phase.status, 'running', 'and the agenda is still running (not paused/stopped by the skip)');

/* Next-segment also works while paused — a teacher stepping away mid-segment
   shouldn't have to resume first just to skip ahead. */
await teacher.click('#pauseBtn');
await settle(teacher, 300);
await phone.click('#remoteNext');
await settle(teacher, 300);
eq(await teacher.textContent('#agendaCurrent'), segNames[2] || segNames[segNames.length - 1],
   'remote Next-segment advances even while paused');
const runningAfterPausedNext = await teacher.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
eq(runningAfterPausedNext.phase.status, 'paused', 'and stays paused — the skip alone did not resume it');

/* Advancing past the last segment is a no-op, not an out-of-bounds error. */
for (let i = 0; i < segNames.length + 2; i++) {
  await phone.click('#remoteNext');
  await settle(teacher, 150);
}
const finalSeg = await teacher.textContent('#agendaCurrent');
eq(finalSeg, segNames[segNames.length - 1], 'repeated Next-segment stops at the last segment, does not wrap or error');

await teacher.click('#resumeBtn');
await settle(teacher, 200);
await teacher.click('#resetBtn');
await settle(teacher, 200);

/* ── 6. commands are no-ops in the wrong state (idle) ────────────────────── */
await teacher.click('.mode-tab[data-mode="countdown"]');
await settle(teacher, 200);
await phone.evaluate(() => document.getElementById('remotePause').click()); // stale/hidden-state tap
await settle(teacher, 300);
eq(await teacher.isHidden('#startBtn'), false, 'a stray Pause while idle left Start showing (no-op)');
const idleRunning = await teacher.evaluate(() => localStorage.getItem('ct_running_v1'));
eq(idleRunning, null, 'and nothing got persisted as running');

/* ── 7. no console noise, nothing left the site ──────────────────────────── */
eq(teacher.__errs.length, 0, 'no errors on the teacher page: ' + JSON.stringify(teacher.__errs.slice(0, 3)));
eq(phone.__errs.length, 0, 'no errors on the phone page: ' + JSON.stringify(phone.__errs.slice(0, 3)));
eq(teacher.__blocked.length, 0, 'nothing left the site from the teacher page: ' + JSON.stringify(teacher.__blocked.slice(0, 3)));
eq(phone.__blocked.length, 0, 'nothing left the site from the phone page: ' + JSON.stringify(phone.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
