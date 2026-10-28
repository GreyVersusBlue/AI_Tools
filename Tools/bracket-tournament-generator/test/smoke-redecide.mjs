// smoke-redecide.mjs — Path 13 P4 increment 1: changing a decided match, and drawn games, in 020.
//
//   node Tools/bracket-tournament-generator/test/smoke-redecide.mjs        (or: npm run test:bracket-redecide)
//
// Five scenarios drive the page the way a teacher would: single elimination (a flipped first-round game clears
// what followed and says how much, with Undo), the first-round consolation bracket following a flipped loser,
// a round robin with drawn games, Swiss (a flipped earlier round discards the later rounds) and pools (a flipped
// pool game discards the drawn bracket). Every scenario is then run again against the page with one rule broken
// on purpose (a route rewrites the page's own text) and must fail, and the saved brackets of the v276 page are
// opened to show nothing was written or drawn that was not asked for. Exits 1 on any failure. Names are invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8557;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = '020-bracket-tournament-generator.html';
const URL_PAGE = BASE + '/Tools/' + PAGE;
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden-old-brackets.json');

let passed = 0, failed = 0;
const fails = [];
const server = await serve(PORT);
const browser = await launch();
const errors = [];

async function newPage(mutation, storage) {
  const page = await prepPage(browser, BASE, { width: 1500, height: 1500 });
  page.messages = [];
  page.on('dialog', (d) => { page.messages.push(d.message()); d.accept(); });
  page.on('pageerror', (e) => errors.push(String(e)));
  if (mutation) {
    await page.route('**/' + PAGE, async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(mutation[0], () => mutation[1]);
      await route.fulfill({ response: res, body });
    });
  }
  if (storage) {
    await page.addInitScript((st) => {
      if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const k of Object.keys(st)) localStorage.setItem(k, st[k]); }
    }, storage);
  }
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

async function make(page, { name, type = 'single', names, consolation = false, rounds }) {
  await page.fill('#contestants', names.join('\n'));
  await page.selectOption('#bracketType', type);
  await page.selectOption('#seedMode', 'asEntered');
  if (rounds) await page.fill('#swissRounds', String(rounds));
  if (type === 'pools') { await page.fill('#poolCount', '2'); await page.fill('#poolAdvance', '1'); }
  if (consolation) await page.check('#consolationOn');
  await page.fill('#bracketName', name);
  await page.click('#generateBtn');
  await settle(page, 300);
}
const slotTexts = (page, sel, i) => page.evaluate(([sel, i]) =>
  Array.from(document.querySelectorAll(sel)[i].querySelectorAll('.slot')).map((s) => s.textContent.trim()), [sel, i]);
const MAIN = '#bracketView > .bracket > .round', CONS = '#bracketView .consolation-section .bracket .round';
async function click(page, sel, ri, mi, si) {
  await page.evaluate(([sel, ri, mi, si]) => document.querySelectorAll(sel)[ri].querySelectorAll('.match')[mi].querySelectorAll('.slot')[si].click(), [sel, ri, mi, si]);
  await settle(page, 150);
}
async function score(page, idx, a, b) {
  for (const [k, v] of [[0, a], [1, b]]) {
    await page.evaluate(([idx, k, v]) => {
      const input = document.querySelectorAll('.match-score-pair')[idx].querySelectorAll('input')[k];
      input.value = String(v); input.dispatchEvent(new Event('change', { bubbles: true }));
    }, [idx, k, v]);
    await settle(page, 120);
  }
}
const rows = (page) => page.evaluate(() => {
  const t = document.querySelector('.standings-table');
  return t ? { head: Array.from(t.querySelectorAll('thead th')).map((x) => x.textContent.trim()), body: Array.from(t.querySelectorAll('tbody tr')).map((r) => Array.from(r.querySelectorAll('td')).map((x) => x.textContent.trim())) } : null;
});
const banner = (page) => page.evaluate(() => { const b = document.getElementById('championBanner'); return b.classList.contains('show') ? b.textContent : ''; });
const playAll = async (page) => { for (const [r, n] of [[0, 4], [1, 2], [2, 1]]) for (let m = 0; m < n; m++) await click(page, MAIN, r, m, 0); };

