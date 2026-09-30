// validate-art.test.mjs — the Path 21 art validator, rule by rule.
//
//   node Tools/blender-art/test/validate-art.test.mjs   (or: npm run test:blender-art)
//
// Pure Node, no browser and no Blender. It first asserts the real tree is
// clean, then copies the ledger, its outputs and ink-paper.css into a
// throwaway fixture tree and breaks one rule at a time, asserting that
// validate() names exactly that kind. A guard is only worth what it catches,
// so every rule in validate-art.mjs's header has a case here. Exits 1 on any
// failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  SITE, validate, parsePalette, luminance, worstContrast, svgProblems, dimensions, hashFile, decodePng, outsideSafeZone,
} from '../validate-art.mjs';
import { assembleSprite, toSymbol } from '../build-sprite.mjs';

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; return true; }
  failed++;
  console.log('  FAIL ' + label);
  return false;
}

/* ── 1. the real tree ─────────────────────────────────────────────────────── */

const real = validate(SITE);
ok(real.length === 0, 'the committed tree is clean: ' + real.map(p => `${p.kind} ${p.where} ${p.msg}`).join('; '));

/* ── 2. pure helpers ──────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(SITE, '_shared', 'ink-paper.css'), 'utf8');
const pal = parsePalette(css);
ok(pal && pal.light['--ink'] === '#1f2430', 'light --ink resolves through var(--ink-light)');
ok(pal && pal.light['--card'] === '#ffffff', 'a three-digit hex expands (#fff)');
ok(pal && pal.dark['--ink'] === '#e9e7e0', 'dark --ink comes from the top-level dark block');
ok(pal && pal.dark['--paper'] === '#14171c', 'dark --paper is not the print block\'s light value');
ok(pal && !('--ink-light' in pal.light), 'the -light names are not tokens');
ok(Math.abs(luminance('#ffffff') - 1) < 1e-9 && luminance('#000000') === 0, 'luminance endpoints');
ok(Math.abs(worstContrast(0, 1, 1) - 21) < 1e-9, 'black on white is 21:1');
ok(worstContrast(luminance('#1f2430'), 0.05, 0.9) < 4.5, 'dark ink over a range that dips dark fails 4.5');
ok(svgProblems('<svg stroke="currentColor" fill="none"><path d="M0 0"/></svg>').length === 0, 'a currentColor icon is clean');
ok(svgProblems('<svg fill="#123"><path/></svg>').length > 0, 'a literal fill is caught');
ok(svgProblems('<svg><image href="data:image/png;base64,AA"/></svg>').length > 0, 'an embedded raster is caught');
ok(svgProblems('<svg stroke="rgb(0,0,0)"></svg>').length > 0, 'an rgb() stroke is caught');
ok(svgProblems('<svg><path style="stroke:red"/></svg>').length > 0, 'a style attribute is caught');
ok(hashFile(Buffer.from('a\r\nb'), 'x.svg').sha256 === hashFile(Buffer.from('a\nb'), 'x.svg').sha256, 'SVG hashes ignore CR');
ok(hashFile(Buffer.from('a\r\nb'), 'x.webp').sha256 !== hashFile(Buffer.from('a\nb'), 'x.webp').sha256, 'binary hashes do not');
const png = Buffer.alloc(24);
png.write('IHDR', 12, 'latin1');
png.writeUInt32BE(96, 16);
png.writeUInt32BE(64, 20);
ok(JSON.stringify(dimensions(png, 'a.png')) === '{"width":96,"height":64}', 'PNG dimensions from IHDR');
const sym = toSymbol('<svg xmlns="http://www.w3.org/2000/svg" width="48" viewBox="0 0 48 48" stroke="currentColor"><path d="M0 0"/></svg>\n', 'assets/art/icons/t001.svg');
ok(sym === '<symbol id="t001" viewBox="0 0 48 48" stroke="currentColor"><path d="M0 0"/></symbol>',
  'a symbol keeps its icon\'s viewBox and stroke, drops xmlns and width, and is named for the file: ' + sym);
let threw = false;
try { toSymbol('<svg stroke="currentColor"><path/></svg>', 'x.svg'); } catch { threw = true; }
ok(threw, 'an icon with no viewBox cannot become a symbol');

/* ── 3. a fixture tree, broken one rule at a time ─────────────────────────── */

