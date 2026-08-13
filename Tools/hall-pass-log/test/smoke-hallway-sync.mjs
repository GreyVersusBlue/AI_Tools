// smoke-hallway-sync.mjs — Two-teacher hallway sync (Projector View combined
// out-count / overtime alert), paired over _shared/webrtc-pair.js.
//
//   node Tools/hall-pass-log/test/smoke-hallway-sync.mjs
//
// Two things are checked here:
//
//   1. computeLocalSnapshot()/combineSnapshots() as pure functions, via the
//      window.__hallPassSync test hook (same convention as
//      window.__ftpsResolveScan in field-trip-permission-slip) — the actual
//      combined-count/overtime math, independent of any network layer.
//
//   2. A REAL end-to-end pairing: the tool's own "join" UI is driven through
//      the DOM exactly as a teacher would use it (paste the offer, read the
//      answer back out of the textarea), while the "other board" is played
//      by a second RTCPeerConnection created directly via window.WebRTCPair
//      in the same page — a real WebRTC data channel connects the two, no
//      mock. That lets this test also prove the privacy/data-minimization
//      claim directly: it captures the exact bytes the tool sends over the
//      wire and asserts there is no student name, no per-student
//      destination, no outNow/log/history in them — only the same
//      {outCount, byDest, overTime} shape Projector View already showed
//      before this round.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8158;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/001-hall-pass-log.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Digital Hall Pass — Hallway Sync (two-teacher combined view)');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. pure functions: computeLocalSnapshot / combineSnapshots ─────────── */

ok(await page.evaluate(() => typeof window.__hallPassSync === 'object'), 'the test hook is exposed');
ok(await page.evaluate(() => typeof window.__hallPassSync.computeLocalSnapshot === 'function'), 'computeLocalSnapshot is exposed');
ok(await page.evaluate(() => typeof window.__hallPassSync.combineSnapshots === 'function'), 'combineSnapshots is exposed');

const localEmpty = await page.evaluate(() =>
  window.__hallPassSync.computeLocalSnapshot({ outNow: [], destinations: [] }, Date.now()));
eq(JSON.stringify(localEmpty), JSON.stringify({ outCount: 0, byDest: {}, overTime: false }), 'an empty board snapshots to all zero');

const NOW = 1000000000000; // fixed instant so the test is deterministic
const fakeState = {
  destinations: [
    { id: 'd1', label: 'Restroom', overtimeMin: 5 },
    { id: 'd2', label: 'Nurse', overtimeMin: 20 },
  ],
  outNow: [
    { name: 'REDACTED_A', destId: 'd1', destLabel: 'Restroom', outMs: NOW - 2 * 60000 },   // 2 min — under 5
    { name: 'REDACTED_B', destId: 'd1', destLabel: 'Restroom', outMs: NOW - 9 * 60000 },   // 9 min — over 5
    { name: 'REDACTED_C', destId: 'd2', destLabel: 'Nurse', outMs: NOW - 4 * 60000 },      // 4 min — under 20
    { name: 'REDACTED_D', destId: 'unknown-dest', destLabel: 'Office', outMs: NOW - 30 * 60000 }, // no matching dest -> falls back to OVER_TIME_MIN (9) -> over
  ],
};
const local = await page.evaluate(({ s, now }) => window.__hallPassSync.computeLocalSnapshot(s, now), { s: fakeState, now: NOW });
eq(local.outCount, 4, 'counts every student currently out');
eq(JSON.stringify(local.byDest), JSON.stringify({ Restroom: 2, Nurse: 1, Office: 1 }), 'tallies by destination label, not by student');
eq(local.overTime, true, 'flags overtime as soon as ANY trip is over its threshold');
ok(JSON.stringify(local).indexOf('REDACTED') === -1, 'no student name leaks into the local snapshot itself');

const onTimeOnly = await page.evaluate(({ s, now }) => window.__hallPassSync.computeLocalSnapshot(s, now), {
  s: { destinations: fakeState.destinations, outNow: [fakeState.outNow[0], fakeState.outNow[2]] },
  now: NOW,
});
eq(onTimeOnly.overTime, false, 'overTime is false when nothing is actually over its threshold');

/* combineSnapshots */
const soloCombine = await page.evaluate(({ l }) => window.__hallPassSync.combineSnapshots(l, null), { l: local });
eq(soloCombine.paired, false, 'combining with no peer reports unpaired');
eq(soloCombine.outCount, local.outCount, 'and leaves the count untouched');

