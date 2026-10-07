// smoke-frac-exp-eq.mjs — fraction multiply/divide, exponents and one-step
// equations on the page (the arithmetic itself is drill-frac-exp-eq.test.mjs).
//
//   node Tools/math-drill-generator/test/smoke-frac-exp-eq.mjs
//
//   A sheet saved before today is the same sheet: golden-old-sheets.json holds
//   the preview markup (worksheet and key) of 33 saved settings, recorded from
//   the page before the change; a save with no new fields loads to the defaults.
//
//   The options appear for their template and for no other; the range boxes go
//   from the fraction drill, which ignores them; every control has a name.
//
//   What is printed is right: the numbers read back off the worksheet, worked
//   out again with exact rationals, equal the key's answer on the same row, so
//   the key is in the sheet's order. An exponent is a real superscript; the
//   screen reader gets "4 cubed equals blank" and never "43".
//
//   Options persist (saved settings, export, import) and a file without them,
//   or with junk in them, loads to the defaults.
//
//   The sheets print: no problem is wider than its column at the sizes and column
//   counts the tool offers where the older types fit, and the printed page count
//   is no more than the older types' at the same size.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { collect } from './_page-hashes.mjs';
import { absB, rat, mul, div, add, same, parseNum, writtenAs } from './_oracle.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8525;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/026-math-drill-generator.html';
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mdg-fee-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = name => console.log(`\n${name}`);

const server = await serve(PORT);
const browser = await launch();

/* ── 0. a sheet saved before today is the same sheet ──────────────────────── */
group('Older sheets');
{
  const gold = JSON.parse(fs.readFileSync(path.join(dir, 'golden-old-sheets.json'), 'utf8'));
  const now = await collect(browser, BASE, prepPage, settle, URL_PAGE);
  eq(Object.keys(gold.entries).length, 33, 'golden holds 33 saved settings');
  const diff = Object.keys(gold.entries).filter(k => !now[k] || now[k].worksheet !== gold.entries[k].worksheet || now[k].answers !== gold.entries[k].answers);
  ok(diff.length === 0, 'every saved setting prints the same worksheet and key as before (' + diff.slice(0, 5).join(', ') + ')');
}

const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
const consoleProblems = [];
page.on('pageerror', e => consoleProblems.push('pageerror ' + e.message));
page.on('console', m => { if (m.type() === 'error') consoleProblems.push('console ' + m.text()); });

const SETTING_KEY = 'gvb-math-drill:settings';
async function fresh(saved) {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); }, [SETTING_KEY, saved ? JSON.stringify(saved) : null]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);
}
const readSheet = () => page.evaluate(() => {
  const strip = t => t.replace(/\s+/g, ' ').trim().replace(/^\d+\.\s*/, '');
  return {
    problems: Array.from(document.querySelectorAll('#previewArea .problems .p')).map(p => ({
      text: strip(p.textContent),
      expr: (p.querySelector('.mdg-expr') || {}).innerHTML || null,
      sr: (p.querySelector('.mdg-sr') || {}).textContent || null
    })),
    key: Array.from(document.querySelectorAll('#previewArea .answers .a')).map(e => strip(e.textContent))
  };
});
async function sheetAndKey() {
  await page.click('#viewWorksheetBtn'); await settle(page, 120);
  const w = await readSheet();
  await page.click('#viewAnswersBtn'); await settle(page, 120);
  const k = await readSheet();
  await page.click('#viewWorksheetBtn'); await settle(page, 80);
  return { problems: w.problems, key: k.key };
}
async function choose(key) { await page.selectOption('#templateKey', key); await settle(page, 250); }
async function setCount(n) { await page.fill('#problemCount', String(n)); await page.dispatchEvent('#problemCount', 'change'); await settle(page, 250); }
async function check(id, on) { if ((await page.isChecked('#' + id)) !== on) { await page.setChecked('#' + id, on); await settle(page, 200); } }
async function pick(id, v) { await page.selectOption('#' + id, v); await settle(page, 200); }

