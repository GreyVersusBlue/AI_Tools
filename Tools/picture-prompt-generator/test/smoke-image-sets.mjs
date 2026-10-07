// smoke-image-sets.mjs — the Picture-Prompt Generator's named picture sets.
//
//   node Tools/picture-prompt-generator/test/smoke-image-sets.mjs
//
// One flat library per browser used to be all 071 had, so a "family
// vocabulary" and a "school vocabulary" could not coexist. The pictures are
// now in named sets (New, Duplicate, Rename, Delete beside a chooser, as 063's
// saved stories do), in the key the tool has always used, `ppg_images_v1`, as
// { v: 2, activeId, sets: [{ id, name, images }] }. What a teacher could lose
// is asserted here, in a real browser with a real IndexedDB:
//
//   1. THE LIBRARY A TEACHER HAS TODAY (the bare list, pictures already in the
//      media store, a pin on one) loads as one set, "My pictures", and loading
//      does not rewrite the key. After the first change the set's entries are
//      deep-equal to the old list and every stored picture is byte-for-byte
//      what it was: same record ids, same bytes, nothing re-encoded.
//   2. Two sets coexist: each keeps its own pictures, the stage and the
//      printed cards draw only from the active one, a reload keeps both and
//      which is open, and a pin on a picture stays with its set.
//   3. Duplicate shares the stored pictures (no new record), gives each entry
//      an id of its own, and copies the pins.
//   4. Rename; an empty name keeps the old one; cancelling a dialog changes
//      nothing.
//   5. Delete asks first (cancel keeps everything), frees the stored pictures
//      no other set uses and ONLY those, and deleting the last set leaves one
//      usable empty set. A reload afterwards finds the shared picture still
//      there.
//   6. Deleting a prompt set clears its pins on pictures in every picture set.
//   7. What a set costs is shown (its own bytes, from the stored records, and
//      the total), a browser near its quota gets a warning and one with room
//      does not, and a write the browser refuses is said, not swallowed.
//   8. A key a crafted backup could have written (a bad entry, a repeated id, a
//      blank name, an active id that is not there) is read safely.
//   9. The key is one the registry already declares, so 009's backup holds the
//      sets with no registry edit, and `gvb-media` is backed up by default.
//  10. The sets bar is axe-clean in both themes, with several sets.
//
// No console errors, ever. Exits 1 on any failure. Every picture is a plain
// coloured rectangle drawn by this suite; every name is invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8499;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/071-picture-prompt-generator.html';
const KEY = 'ppg_images_v1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

/* Dialogs answer from a script: each entry is { accept, text }; an empty
   script accepts with the default text. Every message is kept. */
let script = [];
const dialogs = [];
page.on('dialog', d => {
  const a = script.shift() || { accept: true };
  dialogs.push({ type: d.type(), message: d.message(), def: d.defaultValue() });
  (a.accept === false ? d.dismiss() : d.accept(a.text)).catch(() => {});
});
const answer = (...entries) => { script = entries; };

const load = async (p = page) => {
  await p.goto(URL_PAGE, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__pictureImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 250);
  await p.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls++; };
  });
};
const doc = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const raw = p => p.evaluate(k => localStorage.getItem(k), KEY);
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'ppg' }).list()
  .then(rs => rs.map(r => ({ id: r.id, size: r.size })).sort((a, b) => a.id < b.id ? -1 : 1)));
