// smoke-value-range.mjs — improper, mixed and negative values on 061.
//
//   node Tools/fraction-decimal-percent-drill-generator/test/smoke-value-range.mjs
//
// The drill used to draw one thing: a proper fraction between 0 and 1. Two
// options now reach past it ("Values": above 1 as improper fractions, mixed
// numbers or both; "Include negative values"), both off by default. What this
// suite holds down:
//
//   Nothing moves when they are off. golden-old-sheets.json is 180 sheets
//   (3 difficulties x 4 given forms x 3 row counts x 5 seeds) read off the page
//   as it stood at ab678d3, before any of this: every row of every one, and the
//   settings string the page saves, must come out unchanged. A saved state with
//   none of the new fields, and a share link made before them, load the same.
//
//   The arithmetic is right. Each cell is parsed back into a whole-number ratio
//   (BigInt, never a float) and checked against an oracle written here: the
//   fraction is in lowest terms, a mixed number has a whole part and a proper
//   remainder, an improper one has a numerator past its denominator, the decimal
//   is the value to three places rounded half up (so repeating decimals, and a
//   tie like 1 1/16, come out one way), and the percent is that same decimal
//   times 100. A minus sign is on all three cells or none. Known rows are
//   pinned to literals as well, so a wrong oracle cannot agree with a wrong page.
//
//   The options do what they say. Negatives on: at least one negative row on
//   every sheet, about half over many; off: none. "Both kinds": both a mixed
//   number and an improper fraction on every sheet. Above 1: nothing under 1.
//
//   The key is the sheet. The answer key's given cells are the worksheet's, its
//   blanks are filled, and the print tables hold what the screen does.
//
//   They persist and travel. The options are saved, restored and shared only
//   when on; a bad value in a saved state or a link falls back to the default.
//
//   Paper. A 12-row sheet with every option on is one page of Chromium PDF for
//   the worksheet and one for the key; at 30 rows it is no longer than the old sheet.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8488;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/061-fraction-decimal-percent-drill-generator.html';
const HERE = path.dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const DENOMS = {
  easy: [2, 4, 5, 10, 20, 25, 50, 100],
  medium: [2, 3, 4, 5, 6, 8, 10, 20, 25, 100],
  hard: Array.from({ length: 19 }, (_, i) => i + 2)
};

/* ── the oracle: whole numbers only ──────────────────────────────────────── */
const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));

// "3/4", "7/4", "1 3/4" or "5", with a leading minus on any. -> {neg, num, den, kind, whole, rem} or null
function parseFraction(text) {
  let m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(text);
  if (m) {
    const whole = BigInt(m[2]), rem = BigInt(m[3]), den = BigInt(m[4]);
    return { neg: m[1] === '-', num: whole * den + rem, den, kind: 'mixed', whole, rem };
  }
  m = /^(-?)(\d+)\/(\d+)$/.exec(text);
  if (m) {
    const num = BigInt(m[2]), den = BigInt(m[3]);
    return { neg: m[1] === '-', num, den, kind: num > den ? 'improper' : 'proper' };
  }
  m = /^(-?)(\d+)$/.exec(text);
  if (m) return { neg: m[1] === '-', num: BigInt(m[2]), den: 1n, kind: 'whole' };
  return null;
}
// value to thousandths, rounded half up on the magnitude, from a ratio
const thousandths = (num, den) => (2000n * num + den) / (2n * den);
const trim = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
const decimalFromT = (t) => trim((t / 1000n).toString() + '.' + (t % 1000n).toString().padStart(3, '0'));
const percentFromT = (t) => trim((t / 10n).toString() + '.' + (t % 10n).toString()) + '%';

