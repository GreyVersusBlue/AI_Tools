/* Timeline Builder — layout math.
   Pure functions, no DOM, so positioning/sorting/formatting can be
   unit-tested before any UI touches them.

   Scope decisions (flagged per the build spec):
   - Multiple parallel/comparison tracks are supported by repeating this same
     layout math once per track (each event carries a `track` id; the caller
     filters state.events per track and calls computeLayout with a shared
     `rangeOverride` so every lane lines up on one common year axis).
   - Date precision: every event needs a numeric `yearStart` (negative for
     BCE) so events can always be sorted/positioned even when the display
     text is an approximate era. `displayDate` overrides the auto-formatted
     label when set, so "Late Bronze Age" or "c. 1200 BCE" can be shown
     instead of a bare number while `yearStart` still drives the position. */
(function (global) {
  'use strict';

  function formatYear(year) {
    var y = Math.round(year);
    return y < 0 ? (Math.abs(y) + ' BCE') : String(y);
  }

  function formatDateLabel(event) {
    if (event.displayDate) return event.displayDate;
    if (event.yearEnd != null && event.yearEnd !== event.yearStart) {
      return formatYear(event.yearStart) + '–' + formatYear(event.yearEnd);
    }
    return formatYear(event.yearStart);
  }

  function yearRangeOf(events) {
    var years = [];
    events.forEach(function (e) {
      years.push(e.yearStart);
      if (e.yearEnd != null) years.push(e.yearEnd);
    });
    return { min: Math.min.apply(null, years), max: Math.max.apply(null, years) };
  }

  /** A reasonable default zoom level so short spans aren't squished and long
   * spans (centuries/millennia) don't produce an absurdly wide canvas. */
  function autoPxPerYear(minYear, maxYear) {
    var span = Math.max(1, maxYear - minYear);
    var target = 1800; // aim for roughly this many px of usable timeline width
    var px = target / span;
    return Math.max(2, Math.min(120, px));
  }

  /**
   * Normalizes a year to a 0..1 position within [minYear, maxYear] for a
   * given scale mode.
   *
   * 'linear' (default, existing behavior) is the plain proportional
   * mapping: equal years always get equal pixels, everywhere on the axis.
   *
   * 'compressed' gives progressively more room to years near maxYear (the
   * recent end) and compresses years near minYear (the ancient end), via a
   * log1p transform of `e` = "years before the end of the range" — years
   * ago, in other words. A raw `Math.log(year)` was *not* used for this:
   * `year` itself crosses zero and goes negative for BCE dates, where a log
   * is undefined or discontinuous, so the transform is deliberately anchored
   * to a nonnegative "distance from the recent end" instead, which works
   * identically whether that end is 2020 CE or 200 BCE.
   *
   * This is a strictly increasing function of `year` for any span > 0 (e
   * strictly decreases as year increases, log1p is strictly increasing, so
   * the composition is strictly increasing) — meaning distinct years always
   * produce distinct, correctly-ordered positions under compression exactly
   * as they do under linear scaling. Compression changes *spacing*; it can
   * never change *order*.
   */
  function yearToUnit(year, minYear, maxYear, scaleMode) {
    var span = maxYear - minYear;
    if (span <= 0) return 0;
    if (scaleMode !== 'compressed') return (year - minYear) / span;
    var e = Math.min(span, Math.max(0, maxYear - year));
    var logSpan = Math.log1p(span);
    if (logSpan <= 0) return 0;
    return (logSpan - Math.log1p(e)) / logSpan;
  }

  /**
   * Maps a year to an x pixel coordinate along [minYear, maxYear], using
   * `yearToUnit` so computeLayout/computeGridlines/computeEraBands always
   * agree on where a given year falls, in either scale mode. The usable
   * pixel width (`(maxYear - minYear) * pxPerYear`) is the same regardless
   * of scale mode — compression redistributes pixels *within* that width
   * rather than changing the overall canvas size, so switching scale modes
   * doesn't also resize the scroll area out from under the reader.
   */
  function yearToX(year, minYear, maxYear, pxPerYear, padding, scaleMode) {
    var usableWidth = Math.max(0, maxYear - minYear) * pxPerYear;
    return padding + yearToUnit(year, minYear, maxYear, scaleMode) * usableWidth;
  }

  /**
   * Position every event along the horizontal axis. Events are sorted by
   * yearStart. Point events get an x coordinate; range events (yearEnd set)
   * get x + width. `padding` is extra px on each end so the first/last
   * marker isn't flush against the container edge.
   *
   * `rangeOverride` (optional {min, max}) lets a caller force the min/max
   * year the layout is computed against instead of deriving it from
   * `events` alone — used so era bands that extend beyond the events'
   * own year range still share one consistent axis with the markers,
   * gridlines, and total canvas width instead of drifting out of sync.
   *
   * `scaleMode` (optional, 'linear' | 'compressed') — defaults to 'linear'
   * (today's plain proportional behavior) whenever omitted, so every
   * existing caller and every already-saved timeline renders exactly as it
   * always has unless a caller opts into 'compressed'.
   */
  function computeLayout(events, pxPerYear, padding, rangeOverride, scaleMode) {
    var pad = padding == null ? 60 : padding;
    var mode = scaleMode === 'compressed' ? 'compressed' : 'linear';
    if (!events.length) {
      if (rangeOverride) {
        var emptySpan = Math.max(0, rangeOverride.max - rangeOverride.min);
        return {
          positioned: [],
          totalWidth: Math.max(pad * 2 + emptySpan * pxPerYear, pad * 2 + 1),
          minYear: rangeOverride.min, maxYear: rangeOverride.max
        };
      }
      return { positioned: [], totalWidth: pad * 2, minYear: 0, maxYear: 0 };
    }

    var range = rangeOverride || yearRangeOf(events);
    var sorted = events.slice().sort(function (a, b) { return a.yearStart - b.yearStart; });

    var positioned = sorted.map(function (e) {
      var x = yearToX(e.yearStart, range.min, range.max, pxPerYear, pad, mode);
      var width = 0;
      if (e.yearEnd != null) {
        var xEnd = yearToX(e.yearEnd, range.min, range.max, pxPerYear, pad, mode);
        width = Math.max(2, xEnd - x);
      }
      return {
        event: e, x: x, width: width,
        label: formatDateLabel(e)
      };
    });

    var totalWidth = pad * 2 + (range.max - range.min) * pxPerYear;
    return { positioned: positioned, totalWidth: Math.max(totalWidth, pad * 2 + 1), minYear: range.min, maxYear: range.max };
  }

  /**
   * Picks a "clean" gridline interval (in years) based on the timeline's
   * total span, so a short span gets decade lines, a multi-century span
   * gets century lines, and an ancient-history span gets millennium lines.
   */
  function gridlineInterval(span) {
    if (span <= 200) return 10;
    if (span <= 400) return 25;
    if (span <= 1000) return 50;
    if (span <= 3000) return 100;
    if (span <= 10000) return 500;
    return 1000;
  }

  /**
   * Computes fixed gridline positions along the same x-axis as computeLayout
   * (same yearToX mapping), at every clean multiple of the auto-picked
   * interval that falls within [minYear, maxYear]. Kept as a separate pass
   * rather than folded into computeLayout since gridlines depend only on
   * the year range, not on individual events.
   *
   * `scaleMode` ('linear' | 'compressed', defaults to 'linear') — in
   * 'compressed' mode the same fixed year-interval that reads fine under
   * linear scaling would otherwise crowd together into unreadable clumps of
   * labels toward the compressed (ancient) end of the axis, where pixels
   * per year keep shrinking. So in compressed mode only, candidate ticks
   * that would land within `minGapPx` of the previous rendered tick are
   * skipped — thinning out exactly the region that's compressed, while the
   * expanded recent end (where consecutive ticks are naturally further
   * apart already) keeps its full density. Linear mode's tick selection is
   * untouched — same ticks, same positions, as before this existed.
   */
  function computeGridlines(minYear, maxYear, pxPerYear, padding, scaleMode) {
    var pad = padding == null ? 60 : padding;
    var span = Math.max(1, maxYear - minYear);
    var interval = gridlineInterval(span);
    var start = Math.ceil(minYear / interval) * interval;
    var mode = scaleMode === 'compressed' ? 'compressed' : 'linear';
    var minGapPx = mode === 'compressed' ? 30 : 0;
    var lines = [];
    var lastX = null;
    for (var year = start; year <= maxYear; year += interval) {
      var x = yearToX(year, minYear, maxYear, pxPerYear, pad, mode);
      if (minGapPx && lastX !== null && (x - lastX) < minGapPx) continue;
      lines.push({ year: year, x: x, label: formatYear(year) });
      lastX = x;
    }
    return lines;
  }

  /**
   * Computes background era/period band positions along the same x-axis as
   * computeLayout/computeGridlines (same yearToX mapping). Eras use the
   * same {yearStart, yearEnd} field names as events so a caller can fold
   * them straight into yearRangeOf() when sizing the shared axis. Bands are
   * clamped to [minYear, maxYear] so an era that runs past the edge of that
   * range still renders (clipped) rather than disappearing or skewing the
   * rest of the layout. `scaleMode` defaults to 'linear', same as
   * computeLayout/computeGridlines.
   */
  function computeEraBands(eras, minYear, maxYear, pxPerYear, padding, scaleMode) {
    var pad = padding == null ? 60 : padding;
    var mode = scaleMode === 'compressed' ? 'compressed' : 'linear';
    return (eras || []).map(function (era) {
      var lo = Math.min(era.yearStart, era.yearEnd);
      var hi = Math.max(era.yearStart, era.yearEnd);
      var start = Math.max(minYear, lo);
      var end = Math.min(maxYear, hi);
      var x = yearToX(start, minYear, maxYear, pxPerYear, pad, mode);
      var xEnd = yearToX(end, minYear, maxYear, pxPerYear, pad, mode);
      return { era: era, x: x, width: Math.max(2, xEnd - x) };
    });
  }

  /**
   * Assigns alternating above/below placement to reduce label collisions
   * when "compact" mode is on and events are close together. Two events
   * within `thresholdPx` of each other on the x-axis alternate sides.
   */
  function assignLabelSides(positioned, thresholdPx) {
    var threshold = thresholdPx == null ? 90 : thresholdPx;
    var lastX = null, side = 'above';
    return positioned.map(function (p) {
      if (lastX !== null && (p.x - lastX) < threshold) {
        side = side === 'above' ? 'below' : 'above';
      } else {
        side = 'above';
      }
      lastX = p.x;
      return Object.assign({}, p, { side: side });
    });
  }

  /**
   * Packs labels into stacked rows on one or both sides of the line so that
   * no two labels ever cover each other.
   *
   * This replaces side-alternation as the *collision* fix. Alternation only
   * ever bought two slots, so any third event within a label width — and,
   * far more commonly, any two events one or two years apart, which land
   * within a couple of pixels of each other — still printed one label on
   * top of another. Rows are unbounded, so a cluster degrades into a taller
   * stack rather than into unreadable overlap.
   *
   * Rows are used in preference to sliding labels along the axis, which was
   * the other obvious fix: a label is 9rem wide, so de-overlapping a cluster
   * of five by pushing them apart in x would move the outermost ones by
   * ~300px — far enough from their own marker that a leader line becomes
   * mandatory and the reader still has to trace it. Stacking keeps every
   * label centred over the marker it describes, which needs no leader line
   * and cannot mislead. The axis stays honest; only the vertical grows.
   *
   * `items` is [{x, w, h}] — centre x, width, height, all in px. Order is
   * irrelevant (they are sorted by x internally); the returned array is
   * parallel to `items` as given.
   *
   * `opts`:
   *   sides  — ['above'] or ['above','below'] (compact mode). Slots fill
   *            row 0 of every side before row 1 of any of them, so compact
   *            mode still alternates for the common two-event case and only
   *            grows a second row when a third label genuinely needs one.
   *   gapX   — minimum horizontal gap between two labels sharing a row.
   *   gapY   — vertical gap between rows.
   *   base   — px from the line to the near edge of a row-0 label.
   *
   * Returns [{side, row, offset, height}] where `offset` is the distance
   * from the line to that label's near edge. Row offsets are computed from
   * the tallest label actually placed in each row, so a row containing a
   * label with a photo pushes the next row clear of the photo rather than
   * of an assumed line count.
   */
  function packLabels(items, opts) {
    var o = opts || {};
    var sides = (o.sides && o.sides.length) ? o.sides : ['above'];
    var gapX = o.gapX == null ? 6 : o.gapX;
    var gapY = o.gapY == null ? 6 : o.gapY;
    var base = o.base == null ? 0 : o.base;
    var MAX_ROWS = 64; // a stack this deep is already a different problem

    var order = (items || []).map(function (it, i) { return { it: it, i: i }; });
    // Stable by construction: ties broken by original index, so two events in
    // the same year always pack in the order the caller listed them.
    order.sort(function (a, b) { return (a.it.x - b.it.x) || (a.i - b.i); });

    var rowRight = {};  // "side|row" -> right edge of the last label placed there
    var rowHeight = {}; // "side|row" -> tallest label placed there
    var out = new Array(order.length);

    order.forEach(function (rec) {
      var it = rec.it;
      var w = it.w || 0, h = it.h || 0;
      var left = it.x - w / 2, right = it.x + w / 2;
      var placed = null;
      for (var row = 0; row < MAX_ROWS && !placed; row++) {
        for (var s = 0; s < sides.length && !placed; s++) {
          var key = sides[s] + '|' + row;
          if (rowRight[key] == null || left >= rowRight[key] + gapX) {
            placed = { side: sides[s], row: row };
          }
        }
      }
      // Only reachable past MAX_ROWS rows of collisions; overlap in the last
      // row beats dropping a label off the timeline entirely.
      if (!placed) placed = { side: sides[0], row: MAX_ROWS - 1 };
      var pk = placed.side + '|' + placed.row;
      rowRight[pk] = Math.max(rowRight[pk] == null ? right : rowRight[pk], right);
      rowHeight[pk] = Math.max(rowHeight[pk] || 0, h);
      out[rec.i] = placed;
    });

    var offsets = {};
    sides.forEach(function (side) {
      var acc = base;
      for (var row = 0; row < MAX_ROWS; row++) {
        var key = side + '|' + row;
        if (rowHeight[key] == null) break;
        offsets[key] = acc;
        acc += rowHeight[key] + gapY;
      }
    });

    return out.map(function (p) {
      var key = p.side + '|' + p.row;
      return { side: p.side, row: p.row, offset: offsets[key] == null ? base : offsets[key], height: rowHeight[key] || 0 };
    });
  }

  /**
   * How deep the packed stack goes on each side, in px from the line — what
   * a caller needs to size a lane tall enough to hold its own labels.
   */
  function packedDepth(packed) {
    var depth = { above: 0, below: 0 };
    (packed || []).forEach(function (p) {
      var d = p.offset + p.height;
      if (d > (depth[p.side] || 0)) depth[p.side] = d;
    });
    return depth;
  }

  /**
   * Nudges small on-the-line badges (the map print's pin numbers, the
   * worksheet's numbered blanks) apart along x so two events in the same
   * year don't hide each other's number, and returns a `badgeX` per item.
   *
   * Same bargain `spreadPins` makes on the map: the marker dot stays at the
   * true `x` and only the badge moves, so the timeline never lies about
   * when something happened. Unlike labels, a badge is ~1.5rem wide, so the
   * displacement needed is a few px — small enough to read as "these two are
   * at the same moment" rather than as two separate dates.
   *
   * Cluster-and-centre rather than pairwise relaxation: members of a cluster
   * are laid out at exactly `minSepPx` apart, centred on the cluster's own
   * mean x, so the group stays put as a whole and the result is the same
   * every render (a pairwise push settles somewhere slightly different
   * depending on iteration order, which makes the print jitter between
   * runs). Clusters that grow into each other are merged and re-centred
   * until nothing overlaps, so order along the axis is always preserved.
   */
  function spreadBadges(items, minSepPx) {
    var sep = minSepPx == null ? 22 : minSepPx;
    var order = (items || []).map(function (it, i) { return { x: it.x || 0, i: i }; });
    order.sort(function (a, b) { return (a.x - b.x) || (a.i - b.i); });

    // Each cluster: {members: [orderIndex], sum: total of true x}
    var clusters = [];
    order.forEach(function (rec) {
      clusters.push({ members: [rec], sum: rec.x });
      // Merge backwards while the new cluster's leftmost placed position
      // would collide with the previous cluster's rightmost.
      for (;;) {
        var n = clusters.length;
        if (n < 2) break;
        var a = clusters[n - 2], b = clusters[n - 1];
        var aEnd = (a.sum / a.members.length) + (a.members.length - 1) * sep / 2;
        var bStart = (b.sum / b.members.length) - (b.members.length - 1) * sep / 2;
        if (bStart - aEnd >= sep) break;
        a.members = a.members.concat(b.members);
        a.sum += b.sum;
        clusters.pop();
      }
    });

    var out = new Array(order.length);
    clusters.forEach(function (c) {
      var centre = c.sum / c.members.length;
      var start = centre - (c.members.length - 1) * sep / 2;
      c.members.forEach(function (rec, k) { out[rec.i] = start + k * sep; });
    });
    return out;
  }

  /**
   * A deliberately generous estimate of how tall a rendered label will be,
   * for the cases where measuring it is not possible — a print page built
   * inside a hidden container reports every height as 0, and packing on
   * zeros would silently collapse back to one overlapping row on exactly
   * the artifacts (worksheet, map print) that most need the fix.
   *
   * Over-estimating costs a few px of white space; under-estimating costs
   * an overlap, so every rounding here goes up.
   */
  function estimateLabelHeightPx(event, opts) {
    var o = opts || {};
    var rem = o.remPx || 16;
    var width = o.widthPx || 9 * rem;
    var fontPx = 0.78 * rem;
    var lineH = fontPx * 1.35;
    var charPx = fontPx * 0.55;          // generous average glyph width
    var perLine = Math.max(6, Math.floor(width / charPx));
    var title = o.blanked ? '' : String((event && event.title) || '');
    var titleLines = Math.max(1, Math.ceil(title.length / perLine));
    var h = lineH * (1 + titleLines);    // date line + title lines
    if (event && event.photo && !o.blanked) h += 2.4 * rem + 0.4 * rem;
    return Math.ceil(h);
  }

  /** Fixed, distinct palette for event categories (political/cultural/
   * technological/etc.) — picked for reasonable print/grayscale separation. */
  var CATEGORY_PALETTE = ['#2e6b8f', '#a3372b', '#5b8c3a', '#8a5b9e', '#c07a1f', '#1f7a72', '#a34a8a', '#4a5fa3'];

  /** Distinct, first-seen-order list of non-empty category strings across a
   * set of events — the legend and the category `<datalist>` both want this. */
  function collectCategories(events) {
    var seen = {};
    var list = [];
    (events || []).forEach(function (e) {
      var c = (e.category || '').trim();
      if (c && !seen[c]) { seen[c] = true; list.push(c); }
    });
    return list;
  }

  /** Maps each distinct category in `events` to a palette color by
   * first-seen order, so two categories always get two different colors as
   * long as there are 8 or fewer distinct categories (a string hash was
   * tried first and rejected — collisions between short common words like
   * "Cultural" and "Technological" landing on the same slot defeated the
   * whole point of a legend). Beyond 8 categories, colors repeat — flagged
   * in the improvement notes rather than solved, since a timeline with more
   * than 8 categories needs a different visual approach (patterns, not just
   * more hues) to stay legible in print. Call once per render and reuse the
   * map, so the legend and the markers it describes always agree — building
   * it twice from two different event lists (e.g. a screen view built from
   * `state.events` and a legend built from a filtered subset) would silently
   * assign the same category two different colors. */
  function buildCategoryColorMap(events) {
    var categories = collectCategories(events);
    var map = {};
    categories.forEach(function (c, i) { map[c] = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]; });
    return map;
  }

  global.TimelineLayout = {
    formatYear: formatYear,
    formatDateLabel: formatDateLabel,
    yearRangeOf: yearRangeOf,
    autoPxPerYear: autoPxPerYear,
    yearToUnit: yearToUnit,
    yearToX: yearToX,
    computeLayout: computeLayout,
    gridlineInterval: gridlineInterval,
    computeGridlines: computeGridlines,
    computeEraBands: computeEraBands,
    assignLabelSides: assignLabelSides,
    packLabels: packLabels,
    packedDepth: packedDepth,
    spreadBadges: spreadBadges,
    estimateLabelHeightPx: estimateLabelHeightPx,
    collectCategories: collectCategories,
    buildCategoryColorMap: buildCategoryColorMap
  };
})(typeof window !== 'undefined' ? window : global);