/* Every stored picture's bytes, as base64, by record id. */
const bytes = p => p.evaluate(async () => {
  const st = window.MediaDB.store({ ns: 'ppg' });
  const out = {};
  for (const r of await st.list()) out[r.id] = (await window.MediaDB.toDataUrl(await st.getBlob(r.id))).split(',')[1];
  return out;
});
/* Past media-db's ten-minute grace, so that boot's collection may take any record nothing names. */
const ageRecords = p => p.evaluate(() => new Promise((res, rej) => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    os.openCursor().onsuccess = e => {
      const c = e.target.result;
      if (c) { const v = c.value; v.savedAt = Date.now() - 3600e3; c.update(v); c.continue(); }
    };
    t.oncomplete = () => { req.result.close(); res(); };
    t.onerror = () => rej(t.error);
  };
}));
const options = p => p.$$eval('#imageSetSelect option', os => os.map(o => o.textContent));
const selected = p => p.$eval('#imageSetSelect', s => s.options[s.selectedIndex].textContent);
const thumbCount = p => p.$$eval('#thumbGrid .thumb-wrap', t => t.length);
const png = (p, hue) => p.evaluate(h => {
  const c = document.createElement('canvas'); c.width = 48; c.height = 32;
  const g = c.getContext('2d'); g.fillStyle = `hsl(${h} 70% 50%)`; g.fillRect(0, 0, 48, 32);
  g.fillStyle = '#fff'; g.fillRect(h % 20, h % 10, 8, 8);
  return c.toDataURL('image/png').split(',')[1];
}, hue).then(b => Buffer.from(b, 'base64'));
const upload = async (p, hues) => {
  const before = await thumbCount(p);
  await p.setInputFiles('#imageInput', await Promise.all(hues.map(async h => ({ name: `scene${h}.png`, mimeType: 'image/png', buffer: await png(p, h) }))));
  await p.waitForFunction(n => document.querySelectorAll('#thumbGrid .thumb-wrap').length === n, before + hues.length, { timeout: 8000 });
  await settle(p, 200);
};
const click = async (p, id) => { await p.click('#' + id); await settle(p, 150); };
const msg = p => p.textContent('#imageSetMsg');
const usage = p => p.textContent('#imageSetUsage');
const refsOf = set => set.images.map(i => i.src);

console.log('Picture-Prompt Generator — named picture sets');

/* ── 1. today's library becomes the first set, untouched ──────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(() => localStorage.clear());
await load();
/* Make three pictures the way an upload does, then write the OLD key shape. */
const made = [];
for (const h of [10, 130, 250]) {
  const buf = await png(page, h);
  made.push(await page.evaluate(async b64 => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return window.PicturePromptImage.fromFile(new File([u], 'a.png', { type: 'image/png' }));
  }, buf.toString('base64')));
}
ok(made.every(r => /^idb:h[0-9a-f]{32}$/.test(r)), 'the three test pictures are stored and named: ' + made.join());
const OLD = [
  { id: 'iOne', src: made[0], pinnedPrompts: { en: 'pX' } },
  { id: 'iTwo', src: made[1], pinnedPrompts: {} },
  { id: 'iThree', src: made[2], pinnedPrompts: { es: 'pY' } },
];
const OLD_RAW = JSON.stringify(OLD);
await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [KEY, OLD_RAW]);
const bytesBefore = await bytes(page);
const recsBefore = await records(page);
await load();
eq(await raw(page), OLD_RAW, 'loading a list from before the sets does not rewrite the key');
same(await options(page), ['My pictures (3 pictures)'], 'the list is one set, "My pictures", and the chooser says how many');
eq(await thumbCount(page), 3, 'with its three thumbnails');
eq(await page.$$eval('#thumbGrid img', i => i.length), 3, 'each drawn from the store');
ok(/“My pictures”: 3 pictures, \d/.test(await usage(page)), 'the usage line names the set and its pictures: ' + JSON.stringify(await usage(page)));
await click(page, 'renameImageSetBtn');     // any change writes the new shape; default text keeps the name
const d1 = await doc(page);
eq(d1.v, 2, 'the first change writes the version-2 shape');
eq(d1.sets.length, 1, 'one set');
same(d1.sets[0].images, OLD, 'whose entries are the old list, entry for entry: ids, references and pins');
same(await bytes(page), bytesBefore, 'every stored picture is byte for byte what it was (nothing re-encoded)');
same(await records(page), recsBefore, 'and no record was added, removed or resized');
eq(d1.activeId, d1.sets[0].id, 'the first set is the open one');

