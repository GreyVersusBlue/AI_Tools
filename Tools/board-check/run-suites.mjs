// run-suites.mjs — run every test suite and report every failure.
//
//   node Tools/board-check/run-suites.mjs          (or: npm test)
//   node Tools/board-check/run-suites.mjs --only seating-chart
//   node Tools/board-check/run-suites.mjs --changed
//   node Tools/board-check/run-suites.mjs --changed --base origin/main
//   node Tools/board-check/run-suites.mjs --list
//   node Tools/board-check/run-suites.mjs --repeat 5
//   node Tools/board-check/run-suites.mjs --repeat 20 --only group-team-generator
//
// This replaced the `&&`-joined `npm test` string, whose failure mode is the
// reason check-tests.mjs exists: the chain stops at the first failing suite and
// every suite after it silently never runs. That is not a hypothetical — the one
// assertion this repo has carried as known-red since 2026-08-11 sits at position
// 95 of 120, so a plain `npm test` today reports one failure and never executes
// the last 25 suites at all. A run that hides a fifth of its own coverage is
// worse than a slow one.
//
// So: every suite runs, every failure is collected, and the summary at the end
// names all of them at once.
//
// EXPECTED FAILURES. Tools/board-check/suites.json carries an `expectedFailures`
// list — a suite plus the exact text of an assertion that is red for a recorded
// reason. A suite whose failing assertions are ALL listed there is reported
// EXPECTED-FAIL and does not turn the run red. Three things keep that from
// becoming a place to hide bugs:
//
//   1. It matches on the assertion's own text, not on the suite. A second,
//      unrelated failure in the same suite is a real failure and the run goes red.
//   2. Every expected failure is printed on every run, with its reason.
//   3. If an expected failure stops failing, the runner says so and exits
//      nonzero — the entry cannot outlive the bug it documents.
//
// --repeat N runs the selected suites N times back to back — a full pass, then
// another, not each suite N times — and then reports, per suite, how many
// passes it failed in and on which assertions. That is the number CI's first
// day showed was missing: 121 suites started running on every push and two
// different ones failed non-deterministically within three runs, and nobody
// could say what rate anything else fails at. One pass tells you a suite is
// green today; N passes put a bound on how often it is not. A suite that fails
// in some passes and not others is listed as NON-DETERMINISTIC by name, with
// the assertion, which is the input the policy in CLAUDE.md ("Test tooling")
// needs: raise the budget until the property holds, never loosen the
// assertion. Expected failures are held to the same standard — one that fails
// in some passes and passes in others is reported too, since an intermittent
// known-red is a different bug from the one its entry describes.
//
// A CRASHED SUITE NAMES ITSELF. A suite that exits nonzero without printing a
// `FAIL` line died before its own reporter ran — an unhandled rejection, a
// setup throw, a port already bound, the browser going away. The reason is on
// its stderr, and in a 17-minute CI log that is a thousand lines above the
// summary, which is where anyone looks first. So the summary repeats the last
// lines of a crashed suite's stderr under its name. main's CI run #8 on
// 2026-09-02 is the case that paid for this: "exited 1 without printing a FAIL
// line" was all the summary said, and the `route.fetch: read ECONNRESET` that
// explained it sat unread at position 57 of 121 for a full session.
//
// Suites are run one at a time, in the order suites.json lists them. Several
// drive a real browser and bind a fixed localhost port (drive-seating.mjs takes
// 8146), so running them concurrently would make them fight over ports; the
// serial order is a correctness property, not laziness.

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG = path.join(SITE, 'Tools', 'board-check', 'suites.json');

/* ── config ─────────────────────────────────────────────────────────────── */

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
} catch (e) {
  console.error(`run-suites: cannot read Tools/board-check/suites.json — ${e.message}`);
  process.exit(1);
}
const SUITES = Array.isArray(config.suites) ? config.suites : [];
const EXPECTED = Array.isArray(config.expectedFailures) ? config.expectedFailures : [];

if (!SUITES.length) {
  console.error('run-suites: suites.json lists no suites.');
  process.exit(1);
}

/** The tool folder a suite belongs to: Tools/<tool>/test/x.mjs -> <tool>. */
const toolOf = suite => (suite.split('/')[1] || '');

const expectedFor = suite => EXPECTED.filter(e => e.suite === suite);

/* ── argv ───────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const valueOf = name => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
};

/* ── --changed ──────────────────────────────────────────────────────────── */

