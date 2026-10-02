/* bt-core.js — the pure logic behind 088 Braille Reading Trainer. No DOM, no
   storage: the page owns both, and this file only answers questions about data.

     BrailleCore.UNITS / STAGES / ITEMS   the curriculum (Unified English Braille)
     BrailleCore.cells(ascii)             → [mask, …]  (bit 0 = dot 1 … bit 5 = dot 6)
     BrailleCore.dotsOf(mask)             → "1-2-5"
     BrailleCore.unicode(ascii)           → "⠓⠑⠇⠇⠕"
     BrailleCore.translate(text, known)   → { ascii, used: Set<itemId> }
     BrailleCore.lessonsFor(unit)         → [{ id, unit, n, kind, items }]
     BrailleCore.knownBefore(lessonId)    → Set of item ids learned before it
     BrailleCore.buildLesson(lessonId, ctx) → [exercise, …]
     BrailleCore.buildPractice(ctx)       → [exercise, …]
     BrailleCore.grade(state, id, ok, ms, today) → the item's new SRS record
     BrailleCore.normalizeState(raw)      → a state the page can trust

   Cells are written in North American Braille ASCII (one printable character
   per cell: "A" is dot 1, "," is dot 6, "#" is dots 3-4-5-6) because it is the
   compact, standard way to write braille down in a text file. Nothing on screen
   ever shows that ASCII; the page draws dots.

   The translator contracts only with signs the reader has already learned, so
   the same passage gets more contracted as they progress. Where a rule is
   subtle (be-/con-/dis- must be a first syllable; initial-letter contractions
   inside longer words), it errs toward spelling the letters out: text that is
   less contracted than a transcriber would make it is still correct braille to
   read, and text that is wrongly contracted would teach a wrong sign. */
