// smoke-more-widgets.mjs — 087 Class Screen, Path 22 P9 (more widgets).
//
//   node Tools/class-screen/test/smoke-more-widgets.mjs
//
// The agenda checklist, the pie timer, the think/pair/share sequence, the
// countdown to the bell, the team scoreboard and the spinner wheel. Each goes
// through the same registry as the first fourteen (dock, saved state), and each
// is driven in present mode, in the spotlight and against the keyboard shortcuts
// (nothing fires while someone types). Older boards must still open. Teams and
// items here are made up; no real name is used.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
/* global ClassScreenCore -- the page's pure core, read inside page.evaluate() */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8650;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
let page = await prepPage(browser, BASE, { width: 1400, height: 900 });
const mainPage = page;

console.log('Class Screen — more widgets');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const dataOf = async (type) => (await cur()).widgets.find((w) => w.type === type).data;
const add = async (type) => { await page.click(`#dock button[data-add="${type}"]`); await settle(page, 250); };
const rectOf = (loc) => loc.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });

/* A widget must behave in present mode, in the spotlight and under the shortcuts.
   `key` is a locator inside it that must stay on screen; `field` is a text field
   inside it that keystrokes can be typed into (the shortcuts must stay quiet). */
async function modes(type, key, field, label) {
  const w = widget(type);
  // typing: Space, N, arrows and ? in the widget's own field fire nothing
  if (field) {
    const screenBefore = (await st()).current, before = await field.inputValue();
    await field.focus();
    await page.keyboard.type(' n?');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    eq((await st()).current, screenBefore, `${label}: typing in its field does not move the screen`);
    ok(await page.locator('#keysDialog[open]').count() === 0, `${label}: typing ? in its field does not open the shortcut list`);
    ok((await field.inputValue()).includes(' n?') || before !== (await field.inputValue()), `${label}: the keys reached the field`);
    await field.fill(before);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
  }
  // spotlight: the Fill button lifts it over the board; it still shows its face
  await w.locator('.w-fill').click();
  ok(await w.evaluate((n) => n.classList.contains('spot')), `${label}: Fill spotlights it`);
  const board = await rectOf(page.locator('#board')), r = await rectOf(w);
  ok(r.w >= board.w * 0.9 && r.h >= board.h * 0.9, `${label}: spotlit it fills the board (${r.w}x${r.h} of ${board.w}x${board.h})`);
  ok(await key.isVisible(), `${label}: its face shows in the spotlight`);
  await page.keyboard.press('Escape');
  ok(!(await w.evaluate((n) => n.classList.contains('spot'))), `${label}: Esc steps back from the spotlight`);
  // present mode: bars and corners gone, face stays, no drag
  await page.click('#presentBtn');
  ok(!(await w.locator('.w-bar').isVisible()), `${label}: present hides its title bar`);
  ok(!(await w.locator('.w-resize').isVisible()), `${label}: present hides its resize corner`);
  ok(await key.isVisible(), `${label}: its face shows in present mode`);
  const pos = await rectOf(w);
  await page.mouse.move(pos.x + 20, pos.y + 20); await page.mouse.down(); await page.mouse.move(pos.x + 120, pos.y + 90); await page.mouse.up();
  eq(await rectOf(w), pos, `${label}: it cannot be dragged in present mode`);
  await page.click('#presentExit');
  ok(await w.locator('.w-bar').isVisible(), `${label}: leaving present mode brings the bar back`);
  const v = await a11yScan(page);
  eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], `${label}: axe finds no serious violation`);
}

