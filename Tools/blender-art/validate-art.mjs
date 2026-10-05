// validate-art.mjs — read-only guard over the Path 21 art ledger.
//
//   node Tools/blender-art/validate-art.mjs
//
// Blender runs only on Devon's machines (Windows, and huginn), so CI can never re-render
// anything. What it can do is check that what a local session committed is
// what the ledger (Tools/blender-art/renders.json) says it is, and that the
// ledger keeps the promises Path 21 makes. This never calls Blender and reads
// only files in the tree.
//
// It exits non-zero on any of these, each printed with its kind:
//
//   LEDGER    an entry missing a required field, a duplicate path, an unknown
//             family/theme/use, or a cap above its family's entryCap with no
//             capWhy saying why it was raised.
//   MISSING   a ledgered output that is not in the tree.
//   CAP       an output over its byte cap; a family over its total; the path
//             over its 2 MB budget; the SHELL_URLS share over its 250 KB.
//   HASH      an output whose SHA-256 or byte count is not the ledger's
//             (SVG is hashed with CR stripped, so a CRLF checkout still passes).
//   SIZE      an output whose pixel dimensions are not the ledger's.
//   PIN       an entry made by a Blender outside the pinned LTS line.
//             A generated entry (below) has no Blender, so PIN skips it.
//   TWIN      an on-screen raster without a dark (or light) twin that points back.
//             use "sheet" is art drawn only on a surface the page keeps the
//             same in both themes (080's .paper-sheet board, 030's navy
//             projector board): it is rendered once, as theme "light", and
//             needs no twin, the way print art does.
//   SVG       an icon carrying a literal colour, a fill, a style attribute or
//             an embedded raster; icons are stroke="currentColor" and nothing else.
//   TOKEN     a material token that ink-paper.css does not define, or a
//             non-token colour with no "why". Skipped for a generated entry:
//             no scene parsed the palette, so it has no materials to name.
//   CONTRAST  an under-text entry with no luminance recorded, or one whose
//             recorded range does not hold 4.5:1 (3:1 when the entry says the
//             text is large) against its text token in its own theme.
//             "underText" is one region or, for an atlas with a label on
//             several cells, a list of named regions, each held to its own
//             token (080's algebra tiles: --ink on the pale positive tiles,
//             --accent-ink on the red negative ones). A region whose text is
//             not an ink-paper colour names it as "hex" with a "why" instead
//             of "token" (030's board is navy and gold, its own colours in
//             both themes); a hex with no why is a CONTRAST failure.
//   GREY      an entry that declares "grey" (pairs of named cells a reader must
//             tell apart without colour, and a minRatio) with a pair that has
//             no measured contrast, or one under minRatio. The scene script
//             measures each pair's mean relative luminance on the written file
//             (which is the greyscale conversion) and records the ratio; this
//             holds the record to the floor, so a colour-only difference
//             cannot come back in a re-render.
//   ORPHAN    a file under assets/art/ or Tools/*/art/ the ledger does not list.
//   ALT       an <img> in a live page (index.html, Tools/*.html) showing an art
//             file with no alt attribute, a decorative one with non-empty alt,
//             or a meaningful one with empty alt.
//   DERIVED   a derived entry (one with "sources", assembled by a Node script
//             rather than rendered: the icon sprite) whose file is not exactly
//             what build-sprite.mjs assembles from its sources; a source that
//             is not a rendered SVG entry; or an entry of a family the sprite
//             draws from that the sprite does not list, so an icon cannot be
//             rendered and forgotten. A derived entry has no seed and no
//             blender of its own (LEDGER if it does): its sources carry both.
//   STROKE    an SVG in a family that declares displayPx and minStrokePx whose
//             stroke-width, drawn at displayPx, is under minStrokePx. The icon
//             family is drawn at 32 px on the landing page and held to 1.5 px.
//   MANIFEST  a use:"manifest" entry (an icon the OS draws: manifest.json's
//             shortcuts) that is not a light PNG, or that manifest.json does
//             not name; or a manifest.json icon under assets/art/ whose entry
//             is not use:"manifest". The OS picks what is behind it, so it
//             needs no dark twin, which is why it is not use:"screen".
//   SAFE      an app-mark entry (family "appmark": manifest.json's own icons)
//             with no fit ("any" or "maskable"), no stroke or no inks; or a
//             fit:"maskable" PNG with any pixel outside the maskable safe
//             zone (the centred circle of radius 40% of its width) that is not
//             its background, the colour of its top-left pixel. A launcher
//             may crop to any shape containing that circle, so this is the
//             claim "survives the safe zone" read off the file itself.
//   IMG       an <img> in a live page whose src is an entry that declares a
//             "density" (the landing hero: one file per pixel density), and
//             whose width/height attributes are missing or are not that
//             entry's size divided by its density, so the page would shift on
//             load or scale the art; a srcset candidate that is not a ledger
//             entry of the same family and theme at that size times its
//             descriptor ("2x" is twice the CSS size); or an on-screen entry
//             shown on a page whose twin that page never shows, so one theme
//             would get the other theme's picture. A "density" that is not a
//             positive integer is LEDGER.
//
// A generated entry (one with "generator": an image made by an AI image model,
// not by a scene script) is the third kind, after rendered and derived. It
// cannot be re-made from the repo, so the ledger keeps what made it instead:
// "generator" (the model and version), "generated" (YYYY-MM-DD), the full
// "prompt" and its "references" (a list of the files or URLs given to the
// model, possibly empty). It has no script, seed or blender (LEDGER if it
// does); MISSING, CAP, HASH, SIZE, ORPHAN and ALT hold it like any other
// entry, and so do TWIN, CONTRAST and IMG when it declares what they read.
//
// It does not duplicate check:precache, which already fails a referenced file
// missing from PRECACHE_URLS. Its pure-Node test is test/validate-art.test.mjs,
// which builds a small fixture tree and breaks each rule in turn.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { assembleSprite } from './build-sprite.mjs';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER_REL = 'Tools/blender-art/renders.json';
const REQUIRED = ['path', 'script', 'family', 'seed', 'width', 'height', 'cap', 'theme', 'use', 'decorative',
  'blender', 'sha256', 'bytes'];
