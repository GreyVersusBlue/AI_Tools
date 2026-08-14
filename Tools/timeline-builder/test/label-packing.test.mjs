// label-packing.test.mjs — pure-logic checks for the label de-overlap pass.
//
//   node Tools/timeline-builder/test/label-packing.test.mjs
//
// Two events one year apart are ~2px apart on a century-long axis, and a
// label is 9rem wide. Before this pass existed, the tool's only defence was
// alternating labels above and below the line, which gives exactly two slots
// — so a third close event, or any two events in the same year on the same
// side, printed one label straight on top of another. That failure is
// invisible to a smoke test that only asserts "a label element exists", and
// it is the one thing a teacher notices immediately on paper, so it is
// asserted here directly against the geometry.
//
// What matters, and what is checked:
//
//   1. packLabels never leaves two labels overlapping — same row means a
//      real horizontal gap; same x means different rows.
//   2. It never reorders anything: a label stays centred on its own marker,
//      because the fix is vertical. If the packer ever starts sliding labels
//      along the axis, the timeline starts lying about dates, so nothing
//      here may change `x` at all.
//   3. Row offsets clear the tallest label in the row beneath — a row of
//      labels with photos must push the next row past the photos.
//   4. spreadBadges separates same-year badges while keeping them centred on
//      the group and in chronological order.
//
// tlb-layout.js is a browser-style IIFE that attaches to `global`; loading it
// with the Function constructor is how the repo's other pure suites (e.g.
// vocab-flashcard-generator/test/printables-logic.test.mjs) test one without
// a build step or a second copy of the file.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const globalShim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'tlb-layout.js'), 'utf8'))(globalShim);
const L = globalShim.TimelineLayout;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const group = (name) => console.log('\n' + name);

/** Every pair of labels that share a (side, row) must be clear of each other
 *  horizontally; every pair that overlaps horizontally must be in different
 *  rows or on different sides. Checked as one predicate over all pairs, so
 *  neither half can pass by accident. */
function noOverlaps(boxes, packed, gapX) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j], pa = packed[i], pb = packed[j];
      if (pa.side !== pb.side || pa.row !== pb.row) continue;
      const aRight = a.x + a.w / 2, bLeft = b.x - b.w / 2;
      const bRight = b.x + b.w / 2, aLeft = a.x - a.w / 2;
      const clear = (bLeft - aRight) >= gapX || (aLeft - bRight) >= gapX;
      if (!clear) return `labels ${i} and ${j} share ${pa.side}|${pa.row} and overlap`;
    }
  }
  return null;
}

const box = (x, w = 144, h = 40) => ({ x, w, h });

/* ===================================================================== */
group('packLabels — the same-year case that started this');

