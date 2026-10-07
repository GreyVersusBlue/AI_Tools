// _capture-views.mjs — what the School Calendar Visualizer's grids and its one-week strip
// say for a few fixed calendars, as hashes. smoke-weeks.mjs compares them with
// golden-old-views.json, which was recorded from the page BEFORE the year-grid
// badges and the multi-week print, so "a calendar saved before opens and prints as it did"
// is a byte comparison and not a belief.
//
// The page clock is pinned to an instant and the context to a zone, so the capture does not
// depend on the machine it runs on.

import crypto from 'node:crypto';

export const FIXED_NOW = '2026-09-16T12:00:00-04:00'; // a Wednesday in the seeded year
export const ZONE = 'America/New_York';
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function newPinnedPage(browser, base, { timezoneId = ZONE, now = FIXED_NOW, width = 1400, height = 1000 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId, locale: 'en-US', acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || /^(data|blob|about):/.test(u)) return route.continue();
    return route.abort();
  });
  await page.clock.setFixedTime(new Date(now));
  return page;
}

const html = (page, sel) => page.evaluate((s) => document.querySelector(s).innerHTML, sel);

/** Picks a week in the one-week print mode and returns the strip's markup hash. */
async function weekHash(page, mondayish) {
  await page.fill('#weekPick', mondayish);
  await page.dispatchEvent('#weekPick', 'change');
  return sha(await html(page, '#weekStrip'));
}

export const WEEK_PICKS = ['2026-08-31', '2026-09-07', '2026-10-12', '2026-11-23', '2026-12-21', '2027-03-22', '2027-06-07'];

export async function captureViews(page, url) {
  const out = {};
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  out.seedMonths = sha(await html(page, '#months'));
  out.seedYearGrid = sha(await html(page, '#yearGrid'));
  await page.check('input[name="printMode"][value="week"]');
  out.seedWeekDefault = sha(await html(page, '#weekStrip'));
  out.seedWeeks = {};
  for (const w of WEEK_PICKS) out.seedWeeks[w] = await weekHash(page, w);

  // The A/B cycle on, through the page's own controls.
  await page.check('input[name="printMode"][value="month"]');
  await page.check('#abEnable');
  await page.fill('#abAnchorDate', '2026-08-31');
  await page.selectOption('#abAnchorLetter', 'A');
  await page.click('#btnApplyAb');
  await page.waitForTimeout(200);
  out.abMonths = sha(await html(page, '#months'));
  await page.check('input[name="printMode"][value="week"]');
  out.abWeeks = {};
  for (const w of WEEK_PICKS) out.abWeeks[w] = await weekHash(page, w);
  out.stored = sha(await page.evaluate(() => localStorage.getItem('scv_calendar_v1')));
  return out;
}
