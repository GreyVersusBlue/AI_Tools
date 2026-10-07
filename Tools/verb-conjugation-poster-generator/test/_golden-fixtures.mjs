// _golden-fixtures.mjs — the posters golden-old-posters.json was recorded from,
// and the one way to print them: the page's own controls, no state written
// by hand, window.print stubbed, #printArea read back.
//
// Used by _record-golden.mjs (run once, against the page at 1aaee05, before the
// call-out boxes existed) and by smoke-callouts.mjs (which compares today's page
// with that recording).

export const TEMPLATE_KEYS = ['es_present', 'es_preterite', 'es_imperfect', 'es_future', 'es_irregulars',
  'fr_present', 'fr_imperfect', 'fr_irregulars', 'blank'];
export const COLUMNS = [1, 2, 3];

/** [name, template, columns, color-code panels] for every recorded poster. */
export const FIXTURES = [];
for (const t of TEMPLATE_KEYS) for (const c of COLUMNS) FIXTURES.push([`${t}/${c}col`, t, c, true]);
FIXTURES.push(['es_present/2col/no-color', 'es_present', 2, false]);
FIXTURES.push(['fr_present/3col/no-color', 'fr_present', 3, false]);

/** Build a fixture through the page's controls and return #printArea's HTML. */
export async function printedHtml(page, template, columns, color) {
  page.removeAllListeners('dialog');
  page.on('dialog', d => d.accept());
  await page.selectOption('#templateSelect', template);
  await page.click('#loadTemplateBtn');
  await page.selectOption('#colCount', String(columns));
  const box = page.locator('#colorPanels');
  if ((await box.isChecked()) !== color) await box.setChecked(color);
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await page.waitForTimeout(150);
  return page.evaluate(() => document.getElementById('printArea').innerHTML);
}
