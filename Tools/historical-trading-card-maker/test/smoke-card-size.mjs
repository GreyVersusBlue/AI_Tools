// smoke-card-size.mjs — the standard 2.5 × 3.5in card preset.
//
//   node Tools/historical-trading-card-maker/test/smoke-card-size.mjs
//
// The tool used to size cards by dividing the page width by three, which is
// close to trading-card size but is not a measurement — it moves with the
// paper and the printer's margins, and nothing is made to hold it. There is
// now an explicit "Standard trading card" preset that states 2.5in × 3.5in
// outright, with the old behavior kept as "Fill the page". What this suite
// holds down:
//
//   The standard preset really measures 2.5 × 3.5 inches. Asserted in CSS
//   inches converted to pixels (1in = 96px in CSS), against the laid-out box
//   — not against the stylesheet text.
//
//   The whole grid still fits across a letter page. Three cards plus two
//   gutters has to clear 8.5in minus the page margins, or the third card wraps
//   and the sheet is wasted.
//
//   The preset is remembered, the old sizing is still reachable, and the
//   duplex row-mirroring the previous round built is unaffected by either.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8164;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';

const IN = 96;            // CSS inches → px
const PAGE_MARGIN = 0.3;  // must match the @page rule in the tool

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

console.log('Trading Card Maker — standard 2.5 × 3.5in card preset');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* Build a small deck. */
async function addCard(name, stats, facts) {
  await page.fill('#newName', name);
  await page.fill('#newStats', stats);
  await page.fill('#newFacts', facts);
  await page.click('#addEntryBtn');
  await settle(page);
}
await addCard('Harriet Tubman', 'Born: 1822\nDied: 1913', 'Escaped slavery in 1849.');
await addCard('Sojourner Truth', 'Born: 1797\nDied: 1883', 'Spoke at the 1851 convention.');
await addCard('Frederick Douglass', 'Born: 1818\nDied: 1895', 'Published the North Star.');
await addCard('Ida B. Wells', 'Born: 1862\nDied: 1931', 'Documented lynching as a journalist.');
eq(await page.textContent('#entryCount'), '4', 'four cards are in the deck');

/* #printArea is display:none on screen. Measuring needs it laid out, so the
   measurement runs against a clone forced visible at the printed page's
   content width — the same box the print stylesheet gives it. */
async function measureCards() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  return page.evaluate(({ inch, margin }) => {
    const src = document.getElementById('printArea');
    const probe = src.cloneNode(true);
    probe.id = 'printAreaProbe';
    probe.style.display = 'block';
    probe.style.position = 'absolute';
    probe.style.left = '-10000px';
    probe.style.top = '0';
    probe.style.width = (8.5 - margin * 2) * inch + 'px';
    document.body.appendChild(probe);
    const grid = probe.querySelector('.print-page .card-grid');
    const cards = Array.from(grid.querySelectorAll('.trading-card'));
    const gridBox = grid.getBoundingClientRect();
    const rows = new Set(cards.map(c => Math.round(c.getBoundingClientRect().top)));
    const out = {
      count: cards.length,
      width: cards[0].getBoundingClientRect().width,
      height: cards[0].getBoundingClientRect().height,
      gridLeft: gridBox.left,
      gridRight: gridBox.right,
      spanLeft: Math.min(...cards.map(c => c.getBoundingClientRect().left)),
      spanRight: Math.max(...cards.map(c => c.getBoundingClientRect().right)),
      rows: rows.size,
    };
    probe.remove();
    return out;
  }, { inch: IN, margin: PAGE_MARGIN });
}

/* ── 1. the standard preset is the default, and it measures ─────────────── */
eq(await page.inputValue('#cardSize'), 'standard', 'the standard trading-card size is the default');
const std = await measureCards();
eq(std.count, 6, 'six cards to a page, blanks included');
eq(std.rows, 2, 'laid out as two rows of three');
near(std.width / IN, 2.5, 0.02, 'a card measures 2.5in across');
near(std.height / IN, 3.5, 0.02, 'a card measures 3.5in tall');

/* ── 2. the row of three fits the printable width ────────────────────────── */
const usable = 8.5 - PAGE_MARGIN * 2;
const spanned = (std.spanRight - std.spanLeft) / IN;
ok(spanned <= usable + 0.001, `three cards plus gutters (${spanned.toFixed(2)}in) fit the ${usable.toFixed(2)}in printable width`);
near((std.spanLeft - std.gridLeft) / IN, (std.gridRight - std.spanRight) / IN, 0.02,
  'the grid is centered, so the leftover margin is even on both sides');

/* ── 3. the old sizing is still reachable and is genuinely different ─────── */
await page.selectOption('#cardSize', 'fill');
await settle(page);
const fill = await measureCards();
eq(fill.count, 6, 'the fill layout still prints six to a page');
near(fill.width / IN, 2.43, 0.02, 'the old layout is unchanged at about 2.43in across');
near(fill.height / IN, 3.4, 0.02, 'and keeps its original 3.4in height');
ok(fill.width < std.width && fill.height < std.height,
   'which is under standard size in both directions — the gap this preset closes');

/* ── 4. the choice is remembered ─────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#cardSize'), 'fill', 'the size choice survives a reload');
eq(await page.evaluate(() => document.getElementById('printArea').className), 'size-fill', 'and is applied to the print area');
await page.selectOption('#cardSize', 'standard');
await settle(page);

/* ── 5. duplex row-mirroring still lines up under the new size ───────────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
const [fronts, backs] = await page.evaluate(() => {
  const pages = Array.from(document.querySelectorAll('#printArea .print-page'));
  const names = el => Array.from(el.querySelectorAll('.trading-card')).map(c => {
    const n = c.querySelector('.cname');
    return n ? n.textContent : '';
  });
  return [names(pages[0]), names(pages[pages.length - 1])];
});
eq(fronts.slice(0, 3).join(','), 'Harriet Tubman,Sojourner Truth,Frederick Douglass', 'fronts print in entry order');
eq(backs.slice(0, 3).join(','), 'Frederick Douglass,Sojourner Truth,Harriet Tubman', 'backs are still row-mirrored for the flip');

/* ── 6. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
