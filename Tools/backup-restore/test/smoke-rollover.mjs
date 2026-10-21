// smoke-rollover.mjs — 009's "Start a new school year" card in a browser
// (Path 3 P6: increment 1, the archive and its check before anything is
// cleared; increment 2, the review and the clear that keeps the setup).
//
//   node Tools/backup-restore/test/smoke-rollover.mjs
//
// What it holds, on a profile seeded with made-up students, a settings key,
// three seating photos and one review-board image:
//   - the steps cannot be skipped: the check is locked until an archive is
//     saved, the clear until a file on disk has passed;
//   - the saved archive holds every key and every image (gvb-media), and no
//     cache;
//   - a wrong file, an ordinary backup and a truncated archive are refused
//     with their reasons, and the clear stays locked;
//   - a student key saved after the check stops the clear with nothing
//     removed;
//   - the review table shows what goes, what stays and the free text that
//     names a student, with Keep and Clear; the clear keeps every tool's
//     setup, empties the class lists, removes the seating photos (and only
//     them) and the parked share file, and leaves no student's name in
//     storage; the journal holds no name;
//   - a clear that fails part way opens on the interrupted banner, and
//     finishing from the archive gives the storage an uninterrupted run gives;
//   - a cleared key saved back with last year's value is reported on the next
//     load, and can be cleared again;
//   - restoring the archive announces it as a year archive with its images
//     ticked;
//   - with a save picker (a handle), the page reads the file back itself, and
//     a file changed on disk after saving fails.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8532;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/009-backup-restore.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund'];
const SEED = {
  np_rosters: JSON.stringify({ 'Period 3': NAMES }),
  np_history: JSON.stringify([{ name: 'Avery Stone', at: 1 }]),
  'hall-pass-log-sections': JSON.stringify({ current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: NAMES.join('\n'),
    destinations: [{ id: 'lib', label: 'Library annex' }], log: [{ name: 'Blake Rivers' }] } } }),
  'subPlanBuilder.standingDetails.v1': JSON.stringify({ teacherName: 'Ms. Teacher', medicalAlerts: 'Casey Lund: inhaler in the top drawer' }),
  np_prompts: JSON.stringify(['Avery Stone goes first', 'Pair and share']),
  'gvb-rubric-builder:data:Essay': JSON.stringify({ title: 'Essay', rows: 4 }),
};
const STUDENT = ['hall-pass-log-sections', 'np_history', 'np_rosters'];

async function seed(page) {
  await page.goto(URL_PAGE);
  await page.evaluate(async (seed) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    await new Promise((resolve, reject) => {
      const del = indexedDB.deleteDatabase('gvb-media');
      del.onsuccess = del.onerror = () => {
        const req = indexedDB.open('gvb-media', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('blobs', { keyPath: 'id' });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('blobs', 'readwrite');
          const os = tx.objectStore('blobs');
          for (const id of ['seating/p1', 'seating/p2', 'seating/p3', 'rgb/clue1']) {
            os.put({ id, blob: new Blob([new Uint8Array(40).fill(id.length)], { type: 'image/png' }) });
          }
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      };
    });
    /* A roster file shared to 006 and never collected. */
    await caches.delete('aplp-share');
    const c = await caches.open('aplp-share');
    await c.put(new URL('../share/roster', location.href).href, new Response('Avery Stone\nBlake Rivers'));
  }, SEED);
  await page.reload();
  await page.waitForSelector('#roSaveBtn');
  await settle(page, 300);
}

const local = page => page.evaluate(() => {
  const o = {};
  Object.keys(localStorage).sort().forEach(k => { o[k] = localStorage.getItem(k); });
  return o;
});
const mediaIds = page => page.evaluate(() => new Promise(resolve => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const db = req.result;
    const r = db.transaction('blobs').objectStore('blobs').getAllKeys();
    r.onsuccess = () => { db.close(); resolve(r.result.slice().sort()); };
  };
}));
const shareParked = page => page.evaluate(async () => !!(await (await caches.open('aplp-share')).match(new URL('../share/roster', location.href).href)));
const waitReview = page => page.waitForSelector('#roReview .ro-table', { timeout: 10000 });
const disabled = (page, sel) => page.$eval(sel, el => el.disabled);
const text = (page, sel) => page.$eval(sel, el => el.textContent);
const pick = async (page, sel, body, name = 'archive.json') => {
  const msg = sel === '#roFinishFile' ? '#roFinishMsg' : '#roCheckMsg';
  await page.setInputFiles(sel, { name, mimeType: 'application/json', buffer: Buffer.from(body) });
  await settle(page, 150);
  await page.waitForFunction(s => {
    const el = document.querySelector(s);
    return !el || (el.textContent.trim() && !/Checking/.test(el.textContent));
  }, msg, { timeout: 10000 }).catch(() => {});
  await settle(page, 300);
};
async function save(page) {
  const t = await downloadText(page, '#roSaveBtn', { what: 'the year archive' });
  await page.waitForFunction(() => /Saved|could not|did not|cancelled/i.test(document.getElementById('roSaveMsg').textContent), null, { timeout: 15000 });
  return t;
}