const ledgerRel = 'Tools/blender-art/renders.json';
const baseLedger = JSON.parse(fs.readFileSync(path.join(SITE, ledgerRel), 'utf8'));

function fixture(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-art-'));
  const put = (rel, data) => {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
  };
  put('_shared/ink-paper.css', css);
  for (const e of baseLedger.entries) put(e.path, fs.readFileSync(path.join(SITE, ...e.path.split('/'))));
  put('index.html', '<!doctype html><title>x</title>');
  put('manifest.json', fs.readFileSync(path.join(SITE, 'manifest.json')));
  put('sw.js', 'const SHELL_URLS = [\n  "index.html",\n];\n');
  const ledger = JSON.parse(JSON.stringify(baseLedger));
  const ctx = { root, put, ledger, entry: p => ledger.entries.find(e => e.path.endsWith(p)) };
  if (mutate) mutate(ctx);
  put(ledgerRel, JSON.stringify(ctx.ledger, null, 2));
  const problems = validate(root);
  fs.rmSync(root, { recursive: true, force: true });
  return problems;
}

function breaks(label, kind, mutate) {
  const problems = fixture(mutate);
  const kinds = [...new Set(problems.map(p => p.kind))];
  ok(kinds.length === 1 && kinds[0] === kind,
    `${label}: expected only ${kind}, got ${kinds.join(', ') || 'nothing'} (${problems.map(p => p.msg).join('; ')})`);
}

ok(fixture().length === 0, 'the unbroken fixture is clean');

breaks('an output deleted', 'MISSING', c => fs.rmSync(path.join(c.root, 'assets', 'art', 'icons', 't007.svg')));
breaks('one byte of an output changed', 'HASH', c => {
  const f = path.join(c.root, 'assets', 'art', 'test', 'tile-256-light.webp');
  const buf = fs.readFileSync(f);
  buf[buf.length - 1] ^= 0xff;
  fs.writeFileSync(f, buf);
});
breaks('a cap lowered below its file', 'CAP', c => { c.entry('t007.svg').cap = 100; });
breaks('a family total exceeded', 'CAP', c => { c.ledger.families.tile.total = 1000; });
breaks('the path budget exceeded', 'CAP', c => { c.ledger.budget.total = 1000; });
breaks('the shell share exceeded', 'CAP', c => {
  c.put('sw.js', 'const SHELL_URLS = [\n  "assets/art/icons/t007.svg",\n];\n');
  c.ledger.budget.shell = 100;
});
breaks('a cap raised above its family with no reason', 'LEDGER', c => { c.entry('t007.svg').cap = 5000; });
ok(fixture(c => { c.entry('t007.svg').cap = 5000; c.entry('t007.svg').capWhy = 'test'; }).length === 0,
  'a raised cap with a capWhy passes');
