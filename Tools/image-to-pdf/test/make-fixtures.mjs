// make-fixtures.mjs — writes tiny, dependency-free PNG fixtures to disk for
// smoke.mjs to feed into the tool's file input.
//
// No image library is used: each PNG is hand-assembled from raw chunks
// (IHDR/IDAT/IEND) using only node's built-in zlib for the DEFLATE stream and
// a small local CRC32 implementation for chunk checksums. This keeps the test
// suite free of any package install.

import zlib from 'node:zlib';

// ── CRC32 (PNG chunk checksum) ──────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Build a valid 8-bit RGB PNG.
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>[number,number,number]} pixelFn
 */
export function makePng(width, height, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const p = rowStart + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }

  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A small flat-color swatch — compresses to almost nothing at any quality. */
export function makeSolidPng(width, height, [r, g, b]) {
  return makePng(width, height, () => [r, g, b]);
}

/**
 * A larger pseudo-random noise image. Noise barely compresses under either
 * PNG (deflate) or JPEG (DCT), which is exactly what makes it useful for the
 * target-size test: at "original"/"high" quality the file stays big, and
 * lowering JPEG quality (or downscaling maxDim) visibly shrinks it — unlike a
 * flat swatch, where every quality tier already compresses to near-nothing.
 * A linear congruential generator keeps this seeded/deterministic (no crypto
 * dependency, reproducible across runs).
 */
export function makeNoisePng(width, height, seed = 1) {
  // xorshift32 — bitwise-only, so it stays exact in JS's 32-bit int ops
  // (unlike a classic LCG, whose multiply overflows float64's 53-bit mantissa
  // and quietly degrades into a much less random, more-compressible stream).
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s & 0xFF;
  };
  return makePng(width, height, () => [next(), next(), next()]);
}
