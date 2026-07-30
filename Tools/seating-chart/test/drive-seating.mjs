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
const URL_PAGE = BASE + '/Tools/Seating%20Chart%20Generator.html';

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
  const exported = await new Promise(async (resolve, reject) => {
    page.once('download', async d => {
      const to = path.join(SHOTS, 'exported-chart.json');
      await d.saveAs(to);
      resolve({ name: d.suggestedFilename(), path: to });
    });
    await page.click('#saveBar [data-gvb="export"]');
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
  await page.click('button[onclick="makeGrid()"]');
  await page.click('button[onclick="autoAssign()"]');
  await settle(page, 400);
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

await browser.close();
server.close();

console.log(`\n${passed} checks, ${failed} failed`);
if (failed) {
  console.log('\nfailures:\n  ' + fails.join('\n  '));
  process.exit(1);
}
