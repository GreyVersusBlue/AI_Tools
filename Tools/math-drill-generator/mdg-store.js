/* Math Fact Drill Sheet Generator — localStorage persistence (last-used
   settings only; the generated problem set itself is never persisted, since
   the whole point is a fresh sheet on every visit). */
(function (global) {
  'use strict';

  var KEY = 'gvb-math-drill:settings';

  function load() {
    var json = localStorage.getItem(KEY);
    if (json == null) return null;
    try {
      var value = JSON.parse(json);
      return value == null ? null : value;
    } catch (e) { return null; }
  }

  function save(settings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }

  global.MathDrillStore = { load: load, save: save };
})(window);
