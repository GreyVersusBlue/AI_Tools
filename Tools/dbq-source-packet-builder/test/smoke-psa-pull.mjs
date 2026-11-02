// smoke-psa-pull.mjs — pulling a source out of 028's library into a 056 packet.
//
//   node Tools/dbq-source-packet-builder/test/smoke-psa-pull.mjs
//
// The pairing shipped in one direction (a text source becomes a worksheet in
// 028). This is the other: the source library list inside 056 also lists what
// a teacher saved in Primary Source Analysis, and "Add to packet" copies one
// in. Held down: the list and its search, a text source arriving with its
// citation, a picture arriving with its bytes copied into this tool's own
// namespace (the original left where it was), 028's key never written, a
// picture that is not on this device, an inline picture, names escaped, the
// first blank source replaced, the packet surviving a reload, an empty library,
// 360 px and axe. Every title is invented. Exits 1 on any failure.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8646;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/056-dbq-source-packet-builder.html';
const KEY = 'gvb-primary-source:library';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const INLINE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const LIB = [
  { id: 'e1', title: 'Letter <b>from</b> a farm', type: 'text', description: 'about the harvest', text: 'Dear sister, the wheat is in.', imageDataUrl: '', citationAuthor: 'M. Fielding', citationDate: '1887', citationOrigin: 'County archive', tags: ['unit 3', 'farm life'], savedAt: '2026-01-02' },
  { id: 'e2', title: 'Street photograph', type: 'photo', description: 'A market street', text: '', imageDataUrl: 'idb:hpsa0001', citationAuthor: '', citationDate: '1911', citationOrigin: 'City <u>collection</u>', tags: ['unit 4'], savedAt: '2026-01-03' },
  { id: 'e3', title: 'Lost picture', type: 'photo', description: '', text: '', imageDataUrl: 'idb:hnowhere', citationAuthor: '', citationDate: '', citationOrigin: 'Elsewhere', tags: [], savedAt: '2026-01-04' },
  { id: 'e4', title: 'Inline map', type: 'map', description: '', text: '', imageDataUrl: INLINE, citationAuthor: '', citationDate: '1790', citationOrigin: '', tags: ['unit 4'], savedAt: '2026-01-05' },
  null, 'junk', { id: 'e5' },
];

const server = await serve(PORT);
const browser = await launch();
console.log('DBQ / Source Packet Builder — pull a source from Primary Source Analysis');

async function open(width = 1300, lib = LIB) {
  const page = await prepPage(browser, BASE, { width, height: 1100 });
  page.__errs = [];
  page.on('pageerror', e => page.__errs.push(String(e)));
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Pull test' : undefined));
  if (lib) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, lib]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
/** a real PNG in 028's namespace, as 028 would have stored it */
const seedPsaImage = page => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 40; c.height = 30;
  const g = c.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, 40, 30);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await MediaDB.store({ ns: 'psa' }).put('hpsa0001', blob, { tool: 'primary-source-analysis-generator' });
  return blob.size;
});
const openPanel = async page => { await page.click('#toggleBankBtn'); await settle(page, 150); };
const rows = page => page.$$eval('#psaWrap .bank-row', rs => rs.map(r => ({ title: r.querySelector('.bank-title').textContent, meta: r.querySelector('.bank-meta').textContent })));
const sources = page => page.evaluate(() => {
  const n = localStorage.getItem('dbq:current');
  const d = JSON.parse(localStorage.getItem('dbq:data:' + n) || 'null');
  return d ? d.sources : null;
});
const note = page => page.$eval('#bankNote', n => n.textContent);
/** the tool boots on its worked example; a new packet is the one with a single blank source */
const freshPacket = async page => { await page.click('#newPacketBtn'); await settle(page, 300); };
const add = async (page, id) => { await page.click(`[data-psa-add="${id}"]`); await settle(page, 500); };

