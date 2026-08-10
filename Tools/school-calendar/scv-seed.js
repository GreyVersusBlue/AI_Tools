// scv-seed.js — default day-type legend + the 2026-27 CCPS calendar,
// transcribed from the "School Notes" column of the AB pacing spreadsheet.
// Multi-day closures (Winter Break, Spring Break) are expanded to one entry
// per calendar day so each day is independently editable.

export const VERSION = 1;

// `noSchool: true` marks a type as taking a weekday out of the instructional-day
// count (see the calendar's "instructional days" summary line) — students
// aren't in the building that day. Half days, testing windows, marking-period
// boundaries, and first/last day all still have students present, so they
// default to false/unset.
export const DEFAULT_DAY_TYPES = [
  { id: "holiday",   label: "Holiday / No School",        color: "#a3372b", pattern: "solid",    abbr: "H",  noSchool: true },
  { id: "halfday",   label: "Half Day / Early Dismissal",  color: "#c98a1f", pattern: "diagonal", abbr: "½"  },
  { id: "workday",   label: "Teacher Workday (No Students)", color: "#6d4aa0", pattern: "dots",   abbr: "PD", noSchool: true },
  { id: "testing",   label: "Testing Window",              color: "#2e6b8f", pattern: "cross",   abbr: "T"  },
  { id: "mpend",     label: "Marking Period Boundary",     color: "#2e6b3e", pattern: "stripe",  abbr: "MP" },
  { id: "firstlast", label: "First / Last Day",            color: "#1f3550", pattern: "solid",   abbr: "★"  }
];

function toLocalISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}

function range(startISO, endISO) {
  // Both the parse (local midnight, no "Z") and the render (local getters,
  // not toISOString's UTC) must stay in the same timezone, or every date in
  // a timezone ahead of UTC comes out one day early.
  const out = [];
  let d = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  while (d <= end) {
    out.push(toLocalISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function buildDays() {
  const days = {};
  const set = (date, types, label) => { days[date] = { types, label: label || "", note: "", lesson: "" }; };

  set("2026-08-31", ["firstlast"], "First Day for Students");
  set("2026-09-07", ["holiday"], "Labor Day");
  set("2026-09-18", ["halfday"], "Early Dismissal — Professional Learning");
  set("2026-10-15", ["halfday"], "Early Dismissal — Professional Learning");
  set("2026-10-16", ["workday"], "Professional Learning / Meeting Day (No Students)");
  set("2026-11-03", ["holiday"], "Election Day");
  set("2026-11-04", ["halfday", "mpend"], "End of Marking Period — Early Dismissal");
  set("2026-11-20", ["halfday"], "Early Dismissal — Professional Learning");
  set("2026-11-25", ["halfday"], "Early Dismissal — Last Day Before Thanksgiving");
  set("2026-11-26", ["holiday"], "Thanksgiving Holiday");
  set("2026-11-27", ["holiday"], "Thanksgiving Holiday");
  set("2026-12-14", ["halfday"], "Early Dismissal — Professional Learning");
  set("2026-12-23", ["halfday"], "Early Dismissal — Last Day Before Winter Break");
  for (const d of range("2026-12-24", "2026-12-31")) set(d, ["holiday"], "Winter Break");
  set("2027-01-01", ["holiday"], "New Year's Day");
  set("2027-01-04", [], "Schools/Offices Reopen");
  set("2027-01-18", ["holiday"], "Martin Luther King, Jr. Day");
  set("2027-01-22", ["workday", "mpend"], "End of Marking Period / Professional Learning (No Students)");
  set("2027-02-12", ["halfday"], "Early Dismissal — Professional Learning");
  set("2027-02-15", ["holiday"], "Presidents' Day");
  set("2027-03-01", ["workday"], "Professional Development Day (No Students)");
  set("2027-03-12", ["halfday"], "Early Dismissal — Professional Learning");
  for (const d of range("2027-03-25", "2027-03-30")) set(d, ["holiday"], "Spring Break");
  set("2027-04-07", ["halfday", "mpend"], "End of Marking Period — Early Dismissal");
  set("2027-04-30", ["halfday"], "Early Dismissal — Professional Learning");
  set("2027-05-28", ["halfday"], "Early Dismissal — Professional Learning");
  set("2027-05-31", ["holiday"], "Memorial Day");
  set("2027-06-11", ["firstlast", "halfday"], "Last Day for Students — Early Dismissal");

  return days;
}

export function seedCalendar2026() {
  return {
    __v: VERSION,
    meta: { yearLabel: "2026–27 School Year", start: "2026-08-31", end: "2027-06-11" },
    dayTypes: DEFAULT_DAY_TYPES.map(t => ({ ...t })),
    days: buildDays()
  };
}

export function blankCalendar(yearLabel, start, end) {
  return {
    __v: VERSION,
    meta: { yearLabel: yearLabel || "School Year", start: start || "2026-08-31", end: end || "2027-06-11" },
    dayTypes: DEFAULT_DAY_TYPES.map(t => ({ ...t })),
    days: {}
  };
}
