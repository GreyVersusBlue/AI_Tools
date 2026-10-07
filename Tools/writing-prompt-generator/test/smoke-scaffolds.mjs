// smoke-scaffolds.mjs — the writing prompt page's sentence starters and
// "if you're stuck" line, on the real page.
//
//   node Tools/writing-prompt-generator/test/smoke-scaffolds.mjs
//
// Four things have to hold:
//  1. with scaffolds off (every saved state a teacher already has) the page
//     draws the same prompts and prints the same sheets as before: golden-old-
//     sheets.json was recorded from the page at 529c79c, with a seeded
//     Math.random, and every surface is compared by hash;
//  2. with them on, the lines under each prompt are the ones wpg-scaffolds.js
//     chooses, on the screen, the poster and the half-sheet, and turning them
//     on or off never changes which prompt is drawn;
//  3. print: the poster is one page and the half-sheets one page, for every
//     prompt in the bank, every ruling, with and without the name line, with
//     four starters and the stuck line on, and the ruled lines stay inside
//     the sheet;
//  4. a prompt set keeps its own choice, a share link carries it, and an old
//     link, with none, opens as it did.
/* global WpgScaffolds, WritingPrompts -- page globals read inside page.evaluate() */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { SCENARIOS, captureScenario, seedScript } from './_capture.mjs';

const PORT = 8524;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/025-writing-prompt-generator.html';
const K = 'gvb-writing-prompts:';
const GROUPS = (process.env.WPG_GROUPS || 'golden,on,print,sets,a11y').split(',');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
console.log('Writing prompt — sentence starters and stuck lines');

async function openPage(store, { seed = 3, width = 1400, height = 1000, permissions, url = URL_PAGE } = {}) {
  const page = await prepPage(browser, BASE, { width, height, permissions });
  await page.addInitScript(seedScript(seed, store || {}));
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const stored = (page, key) => page.evaluate(k => localStorage.getItem(k), K + key);
const noPrint = page => page.evaluate(() => { window.print = () => {}; });
const printPdfPages = async page => {
  await page.emulateMedia({ media: 'print' }); // pdf() uses screen media once emulateMedia('screen') has been called
  const buf = await page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true });
  const text = execFileSync('pdftotext', ['-', '-'], { input: buf, maxBuffer: 1 << 26 }).toString('utf8');
  await page.emulateMedia({ media: 'screen' });
  return { pages: (text.match(/\f/g) || []).length, text };
};

/* ── 1. scaffolds off: the old page, byte for byte ─────────────────────── */
if (GROUPS.includes('golden')) {
  console.log(' 1. scaffolds off equals the page before');
  const golden = JSON.parse(fs.readFileSync(new URL('./golden-old-sheets.json', import.meta.url), 'utf8'));
  for (const sc of SCENARIOS) {
    const { hashes } = await captureScenario(browser, BASE, sc, prepPage);
    const g = golden.scenarios[sc.name];
    eq(hashes.prompts, g.prompts, `${sc.name}: the same four prompts for the same seed`);
    for (const k of ['stage', 'poster', 'handout', 'roster', 'stored']) {
      ok(hashes[k] === g[k], `${sc.name}: ${k} is the same as before`);
    }
  }
  // a saved settings blob from before round-trips untouched even when the page re-saves it
  const old = { bands: ['ms'], genre: 'all', includeCustom: true, mode: 'draw', handoutSpacing: 'normal', handoutNameLine: true, wordGoal: null, timerMinutes: 5, anonView: 'one' };
  const page = await openPage({ settings: old });
  await page.click('#handoutNameLineCheck'); await page.click('#handoutNameLineCheck');
  const after = JSON.parse(await stored(page, 'settings'));
  ok(!('scaffold' in after), 'a settings blob from before gains no scaffold key when nothing was turned on');
  await page.context().close();
}

