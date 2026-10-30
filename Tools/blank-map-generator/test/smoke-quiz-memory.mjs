// smoke-quiz-memory.mjs — quiz memory across sessions on 046, and no Wikimedia request until asked (Path 20 P5).
//
//   node Tools/blank-map-generator/test/smoke-quiz-memory.mjs   (npm run test:blank-map-quiz-memory-smoke, port 8592)
//
// Network half (Devon, 2026-10-07: nothing fetches until he asks): an empty project, a first visit and a reload
// make no off-site request and show no search results; the search box holds a suggestion only; the Search button
// is what asks, and it does.
// Memory half: marking the place the class is answering records it in `bmg_quiz_memory_v1` for this map project; the
// same button twice counts once and the other replaces it; nothing is recorded before a place is revealed; the
// tally still counts presses as it always did; the history survives a reload, reads in the list, is not in the
// project's own data, steers "Missed ones first", and "Forget" clears this map's and only this map's.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8592;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

console.log('Blank Map — quiz memory and the network');
const server = await serve(PORT);
const browser = await launch();
const errors = [];
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());

// ── the network half: a first visit asks nothing ────────────────────────────────────────────────────────────
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 1200);
eq(page.__blocked.length, 0, 'a first visit makes no off-site request: ' + JSON.stringify(page.__blocked));
eq(await page.inputValue('#searchInput'), 'blank world map', 'the search box holds a suggested query');
eq(await page.locator('#resultsGrid > *').count(), 0, 'and nothing has been searched');
ok(!(await page.isVisible('#searchStatus')), 'no search status shows');
ok(/nothing is fetched/i.test(await page.textContent('#viewerEmpty')), 'the empty map says nothing is fetched until you search');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1200);
eq(page.__blocked.length, 0, 'a reload makes none either');
await page.click('#btnSearch');
await settle(page, 800);
ok(page.__blocked.some(u => /wikimedia|wikipedia/i.test(u)), 'pressing Search is what asks: ' + JSON.stringify(page.__blocked));
const asked = page.__blocked.length;

// ── the memory half ──────────────────────────────────────────────────────────────────────────────────────────
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 300);
const lbl = (id, x, text) => ({ id, x, y: 900, text, color: null, bold: false, italic: false, size: 'medium' });
await page.evaluate(src => {
  const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); const p = w.projects.find(q => q.id === w.activeId);
  p.data.labels = JSON.parse(src); localStorage.setItem('bmg_workspace_v1', JSON.stringify(w));
}, JSON.stringify([lbl('a', 300, 'Alps'), lbl('b', 700, 'Rhine'), lbl('c', 1100, 'Elbe')]));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);

const mem = () => page.evaluate(() => JSON.parse(localStorage.getItem('bmg_quiz_memory_v1') || 'null'));
const pid = () => page.evaluate(() => JSON.parse(localStorage.getItem('bmg_workspace_v1')).activeId);
const entry = async name => { const m = await mem(); return m && m.projects[await pid()] && m.projects[await pid()].labels[name]; };
const node = name => page.locator('#labelLayer .bmg-label', { hasText: name });

ok(!(await page.isVisible('#quizMemory')), 'the history box is not shown outside quiz mode');
eq(await mem(), null, 'no memory is stored before anything is marked');
await page.click('#btnQuizMode');
ok(await page.isVisible('#quizMemory'), 'quiz mode shows the history box');
ok((await page.textContent('#quizMemorySummary')).includes('none yet'), 'and says none yet');

// nothing revealed: the tally counts, the memory does not
await page.click('#btnQuizMissed');
eq(await page.textContent('#quizScore'), 'Score: 0 ✓ / 1 ✗', 'the tally counts a press with nothing revealed');
eq(await mem(), null, 'but nothing is remembered without a place');
await page.click('#btnQuizNewRound');

