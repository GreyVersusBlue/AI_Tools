// np-seat-equity.js — joins the Equity dashboard to the seating chart, so a
// call rate can be read by row and by region of the room, not only by name.
//
// np-equity.js already answers "who have I actually been calling on" from
// dates. What it cannot say is *where* the students who are not being called
// sit — and "you call on the back row a third as often" is a sharper finding
// for a teacher to bring to an evaluation or an IEP meeting than any single
// student's count. The improvement-prompt doc names this as the next equity
// item, and the data to answer it already exists in two keys this tool did
// not used to read together.
//
// `seating-chart-v1` is owned by Tools/005-Seating Chart Generator.html /
// Tools/seating-chart/seating.mjs — this file only ever reads it. The key
// name is a permanent, non-versioned name by locked repo decision; nothing
// here writes it, migrates it, or assumes a shape stricter than "an object
// with a `sections` array", because a corrupt or absent chart must leave the
// Equity tab exactly as useful as it was before this file existed.
//
// The desk-geometry constants below (106x70 layout-px) are copied from
// Tools/seating-chart/seating.mjs's `ROOM`, not imported from it — the same
// choice 010-command-center-dashboard.html already made for the same reason:
// this tool reads another tool's *storage key*, not its module, so the two
// stay free to change their own internals independently. If ROOM ever
// changes there, a stale desk box here is the cost, and it is a cosmetic one
// (rows/regions are relative to the desks' own extent, not to these numbers).
//
// Two joins happen here, both loose on purpose:
//
//   1. Which seating-chart SECTION is "this roster" — matched by name the
//      same way 010-command-center-dashboard.html matches a class period to
//      a section, because Name Picker's roster names and the chart's section
//      names are typed independently and rarely match byte-for-byte.
//   2. Which SEATED STUDENT is which np_history NAME — matched by a
//      case/punctuation/whitespace-insensitive key, the same strength of
//      "loose" _shared/student-details.js already uses for the same reason.
//      This is not nickname-aware or fuzzy in the typo-tolerant sense: a
//      seated "Bobby Chen" will not match a roster "Robert Chen". A seated
//      student who cannot be matched is left out of the report rather than
//      guessed at, and the caller can show how many were dropped.
//
// And one caveat this file cannot fix, only inherit: np_history is capped at
// 500 entries (np-store.js), so a seat-position report built from it carries
// the exact same truncation risk np-equity.js already flags. Callers should
// surface the same `truncated` signal np-equity's report() already computes.
//
// DOM-free. Imported by the page and by the Node suite.

/** The Seating Chart Generator's storage key. Read-only here. */
export const SEATING_KEY = "seating-chart-v1";

/* Copied from Tools/seating-chart/seating.mjs's ROOM — see file header. */
const DESK_W = 106, DESK_H = 70;

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);

/** Lowercase, alphanumeric-only, whitespace-collapsed. The loose-match key
    for both section names and student names throughout this file. */
export function looseKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Parse a `seating-chart-v1` JSON string into `{sections, active}` or `null`.
 * Never throws — a missing key, a hand-edited file, or a shape from some
 * future version of the Seating Chart Generator all read the same as "no
 * chart available", which is what lets this feature stand quietly next to a
 * teacher who has never opened that tool.
 */
export function parseSeatingState(raw) {
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  if (!isObj(parsed) || !Array.isArray(parsed.sections) || !parsed.sections.length) return null;
  return parsed;
}

/** Guarded read of the live key. `storage` is injectable so the Node suite
    can drive it without a DOM, the same shape np-store.js uses. */
export function loadSeatingState(storage) {
  try { return parseSeatingState(storage.getItem(SEATING_KEY)); }
  catch (e) { return null; }
}

/**
 * Which section of the chart is "this roster". Tried in order: an exact
 * loose-name match, then a substring match either direction (a roster saved
 * as "Period 3" against a section named "Period 3 - Honors Bio", the same
 * looseness 010-command-center-dashboard.html's `sameClass` allows for the
 * same reason), then whatever the chart itself has marked active, then
 * simply the first section — so a one-section chart (the common case for a
 * teacher who only ever seats one class) always resolves without needing
 * the roster name to match anything.
 */