/* ── 2. on: the lines are the chosen ones, everywhere the prompt shows ── */
if (GROUPS.includes('on')) {
  console.log(' 2. scaffolds on');
  const page = await openPage({ settings: { bands: ['ms'], genre: 'persuasive', includeCustom: true, mode: 'draw' } });
  await noPrint(page);
  const expect = (band, genre, text, n, stuck) => page.evaluate(([b, g, t, c, s]) => ({
    starters: c ? WpgScaffolds.starters(b, g, t, c) : [],
    stuck: s ? WpgScaffolds.stuck(b, g, t) : null
  }), [band, genre, text, n, stuck]);
  const shown = (sel) => page.evaluate(s => {
    const root = document.querySelector(s);
    if (!root) return null;
    const sc = root.querySelector('.scaffold');
    if (!sc) return { has: false };
    return {
      has: true,
      starters: Array.from(sc.querySelectorAll('.sc-starters li')).map(li => li.textContent),
      stuck: sc.querySelector('.sc-stuck') ? sc.querySelector('.sc-stuck').textContent : null,
      listIsList: sc.querySelector('.sc-starters') ? sc.querySelector('.sc-starters').tagName === 'UL' : null
    };
  }, sel);

  await page.click('#generateBtn'); await settle(page, 80);
  eq((await shown('#stagePrompt')).has, false, 'a fresh draw shows no scaffold');
  eq((await page.evaluate(() => document.getElementById('printPosterBtn').disabled)), false, 'the poster button is live');

  // the draw does not move when a scaffold is turned on or off
  const textBefore = await page.evaluate(() => document.querySelector('#stagePrompt .prompt-text').textContent);
  await page.selectOption('#scaffoldStartersSelect', '3');
  let p = await page.evaluate(() => document.querySelector('#stagePrompt .prompt-text').textContent);
  eq(p, textBefore, 'turning starters on keeps the same prompt on the stage');
  const histBefore = await stored(page, 'history');
  await page.check('#scaffoldStuckCheck');
  eq(await stored(page, 'history'), histBefore, 'and writes nothing to the history');
  const meta = await page.evaluate(() => ({ band: 'ms', genre: document.querySelector('#metaRow .tag:nth-child(2)').textContent }));
  const genreKey = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-writing-prompts:history'))[0].genre);
  const want = await expect('ms', genreKey, textBefore, 3, true);
  let sh = await shown('#stagePrompt');
  eq(sh.starters, want.starters, 'the stage shows the three chosen starters');
  eq(sh.stuck, 'If you’re stuck: ' + want.stuck, 'and the stuck line, labelled');
  eq(sh.listIsList, true, 'starters are a real list');
  await page.uncheck('#scaffoldStuckCheck');
  sh = await shown('#stagePrompt');
  eq(sh.stuck, null, 'with the stuck box off, starters show and no stuck line does');
  eq(sh.starters.length, 3, 'and the three starters are still there');
  await page.check('#scaffoldStuckCheck');
  sh = await shown('#stagePrompt');
  ok(meta.genre.length > 0, 'the genre tag is still there');
  const stageText = await page.evaluate(() => document.getElementById('stagePrompt').textContent);
  ok(stageText.includes(textBefore), 'the prompt is still on the stage beside its help');

  for (const n of ['2', '3', '4']) {
    await page.selectOption('#scaffoldStartersSelect', n);
    sh = await shown('#stagePrompt');
    eq(sh.starters.length, Number(n), `${n} starters shown`);
    eq(sh.starters, (await expect('ms', genreKey, textBefore, Number(n), false)).starters, `the ${n} are the chosen ones`);
  }
  await page.selectOption('#scaffoldStartersSelect', '0');
  sh = await shown('#stagePrompt');
  eq(sh.starters.length, 0, 'no starters when set to none');
  ok(sh.stuck && sh.stuck.includes('If you’re stuck'), 'the stuck line stays with starters off');
  await page.uncheck('#scaffoldStuckCheck');
  eq((await shown('#stagePrompt')).has, false, 'both off: no scaffold on the stage');
  const afterOff = JSON.parse(await stored(page, 'settings'));
  ok(!('scaffold' in afterOff), 'both off: the saved settings carry no scaffold key');

  // persistence
  await page.selectOption('#scaffoldStartersSelect', '4'); await page.check('#scaffoldStuckCheck');
  eq(JSON.parse(await stored(page, 'settings')).scaffold, { starters: 4, stuck: true }, 'the choice is saved in the settings');
  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
  eq(await page.inputValue('#scaffoldStartersSelect'), '4', 'a reload restores the starter count');
  eq(await page.isChecked('#scaffoldStuckCheck'), true, 'and the stuck box');

  // poster and handout carry the same lines
  await noPrint(page);
  await page.click('#generateBtn'); await settle(page, 80);
  const t2 = await page.evaluate(() => document.querySelector('#stagePrompt .prompt-text').textContent);
  const g2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-writing-prompts:history'))[0].genre);
  const w2 = await expect('ms', g2, t2, 4, true);
  await page.click('#printPosterBtn');
  sh = await shown('#posterPrintArea');
  eq(sh.starters, w2.starters, 'the poster carries the four starters');
  eq(sh.stuck, 'If you’re stuck: ' + w2.stuck, 'and the stuck line');
  const order = await page.evaluate(() => {
    const kids = Array.from(document.querySelector('#posterPrintArea .poster-inner').children).map(c => c.className.split(' ')[0]);
    return kids;
  });
  ok(order.indexOf('scaffold') === order.indexOf('poster-text') + 1, 'on the poster the help sits right under the prompt');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.click('#printHandoutBtn');
  const halves = await page.evaluate(() => Array.from(document.querySelectorAll('#handoutPrintArea .half-sheet')).map(h => ({
    starters: Array.from(h.querySelectorAll('.sc-starters li')).map(l => l.textContent),
    stuck: h.querySelector('.sc-stuck') && h.querySelector('.sc-stuck').textContent,
    order: Array.from(h.children).map(c => c.className.split(' ')[0])
  })));
  eq(halves.length, 2, 'two half-sheets');
  ok(halves.every(h => JSON.stringify(h.starters) === JSON.stringify(w2.starters)), 'both halves carry the same four starters');
  ok(halves.every(h => h.stuck === 'If you’re stuck: ' + w2.stuck), 'both halves carry the stuck line');
  ok(halves.every(h => h.order.indexOf('scaffold') === h.order.indexOf('hs-prompt') + 1), 'on the half-sheet the help sits right under the prompt');
  // the roster assignment sheet is a list for the teacher and stays as it was
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.fill('#rosterNamesInput', 'Ada Q\nBen R'); await page.click('#buildRosterSheetBtn'); await settle(page, 60);
  eq(await page.evaluate(() => document.querySelectorAll('#rosterPrintArea .scaffold, #rosterSheetPreview .scaffold').length), 0, 'the roster assignment sheet carries no scaffold');

  // markup in a teacher's own prompt stays inert beside the lines
  await page.evaluate(() => { localStorage.setItem('gvb-writing-prompts:custom', JSON.stringify([{ id: 'c1', text: '<img src=x onerror="window.__pwn=1"> Convince me', band: 'both', genre: 'persuasive' }])); });
  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
  for (let i = 0; i < 30; i++) { await page.click('#generateBtn'); await settle(page, 20); }
  eq(await page.evaluate(() => window.__pwn === undefined), true, 'a prompt holding markup runs nothing while scaffolds are on');
  eq(await page.evaluate(() => document.querySelectorAll('#stagePrompt img').length), 0, 'and makes no image');
  await page.context().close();
}

