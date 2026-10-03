// pairing-code.test.mjs — _shared/webrtc-pair.js's wire format. Plain Node.
//
//   node Tools/share/test/pairing-code.test.mjs
//
// The pairing codes are an SDP shown as a QR code, and the code's size on
// screen is the SDP's size in bytes. Since v223 encodeDescription() writes a
// compact, dictionary-coded form ('o' / 'a') and keeps the old full form
// ('O' / 'A') for whatever the dictionary cannot give back exactly. This pins
// the three things that has to be true of:
//
//   1. it is lossless: decode(encode(x)) is the SDP the browser wrote, byte
//      for byte, for Chrome's shape, for a Firefox-shaped one the dictionary
//      only half knows, and for lines it has never seen;
//   2. it survives the paste box: CRLF put back by a clipboard, the trailing
//      newline trimmed off, a stray blank line;
//   3. it is small: the real Chrome offer below is 569 bytes in the old form
//      and must stay at or under QR version 9 (53 modules, 244 px at the
//      4 px floor) in the new one. If that grows, the reply stops fitting a
//      phone, and smoke-pairing-qr.mjs is where that shows.
//
// webrtc-pair.js is a classic browser script, so it runs in a `vm` context,
// the way qr-draw.test.mjs loads qr-draw.js. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const win = { btoa, atob, TextEncoder, setTimeout, Promise, Object, String, Math, parseInt };
win.window = win;
const ctx = vm.createContext(win);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'qrcode', 'qrcode.js'), 'utf8') + '\n;this.qrcode = qrcode;', ctx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'qr-draw.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'webrtc-pair.js'), 'utf8'), ctx);
const { encodeDescription: enc, decodeDescription: dec } = win.WebRTCPair;
const QrDraw = win.QrDraw;

const crlf = (lines) => lines.join('\r\n') + '\r\n';

// Read off a real Chromium data-channel offer on huginn, 2026-10-03.
const CHROME = crlf([
  'v=0',
  'o=- 1911957347806344418 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:166863021 1 udp 2113937151 058e225c-70e2-4628-ba20-d1743a4b400e.local 38713 typ host generation 0 network-cost 999',
  'a=ice-ufrag:V/Zm',
  'a=ice-pwd:3nEcuYbVJV/GuAtw+iERJ7AX',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 FE:8C:B4:31:A2:34:09:32:B5:A5:0F:14:E7:8E:9F:91:39:C1:3F:8F:9B:D6:9F:9E:A9:33:45:98:43:3C:06:D9',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
]);
const CHROME_ANSWER = CHROME.replace('a=setup:actpass', 'a=setup:active');

// The SHAPE Firefox writes, typed from its documented output, NOT captured
// from a Firefox: a different o= line, a second candidate with raddr-less
// IPv6, a=sendrecv, its own max-message-size. What it proves is that lines
// the dictionary has no specific rule for still round-trip.
const FIREFOX_SHAPED = crlf([
  'v=0',
  'o=mozilla...THIS_IS_SDPARTA-99.0 4767135408421409846 0 IN IP4 0.0.0.0',
  's=-',
  't=0 0',
  'a=sendrecv',
  'a=fingerprint:sha-256 0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9:0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9',
  'a=group:BUNDLE 0',
  'a=ice-options:trickle',
  'a=msid-semantic:WMS *',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:0 1 UDP 2122252543 0c3bd1d4-8d70-4b5e-9a2e-8a1a6a0a2c11.local 51234 typ host',
  'a=candidate:1 1 TCP 2105524479 0c3bd1d4-8d70-4b5e-9a2e-8a1a6a0a2c11.local 9 typ host tcptype active',
  'a=sendrecv',
  'a=end-of-candidates',
  'a=ice-pwd:5f1c7c0b6a3d4e2f9a8b7c6d5e4f3a2b',
  'a=ice-ufrag:9c1d2e3f',
  'a=mid:0',
  'a=setup:actpass',
  'a=sctp-port:5000',
  'a=max-message-size:1073741823',
]);

const bytes = (t) => new TextEncoder().encode(t).length;
const modules = (t) => QrDraw.plan(t, { px: 1 }).modules;