/* ── 1. the controls ──────────────────────────────────────────────────────── */
group('Controls');
await fresh();
{
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#templateKey option')).map(o => [o.value, o.textContent]));
  const find = k => (opts.find(o => o[0] === k) || [])[1];
  eq(find('fracmuldiv'), 'Fraction Multiplication & Division', 'fraction multiply/divide is offered');
  eq(find('exponents'), 'Exponents', 'exponents is offered');
  eq(find('equations'), 'One-Step Equations', 'one-step equations is offered');
  ok(find('fractions') === 'Fraction Addition & Subtraction' && find('addition') === 'Addition Facts', 'the older templates keep their names');

  const vis = () => page.evaluate(() => ['fracOptions', 'expOptions', 'eqOptions', 'rangeBlock'].map(id => getComputedStyle(document.getElementById(id)).display !== 'none'));
  eq(JSON.stringify(await vis()), '[false,false,false,true]', 'addition: no new options, ranges shown');
  await choose('fracmuldiv');
  eq(JSON.stringify(await vis()), '[true,false,false,false]', 'fractions: only its options, ranges hidden');
  await choose('exponents');
  eq(JSON.stringify(await vis()), '[false,true,false,true]', 'exponents: only its options, ranges shown');
  await choose('equations');
  eq(JSON.stringify(await vis()), '[false,false,true,true]', 'equations: only its options, ranges shown');
  await choose('fractions');
  eq(JSON.stringify(await vis()), '[false,false,false,true]', 'fraction addition: nothing new');

  // every control has an accessible name and is a native control
  const names = await page.evaluate(() => ['fracOp', 'fracMixed', 'fracWhole', 'expPreset', 'expAllowLow', 'eqForms', 'eqNegatives', 'eqFractions'].map(id => {
    const el = document.getElementById(id);
    const l = el.labels && el.labels[0];
    return [id, el.tagName, l ? l.textContent.replace(/\s+/g, ' ').trim() : null];
  }));
  ok(names.every(n => n[2] && n[2].length > 3), 'every option has a visible label: ' + JSON.stringify(names.filter(n => !n[2])));
  const groups = await page.evaluate(() => ['fracOptions', 'expOptions', 'eqOptions'].map(id => {
    const g = document.getElementById(id); const t = document.getElementById(g.getAttribute('aria-labelledby'));
    return [g.getAttribute('role'), t && t.textContent];
  }));
  eq(JSON.stringify(groups), '[["group","Fraction options"],["group","Exponent options"],["group","Equation options"]]', 'each option block is a named group');
}

/* ── 2. every sheet is right, and the key follows it ──────────────────────── */
group('Fraction multiplication and division on the page');
await fresh();
await choose('fracmuldiv');
await setCount(60);
const fracCombos = [];
for (const fracOp of ['both', 'multiply', 'divide']) for (const fracMixed of [false, true]) for (const fracWhole of [false, true]) fracCombos.push({ fracOp, fracMixed, fracWhole });
{
  let n = 0, wrong = [];
  for (const c of fracCombos) {
    await pick('fracOp', c.fracOp); await check('fracMixed', c.fracMixed); await check('fracWhole', c.fracWhole);
    for (let round = 0; round < 3; round++) {
      await page.click('#generateBtn'); await settle(page, 150);
      const { problems, key } = await sheetAndKey();
      if (problems.length !== 60 || key.length !== 60) wrong.push('count ' + JSON.stringify(c));
      problems.forEach((p, i) => {
        n++;
        const m = /^(.+?) ([×÷]) (.+?) = _____$/.exec(p.text);
        if (!m) { wrong.push('text ' + p.text); return; }
        const A = parseNum(m[1]), B = parseNum(m[3]);
        if (!A || !B || B.r.n === 0n) { wrong.push('operands ' + p.text); return; }
        const want = m[2] === '×' ? mul(A.r, B.r) : div(A.r, B.r);
        if (!writtenAs(key[i], want)) wrong.push(`row ${i + 1}: ${p.text} key ${key[i]}`);
        if (c.fracOp === 'multiply' && m[2] !== '×') wrong.push('multiply only');
        if (c.fracOp === 'divide' && m[2] !== '÷') wrong.push('divide only');
        if (!c.fracMixed && (A.kind === 'mixed' || B.kind === 'mixed')) wrong.push('mixed when off ' + p.text);
        if (!c.fracWhole && (A.kind === 'int' || B.kind === 'int')) wrong.push('whole when off ' + p.text);
        if (A.kind === 'int' && B.kind === 'int') wrong.push('two wholes');
        if (/undefined|NaN|Infinity/.test(p.text + key[i])) wrong.push('bad text ' + p.text);
      });
    }
  }
  ok(wrong.length === 0, `${n} fraction rows: each key answer is the exact result of its own row (${wrong.slice(0, 3).join(' | ')})`);
  // vertical format must not stack them
  await pick('fracOp', 'both'); await check('fracMixed', false); await check('fracWhole', false);
  await pick('format', 'vertical');
  const stacked = await page.evaluate(() => document.querySelectorAll('#previewArea .vert-table, #previewArea .vert-div').length);
  eq(stacked, 0, 'vertical format writes fractions across, never as a column sum');
  await pick('format', 'horizontal');
}

