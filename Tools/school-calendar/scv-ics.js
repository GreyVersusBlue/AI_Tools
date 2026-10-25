// scv-ics.js — the School Calendar Visualizer's .ics writer and reader (Path 9 P4).
//
// Pure: no DOM, no storage, no clock (the export moment is handed in), so plain `node`
// runs every line of it in test/ics.test.mjs. The page assembles what it needs from
// SchoolDay (grading periods, the stamped lessons) and calls these.
//
//   writeIcs(cal, { periods, lessons, stamp })  -> the file, CRLF lines folded at 75 octets
//   readIcs(text, { timeZone })                 -> { ok, error } | { ok, events, skipped }
//   planIcsImport(cal, read)                    -> { cal, rows, skipped, same }
//   readTable(text, { start, end })             -> readIcs's shape, from a pasted date table
//
// WHAT A FILE HOLDS (BACKLOG.md, Path 9 P4, "What an export holds"). One all-day event per
// run of consecutive dates whose types, label, note and lesson are the same; one per grading
// period; one per course per date for a paced lesson when the caller hands lessons in. Every
// event this page writes carries X-SCV-KIND, and a day event carries X-SCV-TYPES and
// X-SCV-LABEL, so a file this page wrote comes back exactly: importing it changes nothing.
//
// HOW AN IMPORT MAPS BACK, WITHOUT OVERWRITING. Types are added to a date, never removed. An
// empty label takes the event's title; a different label stays and the title goes into the
// note as "Also: …"; a description goes into the note; nothing is added twice. A date
// outside the school year, a repeating event, a cancelled one and this page's own grading
// period and lesson events are skipped and listed with the reason.
//
// Dates are calendar dates ("YYYY-MM-DD"). A timed event lands on the date it starts on in
// its own TZID (the date as written), or, for a UTC time ending in Z, in `timeZone` (the
// browser's when none is given); the suite pins both.

import { isoToMs, addDays, isValidIso } from "./scv-weeks.js";

export const PRODID = "-//AsPerMyLessonPlan.com//School Calendar Visualizer//EN";
export const UID_DOMAIN = "scv.aspermylessonplan.com";
export const MAX_BYTES = 4 * 1024 * 1024;  // a district's whole-year file is tens of KB
export const MAX_EVENT_DAYS = 400;         // one event longer than a school year is not a closure
const DAY_MS = 24 * 60 * 60 * 1000;

/* ---- text ---- */

export function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

export function unescapeText(s) {
  return String(s == null ? "" : s).replace(/\\([\\;,nN])/g, (m, c) => (c === "n" || c === "N" ? "\n" : c));
}

