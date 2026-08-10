// np-equity.js — "who have I actually been calling on?", answered from data the
// tool was already collecting and never reading back.
//
// np_stats has counted every pick since the tool shipped and np_history has
// logged every one of them, and between them the only thing the page did was
// draw a bar chart of lifetime totals. That chart cannot answer the question a
// teacher is actually asked in a evaluation or an IEP meeting — "show me that
// you call on everyone" — because a lifetime total says nothing about *when*.
// A student called eleven times in September and never since looks identical to
// one called eleven times this week.
//
// So this file works off dates. Everything here is pure and takes `today` as an
// argument rather than reading the clock, which is what lets test/smoke.mjs
// check the "not called in 21 days" boundary without waiting three weeks.
//
// Two limits worth knowing before trusting a number out of here:
//
//   1. np_history is capped at 500 entries. Six classes a day fills that in a
//      few weeks, so a long window silently reports on less than it claims.
//      `report()` returns `truncated` so the UI can say so instead of implying
//      a complete record.
//   2. History entries written before 2026-08 carry no date. They are counted
//      in lifetime totals and excluded from every windowed figure, and
//      `undated` reports how many there were.
//
// DOM-free. Imported by the page and by the Node suite.

/** `YYYY-MM-DD` for a Date, in local time — the same form np_history stores. */
export function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86400000;

/** Whole days between two `YYYY-MM-DD` keys. Negative if `b` is before `a`. */
export function daysBetween(a, b) {
  const pa = Date.parse(a + "T00:00:00"), pb = Date.parse(b + "T00:00:00");
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return null;
  return Math.round((pb - pa) / DAY_MS);
}

/** The `YYYY-MM-DD` `n` days before `today`. */
export function shiftDay(today, n) {
  const p = Date.parse(today + "T00:00:00");
  if (!Number.isFinite(p)) return today;
  return dayKey(new Date(p + n * DAY_MS));
}

/**
 * One row per student on the roster, plus the totals a summary line needs.
 *
 * `days` is the window in days (7, 14, 30…), or 0 for "everything on record".
 * `stats` supplies the lifetime count, because history is capped and the
 * lifetime total is the one number that is not.
 *
 * Rows come back sorted by who is most overdue: never-called first, then
 * longest-since-called, then fewest picks in the window.
 */
export function report(names, history, stats = {}, { days = 14, today = dayKey(new Date()) } = {}) {
  const roster = Array.from(new Set((names || []).filter(n => typeof n === "string" && n)));
  const entries = (history || []).filter(h => h && typeof h.name === "string" && h.name);
  const from = days > 0 ? shiftDay(today, -(days - 1)) : null;

  const inWindow = {}, lastSeen = {}, promptsAsked = {};
  let windowTotal = 0, undated = 0;

  for (const h of entries) {
    const date = typeof h.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.date) ? h.date : null;
    if (!date) { undated++; continue; }
    if (!lastSeen[h.name] || date > lastSeen[h.name]) lastSeen[h.name] = date;
    if (from && date < from) continue;
    inWindow[h.name] = (inWindow[h.name] || 0) + 1;
    windowTotal++;
    if (h.prompt) promptsAsked[h.name] = (promptsAsked[h.name] || 0) + 1;
  }

  const evenShare = roster.length ? windowTotal / roster.length : 0;
  const rows = roster.map(name => {
    const last = lastSeen[name] || null;
    const since = last ? daysBetween(last, today) : null;
    const count = inWindow[name] || 0;
    return {
      name,
      count,                                   // picks inside the window
      lifetime: Number(stats[name]) || 0,
      last,                                    // YYYY-MM-DD or null
      daysSince: since,                        // null = never called on record
      withPrompt: promptsAsked[name] || 0,
      share: windowTotal ? count / windowTotal : 0,
      // How far off an even split this student is, in picks. Negative = overlooked.
      versusEven: evenShare ? count - evenShare : 0
    };
  });

  rows.sort((a, b) => {
    if ((a.daysSince === null) !== (b.daysSince === null)) return a.daysSince === null ? -1 : 1;
    if (a.daysSince !== null && a.daysSince !== b.daysSince) return b.daysSince - a.daysSince;
    if (a.count !== b.count) return a.count - b.count;
    return a.name.localeCompare(b.name);
  });

  return {
    rows,
    days,
    today,
    from,
    windowTotal,
    evenShare,
    undated,
    // The cap np-store enforces on np_history. Reported, not enforced, here.
    truncated: entries.length >= 500,
    neverCalled: rows.filter(r => r.daysSince === null).length,
    roster: roster.length
  };
}

/** Students not called in `threshold` days (never-called always qualify). */
export function overdue(rows, threshold = 14) {
  return (rows || []).filter(r => r.daysSince === null || r.daysSince >= threshold);
}

/**
 * A one-line summary a teacher can say out loud. Deliberately plain:
 * this text ends up on a printed page that somebody else reads.
 */
export function summaryLine(rep) {
  if (!rep || !rep.roster) return "No roster loaded.";
  const window = rep.days > 0 ? `the last ${rep.days} days` : "all recorded picks";
  if (!rep.windowTotal) return `No picks recorded in ${window}.`;
  const bits = [`${rep.windowTotal} pick${rep.windowTotal === 1 ? "" : "s"} across ${rep.roster} students in ${window}`];
  if (rep.neverCalled) bits.push(`${rep.neverCalled} never called on record`);
  const quiet = overdue(rep.rows, Math.max(7, rep.days)).length - rep.neverCalled;
  if (quiet > 0) bits.push(`${quiet} not called in ${Math.max(7, rep.days)} days`);
  return bits.join(" · ") + ".";
}

export default { dayKey, daysBetween, shiftDay, report, overdue, summaryLine };
