/* levels.js — the three differentiation levels, named once (AI-30, rank 67).
   Publishes window.Levels. Classic script, pure: no DOM, no storage.

   Devon teaches Academic, Honors and Honors GT sections of the same course, and four pages print a
   packet at a level: 028, 054, 056 and 083. Each kept its own list, with its own key for Honors GT
   ('gt' on 054, 056 and 083; 'honorsgt' on 028, which is what its saved data and share links
   carry), so a level key stored on a page is NOT changed by this file; a page maps its own key
   with Levels.label().

     Levels.LEVELS            [{ id, label }] in the order "print all three levels" prints the piles:
                              academic, honors, gt
     Levels.DEFAULT           'honors' — the baseline every page prints exactly as it always did
     Levels.isLevel(id)       true for 'academic', 'honors', 'gt'
     Levels.label(id)         'Academic' | 'Honors' | 'Honors GT'; an unknown id (028's 'honorsgt' too:
                              that page asks for 'gt') gives 'Honors'
     Levels.labels()          a fresh { academic, honors, gt } -> label object (083's LEVEL_LABEL)

   The footer a page prints under a set is its own markup (054 "Level: X", 028 the bare name, 056
   "X set · title"); only the names are shared. */
(function (root) {
  'use strict';

  var LEVELS = [
    { id: 'academic', label: 'Academic' },
    { id: 'honors', label: 'Honors' },
    { id: 'gt', label: 'Honors GT' }
  ];
  var DEFAULT = 'honors';

  function isLevel(id) { return LEVELS.some(function (l) { return l.id === id; }); }
  function label(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i].label;
    return 'Honors';
  }
  function labels() {
    var o = {};
    LEVELS.forEach(function (l) { o[l.id] = l.label; });
    return o;
  }

  root.Levels = { LEVELS: LEVELS, DEFAULT: DEFAULT, isLevel: isLevel, label: label, labels: labels };
})(typeof window !== 'undefined' ? window : globalThis);