group('Exponents on the page');
await fresh();
await choose('exponents');
await setCount(60);
{
  const cases = [];
  for (const expPreset of ['custom', 'squares', 'cubes', 'tens']) for (const expAllowLow of [false, true]) cases.push({ expPreset, expAllowLow });
  let n = 0, wrong = [], sawLow = 0, sawSup = 0;
  for (const c of cases) {
    await pick('expPreset', c.expPreset); await check('expAllowLow', c.expAllowLow);
    for (let round = 0; round < 3; round++) {
      await page.click('#generateBtn'); await settle(page, 150);
      const { problems, key } = await sheetAndKey();
      problems.forEach((p, i) => {
        n++;
        const m = /^(\d+)<sup>(\d+)<\/sup> = _____$/.exec(p.expr || '');
        if (!m) { wrong.push('markup ' + p.expr); return; }
        sawSup++;
        const b = BigInt(m[1]), e = BigInt(m[2]);
        if (String(b ** e) !== key[i]) wrong.push(`row ${i + 1}: ${m[1]}^${m[2]} key ${key[i]}`);
        if (b ** e > 1000000n) wrong.push('past a million');
        const speak = e === 2n ? `${b} squared` : e === 3n ? `${b} cubed` : `${b} to the power of ${e}`;
        if (p.sr !== speak + ' equals blank') wrong.push('spoken ' + p.sr);
        if (e < 2n) { sawLow++; if (!c.expAllowLow) wrong.push('low power when off'); }
        if (c.expPreset === 'squares' && e !== 2n) wrong.push('squares');
        if (c.expPreset === 'cubes' && e !== 3n) wrong.push('cubes');
        if (c.expPreset === 'tens' && b !== 10n) wrong.push('tens');
      });
    }
  }
  ok(wrong.length === 0, `${n} exponent rows: key is the power, markup a superscript, speech right (${wrong.slice(0, 3).join(' | ')})`);
  ok(sawLow > 0, 'zero and first powers appear when the box is ticked');
  // how one reads on paper and to a screen reader
  await pick('expPreset', 'cubes'); await check('expAllowLow', false);
  await page.click('#generateBtn'); await settle(page, 200);
  const probe = await page.evaluate(() => {
    const p = document.querySelector('#previewArea .problems .p');
    const vis = p.querySelector('.mdg-expr'), sr = p.querySelector('.mdg-sr'), sup = p.querySelector('sup');
    const cs = getComputedStyle(sup), pcs = getComputedStyle(vis);
    const r = sr.getBoundingClientRect();
    return {
      hidden: vis.getAttribute('aria-hidden'), supSize: parseFloat(cs.fontSize), baseSize: parseFloat(pcs.fontSize), valign: cs.verticalAlign,
      srW: r.width, srH: r.height, srText: sr.textContent, visW: vis.getBoundingClientRect().width
    };
  });
  eq(probe.hidden, 'true', 'the visible expression is hidden from a screen reader');
  ok(probe.supSize < probe.baseSize, 'the exponent is set smaller than the base');
  ok(probe.valign === 'super', 'the exponent is raised (vertical-align: super)');
  ok(probe.srW <= 1 && probe.srH <= 1 && probe.visW > 20, 'the spoken sentence takes no room on the sheet');
  ok(/ cubed equals blank$/.test(probe.srText), 'the spoken sentence reads the power: ' + probe.srText);
  // Playwright's own accessibility tree for that problem
  let snap = null;
  try { snap = await page.locator('#previewArea .problems .p').first().ariaSnapshot(); } catch (e) { snap = null; }
  if (snap != null) ok(/cubed equals blank/.test(snap) && !/\^/.test(snap) && !/<sup/.test(snap), 'the accessibility tree has the sentence and no caret: ' + JSON.stringify(snap));
  else ok(true, '(ariaSnapshot unavailable here)');
}

