// smoke-pairing-qr.mjs — every WebRTC pairing code on the site is shown at a
// size a phone can read, or not shown at all.
//
//   node Tools/share/test/smoke-pairing-qr.mjs
//
// _shared/qr-draw.js measured the floor: 4 CSS px per module. Until v223 none
// of the pairing codes met it. Each tool drew its offer and reply with its own
// copy of a renderer, at a fixed 6 or 8 px per module in the canvas's pixel
// buffer, and a stylesheet then held the canvas to 180, 220 or 260 px. The
// payload was 569 bytes, 81 modules, 89 with the quiet zone: 2.0 to 2.9 px per
// module on screen. This suite opens every pairing step the way a teacher
// does, on a board (1280 px) and on a phone (375 px), and measures what is on
// screen: the canvas's laid-out width over the module count of the text
// beside it.
//
//   - a code that is shown is at 4 px per module or more, in whole px, inside
//     its parent;
//   - on the board it IS shown;
//   - on the phone it is shown or it is replaced by a note saying why, and a
//     one-candidate code (the fixture) always fits;
//   - the text is the compact wire format (_shared/webrtc-pair.js), and the
//     canvas decodes, with the vendored jsQR, to exactly that text.
//
// It ends with one real pairing over the compact format and QrDraw.fit()'s
// refusal. Run against the tree before v223 it fails on every page.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';

const PORT = 8463;
const BASE = `http://127.0.0.1:${PORT}`;
const T = BASE + '/Tools/';
const FLOOR = 4;
const JSQR = fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'jsqr', 'jsqr.js'), 'utf8');

// A real one-candidate Chrome offer in the compact format: 189 bytes, 49 modules.
const FIXTURE = 'ovo1911957347806344418 2\nstgxwmck166863021 2113937151 058e225c-70e2-4628-ba20-d1743a4b400e.local 38713 999\n' +
  'uV/Zm\np3nEcuYbVJV/GuAtw+iERJ7AX\nif/oy0MaI0CTK1pQ8U546fkTnBP4+b1p+eqTNFmEM8Btk\nqMPz';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

// Clicked through the DOM, not the pointer: on the phone some of these sit
// under a folded toolbar, and where the button is is not what this measures.
const click = async (page, sel) => {
  await page.waitForSelector(sel, { state: 'attached', timeout: 8000 });
  await page.evaluate((s) => document.querySelector(s).click(), sel);
};
const fill = async (page, sel, v) => {
  await page.waitForSelector(sel, { state: 'attached', timeout: 8000 });
  await page.evaluate(([s, t]) => { document.querySelector(s).value = t; }, [sel, v]);
};

const ROOM = (() => {
  const room = { id: 'pairqr0001', title: 'Pairing', stations: [{ clue: 'One?', answers: ['yes'], hint: '', next: null }] };
  return 'escape-room-builder/lock.html?r=' + encodeURIComponent(Buffer.from(JSON.stringify(room)).toString('base64')) + '&s=0';
})();

/* Each pairing: the page that shows the offer and how to reach it, and the
   page that shows the reply. `join.open` is handed the offer text. */