/* ── 2. two sets coexist ──────────────────────────────────────────────── */
const firstId = d1.sets[0].id;
answer({ accept: true, text: 'School vocabulary' });
await click(page, 'newImageSetBtn');
ok(/Started “School vocabulary”, empty/.test(await msg(page)), 'New says what it made: ' + JSON.stringify(await msg(page)));
same(await options(page), ['My pictures (3 pictures)', 'School vocabulary (0 pictures)'], 'the chooser lists both');
eq(await thumbCount(page), 0, 'the new set is empty');
eq(dialogs.at(-1).def, 'New picture set', 'and its name dialog starts from "New picture set"');
await upload(page, [60, 190]);
const d2 = await doc(page);
eq(d2.sets.length, 2, 'two sets saved');
eq(d2.sets[1].images.length, 2, 'the upload went into the open set');
ok(d2.sets[1].images.every(i => /^idb:h[0-9a-f]{32}$/.test(i.src)), 'as stored references');
same(d2.sets[0].images, OLD, 'and the first set is exactly as it was');
eq((await records(page)).length, 5, 'five records: three plus two');
eq(await thumbCount(page), 2, 'two thumbnails show');
for (let n = 0; n < 8; n++) await click(page, 'newImageBtn');
const stageUrl = await page.$eval('#stageCard img', i => i.getAttribute('src'));
ok(/^blob:/.test(stageUrl), 'the stage draws a picture from the open set');
await page.click('#pinPromptBtn');
const pinned = (await doc(page)).sets[1].images.filter(i => Object.keys(i.pinnedPrompts).length);
eq(pinned.length, 1, 'a pin lands on that set\'s own picture');
eq((await doc(page)).sets[0].images.every(i => i.pinnedPrompts.es === 'pY' || i.pinnedPrompts.en === 'pX' || !Object.keys(i.pinnedPrompts).length), true, 'and no pin in the other set moved');
await click(page, 'printBtn');
await page.waitForFunction(() => window.__printCalls === 1, null, { timeout: 5000 });
eq(await page.$$eval('#printArea img', i => i.length), 2, 'Print puts the open set\'s two pictures on cards, and no others');

/* switch back: independent, and the projected card is cleared */
await page.selectOption('#imageSetSelect', firstId);
await settle(page, 200);
eq(await thumbCount(page), 3, 'switching shows the first set\'s three pictures');
eq(await page.$$eval('#thumbGrid img', i => i.length), 3, 'each drawn at once, not left as "Loading…"');
ok(/Opened “My pictures”/.test(await msg(page)), 'and says which opened');
ok(/Click "New random image"/.test(await page.textContent('#stageCard')) || /Upload/.test(await page.textContent('#stageCard')), 'the projected card was cleared on the switch');
ok(/^“My pictures”: 3 pictures,/.test(await usage(page)) && /All 2 sets together: 5 distinct pictures/.test(await usage(page)),
  'the usage line follows the set and totals all of them: ' + JSON.stringify(await usage(page)));
