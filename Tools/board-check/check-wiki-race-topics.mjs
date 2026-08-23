#!/usr/bin/env node
// check-wiki-race-topics.mjs — dev-only, read-only, rewrites nothing.
//
// Validates every title in the Wiki Race TOPICS list (Tools/086-wiki-race.html)
// against the live Wikipedia API: reports titles that are missing/invalid,
// titles that are redirects (consider swapping for the canonical form), and
// duplicates across categories. Needs normal internet access — it cannot run
// from a network that blocks en.wikipedia.org.
//
// Usage: node Tools/board-check/check-wiki-race-topics.mjs
// Exit codes: 0 = no missing titles, 1 = missing/invalid titles found.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(repoRoot, 'Tools', '086-wiki-race.html'), 'utf8');
const m = html.match(/var TOPICS = (\{[\s\S]*?\n\});/);
if (!m) {
  console.error('check-wiki-race-topics: TOPICS block not found in 086-wiki-race.html');
  process.exit(1);
}
const TOPICS = new Function('return ' + m[1])();

const all = [];
const seen = new Map();
let dupes = 0;
for (const [cat, arr] of Object.entries(TOPICS)) {
  for (const t of arr) {
    if (seen.has(t)) { console.log(`DUPLICATE: "${t}" in "${cat}" and "${seen.get(t)}"`); dupes++; }
    else seen.set(t, cat);
    all.push(t);
  }
}
console.log(`${all.length} titles across ${Object.keys(TOPICS).length} categories`);

const missing = [];
const redirected = [];
for (let i = 0; i < all.length; i += 50) {
  const batch = all.slice(i, i + 50);
  const qs = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2',
    redirects: '1', titles: batch.join('|'),
  });
  const res = await fetch('https://en.wikipedia.org/w/api.php?' + qs, {
    // Wikipedia's API policy rejects default/empty user agents.
    headers: { 'User-Agent': 'EastMiddleStaffToolkit-WikiRace-check/1.0 (aspermylessonplan.com)' },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} from Wikipedia on batch starting at ${i} — aborting.`);
    process.exit(1);
  }
  const q = (await res.json()).query || {};
  for (const r of q.redirects || []) redirected.push(`${r.from} -> ${r.to}`);
  for (const p of q.pages || []) {
    if (p.missing || p.invalid) missing.push(p.title);
  }
  await new Promise(r => setTimeout(r, 200));
}

if (redirected.length) {
  console.log(`\nredirects (game handles these at runtime; swap for the canonical form when convenient):`);
  redirected.forEach(t => console.log('  ' + t));
}
if (missing.length || dupes) {
  console.log(`\nMISSING/INVALID (${missing.length}) — these break races that draw them:`);
  missing.forEach(t => console.log('  ' + t));
  process.exit(1);
}
console.log('\ncheck-wiki-race-topics: OK — every title exists on en.wikipedia.org.');
