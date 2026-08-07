/* Graph Paper & Number Line Generator — localStorage persistence.
   One saved slot per mode (graph paper / number line / coordinate plane) so
   switching modes doesn't lose the other mode's settings, plus which mode
   was active last. */
(function (global) {
  'use strict';

  var KEY = 'gvb-graph-paper:settings';

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

  global.GraphPaperStore = { load: load, save: save };
})(window);
