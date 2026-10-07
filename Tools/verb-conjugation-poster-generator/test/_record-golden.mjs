// _record-golden.mjs — writes golden-old-posters.json from the page it is pointed at.
//
//   node Tools/verb-conjugation-poster-generator/test/_record-golden.mjs   (port 8511)
//
// Run ONCE, against the page at 1aaee05 (before the irregular call-out boxes),
// and not again: the file is what "a poster saved before the boxes prints the
// same" is measured against, so re-recording it from a changed page would
// pin the change. For each fixture it keeps the printed #printArea HTML and the
// page count and text hash of Chromium's PDF of it (Letter, print media).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';
import { FIXTURES, printedHtml } from './_golden-fixtures.mjs';

const PORT = 8511;
const BASE = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });
await page.goto(BASE + '/Tools/079-verb-conjugation-poster-generator.html');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-golden-'));
const out = {};
for (const [name, tpl, cols, color] of FIXTURES) {
  const html = await printedHtml(page, tpl, cols, color);
  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(tmp, 'p.pdf');
  fs.writeFileSync(pdf, await page.pdf({ format: 'Letter' }));
  await page.emulateMedia({ media: 'screen' });
  const info = execFileSync('pdfinfo', [pdf]).toString();
  const pages = Number(/Pages:\s+(\d+)/.exec(info)[1]);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
  out[name] = {
    html,
    pages,
    textSha: crypto.createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex'),
  };
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(new URL('./golden-old-posters.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('recorded', Object.keys(out).length, 'posters;', Object.entries(out).map(([k, v]) => `${k}:${v.pages}p`).join(' '));
await browser.close();
server.close();
