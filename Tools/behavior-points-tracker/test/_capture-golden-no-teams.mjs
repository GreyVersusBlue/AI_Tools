// _capture-golden-no-teams.mjs — records golden-no-teams.json from the page.
//
//   node Tools/behavior-points-tracker/test/_capture-golden-no-teams.mjs
//
// Run ONCE against the page as it was before team / house points (main at
// 9dafbcf) and committed. Re-recording it from a page that has teams in it
// would make the check meaningless; do not.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage } from '../../board-check/harness.mjs';
import { walk } from './_golden-run.mjs';

const PORT = 8516;
const BASE = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
const out = await walk(page, BASE + '/Tools/008-behavior-points-tracker.html');
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden-no-teams.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', file, Object.keys(out).join(' '), 'errors:', JSON.stringify(page.__errs));
await browser.close(); server.close();
