// conjugate.test.mjs — pure-logic tests for _shared/conjugate.js and its two packs
// (Path 19 P3, increment 1).
//
//   node Tools/conjugate/test/conjugate.test.mjs      (or: npm run test:conjugate)
//
// The engine and the packs are classic scripts that publish window.Conjugate, so they run
// here in a vm context with no document, the way export.test.mjs loads export.js.
//
// WHAT THIS DOES NOT PROVE. Every expected form below was typed in by the session that wrote
// the packs, from its own knowledge of the two languages; a second derivation (case 15) holds
// them against each other, and the 079 parity case holds the engine to forms a page already
// ships, but NO LANGUAGE TEACHER HAS READ ANY OF IT. Devon has arranged a proofreader (2026-10-21);
// until that person has read the check sheet, no table is called reviewed, and the suite pins
// that every result says "unreviewed".
//
// 079 parity reads the page's TEMPLATES literal and irregulars.js by text, so a change to
// either that the engine does not agree with fails here, which is what it is for.
//
// Broken copies at the end: the suite is run against copies of the source with one thing
// broken on purpose, and must fail on each; a copy the break did not change fails too.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as corpus from '../print-corpus.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(site, f), 'utf8');
const FILES = ['_shared/conjugate.js', '_shared/conjugate-es.js', '_shared/conjugate-fr.js'];

function load(patch) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of FILES) {
    let src = read(f);
    if (patch && patch.file === f) {
      const next = src.split(patch.from).join(patch.to);
      if (next === src) throw new Error('broken copy changed nothing: ' + patch.from);
      src = next;
    }
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx.window;
}

const w = (s) => (s.includes(' | ') ? s.split(' | ') : s.split(' '));