{
  // Three events in the same year: the exact case alternation could not fix.
  const boxes = [box(500), box(500), box(500)];
  const packed = L.packLabels(boxes, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  ok(noOverlaps(boxes, packed, 6) === null, 'three same-year labels never overlap');
  const slots = packed.map(p => p.side + '|' + p.row);
  ok(new Set(slots).size === 3, 'three same-year labels take three distinct slots');
  ok(packed.every(p => p.offset >= 19), 'every label clears the line by at least the base offset');
}

{
  // A year apart on a millennium-long axis: ~2px, which is the real-world
  // version of the case above.
  const boxes = [box(300), box(302), box(304), box(306)];
  const packed = L.packLabels(boxes, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  ok(noOverlaps(boxes, packed, 6) === null, 'four labels 2px apart never overlap');
  ok(Math.max(...packed.map(p => p.row)) === 1, 'four near-coincident labels need exactly two rows per side');
}

{
  // Well-separated events must not be pushed into extra rows — the packer is
  // only allowed to spend vertical space it actually needs.
  const boxes = [box(100), box(400), box(700), box(1000)];
  const packed = L.packLabels(boxes, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  ok(packed.every(p => p.row === 0), 'spaced-out labels all stay in row 0');
  ok(packed.every(p => p.side === 'above'), 'spaced-out labels all stay above the line');
}

group('packLabels — sides, rows and heights');

{
  // Non-compact mode: one side only, so collisions have to go up in rows.
  const boxes = [box(500), box(500), box(500)];
  const packed = L.packLabels(boxes, { sides: ['above'], gapX: 6, gapY: 6, base: 19 });
  ok(packed.every(p => p.side === 'above'), 'non-compact packing stays above the line');
  ok(packed.map(p => p.row).join(',') === '0,1,2', 'non-compact collisions stack into rows');
  ok(noOverlaps(boxes, packed, 6) === null, 'non-compact stack never overlaps');
}

{
  // A tall label (one with a photo) in row 0 must push row 1 past its photo,
  // not past an assumed line count.
  const boxes = [box(500, 144, 120), box(500, 144, 30)];
  const packed = L.packLabels(boxes, { sides: ['above'], gapX: 6, gapY: 6, base: 19 });
  ok(packed[1].offset >= 19 + 120 + 6, 'row 1 clears the tallest label in row 0');
}

{
  const boxes = [box(500), box(500), box(900)];
  const packed = L.packLabels(boxes, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  ok(packed.length === boxes.length, 'every label gets a slot');
  // The returned array is parallel to the input, not to the sorted order —
  // the renderer indexes straight into it.
  const shuffled = [box(900), box(500), box(500)];
  const p2 = L.packLabels(shuffled, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  ok(p2[0].row === 0 && noOverlaps(shuffled, p2, 6) === null, 'input order is preserved in the result');
}

group('packedDepth');

{
  const boxes = [box(500, 144, 50), box(500, 144, 50), box(500, 144, 50)];
  const packed = L.packLabels(boxes, { sides: ['above', 'below'], gapX: 6, gapY: 6, base: 19 });
  const depth = L.packedDepth(packed);
  ok(depth.above >= 19 + 50, 'depth covers at least the first row above');
  ok(depth.above > depth.below, 'the side carrying two rows is reported as the deeper one');
}

group('spreadBadges');

{
  const items = [{ x: 500 }, { x: 500 }, { x: 500 }];
  const xs = L.spreadBadges(items, 22);
  ok(xs.length === 3, 'a badge position per item');
  const sorted = xs.slice().sort((a, b) => a - b);
  ok(sorted.every((v, i) => i === 0 || (v - sorted[i - 1]) >= 22 - 1e-9), 'same-year badges end up at least minSep apart');
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  ok(Math.abs(mean - 500) < 1e-9, 'the spread group stays centred on where the events really are');
}

{
  // Order along the axis must survive: badge numbers run left to right in
  // chronological order on the printed page, and a reordering would make the
  // map key point at the wrong pin.
  const items = [{ x: 100 }, { x: 105 }, { x: 110 }, { x: 400 }];
  const xs = L.spreadBadges(items, 22);
  ok(xs[0] < xs[1] && xs[1] < xs[2] && xs[2] < xs[3], 'badge order matches event order');
  ok(xs[3] === 400, 'a badge with nothing near it is not moved at all');
}

{
  // Two clusters that grow into each other must merge rather than overlap.
  const items = [{ x: 200 }, { x: 205 }, { x: 225 }, { x: 230 }];
  const xs = L.spreadBadges(items, 22);
  const sorted = xs.slice().sort((a, b) => a - b);
  ok(sorted.every((v, i) => i === 0 || (v - sorted[i - 1]) >= 22 - 1e-9), 'clusters that collide are merged and re-spread');
}

group('estimateLabelHeightPx');

{
  const short = L.estimateLabelHeightPx({ title: 'Treaty' }, { remPx: 16, widthPx: 144 });
  const long = L.estimateLabelHeightPx({ title: 'A very long event title that will certainly wrap onto several lines in a nine-rem-wide label' }, { remPx: 16, widthPx: 144 });
  const photo = L.estimateLabelHeightPx({ title: 'Treaty', photo: 'data:image/png;base64,x' }, { remPx: 16, widthPx: 144 });
  ok(long > short, 'a longer title estimates taller');
  ok(photo > short, 'a photo estimates taller');
  ok(short > 0, 'a plain label has a positive estimate');
  const blanked = L.estimateLabelHeightPx({ title: 'Treaty', photo: 'data:image/png;base64,x' }, { remPx: 16, widthPx: 144, blanked: true });
  ok(blanked < photo, 'a blanked label does not reserve room for the photo it withholds');
}

/* ===================================================================== */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:\n  ' + fails.join('\n  ')); process.exit(1); }