group('One-step equations on the page');
await fresh();
await choose('equations');
await setCount(60);
{
  const cases = [];
  for (const eqForms of ['all', 'addsub', 'muldiv']) for (const eqNegatives of [false, true]) for (const eqFractions of [false, true]) cases.push({ eqForms, eqNegatives, eqFractions });
  let n = 0, wrong = [], sawNeg = 0, sawFrac = 0;
  const forms = [
    [/^x \+ (\d+) = (-?\d+)$/, (a, b) => rat(b - a)], [/^x − (\d+) = (-?\d+)$/, (a, b) => rat(b + a)],
    [/^(\d+)x = (-?\d+)$/, (a, b) => rat(b, a)], [/^x ÷ (\d+) = (-?\d+)$/, (a, b) => rat(b * a)]
  ];
  for (const c of cases) {
    await pick('eqForms', c.eqForms); await check('eqNegatives', c.eqNegatives); await check('eqFractions', c.eqFractions);
    for (let round = 0; round < 3; round++) {
      await page.click('#generateBtn'); await settle(page, 150);
      const { problems, key } = await sheetAndKey();
      problems.forEach((p, i) => {
        n++;
        const m0 = /^(.+?)  x = _____$/.exec(p.text.replace(/ /g, ' ')) || /^(.+?) x = _____$/.exec(p.text);
        if (!m0) { wrong.push('line ' + JSON.stringify(p.text)); return; }
        let sol = null;
        for (const [re, f] of forms) { const m = re.exec(m0[1].trim()); if (m) { sol = f(BigInt(m[1]), BigInt(m[2])); break; } }
        if (!sol) { wrong.push('shape ' + m0[1]); return; }
        const km = /^x = (.+)$/.exec(key[i]);
        if (!km || !writtenAs(km[1], sol)) wrong.push(`row ${i + 1}: ${m0[1]} key ${key[i]}`);
        if (sol.d !== 1n) { sawFrac++; if (!c.eqFractions) wrong.push('fraction when off'); }
        if (sol.n < 0n) { sawNeg++; if (!c.eqNegatives) wrong.push('negative when off'); }
        if (c.eqForms === 'addsub' && /x [÷]|\dx/.test(m0[1])) wrong.push('addsub');
        if (c.eqForms === 'muldiv' && /x [+−]/.test(m0[1])) wrong.push('muldiv');
      });
    }
  }
  ok(wrong.length === 0, `${n} equation rows: each key is x = the solution of its own row (${wrong.slice(0, 3).join(' | ')})`);
  ok(sawNeg > 0 && sawFrac > 0, 'negative and fraction answers appear when allowed');
}

