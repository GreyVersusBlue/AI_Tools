// 044 ships to every visitor, so its html must carry no real person's name or school phone numbers
// (AI-73, ML-10). Pure Node: reads the shipped page and fails if a real name or number is in it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PAGE = path.join(SITE, 'Tools', '044-Sub Plan Builder.html');
const BANNED = ['Devon Moore', '647-22'];

const html = fs.readFileSync(PAGE, 'utf8');
let failed = 0;
for (const needle of BANNED) {
  html.split('\n').forEach((line, i) => {
    if (line.includes(needle)) { failed++; console.log(`  FAIL 044 html line ${i + 1} contains "${needle}": ${line.trim().slice(0, 100)}`); }
  });
}
console.log(failed ? `${failed} personal string(s) in 044` : `ok: 044 html has none of ${BANNED.map(b => `"${b}"`).join(', ')}`);
process.exit(failed ? 1 : 0);
