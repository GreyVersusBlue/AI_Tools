// check-social.test.mjs — the og:image rule `check:social` gained in AI-43.
//
//   node Tools/board-check/test/check-social.test.mjs   (or: npm run test:check-social)
//
// Until AI-43 every page that named a social card named one that did not exist
// (assets/og/ was not in the tree; 11 pages named a file on another domain), so
// every shared link showed a blank card and no check said so. ogImageProblems()
// is the rule that would have: an og:image or twitter:image must name a file
// directly under /assets/og/ that is in the tree. These fixtures pin it, then
// the real tree is run through it. Pure Node, no browser.

import fs from 'node:fs';
import path from 'node:path';
import { ogImageProblems, canonicalProblems } from '../check-social.mjs';
import { SITE } from '../harness.mjs';

let passed = 0, failed = 0;
const have = new Set(['toolbook.png', 'inbox.png']);
const exists = name => have.has(name);
const check = (label, html, want) => {
  const got = ogImageProblems(html, exists);
  if (got.length === want) passed++;
  else { failed++; console.log(`  FAIL ${label}: ${got.length} problems (want ${want})${got.length ? '\n    ' + got.join('\n    ') : ''}`); }
};
const og = url => `<meta property="og:image" content="${url}">`;
const tw = url => `<meta name="twitter:image" content="${url}">`;

check('a card in the tree, both tags', og('https://www.aspermylessonplan.com/assets/og/toolbook.png') + tw('https://www.aspermylessonplan.com/assets/og/toolbook.png'), 0);
check('the apex domain names the same folder', og('https://aspermylessonplan.com/assets/og/inbox.png'), 0);
check('a page with no image at all is not this rule', '<meta property="og:title" content="x"><meta name="twitter:card" content="summary_large_image">', 0);
check('og:image:alt / :width are not images', '<meta property="og:image:alt" content="assets/og/gone.png"><meta property="og:image:width" content="1200">', 0);

// What the tree held before AI-43.
const before = new Set();
const fails = (html) => ogImageProblems(html, n => before.has(n)).length;
if (fails(og('https://www.aspermylessonplan.com/assets/og/toolbook.png') + tw('https://www.aspermylessonplan.com/assets/og/toolbook.png')) === 2) passed++;
else { failed++; console.log('  FAIL an empty assets/og/ fails both tags of index.html'); }
check('the 11 guild-board pages before: a file never in the tree', og('https://greyversusblue.com/assets/og/guild-board.png') + tw('https://greyversusblue.com/assets/og/guild-board.png'), 2);

check('a missing card fails', og('https://www.aspermylessonplan.com/assets/og/plan.png'), 1);
check('only twitter:image missing fails once', og('https://www.aspermylessonplan.com/assets/og/toolbook.png') + tw('https://www.aspermylessonplan.com/assets/og/gone.png'), 1);
check('an image outside assets/og/ fails', og('https://www.aspermylessonplan.com/assets/art/hero/classroom-2x-light.webp'), 1);
check('a nested path under assets/og/ fails', og('https://www.aspermylessonplan.com/assets/og/old/toolbook.png'), 1);
check('an empty content fails', '<meta property="og:image" content="">', 1);
check('attribute order does not matter', '<meta content="https://www.aspermylessonplan.com/assets/og/gone.png" property="og:image">', 1);

// (AI-74) og:url + canonical.
const U = 'https://www.aspermylessonplan.com/Tools/001-hall-pass-log.html';
const ou = u => `<meta property="og:url" content="${u}">`;
const cl = u => `<link rel="canonical" href="${u}">`;
const addr = (label, html, want) => {
  const got = canonicalProblems(html);
  if (got.length === want) passed++;
  else { failed++; console.log(`  FAIL ${label}: ${got.length} problems (want ${want})${got.length ? '\n    ' + got.join('\n    ') : ''}`); }
};
addr('matching og:url and canonical on the site', ou(U) + cl(U), 0);
addr('a page with neither is not this rule', '<title>x</title>', 0);
addr('the old greyversusblue host fails both tags', ou(U.replace('www.aspermylessonplan.com', 'greyversusblue.com')) + cl(U.replace('www.aspermylessonplan.com', 'greyversusblue.com')), 2);
addr('the apex domain is not the canonical host', ou(U.replace('www.', '')) + cl(U.replace('www.', '')), 2);
addr('http is not https', ou(U.replace('https', 'http')) + cl(U.replace('https', 'http')), 2);
addr('a canonical that differs fails', ou(U) + cl(U.replace('001-hall-pass-log', '002-group-team-generator')), 1);
addr('og:url with no canonical fails', ou(U), 1);
addr('canonical with no og:url fails', cl(U), 1);
addr('a wrong-host og:url beside a right canonical fails twice', ou('https://greyversusblue.com/x.html') + cl(U), 2);
addr('attribute order and rel case do not matter', `<link href="${U}" rel="Canonical"><meta content="${U}" property="og:url">`, 0);

// The real tree: every page that names a card names one that is there.
const OG = path.join(SITE, 'assets', 'og');
const real = n => fs.existsSync(path.join(OG, n));
const pages = [
  ...fs.readdirSync(SITE).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(SITE, 'Tools')).filter(f => f.endsWith('.html')).map(f => `Tools/${f}`),
];
let naming = 0;
for (const rel of pages) {
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  if (/property="og:image"/.test(html)) naming++;
  const got = ogImageProblems(html, real);
  if (got.length) { failed++; console.log(`  FAIL ${rel}: ${got.join('; ')}`); }
}
if (naming >= 45) passed++;
else { failed++; console.log(`  FAIL only ${naming} pages name a card (AI-43 left 45)`); }

const toolDir = path.join(SITE, 'Tools');
let withUrl = 0;
for (const f of fs.readdirSync(toolDir).filter(x => x.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(toolDir, f), 'utf8');
  if (!/property="og:url"/.test(html)) continue;
  withUrl++;
  const got = canonicalProblems(html);
  if (got.length) { failed++; console.log(`  FAIL Tools/${f}: ${got.join('; ')}`); }
}
if (withUrl >= 83) passed++;
else { failed++; console.log(`  FAIL only ${withUrl} tool pages have an og:url (AI-74 left 83)`); }

console.log(`check-social: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
