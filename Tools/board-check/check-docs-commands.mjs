// check-docs-commands.mjs — read-only guard that a tracked .md naming a command
// is naming a command that exists.
//
//   node Tools/board-check/check-docs-commands.mjs   (or: npm run check:docs-commands)
//
// CLAUDE.md's rule is: "A document that names a command is making a claim. Run
// it once before you trust it." Three tools have now been documented in this
// repo that were never committed — `sync-social-tags.mjs`, the original
// `board-check` folder, and `list-dark-candidates.mjs`, the last one with its
// output quoted in a handoff as fact, which then became the Path 5 rollout
// backlog a later session tried to work from. Each one cost a session the time
// it takes to discover that the command in front of it does not exist, and the
// third one cost a wrong plan on top of that.
//
// This checks the two forms a .md uses to name something runnable:
//
//   1. NO SCRIPT — `npm run <name>` where `<name>` is not a key of
//                  package.json's `scripts`.
//   2. NO FILE   — `node <path>` where `<path>` does not exist in the tree.
//
// And two forms of rot in the exemptions below:
//
//   3. STALE     — a KNOWN_MISSING entry whose script now exists. The entry
//                  exists to record that a document is deliberately naming
//                  something absent; once it is present, the exemption is a
//                  lie in the other direction and the prose above it is stale
//                  too. Same discipline as suites.json's expectedFailures: the
//                  entry cannot outlive the thing it describes.
//   4. UNCLOSED  — a muted region (below) that runs to the end of its file.
//                  An unclosed marker silently exempts everything after it,
//                  which is the one way this guard could go quiet without
//                  anyone deciding that it should.
//
// TWO WAYS TO SAY "yes, I know, that is the point". A document about this
// repo's history has to be able to quote a command that no longer exists, and
// the guard is worthless if the only way to write that sentence is to contort
// around the `npm run x` form.
//
//   - KNOWN_MISSING, keyed by script name, for a name several documents cite as
//     absent — `path5:next` is cited in three places, one of them a table row.
//     Check 3 deletes the entry the day the script lands.
//   - A muted region, for a PASSAGE whose subject is dead commands:
//
//       <!-- docs-commands: off — why this passage quotes commands that are gone -->
//       ...prose that names them...
//       <!-- docs-commands: on -->
//
//     The reason after `off` is required and is printed on every run, so a
//     region cannot be added quietly, and check 4 fails on one left open.
//
// What it deliberately does NOT check:
//
//   - Bare backticked file paths (`_shared/roster.js`, `005-seating-chart.html`).
//     318 of them are cited across the tracked .md files and most are written
//     without their directory prefix, so resolving them means guessing, and
//     guessing wrong in a guard is worse than not guarding. Measured on
//     2026-09-05, not implemented.
//   - Metavariables. `npm run test:<name>` and `npm run check:<x>` are
//     placeholders, not claims; a citation whose next character is `<` is
//     skipped, as is a bare `npm run` with nothing after it.
//   - `npm test`, `npm ci`, `npx …` — not script names.
//   - Arguments. `npm run check:precache -- --base origin/main` is a claim
//     about `check:precache` and nothing else.
//
// Exit code: 0 all clean, 1 any NO SCRIPT, NO FILE, STALE or UNCLOSED.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Scripts a tracked document names on purpose, knowing they do not exist,
   because the document's subject IS that they do not exist. Each entry has to
   say why, and check 3 above deletes it the day the script lands. */
const KNOWN_MISSING = {
  'path5:next':
    'BACKLOG.md rank 8 and its live-blockers list, plus HISTORY.md, all record ' +
    'that `list-dark-candidates.mjs` was documented in a #167 handoff and never ' +
    'committed. Naming it is the point of those three sentences. Delete this ' +
    'entry in the PR that builds it.',
};

/** Tracked .md files, from git — an untracked scratch note is not a claim. */
const docs = execFileSync('git', ['ls-files', '-z', '*.md'], { cwd: SITE, encoding: 'utf8' })
  .split('\0').filter(Boolean);

const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
const scripts = new Set(Object.keys(pkg.scripts || {}));

const problems = [];
let npmCited = 0;
let nodeCited = 0;

const muted = [];

