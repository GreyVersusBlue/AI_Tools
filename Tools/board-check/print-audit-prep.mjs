// print-audit-prep.mjs — the clicks audit-print.mjs makes before it looks for
// a page's print buttons, for the sheets saved state alone does not reach.
//
// Tools/a11y-sweep/seeds.mjs writes localStorage before a page's first script
// runs, and for most tools that is enough: the page opens on its saved set and
// its print buttons work. It is not enough when the button stays disabled until
// something is generated, when the sheet belongs to a second tab, or when a
// student has to be picked first. (A tab whose label says "print" is opened by
// the audit itself; it needs no entry.) Each entry here is one such state: a name for
// the report and a function given the Playwright page after it has loaded
// (seeded, where the page has a seed). The audit measures the seeded page as
// it stands, and then once more per entry.
//
// Keep an entry to the one or two actions a teacher would take, by id. A prep
// that needs more than that is a per-tool suite's job.

import { fixtureProject } from '../schedule/test/fixture-northwind.mjs';

export const PRINT_PREP = {
  // 008 — the per-student summary prints nothing until a student is chosen.
  '008': [{ name: 'a student picked', run: page => page.selectOption('#summaryStudent', { index: 1 }) }],
  // 014 — role cards are printed from a pairing that is held in memory.
  '014': [{ name: 'the class paired up', run: page => page.click('#pairUpBtn') }],
  // 015 — the tiled wall print and the map print each sit in a panel their
  // toggle opens, and the layout preview is a view of its own. A new timeline
  // has no events, and both prints refuse an empty one: Load example fills it.
  '015': [
    { name: 'example loaded, Wall print panel open', run: async page => { await page.click('#loadExampleBtn'); await page.click('#tiledPrintToggleBtn'); } },
    { name: 'example loaded, Map print panel open', run: async page => { await page.click('#loadExampleBtn'); await page.click('#mapPrintToggleBtn'); } },
    { name: 'example loaded, Print layout preview', run: async page => { await page.click('#loadExampleBtn'); await page.click('#viewPrintBtn'); } },
  ],
  // 018 — team cards, route cards and answer sheets are on the Live Run tab.
  '018': [{ name: 'Live Run tab', run: page => page.click('#tab-run') }],
  // 023 — the reteach list is on the Paper Triage tab, and the open tab is not
  // saved; the class set needs names typed, which are not saved either.
  '023': [
    { name: 'Paper Triage tab', run: page => page.click('.tab-btn[data-tab="triage"]') },
    {
      name: 'class set',
      run: async page => {
        await page.click('.tab-btn[data-tab="handout"]');
        await page.check('#batchModeCheck');
        await page.fill('#batchNamesInput', 'Ada Lovelace\nMarco Polo\nNellie Bly\nAiden Smith\nMaximiliana Featherstonehaugh-Villanueva de la Cruz');
      },
    },
  ],
  // 025 — the roster sheet is built from names held in memory, and the record
  // button is enabled only while a student with entries is typed.
  '025': [{
    name: 'roster sheet built, a student typed',
    run: async page => {
      await page.fill('#rosterNamesInput', 'Ada Lovelace\nMarco Polo\nNellie Bly\nAiden Smith\nBella Cruz\nCarlos Diaz\nDana Lee\nMaximiliana Featherstonehaugh-Villanueva de la Cruz');
      await page.click('#buildRosterSheetBtn');
      await page.fill('#recordStudentInput', 'Ada Lovelace');
    },
  }],
  // 035 — the Blueprint tab prints the active floor's plan, and an empty grid
  // prints one sentence. The plan is the schedule suite's invented school,
  // loaded the way the page's own Import does.
  //       The other four tabs have no print button: Ctrl+P prints the tab that
  //       is open, so each is opened here with the same school loaded.
  '035': [
    {
      name: 'the Northwind plan loaded',
      /* global applyFullProject -- 035's page global, read inside page.evaluate() */
      run: page => page.evaluate(project => { applyFullProject(project); }, fixtureProject()),
    },
    ...['schedules', 'visualize', 'whatif', 'settings'].map(tab => ({
      name: `the Northwind plan loaded, ${tab} tab`,
      // Clicked in the page: at the audit's sheet-width viewport the tab bar
      // is scrolled, and Playwright waits for a button it cannot bring into view.
      run: page => page.evaluate(([project, t]) => {
        applyFullProject(project);
        document.querySelector(`.tab-btn[data-tab="${t}"]`).click();
      }, [fixtureProject(), tab]),
    })),
  ],
  // 038 — the data box is not saved; without a table there is no chart for
  // Ctrl+P and no worksheet for the print button.
  '038': [{
    name: 'a table pasted',
    run: page => page.fill('#data-input', 'Trial\tTemperature (C)\tReaction Time (s)\n1\t20\t45\n2\t30\t31\n3\t40\t22\n4\t50\t16'),
  }],
  // 040 — a new list is empty, and Print refuses an empty list (it used to
  // print a blank sheet). Typing words saves them, but under a list name the
  // page makes up, so they are typed here.
  '040': [{
    name: 'a word list typed',
    run: async page => {
      await page.fill('#wordInput', 'Photosynthesis: process plants use to make food from sunlight\nMitosis: a kind of cell division\nOsmosis: movement of water across a membrane\nEcosystem: a community of living things and their surroundings\nEnzyme: a protein that speeds up a reaction\nChlorophyll: the green pigment that captures light energy');
      await page.dispatchEvent('#wordInput', 'input');
    },
  }],
  // 044 — today's lesson is never saved, and the one print button lives in the
  // dialog that Quick text copy builds.
  '044': [{
    name: 'a lesson typed, Quick text copy open',
    run: async page => {
      await page.fill('#lessonTitle', 'Rock Cycle Review');
      await page.fill('#overviewText', 'Students finish the rock cycle diagram from yesterday, then read the article on the Channeled Scablands and answer the six questions on the back in complete sentences. Everything they need is already printed and stapled; nobody should need a laptop, and nobody should need to leave the room for materials.');
      await page.fill('#scheduleText', 'First 5 min: attendance and warm-up on the board\nNext 25 min: finish diagram\nLast 20 min: article and questions');
      await page.fill('#sharedPeriodNotes', 'Collect the diagrams at the bell\n**Marco Polo** may help pass out papers');
      await page.fill('#materialsNote', 'Worksheets are stapled on my desk.');
      await page.fill('#studentNotes', 'Period 3 — Nellie Bly sits at the front table.');
      await page.click('#btnQuickCopy');
    },
  }],
  // 067 — one print button, two sheets: it prints whichever tab is open.
  '067': [{ name: 'Sight-Reading tab', run: page => page.click('#pitchTabBtn') }],
};
