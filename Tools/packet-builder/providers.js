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
     behavior-points-tracker-sections  008's { sets: { <section>: { tags: [{ label, delta }] } } }, the chip lists only.
     gvb-exit-ticket:customPrompts  023's saved bank: [{ text }].
     gvb-question-bank  the teacher's question bank ({ v, data: { questions: [{ id, prompt, tags }] } }); only the prompts of
       questions tagged do-now are read, never an answer.
     subPlanBuilder.lastAbsence.v1 { dates: [iso] } and subPlanBuilder.history.v1 [{ date, lessonTitle, overviewText,
       scheduleText, materialsNote, ... }]  044's dated plans.
     snfs_slip_v1  076's feedback slips: { v: 2, sets: [{ id, name, prompts: [{ text }] }], currentId } or the older bare { prompts }.
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

  /* 044 stamps its standing details with the local date of their last save (`savedOn`). Printed under
     the sub plan and the emergency page, it is how a binder printed in September shows it predates
     an October room change. Absent on details saved before the stamp: then nothing is printed. */
  function stampNote(s) {
    return typeof s.savedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.savedOn)
      ? [{ type: 'note', text: 'Details last saved ' + s.savedOn + '.' }] : [];
  }

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
    load: standing,
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!standingBlocks(s).length) return { available: false, status: 'Standing details exist but are empty.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Substitute information', blocks: s ? standingBlocks(s).concat(stampNote(s)) : [] }] };
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
    load: standing,
    evaluate: function (ctx) {
      var s = standing(ctx);
      if (!s) return { available: false, status: 'No standing details saved yet.' };
      if (!emergencyRows(s).length) return { available: false, status: 'No fire route, lockdown procedure or medical alerts entered yet.' };
      return { available: true, status: 'Saved.' };
    },
    build: function (ctx) {
      var s = standing(ctx);
      return { pages: [{ title: 'Emergency information', blocks: s ? [{ type: 'kv', rows: emergencyRows(s) }].concat(stampNote(s)) : [] }] };
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
    load: function (ctx) { var raw = ctx.read(HALL_KEY); return isObj(raw) && isObj(raw.sets) ? raw : null; },
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
    load: calendar,
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
    load: function (ctx) { var c = ctx.read(SEATING_KEY); return isObj(c) && Array.isArray(c.sections) ? c : null; },
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

  /* ---- behavior plan: 008's chip lists, never its points ---- */

  var BEHAVIOR_KEY = 'behavior-points-tracker-sections';

  function behaviorStore(ctx) { var raw = ctx.read(BEHAVIOR_KEY); return isObj(raw) && isObj(raw.sets) ? raw : null; }
  function behaviorSets(ctx) { var b = behaviorStore(ctx); return b ? Object.keys(b.sets).filter(function (n) { return isObj(b.sets[n]); }) : []; }

  PS.register({
    id: 'behavior-plan',
    title: 'Behavior plan',
    sourceSlug: 'behavior-points-tracker',
    setupHint: 'Set up your behaviors in Behavior Points Tracker.',
    storageKeys: [BEHAVIOR_KEY],
    load: behaviorStore,
    evaluate: function (ctx) {
      var n = behaviorSets(ctx).length;
      if (!n) return { available: false, status: 'No behavior tracker sections set up yet.' };
      return { available: true, status: 'Saved (' + n + (n === 1 ? ' section' : ' sections') + ').' };
    },
    build: function (ctx) {
      var b = behaviorStore(ctx), names = behaviorSets(ctx), blocks = [];
      names.forEach(function (name) {
        var tags = Array.isArray(b.sets[name].tags) ? b.sets[name].tags.filter(isObj) : [];
        if (names.length > 1) blocks.push({ type: 'h', text: name, level: 3 });
        blocks.push(tags.length
          ? { type: 'table', head: ['Behavior', 'Points'], rows: tags.map(function (t) { return [t.label, (t.delta > 0 ? '+' : '') + t.delta]; }) }
          : { type: 'p', text: 'No behaviors configured.' });
      });
      return { pages: [{ title: 'Behavior plan', blocks: blocks }] };
    }
  });

  /* ---- exit ticket and bell ringer prompts: the teacher's saved bank ---- */

  var PROMPTS_KEY = 'gvb-exit-ticket:customPrompts';
  var PROMPTS_SHOWN = 12;

  function prompts(ctx) { var raw = ctx.read(PROMPTS_KEY); return Array.isArray(raw) ? raw : []; }
  function promptTexts(ctx) { return prompts(ctx).filter(function (p) { return isObj(p) && has(p.text); }).map(function (p) { return p.text.trim(); }); }

  PS.register({
    id: 'exit-ticket',
    title: 'Exit ticket and bell ringer prompts',
    sourceSlug: 'exit-ticket-generator',
    setupHint: 'Save some prompts in Exit Ticket Generator.',
    storageKeys: [PROMPTS_KEY],
    load: prompts,
    evaluate: function (ctx) {
      var n = promptTexts(ctx).length;
      if (!n) return { available: false, status: 'No custom prompts saved yet.' };
      return { available: true, status: 'Saved (' + n + ' custom prompt' + (n === 1 ? '' : 's') + ').' };
    },
    build: function (ctx) {
      return { pages: [{ title: 'Exit ticket and bell ringer prompts', blocks: [
        { type: 'note', text: 'Your saved bank. Pick one before class; the tool does not remember which was used on a given day.' },
        { type: 'list', items: promptTexts(ctx).slice(0, PROMPTS_SHOWN) }
      ] }] };
    }
  });

  /* ---- the lessons 044 saved for the last absence ---- */

  var LAST_KEY = 'subPlanBuilder.lastAbsence.v1';
  var HISTORY_KEY = 'subPlanBuilder.history.v1';

  /* { dates: the absence's dates or null, history: 044's dated plans } */
  function absence(ctx) {
    var last = ctx.read(LAST_KEY), hist = ctx.read(HISTORY_KEY);
    return {
      dates: isObj(last) && Array.isArray(last.dates) && last.dates.length ? last.dates : null,
      history: Array.isArray(hist) ? hist : []
    };
  }
  function lessonsFor(ctx) {
    var a = absence(ctx);
    return (a.dates || []).map(function (d) {
      for (var i = 0; i < a.history.length; i++) if (isObj(a.history[i]) && a.history[i].date === d) return a.history[i];
      return null;
    }).filter(function (h) { return h && (has(h.lessonTitle) || has(h.overviewText) || has(h.scheduleText) || has(h.materialsNote)); });
  }

  PS.register({
    id: 'sub-plan-days',
    title: 'Lessons for the last absence',
    sourceSlug: 'sub-plan-builder',
    setupHint: 'Save a dated plan in Sub Plan Builder (tick “Also save this plan as a dated history entry”).',
    storageKeys: [LAST_KEY, HISTORY_KEY],
    load: absence,
    evaluate: function (ctx) {
      var a = absence(ctx);
      if (!a.dates) return { available: false, status: 'No absence set up in Sub Plan Builder yet.' };
      var n = lessonsFor(ctx).length;
      if (!n) return { available: false, status: 'No plan saved for the absence’s ' + (a.dates.length === 1 ? 'day' : 'days') + ' yet.' };
      return { available: true, status: 'Saved (' + n + ' of ' + a.dates.length + (a.dates.length === 1 ? ' day' : ' days') + ').' };
    },
    build: function (ctx) {
      return { pages: lessonsFor(ctx).map(function (h) {
        var blocks = [];
        var facts = rows([['Title', h.lessonTitle], ['Overview', h.overviewText], ['Schedule', h.scheduleText], ['Materials', h.materialsNote]]);
        if (facts.length) blocks.push({ type: 'kv', rows: facts });
        return { title: 'Lesson: ' + h.date, blocks: blocks };
      }) };
    }
  });

  /* ---- do-now prompts: the teacher's own bank, the questions tagged do-now ---- */

  var BANK_KEY = 'gvb-question-bank';
  var DONOW_MAX = 40, DONOW_TEXT = 300;

  function isDoNowTag(t) { return typeof t === 'string' && t.trim().toLowerCase().replace(/[\s_-]+/g, '-') === 'do-now'; }

  /* The bank is stored by _shared/question-bank.js as { v, data: { questions } } (Store's envelope) or, before that,
     the bare { questions }. A do-now is a question whose tags include "do-now"; its `prompt` is what the class sees,
     and the answer is never read. Seed sets live in memory only and are not here. Returns [{ id, prompt }], or [] . */
  function doNows(ctx) {
    var raw = ctx.read(BANK_KEY);
    var bank = isObj(raw) && isObj(raw.data) ? raw.data : raw;
    if (!isObj(bank) || !Array.isArray(bank.questions)) return [];
    var out = [];
    bank.questions.forEach(function (q, i) {
      if (out.length >= DONOW_MAX || !isObj(q) || !has(q.prompt) || !Array.isArray(q.tags) || !q.tags.some(isDoNowTag)) return;
      out.push({ id: has(q.id) ? q.id : 'q-noid-' + i, prompt: q.prompt.trim().slice(0, DONOW_TEXT) });
    });
    return out;
  }

  PS.register({
    id: 'do-now',
    title: 'Do-now prompts',
    sourceSlug: 'review-game-board',
    setupHint: 'Tag questions “do-now” in the Review Game Board’s question bank.',
    storageKeys: [BANK_KEY],
    load: doNows,
    evaluate: function (ctx) {
      var n = doNows(ctx).length;
      if (!n) return { available: false, status: 'No question tagged “do-now” in your bank yet.' };
      return { available: true, status: 'Saved (' + n + (n === 1 ? ' prompt' : ' prompts') + ').' };
    },
    build: function (ctx) {
      var d = doNows(ctx);
      return { pages: d.length ? [{ title: 'Do-now prompts', blocks: [{ type: 'list', items: d.map(function (x) { return x.prompt; }) }] }] : [] };
    }
  });

  /* ---- the substitute's feedback page: the questions on 076's current slip ---- */

  var SLIP_KEY = 'snfs_slip_v1';
  var SLIP_MAX = 12, SLIP_TEXT = 200;

  /* 076 saves { v: 2, sets: [{ id, name, prompts: [{ id, text }] }], currentId, ...the current slip's fields at the top }
     or, before saved slips, the bare { prompts }. Returns { name, prompts: [text] } for the slip in use, or null
     when none is saved or it has no question in it. An untouched 076 saves nothing, and that is null here too. */
  function slipPrompts(ctx) {
    var d = ctx.read(SLIP_KEY);
    if (!isObj(d)) return null;
    var set = d;
    if (d.v >= 2 && Array.isArray(d.sets)) {
      var sets = d.sets.filter(isObj);
      set = null;
      for (var i = 0; i < sets.length; i++) if (sets[i].id === d.currentId) set = sets[i];
      if (!set) set = sets[0] || null;
    }
    if (!isObj(set) || !Array.isArray(set.prompts)) return null;
    var prompts = set.prompts.map(function (p) { return isObj(p) ? p.text : p; }).filter(has)
      .map(function (t) { return t.trim().slice(0, SLIP_TEXT); }).slice(0, SLIP_MAX);
    return prompts.length ? { name: has(set.name) ? set.name.trim() : '', prompts: prompts } : null;
  }

  PS.register({
    id: 'sub-feedback',
    title: 'Substitute feedback page (they fill it in)',
    sourceSlug: 'sub-note-feedback-slip',
    setupHint: 'Write your questions in Sub Note / Feedback Slip Generator.',
    storageKeys: [SLIP_KEY],
    load: slipPrompts,
    evaluate: function (ctx) {
      var f = slipPrompts(ctx);
      if (!f) return { available: false, status: 'No feedback questions saved yet.' };
      return { available: true, status: 'Saved (' + f.prompts.length + (f.prompts.length === 1 ? ' question' : ' questions') + ').' };
    },
    build: function (ctx) {
      var f = slipPrompts(ctx);
      var boxes = f ? f.prompts.map(function (t) {
        return '<div class="pb-fb"><div class="pb-fb-label">' + PS.esc(t) + '</div><div class="pb-fb-box"></div></div>';
      }).join('') : '';
      return { pages: f ? [{ title: 'How did today go?', blocks: [
        { type: 'note', text: 'Please fill this in before you leave and leave it on the desk.' },
        { type: 'html', html: boxes }
      ] }] : [] };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