/** Everything wrong with one row, as a list of sentences. */
function rowProblems(cells, { difficulty, range, negatives }) {
  const [f, d, p] = cells;
  const bad = [];
  const fr = parseFraction(f);
  if (!fr) return [`fraction cell ${JSON.stringify(f)} is not a fraction, mixed number or whole number`];
  if (fr.kind === 'whole') bad.push(`${f}: a whole number is not a fraction to convert`);
  const reducedNum = fr.kind === 'mixed' ? fr.rem : fr.num;
  if (gcd(reducedNum, fr.den) !== 1n) bad.push(`${f}: not in lowest terms`);
  if (fr.den < 2n) bad.push(`${f}: denominator under 2`);
  if (!DENOMS[difficulty].some((D) => BigInt(D) % fr.den === 0n)) bad.push(`${f}: denominator ${fr.den} is not from ${difficulty}`);
  if (fr.kind === 'mixed') {
    if (!(fr.whole >= 1n && fr.whole <= 4n)) bad.push(`${f}: whole part outside 1 to 4`);
    if (!(fr.rem >= 1n && fr.rem < fr.den)) bad.push(`${f}: remainder is not proper`);
  }
  if (range === 'proper') {
    if (!(fr.num < fr.den && fr.num > 0n)) bad.push(`${f}: not between 0 and 1 on a 0-to-1 sheet`);
    if (fr.kind !== 'proper') bad.push(`${f}: ${fr.kind} on a 0-to-1 sheet`);
  } else {
    if (!(fr.num > fr.den && fr.num < 5n * fr.den)) bad.push(`${f}: not between 1 and 5`);
    if (range === 'improper' && fr.kind !== 'improper') bad.push(`${f}: ${fr.kind} on an improper sheet`);
    if (range === 'mixed' && fr.kind !== 'mixed') bad.push(`${f}: ${fr.kind} on a mixed sheet`);
  }
  if (!negatives && fr.neg) bad.push(`${f}: negative with negatives off`);
  const sign = fr.neg ? '-' : '';
  const t = thousandths(fr.num, fr.den);
  if (d !== sign + decimalFromT(t)) bad.push(`${f}: decimal ${d}, want ${sign + decimalFromT(t)}`);
  if (p !== sign + percentFromT(t)) bad.push(`${f}: percent ${p}, want ${sign + percentFromT(t)}`);
  return bad;
}

/* ── the page ────────────────────────────────────────────────────────────── */
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });

const keyRows = () => page.evaluate(() => [...document.querySelectorAll('#keyTable tr')].slice(1)
  .map((tr) => [...tr.children].slice(1).map((c) => ({ text: c.textContent, cls: c.className }))));
async function load(settings) {
  await page.evaluate((s) => localStorage.setItem('fdp_settings_v1', JSON.stringify(s)), settings);
  await page.reload({ waitUntil: 'domcontentloaded' });
  return keyRows();
}
const base = (o) => ({ difficulty: 'hard', givenForm: 'random', rowCount: 30, lockSeed: true, seed: 20261003, ...o });

/* ── 1. off by default: the old sheets, row for row ──────────────────────── */
{
  const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'golden-old-sheets.json'), 'utf8'));
  let sheetsSame = 0, savedSame = 0;
  const differing = [];
  for (const g of golden) {
    const rows = (await load(g.s)).map((r) => r.map((c) => c.text + ' ' + c.cls));
    if (JSON.stringify(rows) === JSON.stringify(g.rows)) sheetsSame++; else differing.push(JSON.stringify(g.s));
    if ((await page.evaluate(() => localStorage.getItem('fdp_settings_v1'))) === g.saved) savedSame++;
  }
  eq(golden.length, 180, 'the golden file holds 180 sheets');
  eq(sheetsSame, golden.length, `every one of the ${golden.length} old sheets comes out row for row the same (differ: ${differing.slice(0, 3).join(' ')})`);
  eq(savedSame, golden.length, 'and the settings string the page saves is byte for byte the old one');

  // a state saved with a stray value for the new fields is the default, not an error
  for (const bogus of [{ range: 'sideways' }, { range: 7 }, { negatives: 'yes' }, { negatives: 1 }, { range: null, negatives: null }]) {
    const g = golden[40];
    const rows = (await load({ ...g.s, ...bogus })).map((r) => r.map((c) => c.text + ' ' + c.cls));
    eq(rows, g.rows, `a saved state with ${JSON.stringify(bogus)} draws the old sheet`);
  }
  // the share link an old build made carries four fields and still opens the same sheet
  const g = golden[100];
  const old = { difficulty: g.s.difficulty, givenForm: g.s.givenForm, rowCount: g.s.rowCount, seed: g.s.seed };
  await page.evaluate(() => localStorage.removeItem('fdp_settings_v1'));
  const url = await page.evaluate((o) => window.StateLink.buildShareUrl('drill', o), old);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  eq((await keyRows()).map((r) => r.map((c) => c.text + ' ' + c.cls)), g.rows, 'a share link from before the options opens the same sheet');
  eq(await page.inputValue('#range'), 'proper', 'with the range at its default');
  eq(await page.isChecked('#negatives'), false, 'and negatives off');
}