// ── agenda ───────────────────────────────────────────────────────────
console.log(' agenda');
await add('agenda');
eq(await page.locator('#dock button[data-add="agenda"]').count(), 1, 'the dock offers the agenda');
const ag = widget('agenda');
const agIn = ag.getByLabel('New agenda item');
for (const t of ['Warm-up', 'Notes', 'Practice']) { await agIn.fill(t); await agIn.press('Enter'); }
await settle(page, 300);
eq((await dataOf('agenda')).items, [{ t: 'Warm-up', done: false }, { t: 'Notes', done: false }, { t: 'Practice', done: false }], 'three items are added with Enter and saved');
eq(await ag.locator('li.now .agenda-text').textContent(), 'Warm-up', 'the first open item is marked as now');
await ag.getByRole('button', { name: 'Tick next' }).click();
eq((await dataOf('agenda')).items.map((i) => i.done), [true, false, false], 'Tick next ticks the first open item');
eq(await ag.locator('li.now .agenda-text').textContent(), 'Notes', 'and now moves on');
await ag.getByRole('checkbox', { name: 'Practice' }).check();
eq((await dataOf('agenda')).items.map((i) => i.done), [true, false, true], 'a box can be ticked by hand');
await ag.getByRole('button', { name: 'Clear ticks' }).click();
eq((await dataOf('agenda')).items.map((i) => i.done), [false, false, false], 'Clear ticks unticks all');
await ag.getByRole('button', { name: 'Remove Notes' }).click();
eq((await dataOf('agenda')).items.map((i) => i.t), ['Warm-up', 'Practice'], 'an item can be removed');
for (let i = 0; i < 14; i++) { if (!(await agIn.isEnabled())) break; await agIn.fill('Item ' + i); await agIn.press('Enter'); }
eq((await dataOf('agenda')).items.length, 12, 'an agenda stops at twelve items');
ok(!(await agIn.isEnabled()), 'and its field is disabled then');
for (let i = 0; i < 10; i++) await ag.locator('.agenda-x').first().click();
await agIn.fill('Warm-up'); await agIn.press('Enter');
await agIn.fill('Notes'); await agIn.press('Enter');

// a timer that ends ticks the next item
await add('timer');
const tm = widget('timer');
await tm.locator('.w-link summary').click();
await tm.getByLabel('Tick the next agenda item').check();
eq((await dataOf('timer')).link, { flash: false, light: '', agenda: true }, 'the timer saves the agenda link');
const doneBefore = (await dataOf('agenda')).items.filter((i) => i.done).length;
await tm.getByLabel('Set time, minutes or m:ss').fill('2s');
await tm.getByRole('button', { name: 'Set', exact: true }).click();
await tm.getByRole('button', { name: 'Start', exact: true }).click();
await page.waitForFunction(([k, n]) => JSON.parse(localStorage.getItem(k)).data.screens[0].widgets.find((w) => w.type === 'agenda').data.items.filter((i) => i.done).length > n, [KEY, doneBefore], { timeout: 8000 }).catch(() => {});
eq((await dataOf('agenda')).items.filter((i) => i.done).length, doneBefore + 1, 'the ended timer ticked exactly one item');
await tm.getByRole('button', { name: 'Remove Timer' }).click().catch(() => {});

await modes('agenda', ag.locator('.agenda-list'), agIn, 'agenda');

// ── pie timer ────────────────────────────────────────────────────────
console.log(' pie timer');
await add('pie');
const pie = widget('pie');
const wedgeD = () => pie.locator('.pie-wedge').getAttribute('d');
eq(await page.locator('#dock button[data-add="pie"]').count(), 1, 'the dock offers the pie timer');
ok(await pie.locator('.pie-svg').isVisible(), 'the pie is drawn');
ok((await wedgeD()).startsWith('M50 5a45'), 'a full timer is a full disc');
await pie.getByLabel('Set time, minutes or m:ss').fill('10s');
await pie.getByRole('button', { name: 'Set', exact: true }).click();
await pie.getByRole('button', { name: 'Start', exact: true }).click();
await settle(page, 1800);
await pie.getByRole('button', { name: 'Pause', exact: true }).click();
ok(/^M50 50L50 5A45 45 0 1 1 /.test(await wedgeD()), 'a timer with most of its time left draws a wedge over half (large-arc flag 1)');
await pie.getByRole('button', { name: 'Start', exact: true }).click();   // keep it running for the Space check below
await pie.getByRole('button', { name: 'Pause', exact: true }).click();
const dPaused = await wedgeD();
await settle(page, 600);
eq(await wedgeD(), dPaused, 'a paused pie holds still');
// the shortcuts reach it: Space is "the timer on top"
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press(' ');
eq(await pie.getByRole('button', { name: /^(Pause|Start)$/ }).first().textContent(), 'Pause', 'Space starts the pie timer (the timer on top)');
await page.keyboard.press(' ');
eq(await pie.getByRole('button', { name: /^(Pause|Start)$/ }).first().textContent(), 'Start', 'and Space again pauses it');
ok(Object.keys((await dataOf('pie'))).sort().join() === 'duration,endsAt,remaining,sound', 'a pie timer saves the timer shape and no more');
// it runs out: red wedge in the last fifth, the done look, the flash link
await pie.locator('.w-link summary').click();
await pie.getByLabel('Flash the board').check();
await pie.getByLabel('Set time, minutes or m:ss').fill('3s');
await pie.getByRole('button', { name: 'Set', exact: true }).click();
await pie.getByRole('button', { name: 'Start', exact: true }).click();
await page.waitForFunction(() => document.querySelector('.wt-pie .pie-wedge').classList.contains('low'), null, { timeout: 4000 }).catch(() => {});
ok(await pie.locator('.pie-wedge.low').count() === 1, 'the last fifth turns the wedge red');
ok(/^M50 50L50 5A45 45 0 0 1 /.test(await wedgeD()), 'and a wedge under half uses the small arc (flag 0)');
await page.waitForFunction(() => document.getElementById('board').classList.contains('flash'), null, { timeout: 5000 }).catch(() => {});
ok(await page.evaluate(() => document.getElementById('board').classList.contains('flash')), 'a pie timer with the flash link flashes the board at the end');
ok(await pie.evaluate((n) => n.classList.contains('timer-done')), 'and takes the done look');
eq(await wedgeD(), '', 'nothing is left of the pie at zero');
await settle(page, 4400);
await modes('pie', pie.locator('.pie-svg'), pie.getByLabel('Set time, minutes or m:ss'), 'pie timer');

