// smoke-blank-order.mjs — Timeline Builder's worksheet that blanks dates (or
// both, or a chosen subset) and its printed ordering activity (cut-apart
// cards or a shuffled list, with a key page of its own).
//
//   node Tools/timeline-builder/test/smoke-blank-order.mjs
//
// The pure choosing and dealing is in smoke-blank-order-core.mjs. What needs a
// browser, and what is checked here:
//
//   1. A timeline saved before any of this prints the worksheet it always did:
//      golden-old-worksheet.json was recorded from the page before the change
//      (markup with the style attributes taken out, so a font difference on
//      another machine cannot fail it, plus the saved settings string). A
//      saved worksheet with none of the new fields is not rewritten with them.
//   2. Blanking dates: the strip, the list, the bank and the key agree on what
//      was blanked; a date blank is a ruled space wide enough to write in; the
//      year scale along the axis is left off the worksheet (it would answer the
//      blank) and kept on the key; the key marks what was asked for.
//   3. Both, every nth and "the ones I choose" behave, and a choice of nobody
//      refuses instead of printing an empty sheet.
//   4. The choices are saved with the timeline, come back when the panel is
//      reopened or the page reloaded, and ride a share link; what a hand-built
//      link puts in those fields is cleaned and nothing runs.
//   5. The ordering activity: dates never on a card or the list, every titled
//      event once and an untitled one never, the deal repeats for the same
//      seed and Reshuffle changes it, three events never come out in order,
//      the key is a page of its own and agrees with the cards.
//   6. Printing, read off Chromium's PDF on Letter and on A4: no card is
//      cut off (the longest title is whole on its card), the page count is the
//      sheets' count (no blank trailing page), every title is in the PDF text.
//   7. Keyboard and screen reader: the new controls are named, the panels pass
//      axe in every state, Reshuffle and the radios work from the keyboard and
//      Reshuffle says what it did.
//
// window.print is stubbed, as in the sibling suites; assertions read the built
// DOM, and the PDF checks print that DOM with page.pdf().
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { riverTimeline, smallTimeline, mk, seed } from './_fixtures.mjs';

const PORT = 8518;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/015-timeline-builder.html';
const dir = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tlb-blank-order-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = (name) => console.log('\n' + name);

const server = await serve(PORT);
const browser = await launch();
const pages = [];

/** A fresh page with `timeline` already in storage (or the example). */
async function open(timeline) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(page);
  page.__dialogs = [];
  page.on('dialog', d => { page.__dialogs.push(d.message()); d.accept(); });
  if (timeline) await seed(page, timeline);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.evaluate(() => { window.print = () => { window.__prints = (window.__prints || 0) + 1; }; });
  return page;
}

const storedState = (page) => page.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  return JSON.parse(localStorage.getItem('gvb-timeline:data:' + name));
});
const storedRaw = (page) => page.evaluate(() => localStorage.getItem('gvb-timeline:data:' + localStorage.getItem('gvb-timeline:current')));

async function printWorksheet(page, setup = {}) {
  if (!(await page.isVisible('#worksheetPanel'))) await page.click('#worksheetToggleBtn');
  if (setup.what) await page.selectOption('#wsBlankWhat', setup.what);
  if (setup.pick) await page.selectOption('#wsPick', setup.pick);
  if (setup.nth != null) await page.fill('#wsNth', String(setup.nth));
  if (setup.count != null) await page.fill('#wsBlankCount', String(setup.count));
  if (setup.versions != null) await page.selectOption('#wsVersions', String(setup.versions));
  if (setup.bank != null) await page.setChecked('#wsWordBank', setup.bank);
  if (setup.key != null) await page.setChecked('#wsAnswerKey', setup.key);
  if (setup.hand) {
    await page.selectOption('#wsPick', 'hand');
    for (const id of setup.hand) await page.check(`#wsHandList input[value="${id}"]`);
  }
  await page.click('#btnWorksheetGo');
  await settle(page, 500);
}

const wsOpen = async (page) => { if (!(await page.isVisible('#worksheetPanel'))) await page.click('#worksheetToggleBtn'); };

/** What one worksheet page says, read from its DOM, in print media (the
    sheets are not on screen until then, so nothing has a width before). */
const readSheets = async (page) => {
  await page.emulateMedia({ media: 'print' });
  const out = await readSheetsNow(page);
  await page.emulateMedia({ media: 'screen' });
  return out;
};
const readSheetsNow = (page) => page.evaluate(() => [].map.call(document.querySelectorAll('#worksheetPages .wsPage'), pg => {
  const lbls = [].map.call(pg.querySelectorAll('.event-label'), l => ({
    date: l.querySelector('.lbl-date').textContent.replace(/ /g, ' ').trim(),
    dateBlank: !!l.querySelector('.lbl-date .lbl-blank'),
    dateAnswer: !!l.querySelector('.lbl-date .lbl-answer'),
    title: l.querySelector('.lbl-title').textContent.replace(/ /g, ' ').trim(),
    titleBlank: !!l.querySelector('.lbl-title .lbl-blank'),
    titleAnswer: !!l.querySelector('.lbl-title .lbl-answer'),
    hasBadge: l.classList.contains('has-blank-badge')
  }));
  return {
    isKey: !!pg.querySelector('.wsKeyTag'),
    h2: pg.querySelector('h2').textContent,
    instructions: pg.querySelector('.wsInstructions').textContent,
    labels: lbls,
    gridLabels: pg.querySelectorAll('.grid-label').length,
    badges: pg.querySelectorAll('.blank-num').length,
    bankHtml: pg.querySelector('.wsBank') ? pg.querySelector('.wsBank').innerHTML : null,
    bankWords: [].map.call(pg.querySelectorAll('.wsBank .wsBankWord'), w => w.textContent),
    bankLabels: [].map.call(pg.querySelectorAll('.wsBank .wsBankLabel'), w => w.textContent),
    items: [].map.call(pg.querySelectorAll('.wsItem'), it => ({
      text: it.textContent.replace(/ /g, ' ').trim(),
      rules: it.querySelectorAll('.wsRule').length,
      answers: [].map.call(it.querySelectorAll('.wsAnswer'), a => a.textContent),
      ruleWidths: [].map.call(it.querySelectorAll('.wsRule'), r => r.getBoundingClientRect().width)
    })),
    text: pg.textContent
  };
}));

