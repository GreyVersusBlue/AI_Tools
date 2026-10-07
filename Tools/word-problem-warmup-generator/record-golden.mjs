// record-golden.mjs — records what the page makes for pinned seeds, as hashes.
//
//   node Tools/word-problem-warmup-generator/record-golden.mjs > Tools/word-problem-warmup-generator/test/golden-old-sets.json
//
// Run once against the page BEFORE the two-step change (2026-10-07, 1aaee05) to
// make golden-old-sets.json; smoke-two-step.mjs compares today's page with it.
// Kept so the recording is repeatable: it loads each case through a saved
// setting with the seed locked, which is how a teacher's own reprint works.
import crypto from 'node:crypto';
import { serve, launch, prepPage } from '../board-check/harness.mjs';

const PORT = 8511;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/081-word-problem-warmup-generator.html';
const SEEDS = [1, 7, 42, 20260812, 305419896, 3735928559, 4294967295];
const OPS = [['addition', 'subtraction', 'multiplication', 'division'], ['addition'], ['subtraction', 'division'], ['multiplication', 'division']];
const server = await serve(PORT);
const browser = await launch();
const cases = [];
for (const band of ['middle', 'elementary']) {
  for (const ops of OPS) {
    for (const seed of SEEDS) {
      for (const count of [6, 20]) {
        const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
        const saved = JSON.stringify({ seed, gradeBand: band, ops, problemCount: count, lockSeed: true });
        await page.addInitScript(s => localStorage.setItem('wpwg_settings_v1', s), saved);
        await page.goto(PAGE);
        const got = await page.evaluate(() => ({
          problems: [...document.querySelectorAll('#sheetProblems .problem')].map(e => e.textContent),
          key: [...document.querySelectorAll('#sheetKey li')].map(e => e.textContent),
          first: document.getElementById('displayText').textContent,
          answer: document.getElementById('displayAnswer').textContent,
          seed: document.getElementById('seedDisplay').value,
          stored: localStorage.getItem('wpwg_settings_v1'),
        }));
        cases.push({ band, ops, seed, count, n: got.problems.length, seedShown: got.seed,
          sha256: crypto.createHash('sha256').update(JSON.stringify([got.problems, got.key, got.first, got.answer])).digest('hex'),
          storedSha256: crypto.createHash('sha256').update(got.stored).digest('hex'), firstProblem: got.problems[0] });
        await page.context().close();
      }
    }
  }
}
await browser.close(); server.close();
console.log(JSON.stringify({ recordedFrom: '1aaee05, before two-step', cases }, null, 1));