function utf8Len(ch) {
  const c = ch.codePointAt(0);
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

/** RFC 5545 3.1: no line longer than 75 octets; a continuation starts with one space,
    which counts. Never splits a character (Array.from walks code points). */
export function foldLine(line) {
  const out = [];
  let cur = "", len = 0, limit = 75;
  for (const ch of Array.from(line)) {
    const n = utf8Len(ch);
    if (len + n > limit) { out.push(cur); cur = " "; len = 1; limit = 75; }
    cur += ch; len += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** Undo folding: a line starting with a space or tab continues the one before it. */
export function unfold(text) {
  const out = [];
  String(text).split(/\r\n|\n|\r/).forEach((line) => {
    if ((line[0] === " " || line[0] === "\t") && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  });
  return out;
}

/* ---- the writer ---- */

const compact = (iso) => iso.replace(/-/g, "");
function utcStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z";
}

function entryOf(e) {
  return {
    types: Array.isArray(e && e.types) ? e.types.filter((t) => typeof t === "string") : [],
    label: typeof (e && e.label) === "string" ? e.label : "",
    note: typeof (e && e.note) === "string" ? e.note : "",
    lesson: typeof (e && e.lesson) === "string" ? e.lesson : "",
  };
}
const hasContent = (e) => e.types.length || e.label || e.note || e.lesson;
const sameEntry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Runs of consecutive dates with the same entry: [{ start, end, entry }], end inclusive. */
export function dayRuns(cal) {
  const days = cal && cal.days && typeof cal.days === "object" ? cal.days : {};
  const dates = Object.keys(days).filter(isValidIso).sort();
  const runs = [];
  dates.forEach((d) => {
    const e = entryOf(days[d]);
    if (!hasContent(e)) return;
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === d && sameEntry(last.entry, e)) last.end = d;
    else runs.push({ start: d, end: d, entry: e });
  });
  return runs;
}

/**
 * The file. `periods`: [{ n, start, end, name, days }] (SchoolDay.gradingPeriods with a
 * name); `lessons`: [{ date, courseId, course, text }]; `stamp`: a Date, the moment of export.
 */
export function writeIcs(cal, opts = {}) {
  const stamp = utcStamp(opts.stamp instanceof Date && !isNaN(opts.stamp) ? opts.stamp : new Date(0));
  const types = Array.isArray(cal && cal.dayTypes) ? cal.dayTypes : [];
  const labelOf = (id) => { const t = types.find((x) => x.id === id); return t ? t.label : ""; };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:" + PRODID, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const year = cal && cal.meta && cal.meta.yearLabel;
  if (year) lines.push("X-WR-CALNAME:" + escapeText(year));
  const event = (props) => {
    lines.push("BEGIN:VEVENT");
    props.forEach((p) => { if (p) lines.push(p); });
    lines.push("END:VEVENT");
  };
  const allDay = (start, endIncl) => ["DTSTART;VALUE=DATE:" + compact(start), "DTEND;VALUE=DATE:" + compact(addDays(endIncl, 1))];

  dayRuns(cal).forEach(({ start, end, entry }) => {
    const labels = entry.types.map(labelOf).filter(Boolean);
    const summary = entry.label || labels.join(" / ") || entry.lesson || entry.note.split("\n")[0] || "Note";
    event([
      "UID:day-" + compact(start) + "@" + UID_DOMAIN,
      "DTSTAMP:" + stamp,
      ...allDay(start, end),
      "SUMMARY:" + escapeText(summary),
      entry.note ? "DESCRIPTION:" + escapeText(entry.note) : "",
      labels.length ? "CATEGORIES:" + labels.map(escapeText).join(",") : "",
      "TRANSP:TRANSPARENT",
      "X-SCV-KIND:day",
      "X-SCV-TYPES:" + entry.types.map(escapeText).join(","),
      "X-SCV-LABEL:" + escapeText(entry.label),
      entry.lesson ? "X-SCV-LESSON:" + escapeText(entry.lesson) : "",
    ]);
  });

  (Array.isArray(opts.periods) ? opts.periods : []).forEach((p) => {
    if (!p || !isValidIso(p.start) || !isValidIso(p.end)) return;
    const name = p.name || "Grading period " + p.n;
    event([
      "UID:period-" + p.n + "-" + compact(p.start) + "@" + UID_DOMAIN,
      "DTSTAMP:" + stamp,
      ...allDay(p.start, p.end),
      "SUMMARY:" + escapeText(name),
      typeof p.days === "number" ? "DESCRIPTION:" + escapeText(p.days + " school day" + (p.days === 1 ? "" : "s")) : "",
      "TRANSP:TRANSPARENT",
      "X-SCV-KIND:grading-period",
    ]);
  });

  (Array.isArray(opts.lessons) ? opts.lessons : []).forEach((l) => {
    if (!l || !isValidIso(l.date) || !l.text) return;
    event([
      "UID:lesson-" + compact(l.date) + "-" + String(l.courseId || "c").replace(/[^A-Za-z0-9_-]/g, "") + "@" + UID_DOMAIN,
      "DTSTAMP:" + stamp,
      ...allDay(l.date, l.date),
      "SUMMARY:" + escapeText((l.course ? l.course + ": " : "") + l.text),
      "TRANSP:TRANSPARENT",
      "X-SCV-KIND:lesson",
    ]);
  });

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/* ---- the reader ---- */

/** "NAME;P=1;Q=\"a:b\":value" -> { name, params, value }, or null for a line with no colon. */
export function parseLine(line) {
  let i = 0, quoted = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i), value = line.slice(i + 1);
  const parts = [];
  let cur = ""; quoted = false;
  for (const c of head) {
    if (c === '"') { quoted = !quoted; cur += c; } else if (c === ";" && !quoted) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const name = parts.shift().trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(name)) return null;
  const params = {};
  parts.forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  });
  return { name, params, value };
}

