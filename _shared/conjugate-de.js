/* conjugate-de.js — the German pack for Conjugate (Path 19 P3, increment 3).
 *
 * The engine's six tenses, mapped to German as plainly as they go:
 *   present      Präsens
 *   perfect      Perfekt (haben or sein + Partizip II)   <- the French passé composé's slot
 *   preterite    Präteritum
 *   future       Futur I (werden + infinitive)
 *   conditional  Konjunktiv II in its everyday würde + infinitive form
 *   subjunctive  Konjunktiv I (the reported-speech subjunctive, built on the infinitive stem)
 * There is no one-to-one match for the Spanish/French "present subjunctive" and "conditional":
 * Konjunktiv I is the nearest to the first and würde + infinitive to the second. Which German
 * tenses a course teaches is Devon's to say (BACKLOG.md, Path 19, "German questions").
 *
 * Persons are six fixed slots: ich, du, er/sie/es, wir, ihr, sie/Sie (the plural "they" and the
 * formal "you" are one form). A separable verb (aufmachen, ankommen, einkaufen) is a prefix glued
 * to a verb this pack knows: the engine moves the prefix to the end of a finite form (ich mache
 * auf) and puts it between ge- and the stem in the participle (aufgemacht).
 *
 * Reflexive verbs (sich waschen, sich anziehen) put the accusative pronoun after the finite verb. NOT BUILT: a
 * dative reflexive (sich etwas vorstellen).
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. The records were written from the standard
 * paradigm as remembered, not copied from a table; the forms in Tools/conjugate/test are the
 * author's own, and they are the teacher's to check. A teacher reads the sheet
 * (node Tools/conjugate/print-corpus.mjs de) before any table is called reviewed.
 *
 * Known gaps: the participle's "no ge-" test is a prefix heuristic (be-, emp-, ent-, er-, ge-,
 * miss-, ver-, zer- before four more letters, and -ieren), so bellen, ernten and a few like them
 * come out wrong; a verb the pack does not list is accepted as regular and marked unchecked.
 */
