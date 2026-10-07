// record-golden.mjs — writes golden-old-sheets.json from the page as it is
// NOW. Run once on the page as it was before scaffolds (commit 529c79c); the
// suite then compares every later page with scaffolds off to it.
//
//   node Tools/writing-prompt-generator/test/record-golden.mjs
import fs from 'node:fs';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';
import { SCENARIOS, captureScenario } from './_capture.mjs';

const PORT = 8524;
const BASE = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();
const golden = { recordedFrom: '529c79c (the page before sentence starters and stuck lines)', scenarios: {} };
for (const sc of SCENARIOS) {
  const { hashes } = await captureScenario(browser, BASE, sc, prepPage);
  golden.scenarios[sc.name] = hashes;
  console.log(sc.name, hashes.prompts.map(p => p.slice(0, 40)).join(' | '));
}
await browser.close();
server.close();
fs.writeFileSync(new URL('./golden-old-sheets.json', import.meta.url), JSON.stringify(golden, null, 2) + '\n');
console.log('wrote golden-old-sheets.json');
