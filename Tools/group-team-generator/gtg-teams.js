/* gtg-teams.js — project teams for 002 (AI-31, rank 111). Pure: no DOM, no storage, no clock of its own.

   A project team is a named group of the same students that lasts a few weeks, until the teacher dissolves it.
   Devon's answers of 2026-10-07 (DEVON-ANSWERS-2026-10-07.md, 4.1 to 4.6) are the spec:
     4.1 named teams of the same students, lasting until dissolved;
     4.2 the task list is printed, never ticked on a screen;
     4.3 the contract is his own text with blanks, signed on paper; nothing records who signed;
     4.4 a team counts in the pair memory once per day;
     4.5 built inside 002, on the page's `previous` and `lock` (a team shown on screen is a locked group);
     4.6 a student who joins, leaves or is away is moved by hand.

   What is stored, in the class's own gtg:data:<class> (no new key), only once teams exist:
     projectTeams: { v: 1, since: 'YYYY-MM-DD', counted: 'YYYY-MM-DD' | '', days: N, teams: [{ name, members: [name], tasks: 'one per line' }] }
     projectContract: the teacher's template text, only when it differs from DEFAULT_CONTRACT.

   "Once per day" is read conservatively: a day counts when the page is open on a Monday to Friday, with at least one
   team of two present students, and counts at most once for that date. A day the page was not opened is not counted,
   and neither is a weekend: the tool does not know which days the class meets, so it never counts one it did not see.
   An absent student is left out of that day's count. */
