// qr-draw.test.mjs — _shared/qr-draw.js: the payload budget is measured, and
// the renderer draws what the decoder can read. Plain Node, no browser.
//
//   node Tools/share/test/qr-draw.test.mjs
//
// qr-draw.js is a classic browser script, so it runs in a `vm` context with
// the REAL vendored encoder (_shared/vendor/qrcode/qrcode.js) — the pair a
// page loads. The decoder is the REAL vendored jsQR, loaded the same way.
//
// Section 1 is the reason this suite exists: it renders codes of every
// version through qr-draw's own module loop, at N px per module, blurs them
// the way a camera does, and decodes them. That measurement is what
// MIN_PX_PER_MODULE stands on. The assertion is that the constant is at or
// above the smallest N that decodes through the blur — so raising the budget
// past what a decoder can read fails here, not on a teacher's phone.
//
// A number this suite found that the header does not claim: jsQR misses
// version 23 specifically, at every size and blur, on payloads every other
// version decodes. It is a decoder quirk (teachers scan with phones, not
// jsQR), recorded in section 1 as an expected miss so it cannot be mistaken
// for a renderer regression.
//
// Exits 1 on any failure.

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

const ENCODER = fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'qrcode', 'qrcode.js'), 'utf8');
const DECODER = fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'jsqr', 'jsqr.js'), 'utf8');
const QRDRAW = fs.readFileSync(path.join(SITE, '_shared', 'qr-draw.js'), 'utf8');

const jctx = vm.createContext({ self: {} });
vm.runInContext(DECODER, jctx, { filename: 'jsqr.js' });
const jsQR = jctx.self.jsQR;

function make({ noEncoder = false, dpr } = {}) {
  const win = { devicePixelRatio: dpr || 1, TextEncoder, Math, JSON, String, Object, Array, Error, Number, unescape, encodeURIComponent };
  win.window = win;
  const ctx = vm.createContext(win);
  if (!noEncoder) vm.runInContext(ENCODER + '\n;this.qrcode = qrcode;', ctx, { filename: 'qrcode.js' });
  vm.runInContext(QRDRAW, ctx, { filename: '_shared/qr-draw.js' });
  return win;
}

/** A canvas that records fillRects, so the suite can rasterise what draw() drew. */
function fakeCanvas() {
  const rects = [];
  const canvas = {
    width: 0, height: 0, style: {},
    getContext() {
      return { fillStyle: '#000', fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: this.fillStyle }); } };
    },
    rects,
  };
  return canvas;
}

/* Byte capacity per version at level L (ISO/IEC 18004 table 7), used to build
   a payload that lands on exactly version v. */
const CAP_L = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
  929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953];
const BASE = 'https://aspermylessonplan.com/Tools/064-historical-trading-card-maker.html?deck=';
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function payload(bytes) {
  let s = BASE;
  while (s.length < bytes) s += rnd().toString(36).slice(2);
  return s.slice(0, bytes);
}

/** Rasterise a module grid at `px` px per module, blur it `blur` times, hand it to jsQR. */
function decodes(mods, px, blur) {
  const n = mods.length, quiet = 4, total = n + quiet * 2, S = total * px;
  let g = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.floor(y / px) - quiet, c = Math.floor(x / px) - quiet;
    g[y * S + x] = (r >= 0 && c >= 0 && r < n && c < n && mods[r][c]) ? 0 : 255;
  }
  for (let b = 0; b < blur; b++) {
    const o = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= S || xx >= S) continue;
        s += g[yy * S + xx]; k++;
      }
      o[y * S + x] = s / k;
    }
    g = o;
  }
  const d = new Uint8ClampedArray(S * S * 4);
  for (let i = 0; i < S * S; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i]; d[i * 4 + 3] = 255; }
  return jsQR(d, S, S);
}

console.log('qr-draw.js — the measured budget, and a renderer the decoder can read');