eq((await doc(page)).activeId, firstId, 'the open set is saved');
await click(page, 'newImageBtn');
ok(/^1 of 3 images/.test(await page.textContent('#usedHint')), 'the first draw after the switch starts a round on this set\'s three, not the other set\'s leftovers: ' + JSON.stringify(await page.textContent('#usedHint')));
const firstBytes = new Set(Object.values(bytesBefore));
let foreign = 0;
for (let n = 0; n < 10; n++) {
  await click(page, 'newImageBtn');
  const b64 = await page.evaluate(async () => {
    const blob = await (await fetch(document.querySelector('#stageCard img').getAttribute('src'))).blob();
    return (await window.MediaDB.toDataUrl(blob)).split(',')[1];
  });
  if (!firstBytes.has(b64)) foreign++;
}
eq(foreign, 0, 'ten draws on the first set never project a picture from the other');
await click(page, 'printBtn');
await page.waitForFunction(() => window.__printCalls === 2, null, { timeout: 5000 });
eq(await page.$$eval('#printArea img', i => i.length), 3, 'Print on the first set draws its three');
/* A reload keeps both sets and the open one. */
await page.selectOption('#imageSetSelect', d2.sets[1].id);
await ageRecords(page);
await load();
eq((await records(page)).length, 5, 'a reload with every record past its grace period still keeps the first set\'s three (boot names every set\'s pictures)');
same(await options(page), ['My pictures (3 pictures)', 'School vocabulary (2 pictures)'], 'a reload keeps both sets');
eq(await selected(page), 'School vocabulary (2 pictures)', 'and the one that was open');
eq(await thumbCount(page), 2, 'with its pictures drawn');
await page.selectOption('#imageSetSelect', firstId);
await settle(page, 200);
eq(await page.$$eval('#thumbGrid img', i => i.length), 3, 'after a reload the set that was not open draws from the store when opened (every set\'s pictures are read at boot)');
await page.selectOption('#imageSetSelect', d2.sets[1].id);
await settle(page, 150);

/* ── 3. duplicate shares the pictures ─────────────────────────────────── */
const recsBeforeDup = await records(page);
answer({ accept: true, text: 'School vocabulary — Unit 2' });
await click(page, 'dupImageSetBtn');
eq(dialogs.at(-1).def, 'School vocabulary (copy)', 'Duplicate offers "<name> (copy)"');
const d3 = await doc(page);
eq(d3.sets.length, 3, 'three sets');
const orig = d3.sets[1], copy = d3.sets[2];
eq(copy.name, 'School vocabulary — Unit 2', 'the copy has the name given');
eq(d3.activeId, copy.id, 'and is the open one');
same(refsOf(copy), refsOf(orig), 'it holds the same references as the original');
ok(copy.images.every((i, n) => i.id !== orig.images[n].id), 'with entry ids of its own');
same(copy.images.map(i => i.pinnedPrompts), orig.images.map(i => i.pinnedPrompts), 'and the same pins');
same(await records(page), recsBeforeDup, 'no stored picture was added: a duplicate costs no room');
ok(/shared with “School vocabulary”/.test(await msg(page)), 'and the note says so: ' + JSON.stringify(await msg(page)));
ok(/All 3 sets together: 5 distinct pictures/.test(await usage(page)), 'and the total counts a shared picture once: ' + JSON.stringify(await usage(page)));

/* ── 4. rename ────────────────────────────────────────────────────────── */
answer({ accept: true, text: 'Family vocabulary' });
await click(page, 'renameImageSetBtn');
eq(dialogs.at(-1).def, 'School vocabulary — Unit 2', 'Rename starts from the current name');
eq(await selected(page), 'Family vocabulary (2 pictures)', 'the chooser shows the new name');
eq((await doc(page)).sets[2].name, 'Family vocabulary', 'and it is saved');
ok(/Renamed to “Family vocabulary”/.test(await msg(page)), 'with a note');
answer({ accept: true, text: '   ' });
await click(page, 'renameImageSetBtn');
eq((await doc(page)).sets[2].name, 'Family vocabulary', 'an empty name keeps the old one');
const rawBeforeCancel = await raw(page);
answer({ accept: false });
await click(page, 'renameImageSetBtn');
answer({ accept: false });
await click(page, 'newImageSetBtn');
answer({ accept: false });
await click(page, 'dupImageSetBtn');
eq(await raw(page), rawBeforeCancel, 'cancelling Rename, New or Duplicate changes nothing');
eq((await options(page)).length, 3, 'and adds no set');

