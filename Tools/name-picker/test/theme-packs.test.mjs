// theme-packs.test.mjs — Name Picker: np-theme-packs.js, the pack format and its whitelist.
//
//   node Tools/name-picker/test/theme-packs.test.mjs
//
// Path 15 P5. A pack is a file a colleague sent, so the cases here are mostly refusals: a property outside the
// whitelist, a value that is not a hex colour (url(), var(), expression(), a name), a missing property, a built-in
// theme's id, a prototype key, too many themes or packs. Pure Node.

import { validatePack, parsePackText, fix, blank, addPack, removePack, resolve, exportPack, packIdOf, packThemeId, MAX_PACKS, MAX_THEMES, labelOf } from '../np-theme-packs.js';
import { THEMES, themeVars } from '../np-themes.js';
import { createStore, fixBundle } from '../np-store.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 400) + '\n    want ' + JSON.stringify(b).slice(0, 400)); }
};
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };

const rome = () => ({ ...THEMES.classroom });
const good = () => ({ v: 1, name: 'Ancient Rome', themes: { forum: rome(), colosseum: { ...THEMES.sunset, '--accent-fill': '#cc5522' } } });

/* 1. a good pack */
{
  const r = validatePack(good());
  ok(r.ok, 'a pack with two full themes is accepted');
  eq(Object.keys(r.pack.themes), ['forum', 'colosseum'], 'both themes kept, in order');
  eq(r.pack.themes.colosseum['--accent-fill'], '#cc5522', 'the optional --accent-fill is kept');
  ok(!('--accent-fill' in r.pack.themes.forum), 'and is not invented where the theme has none');
  ok(r.pack.themes.forum !== good().themes.forum, 'the clean copy is not the input object');
  eq(validatePack({ ...good(), themes: { x: { ...rome(), '--bg': '#ABC' } } }).pack.themes.x['--bg'], '#abc', 'a colour is lower-cased and a 3-digit hex is allowed');
  eq(validatePack({ ...good(), name: '  Ancient   Rome  ' }).pack.name, 'Ancient Rome', 'the name is tidied');
}

