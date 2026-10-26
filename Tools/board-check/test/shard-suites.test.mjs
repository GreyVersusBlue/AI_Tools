// shard-suites.test.mjs — `run-suites.mjs --shard i/n` splits a selection into
// n shards that together run every selected suite exactly once, the same way
// on every machine.
//
//   node Tools/board-check/test/shard-suites.test.mjs   (or: npm run test:shard-suites)
//
// CI runs the suites as a matrix of jobs, each with its own --shard, and no job
// hears from another. So the failure that matters is a suite that falls between
// shards (in none, silently) or lands in two, or a plan that differs between
// two jobs reading the same checkout. Every property is checked against the
// real suites.json and suite-durations.json, and then through the CLI itself.
//
// Pure Node, no browser. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SITE, parseShard, planShards, readDurations } from '../shard-suites.mjs';

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; return true; }
  failed++;
  console.log('  FAIL ' + label);
  return false;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const SUITES = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'board-check', 'suites.json'), 'utf8')).suites;
const TABLE = readDurations();

/** Every suite in `list` is in exactly one shard, and each shard keeps the
 *  selection's order. */
function partitions(plan, list, label) {
  const seen = new Map();
  plan.forEach((p, k) => p.suites.forEach(s => seen.set(s, [...(seen.get(s) || []), k + 1])));
  const twice = [...seen].filter(([, ks]) => ks.length > 1);
  const none = list.filter(s => !seen.has(s));
  const extra = [...seen.keys()].filter(s => !list.includes(s));
  ok(!twice.length, `${label}: no suite in two shards (${twice.slice(0, 3).map(([s, ks]) => `${s} in ${ks}`).join('; ')})`);
  ok(!none.length, `${label}: every suite in a shard (missing ${none.slice(0, 3).join(', ')})`);
  ok(!extra.length, `${label}: no shard holds a suite that was not selected (${extra.slice(0, 3).join(', ')})`);
  ok(plan.every(p => same(p.suites, list.filter(s => p.suites.includes(s)))), `${label}: each shard keeps the selection's order`);
}

/* ── 1. parsing ───────────────────────────────────────────────────────────── */

ok(same(parseShard('2/6'), { index: 2, count: 6 }), "parseShard('2/6')");
ok(same(parseShard(' 1/1 '), { index: 1, count: 1 }), "parseShard(' 1/1 ')");
for (const bad of ['', '0/6', '7/6', '2', '2/0', 'a/b', '1/65', '-1/3', '2/6/1']) {
  ok(typeof parseShard(bad) === 'string', `parseShard(${JSON.stringify(bad)}) is refused`);
}

/* ── 2. the real list, every n CI might use ───────────────────────────────── */

ok(SUITES.length > 100, `suites.json has its suites (${SUITES.length})`);
ok(Object.keys(TABLE).length > 100, `suite-durations.json has timings (${Object.keys(TABLE).length})`);

for (let n = 1; n <= 10; n++) {
  const plan = planShards(SUITES, n, TABLE);
  ok(plan.length === n, `n=${n}: ${n} shards`);
  partitions(plan, SUITES, `full list, n=${n}`);
  ok(same(plan, planShards(SUITES, n, TABLE)), `n=${n}: the same plan twice`);
  // Two jobs whose JSON parsers handed back keys in another order still agree.
  const reversed = Object.fromEntries(Object.entries(TABLE).reverse());
  ok(same(plan, planShards(SUITES, n, reversed)), `n=${n}: the table's key order does not move a suite`);
  // Longest-first greedy's bound: the last suite added to the longest shard went
  // to what was then the shortest, so the spread is at most the longest suite.
  const secs = plan.map(p => p.seconds);
  const longest = Math.max(...SUITES.map(s => TABLE[s] || 0));
  ok(Math.max(...secs) - Math.min(...secs) <= longest + 1e-9,
    `n=${n}: shards within one suite of each other (${secs.map(s => (s / 60).toFixed(1)).join(', ')} min)`);
}

ok(same(planShards(SUITES, 1, TABLE)[0].suites, SUITES), 'n=1 is the whole list in suites.json order');

/* ── 3. no table, an unknown suite, small selections ──────────────────────── */

{
  const plan = planShards(SUITES, 6, {});
  partitions(plan, SUITES, 'no table');
  const sizes = plan.map(p => p.suites.length);
  ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `no table balances by count (${sizes.join(', ')})`);
}
{
  const list = ['Tools/x/test/a.mjs', 'Tools/x/test/b.mjs', 'Tools/x/test/new.mjs'];
  const plan = planShards(list, 2, { 'Tools/x/test/a.mjs': 10, 'Tools/x/test/b.mjs': 30, 'Tools/y/test/c.mjs': 20 });
  partitions(plan, list, 'unknown suite');
  // new.mjs costs the table's median, 20: b (30) to shard 1, new (20) to shard 2, a (10) to shard 2.
  ok(same(plan.map(p => p.suites), [['Tools/x/test/b.mjs'], ['Tools/x/test/a.mjs', 'Tools/x/test/new.mjs']]),
    `an untimed suite costs the table's median (${JSON.stringify(plan.map(p => p.suites))})`);
}
{
  const plan = planShards(SUITES.slice(0, 2), 6, TABLE);
  partitions(plan, SUITES.slice(0, 2), 'two suites in six shards');
  ok(plan.filter(p => !p.suites.length).length === 4, 'two suites in six shards leaves four empty');
  ok(planShards([], 4, TABLE).every(p => !p.suites.length), 'an empty selection gives empty shards');
}

/* ── 4. through the CLI, the way CI calls it ──────────────────────────────── */

function cliList(args) {
  const out = execFileSync(process.execPath, ['Tools/board-check/run-suites.mjs', ...args, '--list'], { cwd: SITE, encoding: 'utf8' });
  return out.split('\n').filter(l => /^Tools\/|^conference-signup\//.test(l));
}

{
  const whole = cliList([]);
  ok(same(whole, SUITES), `--list without --shard is suites.json (${whole.length})`);
  const shards = [1, 2, 3, 4, 5, 6].map(i => cliList(['--shard', `${i}/6`]));
  partitions(shards.map(suites => ({ suites })), SUITES, 'CLI --shard i/6');
  const only = cliList(['--only', 'board-check']);
  const onlyShards = [1, 2, 3].map(i => cliList(['--only', 'board-check', '--shard', `${i}/3`]));
  partitions(onlyShards.map(suites => ({ suites })), only, 'CLI --only board-check --shard i/3');
}
{
  let code = 0;
  try { execFileSync(process.execPath, ['Tools/board-check/run-suites.mjs', '--shard', '7/6', '--list'], { cwd: SITE, stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  ok(code === 1, `--shard 7/6 exits 1 (got ${code})`);
}

console.log(`\nshard-suites: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
