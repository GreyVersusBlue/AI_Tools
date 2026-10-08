// _projector-fixtures.mjs — the boards smoke-projector.mjs plays. The tool
// puts no limit on a name, a category or a clue, so the "longest" one is the
// stress case chosen here: a category of 56 characters with a 30-character
// word in it, a clue of about 300 characters, a team name of 40 characters.
// Every name and question is made up.

const clue = (points, question, answer, extra) => Object.assign({ points, question, answer, used: false, dailyDouble: false }, extra || {});

export const LONG_CAT = 'Photosynthesis, Respiration & Cellular Energy Transfer';
export const WORD_CAT = 'Counterrevolutionaries_and_Co';
export const LONG_CLUE = 'This long clue is written to run to about three hundred characters on purpose, so the projected question has to wrap over many lines at a size the back of the room can read: a student reads the first sentence aloud, a second student restates it in their own words, and the teacher asks which part of it matters most for the answer.';
export const LONG_ANSWER = 'Because the answer is also long, it has to wrap too, and it must stay clear of the buttons under it: a full sentence of about a hundred and twenty characters.';
export const LONG_TEAM = 'The Unbelievably Long-Named Otters of Room 12';

const five = (extra) => [clue(100, 'Q one?', 'A one'), clue(200, 'Q two?', 'A two'), clue(300, LONG_CLUE, LONG_ANSWER, extra), clue(400, 'Q four?', 'A four', { used: true }), clue(500, 'Q five?', 'A five')];

/* Five categories of five, the long ones among them; six teams, one with the
   longest name; a Daily Double on 200 of the second category. */
export const STRESS_BOARD = {
  name: 'Projector board',
  categories: [
    { name: LONG_CAT, clues: five() },
    { name: WORD_CAT, clues: five().map((c, i) => i === 1 ? Object.assign({}, c, { dailyDouble: true }) : c) },
    { name: 'Rivers', clues: five() },
    { name: 'Deltas', clues: five() },
    { name: 'Lakes & Seas', clues: five() },
  ],
  teams: [LONG_TEAM, 'Herons', 'Finches', 'Wrens', 'Larks', 'Swifts'].map((name, i) => ({ name, score: [1200, -350, 0, 800, 100, 14500][i] })),
  dailyDoubleEnabled: true, lightningRoundEnabled: true, lightningRoundSeconds: 20,
};

export const WHEEL_ON = { on: true, seed: 'pin-projector', spins: 0, lose: true, double: true, doubleNext: false, last: null };

/* An ordinary board: five categories of five, four short team names. It is
   the one that has to fit a screen without scrolling. */
export const TYPICAL_BOARD = {
  name: 'Unit review',
  categories: ['Rivers', 'Deltas', 'Lakes', 'Seas', 'Coasts'].map(name => ({ name, clues: [100, 200, 300, 400, 500].map(p => clue(p, 'What is ' + name + ' for ' + p + '?', 'An answer for ' + p)) })),
  teams: ['Otters', 'Herons', 'Finches', 'Wrens'].map((name, i) => ({ name, score: [300, -100, 0, 1250][i] })),
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};
