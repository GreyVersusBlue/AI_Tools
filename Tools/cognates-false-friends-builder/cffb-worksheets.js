/* Cognates & False Friends Reference List Builder — practice worksheets (BACKLOG rank 85).

   Pure and DOM-free except build(), which makes nodes with createElement and never sets
   innerHTML (the page takes share-link input, so check:inline-sinks counts every markup sink).
   No storage, no clock, no Math.random: the shuffle is seeded from the list, the kind and the
   variant letter, so a worksheet and its answer key made at different moments agree, and
   Variant A of the same list always prints the same sheet.

     model(state, kind, variant)   -> { ok, kind, variant, title, ... } plain data, or { ok:false, reason }
     build(doc, model, withKey)    -> a DocumentFragment: the worksheet, or the answer key
     meaningOf(falseFriend)        the plain meaning out of 'Actually means "pregnant."'
     KINDS, VARIANTS

   kind 'match'  matching: numbered words down the left, lettered meanings (shuffled) down the right,
                 in groups of up to 10 so a letter is never past J
   kind 'blank'  fill in the blank: a word bank, then one sentence per word with a blank to fill
   kind 'trap'   trap or true cognate: each word beside its English look-alike, tick "true cognate"
                 or "false friend (trap)", and for a trap write what it really means

   A row with no target word or no meaning is left out (a blank starter row is not an item). */
