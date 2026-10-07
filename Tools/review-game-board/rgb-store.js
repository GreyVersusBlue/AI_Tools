/* Quiz / Review Game Board — localStorage persistence.
   Same shape as the Bracket / Tournament Generator's store: a list of named
   boards so more than one game can be kept around without overwriting. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-review-board:list';
  var DATA_PREFIX = 'gvb-review-board:data:';
  var CURRENT_KEY = 'gvb-review-board:current';
  // The projector view (030's projector styling): a preference, not part of a
  // board, so it is not in a board, an export or a link. It is kept in
  // sessionStorage for now, which is the browser tab's own and survives a
  // reload: remembering it across visits means localStorage, and a
  // localStorage key needs a row in _shared/tool-registry.js (check:registry),
  // a shared file the per-tool row that built the view could not edit. The
  // follow-up is two lines: that registry row and `sessionStorage` -> `localStorage`
  // below. Written only while the view is on and removed when it is turned off.
  var PROJECTOR_KEY = 'gvb-review-board:projector';
  // The reusable question bank (rgb-bank-store.js) is a separate store, but
  // its one key still lives on this same origin and this same tool. Counting
  // it into the "other tools" share of the readout below would blame some
  // other page on the site for space this tool is using itself.
  var BANK_PREFIX = 'gvb-review-board-bank:';
  // Since v265 the bank is the site's shared one (_shared/question-bank.js),
  // which this tool is the editor of; the old key above is kept, not removed.
  var SHARED_BANK_KEY = 'gvb-question-bank';

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

  /** Rewrites one saved board in place and nothing else: the list and the
      open board are left alone. For the boot pass that moves clue images into
      the media store (rgb-image.js), which touches boards that are not open. */
  function writeBoard(name, state) {
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
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
     for. Clue images used to be what filled this up, as data URLs inside
     the boards; since Path 4 P4 they are in IndexedDB (rgb-image.js), and
     only a browser with no IndexedDB still keeps them inline here. Every other key on the origin counts toward the same
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
      if (key.indexOf(DATA_PREFIX) === 0 || key === LIST_KEY || key === CURRENT_KEY || key.indexOf(BANK_PREFIX) === 0 || key === SHARED_BANK_KEY) boards += size;
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

  function getProjector() {
    try { return sessionStorage.getItem(PROJECTOR_KEY) === '1'; } catch (e) { return false; }
  }

  function setProjector(on) {
    try {
      if (on) sessionStorage.setItem(PROJECTOR_KEY, '1');
      else sessionStorage.removeItem(PROJECTOR_KEY);
    } catch (e) { /* a browser that refuses storage still gets the view until the page is closed */ }
  }

  global.ReviewBoardStore = {
    getProjector: getProjector,
    setProjector: setProjector,
    storageReport: storageReport,
    forgetCapacity: forgetCapacity,
    listBoards: listBoards,
    saveBoard: saveBoard,
    writeBoard: writeBoard,
    loadBoard: loadBoard,
    deleteBoard: deleteBoard,
    getCurrentName: getCurrentName,
    setCurrentName: setCurrentName
  };
})(window);
