// smoke-clue-image-store.mjs — the Review Game Board's clue images, in IndexedDB.
//
//   node Tools/review-game-board/test/smoke-clue-image-store.mjs
//
// Path 4 P4 moved 030's clue images out of localStorage — out of every saved
// board (`gvb-review-board:data:<name>`, each clue's `image`) — and into the
// shared media store (_shared/media-db.js, `gvb-media`, namespace `rgb`), and
// deleted the page's own readAndDownscaleImage(). The field kept its name and
// now holds `idb:<id>`, where the id is the stored image's hash. What a
// teacher could lose in that move is asserted here, in a real browser with a
// real IndexedDB:
//
//   1. Boards saved BEFORE the move (data: URL pictures, the open one and one
//      that is not) are migrated on load; the keys lose the image bytes; a
//      board with no picture is written back byte-identical; each distinct
//      picture is stored once; the projector and both printouts draw the same
//      picture from an object URL.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 1000 px JPEG on a
//      white mat, as readAndDownscaleImage() always stored; a board saved
//      under a new name shares the records rather than copying them.
//   4. Export JSON is portable (data: URLs, byte for byte, no `idb:`).
//   5. Importing that file stores its pictures before saving and reuses the
//      records already there; an `idb:` reference or a value that only looks
//      like an image is dropped from a file, an inline image kept and moved.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by a board that is not open, is not.
//   7. A picture whose image is gone says so on the board and in the editor,
//      is never a broken <img>, is left off the projector and the printouts,
//      is axe-clean in both themes, and Print still reaches window.print(). A
//      crafted value in a saved key never reaches the page as markup.
//   8. With no IndexedDB, pictures stay inline, as before.
//
// The bank carries no pictures (rgb-bank-store.js normalizes an entry to text
// fields), which section 1 checks, so it holds nothing GC has to keep.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8451;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const DATA = 'gvb-review-board:data:';
const REF = /^idb:h[0-9a-f]{32}$/;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* Two real 1x1 PNGs, different pixels, so "the same picture" is checkable. */
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';
/* A third, only ever on a board that is not open at load, so switching to it
   has to read it. */
const GREEN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgWGDwHwADRAHQpnV64gAAAABJRU5ErkJggg==';
const GONE = 'idb:h0000000000000000000000000000dead';
const CRAFTED = 'data:image/png;base64,AAAA" onerror="window.__pwned=1';

const clue = (points, question, image) => {
  const c = { points, question, answer: question + ' answer', used: false, dailyDouble: false };
  if (image !== undefined) c.image = image;
  return c;
};
const board = (name, clues) => ({
  name, categories: [{ name: 'Maps', clues }],
  teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
});
/* Three boards saved the way 030 saved them before the move: RED on both
   Rivers (open) and Deltas (not open), BLUE on Rivers only, GREEN on Deltas
   only, and one with no
   picture at all, which must come through byte for byte. A bank entry too. */
const SEED = {
  'gvb-review-board:list': ['Rivers', 'Deltas', 'Plain'],
  'gvb-review-board:current': 'Rivers',
  [DATA + 'Rivers']: board('Rivers', [clue(100, 'Which river?', RED), clue(200, 'Which sea?', BLUE), clue(300, 'Name a delta')]),
  [DATA + 'Deltas']: board('Deltas', [clue(100, 'Which delta?', RED), clue(200, 'Why deltas form', GREEN)]),
  [DATA + 'Plain']: board('Plain', [clue(100, 'What is a map scale?')]),
  'gvb-review-board-bank:entries': [{ id: 'bank-1', question: 'Longest river?', answer: 'Nile', points: 100, unit: 'Rivers', standard: '', difficulty: 'Easy', createdAt: '2026-09-01T00:00:00.000Z' }],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept().catch(() => {}));

const stored = (p, name) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + name);
const rawStored = (p, name) => p.evaluate(k => localStorage.getItem(k), DATA + name);
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-review-board/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'rgb' }).list());
const current = p => p.evaluate(() => localStorage.getItem('gvb-review-board:current'));
const images = b => b.categories[0].clues.map(c => c.image);
const asDataUrl = (p, src) => p.evaluate(s => fetch(s).then(r => r.blob()).then(b => new Promise(res => {
  const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
})), src);
const shownAs = async (p, sel) => {
  const srcs = await srcsOf(p, sel);
  return Promise.all(srcs.map(s => asDataUrl(p, s)));
};
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
/* window.print() is stubbed; it records whether every printed picture had
   loaded at the moment it was called, which is what the print-wait is for. */
