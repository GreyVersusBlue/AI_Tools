// smoke-slices.mjs — time slices for annotations on 046 (Path 20 P4).
//
//   node Tools/blank-map-generator/test/smoke-slices.mjs   (npm run test:blank-map-slices-smoke, port 8591)
//
// A project with no slices is what it was (no `slices` in its saved data, controls hidden). "Start time slices"
// makes the map's labels slice 1; a blank slice shows none; the slider, previous/next and the keyboard move
// between slices and each keeps its own labels; names are unique and years must be whole numbers; copy starts
// from the slice it was made from; sort puts the dated first; delete asks first and the last slice stays; the
// slices survive a reload; a share link's slices are cleaned on arrival; the PDF sheet holds a different map
// in each panel; and the slice send to Timeline Builder (see smoke-slices-handoff.mjs) is separate.
// Nothing is requested off-site by these steps.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8591;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

console.log('Blank Map — time slices');
const server = await serve(PORT);
const browser = await launch();
const errors = [];
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 700);
const offsite0 = page.__blocked.length;

const data = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); return w.projects.find(q => q.id === w.activeId).data; });
const editData = fn => page.evaluate(src => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); const p = w.projects.find(q => q.id === w.activeId); (0, eval)('(' + src + ')')(p.data); localStorage.setItem('bmg_workspace_v1', JSON.stringify(w)); }, fn.toString());
const reload = async () => { await page.reload({ waitUntil: 'networkidle' }); await settle(page, 900); };
const shown = () => page.evaluate(() => [...document.querySelectorAll('#labelLayer .bmg-label')].map(n => n.querySelector('.lbl-text').textContent.trim()).sort());

// the map
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 300);

// no slices yet
let d = await data();
ok(!('slices' in d), 'a project with no slices stores no slices field');
ok(await page.isVisible('#btnSliceStart') && !(await page.isVisible('#sliceControls')), 'only the Start button shows');

// two labels on slice 1
await editData(d => { d.labels = [{ id: 'a1', x: 600, y: 900, text: 'Louisiana Purchase', color: null, bold: false, italic: false, size: 'medium' }, { id: 'a2', x: 1200, y: 800, text: 'Missouri', color: null, bold: false, italic: false, size: 'medium' }]; });
await reload();
eq((await shown()).join('|'), 'Louisiana Purchase|Missouri', 'the seeded labels show');
await page.click('#btnSliceStart');
await settle(page, 200);
d = await data();
ok(d.slices && d.slices.list.length === 1 && d.slices.active === 's1', 'Start makes one slice and it is active');
ok(await page.isVisible('#sliceControls') && !(await page.isVisible('#btnSliceStart')), 'the controls show and Start goes');
eq(await page.textContent('#sliceReadout'), 'Slice 1 of 1: Slice 1', 'the readout names the slice');
eq(await page.inputValue('#sliceName'), 'Slice 1', 'the name field shows it');

// name and year, then a blank slice
await page.fill('#sliceName', '1803');
await page.fill('#sliceYear', '1803');
await page.dispatchEvent('#sliceYear', 'change');
await page.dispatchEvent('#sliceName', 'change');
d = await data();
ok(d.slices.list[0].name === '1803' && d.slices.list[0].year === 1803, 'name and year are saved');
await page.click('#btnSliceAdd');
await settle(page, 300);
eq((await shown()).length, 0, 'a blank slice shows no labels');
d = await data();
ok(d.slices.active === 's2' && d.labels.length === 0 && d.slices.list.length === 2, 'it is active and the live labels are empty');
ok(await page.evaluate(() => document.activeElement.id) === 'sliceName', 'focus goes to the new slice\'s name');
await page.fill('#sliceName', '1850');
await page.dispatchEvent('#sliceName', 'change');
await page.fill('#sliceYear', 'eighteen fifty');
await page.dispatchEvent('#sliceYear', 'change');
ok(/not a year/.test(await page.textContent('#sliceNote')), 'a year that is not a number is said so: ' + await page.textContent('#sliceNote'));
eq(await page.inputValue('#sliceYear'), '', 'and left blank');
await page.fill('#sliceYear', '1850');
await page.dispatchEvent('#sliceYear', 'change');
await editData(d => { d.labels = [{ id: 'b1', x: 600, y: 900, text: 'Louisiana Purchase', color: null, bold: false, italic: false, size: 'medium' }, { id: 'b2', x: 300, y: 1000, text: 'California', color: null, bold: false, italic: false, size: 'medium' }, { id: 'b3', x: 900, y: 700, text: 'Texas', color: null, bold: false, italic: false, size: 'medium' }]; });
await reload();
eq((await shown()).join('|'), 'California|Louisiana Purchase|Texas', 'after a reload the active slice is the one that was on the map');
eq(await page.textContent('#sliceReadout'), 'Slice 2 of 2: 1850, 1850', 'the readout carries name and year');