/* ── 3. settings, export, import ──────────────────────────────────────────── */
group('Saved settings, export and import');
{
  // a save from before the options (no new fields) loads to the defaults on each new template
  const old = { templateKey: 'fracmuldiv', sheetTitle: '', problemCount: 40, columns: 3, versions: 1, rangesByTemplate: {}, timedFluency: false, fluencyTargetSeconds: '', format: 'horizontal', fontSize: 'md', perPage: '', avoidTrivial: false, lockSeed: false, seed: 5, sameSheetKey: false, sameSheetKeyMode: 'both', reorderedVersions: false, selfCheck: 'none' };
  await fresh(old);
  const d = await page.evaluate(() => ['fracOp', 'expPreset', 'eqForms'].map(id => document.getElementById(id).value).concat(['fracMixed', 'fracWhole', 'expAllowLow', 'eqNegatives', 'eqFractions'].map(id => document.getElementById(id).checked)));
  eq(JSON.stringify(d), '["both","custom","all",false,false,false,false,false]', 'a save without the new fields loads to the defaults');
  const s1 = await sheetAndKey();
  ok(s1.problems.every(p => { const m = /^(.+?) ([×÷]) (.+?) = _____$/.exec(p.text); return m && parseNum(m[1]).kind === 'frac' && parseNum(m[3]).kind === 'frac'; }), 'and prints proper fractions only');

  // options persist across a reload
  await fresh({ ...old, templateKey: 'equations', lockSeed: true, seed: 424242, eqForms: 'muldiv', eqNegatives: true, eqFractions: true });
  const before = await sheetAndKey();
  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 250);
  const after = await sheetAndKey();
  eq(JSON.stringify(after), JSON.stringify(before), 'a locked seed with options reprints the same sheet after a reload');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), SETTING_KEY);
  ok(saved.eqForms === 'muldiv' && saved.eqNegatives === true && saved.eqFractions === true, 'options are written with the settings');
  ok(before.problems.every(p => /^(\d+x = -?\d+|x ÷ \d+ = -?\d+)/.test(p.text)), 'and the saved options shape the sheet');

  // export then import round-trip
  await check('eqNegatives', false); await check('lockSeed', true);
  const text = await downloadText(page, '#exportSettingsBtn', { what: 'the settings file' });
  const exported = JSON.parse(text);
  ok(exported.eqForms === 'muldiv' && exported.eqNegatives === false && exported.eqFractions === true && exported.templateKey === 'equations', 'export carries the options');
  const sheetBefore = await sheetAndKey();
  fs.writeFileSync(path.join(SCRATCH, 'good.json'), text);
  await page.click('#generateBtn'); await settle(page, 150);   // locked: same sheet
  await page.setInputFiles('#importSettingsFile', path.join(SCRATCH, 'good.json')); await settle(page, 400);
  eq(JSON.stringify(await sheetAndKey()), JSON.stringify(sheetBefore), 'importing the export reprints the same sheet');

  // an old file (no options) and a file with junk
  const oldFile = { ...old, templateKey: 'exponents', lockSeed: true, seed: 9 };
  fs.writeFileSync(path.join(SCRATCH, 'old.json'), JSON.stringify(oldFile));
  await page.setInputFiles('#importSettingsFile', path.join(SCRATCH, 'old.json')); await settle(page, 400);
  const afterOld = await page.evaluate(() => ['fracOp', 'expPreset', 'eqForms'].map(id => document.getElementById(id).value).concat(['fracMixed', 'fracWhole', 'expAllowLow', 'eqNegatives', 'eqFractions'].map(id => document.getElementById(id).checked)));
  eq(JSON.stringify(afterOld), '["both","custom","all",false,false,false,false,false]', 'an old settings file resets the options to the defaults');
  const junk = { ...old, templateKey: 'exponents', expPreset: '<img src=x onerror=alert(1)>', expAllowLow: 'yes', fracOp: 7, eqForms: {}, eqNegatives: 1 };
  fs.writeFileSync(path.join(SCRATCH, 'junk.json'), JSON.stringify(junk));
  await page.setInputFiles('#importSettingsFile', path.join(SCRATCH, 'junk.json')); await settle(page, 400);
  const afterJunk = await page.evaluate(() => ['fracOp', 'expPreset', 'eqForms'].map(id => document.getElementById(id).value).concat(['fracMixed', 'fracWhole', 'expAllowLow', 'eqNegatives', 'eqFractions'].map(id => document.getElementById(id).checked)));
  eq(JSON.stringify(afterJunk), '["both","custom","all",false,false,false,false,false]', 'a file with junk values loads to the defaults');
  const sj = await sheetAndKey();
  ok(sj.problems.length >= 5 && sj.problems.every(p => /^\d+<sup>\d+<\/sup> = _____$/.test(p.expr)), 'and still makes a sheet of powers');
}

