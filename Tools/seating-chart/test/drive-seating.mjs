// drive-seating.mjs — the Seating Chart Generator in a real browser.
//
//   node Tools/seating-chart/test/drive-seating.mjs
//
// The Node suite next door covers the arithmetic. This covers the wiring, which
// is the half that a pure test is blind to (handoff v7 §3): a chart built by
// clicking, a reload that has to bring it back, a real file picker, a corrupt
// file that has to be refused, a browser with storage switched off, and the
// printed page. Headless, so it does not fight `npm run games` for the screen.
//
// Exits 1 on any failure. Screenshots and the printed PDF land in shots/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots');
const PORT = 8146;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const NAMES = [
  'Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells', 'Hypatia Alexandria',
  'Sequoyah Guess', 'Nellie Bly', 'Bessie Coleman', 'Rosalind Franklin', 'Sojourner Truth',
  'Zheng He', 'Grace Hopper', 'Katsushika Hokusai', 'Wangari Maathai', 'Alan Turing',
  'Amelia Earhart', 'Benjamin Banneker', 'Clara Barton', 'Diego Rivera', 'Elena Cornaro',
  'Fatima al-Fihri', 'Garrett Morgan', 'Harriet Tubman', 'Isaac Newton', 'Jane Goodall',
  'Kwame Nkrumah', 'Lise Meitner', 'Malala Yousafzai',
];

const server = await serve(PORT);
const browser = await launch();

/** Read what the page has in localStorage under the permanent key. */
const stored = page => page.evaluate(() => {
  const raw = localStorage.getItem('seating-chart-v1');
  return raw ? JSON.parse(raw) : null;
});

/**
 * Build a room shaped like a real one: 28 students, a 6x5 grid with the back
 * corner missing, a pod of four off to one side, and more desks than students so
 * some seats stay empty. This is the chart everything below is measured against.
 */
async function buildChart(page) {
  await page.evaluate(names => { document.getElementById('nameInput').value = names.join('\n'); }, NAMES);
  await page.click('button[onclick="addNames()"]');
  await page.click('button[onclick="makeGrid()"]');            // 30 desks
  await page.evaluate(() => {
    const desks = [...document.querySelectorAll('.desk')];
    desks[29].querySelector('.desk-ctrl[data-act="del"]').click();
  });
  await page.evaluate(() => {
    const desks = [...document.querySelectorAll('.desk')];
    desks[28].querySelector('.desk-ctrl[data-act="del"]').click();
  });                                                          // 28 desks
  await page.click('button[onclick="addPod()"]');              // 32 desks, 4 spare
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 300);
}

