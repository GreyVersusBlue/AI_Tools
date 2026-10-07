/* Vocabulary Flashcard & Word Wall Generator (040) and the site's question
   bank (_shared/question-bank.js), both ways (Path 12 P2). Pure functions, no
   DOM and no storage: the page does the asking and the storing. Publishes
   window.VfgBank; needs vfg-layout.js (VocabLayout.parseWordList) before it.
   Its tests are test/bank-logic.test.mjs.

   A QUESTION IS A CARD, AND A CARD IS A QUESTION
     question                 card (one line of the list)
     prompt              <->  term           the front
     answer              <->  definition     the back
     example             <->  example        these three are 040's own; the
     pronunciation       <->  pronunciation  bank does not know them and
     partOfSpeech        <->  partOfSpeech   carries them as given
     unit                <-   the list's name (a card to a question only)
     sharedFrom          <-   'vocab-flashcard-generator'
   Nothing else of a question reaches a card: its choices, picture, points,
   standard, difficulty and tags stay in the bank.

   BANK TO 040 (cardsFrom). A card is one line of the list, and the list is
   the only thing 040 stores, so a question becomes a card by becoming a
   line: "term: definition | example | pronunciation | part of speech", or,
   when that would be read back differently (a colon in the question, a bar
   in the answer), the same fields with a tab between them, which the list
   has always read. lineFor() does not trust either: it reads its own line
   back with the page's parser and hands it over only when every field came
   back as it went in. What cannot be a card, and is said so, by question:
     - no question, or no answer (the back of the card would be blank);
     - a question or an answer that runs over more than one line (a card is
       one line), or has a tab in it (a tab parts the front from the back).
   A card made this way keeps no tie to the question it came from. It is
   text in the teacher's list, theirs to edit.

   040 TO BANK (toQuestions). Each card with a definition is a question; a
   card with none is left out and counted. The id is made from the list's
   name and the term, and from nothing else:
       'vfg-' + hash(list name) + '-' + hash(term)      (+ '~2' for a term
                                                          the list has twice)
   letter case and spacing aside. So the same list sent twice names the same
   questions and adds nothing; a definition changed since changes that
   question where it stands in the bank; a new term is a new question. A
   renamed list makes new ids, and the bank then skips every card whose term
   and definition it already holds (its rule for an id it has not seen), so
   that adds nothing either. A card that was made FROM a bank question is
   skipped the same way. plan() says, card by card, which of these will
   happen, before anything is stored; the page stores with
   QuestionBank.importQuestions() only when the teacher says so. */
