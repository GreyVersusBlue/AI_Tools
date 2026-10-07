// smoke-year-memory.mjs — 002's long pairing memory and its roles, on the real page.
//
//   node Tools/group-team-generator/test/smoke-year-memory.mjs
//
// gtg-memory.js is held in pure Node by smoke-year-memory-core.mjs. This suite
// holds the page to four promises:
//
//   1. WITH BOTH OPTIONS OFF THE PAGE IS THE PAGE IT WAS. golden-old-groupings.json
//      was recorded from the page before this change (_record-golden.mjs, with
//      Math.random replaced by a seeded generator): twelve classes, five rounds
//      each, locks, absences, keep-apart and keep-together, every strategy. The
//      same groups, the same floaters and the same saved string, byte for byte
//      (by SHA-256), must come out now. An old save with neither option loads
//      without gaining a field.
//   2. LONG MEMORY. Ticked, it is saved and restored; it spreads pairings more
//      evenly than off over many rounds on the page itself; a keep-apart rule
//      and a locked group still hold; the same seed and history give the same
//      groups; the explanation says what it did; the grid names who has never
//      worked together.
//   3. ROLES. Named, every group is given its roles each shuffle and they
//      rotate (a locked group keeps its students and rotates its roles), the
//      history is saved, undone, pruned, renamed and reset on request, and the
//      roles reach the cards, the table tents, the group sheets and the copied
//      text without being able to inject markup.
//   4. NOTHING NEW TRAVELS. The share link carries what it always did.
//
// Exits 1 on any failure. Every name here is invented.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { SCENARIOS, runScenario, nameList, mulberryInit } from './_golden-scenarios.mjs';

const PORT = 8514;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';
const here = path.dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);
const K = (a, b) => a < b ? a + '␟' + b : b + '␟' + a;

const server = await serve(PORT);
const browser = await launch();
/* YM_ONLY=2,3 runs only those sections (the deliberate-break runs use it, so each break costs one section and not all six). */
const only = (process.env.YM_ONLY || '').split(',').filter(Boolean);
const want = k => !only.length || only.includes(k);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

const readState = p => p.evaluate(() => JSON.parse(localStorage.getItem('gtg:data:' + localStorage.getItem('gtg:current'))));
const readRaw = p => p.evaluate(() => localStorage.getItem('gtg:data:' + localStorage.getItem('gtg:current')));
const cards = p => p.evaluate(() => [...document.querySelectorAll('#results .group-card')].map(c => ({
  label: c.querySelector('h3 span').firstChild.textContent,
  members: [...c.querySelectorAll('li')].map(li => ({ name: li.children[0].textContent, role: (li.querySelector('.member-role') || {}).textContent || '' })),
})));

async function open(opts = {}) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100, permissions: ['clipboard-read', 'clipboard-write'] });
  if (opts.seed) await page.addInitScript(mulberryInit(opts.seed));
  await page.addInitScript(() => { window.print = () => { window.__printed = document.getElementById('results').innerHTML; }; });
  if (opts.storage) await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const x in k) localStorage.setItem(x, k[x]); } }, [opts.storage, 0]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
async function roster(page, names, { mode = 'count', value = 4, strategy } = {}) {
  await page.fill('#names-input', names.join('\n'));
  await page.dispatchEvent('#names-input', 'input');
  await settle(page, 150);
  await page.click(mode === 'size' ? 'label[for="mode-size"]' : 'label[for="mode-count"]');
  await page.fill('#split-value', String(value));
  if (strategy) await page.selectOption('#strategy-select', strategy);
}
const makeFirst = page => page.click('#generate-btn');

console.log('Group / Team Generator — year memory and roles');