breaks('a required field missing', 'LEDGER', c => { delete c.entry('t007.svg').seed; });
breaks('a path listed twice', 'LEDGER', c => { c.ledger.entries.push({ ...c.entry('t007.svg') }); });
breaks('dimensions that disagree', 'SIZE', c => { c.entry('t007.svg').width = 96; });
breaks('a render from another Blender line', 'PIN', c => { c.entry('t007.svg').blender = '4.5.3'; });
breaks('an on-screen raster with no twin', 'TWIN', c => {
  delete c.entry('tile-256-light.webp').twin;
});
breaks('a twin that does not point back', 'TWIN', c => { c.entry('tile-256-dark.webp').twin = 'assets/art/icons/t007.svg'; });
ok(fixture(c => {
  c.entry('tile-256-light.webp').use = 'print';
  delete c.entry('tile-256-light.webp').twin;
  c.ledger.entries = c.ledger.entries.filter(e => !e.path.endsWith('tile-256-dark.webp'));
  fs.rmSync(path.join(c.root, 'assets', 'art', 'test', 'tile-256-dark.webp'));
}).length === 0, 'print-only art needs no dark twin');
breaks('an icon with a literal fill', 'SVG', c => {
  const f = path.join(c.root, 'assets', 'art', 'icons', 't007.svg');
  const text = fs.readFileSync(f, 'utf8').replace('fill="none"', 'fill="#1f2430"');
  fs.writeFileSync(f, text);
  const e = c.entry('t007.svg');
  Object.assign(e, hashFile(Buffer.from(text), 't007.svg'));
  resprite(c);       // the sprite carries the fill too, so this is SVG twice and nothing else
});

/* derived entries: the sprite */

function resprite(c) {
  const s = c.entry('tools.svg');
  const text = assembleSprite(c.root, s);
  c.put(s.path, text);
  Object.assign(s, hashFile(Buffer.from(text), s.path));
}
breaks('a sprite edited by hand', 'DERIVED', c => {
  const s = c.entry('tools.svg');
  const f = path.join(c.root, ...s.path.split('/'));
  const text = fs.readFileSync(f, 'utf8').replace(/<symbol id="t001"[\s\S]*?<\/symbol>/, '');
  fs.writeFileSync(f, text);
  Object.assign(s, hashFile(Buffer.from(text), s.path));
});
breaks('an icon the sprite does not list', 'DERIVED', c => {
  c.entry('tools.svg').sources = c.entry('tools.svg').sources.filter(p => !p.endsWith('t001.svg'));
  resprite(c);
});
breaks('a sprite source that is not in the ledger', 'DERIVED', c => {
  c.entry('tools.svg').sources.push('assets/art/icons/t999.svg');
});
breaks('a derived entry with a seed of its own', 'LEDGER', c => { c.entry('tools.svg').seed = 1; });
breaks('a derived entry with a Blender version of its own', 'LEDGER', c => { c.entry('tools.svg').blender = '5.2.2'; });
ok(fixture(c => {
  const f = path.join(c.root, 'assets', 'art', 'icons', 't001.svg');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n'));
}).length === 0, 'a CRLF checkout of a source still assembles to the committed sprite');

/* the stroke floor */

breaks('icons held to a floor they miss', 'STROKE', c => { c.ledger.families.icon.minStrokePx = 2; });
breaks('icons drawn smaller than their stroke allows', 'STROKE', c => { c.ledger.families.icon.displayPx = 24; });

/* use "manifest": icons the OS draws */

breaks('a manifest icon manifest.json does not name', 'MANIFEST', c => {
  const m = fs.readFileSync(path.join(SITE, 'manifest.json'), 'utf8').replace('assets/art/shortcuts/t004-96.png', 'assets/icons/icon-192.png');
  c.put('manifest.json', m);
});
breaks('a manifest icon that is not light', 'MANIFEST', c => { c.entry('t004-96.png').theme = 'dark'; });
breaks('manifest.json naming on-screen art', 'MANIFEST', c => {
  const m = fs.readFileSync(path.join(SITE, 'manifest.json'), 'utf8').replace('assets/art/shortcuts/t004-96.png', 'assets/art/icons/tools.svg');
  c.put('manifest.json', m);
  c.entry('t004-96.png').use = 'print';        // keep the renamed shortcut out of the picture
});
/* the app mark: manifest.json's own icons, and the maskable safe zone */

const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const markAny = decodePng(fs.readFileSync(path.join(SITE, 'assets', 'icons', 'icon-192.png')));
const markMask = decodePng(fs.readFileSync(path.join(SITE, 'assets', 'icons', 'icon-maskable-192.png')));
ok(markMask && markMask.width === 192 && hex(markMask.rgb(0, 0)) === pal.light['--paper'],
  'the maskable app mark decodes, and its background is --paper exactly: ' + (markMask && hex(markMask.rgb(0, 0))));
