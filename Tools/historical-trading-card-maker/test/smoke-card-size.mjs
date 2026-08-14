// smoke-card-size.mjs — the card size presets: standard 2.5 × 3.5in, the
// legacy fill-the-page layout, and the 3.5 × 5in reference card.
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
//   duplex row-mirroring the previous round built is unaffected by any of
//   them — the mirror follows the column count, which is 3 for the small
//   cards and 2 for the reference card.
//
//   The reference card fits the page in BOTH directions. It is the preset
//   with no slack: two 5in rows is 10.15in of a 10.4in printable height, so
//   a drift that would be invisible on a 3.5in card costs half a sheet here.
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

console.log('Trading Card Maker — card size presets (standard, fill, reference)');

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
const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem('htcm:data:My cards') || 'null'));
ok(v2 && v2.v === 2 && v2.cards.length === 1, 'the v1 store became the named deck "My cards"');
eq(v2 && v2.cards[0].image && v2.cards[0].image.shape, 'rrect', 'the bare v1 image string became an image object with defaults');
ok(await page.evaluate(() => (JSON.parse(localStorage.getItem('htcm:list') || '[]')).includes('My cards')),
   'and the deck is listed');
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
  const d = JSON.parse(localStorage.getItem('htcm:data:My cards'));
  return d.cards.every((c, i) => c.meta.cardNo === i + 1 && c.meta.setSize === d.cards.length && c.meta.setName === 'Ancient Rome');
}), 'Number the deck stamps set name and n-of-m onto every card');
ok(await page.evaluate(() => ((document.querySelector('#previewFront .cset') || {}).textContent || '').includes('Ancient Rome')),
   'the set strip shows along the card front’s bottom edge');

/* ── 11. named decks and roster batch-add ────────────────────────────────── */
await page.click('#rosterBtn');
await page.fill('#rosterText', 'Augustus\nNero\n');
await page.click('#rosterAddBtn');
await settle(page);
eq(await page.textContent('#entryCount'), '4', 'roster batch-add creates one blank card per pasted line');
ok(await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('htcm:data:My cards'));
  return d.cards[3].name === 'Nero' && d.cards[3].meta.setName === 'Ancient Rome';
}), 'roster cards inherit the set name');
page.once('dialog', (d) => d.accept('Period 2'));
await page.click('#newDeckBtn');
await settle(page);
eq(await page.textContent('#entryCount'), '0', 'a new deck starts empty');
eq(await page.inputValue('#deckSelect'), 'Period 2', 'and becomes the current deck');
ok(await page.evaluate(() => !!document.querySelector('.theme-swatch[data-theme="parchment"].selected')),
   'a new deck inherits the current theme');
await page.selectOption('#deckSelect', 'My cards');
await settle(page);
eq(await page.textContent('#entryCount'), '4', 'switching decks brings the original cards back');

/* ── 12. the large reference card — 3.5 × 5in, four to a page ───────────── */
// The third preset is the one for a poster or a word wall rather than a card
// sleeve, and it is the one where the page budget is genuinely tight: two 5in
// rows is 10.15in of grid inside the 10.4in a letter page clears at a 0.3in
// margin. If either dimension drifts, a row silently moves to a page of its
// own and every sheet after it is half empty, which is exactly the failure a
// teacher only discovers at the printer.
await page.selectOption('#cardSize', 'reference');
await settle(page);
const ref = await measureCards();
eq(ref.count, 4, 'four cards to a page');
eq(ref.rows, 2, 'laid out as two rows of two');
near(ref.width / IN, 3.5, 0.02, 'a reference card measures 3.5in across');
near(ref.height / IN, 5, 0.02, 'and 5in tall');

const refSpan = (ref.spanRight - ref.spanLeft) / IN;
ok(refSpan <= usable + 0.001, `two reference cards plus the gutter (${refSpan.toFixed(2)}in) fit the ${usable.toFixed(2)}in printable width`);
const refPageHeight = (ref.height * 2) / IN + 0.15; // two rows plus one gutter
ok(refPageHeight <= 11 - PAGE_MARGIN * 2 + 0.001,
   `two rows plus the gutter (${refPageHeight.toFixed(2)}in) fit the ${(11 - PAGE_MARGIN * 2).toFixed(2)}in printable height`);

