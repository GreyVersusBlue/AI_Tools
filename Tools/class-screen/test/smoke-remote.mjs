// smoke-remote.mjs — 087 Class Screen's phone remote (Path 22 P4).
//
//   node Tools/class-screen/test/smoke-remote.mjs
//
// Two halves. First the dispatch: every command the phone can send, applied
// through the same function the data channel calls, must make the change the
// board's own button makes, and a command outside the vocabulary must change
// nothing. Then a real pairing, the way Classroom Timer's remote suite does it:
// the board (087) as host and the phone page (class-screen/remote.html) as
// join, in two browser contexts, with the offer read back off the board's QR
// canvas by the vendored jsQR (the decoder a phone's camera page uses) and the
// reply pasted from the phone's text box. Then the phone's own buttons drive
// the board, and the board's changes reach the phone. Every name is invented.
// Exits 1 on any failure.

/* global __classScreen, __csRemote -- the two pages' read-only test hooks */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..', '..');
const PORT = 8445;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_BOARD = BASE + '/Tools/087-class-screen.html';
const URL_PHONE = BASE + '/Tools/class-screen/remote.html';
const ROSTER = { 'Period 4': ['Kit Alder', 'Lu Barros', 'Mo Castell', 'Nia Dunmore'] };

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const board = await prepPage(browser, BASE, { width: 1400, height: 900 });
board.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (board.__promptAnswer ?? d.defaultValue()) : undefined));

console.log('Class Screen — phone remote');

await board.goto(URL_BOARD);
await board.evaluate(([r]) => { localStorage.clear(); localStorage.setItem('np_rosters', JSON.stringify(r)); }, [ROSTER]);
await board.reload();
await settle(board);

const st = () => board.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const data = async (type) => (await cur()).widgets.find((w) => w.type === type).data;
const apply = (msg) => board.evaluate((m) => __classScreen.remote.apply(m), msg);
const snap = () => board.evaluate(() => __classScreen.remote.snapshot());

// ── dispatch ─────────────────────────────────────────────────────────
eq(await apply({ cmd: 'timer', action: 'toggle' }), false, 'a command with no widget to act on does nothing');
for (const t of ['timer', 'stopwatch', 'names', 'traffic', 'symbols', 'dice', 'groups']) await board.click(`#dock button[data-add="${t}"]`);
await settle(board, 300);
let s = await snap();
eq(s.timer, { text: '5:00', running: false, done: false }, 'snapshot: timer');
eq(s.traffic, { light: 'green' }, 'snapshot: light');
eq(s.symbols, { mode: 'silent' }, 'snapshot: symbol');
eq(s.symbolList.length, 6, 'snapshot: the symbol choices');
eq(s.names.ready, true, 'snapshot: a roster is ready');

eq(await apply({ cmd: 'timer', action: 'toggle' }), true, 'timer toggle applies');
await settle(board, 300);
ok((await data('timer')).endsAt > 0, 'the timer is running, exactly as Start does');
eq(await board.locator('.w[data-type="timer"] button.primary').textContent(), 'Pause', 'the board’s own button says Pause');
await apply({ cmd: 'timer', action: 'add' });
await settle(board, 300);
ok((await data('timer')).endsAt - Date.now() > 5 * 60 * 1000, 'add puts a minute on');
await apply({ cmd: 'timer', action: 'toggle' });
await apply({ cmd: 'timer', action: 'reset' });
await settle(board, 350);
eq([(await data('timer')).endsAt, (await data('timer')).remaining], [0, 300], 'reset stops it at the full time');

await apply({ cmd: 'stopwatch', action: 'toggle' });
await settle(board, 300);
ok((await data('stopwatch')).startedAt > 0, 'stopwatch starts');
await apply({ cmd: 'stopwatch', action: 'reset' });
await settle(board, 350);
eq(await data('stopwatch'), { startedAt: 0, elapsed: 0 }, 'stopwatch resets');

