// select-suites.mjs — which test suites cover a set of touched files.
//
// This is the logic behind `run-suites.mjs --changed`, which CI runs on every
// pull request (the push-to-main job still runs everything — see
// .github/workflows/ci.yml and CLAUDE.md, "Test tooling"). It is a pure
// function over a file list so that Tools/board-check/test/select-suites.test.mjs
// can prove what it selects and, just as importantly, what it leaves out: a
// selector that quietly under-selects turns a PR's green check into a lie, and
// nothing downstream would notice.
//
// Four rules, applied in order. A file that matches an earlier rule is done.
//
//   1. SITE-WIDE  — _shared/, sw.js, index.html, manifest.json, package.json,
//      package-lock.json, Tools/board-check/ (the harness and this file) and
//      .github/ select EVERY suite. Each can break a tool that never names it,
//      and a workflow edit has to prove the whole pipeline still runs.
//
//      ONE EXEMPTION, AND IT IS READ OFF THE HUNK, NOT THE FILENAME: every
//      tool PR bumps CACHE_VERSION in sw.js, so for the nine tool PRs after
//      #197 the scoped job this file exists for never once fired — a
//      one-character version string ran the whole ~21-minute list. A sw.js
//      diff whose only changed lines are that assignment is therefore not
//      site-wide; it selects the service-worker folder's own suites instead,
//      which are the suites that actually exercise a version bump. Anything
//      else in the file — PRECACHE_URLS, SHELL_URLS, the fetch handler, a
//      comment — is site-wide exactly as before, and so is a diff this
//      function cannot see, because "I do not know what changed" has to
//      select more, never less. #214's rule-4 bug is the shape to avoid here:
//      a rule that reads a name where it should read the content goes quiet
//      rather than red, so isCacheVersionBumpOnly() checks EVERY changed line
//      and never merely looks for the word CACHE_VERSION in the diff.
//
//   2. FOLDER     — Tools/<folder>/... selects every suite under that folder,
//      and ALSO treats every page whose src/href/import names that folder as
//      touched (rule 3 then applies to those pages) — unless the only files
//      touched in the folder are under its test/, which no page can load, so
//      that edit runs the folder's own suites and stops. The second half is what
//      the first draft of --changed lacked: an edit to Tools/schedule/*.js was
//      selecting schedule's own suite and not schedule-visualizer's, although
//      035-schedule-visualizer.html imports from Tools/schedule/, and an edit
//      to Tools/seating-chart/ was skipping the store suite that opens 005.
//
//   3. PAGE       — a changed .html selects every suite whose source names it
//      (raw, with %20, or encodeURIComponent'd — the three spellings the suites
//      use; there is no file that records which folder a page belongs to, and
//      the page and its folder have different names, so reading the suites is
//      how the pairing is resolved). Pages under Tools/<folder>/ (001's hallway
//      remote, say) count too.
//
//   4. SWEEP      — a suite that enumerates the tool pages itself (the a11y
//      sweep, the theme sweep, the picker rollout, the registry-shape test)
//      never names any page, so rule 3 can never select it. Any changed page
//      selects all of them. They are found by reading the suites, not from a
//      list, so a new sweep is covered the day it lands. There are two ways to
//      enumerate and both count: `readdirSync`, and `git ls-files` — which
//      smoke-theme.mjs moved to on 2026-09-07 so its sweep would stop
//      including the gitignored offline-copy staging tree. That move made it
//      invisible to a `readdirSync`-only test for as long as it took the full
//      suite to run: a page edit would have quietly stopped running the theme
//      sweep in CI. `select-suites.test.mjs` pins both spellings.
//
// Everything else — the Markdown, eslint.config.js, .gitignore — selects
// nothing, and run-suites.mjs then exits 0 having run no suite. The guards in
// CI still run on such a PR; only the browser pass is skipped.
//
// What this deliberately does NOT try to do: follow a suite's own imports
// (a suite importing `../seating.mjs` lives in seating-chart's folder anyway),
// or trace what a page fetches at runtime beyond its static src/href/import
// attributes. Both would be guesses, and the rules above are meant to be
// explainable in one sentence each when the selection looks wrong.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SITE_WIDE = [
  /^_shared\//,
  /^sw\.js$/,
  /^index\.html$/,
  /^manifest\.json$/,
  /^package(-lock)?\.json$/,
  /^Tools\/board-check\//,
  /^\.github\//,
];

/** The worker, and the folder whose suites are about it. */
export const SW_FILE = /^sw\.js$/;
export const SW_SUITE_FOLDER = 'service-worker';

/**
 * A changed line that is nothing but the CACHE_VERSION assignment.
 * `const CACHE_VERSION = 'v165';` — quotes either way, semicolon optional.
 */