const peerSnap = { outCount: 3, byDest: { Nurse: 2, Office: 1 }, overTime: false, ts: NOW };
const combined = await page.evaluate(({ l, p }) => window.__hallPassSync.combineSnapshots(l, p), { l: local, p: peerSnap });
eq(combined.paired, true, 'combining with a peer reports paired');
eq(combined.outCount, 7, 'combined out-count is the sum of both boards (4 + 3)');
eq(JSON.stringify(combined.byDest), JSON.stringify({ Restroom: 2, Nurse: 3, Office: 2 }), 'per-destination counts are summed across both boards, including a label only one side has');
eq(combined.overTime, true, 'overTime is true if EITHER board has something over time (OR, not AND)');

const bothOnTime = await page.evaluate(({ l, p }) =>
  window.__hallPassSync.combineSnapshots(l, p),
  { l: { outCount: 1, byDest: { A: 1 }, overTime: false }, p: { outCount: 1, byDest: { B: 1 }, overTime: false } });
eq(bothOnTime.overTime, false, 'and false only when neither board has anything over time');

/* ── 2. a real paired connection, driven through the actual "join" UI ───── */

/* Seed one student out at Restroom (2 min, under the 5-min default
   threshold) as this board's own live state before pairing. */
const seeded = await page.evaluate(() => {
  const KEY = Object.keys(localStorage).find(k => /hall-pass/i.test(k));
  const store = JSON.parse(localStorage.getItem(KEY));
  const current = store.sets[store.current];
  const restroom = current.destinations.find(d => /restroom/i.test(d.label)) || current.destinations[0];
  current.namesText = 'Ada Lovelace\nMarco Polo';
  current.outNow = [{
    id: 'seed1', name: 'Ada Lovelace', destId: restroom.id, destLabel: restroom.label,
    outMs: Date.now() - 2 * 60000, outStr: '9:00 AM', note: '',
  }];
  localStorage.setItem(KEY, JSON.stringify(store));
  return { key: KEY, restroomLabel: restroom.label };
});
ok(!!seeded.key, 'found the hall-pass store to seed');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

eq(await page.evaluate(() => document.getElementById('syncStatusLine').textContent.trim()), 'Not paired.', 'starts unpaired');
ok(await page.evaluate(() => getComputedStyle(document.getElementById('syncStopBtn')).display === 'none'), 'Unpair is hidden while unpaired');

/* Play "the other board" with a second, independent RTCPeerConnection
   created directly via the same shared WebRTCPair module — a real peer,
   just driven from code instead of a second device. */
const offerPayload = await page.evaluate(async () => {
  const peer = await window.WebRTCPair.createOffer('test-peer');
  window.__testPeer = peer;
  window.__testPeerReceived = [];
  peer.channel.addEventListener('message', (e) => window.__testPeerReceived.push(e.data));
  return peer.offerPayload;
});
ok(typeof offerPayload === 'string' && offerPayload.length > 10, 'the stand-in peer produced a real offer code');

/* Drive the tool's own join flow, exactly as a teacher would. */
await page.click('#syncBtn');
await page.click('#sJoin');
await page.fill('#sOfferPaste', offerPayload);
await page.click('#sJoinConnect');
await page.waitForSelector('#sAnswerText', { timeout: 10000 });
const answerPayload = await page.inputValue('#sAnswerText');
ok(typeof answerPayload === 'string' && answerPayload.length > 10, 'the tool produced a real reply code');

/* Close the dialog the same way a teacher would while waiting for the
   handshake to finish — the connection has to survive that. */
await page.click('#syncCloseBtn');

/* Complete the handshake from the stand-in peer's side, then have it push
   one synthetic "other board" snapshot once its own channel opens. */
const peerHeard = await page.evaluate(async (answerPayload) => {
  await window.WebRTCPair.applyAnswer(window.__testPeer.pc, answerPayload);
  return new Promise((resolve) => {
    const finish = () => resolve(window.__testPeerReceived.slice());
    window.__testPeer.channel.addEventListener('open', () => {
      window.__testPeer.channel.send(JSON.stringify({ outCount: 2, byDest: { Nurse: 1, Office: 1 }, overTime: true, ts: Date.now() }));
      setTimeout(finish, 3600); // > SYNC_PUSH_MS so at least one real push arrives
    }, { once: true });
    setTimeout(finish, 15000); // safety net if 'open' never fires
  });
}, answerPayload);

