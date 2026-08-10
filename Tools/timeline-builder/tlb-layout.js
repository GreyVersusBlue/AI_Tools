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
    collectCategories: collectCategories,
    buildCategoryColorMap: buildCategoryColorMap
  };
})(typeof window !== 'undefined' ? window : global);