const stubPrint = p => p.evaluate(() => {
  window.__printCalls = 0; window.__printReady = [];
  window.print = () => {
    window.__printCalls++;
    window.__printReady.push(Array.from(document.querySelectorAll('#printArea img')).every(e => e.complete && e.naturalWidth > 0));
  };
});
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__clueImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
  await stubPrint(p);
};
/* The text of the next JSON file this page hands the browser as a download. */
const nextDownload = (p, click) => p.evaluate(sel => new Promise(resolve => {
  const real = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    if (blob.type === 'application/json') { URL.createObjectURL = real; blob.text().then(resolve); }
    return real.call(URL, blob);
  };
  document.querySelector(sel).click();
  setTimeout(() => { URL.createObjectURL = real; resolve(null); }, 3000);
}), click);
const seed = (p, entries) => p.evaluate(s => {
  localStorage.clear();
  Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, entries);
/* Opens clue `n` on the projector; resolves to the overlay image's src, or null. */
const projected = async (p, n) => {
  await p.locator('#boardCols .cell').nth(n).click();
  await settle(p, 200);
  const shown = await p.isVisible('#overlayImage');
  const src = shown ? await p.getAttribute('#overlayImage', 'src') : null;
  await p.keyboard.press('Escape');
  await settle(p, 150);
  return src;
};
const printed = async (p, btn, sel) => {
  const before = await p.evaluate(() => window.__printCalls);
  await p.click(btn);
  await p.waitForFunction(n => window.__printCalls === n + 1, before, { timeout: 5000 });
  return srcsOf(p, sel);
};
const pickFile = (p, rowIdx, name, type, b64) => p.locator('#categoriesEditor .clue-row').nth(rowIdx)
  .locator('.clue-image-cell input[type="file"]').evaluate((input, [n, t, data]) => {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], n, { type: t }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [name, type, b64]);

console.log('Review Game Board — clue images in the media store');

/* ── 1. boards from before the move are migrated ──────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await seed(page, SEED);
await load(page);

let rivers = await stored(page, 'Rivers');
let deltas = await stored(page, 'Deltas');
const [redRef, blueRef] = images(rivers);
ok(REF.test(redRef), 'the open board\'s first picture now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'its second picture, a different one, gets a reference of its own');
eq(images(rivers)[2], undefined, 'a clue with no picture still carries no image field');
eq(images(deltas)[0], redRef, 'a board that is not open is migrated too, and shares the same picture\'s record');
const greenRef = images(deltas)[1];
ok(REF.test(greenRef || '') && greenRef !== redRef && greenRef !== blueRef, 'and its own picture gets a record of its own');
eq(await rawStored(page, 'Plain'), JSON.stringify(SEED[DATA + 'Plain']), 'a board with no picture is not rewritten at all');
eq(await current(page), 'Rivers', 'and the open board is still the open one');
ok(!(await everyKey(page)).includes('data:image'), 'no gvb-review-board key carries image bytes any more');
eq(await page.evaluate(() => localStorage.getItem('gvb-review-board-bank:entries')), JSON.stringify(SEED['gvb-review-board-bank:entries']),
  'the question bank is untouched (its entries carry no pictures)');
let recs = await records(page);
eq(recs.length, 3, 'the media store holds one record per distinct picture, however many boards use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'review-game-board'), 'each with its type and its owner');
ok(await page.isHidden('#imageNote'), 'and nothing is reported missing');

/* Printed first, before any picture has been decoded on screen, so the
   print-wait has something to wait for. */
eq((await printed(page, '#printQuizBtn', '#printArea .quiz-img')).length, 2, 'the practice quiz prints both pictures');
eq((await shownAs(page, '#printArea .quiz-img')).join(), [RED, BLUE].join(), 'the same two');
eq((await printed(page, '#printAnswerKeyBtn', '#printArea .key-img')).length, 2, 'and so does the answer key');
ok(await page.evaluate(() => window.__printReady.length === 2 && window.__printReady.every(Boolean)), 'every printed picture had loaded when print() was called');

const src0 = await projected(page, 0);
ok(/^blob:/.test(src0 || ''), 'the projector draws the first clue\'s picture from an object URL: ' + JSON.stringify(src0));
eq(src0 && await asDataUrl(page, src0), RED, 'showing exactly the picture it showed before the move');
const src1 = await projected(page, 1);
eq(src1 && await asDataUrl(page, src1), BLUE, 'and the second clue shows its own');
eq(await projected(page, 2), null, 'a clue with no picture shows none');
/* ── 2. a reload reads them back ──────────────────────────────────────── */
await load(page);
eq(await asDataUrl(page, await projected(page, 0)), RED, 'after a reload the picture draws out of IndexedDB');
eq((await records(page)).length, 3, 'and nothing was stored twice');
eq(JSON.stringify(images(await stored(page, 'Rivers'))), JSON.stringify(images(rivers)), 'and the board\'s pictures are unchanged');

/* ── 3. an upload is downscaled and stored; a renamed copy shares it ──── */
const bigPng = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1600;
  const x = c.getContext('2d');
  x.fillStyle = '#1f3550';
  x.fillRect(600, 400, 1200, 800);      // a navy block on transparency
  return c.toDataURL('image/png').split(',')[1];
});
await page.click('#editBoardBtn');
await settle(page, 200);
const editorThumbs = await srcsOf(page, '#categoriesEditor img.clue-image-thumb');
ok(editorThumbs.filter(s => /^blob:/.test(s || '')).length === 2, 'the editor draws both saved pictures from object URLs');
await pickFile(page, 2, 'delta.png', 'image/png', bigPng);
await page.waitForFunction(() => {
  const img = document.querySelectorAll('#categoriesEditor .clue-row')[2].querySelector('img.clue-image-thumb');
  return img && /^blob:/.test(img.getAttribute('src') || '');
}, null, { timeout: 10000 });
ok(await page.locator('#categoriesEditor .clue-row').nth(2).locator('.clue-image-thumb').isVisible(), 'the new picture shows in the editor');
await page.click('#buildFromManualBtn');
await settle(page, 300);
rivers = await stored(page, 'Rivers');
const bigRef = images(rivers)[2];
ok(REF.test(bigRef || ''), 'the upload is saved as a reference: ' + JSON.stringify(bigRef));
recs = await records(page);
const bigRec = recs.find(r => 'idb:' + r.id === bigRef);
eq(bigRec && bigRec.type, 'image/jpeg', 'the stored picture is a JPEG, as readAndDownscaleImage() always made');
const probe = await page.evaluate(ref => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    res({ w: img.naturalWidth, h: img.naturalHeight, corner: Array.from(g.getImageData(5, 5, 1, 1).data) });
  };
  img.src = window.ReviewBoardImage.url(ref);
}), bigRef);
eq(`${probe.w}x${probe.h}`, '1000x667', 'it is 1000 px on its long edge, the size 030 always stored, aspect kept');
ok(probe.corner.slice(0, 3).every(v => v > 240), 'and its transparent corner is white, not black: ' + JSON.stringify(probe.corner));
console.log(`  (measured: the 1000×667 test picture stores as ${bigRec && bigRec.size} bytes of JPEG)`);
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');

