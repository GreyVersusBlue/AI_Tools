// smoke-publish-baseline.mjs — 035's Publish, regenerated and diffed (Path 11 P1).
//
//   node Tools/schedule-visualizer/test/smoke-publish-baseline.mjs            (or: npm run test:schedule-publish)
//   node Tools/schedule-visualizer/test/smoke-publish-baseline.mjs --update   rewrite the baseline; its diff is the review
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
//
// Since v62 (P1 increment 2) it also opens the published file from file://
// and walks it until every published piece has run (Chromium's JS coverage
// names one that never did); reads Northwind as v61 published it
// (fixture-published-format0.json) through today's reader; publishes a school
// named with a closing script tag; publishes at 23:30 in Los Angeles; and
// breaks 035 itself on the way in with page.route(), each break named by its
// own section of the baseline. A published file it opens is written under
// os.tmpdir() and removed after.

/* global brPickScheduleFile, brSetMode, brUseSchedule -- a published file's own functions, called inside page.evaluate() */
/* global brRouteGeometry, brBuildGeometrySnapshot -- 035's window copies of sv-browser.js's exports, called inside page.evaluate() */
/* global AppState -- 035's state, read inside page.evaluate() */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publishFromFixture, generatorPath } from './publish.mjs';
import { fixtureProject } from './fixture-northwind.mjs';
import { prepPage, a11yScan } from '../../board-check/harness.mjs';
import { readPublisher, assemble } from '../../board-check/check-publisher.mjs';
import { readEmbedded, validate } from './published-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.join(HERE, 'baseline-northwind.html');
const PORT = 8551;
const NOW = '2026-01-15T17:00:00Z';
const UPDATE = process.argv.includes('--update');
/** Published pieces nothing in a published file can call, each with its
 *  reason. The coverage walk fails if one of these ever runs (delete it then),
 *  as check-publisher's KNOWN_FREE does. */
const UNREACHED = {
  brDShort: 'only brRenderMapLegacy calls it, behind the dead door check-publisher lists as KNOWN_FREE',
};

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

/** Open a published file from file:// in a fresh context, its clock at `at`. */
async function openPublished(browser, html, { at, coverage = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-published-'));
  const file = path.join(dir, 'published.html');
  fs.writeFileSync(file, html);
  const page = await prepPage(browser, 'file://', { width: 1200, height: 900 });
  if (at) await page.clock.setFixedTime(new Date(at));
  if (coverage) await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  return {
    page,
    close: async () => { await page.context().close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

const viewText = page => page.evaluate(() => document.getElementById('br-view').innerText);

/* Path 11 P6: files to open, in a scratch folder the run deletes at the end. */
const FILES = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-open-'));
process.on('exit', () => fs.rmSync(FILES, { recursive: true, force: true }));
function dataFile(content, name) {
  const f = path.join(FILES, name);
  fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content));
  return f;
}
/** Press what opens the file picker (`press` returns a promise) and pick `file`. */
async function openFile(page, press, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), press()]);
  await chooser.setFiles(file);
}

/** Pick a teacher the way a person does: type, arrow down, Enter. */
async function pickTeacher(page, name) {
  await page.click('#br-search');
  await page.fill('#br-search', name);
  await page.press('#br-search', 'ArrowDown');
  await page.press('#br-search', 'Enter');
  await page.waitForFunction(n => document.querySelector('#br-view h2')?.textContent === n, name);
}

/** Publish again from the page that is open, after loading 035 with `rewrite`
 *  applied to its text (null: as it is). Restores nothing; the caller decides. */
