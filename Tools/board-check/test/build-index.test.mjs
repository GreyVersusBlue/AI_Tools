// build-index.test.mjs — Tools/board-check/build-index.mjs and index-rows.json (AI-30, rank 70). Pure Node.
// index.html must be exactly what the data renders; each row must point at a real tool page; slugs and
// numbers are unique; the "N tools" in a category heading and the two
// page-wide counts are the counts of the data; and the renderer notices a change to a row or a count.
//   node Tools/board-check/test/build-index.test.mjs   (npm run test:build-index)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, renderRow } from '../build-index.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(site, 'Tools', 'board-check', 'index-rows.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };

ok(render(html, data) === html, 'index.html equals the render of index-rows.json');
const rows = data.categories.flatMap(c => c.rows);
const total = rows.length;
ok(total >= 90, 'at least the 90 rows the page had (' + total + ')');
ok(new Set(rows.map(r => r.tool)).size === total, 'slugs are unique');
ok(new Set(rows.map(r => r.per)).size === total, 'numbers are unique');
for (const r of rows) {
  const file = path.join(site, decodeURIComponent(r.href));
  ok(fs.existsSync(file), 'the page exists: ' + r.href);
  ok(r.chips.length >= 1 && r.chips.length <= 3, 'one to three chips: ' + r.tool);
  ok(!r.icon || /^t\d{3}$/.test(r.icon), 'icon id: ' + r.tool);
}
for (const c of data.categories) {
  const m = html.match(new RegExp('data-cat="' + c.key + '"[\\s\\S]*?<span class="cat-count">(\\d+) tools</span>'));
  ok(m && +m[1] === c.rows.length, 'category count is the row count: ' + c.key);
  const inBlock = html.match(new RegExp('<details class="cat" data-cat="' + c.key + '"[\\s\\S]*?</details>'))[0];
  ok((inBlock.match(/<a class="row ink"/g) || []).length === c.rows.length, 'rows in the page block: ' + c.key);
}
ok(new RegExp(total + ' records · local only').test(html), 'the records count is the row count');
ok(new RegExp('<dd>' + total + ' files ').test(html), 'the files count is the row count');
const live = html.slice(html.indexOf('<div class="rows" id="rows">'));
ok((live.match(/<a class="row ink"/g) || []).length === total, 'every row on the page is in the data');

// mutants: the renderer must see a changed row and a changed count
const copy = JSON.parse(JSON.stringify(data));
copy.categories[0].rows[0].pitch += ' x';
ok(render(html, copy) !== html, 'mutant: a changed pitch changes the render');
const copy2 = JSON.parse(JSON.stringify(data));
copy2.categories[1].rows.pop();
ok(render(html, copy2) !== html, 'mutant: a removed row changes the render');
ok(renderRow(rows[0]).includes('data-tool="' + rows[0].tool + '"'), 'renderRow carries the slug');
console.log(`build-index: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
