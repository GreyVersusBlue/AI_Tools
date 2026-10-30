/* conjugate-fr.js — the French pack for Conjugate (Path 19 P3).
 *
 * Six tenses: présent, passé composé, imparfait, futur simple, conditionnel présent,
 * subjonctif présent. Persons are six fixed slots: je, tu, il, nous, vous, ils.
 *
 * Devon's answers, 2026-10-21, are built in: the passé composé prints the masculine singular
 * (every cell with être as its auxiliary is noted "agreement"); s'asseoir is out; spelling is
 * pre-1990 (appeler → appellerai, préférer → préférerai); payer gives both paie and paye.
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. The records were written from the standard
 * paradigm as remembered, not copied from a table, and checked only against the regular
 * patterns, the forms 079's poster page ships, and a second derivation (Tools/conjugate/test).
 * A teacher reads it before any table is called reviewed.
 *
 * Records are sparse: the imparfait comes from the nous form of the présent, the subjonctif from
 * the ils and nous forms, the futur from the infinitive unless the record names a stem.
 */
(function () {
  'use strict';
  var R = {};
  function rec(inf, o) { o.infinitive = inf; R[inf] = o; return o; }
  function pr(s) { var o = {}; s.split(' ').forEach(function (f, i) { if (f !== '.') o[i] = f; }); return o; }
  function prefixed(o, list) { o.prefixes = list; return o; }

  // ---- the irregulars --------------------------------------------------------
  rec('être', { 'class': 're', forms: { present: pr('suis es est sommes êtes sont'), subjunctive: pr('sois sois soit soyons soyez soient') }, stems: { imperfect: 'ét', future: 'ser' }, participle: 'été' });
  rec('avoir', { 'class': 're', forms: { present: pr('ai as a avons avez ont'), subjunctive: pr('aie aies ait ayons ayez aient') }, stems: { future: 'aur' }, participle: 'eu' });
  rec('aller', { forms: { present: pr('vais vas va allons allez vont') }, stems: { future: 'ir', subjunctive: ['aill', 'all'] }, auxiliary: 'être' });
  prefixed(rec('faire', { 'class': 're', forms: { present: pr('fais fais fait faisons faites font') }, stems: { future: 'fer', subjunctive: 'fass' }, participle: 'fait' }), ['dé', 're', 'contre', 'satis']);
  rec('dire', { 'class': 're', forms: { present: pr('dis dis dit disons dites disent') }, participle: 'dit', prefixes: ['re'] });
  prefixed(rec('venir', { 'class': 'ir', forms: { present: pr('viens viens vient venons venez viennent') }, stems: { future: 'viendr' }, participle: 'venu', auxiliary: 'être' }), ['de', 're', 'par', 'sur', 'inter', 'sou']);
  prefixed(rec('tenir', { 'class': 'ir', forms: { present: pr('tiens tiens tient tenons tenez tiennent') }, stems: { future: 'tiendr' }, participle: 'tenu' }), ['ap', 'con', 'ob', 're', 'sou', 'main', 'dé', 'abs', 'entre']);
  prefixed(rec('prendre', { 'class': 're', forms: { present: pr('prends prends prend prenons prenez prennent') }, participle: 'pris' }), ['ap', 'com', 're', 'sur', 'dé', 'entre', 'mé']);
  prefixed(rec('mettre', { 'class': 're', forms: { present: pr('mets mets met mettons mettez mettent') }, participle: 'mis' }), ['ad', 'com', 'dé', 'é', 'em', 'entre', 'o', 'per', 'pro', 're', 'sou', 'trans']);
  rec('pouvoir', { 'class': 'oir', forms: { present: pr('peux peux peut pouvons pouvez peuvent') }, stems: { future: 'pourr', subjunctive: 'puiss' }, participle: 'pu' });
  rec('vouloir', { 'class': 'oir', forms: { present: pr('veux veux veut voulons voulez veulent') }, stems: { future: 'voudr', subjunctive: ['veuill', 'voul'] }, participle: 'voulu' });
  rec('devoir', { 'class': 'oir', forms: { present: pr('dois dois doit devons devez doivent') }, stems: { future: 'devr' }, participle: 'dû' });
  rec('savoir', { 'class': 'oir', forms: { present: pr('sais sais sait savons savez savent') }, stems: { future: 'saur', subjunctive: 'sach' }, participle: 'su' });
  rec('voir', { 'class': 'oir', forms: { present: pr('vois vois voit voyons voyez voient') }, stems: { future: 'verr' }, participle: 'vu', prefixes: ['re', 'entre'] });
  rec('recevoir', { 'class': 'oir', forms: { present: pr('reçois reçois reçoit recevons recevez reçoivent') }, stems: { future: 'recevr' }, participle: 'reçu' });
  rec('valoir', { 'class': 'oir', forms: { present: pr('vaux vaux vaut valons valez valent') }, stems: { future: 'vaudr', subjunctive: ['vaill', 'val'] }, participle: 'valu' });
  rec('pleuvoir', { 'class': 'oir', defective: { slots: [2] }, forms: { present: pr('. . pleut . . .') }, stems: { imperfect: 'pleuv', future: 'pleuvr', subjunctive: 'pleuv' }, participle: 'plu' });
  rec('falloir', { 'class': 'oir', defective: { slots: [2] }, forms: { present: pr('. . faut . . .') }, stems: { imperfect: 'fall', future: 'faudr', subjunctive: 'faill' }, participle: 'fallu' });
  rec('croire', { 'class': 're', forms: { present: pr('crois crois croit croyons croyez croient') }, participle: 'cru' });
  rec('boire', { 'class': 're', forms: { present: pr('bois bois boit buvons buvez boivent') }, participle: 'bu' });
  rec('lire', { 'class': 're', forms: { present: pr('lis lis lit lisons lisez lisent') }, participle: 'lu', prefixes: ['re'] });
  rec('écrire', { 'class': 're', forms: { present: pr('écris écris écrit écrivons écrivez écrivent') }, participle: 'écrit', prefixes: ['ré'] });
  prefixed(rec('crire', { 'class': 're', forms: { present: pr('cris cris crit crivons crivez crivent') }, participle: 'crit' }), ['dé', 'ins', 'pres', 'pros', 'trans', 'sous']);
  prefixed(rec('connaître', { 'class': 're', forms: { present: pr('connais connais connaît connaissons connaissez connaissent') }, participle: 'connu' }), ['re', 'mé']);
  prefixed(rec('paraître', { 'class': 're', forms: { present: pr('parais parais paraît paraissons paraissez paraissent') }, participle: 'paru' }), ['ap', 'dis', 'com', 're']);
  prefixed(rec('courir', { 'class': 'ir', forms: { present: pr('cours cours court courons courez courent') }, stems: { future: 'courr' }, participle: 'couru' }), ['par', 'se', 'con', 'dis', 're']);
  rec('mourir', { 'class': 'ir', forms: { present: pr('meurs meurs meurt mourons mourez meurent') }, stems: { future: 'mourr' }, participle: 'mort', auxiliary: 'être' });
  prefixed(rec('rire', { 'class': 're', forms: { present: pr('ris ris rit rions riez rient') }, participle: 'ri' }), ['sou']);
  prefixed(rec('suivre', { 'class': 're', forms: { present: pr('suis suis suit suivons suivez suivent') }, participle: 'suivi' }), ['pour']);
  prefixed(rec('vivre', { 'class': 're', forms: { present: pr('vis vis vit vivons vivez vivent') }, participle: 'vécu' }), ['sur', 're']);
  prefixed(rec('naître', { 'class': 're', forms: { present: pr('nais nais naît naissons naissez naissent') }, participle: 'né', auxiliary: 'être' }), ['re']);
  prefixed(rec('plaire', { 'class': 're', forms: { present: pr('plais plais plaît plaisons plaisez plaisent') }, participle: 'plu' }), ['dé', 'com']);
  rec('haïr', { 'class': 'ir', forms: { present: pr('hais hais hait haïssons haïssez haïssent') }, stems: { future: 'haïr' }, participle: 'haï' });
  rec('-duire', { 'class': 'uire' });
  rec('-struire', { 'class': 'uire' });

  // -ir verbs conjugated on a shortened singular stem, and -ir verbs conjugated like -er
  ['partir', 'sortir'].forEach(function (v) { rec(v, { 'class': 'ir2', auxiliary: 'être' }); });
  ['dormir', 'servir', 'sentir'].forEach(function (v) { rec(v, { 'class': 'ir2' }); });
  [['ouvrir', 'ouvert'], ['offrir', 'offert'], ['couvrir', 'couvert'], ['souffrir', 'souffert']].forEach(function (a) { rec(a[0], { 'class': 'ir-er', participle: a[1] }); });

  // stem-changers
  ['acheter', 'lever', 'mener'].forEach(function (v) { rec(v, { stemChange: 'e>è' }); });
  ['préférer', 'espérer', 'répéter'].forEach(function (v) { rec(v, { stemChange: 'é>è' }); });
  rec('appeler', { stemChange: 'l>ll' });
  rec('jeter', { stemChange: 't>tt' });
  rec('envoyer', { stems: { future: 'enverr' } });

  // verbs that take être
  ['arriver', 'entrer', 'monter', 'descendre', 'rester', 'tomber', 'retourner', 'passer', 'rentrer'].forEach(function (v) { rec(v, { auxiliary: 'être' }); });

  var REG = {};
  ('parler aimer habiter chanter danser étudier regarder écouter travailler manger commencer payer essayer employer ' +
    'finir choisir réussir grandir vendre attendre répondre entendre perdre ' +
    'appuyer nettoyer conduire produire traduire construire détruire laver').split(' ').forEach(function (v) { REG[v] = true; });
  // conduire and its family are records ('-duire'); the names above only mark them known

  var IMP = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
  var MUTE = /^e(s|nt)?$|^er/;

  window.Conjugate.register({
    id: 'fr', name: 'French', reviewed: false,
    persons: ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'],
    subjects: ['je', 'tu', 'il', 'nous', 'vous', 'ils'],
    reflexive: { prefixes: ['se ', "s'"] },
    reflexivePronouns: ['me', 'te', 'se', 'nous', 'vous', 'se'],
    reflexiveAux: 'être', agreementAux: 'être',
    elision: { je: "j'", me: "m'", te: "t'", se: "s'" },
    aspirateH: ['haïr'],
    pronouns: {
      words: ['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'que'],
      elided: /^(?:j|m|t|s|qu)'\s*/,
      unelide: /(?:^|\s)(je|me|te|se|que)\s+(?=[aeiouhàâéèêëîïôûù])/g,
      unelideTo: { je: " j'", me: " m'", te: " t'", se: " s'", que: " qu'" }
    },
    classes: {
      er: { name: '-er', example: 'parler', suffixes: ['er'], futureSuffix: 'er', participle: { add: 'é' } },
      ir: { name: '-ir (finir)', example: 'finir', suffixes: ['ir', 'ïr'], not: /oir$/, futureSuffix: 'ir', participle: { add: 'i' } },
      re: { name: '-re', example: 'vendre', suffixes: ['re'], futureSuffix: 'r', participle: { add: 'u' } },
      ir2: { name: '-ir (partir)', example: 'partir', auto: false, futureSuffix: 'ir', shortSlots: [0, 1, 2], participle: { add: 'i' } },
      'ir-er': { name: '-ir like -er (ouvrir)', example: 'ouvrir', auto: false, futureSuffix: 'ir' },
      uire: { name: '-uire (conduire)', example: 'conduire', auto: false, cut: 3, futureSuffix: 'ir', participle: { add: 'it' } },
      oir: { name: '-oir', example: 'devoir', auto: false, cut: 3, futureSuffix: 'oir' }
    },
    stemChanges: {
      'e>è': { find: 'e', boot: 'è' },
      'é>è': { find: 'é', boot: 'è', 'in': ['present', 'subjunctive'] },
      'l>ll': { find: 'l', boot: 'll', atEnd: true },
      't>tt': { find: 't', boot: 'tt', atEnd: true }
    },
    tenses: [
      { id: 'present', name: 'Présent', mood: 'indicative', kind: 'simple', boot: [0, 1, 2, 5],
        endings: {
          er: ['e', 'es', 'e', 'ons', 'ez', 'ent'], 'ir-er': ['e', 'es', 'e', 'ons', 'ez', 'ent'],
          ir: ['is', 'is', 'it', 'issons', 'issez', 'issent'], uire: ['is', 'is', 'it', 'isons', 'isez', 'isent'],
          ir2: ['s', 's', 't', 'ons', 'ez', 'ent'], re: ['s', 's', '', 'ons', 'ez', 'ent']
        } },
      { id: 'passe-compose', name: 'Passé composé', mood: 'indicative', kind: 'compound', compound: { auxiliary: 'avoir', tense: 'present' } },
      { id: 'imperfect', name: 'Imparfait', mood: 'indicative', kind: 'derived',
        derived: { from: 'present', pick: [3, 3, 3, 3, 3, 3], cut: [3, 3, 3, 3, 3, 3] }, endings: { all: IMP } },
      { id: 'future', name: 'Futur simple', mood: 'indicative', kind: 'simple', boot: [0, 1, 2, 3, 4, 5], prependClassSuffix: true,
        endings: { all: ['ai', 'as', 'a', 'ons', 'ez', 'ont'] } },
      { id: 'conditional', name: 'Conditionnel présent', mood: 'conditional', kind: 'simple', boot: [0, 1, 2, 3, 4, 5], prependClassSuffix: true,
        stemsAlias: 'future', endings: { all: IMP } },
      { id: 'subjunctive', name: 'Subjonctif présent', mood: 'subjunctive', kind: 'derived',
        derived: { from: 'present', pick: [5, 5, 5, 3, 3, 5], cut: [3, 3, 3, 3, 3, 3] }, endings: { all: ['e', 'es', 'e', 'ions', 'iez', 'ent'] } }
    ],
    spelling: [
      { id: 'c>ç', cls: ['er'], stem: /c$/, next: /^[aouâ]/, stemRepl: [/c$/, 'ç'] },
      { id: 'g>ge', cls: ['er'], stem: /g$/, next: /^[aouâ]/, stemRepl: [/$/, 'e'] },
      { id: 'ç>c', cls: ['er'], stem: /ç$/, next: /^[eéiè]/, stemRepl: [/ç$/, 'c'] },
      { id: 'ge>g', cls: null, stem: /ge$/, next: /^i/, stemRepl: [/e$/, ''] },
      { id: 'y>i', cls: ['er'], stem: /[ou]y$/, next: MUTE, stemRepl: [/y$/, 'i'] },
      { id: 'y>i', cls: ['er'], stem: /ay$/, next: MUTE, stemRepl: [/y$/, 'i'], alt: true }
    ],
    records: R,
    regulars: REG
  });
})();
