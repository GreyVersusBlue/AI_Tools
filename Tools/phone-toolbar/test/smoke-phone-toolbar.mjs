// smoke-phone-toolbar.mjs — the phone fold on 011, 032 and 054 (AI-30, backlog rank 66).
//
//   node Tools/phone-toolbar/test/smoke-phone-toolbar.mjs        (or: npm run test:phone-toolbar)
//
// Each of the three pages had a block of controls taller than half a 740 px phone screen
// (011's options card 663 px, 032's toolbar 424, 054's header 373). Each now keeps its main
// controls up and folds the rest behind a More button, the way 005's toolbar does. This
// suite holds that at 360x740 and 375x812: the block is at most half the screen, nothing
// overflows sideways, the toggle is a real button with aria-expanded and aria-controls, the
// folded controls are out of the tab order until opened and then every one is reachable by
// keyboard alone, a value set in a folded control survives folding and unfolding, and at
// 1280 wide nothing is folded. A mutant (the fold switched off) must fail the height check.
// Port 8626.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8626;
const BASE = `http://127.0.0.1:${PORT}/`;

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// block: the element whose height must fit in half the screen. folded: the wrappers the
// More button controls. keys: what the keyboard walk must reach once they are open.
const PAGES = [
  {
    name: '011', file: '011-image-to-pdf.html', block: '.controls', toggle: '#sortMoreBtn', bar: '.controls',
    folded: '#sortMore',
    keys: ['grid-density', 'quality', 'target-size', 'enhance', 'filename'],
    // set a value in a folded control, fold, unfold, read it back
    state: {
      set: async page => { await page.fill('#filename', 'keepme.pdf'); await page.selectOption('#quality', 'high'); },
      read: page => page.evaluate(() => [document.getElementById('filename').value, document.getElementById('quality').value]),
      want: ['keepme.pdf', 'high'],
    },
  },
  {
    name: '032', file: '032-School Calendar Visualizer.html', block: '#calToolbar', toggle: '#btnToolbarMore', bar: '#calToolbar',
    folded: '#tbFiles, #tbPrintOpts',
    keys: ['btnNewYear', 'btnSeed', 'btnBlank', 'btnExport', 'btnImport', 'btnExportIcs', 'icsLessons', 'btnImportIcs',
           'btnPasteTable', 'radio:printMode'],
    state: {
      set: async page => { await page.check('input[name=printMode][value=year]'); await page.check('#icsLessons'); },
      read: page => page.evaluate(() => [document.querySelector('input[name=printMode]:checked').value, document.getElementById('icsLessons').checked]),
      want: ['year', true],
    },
  },
  {
    name: '054', file: '054-current-events-discussion-guide-generator.html', block: '.app-header', toggle: '#hdrMoreBtn', bar: '#hdrBar',
    folded: '#hdrFile, #hdrLevels',
    keys: ['loadExampleBtn', 'clearBtn', 'printAllLevelsBtn'],
    state: {
      // load the example from the keyboard-reachable button, fold, unfold: the guide stays loaded
      set: async page => { await page.focus('#loadExampleBtn'); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.getElementById('articleTitle').value !== ''); },
      read: page => page.evaluate(() => document.getElementById('articleTitle').value !== ''),
      want: true,
    },
  },
];

const server = await serve(PORT);
const browser = await launch();

// The height rule, as one function so the mutant can run the same measurement.
async function blockHeight(page, p) {
  return page.evaluate(sel => Math.round(document.querySelector(sel).getBoundingClientRect().height), p.block);
}

// Visible controls inside a selector, as keys (a radio group is one stop, by name).
const controlKeys = (page, sel) => page.evaluate(sel => {
  const keys = new Set();
  document.querySelectorAll(sel).forEach(w => w.querySelectorAll('button, input, select, textarea, a[href]').forEach(c => {
    if (c.hidden || c.type === 'hidden' || c.type === 'file' || c.offsetParent === null) return;
    keys.add(c.type === 'radio' ? 'radio:' + c.name : c.id);
  }));
  return [...keys];
}, sel);

