// theme-packs.test.mjs — htcm-theme-packs.js, the pure half (BACKLOG rank 150): what a theme pack
// file must be, the key a theme gets, the contrast rule, and the stored list.
//
//   node Tools/historical-trading-card-maker/test/theme-packs.test.mjs      (pure Node, no browser)
//
// The module is a classic script that reads `window`; it is run in a vm context with a fake
// localStorage and the frame and texture names the page would give it. Exits 1 on any failure.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, '..', 'htcm-theme-packs.js'), 'utf8');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function fresh(stored) {
  const store = new Map(stored ? [['htcm:themepacks', stored]] : []);
  const window = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => store.delete(k) },
    HtcmFrames: { FRAMES: { plain: {}, 'greek-key': {}, filigree: {} } },
    HtcmThemes: { TEXTURES: ['parchment', 'grid'], setPackThemes() {} },
  };
  window.window = window;
  vm.runInNewContext(SRC, window);
  return { P: window.HtcmThemePacks, store };
}
const theme = over => Object.assign({ id: 'forum', label: 'Forum', frame: 'greek-key', texture: 'parchment', font: 'Georgia, serif',
  ink: '#3d2b1f', paper: '#f4e9d0', accent: '#8a6d1d', accent2: '#5b4636' }, over);
const pack = (over, themes) => Object.assign({ v: 1, name: 'Rome unit', themes: themes || [theme()] }, over);

const { P } = fresh();

console.log('1. a good pack');
let r = P.validate(pack());
ok(r.ok, 'a pack with one good theme is accepted');
eq(r.pack.themes[0].nameFont, null, 'a missing nameFont is stored as null');
eq(r.pack.themes[0].ink, '#3d2b1f', 'and a colour is stored lower-case');
eq(P.validate(pack({}, [theme({ ink: '#3D2B1F', paper: '#FFF', texture: undefined, frame: undefined })])).pack.themes[0].paper, '#fff', 'three-digit and upper-case hex are accepted, texture and frame optional');
eq(P.validate(pack({}, [theme({ frame: undefined, texture: undefined })])).pack.themes[0].frame, 'plain', 'a missing frame is plain');
eq(P.keyFor('Rome unit', 'forum'), 'pk-rome-unit-forum', 'the key is pk-<pack>-<id>');
eq(P.keyFor('Rome unit', 'forum').startsWith('pk-'), true, 'and always starts pk-, so it cannot be a built-in key');
ok(P.keyFor('A very long pack name indeed', 'a-theme-id-of-twenty').length <= 40, 'a key is at most 40 characters');
eq(P.themesOf([r.pack])[0].key, 'pk-rome-unit-forum', 'themesOf() gives each theme its key');
eq(P.themesOf([r.pack])[0].pack, 'Rome unit', 'and the pack it came from (what setPackThemes() clears by)');