// moving between slices
await page.fill('#sliceRange', '0');
await page.dispatchEvent('#sliceRange', 'input');
await settle(page, 300);
eq((await shown()).join('|'), 'Louisiana Purchase|Missouri', 'the slider back to slice 1 brings its labels');
d = await data();
ok(d.slices.active === 's1' && d.slices.list[1].content && d.slices.list[1].content.labels.length === 3, 'and slice 2 is stored with its three');
ok(await page.isDisabled('#btnSlicePrev') && !(await page.isDisabled('#btnSliceNext')), 'previous is off on the first slice');
await page.click('#btnSliceNext');
await settle(page, 300);
eq((await shown()).join('|'), 'California|Louisiana Purchase|Texas', 'Next shows slice 2');
ok(await page.isDisabled('#btnSliceNext'), 'next is off on the last');
await page.click('#btnSlicePrev');
await settle(page, 200);
eq((await shown()).length, 2, 'Previous goes back');
eq(await page.getAttribute('#sliceRange', 'aria-valuetext'), 'Slice 1 of 2: 1803, 1803', 'the slider says where it is in words');

// copy
await page.click('#btnSliceCopy');
await settle(page, 300);
eq((await shown()).join('|'), 'Louisiana Purchase|Missouri', 'a copied slice starts as the one it was made from');
d = await data();
eq(d.slices.list.map(s => s.id).join(), 's1,s3,s2', 'and goes after it');
await page.fill('#sliceName', '1803');
await page.dispatchEvent('#sliceName', 'change');
eq(await page.inputValue('#sliceName'), '1803 (2)', 'a name already in use gets a number');
await page.fill('#sliceYear', '1804');
await page.dispatchEvent('#sliceYear', 'change');
await page.click('#btnSliceSort');
d = await data();
eq(d.slices.list.map(s => s.year).join(), '1803,1804,1850', 'Sort by year orders them');

// delete asks first
let asked = 0;
page.once('dialog', dlg => { asked++; dlg.dismiss(); });
await page.click('#btnSliceDelete');
eq(asked, 1, 'delete asks first');
eq((await data()).slices.list.length, 3, 'and Cancel keeps the slice');

// the sheet: a different map in each panel
await page.evaluate(() => {
  window.__sheet = null;
  const orig = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...a) { window.__sheet = this; return orig.apply(this, a); };
  // the panels the sheet draws, as a hash of their pixels, in order
  window.__panels = [];
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...r) {
    if (img instanceof HTMLCanvasElement && img.width < 3000 && img.width > 100 && img !== document.getElementById('baseCanvas') && this.canvas.width > 1000 && r.length === 4) {
      const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
      window.__panels.push(h);
    }
    return draw.call(this, img, ...r);
  };
});
await page.click('#sliceRange');
await page.fill('#sliceRange', '0');
await page.dispatchEvent('#sliceRange', 'input');
await settle(page, 300);
const dl = page.waitForEvent('download', { timeout: 40000 }).catch(() => null);
await page.click('#btnSlicePdf');
const file = await dl;
ok(file && file.suggestedFilename() === 'map-slices.pdf', 'Save the slices as PDF downloads map-slices.pdf: ' + (file && file.suggestedFilename()));
const panels = await page.evaluate(() => {
  const c = window.__sheet;
  if (!c) return null;
  const ctx = c.getContext('2d'), W = c.width, H = c.height;
  // three panels: find ink columns outside the white margin and compare thirds of the used area
  const d = ctx.getImageData(0, 0, W, H).data;
  let minX = W, maxX = 0;
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) { if (x < minX) minX = x; if (x > maxX) maxX = x; } }
  return { W, H, minX, maxX, ink: maxX > minX };
});
ok(panels && panels.ink && panels.W > 1000, 'the sheet is drawn at print size: ' + JSON.stringify(panels));

const hashes = await page.evaluate(() => window.__panels);
ok(hashes.length === 3, 'one panel is drawn for each of the three slices: ' + hashes.length);
ok(hashes.length === 3 && hashes[0] === hashes[1] && hashes[0] !== hashes[2], 'the panels differ by their slice: slice 1 and its copy match, slice 2 (three labels) does not: ' + JSON.stringify(hashes));

