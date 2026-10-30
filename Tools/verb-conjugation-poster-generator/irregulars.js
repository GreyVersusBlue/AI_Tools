/* irregulars.js — the irregular verbs the poster's call-out box offers.
 *
 * Which verbs, in which tense, in which order, with which gloss: that is data here.
 * The six forms of each are computed from the pattern engine (_shared/conjugate.js and
 * its packs, which the page loads first) when this file loads, so the tables the
 * poster offers and the ones 039 drills cannot disagree. Each entry is one verb in
 * one tense, six forms in the person order the poster's own templates use (Spanish: yo, tú, él/ella/usted, nosotros,
 * vosotros, ellos/ellas/ustedes; French: je, tu, il/elle/on, nous, vous,
 * ils/elles), written the way the templates in the page write them.
 *
 * The tenses are exactly the ones the page has a starter template for: Spanish
 * present, preterite, imperfect and future; French present and imperfect. A verb
 * is here only when its forms are ones the author was sure of; a verb he was
 * not sure of is left out rather than guessed. NOTHING HERE HAS BEEN REVIEWED
 * BY A LANGUAGE TEACHER. The 41 tables were first typed from the standard textbook
 * paradigm as remembered, then (Path 19 P3) replaced by the engine's; the old
 * literals are frozen in Tools/conjugate/test/_079-irregulars-frozen.json, and
 * test:conjugate holds the engine to them form by form. The suite checks the shape
 * (six non-empty forms, no duplicate verb), not the Spanish or French.
 *
 * `window.VCP_IRREGULARS`:
 *   languages: { es: { name, persons }, fr: { ... } }
 *   tenses:    { 'es:present': { lang, tense, name, note?, defaults: [ids], verbs: [ { id, name, forms } ] } }
 * `defaults` are the ids shown when a teacher first turns the box on (four of
 * them, or all three where only three are offered). `note`, when set, prints
 * under the box.
 */
(function () {
  'use strict';

  var ES_PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
  var FR_PERSONS = ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'];

  if (!window.Conjugate) throw new Error('irregulars.js needs _shared/conjugate.js and the language packs loaded first');
  function v(id, name) { return { id: id, name: name }; }
  function tense(lang, key, name, defaults, verbs, note) {
    verbs.forEach(function (x) { x.forms = window.Conjugate.conjugate(lang, x.id, key).forms; });
    var t = { lang: lang, tense: key, name: name, defaults: defaults, verbs: verbs };
    if (note) t.note = note;
    return t;
  }

  var tenses = {};
  function add(t) { tenses[t.lang + ':' + t.tense] = t; }

  add(tense('es', 'present', 'Present', ['ir', 'tener', 'hacer', 'venir'], [
    v('ser', 'ser (to be)'),
    v('estar', 'estar (to be)'),
    v('ir', 'ir (to go)'),
    v('tener', 'tener (to have)'),
    v('hacer', 'hacer (to do, make)'),
    v('venir', 'venir (to come)'),
    v('decir', 'decir (to say)'),
    v('poder', 'poder (to be able)')
  ]));

  add(tense('es', 'preterite', 'Preterite', ['ser', 'ir', 'tener', 'hacer'], [
    v('ser', 'ser (to be)'),
    v('ir', 'ir (to go)'),
    v('tener', 'tener (to have)'),
    v('hacer', 'hacer (to do, make)'),
    v('estar', 'estar (to be)'),
    v('decir', 'decir (to say)'),
    v('poder', 'poder (to be able)'),
    v('venir', 'venir (to come)')
  ]));

  add(tense('es', 'imperfect', 'Imperfect', ['ser', 'ir', 'ver'], [
    v('ser', 'ser (to be)'),
    v('ir', 'ir (to go)'),
    v('ver', 'ver (to see)')
  ]));

  add(tense('es', 'future', 'Future', ['tener', 'hacer', 'decir', 'poder'], [
    v('tener', 'tener (to have)'),
    v('hacer', 'hacer (to do, make)'),
    v('decir', 'decir (to say)'),
    v('poder', 'poder (to be able)'),
    v('venir', 'venir (to come)'),
    v('saber', 'saber (to know)'),
    v('querer', 'querer (to want)'),
    v('salir', 'salir (to leave)')
  ]));

  add(tense('fr', 'present', 'Present', ['être', 'avoir', 'aller', 'faire'], [
    v('être', 'être (to be)'),
    v('avoir', 'avoir (to have)'),
    v('aller', 'aller (to go)'),
    v('faire', 'faire (to do, make)'),
    v('pouvoir', 'pouvoir (to be able)'),
    v('vouloir', 'vouloir (to want)'),
    v('venir', 'venir (to come)'),
    v('prendre', 'prendre (to take)')
  ]));

  add(tense('fr', 'imperfect', 'Imperfect', ['être', 'avoir', 'aller', 'faire'], [
    v('être', 'être (to be)'),
    v('avoir', 'avoir (to have)'),
    v('aller', 'aller (to go)'),
    v('faire', 'faire (to do, make)'),
    v('pouvoir', 'pouvoir (to be able)'),
    v('vouloir', 'vouloir (to want)')
  ], 'Only être has an irregular imperfect stem (ét-). The others are irregular in the present and take the regular endings on the nous-form stem.'));

  window.VCP_IRREGULARS = {
    languages: {
      es: { name: 'Spanish', persons: ES_PERSONS },
      fr: { name: 'French', persons: FR_PERSONS }
    },
    tenses: tenses
  };
})();
