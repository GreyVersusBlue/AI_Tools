// smoke-projector.mjs — the Review Game Board's projector view (030's
// projector styling), in the page.
//
//   node Tools/review-game-board/test/smoke-projector.mjs            (port 8526)
//   node Tools/review-game-board/test/smoke-projector.mjs --print    (the pins of section 1)
//   PJ_ONLY=3,4 node Tools/review-game-board/test/smoke-projector.mjs  (sections, for a break run)
//
// What's worth holding still:
//   1. with the view off the play screen is what v290 drew: the markup of the
//      board card and both overlays, the classes on <html> and <body>, the
//      stored keys and the size of the type, in every mode (PINS were made
//      with --print against that page, before the view was written);
//   2. the button, the P key, the Leave button and the memory: on and off,
//      on a reload, per device, nothing stored when off, nothing in a board
//      file, and off again is the page of section 1 to the byte;
//   3. the type is large: the floors below, at 1280x720 and 1920x1080, light
//      and dark, on the board, the clue, the answer, the wager, every-team
//      marking, the final round, quiz-bowl and the wheel;
//   4. nothing is clipped or overlaps, with the longest category, clue and
//      team name this suite uses (the tool sets no limit; they are the
//      stress case in _projector-fixtures.mjs), and a typical board fits one
//      screen without scrolling;
//   5. every text is AA against what is drawn under it, both themes;
//   6. a focus mark of at least 4px (6px at 1080p) with two colours, not
//      clipped at the grid's edge;
//   7. the teacher's controls are small, after the board, reachable by Tab;
//   8. nothing is told by colour alone;
//   9. a clue picture, tall or wide, keeps its shape and fits;
//  10. play is unchanged: the same keys give the same scores and the same
//      stored board with the view on; print media is unaffected; axe is clean.
// Every name and question is made up. Exits 1 on any failure.

