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
     seating-chart-v1  005's chart: { sections: [{ name, students: [{ id, name }], desks: [{ id, x, y, rot }],
       assign: { deskId: studentId } }], mirror, numbered, rooms }, read through ctx.SeatingRead
       (_shared/seating-read.js), which owns the geometry. Names only: a student's note or flag is never printed.
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

  /* ---- seating: one page per class, the room drawn from 005's chart ---- */

  var SEATING_KEY = 'seating-chart-v1';
  var DESK_W = 106, DESK_H = 70, FRONT_BAND = 62, NAME_PX = 15, NAME_MIN_PX = 8;

  /* 005 saves one chart with a list of sections (classes). Only sections that have a desk count. */
  function seatingSections(ctx) {
    var c = ctx.read(SEATING_KEY);
    if (!isObj(c) || !Array.isArray(c.sections)) return null;
    var list = c.sections.filter(function (s) { return isObj(s) && Array.isArray(s.desks) && s.desks.length; });
    return list.length ? { chart: c, sections: list } : null;
  }

  function num(n) { return String(Math.round(n * 10) / 10); }

  /* A name is fitted to the desk's width by size, never cut; markup in it is escaped here, because
     this string goes into an `html` block, the one block toHtml() does not escape. */
  function deskText(name, x, y) {
    var shown = String(name || '').trim().slice(0, 40);
    if (!shown) return '';
    var px = Math.max(NAME_MIN_PX, Math.min(NAME_PX, Math.floor((DESK_W - 8) / (shown.length * 0.56))));
    return '<text x="' + num(x + DESK_W / 2) + '" y="' + num(y + DESK_H / 2 + px * 0.35) + '" text-anchor="middle" font-size="' + px + '">' + PS.esc(shown) + '</text>';
  }

  function seatingSvg(SR, chart, section, title) {
    var mirror = chart.mirror === true, numbered = chart.numbered === true;
    var placed = SR.placeDesks(section, { mirror: mirror });
    var marks = SR.marksOf(chart, section, { mirror: mirror });
    var box = SR.bounds(placed, { frontBand: FRONT_BAND, marks: marks });
    if (!box) return '';
    var out = ['<svg class="pb-seating" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + PS.esc('Seating chart, ' + title) + '" viewBox="' +
      [box.vx, box.vy, box.vw, box.vh].map(num).join(' ') + '" width="100%" font-family="sans-serif">'];
    out.push('<rect x="' + num(box.minX - 4) + '" y="' + num(box.vy + 6) + '" width="' + num(box.maxX - box.minX + 8) + '" height="30" fill="none" stroke="#000" stroke-width="2"/>');
    out.push('<text x="' + num((box.minX + box.maxX) / 2) + '" y="' + num(box.vy + 27) + '" text-anchor="middle" font-size="16" font-weight="700">FRONT OF ROOM</text>');
    marks.forEach(function (m) {
      out.push('<g transform="rotate(' + num(m.rot) + ' ' + num(m.x + m.w / 2) + ' ' + num(m.y + m.h / 2) + ')"><rect x="' + num(m.x) + '" y="' + num(m.y) + '" width="' + num(m.w) + '" height="' + num(m.h) +
        '" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6 4"/>' +
        (m.label || m.kind ? '<text x="' + num(m.x + m.w / 2) + '" y="' + num(m.y + m.h / 2 + 4) + '" text-anchor="middle" font-size="12">' + PS.esc(m.label || m.kind) + '</text>' : '') + '</g>');
    });
    placed.forEach(function (d) {
      out.push('<g transform="rotate(' + num(d.rot) + ' ' + num(d.x + DESK_W / 2) + ' ' + num(d.y + DESK_H / 2) + ')">' +
        '<rect x="' + num(d.x) + '" y="' + num(d.y) + '" width="' + DESK_W + '" height="' + DESK_H + '" rx="6" fill="#fff" stroke="#000" stroke-width="2"/>' +
        (numbered ? '<text x="' + num(d.x + 6) + '" y="' + num(d.y + 14) + '" font-size="11">' + (d.index + 1) + '</text>' : '') +
        deskText(d.student ? d.student.name : '', d.x, d.y) + '</g>');
    });
    out.push('</svg>');
    return out.join('');
  }

  PS.register({
    id: 'seating',
    title: 'Seating charts',
    sourceSlug: 'seating-chart',
    setupHint: 'Build a seating chart in Seating Chart Generator.',
    storageKeys: [SEATING_KEY],
    evaluate: function (ctx) {
      var s = seatingSections(ctx);
      if (!s) return { available: false, status: 'No seating chart saved yet.' };
      if (!ctx.SeatingRead) return { available: false, status: 'The seating reader did not load.' };
      var n = s.sections.length;
      return { available: true, status: 'Saved (' + n + (n === 1 ? ' class' : ' classes') + ').' };
    },
    build: function (ctx) {
      var s = seatingSections(ctx), pages = [];
      if (!s || !ctx.SeatingRead) return { pages: pages };
      s.sections.forEach(function (sec) {
        var title = typeof sec.name === 'string' && sec.name.trim() ? sec.name.trim() : 'Class';
        var svg = seatingSvg(ctx.SeatingRead, s.chart, sec, title);
        if (!svg) return;
        var students = Array.isArray(sec.students) ? sec.students : [];
        var by = {};
        students.forEach(function (st) { if (isObj(st) && st.id) by[st.id] = st; });
        var assign = isObj(sec.assign) ? sec.assign : {};
        var seated = Object.keys(assign).filter(function (d) { return by[assign[d]] && has(by[assign[d]].name); }).length;
        pages.push({ title: 'Seating: ' + title, blocks: [
          { type: 'html', html: svg },
          { type: 'note', text: seated + ' of ' + students.length + ' students seated. Drawn from the front of the room.' }
        ] });
      });
      return { pages: pages };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
