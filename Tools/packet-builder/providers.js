/* providers.js — the sections 090 Packet Builder starts with (Path 10 P1).
   Registers into window.PacketSections (sections.js, which has the contract).
   Every provider here is data in, blocks out: it reads only through ctx.read(key),
   treats an unreadable key as "nothing saved", and never touches the DOM.

   Each provider's `storageKeys` must be in 090's `reads` in _shared/tool-registry.js
   and be a key its source tool's row declares; Tools/packet-builder/test/providers.test.mjs
   holds all three to each other.

   Source shapes these read (keep the shape or bump the key version; the source
   tools carry a comment saying so):
     subPlanBuilder.standingDetails.v1  044's standing details: teacherName, roomNumber,
       rosterLocation, absenceLocation, emergencyLocation, periods [{label, time}], keysLocation,
       whoToAsk, techFailureText, attendanceText, behaviorCustom, phoneNurse, phoneCounseling,
       phoneSupport, phoneOther, signOffName, fireRoute, lockdownProcedure, medicalAlerts.
     hall-pass-log-sections  001's { sets: { <section name>: { destinations: [{ label, overtimeMin,
       requiresNote }], oneOutAtATime, weeklyBudget } } }, the settings half only; the pass log itself
       (who went where) is never read.
     scv_calendar_v1  032's calendar, read through ctx.SchoolDay (_shared/school-day.js), which owns its shape.
     np_rosters  { <roster name>: [student names] }, with crh_students_v1's
       { version: 1, rosters: { <name>: { students: [{ name, preferred }] } } } for preferred names. */