/* ============================================================ boot + build */
{
  const page = await prepPage(browser, BASE, { width: 1440, height: 1000, dsf: 1 });
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 400);

  ok(await page.isHidden('#bootWarn'), 'the modules loaded, so the boot warning stays hidden');
  eq((await page.$$('.sec-tab')).length, 3, 'three section tabs on a first visit');
  eq(await page.textContent('#rosterCount'), '0', 'a first visit has an empty roster');
  ok(await page.isHidden('#moreBtn'), 'the toolbar\'s More button is a phone-only control');

  // Fonts: vendored, and nothing reached out for them.
  const fontsUsed = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      fraunces: document.fonts.check('600 21px Fraunces'),
      spline: document.fonts.check('600 13px "Spline Sans"'),
      // A variable font renders 400 and 700 at different widths; a single static
      // weight faking it would measure identically.
      thin: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '300 40px "Spline Sans"'; return c.measureText('Malala Yousafzai').width; })(),
      thick: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '700 40px "Spline Sans"'; return c.measureText('Malala Yousafzai').width; })(),
    };
  });
  ok(fontsUsed.fraunces, 'Fraunces is loaded from the vendored file');
  ok(fontsUsed.spline, 'Spline Sans is loaded from the vendored file');
  ok(fontsUsed.thick > fontsUsed.thin, 'Spline Sans really is variable: 700 is wider than 300');
  eq(page.__blocked.length, 0, 'nothing offsite was requested');
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));

  await buildChart(page);
  const built = await page.evaluate(() => ({
    desks: document.querySelectorAll('.desk').length,
    seated: document.querySelectorAll('.desk.assigned').length,
    empty: document.querySelectorAll('.desk.empty').length,
    pool: document.querySelectorAll('.chip').length,
    status: document.getElementById('status').textContent,
  }));
  eq(built.desks, 32, '32 desks: a 6x5 grid, two corners removed, plus a pod of four');
  eq(built.seated, 28, 'all 28 students are seated');
  eq(built.empty, 4, 'the four spare desks stay empty rather than being padded out');
  eq(built.pool, 0, 'nobody is left in the pool');

  await page.screenshot({ path: path.join(SHOTS, 'chart-screen.png') });

  /* ---------------------------------------------- autosave and reload ---- */
  await settle(page, 1500);   // autosave coalesces at 1200ms
  const save = await stored(page);
  ok(save, 'a chart was written to localStorage without anyone pressing save');
  eq(save.__v, 1, 'the save carries the schema version');
  eq(save.sections.length, 3, 'all three sections are in the save');
  eq(save.sections[0].students.length, 28, 'the roster is in the save');
  eq(Object.keys(save.sections[0].assign).length, 28, 'the seat assignment is in the save');

  await page.reload({ waitUntil: 'load' });
  await settle(page, 500);
  const after = await page.evaluate(() => ({
    desks: document.querySelectorAll('.desk').length,
    seated: document.querySelectorAll('.desk.assigned').length,
    roster: document.getElementById('rosterCount').textContent,
    names: [...document.querySelectorAll('.desk .seat')].map(b => b.textContent).sort().join('|'),
    status: document.getElementById('status').textContent,
  }));
  eq(after.desks, 32, 'the desks came back after a reload');
  eq(after.seated, 28, 'every student came back in their seat');
  eq(after.roster, '28', 'the roster came back');
  ok(/Reloaded 3 sections and 28 students/.test(after.status), 'the page says what it restored');

  /* -------------------------------------------------------------- print -- */
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await settle(page, 300);
  const printBox = await page.evaluate(() => {
    const desks = [...document.querySelectorAll('.desk')].map(d => d.getBoundingClientRect());
    const wrap = document.getElementById('floorWrap').getBoundingClientRect();
    return {
      head: getComputedStyle(document.getElementById('printHead')).display,
      title: document.getElementById('printTitle').textContent,
      meta: document.getElementById('printMeta').textContent,
      sidebar: getComputedStyle(document.querySelector('.sidebar')).display,
      wrapW: Math.round(wrap.width), wrapH: Math.round(wrap.height),
      right: Math.round(Math.max(...desks.map(d => d.right))),
      bottom: Math.round(Math.max(...desks.map(d => d.bottom))),
      bodyW: document.body.scrollWidth,
      flagShadow: getComputedStyle(document.querySelector('.desk')).boxShadow,
    };
  });
  eq(printBox.head, 'block', 'the print header appears in print media');
  eq(printBox.sidebar, 'none', 'the sidebar does not print');
  ok(/Honors GT/.test(printBox.title), 'the printed title is the section name');
  ok(/28 seated of 28/.test(printBox.meta), 'the printed header counts the seats');
  ok(/desks/.test(printBox.meta), 'the printed header counts the desks');
  ok(printBox.wrapW <= 979, `the trimmed chart fits the printable width (${printBox.wrapW} <= 979)`);
  ok(printBox.wrapH <= 700, `and the printable height (${printBox.wrapH} <= 700)`);
  ok(printBox.right <= printBox.bodyW, 'no desk hangs off the right edge of the page');
  eq(printBox.flagShadow, 'none', 'desk shadows and flag outlines are dropped for print');

  // Chrome's dialog opens portrait. preferCSSPageSize honours the @page rule, so
  // this is the paper a teacher actually gets from Ctrl+P.
  await page.pdf({ path: path.join(SHOTS, 'chart-print.pdf'), preferCSSPageSize: true, printBackground: true });
  const pdf = fs.readFileSync(path.join(SHOTS, 'chart-print.pdf'));
  ok(pdf.length > 5000, 'the printed PDF has content');
  const raw = pdf.toString('latin1');
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  eq(pages, 1, 'one class, one page');
  // The paper itself. Chrome's dialog defaults to portrait, and portrait is what
  // used to slice the last column of desks off the sheet. `@page {size: letter
  // landscape}` is the fix, and a MediaBox wider than it is tall is the proof.
  const media = raw.match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/);
  ok(media, 'the PDF declares a page size');
  if (media) {
    const [w, h] = [parseFloat(media[1]), parseFloat(media[2])];
    ok(w > h, `the page comes out landscape without anyone changing a setting (${Math.round(w)}x${Math.round(h)}pt)`);
  }
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await settle(page, 200);
  const restored = await page.evaluate(() => ({
    floorW: document.getElementById('floor').style.width,
    layer: document.getElementById('deskLayer').style.transform,
  }));
  eq(restored.floorW, '', 'the screen layout is put back after printing');
  eq(restored.layer, '', 'and the desks are un-shifted');

  /* ----------------------------------------------- desk drag with zoom --- */
  // The floor is scaled to fit the window, so a drag has to divide screen pixels
  // by that scale or every desk lands somewhere else.
  const fit = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fscale').trim());
  ok(parseFloat(fit) < 1, `the floor is scaled to fit the window (${fit})`);
  // Grab the desk by its edge, not by the name: dragging the name is the HTML5
  // student drag, which is what a teacher moving a person uses.
  const before = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.desk')][0];
    const r = d.getBoundingClientRect();
    return { id: d.dataset.id, cx: r.left + 5, cy: r.top + 5, mid: r.left + r.width / 2, midY: r.top + r.height / 2 };
  });
  await page.mouse.move(before.cx, before.cy);
  await page.mouse.down();
  await page.mouse.move(before.cx + 120, before.cy + 60, { steps: 8 });
  await page.mouse.up();
  await settle(page, 200);
  const moved = await page.evaluate(id => {
    const d = [...document.querySelectorAll('.desk')].find(e => e.dataset.id === id);
    const r = d.getBoundingClientRect();
    return { cx: r.left + 5, cy: r.top + 5 };
  }, before.id);
  const dx = moved.cx - before.cx, dy = moved.cy - before.cy;
  ok(Math.abs(dx - 120) < 26 && Math.abs(dy - 60) < 26,
    `a dragged desk follows the pointer on a scaled floor (moved ${Math.round(dx)},${Math.round(dy)} for a 120,60 drag)`);

  /* ------------------------------------------------- keyboard-only path -- */
  const kb = await page.evaluate(() => {
    const seats = [...document.querySelectorAll('.desk .seat')];
    return { count: seats.length, focusable: seats.every(s => s.tabIndex >= 0), labelled: seats.every(s => s.getAttribute('aria-label')) };
  });
  eq(kb.count, 32, 'every desk has a focusable seat control');
  ok(kb.focusable, 'every seat is in the tab order');
  ok(kb.labelled, 'every seat carries an aria-label with the name in it');

  // Pick a student up with Enter, put them down two desks along, and confirm the swap.
  const swap = await page.evaluate(() => {
    const seated = [...document.querySelectorAll('.desk.assigned .seat')];
    const idA = seated[0].dataset.id, idB = seated[2].dataset.id;
    const nameA = seated[0].textContent, nameB = seated[2].textContent;
    const seat = id => document.querySelector(`.seat[data-id="${id}"]`);
    const press = id => { seat(id).focus(); seat(id).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
    press(idA);   // pick up
    press(idB);   // put down on an occupied desk: the two swap
    return { nameA, nameB, nowA: seat(idA).textContent, nowB: seat(idB).textContent };
  });
  eq(swap.nowB, swap.nameA, 'Enter, Enter moves a student to another desk with the keyboard alone');
  eq(swap.nowA, swap.nameB, 'and the student who was there swaps back');

  // R rotates, P pins, arrows nudge — all on the focused seat.
  const keys = await page.evaluate(() => {
    const seat = document.querySelector('.desk .seat');
    const id = seat.dataset.id;
    const fire = k => document.querySelector(`.seat[data-id="${id}"]`)
      .dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const box = () => document.querySelector(`.seat[data-id="${id}"]`).closest('.desk');
    const x0 = parseFloat(box().style.left);
    fire('r'); const rot = box().style.transform;
    fire('p'); const pinned = box().classList.contains('locked');
    fire('ArrowRight'); const x1 = parseFloat(box().style.left);
    return { rot, pinned, moved: x1 - x0 };
  });
  ok(/rotate\(90deg\)/.test(keys.rot), 'R rotates the focused desk');
  ok(keys.pinned, 'P pins the focused desk');
  eq(keys.moved, 22, 'ArrowRight nudges the desk one grid step');

  /* --------------------------------------------- two sections at once ---- */
  // Three sections is the whole reason this tool exists rather than one chart, so
  // the second one has to not step on the first.
  const twoUp = await page.evaluate(async () => {
    const tabs = () => [...document.querySelectorAll('.sec-tab')];
    const firstDesks = document.querySelectorAll('.desk').length;
    const firstNames = [...document.querySelectorAll('.desk.assigned .seat')].map(s => s.textContent).sort().join('|');
    tabs()[1].click();                                   // Honors
    const emptyOnArrival = document.querySelectorAll('.desk').length;
    document.getElementById('nameInput').value = 'Ida B Wells\nBessie Coleman\nZheng He\nGrace Hopper';
    document.querySelector('button[onclick="addNames()"]').click();
    document.getElementById('gridCols').value = '2';
    document.getElementById('gridRows').value = '2';
    document.querySelector('button[onclick="makeGrid()"]').click();
    document.querySelector('button[onclick="autoAssign()"]').click();
    const secondDesks = document.querySelectorAll('.desk').length;
    tabs()[0].click();                                   // back to Honors GT
    return {
      firstDesks, firstNames, emptyOnArrival, secondDesks,
      backDesks: document.querySelectorAll('.desk').length,
      backNames: [...document.querySelectorAll('.desk.assigned .seat')].map(s => s.textContent).sort().join('|'),
    };
  });
  eq(twoUp.emptyOnArrival, 0, 'a second section starts with its own empty room');
  eq(twoUp.secondDesks, 4, 'and takes its own 2x2 grid');
  eq(twoUp.backDesks, twoUp.firstDesks, 'switching back finds the first room untouched');
  eq(twoUp.backNames, twoUp.firstNames, 'with the same students in the same seats');

  await settle(page, 1500);
  const bothSaved = await stored(page);
  eq(bothSaved.sections[0].students.length, 28, 'the save holds the first section');
  eq(bothSaved.sections[1].students.length, 4, 'and the second, side by side');
  eq(Object.keys(bothSaved.sections[1].assign).length, 4, 'with its own seating');

  /* ------------------------------------------------------- export a file - */
  const exported = await new Promise((resolve, reject) => {
    page.once('download', d => {
      const to = path.join(SHOTS, 'exported-chart.json');
      d.saveAs(to).then(() => resolve({ name: d.suggestedFilename(), path: to }), reject);
    });
    page.click('#saveBar [data-gvb="export"]').catch(reject);
    setTimeout(() => reject(new Error('no download event')), 8000);
  });
  ok(/^seating-chart-save-\d{4}-\d{2}-\d{2}\.json$/.test(exported.name),
    `the export is named for the tool and the day (${exported.name})`);
  const env = JSON.parse(fs.readFileSync(exported.path, 'utf8'));
  eq(env.format, 'gvb-save', 'the exported file carries the shared envelope');
  eq(env.game, 'seating-chart', 'and this tool\'s slug');
  eq(env.state.sections[0].students.length, 28, 'and the whole roster');

  /* -------------------------------- erase saved data, then import it back  */
  page.on('dialog', d => d.accept());
  await page.click('#saveBar [data-gvb="reset"]');
  await settle(page, 400);
  eq(await stored(page), null, 'Erase saved data really clears the key');
  const wiped = await page.evaluate(() => ({
    desks: document.querySelectorAll('.desk').length,
    roster: document.getElementById('rosterCount').textContent,
  }));
  eq(wiped.desks, 0, 'and the page comes back empty');
  eq(wiped.roster, '0', 'with no roster');
  // Erasing must not switch saving off for the rest of the session.
  await page.click('button[onclick="addDesk()"]');
  await settle(page, 1600);
  ok(await stored(page), 'the next change after an erase starts saving again');

  const chooser = page.waitForEvent('filechooser');
  await page.click('#saveBar [data-gvb="import"]');
  (await chooser).setFiles(exported.path);
  await settle(page, 600);
  const reimported = await page.evaluate(() => ({
    desks: document.querySelectorAll('.desk').length,
    seated: document.querySelectorAll('.desk.assigned').length,
    roster: document.getElementById('rosterCount').textContent,
    status: document.getElementById('status').textContent,
  }));
  eq(reimported.desks, 32, 'importing the file brings the desks back');
  eq(reimported.seated, 28, 'and every student is back in their seat');
  eq(reimported.roster, '28', 'and the roster is back');
  ok(await stored(page), 'an imported chart is written to storage too');

  /* ------------------------------------------------- a corrupt save file - */
  const junk = path.join(SHOTS, 'corrupt-chart.json');
  fs.writeFileSync(junk, '{"format":"gvb-save","game":"seating-chart","version":1,"state":{"sections":"Honors"}}');
  const chooser2 = page.waitForEvent('filechooser');
  await page.click('#saveBar [data-gvb="import"]');
  (await chooser2).setFiles(junk);
  await settle(page, 600);
  const afterJunk = await page.evaluate(() => ({
    desks: document.querySelectorAll('.desk').length,
    status: document.getElementById('status').textContent,
  }));
  eq(afterJunk.desks, 32, 'a corrupt file leaves the chart on screen alone');
  ok(/not a valid/i.test(afterJunk.status), `and says so out loud (${afterJunk.status.slice(-60)})`);

  /* --------------------------------------------- a corrupt localStorage -- */
  await page.evaluate(() => localStorage.setItem('seating-chart-v1', '{"sections":'));
  await page.reload({ waitUntil: 'load' });
  await settle(page, 500);
  const afterBadStore = await page.evaluate(() => ({
    warn: document.getElementById('bootWarn').hidden,
    tabs: document.querySelectorAll('.sec-tab').length,
    roster: document.getElementById('rosterCount').textContent,
    errs: null,
  }));
  ok(afterBadStore.warn, 'a corrupt localStorage does not stop the page from booting');
  eq(afterBadStore.tabs, 3, 'it starts fresh instead');
  eq(afterBadStore.roster, '0', 'with an empty roster rather than a crash');

  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no page errors or failed requests across the whole run' + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  const offsite = reqs.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  eq(offsite.length, 0, 'no request left the site' + (offsite.length ? ': ' + offsite.join(', ') : ''));
  await page.close();
}