/** The calendar date an instant falls on in `timeZone` (an IANA name). */
export function dateInZone(ms, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  }
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

/** A DTSTART/DTEND property -> { date, allDay, midnight } or null. */
export function readWhen(prop, timeZone) {
  if (!prop) return null;
  const v = prop.value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const iso = m[1] + "-" + m[2] + "-" + m[3];
    return isValidIso(iso) ? { date: iso, allDay: true, midnight: true } : null;
  }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const iso = m[1] + "-" + m[2] + "-" + m[3];
  if (!isValidIso(iso) || +m[4] > 23 || +m[5] > 59 || +m[6] > 60) return null;
  const midnight = m[4] === "00" && m[5] === "00" && m[6] === "00";
  if (m[7] === "Z") {
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const local = dateInZone(ms, timeZone);
    // midnight in the zone, not in UTC, is what makes an end exclusive
    const back = dateInZone(ms - 1, timeZone);
    return { date: local, allDay: false, midnight: back !== local };
  }
  return { date: iso, allDay: false, midnight };   // floating, or in its TZID: the date as written
}

function durationDays(v) {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T.*)?$/.exec(String(v || "").trim());
  if (!m || (!m[1] && !m[2])) return null;
  return (+m[1] || 0) * 7 + (+m[2] || 0);
}

function defaultZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
}

/**
 * Parse a file. A file that is not one VCALENDAR with balanced BEGIN/END is refused
 * ({ ok: false, error }); inside it, an event that cannot be used is skipped with a reason.
 * events: [{ uid, summary, description, categories, scvTypes (array|null), scvLabel
 * (string|null), scvLesson, kind, dates: [iso...], allDay }].
 */
export function readIcs(text, opts = {}) {
  const timeZone = opts.timeZone || defaultZone();
  if (typeof text !== "string") return { ok: false, error: "That file could not be read as text." };
  if (text.length > MAX_BYTES) return { ok: false, error: "That file is too large to be a school calendar." };
  if (/[\u0000-\u0008\u000e-\u001f]/.test(text.slice(0, 4096))) return { ok: false, error: "That file is not a calendar (.ics) file." };
  const lines = unfold(text.replace(/^\uFEFF/, "")).filter((l) => l.trim() !== "");
  if (!lines.length || lines[0].trim().toUpperCase() !== "BEGIN:VCALENDAR") return { ok: false, error: "That file is not a calendar (.ics) file: it does not start with BEGIN:VCALENDAR." };

  const stack = [];
  const events = [], skipped = [];
  let cur = null, ended = false;
  for (let i = 0; i < lines.length; i++) {
    const prop = parseLine(lines[i]);
    if (!prop) return { ok: false, error: "Line " + (i + 1) + " of that file is not a calendar line." };
    if (ended) return { ok: false, error: "That file has more after its END:VCALENDAR." };
    if (prop.name === "BEGIN") {
      const what = prop.value.trim().toUpperCase();
      stack.push(what);
      if (what === "VEVENT") {
        if (stack.length !== 2 || stack[0] !== "VCALENDAR") return { ok: false, error: "That file has an event in the wrong place." };
        cur = { props: {} };
      }
      continue;
    }
    if (prop.name === "END") {
      const what = prop.value.trim().toUpperCase();
      if (stack.pop() !== what) return { ok: false, error: "That file's BEGIN and END lines do not match (END:" + what + ")." };
      if (what === "VEVENT" && cur) { finish(cur); cur = null; }
      if (what === "VCALENDAR" && !stack.length) ended = true;
      continue;
    }
    if (cur && stack.length === 2) {
      // only the first of a property counts, except the ones that may repeat
      if (prop.name === "CATEGORIES") (cur.props.CATEGORIES = cur.props.CATEGORIES || []).push(prop);
      else if (!cur.props[prop.name]) cur.props[prop.name] = prop;
    }
  }
  if (!ended) return { ok: false, error: "That file stops before its END:VCALENDAR." };
  return { ok: true, events, skipped };

  function finish(ev) {
    const p = ev.props;
    const summary = p.SUMMARY ? unescapeText(p.SUMMARY.value).trim() : "";
    const label = summary || "(untitled event)";
    const skip = (reason, date) => skipped.push({ summary: label, date: date || "", reason });
    const start = readWhen(p.DTSTART, timeZone);
    if (!start) return skip("its date could not be read");
    if (p.RRULE || p.RDATE) return skip("it repeats, and repeating events are not imported", start.date);
    if (p.STATUS && /^cancelled$/i.test(p.STATUS.value.trim())) return skip("it is cancelled", start.date);
    const kind = p["X-SCV-KIND"] ? p["X-SCV-KIND"].value.trim().toLowerCase() : "";
    if (kind === "grading-period") return skip("it is a grading period this page wrote; grading periods come from the Marking Period days", start.date);
    if (kind === "lesson") return skip("it is a paced lesson this page wrote; lessons come from the Courses card", start.date);

    let last = start.date;                  // inclusive
    const end = readWhen(p.DTEND, timeZone);
    if (end) {
      if (end.date < start.date) return skip("it ends before it starts", start.date);
      last = end.midnight && end.date > start.date ? addDays(end.date, -1) : end.date;
    } else if (p.DURATION) {
      const n = durationDays(p.DURATION.value);
      if (n !== null && n > 0 && start.allDay) last = addDays(start.date, n - 1);
    }
    const span = Math.round((isoToMs(last) - isoToMs(start.date)) / DAY_MS) + 1;
    if (span > MAX_EVENT_DAYS) return skip("it runs for " + span + " days", start.date);
    const dates = [];
    for (let d = start.date; d <= last; d = addDays(d, 1)) dates.push(d);
    const listOf = (prop) => (prop ? prop.value.split(/(?<!\\),/).map((x) => unescapeText(x).trim()).filter(Boolean) : null);
    events.push({
      uid: p.UID ? p.UID.value.trim() : "",
      summary,
      description: p.DESCRIPTION ? unescapeText(p.DESCRIPTION.value).trim() : "",
      categories: (p.CATEGORIES || []).flatMap((c) => listOf(c)),
      scvTypes: p["X-SCV-TYPES"] ? listOf(p["X-SCV-TYPES"]) : null,
      scvLabel: p["X-SCV-LABEL"] ? unescapeText(p["X-SCV-LABEL"].value) : null,
      scvLesson: p["X-SCV-LESSON"] ? unescapeText(p["X-SCV-LESSON"].value) : "",
      kind,
      dates,
      allDay: start.allDay,
    });
  }
}