import zlib from 'node:zlib';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { sha, OLD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';
import { playScreenOff } from './_projector-off.mjs';
import { STRESS_BOARD, TYPICAL_BOARD, WHEEL_ON, LONG_CLUE, LONG_ANSWER } from './_projector-fixtures.mjs';

const PORT = 8526;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const PRINT = process.argv.includes('--print');
const ONLY = (process.env.PJ_ONLY || '').split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(String(n));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── the floors, in CSS px at 1280x720; 1920x1080 is 1.5 times each ──────── */
const FLOORS = {
  category: 24, value: 38, score: 48, teamName: 25,
  clue: 46, clueLong: 33, answer: 35, answerLong: 28,
  award: 19, round: 28, label: 19,
};

/* Made with --print against the page as v290 left it. */
const PINS = {"loaded":"3035f3bbd409168f","loadedStorage":"787a3cf760342cf5","clue":"cf6d586d1b10a111","clueStorage":"787a3cf760342cf5","answer":"b44e99da6a479c7d","answerStorage":"787a3cf760342cf5","everyTeam":"d41d1748e12c4dbb","everyTeamStorage":"e1b7f051b0334833","final":"4f1cbad4bd42b123","finalStorage":"eae735de9205c045","quizBowl":"ea906a15deeef59c","quizBowlStorage":"778964755cd5078f","quizBowlBuzz":"cadb81b9d6ffc520","quizBowlBuzzStorage":"778964755cd5078f","wheel":"4812b335b0a7b319","wheelStorage":"c73bd975f245aa4b","wheelSpun":"7cce19c3692c1e9a","wheelSpunStorage":"7ad642b0882bff85"};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
await page.emulateMedia({ reducedMotion: 'reduce' });
page.on('dialog', d => d.accept());

console.log('Review Game Board — projector view');

/* ── 1. with the view off, the page is the page it was ──────────────────── */
if (PRINT || want(1)) {
  console.log('1. the view off: the play screen of every mode is what v290 drew');
  const got = await playScreenOff(page, URL_PAGE);
  const hashes = Object.fromEntries(Object.keys(got).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(JSON.stringify(hashes)); await browser.close(); server.close(); process.exit(0); }
  for (const k of Object.keys(PINS)) eq(hashes[k], PINS[k], `the view off: ${k} is what the v290 page gave`);
  eq(Object.keys(got).sort(), Object.keys(PINS).sort(), 'every capture has a pin');
  ok(!/projector/i.test(got.loaded.replace(/Projector view|projectorBtn/g, '')), 'and nothing of the view is in the play screen');
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const clone = v => JSON.parse(JSON.stringify(v));
const press = async k => { await page.keyboard.press(k); await settle(page, 120); };
const click = async sel => { await page.click(sel); await settle(page, 150); };
const keysOf = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('gvb-review-board:') === 0).sort());
const bodyClass = () => page.evaluate(() => document.body.getAttribute('class'));
const pressed = () => page.getAttribute('#projectorBtn', 'aria-pressed');
const withBank = (board, extra) => Object.assign(storageOf(board), { 'gvb-question-bank': JSON.stringify(BANK) }, extra || {});
const q = (id, prompt, answer) => ({ id, prompt, answer, choices: [], media: null, unit: '', standard: '', difficulty: '', tags: [], points: 100, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
const BANK = { v: 1, data: { schema: 1, questions: [q('q-long', LONG_CLUE, LONG_ANSWER), q('q-b', 'Longest river?', 'The Nile'), q('q-c', 'Largest lake?', 'The Caspian')], legacy: {} } };
const SIZES = [[1280, 720], [1920, 1080]];
const setSize = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await settle(page, 150); };
const setTheme = async t => {
  await page.evaluate(x => { if (x === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); }, t);
  await settle(page, 250);
};
const PJ_KEY = 'gvb-review-board:projector';
const turnOnForTab = async () => { await page.evaluate(k => sessionStorage.setItem(k, '1'), PJ_KEY); await page.reload({ waitUntil: 'networkidle' }); await settle(page, 250); };
const openStress = async (board, extra) => {
  await openWith(page, URL_PAGE, withBank(board || STRESS_BOARD, extra || {}));
  await turnOnForTab();
};

/* In the page: every number a state's checks need. Returns problem strings. */
const IN_PAGE = `(${function (roots, opts) {
  const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const visible = e => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || n.hidden) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rootEls = roots.map(r => document.querySelector(r)).filter(Boolean);
  const all = [];
  rootEls.forEach(root => root.querySelectorAll('*').forEach(e => { if (visible(e) && !e.closest('svg') && e.tagName !== 'OPTION') all.push(e); }));
  const problems = [];
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.value || e.textContent || '').trim().slice(0, 24) + '"';

  /* clipped: a box whose content is bigger than the box */
  if (opts.clip !== false) {
    all.forEach(e => {
      if (!e.clientWidth || !e.clientHeight) return;
      if (e.scrollWidth > e.clientWidth + 1) problems.push('clipped across: ' + name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
      if (e.scrollHeight > e.clientHeight + 1) problems.push('clipped down: ' + name(e) + ' ' + e.scrollHeight + '>' + e.clientHeight);
    });
    rootEls.forEach(root => { if (root.scrollHeight > root.clientHeight + 1 && getComputedStyle(root).overflowY !== 'visible') problems.push('scrolls: ' + name(root) + ' ' + root.scrollHeight + '>' + root.clientHeight); });
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('the page scrolls across: ' + document.documentElement.scrollWidth + '>' + innerWidth);
  }

  /* overlapping: boxes of one kind that share area */
  (opts.groups || []).forEach(sel => {
    const boxes = Array.from(document.querySelectorAll(sel)).filter(visible).map(e => ({ e, r: e.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1.5 && h > 1.5) problems.push('overlap in ' + sel + ': ' + name(boxes[i].e) + ' and ' + name(boxes[j].e));
    }
  });

  /* contrast: every text against what is drawn under it */
  const TILES = { 'cat-header': '#13245e', 'cell': '#1a2d6e', 'cell-hover': '#24398a' };
  const hexRgb = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 1 });
  const under = e => {
    const stack = [];
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      {
        if (s.borderImageSource !== 'none' && (n.classList.contains('cat-header') || n.classList.contains('cell'))) { stack.push(hexRgb(n.classList.contains('cat-header') ? TILES['cat-header'] : n.matches(':hover') ? TILES['cell-hover'] : TILES.cell)); break; }
        const c = rgb(s.backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
        if (s.backgroundImage !== 'none' && n.classList.contains('board-grid')) { stack.push(hexRgb('#0d1b4c')); break; }
      }
    }
    let base = rgb(getComputedStyle(document.documentElement).backgroundColor);
    if (!base || base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    let c = stack.length && stack[stack.length - 1].a >= 1 ? stack.pop() : base;
    while (stack.length) c = over(stack.pop(), c);
    return c;
  };
  const worst = [];
  if (opts.contrast !== false) all.forEach(e => {
    if (e.closest('[aria-hidden="true"]') || e.closest(':disabled') || e.disabled) return;
    const own = Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    const field = /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && e.type !== 'checkbox' && e.type !== 'radio' && (e.value || '').trim();
    if (!own && !field) return;
    const s = getComputedStyle(e);
    const fg = rgb(s.color), bg = under(e);
    if (!fg) return;
    const eff = over(fg, bg);
    const rr = ratio(eff, bg);
    worst.push([rr, name(e)]);
    if (rr < 4.5) problems.push('contrast ' + rr.toFixed(2) + ' < 4.5: ' + name(e) + ' ' + s.color + ' on rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')');
  });
  return { problems, texts: worst.length };
}})`;
const check = (roots, opts) => page.evaluate(`(${IN_PAGE})(${JSON.stringify(roots)}, ${JSON.stringify(opts || {})})`);
const px = (sel, prop) => page.evaluate(([s, p]) => { const n = document.querySelector(s); return n ? parseFloat(getComputedStyle(n)[p || 'fontSize']) : NaN; }, [sel, prop]);

const BOARD_ROOTS = ['#boardTitle', '#scoreboard', '.board-grid'];
const BOARD_GROUPS = ['#scoreboard > *', '.cat-header', '.cell:not(.blank)'];
const OVERLAY_GROUPS = ['#overlay > *', '#overlay .award-row > *', '#overlay .overlay-actions > *', '#overlay .eta-teams > *', '#roundOverlay .round-box > *', '#roundOverlay .eta-teams > *', '#roundOverlay .award-row > *', '#roundOverlay .overlay-actions > *'];

/* A state, checked at both sizes in both themes. `floors` is [selector, key] pairs. */
async function state(label, setup, roots, groups, floors, opts) {
  for (const [w, h] of SIZES) {
    await setSize(w, h);
    const k = h / 720;
    if (setup) await setup();
    for (const theme of ['light', 'dark']) {
      await setTheme(theme);
      const where = `${label} at ${w}x${h}, ${theme}`;
      const r = await check(roots, Object.assign({ groups }, opts || {}));
      eq(r.problems, [], `${where}: nothing clipped, overlapping or under 4.5:1 (${r.texts} texts)`);
      if (theme === 'light') for (const [sel, key] of floors || []) {
        const got = await px(sel);
        ok(got >= Math.floor(FLOORS[key] * k), `${where}: ${sel} is ${got.toFixed(1)}px, the floor for ${key} is ${Math.floor(FLOORS[key] * k)}px`);
      }
    }
    await setTheme('light');
  }
}

/* ── 2. the button, the key, the memory ─────────────────────────────────── */
if (want(2)) {
  console.log('2. the button, the P key, Leave, and the memory');
  await openWith(page, URL_PAGE, withBank(OLD_BOARD));
  const before = await boardStorage(page);
  const KEYS = ['gvb-review-board:current', 'gvb-review-board:data:Rivers', 'gvb-review-board:list'];
  eq([await pressed(), await bodyClass(), await keysOf(), await page.evaluate(k => sessionStorage.getItem(k), PJ_KEY)], ['false', null, KEYS, null], 'a tab that never turned it on: not pressed, no class on <body>, nothing stored');
  const exportOff = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
  await click('#projectorBtn');
  eq([await pressed(), await bodyClass()], ['true', 'projector'], 'the button turns it on: pressed, one class on <body>');
  eq(await page.evaluate(k => sessionStorage.getItem(k), PJ_KEY), '1', 'and it is kept for the tab, under this tool\'s own key');
  eq(await boardStorage(page), before, 'and not one byte of localStorage changed (a key there needs a registry row; see rgb-store.js)');
  eq(await downloadText(page, '#exportBoardBtn', { what: 'the board file' }), exportOff, 'a board file is the same file with it on: the view is not in a board');
  ok(await page.isVisible('#projectorLeaveBtn'), 'a Leave projector view button is in the teacher\'s row');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  eq([await pressed(), await bodyClass()], ['true', 'projector'], 'a reload keeps it on');
  await page.focus('#projectorLeaveBtn');
  await press('Enter');
  eq([await pressed(), await bodyClass(), await keysOf(), await page.evaluate(k => sessionStorage.getItem(k), PJ_KEY), await page.evaluate(() => document.activeElement.id)], ['false', null, KEYS, null, 'projectorBtn'], 'Leave turns it off, removes the key and the class, and the focus goes back to the button');
  eq(await page.locator('#projectorLeaveBtn').count(), 0, 'and the Leave button is gone');
  await page.evaluate(() => document.activeElement.blur());
  await press('p');
  eq(await pressed(), 'true', 'P turns it on');
  await press('p');
  eq(await pressed(), 'false', 'and P turns it off again');
  await page.focus('#boardName').catch(() => {});
  await page.focus('#lightningRoundSeconds');
  await press('p');
  eq(await pressed(), 'false', 'P typed into a field does nothing');
  await page.evaluate(() => document.activeElement.blur());
  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 150);
  await press('p');
  eq(await pressed(), 'false', 'P does nothing while a clue is open');
  await press('Escape');
  /* on, then off, is the page it was */
  await click('#projectorBtn');
  await click('#projectorBtn');
  await openWith(page, URL_PAGE, withBank(OLD_BOARD));
  await click('#projectorBtn');
  await click('#projectorBtn');
  const back = await page.evaluate(() => [document.documentElement.className, document.body.getAttribute('class'), document.body.getAttribute('style'), document.getElementById('boardCard').outerHTML, document.getElementById('overlay').outerHTML].join('\n'));
  await openWith(page, URL_PAGE, withBank(OLD_BOARD));
  const never = await page.evaluate(() => [document.documentElement.className, document.body.getAttribute('class'), document.body.getAttribute('style'), document.getElementById('boardCard').outerHTML, document.getElementById('overlay').outerHTML].join('\n'));
  ok(back === never, 'on and then off, the board card, the overlay and the classes are byte for byte what they were');
  /* per tab: a fresh context knows nothing */
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(URL_PAGE, { waitUntil: 'networkidle' });
  eq(await p2.evaluate(() => document.body.classList.contains('projector')), false, 'another browser profile or tab starts with it off');
  await other.close();
}