/* ── 1. the measurement MIN_PX_PER_MODULE stands on ───────────────────── */
{
  const { QrDraw } = make();
  const JSQR_QUIRK_VERSION = 23;
  // Up to 24: the largest a 480 px sheet can show at the floor is 23, so the
  // floor is measured over what the sheet can actually draw. (Version 40 at
  // 4 px is marginal under the heaviest blur — 2 of 3 payloads decode — and
  // the budget never draws it at that size; that is the point of the budget.)
  const VERSIONS = [1, 4, 8, 12, 16, 20, 23, 24];
  const BLURS = [1, 2, 3];
  const results = {}; // px -> { v -> decoded-at-every-blur }
  for (const px of [2, 3, 4, 5]) {
    results[px] = {};
    for (const v of VERSIONS) {
      const mods = QrDraw.modulesOf(payload(CAP_L[v]));
      eq((mods.length - 17) / 4, v, `1: a ${CAP_L[v]}-byte payload lands on version ${v}`);
      results[px][v] = BLURS.every(blur => !!decodes(mods, px, blur));
    }
  }
  const allBut23 = VERSIONS.filter(v => v !== JSQR_QUIRK_VERSION);
  const cleanAt = px => allBut23.every(v => results[px][v]);
  ok(!cleanAt(2), '1: at 2 px per module the decoder reads nothing through blur — the budget cannot be lower than 3');
  ok(!cleanAt(3), '1: at 3 px per module some version still fails the heaviest blur — the budget cannot be 3 either');
  ok(cleanAt(4), '1: at 4 px per module every version decodes through every blur (' +
    allBut23.filter(v => !results[4][v]).join(',') + ' failed)');
  ok(cleanAt(5), '1: and 5 px per module does too');
  const smallestClean = [2, 3, 4, 5].find(cleanAt);
  ok(QrDraw.MIN_PX_PER_MODULE >= smallestClean,
    `1: MIN_PX_PER_MODULE (${QrDraw.MIN_PX_PER_MODULE}) is at or above the measured floor (${smallestClean})`);
  ok(QrDraw.MIN_PX_PER_MODULE <= smallestClean + 1,
    '1: and not so far above it that the budget is needlessly small');
  // the jsQR quirk, recorded so the next reader does not chase it as a renderer bug
  ok(!results[4][JSQR_QUIRK_VERSION] && !results[5][JSQR_QUIRK_VERSION],
    '1: (recorded quirk) jsQR misses version 23 even at 4-5 px per module; every other version decodes');
}

/* ── 2. plan(): what fits where, and what the teacher is told ─────────── */
{
  const { QrDraw } = make();
  const small = QrDraw.plan(BASE + 'abc', { maxPx: 320 });
  ok(small.ok, '2: a short link fits a 320 px sheet');
  ok(small.px >= 4 && small.cssSize <= 320 && small.cssSize === small.px * small.total,
    `2: at an integer px per module (${small.px}) that fills at most the space given (${small.cssSize})`);
  eq(small.bytes, BASE.length + 3, '2: bytes is the payload length');
  eq(small.reason, '', '2: no reason when it fits');

  const v13 = QrDraw.plan(payload(CAP_L[13]), { maxPx: 320 });
  ok(v13.ok && v13.px === 4, '2: version 13 (69 modules, 77 with the quiet zone) is the last that fits 320 px at 4 px per module');
  const v14 = QrDraw.plan(payload(CAP_L[14]), { maxPx: 320 });
  ok(!v14.ok, '2: version 14 (81 with the quiet zone) does not');
  const v15 = QrDraw.plan(payload(CAP_L[15]), { maxPx: 320 });
  ok(/77 modules across/.test(v15.reason) && /under 4 px per module/.test(v15.reason) && /340 px/.test(v15.reason),
    '2: and the reason says how big the code is, what it needs, and what to do instead: ' + JSON.stringify(v15.reason));
  ok(/[Cc]opy the link/.test(v15.reason) && /download/.test(v15.reason), '2: it names both alternatives');

  const v23 = QrDraw.plan(payload(CAP_L[23]), { maxPx: 480 });
  ok(v23.ok && v23.px === 4, '2: a 480 px sheet takes up to version 23');
  ok(!QrDraw.plan(payload(CAP_L[24]), { maxPx: 480 }).ok, '2: and not 24');

  const over = QrDraw.plan(payload(3200), { maxPx: 4000 });
  ok(!over.ok && over.version === null, '2: past version 40 the encoder cannot help at any size');
  ok(/more than any QR code can hold/.test(over.reason) && /3\.1 KB/.test(over.reason),
    '2: and the reason says so with the size: ' + JSON.stringify(over.reason));

  const fixed = QrDraw.plan(payload(CAP_L[30]), { px: 8 });
  ok(fixed.ok && fixed.px === 8 && fixed.cssSize === (137 + 8) * 8,
    '2: a fixed px (print, pairing codes) has no budget — version 30 at 8 px is fine');
  const minPx = QrDraw.plan(payload(CAP_L[20]), { maxPx: 320, minPx: 3 });
  ok(minPx.ok && minPx.px === 3, '2: minPx overrides the floor for a caller that has measured its own case');

  const utf8 = QrDraw.plan('héllo wörld ✓', { maxPx: 320 });
  eq(utf8.bytes, Buffer.byteLength('héllo wörld ✓', 'utf8'), '2: bytes counts UTF-8, not characters');
}