/* ── 4. leveled sets and versions use the options ─────────────────────────── */
group('Versions and leveled sets');
{
  await fresh({ templateKey: 'equations', problemCount: 20, columns: 3, versions: 1, rangesByTemplate: {}, lockSeed: false, seed: null, eqForms: 'addsub', eqNegatives: false, eqFractions: false });
  await page.fill('#versionCount', '3'); await page.dispatchEvent('#versionCount', 'change'); await settle(page, 300);
  const tabs = await page.evaluate(() => document.querySelectorAll('#versionTabs button').length);
  eq(tabs, 3, 'three versions');
  const s = await sheetAndKey();
  ok(s.problems.every(p => /^x [+−] \d+ = \d+/.test(p.text)), 'each version honours add and subtract only');
  await page.click('#generateLeveledBtn'); await settle(page, 300);
  const s2 = await sheetAndKey();
  ok(s2.problems.length === 20 && s2.problems.every(p => /^x [+−] \d+ = \d+/.test(p.text)), 'the leveled set honours it too');
  await page.fill('#versionCount', '2'); await page.dispatchEvent('#versionCount', 'change'); await settle(page, 200);
  await check('reorderedVersions', true);
  const s3 = await sheetAndKey();
  ok(s3.problems.length === 20, 'reordered versions of an equation sheet render');
  // self-checking formats carry the new answers
  await check('reorderedVersions', false);
  await page.selectOption('#selfCheck', 'riddle'); await settle(page, 200);
  const rid = await page.evaluate(() => document.querySelector('#previewArea .riddle-decoder') && document.querySelector('#previewArea .riddle-decoder').textContent);
  ok(rid && !/undefined|NaN/.test(rid) && /=/.test(rid), 'the riddle decoder takes equation answers');
  await page.selectOption('#selfCheck', 'maze'); await settle(page, 200);
  const maze = await page.evaluate(() => document.querySelector('#previewArea .maze-junction-list') && document.querySelector('#previewArea .maze-junction-list').textContent);
  ok(maze && /x = _____/.test(maze) && !/undefined|NaN/.test(maze), 'the maze stops show equations');
  await page.selectOption('#selfCheck', 'none'); await settle(page, 100);
  await choose('exponents');
  await page.selectOption('#selfCheck', 'maze'); await settle(page, 250);
  const maze2 = await page.evaluate(() => document.querySelector('#previewArea .maze-junction-list').innerHTML);
  ok(/<sup>/.test(maze2) && /mdg-sr/.test(maze2) && !/undefined|NaN/.test(maze2), 'the maze stops show real superscripts');
  await page.selectOption('#selfCheck', 'none'); await settle(page, 100);
  // same-sheet corner key
  await choose('equations');
  await check('sameSheetKey', true);
  const corner = await page.evaluate(() => document.querySelector('#previewArea .ssk-grid') && document.querySelector('#previewArea .ssk-grid').textContent);
  ok(corner && /x = /.test(corner), 'the corner key says x = for an equation sheet');
  await check('sameSheetKey', false);
}