/* ---- mapping events back onto the calendar ---- */

/* A guess from the title, tried only for an event with no X-SCV-TYPES and no category the
   legend knows. Each names one of the seed's type ids and, for a legend without that id,
   a pattern its label may match. */
const GUESSES = [
  { id: "halfday",   title: /early (dismissal|release)|half[- ]?day|1\/2[- ]?day|½[- ]?day|early closing/i, label: /half|early/i },
  { id: "workday",   title: /teacher work ?day|work ?day|no students|staff development|professional (development|learning) day/i, label: /workday|no students/i },
  { id: "holiday",   title: /\b(no school|schools? closed|closed|holiday|break|recess|vacation)\b/i, label: /holiday|no school/i },
  { id: "testing",   title: /\btest(ing)?\b|assessment|\bexams?\b/i, label: /test/i },
  { id: "mpend",     title: /end of (the )?(marking|grading) period|end of (the )?(quarter|semester|term)|(quarter|semester|term) ends|report cards?/i, label: /marking|grading period/i },
  { id: "firstlast", title: /(first|last) day (of|for) (school|students)/i, label: /first|last day/i },
];

export function guessTypes(dayTypes, title) {
  const hits = GUESSES.filter((g) => g.title.test(title || ""));
  // "Early Dismissal — Last Day Before Winter Break" is a half day, not a closure
  const keep = hits.some((g) => g.id === "halfday" || g.id === "workday") || /\b(before|after)\b/i.test(title || "")
    ? hits.filter((g) => g.id !== "holiday") : hits;
  const out = [];
  keep.forEach((g) => {
    const t = dayTypes.find((x) => x.id === g.id) || dayTypes.find((x) => g.label.test(x.label || ""));
    if (t && !out.includes(t.id)) out.push(t.id);
  });
  return out;
}

