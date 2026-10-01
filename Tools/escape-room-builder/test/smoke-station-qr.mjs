// smoke-station-qr.mjs — each printed station code carries one station.
//
//   node Tools/escape-room-builder/test/smoke-station-qr.mjs
//
// Found in #282: every station's QR code encoded the WHOLE room, images and
// all, so one real photo (~33 KB as a data URL, against the ~1.6 KB a QR code
// holds at error correction Q) on any station made every station's code fail
// to build, and the page said "Could not build a QR code". What is asserted:
//
//   1. A room with one real photo builds every station's code, with no error.
//   2. Each code, decoded off the canvas with the vendored jsQR, is the link
//      the page shows, and that link carries this station's clue and answers,
//      no other station's, and no image bytes.
//   3. lock.html plays a whole room from the station codes alone, on a device
//      with none of the builder's storage: the gate, the hint cost and score,
//      the letters strip, branching, the done screen. The photo's station says
//      the picture is on the printed card, and the printed card has it.
//   4. A code printed before this change (the whole room in `r`) still plays.
//   5. The student link is unchanged: it still carries the whole room and the
//      image, because it is a link, not a QR code.
//
// No console errors. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8458;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/019-escape-room-builder.html';
const KEY = 'escape-room-builder:rooms';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const station = (o) => Object.assign({
  clue: '', answers: '', hint: '', next: null, image: '', type: 'text', hintCost: 0, awardLetter: '',
  cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null,
}, o);
/* Four stations, one branching jump (station 2 skips station 3), a costed
   hint, two letters, and the photo on station 2. Station 3 is reachable only
   by its own code being scanned out of order, which must gate. */
const ROOM = {
  name: 'Crypt of Ammon', roomId: 'cryptammon1', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
  randomizeStart: false, countdownEnabled: false, countdownMinutes: 20, storyIntro: '', packetCardsPerPage: '2',
  stations: [
    station({ clue: 'Which god has a ram\'s head?', answers: 'amun, ammon', hint: 'Starts with A.', hintCost: 10, awardLetter: 'S' }),
    station({ clue: 'Read the cartouche in the picture.', answers: 'ramesses', next: 3 }),
    station({ clue: 'A station nobody is routed to.', answers: 'nowhere' }),
    station({ clue: 'How many canopic jars?', answers: '4', awardLetter: 'K' }),
  ],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const load = async () => {
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__escapeImagesSettled === true, null, { timeout: 8000 });
  await settle(page, 300);   // render() is debounced 150 ms
};
const decodeR = (href) => {
  const r = new URL(href).searchParams.get('r');
  return JSON.parse(decodeURIComponent(escape(atob(r))));
};

console.log('Escape Room Builder — one station per station code');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ current: v.name, sets: { [v.name]: v } })), [KEY, ROOM]);
await load();

/* A real photo through the real picker: 1200×900 of noise, which JPEG
   compresses worst, downscaled by the page to its 320 px JPEG. */