/* ── 5. delete: asks, and frees only what no other set uses ───────────── */
/* Give "Family vocabulary" one picture of its own, so there is something unique to free. */
await upload(page, [300]);
const d4 = await doc(page);
const famRefs = refsOf(d4.sets[2]);
const ownRef = famRefs.find(r => !refsOf(d4.sets[1]).includes(r));
ok(!!ownRef, 'the open set now has a picture no other set holds: ' + ownRef);
const recsBeforeDel = await records(page);
eq(recsBeforeDel.length, 6, 'six stored records');
answer({ accept: false });
await click(page, 'deleteImageSetBtn');
ok(dialogs.at(-1).type === 'confirm' && /Delete “Family vocabulary”, with its 3 pictures/.test(dialogs.at(-1).message) && /cannot be undone/.test(dialogs.at(-1).message),
  'Delete asks first, naming the set and its pictures: ' + JSON.stringify(dialogs.at(-1).message));
ok(/A picture another set also uses stays/.test(dialogs.at(-1).message), 'and says shared pictures stay');
eq((await options(page)).length, 3, 'cancelling keeps the set');
same(await records(page), recsBeforeDel, 'and every stored picture');
answer({ accept: true });
await click(page, 'deleteImageSetBtn');
await page.waitForFunction(() => window.__pictureDiscarded === 1, null, { timeout: 5000 });
await settle(page, 200);
const d5 = await doc(page);
eq(d5.sets.length, 2, 'accepting removes the set');
same(d5.sets.map(s => s.name), ['My pictures', 'School vocabulary'], 'and only it');
eq(d5.activeId, d5.sets[1].id, 'the neighbouring set opens');
const recsAfterDel = await records(page);
eq(recsAfterDel.length, 5, 'one stored picture was freed at once');
ok(!recsAfterDel.some(r => 'idb:' + r.id === ownRef), 'the one only that set held');
ok(refsOf(d5.sets[1]).every(r => recsAfterDel.some(x => 'idb:' + x.id === r)), 'the two it shared with "School vocabulary" are still stored');
ok(/Deleted “Family vocabulary”/.test(await msg(page)), 'with a note');
eq(await thumbCount(page), 2, 'and the open set still draws both');
eq(await page.$$eval('#thumbGrid .thumb-missing', t => t.length), 0, 'none of them missing');
await ageRecords(page);
await load();
eq(await page.$$eval('#thumbGrid img', i => i.length), 2, 'after a reload the shared pictures draw from the store');
eq((await records(page)).length, 5, 'and boot collected nothing more');
/* delete the set that shares nothing: the three originals go, the two stay */
await page.selectOption('#imageSetSelect', firstId);
await settle(page, 200);
answer({ accept: true });
await click(page, 'deleteImageSetBtn');
await page.waitForFunction(() => window.__pictureDiscarded === 1, null, { timeout: 5000 });
await settle(page, 300);
eq((await records(page)).length, 2, 'deleting the set of three frees its three, keeps the other set\'s two');
/* the last set */
answer({ accept: true });
await click(page, 'deleteImageSetBtn');
await settle(page, 300);
const d6 = await doc(page);
eq(d6.sets.length, 1, 'deleting the last set leaves one');
eq(d6.sets[0].name, 'My pictures', 'a fresh "My pictures"');
eq(d6.sets[0].images.length, 0, 'empty');
eq((await records(page)).length, 0, 'with every stored picture freed');
ok(/Nothing|freed/.test(await msg(page)) || /Deleted/.test(await msg(page)), 'and a note');
await upload(page, [100]);
eq((await doc(page)).sets[0].images.length, 1, 'the tool is usable again: an upload lands');

/* ── 6. deleting a prompt set clears its pins in every picture set ────── */
await click(page, 'newImageSetBtn');
await upload(page, [220]);
await page.selectOption('#promptSetSelect', 'es');
await click(page, 'newImageBtn');
await page.click('#pinPromptBtn');
const pinsIn = async () => (await doc(page)).sets.flatMap(s => s.images).filter(i => i.pinnedPrompts.es).length;
eq(await pinsIn(), 1, 'a Spanish pin is on a picture in the second set');
await page.selectOption('#imageSetSelect', (await doc(page)).sets[0].id);
await settle(page, 150);
await page.selectOption('#promptSetSelect', 'es');
await click(page, 'newImageBtn');
await page.click('#pinPromptBtn');
eq(await pinsIn(), 2, 'and one in the first');
answer({ accept: true });
await click(page, 'deleteSetBtn');
eq(await pinsIn(), 0, 'deleting the Spanish prompt set clears its pins in both picture sets');

