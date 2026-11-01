// print-corpus.mjs — the check sheet for the language teacher who proofreads the verb tables
// (Path 19 P3; Devon, 2026-10-21: a teacher reads them, and until one has, no table is called reviewed).
//
//   node Tools/conjugate/print-corpus.mjs es > es-check-sheet.html      (also: de, it, la, fr)
//   node Tools/conjugate/print-corpus.mjs es --verbs tener,pensar       (a few verbs only)
//
// Writes one self-contained HTML page: for every verb the pack holds a record for (and a list of
// regular verbs besides), one printed page with every tense, the six persons, the participle and
// gerund, what rule made each form, and a line to sign. It needs nothing but Node and the three
// scripts the page loads. It reads the pack, so a correction to a pack changes the next sheet.
//
// Nothing on this sheet has been read by a language teacher. It says so at the top of every page,
// and a verb is only signed off by the person who signs it.

/* global process -- this is a command-line tool, not a page script */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadEngine() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['conjugate', 'conjugate-es', 'conjugate-de', 'conjugate-it', 'conjugate-la', 'conjugate-fr']) {
    vm.runInContext(fs.readFileSync(path.join(site, '_shared', f + '.js'), 'utf8'), ctx, { filename: f });
  }
  return ctx.window.Conjugate;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const KIND = { teacher: 'edit', defective: 'none', assumed: '?', irregular: 'irr', stem: 'stem', spelling: 'spell', agreement: 'agr', derived: 'like', regular: '' };

/* The verbs of a pack: its records and the regular verbs it names. */
export function corpusVerbs(C, lang) {
  return C.inventory(lang);
}