/* ── 3 to 5. the type, the boxes and the colours, in every mode ─────────── */
if (want(3)) {
  console.log('3. the board, in the stress case: six teams, a 56-character category, a 30-character word');
  await openStress();
  eq(await bodyClass(), 'projector', 'the view is on, from the stored key');
  await state('the board', null, BOARD_ROOTS, BOARD_GROUPS, [['.cat-header', 'category'], ['.cell:not(.used)', 'value'], ['.team-chip .score', 'score'], ['.team-chip input', 'teamName']]);
  await openStress(TYPICAL_BOARD);
  for (const [w, h] of SIZES) {
    await setSize(w, h);
    await page.evaluate(() => document.getElementById('boardCard').scrollIntoView({ block: 'start' }));
    await settle(page, 100);
    const r = await page.evaluate(() => { const g = document.querySelector('.board-grid').getBoundingClientRect(), s = document.getElementById('scoreboard').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(g.bottom), h: innerHeight }; });
    ok(r.bottom <= r.h, `a typical board (four teams, five by five) fits ${w}x${h} without scrolling: scores from ${r.top}px, grid ends at ${r.bottom}px of ${r.h}px`);
  }
}

if (want(4)) {
  console.log('4. a clue, its answer, the Daily Double wager and the every-team marking');
  const longClue = async () => { await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=10'); await settle(page, 200); };
  await openStress();
  await state('the long clue', async () => { if (await page.evaluate(() => document.getElementById('overlay').classList.contains('show'))) await press('Escape'); await longClue(); }, ['#overlay'], OVERLAY_GROUPS, [['#overlayQuestion', 'clueLong'], ['#overlayCatPoints', 'category']]);
  eq(await page.evaluate(() => document.getElementById('overlay').classList.contains('pj-long')), true, 'a 300-character clue takes the long step');
  await state('the long answer and the award buttons', async () => { await press('Space'); }, ['#overlay'], OVERLAY_GROUPS, [['#overlayAnswer', 'answerLong'], ['#awardRow button', 'award']]);
  await press('Escape');
  /* a short clue is bigger than a long one */
  await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=0');
  await settle(page, 200);
  await state('a short clue', null, ['#overlay'], OVERLAY_GROUPS, [['#overlayQuestion', 'clue'], ['#overlayAnswer', 'answer']]);
  await press('Space');
  await state('a short clue and its answer', null, ['#overlay'], OVERLAY_GROUPS, [['#overlayQuestion', 'clue'], ['#overlayAnswer', 'answer']]);
  await press('Escape');
  /* the Daily Double: the second category's 200 */
  await state('the Daily Double wager', async () => { if (await page.evaluate(() => document.getElementById('overlay').classList.contains('show'))) await press('Escape'); await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=6'); await settle(page, 200); }, ['#overlay'], OVERLAY_GROUPS.concat(['#wagerPanel > *']), [['#wagerPanel label', 'label'], ['#wagerStartBtn', 'award']]);
  await press('Escape');
  /* every team answers */
  await openStress(STRESS_BOARD);
  await page.check('#everyTeamToggle');
  await settle(page, 150);
  await state('every-team marking, six teams', async () => { if (await page.evaluate(() => document.getElementById('overlay').classList.contains('show'))) await press('Escape'); await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=0'); await settle(page, 200); await press('Space'); }, ['#overlay'], OVERLAY_GROUPS.concat(['#etaTeams .eta-team label']), [['.eta-team legend', 'label'], ['.eta-team label', 'label'], ['#etaScoreBtn', 'award']]);
}

if (want(5)) {
  console.log('5. the final wager round, quiz-bowl and the wheel');
  await openStress(STRESS_BOARD);
  await page.check('#finalToggle');
  await settle(page, 150);
  await page.selectOption('#finalPick', 'q-c');
  await click('#finalUseBtn');
  await click('#finalStartBtn');
  await state('the final round, wagers', async () => { await settle(page, 100); }, ['#roundOverlay'], OVERLAY_GROUPS, [['#roundHead', 'category'], ['#roundBody label', 'label'], ['#roundBody input', 'label']], { groups: OVERLAY_GROUPS.concat(['#roundBody .eta-teams > *']) });
  await press('Escape');
  await page.check('#quizBowlToggle');
  await settle(page, 150);
  await page.selectOption('#quizBowlSource', await page.evaluate(() => Array.from(document.getElementById('quizBowlSource').options).filter(o => /bank|my/i.test(o.textContent))[0].value)).catch(() => {});
  await click('#quizBowlStartBtn');
  await state('quiz-bowl, the toss-up', async () => { await settle(page, 100); }, ['#roundOverlay'], OVERLAY_GROUPS, [['#roundHead', 'category'], ['#roundQuestion', 'clueLong'], ['#roundBody .award-row button', 'award']]);
  await press('2');
  await state('quiz-bowl, a buzz', async () => { await settle(page, 100); }, ['#roundOverlay'], OVERLAY_GROUPS, [['#roundHead', 'category'], ['#roundActions button', 'award']]);
  await press('Escape');
  /* the wheel */
  await openStress(Object.assign(clone(STRESS_BOARD), { wheel: clone(WHEEL_ON) }));
  await press('s');
  await page.waitForTimeout(400);
  await state('the wheel, after a spin', null, BOARD_ROOTS.concat(['#wheelSetup']), BOARD_GROUPS.concat(['#wheelSetup .wheel-row > *']), [['#wheelStatus', 'label'], ['.cell.wheel-landed', 'value']], { contrast: true });
}

/* a PNG of one flat colour, made here so no file is read and nothing is fetched */
function png(w, h, rgbv) {
  const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgbv).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

/* ── 6. the focus mark ──────────────────────────────────────────────────── */
if (want(6)) {
  console.log('6. a focus mark that can be seen from the back of the room');
  await openStress(TYPICAL_BOARD);
  for (const [w, h] of SIZES) {
    await setSize(w, h);
    const floor = h === 720 ? 4 : 6;
    const probe = async (sel, what) => {
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.focus(sel);
      const r = await page.evaluate(sl => { const n = document.querySelector(sl), s = getComputedStyle(n); return { fv: n.matches(':focus-visible'), width: parseFloat(s.outlineWidth), style: s.outlineStyle, shadow: s.boxShadow }; }, sel);
      ok(r.fv && r.style === 'solid' && r.width >= floor, `${what} at ${w}x${h}: a solid outline of ${r.width}px (floor ${floor}px)`);
      ok(/rgb\(255, 255, 255\)/.test(r.shadow) && /^rgb\(17, 17, 17\)|rgb\(17, 17, 17\)/.test(await page.evaluate(sl => getComputedStyle(document.querySelector(sl)).outlineColor, sel)), `${what} at ${w}x${h}: the ring is two colours, dark inside and white outside, so it shows on the navy and on the paper`);
    };
    await probe('#boardCols .cell:not(.used)', 'a point tile');
    await probe('#scoreboard .team-chip button', 'a score button');
    await probe('#projectorBtn', 'the Projector view button');
    await probe('#dailyDoubleToggle', 'a teacher tick box');
    /* not cut off by the grid it sits in */
    const edge = await page.evaluate(() => {
      const grid = document.querySelector('.board-grid'), cell = document.querySelector('.board-cols .cell'), g = grid.getBoundingClientRect(), c = cell.getBoundingClientRect();
      cell.focus();
      const ring = parseFloat(getComputedStyle(cell).outlineWidth), spread = ring * 2 + 2;
      return { left: c.left - g.left, top: c.top - g.top, spread };
    });
    ok(edge.left >= edge.spread - 0.5 && edge.top >= edge.spread - 0.5, `the first tile's ring (${edge.spread}px out) is inside the grid's own padding (${edge.left.toFixed(1)}px left, ${edge.top.toFixed(1)}px above) at ${w}x${h}`);
  }
  /* by keyboard: Tab from the board lands on tiles in order and shows the ring */
  await setSize(1280, 720);
  await page.focus('#projectorBtn');
  await press('Tab');
  const seen = await page.evaluate(() => { const a = document.activeElement; return { id: a.id || a.tagName, fv: a.matches(':focus-visible') }; });
  ok(seen.fv, 'Tab moves the focus and the new place has the ring on it');
}

/* ── 7. the teacher's controls ──────────────────────────────────────────── */
if (want(7)) {
  console.log("7. the teacher's own controls: small, after the board, reachable by keyboard");
  await openStress(Object.assign(clone(TYPICAL_BOARD), { dailyDoubleEnabled: true, wheel: clone(WHEEL_ON), final: { on: true, question: 'Largest lake?', answer: 'The Caspian' } }));
  for (const [w, h] of SIZES) {
    await setSize(w, h);
    const r = await page.evaluate(() => {
      const grid = document.querySelector('.board-grid').getBoundingClientRect();
      const ids = ['dailyDoubleToggle', 'redrawDailyDoubleBtn', 'lightningRoundToggle', 'lightningRoundSeconds', 'everyTeamToggle', 'finalToggle', 'quizBowlToggle', 'wheelToggle', 'finalQuestion', 'finalStartBtn', 'wheelSpinBtn', 'projectorLeaveBtn'];
      return ids.map(id => { const n = document.getElementById(id), s = getComputedStyle(n), b = n.getBoundingClientRect(); return { id, shown: !!b.width && s.visibility !== 'hidden', tab: n.tabIndex >= 0 && !n.disabled, after: b.top >= grid.bottom - 1, size: parseFloat(s.fontSize) }; });
    });
    eq(r.filter(x => !x.shown || !x.tab).map(x => x.id), [], `every teacher control is on screen and in the Tab order at ${w}x${h}`);
    eq(r.filter(x => !x.after).map(x => x.id), [], `and every one sits after the board at ${w}x${h}`);
    ok(r.every(x => x.size <= 17), `and each is in small type (largest ${Math.max(...r.map(x => x.size))}px) at ${w}x${h}`);
  }
  /* Tab from the first tile reaches the toggles */
  await page.focus('#boardCols .cell:not(.used)');
  const reached = new Set();
  for (let i = 0; i < 120; i++) { await page.keyboard.press('Tab'); reached.add(await page.evaluate(() => document.activeElement.id)); }
  for (const id of ['dailyDoubleToggle', 'lightningRoundSeconds', 'wheelToggle', 'finalStartBtn', 'wheelSpinBtn', 'projectorLeaveBtn']) ok(reached.has(id), `Tab reaches #${id}`);
}

/* ── 8. nothing is told by colour alone ─────────────────────────────────── */
if (want(8)) {
  console.log('8. nothing is told by colour alone');
  await openStress(Object.assign(clone(STRESS_BOARD), { wheel: clone(WHEEL_ON) }));
  const used = await page.evaluate(() => { const n = document.querySelector('.cell.used'), s = getComputedStyle(n); return { line: s.textDecorationLine, disabled: n.disabled, text: n.textContent }; });
  ok(/line-through/.test(used.line) && used.disabled && used.text === '400', `a played tile is struck through, disabled and still reads 400, as well as dim (${used.line})`);
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    const c = await page.evaluate(() => { const n = document.querySelector('.cell.used'), s = getComputedStyle(n); const p = x => x.match(/[\d.]+/g).slice(0, 3).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const L = c => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); const a = L(p(s.color)), b = L(p(s.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
    ok(c >= 4.5, `a played tile's number is ${c.toFixed(2)}:1 on its tile (${theme}); it is a disabled control, which the sweep skips, so it is measured here`);
  }
  await setTheme('light');
  eq(await page.evaluate(() => Array.from(document.querySelectorAll('.team-chip .score')).map(n => n.textContent).join(',')), '1200,-350,0,800,100,14500', 'a score below zero carries its minus sign');
  await press('s');
  await page.waitForTimeout(300);
  await page.evaluate(() => document.activeElement.blur());
  const landed = await page.evaluate(() => { const n = document.querySelector('.cell.wheel-landed'); if (!n) return null; const s = getComputedStyle(n), b = getComputedStyle(n, '::before'); return { outline: s.outlineStyle, arrow: b.content, label: n.getAttribute('aria-label') }; });
  ok(landed && landed.outline === 'dashed' && /25B6|▶/i.test(landed.arrow), `the tile the wheel chose has a dashed outline (when it does not have the focus, which has its own ring) and an arrow (${JSON.stringify(landed)})`);
  ok(await page.evaluate(() => document.getElementById('wheelStatus').textContent.length > 10), 'and the result is said in words');
  await press('Escape');
  /* every-team marking: a mark is a labelled radio, in words */
  await page.check('#everyTeamToggle');
  await settle(page, 100);
  await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=0').catch(() => {});
  await settle(page, 200);
  if (await page.evaluate(() => document.getElementById('overlay').classList.contains('show'))) {
    await press('Space');
    const marks = await page.evaluate(() => Array.from(document.querySelectorAll('#etaTeams input[type="radio"]')).map(r => (r.labels[0] ? r.labels[0].textContent.trim() : '')));
    ok(marks.length === 18 && marks.every(t => /^(Right|Wrong|No answer)$/.test(t)), 'every mark on every team is a radio with Right, Wrong or No answer beside it');
    await press('Escape');
  }
  /* the lightning countdown running low is underlined as well as red */
  await page.evaluate(() => { const c = document.getElementById('overlayCountdown'); c.classList.add('show', 'low'); document.getElementById('overlay').classList.add('show'); });
  ok(/underline/.test(await page.evaluate(() => getComputedStyle(document.getElementById('overlayCountdown')).textDecorationLine)), 'a countdown that is running low is underlined as well as red');
}

/* ── 9. a picture on a clue ─────────────────────────────────────────────── */
if (want(9)) {
  console.log('9. a clue picture keeps its shape and fits');
  const SHAPES = { tall: [300, 900], wide: [1600, 400], square: [600, 600] };
  for (const [kind, [iw, ih]] of Object.entries(SHAPES)) {
    const board = clone(TYPICAL_BOARD);
    board.categories[0].clues[0].image = png(iw, ih, [200, 60, 40]);
    board.categories[0].clues[1].image = png(iw, ih, [40, 60, 200]);
    board.categories[0].clues[1].question = LONG_CLUE;
    board.categories[0].clues[1].answer = LONG_ANSWER;
    for (const [w, h] of SIZES) {
      await openStress(board);
      await page.waitForFunction(() => window.__clueImagesSettled === true);
      await setSize(w, h);
      for (const [idx, label] of [[0, 'a short clue'], [5, 'a long clue']]) {
        await page.click(`#boardCols .cell >> nth=${idx}`);
        await settle(page, 250);
        await press('Space');
        const m = await page.evaluate(() => { const i = document.getElementById('overlayImage'), r = i.getBoundingClientRect(), cs = getComputedStyle(i), px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); return { shown: i.classList.contains('show'), w: r.width - px, h: r.height - py, nw: i.naturalWidth, nh: i.naturalHeight, top: r.top, left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, fit: getComputedStyle(i).objectFit }; });
        const where = `${kind} picture, ${label}, at ${w}x${h}`;
        ok(m.shown && m.nw === iw && m.nh === ih, `${where}: the picture is shown at its own size ${m.nw}x${m.nh}`);
        ok(Math.abs(m.w / m.h - iw / ih) / (iw / ih) < 0.015, `${where}: its box keeps the shape ${(iw / ih).toFixed(2)} (drawn ${(m.w / m.h).toFixed(2)})`);
        ok(m.left >= 0 && m.right <= m.vw && m.bottom <= m.vh + 1 && m.top >= -1, `${where}: it is on the screen (${Math.round(m.left)}-${Math.round(m.right)} across, ${Math.round(m.top)}-${Math.round(m.bottom)} down)`);
        ok(m.h <= m.vh * 0.34 + 1, `${where}: it is at most a third of the height (${Math.round(m.h)}px of ${m.vh}px)`);
        const r = await check(['#overlay'], { groups: OVERLAY_GROUPS });
        eq(r.problems, [], `${where}: nothing clipped, overlapping or under 4.5:1`);
        await press('Escape');
      }
    }
  }
}

/* ── 10. play is unchanged ──────────────────────────────────────────────── */
if (want(10)) {
  console.log('10. play, print and axe');
  const play = async on => {
    await openWith(page, URL_PAGE, withBank(OLD_BOARD));
    if (on) await turnOnForTab();
    await page.click('#boardCols .cell:not(.used):not(.blank)');
    await settle(page, 150);
    await press('Space');
    await press('2');
    await page.click('#scoreboard .team-chip:nth-child(1) button:nth-of-type(2)');
    await page.click('#scoreboard .team-chip:nth-child(3) button:nth-of-type(1)');
    await settle(page, 150);
    return JSON.parse(await boardStorage(page));
  };
  const off = await play(false), on = await play(true);
  eq(on, off, 'the same keys and clicks leave the same stored board with the view on and off');
  eq(JSON.parse(on[1][1]).teams.map(t => t.score), [110, 100, -20], 'and that board is the game that was played (Herons right, Otters +10, Finches -10)');
  /* print media: none of the view's rules apply */
  await openStress(STRESS_BOARD);
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  const printed = await page.evaluate(() => ({ u: getComputedStyle(document.body).getPropertyValue('--u').trim(), ring: getComputedStyle(document.body).getPropertyValue('--pj-ring').trim(), pad: getComputedStyle(document.body).paddingTop }));
  eq([printed.u, printed.ring], ['', ''], 'in print media the view\'s unit is not even defined');
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  /* axe over the play screen, clue and rounds, light and dark */
  await setSize(1280, 720);
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    const scan = await a11yScan(page, { include: '#boardCard' });
    eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], `the play screen is clean under axe (${theme})`);
  }
  await page.click('#boardCols .cell:not(.used):not(.blank) >> nth=10');
  await settle(page, 200);
  await press('Space');
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    const scan = await a11yScan(page, { include: '#overlay' });
    eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], `the clue overlay is clean under axe (${theme})`);
  }
  await press('Escape');
  await setTheme('light');
}

/* ── done ───────────────────────────────────────────────────────────────── */
ok(!(page.__errs || []).length, 'no page errors, console errors or failed requests');
if (page.__errs && page.__errs.length) console.log(page.__errs.slice(0, 5));
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
