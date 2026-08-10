// publish.mjs — load the generator in headless Chromium, import the Northwind
// fixture, and run the tool's own Publish button. Writes the resulting HTML to
// a path you give it.
//
//   node Tools/schedule/test/publish.mjs out.html
//
// This exists because the generator has no way to be driven from Node: the
// publish path reads AppState, which only exists in a page. It is also the
// only regression baseline the tool has. Generate before a change, generate
// after, diff.
//
// Reuses Tools/board-check/harness.mjs for the static server and the browser
// launch. That file belongs to another thread and is read-only here; nothing
// in this folder writes to it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, SITE } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8137;   // not 8123 — board-check may be running on that

/** The generator's URL, relative to the site root.
 *  Resolved at runtime rather than hard-coded so this script can generate a
 *  baseline from the pre-rename file and compare it against the post-rename
 *  one. Newest name first. */
export function generatorPath() {
  for (const rel of ['Tools/035-schedule-visualizer.html',
                     'Tools/Schedule Visualizer and Browser Generator v60.html']) {
    if (fs.existsSync(path.join(SITE, rel))) return '/' + rel.split('/').map(encodeURIComponent).join('/');
  }
  throw new Error('no generator file found under Tools/');
}

/**
 * Boot the generator, apply the fixture, and return { html, page, close }.
 * The caller gets the live page too, so a suite can poke at the app itself
 * rather than only at its output.
 */
export async function publishFromFixture({ project = fixtureProject(), quiet = false } = {}) {
  const server = await serve(PORT);
  const browser = await launch();
  const base = `http://127.0.0.1:${PORT}`;
  const page = await prepPage(browser, base, { width: 1400, height: 1000, dsf: 1 });

  await page.goto(base + generatorPath(), { waitUntil: 'load' });
  // The app wires itself on DOMContentLoaded; give the deferred jsPDF tag and
  // the init pass a moment to land.
  await page.waitForFunction(() => typeof window.applyFullProject === 'function', { timeout: 20000 });

  const applied = await page.evaluate(p => {
    // confirm() would block the headless run; the import path only calls it
    // from the button handler, but stub it anyway so this stays true if the
    // handler moves.
    window.confirm = () => true;
    return window.applyFullProject(p);
  }, project);

  if (!quiet) console.log(`  fixture applied: ${applied.rooms} rooms, ${applied.groups} groups`);

  const html = await page.evaluate(() => window.brBuildPublishedHTML());

  const errs = page.__errs ? page.__errs.slice() : [];
  const blocked = page.__blocked ? page.__blocked.slice() : [];

  return {
    html, page, browser, applied, errs, blocked,
    close: async () => { await page.close(); await browser.close(); server.close(); },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const out = process.argv[2] || path.join(HERE, 'baseline.html');
  const run = await publishFromFixture();
  fs.writeFileSync(out, run.html, 'utf8');
  console.log(`  wrote ${path.relative(SITE, out)}, ${run.html.length} bytes`);
  if (run.blocked.length) console.log('  offsite requests blocked:', run.blocked);
  if (run.errs.length) console.log('  page errors:', run.errs);
  await run.close();
}
