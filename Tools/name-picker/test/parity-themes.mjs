// parity-themes.mjs — Name Picker: np-themes.js against the object it replaced.
//
//   node Tools/name-picker/test/parity-themes.mjs
//
// Path 15 P1 step 1 moved 007's inline `themes` object into np-themes.js as data.
// OLD_THEMES below is that object, copied byte for byte from 007 at v447, and
// oldApply() is applyTheme()'s property logic as it was. A port alone means the
// new module returns, for every name the old code was asked, exactly what the
// old code wrote on <html>. Pure Node.

import { THEMES, themeVars, hasTheme } from '../np-themes.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) passed++; else { failed++; console.log('  FAIL ' + label + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
};

/* frozen: 007 at v447 */
const OLD_THEMES = {
  default:{'--bg':'#1a1a2e','--surface':'#16213e','--text':'#eaeaea','--accent':'#e94560','--accent-fill':'#c9304a','--accent2':'#f5d76e','--name-bg':'#0f3460','--name-text':'#fff','--highlight':'#e94560','--highlight-text':'#fff','--winner':'#f5d76e','--winner-text':'#1a1a2e'},
  classroom:{'--bg':'#f5f7fa','--surface':'#ffffff','--text':'#1d2939','--accent':'#2563eb','--accent2':'#f59e0b','--name-bg':'#2563eb','--name-text':'#fff','--highlight':'#dc2626','--highlight-text':'#fff','--winner':'#f59e0b','--winner-text':'#1d2939'},
  medieval:{'--bg':'#2a1810','--surface':'#3d2817','--text':'#f0e0c0','--accent':'#b8860b','--accent2':'#daa520','--name-bg':'#5d3a1a','--name-text':'#f5e6c8','--highlight':'#a0522d','--highlight-text':'#fff','--winner':'#daa520','--winner-text':'#2a1810'},
  'ancient-china':{'--bg':'#2c0d0d','--surface':'#4a1414','--text':'#ffd700','--accent':'#dc143c','--accent2':'#ffd700','--name-bg':'#7a1f1f','--name-text':'#fff8dc','--highlight':'#ff4500','--highlight-text':'#fff','--winner':'#ffd700','--winner-text':'#2c0d0d'},
  byzantine:{'--bg':'#1a0a2e','--surface':'#2d1b3d','--text':'#f5e6d3','--accent':'#9b59b6','--accent2':'#f1c40f','--name-bg':'#4a2c5e','--name-text':'#fff','--highlight':'#c0392b','--highlight-text':'#fff','--winner':'#f1c40f','--winner-text':'#1a0a2e'},
  space:{'--bg':'#000814','--surface':'#001d3d','--text':'#fff','--accent':'#00b4d8','--accent2':'#ffd60a','--name-bg':'#003566','--name-text':'#fff','--highlight':'#7209b7','--highlight-text':'#fff','--winner':'#ffd60a','--winner-text':'#000814'},
  forest:{'--bg':'#1b2e1f','--surface':'#2d4a2b','--text':'#e8f4d8','--accent':'#6b8e23','--accent2':'#daa520','--name-bg':'#3d5e3d','--name-text':'#f0f4e8','--highlight':'#cd5c5c','--highlight-text':'#fff','--winner':'#daa520','--winner-text':'#1b2e1f'},
  ocean:{'--bg':'#03045e','--surface':'#023e8a','--text':'#caf0f8','--accent':'#00b4d8','--accent2':'#90e0ef','--name-bg':'#0077b6','--name-text':'#fff','--highlight':'#ff006e','--highlight-text':'#fff','--winner':'#90e0ef','--winner-text':'#03045e'},
  sunset:{'--bg':'#2d1b3d','--surface':'#4a2c5e','--text':'#fff5e1','--accent':'#ff6b35','--accent2':'#ffd23f','--name-bg':'#6e3d5a','--name-text':'#fff','--highlight':'#f72585','--highlight-text':'#fff','--winner':'#ffd23f','--winner-text':'#2d1b3d'},
  halloween:{'--bg':'#0a0a0a','--surface':'#1a0a1a','--text':'#ff7518','--accent':'#ff7518','--accent2':'#a020f0','--name-bg':'#2d1500','--name-text':'#ff7518','--highlight':'#a020f0','--highlight-text':'#fff','--winner':'#a020f0','--winner-text':'#fff'},
  patriotic:{'--bg':'#0a1a3a','--surface':'#13234d','--text':'#fff','--accent':'#bf0a30','--accent2':'#fff','--name-bg':'#1d3582','--name-text':'#fff','--highlight':'#bf0a30','--highlight-text':'#fff','--winner':'#fff','--winner-text':'#0a1a3a'}
};

/* frozen: applyTheme()'s writes, as an ordered list of [property, value] */
function oldApply(n) {
  const t = OLD_THEMES[n] || OLD_THEMES.default;
  const writes = Object.entries(t);
  writes.push(['--accent-fill', t['--accent-fill'] || t['--accent']]);
  return writes;
}

console.log('Name Picker — np-themes parity');

eq(Object.keys(THEMES), Object.keys(OLD_THEMES), 'the same eleven theme names, in the same order');
eq(Object.keys(OLD_THEMES).length, 11, 'eleven themes');
for (const n of [...Object.keys(OLD_THEMES), 'nonesuch', '', 'toString']) {
  /* the page writes the entries in order, then --accent-fill last; a repeated
     key keeps its last write, which is what a CSS property map does */
  const want = new Map(oldApply(n));
  const got = themeVars(n);
  eq(Object.fromEntries(want), got, 'themeVars(' + JSON.stringify(n) + ') is what applyTheme wrote');
}
eq(themeVars('default')['--accent-fill'], '#c9304a', 'default names its darker button fill');
eq(themeVars('ocean')['--accent-fill'], '#00b4d8', 'a theme without a fill uses its accent');
eq(hasTheme('space'), true, 'a real name is a theme');
eq(hasTheme('constructor'), false, 'an inherited property name is not');
eq(hasTheme('nonesuch'), false, 'nor is an unknown one');

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
