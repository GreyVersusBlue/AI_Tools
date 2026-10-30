/* conjugate-it.js — the Italian pack for Conjugate (Path 19 P3, increment 3).
 *
 * Six tenses, the engine's usual: presente, passato prossimo, imperfetto, futuro semplice,
 * condizionale presente, congiuntivo presente. Persons are six fixed slots: io, tu, lui/lei,
 * noi, voi, loro.
 *
 * -ire verbs: the default -ire class is dormire's (dormo, dormi, dorme); a verb that takes -isc-
 * (finisco, capisco, preferisco) carries the record { class: 'isc' }, the way French's ir2 is
 * flagged. That makes the minority pattern the default: most NEW -ire verbs take -isc-, so an
 * unlisted -ire verb is conjugated like dormire and marked unchecked. The list below names the
 * -isc- verbs a first-year course meets; a teacher adds the rest. Whether the default should be
 * flipped is Devon's (BACKLOG.md, Path 19, "Italian questions").
 *
 * The future and conditional put -er- (-are, -ere) or -ir- (-ire) between the stem and the ending,
 * the way French does (parlerò, venderò, dormirò); an irregular future stem (andr-, avr-, sar-)
 * is a record. Spelling is derived: -care/-gare take an h before i/e (cerchi, pagherò), -ciare/-giare
 * lose their i (mangi, mangerò) and -iare verbs do not double it (studi, studiamo).
 *
 * The passato prossimo with essere prints the masculine form, singular for io/tu/lui and plural
 * for noi/voi/loro (sono andato, siamo andati), every such cell noted "agreement": the Italian
 * counterpart of the French choice (Devon, 2026-10-21, P19-2), taken here without asking.
 *
 * Reflexive verbs (lavarsi, alzarsi) carry the pronoun in front and take essere. NOT BUILT: the passato remoto,
 * the gerund, a pronoun joined to an infinitive (voglio lavarmi).
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. Records were written from the standard
 * paradigm as remembered, not copied from a table. A teacher reads the sheet
 * (node Tools/conjugate/print-corpus.mjs it) before any table is called reviewed.
 */
