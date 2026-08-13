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

/* ── 6. a v1 deck (bare data-URL images, separate size key) migrates ─────── */
await page.evaluate(() => {
  localStorage.clear();
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  localStorage.setItem('htcm_cards_v1', JSON.stringify([
    { id: 'c1', name: 'Cleopatra', image: px, stats: [{ label: 'Reign', value: '51-30 BC' }], facts: ['Ruled Egypt.'] },
  ]));
  localStorage.setItem('htcm_card_size_v1', 'fill');
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.textContent('#entryCount'), '1', 'a v1 deck still loads');
eq(await page.inputValue('#cardSize'), 'fill', 'the v1 size choice migrates');
const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem('htcm_cards_v2') || 'null'));
ok(v2 && v2.v === 2 && v2.cards.length === 1, 'a v2 document was written on first load');
eq(v2 && v2.cards[0].image && v2.cards[0].image.shape, 'rrect', 'the bare v1 image string became an image object with defaults');
ok(await page.evaluate(() => !!localStorage.getItem('htcm_cards_v1')), 'the v1 key is kept as a one-release backup');

/* ── 7. the live preview shows the form draft and flips ──────────────────── */
ok(await page.isVisible('#previewFlipper'), 'a live preview card is on screen');
await page.fill('#newName', 'Test Person');
await page.fill('#newStats', 'Born: 1900');
await page.waitForTimeout(250); // preview updates are debounced ~100ms
ok((await page.textContent('#previewFront')).includes('Test Person'), 'typing a name updates the preview front');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .trading-card .cstats')),
   'the preview renders the same card structure that prints');
eq(await page.evaluate(() => document.getElementById('previewFlipper').classList.contains('flipped')), false,
   'the preview starts on the front');
await page.click('#flipBtn');
eq(await page.evaluate(() => document.getElementById('previewFlipper').classList.contains('flipped')), true,
   'the flip button turns the card over');
ok((await page.textContent('#previewBack')).length > 0, 'the back face is rendered');
await page.click('#previewFlipper');
eq(await page.evaluate(() => document.getElementById('previewFlipper').classList.contains('flipped')), false,
   'clicking the card flips it back to the front');

/* ── 8. the overflow warning comes from measuring the real card ──────────── */
await page.fill('#newStats', Array.from({ length: 20 }, (_, i) => `Stat ${i}: value`).join('\n'));
await page.waitForTimeout(250);
ok(await page.isVisible('#statWarn'), 'twenty stat lines trip the measured overflow warning');
await page.fill('#newStats', 'Born: 1900');
await page.waitForTimeout(250);
ok(!(await page.isVisible('#statWarn')), 'and it clears when the stats fit again');

/* ── 9. deck themes and rarity render everywhere, geometry intact ────────── */
await page.click('.theme-swatch[data-theme="parchment"]');
await settle(page);
ok(await page.evaluate(() => !!document.querySelector('#previewFront .trading-card.theme-parchment')),
   'picking a theme restyles the preview card');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .card-frame')),
   'the themed card carries its decorative frame overlay');
await page.selectOption('#newRarity', 'legendary');
await page.waitForTimeout(250);
ok(await page.evaluate(() => !!document.querySelector('#previewFront .trading-card.rarity-legendary')),
   'rarity applies to the preview card');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .rarity-badge')),
   'a legendary card shows its foil badge');
await page.selectOption('#cardSize', 'standard');
await settle(page);
const themed = await measureCards();
near(themed.width / IN, 2.5, 0.02, 'a themed card still measures 2.5in across');
near(themed.height / IN, 3.5, 0.02, 'and 3.5in tall — frames add no layout size');
ok(await page.evaluate(() => !!document.querySelector('#printArea .trading-card.theme-parchment')),
   'the print run uses the deck theme');
ok(await page.evaluate(() => !!document.querySelector('#printArea svg.htcm-defs')),
   'the print subtree carries its own copy of the shared SVG defs');
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
ok(await page.evaluate(() => !!document.querySelector('.theme-swatch[data-theme="parchment"].selected')),
   'the theme choice survives a reload');

/* ── 10. print-first flash: meters, icons, stars, set strip, foil glint ──── */
await page.fill('#newName', 'Julius Caesar');
await page.fill('#newStats', 'Courage: 7/10\nBorn: 100 BC');
await page.selectOption('#newRarity', 'rare');
await page.selectOption('#newStars', '4');
await page.click('#addEntryBtn');
await settle(page);
eq(await page.evaluate(() => (document.querySelector('#previewFront .meter-fill') || {}).style?.width ?? null),
   '70%', 'a 7/10 stat renders as a meter filled to 70%');
eq(await page.evaluate(() => (document.querySelector('#previewFront .meter-num') || {}).textContent ?? null),
   '7/10', 'with the number printed inside the bar, for B/W printers');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .cstats .stat-ico')),
   'a recognized stat label gets its stroke icon');
eq(await page.evaluate(() => (document.querySelector('#previewFront .cstars') || {}).textContent ?? null),
   '★★★★☆', 'the star rating renders four of five stars');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .holo')),
   'a rare card carries the static foil glint overlay');
await page.fill('#setNameInput', 'Ancient Rome');
await page.click('#numberBtn');
await settle(page);
ok(await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('htcm_cards_v2'));
  return d.cards.every((c, i) => c.meta.cardNo === i + 1 && c.meta.setSize === d.cards.length && c.meta.setName === 'Ancient Rome');
}), 'Number the deck stamps set name and n-of-m onto every card');
ok(await page.evaluate(() => ((document.querySelector('#previewFront .cset') || {}).textContent || '').includes('Ancient Rome')),
   'the set strip shows along the card front’s bottom edge');

/* ── 11. no console noise anywhere in the run ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
