// check-social.mjs — read-only validator for the gvb:social meta blocks.
//
//   node Tools/board-check/check-social.mjs
//
// The generator that originally stamped these blocks
// (Tools/board-check/sync-social-tags.mjs) was never committed to this
// repository, so the blocks are effectively hand-maintained until it is
// rebuilt from a real spec (see CLAUDE.md). This script exists so drift is at
// least *visible*: it validates every block's internal consistency without
// rewriting a single byte. It has no write path at all.
//
// What counts as a failure (exit 1):
//   - unpaired or duplicated gvb:social:start / gvb:social:end markers
//   - a required core tag missing inside a block
//   - og:url whose path does not point at the file it lives in
//   - og:title / twitter:title disagreeing, or descriptions disagreeing
//     across meta description / og:description / twitter:description
//   - a partial image group (some of og:image / og:image:width / height /
//     alt / twitter:image but not all, or og:image != twitter:image)
//   - (AI-43) an og:image or twitter:image, on index.html, a root page or a
//     tool page, block or no block, that does not name a file present in
//     assets/og/. The cards are made by Tools/board-check/make-og.mjs; a page
//     naming a card that is not in the tree is a blank card for whoever the
//     link is shared with, which is what every shared link was until AI-43.
//
// What is reported but NOT failed, because it is uniform generator output
// rather than per-file drift — a rebuilt generator has to decide these:
//   - two block generations coexist: an older one branded greyversusblue.com
//     and a newer one branded AsPerMyLessonPlan.com. Since AI-43 both name
//     the one card, https://www.aspermylessonplan.com/assets/og/toolbook.png
//     (greyversusblue.com does not serve this tree, so the older block's own
//     guild-board.png could never load); og:url and og:site_name still differ
//   - a block declaring twitter:card "summary_large_image" with no image,
//     which asks card renderers for an image it doesn't provide (none since
//     AI-43; a new block should carry the toolbook.png group)
//   - tools with no block at all (the generator was never run against them)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS = path.join(SITE, 'Tools');

const OG_DIR = path.join(SITE, 'assets', 'og');

/**
 * The image problems of one page: every og:image / twitter:image <meta> in it
 * must name a file directly under /assets/og/ that `exists(name)` says is
 * there. Pure, so the test can hand it fixtures. Returns messages.
 */