const PAIRINGS = [
  { tool: '001 hallway sync',
    host: { url: '001-hall-pass-log.html', open: async (p) => { await click(p, '#syncBtn'); await click(p, '#sHost'); }, canvas: '#sOfferCanvas' },
    join: { url: '001-hall-pass-log.html', open: async (p, o) => { await click(p, '#syncBtn'); await click(p, '#sJoin'); await fill(p, '#sOfferPaste', o); await click(p, '#sJoinConnect'); }, canvas: '#sAnswerCanvas', text: '#sAnswerText' } },
  { tool: '004 mirror',
    host: { url: '004-Classroom%20Timer.html', open: async (p) => { await click(p, '#mirrorBtn'); await click(p, '#mStart'); }, canvas: '#mOfferCanvas' },
    join: { url: 'classroom-timer/mirror.html', open: async (p, o) => { await fill(p, '#pastePayload', o); await click(p, '#connectBtn'); }, canvas: '#answerCanvas', text: '#answerText' } },
  { tool: '006 move everything',
    host: { url: '006-class-roster-hub.html', open: async (p) => { await click(p, '#handoffBtn'); await click(p, '#handoffStartSendBtn'); }, canvas: '#handoffOfferCanvas', text: '#handoffOfferText' },
    join: { url: '006-class-roster-hub.html', open: async (p, o) => { await click(p, '#handoffBtn'); await click(p, '#handoffStartReceiveBtn'); await fill(p, '#handoffOfferInput', o); await click(p, '#handoffCreateAnswerBtn'); }, canvas: '#handoffAnswerCanvas', text: '#handoffAnswerText' } },
  { tool: '009 device transfer',
    host: { url: '009-backup-restore.html', open: async (p) => {
      // 009 will not send from an empty browser; one invented roster is something to send.
      await p.evaluate(() => localStorage.setItem('np_rosters', JSON.stringify({ 'Period 4': ['Kit Alder', 'Lu Barros'] })));
      await p.reload({ waitUntil: 'networkidle' });
      await click(p, '#sendDeviceBtn'); await click(p, '#xStart'); }, canvas: '#xOfferCanvas' },
    join: { url: '009-backup-restore.html', open: async (p, o) => { await click(p, '#receiveDeviceBtn'); await fill(p, '#xOfferPaste', o); await click(p, '#xJoinConnect'); }, canvas: '#xAnswerCanvas', text: '#xAnswerText' } },
  { tool: '010 remote',
    host: { url: '010-command-center-dashboard.html', open: async (p) => { await click(p, '#remoteBtn'); await click(p, '#rStart'); }, canvas: '#rOfferCanvas' },
    join: { url: 'command-center/remote.html', open: async (p, o) => { await fill(p, '#pastePayload', o); await click(p, '#connectBtn'); }, canvas: '#answerCanvas', text: '#answerText' } },
  { tool: '021 phone remote',
    host: { url: '021-pe-tournament-stations.html', open: async (p) => { await click(p, '#pairPhoneBtn'); await click(p, '#pairStartBtn'); }, canvas: '#pairOfferCanvas', text: '#pairOfferText' },
    join: { url: '021-pe-tournament-stations.html?remote=1', open: async (p, o) => { await click(p, '#pairJoinBtn'); await fill(p, '#pairJoinPaste', o); await click(p, '#pairJoinConnectBtn'); }, canvas: '#pairAnswerCanvas', text: '#pairAnswerText' } },
  { tool: '035 hand off',
    host: { url: '035-schedule-visualizer.html', open: async (p) => { await click(p, '#btn-handoff-send'); }, canvas: '#handoff-offer-qr', text: '#handoff-offer-text' },
    join: { url: '035-schedule-visualizer.html', open: async (p, o) => { await click(p, '#btn-handoff-receive'); await fill(p, '#handoff-offer-input', o); await click(p, '#handoff-create-answer'); }, canvas: '#handoff-answer-qr', text: '#handoff-answer-text' } },
  { tool: '019 monitor',
    host: { url: 'escape-room-builder/monitor.html', open: async (p) => { await click(p, '#addDeviceBtn'); }, canvas: '#offerQr', text: '#offerText' },
    join: { url: ROOM, open: async (p, o) => { await click(p, '#monitorToggle'); await fill(p, '#monitorOfferInput', o); await click(p, '#monitorConnectBtn'); }, canvas: '#monitorAnswerQr', text: '#monitorAnswerText' } },
];

/** What is laid out for a canvas (offsetWidth, so a dialog's opening
    animation does not scale the reading), and the code it carries: the page's own
    text box where it has one, and otherwise (001, 004, 009 and 010 offer a
    Copy button and no box) what the vendored jsQR reads off the canvas. */
const measure = (page, at) => page.evaluate(([s, ts, jsqr]) => {
  const c = document.querySelector(s);
  if (!c) return null;
  const r = c.getBoundingClientRect();
  const pr = c.parentNode.getBoundingClientRect();
  const shown = getComputedStyle(c).display !== 'none' && r.width > 0;
  const self = {}; new Function('self', jsqr)(self);
  let decoded = null;
  if (c.width && c.height) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const hit = self.jsQR(d.data, d.width, d.height);
    decoded = hit ? hit.data : null;
  }
  const box = ts ? document.querySelector(ts) : null;
  const text = box ? box.value : (decoded || '');
  const next = c.nextElementSibling;
  const note = next && next.hasAttribute('data-qr-fit-note') ? next.textContent : '';
  let total = 0;
  if (text) { const q = window.qrcode(0, 'L'); q.addData(text); q.make(); total = q.getModuleCount() + 8; }
  return { text, total, bytes: new TextEncoder().encode(text).length, shown, width: c.offsetWidth, height: c.offsetHeight, hasBox: !!box,
    inside: r.left >= pr.left - 0.5 && r.right <= pr.right + 0.5, vw: document.documentElement.clientWidth, right: r.right, note, decoded };
}, [at.canvas, at.text || null, JSQR]);

