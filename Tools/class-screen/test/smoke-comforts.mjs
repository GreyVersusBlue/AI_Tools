// smoke-comforts.mjs — 087 Class Screen, Path 22 P11 (layout comforts).
//
//   node Tools/class-screen/test/smoke-comforts.mjs
//
// Snap to grid, minimize to a chip, a colour per widget, screen thumbnails and
// the large-text projector theme. Each is also driven through present mode,
// spotlight, undo and the keyboard shortcuts, because a comfort that breaks one
// of those is worse than none. Contrast is measured on the painted colours, in
// light and dark. Nothing here uses a real student's name.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8652;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

console.log('Class Screen — layout comforts');

// A board written before P11: no snap, no projector, no min, no colour.
const OLD = { v: 1, data: { current: 's1', follow: false, screens: [
  { id: 's1', name: 'Old screen', bg: 'dots', bgImage: '', period: '', widgets: [
    { id: 'wa', type: 'text', x: 0.05, y: 0.05, w: 0.3, h: 0.25, z: 1, data: { text: 'Hello', size: 2 } },
    { id: 'wb', type: 'timer', x: 0.4, y: 0.05, w: 0.26, h: 0.34, z: 2, data: { duration: 300, endsAt: 0, remaining: 300, sound: false } }] }] } };

await page.goto(URL_PAGE);
await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, OLD]);
await page.reload();
await settle(page, 400);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const wdata = async (id) => (await cur()).widgets.find((w) => w.id === id);
const node = (id) => page.locator(`#board .w[data-id="${id}"]`);
const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, KEY);
const onGrid = (v) => Math.abs(v / 0.025 - Math.round(v / 0.025)) < 1e-3;
const html = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

// ── an old board opens as it was ─────────────────────────────────────
console.log(' an old board');
eq((await cur()).widgets.map((w) => w.id), ['wa', 'wb'], 'a board saved before P11 opens with its widgets');
await node('wa').locator('.w-grip').focus();
await page.keyboard.press('ArrowRight');           // forces a save
await settle(page, 700);
const s0 = await stored();
ok(!('snap' in s0) && !('projector' in s0), 'a save adds neither page switch while they are off');
ok(s0.screens[0].widgets.every((w) => !('min' in w) && !('color' in w)), 'and no widget gains a min or colour field');
ok(await page.locator('#snapToggle').isChecked() === false && await page.locator('#projectorToggle').isChecked() === false, 'both switches start off');

// ── snap to grid ─────────────────────────────────────────────────────
console.log(' snap to grid');
const drag = async (id, part, dx, dy, hold) => {
  const b = await node(id).locator(part).boundingBox();
  await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
  await page.mouse.move(b.x + 8 + dx, b.y + 8 + dy, { steps: 6 });
  if (hold) await hold();
  await page.mouse.up(); await settle(page, 150);
};
await drag('wa', '.w-grip', 133, 71);
let a = await wdata('wa');
ok(!onGrid(a.x) || !onGrid(a.y), 'with snap off a drag lands wherever it was dropped');
await page.check('#snapToggle');
await settle(page, 600);
eq((await stored()).snap, true, 'turning snap on is saved');
let sawGrid = false;
await drag('wa', '.w-grip', 117, 59, async () => { sawGrid = await page.evaluate(() => document.getElementById('board').classList.contains('drag-snap')); });
a = await wdata('wa');
ok(onGrid(a.x) && onGrid(a.y), `a snapped move lands on the grid (x ${a.x}, y ${a.y})`);
ok(sawGrid, 'the grid shows while dragging');
ok(!(await page.evaluate(() => document.getElementById('board').classList.contains('drag-snap'))), 'and goes when the drag ends');
eq([a.w, a.h], [0.3, 0.25], 'a move keeps the size');
const before = await wdata('wa');
await drag('wa', '.w-resize', 87, 43);
a = await wdata('wa');
ok(onGrid(a.x + a.w) && onGrid(a.y + a.h), `a snapped resize puts the far corner on the grid (${a.x + a.w}, ${a.y + a.h})`);
eq([a.x, a.y], [before.x, before.y], 'and leaves the near corner where it was');
await node('wa').locator('.w-grip').focus();
const kx = (await wdata('wa')).x;
await page.keyboard.press('ArrowRight');
await settle(page, 150);
const k2 = (await wdata('wa')).x;
ok(onGrid(k2) && Math.abs(k2 - kx - 0.025) < 1e-3 || Math.abs(k2 - kx) < 0.0251 && onGrid(k2), `with snap on an arrow moves one grid step and stays on the grid (${kx} → ${k2})`);
await page.keyboard.press('Control+z');
await settle(page, 150);
eq((await wdata('wa')).x, kx, 'Ctrl+Z undoes a snapped nudge to where it was');

