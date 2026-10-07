// smoke-teams.mjs — 020 Bracket / Tournament Generator: teams with members,
// and the first-round consolation bracket, on the real page.
//
//   node Tools/bracket-tournament-generator/test/smoke-teams.mjs   (npm run test:bracket-teams, port 8521)
//
// What's worth holding still:
//   1. nothing changes for a bracket that uses neither: no new field is
//      written, the setup's new controls start off, and the consolation
//      choice appears for single elimination only;
//   2. teams: a team shows by its name, its members are in the tooltip, in a
//      spoken label, on a visible line when it is focused or pointed at, and
//      in a team list that prints; an entrant with no members is untouched;
//      the members are saved, survive a reload, travel in a share link and are
//      cleaned when a link brings them;
//   3. the consolation bracket for every entrant count from 3 to 32, played
//      through the page's own clicks: the first-round losers, each exactly
//      once, in their games' order, nobody who had a bye, L - 1 games,
//      third place and the consolation winner named;
//   4. results entered by score count the same as a click, undo and Reset
//      work, a saved bracket and a link come back whole, a bad one is rebuilt;
//   5. it prints on a page of its own after the main bracket (read off
//      Chromium's PDF), and the blank print shows it empty;
//   6. the new controls are clean under axe and work from the keyboard.
// The rules (pairing, byes, third place) are in smoke-teams-core.mjs (pure
// Node). Every team and member here is made up.
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8521;
const BASE = `http://127.0.0.1:${PORT}`;
// SEED_020 names another copy of the page in Tools/ (a deliberately broken one).
const URL_020 = BASE + '/Tools/' + (process.env.SEED_020 || '020-bracket-tournament-generator.html');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-teams-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const server = await serve(PORT);
const browser = await launch();
const errors = [];

async function newPage(size = { width: 1300, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => errors.push(e.stack || String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
      window.__printedCard = document.getElementById('bracketCard').innerHTML;
    };
  });
  return page;
}
const open = async (page, url = URL_020) => { await page.goto(url, { waitUntil: 'load' }); await settle(page, 400); };
async function build(page, { name, text, type = 'single', seed = 'asEntered', teams = false, consolation = false }) {
  if (await page.isVisible('#newBracketBtn')) { await page.click('#newBracketBtn'); await settle(page, 150); }
  await page.fill('#bracketName', name);
  await page.fill('#contestants', text);
  await page.selectOption('#bracketType', type);
  await page.selectOption('#seedMode', seed);
  await page.setChecked('#teamMode', teams);
  if (type === 'single') await page.setChecked('#consolationOn', consolation);
  await page.click('#generateBtn');
  await settle(page, 300);
}
const saved = (page, name) => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-bracket:data:' + n)), name);
const shareLink = async page => {
  await page.click('#shareBtn');
  await settle(page, 250);
  return page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 80));
  });
};
const slotTexts = (page, scope) => page.$$eval(scope + ' .slot', els => els.map(e => e.textContent));
/* One click of a match in a scope whose two sides are both real teams. Returns
   the two names and the one that won, or null when no such match is left. */
const playOne = (page, scope, side) => page.evaluate(({ scope, side }) => {
  const root = document.querySelector(scope);
  if (!root) return null;
  for (const m of root.querySelectorAll('.match')) {
    const s = Array.from(m.children).filter(c => c.classList.contains('slot'));
    if (s.length === 2 && s.every(x => x.className === 'slot')) {
      const names = s.map(x => x.textContent);
      s[side].click();
      return { names, winner: names[side] };
    }
  }
  return null;
}, { scope, side });

console.log('Bracket / Tournament Generator — teams with members and the first-round consolation bracket');