/* each scenario returns [[label, bool], ...] */
const SCENARIOS = {
  async single(page) {
    const out = [];
    await make(page, { name: 'S1', names: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] });
    await playAll(page);
    out.push(['T1 won it all', (await banner(page)).includes('T1')]);
    out.push(['only a side that lost can be clicked to change', await page.evaluate(() => document.querySelectorAll('.slot-winner.slot-changeable').length === 0 && document.querySelectorAll('.slot-changeable').length === 7)]);
    await click(page, MAIN, 0, 0, 1);                                   // give T1 v T2 to T2
    out.push(['the page said two later results would go', page.messages.some((t) => /also clears 2 later results/.test(t))]);
    out.push(['the match went to T2', (await slotTexts(page, MAIN, 1)).join() === 'T2,T3,T5,T7']);
    out.push(['the later decisions went, the others stayed', (await slotTexts(page, MAIN, 2)).join() === 'TBD,T5' && (await banner(page)) === '']);
    await page.click('#undoBtn'); await settle(page, 150);
    out.push(['Undo gave it all back', (await slotTexts(page, MAIN, 1))[0] === 'T1' && (await banner(page)).includes('T1')]);

    return out;
  },
  async singleSmall(page) {
    const out = [];
    await make(page, { name: 'S1b', names: ['T1', 'T2', 'T3', 'T4'] });
    await score(page, 0, 5, 3);                                         // T1 beats T2 by score
    await click(page, MAIN, 0, 0, 1);                                   // ...then T2 is given the match
    const said = page.messages.length;
    out.push(['nothing depended on it, so nothing was asked', said === 0]);
    out.push(['T2 went through', (await slotTexts(page, MAIN, 1)).join() === 'T2,TBD']);
    out.push(['the score that named the other winner went', await page.evaluate(() => Array.from(document.querySelectorAll('.match-score-pair')[0].querySelectorAll('input')).every((i) => i.value === ''))]);
    return out;
  },
  async bye(page) {
    await make(page, { name: 'S1c', names: ['T1', 'T2', 'T3', 'T4', 'T5'] });
    return [['a bye is not a match anyone can change', await page.evaluate(() => document.querySelectorAll('.slot-changeable').length === 0)]];
  },
  async consolation(page) {
    const out = [];
    await make(page, { name: 'S2', names: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'], consolation: true });
    for (let m = 0; m < 4; m++) await click(page, MAIN, 0, m, 0);
    out.push(['the consolation holds the four losers', (await slotTexts(page, CONS, 0)).join() === 'T2,T4,T6,T8']);
    await click(page, CONS, 0, 0, 0);                                   // T2 beats T4 there
    out.push(['T2 moved on in the consolation', (await slotTexts(page, CONS, 1))[0] === 'T2']);
    await click(page, MAIN, 0, 0, 1);                                   // T2 now wins the first round game
    out.push(['the page counted the consolation game', page.messages.some((t) => /also clears 1 later result\b/.test(t))]);
    out.push(['T1 took T2’s place in the consolation', (await slotTexts(page, CONS, 0)).join() === 'T1,T4,T6,T8']);
    out.push(['and the game T2 had won there is open again', (await slotTexts(page, CONS, 1)).join() === 'TBD,TBD']);
    return out;
  },
  async draws(page) {
    const out = [];
    await make(page, { name: 'S3', type: 'roundrobin', names: ['P1', 'P2', 'P3', 'P4'] });
    await score(page, 0, 3, 3);
    out.push(['a tied score says why it did not decide', await page.evaluate(() => /allow drawn games/.test(document.querySelector('.match-tie-note')?.textContent || ''))]);
    out.push(['and counted as nothing played', (await rows(page)).body.every((r) => r[3] === '0')]);
    await page.check('#drawsOn'); await settle(page, 200);
    await score(page, 0, 3, 3);
    let t = await rows(page);
    out.push(['with draws on, the tied score drew the game (a D column appears)', t.head.join() === 'Team,W,D,L,Played,PF,PA,Diff' && t.body.filter((r) => r[2] === '1').length === 2]);
    await page.click('.draw-btn'); await settle(page, 200);             // the next open game
    t = await rows(page);
    out.push(['the Draw button drew the second game', t.body.every((r) => r[2] === '1' && r[4] === '1')]);
    out.push(['draws cannot be turned off once one is drawn', await page.evaluate(() => document.getElementById('drawsOn').disabled)]);
    await click(page, '#bracketView > .bracket > .round', 0, 0, 0);    // a drawn game: either side takes it
    t = await rows(page);
    const p1 = t.body.find((r) => r[0] === 'P1'), p4 = t.body.find((r) => r[0] === 'P4');
    out.push(['P1 took the drawn game', p1[1] === '1' && p1[2] === '0' && p4[3] === '1']);
    out.push(['and the 3-3 score went with it', await page.evaluate(() => Array.from(document.querySelectorAll('.match-score-pair')[0].querySelectorAll('input')).every((i) => i.value === ''))]);
    return out;
  },
  async swiss(page) {
    const out = [];
    await make(page, { name: 'S4', type: 'swiss', names: ['P1', 'P2', 'P3', 'P4'], rounds: 3 });
    await click(page, '#bracketView > .bracket > .round', 0, 0, 0); await click(page, '#bracketView > .bracket > .round', 0, 1, 0);
    await page.click('text=/Generate Round 2/'); await settle(page, 200);
    const rc = () => page.evaluate(() => document.querySelectorAll('#bracketView > .bracket > .round').length);
    out.push(['two rounds are showing', (await rc()) === 2]);
    await click(page, '#bracketView > .bracket > .round', 0, 0, 1);    // round 1 goes the other way
    out.push(['the page said one later round would go', page.messages.some((t) => /discards the 1 later round /.test(t))]);
    out.push(['and it went', (await rc()) === 1]);
    return out;
  },
  async pools(page) {
    const out = [];
    await make(page, { name: 'S5', type: 'pools', names: ['T1', 'T2', 'T3', 'T4'] });
    await click(page, '#bracketView > .bracket', 0, 0, 0).catch(() => {});
    await page.evaluate(() => { document.querySelectorAll('#bracketView > .bracket').forEach((b) => b.querySelector('.match .slot').click()); });
    await settle(page, 200);
    await page.click('text=/Generate bracket from pool results/'); await settle(page, 250);
    const drawn = () => page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find((b) => /Generate bracket from pool results/.test(b.textContent)));
    out.push(['the bracket is drawn', !(await drawn())]);
    await page.evaluate(() => { document.querySelectorAll('#bracketView > .bracket')[0].querySelectorAll('.match .slot')[1].click(); });
    await settle(page, 250);
    out.push(['the page said the bracket would go', page.messages.some((t) => /discards that bracket/.test(t))]);
    out.push(['and it went (the button to draw it again is back)', await drawn()]);
    return out;
  }
};