// A derived entry is assembled, not rendered: no seed and no blender.
const REQUIRED_DERIVED = ['path', 'script', 'family', 'sources', 'width', 'height', 'cap', 'theme', 'use',
  'decorative', 'sha256', 'bytes'];
// A generated entry is made by an image model: no script, seed or blender, but
// a record of the model, the date, the prompt and what it was shown.
const REQUIRED_GENERATED = ['path', 'family', 'generator', 'generated', 'prompt', 'references', 'width', 'height',
  'cap', 'theme', 'use', 'decorative', 'sha256', 'bytes'];
const USES = ['screen', 'print', 'content', 'manifest', 'sheet'];
const isDerived = e => e.sources !== undefined;
const isGenerated = e => e.generator !== undefined;
const RASTER = /\.(webp|png|jpe?g)$/i;

/* ── palette, mirrored from art_common.py's parser ───────────────────────── */

const DARK_SELECTOR = ':root[data-theme="dark"]:not(.a11y-filter-dark)';

function topLevelBlocks(css) {
  const out = [];
  let depth = 0, start = 0, selStart = 0, sel = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) { sel = css.slice(selStart, i).trim(); start = i + 1; }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) { out.push([sel, css.slice(start, i)]); selStart = i + 1; }
    }
  }
  return out;
}

const decls = body => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

function resolveHex(value, names, seen = []) {
  const v = value.trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (m) {
    if (seen.includes(m[1]) || !(m[1] in names)) return null;
    return resolveHex(names[m[1]], names, [...seen, m[1]]);
  }
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + [...v.slice(1)].map(c => c + c).join('')).toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

