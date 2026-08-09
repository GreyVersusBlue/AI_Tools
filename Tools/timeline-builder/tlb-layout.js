/* Timeline Builder — layout math.
   Pure functions, no DOM, so positioning/sorting/formatting can be
   unit-tested before any UI touches them.

   Scope decisions (flagged per the build spec):
   - Single track only for now — no side-by-side parallel timelines yet.
     Adding a `track` field to events and rendering multiple lanes later
     wouldn't require reworking this layout math, just repeating it per lane.
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
   */
  function computeLayout(events, pxPerYear, padding) {
    var pad = padding == null ? 60 : padding;
    if (!events.length) return { positioned: [], totalWidth: pad * 2, minYear: 0, maxYear: 0 };

    var range = yearRangeOf(events);
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
    assignLabelSides: assignLabelSides
  };
})(typeof window !== 'undefined' ? window : global);