(function (global) {
  'use strict';

  var SLUG = 'vocab-flashcard-generator';
  var FIELDS = ['term', 'definition', 'example', 'pronunciation', 'partOfSpeech'];

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function fold(s) { return str(s).toLowerCase().replace(/\s+/g, ' '); }
  function oneLine(s) { return !/[\r\n]/.test(s); }
  function noTab(s) { return s.indexOf('\t') === -1; }

  /** The one card a line of the list is, or null when it is none or several. */
  function readLine(line) {
    var got = global.VocabLayout.parseWordList(line);
    return got.length === 1 ? got[0] : null;
  }

  /** The line of 040's list that is exactly this card, or '' when no line
      is. Tried as "term: definition | …" and then tab-separated; each is read
      back and kept only if all five fields return unchanged. */
  function lineFor(item) {
    var extras = [str(item.example), str(item.pronunciation), str(item.partOfSpeech)];
    while (extras.length && !extras[extras.length - 1]) extras.pop();
    var term = str(item.term), definition = str(item.definition);
    var tries = [
      term + ': ' + [definition].concat(extras).join(' | '),
      [term, definition].concat(extras).join('\t')
    ];
    for (var i = 0; i < tries.length; i++) {
      if (/[\r\n]/.test(tries[i])) continue;
      var back = readLine(tries[i]);
      if (back && FIELDS.every(function (f) { return back[f] === str(item[f]); })) return tries[i];
    }
    return '';
  }

  /** One question as a card: { ok: true, item, line } or { ok: false, why },
      `why` being a sentence for the teacher. */
  function toCard(q) {
    q = q && typeof q === 'object' ? q : {};
    var prompt = str(q.prompt), answer = str(q.answer);
    if (!prompt) return { ok: false, why: 'It has no question.' };
    if (!answer) return { ok: false, why: 'It has no answer, so the back of the card would be blank.' };
    if (!oneLine(prompt)) return { ok: false, why: 'Its question runs over more than one line, and a card is one line of the list.' };
    if (!oneLine(answer)) return { ok: false, why: 'Its answer runs over more than one line, and a card is one line of the list.' };
    if (!noTab(prompt) || !noTab(answer)) return { ok: false, why: 'It has a tab in it, and in this list a tab is what parts the front of a card from the back.' };
    var item = { term: prompt, definition: answer, example: '', pronunciation: '', partOfSpeech: '' };
    ['example', 'pronunciation', 'partOfSpeech'].forEach(function (f) {
      if (str(q[f]) && oneLine(str(q[f])) && noTab(str(q[f]))) item[f] = str(q[f]);
    });
    var line = lineFor(item);
    if (!line) {                                               // the extras are the tool's own; the card is worth more
      item.example = item.pronunciation = item.partOfSpeech = '';
      line = lineFor(item);
    }
    if (!line) return { ok: false, why: 'It cannot be written as one line of this list.' };
    return { ok: true, item: item, line: line };
  }

  /** Questions as cards. Returns { cards: [{ id, item, line }], refused:
      [{ id, prompt, why }], withChoices, withPicture }: the last two count
      the cards whose question has choices or a picture, which a card does
      not show. The order is the questions'. */
  function cardsFrom(questions) {
    var out = { cards: [], refused: [], withChoices: 0, withPicture: 0 };
    (Array.isArray(questions) ? questions : []).forEach(function (q) {
      var card = toCard(q), id = q && typeof q === 'object' ? str(q.id) : '';
      if (!card.ok) { out.refused.push({ id: id, prompt: q && typeof q === 'object' ? str(q.prompt) : '', why: card.why }); return; }
      if (Array.isArray(q.choices) && q.choices.length) out.withChoices++;
      if (q.media !== undefined && q.media !== null && q.media !== '') out.withPicture++;
      out.cards.push({ id: id, item: card.item, line: card.line });
    });
    return out;
  }

  /** `words` (the list's text) with `lines` added after it, each on a line
      of its own. */
  function appendLines(words, lines) {
    var text = String(words === null || words === undefined ? '' : words);
    if (!lines.length) return text;
    return (text.trim() ? text.replace(/\n*$/, '\n') : '') + lines.join('\n');
  }

  /* FNV-1a, 32 bits, over the text's UTF-16 units; twice, from two starts,
     so two terms need both to agree before they share an id. */
  function fnv(s, start) {
    var h = start >>> 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h ^= c & 0xff; h = Math.imul(h, 16777619) >>> 0;
      h ^= c >>> 8; h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function hash(s) { return fnv(s, 2166136261).toString(36) + fnv(s, 3141592653).toString(36); }

  /** The bank id of a card: the list's name and the term, letter case and
      spacing aside; `nth` (from 1) tells a repeated term's cards apart. */
  function cardId(listName, term, nth) {
    return 'vfg-' + hash(fold(listName)) + '-' + hash(fold(term)) + (nth > 1 ? '~' + nth : '');
  }

  /** A list's cards as bank questions. `items` are parseWordList()'s, in the
      list's own order. Returns { questions, skipped }: `skipped` is
      [{ term, why }] for the cards that are not questions. */
  function toQuestions(listName, items) {
    var out = { questions: [], skipped: [] }, times = {};
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var term = str(item && item.term);
      if (!term) return;
      var key = '$' + fold(term), nth = times[key] = (times[key] || 0) + 1;
      if (!str(item.definition)) { out.skipped.push({ term: term, why: 'It has no definition, so there is no answer to store.' }); return; }
      out.questions.push({
        id: cardId(listName, term, nth), prompt: term, answer: str(item.definition), unit: str(listName),
        example: str(item.example), pronunciation: str(item.pronunciation), partOfSpeech: str(item.partOfSpeech),
        sharedFrom: SLUG
      });
    });
    return out;
  }

  /** What sending `questions` would do to `bank` (a list of the bank's
      questions), one by one and in order, by the bank's own merge():
      [{ question, what }], `what` being 'new' (it will be added), 'changed'
      (the bank has this card and its wording there will change), 'same'
      (the bank has this card as it is) or 'there' (the bank has a question
      with these words under another id; nothing is added). Stores nothing. */
  function plan(QB, bank, questions) {
    var list = bank.slice();
    return questions.map(function (q) {
      var step = QB.merge(list, [q]);
      list = step.questions;
      return { question: q, what: step.added ? 'new' : step.updated ? 'changed' : step.same ? 'same' : 'there' };
    });
  }

  global.VfgBank = {
    SLUG: SLUG,
    readLine: readLine,
    lineFor: lineFor,
    toCard: toCard,
    cardsFrom: cardsFrom,
    appendLines: appendLines,
    cardId: cardId,
    toQuestions: toQuestions,
    plan: plan
  };
})(typeof window !== 'undefined' ? window : global);