ok(markMask && outsideSafeZone(markMask) === 0, 'the committed maskable mark stays inside the safe zone');
ok(markAny && outsideSafeZone(markAny) > 0, 'the "any" mark, drawn larger, would not: the count is not vacuous');
// The radius is 40% of the width, not "somewhere near the edge": one dark
// pixel at 45% counts, one at 38% does not.
const dot = (x, y) => ({ width: 100, height: 100, rgb: (px, py) => (px === x && py === y ? [0, 0, 0] : [255, 255, 255]) });
ok(outsideSafeZone(dot(94, 50)) === 1 && outsideSafeZone(dot(87, 50)) === 0, 'the safe zone is the circle of radius 40%');
// Every PNG row filter, decoded: the app mark's own writer only uses filter 0,
// so a 5-row RGB image is filtered here by hand, one filter per row.
{
  const w = 3, rows = [0, 1, 2, 3, 4].map(y => Buffer.from([...Array(w * 3)].map((_, i) => (y * 53 + i * 29 + (i % 3) * 7) & 0xff)));
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  const raw = [];
  rows.forEach((line, y) => {
    const prev = y ? rows[y - 1] : Buffer.alloc(w * 3);
    raw.push(y);
    for (let i = 0; i < line.length; i++) {
      const a = i >= 3 ? line[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0;
      raw.push((line[i] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][y]) & 0xff);
    }
  });
  const chunk = (kind, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(kind, 'latin1'), data, Buffer.alloc(4)]);   // the decoder ignores CRCs
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(rows.length, 4); ihdr[8] = 8; ihdr[9] = 2;
  const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
  const img = decodePng(file);
  const good = img && rows.every((line, y) => [...Array(w)].every((_, x) => img.rgb(x, y).join() === [...line.subarray(x * 3, x * 3 + 3)].join()));
  ok(good, 'decodePng undoes all five row filters (None, Sub, Up, Average, Paeth)');
}
breaks('a maskable icon that reaches past the safe zone', 'SAFE', c => {
  const bytes = fs.readFileSync(path.join(SITE, 'assets', 'icons', 'icon-192.png'));
  c.put('assets/icons/icon-maskable-192.png', bytes);
  Object.assign(c.entry('icon-maskable-192.png'), hashFile(bytes, 'x.png'));
});
breaks('an app mark with no fit', 'SAFE', c => { delete c.entry('icon-maskable-512.png').fit; });
breaks('an app mark with no inks', 'SAFE', c => { c.entry('icon-192.png').inks = []; });
breaks('an unknown use', 'LEDGER', c => { c.entry('t007.svg').use = 'wallpaper'; });
ok(fixture(c => {
  delete c.entry('t004-96.png').twin;
}).length === 0, 'a manifest icon needs no dark twin');
breaks('a token ink-paper.css does not define', 'TOKEN', c => { c.entry('t007.svg').tokens = ['--not-a-token']; });
breaks('a non-token colour with no why', 'TOKEN', c => { c.entry('t007.svg').extraColors = [{ hex: '#c0ffee' }]; });
breaks('under-text luminance never recorded', 'CONTRAST', c => { delete c.entry('tile-256-light.webp').underText.lumMin; });
breaks('under-text below 4.5:1', 'CONTRAST', c => {
  Object.assign(c.entry('tile-256-light.webp').underText, { lumMin: 0.05, lumMax: 0.2 });
});
ok(fixture(c => {
  Object.assign(c.entry('tile-256-light.webp').underText, { lumMin: 0.17, lumMax: 0.2, large: true });
}).length === 0, 'large text is held to 3:1, not 4.5:1');
breaks('dark text over a dark render', 'CONTRAST', c => {
  Object.assign(c.entry('tile-256-dark.webp').underText, { lumMin: 0.3, lumMax: 0.9 });
});
breaks('an art file the ledger does not list', 'ORPHAN', c => c.put('Tools/some-tool/art/stray.webp', 'x'));
breaks('an <img> of an art file with no alt', 'ALT', c => c.put('index.html', '<img src="assets/art/test/tile-256-light.webp"><img src="assets/art/test/tile-256-dark.webp" alt="">'));
breaks('a decorative <img> with alt text', 'ALT', c => c.put('Tools/001-x.html', '<img src="../assets/art/test/tile-256-light.webp" alt="a tile"><img src="../assets/art/test/tile-256-dark.webp" alt="">'));
ok(fixture(c => c.put('Tools/001-x.html', '<img src="../assets/art/test/tile-256-light.webp" alt=""><img src="../assets/art/test/tile-256-dark.webp" alt="">')).length === 0,
  'a decorative <img> with alt="" passes');
