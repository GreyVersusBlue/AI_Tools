// smoke-two-symbols.mjs — 074: a label may carry a second symbol.
//
//   node Tools/science-safety-label-maker/test/smoke-two-symbols.mjs
//
// A queued label used to be { id, symbol, text, qty }. It may now also have
// `symbol2`, the key of a second symbol printed beside the first. What this pins:
//
//   - a set saved before the change loads and prints as it did: the card built
//     from an old label is the string the old page built (a golden taken from
//     the old page), the stored string is not rewritten by loading, printing or
//     opening a label to edit it, and a saved set of 41 labels prints the same
//     pages in Chromium's PDF as the same set with every second symbol removed
//   - the edit form: a second picker of nine hazard symbols and "No second
//     symbol" (never the equipment box), the first symbol's key disabled in it,
//     an equipment label with no second symbol to offer, pressed state spoken
//     with aria-pressed, groups named, usable from the keyboard; Add, Edit and
//     Save changes carry it, and a label with none stores no `symbol2` key at all
//   - what a duplicate is: the same text (case and outer spaces ignored) with the
//     same symbols IN THE SAME ORDER; a note says so and the label is still
//     added; flammable-then-toxic is not toxic-then-flammable, and one symbol is
//     not two; the Duplicate button copies both symbols
//   - the printed card: one symbol is the svg and the text exactly as before, two
//     are a row of two svgs and the text; the card is as tall and as wide as a
//     one-symbol card with the same text, at all three sizes; neither symbol is
//     clipped, squeezed, over the border or over the other; the text ends inside
//     the border; on a paper too narrow for two across the row wraps and the
//     card grows rather than clip; the PDF has as many pages as the same sheet
//     of one-symbol labels, light and dark
//   - the preview shows the same two-symbol cards with the PDF's page count
//   - a share link carries symbol2, and one carrying a second symbol this build
//     cannot honour (unknown key, equipment box, the first symbol again, or on an
//     equipment label) prints the first symbol only; hand-edited storage the same
//
// print() is stubbed; the PDF is Chromium's. Nothing was printed on paper.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8501;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '074-science-safety-label-maker.html';
const KEY = 'sslm_queue_v1';
const IN = 96;
// ONLY=2,3 runs just those numbered sections (for breaking one thing on purpose); unset runs all.
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const want = n => !only || only.has(n);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const SYMS = ['flammable', 'corrosive', 'toxic', 'biohazard', 'electrical', 'sharp', 'eyeprotect', 'hot', 'fragile', 'none'];
const COLOR = { flammable: 'err', corrosive: 'sym-corrosive', toxic: 'ink', biohazard: 'sym-biohazard', electrical: 'sym-electrical', sharp: 'muted', eyeprotect: 'accent-2', hot: 'err', fragile: 'accent-2', none: 'muted' };
const LONG = 'Hydrochloric acid 1 M, teacher use only, return to locked cabinet B after every period and sign the log on the door';
const SIZE = { small: { cols: 4, h: 1.5 * IN, svg: 44 }, medium: { cols: 3, h: 2 * IN, svg: 44 }, large: { cols: 2, h: 2.75 * IN, svg: 60 } };

/** n labels as rows of up to seven copies, a different symbol on each row (the old suites' shape), plus a long one. */
function oldQueue(n, long = true) {
  const items = [];
  for (let left = n, i = 0; left > 0; i++) {
    const qty = Math.min(left, 7);
    items.push({ id: 'l' + i, symbol: SYMS[i % SYMS.length], text: 'Shelf ' + (i + 1), qty });
    left -= qty;
  }
  if (long) items.push({ id: 'x', symbol: 'corrosive', text: LONG, qty: 1 });
  return items;
}
/** The same rows, every other one carrying a second symbol (never the first's own, never the box). */
const withSeconds = queue => queue.map((it, i) => (i % 2 === 0 && it.symbol !== 'none')
  ? { ...it, symbol2: SYMS[(SYMS.indexOf(it.symbol) + 3) % 9] } : it);