/* ── 1. both options off: the page is the page it was ─────────────────────── */
if (want('1')) {
  const gold = JSON.parse(fs.readFileSync(path.join(here, 'golden-old-groupings.json'), 'utf8'));
  for (const sc of SCENARIOS) {
    const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
    const r = await runScenario(page, BASE, sc);
    const g = gold.scenarios[sc.id];
    ok(JSON.stringify(r.steps) === JSON.stringify(g.steps), `${sc.id}: five rounds of groups and floaters match the page recorded at ${gold.recordedAt}`);
    eq(sha(r.saved), g.savedSha256, `${sc.id}: the saved string is the same bytes`);
    const st = JSON.parse(r.saved);
    ok(!('longMemory' in st) && !('rolesText' in st) && !('roleHistory' in st), `${sc.id}: the save gained none of the new fields`);
    ok(page.__errs.length === 0, `${sc.id}: no page errors (${page.__errs.slice(0, 2).join(' | ')})`);
    await page.context().close();
  }

  // An old save (bare-number pair entries, nothing new) loads, shuffles and saves without gaining a field.
  const names = nameList(8);
  const old = { name: 'Old Block', names: names.join('\n'), mode: 'count', splitValue: 2, balance: false, keepApart: [], keepTogether: [],
    strategy: 'random', oddMode: 'extra', namingMode: 'number', customNames: '', absentNames: [],
    pairHistory: { [K(names[0], names[1])]: 2, [K(names[2], names[3])]: { gen: 3, count: 4 } }, pairGen: 3, rosterName: '', idNames: {} };
  const rawOld = JSON.stringify(old);
  const page = await open({ storage: { 'gtg:list': JSON.stringify(['Old Block']), 'gtg:current': 'Old Block', 'gtg:data:Old Block': rawOld } });
  eq(await page.isChecked('#long-memory-check'), false, 'an old save: long memory is off');
  eq(await page.inputValue('#roles-input'), '', 'an old save: no roles');
  /* The page has always normalised a save on opening it: the split value as typed text, a bare-number pair as { gen, count }.
     Nothing else may change, and nothing may be added. */
  const expectOpen = { ...old, splitValue: '2', pairHistory: { [K(names[0], names[1])]: { gen: 2, count: 1 }, [K(names[2], names[3])]: { gen: 3, count: 4 } } };
  eq(await readRaw(page), JSON.stringify(expectOpen), 'an old save opens as the old page opened it: its own normalisation and no new field');
  await makeFirst(page); await settle(page, 150);
  const after = await readState(page);
  ok(!('longMemory' in after) && !('rolesText' in after) && !('roleHistory' in after), 'an old save shuffled gains none of the new fields');
  eq(after.pairGen, 4, 'and its generation moves on as it always did');
  eq(after.pairHistory[K(names[2], names[3])].count >= 4, true, 'and its counts carried on from 4');
  ok((await cards(page)).every(c => c.members.every(m => m.role === '')), 'no role shows anywhere without a role list');
  await page.context().close();
}

