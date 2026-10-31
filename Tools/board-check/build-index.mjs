#!/usr/bin/env node
// build-index.mjs — writes (or checks) the tool rows of index.html from index-rows.json (AI-30, rank 70).
//
//   node Tools/board-check/build-index.mjs            rewrite index.html's category blocks and the two
//                                                     page-wide counts ("N records", "N files")
//   node Tools/board-check/build-index.mjs --check    exit 1 if index.html is not what the data renders
//                                                     (npm run check:index; runs in CI)
//
// index.html stays a plain static page: the rows are committed HTML, so the page works from file://,
// is read as-is by crawlers, check:social, check:registry, check:precache and the offline copy, and
// needs no script to show its tools. What changed is where a person edits: a new tool is one object in
// index-rows.json (its category, number, name, pitch, tags, grade), and the "N tools" in each category
// heading and the two page-wide counts are COUNTED from the data, not typed. The scribble in a row's grade
// mark is data too; copy one from a neighbour. Everything outside the category blocks (the head, the
// pinned "My Tools" shell, the progress log, the scripts) is still edited by hand in index.html.
//
// Fields of a row: d (entrance delay, optional), href, tool (slug), tags, filterTags, per (the number),
// name, pitch, comment (raw HTML text: write &amp; and &rsquo; as the page does), chips (the three
// visible tag spans), grade, gradeTitle, scribble (the grade circle's path), and optionally pin (when
// the pin button's name differs from `name`) and icon (a sprite id like "t007").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(here, '..', '..');
const INDEX = path.join(SITE, 'index.html');
const DATA = path.join(here, 'index-rows.json');

const CARET = '      <span class="caret" aria-hidden="true"><svg width="9" height="10" viewBox="0 0 9 10" fill="none"><path d="M2 1.5L6.5 5 2 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>\n';
const STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.6l2.47 5 5.53.8-4 3.9.94 5.5L12 16.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const ARROW = '<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="M1 5h9M6 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

export function renderRow(r) {
  const style = r.d ? ` style="--d:${r.d}"` : '';
  const icon = r.icon ? `        <svg class="tool-icon" aria-hidden="true"><use href="assets/art/icons/tools.svg#${r.icon}"/></svg>\n` : '';
  const chips = r.chips.map(c => `<span data-tag="${c}">${c}</span>`).join('');
  return `    <a class="row ink"${style} href="${r.href}"\n` +
    `       data-tool="${r.tool}" data-tags="${r.tags}"\n` +
    `       data-filter-tags="${r.filterTags}">\n` +
    `      <span class="per"><span class="lbl">Per</span><b>${r.per}</b> <span class="pin" role="button" tabindex="0" aria-pressed="false" aria-label="Pin ${r.pin || r.name} to My Tools" data-pin>${STAR}</span></span>\n` +
    `      <span>\n${icon}` +
    `        <span class="name">${r.name}</span>\n` +
    `        <span class="pitch">${r.pitch}</span>\n` +
    `        <span class="comment" aria-hidden="true">${r.comment}</span>\n` +
    `      </span>\n` +
    `      <span class="tags">${chips}</span>\n` +
    `      <span class="grade" title="${r.gradeTitle}">${r.grade}\n` +
    `        <svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="${r.scribble}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>\n` +
    `      </span>\n` +
    `      <span class="open">Open${ARROW}</span>\n` +
    `    </a>\n`;
}

export function renderCategory(c) {
  const style = c.d ? ` style="--d:${c.d}"` : '';
  return `    <details class="cat" data-cat="${c.key}"${c.open ? ' open' : ''}>\n` +
    `    <summary class="section-head ink"${style}>\n${CARET}` +
    `      <h2>${c.title}</h2>\n` +
    `      <span class="cat-count">${c.rows.length} tools</span>\n` +
    `    </summary>\n\n` +
    c.rows.map(renderRow).join('\n') +
    `    </details>\n`;
}

export function render(html, data) {
  const first = html.indexOf('    <details class="cat" data-cat="' + data.categories[0].key + '"');
  const endMark = '\n  </div>\n';
  const lastCat = html.lastIndexOf('    </details>\n', html.indexOf(endMark, first));
  if (first < 0 || lastCat < 0) throw new Error('build-index: could not find the category blocks in index.html');
  const end = lastCat + '    </details>\n'.length;
  const total = data.categories.reduce((n, c) => n + c.rows.length, 0);
  let out = html.slice(0, first) + data.categories.map(renderCategory).join('\n') + html.slice(end);
  out = out.replace(/\d+ records( · local only)/, total + ' records$1').replace(/<dd>\d+ files /, '<dd>' + total + ' files ');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = render(html, data);
  const total = data.categories.reduce((n, c) => n + c.rows.length, 0);
  if (process.argv.includes('--check')) {
    if (out !== html) {
      let i = 0; while (i < out.length && out[i] === html[i]) i++;
      const line = html.slice(0, i).split('\n').length;
      console.log(`check-index: FAIL — index.html differs from what index-rows.json renders (first difference near line ${line}). Edit the data and run: node Tools/board-check/build-index.mjs`);
      process.exit(1);
    }
    console.log(`check-index: OK — index.html is exactly what index-rows.json renders (${data.categories.length} categories, ${total} rows).`);
  } else {
    if (out !== html) fs.writeFileSync(INDEX, out);
    console.log(`build-index: ${out !== html ? 'rewrote' : 'no change to'} index.html (${data.categories.length} categories, ${total} rows).`);
  }
}
