// smoke-weeks.mjs — the School Calendar Visualizer's year-grid A/B badges and its printed weeks,
// on the real page.
//
//   node Tools/school-calendar/test/smoke-weeks.mjs
//   SCV_GROUPS=golden,badges node ...       (a subset: golden, badges, range, print, a11y)
//
// What is held:
//   golden  A calendar from before this change opens and prints as it did: the month grid, the
//           year grid with the cycle off, the one-week strip for seven weeks, with and without the
//           A/B cycle, and the stored string, all as hashes recorded from the old page
//           (golden-old-views.json), in three zones.
//   badges  With the A/B cycle on, every school day of the year grid says its letter, as text, and
//           the letter is the month grid's; a weekday with no school says so with an en dash on a
//           hatched cell; a weekend says nothing; with the cycle off nothing changes.
//   range   "Week of" through "the week of" gives a page per week, Monday to Friday, whatever the
//           machine's zone, across the two daylight-saving weeks of a year; each day holds what the
//           tool holds for it; blank, bad and reversed ends fall back to one week; sixty at most.
//   print   Read off Chromium's PDF with pdftotext at Letter, A4, Legal and Tabloid, in both
//           orientations: one PDF page per week, in order, none blank, none clipped, none trailing.
//   a11y    axe on the week controls and the printed range; the controls are real, labelled controls.
//
// The page clock is pinned to an instant and the context to a zone; run it once with TZ=UTC in front.
// Everything here is made up. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, launch, a11yScan } from '../../board-check/harness.mjs';
import { newPinnedPage, captureViews, ZONE } from './_capture-views.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8527;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE_FILE = process.env.SCV_PAGE_FILE || '032-School%20Calendar%20Visualizer.html';
const URL_PAGE = `${BASE}/Tools/${PAGE_FILE}`;
const GROUPS = new Set((process.env.SCV_GROUPS || 'golden,badges,range,print,a11y').split(','));
/* noon on Wed 2026-09-16 on the wall clocks of each zone, so "today" is the same date in all three */
const NOON = { 'America/New_York': '2026-09-16T12:00:00-04:00', 'UTC': '2026-09-16T12:00:00Z', 'Pacific/Auckland': '2026-09-16T12:00:00+12:00' };
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'golden-old-views.json'), 'utf8'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; if (fails.length < 60) fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'scv-weeks-'));
const settle = (page, ms = 200) => page.waitForTimeout(ms);

/* ── arithmetic that never calls Date, for the expectations ────────────── */
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}
const dn = (iso) => { const [y, m, d] = iso.split('-').map(Number); return daysFromCivil(y, m, d); };
const fromDn = (n) => { const [y, m, d] = civilFromDays(n); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const dowOf = (iso) => ((dn(iso) % 7) + 11) % 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };

/* ── helpers on the page ───────────────────────────────────────────────── */
const open = async (zone = ZONE) => {
  const page = await newPinnedPage(browser, BASE, { timezoneId: zone });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
};
/* the seeded calendar, written to disk by the page itself (it saves nothing until something changes) */
const persistSeed = async (page) => {
  await page.click('#btnApplyMeta');
  await settle(page, 300);
};
const enableAb = async (page, anchor = '2026-08-31', letter = 'A') => {
  await page.check('#abEnable');
  await page.fill('#abAnchorDate', anchor);
  await page.selectOption('#abAnchorLetter', letter);
  await page.click('#btnApplyAb');
  await settle(page, 250);
};
const weekMode = async (page, from, through) => {
  await page.check('input[name="printMode"][value="week"]');
  if (from !== undefined) { await page.fill('#weekPick', from); await page.dispatchEvent('#weekPick', 'change'); }
  await page.fill('#weekThrough', through || '');
  await page.dispatchEvent('#weekThrough', 'change');
  await settle(page, 200);
};
const pages = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#weekStrip .week-page')).length);
const weekRows = (page) => page.evaluate(() => {
  const blocks = document.querySelector('#weekStrip .week-page') ? Array.from(document.querySelectorAll('#weekStrip .week-page')) : [document.querySelector('#weekStrip')];
  return blocks.map((b) => ({
    heading: b.querySelector('h2').textContent,
    sub: b.querySelector('.week-sub').textContent,
    days: Array.from(b.querySelectorAll('.week-day')).map((c) => ({
      name: c.querySelector('.wd-name').textContent,
      date: c.querySelector('.wd-date').childNodes[0].textContent.trim(),
      ab: (c.querySelector('.wd-ab') || {}).textContent || '',
      types: Array.from(c.querySelectorAll('.wd-type')).map((t) => t.textContent),
      label: (c.querySelector('.wd-label') || {}).textContent || '',
      lesson: (c.querySelector('.wd-lesson') || {}).textContent || '',
      note: (c.querySelector('.wd-note') || {}).textContent || '',
      off: c.classList.contains('is-off'),
    })),
  }));
});

