// scv-plan.js — pacing that recomputes around lost days (Path 9 P2), as pure functions.
//
// The design is BACKLOG.md's Path 9 P2 bullet; this file is the module half of its
// increment 1. DOM-free, localStorage-free and clock-free (a "today" is always an
// argument), so plain `node` drives all of it in test/plan.test.mjs. Dates are walked in
// UTC, as in scv-pacing.js and scv-weeks.js. scv-pacing.js is not changed: placeLessons()
// stays as the reference this placer is held to.
//
// THE RECORD is one optional field of 032's blob, `cal.plan`, with a version of its own;
// `__v` stays 2, for the reason the design measured (an older page that meets `__v: 3`
// shows the seed and saves it over the calendar; one that meets an unknown field saves
// it back):
//   cal.plan = { v: 1, active: courseId|null, algo: 1, courses: [Course] }
//   Course   = { id, name, color, meets: 'all'|'A'|'B', start: ISO|null,
//                pace: { [dayTypeId]: 'count'|'skip' }, lost: [{ id, date, reason }],
//                units: [Unit], lessons: [Lesson], adjustments: [Adjustment], baseline }
//   Lesson and Adjustment are scv-pacing.js's shapes plus `on`, the date last stamped.
//   Unit     = { id, name, color, code, days, pin, flex, start, end, placed, short }
// A day type may carry `pace: 'skip'`; absent is 'count'. A course's own `pace` map
// overrides the type's. `start: null` is the year's first day.
//
// Settled with Devon (2026-10-21, P9-1 to P9-10, every default kept): a half day is a
// whole class day, marked ½ (P9-1); testing days count (P9-2); the A/B cycle slides
// over a closure (2026-10-07); "behind" is against the plan as it stood (P9-4, increment
// 3); a buffer never absorbs a loss on its own (P9-5, increment 4); entering an old
// closure recomputes and offers Undo, the past is not frozen (P9-6); an A/B course stays
// one list (P9-7); dated units already saved stay (P9-8); unit lengths and lessons carry
// into a new year (P9-9); the words are "Course" and "class day" (P9-10).
//
// WHAT IS HERE: the record's reader, the migration from `cal.pacing`, what counts as a
// class day for a course (a day type's `pace` and the course's override), the placer for
// lessons and for typed unit lengths, with pins and open days, stamping the placed dates
// into the blob, the diff that says what a change moved (increment 1), and turning dated
// units into a course and letting its pins go (increment 2). NOT HERE YET: the baseline
// and "behind" (3), buffers, the A/B split and the new-year carry (4).

import { emptyPacing, unitInstructionalStats } from "./scv-pacing.js";
import { abLetters } from "./scv-weeks.js";

export const PLAN_VERSION = 1;
export const PLACER_ALGO = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoToMs(iso) { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, m - 1, d); }
function msToIso(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}
function isWeekday(iso) { const dow = new Date(isoToMs(iso)).getUTCDay(); return dow !== 0 && dow !== 6; }
function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
const clone = (v) => JSON.parse(JSON.stringify(v));

/** The first `<prefix><n>` not among `taken` (ids are made here, never by chance). */
function nextId(prefix, taken) {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(prefix + n)) return prefix + n;
}

/** "Jan 12" from an ISO date. */
export function shortDate(iso) {
  return MONTHS[+iso.slice(5, 7) - 1] + " " + (+iso.slice(8, 10));
}

/* --- the record --------------------------------------------------------- */

export function emptyPlan() {
  return { v: PLAN_VERSION, active: null, algo: PLACER_ALGO, courses: [] };
}

/** A new course. `opts.id` names it; otherwise the next free `course_<n>` among
    `opts.taken`. Every field the design names is present. */