const riverDates = Object.fromEntries(riverTimeline().events.map(e => [e.id, e]));
// date labels as the page writes them, for the events used below
const LABEL = { 1: '2500 BCE', 2: '1200 BCE', 3: '300 BCE', 4: '40–55', 8: '1020', 9: '1480', 10: '1860', 11: '1921–1923', 12: '1974' };

console.log('Timeline Builder — blanking dates, and the ordering activity');

/* ── 1. a saved timeline from before prints what it always did ──────────── */
group('1. older timelines are unchanged');
{
  const golden = JSON.parse(fs.readFileSync(path.join(dir, 'golden-old-worksheet.json'), 'utf8'));
  const cases = [
    { id: 'river-default', tl: riverTimeline(), setup: {} },
    { id: 'river-3x2-nobank', tl: riverTimeline(), setup: { count: 3, versions: 2, bank: false, key: true, name: false } },
    { id: 'river-all-nokey', tl: riverTimeline(), setup: { count: 99, versions: 1, bank: true, key: false, name: true } },
    { id: 'river-saved-old', tl: Object.assign(riverTimeline(), { worksheet: { count: 4, versions: 3, wordBank: true, answerKey: true, nameLine: true } }), setup: {} },
    { id: 'example', tl: null, setup: {} }
  ];
  for (const c of cases) {
    const page = await open(c.tl);
    if (!c.tl) { await page.click('#loadExampleBtn'); await settle(page, 400); }
    await page.click('#worksheetToggleBtn');
    if (c.setup.count != null) await page.fill('#wsBlankCount', String(c.setup.count));
    if (c.setup.versions != null) await page.selectOption('#wsVersions', String(c.setup.versions));
    if (c.setup.bank != null) await page.setChecked('#wsWordBank', c.setup.bank);
    if (c.setup.key != null) await page.setChecked('#wsAnswerKey', c.setup.key);
    if (c.setup.name != null) await page.setChecked('#wsNameLine', c.setup.name);
    await page.click('#btnWorksheetGo');
    await settle(page, 500);
    const html = await page.evaluate(() => document.getElementById('worksheetPages').innerHTML.replace(/ style="[^"]*"/g, ''));
    const saved = (await storedState(page)).worksheet;
    ok(html === golden[c.id].html, `${c.id}: the printed worksheet is the one recorded before the change (${html.length} chars)`);
    eq(saved, golden[c.id].savedWorksheet, `${c.id}: the saved settings are the same five keys, nothing added`);
  }
  // opening the panel on a saved old worksheet writes nothing
  const page = await open(Object.assign(riverTimeline(), { worksheet: { count: 4, versions: 3, wordBank: true, answerKey: true, nameLine: true } }));
  const before = await storedRaw(page);
  await page.click('#worksheetToggleBtn');
  await page.click('#orderingToggleBtn');
  await page.click('#btnOrderingClose');
  eq(await storedRaw(page), before, 'opening the worksheet and ordering panels writes nothing to the saved timeline');
  eq(await page.inputValue('#wsBlankWhat'), 'title', 'an old worksheet opens on "Titles"');
  eq(await page.inputValue('#wsPick'), 'random', 'and on "picked at random"');
  eq(await page.inputValue('#wsBlankCount'), '4', 'with its own count');
}

/* ── 2. blanking dates ──────────────────────────────────────────────────── */
group('2. dates blanked');
{
  const page = await open(riverTimeline());
  await printWorksheet(page, { what: 'date', hand: [1, 3, 9, 11], bank: true, key: true });
  const [sheet, key] = await readSheets(page);
  ok(sheet && key && !sheet.isKey && key.isKey, 'a worksheet page and its key page');
  eq(sheet.labels.filter(l => l.dateBlank).length, 4, 'four dates are blank on the strip');
  eq(sheet.labels.filter(l => l.titleBlank).length, 0, 'no title is blank');
  eq(sheet.labels.length, 12, 'every other label is still there');
  const blanked = sheet.labels.filter(l => l.dateBlank).map(l => l.title);
  eq(blanked, ['First canal dug', 'Harbour wall <b>built</b>', 'Lock keepers’ strike', 'The "Great Drought"'], 'the blank dates are the picked events, along the strip');
  ok(sheet.labels.filter(l => !l.dateBlank).every(l => l.date.length > 0), 'the others still show their dates');
  eq(sheet.badges, 4, 'each blank has its numbered badge');
  eq(sheet.gridLabels, 0, 'the year scale along the axis is left off the worksheet');
  ok(key.gridLabels > 0, 'and kept on the key (' + key.gridLabels + ')');
  eq(sheet.items.length, 4, 'four lines to write on');
  eq(sheet.items.map(i => i.rules), [1, 1, 1, 1], 'each line is a ruled space');
  ok(sheet.items.every(i => i.ruleWidths[0] >= 140), 'each ruled space is wide enough for a date: ' + sheet.items.map(i => Math.round(i.ruleWidths[0])).join(','));
  ok(sheet.items.every((i, n) => i.text.startsWith((n + 1) + '. (')), 'each line is numbered and names the event whose date is asked for');
  ok(sheet.items[1].text.includes('Harbour wall <b>built</b>'), 'a title with markup in it is text, not markup');
  eq(await page.evaluate(() => document.querySelectorAll('#worksheetPages b').length), 0, 'no <b> element came out of that title');
  eq(sheet.bankLabels, ['Date bank:'], 'the bank is a date bank');
  eq(sheet.bankWords.slice().sort(), [LABEL[1], LABEL[3], LABEL[9], LABEL[11]].sort(), 'holding exactly the four removed dates');
  ok(![...sheet.items].some(i => /BCE|\d{4}/.test(i.text.replace(/\(.*\)/, ''))), 'no answer is already on a line');
  // the blanked dates appear nowhere on the student sheet but the bank
  const rest = sheet.text.replace(/Date bank:.*?(?=1\.)/s, '');
  ok(![LABEL[1], LABEL[3], LABEL[9]].some(d => rest.includes(d)), 'the removed dates are on the sheet only in the bank');
  // key
  eq(key.labels.filter(l => l.dateAnswer).length, 4, 'the key underlines the four dates asked for on the strip');
  eq(key.labels.filter(l => l.titleAnswer).length, 0, 'and no title');
  eq(key.labels.filter(l => l.dateBlank).length, 0, 'the key has no blanks left');
  eq(key.items.map(i => i.answers), [[LABEL[1]], [LABEL[3]], [LABEL[9]], [LABEL[11]]], 'the key lists the dates, in order');
  ok(/Blanked on this sheet: dates/.test(key.instructions), 'and says what was blanked: ' + key.instructions);
  eq(key.bankHtml, null, 'the key has no bank');

  // the other kinds of strip are untouched by dates being blank elsewhere
  await wsOpen(page);
  await page.selectOption('#wsBlankWhat', 'title');
  await page.selectOption('#wsPick', 'random');
  await page.fill('#wsBlankCount', '3');
  await page.click('#btnWorksheetGo'); await settle(page, 400);
  const [t1] = await readSheets(page);
  eq(t1.labels.filter(l => l.titleBlank).length, 3, 'switching back to titles blanks three titles');
  ok(t1.gridLabels > 0, 'and puts the year scale back');
  eq(t1.labels.filter(l => l.dateBlank).length, 0, 'with no date blank');
}

/* ── 3. both, every nth, the ones I choose ──────────────────────────────── */
group('3. both, nth, by hand');
{
  const page = await open(riverTimeline());
  await printWorksheet(page, { what: 'both', hand: [2, 4, 12] });
  const [sheet, key] = await readSheets(page);
  eq(sheet.labels.filter(l => l.titleBlank && l.dateBlank).length, 3, 'three labels have both blanked');
  eq(sheet.bankLabels, ['Titles:', 'Dates:'], 'a title bank and a date bank');
  eq(sheet.bankWords.length, 6, 'with three of each');
  eq(sheet.items.map(i => i.rules), [2, 2, 2], 'two ruled spaces per line, one for the title and one for the date');
  ok(sheet.items.every(i => i.ruleWidths[0] >= 200 && i.ruleWidths[1] >= 140), 'both long enough to write in: ' + sheet.items.map(i => i.ruleWidths.map(Math.round)).join(' | '));
  ok(/title and date/.test(sheet.instructions), 'the instructions ask for both: ' + sheet.instructions);
  eq(key.labels.filter(l => l.titleAnswer && l.dateAnswer).length, 3, 'the key marks the title and the date');
  eq(key.items.map(i => i.answers), [['Salt road opened', LABEL[2]], ['Bridge of Orn', LABEL[4]], ['Dam opened', LABEL[12]]], 'and lists both');
  ok(/Blanked on this sheet: titles and dates/.test(key.instructions), 'and says so');
  // the banks are not pairable by position
  const titles = sheet.bankWords.slice(0, 3), dates = sheet.bankWords.slice(3);
  const byTitle = { 'Salt road opened': LABEL[2], 'Bridge of Orn': LABEL[4], 'Dam opened': LABEL[12] };
  ok(!titles.every((t, i) => byTitle[t] === dates[i]), 'bank position does not pair a title with its date');

  // every nth
  await wsOpen(page);
  await page.selectOption('#wsBlankWhat', 'title');
  await page.selectOption('#wsPick', 'nth');
  await page.fill('#wsNth', '3');
  await page.selectOption('#wsVersions', '3');
  await page.click('#btnWorksheetGo'); await settle(page, 600);
  const allSheets = await readSheets(page);
  const sheets = allSheets.filter(s => !s.isKey);
  eq(sheets.length, 3, 'three versions');
  eq(sheets.map(s => s.labels.filter(l => l.titleBlank).length), [4, 4, 3], 'blank titles on the strip: 4, 4 and 3');
  // what was blanked is read off each version's key, which lists the titles
  const blankTitles = allSheets.filter(s => s.isKey).map(s => s.items.map(i => i.answers[0]));
  eq(blankTitles[0], ['First canal dug', 'Bridge of Orn', 'Ferry guild founded & chartered', 'The "Great Drought"'], 'version 1: every 3rd titled event from the first');
  eq(blankTitles[1][0], 'Salt road opened', 'version 2 starts one event later');
  const all = new Set(blankTitles.flat());
  eq(all.size, 11, 'three versions of every 3rd cover every titled event');
  ok(blankTitles.flat().length === 11, 'and none twice');
  eq(await page.inputValue('#wsBlankCount') !== '', true, 'the count box is still there');
  ok(await page.isDisabled('#wsBlankCount'), 'but is switched off while counting by nth');
  await wsOpen(page);
  ok(await page.isVisible('#wsNth') && !(await page.isVisible('#wsHandBox')), 'only the nth box shows');

  // by hand
  await wsOpen(page);
  await page.selectOption('#wsPick', 'hand');
  ok(await page.isVisible('#wsHandBox') && !(await page.isVisible('#wsNth')), 'only the list of events shows');
  eq(await page.locator('#wsHandList input').count(), 11, 'the list holds the eleven titled events');
  eq(await page.locator('#wsHandList input:checked').count(), 0, 'none ticked to start with');
  const names = await page.locator('#wsHandList label').allTextContents();
  ok(names[0].includes('First canal dug') && names[0].includes('2500 BCE'), 'each is named by title and date: ' + names[0]);
  ok(names.every(n => !n.includes('<b>') || n.includes('Harbour wall <b>built</b>')), 'a title with markup is listed as text');
  eq(await page.evaluate(() => document.querySelectorAll('#wsHandList b').length), 0, 'no markup came out of the list');
  const builtBefore = await page.evaluate(() => document.getElementById('worksheetPages').innerHTML);
  await page.click('#btnWorksheetGo');
  eq(page.__dialogs.at(-1), 'Choose at least one event to blank out.', 'printing with nobody chosen says so');
  ok(builtBefore === await page.evaluate(() => document.getElementById('worksheetPages').innerHTML), 'and builds nothing');
  for (const id of [5, 6, 8, 9]) await page.check(`#wsHandList input[value="${id}"]`);
  ok(/4 of 11 events will have its title blanked out/.test(await page.textContent('#wsCountNote')), 'the note counts them: ' + await page.textContent('#wsCountNote'));
  await page.selectOption('#wsVersions', '2');
  ok(/same events/.test(await page.textContent('#wsCountNote')), 'and says the versions blank the same ones');
  await page.click('#btnWorksheetGo'); await settle(page, 500);
  const hall = await readSheets(page);
  const hs = hall.filter(s => !s.isKey);
  eq(hall.filter(s => s.isKey).map(s => s.items.map(i => i.answers[0])), [['Market charter', 'Flood of the lower fields', 'Ferry guild founded & chartered', 'Lock keepers’ strike'], ['Market charter', 'Flood of the lower fields', 'Ferry guild founded & chartered', 'Lock keepers’ strike']], 'both versions blank the four picked events');
  eq(hs.map(s => s.labels.filter(l => l.titleBlank).length), [4, 4], 'four blank titles on each strip');
  ok(hs[0].bankWords.join() !== hs[1].bankWords.join(), 'with the bank shuffled differently');
}

/* ── 4. saved, restored, shared ─────────────────────────────────────────── */
group('4. saved with the timeline');
{
  const page = await open(riverTimeline());
  await printWorksheet(page, { what: 'both', pick: 'nth', nth: 4, versions: 2 });
  let ws = (await storedState(page)).worksheet;
  eq([ws.kind, ws.pick, ws.nth, ws.hand], ['both', 'nth', 4, undefined], 'kind, pick and nth are saved with the timeline');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.click('#worksheetToggleBtn');
  eq([await page.inputValue('#wsBlankWhat'), await page.inputValue('#wsPick'), await page.inputValue('#wsNth'), await page.inputValue('#wsVersions')], ['both', 'nth', '4', '2'], 'a reload reopens the worksheet as it was set up');
  await page.selectOption('#wsPick', 'hand');
  await page.check('#wsHandList input[value="8"]');
  await page.check('#wsHandList input[value="1"]');
  ws = (await storedState(page)).worksheet;
  eq(ws.hand, [1, 8], 'ticking events is saved at once, by id, in strip order');
  eq(ws.nth, undefined, 'and the nth is dropped when the pick is by hand');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.click('#worksheetToggleBtn');
  eq(await page.locator('#wsHandList input:checked').evaluateAll(b => b.map(x => x.value)), ['1', '8'], 'the ticks come back after a reload');
  await page.selectOption('#wsBlankWhat', 'title');
  await page.selectOption('#wsPick', 'random');
  ws = (await storedState(page)).worksheet;
  eq(Object.keys(ws).sort(), ['answerKey', 'count', 'nameLine', 'versions', 'wordBank'], 'choosing the old defaults again writes the old five keys and nothing else');

  // an event that is later deleted leaves a stale id in the picks
  const stale = await open(Object.assign(riverTimeline(), { worksheet: { count: 3, versions: 1, wordBank: true, answerKey: true, nameLine: true, kind: 'date', pick: 'hand', hand: [1, 999] } }));
  await stale.click('#worksheetToggleBtn');
  eq(await stale.locator('#wsHandList input:checked').count(), 1, 'a stale id is simply not ticked');
  await stale.click('#btnWorksheetGo'); await settle(stale, 400);
  const [s0] = await readSheets(stale);
  eq(s0.labels.filter(l => l.dateBlank).length, 1, 'and prints the one that exists');

  // share link
  const shared = Object.assign(riverTimeline(), {
    worksheet: { count: 5, versions: 2, wordBank: true, answerKey: true, nameLine: true, kind: 'date', pick: 'nth', nth: 3 },
    ordering: { kind: 'list', answerKey: false, nameLine: true, seed: 17 }
  });
  const sender = await open(shared);
  const link = await sender.evaluate(async () => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
    document.getElementById('shareBtn').click();
    for (let i = 0; i < 100 && !document.querySelector('.share-sheet button[data-share="copy"]'); i++) await new Promise(r => setTimeout(r, 20));
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    window.Share.close();
    return captured;
  });
  ok(!!link && link.includes('timeline='), 'the Copy link row makes a link');
  const receiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(receiver);
  await receiver.goto(link, { waitUntil: 'networkidle' });
  await settle(receiver, 600);
  const got = await storedState(receiver);
  eq(got.worksheet, shared.worksheet, 'the link carries the worksheet choices');
  eq(got.ordering, shared.ordering, 'and the ordering choices with the seed');
  await receiver.evaluate(() => { window.print = () => {}; });
  await receiver.click('#worksheetToggleBtn');
  eq([await receiver.inputValue('#wsBlankWhat'), await receiver.inputValue('#wsPick'), await receiver.inputValue('#wsNth')], ['date', 'nth', '3'], 'which open as the sender set them');
  await receiver.click('#orderingToggleBtn');
  ok(await receiver.isChecked('#ordKindList') && !(await receiver.isChecked('#ordAnswerKey')), 'and the ordering panel too');
  ok(/shuffle number 17/.test(await receiver.textContent('#ordNote')), 'shuffle 17 is named');

  // a timeline from before has neither field, and a link of it adds neither
  const oldLink = Object.assign(riverTimeline('Old link'), { worksheet: { count: 4, versions: 1, wordBank: true, answerKey: true, nameLine: true } });
  const oldSender = await open(oldLink);
  const link2 = await oldSender.evaluate(async () => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
    document.getElementById('shareBtn').click();
    for (let i = 0; i < 100 && !document.querySelector('.share-sheet button[data-share="copy"]'); i++) await new Promise(r => setTimeout(r, 20));
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    window.Share.close();
    return captured;
  });
  const oldReceiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(oldReceiver);
  await oldReceiver.goto(link2, { waitUntil: 'networkidle' });
  await settle(oldReceiver, 600);
  const og = await storedState(oldReceiver);
  eq(og.worksheet, oldLink.worksheet, 'a link from a timeline that never blanked dates carries the old worksheet as it was');
  eq(og.ordering, undefined, 'and no ordering field');

  // hostile fields from a hand-built link
  const evil = Object.assign(riverTimeline('Evil'), {
    worksheet: { count: 3, versions: 1, wordBank: true, answerKey: true, nameLine: true, kind: '<img src=x onerror="window.__pwned=1">', pick: '<svg onload=window.__pwned=1>', nth: 'q', hand: ['<img src=x onerror=window.__pwned=2>', 1] },
    ordering: { kind: '<img src=x onerror=window.__pwned=3>', seed: '<script>window.__pwned=4</script>', answerKey: 'no', nameLine: {} }
  });
  const e = await open(evil);
  await e.click('#worksheetToggleBtn');
  eq([await e.inputValue('#wsBlankWhat'), await e.inputValue('#wsPick'), await e.inputValue('#wsNth')], ['title', 'random', '2'], 'unknown kinds and picks open as the defaults');
  await e.click('#btnWorksheetGo'); await settle(e, 400);
  await e.click('#orderingToggleBtn');
  ok(await e.isChecked('#ordKindCards'), 'an unknown ordering kind is cards');
  ok(/shuffle number 1\./.test(await e.textContent('#ordNote')), 'an unusable seed is shuffle 1: ' + await e.textContent('#ordNote'));
  await e.click('#btnOrderingGo'); await settle(e, 400);
  eq(await e.evaluate(() => window.__pwned), undefined, 'nothing ran');
  eq(await e.evaluate(() => document.querySelectorAll('#orderingPages img, #orderingPages svg, #orderingPages script, #worksheetPages script').length), 0, 'and no element came from those fields');
}