export function parsePalette(css) {
  const blocks = topLevelBlocks(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const roots = blocks.filter(([s]) => s === ':root');
  const darks = blocks.filter(([s]) => s === DARK_SELECTOR);
  if (roots.length !== 1 || darks.length !== 1) return null;
  const light = decls(roots[0][1]);
  const out = {};
  for (const [theme, names] of [['light', light], ['dark', { ...light, ...decls(darks[0][1]) }]]) {
    out[theme] = {};
    for (const name of Object.keys(names)) {
      if (name.endsWith('-light')) continue;
      const hex = resolveHex(names[name], names);
      if (hex) out[theme][name] = hex;
    }
  }
  return out;
}

const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Worst-case contrast of a text colour over a background luminance range. */
export function worstContrast(textLum, lumMin, lumMax) {
  return Math.min(ratio(textLum, lumMin), ratio(textLum, lumMax));
}

/* ── file facts ──────────────────────────────────────────────────────────── */

export function hashFile(buf, rel) {
  const data = /\.svg$/i.test(rel) ? Buffer.from(buf.toString('latin1').replace(/\r/g, ''), 'latin1') : buf;
  return { sha256: crypto.createHash('sha256').update(data).digest('hex'), bytes: data.length };
}

export function dimensions(buf, rel) {
  if (/\.svg$/i.test(rel)) {
    const m = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(buf.toString('utf8'));
    return m ? { width: +m[1], height: +m[2] } : null;
  }
  if (/\.png$/i.test(rel) && buf.length >= 24 && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (/\.webp$/i.test(rel) && buf.length >= 30 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  if (/\.jpe?g$/i.test(rel) && buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    // Walk the markers to the first start-of-frame (C0–CF, less C4 DHT, C8 JPG, CC DAC).
    for (let off = 2; off + 9 <= buf.length && buf[off] === 0xff;) {
      const m = buf[off + 1];
      if (m === 0xff) { off++; continue; }
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}

/** Decode a PNG to { width, height, rgb(x, y) } with node:zlib: 8-bit RGB or
 *  RGBA, or indexed at 1/2/4/8 bits, no interlace. Enough for the app mark;
 *  anything else is null. */
export function decodePng(buf) {
  if (buf.length < 33 || buf.toString('latin1', 1, 4) !== 'PNG') return null;
  let off = 8, ihdr = null, plte = null;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') ihdr = data;
    else if (kind === 'PLTE') plte = data;
    else if (kind === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (!ihdr) return null;
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const depth = ihdr[8], type = ihdr[9];
  const channels = { 2: 3, 3: 1, 6: 4 }[type];
  if (!channels || ihdr[12] !== 0 || (type !== 3 && depth !== 8) || (type === 3 && !plte)) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * channels * depth) / 8), bpp = Math.max(1, (channels * depth) / 8);
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      line[i] = (line[i] + pred) & 0xff;
    }
    rows.push(line);
    prev = line;
  }
  const rgb = (x, y) => {
    const line = rows[y];
    if (type !== 3) return [0, 1, 2].map(j => line[x * channels + j]);
    const bit = x * depth, idx = (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    return [0, 1, 2].map(j => plte[idx * 3 + j]);
  };
  return { width, height, rgb };
}

/** How many pixels of a decoded image lie outside the centred circle of
 *  radius frac × width and differ from its top-left pixel. */
export function outsideSafeZone(img, frac = 0.4) {
  const bg = img.rgb(0, 0).join();
  const cx = img.width / 2, cy = img.height / 2, r = frac * img.width;
  let n = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r && img.rgb(x, y).join() !== bg) n++;
    }
  }
  return n;
}