/* ── 3. draw(): integer device pixels, and a canvas the decoder reads ─── */
{
  const { QrDraw } = make();
  const canvas = fakeCanvas();
  const text = payload(CAP_L[10]);
  const p = QrDraw.draw(canvas, text, { maxPx: 320 });
  ok(p.ok, '3: draw() returns the plan');
  eq(canvas.width, p.size, '3: the canvas is sized in device px');
  eq(canvas.style.width, p.cssSize + 'px', '3: and styled in CSS px');
  eq(p.devicePx, p.px, '3: at dpr 1 device px per module equals CSS px');
  const bg = canvas.rects[0];
  eq([bg.x, bg.y, bg.w, bg.h], [0, 0, p.size, p.size], '3: the first fill is the white background over the whole canvas');
  const dark = canvas.rects.slice(1);
  ok(dark.every(r => r.w === p.devicePx && r.h === p.devicePx && r.x % p.devicePx === 0 && r.y % p.devicePx === 0),
    '3: every module is exactly devicePx square on the device-pixel grid — no fractional seams');
  ok(dark.every(r => r.x >= 4 * p.devicePx && r.y >= 4 * p.devicePx && r.x + r.w <= p.size - 4 * p.devicePx),
    '3: and inside the 4-module quiet zone');
  const mods = QrDraw.modulesOf(text);
  eq(dark.length, mods.flat().filter(Boolean).length, '3: one rect per dark module');

  // rasterise the recorded rects and decode: the renderer and the encoder agree
  const S = p.size;
  const g = new Uint8ClampedArray(S * S * 4).fill(255);
  for (const r of dark) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = (y * S + x) * 4; g[i] = g[i + 1] = g[i + 2] = 0;
  }
  const decoded = jsQR(g, S, S);
  eq(decoded && decoded.data, text, '3: jsQR reads the exact text back out of what draw() drew');

  const c2 = fakeCanvas();
  const p2 = make({ dpr: 2 }).QrDraw.draw(c2, text, { maxPx: 320 });
  eq(p2.devicePx, p2.px * 2, '3: at dpr 2 each module is twice as many device px');
  eq(c2.style.width, p2.cssSize + 'px', '3: while the CSS size is unchanged');
  eq(c2.width, p2.total * p2.px * 2, '3: and the canvas backing store doubles');

  const c3 = fakeCanvas();
  const p3 = QrDraw.draw(c3, payload(3200), { maxPx: 320 });
  ok(!p3.ok && c3.width === 0 && c3.rects.length === 0, '3: an over-budget draw leaves the canvas untouched and does not throw');

  const c4 = fakeCanvas();
  QrDraw.draw(c4, 'x', { px: 8, fg: '#123456', bg: '#fedcba' });
  eq(c4.rects[0].fill, '#fedcba', '3: bg is honoured');
  eq(c4.rects[1].fill, '#123456', '3: and fg');
}

/* ── 4. the missing-encoder mistake is loud ───────────────────────────── */
{
  const { QrDraw } = make({ noEncoder: true });
  let msg = '';
  try { QrDraw.plan('x', { maxPx: 320 }); } catch (e) { msg = e.message; }
  ok(/qrcode\.js loaded first/.test(msg), '4: a page that loads qr-draw.js without the encoder is told what it forgot');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
