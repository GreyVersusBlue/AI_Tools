/* seating-handoff.mjs — 005's live mode writing two other tools' storage on
   the same device (Path 14 P5, Devon's P5-route answer of 2026-11-03): a
   point in 008 Behavior & Points Tracker, and a hall pass in 001 Digital Hall
   Pass. Pure: every function takes the other tool's stored string (or null)
   and returns the string to store, so the Node suite drives all of it and
   the page does the one getItem/setItem each.

   It is 003's pattern (Tools/rubric-builder/rb-gdv-handoff.js writing 037's
   store): a same-device storage write and not a _shared/handoffs.js link,
   because what travels is a student's name. The shapes copied are the
   tools' own, read off their inline scripts:

     008  'behavior-points-tracker-sections'
          { current, sets: { <class name>: { name, namesText, points, posCount,
            negCount, log: [{ id, name, tagLabel, cat, delta, ts, team? }],
            teams?, teamOf?, teamDay?, seatingSectionId?, rosterName?, ... } } }
          A point is what a tap on a card gives with 008's default chip armed
          (+1, "Manual", category Other), team share included: applyTap() and
          BPTeams.award() in Tools/008-behavior-points-tracker.html and
          Tools/behavior-points-tracker/teams.js. Undo is undoLogEntry().
     001  'hall-pass-log-sections'
          { current, sets: { <section name>: { name, namesText, destinations,
            armedDestId, outNow: [{ id, name, destId, destLabel, outMs, outStr,
            note }], oneOutAtATime?, weeklyBudget?, approvalNames?, ... } } }
          A pass is signOutStudent() with the section's armed destination (its
          first, or Restroom on a section that has none). Undo is
          undoLastAction()'s sign-out branch.

   WHICH CLASS. The other tool's class that stands for this chart section is,
   in order: (008 only) the one pointed at this section (`seatingSectionId`);
   the one with the same name; the one following the roster of that name
   (`rosterName`, which is how 005's own section names find a roster). No
   match on a store that already has classes is a refusal, not a new class:
   a teacher who named them differently should not find a stray copy. A store
   with no classes at all gets one, named after the section and holding its
   students, as 003 makes 037's first assignment.

   REFUSALS, each a sentence and nothing written: data that does not parse or
   has a shape this file does not know (a `version` field, which neither tool
   writes today, counts: it would mean a newer tool); a student the matched
   class does not list; and, for a pass, a student already out, someone else
   out under "one out at a time", a weekly budget used up, or a name on the
   approval list (001 asks a question there, which the projected chart does
   not).

   NOT HANDLED, recorded: 008 and 001 do not reload their own key on a
   `storage` event, so a copy of either open in another tab keeps its old
   class in memory and its next save puts it back over this write. */

export const POINTS_KEY = 'behavior-points-tracker-sections';
export const PASS_KEY = 'hall-pass-log-sections';

export const POINTS_TOOL = 'Behavior & Points';
export const PASS_TOOL = 'Hall Pass';

const DEFAULT_DEST = { id: 'd1', label: 'Restroom', overtimeMin: 5, requiresNote: false };
const LOG_LIMIT = 300;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const namesOf = text => String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
const fail = message => ({ ok: false, message });

/** The stored string, read the way the owner reads it but refusing instead of
    starting over: an empty store is fine, a broken or unknown one is not. */
function readStore(raw, tool) {
  if (raw == null || raw === '') return { store: { current: null, sets: {} } };
  let s;
  try { s = JSON.parse(raw); } catch (e) { return { error: tool + "'s saved data on this device could not be read, so nothing was written." }; }
  if (!isObj(s) || ('sets' in s && !isObj(s.sets)) || 'version' in s || 'v' in s || 'schema' in s) {
    return { error: tool + "'s saved data is in a shape this page does not know (it may be from a newer version), so nothing was written." };
  }
  if (!s.sets) s.sets = {};
  return { store: s };
}

const tooNew = tool => fail(tool + "'s class is in a shape this page does not know (it may be from a newer version), so nothing was written.");

/** The other tool's class for this chart section, or a reason there is none. */
function findClass(store, section, { bySeatingId }) {
  const names = Object.keys(store.sets);
  const pick = test => names.find(n => isObj(store.sets[n]) && test(store.sets[n], n));
  let key = null;
  if (bySeatingId && section.id) key = pick(s => s.seatingSectionId === section.id);
  if (key == null) key = pick((s, n) => n === section.name);
  if (key == null) key = pick(s => typeof s.rosterName === 'string' && s.rosterName && s.rosterName === section.name);
  if (key != null) return { key, created: false };
  if (!names.length) return { key: section.name, created: true };
  return { none: true };
}