/* A code is there once the canvas is no longer its blank default size, or
   fit() has hidden it. */
async function ready(page, at) {
  await page.waitForSelector(at.canvas, { state: 'attached', timeout: 8000 });
  await page.waitForFunction((s) => {
    const c = document.querySelector(s);
    return !!c && (c.style.display === 'none' || (c.width !== 300 && c.width !== 320));
  }, at.canvas, { timeout: 8000 });
  await settle(page, 150);
}

function check(m, label, { mustShow }) {
  if (!ok(!!m && !!m.text, `${label}: the pairing step drew a code`)) return;
  ok(/^[oa]/.test(m.text), `${label}: the text is the compact format (${m.bytes} bytes, ${m.total - 8} modules)`);
  if (m.shown) {
    const px = m.width / m.total;
    console.log(`  ${label}: ${m.bytes} bytes, ${m.total - 8} modules, ${m.width} px wide, ${px.toFixed(2)} px per module`);
    ok(px >= FLOOR, `${label}: ${px.toFixed(2)} px per module on screen is at or above ${FLOOR} (${m.width} px wide, ${m.total} across)`);
    ok(Math.abs(px - Math.round(px)) < 0.01, `${label}: whole px per module (${px.toFixed(3)})`);
    ok(Math.abs(m.width - m.height) < 0.5, `${label}: square (${m.width} x ${m.height})`);
    ok(m.inside && m.right <= m.vw + 0.5, `${label}: inside its parent and the window`);
    ok(m.decoded === m.text, `${label}: the canvas decodes to the text beside it`);
    ok(!m.note, `${label}: no refusal note beside a code that is shown`);
  } else {
    console.log(`  ${label}: ${m.bytes} bytes, ${m.total - 8} modules, not shown: ${m.note}`);
    ok(!mustShow, `${label}: shown (it is hidden: "${m.note}")`);
    ok(/too narrow|too long/.test(m.note), `${label}: hidden with the reason on the page`);
  }
}

const server = await serve(PORT);
const browser = await launch();
console.log('Pairing codes — size on screen');

const errors = [];
for (const [screen, vp] of [['board', { width: 1280, height: 800 }], ['phone', { width: 375, height: 667 }]]) {
  for (const pr of PAIRINGS) {
    const host = await prepPage(browser, BASE, vp);
    host.on('pageerror', (e) => errors.push(`${pr.tool} host: ${e.message}`));
    host.on('dialog', (d) => d.accept());
    await host.goto(T + pr.host.url, { waitUntil: 'networkidle' });
    await pr.host.open(host);
    await ready(host, pr.host).catch(() => {});
    const offer = await measure(host, pr.host);
    check(offer, `${pr.tool}, ${screen}, offer`, { mustShow: screen === 'board' });

    const join = await prepPage(browser, BASE, vp);
    join.on('pageerror', (e) => errors.push(`${pr.tool} join: ${e.message}`));
    join.on('dialog', (d) => d.accept());
    await join.goto(T + pr.join.url, { waitUntil: 'networkidle' });
    await pr.join.open(join, (offer && offer.text) || '');
    await ready(join, pr.join).catch(() => {});
    const answer = await measure(join, pr.join);
    check(answer, `${pr.tool}, ${screen}, reply`, { mustShow: screen === 'board' });

    // The one-candidate code always fits, whatever this machine's network gave the real one.
    for (const [side, page, sel] of [['offer', host, pr.host.canvas], ['reply', join, pr.join.canvas]]) {
      const fx = await page.evaluate(([s, t]) => {
        const c = document.querySelector(s);
        if (!c || !window.QrDraw || !window.QrDraw.fit) return null;
        const p = window.QrDraw.fit(c, t);
        return { ok: p.ok, px: p.px, width: c.offsetWidth, total: p.total };
      }, [sel, FIXTURE]);
      ok(fx && fx.ok && fx.width / fx.total >= FLOOR,
        `${pr.tool}, ${screen}, ${side}: a one-candidate code fits its box (${fx ? (fx.width / fx.total).toFixed(2) + ' px per module' : 'no QrDraw.fit on the page'})`);
    }
    await host.context().close();
    await join.context().close();
  }
}