export function newCourse(name, opts = {}) {
  return {
    id: opts.id || nextId("course_", opts.taken || []),
    name: String(name || "Course").slice(0, 80),
    color: opts.color || null,
    meets: opts.meets === "A" || opts.meets === "B" ? opts.meets : "all",
    start: opts.start || null,
    pace: {},
    lost: [],
    units: [],
    lessons: [],
    adjustments: [],
    baseline: null,
  };
}

/** A typed unit (a course with no lessons). */
export function newUnit(name, days, opts = {}) {
  return {
    id: opts.id || nextId("unit_", opts.taken || []),
    name: String(name || "Unit").slice(0, 80), color: opts.color || null, code: null,
    days: Math.max(0, Math.floor(Number(days) || 0)), pin: null, flex: 0,
    start: null, end: null, placed: 0, short: 0,
  };
}

/** A course with every array and map present, whatever an older or hand-edited blob held. */
function normalCourse(c) {
  const out = { ...newCourse(c.name, { id: c.id }), ...c };
  ["lost", "units", "lessons", "adjustments"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!isObj(out.pace)) out.pace = {};
  if (out.meets !== "A" && out.meets !== "B") out.meets = "all";
  return out;
}

/** { plan, state: 'none'|'ok'|'broken'|'newer' }. `none` and `broken` give an empty plan
    (the page moves a broken value to `cal.planBroken`, so nothing is thrown away);
    `newer` gives the plan as stored, for a read-only view written back untouched. */
export function readPlan(cal) {
  const p = cal && cal.plan;
  if (p === undefined || p === null) return { plan: emptyPlan(), state: "none" };
  if (!isObj(p) || !Array.isArray(p.courses)) return { plan: emptyPlan(), state: "broken" };
  if (typeof p.v === "number" && p.v > PLAN_VERSION) return { plan: p, state: "newer" };
  if (p.courses.some((c) => !isObj(c) || typeof c.id !== "string" || !c.id)) return { plan: emptyPlan(), state: "broken" };
  const ids = p.courses.map((c) => c.id);
  if (new Set(ids).size !== ids.length) return { plan: emptyPlan(), state: "broken" };
  const plan = { ...emptyPlan(), ...p, v: PLAN_VERSION, courses: p.courses.map(normalCourse) };
  if (plan.active !== null && !ids.includes(plan.active)) plan.active = ids[0] || null;
  return { plan, state: "ok" };
}

/* --- the migration -------------------------------------------------------- */

/** Run by the page after every load and every JSON import; keyed on what it finds, not
    on a version, and idempotent. (1) No plan: an empty one. A broken one is moved to
    `cal.planBroken`. A newer one: nothing is touched. (2) Lessons or bumps in
    `cal.pacing` become a course (meets all, no skips or lost dates, `start` the old
    startDate), and `cal.pacing` is emptied; every lesson lands on the date it had (the
    suite holds the placer to placeLessons()). If an older page later writes lessons
    there again, this makes a second course. (3) `cal.units`, the dated units, is never
    touched (P9-8). Returns { cal, report: { state, made: courseId|null, lessons, bumps,
    second, broken } }; `cal` is a copy. */
export function absorbLegacy(cal) {
  const out = clone(cal);
  const read = readPlan(out);
  const report = { state: read.state, made: null, lessons: 0, bumps: 0, second: false, broken: false };
  if (read.state === "newer") return { cal: out, report };
  if (read.state === "broken") { out.planBroken = out.plan; report.broken = true; }
  const plan = read.plan;
  const pacing = isObj(out.pacing) ? out.pacing : null;
  const lessons = pacing && Array.isArray(pacing.lessons) ? pacing.lessons : [];
  const bumps = pacing && Array.isArray(pacing.adjustments) ? pacing.adjustments : [];
  if (lessons.length || bumps.length) {
    const course = newCourse("Course " + (plan.courses.length + 1), {
      taken: plan.courses.map((c) => c.id), start: pacing.startDate || null,
    });
    course.lessons = clone(lessons);
    course.adjustments = clone(bumps);
    report.second = plan.courses.length > 0;
    plan.courses.push(syncUnits(course));
    if (!plan.active) plan.active = course.id;
    out.pacing = emptyPacing();
    report.made = course.id;
    report.lessons = lessons.length;
    report.bumps = bumps.length;
  }
  out.plan = plan;
  return { cal: out, report };
}

