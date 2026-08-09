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
   */
  function computeLayout(events, pxPerYear, padding, rangeOverride) {
    var pad = padding == null ? 60 : padding;
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
      var x = pad + (e.yearStart - range.min) * pxPerYear;
      var width = e.yearEnd != null ? Math.max(2, (e.yearEnd - e.yearStart) * pxPerYear) : 0;
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
   * (same pad + (year - minYear) * pxPerYear mapping), at every clean
   * multiple of the auto-picked interval that falls within [minYear, maxYear].
   * Kept as a separate pass rather than folded into computeLayout since
   * gridlines depend only on the year range, not on individual events.
   */
  function computeGridlines(minYear, maxYear, pxPerYear, padding) {
    var pad = padding == null ? 60 : padding;
    var span = Math.max(1, maxYear - minYear);
    var interval = gridlineInterval(span);
    var start = Math.ceil(minYear / interval) * interval;
    var lines = [];
    for (var year = start; year <= maxYear; year += interval) {
      lines.push({ year: year, x: pad + (year - minYear) * pxPerYear, label: formatYear(year) });
    }
    return lines;
  }

  /**
   * Computes background era/period band positions along the same x-axis as
   * computeLayout/computeGridlines (same pad + (year - minYear) * pxPerYear
   * mapping). Eras use the same {yearStart, yearEnd} field names as events
   * so a caller can fold them straight into yearRangeOf() when sizing the
   * shared axis. Bands are clamped to [minYear, maxYear] so an era that
   * runs past the edge of that range still renders (clipped) rather than
   * disappearing or skewing the rest of the layout.
   */
  function computeEraBands(eras, minYear, maxYear, pxPerYear, padding) {
    var pad = padding == null ? 60 : padding;
    return (eras || []).map(function (era) {
      var lo = Math.min(era.yearStart, era.yearEnd);
      var hi = Math.max(era.yearStart, era.yearEnd);
      var start = Math.max(minYear, lo);
      var end = Math.min(maxYear, hi);
      return { era: era, x: pad + (start - minYear) * pxPerYear, width: Math.max(2, (end - start) * pxPerYear) };
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

  global.TimelineLayout = {
    formatYear: formatYear,
    formatDateLabel: formatDateLabel,
    yearRangeOf: yearRangeOf,
    autoPxPerYear: autoPxPerYear,
    computeLayout: computeLayout,
    gridlineInterval: gridlineInterval,
    computeGridlines: computeGridlines,
    computeEraBands: computeEraBands,
    assignLabelSides: assignLabelSides
  };
})(typeof window !== 'undefined' ? window : global);