const picked = [];
for (let i = 0; i < 4; i++) { await apply({ cmd: 'pick' }); picked.push((await snap()).names.name); }
eq([...picked].sort(), [...ROSTER['Period 4']].sort(), 'four remote picks, no repeats, the same rule as the Pick button');
eq(await board.locator('.w[data-type="names"] .big-name').textContent(), picked[3], 'the board shows the remote’s pick');

await apply({ cmd: 'light', color: 'red' });
eq(await board.locator('.w[data-type="traffic"] .light-label').textContent(), 'Stop', 'light set from the remote');
await apply({ cmd: 'symbol', mode: 'hands' });
eq(await board.locator('.w[data-type="symbols"] .sym-label').textContent(), 'Hands up', 'symbol set from the remote');
await apply({ cmd: 'roll' });
ok(/^Rolled /.test(await board.locator('.w[data-type="dice"] .note').textContent()), 'dice rolled from the remote');
await apply({ cmd: 'groups' });
eq(await board.locator('.w[data-type="groups"] .group').count(), 1, 'groups made from the remote (4 in fours)');

const before = JSON.stringify(await st());
for (const bad of [{ cmd: 'light', color: 'blue' }, { cmd: 'symbol', mode: 'riot' }, { cmd: 'screen', id: 'nope' }, { cmd: 'eval', code: '1' }, 'pick', null]) {
  eq(await apply(bad), false, 'refused: ' + JSON.stringify(bad));
}
await settle(board, 350);
eq(JSON.stringify(await st()), before, 'refused commands change nothing');

// a second screen, for switching
board.__promptAnswer = 'Period 5';
await board.click('#newScreenBtn');
await board.click('#dock button[data-add="timer"]');
const second = (await st()).current;
const first = (await st()).screens[0].id;
eq(await apply({ cmd: 'screen', id: first }), true, 'switch screens from the remote');
eq((await st()).current, first, 'the board is on the first screen');

// ── real pairing ─────────────────────────────────────────────────────
const phone = await prepPage(browser, BASE, { width: 390, height: 844, mobile: true });
await phone.goto(URL_PHONE);
await settle(phone);
ok(await phone.locator('#setupCard').isVisible(), 'the phone page opens on pairing');

await board.click('#remoteBtn');
ok(await board.locator('#remoteDialog').isVisible(), 'the pairing dialog opens');
ok((await board.locator('#remoteDialog .rd-url').textContent()).endsWith('/Tools/class-screen/remote.html'), 'it names the phone page');
await board.click('#rdStart');
await board.waitForSelector('#rdOffer', { timeout: 8000 });
await board.addScriptTag({ content: fs.readFileSync(path.join(ROOT, '_shared', 'vendor', 'jsqr', 'jsqr.js'), 'utf8') });
const offer = await board.locator('#rdOffer').evaluate((c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  // eslint-disable-next-line no-undef
  const r = jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
});
ok(offer && offer.startsWith('O'), 'the pairing QR decodes to an offer');
eq(offer, await board.locator('#rdOfferText').inputValue(), 'and matches the copyable text');

await phone.fill('#pastePayload', offer || '');
await phone.click('#connectBtn');
await phone.waitForFunction(() => document.getElementById('answerText').value.length > 0, null, { timeout: 8000 }).catch(() => {});
const answer = await phone.inputValue('#answerText');
ok(answer.startsWith('A'), 'the phone produced a reply');
ok(await phone.locator('#answerCanvas').isVisible(), 'and shows it as a QR');

await board.fill('#rdAnswer', answer);
await board.click('#rdConnect');
await phone.waitForSelector('#controls:not([hidden])', { timeout: 10000 }).catch(() => {});
ok(await phone.locator('#controls').isVisible(), 'the phone connects and shows its controls');
await board.waitForSelector('#remoteLive:not([hidden])', { timeout: 5000 }).catch(() => {});
ok(await board.locator('#remoteLive').isVisible(), 'the board says a phone is connected');
ok(/Phone connected/.test(await board.locator('#rdStatus').textContent()), 'the dialog says so');
await board.getByRole('button', { name: 'Done' }).click();