/* ── 3. print: one page, every prompt, every ruling ────────────────────── */
if (GROUPS.includes('print')) {
  console.log(' 3. print geometry over the bank');
  const bank = await (async () => {
    const page = await openPage({});
    const b = await page.evaluate(() => {
      const out = [];
      for (const band of Object.keys(WritingPrompts.PROMPTS)) for (const g of WritingPrompts.GENRES) {
        for (const text of WritingPrompts.PROMPTS[band][g.key]) out.push({ band, genre: g.key, text });
      }
      return out;
    });
    await page.context().close();
    return b;
  })();
  eq(bank.length, 200, 'the bank is 200 prompts');
  const items = bank.map((b, i) => ({ id: 'q' + i, band: b.band, genre: b.genre, text: b.text, rubricName: null }));
  const store = {
    settings: { bands: ['ms', 'hs'], genre: 'all', includeCustom: true, mode: 'sequence', wordGoal: 250 },
    sets: [{ id: 'big', name: 'Whole bank', startDate: null, cursor: 0, items, scaffold: { starters: 4, stuck: true } }],
    activeSet: 'big'
  };
  // Letter, 0.5in margins: the printable column is 7.5in wide and 10in tall
  const page = await openPage(store, { width: 720, height: 960 });
  await noPrint(page);
  await page.emulateMedia({ media: 'print' });
  const result = await page.evaluate(({ n }) => {
    const $ = id => document.getElementById(id);
    const px = 96;
    const out = { poster: [], sheets: [], minLines: 99, worstOverflow: 0, worstPoster: 0, cases: 0, bad: [] };
    for (let i = 0; i < n; i++) {
      // poster
      $('printPosterBtn').click();
      const pi = document.querySelector('#posterPrintArea .poster-inner');
      const ph = pi.getBoundingClientRect().height / px;
      out.worstPoster = Math.max(out.worstPoster, ph);
      if (ph > 10) out.bad.push('poster ' + i + ' ' + ph.toFixed(2) + 'in');
      window.dispatchEvent(new Event('afterprint'));
      // half sheets, every ruling, with and without the name line
      for (const sp of ['wide', 'normal', 'narrow', 'blank']) for (const nameLine of [true, false]) {
        $('handoutSpacingSelect').value = sp;
        $('handoutNameLineCheck').checked = nameLine;
        $('printHandoutBtn').click();
        const halves = Array.from(document.querySelectorAll('#handoutPrintArea .half-sheet'));
        const h = halves[0], r = h.getBoundingClientRect();
        const lines = h.querySelectorAll('.hs-line').length;
        const sc = h.querySelector('.scaffold').getBoundingClientRect();
        const metaB = h.querySelector('.hs-meta').getBoundingClientRect().bottom;
        const linesBox = h.querySelector('.hs-lines').getBoundingClientRect();
        const last = h.querySelectorAll('.hs-line');
        const lastBottom = last.length ? last[last.length - 1].getBoundingClientRect().bottom : linesBox.top;
        const overflow = Math.max(0, lastBottom - r.bottom, sc.bottom - r.bottom, metaB - r.bottom) / px;
        out.cases++;
        out.worstOverflow = Math.max(out.worstOverflow, overflow);
        if (sp !== 'blank') out.minLines = Math.min(out.minLines, lines);
        if (halves.length !== 2 || r.height / px > 4.95 || overflow > 0.001) out.bad.push(`${sp}/${nameLine} #${i}: halves ${halves.length}, h ${(r.height / px).toFixed(2)}, overflow ${overflow.toFixed(3)} (lines ${((lastBottom - r.bottom) / px).toFixed(3)}, help ${((sc.bottom - r.bottom) / px).toFixed(3)}, meta ${((metaB - r.bottom) / px).toFixed(3)}, metaH ${(h.querySelector('.hs-meta').getBoundingClientRect().height / px).toFixed(2)})`);
        if (sp === 'wide' && nameLine && i % 40 === 0) out.sheets.push({ i, lines, scaffoldIn: sc.height / px });
        window.dispatchEvent(new Event('afterprint'));
      }
      $('seqNextBtn').click();
    }
    return out;
  }, { n: bank.length });
  eq(result.cases, 200 * 8, 'every prompt in 8 ruling and name-line combinations was measured');
  eq(result.bad.slice(0, 5), [], 'no half-sheet or poster runs past its page (any over 4.95in tall, or ruled lines/help/meta below the sheet)');
  ok(result.worstPoster <= 10, `the poster, with four starters and the stuck line, is at most 10in tall for every prompt (worst ${result.worstPoster.toFixed(2)}in)`);
  ok(result.worstOverflow <= 0.001, `nothing on a half-sheet passes its bottom edge (worst ${result.worstOverflow.toFixed(3)}in)`);
  ok(result.minLines >= 3, `at least three ruled lines remain under the heaviest prompt and help (fewest ${result.minLines})`);
  ok(result.sheets.every(s => s.scaffoldIn > 0.3), 'the help takes real room on the sheet, so the line count was reduced for it');

  // the real PDF: one page for the poster and for the two half-sheets, with the longest prompts
  const longest = {};
  for (const b of bank) if (!longest[b.band] || b.text.length > longest[b.band].text.length) longest[b.band] = b;
  for (const band of Object.keys(longest)) {
    const idx = bank.indexOf(longest[band]);
    await page.evaluate(() => { document.getElementById('seqSetSelect'); });
    // step the set to that prompt
    await page.evaluate(i => {
      const set = JSON.parse(localStorage.getItem('gvb-writing-prompts:sets'));
      set[0].cursor = i; localStorage.setItem('gvb-writing-prompts:sets', JSON.stringify(set));
    }, idx);
    await page.emulateMedia({ media: 'screen' });
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
    await noPrint(page);
    await page.evaluate(() => { document.getElementById('handoutSpacingSelect').value = 'wide'; });
    await page.click('#printPosterBtn');
    let pdf = await printPdfPages(page);
    eq(pdf.pages, 1, `the poster for the longest ${band} prompt (${longest[band].text.length} characters) with help is one PDF page`);
    ok(/sentence starters/i.test(pdf.text) && /if you.re stuck/i.test(pdf.text), `and its PDF text has both help blocks (${band})`);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.evaluate(() => { document.getElementById('handoutSpacingSelect').value = 'wide'; });
    await page.click('#printHandoutBtn');
    pdf = await printPdfPages(page);
    eq(pdf.pages, 1, `the two half-sheets for the longest ${band} prompt with help are one PDF page`);
    eq((pdf.text.match(/sentence starters/gi) || []).length, 2, `and the help is on both halves (${band})`);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  }
  await page.context().close();
}

