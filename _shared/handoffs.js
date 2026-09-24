/* handoffs.js — cross-tool "Send to…", declared once. Path 6 P4. `window.Handoffs`.

   Before this file, three tools handed their work to another tool and each
   invented the mechanism on its own: 046 built 015's `?timeline=` link by
   hand, 056 built 028's `?worksheet=` link by hand, and 003 WRITES straight
   into 037's localStorage through rubric-builder/rb-gdv-handoff.js (040
   reads 039's storage the same way, in the other direction). Every one of
   them hard-coded the other tool's file name and its parameter, so a
   receiver that renamed either silently stranded the sender — and nothing
   on the site could list which tool sends to which. 046 and 056 are entries
   below now (Path 6 P4's rollout, 2026-09-24). The storage-shaped pair was
   decided the same day and HISTORY.md has the reasoning:

     003 -> 037 stays a same-device storage write and is NOT an entry. What
       it hands over is every student's name beside their rubric score. A
       link is a URL — it lives in history, on a clipboard, in an email —
       and a field travels in one only if it was written to be published
       (#248's rule). Grades were not. The rubric itself shares through
       003's own sheet; the scores never leave the device.
     039 -> 040 IS an entry (a word list is authored to be handed round),
       so the drill set's sheet can send it to 040's own `?deck=` importer.
       040's read-only "import from a drill set" pull stays beside it: it
       never writes 039's keys, so it cannot strand anything, and it is the
       one-click path on a device that already has both tools' data.

   The roster chain (006/007 -> 002 -> 022 -> 005) was decided hop by hop
   on 2026-09-24, each against the same rule:

     006/007 -> 002 (roster -> groups) is NOT an entry. 002 already reads
       every saved class list through _shared/roster.js's picker, on the
       same device, with no URL at all. A link would put a class list into
       browser history only to move it between two tabs of one browser —
       the same trade 003 -> 037 declined. Across devices, 006's and 007's
       own roster links already exist and are a teacher's deliberate choice.
     002 -> 022 (groups -> lab roles) IS an entry. It carries exactly what
       002's own sheet already publishes — group labels and who is in each —
       and nothing 002's sheet does not. 022 keeps the groups as made and
       hands out its roles; its role history, safety-contract status and
       keep-apart pairs never came from 002 and do not go back.
     022 -> 005 (lab groups -> seating) IS an entry, sent from 022's own
       button (no sheet row: 022 has no share sheet). Only the names and who
       sits with whom travel. Roles, role history, absences, who has not
       signed a safety contract, and keep-apart pairs do not: those are
       records about a student, not a seating plan written to be put up.

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

  /** A place name as 015 would type it: no blank, no runaway length. */
  function clip(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }

  /** A list of groups, each a list of names: blank names dropped, every name
      clipped, and a group with nobody left in it dropped. */
  function nameGroups(groups) {
    return (Array.isArray(groups) ? groups : []).map(function (g) {
      return (Array.isArray(g) ? g : []).map(function (n) { return clip(n, 100); }).filter(Boolean);
    }).filter(function (g) { return g.length; });
  }

  /* 005's room, as Tools/seating-chart/seating.mjs's ROOM has it. Only what a
     pod layout needs; 005's own repair pass clamps anything outside it. */
  var ROOM = { width: 1280, height: 900, deskW: 106, deskH: 70, top: 110 };

  /** One pod per group: two desks across (one for a group of one), as many
      rows as the group needs, the gaps 005's own "Add pod" leaves. Pods are
      laid left to right, four to a row (five past twelve groups), centred.
      Returns { desks, assign, students } with section-local ids. */
  function podSeating(groups) {
    var perRow = Math.max(1, Math.min(groups.length, groups.length > 12 ? 5 : 4));
    var podW = 2 * ROOM.deskW + 10;
    var gapX = perRow >= 5 ? 22 : 44;
    var startX = Math.max(30, Math.round((ROOM.width - (perRow * podW + (perRow - 1) * gapX)) / 2));
    var desks = [], assign = {}, students = [];
    var y = ROOM.top;
    for (var r = 0; r * perRow < groups.length; r++) {
      var tallest = 0;
      groups.slice(r * perRow, (r + 1) * perRow).forEach(function (g, c) {
        var cols = g.length > 1 ? 2 : 1;
        var x0 = startX + c * (podW + gapX);
        tallest = Math.max(tallest, Math.ceil(g.length / cols));
        g.forEach(function (name, i) {
          var desk = { id: 'd' + (desks.length + 1), x: x0 + (i % cols) * (ROOM.deskW + 10),
            y: y + Math.floor(i / cols) * (ROOM.deskH + 10), rot: 0, locked: false };
          var student = { id: 's' + (students.length + 1), name: name };
          desks.push(desk); students.push(student);
          assign[desk.id] = student.id;
        });
      });
      y += tallest * (ROOM.deskH + 10) - 10 + 44;
    }
    return { desks: desks, assign: assign, students: students };
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
    },
    {
      from: 'blank-map-generator',
      to: 'timeline-builder',
      label: 'Send places to Timeline Builder',
      note: 'each label becomes an event',
      sent: 'Sent the labelled places to the Timeline Builder in a new tab, as events dated year 0 — set each event’s real year there. It saves as its own timeline; editing it does not change this map.',
      /* 046's state for this entry is { name, places: [{ name, lat, lon }] }
         — the page works out each label's coordinates from its calibration
         (Share.mount's sendState), because only the map on screen knows its
         own size. Every event lands at year 0: dates are the one thing a
         map does not know, a teacher can see that 0 is a placeholder, and
         015 stacks same-year labels into rows so twenty arrive readable.
         Only a label's text and position travel — never the map image, its
         markers, regions or worksheet settings. */
      transform: function (state) {
        var places = (state && state.places || []).filter(function (p) {
          return p && clip(p.name, 200) && isFinite(p.lat) && isFinite(p.lon);
        });
        return {
          v: 1,
          name: clip(state && state.name, 200) || 'Places from a map',
          events: places.map(function (p, i) {
            var name = clip(p.name, 200);
            return {
              id: i + 1, track: 0, title: name, yearStart: 0, yearEnd: null, category: null,
              place: { name: name, lat: Number(p.lat), lon: Number(p.lon) },
              displayDate: null, description: '', photo: null
            };
          }),
          eras: [],
          tracks: [{ id: 0, name: 'Track A' }],
          lineStyle: 'solid',
          compactLabels: true,
          scaleMode: 'linear'
        };
      }
    },
    {
      from: 'dbq-source-packet-builder',
      to: 'primary-source-analysis-generator',
      label: 'Send to Primary Source Analysis',
      note: 'one source becomes a worksheet',
      /* No row in the sheet: what travels is ONE source, chosen by the
         "Analysis worksheet →" button on that source's row, not the packet
         the sheet shares. The page calls Handoffs.open() itself. */
      sheet: false,
      sent: 'Sent the source to Primary Source Analysis in a new tab, as a SOAPSTone worksheet. It saves there as its own worksheet; editing it does not change this packet.',
      /* 056's state for this entry is { source: { title, text, citation },
         letter: 'Source A', packetTitle }. Text sources only — an uploaded
         image is base64 in the packet and never rides a link. Only the
         source's own words, title and citation travel; the packet's
         questions, rubric and other sources do not. SOAPSTone is 028's
         framework for written sources (OPTIC is its visual one). */
      transform: function (state) {
        var src = (state && state.source) || {};
        var letter = clip(state && state.letter, 40) || 'Source';
        var titled = clip(src.title, 300) || letter;
        var packetTitle = clip(state && state.packetTitle, 300) || 'DBQ packet';
        return {
          v: 1,
          name: titled + ' — ' + packetTitle,
          sourceTitle: titled,
          sourceType: 'document',
          sourceDescription: '',
          sourceText: String(src.text || ''),
          imageUrl: '',
          imageDataUrl: '',
          citationAuthor: '',
          citationDate: '',
          citationOrigin: clip(src.citation, 1000),
          lineNumbers: false,
          vocabSupport: '',
          readingSupportEnabled: false,
          readingSummary: '',
          readingParaphrase: '',
          framework: 'soapstone',
          notes: {},
          customQuestions: {},
          answerLines: 4,
          corroborationMode: false,
          sourceBTitle: '', sourceBType: 'photo', sourceBDescription: '', sourceBText: '',
          sourceBImageUrl: '', sourceBImageDataUrl: '',
          sourceBCitationAuthor: '', sourceBCitationDate: '', sourceBCitationOrigin: '',
          notesB: {}, comparisonNotes: {}
        };
      }
    },
    {
      from: 'vocab-conjugation-drill',
      to: 'vocab-flashcard-generator',
      label: 'Send to Vocabulary Flashcards',
      note: 'every word becomes a card',
      sent: 'Sent the vocabulary to the Vocabulary Flashcard Generator in a new tab. It is saved there as its own word list; editing it does not change this set.',
      /* 039's vocabulary is already "word: translation" per line, which is
         040's own format, so the words travel as typed (blank lines
         dropped). The verbs and their conjugation tables do not: a
         flashcard has two sides and a conjugation table is not a card. */
      transform: function (state) {
        var lines = String(state && state.vocabText || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);
        return {
          name: clip(state && state.name, 200) || 'Drill vocabulary',
          words: lines.join('\n')
        };
      }
    },
    {
      from: 'group-team-generator',
      to: 'lab-group-role-randomizer',
      label: 'Send to Lab Group & Role Randomizer',
      note: 'the same groups, with lab roles',
      sent: 'Sent the groups to the Lab Group & Role Randomizer in a new tab. They are saved there as a new lab class with roles handed out; editing it does not change this grouping.',
      /* 002's state for this entry is its own share payload, { v, title,
         groups: [{ label, members }] } — the sheet's getState. The same
         labels and names travel, and nothing else: 002's roster, keep-apart
         and keep-together rules, skill numbers and pairing memory stay. */
      transform: function (state) {
        var groups = (state && Array.isArray(state.groups) ? state.groups : []).map(function (g) {
          return { label: clip(g && g.label, 80), members: nameGroups([g && g.members])[0] || [] };
        }).filter(function (g) { return g.members.length; });
        return {
          v: 1,
          name: clip(state && state.title, 200) || 'Groups from the Group Generator',
          groups: groups
        };
      }
    },
    {
      from: 'lab-group-role-randomizer',
      to: 'seating-chart',
      label: 'Send to Seating Chart',
      note: 'each group sits together at a pod',
      /* No sheet row: 022 has no share sheet. Its "Seat these groups" button
         calls Handoffs.open() itself. */
      sheet: false,
      sent: 'Sent the groups to the Seating Chart Generator in a new tab, one pod of desks per group with everyone seated. It is added there as a new section; editing it does not change these groups.',
      /* 022's state for this entry is { name, groups: [[name, …], …] } — the
         names in each group of the last shuffle and nothing else. The result
         is a whole 005 section, which 005's ?section= importer adds beside
         the ones already there: a pod per group, seated in group order. */
      transform: function (state) {
        var seats = podSeating(nameGroups(state && state.groups));
        return {
          name: (clip(state && state.name, 180) || 'Lab class') + ' — lab groups',
          students: seats.students,
          apart: [],
          together: [],
          desks: seats.desks,
          assign: seats.assign,
          layouts: [],
          history: []
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
