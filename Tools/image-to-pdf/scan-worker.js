/* scan-worker.js — runs Scan (scan.js) off the page's thread for 011's scanner (Path 17 P2).
 *
 * One job per message, one at a time, so a cancelled batch is a message not sent.
 *   in:  { id, op: 'detect' | 'process', buffer, w, h, quad?, mode?, maxDim? }
 *        `buffer` is the photo's RGBA bytes, transferred.
 *   out: detect  -> { id, quad, confidence, method }
 *        process -> { id, buffer, w, h }   (the finished page, transferred)
 *        either  -> { id, error } when it threw
 */
/* global importScripts */
importScripts('scan.js');

self.onmessage = function (ev) {
  var m = ev.data, out = { id: m.id };
  try {
    var img = { data: new Uint8ClampedArray(m.buffer), width: m.w, height: m.h };
    if (m.op === 'detect') {
      var d = self.Scan.detect(img);
      var quad = d.quad;
      if (d.method === 'edges') {
        try { quad = self.Scan.refine(img, d.quad); } catch (e) { quad = d.quad; }
      }
      out.quad = quad; out.confidence = d.confidence; out.method = d.method;
      self.postMessage(out);
    } else if (m.op === 'process') {
      var r = self.Scan.process(img, { quad: m.quad, mode: m.mode, maxDim: m.maxDim });
      out.buffer = r.imageData.data.buffer; out.w = r.w; out.h = r.h;
      self.postMessage(out, [out.buffer]);
    } else {
      throw new Error('Unknown scan job');
    }
  } catch (e) {
    out = { id: m.id, error: String(e && e.message || e) };
    self.postMessage(out);
  }
};