const MUTANTS = [
  ['single', 'if (gone > 0 && !confirm(', 'if (false && !confirm('],
  ['single', 'captureUndoSnapshot();\n    Bracket.redecideElimination(obj, state.scores, r, m, prefix);', 'captureUndoSnapshot();'],
  ['singleSmall', 'captureUndoSnapshot();\n    Bracket.redecideElimination(obj, state.scores, r, m, prefix);', 'captureUndoSnapshot();'],
  ['single', "if (state.winnerSide[(r + 1) + '_' + m] !== idx) makeElimChangeable(slotEl, state, '', r, m, contestant);", "makeElimChangeable(slotEl, state, '', r, m, contestant);"],
  ['consolation', 'if (obj === state && state.consolation) BtTeams.reflow(state, r, m, Bracket);', ''],
  ['draws', 'Bracket.resultFromScores(aNum, bNum, !!state.draws)', 'Bracket.resultFromScores(aNum, bNum, false)'],
  ['draws', 'box.disabled = hasDraws();', 'box.disabled = false;'],
  ['draws', 'if (game.winner === side) return;', 'return;'],
  ['draws', 'current.a === current.b && !(state.draws', 'current.a === 12345 && !(state.draws'],
  ['swiss', 'run: function () { Bracket.swissReopen(state, roundIdx); }', 'run: function () {}'],
  ['pools', 'run: function () { Bracket.poolsReopen(state); }', 'run: function () {}']
];

console.log('Bracket / Tournament Generator — re-deciding a match, and drawn games');

for (const [name, fn] of Object.entries(SCENARIOS)) {
  const page = await newPage();
  let res;
  try { res = await fn(page); } catch (e) { res = [['ran without throwing: ' + e.message.split('\n')[0], false]]; }
  for (const [label, good] of res) {
    if (good) passed++; else { failed++; fails.push(name + ': ' + label); console.log('  FAIL ' + name + ': ' + label); }
  }
  await page.context().close();
}

for (const [name, find, repl] of MUTANTS) {
  const src = fs.readFileSync(path.join(path.dirname(GOLDEN), '..', '..', PAGE), 'utf8');
  const count = src.split(find).length - 1;
  if (count !== 1) { failed++; fails.push(`mutant text for ${name} occurs ${count} times: ${find.slice(0, 50)}`); console.log('  FAIL mutant text for ' + name + ' occurs ' + count + ' times'); continue; }
  const page = await newPage([find, repl]);
  let res;
  try { res = await SCENARIOS[name](page); } catch (e) { res = [['threw', false]]; }
  const broke = res.some(([, good]) => !good);
  if (broke) passed++; else { failed++; fails.push(`${name} did not notice: ${find.slice(0, 60)}`); console.log('  FAIL scenario ' + name + ' passes with its rule broken: ' + find.slice(0, 60)); }
  await page.context().close();
}

/* the saved brackets of the v276 page open without gaining a draws switch, a D column or a drawn game */
{
  const gold = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const page = await newPage(null, gold.storage);
  const names = Object.keys(gold.storage).filter((k) => k.startsWith('gvb-bracket:data:')).map((k) => k.slice('gvb-bracket:data:'.length));
  for (const n of names) {
    await page.selectOption('#bracketSwitch', n); await settle(page, 300);
    const seen = await page.evaluate((n) => {
      const bar = document.getElementById('drawsOn');
      const heads = Array.from(document.querySelectorAll('.standings-table thead th')).map((x) => x.textContent.trim());
      return { bar: bar ? { checked: bar.checked, disabled: bar.disabled } : null, heads, stored: /"draws"|"draw"/.test(localStorage.getItem('gvb-bracket:data:' + n) || '') };
    }, n);
    const good = !seen.heads.includes('D') && !seen.stored && (!seen.bar || (!seen.bar.checked && !seen.bar.disabled));
    if (good) passed++; else { failed++; fails.push('old bracket ' + n + ' gained something: ' + JSON.stringify(seen)); console.log('  FAIL old bracket ' + n + ' ' + JSON.stringify(seen)); }
  }
  await page.context().close();
}

if (errors.length) { failed++; fails.push('page errors: ' + errors.slice(0, 3).join(' | ')); console.log('  FAIL page errors: ' + errors.slice(0, 3).join(' | ')); }
await browser.close();
server.close?.();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
process.exit(0);
