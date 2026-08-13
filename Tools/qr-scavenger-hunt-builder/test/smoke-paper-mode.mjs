// smoke-paper-mode.mjs — the paper, no-device hunt mode.
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-paper-mode.mjs
//
// "The day the Chromebooks stayed in the cart" needs three printed pieces
// that all agree with each other: a Clue Card per station (no QR — a station
// code word instead), a per-team blank Answer Sheet in that team's own route
// order, and a teacher Answer Key that covers every station and every code
// word. This suite holds down:
//
//   Every station gets a code word, and it's stable across a reload (a
//   reprinted Clue Card must say the same word as the one already posted).
//
//   Clue Cards carry no QR canvas (the whole point of "no device") but do
//   carry the station's label, its content/question text, its code word,
//   and — for choice-type stations — the same printed choice list the QR
//   station card would show, since a team standing at the wall still needs
//   to read the question.
//
//   A team's Answer Sheet has exactly one row per station, in that team's
//   own route order — the same rotation smoke-staggered-starts.mjs already
//   holds down for route cards — not the plain build order.
//
//   The Answer Key's new Code Word column matches each Clue Card's word
//   exactly, station for station, so the teacher can grade a stack of paper
//   sheets against one sheet of their own.
//
//   Regenerating a station's code word changes what prints next time.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8119;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/** Seed a hunt with a mix of question types and a few teams, in Run mode. */
async function seed() {
  await page.evaluate(() => {
    localStorage.clear();
    const stations = [
      { label: 'Library', content: 'Ask the librarian for a hint', note: 'They know it', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0' },
      { label: 'Gym', content: 'How many hoops are in the gym?', note: '', qType: 'numeric', choices: [], correctChoice: 0, numericAnswer: '4', tolerance: '0', hint: '', hintPenalty: '0' },
      { label: 'Cafeteria', content: 'What day is pizza day?', note: '', qType: 'choice', choices: ['Monday', 'Tuesday', 'Friday'], correctChoice: 2, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0' },
      { label: 'Art Room', content: 'Find the mural', note: '', qType: 'photo', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0' },
    ];
    const teams = [
      { name: 'Team A', code: 'CODEA', marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0 },
      { name: 'Team B', code: 'CODEB', marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0 },
    ];
    localStorage.setItem('qr-scavenger-hunt-sets', JSON.stringify({
      current: 'Paper Hunt',
      sets: {
        'Paper Hunt': {
          name: 'Paper Hunt', stations, cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
          run: { teams, startedAt: null, elapsedMs: 0, running: false },
        },
      },
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
}

async function printClueCards() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#print-clues-btn');
  await settle(page);
  return page.evaluate(() => Array.from(document.querySelectorAll('#print-clues-grid .p-card')).map(c => ({
    label: c.querySelector('.p-label').textContent,
    hasCanvas: !!c.querySelector('canvas'),
    clueText: c.querySelector('.p-clue-text') ? c.querySelector('.p-clue-text').textContent : '',
    choices: c.querySelector('.p-choices') ? c.querySelector('.p-choices').innerHTML : '',
    codeWord: c.querySelector('.p-code-word span').textContent,
  })));
}

async function printAnswerKey() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#print-answers-btn');
  await settle(page);
  return page.evaluate(() => Array.from(document.querySelectorAll('#answer-key-body tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return { label: tds[1].textContent, codeWord: tds[5].textContent };
  }));
}

async function printAnswerSheets() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#print-answersheets-btn');
  await settle(page);
  return page.evaluate(() => Array.from(document.querySelectorAll('#print-answersheets-grid .p-card')).map(c => ({
    team: c.querySelector('.p-label').textContent,
    code: c.querySelector('.p-team-code').textContent,
    rows: Array.from(c.querySelectorAll('table.p-answersheet tbody tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      return { n: tds[0].textContent, station: tds[1].childNodes[0].textContent.trim(), blanks: tds.length - 2 };
    }),
  })));
}

console.log('QR Scavenger Hunt Builder — paper (no-device) hunt mode');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await seed();

/* ── 1. every station gets a code word, stable across reload ────────────── */
const buildCodeWords1 = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#stations-body .stn-code')).map(e => e.textContent));
eq(buildCodeWords1.length, 4, 'one code word shown per station in the Build table');
ok(buildCodeWords1.every(w => w && w.length > 0), 'every station has a non-empty code word');
eq(new Set(buildCodeWords1).size, 4, 'all four code words are distinct');

await page.reload({ waitUntil: 'networkidle' });
await settle(page);
const buildCodeWords2 = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#stations-body .stn-code')).map(e => e.textContent));
eq(buildCodeWords2.join(','), buildCodeWords1.join(','), 'code words are stable across a reload (a reprint matches what is already posted)');

/* ── 2. clue cards: no QR, right text, right code word ───────────────────── */
const clues = await printClueCards();
eq(clues.length, 4, 'one clue card per station');
ok(clues.every(c => !c.hasCanvas), 'clue cards carry no QR canvas — that is the point of no-device mode');
eq(clues.map(c => c.label).join(','), 'Library,Gym,Cafeteria,Art Room', 'clue cards are in station order');
ok(clues[0].clueText.includes('Ask the librarian'), 'the open-ended clue card shows its question text');
ok(clues[2].choices.includes('Monday') && clues[2].choices.includes('Tuesday') && clues[2].choices.includes('Friday'),
   'the multiple-choice clue card prints its choices, same as the QR station card would');
eq(clues.map(c => c.codeWord).join(','), buildCodeWords1.join(','), 'each clue card\'s code word matches the Build table');

/* ── 3. answer key covers every station and matches the clue cards' words ── */
const key = await printAnswerKey();
eq(key.length, 4, 'the answer key covers every station');
eq(key.map(k => k.label).join(','), 'Library,Gym,Cafeteria,Art Room', 'answer key rows are in station order');
eq(key.map(k => k.codeWord).join(','), clues.map(c => c.codeWord).join(','), 'the answer key\'s Code Word column matches each clue card exactly');

/* ── 4. team answer sheets: one per team, blank, in the team's own route ─── */
await page.click('#tab-run');
await settle(page);
const sheets = await printAnswerSheets();
eq(sheets.length, 2, 'one answer sheet per team');
eq(sheets[0].team, 'Team A', 'first sheet is Team A');
ok(sheets[0].code.includes('CODEA'), 'the sheet shows the team\'s check-in code');
eq(sheets[0].rows.length, 4, 'Team A\'s sheet has one row per station');
ok(sheets.every(s => s.rows.every(r => r.blanks === 2)), 'every row has two blank cells: code word found, and the answer');

// Cross-check against the same rotation the route cards use, independently
// computed here rather than assumed, matching smoke-staggered-starts.mjs's
// own approach.
const STATION_LABELS = ['Library', 'Gym', 'Cafeteria', 'Art Room'];
function expectedRoute(teamIdx, teamCount) {
  const offset = Math.round(teamIdx * STATION_LABELS.length / teamCount) % STATION_LABELS.length;
  return STATION_LABELS.slice(offset).concat(STATION_LABELS.slice(0, offset));
}
sheets.forEach((s, i) => {
  eq(s.rows.map(r => r.station).join(','), expectedRoute(i, sheets.length).join(','),
     `${s.team}'s answer sheet lists stations in that team's own staggered route order`);
});

/* ── 5. answer sheets carry a short instruction for typed answers ───────── */
const sheetHtml = await page.evaluate(() => document.querySelector('#print-answersheets-grid .p-card table').outerHTML);
ok(/Circle one: A\s*B\s*C/.test(sheetHtml), 'the choice-type row tells the team to circle a letter');
ok(/Write the number/.test(sheetHtml), 'the numeric-type row tells the team to write a number');

/* ── 6. regenerating a station's code word changes future prints ───────── */
await page.click('#tab-build');
await settle(page);
const before = buildCodeWords1[0];
await page.click('#stations-body [data-recode-station="0"]');
await settle(page);
const after = await page.evaluate(() => document.querySelector('#stations-body .stn-code').textContent);
ok(after !== before, `regenerating Library's code word changed it (was ${before}, now ${after})`);
const cluesAfter = await printClueCards();
eq(cluesAfter[0].codeWord, after, 'the reprinted clue card picks up the new code word');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