try {
  console.log('Phone toolbars — 011, 032, 054 (AI-30 rank 66)');
  const measured = [];
  for (const [w, h] of [[360, 740], [375, 812]]) {
    for (const p of PAGES) {
      const page = await prepPage(browser, BASE, { width: w, height: h, mobile: true });
      await page.goto(BASE + 'Tools/' + encodeURI(p.file));
      await settle(page, 300);
      const tag = `${p.name} @${w}x${h}`;
      const hgt = await blockHeight(page, p);
      measured.push(`${tag}: ${hgt}px`);
      ok(hgt <= h / 2, `${tag}: the controls block is at most half the screen (${hgt}px of ${h / 2}px)`);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag}: no sideways overflow`);

      // the toggle: a real button, labelled, closed, naming elements that exist
      const t = await page.evaluate(sel => {
        const b = document.querySelector(sel);
        return { tag: b.tagName, type: b.getAttribute('type'), expanded: b.getAttribute('aria-expanded'),
                 name: (b.textContent || '').trim(), shown: b.offsetParent !== null,
                 controls: (b.getAttribute('aria-controls') || '').split(/\s+/).map(id => !!document.getElementById(id)) };
      }, p.toggle);
      ok(t.tag === 'BUTTON' && t.shown && t.expanded === 'false' && t.name.length > 0, `${tag}: More is a visible button, closed, with a name`);
      ok(t.controls.length > 0 && t.controls.every(Boolean), `${tag}: aria-controls names elements that exist`);
      ok((await controlKeys(page, p.folded)).length === 0, `${tag}: folded controls are not rendered, so not in the tab order`);
      await page.keyboard.press('Tab');

      // open with the keyboard, walk the tab order, every folded control comes up
      await page.focus(p.toggle);
      await page.keyboard.press('Enter');
      eq(await page.getAttribute(p.toggle, 'aria-expanded'), 'true', `${tag}: Enter on More opens it (aria-expanded true)`);
      const expected = await controlKeys(page, p.folded);
      eq(expected.slice().sort(), p.keys.slice().sort(), `${tag}: opening shows exactly the folded controls`);
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const k = await page.evaluate(barSel => {
          const a = document.activeElement, bar = document.querySelector(barSel);
          if (!a || !bar || !bar.contains(a)) return null;
          return a.type === 'radio' ? 'radio:' + a.name : a.id;
        }, p.bar);
        if (k === null && seen.size) break;
        if (k) seen.add(k);
      }
      // Shift+Tab back so a toggle that sits after the folded controls is also covered
      await page.focus(p.toggle);
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Shift+Tab');
        const k = await page.evaluate(barSel => {
          const a = document.activeElement, bar = document.querySelector(barSel);
          if (!a || !bar || !bar.contains(a)) return null;
          return a.type === 'radio' ? 'radio:' + a.name : a.id;
        }, p.bar);
        if (k === null) break;
        seen.add(k);
      }
      const missing = p.keys.filter(k => !seen.has(k));
      eq(missing, [], `${tag}: every folded control is reachable with Tab / Shift+Tab alone`);

      // state survives fold and unfold; the page still works after
      await p.state.set(page);
      await page.focus(p.toggle); await page.keyboard.press('Space');
      eq(await page.getAttribute(p.toggle, 'aria-expanded'), 'false', `${tag}: Space on More folds it again`);
      ok((await controlKeys(page, p.folded)).length === 0, `${tag}: folded again, controls leave the tab order`);
      await page.focus(p.toggle); await page.keyboard.press('Enter');
      eq(await p.state.read(page), p.state.want, `${tag}: a value set in a folded control survives fold and unfold`);

      // the mutant: switch the fold off; the same height rule must now fail
      if (w === 360) {
        const fresh = await prepPage(browser, BASE, { width: w, height: h, mobile: true });
        await fresh.goto(BASE + 'Tools/' + encodeURI(p.file));
        await settle(fresh, 300);
        await fresh.addStyleTag({ content: `${p.folded.split(',').map(s => s.trim() + '{display:flex !important}').join('')}` });
        const mh = await blockHeight(fresh, p);
        ok(mh > h / 2, `${tag}: MUTANT fold switched off makes the height rule fail (${mh}px > ${h / 2}px)`);
        await fresh.context().close();
      }
      await page.context().close();
    }
  }
  console.log('  ' + measured.join('\n  '));

  // desktop: no fold, the toggle is not drawn, and the folded groups are all there
  for (const p of PAGES) {
    const page = await prepPage(browser, BASE, { width: 1280, height: 800 });
    await page.goto(BASE + 'Tools/' + encodeURI(p.file));
    await settle(page, 300);
    const tag = `${p.name} @1280x800`;
    ok(await page.evaluate(sel => document.querySelector(sel).offsetParent === null, p.toggle), `${tag}: the More button is not drawn`);
    const keys = await controlKeys(page, p.folded);
    ok(p.keys.every(k => keys.includes(k)), `${tag}: nothing is folded (${p.keys.length} controls visible)`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag}: no sideways overflow`);
    await page.context().close();
  }

  // 600 / 601: the breakpoint is the same for CSS and the button
  for (const p of PAGES) {
    for (const [w, folded] of [[600, true], [601, false]]) {
      const page = await prepPage(browser, BASE, { width: w, height: 800 });
      await page.goto(BASE + 'Tools/' + encodeURI(p.file));
      await settle(page, 200);
      const keys = await controlKeys(page, p.folded);
      ok(folded ? keys.length === 0 : p.keys.every(k => keys.includes(k)), `${p.name} @${w}: ${folded ? 'folded' : 'open'} at the edge of the breakpoint`);
      await page.context().close();
    }
  }
} finally {
  await browser.close(); server.close();
}
console.log(`phone toolbars: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