async function republish(page, { rewrite = null, project = fixtureProject() } = {}) {
  const url = new URL(page.url());
  const target = url.origin + generatorPath();
  // Since Path 11 P2 increment 7 the publisher is schedule-visualizer/sv-browser.js,
  // which the page imports: a rewrite goes to whichever of the two holds its text
  // (rewrite returns null for a file without it), and must land exactly once.
  const routed = [target, new URL('schedule-visualizer/sv-browser.js', target).href];
  let hits = 0;
  if (rewrite) {
    for (const u of routed) {
      await page.route(u, async route => {
        const resp = await route.fetch();
        const body = await resp.text();
        const out = rewrite(body);
        if (out !== null) hits++;
        await route.fulfill({ response: resp, body: out === null ? body : out });
      });
    }
  }
  try {
    await page.goto(target, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.applyFullProject === 'function'
      && typeof window.brBuildPublishedHTML === 'function', { timeout: 20000 });
    if (rewrite && hits !== 1) throw new Error(`a 035 edit landed in ${hits} files, not one`);
    return await page.evaluate(p => { window.confirm = () => true; window.applyFullProject(p); return window.brBuildPublishedHTML(); }, project);
  } finally {
    if (rewrite) for (const u of routed) await page.unroute(u);
  }
}

async function increment2(run, pub, html) {
  const browser = run.browser;
  const data = readEmbedded(html);
  ok(data.format === 1 && data.tool === 'v62', `the data says format 1 and tool v62 (got ${data.format}, ${data.tool})`);
  ok(JSON.stringify(Object.keys(data).slice(0, 3)) === '["format","tool","school"]', 'format and tool come first');

  // 1. Every published piece runs at least once, opened from file://, with the
  //    clock 90 days past publishing so the out-of-date banner shows too.
  {
    const pieces = pub.fns.map(f => f.name).concat(pub.consts.map(c => c.name));
    ok(pieces.length === 46, `46 published pieces to cover (got ${pieces.length})`);
    // Path 11 P6 increment 2: the file the walk opens carries directions, so the
    // Directions tab (driven by name: a default publish has no such tab) routes.
    const dirGeom = await run.page.evaluate(() => brRouteGeometry(brBuildGeometrySnapshot(AppState.blueprint), AppState.blueprint, AppState.settings));
    const [dirFrom, dirTo] = dirGeom.floors.map(f => f.rooms.find(r => r.rn && r.door).rn);
    const o = await openPublished(browser, html, { at: '2026-04-15T17:00:00Z', coverage: true });
    const p = o.page;
    try {
      const banner = await p.evaluate(() => { const b = document.getElementById('br-stale-banner'); return { on: b.classList.contains('show'), text: b.textContent }; });
      ok(banner.on && banner.text.includes('published on January 15, 2026') && banner.text.includes('90 days ago'),
        'opened 90 days on, the banner says January 15, 2026 and 90 days: ' + banner.text.slice(0, 90));
      await p.click('#br-search');
      await p.keyboard.type('Fern');
      await p.press('#br-search', 'ArrowDown');
      await p.press('#br-search', 'ArrowUp');
      await p.press('#br-search', 'Escape');
      await p.click('#br-mast-school');                       // a click outside the search box
      await pickTeacher(p, 'Fernwood');
      await p.click('#br-view .btn-map');                     // "See the whole floor"
      await p.click('#br-view .floortabs button:nth-child(2)'); // Floor 2
      await p.click('#br-view svg [onclick*="brJumpTeacher"]'); // a room on the map
      await p.waitForFunction(() => ['Ivywood', 'Jessamine'].includes(document.querySelector('#br-view h2')?.textContent));
      await p.click('#br-view .tcard');                       // a mate
      await p.click('#br-view .gchip');                       // one of the teacher's groups
      await p.waitForFunction(() => /Class /.test(document.getElementById('br-search').value));
      await p.click('#br-view .daychips button:nth-child(2)'); // B day
      await p.click('#br-view .lnk');                         // a teacher in the group
      await p.focus('#br-mTeacher');
      for (const k of ['ArrowRight', 'ArrowLeft', 'End', 'Home', 'ArrowDown', 'ArrowUp']) await p.keyboard.press(k);
      // Path 11 P6: the opener is in every file, its button hidden unless the
      // publisher ticked the box, so it is driven by name here and by its
      // button in section 6.
      const other = { ...data, school: 'Southgate Middle', geometry: dirGeom };
      await openFile(p, () => p.evaluate(() => brPickScheduleFile()), dataFile(other, 'southgate.json'));
      await p.waitForFunction(() => document.getElementById('br-mast-school').textContent === 'Southgate Middle');
      await p.evaluate(() => brSetMode('dir'));
      await p.selectOption('#br-dir-from', dirFrom);
      await p.selectOption('#br-dir-to', dirTo);
      await p.waitForSelector('#br-dir-out figure.br-dir-map polyline');
      await p.click('#br-open-back');
      await p.waitForFunction(() => document.getElementById('br-open-note').hidden);
      const cov = await p.coverage.stopJSCoverage();
      const ran = new Map();
      for (const entry of cov) for (const f of entry.functions) {
        if (f.functionName) ran.set(f.functionName, (ran.get(f.functionName) || 0) + (f.ranges[0] ? f.ranges[0].count : 0));
      }
      const never = pieces.filter(n => !(ran.get(n) > 0));
      const missed = never.filter(n => !UNREACHED[n]);
      const expired = Object.keys(UNREACHED).filter(n => ran.get(n) > 0 || !pieces.includes(n));
      ok(missed.length === 0, 'every published piece runs from file://; never ran: ' + JSON.stringify(missed));
      ok(expired.length === 0, 'an UNREACHED entry that ran or is no longer published (delete it): ' + JSON.stringify(expired));
      ok(p.__errs.length === 0, 'no page errors in the published file: ' + JSON.stringify(p.__errs));
    } finally { await o.close(); }
  }

  // 2. A newer reader reads an older file's data: v62's file with Northwind as
  //    v61 wrote it shows the same day for the same teacher.
  {
    const f0 = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-published-format0.json'), 'utf8'));
    ok(validate(f0).format === 0, 'fixture-published-format0.json is format 0');
    const line = html.split('\n').find(l => l.startsWith('const PUBLISHED_DATA = '));
    const old = html.replace(line, () => 'const PUBLISHED_DATA = ' + JSON.stringify(f0) + ';');
    const days = [];
    for (const h of [html, old]) {
      const o = await openPublished(browser, h, { at: NOW });
      try {
        await pickTeacher(o.page, 'Fernwood');
        days.push(await viewText(o.page));
        ok(o.page.__errs.length === 0, 'no page errors: ' + JSON.stringify(o.page.__errs));
      } finally { await o.close(); }
    }
    ok(days[0].includes('Class 7-1') && days[0] === days[1], "today's reader shows a format 0 file's teacher exactly as a format 1 file's");
  }

  // 3. A school named with a closing script tag: one script block, and the
  //    name in the masthead as text.
  {
    const evil = '</script><b>';
    const project = fixtureProject();
    project.settings.schoolName = evil;
    for (const f of project.blueprint && project.blueprint.settings ? [project.blueprint.settings] : []) f.schoolName = evil;
    const h = await republish(run.page, { project });
    ok((h.match(/<script\b/gi) || []).length === 1 && (h.match(/<\/script>/gi) || []).length === 1,
      'a school named ' + evil + ' publishes a file with one script block');
    ok(readEmbedded(h).school === evil, 'and the data holds the name, escaped');
    const o = await openPublished(browser, h, { at: NOW });
    try {
      const shown = await o.page.evaluate(() => ({ h1: document.getElementById('br-mast-school').textContent, title: document.title,
        b: document.querySelectorAll('#br-mast-school b').length }));
      ok(shown.h1 === evil && shown.b === 0 && shown.title.startsWith(evil), 'the masthead and title show it as text: ' + JSON.stringify(shown));
      ok(o.page.__errs.length === 0, 'and the file runs: ' + JSON.stringify(o.page.__errs));
    } finally { await o.close(); }
  }

  // 4. Published at 23:30 in Los Angeles (07:30 the next day in UTC): both
  //    dates are the local one. Before v62 publishedOn said the 16th.
  {
    const cdp = await run.page.context().newCDPSession(run.page);
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
    try {
      await run.page.clock.setFixedTime(new Date('2026-01-16T07:30:00Z'));
      const h = await run.page.evaluate(() => window.brBuildPublishedHTML());
      const d = readEmbedded(h);
      ok(d.publishedOn === '2026-01-15' && h.includes('Published January 15, 2026 from'),
        `a publish at 23:30 local is dated the 15th in both places (publishedOn ${d.publishedOn})`);
    } finally {
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' }).catch(() => {});
      await run.page.clock.setFixedTime(new Date(NOW));
    }
  }

  // 5. Breaks made in 035 itself, on the way in: each must move its own
  //    section of the baseline and no other.
  {
    const base = fs.readFileSync(BASELINE, 'utf8');
    const cssStart = pub.css.split('\n')[0];
    const sub = (a, b) => t => t.includes(a) ? t.replace(a, b) : null;
    const breaks = [
      ['a property dropped from every teacher record', sub('    t.co = [...co].sort();', '    delete t.co;'), 'data'],
      ['two functions swapped in brPublishFnList()', sub('brChoose, brJumpTeacher, brJumpGroup,', 'brChoose, brJumpGroup, brJumpTeacher,'), 'order'],
      ['one CSS declaration added to BR_CSS', sub('const BR_CSS = `#app-browser {', 'const BR_CSS = `#app-browser {\n  outline: 0;'), 'BR_CSS'],
      ['the footnote reworded', sub('This file is a read-only snapshot', 'This file is a snapshot'), 'markup'],
    ];
    for (const [label, rewrite, want] of breaks) {
      const h = await republish(run.page, { rewrite });
      const d = compare(base, stripFonts(h, cssStart)).map(x => x.section);
      ok(JSON.stringify(d) === JSON.stringify([want]), `035 broken on purpose: ${label} → ${JSON.stringify(d)}, want ["${want}"]`);
    }
    const again = await republish(run.page);
    ok(compare(base, stripFonts(again, cssStart)).length === 0, 'and 035 as it is, loaded again, matches the baseline');
  }

  await increment6(run, pub, html);
  await increment6Directions(run, pub, html);
}

