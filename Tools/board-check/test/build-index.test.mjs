// build-index.test.mjs — Tools/board-check/build-index.mjs and index-rows.json (AI-30, rank 70). Pure Node.
// index.html must be exactly what the data renders; each row must point at a real tool page; slugs and
// numbers are unique; the "N tools" in a category heading and the two
// page-wide counts are the counts of the data; and the renderer notices a change to a row or a count.
// README.md's tools table (AI-44) is the same data's render too, in readmeOrder, and its mutants are seen.
//   node Tools/board-check/test/build-index.test.mjs   (npm run test:build-index)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, renderRow, renderCategory, renderReadme, renderReadmeTable, decodeEntities, README_START, README_END } from '../build-index.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const md = fs.readFileSync(path.join(site, 'README.md'), 'utf8');
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
  const m = html.match(new RegExp('data-cat="' + c.key + '"[\\s\\S]*?<span class="cat-count">(\\d+) tools?</span>'));
  ok(m && +m[1] === c.rows.length, 'category count is the row count: ' + c.key);
  ok(m && m[0].endsWith(c.rows.length === 1 ? ' tool</span>' : ' tools</span>'), 'category count is singular for one tool (AI-63, L13): ' + c.key);
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
// one row reads "1 tool", any other count "N tools" (AI-63, L13: Platform-Wide said "1 tools")
const one = { key: 'x', title: 'X', rows: [rows[0]] };
ok(renderCategory(one).includes('<span class="cat-count">1 tool</span>'), 'a one-row category says "1 tool"');
ok(renderCategory({ ...one, rows: [rows[0], rows[1]] }).includes('<span class="cat-count">2 tools</span>'), 'a two-row category says "2 tools"');
ok(renderCategory({ ...one, rows: [] }).includes('<span class="cat-count">0 tools</span>'), 'an empty category says "0 tools"');
ok(renderRow(rows[0]).includes('data-tool="' + rows[0].tool + '"'), 'renderRow carries the slug');

// README.md's tools table (AI-44): the same rows, README's own wording, README's own order
ok(renderReadme(md, data) === md, 'README.md equals the render of index-rows.json');
ok(md.split(README_START).length === 2 && md.split(README_END).length === 2, 'README.md has one start and one end marker');
const table = md.slice(md.indexOf(README_START), md.indexOf(README_END)).split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Tool |'));
ok(table.length === total, 'the README table has a line per row (' + table.length + ')');
ok(new Set(data.readmeOrder).size === total && data.readmeOrder.length === total, 'readmeOrder names every row once');
for (const r of rows) {
  ok(typeof r.readme === 'string' && r.readme.length > 0 && !r.readme.includes('\n'), 'a one-line readme text: ' + r.tool);
  ok(table.some(l => l.includes('| `' + decodeURIComponent(r.href) + '` |')), 'the README names the file: ' + r.tool);
}
ok(table.some(l => l.startsWith('| Image → PDF Assembler |')), 'an entity in a name is a character in the README');
ok(table.some(l => l.startsWith('| Command Center |')), 'readmeName wins over the landing-page name');
ok(decodeEntities('A &amp; B &ndash; C') === 'A & B – C', 'decodeEntities turns the page\'s entities into characters');
const throws = f => { try { f(); return false; } catch { return true; } };
ok(throws(() => decodeEntities('&hellip;')), 'an entity with no README spelling is an error, not a guess');
const m1 = JSON.parse(JSON.stringify(data)); m1.categories[0].rows[0].readme += ' x';
ok(renderReadme(md, m1) !== md, 'mutant: a changed readme text changes the README');
const m2 = JSON.parse(JSON.stringify(data)); m2.readmeOrder.pop();
ok(throws(() => renderReadmeTable(m2)), 'mutant: a row missing from readmeOrder is an error');
const m3 = JSON.parse(JSON.stringify(data)); m3.readmeOrder.push(m3.readmeOrder[0]);
ok(throws(() => renderReadmeTable(m3)), 'mutant: a row named twice in readmeOrder is an error');
const m4 = JSON.parse(JSON.stringify(data)); m4.readmeOrder.reverse();
ok(renderReadme(md, m4) !== md, 'mutant: a different order changes the README');
const m5 = JSON.parse(JSON.stringify(data)); delete m5.categories[2].rows[0].readme;
ok(throws(() => renderReadmeTable(m5)), 'mutant: a row with no readme text is an error');
ok(throws(() => renderReadme(md.replace(README_END, ''), data)), 'a README without its end marker is an error');
ok(render(html, data) === html, 'the README fields leave index.html unchanged');
console.log(`build-index: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
