// smoke-stage-rollout.mjs — the three tools that adopted _shared/stage.js after
// 024 (Path 5 P2's remaining "known copies"): 021, 023 and 025.
//
//   node Tools/stage/test/smoke-stage-rollout.mjs      (or: npm run test:stage)
//
// 024's own suite (Tools/number-talks-board/test/smoke-stage.mjs) proves the
// helper's behaviour in depth on one page. This one proves the *adoption* on
// the other three, which is a different claim and has its own ways to go
// wrong. For each page it drives the real browser and checks:
//
//   - the page loads the helper and no longer hand-rolls requestFullscreen;
//   - the button really fullscreens the stage element, and the CSS that used
//     to hang off `:fullscreen` now fires — measured as the stage filling the
//     viewport, because that is what those rewritten rules do;
//   - the toggle button is REACHABLE while on stage. This is the wrinkle the
//     platform notes record being rediscovered four times: the Fullscreen API
//     renders only the fullscreened subtree, so 023's and 025's buttons — both
//     outside their stage in the markup — had to be moved in with `hud`, and
//     have to come back out on exit;
//   - F enters and exits, and F while the teacher is typing does not;
//   - axe finds nothing serious ON the stage, scanned in that state, which is
//     a state the site-wide sweep never reaches;
//   - the refused-fullscreen fallback fills the viewport and Escape leaves it —
//     none of these three had any fallback before, so a browser that says no
//     used to leave the button doing nothing at all.
//
// 023 and 025 each have TWO stages, gated by `enabled`, so both are driven:
// 023's Discussion Board on its own tab, and 025's Anonymous Responses overlay.
//
// Headless Chromium grants requestFullscreen from a click; a Playwright
// Escape does not exit REAL fullscreen (that key is the browser's own), so
// real exits are driven by the button or F and only the fallback by Escape.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8412;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Stage rollout — 021, 023 and 025 on _shared/stage.js (Path 5 P2)');

/** The state every one of these checks reads, for a given stage + button. */
const readState = (page, stageId, btnId) => page.evaluate(({ stageId, btnId }) => {
  const el = document.getElementById(stageId);
  const btn = document.getElementById(btnId);
  const r = el.getBoundingClientRect();
  return {
    fs: document.fullscreenElement ? document.fullscreenElement.id : null,
    cls: el.className,
    body: document.body.classList.contains('stage-presenting'),
    btnInStage: el.contains(btn),
    btnText: (btn.textContent || '').trim(),
    box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
  };
}, { stageId, btnId });

const fillsViewport = box => box[2] >= 1270 && box[3] >= 890;

/**
 * The run every adopted stage gets: enter by button, assert the class, the
 * body class, the viewport fill and that the button came along; scan with axe;
 * leave by F; then refuse fullscreen and check the fallback plus Escape.
 *
 * `hudded` says whether the button lives outside the stage in the markup and
 * therefore has to be moved in — 021's is already inside its own stage.
 */
async function driveStage(browser, { label, url, stageId, btnId, prep, hudded }) {
  /* ── real fullscreen ── */
  {
    const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await settle(page, 300);
    ok(await page.evaluate(() => !!window.Stage), `${label}: _shared/stage.js is loaded`);
    if (prep) await prep(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());

    let s = await readState(page, stageId, btnId);
    eq(s.fs, null, `${label}: not fullscreen at load`);
    ok(!/is-fullscreen/.test(s.cls), `${label}: no stage class at load (${s.cls})`);
    eq(s.btnInStage, !hudded, `${label}: the button starts ${hudded ? 'outside' : 'inside'} the stage`);
    const home = s.btnText;

    await page.click('#' + btnId);
    await settle(page, 400);
    s = await readState(page, stageId, btnId);
    eq(s.fs, stageId, `${label}: the button puts #${stageId} into real fullscreen`);
    ok(/\bis-fullscreen\b/.test(s.cls) && !/stage-fallback/.test(s.cls),
       `${label}: the stage carries is-fullscreen and not stage-fallback (${s.cls})`);
    ok(s.body, `${label}: body carries stage-presenting`);
    ok(fillsViewport(s.box), `${label}: the rewritten .is-fullscreen CSS fills the viewport (${s.box.join(',')})`);
    ok(s.btnInStage, `${label}: the toggle button is inside the fullscreened subtree, so it is visible`);
    ok(s.btnText !== home && /exit/i.test(s.btnText), `${label}: the button relabelled to "${s.btnText}"`);

    const violations = await a11yScan(page, { include: '#' + stageId });
    ok(violations.length === 0,
       `${label}: axe finds nothing serious on the stage while on it: ` +
       JSON.stringify(violations.map(v => v.id + '×' + v.count)));

    await page.keyboard.press('f');
    await settle(page, 400);
    s = await readState(page, stageId, btnId);
    eq(s.fs, null, `${label}: F leaves fullscreen`);
    ok(!/is-fullscreen/.test(s.cls), `${label}: the class is gone (${s.cls})`);
    ok(!s.body, `${label}: body class restored`);
    eq(s.btnInStage, !hudded, `${label}: the button went back where it came from`);
    eq(s.btnText, home, `${label}: and back to its own label`);
    await page.close();
  }

  /* ── the browser refuses ── */
  {
    const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = function () {
        return Promise.reject(new TypeError('Fullscreen request denied'));
      };
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await settle(page, 300);
    if (prep) await prep(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());

    await page.click('#' + btnId);
    await settle(page, 400);
    let s = await readState(page, stageId, btnId);
    eq(s.fs, null, `${label}: no real fullscreen when the browser refuses`);
    ok(/\bis-fullscreen\b/.test(s.cls) && /stage-fallback/.test(s.cls),
       `${label}: the fallback carries both classes (${s.cls})`);
    ok(s.box[0] === 0 && s.box[1] === 0 && fillsViewport(s.box),
       `${label}: the fallback fills the viewport (${s.box.join(',')}) — this tool had no fallback before`);
    ok(s.btnInStage, `${label}: the button is reachable on the fallback stage too`);

    await page.keyboard.press('Escape');
    await settle(page, 250);
    s = await readState(page, stageId, btnId);
    ok(!/is-fullscreen/.test(s.cls), `${label}: Escape exits the fallback (${s.cls})`);
    ok(!s.body, `${label}: and the body class is gone`);
    await page.close();
  }
}