console.log('Pairing code wire format');

/* ── 1. lossless ───────────────────────────────────────────────────────── */
const offer = enc({ type: 'offer', sdp: CHROME });
eq(offer.charAt(0), 'o', '1: a Chrome offer takes the compact form');
eq(dec(offer, 'offer'), { type: 'offer', sdp: CHROME }, '1: and decodes to the exact SDP');
const answer = enc({ type: 'answer', sdp: CHROME_ANSWER });
eq(answer.charAt(0), 'a', '1: a Chrome answer takes the compact form');
eq(dec(answer, 'answer'), { type: 'answer', sdp: CHROME_ANSWER }, '1: and decodes to the exact SDP');
const ff = enc({ type: 'offer', sdp: FIREFOX_SHAPED });
eq(dec(ff, 'offer'), { type: 'offer', sdp: FIREFOX_SHAPED }, '1: a Firefox-shaped offer round-trips');
ok(ff.length < FIREFOX_SHAPED.length, `1: and is still smaller (${ff.length} against ${FIREFOX_SHAPED.length})`);

const ODD = crlf(['v=0', 'x-never-seen: a line', 'a=fingerprint:sha-1 AA:BB', 'a=fingerprint:sha-256 aa:bb', '~starts with the escape',
  'o', 'k', 'a=candidate:1 1 udp 2 10.0.0.7 5000 typ host generation 0', 'a=candidate:1 2 udp 2 10.0.0.7 5000 typ srflx raddr 0.0.0.0 rport 0', 'a=mid:1']);
const odd = enc({ type: 'offer', sdp: ODD });
eq(dec(odd, 'offer'), { type: 'offer', sdp: ODD }, '1: lines no rule knows, and lines that look like codes, round-trip');

/* ── 2. the paste box ──────────────────────────────────────────────────── */
eq(dec(offer.replace(/\n/g, '\r\n'), 'offer').sdp, CHROME, '2: CRLF put back by a clipboard');
eq(dec(offer.trim(), 'offer').sdp, CHROME, '2: trimmed');
eq(dec(offer + '\n\n', 'offer').sdp, CHROME, '2: with blank lines after it');
eq(dec(ff.trim(), 'offer').sdp, FIREFOX_SHAPED, '2: a code ending in a value line, trimmed');
eq(dec(offer, 'answer'), null, '2: an offer is not an answer');
eq(dec(answer, 'offer'), null, '2: an answer is not an offer');
eq(dec('', 'offer'), null, '2: nothing is not a code');
eq(dec('o', 'offer'), null, '2: one letter is not a code');
eq(dec('oéé', 'offer'), null, '2: a code character the dictionary never issued is refused');
eq(dec('of!!not base64!!', 'offer'), null, '2: a mangled fingerprint is refused, not thrown');
eq(dec('https://example.com', 'offer'), null, '2: a link is not a code');

const fullOffer = 'O' + CHROME.replace(/\r\n/g, '\n');
eq(dec(fullOffer, 'offer'), { type: 'offer', sdp: CHROME }, '2: the old full form still decodes');
eq(dec(fullOffer.trim(), 'offer').sdp, CHROME, '2: and still has its last line ending put back');

/* ── 3. small ──────────────────────────────────────────────────────────── */
eq(bytes(fullOffer), 569, '3: the fixture is the 569-byte offer the backlog row measured');
eq(modules(fullOffer), 81, '3: which was 81 modules');
ok(bytes(offer) <= 200, `3: the compact offer is at most 200 bytes (${bytes(offer)})`);
ok(modules(offer) <= 53, `3: and at most 53 modules, QR version 9 (${modules(offer)})`);
ok(bytes(answer) <= 200 && modules(answer) <= 53, `3: the answer too (${bytes(answer)} bytes, ${modules(answer)} modules)`);
const fit375 = QrDraw.plan(offer, { maxPx: 311 });
ok(fit375.ok && fit375.px >= 4, `3: it fits the 311 px a 375 px phone has, at ${fit375.px} px per module`);
ok(!QrDraw.plan(fullOffer, { maxPx: 311 }).ok, '3: which the old form did not');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