await phone.waitForFunction(() => __csRemote.latest() !== null, null, { timeout: 5000 }).catch(() => {});
eq(await phone.locator('#screenPick option').allTextContents(), ['Screen 1', 'Period 5'], 'the phone lists the screens');
eq(await phone.locator('#timerText').textContent(), '5:00', 'the phone shows the timer');

// phone → board
await phone.click('#timerToggle');
await board.waitForFunction(() => __classScreen.state().screens[0].widgets.find((w) => w.type === 'timer').data.endsAt > 0, null, { timeout: 5000 }).catch(() => {});
ok((await data('timer')).endsAt > 0, 'the phone’s Start starts the board’s timer');
await phone.waitForFunction(() => document.getElementById('timerToggle').textContent === 'Pause', null, { timeout: 3000 }).catch(() => {});
eq(await phone.locator('#timerToggle').textContent(), 'Pause', 'and the phone learns it is running');
await phone.click('[data-light="yellow"]');
await board.waitForFunction(() => document.querySelector('.w[data-type="traffic"] .light-label').textContent === 'Wait', null, { timeout: 3000 }).catch(() => {});
eq(await board.locator('.w[data-type="traffic"] .light-label').textContent(), 'Wait', 'the phone sets the light');
await phone.selectOption('#symbolPick', 'partner');
await board.waitForFunction(() => document.querySelector('.w[data-type="symbols"] .sym-label').textContent === 'Partner talk', null, { timeout: 3000 }).catch(() => {});
eq(await board.locator('.w[data-type="symbols"] .sym-label').textContent(), 'Partner talk', 'the phone sets the symbol');
await phone.click('#pickBtn');
await phone.waitForFunction(() => document.getElementById('pickedName').textContent !== '—', null, { timeout: 3000 }).catch(() => {});
const phoneName = await phone.locator('#pickedName').textContent();
ok(ROSTER['Period 4'].includes(phoneName), `the phone shows the picked name (${phoneName})`);
eq(await board.locator('.w[data-type="names"] .big-name').textContent(), phoneName, 'the same name the board shows');

await phone.selectOption('#screenPick', second);
await board.waitForFunction((id) => __classScreen.state().current === id, second, { timeout: 3000 }).catch(() => {});
eq((await st()).current, second, 'the phone switches the board’s screen');
await phone.waitForFunction(() => document.getElementById('namesCard').hidden, null, { timeout: 3000 }).catch(() => {});
ok(await phone.locator('#namesCard').isHidden(), 'cards for widgets the screen lacks are hidden');
ok(await phone.locator('#timerCard').isVisible(), 'and the ones it has are shown');

// board → phone
await board.selectOption('#screenSelect', first);
await phone.waitForFunction((id) => document.getElementById('screenPick').value === id, first, { timeout: 3000 }).catch(() => {});
eq(await phone.inputValue('#screenPick'), first, 'a switch on the board reaches the phone');

const pa = await a11yScan(phone);
ok(pa.length === 0, 'axe on the phone’s controls: ' + pa.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));
await board.click('#remoteBtn');
const ba = await a11yScan(board);
ok(ba.length === 0, 'axe with the dialog open: ' + ba.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));

// disconnect
await board.getByRole('button', { name: 'Disconnect' }).click();
await phone.waitForSelector('#setupCard:not([hidden])', { timeout: 8000 }).catch(() => {});
ok(await phone.locator('#setupCard').isVisible(), 'disconnecting on the board returns the phone to pairing');
ok(await board.locator('#remoteLive').isHidden(), 'and the board’s badge goes');

eq(board.__errs, [], 'no board errors');
eq(phone.__errs, [], 'no phone errors');
eq([...board.__blocked, ...phone.__blocked], [], 'nothing went offsite');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