// ── sequence timer ───────────────────────────────────────────────────
console.log(' sequence timer');
await add('sequence');
const sq = widget('sequence');
const stepNow = () => sq.locator('.seq-name').textContent();
const startSq = () => sq.getByRole('button', { name: /^(Start|Pause|Restart)$/ });
eq(await page.locator('#dock button[data-add="sequence"]').count(), 1, 'the dock offers the sequence timer');
eq(await sq.locator('.seq-chips li').allTextContents(), ['Think 1:00', 'Pair 2:00', 'Share 3:00'], 'a new sequence is think / pair / share');
eq(await stepNow(), 'Think', 'it starts on the first step');
await sq.locator('summary', { hasText: 'Edit steps' }).click();
const sqEdit = sq.getByLabel('Steps, like Think 1:00, Pair 2:00, Share 3:00');
await sqEdit.fill('Think, Pair 2s');
await sq.getByRole('button', { name: 'Set', exact: true }).click();
ok(await sq.locator('.err-note').isVisible(), 'a step with no time is refused out loud');
ok((await sq.locator('.err-note').textContent()).includes('Step 1'), 'naming the step');
eq((await dataOf('sequence')).steps.length, 3, 'and the steps are unchanged');
await sqEdit.fill('Think 2s, Pair 2s, Share 2s');
await sq.getByRole('button', { name: 'Set', exact: true }).click();
eq((await dataOf('sequence')).steps, [{ label: 'Think', sec: 2 }, { label: 'Pair', sec: 2 }, { label: 'Share', sec: 2 }], 'new steps are saved');
// the shortcut and the link
await sq.locator('summary', { hasText: 'When it ends' }).click();
await sq.getByLabel('Flash the board').check();
await sq.getByLabel('Tick the next agenda item').check();
const agBefore = (await dataOf('agenda')).items.filter((i) => i.done).length;
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); document.getElementById('board').classList.remove('flash'); });
await page.keyboard.press(' ');
eq(await startSq().textContent(), 'Pause', 'Space runs the sequence (the timer on top)');
await settle(page, 2600);
eq(await stepNow(), 'Pair', 'when a step ends the next one starts by itself');
eq(await sq.locator('.seq-chips li.now').textContent(), 'Pair 0:02', 'and its chip is the current one');
eq(await sq.locator('.seq-chips li[aria-current="step"]').count(), 1, 'marked for a screen reader');
ok(!(await page.evaluate(() => document.getElementById('board').classList.contains('flash'))), 'nothing fires between steps');
await settle(page, 2600);
eq(await stepNow(), 'Share', 'and on to the third');
await page.waitForFunction(() => document.querySelector('.wt-sequence').classList.contains('timer-done'), null, { timeout: 5000 }).catch(() => {});
ok(await sq.evaluate((n) => n.classList.contains('timer-done')), 'after the last step it takes the done look');
eq(await startSq().textContent(), 'Restart', 'and offers Restart');
ok(await page.evaluate(() => document.getElementById('board').classList.contains('flash')), 'the board flashes once, at the very end');
eq((await dataOf('agenda')).items.filter((i) => i.done).length, agBefore + 1, 'and the next agenda item is ticked');
await startSq().click();
eq(await stepNow(), 'Think', 'Restart goes back to the first step and runs');
await sq.getByRole('button', { name: 'Skip to the next step' }).click();
eq(await stepNow(), 'Pair', 'Skip moves on one step');
await sq.getByRole('button', { name: 'Reset', exact: true }).click();
eq(await stepNow(), 'Think', 'Reset returns to step one');
eq(await startSq().textContent(), 'Start', 'paused');
// a position survives a reload
await sqEdit.fill('Think 30s, Pair 30s, Share 30s');
await sq.getByRole('button', { name: 'Set', exact: true }).click();
await startSq().click();
await sq.getByRole('button', { name: 'Skip to the next step' }).click();
await settle(page, 400);
await page.reload();
await settle(page, 500);
eq(await widget('sequence').locator('.seq-name').textContent(), 'Pair', 'a reload keeps the step');
eq(await widget('sequence').getByRole('button', { name: /^(Start|Pause|Restart)$/ }).textContent(), 'Pause', 'and it is still running');
await widget('sequence').getByRole('button', { name: 'Pause', exact: true }).click();
await widget('sequence').locator('summary', { hasText: 'Edit steps' }).click();
await modes('sequence', widget('sequence').locator('.big.seq'), widget('sequence').getByLabel('Steps, like Think 1:00, Pair 2:00, Share 3:00'), 'sequence');