(function (global) {
  'use strict';

  var KINDS = ['match', 'blank', 'trap'];
  var VARIANTS = ['A', 'B', 'C', 'D'];
  var GROUP = 10;
  var LETTERS = 'ABCDEFGHIJ';

  function str(v) { return v == null ? '' : String(v).trim(); }

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 'Actually means "to get/receive" (to become is "werden").' -> 'to get/receive'.
     A note that does not follow that shape is used whole, less a leading "Actually means". */
  function meaningOf(ff) {
    var t = str(ff && ff.actual);
    var m = /^(?:actually\s+means\s*)?["“]([^"”]+)["”]/i.exec(t);
    if (m) return str(m[1]).replace(/[.,;:]+$/, '');
    return t.replace(/^actually\s+means\s*:?\s*/i, '').replace(/\.$/, '');
  }

  /* One flat list of the usable entries, cognates first, in the order the teacher keeps them. */
  function items(state) {
    var out = [];
    ((state && state.cognates) || []).forEach(function (c) {
      var w = str(c && c.target), e = str(c && c.english);
      if (w && e) out.push({ word: w, meaning: e, lookalike: e, trap: false });
    });
    ((state && state.falseFriends) || []).forEach(function (f) {
      var w = str(f && f.target), mean = meaningOf(f);
      if (w && mean) out.push({ word: w, meaning: mean, lookalike: str(f.looksLike), trap: true, note: str(f.actual) });
    });
    return out;
  }

  function variantIndex(v) {
    var i = VARIANTS.indexOf(String(v || 'A').toUpperCase());
    return i < 0 ? 0 : i;
  }

  function model(state, kind, variant) {
    kind = KINDS.indexOf(kind) < 0 ? 'match' : kind;
    var vi = variantIndex(variant);
    var list = items(state);
    var lang = str(state && state.lang) || 'Target Language';
    var base = { kind: kind, variant: VARIANTS[vi], lang: lang };
    var need = kind === 'trap' ? 1 : 2;
    if (list.length < need) {
      return Object.assign(base, { ok: false, reason: 'too-few', have: list.length, minItems: need });
    }
    var seed = hashString(kind + '|' + vi + '|' + lang + '|' + list.map(function (x) { return x.word + '=' + x.meaning; }).join(';'));
    var rnd = mulberry32(seed);

    if (kind === 'match') {
      var order = shuffled(list, rnd), groups = [];
      for (var g = 0; g < order.length; g += GROUP) {
        var chunk = order.slice(g, g + GROUP);
        var right = shuffled(chunk.map(function (_, i) { return i; }), rnd);
        // right[k] is the chunk index whose meaning sits at letter k; make sure a word is never
        // opposite its own meaning for every row of a group of two or more by one more draw
        if (chunk.length > 1 && right.every(function (v, k) { return v === k; })) right.push(right.shift());
        groups.push({
          words: chunk.map(function (it, i) { return { n: g + i + 1, word: it.word }; }),
          meanings: right.map(function (ci, k) { return { letter: LETTERS[k], text: chunk[ci].meaning }; }),
          key: chunk.map(function (it, i) { return { n: g + i + 1, word: it.word, letter: LETTERS[right.indexOf(i)], meaning: it.meaning }; })
        });
      }
      return Object.assign(base, { ok: true, title: 'Match the ' + lang + ' words', groups: groups });
    }

    if (kind === 'blank') {
      var rows = shuffled(list, rnd).map(function (it, i) {
        var sentence = it.trap
          ? 'The word ______ looks like “' + (it.lookalike || 'an English word') + '” but really means “' + it.meaning + '”.'
          : 'The ' + lang + ' word ______ means “' + it.meaning + '” in English.';
        return { n: i + 1, sentence: sentence, answer: it.word };
      });
      return Object.assign(base, {
        ok: true, title: 'Fill in the blank', rows: rows,
        bank: shuffled(rows.map(function (r) { return r.answer; }), rnd)
      });
    }

    var traps = shuffled(list, rnd).map(function (it, i) {
      return { n: i + 1, word: it.word, lookalike: it.lookalike, answer: it.trap ? 'false' : 'true', meaning: it.trap ? it.meaning : '' };
    });
    return Object.assign(base, { ok: true, title: 'Trap or true cognate?', rows: traps });
  }

  /* ---------- nodes ---------- */

  function el(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function head(doc, frag, m, withKey) {
    frag.appendChild(el(doc, 'h1', 'print-title', m.title + (withKey ? ' — answer key' : '')));
    frag.appendChild(el(doc, 'p', 'print-lang', m.lang + ' · Variant ' + m.variant));
    if (!withKey) {
      var line = el(doc, 'p', 'ws-name', 'Name: ______________________   Date: ______________');
      frag.appendChild(line);
    }
  }

  function build(doc, m, withKey) {
    var frag = doc.createDocumentFragment();
    if (!m || !m.ok) return frag;
    head(doc, frag, m, withKey);

    if (m.kind === 'match') {
      if (!withKey) frag.appendChild(el(doc, 'p', 'ws-dir', 'Write the letter of the English meaning beside each word.'));
      m.groups.forEach(function (g) {
        var sec = el(doc, 'div', 'print-section ws-group');
        if (withKey) {
          var ol = el(doc, 'ol', 'ws-list ws-keylist');
          g.key.forEach(function (k) {
            var li = el(doc, 'li', null, k.word + ' → ' + k.letter + '. ' + k.meaning);
            li.value = k.n;
            ol.appendChild(li);
          });
          sec.appendChild(ol);
        } else {
          var cols = el(doc, 'div', 'ws-cols');
          var left = el(doc, 'ol', 'ws-list');
          g.words.forEach(function (w) {
            var li = el(doc, 'li', null, '_____  ' + w.word);
            li.value = w.n;
            left.appendChild(li);
          });
          var right = el(doc, 'ul', 'ws-list ws-lettered');
          g.meanings.forEach(function (x) { right.appendChild(el(doc, 'li', null, x.letter + '.  ' + x.text)); });
          cols.appendChild(left); cols.appendChild(right);
          sec.appendChild(cols);
        }
        frag.appendChild(sec);
      });
      return frag;
    }

    if (m.kind === 'blank') {
      if (!withKey) {
        frag.appendChild(el(doc, 'p', 'ws-dir', 'Use each word from the box once.'));
        var box = el(doc, 'p', 'ws-bank', m.bank.join('   ·   '));
        frag.appendChild(box);
      }
      var list = el(doc, 'ol', 'ws-list ws-sentences');
      m.rows.forEach(function (r) {
        list.appendChild(el(doc, 'li', null, withKey ? r.sentence.replace('______', r.answer) : r.sentence));
      });
      frag.appendChild(list);
      return frag;
    }

    if (!withKey) frag.appendChild(el(doc, 'p', 'ws-dir', 'Does each word mean what it looks like? Tick one box. If it is a trap, write what it really means.'));
    var tbl = el(doc, 'table', 'ref-table ws-trap');
    var thead = el(doc, 'thead'), hr = el(doc, 'tr');
    (withKey ? ['#', m.lang, 'Looks like', 'Answer'] : ['#', m.lang, 'Looks like', 'True cognate', 'False friend (trap)', 'What it really means']).forEach(function (h) { hr.appendChild(el(doc, 'th', null, h)); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el(doc, 'tbody');
    m.rows.forEach(function (r) {
      var tr = el(doc, 'tr');
      tr.appendChild(el(doc, 'td', null, String(r.n)));
      tr.appendChild(el(doc, 'td', null, r.word));
      tr.appendChild(el(doc, 'td', null, r.lookalike));
      if (withKey) {
        tr.appendChild(el(doc, 'td', null, r.answer === 'true' ? 'True cognate' : 'False friend — really means “' + r.meaning + '”'));
      } else {
        tr.appendChild(el(doc, 'td', 'ws-tick', '☐'));
        tr.appendChild(el(doc, 'td', 'ws-tick', '☐'));
        tr.appendChild(el(doc, 'td', 'ws-write', ''));
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    frag.appendChild(tbl);
    return frag;
  }

  global.CffbWorksheets = {
    model: model, build: build, meaningOf: meaningOf, items: items,
    KINDS: KINDS.slice(), VARIANTS: VARIANTS.slice(), GROUP: GROUP
  };
})(typeof window !== 'undefined' ? window : globalThis);
