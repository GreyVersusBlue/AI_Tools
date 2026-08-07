/* Certificate & Award Maker — localStorage persistence.
   Just one saved slot (the last settings used), unlike the bracket/board
   tools' multi-named-list — there's no real need to keep several certificate
   drafts around, just to not retype the same fields every time. */
(function (global) {
  'use strict';

  var KEY = 'gvb-certificate-maker:last';

  /* localStorage.getItem returns `null` for a missing key, and
     JSON.parse(null) parses as the string "null" -> the value `null` with
     no exception. Guard both the missing-key case and an explicit `null`
     payload so a first-ever visit doesn't crash on load. */
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

  global.CertificateStore = { load: load, save: save };
})(window);
