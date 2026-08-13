/* Exit Ticket Generator — planned-sequence math.
   Pure functions, no DOM and no localStorage, so the part that actually
   decides "which prompt is today's prompt" can be unit-tested directly in
   Node before any UI touches it — mirrors the cadence Writing Prompt
   Generator's Prompt Sets use (Tools/025-writing-prompt-generator.html),
   ported here per the shared-pattern note in the improvement-prompt doc. */
(function (global) {
  'use strict';

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function isDateStr(s) {
    return typeof s === 'string' && DATE_RE.test(s);
  }

  /** Parses a 'YYYY-MM-DD' string as a local-midnight Date, so a school in
   *  any timezone still lands on the calendar date typed in, not a UTC
   *  shift of it. Returns null for anything that doesn't match. */
  function parseDateLocal(s) {
    var m = DATE_RE.exec(s || '');
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  /** Counts school days (Mon-Fri) strictly between `startStr` and
   *  `todayStr` (both 'YYYY-MM-DD'), so a set's Day 1 lands on its start
   *  date and advances one day per weekday. `todayStr` is a parameter
   *  rather than read from the clock so this stays a pure function to
   *  test — the caller passes the real "today". A `todayStr` on or before
   *  the start date, or an unparsable `startStr`, counts as 0 (Day 1). */
  function schoolDaysSince(startStr, todayStr) {
    var start = parseDateLocal(startStr);
    if (!start) return 0;
    var today = parseDateLocal(todayStr);
    if (!today) return 0;
    var count = 0;
    var d = new Date(start.getTime());
    while (d < today) {
      d.setDate(d.getDate() + 1);
      var day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  /** Clamps an index into [0, itemsLength - 1]. With zero items this
   *  returns 0 (matching the writing-prompt-generator sibling's behavior,
   *  callers guard on itemsLength === 0 before trusting the result). */
  function clampIndex(idx, itemsLength) {
    return Math.max(0, Math.min(idx || 0, itemsLength - 1));
  }

  /** The cursor after stepping by `dir` (+1 / -1), clamped to the set's
   *  bounds — the manual Prev/Next override. */
  function nextCursor(cursor, dir, itemsLength) {
    return clampIndex((cursor || 0) + dir, itemsLength);
  }

  /** Where "Jump to today" would land the cursor, or null when there's no
   *  start date or no items to land on (so the caller can hide the
   *  button instead of jumping to a meaningless Day 1). */
  function suggestedIndex(itemsLength, startDate, todayStr) {
    if (!startDate || !itemsLength) return null;
    return clampIndex(schoolDaysSince(startDate, todayStr), itemsLength);
  }

  global.EtgSequence = {
    isDateStr: isDateStr,
    parseDateLocal: parseDateLocal,
    schoolDaysSince: schoolDaysSince,
    clampIndex: clampIndex,
    nextCursor: nextCursor,
    suggestedIndex: suggestedIndex
  };
})(typeof window !== 'undefined' ? window : global);