/* ── 021 — PE Tournament & Station Rotation ───────────────────────────────
   One stage, one button, and the button is already inside the stage. */
await driveStage(browser, {
  label: '021',
  url: BASE + '/Tools/021-pe-tournament-stations.html',
  stageId: 'stage',
  btnId: 'fullscreenBtn',
  hudded: false,
});

/* ── 023 — Exit Ticket Generator, two stages on two tabs ─────────────────── */
await driveStage(browser, {
  label: '023 prompt',
  url: BASE + '/Tools/023-exit-ticket-generator.html',
  stageId: 'stage',
  btnId: 'fullscreenBtn',
  hudded: true,
});
await driveStage(browser, {
  label: '023 discussion',
  url: BASE + '/Tools/023-exit-ticket-generator.html',
  stageId: 'discussionStage',
  btnId: 'discussionFullscreenBtn',
  hudded: true,
  prep: async page => {
    await page.click('.tab-btn[data-tab="discussion"]');
    await settle(page, 200);
  },
});

/* ── 025 — Writing Prompt Generator, prompt stage + anonymous overlay ────── */
await driveStage(browser, {
  label: '025 prompt',
  url: BASE + '/Tools/025-writing-prompt-generator.html',
  stageId: 'stage',
  btnId: 'fullscreenBtn',
  hudded: true,
});
await driveStage(browser, {
  label: '025 anon',
  url: BASE + '/Tools/025-writing-prompt-generator.html',
  stageId: 'anonOverlay',
  btnId: 'anonFsBtn',
  hudded: false,
  prep: async page => {
    await page.fill('#anonList textarea', 'Because the water cycle keeps going.');
    await page.click('#projectAnonBtn');
    await settle(page, 250);
  },
});

/* ── the two-stage gate: F belongs to the stage whose tab (or overlay) is up ─ */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/023-exit-ticket-generator.html', { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.click('.tab-btn[data-tab="triage"]');
  await settle(page, 200);
  await page.keyboard.press('f');
  await settle(page, 300);
  eq(await page.evaluate(() => document.fullscreenElement ? document.fullscreenElement.id : null),
     null, 'gate: on 023\'s Paper Triage tab, F is just a letter — neither stage claims it');

  await page.click('.tab-btn[data-tab="discussion"]');
  await settle(page, 200);
  await page.keyboard.press('f');
  await settle(page, 400);
  eq(await page.evaluate(() => document.fullscreenElement ? document.fullscreenElement.id : null),
     'discussionStage', 'gate: on the Discussion tab, F drives the board and not the prompt stage');
  await page.keyboard.press('f');
  await settle(page, 300);

  // typing must swallow the key on every one of these pages
  await page.click('.tab-btn[data-tab="bank"]');
  await settle(page, 200);
  await page.focus('#customPrompt');
  await page.keyboard.press('f');
  await settle(page, 300);
  eq(await page.evaluate(() => document.fullscreenElement ? document.fullscreenElement.id : null),
     null, 'gate: F typed into 023\'s custom-prompt box is a letter, not a hotkey');
  eq(await page.evaluate(() => document.getElementById('customPrompt').value), 'f',
     'gate: and the letter actually reached the box');
  await page.close();
}

/* ── 025's overlay takes F from the prompt stage while it is open ────────── */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/025-writing-prompt-generator.html', { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.fill('#anonList textarea', 'I would change the ending.');
  await page.click('#projectAnonBtn');
  await settle(page, 250);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('f');
  await settle(page, 400);
  eq(await page.evaluate(() => document.fullscreenElement ? document.fullscreenElement.id : null),
     'anonOverlay',
     '025: with the overlay open, F fullscreens the overlay — the hand-rolled version fullscreened the prompt stage behind it');
  await page.click('#anonCloseBtn');
  await settle(page, 400);
  eq(await page.evaluate(() => document.fullscreenElement ? document.fullscreenElement.id : null),
     null, '025: closing the overlay leaves fullscreen with it');
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