/* ==================================================== storage blocked ==== */
{
  // Chrome with site data blocked throws on the `localStorage` property itself.
  // Reproduce that exactly, before any of the page's script runs.
  const page = await prepPage(browser, BASE, { width: 1280, height: 900, dsf: 1 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
    });
  });
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 500);

  ok(await page.isHidden('#bootWarn'), 'with storage blocked the page still boots');
  eq((await page.$$('.sec-tab')).length, 3, 'and still has its sections');
  const warned = await page.textContent('#privacyBox');
  ok(/blocking storage/i.test(warned), 'and tells the teacher storage is blocked');
  ok(/Save to file/.test(warned), 'and points at the file export instead');

  await page.evaluate(names => {
    document.getElementById('nameInput').value = names.join('\n');
  }, NAMES.slice(0, 6));
  await page.click('button[onclick="addNames()"]');
  await page.click('button[onclick="makeGrid()"]');
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 400);
  const still = await page.evaluate(() => document.querySelectorAll('.desk.assigned').length);
  eq(still, 6, 'and the tool works normally inside the session');
  await page.screenshot({ path: path.join(SHOTS, 'storage-blocked.png') });

  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no errors with storage blocked' + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  await page.close();
}

/* ========================================================= phone view === */
{
  const page = await prepPage(browser, BASE, { width: 375, height: 812, dsf: 2, mobile: true });
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 400);
  await page.evaluate(names => { document.getElementById('nameInput').value = names.join('\n'); }, NAMES);
  await page.click('button[onclick="addNames()"]');
  // Building a room is desk work, so at 375px the desk-building and printing
  // groups sit folded behind the toolbar's More button (Path 14 P1). A teacher
  // who does build one on a phone taps More first; the reading controls
  // (assign, undo, pick, view) stay in the always-visible row.
  const moreBtn = page.locator('#moreBtn');
  ok(await moreBtn.isVisible(), 'at 375px the toolbar shows its More button');
  eq(await moreBtn.getAttribute('aria-expanded'), 'false', 'and it starts folded');
  ok(await page.isHidden('button[onclick="makeGrid()"]'), 'with the desk-building controls out of the way');
  ok(await page.isVisible('button[onclick="autoAssign()"]'), 'and Auto-assign still in reach');
  await moreBtn.click();
  eq(await moreBtn.getAttribute('aria-expanded'), 'true', 'tapping More unfolds them');
  await page.click('button[onclick="makeGrid()"]');
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 400);
  const unfolded = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  eq(unfolded, 0, `nothing spills sideways with the toolbar unfolded either (overflow ${unfolded}px)`);
  await page.screenshot({ path: path.join(SHOTS, 'phone-unfolded.png'), fullPage: true });
  await moreBtn.click();
  eq(await moreBtn.getAttribute('aria-expanded'), 'false', 'tapping it again folds them back');
  const phone = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fscale: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fscale')),
    seated: document.querySelectorAll('.desk.assigned').length,
    stageTop: Math.round(document.getElementById('stage').getBoundingClientRect().top + window.scrollY),
  }));
  ok(phone.stageTop < 812, `the chart is within one swipe of the top (${phone.stageTop}px down a 812px screen)`);
  eq(phone.overflow, 0, `nothing spills sideways at 375px (overflow ${phone.overflow}px)`);
  ok(phone.fscale < 0.35, `the room is scaled down to fit a phone (${phone.fscale.toFixed(3)})`);
  eq(phone.seated, 28, 'and the chart is all there');
  await page.screenshot({ path: path.join(SHOTS, 'phone.png'), fullPage: true });
  await page.close();
}

