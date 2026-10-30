/* conjugate-la.js — the Latin pack for Conjugate (Path 19 P3, increment 3).
 *
 * Six tenses, all active indicative: present, imperfect, future, perfect, pluperfect, future perfect.
 * Latin has no passé composé or conditional to map; these are the six every first-year course meets,
 * and the subjunctive and the passive are not built. Whether "the six" (Devon, 2026-10-07) means
 * these is his to say (BACKLOG.md, Path 19, "Latin questions").
 * Persons are six fixed slots: ego, tū, is/ea/id, nōs, vōs, eī/eae/ea.
 *
 * A Latin verb is learned by its principal parts, not by a class alone, so the records carry them:
 * `class` (a, e, c, io, i), a lexical `stem` where the infinitive does not show a long vowel
 * (dīc-, dūc-, scrīb-, cēd-), and `stems.perfect`, the perfect stem (rēx-, cēp-, fēc-). The
 * pluperfect and future perfect are built on that stem. A first-conjugation verb typed as
 * amāre or amare, and a fourth-conjugation verb typed as audīre or audire, are read by their
 * ending; a second-conjugation verb typed without its macron (monere) looks like a third-conjugation
 * one, so the second-conjugation verbs a course meets are listed as records.
 *
 * An unlisted verb is accepted by its ending and marked unchecked: its perfect is guessed (-āvī, -uī,
 * -īvī), which is right for most of the first, second and fourth conjugations and wrong for many
 * third-conjugation verbs, so those cells are the first a teacher should read.
 *
 * Beyond the six (extraTenses): the present and imperfect subjunctive and the present, imperfect and future
 * passive. A deponent verb (loquī, sequī, cōnārī) wears the passive endings in the present, imperfect and future and
 * is marked unbuilt elsewhere. NOT BUILT: the perfect passive (a participle and sum), the imperative, the participles.
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. Records were written from the standard principal
 * parts as remembered, not copied from a dictionary. Macrons are the least certain part. A teacher
 * reads the sheet (node Tools/conjugate/print-corpus.mjs la) before any table is called reviewed.
 */