console.log('2. what is refused');
const bad = (obj, re, label) => { const x = P.validate(obj); ok(!x.ok && x.pack === null && x.errors.some(e => re.test(e)), label + ' ' + JSON.stringify(x.errors)); };
bad(null, /not a theme pack/, 'null');
bad([], /not a theme pack/, 'an array');
bad(pack({ v: 2 }), /"v" must be 1/, 'a version other than 1');
bad(pack({ name: '' }), /"name"/, 'an empty name');
bad(pack({ name: 'x'.repeat(41) }), /"name"/, 'a 41-character name');
bad(pack({ name: '!!!' }), /"name"/, 'a name with no letter or digit');
bad(pack({ themes: [] }), /at least one/, 'no themes');
bad(pack({ themes: Array.from({ length: 13 }, (_, i) => theme({ id: 't' + i })) }), /at most 12/, 'thirteen themes');
bad(pack({}, [theme({ id: 'Forum' })]), /"id"/, 'an upper-case id');
bad(pack({}, [theme({ id: 'a'.repeat(21) })]), /"id"/, 'a 21-character id');
bad(pack({}, [theme(), theme()]), /used twice/, 'a repeated id');
bad(pack({}, [theme({ label: '' })]), /"label"/, 'an empty label');
bad(pack({}, [theme({ label: 'x'.repeat(25) })]), /"label"/, 'a 25-character label');
bad(pack({}, [theme({ frame: 'baroque' })]), /"frame"/, 'a frame this tool does not draw');
bad(pack({}, [theme({ texture: 'plaid' })]), /"texture"/, 'a texture this tool does not draw');
bad(pack({}, [theme({ font: 'Georgia; background:url(//x)' })]), /"font"/, 'a font with a semicolon (a CSS injection)');
bad(pack({}, [theme({ font: 'a{}' })]), /"font"/, 'a font with braces');
bad(pack({}, [theme({ font: 'Georgia;' })]), /"font"/, 'a font with only a semicolon');
bad(pack({}, [theme({ font: 'Georgia\n' })]), /"font"/, 'a font with a newline');
bad(pack({}, [theme({ nameFont: '<b>' })]), /"nameFont"/, 'a nameFont with markup');
bad(pack({}, [theme({ accent: 'red' })]), /"accent" must be a 3- or 6-digit hex/, 'a colour name');
bad(pack({}, [theme({ paper: 'url(x)' })]), /"paper"/, 'a url() colour');
bad(pack({}, [theme({ ink: '#abcd' })]), /"ink"/, 'a four-digit hex');
bad(pack({}, [theme({ ink: '#777777', paper: '#ffffff' })]), /ink on paper is 4\.\d:1/, 'ink that is too pale on its paper');
eq(P.validate(pack({}, [theme({ ink: '#767676', paper: '#ffffff' })])).ok, true, '#767676 on white (4.54:1) is just enough');
eq(P.validate(pack({}, [theme({ ink: '#777777', paper: '#ffffff' })])).ok, false, '#777777 on white (4.48:1) is not');
const two = P.validate(pack({}, [theme({ id: 'a', accent: 'red' }), theme({ id: 'b', paper: 'nope' })]));
ok(two.errors.length === 2 && /Theme 1 \(a\)/.test(two.errors[0]) && /Theme 2 \(b\)/.test(two.errors[1]), 'every problem is named, with its theme');
eq(P.validate(pack({}, [theme({ accent: '#f4e9d0' })])).warnings.length, 1, 'an accent under 3:1 on the paper is a warning, not a refusal');
eq(P.validate(pack({}, [theme({ accent: '#f4e9d0' })])).ok, true, 'and the pack is still accepted');

console.log('3. the stored list');
{
  const { P: Q, store } = fresh();
  eq(Q.load(), [], 'nothing stored: an empty list');
  const a = Q.validate(pack()).pack, b = Q.validate(pack({ name: 'Greece unit' })).pack;
  eq(Q.install(a), { ok: true, replaced: false }, 'a pack installs');
  eq(Q.install(b).replaced, false, 'a second pack installs beside it');
  eq(Q.load().map(p => p.name), ['Rome unit', 'Greece unit'], 'both come back, in order');
  const a2 = Q.validate(pack({}, [theme({ id: 'villa', label: 'Villa' })])).pack;
  eq(Q.install(a2).replaced, true, 'a pack of the same name replaces the earlier one');
  eq(Q.load().find(p => p.name === 'Rome unit').themes.map(t => t.id), ['villa'], 'and nothing of the old one stays');
  eq(Q.remove('Rome unit'), true, 'a pack can be removed');
  eq(Q.load().map(p => p.name), ['Greece unit'], 'and the other stays');
  for (let i = 0; i < 12; i++) Q.install(Q.validate(pack({ name: 'Pack ' + i })).pack);
  eq(Q.load().length, 12, 'at most twelve packs are kept');
  eq(Q.install(Q.validate(pack({ name: 'One too many' })).pack).ok, false, 'a thirteenth is refused and says why');
  store.set('htcm:themepacks', JSON.stringify([pack(), { v: 1, name: 'Bad', themes: [theme({ ink: 'red' })] }, 'junk', pack()]));
  eq(Q.load().map(p => p.name), ['Rome unit'], 'a stored pack that no longer checks out, junk and a repeated name are dropped on load');
  store.set('htcm:themepacks', '{not json');
  eq(Q.load(), [], 'unreadable storage is an empty list, not an error');
}

console.log('4. the export round-trips');
{
  const a = P.validate(pack({}, [theme(), theme({ id: 'villa', label: 'Villa', nameFont: 'Georgia, serif' })])).pack;
  const text = P.toFile(a);
  const back = P.validate(JSON.parse(text));
  ok(back.ok, 'an exported pack validates again');
  eq(back.pack, a, 'and comes back as the same pack');
  eq(Object.keys(JSON.parse(text)), ['v', 'name', 'themes'], 'the file holds only v, name and themes');
  ok(!('nameFont' in JSON.parse(text).themes[0]) && 'nameFont' in JSON.parse(text).themes[1], 'a null nameFont is left out of the file, a set one is kept');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
