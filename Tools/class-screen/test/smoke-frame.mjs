// smoke-frame.mjs — 087 Class Screen, Path 22 P12 (another site tool as a widget).
//
//   node Tools/class-screen/test/smoke-frame.mjs
//
// A "Site tool" widget shows 024 Number Talks or 080 Virtual Manipulatives in a
// same-origin frame. The list is fixed: the widget saves an id and the address
// is built from the list, so no stored value, file or link can point the frame
// elsewhere. This drives the real pages in the frame, then the new widget through
// present mode, spotlight, undo, the shortcuts and P11's comforts. Nothing here
// uses a real student's name.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';

const PORT = 8653;
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

console.log('Class Screen — a site tool in a frame');

// ── the site's frame rules, read first ───────────────────────────────
console.log(' frame and CSP rules');
{
  const tools = path.join(SITE, 'Tools');
  const pages = fs.readdirSync(tools).filter((f) => f.endsWith('.html'));
  const rule = /Content-Security-Policy|frame-ancestors|X-Frame-Options/i;
  const withRule = pages.filter((f) => rule.test(fs.readFileSync(path.join(tools, f), 'utf8')));
  eq(withRule, [], 'no tool page sets a CSP or a frame rule (if one does, check the Site tool widget before shipping it)');
  ok(!fs.existsSync(path.join(SITE, '_headers')), 'no _headers file sets one for the host');
  const busting = pages.filter((f) => /window\.top\b|top\.location|self\s*!==\s*top|window\.parent\b/.test(fs.readFileSync(path.join(tools, f), 'utf8')));
  eq(busting, [], 'no tool page looks at its parent or tries to break out of a frame');
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  ['024-number-talks-board.html', '080-virtual-manipulatives-board.html'].forEach((f) => ok(sw.includes('"Tools/' + f + '"'), `${f} is precached, so its frame works offline`));
}

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page, 400);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const frames = async () => (await cur()).widgets.filter((w) => w.type === 'frame');
const widgetNode = (id) => page.locator(`#board .w[data-id="${id}"]`);
const add = async () => { await page.click('#dock button[data-add="frame"]'); await settle(page, 450); };
const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, KEY);

// ── the chooser ──────────────────────────────────────────────────────
console.log(' choosing a tool');
await add();
let w1 = (await frames())[0];
eq(w1.data, { tool: '' }, 'a new Site tool has nothing chosen');
const n1 = widgetNode(w1.id);
eq(await n1.locator('iframe').count(), 0, 'and no frame yet');
eq(await n1.locator('button[data-tool]').allTextContents(), ['024 Number Talks', '080 Virtual Manipulatives'], 'it offers the two tools on the list, as buttons, not a box to type an address in');
eq(await n1.locator('input, textarea').count(), 0, 'there is no field to type an address into');
await n1.locator('button[data-tool="024"]').click();
await settle(page, 1500);
eq((await frames())[0].data, { tool: '024' }, 'the widget saves the tool\'s id and nothing else');
const f1 = n1.locator('iframe');
eq(await f1.count(), 1, 'a frame appears');
eq(await f1.getAttribute('src'), '024-number-talks-board.html', 'at the list\'s file, a bare relative name');
const sandbox = (await f1.getAttribute('sandbox')).split(/\s+/).sort();
eq(sandbox, ['allow-downloads', 'allow-modals', 'allow-same-origin', 'allow-scripts'], 'sandboxed with scripts, its own storage, dialogs and downloads, and nothing else');
ok(!sandbox.some((t) => /top-navigation|popups|forms|pointer-lock|presentation/.test(t)), 'no top navigation, popups, forms or pointer lock');
eq(await f1.getAttribute('referrerpolicy'), 'no-referrer', 'sends no referrer');
ok(/Number Talks/.test(await f1.getAttribute('title')), 'the frame has a title for a screen reader');
const inner = page.frames().find((fr) => /024-number-talks-board/.test(fr.url()));
ok(!!inner, 'the tool loaded in the frame');
eq(new URL(inner.url()).origin, new URL(BASE).origin, 'from this site\'s own origin');
eq(await inner.title(), 'Number Talks / Mental Math Routine Board', 'with its own title');
ok(await inner.locator('#modeStringsBtn').isVisible(), 'and its page is there to use');
await inner.locator('#modeDotsBtn').click();
await settle(page, 300);
ok(await inner.locator('#modeDotsBtn').evaluate((b) => b.classList.contains('active')), 'a click inside the frame reaches the tool');