function typesFor(dayTypes, ev) {
  if (ev.scvTypes) {
    const known = ev.scvTypes.filter((id) => dayTypes.some((t) => t.id === id));
    if (known.length || !ev.scvTypes.length) return known;
  }
  const norm = (s) => String(s || "").trim().toLowerCase();
  const byCat = [];
  ev.categories.forEach((c) => {
    const t = dayTypes.find((x) => norm(x.label) === norm(c) || (x.abbr && norm(x.abbr) === norm(c)));
    if (t && !byCat.includes(t.id)) byCat.push(t.id);
  });
  if (byCat.length) return byCat;
  return guessTypes(dayTypes, ev.summary);
}

function addToNote(note, line) {
  if (!line || String(note || "").includes(line)) return note;
  return note ? note + "\n" + line : line;
}

/**
 * What importing `read` (readIcs's result) would do to `cal`, without touching it:
 * { cal: the new calendar, rows: [{ date, before, after, types: [added ids] }] for every date
 * that changes, skipped: readIcs's skipped plus dates outside the year, same: how many
 * dates the file names that would not change }.
 */
export function planIcsImport(cal, read) {
  const dayTypes = Array.isArray(cal.dayTypes) ? cal.dayTypes : [];
  const start = cal.meta && cal.meta.start, end = cal.meta && cal.meta.end;
  const days = { ...cal.days };
  const touched = new Map();   // date -> entry before
  const skipped = [...(read.skipped || [])];
  const named = new Set();
  (read.events || []).forEach((ev) => {
    const types = typesFor(dayTypes, ev);
    const title = ev.scvLabel !== null ? ev.scvLabel : ev.summary;
    const inside = ev.dates.filter((d) => d >= start && d <= end);
    if (!inside.length) {
      skipped.push({ summary: ev.summary || "(untitled event)", date: ev.dates[0] || "", reason: "it is outside this school year (" + start + " to " + end + ")" });
      return;
    }
    inside.forEach((d) => {
      named.add(d);
      const was = entryOf(days[d]);
      if (!touched.has(d)) touched.set(d, was);
      const orig = days[d] && typeof days[d] === "object" ? days[d] : {};
      const next = { ...orig, ...was, types: [...was.types] };   // a field this file does not know is kept
      types.forEach((id) => { if (!next.types.includes(id)) next.types.push(id); });
      if (title) {
        if (!next.label) next.label = title;
        else if (next.label !== title) next.note = addToNote(next.note, "Also: " + title);
      }
      if (ev.description) next.note = addToNote(next.note, ev.description);
      if (ev.scvLesson && !next.lesson) next.lesson = ev.scvLesson;
      days[d] = next;
    });
  });
  const rows = [];
  [...touched.keys()].sort().forEach((d) => {
    const before = touched.get(d), after = days[d];
    if (sameEntry(before, entryOf(after))) {
      if (cal.days[d] === undefined) delete days[d];
      else days[d] = cal.days[d];
      return;
    }
    rows.push({ date: d, before, after: entryOf(after), types: after.types.filter((t) => !before.types.includes(t)) });
  });
  return { cal: { ...cal, days }, rows, skipped, same: named.size - rows.length };
}

/* ---- a pasted table (Path 9 P4, the rest) ----
   A district's calendar is often a PDF whose date table copies out as text: one line a
   row, the cells split by tabs or by runs of spaces, the date first or last. readTable()
   reads that text into the same { ok, events, skipped } readIcs() gives, so planIcsImport()
   maps it onto the calendar exactly as it maps a file: types added and never removed, a
   label kept. It never guesses a date. A line is read only when it has exactly one date or
   one range of dates; a line with none, with two, with a weekday that does not match its
   date, with a date that is not real, or with no name beside it is skipped and listed with
   its line number and the reason. A date without a year takes the year that puts it inside
   the school year (`start` to `end`), and is skipped when no year does or when two do. */

export const MAX_TABLE_LINES = 2000;
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_RE = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const WEEKDAY_RE = "(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\\.?";
const ORD = "(?:st|nd|rd|th)?";
// one date: an optional weekday, then ISO, M/D[/Y] or Month D[, Y]
const DATE_RE = new RegExp(
  "(?<![\\w/])(?:(" + WEEKDAY_RE + "),?\\s+)?(?:" +
    "(\\d{4})-(\\d{1,2})-(\\d{1,2})" +
    "|(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?" +
    "|(" + MONTH_RE + ")\\s+(\\d{1,2})" + ORD + "(?:,?\\s+(\\d{4}))?" +
  ")(?![\\w/])", "gi");
