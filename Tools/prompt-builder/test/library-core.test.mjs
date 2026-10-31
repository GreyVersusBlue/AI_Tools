// library-core.test.mjs — the shape of 029's task-organized prompt library, pure Node.
//   node Tools/prompt-builder/test/library-core.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(here, '..', 'pb-library.js'), 'utf8'), ctx);
const L = ctx.PromptLibrary;
const page = readFileSync(path.join(here, '..', '..', '029-prompt-builder.html'), 'utf8');

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Prompt library — shape');
const staticIds = JSON.parse('[' + /const STATIC_IDS = \[([\s\S]*?)\];/.exec(page)[1].replace(/'/g, '"').replace(/\s+/g, ' ').replace(/,\s*$/, '') + ']');
const presetKeys = [...page.matchAll(/^ {4}(\w+): \{\n {6}toolType:/gm)].map(m => m[1]);
ok(staticIds.length > 20 && presetKeys.length >= 8, `read the page's field ids (${staticIds.length}) and presets (${presetKeys.length})`);

const all = L.all();
ok(all.length >= 12, 'at least twelve entries');
eq(new Set(all.map(e => e.id)).size, all.length, 'entry ids are unique');
eq(new Set(L.GROUPS.map(g => g.id)).size, L.GROUPS.length, 'group ids are unique');
ok(L.GROUPS.every(g => g.title && g.entries.length >= 2), 'every group has a title and at least two entries');
ok(all.every(e => e.title && e.about && e.about.length < 110), 'every entry has a title and a one-line blurb');
ok(all.every(e => (e.preset ? 1 : 0) + (e.fields ? 1 : 0) === 1), 'an entry is a preset or a form state, never both or neither');
ok(all.filter(e => e.preset).every(e => presetKeys.includes(e.preset)), "every preset an entry names is in the page's PRESETS");
const usedPresets = new Set(all.filter(e => e.preset).map(e => e.preset));
eq(presetKeys.filter(k => !usedPresets.has(k)), [], 'every example on the page is filed under a task');
const extra = new Set(['toolTypeOther', 'toneOther', 'dyn']);
ok(all.filter(e => e.fields).every(e => Object.keys(e.fields).every(k => staticIds.includes(k) || extra.has(k))), 'form states use only fields the page has');
ok(all.filter(e => e.fields).every(e => Object.values(e.fields).filter(v => typeof v === 'string').every(v => v.trim() && v.length < 400)), 'no empty or huge field');
ok(all.filter(e => e.fields).every(e => L.placeholders(e).length >= 1), 'each new entry leaves at least one blank to fill');
ok(all.filter(e => e.fields).every(e => !('name' in e.fields) && !('grade' in e.fields) && !('subject' in e.fields)), "no entry sets the teacher's own name, grade or subject");
ok(all.filter(e => e.fields).every(e => /no student names|without a student|no names|not a plan|without/i.test(JSON.stringify(e.fields)) || e.id === 'readingLevel' || e.id === 'familyTranslation'), 'the entries that touch students say to leave names out');

console.log('Prompt library — lookups');
eq(L.find('quiz').preset, 'quiz', 'find by id');
eq(L.find('nope'), null, 'unknown id is null');
eq(L.search('').length, all.length, 'a blank search matches everything');
eq(L.search('   ').length, all.length, 'spaces only match everything');
ok(L.search('feedback').includes('feedbackBank') && L.search('FEEDBACK').includes('feedbackBank'), 'search is case-insensitive');
ok(L.search('families').includes('email') && L.search('families').includes('familyTranslation'), "search sees a group's name");
eq(L.search('zzzz'), [], 'no match gives none');
ok(L.search('feedback comment').length === 1 && L.search('comment feedback').length === 1, 'every word must match, in any order');
eq(L.placeholders({ fields: { a: '{{ Topic }} and {{topic}} and {{ two  words }}' } }), ['topic', 'two words'], 'placeholders are de-duplicated and normalized');
eq(L.placeholders({ preset: 'quiz' }), [], 'a preset entry names no blanks of its own');
eq(L.placeholders(null), [], 'null is safe');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