async function open(browser, saved, theme, view = { width: 1100, height: 900 }, raw = null) {
  const page = await prepPage(browser, BASE, view);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([key, value, dark]) => {
    if (value) localStorage.setItem(key, value);
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [KEY, raw || (saved ? JSON.stringify(saved) : null), theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const stored = page => page.evaluate(k => localStorage.getItem(k), KEY);
const storedQueue = async page => JSON.parse(await stored(page)).queue;
const pick1 = (page, key) => page.click(`#symbolPicker [data-symbol="${key}"]`);
const pick2 = (page, key) => page.click(`#symbolPicker2 [data-symbol2="${key}"]`);
async function add(page, text, qty = 1) {
  await page.fill('#labelText', text);
  await page.fill('#labelQty', String(qty));
  await page.click('#addLabelBtn');
}
const dupNote = page => page.evaluate(() => { const n = document.getElementById('dupNote'); return n.style.display === 'none' ? '' : n.textContent; });

console.log('074 — a label may carry a second symbol');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/id="symbolPicker2"/.test(src) && /symbol2/.test(src), 'the page has a second picker and a symbol2 field');
ok(!/@media\s+print/.test(src) && !/@page/.test(src), 'and still no print rule of its own');

const server = await serve(PORT);
const browser = await launch();

// ---- 1. a set saved before this change -------------------------------------
if (want(1)) {
  const queue = oldQueue(40);
  const raw = JSON.stringify({ labelSize: 'medium', queue }); // not the order save() writes, so a rewrite shows
  const page = await open(browser, null, 'light', { width: 7.5 * IN, height: 900 }, raw);
  try {
    eq(await page.locator('#queueWrap .queue-row').count(), queue.length, 'every old label is a row');
    eq(await page.locator('#queueWrap .queue-row svg').count(), queue.length, 'each row has one symbol, as before');
    eq(await page.locator('#queueWrap .qsyms').count(), 0, 'and no pair of symbols');
    eq(await page.evaluate(() => [...document.querySelectorAll('#queueWrap .qtext em')].slice(0, 3).map(e => e.textContent)), ['Flammable', 'Corrosive', 'Toxic / Poison'], 'a row names its one symbol, as before');
    eq(await stored(page), raw, 'loading the set did not rewrite it');
    await page.click('#printBtn');
    await settle(page, 150);
    const card = await page.evaluate(() => document.querySelector('#printArea .label-card').outerHTML);
    eq(card, '<div class="label-card pk-card"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="color:var(--err)"><path d="M16 4c-3 6-9 8-9 15a9 9 0 0018 0c0-5-3-6-3-10-2 3-3 4-3 6a3 3 0 01-6 0c0-4 2-6 3-11z" fill="currentColor"></path></svg><div class="ltext">Shelf 1</div></div>', 'an old label prints the card the old page printed, byte for byte');
    eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .label-card')].filter(c => c.children.length !== 2 || c.firstElementChild.localName !== 'svg').length), 0, 'every card of the set is one svg and its text');
    eq(await stored(page), raw, 'printing did not rewrite it either');
    await page.click('#queueWrap [data-edit="l1"]');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .selected')].map(b => b.getAttribute('data-symbol2'))), [''], 'editing an old label shows "No second symbol" chosen');
    eq(await stored(page), raw, 'opening it did not rewrite it');
    await page.click('#addLabelBtn');
    const q = await storedQueue(page);
    eq(q.find(i => i.id === 'l1'), { id: 'l1', symbol: 'corrosive', text: 'Shelf 2', qty: 7 }, 'saving it untouched leaves it with no symbol2 key');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `an old set: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- 2. the edit form ------------------------------------------------------
if (want(2)) {
  const page = await open(browser, null, 'light');
  try {
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .symbol-btn')].map(b => b.getAttribute('data-symbol2'))),
      ['', 'flammable', 'corrosive', 'toxic', 'biohazard', 'electrical', 'sharp', 'eyeprotect', 'hot', 'fragile'], 'the second picker is "No second symbol" and nine hazards, not the equipment box');
    eq(await page.evaluate(() => document.querySelector('#symbolPicker2 [data-symbol2=""] span').textContent), 'No second symbol', 'the first button says what it does');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .symbol-btn')].filter(b => b.querySelector('svg')).length), 9, 'and the nine others carry their symbol');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .selected')].map(b => b.getAttribute('data-symbol2'))), [''], 'no second symbol is chosen at first');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 [disabled]')].map(b => b.getAttribute('data-symbol2'))), ['flammable'], 'the first symbol (flammable) cannot be picked a second time');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .symbol-btn')].map(b => b.getAttribute('aria-pressed')).join()), 'true,false,false,false,false,false,false,false,false,false', 'the chosen button says so with aria-pressed');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker .symbol-btn')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.getAttribute('data-symbol'))), ['flammable'], 'and so does the first picker now');
    eq(await page.evaluate(() => ['symbolPicker', 'symbolPicker2'].map(id => { const g = document.getElementById(id); return g.getAttribute('role') + ':' + (g.getAttribute('aria-label') || document.getElementById(g.getAttribute('aria-labelledby')).textContent); })), ['group:First symbol', 'group:Second symbol (optional)'], 'each picker is a named group');

    await pick2(page, 'toxic');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .selected')].map(b => b.getAttribute('data-symbol2'))), ['toxic'], 'a second symbol is chosen');
    eq(await page.evaluate(() => document.activeElement.getAttribute('data-symbol2')), 'toxic', 'and keeps focus, as the picker is rebuilt');
    await add(page, 'Ethanol', 2);
    eq(await storedQueue(page), [{ id: (await storedQueue(page))[0].id, symbol: 'flammable', text: 'Ethanol', qty: 2, symbol2: 'toxic' }], 'Add stores symbol2 beside symbol');
    eq(await page.evaluate(() => [...document.querySelectorAll('#queueWrap .queue-row svg')].length), 2, 'the row shows both symbols');
    eq(await page.evaluate(() => document.querySelector('#queueWrap .qtext em').textContent), 'Flammable + Toxic / Poison', 'and names both, in order');

    // the picker keeps its choices after an Add, as it always has; a one-symbol label stores no symbol2 key
    await pick2(page, '');
    await add(page, 'Matches');
    eq(Object.keys((await storedQueue(page))[1]).sort(), ['id', 'qty', 'symbol', 'text'], 'a label with no second symbol stores no symbol2 key');

    // choosing the second symbol as the first clears it; the equipment box offers no second symbol
    await pick1(page, 'flammable'); await pick2(page, 'toxic'); await pick1(page, 'toxic');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 .selected')].map(b => b.getAttribute('data-symbol2'))), [''], 'making the second symbol the first clears the second');
    eq(await page.evaluate(() => [...document.querySelectorAll('#symbolPicker2 [disabled]')].map(b => b.getAttribute('data-symbol2'))), ['toxic'], 'and disables it in the second picker');
    await pick2(page, 'hot'); await pick1(page, 'none');
    eq(await page.evaluate(() => [[...document.querySelectorAll('#symbolPicker2 .selected')].map(b => b.getAttribute('data-symbol2')), document.querySelectorAll('#symbolPicker2 [disabled]').length]), [[''], 9], 'an equipment label clears the second symbol and offers none');
    await page.evaluate(() => document.querySelector('#symbolPicker2 [data-symbol2="hot"]').click());
    eq(await page.evaluate(() => document.querySelector('#symbolPicker2 .selected').getAttribute('data-symbol2')), '', 'and a disabled button cannot be pressed');
    await add(page, 'Bin 4');
    eq((await storedQueue(page))[2].symbol2, undefined, 'so the equipment label is saved with no second symbol');

    // the keyboard: Tab to a second-symbol button and press Enter, then Space
    await pick1(page, 'sharp');
    eq(await page.evaluate(() => document.activeElement.getAttribute('data-symbol')), 'sharp', 'choosing the first symbol keeps focus on it, as the picker is rebuilt');
    await page.focus('#symbolPicker2 [data-symbol2="hot"]');
    await page.keyboard.press('Enter');
    eq(await page.evaluate(() => document.querySelector('#symbolPicker2 .selected').getAttribute('data-symbol2')), 'hot', 'Enter chooses a second symbol');
    await page.focus('#symbolPicker2 [data-symbol2="fragile"]');
    await page.keyboard.press('Space');
    eq(await page.evaluate(() => document.querySelector('#symbolPicker2 .selected').getAttribute('data-symbol2')), 'fragile', 'Space does too');

    // Edit loads it; Save changes carries a change, and "No second symbol" removes it
    const id0 = (await storedQueue(page))[0].id;
    await page.click(`#queueWrap [data-edit="${id0}"]`);
    eq(await page.evaluate(() => [document.querySelector('#symbolPicker .selected').getAttribute('data-symbol'), document.querySelector('#symbolPicker2 .selected').getAttribute('data-symbol2'), document.getElementById('labelText').value]), ['flammable', 'toxic', 'Ethanol'], 'Edit loads both symbols into the form');
    await pick2(page, 'biohazard');
    await page.click('#addLabelBtn');
    eq((await storedQueue(page))[0], { id: id0, symbol: 'flammable', text: 'Ethanol', qty: 2, symbol2: 'biohazard' }, 'Save changes changes the second symbol in place');
    await page.click(`#queueWrap [data-edit="${id0}"]`);
    await pick2(page, '');
    await page.click('#addLabelBtn');
    eq((await storedQueue(page))[0], { id: id0, symbol: 'flammable', text: 'Ethanol', qty: 2 }, 'and "No second symbol" takes the key away');
    eq(await page.locator('#queueWrap .queue-row').first().locator('svg').count(), 1, 'the row is one symbol again');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `the edit form: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- 3. what a duplicate is -------------------------------------------------
if (want(3)) {
  const page = await open(browser, null, 'light');
  try {
    await pick1(page, 'flammable'); await pick2(page, 'toxic');
    await add(page, 'Ethanol', 3);
    eq(await dupNote(page), '', 'the first label draws no note');
    await add(page, 'Ethanol');
    ok(/“Ethanol” is already on the sheet with the same two symbols in this order \(3 copies\)\. It was added again/.test(await dupNote(page)), 'the same text and the same two symbols in the same order is named, and added again');
    eq((await storedQueue(page)).length, 2, 'it was added, as an old duplicate always was');
    await add(page, '  ETHANOL ');
    ok(/already on the sheet/.test(await dupNote(page)), 'case and outer spaces do not make it a different label');
    await pick1(page, 'toxic'); await pick2(page, 'flammable');
    await add(page, 'Ethanol');
    eq(await dupNote(page), '', 'toxic then flammable is not flammable then toxic: no note');
    await pick2(page, '');
    await add(page, 'Ethanol');
    eq(await dupNote(page), '', 'one symbol is not two: no note');
    await add(page, 'Ethanol');
    ok(/with the same symbol \(1 copy\)\./.test(await dupNote(page)), 'two one-symbol labels alike are a duplicate, in the old words');
    await pick1(page, 'flammable'); await pick2(page, 'toxic');
    await add(page, 'Ethanol B');
    eq(await dupNote(page), '', 'a different text is not a duplicate, and the next Add clears the note');
    // saving a label without changing it is not a duplicate of itself
    const q = await storedQueue(page);
    await page.click(`#queueWrap [data-edit="${q[q.length - 1].id}"]`);
    await page.click('#addLabelBtn');
    eq(await dupNote(page), '', 'saving a label unchanged does not call it a duplicate of itself');
    // editing a label until it matches another says so and keeps both
    await page.click(`#queueWrap [data-edit="${q[q.length - 1].id}"]`);
    await page.fill('#labelText', 'ethanol');
    await page.click('#addLabelBtn');
    ok(/already on the sheet.*Both rows are kept\./.test(await dupNote(page)), 'editing one onto another names it and keeps both rows');
    eq((await storedQueue(page)).length, q.length, 'and adds nothing');
    // the Duplicate button copies both symbols and says nothing
    const first = (await storedQueue(page))[0];
    await page.click(`#queueWrap [data-dup="${first.id}"]`);
    const after = await storedQueue(page);
    eq([after.length, after[after.length - 1].symbol, after[after.length - 1].symbol2, after[after.length - 1].text, after[after.length - 1].qty, after[after.length - 1].id !== first.id], [q.length + 1, 'flammable', 'toxic', 'Ethanol', 3, true], 'Duplicate copies the label with both symbols and a new id');
    eq(await dupNote(page), '', 'and says nothing: it is what was asked for');
    // Duplicate of a one-symbol label has no symbol2 key
    const one = after.find(i => !i.symbol2);
    await page.click(`#queueWrap [data-dup="${one.id}"]`);
    const last = (await storedQueue(page)).pop();
    eq(Object.keys(last).sort(), ['id', 'qty', 'symbol', 'text'], 'duplicating a one-symbol label copies no symbol2');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `duplicates: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- 4. the printed card ----------------------------------------------------
const PAGE_W = 7.5 * IN;
const measure = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const rect = x => x.getBoundingClientRect();
  return [...area.querySelectorAll('.label-card')].map(c => {
    const cr = rect(c);
    const svgs = [...c.querySelectorAll('svg')].map(rect);
    const t = rect(c.querySelector('.ltext'));
    const bw = parseFloat(getComputedStyle(c).borderLeftWidth);
    const inside = r => r.left >= cr.left + bw - 0.5 && r.right <= cr.right - bw + 0.5 && r.top >= cr.top + bw - 0.5 && r.bottom <= cr.bottom - bw + 0.5;
    return {
      text: c.querySelector('.ltext').textContent, w: cr.width, h: cr.height, n: svgs.length,
      sizes: svgs.map(r => [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]),
      insideAll: svgs.every(inside) && inside(t),
      gap: svgs.length === 2 ? Math.round((svgs[1].left - svgs[0].right) * 10) / 10 : null,
      overlap: svgs.length === 2 && !(svgs[0].right <= svgs[1].left + 0.1 || svgs[1].right <= svgs[0].left + 0.1 || svgs[0].bottom <= svgs[1].top + 0.1 || svgs[1].bottom <= svgs[0].top + 0.1),
      symsOverText: svgs.some(r => r.bottom > t.top + 0.5 && r.top < t.bottom - 0.5 && r.right > t.left + 0.5 && r.left < t.right - 0.5),
      colors: [...c.querySelectorAll('svg')].map(s => s.getAttribute('style')),
      clipped: [...c.querySelectorAll('*')].filter(x => { const cs = getComputedStyle(x); return cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1; }).length,
    };
  });
});

// For each size: a label with two symbols beside its one-symbol twin (same text), short and long.
if (want(4)) for (const size of ['small', 'medium', 'large']) {
  const S = SIZE[size];
  for (const theme of ['light', 'dark']) {
    const what = `${theme}, ${size}`;
    const queue = [
      { id: 'a', symbol: 'flammable', text: 'Ethanol', qty: 1, symbol2: 'toxic' },
      { id: 'b', symbol: 'flammable', text: 'Ethanol', qty: 1 },
      { id: 'c', symbol: 'corrosive', text: LONG, qty: 1, symbol2: 'eyeprotect' },
      { id: 'd', symbol: 'corrosive', text: LONG, qty: 1 },
      { id: 'e', symbol: 'electrical', text: 'Power supplies', qty: 1, symbol2: 'hot' },
      { id: 'f', symbol: 'biohazard', text: 'Used agar plates', qty: 1, symbol2: 'sharp' },
    ];
    const page = await open(browser, { queue, labelSize: size }, theme, { width: PAGE_W, height: 900 });
    try {
      await page.click('#printBtn');
      await settle(page, 150);
      const built = await page.evaluate(() => [...document.querySelectorAll('#printArea .label-card')].map(c => c.innerHTML.length));
      eq(built.length, 6, `${what}: six cards`);
      const cards0 = await page.evaluate(() => [...document.querySelectorAll('#printArea .label-card')].map(c => [...c.children].map(k => k.localName + (typeof k.className === 'string' && k.className ? '.' + k.className : '')).join(',')));
      eq(cards0, ['div.lsyms,div.ltext', 'svg,div.ltext', 'div.lsyms,div.ltext', 'svg,div.ltext', 'div.lsyms,div.ltext', 'div.lsyms,div.ltext'], `${what}: a two-symbol card is a row of symbols and the text; a one-symbol card is as it was`);
      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await measure(page);
      const orderOk = await page.evaluate(() => [...document.querySelectorAll('#printArea .lsyms')].map(r => [...r.children].map(s => s.getAttribute('style')).join('|')));
      eq(orderOk[0], `color:var(--${COLOR.flammable})|color:var(--${COLOR.toxic})`, `${what}: the first symbol is on the left, the second on the right, each in its own colour`);
      eq(orderOk[1], `color:var(--${COLOR.corrosive})|color:var(--${COLOR.eyeprotect})`, `${what}: and again on the long one`);
      ok(m.every(c => c.sizes.every(([w, h]) => w === S.svg && h === S.svg)), `${what}: every symbol, one or two on a label, is ${S.svg} px square (${JSON.stringify([...new Set(m.flatMap(c => c.sizes.map(s => s.join('x'))))])})`);
      eq(m.map(c => c.n), [2, 1, 2, 1, 2, 2], `${what}: two symbols on the labels that have two`);
      ok(m.every(c => c.insideAll), `${what}: every symbol and the text are inside the border`);
      ok(m.every(c => !c.overlap), `${what}: the two symbols do not overlap`);
      ok(m.filter(c => c.n === 2).every(c => c.gap >= 8), `${what}: with a gap of 0.1 in between (${JSON.stringify(m.filter(c => c.n === 2).map(c => c.gap))})`);
      ok(m.every(c => !c.symsOverText), `${what}: neither symbol is over the text`);
      eq(m.filter(c => c.clipped).length, 0, `${what}: nothing is clipped`);
      ok(m.every(c => Math.abs(c.w - m[0].w) <= 0.6), `${what}: every label is the same width, ${(m[0].w / IN).toFixed(2)} in`);
      ok(m.every(c => c.h >= S.h - 0.6), `${what}: no label is shorter than ${S.h / IN} in`);
      await page.emulateMedia({ media: null });
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);

      // the same sheet with every second symbol taken off: each label is the size it was beside its twin
      const twin = await open(browser, { queue: queue.map(({ symbol2, ...rest }) => rest), labelSize: size }, theme, { width: PAGE_W, height: 900 });
      try {
        await twin.click('#printBtn');
        await settle(twin, 150);
        await twin.emulateMedia({ media: 'print' });
        await settle(twin, 150);
        const t = await measure(twin);
        eq(m.map(c => Math.round(c.h * 10)), t.map(c => Math.round(c.h * 10)), `${what}: a label is as tall with a second symbol as without it, long label included (${m.map(c => Math.round(c.h)).join(', ')})`);
        eq(m.map(c => Math.round(c.w * 10)), t.map(c => Math.round(c.w * 10)), `${what}: and as wide`);
      } finally { await twin.context().close(); }
      // short two-symbol labels alone are exactly the size of the size
      const shorts = await open(browser, { queue: ['flammable', 'corrosive', 'electrical', 'sharp'].map((k, i) => ({ id: 's' + i, symbol: k, text: 'Rack ' + i, qty: 1, symbol2: 'hot' })), labelSize: size }, theme, { width: PAGE_W, height: 900 });
      try {
        await shorts.click('#printBtn');
        await settle(shorts, 150);
        await shorts.emulateMedia({ media: 'print' });
        await settle(shorts, 150);
        const sm = await measure(shorts);
        ok(sm.every(c => Math.abs(c.h - S.h) <= 0.6), `${what}: short two-symbol labels are exactly ${S.h / IN} in tall (${sm.map(c => Math.round(c.h)).join(', ')})`);
      } finally { await shorts.context().close(); }
    } catch (e) { ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`); }
    finally { await page.context().close(); }
  }
}

