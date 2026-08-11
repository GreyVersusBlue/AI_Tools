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
//
// What is reported but NOT failed, because it is uniform generator output
// rather than per-file drift — a rebuilt generator has to decide these:
//   - two block generations coexist: an older one branded greyversusblue.com
//     (with the guild-board og:image set) and a newer one branded
//     AsPerMyLessonPlan.com (with no image at all)
//   - the imageless generation still declares twitter:card
//     "summary_large_image", which asks card renderers for an image it
//     doesn't provide
//   - tools with no block at all (the generator was never run against them)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS = path.join(SITE, 'Tools');

const files = fs.readdirSync(TOOLS).filter(f => f.endsWith('.html')).sort();

let checked = 0, failed = 0;
const missing = [];
const problems = [];
const origins = new Map();     // origin+brand -> [files]
const largeCardNoImage = [];
const problem = (file, msg) => { problems.push(`${file}: ${msg}`); };

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};

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
process.exit(failed ? 1 : 0);
