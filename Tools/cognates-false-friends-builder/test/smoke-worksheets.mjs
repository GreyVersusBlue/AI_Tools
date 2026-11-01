// smoke-worksheets.mjs — 052's practice worksheets (cffb-worksheets.js and the page), rank 85.
//
//   node Tools/cognates-false-friends-builder/test/smoke-worksheets.mjs        (port 8637)
//
// The arithmetic is worksheets-logic.test.mjs's (pure Node). This is the page: the three
// worksheets and their keys as they land in #printArea, that the key is the worksheet's own
// model, the refusal on a list too short, that the reference sheet still prints as before and
// the saved list is untouched by printing, 360 px, axe, and that nothing leaves the site.
// Nothing here has been printed on paper. Every word is invented.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8637;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/052-cognates-false-friends-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Cognates & False Friends — practice worksheets');

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
page.on('dialog', (d) => d.accept());
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

// The page opens on the Spanish starter: 6 cognates, 5 false friends.
const area = () => page.evaluate(() => document.getElementById('printArea').innerText);
const html = () => page.evaluate(() => document.getElementById('printArea').innerHTML);
const prints = () => page.evaluate(() => window.__prints);
const stored = () => page.evaluate(() => localStorage.getItem('cffb_list_v1'));
async function run(kind, variant, key) {
  await page.selectOption('#wsKind', kind);
  await page.selectOption('#wsVariant', variant);
  await page.click(key ? '#wsKeyBtn' : '#wsPrintBtn');
  return area();
}

