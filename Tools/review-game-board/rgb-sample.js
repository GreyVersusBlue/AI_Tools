/* rgb-sample.js — the "Load a sample board" content for 030 (Quiz / Review Game Board; P15, AI-30).
   Publishes window.ReviewBoardSample.

   A made-up earth-science review: three categories, five clues each, 100 to 500 points, the
   shape a teacher builds most often. It names no person, no school and no class, and it fills the
   board editor only: nothing is stored until the teacher presses Save board, as with anything typed
   there, and the saved board gets the page's own two default teams ("Team 1", "Team 2").

   What the page does to a board, the sample already is, so it comes back unchanged
   (test/rgb-sample.test.mjs, npm run test:rgb-sample): readManualEditor() trims every field,
   drops a blank row and sorts each category by points; Save keys a played clue by its category
   name and question, and the bank's "pull into board" finds a category by name, so both are
   unique; points are whole numbers, the same ladder in every column so the rows line up.

   categories() returns fresh objects in the editor's shape ({ name, clues: [{ points, question,
   answer }] }), the same shape addCategoryBlock() takes. */
(function () {
  'use strict';
  var NAME = 'Sample board: Earth Science Review';

  function cat(name, rows) {
    return { name: name, clues: rows.map(function (r, i) { return { points: (i + 1) * 100, question: r[0], answer: r[1] }; }) };
  }

  function categories() {
    return [
      cat('Weather and Water', [
        ['What is it called when water vapor cools and turns back into a liquid?', 'Condensation'],
        ['What instrument measures air pressure?', 'A barometer'],
        ['What kind of cloud is tall and puffy and often brings thunderstorms?', 'Cumulonimbus'],
        ['What is the word for water that falls from clouds as rain, snow, sleet or hail?', 'Precipitation'],
        ['Why does a town on the coast usually have milder winters than a town far inland?',
          'Water heats up and cools down more slowly than land, so the ocean keeps the air near it milder.']
      ]),
      cat('Earth’s Layers', [
        ['What is the outermost solid layer of Earth called?', 'The crust'],
        ['Which layer lies between the crust and the core?', 'The mantle'],
        ['What is the slow circular flow of hot rock in the mantle called?', 'Convection (convection currents)'],
        ['What are the large moving pieces of Earth’s crust called?', 'Tectonic plates'],
        ['The outer core is liquid. Which two metals is it mostly made of?', 'Iron and nickel']
      ]),
      cat('Earth in Space', [
        ['What is the closest star to Earth?', 'The Sun'],
        ['About how long does Earth take to go around the Sun once?', 'About 365 days (one year)'],
        ['Which planet is known for its wide, bright rings?', 'Saturn'],
        ['Why does the Moon seem to change shape over a month?', 'As it orbits Earth, we see different amounts of its sunlit half.'],
        ['What causes Earth’s seasons?', 'The tilt of Earth’s axis as Earth orbits the Sun']
      ])
    ];
  }

  window.ReviewBoardSample = { name: NAME, categories: categories };
})();