/* ── one real pairing over the compact format ─────────────────────────── */
{
  const a = await prepPage(browser, BASE, { width: 1280, height: 800 });
  await a.goto(T + '006-class-roster-hub.html', { waitUntil: 'networkidle' });
  const r = await a.evaluate(async () => {
    const h = await WebRTCPair.createOffer('t');
    let got = null;
    const j = await WebRTCPair.createAnswer(h.offerPayload, (ch) => { ch.onmessage = (e) => { got = e.data; }; });
    await WebRTCPair.applyAnswer(h.pc, j.answerPayload);
    await new Promise((res) => { h.channel.onopen = res; setTimeout(res, 6000); });
    if (h.channel.readyState === 'open') h.channel.send('hello');
    await new Promise((res) => setTimeout(res, 300));
    const full = 'O' + h.pc.localDescription.sdp.replace(/\r\n/g, '\n');
    const out = { state: h.channel.readyState, got, offer: h.offerPayload.length, full: full.length,
      same: WebRTCPair.decodeDescription(h.offerPayload, 'offer').sdp === h.pc.localDescription.sdp,
      legacy: WebRTCPair.decodeDescription(full, 'offer').sdp === h.pc.localDescription.sdp };
    h.pc.close(); j.pc.close();
    return out;
  });
  ok(r.state === 'open' && r.got === 'hello', 'a compact offer and reply open a channel that carries a message');
  ok(r.same, 'the compact offer decodes to the exact SDP the browser wrote');
  ok(r.legacy, 'and a code in the old full format still decodes');
  ok(r.offer * 2 < r.full, `the compact offer is under half the old one (${r.offer} against ${r.full} characters)`);

  /* ── QrDraw.fit refuses out loud, and recovers ──────────────────────── */
  const f = await a.evaluate(([t]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:150px;padding:0 10px;box-sizing:content-box';
    const c = document.createElement('canvas');
    c.style.display = 'block';
    wrap.appendChild(c);
    document.body.appendChild(wrap);
    const no = QrDraw.fit(c, t);
    const noteNo = c.nextElementSibling;
    const one = { ok: no.ok, display: c.style.display, note: noteNo && noteNo.textContent, role: noteNo && noteNo.getAttribute('role') };
    QrDraw.fit(c, t);
    const notes = wrap.querySelectorAll('[data-qr-fit-note]').length;
    wrap.style.width = '300px';
    const yes = QrDraw.fit(c, t);
    const two = { ok: yes.ok, display: c.style.display, notes: wrap.querySelectorAll('[data-qr-fit-note]').length, px: yes.px, width: c.getBoundingClientRect().width, total: yes.total };
    const short = QrDraw.fit(c, 'hi');
    const capped = QrDraw.fit(c, t, { room: 2000 });
    wrap.remove();
    return { one, notes, two, shortPx: short.px, cappedCss: capped.cssSize };
  }, [FIXTURE]);
  ok(f.one.ok === false && f.one.display === 'none', 'fit(): 150 px of room hides the canvas');
  ok(/needs 228 px across and has 150/.test(f.one.note || '') && f.one.role === 'status', `fit(): and says what it needs ("${f.one.note}")`);
  ok(f.notes === 1, 'fit(): a second refusal reuses the note');
  ok(f.two.ok && f.two.display === 'block' && f.two.notes === 0, 'fit(): with room the canvas is back as it was and the note is gone');
  ok(f.two.px === 5 && f.two.width === 285, `fit(): 300 px of room draws 57 across at 5 px (${f.two.px} px, ${f.two.width} wide)`);
  ok(f.shortPx === 8, `fit(): a short code stops at 8 px per module (${f.shortPx})`);
  ok(f.cappedCss <= 480, `fit(): and no code is wider than 480 px (${f.cappedCss})`);
  await a.context().close();
}

ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
