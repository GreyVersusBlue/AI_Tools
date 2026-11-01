// remote-channel.test.mjs — _shared/remote-channel.js against the three wrappers it replaced.
//
//   node Tools/remote-channel/test/remote-channel.test.mjs
//
// Path 22 P14. cc-remote.js (010), cs-remote.js (087) and ct-mirror.js (004) each
// carried their own copy of the data-channel plumbing; they are thin calls into
// _shared/remote-channel.js now. The frozen/ folder holds the three files as they
// stood at 2ca71d0. Each is run here beside its replacement on the same fake
// WebRTCPair and the same fake channel, fed the same events, and the traces must
// be equal: what the pairing was asked for (label, answer), which handlers ran
// with what, what went out on the wire, and when.
//
// What a phone sends is JSON text that this layer never reads, so the
// "old-format message" cases are the texts an older phone or board sends: a
// command object, a snapshot, text that is not JSON, JSON that is not an
// object. A text that is not JSON is dropped by both.
//
// No real phone and no real RTCPeerConnection are used here: a fake pairing and
// a fake channel. The browser suites (010's, 087's and 004's smoke-remote) pair
// two Chromium pages over loopback, which is the part this file cannot show.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '..', '..', '..');
const read = (...p) => fs.readFileSync(path.join(SITE, ...p), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── fakes ─────────────────────────────────────────────────────────────── */
function fakeChannel(state) {
  const ls = {};
  const ch = {
    readyState: state || 'connecting',
    sent: [],
    closed: 0,
    addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); },
    send(x) { ch.sent.push(x); },
    close() { ch.closed++; ch.readyState = 'closed'; },
    emit(t, ev) { (ls[t] || []).slice().forEach(fn => fn(ev || {})); }
  };
  return ch;
}

function newWorld() {
  const log = [];
  const w = { log, channels: [] };
  w.pair = {
    createOffer(label) {
      log.push(['createOffer', label]);
      const ch = fakeChannel('connecting'); w.channels.push(ch);
      return Promise.resolve({ pc: { id: 'pc-host', close() { log.push(['pc.close']); } }, channel: ch, offerPayload: 'o-1' });
    },
    createAnswer(offer, onChannel) {
      log.push(['createAnswer', offer]);
      const ch = fakeChannel(w.joinState || 'connecting'); w.channels.push(ch);
      onChannel(ch);
      return Promise.resolve({ pc: { id: 'pc-join', close() { log.push(['pc.close']); } }, answerPayload: 'a-1' });
    },
    applyAnswer(pc, answer) { log.push(['applyAnswer', pc.id, answer]); return Promise.resolve('applied'); }
  };
  return w;
}

/** Runs a script in a context with `window` and the world's pairing; returns the context. */
function ctxFor(world) {
  const ctx = { setTimeout, JSON, Promise, console };
  ctx.window = ctx; ctx.WebRTCPair = world.pair;
  vm.createContext(ctx);
  return ctx;
}
const esm = (src) => src.replace(/^export function /gm, 'function ').replace(/^export const /gm, 'const ');

/** The old and new ways of getting a host and a join, by tool. */
const TOOLS = {
  cc: { frozen: 'cc-remote.frozen', now: ['Tools', 'command-center', 'cc-remote.js'], module: true, host: 'startHost', join: 'startJoin' },
  ct: { frozen: 'ct-mirror.frozen', now: ['Tools', 'classroom-timer', 'ct-mirror.js'], module: true, host: 'startHost', join: 'startJoin' },
  cs: { frozen: 'cs-remote.frozen', now: ['Tools', 'class-screen', 'cs-remote.js'], module: false }
};

function load(tool, which, world) {
  const t = TOOLS[tool];
  const ctx = ctxFor(world);
  if (which === 'new') vm.runInContext(read('_shared', 'remote-channel.js'), ctx);
  let src = which === 'old' ? fs.readFileSync(path.join(here, 'frozen', t.frozen), 'utf8') : read(...t.now);
  if (t.module) {
    src = esm(src) + '\n;this.__host = startHost; this.__join = startJoin;';
    vm.runInContext(src, ctx);
    return { host: () => ctx.__host(), join: (o) => ctx.__join(o) };
  }
  vm.runInContext(src, ctx);
  return { host: () => ctx.ClassScreenRemote.host(), join: (o) => ctx.ClassScreenRemote.join(o) };
}

const TEXTS = [
  '{"type":"cmd","cmd":"start"}', '{"text":"04:59","sub":"","running":true,"paused":false,"mode":"countdown"}',
  '{"v":1,"cmd":"timer.toggle"}', 'not json', '', '{"a":', 'null', '123', '"x"', '[1,2]', 'true'
];