breaks('a meaningful <img> with empty alt', 'ALT', c => {
  c.entry('tile-256-light.webp').decorative = false;
  c.put('index.html', '<img src="assets/art/test/tile-256-light.webp" alt=""><img src="assets/art/test/tile-256-dark.webp" alt="">');
});

/* IMG: the landing hero, one file per density and theme. */
const H = 'assets/art/hero/classroom-';
const heroImg = (theme, o = {}) => `<img src="${o.src || H + '1x-' + theme + '.webp'}"` +
  ` srcset="${o.srcset || `${H}1x-${theme}.webp 1x, ${H}2x-${theme}.webp 2x`}"` +
  ` ${o.size === undefined ? 'width="360" height="300"' : o.size} alt="">`;
const hero = (light = {}, dark = {}) => heroImg('light', light) + (dark === null ? '' : heroImg('dark', dark));
ok(fixture(c => c.put('index.html', hero())).length === 0, 'the hero as index.html shows it passes');
breaks('a hero <img> with no width and height', 'IMG', c => c.put('index.html', hero({ size: '' })));
breaks('a hero <img> sized at its pixels, not its CSS size', 'IMG', c => c.put('index.html', hero({ size: 'width="720" height="600"' })));
breaks('a 2x candidate that is the 1x file', 'IMG', c => c.put('index.html', hero({ srcset: `${H}1x-light.webp 2x` })));
// Each case below keeps every twin shown, so only the rule it names can fire:
// the first cut of these went red through the twin check instead, and four
// deliberate breaks of the rule itself passed (HISTORY.md, Path 21 P3).
breaks('srcset candidates from the other theme', 'IMG', c => c.put('index.html',
  hero({ srcset: `${H}1x-light.webp 1x, ${H}2x-dark.webp 2x` }, { srcset: `${H}1x-dark.webp 1x, ${H}2x-light.webp 2x` })));
breaks('a srcset candidate the ledger does not list', 'IMG', c => c.put('index.html',
  hero({ srcset: `${H}1x-light.webp 1x, ${H}3x-light.webp 3x` }, { srcset: `${H}1x-dark.webp 1x, ${H}3x-dark.webp 3x` })));
breaks('a width descriptor in the srcset', 'IMG', c => c.put('index.html',
  hero({ srcset: `${H}1x-light.webp 360w` }, { srcset: `${H}1x-dark.webp 360w` })));
breaks('the dark 2x in a srcset with no light 2x anywhere', 'IMG', c => c.put('index.html',
  hero({ srcset: `${H}1x-light.webp 1x` })));
breaks('the light hero shown without its dark twin', 'IMG', c => c.put('index.html', hero({}, null)));
breaks('a tile shown without its dark twin', 'IMG', c => c.put('index.html', '<img src="assets/art/test/tile-256-light.webp" alt="">'));
breaks('a density that is not a positive integer', 'LEDGER', c => { c.entry('classroom-1x-light.webp').density = 1.5; });

console.log(`validate-art.test: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