/* ── 2. the arithmetic, over many sheets ─────────────────────────────────── */
const seen = new Map(); // fraction text -> [decimal, percent]
let sheetCount = 0, rowTotal = 0, negTotal = 0;
const sheetProblems = [];
const SEEDS = [3, 11, 29, 101, 977, 4242, 65537, 1234567];
for (const difficulty of ['easy', 'medium', 'hard']) {
  for (const range of ['proper', 'improper', 'mixed', 'both']) {
    for (const negatives of [false, true]) {
      for (const seed of SEEDS) {
        const rows = await load(base({ difficulty, rowCount: 30, seed, range, negatives: negatives || undefined }));
        sheetCount++;
        const tag = `${difficulty}/${range}/${negatives ? 'neg' : 'pos'}/${seed}`;
        const kinds = new Set();
        let neg = 0;
        for (const r of rows) {
          const cells = r.map((c) => c.text);
          rowTotal++;
          const bad = rowProblems(cells, { difficulty, range, negatives });
          bad.forEach((b) => sheetProblems.push(`${tag}: ${b}`));
          const fr = parseFraction(cells[0]);
          if (fr) { kinds.add(fr.kind); if (fr.neg) neg++; }
          if (!cells.every((c) => c.startsWith('-') === cells[0].startsWith('-'))) sheetProblems.push(`${tag}: a minus sign on only some of ${cells}`);
          if (r.filter((c) => c.cls === 'given').length !== 1) sheetProblems.push(`${tag}: not exactly one given cell in ${cells}`);
          seen.set(cells[0], [cells[1], cells[2]]);
        }
        negTotal += neg;
        if (negatives && neg < 1) sheetProblems.push(`${tag}: negatives are on and no row is negative`);
        if (!negatives && neg) sheetProblems.push(`${tag}: ${neg} negative rows with negatives off`);
        if (range === 'both' && !(kinds.has('mixed') && kinds.has('improper'))) sheetProblems.push(`${tag}: "both kinds" and the sheet has ${[...kinds]}`);
      }
    }
  }
}
eq(sheetProblems.slice(0, 5), [], `${rowTotal} rows over ${sheetCount} sheets all check out against the oracle (${sheetProblems.length} problems)`);