const photo = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 900;
  const x = c.getContext('2d');
  const d = x.createImageData(1200, 900);
  let seed = 11;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d.data[i] = seed & 255; d.data[i + 1] = (seed >> 8) & 255; d.data[i + 2] = (seed >> 16) & 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
});
await page.setInputFiles('.station-card[data-idx="1"] input.f-image',
  { name: 'cartouche.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
await page.waitForFunction(() => !!document.querySelector('.station-card[data-idx="1"] .station-image-thumb img'), null, { timeout: 5000 });
await settle(page, 400);
const photoSrc = await page.getAttribute('.station-card[data-idx="1"] .station-image-thumb img', 'src');
ok(/^data:image\/jpeg/.test(photoSrc) && photoSrc.length > 20000,
  `the photo is a real one: a ${Math.round(photoSrc.length / 1024)} KB data URL, far past what one QR code holds`);

/* ── 1. every station's code builds ────────────────────────────────────── */
const msg = await page.textContent('#msg');
ok(!/Could not build a QR code/.test(msg), 'no station\'s code fails to build: ' + JSON.stringify(msg));
const cards = await page.$$eval('#cards-preview .preview-card', els => els.map(e => ({
  w: e.querySelector('canvas').width, link: e.querySelector('.p-content').textContent,
})));
eq(cards.length, 4, 'all four stations have a preview card');
ok(cards.every(c => c.w === 200), 'and every one has its code drawn');

/* ── 2. what each code carries ─────────────────────────────────────────── */
cards.forEach((c, n) => {
  const room = decodeR(c.link);
  eq(new URL(c.link).searchParams.get('s'), String(n), `station ${n + 1}'s link names its station`);
  eq(room.id, 'cryptammon1', `station ${n + 1}'s link carries the room id lock.html keys progress by`);
  eq(room.stations.length, 4, `and the station count`);
  eq(room.stations[n].clue, ROOM.stations[n].clue, `and its own clue`);
  ok(room.stations.every((st, i) => i === n || (st.clue === undefined && st.answers === undefined && st.hint === undefined)),
    `and no other station's clue, answers or hint`);
  ok(!c.link.includes('data:image') && !JSON.stringify(room).includes('data:image'), `and no image bytes`);
  ok(c.link.length < 1000, `station ${n + 1}'s link is ${c.link.length} characters`);
});
eq(decodeR(cards[1].link).stations[1].next, 3, 'a branch survives in the station that takes it');

/* ── 5. the student link still carries everything ──────────────────────── */
const playerRoom = decodeR(await page.inputValue('#playerLink'));
eq(playerRoom.stations[1].image, photoSrc, 'the student link (a link, not a code) still carries the photo');
eq(playerRoom.stations[2].clue, ROOM.stations[2].clue, 'and every station');

/* ── 3. lock.html plays the room from the station codes alone ──────────── */
const lock = await prepPage(browser, BASE, { width: 420, height: 900 });
const text = () => lock.textContent('#card');
const open = async (href) => { await lock.goto(href, { waitUntil: 'load' }); await settle(lock, 250); };
const answer = async (a) => {
  await lock.fill('#answerInput', a);
  await lock.click('#answerForm button[type="submit"]');
  await settle(lock, 800);
};

await open(cards[1].link);
ok(/Go find Station 1/.test(await text()), 'scanning station 2 first sends a new player to Station 1');
await open(cards[0].link);
ok((await text()).includes(ROOM.stations[0].clue), 'station 1\'s code shows its clue');
ok(/Station 1 of 4/.test(await text()), 'and counts the room\'s four stations');
ok(/Score: 0/.test(await text()), 'scoring is on, because one station charges for its hint');
eq(await lock.$$eval('.letter-box', els => els.length), 2, 'the letters strip has a slot for each of the two letter stations');
await lock.click('#hintBtn');
await settle(lock, 150);
ok(/Starts with A/.test(await text()), 'the hint opens');
await answer('ammon');
ok(/clue is waiting at Station 2/.test(await text()), 'a right answer sends the player on to Station 2: ' + JSON.stringify((await text()).slice(0, 200)));
eq(await lock.$$eval('.letter-box.filled', els => els.map(e => e.textContent).join('')), '',
  'the strip is not drawn on the gate');
await open(cards[1].link);
ok((await text()).includes(ROOM.stations[1].clue), 'station 2\'s code shows its clue');
eq(await lock.$('img.clue-image'), null, 'and draws no image, because none rode the code');
ok(/picture/i.test(await lock.textContent('.clue-photo-note') || ''), 'and says the picture is on the printed card');
eq(await lock.$$eval('.letter-box.filled', els => els.map(e => e.textContent).join('')), 'S', 'the letter earned at station 1 is kept');
await answer('ramesses');
await open(cards[2].link);
ok(/clue is waiting at Station 4/.test(await text()), 'the branch skipped station 3: its code gates to Station 4');
await open(cards[3].link);
ok((await text()).includes(ROOM.stations[3].clue), 'station 4\'s code shows its clue');
await answer('4');
const done = await text();
ok(/You escaped/.test(done), 'the room finishes on the last station');
ok(/Final score: 290/.test(done), 'the score is 3 × 100 less the 10-point hint, read off a station that is not in this code: ' + JSON.stringify(done.slice(0, 300)));
eq(await lock.$$eval('.letter-box.filled', els => els.map(e => e.textContent).join('')), 'SK', 'both letters are collected');

/* The printed codes carry the picture the code leaves out. */
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printCodesBtn');
await settle(page, 300);
const printed = await page.$$eval('#printQrGrid .p-card', els => els.map(e => {
  const img = e.querySelector('img');
  return { canvas: e.querySelector('canvas').width, img: img ? img.getAttribute('src') : null };
}));
eq(printed.length, 4, 'four printed station cards');
ok(printed.every(p => p.canvas === 600), 'each with its code drawn');
/* The printed code is the one a phone reads, so it is the one decoded: with
   the vendored jsQR, off the canvas, and compared with the preview's link. */
await page.addScriptTag({ url: BASE + '/_shared/vendor/jsqr/jsqr.js' });
const scanned = await page.$$eval('#printQrGrid .p-card canvas', els => els.map(cv => {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
  const r = window.jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
}));
cards.forEach((c, n) => eq(scanned[n], c.link, `station ${n + 1}'s printed code scans as its link`));
eq(printed[1].img, photoSrc, 'station 2\'s printed card carries the photo');
ok(printed.filter(p => p.img).length === 1, 'and no other card has one');

/* ── 4. a code printed before this change still plays ──────────────────── */
/* With a 1×1 picture: a code from before could only ever have been built
   around a tiny one, which is the bug. */
const TINY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const legacy = await page.evaluate(([room]) => {
  const old = { id: 'oldcrypt01', title: 'Old Crypt', stations: [
    { clue: 'Old one?', answers: ['yes'], hint: '', next: null, image: room },
    { clue: 'Old two?', answers: ['no'], hint: '', next: null },
  ] };
  const url = new URL('escape-room-builder/lock.html', window.location.href);
  url.searchParams.set('r', btoa(unescape(encodeURIComponent(JSON.stringify(old)))));
  url.searchParams.set('s', '0');
  return url.href;
}, [TINY]);
await open(legacy);
ok((await text()).includes('Old one?'), 'a whole-room code from before still shows its station');
eq(await lock.getAttribute('img.clue-image', 'src'), TINY, 'and still draws the image it carried');
eq(await lock.$('.clue-photo-note'), null, 'with no printed-card note');
await answer('yes');
ok(/clue is waiting at Station 2/.test(await text()), 'and still advances');

/* ── no console noise ──────────────────────────────────────────────────── */
for (const [name, p] of [['builder', page], ['lock.html', lock]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