export function ogImageProblems(html, exists) {
  const out = [];
  for (const m of html.matchAll(/<meta [^>]*>/g)) {
    const tag = m[0];
    const key = attr(tag, 'property') || attr(tag, 'name');
    if (key !== 'og:image' && key !== 'twitter:image') continue;
    const url = attr(tag, 'content');
    let pathname;
    try { pathname = decodeURIComponent(new URL(url, 'https://www.aspermylessonplan.com/').pathname); }
    catch { out.push(`${key} is not a valid URL: ${url}`); continue; }
    const name = pathname.startsWith('/assets/og/') ? pathname.slice('/assets/og/'.length) : '';
    if (!name || name.includes('/')) out.push(`${key} ${url} does not name a file in assets/og/`);
    else if (!exists(name)) out.push(`${key} ${url} names assets/og/${name}, which is not in the tree (make it with Tools/board-check/make-og.mjs)`);
  }
  return out;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function main() {
const files = fs.readdirSync(TOOLS).filter(f => f.endsWith('.html')).sort();

let checked = 0, failed = 0;
const missing = [];
const problems = [];
const origins = new Map();     // origin+brand -> [files]
const largeCardNoImage = [];
const problem = (file, msg) => { problems.push(`${file}: ${msg}`); };

for (const file of files) {
  const html = fs.readFileSync(path.join(TOOLS, file), 'utf8');
  const starts = [...html.matchAll(/<!-- gvb:social:start/g)];
  const ends = [...html.matchAll(/<!-- gvb:social:end -->/g)];

  if (starts.length === 0 && ends.length === 0) { missing.push(file); continue; }
  checked++;
  const before = problems.length;

  if (starts.length !== 1 || ends.length !== 1) {
    problem(file, `expected exactly one start/end marker pair, found ${starts.length} start, ${ends.length} end`);
    failed++; continue;
  }
  if (starts[0].index > ends[0].index) {
    problem(file, 'gvb:social:end appears before gvb:social:start');
    failed++; continue;
  }

  const block = html.slice(starts[0].index, ends[0].index);
  const metas = [...block.matchAll(/<meta [^>]*>/g)].map(m => m[0]);
  const byName = {};
  for (const tag of metas) {
    const key = attr(tag, 'property') || attr(tag, 'name');
    if (key) byName[key] = attr(tag, 'content');
  }

  for (const req of ['description', 'og:type', 'og:site_name', 'og:url', 'og:title',
                     'og:description', 'twitter:card', 'twitter:title',
                     'twitter:description']) {
    if (!(req in byName)) problem(file, `missing <meta> for ${req}`);
  }

  if (byName['og:url']) {
    try {
      const u = new URL(byName['og:url']);
      if (decodeURIComponent(u.pathname) !== `/Tools/${file}`) {
        problem(file, `og:url path is ${u.pathname}, expected /Tools/${encodeURIComponent(file)}`);
      }
      const brand = `${u.origin} · og:site_name "${byName['og:site_name']}"`;
      if (!origins.has(brand)) origins.set(brand, []);
      origins.get(brand).push(file);
    } catch {
      problem(file, `og:url is not a valid URL: ${byName['og:url']}`);
    }
  }

  if (byName['og:title'] !== byName['twitter:title']) {
    problem(file, `og:title (${byName['og:title']}) != twitter:title (${byName['twitter:title']})`);
  }
  if (byName['description'] !== byName['og:description'] ||
      byName['og:description'] !== byName['twitter:description']) {
    problem(file, 'meta description / og:description / twitter:description disagree');
  }

  const IMG_GROUP = ['og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:image'];
  const present = IMG_GROUP.filter(k => k in byName);
  if (present.length > 0 && present.length < IMG_GROUP.length) {
    problem(file, `partial image group: has ${present.join(', ')} but not the rest`);
  }
  if (byName['og:image'] && byName['twitter:image'] && byName['og:image'] !== byName['twitter:image']) {
    problem(file, `og:image (${byName['og:image']}) != twitter:image (${byName['twitter:image']})`);
  }
  if (!byName['og:image'] && byName['twitter:card'] === 'summary_large_image') {
    largeCardNoImage.push(file);
  }

  if (problems.length > before) failed++;
}

// og:image files: every live page, not only tool pages with a block.
const exists = name => fs.existsSync(path.join(OG_DIR, name)) && fs.statSync(path.join(OG_DIR, name)).isFile();
const pages = [
  ...fs.readdirSync(SITE).filter(f => f.endsWith('.html')).sort(),
  ...files.map(f => `Tools/${f}`),
];
let imagePages = 0, imageFailed = 0;
for (const rel of pages) {
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  if (!/property="og:image"|name="twitter:image"/.test(html)) continue;
  imagePages++;
  const found = ogImageProblems(html, exists);
  if (found.length) imageFailed++;
  for (const msg of found) problems.push(`${rel}: ${msg}`);
}

console.log(`gvb:social blocks: ${checked} tools checked, ${failed} with internal inconsistencies, ${missing.length} tools have no block\n`);
if (problems.length) {
  console.log('problems (these fail the check):\n  ' + problems.join('\n  ') + '\n');
}

console.log('block generations found (drift for a rebuilt generator to resolve, not failed here):');
for (const [brand, list] of origins) {
  console.log(`  ${brand}: ${list.length} tools`);
}
if (largeCardNoImage.length) {
  console.log(`  twitter:card "summary_large_image" with no image at all: ${largeCardNoImage.length} tools`);
}
if (missing.length) {
  console.log(`  no gvb:social block: ${missing.length} tools (${missing.slice(0, 3).join(', ')}, …)`);
}
console.log(`og:image: ${imagePages} pages name a card, ${imageFailed} name one that is not in assets/og/`);
process.exit(failed || imageFailed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