/* ================================================ seating history UI === */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

  // prompt()s from recordHistory() are answered from this queue, in order;
  // any other dialog (a confirm()) falls back to accept() with no argument.
  let dialogQueue = [];
  page.on('dialog', async d => {
    if (dialogQueue.length) { await d.accept(dialogQueue.shift()); }
    else { await d.accept(); }
  });

  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 400);

  await page.evaluate(names => { document.getElementById('nameInput').value = names.join('\n'); }, NAMES.slice(0, 6));
  await page.click('button[onclick="addNames()"]');
  await page.evaluate(() => {
    document.getElementById('gridCols').value = '3';
    document.getElementById('gridRows').value = '2';
  });
  await page.click('button[onclick="makeGrid()"]');
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 300);

  await page.evaluate(() => {
    const q = document.getElementById('historyQuarter');
    q.value = 'Q1';
    q.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page, 200);

  dialogQueue = ['Unit 1', 'Q1'];
  await page.click('button[onclick="recordHistory()"]');
  await settle(page, 1600);   // autosave is debounced 1200ms
  eq(await page.locator('#historyCount').textContent(), '1', 'recording an arrangement adds one to the history count');
  ok((await page.locator('#historyList .layout-row').count()) === 1, 'the recorded entry shows up in the list');
  ok(/Unit 1/.test(await page.locator('#historyList').innerText()), 'with the label the prompt was given');

  const savedHistory = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('seating-chart-v1'));
    return s.sections[0].history;
  });
  eq(savedHistory.length, 1, 'the record is actually persisted, not just rendered');
  eq(savedHistory[0].quarter, 'Q1', 'tagged with the quarter that was set');
  eq(Object.keys(savedHistory[0].assign).length, 6, 'and carries a full snapshot of who was seated');

  // Shuffle again so the live floor differs from what was just recorded, then
  // confirm the sidebar's live nudge box rendered SOMEthing (it has real
  // history to compare against now) rather than the "nothing recorded yet"
  // placeholder.
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 300);
  const checksText = await page.locator('#histChecks').innerText();
  ok(checksText.length > 0, 'the history-checks box renders once something is on record');
  ok(!/Record an arrangement to start/.test(checksText), 'and stops showing the empty-state hint');

  // Delete it — confirm() is answered by the fallback branch above.
  await page.click('#historyList .layout-row .icon-btn');
  await settle(page, 300);
  eq(await page.locator('#historyCount').textContent(), '0', 'deleting the record brings the count back to zero');
  await page.close();
}

