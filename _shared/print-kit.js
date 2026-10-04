/* print-kit.js — the helper half of the shared print kit (Path 7 P1).
   _shared/print-kit.css holds the classes; read its header first.

   What is here:

     PrintKit.setPage({ paper, orientation, margin })
       Writes one `@page` rule and the --pk-page-w / --pk-page-h / --pk-margin
       properties print-kit.css sizes its half and quarter sheets from, in one
       call, so the two cannot disagree.

     PrintKit.setHeader({ class, date, title })
       Remembers the three fields and fills every `.pk-header` on the page.
       renderSet() gives each sheet its own header from the same fields.

     PrintKit.renderSet(container, template, { mode, roster, count, sheet })
       The "print one / a class set / blanks" trio from a single template.
       `mode: 'one'` is one named sheet, `'set'` one per student, `'blank'` is
       `count` sheets with a write-in rule where the name would be.
       `cut: true` draws the cut line between the two half sheets of a page.

     PrintKit.renderCards(container, items, preset, buildCard)
       A card grid from a list: one `.pk-cards.pk-page` per page of a preset
       ('3x3'), each card a share of the page; or, for `{ cols: 3 }`, one grid
       of cards whose height is the tool's own, running on over the pages.

     PrintKit.plan(), chunk(), cardPlan(), inkClass(), pageCss(), PAPERS, PRESETS
       The pure parts of the above, which is what the Node suite tests.

   THE ROSTER IS HANDED IN, NOT FETCHED. `roster` is an array of names, or of
   the student records `Roster.getStudents()` returns (anything with a `name`,
   and a `preferred` name wins when there is one). This file does not read
   storage and does not depend on roster.js or store.js, so a page with no
   roster can still print blanks.

   EVERY VALUE REACHES THE PAGE THROUGH textContent. A student's name, a class
   name and a title are all strings a teacher typed or a share link carried;
   none of them is ever parsed as markup. A template is cloned, never built
   from a string.

   Plain global script, not an ES module, for the reason store.js gives: half
   the site's tools are classic scripts and one file cannot be both. */
