// smoke-publish-baseline.mjs — 035's Publish, regenerated and diffed (Path 11 P1).
//
//   node Tools/schedule/test/smoke-publish-baseline.mjs            (or: npm run test:schedule-publish)
//   node Tools/schedule/test/smoke-publish-baseline.mjs --update   rewrite the baseline; its diff is the review
//
// Imports the Northwind fixture into 035 with the page's clock pinned to
// 2026-01-15 17:00 UTC (noon on the east coast, the same date in every US zone
// and in UTC), presses Publish in code, and compares the file with the
// committed baseline-northwind.html section by section: page head, fonts,
// BR_CSS, overrides, markup, then each piece of the script. The 103 KB font
// block is stored as one line with its SHA-256 and length, so the baseline is
// text a person can read in a PR. A mismatch names every section that moved
// and prints the first differing line of each side.
//
// It also holds the static guard (npm run check:publisher) to the browser:
// check-publisher.mjs's assemble() must equal the real published <script>
// byte for byte, which is what entitles that guard to speak for the page
// with no browser. And the published data must meet the contract
// (published-contract.mjs) with no error and no warning.
//
// The baseline changes on purpose when 035's publisher does: run --update,
// read the diff, commit it with the change. A change you did not mean is the
// thing this exists to catch.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { publishFromFixture } from './publish.mjs';
import { readPublisher, assemble } from '../../board-check/check-publisher.mjs';
import { readEmbedded, validate } from './published-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, 'baseline-northwind.html');
const PORT = 8551;
const NOW = '2026-01-15T17:00:00Z';
const UPDATE = process.argv.includes('--update');

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

/** Replace the font CSS (everything between <style> and BR_CSS) with one line. */
export function stripFonts(html, cssStart) {
  const a = html.indexOf('<style>\n') + '<style>\n'.length;
  const b = html.indexOf(cssStart, a);
  if (a < '<style>\n'.length || b < 0) throw new Error('could not find the font block');
  const fonts = html.slice(a, b);
  const sha = crypto.createHash('sha256').update(fonts).digest('hex');
  return html.slice(0, a) + `/* fonts: sha256 ${sha}, ${Buffer.byteLength(fonts)} bytes */\n` + html.slice(b);
}