// Maps touched paths to the suites that cover them. Three rules, in order:
//
//   _shared/, sw.js, index.html, Tools/board-check/  -> everything. These are
//       site-wide; any of them can break a tool that does not name them.
//   Tools/<folder>/...  -> every suite under that folder.
//   Tools/<nnn>-<Name>.html  -> the suites whose source opens that page. The
//       page and its folder have different names (005-Seating Chart
//       Generator.html lives beside Tools/seating-chart/), and no file records
//       the pairing, so this is resolved by reading each suite and looking for
//       the filename — percent-encoded or not, which is how the suites write it.
function changedFiles(base) {
  const ref = base || 'origin/main';
  // -z throughout: half this repo's tool pages have spaces in their filenames
  // ("Tools/005-Seating Chart Generator.html"), and git's default output quotes
  // and escapes those, so a newline-split list hands back a path that matches
  // nothing on disk. NUL-delimited output is the only shape that survives.
  const run = args => execFileSync('git', args, { cwd: SITE, encoding: 'utf8' });
  const nul = out => out.split('\0').map(s => s.trim()).filter(Boolean);

  let merged = [];
  try {
    merged = nul(run(['diff', '--name-only', '-z', `${ref}...HEAD`]));
  } catch {
    try {
      merged = nul(run(['diff', '--name-only', '-z', ref]));
    } catch (e) {
      console.error(`run-suites: --changed could not diff against ${ref} — ${e.message}`);
      console.error('Pass an available ref with --base, or run without --changed.');
      process.exit(1);
    }
  }

  // `status --porcelain -z` emits "XY path\0" per entry (a rename adds a second
  // \0-terminated field, which we simply also treat as a touched path).
  let working = [];
  try {
    working = run(['status', '--porcelain', '-z'])
      .split('\0').filter(Boolean)
      .map(e => (/^[ MADRCU?!]{2} /.test(e) ? e.slice(3) : e).trim())
      .filter(Boolean);
  } catch {}

  return [...new Set([...merged, ...working])];
}

const SITE_WIDE = [/^_shared\//, /^sw\.js$/, /^index\.html$/, /^Tools\/board-check\//, /^package(-lock)?\.json$/];

function suitesForChanges(files) {
  if (files.some(f => SITE_WIDE.some(re => re.test(f)))) return SUITES.slice();

  const wanted = new Set();
  const folders = new Set();
  const pages = [];
  for (const f of files) {
    const m = /^Tools\/([^/]+)\/(.*)$/.exec(f);
    if (m && !/\.html$/.test(m[1])) { folders.add(m[1]); continue; }
    const p = /^Tools\/([^/]+\.html)$/.exec(f);
    if (p) pages.push(p[1]);
  }
  for (const suite of SUITES) if (folders.has(toolOf(suite))) wanted.add(suite);

  if (pages.length) {
    const needles = pages.flatMap(p => [p, encodeURIComponent(p), p.replace(/ /g, '%20')]);
    for (const suite of SUITES) {
      if (wanted.has(suite)) continue;
      let src = '';
      try { src = fs.readFileSync(path.join(SITE, suite), 'utf8'); } catch { continue; }
      if (needles.some(n => src.includes(n))) wanted.add(suite);
    }
  }
  return SUITES.filter(s => wanted.has(s));
}

/* ── suite selection ────────────────────────────────────────────────────── */

let selected = SUITES.slice();
let selectionLabel = `all ${SUITES.length} suites`;

if (flag('--only')) {
  const only = valueOf('--only');
  if (!only) { console.error('run-suites: --only needs a tool folder name, e.g. --only seating-chart'); process.exit(1); }
  selected = SUITES.filter(s => toolOf(s) === only || s.includes(only));
  selectionLabel = `--only ${only}`;
  if (!selected.length) {
    console.error(`run-suites: --only ${only} matched no suite.`);
    console.error('Known tool folders: ' + [...new Set(SUITES.map(toolOf))].sort().join(', '));
    process.exit(1);
  }
} else if (flag('--changed')) {
  const files = changedFiles(valueOf('--base'));
  selected = suitesForChanges(files);
  selectionLabel = `--changed (${files.length} file${files.length === 1 ? '' : 's'} touched)`;
  if (!selected.length) {
    console.log(`run-suites: ${selectionLabel} — no suite covers the touched files. Nothing to run.`);
    process.exit(0);
  }
}

if (flag('--list')) {
  for (const s of selected) console.log(s);
  process.exit(0);
}

let repeat = 1;
if (flag('--repeat')) {
  repeat = Number(valueOf('--repeat'));
  if (!Number.isInteger(repeat) || repeat < 1) {
    console.error('run-suites: --repeat needs a whole number of passes, e.g. --repeat 5');
    process.exit(1);
  }
}

/* ── run ────────────────────────────────────────────────────────────────── */

/** Assertion text from a suite's own `  FAIL <label>` line — the shape 111 of
 *  the 120 suites already print, and the remaining few match too. */
const FAIL_LINE = /^\s*FAIL\b\s*:?\s{0,2}(.+)$/;

function runOne(suite) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [suite], { cwd: SITE, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); });
    child.stderr.on('data', d => { out += d; err += d; process.stderr.write(d); });
    child.on('error', e => resolve({ suite, code: 1, out, err: err + String(e), ms: Date.now() - started }));
    child.on('close', code => resolve({ suite, code, out, err, ms: Date.now() - started }));
  });
}

