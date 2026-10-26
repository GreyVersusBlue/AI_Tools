// shard-suites.mjs — split a list of suites into N shards of about equal run
// time, the same way on every machine.
//
//   node Tools/board-check/run-suites.mjs --shard 2/6            (the full list)
//   node Tools/board-check/run-suites.mjs --changed --shard 2/6  (what CI's PR job runs)
//   node Tools/board-check/run-suites.mjs --changed --shard 2/6 --list
//
// WHY. One CI job ran every suite in a row, and the list outgrew it: on
// 2026-10-26 AI_Tools#372 selected 330 suites and was cancelled at the job's
// 120-minute timeout in suite 307, and the last green full run on main (#371's
// merge) took 97 minutes. CI now runs the selection as a matrix of jobs, each
// calling run-suites.mjs with its own `--shard i/n`. Every job computes the same
// selection from the same checkout and diff, then keeps only its share, so the
// plan is a pure function of (selection, n, the durations table) — no job needs
// to hear from another.
//
// HOW. Longest-first greedy: suites sorted by their recorded run time (longest
// first, ties by path), each handed to the shard with the least time so far
// (ties to the lowest-numbered shard). Within a shard the suites keep the order
// they had in the selection, which is suites.json's order. A suite with no
// recorded time is costed at the median of the table, so a new suite lands
// somewhere sensible until the table is refreshed. Every selected suite is in
// exactly one shard; Tools/board-check/test/shard-suites.test.mjs proves that
// and the determinism against the real suites.json.
//
// THE TABLE. Tools/board-check/suite-durations.json holds seconds per suite,
// measured from CI logs (GitHub stamps every line). It only steers the balance:
// a stale or missing entry makes one shard a few minutes longer, never drops a
// suite. Refresh it from a run's job logs with suite-durations.mjs (its header
// has the commands).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DURATIONS = path.join(SITE, 'Tools', 'board-check', 'suite-durations.json');

/** The seconds table, or {} when the file is missing or unreadable — the
 *  plan then balances by count, which is still a partition. */
export function readDurations(file = DURATIONS) {
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf8')).seconds;
    return t && typeof t === 'object' ? t : {};
  } catch { return {}; }
}

/** `"2/6"` → `{ index: 2, count: 6 }`, or an error string. One-based. */
export function parseShard(text) {
  const m = /^(\d+)\/(\d+)$/.exec(String(text || '').trim());
  if (!m) return 'needs i/n, e.g. --shard 2/6';
  const index = Number(m[1]), count = Number(m[2]);
  if (count < 1 || count > 64) return `n must be 1..64, got ${count}`;
  if (index < 1 || index > count) return `i must be 1..${count}, got ${index}`;
  return { index, count };
}

const valid = v => typeof v === 'number' && Number.isFinite(v) && v > 0;

function median(values) {
  const v = values.filter(valid).sort((a, b) => a - b);
  if (!v.length) return 1;
  return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

/**
 * Split `suites` into `count` shards. Returns an array of
 * `{ suites: string[], seconds: number }`, one per shard, shard 1 first.
 * `seconds` is the table; the fallback for a suite missing from it is the
 * median of the whole table, not of the selection, so a suite's cost does not
 * depend on what else was selected.
 */
export function planShards(suites, count, seconds = {}) {
  const fallback = median(Object.values(seconds));
  const cost = s => (valid(seconds[s]) ? seconds[s] : fallback);
  const order = suites.map((s, i) => i)
    .sort((a, b) => cost(suites[b]) - cost(suites[a]) || (suites[a] < suites[b] ? -1 : suites[a] > suites[b] ? 1 : a - b));
  const shards = Array.from({ length: count }, () => ({ picks: [], seconds: 0 }));
  for (const i of order) {
    let best = 0;
    for (let k = 1; k < count; k++) if (shards[k].seconds < shards[best].seconds) best = k;
    shards[best].picks.push(i);
    shards[best].seconds += cost(suites[i]);
  }
  return shards.map(sh => ({
    suites: sh.picks.sort((a, b) => a - b).map(i => suites[i]),
    seconds: sh.seconds,
  }));
}