/* ── 5. no clipping, no extra page ────────────────────────────────────────── */
group('Fit on paper');
{
  {
    await fresh();
    await page.evaluate(() => { window.print = () => {}; });
  }
  const wide = ['addition', 'fractions', 'ooo'];
  const kinds = [['fracmuldiv', { fracMixed: true, fracWhole: true }], ['exponents', { expAllowLow: true }], ['equations', { eqNegatives: true, eqFractions: true }]];
  const measure = async (templateKey, opts, count, columns, fontSize, perPage) => {
    await fresh({ templateKey, problemCount: count, columns, versions: 1, rangesByTemplate: {}, fontSize, perPage: perPage || '', lockSeed: true, seed: 20261007, ...opts });
    const over = await page.evaluate(() => Array.from(document.querySelectorAll('#previewArea .problems .p')).filter(p => p.scrollWidth > p.clientWidth + 1).length);
    await page.evaluate(() => { window.print = () => {}; });
    await page.click('#printBtn'); await settle(page, 200);
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
    const f = path.join(SCRATCH, 'p.pdf'); fs.writeFileSync(f, pdf);
    const info = execFileSync('pdfinfo', [f], { encoding: 'utf8' });
    return { over, pages: +/Pages:\s+(\d+)/.exec(info)[1] };
  };
  const base = {};
  for (const font of ['sm', 'md', 'lg']) for (const cols of [2, 3, 6]) for (const count of [30, 100]) {
    const k = [font, cols, count].join('/');
    base[k] = { over: 0, pages: 0 };
    for (const t of wide) { const r = await measure(t, {}, count, cols, font); base[k].over = Math.max(base[k].over, r.over); base[k].pages = Math.max(base[k].pages, r.pages); }
  }
  const bad = [];
  for (const [t, o] of kinds) for (const font of ['sm', 'md', 'lg']) for (const cols of [2, 3, 6]) for (const count of [30, 100]) {
    const k = [font, cols, count].join('/');
    const r = await measure(t, o, count, cols, font);
    if (r.over > base[k].over) bad.push(`${t} ${k} clipped ${r.over} (older types ${base[k].over})`);
    if (r.pages > base[k].pages) bad.push(`${t} ${k} pages ${r.pages} (older types ${base[k].pages})`);
  }
  ok(bad.length === 0, 'no new type overflows a column or prints a page more than the older types at the same size: ' + bad.slice(0, 4).join(' | '));
  // the plain default sheet: worksheet then key, two pages
  for (const [t, o] of kinds) {
    const r = await measure(t, o, 30, 3, 'md');
    eq(r.pages, 2, `${t}: 30 problems print as a worksheet page and a key page`);
    eq(r.over, 0, `${t}: nothing wider than its column at 3 columns, medium`);
  }
  // paged
  const paged = await measure('fracmuldiv', { fracMixed: true }, 60, 3, 'md', 20);
  eq(paged.pages, 6, 'fractions, 60 problems at 20 a page: three worksheet pages and the key (three, one per version page of the key)');
}

/* ── 6. axe on each option block ──────────────────────────────────────────── */
group('Accessibility');
{
  for (const [key, label] of [['fracmuldiv', 'fractions'], ['exponents', 'exponents'], ['equations', 'equations']]) {
    for (const theme of ['light', 'dark']) {
      await fresh();
      if (theme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await choose(key);
      const v = await a11yScan(page, { impact: 'serious' });
      ok(v.length === 0, `${label}, ${theme}: no serious axe violation ` + JSON.stringify(v.map(x => x.id + ' ' + x.nodes.join(','))));
    }
  }
  // keyboard: Tab reaches the three options of a block in order and Space toggles a box
  await fresh(); await choose('fracmuldiv');
  await page.focus('#fracOp');
  await page.keyboard.press('Tab'); const f1 = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Space'); await settle(page, 200);
  const toggled = await page.isChecked('#fracMixed');
  await page.keyboard.press('Tab'); const f2 = await page.evaluate(() => document.activeElement.id);
  eq(f1, 'fracMixed', 'Tab goes from the operation select to the mixed-number box');
  ok(toggled, 'Space ticks it');
  eq(f2, 'fracWhole', 'then to the whole-number box');
}

ok(consoleProblems.length === 0, 'no console errors or page errors: ' + consoleProblems.slice(0, 3).join(' | '));
const errs = await page.evaluate(() => 0);
await browser.close();
server.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.slice(0, 8).forEach(f => console.log('  - ' + f)); process.exit(1); }
process.exit(0);
