// corpus-graph.test.mjs — Wiki Race (086) offline corpus: the article graph, the corpus seed logic and the
// finish-code source field (AI-30, rank 71). Pure Node, no network, no browser.
// The corpus is the CORPUS table inside 086-wiki-race.html (the page is one standalone file and links
// nothing), cut out by text and run in a vm, like seed-logic.test.mjs does for the online logic.
//
// A corpus race has to be a fair race, so the GRAPH is held here, with its own independent link parser
// (the page's reader is checked against it, not trusted):
//   - every [[link]] names a real article, none points at itself;
//   - no dead end (an article with fewer than MIN_OUT links) and no orphan (nothing links to it);
//   - strongly connected: every article reaches every other by clicking links;
//   - every pair computeCorpusMatchup can possibly draw needs at least 2 clicks (never a link on the start
//     page) and at most MAX_CLICKS (the page's CORPUS_MAX_CLICKS), by breadth-first search;
//   - seeded matchups are deterministic and equal golden-corpus-matchups.json (separate from the online
//     golden-matchups.json, which this file never reads).
// Editing a LINK or the order of the table changes which targets a start may draw, so it changes what
// existing corpus seeds mean: a difference from the golden is a decision (--update), not a refactor.
// Prose without links can change freely.
//   node Tools/wiki-race/test/corpus-graph.test.mjs [--update]   (npm run test:wiki-race-corpus)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', '..', '086-wiki-race.html'), 'utf8');
const goldenPath = path.join(here, 'golden-corpus-matchups.json');
const onlineGolden = JSON.parse(fs.readFileSync(path.join(here, 'golden-matchups.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const MIN_ARTICLES = 60, MIN_OUT = 3, MAX_CLICKS = 6;

const cut = (src, from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('anchor missing: ' + from + ' / ' + to);
  return src.slice(a, b);
};
const ENGINE = cut(html, 'function xmur3', '/* =====================================================================\n   Wikipedia API layer');
const CODEC = cut(html, 'var CODE_SALT', '/* =====================================================================\n   verify mode');
const BOARD = cut(html, 'function tnorm', 'function fmtTime') + '\n' + cut(html, 'var CODE_TOKEN', 'var boardText');
function load(engine = ENGINE) {
  const ctx = vm.createContext({ btoa, atob, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, Uint8Array, Promise, JSON, Math, String, Object, Array, RegExp, isFinite, console });
  vm.runInContext('var state = { seed: "", difficulty: "", source: "wiki", elapsedMs: 0, clicks: 0, hints: 0, path: [] };\n' + engine + '\n' + CODEC + '\n' + BOARD +
    '\nthis.api = { CORPUS, CORPUS_FAR, CORPUS_MAX_CLICKS, computeCorpusMatchup, corpusPairs, corpusLinks, corpusPathProblem, corpusPlain, corpusCategoryOf, computeMatchup, normSeed, buildFinishCode, decodeFinishCode, checksum, rankRaces, state };', ctx);
  return ctx.api;
}

/* ---- an independent reader of the table, and the graph audits ---- */
const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
function graphOf(corpus) {
  const g = new Map();
  for (const [t, [, text]] of Object.entries(corpus)) {
    const out = []; let m; LINK.lastIndex = 0;
    while ((m = LINK.exec(text))) out.push(m[1]);
    g.set(t, out);
  }
  return g;
}
function distFrom(g, s) {
  const d = new Map([[s, 0]]), q = [s];
  for (let i = 0; i < q.length; i++) for (const n of g.get(q[i]) || []) if (g.has(n) && !d.has(n)) { d.set(n, d.get(q[i]) + 1); q.push(n); }
  return d;
}
/* the problems in a table; [] means a sound graph */
function auditGraph(corpus) {
  const g = graphOf(corpus), bad = [], inn = new Map([...g.keys()].map(k => [k, 0]));
  if (g.size < MIN_ARTICLES) bad.push(`only ${g.size} articles`);
  for (const [t, out] of g) {
    for (const n of out) {
      if (!g.has(n)) bad.push(`unresolved link ${t} -> ${n}`);
      else if (n === t) bad.push(`self link in ${t}`);
      else inn.set(n, inn.get(n) + 1);
    }
    const uniq = new Set(out.filter(n => g.has(n) && n !== t));
    if (uniq.size < MIN_OUT) bad.push(`dead end: ${t} has ${uniq.size} links`);
  }
  for (const [t, n] of inn) if (!n) bad.push(`orphan: nothing links to ${t}`);
  for (const t of g.keys()) {
    const d = distFrom(g, t);
    if (d.size < g.size) bad.push(`${t} cannot reach ${g.size - d.size} article(s)`);
    else if (Math.max(...d.values()) > MAX_CLICKS) bad.push(`${t} needs more than ${MAX_CLICKS} clicks to reach something`);
  }
  return bad;
}
/* the problems in what the seed logic can draw */
function auditPairs(api) {
  const g = graphOf(api.CORPUS), bad = [];
  for (const d of ['easy', 'medium', 'hard']) {
    const pairs = api.corpusPairs(d);
    if (!pairs.length) bad.push(`${d}: no pairs`);
    const starts = new Set();
    for (const [s, t] of pairs) {
      starts.add(s);
      if (s === t) { bad.push(`${d}: ${s} races itself`); continue; }
      const n = distFrom(g, s).get(t);
      if (n === undefined) bad.push(`${d}: ${s} -> ${t} unreachable`);
      else if (n < 2) bad.push(`${d}: ${s} -> ${t} is ${n} click`);
      else if (n > api.CORPUS_MAX_CLICKS) bad.push(`${d}: ${s} -> ${t} is ${n} clicks`);
    }
    if (d !== 'hard') for (const t of g.keys()) if (!starts.has(t)) bad.push(`${d}: ${t} can never start a race, or has no target`);
  }
  return bad;
}

const W = load();

// 1. the table
const titles = Object.keys(W.CORPUS);
ok(titles.length >= MIN_ARTICLES, `at least ${MIN_ARTICLES} articles (${titles.length})`);
ok(W.CORPUS_MAX_CLICKS === MAX_CLICKS, `the page states the same maximum as this suite (${W.CORPUS_MAX_CLICKS})`);
const cats = [...new Set(titles.map(t => W.CORPUS[t][0]))];
eq(cats, ['Science', 'History', 'Geography', 'Mathematics', 'Arts', 'Nature'], 'the six school-subject categories, in order');
for (const c of cats) ok(titles.filter(t => W.CORPUS[t][0] === c).length >= 8, `category ${c} has at least 8 articles`);
for (const p of W.CORPUS_FAR) ok(cats.includes(p[0]) && cats.includes(p[1]) && p[0] !== p[1], `far pair ${p} names two categories`);
for (const t of titles) {
  const text = W.CORPUS[t][1];
  ok(typeof text === 'string' && text.split('\n\n').length >= 2, `${t} has at least two paragraphs`);
  const words = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a).split(/\s+/).length;
  ok(words >= 60 && words <= 200, `${t} is a short article (${words} words)`);
  ok(!/[<>&]/.test(text), `${t} has no markup characters`);
}
eq(auditGraph(W.CORPUS), [], 'the article graph has no problems');
// the page's own reader agrees with this file's
for (const [t, out] of graphOf(W.CORPUS)) eq(W.corpusLinks(t), [...new Set(out)], `corpusLinks(${t}) agrees with the independent reader`);

// 2. everything the seed logic can draw
eq(auditPairs(W), [], 'every drawable matchup takes between 2 and ' + MAX_CLICKS + ' clicks');
const pairSets = Object.fromEntries(['easy', 'medium', 'hard'].map(d => [d, new Set(W.corpusPairs(d).map(p => p.join('\u0000')))]));
ok(pairSets.medium.size > 3000, 'medium can draw thousands of pairs (' + pairSets.medium.size + ')');
for (const d of ['easy', 'medium', 'hard']) ok(![...pairSets[d]].some(k => k.split('\u0000').every((x, _, a) => x === a[0])), d + ' never pairs an article with itself');

// 3. seeded draws
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pool = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
const starts = new Set();
for (let i = 0; i < 1500; i++) {
  let s = ''; const n = 1 + Math.floor(rnd() * 12); for (let k = 0; k < n; k++) s += pool[Math.floor(rnd() * pool.length)];
  if (!s.trim()) continue;
  for (const d of ['easy', 'medium', 'hard']) {
    const m = W.computeCorpusMatchup(s, d), again = W.computeCorpusMatchup(s, d);
    ok(m.start === again.start && m.target === again.target, 'deterministic ' + s + d);
    ok(pairSets[d].has(m.start + '\u0000' + m.target), `${d} ${JSON.stringify(s)} drew ${m.start} -> ${m.target}, which is not in corpusPairs`);
    if (d === 'easy') ok(W.corpusCategoryOf(m.start) === W.corpusCategoryOf(m.target), 'easy stays in one category ' + s);
    if (d === 'hard') ok(W.CORPUS_FAR.some(p => (p[0] === W.corpusCategoryOf(m.start) && p[1] === W.corpusCategoryOf(m.target)) || (p[1] === W.corpusCategoryOf(m.start) && p[0] === W.corpusCategoryOf(m.target))), 'hard crosses a far pair ' + s);
    if (d === 'medium') starts.add(m.start);
  }
}
ok(starts.size > 50, 'medium reaches most of the corpus as a start (' + starts.size + ' of ' + titles.length + ')');
for (const d of ['easy', 'medium', 'hard']) {
  eq(W.computeCorpusMatchup('Bulldogs  1', d), W.computeCorpusMatchup('bulldogs 1', d), 'case and spacing ' + d);
  eq(W.computeCorpusMatchup('  period 3 ', d), W.computeCorpusMatchup('period 3', d), 'trim ' + d);
}
// a corpus seed is its own space: the draw key differs from the online one, so the same phrase is not the
// same race, and across many seeds the two sources disagree almost always
let same = 0, total = 0;
for (let i = 0; i < 300; i++) for (const d of ['easy', 'medium', 'hard']) {
  const a = W.computeCorpusMatchup('seed' + i, d), b = W.computeMatchup('seed' + i, d); total++;
  if (a.start === b.start && a.target === b.target) same++;
}
ok(same / total < 0.02, `a seed means a different race in the two sources (${same} of ${total} identical)`);

// 4. golden: the corpus matchups for the same 80 seeds the online golden uses (kept apart from it)
const SEEDS = [...new Set(onlineGolden.matchups.map(m => m.s))];
const mine = { articles: titles.map(t => [t, W.CORPUS[t][0]]), farPairs: W.CORPUS_FAR, matchups: [] };
for (const s of SEEDS) for (const d of ['easy', 'medium', 'hard']) { const m = W.computeCorpusMatchup(s, d); mine.matchups.push({ s, d, start: m.start, target: m.target }); }
if (process.argv.includes('--update')) {
  fs.writeFileSync(goldenPath, JSON.stringify(mine, null, 1) + '\n');
  console.log('wrote ' + path.relative(process.cwd(), goldenPath));
} else {
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  eq(golden.articles, mine.articles, 'the article titles and categories, in order, equal the golden');
  eq(golden.farPairs, mine.farPairs, 'the far pairs equal the golden');
  eq(golden.matchups.length, 240, 'golden has 80 seeds x 3 difficulties');
  golden.matchups.forEach((g, i) => { const m = mine.matchups[i]; ok(m && g.s === m.s && g.d === m.d && g.start === m.start && g.target === m.target, `golden corpus matchup ${JSON.stringify(g.s)} ${g.d}: ${m && m.start} -> ${m && m.target}, golden ${g.start} -> ${g.target}`); });
}
ok(fs.readFileSync(path.join(here, 'golden-matchups.json'), 'utf8').length > 1000, 'the online golden is separate and still there');

// 5. the finish code says which source it used
const P = { v: 1, s: 'bulldogs1', d: 'medium', t: 90000, c: 4, h: 0 };
const cm = W.computeCorpusMatchup(P.s, P.d);
const g1 = graphOf(W.CORPUS);
const route = (a, b) => { const prev = new Map([[a, null]]), q = [a]; for (let i = 0; i < q.length; i++) for (const n of g1.get(q[i])) if (!prev.has(n)) { prev.set(n, q[i]); q.push(n); } const r = []; for (let x = b; x; x = prev.get(x)) r.unshift(x); return r; };
const cpath = route(cm.start, cm.target);
Object.assign(W.state, { seed: P.s, difficulty: P.d, elapsedMs: P.t, clicks: P.c, hints: P.h, path: cpath, source: 'corpus' });
const ccode = await W.buildFinishCode();
const cdec = await W.decodeFinishCode(ccode);
eq(cdec, { ...P, p: cpath, src: 'corpus' }, 'a corpus code decodes with src: corpus');
Object.assign(W.state, { source: 'wiki' });
const wcode = await W.buildFinishCode();
const wdec = await W.decodeFinishCode(wcode);
ok(!('src' in wdec), 'a Wikipedia code has no src field, exactly as before');
ok(ccode !== wcode, 'the same race code differs between sources');
// a code whose src is anything but "corpus" is refused (valid checksum, forged field)
const forged = Buffer.from(JSON.stringify({ ...P, p: cpath, src: 'wiki' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let msg = ''; try { await W.decodeFinishCode('WR0.' + W.checksum('WR0', forged) + '.' + forged); } catch (e) { msg = e.message; }
ok(/article source this page does not know/.test(msg), 'an unknown src is refused: ' + msg);
// path check used by the verify screen
eq(W.corpusPathProblem(cpath), '', 'a path that follows real links has no problem');
ok(/does not link to/.test(W.corpusPathProblem([cm.start, cm.target])), 'a jump with no link is named');
ok(/not one of the offline articles/.test(W.corpusPathProblem(['Nowhere'])), 'an unknown article is named');
// plain text for Peek / Hint has no link markup
ok(titles.every(t => !/\[\[|\]\]/.test(W.corpusPlain(t))), 'corpusPlain leaves no [[ ]] markup');

// 6. the class scoreboard keeps the sources apart, and checks a corpus race against the corpus draw
const item = (line, label, payload) => ({ line, label, payload });
const wiki = W.computeMatchup(P.s, P.d);
ok(wiki.start !== cm.start || wiki.target !== cm.target, 'precondition: bulldogs1/medium differs between the sources');
const groups = W.rankRaces([
  item(1, 'Corpus', { ...P, p: cpath, src: 'corpus' }),
  item(2, 'Wiki', { ...P, p: [wiki.start, 'X', wiki.target] }),
  item(3, 'Corpus path posing as Wikipedia', { ...P, t: 80000, p: cpath })
]);
eq(groups.map(g => g.source + ':' + g.rows.map(r => r.label).join(',')).sort(), ['corpus:Corpus', 'wiki:Corpus path posing as Wikipedia,Wiki'], 'the same seed and difficulty make a group per source');
eq(groups.find(g => g.source === 'corpus').rows[0].endsOk, true, 'a corpus path ends where the corpus seed says');
eq(groups.find(g => g.source === 'wiki').rows.find(r => r.label.startsWith('Corpus path')).endsOk, false, 'a corpus path without src does not match the Wikipedia draw');

// 7. mutants: the audits can fail
const mutate = (label, from, to, expect) => {
  const m = ENGINE.replace(from, to);
  ok(m !== ENGINE, 'mutant anchor exists: ' + label);
  const bad = auditPairs(load(m));
  ok(expect.test(bad.join('\n')), `mutant (${label}) is caught: ${bad.slice(0, 2).join(' | ') || 'nothing reported'}`);
};
mutate('a direct link may be drawn', "return pool.filter(function (t) { return t !== start && direct.indexOf(t) === -1; });", "return pool.filter(function (t) { return t !== start; });", /1 click/);
mutate('a start may race itself', "return pool.filter(function (t) { return t !== start && direct.indexOf(t) === -1; });", "return pool.filter(function (t) { return direct.indexOf(t) === -1; });", /races itself/);
const withCorpus = (edit) => { const c = JSON.parse(JSON.stringify(W.CORPUS)); edit(c); return c; };
const has = (bad, re) => bad.some(b => re.test(b));
ok(has(auditGraph(withCorpus(c => { c.Atom[1] = c.Atom[1].replace('[[Energy|energy]]', '[[Energyy|energy]]'); })), /unresolved link Atom -> Energyy/), 'mutant: a link to nothing is caught');
ok(has(auditGraph(withCorpus(c => { c.Soil[1] = c.Soil[1].replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1'); })), /dead end: Soil/), 'mutant: an article with no links is caught');
ok(has(auditGraph(withCorpus(c => { for (const t of Object.keys(c)) c[t][1] = c[t][1].replace(/\[\[Great Wall of China(\|[^\]]+)?\]\]/g, 'the Great Wall'); })), /orphan: nothing links to Great Wall of China/), 'mutant: an article nothing links to is caught');
ok(has(auditGraph(withCorpus(c => { for (const t of Object.keys(c)) if (t !== 'Soil') c[t][1] = c[t][1].replace(/\[\[Soil(\|[^\]]+)?\]\]/g, 'soil'); c.Soil[1] = c.Soil[1] + ' Also [[Tree]].'; })), /orphan: nothing links to Soil/), 'mutant: one-way trap (Soil unreachable) is caught');
ok(has(auditGraph(withCorpus(c => { delete c.Tree; })), /unresolved link/), 'mutant: a deleted article leaves unresolved links');
ok(has(auditGraph(withCorpus(c => { const keep = ['Atom', 'Energy', 'Light', 'Heat']; for (const t of Object.keys(c)) if (!keep.includes(t)) delete c[t]; })), /only 4 articles/), 'mutant: a corpus of four is too small');
// two islands: cut every link between Science and the rest, keep the inside of each
ok(has(auditGraph(withCorpus(c => { const sci = new Set(Object.keys(c).filter(t => c[t][0] === 'Science')); for (const t of Object.keys(c)) c[t][1] = c[t][1].replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (m, a, b) => (sci.has(t) === sci.has(a) ? m : (b ? b.slice(1) : a))); })), /cannot reach/), 'mutant: two islands (not strongly connected) is caught');

console.log(`wiki-race corpus graph: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
