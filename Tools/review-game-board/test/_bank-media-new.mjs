// _bank-media-new.mjs — the new half of smoke-bank-media.mjs: a picture on a
// bank question, from the add card to a clue, a file and back (Path 12 P4).
// Not a suite by itself. Every question, name and picture is made up.

import { settle, downloadText, a11yScan } from '../../board-check/harness.mjs';
import { RED, BLUE } from './_before-media.mjs';

const KEY = 'gvb-question-bank';
const DATA = 'gvb-review-board:data:';
const REF = /^idb:h[0-9a-f]{32}$/;
const PNG = b64 => Buffer.from(b64.split(',')[1], 'base64');
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=1</script></svg>').toString('base64');
const SVG_TEXT = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1">';
const HTML = 'data:text/html;base64,' + Buffer.from('<script>window.__pwned=1</script>').toString('base64');
const BREAKOUT = 'data:image/png;base64,AAAA" onerror="window.__pwned=1';
const HUGE = 'data:image/png;base64,' + 'A'.repeat(4000001);

export async function run({ newPage, ok, URL_PAGE, BASE }) {
  const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const page = await newPage();
  const load = async () => {
    await page.goto(URL_PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__clueImagesSettled === true, null, { timeout: 8000 });
    await settle(page, 250);
  };
  const bankTab = async () => { await page.click('.top-tab-btn[data-top="bank"]'); await settle(page, 200); };
  const wipe = async () => {
    await page.goto(URL_PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__clueImagesSettled === true, null, { timeout: 8000 });
    await page.evaluate(() => { localStorage.clear(); return window.MediaDB.store({ ns: 'rgb' }).clear(); });
  };
  const bank = () => page.evaluate(() => window.QuestionBank.list());
  const rawBank = () => page.evaluate(k => localStorage.getItem(k) || '', KEY);
  const records = () => page.evaluate(() => window.MediaDB.store({ ns: 'rgb' }).list().then(l => l.map(r => r.id).sort()));
  const fileStatus = () => page.$eval('#bankFileStatus', el => [el.className, el.textContent]);
  const rows = () => page.$$eval('#bankList .bank-entry', list => list.map(r => ({
    q: (r.querySelector('.bank-q') || {}).textContent || '',
    tags: Array.from(r.querySelectorAll('.bank-tag.is-status')).map(t => t.textContent),
    img: Array.from(r.querySelectorAll('img')).map(i => [i.className, (i.getAttribute('src') || '').slice(0, 5), i.alt, i.complete && i.naturalWidth > 0]),
  })));
  /* Every src, href, srcdoc and data attribute in the document that is not a
     blob:, a data URL of one of the four picture types, or same-origin. */
  const badSources = () => page.evaluate((base) => {
    const bad = [];
    document.body.querySelectorAll('[src], [href], [srcdoc], object[data]').forEach(e => {
      ['src', 'href', 'srcdoc', 'data'].forEach(a => {
        const v = e.getAttribute(a);
        if (v === null || v === '') return;
        if (a === 'srcdoc') { bad.push(e.tagName + ' srcdoc'); return; }
        if (/^data:/i.test(v) && !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)) bad.push(e.tagName + ' ' + v.slice(0, 40));
        if (/^(javascript|vbscript):/i.test(v)) bad.push(e.tagName + ' ' + v.slice(0, 40));
      });
    });
    if (document.body.querySelector('svg[onload], [onload], [onerror]')) bad.push('an element with a handler attribute');
    return bad;
  }, BASE);
  const window_imageOf = x => (x.media && typeof x.media === 'object' && typeof x.media.image === 'string' ? x.media.image : '');
  const pwned = () => page.evaluate(() => window.__pwned);
  const importBank = async (name, text, { add = true } = {}) => {
    await page.setInputFiles('#bankImportFile', { name, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') });
    await page.waitForFunction(() => { const t = document.getElementById('bankFileStatus').textContent; return t && !/^Reading /.test(t); }, null, { timeout: 15000 });
    await settle(page, 250);
    if (add && await page.isVisible('#bankImportAddBtn')) { await page.click('#bankImportAddBtn'); await settle(page, 200); }
  };
  const addQuestion = async (q, a, png) => {
    await page.fill('#bankQuestion', q);
    await page.fill('#bankAnswer', a);
    if (png) {
      await page.setInputFiles('#bankAddPicture', { name: 'map.png', mimeType: 'image/png', buffer: PNG(png) });
      await page.waitForFunction(() => /Picture added/.test(document.querySelector('#bankAddPictureSlot .bank-picture-status').textContent), null, { timeout: 8000 });
    }
    await page.click('#bankAddBtn');
    await settle(page, 200);
  };

  /* ── 1. the add card ──────────────────────────────────────────────────── */
  console.log('  a picture on a question');
  await wipe();
  await load();
  await bankTab();
  ok(await page.isVisible('#bankAddPicture') && await page.$$eval('#bankAddPicture', l => l.length) === 1 && await page.$eval('label[for="bankAddPicture"]', l => l.textContent) === 'Picture (optional)', 'the add card has a labelled picture picker');
  ok(/Flashcards, a bracket’s matches, quiz-bowl, the final round and the sheets printed from this bank use the words only/.test(await page.$eval('#bankAddPictureHint', e => e.textContent)), 'which says where the picture is shown and where it is not');
  ok(await page.$eval('#bankAddPictureSlot .bank-picture-preview', e => e.hidden) && await page.$eval('#bankAddPictureSlot .bank-picture-remove', e => e.hidden), 'with no picture there is no preview and no Remove');
  await page.setInputFiles('#bankAddPicture', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') });
  await settle(page, 300);
  eq(await page.$eval('#bankAddPictureSlot .bank-picture-status', e => [e.className, e.textContent]), ['import-status bank-picture-status error', 'That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'], 'a file that is not an image is refused in words');
  await page.setInputFiles('#bankAddPicture', { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1" width="4" height="4"><rect width="4" height="4"/></svg>') });
  await page.waitForFunction(() => /Picture added|could not/.test(document.querySelector('#bankAddPictureSlot .bank-picture-status').textContent), null, { timeout: 8000 });
  ok(await pwned() === undefined, 'an SVG file that is picked runs nothing');
  eq((await records()).length <= 1 && await page.$eval('#bankAddPictureSlot .bank-picture-preview', e => !e.getAttribute('src') || /^blob:/.test(e.getAttribute('src'))), true, 'and what it leaves, if anything, is the redrawn JPEG, never the SVG');
  if (await page.isVisible('#bankAddPictureSlot .bank-picture-remove')) await page.click('#bankAddPictureSlot .bank-picture-remove');
  await page.evaluate(() => window.MediaDB.store({ ns: 'rgb' }).clear());

  await addQuestion('Which river is this?', 'The Nile', RED);
  let list = await bank();
  eq([list.length, list[0].prompt, Object.keys(list[0].media || {})], [1, 'Which river is this?', ['image']], 'Add stores the question with media.image and nothing else in media');
  const ref = list[0].media.image;
  ok(REF.test(ref), 'the picture is a reference to the media store, named by its hash (' + ref + ')');
  ok(!/data:image/.test(await rawBank()), 'no picture bytes are in the bank\'s localStorage key');
  eq(await records(), [ref.slice(4)], 'the store holds that one picture, under the namespace the clues use');
  eq(await page.evaluate(r => window.MediaDB.store({ ns: 'rgb' }).get(r).then(x => [x.type, x.tool]), ref.slice(4)), ['image/jpeg', 'review-game-board'], 'as the JPEG a clue\'s picture is stored as');
  eq(await rows(), [{ q: 'Which river is this?', tags: ['has a picture'], img: [['bank-pic', 'blob:', 'Picture for: Which river is this?', true]] }], 'the row shows it, drawn from an object URL, with a tag in words and an alt naming the question');
  ok(await page.$eval('#bankAddPictureSlot .bank-picture-preview', e => e.hidden), 'the add card\'s picker is empty again');
  await addQuestion('No picture here?', 'None');
  list = await bank();
  eq(['media' in list[1], (await rows())[1].img.length, (await rows())[1].tags], [false, 0, []], 'a question added with no picture has no media field, no image and no tag');

  /* ── 2. the edit form ─────────────────────────────────────────────────── */
  const openEdit = async n => { await page.click(`#bankList .bank-entry:nth-child(${n}) .bank-edit-open`); await settle(page, 200); };
  const stored = id => page.evaluate(i => window.QuestionBank.list().filter(q => q.id === i)[0], id);
  const id1 = list[0].id, id2 = list[1].id;
  await openEdit(1);
  ok(await page.isVisible('#bankList .bank-edit .bank-picture-preview') && /^blob:/.test(await page.$eval('#bankList .bank-edit .bank-picture-preview', e => e.getAttribute('src'))), 'Edit shows the question\'s picture');
  eq(await page.$eval('#bankList .bank-edit .bank-picture-preview', e => e.alt), 'The picture on this question', 'with an alt');
  const before1 = await stored(id1);
  await page.click('#bankList .bank-edit-save');
  await settle(page, 200);
  eq([await page.$eval('#bankListStatus', e => e.textContent), await stored(id1)], ['Nothing was changed.', before1], 'Save with nothing changed writes nothing, picture and dates included');
  await openEdit(1);
  await page.fill('#bankEditQuestion', 'Which river is this one?');
  await page.click('#bankList .bank-edit-save');
  await settle(page, 200);
  let now1 = await stored(id1);
  eq([now1.prompt, now1.media], ['Which river is this one?', { image: ref }], 'an edit of the words keeps the picture');
  await openEdit(1);
  await page.click('#bankList .bank-edit .bank-picture-remove');
  eq(await page.$eval('#bankList .bank-edit .bank-picture-status', e => e.textContent), 'Picture removed. The question is changed when you save it.', 'Remove says the question is not changed yet');
  eq((await stored(id1)).media, { image: ref }, 'and it is not');
  await page.keyboard.press('Escape');
  await settle(page, 200);
  eq((await stored(id1)).media, { image: ref }, 'Escape after Remove leaves the picture on the question');
  await openEdit(1);
  await page.click('#bankList .bank-edit .bank-picture-remove');
  await page.click('#bankList .bank-edit-save');
  await settle(page, 200);
  now1 = await stored(id1);
  eq(['media' in now1, now1.prompt, (await rows())[0].img.length], [false, 'Which river is this one?', 0], 'Remove and Save take the media field off, and the row loses its image');
  await openEdit(1);
  await page.setInputFiles('#bankEditPicture', { name: 'map.png', mimeType: 'image/png', buffer: PNG(RED) });
  await page.click('#bankList .bank-edit-save');             // pressed while the picture may still be being read
  await page.waitForFunction(() => !document.querySelector('#bankList .bank-edit'), null, { timeout: 8000 });
  await settle(page, 200);
  eq([(await stored(id1)).media, await records()], [{ image: ref }, [ref.slice(4)]], 'the same picture chosen again is the same id and still one record, and Save waited for it');
  await openEdit(2);
  await page.setInputFiles('#bankEditPicture', { name: 'sea.png', mimeType: 'image/png', buffer: PNG(BLUE) });
  await page.waitForFunction(() => /Picture added/.test(document.querySelector('#bankList .bank-edit .bank-picture-status').textContent), null, { timeout: 8000 });
  await page.click('#bankList .bank-edit-save');
  await settle(page, 200);
  const ref2 = (await stored(id2)).media.image;
  ok(REF.test(ref2) && ref2 !== ref && (await records()).length === 2, 'a different picture on the second question is a second record');
  ok(!/data:image/.test(await rawBank()), 'and still no picture bytes are in localStorage');

  /* ── 3. pulled into a board, shown on the clue ────────────────────────── */
  console.log('  on a clue');
  await page.click('#bankList .bank-entry:nth-child(1) input[type="checkbox"]');
  await page.click('#bankList .bank-entry:nth-child(2) input[type="checkbox"]');
  await page.fill('#bankPullCategory', 'Maps');
  await page.click('#bankPullBtn');
  await settle(page, 300);
  const pulled = await page.evaluate(() => {
    const block = Array.from(document.querySelectorAll('#categoriesEditor .category-block')).filter(b => b.querySelector('.cat-name-input').value === 'Maps')[0];
    return Array.from(block.querySelectorAll('.clue-row')).map(r => [r.querySelector('.clue-question').value, String(r.__clueImage || '')]);
  });
  eq(pulled, [['Which river is this one?', ref], ['No picture here?', ref2]], 'each pulled clue row holds its question\'s picture, as the same reference');
  await page.fill('#boardName', 'Pictures');
  await page.click('#buildFromManualBtn');
  await settle(page, 400);
  const board = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + 'Pictures');
  ok(!!board, 'the board saves');
  eq(board && board.categories[0].clues.map(c => c.image), [ref, ref2], 'its clues hold the same two references');
  eq((await records()).length, 2, 'and nothing was copied: two pictures, two records');
  await page.locator('#boardCols .cell').nth(0).click();
  await settle(page, 300);
  ok(await page.isVisible('#overlayImage') && /^blob:/.test(await page.getAttribute('#overlayImage', 'src')), 'the clue, opened on the board, shows the picture');
  await page.keyboard.press('Escape');
  await settle(page, 200);

  /* ── 4. the pass at load keeps a picture only the bank points at ──────── */
  console.log('  kept at load');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const open = indexedDB.open('gvb-media');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const t = open.result.transaction('blobs', 'readwrite'), os = t.objectStore('blobs');
      os.put({ id: 'rgb/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      const all = os.getAll();
      all.onsuccess = () => all.result.forEach(r => { if (/^rgb\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); } });
      t.oncomplete = () => resolve();
    };
  }));
  // The board goes, so only the bank points at the two pictures.
  await page.evaluate(() => { Object.keys(localStorage).filter(k => /^gvb-review-board:/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await load();
  eq(await records(), [ref.slice(4), ref2.slice(4)].sort(), 'after a load with no board, both of the bank\'s pictures are still stored and the orphan an hour old is gone');
  await bankTab();
  eq((await rows()).map(r => [r.tags, r.img.map(i => i[3])]), [[['has a picture'], [true]], [['has a picture'], [true]]], 'and both rows draw their pictures after the reload');
  eq(await rawBank() === '' ? null : JSON.parse(await rawBank()).data.questions.map(q => q.media), [{ image: ref }, { image: ref2 }], 'the load wrote nothing over the bank');

  /* ── 5. the bank file carries the pictures ────────────────────────────── */
  console.log('  in the bank file');
  const fileText = await downloadText(page, '#bankExportBtn', { what: 'the bank file' });
  const file = JSON.parse(fileText);
  ok(!/idb:/.test(fileText), 'the bank file holds no idb: reference');
  ok(file.questions.every(q => /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(q.media.image)), 'each question\'s picture is in it as a JPEG data URL');
  eq(await page.evaluate(([r, d]) => window.MediaDB.store({ ns: 'rgb' }).getBlob(r).then(b => window.MediaDB.toDataUrl(b)).then(u => u === d), [ref.slice(4), file.questions[0].media.image]), true, 'byte for byte the stored picture');
  eq(await fileStatus(), ['import-status ok', 'Saved 2 questions as question-bank.json, with 2 pictures in the file.'], 'and the status line counts the pictures');
  eq((await bank()).map(q => q.media), [{ image: ref }, { image: ref2 }], 'saving a file changes nothing in the bank');

  // Another device: nothing stored, the file comes in.
  await wipe();
  await load();
  await bankTab();
  eq([await bank(), await records()], [[], []], 'a cleared browser has no bank and no pictures');
  await importBank('question-bank.json', fileText, { add: false });
  eq(await page.$$eval('#bankImportList img.bank-pic', l => l.map(i => [(i.getAttribute('src') || '').slice(0, 5), i.complete && i.naturalWidth > 0])), [['blob:', true], ['blob:', true]], 'the preview shows each picture before anything is stored in the bank');
  eq(await bank(), [], 'and the bank is still empty');
  await page.click('#bankImportAddBtn');
  await settle(page, 250);
  eq(await fileStatus(), ['import-status ok', '2 questions added.'], 'Add stores the two questions');
  eq([(await bank()).map(q => [q.id, q.media]), await records()], [[[id1, { image: ref }], [id2, { image: ref2 }]], [ref.slice(4), ref2.slice(4)].sort()], 'with the same ids and the same picture ids as on the device that saved the file');
  ok(!/data:image/.test(await rawBank()), 'the pictures went into the media store, not into localStorage');
  eq((await rows()).map(r => r.img.map(i => i[3])), [[true], [true]], 'and the list draws them');
  await importBank('question-bank.json', fileText);
  eq([await fileStatus(), await records(), (await bank()).length], [['import-status ok', '0 questions added, 2 already in the bank.'], [ref.slice(4), ref2.slice(4)].sort(), 2], 'the same file again adds no question and no picture');

  /* ── 6. a file with pictures that may not come in ─────────────────────── */
  console.log('  a file with bad pictures');
  const q = (id, prompt, image) => ({ id, prompt, answer: 'A', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-09-01T00:00:00.000Z', media: { image } });
  const badFile = JSON.stringify({ format: 'aplp-question-bank', version: 1, questions: [
    q('b1', 'An SVG with onload', SVG), q('b2', 'A data:text/html URL', HTML), q('b3', 'Too large', HUGE), q('b4', 'Damaged', BREAKOUT),
    q('b5', 'Another browser', 'idb:h0000000000000000000000000000dead'), q('b6', 'A good one', RED), q('b7', 'An SVG as text', SVG_TEXT),
    q(id1, 'Which river is this one?', SVG),
  ] });
  await importBank('bad.json', badFile, { add: false });
  ok(await pwned() === undefined && (await badSources()).length === 0, 'shown: nothing ran, and no SVG, HTML or handler is in the document (' + (await badSources()).join(', ') + ')');
  const shownStatus = (await fileStatus())[1];
  ok(/^Read bad\.json\. Nothing is stored yet: check the list below, then press Add\. 7 pictures were left out, and the questions are here without them: row 1 \(it is not a PNG, JPEG, GIF or WebP picture\); row 2 \(it is not a PNG, JPEG, GIF or WebP picture\); row 3 \(it is larger than 3 MB\); row 4 \(its data is damaged\); row 5 \(it names a picture kept in another browser\); row 7 \(it is not a PNG, JPEG, GIF or WebP picture\); row 8 \(it is not a PNG, JPEG, GIF or WebP picture\)\.$/.test(shownStatus), 'the status names each picture left out by row and reason (' + shownStatus + ')');
  eq(await page.$$eval('#bankImportList img', l => l.length), 1, 'the preview draws the one good picture');
  await page.click('#bankImportAddBtn');
  await settle(page, 300);
  const after = await bank();
  eq(after.map(x => x.id), [id1, id2, 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], 'every question came in');
  eq(after.map(x => 'media' in x), [true, true, false, false, false, false, false, true, false], 'the seven without their pictures; the question the bank had keeps the one it had');
  eq([after[0].media, REF.test(after[7].media.image)], [{ image: ref }, true], 'and the good picture is stored');
  ok(/^7 questions added, 1 updated\. 7 pictures were left out/.test((await fileStatus())[1]) && (await fileStatus())[0] === 'import-status error', 'after Add the status still says what was left out');
  const raw = await rawBank();
  ok(!/svg\+xml|text\/html;base64|onerror=|AAAAAAAAAA/.test(raw), 'nothing of the refused pictures is in the stored bank');
  ok(await pwned() === undefined && (await badSources()).length === 0, 'stored and listed: nothing ran');
  eq((await records()).length, 3, 'three pictures are stored: the two from before and the good one');

  /* ── 7. a stored bank someone edited by hand ──────────────────────────── */
  console.log('  a crafted bank');
  await page.evaluate(([k, vals]) => {
    const env = JSON.parse(localStorage.getItem(k));
    env.data.questions.forEach((x, i) => { if (/^b[1-4]$|^b7$/.test(x.id)) x.media = { image: vals[i % vals.length] }; });
    env.data.questions.push({ id: 'c1', prompt: '<img src=x onerror="window.__pwned=1">', answer: 'A', media: '<svg onload="window.__pwned=1">', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: 't' });
    localStorage.setItem(k, JSON.stringify(env));
  }, [KEY, [SVG, HTML, BREAKOUT, SVG_TEXT]]);
  await load();
  await bankTab();
  ok(await pwned() === undefined && (await badSources()).length === 0, 'a bank whose media holds an SVG, an HTML URL and a break-out is listed with nothing run and none of them in the document');
  eq((await rows()).filter(r => /^An SVG|^A data:text|^Too large|^Damaged/.test(r.q)).map(r => [r.img.length, r.tags]), [[0, []], [0, []], [0, []], [0, []], [0, []]], 'those rows have no image and no picture tag');
  eq(await page.evaluate(() => { const all = ['a', RegExp.prototype.source]; return [window.ReviewBoardImage.url('data:image/svg+xml;base64,AAAA'), window.ReviewBoardImage.url('data:text/html;base64,AAAA'), all.length]; }), ['', '', 2], 'ReviewBoardImage.url() gives nothing for an SVG or an HTML data URL');
  eq(await page.evaluate(vals => vals.map(v => [window.ReviewBoardImage.isInline(v), window.QuestionBank.isInlineImage(v)]), [RED, BLUE, SVG, SVG_TEXT, HTML, BREAKOUT, 'data:image/gif;base64,R0lG', 'data:image/webp;base64,UklG', 'data:image/bmp;base64,Qk0=', 'idb:habc', '']),
    [[true, true], [true, true], [false, false], [false, false], [false, false], [false, false], [true, true], [true, true], [false, false], [false, false], [false, false]], 'the page\'s test of an inline picture and the bank\'s agree on every case');
  // Pulled into a board and opened: still nothing.
  await page.$$eval('#bankList .bank-entry input[type="checkbox"]', boxes => boxes.forEach(b => { if (!b.checked) b.click(); }));
  await page.fill('#bankPullCategory', 'Crafted');
  await page.click('#bankPullBtn');
  await settle(page, 300);
  ok(await pwned() === undefined && (await badSources()).length === 0, 'pulled into the editor: nothing ran');
  const craftedRows = await page.evaluate(() => {
    const block = Array.from(document.querySelectorAll('#categoriesEditor .category-block')).filter(b => b.querySelector('.cat-name-input').value === 'Crafted')[0];
    return Array.from(block.querySelectorAll('.clue-row')).map(r => String(r.__clueImage || '').slice(0, 4));
  });
  eq(craftedRows.filter(v => v && v !== 'idb:').length, 0, 'and no clue row holds anything but a stored picture\'s reference');
  // Edit on a crafted question: its form has no picture, and saving the words leaves media as it lies.
  await bankTab();
  const b1row = await page.$$eval('#bankList .bank-entry', l => l.findIndex(r => r.getAttribute('data-id') === 'b1') + 1);
  await openEdit(b1row);
  ok(await page.$eval('#bankList .bank-edit .bank-picture-preview', e => e.hidden) && await page.$eval('#bankList .bank-edit .bank-picture-remove', e => e.hidden), 'Edit on a question whose media is an SVG shows no picture');
  await page.keyboard.press('Escape');
  await settle(page, 150);
  // The file a crafted bank saves is cleaned when it is read back.
  const craftedFile = await downloadText(page, '#bankExportBtn', { what: 'the bank file' });
  ok(!/idb:/.test(craftedFile), 'a crafted bank\'s file still holds no reference');
  await wipe();
  await load();
  await bankTab();
  await importBank('crafted.json', craftedFile);
  ok(await pwned() === undefined && (await badSources()).length === 0, 'that file, imported on a clean browser: nothing ran');
  ok(!/svg\+xml|text\/html;base64/.test(await rawBank()), 'and no refused picture reached the stored bank');
  eq((await bank()).filter(x => x.id === 'c1').map(x => [x.media, window_imageOf(x)]), [['<svg onload="window.__pwned=1">', '']], 'a media that is text is carried as text, as it always was, and is no picture');
  ok((await bank()).every(x => { const v = x.media && x.media.image; return v === undefined || REF.test(v); }), 'every picture the bank now holds is a stored one');

  /* ── 8. a picture that is gone ────────────────────────────────────────── */
  console.log('  a missing picture');
  await wipe();
  await page.evaluate(([k, gone]) => {
    localStorage.setItem(k, JSON.stringify({ v: 1, data: { schema: 1, legacy: {}, questions: [
      { id: 'g1', prompt: 'Its picture is gone', answer: 'A', media: { image: gone }, unit: '', standard: '', difficulty: '', tags: [], points: 100, createdAt: 't' },
      { id: 'g2', prompt: 'Inline, no store', answer: 'B', media: { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==' }, unit: '', standard: '', difficulty: '', tags: [], points: 100, createdAt: 't' },
    ] } }));
  }, [KEY, 'idb:h0000000000000000000000000000dead']);
  await load();
  await bankTab();
  eq((await rows()).map(r => [r.tags, r.img.map(i => [i[1], i[3]])]), [[['picture missing from this browser'], []], [['has a picture'], [['data:', true]]]], 'a reference with nothing behind it is said in words and is never a broken image; an inline picture is drawn');
  const goneFile = JSON.parse(await downloadText(page, '#bankExportBtn', { what: 'the bank file' }));
  eq(goneFile.questions.map(x => x.media || null), [null, { image: RED }], 'the file leaves the missing picture off and carries the inline one');
  eq((await fileStatus())[1], 'Saved 2 questions as question-bank.json, with 1 picture in the file. 1 picture missing from this browser’s storage is not in it.', 'and says so');
  eq((await bank()).map(x => x.media), [{ image: 'idb:h0000000000000000000000000000dead' }, { image: RED }], 'the bank itself is unchanged by all of that');
  await openEdit(1);
  eq(await page.$eval('#bankList .bank-edit .bank-picture-status', e => e.textContent), 'This question’s picture is missing from this browser’s storage. Choose it again, or remove it.', 'Edit says the picture is missing');
  const scan = await a11yScan(page);
  eq(scan.map(v => v.id), [], 'the bank tab with a question open, a picture row and a missing one is clean under axe');
  await page.keyboard.press('Escape');

  /* ── 9. a board file names what it left out ───────────────────────────── */
  console.log('  a board file with bad pictures');
  const clue = (points, question, image, audio) => { const c = { points, question, answer: 'A', used: false, dailyDouble: false }; if (image !== undefined) c.image = image; if (audio !== undefined) c.audio = audio; return c; };
  const boardFile = JSON.stringify({ name: 'Left out', categories: [{ name: 'Maps', clues: [
    clue(100, 'Good picture', RED), clue(200, 'SVG picture', SVG), clue(300, 'HTML picture', HTML), clue(400, 'Huge picture', HUGE),
    clue(500, 'HTML sound', undefined, HTML), clue(600, 'Plain'),
  ] }], teams: [{ name: 'Otters', score: 0 }, { name: 'Herons', score: 0 }], dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15 });
  await page.click('.top-tab-btn[data-top="boards"]');
  await page.setInputFiles('#importBoardFile', { name: 'left-out.json', mimeType: 'application/json', buffer: Buffer.from(boardFile, 'utf8') });
  await page.waitForFunction(() => localStorage.getItem('gvb-review-board:current') === 'Left out', null, { timeout: 8000 });
  await settle(page, 300);
  const savedBoard = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), DATA + 'Left out');
  eq(savedBoard.categories[0].clues.map(c => [c.question, c.image ? c.image.slice(0, 5) : '', 'audioId' in c]), [['Good picture', 'idb:h', false], ['SVG picture', '', false], ['HTML picture', '', false], ['Huge picture', '', false], ['HTML sound', '', false], ['Plain', '', false]], 'every clue imports; only the good picture is kept');
  eq(await page.$eval('#importNote', e => [e.hidden, e.textContent]), [false, 'Imported “Left out” with every clue. Left out: the sound on “HTML sound” (it is not a sound); the picture on “SVG picture” (it is not a PNG, JPEG, GIF or WebP picture); the picture on “HTML picture” (it is not a PNG, JPEG, GIF or WebP picture); the picture on “Huge picture” (it is larger than 3 MB).'], 'and the page names each thing it left out, by clue and reason');
  ok(await pwned() === undefined && (await badSources()).length === 0, 'nothing ran and nothing refused is in the document');
  for (let n = 0; n < 5; n++) {
    await page.locator('#boardCols .cell').nth(n).click();
    await settle(page, 150);
    if (n > 0) ok(!(await page.isVisible('#overlayImage')) && !(await page.isVisible('#overlayAudio')), `clue ${n + 1}, opened, shows no picture and no player`);
    await page.keyboard.press('Escape');
    await settle(page, 100);
  }
  ok(await pwned() === undefined, 'opening every clue ran nothing');
  ok(page.__blocked === undefined || page.__blocked.length === 0, 'and nothing was asked of the network');

  /* ── 10. the pages that do not show a picture say so ──────────────────── */
  console.log('  040 and 020');
  await page.goto(BASE + '/Tools/040-vocab-flashcard-generator.html', { waitUntil: 'load' });
  ok(/A question’s picture stays in the bank: a card has its words only\./.test(await page.evaluate(() => document.body.textContent)), '040\'s question bank card says a card has the words only');
  await page.goto(BASE + '/Tools/020-bracket-tournament-generator.html', { waitUntil: 'load' });
  ok(/A question’s picture is not shown in a match or printed on its sheet: both have its words only\./.test(await page.evaluate(() => document.getElementById('academicCard').textContent)), '020\'s academic card says a match has the words only');
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  ok(/A question’s picture is not printed on these sheets: they have its words only\./.test(await page.$eval('#bankPrintHint', e => e.textContent)), '030\'s bank sheets say the same');
  await page.context().close();
}