// ── minimize to a chip ───────────────────────────────────────────────
console.log(' minimize');
const fullH = (await node('wb').boundingBox()).height;
await node('wb').locator('.w-min').click();
await settle(page, 200);
ok((await wdata('wb')).min === true, 'minimize is on the widget record');
ok(await node('wb').evaluate((n) => n.classList.contains('is-min')), 'and the widget is a chip');
const chipH = (await node('wb').boundingBox()).height;
ok(chipH < 60 && chipH < fullH / 3, `the chip is only its title bar (${Math.round(chipH)}px of ${Math.round(fullH)}px)`);
ok(await node('wb').locator('.w-body').isHidden(), 'the body is hidden');
eq(await node('wb').locator('.w-min').getAttribute('aria-label'), 'Restore Timer', 'the button says it restores');
await page.waitForTimeout(500);
eq((await stored()).screens[0].widgets.find((w) => w.id === 'wb').min, true, 'saved');
await page.reload(); await settle(page, 400);
ok(await node('wb').evaluate((n) => n.classList.contains('is-min')), 'a reload brings the chip back');
// a chip still works: Space runs the timer on top, even minimized
await page.keyboard.press('Space');
await settle(page, 400);
ok((await wdata('wb')).data.endsAt > 0, 'Space still starts a minimized timer');
await page.keyboard.press('Space');
await settle(page, 300);
// spotlight lifts a chip over the board with its body
await node('wb').locator('.w-fill').click();
await settle(page, 200);
let box = await node('wb').boundingBox(), bb = await page.locator('#board').boundingBox();
ok(box.width > bb.width * 0.95 && box.height > bb.height * 0.95, 'spotlight fills the board with a minimized widget');
ok(await node('wb').locator('.w-body').isVisible(), 'and shows its body');
await page.keyboard.press('Escape');
await settle(page, 150);
ok(await node('wb').locator('.w-body').isHidden(), 'Esc puts it back to a chip');
// present mode takes a chip off the projector
await page.click('#presentBtn');
await settle(page, 150);
ok(await node('wb').isHidden(), 'present mode hides a chip');
ok(await node('wa').isVisible(), 'and keeps the others');
await page.keyboard.press('Space');
await settle(page, 300);
ok((await wdata('wb')).data.endsAt > 0, 'a hidden chip can still be started with Space');
await page.keyboard.press('Space');
await page.keyboard.press('Control+z');
await settle(page, 150);
ok((await wdata('wb')).min === true, 'Ctrl+Z does nothing in present mode');
await page.keyboard.press('Escape');
await settle(page, 150);
ok(await node('wb').isVisible(), 'leaving present mode brings the chip back');
await node('wb').locator('.w-min').click();       // restore, then minimize again: the reload above emptied the undo list
await page.waitForTimeout(1600);                  // past the 1.5 s window in which a burst is one step
await node('wb').locator('.w-min').click();
await settle(page, 150);
ok((await wdata('wb')).min === true, 'minimized again');
await page.keyboard.press('Control+z');
await settle(page, 200);
ok(!(await wdata('wb')).min, 'Ctrl+Z restores a minimized widget');
ok(await node('wb').locator('.w-body').isVisible(), 'with its body');
await node('wb').locator('.w-min').click();
await settle(page, 150);
await page.click('#toastUndo');
await settle(page, 150);
ok(!(await wdata('wb')).min, 'the toast Undo restores it too');
ok(!('min' in (await wdata('wb'))), 'and the field is gone, not false');