/* ── 1. a bracket that uses neither ─────────────────────────────────────── */
{
  const page = await newPage();
  await open(page);
  eq(await page.isChecked('#teamMode'), false, 'the teams box starts off');
  eq(await page.isChecked('#consolationOn'), false, 'the consolation box starts off');
  eq(await page.isVisible('#consolationFields'), true, 'the consolation choice is there for single elimination');
  for (const t of ['double', 'roundrobin', 'pools', 'swiss']) {
    await page.selectOption('#bracketType', t);
    eq(await page.isVisible('#consolationFields'), false, `and not for ${t}`);
  }
  await page.selectOption('#bracketType', 'single');
  await build(page, { name: 'Plain', text: 'Ann, Bo, Cy, Di, Ed' });
  const st = await saved(page, 'Plain');
  eq(Object.keys(st).sort(), ['name', 'scores', 'seedMode', 'slots', 'winnerSide'], 'a plain bracket stores the fields it always stored');
  eq(await page.$('.consolation-section'), null, 'and shows no consolation section');
  eq(await page.$('#teamList'), null, 'nor a team list');
  eq(await page.$('.slot[data-team]'), null, 'nor any team decoration');
  eq(await page.$('#teamInfo'), null, 'nor the empty info line');
  eq(await page.textContent('#placesNote'), '', 'nor an announcement');
  // with team mode off, "Name: a, b" is three entrants, as before
  await build(page, { name: 'Literal', text: 'Red: Ann, Bo' });
  eq((await saved(page, 'Literal')).slots[0].filter(Boolean), ['Red: Ann', 'Bo'], 'with the teams box off a colon is just text and commas split, as before');
  eq((await saved(page, 'Literal')).members, undefined, 'and nothing is stored about members');
  // consolation ticked but under 3 entrants: ignored
  await build(page, { name: 'Two', text: 'Ann, Bo', consolation: true });
  eq((await saved(page, 'Two')).consolation, undefined, 'a consolation bracket is not made for 2 entrants');
  // consolation ticked and then another type picked: ignored
  await page.click('#newBracketBtn'); await settle(page, 100);
  await page.fill('#bracketName', 'Dbl'); await page.fill('#contestants', 'A\nB\nC\nD');
  await page.setChecked('#consolationOn', true);
  await page.selectOption('#bracketType', 'double');
  await page.click('#generateBtn'); await settle(page, 300);
  eq((await saved(page, 'Dbl')).consolation, undefined, 'and not for double elimination, even if the box was left ticked');
  await page.context().close();
}