await page.click('#editBoardBtn');
await settle(page, 200);
await page.fill('#boardName', 'Rivers copy');
await page.click('#buildFromManualBtn');
await settle(page, 300);
eq(await current(page), 'Rivers copy', 'saving under a new name makes a second board');
eq(images(await stored(page, 'Rivers copy')).join(), images(rivers).join(), 'which points at the same records');
eq((await records(page)).length, recs.length, 'and copies no picture');
eq(images(await stored(page, 'Rivers')).join(), images(rivers).join(), 'while the original keeps its pictures');
await page.selectOption('#boardSwitch', 'Deltas');
await settle(page, 300);
eq(await asDataUrl(page, await projected(page, 1) || 'data:,none'), GREEN, 'a board switched to after load draws a picture only it holds');

/* ── 4. out of the browser: Export JSON ───────────────────────────────── */
await page.selectOption('#boardSwitch', 'Rivers');
await settle(page, 300);
const exported = await nextDownload(page, '#exportBoardBtn');
ok(exported && !exported.includes('idb:'), 'Export JSON carries no idb: reference');
const exportedB = exported ? JSON.parse(exported) : board('x', []);
const bigDataUrl = await page.evaluate(ref => window.ReviewBoardImage.inline(ref), bigRef);
ok(/^data:image\/jpeg;base64,/.test(bigDataUrl || ''), 'the upload reads back as a JPEG data URL');
eq(images(exportedB).join(), [RED, BLUE, bigDataUrl].join(), 'it carries every picture as a data URL, byte for byte');
eq(JSON.stringify(images(await stored(page, 'Rivers'))), JSON.stringify(images(rivers)), 'exporting did not rewrite the saved board');

