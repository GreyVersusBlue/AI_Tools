/* Writing Prompt Generator — read-only bridge to Rubric Builder's saved
   rubrics, so a prompt (or a prompt-set item) can be paired with a rubric
   built in Tools/003-rubric-builder.html and reopened there in one click.

   This depends on Rubric Builder's own localStorage contract
   (Tools/rubric-builder/rb-store.js): a list of rubric names under
   'gvb-rubric-builder:list', one JSON blob per name under
   'gvb-rubric-builder:data:<name>', and a 'gvb-rubric-builder:current'
   pointer that Rubric Builder reads on load to decide which rubric to show.
   Deliberately read-only except for that one "current" pointer — this file
   never writes rubric content, so a stale copy of Rubric Builder's format
   here can't corrupt anything there. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-rubric-builder:list';
  var DATA_PREFIX = 'gvb-rubric-builder:data:';
  var CURRENT_KEY = 'gvb-rubric-builder:current';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listRubricNames() {
    var names = safeParse(localStorage.getItem(LIST_KEY), []);
    return Array.isArray(names) ? names.filter(function (n) { return typeof n === 'string' && n; }) : [];
  }

  function getRubricSummary(name) {
    if (!name) return null;
    var data = safeParse(localStorage.getItem(DATA_PREFIX + name), null);
    if (!data || !Array.isArray(data.criteria) || !Array.isArray(data.levels)) return null;
    return {
      name: name,
      title: typeof data.title === 'string' ? data.title : '',
      levelLabels: data.levels.map(function (l) { return (l && l.label) || ''; }).filter(Boolean),
      criteriaNames: data.criteria.map(function (c) { return (c && c.name) || ''; }).filter(Boolean)
    };
  }

  /** Points Rubric Builder at `name` and opens it in a new tab. Only call
      this with a name that came from listRubricNames() — if it doesn't
      resolve to a saved rubric, Rubric Builder just falls back to a blank
      "New Rubric" rather than erroring. */
  function openInRubricBuilder(name) {
    if (!name) return;
    try { localStorage.setItem(CURRENT_KEY, name); } catch (e) {}
    global.open('003-rubric-builder.html', '_blank');
  }

  global.WpgRubricLink = {
    listRubricNames: listRubricNames,
    getRubricSummary: getRubricSummary,
    openInRubricBuilder: openInRubricBuilder
  };
})(window);