const RANGE_SEP = /^\s*(?:-|–|—|to|through|thru)\s*$/i;
// what may end a range after its separator when the second half is a bare day: "Nov 25-27"
const BARE_END = new RegExp("^(\\s*(?:-|–|—|to|through|thru)\\s*)(?:(" + WEEKDAY_RE + "),?\\s+)?(\\d{1,2})" + ORD + "(?:,?\\s+(\\d{4}))?(?![\\w/:])", "i");

function weekdayOf(word) {
  if (!word) return null;
  const w = word.replace(/\.$/, "").toLowerCase();
  const i = DAY_NAMES.findIndex((d) => d.startsWith(w.slice(0, 3)) && d.startsWith(w));
  return i < 0 ? null : i;
}

function partsOf(m) {
  // -> { y|null, mo, d, wd|null } from one DATE_RE match
  const g = m;
  const wd = weekdayOf(g[1]);
  if (g[2]) return { y: +g[2], mo: +g[3], d: +g[4], wd };
  if (g[5]) {
    let y = g[7] ? +g[7] : null;
    if (y !== null && g[7].length === 2) y += 2000;
    return { y, mo: +g[5], d: +g[6], wd };
  }
  return { y: g[10] ? +g[10] : null, mo: MONTH_NAMES.indexOf(g[8].slice(0, 3).toLowerCase()) + 1, d: +g[9], wd };
}

const iso = (y, mo, d) => String(y).padStart(4, "0") + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
const say = (date) => {
  const [y, m, d] = date.split("-").map(Number);
  return MONTH_NAMES[m - 1][0].toUpperCase() + MONTH_NAMES[m - 1].slice(1) + " " + d + ", " + y;
};

/* The date `p` names: its own year, or the one year that puts it inside start..end, or,
   for the end of a range (`after` given), the first year that is not before `after`. */
function resolve(p, start, end, after) {
  const real = (y) => (isValidIso(iso(y, p.mo, p.d)) ? iso(y, p.mo, p.d) : null);
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31) return { why: "its date is not a real date" };
  if (p.y !== null) {
    const date = real(p.y);
    return date ? { date } : { why: "its date is not a real date" };
  }
  const label = MONTH_NAMES[p.mo - 1][0].toUpperCase() + MONTH_NAMES[p.mo - 1].slice(1) + " " + p.d;
  const y0 = +(after || start).slice(0, 4);
  if (after) {
    // "Dec 21 – Jan 1" crosses into the next year; "Oct 12 – 2" and "Oct 12 – Oct 2" do not
    const date = real(y0);
    if (date && date >= after) return { date };
    const next = p.mo < +after.slice(5, 7) && !p.bare ? real(y0 + 1) : null;
    return next ? { date: next } : { why: date ? "it ends before it starts" : "its date is not a real date" };
  }
  const fits = [];
  for (let y = +start.slice(0, 4); y <= +end.slice(0, 4); y++) {
    const date = real(y);
    if (date && date >= start && date <= end) fits.push(date);
  }
  if (fits.length === 1) return { date: fits[0] };
  if (fits.length > 1) return { why: label + " has no year, and this school year has it twice (" + fits.map(say).join(" and ") + ")" };
  if (![+start.slice(0, 4), +end.slice(0, 4)].some(real)) return { why: "its date is not a real date" };
  return { why: label + " has no year, and it is not in this school year (" + start + " to " + end + ")" };
}

function wrongWeekday(p, date) {
  if (p.wd === null) return "";
  const real = new Date(isoToMs(date)).getUTCDay();
  if (real === p.wd) return "";
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return "it says " + cap(DAY_NAMES[p.wd]) + ", but " + say(date) + " is a " + cap(DAY_NAMES[real]);
}

/**
 * Read a pasted table into { ok, events, skipped } (readIcs's shape), or { ok: false, error }.
 * `opts.start` and `opts.end` are the school year ("YYYY-MM-DD"); a date without a year needs them.
 */