{
  const page = await open();
  const size = await seedPsaImage(page);
  const libBefore = await page.evaluate(k => localStorage.getItem(k), KEY);
  await freshPacket(page);
  await openPanel(page);

  eq((await rows(page)).map(r => r.title), ['Letter <b>from</b> a farm', 'Street photograph', 'Lost picture', 'Inline map'], 'the four readable entries are listed; junk is not');
  eq((await rows(page))[0].meta, 'Text · M. Fielding, County archive, 1887 · unit 3, farm life', 'a row shows its kind, citation and tags');
  eq((await rows(page))[1].meta, 'Image · City <u>collection</u>, 1911 · unit 4', 'a picture says Image, its citation shown as typed');
  eq(await page.$$eval('#psaWrap b, #psaWrap u', b => b.length), 0, 'markup in a title or a citation is text, not markup');

  await page.fill('#psaFilter', 'unit 4');
  eq((await rows(page)).map(r => r.title), ['Street photograph', 'Inline map'], 'search finds a tag');
  await page.fill('#psaFilter', 'zzz');
  ok(/No source there matches/.test(await page.$eval('#psaWrap', w => w.textContent)), 'and says when nothing matches');
  await page.fill('#psaFilter', '');

  // a text source
  eq((await sources(page)).length, 1, 'a new packet starts with one blank source');
  await add(page, 'e1');
  let src = await sources(page);
  eq(src.length, 1, 'the blank first source is replaced, not left above');
  eq([src[0].title, src[0].type, src[0].text, src[0].citation, src[0].bankId, src[0].image], ['Letter <b>from</b> a farm', 'text', 'Dear sister, the wheat is in.', 'M. Fielding, County archive, 1887', null, null], 'a text entry arrives whole, with its citation');
  eq(src[0].questions.length, 1, 'with an empty question to fill');
  ok(/as Source A/.test(await note(page)), 'the note says where it landed: ' + (await note(page)));
  eq(await page.$$eval('#sourcesWrap [data-field="title"]', e => e.length), 1, 'the editor shows it');

  // a picture
  await add(page, 'e2');
  src = await sources(page);
  eq(src.length, 2, 'the next one is added after');
  eq(src[1].type, 'image', 'a picture is an image source');
  ok(/^idb:h[0-9a-f]{32}$/.test(src[1].image || ''), 'its image is a reference into this tool’s own store: ' + src[1].image);
  const copied = await page.evaluate(async ref => { const b = await MediaDB.store({ ns: 'dbq' }).getBlob(ref.slice(4)); return b ? b.size : 0; }, src[1].image);
  eq(copied, size, 'the same bytes are in the dbq namespace');
  const stillThere = await page.evaluate(async () => { const b = await MediaDB.store({ ns: 'psa' }).getBlob('hpsa0001'); return b ? b.size : 0; });
  eq(stillThere, size, 'and the original is still in 028’s');
  ok(src[1].imgW === 1 || src[1].imgW === 40, 'its size was read so the crop tool works (' + src[1].imgW + ')');
  ok(/and its picture/.test(await note(page)), 'the note mentions the picture');
  eq(await page.$$eval('#sourcesWrap img', i => i.length) > 0, true, 'the editor shows the picture');

  // a picture that is not on this device
  await add(page, 'e3');
  src = await sources(page);
  eq([src[2].type, src[2].image], ['text', null], 'a picture that is gone arrives as an empty text source');
  ok(/not on this device/.test(await note(page)), 'and the note says why: ' + (await note(page)));

  // an inline picture
  await add(page, 'e4');
  src = await sources(page);
  eq(src[3].type, 'image', 'an inline picture is an image source');
  ok(!!src[3].image, 'and keeps its image');

  // the same entry twice is two independent copies
  await add(page, 'e1');
  src = await sources(page);
  eq(src.length, 5, 'adding the same entry again makes another copy');
  ok(src[0].id !== src[4].id, 'with its own id');
  ok(src[0].questions[0].id !== src[4].questions[0].id, 'and its own question ids');

  // 028's key is untouched
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), libBefore, '028’s library is byte for byte what it was');

  // printing
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  await settle(page, 300);
  const pr = await page.evaluate(() => ({ imgs: document.querySelectorAll('#printArea .crop-frame img').length, text: document.getElementById('printArea').textContent }));
  eq(pr.imgs, 2, 'both pictures print');
  ok(pr.text.includes('Dear sister, the wheat is in.') && pr.text.includes('M. Fielding, County archive, 1887'), 'the text and its citation print');
  eq(await page.$$eval('#printArea b', b => b.length), 0, '...a title with markup in it never becomes markup on paper');

  // survives a reload
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 500);
  eq((await sources(page)).length, 5, 'the packet is still five sources after a reload');
  eq(await page.$$eval('#sourcesWrap img', i => i.length) >= 2, true, 'and the pictures still show');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* nothing in 028's library, or a library that is not a list */
{
  const page = await open(1300, null);
  await openPanel(page);
  ok(/Nothing saved there yet/.test(await page.$eval('#psaWrap', w => w.textContent)), 'with no library there, the list says so');
  await page.context().close();
  const page2 = await open(1300, { not: 'a list' });
  await openPanel(page2);
  ok(/Nothing saved there yet/.test(await page2.$eval('#psaWrap', w => w.textContent)), 'a library that is not a list is treated as empty');
  eq(page2.__errs, [], '...with no page error');
  await page2.context().close();
}

/* 360 px and axe */
{
  const page = await open(360);
  await openPanel(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(over <= 1, 'no sideways scroll at 360 px (' + over + ')');
  const small = await page.$$eval('#psaWrap button', bs => bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
  ok(small.length && Math.min(...small) >= 24, 'the Add buttons are at least 24 px (' + Math.round(Math.min(...small)) + ')');
  const v = await a11yScan(page);
  eq(v.map(x => x.id), [], 'no serious axe violations with the list open');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