/* ── 5. the ordering activity ───────────────────────────────────────────── */
group('5. ordering activity');
{
  const page = await open(riverTimeline());
  await page.click('#orderingToggleBtn');
  ok(/11 events, dealt with shuffle number 1/.test(await page.textContent('#ordNote')), 'the panel says how many events and which shuffle: ' + await page.textContent('#ordNote'));
  await page.click('#btnOrderingGo'); await settle(page, 400);
  const read = () => page.evaluate(() => {
    const pgs = [...document.querySelectorAll('#orderingPages .ordPage')];
    return pgs.map(pg => ({
      isKey: !!pg.querySelector('.ordKeyTag'),
      h2: pg.querySelector('h2').textContent,
      cards: [...pg.querySelectorAll('.ordCard')].map(c => ({ label: c.querySelector('.ordLabel').textContent, title: c.querySelector('.ordTitle').textContent, text: c.textContent, children: c.querySelectorAll('*').length })),
      rows: [...pg.querySelectorAll('.ordRow')].map(r => ({ num: r.querySelector('.ordRowNum').textContent, title: r.querySelector('.ordRowTitle').textContent, text: r.textContent.replace(/ /g, ' '), box: !!r.querySelector('.ordBox') })),
      keyItems: [...pg.querySelectorAll('.ordKeyItem')].map(k => k.textContent),
      text: pg.textContent,
      name: pg.querySelector('.ordSub').textContent
    }));
  });
  const first = await read();
  const cardPages = first.filter(p => !p.isKey), keyPages = first.filter(p => p.isKey);
  eq(keyPages.length, 1, 'one key page');
  ok(first.at(-1).isKey, 'and it is the last page, a page of its own');
  ok(cardPages.every(p => p.cards.length > 0 && p.keyItems.length === 0), 'no card page carries a key line');
  const cards = cardPages.flatMap(p => p.cards);
  eq(cards.length, 11, 'eleven cards: one per titled event');
  ok(!cards.some(c => c.title === ''), 'the untitled event has no card');
  eq(cards.map(c => c.label), cards.map((_, i) => String(i + 1)), 'numbered 1..11 in the order dealt');
  ok(cards.every(c => c.text === c.label + c.title && c.children === 2), 'a card is its number and its title and nothing else');
  const allDates = Object.values(riverDates).map(e => e.displayDate || null).filter(Boolean).concat(Object.values(LABEL));
  ok(!cardPages.some(p => allDates.some(d => p.text.includes(d) && !cards.some(c => c.title.includes(d)))), 'no date is on any card page');
  ok(!cardPages.some(p => /\bBCE\b|\d{4}/.test(p.text)), 'no year on any card page');
  eq(await page.evaluate(() => document.querySelectorAll('#orderingPages b').length), 0, 'markup in a title stays text');
  const seedNow = (await storedState(page)).ordering;
  eq(seedNow, { kind: 'cards', answerKey: true, nameLine: true, seed: 1 }, 'printing stores the ordering choices with the timeline');
  // the deal is the module's deal for that seed
  const want = await page.evaluate(() => TimelineWorksheet.deal(JSON.parse(localStorage.getItem('gvb-timeline:data:Rivers')).events, 1).cards.map(c => c.event.title));
  eq(cards.map(c => c.title), want, 'the cards are the deal for that seed');
  const chrono = ['First canal dug', 'Salt road opened', 'Harbour wall <b>built</b>', 'Bridge of Orn', 'Market charter', 'Flood of the lower fields', 'Ferry guild founded & chartered', 'Lock keepers’ strike', 'Steam dredger arrives', 'The "Great Drought"', 'Dam opened'];
  ok(cards.map(c => c.title).join('|') !== chrono.join('|'), 'and not in the right order');
  // key
  const key = keyPages[0];
  eq(key.keyItems.length, 11, 'the key has eleven lines');
  ok(key.keyItems.every((k, i) => k.startsWith((i + 1) + '. ' + chrono[i] + ' (')), 'in the right order');
  ok(key.keyItems[0].includes('(2500 BCE)') && key.keyItems[3].includes('(40–55)') && key.keyItems[4].includes('(Autumn 410)'), 'with the dates the cards left off');
  ok(key.keyItems[4].includes('*') && key.keyItems[5].includes('*') && !key.keyItems[3].includes('*'), 'two events in one year are marked, the rest are not');
  ok(/may go either way round/.test(key.text), 'and the key says what the mark means');
  ok(key.keyItems.every(k => { const m = k.match(/card (\d+)$/); const t = k.replace(/^\d+\. /, '').replace(/ \(.*$/, ''); return m && cards[Number(m[1]) - 1].title === t; }), 'every key line names the card that holds its event');
  ok(/ANSWER KEY — TEACHER COPY/.test(key.text) && /answer key/.test(key.h2), 'marked as the teacher copy');
  ok(cardPages[0].name.includes('Name'), 'the cards have a name line');

  // repeat: same seed, same paper
  const html1 = await page.evaluate(() => document.getElementById('orderingPages').innerHTML);
  await page.click('#orderingToggleBtn');
  await page.click('#btnOrderingGo'); await settle(page, 400);
  ok(html1 === await page.evaluate(() => document.getElementById('orderingPages').innerHTML), 'printing again gives the same paper, byte for byte');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#orderingToggleBtn');
  await page.click('#btnOrderingGo'); await settle(page, 400);
  ok(html1 === await page.evaluate(() => document.getElementById('orderingPages').innerHTML), 'and after a reload');

  // reshuffle
  await page.click('#orderingToggleBtn');
  await page.click('#btnOrdReshuffle');
  eq((await storedState(page)).ordering.seed, 2, 'Reshuffle moves to the next seed and stores it');
  ok(/Reshuffled\. Now on shuffle number 2\./.test(await page.textContent('#ordStatus')), 'and says so: ' + await page.textContent('#ordStatus'));
  ok(/shuffle number 2/.test(await page.textContent('#ordNote')), 'the note follows');
  await page.click('#btnOrderingGo'); await settle(page, 400);
  const html2 = await page.evaluate(() => document.getElementById('orderingPages').innerHTML);
  ok(html2 !== html1, 'the new paper is different');
  const cards2 = (await read()).filter(p => !p.isKey).flatMap(p => p.cards).map(c => c.title);
  ok(cards2.join('|') !== cards.map(c => c.title).join('|') && cards2.join('|') !== chrono.join('|'), 'in its deal, and still not in order');

  // list
  await page.click('#orderingToggleBtn');
  await page.check('#ordKindList');
  await page.uncheck('#ordNameLine');
  await page.click('#btnOrderingGo'); await settle(page, 400);
  const list = await read();
  eq(list.length, 2, 'a list is one page and its key');
  eq(list[0].rows.length, 11, 'eleven rows');
  ok(list[0].rows.every((r, i) => r.num === (i + 1) + '.' && r.box && /Order:/.test(r.text)), 'each numbered, with a box to write in');
  ok(!/\d{4}|BCE/.test(list[0].text), 'no date on the list');
  ok(!list[0].name.includes('Name'), 'the name line can be switched off');
  ok(list[0].rows.map(r => r.title).join('|') === cards2.join('|'), 'the list is the same deal as the cards for that seed');
  ok(/\(\d+\)|no\. \d+/.test(list[1].keyItems[0]) && /no\. \d+$/.test(list[1].keyItems[0]), 'the key names list numbers, not cards');
  eq((await storedState(page)).ordering, { kind: 'list', answerKey: true, nameLine: false, seed: 2 }, 'the kind and the name line are saved');
  await page.click('#orderingToggleBtn');
  await page.uncheck('#ordAnswerKey');
  await page.click('#btnOrderingGo'); await settle(page, 400);
  eq((await read()).length, 1, 'without the key box there is no key page');

  // three events: never in order, however often Reshuffle is pressed
  const tri = await open(smallTimeline(3));
  let inOrder = 0, seen = new Set();
  await tri.click('#orderingToggleBtn');
  for (let i = 0; i < 14; i++) {
    await tri.click('#btnOrderingGo'); await settle(tri, 120);
    const titles = await tri.evaluate(() => [...document.querySelectorAll('#orderingPages .ordCard .ordTitle')].map(t => t.textContent));
    if (titles.join() === 'Event A,Event B,Event C') inOrder++;
    seen.add(titles.join());
    await tri.click('#orderingToggleBtn');
    await tri.click('#btnOrdReshuffle');
  }
  eq(inOrder, 0, 'three events: fourteen reshuffles, never in order');
  ok(seen.size >= 4, 'and several different orders: ' + [...seen].join(' / '));

  // too few
  const one = await open(smallTimeline(1));
  await one.click('#orderingToggleBtn');
  ok(/at least two events/.test(await one.textContent('#ordNote')), 'one event: the panel says it needs two');
  await one.click('#btnOrderingGo');
  ok(/at least two events/.test(one.__dialogs.at(-1) || ''), 'and printing says so');
  eq(await one.evaluate(() => document.getElementById('orderingPages').children.length), 0, 'and builds nothing');
}

/* ── 6. printing: nothing cut off, no blank page ────────────────────────── */
group('6. print layout');
const longTitle = 'The committee of the lower river wards formally resolved, after three years of argument and two failed votes, to carry the whole of the northern levee works across the old toll road and onward to the sea';
const unbroken = 'Supercalifragilisticexpialidocious' + 'Pneumonoultramicroscopic'.repeat(2);
const longTimeline = {
  name: 'Long', title: 'Long Titles', lineStyle: 'solid', compactLabels: false, scaleMode: 'linear', eras: [], tracks: [{ id: 0, name: 'Main' }],
  events: [
    mk(1, 'Short one', 1800), mk(2, longTitle, 1810), mk(3, 'A middling title for a card', 1820), mk(4, unbroken, 1830),
    mk(5, 'Fifth', 1840), mk(6, 'Sixth event of the set', 1850), mk(7, 'Seventh', 1860), mk(8, 'Eighth event', 1870),
    mk(9, 'Ninth', 1880), mk(10, 'Tenth event of the set', 1890), mk(11, 'Eleventh', 1900), mk(12, 'Twelfth', 1910),
    mk(13, 'Thirteenth', 1920), mk(14, 'Fourteenth', 1930), mk(15, 'Fifteenth', 1940), mk(16, 'Sixteenth', 1950),
    mk(17, 'Seventeenth', 1960), mk(18, 'Eighteenth', 1970), mk(19, 'Nineteenth', 1980), mk(20, 'Twentieth', 1990)
  ]
};
{
  const norm = (t) => t.replace(/\s+/g, '').toLowerCase();
  for (const paper of ['Letter', 'A4']) {
    const page = await open(longTimeline);
    await page.click('#orderingToggleBtn');
    await page.click('#btnOrderingGo'); await settle(page, 500);
    await page.evaluate((paper) => { document.getElementById('tiledPageSizeStyle').textContent = '@page { size: ' + paper + ' landscape; margin: 0.4in; }'; }, paper);
    await page.emulateMedia({ media: 'print' });
    const m = await page.evaluate(() => {
      const pages = [...document.querySelectorAll('#orderingPages .ordPage')];
      const cards = [...document.querySelectorAll('#orderingPages .ordCard')];
      const bad = cards.filter(c => {
        const r = c.getBoundingClientRect(), t = c.querySelector('.ordTitle');
        const range = document.createRange(); range.selectNodeContents(t);
        const tr = range.getBoundingClientRect();
        return c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1 || tr.bottom > r.bottom + 0.5 || tr.right > r.right + 0.5 || tr.left < r.left - 0.5 || tr.top < r.top - 0.5;
      }).length;
      const grids = [...document.querySelectorAll('#orderingPages .ordGrid')];
      const heights = cards.map(c => Math.round(c.getBoundingClientRect().height));
      const widths = cards.map(c => Math.round(c.getBoundingClientRect().width));
      return {
        pageCount: pages.length, cards: cards.length, bad,
        sameSize: new Set(heights).size === 1 && new Set(widths).size === 1,
        cols: grids[0] ? getComputedStyle(grids[0]).gridTemplateColumns.split(' ').length : 0,
        gridBottom: Math.max(...grids.map(g => g.getBoundingClientRect().height)),
        gridWidth: Math.max(...grids.map(g => g.getBoundingClientRect().width)),
        cardH: heights[0], longestTitleLines: Math.round(cards.find(c => c.textContent.includes('committee')).getBoundingClientRect().height)
      };
    });
    eq(m.cards, 20, `${paper}: all twenty cards`);
    eq(m.bad, 0, `${paper}: no card is cut off, the longest title is whole on its card`);
    ok(m.sameSize, `${paper}: every card is the same size, so they cut and stack alike (${m.cardH}px)`);
    ok(m.gridWidth <= 960 + 2, `${paper}: the grid fits the 10in the page is built to (${Math.round(m.gridWidth)}px)`);
    ok(m.gridBottom <= 6.2 * 96 + 4, `${paper}: a page of cards fits the height budgeted for it (${Math.round(m.gridBottom)}px)`);
    const pdf = path.join(tmp, `ordering-${paper}.pdf`);
    await page.pdf({ path: pdf, preferCSSPageSize: true });
    const pdfPages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1]);
    eq(pdfPages, m.pageCount, `${paper}: the PDF has one page per sheet built, so no blank trailing page (${m.pageCount})`);
    const text = norm(execFileSync('pdftotext', ['-raw', pdf, '-']).toString());
    ok(text.includes(norm(longTitle)), `${paper}: the longest title is in the PDF text, whole`);
    ok(text.includes(norm(unbroken)), `${paper}: and so is the unbroken one`);
    const sizeLine = execFileSync('pdfinfo', [pdf]).toString().match(/Page size:\s+([\d.]+) x ([\d.]+)/);
    ok(paper === 'A4' ? Math.abs(Number(sizeLine[1]) - 841.9) < 2 : Math.abs(Number(sizeLine[1]) - 792) < 2, `${paper}: printed on that paper (${sizeLine[1]} x ${sizeLine[2]} pt)`);

    // the list at the same length of title
    await page.emulateMedia({ media: 'screen' });
    await page.click('#orderingToggleBtn');
    await page.check('#ordKindList');
    await page.click('#btnOrderingGo'); await settle(page, 500);
    await page.evaluate((paper) => { document.getElementById('tiledPageSizeStyle').textContent = '@page { size: ' + paper + ' landscape; margin: 0.4in; }'; }, paper);
    await page.emulateMedia({ media: 'print' });
    const lpdf = path.join(tmp, `ordering-list-${paper}.pdf`);
    const sheets = await page.evaluate(() => document.querySelectorAll('#orderingPages .ordPage').length);
    await page.pdf({ path: lpdf, preferCSSPageSize: true });
    const lpages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [lpdf]).toString())[1]);
    const ltext = norm(execFileSync('pdftotext', ['-raw', lpdf, '-']).toString());
    ok(ltext.includes(norm(longTitle)) && ltext.includes(norm(unbroken)), `${paper}: the list holds both long titles whole`);
    ok(lpages >= sheets && lpages <= sheets + 2, `${paper}: a list of twenty is ${lpages} PDF pages for ${sheets} sheets (a long list may run to a second page, never a blank one)`);
    const blank = [];
    for (let p = 1; p <= lpages; p++) {
      const t = execFileSync('pdftotext', ['-f', String(p), '-l', String(p), lpdf, '-']).toString().trim();
      if (!t) blank.push(p);
    }
    eq(blank, [], `${paper}: no page of the list is blank`);
    await page.emulateMedia({ media: 'screen' });
  }

  // the worksheets that blank dates print on exactly their sheets, too
  for (const setup of [{ what: 'date', count: 4 }, { what: 'both', pick: 'nth', nth: 3, versions: 2 }]) {
    const page = await open(riverTimeline());
    await printWorksheet(page, setup);
    await page.emulateMedia({ media: 'print' });
    const n = await page.evaluate(() => document.querySelectorAll('#worksheetPages .wsPage').length);
    const pdf = path.join(tmp, `ws-${setup.what}.pdf`);
    await page.pdf({ path: pdf, preferCSSPageSize: true });
    const pdfPages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1]);
    eq(pdfPages, n, `${setup.what}${setup.pick ? ' by nth' : ''}: ${n} sheets are ${n} PDF pages, none blank`);
    const t = execFileSync('pdftotext', [pdf, '-']).toString();
    ok(/Date bank|Dates:/.test(t) && /ANSWER KEY/.test(t), `${setup.what}: the PDF text has the bank and the key`);
  }
}