(function () {
  'use strict';
  var R = {};
  function rec(inf, o) { o.infinitive = inf; R[inf] = o; return o; }
  function pr(s) { var o = {}; s.split(' ').forEach(function (f, i) { if (f !== '.') o[i] = f; }); return o; }
  var ESS = { auxiliary: 'essere' };

  // ---- the irregulars --------------------------------------------------------
  rec('essere', { 'class': 'ere', forms: { command: { 1: 'sii', 4: 'siate' }, 'imperfect-subjunctive': pr('fossi fossi fosse fossimo foste fossero'), present: pr('sono sei è siamo siete sono'), imperfect: pr('ero eri era eravamo eravate erano'), subjunctive: pr('sia sia sia siamo siate siano') }, stems: { future: 'sar' }, participle: 'stato', auxiliary: 'essere' });
  rec('avere', { 'class': 'ere', forms: { command: { 1: 'abbi', 4: 'abbiate' }, present: pr('ho hai ha abbiamo avete hanno'), subjunctive: pr('abbia abbia abbia abbiamo abbiate abbiano') }, stems: { future: 'avr' } });
  rec('andare', { forms: { command: { 1: "va' / vai" }, present: pr('vado vai va andiamo andate vanno'), subjunctive: pr('vada vada vada andiamo andiate vadano') }, stems: { future: 'andr' }, auxiliary: 'essere' });
  rec('stare', { forms: { command: { 1: "sta' / stai" }, 'imperfect-subjunctive': pr('stessi stessi stesse stessimo steste stessero'), present: pr('sto stai sta stiamo state stanno'), subjunctive: pr('stia stia stia stiamo stiate stiano') }, stems: { future: 'star' }, participle: 'stato', auxiliary: 'essere' });
  rec('dare', { forms: { command: { 1: "da' / dai" }, 'imperfect-subjunctive': pr('dessi dessi desse dessimo deste dessero'), present: pr('do dai dà diamo date danno'), subjunctive: pr('dia dia dia diamo diate diano') }, stems: { future: 'dar' } });
  rec('fare', { 'class': 'ere', forms: { command: { 1: "fa' / fai" }, present: pr('faccio fai fa facciamo fate fanno'), subjunctive: pr('faccia faccia faccia facciamo facciate facciano') }, stems: { imperfect: 'fac', future: 'far' }, participle: 'fatto' });
  rec('dire', { 'class': 'ere', forms: { command: { 1: "di'" }, present: pr('dico dici dice diciamo dite dicono'), subjunctive: pr('dica dica dica diciamo diciate dicano') }, stems: { imperfect: 'dic', future: 'dir' }, participle: 'detto' });
  rec('bere', { forms: { present: pr('bevo bevi beve beviamo bevete bevono'), subjunctive: pr('beva beva beva beviamo beviate bevano') }, stems: { imperfect: 'bev', future: 'berr' }, participle: 'bevuto' });
  rec('venire', { forms: { present: pr('vengo vieni viene veniamo venite vengono'), subjunctive: pr('venga venga venga veniamo veniate vengano') }, stems: { future: 'verr' }, participle: 'venuto', auxiliary: 'essere' });
  rec('uscire', { forms: { present: pr('esco esci esce usciamo uscite escono'), subjunctive: pr('esca esca esca usciamo usciate escano') }, auxiliary: 'essere' });
  rec('salire', { forms: { present: pr('salgo sali sale saliamo salite salgono'), subjunctive: pr('salga salga salga saliamo saliate salgano') }, auxiliary: 'essere' });
  rec('morire', { forms: { present: pr('muoio muori muore moriamo morite muoiono'), subjunctive: pr('muoia muoia muoia moriamo moriate muoiano') }, stems: { future: 'morr' }, participle: 'morto', auxiliary: 'essere' });
  rec('potere', { forms: { present: pr('posso puoi può possiamo potete possono'), subjunctive: pr('possa possa possa possiamo possiate possano') }, stems: { future: 'potr' } });
  rec('volere', { forms: { present: pr('voglio vuoi vuole vogliamo volete vogliono'), subjunctive: pr('voglia voglia voglia vogliamo vogliate vogliano') }, stems: { future: 'vorr' } });
  rec('dovere', { forms: { present: pr('devo devi deve dobbiamo dovete devono'), subjunctive: pr('debba debba debba dobbiamo dobbiate debbano') }, stems: { future: 'dovr' } });
  rec('sapere', { forms: { command: { 1: 'sappi', 4: 'sappiate' }, present: pr('so sai sa sappiamo sapete sanno'), subjunctive: pr('sappia sappia sappia sappiamo sappiate sappiano') }, stems: { future: 'sapr' } });
  rec('vedere', { stems: { future: 'vedr' }, participle: 'visto' });
  rec('rimanere', { forms: { present: pr('rimango rimani rimane rimaniamo rimanete rimangono'), subjunctive: pr('rimanga rimanga rimanga rimaniamo rimaniate rimangano') }, stems: { future: 'rimarr' }, participle: 'rimasto', auxiliary: 'essere' });
  rec('tenere', { forms: { present: pr('tengo tieni tiene teniamo tenete tengono'), subjunctive: pr('tenga tenga tenga teniamo teniate tengano') }, stems: { future: 'terr' } });
  rec('scegliere', { forms: { present: pr('scelgo scegli sceglie scegliamo scegliete scelgono'), subjunctive: pr('scelga scelga scelga scegliamo scegliate scelgano') }, participle: 'scelto' });
  rec('piacere', { forms: { present: pr('piaccio piaci piace piacciamo piacete piacciono'), subjunctive: pr('piaccia piaccia piaccia piacciamo piacciate piacciano') }, participle: 'piaciuto', auxiliary: 'essere' });
  rec('nascere', { participle: 'nato', auxiliary: 'essere' });
  rec('vivere', { stems: { future: 'vivr' }, participle: 'vissuto' });
  rec('cadere', { stems: { future: 'cadr' }, participle: 'caduto', auxiliary: 'essere' });
  rec('conoscere', { participle: 'conosciuto' });
  rec('leggere', { participle: 'letto' });
  rec('scrivere', { participle: 'scritto' });
  rec('prendere', { participle: 'preso' });
  rec('mettere', { participle: 'messo' });
  rec('chiudere', { participle: 'chiuso' });
  rec('perdere', { participle: 'perso' });
  rec('rispondere', { participle: 'risposto' });
  rec('aprire', { participle: 'aperto' });
  rec('offrire', { participle: 'offerto' });
  rec('scendere', { participle: 'sceso', auxiliary: 'essere' });
  ['partire', 'arrivare', 'entrare', 'tornare', 'restare', 'diventare', 'rimanere'].forEach(function (v) { if (!R[v]) rec(v, ESS); });
  // -ire verbs that take -isc- (finisco, finisci, finisce, finiscono; congiuntivo finisca)
  ['finire', 'capire', 'preferire', 'pulire', 'costruire', 'spedire', 'unire', 'guarire', 'obbedire', 'restituire', 'riferire', 'suggerire', 'condire', 'agire']
    .forEach(function (v) { rec(v, { 'class': 'isc' }); });
  // the common -ire verbs without -isc- (dormo, parto, sento, servo, seguo, apro, offro)
  ['dormire', 'sentire', 'servire', 'seguire', 'vestire', 'aprire', 'offrire', 'partire', 'fuggire'].forEach(function (v) { if (!R[v]) rec(v, {}); });

  var REG = {};
  ('parlare mangiare cominciare cercare pagare studiare lavorare abitare ascoltare comprare giocare viaggiare ' +
    'cantare ballare amare aspettare chiamare lasciare incontrare lavare alzare svegliare divertire ' +
    'vendere credere ripetere ricevere ' +
    'dormire sentire').split(' ').forEach(function (v) { REG[v] = true; });


  window.Conjugate.register({
    id: 'it', name: 'Italian', reviewed: false,
    persons: ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro'],
    subjects: ['io', 'tu', 'lui', 'noi', 'voi', 'loro'],
    pronouns: { words: ['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mi', 'ti', 'si', 'ci', 'vi'] },
    // lavarsi is lavare + si; the pronoun goes before the verb (mi lavo, mi sono lavato) and every compound
    // takes essere, with the same masculine agreement as other essere verbs
    reflexive: { suffix: 'si', restore: 'e' },
    reflexivePronouns: ['mi', 'ti', 'si', 'ci', 'vi', 'si'], reflexiveAux: 'essere',
    agreementAux: 'essere', agreementPlural: [/o$/, 'i'],
    classes: {
      are: { name: '-are', example: 'parlare', suffixes: ['are'], cut: 3, futureSuffix: 'er', participle: { add: 'ato' }, not: /\s/ },
      ere: { name: '-ere', example: 'vendere', suffixes: ['ere'], cut: 3, futureSuffix: 'er', participle: { add: 'uto' }, not: /\s/ },
      ire: { name: '-ire (dormire)', example: 'dormire', suffixes: ['ire'], cut: 3, futureSuffix: 'ir', participle: { add: 'ito' }, not: /\s/ },
      isc: { name: '-ire (finire, -isc-)', example: 'finire', auto: false, cut: 3, futureSuffix: 'ir', participle: { add: 'ito' } }
    },
    tenses: [
      { id: 'present', name: 'Presente', mood: 'indicative', kind: 'simple',
        endings: { are: ['o', 'i', 'a', 'iamo', 'ate', 'ano'], ere: ['o', 'i', 'e', 'iamo', 'ete', 'ono'], ire: ['o', 'i', 'e', 'iamo', 'ite', 'ono'], isc: ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono'] } },
      { id: 'passato-prossimo', name: 'Passato prossimo', mood: 'indicative', kind: 'compound', compound: { auxiliary: 'avere', tense: 'present' } },
      { id: 'imperfect', name: 'Imperfetto', mood: 'indicative', kind: 'simple',
        endings: { are: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'], ere: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'], ire: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'], isc: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'] } },
      { id: 'future', name: 'Futuro semplice', mood: 'indicative', kind: 'simple', prependClassSuffix: true,
        endings: { all: ['ò', 'ai', 'à', 'emo', 'ete', 'anno'] } },
      { id: 'conditional', name: 'Condizionale presente', mood: 'conditional', kind: 'simple', prependClassSuffix: true, stemsAlias: 'future',
        endings: { all: ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'] } },
      { id: 'subjunctive', name: 'Congiuntivo presente', mood: 'subjunctive', kind: 'simple',
        endings: { are: ['i', 'i', 'i', 'iamo', 'iate', 'ino'], ere: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], ire: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], isc: ['isca', 'isca', 'isca', 'iamo', 'iate', 'iscano'] } }
    ],
    // beyond the six: the congiuntivo imperfetto (the stem of the imperfetto, so fare gives facessi) and the
    // affirmative imperativo (tu, Lei, noi, voi, Loro; a negative one is not built)
    extraTenses: [
      { id: 'imperfect-subjunctive', name: 'Congiuntivo imperfetto', mood: 'subjunctive', kind: 'simple', stemsAlias: 'imperfect',
        endings: { are: ['assi', 'assi', 'asse', 'assimo', 'aste', 'assero'], ere: ['essi', 'essi', 'esse', 'essimo', 'este', 'essero'], ire: ['issi', 'issi', 'isse', 'issimo', 'iste', 'issero'], isc: ['issi', 'issi', 'isse', 'issimo', 'iste', 'issero'] } },
      { id: 'command', name: 'Imperativo', mood: 'imperative', kind: 'pick', noReflexive: true,
        pick: [null, { from: 'present', slot: 1, byClass: { are: 2 } }, { from: 'subjunctive', slot: 2 }, { from: 'present', slot: 3 }, { from: 'present', slot: 4 }, { from: 'subjunctive', slot: 5 }] }
    ],
    spelling: [
      // mangiare: mangi, mangiamo, mangerò, cominceremo
      { id: 'cia>ci', stem: /[cg]i$/, next: /^[ie]/, stemRepl: [/i$/, ''] },
      // studiare: studi (not studii), studiamo
      { id: 'ii>i', stem: /i$/, next: /^i/, stemRepl: [/i$/, ''] },
      // cercare: cerchi, cerchiamo, cercherò; pagare: paghi
      { id: 'c>ch', cls: ['are'], stem: /[cg]$/, next: /^[ie]/, stemRepl: [/$/, 'h'] }
    ],
    // reflexive verbs are a -si ending on a verb the pack knows; listed so the check sheet prints them
    examples: ['lavarsi', 'alzarsi', 'vestirsi', 'divertirsi', 'mettersi'],
    records: R,
    regulars: REG
  });
})();