/* ── 7. cost, quota, and a refused write ──────────────────────────────── */
const sizeSum = (await records(page)).reduce((a, r) => a + r.size, 0);
ok(/KB|\d B/.test(await usage(page)) && !/nearly full/.test(await usage(page)), 'a browser with room gets no warning: ' + JSON.stringify(await usage(page)));
eq(await page.$eval('#imageSetUsage', e => e.classList.contains('near')), false, 'and no warning style');
const fmt = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
ok((await usage(page)).includes(fmt(sizeSum)), `the all-sets total is the records' own bytes, ${fmt(sizeSum)}: ` + JSON.stringify(await usage(page)));

const quota = await prepPage(browser, BASE, { width: 1280, height: 900 });
quota.on('dialog', d => d.accept().catch(() => {}));
await quota.context().addInitScript(() => {
  navigator.storage.estimate = () => Promise.resolve({ usage: 93 * 1048576, quota: 100 * 1048576 });
});
await load(quota);
const nearText = await usage(quota);
ok(/This browser has used 93\.0 MB of the 100\.0 MB it allows this site, so it is nearly full\. Delete a picture set/.test(nearText), 'at 93% the line warns: ' + JSON.stringify(nearText));
eq(await quota.$eval('#imageSetUsage', e => e.classList.contains('near')), true, 'in the warning style');
await quota.context().close();

const edge = await prepPage(browser, BASE, { width: 1280, height: 900 });
await edge.context().addInitScript(() => {
  navigator.storage.estimate = () => Promise.resolve({ usage: 79 * 1048576, quota: 100 * 1048576 });
});
await load(edge);
ok(!/nearly full/.test(await usage(edge)), 'at 79% there is no warning');
await edge.context().close();

const full = await prepPage(browser, BASE, { width: 1280, height: 900 });
await load(full);
await full.evaluate(() => {
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'ppg_images_v1') throw new DOMException('full', 'QuotaExceededError');
    return set.call(this, k, v);
  };
});
full.on('dialog', d => d.accept('Will not fit').catch(() => {}));
await click(full, 'newImageSetBtn');
ok(/could not save that change: its storage is full or blocked/.test(await msg(full)), 'a refused write is said: ' + JSON.stringify(await msg(full)));
await full.context().close();

/* ── 2b. pictures still inline, in two sets, all move into the store ──── */
const INLINE_RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const INLINE_BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';
await page.evaluate(([k, a, b]) => localStorage.setItem(k, JSON.stringify({ v: 2, activeId: 'p', sets: [
  { id: 'p', name: 'Inline one', images: [{ id: 'x1', src: a, pinnedPrompts: {} }] },
  { id: 'q', name: 'Inline two', images: [{ id: 'x2', src: b, pinnedPrompts: {} }, { id: 'x3', src: a, pinnedPrompts: {} }] }] })), [KEY, INLINE_RED, INLINE_BLUE]);
await load();
const d2b = await doc(page);
ok(d2b.sets.every(s => s.images.every(i => /^idb:h[0-9a-f]{32}$/.test(i.src))), 'inline pictures in every set, not only the open one, move into the store: ' + JSON.stringify(d2b.sets.map(s => s.images.map(i => i.src.slice(0, 8)))));
eq(d2b.sets[0].images[0].src, d2b.sets[1].images[1].src, 'a picture in two sets is one reference');
eq(await page.evaluate(k => localStorage.getItem(k).includes('data:image'), KEY), false, 'and the key carries no image bytes');

