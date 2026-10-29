// np-dashboard.js — the Name Picker's equity dashboard, as numbers: who was called on in which week, per period.
//
// The input is what np-rollup.js view() returns, `{ days: { 'YYYY-MM-DD': { <key>: n } }, who }` — every pick on
// record, the live 500-entry window and the rollup of the picks it let go, as one count per day per student key. The
// output is plain data a page draws and a sheet prints. Nothing here reads storage, the DOM or the clock (`today` is an
// argument), and nothing is stored: the dashboard is a reading of records the tool already keeps.
//
// A PERIOD IS A SAVED ROSTER. A history entry carries no roster, and giving it one would write a new fact about a
// student to disk, so a period is read off `np_rosters` when the view is built: a student counts in every roster whose
// list holds the name. A name on two rosters counts on both, and the sheet's lines say so.
//
// A student's key is the Class Roster Hub id when idOf(name, rosterName) finds one and 'n:' + the normalised name when it
// does not. A pick folded before an id existed is stored under the name key, so a student is matched on both and the
// counts add; nothing stored is ever rewritten here.

import { shiftDay, daysBetween } from './np-equity.js';
import { normalize } from './np-rollup.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const QUIET_DAYS = 21;                 // "not called on in three weeks"
export const WEEK_CHOICES = [4, 8, 12];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** The Monday of the local week that holds `day` (`YYYY-MM-DD`), as `YYYY-MM-DD`. */
export function weekStart(day) {
  const p = new Date(day + 'T00:00:00');
  if (Number.isNaN(p.getTime())) return day;
  return shiftDay(day, -((p.getDay() + 6) % 7));
}

/** "Oct 5" for `2026-10-05`, with no locale in it. */
export function dayLabel(day) {
  const m = DAY.test(day) ? Number(day.slice(5, 7)) : 0;
  return m ? `${MONTHS[m - 1]} ${Number(day.slice(8, 10))}` : String(day);
}

/** The Mondays of the last `n` weeks, oldest first, the last being the week that holds `today`. */
export function weekList(today, n) {
  const last = weekStart(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftDay(last, -7 * i));
  return out;
}

/** The keys a roster name can be stored under, the id first. */
export function keysFor(name, rosterName, idOf) {
  const norm = normalize(name);
  if (!norm) return [];
  const id = typeof idOf === 'function' ? idOf(name, rosterName) : null;
  return typeof id === 'string' && id ? [id, 'n:' + norm] : ['n:' + norm];
}

/** Every key's counts by week, its last dated day, and the undated picks, in one pass over the days. */
function tally(view, weeks) {
  const first = weeks[0], index = new Map(weeks.map((w, i) => [w, i]));
  const byKey = {};
  let since = null;
  for (const [day, cells] of Object.entries((view && view.days) || {})) {
    if (!isObj(cells)) continue;
    const dated = DAY.test(day);
    if (dated && (since === null || day < since)) since = day;
    const wi = dated ? index.get(weekStart(day)) : undefined;
    for (const [key, n] of Object.entries(cells)) {
      if (!(n > 0)) continue;
      const t = byKey[key] || (byKey[key] = { cells: Array(weeks.length).fill(0), last: '', undated: 0 });
      if (!dated) { t.undated += n; continue; }
      if (day > t.last) t.last = day;
      if (wi !== undefined) t.cells[wi] += n;
    }
  }
  return { byKey, since, first };
}

