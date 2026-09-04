// eslint.config.js — Path 2 P5: a minimal lint over the site's own scripts.
//
//   npm run lint            (or: npx eslint)
//
// Scope, on purpose: the standalone JavaScript files — _shared/*.js, the
// per-tool modules under Tools/<tool>/*.js and *.mjs, and the .mjs tooling
// and suites — with three rules that catch real bugs and nothing stylistic:
//   no-undef          a name that is not declared anywhere: a typo, or a
//                     global from a script the page forgot to load;
//   no-unused-vars    a declaration nothing reads (args and catch bindings
//                     excused, `_`-prefixed names excused);
//   eqeqeq            == where === was meant (null comparisons excused).
// Inline <script> blocks inside the ~86 tool pages are NOT linted: that is a
// much larger fight (they share one page scope with each other and with the
// shared scripts, and would need every page's globals declared by hand).
// Vendored libraries are never linted.
//
// The browser files are a mix: classic scripts (each _shared/*.js publishes
// one global — window.StateLink, window.A11y, … — that other files and the
// pages read) and ES modules (most Tools/<tool>/*.js files, imported with
// type="module"). Both are parsed as modules here: a classic IIFE parses
// identically that way, and it saves keeping a list of which is which. The
// cross-file globals are declared once below in SITE_GLOBALS so a file using
// them is not flagged; a NEW shared global is added there when it is created
// — that list is also a handy inventory. A tool-private page global that a
// module or a suite reaches for (HtcmThemes, roomRegistry, BR_TEACHERS) is
// declared in that file with a `/* global … */` comment, which is where the
// next reader wants to see it.

import js from '@eslint/js';
import globals from 'globals';

// Globals the site's own scripts publish for each other (window.X = …) and
// the vendored libraries' entry points.
const SITE_GLOBALS = {
  // _shared/
  StateLink: 'readonly',
  Store: 'readonly',
  A11y: 'readonly',
  QrScan: 'readonly',
  QrDraw: 'readonly',
  Share: 'readonly',
  Stage: 'readonly',
  Roster: 'readonly',
  WebRTCPair: 'readonly',
  DuplexPrint: 'readonly',
  StudentDetails: 'readonly',
  ToolRegistry: 'readonly',
  ThemeToggle: 'readonly',
  // _shared/vendor/
  jspdf: 'readonly',
  XLSX: 'readonly',
  JSZip: 'readonly',
  QRCode: 'readonly',
  jsQR: 'readonly',
};

// Several tool modules end with the dual-export idiom
//   if (typeof module !== 'undefined') module.exports = X; else global.X = X;
// so their pure logic can be required from a Node test. Those four names are
// what that idiom touches; nothing else from Node is available to a browser
// file.
const DUAL_EXPORT_GLOBALS = { module: 'readonly', exports: 'writable', require: 'readonly', global: 'readonly' };

export default [
  {
    ignores: [
      'node_modules/**',
      '_shared/vendor/**',
      'Tools/**/lib/**',
      'Tools/**/libs/**',
      'Tools/Old Designs/**',
      'Tools/New Designs/**',
      'Tools/board-check/.offline-copy-staging/**',
      'Tools/board-check/.sw-test-staging/**',
      'Tools/board-check/.sw-tiers-staging/**',
      '_ds/**',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // The recommended set adds a few more; the ones below fire on patterns
      // this codebase uses deliberately and are switched off rather than
      // "fixed" into something less clear.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-cond-assign': ['error', 'except-parens'],
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      // `var raw = null; try { raw = JSON.parse(…) } catch {}` is the site's
      // storage-reading idiom; the initial null is what the catch path
      // returns. The rule reads it as a useless write. Off.
      'no-useless-assignment': 'off',
      // A BOM written literally inside /^\uFEFF/ is the point of that regex.
      'no-irregular-whitespace': ['error', { skipRegExps: true, skipStrings: true, skipTemplates: true }],
    },
  },
  {
    // Browser files: _shared/*.js, the per-tool modules (and the odd nested
    // folder such as Tools/schedule/fonts/), assets/js/.
    files: ['_shared/*.js', 'Tools/*/*.js', 'Tools/*/*.mjs', 'Tools/*/*/*.js', 'assets/js/*.js'],
    ignores: ['Tools/*/test/**', 'Tools/board-check/**', 'Tools/*/*.test.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...SITE_GLOBALS, ...DUAL_EXPORT_GLOBALS },
    },
  },
  {
    // The service worker: a classic script in a worker scope.
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
  },
  {
    // Node tooling and suites. Browser globals too: a suite's page.evaluate()
    // callbacks are browser code inside a Node file, and `document` inside
    // one is not a bug.
    files: ['Tools/board-check/*.mjs', 'Tools/*/test/*.mjs', 'Tools/*/*.test.mjs', 'Tools/*/*/build-*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...SITE_GLOBALS },
    },
  },
];