console.log('School Calendar Visualizer — year-grid badges and printed weeks (TZ=' + (process.env.TZ || 'unset') + ')');

/* ═══ golden ═══════════════════════════════════════════════════════════════ */
if (GROUPS.has('golden')) {
  console.log('golden');
  for (const zone of ['America/New_York', 'UTC', 'Pacific/Auckland']) {
    const page = await newPinnedPage(browser, BASE, { timezoneId: zone, now: NOON[zone] });
    const got = await captureViews(page, URL_PAGE);
    eq(got.seedMonths, golden.seedMonths, `${zone}: the month grid of the seeded year is as it was`);
    eq(got.seedYearGrid, golden.seedYearGrid, `${zone}: the year grid, cycle off, is as it was`);
    eq(got.seedWeekDefault, golden.seedWeekDefault, `${zone}: the default one-week strip is as it was`);
    eq(got.seedWeeks, golden.seedWeeks, `${zone}: the strip of seven chosen weeks is as it was`);
    eq(got.abMonths, golden.abMonths, `${zone}: the month grid with the A/B cycle on is as it was`);
    eq(got.abWeeks, golden.abWeeks, `${zone}: the strip of seven weeks with the cycle on is as it was`);
    eq(got.stored, golden.stored, `${zone}: and the stored string, byte for byte`);
    eq(page.__errs, [], `${zone}: no page errors`);
    await page.context().close();
  }
}