/* 2. refusals, each with its reason */
const refuse = (mut, re, label) => {
  const p = good(); mut(p);
  const r = validatePack(p);
  ok(!r.ok && r.errors.some(e => re.test(e)), label + ' -> ' + JSON.stringify(r.errors));
};
refuse(p => { p.themes.forum['--bg'] = 'url(https://example.com/x.png)'; }, /--bg must be a hex colour/, 'url() as a colour is refused');
refuse(p => { p.themes.forum['--bg'] = 'var(--text)'; }, /--bg must be a hex colour/, 'var() is refused');
refuse(p => { p.themes.forum['--bg'] = 'expression(alert(1))'; }, /--bg must be a hex colour/, 'expression() is refused');
refuse(p => { p.themes.forum['--bg'] = 'red'; }, /--bg must be a hex colour/, 'a colour name is refused');
refuse(p => { p.themes.forum['--bg'] = '#12345'; }, /--bg must be a hex colour/, 'a 5-digit hex is refused');
refuse(p => { p.themes.forum['--bg'] = '#112233; background:url(x)'; }, /--bg must be a hex colour/, 'a value carrying a second declaration is refused');
refuse(p => { p.themes.forum['--bg'] = 5; }, /--bg must be a hex colour/, 'a number is refused');
refuse(p => { p.themes.forum['background-image'] = '#112233'; }, /not a property a theme may set/, 'a property outside the whitelist is refused');
refuse(p => { p.themes.forum['--evil'] = '#112233'; }, /"--evil" is not a property/, 'an unknown custom property is refused');
refuse(p => { delete p.themes.forum['--surface']; }, /missing --surface/, 'a missing required property is refused');
refuse(p => { p.themes.default = rome(); }, /built-in theme/, 'a built-in theme id is refused');
refuse(p => { p.themes['Bad Id'] = rome(); }, /lower-case letters/, 'an id with a space and capitals is refused');
refuse(p => { p.themes['x'.repeat(21)] = rome(); }, /lower-case letters/, 'a 21-character id is refused');
refuse(p => { p.themes.junk = 'red'; }, /must be an object/, 'a theme that is not an object is refused');
refuse(p => { p.v = 2; }, /"v" must be 1/, 'another version is refused');
refuse(p => { p.name = '  '; }, /needs a "name"/, 'a blank name is refused');
refuse(p => { p.themes = {}; }, /no themes/, 'a pack with no themes is refused');
refuse(p => { p.themes = Array.from({ length: MAX_THEMES + 1 }, (_, i) => i).reduce((o, i) => (o['t' + i] = rome(), o), {}); }, /at most/, 'more than the cap of themes is refused');
{
  const r = parsePackText('{"v":1,"name":"P","themes":{"__proto__":{"--bg":"#000"}}}');
  ok(!r.ok, 'a __proto__ theme id is refused');
  const r2 = parsePackText(JSON.stringify({ v: 1, name: 'P', themes: { ok: { ...rome(), '__proto__': '#000' } } }).replace('"ok":{', '"ok":{"__proto__":"#000",'));
  ok(!r2.ok && r2.errors.some(e => /__proto__/.test(e)), 'a __proto__ property inside a theme is refused, not assigned');
  ok(({}).polluted === undefined, 'and nothing was added to Object.prototype');
  eq(parsePackText('not json').errors, ['That file is not valid JSON.'], 'text that is not JSON says so');
  ok(!validatePack(null).ok && !validatePack([]).ok && !validatePack('x').ok, 'null, an array and a string are not packs');
  ok(!parsePackText('{"v":1,"name":"P","themes":{"a":{"--bg":"#000"}}}').ok, 'and a theme with one colour in it is refused');
}
{
  const p = good(); p.themes.forum['--bg'] = 'x'; delete p.themes.colosseum['--text'];
  const r = validatePack(p);
  ok(!r.ok && r.errors.length >= 2, 'every problem is reported, not only the first: ' + r.errors.length);
  ok(!('pack' in r), 'and nothing is returned to store');
}

/* 3. contrast warns and does not refuse */
{
  const p = good(); p.themes.forum['--text'] = '#f6f7fa';
  const r = validatePack(p);
  ok(r.ok && r.warnings.some(w => /forum.*--text on --bg/.test(w)), 'near-invisible text is a warning: ' + JSON.stringify(r.warnings));
  eq(validatePack({ ...good(), themes: { forum: rome() } }).warnings, [], 'a well-contrasted palette raises none');
  ok(validatePack(good()).warnings.length === 1, 'while the Sunset copy\'s 3.8:1 highlight is named, still not refused');
}

/* 4. ids */
{
  eq(packIdOf('Ancient Rome!'), 'ancient-rome', 'a pack id comes from the name');
  eq(packIdOf('Ünït 3: The Roman Republic and Empire').length <= 14, true, 'and is at most 14 characters');
  eq(packIdOf('???'), 'pack', 'a name with no letters still has an id');
  ok(!packIdOf('abcdefghijklm-nop').endsWith('-'), 'an id never ends in a dash');
  const longest = packThemeId('a'.repeat(14), 'b'.repeat(20));
  ok(longest.length <= 40, 'the longest theme id fits np_theme\'s 40: ' + longest.length);
  ok(!Object.prototype.hasOwnProperty.call(THEMES, packThemeId('x', 'y')), 'a pack theme id cannot be a built-in id');
  eq(labelOf('ancient-rome'), 'Ancient Rome', 'a theme label is its id in words');
}