// ---- 5. pages: the PDF of a set with second symbols is the PDF of the set without them
if (want(5)) {
  for (const theme of ['light', 'dark']) {
    for (const [size, n] of [['small', 24], ['small', 25], ['small', 61], ['medium', 12], ['medium', 13], ['medium', 61], ['large', 6], ['large', 7], ['large', 30]]) {
      const what = `${theme}, ${n} ${size}`;
      const plain = oldQueue(n, true);
      const two = withSeconds(plain);
      const counts = [];
      for (const q of [plain, two]) {
        const page = await open(browser, { queue: q, labelSize: size }, theme);
        try {
          counts.push(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })));
        } finally { await page.context().close(); }
      }
      ok(two.some(i => i.symbol2), `${what}: the sheet has second symbols`);
      eq(counts[1], counts[0], `${what}: Chromium prints ${counts[0]} page${counts[0] === 1 ? '' : 's'} with second symbols, as without`);
    }
  }
}

// ---- 6. a paper too narrow for two symbols across a label: the row wraps, nothing clips
if (want(6)) {
  const queue = [
    { id: 'a', symbol: 'flammable', text: 'Ethanol', qty: 4, symbol2: 'toxic' },
    { id: 'b', symbol: 'corrosive', text: LONG, qty: 1, symbol2: 'eyeprotect' },
  ];
  const page = await open(browser, { queue, labelSize: 'small' }, 'light', { width: Math.round(3.9 * IN), height: 900 });
  try {
    await page.evaluate(() => PrintKit.setPage({ paper: 'a5', orientation: 'portrait', margin: '0.5in' }));
    await page.click('#printBtn');
    await settle(page, 150);
    await page.emulateMedia({ media: 'print' });
    await settle(page, 150);
    // the page is narrower than the A5 sheet, so measure at the sheet's own width
    await page.setViewportSize({ width: Math.round(148 * IN / 25.4 - IN), height: 900 });
    await settle(page, 200);
    const m = await measure(page);
    ok(m.every(c => c.w < 2 * SIZE.small.svg + 0.1 * IN + 0.3 * IN), 'on A5 a small label is too narrow to hold two symbols side by side (' + Math.round(m[0].w) + ' px)');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#printArea .lsyms')].map(r => new Set([...r.children].map(s => Math.round(s.getBoundingClientRect().top))).size));
    ok(rows.every(n => n === 2), 'so the row wraps to two lines: ' + JSON.stringify(rows));
    ok(m.every(c => c.insideAll), 'every symbol and the text are still inside the border');
    ok(m.every(c => !c.overlap && !c.symsOverText), 'and nothing is over anything else');
    ok(m.every(c => c.sizes.every(([w, h]) => w === 44 && h === 44)), 'and no symbol is squeezed');
    eq(m.filter(c => c.clipped).length, 0, 'and nothing is clipped');
    ok(m.every(c => c.h > SIZE.small.h + 8), 'the label grew past its minimum height (' + Math.round(m[0].h) + ' px against ' + SIZE.small.h + ')');
    await page.emulateMedia({ media: null });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    const box = (pdf.toString('latin1').match(/\/MediaBox\s*\[([^\]]*)\]/) || [])[1] || '';
    ok(/^\s*0\s+0\s+(419|420)(\.\d+)?\s+(594|595)(\.\d+)?\s*$/.test(box), `the PDF is A5 (MediaBox ${JSON.stringify(box)})`);
  } catch (e) { ok(false, `a narrow paper: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- 7. the preview shows the two-symbol cards, with the PDF's page count ---------
if (want(7)) for (const [size, n] of [['small', 25], ['medium', 13], ['medium', 61], ['large', 7]]) {
  const what = `${n} ${size}`;
  const page = await open(browser, { queue: withSeconds(oldQueue(n, true)), labelSize: size }, 'light');
  try {
    await page.click('#previewBtn'); // first: printing builds the sheet itself, which would hide a preview that did not
    await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
    await settle(page, 100);
    const p = await page.evaluate(() => {
      const dialog = document.querySelector('dialog.pk-preview');
      const d = dialog.querySelector('iframe').contentDocument;
      return { pages: Number(dialog.getAttribute('data-pk-pages')), status: dialog.querySelector('.pk-preview-status').textContent, cards: d.querySelectorAll('.label-card').length, rows: d.querySelectorAll('.label-card .lsyms').length, pairs: [...d.querySelectorAll('.lsyms')].every(r => r.querySelectorAll('svg').length === 2) };
    });
    eq(p.status, `Page 1 of ${p.pages}`, `${what}: it says so`);
    const sheet = await page.evaluate(() => document.querySelectorAll('#printArea .label-card').length + '|' + document.querySelectorAll('#printArea .lsyms').length);
    eq([p.cards, p.rows], sheet.split('|').map(Number), `${what}: it holds every card of the sheet, the two-symbol ones too`);
    ok(p.rows > 0 && p.pairs, `${what}: and each of those cards has its two symbols`);
    eq(await page.evaluate(() => window.__printCalls), 0, `${what}: the preview did not print`);
    await page.keyboard.press('Escape');
    const pdfPages = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
    eq(p.pages, pdfPages, `${what}: the preview has the PDF's ${pdfPages} pages`);
    eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `${what} preview: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- 8. share, and a second symbol this build cannot honour --------------------
if (want(8)) {
  const state = {
    labelSize: 'small',
    queue: [
      { id: 'a', symbol: 'flammable', text: 'Ethanol', qty: 2, symbol2: 'toxic' },
      { id: 'b', symbol: 'corrosive', text: 'Acid', qty: 1, symbol2: 'no-such-symbol"><script>window.__pwned=1</script>' },
      { id: 'c', symbol: 'corrosive', text: 'Base', qty: 1, symbol2: 'none' },
      { id: 'd', symbol: 'corrosive', text: 'Same twice', qty: 1, symbol2: 'corrosive' },
      { id: 'e', symbol: 'none', text: 'Bin', qty: 1, symbol2: 'hot' },
      { id: 'f', symbol: 'sharp', text: 'Scalpels', qty: 1 },
    ],
  };
  // the sender: the payload the share sheet copies carries symbol2
  const sender = await open(browser, state, 'light');
  try {
    await sender.click('#shareBtn');
    await settle(sender, 250);
    const link = await sender.evaluate(() => {
      let captured = null;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
      document.querySelector('.share-sheet button[data-share="copy"]').click();
      return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
    });
    ok(!!link && /labels=/.test(link), 'Copy link makes a link');
    const payload = await sender.evaluate(l => StateLink.decodeState(new URL(l).searchParams.get('labels')), link);
    eq(payload.queue[0].symbol2, 'toxic', 'the link carries the second symbol by key');
    eq(payload.queue[5].symbol2, undefined, 'and none for a label that has none');
    // the receiver: an empty device takes the sheet with no question
    const recv = await prepPage(browser, BASE, { width: 1100, height: 900 });
    await recv.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
    await recv.goto(link, { waitUntil: 'load' });
    await settle(recv, 400);
    const q = await storedQueue(recv);
    eq(q.map(i => i.symbol2 || ''), ['toxic', '', '', '', '', ''], 'the arrival keeps the one second symbol it can honour, and drops the unknown key, the box, the repeat and the one on an equipment label');
    eq(await recv.evaluate(() => document.querySelectorAll('#queueWrap .queue-row .qsyms').length), 1, 'the queue shows one pair');
    await recv.click('#printBtn');
    await settle(recv, 150);
    eq(await recv.evaluate(() => [...document.querySelectorAll('#printArea .label-card')].map(c => c.querySelectorAll('svg').length)), [2, 2, 1, 1, 1, 1, 1], 'two copies of the pair label, then one symbol each');
    eq(await recv.evaluate(() => !!window.__pwned), false, 'nothing in a symbol key ran');
    eq(recv.__errs.length, 0, `no page/console errors: ${JSON.stringify(recv.__errs.slice(0, 3))}`);
    await recv.context().close();
  } catch (e) { ok(false, `share: ${String(e.message || e).split('\n')[0]}`); }
  finally { await sender.context().close(); }

  // hand-edited storage with the same fields prints the same way, and is not rewritten
  const raw = JSON.stringify({ labelSize: 'medium', queue: state.queue });
  const page = await open(browser, null, 'light', { width: 1100, height: 900 }, raw);
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .label-card')].map(c => c.querySelectorAll('svg').length)), [2, 2, 1, 1, 1, 1, 1], 'a saved set with unusable second symbols prints the first symbol only on those');
    eq(await page.evaluate(() => [...document.querySelectorAll('#queueWrap .qtext em')].map(e => e.textContent)), ['Flammable + Toxic / Poison', 'Corrosive', 'Corrosive', 'Corrosive', 'Equipment (no symbol)', 'Sharp Objects'], 'and the queue names them the same way');
    eq(await stored(page), raw, 'without rewriting what was saved');
    const scan = await a11yScan(page, { impact: 'serious' }).catch(e => ({ error: String(e) }));
    eq(Array.isArray(scan) ? scan.length : scan, 0, 'axe finds nothing serious or critical with a pair in the queue and the second picker on screen');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `hand-edited storage: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