// a second tool, and the one-per-tool rule
await add();
const w2 = (await frames())[1];
const n2 = widgetNode(w2.id);
ok(await n2.locator('button[data-tool="024"]').isDisabled(), 'a tool already on this screen cannot be chosen twice');
ok(/already on this screen/.test(await n2.locator('button[data-tool="024"]').textContent()), 'and says why');
await n2.locator('button[data-tool="080"]').click();
await settle(page, 1500);
const inner2 = page.frames().find((fr) => /080-virtual-manipulatives/.test(fr.url()));
ok(!!inner2, 'the second tool loads');
await inner2.locator('button[data-add="hundred"]').click();
await settle(page, 1500);
const vmb = await page.evaluate(() => localStorage.getItem('vmb_working_v1'));
ok(vmb && /hundred/.test(vmb), 'work done inside the frame is saved under the tool\'s own key, as it is on its own page');
const saved = JSON.stringify(await stored());
ok(!/hundred|vmb_/.test(saved), 'and none of it is in Class Screen\'s board');
ok(!/https?:|\/\//.test(saved), 'which holds no address at all');

// ── a reload, and a state that tries to point the frame elsewhere ─────
console.log(' hostile saved values');
await settle(page, 600);
await page.reload(); await settle(page, 1500);
eq(await page.locator('#board iframe').count(), 2, 'a reload brings both frames back');
const hostile = await stored();
hostile.screens[0].widgets.find((w) => w.id === w1.id).data = { tool: 'https://evil.example/x', src: 'https://evil.example/y' };
hostile.screens[0].widgets.find((w) => w.id === w2.id).data = { tool: '../index.html' };
await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify({ v: 1, data: d })), [KEY, hostile]);
await page.reload(); await settle(page, 800);
eq(await page.locator('#board iframe').count(), 0, 'a stored address or path opens no frame');
eq(await page.locator('#board button[data-tool]').count(), 4, 'both widgets are back at the chooser');
eq(page.frames().filter((fr) => fr !== page.mainFrame()).map((fr) => fr.url()), [], 'and nothing else was loaded');
// and the guard against a frame that wandered
await page.locator('#board button[data-tool="024"]').first().click();
await settle(page, 1500);
const wander = page.frames().find((fr) => /024-number-talks-board/.test(fr.url()));
await wander.locator('a.back-link').click();
await settle(page, 2500);
const where = page.frames().filter((fr) => fr !== page.mainFrame()).map((fr) => new URL(fr.url()).pathname);
eq(where, ['/Tools/024-number-talks-board.html'], 'a frame that follows a link out of its tool is sent back to it');