/* ── 2. teams with members ──────────────────────────────────────────────── */
console.log('020 — teams with members');
const TEAM_TEXT = [
  'Red Foxes: Ann Lee, Bo Chan, Cy Dunn',
  'Blue Jays: Di Ray; Ed Fox',
  'Green Owls',
  'Gold Bees: Fay Gale, <b>Gus</b> Hale',
].join('\n');
{
  const page = await newPage();
  await open(page);
  await build(page, { name: 'Teams', text: TEAM_TEXT, teams: true });
  const st = await saved(page, 'Teams');
  eq(st.members, { 'Red Foxes': ['Ann Lee', 'Bo Chan', 'Cy Dunn'], 'Blue Jays': ['Di Ray', 'Ed Fox'], 'Gold Bees': ['Fay Gale', '<b>Gus</b> Hale'] }, 'the members are stored on the bracket, only for teams that have some');
  eq(st.slots[0].filter(Boolean).sort(), ['Blue Jays', 'Gold Bees', 'Green Owls', 'Red Foxes'], 'the entrants are the team names, no members in them');
  const slots = await page.$$eval('#bracketView .bracket .slot', els => els.map(e => ({ t: e.textContent, title: e.title, tab: e.getAttribute('tabindex'), label: e.getAttribute('aria-label'), role: e.getAttribute('role') })));
  const fox = slots.find(s => s.t === 'Red Foxes');
  eq(fox.title, 'Members: Ann Lee, Bo Chan, Cy Dunn', 'a team slot has its members in the tooltip');
  eq(fox.label, 'Red Foxes, members: Ann Lee, Bo Chan, Cy Dunn', 'and in its spoken label');
  eq([fox.tab, fox.role], ['0', 'button'], 'it can be reached by Tab and is a button while it can be picked');
  const owl = slots.find(s => s.t === 'Green Owls');
  eq([owl.title, owl.tab, owl.label, owl.role], ['', null, null, null], 'a team with no members is exactly today\'s slot');
  ok(slots.filter(s => s.t === 'TBD' || s.t === 'BYE').every(s => s.tab === null && s.title === ''), 'and so are TBD and BYE slots');
  const listed = await page.$$eval('#teamList li', l => l.map(x => x.textContent));
  eq(listed.length, 3, 'three lines: the team with no members is not listed');
  ok(listed.includes('Gold Bees: Fay Gale, <b>Gus</b> Hale'), 'markup in a member is shown as text');
  eq(await page.$$eval('#teamList b, #bracketView .slot b', b => b.length), 0, 'and is never markup');
  eq(await page.evaluate(() => document.getElementById('teamList').parentNode.id), 'bracketView', 'the list is in the bracket view, after the bracket');
  eq(await page.evaluate(() => document.querySelector('#bracketView > .bracket').compareDocumentPosition(document.getElementById('teamList')) & 4), 4, 'and follows it');

  // the visible line: focus and hover
  eq(await page.isVisible('#teamInfo'), true, 'the info line is on the page for a bracket with teams');
  await page.focus('.slot[data-team]');
  const firstFocused = await page.evaluate(() => document.activeElement.textContent);
  ok((await page.textContent('#teamInfo')).startsWith(firstFocused + ': '), 'focusing a team shows who is in it on the page');
  await page.keyboard.press('Escape');
  eq(await page.textContent('#teamInfo'), '', 'Escape puts it away');
  await page.hover('.slot[data-team]');
  ok((await page.textContent('#teamInfo')).includes(': '), 'pointing at a team shows it too');
  await page.mouse.move(5, 5);
  eq(await page.textContent('#teamInfo'), '', 'and moving off puts it away');
  eq(await page.getAttribute('#teamInfo', 'aria-hidden'), 'true', 'the line is for the eye: the spoken label already says it');

  // keyboard: Enter and Space pick the focused team
  await page.focus('.slot[data-team][role="button"]');
  const pickedBy = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('Enter');
  await settle(page, 200);
  const afterEnter = await saved(page, 'Teams');
  ok(afterEnter.slots[1].includes(pickedBy), 'Enter on a focused team advances it');
  const before = JSON.stringify((await saved(page, 'Teams')).slots);
  await page.focus('.slot[data-team][role="button"]');
  const pickedBy2 = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('Space');
  await settle(page, 200);
  ok(JSON.stringify((await saved(page, 'Teams')).slots) !== before && pickedBy2.length > 0, 'and so does Space');
  ok(await page.$('.slot-winner[role="group"][aria-label]') !== null, 'a team already through is a labelled group, not a button');
  eq(await page.$$eval('.slot-decided[role="button"], .slot-winner[role="button"]', e => e.length), 0, 'a decided slot is never a button');

  // reload keeps them
  await page.reload({ waitUntil: 'load' }); await settle(page, 400);
  eq(await page.$$eval('#teamList li', l => l.length), 3, 'a reload keeps the members');
  eq((await saved(page, 'Teams')).members['Red Foxes'].length, 3, 'in the same key');

  // printing: the list is on the sheet, the info line is not
  await page.click('#printBtn'); await settle(page, 100);
  ok((await page.evaluate(() => window.__printedCard)).includes('id="teamList"'), 'the printed sheet carries the team list');
  await page.setChecked('#printBlank', true);
  await page.click('#printBtn'); await settle(page, 100);
  ok((await page.evaluate(() => window.__printedCard)).includes('id="teamList"'), 'and so does a blank sheet');
  await page.setChecked('#printBlank', false);
  await page.emulateMedia({ media: 'print' });
  eq(await page.isVisible('#teamInfo'), false, 'the info line does not print');
  eq(await page.isVisible('#teamList'), true, 'the list does');
  await page.emulateMedia({ media: 'screen' });

  // Reset picks keeps the teams and their members
  await page.click('#resetPicksBtn'); await settle(page, 300);
  eq((await saved(page, 'Teams')).members, st.members, 'Reset picks keeps the members');
  eq(await page.$$eval('#teamList li', l => l.length), 3, 'and the team list');

  // a round robin shows them too
  await build(page, { name: 'RR Teams', text: TEAM_TEXT, type: 'roundrobin', teams: true });
  ok(await page.$('.slot[data-team]') !== null, 'a round robin shows its teams\' members too');
  eq(await page.$$eval('#teamList li', l => l.length), 3, 'with the same list');

  // share: the link carries them; the other browser gets them; garbage is cleaned
  await page.selectOption('#bracketSwitch', 'Teams'); await settle(page, 300);
  const url = await shareLink(page);
  const other = await newPage();
  await open(other, url);
  const got = await saved(other, 'Teams');
  eq(got && got.members, st.members, 'a share link carries the members, and they arrive');
  eq(await other.$$eval('#teamList li', l => l.length), 3, 'and show');
  await page.click('#shareBtn'); await settle(page, 250);
  ok(/team members/.test(await page.evaluate(() => document.querySelector('.share-sheet').textContent)), 'the share sheet says team members travel');
  await page.evaluate(() => window.Share.close());
  const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('bracket')), url);
  const dirty = JSON.parse(JSON.stringify(payload));
  dirty.name = 'Dirty';
  dirty.members = { 'Red Foxes': ['ok', 7, null, { a: 1 }, 'ok', 'x'.repeat(500)], 'Nobody': ['ghost'], 'Blue Jays': 'not a list', constructor: ['c'] };
  const dirtyUrl = await page.evaluate(({ d }) => location.origin + location.pathname + '?bracket=' + window.StateLink.encodeState(d), { d: dirty });
  const third = await newPage();
  await open(third, dirtyUrl);
  const clean = await saved(third, 'Dirty');
  eq(Object.keys(clean.members), ['Red Foxes'], 'a link\'s members are kept for teams that are in the bracket, and only those');
  eq(clean.members['Red Foxes'].length, 2, 'strings only, no repeats');
  ok(clean.members['Red Foxes'].every(m => m.length <= 60), 'and cut to length');
  const hostile = JSON.parse(JSON.stringify(payload));
  hostile.name = 'Hostile'; hostile.members = ['not', 'a', 'map'];
  const hostileUrl = await page.evaluate(({ d }) => location.origin + location.pathname + '?bracket=' + window.StateLink.encodeState(d), { d: hostile });
  const fourth = await newPage();
  await open(fourth, hostileUrl);
  eq((await saved(fourth, 'Hostile')).members, undefined, 'a members field of the wrong kind is dropped');
  for (const p of [other, third, fourth]) await p.context().close();
  await page.context().close();
}

