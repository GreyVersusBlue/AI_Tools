/* irregulars.js — the irregular verbs the poster's call-out box offers.
 *
 * Data only. Each entry is one verb in one tense, six forms in the person order
 * the poster's own templates use (Spanish: yo, tú, él/ella/usted, nosotros,
 * vosotros, ellos/ellas/ustedes; French: je, tu, il/elle/on, nous, vous,
 * ils/elles), written the way the templates in the page write them.
 *
 * The tenses are exactly the ones the page has a starter template for: Spanish
 * present, preterite, imperfect and future; French present and imperfect. A verb
 * is here only when its forms are ones the author was sure of; a verb he was
 * not sure of is left out rather than guessed. NOTHING HERE HAS BEEN REVIEWED
 * BY A LANGUAGE TEACHER. Each form was written from the standard textbook
 * paradigm (Spanish: the Real Academia Española's "Diccionario de la lengua
 * española" conjugation tables and its "Nueva gramática"; French: the Bescherelle
 * "L'art de conjuguer" tables) as remembered, not copied from a file, and not
 * run against either book in this session. The suite checks only the shape
 * (six non-empty forms, no duplicate verb, a fixed set of known stems), not
 * the Spanish or French. HISTORY.md lists every verb for review.
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

  function v(id, name, forms) { return { id: id, name: name, forms: forms.split(' ') }; }
  function tense(lang, key, name, defaults, verbs, note) {
    var t = { lang: lang, tense: key, name: name, defaults: defaults, verbs: verbs };
    if (note) t.note = note;
    return t;
  }

  var tenses = {};
  function add(t) { tenses[t.lang + ':' + t.tense] = t; }

  add(tense('es', 'present', 'Present', ['ir', 'tener', 'hacer', 'venir'], [
    v('ser', 'ser (to be)', 'soy eres es somos sois son'),
    v('estar', 'estar (to be)', 'estoy estás está estamos estáis están'),
    v('ir', 'ir (to go)', 'voy vas va vamos vais van'),
    v('tener', 'tener (to have)', 'tengo tienes tiene tenemos tenéis tienen'),
    v('hacer', 'hacer (to do, make)', 'hago haces hace hacemos hacéis hacen'),
    v('venir', 'venir (to come)', 'vengo vienes viene venimos venís vienen'),
    v('decir', 'decir (to say)', 'digo dices dice decimos decís dicen'),
    v('poder', 'poder (to be able)', 'puedo puedes puede podemos podéis pueden')
  ]));

  add(tense('es', 'preterite', 'Preterite', ['ser', 'ir', 'tener', 'hacer'], [
    v('ser', 'ser (to be)', 'fui fuiste fue fuimos fuisteis fueron'),
    v('ir', 'ir (to go)', 'fui fuiste fue fuimos fuisteis fueron'),
    v('tener', 'tener (to have)', 'tuve tuviste tuvo tuvimos tuvisteis tuvieron'),
    v('hacer', 'hacer (to do, make)', 'hice hiciste hizo hicimos hicisteis hicieron'),
    v('estar', 'estar (to be)', 'estuve estuviste estuvo estuvimos estuvisteis estuvieron'),
    v('decir', 'decir (to say)', 'dije dijiste dijo dijimos dijisteis dijeron'),
    v('poder', 'poder (to be able)', 'pude pudiste pudo pudimos pudisteis pudieron'),
    v('venir', 'venir (to come)', 'vine viniste vino vinimos vinisteis vinieron')
  ]));

  add(tense('es', 'imperfect', 'Imperfect', ['ser', 'ir', 'ver'], [
    v('ser', 'ser (to be)', 'era eras era éramos erais eran'),
    v('ir', 'ir (to go)', 'iba ibas iba íbamos ibais iban'),
    v('ver', 'ver (to see)', 'veía veías veía veíamos veíais veían')
  ]));

  add(tense('es', 'future', 'Future', ['tener', 'hacer', 'decir', 'poder'], [
    v('tener', 'tener (to have)', 'tendré tendrás tendrá tendremos tendréis tendrán'),
    v('hacer', 'hacer (to do, make)', 'haré harás hará haremos haréis harán'),
    v('decir', 'decir (to say)', 'diré dirás dirá diremos diréis dirán'),
    v('poder', 'poder (to be able)', 'podré podrás podrá podremos podréis podrán'),
    v('venir', 'venir (to come)', 'vendré vendrás vendrá vendremos vendréis vendrán'),
    v('saber', 'saber (to know)', 'sabré sabrás sabrá sabremos sabréis sabrán'),
    v('querer', 'querer (to want)', 'querré querrás querrá querremos querréis querrán'),
    v('salir', 'salir (to leave)', 'saldré saldrás saldrá saldremos saldréis saldrán')
  ]));

  add(tense('fr', 'present', 'Present', ['être', 'avoir', 'aller', 'faire'], [
    v('être', 'être (to be)', 'suis es est sommes êtes sont'),
    v('avoir', 'avoir (to have)', 'ai as a avons avez ont'),
    v('aller', 'aller (to go)', 'vais vas va allons allez vont'),
    v('faire', 'faire (to do, make)', 'fais fais fait faisons faites font'),
    v('pouvoir', 'pouvoir (to be able)', 'peux peux peut pouvons pouvez peuvent'),
    v('vouloir', 'vouloir (to want)', 'veux veux veut voulons voulez veulent'),
    v('venir', 'venir (to come)', 'viens viens vient venons venez viennent'),
    v('prendre', 'prendre (to take)', 'prends prends prend prenons prenez prennent')
  ]));

  add(tense('fr', 'imperfect', 'Imperfect', ['être', 'avoir', 'aller', 'faire'], [
    v('être', 'être (to be)', 'étais étais était étions étiez étaient'),
    v('avoir', 'avoir (to have)', 'avais avais avait avions aviez avaient'),
    v('aller', 'aller (to go)', 'allais allais allait allions alliez allaient'),
    v('faire', 'faire (to do, make)', 'faisais faisais faisait faisions faisiez faisaient'),
    v('pouvoir', 'pouvoir (to be able)', 'pouvais pouvais pouvait pouvions pouviez pouvaient'),
    v('vouloir', 'vouloir (to want)', 'voulais voulais voulait voulions vouliez voulaient')
  ], 'Only être has an irregular imperfect stem (ét-). The others are irregular in the present and take the regular endings on the nous-form stem.'));

  window.VCP_IRREGULARS = {
    languages: {
      es: { name: 'Spanish', persons: ES_PERSONS },
      fr: { name: 'French', persons: FR_PERSONS }
    },
    tenses: tenses
  };
})();