// ---- matching
let w = await run('match', 'A', false);
eq(await prints(), 1, 'Print worksheet calls print once');
ok(/Match the Spanish words/.test(w) && /Variant A/.test(w) && /Name:/.test(w), 'matching: title, variant and a name line');
ok(!/answer key/i.test(w), 'the worksheet is not the key');
const wordsOn = await page.evaluate(() => [...document.querySelector('#printArea .ws-group').querySelectorAll('.ws-cols > ol li')].map(li => li.textContent.replace(/^_+\s*/, '')));
const meaningsOn = await page.evaluate(() => [...document.querySelectorAll('#printArea .ws-cols > ul li')].map(li => li.textContent));
eq(wordsOn.length, 10, 'matching: eleven entries make a group of ten ...');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .ws-group').length), 2, '... and a group of one');
ok(['actor', 'sopa', 'embarazada', 'música'].every(x => w.includes(x)), 'words from both lists are on the sheet');
ok(/^A\.\s/.test(meaningsOn[0]), 'meanings are lettered from A');
ok(!/pregnant\."|Actually means/.test(w), 'a false friend shows its meaning, not the teacher’s note');
const wKey = await run('match', 'A', true);
ok(/answer key/i.test(wKey) && !/Name:/.test(wKey), 'matching key: titled, no name line');
const pairs = await page.evaluate(() => [...document.querySelectorAll('#printArea .ws-keylist li')].map(li => li.textContent));
eq(pairs.length, 11, 'the key lists every word');
const sopa = pairs.find(p => p.startsWith('sopa'));
ok(/→ [A-J]\. soup$/.test(sopa || ''), 'sopa → a letter and “soup”: ' + sopa);
// the letter in the key is the letter the worksheet prints beside that meaning
await run('match', 'A', false);
const letterOfSoup = await page.evaluate(() => { const li = [...document.querySelectorAll('#printArea .ws-cols > ul li')].find(x => /\bsoup$/.test(x.textContent)); return li ? li.textContent[0] : ''; });
eq(letterOfSoup, sopa.match(/→ ([A-J])\./)[1], 'key letter equals the worksheet letter');
const again = await area();
eq(again, w, 'printing Variant A again gives the same sheet');
const wB = await run('match', 'B', false);
ok(wB !== w && /Variant B/.test(wB), 'Variant B is a different order');

// ---- fill in the blank
w = await run('blank', 'A', false);
ok(/Fill in the blank/.test(w) && /Use each word from the box once/.test(w), 'blank: title and directions');
const bank = await page.evaluate(() => document.querySelector('#printArea .ws-bank').textContent.split(/\s+·\s+/).map(s => s.trim()));
eq(bank.length, 11, 'the word bank holds every word');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .ws-sentences li').length), 11, 'a sentence for each');
eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .ws-sentences li')].filter(li => li.textContent.split('______').length === 2).length), 11, 'exactly one blank in each sentence');
ok(/looks like “exit” but really means “success”/.test(w), 'a false friend’s sentence names the trap');
const k = await run('blank', 'A', true);
eq(await page.evaluate(() => document.querySelectorAll('#printArea .ws-sentences li').length), 11, 'blank key: a line for each');
ok(!/______/.test(await page.evaluate(() => document.querySelector('#printArea .ws-sentences').textContent)) && /word éxito looks like “exit”/.test(k), 'blank key has the answers filled in');
ok(/answer key/i.test(k) && !/Use each word/.test(k), 'blank key has no word bank');

// ---- trap or true
w = await run('trap', 'C', false);
ok(/Trap or true cognate\?/.test(w) && /Variant C/.test(w), 'trap: title and variant');
eq(await page.evaluate(() => document.querySelectorAll('#printArea table.ws-trap tbody tr').length), 11, 'a row for each');
eq(await page.evaluate(() => document.querySelectorAll('#printArea td.ws-tick').length), 22, 'two tick boxes a row');
const tk = await run('trap', 'C', true);
eq((tk.match(/False friend — really means/g) || []).length, 5, 'the key marks the five traps');
eq((tk.match(/True cognate/g) || []).length, 6, 'and the six true cognates');
ok(/éxito[^\n]*really means “success”|really means “success”/.test(tk), 'a trap’s key says what it really means');

// ---- print area is built, not typed: no script, handler or raw markup got in
ok(!/<script|onerror|javascript:/i.test(await html()), 'no script or handler in the sheet');

// ---- a word with markup in it stays text
await page.fill('#langName', 'Zorb<i>ish</i>');
await page.dispatchEvent('#langName', 'input');
w = await run('match', 'A', false);
ok(w.includes('Zorb<i>ish</i>') && !(await page.evaluate(() => document.querySelector('#printArea h1 ~ p i, #printArea p.print-lang i'))), 'markup in the language name is shown as text');
await page.fill('#langName', 'Spanish');
await page.dispatchEvent('#langName', 'input');

// ---- the reference sheet is as it was
const before = await prints();
await page.click('#printBtn');
eq(await prints(), before + 1, 'Print reference sheet still prints');
ok(/Cognates & False Friends/.test(await area()) && /Looks Like/.test(await area()), 'and still builds the two tables');

// ---- too few
await page.selectOption('#templateSelect', 'blank');
await page.click('#loadTemplateBtn');
await settle(page, 150);
const n0 = await prints();
await run('match', 'A', false);
eq(await prints(), n0, 'an empty list prints no worksheet');
ok(/at least 2 entries/.test(await page.textContent('#wsNote')) && /have 0/.test(await page.textContent('#wsNote')), 'and says why: ' + await page.textContent('#wsNote'));
await page.selectOption('#wsKind', 'trap');
await page.click('#wsPrintBtn');
ok(/at least 1 entry/.test(await page.textContent('#wsNote')), 'trap names its own minimum');

// ---- printing wrote nothing: same keys, same list (after the template load, which is the page's own)
const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort().join('|'));
eq(keysAfter, 'cffb_list_v1', 'the only storage key is the list’s own');
await page.click('#addCognateBtn');
await page.evaluate(() => { const i = document.querySelectorAll('#cognatesWrap input'); i[0].value = 'gato'; i[0].dispatchEvent(new Event('input', { bubbles: true })); i[1].value = 'cat'; i[1].dispatchEvent(new Event('input', { bubbles: true })); });
const saved = await stored();
await page.selectOption('#wsKind', 'trap');
await page.click('#wsPrintBtn');
eq(await stored(), saved, 'printing a worksheet leaves the saved list as it was');
ok(/gato/.test(await area()) && !/Form/.test(await area()), 'a one-entry trap sheet prints');

// ---- 360 px and axe
await page.setViewportSize({ width: 360, height: 800 });
await settle(page, 200);
eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'the worksheet card fits at 360 px');
const cardBox = await page.evaluate(() => { const r = document.getElementById('worksheetCard').getBoundingClientRect(); return [r.left, r.right]; });
ok(cardBox[0] >= 0 && cardBox[1] <= 361, 'the card is inside the screen');
await page.setViewportSize({ width: 1200, height: 900 });
const viol = await a11yScan(page);
eq(viol.length, 0, 'axe: no serious or critical violation: ' + JSON.stringify(viol.map(v => v.id)));
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