/* ═══ badges ═══════════════════════════════════════════════════════════════ */
if (GROUPS.has('badges')) {
  console.log('badges');
  const page = await open();
  await persistSeed(page);
  eq(await page.evaluate(() => document.querySelectorAll('.yab, .year-key, .yday.yoff').length), 0, 'cycle off: no badge, no key, no hatched cell on the year grid');
  await enableAb(page, '2026-08-31', 'A');

  const grid = await page.evaluate(() => {
    const month = {};
    document.querySelectorAll('#months .day[data-date]').forEach((c) => { const b = c.querySelector('.ab-badge'); month[c.dataset.date] = b ? b.textContent : null; });
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = {};
    document.querySelectorAll('#yearGrid .ymonth').forEach((m) => {
      const [name, y] = m.querySelector('h4').textContent.split(' ');
      const mi = MON.indexOf(name) + 1;
      m.querySelectorAll('.yweeks .yday:not(.empty)').forEach((c) => {
        const d = parseInt(c.childNodes[0].textContent, 10);
        const iso = `${y}-${String(mi).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const b = c.querySelector('.yab');
        year[iso] = { text: b ? b.textContent : null, off: !!c.classList.contains('yoff'), label: b ? b.getAttribute('aria-label') : null, role: b ? b.getAttribute('role') : null, offBadge: !!(b && b.classList.contains('yab-off')) };
      });
    });
    return { month, year, key: (document.querySelector('.year-key') || {}).textContent || '' };
  });
  const dates = Object.keys(grid.year);
  ok(dates.length > 280, `the year grid has every day of the year (${dates.length})`);
  let letters = 0, same = true, weekendClean = true, offOk = true, schoolHatched = false;
  const noSchool = await page.evaluate(() => {
    const cal = JSON.parse(localStorage.getItem('scv_calendar_v1'));
    const ns = new Set(cal.dayTypes.filter((t) => t.noSchool).map((t) => t.id));
    const out = {};
    Object.entries(cal.days).forEach(([d, e]) => { if (e.types.some((id) => ns.has(id))) out[d] = true; });
    return out;
  });
  for (const d of dates) {
    const cell = grid.year[d], w = dowOf(d);
    if (w === 0 || w === 6) { if (cell.text !== null || cell.off) { weekendClean = false; ok(false, `${d}: a weekend has no badge and is not hatched`); } continue; }
    if (noSchool[d]) {
      if (cell.text !== '–' || !cell.off || !cell.offBadge || cell.label !== 'no school') { offOk = false; ok(false, `${d}: a weekday with no school shows an en dash on a hatched cell, spoken "no school" (${JSON.stringify(cell)})`); }
      continue;
    }
    if (cell.off) schoolHatched = true;
    if (cell.text !== grid.month[d] || !/^[AB]$/.test(cell.text || '') || cell.label !== cell.text + ' day' || cell.role !== 'img') { same = false; ok(false, `${d}: the year grid says ${JSON.stringify(cell)}, the month grid says ${grid.month[d]}`); }
    else letters++;
  }
  ok(same && letters > 150, `every school day of the year grid says the month grid's letter, as text (${letters} days)`);
  ok(weekendClean, 'no weekend carries a badge or a hatch');
  ok(offOk, 'every closed weekday is an en dash on a hatched cell');
  ok(!schoolHatched, 'no school day is hatched');
  eq(grid.year['2026-08-31'].text, 'A', 'Monday Aug 31, the anchor, is A');
  eq(grid.year['2026-09-01'].text, 'B', 'and Tuesday is B');
  eq(grid.year['2026-09-07'].text, '–', 'Labor Day is an en dash');
  eq(grid.year['2026-09-08'].text, grid.year['2026-09-04'].text === 'A' ? 'B' : 'A', 'Tuesday after Labor Day is the letter after Friday\'s: the closed Monday did not advance the cycle');
  eq(grid.year['2026-12-23'].text === grid.year['2027-01-04'].text, false, 'the first day after winter break follows the last day before it');
  ok(/school day/.test(grid.key) && /no school/.test(grid.key), 'a key says what the letters and the dash mean: ' + JSON.stringify(grid.key));

  // a different anchor and letter
  await enableAb(page, '2026-08-31', 'B');
  eq(await page.evaluate(() => { return Array.from(document.querySelectorAll('#yearGrid .yab')).slice(0, 3).map((b) => b.textContent); }), ['B', 'A', 'B'], 'anchored on B: the year grid starts B A B');

  // the smallest size, in print, and the cue is not colour
  await page.check('input[name="printMode"][value="year"]');
  await page.emulateMedia({ media: 'print' });
  await settle(page, 200);
  const printed = await page.evaluate(() => {
    const letter = document.querySelector('#yearGrid .yab:not(.yab-off)'), off = document.querySelector('#yearGrid .yab-off'), cell = document.querySelector('#yearGrid .yday.yoff');
    const cs = getComputedStyle(letter), os = getComputedStyle(off), cc = getComputedStyle(cell);
    return {
      letterSize: parseFloat(cs.fontSize), letterWeight: +cs.fontWeight, letterColor: cs.color, letterBorder: cs.borderTopColor, letterBorderWidth: parseFloat(cs.borderTopWidth),
      offColor: os.color, offBorder: os.borderTopColor, hatchBg: cc.backgroundColor,
      gridShown: getComputedStyle(document.getElementById('yearGrid')).display !== 'none', monthsShown: getComputedStyle(document.getElementById('months')).display !== 'none',
      cellH: cell.getBoundingClientRect().height,
    };
  });
  ok(printed.letterSize >= 8.9, `a letter is at least 9px on paper (${printed.letterSize}px)`);
  ok(printed.letterWeight >= 700, 'and bold');
  eq(printed.letterColor, 'rgb(0, 0, 0)', 'black on paper');
  eq(printed.letterBorder, 'rgb(0, 0, 0)', 'in a black box: text and shape, not colour');
  ok(printed.letterBorderWidth >= 1, 'a box at least a pixel wide');
  eq(printed.hatchBg, 'rgb(238, 238, 238)', 'a closed weekday is a grey cell on paper');
  eq(printed.offBorder, 'rgba(0, 0, 0, 0)', 'with the dash and no box');
  eq(printed.gridShown && !printed.monthsShown, true, 'the year grid prints and the month grid does not');
  // one page: the year with the letters on it still prints on as many pages as it does without them
  const withPages = (await page.pdf({ format: 'Letter', printBackground: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;
  await page.emulateMedia({ media: 'screen' });
  await page.uncheck('#abEnable');
  await page.click('#btnApplyAb');
  await settle(page, 250);
  await page.emulateMedia({ media: 'print' });
  const withoutPages = (await page.pdf({ format: 'Letter', printBackground: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;
  eq(withPages, withoutPages, `the whole year with the letters on it prints on ${withoutPages} Letter page(s), as it does without them (got ${withPages})`);
  await page.emulateMedia({ media: 'screen' });
  eq(await page.evaluate(() => document.querySelectorAll('#yearGrid .yab, .year-key').length), 0, 'switching the cycle off takes every badge and the key away');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* ═══ range ════════════════════════════════════════════════════════════════ */
const seedWeekNotes = async (page) => {
  await persistSeed(page);
  await page.evaluate(() => {
    const cal = JSON.parse(localStorage.getItem('scv_calendar_v1'));
    cal.days['2026-09-15'] = { types: [], label: 'Unit 1 test', note: 'Bring calculators. '.repeat(20).trim(), lesson: 'Review stations' };
    cal.days['2026-09-23'] = { types: ['testing'], label: '', note: 'Quiet hallway sign.', lesson: '' };
    cal.days['2026-11-02'] = { types: [], label: 'Report cards home', note: 'Sign and return Friday.', lesson: '' };
    localStorage.setItem('scv_calendar_v1', JSON.stringify(cal));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
};
if (GROUPS.has('range')) {
  console.log('range');
  const page = await open();
  await seedWeekNotes(page);
  eq(await page.isVisible('#weekThrough'), false, 'the "through" box is put away until One week is chosen');
  await page.check('input[name="printMode"][value="week"]');
  eq(await page.isVisible('#weekThrough'), true, 'and shown with it');
  ok(await page.$('label[for="weekThrough"]'), 'it has a label');
  ok(await page.$('#btnAllWeeks'), 'and a button for every week');
  eq((await page.textContent('#btnAllWeeks')).trim(), 'Every week of the year', 'in words');

  // one week: as ever, no wrapper
  await weekMode(page, '2026-09-14', '');
  eq(await pages(page), 0, 'no "through": the strip is the one week, with no page wrapper, as before');
  eq((await page.textContent('#weekCount')).trim(), 'Prints 1 page.', 'and says it prints 1 page');

  // three weeks
  await weekMode(page, '2026-09-14', '2026-09-28');
  eq(await pages(page), 3, 'from Sep 14 through the week of Sep 28: three pages');
  eq((await page.textContent('#weekCount')).trim(), 'Prints 3 pages, one per week.', 'and says so');
  const rows = await weekRows(page);
  eq(rows.map((r) => r.heading.replace(/^.*— /, '')), ['week of Sep 14', 'week of Sep 21', 'week of Sep 28'], 'headed with each week');
  eq(rows[0].days.map((d) => d.name), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'Monday to Friday');
  eq(rows.map((r) => r.days.map((d) => d.date)), [['Sep 14', 'Sep 15', 'Sep 16', 'Sep 17', 'Sep 18'], ['Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25'], ['Sep 28', 'Sep 29', 'Sep 30', 'Oct 1', 'Oct 2']], 'five consecutive dates on each, across the month end');
  eq(rows[0].days[1].label, 'Unit 1 test', 'a day\'s label is on its page');
  eq(rows[0].days[1].lesson, 'Review stations', 'its lesson');
  ok(rows[0].days[1].note.startsWith('Bring calculators.') && rows[0].days[1].note.endsWith('calculators.'), 'and the whole of its note, 20 sentences long');
  eq(rows[0].days[4].types, ['Half Day / Early Dismissal'], 'a half day names its type in words (Sep 18)');
  eq(rows[1].days[2].types, ['Testing Window'], 'a testing window names its type on its own page (Sep 23)');
  ok(!rows[0].days.some((d) => /Quiet hallway/.test(d.note)) && !rows[2].days.some((d) => /Bring calculators|Quiet hallway/.test(d.note)), 'and a day\'s note is on no other page');
  eq(await page.evaluate(() => Array.from(document.querySelectorAll('#weekStrip .week-page')).every((p) => p.querySelectorAll('.week-lines .rule').length === 3 && p.querySelectorAll('.week-day').length === 5)), true, 'every page has its five days and its lines to write on');

  // the cycle and the closed days
  await page.check('input[name="printMode"][value="month"]');
  await enableAb(page, '2026-08-31', 'A');
  await weekMode(page, '2026-09-01', '2026-09-08');
  const ab = await weekRows(page);
  eq(ab.length, 2, 'two weeks around Labor Day');
  eq(ab[0].days.map((d) => d.ab), ['A', 'B', 'A', 'B', 'A'], 'the letters on the week of Aug 31 are the month grid\'s');
  eq(ab[1].days.map((d) => d.ab), ['', 'B', 'A', 'B', 'A'], 'Labor Day has no letter and does not advance the cycle');
  eq(ab[1].days.map((d) => d.off), [true, false, false, false, false], 'and is the one greyed day');
  eq(ab[1].days[0].label, 'Labor Day', 'named');

  // a week that is all break is still a page
  await weekMode(page, '2026-12-21', '2027-01-04');
  const brk = await weekRows(page);
  eq(brk.map((r) => r.days.map((d) => d.date)), [['Dec 21', 'Dec 22', 'Dec 23', 'Dec 24', 'Dec 25'], ['Dec 28', 'Dec 29', 'Dec 30', 'Dec 31', 'Jan 1'], ['Jan 4', 'Jan 5', 'Jan 6', 'Jan 7', 'Jan 8']], 'across winter break and the new year: three pages of five consecutive dates');
  eq(brk[1].days.map((d) => d.off), [true, true, true, true, true], 'the week that is all break is five greyed days, not a missing page');
  const monthLetters = await page.evaluate(() => { const o = {}; document.querySelectorAll('#months .day[data-date]').forEach((c) => { const b = c.querySelector('.ab-badge'); if (b) o[c.dataset.date] = b.textContent; }); return o; });
  eq(brk[2].days.map((d) => d.ab), ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'].map((d) => monthLetters[d]), 'the week after break carries the month grid\'s letters for its days');
  eq(brk[0].days.map((d) => d.ab).slice(0, 3), ['2026-12-21', '2026-12-22', '2026-12-23'].map((d) => monthLetters[d]), 'and the week before it too');
  await page.check('input[name="printMode"][value="month"]');

  // ends that do not make a range
  for (const [from, through, what] of [['2026-09-14', '2026-09-10', 'earlier than the start'], ['2026-09-14', '2026-09-18', 'in the same week'], ['2026-09-14', '', 'blank']]) {
    await weekMode(page, from, through);
    eq(await pages(page), 0, `a "through" ${what}: the one week, no pages`);
    eq((await weekRows(page)).length, 1, `a "through" ${what}: and it is the one week of ${from}`);
  }

  // every week of the year
  await weekMode(page, '2026-09-14', '');
  await page.focus('#btnAllWeeks');
  await page.keyboard.press('Enter');
  await settle(page, 300);
  eq([await page.inputValue('#weekPick'), await page.inputValue('#weekThrough')], ['2026-08-31', '2027-06-07'], 'the button fills the first week and the last, by the keyboard too');
  eq(await pages(page), (dn('2027-06-07') - dn('2026-08-31')) / 7 + 1, 'and there is a page for every week of the year (41)');
  const all = await weekRows(page);
  ok(all.every((r, i) => r.days[0].name === 'Monday' && r.days[0].date === short(fromDn(dn('2026-08-31') + 7 * i))), 'each one a Monday, seven days after the one before');
  eq((await page.textContent('#weekCount')).trim(), 'Prints 41 pages, one per week.', 'and the count says 41');
  eq(await page.evaluate(() => document.querySelectorAll('.week-page .week-day').length), 41 * 5, '205 day boxes');

  // sixty at most
  await page.check('input[name="printMode"][value="month"]');
  await page.fill('#metaStart', '2026-01-01');
  await page.fill('#metaEnd', '2030-12-31');
  await page.click('#btnApplyMeta');
  await settle(page, 400);
  await page.check('input[name="printMode"][value="week"]');
  await page.click('#btnAllWeeks');
  await settle(page, 300);
  eq(await pages(page), 60, 'five years of weeks stop at sixty pages');
  ok(/most one print holds/.test(await page.textContent('#weekCount')), 'and the count says why: ' + JSON.stringify(await page.textContent('#weekCount')));
  eq(page.__errs, [], 'no page errors');
  await page.context().close();

  // the two daylight-saving weeks of a year, in zones that change their clocks at different hours
  for (const zone of ['America/New_York', 'UTC', 'America/Havana', 'Pacific/Auckland', 'Australia/Lord_Howe']) {
    const z = await open(zone);
    for (const [from, through, what] of [['2026-10-26', '2026-11-09', 'fall back, Sun Nov 1'], ['2027-03-08', '2027-03-22', 'spring forward, Sun Mar 14']]) {
      await weekMode(z, from, through);
      const got = (await weekRows(z)).map((r) => r.days.map((d) => d.date));
      const want = [0, 1, 2].map((w) => [0, 1, 2, 3, 4].map((i) => short(fromDn(dn(from) + 7 * w + i))));
      eq(got, want, `${zone}, ${what}: three pages, each five consecutive dates, none repeated or skipped`);
    }
    await z.context().close();
  }
}

/* ═══ print ════════════════════════════════════════════════════════════════ */
function pdfFacts(file) {
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const n = +/Pages:\s+(\d+)/.exec(info)[1];
  const bbox = execFileSync('pdftotext', ['-bbox', file, '-'], { encoding: 'utf8' });
  const pagesText = [];
  for (let k = 1; k <= n; k++) pagesText.push(execFileSync('pdftotext', ['-f', String(k), '-l', String(k), '-layout', file, '-'], { encoding: 'utf8' }));
  const boxes = [...bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((m) => ({
    w: +m[1], h: +m[2], words: [...m[3].matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g)].map((x) => ({ x0: +x[1], y0: +x[2], x1: +x[3], y1: +x[4], t: x[5] })),
  }));
  return { n, pagesText, boxes };
}
if (GROUPS.has('print')) {
  console.log('print');
  const page = await open();
  await seedWeekNotes(page);
  await enableAb(page, '2026-08-31', 'A');
  const SIZES = [['Letter', {}], ['A4', {}], ['Legal', {}], ['Tabloid', {}]];
  const RANGES = [['2026-09-14', '2026-09-28'], ['2026-10-26', '2026-11-09']];
  for (const [from, through] of RANGES) {
    await weekMode(page, from, through);
    await page.emulateMedia({ media: 'print' });
    const mondays = [0, 1, 2].map((w) => fromDn(dn(from) + 7 * w));
    for (const [format] of SIZES) {
      for (const landscape of [true, false]) {
        const label = `${format} ${landscape ? 'landscape' : 'portrait'}, ${from} to ${through}`;
        const f = path.join(SCRATCH, `w-${format}-${landscape}-${from}.pdf`);
        fs.writeFileSync(f, await page.pdf({ format, landscape, printBackground: true }));
        const pdf = pdfFacts(f);
        eq(pdf.n, 3, `${label}: three PDF pages, one per week (no clipped overflow onto a fourth, no trailing blank)`);
        pdf.pagesText.forEach((t, k) => {
          const flat = t.replace(/\s+/g, ' ');
          ok(flat.includes('week of ' + short(mondays[k])) && /notes for the week/i.test(flat), `${label}: PDF page ${k + 1} is the week of ${short(mondays[k])}, heading to the lines to write on`);
          ok(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].every((d) => flat.includes(d)), `${label}: page ${k + 1} has all five days`);
          ok(flat.length > 120, `${label}: page ${k + 1} is not blank`);
          if (!flat.includes('week of ' + short(mondays[(k + 1) % 3]))) passed++; else ok(false, `${label}: page ${k + 1} holds another week's heading`);
        });
        pdf.boxes.forEach((b, k) => {
          const out = b.words.filter((w) => w.x1 > b.w - 1 || w.y1 > b.h - 1 || w.x0 < 0);
          ok(out.length === 0, `${label}: page ${k + 1} has no word past the paper's edge (${out.slice(0, 3).map((w) => w.t)})`);
        });
        if (from === '2026-09-14') {
          const p1 = pdf.pagesText[0].replace(/\s+/g, ' ');
          eq((p1.match(/calculators\./g) || []).length, 20, `${label}: the 20-sentence note is whole on its page`);
          ok(!pdf.pagesText[1].includes('calculators') && !pdf.pagesText[2].includes('calculators'), `${label}: and on no other`);
        }
      }
    }
    await page.emulateMedia({ media: 'screen' });
  }
  // the whole year, one page each
  await page.check('input[name="printMode"][value="week"]');
  await page.click('#btnAllWeeks');
  await settle(page, 300);
  await page.emulateMedia({ media: 'print' });
  for (const landscape of [true, false]) {
    const f = path.join(SCRATCH, `year-${landscape}.pdf`);
    fs.writeFileSync(f, await page.pdf({ format: 'Letter', landscape, printBackground: true }));
    const pdf = pdfFacts(f);
    eq(pdf.n, 41, `the whole year on Letter ${landscape ? 'landscape' : 'portrait'}: 41 PDF pages for 41 weeks`);
    const heads = pdf.pagesText.map((t) => (/week of ([A-Z][a-z]{2} \d+)/.exec(t.replace(/\s+/g, ' ')) || [])[1]);
    eq(heads, Array.from({ length: 41 }, (_, i) => short(fromDn(dn('2026-08-31') + 7 * i))), `...each page its own week, in order`);
  }
  // the one week, as it always printed
  await page.emulateMedia({ media: 'screen' });
  await weekMode(page, '2026-09-14', '');
  await page.emulateMedia({ media: 'print' });
  const one = path.join(SCRATCH, 'one.pdf');
  fs.writeFileSync(one, await page.pdf({ format: 'Letter', landscape: true, printBackground: true }));
  eq(pdfFacts(one).n, 1, 'the one-week print is still one page');
  eq(await page.evaluate(() => ({ toolbar: getComputedStyle(document.querySelector('.toolbar')).display, wrap: document.getElementById('weekPickWrap').getClientRects().length })), { toolbar: 'none', wrap: 0 }, 'and the controls, including the new ones, stay off the paper');
  await page.emulateMedia({ media: 'screen' });
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* ═══ a11y ═════════════════════════════════════════════════════════════════ */
if (GROUPS.has('a11y')) {
  console.log('a11y');
  const page = await open();
  await seedWeekNotes(page);
  await enableAb(page, '2026-08-31', 'A');
  await weekMode(page, '2026-09-14', '2026-09-28');
  for (const include of ['#weekPickWrap', '#weekStrip']) {
    const v = await a11yScan(page, { impact: 'moderate', include });
    eq(v.map((x) => x.id + ' ' + x.nodes.join(',')), [], `axe on ${include}: nothing serious or moderate`);
  }
  eq(await page.evaluate(() => { const c = document.getElementById('weekCount'); return [c.getAttribute('role'), c.getAttribute('aria-live')]; }), ['status', 'polite'], 'the page count is a polite status, so a screen reader hears it change');
  // tab order: from the "Week of" box to the next box, then the button
  await page.focus('#weekThrough');
  eq(await page.evaluate(() => document.activeElement.id), 'weekThrough', 'the "through" box takes the keyboard');
  let reached = false;
  for (let i = 0; i < 6 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement.id === 'btnAllWeeks'); }
  ok(reached, 'and Tab goes on to the every-week button (a date box has three parts of its own)');
  eq(await page.evaluate(() => document.getElementById('btnAllWeeks').tagName), 'BUTTON', 'which is a real button');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

fs.rmSync(SCRATCH, { recursive: true, force: true });
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
