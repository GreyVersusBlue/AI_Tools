// smoke-callouts.mjs — the irregular-verb call-out box on the conjugation poster.
//
//   node Tools/verb-conjugation-poster-generator/test/smoke-callouts.mjs     (port 8510)
//
// Six things are pinned.
//  (A) A poster from before the boxes is untouched. golden-old-posters.json was
//      recorded by _record-golden.mjs from the page at 1aaee05, before any of
//      this: for 29 posters (nine starters at 1, 2 and 3 per row, and two with
//      colour off) the printed #printArea HTML is compared string for string and
//      Chromium's PDF by page count and a hash of its text. A saved poster of the
//      old shape loads and prints with its stored string unchanged, and turning a
//      box on and off again prints the old poster again.
//  (B) The data (irregulars.js) has the shape the page relies on, and the four
//      verbs the page's own ser/estar and avoir/être templates also hold agree
//      with it form for form. The suite does NOT check the Spanish or French:
//      no language teacher has reviewed the data (HISTORY.md lists every verb).
//  (C) The controls: off until turned on, up to five verbs, the box lists what
//      was ticked in the data's order, nothing prints with none ticked, a
//      starter opens the box on its own tense and off, focus is not moved.
//  (D) What is saved and what a link carries: the choice, in the poster's own
//      key; a link without one opens as before; a link with a bad one is cleaned.
//  (E) Fit. For every tense, at 1, 2 and 3 per row, with the most verbs the tense
//      offers, the poster is one page of Chromium's PDF with 0.4 in margins and
//      with none, nothing in the box is clipped, and every form is in the PDF's
//      text. The 1-per-row poster fills a page on its own, so the panels tighten
//      when a box is on (`#printArea.has-callout`).
//  (F) No console error, axe finds nothing serious, light and dark.
//
// PAGE_FILE=<file under Tools/> points the suite at a mutated copy of the page;
// SECTIONS=AB runs only those sections: the breaks-on-purpose runs use both.
// Names and text are made up. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { FIXTURES, printedHtml } from './_golden-fixtures.mjs';

const PORT = 8510;
const BASE = `http://127.0.0.1:${PORT}`;
const want = id => !process.env.SECTIONS || process.env.SECTIONS.indexOf(id) !== -1;
const PAGE = BASE + '/Tools/' + (process.env.PAGE_FILE || '079-verb-conjugation-poster-generator.html');
const KEY = 'vcp_poster_v1';
const GOLDEN = JSON.parse(fs.readFileSync(new URL('./golden-old-posters.json', import.meta.url), 'utf8'));
const DATA_SRC = fs.readFileSync(new URL('../' + (process.env.DATA_FILE || 'irregulars.js'), import.meta.url), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Verb Conjugation Reference Poster Generator — irregular call-out boxes');

const server = await serve(PORT);
const browser = await launch();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-callouts-'));
const pages = [];

/** A page. `seed` is written to the poster key once, before the page's script. */
async function open(seed, { url = PAGE, theme = null, width = 1400, height = 950 } = {}) {
  const page = await prepPage(browser, BASE, { width, height });
  pages.push(page);
  page.on('dialog', d => d.accept());
  await page.addInitScript(([k, v]) => {
    window.__pwned = 0;
    if (v !== null && localStorage.getItem(k) === null) localStorage.setItem(k, v);
  }, [KEY, seed === undefined ? null : (typeof seed === 'string' ? seed : JSON.stringify(seed))]);
  if (theme) await page.addInitScript(t => { localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: t, textScale: 100, dyslexic: false })); }, theme);
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const raw = page => page.evaluate(k => localStorage.getItem(k), KEY);
const stored = async page => { const r = await raw(page); return r ? JSON.parse(r) : null; };
const printNow = async page => {
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  await settle(page, 100);
  return page.evaluate(() => document.getElementById('printArea').innerHTML);
};
const sha = s => crypto.createHash('sha256').update(s.replace(/\s+/g, ' ').trim()).digest('hex');
/** Chromium's PDF of the printed poster: page count and text. margin is a CSS length. */
async function pdfOf(page, margin) {
  await page.emulateMedia({ media: 'print' });
  const file = path.join(scratch, 'p.pdf');
  fs.writeFileSync(file, await page.pdf(margin ? { format: 'Letter', margin: { top: margin, bottom: margin, left: margin, right: margin } } : { format: 'Letter' }));
  await page.emulateMedia({ media: 'screen' });
  const pagesN = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1]);
  return { pages: pagesN, text: execFileSync('pdftotext', ['-layout', file, '-']).toString() };
}
const boxOf = page => page.evaluate(() => {
  const b = document.querySelector('#printArea .poster-callout');
  if (!b) return null;
  return {
    title: b.querySelector('h3').textContent,
    heads: Array.from(b.querySelectorAll('thead th')).map(x => x.textContent),
    rows: Array.from(b.querySelectorAll('tbody tr')).map(r => [r.querySelector('th').textContent].concat(Array.from(r.querySelectorAll('td')).map(x => x.textContent))),
    note: (b.querySelector('.callnote') || {}).textContent || null,
    data: [b.getAttribute('data-lang'), b.getAttribute('data-tense')],
  };
});
const dataOf = page => page.evaluate(() => JSON.parse(JSON.stringify(window.VCP_IRREGULARS)));
const checkedVerbs = page => page.$$eval('[data-callout-verb]:checked', xs => xs.map(x => x.getAttribute('data-callout-verb')));
const loadTemplate = async (page, key) => { await page.selectOption('#templateSelect', key); await page.click('#loadTemplateBtn'); };
/** Tick exactly these verbs, by id, in the order given. */
async function pick(page, ids) {
  for (const id of await checkedVerbs(page)) {
    if (!ids.includes(id)) await page.locator(`[data-callout-verb="${id}"]`).uncheck();
  }
  for (const id of ids) {
    const box = page.locator(`[data-callout-verb="${id}"]`);
    if (!(await box.isChecked())) await box.check();
  }
}
const tenseKeys = ['es:present', 'es:preterite', 'es:imperfect', 'es:future', 'fr:present', 'fr:imperfect'];
const STARTER = { 'es:present': 'es_present', 'es:preterite': 'es_preterite', 'es:imperfect': 'es_imperfect', 'es:future': 'es_future', 'fr:present': 'fr_present', 'fr:imperfect': 'fr_imperfect' };

