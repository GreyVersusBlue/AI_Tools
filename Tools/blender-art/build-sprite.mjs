// build-sprite.mjs — assemble the landing page's icon sprite from the icons.
//
//   node Tools/blender-art/build-sprite.mjs
//
// The sprite (assets/art/icons/tools.svg) is not rendered. It is derived:
// every icon Blender drew becomes one <symbol id="tNNN"> in it, in the order
// its ledger entry's "sources" lists them, and index.html draws each row's
// icon with <use href="assets/art/icons/tools.svg#tNNN">. So a derived entry
// in renders.json is ledgered differently from a render (Path 21 P2's call,
// recorded in HISTORY.md):
//
//   * "script" is this file, not a scene script, and it runs in Node, not in
//     Blender. CI can run it too, which is the point: validate-art.mjs calls
//     assembleSprite() and fails if the committed sprite is not exactly what
//     the committed sources assemble to.
//   * It has no "seed" and no "blender". Nothing random goes into it and
//     Blender never touches it; its sources carry both, and the PIN rule
//     applies to them. The validator fails a derived entry that has either,
//     so neither can drift into meaning something.
//   * "sources" names every icon it holds, and the validator fails an icon
//     entry that no sprite lists, so a new icon cannot be rendered and
//     forgotten.
//
// Each symbol keeps its icon's own root attributes (viewBox, stroke,
// stroke-width, linecaps), because a <use> clone inherits from the <use>, not
// from the sprite's root. There is no <title>: on the landing rows the icons
// are decorative and the row's text is the name.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER_REL = 'Tools/blender-art/renders.json';

/** One icon file's text as a <symbol>, or throws saying why it cannot be. */
export function toSymbol(text, rel) {
  const m = /^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(text.replace(/\r/g, '').trim());
  if (!m) throw new Error(`${rel} is not a single <svg> element`);
  const attrs = m[1].replace(/\s+xmlns(:\w+)?="[^"]*"/g, '').replace(/\s+(width|height)="[^"]*"/g, '');
  if (!/\sviewBox="/.test(attrs)) throw new Error(`${rel} has no viewBox`);
  const id = path.posix.basename(rel, '.svg');
  return `<symbol id="${id}"${attrs}>${m[2]}</symbol>`;
}

/** The sprite's exact text, from the files its entry's sources name. */
export function assembleSprite(root, entry) {
  const symbols = entry.sources.map(rel => toSymbol(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'), rel));
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ledgerPath = path.join(SITE, LEDGER_REL);
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const derived = ledger.entries.filter(e => Array.isArray(e.sources));
  if (!derived.length) { console.error('build-sprite: no entry in renders.json has "sources"'); process.exit(1); }
  let over = 0;
  for (const e of derived) {
    const text = assembleSprite(SITE, e);
    const out = path.join(SITE, ...e.path.split('/'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text);
    const buf = Buffer.from(text, 'utf8');
    e.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    e.bytes = buf.length;
    console.log(`build-sprite: wrote ${e.path} (${e.sources.length} symbols, ${e.bytes} bytes, cap ${e.cap}, sha256 ${e.sha256.slice(0, 12)})`);
    if (e.bytes > e.cap) { console.error(`build-sprite: ${e.path} is over its cap of ${e.cap}`); over++; }
  }
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  process.exit(over ? 1 : 0);
}
