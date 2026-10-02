// smoke-entities.mjs — 055 Daily Editing Warm-Up never shows a literal HTML entity.
//
//   node Tools/daily-editing-warmup-generator/test/smoke-entities.mjs
//
// The bug this pins (found in #208): the built-in sentences were stored with
// `&rsquo;` inside them, and the page's three sinks disagreed. The corrected
// sentence was set with innerHTML (entity decoded), the broken one with
// textContent (entity shown as the six characters "&rsquo;"), so two projector
// rows displayed "they&rsquo;re" on a classroom wall. The fix stores the real
// character and routes both sentences through textContent / escapeHtml.
// `check:entities` could not see it (an array literal, read back through a
// variable) — its data-flow rule now can, and this suite is the other half:
// it looks at what the page actually renders, on every surface a sentence
// reaches, rather than at the source.
//
// Surfaces: the projector (broken + corrected), the worksheet and its key, and
// the sentence bank. Plus a round trip: a sentence a teacher types that
// contains entity-shaped text must come back exactly as typed on all of them.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8261;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/055-daily-editing-warmup-generator.html';
const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});/;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
page.__errs = [];
page.on('pageerror', e => page.__errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') page.__errs.push(m.text()); });

console.log('055 Daily Editing Warm-Up — no literal entities on any surface');

await page.goto(PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. projector: step through every built-in sentence ──────────────────── */
const total = await page.evaluate(() => document.getElementById('displayNum').textContent);
const n = Number((/of (\d+)/.exec(total) || [])[1]);
ok(n >= 24, `the projector knows its sentence count (${total})`);

const shown = [];
for (let i = 0; i < n; i++) {
  shown.push(await page.evaluate(() => ({
    broken: document.getElementById('displayBroken').textContent,
    fixed: document.getElementById('displayFixed').textContent,
  })));
  await page.click('#nextBtn');
}
const leakedProjector = shown.filter(s => ENTITY.test(s.broken) || ENTITY.test(s.fixed));
eq(leakedProjector.length, 0, 'no built-in sentence projects a literal entity: ' + JSON.stringify(leakedProjector.slice(0, 2)));
ok(shown.some(s => s.fixed.includes('’')), 'the curly apostrophe renders as the character itself on the projector');
ok(shown.some(s => s.broken.includes('’')), 'and so does a broken sentence that contains one');

/* ── 2. worksheet and key ────────────────────────────────────────────────── */
await page.click('[data-stage="sheet"]');
await page.fill('#sheetCount', '30');
await page.click('#buildSheetBtn');
const sheet = await page.evaluate(() => ({
  problems: document.getElementById('sheetProblems').textContent,
  key: document.getElementById('sheetKey').textContent,
}));
ok(sheet.problems.length > 200 && sheet.key.length > 200, 'the worksheet and key built');
ok(!ENTITY.test(sheet.problems), 'the worksheet shows no literal entity');
ok(!ENTITY.test(sheet.key), 'the answer key shows no literal entity');

/* ── 3. the bank, then a typed round trip on every surface ───────────────── */
const TYPED_BROKEN = 'tom &amp; jerry cant &rsquo; stop';
const TYPED_FIXED = 'Tom &amp; Jerry can’t stop.';
await page.click('[data-stage="bank"]');
await page.fill('#newBroken', TYPED_BROKEN);
await page.fill('#newFixed', TYPED_FIXED);
await page.click('#addSentenceBtn');
await settle(page, 200);

const bank = await page.evaluate(() => ({
  text: document.getElementById('bankList').textContent,
  editBroken: [...document.querySelectorAll('.edit-broken')].map(t => t.value),
  editFixed: [...document.querySelectorAll('.edit-fixed')].map(t => t.value),
}));
ok(!ENTITY.test(bank.text.replace(TYPED_BROKEN, '').replace(TYPED_FIXED, '')), 'the built-in bank rows show no literal entity');
ok(bank.editBroken.includes(TYPED_BROKEN), 'a typed broken sentence is editable exactly as typed (no double-escaping)');
ok(bank.editFixed.includes(TYPED_FIXED), 'a typed correction is editable exactly as typed');

// Show only the new sentence on the projector: step until it comes up.
await page.click('[data-stage="display"]');
let seen = null;
for (let i = 0; i < n + 2 && !seen; i++) {
  const s = await page.evaluate(() => ({
    broken: document.getElementById('displayBroken').textContent,
    fixed: document.getElementById('displayFixed').textContent,
  }));
  if (s.broken === TYPED_BROKEN) seen = s;
  else await page.click('#nextBtn');
}
ok(!!seen, 'the typed sentence reaches the projector');
if (seen) eq(seen.fixed, TYPED_FIXED, 'with its correction, character for character');

await page.click('[data-stage="sheet"]');
await page.fill('#sheetCount', '30');
await page.click('#buildSheetBtn');
const sheet2 = await page.evaluate(() => ({
  problems: document.getElementById('sheetProblems').textContent,
  key: document.getElementById('sheetKey').textContent,
}));
ok(sheet2.problems.includes(TYPED_BROKEN), 'the worksheet prints the typed sentence exactly as typed');
ok(sheet2.key.includes(TYPED_FIXED), 'the key prints the typed correction exactly as typed');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing went offsite: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
