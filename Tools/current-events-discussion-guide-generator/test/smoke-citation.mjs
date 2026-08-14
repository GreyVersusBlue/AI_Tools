// smoke-citation.mjs — the article link (citation), and the reading-level
// estimate as it appears in the editor.
//
//   node Tools/current-events-discussion-guide-generator/test/smoke-citation.mjs
//
// "Students should read the source themselves" is only true if the handout
// carries a way to get back to the source. What this suite holds down:
//
//   1. The printed sheet carries the URL in full — typeable, and the only
//      form that survives a photocopy — plus a QR code for a phone.
//   2. A teacher pasting a bare domain gets a working link rather than a
//      complaint, because that is what pasting from a browser bar produces.
//   3. A URL with a scheme this tool has no business making clickable
//      (javascript:, data:) is refused and never becomes a link in the
//      teacher's own page or on the sheet.
//   4. The link is part of the guide: it saves, reloads, and travels in the
//      share link with everything else.
//   5. The reading-level estimate reaches the editor, and says "too short"
//      rather than guessing on two sentences. (The arithmetic itself is
//      covered in readability.test.mjs, next to this file.)
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8211;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/054-current-events-discussion-guide-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Current Events Discussion Guide — article link + reading level');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

const ARTICLE = `The city council approved new bike lanes on Main Street this week.
The work will take about three weeks to finish. Drivers will have one lane in
each direction once it is done. Riders told the council the street felt unsafe
before the change. Shop owners on the block were split on the plan. The council
will review a traffic count in the fall and may vote again in June.`;

await page.fill('#articleTitle', 'City Council Approves New Bike Lanes');
await page.fill('#articleSource', 'Local Gazette, March 2026');
await page.fill('#articleText', ARTICLE);
await settle(page, 200);

/* ── 1. the reading-level estimate reaches the editor ────────────────────── */
const hint = await page.textContent('#wordCountHint');
ok(/\d+ words/.test(hint), 'the length is still shown: ' + JSON.stringify(hint));
ok(/min read/.test(hint), 'and the read time');
ok(/reads around grades|college level/.test(hint), 'and the reading level: ' + JSON.stringify(hint));
ok(/words\/sentence/.test(hint), 'with the sentence length it is based on, so it reads as an estimate');

await page.fill('#articleText', 'The council met. It voted.');
await settle(page, 200);
ok(/too short/.test(await page.textContent('#wordCountHint')),
   'two sentences report "too short" rather than a made-up grade level');
await page.fill('#articleText', ARTICLE);
await settle(page, 200);

/* ── 2. a bare domain becomes a real link ────────────────────────────────── */
await page.fill('#articleUrl', 'example.com/news/bike-lanes');
await settle(page, 200);
const bareHint = await page.textContent('#articleUrlHint');
ok(/https:\/\/example\.com\/news\/bike-lanes/.test(bareHint),
   'a pasted bare domain is upgraded to https:// : ' + JSON.stringify(bareHint));
eq(await page.getAttribute('#articleUrlHint a', 'href'), 'https://example.com/news/bike-lanes',
   'and the click-through points at it');
eq(await page.getAttribute('#articleUrlHint a', 'rel'), 'noopener noreferrer',
   'the click-through opens safely');

/* ── 3. a scheme with no business here is refused ────────────────────────── */
for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
  await page.fill('#articleUrl', bad);
  await settle(page, 200);
  ok(/doesn’t look like a web address/.test(await page.textContent('#articleUrlHint')),
     `${bad.slice(0, 24)}… is refused in the editor`);
  eq(await page.evaluate(() => document.querySelectorAll('#articleUrlHint a').length), 0,
     `${bad.slice(0, 24)}… never becomes a clickable link`);

  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBtn');
  await settle(page);
  eq(await page.evaluate(() => {
    const html = document.getElementById('printArea').innerHTML;
    return /javascript:|data:text\/html/.test(html);
  }), false, `${bad.slice(0, 24)}… never reaches the printed sheet either`);
}

/* ── 4. the printed sheet carries the URL and a QR code ──────────────────── */
await page.fill('#articleUrl', 'https://example.com/news/bike-lanes');
await settle(page, 200);
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);

const printed = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  const cite = area.querySelector('.article-source');
  const qr = area.querySelector('.source-qr');
  return {
    citeText: cite ? cite.textContent : '',
    href: cite && cite.querySelector('a') ? cite.querySelector('a').getAttribute('href') : '',
    qrSrc: qr ? qr.getAttribute('src').slice(0, 22) : '',
    qrAlt: qr ? qr.getAttribute('alt') : '',
  };
});
ok(/Local Gazette, March 2026/.test(printed.citeText), 'the printed citation keeps the source and date');
ok(/https:\/\/example\.com\/news\/bike-lanes/.test(printed.citeText),
   'and prints the URL in full, so it can be typed off paper');
ok(/Read it yourself/.test(printed.citeText), 'framed as something the student should go and do');
eq(printed.href, 'https://example.com/news/bike-lanes', 'and is a real link when the sheet is read on a screen');
eq(printed.qrSrc, 'data:image/png;base64,', 'a QR code is inlined on the sheet, not fetched');
ok(printed.qrAlt.length > 0, 'the QR image has alt text');

/* ── 5. the link is part of the guide ────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#articleUrl'), 'https://example.com/news/bike-lanes', 'the link survives a reload');

const shareUrl = await page.evaluate(async () => {
  let captured = null;
  navigator.clipboard.writeText = (t) => { captured = t; return Promise.resolve(); };
  document.getElementById('shareLinkBtn').click();
  await new Promise(r => setTimeout(r, 80));
  return captured;
});
ok(!!shareUrl, 'the copy-link button produced a link');
await page.goto(shareUrl, { waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#articleUrl'), 'https://example.com/news/bike-lanes',
   'and the article link travels in the share link with everything else');

/* ── 6. the comparison layout prints both links, without the QR codes ────── */
await page.click('#addArticleBBtn');
await settle(page);
await page.fill('#articleTitleB', 'Council Votes to Remove Fifth Street Parking');
await page.fill('#articleSourceB', 'City Register, March 2026');
await page.fill('#articleUrlB', 'https://example.org/register/parking');
await page.fill('#articleTextB', ARTICLE);
await settle(page, 250);
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
const compare = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  return {
    text: area.textContent,
    qrCount: area.querySelectorAll('.source-qr').length,
    links: Array.from(area.querySelectorAll('.article-source a')).map(a => a.getAttribute('href')),
  };
});
ok(compare.links.includes('https://example.com/news/bike-lanes'), "article A's link prints in the comparison layout");
ok(compare.links.includes('https://example.org/register/parking'), "and article B's");
eq(compare.qrCount, 0, 'the narrow comparison columns print no QR codes, by design');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