const server = await serve(PORT);
const browser = await launch();
try {
  console.log('Backup & Restore — Start a new school year');
  const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });
  /* The anchor-download path, as in Firefox and Safari: no save picker. */
  await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch (e) {} window.showSaveFilePicker = undefined; });
  await seed(page);

  /* ── 1. the steps are locked in order ─────────────────────────────── */
  ok(await disabled(page, '#roCheckFile'), '1: the check is locked before an archive is saved');
  ok(await disabled(page, '#roClearBtn'), '1: the clear is locked before an archive is saved');
  ok(/Start a new school year/.test(await text(page, '#rolloverCard .card-title')), '1: the card has the name Devon chose');

  /* ── 2. the archive ───────────────────────────────────────────────── */
  const archive = await save(page);
  const env = JSON.parse(archive);
  ok(env.rollover && /^ro-/.test(env.rollover.id), '2: the archive carries its stamp');
  eq(env.formatVersion, 2, '2: and is an ordinary format-2 backup');
  eq(Object.keys(env.data).sort(), Object.keys(SEED).sort(), '2: every saved item, and no bookkeeping key');
  const recs = (env.indexedDB?.['gvb-media']?.stores || []).flatMap(s => s.records).map(r => r.v.id).sort();
  eq(recs, ['rgb/clue1', 'seating/p1', 'seating/p2', 'seating/p3'], '2: the images are in it, photos included');
  ok(!env.indexedDB['bmg-maps'], '2: the map cache is not');
  ok(!(await disabled(page, '#roCheckFile')), '2: saving unlocks the check');
  ok(await disabled(page, '#roClearBtn'), '2: ...and not the clear');
  ok(await disabled(page, '#roCheckBtn'), '2: with no save picker there is no handle, so the teacher picks the file');
  const j1 = await page.evaluate(() => localStorage.getItem('br_rollover_v1'));
  ok(j1 && /"state":"archived"/.test(j1), '2: the journal records an archived run');
  const vio = await a11yScan(page, { include: '#rolloverCard' });
  eq(vio.map(v => v.id + ':' + v.nodes.join(',')), [], '2: the card has no serious a11y violation after a save');

  /* ── 3. wrong files are refused, and the clear stays locked ───────── */
  const plain = JSON.parse(archive); delete plain.rollover;
  await pick(page, '#roCheckFile', JSON.stringify(plain, null, 2), 'backup.json');
  ok(/ordinary backup/.test(await text(page, '#roCheckMsg')), '3: an ordinary backup is refused as one');
  ok(await disabled(page, '#roClearBtn'), '3: ...and the clear stays locked');
  await pick(page, '#roCheckFile', archive.slice(0, Math.floor(archive.length / 2)));
  ok(/cut short/.test(await text(page, '#roCheckMsg')), '3: a truncated archive is refused as cut short');
  ok(await disabled(page, '#roClearBtn'), '3: ...and the clear stays locked');
  await pick(page, '#roCheckFile', '', 'empty.json');
  ok(/0 bytes/.test(await text(page, '#roCheckMsg')), '3: an empty file says it is 0 bytes');

  /* ── 4. the right file unlocks the clear ──────────────────────────── */
  await pick(page, '#roCheckFile', archive);
  ok(/is complete/.test(await text(page, '#roCheckMsg')), '4: the saved archive passes');
  await waitReview(page);
  ok(!(await disabled(page, '#roClearBtn')), '4: ...and unlocks the clear');
  const review = await text(page, '#roReview');
  ok(/Hall Pass/i.test(review) && /destinations/.test(review), '4: the review names the tool and the setup it keeps');
  ok(/3 student photos/.test(review) && /never opened/.test(review), '4: ...the photos and the parked share file');
  ok(/Names found: Avery Stone/.test(review), '4: free text naming a student is listed with the name found');
  ok(await page.$eval('#roReview input[value="clear"]', el => el.checked), '4: ...pre-set to Clear (Devon, 2026-10-07)');
  const steps4 = await text(page, '#roClearBtn');
  await page.check('#roReview input[value="keep"]');
  await page.waitForFunction(s => document.getElementById('roClearBtn').textContent !== s, steps4, { timeout: 10000 }).catch(() => {});
  ok(/\(6 steps\)/.test(await text(page, '#roClearBtn')) && /\(7 steps\)/.test(steps4), '4: choosing Keep takes that key out of the clear (7 steps to 6)');
  await page.check('#roReview input[value="clear"]');
  await page.waitForFunction(() => /\(7 steps\)/.test(document.getElementById('roClearBtn').textContent), null, { timeout: 10000 }).catch(() => {});
  const vio4 = await a11yScan(page, { include: '#rolloverCard' });
  eq(vio4.map(v => v.id + ':' + v.nodes.join(',')), [], '4: the review table has no serious a11y violation');

  /* ── 5. a key saved after the check stops the clear ───────────────── */
  await page.evaluate(() => localStorage.setItem('np_history', '[{"name":"Casey Lund","at":9}]'));
  await page.click('#roClearBtn');
  await page.waitForFunction(() => /saved since/.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 10000 });
  await settle(page, 400);
  const after5 = await local(page);
  ok(STUDENT.every(k => after5[k] === SEED[k] || k === 'np_history'), '5: a key saved since the archive stops the clear with nothing changed');
  eq((await mediaIds(page)).length, 4, '5: ...no photo removed');
  ok(await disabled(page, '#roClearBtn'), '5: ...and the clear locks until a new archive is saved');

  /* ── 6. the clear itself ──────────────────────────────────────────── */
  await seed(page);
  const archive6 = await save(page);
  await pick(page, '#roCheckFile', archive6);
  await waitReview(page);
  await page.click('#roClearBtn');
  await page.waitForFunction(() => /Cleared\./.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 10000 });
  const after6 = await local(page);
  const kept6 = Object.fromEntries(Object.entries(after6).filter(([k]) => !/^br_/.test(k)));
  eq(Object.keys(kept6).sort(), ['gvb-rubric-builder:data:Essay', 'hall-pass-log-sections', 'np_prompts', 'np_rosters', 'subPlanBuilder.standingDetails.v1'],
     '6: the student-only key is gone, the rest are kept');
  eq(after6['gvb-rubric-builder:data:Essay'], SEED['gvb-rubric-builder:data:Essay'], '6: the rubric is unchanged');
  const hp6 = JSON.parse(after6['hall-pass-log-sections']).sets['Period 3'];
  ok(hp6.destinations[0].label === 'Library annex' && hp6.namesText === '' && hp6.log.length === 0, '6: the hall pass keeps its custom destination and loses its names and log');
  eq(after6.np_rosters, '{"Period 3":[]}', '6: the class is kept, empty');
  eq(JSON.parse(after6['subPlanBuilder.standingDetails.v1']).medicalAlerts, '', '6: the medical alerts are gone');
  eq(after6.np_prompts, '["Pair and share"]', '6: the prompt naming a student is gone, the other kept');
  ok(!NAMES.some(n => Object.values(kept6).some(v => v.includes(n))), '6: no student\'s name is left in any saved item');
  eq(await mediaIds(page), ['rgb/clue1'], '6: the seating photos are gone and the review board\'s image is kept');
  ok(!(await shareParked(page)), '6: the parked roster file is gone');
  const receipt = await text(page, '#rolloverMsg');
  ok(!NAMES.some(n => receipt.includes(n)), '6: the receipt has no student name on it');
  ok(/private window/.test(receipt), '6: the receipt says how to see last year again');
  ok(!NAMES.some(n => (after6.br_rollover_v1 || '').includes(n)) && /"state":"done"/.test(after6.br_rollover_v1), '6: the journal says done and holds no name');

  /* ── 7. a key a still-open tab saved back is reported ─────────────── */
  await page.evaluate(v => localStorage.setItem('np_history', v), SEED.np_history);
  await page.evaluate(() => localStorage.setItem('np_rosters', '{"Period 3":["Dana New"]}'));
  await page.reload();
  await page.waitForSelector('#roReclear', { timeout: 10000 }).catch(() => {});
  const banner7 = await text(page, '#rolloverResume');
  ok(/Last year came back/.test(banner7) && /Name Picker/.test(banner7), '7: last year\'s value saved back is reported, by tool');
  ok(/Clear 1 item again/.test(banner7), '7: ...and only that key: this year\'s new roster is left alone');
  await page.click('#roReclear');
  await page.waitForFunction(() => !document.getElementById('roReclear'), null, { timeout: 10000 });
  const after7 = await local(page);
  ok(after7.np_history === undefined && after7.np_rosters === '{"Period 3":["Dana New"]}', '7: clearing it again removes last year\'s and keeps this year\'s');

  /* ── 8. an interrupted clear ──────────────────────────────────────── */
  await seed(page);
  const archive8 = await save(page);
  await pick(page, '#roCheckFile', archive8);
  await waitReview(page);
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    let n = 0;
    Storage.prototype.setItem = function (k, v) { if (k !== 'br_rollover_v1' && n++ === 1) throw new Error('QuotaExceededError'); return real.call(this, k, v); };
  });
  await page.click('#roClearBtn');
  await page.waitForFunction(() => /stopped part way/.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 10000 });
  await page.reload();
  await page.waitForSelector('#roFinishFile', { timeout: 10000 }).catch(() => {});
  ok(/interrupted/.test(await text(page, '#rolloverResume')) && /1 of 7/.test(await text(page, '#rolloverResume')), '8: a reload opens on the interrupted banner, 1 of 7');
  await pick(page, '#roFinishFile', archive6);
  ok(/not the archive this clear began with/.test(await text(page, '#roFinishMsg')), '8: finishing from another run\'s archive is refused');
  await pick(page, '#roFinishFile', archive8);
  await page.waitForFunction(() => /Cleared\./.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 10000 });
  const after8 = await local(page);
  eq(Object.fromEntries(Object.entries(after8).filter(([k]) => !/^br_/.test(k))), kept6, '8: finishing gives what an uninterrupted clear gives');
  eq(await mediaIds(page), ['rgb/clue1'], '8: ...the photos included');
  ok(!/interrupted/.test(await text(page, '#rolloverResume')), '8: ...and the banner goes');

  /* ── 9. restoring the archive ─────────────────────────────────────── */
  await page.setInputFiles('#fileInput', { name: 'archive.json', mimeType: 'application/json', buffer: Buffer.from(archive8) });
  await page.waitForSelector('#preview.active', { timeout: 10000 });
  ok(/Year archive/.test(await text(page, '#verifyBox')), '9: the restore names it a year archive');
  ok(await page.$eval('.restore-idb-check[data-db="gvb-media"]', el => el.checked), '9: ...with its images ticked');
  await page.setInputFiles('#fileInput', { name: 'plain.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plain)) });
  await settle(page, 400);
  ok(!(await page.$eval('.restore-idb-check[data-db="gvb-media"]', el => el.checked)), '9: an ordinary backup\'s images still start unticked');

  ok(page.__errs.length === 0, '9: no page errors (' + page.__errs.slice(0, 3).join(' | ') + ')');
  await page.context().close();

  /* ── 10. with a save picker: the page reads its own file back ─────── */
  const page2 = await prepPage(browser, BASE, { width: 1200, height: 1000 });
  await page2.addInitScript(() => {
    window.__disk = null;
    window.showSaveFilePicker = async (opts) => ({
      name: opts.suggestedName,
      createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => { window.__disk = buf; } }; },
      getFile: async () => new File([window.__disk || ''], opts.suggestedName),
    });
  });
  await seed(page2);
  await page2.click('#roSaveBtn');
  await page2.waitForFunction(() => /Saved/.test(document.getElementById('roSaveMsg').textContent), null, { timeout: 15000 });
  ok(!(await disabled(page2, '#roCheckBtn')), '10: with a handle, the page offers to check the file itself');
  await page2.evaluate(() => { window.__disk = window.__disk.replace('Avery Stone', 'Avery Stome'); });
  await page2.click('#roCheckBtn');
  await page2.waitForFunction(() => /did not pass/.test(document.getElementById('roCheckMsg').textContent), null, { timeout: 10000 });
  ok(await disabled(page2, '#roClearBtn'), '10: a file changed on disk after saving fails, and the clear stays locked');
  await page2.evaluate(() => { window.__disk = window.__disk.replace('Avery Stome', 'Avery Stone'); });
  await page2.click('#roCheckBtn');
  await page2.waitForFunction(() => /is complete/.test(document.getElementById('roCheckMsg').textContent), null, { timeout: 10000 });
  ok(!(await disabled(page2, '#roClearBtn')), '10: the file as saved passes and unlocks the clear');

  for (const p of [page2]) ok(p.__errs.length === 0, '10: no page errors (' + p.__errs.slice(0, 3).join(' | ') + ')');
  await page2.context().close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