/** The trace of everything observable from driving one side of a pairing. */
async function drive(tool, which, side, { joinState } = {}) {
  const w = newWorld(); w.joinState = joinState;
  const mod = load(tool, which, w);
  const api = side === 'host' ? await mod.host() : await mod.join('offer-text');
  const ch = w.channels[0];
  const trace = [];
  api.onOpen(() => trace.push(['open']));
  api.onClose(() => trace.push(['close']));
  api.onMessage((m) => trace.push(['msg', m]));
  api.onMessage((m) => trace.push(['msg2', m]));
  await new Promise(r => setTimeout(r, 5));
  trace.push(['afterTick']);
  api.send({ early: 1 });                       // not open yet
  trace.push(['sentEarly', ch.sent.slice()]);
  ch.readyState = 'open'; ch.emit('open');
  api.send({ type: 'cmd', cmd: 'start' }); api.send({ text: '01:00' });
  TEXTS.forEach(t => ch.emit('message', { data: t }));
  trace.push(['sent', ch.sent.slice()]);
  ch.readyState = 'closed'; ch.emit('close');
  api.send({ late: 1 });
  trace.push(['sentLate', ch.sent.length]);
  trace.push(['fields', api.answerPayload || null, api.offerPayload || null, !!api.pc]);
  if (side === 'host') {
    const r = await (tool === 'cs' ? api.applyAnswer('their-answer') : api.applyAnswer('their-answer', api.pc));
    trace.push(['applyAnswer', r]);
  }
  trace.push(['pairing', w.log.slice()]);
  return trace;
}

console.log('RemoteChannel — against the three wrappers it replaced');

for (const tool of ['cc', 'ct', 'cs']) {
  for (const side of ['host', 'join']) {
    const a = await drive(tool, 'old', side);
    const b = await drive(tool, 'new', side);
    eq(b, a, `${tool} ${side}: the same events, wire text and pairing calls as the old wrapper`);
    ok(a.length > 8, `${tool} ${side}: the trace is not empty`);
  }
}

// The messages really arrive, in order, to both handlers, and JSON that is not an object is kept.
{
  const t = await drive('cc', 'new', 'host');
  const msgs = t.filter(x => x[0] === 'msg').map(x => x[1]);
  eq(msgs, [{ type: 'cmd', cmd: 'start' }, { text: '04:59', sub: '', running: true, paused: false, mode: 'countdown' },
            { v: 1, cmd: 'timer.toggle' }, null, 123, 'x', [1, 2], true], 'a command, a snapshot, a versioned command and bare JSON values are delivered; non-JSON text is dropped');
  eq(t.filter(x => x[0] === 'msg2').length, msgs.length, 'a second handler hears every message too');
  eq(t.find(x => x[0] === 'sentEarly')[1], [], 'nothing is sent before the channel is open');
  eq(t.find(x => x[0] === 'sent')[1], ['{"type":"cmd","cmd":"start"}', '{"text":"01:00"}'], 'what goes out is the JSON text of the object');
  eq(t.find(x => x[0] === 'sentLate')[1], 2, 'and nothing after the channel closes');
}

// The labels each tool pairs under.
for (const [tool, label] of [['cc', 'cc-remote'], ['ct', 'timer'], ['cs', 'class-screen']]) {
  const t = await drive(tool, 'new', 'host');
  eq(t.find(x => x[0] === 'pairing')[1][0], ['createOffer', label], `${tool}: the data channel is labelled ${label}`);
}

// Already-open joining channel: 087 calls its open handlers once; 010 and 004 do not (as before).
for (const [tool, calls] of [['cs', 1], ['cc', 0], ['ct', 0]]) {
  for (const which of ['old', 'new']) {
    const t = await drive(tool, which, 'join', { joinState: 'open' });
    const before = t.slice(0, t.findIndex(x => x[0] === 'afterTick'));
    eq(before.filter(x => x[0] === 'open').length, calls, `${tool} ${which}: an already-open channel calls the open handlers ${calls} time(s) before any event`);
  }
}

// New members, additive: isOpen, close, channel, pc; applyAnswer defaults pc.
{
  const w = newWorld();
  const ctx = ctxFor(w); vm.runInContext(read('_shared', 'remote-channel.js'), ctx);
  const api = await ctx.RemoteChannel.host('x');
  eq(api.isOpen(), false, 'isOpen is false until the channel opens');
  w.channels[0].readyState = 'open';
  eq(api.isOpen(), true, 'and true when it is');
  await api.applyAnswer('ans');
  eq(w.log.find(x => x[0] === 'applyAnswer'), ['applyAnswer', 'pc-host', 'ans'], 'applyAnswer(answer) uses the host\'s own pc');
  await api.applyAnswer('ans2', { id: 'pc-other' });
  eq(w.log.filter(x => x[0] === 'applyAnswer')[1], ['applyAnswer', 'pc-other', 'ans2'], 'applyAnswer(answer, pc) uses the pc it is given, as 010 and 004 pass theirs');
  api.close();
  eq([w.channels[0].closed, w.log.filter(x => x[0] === 'pc.close').length], [1, 1], 'close() closes the channel and the connection');
  api.close();
  ok(true, 'and closing twice does not throw');
}
// The wrappers no longer carry the plumbing.
for (const t of Object.values(TOOLS)) {
  const src = read(...t.now);
  ok(!/addEventListener\('message'|JSON\.parse|channel\.send/.test(src), `${t.now[2]} no longer carries the channel plumbing`);
  ok(/RemoteChannel/.test(src), `${t.now[2]} calls RemoteChannel`);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