// ── through P6-P11: present, spotlight, undo, shortcuts, comforts ─────
console.log(' present, spotlight, undo, shortcuts, comforts');
const live = (await frames())[0];
const ln = widgetNode(live.id);
await page.click('#dock button[data-add="timer"]');
await settle(page, 400);
const timer = (await cur()).widgets.find((w) => w.type === 'timer');
const tn = widgetNode(timer.id);
await tn.locator('.w-min').click();                // a chip, so it does not sit over the frame
await page.waitForTimeout(1600);
// clicking inside a frame raises its widget
const zBefore = (await cur()).widgets.find((w) => w.id === live.id).z;
const topZ = Math.max(...(await cur()).widgets.map((w) => w.z));
ok(zBefore < topZ, 'the frame widget is not on top to begin with');
await ln.locator('iframe').click({ position: { x: 300, y: 250 } });
await settle(page, 300);
const zAfter = (await cur()).widgets.find((w) => w.id === live.id).z;
ok(zAfter > topZ - 1 && zAfter >= topZ, `a click inside the frame brings its widget to the front (z ${zBefore} → ${zAfter})`);
// the page's shortcuts belong to the page, not the frame
await page.mouse.click(5, 450);                    // focus back on the board
await page.keyboard.press('Space');
await settle(page, 300);
ok((await cur()).widgets.find((w) => w.id === timer.id).data.endsAt > 0, 'Space still starts the timer on top while a frame is on the board');
await page.keyboard.press('Space');
// colour, minimize and snap work on a frame widget, and undo them
await ln.locator('.w-hue').click();
eq((await cur()).widgets.find((w) => w.id === live.id).color, 'blue', 'a frame widget takes a colour');
await page.waitForTimeout(1600);
await ln.locator('.w-min').click();
await settle(page, 200);
ok(await ln.evaluate((n) => n.classList.contains('is-min')), 'and minimizes to a chip');
ok(!(await ln.locator('iframe').isVisible()), 'the frame is out of sight');
await page.keyboard.press('Control+z');
await settle(page, 200);
ok(await ln.locator('iframe').isVisible(), 'Ctrl+Z brings it back');
ok(await ln.locator('iframe').evaluate((f) => f.contentDocument && f.contentDocument.readyState === 'complete'), 'with the tool still loaded');
await page.check('#snapToggle');
await page.check('#projectorToggle');
await settle(page, 300);
// spotlight
await ln.locator('.w-fill').click();
await settle(page, 300);
const fb = await ln.boundingBox(), bb = await page.locator('#board').boundingBox();
ok(fb.width > bb.width * 0.95 && fb.height > bb.height * 0.9, 'spotlight fills the board with the frame');
const ib = await ln.locator('iframe').boundingBox();
ok(ib.width > bb.width * 0.9 && ib.height > bb.height * 0.7, 'and the tool inside grows with it');
await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await ln.evaluate((n) => n.classList.contains('spot'))), 'Esc steps back out');
// present mode
await page.click('#presentBtn');
await settle(page, 300);
ok(await ln.locator('iframe').isVisible(), 'present mode shows the frame');
ok(await ln.locator('.frame-foot').isHidden(), 'without its Reload and Change tool buttons');
ok(await ln.locator('.w-bar').isHidden(), 'or its title bar');
const v1 = await a11yScan(page);
eq(v1.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations in present mode with a frame');
await page.click('#presentExit');
await settle(page, 200);
// change tool, reload
await ln.locator('.frame-foot button', { hasText: 'Change tool' }).click();
await settle(page, 200);
eq(await ln.locator('iframe').count(), 0, 'Change tool goes back to the list');
eq((await cur()).widgets.find((w) => w.id === live.id).data.tool, '024', 'and keeps the choice until another is made');
await ln.locator('button[data-tool="024"]').click();
await settle(page, 1200);
ok(await ln.locator('iframe').count() === 1, 'choosing again shows it');

// ── offline: a tool the worker has not stored shows a note, not an error page ──
console.log(' offline');
await page.context().setOffline(true);
await ln.locator('.frame-foot button', { hasText: 'Change tool' }).click();    // a frame already on show is left alone when the line drops; choosing again asks the question
await ln.locator('button[data-tool="024"]').click();
await settle(page, 600);
ok(/not saved for offline use/.test(await ln.textContent()), 'offline and not cached: a note says to open it once online');
eq(await ln.locator('iframe').count(), 0, 'and there is no broken frame');
await page.evaluate(async () => { const c = await caches.open('aplp-test'); await c.put(new URL('024-number-talks-board.html', location.href).href, new Response('<title>x</title>')); });
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await settle(page, 600);
ok(!/not saved for offline use/.test(await ln.textContent()), 'with the page cached the not-saved note goes');
ok(await ln.locator('.site-frame').count() === 1 || /could not be shown/.test(await ln.textContent()), 'and the widget tries the frame');
await page.context().setOffline(false);
await page.evaluate(() => caches.delete('aplp-test'));
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await settle(page, 1200);

// ── 360px and no errors ──────────────────────────────────────────────
await page.setViewportSize({ width: 360, height: 740 });
await settle(page, 300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 360px');
const v2 = await a11yScan(page);
eq(v2.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations at 360px');
eq(page.__errs.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)), [], 'no page or console errors, in the board or in the frames (apart from the requests the offline step cut on purpose)');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
