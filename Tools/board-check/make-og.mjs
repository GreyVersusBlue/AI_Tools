// make-og.mjs — regenerate the social cards (og:image) under assets/og/.
//
//   node Tools/board-check/make-og.mjs
//
// A shared link to the site shows a 1200×630 card. Version 1 of that card
// (ASSET-WISHLIST.md section 4, AI-43) is made in code, not generated: this
// script lays a headline and the site name beside the existing landing hero
// (assets/art/hero/classroom-2x-light.webp) on the ink-and-paper palette of
// _shared/ink-paper.css, and screenshots it. One layout, five headlines:
// toolbook.png for index.html and the tool pages, and one card for each of
// the four design-direction pages (v1-inbox, v2-subplans, v3-bellboard,
// v4-riso).
//
// Chromium's own PNG encoder writes the card at about 195 KB. Every byte of it
// is re-encoded here as an 8-bit indexed PNG (median cut to 256 colours, no
// dither, node:zlib at level 9: the same stdlib route
// Tools/blender-art/art_common.py takes for its flat art), which lands each
// card near 60 KB with no visible change to flat paper, type or the render.
//
// Deterministic: the faces are the vendored Barlow (_shared/vendor/barlow/),
// not system fonts, so the bytes do not depend on what a machine has
// installed; the script refuses to write a card if a face failed to load.
// The same Chromium writes the same bytes. Run it by hand and commit the
// output — it is not a suite and not part of npm test.
//
// The cards are NOT precached: they are named only in <meta content>, which no
// visitor's browser downloads. check-social.mjs fails a page that names an
// og:image file missing from assets/og/. The richer Blender card (wishlist
// item 2.4) replaces toolbook.png only with Devon's go.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { serve, launch, prepPage, settle, SITE } from './harness.mjs';

const PORT = 8702;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(SITE, 'assets', 'og');
const MAX_BYTES = 120 * 1024;

// file, headline, site name. The site name is the one the page's own
// og:site_name gives, so a card never names the site differently from the
// page it is shared from. Nothing else goes on a card.
const CARDS = [
  { file: 'toolbook.png', headline: 'Classroom tools that run in your browser', site: 'AsPerMyLessonPlan.com' },
  { file: 'inbox.png', headline: 'Classroom tools, sorted like your inbox', site: 'As Per My Lesson Plan' },
  { file: 'plan.png', headline: 'Classroom tools, written up like a sub plan', site: 'As Per My Lesson Plan' },
  { file: 'board.png', headline: 'Classroom tools, posted on the bell board', site: 'As Per My Lesson Plan' },
  { file: 'handout.png', headline: 'Classroom tools, printed like a handout', site: 'As Per My Lesson Plan' },
];

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cardHtml({ headline, site }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/_shared/ink-paper.css">
<style>
  @font-face{font-family:'Barlow';font-weight:700;src:url('/_shared/vendor/barlow/barlow-latin-700-normal.woff2') format('woff2');}
  @font-face{font-family:'Barlow';font-weight:500;src:url('/_shared/vendor/barlow/barlow-latin-500-normal.woff2') format('woff2');}
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;}
  body{background:var(--paper);color:var(--ink);font-family:'Barlow',sans-serif;
    display:grid;grid-template-columns:560px 1fr;align-items:center;}
  .text{padding:0 0 0 80px;display:flex;flex-direction:column;justify-content:center;height:630px;box-sizing:border-box;}
  .rule{width:72px;height:6px;background:var(--accent-2);margin:0 0 32px;}
  h1{font-weight:700;font-size:66px;line-height:1.06;letter-spacing:-.01em;margin:0;color:var(--ink);}
  .site{font-weight:500;font-size:30px;color:var(--accent);margin:40px 0 0;}
  .art{display:flex;align-items:center;justify-content:center;height:630px;}
  .art img{width:576px;height:480px;display:block;}
  .edge{position:absolute;left:0;right:0;bottom:0;height:14px;background:var(--accent);}
</style></head>
<body>
  <div class="text"><div class="rule"></div><h1>${esc(headline)}</h1><p class="site">${esc(site)}</p></div>
  <div class="art"><img src="/assets/art/hero/classroom-2x-light.webp" alt=""></div>
  <div class="edge"></div>