/* ── 7. keyboard and screen reader ──────────────────────────────────────── */
group('7. keyboard and screen reader');
{
  const page = await open(riverTimeline());
  // every new control has a name
  await page.click('#worksheetToggleBtn');
  for (const [sel, name] of [['#wsBlankWhat', 'What to blank out'], ['#wsPick', 'Which events']]) {
    ok(await page.getByLabel(name, { exact: true }).count() === 1, `"${name}" names its control`);
  }
  await page.selectOption('#wsPick', 'nth');
  ok(await page.getByLabel('Blank every', { exact: true }).count() === 1, '"Blank every" names the nth box');
  await page.selectOption('#wsPick', 'hand');
  eq(await page.locator('#wsHandBox legend').textContent(), 'Events to blank out', 'the list of events is a group with a legend');
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('#wsHandList input')].filter(i => !i.closest('label') || !i.closest('label').textContent.trim()).length);
  eq(unnamed, 0, 'every tick box is inside a label that names its event');
  // keyboard: tick with Space, switch pick with the arrow keys
  await page.focus('#wsHandList input');
  await page.keyboard.press('Space');
  eq(await page.locator('#wsHandList input:checked').count(), 1, 'Space ticks an event');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  eq(await page.locator('#wsHandList input:checked').count(), 2, 'Tab moves to the next, Space ticks it');
  eq((await storedState(page)).worksheet.hand.length, 2, 'and the picks are saved');
  await page.focus('#wsPick');
  await page.keyboard.press('ArrowUp');
  const keyed = await page.inputValue('#wsPick');
  ok(keyed !== 'hand', 'the arrow keys change Which events (now ' + keyed + ')');
  for (const [pick, what] of [['random', 'title'], ['nth', 'date'], ['hand', 'both']]) {
    await page.selectOption('#wsPick', pick);
    await page.selectOption('#wsBlankWhat', what);
    const v = await a11yScan(page, { include: '#worksheetPanel' });
    eq(v, [], `axe: the worksheet panel with ${what} / ${pick}: ` + JSON.stringify(v));
  }
  // ordering panel
  await page.click('#btnWorksheetClose');
  await page.click('#orderingToggleBtn');
  eq(await page.locator('fieldset.ordKindSet legend').textContent(), 'Print as', 'the two ways to print are a radio group with a legend');
  ok(await page.getByLabel('Cut-apart cards').count() === 1 && await page.getByLabel('Numbered list').count() === 1, 'each radio has its name');
  await page.focus('#ordKindCards');
  await page.keyboard.press('ArrowDown');
  ok(await page.isChecked('#ordKindList'), 'the arrow keys move between the radios');
  eq((await storedState(page)).ordering.kind, 'list', 'and the choice is saved');
  await page.focus('#btnOrdReshuffle');
  await page.keyboard.press('Enter');
  ok(/Reshuffled\. Now on shuffle number 2\./.test(await page.textContent('#ordStatus')), 'Reshuffle works from the keyboard and says what it did');
  eq(await page.getAttribute('#ordStatus', 'aria-live'), 'polite', 'in a polite live region');
  eq(await page.getAttribute('#ordStatus', 'role'), 'status', 'with the status role');
  const ov = await a11yScan(page, { include: '#orderingPanel' });
  eq(ov, [], 'axe: the ordering panel: ' + JSON.stringify(ov));
  await page.focus('#btnOrderingGo');
  await page.keyboard.press('Enter'); await settle(page, 300);
  ok((await page.evaluate(() => window.__prints || 0)) >= 1, 'Print ordering activity is a button the keyboard can press');
}

/* ── no console noise, nothing left the site ─────────────────────────────── */
for (const [i, p] of pages.entries()) {
  if (p.__errs.length) ok(false, `no page/console errors (page ${i}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  if (p.__blocked.length) ok(false, `nothing left the site (page ${i}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}
ok(true, 'no page or console errors, nothing left the site, on ' + pages.length + ' pages');

await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