/* ── 5. arrivals: a file ──────────────────────────────────────────────── */
const recsBefore = (await records(page)).length;
await page.setInputFiles('#importBoardFile', { name: 'rivers.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await page.waitForFunction(() => /^Rivers \(/.test(localStorage.getItem('gvb-review-board:current') || ''), null, { timeout: 8000 });
await settle(page, 200);
const imported = await stored(page, await current(page));
eq(images(imported).join(), [redRef, blueRef, bigRef].join(), 'an imported file\'s pictures move into the store and reuse the records already there');
eq((await records(page)).length, recsBefore, 'so the import stored nothing new');
ok(!(await everyKey(page)).includes('data:image'), 'and no image bytes were ever left in a key');
eq(await asDataUrl(page, await projected(page, 0)), RED, 'and the imported board shows its pictures');

const foreign = JSON.stringify(board('Foreign', [clue(100, 'Theirs', 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef'), clue(200, 'Ours', BLUE),
  clue(300, 'Crafted', CRAFTED), clue(400, 'Remote', 'https://example.invalid/x.png')]));
await page.setInputFiles('#importBoardFile', { name: 'foreign.json', mimeType: 'application/json', buffer: Buffer.from(foreign) });
await page.waitForFunction(() => localStorage.getItem('gvb-review-board:current') === 'Foreign', null, { timeout: 8000 });
await settle(page, 200);
const foreignB = await stored(page, 'Foreign');
eq(images(foreignB)[0], undefined, 'an idb: reference inside a file is dropped — it names the sender\'s pictures');
eq(images(foreignB)[1], blueRef, 'while its inline image is kept and stored');
eq(images(foreignB)[2], undefined, 'a value that only starts like an image is dropped too');
eq(images(foreignB)[3], undefined, 'and so is a remote URL');
await printed(page, '#printQuizBtn', '#printArea img');
eq(await page.evaluate(() => window.__pwned), undefined, 'so nothing in it ever reached the page as markup');
ok(await page.isHidden('#imageNote'), 'and nothing is reported missing');

/* ── 6. orphans are collected on the next load, and only orphans ──────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'rgb' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'rgb/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
});
/* Age every real record past the grace period, so only references keep them. */
await page.evaluate(() => new Promise(res => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    const all = os.getAll();
    all.onsuccess = () => all.result.forEach(r => {
      if (/^rgb\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); }
    });
    t.oncomplete = () => { req.result.close(); res(); };
  };
}));
/* Delete the renamed copy and the imports through the page, so the big
   picture is left on Rivers alone; then make Deltas the open board, so the
   only board still holding it is one that is not open. */
for (const name of ['Rivers copy', 'Foreign']) {
  await page.selectOption('#boardSwitch', name);
  await settle(page, 200);
  await page.click('#deleteBoardBtn');
  await settle(page, 200);
}
const leftover = (await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-review-board:list')))).filter(n => /^Rivers \(/.test(n));
for (const name of leftover) {
  await page.selectOption('#boardSwitch', name);
  await settle(page, 200);
  await page.click('#deleteBoardBtn');
  await settle(page, 200);
}
eq((await records(page)).filter(r => /^h/.test(r.id)).length, 4, 'deleting boards deletes no picture at that moment');
await page.evaluate(() => localStorage.setItem('gvb-review-board:current', 'Deltas'));
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load(page);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(bigRef.slice(4)) && after.includes(blueRef.slice(4)), 'an old record only a board that is not open points at survives');
ok(after.includes(redRef.slice(4)), 'and so does every one the open board points at');

/* ── 7. a picture with nothing behind it says so, and never hangs a print ── */
await page.evaluate(([k, gone, crafted]) => {
  const d = JSON.parse(localStorage.getItem(k));
  d.categories[0].clues[0].image = gone;
  d.categories[0].clues[1].image = crafted;   // what a hand-edited key or a crafted backup restore could hold
  localStorage.setItem(k, JSON.stringify(d));
  localStorage.setItem('gvb-review-board:current', 'Rivers');
}, [DATA + 'Rivers', GONE, CRAFTED]);
await load(page);
eq(images(await stored(page, 'Rivers'))[0], GONE, 'the dangling reference is left in place (the picture might come back in a restore)');
ok(/1 clue image on “Rivers” is missing/.test(await page.textContent('#imageNote')),
  'the board says one picture is missing, naming the board: ' + JSON.stringify(await page.textContent('#imageNote')));