// ── a colour per widget ──────────────────────────────────────────────
console.log(' colour');
await node('wb').locator('.w-min').click();       // the timer sits over the text widget's title bar after the snap tests
await page.waitForTimeout(1600);
const seen = [];
for (let i = 0; i < 5; i++) {
  await node('wa').locator('.w-hue').click();
  await page.waitForTimeout(80);
  seen.push((await wdata('wa')).color || '');
  await page.waitForTimeout(1600);               // past the 1.5 s coalescing window
}
eq(seen, ['blue', 'slate', 'warm', 'info', ''], 'the colour button cycles through four colours and back to none');
ok(!('color' in (await wdata('wa'))), 'none removes the field');
await node('wa').locator('.w-hue').click();
await page.waitForTimeout(80);
await node('wa').locator('.w-hue').click();
await page.waitForTimeout(80);
eq((await wdata('wa')).color, 'slate', 'two quick taps give slate');
await page.keyboard.press('Control+z');
await settle(page, 150);
ok(!('color' in (await wdata('wa'))), 'and one Ctrl+Z undoes both taps (a burst is one step)');
await node('wa').locator('.w-hue').click();
await settle(page, 700);
eq((await stored()).screens[0].widgets.find((w) => w.id === 'wa').color, 'blue', 'a colour is saved');
await page.click('#presentBtn');
await settle(page, 150);
ok(await node('wa').getAttribute('data-color') === 'blue', 'present mode keeps the colour');
ok(await node('wa').locator('.w-hue').isHidden(), 'and hides the colour button');
await node('wa').locator('.w-hue').evaluate((b) => b.click());     // a script cannot get round it either
await node('wa').locator('.w-min').evaluate((b) => b.click());
await settle(page, 150);
const lockd = await wdata('wa');
ok(lockd.color === 'blue' && !lockd.min, 'neither a colour nor a minimize changes in present mode');
await page.keyboard.press('Escape');
await settle(page, 100);
await page.reload(); await settle(page, 400);
eq(await node('wa').getAttribute('data-color'), 'blue', 'a reload keeps the colour');

// contrast of what is read, light and dark, normal and projector
const lum = (rgb) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const ratio = (p, q) => { const a1 = lum(p), b1 = lum(q); return (Math.max(a1, b1) + 0.05) / (Math.min(a1, b1) + 0.05); };
const paint = (sel, what) => page.evaluate(([s, w]) => {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d', { willReadFrequently: true });
  const px = (css) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillRect(0, 0, 1, 1); g.fillStyle = css; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const n = document.querySelector(s);
  const cs = getComputedStyle(n);
  return px(w === 'bg' ? cs.backgroundColor : cs.color);
}, [sel, what]);
const colours = ['', 'blue', 'slate', 'warm', 'info'];
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  for (const proj of [false, true]) {
    await page.evaluate((on) => document.body.classList.toggle('projector', on), proj);
    for (const c of colours) {
      await page.evaluate(([cc]) => {
        const n = document.querySelector('.w[data-id="wa"]');
        if (cc) n.setAttribute('data-color', cc); else n.removeAttribute('data-color');
      }, [c]);
      const need = proj ? 7 : 4.5;
      const bar = await paint('.w[data-id="wa"] .w-bar', 'bg'), grip = await paint('.w[data-id="wa"] .w-grip', 'color');
      const body = await paint('.w[data-id="wa"]', 'bg'), ink = await paint('.w[data-id="wa"] .w-body', 'color');
      const r1 = ratio(bar, grip), r2 = ratio(body, ink);
      ok(r1 >= need, `${theme}${proj ? ' projector' : ''} ${c || 'no colour'}: the title reads ${r1.toFixed(1)}:1 (needs ${need})`);
      ok(r2 >= need, `${theme}${proj ? ' projector' : ''} ${c || 'no colour'}: the body text reads ${r2.toFixed(1)}:1 (needs ${need})`);
    }
  }
}
await page.evaluate(() => { document.body.classList.remove('projector'); document.documentElement.setAttribute('data-theme', 'light'); });
await page.evaluate(() => { const n = document.querySelector('.w[data-id="wa"]'); n.setAttribute('data-color', 'blue'); });