/* Line numbers make the finding actionable; a filename alone means re-grepping
   a 4,000-line BACKLOG.md by hand. */
for (const doc of docs) {
  const lines = fs.readFileSync(path.join(SITE, doc), 'utf8').split('\n');
  let off = null;
  lines.forEach((line, i) => {
    const where = `${doc}:${i + 1}`;

    /* A muted region covers the lines BETWEEN its markers, not the markers
       themselves — so `<!-- docs-commands: off -->` on the same line as a
       citation does not mute it. A marker must be ALONE on its line, which is
       what lets CLAUDE.md quote the syntax mid-sentence without opening a
       region. Regions do not nest; a second `off` is the same region
       continuing. */
    const start = line.trim().match(/^<!--\s*docs-commands:\s*off\b([^>]*?)-->$/);
    if (start && !off) {
      const reason = start[1].replace(/^\s*[-—:]\s*/, '').trim();
      off = { at: where, reason };
      return;
    }
    if (/^<!--\s*docs-commands:\s*on\b[^>]*-->$/.test(line.trim()) && off) {
      muted.push(off);
      off = null;
      return;
    }
    if (off) return;

    /* 1. NO SCRIPT. The capture stops at the first character that cannot be in
       a script name, so the `<` of a metavariable and the space before an
       argument both end it; an empty capture is the placeholder form. */
    for (const m of line.matchAll(/\bnpm run ([A-Za-z0-9:_-]*)/g)) {
      const name = m[1];
      if (!name || line[m.index + m[0].length] === '<') continue;
      npmCited++;
      if (scripts.has(name) || KNOWN_MISSING[name]) continue;
      problems.push(`NO SCRIPT   ${where}\n            \`npm run ${name}\` — package.json defines no such script`);
    }

    /* 2. NO FILE. */
    for (const m of line.matchAll(/\bnode ([A-Za-z0-9_][A-Za-z0-9_./-]*\.m?js)\b/g)) {
      const target = m[1];
      nodeCited++;
      if (fs.existsSync(path.join(SITE, target))) continue;
      problems.push(`NO FILE     ${where}\n            \`node ${target}\` — that file is not in the tree`);
    }
  });

  /* 4. UNCLOSED. */
  if (off) {
    problems.push(`UNCLOSED    ${off.at}\n            a \`docs-commands: off\` region is never closed, so it mutes ` +
      `the rest of ${doc}\n            Add \`<!-- docs-commands: on -->\` where the passage ends`);
  }
}

/* 3. STALE. */
for (const [name, reason] of Object.entries(KNOWN_MISSING)) {
  if (!scripts.has(name)) continue;
  const why = reason.replace(/\s+/g, ' ').trim();
  problems.push(`STALE       ${name} is in KNOWN_MISSING but package.json now defines it\n` +
    `            The exemption said: ${why}\n` +
    '            Delete the entry, and fix the prose that says it does not exist');
}

if (problems.length) {
  console.error('\ncheck-docs-commands: a tracked document names a command that is not there (' +
    problems.length + ' problem' + (problems.length === 1 ? '' : 's') + '):\n');
  for (const p of problems.sort()) console.error('  ' + p);
  console.error('\nEither add the command, or correct the sentence. Do not add a KNOWN_MISSING');
  console.error('entry to quiet this unless the document\'s subject genuinely IS that the');
  console.error('command is absent — a reader who runs what a document tells them to run and');
  console.error('gets "Missing script" has been handed a wrong plan, not a typo.');
  process.exit(1);
}

/* Print every muted region on every run, the way run-suites.mjs prints every
   expected failure: an exemption nobody sees is an exemption nobody revisits. */
for (const m of muted) {
  console.warn(`check-docs-commands: muted  ${m.at} — ${m.reason || '(no reason given)'}`);
}

const exempt = Object.keys(KNOWN_MISSING).length;
console.log(`check-docs-commands: OK — ${npmCited} \`npm run\` and ${nodeCited} \`node <path>\` ` +
  `citations across ${docs.length} tracked .md files all resolve` +
  (exempt ? `; ${exempt} exempt by name (${Object.keys(KNOWN_MISSING).join(', ')})` : '') +
  (muted.length ? `; ${muted.length} muted region${muted.length === 1 ? '' : 's'}` : '') + '.');
