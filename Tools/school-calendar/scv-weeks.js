// scv-weeks.js — the School Calendar Visualizer's A/B letters and its weeks, as pure functions.
//
// DOM-free and localStorage-free so plain `node` can walk whole school years in
// test/smoke-weeks-core.mjs. The page still owns rendering; this file owns the date
// arithmetic, and it is the ONE place the A/B letter of a day is decided: the month grid, the
// year grid's badges and the printed weeks all read `abLetters()`, so they cannot disagree.
//
// Dates here are calendar dates ("YYYY-MM-DD"), never instants. Every step is done in UTC
// milliseconds on a date at 00:00 UTC, so a daylight-saving change (a 23- or 25-hour local
// day) and the machine's zone cannot move a date; `new Date(iso + "T00:00:00")` followed by
// setDate() is what this file replaces.
//
// Nothing here is stored. `scv_calendar_v1` keeps its shape: other tools read it raw.

import { isTeachableDay } from "./scv-pacing.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoToMs(dateISO) {
  const [y, m, d] = String(dateISO).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function msToIso(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

export function addDays(dateISO, n) { return msToIso(isoToMs(dateISO) + n * DAY_MS); }

/** 0 = Sunday .. 6 = Saturday, by the calendar date alone. */
export function dayOfWeek(dateISO) { return new Date(isoToMs(dateISO)).getUTCDay(); }

export function isValidIso(dateISO) {
  if (typeof dateISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  return msToIso(isoToMs(dateISO)) === dateISO;
}

/* --- the A/B letters ---------------------------------------------------------
   The rule the month grid has always followed: the letter alternates on every
   school day (a weekday not tagged with a "No school" type, by the pacing module's
   predicate), skipping weekends and no-school days without advancing. The walk covers the
   calendar's own range, widened to take in the anchor date when that lies outside it.

   One property of the rule is kept on purpose, because a calendar saved before this file
   existed prints by it: the walk is lined up on the first day of that range from the count
   of school days strictly between it and the anchor. When the range's first day is itself a
   school day and the anchor falls LATER, that lines the cycle up one step off, so the anchor
   date shows the opposite of the letter the teacher gave it. test/smoke-weeks-core.mjs pins
   that by name (ANCHOR_QUIRK), BACKLOG says what fixing it would change, and nothing here
   "improves" it. */

function eligible(cal, dateISO) { return isTeachableDay(dateISO, cal.days, cal.dayTypes); }

function countEligibleStrictlyBetween(cal, aISO, bISO) {
  let n = 0;
  for (let ms = isoToMs(aISO) + DAY_MS, end = isoToMs(bISO); ms < end; ms += DAY_MS) {
    if (eligible(cal, msToIso(ms))) n++;
  }
  return n;
}

/** date -> "A" | "B" for every school day in the range; {} when the cycle is off. */
export function abLetters(cal) {
  const map = {};
  const ac = cal && cal.abCycle;
  if (!ac || !ac.enabled || !ac.anchorDate) return map;
  const anchorISO = ac.anchorDate;
  const anchorLetter = ac.anchorLetter === "B" ? "B" : "A";
  const lo = anchorISO < cal.meta.start ? anchorISO : cal.meta.start;
  const hi = anchorISO > cal.meta.end ? anchorISO : cal.meta.end;
  if (lo > hi) return map;

  let letter;
  if (lo === anchorISO) {
    letter = anchorLetter;
  } else {
    const between = lo < anchorISO ? countEligibleStrictlyBetween(cal, lo, anchorISO) : countEligibleStrictlyBetween(cal, anchorISO, lo);
    letter = (between % 2 === 0) ? anchorLetter : (anchorLetter === "A" ? "B" : "A");
  }
  for (let ms = isoToMs(lo), end = isoToMs(hi); ms <= end; ms += DAY_MS) {
    const dateISO = msToIso(ms);
    if (eligible(cal, dateISO)) {
      map[dateISO] = letter;
      letter = letter === "A" ? "B" : "A";
    }
  }
  return map;
}

/** What the year grid's cell for a day says about the cycle, as text:
    "letter" (a school day: its A or B), "off" (a weekday with no school: an en dash,
    plainly not a letter), or null (a weekend, or the cycle is off). */
export function yearBadge(cal, abMap, dateISO) {
  if (!abMap || !Object.keys(abMap).length) return null;
  const letter = abMap[dateISO];
  if (letter) return { kind: "letter", text: letter, spoken: letter + " day" };
  if (dayOfWeek(dateISO) === 0 || dayOfWeek(dateISO) === 6) return null;
  if (!eligible(cal, dateISO)) return { kind: "off", text: "–", spoken: "no school" };
  return null;
}

/* --- weeks --------------------------------------------------------------------
   A printed week is Monday to Friday, the five columns the one-week strip has always had. */

/** The Monday of the week containing the date (Sunday counts with the week before it). */
export function mondayOf(dateISO) {
  if (!isValidIso(dateISO)) return null;
  return addDays(dateISO, -((dayOfWeek(dateISO) + 6) % 7));
}

/** The five dates of the week that starts on `mondayISO`. */
export function weekDates(mondayISO) { return [0, 1, 2, 3, 4].map((i) => addDays(mondayISO, i)); }

/** A week with at least one of its five days inside [start, end]. */
export function weekTouches(mondayISO, start, end) {
  const fri = addDays(mondayISO, 4);
  return !(fri < start || mondayISO > end);
}

export const MAX_WEEKS = 60;

/** The Mondays of every week from the one containing `fromISO` to the one containing
    `throughISO`, leaving out any week with no day inside the calendar. With no usable
    `throughISO` (blank, invalid, or earlier than `fromISO`) it is the one week of `fromISO`,
    kept even when it lies outside the calendar, as the one-week print has always done.
    Never more than MAX_WEEKS. */
export function weekRange(fromISO, throughISO, start, end) {
  const first = mondayOf(fromISO);
  if (!first) return [];
  const last = isValidIso(throughISO) ? mondayOf(throughISO) : null;
  if (!last || last <= first) return [first];
  const out = [];
  for (let m = first; m <= last && out.length < MAX_WEEKS; m = addDays(m, 7)) {
    if (weekTouches(m, start, end)) out.push(m);
  }
  return out;
}