/* --- class days ----------------------------------------------------------- */

function cycleOn(cal) { return !!(cal.abCycle && cal.abCycle.enabled); }

function typeList(cal, iso) {
  const entry = cal.days && cal.days[iso];
  if (!entry || !Array.isArray(entry.types)) return [];
  return entry.types.map((id) => (cal.dayTypes || []).find((t) => t && t.id === id)).filter(Boolean);
}

function isHalfType(t) {
  return !t.noSchool && (t.id === "halfday" || /early dismissal|half day/i.test(String(t.label || "")));
}

/** The first and last date a course can meet. */
export function courseRange(cal, course) {
  return { from: course.start || cal.meta.start, to: cal.meta.end };
}

/** Whether `course` meets on `date`: { meets, why, half, letter }. `why` names the first
    test that fails, in this order: 'outside' (before the course starts or after the
    year ends), 'weekend', 'closed:<typeId>' (a "No school" type), 'skip:<typeId>' (a type
    paced as skip for this course), 'rotation' (an A or B course on the other letter's
    day; with the cycle off the course meets every day and placeCourse reports
    'no-rotation'), 'lost:<id>' (a date this course did not meet). A closing type wins
    over a skipping one, and both over a counting one. A half day is a whole class day,
    marked (P9-1). `letters` is abLetters(cal), passed in by a loop. */
export function dayValue(cal, course, date, letters) {
  const r = courseRange(cal, course);
  const L = letters || abLetters(cal);
  const out = { meets: false, why: null, half: false, letter: L[date] || null };
  if (date < r.from || date > r.to) { out.why = "outside"; return out; }
  if (!isWeekday(date)) { out.why = "weekend"; return out; }
  const types = typeList(cal, date);
  const closing = types.find((t) => t.noSchool);
  if (closing) { out.why = "closed:" + closing.id; return out; }
  const pace = isObj(course.pace) ? course.pace : {};
  const skipping = types.find((t) => (pace[t.id] || t.pace || "count") === "skip");
  if (skipping) { out.why = "skip:" + skipping.id; return out; }
  if ((course.meets === "A" || course.meets === "B") && cycleOn(cal) && out.letter !== course.meets) {
    out.why = "rotation"; return out;
  }
  const lost = (course.lost || []).find((x) => x && x.date === date);
  if (lost) { out.why = "lost:" + lost.id; return out; }
  out.meets = true;
  out.half = types.some(isHalfType);
  return out;
}

/** Every weekday in the course's range: { days: [{ date, half, letter }], excluded:
    [{ date, why }] }. */
export function classDays(cal, course, letters) {
  const L = letters || abLetters(cal);
  const r = courseRange(cal, course);
  const days = [], excluded = [];
  if (!r.from || !r.to || r.from > r.to) return { days, excluded };
  for (let ms = isoToMs(r.from), end = isoToMs(r.to); ms <= end; ms += DAY_MS) {
    const date = msToIso(ms);
    if (!isWeekday(date)) continue;
    const v = dayValue(cal, course, date, L);
    if (v.meets) days.push({ date, half: v.half, letter: v.letter });
    else excluded.push({ date, why: v.why });
  }
  return { days, excluded };
}

/* --- units from lessons --------------------------------------------------- */

/** In a course with lessons, its units are the runs of equal `U<n>` in list order (a code
    that comes back after another unit is a second run, a second unit). Each run keeps the
    record of the same code and run number, so a name, colour, pin and flex survive a
    re-import; `days` is the run's lessons plus the bumps anchored to them. A course with
    no lessons keeps the units it has. Returns a new course. */
