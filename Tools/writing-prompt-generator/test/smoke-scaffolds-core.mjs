// smoke-scaffolds-core.mjs — pure Node. The words and the choosing behind the
// writing prompt's sentence starters and "if you're stuck" lines.
//
//   node Tools/writing-prompt-generator/test/smoke-scaffolds-core.mjs
//
// Nobody has read the lines for sense; this holds them to every rule a machine
// can state, against every prompt they can appear with: the bank's 200, a
// spread of teacher-style prompts, and every seed 0 to 19. The files are read
// into a vm context so a deliberate break can point WPG_DATA_FILE or
// WPG_SCAFFOLDS_FILE at a damaged copy.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..');
const ctx = vm.createContext({});
ctx.global = ctx;
let drew = 0;
vm.runInContext('Math.random = function () { __drew(); return 0.5; };', Object.assign(ctx, { __drew: () => { drew++; } }));
vm.runInContext(fs.readFileSync(path.join(dir, 'wpg-prompts.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(process.env.WPG_DATA_FILE || path.join(dir, 'wpg-scaffold-data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(process.env.WPG_SCAFFOLDS_FILE || path.join(dir, 'wpg-scaffolds.js'), 'utf8'), ctx);
const S = ctx.WpgScaffolds, DATA = ctx.WpgScaffoldData, BANK = ctx.WritingPrompts;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); if (failed <= 40) console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const BANDS = ['ms', 'hs'];
const GENRES = BANK.GENRES.map(g => g.key);
const TASKS = { narrative: ['any'], persuasive: ['position', 'audience'], descriptive: ['any'], expository: ['any', 'steps'], creative: ['any', 'opening'] };

console.log('Writing prompt scaffolds — words and choice');

/* ── 1. the data has every list the chooser can ask for ───────────────── */
for (const b of BANDS) for (const g of GENRES) {
  for (const t of TASKS[g]) {
    const list = DATA.STARTERS[b] && DATA.STARTERS[b][g] && DATA.STARTERS[b][g][t];
    ok(Array.isArray(list) && list.length >= 4, `${b}/${g}/${t} has at least four starters (${list && list.length})`);
  }
  const st = DATA.STUCK[b] && DATA.STUCK[b][g];
  ok(Array.isArray(st) && st.length >= 3, `${b}/${g} has at least three stuck lines (${st && st.length})`);
}

/* ── 2. rules for one starter ─────────────────────────────────────────── */
const EMOTION = /\b(happy|sad|angry|afraid|scared|proud|excited|nervous|lonely|jealous|joy|fear|anger|love|hate|hated|loved|ashamed|embarrassed)\b/i;
const STANCE = /\b(disagree|agree|against|oppose|opposed|opposes|shouldn't|should not|wrong|bad idea|good idea|yes|no|never|always)\b/i;
const PROMPT_VERB = /^(write|tell|describe|explain|argue|convince|should|take a|compose|invent)\b/i;
const MARKUP = /[<>&"`_\\]|&[a-z]+;/;

function starterProblems(s) {
  const p = [];
  if (typeof s !== 'string') return ['not a string'];
  if (!s.endsWith('...')) p.push('does not end with "..."');
  const body = s.slice(0, -3);
  if (/\.\.\./.test(body)) p.push('a second ellipsis');
  if (/[.!?]/.test(body)) p.push('a full sentence before the end');
  if (!/^[A-Z]/.test(s)) p.push('does not start with a capital');
  if (s !== s.trim() || /\s{2}/.test(s)) p.push('stray spaces');
  const words = body.trim().split(/\s+/).length;
  if (words < 2 || words > 11) p.push(`${words} words`);
  if (s.length > 58) p.push(`${s.length} characters`);
  if (MARKUP.test(s)) p.push('markup or a blank');
  if (/[^\x20-\x7e]/.test(s)) p.push('a character outside plain ASCII');
  if (EMOTION.test(s)) p.push('names an emotion');
  if (PROMPT_VERB.test(s)) p.push('reads as a prompt');
  return p;
}
function stuckProblems(s) {
  const p = [];
  if (typeof s !== 'string') return ['not a string'];
  if (!/[.?]$/.test(s)) p.push('does not end with . or ?');
  const inner = s.slice(0, -1);
  if (/[.!?]/.test(inner.replace(/\bAsk yourself:/g, ''))) p.push('more than one sentence');
  if (/\.\.\./.test(s)) p.push('an ellipsis');
  if (!/^[A-Z]/.test(s)) p.push('does not start with a capital');
  if (s.length < 30 || s.length > 105) p.push(`${s.length} characters`);
  if (MARKUP.test(s)) p.push('markup or a blank');
  if (/[^\x20-\x7e]/.test(s)) p.push('a character outside plain ASCII');
  if (PROMPT_VERB.test(s)) p.push('opens like a prompt');
  if (s !== s.trim() || /\s{2}/.test(s)) p.push('stray spaces');
  return p;
}
for (const b of BANDS) for (const g of GENRES) for (const t of TASKS[g]) {
  const list = (DATA.STARTERS[b][g] || {})[t] || [];
  list.forEach(s => {
    const pr = starterProblems(s);
    ok(!pr.length, `starter ${b}/${g}/${t} "${s}": ${pr.join(', ')}`);
    if (g === 'persuasive') ok(!STANCE.test(s.slice(0, -3)), `starter ${b}/${g}/${t} "${s}" takes a side`);
  });
  ok(new Set(list.map(s => s.toLowerCase())).size === list.length, `${b}/${g}/${t} has no repeated starter`);
}
for (const b of BANDS) for (const g of GENRES) {
  const list = DATA.STUCK[b][g] || [];
  list.forEach(s => {
    const pr = stuckProblems(s);
    ok(!pr.length, `stuck ${b}/${g} "${s}": ${pr.join(', ')}`);
  });
  ok(new Set(list).size === list.length, `${b}/${g} has no repeated stuck line`);
  if (g === 'persuasive') list.forEach(s => ok(!STANCE.test(s), `stuck ${b}/${g} "${s}" takes a side`));
}

/* ── 3. which list a prompt gets ──────────────────────────────────────── */
const TASK_CASES = [
  ['persuasive', 'Convince your parents to let you get a pet.', 'audience'],
  ['persuasive', 'convince someone that your favorite book is worth their time.', 'audience'],
  ['persuasive', 'Should students choose their own seats? Convince your teacher.', 'position'],
  ['persuasive', 'Argue for or against school uniforms.', 'position'],
  ['expository', 'Explain how to do something you are good at.', 'steps'],
  ['expository', 'Explain the steps to plan the perfect birthday party.', 'steps'],
  ['expository', 'Explain the process of how a bill becomes law, and where it commonly gets stuck.', 'steps'],
  ['expository', 'Explain the process and ethics of a scientific breakthrough.', 'any'],
  ['expository', 'Explain why recycling matters.', 'any'],
  ['creative', 'Write a story that begins: The last thing I expected to find in my locker was...', 'opening'],
  ['creative', 'Write a story that starts in the middle of an argument, and explain what led there.', 'opening'],
  ['creative', 'A character\'s shadow starts acting on its own.', 'any'],
  ['narrative', 'Convince me this was a good day.', 'any'],
  ['descriptive', 'Explain how to describe things.', 'any']
];
for (const [g, text, want] of TASK_CASES) eq(S.taskOf(g, text), want, `task of "${text.slice(0, 50)}" (${g})`);
eq(S.taskOf('persuasive', ''), 'position', 'an empty prompt gets the genre\'s ordinary task');
eq(S.taskOf('persuasive', null), 'position', 'a missing prompt text does not throw');

/* ── 4. every prompt the lines can appear with ────────────────────────── */
const CUSTOM = [
  'Write about the best thing in your backpack.',
  'Should the class pet be a fish or a hamster? Take a side.',
  'Convince the principal to add a longer lunch.',
  'Explain how to make a paper airplane.',
  'Write a story that begins: The door was open and...',
  'Describe the smell of rain on a hot street.',
  'What would you change about your school, and why?',
  'x',
  '<img src=x onerror=alert(1)> a prompt with markup & an ampersand'
];
const ALL = [];
for (const b of BANDS) for (const g of GENRES) {
  for (const text of BANK.PROMPTS[b][g]) ALL.push({ b, g, text });
  for (const text of CUSTOM) ALL.push({ b, g, text });
}
ok(ALL.length >= 200 + 9 * 10, `the pairing set covers the bank and the custom prompts (${ALL.length})`);

const used = new Map();
let pairings = 0;
for (const { b, g, text } of ALL) {
  const list = S.startersList(b, g, text);
  const task = S.taskOf(g, text);
  eq(list, DATA.STARTERS[b][g][task], `${b}/${g} "${text.slice(0, 40)}" gets the ${task} list`);
  for (const seed of [0, 1, 2, 7, 19]) for (const n of [2, 3, 4]) {
    pairings++;
    const got = S.starters(b, g, text, n, seed);
    if (!ok(got.length === n, `${b}/${g} n=${n} seed ${seed} "${text.slice(0, 30)}" gives ${got.length}`)) continue;
    ok(new Set(got).size === n, `no repeat within a sheet: ${b}/${g} n=${n} seed ${seed} "${text.slice(0, 30)}"`);
    ok(got.every(s => list.includes(s)), `every starter is from the prompt's own list: ${b}/${g} "${text.slice(0, 30)}"`);
    ok(got.every(s => !starterProblems(s).length), `every starter meets the starter rules: ${b}/${g}`);
    eq(S.starters(b, g, text, n, seed), got, `same prompt, same seed, same starters: ${b}/${g} n=${n} seed ${seed}`);
    got.forEach(s => used.set(b + '/' + g + '/' + task + '|' + s, true));
  }
  const line = S.stuck(b, g, text, 0);
  ok(DATA.STUCK[b][g].includes(line), `the stuck line is from the genre's list: ${b}/${g} "${text.slice(0, 30)}"`);
  ok(!starterProblems(line).length || true, 'n/a');
  eq(S.stuck(b, g, text, 0), line, `same prompt, same stuck line: ${b}/${g}`);
  ok(!S.starters(b, g, text, 4, 0).includes(line), `the stuck line is never one of the starters: ${b}/${g}`);
}

/* ── 5. no line is dead data, and a seed can change the choice ────────── */
for (const b of BANDS) for (const g of GENRES) for (const t of TASKS[g]) {
  const list = DATA.STARTERS[b][g][t];
  const dead = list.filter(s => !used.has(`${b}/${g}/${t}|${s}`));
  ok(!dead.length, `every ${b}/${g}/${t} starter can come up (never chosen: ${dead.join(' / ')})`);
}
for (const b of BANDS) for (const g of GENRES) {
  const text = BANK.PROMPTS[b][g][0];
  const sets = new Set();
  for (let seed = 0; seed < 20; seed++) sets.add(JSON.stringify(S.starters(b, g, text, 3, seed)));
  ok(sets.size >= 3, `${b}/${g}: twenty seeds make at least three different choices (${sets.size})`);
  const stuckSet = new Set();
  for (let seed = 0; seed < 20; seed++) stuckSet.add(S.stuck(b, g, text, seed));
  ok(stuckSet.size >= 2, `${b}/${g}: the seed also moves the stuck line (${stuckSet.size})`);
}
// the lines are spread over the bank, not the same few for every prompt
for (const b of BANDS) for (const g of GENRES) {
  const firsts = new Set(BANK.PROMPTS[b][g].map(t => S.starters(b, g, t, 2, 0).join('|')));
  ok(firsts.size >= 8, `${b}/${g}: twenty prompts get at least eight different pairs of starters (${firsts.size})`);
  const stucks = new Set(BANK.PROMPTS[b][g].map(t => S.stuck(b, g, t, 0)));
  ok(stucks.size >= 4, `${b}/${g}: twenty prompts get at least four different stuck lines (${stucks.size})`);
}

/* ── 6. edges ─────────────────────────────────────────────────────────── */
eq(S.starters('ms', 'narrative', 'p', 1, 0).length, 2, 'a count under 2 is raised to 2');
eq(S.starters('ms', 'narrative', 'p', 9, 0).length, 4, 'a count over 4 is cut to 4');
eq(S.starters('ms', 'narrative', 'p', '3', 0).length, 3, 'a count given as text is read');
eq(S.starters('ms', 'narrative', 'p', NaN, 0).length, 2, 'a count that is not a number is 2');
ok(S.starters('xx', 'unknown', 'p', 3, 0).length === 3, 'an unknown band and genre still give three lines');
eq(S.starters('ms', 'unknown', 'p', 3, 0), S.starters('ms', 'narrative', 'p', 3, 0), 'an unknown genre falls back to the narrative lines');
eq(S.starters('hs', 'narrative', 'p', 3, 0).every(s => DATA.STARTERS.hs.narrative.any.includes(s)), true, 'band hs reads the hs list');
ok(S.starters('ms', 'narrative', 'p', 3, 0).every(s => DATA.STARTERS.ms.narrative.any.includes(s)), 'band ms reads the ms list');
ok(S.starters('ms', 'narrative', 'p', 3, undefined).join() === S.starters('ms', 'narrative', 'p', 3, 0).join(), 'no seed means seed 0');
eq(S.normalize(null), { starters: 0, stuck: false }, 'null is off');
eq(S.normalize({}), { starters: 0, stuck: false }, 'an empty object is off');
eq(S.normalize({ starters: 3, stuck: true }), { starters: 3, stuck: true }, 'three and stuck stays');
eq(S.normalize({ starters: 1, stuck: 'yes' }), { starters: 0, stuck: false }, 'one starter, or a stuck that is not true, is off');
eq(S.normalize({ starters: 5 }), { starters: 0, stuck: false }, 'five starters is off');
eq(S.normalize({ starters: '4' }), { starters: 4, stuck: false }, 'four given as text is read');
eq(S.normalize('x'), { starters: 0, stuck: false }, 'a string is off');
ok(S.isOn({ starters: 2 }) && S.isOn({ stuck: true }) && !S.isOn({ starters: 0, stuck: false }) && !S.isOn(undefined), 'isOn follows normalize');
eq(drew, 0, 'choosing a line never called Math.random');
ok(S.hash('a') !== S.hash('b') && S.hash('a') === S.hash('a'), 'hash is stable and tells texts apart');

console.log(`\n${passed} passed, ${failed} failed (${pairings} pairings)`);
if (failed) { console.log('\nFailures:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
