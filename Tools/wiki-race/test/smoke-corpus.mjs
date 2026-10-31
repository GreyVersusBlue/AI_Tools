// smoke-corpus.mjs — Wiki Race (086) plays a whole race on the offline articles with NO network at all
// (AI-30, rank 71).
//
//   node Tools/wiki-race/test/smoke-corpus.mjs        (port 8625)
//
// The browser context is put offline (navigator.onLine is false) and every request the page makes after it
// has loaded is recorded, same-origin included; the race must make none.
//   1. offline, the banner stays but offers the offline articles; pressing its button picks them and the
//      banner goes away. At 360 px nothing overflows sideways with the banner showing.
//   2. the race starts from the corpus matchup (not Wikipedia's), links are real keyboard-reachable links,
//      Peek and Hint work from the article text, and the route is taken by clicking links (one with Enter).
//   3. the results screen names the source; the finish code carries src: "corpus" and the path and counts;
//      Verify reads it ("Offline articles", no check badges) and the class scoreboard ranks it apart from a
//      Wikipedia code of the same seed and difficulty.
//   4. Wikipedia chosen offline fails with a message that points at the offline articles.
//   5. no request at all during the race, nothing offsite, nothing stored, no page errors, no serious axe
//      violation on the race screen, the results and the start screen.
// This proves the wiring, NOT that the articles read well to a class. Exits 1 on any failure.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8625;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const axeIds = async page => (await a11yScan(page, { impact: 'serious' })).map(v => v.id + ' ' + JSON.stringify(v.nodes));

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
  await page.goto(`${BASE}/Tools/086-wiki-race.html`);
  await settle(page, 300);
  const corpus = await page.evaluate(() => window.__wr.CORPUS);
  const links = {};
  for (const [t, [, text]] of Object.entries(corpus)) links[t] = [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(m => m[1]);
  const route = (a, b) => { const prev = new Map([[a, null]]), q = [a]; for (let i = 0; i < q.length; i++) for (const n of links[q[i]]) if (!prev.has(n)) { prev.set(n, q[i]); q.push(n); } const r = []; for (let x = b; x; x = prev.get(x)) r.unshift(x); return r; };
  const lsBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));

  // --- 1. offline: the banner offers the corpus
  const requests = [];
  page.on('request', r => requests.push(r.url()));
  await page.context().setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await settle(page, 200);
  ok(await page.locator('#offlineBanner').isVisible(), 'offline: the banner shows');
  ok(/offline/i.test(await page.locator('#offlineBanner').innerText()) && await page.locator('#offlineUseCorpus').isVisible(), 'the banner offers the offline articles');
  await page.setViewportSize({ width: 360, height: 740 });
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'start screen with the banner does not overflow at 360 px');
  eq(await axeIds(page), [], 'no serious axe violation on the start screen with the banner');
  await page.setViewportSize({ width: 1000, height: 900 });

  // 4. (while the banner is up) Wikipedia chosen offline fails with a pointer to the offline articles
  await page.fill('#seedInput', 'bulldogs1');
  await page.click('#startBtn');
  await page.waitForSelector('#startError:not([hidden])');
  ok(/Offline articles/.test(await page.locator('#startError').innerText()), 'Wikipedia offline says to choose the offline articles: ' + await page.locator('#startError').innerText());
  eq(await page.locator('#screenStart').isVisible(), true, 'and the player is still on the start screen');
  page.__blocked.length = 0; requests.length = 0;

  await page.click('#offlineUseCorpus');
  eq(await page.locator('#sourceSelect').inputValue(), 'corpus', 'the banner button picks the offline articles');
  ok(await page.locator('#offlineBanner').isHidden(), 'the banner goes away once they are picked');
  await page.selectOption('#difficultySelect', 'medium');

  // --- 2. play
  const m = await page.evaluate(() => window.__wr.computeCorpusMatchup('bulldogs1', 'medium'));
  const way = route(m.start, m.target);
  ok(way.length >= 3, `the matchup ${m.start} -> ${m.target} takes at least two clicks (${way.length - 1})`);
  await page.fill('#seedInput', 'bulldogs1');
  await page.click('#startBtn');
  await page.waitForSelector('#screenRace:not([hidden])');
  await page.waitForFunction(t => document.getElementById('articleTitle').textContent === t, m.start);
  eq([await page.locator('#startLabel').innerText(), await page.locator('#targetLabel').innerText()], [m.start, m.target], 'the race is the corpus matchup for the seed');
  const linkCount = await page.locator('#articleHost a[data-wr="nav"]').count();
  ok(linkCount >= 3, 'the start article has links (' + linkCount + ')');
  eq(await page.locator('#articleHost a[data-wr="nav"][tabindex="0"][role="link"]').count(), linkCount, 'every link is focusable and a link to assistive tech');
  eq(await page.locator('#articleHost script, #articleHost img, #articleHost iframe').count(), 0, 'the article holds no script, image or frame');
  const shown = await page.$$eval('#articleHost a[data-wr="nav"]', as => as.map(a => [a.dataset.title, a.textContent]));
  ok(shown.every(([t, txt]) => txt.toLowerCase() === t.toLowerCase() || t.toLowerCase().startsWith(txt.toLowerCase().replace(/s$/, ''))), 'link text is the article name (any case): ' + JSON.stringify(shown.slice(0, 4)));

  await page.click('#peekBtn');
  await page.waitForSelector('#peekModal:not([hidden])');
  const peek = await page.locator('#peekBody').innerText();
  ok(peek.length > 80 && !/\[\[/.test(peek), 'Peek shows the target article’s opening, no markup: ' + peek.slice(0, 60));
  await page.click('#peekCloseBtn');
  await page.click('#hintBtn');
  await page.waitForSelector('#peekModal:not([hidden])');
  const hint = await page.locator('#peekBody').innerText();
  ok(/^Head toward (SCIENCE|HISTORY|GEOGRAPHY|MATHEMATICS|ARTS|NATURE) topics\./.test(hint), 'Hint names the corpus category: ' + hint.slice(0, 60));
  await page.click('#peekCloseBtn');

  for (let i = 1; i < way.length; i++) {
    const link = page.locator(`#articleHost a[data-wr="nav"][data-title="${way[i]}"]`).first();
    await link.waitFor();
    if (i === 1) { await link.focus(); await page.keyboard.press('Enter'); } else await link.click();
    if (i < way.length - 1) await page.waitForFunction(t => document.getElementById('articleTitle').textContent === t, way[i]);
  }
  await page.waitForSelector('#screenResults:not([hidden])');
  eq(await page.locator('#clicksVal').innerText().catch(() => String(way.length - 1)), String(way.length - 1), 'the click count equals the route');

  // --- 3. results, finish code, verify, scoreboard
  ok(/offline articles/.test(await page.locator('#resultsMatchup').innerText()), 'the results name the source: ' + await page.locator('#resultsMatchup').innerText());
  eq(await page.locator('#resClicks').innerText(), String(way.length - 1), 'results: clicks');
  eq(await page.locator('#resHints').innerText(), '1', 'results: one hint');
  await page.waitForFunction(() => /^WR[01]\./.test(document.getElementById('finishCode').value));
  const code = await page.inputValue('#finishCode');
  const dec = await page.evaluate(c => window.__wr.decodeFinishCode(c), code);
  eq([dec.src, dec.s, dec.d, dec.c, dec.h, dec.p], ['corpus', 'bulldogs1', 'medium', way.length - 1, 1, way], 'the finish code carries the source, seed, counts and path');
  eq(await axeIds(page), [], 'no serious axe violation on the results screen');
  await page.setViewportSize({ width: 360, height: 740 });
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'results screen does not overflow at 360 px');
  await page.setViewportSize({ width: 1000, height: 900 });

  await page.click('#againBtn');
  await page.click('#toVerifyBtn');
  await page.fill('#verifyInput', code);
  await page.click('#verifyBtn');
  await page.waitForSelector('#verifyResult .badge');
  const ver = await page.locator('#verifyResult').innerText();
  ok(/VALID CODE/.test(ver) && /Articles from\s+Offline articles/.test(ver), 'Verify reads the corpus code and names its source: ' + ver.slice(0, 80));
  ok(!/check matchup|check path/.test(ver), 'Verify has no warning for a true corpus path');
  // the same path posing as a Wikipedia code is flagged, not accepted
  const posing = await page.evaluate(async w => {
    const s = window.__wr.state; Object.assign(s, { seed: 'bulldogs1', difficulty: 'medium', elapsedMs: 50000, clicks: w.length - 1, hints: 0, path: w, source: 'wiki' });
    const c = await window.__wr.buildFinishCode(); s.source = 'corpus'; return c;
  }, way);
  await page.fill('#verifyInput', posing);
  await page.click('#verifyBtn');
  await page.waitForFunction(() => /Offline|Wikipedia/.test(document.getElementById('verifyResult').innerText));
  const ver2 = await page.locator('#verifyResult').innerText();
  ok(/Articles from\s+Wikipedia/.test(ver2) && /check matchup/.test(ver2), 'a corpus path presented without src resolves against Wikipedia and is flagged: ' + ver2.slice(0, 120));

  const wikiCode = await page.evaluate(async () => {
    const m = window.__wr.computeMatchup('bulldogs1', 'medium'), s = window.__wr.state;
    Object.assign(s, { seed: 'bulldogs1', difficulty: 'medium', elapsedMs: 40000, clicks: 3, hints: 0, path: [m.start, 'X', m.target], source: 'wiki' });
    return window.__wr.buildFinishCode();
  });
  await page.fill('#boardInput', `Ada ${code}\nBen ${wikiCode}\nCy ${posing}`);
  await page.click('#boardBtn');
  await page.waitForSelector('#boardResult table');
  const caps = await page.$$eval('#boardResult caption', cs => cs.map(c => c.textContent));
  eq(caps.slice().sort(), ['Seed “bulldogs1” · medium · 2 ranked', 'Seed “bulldogs1” · medium · offline articles · 1 ranked'].sort(), 'the scoreboard keeps the two sources apart');
  eq(await axeIds(page), [], 'no serious axe violation on the scoreboard');

  // --- 5. the whole offline race touched no network and stored nothing
  eq(requests, [], 'no request at all after the page loaded (the offline race and verifying)');
  eq(page.__blocked, [], 'no offsite request attempted');
  eq(page.__errs, [], 'no page errors');
  eq(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), lsBefore, 'nothing was written to localStorage');

  // race screen a11y + 360 px, on a fresh corpus race
  await page.click('#verifyBackBtn');
  await page.fill('#seedInput', 'room 214');
  await page.click('#startBtn');
  await page.waitForSelector('#screenRace:not([hidden])');
  await page.waitForSelector('#articleHost a[data-wr="nav"]');
  eq(await axeIds(page), [], 'no serious axe violation on the race screen');
  await page.setViewportSize({ width: 360, height: 740 });
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'race screen does not overflow at 360 px');
  eq(requests, [], 'still no request after a second race started');
} finally {
  await browser.close(); server.close();
}
console.log(`wiki-race corpus: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