export function syncUnits(course) {
  const c = clone(course);
  if (!c.lessons.length) return c;
  const runs = [];
  c.lessons.forEach((l) => {
    const last = runs[runs.length - 1];
    if (last && last.code === l.unit) last.lessonIds.push(l.id);
    else runs.push({ code: l.unit, lessonIds: [l.id] });
  });
  const old = {};
  c.units.forEach((u) => { (old[u.code] = old[u.code] || []).push(u); });
  const seen = {};
  const taken = c.units.map((u) => u.id);
  c.units = runs.map((run) => {
    const k = seen[run.code] = (seen[run.code] || 0) + 1;
    const ids = new Set(run.lessonIds);
    const days = run.lessonIds.length + c.adjustments.filter((a) => ids.has(a.beforeLessonId)).length;
    const prev = old[run.code] && old[run.code][k - 1];
    if (prev) return { ...prev, days };
    const u = newUnit("Unit " + run.code, days, { taken });
    taken.push(u.id);
    u.code = run.code;
    return u;
  });
  return c;
}

/* --- the placer ------------------------------------------------------------ */

/** The course's slots in order: in lesson mode, each lesson preceded by the bumps anchored
    to it (scv-pacing.js's adjustments, in their own order); in typed mode, `days` anonymous
    days a unit. Bumps whose lesson is gone are orphans, as in placeLessons(). */
function slotsOf(course) {
  const slots = [], orphans = [];
  if (course.lessons.length) {
    const unitOf = {};
    let ui = -1, prevCode = null;
    course.lessons.forEach((l) => {
      if (l.unit !== prevCode) { ui++; prevCode = l.unit; }
      unitOf[l.id] = course.units[ui] ? course.units[ui].id : null;
    });
    const before = new Map();
    course.adjustments.forEach((a) => {
      if (!Object.prototype.hasOwnProperty.call(unitOf, a.beforeLessonId)) { orphans.push(a.id); return; }
      if (!before.has(a.beforeLessonId)) before.set(a.beforeLessonId, []);
      before.get(a.beforeLessonId).push(a);
    });
    course.lessons.forEach((l) => {
      (before.get(l.id) || []).forEach((a) => slots.push({ kind: "gap", unitId: unitOf[l.id], adj: a, lessonId: l.id }));
      slots.push({ kind: "lesson", unitId: unitOf[l.id], lesson: l });
    });
  } else {
    course.adjustments.forEach((a) => orphans.push(a.id));
    course.units.forEach((u) => {
      for (let n = 1; n <= u.days; n++) slots.push({ kind: "day", unitId: u.id, n, of: u.days });
    });
  }
  return { slots, orphans };
}

/** Place one course. Returns
      { courseId, classDates: [ISO], excluded: [{ date, why }],
        slots:  { ISO: { kind: 'lesson'|'day'|'gap', unitId, lessonId, n, of, half, reason } },
        byDate: { ISO: lesson }, dateByLessonId: { lessonId: ISO },
        vacated: { ISO: [{ id, reason }] }, adjDates: { adjId: ISO },
        units: [{ id, start, end, days, placed, short, open, half, pin, pinShift, pinIgnored }],
        overflow: [lesson], orphanedAdjustmentIds: [id], problems: [{ code, unitId, detail }] }
    `byDate`, `dateByLessonId`, `vacated`, `overflow` and `orphanedAdjustmentIds` have
    placeLessons()'s shapes, so 032's month grid, week strip, drawer and .ics can read the
    active course with no change of their own; `slots` is the fuller view.
    THE PLACER (increment 2 adds the pins). Take the class days in order and the units in
    order. A unit with a `pin` starts on the first class day on or after it (`pinShift`
    when that is not the pin itself): if that day is later than where the unit before
    ended, the class days between are `open` (counted on the pinned unit); if earlier work
    has run past it, the pinned unit wins and the slots placed on that day or later are
    taken back and counted `short` on their own unit (in lesson mode, `overflow`: "does not
    fit before the next pin or the year's end"). A pin on or before the start of the unit
    before it is not honoured (`pin-before-previous`, `pinIgnored`), so a pin can shorten
    the unit before it but never remove it or reorder the list. A pin with no class day
    after it leaves the unit, and every unit after it, short (`pin-after-year`). The placer
    never changes a count, a pin or the order: it reports what does not fit. */