/* ── 4. a set keeps its own choice, and a link carries it ──────────────── */
if (GROUPS.includes('sets')) {
  console.log(' 4. sets and share links');
  const base = { settings: { bands: ['ms', 'hs'], genre: 'all', includeCustom: true, mode: 'sequence' }, activeSet: 'sA' };
  const itemsA = [{ id: 'a1', band: 'ms', genre: 'narrative', text: 'Tell the story of the best day you\'ve had this year.', rubricName: null }];
  const itemsB = [{ id: 'b1', band: 'hs', genre: 'persuasive', text: 'Should voting be mandatory for all eligible citizens?', rubricName: null }];
  const store = { ...base, sets: [
    { id: 'sA', name: 'Unit A', startDate: null, cursor: 0, items: itemsA, scaffold: { starters: 2, stuck: true } },
    { id: 'sB', name: 'Unit B', startDate: null, cursor: 0, items: itemsB }] };
  const page = await openPage(store, { permissions: ['clipboard-read', 'clipboard-write'] });
  await noPrint(page);
  const stageStarters = () => page.evaluate(() => document.querySelectorAll('#stagePrompt .sc-starters li').length);
  eq(await stageStarters(), 2, 'set A opens with its own two starters');
  eq(await page.inputValue('#scaffoldStartersSelect'), '2', 'the control shows set A\'s choice');
  ok((await page.textContent('#scaffoldFor')).includes('Unit A'), 'and names the set it changes');
  await page.selectOption('#setSelect', 'sB'); await settle(page, 80);
  eq(await stageStarters(), 0, 'set B has none');
  eq(await page.inputValue('#scaffoldStartersSelect'), '0', 'and the control says so');
  eq(await page.evaluate(() => document.querySelectorAll('#stagePrompt .scaffold').length), 0, 'no scaffold on set B\'s stage');
  await page.selectOption('#scaffoldStartersSelect', '4');
  eq(await stageStarters(), 4, 'turning starters on in set B shows four');
  const sets = JSON.parse(await stored(page, 'sets'));
  eq(sets.find(s => s.id === 'sB').scaffold, { starters: 4, stuck: false }, 'set B saved its own choice');
  eq(sets.find(s => s.id === 'sA').scaffold, { starters: 2, stuck: true }, 'set A kept its own');
  ok(!('scaffold' in JSON.parse(await stored(page, 'settings'))), 'the draw setting was not touched by editing a set');
  await page.selectOption('#setSelect', 'sA'); await settle(page, 80);
  eq(await stageStarters(), 2, 'back on set A: its two again');
  // a draw has its own
  await page.click('[data-mode="draw"]'); await settle(page, 80);
  eq(await page.inputValue('#scaffoldStartersSelect'), '0', 'in draw mode the control shows the draw choice (none)');
  ok((await page.textContent('#scaffoldFor')).includes('prompt set keeps its own'), 'and says a set keeps its own');
  await page.click('[data-mode="sequence"]'); await settle(page, 80);
  // print follows the set
  await page.click('#printHandoutBtn');
  eq(await page.evaluate(() => document.querySelectorAll('#handoutPrintArea .half-sheet:first-child .sc-starters li').length), 2, 'the half-sheet follows set A (two starters)');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // the share link
  await page.click('#shareBtn'); await settle(page, 200);
  await page.click('button:has-text("Copy link")'); await settle(page, 300);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  ok(link.includes('prompts='), 'the link is a prompts link');
  const decoded = await page.evaluate(l => StateLink.decodeState(new URL(l).searchParams.get('prompts')), link);
  eq(decoded.sets.find(s => s.name === 'Unit A').scaffold, { starters: 2, stuck: true }, 'the link carries set A\'s choice');
  eq(decoded.sets.find(s => s.name === 'Unit B').scaffold, { starters: 4, stuck: false }, 'and set B\'s');
  await page.context().close();

  // arrival on a clean device keeps each set's choice
  const fresh = await openPage({}, { url: link });
  const arrived = JSON.parse(await stored(fresh, 'sets'));
  eq(arrived.map(s => s.name).sort(), ['Unit A', 'Unit B'], 'both sets arrive');
  eq(arrived.find(s => s.name === 'Unit A').scaffold, { starters: 2, stuck: true }, 'set A arrives with its choice');
  eq(arrived.find(s => s.name === 'Unit B').scaffold, { starters: 4, stuck: false }, 'set B arrives with its choice');
  await fresh.context().close();

  // an old link: no scaffold anywhere, opens as it did and saves no scaffold key
  const oldLinkState = { custom: [{ text: 'A prompt from an old link.', band: 'ms', genre: 'narrative' }], sets: [{ name: 'Old set', items: [{ band: 'ms', genre: 'narrative', text: 'Tell about a day.', rubricName: null }] }] };
  const old = await openPage({}, { url: URL_PAGE + '?prompts=' + encodeURIComponent(Buffer.from(unescape(encodeURIComponent(JSON.stringify(oldLinkState))), 'latin1').toString('base64')) });
  const oldSets = JSON.parse(await stored(old, 'sets'));
  eq(oldSets.length, 1, 'an old link still saves its set');
  ok(!('scaffold' in oldSets[0]), 'and writes no scaffold key on it');
  eq(JSON.parse(await stored(old, 'custom')).length, 1, 'and its custom prompt');
  await old.context().close();

  // junk in a link or a saved set is off, never a crash
  const junkState = { sets: [
    { name: 'J1', items: [{ band: 'ms', genre: 'narrative', text: 'x one', rubricName: null }], scaffold: { starters: 9, stuck: 'yes' } },
    { name: 'J2', items: [{ band: 'ms', genre: 'narrative', text: 'x two', rubricName: null }], scaffold: 'loud' },
    { name: 'J3', items: [{ band: 'ms', genre: 'narrative', text: 'x three', rubricName: null }], scaffold: { starters: '3', stuck: true } }] };
  const junk = await openPage({}, { url: URL_PAGE + '?prompts=' + encodeURIComponent(Buffer.from(unescape(encodeURIComponent(JSON.stringify(junkState))), 'latin1').toString('base64')) });
  const js = JSON.parse(await stored(junk, 'sets'));
  ok(!('scaffold' in js.find(s => s.name === 'J1')), 'a link with starters 9 and stuck "yes" arrives off');
  ok(!('scaffold' in js.find(s => s.name === 'J2')), 'a link whose scaffold is a string arrives off');
  eq(js.find(s => s.name === 'J3').scaffold, { starters: 3, stuck: true }, 'starters given as "3" are read');
  eq(junk.__errs, [], 'no page error on junk');
  await junk.context().close();
  const junkSaved = await openPage({ sets: [{ id: 'z', name: 'Z', startDate: null, cursor: 0, items: itemsA, scaffold: { starters: 1, stuck: 7 } }], activeSet: 'z', settings: { mode: 'sequence', scaffold: 'x' } });
  eq(junkSaved.__errs, [], 'a saved set and settings with junk scaffolds load without error');
  eq(await junkSaved.evaluate(() => document.querySelectorAll('#stagePrompt .scaffold').length), 0, 'and show nothing');
  await junkSaved.context().close();
}