async function runAll(passLabel) {
  const results = [];
  for (let i = 0; i < selected.length; i++) {
    const suite = selected[i];
    console.log(`[${String(i + 1).padStart(3)}/${selected.length}]${passLabel} ${suite}`);
    results.push(await runOne(suite));
  }
  return results;
}

/* ── classify ───────────────────────────────────────────────────────────── */

/** The last few meaningful lines of a crashed suite's output — enough to name
 *  the exception and where it came from, not the whole transcript. */
function tailOf(text, max = 12) {
  return String(text || '')
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(Boolean)
    .slice(-max)
    .map(l => (l.length > 200 ? l.slice(0, 197) + '...' : l));
}

function classify(results) {
  const real = [];        // genuinely failed
  const tolerated = [];   // failed, but only on assertions suites.json expects
  const stale = [];       // expected to fail, and did not

  for (const r of results) {
    const expected = expectedFor(r.suite);
    const failedLines = [...r.out.matchAll(new RegExp(FAIL_LINE.source, 'gm'))]
      .map(m => m[1].trim())
      .filter(Boolean);

    const isExpected = line => expected.find(e => line.startsWith(e.assertion) || line.includes(e.assertion));

    if (r.code === 0) {
      if (expected.length) stale.push({ suite: r.suite, expected });
      continue;
    }

    if (!failedLines.length) {
      real.push({
        suite: r.suite,
        why: `exited ${r.code} without printing a FAIL line (crashed, or a setup step threw)`,
        lines: [],
        crash: tailOf(r.err || r.out),
      });
      continue;
    }

    const unexpected = failedLines.filter(l => !isExpected(l));
    if (unexpected.length) real.push({ suite: r.suite, why: `exited ${r.code}`, lines: unexpected });
    else tolerated.push({ suite: r.suite, lines: failedLines, expected });
  }
  return { real, tolerated, stale };
}

/* ── report ─────────────────────────────────────────────────────────────── */

function report(results, { real, tolerated, stale }, passLabel = '') {
const totalMs = results.reduce((a, r) => a + r.ms, 0);
const mins = (totalMs / 60000).toFixed(1);
console.log('\n' + '─'.repeat(72));
console.log(`run-suites:${passLabel} ${results.length} suite${results.length === 1 ? '' : 's'} in ${mins} min`);

if (tolerated.length) {
  console.log('\nEXPECTED FAILURES (recorded in suites.json, not counted against the run):\n');
  for (const t of tolerated) {
    console.log(`  ${t.suite}`);
    for (const l of t.lines) console.log(`    FAIL ${l}`);
    for (const e of t.expected) console.log(`    why: ${e.reason}${e.since ? `  (known-red since ${e.since})` : ''}`);
    console.log('');
  }
}

if (stale.length) {
  console.log('\nEXPECTED FAILURES THAT PASSED — the bug is fixed, so delete the entry:\n');
  for (const s of stale) {
    console.log(`  ${s.suite}`);
    for (const e of s.expected) console.log(`    no longer failing: "${e.assertion}"`);
  }
  console.log('\n  Remove these from Tools/board-check/suites.json expectedFailures.');
}

if (real.length) {
  console.log(`\nFAILED — ${real.length} suite${real.length === 1 ? '' : 's'}:\n`);
  for (const f of real) {
    console.log(`  ${f.suite} (${f.why})`);
    for (const l of f.lines) console.log(`    FAIL ${l}`);
    if (f.crash && f.crash.length) {
      console.log(`    last ${f.crash.length} line${f.crash.length === 1 ? '' : 's'} the suite wrote before it died:`);
      for (const l of f.crash) console.log(`      ${l}`);
    } else if (f.crash) {
      console.log('    the suite wrote nothing to stderr or stdout before it died.');
    }
    console.log('');
  }
  console.log('Every suite above ran — this is the complete list, not the first failure.');
}

if (!real.length && !stale.length) {
  console.log(`PASS — ${results.length - tolerated.length} green` +
    (tolerated.length ? `, ${tolerated.length} expected-fail` : '') + '.');
}
}