/* ═══ A. a poster from before prints what it always did ═══════════════════ */
if (want('A')) {
  console.log('\nA. posters from before the boxes');
  const page = await open();
  for (const [name, tpl, cols, color] of FIXTURES) {
    const html = await printedHtml(page, tpl, cols, color);
    eq(html === GOLDEN[name].html, true, `${name}: the printed poster is the recorded one, string for string`);
    ok(!/poster-callout/.test(html), `${name}: no call-out markup`);
  }
  // PDFs, a spread: every starter at 1 per row and the two colour-off ones
  for (const [name, tpl, cols, color] of FIXTURES.filter(f => f[2] === 1 || !f[3] || f[2] === 3)) {
    await printedHtml(page, tpl, cols, color);
    const pdf = await pdfOf(page);
    eq([pdf.pages, sha(pdf.text)], [GOLDEN[name].pages, GOLDEN[name].textSha], `${name}: Chromium's PDF has the recorded page count and text`);
  }
  await page.close();

  // a saved poster of the old shape: no `callout` key
  const seedPage = await open();
  await loadTemplate(seedPage, 'es_preterite');
  const blob = await stored(seedPage);
  await seedPage.close();
  delete blob.callout;
  const oldString = JSON.stringify(blob);
  const old = await open(oldString);
  eq(await raw(old), oldString, 'an old saved poster: the stored string is untouched by loading');
  const oldHtml = await printNow(old);
  eq(await raw(old), oldString, 'an old saved poster: and by printing');
  ok(!/poster-callout/.test(oldHtml) && !(await old.evaluate(() => document.getElementById('printArea').classList.contains('has-callout'))), 'an old saved poster prints with no box and no tightened panels');
  eq(await old.isChecked('#calloutOn'), false, 'an old saved poster: the box is off');
  // on then off again prints the old poster again
  await old.check('#calloutOn');
  ok(/poster-callout/.test(await printNow(old)), 'turning the box on puts a box in the print');
  await old.uncheck('#calloutOn');
  const back = await printNow(old);
  eq(back === oldHtml, true, 'turning it off again prints the old poster again');
  eq(await old.evaluate(() => document.getElementById('printArea').classList.contains('has-callout')), false, 'and takes the tightened-panel class off');
  await old.close();
}