(function (global) {
  'use strict';

  /* Paper sizes, portrait, in CSS units. `size` is the @page keyword. */
  var PAPERS = {
    letter: { w: '8.5in', h: '11in', size: 'letter' },
    legal:  { w: '8.5in', h: '14in', size: 'legal' },
    a4:     { w: '210mm', h: '297mm', size: 'A4' },
    a5:     { w: '148mm', h: '210mm', size: 'A5' }
  };

  /* The card-grid presets in print-kit.css. `cls` goes beside `pk-cards`. */
  var PRESETS = {
    '2x2':  { cols: 2, rows: 2,  perPage: 4,  cls: 'pk-cards-2x2',  note: 'quarter-page cards' },
    '2x3':  { cols: 2, rows: 3,  perPage: 6,  cls: 'pk-cards-2x3',  note: 'six per page' },
    '3x3':  { cols: 3, rows: 3,  perPage: 9,  cls: 'pk-cards-3x3',  note: 'trading-card size' },
    '2x4':  { cols: 2, rows: 4,  perPage: 8,  cls: 'pk-cards-2x4',  note: 'flashcards' },
    '4x3':  { cols: 4, rows: 3,  perPage: 12, cls: 'pk-cards-4x3',  note: 'narrow reference cards' },
    '2x5':  { cols: 2, rows: 5,  perPage: 10, cls: 'pk-cards-2x5',  note: 'business cards, 2 x 3.5 in' },
    '3x10': { cols: 3, rows: 10, perPage: 30, cls: 'pk-cards-3x10', note: 'address labels, 1 x 2.625 in' }
  };

  var SHEETS = { page: 'pk-page', half: 'pk-half', quarter: 'pk-quarter' };
  var HATCHES = 6;
  var BORDERS = ['pk-ink-solid', 'pk-ink-dashed', 'pk-ink-dotted', 'pk-ink-double'];
  var MAX_SHEETS = 400;   // Roster's own ceiling for one class
  var STYLE_ID = 'pk-page-style';

  var header = { class: '', date: '', title: '' };

  function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  /* A margin is a CSS length the caller typed. Anything that is not a plain
     number-and-unit falls back to the default rather than reaching a style
     sheet. */
  function cleanMargin(m) {
    if (typeof m === 'number' && isFinite(m) && m >= 0) return m + 'in';
    var s = text(m).toLowerCase();
    return /^\d*\.?\d+(in|mm|cm|pt|px)$/.test(s) ? s : '0.5in';
  }

  /** The resolved page: { paper, orientation, w, h, margin, css }. Pure. */
  function pageCss(opts) {
    opts = opts || {};
    var key = PAPERS[text(opts.paper).toLowerCase()] ? text(opts.paper).toLowerCase() : 'letter';
    var p = PAPERS[key];
    var landscape = text(opts.orientation).toLowerCase() === 'landscape';
    var margin = cleanMargin(opts.margin === undefined ? '0.5in' : opts.margin);
    return {
      paper: key,
      orientation: landscape ? 'landscape' : 'portrait',
      w: landscape ? p.h : p.w,
      h: landscape ? p.w : p.h,
      margin: margin,
      css: '@page { size: ' + p.size + ' ' + (landscape ? 'landscape' : 'portrait') + '; margin: ' + margin + '; }'
    };
  }

  /** Writes the @page rule and the matching custom properties. */
  function setPage(opts) {
    var page = pageCss(opts);
    var doc = global.document;
    if (!doc) return page;
    var el = doc.getElementById(STYLE_ID);
    if (!el) {
      el = doc.createElement('style');
      el.id = STYLE_ID;
      doc.head.appendChild(el);
    }
    el.textContent = page.css;
    var root = doc.documentElement.style;
    root.setProperty('--pk-page-w', page.w);
    root.setProperty('--pk-page-h', page.h);
    root.setProperty('--pk-margin', page.margin);
    return page;
  }

  /** One student's display name from a string or a roster record. */
  function nameOf(entry) {
    if (entry && typeof entry === 'object') return text(entry.preferred) || text(entry.name);
    return text(entry);
  }

  /** The sheets a print run is made of: [{ name, blank, n, of }]. Pure.
      mode 'one'   — one sheet for `name` (or the first of `roster`).
      mode 'set'   — one per roster entry, blank names dropped.
      mode 'blank' — `count` sheets with no name; defaults to the roster's
                     size, or 1 with no roster. */
  function plan(opts) {
    opts = opts || {};
    var mode = opts.mode === 'set' || opts.mode === 'blank' ? opts.mode : 'one';
    var names = (Array.isArray(opts.roster) ? opts.roster : []).map(nameOf).filter(Boolean).slice(0, MAX_SHEETS);
    var out = [];
    if (mode === 'set') {
      out = names.map(function (n) { return { name: n, blank: false }; });
    } else if (mode === 'blank') {
      var want = Math.floor(Number(opts.count));
      if (!(want >= 1)) want = names.length || 1;
      want = Math.min(want, MAX_SHEETS);
      for (var i = 0; i < want; i++) out.push({ name: '', blank: true });
    } else {
      var one = text(opts.name) || names[0] || '';
      out = [{ name: one, blank: !one }];
    }
    out.forEach(function (s, idx) { s.n = idx + 1; s.of = out.length; });
    return out;
  }

  /** Splits items into pages of perPage (a preset name or a number). Pure. */
  function chunk(items, perPage) {
    var size = PRESETS[perPage] ? PRESETS[perPage].perPage : Math.floor(Number(perPage));
    if (!(size >= 1)) size = 1;
    var pages = [];
    for (var i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
    return pages;
  }

  /** The ink-safe classes for category i: a hatch, and a border style that
      changes each time the hatches wrap, so 24 categories stay distinct. Pure. */
  function inkClass(i) {
    var n = Math.max(0, Math.floor(Number(i)) || 0);
    return 'pk-hatch-' + (n % HATCHES + 1) + ' ' + BORDERS[Math.floor(n / HATCHES) % BORDERS.length];
  }

  function span(doc, cls, value) {
    var el = doc.createElement('span');
    el.className = cls;
    el.textContent = value;
    return el;
  }

  function fillHeader(el, fields) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var doc = el.ownerDocument;
    el.appendChild(span(doc, 'pk-h-title', fields.title));
    el.appendChild(span(doc, 'pk-h-class', fields.class));
    el.appendChild(span(doc, 'pk-h-date', fields.date));
  }

  /** Stores the header fields and fills every .pk-header already on the page.
      A field left out keeps its last value; pass '' to clear one. */
  function setHeader(fields) {
    fields = fields || {};
    ['class', 'date', 'title'].forEach(function (k) {
      if (fields[k] !== undefined) header[k] = text(fields[k]);
    });
    var doc = global.document;
    if (doc) {
      var all = doc.querySelectorAll('.pk-header');
      for (var i = 0; i < all.length; i++) fillHeader(all[i], header);
    }
    return getHeader();
  }

  function getHeader() { return { class: header.class, date: header.date, title: header.title }; }

  /* Fills a cloned sheet's `data-pk` slots: name, n, of, count ("3 of 28"),
     class, date, title. A blank sheet's name slot becomes a write-in rule. */
  function fillSlots(root, sheet) {
    var values = {
      name: sheet.name, n: String(sheet.n), of: String(sheet.of),
      count: sheet.n + ' of ' + sheet.of,
      class: header.class, date: header.date, title: header.title
    };
    var slots = root.querySelectorAll('[data-pk]');
    for (var i = 0; i < slots.length; i++) {
      var key = slots[i].getAttribute('data-pk');
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      slots[i].textContent = values[key];
      if (key === 'name') slots[i].classList.toggle('pk-blank-line', sheet.blank);
    }
  }

  /** Renders the planned sheets into `container`, replacing what was there.
      `template` is a <template> element (cloned once per sheet, its `data-pk`
      slots filled) or a function (sheet) -> Node. Each sheet is wrapped in a
      <section> carrying the sheet class for opts.sheet: 'page' (default),
      'half' or 'quarter'. opts.header / opts.footer (default true for a full
      page, false for the smaller sheets) add the kit's header and an
      "N of M" footer. opts.cut (half sheets only) puts `.pk-cut` on the upper
      sheet of each pair, the 1st, 3rd, 5th: a line across the middle of the
      page to cut along, and none along its foot. It goes by position, so a
      half sheet that outgrows half a page keeps its line. Returns the plan. */
  function renderSet(container, template, opts) {
    opts = opts || {};
    var doc = container.ownerDocument;
    var sheets = plan(opts);
    var kind = SHEETS[opts.sheet] ? opts.sheet : 'page';
    var chrome = kind === 'page';
    var wantHeader = opts.header === undefined ? chrome : !!opts.header;
    var wantFooter = opts.footer === undefined ? chrome : !!opts.footer;
    var wantCut = !!opts.cut && kind === 'half';

    while (container.firstChild) container.removeChild(container.firstChild);
    container.classList.toggle('pk-quarters', kind === 'quarter');

    sheets.forEach(function (sheet) {
      var section = doc.createElement('section');
      section.className = SHEETS[kind] + ' pk-sheet';
      if (sheet.blank) section.classList.add('pk-sheet-blank');
      if (wantCut && sheet.n % 2 === 1) section.classList.add('pk-cut');
      if (wantHeader) {
        var head = doc.createElement('div');
        head.className = 'pk-header';
        fillHeader(head, header);
        section.appendChild(head);
      }
      var body = typeof template === 'function' ? template(sheet) : doc.importNode(template.content, true);
      if (body) section.appendChild(body);
      fillSlots(section, sheet);
      if (wantFooter) {
        var foot = doc.createElement('div');
        foot.className = 'pk-footer';
        foot.appendChild(span(doc, 'pk-f-name', sheet.name));
        foot.appendChild(span(doc, 'pk-f-count', sheet.of > 1 ? sheet.n + ' of ' + sheet.of : ''));
        section.appendChild(foot);
      }
      container.appendChild(section);
    });
    return sheets;
  }

  /** How a list of cards is laid out: { cols, cls, own, pages }. Pure.
      `preset` is a PRESETS name: pages of that preset's perPage, each card a
      share of the printable page (print-kit.css's rows). Or it is an object,
      for a grid of the tool's own: { cols } across, the card's height left to
      the tool's CSS (`pk-cards-own`), and { perPage } items to a page; with
      no perPage the list is one grid that runs on over as many pages as it
      needs, breaking between rows. A name the kit does not know is '2x2',
      which is what print-kit.css draws for a grid with no preset class. */
  function cardPlan(items, preset) {
    items = Array.isArray(items) ? items : [];
    if (preset && typeof preset === 'object') {
      var cols = Math.floor(Number(preset.cols));
      if (!(cols >= 1)) cols = 2;
      var per = Math.floor(Number(preset.perPage));
      return {
        cols: cols, cls: 'pk-cards-own', own: true,
        pages: per >= 1 ? chunk(items, per) : (items.length ? [items.slice()] : [])
      };
    }
    var p = PRESETS[preset] || PRESETS['2x2'];
    return { cols: p.cols, cls: p.cls, own: false, pages: chunk(items, p.perPage) };
  }

  /** Renders `items` as card grids into `container`, replacing what was
      there: one `div.pk-cards.pk-page` per page of cardPlan(items, preset).
      `buildCard(item, index)` returns the card's node, which gets `.pk-card`;
      a falsy return is skipped. Returns the pages, as arrays of items. */
  function renderCards(container, items, preset, buildCard) {
    var doc = container.ownerDocument;
    var layout = cardPlan(items, preset);
    var index = 0;
    while (container.firstChild) container.removeChild(container.firstChild);
    layout.pages.forEach(function (group) {
      var grid = doc.createElement('div');
      grid.className = 'pk-cards pk-page ' + layout.cls;
      if (layout.own) grid.style.setProperty('--pk-cols', String(layout.cols));
      group.forEach(function (item) {
        var card = buildCard(item, index++);
        if (!card) return;
        card.classList.add('pk-card');
        grid.appendChild(card);
      });
      container.appendChild(grid);
    });
    return layout.pages;
  }

  global.PrintKit = {
    PAPERS: PAPERS,
    PRESETS: PRESETS,
    pageCss: pageCss,
    setPage: setPage,
    setHeader: setHeader,
    getHeader: getHeader,
    plan: plan,
    chunk: chunk,
    inkClass: inkClass,
    renderSet: renderSet,
    cardPlan: cardPlan,
    renderCards: renderCards
  };
})(window);
