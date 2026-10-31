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
 * Reflexive verbs (sich waschen, sich anziehen) put the accusative pronoun after the finite verb. A dative reflexive
 * (sich etwas vorstellen: ich stelle mir etwas vor) takes mir, dir, sich, uns, euch, sich: a verb the pack lists as
 * always dative (sich merken), a record marked `dative: true`, or an infinitive typed `sich (dat.) vorstellen`.
 * The object itself (etwas, die Zähne) is not part of any form.
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. The records were written from the standard
 * paradigm as remembered, not copied from a table; the forms in Tools/conjugate/test are the
 * author's own, and they are the teacher's to check. A teacher reads the sheet
 * (node Tools/conjugate/print-corpus.mjs de) before any table is called reviewed.
 *
 * Known gaps: the participle's "no ge-" test is a prefix heuristic (be-, emp-, ent-, er-, ge-, miss-, ver-,
 * zer- followed by something that can begin a German word, with at least four more letters, and -ieren): bellen,
 * betteln, ernten and gerben fail it because ll, tt, nt and rb cannot begin a word. A short list covers the verbs
 * that look prefixed to a vowel (beugen, beichten, entern); any other still comes out wrong. A verb
 * the pack does not list is accepted as regular and marked unchecked.
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
  // kennte, nennte, rennte: the Konjunktiv II of a mixed verb with a vowel change to e, which the pack leaves to the teacher
  var NO_K2 = { defective: { tenses: ['konjunktiv2'] } };

  // ---- the auxiliaries and the modals ---------------------------------------
  rec('sein', { 'class': 'n', defective: { tenses: ['passive', 'passive-preterite'] }, forms: { konjunktiv2: { 0: 'wäre', 1: 'wärest / wärst', 2: 'wäre', 3: 'wären', 4: 'wäret / wärt', 5: 'wären' }, imperative: { 1: 'sei', 3: 'seien wir', 4: 'seid', 5: 'seien Sie' }, present: pr('bin bist ist sind seid sind'), preterite: pr('war warst war waren wart waren'), subjunctive: pr('sei seiest sei seien seiet seien') }, participle: 'gewesen', auxiliary: 'sein' });
  rec('haben', { forms: { konjunktiv2: pr('hätte hättest hätte hätten hättet hätten'), present: pr('habe hast hat haben habt haben'), preterite: pr('hatte hattest hatte hatten hattet hatten') }, participle: 'gehabt' });
  rec('werden', { defective: { tenses: ['passive', 'passive-preterite'] }, forms: { konjunktiv2: pr('würde würdest würde würden würdet würden'), imperative: { 1: 'werde', 3: 'werden wir', 4: 'werdet', 5: 'werden Sie' }, present: pr('werde wirst wird werden werdet werden'), preterite: pr('wurde wurdest wurde wurden wurdet wurden') }, participle: 'geworden', auxiliary: 'sein' });
  rec('tun', { 'class': 'n', forms: { konjunktiv2: pr('täte tätest täte täten tätet täten'), present: pr('tue tust tut tun tut tun'), preterite: pr('tat tatest tat taten tatet taten') }, participle: 'getan' });
  rec('können', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { konjunktiv2: pr('könnte könntest könnte könnten könntet könnten'), present: pr('kann kannst kann können könnt können') }, stems: { preterite: 'konn' }, participle: 'gekonnt' });
  rec('müssen', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { konjunktiv2: pr('müsste müsstest müsste müssten müsstet müssten'), present: pr('muss musst muss müssen müsst müssen') }, stems: { preterite: 'muss' }, participle: 'gemusst' });
  rec('dürfen', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { konjunktiv2: pr('dürfte dürftest dürfte dürften dürftet dürften'), present: pr('darf darfst darf dürfen dürft dürfen') }, stems: { preterite: 'durf' }, participle: 'gedurft' });
  rec('mögen', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { konjunktiv2: pr('möchte möchtest möchte möchten möchtet möchten'), present: pr('mag magst mag mögen mögt mögen') }, stems: { preterite: 'moch' }, participle: 'gemocht' });
  rec('sollen', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { present: pr('soll sollst soll sollen sollt sollen') } });
  rec('wollen', { defective: { tenses: ['imperative', 'passive', 'passive-preterite'] }, forms: { present: pr('will willst will wollen wollt wollen') } });
  rec('wissen', { forms: { konjunktiv2: pr('wüsste wüsstest wüsste wüssten wüsstet wüssten'), imperative: { 1: 'wisse', 3: 'wissen wir', 4: 'wisst', 5: 'wissen Sie' }, present: pr('weiß weißt weiß wissen wisst wissen') }, stems: { preterite: 'wuss' }, participle: 'gewusst' });

  // ---- strong verbs: vowel change at du/er (stemChange) and the Präteritum stem ----
  strong('gehen', 'ging', 'gegangen', SEIN);
  strong('kommen', 'kam', 'gekommen', SEIN);
  strong('sehen', 'sah', 'gesehen', { stemChange: 'e>ie' });
  strong('geben', 'gab', 'gegeben', { stemChange: 'e>i' });
  strong('nehmen', 'nahm', 'genommen', { forms: { present: pr('nehme nimmst nimmt nehmen nehmt nehmen'), imperative: pr('. nimm . . . .') } });
  strong('fahren', 'fuhr', 'gefahren', { stemChange: 'a>ä', auxiliary: 'sein' });
  strong('essen', 'aß', 'gegessen', { stemChange: 'e>i' });
  strong('lesen', 'las', 'gelesen', { stemChange: 'e>ie' });
  strong('sprechen', 'sprach', 'gesprochen', { stemChange: 'e>i' });
  strong('schlafen', 'schlief', 'geschlafen', { stemChange: 'a>ä' });
  strong('laufen', 'lief', 'gelaufen', { stemChange: 'au>äu', auxiliary: 'sein' });
  strong('helfen', 'half', 'geholfen', { stemChange: 'e>i', k2alt: 'hülf' });
  strong('treffen', 'traf', 'getroffen', { stemChange: 'e>i' });
  strong('werfen', 'warf', 'geworfen', { stemChange: 'e>i' });
  strong('finden', 'fand', 'gefunden');
  strong('stehen', 'stand', 'gestanden', { k2alt: 'stünd' });
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
  strong('schwimmen', 'schwamm', 'geschwommen', { auxiliary: 'sein', k2alt: 'schwömm' });
  strong('rufen', 'rief', 'gerufen');
  strong('waschen', 'wusch', 'gewaschen', { stemChange: 'a>ä' });
  strong('schneiden', 'schnitt', 'geschnitten');
  strong('tragen', 'trug', 'getragen', { stemChange: 'a>ä' });
  strong('schlagen', 'schlug', 'geschlagen', { stemChange: 'a>ä' });
  strong('beginnen', 'begann', 'begonnen', { k2alt: 'begönn' });
  strong('gewinnen', 'gewann', 'gewonnen', { k2alt: 'gewönn' });
  strong('bekommen', 'bekam', 'bekommen');
  strong('verstehen', 'verstand', 'verstanden', { k2alt: 'verstünd' });
  strong('vergessen', 'vergaß', 'vergessen', { stemChange: 'e>i' });
  strong('verlieren', 'verlor', 'verloren');
  strong('beißen', 'biss', 'gebissen');
  strong('gelten', 'galt', 'gegolten', { k2alt: 'gölt',  forms: { present: pr('gelte giltst gilt gelten geltet gelten') } });
  strong('laden', 'lud', 'geladen', { forms: { present: pr('lade lädst lädt laden ladet laden') } });
  // mixed verbs: a new stem, weak endings (brachte, kannte)
  mixed('bringen', 'brach', 'gebracht', { k2: 'umlaut' });
  mixed('denken', 'dach', 'gedacht', { k2: 'umlaut' });
  mixed('kennen', 'kann', 'gekannt', NO_K2);
  mixed('nennen', 'nann', 'genannt', NO_K2);
  mixed('rennen', 'rann', 'gerannt', { auxiliary: 'sein', defective: { tenses: ['konjunktiv2'] } });
  // regular, but conjugated with sein
  ['reisen', 'wandern', 'wachsen'].slice(0, 2).forEach(function (v) { rec(v, { auxiliary: 'sein' }); });

  var REG = {};
  ('machen spielen lernen arbeiten wohnen kaufen sagen fragen hören lieben leben brauchen öffnen reisen tanzen ' +
    'sammeln wandern studieren besuchen verkaufen erklären bezahlen holen räumen schauen zählen stellen setzen ' +
    'legen packen putzen suchen zeigen bauen lachen antworten warten rechnen freuen merken wünschen leisten').split(' ')
    .forEach(function (v) { REG[v] = true; });

  var E_RE = /(?:[dt]|(?:[^aeiouäöüyhlrmn]|ch)[mn])$/; // a stem that takes an e before -st, -t, -te...
  // An inseparable prefix (no ge- in the participle) is one that is followed by something that can begin a German word:
  // a vowel, a consonant and a vowel, or one of the clusters a word may start with. bell-en, bett-eln, ern-ten and
  // gerb-en are not be-llen, be-tteln, er-nten and ge-rben, because ll, tt, nt and rb cannot begin a word.
  var ONSET = /^(?:sch[lmnprtw]?|sp[lr]?|st[r]?|pf[lr]?|ps|qu|zw|chr?|sk|sl|sm|sn|sw|th|ph|rh|gn|kn|wr|[bdfgkp][lr]|tr|[bcdfghjklmnprstvwxyz])?[aeiouäöüy]/;
  var INSEP = /^(?:be|emp|ent|er|ge|miss|ver|zer)(.{4,})$/;
  // verbs that look prefixed to a vowel (beug-en, beicht-en, enter-n): they take ge- in the participle
  var NOT_PREFIXED = ['beugen', 'beichten', 'entern'];
  function prefixed(inf) { var m = INSEP.exec(inf); return !!m && ONSET.test(m[1]) && NOT_PREFIXED.indexOf(inf) < 0; }
  // Konjunktiv II proper (wäre, käme, hätte, könnte): a strong verb's Präteritum stem with umlaut and -e, -est, -e, -en, -et,
  // -en; a weak verb's is its Präteritum; a mixed verb marked `k2: 'umlaut'` takes the umlaut on the Präteritum (brächte).
  // `k2alt` is the second stem a few verbs have (stünde / stände). The irregular few (sein, haben, werden, tun, the modals,
  // wissen) are typed as forms on the record.
  function umlaut(s) { return s.replace(/(au|[aou])([^aou]*)$/, function (m, v, rest) { return { au: 'äu', a: 'ä', o: 'ö', u: 'ü' }[v] + rest; }); }
  function konjunktiv2(ctx, slot, api) {
    var rec = ctx.rec || {}, st = rec.stems && rec.stems.preterite, e = ['e', 'est', 'e', 'en', 'et', 'en'][slot];
    if (rec.strong && typeof st === 'string') {
      var f = [umlaut(st) + e];
      if (rec.k2alt) f.push(rec.k2alt + e);
      return { forms: f, kinds: ['irregular'], from: rec.as || rec.infinitive || '' };
    }
    var pc = api.cell('preterite', slot);
    if (!pc.forms.length) return null;
    return { forms: pc.forms.map(function (x) { return rec.k2 === 'umlaut' ? umlaut(x) : x; }), kinds: rec.k2 === 'umlaut' ? ['irregular'] : pc.kinds, from: pc.from };
  }

  window.Conjugate.register({
    id: 'de', name: 'German', reviewed: false,
    persons: ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie'],
    subjects: ['ich', 'du', 'er', 'wir', 'ihr', 'sie'],
    // sich waschen: the accusative pronoun after the finite verb (ich wasche mich). Reflexive verbs take
    // haben in the Perfekt.
    reflexive: { prefixes: ['sich '], dativePrefixes: ['sich (dat.) ', 'sich (dat) ', 'sich(dat) ', 'sich (d) '] },
    reflexivePronouns: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'], reflexivePlacement: 'after', reflexiveAux: 'haben',
    // sich etwas vorstellen / kaufen / merken: the pronoun is dative (ich kaufe mir ...). These verbs are listed because
    // their reflexive use is always dative; any other verb is marked `sich (dat.) ...` or `dative: true`
    reflexivePronounsDative: ['mir', 'dir', 'sich', 'uns', 'euch', 'sich'],
    dativeVerbs: ['vornehmen', 'merken', 'wünschen', 'ansehen', 'anschauen', 'holen', 'bestellen', 'kaufen', 'leisten'],
    pronouns: { words: ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'] },
    separable: { prefixes: ['auseinander', 'entgegen', 'zusammen', 'herunter', 'hinunter', 'heraus', 'herein', 'herauf', 'hinaus', 'hinein', 'hinauf', 'voraus', 'nieder', 'zurück', 'vorbei', 'weiter', 'wieder', 'statt', 'fort', 'fest', 'heim', 'los', 'mit', 'nach', 'teil', 'weg', 'vor', 'her', 'hin', 'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'um', 'zu'] },
    classes: {
      en: { name: '-en', example: 'machen', suffixes: ['en'], not: /\s/ },
      eln: { name: '-eln', example: 'sammeln', suffixes: ['eln'], cut: 1, not: /\s/ },
      ern: { name: '-ern', example: 'wandern', suffixes: ['ern'], cut: 1, not: /\s/ },
      n: { name: '-n (sein, tun)', example: 'tun', auto: false, suffixes: ['n'], cut: 1 }
    },
    stemChanges: {
      // 'in': the du imperative keeps a / au (fahr!, lauf!); only e>i and e>ie change there (gib!, lies!)
      'a>ä': { find: 'a', boot: 'ä', 'in': ['present'] },
      'au>äu': { find: 'au', boot: 'äu', 'in': ['present'] },
      'e>i': { find: 'e', boot: 'i' },
      'e>ie': { find: 'e', boot: 'ie' }
    },
    // Partizip II of a verb with no record: ge- + stem + t (an e before the t after d/t), no ge- after an
    // inseparable prefix or on -ieren. The engine puts a separable prefix in front of what this returns.
    participleOf: function (ctx) {
      var inf = ctx.base, stem = ctx.stem;
      var noGe = /ieren$/.test(inf) || prefixed(inf);
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
    // beyond the six: the Plusquamperfekt, the Vorgangspassiv (werden + Partizip II; a transitive verb makes sense of it,
    // and the pack does not check that) and the imperative (du, wir, ihr, Sie; no er form, and nothing for a modal)
    extraTenses: [
      { id: 'konjunktiv2', name: 'Konjunktiv II (wäre, käme)', mood: 'subjunctive', kind: 'custom', custom: konjunktiv2 },
      { id: 'pluperfect', name: 'Plusquamperfekt', mood: 'indicative', kind: 'compound', compound: { auxiliary: 'haben', tense: 'preterite' } },
      { id: 'passive', name: 'Vorgangspassiv (Präsens)', mood: 'indicative', kind: 'compound', noReflexive: true,
        compound: { auxiliary: 'werden', forms: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], part: 'participle' } },
      { id: 'passive-preterite', name: 'Vorgangspassiv (Präteritum)', mood: 'indicative', kind: 'compound', noReflexive: true,
        compound: { auxiliary: 'werden', forms: ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden'], part: 'participle' } },
      { id: 'imperative', name: 'Imperativ', mood: 'imperative', kind: 'simple', boot: [1], none: [0, 2], noReflexive: true,
        append: [null, null, null, ' wir', null, ' Sie'],
        endings: { en: ['', '', '', 'en', 't', 'en'], eln: ['', '', '', 'n', 't', 'n'], ern: ['', '', '', 'n', 't', 'n'], n: ['', '', '', 'en', 't', 'en'] } }
    ],
    spelling: [
      // arbeitest, arbeitet, arbeitete, fandest, öffnest, rechnet
      { id: 'e-insertion', tenses: ['present', 'preterite', 'imperative'], stem: E_RE, next: /^(?:st|t|te|test|ten|tet)$/, stemRepl: [/$/, 'e'], literalToo: true },
      // the du imperative has no ending: arbeite!, öffne!, finde!
      { id: 'e-imperative', tenses: ['imperative'], stem: E_RE, next: /^$/, stemRepl: [/$/, 'e'], literalToo: true },
      // du heißt, tanzt, reist, isst, liest
      { id: 's-t', tenses: ['present'], stem: /[sßxz]$/, next: /^st$/, endRepl: [/^st$/, 't'] },
      // a strong Präteritum stem in s: du aßest, saßest, lasest
      { id: 's-est', tenses: ['preterite'], stem: /[sßxz]$/, next: /^st$/, endRepl: [/^st$/, 'est'], literalToo: true },
      // ich sammle, er sammle
      { id: 'eln', tenses: ['present', 'subjunctive', 'imperative'], cls: ['eln'], stem: /el$/, next: /^$/, stemRepl: [/el$/, 'le'] }
    ],
    // separable verbs are not records (they are a prefix on one); these are listed so the check sheet prints them
    examples: 'aufmachen zumachen einkaufen anrufen mitkommen ankommen aufstehen ansehen abholen mitbringen einladen zurückkommen sich_waschen sich_anziehen sich_freuen sich_merken sich_(dat.)_vorstellen sich_(dat.)_waschen sich_kaufen'.split(' ').map(function (v) { return v.replace(/_/g, ' '); }),
    records: R,
    regulars: REG
  });
})();
