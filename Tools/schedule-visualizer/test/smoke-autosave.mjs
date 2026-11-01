// smoke-autosave.mjs — 035's autosave debounce and "Saved" indicator after they moved out of
// the page into schedule-visualizer/sv-autosave.js (Path 11 P2, rank 140, fourth increment).
//
//   node Tools/schedule-visualizer/test/smoke-autosave.mjs
//   (or: npm run test:layout-autosave)
//
// Held: the module's functions (the write too) are on window; one change shows "Saving…" at once, tells the
// recovery ring something changed, and writes nothing for the first 400 ms; a burst of changes
// is one write about 800 ms after the last; the write (the blueprint under its key, asking
// about headroom once, a refused write saying nothing is saved) and leaves "Saved <time>" in the indicator and the status bar; the indicator
// reports exactly the time it was given and does nothing for none; a saved plan round-trips
// through a reload (the rooms come back, the load says it restored, the indicator says Saved
// at the save's own time); a save from before this change (a stored string with no new fields)
// opens as it did. Exits 1 on any failure.

/* global BLUEPRINT_KEY, saveBlueprintToLocalStorage, applyFullProject, roomRegistry, RecoveryManager, setLastBlueprintSaveTime, updateSaveIndicator, scheduleBlueprintAutosave, _blueprintLoadStatus -- 035's globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8673;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
console.log('School Layout Visualizer: autosave (sv-autosave.js)');

const text = () => page.evaluate(() => ({
  ind: document.getElementById('bp-autosave-text').textContent,
  cls: document.getElementById('bp-autosave-indicator').className,
  sbar: document.getElementById('sbar-saved').title,
}));

eq(await page.evaluate(() => [typeof window.SVAutosave, typeof scheduleBlueprintAutosave, typeof updateSaveIndicator, typeof setLastBlueprintSaveTime]),
  ['object', 'function', 'function', 'function'], 'the module and its functions are on window');

console.log('1. the indicator reports the time it was given');
await page.evaluate(() => { setLastBlueprintSaveTime(new Date(2026, 8, 16, 15, 4, 5)); updateSaveIndicator(); });
const t1 = await page.evaluate(() => new Date(2026, 8, 16, 15, 4, 5).toLocaleTimeString());
let s = await text();
eq(s.ind, `Saved ${t1}`, 'the text says Saved and that time');
ok(/saved/.test(s.cls) && !/saving/.test(s.cls), 'the dot is in its saved state');
eq(s.sbar, `Blueprint auto-saved at ${t1}`, 'the status bar badge names the same time');
await page.evaluate(() => { setLastBlueprintSaveTime(null); document.getElementById('bp-autosave-text').textContent = 'x'; updateSaveIndicator(); });
eq((await text()).ind, 'x', 'with no time the indicator leaves the text alone');

console.log('2. one change: Saving… now, a write after the debounce');
await page.evaluate((p) => { applyFullProject(p); }, fixtureProject());
await page.evaluate(() => {
  window.__writes = 0; window.__dirty = 0;
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === BLUEPRINT_KEY) window.__writes++; return real.call(this, k, v); };
  window.__real = real;
  const md = RecoveryManager.markDirty.bind(RecoveryManager);
  RecoveryManager.markDirty = () => { window.__dirty++; return md(); };
});
await settle(page, 1200);
await page.evaluate(() => { window.__writes = 0; window.__dirty = 0; scheduleBlueprintAutosave(); });
s = await text();
eq(s.ind, 'Saving…', 'the text says Saving… at once');
ok(/saving/.test(s.cls), 'and the dot is in its saving state');
eq(await page.evaluate(() => window.__dirty), 1, 'the recovery ring is told something changed');
await settle(page, 400);
eq(await page.evaluate(() => window.__writes), 0, 'nothing is written in the first 400 ms');
await settle(page, 700);
eq(await page.evaluate(() => window.__writes), 1, 'one write by 1100 ms');
s = await text();
ok(/^Saved /.test(s.ind), 'and the text says Saved');

console.log('3. a burst is one write');
await page.evaluate(() => { window.__writes = 0; for (let i = 0; i < 5; i++) scheduleBlueprintAutosave(); });
await settle(page, 500);
await page.evaluate(() => scheduleBlueprintAutosave());
await settle(page, 600);
eq(await page.evaluate(() => window.__writes), 0, 'a change 500 ms later pushes the write back (600 ms after it, still none)');
await settle(page, 700);
eq(await page.evaluate(() => window.__writes), 1, 'and the burst is written once');
await page.evaluate(() => { Storage.prototype.setItem = window.__real; });

console.log('3b. the write itself');
eq(await page.evaluate(() => typeof saveBlueprintToLocalStorage), 'function', 'saveBlueprintToLocalStorage is on window');
const w = await page.evaluate(() => {
  const calls = { head: 0 };
  const realHead = window.checkStorageHeadroom;
  window.checkStorageHeadroom = () => { calls.head++; return realHead(); };
  setLastBlueprintSaveTime(null);
  document.getElementById('bp-autosave-text').textContent = 'x';
  const before = localStorage.getItem(BLUEPRINT_KEY);
  saveBlueprintToLocalStorage();
  const after = JSON.parse(localStorage.getItem(BLUEPRINT_KEY));
  window.checkStorageHeadroom = realHead;
  return { calls, text: document.getElementById('bp-autosave-text').textContent, floors: after.floors.length, savedAt: typeof after.savedAt, same: before === JSON.stringify(after), rooms: roomRegistry.length };
});
ok(/^Saved /.test(w.text), 'a write sets the indicator to Saved by itself');
eq(w.calls.head, 1, 'and asks about storage headroom once');
ok(w.floors > 0 && w.savedAt === 'string', 'the stored payload has its floors and a savedAt');
await page.evaluate(() => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === BLUEPRINT_KEY) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v); };
  setLastBlueprintSaveTime(null);
  document.getElementById('bp-autosave-text').textContent = 'y';
  window.__before = localStorage.getItem(BLUEPRINT_KEY);
  saveBlueprintToLocalStorage();
  Storage.prototype.setItem = real;
});
eq((await text()).ind, 'y', 'a refused write does not say Saved');
eq(await page.evaluate(() => localStorage.getItem(BLUEPRINT_KEY) === window.__before), true, 'and leaves the stored plan as it was');

console.log('4. a saved plan round-trips');
const rooms = await page.evaluate(() => roomRegistry.length);
ok(rooms > 0, 'the fixture school has rooms');
const savedAt = await page.evaluate(() => JSON.parse(localStorage.getItem(BLUEPRINT_KEY)).savedAt);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.evaluate(() => roomRegistry.length), rooms, 'after a reload the rooms are back');
eq(await page.evaluate(() => _blueprintLoadStatus), 'restored', 'the load says it restored');
const want = await page.evaluate((t) => `Saved ${new Date(t).toLocaleTimeString()}`, savedAt);
eq((await text()).ind, want, 'the indicator shows the save\'s own time');

console.log('5. an old save opens');
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem(BLUEPRINT_KEY));
  delete d.savedAt;
  localStorage.setItem(BLUEPRINT_KEY, JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.evaluate(() => roomRegistry.length), rooms, 'a save with no savedAt still opens with its rooms');
ok(/^Saved /.test((await text()).ind), 'and says Saved');

await browser.close(); server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