(function (root) {
  'use strict';

  var MAX_TEAMS = 20, MAX_TASKS = 40, MAX_NAME = 60, MAX_TEXT = 4000;

  var DEFAULT_CONTRACT = [
    'Team contract for {team}',
    'Our project is ______________________________________ and it is due ______________.',
    'We are {members}.',
    'We agree to share the work fairly. Each of us will ______________________________________.',
    'When we disagree we will ______________________________________ before we ask the teacher.',
    'If a teammate is away we will ______________________________________.',
    'We will check in with each other every ______________ and our team goal this week is ______________________________________.'
  ].join('\n');

  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function str(s, max) { return typeof s === 'string' ? s.slice(0, max) : ''; }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** YYYY-MM-DD in the local time of `d`. */
  function localDate(d) {
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  /** Monday to Friday. A date that is not YYYY-MM-DD is not a school day. */
  function isSchoolDay(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return false; // 2026-13-40 is not a day
    var dow = d.getUTCDay();
    return dow >= 1 && dow <= 5;
  }

  /** A saved projectTeams read defensively; null when there are no usable teams. */
  function normalize(pt) {
    if (!isObj(pt) || !Array.isArray(pt.teams)) return null;
    var seen = {};
    var teams = [];
    pt.teams.slice(0, MAX_TEAMS).forEach(function (t, i) {
      if (!isObj(t)) return;
      var members = [];
      (Array.isArray(t.members) ? t.members : []).forEach(function (n) {
        if (typeof n !== 'string' || !n.trim() || seen[n]) return;
        seen[n] = true; // a student is on one team
        members.push(n);
      });
      teams.push({ name: str(t.name, MAX_NAME).trim() || ('Team ' + (i + 1)), members: members, tasks: str(t.tasks, MAX_TEXT) });
    });
    if (!teams.length) return null;
    return {
      v: 1,
      since: /^\d{4}-\d{2}-\d{2}$/.test(pt.since) ? pt.since : '',
      counted: /^\d{4}-\d{2}-\d{2}$/.test(pt.counted) ? pt.counted : '',
      days: Number.isInteger(pt.days) && pt.days > 0 ? Math.min(pt.days, 1000) : 0,
      teams: teams
    };
  }

  /** New teams from groups on screen: [{ label, members: [name] }]. */
  function fromGroups(groups, today) {
    var teams = groups.slice(0, MAX_TEAMS).map(function (g, i) {
      return { name: str(g.label, MAX_NAME).trim() || ('Team ' + (i + 1)), members: g.members.slice(), tasks: '' };
    }).filter(function (t) { return t.members.length; });
    return teams.length ? normalize({ v: 1, since: today, counted: '', days: 0, teams: teams }) : null;
  }

  /** The task lines of a team, trimmed, blank lines gone. */
  function parseTasks(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, MAX_TASKS);
  }

  /** Whether `today` is a day that has not been counted yet. */
  function isDue(pt, today) {
    if (!pt || !isSchoolDay(today)) return false;
    return !pt.counted || today > pt.counted;
  }

  /** The groups to record for a day: each team's present members that are on the roster, teams of two or more.
      `present` is a function name -> bool. Returns lists of names. */
  function dayGroups(pt, present) {
    return pt.teams.map(function (t) { return t.members.filter(present); }).filter(function (g) { return g.length >= 2; });
  }

  /** The student `name` moved to team `to` (an index), or off the teams when `to` is -1. A new object. */
  function move(pt, name, to) {
    var out = JSON.parse(JSON.stringify(pt));
    out.teams.forEach(function (t) { t.members = t.members.filter(function (n) { return n !== name; }); });
    if (to >= 0 && out.teams[to]) out.teams[to].members.push(name);
    return out;
  }

  /** A rename carried through the teams. Returns whether anything moved. */
  function rename(pt, from, to) {
    var moved = false;
    pt.teams.forEach(function (t) {
      var i = t.members.indexOf(from);
      if (i === -1) return;
      moved = true;
      if (t.members.indexOf(to) === -1) t.members[i] = to; else t.members.splice(i, 1);
    });
    return moved;
  }

  function joinNames(names) {
    if (globalThis.ListSentence && globalThis.ListSentence.join) return globalThis.ListSentence.join(names);
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  /** A template line as HTML: {team} and {members} filled, a run of three or more underscores a line to write on. */
  function lineHtml(line, team) {
    var filled = String(line).replace(/\{team\}/g, '\u0001T\u0001').replace(/\{members\}/g, '\u0001M\u0001');
    return escapeHtml(filled)
      .replace(/_{3,}/g, '<span class="p-blank" role="img" aria-label="blank to fill in"></span>')
      .replace(/\u0001T\u0001/g, escapeHtml(team.name))
      .replace(/\u0001M\u0001/g, escapeHtml(joinNames(team.members)));
  }

  /** One team's contract, as a printable page: the teacher's text, then a signature line for each student.
      Nothing is recorded about who signs. */
  function contractHtml(template, team) {
    var lines = String(template || DEFAULT_CONTRACT).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var body = lines.map(function (l, i) {
      return i === 0 ? '<h2>' + lineHtml(l, team) + '</h2>' : '<p>' + lineHtml(l, team) + '</p>';
    }).join('');
    var sigs = team.members.map(function (n) {
      return '<li><span class="p-sig"></span><span class="p-signame">' + escapeHtml(n) + '</span></li>';
    }).join('');
    return '<div class="sheet-page p-contract">' + body + '<h3>Signed</h3><ul class="p-sigs">' + sigs + '</ul></div>';
  }

  /** One team's task list, as a printable page: boxes to tick in pen, a column for who and a column for when. */
  function taskSheetHtml(team) {
    var tasks = parseTasks(team.tasks);
    var rows = tasks.length
      ? tasks.map(function (t) {
          return '<tr><td class="p-box"><span class="p-check"></span></td><td>' + escapeHtml(t) + '</td><td class="p-who"></td><td class="p-when"></td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="p-none">No tasks written for this team yet.</td></tr>';
    return '<div class="sheet-page p-tasks"><h2>' + escapeHtml(team.name) + '</h2>' +
      '<div class="sheet-table-line">' + escapeHtml(joinNames(team.members)) + '</div>' +
      '<table class="p-table"><thead><tr><th scope="col"><span class="p-vh">Done</span></th><th scope="col">Task</th><th scope="col">Who</th><th scope="col">By when</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  var api = {
    DEFAULT_CONTRACT: DEFAULT_CONTRACT, MAX_TEAMS: MAX_TEAMS, MAX_TASKS: MAX_TASKS,
    localDate: localDate, isSchoolDay: isSchoolDay, normalize: normalize, fromGroups: fromGroups,
    parseTasks: parseTasks, isDue: isDue, dayGroups: dayGroups, move: move, rename: rename,
    contractHtml: contractHtml, taskSheetHtml: taskSheetHtml
  };
  root.GtgTeams = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