function periodOf(name, students, tallies, weeks, today, threshold, rosterName, idOf) {
  const seen = new Set();
  const rows = [];
  for (const raw of students) {
    const nm = typeof raw === 'string' ? raw.trim() : '';
    if (!nm) continue;
    const keys = keysFor(nm, rosterName, idOf);
    /* the same name twice in one list is one student, however it is spelled; two ids are two students */
    const dup = rosterName === null ? [keys.join('|')] : [keys.join('|'), 'r:' + rosterName + '\0' + normalize(nm)];
    if (dup.some(d => seen.has(d))) continue;
    dup.forEach(d => seen.add(d));
    const cells = Array(weeks.length).fill(0);
    let last = '', undated = 0;
    for (const k of keys) {
      const t = tallies.byKey[k];
      if (!t) continue;
      t.cells.forEach((n, i) => { cells[i] += n; });
      if (t.last > last) last = t.last;
      undated += t.undated;
    }
    const total = cells.reduce((a, b) => a + b, 0);
    const sinceDays = last ? daysBetween(last, today) : null;
    rows.push({ name: nm, cells, total, last: last || null, daysSince: sinceDays, undated });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const quiet = rows
    .filter(r => r.daysSince === null || r.daysSince >= threshold)
    .sort((a, b) => {
      if ((a.daysSince === null) !== (b.daysSince === null)) return a.daysSince === null ? -1 : 1;
      if (a.daysSince !== b.daysSince) return b.daysSince - a.daysSince;
      return a.name.localeCompare(b.name);
    });
  const totals = rows.map(r => r.total);
  const picks = totals.reduce((a, b) => a + b, 0);
  const called = rows.filter(r => r.total > 0).length;
  const least = totals.length ? Math.min(...totals) : 0;
  const most = totals.length ? Math.max(...totals) : 0;
  return {
    name,
    rows,
    quiet,
    weekly: weeks.map((_, i) => rows.reduce((a, r) => a + r.cells[i], 0)),
    stats: { students: rows.length, picks, called, coverage: rows.length ? called / rows.length : 0, least, most, spread: most - least, quiet: quiet.length }
  };
}

/**
 * The dashboard for every saved roster, plus "All" (every student once across them).
 *
 *   view      np-rollup view(): `{ days, who }`
 *   rosters   `{ 'Period 1': ['Ada', ...], ... }` (np_rosters); a roster that is not an array of names is skipped
 *   opts      `{ today, weeks = 8, threshold = QUIET_DAYS, idOf(name, rosterName) }`
 *
 * Returns `{ today, weeks, labels, since, truncated, undated, periods: [period...], all }`. `since` is the oldest dated day on
 * record and `truncated` is true when the first week shown ends before it: the weeks before are unknown, not zero.
 */
export function build(view, rosters, opts = {}) {
  const today = DAY.test(opts.today) ? opts.today : null;
  if (!today) throw new Error('np-dashboard.build needs a today');
  const n = Math.max(1, Math.min(52, Math.floor(opts.weeks) || 8));
  const threshold = Math.max(1, Math.floor(opts.threshold) || QUIET_DAYS);
  const weeks = weekList(today, n);
  const tallies = tally(view, weeks);
  const idOf = opts.idOf;
  const periods = [];
  const everyone = [];
  for (const [name, list] of Object.entries(isObj(rosters) ? rosters : {})) {
    if (!Array.isArray(list)) continue;
    periods.push(periodOf(name, list, tallies, weeks, today, threshold, name, idOf));
    for (const s of list) everyone.push({ s, name });
  }
  /* All: a student on two rosters is one student. The id decides when there is one; the name when there is not. */
  const seen = new Set(), union = [];
  const rosterOf = new Map();
  for (const { s, name } of everyone) {
    const keys = keysFor(s, name, idOf);
    if (!keys.length) continue;
    const id = keys.join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    union.push(s);
    rosterOf.set(s, name);
  }
  const all = periodOf('All periods', union, tallies, weeks, today, threshold, null, (nm) => {
    const r = rosterOf.get(nm);
    return typeof idOf === 'function' ? idOf(nm, r) : null;
  });
  let undated = 0;
  for (const t of Object.values(tallies.byKey)) undated += t.undated;
  return {
    today, weeks, labels: weeks.map(dayLabel), since: tallies.since,
    truncated: tallies.since !== null && weekStart(tallies.since) > weeks[0],
    undated, periods, all
  };
}

/** The cross-period table: one row per period, coverage and spread side by side. */
export function compare(dash) {
  return (dash.periods || []).map(p => ({ name: p.name, ...p.stats }));
}

/** `{ categories, series }` for ChartSvg.bar: picks per week for a period. */
export function chartData(dash, period) {
  return { categories: dash.labels.slice(), series: [{ label: 'Picks per week', color: '#3b6fd4', values: period.weekly.slice() }] };
}

const pct = x => Math.round(x * 100) + '%';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The plain sentences a teacher can read out and a sheet can print. */
export function lines(dash, period, threshold = QUIET_DAYS) {
  const s = period.stats, w = dash.weeks.length;
  const out = [];
  if (!s.students) return ['No students on this roster.'];
  out.push(`${plural(s.picks, 'pick', 'picks')} across ${plural(s.students, 'student', 'students')} in the last ${plural(w, 'week', 'weeks')} (${dayLabel(dash.weeks[0])} to ${dayLabel(dash.today)}).`);
  if (s.picks) out.push(`${s.called} of ${s.students} (${pct(s.coverage)}) were called on at least once; the most any one student was called is ${s.most}, the fewest ${s.least}.`);
  if (s.quiet) {
    const names = period.quiet.slice(0, 6).map(r => r.name);
    const more = period.quiet.length - names.length;
    out.push(`${plural(s.quiet, 'student', 'students')} not called on in ${threshold} days (never, on record, first): ${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`);
  } else if (s.picks) out.push(`Everyone was called on within the last ${threshold} days.`);
  if (dash.truncated) out.push(`Records start ${dayLabel(dash.since)}; the weeks before that are not on record, so they show as zero here.`);
  if (dash.undated) out.push(`${plural(dash.undated, 'older pick', 'older picks')} carry no date and are in no week.`);
  return out;
}

export default { QUIET_DAYS, WEEK_CHOICES, weekStart, dayLabel, weekList, keysFor, build, compare, chartData, lines };