/** Cut a (font-stripped) published file into named sections. */
export function sections(html) {
  const lines = html.replace(/\r/g, '').split('\n');
  const out = new Map();
  let name = 'page head', inScript = false, pastFns = false;
  const put = l => { if (!out.has(name)) out.set(name, []); out.get(name).push(l); };
  for (const l of lines) {
    if (!inScript) {
      if (l.startsWith('/* fonts: sha256')) { name = 'fonts'; put(l); name = 'BR_CSS'; continue; }
      if (l === '/* published overrides */') name = 'overrides';
      else if (l.startsWith('<body')) name = 'markup';
      else if (l === '<script>') { inScript = true; name = 'preamble'; }
      put(l);
      continue;
    }
    let m;
    if (l === '</script>') name = 'page end';
    else if ((m = /^function\s+([\w$]+)/.exec(l))) { name = 'function ' + m[1]; pastFns = true; }
    else if ((m = /^const\s+([\w$]+)\s*=/.exec(l))) name = m[1] === 'PUBLISHED_DATA' ? 'data' : 'const ' + m[1];
    else if (/^let\s/.test(l) && !pastFns) name = 'preamble';
    else if (pastFns && /^(?:[\w$]+\(\);|if \(!Object\.keys)/.test(l)) name = 'boot';
    put(l);
  }
  return new Map([...out].map(([k, v]) => [k, v.join('\n')]));
}

/** Every section that differs, with the first differing line of each side. */
export function compare(baseline, actual) {
  const a = sections(baseline), b = sections(actual);
  const diffs = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k), y = b.get(k);
    if (x === y) continue;
    if (x === undefined || y === undefined) { diffs.push({ section: k, baseline: x === undefined ? '(absent)' : '(present)', now: y === undefined ? '(absent)' : '(present)' }); continue; }
    const xl = x.split('\n'), yl = y.split('\n');
    let i = 0;
    while (i < xl.length && xl[i] === yl[i]) i++;
    diffs.push({ section: k, line: i + 1, baseline: xl[i] ?? '(ends)', now: yl[i] ?? '(ends)' });
  }
  // Same sections in another order (a function moved in the list).
  if (!diffs.length && JSON.stringify([...a.keys()]) !== JSON.stringify([...b.keys()])) {
    const ak = [...a.keys()], bk = [...b.keys()];
    const i = ak.findIndex((k, j) => k !== bk[j]);
    diffs.push({ section: 'order', baseline: ak[i], now: bk[i] });
  }
  return diffs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Schedule — Publish against the committed baseline (Path 11 P1)');
  const run = await publishFromFixture({ now: NOW, port: PORT, quiet: true });
  try {
    const html = run.html;
    const site035 = fs.readFileSync(path.join(HERE, '..', '..', '035-schedule-visualizer.html'), 'utf8');
    const pub = readPublisher(site035);
    ok(pub.problems.length === 0, 'the static guard reads the publisher: ' + JSON.stringify(pub.problems));
    ok(run.errs.length === 0, 'no page errors while publishing: ' + JSON.stringify(run.errs));
    ok(run.blocked.length === 0, 'no offsite requests: ' + JSON.stringify(run.blocked));

    // The guard against the browser.
    const s0 = html.indexOf('\n<script>\n') + '\n<script>\n'.length;
    const s1 = html.lastIndexOf('\n<\/script>');
    const realScript = html.slice(s0, s1);
    const data = readEmbedded(html);
    const guessed = assemble(pub, data);
    if (!ok(guessed === realScript, "check-publisher's assemble() equals the published <script> byte for byte")) {
      const a = guessed.split('\n'), b = realScript.split('\n');
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      console.log(`    first difference at script line ${i + 1}:\n    guard:   ${(a[i] ?? '(ends)').slice(0, 160)}\n    browser: ${(b[i] ?? '(ends)').slice(0, 160)}`);
    }

    // The data against the contract.
    const v = validate(data);
    ok(v.ok && v.warnings.length === 0, `the published data meets the contract at format ${v.format}, no warnings: `
      + JSON.stringify({ errors: v.errors, warnings: v.warnings }));
    ok(data.publishedOn === '2026-01-15', `the pinned clock gives publishedOn 2026-01-15 (got ${data.publishedOn})`);
    ok(html.includes('Published January 15, 2026 from'), 'the footnote says January 15, 2026 '
      + '(if not, the browser locale is not en-US: run under LANG=en_US.UTF-8)');

    // The baseline.
    const stripped = stripFonts(html, pub.css.split('\n')[0]);
    if (UPDATE || !fs.existsSync(BASELINE)) {
      fs.writeFileSync(BASELINE, stripped);
      console.log(`  wrote ${path.basename(BASELINE)} (${Buffer.byteLength(stripped)} bytes)${UPDATE ? '' : ' — it did not exist; commit it'}`);
    } else {
      const diffs = compare(fs.readFileSync(BASELINE, 'utf8'), stripped);
      if (!ok(diffs.length === 0, 'the published file matches baseline-northwind.html')) {
        for (const d of diffs) {
          console.log(`    section "${d.section}"${d.line ? ', line ' + d.line : ''}:\n      baseline: ${String(d.baseline).slice(0, 160)}\n      now:      ${String(d.now).slice(0, 160)}`);
        }
        console.log('    If the change is meant, run with --update and commit the baseline\'s diff with it.');
      }
    }

    // The comparator, broken on purpose on the output itself: each edit must
    // be named by its own section and only that one.
    const base = fs.readFileSync(BASELINE, 'utf8');
    const only = (label, edited, want) => {
      const d = compare(base, edited).map(x => x.section);
      ok(JSON.stringify(d) === JSON.stringify([want]), `a break is named: ${label} → ${JSON.stringify(d)}, want ["${want}"]`);
    };
    const swap = (s, a, b) => { if (!s.includes(a)) throw new Error('edit not found: ' + a); return s.replace(a, b); };
    only('one CSS declaration changed', swap(base, '#app-browser {', '#app-browser {\n  outline: 0;'), 'BR_CSS');
    only('the footnote reworded', swap(base, 'This file is a read-only snapshot', 'This file is a snapshot'), 'markup');
    {
      const d = readEmbedded(base);
      const t = Object.keys(d.teachers)[0];
      delete d.teachers[t].co;
      const line = base.split('\n').find(l => l.startsWith('const PUBLISHED_DATA = '));
      only('a property dropped from a teacher record', base.replace(line, 'const PUBLISHED_DATA = ' + JSON.stringify(d) + ';'), 'data');
    }
    {
      // Two functions swapped in the list (both are one line long).
      const lines = base.split('\n');
      const i1 = lines.findIndex(l => l.startsWith('function brJumpTeacher('));
      const i2 = lines.findIndex(l => l.startsWith('function brJumpGroup('));
      ok(i1 > 0 && i2 > 0 && !lines[i1].endsWith('{') && !lines[i2].endsWith('{'), 'the baseline has brJumpTeacher and brJumpGroup on one line each');
      {
        [lines[i1], lines[i2]] = [lines[i2], lines[i1]];
        const swapped = lines.join('\n');
        only('two functions swapped in the list', swapped, 'order');
      }
    }
  } finally {
    await run.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