/* ── 3. known answers, as literals ───────────────────────────────────────── */
{
  // pin the oracle itself: a repeating decimal, a tie, a percent over 100 and below 0
  const EXPECT = {
    '7/3': ['2.333', '233.3%'], '5/3': ['1.667', '166.7%'], '9/8': ['1.125', '112.5%'],
    '1 1/2': ['1.5', '150%'], '3 1/6': ['3.167', '316.7%'], '2 5/7': ['2.714', '271.4%'],
    '1 1/16': ['1.063', '106.3%'], '3 2/3': ['3.667', '366.7%'], '5/4': ['1.25', '125%'],
    '-7/3': ['-2.333', '-233.3%'], '-1 1/2': ['-1.5', '-150%'], '-2 1/3': ['-2.333', '-233.3%'],
    '-1 1/16': ['-1.063', '-106.3%'], '-3/4': ['-0.75', '-75%'], '-1/3': ['-0.333', '-33.3%'],
    '-5/4': ['-1.25', '-125%'], '-4 1/2': ['-4.5', '-450%']
  };
  // look for the ones the draw has not shown yet, on sheets that can make them
  const missing = () => Object.keys(EXPECT).filter((k) => !seen.has(k));
  for (let seed = 500; missing().length && seed < 500 + 260; seed++) {
    for (const [range, negatives] of [['both', true], ['improper', true], ['mixed', true], ['proper', true]]) {
      const rows = await load(base({ range, negatives, seed, rowCount: 30 }));
      rows.forEach((r) => seen.set(r[0].text, [r[1].text, r[2].text]));
    }
  }
  const found = Object.keys(EXPECT).filter((k) => seen.has(k));
  eq(found.length, Object.keys(EXPECT).length, `every known row was drawn at least once (missing: ${missing()})`);
  const wrong = found.filter((k) => JSON.stringify(seen.get(k)) !== JSON.stringify(EXPECT[k]));
  eq(wrong.map((k) => `${k} -> ${seen.get(k)}`), [], 'and each is the literal answer, not just the oracle\'s');
}

/* ── 4. the options do what they say ─────────────────────────────────────── */
{
  const frac = negTotal / rowTotal;
  // negatives were on for half the sheets: about half of those rows are negative
  const negRows = rowTotal / 2;
  ok(negTotal / negRows > 0.4 && negTotal / negRows < 0.62, `about half the rows are negative when it is on (${(100 * negTotal / negRows).toFixed(1)}%; all rows ${(100 * frac).toFixed(1)}%)`);
  // the shortest sheet still keeps the promise, over many seeds
  let noNeg = 0, noKind = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const rows = await load(base({ range: 'both', negatives: true, seed, rowCount: 4, difficulty: 'easy' }));
    const fr = rows.map((r) => parseFraction(r[0].text));
    if (!fr.some((x) => x.neg)) noNeg++;
    if (!(fr.some((x) => x.kind === 'mixed') && fr.some((x) => x.kind === 'improper'))) noKind++;
  }
  eq(noNeg, 0, 'a four-row sheet with negatives on has a negative in all 150 draws');
  eq(noKind, 0, 'and a four-row "both kinds" sheet has both kinds in all 150');
  // both kinds really come in roughly even numbers on a long sheet
  let mixed = 0, imp = 0;
  for (let seed = 1; seed <= 20; seed++) {
    (await load(base({ range: 'both', seed, rowCount: 30 }))).forEach((r) => (parseFraction(r[0].text).kind === 'mixed' ? mixed++ : imp++));
  }
  ok(mixed > 200 && imp > 200, `"both kinds" is neither one alone (${mixed} mixed, ${imp} improper in 600 rows)`);
  // negatives alone: still between 0 and 1, now with a sign
  const rows = await load(base({ negatives: true, rowCount: 30 }));
  ok(rows.every((r) => /^-?\d+\/\d+$/.test(r[0].text)) && rows.some((r) => r[0].text.startsWith('-')) && rows.some((r) => !r[0].text.startsWith('-')),
    'negatives with the 0-to-1 range: signed proper fractions, some of each sign');
}