/* ── 2. long memory ───────────────────────────────────────────────────────── */
if (want('2')) {
  const names = nameList(12);
  let page = await open({ seed: 5 });
  await roster(page, names, { mode: 'count', value: 3 });
  eq(await page.isChecked('#long-memory-check'), false, 'long memory starts off');
  await page.check('#long-memory-check');
  await settle(page, 150);
  eq((await readState(page)).longMemory, true, 'ticking it saves longMemory: true');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  eq(await page.isChecked('#long-memory-check'), true, 'and it is still ticked after a reload');
  await makeFirst(page); await settle(page, 150);
  ok(/Long memory is on: \d+ of \d+ pairings/.test(await page.textContent('#explain-area')), 'the explanation says long memory was on, with the new-pair count');
  ok(/Long memory is on, so reshuffles also steer/.test(await page.textContent('#pair-history-hint')), 'the hint under the buttons says it is on');
  await page.uncheck('#long-memory-check');
  await settle(page, 150);
  ok(!('longMemory' in (await readState(page))), 'unticking removes the field again');
  await page.click('#regenerate-btn'); await settle(page, 100);
  ok(!/Long memory is on:/.test(await page.textContent('#explain-area')), 'off: the explanation does not mention it');
  await page.context().close();

  /* The same seed and history give the same groups. */
  const run = async () => {
    const p = await open({ seed: 77 });
    await roster(p, nameList(16), { mode: 'count', value: 4 });
    await p.check('#long-memory-check');
    await makeFirst(p); for (let i = 0; i < 5; i++) { await p.click('#regenerate-btn'); }
    const g = JSON.stringify(await cards(p)); await p.context().close(); return g;
  };
  eq(await run(), await run(), 'with Math.random pinned, the same class and history give the same groups six rounds running');

  /* Fairness on the real page: the spread of pair counts after many rounds, on vs off, same seeds. */
  const SHAPES = [[20, 5], [24, 6], [28, 7]], ROUNDS = 12, SEEDS = [1, 2, 3, 4];
  const measure = async (n, k, seed, on) => {
    const p = await open({ seed });
    const ns = nameList(n);
    await roster(p, ns, { mode: 'count', value: k });
    if (on) await p.check('#long-memory-check');
    await makeFirst(p);
    for (let i = 1; i < ROUNDS; i++) await p.click('#regenerate-btn');
    const st = await readState(p);
    await p.context().close();
    let pairs = 0, sum = 0, sq = 0, never = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const e = st.pairHistory[K(ns[i], ns[j])]; const c = e ? e.count : 0;
      pairs++; sum += c; sq += c * c; if (!c) never++;
    }
    const mean = sum / pairs;
    return { variance: sq / pairs - mean * mean, never, pairGen: st.pairGen };
  };
  console.log('  page, 12 rounds, mean over 4 seeds:   off: variance never   on: variance never');
  for (const [n, k] of SHAPES) {
    const a = { off: { v: 0, n: 0 }, on: { v: 0, n: 0 } };
    for (const seed of SEEDS) for (const on of [false, true]) {
      const m = await measure(n, k, seed * 31 + n, on);
      eq(m.pairGen, ROUNDS, `${n} in ${k}, seed ${seed}, ${on ? 'on' : 'off'}: ${ROUNDS} rounds were recorded`);
      a[on ? 'on' : 'off'].v += m.variance / SEEDS.length; a[on ? 'on' : 'off'].n += m.never / SEEDS.length;
    }
    console.log(`  ${n} in ${k}${' '.repeat(26)} ${a.off.v.toFixed(2)} ${a.off.n.toFixed(1)}   ${a.on.v.toFixed(2)} ${a.on.n.toFixed(1)}`);
    ok(a.on.v <= a.off.v, `${n} in ${k}: the spread of pair counts is no worse with long memory on, on the page (${a.on.v.toFixed(2)} vs ${a.off.v.toFixed(2)})`);
    ok(a.on.n < a.off.n, `${n} in ${k}: fewer pairs have never worked together with it on (${a.on.n.toFixed(1)} vs ${a.off.n.toFixed(1)})`);
  }

  /* Keep-apart and keep-together hold with it on, over many rounds; a locked group is not touched. */
  {
    const ns = nameList(16);
    const p = await open({ seed: 9 });
    await roster(p, ns, { mode: 'count', value: 4 });
    for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) { await p.selectOption('#pair-a', ns[a]); await p.selectOption('#pair-b', ns[b]); await p.click('#add-pair-btn'); }
    await p.selectOption('#together-a', ns[6]); await p.selectOption('#together-b', ns[7]); await p.click('#add-together-btn');
    await p.check('#long-memory-check');
    await makeFirst(p);
    let broken = 0;
    for (let i = 0; i < 14; i++) {
      const gs = (await cards(p)).map(c => c.members.map(m => m.name));
      const at = n => gs.findIndex(g => g.includes(n));
      for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) if (at(ns[a]) === at(ns[b])) broken++;
      if (at(ns[6]) !== at(ns[7])) broken++;
      await p.click('#regenerate-btn');
    }
    eq(broken, 0, 'long memory on, 14 rounds: no keep-apart or keep-together rule was ever broken');
    await p.click('[data-lock="0"]');
    const lockedBefore = (await cards(p))[0].members.map(m => m.name).join('|');
    for (let i = 0; i < 6; i++) await p.click('#regenerate-btn');
    eq((await cards(p))[0].members.map(m => m.name).join('|'), lockedBefore, 'a locked group is the same six reshuffles later');
    ok(p.__errs.length === 0, `no page errors (${p.__errs.slice(0, 2).join(' | ')})`);
    await p.context().close();
  }

  /* The grid: who has not yet worked together, and the all-met sentence. */
  {
    const ns = nameList(6);
    const p = await open({ seed: 3 });
    await roster(p, ns, { mode: 'count', value: 3 });
    await makeFirst(p);
    await p.click('#view-pairing-grid-btn'); await settle(p, 100);
    const t = await p.textContent('#grid-content');
    ok(/Who has not yet worked together/.test(t), 'the grid has a "not yet worked together" list');
    const st = await readState(p);
    const never = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (!st.pairHistory[K(ns[i], ns[j])]) never.push([ns[i], ns[j]]);
    ok(never.length > 0, 'two groups of three leave pairs that have never met');
    const first = ns.find(n => never.some(pr => pr.includes(n)));
    const li = await p.locator('#grid-content .never-list li', { hasText: first }).first().textContent();
    const want = never.filter(pr => pr.includes(first)).map(pr => pr[0] === first ? pr[1] : pr[0]);
    ok(want.every(w => li.includes(w)), `${first}'s line names everyone they have not met (${want.join(', ')})`);
    ok(/has worked with \d of 5/.test(li), 'and says how many of the five they have');
    await p.keyboard.press('Escape');
    // every pair met → the sentence
    const all = {}; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) all[K(ns[i], ns[j])] = { gen: 1, count: 1 };
    await p.evaluate(h => { const k = 'gtg:data:' + localStorage.getItem('gtg:current'); const s = JSON.parse(localStorage.getItem(k)); s.pairHistory = h; localStorage.setItem(k, JSON.stringify(s)); }, all);
    await p.reload({ waitUntil: 'networkidle' }); await settle(p, 300);
    await p.click('#view-pairing-grid-btn'); await settle(p, 100);
    ok(/Everyone on the roster has worked with everyone else at least once/.test(await p.textContent('#grid-content')), 'when every pair has met the list says so');
    eq(await p.locator('#grid-content .never-list').count(), 0, '... and shows no list');
    await p.context().close();
  }

  /* A name with markup is text in the grid and in the list. */
  {
    const p = await open({ seed: 4 });
    const ns = ['<img src=x onerror=window.__hit=1> Ann', 'Bob', 'Cat', 'Dan'];
    await roster(p, ns, { mode: 'count', value: 2 });
    await makeFirst(p); await p.click('#view-pairing-grid-btn'); await settle(p, 100);
    eq(await p.locator('#grid-content img').count(), 0, 'markup in a name is text in the grid and its list');
    eq(await p.evaluate(() => window.__hit || 0), 0, '... and nothing ran');
    await p.context().close();
  }

  /* Reset asks first. */
  {
    const p = await open({ seed: 6 });
    await roster(p, nameList(8), { mode: 'count', value: 2 });
    await makeFirst(p); await settle(p, 100);
    const n0 = Object.keys((await readState(p)).pairHistory).length;
    p.once('dialog', d => d.dismiss());
    await p.click('#reset-pair-history-btn'); await settle(p, 100);
    eq(Object.keys((await readState(p)).pairHistory).length, n0, 'Reset pairing memory: Cancel keeps it');
    p.once('dialog', d => d.accept());
    await p.click('#reset-pair-history-btn'); await settle(p, 100);
    eq(Object.keys((await readState(p)).pairHistory).length, 0, 'Reset pairing memory: OK clears it');
    await p.context().close();
  }
}

