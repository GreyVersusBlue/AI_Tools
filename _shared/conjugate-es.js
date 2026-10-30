/* conjugate-es.js — the Spanish pack for Conjugate (Path 19 P3).
 *
 * Six tenses: present, preterite, imperfect, future, conditional, present subjunctive.
 * Persons are six fixed slots: yo, tú, él, nosotros, vosotros, ellos (Devon, 2026-10-21:
 * vosotros shown).
 *
 * NOTHING HERE HAS BEEN READ BY A LANGUAGE TEACHER. Each record was written from the
 * standard paradigm as remembered, not copied from a table, and checked only against the
 * regular patterns, the 108 + 41 forms 079's poster page ships, and a second derivation
 * (Tools/conjugate/test). A teacher reads it before any table is called reviewed.
 *
 * The records are sparse: a record carries only what the rules cannot derive. Spelling
 * changes (busqué, llegué, empecé, escojo, conozco, leyó, construyó, leído) are derived by
 * the rules below and never declared.
 */
(function () {
  'use strict';
  var R = {};
  function rec(inf, o) { o.infinitive = inf; R[inf] = o; return o; }
  function pr(s) { var o = {}; s.split(' ').forEach(function (f, i) { if (f !== '.') o[i] = f; }); return o; }

  var PREFIX = {
    tener: ['man', 'ob', 'con', 'de', 're', 'sos', 'abs', 'en', 'entre'],
    venir: ['con', 'pre', 'inter', 'sobre', 'de', 'a', 'pro', 're', 'sub'],
    poner: ['com', 'dis', 'ex', 'im', 'o', 'pro', 're', 'su', 'anti', 'inter', 'sobre', 'tras', 'con', 'de', 'pre', 'a'],
    hacer: ['des', 're', 'contra'],
    decir: ['pre', 'contra', 'des', 're'],
    traer: ['a', 'con', 'dis', 'ex', 'sus', 'sub', 're', 'abs', 'pro'],
    ver: ['pre', 'entre'],
    valer: ['equi', 'pre'],
    salir: ['sobre', 're'],
    caer: ['de', 're', 'des'],
    'oír': ['des', 'entre'],
    andar: ['des', 're'],
    escribir: ['des', 'in', 'pre', 'sus', 'trans', 'sobre', 'circun', 're', 'a', 'con', 'pro', 'sub'],
    cubrir: ['des', 'en', 're'],
    volver: ['de', 'en', 're', 'desen', 'sobre'],
    abrir: ['re', 'entre'],
    'reír': ['son']
  };
  function withPrefix(o, inf) { if (PREFIX[inf]) o.prefixes = PREFIX[inf]; return o; }

  // ---- the irregulars --------------------------------------------------------
  rec('ser', { forms: { command: pr('. sé . . . .'), present: pr('soy eres es somos sois son'), preterite: pr('fui fuiste fue fuimos fuisteis fueron'), imperfect: pr('era eras era éramos erais eran') }, stems: { subjunctive: 'se' }, participle: 'sido' });
  rec('estar', { forms: { present: pr('estoy estás está estamos estáis están'), subjunctive: pr('esté estés esté estemos estéis estén') }, stems: { preterite: 'estuv' } });
  rec('ir', { forms: { command: { 1: 've', 3: 'vamos / vayamos' }, present: pr('voy vas va vamos vais van'), preterite: pr('fui fuiste fue fuimos fuisteis fueron'), imperfect: pr('iba ibas iba íbamos ibais iban') }, stems: { subjunctive: 'vay' }, gerund: 'yendo' });
  rec('haber', { forms: { present: pr('he has ha hemos habéis han') }, stems: { preterite: 'hub', future: 'habr', subjunctive: 'hay' } });
  withPrefix(rec('tener', { stemChange: 'e>ie', forms: { present: pr('tengo . . . . .'), command: pr('. ten . . . .') }, stems: { preterite: 'tuv', future: 'tendr' } }), 'tener');
  withPrefix(rec('hacer', { forms: { command: pr('. haz . . . .'), present: pr('hago . . . . .'), preterite: pr('. . hizo . . .') }, stems: { preterite: 'hic', future: 'har' }, participle: 'hecho' }), 'hacer');
  rec('poder', { stemChange: 'o>ue', stems: { preterite: 'pud', future: 'podr' }, gerund: 'pudiendo' });
  withPrefix(rec('poner', { forms: { present: pr('pongo . . . . .'), command: pr('. pon . . . .') }, stems: { preterite: 'pus', future: 'pondr' }, participle: 'puesto' }), 'poner');
  withPrefix(rec('decir', { stemChange: 'e>i', forms: { present: pr('digo . . . . .'), command: pr('. di . . . .') }, stems: { preterite: 'dij', future: 'dir' }, participle: 'dicho', except: ['bendecir', 'maldecir'] }), 'decir');
  withPrefix(rec('venir', { stemChange: 'e>ie', forms: { present: pr('vengo . . . . .'), command: pr('. ven . . . .') }, stems: { preterite: 'vin', future: 'vendr' } }), 'venir');
  rec('querer', { stemChange: 'e>ie', stems: { preterite: 'quis', future: 'querr' } });
  rec('saber', { forms: { present: pr('sé . . . . .') }, stems: { preterite: 'sup', future: 'sabr', subjunctive: 'sep' } });
  rec('dar', { forms: { present: pr('doy . . . dais .'), preterite: pr('di diste dio dimos disteis dieron'), subjunctive: pr('dé des dé demos deis den') } });
  withPrefix(rec('ver', { forms: { present: pr('veo ves ve vemos veis ven'), preterite: pr('vi viste vio vimos visteis vieron') }, stems: { imperfect: 've' }, participle: 'visto' }), 'ver');
  withPrefix(rec('salir', { forms: { present: pr('salgo . . . . .'), command: pr('. sal . . . .') }, stems: { future: 'saldr' } }), 'salir');
  withPrefix(rec('traer', { forms: { present: pr('traigo . . . . .') }, stems: { preterite: 'traj' } }), 'traer');
  withPrefix(rec('caer', { forms: { present: pr('caigo . . . . .') } }), 'caer');
  withPrefix(rec('oír', { forms: { present: pr('oigo oyes oye oímos oís oyen') } }), 'oír');
  rec('-ducir', { stems: { preterite: { cut: 'cir', add: 'j' } } });
  withPrefix(rec('andar', { stems: { preterite: 'anduv' } }), 'andar');
  rec('caber', { forms: { present: pr('quepo . . . . .') }, stems: { preterite: 'cup', future: 'cabr' } });
  withPrefix(rec('valer', { forms: { present: pr('valgo . . . . .') }, stems: { future: 'valdr' } }), 'valer');
  withPrefix(rec('reír', { forms: { present: pr('río ríes ríe reímos reís ríen'), preterite: pr('reí reíste rio reímos reísteis rieron'), subjunctive: pr('ría rías ría riamos riáis rían') }, gerund: 'riendo' }), 'reír');
  rec('oler', { stemChange: 'o>hue' });
  ['enviar', 'esquiar', 'guiar', 'confiar', 'variar'].forEach(function (v) { rec(v, { stemChange: 'i>í' }); });
  ['continuar', 'actuar', 'graduar'].forEach(function (v) { rec(v, { stemChange: 'u>ú' }); });

  // participles
  withPrefix(rec('abrir', { participle: 'abierto' }), 'abrir');
  withPrefix(rec('escribir', { participle: 'escrito' }), 'escribir');
  rec('romper', { participle: 'roto' });
  withPrefix(rec('cubrir', { participle: 'cubierto' }), 'cubrir');
  rec('morir', { stemChange: 'o>ue', participle: 'muerto' });
  withPrefix(rec('volver', { stemChange: 'o>ue', participle: 'vuelto', except: ['resolver'] }), 'volver');
  rec('resolver', { stemChange: 'o>ue', participle: 'resuelto' });

  // stem-changers (one field)
  ['pensar', 'cerrar', 'empezar', 'comenzar', 'entender', 'perder', 'sentar', 'defender', 'encender', 'negar',
    'sentir', 'preferir', 'mentir'].forEach(function (v) { rec(v, { stemChange: 'e>ie' }); });
  ['contar', 'encontrar', 'recordar', 'almorzar', 'costar', 'mostrar', 'mover', 'dormir'].forEach(function (v) { rec(v, { stemChange: 'o>ue' }); });
  ['pedir', 'servir', 'repetir', 'vestir', 'seguir', 'competir'].forEach(function (v) { rec(v, { stemChange: 'e>i' }); });
  rec('jugar', { stemChange: 'u>ue' });

  // defective
  rec('llover', { stemChange: 'o>ue', defective: { slots: [2] } });
  rec('nevar', { stemChange: 'e>ie', defective: { slots: [2] } });
  rec('soler', { stemChange: 'o>ue', defective: { tenses: ['future', 'conditional'] } });

  // regular verbs the pack knows (spelling changers are among them: the rules do the work)
  var REG = {};
  ('hablar comer vivir caminar estudiar trabajar escuchar mirar tomar comprar beber aprender cantar bailar ' +
    'buscar sacar tocar llegar pagar cruzar escoger recoger dirigir leer creer construir huir incluir ' +
    'conocer parecer ofrecer producir conducir traducir vencer seguir levantar lavar llamar duchar bañar').split(' ').forEach(function (v) { REG[v] = true; });

  var EV = ['é', 'ás', 'á', 'emos', 'éis', 'án'], CV = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
  var VOW = 'aeiouáéíóú';

  window.Conjugate.register({
    id: 'es', name: 'Spanish', reviewed: false,
    persons: ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'],
    subjects: ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'],
    reflexive: { suffix: 'se' },
    reflexivePronouns: ['me', 'te', 'se', 'nos', 'os', 'se'],
    pronouns: { words: ['yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes', 'me', 'te', 'se', 'nos', 'os'] },
    classes: {
      ar: { name: '-ar', example: 'hablar', suffixes: ['ar'], participle: { ending: 'ado' }, gerund: { ending: 'ando' } },
      er: { name: '-er', example: 'comer', suffixes: ['er'], participle: { ending: 'ido' }, gerund: { ending: 'iendo' } },
      ir: { name: '-ir', example: 'vivir', suffixes: ['ir', 'ír'], participle: { ending: 'ido' }, gerund: { ending: 'iendo' } }
    },
    stemChanges: {
      'e>ie': { find: 'e', boot: 'ie', weak: 'i' },
      'o>ue': { find: 'o', boot: 'ue', weak: 'u' },
      'e>i': { find: 'e', boot: 'i', weak: 'i' },
      'u>ue': { find: 'u', boot: 'ue' },
      'o>hue': { find: 'o', boot: 'hue' },
      'i>í': { find: 'i', boot: 'í' },
      'u>ú': { find: 'u', boot: 'ú' }
    },
    tenses: [
      { id: 'present', name: 'Present', mood: 'indicative', kind: 'simple', boot: [0, 1, 2, 5],
        endings: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] } },
      { id: 'preterite', name: 'Preterite', mood: 'indicative', kind: 'simple', weak: [2, 5],
        strongEndings: ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'], strongAfterJ: 'eron',
        endings: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] } },
      { id: 'imperfect', name: 'Imperfect', mood: 'indicative', kind: 'simple',
        endings: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: CV, ir: CV } },
      { id: 'future', name: 'Future', mood: 'indicative', kind: 'simple', stemFrom: 'infinitive', endings: { all: EV } },
      { id: 'conditional', name: 'Conditional', mood: 'conditional', kind: 'simple', stemFrom: 'infinitive', stemsAlias: 'future', endings: { all: CV } },
      { id: 'subjunctive', name: 'Present subjunctive', mood: 'subjunctive', kind: 'subjunctive', boot: [0, 1, 2, 5], weak: [3, 4],
        endings: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] } }
    ],
    // beyond the six: the present perfect, the -ra imperfect subjunctive and the affirmative command
    // (a negative command is the present subjunctive after no: not built; a reflexive command takes its
    // pronoun after the verb: not built)
    extraTenses: [
      { id: 'present-perfect', name: 'Present perfect', mood: 'indicative', kind: 'compound', compound: { auxiliary: 'haber', tense: 'present' } },
      { id: 'imperfect-subjunctive', name: 'Imperfect subjunctive (-ra)', mood: 'subjunctive', kind: 'derived',
        derived: { from: 'preterite', pick: [5, 5, 5, 5, 5, 5], cut: [3, 3, 3, 3, 3, 3], accent: [3] },
        endings: { all: ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'] } },
      { id: 'command', name: 'Command (affirmative)', mood: 'imperative', kind: 'pick', noReflexive: true,
        pick: [null, { from: 'present', slot: 2 }, { from: 'subjunctive', slot: 2 }, { from: 'subjunctive', slot: 3 }, { infinitive: [/r$/, 'd'] }, { from: 'subjunctive', slot: 5 }] }
    ],
    spelling: [
      { id: 'c>qu', cls: ['ar'], stem: /c$/, next: /^[eé]/, stemRepl: [/c$/, 'qu'] },
      { id: 'g>gu', cls: ['ar'], stem: /g$/, next: /^[eé]/, stemRepl: [/g$/, 'gu'] },
      { id: 'z>c', cls: ['ar'], stem: /z$/, next: /^[eé]/, stemRepl: [/z$/, 'c'] },
      { id: 'c>zc', cls: ['er', 'ir'], stem: new RegExp('[' + VOW + ']c$'), next: /^[oaáó]/, stemRepl: [/c$/, 'zc'] },
      { id: 'c>z', cls: ['er', 'ir'], stem: new RegExp('[^' + VOW + ']c$'), next: /^[oaáó]/, stemRepl: [/c$/, 'z'] },
      { id: 'g>j', cls: ['er', 'ir'], stem: /g$/, next: /^[oaáó]/, stemRepl: [/g$/, 'j'] },
      { id: 'gu>g', cls: ['er', 'ir'], stem: /gu$/, next: /^[oaáó]/, stemRepl: [/gu$/, 'g'] },
      { id: 'i>y', cls: ['er', 'ir'], stem: /([aeo]|[^gq]u)$/, next: /^i[eó]/, endRepl: [/^i/, 'y'] },
      { id: 'u>uy', cls: ['er', 'ir'], stem: /[^gq]u$/, next: /^[aeoáéó]/, stemRepl: [/$/, 'y'] },
      { id: 'i>í', cls: ['er', 'ir'], stem: /[aeo]$/, next: /^i(ste|mos|steis|do)$/, endRepl: [/^i/, 'í'] }
    ],
    records: R,
    regulars: REG
  });
})();