/* ═══ B. the data ═════════════════════════════════════════════════════════ */
if (want('B')) {
  console.log('\nB. the data');
  const win = {};
  vm.runInNewContext(DATA_SRC, { window: win });
  const D = win.VCP_IRREGULARS;
  eq(Object.keys(D.tenses), tenseKeys, 'exactly the six tenses the page has starters for');
  eq(Object.keys(D.languages), ['es', 'fr'], 'two languages');
  for (const l of Object.keys(D.languages)) eq(D.languages[l].persons.length, 6, `${l}: six person labels`);
  for (const [k, t] of Object.entries(D.tenses)) {
    eq([t.lang + ':' + t.tense], [k], `${k}: keyed by its own language and tense`);
    ok(t.verbs.length >= 3 && t.verbs.length <= 8, `${k}: three to eight verbs offered (${t.verbs.length})`);
    const ids = t.verbs.map(v => v.id);
    eq(new Set(ids).size, ids.length, `${k}: no verb id twice`);
    ok(t.verbs.every(v => v.forms.length === 6 && v.forms.every(f => /^\S+$/.test(f))), `${k}: every verb has six one-word forms`);
    ok(t.verbs.every(v => v.name.indexOf(v.id) === 0 && /\(to .+\)$/.test(v.name)), `${k}: every name is the verb and its English`);
    ok(t.defaults.length >= 3 && t.defaults.length <= 5 && t.defaults.every(d => ids.includes(d)), `${k}: three to five defaults, all offered`);
    ok(t.verbs.every(v => v.forms.every(f => f === f.toLowerCase())), `${k}: forms are lower case`);
    const seen = new Map();
    for (const v of t.verbs) { const key = v.forms.join(' '); if (seen.has(key)) seen.set(key, seen.get(key).concat(v.id)); else seen.set(key, [v.id]); }
    const twins = Array.from(seen.values()).filter(x => x.length > 1);
    eq(k === 'es:preterite' ? twins : twins.length ? twins : [], k === 'es:preterite' ? [['ser', 'ir']] : [], `${k}: no two verbs share forms (ser and ir share the preterite, which is true)`);
  }
  eq(D.tenses['es:imperfect'].verbs.map(v => v.id), ['ser', 'ir', 'ver'], 'Spanish imperfect: the three irregulars, no more');
  eq(Object.keys(D.tenses['fr:imperfect']).includes('note') && /ét-/.test(D.tenses['fr:imperfect'].note), true, 'French imperfect carries its note');
  eq(Object.keys(D.tenses).filter(k => D.tenses[k].note), ['fr:imperfect'], 'and only that tense does');

  if (want('B')) {
    // the page's own starters hold four of these verbs, typed by hand: they must agree
    const page = await open();
    const data = await dataOf(page);
    eq(data, JSON.parse(JSON.stringify(D)), 'the page serves the data file as it is on disk');
    for (const [tpl, lang] of [['es_irregulars', 'es'], ['fr_irregulars', 'fr']]) {
      await loadTemplate(page, tpl);
      const panels = await page.$$eval('.panel-block', bs => bs.map(b => ({
        name: b.querySelector('[data-panel-name]').value,
        forms: Array.from(b.querySelectorAll('input[data-idx]')).map(i => i.value) })));
      for (const p of panels) {
        const id = p.name.split(' ')[0];
        const verb = data.tenses[lang + ':present'].verbs.find(v => v.id === id);
        ok(!!verb, `${tpl}: ${id} is offered in the data`);
        eq(verb && verb.forms, p.forms, `${tpl}: ${id}'s forms in the data equal the starter's`);
      }
    }
    await page.close();
  }
}

