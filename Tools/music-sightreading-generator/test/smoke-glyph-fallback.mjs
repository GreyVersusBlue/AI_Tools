// smoke-glyph-fallback.mjs — the musical-glyph probe and its drawn fallback.
//
//   node Tools/music-sightreading-generator/test/smoke-glyph-fallback.mjs
//
// The rhythm display is built out of characters from the Unicode Musical
// Symbols block. Plenty of school machines have no font covering it, and the
// projector then shows a row of empty boxes where the warm-up should be. The
// tool now measures those characters at load and draws its own note shapes
// when they are missing. What this suite holds down:
//
//   The probe answers, and answers per character. It has to distinguish a
//   character the font really has from one that fell back to the
//   missing-glyph box; U+FFFF is the control, since no font can ever have it.
//
//   Every place a note appears follows the same decision — the measure row,
//   the big single-measure display, the samples beside the pool checkboxes,
//   and the printed sheet. A drawn measure row next to tofu checkbox labels
//   would be a half-fix.
//
//   The teacher can override the probe in both directions, and that choice is
//   remembered.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8167;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/067-music-sightreading-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });

/** How the notes in a container are being rendered: 'drawn' if every glyph
 *  holds an <svg>, 'font' if every glyph holds a character, 'mixed' if not
 *  all one way, 'none' if there is nothing there. */
const renderStyle = sel => page.evaluate(s => {
  const glyphs = Array.from(document.querySelectorAll(s + ' .glyph'));
  if (!glyphs.length) return 'none';
  const drawn = glyphs.filter(g => g.querySelector('svg')).length;
  if (drawn === glyphs.length) return 'drawn';
  if (drawn === 0) return 'font';
  return 'mixed';
}, sel);

console.log('Music Sight-Reading Generator — glyph probe and drawn fallback');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. the probe distinguishes present from missing ─────────────────────── */
const probe = await page.evaluate(() => {
  // Same measurement the tool makes: compare against U+FFFF, which no font
  // can ever have, so it always renders as the missing-glyph box.
  const measure = ch => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:100px;line-height:1;white-space:nowrap;';
    const s = document.createElement('span'); s.textContent = ch;
    d.appendChild(s); document.body.appendChild(d);
    const w = s.getBoundingClientRect().width;
    d.remove();
    return w;
  };
  return {
    control: measure('￿'),
    letter: measure('A'),
    half: measure('\u{1D15E}'),
  };
});
ok(probe.control > 0, 'the control character measures as a real box, not zero width');
ok(Math.abs(probe.letter - probe.control) > 0.5, 'a character the font definitely has measures differently from the box');

const detected = await page.evaluate(() => document.getElementById('glyphNotice').textContent);
const probeSaysMissing = /no font for/.test(detected);
console.log(`  (this machine ${probeSaysMissing ? 'lacks' : 'has'} the musical symbol font)`);

/* ── 2. Automatic follows the probe ──────────────────────────────────────── */
eq(await page.inputValue('#notationMode'), 'auto', 'the tool starts on Automatic');
eq(await renderStyle('#rhythmDisplay'), probeSaysMissing ? 'drawn' : 'font',
   'Automatic renders whichever way the probe called for');
if (probeSaysMissing) {
  ok(/being drawn instead/.test(detected), 'and says why it looks different: ' + JSON.stringify(detected));
}

/* ── 3. forcing Drawn shapes reaches every display ───────────────────────── */
await page.selectOption('#notationMode', 'drawn');
await settle(page);
eq(await renderStyle('#rhythmDisplay'), 'drawn', 'the measure row draws its notes');
eq(await renderStyle('#rhythmPool'), 'drawn', 'so do the samples beside the pool checkboxes');

await page.check('#bigModeToggle');
await settle(page);
eq(await renderStyle('#bigMeasureDisplay'), 'drawn', 'so does the big single-measure display');
await page.uncheck('#bigModeToggle');
await settle(page);

await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
eq(await renderStyle('#printRhythmDisplay'), 'drawn', 'and so does the printed sheet');

/* the drawn shapes are real, distinguishable figures — not four copies of one */
const shapes = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('#rhythmPool .pool-sample svg'))
    .map(s => s.getAttribute('aria-label'));
  return labels;
});
eq(shapes.join(' | '), 'quarter note | pair of beamed eighth notes | half note | quarter rest',
   'each rhythm value draws its own labelled shape');

/* ── 4. forcing Font symbols goes back to characters, with a warning ─────── */
await page.selectOption('#notationMode', 'font');
await settle(page);
eq(await renderStyle('#rhythmDisplay'), 'font', 'Font symbols puts the characters back');
eq(await renderStyle('#rhythmPool'), 'font', 'including on the checkbox samples');
if (probeSaysMissing) {
  ok(/will show as empty boxes/.test(await page.textContent('#glyphNotice')),
     'and warns that this machine cannot show them');
}

/* ── 5. the choice is remembered ─────────────────────────────────────────── */
await page.selectOption('#notationMode', 'drawn');
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#notationMode'), 'drawn', 'the notation choice survives a reload');
eq(await renderStyle('#rhythmDisplay'), 'drawn', 'and is applied on load');

/* ── 6. the staff still names its clef when the clef glyph is missing ────── */
await page.click('#pitchTabBtn');
await settle(page);
const clef = await page.evaluate(() => {
  const t = document.querySelector('#pitchDisplay svg text');
  return t ? t.textContent : null;
});
ok(clef === '\u{1D11E}' || clef === 'TREBLE',
   'the staff opens with either the clef glyph or the word: ' + JSON.stringify(clef));
if (probeSaysMissing) {
  eq(clef, 'TREBLE', 'with no clef font, the staff is labelled in words rather than a box');
  await page.selectOption('#clefSelect', 'bass');
  await settle(page);
  eq(await page.evaluate(() => document.querySelector('#pitchDisplay svg text').textContent), 'BASS',
     'and follows the clef choice');
}

/* ── 7. the rhythm is still musically correct in drawn mode ──────────────── */
await page.click('#rhythmTabBtn');
await settle(page);
await page.selectOption('#timeSig', '3');
await page.click('#newRhythmBtn');
await settle(page);
const beatsPerMeasure = await page.evaluate(() => {
  const BEATS = { 'quarter note': 1, 'pair of beamed eighth notes': 1, 'half note': 2, 'quarter rest': 1 };
  return Array.from(document.querySelectorAll('#rhythmDisplay .measure')).map(m =>
    Array.from(m.querySelectorAll('.glyph svg')).reduce((sum, s) => sum + BEATS[s.getAttribute('aria-label')], 0));
});
ok(beatsPerMeasure.length > 0 && beatsPerMeasure.every(b => b === 3),
   'every drawn measure still sums to the time signature: ' + JSON.stringify(beatsPerMeasure));

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
