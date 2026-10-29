// smoke-lightning.mjs — Name Picker: the "Let's go crazy" lightning bolts.
//
//   node Tools/name-picker/test/smoke-lightning.mjs
//
// Devon, 2026-10-07: "the lightning effect for let's go crazy doesn't work".
// Crazy mode pulses a filter on <body>, and a filtered ancestor is the
// containing block of a position:fixed child, so the fixed #lightningSvg
// started where the body does, not where the viewport does, and drawLightning
// placed every bolt from viewport coordinates: the bolts were drawn a few
// hundred px away from the cards they should join. This holds each bolt's
// ends on the centres of two name cards, in viewport terms, while the pulse
// is running, and holds Calm mode and prefers-reduced-motion to drawing none.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8602;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/007-Name Picker.html';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

const server = await serve(PORT);
const browser = await launch();

async function open(opts = {}) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', 'Ada\nBo\nCy\nDi\nEd\nFlo\nGus\nHal');
  await page.click('#loadNames');
  await settle(page, 400);
  if (opts.calm) await page.evaluate(() => { const c = document.getElementById('calmMode'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.keyboard.press('Escape');
  await settle(page, 400);
  /* Keep each bolt's ends (in viewport px, as drawn) before it fades. */
  await page.evaluate(() => {
    window.__bolts = [];
    const svg = document.getElementById('lightningSvg');
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (!n.classList || !n.classList.contains('lightning-bolt')) return;
      const o = svg.getBoundingClientRect();
      const nums = n.getAttribute('d').match(/-?[\d.]+/g).map(Number);
      const pts = [];
      for (let i = 0; i < nums.length; i += 2) pts.push([nums[i] + o.left, nums[i + 1] + o.top]);
      window.__bolts.push({ first: pts[0], last: pts[pts.length - 1],
        cards: [...document.querySelectorAll('.name-card')].map(c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }) });
    }))).observe(svg, { childList: true });
  });
  return page;
}
const near = (p, cards) => cards.some(c => Math.abs(c[0] - p[0]) < 40 && Math.abs(c[1] - p[1]) < 40);

console.log('Name Picker — Crazy mode lightning');

/* 1. Crazy on: bolts are drawn, and join cards where the cards are. */
{
  const page = await open();
  await page.click('#crazyBtn');
  await settle(page, 300);
  await page.click('#pickBtn');
  await page.waitForFunction(() => window.__bolts.length >= 2, null, { timeout: 15000 }).catch(() => {});
  const bolts = await page.evaluate(() => window.__bolts);
  ok(bolts.length >= 2, 'Crazy mode draws lightning during a pick (got ' + bolts.length + ')');
  ok(bolts.length > 0 && bolts.every(b => near(b.first, b.cards) && near(b.last, b.cards)),
     'each bolt starts and ends on a name card in viewport terms: ' + JSON.stringify(bolts[0] && [bolts[0].first, bolts[0].last]));
  await page.context().close();
}

/* 2. Calm mode: no bolts. */
{
  const page = await open({ calm: true });
  await page.click('#crazyBtn');
  await settle(page, 300);
  await page.click('#pickBtn');
  await settle(page, 3500);
  ok((await page.evaluate(() => window.__bolts.length)) === 0, 'Calm mode draws no lightning');
  await page.context().close();
}

/* 3. prefers-reduced-motion: no bolts. */
{
  const page = await open({ reducedMotion: true });
  await page.click('#crazyBtn');
  await settle(page, 300);
  await page.click('#pickBtn');
  await settle(page, 3500);
  ok((await page.evaluate(() => window.__bolts.length)) === 0, 'prefers-reduced-motion draws no lightning');
  await page.context().close();
}

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