/* ── 5. the controls, the key, the paper ─────────────────────────────────── */
{
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('fdp_settings_v1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  eq(await page.inputValue('#range'), 'proper', 'a fresh page opens at 0 to 1');
  eq(await page.isChecked('#negatives'), false, 'with negatives off');
  eq(await page.textContent('#worksheetTable tr:first-child th:nth-child(2)'), 'Fraction', 'and the old column heading');
  eq(await page.$$eval('#range option', (o) => o.map((x) => x.value)), ['proper', 'improper', 'mixed', 'both'], 'the range select offers the four ranges');

  await page.selectOption('#range', 'both');
  await page.check('#negatives');
  await page.selectOption('#difficulty', 'hard');
  await page.selectOption('#givenForm', 'random');
  await page.fill('#rowCount', '30');
  await page.click('#generateBtn');
  await settle(page, 100);
  eq(await page.textContent('#worksheetTable tr:first-child th:nth-child(2)'), 'Fraction / mixed number', 'a sheet with mixed numbers says so in its heading');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fdp_settings_v1')));
  eq([saved.range, saved.negatives], ['both', true], 'the options are saved when on');

  // the key is the sheet: same given cells, every blank filled, and the print tables say the same
  const key = await keyRows();
  const ws = await page.evaluate(() => [...document.querySelectorAll('#worksheetTable tr')].slice(1)
    .map((tr) => [...tr.children].slice(1).map((c) => ({ text: c.textContent, cls: c.className }))));
  eq(ws.length, 30, 'thirty worksheet rows');
  const givenSame = ws.every((r, i) => r.every((c, j) => (c.cls === 'given' ? key[i][j].cls === 'given' && key[i][j].text === c.text : key[i][j].cls === 'answer' && c.text.trim() === '')));
  ok(givenSame, 'every given cell on the worksheet is the key\'s, and every blank is an answer there');
  eq(key.flatMap((r) => rowProblems(r.map((c) => c.text), { difficulty: 'hard', range: 'both', negatives: true })), [], 'the answer key\'s rows are all arithmetically right');
  await page.click('.tab-btn[data-view="key"]');
  await page.click('#printKeyBtn');
  const printed = await page.evaluate(() => ({
    ws: [...document.querySelectorAll('#printWorksheetTable tr')].map((tr) => tr.textContent),
    key: [...document.querySelectorAll('#printKeyTable tr')].map((tr) => tr.textContent),
    onScreenKey: [...document.querySelectorAll('#keyTable tr')].map((tr) => tr.textContent),
    onScreenWs: [...document.querySelectorAll('#worksheetTable tr')].map((tr) => tr.textContent)
  }));
  eq(printed.key, printed.onScreenKey, 'the printed key is the key on screen');
  eq(printed.ws, printed.onScreenWs, 'and the printed worksheet is the one on screen');

  // reload: the options come back, and so does the sheet, from the saved seed
  await page.reload({ waitUntil: 'domcontentloaded' });
  eq([await page.inputValue('#range'), await page.isChecked('#negatives')], ['both', true], 'reloading brings the controls back');

  // back to the defaults: the saved string drops the two fields again
  await page.selectOption('#range', 'proper');
  await page.uncheck('#negatives');
  await page.click('#generateBtn');
  const back = await page.evaluate(() => localStorage.getItem('fdp_settings_v1'));
  ok(!/range|negatives/.test(back), 'turned back off, the saved settings carry neither field again: ' + back);

  // locked seed + new option: the same seed gives a different, still valid sheet; and the same seed twice gives the same sheet
  const a = await load(base({ range: 'mixed', negatives: true, seed: 99, rowCount: 12 }));
  const b = await load(base({ range: 'mixed', negatives: true, seed: 99, rowCount: 12 }));
  eq(a, b, 'the same seed with the same options is the same sheet, twice');
  const c = await load(base({ range: 'mixed', seed: 99, rowCount: 12 }));
  ok(JSON.stringify(a) !== JSON.stringify(c), 'and switching the negatives option on changes it');
}

/* ── 6. a share link carries the options, only when on ───────────────────── */
{
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('fdp_settings_v1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const shareLink = async () => {
    await page.click('#shareBtn');
    await settle(page, 250);
    return page.evaluate(() => {
      let captured = null;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
      document.querySelector('.share-sheet button[data-share="copy"]').click();
      return new Promise((r) => setTimeout(() => { window.Share.close(); r(captured); }, 60));
    });
  };
  const payloadOf = (u) => page.evaluate((x) => window.StateLink.decodeState(new URL(x).searchParams.get('drill')), u);

  await page.selectOption('#difficulty', 'medium');
  await page.click('#generateBtn');
  const plain = await payloadOf(await shareLink());
  eq(Object.keys(plain), ['difficulty', 'givenForm', 'rowCount', 'seed'], 'a default sheet\'s link carries the same four fields as always');

  await page.selectOption('#range', 'mixed');
  await page.check('#negatives');
  await page.click('#generateBtn');
  const seedValue = await page.inputValue('#seedDisplay');
  const senderKey = await page.textContent('#keyTable');
  const link = await shareLink();
  const payload = await payloadOf(link);
  eq([payload.range, payload.negatives], ['mixed', true], 'a sheet using the options carries them');
  ok(JSON.stringify(payload).length < 140, 'and is still a short link: ' + JSON.stringify(payload).length + ' bytes');

  const receiver = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await receiver.goto(link, { waitUntil: 'domcontentloaded' });
  await settle(receiver, 300);
  eq(await receiver.textContent('#keyTable'), senderKey, 'the other device draws the same sheet and the same key');
  eq([await receiver.inputValue('#range'), await receiver.isChecked('#negatives')], ['mixed', true], 'with the controls set to match');
  eq(await receiver.inputValue('#seedDisplay'), seedValue, 'from the same seed');

  // junk in a link is the default, not a broken page
  const junk = await page.evaluate(() => window.StateLink.buildShareUrl('drill', { difficulty: 'easy', givenForm: 'random', rowCount: 8, seed: 5, range: '<img src=x onerror=alert(1)>', negatives: 'true' }));
  await receiver.goto(junk, { waitUntil: 'domcontentloaded' });
  await settle(receiver, 200);
  eq([await receiver.inputValue('#range'), await receiver.isChecked('#negatives')], ['proper', false], 'a link with nonsense for the options opens with the defaults');
  eq(receiver.__errs.length, 0, 'and without a console error');
  await receiver.context().close();
}

/* ── 7. on paper: one page for the sheet, one for the key ────────────────── */
{
  const pdfPages = async () => {
    const buf = await page.pdf({ format: 'Letter', printBackground: true });
    return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  };
  const printed = async (o) => {
    await load(base(o));
    await page.click('#printWorksheetBtn');
    return pdfPages();
  };
  // a 12-row sheet is one page of worksheet and one of key, with every option on
  for (const [range, negatives] of [['proper', undefined], ['improper', true], ['mixed', true], ['both', true]]) {
    eq(await printed({ range, negatives, rowCount: 12 }), 2, `${range}${negatives ? ' and negative' : ''}, 12 rows: one page for the worksheet and one for the key`);
  }
  // 30 rows already runs long on paper (it did before these options), and the options must not make it longer
  const oldLong = await printed({ rowCount: 30 });
  eq(oldLong, 4, 'the old 30-row sheet is as long as it always was');
  for (const [range, negatives] of [['both', true], ['mixed', true]]) {
    eq(await printed({ range, negatives, rowCount: 30 }), oldLong, `${range} and negative at 30 rows is no longer than the old sheet`);
  }
}

/* ── 8. axe on the new controls ──────────────────────────────────────────── */
{
  await load(base({ range: 'both', negatives: true, rowCount: 12 }));
  const v = await a11yScan(page, { impact: 'serious' });
  eq(v.map((x) => x.id), [], 'no serious or critical axe violation with the options on');
  const names = await page.evaluate(() => ['range', 'negatives'].map((id) => {
    const el = document.getElementById(id);
    return (el.labels && el.labels.length) ? el.labels[0].textContent.trim().replace(/\s+/g, ' ') : null;
  }));
  eq(names, ['Values', 'Include negative values'], 'both new controls have a visible label');
}

/* ── 9. no console noise ─────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