/* ============================================ history print reports === */
{
  // Seeded through the tool's own storage key, the same way smoke-sub-packet
  // does it — a hand-built fixture makes the repeat-seat and front-row
  // numbers provable instead of left to the auto-assigner's dice.
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const students = ['Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells']
    .map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false, photo: '' }));
  const deskShape = [
    { id: 'f0', x: 40, y: 110 }, { id: 'f1', x: 170, y: 110 },     // front row
    { id: 'b0', x: 40, y: 260 }, { id: 'b1', x: 170, y: 260 },     // back row
  ].map(d => ({ ...d, rot: 0, locked: false }));
  const historyEntry = (date, label, assign) => ({
    id: 'h-' + label, date, label, quarter: 'Q1',
    desks: deskShape.map(d => ({ id: d.id, x: d.x, y: d.y })),
    assign, students: students.map(s => ({ id: s.id, name: s.name })),
  });
  const FIXTURE = {
    __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
    printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
    sections: [{
      id: 'p1', name: 'History Report Test', students, desks: deskShape,
      // s0 keeps the exact same seat both times (a repeat); s3 never once
      // lands in the front row across either recorded unit (overdue).
      assign: { f0: 's0', f1: 's2', b0: 's1', b1: 's3' },
      apart: [], together: [], layouts: [],
      history: [
        historyEntry('2026-08-01', 'Unit 1', { f0: 's0', f1: 's1', b0: 's2', b1: 's3' }),
        historyEntry('2026-08-08', 'Unit 2', { f0: 's0', f1: 's2', b0: 's3', b1: 's1' }),
      ],
    }],
  };

  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
  await page.reload({ waitUntil: 'load' });
  await settle(page, 400);
  eq(await page.locator('#historyCount').textContent(), '2', 'both seeded history entries survive a reload through repair');

  async function runPrint(fn) {
    await page.evaluate(f => { window.print = () => {}; window[f](); }, fn);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await settle(page, 200);
  }
  async function endPrint() {
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    await settle(page, 200);
  }
  const reportRows = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#printHistoryWrap table tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())));

  // Nobody picked in the (empty-by-default) select: printStudentHistory()
  // refuses before ever touching window.print(), rather than opening the
  // print dialog on a blank sheet.
  await page.evaluate(() => { window.print = () => {}; window.printStudentHistory(); });
  await settle(page, 200);
  ok(/Pick a student first/.test(await page.locator('#status').innerText()), 'and says why, in the status line');
  eq(await page.evaluate(() => document.body.classList.contains('printing-history')), false,
    'nothing was actually sent to print');

  // Pick s0 (the repeat-seat student) and print their own report.
  await page.selectOption('#historyStudentSelect', 's0');
  await runPrint('printStudentHistory');
  await page.emulateMedia({ media: 'print' });
  const s0Rows = await reportRows();
  eq(s0Rows.length, 2, "s0's report has one row per recorded unit");
  eq(s0Rows[0][3], 'Yes', 'the first unit shows front row');
  eq(s0Rows[0][4], '', 'and is not flagged as a repeat the first time');
  eq(s0Rows[1][4], 'Repeats an earlier seat', 'the second time in the same seat is flagged');
  await endPrint();

  // The whole-class fairness report.
  await runPrint('printClassHistory');
  await page.emulateMedia({ media: 'print' });
  const classRows = await reportRows();
  eq(classRows.length, 4, 'one row per student on the roster');
  const bySid = Object.fromEntries(classRows.map(r => [r[0], r]));
  eq(bySid['Ada Lovelace'][1], '2', "Ada (s0) was seated in both recorded units");
  eq(bySid['Ada Lovelace'][3], '1', 'and her repeat-seat count is exactly one');
  eq(bySid['Ida B Wells'][2], '0', "Ida (s3), never once in front row, shows zero for this quarter");
  await endPrint();

  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no console/page errors while building or printing a history report'
    + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  await page.close();
}

