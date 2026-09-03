// make-manifest-screenshots.mjs — regenerate the PWA install-dialog screenshots.
//
//   node Tools/board-check/make-manifest-screenshots.mjs
//
// manifest.json's `screenshots` are what Chrome and Edge show in the richer
// "Install app" dialog (desktop wants form_factor "wide", Android "narrow").
// They are ordinary PNGs committed under assets/screenshots/ and precached
// like any other asset; this script is how they were made and how to remake
// them after a visible redesign. Run it by hand, commit the output — it is
// not a suite and not part of npm test.
//
// The landing page at 1280×720 is the wide shot; Name Picker at 540×960 is
// the narrow one. Pinned to a fixed clock so the memo date and any "today"
// text do not churn the bytes on every regeneration.

import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from './harness.mjs';

const PORT = 8404;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(SITE, 'assets', 'screenshots');

const SHOTS = [
  { file: 'landing-wide.png', url: `${BASE}/index.html`, width: 1280, height: 720 },
  { file: 'name-picker-narrow.png', url: `${BASE}/Tools/007-Name%20Picker.html`, width: 540, height: 960, mobile: true },
];

const server = await serve(PORT);
const browser = await launch();
try {
  for (const shot of SHOTS) {
    const page = await prepPage(browser, BASE, { width: shot.width, height: shot.height, mobile: !!shot.mobile });
    await page.clock.setFixedTime(new Date('2026-09-03T15:00:00'));
    await page.goto(shot.url, { waitUntil: 'load' });
    await settle(page, 1200);
    // Reveal-on-scroll "ink" animations finish at their own pace; force them.
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}.ink{opacity:1!important;transform:none!important}' });
    await settle(page, 300);
    await page.screenshot({ path: path.join(OUT, shot.file), fullPage: false });
    console.log('wrote assets/screenshots/' + shot.file);
    await page.context().close();
  }
} finally {
  await browser.close();
  server.close();
}