const CACHE_VERSION_LINE = /^[+-]\s*const\s+CACHE_VERSION\s*=\s*(['"])v\d+\1\s*;?\s*$/;

/**
 * True when a unified diff of sw.js changes the CACHE_VERSION line and nothing
 * else. Deliberately strict in both directions: an empty or unavailable diff is
 * false (the caller then treats the file as site-wide, the safe answer), and a
 * diff that changes one other line — a precache URL, a comment, whitespace — is
 * false however many CACHE_VERSION lines it also contains.
 *
 * @param {string|null} diff  unified diff text for sw.js, any context width
 */
export function isCacheVersionBumpOnly(diff) {
  if (typeof diff !== 'string' || !diff.trim()) return false;
  const changed = diff.split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  return changed.length > 0 && changed.every(l => CACHE_VERSION_LINE.test(l));
}

/** Design archives, not live pages: nothing tests them and the sweeps skip them. */
const NOT_LIVE = [/^Tools\/(New|Old) Designs\//];

/** The tool folder a suite belongs to: Tools/<tool>/test/x.mjs -> <tool>. */
export const toolOf = suite => (suite.split('/')[1] || '');

/** Every spelling a suite might use for a page's filename. */
export const needlesFor = file => [...new Set([file, encodeURIComponent(file), file.replace(/ /g, '%20')])];

/** A suite that lists the tool pages for itself instead of naming them. */
export const isSweep = src =>
  /readdirSync\s*\(/.test(src) || /['"]ls-files['"]/.test(src);

/** The per-tool folders a live page references through src/href/import/fetch. */
export function foldersReferencedBy(pageSrc) {
  const out = new Set();
  // Relative references only: "seating-chart/seating.js", "./schedule/x.js".
  // Anything starting with ../, /, http or _shared is not a per-tool folder.
  const re = /(?:src|href|from|import\(|fetch\()\s*=?\s*\(?\s*['"](?:\.\/)?([a-z0-9][a-z0-9._-]*)\//gi;
  let m;
  while ((m = re.exec(pageSrc))) {
    const folder = m[1];
    if (folder === '_shared' || folder === 'Tools') continue;
    out.add(folder);
  }
  return out;
}

/**
 * @param {string[]} files   repo-relative touched paths
 * @param {object}   env
 * @param {string[]} env.suites          ordered list from suites.json
 * @param {(rel: string) => string|null} env.readFile   returns a file's text or null
 * @param {() => string[]} env.listPages  repo-relative paths of every live page
 * @param {(rel: string) => string|null} [env.diffOf]   unified diff of a touched
 *   file, or null when it cannot be produced. Only sw.js is read this way
 *   (rule 1's one exemption); omitting it keeps the pre-#197 behaviour, where
 *   any sw.js edit is site-wide.
 * @returns {{ selected: string[], why: string[] }}
 */
export function suitesForChanges(files, { suites, readFile, listPages, diffOf = () => null }) {
  const why = [];
  // Rule 1's exemption, resolved first because it decides what "site-wide" means.
  const bumpOnly = files.filter(f => SW_FILE.test(f) && isCacheVersionBumpOnly(diffOf(f)));
  const siteWide = files.filter(f => SITE_WIDE.some(re => re.test(f)) && !bumpOnly.includes(f));
  if (siteWide.length) {
    why.push(`site-wide: ${siteWide.join(', ')} — every suite runs`);
    return { selected: suites.slice(), why };
  }
  if (bumpOnly.length) {
    why.push('sw.js: CACHE_VERSION is the only changed line — not site-wide; the service-worker suites run');
  }

  const folders = new Set();   // every touched Tools/<folder>/
  if (bumpOnly.length) folders.add(SW_SUITE_FOLDER);
  const shipped = new Set();   // those touched outside their test/ — what a page can load
  const pages = new Set();
  for (const f of files) {
    if (NOT_LIVE.some(re => re.test(f))) continue;
    const inFolder = /^Tools\/([^/]+)\/(.+)$/.exec(f);
    if (inFolder) {
      folders.add(inFolder[1]);
      if (!/^test\//.test(inFolder[2])) shipped.add(inFolder[1]);
      if (/\.html$/.test(f)) pages.add(f);
      continue;
    }
    if (/^Tools\/[^/]+\.html$/.test(f)) pages.add(f);
  }

  // Rule 2, second half: a page that loads from a touched folder is touched.
  // A folder touched only under its test/ is not — a suite or fixture is not
  // something a page can load, so that edit runs the folder's own suites only.
  if (shipped.size) {
    for (const page of listPages()) {
      const src = readFile(page);
      if (src === null) continue;
      const refs = foldersReferencedBy(src);
      const hit = [...shipped].filter(fo => refs.has(fo));
      if (hit.length && !pages.has(page)) {
        pages.add(page);
        why.push(`${page} loads from Tools/${hit.join(', Tools/')}/ — treated as touched`);
      }
    }
  }

  const wanted = new Set();
  for (const suite of suites) {
    if (folders.has(toolOf(suite))) { wanted.add(suite); why.push(`${suite}: its folder was touched`); }
  }

  if (pages.size) {
    const names = [...pages].map(p => path.posix.basename(p));
    for (const suite of suites) {
      if (wanted.has(suite)) continue;
      const src = readFile(suite);
      if (src === null) continue;
      const named = names.find(n => needlesFor(n).some(x => src.includes(x)));
      if (named) { wanted.add(suite); why.push(`${suite}: names ${named}`); continue; }
      if (isSweep(src)) { wanted.add(suite); why.push(`${suite}: sweeps every page`); }
    }
  }

  return { selected: suites.filter(s => wanted.has(s)), why };
}

/** The real tree: every live page, top-level and under a tool folder. */
export function listPagesOnDisk(site = SITE) {
  const out = [];
  const tools = path.join(site, 'Tools');
  for (const name of fs.readdirSync(tools)) {
    const full = path.join(tools, name);
    const rel = 'Tools/' + name;
    if (NOT_LIVE.some(re => re.test(rel + '/'))) continue;
    if (name.endsWith('.html')) { out.push(rel); continue; }
    if (name === 'board-check' || !fs.statSync(full).isDirectory()) continue;
    for (const inner of fs.readdirSync(full)) {
      if (inner.endsWith('.html')) out.push(rel + '/' + inner);
    }
  }
  return out.sort();
}

export function readFileOnDisk(site = SITE) {
  return rel => {
    try { return fs.readFileSync(path.join(site, rel), 'utf8'); } catch { return null; }
  };
}