export function placeCourse(cal, course0, letters) {
  const course = normalCourse(course0);
  const L = letters || abLetters(cal);
  const cd = classDays(cal, course, L);
  const out = {
    courseId: course.id, classDates: cd.days.map((d) => d.date), excluded: cd.excluded,
    slots: {}, byDate: {}, dateByLessonId: {}, vacated: {}, adjDates: {},
    units: [], overflow: [], orphanedAdjustmentIds: [], problems: [],
  };
  if ((course.meets === "A" || course.meets === "B") && !cycleOn(cal)) out.problems.push({ code: "no-rotation", unitId: null, detail: course.meets });
  const { slots, orphans } = slotsOf(course);
  out.orphanedAdjustmentIds = orphans;
  const stats = {}, unitById = {};
  course.units.forEach((u) => {
    unitById[u.id] = u;
    stats[u.id] = { id: u.id, start: null, end: null, days: 0, placed: 0, short: 0, open: 0, half: 0, pin: u.pin || null, pinShift: false, pinIgnored: false };
  });
  // Pass 1: which class day (index into cd.days) each slot gets, or -1.
  const dayOf = new Array(slots.length).fill(-1);
  const N = cd.days.length;
  let i = 0, prevStart = -1, s = 0;
  const firstOnOrAfter = (iso) => { const k = cd.days.findIndex((d) => d.date >= iso); return k < 0 ? N : k; };
  while (s < slots.length) {
    const unitId = slots[s].unitId;
    let e = s;
    while (e < slots.length && slots[e].unitId === unitId) e++;
    const u = unitId ? unitById[unitId] : null;
    const st = unitId ? stats[unitId] : null;
    if (u && typeof u.pin === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u.pin)) {
      const j = firstOnOrAfter(u.pin);
      if (i >= N && prevStart >= N) {
        // A pin after the year's end came before: this unit is short whatever its pin says.
      } else if (j <= prevStart) {
        st.pinIgnored = true;
        out.problems.push({ code: "pin-before-previous", unitId, detail: u.pin });
      } else if (j >= N) {
        out.problems.push({ code: "pin-after-year", unitId, detail: u.pin });
        i = N;
      } else {
        if (cd.days[j].date !== u.pin) st.pinShift = true;
        if (j > i) st.open += j - i;
        else for (let k = 0; k < s; k++) if (dayOf[k] >= j) dayOf[k] = -1;
        i = j;
      }
    }
    prevStart = i;
    for (let k = s; k < e; k++) { if (i < N) dayOf[k] = i++; }
    s = e;
  }
  // Pass 2: the placement from those days.
  const seq = {};
  slots.forEach((sl, k) => {
    const st = sl.unitId && stats[sl.unitId];
    if (st) st.days++;
    const day = dayOf[k] >= 0 ? cd.days[dayOf[k]] : null;
    if (!day) {
      if (st) st.short++;
      if (sl.kind === "lesson") out.overflow.push(sl.lesson);
      return;
    }
    const n = sl.unitId ? (seq[sl.unitId] = (seq[sl.unitId] || 0) + 1) : null;
    if (st) { st.placed++; if (!st.start) st.start = day.date; st.end = day.date; if (day.half) st.half++; }
    if (sl.kind === "lesson") {
      out.byDate[day.date] = sl.lesson;
      out.dateByLessonId[sl.lesson.id] = day.date;
      out.slots[day.date] = { kind: "lesson", unitId: sl.unitId, lessonId: sl.lesson.id, n, of: null, half: day.half, reason: null };
    } else if (sl.kind === "gap") {
      (out.vacated[day.date] = out.vacated[day.date] || []).push({ id: sl.adj.id, reason: sl.adj.reason || "" });
      out.adjDates[sl.adj.id] = day.date;
      out.slots[day.date] = { kind: "gap", unitId: sl.unitId, lessonId: sl.lessonId, n, of: null, half: day.half, reason: sl.adj.reason || "" };
    } else {
      out.slots[day.date] = { kind: "day", unitId: sl.unitId, lessonId: null, n: sl.n, of: sl.of, half: day.half, reason: null };
    }
  });
  out.units = course.units.map((u) => stats[u.id]);
  out.units.forEach((u) => {
    if (u.days === 0) out.problems.push({ code: "empty-unit", unitId: u.id, detail: null });
    else if (u.short) out.problems.push({ code: "short", unitId: u.id, detail: u.short });
  });
  Object.values(out.slots).forEach((x) => { if (x.unitId && stats[x.unitId]) x.of = x.of || stats[x.unitId].days; });
  if (!cd.days.length) out.problems.push({ code: "no-class-days", unitId: null, detail: null });
  return out;
}