export function pickSection(state, rosterName) {
  if (!state || !Array.isArray(state.sections) || !state.sections.length) return null;
  const byId = {};
  state.sections.forEach(s => { if (s && s.id) byId[s.id] = s; });

  const want = looseKey(rosterName);
  if (want) {
    const exact = state.sections.find(s => s && looseKey(s.name) === want);
    if (exact) return exact;
    const loose = state.sections.find(s => {
      const k = looseKey(s && s.name);
      return k && (k.indexOf(want) !== -1 || want.indexOf(k) !== -1);
    });
    if (loose) return loose;
  }
  return byId[state.active] || state.sections[0];
}

/**
 * One entry per currently-seated student: id, name, the desk's own x/y (the
 * chart's layout-px space), a 1-based `row` (1 = closest to the front), and
 * a `region` label combining depth (front/middle/back) and side
 * (left/center/right) — nine possible labels, fewer if the desks do not
 * span all three bands of either axis.
 *
 * Desks are grouped into rows by a single chain pass over y, sorted
 * ascending: a desk starts a new row only when it sits further than
 * `DESK_H * 0.6` past the previous one, the same tolerance
 * Tools/seating-chart/seating.mjs's own `frontRowDeskIds` uses to decide
 * what counts as "the front row" for its rotation-fairness report. That
 * makes a straight-row layout resolve to exactly one row per visual row; a
 * pod or cluster layout resolves to something looser, which is expected —
 * region, not row, is the more meaningful axis for a room like that.
 *
 * Region bands are thirds of the seated students' own bounding box, not of
 * the fixed 1280x900 room — a chart that only uses the left half of the
 * room still gets a meaningful left/center/right split.
 *
 * An empty desk, or a desk whose `assign` points at a student id no longer
 * on the roster, contributes nothing — there is no name to attribute a call
 * rate to.
 */
export function derivePositions(section) {
  if (!section || !Array.isArray(section.desks) || !section.desks.length) return [];
  const assign = isObj(section.assign) ? section.assign : {};
  const byId = {};
  (Array.isArray(section.students) ? section.students : []).forEach(s => { if (s && s.id) byId[s.id] = s; });

  const seated = [];
  for (const d of section.desks) {
    if (!d || !d.id) continue;
    const student = byId[assign[d.id]];
    if (!student || !student.name) continue;
    seated.push({ deskId: d.id, studentId: student.id, name: student.name, x: Number(d.x) || 0, y: Number(d.y) || 0 });
  }
  if (!seated.length) return [];

  // Rows: a chain pass over y, ascending. A new row starts whenever the gap
  // to the previous desk exceeds the tolerance, so ties and near-ties (a
  // hand-nudged desk a few px off its neighbours) land in the same row.
  const tolerance = DESK_H * 0.6;
  const byY = seated.slice().sort((a, b) => a.y - b.y);
  let row = 0, prevY = null;
  for (const s of byY) {
    if (prevY === null || s.y - prevY > tolerance) row++;
    s.row = row;
    prevY = s.y;
  }

  const xs = seated.map(s => s.x), ys = seated.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + DESK_W;
  const minY = Math.min(...ys), maxY = Math.max(...ys) + DESK_H;
  const thirdX = (maxX - minX) / 3 || 1, thirdY = (maxY - minY) / 3 || 1;
  const band = (v, min, third, labels) => labels[Math.min(2, Math.max(0, Math.floor((v - min) / third)))];

  for (const s of seated) {
    const cx = s.x + DESK_W / 2, cy = s.y + DESK_H / 2;
    const depth = band(cy, minY, thirdY, ["front", "middle", "back"]);
    const side = band(cx, minX, thirdX, ["left", "center", "right"]);
    s.region = `${depth}-${side}`;
  }
  return seated;
}

/**
 * Loose-name-join `positions` (from `derivePositions`) against `equityRows`
 * — the `rows` array np-equity.js's `report()` already returns, reused
 * rather than recomputed so a seat report and the name-only Equity view can
 * never disagree about a pick count for the same student.
 *
 * Returns `{matched, unmatched}`. `matched` entries carry the position's
 * seat data plus `count` (picks in the report's window), `lifetime`, and
 * `daysSince` from the joined row. `unmatched` is the plain list of seated
 * names that found no loose match — a seated student typed differently in
 * the two tools, or simply not on the roster loaded into the picker right
 * now — so the caller can report how many seats were left out rather than
 * silently under-counting.
 */