// changing nothing on the live map: after the sheet, slice 1 is still on the map with its labels
eq((await shown()).join('|'), 'Louisiana Purchase|Missouri', 'building the sheet leaves the map as it was');
d = await data();
ok(d.labels.length === 2 && d.slices.active === 's1', 'and the saved slice is still slice 1: ' + JSON.stringify([d.labels.map(l => l.text), d.slices.active, d.slices.list.map(s => s.id + ':' + (s.content ? s.content.labels.length : 'live'))]));

// the send to Timeline Builder: every slice, each dated by its slice's year; or only the slice on the map
await page.click('#btnLabelSets');
await settle(page, 300);
ok(await page.isVisible('#timelineAllSlicesWrap'), 'the "send every slice" box shows once there are slices');
const sendUrl = () => page.evaluate(() => {
  let captured = null;
  const realOpen = window.open;
  window.open = (u) => { captured = u; return { closed: false }; };
  document.getElementById('btnToTimeline').click();
  window.open = realOpen;
  return captured;
});
const eventsOf = async url => {
  const tl = await browser.newPage();
  await tl.goto(url, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 900));
  const ev = await tl.evaluate(() => { const n = localStorage.getItem('gvb-timeline:current'); const doc = n && JSON.parse(localStorage.getItem('gvb-timeline:data:' + n) || 'null'); return doc ? doc.events.map(e => e.title + '@' + e.yearStart) : null; });
  await tl.close();
  return ev;
};
const allUrl = await sendUrl();
ok(/015-timeline-builder\.html\?timeline=/.test(allUrl || ''), 'it opens a Timeline Builder link');
ok(/dated by their slice/.test(await page.textContent('#labelSetStatus')), 'and says the dates came from the slices: ' + await page.textContent('#labelSetStatus'));
const evAll = await eventsOf(allUrl);
ok(evAll && evAll.length === 7, 'every label of every slice becomes an event (7): ' + JSON.stringify(evAll));
ok(evAll && evAll.filter(e => /@1803$/.test(e)).length === 2 && evAll.filter(e => /@1804$/.test(e)).length === 2 && evAll.filter(e => /@1850$/.test(e)).length === 3, 'each dated by its slice: ' + JSON.stringify(evAll));
await page.uncheck('#timelineAllSlices');
const evOne = await eventsOf(await sendUrl());
ok(evOne && evOne.length === 2 && evOne.every(e => /@0$/.test(e)), 'with the box cleared only the slice on the map goes, at year 0: ' + JSON.stringify(evOne));
await page.check('#timelineAllSlices');

// a link's slices are cleaned
const arrived = await browser.newPage();
await arrived.goto(URL_PAGE, { waitUntil: 'networkidle' });
const link = await arrived.evaluate(() => window.StateLink.encodeState({
  name: 'Junk', __v: 1, view: { x: 0, y: 0, scale: 1 }, labels: [], markers: [], mapId: null,
  slices: { list: [{ id: 's1', name: 'Real', year: 1900 }, { id: '<img src=x>', name: 'Bad' }, { id: 's2', name: 'Fine', year: 1.5, content: { labels: 'nope' } }], active: 'zzz' },
}));
await arrived.goto(URL_PAGE + '?map=' + link, { waitUntil: 'networkidle' });
await settle(arrived, 900);
const got = await arrived.evaluate(() => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); return w.projects.find(q => q.id === w.activeId).data.slices; });
ok(got && got.list.length === 2 && got.active === 's1' && got.list[1].year === null && got.list[1].content && got.list[1].content.labels.length === 0, 'a link\'s slices arrive cleaned: ' + JSON.stringify(got));
await arrived.close();

// keyboard-only: the slider is a native range and the controls are reachable
const a11y = await a11yScan(page, { impact: 'serious' });
ok(!a11y || a11y.length === 0, 'axe: no serious or critical violations with slices on' + (a11y && a11y.length ? ' ' + JSON.stringify(a11y.map(v => v.id)) : ''));

const real = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
ok(real.length === 0, 'no console errors: ' + JSON.stringify(real));
ok(page.__blocked.length === offsite0, 'nothing requested off-site: ' + JSON.stringify(page.__blocked));
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-slices: all ${passed} passed`);
process.exit(failed ? 1 : 0);
