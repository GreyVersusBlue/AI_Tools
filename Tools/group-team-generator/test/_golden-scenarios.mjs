// _golden-scenarios.mjs — the fixed scenarios that pin 002's grouping.
//
// Used by _record-golden.mjs (run ONCE, on the page as it was before the year
// memory and roles were added, to write golden-old-groupings.json) and by
// smoke-year-memory.mjs (which replays them on the current page with both new
// options off and demands the same groups, the same floaters and the same saved
// string). Math.random is replaced by a seeded generator before the page loads,
// so "the same" is exact: every draw the page makes, in order, is the same
// number. A change that makes the page draw one extra number with the options
// off would move every group after it, and the golden would say so.
// Every name is invented.

export const FIRST = ['Ada', 'Bo', 'Cy', 'Di', 'Eli', 'Fay', 'Gus', 'Hana', 'Ira', 'Jo', 'Kai', 'Lena', 'Mo', 'Nia', 'Oz', 'Pia',
  'Quin', 'Rae', 'Sol', 'Tess', 'Uri', 'Val', 'Wen', 'Xan', 'Yul', 'Zed', 'Abe', 'Bea', 'Cal', 'Dot', 'Eve', 'Flo', 'Gil', 'Hal', 'Isa', 'Jem'];
export const nameList = n => FIRST.slice(0, n).map((f, i) => f + ' Test' + String.fromCharCode(65 + (i % 26)));

export function mulberryInit(seed) {
  return `(() => { let a = ${seed} >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
}

/* n students; skills 'on' types ", 1-5" after each name. apart / together are index pairs into the roster. */
export const SCENARIOS = [
  { id: 'random-28-by-7', n: 28, mode: 'count', value: 7, strategy: 'random', odd: 'extra', seed: 11 },
  { id: 'random-27-size4', n: 27, mode: 'size', value: 4, strategy: 'random', odd: 'extra', seed: 12 },
  { id: 'random-27-floaters', n: 27, mode: 'size', value: 4, strategy: 'random', odd: 'floater', seed: 13 },
  { id: 'random-27-own-group', n: 27, mode: 'size', value: 4, strategy: 'random', odd: 'pair', seed: 14 },
  { id: 'apart-together-24', n: 24, mode: 'count', value: 6, strategy: 'random', odd: 'extra', seed: 15, apart: [[0, 1], [2, 3], [4, 5], [6, 7]], together: [[8, 9], [10, 11]] },
  { id: 'balanced-26', n: 26, mode: 'count', value: 5, strategy: 'balanced', odd: 'extra', seed: 16, skills: true },
  { id: 'hetero-26', n: 26, mode: 'count', value: 5, strategy: 'heterogeneous', odd: 'extra', seed: 17, skills: true },
  { id: 'homo-26', n: 26, mode: 'count', value: 5, strategy: 'homogeneous', odd: 'floater', seed: 18, skills: true },
  { id: 'coverage-24', n: 24, mode: 'size', value: 4, strategy: 'coverage', odd: 'extra', seed: 19 },
  { id: 'coverage-apart-30', n: 30, mode: 'count', value: 6, strategy: 'coverage', odd: 'extra', seed: 20, apart: [[0, 1], [0, 2], [3, 4]] },
  { id: 'absent-locks-22', n: 22, mode: 'count', value: 5, strategy: 'random', odd: 'extra', seed: 21, absent: [3, 9], lock: [0, 2] },
  { id: 'small-8', n: 8, mode: 'count', value: 4, strategy: 'random', odd: 'extra', seed: 22 },
];
export const ROUNDS = 5;

export async function setUp(page, base, sc) {
  const names = nameList(sc.n);
  await page.addInitScript(mulberryInit(sc.seed));
  await page.goto(base + '/Tools/002-group-team-generator.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const lines = names.map((nm, i) => sc.skills ? nm + ', ' + (1 + ((i * 7) % 5)) : nm);
  await page.fill('#names-input', lines.join('\n'));
  await page.dispatchEvent('#names-input', 'input');
  await page.waitForTimeout(200);
  await page.click(sc.mode === 'size' ? 'label[for="mode-size"]' : 'label[for="mode-count"]');
  await page.fill('#split-value', String(sc.value));
  await page.selectOption('#strategy-select', sc.strategy);
  await page.selectOption('#odd-mode-select', sc.odd);
  for (const [a, b] of sc.apart || []) {
    await page.selectOption('#pair-a', names[a]); await page.selectOption('#pair-b', names[b]); await page.click('#add-pair-btn');
  }
  for (const [a, b] of sc.together || []) {
    await page.selectOption('#together-a', names[a]); await page.selectOption('#together-b', names[b]); await page.click('#add-together-btn');
  }
  for (const i of sc.absent || []) await page.locator('#absent-list label').nth(i).click();
  await page.waitForTimeout(150);
  return names;
}

/** Runs the scenario and returns { steps: [{ groups, floaters }], saved } */
export async function runScenario(page, base, sc) {
  await setUp(page, base, sc);
  const steps = [];
  const grab = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('#results .group-card')].map(c => [...c.querySelectorAll('li > span:first-child')].map(s => s.textContent));
    const fl = document.querySelector('#results .floater-box');
    return { groups: cards, floaters: fl ? fl.textContent : '' };
  });
  for (let r = 0; r < ROUNDS; r++) {
    if (r === 0) await page.click('#generate-btn');
    else {
      if (r === 2) for (const g of sc.lock || []) await page.click(`[data-lock="${g}"]`);
      await page.click('#regenerate-btn');
    }
    await page.waitForTimeout(120);
    steps.push(await grab());
  }
  const saved = await page.evaluate(() => localStorage.getItem('gtg:data:' + localStorage.getItem('gtg:current')));
  return { steps, saved };
}
