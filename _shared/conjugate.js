/* conjugate.js — the conjugation pattern engine (Path 19 P3). Publishes window.Conjugate.
 *
 * Pure functions over data: no DOM, no storage, no fetch. The engine knows four tense
 * shapes (simple, derived from another tense, subjunctive from the yo stem, compound)
 * and nothing about any one language; each language is a pack (conjugate-es.js,
 * conjugate-fr.js) handed to Conjugate.register(). Which tenses a pack declares is the
 * curriculum decision.
 *
 * NOTHING THIS ENGINE OR ANY PACK PRODUCES HAS BEEN READ BY A LANGUAGE TEACHER. Every
 * result carries reviewed:false and status:'unreviewed', and a page that shows a table
 * says so. Do not call a table reviewed until a teacher has read it (Devon, 2026-10-21).
 *
 * A verb record (the pack's own records have the same shape, and a teacher's correction is
 * one too):
 *   { infinitive, class, stemChange, stems, forms, participle, gerund, auxiliary,
 *     reflexive, defective, gloss, prefixes, except, spelling }
 *   forms     sparse: { tenseId: { slot: 'form' } }, the last word; ' / ' separates two accepted forms
 *   stems     { tenseId: 'stem' | ['stem for slots 0 1 2 5', 'stem for slots 3 4'] | { cut, add } }
 *   defective { slots: [2] } (only those slots) or { tenses: ['future'] } (not those tenses)
 *   prefixes  the prefixes a derived verb may carry (mantener from tener)
 * A cell is computed in this order: forms, defective, then the tense's shape.
 *
 * Results: conjugate() -> { forms: [6], alts: [[...] x6], notes: [{ slot, kind, from }],
 *   complete, known, reviewed: false, status: 'unreviewed' }. A note's kind is one of
 *   teacher, defective, assumed, irregular, stem, spelling, agreement, derived, regular.
 */
