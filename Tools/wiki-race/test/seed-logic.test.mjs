// seed-logic.test.mjs — Wiki Race (086): the seed -> matchup logic, the finish-code codec and the class
// scoreboard's pure parts (AI-30, rank 71). Pure Node, no network.
// 086 is handed to students as ONE standalone file and may link nothing, so these functions cannot live in
// a module: they are cut out of the page by text (like the paste-table parity suites) and run in a vm.
// golden-matchups.json is what the page produced BEFORE this suite existed: 240 matchups (80 seeds x 3
// difficulties) and the whole TOPICS table. Changing the draw order or any topic array changes what every
// seed means for a class that is already playing, so a difference here is a decision, not a refactor.
//   node Tools/wiki-race/test/seed-logic.test.mjs   (npm run test:wiki-race-seed)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', '..', '086-wiki-race.html'), 'utf8');
const golden = JSON.parse(fs.readFileSync(path.join(here, 'golden-matchups.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const cut = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('anchor missing: ' + from + ' / ' + to);
  return html.slice(a, b);
};
const SECTIONS = [
  cut('function xmur3', '/* =====================================================================\n   Wikipedia API layer'),
  cut('var CODE_SALT', '/* =====================================================================\n   verify mode'),
  cut('function tnorm', 'function fmtTime'),
  cut('var CODE_TOKEN', 'var boardText')
];
function load(src = SECTIONS) {
  const ctx = vm.createContext({ btoa, atob, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, Uint8Array, Promise, JSON, Math, String, Object, Array, isFinite, console });
  vm.runInContext('var state = { seed: "", difficulty: "", elapsedMs: 0, clicks: 0, hints: 0, path: [] };\n' + src.join('\n') +
    '\nthis.api = { computeMatchup, categoryOf, normSeed, TOPICS, FAR_PAIRS, checksum, buildFinishCode, decodeFinishCode, parseCodeLines, rankRaces, finalMs, state };', ctx);
  return ctx.api;
}
const W = load();

// 1. the table and the draw order are what the page shipped
eq(Object.fromEntries(Object.entries(W.TOPICS).map(([k, v]) => [k, v.length])), golden.topicCounts, 'topic counts per category');
eq(JSON.parse(JSON.stringify(W.TOPICS)), golden.topics, 'TOPICS, title by title and in order');
eq(JSON.parse(JSON.stringify(W.FAR_PAIRS)), golden.farPairs, 'FAR_PAIRS in order');
for (const g of golden.matchups) {
  const m = W.computeMatchup(g.s, g.d);
  ok(m.start === g.start && m.target === g.target, `matchup ${JSON.stringify(g.s)} ${g.d}: ${m.start} -> ${m.target}, golden ${g.start} -> ${g.target}`);
}

// 2. properties of every seed, not just the golden ones
let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pool = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
for (let i = 0; i < 1500; i++) {
  let s = ''; const n = 1 + Math.floor(rnd() * 12); for (let k = 0; k < n; k++) s += pool[Math.floor(rnd() * pool.length)];
  if (!s.trim()) continue;
  for (const d of ['easy', 'medium', 'hard']) {
    const m = W.computeMatchup(s, d), again = W.computeMatchup(s, d);
    ok(m.start === again.start && m.target === again.target, 'deterministic ' + s + d);
    ok(m.start !== m.target, 'start differs from target ' + s + d + ' ' + m.start);
    ok(W.categoryOf(m.start) && W.categoryOf(m.target), 'both titles are in a category ' + s + d);
    if (d === 'easy') ok(W.categoryOf(m.start) === W.categoryOf(m.target), 'easy stays in one category ' + s + m.start + m.target);
    if (d === 'hard') ok(W.FAR_PAIRS.some(p => (p[0] === W.categoryOf(m.start) && p[1] === W.categoryOf(m.target)) || (p[1] === W.categoryOf(m.start) && p[0] === W.categoryOf(m.target))), 'hard crosses a far pair ' + s + m.start + m.target);
  }
}
// the phrase is normalised: case and runs of spaces do not change the race
for (const d of ['easy', 'medium', 'hard']) {
  eq(W.computeMatchup('Bulldogs  1', d), W.computeMatchup('bulldogs 1', d), 'case and spacing ' + d);
  eq(W.computeMatchup('  period 3 ', d), W.computeMatchup('period 3', d), 'trim ' + d);
}
ok(W.computeMatchup('bulldogs1', 'easy').start !== W.computeMatchup('bulldogs1', 'hard').start || W.computeMatchup('bulldogs1', 'easy').target !== W.computeMatchup('bulldogs1', 'hard').target, 'difficulty changes the race');
// spread: 1500 seeds should reach a large part of the table, so a broken PRNG shows up
const seen = new Set(); for (let i = 0; i < 1500; i++) seen.add(W.computeMatchup('spread' + i, 'medium').start);
ok(seen.size > 600, 'medium reaches many different start articles (' + seen.size + ')');

// 3. the finish code
const mk = (s, d, t, c, h, p) => ({ v: 1, s, d, t, c, h, p });
const set = (o) => { Object.assign(W.state, { seed: o.s, difficulty: o.d, elapsedMs: o.t, clicks: o.c, hints: o.h, path: o.p }); };
const P1 = mk('bulldogs1', 'medium', 123456, 7, 1, ['Tea', 'India', 'Monsoon', 'Rain']);
set(P1);
const code = await W.buildFinishCode();
ok(/^WR1\.[0-9a-z]{6}\.[A-Za-z0-9_-]+$/.test(code), 'a WR1 code looks right: ' + code.slice(0, 20));
eq(await W.decodeFinishCode(code), P1, 'WR1 round trip');
eq(await W.decodeFinishCode('  ' + code + '\n'), P1, 'whitespace around a code is ignored');
const parts = code.split('.');
const flip = parts[2].slice(0, 5) + (parts[2][5] === 'A' ? 'B' : 'A') + parts[2].slice(6);
for (const [bad, label, re] of [[parts[0] + '.' + parts[1] + '.' + flip, 'edited data', /Checksum/], ['WR2.' + parts[1] + '.' + parts[2], 'unknown type', /Unknown code type/], ['WR1.' + parts[1], 'two parts', /three dot-separated/], ['WR1.abcdef.' + parts[2], 'wrong checksum', /Checksum/]]) {
  let msg = ''; try { await W.decodeFinishCode(bad); } catch (e) { msg = e.message; }
  ok(re.test(msg), label + ' is refused: ' + msg);
}
// WR0 (no CompressionStream): frozen
const wr0data = Buffer.from(JSON.stringify(P1)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const wr0 = 'WR0.' + W.checksum('WR0', wr0data) + '.' + wr0data;
eq(await W.decodeFinishCode(wr0), P1, 'WR0 round trip');
ok(/^[0-9a-z]{6}$/.test(W.checksum('WR1', 'x')), 'checksum shape');

// 4. the class scoreboard
eq(W.parseCodeLines('').length, 0, 'empty paste');
const pl = W.parseCodeLines(`Maria ${code}\n\n  ${code}  \nJo: ${code} extra\nnot a code\n- ${wr0}`);
eq(pl.map(x => x.error ? 'E' : x.label), ['Maria', '', 'Jo: extra', 'E', ''], 'labels are what surrounds the code');
eq(pl.map(x => x.line), [1, 3, 4, 5, 6], 'line numbers count the blank line');
const item = (line, label, p) => ({ line, label, payload: p });
const base = (s, d) => W.computeMatchup(s, d);
const mkp = (seedName, d, t, c, h) => { const m = base(seedName, d); return mk(seedName, d, t, c, h, [m.start, 'X', m.target]); };
const items = [
  item(1, 'Slow', mkp('r1', 'easy', 90000, 5, 0)),
  item(2, 'Fast', mkp('r1', 'easy', 60000, 9, 0)),
  item(3, 'Hinted', mkp('r1', 'easy', 40000, 4, 1)),     // 40s + 30s = 70s
  item(4, 'Tie A', mkp('r1', 'easy', 80000, 6, 0)),
  item(5, 'Tie B', mkp('r1', 'easy', 80000, 6, 0)),      // same time, clicks, hints, other path? same path -> duplicate
  item(6, 'Other', mkp('r2', 'hard', 30000, 3, 0)),
  item(7, 'Odd ends', mk('r1', 'easy', 50000, 2, 0, ['Nowhere', 'Else'])),
  item(8, 'Case', mkp('R1 ', 'easy', 55000, 5, 0))
];
const groups = W.rankRaces(items);
eq(groups.map(g => g.seed + '/' + g.difficulty), ['r1/easy', 'r2/hard'], 'groups: biggest first, seed normalised');
const r1 = groups[0];
eq(r1.rows.map(r => r.label), ['Odd ends', 'Case', 'Fast', 'Hinted', 'Tie A', 'Slow'], 'ranked by final time (hints cost 30 s each)');
eq(r1.rows.map(r => r.rank), [1, 2, 3, 4, 5, 6], 'ranks 1..6');
eq(r1.dupes.map(d => [d.line, d.sameAs]), [[5, 4]], 'a repeated code is flagged and left out');
eq(r1.rows.find(r => r.label === 'Odd ends').endsOk, false, 'endpoints that are not the seed articles are flagged');
eq(r1.rows.find(r => r.label === 'Fast').endsOk, true, 'normal endpoints pass');
eq(W.finalMs({ t: 1000, h: 2 }), 61000, 'finalMs adds 30 s a hint');
const tie = W.rankRaces([item(1, 'A', mk('t', 'easy', 5000, 3, 0, ['a', 'b'])), item(2, 'B', mk('t', 'easy', 5000, 3, 0, ['a', 'c'])), item(3, 'C', mk('t', 'easy', 5000, 4, 0, ['a', 'd']))])[0];
eq(tie.rows.map(r => r.rank), [1, 1, 3], 'equal time, clicks and hints share a rank, the next skips');
eq(W.rankRaces([]), [], 'no items, no groups');
// mutant: a ranker that ignores hints must fail the hint check
const mut = SECTIONS.slice(); mut[3] = mut[3].replace('function finalMs(p) { return p.t + p.h * 30000; }', 'function finalMs(p) { return p.t; }');
ok(mut[3] !== SECTIONS[3], 'mutant anchor exists');
eq(load(mut).rankRaces(items)[0].rows.map(r => r.label).slice(0, 3), ['Hinted', 'Odd ends', 'Case'], 'mutant (hints ignored) ranks differently');
console.log(`wiki-race seed logic: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