/* ═══ C. the controls ═════════════════════════════════════════════════════ */
if (want('C')) {
  console.log('\nC. the controls');
  const page = await open();
  const data = await dataOf(page);
  eq(await page.isChecked('#calloutOn'), false, 'a new poster: the box is off');
  for (const id of ['calloutOn', 'calloutLang', 'calloutTense']) {
    eq(await page.evaluate(i => !!document.querySelector('label[for="' + i + '"]'), id), true, `${id} has a label`);
  }
  eq(await page.$eval('#calloutVerbs', el => !!el.closest('fieldset') && !!el.closest('fieldset').querySelector('legend')), true, 'the verbs sit in a fieldset with a legend');
  eq(await page.$$eval('#calloutLang option', o => o.map(x => x.textContent)), ['Spanish', 'French'], 'the language choices');
  eq(await page.$$eval('#calloutTense option', o => o.map(x => x.textContent)), ['Present', 'Preterite', 'Imperfect', 'Future'], 'Spanish tenses offered');
  const noBox = await printNow(page);
  ok(!/poster-callout/.test(noBox), 'box off: nothing in the print');

  await loadTemplate(page, 'es_preterite');
  eq([await page.inputValue('#calloutLang'), await page.inputValue('#calloutTense'), await page.isChecked('#calloutOn')], ['es', 'preterite', false], 'the Spanish Preterite starter opens the controls on Spanish, Preterite, off');
  eq(await checkedVerbs(page), data.tenses['es:preterite'].defaults, 'the defaults are ticked');
  eq((await stored(page)).callout, { on: false, lang: 'es', tense: 'preterite', verbs: data.tenses['es:preterite'].defaults }, 'the starter saves the box off, with its tense and defaults');
  await page.check('#calloutOn');
  let box = await printNow(page).then(() => boxOf(page));
  eq(box.title, 'Common irregular verbs — Preterite', 'the box says its tense');
  eq(box.data, ['es', 'preterite'], 'the box carries its language and tense');
  eq(box.heads, data.languages.es.persons, 'its columns are the language\'s persons');
  eq(box.rows.map(r => r[0]), data.tenses['es:preterite'].defaults.map(id => data.tenses['es:preterite'].verbs.find(v => v.id === id).name), 'one row per default verb, named');
  eq(box.rows.map(r => r.slice(1)), data.tenses['es:preterite'].defaults.map(id => data.tenses['es:preterite'].verbs.find(v => v.id === id).forms), 'every form is the data\'s');
  eq(box.note, null, 'no note on a tense without one');
  ok(await page.evaluate(() => document.getElementById('printArea').classList.contains('has-callout')), 'a box on: the page is marked so the panels tighten');
  ok(await page.evaluate(() => document.querySelectorAll('#printArea .poster-panel').length) === 3, 'the three panels are still there');

  // picking: five at most, in the data's order, and focus does not move
  const preterite = data.tenses['es:preterite'].verbs.map(v => v.id);
  await page.focus('[data-callout-verb="decir"]');
  await page.keyboard.press('Space');
  eq(await page.evaluate(() => document.activeElement.getAttribute('data-callout-verb')), 'decir', 'ticking a verb keeps focus on it');
  eq(await checkedVerbs(page), preterite.filter(id => data.tenses['es:preterite'].defaults.concat(['decir']).includes(id)), 'the ticked verbs are kept in the data\'s order');
  eq(await page.$$eval('[data-callout-verb]:disabled', x => x.length), preterite.length - 5, 'five chosen: every other box is disabled');
  ok(/5 of 5 verbs chosen/.test(await page.textContent('#calloutStatus')), 'the status says five of five');
  eq(await page.getAttribute('#calloutStatus', 'aria-live'), 'polite', 'and is a polite live region');
  await page.focus('[data-callout-verb="decir"]');
  await page.keyboard.press('Space');
  eq(await page.$$eval('[data-callout-verb]:disabled', x => x.length), 0, 'one unticked: the others are free again');
  ok(/4 of 5 verbs chosen/.test(await page.textContent('#calloutStatus')), 'the status says four of five');
  await pick(page, ['venir', 'poder', 'ser']);
  box = await printNow(page).then(() => boxOf(page));
  eq(box.rows.map(r => r[0].split(' ')[0]), ['ser', 'poder', 'venir'], 'three verbs ticked in any order print in the data\'s order');
  await pick(page, []);
  ok(/Nothing will print until you pick at least one/.test(await page.textContent('#calloutStatus')), 'with none picked and the box on, the status says nothing will print');
  eq(await printNow(page).then(() => boxOf(page)), null, 'none picked: no box (and no empty frame) is printed');
  eq(await page.evaluate(() => document.getElementById('printArea').classList.contains('has-callout')), false, 'and the panels are not tightened');

  // tense and language changes take the new defaults
  await page.selectOption('#calloutTense', 'future');
  eq(await checkedVerbs(page), data.tenses['es:future'].defaults, 'a new tense takes its defaults');
  eq((await stored(page)).callout.tense, 'future', 'and saves it');
  await page.selectOption('#calloutLang', 'fr');
  eq([await page.inputValue('#calloutTense'), await checkedVerbs(page)], ['present', data.tenses['fr:present'].defaults], 'a new language opens on its first tense with its defaults');
  eq(await page.$$eval('#calloutTense option', o => o.map(x => x.textContent)), ['Present', 'Imperfect'], 'French tenses offered');
  eq(await page.isChecked('#calloutOn'), true, 'changing them leaves the box on');
  await page.selectOption('#calloutTense', 'imperfect');
  box = await printNow(page).then(() => boxOf(page));
  eq(box.heads, data.languages.fr.persons, 'French persons head the columns');
  ok(/ét-/.test(box.note || ''), 'the French imperfect note prints under the box');
  eq(box.rows.length, 4, 'four defaults print');
  // a teacher who renames the persons on the poster does not change the box's columns
  await page.fill('[data-person="0"]', 'moi');
  box = await printNow(page).then(() => boxOf(page));
  eq(box.heads, data.languages.fr.persons, 'renaming a person on the poster leaves the box\'s own columns alone');

  // a starter replaces the poster, box and all
  await loadTemplate(page, 'es_present');
  eq([await page.isChecked('#calloutOn'), await page.inputValue('#calloutLang'), await page.inputValue('#calloutTense')], [false, 'es', 'present'], 'loading a starter turns the box off and sets its tense');
  eq(await printNow(page).then(() => boxOf(page)), null, 'and nothing prints');
  await page.check('#calloutOn');
  await loadTemplate(page, 'blank');
  eq((await stored(page)).callout, undefined, 'the blank starter keeps no call-out settings');
  eq([await page.isChecked('#calloutOn'), await page.inputValue('#calloutLang'), await page.inputValue('#calloutTense')], [false, 'es', 'present'], 'and the controls fall back to Spanish present, off');
  await page.check('#calloutOn');
  ok(!!(await stored(page)).callout && (await stored(page)).callout.on === true, 'a box turned on for a custom poster is saved');
  box = await printNow(page).then(() => boxOf(page));
  eq(box && box.rows.length, 4, 'and prints the Spanish present defaults');
  await page.close();
}