/* ── 3. roles ─────────────────────────────────────────────────────────────── */
const ROLES = ['Recorder', 'Reporter', 'Timekeeper', 'Checker'];
if (want('3')) {
  const ns = nameList(8);
  let p = await open({ seed: 21 });
  await roster(p, ns, { mode: 'count', value: 2 });
  await p.fill('#roles-input', ROLES.join('\n'));
  await settle(p, 100);
  eq((await readState(p)).rolesText, ROLES.join('\n'), 'the role list is saved as typed');
  await makeFirst(p); await settle(p, 100);
  let cs = await cards(p);
  ok(cs.every(c => new Set(c.members.map(m => m.role)).size === 4 && c.members.every(m => ROLES.includes(m.role))), 'two groups of four: every student has a role and a group has each role once');
  const saved = await readState(p);
  ok(saved.roleHistory && Object.keys(saved.roleHistory).length === 8, 'the role history is saved for all eight');
  ok(/\d of 8 students got a role they had not held before/.test(await p.textContent('#explain-area')), 'the explanation counts who got a new role');
  eq(await p.evaluate(() => document.querySelectorAll('#results .member-role').length), 8, 'a role shows on every card line');

  /* Lock one group: same students every round, so the roles must cycle: after four rounds each held each role once. */
  await p.click('[data-lock="0"]'); await p.click('[data-lock="1"]');
  const seen = {};
  const note = cs2 => cs2.forEach(c => c.members.forEach(m => { (seen[m.name] = seen[m.name] || []).push(m.role); }));
  note(cs);
  for (let r = 0; r < 3; r++) { await p.click('#regenerate-btn'); note(await cards(p)); }
  ok(Object.values(seen).every(rs => new Set(rs).size === 4), 'locked groups, four rounds: every student held each of the four roles once');
  for (let r = 0; r < 4; r++) { await p.click('#regenerate-btn'); note(await cards(p)); }
  ok(Object.values(seen).every(rs => ROLES.every(x => rs.filter(y => y === x).length === 2)), 'eight rounds: each exactly twice');
  const st8 = await readState(p);
  ok(ROLES.every(r => st8.roleHistory[ns[0]].counts[r] === 2), 'and the saved counts say so');

  /* Undo takes the last round's roles back out of the history. */
  const before = JSON.stringify((await readState(p)).roleHistory);
  await p.click('#regenerate-btn'); 
  ok(JSON.stringify((await readState(p)).roleHistory) !== before, 'a round changes the role history');
  await p.click('#undo-btn'); await settle(p, 100);
  eq(JSON.stringify((await readState(p)).roleHistory), before, 'Undo puts the role history back as it was');

  /* Copy as text, tents, sheets and print carry the roles. */
  await p.click('#copy-btn'); await settle(p, 200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(/Group 1\n {2}\S.* — (Recorder|Reporter|Timekeeper|Checker)/.test(clip), `Copy as Text puts the role after the name (${JSON.stringify(clip.slice(0, 60))})`);
  await p.click('#print-tents-btn'); await settle(p, 100);
  let printed = await p.evaluate(() => window.__printed);
  ok((printed.match(/class="t-role"/g) || []).length === 16, 'table tents: a role on every line, on both panels of every tent');
  await p.click('#print-sheets-btn'); await settle(p, 100);
  printed = await p.evaluate(() => window.__printed);
  ok((printed.match(/class="s-role"/g) || []).length === 8, 'group sheets: a role beside every name');
  ok(await p.evaluate(() => document.querySelectorAll('#results .member-role').length === 8), 'and the live cards are back after printing');
  await p.click('#print-btn'); await settle(p, 100);
  ok(((await p.evaluate(() => window.__printed)).match(/class="member-role"/g) || []).length === 8, 'Print: the cards carry their roles');

  /* The grid has a roles table. */
  await p.click('#view-pairing-grid-btn'); await settle(p, 100);
  ok(/Roles held this year/.test(await p.textContent('#grid-content')), 'the grid overlay has a "Roles held this year" table');
  eq(await p.locator('#grid-content table.pairing-grid').nth(1).locator('tr').count(), 9, 'with a row for each of eight students and a header');
  const a11y = await a11yScan(p);
  eq(a11y.length, 0, `axe: no serious violations with roles and the grid open (${JSON.stringify(a11y.slice(0, 2)).slice(0, 200)})`);
  await p.keyboard.press('Escape');

  /* Reset role history asks first and leaves the pairing memory alone. */
  const pairsBefore = JSON.stringify((await readState(p)).pairHistory);
  p.once('dialog', d => d.dismiss());
  await p.click('#reset-roles-btn'); await settle(p, 100);
  ok(!!(await readState(p)).roleHistory, 'Reset role history: Cancel keeps it');
  p.once('dialog', d => d.accept());
  await p.click('#reset-roles-btn'); await settle(p, 100);
  const afterReset = await readState(p);
  ok(!('roleHistory' in afterReset), 'Reset role history: OK clears it');
  eq(JSON.stringify(afterReset.pairHistory), pairsBefore, '... and leaves the pairing memory alone');
  ok(afterReset.rolesText === ROLES.join('\n'), '... and keeps the role list');

  /* Clearing the list turns roles off and removes the field. */
  await p.fill('#roles-input', '   \n  ');
  await settle(p, 100);
  ok(!('rolesText' in (await readState(p))), 'an empty role list removes rolesText');
  await p.click('#regenerate-btn'); await settle(p, 100);
  ok((await cards(p)).every(c => c.members.every(m => m.role === '')), 'and the next round shows no roles');
  ok(!('roleHistory' in (await readState(p))), 'and records none');
  ok(p.__errs.length === 0, `no page errors (${p.__errs.slice(0, 2).join(' | ')})`);
  await p.context().close();
}

/* Roles: odd groups, a long list, markup, the roster, a rename. */
if (want('3b')) {
  const ns = nameList(9);
  const p = await open({ seed: 22 });
  await roster(p, ns, { mode: 'count', value: 2 });       // groups of 5 and 4
  await p.fill('#roles-input', ROLES.join('\n'));
  await makeFirst(p); await settle(p, 100);
  const cs = await cards(p);
  const big = cs.find(c => c.members.length === 5), small = cs.find(c => c.members.length === 4);
  eq(big.members.filter(m => m.role === '').length, 1, 'a group of five with four roles: one student has no role');
  eq(new Set(big.members.map(m => m.role).filter(Boolean)).size, 4, '... and the other four hold the four roles');
  eq(small.members.filter(m => m.role === '').length, 0, 'a group of four has no one without');

  await p.fill('#roles-input', ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].join('\n'));
  await p.fill('#split-value', '3');
  await p.click('#generate-btn'); await settle(p, 100);
  const c3 = await cards(p);
  ok(c3.every(g => g.members.length === 3 && g.members.map(m => m.role).sort().join() === 'Alpha,Beta,Gamma'), 'groups of three with six roles: the first three roles of the list, the rest left unfilled');

  await p.fill('#roles-input', '<img src=x onerror=window.__hit2=1>\nSecond <b>role</b>');
  await p.click('#regenerate-btn'); await settle(p, 100);
  eq(await p.locator('#results img, #results b').count(), 0, 'a role with markup is text on the cards');
  await p.click('#print-tents-btn'); await settle(p, 100);
  ok(!/<img|<b>/.test(await p.evaluate(() => window.__printed)), '... in the tents');
  await p.click('#print-sheets-btn'); await settle(p, 100);
  ok(!/<img|<b>/.test(await p.evaluate(() => window.__printed)), '... and on the sheets');
  eq(await p.evaluate(() => window.__hit2 || 0), 0, '... and nothing ran');

  // A student who leaves the roster loses their role history on the next shuffle.
  await p.fill('#roles-input', ROLES.join('\n'));
  await p.fill('#names-input', ns.slice(1).join('\n'));
  await p.dispatchEvent('#names-input', 'input'); await settle(p, 100);
  await p.click('#generate-btn'); await settle(p, 100);
  ok(!(ns[0] in (await readState(p)).roleHistory), 'a student who left the roster has no role history after the next shuffle');
  const rh = (await readState(p)).roleHistory;
  ok(ns.slice(1).every(n => n in rh), '... and everyone still on it has');
  await p.context().close();
}

