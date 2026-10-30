/* list-sentence.js — one list-to-sentence formatter for the whole site (AI-30, rank 69).
   Publishes window.ListSentence (globalThis in Node, so an ES module reaches it with
   `import '../../_shared/list-sentence.js'` and reads globalThis.ListSentence, as paste-table.js does).

     ListSentence.join(items)           ""  "A"  "A and B"  "A, B and C"   (no Oxford comma; items
                                        are used as given: nothing is filtered or trimmed)
     ListSentence.caption(names[, max]) join() of the non-empty names, or, past `max` (default 3),
                                        the first `max` and "and N more": "A, B, C and 8 more".
                                        Empty list -> "". This is 046's regionGroupCaption.

   Six pages kept their own copy of join() (077 listText, schedule-visualizer sv-check list,
   classroom-timer finishedMessage, seating-explain nameList, review-game-board rgb-play names,
   stations.js numbers) and 046 had caption(); their outputs are held to the old strings in
   Tools/list-sentence/test/list-sentence.test.mjs. Pure: no DOM, no storage. */
(function (root) {
  'use strict';

  function join(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function caption(names, max) {
    if (max === undefined) max = 3;
    var list = (names || []).filter(Boolean);
    if (!list.length) return '';
    if (list.length <= max) return join(list);
    return list.slice(0, max).join(', ') + ' and ' + (list.length - max) + ' more';
  }

  root.ListSentence = { join: join, caption: caption };
})(typeof window !== 'undefined' ? window : globalThis);