/* ── 8. a crafted key is read safely ──────────────────────────────────── */
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({
  v: 2, activeId: 'nope', sets: [
    null, 'text', { id: 7, name: 'x', images: [] },
    { id: 'a', name: '  ', images: [null, 5, { id: 'i1', src: '', pinnedPrompts: {} }] },
    { id: 'a', name: 'Duplicate id', images: [] },
    { id: 'b', name: 'Second', images: 'not a list' },
  ],
})]);
await load();
same(await options(page), ['My pictures (1 picture)', 'Second (0 pictures)'], 'bad entries, a repeated id and a blank name are cleaned');
eq(await selected(page), 'My pictures (1 picture)', 'and an active id that is not there falls to the first set');
const MARKUP = '<img src=x onerror="window.__pwned=1">';
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ v: 2, activeId: 'm', sets: [{ id: 'm', name: MARKUP, images: [] }] })]);
await load();
same(await options(page), [MARKUP + ' (0 pictures)'], 'a set named with markup is shown as text');
eq(await page.evaluate(() => window.__pwned), undefined, 'and runs nothing');
eq(await page.$$eval('#imageSetSelect *:not(option)', e => e.length), 0, 'and makes no element inside the chooser');
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, '{"sets": []}']);
await load();
same(await options(page), ['My pictures (0 pictures)'], 'a key with no sets reads as one empty set');
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, 'not json']);
await load();
same(await options(page), ['My pictures (0 pictures)'], 'and an unreadable key does too');

/* ── 9. the registry and the backup ───────────────────────────────────── */
const registry = fs.readFileSync(path.join(ROOT, '_shared/tool-registry.js'), 'utf8');
const row = registry.slice(registry.indexOf("slug: 'picture-prompt-task-generator'"), registry.indexOf("slug: 'cognates-false-friends-builder'"));
ok(row.length > 100 && row.includes("{ k: 'ppg_images_v1' }"), 'the registry\'s 071 row declares ppg_images_v1, the key that now holds the sets');
const used = await page.evaluate(() => Object.keys(localStorage).filter(k => /^ppg_/.test(k)));
ok(used.length > 0 && used.every(k => row.includes(`{ k: '${k}' }`)), 'every ppg_ key this tool wrote is declared there: ' + used.join());
ok(/name: 'gvb-media', backupByDefault: true/.test(registry), 'and gvb-media, which holds the pictures, is in 009\'s backup by default');
ok(!fs.readdirSync(path.join(ROOT, 'Tools/picture-prompt-generator')).some(f => /image-sets?\.js$/.test(f)), 'no new file was added to precache');

/* ── 10. accessibility, both themes, with several sets ────────────────── */
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify({ v: 2, activeId: 'a', sets: [
  { id: 'a', name: 'Family vocabulary', images: [] }, { id: 'b', name: 'School vocabulary', images: [] }, { id: 'c', name: 'Unit 3', images: [] }] })]);
await load();
await page.click('#renameImageSetBtn').catch(() => {});
const SCOPE = '#imageSetSelect, #imageSetMsg, #imageSetUsage, .setbar';
let v = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(v.length, 0, 'the picture set bar passes axe: ' + JSON.stringify(v.map(x => x.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
v = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(v.length, 0, 'and in dark theme: ' + JSON.stringify(v.map(x => x.id)));
eq(await page.$eval('#imageSetMsg', e => e.getAttribute('role') + '/' + e.getAttribute('aria-live')), 'status/polite', 'the note is a polite status for a screen reader');
eq(await page.$eval('label[for="imageSetSelect"]', l => l.textContent.trim()), 'Picture set', 'the chooser has a label');
eq(await page.$$eval('#newImageSetBtn, #dupImageSetBtn, #renameImageSetBtn, #deleteImageSetBtn', b => b.map(x => x.textContent.trim()).join('|')), '+ New|Duplicate|Rename|Delete', 'the four buttons read as 063\'s do');
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* ── 11. no console noise ─────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
