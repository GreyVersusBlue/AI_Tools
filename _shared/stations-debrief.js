/* stations-debrief.js — the printed debrief, drawn once for 018 and 019 (Path 18 P4).
 *
 * `StationsDebrief.render(host, teams, opts)` lays out what `Stations.debrief(set, run)` returned:
 * two pages a team through the print kit (`PrintKit.renderCards`), the first the path (stations
 * in the order the team reached them, the time of each leg, wrong tries, hints, where a branch
 * sent them), the second a reflection page with room to write. Every node is built with
 * textContent. It writes no number of its own: a time the records could not give is a dash.
 *
 * Needs print-kit.js (and its css) loaded first; stations-debrief.css styles the sheet.
 * 018 draws it from its live run; 019's teacher monitor draws it from the record it keeps of
 * what each device reported, which holds no wrong tries or hints, so it passes
 * `without: ['misses', 'hints']` and the sheet leaves those columns out and says why, rather
 * than print a 0 for something nobody counted.
 *
 * opts: `grid` ({ cols, perPage }, default one card a page), `title` ('Hunt debrief'),
 * `formatElapsed(ms)`, `formatPenaltyMinutes(ms)` (the page's own, so a sheet reads like its
 * screen), `without` (any of 'misses', 'hints'), `prompts` (the reflection questions). */
(function (global) {
  'use strict';

  var REFLECT_PROMPTS = [
    'Which station took your team longest, and why?',
    'Where did your team lose the most tries, and what did you change after that?',
    'What did you learn today that you did not know before the hunt?',
    'If you ran the hunt again, what would your team do differently?'
  ];

  function pEl(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }

  function defaultElapsed(ms) {
    var t = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return (h > 0 ? h + ':' + pad(m) : m) + ':' + pad(s);
  }
  function defaultPenalty(ms) {
    var m = Math.round((ms / 60000) * 100) / 100;
    return m % 1 === 0 ? String(m) : m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function render(host, teams, opts) {
    opts = opts || {};
    var fmt = opts.formatElapsed || defaultElapsed, fmtPen = opts.formatPenaltyMinutes || defaultPenalty;
    var title = opts.title || 'Hunt debrief', prompts = opts.prompts || REFLECT_PROMPTS;
    var noMiss = (opts.without || []).indexOf('misses') >= 0, noHint = (opts.without || []).indexOf('hints') >= 0;
    function clock(ms) { return ms === null || ms === undefined ? '—' : fmt(ms); }
    var items = [];
    teams.forEach(function (d, i) { items.push({ d: d, i: i, page: 'path' }); items.push({ d: d, i: i, page: 'reflect' }); });
    global.PrintKit.renderCards(host, items, opts.grid || { cols: 1, perPage: 1 }, function (it) {
      var d = it.d, card = pEl('div', 'p-card');
      card.appendChild(pEl('div', 'p-num', it.page === 'path' ? title : title + ' — reflection'));
      card.appendChild(pEl('div', 'p-label', d.name || ('Team ' + (it.i + 1))));
      if (it.page === 'reflect') {
        prompts.forEach(function (q) {
          card.appendChild(pEl('div', 'p-reflect-q', q));
          card.appendChild(pEl('div', 'p-reflect-lines'));
          card.appendChild(pEl('div', 'p-reflect-lines'));
        });
        return card;
      }
      var sum = d.reached + ' of ' + d.total + ' stations reached' +
        (d.requiredTotal !== d.total ? ' (' + d.requiredDone + ' of ' + d.requiredTotal + ' required)' : '') +
        ' · finish time ' + clock(d.totalMs);
      if (!noMiss) sum += ' · ' + d.misses + ' wrong ' + (d.misses === 1 ? 'try' : 'tries');
      if (!noHint) sum += ' · ' + d.hints + ' hint' + (d.hints === 1 ? '' : 's') + (d.penaltyMs ? ' (+' + fmtPen(d.penaltyMs) + ' min penalty)' : '');
      card.appendChild(pEl('div', 'p-debrief-sum', sum));
      var cols = [['#', function (p) { return p.order; }],
        ['Station', function (p) { return 'Station ' + (p.n + 1) + (p.label !== 'Station ' + (p.n + 1) ? ' — ' + p.label : ''); }],
        ['Reached at', function (p) { return clock(p.sinceStartMs); }],
        ['Time on leg', function (p) { return clock(p.legMs); }]];
      if (!noMiss) cols.push(['Wrong tries', function (p) { return p.misses; }]);
      if (!noHint) cols.push(['Hint', function (p) { return p.hint ? 'Used (−' + p.hint.penaltyMin + ' min)' : '—'; }]);
      cols.push(['Sent on to', function (p) { return p.sentTo ? (p.sentTo.end ? 'The end' : 'Station ' + (p.sentTo.n + 1)) : '—'; }]);
      var table = pEl('table', 'p-debrief');
      var head = table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
      cols.forEach(function (c) { head.appendChild(pEl('th', '', c[0])); });
      var body = table.appendChild(document.createElement('tbody'));
      d.path.forEach(function (p) {
        var tr = body.appendChild(document.createElement('tr'));
        cols.forEach(function (c) { tr.appendChild(pEl('td', '', c[1](p))); });
      });
      if (!d.path.length) {
        var none = body.appendChild(document.createElement('tr')).appendChild(pEl('td', '', 'No stations reached yet.'));
        none.colSpan = cols.length;
      }
      card.appendChild(table);
      if (d.unreached.length) {
        card.appendChild(pEl('div', 'p-debrief-open', 'Still open: ' + d.unreached.map(function (u) {
          return 'Station ' + (u.n + 1) + (!noMiss && u.misses ? ' (' + u.misses + ' wrong ' + (u.misses === 1 ? 'try' : 'tries') + ')' : '');
        }).join(', ') + '.'));
      }
      if (noMiss || noHint) {
        card.appendChild(pEl('div', 'p-debrief-open', 'Wrong tries and hints are not on this sheet: the teacher monitor is told which station a team is on, not how it got through it.'));
      }
      return card;
    });
  }

  global.StationsDebrief = { render: render, REFLECT_PROMPTS: REFLECT_PROMPTS };
})(typeof window !== 'undefined' ? window : this);
