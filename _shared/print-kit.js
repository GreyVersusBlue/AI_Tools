/* print-kit.js — the helper half of the shared print kit (Path 7 P1).
   _shared/print-kit.css holds the classes; read its header first.

   What is here:

     PrintKit.setPage({ paper, orientation, margin })
       Writes one `@page` rule and the --pk-page-w / --pk-page-h / --pk-margin
       properties print-kit.css sizes its half and quarter sheets from, in one
       call, so the two cannot disagree. `margin` is one length, or two (since
       v242, for label stock): top and bottom, then the sides, which go into
       --pk-margin and --pk-margin-x.

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

     PrintKit.preview({ area, trigger, onPrint, title })
       The print preview (Path 7 P5, v258): a modal dialog that shows the
       sheet cut into pages at the size setPage() set, one page at a time,
       with "Page 2 of 5", and opens no print dialog. See PREVIEW below.

     PrintKit.plan(), chunk(), cardPlan(), inkClass(), pageCss(), PAPERS, PRESETS,
     pageBox(), flipMedia(), pageOf(), countPages(), fitScale()
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
  var current = null;     // the page setPage() last wrote; the preview draws it

  function text(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  /* A margin is a CSS length the caller typed, or two of them: top and bottom,
     then the sides, which is what label stock needs (016's Avery sheets are
     half an inch down and 3/16 in). Anything that is not one or two plain
     number-and-unit lengths falls back to the default rather than reaching a
     style sheet. */
  function cleanMargin(m) {
    if (typeof m === 'number' && isFinite(m) && m >= 0) return m + 'in';
    var s = text(m).toLowerCase().replace(/\s+/g, ' ');
    return /^\d*\.?\d+(in|mm|cm|pt|px)( \d*\.?\d+(in|mm|cm|pt|px))?$/.test(s) ? s : '0.5in';
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
    if (!doc) { current = page; return page; }
    var el = doc.getElementById(STYLE_ID);
    if (!el) {
      el = doc.createElement('style');
      el.id = STYLE_ID;
      doc.head.appendChild(el);
    }
    el.textContent = page.css;
    current = page;
    var root = doc.documentElement.style;
    root.setProperty('--pk-page-w', page.w);
    root.setProperty('--pk-page-h', page.h);
    var sides = page.margin.split(' ');
    root.setProperty('--pk-margin', sides[0]);
    if (sides[1]) root.setProperty('--pk-margin-x', sides[1]);
    else root.removeProperty('--pk-margin-x');
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

  /* ---- PREVIEW (Path 7 P5) ------------------------------------------------

     WHERE THE BREAKS COME FROM. No browser reports where it will break a
     page, so the preview does not work them out: it has the browser's own
     fragmentation do it. A copy of the sheet goes into an <iframe> whose
     <body> is a multi-column box, each column the printable page (the paper
     less the @page margin), so the engine that breaks pages in print breaks
     columns here, with `break-inside: avoid`, grid rows and line boxes handled
     as it handles them on paper. Measured against Chromium's PDF on 043, 074,
     051 and 042 (2026-10-06, BACKLOG.md Path 7 P5 has the table): the same
     page count in every state. A walk over the laid-out boxes that cut them
     by height was tried beside it and was wrong where a margin or a grid gap
     meets a break, which the engine drops and a measurement cannot see.

     HOW THE PRINT RULES APPLY ON SCREEN. The frame links the page's own style
     sheets and copies its <style> elements, then rewrites every media query
     in the frame's copy (flipMedia): `print` becomes `all`, `screen` never
     matches. Nothing in the page itself is touched, which is why the printed
     output cannot change.

     WHAT THE FRAME CHANGES, because columns are not pages: a forced
     `break-after/before: page` becomes `column`, `break-inside: avoid-page`
     becomes `avoid`, a <thead> is repeated by hand at the top of each page its
     table runs on to (print does that; columns do not), and the sheet is
     `position: static` at the top of a <body> with no margin. A <canvas> is
     redrawn from the live one, since a clone comes out empty.

     KNOWN DIFFERENCES FROM PAPER. A fill the print dialog drops unless
     "background graphics" is ticked is shown. A card taller than a page is
     sliced at a slightly different line. A page whose @page rule was not
     written by setPage() is previewed as the last page setPage() wrote, or
     Letter. Only Chromium was measured. */

  var UNIT_PX = { 'in': 96, mm: 96 / 25.4, cm: 96 / 2.54, pt: 96 / 72, px: 1 };
  var PREVIEW_GAP = 400;  // px between columns: far more than any sheet overflows sideways
  var ROOT_ATTR = 'data-pk-preview-root';
  var openPreview = null;

  function lenPx(len) {
    var m = /^(\d*\.?\d+)(in|mm|cm|pt|px)$/.exec(text(len).toLowerCase());
    return m ? parseFloat(m[1]) * UNIT_PX[m[2]] : NaN;
  }

  /** A page in CSS px: the paper (w, h), its margins (top, side) and the
      printable box (areaW, areaH). Takes what setPage() takes. Pure. */
  function pageBox(opts) {
    var page = pageCss(opts);
    var sides = page.margin.split(' ');
    var top = lenPx(sides[0]), side = lenPx(sides[1] || sides[0]);
    var w = lenPx(page.w), h = lenPx(page.h);
    return {
      paper: page.paper, orientation: page.orientation, w: w, h: h, top: top, side: side,
      areaW: Math.max(1, w - 2 * side), areaH: Math.max(1, h - 2 * top)
    };
  }

  /** A media query list as the preview applies it, so that what matches on
      paper matches in the frame: `print` reads `all`, a `screen` query is
      dropped, and a list with nothing left is `not all`. Pure. */
  function flipMedia(mediaText) {
    var kept = text(mediaText).toLowerCase().split(',').map(function (q) { return q.trim(); }).filter(Boolean)
      .map(function (q) {
        if (/^not\s+print\b/.test(q)) return '';
        if (/^not\s+screen\b/.test(q)) return 'all';
        if (/^(only\s+)?screen\b/.test(q)) return '';
        return q.replace(/^(only\s+)?print\b/, 'all');
      }).filter(Boolean);
    if (!text(mediaText)) return 'all';
    return kept.length ? kept.join(', ') : 'not all';
  }

  /** The page (from 0) a box starting `left` px into the frame is on. Pure. */
  function pageOf(left, pitch) {
    var n = Math.floor((Number(left) + 0.5) / pitch);
    return n > 0 ? n : 0;
  }

  /** How many pages the boxes with these left edges take; at least 1. Pure. */
  function countPages(lefts, pitch) {
    var last = 0;
    for (var i = 0; i < lefts.length; i++) last = Math.max(last, pageOf(lefts[i], pitch));
    return last + 1;
  }

  /** The scale that shows a w x h paper whole in the room there is, never
      enlarged, and never so small it is a smudge. Pure. */
  function fitScale(w, h, roomW, roomH) {
    var s = Math.min(1, roomW / w, roomH / h);
    return s > 0.1 ? s : 0.1;
  }

  function make(doc, tag, cls, value) {
    var el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = value;
    return el;
  }

  function attr(v) { return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* Rewrites every media query in a style sheet of the frame, and in what it imports. */
  function flipSheet(sheet) {
    var rules;
    try { rules = sheet.cssRules; } catch (e) { return; }
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.media && (r.cssRules || r.styleSheet)) r.media.mediaText = flipMedia(r.media.mediaText);
      if (r.styleSheet) flipSheet(r.styleSheet);
      if (r.cssRules) flipSheet(r);
    }
  }

  /* Lays the sheet out in the frame's document; resolves to the page count. */
  function layOut(frame, area, box) {
    var doc = area.ownerDocument;
    var d = frame.contentDocument;
    var waits = [];
    var sheets = doc.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var node = sheets[i].ownerNode;
      if (!node || !node.tagName) continue;
      var media = flipMedia(node.getAttribute('media'));
      if (media === 'not all') continue;
      var copy;
      if (node.tagName.toLowerCase() === 'link') {
        copy = d.createElement('link');
        copy.rel = 'stylesheet';
        waits.push(new Promise(function (done) { copy.onload = copy.onerror = done; }));
        copy.href = node.href;
      } else {
        copy = d.createElement('style');
        copy.textContent = node.textContent;
      }
      if (media !== 'all') copy.media = media;
      d.head.appendChild(copy);
    }
    return Promise.all(waits).then(function () {
      for (var s = 0; s < d.styleSheets.length; s++) flipSheet(d.styleSheets[s]);
      var own = d.createElement('style');
      own.textContent =
        'html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }' +
        'html { overflow: hidden !important; }' +
        'body { display: block !important; position: static !important; box-sizing: content-box !important;' +
        ' width: ' + box.areaW + 'px !important; max-width: none !important; min-height: 0 !important;' +
        ' height: ' + box.areaH + 'px !important; overflow: visible !important;' +
        ' column-width: ' + box.areaW + 'px !important; column-gap: ' + PREVIEW_GAP + 'px !important; column-fill: auto !important; }' +
        '[' + ROOT_ATTR + '] { position: static !important; }';
      d.head.appendChild(own);

      var from = doc.documentElement, to = d.documentElement;
      for (var a = 0; a < from.attributes.length; a++) to.setAttribute(from.attributes[a].name, from.attributes[a].value);
      d.body.className = doc.body.className;

      var sheet = d.importNode(area, true);
      sheet.setAttribute(ROOT_ATTR, '');
      d.body.appendChild(sheet);
      var live = area.querySelectorAll('canvas'), drawn = sheet.querySelectorAll('canvas');
      for (var c = 0; c < live.length && c < drawn.length; c++) {
        try { if (live[c].width && live[c].height) drawn[c].getContext('2d').drawImage(live[c], 0, 0); } catch (e) { /* a tainted canvas stays blank */ }
      }

      var pending = [];
      var imgs = sheet.querySelectorAll('img');
      for (var m = 0; m < imgs.length; m++) {
        if (!imgs[m].complete) pending.push(new Promise(function (done) { imgs[m].onload = imgs[m].onerror = done; }));
      }
      if (d.fonts && d.fonts.ready) pending.push(d.fonts.ready);
      var patience = new Promise(function (done) { global.setTimeout(done, 3000); });
      return Promise.race([Promise.all(pending), patience]).then(function () { return paginate(d, sheet); });
    });
  }

  /* Turns page breaks into column breaks, repeats table headers, and counts. */
  function paginate(d, sheet) {
    var view = d.defaultView;
    var pitch = sheet.parentNode.getBoundingClientRect().width + PREVIEW_GAP;
    var all = sheet.querySelectorAll('*');
    var forced = /^(page|always|left|right|recto|verso)$/;
    var i;
    for (i = 0; i < all.length; i++) {
      var cs = view.getComputedStyle(all[i]);
      if (forced.test(cs.breakAfter)) all[i].style.setProperty('break-after', 'column', 'important');
      if (forced.test(cs.breakBefore)) all[i].style.setProperty('break-before', 'column', 'important');
      if (cs.breakInside === 'avoid-page') all[i].style.setProperty('break-inside', 'avoid', 'important');
    }
    function column(el) {
      var r = el.getClientRects()[0];
      return r ? pageOf(r.left, pitch) : -1;
    }
    var tables = sheet.querySelectorAll('table');
    for (i = 0; i < tables.length; i++) {
      var head = tables[i].tHead;
      if (!head || !head.rows.length) continue;
      var on = column(head.rows[0]);
      var rows = tables[i].querySelectorAll(':scope > tbody > tr');
      for (var r = 0; r < rows.length; r++) {
        var at = column(rows[r]);
        if (at > on) {
          for (var h = 0; h < head.rows.length; h++) {
            var again = head.rows[h].cloneNode(true);
            again.setAttribute('aria-hidden', 'true');
            rows[r].parentNode.insertBefore(again, rows[r]);
          }
          at = column(rows[r]);
        }
        if (at >= 0) on = at;
      }
    }
    var lefts = [];
    all = sheet.querySelectorAll('*');
    for (i = 0; i < all.length; i++) {
      var rects = all[i].getClientRects();
      for (var k = 0; k < rects.length; k++) if (rects[k].width || rects[k].height) lefts.push(rects[k].left);
    }
    return { pages: countPages(lefts, pitch), pitch: pitch };
  }

  /** Opens the print preview: a modal dialog showing `opts.area` (default
      #printArea) as the pages it will print on, at the page setPage() wrote.
      The sheet must already be built; the preview shows what is there and
      changes nothing in it. `opts.trigger` gets the focus back on close
      (default: what had it). `opts.onPrint`, if given, adds a Print button
      that closes the preview and calls it. Resolves, once the pages are laid
      out, to { dialog, frame, pages, page, go(n), close() }. Never calls
      print(). */
  function preview(opts) {
    opts = opts || {};
    var doc = global.document;
    var area = opts.area || doc.getElementById('printArea');
    if (openPreview) openPreview.close();
    var box = pageBox(current || {});
    var trigger = opts.trigger || doc.activeElement;
    var state = { pages: 1, page: 1, pitch: box.areaW + PREVIEW_GAP, closed: false };
    var settled = function () {};

    var dialog = make(doc, 'dialog', 'pk-preview pk-no-print');
    dialog.setAttribute('aria-labelledby', 'pk-preview-title');
    var bar = make(doc, 'div', 'pk-preview-bar');
    var title = make(doc, 'h2', 'pk-preview-title', text(opts.title) || 'Print preview');
    title.id = 'pk-preview-title';
    var status = make(doc, 'p', 'pk-preview-status', 'Laying out the pages…');
    status.setAttribute('role', 'status');
    var nav = make(doc, 'div', 'pk-preview-nav');
    function button(cls, label) {
      var b = make(doc, 'button', cls, label);
      b.type = 'button';
      nav.appendChild(b);
      return b;
    }
    var prev = button('pk-preview-prev secondary', 'Previous page');
    var next = button('pk-preview-next secondary', 'Next page');
    var print = typeof opts.onPrint === 'function' ? button('pk-preview-print', 'Print…') : null;
    var close = button('pk-preview-close secondary', 'Close');
    bar.appendChild(title); bar.appendChild(status); bar.appendChild(nav);

    var stage = make(doc, 'div', 'pk-preview-stage');
    var fit = make(doc, 'div', 'pk-preview-fit');
    var paper = make(doc, 'div', 'pk-preview-sheet');
    var frame = make(doc, 'iframe', 'pk-preview-frame');
    frame.setAttribute('tabindex', '-1');
    frame.title = 'The sheet as it will print';
    /* The paper is drawn here and not in print-kit.css, which holds no fixed
       height and no colour but the ink-safe black and white. The frame is a
       whole number of px, so `100vh` in it is never more than the page. */
    paper.style.cssText = 'width:' + box.w + 'px;height:' + box.h + 'px;background:#fff;';
    frame.style.cssText = 'left:' + box.side + 'px;top:' + box.top + 'px;width:' + Math.floor(box.areaW) + 'px;height:' + Math.floor(box.areaH) + 'px;';
    paper.appendChild(frame); fit.appendChild(paper); stage.appendChild(fit);
    dialog.appendChild(bar); dialog.appendChild(stage);

    function size() {
      var view = doc.documentElement;
      stage.style.height = Math.max(160, Math.floor(view.clientHeight * 0.92) - bar.offsetHeight - 4) + 'px';
      var pad = 32;
      var s = fitScale(box.w, box.h, stage.clientWidth - pad, stage.clientHeight - pad);
      paper.style.transform = 'scale(' + s + ')';
      fit.style.width = box.w * s + 'px';
      fit.style.height = box.h * s + 'px';
    }
    function show() {
      var body = frame.contentDocument && frame.contentDocument.body;
      if (body) body.style.transform = 'translateX(' + -(state.page - 1) * state.pitch + 'px)';
      status.textContent = 'Page ' + state.page + ' of ' + state.pages;
      prev.setAttribute('aria-disabled', String(state.page <= 1));
      next.setAttribute('aria-disabled', String(state.page >= state.pages));
      dialog.setAttribute('data-pk-page', String(state.page));
    }
    function go(n) {
      var to = Math.min(state.pages, Math.max(1, Math.floor(Number(n)) || 1));
      if (to !== state.page) { state.page = to; show(); }
      return state.page;
    }
    /* Idempotent: Escape reaches it through the dialog's close event, the
       buttons and close() call it directly, so the dialog is gone at once. */
    function shut() {
      if (state.closed) return;
      state.closed = true;
      global.removeEventListener('resize', size);
      if (dialog.open) dialog.close();
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      if (openPreview === control) openPreview = null;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
      settled(control);
    }

    prev.addEventListener('click', function () { go(state.page - 1); });
    next.addEventListener('click', function () { go(state.page + 1); });
    close.addEventListener('click', shut);
    if (print) print.addEventListener('click', function () { shut(); opts.onPrint(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var to = { ArrowLeft: state.page - 1, PageUp: state.page - 1, ArrowRight: state.page + 1, PageDown: state.page + 1, Home: 1, End: state.pages }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      go(to);
    });
    global.addEventListener('resize', size);
    dialog.addEventListener('close', shut);

    var control = {
      dialog: dialog, frame: frame, go: go, close: shut,
      get pages() { return state.pages; },
      get page() { return state.page; }
    };
    openPreview = control;

    return new Promise(function (resolve) {
      /* A preview closed before its pages were laid out still resolves. */
      settled = resolve;
      frame.addEventListener('load', function () {
        layOut(frame, area, box).then(function (laid) {
          if (state.closed) return;
          state.pages = laid.pages;
          state.pitch = laid.pitch;
          dialog.setAttribute('data-pk-pages', String(laid.pages));
          show();
          resolve(control);
        }, function () {
          status.textContent = 'The preview could not be drawn.';
          resolve(control);
        });
      }, { once: true });
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + attr(doc.baseURI) + '"></head><body></body></html>';
      doc.body.appendChild(dialog);
      dialog.showModal();
      size();
      close.focus();
    });
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
    renderCards: renderCards,
    pageBox: pageBox,
    flipMedia: flipMedia,
    pageOf: pageOf,
    countPages: countPages,
    fitScale: fitScale,
    preview: preview
  };
})(window);