/* Path 11 P6 increment 1: a published copy opens a newer schedule file, but
   only one whose publisher ticked Settings → Publishing. */
async function increment6(run, pub, html) {
  const browser = run.browser;
  const data = readEmbedded(html);
  const note = page => page.evaluate(() => ({ hidden: document.getElementById('br-open-note').hidden,
    text: document.getElementById('br-open-text').textContent, back: !document.getElementById('br-open-back').hidden,
    school: document.getElementById('br-mast-school').textContent, initial: document.getElementById('br-mast-initial').textContent,
    title: document.title, stale: document.getElementById('br-stale-banner').classList.contains('show'),
    staleText: document.getElementById('br-stale-banner').textContent }));

  // The default publish: the button and the note are there and hidden.
  {
    const o = await openPublished(browser, html, { at: NOW });
    try {
      const shown = await o.page.evaluate(() => ({ btn: document.getElementById('br-open-btn').hidden,
        input: document.getElementById('br-open-file').hidden, note: document.getElementById('br-open-note').hidden,
        visible: !!document.getElementById('br-open-btn').offsetParent }));
      ok(shown.btn && shown.input && shown.note && !shown.visible, 'a default publish shows no opener and no note: ' + JSON.stringify(shown));
    } finally { await o.close(); }
  }

  // Ticked: the same file but for the button's hidden attribute.
  const project = fixtureProject();
  project.settings.publishCanOpen = true;
  const h = await republish(run.page, { project });
  const cssStart = pub.css.split('\n')[0];
  const d = compare(stripFonts(html, cssStart), stripFonts(h, cssStart));
  ok(JSON.stringify(d.map(x => x.section)) === '["markup"]' && /br-open-btn/.test(d[0].now) && !/ hidden/.test(d[0].now),
    'ticking the box changes only the button\'s hidden attribute: ' + JSON.stringify(d));
  const saved = await run.page.evaluate(() => {
    const el = document.getElementById('setting-publish-can-open');
    return { box: !!el, key: AppState.settings.publishCanOpen };
  });
  ok(saved.box && saved.key === true, 'Settings → Publishing has the box, and the project carries the setting: ' + JSON.stringify(saved));

  const o = await openPublished(browser, h, { at: NOW });
  const p = o.page;
  try {
    ok(await p.isVisible('#br-open-btn'), 'the ticked copy shows "Open a newer schedule…"');
    const before = await note(p);
    const press = () => p.click('#br-open-btn');

    // Refusals: the schedule showing does not change.
    const refused = [
      ['a format above the reader', dataFile({ ...data, format: 2 }, 'newer.json'), 'newer version'],
      ['a file that is no schedule', dataFile('<p>hello</p>', 'hello.html'), 'not a schedule browser'],
      ['a page with two data lines', dataFile('const PUBLISHED_DATA = {};\nconst PUBLISHED_DATA = {};\n', 'two.html'), 'not a schedule browser'],
      ['data that does not parse', dataFile('{"school":', 'broken.json'), 'could not be read'],
      ['a teacher with no B day', dataFile({ ...data, teachers: { ...data.teachers, Fernwood: { ...data.teachers.Fernwood, B: null } } }, 'nob.json'), 'teacher\'s day'],
      ['a name holding markup', dataFile({ ...data, teachers: { ...data.teachers, '<img src=x onerror=alert(1)>': data.teachers.Fernwood } }, 'markup.json'), '< or >'],
      ['no mod count', dataFile({ ...data, modCount: 0 }, 'mods.json'), 'number of mods'],
    ];
    for (const [label, file, want] of refused) {
      await openFile(p, press, file);
      await p.waitForFunction(() => !document.getElementById('br-open-note').hidden && document.getElementById('br-open-text').textContent);
      const n = await note(p);
      ok(n.text.includes(want) && !n.back && n.school === before.school && n.title === before.title,
        `refused, ${label}: "${n.text.slice(0, 90)}"`);
      await p.evaluate(() => { document.getElementById('br-open-note').hidden = true; document.getElementById('br-open-text').textContent = ''; });
    }

    // Another published file: an older one from another school.
    const southgate = fixtureProject();
    southgate.settings.schoolName = 'Southgate Middle';
    for (const f of southgate.blueprint && southgate.blueprint.settings ? [southgate.blueprint.settings] : []) f.schoolName = 'Southgate Middle';
    const sh = await republish(run.page, { project: southgate });
    const line = sh.split('\n').find(l => l.startsWith('const PUBLISHED_DATA = '));
    const shOld = sh.replace(line, () => line.replace('"publishedOn":"2026-01-15"', '"publishedOn":"2025-08-01"'));
    ok(shOld !== sh, 'the Southgate file is dated 2025-08-01');
    await pickTeacher(p, 'Fernwood');
    await openFile(p, press, dataFile(shOld, 'Schedule_Browser_Southgate.html'));
    await p.waitForFunction(() => document.getElementById('br-mast-school').textContent === 'Southgate Middle');
    let n = await note(p);
    ok(n.title === 'Southgate Middle — Schedule Browser' && n.initial === 'S' && !n.hidden && n.back
      && n.text.includes('Showing Southgate Middle, published August 1, 2025, from the file Schedule_Browser_Southgate.html'),
      'a published file opens: masthead, title and the note: ' + JSON.stringify(n));
    ok(n.stale && n.staleText.includes('published on August 1, 2025'), 'its own date drives the stale banner: ' + n.staleText.slice(0, 80));
    const reset = await p.evaluate(() => ({ view: document.getElementById('br-view').classList.contains('show'),
      empty: document.getElementById('br-empty').style.display, search: document.getElementById('br-search').value,
      tab: document.getElementById('br-mTeacher').getAttribute('aria-selected') }));
    ok(!reset.view && reset.empty === '' && reset.search === '' && reset.tab === 'true', 'and the view goes back to By Teacher, empty: ' + JSON.stringify(reset));
    await pickTeacher(p, 'Fernwood');
    const southDay = await viewText(p);
    await p.click('#br-mMap');
    await p.waitForSelector('#br-view svg');

    // Back to the file's own schedule.
    await p.click('#br-open-back');
    await p.waitForFunction(() => document.getElementById('br-open-note').hidden);
    n = await note(p);
    ok(n.school === before.school && n.title === before.title && !n.back && !n.stale, 'Back shows the file\'s own schedule again: ' + JSON.stringify(n));
    await pickTeacher(p, 'Fernwood');
    const ownDay = await viewText(p);
    ok(ownDay === southDay && ownDay.includes('Class 7-1'), 'the same teacher\'s day in both (one fixture, two names)');

    // A format 0 data file (v61's Northwind) and a bare .json both open.
    const f0 = fs.readFileSync(path.join(HERE, 'fixture-published-format0.json'), 'utf8');
    await openFile(p, press, dataFile(f0, 'northwind-v61.json'));
    await p.waitForFunction(() => !document.getElementById('br-open-back').hidden);
    await pickTeacher(p, 'Fernwood');
    ok(await viewText(p) === ownDay, 'a format 0 data file shows the same day');
    ok(p.__errs.length === 0, 'no page errors while opening files: ' + JSON.stringify(p.__errs));
  } finally { await o.close(); }
}