/* ============================================ "Why?" after auto-assign === */
{
  // Path 14 P3 step 3. A pair kept apart whose two seats are both pinned side by side is a
  // conflict no shuffle can mend: the page must say so in a sentence with the names, and the
  // sentence must go as soon as anything else changes the chart.
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const students = ['Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells']
    .map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false, photo: '' }));
  students[2].name = '<i>Mansa</i> Musa';                       // names are text, never markup
  const desks = [{ id: 'a', x: 40, y: 110, locked: true }, { id: 'b', x: 170, y: 110, locked: true },
    { id: 'c', x: 300, y: 110, locked: false }, { id: 'd', x: 430, y: 110, locked: false }].map(d => ({ ...d, rot: 0 }));
  const FIXTURE = {
    __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
    printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
    sections: [{ id: 'p1', name: 'Why Test', students, desks, assign: { a: 's0', b: 's1' }, apart: [['s0', 's1']], together: [], layouts: [], history: [] }],
  };
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
  await page.reload({ waitUntil: 'load' });
  await settle(page, 400);
  ok(await page.isHidden('#whyBtn'), 'Why? is not offered before an auto-assign');
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 300);
  ok(await page.isVisible('#whyBtn'), 'Why? appears when auto-assign could not keep a rule');
  ok(await page.isHidden('#whyPanel'), 'and the panel stays shut until asked');
  await page.click('#whyBtn');
  ok(await page.isVisible('#whyPanel'), 'Why? opens the panel');
  eq(await page.getAttribute('#whyBtn', 'aria-expanded'), 'true', 'and says it is open');
  const lines = await page.$$eval('#whyList li', els => els.map(e => e.textContent));
  ok(lines.length === 1 && /^Ada Lovelace and Marco Polo are side by side: every seat that would mend it is held by .*pinned seat/.test(lines[0]), 'the sentence names both students and what holds them: ' + JSON.stringify(lines));
  eq(await page.$$eval('#whyList i', els => els.length), 0, 'a name is shown as text, not parsed as markup');
  const st = await page.textContent('#status');
  ok(/keep-apart pair\(s\) could not be separated/.test(st), 'the status line keeps its count');
  // Shuffle (a new seed) keeps the explanation, a change to the chart removes it
  await page.click('button[onclick="clearSeats()"]');
  await settle(page, 200);
  ok(await page.isHidden('#whyBtn'), 'Why? goes once the chart is changed by hand');
  // undo after a solve restores the chart
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 200);
  await page.click('button[onclick="undo()"]');
  await settle(page, 200);
  const after = await stored(page);
  ok(after && after.sections[0].assign.a === 's0', 'Undo after an auto-assign brings the earlier chart back');
  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no console/page errors in the Why? flow' + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  await page.close();
}