/* ═══ D. saved, and carried by a link ═════════════════════════════════════ */
if (want('D')) {
  console.log('\nD. saved choice and the share link');
  const page = await open();
  await loadTemplate(page, 'fr_present');
  await page.check('#calloutOn');
  await pick(page, ['prendre', 'faire', 'être']);
  const saved = (await stored(page)).callout;
  eq(saved, { on: true, lang: 'fr', tense: 'present', verbs: ['être', 'faire', 'prendre'] }, 'the choice is saved in the poster\'s own key, in the data\'s order');
  eq(Object.keys(await stored(page)).includes('v'), false, 'the key still holds the bare poster (no version wrapper added)');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 200);
  eq([await page.isChecked('#calloutOn'), await page.inputValue('#calloutLang'), await page.inputValue('#calloutTense'), await checkedVerbs(page)], [true, 'fr', 'present', ['être', 'faire', 'prendre']], 'reloading brings the choice back');
  const reprint = await printNow(page).then(() => boxOf(page));
  eq(reprint.rows.map(r => r[0].split(' ')[0]), ['être', 'faire', 'prendre'], 'and prints it');
  // a saved box that is not usable is dropped in memory, never rewritten
  const bad = JSON.parse(await raw(page)); bad.callout = { on: true, lang: 'de', tense: 'present', verbs: ['sein'] };
  const badStr = JSON.stringify(bad);
  const p2 = await open(badStr);
  eq(await raw(p2), badStr, 'a saved box that names an unknown language: the stored string is untouched');
  eq(await p2.isChecked('#calloutOn'), false, 'and the controls show it off');
  ok(!/poster-callout/.test(await printNow(p2)), 'and it prints no box');
  await p2.close();

  // the link: the whole poster, box included
  await page.click('#shareBtn');
  await settle(page, 250);
  const link = await page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
  const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('poster')), link);
  eq(payload.callout, saved, 'the share link carries the choice');
  const recv = await open(undefined, { url: link });
  eq([await recv.isChecked('#calloutOn'), await recv.inputValue('#calloutLang'), await recv.inputValue('#calloutTense'), await checkedVerbs(recv)], [true, 'fr', 'present', ['être', 'faire', 'prendre']], 'a link opened elsewhere sets the controls');
  eq((await boxOf(recv)) || (await printNow(recv).then(() => boxOf(recv))), (await boxOf(page)), 'and prints the same box');
  eq((await stored(recv)).callout, saved, 'and saves it');
  await recv.close();

  // a link from before: no callout key
  const oldPayload = JSON.parse(JSON.stringify(payload)); delete oldPayload.callout;
  const oldUrl = await page.evaluate(([b, p]) => b + '?poster=' + encodeURIComponent(window.StateLink.encodeState(p)), [PAGE, oldPayload]);
  const oldRecv = await open(undefined, { url: oldUrl });
  const oldBlob = await stored(oldRecv);
  eq('callout' in oldBlob, false, 'a link made before the boxes opens with no call-out key saved');
  eq(await oldRecv.isChecked('#calloutOn'), false, 'and the box off');
  ok(!/poster-callout/.test(await printNow(oldRecv)), 'and prints no box');
  await oldRecv.close();

  // a link with junk in it is cleaned, and nothing runs
  const evil = '<img src=x onerror="window.__pwned=1">';
  const junk = JSON.parse(JSON.stringify(payload));
  junk.callout = { on: true, lang: 'fr', tense: 'present', verbs: ['être', evil, 'être', 'faire', 'aller', 'avoir', 'prendre', 'vouloir', 'pouvoir', 'venir'] };
  const junkUrl = await page.evaluate(([b, p]) => b + '?poster=' + encodeURIComponent(window.StateLink.encodeState(p)), [PAGE, junk]);
  const j = await open(undefined, { url: junkUrl });
  eq((await stored(j)).callout.verbs, ['être', 'avoir', 'aller', 'faire', 'prendre'], 'ten verb ids, one unknown, one twice: the first five good ones are kept, in the data\'s order');
  const jb = await printNow(j).then(() => boxOf(j));
  eq(jb.rows.length, 5, 'five rows print');
  eq(await j.evaluate(() => window.__pwned), 0, 'the unknown id ran nothing');
  await j.close();
  for (const [label, callout] of [
    ['an unknown tense', { on: true, lang: 'es', tense: 'subjunctive', verbs: ['ir'] }],
    ['markup as the language', { on: true, lang: evil, tense: 'present', verbs: ['ir'] }],
    ['markup as the tense', { on: true, lang: 'es', tense: evil, verbs: ['ir'] }],
    ['a string for the verbs', { on: true, lang: 'es', tense: 'present', verbs: 'ir' }],
    ['a number for the box', 7],
  ]) {
    const pl = JSON.parse(JSON.stringify(payload)); pl.callout = callout;
    const u = await page.evaluate(([b, p]) => b + '?poster=' + encodeURIComponent(window.StateLink.encodeState(p)), [PAGE, pl]);
    const r = await open(undefined, { url: u });
    const b = await stored(r);
    ok(!('callout' in b) || !b.callout.on || b.callout.verbs.length === 0, `${label}: no usable box is saved on`);
    ok(!/poster-callout/.test(await printNow(r)), `${label}: nothing prints`);
    eq(await r.evaluate(() => window.__pwned), 0, `${label}: nothing ran`);
    await r.close();
  }
  await page.close();
}