(function () {
  'use strict';
  var R = {};
  function rec(inf, o) { o.infinitive = inf; R[inf] = o; return o; }
  function pr(s) { var o = {}; s.split(' ').forEach(function (f, i) { if (f !== '.') o[i] = f; }); return o; }
  // regere, rēx: a third-conjugation verb with its perfect stem; stem is given only when it shows a long vowel
  function c3(inf, perf, stem) { var o = { 'class': 'c', stems: { perfect: perf } }; if (stem) o.stem = stem; return rec(inf, o); }
  function io(inf, perf) { return rec(inf, { 'class': 'io', stems: { perfect: perf } }); }
  function e2(inf, perf, stem) { var o = { 'class': 'e' }; if (perf) o.stems = { perfect: perf }; if (stem) o.stem = stem; return rec(inf, o); }
  function a1(inf, perf, stem) { var o = { 'class': 'a' }; if (perf) o.stems = { perfect: perf }; if (stem) o.stem = stem; return rec(inf, o); }
  function i4(inf, perf, stem) { var o = { 'class': 'i' }; if (perf) o.stems = { perfect: perf }; if (stem) o.stem = stem; return rec(inf, o); }

  // ---- the irregulars ----------------------------------------------------------
  rec('esse', { 'class': 'c', defective: { tenses: ['present-passive', 'imperfect-passive', 'future-passive'] }, forms: { 'present-subjunctive': pr('sim sīs sit sīmus sītis sint'), 'imperfect-subjunctive': pr('essem essēs esset essēmus essētis essent'), present: pr('sum es est sumus estis sunt'), imperfect: pr('eram erās erat erāmus erātis erant'), future: pr('erō eris erit erimus eritis erunt') }, stems: { perfect: 'fu' } });
  rec('posse', { 'class': 'c', defective: { tenses: ['present-passive', 'imperfect-passive', 'future-passive'] }, forms: { 'present-subjunctive': pr('possim possīs possit possīmus possītis possint'), 'imperfect-subjunctive': pr('possem possēs posset possēmus possētis possent'), present: pr('possum potes potest possumus potestis possunt'), imperfect: pr('poteram poterās poterat poterāmus poterātis poterant'), future: pr('poterō poteris poterit poterimus poteritis poterunt') }, stems: { perfect: 'potu' } });
  rec('ferre', { 'class': 'c', forms: { 'present-subjunctive': pr('feram ferās ferat ferāmus ferātis ferant'), 'imperfect-subjunctive': pr('ferrem ferrēs ferret ferrēmus ferrētis ferrent'), 'present-passive': pr('feror ferris fertur ferimur feriminī feruntur'), 'imperfect-passive': pr('ferēbar ferēbāris ferēbātur ferēbāmur ferēbāminī ferēbantur'), 'future-passive': pr('ferar ferēris ferētur ferēmur ferēminī ferentur'), present: pr('ferō fers fert ferimus fertis ferunt'), imperfect: pr('ferēbam ferēbās ferēbat ferēbāmus ferēbātis ferēbant'), future: pr('feram ferēs feret ferēmus ferētis ferent') }, stems: { perfect: 'tul' } });
  rec('velle', { 'class': 'c', defective: { tenses: ['present-passive', 'imperfect-passive', 'future-passive'] }, forms: { 'present-subjunctive': pr('velim velīs velit velīmus velītis velint'), 'imperfect-subjunctive': pr('vellem vellēs vellet vellēmus vellētis vellent'), present: pr('volō vīs vult volumus vultis volunt'), imperfect: pr('volēbam volēbās volēbat volēbāmus volēbātis volēbant'), future: pr('volam volēs volet volēmus volētis volent') }, stems: { perfect: 'volu' } });
  rec('ire', { 'class': 'i', defective: { tenses: ['present-passive', 'imperfect-passive', 'future-passive'] }, forms: { 'present-subjunctive': pr('eam eās eat eāmus eātis eant'), 'imperfect-subjunctive': pr('īrem īrēs īret īrēmus īrētis īrent'), present: pr('eō īs it īmus ītis eunt'), imperfect: pr('ībam ībās ībat ībāmus ībātis ībant'), future: pr('ībō ībis ībit ībimus ībitis ībunt'), perfect: pr('iī īstī iit iimus īstis iērunt') }, stems: { perfect: 'i' } });
  rec('dare', { 'class': 'a', forms: { 'present-subjunctive': pr('dem dēs det dēmus dētis dent'), 'imperfect-subjunctive': pr('darem darēs daret darēmus darētis darent'), 'present-passive': pr('dor dāris dātur dāmur dāminī dantur'), 'imperfect-passive': pr('dabar dabāris dabātur dabāmur dabāminī dabantur'), 'future-passive': pr('dabor daberis dabitur dabimur dabiminī dabuntur'), present: pr('dō dās dat damus datis dant'), imperfect: pr('dabam dabās dabat dabāmus dabātis dabant'), future: pr('dabō dabis dabit dabimus dabitis dabunt') }, stems: { perfect: 'ded' } });
  a1('stare', 'stet', 'st').defective = { tenses: ['present-passive', 'imperfect-passive', 'future-passive'] };

  // ---- deponent verbs: passive endings, active meaning (loquor, sequor). Only the present, imperfect and future are built;
  // the perfect system (locūtus sum), the subjunctive and the passive tenses are not, and say so.
  var NOT_BUILT = ['perfect', 'pluperfect', 'future-perfect', 'present-subjunctive', 'imperfect-subjunctive', 'present-passive', 'imperfect-passive', 'future-passive'];
  function dep(inf, cls, stem) { return rec(inf, { 'class': cls, stem: stem, deponent: true, defective: { tenses: NOT_BUILT } }); }
  dep('loqui', 'c', 'loqu'); dep('sequi', 'c', 'sequ'); dep('uti', 'c', 'ūt'); dep('nasci', 'c', 'nasc'); dep('proficisci', 'c', 'proficisc');
  dep('conari', 'a', 'cōn'); dep('hortari', 'a', 'hort'); dep('mirari', 'a', 'mīr'); dep('arbitrari', 'a', 'arbitr');
  dep('vereri', 'e', 'ver'); dep('mori', 'io', 'mor'); dep('pati', 'io', 'pat'); dep('progredi', 'io', 'progred');

  // ---- first conjugation (regular: -āvī) -----------------------------------------
  ('amare laudare portare vocare ambulare habitare laborare narrare parare natare servare spectare superare').split(' ').forEach(function (v) { a1(v); });
  a1('clamare', null, 'clām');
  // ---- second conjugation (class e: -uī unless a perfect stem is given) ---------------
  ('monere habere docere tenere debere timere terrere valere placere').split(' ').forEach(function (v) { e2(v); });
  e2('videre', 'vīd'); e2('movere', 'mōv'); e2('manere', 'māns'); e2('sedere', 'sēd');
  e2('respondere', 'respond'); e2('ridere', 'rīs'); e2('iubere', 'iuss');
  // ---- third conjugation: the perfect stem is lexical -----------------------------------
  c3('regere', 'rēx'); c3('ducere', 'dūx', 'dūc'); c3('scribere', 'scrīps', 'scrīb'); c3('mittere', 'mīs');
  c3('dicere', 'dīx', 'dīc'); c3('agere', 'ēg'); c3('legere', 'lēg'); c3('vincere', 'vīc'); c3('vivere', 'vīx');
  c3('ponere', 'posu'); c3('petere', 'petīv'); c3('currere', 'cucurr'); c3('discere', 'didic'); c3('cadere', 'cecid');
  c3('canere', 'cecin'); c3('bibere', 'bib'); c3('trahere', 'trāx'); c3('cedere', 'cess', 'cēd'); c3('claudere', 'claus');
  c3('defendere', 'dēfend', 'dēfend'); c3('pellere', 'pepul'); c3('cognoscere', 'cognōv'); c3('relinquere', 'relīqu');
  c3('constituere', 'constitu');
  // third conjugation in -iō
  io('capere', 'cēp'); io('facere', 'fēc'); io('iacere', 'iēc'); io('fugere', 'fūg'); io('accipere', 'accēp'); io('cupere', 'cupīv'); io('rapere', 'rapu');
  // ---- fourth conjugation ---------------------------------------------------------------
  ('audire dormire munire finire servire').split(' ').forEach(function (v) { i4(v); });
  i4('scire', 'scīv'); i4('venire', 'vēn'); i4('invenire', 'invēn'); i4('aperire', 'aperu'); i4('sentire', 'sēns');

  // the perfect system on a stem: -ī -istī -it -imus -istis -ērunt, and eram.., erō..
  function perfectEnds(pre) { return [pre + 'ī', pre + 'istī', pre + 'it', pre + 'imus', pre + 'istis', pre + 'ērunt']; }
  function pluEnds(pre) { return ['eram', 'erās', 'erat', 'erāmus', 'erātis', 'erant'].map(function (e) { return pre + e; }); }
  function futPerfEnds(pre) { return ['erō', 'eris', 'erit', 'erimus', 'eritis', 'erint'].map(function (e) { return pre + e; }); }
  function perfAll(pre, fn) { return { a: fn(pre.a), e: fn(pre.e), c: fn(pre.c), io: fn(pre.c), i: fn(pre.i) }; }
  var PRE = { a: 'āv', e: 'u', c: 'u', i: 'īv' };

  window.Conjugate.register({
    id: 'la', name: 'Latin', reviewed: false,
    persons: ['ego', 'tū', 'is / ea / id', 'nōs', 'vōs', 'eī / eae / ea'],
    subjects: ['ego', 'tū', 'is', 'nōs', 'vōs', 'eī'],
    pronouns: { words: ['ego', 'tu', 'nos', 'vos', 'is', 'ea', 'id', 'ei', 'eae'] },
    classes: {
      a: { name: '1st (-āre)', example: 'amāre', suffixes: ['āre', 'are'], cut: 3, not: /\s/ },
      e: { name: '2nd (-ēre)', example: 'monēre', suffixes: ['ēre'], cut: 3, not: /\s/ },
      c: { name: '3rd (-ere)', example: 'regere', suffixes: ['ere'], cut: 3, not: /\s/ },
      io: { name: '3rd in -iō (capere)', example: 'capere', auto: false, cut: 3 },
      i: { name: '4th (-īre)', example: 'audīre', suffixes: ['īre', 'ire'], cut: 3, not: /\s/ }
    },
    tenses: [
      { id: 'present', name: 'Present', mood: 'indicative', kind: 'simple', deponentAs: 'present-passive',
        endings: {
          a: ['ō', 'ās', 'at', 'āmus', 'ātis', 'ant'], e: ['eō', 'ēs', 'et', 'ēmus', 'ētis', 'ent'], c: ['ō', 'is', 'it', 'imus', 'itis', 'unt'],
          io: ['iō', 'is', 'it', 'imus', 'itis', 'iunt'], i: ['iō', 'īs', 'it', 'īmus', 'ītis', 'iunt']
        } },
      { id: 'imperfect', name: 'Imperfect', mood: 'indicative', kind: 'simple', deponentAs: 'imperfect-passive',
        endings: {
          a: ['ābam', 'ābās', 'ābat', 'ābāmus', 'ābātis', 'ābant'], e: ['ēbam', 'ēbās', 'ēbat', 'ēbāmus', 'ēbātis', 'ēbant'], c: ['ēbam', 'ēbās', 'ēbat', 'ēbāmus', 'ēbātis', 'ēbant'],
          io: ['iēbam', 'iēbās', 'iēbat', 'iēbāmus', 'iēbātis', 'iēbant'], i: ['iēbam', 'iēbās', 'iēbat', 'iēbāmus', 'iēbātis', 'iēbant']
        } },
      { id: 'future', name: 'Future', mood: 'indicative', kind: 'simple', deponentAs: 'future-passive',
        endings: {
          a: ['ābō', 'ābis', 'ābit', 'ābimus', 'ābitis', 'ābunt'], e: ['ēbō', 'ēbis', 'ēbit', 'ēbimus', 'ēbitis', 'ēbunt'], c: ['am', 'ēs', 'et', 'ēmus', 'ētis', 'ent'],
          io: ['iam', 'iēs', 'iet', 'iēmus', 'iētis', 'ient'], i: ['iam', 'iēs', 'iet', 'iēmus', 'iētis', 'ient']
        } },
      // with a perfect stem on the record the plain endings are used; without one, the class's usual stem is built in
      { id: 'perfect', name: 'Perfect', mood: 'indicative', kind: 'simple', strongEndings: perfectEnds(''), endings: perfAll(PRE, perfectEnds) },
      { id: 'pluperfect', name: 'Pluperfect', mood: 'indicative', kind: 'simple', stemsAlias: 'perfect', strongEndings: pluEnds(''), endings: perfAll(PRE, pluEnds) },
      { id: 'future-perfect', name: 'Future perfect', mood: 'indicative', kind: 'simple', stemsAlias: 'perfect', strongEndings: futPerfEnds(''), endings: perfAll(PRE, futPerfEnds) }
    ],
    // beyond the six: the present and imperfect subjunctive and the passive of the present, imperfect and future
    // (the perfect passive is a participle and sum: not built)
    extraTenses: [
      { id: 'present-subjunctive', name: 'Present subjunctive', mood: 'subjunctive', kind: 'simple',
        endings: {
          a: ['em', 'ēs', 'et', 'ēmus', 'ētis', 'ent'], e: ['eam', 'eās', 'eat', 'eāmus', 'eātis', 'eant'], c: ['am', 'ās', 'at', 'āmus', 'ātis', 'ant'],
          io: ['iam', 'iās', 'iat', 'iāmus', 'iātis', 'iant'], i: ['iam', 'iās', 'iat', 'iāmus', 'iātis', 'iant']
        } },
      { id: 'imperfect-subjunctive', name: 'Imperfect subjunctive', mood: 'subjunctive', kind: 'simple',
        endings: {
          a: ['ārem', 'ārēs', 'āret', 'ārēmus', 'ārētis', 'ārent'], e: ['ērem', 'ērēs', 'ēret', 'ērēmus', 'ērētis', 'ērent'], c: ['erem', 'erēs', 'eret', 'erēmus', 'erētis', 'erent'],
          io: ['erem', 'erēs', 'eret', 'erēmus', 'erētis', 'erent'], i: ['īrem', 'īrēs', 'īret', 'īrēmus', 'īrētis', 'īrent']
        } },
      { id: 'present-passive', name: 'Present passive', mood: 'indicative', kind: 'simple',
        endings: {
          a: ['or', 'āris', 'ātur', 'āmur', 'āminī', 'antur'], e: ['eor', 'ēris', 'ētur', 'ēmur', 'ēminī', 'entur'], c: ['or', 'eris', 'itur', 'imur', 'iminī', 'untur'],
          io: ['ior', 'eris', 'itur', 'imur', 'iminī', 'iuntur'], i: ['ior', 'īris', 'ītur', 'īmur', 'īminī', 'iuntur']
        } },
      { id: 'imperfect-passive', name: 'Imperfect passive', mood: 'indicative', kind: 'simple',
        endings: {
          a: ['ābar', 'ābāris', 'ābātur', 'ābāmur', 'ābāminī', 'ābantur'], e: ['ēbar', 'ēbāris', 'ēbātur', 'ēbāmur', 'ēbāminī', 'ēbantur'], c: ['ēbar', 'ēbāris', 'ēbātur', 'ēbāmur', 'ēbāminī', 'ēbantur'],
          io: ['iēbar', 'iēbāris', 'iēbātur', 'iēbāmur', 'iēbāminī', 'iēbantur'], i: ['iēbar', 'iēbāris', 'iēbātur', 'iēbāmur', 'iēbāminī', 'iēbantur']
        } },
      { id: 'future-passive', name: 'Future passive', mood: 'indicative', kind: 'simple',
        endings: {
          a: ['ābor', 'āberis', 'ābitur', 'ābimur', 'ābiminī', 'ābuntur'], e: ['ēbor', 'ēberis', 'ēbitur', 'ēbimur', 'ēbiminī', 'ēbuntur'], c: ['ar', 'ēris', 'ētur', 'ēmur', 'ēminī', 'entur'],
          io: ['iar', 'iēris', 'iētur', 'iēmur', 'iēminī', 'ientur'], i: ['iar', 'iēris', 'iētur', 'iēmur', 'iēminī', 'ientur']
        } }
    ],
    records: R,
    regulars: {}
  });
})();