(function () {
  'use strict';
  var R = {};
  function rec(inf, o) { o.infinitive = inf; R[inf] = o; return o; }
  function pr(s) { var o = {}; s.split(' ').forEach(function (f, i) { if (f !== '.') o[i] = f; }); return o; }
  // a strong or mixed verb: its Präteritum stem, Partizip II and (when it is not haben) the auxiliary
  function strong(inf, pret, part, extra) {
    var o = { stems: { preterite: pret }, strong: true, participle: part };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return rec(inf, o);
  }
  function mixed(inf, pret, part, extra) {
    var o = { stems: { preterite: pret }, participle: part };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return rec(inf, o);
  }
  var SEIN = { auxiliary: 'sein' };

  // ---- the auxiliaries and the modals ---------------------------------------
  rec('sein', { 'class': 'n', forms: { present: pr('bin bist ist sind seid sind'), preterite: pr('war warst war waren wart waren'), subjunctive: pr('sei seiest sei seien seiet seien') }, participle: 'gewesen', auxiliary: 'sein' });
  rec('haben', { forms: { present: pr('habe hast hat haben habt haben'), preterite: pr('hatte hattest hatte hatten hattet hatten') }, participle: 'gehabt' });
  rec('werden', { forms: { present: pr('werde wirst wird werden werdet werden'), preterite: pr('wurde wurdest wurde wurden wurdet wurden') }, participle: 'geworden', auxiliary: 'sein' });
  rec('tun', { 'class': 'n', forms: { present: pr('tue tust tut tun tut tun'), preterite: pr('tat tatest tat taten tatet taten') }, participle: 'getan' });
  rec('können', { forms: { present: pr('kann kannst kann können könnt können') }, stems: { preterite: 'konn' }, participle: 'gekonnt' });
  rec('müssen', { forms: { present: pr('muss musst muss müssen müsst müssen') }, stems: { preterite: 'muss' }, participle: 'gemusst' });
  rec('dürfen', { forms: { present: pr('darf darfst darf dürfen dürft dürfen') }, stems: { preterite: 'durf' }, participle: 'gedurft' });
  rec('mögen', { forms: { present: pr('mag magst mag mögen mögt mögen') }, stems: { preterite: 'moch' }, participle: 'gemocht' });
  rec('sollen', { forms: { present: pr('soll sollst soll sollen sollt sollen') } });
  rec('wollen', { forms: { present: pr('will willst will wollen wollt wollen') } });
  rec('wissen', { forms: { present: pr('weiß weißt weiß wissen wisst wissen') }, stems: { preterite: 'wuss' }, participle: 'gewusst' });

  // ---- strong verbs: vowel change at du/er (stemChange) and the Präteritum stem ----
  strong('gehen', 'ging', 'gegangen', SEIN);
  strong('kommen', 'kam', 'gekommen', SEIN);
  strong('sehen', 'sah', 'gesehen', { stemChange: 'e>ie' });
  strong('geben', 'gab', 'gegeben', { stemChange: 'e>i' });
  strong('nehmen', 'nahm', 'genommen', { forms: { present: pr('nehme nimmst nimmt nehmen nehmt nehmen') } });
  strong('fahren', 'fuhr', 'gefahren', { stemChange: 'a>ä', auxiliary: 'sein' });
  strong('essen', 'aß', 'gegessen', { stemChange: 'e>i' });
  strong('lesen', 'las', 'gelesen', { stemChange: 'e>ie' });
  strong('sprechen', 'sprach', 'gesprochen', { stemChange: 'e>i' });
  strong('schlafen', 'schlief', 'geschlafen', { stemChange: 'a>ä' });
  strong('laufen', 'lief', 'gelaufen', { stemChange: 'au>äu', auxiliary: 'sein' });
  strong('helfen', 'half', 'geholfen', { stemChange: 'e>i' });
  strong('treffen', 'traf', 'getroffen', { stemChange: 'e>i' });
  strong('werfen', 'warf', 'geworfen', { stemChange: 'e>i' });
  strong('finden', 'fand', 'gefunden');
  strong('stehen', 'stand', 'gestanden');
  strong('lassen', 'ließ', 'gelassen', { stemChange: 'a>ä' });
  strong('halten', 'hielt', 'gehalten', { forms: { present: pr('halte hältst hält halten haltet halten') } });
  strong('fallen', 'fiel', 'gefallen', { stemChange: 'a>ä', auxiliary: 'sein' });
  strong('schreiben', 'schrieb', 'geschrieben');
  strong('bleiben', 'blieb', 'geblieben', SEIN);
  strong('trinken', 'trank', 'getrunken');
  strong('singen', 'sang', 'gesungen');
  strong('sitzen', 'saß', 'gesessen');
  strong('liegen', 'lag', 'gelegen');
  strong('ziehen', 'zog', 'gezogen');
  strong('fliegen', 'flog', 'geflogen', SEIN);
  strong('schwimmen', 'schwamm', 'geschwommen', SEIN);
  strong('rufen', 'rief', 'gerufen');
  strong('waschen', 'wusch', 'gewaschen', { stemChange: 'a>ä' });
  strong('schneiden', 'schnitt', 'geschnitten');
  strong('tragen', 'trug', 'getragen', { stemChange: 'a>ä' });
  strong('schlagen', 'schlug', 'geschlagen', { stemChange: 'a>ä' });
  strong('beginnen', 'begann', 'begonnen');
  strong('gewinnen', 'gewann', 'gewonnen');
  strong('bekommen', 'bekam', 'bekommen');
  strong('verstehen', 'verstand', 'verstanden');
  strong('vergessen', 'vergaß', 'vergessen', { stemChange: 'e>i' });
  strong('verlieren', 'verlor', 'verloren');
  strong('laden', 'lud', 'geladen', { forms: { present: pr('lade lädst lädt laden ladet laden') } });
  // mixed verbs: a new stem, weak endings (brachte, kannte)
  mixed('bringen', 'brach', 'gebracht');
  mixed('denken', 'dach', 'gedacht');
  mixed('kennen', 'kann', 'gekannt');
  mixed('nennen', 'nann', 'genannt');
  mixed('rennen', 'rann', 'gerannt', SEIN);
  // regular, but conjugated with sein
  ['reisen', 'wandern', 'wachsen'].slice(0, 2).forEach(function (v) { rec(v, { auxiliary: 'sein' }); });

  var REG = {};
  ('machen spielen lernen arbeiten wohnen kaufen sagen fragen hören lieben leben brauchen öffnen reisen tanzen ' +
    'sammeln wandern studieren besuchen verkaufen erklären bezahlen holen räumen schauen zählen stellen setzen ' +
    'legen packen putzen suchen zeigen bauen lachen antworten warten rechnen freuen').split(' ')
    .forEach(function (v) { REG[v] = true; });

  var E_RE = /(?:[dt]|(?:[^aeiouäöüyhlrmn]|ch)[mn])$/; // a stem that takes an e before -st, -t, -te...
  var INSEP = /^(?:be|emp|ent|er|ge|miss|ver|zer).{4}/;

  window.Conjugate.register({
    id: 'de', name: 'German', reviewed: false,
    persons: ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie'],
    subjects: ['ich', 'du', 'er', 'wir', 'ihr', 'sie'],
    // sich waschen: the accusative pronoun after the finite verb (ich wasche mich). Reflexive verbs take
    // haben in the Perfekt; a dative reflexive (sich etwas vorstellen: mir) is not built.
    reflexive: { prefixes: ['sich '] },
    reflexivePronouns: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'], reflexivePlacement: 'after', reflexiveAux: 'haben',
    pronouns: { words: ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'] },
    separable: { prefixes: ['zusammen', 'zurück', 'vorbei', 'weiter', 'wieder', 'statt', 'fort', 'fest', 'heim', 'los', 'mit', 'nach', 'teil', 'weg', 'vor', 'her', 'hin', 'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'um', 'zu'] },
    classes: {
      en: { name: '-en', example: 'machen', suffixes: ['en'], not: /\s/ },
      eln: { name: '-eln', example: 'sammeln', suffixes: ['eln'], cut: 1, not: /\s/ },
      ern: { name: '-ern', example: 'wandern', suffixes: ['ern'], cut: 1, not: /\s/ },
      n: { name: '-n (sein, tun)', example: 'tun', auto: false, suffixes: ['n'], cut: 1 }
    },
    stemChanges: {
      'a>ä': { find: 'a', boot: 'ä' },
      'au>äu': { find: 'au', boot: 'äu' },
      'e>i': { find: 'e', boot: 'i' },
      'e>ie': { find: 'e', boot: 'ie' }
    },
    // Partizip II of a verb with no record: ge- + stem + t (an e before the t after d/t), no ge- after an
    // inseparable prefix or on -ieren. The engine puts a separable prefix in front of what this returns.
    participleOf: function (ctx) {
      var inf = ctx.base, stem = ctx.stem;
      var noGe = /ieren$/.test(inf) || INSEP.test(inf);
      return (noGe ? '' : 'ge') + stem + (E_RE.test(stem) ? 'e' : '') + 't';
    },
    tenses: [
      { id: 'present', name: 'Präsens', mood: 'indicative', kind: 'simple', boot: [1, 2],
        endings: { en: ['e', 'st', 't', 'en', 't', 'en'], eln: ['', 'st', 't', 'n', 't', 'n'], ern: ['e', 'st', 't', 'n', 't', 'n'], n: ['e', 'st', 't', 'en', 't', 'en'] } },
      { id: 'perfect', name: 'Perfekt', mood: 'indicative', kind: 'compound', compound: { auxiliary: 'haben', tense: 'present' } },
      { id: 'preterite', name: 'Präteritum', mood: 'indicative', kind: 'simple',
        strongEndings: ['', 'st', '', 'en', 't', 'en'], strongIf: 'strong',
        endings: { all: ['te', 'test', 'te', 'ten', 'tet', 'ten'] } },
      { id: 'future', name: 'Futur I', mood: 'indicative', kind: 'compound',
        compound: { auxiliary: 'werden', forms: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], part: 'infinitive' } },
      { id: 'conditional', name: 'Konjunktiv II (würde)', mood: 'conditional', kind: 'compound',
        compound: { auxiliary: 'werden', forms: ['würde', 'würdest', 'würde', 'würden', 'würdet', 'würden'], part: 'infinitive' } },
      { id: 'subjunctive', name: 'Konjunktiv I', mood: 'subjunctive', kind: 'simple',
        endings: { en: ['e', 'est', 'e', 'en', 'et', 'en'], eln: ['', 'est', '', 'n', 'et', 'n'], ern: ['e', 'est', 'e', 'n', 'et', 'n'], n: ['e', 'est', 'e', 'en', 'et', 'en'] } }
    ],
    spelling: [
      // arbeitest, arbeitet, arbeitete, fandest, öffnest, rechnet
      { id: 'e-insertion', tenses: ['present', 'preterite'], stem: E_RE, next: /^(?:st|t|te|test|ten|tet)$/, stemRepl: [/$/, 'e'], literalToo: true },
      // du heißt, tanzt, reist, isst, liest
      { id: 's-t', tenses: ['present'], stem: /[sßxz]$/, next: /^st$/, endRepl: [/^st$/, 't'] },
      // a strong Präteritum stem in s: du aßest, saßest, lasest
      { id: 's-est', tenses: ['preterite'], stem: /[sßxz]$/, next: /^st$/, endRepl: [/^st$/, 'est'], literalToo: true },
      // ich sammle, er sammle
      { id: 'eln', tenses: ['present', 'subjunctive'], cls: ['eln'], stem: /el$/, next: /^$/, stemRepl: [/el$/, 'le'] }
    ],
    // separable verbs are not records (they are a prefix on one); these are listed so the check sheet prints them
    examples: 'aufmachen zumachen einkaufen anrufen mitkommen ankommen aufstehen ansehen abholen mitbringen einladen zurückkommen sich_waschen sich_anziehen sich_freuen'.split(' ').map(function (v) { return v.replace('_', ' '); }),
    records: R,
    regulars: REG
  });
})();
