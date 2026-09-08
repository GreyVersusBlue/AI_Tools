/* handoffs.js — cross-tool "Send to…", declared once. Path 6 P4. `window.Handoffs`.

   Three tools already hand their work to another tool, and each invented the
   mechanism on its own: 046 builds 015's `?timeline=` link by hand, 056
   builds 028's `?worksheet=` link by hand, and 003 WRITES straight into
   037's localStorage through rubric-builder/rb-gdv-handoff.js (040 reads
   039's storage the same way, in the other direction). Every one of them
   hard-codes the other tool's file name and its parameter, so a receiver
   that renames either silently strands the sender — and nothing on the site
   can list which tool sends to which.

   This file is that list. A handoff is one declared entry:

       { from:  'cognates-false-friends-builder',   the sender's slug
         to:    'vocab-flashcard-generator',        the receiver's slug
         label: 'Send to Vocabulary Flashcards',    the row in the share sheet
         note:  'every pair becomes a card',        the row's small print
         sent:  'Sent … in a new tab.',             what the sheet says after
         transform: function (state) { … } }       sender's state -> receiver's payload

   The receiver's FILE and PARAMETER are not in the entry. They come from
   _shared/tool-registry.js: `file` is what every row has always carried, and
   `share.param` is the query parameter the receiver's own Share.receive()
   reads — declared on the registry row since P4, and checked against the
   page's source by Tools/share/test/handoffs.test.mjs, so the table cannot
   drift from the pages the way the three hand-rolled senders could. A
   handoff to a tool whose row has no `share` is refused at call time with
   the reason, because that tool cannot open the link it would be sent.

   The link is the receiver's ordinary share link: state-link.js encodes the
   transformed payload into `?<param>=` against the receiver's page, and the
   receiver saves the arrival exactly as it would a colleague's link — under
   a new name, never over anything. So there is no third format and no
   cross-tool storage key: one tool's export IS the other's documented
   import, which is the rule 046 and 056 already followed by hand.

   share.js reads this table when a page has loaded it: Share.open() adds one
   "Send to <tool>" row per entry whose `from` is the sheet's `tool`, after
   the four rows it always has. A page that loads share.js without this file
   simply has no Send rows; nothing here is required.

   Plain global script; see state-link.js for why not an ES module. */
(function (global) {
  'use strict';

  /** One line of 040's word list: "term: definition". A colon inside the
      term would split the card in the wrong place, so it is softened. */
  function wordLine(term, definition) {
    return String(term || '').replace(/:/g, '：').trim() + ': ' + String(definition || '').trim();
  }

  var HANDOFFS = [
    {
      from: 'cognates-false-friends-builder',
      to: 'vocab-flashcard-generator',
      label: 'Send to Vocabulary Flashcards',
      note: 'every pair becomes a card',
      sent: 'Sent the list to the Vocabulary Flashcard Generator in a new tab. It is saved there as its own word list; editing it does not change this one.',
      /* A cognate is "target: english". A false friend is the trap on the
         back: "target: actual meaning (not "looksLike")". Blank targets are
         skipped rather than sent as empty cards. */
      transform: function (state) {
        var lines = [];
        (state && state.cognates || []).forEach(function (c) {
          if (c && String(c.target || '').trim()) lines.push(wordLine(c.target, c.english));
        });
        (state && state.falseFriends || []).forEach(function (f) {
          if (!f || !String(f.target || '').trim()) return;
          var def = String(f.actual || '').trim();
          if (f.looksLike) def += (def ? ' ' : '') + '(not “' + String(f.looksLike).trim() + '”)';
          lines.push(wordLine(f.target, def));
        });
        return {
          name: ((state && state.lang) ? state.lang + ' ' : '') + 'cognates & false friends',
          words: lines.join('\n')
        };
      }
    }
  ];

  /** Every handoff whose sender is `slug`. */
  function from(slug) {
    return HANDOFFS.filter(function (h) { return h.from === slug; });
  }

  /** The registry row for an entry's receiver, or a thrown reason. */
  function receiver(entry) {
    if (!global.ToolRegistry) throw new Error('handoffs.js needs _shared/tool-registry.js loaded first');
    var t = global.ToolRegistry.bySlug(entry.to);
    if (!t) throw new Error('Handoffs: no tool with slug "' + entry.to + '"');
    if (!t.share || !t.share.param) throw new Error('Handoffs: ' + t.title + ' cannot receive a link — its registry row declares no share.param');
    return t;
  }

  /**
   * The link that opens `state`, transformed, in the entry's receiver.
   * { url, payload, target } — `target` is the registry row. Throws when the
   * receiver is unknown or cannot receive; a caller that wants a sentence
   * instead catches and reads e.message.
   */
  function url(entry, state, opts) {
    opts = opts || {};
    if (!global.StateLink) throw new Error('handoffs.js needs _shared/state-link.js loaded first');
    var target = receiver(entry);
    var payload = entry.transform ? entry.transform(state) : state;
    var here = opts.base || (global.location && global.location.href) || '';
    var base = new URL(global.ToolRegistry.href(target.slug), here).href;
    return {
      url: global.StateLink.buildShareUrl(target.share.param, payload, { base: base }),
      payload: payload,
      target: target
    };
  }

  /**
   * Opens the receiver in a new tab with `state` transformed. Returns
   * { ok, url, message } — ok false with the reason when the browser blocked
   * the tab or the handoff could not be built. Never throws.
   */
  function open(entry, state, opts) {
    var built;
    try { built = url(entry, state, opts); } catch (e) { return { ok: false, url: null, message: e.message }; }
    var w = global.open(built.url, '_blank', 'noopener');
    if (!w) return { ok: false, url: built.url, message: 'Your browser blocked the new tab. Allow pop-ups for this page and try again.' };
    return { ok: true, url: built.url, message: entry.sent || ('Sent to ' + built.target.title + ' in a new tab.') };
  }

  global.Handoffs = {
    all: HANDOFFS,
    from: from,
    url: url,
    open: open
  };
})(window);