ok(peerHeard.length > 0, 'the stand-in peer received at least one push from the tool over the real data channel');
const firstPush = peerHeard.length ? JSON.parse(peerHeard[0]) : null;
ok(!!firstPush && firstPush.outCount === 1, 'the pushed snapshot has this board’s real out-count (one seeded student)');
ok(!!firstPush && JSON.stringify(firstPush.byDest) === JSON.stringify({ [seeded.restroomLabel]: 1 }), 'and the right per-destination tally');
ok(!!firstPush && firstPush.overTime === false, 'and overTime is false (the seeded trip is only 2 of 5 minutes in)');
const pushKeys = firstPush ? Object.keys(firstPush).sort() : [];
eq(pushKeys.join(','), 'byDest,outCount,overTime,ts', 'the pushed payload has ONLY the redacted shape — no name, no outNow, no log, no history');
ok(JSON.stringify(firstPush).indexOf('Ada Lovelace') === -1, 'the seeded student’s name never left the browser over the wire');

/* ── back on our board: it should now report paired ─────────────────────── */
await page.waitForFunction(
  () => document.getElementById('syncStatusLine').className.includes('paired'),
  null, { timeout: 10000 }
);
ok(true, 'the board flips to "paired" once the data channel opens');
ok(await page.evaluate(() => getComputedStyle(document.getElementById('syncStopBtn')).display !== 'none'), 'Unpair becomes available once paired');

/* Feed the tool one combined-relevant peer snapshot explicitly (the earlier
   one may have raced the tool's own listener attach) and confirm it lands. */
await page.evaluate(() => {
  window.__testPeer.channel.send(JSON.stringify({ outCount: 2, byDest: { Nurse: 1, Office: 1 }, overTime: true, ts: Date.now() }));
});
await settle(page, 400);

/* Reopening the modal mid-pairing should show the connected panel, not the
   role picker, and closing it (not unpairing) must leave the connection up. */
await page.click('#syncBtn');
ok((await page.textContent('#syncBody')).includes('Paired'), 'reopening the modal while paired shows the connected panel');
await page.click('#syncCloseBtn');
eq(await page.evaluate(() => document.getElementById('syncStatusLine').className.includes('paired')), true, 'still paired after just closing the modal (only Unpair tears it down)');

/* ── Projector View shows the COMBINED numbers, not just this board's ───── */
await page.click('#projectorBtn');
await page.waitForSelector('.projector-view.show');
await settle(page, 200);
eq(await page.textContent('#projOutCount'), '3', 'Projector View shows the combined out-count (1 local + 2 from the peer)');
const projDestsText = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#projDests .proj-dest-row')).map(r => r.textContent.trim()));
ok(projDestsText.some(t => t.includes(seeded.restroomLabel) && t.includes('1')), 'still shows this board’s own destination count');
ok(projDestsText.some(t => t.includes('Nurse') && t.includes('1')), 'and folds in the peer’s Nurse count');
ok(projDestsText.some(t => t.includes('Office') && t.includes('1')), 'and the peer’s Office count');
ok((await page.textContent('#projAlert')).length > 0, 'the overtime alert fires because the PEER reported overtime, even though the local trip is not over yet');
const syncNote = await page.textContent('#projSyncNote');
ok(/paired/i.test(syncNote) || /combined/i.test(syncNote), 'the projector explicitly says this is a combined/paired view: ' + JSON.stringify(syncNote));
const projectorHtml = await page.evaluate(() => document.getElementById('projectorView').innerHTML);
ok(!/Ada Lovelace/.test(projectorHtml), 'no student name is ever rendered inside Projector View itself');

/* ── disconnect: the peer goes away, the board falls back to solo numbers ── */
await page.evaluate(() => window.__testPeer.pc.close());
await page.waitForFunction(
  () => !document.getElementById('syncStatusLine').className.includes('paired'),
  null, { timeout: 10000 }
);
ok(true, 'the board notices the peer disconnecting and reports unpaired again');
await settle(page, 1200); // renderProjector runs on its own 1s interval while open
eq(await page.textContent('#projOutCount'), '1', 'Projector View falls back to just this board’s own out-count once unpaired');
eq(await page.textContent('#projSyncNote'), '', 'and the paired/combined note clears');

await page.keyboard.press('Escape');

/* ── no console noise, nothing left the site ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