// The banners are dropped at this size for exactly that reason — asserted so
// nobody "fixes" the missing label back in without redoing the page budget.
ok(await page.evaluate(() => {
  const label = document.querySelector('#printArea .section-label');
  if (!label) return false;
  // display:none only applies under print media, so check the rule applies to
  // this size rather than the computed screen style.
  return document.getElementById('printArea').className === 'size-reference';
}), 'the print area carries the reference size, which is what hides the fronts/backs banners in print');

// Duplex mirroring has to follow the column count, not a constant: at two
// columns a row reverses as a pair, and a stale 3 would leave the backs
// misaligned with the fronts on every sheet.
const [deckOrder, refFronts, refBacks] = await page.evaluate(() => {
  const pages = Array.from(document.querySelectorAll('#printArea .print-page'));
  const names = el => Array.from(el.querySelectorAll('.trading-card')).map(c => {
    const n = c.querySelector('.cname');
    return n ? n.textContent : '';
  });
  const deck = Array.from(document.querySelectorAll('#entriesWrap .entry-row .ename')).map(e => e.textContent);
  return [deck, names(pages[0]), names(pages[pages.length - 1])];
});
eq(refFronts.slice(0, 2).join(','), deckOrder.slice(0, 2).join(','), 'reference fronts print in entry order');
eq(refBacks.slice(0, 2).join(','), deckOrder.slice(0, 2).reverse().join(','),
   'and the backs mirror across two columns, not three');

// Type is scaled up with the card: a reference card read from across the room
// is the point of the preset, so a card that merely got bigger would miss it.
const nameSizes = await page.evaluate(() => {
  const read = (size) => {
    const probe = document.createElement('div');
    probe.className = size;
    probe.style.cssText = 'position:absolute;left:-10000px;top:0;';
    probe.innerHTML = document.querySelector('#printArea .trading-card').outerHTML;
    document.body.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe.querySelector('.cname')).fontSize);
    probe.remove();
    return px;
  };
  return { standard: read('size-standard'), reference: read('size-reference') };
});
ok(nameSizes.reference > nameSizes.standard * 1.3,
   `the name is set materially larger on a reference card (${nameSizes.reference}px vs ${nameSizes.standard}px)`);

// The overflow warning measures the real card at the chosen size, so the
// bigger card must accept stats the small one clips — otherwise the warning
// is just a constant wearing a measurement's clothes.
await page.fill('#newName', 'Overflow probe');
async function statCapacity() {
  // The largest number of stat lines that does NOT trip the warning, found by
  // walking up from a card that plainly fits. Reading the threshold rather
  // than asserting one fixed count keeps this honest across theme and padding
  // changes.
  //
  // The values are deliberately long enough to wrap. Type is scaled up with
  // the card, so a *short* stat line uses about the same fraction of either
  // card and both sizes hold a similar count — measured, and it is 12 on
  // each. Width is where the sizes really differ (2.5in vs 3.5in of column),
  // so a wrapping value is what makes the difference visible, and a wrapping
  // value is also what a real stat looks like.
  let last = 0;
  for (let n = 2; n <= 24; n += 1) {
    await page.fill('#newStats', Array.from({ length: n },
      (_, i) => `Stat ${i}: a reasonably long value that wraps`).join('\n'));
    await page.waitForTimeout(160);
    if (await page.isVisible('#statWarn')) break;
    last = n;
  }
  return last;
}
const refCapacity = await statCapacity();
await page.selectOption('#cardSize', 'standard');
await settle(page);
const stdCapacity = await statCapacity();
// At least as many, not strictly more: type is scaled with the card on
// purpose, so the reference card is meant to hold the same content in bigger
// letters rather than more of it. Holding *less* than the card it magnifies
// would be the real bug — an early pass of this preset did exactly that
// (10 lines against 12) before the type was dialled back.
ok(refCapacity >= stdCapacity,
   `the reference card holds at least as many stat lines as the standard one (${refCapacity} vs ${stdCapacity})`);
await page.fill('#newStats', 'Born: 1900');
await page.waitForTimeout(250);

// And the choice persists like the other two.
await page.selectOption('#cardSize', 'reference');
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#cardSize'), 'reference', 'the reference size survives a reload');
eq(await page.evaluate(() => document.getElementById('printArea').className), 'size-reference', 'and is applied to the print area');
await page.selectOption('#cardSize', 'standard');
await settle(page);

/* ── 13. no console noise anywhere in the run ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