function suite(win) {
  const C = win.Conjugate;
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const eq = (got, want, msg) => ok(JSON.stringify(got) === JSON.stringify(want), `${msg}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  const forms = (lang, verb, tense, opts) => C.conjugate(lang, verb, tense, opts).forms;
  const cells = (lang, verb, tense, spec) => eq(forms(lang, verb, tense), w(spec), `${lang} ${verb} ${tense}`);

  // (2) regular paradigms, every declared tense
  const REG = {
    es: {
      hablar: { present: 'hablo hablas habla hablamos habláis hablan', preterite: 'hablé hablaste habló hablamos hablasteis hablaron', imperfect: 'hablaba hablabas hablaba hablábamos hablabais hablaban', future: 'hablaré hablarás hablará hablaremos hablaréis hablarán', conditional: 'hablaría hablarías hablaría hablaríamos hablaríais hablarían', subjunctive: 'hable hables hable hablemos habléis hablen' },
      comer: { present: 'como comes come comemos coméis comen', preterite: 'comí comiste comió comimos comisteis comieron', imperfect: 'comía comías comía comíamos comíais comían', future: 'comeré comerás comerá comeremos comeréis comerán', conditional: 'comería comerías comería comeríamos comeríais comerían', subjunctive: 'coma comas coma comamos comáis coman' },
      vivir: { present: 'vivo vives vive vivimos vivís viven', preterite: 'viví viviste vivió vivimos vivisteis vivieron', imperfect: 'vivía vivías vivía vivíamos vivíais vivían', future: 'viviré vivirás vivirá viviremos viviréis vivirán', conditional: 'viviría vivirías viviría viviríamos viviríais vivirían', subjunctive: 'viva vivas viva vivamos viváis vivan' }
    },
    fr: {
      parler: { present: 'parle parles parle parlons parlez parlent', 'passe-compose': 'ai parlé | as parlé | a parlé | avons parlé | avez parlé | ont parlé', imperfect: 'parlais parlais parlait parlions parliez parlaient', future: 'parlerai parleras parlera parlerons parlerez parleront', conditional: 'parlerais parlerais parlerait parlerions parleriez parleraient', subjunctive: 'parle parles parle parlions parliez parlent' },
      finir: { present: 'finis finis finit finissons finissez finissent', 'passe-compose': 'ai fini | as fini | a fini | avons fini | avez fini | ont fini', imperfect: 'finissais finissais finissait finissions finissiez finissaient', future: 'finirai finiras finira finirons finirez finiront', conditional: 'finirais finirais finirait finirions finiriez finiraient', subjunctive: 'finisse finisses finisse finissions finissiez finissent' },
      vendre: { present: 'vends vends vend vendons vendez vendent', 'passe-compose': 'ai vendu | as vendu | a vendu | avons vendu | avez vendu | ont vendu', imperfect: 'vendais vendais vendait vendions vendiez vendaient', future: 'vendrai vendras vendra vendrons vendrez vendront', conditional: 'vendrais vendrais vendrait vendrions vendriez vendraient', subjunctive: 'vende vendes vende vendions vendiez vendent' }
    }
  };
  for (const lang of Object.keys(REG)) for (const verb of Object.keys(REG[lang])) for (const t of Object.keys(REG[lang][verb])) cells(lang, verb, t, REG[lang][verb][t]);

  // (3) stem changes, (4) spelling, (5) irregulars: [lang, verb, tense, forms]
  const NAMED = [
    ['es', 'pensar', 'present', 'pienso piensas piensa pensamos pensáis piensan'],
    ['es', 'pensar', 'subjunctive', 'piense pienses piense pensemos penséis piensen'],
    ['es', 'volver', 'present', 'vuelvo vuelves vuelve volvemos volvéis vuelven'],
    ['es', 'pedir', 'preterite', 'pedí pediste pidió pedimos pedisteis pidieron'],
    ['es', 'pedir', 'subjunctive', 'pida pidas pida pidamos pidáis pidan'],
    ['es', 'dormir', 'present', 'duermo duermes duerme dormimos dormís duermen'],
    ['es', 'dormir', 'preterite', 'dormí dormiste durmió dormimos dormisteis durmieron'],
    ['es', 'dormir', 'subjunctive', 'duerma duermas duerma durmamos durmáis duerman'],
    ['es', 'jugar', 'present', 'juego juegas juega jugamos jugáis juegan'],
    ['es', 'jugar', 'preterite', 'jugué jugaste jugó jugamos jugasteis jugaron'],
    ['es', 'jugar', 'subjunctive', 'juegue juegues juegue juguemos juguéis jueguen'],
    ['es', 'sentir', 'preterite', 'sentí sentiste sintió sentimos sentisteis sintieron'],
    ['es', 'sentir', 'subjunctive', 'sienta sientas sienta sintamos sintáis sientan'],
    ['es', 'buscar', 'preterite', 'busqué buscaste buscó buscamos buscasteis buscaron'],
    ['es', 'buscar', 'subjunctive', 'busque busques busque busquemos busquéis busquen'],
    ['es', 'llegar', 'preterite', 'llegué llegaste llegó llegamos llegasteis llegaron'],
    ['es', 'empezar', 'preterite', 'empecé empezaste empezó empezamos empezasteis empezaron'],
    ['es', 'empezar', 'subjunctive', 'empiece empieces empiece empecemos empecéis empiecen'],
    ['es', 'escoger', 'present', 'escojo escoges escoge escogemos escogéis escogen'],
    ['es', 'escoger', 'subjunctive', 'escoja escojas escoja escojamos escojáis escojan'],
    ['es', 'seguir', 'present', 'sigo sigues sigue seguimos seguís siguen'],
    ['es', 'seguir', 'preterite', 'seguí seguiste siguió seguimos seguisteis siguieron'],
    ['es', 'conocer', 'present', 'conozco conoces conoce conocemos conocéis conocen'],
    ['es', 'conocer', 'subjunctive', 'conozca conozcas conozca conozcamos conozcáis conozcan'],
    ['es', 'leer', 'preterite', 'leí leíste leyó leímos leísteis leyeron'],
    ['es', 'leer', 'imperfect', 'leía leías leía leíamos leíais leían'],
    ['es', 'construir', 'present', 'construyo construyes construye construimos construís construyen'],
    ['es', 'construir', 'preterite', 'construí construiste construyó construimos construisteis construyeron'],
    ['es', 'ser', 'present', 'soy eres es somos sois son'],
    ['es', 'ser', 'preterite', 'fui fuiste fue fuimos fuisteis fueron'],
    ['es', 'ser', 'imperfect', 'era eras era éramos erais eran'],
    ['es', 'ser', 'future', 'seré serás será seremos seréis serán'],
    ['es', 'ser', 'conditional', 'sería serías sería seríamos seríais serían'],
    ['es', 'ser', 'subjunctive', 'sea seas sea seamos seáis sean'],
    ['es', 'estar', 'present', 'estoy estás está estamos estáis están'],
    ['es', 'estar', 'preterite', 'estuve estuviste estuvo estuvimos estuvisteis estuvieron'],
    ['es', 'estar', 'subjunctive', 'esté estés esté estemos estéis estén'],
    ['es', 'ir', 'present', 'voy vas va vamos vais van'],
    ['es', 'ir', 'preterite', 'fui fuiste fue fuimos fuisteis fueron'],
    ['es', 'ir', 'imperfect', 'iba ibas iba íbamos ibais iban'],
    ['es', 'ir', 'future', 'iré irás irá iremos iréis irán'],
    ['es', 'ir', 'subjunctive', 'vaya vayas vaya vayamos vayáis vayan'],
    ['es', 'haber', 'present', 'he has ha hemos habéis han'],
    ['es', 'haber', 'preterite', 'hube hubiste hubo hubimos hubisteis hubieron'],
    ['es', 'haber', 'future', 'habré habrás habrá habremos habréis habrán'],
    ['es', 'haber', 'subjunctive', 'haya hayas haya hayamos hayáis hayan'],
    ['es', 'tener', 'present', 'tengo tienes tiene tenemos tenéis tienen'],
    ['es', 'tener', 'preterite', 'tuve tuviste tuvo tuvimos tuvisteis tuvieron'],
    ['es', 'tener', 'imperfect', 'tenía tenías tenía teníamos teníais tenían'],
    ['es', 'tener', 'future', 'tendré tendrás tendrá tendremos tendréis tendrán'],
    ['es', 'tener', 'conditional', 'tendría tendrías tendría tendríamos tendríais tendrían'],
    ['es', 'tener', 'subjunctive', 'tenga tengas tenga tengamos tengáis tengan'],
    ['es', 'hacer', 'present', 'hago haces hace hacemos hacéis hacen'],
    ['es', 'hacer', 'preterite', 'hice hiciste hizo hicimos hicisteis hicieron'],
    ['es', 'hacer', 'future', 'haré harás hará haremos haréis harán'],
    ['es', 'hacer', 'subjunctive', 'haga hagas haga hagamos hagáis hagan'],
    ['es', 'poder', 'present', 'puedo puedes puede podemos podéis pueden'],
    ['es', 'poder', 'preterite', 'pude pudiste pudo pudimos pudisteis pudieron'],
    ['es', 'poder', 'future', 'podré podrás podrá podremos podréis podrán'],
    ['es', 'poner', 'present', 'pongo pones pone ponemos ponéis ponen'],
    ['es', 'poner', 'preterite', 'puse pusiste puso pusimos pusisteis pusieron'],
    ['es', 'poner', 'future', 'pondré pondrás pondrá pondremos pondréis pondrán'],
    ['es', 'decir', 'present', 'digo dices dice decimos decís dicen'],
    ['es', 'decir', 'preterite', 'dije dijiste dijo dijimos dijisteis dijeron'],
    ['es', 'decir', 'future', 'diré dirás dirá diremos diréis dirán'],
    ['es', 'decir', 'subjunctive', 'diga digas diga digamos digáis digan'],
    ['es', 'venir', 'present', 'vengo vienes viene venimos venís vienen'],
    ['es', 'venir', 'preterite', 'vine viniste vino vinimos vinisteis vinieron'],
    ['es', 'venir', 'future', 'vendré vendrás vendrá vendremos vendréis vendrán'],
    ['es', 'querer', 'preterite', 'quise quisiste quiso quisimos quisisteis quisieron'],
    ['es', 'querer', 'future', 'querré querrás querrá querremos querréis querrán'],
    ['es', 'saber', 'present', 'sé sabes sabe sabemos sabéis saben'],
    ['es', 'saber', 'subjunctive', 'sepa sepas sepa sepamos sepáis sepan'],
    ['es', 'dar', 'present', 'doy das da damos dais dan'],
    ['es', 'dar', 'preterite', 'di diste dio dimos disteis dieron'],
    ['es', 'dar', 'subjunctive', 'dé des dé demos deis den'],
    ['es', 'ver', 'present', 'veo ves ve vemos veis ven'],
    ['es', 'ver', 'preterite', 'vi viste vio vimos visteis vieron'],
    ['es', 'ver', 'imperfect', 'veía veías veía veíamos veíais veían'],
    ['es', 'ver', 'subjunctive', 'vea veas vea veamos veáis vean'],
    ['es', 'salir', 'present', 'salgo sales sale salimos salís salen'],
    ['es', 'salir', 'future', 'saldré saldrás saldrá saldremos saldréis saldrán'],
    ['es', 'traer', 'preterite', 'traje trajiste trajo trajimos trajisteis trajeron'],
    ['es', 'caer', 'present', 'caigo caes cae caemos caéis caen'],
    ['es', 'caer', 'preterite', 'caí caíste cayó caímos caísteis cayeron'],
    ['es', 'oír', 'present', 'oigo oyes oye oímos oís oyen'],
    ['es', 'oír', 'preterite', 'oí oíste oyó oímos oísteis oyeron'],
    ['es', 'reír', 'present', 'río ríes ríe reímos reís ríen'],
    ['es', 'reír', 'preterite', 'reí reíste rio reímos reísteis rieron'],
    ['es', 'reír', 'subjunctive', 'ría rías ría riamos riáis rían'],
    ['es', 'reír', 'future', 'reiré reirás reirá reiremos reiréis reirán'],
    ['es', 'conducir', 'present', 'conduzco conduces conduce conducimos conducís conducen'],
    ['es', 'conducir', 'preterite', 'conduje condujiste condujo condujimos condujisteis condujeron'],
    ['es', 'andar', 'preterite', 'anduve anduviste anduvo anduvimos anduvisteis anduvieron'],
    ['es', 'caber', 'present', 'quepo cabes cabe cabemos cabéis caben'],
    ['es', 'oler', 'present', 'huelo hueles huele olemos oléis huelen'],
    ['es', 'enviar', 'present', 'envío envías envía enviamos enviáis envían'],
    ['es', 'enviar', 'preterite', 'envié enviaste envió enviamos enviasteis enviaron'],
    ['es', 'enviar', 'subjunctive', 'envíe envíes envíe enviemos enviéis envíen'],
    ['es', 'continuar', 'present', 'continúo continúas continúa continuamos continuáis continúan'],
    // prefixes
    ['es', 'mantener', 'present', 'mantengo mantienes mantiene mantenemos mantenéis mantienen'],
    ['es', 'mantener', 'preterite', 'mantuve mantuviste mantuvo mantuvimos mantuvisteis mantuvieron'],
    ['es', 'suponer', 'preterite', 'supuse supusiste supuso supusimos supusisteis supusieron'],
    ['es', 'convenir', 'future', 'convendré convendrás convendrá convendremos convendréis convendrán'],
    ['es', 'sonreír', 'preterite', 'sonreí sonreíste sonrio sonreímos sonreísteis sonrieron'],
    ['es', 'traducir', 'preterite', 'traduje tradujiste tradujo tradujimos tradujisteis tradujeron'],
    // reflexive
    ['es', 'levantarse', 'present', 'me levanto | te levantas | se levanta | nos levantamos | os levantáis | se levantan'],
    // French
    ['fr', 'manger', 'present', 'mange manges mange mangeons mangez mangent'],
    ['fr', 'manger', 'imperfect', 'mangeais mangeais mangeait mangions mangiez mangeaient'],
    ['fr', 'commencer', 'present', 'commence commences commence commençons commencez commencent'],
    ['fr', 'commencer', 'imperfect', 'commençais commençais commençait commencions commenciez commençaient'],
    ['fr', 'acheter', 'present', 'achète achètes achète achetons achetez achètent'],
    ['fr', 'acheter', 'future', 'achèterai achèteras achètera achèterons achèterez achèteront'],
    ['fr', 'acheter', 'subjunctive', 'achète achètes achète achetions achetiez achètent'],
    ['fr', 'préférer', 'present', 'préfère préfères préfère préférons préférez préfèrent'],
    ['fr', 'préférer', 'future', 'préférerai préféreras préférera préférerons préférerez préféreront'],
    ['fr', 'appeler', 'present', 'appelle appelles appelle appelons appelez appellent'],
    ['fr', 'appeler', 'future', 'appellerai appelleras appellera appellerons appellerez appelleront'],
    ['fr', 'jeter', 'present', 'jette jettes jette jetons jetez jettent'],
    ['fr', 'envoyer', 'present', 'envoie envoies envoie envoyons envoyez envoient'],
    ['fr', 'envoyer', 'future', 'enverrai enverras enverra enverrons enverrez enverront'],
    ['fr', 'être', 'present', 'suis es est sommes êtes sont'],
    ['fr', 'être', 'passe-compose', 'ai été | as été | a été | avons été | avez été | ont été'],
    ['fr', 'être', 'imperfect', 'étais étais était étions étiez étaient'],
    ['fr', 'être', 'future', 'serai seras sera serons serez seront'],
    ['fr', 'être', 'subjunctive', 'sois sois soit soyons soyez soient'],
    ['fr', 'avoir', 'present', 'ai as a avons avez ont'],
    ['fr', 'avoir', 'passe-compose', 'ai eu | as eu | a eu | avons eu | avez eu | ont eu'],
    ['fr', 'avoir', 'imperfect', 'avais avais avait avions aviez avaient'],
    ['fr', 'avoir', 'future', 'aurai auras aura aurons aurez auront'],
    ['fr', 'avoir', 'subjunctive', 'aie aies ait ayons ayez aient'],
    ['fr', 'aller', 'present', 'vais vas va allons allez vont'],
    ['fr', 'aller', 'passe-compose', 'suis allé | es allé | est allé | sommes allé | êtes allé | sont allé'],
    ['fr', 'aller', 'future', 'irai iras ira irons irez iront'],
    ['fr', 'aller', 'subjunctive', 'aille ailles aille allions alliez aillent'],
    ['fr', 'faire', 'present', 'fais fais fait faisons faites font'],
    ['fr', 'faire', 'imperfect', 'faisais faisais faisait faisions faisiez faisaient'],
    ['fr', 'faire', 'future', 'ferai feras fera ferons ferez feront'],
    ['fr', 'faire', 'subjunctive', 'fasse fasses fasse fassions fassiez fassent'],
    ['fr', 'pouvoir', 'present', 'peux peux peut pouvons pouvez peuvent'],
    ['fr', 'pouvoir', 'future', 'pourrai pourras pourra pourrons pourrez pourront'],
    ['fr', 'pouvoir', 'subjunctive', 'puisse puisses puisse puissions puissiez puissent'],
    ['fr', 'vouloir', 'present', 'veux veux veut voulons voulez veulent'],
    ['fr', 'vouloir', 'imperfect', 'voulais voulais voulait voulions vouliez voulaient'],
    ['fr', 'vouloir', 'subjunctive', 'veuille veuilles veuille voulions vouliez veuillent'],
    ['fr', 'devoir', 'future', 'devrai devras devra devrons devrez devront'],
    ['fr', 'devoir', 'subjunctive', 'doive doives doive devions deviez doivent'],
    ['fr', 'savoir', 'future', 'saurai sauras saura saurons saurez sauront'],
    ['fr', 'savoir', 'subjunctive', 'sache saches sache sachions sachiez sachent'],
    ['fr', 'venir', 'present', 'viens viens vient venons venez viennent'],
    ['fr', 'venir', 'passe-compose', 'suis venu | es venu | est venu | sommes venu | êtes venu | sont venu'],
    ['fr', 'venir', 'future', 'viendrai viendras viendra viendrons viendrez viendront'],
    ['fr', 'venir', 'subjunctive', 'vienne viennes vienne venions veniez viennent'],
    ['fr', 'prendre', 'present', 'prends prends prend prenons prenez prennent'],
    ['fr', 'prendre', 'subjunctive', 'prenne prennes prenne prenions preniez prennent'],
    ['fr', 'mettre', 'imperfect', 'mettais mettais mettait mettions mettiez mettaient'],
    ['fr', 'mettre', 'passe-compose', 'ai mis | as mis | a mis | avons mis | avez mis | ont mis'],
    ['fr', 'voir', 'imperfect', 'voyais voyais voyait voyions voyiez voyaient'],
    ['fr', 'voir', 'future', 'verrai verras verra verrons verrez verront'],
    ['fr', 'voir', 'subjunctive', 'voie voies voie voyions voyiez voient'],
    ['fr', 'dire', 'present', 'dis dis dit disons dites disent'],
    ['fr', 'dire', 'subjunctive', 'dise dises dise disions disiez disent'],
    ['fr', 'croire', 'subjunctive', 'croie croies croie croyions croyiez croient'],
    ['fr', 'boire', 'imperfect', 'buvais buvais buvait buvions buviez buvaient'],
    ['fr', 'boire', 'subjunctive', 'boive boives boive buvions buviez boivent'],
    ['fr', 'recevoir', 'subjunctive', 'reçoive reçoives reçoive recevions receviez reçoivent'],
    ['fr', 'partir', 'present', 'pars pars part partons partez partent'],
    ['fr', 'partir', 'passe-compose', 'suis parti | es parti | est parti | sommes parti | êtes parti | sont parti'],
    ['fr', 'dormir', 'present', 'dors dors dort dormons dormez dorment'],
    ['fr', 'dormir', 'passe-compose', 'ai dormi | as dormi | a dormi | avons dormi | avez dormi | ont dormi'],
    ['fr', 'ouvrir', 'present', 'ouvre ouvres ouvre ouvrons ouvrez ouvrent'],
    ['fr', 'ouvrir', 'future', 'ouvrirai ouvriras ouvrira ouvrirons ouvrirez ouvriront'],
    ['fr', 'ouvrir', 'passe-compose', 'ai ouvert | as ouvert | a ouvert | avons ouvert | avez ouvert | ont ouvert'],
    ['fr', 'courir', 'future', 'courrai courras courra courrons courrez courront'],
    ['fr', 'mourir', 'subjunctive', 'meure meures meure mourions mouriez meurent'],
    ['fr', 'mourir', 'passe-compose', 'suis mort | es mort | est mort | sommes mort | êtes mort | sont mort'],
    ['fr', 'conduire', 'present', 'conduis conduis conduit conduisons conduisez conduisent'],
    ['fr', 'conduire', 'passe-compose', 'ai conduit | as conduit | a conduit | avons conduit | avez conduit | ont conduit'],
    ['fr', 'construire', 'imperfect', 'construisais construisais construisait construisions construisiez construisaient'],
    // prefixes
    ['fr', 'comprendre', 'present', 'comprends comprends comprend comprenons comprenez comprennent'],
    ['fr', 'comprendre', 'passe-compose', 'ai compris | as compris | a compris | avons compris | avez compris | ont compris'],
    ['fr', 'revenir', 'passe-compose', 'suis revenu | es revenu | est revenu | sommes revenu | êtes revenu | sont revenu'],
    ['fr', 'revenir', 'future', 'reviendrai reviendras reviendra reviendrons reviendrez reviendront'],
    ['fr', 'défaire', 'present', 'défais défais défait défaisons défaites défont'],
    ['fr', 'décrire', 'present', 'décris décris décrit décrivons décrivez décrivent'],
    // reflexive
    ['fr', 'se laver', 'present', 'me lave | te laves | se lave | nous lavons | vous lavez | se lavent'],
    ['fr', 'se laver', 'passe-compose', 'me suis lavé | t\'es lavé | s\'est lavé | nous sommes lavé | vous êtes lavé | se sont lavé'],
    ['fr', 'se lever', 'present', 'me lève | te lèves | se lève | nous levons | vous levez | se lèvent'],
    ["fr", "s'appeler", 'present', "m'appelle | t'appelles | s'appelle | nous appelons | vous appelez | s'appellent"]
  ];
  for (const [lang, verb, tense, spec] of NAMED) cells(lang, verb, tense, spec);

  // payer, both ways (P19-4)
  const pay = C.conjugate('fr', 'payer', 'present');
  eq(pay.forms, w('paie paies paie payons payez paient'), 'payer present, first form');
  eq(pay.alts, [['paye'], ['payes'], ['paye'], [], [], ['payent']], 'payer present, the other form');
  eq(C.conjugate('fr', 'payer', 'future').alts[0], ['payerai'], 'payer future, the other form');
  eq(C.conjugate('fr', 'essayer', 'present').alts[0], ['essaye'], 'essayer, both');
  eq(C.conjugate('fr', 'payer', 'subjunctive').alts[0], ['paye'], 'payer subjunctive: one other form, not a repeat');
  eq(C.conjugate('fr', 'employer', 'present').alts.map((a) => a.length), [0, 0, 0, 0, 0, 0], 'employer has one form (-oyer)');

  // participles and gerunds
  const PART = [['es', 'hablar', 'hablado', 'hablando'], ['es', 'comer', 'comido', 'comiendo'], ['es', 'leer', 'leído', 'leyendo'],
    ['es', 'creer', 'creído', 'creyendo'], ['es', 'construir', 'construido', 'construyendo'], ['es', 'pedir', 'pedido', 'pidiendo'],
    ['es', 'dormir', 'dormido', 'durmiendo'], ['es', 'decir', 'dicho', 'diciendo'], ['es', 'venir', 'venido', 'viniendo'],
    ['es', 'poder', 'podido', 'pudiendo'], ['es', 'ir', 'ido', 'yendo'], ['es', 'traer', 'traído', 'trayendo'],
    ['es', 'abrir', 'abierto', 'abriendo'], ['es', 'escribir', 'escrito', 'escribiendo'], ['es', 'romper', 'roto', 'rompiendo'],
    ['es', 'volver', 'vuelto', 'volviendo'], ['es', 'poner', 'puesto', 'poniendo'], ['es', 'ver', 'visto', 'viendo'],
    ['es', 'hacer', 'hecho', 'haciendo'], ['es', 'morir', 'muerto', 'muriendo'], ['es', 'reír', 'reído', 'riendo'],
    ['es', 'descubrir', 'descubierto', 'descubriendo'], ['es', 'devolver', 'devuelto', 'devolviendo'], ['es', 'resolver', 'resuelto', 'resolviendo'],
    ['fr', 'parler', 'parlé', ''], ['fr', 'finir', 'fini', ''], ['fr', 'vendre', 'vendu', ''], ['fr', 'faire', 'fait', ''],
    ['fr', 'prendre', 'pris', ''], ['fr', 'devoir', 'dû', ''], ['fr', 'conduire', 'conduit', ''], ['fr', 'haïr', 'haï', '']];
  for (const [lang, v, p, g] of PART) {
    eq(C.participle(lang, v), p, `${lang} ${v} participle`);
    eq(C.table(lang, v).gerund, g, `${lang} ${v} gerund`);
  }

  // pronouns, elision (9)
  const pron = (v, t) => C.conjugate('fr', v, t, { pronouns: true }).forms;
  eq(pron('se laver', 'present'), ['je me lave', 'tu te laves', 'il se lave', 'nous nous lavons', 'vous vous lavez', 'ils se lavent'], 'se laver with subjects');
  eq(pron("s'appeler", 'present'), ["je m'appelle", "tu t'appelles", "il s'appelle", 'nous nous appelons', 'vous vous appelez', "ils s'appellent"], "s'appeler with subjects");
  eq(pron('habiter', 'present'), ["j'habite", 'tu habites', 'il habite', 'nous habitons', 'vous habitez', 'ils habitent'], 'habiter elides');
  eq(pron('aimer', 'present')[0], "j'aime", 'aimer elides');
  eq(pron('haïr', 'present'), ['je hais', 'tu hais', 'il hait', 'nous haïssons', 'vous haïssez', 'ils haïssent'], 'haïr (aspirate h) does not elide');
  eq(pron('se laver', 'passe-compose'), ['je me suis lavé', "tu t'es lavé", "il s'est lavé", 'nous nous sommes lavé', 'vous vous êtes lavé', 'ils se sont lavé'], 'se laver in the passé composé');
  eq(C.conjugate('es', 'hablar', 'present', { pronouns: true }).forms[0], 'yo hablo', 'Spanish subject');
  eq(C.conjugate('es', 'levantarse', 'present', { pronouns: true }).forms[4], 'vosotros os levantáis', 'Spanish reflexive with subject');
  eq(C.conjugate('es', 'hablar', 'present', { slots: [0, 2] }).forms, ['hablo', '', 'habla', '', '', ''], 'opts.slots');

  // (7) defective
  eq(forms('es', 'llover', 'present'), ['', '', 'llueve', '', '', ''], 'llover present');
  eq(forms('es', 'llover', 'preterite'), ['', '', 'llovió', '', '', ''], 'llover preterite');
  eq(C.conjugate('es', 'llover', 'present').complete, true, 'a defective verb is complete');
  eq(C.conjugate('es', 'llover', 'present').notes.filter((n) => n.kind === 'defective').length, 5, 'llover: five defective cells');
  eq(forms('es', 'nevar', 'present')[2], 'nieva', 'nevar');
  eq(forms('es', 'soler', 'present'), w('suelo sueles suele solemos soléis suelen'), 'soler present');
  eq(forms('es', 'soler', 'future'), ['', '', '', '', '', ''], 'soler has no future');
  eq(C.conjugate('fr', 'falloir', 'present').forms, ['', '', 'faut', '', '', ''], 'falloir');
  eq([forms('fr', 'falloir', 'imperfect')[2], forms('fr', 'falloir', 'future')[2], forms('fr', 'falloir', 'conditional')[2], forms('fr', 'falloir', 'subjunctive')[2], forms('fr', 'falloir', 'passe-compose')[2]],
    ['fallait', 'faudra', 'faudrait', 'faille', 'a fallu'], 'falloir, every tense');
  eq([forms('fr', 'pleuvoir', 'present')[2], forms('fr', 'pleuvoir', 'imperfect')[2], forms('fr', 'pleuvoir', 'future')[2], forms('fr', 'pleuvoir', 'subjunctive')[2]], ['pleut', 'pleuvait', 'pleuvra', 'pleuve'], 'pleuvoir');

  // notes: which rule made a cell
  const kinds = (lang, v, t) => C.conjugate(lang, v, t).notes.map((n) => n.kind);
  eq(kinds('es', 'hablar', 'present'), Array(6).fill('regular'), 'a regular verb notes regular');
  eq(kinds('es', 'pensar', 'present'), ['stem', 'stem', 'stem', 'regular', 'regular', 'stem'], 'pensar notes the boot');
  eq(kinds('es', 'buscar', 'preterite'), ['spelling', 'regular', 'regular', 'regular', 'regular', 'regular'], 'buscar notes the spelling change');
  eq(C.conjugate('es', 'buscar', 'preterite').notes[0].from, 'c>qu', 'buscar names the rule');
  eq(kinds('es', 'tener', 'preterite'), Array(6).fill('irregular'), 'tener preterite');
  eq(kinds('es', 'mantener', 'imperfect'), Array(6).fill('derived'), 'mantener is derived from tener');
  eq(C.conjugate('es', 'mantener', 'present').notes[0].from, 'tener', 'a derived verb names its base');
  eq(kinds('fr', 'aller', 'passe-compose'), Array(6).fill('agreement'), 'être auxiliary notes agreement');
  eq(kinds('fr', 'parler', 'passe-compose'), Array(6).fill('regular'), 'avoir auxiliary notes regular');
  eq(kinds('es', 'zumbar', 'present'), Array(6).fill('assumed'), 'an unknown verb is assumed');
  eq(C.conjugate('es', 'zumbar', 'present').known, false, 'an unknown verb is not known');
  eq(C.conjugate('es', 'zumbar', 'present').forms, w('zumbo zumbas zumba zumbamos zumbáis zumban'), 'an unknown -ar verb is conjugated as regular');
  eq(kinds('fr', 'blanchir', 'present'), Array(6).fill('assumed'), 'an unknown French -ir is assumed to be finir');
  eq(C.conjugate('es', 'hablar', 'present').known, true, 'a known regular verb is known');
  ok(C.conjugate('es', 'table', 'present').complete === false, 'a noun is not a verb');
  eq(C.classify('es', 'table'), null, 'classify: a noun is null');

  // (10) classify, lookup
  eq(C.classify('es', 'hablar'), { 'class': 'ar', stem: 'habl', reflexive: false, base: 'hablar' }, 'classify hablar');
  eq(C.classify('es', 'levantarse'), { 'class': 'ar', stem: 'levant', reflexive: true, base: 'levantar' }, 'classify levantarse');
  eq(C.classify('es', 'reír'), { 'class': 'ir', stem: 're', reflexive: false, base: 'reír' }, 'classify reír');
  eq(C.classify('fr', 'se lever'), { 'class': 'er', stem: 'lev', reflexive: true, base: 'lever' }, 'classify se lever');
  eq(C.classify('fr', "s'appeler").reflexive, true, "classify s'appeler");
  eq(C.classify('fr', 'finir')['class'], 'ir', 'classify finir');
  eq(C.classify('fr', 'devoir'), null, 'classify: an -oir verb is known only by its record');
  eq(C.lookup('es', 'dormir').stemChange, 'o>ue', 'lookup dormir');
  eq(C.lookup('es', 'mantener').as, 'tener', 'lookup mantener');
  eq(C.lookup('es', 'mantener').forms.present[0], 'mantengo', 'lookup mantener, prefix glued');
  eq(C.lookup('es', 'remover'), null, 'remover is not derived from ver');
  eq(C.lookup('es', 'llover').stemChange, 'o>ue', 'llover is its own record');
  eq(C.lookup('es', 'bendecir'), null, 'bendecir is not derived from decir');
  eq(C.lookup('fr', 'revenir').auxiliary, 'être', 'revenir keeps être');
  eq(C.lookup('fr', 'table'), null, 'lookup: not a verb');
  eq(C.lookup('es', 'zumbar'), null, 'lookup: not in the pack');

  // (11) match
  const m = (typed, exp, lang = 'es') => C.match(typed, exp, { lang });
  const verdicts = [
    ['hablo', 'hablo', 'correct', ''], ['Hablo', 'hablo', 'correct', ''], ['hablo ', 'hablo', 'correct', ''], ['  hablo   ', 'hablo', 'correct', ''],
    ['hable', 'hablé', 'close', 'accent'], ['tenia', 'tenía', 'close', 'accent'],
    ['ano', 'año', 'wrong', ''], ['pinguino', 'pingüino', 'correct', 'diaeresis'], ['pinguino', 'pingüinó', 'close', 'accent'], ['pingüino', 'pinguino', 'close', 'accent'], ['pingüino', 'pingüino', 'correct', ''],
    ['levanto', 'me levanto', 'close', 'pronoun'], ['me levanto', 'levanto', 'close', 'pronoun'], ['yo hablo', 'hablo', 'close', 'pronoun'],
    ['', 'hablo', 'wrong', ''], ['   ', 'hablo', 'wrong', ''], ['hablas', 'hablo', 'wrong', '']
  ];
  for (const [t, e, v, r] of verdicts) { const got = m(t, e); ok(got.verdict === v && got.reason === r, `match(${JSON.stringify(t)}, ${e}) was ${got.verdict}/${got.reason}, wanted ${v}/${r}`); }
  const frv = [
    ['garcon', 'garçon', 'wrong', ''], ['garçon', 'garçon', 'correct', ''], ['j’habite', "j'habite", 'correct', ''], ['je habite', "j'habite", 'close', 'elision'],
    ["j'habite", 'habite', 'close', 'pronoun'], ['habite', "j'habite", 'close', 'pronoun'], ['il sappelle', "il s'appelle", 'wrong', ''],
    ['etais', 'étais', 'close', 'accent'], ['ca', 'ça', 'wrong', ''], ['PARLÉ', 'parlé', 'correct', ''], ['ai parle', 'ai parlé', 'close', 'accent']
  ];
  for (const [t, e, v, r] of frv) { const got = m(t, e, 'fr'); ok(got.verdict === v && got.reason === r, `fr match(${JSON.stringify(t)}, ${e}) was ${got.verdict}/${got.reason}, wanted ${v}/${r}`); }
  // two accepted forms: either is correct, and the other is shown when only one is typed
  eq(m('paye', ['paie', 'paye'], 'fr').verdict, 'correct', 'payer: the second form is correct');
  eq(m('paie', 'paie / paye', 'fr').verdict, 'correct', 'payer: a pair string splits');
  eq(m('pâie', ['paie', 'paye'], 'fr').expected, 'paie', 'match reports the form it matched');
  eq(m('pinguino', 'pingüino').expected, 'pingüino', 'match reports the expected form, so the ü form can be shown beside an answer typed with u');
  eq(m('Pinguino', 'pingüino', 'es').verdict, 'correct', 'ü lenient: capitals do not matter either');
  eq(C.normalize('  J’HABITE  '), "j'habite", 'normalize');
  eq(C.stripAccents('piñata'), 'piñata', 'stripAccents keeps ñ');
  eq(C.stripAccents('garçon é ü'), 'garçon e u', 'stripAccents keeps ç and strips vowels');

  // (12) teacher overlay
  const base = C.lookup('es', 'tener');
  const mine = C.merge(base, { infinitive: 'tener', forms: { present: { 0: 'tenjo' } } });
  eq(forms('es', mine, 'present')[0], 'tenjo', 'merge: the teacher\'s cell first');
  eq(C.conjugate('es', mine, 'present').notes[0].kind, 'teacher', 'merge: the cell is noted teacher');
  eq(forms('es', mine, 'present')[1], 'tienes', 'merge: the rest stays');
  eq(forms('es', mine, 'subjunctive')[0], 'tenja', 'merge: a derived tense follows the teacher\'s yo');
  eq(base.forms.present[0], 'tengo', 'merge copies, the built-in is untouched');
  eq(forms('es', C.merge({ infinitive: 'hablar' }, { infinitive: 'hablar', forms: { future: { 1: 'hablarás!' } } }), 'future')[1], 'hablarás!', 'a new regular verb is one field');
  eq(C.validate('es', { infinitive: 'hablar', forms: { present: { 0: 'hablo' } } }), [], 'validate: a good record');
  ok(C.validate('es', { infinitive: 'hablar', forms: { present: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } }).some((p) => /seventh/.test(p)), 'validate: a seventh form');
  ok(C.validate('es', { infinitive: 'hablar', forms: { pluperfect: { 0: 'x' } } }).some((p) => /pluperfect/.test(p)), 'validate: an unknown tense');
  ok(C.validate('es', { infinitive: 'hablar', forms: { present: { 6: 'x' } } }).some((p) => /slot 6/.test(p)), 'validate: slot 6');
  ok(C.validate('es', { infinitive: 'hablar', stemChange: 'o>ue' }).some((p) => /no o/.test(p)), 'validate: a stem change on a vowel the stem does not have');
  ok(C.validate('es', { infinitive: 'hablar', stems: { aorist: 'x' } }).some((p) => /aorist/.test(p)), 'validate: stems for an unknown tense');
  ok(C.validate('es', { infinitive: 'table' }).length > 0, 'validate: not a verb');
  ok(C.validate('es', {}).length > 0, 'validate: nothing');

  // (13) pack integrity
  for (const lang of ['es', 'fr']) {
    const src = read(lang === 'es' ? '_shared/conjugate-es.js' : '_shared/conjugate-fr.js');
    ok(src.length < 24 * 1024, `${lang} pack is under 24 KB (${src.length})`);
    const names = [...src.matchAll(/\brec\('([^']+)'/g)].map((x) => x[1]);
    const seen = new Set();
    for (const n of names) { ok(!seen.has(n), `${lang}: ${n} is declared twice`); seen.add(n); }
    const L = C.languages().find((l) => l.id === lang);
    for (const t of L.tenses) ok(t.id && t.name && t.mood, `${lang}: tense ${t.id} has a name and a mood`);
    eq(L.tenses.length, 6, `${lang} declares the six tenses`);
    ok(L.reviewed === false && L.status === 'unreviewed', `${lang} is unreviewed`);
  }
  const SKIP_INV = new Set(['crire']);
  const ESV = [...read('_shared/conjugate-es.js').matchAll(/\brec\('(-?[^']+)'/g)].map((x) => x[1]);
  const FRV = [...read('_shared/conjugate-fr.js').matchAll(/\brec\('(-?[^']+)'/g)].map((x) => x[1]);
  const allEs = ESV.concat('enviar esquiar guiar confiar variar continuar actuar graduar pensar cerrar empezar comenzar entender perder sentar defender encender negar sentir preferir mentir contar encontrar recordar almorzar costar mostrar mover dormir pedir servir repetir vestir seguir competir'.split(' '));
  const allFr = FRV.concat('partir sortir dormir servir sentir ouvrir offrir couvrir souffrir acheter lever mener préférer espérer répéter appeler jeter envoyer arriver entrer monter descendre rester tomber retourner passer rentrer'.split(' '));
  const sweep = (lang, list) => {
    const ids = C.languages().find((l) => l.id === lang).tenses.map((t) => t.id);
    for (const v of new Set(list)) {
      if (v.charAt(0) === '-' || SKIP_INV.has(v)) continue;
      const rec = C.lookup(lang, v);
      ok(!!rec, `${lang} ${v}: has a record`);
      if (!rec) continue;
      eq(C.validate(lang, rec), [], `${lang} ${v} validates`);
      ok(!!C.participle(lang, v), `${lang} ${v}: has a participle`);
      for (const t of ids) {
        const r = C.conjugate(lang, v, t);
        ok(r.complete, `${lang} ${v} ${t}: complete`);
        r.forms.forEach((f, i) => {
          if (r.notes.some((n) => n.slot === i && n.kind === 'defective')) return;
          ok(f && f === f.toLowerCase() && f === f.normalize('NFC'), `${lang} ${v} ${t} slot ${i}: lowercase NFC, not empty (${f})`);
        });
      }
    }
  };
  ok(new Set(allEs).size >= 60, `es has a real inventory (${new Set(allEs).size})`);
  ok(new Set(allFr).size >= 55, `fr has a real inventory (${new Set(allFr).size})`);
  sweep('es', allEs); sweep('fr', allFr);

  // (14) purity
  const a = JSON.stringify(C.table('es', 'tener')), b = JSON.stringify(C.table('es', 'tener'));
  ok(a === b, 'same input, same output');
  ok(C.conjugate('es', 'hablar', 'present').reviewed === false && C.conjugate('es', 'hablar', 'present').status === 'unreviewed', 'a result says unreviewed');
  ok(C.table('fr', 'parler').reviewed === false, 'a table says unreviewed');
  ok(C.status === 'unreviewed', 'the module says unreviewed');
  eq(Object.keys(win).sort(), ['Conjugate'], 'the modules write nothing on window but Conjugate');
  ok(C.conjugate('xx', 'a', 'present').complete === false && C.conjugate('es', 'hablar', 'nope').complete === false, 'a missing pack or tense is incomplete, not a throw');

  // (15) two rules agree
  for (const v of new Set(allEs)) {
    if (v.charAt(0) === '-') continue;
    const pres = forms('es', v, 'present'), sub = forms('es', v, 'subjunctive'), fut = forms('es', v, 'future'), cond = forms('es', v, 'conditional');
    if (!pres[0] || !sub[0]) continue;
    ok(fut[0].slice(0, -1) === cond[0].slice(0, -2), `es ${v}: the conditional stem is the future's (${fut[0]} / ${cond[0]})`);
    const cls = C.classify('es', v)['class'];
    const rec = C.lookup('es', v);
    const spellsOut = cls === 'ar' && /[cgz]$/.test(C.classify('es', v).stem);
    if (/o$/.test(pres[0]) && !spellsOut && !(rec.stems && rec.stems.subjunctive)) {
      const want = pres[0].slice(0, -1) + (cls === 'ar' ? 'e' : 'a');
      ok(sub[0] === want, `es ${v}: the subjunctive comes from the yo form (${pres[0]} → ${sub[0]})`);
    }
  }
  for (const v of new Set(allFr)) {
    if (v.charAt(0) === '-') continue;
    const rec = C.lookup('fr', v);
    const pres = forms('fr', v, 'present'), imp = forms('fr', v, 'imperfect'), sub = forms('fr', v, 'subjunctive');
    const fut = forms('fr', v, 'future'), cond = forms('fr', v, 'conditional');
    if (!pres[0]) continue;
    ok(fut[0].slice(0, -2) === cond[0].slice(0, -3), `fr ${v}: the conditionnel stem is the futur's`);
    const hasImp = rec.stems && rec.stems.imperfect;
    if (!hasImp && /ons$/.test(pres[3])) {
      const stem = pres[3].slice(0, -3), got = imp[0].slice(0, -3);
      ok(got === stem || got === stem.replace(/ç$/, 'c') || got === stem, `fr ${v}: the imparfait stem is the nous stem (${pres[3]} → ${imp[0]})`);
    }
    const exceptional = rec.stems && rec.stems.subjunctive;
    if (!exceptional && rec.forms && !(rec.forms.subjunctive) && /ent$/.test(pres[5])) {
      ok(sub[5].slice(0, -3) === pres[5].slice(0, -3), `fr ${v}: the subjonctif ils stem is the présent's (${pres[5]} → ${sub[5]})`);
    }
  }

  // the six declared tenses are what Devon asked for ("The six", 2026-10-07)
  eq(C.languages().find((l) => l.id === 'es').tenses.map((t) => t.id), ['present', 'preterite', 'imperfect', 'future', 'conditional', 'subjunctive'], 'Spanish tense ids');
  eq(C.languages().find((l) => l.id === 'fr').tenses.map((t) => t.id), ['present', 'passe-compose', 'imperfect', 'future', 'conditional', 'subjunctive'], 'French tense ids');
  ok(C.languages().find((l) => l.id === 'es').persons.length === 6 && C.languages().find((l) => l.id === 'fr').persons[4] === 'vous', 'six persons, vosotros shown');

  return fails;
}

