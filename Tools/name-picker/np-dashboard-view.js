// np-dashboard-view.js — draws np-dashboard.js's numbers: on the Equity tab and on the one printed page.
//
// Everything a student or roster name reaches goes through textContent; the only markup set from a string is the SVG
// ChartSvg returns, which escapes its own text. The page hands in the dashboard (`np-dashboard.build()`), the period to
// show and the chart module, so this file reads no storage and no clock.

import { chartData, lines, dayLabel, QUIET_DAYS } from './np-dashboard.js';

const SHEET_ROWS = 22;                 // student rows one printed page holds beside the chart, the lines and a comparison of three periods
const sheetRows = dash => Math.max(8, SHEET_ROWS - Math.max(0, dash.periods.length - 3));   // each period past three is a row of the comparison

function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(kids || [])) if (c) e.appendChild(c);
  return e;
}
const td = (text, cls, tag) => el(tag || 'td', cls ? { class: cls, text } : { text });

function when(r) {
  if (r.daysSince === null) return 'never on record';
  return r.daysSince === 0 ? 'today' : r.daysSince === 1 ? 'yesterday' : r.daysSince + ' days ago';
}

/** The picks-per-week bar chart as an SVG string, or '' when there is nothing to draw. */
export function chartSvg(ChartSvg, dash, period) {
  if (!ChartSvg || !period.stats.students) return '';
  const data = chartData(dash, period);
  return ChartSvg.bar(data, {
    W: 640, H: 240, pad: { top: 34, right: 16, bottom: 44, left: 44 },
    title: `Picks per week — ${period.name}`, yLabel: 'Picks', showValues: true, grayscale: true, idPrefix: 'npd'
  });
}

/** Student by week, as a real table: the counts are in the cells, and "quiet" is a word, not just a colour. */
export function gridTable(dash, period, { maxRows = 0, threshold = QUIET_DAYS } = {}) {
  const head = el('tr', {}, [td('Student', '', 'th'), ...dash.labels.map(l => td(l, 'num', 'th')), td('Total', 'num', 'th'), td('Last called', '', 'th')]);
  const rows = maxRows > 0 ? period.rows.slice(0, maxRows) : period.rows;
  const body = rows.map(r => {
    const quiet = r.daysSince === null || r.daysSince >= threshold;
    return el('tr', quiet ? { class: 'quiet' } : {}, [
      td(r.name), ...r.cells.map(n => td(n ? String(n) : '·', 'num')), td(String(r.total), 'num'),
      td(when(r) + (quiet ? ' — quiet' : ''))
    ]);
  });
  if (rows.length < period.rows.length) {
    body.push(el('tr', {}, [el('td', { colspan: String(dash.labels.length + 3), text: `and ${period.rows.length - rows.length} more students` })]));
  }
  return el('table', { class: 'dash-grid' }, [
    el('caption', { text: `Picks per student per week, ${period.name}` }),
    el('thead', {}, [head]), el('tbody', {}, body)
  ]);
}

/** The cross-period comparison. */
export function compareTable(dash) {
  const head = el('tr', {}, ['Period', 'Students', 'Picks', 'Called at least once', 'Fewest to most', `Quiet ${QUIET_DAYS}+ days`].map((t, i) => td(t, i ? 'num' : '', 'th')));
  const body = dash.periods.map(p => el('tr', {}, [
    td(p.name), td(String(p.stats.students), 'num'), td(String(p.stats.picks), 'num'),
    td(`${p.stats.called} of ${p.stats.students} (${Math.round(p.stats.coverage * 100)}%)`, 'num'),
    td(`${p.stats.least} to ${p.stats.most}`, 'num'), td(String(p.stats.quiet), 'num')
  ]));
  return el('table', { class: 'dash-grid' }, [el('caption', { text: 'Periods side by side' }), el('thead', {}, [head]), el('tbody', {}, body)]);
}

function quietList(period, threshold) {
  if (!period.quiet.length) return el('p', { class: 'muted-text', text: `Everyone was called on within the last ${threshold} days.` });
  return el('ul', { class: 'dash-quiet' }, period.quiet.map(r => el('li', { text: `${r.name} — ${when(r)}` })));
}

/**
 * Fill the Equity tab's dashboard. `root` is emptied and rebuilt; `status` is the polite live region and gets the first sentence.
 * `period` is one of dash.periods or dash.all.
 */
export function render(root, status, ChartSvg, dash, period, { threshold = QUIET_DAYS } = {}) {
  root.textContent = '';
  const sentences = lines(dash, period, threshold);
  if (status) status.textContent = sentences[0];
  if (!period.stats.students) {
    root.appendChild(el('p', { class: 'muted-text', text: 'Save a roster, or load one, to see who has been called on by week.' }));
    return;
  }
  const svg = chartSvg(ChartSvg, dash, period);
  if (svg) { const box = el('div', { class: 'dash-chart' }); box.innerHTML = svg; root.appendChild(box); }
  root.appendChild(el('ul', { class: 'dash-lines' }, sentences.map(s => el('li', { text: s }))));
  root.appendChild(el('h4', { text: `Not called on in ${threshold} days` }));
  root.appendChild(quietList(period, threshold));
  root.appendChild(el('div', { class: 'dash-scroll' }, [gridTable(dash, period, { threshold })]));
  if (dash.periods.length > 1) root.appendChild(el('div', { class: 'dash-scroll' }, [compareTable(dash)]));
  if (dash.periods.length > 1) root.appendChild(el('p', { class: 'muted-text', text: 'A student on more than one saved roster counts in each of them; "All periods" counts them once.' }));
}

/** The one printed page, into `sheet`. Returns false when there is nothing to print. */
export function buildSheet(sheet, ChartSvg, dash, period, { threshold = QUIET_DAYS, dateText = '' } = {}) {
  sheet.textContent = '';
  if (!period.stats.students) return false;
  sheet.appendChild(el('h1', { text: 'Participation dashboard' }));
  sheet.appendChild(el('p', { class: 'nd-sub', text: `${period.name} · ${dateText || dayLabel(dash.today)} · ${dash.weeks.length} weeks from ${dayLabel(dash.weeks[0])}` }));
  const svg = chartSvg(ChartSvg, dash, period);
  if (svg) { const box = el('div', { class: 'nd-chart' }); box.innerHTML = svg; sheet.appendChild(box); }
  sheet.appendChild(el('ul', { class: 'nd-lines' }, lines(dash, period, threshold).map(s => el('li', { text: s }))));
  sheet.appendChild(gridTable(dash, period, { maxRows: sheetRows(dash), threshold }));
  if (dash.periods.length > 1) sheet.appendChild(compareTable(dash));
  sheet.appendChild(el('p', { class: 'nd-foot', text: 'Read from this device only: the pick history and its per-day record. A student on more than one saved roster counts in each.' }));
  return true;
}

export default { chartSvg, gridTable, compareTable, render, buildSheet };
