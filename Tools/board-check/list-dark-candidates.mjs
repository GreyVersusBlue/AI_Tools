// list-dark-candidates.mjs — how much work is left in the Path 5 P3 dark-mode
// rollout, per tool. Sibling of list-base-css-candidates.mjs (`phase4:next`),
// same shape: read-only, ranked, tells a rollout session what to pick up.
//
//   npm run path5:next                 ranked list + totals
//   npm run path5:next -- --batch 8    the 8 lightest, as one batch
//
// Read-only. Not a suite and not a guard — it never fails, it just measures, so
// a rollout session can size a batch instead of guessing.
//
// WHY IT EXISTS. Adopting native dark is not "set A11Y_NATIVE_THEME and ship".
// A tool on _shared/ink-paper.css that flips the flag with white still
// hardcoded in its own <style> gets pale ink on white cards. So the real unit
// of work is: how many white / near-white literals does this page's SCREEN css
// hold? That is what this counts, and the count is a good proxy for how long a
// tool takes to convert (001, the reference adopter, was ~20 and took an hour).
//
// WHAT IT COUNTS, and what it deliberately does not:
//   * only the page's own <style> blocks — not linked CSS, not inline script;
//   * @media print blocks are stripped first: print is always on paper, and
//     ink-paper.css already restores the light tokens there, so nothing inside
//     a print block needs converting;
//   * `white-space` and friends are excluded (an earlier hand count did not
//     exclude them and inflated the whole estimate by roughly 3x — that is the
//     mistake this file exists to stop repeating);
//   * near-white means #fff / #ffffff / `white` / #fxx / #fxxxxx. Light *tints*
//     (#eee, #eeece3, #e4f5ea) are NOT counted and are extra work: they need a
//     light/dark pair each, the way 001's four status tints did. So every
//     number here is a floor.
//
// A `P` in the output means the tool has an #printArea, which ink-paper.css
// already treats as a sheet of paper — those tools usually need no `.paper-sheet`
// marking of their own.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const batchArg = process.argv.indexOf('--batch');
const batchSize = batchArg > -1 ? Number(process.argv[batchArg + 1]) || 8 : 0;

/** Every live page under Tools/ that links the ink/paper palette. */
function inkPaperPages(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(SITE, full).split(path.sep).join('/');
    if (rel.startsWith('Tools/New Designs') || rel.startsWith('Tools/Old Designs')) continue;
    if (fs.statSync(full).isDirectory()) inkPaperPages(full, out);
    else if (name.endsWith('.html') && /_shared\/ink-paper\.css/.test(fs.readFileSync(full, 'utf8'))) {
      out.push(rel);
    }
  }
  return out;
}

const PRINT_BLOCK = /@media\s+print\s*\{(?:[^{}]|\{[^{}]*\})*\}/g;
const NEAR_WHITE = /#fff\b|#ffffff\b|#f[0-9a-f]{2}\b|#f[0-9a-f]{5}\b|(?<![\w-])white(?![\w-])/gi;

const rows = [];
let adopted = 0;
for (const rel of inkPaperPages(path.join(SITE, 'Tools')).sort()) {
  const src = fs.readFileSync(path.join(SITE, rel), 'utf8');
  if (/A11Y_NATIVE_THEME\s*=\s*true/.test(src)) { adopted++; continue; }
  const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const screen = styles.replace(PRINT_BLOCK, '');
  rows.push({
    rel: rel.replace(/^Tools\//, ''),
    n: (screen.match(NEAR_WHITE) || []).length,
    printArea: /id="printArea"/.test(src),
  });
}
rows.sort((a, b) => a.n - b.n || a.rel.localeCompare(b.rel));

if (batchSize) {
  const batch = rows.slice(0, batchSize);
  console.log(`The ${batch.length} lightest unadopted tools (${batch.reduce((s, r) => s + r.n, 0)} literals in total):\n`);
  for (const r of batch) console.log(`  ${String(r.n).padStart(3)}  ${r.printArea ? 'P' : ' '}  ${r.rel}`);
  console.log('\nCopy 001-hall-pass-log.html; read _shared/ink-paper.css\'s header first.');
} else {
  const total = rows.reduce((s, r) => s + r.n, 0);
  const mid = rows.length ? rows[Math.floor(rows.length / 2)].n : 0;
  for (const r of rows) console.log(`${String(r.n).padStart(3)}  ${r.printArea ? 'P' : ' '}  ${r.rel}`);
  console.log(`\n${rows.length} unadopted, ${adopted} adopted. ${total} literals left, ` +
              `${rows.length ? rows[0].n : 0}-${rows.length ? rows[rows.length - 1].n : 0} per tool, median ${mid}. ` +
              `${rows.filter(r => r.printArea).length} have an #printArea.`);
}