// ── countdown to the bell ────────────────────────────────────────────
// Its own page with a pinned clock: every period time is derived from T0, so the
// result does not depend on when the suite runs.
console.log(' bell countdown');
const T0 = new Date(2026, 8, 14, 10, 0, 0);
const BELL = { periods: [
  { id: 'p1', label: 'Period 1', start: '09:30', end: '10:20' },
  { id: 'p2', label: 'Period 2', start: '10:25', end: '11:15' }] };
const bp = await prepPage(browser, BASE, { width: 1400, height: 900 });
await bp.clock.install({ time: T0 });
await bp.goto(URL_PAGE);
await bp.evaluate(([k]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify({ periods: [] })); }, ['gvb-command-center:settings']);
await bp.reload();
await bp.clock.runFor(500);
page = bp;
await add('bell');
const bw = widget('bell');
eq(await page.locator('#dock button[data-add="bell"]').count(), 1, 'the dock offers the bell countdown');
eq(await bw.locator('.bell-label').textContent(), 'No bell times yet', 'with no schedule it says so');
eq(await bw.locator('.note a').getAttribute('href'), '010-command-center-dashboard.html', 'and points at Command Center');
await page.evaluate(([k, b]) => { localStorage.setItem(k, JSON.stringify(b)); window.dispatchEvent(new StorageEvent('storage', { key: k })); }, ['gvb-command-center:settings', BELL]);
await page.clock.runFor(400);
eq(await bw.locator('.bell-label').textContent(), 'Period 1 ends in', 'a schedule written in Command Center is picked up');
eq(await bw.locator('.big-text').textContent(), '19:59', 'at 10:00:01 a period ending 10:20 has 19:59 left');
await page.clock.runFor(60000);
eq(await bw.locator('.big-text').textContent(), '18:59', 'and a minute later 18:59');
await page.clock.runFor(19 * 60000 + 30000);
eq(await bw.locator('.bell-label').textContent(), 'Period 2 starts in', 'between the periods it counts to the next start');
eq(await bw.locator('.big-text').textContent(), '4:29', 'at 10:20:31 a start at 10:25 is 4:29 away');
await page.clock.runFor(60 * 60000);
eq(await bw.locator('.bell-label').textContent(), 'No more bells today', 'after the last bell it says so');
eq(await bw.locator('.big-text').textContent(), '', 'and shows no time');
ok(await bw.evaluate((n) => !n.querySelector('.note a')), 'with no pointer to Command Center, which has times');
eq(Object.keys((await dataOf('bell'))).length, 0, 'the widget saves nothing of its own');
// back inside a period to look at it in the modes
await page.evaluate(([k, b]) => { b.periods[1].end = '23:59'; localStorage.setItem(k, JSON.stringify(b)); window.dispatchEvent(new StorageEvent('storage', { key: k })); }, ['gvb-command-center:settings', BELL]);
await page.clock.runFor(400);
await modes('bell', bw.locator('.big-text'), null, 'bell countdown');
eq(page.__errs, [], 'the bell page has no page or console errors');
await bp.close();
page = mainPage;