export function joinCallRates(positions, equityRows) {
  const byLoose = new Map();
  for (const r of (equityRows || [])) {
    const key = looseKey(r && r.name);
    if (key && !byLoose.has(key)) byLoose.set(key, r);
  }
  const matched = [], unmatched = [];
  for (const p of (positions || [])) {
    const hit = byLoose.get(looseKey(p.name));
    if (hit) matched.push({ ...p, count: hit.count, lifetime: hit.lifetime, daysSince: hit.daysSince, matchedName: hit.name });
    else unmatched.push(p.name);
  }
  return { matched, unmatched };
}

/** Group `matched` entries by `keyFn`, averaging picks-in-window per seat.
    `order`, if given, sorts by position in that list rather than by key. */
function aggregate(matched, keyFn, order) {
  const groups = new Map();
  for (const m of matched) {
    const key = keyFn(m);
    if (!groups.has(key)) groups.set(key, { key, seats: 0, totalCount: 0, totalLifetime: 0 });
    const g = groups.get(key);
    g.seats++;
    g.totalCount += m.count;
    g.totalLifetime += m.lifetime;
  }
  const out = Array.from(groups.values()).map(g => ({ ...g, avgCount: g.seats ? g.totalCount / g.seats : 0 }));
  out.sort(order ? (a, b) => order.indexOf(a.key) - order.indexOf(b.key)
                 : (a, b) => (typeof a.key === "number" && typeof b.key === "number") ? a.key - b.key : String(a.key).localeCompare(String(b.key)));
  return out;
}

const REGION_ORDER = ["front-left", "front-center", "front-right", "middle-left", "middle-center", "middle-right", "back-left", "back-center", "back-right"];

/** `[{key: row number, seats, totalCount, totalLifetime, avgCount}]`, front row first. */
export function byRow(matched) { return aggregate(matched || [], m => m.row); }

/** Same shape, keyed by the nine region labels, front-to-back then left-to-right. */
export function byRegion(matched) { return aggregate(matched || [], m => m.region, REGION_ORDER); }

/**
 * The whole join in one call: pick the section, derive positions, join
 * against `equityRows`, and roll up by row and region. Returns `null` only
 * when there is no seating chart to read at all (so the caller can hide the
 * feature) — a chart with no seats filled in yet returns a report with
 * `seated: 0` instead, so the caller can say *that* rather than nothing.
 */
export function seatEquityReport(state, rosterName, equityRows) {
  const section = pickSection(state, rosterName);
  if (!section) return null;
  const positions = derivePositions(section);
  const { matched, unmatched } = joinCallRates(positions, equityRows);
  return {
    sectionName: section.name || "",
    seated: positions.length,
    matched: matched.length,
    unmatched,
    byRow: byRow(matched),
    byRegion: byRegion(matched)
  };
}

/** A one-line summary in the same spirit as np-equity.js's `summaryLine` —
    plain text, meant to sit on a printed page. */
export function seatSummaryLine(rep) {
  if (!rep) return "No seating chart found in this browser.";
  if (!rep.seated) return rep.sectionName ? `"${rep.sectionName}" has no seats assigned yet.` : "The seating chart has no seats assigned yet.";
  const bits = [`${rep.matched} of ${rep.seated} seated student${rep.seated === 1 ? "" : "s"} matched to pick history`];
  if (rep.byRow.length >= 2) {
    const withPicks = rep.byRow.filter(r => r.totalCount > 0);
    if (withPicks.length >= 2) {
      const most = withPicks.reduce((a, b) => (b.avgCount > a.avgCount ? b : a));
      const least = withPicks.reduce((a, b) => (b.avgCount < a.avgCount ? b : a));
      if (most.key !== least.key && most.avgCount > 0) {
        const pct = Math.round((least.avgCount / most.avgCount) * 100);
        bits.push(`row ${least.key} is called ${pct}% as often as row ${most.key}`);
      }
    }
  }
  if (rep.unmatched.length) bits.push(`${rep.unmatched.length} seated student${rep.unmatched.length === 1 ? "" : "s"} could not be matched by name`);
  return bits.join(" · ") + ".";
}

export default {
  SEATING_KEY, looseKey, parseSeatingState, loadSeatingState, pickSection,
  derivePositions, joinCallRates, byRow, byRegion, seatEquityReport, seatSummaryLine
};