/** One placement a course, keyed by id. A newer or broken plan places nothing. */
export function placePlan(cal) {
  const { plan, state } = readPlan(cal);
  const out = {};
  if (state !== "ok") return out;
  const L = abLetters(cal);
  plan.courses.forEach((c) => { out[c.id] = placeCourse(cal, c, L); });
  return out;
}

/* --- dated units into a course, and letting pins go (increment 2) ------------ */

/** Turn some of `cal.units` (the dated units of the Units card, P9-8: kept until the
    teacher asks) into one new course with no lessons. The chosen units are sorted by
    start; the conversion is refused, with the pairs named, if two of them overlap
    (`overlap`), if one has no valid range (`no-dates`), or if one holds no school day
    inside the year (`no-school-day`). Otherwise each becomes a typed unit pinned at its
    start (or the year's first day, if it starts before it) with the school days its
    range counts inside the year, so the course places every unit on the same school days
    it covered (the suite holds that for every start/end pair in the seed year), unless a
    day type is paced as skip. Nothing is written: returns { course, refused: [{ a, b,
    why }], removeIds }, and the page previews the course before it adds it and drops
    `removeIds` from `cal.units`. `opts.name` names the course, `opts.taken` its ids. */
export function convertDatedUnits(cal, unitIds, opts = {}) {
  const want = new Set(unitIds || []);
  const chosen = (Array.isArray(cal.units) ? cal.units : []).filter((u) => u && want.has(u.id));
  const refused = [];
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  const lo = cal.meta.start, hi = cal.meta.end;
  const ranged = [];
  chosen.forEach((u) => {
    if (!ok.test(String(u.start)) || !ok.test(String(u.end)) || u.start > u.end) { refused.push({ a: u.id, b: null, why: "no-dates" }); return; }
    const from = u.start < lo ? lo : u.start, to = u.end > hi ? hi : u.end;
    const days = from <= to ? unitInstructionalStats(from, to, cal.days, cal.dayTypes).instructionalDays : 0;
    if (!days) { refused.push({ a: u.id, b: null, why: "no-school-day" }); return; }
    ranged.push({ u, from, days });
  });
  ranged.sort((x, y) => (x.u.start < y.u.start ? -1 : x.u.start > y.u.start ? 1 : 0));
  for (let k = 1; k < ranged.length; k++) {
    for (let m = 0; m < k; m++) {
      if (ranged[m].u.end >= ranged[k].u.start) refused.push({ a: ranged[m].u.id, b: ranged[k].u.id, why: "overlap" });
    }
  }
  const course = newCourse(opts.name || "Units", { taken: opts.taken || [] });
  const taken = [];
  ranged.forEach(({ u, from, days }) => {
    const unit = newUnit(u.name || "Unit", days, { taken, color: u.color || null });
    taken.push(unit.id);
    unit.pin = from;
    course.units.push(unit);
  });
  return { course, refused, removeIds: refused.length ? [] : ranged.map((r) => r.u.id) };
}

