// Path 11 P2: hold 035's page size to its ledger (size-ledger.json).
// Pure Node, no browser. The page is measured as bytes on disk
// (fs.statSync), the figure every note about this file has used. It fails
// when the page is larger than the ledger's line, so nothing creeps back in,
// and when it is more than SLACK smaller, so the line is lowered in the same
// commit that shrinks the page (the inline-sinks ratchet's shape). Each
// module named in the ledger must exist; its bytes are a record, not a cap.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PAGE = 'Tools/035-schedule-visualizer.html';
const SLACK = 2048;
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'Tools/schedule-visualizer/test/size-ledger.json'), 'utf8'));

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

const size = fs.statSync(path.join(ROOT, PAGE)).size;
check(size <= ledger.page, `${PAGE} is ${size} bytes, at most the ledger's ${ledger.page}`);
check(size >= ledger.page - SLACK, `${PAGE} is ${size} bytes, within ${SLACK} of the ledger's ${ledger.page} (lower the line when the page shrinks)`);
for (const [file, bytes] of Object.entries(ledger.modules)) {
  const p = path.join(ROOT, file);
  check(fs.existsSync(p), `${file} exists (recorded at ${bytes} bytes${fs.existsSync(p) ? `, now ${fs.statSync(p).size}` : ''})`);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