// ── team scoreboard ──────────────────────────────────────────────────
console.log(' scoreboard');
await add('score');
const sb = widget('score');
const scores = async () => (await dataOf('score')).teams.map((t) => t.score);
eq(await page.locator('#dock button[data-add="score"]').count(), 1, 'the dock offers the scoreboard');
eq((await dataOf('score')).teams.map((t) => t.name), ['Team 1', 'Team 2', 'Team 3', 'Team 4'], 'a new board has four teams');
eq(await sb.locator('.score-card.lead').count(), 0, 'with all teams level, nobody leads');
const plus1 = sb.getByRole('button', { name: 'Give one point to Team 1' });
for (let i = 0; i < 3; i++) await plus1.click();
eq(await scores(), [3, 0, 0, 0], 'the plus button gives a point, saved');
eq(await sb.locator('.score-card').first().locator('.score-num').textContent(), '3', 'and the number shows it');
ok(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Give one point to Team 1'), 'the button keeps focus, so a keyboard can press it again');
eq(await sb.locator('.score-card.lead').count(), 1, 'the single leader gets the heavier border');
eq(await sb.locator('.score-card.lead .note').textContent(), 'Leading', 'and the word for anyone who cannot see the border');
await sb.getByRole('button', { name: 'Take one point from Team 3' }).click();
eq(await scores(), [3, 0, -1, 0], 'minus can go below zero');
await sb.getByLabel('Team name').nth(1).fill('Table B');
await sb.getByLabel('Team name').nth(1).press('Tab');
eq((await dataOf('score')).teams[1].name, 'Table B', 'a team can be renamed');
eq(await sb.getByRole('button', { name: 'Give one point to Table B' }).count(), 1, 'and its buttons are named after it');
await sb.getByLabel('Team name').nth(1).fill('');
await sb.getByLabel('Team name').nth(1).press('Tab');
eq((await dataOf('score')).teams[1].name, 'Team 2', 'a blank name goes back to Team 2');
await sb.getByRole('button', { name: 'Zero scores' }).click();
eq(await scores(), [0, 0, 0, 0], 'Zero scores resets them all');
for (let i = 0; i < 4; i++) await sb.getByRole('button', { name: 'Add team' }).click();
eq((await dataOf('score')).teams.length, 8, 'a board stops at eight teams');
ok(await sb.getByRole('button', { name: 'Add team' }).isDisabled(), 'and Add team is disabled then');
for (let i = 0; i < 8; i++) await sb.locator('.score-btns.edit button').first().click();
eq((await dataOf('score')).teams, [], 'every team can be removed');
ok(await sb.getByText('No teams yet. Add one.').isVisible(), 'and says so');
await sb.getByRole('button', { name: 'Add team' }).click();
await sb.getByRole('button', { name: 'Give one point to Team 1' }).click();
await modes('score', sb.locator('.score-grid'), sb.getByLabel('Team name').first(), 'scoreboard');
await sb.getByRole('button', { name: 'Give one point to Team 1' }).click();
ok(await sb.locator('.score-btns.edit').first().isVisible(), 'the remove buttons are back after present mode');
await page.click('#presentBtn');
ok(!(await sb.locator('.score-btns.edit').first().isVisible()), 'present mode hides the remove buttons');
ok(await sb.getByRole('button', { name: 'Give one point to Team 1' }).isVisible(), 'but keeps the plus and minus');
await page.click('#presentExit');

// ── spinner wheel ────────────────────────────────────────────────────
console.log(' spinner wheel');
await add('wheel');
const wl = widget('wheel');
const wlAngle = () => wl.locator('.wheel-rot').evaluate((n) => parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(n.style.transform)[1]));
eq(await page.locator('#dock button[data-add="wheel"]').count(), 1, 'the dock offers the wheel');
eq(await wl.locator('.wheel-seg').count(), 4, 'a new wheel has four segments');
eq(await wl.locator('.wheel-lab').allTextContents(), ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'], 'with their labels');
await page.evaluate(() => { Math.random = () => 0.5; });
await wl.getByRole('button', { name: 'Spin', exact: true }).click();
eq(await wl.locator('.wheel-result').textContent(), '', 'the answer is not shown while the wheel turns');
ok(await wl.getByRole('button', { name: 'Spin', exact: true }).isDisabled(), 'and Spin waits for the stop');
const a1 = await wlAngle();
ok(a1 >= 5 * 360, `it turns at least five times (${a1} degrees)`);
await page.waitForFunction(() => document.querySelector('.wheel-result').textContent !== '', null, { timeout: 6000 }).catch(() => {});
eq(await wl.locator('.wheel-result').textContent(), 'Choice 3', 'after the turn it names the segment the draw chose');
eq(await page.evaluate((a) => ClassScreenCore.wheelAt(4, a), a1), 2, 'and that segment is the one under the pointer');
ok(await wl.getByRole('button', { name: 'Spin', exact: true }).isEnabled(), 'Spin is ready again');
await wl.getByRole('button', { name: 'Spin', exact: true }).click();
await page.waitForFunction(() => !document.querySelector('.wheel-box').closest('.w').querySelector('button.primary').disabled, null, { timeout: 6000 }).catch(() => {});
const a2 = await wlAngle();
ok(a2 >= a1 + 5 * 360, 'a second spin goes on forward from where the first stopped');
eq(await page.evaluate((a) => ClassScreenCore.wheelAt(4, a), a2), 2, 'and lands on the same segment for the same draw');
// reduced motion: no turn, the answer at once
await page.emulateMedia({ reducedMotion: 'reduce' });
eq(await wl.locator('.wheel-rot').evaluate((n) => getComputedStyle(n).transitionDuration), '0s', 'reduced motion removes the turning');
await page.evaluate(() => { Math.random = () => 0.1; });
await wl.getByRole('button', { name: 'Spin', exact: true }).click();
eq(await wl.locator('.wheel-result').textContent(), 'Choice 1', 'and the answer is there at once');
eq(await page.evaluate((a) => ClassScreenCore.wheelAt(4, a), await wlAngle()), 0, 'on the right segment');
await page.emulateMedia({ reducedMotion: 'no-preference' });
// editing
await wl.locator('summary', { hasText: 'Edit the wheel' }).click();
const wlText = wl.getByLabel('Wheel entries, one per line');
await wlText.fill('Red\nBlue\n\n  Green  ');
await wl.getByRole('button', { name: 'Set', exact: true }).click();
eq((await dataOf('wheel')).items, ['Red', 'Blue', 'Green'], 'entries are saved without blanks');
eq(await wl.locator('.wheel-seg').count(), 3, 'and the wheel is redrawn');
await wlText.fill('Only one');
await wl.getByRole('button', { name: 'Set', exact: true }).click();
ok(await wl.getByRole('button', { name: 'Spin', exact: true }).isDisabled(), 'one entry cannot spin');
ok((await wl.locator('.note').textContent()).includes('at least two'), 'and says why');
await wlText.fill(Array.from({ length: 30 }, (_, i) => 'Entry ' + i).join('\n'));
await wl.getByRole('button', { name: 'Set', exact: true }).click();
eq((await dataOf('wheel')).items.length, 24, 'a wheel stops at 24 entries');
await wlText.fill('Red\nBlue\nGreen');
await wl.getByRole('button', { name: 'Set', exact: true }).click();
await modes('wheel', wl.locator('.wheel-svg'), wlText, 'wheel');

// an older board (no agenda; a timer with no link) still opens, link-free
await settle(page, 600);   // let the page's own save land first
await page.evaluate(([k]) => {
  const s = JSON.parse(localStorage.getItem(k));
  s.data.screens = [{ id: 'sx', name: 'Older', bg: 'dots', bgImage: '', period: '', widgets: [{ id: 'wt1', type: 'timer', x: 0.1, y: 0.1, w: 0.26, h: 0.34, z: 1, data: { duration: 300, endsAt: 0, remaining: 300, sound: true } }] }];
  s.data.current = 'sx';
  localStorage.setItem(k, JSON.stringify(s));
}, [KEY]);
await page.reload();
await settle(page, 400);
eq(await widget('timer').count(), 1, 'an older board with one timer opens');
eq((await dataOf('timer')).link, undefined, 'and its timer still has no link');

for (const width of [375, 360]) {
  await page.setViewportSize({ width, height: 740 });
  await settle(page, 200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
}
await page.setViewportSize({ width: 1400, height: 900 });

eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