/* ── 3. the consolation bracket, every size from 3 to 32 ────────────────── */
console.log('020 — the first-round consolation bracket, 3 to 32 entrants');
{
  const page = await newPage();
  await open(page);
  for (let n = 3; n <= 32; n++) {
    const mode = n % 2 ? 'asEntered' : 'ranked';
    const names = Array.from({ length: n }, (_, i) => 'Crew ' + String.fromCharCode(65 + (i % 26)) + (i < 26 ? '' : '2'));
    const rand = rng(n * 17);
    const tag = `n=${n} ${mode}`;
    await build(page, { name: 'C' + n, text: names.join('\n'), seed: mode, consolation: true });
    const size = (() => { let p = 1; while (p < n) p *= 2; return Math.max(p, 2); })();
    const L = n - size / 2;
    ok(await page.$('.consolation-section') !== null, `${tag}: there is a consolation section`);
    // main round 0 as drawn
    const r0 = await page.$$eval('#bracketView > .bracket > .round:first-child .slot', els => els.map(e => e.textContent));
    const hadBye = [];
    const realPairs = [];
    for (let i = 0; i < r0.length; i += 2) {
      if (r0[i] === 'BYE') hadBye.push(r0[i + 1]); else if (r0[i + 1] === 'BYE') hadBye.push(r0[i]); else realPairs.push([r0[i], r0[i + 1]]);
    }
    eq(realPairs.length, L, `${tag}: ${L} first-round games on the page`);
    // before any result: round 1 of the consolation is all TBD / BYE
    const before = await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child');
    ok(before.every(t => t === 'TBD' || t === 'BYE'), `${tag}: nothing is in the consolation before a game is played`);
    eq(before.length, (() => { let p = 1; while (p < L) p *= 2; return Math.max(p, 2); })(), `${tag}: its first round has the right number of slots`);
    // play the first-round games in the main bracket, one at a time
    const losers = [];
    for (let g = 0; g < L; g++) {
      const side = rand() < 0.5 ? 0 : 1;
      const res = await page.evaluate(({ side }) => {
        const col = document.querySelector('#bracketView > .bracket > .round:first-child');
        for (const m of col.querySelectorAll('.match')) {
          const s = Array.from(m.children).filter(c => c.classList.contains('slot'));
          if (s.length === 2 && s.every(x => x.className === 'slot')) { const names = s.map(x => x.textContent); s[side].click(); return names; }
        }
        return null;
      }, { side });
      ok(res !== null, `${tag}: a first-round game was there to play`);
      if (!res) break;
      losers.push(res[1 - side]);
      const inCons = (await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child')).filter(t => t !== 'TBD' && t !== 'BYE');
      eq(inCons.length, losers.length, `${tag}: after game ${g + 1} that loser, and no one else, has joined the consolation`);
    }
    const inCons = (await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child')).filter(t => t !== 'TBD' && t !== 'BYE');
    eq([...inCons].sort(), [...losers].sort(), `${tag}: the consolation's first round is exactly the first-round losers`);
    eq(new Set(inCons).size, inCons.length, `${tag}: each once`);
    ok(inCons.every(x => !hadBye.includes(x)), `${tag}: nobody who had a bye is in it`);
    // play the whole consolation
    let games = 0, self = false;
    for (let g = 0; g < 40; g++) {
      const res = await playOne(page, '.consolation-section .bracket:first-of-type', rand() < 0.5 ? 0 : 1);
      if (!res) break;
      games++;
      if (res.names[0] === res.names[1]) self = true;
    }
    eq(games, L - 1, `${tag}: ${L - 1} consolation games`);
    ok(!self, `${tag}: nobody plays themselves`);
    const consWinner = await slotTexts(page, '.consolation-section .bracket:first-of-type .round:last-child');
    ok(consWinner.length === 1 && losers.includes(consWinner[0]), `${tag}: the consolation winner is one of the losers`);
    // finish the main bracket, semifinal losers recorded from the page
    let semiLosers = [];
    for (let g = 0; g < 40; g++) {
      const res = await playOne(page, '#bracketView > .bracket', rand() < 0.5 ? 0 : 1);
      if (!res) break;
    }
    const sections = await page.$$eval('.consolation-section .round-label', e => e.map(x => x.textContent));
    const thirdShown = n > 3;
    eq(sections.includes('Third place'), thirdShown, `${tag}: a third-place game ${thirdShown ? 'is' : 'is not'} drawn`);
    if (thirdShown) {
      const tpSide = rand() < 0.5 ? 0 : 1;
      const tp = await playOne(page, '.consolation-section .bracket + .bracket', tpSide);
      ok(tp && tp.names[0] !== tp.names[1], `${tag}: the third-place game was played`);
      semiLosers = tp ? tp.names : [];
      eq((await page.textContent('.cons-places')).startsWith('Third place: ' + tp.winner + '.'), true, `${tag}: third place is the team that won the third-place game`);
    }
    const line = await page.textContent('.cons-places');
    ok(/^Third place: .+\. Consolation winner: .+\.$/.test(line) && !/not decided/.test(line), `${tag}: both places are named (${line})`);
    if (thirdShown) ok(semiLosers.some(s => line.includes('Third place: ' + s + '.')), `${tag}: third place is one of the semifinal losers`);
    ok(line.includes('Consolation winner: ' + consWinner[0] + '.'), `${tag}: the consolation winner named is the one in the bracket`);
    eq(await page.textContent('#placesNote'), line, `${tag}: the same words are announced`);
    if (n === 3) {
      ok(/no third-place game/i.test(await page.textContent('.consolation-section')), `${tag}: it says there is no third-place game`);
      ok(/no consolation game/.test(await page.textContent('.consolation-section')), `${tag}: and no consolation game`);
    }
  }
  await page.context().close();
}

/* ── 4. scores, undo, reset, saving and sharing ─────────────────────────── */
console.log('020 — the consolation bracket by score, undo, reset, reload, share');
{
  const page = await newPage();
  await open(page);
  const names = ['Ant', 'Bat', 'Cod', 'Dog', 'Elk', 'Fox'];
  await build(page, { name: 'Six', text: names.join('\n'), consolation: true });
  // 6 entrants, size 8: 2 byes, 2 first-round games: (Cod v Dog) and (Elk v Fox)
  eq(await slotTexts(page, '#bracketView > .bracket > .round:first-child'), ['Ant', 'BYE', 'Bat', 'BYE', 'Cod', 'Dog', 'Elk', 'Fox'], 'six entrants as entered: two byes, then two games');
  const score = async (scope, idx, a, b) => {
    await page.evaluate(({ scope, idx, a, b }) => {
      const pair = document.querySelectorAll(scope + ' .match-score-pair')[idx];
      const ins = pair.querySelectorAll('input');
      ins[0].value = String(a); ins[1].value = String(b);
      ins[1].dispatchEvent(new Event('change', { bubbles: true }));
    }, { scope, idx, a, b });
    await settle(page, 150);
  };
  await score('#bracketView > .bracket', 0, 3, 1);   // the first score box on the main bracket is Cod v Dog
  eq(await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child'), ['Dog', 'TBD'], 'a score decides a first-round game and sends the loser to the consolation, in game order');
  await score('#bracketView > .bracket', 1, 0, 2);
  eq(await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child'), ['Dog', 'Elk'], 'the second game\'s loser takes the next place');
  // L = 2: size 2... the two losers meet in one game: a score decides it
  await score('.consolation-section .bracket:first-of-type', 0, 5, 9);
  eq(await page.textContent('.cons-places'), 'Third place: not decided yet. Consolation winner: Elk.', 'a consolation score names the winner');
  // undo reverts the last pick, consolation or not
  ok(await page.isVisible('#undoBtn'), 'Undo is offered');
  await page.click('#undoBtn'); await settle(page, 150);
  ok(/Consolation winner: not decided yet/.test(await page.textContent('.cons-places')), 'Undo takes back a consolation result');
  // reload keeps everything
  await page.reload({ waitUntil: 'load' }); await settle(page, 400);
  eq(await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child'), ['Dog', 'Elk'], 'a reload keeps the consolation');
  const st = await saved(page, 'Six');
  eq(Object.keys(st.consolation).sort(), ['slots', 'third', 'winnerSide'], 'it is stored in the same key as three fields');
  // share
  const url = await shareLink(page);
  const other = await newPage();
  await open(other, url);
  eq((await saved(other, 'Six')).consolation, st.consolation, 'a share link carries the consolation bracket whole');
  ok(/Consolation bracket/.test(await other.textContent('#bracketView')), 'and it shows there');
  // a link whose consolation is nonsense gets a rebuilt one
  const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('bracket')), url);
  const bad = JSON.parse(JSON.stringify(payload)); bad.name = 'Bad'; bad.consolation = { slots: [[1, 2], 'x'], third: 'z', winnerSide: { evil: 1 } };
  const badUrl = await page.evaluate(({ d }) => location.origin + location.pathname + '?bracket=' + window.StateLink.encodeState(d), { d: bad });
  const third = await newPage();
  await open(third, badUrl);
  const rebuilt = (await saved(third, 'Bad')).consolation;
  eq([rebuilt.third, rebuilt.winnerSide], [null, {}], 'a nonsense consolation in a link is replaced by an empty one');
  eq(rebuilt.slots[0].length, 2, 'of the right shape');
  eq(await slotTexts(third, '.consolation-section .bracket:first-of-type .round:first-child'), ['Dog', 'Elk'], 'which fills from the bracket\'s own results');
  // a consolation on a link for a bracket that cannot have one is dropped
  await build(page, { name: 'DblSrc', text: 'A\nB\nC\nD', type: 'double' });
  const dblUrl = await page.evaluate(({ c }) => {
    const d = JSON.parse(localStorage.getItem('gvb-bracket:data:DblSrc'));
    d.name = 'Dbl'; d.consolation = c;
    return location.origin + location.pathname + '?bracket=' + window.StateLink.encodeState(d);
  }, { c: payload.consolation });
  const fourth = await newPage();
  await open(fourth, dblUrl);
  eq((await saved(fourth, 'Dbl')) && (await saved(fourth, 'Dbl')).consolation, undefined, 'a double-elimination link\'s consolation field is not kept');
  // a hand-broken saved bracket is rebuilt on load
  await page.selectOption('#bracketSwitch', 'Six'); await settle(page, 300);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gvb-bracket:data:Six'));
    s.consolation = { slots: 'broken' }; s.members = 'broken';
    localStorage.setItem('gvb-bracket:data:Six', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' }); await settle(page, 400);
  eq(await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child'), ['Dog', 'Elk'], 'a broken consolation in storage is rebuilt from the results');
  eq((await saved(page, 'Six')).members, undefined, 'and a broken members field is dropped');
  // reset picks: the consolation stays on and empties
  await page.click('#resetPicksBtn'); await settle(page, 300);
  ok(await page.$('.consolation-section') !== null, 'Reset keeps the consolation bracket');
  ok((await slotTexts(page, '.consolation-section .bracket:first-of-type .round:first-child')).every(t => t === 'TBD' || t === 'BYE'), 'and empties it');
  eq((await saved(page, 'Six')).scores, {}, 'with the scores cleared');
  for (const p of [other, third, fourth]) await p.context().close();
  await page.context().close();
}

/* ── 5. teams and the consolation together; the academic mode leaves it alone ── */
console.log('020 — teams in the consolation; the academic mode');
{
  const page = await newPage();
  await open(page);
  await build(page, { name: 'Both', text: TEAM_TEXT + '\nPurple Elks: Gil Ives, Hal Jay\nPink Cats: Kim Lo\nGrey Wolves: Ivy Kent\nTan Hens: Jo Lamb', teams: true, consolation: true });
  for (let g = 0; g < 4; g++) await playOne(page, '#bracketView > .bracket > .round:first-child', 0);
  ok(await page.$('.consolation-section .slot[data-team]') !== null, 'a team that lands in the consolation bracket keeps its members there');
  await page.setChecked('#acOn', true);
  await page.selectOption('#acSource', { index: 1 });               // a built-in set, so there are questions to deal
  await settle(page, 300);
  ok(await page.$$eval('#bracketView > .bracket .match-q-btn', b => b.length) > 0, 'with the academic mode on, a ready match in the main bracket has a Questions button');
  ok(await page.$$eval('.consolation-section .slot', s => s.filter(x => x.className === 'slot').length) >= 2, 'while two consolation games are ready to play');
  const qButtons = await page.$$eval('.consolation-section .match-q-btn', b => b.length);
  eq(qButtons, 0, 'the academic mode offers no Questions button on consolation games');
  await page.context().close();
}

/* ── 6. print ───────────────────────────────────────────────────────────── */
console.log('020 — printing');
{
  const page = await newPage();
  await open(page);
  await build(page, { name: 'Print', text: TEAM_TEXT + '\nPurple Elks: Gil Ives, Hal Jay\nPink Cats\nGrey Wolves: Ivy Kent', teams: true, consolation: true });
  for (let g = 0; g < 3; g++) await playOne(page, '#bracketView > .bracket', 0);
  await page.emulateMedia({ media: 'print' });
  eq(await page.$eval('.consolation-section', e => getComputedStyle(e).breakBefore), 'page', 'the consolation section starts a page');
  const pages = async () => {
    const buf = await page.pdf({ format: 'Letter', printBackground: true });
    const f = path.join(SCRATCH, 'p.pdf');
    fs.writeFileSync(f, buf);
    return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).split('\f').filter(t => t.trim());
  };
  const sheets = await pages();
  ok(sheets.length >= 2, 'it prints on at least two pages');
  ok(!/Consolation bracket/.test(sheets[0]), 'the first page is the main bracket, not the consolation');
  const at = sheets.findIndex(t => /Consolation bracket/.test(t));
  ok(at >= 1, 'the consolation bracket is on a later page');
  ok(/Third place: .* Consolation winner: /.test(sheets[at]), 'with its places named on that page');
  ok(sheets.some(t => /Red Foxes: Ann Lee, Bo Chan, Cy Dunn/.test(t)), 'the team list is on paper');
  ok(sheets.every(t => t.trim().length > 20), 'no blank page at the end');
  ok(!sheets.some(t => /Members:/.test(t)), 'no tooltip text leaks onto the paper');
  // the blank print: structure, no names in the consolation
  await page.emulateMedia({ media: 'screen' });
  await page.setChecked('#printBlank', true);
  await page.evaluate(() => { window.print = () => { window.__blank = document.querySelector('.consolation-section') ? document.querySelector('.consolation-section').textContent : null; window.__blankSlots = Array.from(document.querySelectorAll('.consolation-section .slot')).map(e => e.textContent); }; });
  await page.click('#printBtn'); await settle(page, 200);
  const blankSlots = await page.evaluate(() => window.__blankSlots);
  ok(blankSlots && blankSlots.length > 0 && blankSlots.every(t => t === 'TBD' || t === 'BYE'), 'the blank sheet shows the consolation bracket empty');
  ok(/Third place: not decided yet\. Consolation winner: not decided yet/.test(await page.evaluate(() => window.__blank)), 'with nothing named');
  await page.waitForTimeout(100);
  ok((await slotTexts(page, '.consolation-section .round:first-child')).some(t => t !== 'TBD' && t !== 'BYE'), 'and the live view comes back after it');
  await page.context().close();
}

/* ── 7. the new controls: keyboard and axe ──────────────────────────────── */
console.log('020 — keyboard and axe');
{
  const page = await newPage();
  await open(page);
  await page.focus('#teamMode');
  await page.keyboard.press('Space');
  eq(await page.isChecked('#teamMode'), true, 'the teams box works from the keyboard');
  await page.focus('#consolationOn');
  await page.keyboard.press('Space');
  eq(await page.isChecked('#consolationOn'), true, 'so does the consolation box');
  ok(await page.$eval('#teamMode', e => !!document.querySelector('label[for="teamMode"]')), 'each has a label');
  const scanSetup = await a11yScan(page, { include: ['#setupCard'] });
  eq(scanSetup.map(v => v.id), [], 'the setup card is clean under axe');
  // eight entrants, so no bye is dimmed-and-green by the page's older slot styling
  await build(page, { name: 'A11y', text: TEAM_TEXT + '\nPurple Elks: Gil Ives, Hal Jay\nPink Cats\nGrey Wolves: Ivy Kent\nTan Hens: Jo Lamb', teams: true, consolation: true });
  const scan = await a11yScan(page, { include: ['#bracketCard'] });
  eq(scan.map(v => v.id), [], 'the bracket, team list and consolation section are clean under axe');
  const heads = await page.$$eval('#bracketView [role="heading"]', h => h.map(x => [x.textContent, x.getAttribute('aria-level')]));
  ok(heads.some(h => h[0] === 'Consolation bracket' && h[1] === '2') && heads.some(h => h[0] === 'Teams'), 'both new sections are headings');
  // every control in the consolation is reachable and named
  const inputs = await page.$$eval('.consolation-section .match-score', i => i.map(x => x.getAttribute('aria-label')));
  ok(inputs.length > 0 && inputs.every(Boolean), 'the consolation\'s score boxes are named');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await settle(page, 400);                  // the slots fade their colours for 120 ms
  const dark = await a11yScan(page, { include: ['#bracketCard'] });
  eq(dark.map(v => v.id + ' ' + v.nodes.join(' ; ')), [], 'and in dark');
  await playOne(page, '#bracketView > .bracket', 0);   // a decided slot is dimmed by the page's own, older rule (opacity .5); not scanned
  await page.context().close();
}

ok(errors.length === 0, 'no page errors or console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
fs.rmSync(SCRATCH, { recursive: true, force: true });
await browser.close();
server.close();
console.log(`\n${failed ? 'FAILED' : 'passed'}: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