ok(await page.isVisible('#imageNote'), 'and the note is on screen');
eq(await projected(page, 0), null, 'the projector shows no picture for the clue whose picture is gone');
eq(await projected(page, 1), null, 'nor for one holding a crafted value');
ok(/^blob:/.test(await projected(page, 2) || ''), 'while the clue whose picture is there still shows it');
eq((await printed(page, '#printQuizBtn', '#printArea img')).length, 1, 'the practice quiz reaches window.print() with only the picture that is there');
eq((await printed(page, '#printAnswerKeyBtn', '#printArea img')).length, 1, 'and so does the answer key');
eq(await page.evaluate(() => window.__pwned), undefined, 'the crafted value never reached the page as markup');
eq(await page.$$eval('img', els => els.filter(e => e.classList.contains('show') && !e.getAttribute('src')).length), 0, 'no shown <img> is left without a picture');

await page.click('#editBoardBtn');
await settle(page, 200);
const row0 = page.locator('#categoriesEditor .clue-row').nth(0);
ok(/Image missing from this browser/.test(await row0.locator('.clue-image-size').textContent()), 'the editor says so on the clue whose picture is gone');
ok(await row0.locator('.clue-image-thumb').isHidden(), 'with no broken thumbnail');
ok(await row0.getByRole('button', { name: 'Remove' }).isVisible(), 'and its Remove button still on it');
eq(await page.locator('#categoriesEditor .clue-row').nth(1).locator('.clue-image-thumb').getAttribute('src'), null,
  'a crafted value never becomes a thumbnail src');
const SCOPE = '#categoriesEditor';
const lightV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(lightV.length, 0, 'the missing-picture editor passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(darkV.length, 0, 'and in dark theme: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await row0.getByRole('button', { name: 'Remove' }).click();
await page.click('#buildFromManualBtn');
await settle(page, 300);
eq(images(await stored(page, 'Rivers'))[0], undefined, 'removing it and saving clears the reference');
ok(await page.isHidden('#imageNote'), 'and the note goes away');

/* the note, on the board, in both themes */
await page.evaluate(([k, gone]) => {
  const d = JSON.parse(localStorage.getItem(k));
  d.categories[0].clues[0].image = gone;
  localStorage.setItem(k, JSON.stringify(d));
}, [DATA + 'Rivers', GONE]);
await load(page);
const noteV = await a11yScan(page, { impact: 'serious', include: '#imageNote' });
eq(noteV.length, 0, 'the missing-picture note passes axe: ' + JSON.stringify(noteV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const noteDarkV = await a11yScan(page, { impact: 'serious', include: '#imageNote' });
eq(noteDarkV.length, 0, 'and in dark theme: ' + JSON.stringify(noteDarkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* ── 8. with no IndexedDB, pictures stay inline, as before ────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1400, height: 1000 });
noIdb.on('dialog', d => d.accept().catch(() => {}));
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, { 'gvb-review-board:list': ['Rivers'], 'gvb-review-board:current': 'Rivers', [DATA + 'Rivers']: SEED[DATA + 'Rivers'] });
await load(noIdb);
eq(await projected(noIdb, 0), RED, 'an inline picture still draws when there is nowhere to move it');
eq(images(await stored(noIdb, 'Rivers')).join(), [RED, BLUE, undefined].join(), 'and stays inline in the key');
await noIdb.click('#editBoardBtn');
await settle(noIdb, 200);
await pickFile(noIdb, 2, 'delta.png', 'image/png', bigPng);
await noIdb.waitForFunction(() => {
  const img = document.querySelectorAll('#categoriesEditor .clue-row')[2].querySelector('img.clue-image-thumb');
  return img && /^data:image\/jpeg/.test(img.getAttribute('src') || '');
}, null, { timeout: 10000 });
ok(/KB/.test(await noIdb.locator('#categoriesEditor .clue-row').nth(2).locator('.clue-image-size').textContent()),
  'the editor still sizes an inline picture, since it still costs localStorage');
await noIdb.click('#buildFromManualBtn');
await settle(noIdb, 300);
ok(/^data:image\/jpeg/.test(images(await stored(noIdb, 'Rivers'))[2] || ''),
  'a new upload is saved inline (a JPEG), as before Path 4 P4, rather than lost');
ok(await noIdb.isHidden('#imageNote'), 'and nothing is reported missing');
const offlineExport = await nextDownload(noIdb, '#exportBoardBtn');
ok(offlineExport && images(JSON.parse(offlineExport))[0] === RED, 'and Export JSON still carries them');

/* ── 9. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
