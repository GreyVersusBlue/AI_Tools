// smoke-stage.mjs — 024 on _shared/stage.js (Path 5 P2): real fullscreen in
// a real browser, the refused-fullscreen fallback, and a keyboard-only run.
//
//   node Tools/number-talks-board/test/smoke-stage.mjs
//
// 024 is the single adopter of the stage helper, so this is where the parts
// a Node suite cannot prove are proven: that the browser actually grants
// fullscreen on #stageArea when the button is clicked, that the reveal row
// (inside #stageArea by design) is still there to press, that Space reveals
// the next expression ON stage and does nothing OFF it, and that when the
// browser refuses fullscreen the stage still fills the viewport and Escape
// gets the teacher out. The last section is a keyboard-only run-through —
// F, Space, Space, F — because the point of the hotkeys is a teacher at the
// board with no mouse.
//
// Headless Chromium grants requestFullscreen from a click (verified before
// this suite was written); a Playwright keyboard Escape does NOT exit real
// fullscreen (that is the browser's own key), so the real-fullscreen exit is
// driven by the Exit button and the fallback's Escape by the helper.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8408;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/024-number-talks-board.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Number Talks — the shared fullscreen stage (Path 5 P2)');

/** Puts a four-expression string on the board (a random draw can be a single
    expression, which leaves nothing for Space to reveal) and blurs the button. */
async function startString(page) {
  await page.fill('#customInput', '1 + 1\n2 + 2\n3 + 3\n4 + 4');
  await page.click('#useCustomBtn');
  await page.evaluate(() => document.activeElement.blur());
  await settle(page, 200);
}

const state = page => page.evaluate(() => ({
  fs: document.fullscreenElement ? document.fullscreenElement.id : null,
  cls: document.getElementById('stageArea').className,
  body: document.body.classList.contains('stage-presenting'),
  enterHidden: document.getElementById('fullscreenBtn').hidden,
  exitHidden: document.getElementById('exitFullscreenBtn').hidden,
  revealed: document.querySelectorAll('#stage .expr-line').length,
  revealBtnInStage: document.getElementById('stageArea').contains(document.getElementById('revealBtn')),
}));

/* ── 1. real fullscreen from the button; the reveal row stays reachable ── */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  ok(await page.evaluate(() => !!window.Stage), '1: _shared/stage.js is loaded');
  let s = await state(page);
  eq(s.fs, null, '1: not fullscreen at load');
  eq(s.cls, '', '1: no stage class at load');
  ok(!s.enterHidden && s.exitHidden, '1: Fullscreen shown, Exit hidden');
  ok(s.revealBtnInStage, '1: the reveal row lives inside #stageArea, so it survives fullscreen');

  await startString(page);
  const before = (await state(page)).revealed;
  await page.keyboard.press('Space');
  await settle(page, 150);
  eq((await state(page)).revealed, before, '1: OFF stage, Space does not reveal (hotkeysWhenActive)');
  await page.focus('#customInput');
  await page.keyboard.press('f');
  await settle(page, 200);
  eq((await state(page)).fs, null, '1: F while typing in the custom-string box is a letter, not a hotkey');
  await page.evaluate(() => document.activeElement.blur());

  await page.click('#fullscreenBtn');
  await settle(page, 300);
  s = await state(page);
  eq(s.fs, 'stageArea', '1: the button puts #stageArea into real fullscreen');
  eq(s.cls, 'is-fullscreen', '1: #stageArea carries is-fullscreen and NOT stage-fallback');
  ok(s.body, '1: body carries stage-presenting');
  ok(s.enterHidden && !s.exitHidden, '1: the buttons swap');
  const box = await page.evaluate(() => { const r = document.getElementById('stageArea').getBoundingClientRect(); return [r.width, r.height]; });
  ok(box[0] >= 1270 && box[1] >= 890, `1: the stage fills the viewport (${box.join('x')})`);

  await page.keyboard.press('Space');
  await settle(page, 200);
  eq((await state(page)).revealed, before + 1, '1: ON stage, Space reveals the next expression');
  await page.keyboard.press('ArrowRight');
  await settle(page, 200);
  eq((await state(page)).revealed, before + 2, '1: so does Right');

  const violations = await a11yScan(page, { include: '#stageArea' });
  ok(violations.length === 0, '1: axe finds nothing serious on the stage while on it: ' + JSON.stringify(violations.map(v => v.id)));

  await page.click('#exitFullscreenBtn');
  await settle(page, 300);
  s = await state(page);
  eq(s.fs, null, '1: Exit leaves fullscreen');
  eq(s.cls, '', '1: the class is gone');
  ok(!s.body && !s.enterHidden && s.exitHidden, '1: body class and buttons restored');
  await page.close();
}

/* ── 2. the browser refuses: the fallback fills the screen; Escape exits ── */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function () { return Promise.reject(new TypeError('Fullscreen request denied')); };
  });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  // the control panel is OUTSIDE #stageArea, so once the fallback overlay is
  // up it is unreachable — exactly as in real fullscreen. Start the talk first.
  await startString(page);
  const before = (await state(page)).revealed;
  await page.click('#fullscreenBtn');
  await settle(page, 300);
  let s = await state(page);
  eq(s.fs, null, '2: no real fullscreen');
  eq(s.cls, 'is-fullscreen stage-fallback', '2: #stageArea carries is-fullscreen AND stage-fallback');
  ok(s.enterHidden && !s.exitHidden && s.body, '2: buttons and body class as on a real stage');
  const box = await page.evaluate(() => { const r = document.getElementById('stageArea').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  ok(box[0] === 0 && box[1] === 0 && box[2] >= 1270 && box[3] >= 890, `2: the fallback fills the viewport (${box.join(',')})`);
  await page.keyboard.press('Enter');
  await settle(page, 200);
  eq((await state(page)).revealed, before + 1, '2: Enter reveals on the fallback stage too');
  await page.keyboard.press('Escape');
  await settle(page, 200);
  s = await state(page);
  eq(s.cls, '', '2: Escape exits the fallback');
  ok(!s.enterHidden && s.exitHidden && !s.body, '2: and everything is restored');
  await page.close();
}

/* ── 3. keyboard only: F, Space, Space, F — a teacher at the board ─────── */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await startString(page);
  const before = (await state(page)).revealed;
  await page.keyboard.press('f');
  await settle(page, 300);
  eq((await state(page)).fs, 'stageArea', '3: F enters fullscreen');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await settle(page, 200);
  eq((await state(page)).revealed, before + 2, '3: two Spaces, two more expressions');
  await page.keyboard.press('Shift+F');
  await settle(page, 300);
  const s = await state(page);
  eq(s.fs, null, '3: Shift+F exits');
  eq(s.cls, '', '3: clean');
  await page.keyboard.press('Control+f');
  await settle(page, 200);
  eq((await state(page)).fs, null, '3: Ctrl+F is the browser\'s find, not ours');
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