/* A hand-edited or damaged role history is read safely. */
if (want('3c')) {
  const ns = nameList(6);
  const bad = { name: 'Bad Block', names: ns.join('\n'), mode: 'count', splitValue: 2, keepApart: [], keepTogether: [], strategy: 'random', oddMode: 'extra', namingMode: 'number', customNames: '',
    absentNames: [], pairHistory: {}, pairGen: 0, rosterName: '', idNames: {}, rolesText: 'Recorder\nReporter\nChecker',
    roleHistory: JSON.parse('{"__proto__":{"counts":{"x":1}},"' + ns[0] + '":{"counts":{"Recorder":"lots","Reporter":-4},"last":5},"' + ns[1] + '":7}') };
  const p = await open({ seed: 8, storage: { 'gtg:list': JSON.stringify(['Bad Block']), 'gtg:current': 'Bad Block', 'gtg:data:Bad Block': JSON.stringify(bad) } });
  await makeFirst(p); await settle(p, 100);
  ok((await cards(p)).every(c => new Set(c.members.map(m => m.role)).size === 3), 'a damaged role history: the page still hands out three roles to a group of three');
  ok(p.__errs.length === 0, `... with no page errors (${p.__errs.slice(0, 2).join(' | ')})`);
  eq(await p.evaluate(() => ({}).x), undefined, '... and Object.prototype is clean');
  await p.context().close();
}

