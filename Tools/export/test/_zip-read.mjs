// _zip-read.mjs — a zip reader written for the export suites, so that what
// ExportKit.toZip() and toXlsx() write is read back by something that is not
// the library that wrote it. It walks the end-of-central-directory record,
// the central directory and each local header, inflates with node:zlib, and
// works every CRC-32 out itself. No zip64, no encryption: neither is written.

import zlib from 'node:zlib';

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Every entry of the zip in `bytes`, in central-directory order:
    { name, utf8, method, crc, size, data, crcOk, localName }. Throws on a
    file that is not a zip. */
export function readZip(bytes) {
  const b = Buffer.from(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i >= b.length - 22 - 65535; i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');
  const count = b.readUInt16LE(eocd + 10);
  let at = b.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory entry ' + n);
    const flags = b.readUInt16LE(at + 8), method = b.readUInt16LE(at + 10);
    const crc = b.readUInt32LE(at + 16), packed = b.readUInt32LE(at + 20), size = b.readUInt32LE(at + 24);
    const nameLen = b.readUInt16LE(at + 28), extraLen = b.readUInt16LE(at + 30), commentLen = b.readUInt16LE(at + 32);
    const local = b.readUInt32LE(at + 42);
    const name = b.subarray(at + 46, at + 46 + nameLen).toString('utf8');
    if (b.readUInt32LE(local) !== 0x04034b50) throw new Error('bad local header for ' + name);
    const lName = b.readUInt16LE(local + 26), lExtra = b.readUInt16LE(local + 28);
    const localName = b.subarray(local + 30, local + 30 + lName).toString('utf8');
    const raw = b.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + packed);
    const data = method === 0 ? Buffer.from(raw) : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (data === null) throw new Error('unsupported compression method ' + method + ' for ' + name);
    out.push({ name, localName, utf8: !!(flags & 0x800), method, crc, size, data, crcOk: data.length === size && crc32(data) === crc });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