/* ============================================ Rules block (Path 14 P3 increment 2, step 1) === */
{
  // The Rules block: a keep-apart pair on a chart saved before rules existed shows as a Must rule;
  // a zone rule by tapping desks (with the keyboard), a soft rule with a reason, an error with
  // nothing picked, a clash refused, removal, and a removed student taking their rules with them.
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const students = ['Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells', 'Hypatia Alexandria', 'Zheng He']
    .map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false, photo: '' }));
  const desks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => ({ id, x: 40 + (i % 4) * 130, y: 110 + Math.floor(i / 4) * 130, rot: 0, locked: false }));
  const FIXTURE = {
    __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
    printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
    sections: [{ id: 'p1', name: 'Rules Test', students, desks, assign: {}, apart: [['s0', 's1']], together: [], layouts: [], history: [] }],
  };
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
  await page.reload({ waitUntil: 'load' });
  await settle(page, 400);
  const rows = () => page.$$eval('#rulesList .pair', els => els.map(e => e.querySelector('.pp').textContent));
  let list = await rows();
  ok(list.length === 1 && /^Keep apart: Ada Lovelace, Marco Polo \u00B7 Must$/.test(list[0]), 'a pair saved before rules existed is listed as a Must rule: ' + JSON.stringify(list));
  eq(await page.textContent('#rulesCount'), '1', 'the count says one rule');
  const had = await stored(page);
  ok(!('rules' in had.sections[0]), 'merely loading the chart writes no rules field');

  // nothing picked: an error, nothing stored
  await page.selectOption('#ruleKind', 'apart');
  await page.click('button[onclick="addRuleFromForm()"]');
  ok(/at least two students/.test(await page.textContent('#status')), 'adding with nothing picked says so');
  eq((await rows()).length, 1, 'and adds nothing');

  // a Must put-together over the same pair as the Must keep-apart is refused
  await page.selectOption('#ruleKind', 'together');
  await page.selectOption('#ruleStudents', ['s0', 's1']);
  await page.click('button[onclick="addRuleFromForm()"]');
  ok(/clashes with a keep-apart rule/.test(await page.textContent('#status')), 'a hard together on a hard apart pair is refused');
  eq((await rows()).length, 1, 'and adds nothing again');

  // a zone rule by tapping desks, from the keyboard
  await page.selectOption('#ruleKind', 'zone');
  ok(await page.isVisible('#ruleZoneWrap'), 'the zone choices appear for a zone rule');
  ok(await page.isHidden('#ruleAnyWrap'), 'and the partner list stays away');
  await page.selectOption('#ruleStudents', ['s2']);
  await page.selectOption('#ruleZone', 'desks');
  ok(await page.isVisible('#ruleTapBtn'), 'Choose desks on the floor is offered for "desks I choose"');
  await page.focus('#ruleTapBtn');
  await page.keyboard.press('Enter');
  eq(await page.getAttribute('#ruleTapBtn', 'aria-pressed'), 'true', 'the choose-desks mode says it is on');
  await page.focus('.desk[data-id="a"] .seat'); await page.keyboard.press('Enter');
  await page.focus('.desk[data-id="b"] .seat'); await page.keyboard.press('Enter');
  eq(await page.textContent('#ruleTapInfo'), '2 desks chosen', 'two desks chosen with the keyboard');
  ok(/chosen for the rule/.test(await page.getAttribute('.desk[data-id="a"] .seat', 'aria-label')), 'a chosen desk says so to a screen reader');
  await page.focus('.desk[data-id="b"] .seat'); await page.keyboard.press('Enter');
  eq(await page.textContent('#ruleTapInfo'), '1 desk chosen', 'a second press drops the desk');
  await page.focus('.desk[data-id="b"] .seat'); await page.keyboard.press('Enter');
  await page.click('#ruleWhy'); await page.fill('#ruleWhy', 'front row, vision');
  await page.click('button[onclick="addRuleFromForm()"]');
  list = await rows();
  ok(list.length === 2 && /^Mansa Musa in desk 1, 2 \u00B7 Must \u00B7 front row, vision$/.test(list[1]), 'the zone rule is listed with its desks, strength and reason: ' + JSON.stringify(list));
  eq(await page.getAttribute('#ruleTapBtn', 'aria-pressed'), 'false', 'choosing desks ends when the rule is added');

  // a soft keep-apart with a reason mirrors into the old pair list
  await page.selectOption('#ruleKind', 'apart');
  await page.selectOption('#ruleStudents', ['s3', 's4']);
  await page.selectOption('#ruleStrength', '2');
  await page.fill('#ruleWhy', '');
  await page.click('button[onclick="addRuleFromForm()"]');
  await settle(page, 1600);
  let st1 = await stored(page);
  const sec1 = st1.sections[0];
  eq(sec1.rules.length, 3, 'three rules stored');
  const zr = sec1.rules.find(r => r.kind === 'zone');
  ok(zr && zr.hard === true && zr.zone === '' && zr.desks.join() === 'a,b' && zr.why === 'front row, vision', 'the zone rule is stored with its desks, Must and reason');
  const soft = sec1.rules.find(r => r.kind === 'apart' && !r.hard);
  ok(soft && soft.weight === 2 && soft.students.join() === 's3,s4', 'the Want rule is stored soft, weight 2');
  ok(sec1.apart.some(p => p.join() === 's3,s4') && sec1.apart.some(p => p.join() === 's0,s1'), 'both pairs are in the old apart list for an older page');

  // Auto-assign keeps the zone rule
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 300);
  await settle(page, 1600);
  st1 = await stored(page);
  const seat2 = Object.entries(st1.sections[0].assign).find(([, sid]) => sid === 's2');
  ok(seat2 && ['a', 'b'].includes(seat2[0]), 'Auto-assign seats the student in one of the chosen desks');

  // tab order: from the reason field the next stop is the Add button
  await page.focus('#ruleWhy'); await page.keyboard.press('Tab');
  eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('onclick')), 'addRuleFromForm()', 'Tab goes from the reason to Add rule');

  // remove one by its button
  await page.click('#rulesList .pair:nth-child(3) .icon-btn');
  eq((await rows()).length, 2, 'removing a rule takes it off the list');
  await settle(page, 1600);
  st1 = await stored(page);
  ok(!st1.sections[0].apart.some(p => p.join() === 's3,s4'), 'and out of the old pair list');

  // removing a student takes their rules with them
  await page.click('button[onclick="removeStudent(\'s2\')"]');
  await settle(page, 1600);
  st1 = await stored(page);
  ok(!st1.sections[0].rules.some(r => r.kind === 'zone'), 'a removed student takes their zone rule with them');
  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no console/page errors in the Rules flow' + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  await page.close();
}