(function (root) {
  'use strict';
  var PS = root.PacketSections;
  if (!PS) return;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(v) { return typeof v === 'string' && v.trim() !== ''; }

  var STANDING_KEY = 'subPlanBuilder.standingDetails.v1';
  var SUB_SETUP = 'Fill in your standing details once in Sub Plan Builder.';

  function standing(ctx) { var s = ctx.read(STANDING_KEY); return isObj(s) ? s : null; }

  function rows(pairs) { return pairs.filter(function (p) { return has(p[1]); }).map(function (p) { return [p[0], p[1].trim()]; }); }

  function standingBlocks(s) {
    var blocks = [];
    var facts = rows([
      ['Teacher', s.teacherName], ['Room', s.roomNumber], ['Roster', s.rosterLocation],
      ['Absence slips', s.absenceLocation], ['Sub folder', s.emergencyLocation],
      ['Keys', s.keysLocation], ['Who to ask', s.whoToAsk], ['If tech fails', s.techFailureText]
    ]);
    if (facts.length) blocks.push({ type: 'kv', rows: facts });
    var periods = Array.isArray(s.periods) ? s.periods.filter(isObj) : [];
    if (periods.length) {
      blocks.push({ type: 'h', text: 'Periods', level: 3 });
      blocks.push({ type: 'table', head: ['Period', 'Time'], rows: periods.map(function (p) { return [p.label, p.time]; }) });
    }
    var more = rows([
      ['Attendance', s.attendanceText], ['Behavior', s.behaviorCustom],
      ['Nurse', s.phoneNurse], ['Counseling', s.phoneCounseling], ['Support / office', s.phoneSupport],
      ['Other phone', s.phoneOther], ['Sign-off', s.signOffName]
    ]);
    if (more.length) blocks.push({ type: 'kv', rows: more });
    return blocks;
  }

  PS.register({
    id: 'sub-plan',
    title: 'Sub plan: standing details',
    sourceSlug: 'sub-plan-builder',
    setupHint: SUB_SETUP,
    storageKeys: [STANDING_KEY],
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!standingBlocks(s).length) return { available: false, status: 'Standing details exist but are empty.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Substitute information', blocks: s ? standingBlocks(s) : [] }] };
    }
  });

  function emergencyRows(s) {
    return rows([['Fire / evacuation', s.fireRoute], ['Lockdown', s.lockdownProcedure], ['Medical alerts', s.medicalAlerts]]);
  }

  PS.register({
    id: 'emergency-info',
    title: 'Emergency information',
    sourceSlug: 'sub-plan-builder',
    setupHint: 'Add a fire route, lockdown procedure or medical alerts in Sub Plan Builder’s Emergency info card.',
    storageKeys: [STANDING_KEY],
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!emergencyRows(s).length) return { available: false, status: 'No fire route, lockdown procedure or medical alerts entered yet.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Emergency information', blocks: s ? [{ type: 'kv', rows: emergencyRows(s) }] : [] }] };
    }
  });

  /* ---- hall pass procedure (001's settings, never its log) ---- */

  var HALL_KEY = 'hall-pass-log-sections';

  function hallSets(ctx) {
    var raw = ctx.read(HALL_KEY);
    if (!isObj(raw) || !isObj(raw.sets)) return [];
    return Object.keys(raw.sets).filter(function (n) { return isObj(raw.sets[n]); }).map(function (n) { return [n, raw.sets[n]]; });
  }

  PS.register({
    id: 'hall-pass-log',
    title: 'Hall pass procedure',
    sourceSlug: 'hall-pass-log',
    setupHint: 'Set up your hall pass destinations in Digital Hall Pass / Sign-Out Log.',
    storageKeys: [HALL_KEY],
    evaluate: function (ctx) {
      var n = hallSets(ctx).length;
      if (!n) return { available: false, status: 'No hall pass sections set up yet.' };
      return { available: true, status: 'Saved (' + n + (n === 1 ? ' section' : ' sections') + ').' };
    },
    build: function (ctx) {
      var sets = hallSets(ctx);
      return { pages: [{ title: 'Hall passes', blocks: sets.reduce(function (blocks, pair) {
        var sec = pair[1];
        var dests = Array.isArray(sec.destinations) ? sec.destinations.filter(isObj) : [];
        if (sets.length > 1) blocks.push({ type: 'h', text: pair[0], level: 3 });
        if (dests.length) {
          blocks.push({ type: 'table', head: ['Destination', 'Time limit', 'Note at sign-out?'], rows: dests.map(function (d) {
            return [d.label, d.overtimeMin ? d.overtimeMin + ' min' : '', d.requiresNote ? 'Yes' : 'No'];
          }) });
        } else {
          blocks.push({ type: 'p', text: 'No destinations configured.' });
        }
        var rules = [];
        if (sec.oneOutAtATime) rules.push('Only one student out at a time.');
        if (sec.weeklyBudget) rules.push('Weekly pass budget: ' + sec.weeklyBudget + '.');
        if (rules.length) blocks.push({ type: 'note', text: rules.join(' ') });
        return blocks;
      }, []) }] };
    }
  });

  /* ---- the school calendar, through SchoolDay ---- */

  var CAL_KEY = 'scv_calendar_v1';
  var AHEAD_DAYS = 28;

  function calendar(ctx) {
    var cal = ctx.read(CAL_KEY);
    return ctx.SchoolDay && ctx.SchoolDay.isCalendar(cal) ? cal : null;
  }
  function isoPlus(iso, n) {
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  PS.register({
    id: 'school-calendar',
    title: 'School calendar: today and the next four weeks',
    sourceSlug: 'school-calendar-visualizer',
    setupHint: 'Save your school year in School Calendar Visualizer.',
    storageKeys: [CAL_KEY],
    evaluate: function (ctx) {
      var cal = calendar(ctx);
      if (!cal) return { available: false, status: 'No school calendar saved yet.' };
      var label = typeof cal.meta.yearLabel === 'string' && cal.meta.yearLabel.trim() ? cal.meta.yearLabel.trim() : cal.meta.start + ' to ' + cal.meta.end;
      return { available: true, status: 'Saved (' + label + ').' };
    },
    build: function (ctx) {
      var cal = calendar(ctx), SD = ctx.SchoolDay, today = ctx.todayISO;
      var blocks = [];
      if (!cal) return { pages: [{ title: 'School calendar', blocks: blocks }] };
      blocks.push({ type: 'kv', rows: [['Today', today + ': ' + (SD.describe(cal, SD.dayOf(cal, today)) || 'No calendar for this date')]] });
      var rows = [];
      for (var i = 1; i <= AHEAD_DAYS; i++) {
        var iso = isoPlus(today, i), day = SD.dayOf(cal, iso);
        if (day.why === 'weekend' || day.why === 'outside' || day.why === 'invalid') continue;
        var words = SD.describe(cal, day);
        if (words !== 'A school day' && words !== (day.letter ? day.letter + ' day' : '')) rows.push([iso, words]);
      }
      blocks.push({ type: 'h', text: 'Coming up', level: 3 });
      blocks.push(rows.length ? { type: 'table', head: ['Date', 'What it is'], rows: rows } : { type: 'p', text: 'Nothing out of the ordinary in the next ' + AHEAD_DAYS + ' days.' });
      return { pages: [{ title: 'School calendar', blocks: blocks }] };
    }
  });

  /* ---- class rosters: one name list per class ---- */

  var ROSTERS_KEY = 'np_rosters';
  var RECORDS_KEY = 'crh_students_v1';
  var PER_PAGE = 40;

  function rosterLists(ctx) {
    var raw = ctx.read(ROSTERS_KEY);
    if (!isObj(raw)) return [];
    var recs = ctx.read(RECORDS_KEY);
    var db = isObj(recs) && isObj(recs.rosters) ? recs.rosters : {};
    return Object.keys(raw).filter(function (n) { return Array.isArray(raw[n]); }).map(function (n) {
      var pref = {};
      var entry = isObj(db[n]) && Array.isArray(db[n].students) ? db[n].students : [];
      entry.forEach(function (r) { if (isObj(r) && has(r.name) && has(r.preferred)) pref[r.name.trim().toLowerCase()] = r.preferred.trim(); });
      var names = raw[n].filter(has).map(function (x) { return pref[x.trim().toLowerCase()] || x.trim(); });
      return { name: n, names: names };
    }).filter(function (r) { return r.names.length; });
  }

  PS.register({
    id: 'class-rosters',
    title: 'Class rosters',
    sourceSlug: 'class-roster-hub',
    setupHint: 'Add your classes in Class Roster Hub.',
    storageKeys: [ROSTERS_KEY, RECORDS_KEY],
    evaluate: function (ctx) {
      var n = rosterLists(ctx).length;
      if (!n) return { available: false, status: 'No rosters saved yet.' };
      return { available: true, status: 'Saved (' + n + (n === 1 ? ' class' : ' classes') + ').' };
    },
    build: function (ctx) {
      var pages = [];
      rosterLists(ctx).forEach(function (r) {
        for (var i = 0; i < r.names.length; i += PER_PAGE) {
          var chunk = r.names.slice(i, i + PER_PAGE);
          pages.push({ title: r.name + (r.names.length > PER_PAGE ? ' (' + (Math.floor(i / PER_PAGE) + 1) + ')' : ''), blocks: [
            { type: 'table', head: ['#', 'Student'], rows: chunk.map(function (nm, k) { return [String(i + k + 1), nm]; }) }
          ] });
        }
      });
      return { pages: pages };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