/* ═══ E. fit ══════════════════════════════════════════════════════════════ */
if (want('E')) {
  console.log('\nE. the poster still fits its page');
  const page = await open();
  const data = await dataOf(page);
  for (const key of tenseKeys) {
    const t = data.tenses[key];
    const most = t.verbs.slice(0, 5).map(v => v.id);
    for (const cols of [1, 2, 3]) {
      await loadTemplate(page, STARTER[key]);
      await page.selectOption('#colCount', String(cols));
      await page.check('#calloutOn');
      await pick(page, most);
      await printNow(page);
      const tag = `${key} at ${cols} per row, ${most.length} verbs`;
      const m = await page.evaluate(() => {
        const b = document.querySelector('#printArea .poster-callout');
        const cells = Array.from(b.querySelectorAll('th, td'));
        let overflow = 0, hidden = 0;
        for (let el = b; el && el !== document.body; el = el.parentElement) {
          const o = getComputedStyle(el).overflow;
          if (el !== b && (o === 'hidden' || o === 'clip')) hidden++;
        }
        cells.forEach(c => { if (c.scrollWidth > c.clientWidth + 1) overflow++; });
        const pa = document.getElementById('printArea').getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return { overflow, hidden, boxInside: br.left >= pa.left - 1 && br.right <= pa.right + 1, rows: b.querySelectorAll('tbody tr').length };
      });
      eq([m.overflow, m.hidden, m.boxInside, m.rows], [0, 0, true, most.length], `${tag}: nothing in the box is clipped, and all rows are in it`);
      const withMargin = await pdfOf(page, '0.4in');
      eq(withMargin.pages, 1, `${tag}: one page with 0.4 in margins`);
      const noMargin = await pdfOf(page);
      eq(noMargin.pages, 1, `${tag}: one page with no margins`);
      const missing = [];
      for (const id of most) for (const f of t.verbs.find(v => v.id === id).forms) {
        if (!new RegExp('(^|[^\\p{L}])' + f + '([^\\p{L}]|$)', 'u').test(withMargin.text)) missing.push(id + ':' + f);
      }
      eq(missing, [], `${tag}: every form is in the PDF's text`);
    }
  }
  // the two irregulars starters, and a one-panel poster, with the box
  for (const [tpl, cols] of [['es_irregulars', 1], ['fr_irregulars', 1], ['blank', 1]]) {
    await loadTemplate(page, tpl);
    await page.selectOption('#colCount', String(cols));
    await page.check('#calloutOn');
    await printNow(page);
    eq((await pdfOf(page, '0.4in')).pages, 1, `${tpl} at ${cols} per row with the box: one page`);
  }
  // the box is measured, not guessed: it really is taller than the panels' gap
  await loadTemplate(page, 'es_present');
  await page.selectOption('#colCount', '1');
  await page.check('#calloutOn');
  await pick(page, ['ser', 'estar', 'ir', 'tener', 'hacer']);
  await printNow(page);
  await page.emulateMedia({ media: 'print' });
  const heights = await page.evaluate(() => {
    const q = s => document.querySelector(s).getBoundingClientRect();
    const pa = q('#printArea'), box = q('.poster-callout'), panels = Array.from(document.querySelectorAll('.poster-panel')).map(p => p.getBoundingClientRect());
    return { total: pa.height, box: box.height, lastPanelBottom: panels[panels.length - 1].bottom, boxTop: box.top };
  });
  await page.emulateMedia({ media: 'screen' });
  ok(heights.box > 100 && heights.boxTop >= heights.lastPanelBottom - 1, `the box has height (${Math.round(heights.box)} px) and sits under the last panel`);
  ok(heights.total <= 981, `1 per row, five verbs: the poster is ${Math.round(heights.total)} px tall, inside a Letter page with 0.4 in margins (981 px)`);
  await page.close();
}

/* ═══ F. errors and accessibility ═════════════════════════════════════════ */
if (want('F')) {
  console.log('\nF. errors and accessibility');
  for (const theme of ['light', 'dark']) {
    const page = await open(undefined, { theme });
    eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', theme === 'dark', `${theme}: the page is in the theme asked for`);
    await page.check('#calloutOn');
    const scan = await a11yScan(page, { impact: 'serious' });
    eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], `${theme}: axe finds nothing serious with the box on`);
    await page.selectOption('#calloutLang', 'fr');
    await pick(page, ['aller', 'faire', 'avoir', 'être', 'venir']);
    const scan2 = await a11yScan(page, { impact: 'serious' });
    eq(scan2.map(v => v.id + ' ' + v.nodes.join(',')), [], `${theme}: and with five French verbs ticked`);
    await printNow(page);
    await page.close();
  }
}

for (const p of pages) {
  const errs = p.__errs || [];
  if (errs.length) { ok(false, 'page errors: ' + errs.slice(0, 3).join(' | ')); }
}
ok(true, 'every page opened by this run is checked for console and page errors');
fs.rmSync(scratch, { recursive: true, force: true });
await browser.close();
server.close && server.close();
console.log(`\n${failed ? 'FAILED' : 'ok'} — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