/* ============================================ Leave empty and Fill the gaps (Path 14 P3 increment 2, step 2) === */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const students = ['Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells']
    .map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false, photo: '' }));
  const desks = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, x: 40 + (i % 3) * 130, y: 110 + Math.floor(i / 3) * 130, rot: 0, locked: false }));
  const FIXTURE = {
    __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
    printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
    sections: [{ id: 'p1', name: 'Gaps Test', students, desks, assign: { a: 's0', b: 's1', c: 's2' }, apart: [], together: [], layouts: [], history: [] }],
  };
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
  await page.reload({ waitUntil: 'load' });
  await settle(page, 400);
  // Fill the gaps: s3 has no desk; the three seated stay exactly where they are
  await page.click('button[onclick="fillGaps()"]');
  await settle(page, 1700);
  let sv = (await stored(page)).sections[0];
  ok(sv.assign.a === 's0' && sv.assign.b === 's1' && sv.assign.c === 's2', 'Fill the gaps moves nobody who was seated');
  ok(Object.values(sv.assign).includes('s3'), 'and seats the student who had no desk');
  ok(/nobody else moved/.test(await page.textContent('#status')), 'and says nobody else moved: ' + await page.textContent('#status'));
  // Leave empty from the keyboard: the seated student goes back to the pool, the flag is stored
  await page.focus('.desk[data-id="a"] .seat'); await page.keyboard.press('e');
  await settle(page, 1700);
  sv = (await stored(page)).sections[0];
  const da = sv.desks.find(d => d.id === 'a');
  ok(da.empty === true && !sv.assign.a, 'E leaves the desk empty and frees its student');
  ok(/left empty/.test(await page.getAttribute('.desk[data-id="a"] .seat', 'aria-label')), 'the desk says it is left empty');
  ok(!sv.desks.find(d => d.id === 'b').hasOwnProperty('empty'), 'another desk gets no empty field');
  // it stays empty through two solves, and through Fill the gaps
  for (let i = 0; i < 2; i++) { await page.click('button[onclick="autoAssign()"]'); await settle(page, 300); }
  await page.click('button[onclick="fillGaps()"]'); await settle(page, 1700);
  sv = (await stored(page)).sections[0];
  ok(!sv.assign.a && Object.keys(sv.assign).length === 4, 'a desk left empty stays empty through Auto-assign, Shuffle and Fill the gaps');
  // a tap-to-place onto it is refused
  await page.focus('.desk[data-id="b"] .seat'); await page.keyboard.press('Enter');
  await page.focus('.desk[data-id="a"] .seat'); await page.keyboard.press('Enter');
  ok(/left empty/.test(await page.textContent('#status')), 'placing a student on it is refused with a sentence');
  // undo brings the desk back; E again turns it off and removes the field
  await page.keyboard.press('Escape');
  await page.focus('.desk[data-id="a"] .seat'); await page.keyboard.press('e');
  await settle(page, 1700);
  ok(!('empty' in (await stored(page)).sections[0].desks.find(d => d.id === 'a')), 'turning it off removes the field again');
  const errs = page.__errs.filter(e => !/favicon/.test(e));
  eq(errs.length, 0, 'no console/page errors in the Leave empty flow' + (errs.length ? ':\n       ' + errs.join('\n       ') : ''));
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} checks, ${failed} failed`);
if (failed) {
  console.log('\nfailures:\n  ' + fails.join('\n  '));
  process.exit(1);
}
