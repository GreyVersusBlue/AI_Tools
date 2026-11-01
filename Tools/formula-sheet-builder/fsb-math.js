/* Formula Reference Sheet Builder — local math notation (Path rank 78).
   A formula is typed as text. If it holds none of the marks below it comes out
   exactly as before (escaped, nothing else), so every sheet saved earlier prints
   the same. The marks are a small LaTeX-like subset, no library, no network:

     \frac{a}{b}      a stacked fraction
     \sqrt{x}         a square root;  \sqrt[3]{x}  a cube root
     x^2  x^{n+1}     a superscript (one character or a {group})
     x_1  x_{ab}      a subscript
     \pi \alpha ...   Greek letters (see GREEK)
     \\ \{ \} \^ \_   a literal backslash, brace, caret or underscore

   The styles for the .fm- classes live in 041's own <style>. A formula that does not parse (a missing brace, \frac with one part, nesting
   deeper than MAX_DEPTH) is shown as the text typed, never half-drawn.
   toHtml() returns markup built only from escaped text and the fixed tags below. */
(function (global) {
  'use strict';

  var MAX_DEPTH = 6;
  var MAX_LEN = 600;

  var GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ',
    mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω',
    Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Theta: 'Θ', Phi: 'Φ', Pi: 'Π'
  };

  var ESC = { '\\': '\\', '{': '{', '}': '}', '^': '^', '_': '_' };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hasMarkup(src) {
    return /[\\^_]/.test(String(src == null ? '' : src));
  }

  function Fail() {}

  /* Parses src into a tree: arrays of nodes. Throws Fail on anything it cannot read. */
  function parse(src) {
    var i = 0;

    function readGroup(depth) {
      // at '{'
      if (src.charAt(i) !== '{') throw new Fail();
      i++;
      var nodes = seq(depth + 1, true);
      if (src.charAt(i) !== '}') throw new Fail();
      i++;
      return nodes;
    }

    function readArg(depth) {
      var c = src.charAt(i);
      if (c === '{') return readGroup(depth);
      if (c === '') throw new Fail();
      if (c === '\\') {
        var one = atom(depth + 1);
        return one ? [one] : [];
      }
      if (c === '}' || c === '^' || c === '_') throw new Fail();
      i++;
      return [{ t: 'text', s: c }];
    }

    function command(depth) {
      // at '\' ; returns a node
      i++;
      var c = src.charAt(i);
      if (ESC[c] !== undefined && c !== '') { i++; return { t: 'text', s: ESC[c] }; }
      var m = /^[A-Za-z]+/.exec(src.slice(i));
      if (!m) throw new Fail();
      var name = m[0];
      i += name.length;
      if (name === 'frac') {
        var num = readGroup(depth);
        var den = readGroup(depth);
        return { t: 'frac', n: num, d: den };
      }
      if (name === 'sqrt') {
        var idx = null;
        if (src.charAt(i) === '[') {
          var close = src.indexOf(']', i);
          if (close < 0) throw new Fail();
          idx = src.slice(i + 1, close);
          if (!/^[0-9a-z]{1,3}$/i.test(idx)) throw new Fail();
          i = close + 1;
        }
        return { t: 'sqrt', i: idx, b: readGroup(depth) };
      }
      if (Object.prototype.hasOwnProperty.call(GREEK, name)) return { t: 'text', s: GREEK[name] };
      throw new Fail();
    }

    function atom(depth) {
      if (depth > MAX_DEPTH) throw new Fail();
      var c = src.charAt(i);
      if (c === '\\') return command(depth);
      if (c === '{') return { t: 'group', c: readGroup(depth) };
      i++;
      return { t: 'text', s: c };
    }

    function seq(depth, inGroup) {
      if (depth > MAX_DEPTH) throw new Fail();
      var out = [];
      while (i < src.length) {
        var c = src.charAt(i);
        if (c === '}') {
          if (inGroup) return out;
          throw new Fail();
        }
        if (c === '^' || c === '_') {
          i++;
          out.push({ t: c === '^' ? 'sup' : 'sub', c: readArg(depth) });
          continue;
        }
        out.push(atom(depth));
      }
      if (inGroup) throw new Fail();
      return out;
    }

    return seq(0, false);
  }

  function html(nodes) {
    return nodes.map(function (n) {
      switch (n.t) {
        case 'text': return escapeHtml(n.s);
        case 'group': return html(n.c);
        case 'sup': return '<sup class="fm-sup">' + html(n.c) + '</sup>';
        case 'sub': return '<sub class="fm-sub">' + html(n.c) + '</sub>';
        case 'frac':
          return '<span class="fm-frac"><span class="fm-num">' + html(n.n) +
                 '</span><span class="fm-den">' + html(n.d) + '</span></span>';
        case 'sqrt':
          return '<span class="fm-root">' +
                 (n.i ? '<sup class="fm-rootidx">' + escapeHtml(n.i) + '</sup>' : '') +
                 '<span class="fm-rad">√</span><span class="fm-rb">' + html(n.b) + '</span></span>';
      }
      return '';
    }).join('');
  }

  function text(nodes) {
    return nodes.map(function (n) {
      switch (n.t) {
        case 'text': return n.s;
        case 'group': return '(' + text(n.c) + ')';
        case 'sup': return '^(' + text(n.c) + ')';
        case 'sub': return '_(' + text(n.c) + ')';
        case 'frac': return '(' + text(n.n) + ')/(' + text(n.d) + ')';
        case 'sqrt': return (n.i ? n.i + '-th root of ' : 'square root of ') + '(' + text(n.b) + ')';
      }
      return '';
    }).join('');
  }

  function tree(src) {
    src = String(src == null ? '' : src);
    if (!hasMarkup(src) || src.length > MAX_LEN) return null;
    try { return parse(src); } catch (e) { if (e instanceof Fail) return null; throw e; }
  }

  /* toHtml(src) -> markup. Plain text and unreadable notation come back as escaped text. */
  function toHtml(src) {
    var t = tree(src);
    if (!t) return escapeHtml(src);
    return '<span class="fm" role="math" aria-label="' + escapeHtml(text(t)) + '"><span aria-hidden="true">' +
           html(t) + '</span></span>';
  }

  /* toText(src) -> the formula as plain words and symbols (for labels and copies). */
  function toText(src) {
    var t = tree(src);
    return t ? text(t) : String(src == null ? '' : src);
  }

  global.FsbMath = { toHtml: toHtml, toText: toText, hasMarkup: hasMarkup, parse: tree, GREEK: GREEK };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FsbMath;
})(typeof globalThis !== 'undefined' ? globalThis : this);