/* 5. storing, resolving, exporting */
{
  let doc = blank();
  const a = addPack(doc, validatePack(good()).pack);
  eq(Object.keys(a.doc.packs), ['ancient-rome'], 'a pack is stored under its id');
  eq(a.replaced, false, 'the first import is not a replacement');
  const again = addPack(a.doc, { ...validatePack(good()).pack, themes: { forum: rome() } });
  eq([again.replaced, Object.keys(again.doc.packs['ancient-rome'].themes)], [true, ['forum']], 'the same name replaces the pack');
  const full = Array.from({ length: MAX_PACKS }, (_, i) => i).reduce((d, i) => addPack(d, { ...validatePack(good()).pack, name: 'Unit ' + String.fromCharCode(65 + i) }).doc, blank());
  eq(Object.keys(full.packs).length, MAX_PACKS, 'twelve packs fit');
  ok(!!addPack(full, { ...validatePack(good()).pack, name: 'One more' }).error, 'a thirteenth is refused with a sentence');
  ok(!addPack(full, { ...validatePack(good()).pack, name: 'Unit A' }).error, 'but replacing one of the twelve is allowed');
  const res = resolve(a.doc);
  eq(Object.keys(res), ['pk-ancient-rome-forum', 'pk-ancient-rome-colosseum'], 'resolve() gives each theme under its picked id');
  eq(res['pk-ancient-rome-forum'].vars['--accent-fill'], rome()['--accent'], 'a theme with no --accent-fill fills with its accent, as themeVars does');
  eq(res['pk-ancient-rome-forum'].vars, themeVars('classroom'), 'and a pack copy of a built-in theme resolves to exactly the built-in\'s variables');
  eq(res['pk-ancient-rome-colosseum'].label, 'Colosseum', 'with a label');
  const out = exportPack(a.doc, 'ancient-rome');
  eq(validatePack(out).ok, true, 'an exported pack is a valid pack');
  eq(validatePack(out).pack, validatePack(good()).pack, 'and imports as the same pack');
  eq(exportPack(a.doc, 'nope'), null, 'an unknown pack exports nothing');
  eq(Object.keys(removePack(a.doc, 'ancient-rome').packs), [], 'remove forgets a pack');
  eq(Object.keys(removePack(a.doc, 'nope').packs), ['ancient-rome'], 'and an unknown id changes nothing');
}

/* 6. the stored document is repaired, never trusted */
{
  eq(fix(null), blank(), 'null repairs to an empty document');
  eq(fix({ packs: 'x' }), blank(), 'a packs field that is not an object repairs to empty');
  const messy = { v: 9, packs: { 'ancient-rome': { name: 'Ok', themes: { a: rome() } }, 'BAD ID': { name: 'x', themes: { a: rome() } }, hand: { name: 'Hand edited', themes: { a: { '--bg': 'url(x)' } } } } };
  eq(Object.keys(fix(messy).packs), ['ancient-rome'], 'a hand-edited entry and a bad id are dropped, the good pack kept');
}

/* 7. the store holds it */
{
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } };
  const store = createStore({ storage });
  eq(store.get('themePacks'), blank(), 'a fresh store gives an empty document');
  const doc = addPack(blank(), validatePack(good()).pack).doc;
  store.set('themePacks', doc);
  eq(JSON.parse(mem.get('np_theme_packs')), doc, 'it is stored as plain JSON under np_theme_packs');
  mem.set('np_theme_packs', '{"packs":{"a":{"name":"x","themes":{"t":{"--bg":"url(x)"}}}}}');
  eq(createStore({ storage }).get('themePacks'), blank(), 'a poisoned stored value is repaired on read');
  eq(fixBundle({ np_theme_packs: { v: 1, packs: { 'ancient-rome': { name: 'Ok', themes: { a: rome() } } } } }), { np_theme_packs: { v: 1, packs: { 'ancient-rome': { name: 'Ok', themes: { a: rome() } } } } }, 'a backup file\'s packs pass through fixBundle');
  eq(fixBundle({ np_theme_packs: 'x' }), {}, 'and a bad one is skipped');
}

console.log(`\ntheme-packs: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