function freshClass(section) {
  return { name: section.name, namesText: (section.names || []).join('\n') };
}

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/** A point in 008. ctx = { section: { id, name, names }, student, now (Date), logId }.
    Returns { ok, raw, className, entryId, created, message } or { ok: false, message }. */
export function awardPoint(raw, ctx) {
  const r = readStore(raw, POINTS_TOOL);
  if (r.error) return fail(r.error);
  const store = r.store;
  const found = findClass(store, ctx.section, { bySeatingId: true });
  if (found.none) return fail('No ' + POINTS_TOOL + ' class is named "' + ctx.section.name + '" or pointed at this chart, so nothing was written. Open Behavior & Points and give a class this name.');
  const set = found.created ? freshClass(ctx.section) : store.sets[found.key];
  for (const f of ['points', 'posCount', 'negCount']) if (f in set && !isObj(set[f])) return tooNew(POINTS_TOOL);
  if ('log' in set && !Array.isArray(set.log)) return tooNew(POINTS_TOOL);
  if ('namesText' in set && typeof set.namesText !== 'string') return tooNew(POINTS_TOOL);
  const name = ctx.student;
  if (!found.created && namesOf(set.namesText).indexOf(name) === -1) {
    return fail(name + ' is not on the ' + POINTS_TOOL + ' class "' + found.key + '", so no point was given.');
  }
  if (!isObj(set.points)) set.points = {};
  if (!isObj(set.posCount)) set.posCount = {};
  if (!isObj(set.negCount)) set.negCount = {};
  if (!Array.isArray(set.log)) set.log = [];
  set.points[name] = (set.points[name] || 0) + 1;
  set.posCount[name] = (set.posCount[name] || 0) + 1;
  const entry = {
    id: ctx.logId,
    name,
    tagLabel: 'Manual',
    cat: 'other',
    delta: 1,
    ts: ctx.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
  /* BPTeams.award(): the student's team gets the point too, and the entry
     carries the team so an undo takes it off the same one. */
  const teamId = Array.isArray(set.teams) && isObj(set.teamOf) && Object.prototype.hasOwnProperty.call(set.teamOf, name) ? set.teamOf[name] : null;
  if (teamId && set.teams.some(t => t && t.id === teamId)) {
    if (!isObj(set.teamDay)) set.teamDay = {};
    set.teamDay[teamId] = (set.teamDay[teamId] || 0) + 1;
    entry.team = teamId;
  }
  set.log.unshift(entry);
  if (set.log.length > LOG_LIMIT) set.log.length = LOG_LIMIT;
  store.sets[found.key] = set;
  if (!store.current) store.current = found.key;
  return {
    ok: true, raw: JSON.stringify(store), className: found.key, entryId: entry.id, created: found.created,
    message: '+1 point for ' + name + ' (category Other) in ' + POINTS_TOOL + ', class "' + found.key + '"' +
      (found.created ? ', a new class made for this section' : '') + '. Today: ' + plural(set.points[name], 'point') + '.',
  };
}

/** Takes back the point awardPoint() gave, if 008 still has it in today's log. */
export function undoPoint(raw, { className, entryId }) {
  const r = readStore(raw, POINTS_TOOL);
  if (r.error) return fail(r.error);
  const set = r.store.sets[className];
  const log = isObj(set) && Array.isArray(set.log) ? set.log : [];
  const idx = log.findIndex(e => e && e.id === entryId);
  if (idx < 0) return fail('That point is no longer in ' + POINTS_TOOL + "'s log for today (the day was archived or the point taken back there), so nothing changed.");
  const ev = log[idx];
  log.splice(idx, 1);
  if (!isObj(set.points)) set.points = {};
  if (!isObj(set.posCount)) set.posCount = {};
  set.points[ev.name] = (set.points[ev.name] || 0) - ev.delta;
  set.posCount[ev.name] = Math.max(0, (set.posCount[ev.name] || 0) - 1);
  if (ev.team && Array.isArray(set.teams) && set.teams.some(t => t && t.id === ev.team) && isObj(set.teamDay)) {
    set.teamDay[ev.team] = (set.teamDay[ev.team] || 0) - ev.delta;
  }
  return { ok: true, raw: JSON.stringify(r.store), message: 'Took back the point for ' + ev.name + ' in ' + POINTS_TOOL + '.' };
}

/** A hall pass in 001. ctx = { section, student, now (Date), passId }. */
export function startPass(raw, ctx) {
  const r = readStore(raw, PASS_TOOL);
  if (r.error) return fail(r.error);
  const store = r.store;
  const found = findClass(store, ctx.section, { bySeatingId: false });
  if (found.none) return fail('No ' + PASS_TOOL + ' section is named "' + ctx.section.name + '", so no pass was started. Open Hall Pass and give a section this name.');
  const set = found.created ? freshClass(ctx.section) : store.sets[found.key];
  if (('outNow' in set && !Array.isArray(set.outNow)) || ('destinations' in set && !Array.isArray(set.destinations)) ||
      ('namesText' in set && typeof set.namesText !== 'string')) return tooNew(PASS_TOOL);
  const name = ctx.student;
  if (!found.created && namesOf(set.namesText).indexOf(name) === -1) {
    return fail(name + ' is not on the ' + PASS_TOOL + ' section "' + found.key + '", so no pass was started.');
  }
  if (!Array.isArray(set.outNow)) set.outNow = [];
  const out = set.outNow.find(o => o && o.name === name);
  if (out) return fail(name + ' already has a pass out (' + (out.destLabel || 'out') + (out.outStr ? ', since ' + out.outStr : '') + '). Sign them back in on the Hall Pass page.');
  if (set.oneOutAtATime === true && set.outNow.length) {
    return fail('Someone is already out (' + set.outNow[0].name + ') and this section allows one at a time, so no pass was started.');
  }
  if (Array.isArray(set.approvalNames) && set.approvalNames.indexOf(name) !== -1) {
    return fail(name + ' needs your approval for a hall pass. Sign them out on the Hall Pass page.');
  }
  const budget = parseInt(set.weeklyBudget, 10);
  if (Number.isFinite(budget) && budget > 0) {
    const used = weeklyCount(set, name, ctx.now);
    if (used >= budget) return fail(name + ' has used ' + used + ' of ' + budget + ' hall passes this week. Sign them out on the Hall Pass page if you want to allow another.');
  }
  const dests = Array.isArray(set.destinations) && set.destinations.length ? set.destinations : null;
  const dest = (dests && (dests.find(d => d && d.id === set.armedDestId) || dests[0])) || DEFAULT_DEST;
  if (!dests) { set.destinations = [{ ...DEFAULT_DEST }]; set.armedDestId = DEFAULT_DEST.id; }
  const entry = {
    id: ctx.passId,
    name,
    destId: dest.id,
    destLabel: dest.label,
    outMs: ctx.now.getTime(),
    outStr: ctx.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    note: '',
  };
  set.outNow.unshift(entry);
  store.sets[found.key] = set;
  if (!store.current) store.current = found.key;
  return {
    ok: true, raw: JSON.stringify(store), className: found.key, entryId: entry.id, created: found.created,
    message: name + ' signed out to ' + dest.label + ' at ' + entry.outStr + ' in ' + PASS_TOOL + ', section "' + found.key + '"' +
      (found.created ? ', a new section made for this one' : '') + '.',
  };
}

/** 001's studentWeeklyCount(): every trip in today's log, everyone still
    out, and the archived days since Sunday 00:00 (one row per trip), as
    weeklyCounts() and startOfWeekMs() in its page count them. */
function weeklyCount(set, name, now) {
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  const weekStart = d.getTime();
  let n = 0;
  (Array.isArray(set.log) ? set.log : []).forEach(e => { if (e && e.name === name) n++; });
  (Array.isArray(set.outNow) ? set.outNow : []).forEach(e => { if (e && e.name === name) n++; });
  (Array.isArray(set.history) ? set.history : []).forEach(h => {
    if (!h) return;
    const ms = h.dateMs != null ? h.dateMs : Date.parse(h.date);
    if (!isNaN(ms) && ms >= weekStart && Array.isArray(h.rows)) h.rows.forEach(r => { if (r && r.name === name) n++; });
  });
  return n;
}

/** Takes back a pass startPass() started, while the student is still out. */
export function undoPass(raw, { className, entryId }) {
  const r = readStore(raw, PASS_TOOL);
  if (r.error) return fail(r.error);
  const set = r.store.sets[className];
  const out = isObj(set) && Array.isArray(set.outNow) ? set.outNow : [];
  const idx = out.findIndex(o => o && o.id === entryId);
  if (idx < 0) return fail('That pass is no longer open in ' + PASS_TOOL + ' (the student was signed back in), so nothing changed.');
  const ev = out.splice(idx, 1)[0];
  return { ok: true, raw: JSON.stringify(r.store), message: 'Took back the hall pass for ' + ev.name + '.' };
}