export function checkSheet(C, lang, verbs) {
  const info = C.languages().find((l) => l.id === lang);
  const pages = verbs.map((v) => {
    const t = C.table(lang, v, null, { pronouns: true });
    const rows = info.persons.map((person, slot) => {
      const cells = t.tenses.map((te) => {
        const note = (C.conjugate(lang, v, te.id).notes.filter((n) => n.slot === slot)[0]) || { kind: '', from: '' };
        const alts = (te.alts[slot] || []).length ? ' / ' + te.alts[slot].join(' / ') : '';
        return `<td>${esc(te.forms[slot] + alts)}${KIND[note.kind] ? ` <sup>${esc(KIND[note.kind])}${note.from && note.kind !== 'regular' ? ' ' + esc(note.from) : ''}</sup>` : ''}</td>`;
      }).join('');
      return `<tr><th>${esc(person)}</th>${cells}</tr>`;
    }).join('');
    // tenses beyond the six get a second table, so the six-column page a teacher already knows does not move
    // a tense that exists only for a reflexive verb (the infinitive with its pronoun) is left off a verb that is not
    const refl = !!(C.classify(lang, v) || {}).reflexive;
    const xs = (info.extraTenses || []).filter((x) => !x.onlyReflexive || refl).map((x) => x.id);
    let extraTable = '';
    if (xs.length) {
      const xt = C.table(lang, v, xs, { pronouns: true });
      const xrows = info.persons.map((person, slot) => {
        const cells = xt.tenses.map((te) => {
          const note = (C.conjugate(lang, v, te.id).notes.filter((n) => n.slot === slot)[0]) || { kind: '', from: '' };
          const alts = (te.alts[slot] || []).length ? ' / ' + te.alts[slot].join(' / ') : '';
          return `<td>${esc(te.forms[slot] ? te.forms[slot] + alts : '\u2014')}${KIND[note.kind] ? ` <sup>${esc(KIND[note.kind])}${note.from && note.kind !== 'regular' ? ' ' + esc(note.from) : ''}</sup>` : ''}</td>`;
        }).join('');
        return `<tr><th>${esc(person)}</th>${cells}</tr>`;
      }).join('');
      extraTable = `<p class="more">More tenses (offered, not in a page's default list):</p>
<table><thead><tr><th></th>${xt.tenses.map((te) => `<th>${esc(info.extraTenses.find((x) => x.id === te.id).name)}</th>`).join('')}</tr></thead><tbody>${xrows}</tbody></table>`;
    }
    return `<section>
<p class="warn">UNREVIEWED &mdash; no language teacher has read this table yet.</p>
<h2>${esc(v)} <small>(${esc(info.name)}${t.known ? '' : ', not on the pattern list: assumed regular'})</small></h2>
<table><thead><tr><th></th>${t.tenses.map((te) => `<th>${esc(info.tenses.find((x) => x.id === te.id).name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
${extraTable}
${t.participle || t.gerund ? `<p>Participle: <b>${esc(t.participle)}</b>${t.gerund ? ` &nbsp; Gerund: <b>${esc(t.gerund)}</b>` : ''}</p>` : '<p>Principal parts: the perfect stem on the record (a third-conjugation perfect is lexical, and the one to read first).</p>'}
<p class="sign">Read by: ____________________ &nbsp; Date: __________ &nbsp; Correct &#9744; &nbsp; Corrections: ______________________________</p>
</section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(info.name)} verb check sheet (unreviewed)</title>
<style>
body{font:11pt Georgia,serif;margin:1.2cm}section{break-after:page;page-break-after:always}h2{margin:.2em 0}small{font-weight:400;color:#444}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:.25em .4em;text-align:left;font-size:10pt}thead th{background:#eee}
sup{color:#555;font-size:7pt}.more{margin:.8em 0 .2em;font-weight:700}.warn{font-weight:700;border:2px solid #000;padding:.2em .5em}.sign{margin-top:1.2em}
@media print{@page{size:landscape;margin:1cm}}
</style></head><body>
<h1>${esc(info.name)}: verb tables for a language teacher to check</h1>
<p>Generated by the pattern engine; <b>no one has read these</b>. Please mark any form that is wrong. Tags: irr = irregular, stem = stem change, spell = spelling change, like = conjugated like the verb named, none = the verb has no such form, ? = verb not on the pattern list. French passé composé prints the masculine singular (Devon's choice); French spelling is pre-1990; payer gives both paie and paye. German: Perfekt is haben/sein + Partizip II, Futur I is werden + infinitive, the conditional is the everyday würde + infinitive, the last column is Konjunktiv I; a separable verb (aufmachen) puts the prefix last in a finite form; a reflexive verb (sich waschen) puts mich/dich/sich/uns/euch after the finite verb, and takes haben in the Perfekt. The second table on a page holds the tenses beyond the six: German Plusquamperfekt (hatte/war + Partizip II), the passive (werden + Partizip II; it is printed for every verb, including ones that cannot be passive in practice) and the imperative (du, wir, ihr, Sie; nothing for er; no modal has one). Spanish: present perfect, the -ra imperfect subjunctive, the affirmative command (a dash is a slot with no such form). Italian: the congiuntivo imperfetto (built on the imperfetto's stem) and the affirmative imperativo. French: the affirmative impératif (tu loses its -s on -er verbs: parle, va). Latin: beyond the six, the present and imperfect subjunctive and the present, imperfect and future passive (a deponent such as loqui wears the passive endings in the present, imperfect and future and is empty elsewhere, because the perfect passive is not built; esse, posse, velle, ire and stare have no passive); the six active indicative tenses; the pluperfect and future perfect are built on the perfect stem, which is the cell to read first in a third-conjugation verb; macrons are the least certain part; a long vowel inside the stem (dīcō) is a record, not a rule. Added in AI-27 P3e (all of it new for the teacher to read): Spanish pluperfect (había hablado), present perfect subjunctive (haya hablado), pluperfect subjunctive (hubiera hablado; -ra form only), and, for a reflexive verb, the command with its pronoun on the end (levántate, levántese, levantémonos, levantaos, levántense; the written accent is worked out from where the stress falls) and the infinitive with its pronoun (levantarme); dé and sé are left empty when a pronoun would follow, because the diacritic accent may not stay; there is no negative command in Spanish or Italian (Devon has not said he wants one). French: plus-que-parfait, subjonctif passé, the impératif négatif (ne parle pas, ne te lève pas) and a reflexive impératif (lève-toi, levons-nous, levez-vous); the agreement choices are as in the passé composé (masculine singular). Italian: trapassato prossimo, congiuntivo passato, congiuntivo trapassato (masculine, plural for noi/voi/loro with essere) and, for a reflexive verb, the imperativo with the pronoun (lavati, laviamoci, lavatevi; Lei and Loro keep it in front: si lavi) and the infinitive with its pronoun (lavarmi); the short tu forms fa', da', sta' double the consonant (fatti, datti); the other short forms are left empty. German: Konjunktiv II proper (wäre, käme, hätte, könnte: the Präteritum stem with umlaut and -e, -est, -e, -en, -et, -en; a weak verb's is its Präteritum; stehen, verstehen, beginnen, gewinnen, helfen, gelten and schwimmen show both forms; kennen, nennen and rennen are left empty for the teacher), dative reflexives (sich (dat.) vorstellen: ich stelle mir vor; sich merken, kaufen, holen... are always dative; the object itself, etwas or die Zähne, is not in any form), and the participle's ge- rule (an inseparable prefix is one followed by something that can begin a German word). Latin: the perfect, pluperfect and future perfect passive (amātus sum, amātus eram, amātus erō: masculine, plural for nōs/vōs/eī; the participle is the fourth principal part, and a verb with none in the pack, or no personal passive, is left empty; the deponent perfect, locūtus sum, is not built) and the imperative (tū, vōs; dīc, dūc, fac, fer; a deponent: loquere, loquiminī). Italian: the passato prossimo with essere prints the masculine form (singular, then plural for noi/voi/loro); -ire verbs with -isc- are marked in the pack by a flag, so check finisco/dormo for each -ire verb; a reflexive verb (lavarsi) puts the pronoun first and takes essere, with the same masculine agreement.</p>
${pages}
</body></html>`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lang = process.argv[2];
  if (!['es', 'de', 'it', 'la', 'fr'].includes(lang)) { console.error('usage: node Tools/conjugate/print-corpus.mjs es|de|it|la|fr [--verbs a,b]'); process.exit(2); }
  const C = loadEngine();
  const i = process.argv.indexOf('--verbs');
  const verbs = i > 0 ? process.argv[i + 1].split(',') : corpusVerbs(C, lang);
  process.stdout.write(checkSheet(C, lang, verbs));
}
