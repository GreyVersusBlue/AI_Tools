// _projector-off.mjs — the play screen with the projector view never turned
// on, as the v290 page drew it. smoke-projector.mjs runs this and compares
// each capture with a hash made with `--print` against the v290 page, before
// the projector view was written. Nothing here presses the new button.
//
// A capture is the markup of the play screen (#boardCard and the two
// overlays), the classes on <html> and <body>, this tool's stored keys, and
// the computed size of the type the view changes. Every name and question is
// made up.

import { settle } from '../../board-check/harness.mjs';
import { OLD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';
import { ROUNDS_BANK } from './_rounds-game.mjs';

const clone = v => JSON.parse(JSON.stringify(v));

const screenNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  const size = sel => { const n = document.querySelector(sel); return n ? getComputedStyle(n).fontSize + '/' + getComputedStyle(n).fontFamily : '-'; };
  return [
    document.documentElement.className + '|' + document.body.className + '|' + (document.body.getAttribute('style') || ''),
    id('boardCard').outerHTML, id('overlay').outerHTML, id('roundOverlay').outerHTML,
    ['.cat-header', '.cell:not(.used)', '.team-chip .score', '.team-chip input', '#overlayQuestion', '#overlayAnswer', '#overlayCatPoints'].map(size).join(' '),
  ].join('\n');
});

/** Plays OLD_BOARD through each mode's play screen with the view untouched
    and returns { name: text } captures, in order. */
export async function playScreenOff(page, url) {
  const got = {};
  const cap = async name => { got[name] = await screenNow(page); got[name + 'Storage'] = await boardStorage(page); };
  const press = async k => { await page.keyboard.press(k); await settle(page, 120); };
  const click = async sel => { await page.click(sel); await settle(page, 150); };
  page.on('dialog', d => d.accept());
  await openWith(page, url, Object.assign(storageOf(OLD_BOARD), { 'gvb-question-bank': JSON.stringify(ROUNDS_BANK) }));
  await cap('loaded');

  await click('#boardCols .cell:not(.used):not(.blank)');
  await cap('clue');
  await press('Space');
  await cap('answer');
  await press('Escape');

  await page.check('#everyTeamToggle');
  await settle(page, 150);
  await click('#boardCols .cell:not(.used):not(.blank)');
  await press('Space');
  await press('1');
  await cap('everyTeam');
  await press('Escape');

  await page.check('#finalToggle');
  await settle(page, 150);
  await page.selectOption('#finalPick', 'q-c');
  await click('#finalUseBtn');
  await click('#finalStartBtn');
  await cap('final');
  await press('Escape');

  await page.check('#quizBowlToggle');
  await settle(page, 150);
  await click('#quizBowlStartBtn');
  await cap('quizBowl');
  await press('2');
  await cap('quizBowlBuzz');
  await press('Escape');

  const wheel = Object.assign(clone(OLD_BOARD), { wheel: { on: true, seed: 'pin-projector', spins: 0, lose: true, double: true, doubleNext: false, last: null } });
  await openWith(page, url, storageOf(wheel));
  await cap('wheel');
  await press('s');
  await page.waitForTimeout(1600);
  await cap('wheelSpun');
  page.removeAllListeners('dialog');
  return got;
}