// (1) 079 parity: the page's own templates and irregular tables, read off the files
function parity(win) {
  const C = win.Conjugate;
  const fails = [];
  const page = read('Tools/079-verb-conjugation-poster-generator.html');
  const start = page.indexOf('var TEMPLATES = {');
  const end = page.indexOf('\n  };', start) + 5;
  if (start < 0 || end < start) return ['could not find 079\'s TEMPLATES'];
  const tctx = { DEFAULT_PERSONS: [] };
  vm.createContext(tctx);
  vm.runInContext(page.slice(start, end).replace('var TEMPLATES', 'TEMPLATES'), tctx);
  const T = tctx.TEMPLATES;
  let n = 0;
  for (const key of Object.keys(T)) {
    const t = T[key];
    if (!t.lang) continue;
    for (const panel of t.panels) {
      const verb = panel.name.replace(/^-[A-Z]+:\s*/, '').replace(/\s*\(.*$/, '');
      const got = C.conjugate(t.lang, verb, t.tense).forms;
      n += 6;
      if (JSON.stringify(got) !== JSON.stringify(panel.forms)) fails.push(`079 parity ${key}/${verb}: engine ${JSON.stringify(got)}, page ${JSON.stringify(panel.forms)}`);
    }
  }
  if (n !== 132) fails.push(`079 parity: expected 132 template forms (108 regular + 24 in the two irregular templates), compared ${n}`);
  const ictx = { window: {} };
  vm.createContext(ictx);
  vm.runInContext(read('Tools/verb-conjugation-poster-generator/irregulars.js'), ictx);
  const I = ictx.window.VCP_IRREGULARS;
  let tables = 0;
  for (const key of Object.keys(I.tenses)) {
    const t = I.tenses[key];
    for (const v of t.verbs) {
      tables++;
      const got = C.conjugate(t.lang, v.id, t.tense).forms;
      if (JSON.stringify(got) !== JSON.stringify(v.forms)) fails.push(`079 irregulars ${key}/${v.id}: engine ${JSON.stringify(got)}, page ${JSON.stringify(v.forms)}`);
    }
  }
  if (tables !== 41) fails.push(`079 irregulars: expected 41 tables, found ${tables}`);
  return fails;
}

// Broken copies: each breaks one thing; the suite must fail on every one.
const BROKEN = [
  ['the c>qu rule writes q', '_shared/conjugate-es.js', "stemRepl: [/c$/, 'qu']", "stemRepl: [/c$/, 'q']"],
  ['the z>c rule is gone', '_shared/conjugate-es.js', "stemRepl: [/z$/, 'c']", "stemRepl: [/z$/, 'z']"],
  ['the strong preterite loses its j rule', '_shared/conjugate-es.js', "strongAfterJ: 'eron'", "strongAfterJ: 'ieron'"],
  ['tener loses its preterite stem', '_shared/conjugate-es.js', "preterite: 'tuv'", "preterite: 'tuw'"],
  ['the weak stem is not used', '_shared/conjugate-es.js', "weak: 'u' }", "weak: 'o' }"],
  ['the future endings lose an accent', '_shared/conjugate-es.js', "var EV = ['é', 'ás', 'á', 'emos', 'éis', 'án']", "var EV = ['e', 'as', 'a', 'emos', 'eis', 'an']"],
  ['the imparfait loses its 3rd person ending', '_shared/conjugate-fr.js', "var IMP = ['ais', 'ais', 'ait'", "var IMP = ['ais', 'ais', 'at'"],
  ['agreement is not noted', '_shared/conjugate-fr.js', "agreementAux: 'être'", "agreementAux: 'xxx'"],
  ['payer loses its second form', '_shared/conjugate-fr.js', "stemRepl: [/y$/, 'i'], alt: true", "stemRepl: [/y$/, 'i']"],
  ['the c>ç rule is gone', '_shared/conjugate-fr.js', "stemRepl: [/c$/, 'ç']", "stemRepl: [/c$/, 'c']"],
  ['the ge>g rule is gone', '_shared/conjugate-fr.js', "stemRepl: [/e$/, '']", "stemRepl: [/x$/, '']"],
  ['haïr elides', '_shared/conjugate-fr.js', "aspirateH: ['haïr']", "aspirateH: []"],
  ['ü is no longer accepted as u', '_shared/conjugate.js', "t === e.replace(/\\u00fc/g, 'u')", "false"],
  ['ñ is treated as an accent', '_shared/conjugate.js', "if (/[\\u0300-\\u036f]/.test(ch) && /[aeiou]/i.test(prev)) continue;", "if (/[\\u0300-\\u036f]/.test(ch)) continue;"],
  ['the answer check ignores pronouns', '_shared/conjugate.js', "if (st === se) return { verdict: 'close', reason: 'pronoun' };", ''],
  ['the module says reviewed', '_shared/conjugate.js', "var STATUS = 'unreviewed';", "var STATUS = 'reviewed';"],
  ['a result says reviewed', '_shared/conjugate.js', "known: ctx.known, reviewed: false", "known: ctx.known, reviewed: true"],
  ['a teacher cell is not noted', '_shared/conjugate.js', "kinds: [teach ? 'teacher' : 'irregular']", "kinds: ['irregular']"],
  ['prefix derivation takes any ending', '_shared/conjugate.js', "r.prefixes.indexOf(pre) >= 0 &&", ''],
  ['a derived tense keeps duplicates', '_shared/conjugate.js', "if (c.forms.indexOf(j.text) < 0) c.forms.push(j.text);", "c.forms.push(j.text);"]
];

// the check sheet for the language teacher (print-corpus.mjs)
function sheetChecks() {
  const f = [];
  const { loadEngine, corpusVerbs, checkSheet } = corpus;
  const C = loadEngine();
  for (const lang of ['es', 'fr']) {
    const verbs = corpusVerbs(C, lang);
    const html = checkSheet(C, lang, verbs);
    const pages = html.split('<section>').length - 1;
    if (pages !== verbs.length) f.push(`${lang} sheet: ${pages} pages for ${verbs.length} verbs`);
    if (verbs.length < (lang === 'es' ? 60 : 50)) f.push(`${lang} sheet lists only ${verbs.length} verbs`);
    if ((html.match(/UNREVIEWED/g) || []).length !== pages) f.push(`${lang} sheet: not every page says UNREVIEWED`);
    if ((html.match(/Read by:/g) || []).length !== pages) f.push(`${lang} sheet: not every page has a line to sign`);
    for (const must of lang === 'es' ? ['tener', 'pensar', 'llover', 'conocer', 'levantar'] : ['être', 'acheter', 'payer', 'mourir', 'falloir', 'manger']) {
      if (!verbs.includes(must)) f.push(`${lang} sheet leaves out ${must}`);
    }
  }
  const one = checkSheet(C, 'es', ['tener']);
  if (!/tengo/.test(one) || !/Participle: <b>tenido/.test(one) || !/Gerund: <b>teniendo/.test(one)) f.push('the sheet for tener does not show its forms');
  if (!/<sup>irr tener<\/sup>/.test(one)) f.push('the sheet does not tag an irregular form with its rule');
  if (!/not on the pattern list/.test(checkSheet(C, 'es', ['zumbar']))) f.push('the sheet does not mark an unknown verb');
  return f;
}

let failures = [];
const note = (label, list) => { for (const f of list) failures.push(label + ': ' + f); };
note('parity', parity(load()));
note('suite', suite(load()));
note('sheet', sheetChecks());

let broken = 0;
for (const [label, file, from, to] of BROKEN) {
  let win;
  try { win = load({ file, from, to }); } catch (e) { failures.push(`broken copy "${label}" could not be made: ${e.message}`); continue; }
  let caught = false;
  try { caught = parity(win).length + suite(win).length > 0; } catch { caught = true; }
  if (!caught) failures.push(`broken copy "${label}" passed the suite`); else broken++;
}

if (failures.length) {
  console.error(`conjugate: ${failures.length} failure(s)`);
  for (const f of failures.slice(0, 60)) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log(`conjugate: ok (079 parity 132 forms + 41 tables; ${BROKEN.length} broken copies all caught)`);
void broken;