/** "Let these flow": a copy of `course` with every pin after the first unit's cleared,
    so a lost day moves the units after it instead of shortening the one before a pin.
    The first unit keeps its pin, which holds the start. */
export function unpinAfterFirst(course) {
  const c = clone(course);
  (c.units || []).forEach((u, k) => { if (k > 0) u.pin = null; });
  return c;
}

/** The sentence for a problem the placer reports about a unit, or "" for none. */
export function unitProblemText(p, unitName) {
  const n = unitName || "This unit";
  if (p.code === "pin-before-previous") return n + " is pinned to " + shortDate(p.detail) + ", on or before the start of the unit before it, so the pin is not used.";
  if (p.code === "pin-after-year") return n + " is pinned to " + shortDate(p.detail) + ", after the course's last class day, so none of it fits.";
  if (p.code === "empty-unit") return n + " has no days.";
  return "";
}

/* --- stamping and the diff --------------------------------------------------- */

/** A copy of `cal` with each placement's dates written into its course: `on` on every
    lesson and bump (null when it does not fit), and each unit's start, end, placed and
    short. What a reader outside 032 gets without running a placer. */
export function stamp(cal, placements) {
  const out = clone(cal);
  if (!isObj(out.plan) || !Array.isArray(out.plan.courses)) return out;
  out.plan.algo = PLACER_ALGO;
  out.plan.courses.forEach((c) => {
    const p = placements[c.id];
    if (!p || !isObj(c)) return;
    (c.lessons || []).forEach((l) => { l.on = p.dateByLessonId[l.id] || null; });
    (c.adjustments || []).forEach((a) => { a.on = p.adjDates[a.id] || null; });
    (c.units || []).forEach((u) => {
      const s = p.units.find((x) => x.id === u.id);
      if (!s) return;
      u.start = s.start; u.end = s.end; u.placed = s.placed; u.short = s.short;
    });
  });
  return out;
}

/** The dates stamped into a course, as a placement-shaped view: { courseId,
    dateByLessonId, adjDates, units: [{ id, start, end, placed, short }], overflowIds }. */
export function stored(course) {
  const c = normalCourse(course);
  const out = { courseId: c.id, dateByLessonId: {}, adjDates: {}, units: [], overflowIds: [] };
  c.lessons.forEach((l) => { if (l.on) out.dateByLessonId[l.id] = l.on; else if (l.on === null) out.overflowIds.push(l.id); });
  c.adjustments.forEach((a) => { if (a.on) out.adjDates[a.id] = a.on; });
  out.units = c.units.map((u) => ({ id: u.id, name: u.name, start: u.start || null, end: u.end || null, placed: u.placed || 0, short: u.short || 0 }));
  return out;
}

/** What changed between two placements of one course (`before` from stored() or
    placeCourse(), `after` from placeCourse()): { moved: [{ kind: 'lesson'|'unit', id,
    label, from, to, by }], newlyShort: [lessonId], nowFits: [lessonId], past, summary }.
    `by` is the number of the course's class days (in `after`) between the two dates, the
    later one counted, negative when earlier; null when `after` has no classDates. A unit
    is listed when its end moved; in a course with no lessons, also in `shortUnits` when
    its short count changed. `pinned` says a unit holds a pin, for the sentence. `past` counts moved lessons whose old date is before
    `todayISO`, the surprising ones (P9-6: recomputed, not frozen). `lessons` (the
    course's) gives a lesson its label. */
