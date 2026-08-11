// scv-pacing.js — pure lesson-pacing logic for the School Calendar Visualizer.
//
// Everything here is DOM-free, localStorage-free, and SheetJS-free so the
// whole module can be imported and exercised by plain `node` in
// test/smoke-pacing.mjs. The HTML page owns rendering and persistence; this
// module owns the naming convention, the "teachable day" calendar walk, and
// the distribute/bump arithmetic.
//
// The lesson naming convention (also documented in the tool's UI):
//
//   U<unit>-<lesson>-<A|B>-<Title>
//
//   U1-03-A-Urbanization & Trade Networks   → unit 1, lesson 03, A day
//   U2-BUF1-B-Buffer / Review Day           → unit 2, buffer day 1, B day
//
// <unit> is digits; <lesson> is letters/digits (zero-padded numbers by
// convention, but tokens like BUF1 are valid); the A/B letter is the block
// rotation the lesson is written for; <Title> is everything after the third
// hyphen and may itself contain hyphens.

export const LESSON_CODE_RE = /^U(\d+)-([A-Za-z0-9]+)-([AaBb])-(.+)$/;

/** Parse one lesson code. Returns null when the string doesn't follow the
    convention (the caller decides whether that's an error or a blank). */
export function parseLessonCode(str) {
  const raw = String(str || "").trim();
  const m = LESSON_CODE_RE.exec(raw);
  if (!m) return null;
  return { raw, unit: m[1], num: m[2], letter: m[3].toUpperCase(), title: m[4].trim() };
}

/** Parse a pasted list, one code per line. Blank lines are skipped; every
    non-blank line must parse. Line numbers in errors are 1-based. */
export function parseLessonList(text) {
  const lessons = [];
  const errors = [];
  String(text || "").split(/\r\n|\n|\r/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed = parseLessonCode(trimmed);
    if (parsed) {
      lessons.push({ id: "les_" + (lessons.length + 1), ...parsed });
    } else {
      errors.push({ line: i + 1, text: trimmed, message: "doesn't match U<unit>-<lesson>-<A|B>-<Title>" });
    }
  });
  return { lessons, errors };
}

/* --- date helpers (all UTC so results never depend on the machine's
       timezone — an Excel serial is a date, not an instant) --- */

const DAY_MS = 24 * 60 * 60 * 1000;

