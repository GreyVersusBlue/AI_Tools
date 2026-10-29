// smoke-bank-stations.mjs — 019's and 018's Question bank card (Path 12 P2, increment 6).
//
//   node Tools/stations/test/smoke-bank-stations.mjs      (or: npm run test:stations-bank-smoke; port 8593)
//
// What is worth holding still, per page:
//   1. a room (hunt) saved before the card loads and is saved as it was: opening the page, picking a source
//      and a unit and ticking boxes write nothing, and the bank's key is not written at all;
//   2. the chooser lists the teacher's bank and the built-in sets; a ticked question is added on a press and
//      only then, as one station in the page's own shape with `bankId` on it, and the bank is untouched;
//   3. a question already a station is shown as such, cannot be ticked and is skipped by Tick all; deleting
//      the station frees it;
//   4. a lone empty station is replaced; one typed by hand is kept;
//   5. a bank station encodes the player payload exactly as the same station typed by hand does;
//   6. a question's text is text on the page, never markup;
//   7. the card is clean under axe, and nothing logs an error.
// The mapping itself is in stations-bank.test.mjs (pure Node). Every name here is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import * as F from './_fixtures.mjs';

const PORT = 8593;
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = 'gvb-question-bank';
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const HOSTILE = '<img src=x onerror="window.__xss=1"> & <b>bold</b>';
const bankQ = (o) => ({ id: 'madeup-1', prompt: 'What is the made-up capital of Madeupia?', answer: 'Madeupville', choices: [], media: null, unit: 'Made-up Unit 1', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-01-05T10:00:00.000Z', updatedAt: '2026-01-05T10:00:00.000Z', ...o });
const BANK = { schema: 1, legacy: {}, questions: [
  bankQ({}),
  bankQ({ id: 'madeup-2', prompt: 'Name the made-up river that runs through Madeupville.', answer: 'Madeup, the Great', unit: 'Made-up Unit 1' }),
  bankQ({ id: 'madeup-3', prompt: 'Which made-up colour is Madeupia\'s flag?', answer: 'Teal', choices: ['Teal', 'Mauve', 'Ochre'], unit: 'Made-up Unit 2' }),
  bankQ({ id: 'madeup-4', prompt: 'Which made-up animal is its emblem?', answer: 'Heron', choices: ['Fox', 'Wolf'], unit: 'Made-up Unit 2' }),
  bankQ({ id: 'madeup-5', prompt: HOSTILE, answer: 'safe', unit: 'Made-up Unit 3' }),
  bankQ({ id: 'madeup-6', prompt: 'A question with no answer', answer: '', unit: 'Made-up Unit 3' }),
] };

const server = await serve(PORT);
const browser = await launch();

const PAGES = [
  { n: '019', kind: 'room', url: '/Tools/019-escape-room-builder.html', key: 'escape-room-builder:rooms', plain: true, seed: F.R2, name: 'Crypt of Ammon', card: '#bankCard', src: '#sbroomSource', unit: '#sbroomUnit', rows: '#stationsList .station-card', newBtn: '#newSetBtn' },
].filter(P => !ONLY || P.n === ONLY);

const storedStore = (page, P) => page.evaluate(([k, plain]) => {
  const raw = localStorage.getItem(k); if (!raw) return null;
  const v = JSON.parse(raw);
  return plain && v && v.data && v.v ? v.data : v;
}, [P.key, P.plain]);
const bankKey = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function open(P, seed, withBank = true) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  page.on('dialog', d => d.accept());
  await page.goto(BASE + P.url, { waitUntil: 'load' });
  await page.evaluate(([k, name, seed, plain, bank, bk]) => {
    const store = { current: name, sets: { [name]: seed } };
    localStorage.setItem(k, JSON.stringify(plain ? { v: 1, data: store } : store));
    if (bank) localStorage.setItem(bk, JSON.stringify({ v: 1, data: bank }));
  }, [P.key, P.name, seed, P.plain, withBank ? BANK : null, KEY]);
  await page.goto(BASE + P.url, { waitUntil: 'load' }); await settle(page, 500);
  return page;
}

for (const P of PAGES) {
  console.log(`${P.n} — the Question bank card`);
  const seed = P.seed();
  let page = await open(P, seed, true);

  // 1. nothing is written by looking
  ok(await page.locator(P.card).isVisible(), `${P.n}: the Question bank card is on the page`);
  const stored0 = JSON.stringify(await storedStore(page, P));
  const bank0 = await bankKey(page);
  const sources = await page.$$eval(P.src + ' option', os => os.map(o => o.textContent));
  ok(/^My question bank \(6 questions\)/.test(sources[0]) && sources.some(s => /Cultural Trivia/.test(s)) && sources.some(s => /Geography Bee/.test(s)), `${P.n}: the chooser lists the teacher's bank and the built-in sets (${sources.join(' | ')})`);
  const units = await page.$$eval(P.unit + ' option', os => os.map(o => o.textContent));
  eq(units, ['All units', 'Made-up Unit 1', 'Made-up Unit 2', 'Made-up Unit 3'], `${P.n}: the units of the bank`);
  await page.selectOption(P.src, { label: sources.find(s => /Cultural Trivia/.test(s)) }); await settle(page, 100);
  const trivia = await page.$$eval(P.card + ' .sb-row', r => r.length);
  ok(trivia === 30, `${P.n}: a built-in set lists its 30 questions (${trivia})`);
  await page.selectOption(P.src, ''); await settle(page, 100);
  await page.selectOption(P.unit, 'Made-up Unit 1'); await settle(page, 100);
  await page.locator(P.card + ' .sb-row input').first().check();
  eq(JSON.stringify(await storedStore(page, P)), stored0, `${P.n}: choosing a source and a unit and ticking a box saves nothing`);
  eq(await bankKey(page), bank0, `${P.n}: the bank's key is not written by looking`);

  // 2. Add
  const before = await page.$$eval(P.rows, r => r.length);
  await page.locator(P.card + ' .sb-row input').nth(1).check();
  await page.click(P.card + ' button:has-text("Add ticked as stations")'); await settle(page, 400);
  eq(await page.$$eval(P.rows, r => r.length), before + 2, `${P.n}: two ticked questions are two more stations`);
  let store = await storedStore(page, P);
  let sts = store.sets[P.name].stations;
  const added = sts.slice(-2);
  eq(added.map(s => s.bankId), ['madeup-1', 'madeup-2'], `${P.n}: the new stations carry the questions' ids as bankId`);
  eq(added.map(s => s.clue), ['What is the made-up capital of Madeupia?', 'Name the made-up river that runs through Madeupville.'], `${P.n}: the question is the clue`);
  eq(added.map(s => s.answers), ['Madeupville', 'Madeup the Great'], `${P.n}: the answer is the accepted answer (a comma becomes a space)`);
  ok(added.every(s => s.type === 'text' && s.next === null), `${P.n}: text stations with no branch`);
  ok(sts.slice(0, before).every((s, i) => s.bankId === undefined && s.clue === seed.stations[i].clue), `${P.n}: the stations that were there are as they were`);
  const status = await page.textContent(P.card + ' .sb-status');
  ok(/Added 2 stations/.test(status) && /had a comma/.test(status) && /bank itself was not changed/.test(status), `${P.n}: the status says what happened (${status})`);
  eq(await bankKey(page), bank0, `${P.n}: adding stations does not change the bank`);

  // 3. already a station
  await page.selectOption(P.unit, 'Made-up Unit 1'); await settle(page, 100);
  const dis = await page.$$eval(P.card + ' .sb-row input', xs => xs.map(x => x.disabled));
  eq(dis, [true, true], `${P.n}: a question already a station cannot be ticked`);
  ok(/Already a station here/.test(await page.textContent(P.card + ' .sb-list')), `${P.n}: and says so`);
  await page.selectOption(P.unit, ''); await settle(page, 100);
  await page.click(P.card + ' button:has-text("Tick all shown")');
  await page.click(P.card + ' button:has-text("Add ticked as stations")'); await settle(page, 400);
  store = await storedStore(page, P); sts = store.sets[P.name].stations;
  eq(sts.slice(before + 2).map(s => s.bankId), ['madeup-3', 'madeup-4', 'madeup-5'], `${P.n}: Tick all adds the rest, not the two held, not the one with no answer`);
  ok(/cannot be added/.test(await page.textContent(P.card)) && /no answer/.test(await page.textContent(P.card + ' .sb-list')), `${P.n}: the question with no answer says why it cannot be added`);
  ok(/had answer choices/.test(await page.textContent(P.card + ' .sb-status')), `${P.n}: choices that did not come are said`);
  ok(sts.slice(-3).every(s => s.answers.indexOf(',') === -1), `${P.n}: no added answer holds a comma`);

  // 6. text is text
  ok((await page.evaluate(() => window.__xss)) === undefined, `${P.n}: a question with markup in it ran nothing`);
  const clueBox = await page.$$eval(P.rows + ' .f-clue', xs => xs.map(x => x.value));
  ok(clueBox.includes(HOSTILE), `${P.n}: the markup is the clue's text, as typed`);

  // 5. the payload is the one a hand-typed station gives
  const payloads = await page.evaluate((name) => {
    const raw = JSON.parse(localStorage.getItem('escape-room-builder:rooms'));
    const room = (raw.data || raw).sets[name];
    const a = Stations.playPayload(Stations.read(JSON.parse(JSON.stringify(room))), { station: null });
    const typed = JSON.parse(JSON.stringify(room)); typed.stations.forEach(s => { delete s.bankId; });
    const b = Stations.playPayload(Stations.read(typed), { station: null });
    return [JSON.stringify(a), JSON.stringify(b), JSON.stringify(a).length];
  }, P.name);
  ok(payloads[0] === payloads[1] && payloads[2] > 50, `${P.n}: the player payload is the same with or without bankId`);

  // 3b. deleting a station frees its question
  await page.click(P.rows + ':last-child [data-remove]'); await settle(page, 300);
  store = await storedStore(page, P);
  ok(store.sets[P.name].stations.every(s => s.bankId !== 'madeup-5'), `${P.n}: the removed station is gone`);
  await page.selectOption(P.unit, 'Made-up Unit 3'); await settle(page, 100);
  ok((await page.$$eval(P.card + ' .sb-row input', xs => xs[0].disabled)) === false, `${P.n}: its question can be added again`);

  // 7. a11y
  const bad = await a11yScan(page, { include: P.card });
  ok(!bad || bad.length === 0, `${P.n}: the card has no serious axe violations (${JSON.stringify(bad && bad.map(v => v.id))})`);
  ok(page.__errs.length === 0, `${P.n}: no page or console errors (${page.__errs.join(' | ')})`);
  await page.close();

  // 4. a lone empty station is replaced; a typed one is kept
  const empty = P.seed(); empty.stations = [P.kind === 'room' ? F.rSt({}) : F.hSt('', '')];
  delete empty.run;
  page = await open(P, empty, true);
  await page.selectOption(P.unit, 'Made-up Unit 1'); await settle(page, 100);
  await page.locator(P.card + ' .sb-row input').first().check();
  await page.click(P.card + ' button:has-text("Add ticked as stations")'); await settle(page, 400);
  store = await storedStore(page, P);
  eq(store.sets[P.name].stations.map(s => s.bankId), ['madeup-1'], `${P.n}: a lone empty station is replaced`);
  await page.close();

  // no bank at all: the card is there, empty, and says so
  page = await open(P, P.seed(), false);
  ok(/Your question bank is empty/.test(await page.textContent(P.card + ' .sb-list')), `${P.n}: with no bank the card says it is empty`);
  eq(await bankKey(page), null, `${P.n}: and nothing is written to make it so`);
  ok(page.__errs.length === 0, `${P.n}: no errors with no bank (${page.__errs.join(' | ')})`);
  await page.close();
}

await browser.close(); server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