export function diffPlacement(before, after, todayISO, lessons) {
  const label = {};
  (lessons || []).forEach((l) => { label[l.id] = l.raw || l.id; });
  const dates = after.classDates || null;
  const countIn = (lo, hi) => dates.filter((d) => d > lo && d <= hi).length;
  const by = (from, to) => (!dates ? null : to >= from ? countIn(from, to) : -countIn(to, from));
  const moved = [], shortUnits = [];
  const typed = !(lessons && lessons.length);
  const bOver = new Set(before.overflowIds || (before.overflow || []).map((l) => l.id));
  const aOver = new Set((after.overflow || []).map((l) => l.id));
  Object.keys(before.dateByLessonId || {}).forEach((id) => {
    const from = before.dateByLessonId[id], to = after.dateByLessonId[id];
    if (to && to !== from) moved.push({ kind: "lesson", id, label: label[id] || id, from, to, by: by(from, to) });
  });
  const newlyShort = [...aOver].filter((id) => !bOver.has(id));
  const nowFits = [...bOver].filter((id) => !aOver.has(id) && after.dateByLessonId[id]);
  const names = {};
  (before.units || []).forEach((u) => { if (u.name) names[u.id] = u.name; });
  (after.units || []).forEach((u) => {
    const b = (before.units || []).find((x) => x.id === u.id);
    if (b && b.end && u.end && b.end !== u.end) moved.push({ kind: "unit", id: u.id, label: names[u.id] || u.id, from: b.end, to: u.end, by: by(b.end, u.end) });
    if (typed && b && (b.short || 0) !== (u.short || 0)) shortUnits.push({ id: u.id, label: names[u.id] || u.id, from: b.short || 0, to: u.short || 0 });
  });
  const lessonsMoved = moved.filter((m) => m.kind === "lesson");
  const past = todayISO ? lessonsMoved.filter((m) => m.from < todayISO).length : 0;
  const pinned = (after.units || []).some((u) => u.pin && !u.pinIgnored);
  return {
    moved, newlyShort, nowFits, past, shortUnits, pinned,
    summary: { lessons: lessonsMoved.length, units: moved.length - lessonsMoved.length, newlyShort: newlyShort.length, nowFits: nowFits.length, past },
  };
}

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
function byWords(by) {
  if (by === null) return "";
  const a = Math.abs(by);
  if (!a) return " to another date";
  return " " + (a === 1 ? "one class day" : a + " class days") + (by > 0 ? " later" : " earlier");
}

/** The notice bar's sentence for a diff, or "" when nothing moved. */
export function describeDiff(diff) {
  const parts = [];
  const lessons = diff.moved.filter((m) => m.kind === "lesson");
  if (lessons.length) {
    const bys = new Set(lessons.map((m) => m.by));
    parts.push("moved " + plural(lessons.length, "lesson", "lessons") + (bys.size === 1 ? byWords(lessons[0].by) : ""));
  }
  diff.moved.filter((m) => m.kind === "unit").forEach((m) => {
    parts.push(m.label + " now ends " + shortDate(m.to) + ", was " + shortDate(m.from));
  });
  if (diff.newlyShort.length) parts.push(plural(diff.newlyShort.length, "lesson no longer fits", "lessons no longer fit") + (diff.pinned ? " before a pinned unit or the year's end" : " before the year ends"));
  (diff.shortUnits || []).forEach((u) => {
    parts.push(u.label + (u.to ? " is now " + plural(u.to, "day", "days") + " short" : " fits again") + (u.from && u.to ? ", was " + u.from : ""));
  });
  if (diff.nowFits.length) parts.push(plural(diff.nowFits.length, "lesson fits", "lessons fit") + " again");
  if (!parts.length) return "";
  let s = parts.join("; ");
  s = s.charAt(0).toUpperCase() + s.slice(1) + ".";
  if (diff.past) s += " " + plural(diff.past, "of them was", "of them were") + " already past.";
  return s;
}
