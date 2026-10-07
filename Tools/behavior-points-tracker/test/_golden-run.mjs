// _golden-run.mjs — one fixed walk through the Behavior & Points Tracker for a
// class with NO teams, returning everything the page shows, prints, exports and
// stores along the way. _capture-golden-no-teams.mjs recorded it from the page
// as it was before team / house points (main at 9dafbcf); smoke-teams.mjs runs
// it again on today's page and demands the same, to the byte.
//
// Every name is invented. The page clock is pinned, so the log ids
// ('ev' + Date.now() + counter), the times and the archive date repeat.
//
// Pinned on EVERY machine, not only the one that recorded the golden: CLOCK
// is an instant (it carries its offset), and the page's time zone is set to
// ZONE before it loads. The golden was recorded on a machine in
// America/New_York from '2026-03-04T15:20:00' with no offset, which Node read
// as local time; on a runner in UTC the same text was another instant, so the
// ids differed, and the page's own zone decides what '3:20 PM' and 'Mar 4'
// say. Both are now what the recording machine had, whatever TZ is.

export const KEY = 'behavior-points-tracker-sections';
export const CLOCK = '2026-03-04T15:20:00-05:00';
export const ZONE = 'America/New_York';

const NAMES = ['Aiden Whitfield', 'Brooklyn Bell', 'Camila Duarte', 'Dmitri Fox', 'Esi Mensah', 'Farid Noor'];
const TAGS = [
  { id: 't1', label: 'On Task', delta: 1, cat: 'effort' },
  { id: 't3', label: 'Great Answer', delta: 2, cat: 'academic' },
  { id: 't5', label: 'Off Task', delta: -1, cat: 'effort' },
];
const row = (name, points, pos, neg, goal, notes) => ({ name, points, pos, neg, goal, notes: notes || [] });
export const SEED = {
  current: 'Period 3 — Earth Science',
  sets: {
    'Period 3 — Earth Science': {
      name: 'Period 3 — Earth Science',
      namesText: NAMES.join('\n'),
      tags: TAGS,
      armedTagId: 'm+1',
      points: { 'Aiden Whitfield': 3, 'Brooklyn Bell': -1, 'Esi Mensah': 5 },
      posCount: { 'Aiden Whitfield': 2, 'Esi Mensah': 3 },
      negCount: { 'Brooklyn Bell': 1 },
      log: [
        { id: 'ev1', name: 'Esi Mensah', tagLabel: 'Great Answer', cat: 'academic', delta: 2, ts: '9:41 AM', note: 'Explained the rock cycle to the group' },
        { id: 'ev2', name: 'Brooklyn Bell', tagLabel: 'Off Task', cat: 'effort', delta: -1, ts: '9:30 AM' },
      ],
      history: [
        { date: 'Mar 3, 2026', iso: '2026-03-03', rows: [row('Aiden Whitfield', 4, 4, 0, 3), row('Brooklyn Bell', 1, 2, 1, null), row('Esi Mensah', 6, 5, 0, null, [{ label: 'Kindness', delta: 1, note: 'Helped a new student find the room' }])] },
        { date: 'Mar 2, 2026', iso: '2026-03-02', rows: [row('Aiden Whitfield', 2, 2, 0, 3), row('Brooklyn Bell', -2, 0, 2, null), row('Esi Mensah', 3, 3, 0, null)] },
      ],
      sortMode: 'name', displayMode: 'full', noteMode: false,
      goals: { 'Aiden Whitfield': 3 }, idNames: {}, rosterName: '', boardLayout: 'sorted', seatingSectionId: '',
    },
  },
};

const GRID = '#studentGrid', FEED = '#activityFeed';
const html = (page, sel) => page.$eval(sel, el => el.innerHTML);
const stored = page => page.evaluate(k => localStorage.getItem(k), KEY);

export async function snapshot(page) {
  const out = {};
  for (const [k, sel] of Object.entries({
    grid: GRID, feed: FEED, history: '#historyWrap', cumulative: '#cumulativeWrap', trends: '#trendWrap',
    goals: '#goalList', chips: '#tagChips', displayNote: '#displayNote', nameCount: '#nameCount',
  })) out[k] = await html(page, sel);
  out.stored = await stored(page);
  return out;
}

/** `afterLoad(page)` lets a suite do something once the page is up (the golden
    capture passes nothing). */
export async function walk(page, url, { before } = {}) {
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.type() + ':' + d.message()); await d.accept(''); });
  await page.clock.setFixedTime(new Date(CLOCK));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: ZONE });
  await page.addInitScript(([key, seed]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  }, [KEY, SEED]);
  await page.goto(url);
  await page.waitForTimeout(500);
  if (before) await before(page);
  const out = { start: await snapshot(page) };

  out.modes = {};
  for (const m of ['positive', 'initials', 'total', 'full']) {
    await page.selectOption('#displayMode', m);
    out.modes[m] = await html(page, GRID);
  }
  for (const m of ['points-desc', 'points-asc', 'name']) {
    await page.selectOption('#sortMode', m);
    out.modes['sort-' + m] = await html(page, GRID);
  }

  const tap = async (key, name) => {
    await page.keyboard.press(key);
    await page.click(`${GRID} .student-card[data-name="${name}"]`);
    await page.waitForTimeout(450);
  };
  await tap('2', 'Aiden Whitfield');
  await tap('4', 'Brooklyn Bell');
  await tap('1', 'Camila Duarte');
  out.afterTaps = await snapshot(page);

  await page.keyboard.press('1');
  await page.click('#awardAllBtn');
  await page.waitForTimeout(450);
  out.afterAwardAll = await snapshot(page);

  await page.click(`${FEED} [data-undo-id]`);
  out.afterUndo = await snapshot(page);

  await page.click(`${GRID} .student-card[data-name="Dmitri Fox"]`, { modifiers: ['Shift'] });
  await page.click('#awardUnselectedBtn');
  await page.waitForTimeout(450);
  out.afterAwardOthers = await snapshot(page);

  await page.evaluate(() => { window.__printed = 0; });
  await page.click('#printBtn');
  out.printReport = await page.$eval('#printArea', el => el.outerHTML);
  await page.selectOption('#summaryStudent', 'Esi Mensah');
  await page.click('#printSummaryBtn');
  out.printSummary = await page.$eval('#summaryArea', el => el.outerHTML);
  out.printed = await page.evaluate(() => window.__printed);

  const { downloadText } = await import('../../board-check/harness.mjs');
  out.csv = await downloadText(page, '#exportHistoryBtn', { what: 'the history CSV' });

  await page.click('#archiveBtn');
  out.afterArchive = await snapshot(page);
  await page.keyboard.press('2');
  await page.click(`${GRID} .student-card[data-name="Farid Noor"]`);
  await page.waitForTimeout(450);
  await page.click('#clearDayBtn');
  out.afterClearDay = await snapshot(page);
  out.dialogs = dialogs;
  return out;
}
