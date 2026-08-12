/* Quiz / Review Game Board — localStorage persistence.
   Same shape as the Bracket / Tournament Generator's store: a list of named
   boards so more than one game can be kept around without overwriting. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-review-board:list';
  var DATA_PREFIX = 'gvb-review-board:data:';
  var CURRENT_KEY = 'gvb-review-board:current';

  /* NOTE: localStorage.getItem returns `null` for a missing key, and
     JSON.parse(null) parses that as the *string* "null" -> the value
     `null` (no exception!). A naive try/catch safeParse would return
     `null` instead of `fallback` for a key that was never set. Guard
     against both the missing-key case and an explicit `null` payload. */
  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listBoards() {
    return safeParse(localStorage.getItem(LIST_KEY), []);
  }

  function saveBoard(name, state) {
    var names = listBoards();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    localStorage.setItem(CURRENT_KEY, name);
  }

  function loadBoard(name) {
    return safeParse(localStorage.getItem(DATA_PREFIX + name), null);
  }

  function deleteBoard(name) {
    var names = listBoards().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  function getCurrentName() {
    return localStorage.getItem(CURRENT_KEY);
  }

  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  /* How much room the saved boards are taking, and how much there is.

     There is no API that reports a localStorage quota, so the ceiling is a
     probe rather than a lookup: write a growing string until it throws, and
     report what fit. That is done ONCE and cached, because it is not cheap
     and the answer does not change during a session. The probe writes to its
     own key and removes it in a finally block, so a throw mid-probe cannot
     leave a megabyte of padding behind in a teacher's browser.

     Sizes are in UTF-16 code units, which is what browsers actually charge
     for: a data URL is ASCII so a character is 2 bytes, and clue images are
     what fills this up. Every other key on the origin counts toward the same
     cap, so the total covers the whole origin and the boards figure is broken out
     separately — "your boards are 3 MB" is the actionable half, but a teacher
     hitting the wall because of some other tool deserves to see that too. */
  var PROBE_KEY = 'gvb-review-board:__probe';
  var cachedCapacity = null;

  function bytesOf(str) { return (str || '').length * 2; }

  function usageBytes() {
    var total = 0, boards = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key === null) continue;
      var size = bytesOf(key) + bytesOf(localStorage.getItem(key));
      total += size;
      if (key.indexOf(DATA_PREFIX) === 0 || key === LIST_KEY || key === CURRENT_KEY) boards += size;
    }
    return { total: total, boards: boards };
  }

  /** Bytes still writable, found by probing. Cached; null if even a tiny
      write fails, which means there is effectively nothing left. */
  function headroomBytes() {
    if (cachedCapacity !== null) return cachedCapacity;
    var chunk = 'x'.repeat(64 * 1024);   // 64k chars = 128 KB
    var padding = '';
    try {
      for (var i = 0; i < 200; i++) {    // stop at ~25 MB, well past any real cap
        localStorage.setItem(PROBE_KEY, padding + chunk);
        padding += chunk;
      }
    } catch (e) {
      /* expected: this is how the probe ends */
    } finally {
      try { localStorage.removeItem(PROBE_KEY); } catch (e2) { /* nothing else to do */ }
    }
    cachedCapacity = bytesOf(padding);
    return cachedCapacity;
  }

  /** { boards, total, free, cap, pct } in bytes, or null if unmeasurable. */
  function storageReport() {
    var u;
    try { u = usageBytes(); } catch (e) { return null; }
    var free = headroomBytes();
    var cap = u.total + free;
    return {
      boards: u.boards,
      total: u.total,
      free: free,
      cap: cap,
      pct: cap > 0 ? u.total / cap : 1,
    };
  }

  /** Forget the probed ceiling — after a delete, there is more room than the
      cached figure says. */
  function forgetCapacity() { cachedCapacity = null; }

  global.ReviewBoardStore = {
    storageReport: storageReport,
    forgetCapacity: forgetCapacity,
    listBoards: listBoards,
    saveBoard: saveBoard,
    loadBoard: loadBoard,
    deleteBoard: deleteBoard,
    getCurrentName: getCurrentName,
    setCurrentName: setCurrentName
  };
})(window);