/** The problems an SVG icon has, as short strings; empty when it is clean. */
export function svgProblems(text) {
  const out = [];
  if (/<image\b/i.test(text) || /href\s*=\s*"data:/i.test(text)) out.push('an embedded raster');
  if (/\sstyle\s*=/i.test(text) || /<style\b/i.test(text)) out.push('a style attribute or element');
  for (const m of text.matchAll(/\sfill\s*=\s*"([^"]*)"/gi)) if (m[1] !== 'none') out.push(`fill="${m[1]}"`);
  for (const m of text.matchAll(/\s(stroke|color|stop-color|flood-color|lighting-color)\s*=\s*"([^"]*)"/gi)) {
    if (m[2] !== 'currentColor') out.push(`${m[1]}="${m[2]}"`);
  }
  if (/#[0-9a-f]{3,8}\b/i.test(text.replace(/href\s*=\s*"#[^"]*"/gi, ''))) out.push('a literal #colour');
  if (/\b(rgba?|hsla?)\(/i.test(text)) out.push('a literal rgb()/hsl() colour');
  return out;
}

/* ── the tree ────────────────────────────────────────────────────────────── */

function walk(dir, root, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, root, out);
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

function artFilesOnDisk(root) {
  const files = walk(path.join(root, 'assets', 'art'), root);
  const tools = path.join(root, 'Tools');
  if (fs.existsSync(tools)) {
    for (const d of fs.readdirSync(tools, { withFileTypes: true })) {
      if (d.isDirectory()) files.push(...walk(path.join(tools, d.name, 'art'), root));
    }
  }
  return files.sort();
}

function livePages(root) {
  const pages = fs.existsSync(path.join(root, 'index.html')) ? ['index.html'] : [];
  const tools = path.join(root, 'Tools');
  if (fs.existsSync(tools)) {
    for (const f of fs.readdirSync(tools)) if (/\.html$/i.test(f)) pages.push('Tools/' + f);
  }
  return pages.sort();
}

function shellUrls(root) {
  const sw = path.join(root, 'sw.js');
  if (!fs.existsSync(sw)) return [];
  const m = /const SHELL_URLS = \[([\s\S]*?)\n\];/.exec(fs.readFileSync(sw, 'utf8'));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => decodeURI(x[1])) : [];
}

/* ── the rules ───────────────────────────────────────────────────────────── */

export function validate(root = SITE) {
  const problems = [];
  const add = (kind, where, msg) => problems.push({ kind, where, msg });
  const ledgerPath = path.join(root, LEDGER_REL);
  if (!fs.existsSync(ledgerPath)) { add('LEDGER', LEDGER_REL, 'no ledger'); return problems; }
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch (e) {
    add('LEDGER', LEDGER_REL, 'does not parse: ' + e.message); return problems;
  }
  const pinned = String(ledger.blender || '');
  if (!/^\d+\.\d+$/.test(pinned)) add('LEDGER', LEDGER_REL, `"blender" must name one LTS line such as "5.2", not "${pinned}"`);
  const families = ledger.families || {};
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const cssPath = path.join(root, '_shared', 'ink-paper.css');
  const palette = fs.existsSync(cssPath) ? parsePalette(fs.readFileSync(cssPath, 'utf8')) : null;
  if (!palette) add('TOKEN', '_shared/ink-paper.css', 'could not read the light :root and dark blocks');

  const byPath = new Map();
  for (const e of entries) {
    const where = e.path || '(entry with no path)';
    const required = isGenerated(e) ? REQUIRED_GENERATED : isDerived(e) ? REQUIRED_DERIVED : REQUIRED;
    const missing = required.filter(k => e[k] === undefined || e[k] === null || (typeof e[k] === 'string' && !e[k].trim()));
    if (missing.length) add('LEDGER', where, 'missing ' + missing.join(', '));
    if (isGenerated(e)) {
      for (const k of ['script', 'seed', 'blender', 'sources']) {
        if (e[k] !== undefined) add('LEDGER', where, `a generated entry was made by ${e.generator}, so it has no ${k}`);
      }
      if (e.generated && !/^\d{4}-\d{2}-\d{2}$/.test(String(e.generated))) add('LEDGER', where, `"generated" must be a date, YYYY-MM-DD, not "${e.generated}"`);
      if (e.prompt !== undefined && typeof e.prompt !== 'string') add('LEDGER', where, '"prompt" must be the full prompt, as a string');
      if (e.references !== undefined && e.references !== null && !Array.isArray(e.references)) {
        add('LEDGER', where, '"references" must be a list of what the model was given ([] for nothing)');
      }
    }
    if (isDerived(e)) {
      for (const k of ['seed', 'blender']) if (e[k] !== undefined) add('LEDGER', where, `a derived entry has no ${k} of its own; its sources carry it`);
      if (!/\.mjs$/.test(String(e.script))) add('LEDGER', where, `a derived entry is assembled by a Node script, not ${e.script}`);
    }
    if (byPath.has(e.path)) add('LEDGER', where, 'listed twice');
    byPath.set(e.path, e);
    const fam = families[e.family];
    if (!fam) add('LEDGER', where, `unknown family "${e.family}"`);
    else if (e.cap > fam.entryCap && !e.capWhy) add('LEDGER', where, `cap ${e.cap} is above the ${e.family} family's ${fam.entryCap} with no capWhy`);
    if (!['light', 'dark', 'both'].includes(e.theme)) add('LEDGER', where, `theme "${e.theme}" is not light, dark or both`);
    if (!USES.includes(e.use)) add('LEDGER', where, `use "${e.use}" is not ${USES.join(', ')}`);
    if (e.use === 'sheet' && e.theme !== 'light') add('LEDGER', where, 'a sheet entry is drawn on a surface that is the same in both themes, so it is rendered once, as theme "light"');
    if (e.density !== undefined && !(Number.isInteger(e.density) && e.density > 0)) {
      add('LEDGER', where, `density must be a positive integer, not ${JSON.stringify(e.density)}`);
    }
    if (e.family === 'appmark') {
      if (!['any', 'maskable'].includes(e.fit)) add('SAFE', where, `an app mark's fit must be "any" or "maskable", not "${e.fit}"`);
      if (!(e.stroke > 0)) add('SAFE', where, 'an app mark needs its stroke, in units of the 48-unit icon');
      if (!Array.isArray(e.inks) || !e.inks.length) add('SAFE', where, 'an app mark needs its inks, the tokens its lines are drawn in');
    }
    if (e.blender && pinned && !isGenerated(e) && !String(e.blender).startsWith(pinned + '.')) {
      add('PIN', where, `made by Blender ${e.blender}; renders.json pins the ${pinned} LTS line`);
    }
  }

  const familyBytes = {};
  const actualBytes = new Map();
  for (const e of entries) {
    if (!e.path) continue;
    const where = e.path;
    const full = path.join(root, ...e.path.split('/'));
    if (!fs.existsSync(full)) { add('MISSING', where, 'in the ledger, not in the tree'); continue; }
    const buf = fs.readFileSync(full);
    const fam = families[e.family];
    const { sha256, bytes } = hashFile(buf, e.path);
    actualBytes.set(e.path, bytes);
    familyBytes[e.family] = (familyBytes[e.family] || 0) + bytes;
    if (sha256 !== e.sha256) add('HASH', where, `sha256 is ${sha256.slice(0, 12)}…, the ledger says ${String(e.sha256).slice(0, 12)}…`);
    if (bytes !== e.bytes) add('HASH', where, `${bytes} bytes, the ledger says ${e.bytes}`);
    if (bytes > e.cap) add('CAP', where, `${bytes} bytes, over its cap of ${e.cap}`);
    const dim = dimensions(buf, e.path);
    if (!dim) add('SIZE', where, 'could not read its dimensions');
    else if (dim.width !== e.width || dim.height !== e.height) {
      add('SIZE', where, `${dim.width}×${dim.height}, the ledger says ${e.width}×${e.height}`);
    }
    if (/\.svg$/i.test(e.path)) for (const p of svgProblems(buf.toString('utf8'))) add('SVG', where, 'carries ' + p);
    if (e.fit === 'maskable') {
      const img = /\.png$/i.test(e.path) ? decodePng(buf) : null;
      const n = img ? outsideSafeZone(img) : -1;
      if (n < 0) add('SAFE', where, 'a maskable icon must be a PNG this check can decode (8-bit RGB/RGBA or indexed)');
      else if (n) add('SAFE', where, `${n} pixel(s) outside the maskable safe zone (radius 40% of the width) are not background`);
    }
    if (/\.svg$/i.test(e.path) && dim && fam && fam.displayPx && fam.minStrokePx && !isDerived(e)) {
      // The file's own viewBox, not the ledger's width: SIZE reports those disagreeing.
      const sw = /^<svg\b[^>]*\sstroke-width="([\d.]+)"/.exec(buf.toString('utf8'));
      const px = sw ? (+sw[1] * fam.displayPx) / dim.width : 0;
      if (!sw) add('STROKE', where, 'no stroke-width on its root <svg>');
      else if (px < fam.minStrokePx - 1e-9) {
        add('STROKE', where, `stroke-width ${sw[1]} on a ${dim.width}-unit viewBox is ${px.toFixed(2)} px at ${fam.displayPx} px, under ${fam.minStrokePx}`);
      }
    }
  }

  for (const e of entries) {
    if (!e.path) continue;
    const where = e.path;
    if (RASTER.test(e.path)) {
      if (e.theme === 'both') add('TWIN', where, 'a raster cannot be theme "both"; only currentColor SVG can');
      if (e.use === 'screen') {
        const want = e.theme === 'light' ? 'dark' : 'light';
        const twin = e.twin && byPath.get(e.twin);
        if (!twin) add('TWIN', where, `an on-screen ${e.theme} raster with no ${want} twin in the ledger`);
        else if (twin.theme !== want || twin.twin !== e.path) add('TWIN', where, `twin ${e.twin} is not a ${want} entry pointing back`);
      }
    }
    if (palette && !isGenerated(e)) {
      for (const t of e.tokens || []) if (!(t in palette.light)) add('TOKEN', where, `"${t}" is not a token in ink-paper.css`);
      for (const c of e.extraColors || []) if (!c || !c.why) add('TOKEN', where, `non-token colour ${c && c.hex} has no "why"`);
    }
    for (const u of e.underText ? [].concat(e.underText) : []) {
      const theme = e.theme === 'dark' ? 'dark' : 'light';
      const name = u.name ? ` (region ${u.name})` : '';
      const own = typeof u.hex === 'string' && /^#[0-9a-f]{6}$/i.test(u.hex) ? u.hex.toLowerCase() : null;
      const text = u.token ? palette && palette[theme][u.token] : own;
      const label = u.token || u.hex;
      if (!u.token && own && !u.why) add('CONTRAST', where, `text colour ${u.hex}${name} is not a token and has no "why"`);
      else if (!text) add('CONTRAST', where, u.token ? `text token "${u.token}"${name} is not in ink-paper.css` : `text colour${name} is neither a token nor a #rrggbb hex`);
      else if (typeof u.lumMin !== 'number' || typeof u.lumMax !== 'number') add('CONTRAST', where, `under-text luminance${name} was never recorded`);
      else {
        const floor = u.large ? 3 : 4.5;
        const worst = worstContrast(luminance(text), u.lumMin, u.lumMax);
        if (worst < floor) add('CONTRAST', where, `${label} over luminance ${u.lumMin}–${u.lumMax}${name} is ${worst.toFixed(2)}:1 in ${theme}, under ${floor}:1`);
      }
    }
    const g = e.grey;
    if (g) {
      const pairs = Array.isArray(g.pairs) ? g.pairs : [];
      if (!pairs.length || !(g.minRatio > 1)) add('GREY', where, '"grey" needs its pairs and a minRatio above 1');
      for (const [a, b] of pairs) {
        const got = (g.measured || {})[`${a}|${b}`];
        if (typeof got !== 'number') add('GREY', where, `${a} against ${b} was never measured`);
        else if (got < g.minRatio) add('GREY', where, `${a} against ${b} is ${got}:1 in greyscale, under ${g.minRatio}:1`);
      }
    }
  }

  for (const d of entries.filter(e => e.path && isDerived(e))) {
    const where = d.path;
    if (!Array.isArray(d.sources) || !d.sources.length) { add('DERIVED', where, '"sources" must list the entries it is assembled from'); continue; }
    const srcs = d.sources.map(p => byPath.get(p));
    d.sources.forEach((p, i) => {
      const s = srcs[i];
      if (!s) add('DERIVED', where, `source ${p} is not in the ledger`);
      else if (isDerived(s)) add('DERIVED', where, `source ${p} is itself derived`);
      else if (!/\.svg$/i.test(p)) add('DERIVED', where, `source ${p} is not an SVG`);
    });
    // A missing source or sprite is MISSING's to report; only compare when all are there.
    const full = path.join(root, ...d.path.split('/'));
    const present = [d.path, ...d.sources].every(p => fs.existsSync(path.join(root, ...p.split('/'))));
    if (present && d.sources.every(p => /\.svg$/i.test(p))) {
      let want = null;
      try { want = hashFile(Buffer.from(assembleSprite(root, d), 'utf8'), d.path).sha256; } catch (err) { add('DERIVED', where, err.message); }
      if (want && want !== hashFile(fs.readFileSync(full), d.path).sha256) {
        add('DERIVED', where, 'is not what its sources assemble to; run node Tools/blender-art/build-sprite.mjs');
      }
    }
    const fams = new Set(srcs.filter(Boolean).map(s => s.family));
    const listed = new Set(d.sources);
    for (const e of entries) {
      if (e.path && fams.has(e.family) && !isDerived(e) && !listed.has(e.path)) {
        add('DERIVED', e.path, `a ${e.family} entry that ${d.path} does not list in its sources`);
      }
    }
  }

  const manifestSrcs = new Set();
  const manifestPath = path.join(root, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const collect = v => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (k === 'src' && typeof x === 'string') manifestSrcs.add(path.posix.normalize(x.replace(/^\.\//, '')));
          else collect(x);
        }
      }
    };
    try { collect(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))); } catch (err) { add('MANIFEST', 'manifest.json', 'does not parse: ' + err.message); }
  }
  for (const e of entries) {
    if (!e.path || e.use !== 'manifest') continue;
    if (!/\.png$/i.test(e.path) || e.theme !== 'light') add('MANIFEST', e.path, 'an icon the OS draws must be a light PNG');
    if (!manifestSrcs.has(e.path)) add('MANIFEST', e.path, 'use "manifest", but manifest.json does not name it');
  }
  for (const src of manifestSrcs) {
    const e = byPath.get(src);
    if (e && e.use !== 'manifest') add('MANIFEST', src, `manifest.json names it, but its entry's use is "${e.use}", not "manifest"`);
  }

  for (const [name, fam] of Object.entries(families)) {
    if ((familyBytes[name] || 0) > fam.total) add('CAP', `family ${name}`, `${familyBytes[name]} bytes, over its total of ${fam.total}`);
  }
  const budget = ledger.budget || {};
  const total = [...actualBytes.values()].reduce((a, b) => a + b, 0);
  if (budget.total && total > budget.total) add('CAP', 'budget', `${total} bytes of art, over the path's ${budget.total}`);
  const shell = new Set(shellUrls(root));
  const shellBytes = [...actualBytes].filter(([p]) => shell.has(p)).reduce((a, [, b]) => a + b, 0);
  if (budget.shell && shellBytes > budget.shell) add('CAP', 'budget', `${shellBytes} bytes of art in SHELL_URLS, over ${budget.shell}`);

  for (const f of artFilesOnDisk(root)) if (!byPath.has(f)) add('ORPHAN', f, 'an art file the ledger does not list');

  const resolveOn = (base, url) => {
    if (/^(data:|https?:|\/\/)/i.test(url)) return null;
    try { return path.posix.normalize(path.posix.join(base, decodeURI(url.split(/[?#]/)[0]))); } catch { return null; }
  };
  for (const page of livePages(root)) {
    const html = fs.readFileSync(path.join(root, ...page.split('/')), 'utf8');
    const base = path.posix.dirname(page);
    const shown = new Set();
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (!src || /^(data:|https?:|\/\/)/i.test(src[1])) continue;
      let target;
      try { target = path.posix.normalize(path.posix.join(base, decodeURI(src[1].split(/[?#]/)[0]))); } catch { continue; }
      const entry = byPath.get(target);
      if (!entry) continue;
      const alt = /\salt\s*=\s*(["'])(.*?)\1/i.exec(tag) || (/\salt(\s|>|\/)/i.test(tag) ? [null, null, ''] : null);
      if (!alt) add('ALT', page, `<img src="${src[1]}"> has no alt attribute`);
      else if (entry.decorative && alt[2].trim() !== '') add('ALT', page, `${target} is decorative; its alt should be ""`);
      else if (!entry.decorative && alt[2].trim() === '') add('ALT', page, `${target} is meaningful; its alt must describe it`);
      shown.add(target);
      if (entry.density === undefined) continue;
      const attr = name => { const a = new RegExp(`\\s${name}\\s*=\\s*["']?([^"'\\s>]+)`, 'i').exec(tag); return a ? a[1] : null; };
      const cssW = entry.width / entry.density, cssH = entry.height / entry.density;
      if (attr('width') !== String(cssW) || attr('height') !== String(cssH)) {
        add('IMG', page, `<img src="${src[1]}"> needs width="${cssW}" height="${cssH}" (its ${entry.width}×${entry.height} at ${entry.density}x), has ${attr('width')}×${attr('height')}`);
      }
      const set = /\ssrcset\s*=\s*(["'])(.*?)\1/is.exec(tag);
      for (const cand of set ? set[2].split(',').map(c => c.trim()).filter(Boolean) : []) {
        const [url, desc = '1x'] = cand.split(/\s+/);
        const x = /^(\d+(?:\.\d+)?)x$/.exec(desc);
        const t = resolveOn(base, url);
        const c = t && byPath.get(t);
        if (!x) { add('IMG', page, `srcset candidate "${cand}" is not a density ("2x") descriptor`); continue; }
        if (!c) { add('IMG', page, `srcset candidate ${url} is not a ledger entry`); continue; }
        shown.add(t);
        if (c.family !== entry.family || c.theme !== entry.theme) add('IMG', page, `srcset candidate ${t} is ${c.family}/${c.theme}, the src is ${entry.family}/${entry.theme}`);
        else if (c.width !== cssW * +x[1] || c.height !== cssH * +x[1]) add('IMG', page, `srcset candidate ${t} is ${c.width}×${c.height}, but ${x[1]}x of ${cssW}×${cssH} is ${cssW * +x[1]}×${cssH * +x[1]}`);
      }
    }
    for (const t of shown) {
      const e = byPath.get(t);
      if (e.use === 'screen' && e.twin && !shown.has(e.twin)) add('IMG', page, `shows ${t} but never its ${e.theme === 'light' ? 'dark' : 'light'} twin ${e.twin}`);
    }
  }
  return problems;
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = validate(SITE);
  const ledger = JSON.parse(fs.readFileSync(path.join(SITE, LEDGER_REL), 'utf8'));
  for (const p of problems) console.log(`${p.kind.padEnd(9)} ${p.where}\n          ${p.msg}`);
  const n = (ledger.entries || []).length;
  if (problems.length) {
    console.log(`\nvalidate-art: ${problems.length} problem(s) across ${n} ledger entries.`);
    process.exit(1);
  }
  console.log(`validate-art: ${n} ledger entries clean (pinned Blender ${ledger.blender} LTS).`);
}
