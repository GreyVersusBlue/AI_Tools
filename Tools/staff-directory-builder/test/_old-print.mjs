// _old-print.mjs — what Print directory produces, captured the same way from
// whichever copy of the site a caller serves. record-old-print.mjs ran it once
// against the page as it was before the wallet cards (main at d34651b) and
// wrote golden-old-print.json; smoke-wallet-cards.mjs runs it against the page
// as it is now and compares. Names, rooms and extensions are invented.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SAMPLE = [
  ['Marisol Ruiz', '214', '4214', 'Math'], ['Devraj Balasubramanian', '118', '4118', 'Science'],
  ['Amaia Etxeberria', '120', '4120', 'science'], ['Beckett Hale', '007', '4007', 'Math'],
  ['Sable Whitfield', '101', '4101', ''], ['Nadia Okonjo', '212', '4212', 'Social Studies'],
  ['Corin Vale', '215', '4215', 'Math'], ['Ines Marchetti', '110', '4110', 'Art'],
  ['Tobias Wren', 'Gym', '4300', 'PE'], ['Leilani Okada', '305', '+1 555 0142', 'Music'],
  ['Pavel Dragan', '306', '4306', 'Music'], ['Wren Castellanos', 'Office', '4000', 'Admin'],
].map(([name, room, ext, subject], i) => ({ id: 'p' + i, name, room, ext, subject }));

export async function captureOldPrint(page, url) {
  const out = {};
  for (const grouped of [false, true]) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(([people, g]) => {
      localStorage.setItem('sdb_directory_v1', JSON.stringify(people));
      localStorage.setItem('sdb_prefs_v1', JSON.stringify({ groupByDept: g }));
    }, [SAMPLE, grouped]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => { window.print = () => {}; });
    await page.click('#printBtn');
    const html = await page.$eval('#printArea', el => el.innerHTML.replace(/printed [^<]*/, 'printed DATE'));
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({});
    await page.emulateMedia({ media: 'screen' });
    const f = path.join(os.tmpdir(), 'sdb-old-' + process.pid + '.pdf');
    fs.writeFileSync(f, pdf);
    const txt = spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout.replace(/printed \S+/g, 'printed DATE');
    const info = spawnSync('pdfinfo', [f], { encoding: 'utf8' }).stdout;
    fs.unlinkSync(f);
    out[grouped ? 'grouped' : 'flat'] = { html, text: txt, pages: Number((info.match(/Pages:\s+(\d+)/) || [])[1]) };
  }
  return out;
}