/* ── 5. keyboard and screen reader ─────────────────────────────────────── */
if (GROUPS.includes('a11y')) {
  console.log(' 5. accessibility');
  const store = { settings: { bands: ['ms', 'hs'], genre: 'all', includeCustom: true, mode: 'sequence' }, activeSet: 'sA',
    sets: [{ id: 'sA', name: 'Unit A', startDate: null, cursor: 0, scaffold: { starters: 4, stuck: true }, items: [{ id: 'a1', band: 'hs', genre: 'creative', text: 'Write a story told entirely through text messages or emails.', rubricName: null }] }] };
  for (const theme of ['light', 'dark']) {
    const page = await openPage(store);
    if (theme === 'dark') { await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); }
    for (const include of ['#scaffoldRow', '#stagePrompt']) {
      const res = await a11yScan(page, { impact: 'serious', include });
      eq(res.map(v => v.id + ' ' + v.nodes.join(',')), [], `${theme}: axe finds nothing serious in ${include} with starters and the stuck line on`);
    }
    await page.context().close();
  }
  const page = await openPage(store);
  // keyboard: Tab from the handout row reaches the select and the checkbox, and each can be changed
  await page.focus('#handoutNameLineCheck');
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement.id), 'scaffoldStartersSelect', 'Tab goes from the half-sheet options to the starters select');
  await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement.id), 'scaffoldStuckCheck', 'then to the stuck box');
  await page.keyboard.press('Space');
  eq(await page.isChecked('#scaffoldStuckCheck'), false, 'Space toggles the stuck box');
  eq(await page.evaluate(() => document.querySelectorAll('#stagePrompt .sc-stuck').length), 0, 'and the line goes from the stage');
  const names = await page.evaluate(() => ({
    sel: document.getElementById('scaffoldStartersSelect').labels[0].textContent.trim(),
    chk: document.getElementById('scaffoldStuckCheck').labels[0].textContent.trim(),
    group: document.getElementById('scaffoldRow').getAttribute('role'),
    groupName: (document.getElementById(document.getElementById('scaffoldRow').getAttribute('aria-labelledby') || 'none') || { textContent: '' }).textContent.trim(),
    live: document.getElementById('scaffoldFor').getAttribute('aria-live'),
    heading: !!document.querySelector('#stagePrompt .sc-label')
  }));
  eq(names.sel, 'Sentence starters', 'the select has a visible label');
  ok(/stuck/.test(names.chk), 'the box has a visible label');
  eq(names.group, 'group', 'the pair is a labelled group');
  ok(/Help under each prompt/.test(names.groupName), 'named for what it does');
  eq(names.live, 'polite', 'a change of set is announced politely');
  ok(names.heading, 'the starters have a visible heading');
  // pick-a-set-first state
  const none = await openPage({ settings: { mode: 'sequence', bands: ['ms'], genre: 'all', includeCustom: true } });
  eq(await none.isDisabled('#scaffoldStartersSelect'), true, 'in sequence mode with no set the select is disabled');
  ok((await none.textContent('#scaffoldFor')).includes('pick a prompt set first'), 'and says why');
  await none.context().close();
  eq(page.__errs, [], 'no page error');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:\n  ' + fails.join('\n  ')); process.exit(1); }
