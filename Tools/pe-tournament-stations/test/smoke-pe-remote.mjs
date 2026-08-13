// smoke-pe-remote.mjs — the PE Tournament & Station Rotation tool's
// phone-to-laptop remote, paired over a real WebRTC data channel via
// _shared/webrtc-pair.js (the "Pair a phone (Wi-Fi)" / "Pair over Wi-Fi
// instead" flow), as distinct from the pre-existing same-device
// BroadcastChannel remote (?remote=1) that smoke-pe-stations.mjs's sibling
// coverage doesn't touch.
//
//   node Tools/pe-tournament-stations/test/smoke-pe-remote.mjs
//
// The gap this closes: BroadcastChannel only reaches other tabs/windows in
// the *same browser context* — it cannot bridge a phone to a laptop over
// Wi-Fi. This suite proves the new transport actually can, the same way
// Tools/class-roster-hub/test/smoke-export.mjs's Part 2 proves its
// device-to-device handoff: two independent Playwright browser *contexts*
// (the closest headless approximation of two separate devices — separate
// storage, no shared BroadcastChannel) drive the real UI buttons and
// negotiate a genuine RTCPeerConnection over 127.0.0.1.
// _shared/webrtc-pair.js is host-candidates-only by design, and loopback is
// a valid "same machine" ICE candidate, so this is not a mock: real SDP is
// exchanged (via copy/paste of the on-screen code, standing in for the QR
// scan a real phone would do — there's no getUserMedia in a headless run)
// and real bytes cross a real RTCDataChannel.
//
// What's verified:
//   1. Pairing: the display shows an offer code, the phone pastes it and
//      produces an answer code, the display connects with it — the exact
//      manual-relay fallback path a teacher without a working camera scan
//      uses (mirrors Classroom Timer's mirror pairing UX).
//   2. Command vocabulary: the phone's Start / Rotate now / Reset buttons
//      send the same {type:'cmd', cmd:'start'|'rotate'|'reset'} shape the
//      BroadcastChannel remote already used, applied on the display through
//      doStart/doRotateNow/doReset — asserted by reading the display's own
//      rotation state out of localStorage after each tap, not just trusting
//      the phone's own mirrored UI.
//   3. State push: the display's live countdown/status reaches the phone's
//      remote screen over the same channel (buildStateMessage() /
//      applyDisplayState()), so the phone isn't flying blind.
//   4. Both transports coexist: with a phone paired over WebRTC, a second,
//      same-device BroadcastChannel remote window still works independently
//      — pairing one didn't wire over or disable the other.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8156;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/021-pe-tournament-stations.html';
const KEY = 'pe-tournament-stations';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

async function waitForValue(p, selector, timeoutMs = 20000) {
  await p.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!(el && el.value && el.value.length > 10);
  }, selector, { timeout: timeoutMs });
  return p.$eval(selector, (el) => el.value);
}
async function waitForTextMatch(p, selector, regex, timeoutMs = 20000) {
  await p.waitForFunction(
    ({ sel, src, flags }) => {
      const el = document.querySelector(sel);
      return !!(el && new RegExp(src, flags).test(el.textContent || ''));
    },
    { sel: selector, src: regex.source, flags: regex.flags },
    { timeout: timeoutMs }
  );
  return p.$eval(selector, (el) => el.textContent);
}
const rotation = (p) => p.evaluate((k) => {
  const raw = localStorage.getItem(k);
  if (!raw) return null;
  const store = JSON.parse(raw);
  const proj = store.projects[store.current];
  return proj ? proj.rotation : null;
}, KEY);

console.log('PE Tournament & Station Rotation — Wi-Fi phone remote (WebRTC pairing)');

/* ── device A: the gym display ──────────────────────────────────────────── */
const display = await prepPage(browser, BASE, { width: 1280, height: 900 });
await display.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(display, 300);

/* ── device B: the teacher's phone — a fresh, independent browser context at
   ?remote=1, exactly what BroadcastChannel cannot reach ────────────────── */
const phone = await prepPage(browser, BASE, { width: 420, height: 780 });
await phone.goto(URL_PAGE + '?remote=1', { waitUntil: 'networkidle' });
await settle(phone, 300);

/* ── 1. pairing: display hosts, phone joins, manual code relay ─────────── */
await display.click('#pairPhoneBtn');
await display.click('#pairStartBtn');
const offerText = await waitForValue(display, '#pairOfferText');
ok(offerText.length > 10, 'the display produced a Wi-Fi pairing offer code');

// The camera-scan buttons aren't exercised here (no getUserMedia in a
// headless run — same call this repo's class-roster-hub WebRTC suite makes);
// this drives the paste-based fallback path instead, which is real code, not
// a mock, and is exactly what a teacher without camera permission falls back
// to on both ends.
await phone.click('#pairJoinBtn');
await phone.fill('#pairJoinPaste', offerText);
await phone.click('#pairJoinConnectBtn');
const answerText = await waitForValue(phone, '#pairAnswerText');
ok(answerText.length > 10, 'the phone produced a Wi-Fi pairing reply code');

