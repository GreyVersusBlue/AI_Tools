/* er-sample.js — the "Load a sample room" content for 019 (Escape Room Builder; P15, AI-30).
   Publishes window.ErSample.

   A made-up five-station room, "The Lighthouse Log", written so it reads as a sample on a printout
   (no person, no school, no class). It uses one of each puzzle type the builder has and the
   letters-toward-a-final-word feature, because a teacher looking around should see them working:

     1  text     three quarters as a decimal (numeric tolerance)        letter L
     2  digits   flashes in two minutes, code 20 (attempt limit)       letter A
     3  cipher   "check the lamp room", shift 3 (a hint that costs)     letter M
     4  text     evaporation                                           letter P
     5  text     put the letters in order: "lamp"                      End here

   Every rule the builder holds a room to is pinned by test/er-sample.test.mjs (npm run
   test:er-sample): each station playable, each answer accepted by the students' own matcher, one
   code length, a real shift, a chain that reaches every station and ends, the letters spelling the
   last answer, and every printed code inside the QR budget. Change a station and run it.

   stations() returns fresh objects in the page's in-memory shape (newSet()'s fields; `next` is a
   position, null for Auto, or 'end'); the page gives them ids when it saves. Nothing is stored here. */
(function () {
  'use strict';
  var NAME = 'Sample room: The Lighthouse Log';
  var STORY = 'The lighthouse went dark at sunset, and a ship out past the rocks is waiting for the signal. ' +
    'The keeper’s log book is locked, and every page holds a puzzle. Solve each station, collect its ' +
    'letter, and work out what to light before time runs out. (This is a sample room, made up for looking around.)';

  function station(o) {
    var base = { clue: '', answers: '', hint: '', next: null, image: '', type: 'text', hintCost: 0, awardLetter: '',
      cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null };
    Object.keys(o).forEach(function (k) { base[k] = o[k]; });
    return base;
  }

  function stations() {
    return [
      station({
        clue: 'The first line of the log reads: “Three quarters of the lamp oil is left.” Write three quarters as a decimal.',
        answers: '0.75, .75', numericTolerance: 0.001,
        hint: 'Divide 3 by 4.', awardLetter: 'L'
      }),
      station({
        type: 'digits',
        clue: 'The light flashes once every 6 seconds. How many times does it flash in 2 minutes? Enter the 2-digit code.',
        answers: '20', maxAttempts: 3,
        hint: 'Two minutes is 120 seconds.', awardLetter: 'A'
      }),
      station({
        type: 'cipher',
        clue: 'A note in the margin is written in a shift code. Decode it and type the message.',
        cipherPlain: 'check the lamp room', cipherShift: 3,
        hint: 'Every letter was moved 3 places forward in the alphabet. Move each one 3 places back.', hintCost: 5,
        awardLetter: 'M'
      }),
      station({
        clue: 'Sea spray dries on the lamp-room glass and leaves salt behind. What is it called when liquid water turns into a gas?',
        answers: 'evaporation, evaporating',
        hint: 'It starts with E.', awardLetter: 'P'
      }),
      station({
        clue: 'You collected four letters. Put them in station order. What does the log tell you to light?',
        answers: 'lamp, the lamp',
        hint: 'Station 1 gave you the first letter.', next: 'end'
      })
    ];
  }

  window.ErSample = { name: NAME, storyIntro: STORY, stations: stations };
})();