</body></html>`;
}

/* ── PNG: decode Chromium's RGB(A) output, write an indexed copy ────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function decodePng(buf) {
  let off = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('expected 8-bit, non-interlaced PNG');
      type = data[9];
    } else if (kind === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`PNG colour type ${type} not handled`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = y && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 0xff;
    }
  }
  // The card is opaque (body has the paper colour), so alpha is dropped.
  const rgb = new Uint32Array(width * height);
  for (let i = 0; i < rgb.length; i++) {
    const o = i * bpp;
    rgb[i] = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
  }
  return { width, height, rgb };
}

// Median cut over the distinct colours, weighted by pixel count. Ties are
// broken by colour value, so the palette is a pure function of the pixels.
function medianCut(rgb, size = 256) {
  const counts = new Map();
  for (const c of rgb) counts.set(c, (counts.get(c) || 0) + 1);
  const colours = [...counts.keys()].sort((a, b) => a - b);
  const ch = (c, k) => (c >> (16 - 8 * k)) & 0xff;
  const boxOf = list => {
    let best = 0, axis = 0, weight = 0;
    for (let k = 0; k < 3; k++) {
      let lo = 255, hi = 0;
      for (const c of list) { const v = ch(c, k); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > best) { best = hi - lo; axis = k; }
    }
    for (const c of list) weight += counts.get(c);
    return { list, axis, range: best, weight };
  };
  let boxes = [boxOf(colours)];
  while (boxes.length < size) {
    let pick = -1, score = 0;
    boxes.forEach((b, i) => {
      const s = b.range * Math.sqrt(b.weight);
      if (b.list.length > 1 && s > score) { score = s; pick = i; }
    });
    if (pick < 0) break;
    const b = boxes[pick];
    const sorted = [...b.list].sort((p, q) => ch(p, b.axis) - ch(q, b.axis) || p - q);
    let acc = 0, cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += counts.get(sorted[i]);
      if (acc * 2 >= b.weight) { cut = i + 1; break; }
      cut = i + 1;
    }
    boxes.splice(pick, 1, boxOf(sorted.slice(0, cut)), boxOf(sorted.slice(cut)));
  }
  const palette = boxes.map(b => {
    let r = 0, g = 0, bl = 0, w = 0;
    for (const c of b.list) { const n = counts.get(c); r += ch(c, 0) * n; g += ch(c, 1) * n; bl += ch(c, 2) * n; w += n; }
    return [Math.round(r / w), Math.round(g / w), Math.round(bl / w)];
  });
  const index = new Map();
  for (const c of colours) {
    let best = 0, dist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const [r, g, b] = palette[i];
      const d = (r - ch(c, 0)) ** 2 + (g - ch(c, 1)) ** 2 + (b - ch(c, 2)) ** 2;
      if (d < dist) { dist = d; best = i; }
    }
    index.set(c, best);
  }
  return { palette, index };
}

function encodeIndexed({ width, height, rgb }) {
  const { palette, index } = medianCut(rgb);
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width + 1);
    raw[row] = 1; // Sub: runs of one colour become runs of zero.
    let prev = 0;
    for (let x = 0; x < width; x++) {
      const v = index.get(rgb[y * width + x]);
      raw[row + 1 + x] = (v - prev) & 0xff;
      prev = v;
    }
  }
  const chunk = (kind, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(kind, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 3; // 8-bit, indexed
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(palette.flat())),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(PORT);
  const browser = await launch();
  let bad = 0;
  try {
    for (const card of CARDS) {
      const page = await prepPage(browser, BASE, { width: 1200, height: 630 });
      await page.route(`${BASE}/__og-card.html`, route =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: cardHtml(card) }));
      await page.goto(`${BASE}/__og-card.html`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const ok = await page.evaluate(async () => {
        const img = document.querySelector('.art img');
        if (img.decode) await img.decode();
        return {
          fonts: document.fonts.check("700 66px 'Barlow'") && document.fonts.check("500 30px 'Barlow'")
            && [...document.fonts].filter(f => f.family.includes('Barlow')).every(f => f.status === 'loaded'),
          img: img.naturalWidth > 0,
          // The headline must fit its column on at most three lines.
          lines: Math.round(document.querySelector('h1').getBoundingClientRect().height / (66 * 1.06)),
        };
      });
      if (!ok.fonts || !ok.img || ok.lines > 3) {
        console.error(`${card.file}: not written (fonts loaded: ${ok.fonts}, hero loaded: ${ok.img}, headline lines: ${ok.lines})`);
        bad++; await page.context().close(); continue;
      }
      await settle(page, 100);
      const file = path.join(OUT, card.file);
      fs.writeFileSync(file, encodeIndexed(decodePng(await page.screenshot({ fullPage: false }))));
      const bytes = fs.statSync(file).size;
      console.log(`wrote assets/og/${card.file} (${bytes} B${bytes > MAX_BYTES ? `, OVER the ${MAX_BYTES} B budget` : ''})`);
      if (bytes > MAX_BYTES) bad++;
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(bad ? 1 : 0);
}

await main();
