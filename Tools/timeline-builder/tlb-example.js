/* Timeline Builder — the built-in example timeline.

   A tool that opens to an empty form asks a teacher to do the typing before
   it will show them anything (P15). This is one complete, ready-to-print
   timeline so the map pairing, the category legend, the era band, and the
   range event can all be seen in about four seconds.

   Content notes, since this is the part that has to be right:

   - Every event is a standard American Revolution unit event, at its real
     date and its real place. Descriptions are written for a 7th grader and
     for a colleague skimming the screen during a presentation, not for a
     historian.
   - The Treaty of Paris deliberately carries NO place. It was signed in
     Paris, which its description says plainly — but pinning it would drag the
     map extent across the Atlantic and squash all ten colonial pins into a
     thumb-width cluster. Leaving it unplaced keeps the map readable AND
     demonstrates the documented rule that an event without a place simply
     doesn't appear on the map. Both halves of that are on purpose. The
     explanation lives in the map panel's own pin count ("1 without a place
     will stay on the timeline only") rather than inside the event text: the
     descriptions print on a student handout and shouldn't discuss the tool.
   - Bunker Hill is placed at Boston rather than at Charlestown a mile away.
     At the scale this map prints, the two are the same pin — and grouping it
     with the other Boston events is what a student reading the map wants
     anyway.

   Plain global script (window.TimelineExample), matching the other
   timeline-builder modules. */
(function (global) {
  'use strict';

  var BOSTON = { name: 'Boston, Massachusetts', lat: 42.36, lon: -71.06 };
  var PHILLY = { name: 'Philadelphia, Pennsylvania', lat: 39.95, lon: -75.17 };

  /** A fresh copy every call — the caller edits it immediately, and handing
   *  out a shared object would let one loaded example mutate the next. */
  function build() {
    return {
      name: 'American Revolution',
      title: 'The American Revolution: When and Where',
      lineStyle: 'solid',
      compactLabels: true,
      scaleMode: 'linear',
      compareWith: null,
      tracks: [{ id: 0, name: 'Track A' }],
      eras: [
        { id: 1, label: 'War of Independence', yearStart: 1775, yearEnd: 1783, color: '#c8b48a' }
      ],
      events: [
        {
          id: 1, track: 0, yearStart: 1770, yearEnd: null,
          title: 'Boston Massacre',
          category: 'Protest',
          displayDate: null,
          description: 'British soldiers fired into a crowd of colonists, killing five. Colonial printers spread the story fast.',
          photo: null, place: BOSTON
        },
        {
          id: 2, track: 0, yearStart: 1773, yearEnd: null,
          title: 'Boston Tea Party',
          category: 'Protest',
          displayDate: null,
          description: 'Colonists dumped 342 chests of British tea into Boston Harbor to protest a tax they had no vote on.',
          photo: null, place: BOSTON
        },
        {
          id: 3, track: 0, yearStart: 1774, yearEnd: null,
          title: 'First Continental Congress',
          category: 'Government',
          displayDate: null,
          description: 'Delegates from twelve colonies met to decide how to answer Britain together instead of one colony at a time.',
          photo: null, place: PHILLY
        },
        {
          id: 4, track: 0, yearStart: 1775, yearEnd: null,
          title: 'Lexington and Concord',
          category: 'Battle',
          displayDate: null,
          description: 'The first shots of the war. British troops marched out of Boston to seize colonial weapons and met militia waiting for them.',
          photo: null,
          place: { name: 'Lexington and Concord, Massachusetts', lat: 42.45, lon: -71.29 }
        },
        {
          id: 5, track: 0, yearStart: 1775, yearEnd: null,
          title: 'Battle of Bunker Hill',
          category: 'Battle',
          displayDate: null,
          description: 'The British took the hill above Boston, but lost so many soldiers doing it that colonists took it as proof they could fight.',
          photo: null, place: BOSTON
        },
        {
          id: 6, track: 0, yearStart: 1776, yearEnd: null,
          title: 'Declaration of Independence',
          category: 'Government',
          displayDate: null,
          description: 'The Second Continental Congress declared the colonies free of British rule and explained why.',
          photo: null, place: PHILLY
        },
        {
          id: 7, track: 0, yearStart: 1776, yearEnd: null,
          title: 'Battle of Trenton',
          category: 'Battle',
          displayDate: null,
          description: 'Washington crossed the Delaware River on Christmas night and surprised the garrison, saving a losing campaign.',
          photo: null,
          place: { name: 'Trenton, New Jersey', lat: 40.22, lon: -74.74 }
        },
        {
          id: 8, track: 0, yearStart: 1777, yearEnd: null,
          title: 'Battle of Saratoga',
          category: 'Battle',
          displayDate: null,
          description: 'The turning point. An entire British army surrendered, and France decided the Americans were worth backing.',
          photo: null,
          place: { name: 'Saratoga, New York', lat: 43.08, lon: -73.65 }
        },
        {
          id: 9, track: 0, yearStart: 1777, yearEnd: 1778,
          title: 'Winter at Valley Forge',
          category: 'Army life',
          displayDate: 'Winter 1777–1778',
          description: 'Washington’s army camped through a brutal winter with too little food and clothing, and came out of it better trained.',
          photo: null,
          place: { name: 'Valley Forge, Pennsylvania', lat: 40.10, lon: -75.45 }
        },
        {
          id: 10, track: 0, yearStart: 1781, yearEnd: null,
          title: 'Siege of Yorktown',
          category: 'Battle',
          displayDate: null,
          description: 'American and French forces trapped a British army against the coast. Its surrender ended the fighting.',
          photo: null,
          place: { name: 'Yorktown, Virginia', lat: 37.24, lon: -76.51 }
        },
        {
          id: 11, track: 0, yearStart: 1783, yearEnd: null,
          title: 'Treaty of Paris',
          category: 'Government',
          displayDate: null,
          description: 'Signed in Paris, France. Britain recognized the United States as an independent country.',
          photo: null, place: null
        }
      ]
    };
  }

  global.TimelineExample = { build: build };
})(window);