(function (global) {
  'use strict';

  // Index = dot mask, value = the braille-ASCII character for that cell.
  const ASCII = ' A1B\'K2L@CIF/MSP"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=';
  const MASK = {};
  for (let m = 0; m < 64; m++) MASK[ASCII[m]] = m;

  function cells(ascii) {
    const out = [];
    for (const ch of String(ascii).toUpperCase()) {
      if (ch === '\n') out.push(-1);
      else if (ch in MASK) out.push(MASK[ch]);
    }
    return out;
  }
  function dotsOf(mask) {
    const d = [];
    for (let i = 0; i < 6; i++) if (mask & (1 << i)) d.push(i + 1);
    return d.join('-');
  }
  function maskOfDots(list) {
    let m = 0;
    for (const n of list) if (n >= 1 && n <= 6) m |= 1 << (n - 1);
    return m;
  }
  function unicode(ascii) {
    return cells(ascii).map((m) => (m < 0 ? '\n' : String.fromCharCode(0x2800 + m))).join('');
  }
  // The cell seen in a mirror: dots 1-2-3 swap with 4-5-6. Sighted learners
  // confuse these more than any other pair (d/f, e/i, h/j), so they are the
  // first distractors a question reaches for.
  function mirror(mask) { return ((mask & 7) << 3) | ((mask >> 3) & 7); }
  function hamming(a, b) { let x = a ^ b, n = 0; while (x) { n += x & 1; x >>= 1; } return n; }

  // ── the curriculum ─────────────────────────────────────────────────────
  // Every sign is an item: { id, cells, label, kind, unit, note? }.
  const ITEMS = {};
  const UNITS = [];
  function unit(def, list) {
    const u = Object.assign({ batch: 3 }, def, { items: [] });
    for (const it of list) {
      const item = Object.assign({}, it, { unit: u.id });
      ITEMS[item.id] = item;
      u.items.push(item.id);
    }
    UNITS.push(u);
  }
  const L = (ch) => ({ id: 'l-' + ch, cells: ch.toUpperCase(), label: ch, kind: 'letter' });
  const PREFIX = { wordsign: 'ws', strong: 'sc', groupsign: 'gs', swordsign: 'sw', lower: 'lg', lowerword: 'lw', initial: 'il', final: 'fl', shortform: 'sf' };
  const W = (word, c, kind, note) => ({ id: PREFIX[kind] + '-' + word, cells: c.toUpperCase(), label: word, kind: kind, note: note });

  const STAGES = [
    { id: 'alphabet', title: 'The alphabet', blurb: 'Every letter, built decade by decade, and capitals.' },
    { id: 'numpunct', title: 'Numbers and punctuation', blurb: 'Enough to read any uncontracted sentence. The reading room opens after this.' },
    { id: 'contractions', title: 'Contractions', blurb: 'Grade 2 braille: single cells that stand for whole words and common letter groups.' },
    { id: 'advanced', title: 'Two-cell contractions', blurb: 'A dot-5, dots-4-5 or dots-4-5-6 prefix, and word endings.' },
    { id: 'shortforms', title: 'Shortforms', blurb: 'Abbreviated spellings of common words. After these you are reading full contracted braille.' }
  ];

  unit({ id: 'u1', stage: 'alphabet', title: 'Letters a–e',
    intro: 'The first ten letters use only the top four dots (1, 2, 4, 5). Dots 1-2-3 run down the left column, 4-5-6 down the right. Learn a–j cold: the rest of the alphabet is built from them.' },
    'abcde'.split('').map(L));
  unit({ id: 'u2', stage: 'alphabet', title: 'Letters f–j',
    intro: 'Still only the top four dots. Watch the mirror pairs: d and f, e and i, h and j are each other flipped left to right.' },
    'fghij'.split('').map(L));
  unit({ id: 'u3', stage: 'alphabet', title: 'Letters k–o',
    intro: 'The second decade: k–t are a–j with dot 3 added. k is a plus dot 3, l is b plus dot 3, and so on.' },
    'klmno'.split('').map(L));
  unit({ id: 'u4', stage: 'alphabet', title: 'Letters p–t',
    intro: 'Finishing the second decade: p–t are f–j with dot 3 added.' },
    'pqrst'.split('').map(L));
  unit({ id: 'u5', stage: 'alphabet', title: 'Letters u v x y z',
    intro: 'The third decade adds dots 3 and 6 to a–e: u is a + 3-6, v is b + 3-6, x is c, y is d, z is e. w is missing because French braille had no w.' },
    'uvxyz'.split('').map(L));
  unit({ id: 'u6', stage: 'alphabet', title: 'w and capitals',
    intro: 'w is the odd one out (dots 2-4-5-6). Braille has no upper case: a dot 6 before a letter capitalises it, and two dot 6s capitalise the whole word.' },
    [L('w'),
     { id: 'cap', cells: ',', label: 'capital letter', kind: 'indicator', note: 'Dot 6 before a letter: the next letter is a capital.' },
     { id: 'capw', cells: ',,', label: 'capital word', kind: 'indicator', note: 'Two dot 6s: the whole word is in capitals.' }]);
  unit({ id: 'u7', stage: 'numpunct', title: 'Numbers', batch: 4,
    intro: 'The number sign (dots 3-4-5-6) turns the letters a–j into the digits 1–0 until the next space. a is 1, b is 2 … j is 0.' },
    [{ id: 'num', cells: '#', label: 'number sign', kind: 'indicator', note: 'Dots 3-4-5-6: the letters a–j that follow are digits.' }]
      .concat('1234567890'.split('').map((d) => ({ id: 'd-' + d, cells: '#' + 'JABCDEFGHI'[+d], label: d, kind: 'digit' }))));
  unit({ id: 'u8', stage: 'numpunct', title: 'Punctuation', batch: 4,
    intro: 'Punctuation sits low in the cell (no dot 1 or 4). The question mark and the opening quotation mark are the same cell; where it falls tells you which.' },
    [{ id: 'p-period', cells: '4', label: '. period', kind: 'punct' },
     { id: 'p-comma', cells: '1', label: ', comma', kind: 'punct' },
     { id: 'p-q', cells: '8', label: '? question mark', kind: 'punct', note: 'Same cell as an opening quotation mark.' },
     { id: 'p-excl', cells: '6', label: '! exclamation mark', kind: 'punct' },
     { id: 'p-apos', cells: "'", label: '’ apostrophe', kind: 'punct' },
     { id: 'p-hyph', cells: '-', label: '- hyphen', kind: 'punct' },
     { id: 'p-oq', cells: '8', label: '“ opening quote', kind: 'punct', note: 'Same cell as the question mark; it comes before a word, not after.' },
     { id: 'p-cq', cells: '0', label: '” closing quote', kind: 'punct' },
     { id: 'p-semi', cells: '2', label: '; semicolon', kind: 'punct' },
     { id: 'p-colon', cells: '3', label: ': colon', kind: 'punct' }]);

  const AWS = [['but', 'b'], ['can', 'c'], ['do', 'd'], ['every', 'e'], ['from', 'f'], ['go', 'g'], ['have', 'h'], ['just', 'j'], ['knowledge', 'k'], ['like', 'l'],
    ['more', 'm'], ['not', 'n'], ['people', 'p'], ['quite', 'q'], ['rather', 'r'], ['so', 's'], ['that', 't'], ['us', 'u'], ['very', 'v'], ['will', 'w'], ['it', 'x'], ['you', 'y'], ['as', 'z']];
  const wsNote = 'Standing alone as a word. Inside a word it is still just the letter.';
  unit({ id: 'u9', stage: 'contractions', title: 'Letter words: but to like',
    intro: 'Grade 2 begins. A letter standing alone as a word means a whole word: b alone is "but", c alone is "can".' },
    AWS.slice(0, 10).map(([w, c]) => W(w, c, 'wordsign', wsNote)));
  unit({ id: 'u10', stage: 'contractions', title: 'Letter words: more to as', batch: 4,
    intro: 'The rest of the letter words. Two to watch: x alone is "it", z alone is "as".' },
    AWS.slice(10).map(([w, c]) => W(w, c, 'wordsign', wsNote)));
  unit({ id: 'u11', stage: 'contractions', title: 'and, for, of, the, with',
    intro: 'Five full cells for the five most common words. Unlike the letter words, these are used inside words too: "stand", "form", "soft", "them", "without".' },
    [['and', '&'], ['for', '='], ['of', '('], ['the', '!'], ['with', ')']].map(([w, c]) => W(w, c, 'strong', 'As a word or as part of one.')));
  unit({ id: 'u12', stage: 'contractions', title: 'ch, gh, sh, th, wh', batch: 3,
    intro: 'Letter pairs with their own cells, used anywhere in a word. Four of them also stand alone for a word: child, shall, this, which.' },
    [['ch', '*'], ['gh', '<'], ['sh', '%'], ['th', '?'], ['wh', ':']].map(([g, c]) => W(g, c, 'groupsign', 'Anywhere in a word.'))
      .concat([['child', '*'], ['shall', '%'], ['this', '?'], ['which', ':']].map(([w, c]) => W(w, c, 'swordsign', 'Standing alone as a word.'))));
  unit({ id: 'u13', stage: 'contractions', title: 'ed, er, ou, ow, st, ar, ing', batch: 3,
    intro: 'More letter groups for anywhere in a word (ing never starts one). ou alone means "out"; st alone means "still".' },
    [['ed', '$'], ['er', ']'], ['ou', '\\'], ['ow', '['], ['st', '/'], ['ar', '>'], ['ing', '+']].map(([g, c]) => W(g, c, 'groupsign', g === 'ing' ? 'Anywhere but the start of a word.' : 'Anywhere in a word.'))
      .concat([['out', '\\'], ['still', '/']].map(([w, c]) => W(w, c, 'swordsign', 'Standing alone as a word.'))));
  unit({ id: 'u14', stage: 'contractions', title: 'Lower signs: ea, bb, cc, ff, gg, en, in', batch: 4,
    intro: 'Lower signs drop into the bottom of the cell (no dots 1 or 4). ea, bb, cc, ff and gg are only used in the middle of a word; en and in go anywhere, and in alone is the word "in".' },
    [['ea', '1'], ['bb', '2'], ['cc', '3'], ['ff', '6'], ['gg', '7']].map(([g, c]) => W(g, c, 'lower', 'Middle of a word only.'))
      .concat([W('en', '5', 'lower', 'Anywhere in a word.'), W('in', '9', 'lower', 'Anywhere in a word, and alone it is the word "in".')]));
  unit({ id: 'u15', stage: 'contractions', title: 'Lower words: be, were, his, was', batch: 4,
    intro: 'Lower cells that stand for whole words when they stand alone with nothing touching them. be, con and dis also start words: "become", "consider", "discover".' },
    [W('be', '2', 'lowerword', 'Alone, or as the first syllable of a word.'), W('were', '7', 'lowerword', 'Alone, with no punctuation touching it.'),
     W('his', '8', 'lowerword', 'Alone, with no punctuation touching it.'), W('was', '0', 'lowerword', 'Alone, with no punctuation touching it.'),
     W('enough', '5', 'lowerword', 'Alone, with no punctuation touching it.'),
     W('con', '3', 'lowerword', 'First syllable of a word only.'), W('dis', '4', 'lowerword', 'First syllable of a word only.')]);

  const D5 = [['day', 'D'], ['ever', 'E'], ['father', 'F'], ['here', 'H'], ['know', 'K'], ['lord', 'L'], ['mother', 'M'], ['name', 'N'], ['one', 'O'], ['part', 'P'], ['question', 'Q'],
    ['right', 'R'], ['some', 'S'], ['time', 'T'], ['under', 'U'], ['work', 'W'], ['young', 'Y'], ['there', '!'], ['character', '*'], ['through', '?'], ['where', ':'], ['ought', '\\']];
  const ilNote = 'Dot 5, then the first letter.';
  unit({ id: 'u16', stage: 'advanced', title: 'Dot 5 words: day to question', batch: 4,
    intro: 'A dot 5 in front of a letter makes a common word starting with that letter: dot 5 + d is "day", dot 5 + m is "mother".' },
    D5.slice(0, 11).map(([w, c]) => W(w, '"' + c, 'initial', ilNote)));
  unit({ id: 'u17', stage: 'advanced', title: 'Dot 5 words: right to ought', batch: 4,
    intro: 'The rest of the dot 5 words, including some built on a contraction: dot 5 + "the" is "there", dot 5 + "ou" is "ought".' },
    D5.slice(11).map(([w, c]) => W(w, '"' + c, 'initial', ilNote)));
  unit({ id: 'u18', stage: 'advanced', title: 'Dots 4-5 and 4-5-6 words', batch: 4,
    intro: 'Two more prefixes. Dots 4-5: upon, these, those, whose, word. Dots 4-5-6: cannot, had, many, spirit, world, their.' },
    [['upon', '^U'], ['these', '^!'], ['those', '^?'], ['whose', '^:'], ['word', '^W'], ['cannot', '_C'], ['had', '_H'], ['many', '_M'], ['spirit', '_S'], ['world', '_W'], ['their', '_!']]
      .map(([w, c]) => W(w, c, 'initial', c[0] === '^' ? 'Dots 4-5, then the first letter.' : 'Dots 4-5-6, then the first letter.')));
  unit({ id: 'u19', stage: 'advanced', title: 'Word endings', batch: 4,
    intro: 'Final-letter groups: a prefix (dots 4-6 or 5-6) and the group’s last letter. Never at the start of a word: "nation", "kindness", "moment", "city".' },
    [['ound', '.D'], ['ance', '.E'], ['sion', '.N'], ['less', '.S'], ['ount', '.T'], ['ence', ';E'], ['ong', ';G'], ['ful', ';L'], ['tion', ';N'], ['ness', ';S'], ['ment', ';T'], ['ity', ';Y']]
      .map(([g, c]) => W(g, c, 'final', 'Inside or at the end of a word.')));

  const sfNote = 'A shortform, used when the word stands alone.';
  const SF = (list) => list.map(([w, c]) => W(w, c, 'shortform', sfNote));
  unit({ id: 'u20', stage: 'shortforms', title: 'Shortforms 1', batch: 4,
    intro: 'Shortforms are abbreviated spellings: "ab" is about, "gd" is good. Read the letters and think of the word they skeleton.' },
    SF([['about', 'AB'], ['after', 'AF'], ['again', 'AG'], ['also', 'AL'], ['always', 'ALW'], ['because', '2C'], ['before', '2F'], ['could', 'CD'],
      ['first', 'F/'], ['friend', 'FR'], ['good', 'GD'], ['great', 'GRT']]));
  unit({ id: 'u21', stage: 'shortforms', title: 'Shortforms 2', batch: 4,
    intro: 'More shortforms. Several use a contraction inside: "much" is m + ch, "must" is m + st, "should" is sh + d.' },
    SF([['him', 'HM'], ['its', 'XS'], ['letter', 'LR'], ['little', 'LL'], ['much', 'M*'], ['must', 'M/'], ['said', 'SD'], ['should', '%D'], ['such', 'S*'],
      ['today', 'TD'], ['together', 'TGR'], ['tomorrow', 'TM'], ['tonight', 'TN'], ['would', 'WD'], ['your', 'YR']]));
  unit({ id: 'u22', stage: 'shortforms', title: 'Shortforms 3', batch: 4,
    intro: 'The less common shortforms. The be- words (because, before, behind …) start with the lower "be" cell.' },
    SF([['above', 'ABV'], ['according', 'AC'], ['across', 'ACR'], ['afternoon', 'AFN'], ['against', 'AG/'], ['almost', 'ALM'], ['already', 'ALR'], ['although', 'AL?'],
      ['altogether', 'ALT'], ['behind', '2H'], ['below', '2L'], ['beneath', '2N'], ['beside', '2S'], ['between', '2T'], ['beyond', '2Y'], ['blind', 'BL'],
      ['braille', 'BRL'], ['children', '*N'], ['either', 'EI'], ['herself', 'H]F'], ['himself', 'HMF'], ['immediate', 'IMM'], ['itself', 'XF'], ['myself', 'MYF'],
      ['necessary', 'NEC'], ['neither', 'NEI'], ['paid', 'PD'], ['perhaps', 'P]H'], ['quick', 'QK'], ['receive', 'RCV'], ['yourself', 'YRF']]));

  const UNIT_INDEX = {};
  UNITS.forEach((u, i) => { u.index = i; UNIT_INDEX[u.id] = u; });
  const READING_UNLOCK = 'u8';

  // ── the translator ─────────────────────────────────────────────────────
  // Whole-word signs, by print word.
  const WHOLE = {};
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (['wordsign', 'strong', 'swordsign', 'initial', 'shortform'].includes(it.kind)) WHOLE[it.label] = { id, cells: it.cells };
    if (it.kind === 'lowerword' && it.label !== 'con' && it.label !== 'dis') WHOLE[it.label] = { id, cells: it.cells, lower: true };
  }
  WHOLE['in'] = { id: 'lg-in', cells: '9', lower: true };
  // Letter groups inside words, with where in the word they may sit.
  const GROUPS = [];
  for (const id in ITEMS) {
    const it = ITEMS[id];
    let pos = null;
    if (it.kind === 'strong' || it.kind === 'groupsign') pos = it.label === 'ing' ? 'notFirst' : 'any';
    else if (it.kind === 'lower') pos = (it.label === 'en' || it.label === 'in') ? 'any' : 'middle';
    else if (it.kind === 'final') pos = 'notFirst';
    else if (it.kind === 'lowerword' && ['be', 'con', 'dis'].includes(it.label)) pos = 'first';
    if (pos) GROUPS.push({ id, p: it.label, cells: it.cells, pos });
  }
  GROUPS.sort((a, b) => b.p.length - a.p.length);
  // be-, con- and dis- contract only when they are the word's first syllable,
  // which no spelling rule can tell; these are the stems known to qualify.
  const FIRST_SYLLABLE = {
    be: ['become', 'became', 'begin', 'began', 'begun', 'believe', 'belong', 'behave', 'being', 'beware', 'betray', 'betwe', 'bewild', 'befor', 'behold', 'bestow', 'betide'],
    con: ['concern', 'condition', 'consider', 'continu', 'contain', 'control', 'contest', 'conduct', 'confus', 'connect', 'contact', 'content', 'convers', 'confid', 'conclu', 'construct', 'contrib', 'convinc', 'conserv', 'constant'],
    dis: ['discover', 'distanc', 'distant', 'disappear', 'discuss', 'disease', 'display', 'dislike', 'disturb', 'distrust', 'disagree', 'disgust', 'dismiss', 'distribut', 'distinct']
  };

  function groupAllowed(g, w, i) {
    const end = i + g.p.length;
    if (g.pos === 'notFirst') return i > 0;
    if (g.pos === 'middle') return i > 0 && end < w.length;
    if (g.pos === 'first') return i === 0 && end < w.length && FIRST_SYLLABLE[g.p].some((s) => w.startsWith(s));
    return true;
  }

  // Fewest cells wins, which is UEB's own tiebreak; equal counts prefer the
  // longer sign at the earlier position ("near" is n-ea-r, not n-e-ar).
  function contractLetters(w, has, used) {
    const n = w.length;
    const best = new Array(n + 1).fill(0);
    const pick = new Array(n).fill(null);
    for (let i = n - 1; i >= 0; i--) {
      best[i] = Infinity;
      for (const g of GROUPS) {
        if (!w.startsWith(g.p, i) || !has(g.id) || !groupAllowed(g, w, i)) continue;
        const c = 1 + best[i + g.p.length];
        if (c < best[i]) { best[i] = c; pick[i] = g; }
      }
      if (1 + best[i + 1] < best[i]) { best[i] = 1 + best[i + 1]; pick[i] = null; }
    }
    let out = '';
    for (let i = 0; i < n;) {
      const g = pick[i];
      if (g) { out += g.cells; used.add(g.id); i += g.p.length; }
      else { out += w[i].toUpperCase(); used.add('l-' + w[i]); i++; }
    }
    return out;
  }

  const DIGIT = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 0: 'J' };
  const PUNCT = { '.': ['4', 'p-period'], ',': ['1', 'p-comma'], '?': ['8', 'p-q'], '!': ['6', 'p-excl'], ';': ['2', 'p-semi'], ':': ['3', 'p-colon'],
    '\'': ['\'', 'p-apos'], '’': ['\'', 'p-apos'], '-': ['-', 'p-hyph'], '”': ['0', 'p-cq'], '“': ['8', 'p-oq'], '(': ['"<', null], ')': ['">', null] };

  // One word's letters (lower case, no punctuation) → cells.
  function wordCells(w, has, used, alone, grade2) {
    if (alone) {
      const whole = WHOLE[w];
      if (whole && has(whole.id) && !(whole.lower && alone === 'touching')) { used.add(whole.id); return whole.cells; }
      // An initial-letter word takes a plural s: "days", "names", "words".
      if (w.endsWith('s') && WHOLE[w.slice(0, -1)] && ITEMS[WHOLE[w.slice(0, -1)].id].kind === 'initial' && has(WHOLE[w.slice(0, -1)].id)) {
        used.add(WHOLE[w.slice(0, -1)].id); used.add('l-s'); return WHOLE[w.slice(0, -1)].cells + 'S';
      }
      // A lone letter that is also a letter word needs the grade 1 indicator.
      if (grade2 && w.length === 1 && WHOLE[AWS_BY_LETTER[w]] && has(WHOLE[AWS_BY_LETTER[w]].id)) { used.add('l-' + w); return ';' + w.toUpperCase(); }
      // "in" touching punctuation is spelled: two lower cells in a row are ambiguous.
      if (w === 'in' && alone === 'touching') { used.add('l-i'); used.add('l-n'); return 'IN'; }
    }
    return contractLetters(w, has, used);
  }
  const AWS_BY_LETTER = {};
  AWS.forEach(([word, letter]) => { AWS_BY_LETTER[letter] = word; });

  function capPrefix(core) {
    const letters = core.replace(/[^A-Za-z]/g, '');
    if (!letters || letters === letters.toLowerCase()) return '';
    if (letters.length > 1 && letters === letters.toUpperCase()) return ',,';
    if (core[0] === core[0].toUpperCase() && core.slice(1) === core.slice(1).toLowerCase()) return ',';
    return null; // mixed case: mark letter by letter
  }

  function translateToken(tok, has, used, grade2) {
    const m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(tok);
    let [, lead, core, trail] = m;
    let out = '';
    const punct = (s, opening) => {
      let r = '';
      for (const ch of s) {
        let p = PUNCT[ch];
        if (ch === '"') p = PUNCT[opening ? '“' : '”'];
        if (!p) continue;
        r += p[0];
        if (p[1]) used.add(p[1]);
      }
      return r;
    };
    out += punct(lead, true);
    if (/^[0-9][0-9,.]*[0-9]$|^[0-9]$/.test(core)) {
      used.add('num');
      out += '#' + core.replace(/[0-9]/g, (d) => { used.add('d-' + d); return DIGIT[d]; }).replace(/,/g, '1').replace(/\./g, '4');
    } else if (core) {
      const touching = lead || trail ? 'touching' : 'free';
      const parts = core.split(/(-)/);
      const caps = capPrefix(core.replace(/-/g, ''));
      if (caps === ',') used.add('cap');
      if (caps === ',,') used.add('capw');
      out += caps || '';
      for (const part of parts) {
        if (part === '-') { out += '-'; used.add('p-hyph'); continue; }
        if (!part) continue;
        const pieces = part.split(/['’]/);
        const lower = pieces[0].toLowerCase();
        let body;
        if (/^[a-z]+$/.test(lower)) {
          const alone = pieces.length === 1 ? (parts.length > 1 ? 'touching' : touching) : false;
          if (caps === null) body = pieces[0].split('').map((c) => (c === c.toUpperCase() ? ',' : '') + c.toUpperCase()).join('');
          else body = wordCells(lower, has, used, alone, grade2);
        } else {
          body = lower.replace(/[0-9]/g, (d) => '#' + DIGIT[d]).toUpperCase();
        }
        for (let k = 1; k < pieces.length; k++) {
          body += '\'' + pieces[k].toUpperCase();
          used.add('p-apos');
          for (const c of pieces[k].toLowerCase()) used.add('l-' + c);
        }
        out += body;
      }
    }
    out += punct(trail, false);
    return out;
  }

  // known: a Set of item ids the reader has learned, or null for everything.
  function translate(text, known) {
    const has = known ? (id) => known.has(id) : () => true;
    const grade2 = has('ws-but') || has('ws-it');
    const used = new Set();
    const paras = String(text).replace(/\r/g, '').split(/\n\s*\n|\n/);
    const ascii = paras.map((p) => p.trim().split(/\s+/).filter(Boolean).map((t) => translateToken(t, has, used, grade2)).join(' ')).join('\n');
    return { ascii, used };
  }

  // ── lessons ────────────────────────────────────────────────────────────
  function lessonsFor(u) {
    if (typeof u === 'string') u = UNIT_INDEX[u];
    const out = [];
    for (let i = 0, n = 1; i < u.items.length; i += u.batch, n++) {
      out.push({ id: u.id + '-' + n, unit: u.id, n, kind: 'learn', items: u.items.slice(i, i + u.batch) });
    }
    out.push({ id: u.id + '-r', unit: u.id, n: out.length + 1, kind: 'review', items: u.items.slice() });
    return out;
  }
  const LESSONS = [];
  UNITS.forEach((u) => { u.lessons = lessonsFor(u); LESSONS.push(...u.lessons); });
  const LESSON_INDEX = {};
  LESSONS.forEach((l, i) => { l.index = i; LESSON_INDEX[l.id] = l; });

  function knownBefore(lessonId) {
    const l = LESSON_INDEX[lessonId];
    const s = new Set();
    if (!l) return s;
    for (let i = 0; i < l.index; i++) if (LESSONS[i].kind === 'learn') LESSONS[i].items.forEach((id) => s.add(id));
    return s;
  }
  function knownThrough(lessonId) {
    const s = knownBefore(lessonId);
    const l = LESSON_INDEX[lessonId];
    if (l) l.items.forEach((id) => s.add(id));
    return s;
  }
  // Everything learned so far, from the set of finished lessons.
  function knownFrom(done) {
    const s = new Set();
    for (const l of LESSONS) if (done[l.id] && l.kind === 'learn') l.items.forEach((id) => s.add(id));
    return s;
  }
  function nextLesson(done) {
    return LESSONS.find((l) => !done[l.id]) || null;
  }
  function unlocked(done, lessonId) {
    const l = LESSON_INDEX[lessonId];
    if (!l) return false;
    return l.index === 0 || !!done[LESSONS[l.index - 1].id] || !!done[lessonId];
  }
  function readingOpen(done) {
    return UNIT_INDEX[READING_UNLOCK].lessons.every((l) => done[l.id]);
  }

  // ── words and sentences ────────────────────────────────────────────────
  const WORDS = ('a i ad be bed bee cab dab dad add ace bead deed dead bade cede face fade fed feed beef big bag bid dig fig hid had head hide ice' +
    ' age cage chef jab jade jig beige high each idea bike lake like milk kind look moon noon book cook mind make name come home lime mole lemon' +
    ' melon camel kick lock nice once one dog log job joke kid king fold gold hold old pond poem park rope ship shop stop step test rest' +
    ' road post spot sport trip tree toss queen quiet quick quilt front frost first start story strong train paint print point rain' +
    ' run sun fun bus cup up us use music under unit until value very move vote voice six fix box exit next text extra yes yet you your' +
    ' year yard lazy zero zone size quiz prize puzzle jazz wax way we web was with win wind window water word work world wave week' +
    ' the and for of with but can do every from go have just knowledge like more not people quite rather so that us very will it you as' +
    ' child shall this which out still chair cheese church much such each lunch light night right might bright laugh rough tough' +
    ' she shell fish wash wish think thin both bath math with when what where while white whale wheel red bed played jumped needed' +
    ' her term letter butter river over under ever never other mother father brother sister our out house mouse found round sound' +
    ' cloud loud how now down town brown own snow show slow grow stop star store last most must fast far car card hard art party' +
    ' sing ring thing bring king song long going doing seeing reading eat sea read bread great near year clear early heard learn' +
    ' rabbit ribbon accept account soccer egg bigger trigger dagger enter end open seven given then them' +
    ' into inside window begin being believe become belong concern consider continue control discover distance disease discuss' +
    ' be were his was enough in day ever father here know lord mother name one part question right some time under work young' +
    ' there character through where ought upon these those whose word cannot had many spirit world their days names words times' +
    ' found ground count mountain chance dance distance balance mission vision less unless useless amount fence sentence silence' +
    ' long strong among careful helpful useful nation station action kindness darkness happiness moment movement city activity' +
    ' about after again also always because before could first friend good great him its letter little much must said should such' +
    ' today together tomorrow tonight would your above across afternoon against almost already although behind below beneath beside' +
    ' between beyond blind braille children either herself himself itself myself necessary neither paid perhaps quick receive yourself' +
    ' family garden window kitchen picture people animal teacher student school number paper pencil table summer winter morning evening' +
    ' happy sunny rainy windy cold warm hot slow quick quiet loud small large tall short young old new clean dirty full empty open close').split(/\s+/);
  const WORD_SET = Array.from(new Set(WORDS));

  const SENTENCES = [
    'I hid a big fig.', 'A bee fed. A cab hid.', 'Jade had a big head.', 'Mom made a lemon cake.', 'Look at the moon.', 'The dog ran home.',
    'Kim likes milk.', 'Sam has six red boxes.', 'We will go to the park.', 'Are you quiet today?', 'Pass the salt, please.', 'It is a cold day!',
    'My cat is very lazy.', 'The queen was quick.', 'Zoe fixed the old box.', 'Max read a book.', 'Can you see the star?', 'Rain fell all night.',
    'She sells fish at the shop.', 'This is the child that sang.', 'Which way is the church?', 'The light is bright tonight.',
    'Our house is near the river.', 'He found a round stone.', 'They were singing a long song.', 'The rabbit hopped off the road.',
    'We had enough bread for lunch.', 'Every person can learn to read.', 'There is no time like today.', 'Mother and father went to work.',
    'Some people know the answer.', 'Where is the young dog?', 'The world is full of wonder.', 'Many hands make light work.',
    'The nation held its breath.', 'Kindness is never wasted.', 'Be careful on the stairs.', 'The station is beside the market.',
    'Your friend said she would come tomorrow.', 'I must go before it gets dark.', 'Read the letter again, quickly.', 'He always does good work.',
    'Children ran across the field after school.', 'We could see the mountains already.', 'Perhaps it will rain this afternoon.',
    'Braille is read by touch, but you can learn it by sight.', 'The train was late, so we waited together.', 'There were 12 eggs in the box.',
    'She asked, “Where is my coat?”', 'Was it his idea or hers?', 'We counted 365 days in a year.'
  ];

  // Graded passages for the reading room, original text.
  const PASSAGES = [
    { id: 'p1', level: 1, title: 'The cat', text: 'The cat sat in the sun. It was a warm day. The cat did not want to move. A bird sang in a tree. The cat opened one eye, then shut it again. It was too warm to chase a bird.' },
    { id: 'p2', level: 1, title: 'Lunch', text: 'Max made lunch for his sister. He cut the bread and added cheese. He found an apple and a glass of milk. His sister said thank you. They ate in the garden and watched the clouds go by.' },
    { id: 'p3', level: 2, title: 'The bus stop', text: 'Every morning, Rosa waits at the bus stop on the corner. She counts the cars as they pass. On Monday she counted 41. On Tuesday it rained, and she counted only 19, because she spent most of the time under her umbrella. The bus is never late. Rosa likes that.' },
    { id: 'p4', level: 2, title: 'A new skill', text: 'Learning something new is hard at first. Your hands feel slow and your mind feels full. Then, one day, the letters stop being shapes and start being words. You do not have to think about them any more. That is the moment to keep going, because the next step is speed.' },
    { id: 'p5', level: 3, title: 'Louis Braille', text: 'Louis Braille was born in France in 1809. An accident in his father’s workshop took the sight of one eye when he was three, and he soon lost the other. At the school for blind children in Paris, he found that the books were huge and hard to read: the letters were simply print, pressed into the paper. A soldier named Charles Barbier had invented a code of raised dots for reading at night. Braille, still a teenager, made it simpler. His cells were small enough to be felt under one fingertip, and by 1824 he had the system we still use today.' },
    { id: 'p6', level: 3, title: 'The lighthouse keeper', text: 'For forty years, the lighthouse keeper climbed the same one hundred and twelve steps every evening. He knew each one by the sound it made. The seventh step creaked; the fortieth was always cold; the last one had a crack shaped like a river. When the light was made automatic, he was told he could rest. He still climbed the steps each night, just to hear them, and to watch the beam turn slowly over the dark water.' },
    { id: 'p7', level: 4, title: 'How a garden grows', text: 'A garden is mostly patience. You put a seed in the ground and nothing happens for days. Under the soil, though, the seed is already busy. It takes in water, swells, and splits its coat. A root goes down first, looking for more water, and only then does a shoot push up toward the light. By the time you see the first green leaf, the plant has done most of its hardest work in the dark. Gardeners learn to trust what they cannot see. They water, they wait, and they pull the weeds, and one morning the whole bed is green.' },
    { id: 'p8', level: 4, title: 'The map in your head', text: 'Think about the walk from your front door to your kitchen. You can probably do it with your eyes closed. Your brain keeps a map of places you know well, and it updates that map every time you move through them. Scientists have found cells in the brain that fire when you are in a particular spot, and others that fire when you face a particular direction. Together they work like a compass and a grid. That is why a familiar room feels easy to cross in the dark, and why a new building can leave you turned around for days.' },
    { id: 'p9', level: 5, title: 'Reading by sight', text: 'Most people who read braille read it with their fingers, but many sighted people learn to read it with their eyes: teachers, parents, and friends of braille readers, and those who transcribe books. Reading by sight is a different skill from reading by touch. The eye sees a whole line at once, so it is tempting to guess at words from their shape, the way we skim print. That works for short, common words, but it fails on contractions that look alike. The best readers slow down at first and look at every cell. Speed comes later, and it comes from knowing the signs so well that you no longer have to decode them. That is what practice is for: not to read faster today, but to make tomorrow’s reading effortless.' },
    { id: 'p10', level: 5, title: 'Night train', text: 'The night train left the city a little after ten. Most of the passengers were asleep before the last of the street lights had disappeared, but Nora sat by the window with her forehead against the cold glass. She liked the way the towns went by in the dark: a single lit window, a crossing bell, a station whose name she never had time to read. Somewhere after midnight the train slowed and stopped in the middle of a field. No one came through to explain. For ten minutes there was nothing but the sound of the wind and the ticking of the engine as it cooled. Then, without a word, the train moved on, and Nora wondered for the rest of the journey what it had stopped for, and whether anyone out there in the field had watched it go.' }
  ];

  // ── exercises ──────────────────────────────────────────────────────────
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function sameCells(a, b) { return ITEMS[a].cells === ITEMS[b].cells; }
  const KIND_FAMILY = { letter: 'a', digit: 'd', punct: 'p', indicator: 'i', wordsign: 'w', strong: 'w', swordsign: 'w', lowerword: 'w', groupsign: 'g', lower: 'g', final: 'g', initial: 'w', shortform: 'w' };

  // Distractors: same family, never the same cells or label; learned ones and
  // look-alikes (mirror image, one dot off) first.
  function distractors(id, pool, rng, n) {
    const it = ITEMS[id];
    const fam = KIND_FAMILY[it.kind];
    const target = cells(it.cells);
    const score = (oid) => {
      const o = cells(ITEMS[oid].cells);
      let s = rng();
      if (o.length === target.length) {
        const last = target.length - 1;
        if (o[last] === mirror(target[last]) && o[last] !== target[last]) s += 3;
        else if (hamming(o[last], target[last]) === 1) s += 2;
        if (target.length > 1 && o[0] === target[0]) s += 1;
      }
      if (pool.has(oid)) s += 2;
      return s;
    };
    const cand = Object.keys(ITEMS).filter((oid) => oid !== id && KIND_FAMILY[ITEMS[oid].kind] === fam &&
      !sameCells(oid, id) && ITEMS[oid].label !== it.label && (pool.has(oid) || UNIT_INDEX[ITEMS[oid].unit].index <= UNIT_INDEX[it.unit].index + 1));
    const seenLabel = new Set([it.label]);
    const seenCells = new Set([it.cells]);
    const out = [];
    for (const oid of cand.map((c) => [score(c), c]).sort((a, b) => b[0] - a[0]).map((x) => x[1])) {
      if (seenLabel.has(ITEMS[oid].label) || seenCells.has(ITEMS[oid].cells)) continue;
      seenLabel.add(ITEMS[oid].label); seenCells.add(ITEMS[oid].cells);
      out.push(oid);
      if (out.length >= n) break;
    }
    return out;
  }

  function itemExercise(type, id, pool, rng) {
    const it = ITEMS[id];
    if (type === 'dots') return { type, item: id, answer: it.cells };
    const ds = distractors(id, pool, rng, 3);
    const opts = shuffle([id].concat(ds), rng);
    if (type === 'pickMeaning') return { type, item: id, cells: it.cells, options: opts.map((o) => ITEMS[o].label), answer: it.label };
    return { type: 'pickCell', item: id, label: it.label, options: opts.map((o) => ITEMS[o].cells), answer: it.cells };
  }
  const canDots = (id) => cells(ITEMS[id].cells).length === 1;

  function wordExercises(known, focus, rng, n, maxLen) {
    const out = [];
    const ok = [];
    for (const w of shuffle(WORD_SET, rng)) {
      if (w.length > (maxLen || 9)) continue;
      const allLetters = w.split('').every((c) => known.has('l-' + c));
      if (!allLetters) continue;
      const t = translate(w, known);
      if (focus && !Array.from(focus).some((f) => t.used.has(f))) continue;
      ok.push({ type: 'readWord', text: w, ascii: t.ascii });
      if (ok.length >= n) break;
    }
    out.push(...ok);
    return out;
  }
  function sentenceUsable(s, known) {
    for (const ch of s.toLowerCase()) {
      if (/[a-z]/.test(ch) && !known.has('l-' + ch)) return false;
      if (/[0-9]/.test(ch) && !known.has('d-' + ch)) return false;
      if (PUNCT[ch] && PUNCT[ch][1] && !known.has(PUNCT[ch][1])) return false;
      if (ch === '"' || ch === '(' || ch === ')') return false;
    }
    if (/[A-Z]/.test(s) && !known.has('cap')) return false;
    return true;
  }
  function sentenceExercises(known, focus, rng, n) {
    const out = [];
    const pool = shuffle(SENTENCES.filter((s) => sentenceUsable(s, known)), rng);
    for (const s of pool) {
      const t = translate(s, known);
      if (focus && !Array.from(focus).some((f) => t.used.has(f))) continue;
      const others = shuffle(pool.filter((o) => o !== s), rng).slice(0, 2);
      if (others.length < 2) break;
      out.push({ type: 'readSentence', text: s, ascii: t.ascii, options: shuffle([s].concat(others), rng), answer: s });
      if (out.length >= n) break;
    }
    return out;
  }

  // ctx: { rng, items (SRS records) }
  function buildLesson(lessonId, ctx) {
    const rng = ctx.rng || Math.random;
    const l = LESSON_INDEX[lessonId];
    if (!l) return [];
    const before = knownBefore(lessonId);
    const known = knownThrough(lessonId);
    const ex = [];
    if (l.kind === 'learn') {
      const fresh = l.items;
      for (const id of fresh) {
        ex.push({ type: 'learn', item: id });
        ex.push(itemExercise('pickMeaning', id, known, rng));
      }
      for (const id of fresh) {
        ex.push(canDots(id) ? itemExercise('dots', id, known, rng) : itemExercise('pickCell', id, known, rng));
      }
      // Interleave the new signs with a few older ones, weakest first.
      const old = weakest(before, ctx.items || {}, rng, 3);
      const mix = shuffle(fresh.concat(fresh, old), rng);
      mix.forEach((id, k) => ex.push(itemExercise(k % 2 ? 'pickCell' : 'pickMeaning', id, known, rng)));
      ex.push(...wordExercises(known, new Set(fresh), rng, 3, 7));
      ex.push(...sentenceExercises(known, new Set(fresh), rng, 1));
    } else {
      const unitItems = l.items;
      const mix = shuffle(unitItems.concat(weakest(before, ctx.items || {}, rng, 4)), rng).slice(0, 10);
      mix.forEach((id, k) => {
        const t = k % 3 === 0 && canDots(id) ? 'dots' : (k % 2 ? 'pickCell' : 'pickMeaning');
        ex.push(itemExercise(t, id, known, rng));
      });
      ex.push(...wordExercises(known, new Set(unitItems), rng, 4));
      ex.push(...sentenceExercises(known, new Set(unitItems), rng, 2));
    }
    return ex;
  }

  // ── spaced repetition (Leitner boxes) ──────────────────────────────────
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
  function dayNumber(date) {
    const d = date || new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  }
  // A sight reader is not fluent until recognition is fast, so a correct but
  // slow answer does not move a sign up a box.
  const FLUENT_MS = 4000;
  function grade(rec, ok, ms, today) {
    const r = Object.assign({ b: 0, due: today, n: 0, ok: 0, ms: 0 }, rec || {});
    r.n++;
    if (ok) {
      r.ok++;
      if (!(ms > FLUENT_MS)) r.b = Math.min(INTERVALS.length - 1, r.b + 1);
      r.due = today + INTERVALS[r.b];
    } else {
      r.b = Math.max(0, r.b - 2);
      r.due = today;
    }
    if (ms > 0) r.ms = r.ms ? Math.round(r.ms * 0.7 + Math.min(ms, 20000) * 0.3) : Math.min(ms, 20000);
    return r;
  }
  function strength(rec) {
    if (!rec || !rec.n) return 0;
    return rec.b / (INTERVALS.length - 1);
  }
  function weakest(ids, recs, rng, n) {
    return shuffle(Array.from(ids), rng)
      .map((id) => [(recs[id] ? recs[id].b : 0) + (recs[id] && recs[id].ms > FLUENT_MS ? 0 : 0.5) + rng() * 0.5, id])
      .sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
  }
  function dueItems(known, recs, today) {
    return Array.from(known).filter((id) => !recs[id] || recs[id].due <= today);
  }
  // A review session: due signs first, then the weakest, then some reading.
  function buildPractice(ctx) {
    const rng = ctx.rng || Math.random;
    const known = ctx.known;
    if (!known.size) return [];
    const recs = ctx.items || {};
    const due = shuffle(dueItems(known, recs, ctx.today), rng);
    const fill = weakest(Array.from(known).filter((id) => !due.includes(id)), recs, rng, 12);
    const pick = due.concat(fill).slice(0, ctx.focus === 'weak' ? 15 : 12);
    const ex = shuffle(pick, rng).map((id, k) => itemExercise(k % 3 === 2 && canDots(id) ? 'dots' : (k % 2 ? 'pickCell' : 'pickMeaning'), id, known, rng));
    if (ctx.focus !== 'weak') {
      ex.push(...wordExercises(known, null, rng, 4));
      ex.push(...sentenceExercises(known, null, rng, 2));
    }
    return ex;
  }
  // The 60-second sprint: single signs, as many as you can.
  function sprintQueue(known, rng, n) {
    const ids = Array.from(known);
    const out = [];
    for (let i = 0; i < n && ids.length >= 4; i++) out.push(itemExercise('pickMeaning', ids[Math.floor(rng() * ids.length)], known, rng));
    return out;
  }

  // An answer to a reading exercise is right if it brailles to the same cells:
  // "his" and an opening quote are the same cell, and either reading counts.
  function readingMatches(answer, text, known) {
    const norm = (s) => String(s).trim().replace(/\s+/g, ' ').replace(/[‘’]/g, '\'').toLowerCase();
    const a = norm(answer);
    if (!a) return false;
    if (a === norm(text)) return true;
    return translate(a, known).ascii === translate(norm(text), known).ascii;
  }

  // ── reading speed ──────────────────────────────────────────────────────
  function wordCount(text) { return String(text).trim().split(/\s+/).filter(Boolean).length; }
  function wpm(text, ms) { return ms > 0 ? Math.round((wordCount(text) / (ms / 60000)) * 10) / 10 : 0; }

  // ── state ──────────────────────────────────────────────────────────────
  const clampInt = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
  function normalizeState(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const out = {
      v: 1,
      xp: clampInt(s.xp, 0, 1e9, 0),
      goal: [10, 20, 30, 50].includes(+s.goal) ? +s.goal : 20,
      today: { day: clampInt(s.today && s.today.day, 0, 1e7, 0), xp: clampInt(s.today && s.today.xp, 0, 1e6, 0) },
      streak: { days: clampInt(s.streak && s.streak.days, 0, 1e5, 0), last: clampInt(s.streak && s.streak.last, 0, 1e7, 0), best: clampInt(s.streak && s.streak.best, 0, 1e5, 0) },
      done: {},
      items: {},
      reading: {},
      sprint: { best: clampInt(s.sprint && s.sprint.best, 0, 10000, 0) },
      settings: {
        ghost: ['auto', 'on', 'off'].includes(s.settings && s.settings.ghost) ? s.settings.ghost : 'auto',
        size: clampInt(s.settings && s.settings.size, 1, 5, 3),
        mode: ['learned', 'grade1', 'grade2'].includes(s.settings && s.settings.mode) ? s.settings.mode : 'learned'
      }
    };
    if (s.done && typeof s.done === 'object') for (const k in s.done) if (LESSON_INDEX[k] && s.done[k]) out.done[k] = true;
    if (s.items && typeof s.items === 'object') {
      for (const k in s.items) {
        const r = s.items[k];
        if (!ITEMS[k] || !r || typeof r !== 'object') continue;
        out.items[k] = { b: clampInt(r.b, 0, INTERVALS.length - 1, 0), due: clampInt(r.due, 0, 1e7, 0), n: clampInt(r.n, 0, 1e7, 0), ok: clampInt(r.ok, 0, 1e7, 0), ms: clampInt(r.ms, 0, 60000, 0) };
      }
    }
    if (s.reading && typeof s.reading === 'object') {
      for (const k in s.reading) {
        const r = s.reading[k];
        if (!PASSAGES.some((p) => p.id === k) || !r || typeof r !== 'object') continue;
        out.reading[k] = { best: Math.max(0, Math.min(1000, +r.best || 0)), last: Math.max(0, Math.min(1000, +r.last || 0)), times: clampInt(r.times, 0, 1e6, 0) };
      }
    }
    return out;
  }
  // XP and the streak: a day counts once it reaches the daily goal.
  function addXp(state, xp, today) {
    if (state.today.day !== today) state.today = { day: today, xp: 0 };
    const before = state.today.xp;
    state.today.xp += xp;
    state.xp += xp;
    if (before < state.goal && state.today.xp >= state.goal) {
      if (state.streak.last === today - 1) state.streak.days += 1;
      else if (state.streak.last !== today) state.streak.days = 1;
      state.streak.last = today;
      state.streak.best = Math.max(state.streak.best, state.streak.days);
    }
    return state;
  }
  function currentStreak(state, today) {
    return state.streak.last >= today - 1 ? state.streak.days : 0;
  }

  global.BrailleCore = {
    ASCII, STAGES, UNITS, ITEMS, LESSONS, PASSAGES, SENTENCES, WORDS: WORD_SET, INTERVALS, FLUENT_MS, READING_UNLOCK,
    unitById: (id) => UNIT_INDEX[id], lessonById: (id) => LESSON_INDEX[id],
    cells, dotsOf, maskOfDots, unicode, mirror, translate,
    lessonsFor, knownBefore, knownThrough, knownFrom, nextLesson, unlocked, readingOpen,
    buildLesson, buildPractice, sprintQueue, distractors, readingMatches,
    grade, strength, dueItems, dayNumber, wordCount, wpm,
    normalizeState, addXp, currentStreak,
    PUNCT
  };
})(typeof window !== 'undefined' ? window : globalThis);
