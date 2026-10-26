// suite-durations.mjs — refresh Tools/board-check/suite-durations.json, the
// seconds-per-suite table shard-suites.mjs balances CI's test jobs by.
//
//   gh run view <run id> --json jobs --jq '.jobs[] | [.databaseId, .name] | @tsv'
//   gh api repos/GreyVersusBlue/AI_Tools/actions/jobs/<job id>/logs > shard-1.log
//   node Tools/board-check/suite-durations.mjs shard-1.log shard-2.log ...
//   node Tools/board-check/suite-durations.mjs --dry shard-1.log    (print, write nothing)
//
// Reads GitHub job logs (every line starts with an ISO timestamp), finds
// run-suites.mjs's `[  i/N] <suite>` lines, and takes each suite's time as the
// gap to the next suite's line, or to the `run-suites: N suites in` summary for
// the last one. A suite still running when the log ends (a cancelled job) gets
// no time. A full push-to-main run is the best source; a pull request's run
// only times what it selected. Later files win over earlier ones, and every
// suite the logs do not mention keeps the time it had, so refreshing from one
// shard's log is fine. Suites no longer in suites.json are dropped.
//
// Nothing here affects which suites run, only which job runs them.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, DURATIONS } from './shard-suites.mjs';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const files = argv.filter(a => a !== '--dry');
if (!files.length) {
  console.error('suite-durations: name one or more GitHub job log files (see the header).');
  process.exit(1);
}

const STEP = /^(\S+Z) \[ *\d+\/\d+\](?: pass \S+)? (\S.*)$/;
const END = /^(\S+Z) run-suites:(?: pass \S+)? \d+ suites? in /;

function timesIn(text) {
  const events = [];
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    let m = STEP.exec(line);
    if (m) { events.push([Date.parse(m[1]), m[2].trim()]); continue; }
    m = END.exec(line);
    if (m && events.length) {
      // A summary closes the pass: time the last suite, start a fresh pass.
      const last = events[events.length - 1];
      out[last[1]] = (Date.parse(m[1]) - last[0]) / 1000;
      for (let i = 0; i + 1 < events.length; i++) out[events[i][1]] = (events[i + 1][0] - events[i][0]) / 1000;
      events.length = 0;
    }
  }
  for (let i = 0; i + 1 < events.length; i++) out[events[i][1]] = (events[i + 1][0] - events[i][0]) / 1000;
  return out;
}

const suites = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'board-check', 'suites.json'), 'utf8')).suites;
let table = {};
let doc = {};
try { doc = JSON.parse(fs.readFileSync(DURATIONS, 'utf8')); table = doc.seconds || {}; } catch {}

let measured = 0;
for (const f of files) {
  const times = timesIn(fs.readFileSync(f, 'utf8'));
  for (const [suite, s] of Object.entries(times)) {
    if (Number.isFinite(s) && s >= 0) { table[suite] = Math.max(1, Math.round(s)); measured++; }
  }
}

const seconds = {};
for (const s of suites) if (table[s] != null) seconds[s] = table[s];
const missing = suites.filter(s => seconds[s] == null);
const total = Object.values(seconds).reduce((a, b) => a + b, 0);

console.log(`suite-durations: ${measured} timing${measured === 1 ? '' : 's'} read from ${files.length} log${files.length === 1 ? '' : 's'}; ` +
  `${Object.keys(seconds).length} of ${suites.length} suites timed, ${(total / 60).toFixed(1)} min in all; ${missing.length} untimed.`);
for (const s of missing) console.log(`  untimed  ${s}`);

if (dry) process.exit(0);
const next = { '//': doc['//'] || [], seconds };
fs.writeFileSync(DURATIONS, JSON.stringify(next, null, 2) + '\n');
console.log(`wrote ${path.relative(SITE, DURATIONS)}`);