function isoToUtcMs(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToISO(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(d.getUTCDate()).padStart(2, "0");
}

export function addDaysISO(dateISO, n) {
  return utcMsToISO(isoToUtcMs(dateISO) + n * DAY_MS);
}

/** Mon–Fri check for an ISO date, timezone-independent. */
export function isWeekdayISO(dateISO) {
  const dow = new Date(isoToUtcMs(dateISO)).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Excel 1900-system date serial → "YYYY-MM-DD". Serial 1 = 1900-01-01,
    so the epoch is 1899-12-30 (accounting for Excel's phantom 1900-02-29). */
export function excelSerialToISO(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  return utcMsToISO(Date.UTC(1899, 11, 30) + Math.round(n) * DAY_MS);
}

/* --- school-note classification (for importing a county pacing sheet) --- */

/**
 * Classify a "School Notes" cell:
 *   "halfday"          — early dismissal; still a teaching day, but flagged
 *   "closure-workday"  — no students (PD / workday / meeting day)
 *   "closure-holiday"  — no school at all (holiday, break, closed)
 *   "info"             — label-only (first/last day, reopen, marking period)
 *   null               — empty note
 * The final fallback encodes what the CCPS sheets actually do: a weekday row
 * with a note but no lesson is a closure even if the wording is novel.
 */
export function classifySchoolNote(note, { isWeekday = true, hasLesson = false } = {}) {
  const s = String(note || "").trim();
  if (!s) return null;
  if (/early dismissal|half day/i.test(s)) return "halfday";
  if (hasLesson) return "info"; // a day that has a lesson can't be a closure
  if (/professional (learning|development)|workday|meeting day|no students/i.test(s)) return "closure-workday";
  if (/closed|holiday|break|no school/i.test(s)) return "closure-holiday";
  if (/reopen|first day|last day|marking period/i.test(s)) return "info";
  if (isWeekday) return "closure-holiday";
  return "info";
}

/* --- teachable-day predicate --- */

/** A teachable day is a weekday not tagged with any noSchool day type.
    (Early dismissals stay teachable — their day types have noSchool unset.) */
export function isTeachableDay(dateISO, days, dayTypes) {
  if (!isWeekdayISO(dateISO)) return false;
  const entry = days && days[dateISO];
  if (!entry || !entry.types || !entry.types.length) return true;
  return !entry.types.some(id => {
    const t = dayTypes.find(dt => dt.id === id);
    return t && t.noSchool;
  });
}

/** All teachable days in [startISO, endISO] under a caller-supplied predicate. */
export function listTeachableDays(startISO, endISO, isTeachable) {
  const out = [];
  for (let ms = isoToUtcMs(startISO), end = isoToUtcMs(endISO); ms <= end; ms += DAY_MS) {
    const dateISO = utcMsToISO(ms);
    if (isTeachable(dateISO)) out.push(dateISO);
  }
  return out;
}

/* --- placement --- */

/**
 * Distribute `lessons` (in order) across teachable days from startISO,
 * honoring `adjustments`. Each adjustment is one skipped teachable-day slot
 * inserted immediately before its `beforeLessonId` lesson — that lesson and
 * everything after slide one slot forward. Anchoring the gap to the lesson
 * (not a date) means a later closure edit moves the gap along with its
 * lesson instead of double-shifting.
 *
 * Returns:
 *   byDate                — { ISO: lesson }
 *   dateByLessonId        — { lessonId: ISO }
 *   vacated               — { ISO: [{id, reason}] } the skipped slots
 *   overflow              — lessons that didn't fit before endISO
 *   orphanedAdjustmentIds — adjustments whose lesson no longer exists
 */
export function placeLessons({ lessons, adjustments, startISO, endISO, isTeachable }) {
  const byDate = {};
  const dateByLessonId = {};
  const vacated = {};
  const lessonIds = new Set((lessons || []).map(l => l.id));
  const gapsBefore = new Map(); // lessonId → queue of adjustments
  const orphanedAdjustmentIds = [];
  (adjustments || []).forEach(a => {
    if (!lessonIds.has(a.beforeLessonId)) { orphanedAdjustmentIds.push(a.id); return; }
    if (!gapsBefore.has(a.beforeLessonId)) gapsBefore.set(a.beforeLessonId, []);
    gapsBefore.get(a.beforeLessonId).push(a);
  });

  let i = 0;
  if (lessons && lessons.length && startISO && endISO && startISO <= endISO) {
    for (let ms = isoToUtcMs(startISO), end = isoToUtcMs(endISO); ms <= end && i < lessons.length; ms += DAY_MS) {
      const dateISO = utcMsToISO(ms);
      if (!isTeachable(dateISO)) continue;
      const pending = gapsBefore.get(lessons[i].id);
      if (pending && pending.length) {
        const g = pending.shift();
        (vacated[dateISO] = vacated[dateISO] || []).push({ id: g.id, reason: g.reason || "" });
      } else {
        byDate[dateISO] = lessons[i];
        dateByLessonId[lessons[i].id] = dateISO;
        i++;
      }
    }
  }
  return { byDate, dateByLessonId, vacated, overflow: (lessons || []).slice(i), orphanedAdjustmentIds };
}

/* --- county pacing spreadsheet (rows from sheet_to_json(ws, {header:1})) --- */

function cellToISO(a) {
  if (typeof a === "number") return excelSerialToISO(a);
  const s = String(a || "").trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parsedMs = Date.parse(s);
  if (!Number.isNaN(parsedMs)) return utcMsToISO(parsedMs);
  return null;
}

/**
 * Parse the 3-column county sheet (A=date, B=lesson code, C=school note).
 * Returns { lessonRows, dayTags, errors }:
 *   lessonRows — [{date, lesson}] sorted by date (lesson = parsed code)
 *   dayTags    — [{date, kind, label}] for every noted day (kind from
 *                classifySchoolNote; "info" rows keep just the label)
 *   errors     — [{row, message}] (1-based, header row included in count)
 */
export function parsePacingRows(rows) {
  const lessonRows = [];
  const dayTags = [];
  const errors = [];
  (rows || []).forEach((row, idx) => {
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === "")) return;
    const [a, b, c] = row;
    if (idx === 0 && typeof a === "string" && /^date$/i.test(a.trim())) return; // header
    const date = cellToISO(a);
    if (!date) { errors.push({ row: idx + 1, message: `unreadable date: "${a}"` }); return; }
    const codeStr = String(b || "").trim();
    let lesson = null;
    if (codeStr) {
      lesson = parseLessonCode(codeStr);
      if (!lesson) errors.push({ row: idx + 1, message: `unreadable lesson code: "${codeStr}"` });
    }
    if (lesson) lessonRows.push({ date, lesson });
    const note = String(c || "").trim();
    if (note) {
      const kind = classifySchoolNote(note, { isWeekday: isWeekdayISO(date), hasLesson: !!lesson });
      if (kind) dayTags.push({ date, kind, label: note });
    }
  });
  lessonRows.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
  lessonRows.forEach((r, i) => { r.lesson = { id: "les_" + (i + 1), ...r.lesson }; });
  return { lessonRows, dayTags, errors };
}

/* --- re-import support --- */

/**
 * When the lesson list is replaced, re-anchor each adjustment onto the new
 * list by matching the old lesson's raw code (first occurrence). Adjustments
 * whose code vanished are dropped and reported so the UI can say so.
 */
export function rebindAdjustments(adjustments, oldLessons, newLessons) {
  const rawById = new Map((oldLessons || []).map(l => [l.id, l.raw]));
  const kept = [];
  const dropped = [];
  (adjustments || []).forEach(a => {
    const raw = rawById.get(a.beforeLessonId);
    const match = raw && (newLessons || []).find(l => l.raw === raw);
    if (match) kept.push({ ...a, beforeLessonId: match.id });
    else dropped.push(a);
  });
  return { kept, dropped };
}

export function emptyPacing() {
  return { startDate: null, lessons: [], adjustments: [] };
}