// ── screen thumbnails ────────────────────────────────────────────────
console.log(' thumbnails');
await page.evaluate(() => { const s = __classScreen.state(); void s; });
page.once('dialog', (d) => d.accept('Second screen'));
await page.click('#newScreenBtn');
await settle(page, 300);
await page.click('button[data-add="clock"]');
await settle(page, 400);
await page.click('#shotsBtn');
await settle(page, 200);
ok(await page.locator('#shotsDialog').evaluate((d) => d.open), 'the Screens button opens the picture list');
const shots = page.locator('#shotsList .shot-btn');
eq(await shots.count(), 2, 'one picture per screen');
eq(await shots.nth(0).locator('.shot-name').textContent(), 'Old screen', 'named');
eq(await shots.nth(0).locator('.shot-meta').textContent(), '2 widgets', 'with its count');
eq(await shots.nth(1).locator('.shot-meta').textContent(), '1 widget', 'singular for one');
eq(await shots.nth(1).getAttribute('aria-current'), 'true', 'the screen on the board is marked');
eq(await shots.nth(0).getAttribute('aria-current'), 'false', 'and the other is not');
eq(await shots.nth(0).locator('.shot-w').count(), 2, 'a tile per widget');
ok(await shots.nth(0).locator('.shot-w[data-color="blue"]').count() === 1, 'a coloured widget is tinted in its picture');
const tile = await shots.nth(0).locator('.shot-w').first().evaluate((n) => n.style.left + '|' + n.style.width);
ok(/%/.test(tile), 'tiles are placed by fraction, as the board is');
const v1 = await a11yScan(page);
eq(v1.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations with the pictures open');
await page.keyboard.press('Escape');
await settle(page, 150);
ok(!(await page.locator('#shotsDialog').evaluate((d) => d.open)), 'Esc closes it');
ok(await page.evaluate(() => document.activeElement.id === 'shotsBtn'), 'and focus returns to the button');
await page.click('#shotsBtn');
await shots.nth(0).click();
await settle(page, 300);
eq((await st()).current, 's1', 'picking a picture switches to that screen');
ok(await page.evaluate(() => !document.getElementById('shotsDialog').open), 'and closes the list');
await page.keyboard.press('ArrowRight');
await settle(page, 300);
ok((await st()).current !== 's1', 'ArrowRight still goes to the next screen');
await page.keyboard.press('ArrowLeft');
await settle(page, 300);

// ── projector theme ──────────────────────────────────────────────────
console.log(' projector theme');
const themeBefore = await html();
const small = await node('wb').locator('.w-foot button').first().evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
await page.check('#projectorToggle');
await settle(page, 600);
ok(await page.evaluate(() => document.body.classList.contains('projector')), 'the page takes the projector class');
eq(await html(), themeBefore, 'and the theme attribute on <html> is untouched (a11y.js owns it)');
eq((await stored()).projector, true, 'the switch is saved');
const big = await node('wb').locator('.w-foot button').first().evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
ok(big > small * 1.2, `buttons and notes are bigger (${small}px → ${big}px)`);
const bw = await node('wa').evaluate((n) => parseFloat(getComputedStyle(n).borderTopWidth));
ok(bw >= 3, 'with a heavier border');
await node('wa').locator('.w-grip').focus();
await page.keyboard.press('Shift+Tab');            // focus-visible needs focus that came from the keyboard
await page.keyboard.press('Tab');
const ow = await node('wa').locator('.w-grip').evaluate((n) => parseFloat(getComputedStyle(n).outlineWidth));
ok(ow >= 5, `focus is a ${ow}px ring`);
await page.reload(); await settle(page, 400);
ok(await page.locator('#projectorToggle').isChecked() && await page.evaluate(() => document.body.classList.contains('projector')), 'a reload keeps it');
// every comfort together: present mode, spotlight, a minimized widget, snap
await page.click('#presentBtn');
await settle(page, 150);
ok(await node('wa').isVisible(), 'the projector theme shows in present mode');
const v2 = await a11yScan(page);
eq(v2.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations in present mode with the projector theme');
await page.keyboard.press('Escape');
// typing in a box fires no shortcut and moves nothing
await node('wa').locator('textarea').fill('');
await node('wa').locator('textarea').focus();
const scr = (await st()).current;
await page.keyboard.type('n ?');
await page.keyboard.press('ArrowLeft');
eq([(await st()).current, await page.locator('#keysDialog').evaluate((d) => d.open)], [scr, false], 'typing in a text box fires no shortcut');
await page.uncheck('#projectorToggle');
await settle(page, 600);
ok(!('projector' in (await stored())), 'turning it off removes the field');
await page.uncheck('#snapToggle');
await settle(page, 600);
ok(!('snap' in (await stored())), 'and so does snap');

// ── a phone, and no errors ───────────────────────────────────────────
for (const width of [360, 1400]) {
  await page.setViewportSize({ width, height: 740 });
  await settle(page, 200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
}
await page.setViewportSize({ width: 360, height: 740 });
await page.click('#shotsBtn');
await settle(page, 200);
ok(await page.evaluate(() => { const d = document.getElementById('shotsDialog'); const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }), 'the picture list fits a 360px phone');
await page.keyboard.press('Escape');
const v3 = await a11yScan(page);
eq(v3.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations at 360px');
eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