/* Path 11 P6 increment 2: a published copy shows directions, but only one
   whose publisher ticked Settings → Publishing → "show directions". */
async function increment6Directions(run, pub, html) {
  const browser = run.browser;
  const cssStart = pub.css.split('\n')[0];
  const tabs = page => page.evaluate(() => [...document.querySelectorAll('#app-browser .mode [role="tab"]')]
    .map(b => b.id + ':' + b.getAttribute('aria-selected')));

  // The default publish: three tabs, and End on them still lands on Building Map.
  {
    const o = await openPublished(browser, html, { at: NOW });
    try {
      ok(!(await o.page.$('#br-mDir')), 'a default publish has no Directions tab');
      await o.page.focus('#br-mTeacher');
      await o.page.keyboard.press('End');
      ok(JSON.stringify(await tabs(o.page)) === '["br-mTeacher:false","br-mGroup:false","br-mMap:true"]', 'End on its tabs lands on Building Map, as before');
      ok(!('links' in readEmbedded(html).geometry), 'and its geometry carries no links');
    } finally { await o.close(); }
  }

  // Ticked: the markup gains the tab and the geometry the routing fields; nothing else moves.
  const project = fixtureProject();
  project.settings.publishDirections = true;
  const h = await republish(run.page, { project });
  const d = compare(stripFonts(html, cssStart), stripFonts(h, cssStart)).map(x => x.section);
  ok(JSON.stringify(d) === '["markup","data"]', 'ticking the box moves the markup and the data only: ' + JSON.stringify(d));
  const a = readEmbedded(html), b = readEmbedded(h);
  ok(JSON.stringify({ ...a, geometry: null }) === JSON.stringify({ ...b, geometry: null }), 'in the data, only the geometry differs');
  const geom = b.geometry;
  ok(Array.isArray(geom.links) && geom.links.length === 1 && geom.floors.every(f => Array.isArray(f.steps)
    && f.rooms.every(r => !r.rn || (Array.isArray(r.door) && r.doors.length))), 'and it carries links, steps and every room\'s door');
  const v = validate(b);
  ok(v.ok && v.warnings.length === 0, 'the ticked data meets the contract: ' + JSON.stringify(v.errors.slice(0, 3)));
  const saved = await run.page.evaluate(() => ({ box: !!document.getElementById('setting-publish-directions'), key: AppState.settings.publishDirections }));
  ok(saved.box && saved.key === true, 'Settings → Publishing has the box, and the project carries the setting: ' + JSON.stringify(saved));

  const rooms = geom.floors.map(f => f.rooms.filter(r => r.rn && r.door).map(r => r.rn));
  const o = await openPublished(browser, h, { at: NOW });
  const p = o.page;
  try {
    ok(await p.isVisible('#br-mDir'), 'the ticked copy shows a Directions tab');
    await p.focus('#br-mTeacher');
    await p.keyboard.press('End');
    ok(JSON.stringify(await tabs(p)) === '["br-mTeacher:false","br-mGroup:false","br-mMap:false","br-mDir:true"]', 'End reaches it, and it alone is selected');
    ok(await p.evaluate(() => document.getElementById('br-stage').getAttribute('aria-labelledby')) === 'br-mDir', 'the panel is labelled by it');
    ok(!(await p.isVisible('#br-searchField')), 'the name search is hidden, as on the map');
    ok(await p.evaluate(() => document.getElementById('br-dir-out').innerText.includes('Choose the room')), 'with no rooms chosen it says what to do');
    ok(!(await p.$('#br-dir-sf')), 'Northwind marks no elevator or ramp, so there is no step-free switch');

    // Across the floors.
    await p.selectOption('#br-dir-from', rooms[0][0]);
    await p.selectOption('#br-dir-to', rooms[1][0]);
    await p.waitForSelector('#br-dir-out .br-dir-steps li');
    const shown = await p.evaluate(() => ({ steps: [...document.querySelectorAll('#br-dir-out .br-dir-steps li')].map(li => li.textContent),
      maps: [...document.querySelectorAll('#br-dir-out figure.br-dir-map')].map(f => [f.querySelector('figcaption').textContent, f.querySelectorAll('polyline').length]),
      badges: [...document.querySelectorAll('#br-dir-out svg text')].map(t => t.textContent).filter(t => t === 'Start' || t === 'End') }));
    ok(shown.steps.includes('Take the stairs to Floor 2.') && shown.steps[shown.steps.length - 1] === `Arrive at room ${rooms[1][0]}.`,
      `${rooms[0][0]} to ${rooms[1][0]}: the moves take the stairs and arrive: ` + shown.steps.join(' '));
    ok(JSON.stringify(shown.maps) === '[["Floor 1",2],["Floor 2",2]]' && JSON.stringify(shown.badges) === '["Start","End"]',
      'a map of each floor in order, the walk drawn on both, Start and End marked: ' + JSON.stringify(shown));
    ok(!(await p.$('#br-dir-out [onclick]')), 'the route\'s maps open no teacher (nothing on them is clickable)');
    const scan = await a11yScan(p, { impact: 'serious', include: '#br-view' });
    ok(scan.length === 0, 'the Directions tab with a route has no serious or critical axe finding: ' + JSON.stringify(scan.map(x => [x.id, x.nodes])));

    // The same room, and back to a teacher.
    await p.selectOption('#br-dir-to', rooms[0][0]);
    await p.waitForFunction(() => document.getElementById('br-dir-out').innerText.includes('same room'));
    ok(true, 'from a room to itself it says so');
    await p.click('#br-mTeacher');
    ok(JSON.stringify(await tabs(p)) === '["br-mTeacher:true","br-mGroup:false","br-mMap:false","br-mDir:false"]' && await p.isVisible('#br-searchField'),
      'By Teacher deselects Directions and brings the search back');
    await pickTeacher(p, 'Fernwood');

    // Data without directions (another file, published with the box off) says so.
    await p.evaluate(d0 => { brUseSchedule(d0, 'old.html'); brSetMode('dir'); }, a);
    ok((await viewText(p)).includes('This file has no directions.'), 'a schedule with no directions in it says so in the tab');
    ok(p.__errs.length === 0, 'no page errors in the ticked copy: ' + JSON.stringify(p.__errs));
  } finally { await o.close(); }

  // An elevator: the switch appears and step-free directions take it.
  {
    const lift = fixtureProject();
    lift.settings.publishDirections = true;
    lift.blueprint.crossFloorPairs[0].access = 'elevator';
    const hl = await republish(run.page, { project: lift });
    const gl = readEmbedded(hl).geometry;
    ok(JSON.stringify(gl.links.map(l => [l.access, l.wait])) === '[["elevator",10]]', 'an elevator is published with its wait: ' + JSON.stringify(gl.links));
    const ol = await openPublished(browser, hl, { at: NOW });
    try {
      await ol.page.click('#br-mDir');
      await ol.page.selectOption('#br-dir-from', rooms[0][0]);
      await ol.page.selectOption('#br-dir-to', rooms[1][0]);
      await ol.page.check('#br-dir-sf');
      await ol.page.waitForFunction(() => /elevator/.test(document.getElementById('br-dir-out').innerText));
      ok((await viewText(ol.page)).includes('Take the elevator to Floor 2.'), 'step-free directions take the elevator');
      ok(ol.page.__errs.length === 0, 'no page errors: ' + JSON.stringify(ol.page.__errs));
    } finally { await ol.close(); }
  }
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

    await increment2(run, pub, html);
  } finally {
    await run.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