// reveal a place by clicking it, mark it
await node('Alps').click();
eq(await page.textContent('#quizCurrent'), 'Marking: Alps', 'the bar names the place being marked');
await page.click('#btnQuizMissed');
let e = await entry('alps');
ok(e && e.missed === 1 && e.got === 0 && e.last === 'missed' && /^\d{4}-\d{2}-\d{2}$/.test(e.at), 'a miss is stored for the place: ' + JSON.stringify(e));
await page.click('#btnQuizMissed');
e = await entry('alps');
eq(e.missed, 1, 'the same button again counts once in the memory');
eq(await page.textContent('#quizScore'), 'Score: 0 ✓ / 2 ✗', 'while the tally still counts presses');
await page.click('#btnQuizGot');
e = await entry('alps');
ok(e.missed === 0 && e.got === 1, 'the other button replaces the mark: ' + JSON.stringify(e));
await page.click('#btnQuizMissed');
// next round: Alps missed again, Rhine got
await page.click('#btnQuizNewRound');
await node('Alps').click();
await page.click('#btnQuizMissed');
await node('Rhine').click();
await page.click('#btnQuizGot');
e = await entry('alps');
ok(e.missed === 2 && e.got === 0, 'a second round adds to the history: ' + JSON.stringify(e));
const summary = await page.textContent('#quizMemorySummary');
ok(summary.includes('(1)'), 'one weak place in the summary: ' + summary);
await page.click('#quizMemory summary');
const listText = await page.textContent('#quizMemoryList');
ok(/Alps: missed 2, got 0/.test(listText) && !/Rhine/.test(listText), 'the list names the missed place, not the one got: ' + listText);

// not in the project's own data, not student data
const proj = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bmg_workspace_v1'))));
ok(!/quiz|missed/i.test(proj.replace(/Self-Check/g, '')), 'the project data holds no quiz history, so a share link carries none');

// survives a reload, and steers the next pick
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);
await page.click('#btnQuizMode');
ok((await page.textContent('#quizMemorySummary')).includes('(1)'), 'the history is there after a reload');
await page.check('#quizMissedFirst');
await page.click('#btnQuizReveal');
eq(await page.textContent('#quizCurrent'), 'Marking: Alps', 'Missed ones first reveals the place that was missed');
await page.click('#btnQuizReveal');
ok(/Marking: (Rhine|Elbe)/.test(await page.textContent('#quizCurrent')), 'then falls back to a random one');
ok((await page.textContent('#quizProgress')).startsWith('2 of 3'), 'two of three revealed');

// another map project keeps its own history
await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bmg_quiz_memory_v1')); w.projects.other = { at: '2026-10-01', labels: { x: { text: 'X', got: 0, missed: 1, last: 'missed', at: '2026-10-01' } } }; localStorage.setItem('bmg_quiz_memory_v1', JSON.stringify(w)); });
// a map project that no longer exists is dropped the next time quiz mode starts
await page.click('#btnQuizMode');
await page.click('#btnQuizMode');
eq(Object.keys((await mem()).projects).join(), await pid(), 'history of a map project that is gone is pruned');

// a11y with the box open
const a11y = await a11yScan(page, { impact: 'serious' });
ok(!a11y || a11y.length === 0, 'axe: no serious or critical violations with quiz memory showing' + (a11y && a11y.length ? ' ' + JSON.stringify(a11y.map(v => v.id)) : ''));

// forget (the box is a closed details after the reload; open it as a teacher would)
await page.click('#quizMemory summary');
await page.click('#btnQuizForget');
eq(await mem(), null, 'forgetting clears this map and the key goes with the last one');
ok((await page.textContent('#quizMemorySummary')).includes('none yet'), 'the box says none yet');
ok(await page.isDisabled('#btnQuizForget'), 'and Forget is disabled with nothing to forget');

const real = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
ok(real.length === 0, 'no console errors: ' + JSON.stringify(real));
eq(page.__blocked.length, asked, 'nothing more was requested off-site after the one Search press');
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-quiz-memory: all ${passed} passed`);
process.exit(failed ? 1 : 0);