await display.fill('#pairAnswerPaste', answerText);
await display.click('#pairConnectBtn');

const connectedMsg = await waitForTextMatch(display, '#msg', /paired and controlling/);
ok(/phone is now paired/.test(connectedMsg), 'the display confirms a phone paired over Wi-Fi: ' + JSON.stringify(connectedMsg));
await waitForTextMatch(phone, '#remoteConn', /Connected/);

/* ── 2. state reaches the phone over the data channel ───────────────────── */
const phoneTime1 = await phone.textContent('#remoteTime');
ok(phoneTime1 !== '--:--' && /^\d\d:\d\d$/.test(phoneTime1.trim()), 'the phone shows a real countdown pushed from the display: ' + JSON.stringify(phoneTime1));

/* ── 3. command vocabulary: Start, from the phone, over WebRTC ─────────── */
let r = await rotation(display);
eq(r.running, false, 'display not running yet');
await phone.click('#remoteStartBtn');
await display.waitForFunction((k) => {
  const raw = localStorage.getItem(k);
  if (!raw) return false;
  const store = JSON.parse(raw);
  const proj = store.projects[store.current];
  return proj && proj.rotation.running === true;
}, KEY, { timeout: 10000 });
r = await rotation(display);
ok(r.running === true, 'the phone\'s Start button actually started the rotation on the display, via doStart()');

/* ── 4. Rotate now, from the phone ──────────────────────────────────────── */
const countBefore = r.count;
await phone.click('#remoteRotateBtn');
await display.waitForFunction((args) => {
  const [k, before] = args;
  const raw = localStorage.getItem(k);
  if (!raw) return false;
  const store = JSON.parse(raw);
  const proj = store.projects[store.current];
  return proj && proj.rotation.count > before;
}, [KEY, countBefore], { timeout: 10000 });
r = await rotation(display);
eq(r.count, countBefore + 1, "the phone's Rotate now button advanced the rotation count via doRotateNow()");

/* ── 5. Reset, from the phone (confirm() stubbed to accept) ─────────────── */
await phone.evaluate(() => { window.confirm = () => true; });
await phone.click('#remoteResetBtn');
await display.waitForFunction((k) => {
  const raw = localStorage.getItem(k);
  if (!raw) return false;
  const store = JSON.parse(raw);
  const proj = store.projects[store.current];
  return proj && proj.rotation.running === false && proj.rotation.count === 0;
}, KEY, { timeout: 10000 });
r = await rotation(display);
eq(r.running, false, "the phone's Reset button stopped the rotation via doReset()");
eq(r.count, 0, "and zeroed the rotation count via doReset()");

/* ── 6. both transports coexist: a same-device BroadcastChannel remote
   window still works independently while the WebRTC phone stays paired.
   Deliberately a second PAGE IN THE SAME CONTEXT as `display` (not a new
   prepPage/context) so BroadcastChannel actually reaches it — the point of
   this check is that pairing a phone over WebRTC doesn't disable the
   pre-existing same-device path, not that BroadcastChannel crosses
   contexts (smoke-pe-stations.mjs's own history already established that
   it can't, and doesn't need re-proving here). ─────────────────────────── */
const displayContext = display.context();
const secondWindow = await displayContext.newPage();
// A raw context.newPage() doesn't inherit prepPage()'s per-page offsite-abort
// route — replicate just enough of it here so this extra page can't make a
// real network request in a sandboxed test environment; it's not part of the
// __errs/__blocked assertions below, only used for the coexistence check.
await secondWindow.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(BASE) || /^(file|data|blob|about|chrome):/.test(url)) return route.continue();
  return route.abort();
});
await secondWindow.goto(URL_PAGE + '?remote=1', { waitUntil: 'networkidle' });
await settle(secondWindow, 300);
await waitForTextMatch(secondWindow, '#remoteConn', /Connected/);
await secondWindow.click('#remoteStartBtn');
await display.waitForFunction((k) => {
  const raw = localStorage.getItem(k);
  if (!raw) return false;
  const store = JSON.parse(raw);
  const proj = store.projects[store.current];
  return proj && proj.rotation.running === true;
}, KEY, { timeout: 10000 });
r = await rotation(display);
ok(r.running === true, 'a same-device BroadcastChannel remote window still works after a phone paired over Wi-Fi (both transports coexist)');
await secondWindow.close();

/* ── 7. no console noise or off-site requests on either device ─────────── */
eq(display.__errs.length, 0, 'display: no page/console errors: ' + JSON.stringify(display.__errs.slice(0, 4)));
eq(phone.__errs.length, 0, 'phone: no page/console errors: ' + JSON.stringify(phone.__errs.slice(0, 4)));
eq(display.__blocked.length, 0, 'display: nothing tried to leave the site: ' + JSON.stringify(display.__blocked.slice(0, 4)));
eq(phone.__blocked.length, 0, 'phone: nothing tried to leave the site: ' + JSON.stringify(phone.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