(function () {
  'use strict';

  var packs = {};
  var PRIORITY = ['teacher', 'defective', 'assumed', 'irregular', 'stem', 'spelling', 'agreement', 'derived', 'regular'];
  var SLOTS = [0, 1, 2, 3, 4, 5];
  var STATUS = 'unreviewed';
  var ACCENTED_MONO = { ten: 't\u00e9n', pon: 'p\u00f3n', ven: 'v\u00e9n' };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function normalize(s) {
    return String(s == null ? '' : s).replace(/[\u2018\u2019\u02bc\u00b4]/g, "'").normalize('NFC')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Marks off vowels only: ñ and ç are letters, so they are kept.
  function stripAccents(s) {
    var d = String(s).normalize('NFD'), out = '', prev = '';
    for (var i = 0; i < d.length; i++) {
      var ch = d.charAt(i);
      if (/[\u0300-\u036f]/.test(ch) && /[aeiou]/i.test(prev)) continue;
      out += ch; prev = ch;
    }
    return out.normalize('NFC');
  }

  function splitAlts(s) {
    return String(s).split(' / ').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function register(pack) {
    if (!pack || !pack.id || !pack.tenses || !pack.classes) throw new Error('Conjugate.register: not a pack');
    pack.records = pack.records || {};
    pack.regulars = pack.regulars || {};
    pack.stemChanges = pack.stemChanges || {};
    pack.spelling = pack.spelling || [];
    pack.extraTenses = pack.extraTenses || [];
    pack._derived = {};
    packs[pack.id] = pack;
  }

  function languages() {
    return Object.keys(packs).map(function (id) {
      var p = packs[id];
      return {
        id: id, name: p.name, persons: p.persons.slice(), reviewed: false, status: STATUS,
        tenses: p.tenses.map(function (t) { return { id: t.id, name: t.name, mood: t.mood }; }),
        // tenses beyond the pack's usual six: offered, never in a default table or a page's default list
        extraTenses: p.extraTenses.map(function (t) { return { id: t.id, name: t.name, mood: t.mood }; }),
        classes: Object.keys(p.classes).filter(function (c) { return p.classes[c].auto !== false; })
          .map(function (c) { return { id: c, name: p.classes[c].name, example: p.classes[c].example }; })
      };
    });
  }

  function baseOf(p, s) {
    var r = p.reflexive;
    if (r) {
      if (r.suffix && s.length >= 4 && s.slice(-r.suffix.length) === r.suffix) {
        // Italian lavarsi is lavare + si: `restore` puts back the vowel the -si dropped
        var b = s.slice(0, -r.suffix.length) + (r.restore || '');
        if (classEnding(p, b)) return { base: b, reflexive: true };
      }
      var pre = r.prefixes || [];
      for (var i = 0; i < pre.length; i++) {
        if (s.indexOf(pre[i]) === 0 && s.length - pre[i].length >= 3) return { base: s.slice(pre[i].length), reflexive: true };
      }
    }
    return { base: s, reflexive: false };
  }

  function classEnding(p, base) {
    var ids = Object.keys(p.classes);
    for (var i = 0; i < ids.length; i++) {
      var c = p.classes[ids[i]];
      if (c.auto === false || (c.not && c.not.test(base))) continue;
      for (var j = 0; j < c.suffixes.length; j++) {
        var suf = c.suffixes[j];
        if (base.length >= suf.length && base.slice(-suf.length) === suf) return { id: ids[i], suffix: suf };
      }
    }
    return null;
  }

  function classify(lang, infinitive) {
    var p = packs[lang]; if (!p) return null;
    var b = baseOf(p, normalize(infinitive));
    var c = classEnding(p, b.base);
    if (!c) return null;
    return { 'class': c.id, stem: b.base.slice(0, -c.suffix.length), reflexive: b.reflexive, base: b.base };
  }

  function glue(pre, v) {
    if (typeof v === 'string') return pre + v;
    if (Array.isArray(v)) return v.map(function (x) { return pre + x; });
    return v;
  }

  function derive(rec, base, prefix, key) {
    var out = {};
    Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
    out.infinitive = base; out.as = key;
    delete out.prefixes; delete out.except;
    if (prefix) {
      if (rec.forms) {
        out.forms = {};
        Object.keys(rec.forms).forEach(function (t) {
          out.forms[t] = {};
          Object.keys(rec.forms[t]).forEach(function (s) {
            var f = rec.forms[t][s];
            // Spanish ten/pon/ven gain the accent once a prefix makes them two syllables (mantén, propón, prevén)
            if (t === 'command' && ACCENTED_MONO[f]) f = ACCENTED_MONO[f];
            out.forms[t][s] = prefix + f;
          });
        });
      }
      if (rec.stems) {
        out.stems = {};
        Object.keys(rec.stems).forEach(function (t) { out.stems[t] = glue(prefix, rec.stems[t]); });
      }
      if (rec.stem != null) out.stem = prefix + rec.stem;
      if (rec.participle) out.participle = prefix + rec.participle;
      if (rec.gerund) out.gerund = prefix + rec.gerund;
    }
    return out;
  }

  function lookupBase(p, c) {
    if (has(p.records, c)) return p.records[c];
    if (has(p._derived, c)) return p._derived[c];
    var best = null;
    Object.keys(p.records).forEach(function (k) {
      var r = p.records[k];
      if (k.charAt(0) === '-') {
        var suf = k.slice(1);
        if (c.length >= suf.length && c.slice(-suf.length) === suf && (!best || k.length > best.k.length)) best = { k: k, r: r, prefix: '' };
      } else if (r.prefixes && c.length > k.length && c.slice(-k.length) === k) {
        var pre = c.slice(0, -k.length);
        if (r.prefixes.indexOf(pre) >= 0 && !(r.except && r.except.indexOf(c) >= 0) && (!best || k.length > best.k.length)) best = { k: k, r: r, prefix: pre };
      }
    });
    if (!best) { p._derived[c] = null; return null; }
    var d = derive(best.r, c, best.prefix, best.k);
    p._derived[c] = d;
    return d;
  }

  function knownBase(p, c) { return !!(lookupBase(p, c) || has(p.regulars, c)); }

  // A pack with `separable: { prefixes }` (German): an infinitive that is a prefix glued to a verb the
  // pack knows (aufmachen = auf + machen) is that verb, with the prefix moved to the end of a finite form.
  function splitSeparable(p, inf) {
    var sp = p.separable;
    if (!sp || !sp.prefixes || knownBase(p, inf)) return null;
    for (var i = 0; i < sp.prefixes.length; i++) {
      var pre = sp.prefixes[i];
      if (inf.indexOf(pre) === 0 && inf.length - pre.length >= 3 && knownBase(p, inf.slice(pre.length))) {
        return { prefix: pre, base: inf.slice(pre.length) };
      }
    }
    return null;
  }

  function lookup(lang, infinitive) {
    var p = packs[lang]; if (!p) return null;
    var inf = baseOf(p, normalize(infinitive)).base;
    var sp = splitSeparable(p, inf);
    if (sp) {
      var rec = lookupBase(p, sp.base);
      if (!rec) return null;
      var out = {};
      Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
      out.infinitive = inf; out.as = sp.base; delete out.prefixes; delete out.except;
      return out;
    }
    return lookupBase(p, inf) || null;
  }

  function resolve(lang, verb) {
    var p = packs[lang]; if (!p) return null;
    var rec, inf, reflexive;
    if (typeof verb === 'string') {
      var b = baseOf(p, normalize(verb));
      inf = b.base; reflexive = b.reflexive;
      rec = lookupBase(p, inf);
    } else {
      rec = verb || {};
      var bb = baseOf(p, normalize(rec.infinitive || ''));
      inf = bb.base; reflexive = bb.reflexive || !!rec.reflexive;
    }
    var sepSplit = splitSeparable(p, inf), sep = '', full = inf;
    if (sepSplit) {
      sep = sepSplit.prefix; inf = sepSplit.base;
      if (typeof verb === 'string') rec = lookupBase(p, inf);
    }
    var cl = (rec && rec['class']) || (classEnding(p, inf) || {}).id || null;
    var cdef = cl ? p.classes[cl] : null;
    var cut = cdef ? (cdef.cut || 2) : 0;
    var known = typeof verb === 'string' ? (!!rec || has(p.regulars, inf))
      : !!(lookupBase(p, inf) || has(p.regulars, inf) || (rec && rec.teacher && Object.keys(rec.teacher).length));
    return {
      lang: lang, p: p, rec: rec || null, base: inf, sep: sep, full: full, reflexive: reflexive, cls: cl, 'class': cdef,
      // rec.stem is a lexical stem the infinitive does not show (Latin: dīcere -> dīc-)
      stem: cdef ? (rec && rec.stem != null ? rec.stem : inf.slice(0, inf.length - cut)) : '', known: known, cutLen: cut,
      infBase: inf.replace(/í(r)$/, 'i$1')
    };
  }

  function tenseDef(p, id) {
    for (var i = 0; i < p.tenses.length; i++) if (p.tenses[i].id === id) return p.tenses[i];
    for (var j = 0; j < p.extraTenses.length; j++) if (p.extraTenses[j].id === id) return p.extraTenses[j];
    return null;
  }

  function endingsFor(tdef, cls) { var e = tdef.endings || {}; return e[cls] || e.all || null; }

  function specStem(spec, slot, base) {
    if (typeof spec === 'string') return spec;
    if (Array.isArray(spec)) return (slot === 3 || slot === 4) ? spec[1] : spec[0];
    if (spec && spec.cut != null) return base.slice(0, base.length - spec.cut.length) + (spec.add || '');
    return null;
  }

  function applyChange(d, stem, to) {
    if (d.atEnd) return stem.slice(-d.find.length) === d.find ? stem.slice(0, -d.find.length) + to : null;
    var i = stem.lastIndexOf(d.find);
    return i < 0 ? null : stem.slice(0, i) + to + stem.slice(i + d.find.length);
  }

  function stemFor(ctx, tdef, slot) {
    var rec = ctx.rec || {}, sc = rec.stemChange, d = sc && ctx.p.stemChanges[sc];
    var out = { stem: ctx.stem, kinds: [], from: '' };
    if (!d || (d['in'] && d['in'].indexOf(tdef.id) < 0)) return out;
    var s2 = null;
    if (tdef.boot && tdef.boot.indexOf(slot) >= 0) s2 = applyChange(d, ctx.stem, d.boot);
    else if (d.weak != null && ctx.cls === 'ir' && tdef.weak && tdef.weak.indexOf(slot) >= 0) s2 = applyChange(d, ctx.stem, d.weak);
    if (s2 != null) { out.stem = s2; out.kinds.push('stem'); out.from = sc; }
    return out;
  }

  function junction(ctx, stem, ending, literal) {
    var out = { text: stem + ending, alt: null, kind: null, from: '' };
    if (ctx.rec && ctx.rec.spelling === false) return out;
    var rules = ctx.p.spelling;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (literal && !r.literalToo) continue;
      if (r.tenses && r.tenses.indexOf(ctx.tid) < 0) continue;
      if (r.cls && r.cls.indexOf(ctx.cls) < 0) continue;
      if (!r.stem.test(stem) || !r.next.test(ending)) continue;
      var s2 = r.stemRepl ? stem.replace(r.stemRepl[0], r.stemRepl[1]) : stem;
      var e2 = r.endRepl ? ending.replace(r.endRepl[0], r.endRepl[1]) : ending;
      out.text = s2 + e2; out.kind = 'spelling'; out.from = r.id;
      if (r.alt) out.alt = stem + ending;
      return out;
    }
    return out;
  }

  function fail() { return { forms: [], kinds: [], from: '' }; }

  function fromJunction(j, kinds, from) {
    var c = { forms: [j.text], kinds: kinds.slice(), from: from || '' };
    if (j.alt) c.forms.push(j.alt);
    if (j.kind) { c.kinds.push(j.kind); if (!c.from) c.from = j.from; }
    return c;
  }

  function simpleCell(ctx, tdef, slot) {
    var rec = ctx.rec || {}, kinds = [], from = '';
    var ends = endingsFor(tdef, ctx.cls);
    if (!ends) return fail();
    var ending = ends[slot];
    var key = (tdef.stemsAlias && !(rec.stems && has(rec.stems, tdef.id))) ? tdef.stemsAlias : tdef.id;
    var spec = rec.stems ? rec.stems[key] : undefined;
    var stem, literal = false;
    if (spec != null) {
      stem = specStem(spec, slot, ctx.base);
      if (stem == null) return fail();
      literal = true; kinds.push('irregular'); from = rec.as || rec.infinitive || '';
      if (tdef.strongEndings && (!tdef.strongIf || rec[tdef.strongIf])) {
        ending = tdef.strongEndings[slot];
        if (tdef.strongAfterJ && slot === 5 && /j$/.test(stem)) ending = tdef.strongAfterJ;
      }
    } else if (tdef.stemFrom === 'infinitive') {
      stem = ctx.infBase; literal = true;
    } else {
      var sf = stemFor(ctx, tdef, slot);
      stem = sf.stem; kinds = kinds.concat(sf.kinds); from = sf.from;
      var short = ctx['class'].shortSlots;
      if (tdef.id === 'present' && short && short.indexOf(slot) >= 0) stem = stem.slice(0, -1);
      if (tdef.prependClassSuffix) ending = (ctx['class'].futureSuffix || '') + ending;
    }
    if (ending == null || ending === undefined) return fail();
    return fromJunction(junction(ctx, stem, ending, literal), kinds, from);
  }

  function subjunctiveCell(ctx, tdef, slot) {
    var rec = ctx.rec || {}, ends = endingsFor(tdef, ctx.cls);
    if (!ends) return fail();
    var kinds = [], from = '', stem, literal = false;
    var spec = rec.stems ? rec.stems[tdef.id] : undefined;
    var yo = rec.forms && rec.forms.present && rec.forms.present[0];
    if (spec != null) {
      stem = specStem(spec, slot, ctx.base); literal = true; kinds.push('irregular'); from = rec.as || rec.infinitive || '';
    } else if (yo) {
      var y = splitAlts(yo)[0];
      if (!/o$/.test(y)) return fail();
      stem = y.slice(0, -1); literal = true; kinds.push('irregular'); from = rec.as || rec.infinitive || '';
    } else {
      var sf = stemFor(ctx, tdef, slot);
      stem = sf.stem; kinds = sf.kinds; from = sf.from;
    }
    return fromJunction(junction(ctx, stem, ends[slot], literal), kinds, from);
  }

  function derivedCell(ctx, tdef, slot) {
    var rec = ctx.rec || {}, ends = endingsFor(tdef, ctx.cls);
    if (!ends) return fail();
    var spec = rec.stems ? rec.stems[tdef.id] : undefined;
    if (spec != null) {
      var st = specStem(spec, slot, ctx.base);
      if (st == null) return fail();
      return fromJunction(junction(ctx, st, ends[slot], true), ['irregular'], rec.as || rec.infinitive || '');
    }
    var dd = tdef.derived, srcDef = tenseDef(ctx.p, dd.from);
    var src = cellOf(ctx, srcDef, dd.pick[slot]);
    if (!src.forms.length) return fail();
    var cut = dd.cut[slot], c = { forms: [], kinds: [], from: src.from };
    src.kinds.forEach(function (k) { if (k !== 'teacher' && k !== 'regular' && c.kinds.indexOf(k) < 0) c.kinds.push(k); });
    for (var i = 0; i < src.forms.length; i++) {
      var f = src.forms[i];
      if (f.length <= cut) return fail();
      var base = f.slice(0, -cut);
      // Spanish -ra subjunctive: the nosotros form carries the accent on the vowel before it (habláramos)
      if (dd.accent && dd.accent.indexOf(slot) >= 0) base = base.replace(/([aeiou])([^aeiou]*)$/, function (m, v, rest) { return 'áéíóú'['aeiou'.indexOf(v)] + rest; });
      var j = junction(ctx, base, ends[slot], false);
      if (c.forms.indexOf(j.text) < 0) c.forms.push(j.text);
      if (j.alt && c.forms.indexOf(j.alt) < 0) c.forms.push(j.alt);
      if (j.kind && c.kinds.indexOf(j.kind) < 0) { c.kinds.push(j.kind); if (!c.from) c.from = j.from; }
    }
    return c;
  }

  // A tense that borrows each slot from another (a command: tú from the present, usted from the subjunctive,
  // vosotros from the infinitive). A slot with no entry has no such form.
  function pickCell(ctx, tdef, slot) {
    var spec = tdef.pick[slot];
    if (!spec) return { forms: [], kinds: ['defective'], from: '', defective: true };
    if (spec.infinitive) return { forms: [ctx.base.replace(spec.infinitive[0], spec.infinitive[1])], kinds: [], from: '' };
    var sl = spec.byClass && spec.byClass[ctx.cls] != null ? spec.byClass[ctx.cls] : spec.slot;
    var src = cellOf(ctx, tenseDef(ctx.p, spec.from), sl);
    if (!src.forms.length) return fail();
    var c = { forms: [], kinds: [], from: src.from };
    src.kinds.forEach(function (k) { if (k !== 'teacher' && k !== 'regular' && c.kinds.indexOf(k) < 0) c.kinds.push(k); });
    src.forms.forEach(function (f) {
      var d = spec.drop;
      c.forms.push(d && d.cls.indexOf(ctx.cls) >= 0 && f.slice(-d.end.length) === d.end ? f.slice(0, -d.end.length) : f);
    });
    return c;
  }

  function participleOf(ctx) {
    var rec = ctx.rec || {};
    if (rec.participle) return (ctx.sep || '') + rec.participle;
    if (ctx.p.participleOf) return (ctx.sep || '') + ctx.p.participleOf(ctx);
    var pd = ctx['class'] && ctx['class'].participle;
    if (!pd) return '';
    if (pd.ending) return junction(ctx, ctx.stem, pd.ending, false).text;
    if (pd.add) return ctx.stem + pd.add;
    return '';
  }

  function gerundOf(ctx) {
    var rec = ctx.rec || {};
    if (rec.gerund) return rec.gerund;
    var gd = ctx['class'] && ctx['class'].gerund;
    if (!gd) return '';
    var sf = stemFor(ctx, { id: 'gerund', boot: [], weak: SLOTS }, 0);
    return junction(ctx, sf.stem, gd.ending, false).text;
  }

  function compoundCell(ctx, tdef, slot) {
    var p = ctx.p, rec = ctx.rec || {};
    var cd = tdef.compound, auxName, ac, part;
    if (cd.forms) {
      // an auxiliary written out (German werden: werde, wirst, ... and würde, ...) with the infinitive after it
      auxName = cd.auxiliary; ac = { forms: [cd.forms[slot]] };
    } else {
      auxName = (ctx.reflexive && p.reflexiveAux) || rec.auxiliary || cd.auxiliary;
      ac = cellOf(resolve(ctx.lang, auxName), tenseDef(p, cd.tense), slot);
    }
    part = cd.part === 'infinitive' ? (ctx.sep || '') + ctx.base : participleOf(ctx);
    if (!ac.forms.length || !part) return fail();
    var kinds = [], from = '';
    if (!cd.forms && auxName === p.agreementAux) {
      kinds.push('agreement'); from = auxName;
      // a pack that prints the masculine plural for nous/noi/vous... says how
      if (p.agreementPlural && slot >= 3) part = part.replace(p.agreementPlural[0], p.agreementPlural[1]);
    }
    if (cd.part !== 'infinitive' && rec.participle) { kinds.push('irregular'); if (!from) from = rec.as || rec.infinitive || ''; }
    return { forms: [ac.forms[0] + ' ' + part], kinds: kinds, from: from, whole: true };
  }

  function cellOf(ctx, tdef, slot) {
    var c = cellOf1(ctx, tdef, slot);
    // words that follow the verb (German imperative: machen wir, machen Sie), before a separable prefix
    if (tdef.append && tdef.append[slot] && c.forms.length && c.kinds.indexOf('teacher') < 0) {
      c.forms = c.forms.map(function (f) { return f + tdef.append[slot]; });
    }
    // the separable prefix goes to the end of a finite form (ich mache auf); a teacher's own cell is whole already
    if (ctx.sep && c.forms.length && !c.whole && c.kinds.indexOf('teacher') < 0) {
      c.forms = c.forms.map(function (f) { return f + ' ' + ctx.sep; });
    }
    return c;
  }

  function cellOf1(ctx, tdef, slot) {
    var rec = ctx.rec || {};
    ctx.tid = tdef.id;
    var tf = rec.forms && rec.forms[tdef.id];
    if (tf && tf[slot] != null && tf[slot] !== '') {
      var teach = !!(rec.teacher && rec.teacher[tdef.id] && rec.teacher[tdef.id][slot]);
      return { forms: splitAlts(tf[slot]), kinds: [teach ? 'teacher' : 'irregular'], from: rec.as || rec.infinitive || '' };
    }
    var d = rec.defective;
    if (d && ((d.slots && d.slots.indexOf(slot) < 0) || (d.tenses && d.tenses.indexOf(tdef.id) >= 0))) {
      return { forms: [], kinds: ['defective'], from: '', defective: true };
    }
    if (!ctx['class']) return fail();
    // a slot the tense has no form for (a command has no first person singular)
    if (tdef.none && tdef.none.indexOf(slot) >= 0) return { forms: [], kinds: ['defective'], from: '', defective: true };
    // a deponent verb (Latin loquor) wears the passive endings of the tenses that have a passive twin
    if (rec.deponent && tdef.deponentAs) tdef = tenseDef(ctx.p, tdef.deponentAs);
    if (tdef.kind === 'compound') return compoundCell(ctx, tdef, slot);
    if (tdef.kind === 'derived') return derivedCell(ctx, tdef, slot);
    if (tdef.kind === 'pick') return pickCell(ctx, tdef, slot);
    if (tdef.kind === 'subjunctive') return subjunctiveCell(ctx, tdef, slot);
    return simpleCell(ctx, tdef, slot);
  }

  function noteOf(ctx, cell) {
    var kinds = cell.kinds.slice();
    if (!ctx.known && kinds.indexOf('defective') < 0 && kinds.indexOf('teacher') < 0) kinds.push('assumed');
    if (ctx.rec && ctx.rec.as && kinds.length === 0) kinds.push('derived');
    var kind = 'regular';
    for (var i = 0; i < PRIORITY.length; i++) if (kinds.indexOf(PRIORITY[i]) >= 0) { kind = PRIORITY[i]; break; }
    var from = cell.from || '';
    if (kind === 'regular' && !from) from = ctx.cls || '';
    if (kind === 'derived' && !from) from = ctx.rec.as;
    return { kind: kind, from: from };
  }

  function startsWithVowel(ctx, s) {
    if (/^[aeiouyàâäéèêëîïôöûùüœæ]/.test(s)) return true;
    if (s.charAt(0) === 'h') return (ctx.p.aspirateH || []).indexOf(ctx.base) < 0;
    return false;
  }

  function joinWord(ctx, word, rest) {
    var el = ctx.p.elision;
    if (el && has(el, word) && startsWithVowel(ctx, rest)) return el[word] + rest;
    return word + ' ' + rest;
  }

  function render(ctx, form, slot, opts) {
    var s = form;
    if (ctx.reflexive && ctx.p.reflexivePronouns) {
      if (ctx.p.reflexivePlacement === 'after') {
        // German: the pronoun follows the finite verb (ich wasche mich, ich habe mich gewaschen, ich ziehe mich an)
        var sp = s.indexOf(' ');
        s = sp < 0 ? s + ' ' + ctx.p.reflexivePronouns[slot] : s.slice(0, sp) + ' ' + ctx.p.reflexivePronouns[slot] + s.slice(sp);
      } else s = joinWord(ctx, ctx.p.reflexivePronouns[slot], s);
    }
    if (opts.pronouns && ctx.p.subjects) s = joinWord(ctx, ctx.p.subjects[slot], s);
    return s;
  }

  function blank(problem) {
    return { forms: ['', '', '', '', '', ''], alts: [[], [], [], [], [], []], notes: [], complete: false, known: false,
      reviewed: false, status: STATUS, problem: problem };
  }

  function conjugate(lang, verb, tenseId, opts) {
    opts = opts || {};
    var ctx = resolve(lang, verb);
    if (!ctx) return blank('no pack for ' + lang);
    var tdef = tenseDef(ctx.p, tenseId);
    if (!tdef) return blank('no tense ' + tenseId);
    if (!ctx['class']) return blank('not a verb this pack knows');
    if (tdef.noReflexive && ctx.reflexive) return blank('not built for a reflexive verb');
    var slots = opts.slots || SLOTS;
    var out = { forms: [], alts: [], notes: [], complete: true, known: ctx.known, reviewed: false, status: STATUS,
      lang: lang, tense: tenseId, infinitive: ctx.full || ctx.base, reflexive: ctx.reflexive };
    SLOTS.forEach(function (slot) {
      if (slots.indexOf(slot) < 0) { out.forms.push(''); out.alts.push([]); return; }
      var c = cellOf(ctx, tdef, slot);
      if (!c.forms.length) {
        out.forms.push(''); out.alts.push([]);
        if (c.defective) out.notes.push({ slot: slot, kind: 'defective', from: '' });
        else out.complete = false;
        return;
      }
      var rendered = c.forms.map(function (f) { return render(ctx, f, slot, opts); });
      out.forms.push(rendered[0]); out.alts.push(rendered.slice(1));
      var n = noteOf(ctx, c);
      out.notes.push({ slot: slot, kind: n.kind, from: n.from });
    });
    return out;
  }

  function table(lang, verb, tenseIds, opts) {
    var p = packs[lang]; if (!p) return null;
    var ids = tenseIds || p.tenses.map(function (t) { return t.id; });
    var ctx = resolve(lang, verb);
    return {
      reviewed: false, status: STATUS, known: !!(ctx && ctx.known),
      tenses: ids.map(function (id) {
        var r = conjugate(lang, verb, id, opts);
        return { id: id, forms: r.forms, alts: r.alts, notes: r.notes, complete: r.complete };
      }),
      participle: ctx && ctx.cls ? participleOf(ctx) : '',
      gerund: ctx && ctx.cls ? gerundOf(ctx) : ''
    };
  }

  // ---- the answer check ---------------------------------------------------

  function stripPronouns(p, s) {
    var pr = p.pronouns || { words: [] }, prev;
    do {
      prev = s;
      if (pr.elided) s = s.replace(pr.elided, '');
      var i = s.indexOf(' ');
      if (i > 0 && pr.words.indexOf(s.slice(0, i)) >= 0) s = s.slice(i + 1);
    } while (s !== prev);
    // a pack that puts the reflexive pronoun after the verb: a missing or extra one is the same close answer
    if (p.reflexivePlacement === 'after') {
      s = s.split(' ').filter(function (w, k) { return k === 0 || p.reflexivePronouns.indexOf(w) < 0; }).join(' ');
    }
    return s;
  }

  function undoElision(p, s) {
    var pr = p.pronouns;
    if (!pr || !pr.unelide) return s;
    return s.replace(pr.unelide, function (m, w) { return pr.unelideTo[w]; }).trim();
  }

  function rank(v) { return v === 'correct' ? 3 : v === 'close' ? 2 : 1; }

  function matchOne(p, t, e) {
    if (t === e) return { verdict: 'correct', reason: '' };
    // ü is accepted as u (Devon, 2026-10-21: "Lenient (u accepted)"), and the caller shows the ü form beside it
    if (e.indexOf('\u00fc') >= 0 && t === e.replace(/\u00fc/g, 'u')) return { verdict: 'correct', reason: 'diaeresis' };
    // ss typed for ß is close, not wrong: a US keyboard has no ß
    if (e.indexOf('\u00df') >= 0 && t === e.replace(/\u00df/g, 'ss')) return { verdict: 'close', reason: 'eszett' };
    if (stripAccents(t) === stripAccents(e)) return { verdict: 'close', reason: 'accent' };
    if (undoElision(p, t) === undoElision(p, e)) return { verdict: 'close', reason: 'elision' };
    var st = stripPronouns(p, t), se = stripPronouns(p, e);
    if (st === se) return { verdict: 'close', reason: 'pronoun' };
    if (stripAccents(st) === stripAccents(se)) return { verdict: 'close', reason: 'accent' };
    return { verdict: 'wrong', reason: '' };
  }

  function match(typed, expected, opts) {
    var p = packs[(opts && opts.lang) || ''] || {};
    var t = normalize(typed);
    var list = Array.isArray(expected) ? expected : splitAlts(expected);
    var best = { verdict: 'wrong', reason: '', expected: list.length ? list[0] : '' };
    if (!t) return best;
    list.forEach(function (raw) {
      var e = normalize(raw), r = matchOne(p, t, e);
      if (rank(r.verdict) > rank(best.verdict)) best = { verdict: r.verdict, reason: r.reason, expected: raw };
    });
    return best;
  }

  // ---- teacher records ------------------------------------------------------

  function merge(record, teacherRecord) {
    var out = {}, t = teacherRecord || {};
    Object.keys(record || {}).forEach(function (k) { out[k] = record[k]; });
    Object.keys(t).forEach(function (k) {
      if (k === 'forms' || k === 'stems' || k === 'teacher') return;
      out[k] = t[k];
    });
    out.forms = {}; out.stems = {}; out.teacher = {};
    ['forms', 'stems'].forEach(function (f) {
      var a = (record && record[f]) || {}, b = t[f] || {};
      Object.keys(a).forEach(function (id) { out[f][id] = f === 'forms' ? Object.assign({}, a[id]) : a[id]; });
      Object.keys(b).forEach(function (id) {
        if (f === 'forms') {
          out.forms[id] = Object.assign(out.forms[id] || {}, b[id]);
          Object.keys(b[id]).forEach(function (s) { (out.teacher[id] = out.teacher[id] || {})[s] = true; });
        } else out.stems[id] = b[id];
      });
    });
    return out;
  }

  function validate(lang, record) {
    var p = packs[lang], problems = [];
    if (!p) return ['no pack for ' + lang];
    if (!record || !record.infinitive) problems.push('the verb has no infinitive');
    var ctx = record && record.infinitive ? resolve(lang, record) : null;
    if (ctx && !ctx.cls) problems.push(record.infinitive + ' does not end in a class this language has');
    var ids = p.tenses.concat(p.extraTenses).map(function (t) { return t.id; });
    if (record && record.forms) Object.keys(record.forms).forEach(function (id) {
      if (ids.indexOf(id) < 0) { problems.push('forms names a tense this language does not have: ' + id); return; }
      var f = record.forms[id];
      if (Array.isArray(f)) { if (f.length > 6) problems.push('a seventh form in ' + id); return; }
      Object.keys(f).forEach(function (s) {
        if (!/^[0-5]$/.test(s)) problems.push('a form in ' + id + ' is for slot ' + s + ', and slots run 0 to 5');
      });
    });
    if (record && record.stems) Object.keys(record.stems).forEach(function (id) {
      if (ids.indexOf(id) < 0) problems.push('stems names a tense this language does not have: ' + id);
    });
    if (record && record.stemChange) {
      var d = p.stemChanges[record.stemChange];
      if (!d) problems.push('unknown stem change ' + record.stemChange);
      else if (ctx && ctx.cls && applyChange(d, ctx.stem, d.boot) == null) {
        problems.push('the stem of ' + record.infinitive + ' has no ' + d.find + ' for ' + record.stemChange + ' to change');
      }
    }
    return problems;
  }

  window.Conjugate = {
    register: register, languages: languages, classify: classify, lookup: lookup,
    conjugate: conjugate, table: table, match: match, merge: merge, validate: validate,
    normalize: normalize, stripAccents: stripAccents, status: STATUS,
    // every verb the pack holds a record for or names as regular (a '-family' record is not a verb), sorted
    inventory: function (lang) {
      var p = packs[lang]; if (!p) return [];
      var all = Object.keys(p.records).concat(Object.keys(p.regulars), p.examples || []).filter(function (v) { return v.charAt(0) !== '-'; });
      return all.filter(function (v, i) { return all.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b, lang); });
    },
    participle: function (lang, verb) { var c = resolve(lang, verb); return c && c.cls ? participleOf(c) : ''; },
    gerund: function (lang, verb) { var c = resolve(lang, verb); return c && c.cls ? gerundOf(c) : ''; }
  };
})();
