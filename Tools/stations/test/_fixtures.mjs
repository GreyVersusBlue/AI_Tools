// Fixtures for stations.test.mjs: each is what a tool's key (or share payload) holds today.
// Every name is invented. Complete station shapes, because write() emits the complete shape.

export const hSt = (label, content, extra) => ({ label, content, note: '', qType: 'text', choices: [], correctChoice: 0,
  numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '', ...extra });
export const hTeam = (name, code, extra) => ({ name, marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0, code, ...extra });
const runBase = { timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 0 };

// H2 hunt-v1-rock-cycle: three types, three teams
export const H2 = () => ({
  name: 'Rock cycle hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
  stations: [
    hSt('Igneous', 'Which rock forms when magma cools slowly underground?', { note: 'granite', hint: 'Look at the crystal size', hintPenalty: '30', codeWord: 'BASALT' }),
    hSt('Sedimentary', 'How many layers are in the sample?', { qType: 'numeric', numericAnswer: '5', tolerance: '1.50', codeWord: 'DELTA' }),
    hSt('Metamorphic', 'Marble starts as which rock?', { qType: 'choice', choices: ['Limestone', 'Shale', 'Granite'], correctChoice: 0, codeWord: 'SCHIST' }),
  ],
  run: { ...runBase, teams: [hTeam('Team 1', 'K7Q', { marks: { 0: { at: 1000, correct: true }, 1: { at: 2000, correct: true, attempts: 1 } }, attempts: { 1: 1 }, hintsUsed: { 0: { at: 900, penaltyMin: 30 } }, penaltyMs: 1800000 }),
    hTeam('Team 2', 'M3X', { marks: { 2: 3000 } }), hTeam('Team 3', 'R9T')], stagger: false }
});

// H3 hunt-v1-live-run-shifted: a mark keyed past the valid count
export const H3 = () => {
  const h = H2();
  h.run.teams[2].marks = { 1: { at: 5, correct: true }, 7: { at: 6, correct: true } };
  h.run.checkinStation = 2;
  return h;
};
// H4 hunt-v1-sparse: a blank row between two real stations; marks index the VALID list
export const H4 = () => ({
  name: 'Sparse', cardsPerPage: '9', ecLevel: 'M', showNumber: false,
  stations: [hSt('A', 'https://example.org/a', { codeWord: 'MAPLE' }), hSt('', '   ', { codeWord: 'COMET' }), hSt('C', 'plain clue text', { codeWord: 'TIGER' })],
  run: { ...runBase, teams: [hTeam('T', 'ABC', { marks: { 1: { at: 7, correct: true } } })], checkinStation: 1 }
});
// H5 hunt-v1-old-station: saved before hints and code words existed
export const H5 = () => ({ name: 'Old', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
  stations: [{ label: 'x', content: 'old clue', note: '', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0' }] });
// H6 checkinStation out of range
export const H6 = () => { const h = H2(); h.run.checkinStation = 40; return h; };

export const rSt = (o) => ({ clue: '', answers: '', hint: '', next: null, image: '', type: 'text', hintCost: 0, awardLetter: '',
  cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null, ...o });
const roomBase = { cardsPerPage: '4', ecLevel: 'Q', showNumber: true, randomizeStart: false, countdownEnabled: false,
  countdownMinutes: 20, storyIntro: '', packetCardsPerPage: '2' };

// R2 room-v1-crypt: the station-qr suite's room (station 3 is reachable only by its own code)
export const R2 = () => ({ name: 'Crypt of Ammon', roomId: 'cryptammon1', ...roomBase,
  stations: [
    rSt({ clue: 'Which god has a ram\'s head?', answers: 'amun, ammon', hint: 'Starts with A.', hintCost: 10, awardLetter: 'S' }),
    rSt({ clue: 'Read the cartouche in the picture.', answers: 'ramesses', next: 3 }),
    rSt({ clue: 'A station nobody is routed to.', answers: 'nowhere' }),
    rSt({ clue: 'How many canopic jars?', answers: '4', awardLetter: 'K' }),
  ] });
// R3 dangling next
export const R3 = () => ({ name: 'Dangling', roomId: 'dangling01', ...roomBase,
  stations: [rSt({ clue: 'one', answers: 'a', next: 9 }), rSt({ clue: 'two', answers: 'b' })] });
// R4 end here
export const R4 = () => ({ name: 'End', roomId: 'endroom001', ...roomBase,
  stations: [rSt({ clue: 'one', answers: 'a', next: 'end' }), rSt({ clue: 'two', answers: 'b' })] });
// R5 cipher keeps its hidden answers; a text station keeps a leftover cipherPlain
export const R5 = () => ({ name: 'Cipher', roomId: 'cipherrm01', ...roomBase,
  stations: [rSt({ clue: 'Decode', type: 'cipher', answers: 'typed before switching', cipherPlain: 'Hello World, hi', cipherShift: 5 }),
    rSt({ clue: 'Plain', answers: 'yes', cipherPlain: 'leftover' })] });
// R6 cipherShift 0, missing and 7
export const R6 = () => {
  const miss = rSt({ clue: 'c', type: 'cipher', cipherPlain: 'abc' }); delete miss.cipherShift;
  return { name: 'Shift', roomId: 'shiftroom1', ...roomBase,
    stations: [rSt({ clue: 'a', type: 'cipher', cipherPlain: 'abc', cipherShift: 0 }), miss, rSt({ clue: 'b', type: 'cipher', cipherPlain: 'abc', cipherShift: 7 })] };
};
// R7 numericTolerance on a digits station
export const R7 = () => ({ name: 'Tol', roomId: 'tolroom001', ...roomBase,
  stations: [rSt({ clue: 'digits', type: 'digits', answers: '1234', numericTolerance: 0.5 }), rSt({ clue: 'text', answers: '3.14, pi', numericTolerance: 0.01 })] });
// R8 the three image forms
export const R8 = () => ({ name: 'Img', roomId: 'imgroom001', ...roomBase,
  stations: [rSt({ clue: 'a', answers: 'a', image: 'idb:abc123' }), rSt({ clue: 'b', answers: 'b', image: 'data:image/png;base64,AAAA' }), rSt({ clue: 'c', answers: 'c', image: '' })] });
// R9 unknown type
export const R9 = () => ({ name: 'Maze', roomId: 'mazeroom01', ...roomBase, stations: [rSt({ clue: 'm', answers: 'x', type: 'maze' })] });
// R10 saved before roomId
export const R10 = () => { const r = R3(); delete r.roomId; return r; };
// countdown on, randomised entry, a story
export const R11 = () => ({ ...R2(), randomizeStart: true, countdownEnabled: true, countdownMinutes: 35, storyIntro: 'You wake in a crypt.' });