export function readTable(text, opts = {}) {
  const start = opts.start, end = opts.end;
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "There is nothing pasted to read." };
  if (text.length > MAX_BYTES) return { ok: false, error: "That is too much text to be a school calendar's table." };
  if (!isValidIso(start) || !isValidIso(end) || end < start) return { ok: false, error: "Set the school year's first and last day before pasting a table." };
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > MAX_TABLE_LINES) return { ok: false, error: "That is more than " + MAX_TABLE_LINES + " lines; paste the calendar's date table only." };
  const events = [], skipped = [];
  lines.forEach((raw, i) => {
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (!line) return;
    // "1/2 Day" is a half day, not January 2: hidden from the date search, kept in the name
    const scan = line.replace(/(?<![\w/])1\/2(?=[\s-]*days?\b)/gi, "½  ");
    const shown = raw.trim().replace(/\s+/g, " ");
    const skip = (reason, date) => skipped.push({ summary: "Line " + (i + 1) + " (“" + (shown.length > 70 ? shown.slice(0, 69) + "…" : shown) + "”)", date: date || "", reason });
    const found = [...scan.matchAll(DATE_RE)];
    if (!found.length) return skip("it has no date this page can read");
    let first = found[0], last = null, from = first.index, to = first.index + first[0].length;
    if (found.length === 2 && RANGE_SEP.test(scan.slice(to, found[1].index))) {
      last = { p: partsOf(found[1]) };
      to = found[1].index + found[1][0].length;
    } else if (found.length > 1) {
      return skip("it has more than one date, so it is not clear which the name belongs to");
    } else {
      const bare = BARE_END.exec(scan.slice(to));
      if (bare) {
        const p0 = partsOf(first);
        last = { p: { y: bare[4] ? +bare[4] : p0.y, mo: p0.mo, d: +bare[3], wd: weekdayOf(bare[2]), bare: true } };
        to += bare[0].length;
      }
    }
    const p = partsOf(first);
    // a date without a year in a range whose end has one takes the end's year
    if (p.y === null && last && last.p.y !== null && !(last.p.mo < p.mo)) p.y = last.p.y;
    else if (p.y === null && last && last.p.y !== null) p.y = last.p.y - 1;
    // the rest of the line, its cells split on tabs, runs of spaces and bars, is the name
    const rest = (line.slice(0, from) + "\t" + line.slice(to)).split(/\t|\s{2,}|\s*\|\s*/)
      .map((c) => c.replace(/^[\s\-–—:,;]+|[\s\-–—:,;]+$/g, "").trim()).filter(Boolean);
    const cells = [];
    rest.forEach((c) => {
      const wd = new RegExp("^" + WEEKDAY_RE + "$", "i").test(c) ? weekdayOf(c) : null;
      if (wd !== null && !last && p.wd === null) p.wd = wd;   // a weekday column, held to the date
      else if (wd === null) cells.push(c);
    });
    const a = resolve(p, start, end);
    if (a.why) return skip(a.why);
    const bad = wrongWeekday(p, a.date);
    if (bad) return skip(bad, a.date);
    let b = a.date;
    if (last) {
      const r = resolve(last.p, start, end, last.p.y === null ? a.date : null);
      if (r.why) return skip(r.why, a.date);
      const bad2 = wrongWeekday(last.p, r.date);
      if (bad2) return skip(bad2, a.date);
      if (r.date < a.date) return skip("it ends before it starts", a.date);
      b = r.date;
    }
    const span = Math.round((isoToMs(b) - isoToMs(a.date)) / DAY_MS) + 1;
    if (span > MAX_EVENT_DAYS) return skip("it runs for " + span + " days", a.date);
    const summary = cells.join(" — ");
    if (!summary) return skip("it has a date but no name beside it", a.date);
    const dates = [];
    for (let d = a.date; d <= b; d = addDays(d, 1)) dates.push(d);
    events.push({ uid: "", summary, description: "", categories: [], scvTypes: null, scvLabel: null, scvLesson: "", kind: "", dates, allDay: true, line: i + 1 });
  });
  if (!events.length) {
    const n = skipped.length;
    const first = skipped[0].summary.replace(/^Line \d+ \((.*)\)$/, "$1");
    return { ok: false, error: n === 1 ? "That line could not be read: " + skipped[0].reason + "."
      : "None of those " + n + " lines could be read (the first, " + first + ": " + skipped[0].reason + ")." };
  }
  return { ok: true, events, skipped };
}
