// speak.test.mjs — _shared/speak.js (Path 19 P5), the pure half and the speaking half against a
// fake speechSynthesis. No browser, no voice: whether a real speaker says a word is not tested.
//
//   node Tools/speak/test/speak.test.mjs
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '_shared', 'speak.js'), 'utf8');
function load(root) { new Function('window', 'globalThis', src.replace(/\}\)\(typeof window !== 'undefined' \? window : globalThis\);\s*$/, '})(window);'))(root, root); return root.Speak; }

let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const none = load({});
eq(none.supported(), false, 'no speechSynthesis: not supported');
eq(none.say('hola', 'es'), false, 'and say() is false');
eq(none.voicesFor('es-ES'), [], 'and no voices');
eq(none.hasVoice('es-ES'), false, 'and hasVoice is false');
none.stop();

const S = none;
eq(S.langTag('es'), 'es-ES', 'es -> es-ES');
eq(S.langTag('FR'), 'fr-FR', 'case-insensitive');
eq(S.langTag('la'), 'la', 'Latin has no region');
eq(S.langTag('pt-BR'), 'pt-BR', 'a full tag is kept');
eq(S.langTag('es_MX'), 'es-MX', 'an underscore tag is mended');
eq(S.langTag('klingon'), '', 'an unknown id is no tag');
eq(S.langTag(null), '', 'null');
eq(S.primary('es-MX'), 'es', 'primary subtag');
const voices = [{ name: 'a', lang: 'es_MX' }, { name: 'b', lang: 'en-US' }, { name: 'c', lang: 'es-ES' }, { name: 'd', lang: 'ES-ar' }];
eq(S.matchVoices(voices, 'es-ES').map(v => v.name), ['c', 'a', 'd'], 'exact tag first, then the same language');
eq(S.matchVoices(voices, 'fr-FR'), [], 'no French voice');
eq(S.matchVoices(voices, ''), [], 'no tag');
eq(S.matchVoices(null, 'es'), [], 'no voice list');

const log = [];
class Utt { constructor(t) { this.text = t; } }
const listeners = {};
let list = [];
const fake = { speechSynthesis: { getVoices: () => list, cancel: () => log.push('cancel'), speak: u => log.push(['speak', u.text, u.lang, u.voice && u.voice.name]),
  addEventListener: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, removeEventListener: (e, f) => { listeners[e] = (listeners[e] || []).filter(x => x !== f); } },
  SpeechSynthesisUtterance: Utt };
const T = load(fake);
ok(T.supported(), 'supported with speechSynthesis and an utterance class');
eq(T.hasVoice('es-ES'), false, 'before the voices are listed there is none');
let heard = 0; T.onVoices(() => heard++);
eq(heard, 0, 'onVoices waits for the list');
list = voices; listeners.voiceschanged.forEach(f => f());
eq(heard, 1, 'onVoices fires when the voices arrive');
ok(!(listeners.voiceschanged || []).length, 'and removes its listener');
T.onVoices(() => heard++);
eq(heard, 2, 'with voices already listed it fires at once');
eq(T.hasVoice('es'), true, 'a bare language also finds its voices');
eq(T.hasVoice(T.langTag('es')), true, 'a Spanish voice exists');
ok(T.say('la mesa', 'es'), 'say returns true');
eq(log.pop(), ['speak', 'la mesa', 'es-ES', 'c'], 'it speaks the text in the tag, with the best voice');
eq(log.pop(), 'cancel', 'after cancelling what was being said');
ok(T.say('hello', 'xx-YY'), 'an unknown region still speaks');
eq(log.pop()[2], 'xx-YY', 'in the tag it was given');
ok(!T.say('   ', 'es') && !T.say(null, 'es'), 'blank text is not spoken');
ok(T.say('x'), 'no language still speaks');
eq(log.pop().slice(2), [undefined, undefined], 'with no language and no voice');
T.stop(); eq(log.pop(), 'cancel', 'stop cancels');

if (failures) { console.error(failures + ' of ' + checks + ' checks failed'); process.exit(1); }
console.log('speak: ' + checks + ' checks passed');
