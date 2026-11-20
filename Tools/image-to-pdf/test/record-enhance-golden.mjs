// record-enhance-golden.mjs — writes golden-enhance.json, what 011's own enhanceCanvas() produces
// on smoke-enhance.mjs's board (Path 17 P2, AI-38). Needs a browser, so it is NOT in CI and not in
// suites.json: scan.test.mjs reads the file it writes.
//
//   node Tools/image-to-pdf/test/record-enhance-golden.mjs
//   PW_CHROMIUM_EXECUTABLE=<chrome> node ...        where Playwright's own browser is missing
//
// The page's function is cut out of Tools/011-image-to-pdf.html (ENHANCE_PRESETS through the end of
// enhanceCanvas) and run in an empty page on the board, so the table is the page's code as it is on
// the branch, not a copy of it. Samples every 5 px (80 x 60 points, RGB) per preset, base64.
// Re-run it only when enhanceCanvas() itself is changed on purpose, and commit the new table in
// the same commit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../../board-check/harness.mjs';
import { enhanceBoard, BOARD_W, BOARD_H } from './make-scan-fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', '..', '011-image-to-pdf.html'), 'utf8');
const a = html.indexOf('const ENHANCE_PRESETS = {');
const bMarker = 'function enhanceMode()';
const b = html.indexOf(bMarker);
if (a < 0 || b < 0 || b < a) throw new Error('could not find enhanceCanvas in 011-image-to-pdf.html');
const code = html.slice(a, b);

const STRIDE = 5;
const board = enhanceBoard();
const browser = await launch();
const page = await browser.newPage();
const out = await page.evaluate(({ code, rgba, W, H, STRIDE }) => {
  const run = new Function('canvas', 'ctx', 'mode', code + '; enhanceCanvas(canvas, ctx, mode);');
  const res = {};
  for (const mode of ['whiteboard', 'worksheet']) {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), W, H), 0, 0);
    run(canvas, ctx, mode);
    const d = ctx.getImageData(0, 0, W, H).data;
    const bytes = [];
    for (let y = 2; y < H; y += STRIDE) for (let x = 2; x < W; x += STRIDE) {
      const o = (y * W + x) * 4; bytes.push(d[o], d[o + 1], d[o + 2]);
    }
    res[mode] = btoa(String.fromCharCode(...bytes));
  }
  return res;
}, { code, rgba: Array.from(board.data), W: BOARD_W, H: BOARD_H, STRIDE });
await browser.close();

const golden = {
  note: "Chromium's output of 011's enhanceCanvas() on make-scan-fixtures.mjs's enhanceBoard(), sampled at x, y = 2, 2+stride, ... (RGB bytes, row-major, base64). Written by record-enhance-golden.mjs.",
  width: BOARD_W, height: BOARD_H, offset: 2, stride: STRIDE, ...out,
};
fs.writeFileSync(path.join(here, 'golden-enhance.json'), JSON.stringify(golden) + '\n');
console.log('wrote golden-enhance.json', Object.keys(out).map(k => k + ' ' + out[k].length).join(', '));
