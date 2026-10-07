// record-golden.mjs — writes golden-old-groupings.json from the page AS IT IS.
// Run once, on the page before the year memory and roles existed, and never
// again: the point of the file is that it came from the old page.
//   node Tools/group-team-generator/test/record-golden.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';
import { SCENARIOS, runScenario } from './_golden-scenarios.mjs';

const PORT = 8514, BASE = `http://127.0.0.1:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
const server = await serve(PORT);
const browser = await launch();
const out = { recordedAt: process.argv[2] || 'unknown', scenarios: {} };
for (const sc of SCENARIOS) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const r = await runScenario(page, BASE, sc);
  out.scenarios[sc.id] = { steps: r.steps, savedSha256: crypto.createHash('sha256').update(r.saved).digest('hex'), savedLength: r.saved.length };
  console.log(sc.id, r.steps.map(s => s.groups.length + 'g').join(' '), r.saved.length);
  await page.context().close();
}
fs.writeFileSync(path.join(here, 'golden-old-groupings.json'), JSON.stringify(out, null, 1) + '\n');
await browser.close(); server.close?.();
process.exit(0);