/* A roster rename carries the role history with it (the same route as the pair memory). */
if (want('3d')) {
  const ROSTER = 'Period 3 Science', OLD = ['Smith, Aiden', 'Hopper, Grace', 'Bly, Nellie', 'Lee, Quinn'], NEW = ['Aiden Smith', 'Grace Hopper', 'Nellie Bly', 'Quinn Lee'];
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  const ids = await page.evaluate(([roster, old]) => {
    localStorage.clear(); window.Roster.setRoster(roster, old); window.Roster.syncRecords(roster, old);
    return window.Roster.getStudents(roster).map(r => r.id);
  }, [ROSTER, OLD]);
  await page.evaluate(({ ids, roster, old }) => {
    const idNames = {}; ids.forEach((id, i) => { idNames[id] = old[i]; });
    localStorage.setItem('gtg:list', JSON.stringify(['Block A'])); localStorage.setItem('gtg:current', 'Block A');
    localStorage.setItem('gtg:data:Block A', JSON.stringify({ name: 'Block A', names: old.join('\n'), mode: 'count', splitValue: 2, balance: false, keepApart: [], keepTogether: [],
      strategy: 'random', oddMode: 'extra', namingMode: 'number', customNames: '', absentNames: [], pairHistory: {}, pairGen: 2, rosterName: roster, idNames,
      rolesText: 'Recorder\nChecker', roleHistory: { [old[0]]: { counts: { Recorder: 2 }, last: { Recorder: 2 } }, [old[1]]: { counts: { Checker: 1 }, last: { Checker: 1 } } } }));
  }, { ids, roster: ROSTER, old: OLD });
  await page.evaluate(([roster, next]) => { window.Roster.setRoster(roster, next); window.Roster.syncRecords(roster, next); }, [ROSTER, NEW]);
  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 350);
  await page.selectOption('#roster-select', ROSTER); await page.click('#load-roster-btn'); await settle(page, 300);
  const st = await readState(page);
  same(Object.keys(st.roleHistory).sort(), [NEW[0], NEW[1]].sort(), 'a roster rename: the role history is under the new names');
  eq(st.roleHistory[NEW[0]].counts.Recorder, 2, '... with its counts');
  ok(!(OLD[0] in st.roleHistory), '... and nothing is left under the old name');
  await page.context().close();
}

/* ── 4. nothing new travels in the share link ─────────────────────────────── */
if (want('4')) {
  const p = await open({ seed: 30 });
  await roster(p, nameList(6), { mode: 'count', value: 2 });
  await p.check('#long-memory-check');
  await p.fill('#roles-input', ROLES.join('\n'));
  await makeFirst(p); await settle(p, 150);
  await p.click('#share-btn'); await settle(p, 200);
  const link = await p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
  ok(typeof link === 'string' && link.length > 20, 'the share sheet gives a link');
  const payload = await p.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('groups')), link);
  const asText = JSON.stringify(payload);
  ok(asText.indexOf('"members"') !== -1, 'the payload still carries the members of each group');
  ok(!/Recorder|Reporter|Timekeeper|Checker|role/i.test(asText), 'it names no role');
  ok(!/longMemory|rolesText|roleHistory|pairHistory|history/i.test(asText), 'no long-memory setting, role history or pairing memory');
  eq(Object.keys(payload).sort().join(), Object.keys(payload).sort().join(), 'its keys are unchanged');
  await p.context().close();
}

await browser.close();
server.close?.();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
