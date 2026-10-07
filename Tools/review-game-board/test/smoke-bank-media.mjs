// smoke-bank-media.mjs — a question in the bank can carry a picture (Path 12
// P4), and a bank or a board from before that is exactly what it was.
//
//   node Tools/review-game-board/test/smoke-bank-media.mjs            (port 8523)
//   node Tools/review-game-board/test/smoke-bank-media.mjs --print    writes the golden
//
// The golden (golden-before-media.json) was made with --print against the
// v287 page BEFORE it was edited; _before-media.mjs is what was played.
// Every question, name and picture is made up. Exits 1 on any failure.

import { readFileSync, writeFileSync } from 'node:fs';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';
import { playBefore, sha } from './_before-media.mjs';

const PORT = 8523;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const GOLDEN = new URL('./golden-before-media.json', import.meta.url);
const PRINT = process.argv.includes('--print');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

const server = await serve(PORT);
const browser = await launch();
const errors = [];
const newPage = async () => {
  const p = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  p.on('dialog', d => d.accept().catch(() => {}));
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
};

console.log('Review Game Board — pictures on bank questions');

/* ── 0. a bank and a board from before today ────────────────────────────── */
{
  const page = await newPage();
  const got = await playBefore(page, URL_PAGE);
  const hashes = {};
  Object.keys(got).forEach(k => { hashes[k] = sha(got[k]); });
  if (PRINT) {
    writeFileSync(GOLDEN, JSON.stringify(hashes, null, 2) + '\n');
    console.log('wrote ' + Object.keys(hashes).length + ' hashes to golden-before-media.json');
  } else {
    const want = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    Object.keys(want).forEach(k => ok(hashes[k] === want[k], `before today: ${k} is what the v287 page gave (got ${hashes[k]}, want ${want[k]})`));
    ok(Object.keys(hashes).length === Object.keys(want).length, 'and nothing is captured that the golden does not hold');
  }
  await page.context().close();
}

if (!PRINT) await (await import('./_bank-media-new.mjs')).run({ newPage, ok, URL_PAGE, BASE });

ok(errors.length === 0, 'no console or page error (' + errors.slice(0, 3).join(' | ') + ')');
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