/* ── run ────────────────────────────────────────────────────────────────── */

console.log(`run-suites: ${selectionLabel}${repeat > 1 ? `, ${repeat} passes` : ''}\n`);

if (repeat === 1) {
  const results = await runAll('');
  const verdict = classify(results);
  report(results, verdict);
  process.exit(verdict.real.length || verdict.stale.length ? 1 : 0);
}

/* ── --repeat: N passes, then the per-suite tally ───────────────────────── */

const passes = [];
for (let n = 1; n <= repeat; n++) {
  const passLabel = ` pass ${n}/${repeat}`;
  const results = await runAll(passLabel);
  const verdict = classify(results);
  report(results, verdict, passLabel);
  passes.push({ n, results, verdict });
}

// Per suite: which passes it failed in (real), was tolerated in, or went stale
// in — a suite whose outcome differs between passes is non-deterministic.
const tally = new Map(selected.map(s => [s, { real: [], tolerated: [], stale: [], lines: new Map() }]));
for (const p of passes) {
  for (const f of p.verdict.real) {
    const t = tally.get(f.suite);
    t.real.push(p.n);
    for (const l of (f.lines.length ? f.lines : [f.why])) t.lines.set(l, (t.lines.get(l) || 0) + 1);
  }
  for (const f of p.verdict.tolerated) tally.get(f.suite).tolerated.push(p.n);
  for (const f of p.verdict.stale) tally.get(f.suite).stale.push(p.n);
}

const totalMins = (passes.flatMap(p => p.results).reduce((a, r) => a + r.ms, 0) / 60000).toFixed(1);
console.log('\n' + '═'.repeat(72));
console.log(`run-suites: ${repeat} passes of ${selected.length} suite${selected.length === 1 ? '' : 's'} in ${totalMins} min\n`);

const varied = [...tally].filter(([, t]) => {
  const outcomes = new Set();
  for (let n = 1; n <= repeat; n++) {
    outcomes.add(t.real.includes(n) ? 'fail' : t.stale.includes(n) ? 'stale' : t.tolerated.includes(n) ? 'expected' : 'pass');
  }
  return outcomes.size > 1;
});
const alwaysRed = [...tally].filter(([, t]) => t.real.length === repeat);

if (varied.length) {
  console.log(`NON-DETERMINISTIC — ${varied.length} suite${varied.length === 1 ? '' : 's'} with a different outcome in different passes:\n`);
  for (const [suite, t] of varied) {
    const bits = [];
    if (t.real.length) bits.push(`failed ${t.real.length}/${repeat} (pass${t.real.length === 1 ? '' : 'es'} ${t.real.join(', ')})`);
    if (t.stale.length) bits.push(`expected failure passed in ${t.stale.length}/${repeat} (pass${t.stale.length === 1 ? '' : 'es'} ${t.stale.join(', ')})`);
    if (t.tolerated.length && t.tolerated.length < repeat) bits.push(`expected-fail in ${t.tolerated.length}/${repeat}`);
    console.log(`  ${suite} — ${bits.join('; ')}`);
    for (const [l, c] of t.lines) console.log(`    ${c}× FAIL ${l}`);
    console.log('');
  }
  console.log('  Measure before deciding: a property assertion over randomised behaviour gets a');
  console.log('  bigger budget until it is deterministic, never a looser assertion (CLAUDE.md,');
  console.log('  "Test tooling"). A crash or a timing race is a harness or tool bug to root-cause.');
}

if (alwaysRed.length) {
  console.log(`\nFAILED IN EVERY PASS — ${alwaysRed.length} suite${alwaysRed.length === 1 ? '' : 's'} (deterministically red, not flaky):\n`);
  for (const [suite, t] of alwaysRed) {
    console.log(`  ${suite}`);
    for (const [l, c] of t.lines) console.log(`    ${c}× FAIL ${l}`);
  }
}

const anyRed = passes.some(p => p.verdict.real.length || p.verdict.stale.length);
if (!varied.length && !alwaysRed.length && !anyRed) {
  const tol = [...tally].filter(([, t]) => t.tolerated.length === repeat).length;
  console.log(`PASS — every suite had the same outcome in all ${repeat} passes: ${selected.length - tol} green` +
    (tol ? `, ${tol} expected-fail` : '') + '.');
} else if (!varied.length && !alwaysRed.length) {
  console.log('Some pass went red — see the per-pass summaries above.');
}

process.exit(anyRed ? 1 : 0);
