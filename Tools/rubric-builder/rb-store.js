/* Rubric Builder — localStorage persistence.
   Same shape as the Formula Sheet / Timeline stores: a list of named
   rubrics so more than one rubric can be kept around and reopened. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-rubric-builder:list';
  var DATA_PREFIX = 'gvb-rubric-builder:data:';
  var CURRENT_KEY = 'gvb-rubric-builder:current';
  var SCORES_PREFIX = 'gvb-rubric-builder:scores:'; // per-rubric map of studentName -> score record

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listRubrics() {
    return safeParse(localStorage.getItem(LIST_KEY), []);
  }

  function saveRubric(name, state) {
    var names = listRubrics();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    localStorage.setItem(CURRENT_KEY, name);
  }

  function loadRubric(name) {
    return safeParse(localStorage.getItem(DATA_PREFIX + name), null);
  }

  function deleteRubric(name) {
    var names = listRubrics().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  function getCurrentName() { return localStorage.getItem(CURRENT_KEY); }
  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  /* ---- per-rubric student scores: { studentName: { student, selections: {critId: levelId} } } ---- */
  function getScores(rubricName) {
    return safeParse(localStorage.getItem(SCORES_PREFIX + rubricName), {});
  }

  function listScoredStudents(rubricName) {
    return Object.keys(getScores(rubricName)).sort(function (a, b) { return a.localeCompare(b); });
  }

  function loadScore(rubricName, studentName) {
    var scores = getScores(rubricName);
    return scores[studentName] || null;
  }

  function saveScore(rubricName, studentName, record) {
    var scores = getScores(rubricName);
    scores[studentName] = record;
    localStorage.setItem(SCORES_PREFIX + rubricName, JSON.stringify(scores));
  }

  function deleteScore(rubricName, studentName) {
    var scores = getScores(rubricName);
    delete scores[studentName];
    localStorage.setItem(SCORES_PREFIX + rubricName, JSON.stringify(scores));
  }

  /** Carries scored students along when a rubric is renamed, so scoring
      history isn't orphaned under the old name. */
  function renameScores(oldName, newName) {
    if (oldName === newName) return;
    var raw = localStorage.getItem(SCORES_PREFIX + oldName);
    if (raw == null) return;
    localStorage.setItem(SCORES_PREFIX + newName, raw);
    localStorage.removeItem(SCORES_PREFIX + oldName);
  }

  function deleteAllScores(rubricName) {
    localStorage.removeItem(SCORES_PREFIX + rubricName);
  }

  global.RubricStore = {
    listRubrics: listRubrics, saveRubric: saveRubric, loadRubric: loadRubric,
    deleteRubric: deleteRubric, getCurrentName: getCurrentName, setCurrentName: setCurrentName,
    listScoredStudents: listScoredStudents, loadScore: loadScore, saveScore: saveScore,
    deleteScore: deleteScore, renameScores: renameScores, deleteAllScores: deleteAllScores
  };
})(window);
