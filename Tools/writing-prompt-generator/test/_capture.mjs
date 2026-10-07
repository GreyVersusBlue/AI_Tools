// _capture.mjs — drives the writing prompt page the way a teacher does and
// records what it shows and prints, for the golden of the page as it was
// before sentence starters and "if you're stuck" lines.
//
// It uses only controls that existed then. The page's Math.random is replaced
// by a seeded generator before the page's own script runs, so a draw is the
// same every time and, because the page asks for exactly the numbers it asked
// for before, a change that makes the page ask for a different count of them
// shows up as a different prompt.
import { createHash } from 'node:crypto';
import { settle } from '../../board-check/harness.mjs';

const PAGE = '/Tools/025-writing-prompt-generator.html';
const K = 'gvb-writing-prompts:';
const sha = s => createHash('sha256').update(s).digest('hex');
// The page stamps today's date on its history and its roster sheet; a golden
// that kept it would fail tomorrow.
const noDate = s => s.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE');

// Saved states a teacher could already have on the device. Each is a whole
// localStorage picture, as the page's own store wrote it.
export const SCENARIOS = [
  { name: 'fresh', seed: 11, store: {} },
  { name: 'ms-persuasive', seed: 23, store: { settings: { bands: ['ms'], genre: 'persuasive', includeCustom: true, mode: 'draw' } } },
  { name: 'hs-creative-wide', seed: 37, store: { settings: { bands: ['hs'], genre: 'creative', includeCustom: true, mode: 'draw', handoutSpacing: 'wide', handoutNameLine: false, wordGoal: 150 } } },
  { name: 'expository-narrow', seed: 41, store: { settings: { bands: ['ms', 'hs'], genre: 'expository', includeCustom: true, mode: 'draw', handoutSpacing: 'narrow', wordGoal: null } } },
  { name: 'descriptive-blank', seed: 53, store: { settings: { bands: ['hs'], genre: 'descriptive', includeCustom: true, mode: 'draw', handoutSpacing: 'blank' } } },
  { name: 'custom-prompts', seed: 67, store: {
    settings: { bands: ['ms'], genre: 'narrative', includeCustom: true, mode: 'draw' },
    custom: [
      { id: 'cpA', text: 'Write about the best thing in your backpack.', band: 'ms', genre: 'narrative' },
      { id: 'cpB', text: 'Should the class pet be a fish or a hamster? Take a side.', band: 'both', genre: 'narrative' }] } },
  { name: 'sequence-set', seed: 71, store: {
    settings: { bands: ['ms', 'hs'], genre: 'all', includeCustom: true, mode: 'sequence' },
    sets: [{ id: 'setQ', name: 'Unit one', startDate: null, cursor: 0, items: [
      { id: 'q1', band: 'ms', genre: 'narrative', text: 'Tell the story of the best day you\'ve had this year.', rubricName: null },
      { id: 'q2', band: 'hs', genre: 'persuasive', text: 'Should voting be mandatory for all eligible citizens?', rubricName: null },
      { id: 'q3', band: 'ms', genre: 'creative', text: 'Write a story that begins: The last thing I expected to find in my locker was...', rubricName: null },
      { id: 'q4', band: 'hs', genre: 'expository', text: 'Explain how algorithms shape what information people see online.', rubricName: null }] }],
    activeSet: 'setQ' } },
];

export const ROSTER = ['Ada Q', 'Ben R', 'Cy S', 'Dee T', 'Eli U'];

export function seedScript(seed, store) {
  return `(() => {
    let a = ${seed} >>> 0;
    Math.random = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const store = ${JSON.stringify(store)};
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      for (const k of Object.keys(store)) {
        const v = store[k];
        localStorage.setItem(${JSON.stringify(K)} + k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    }
  })();`;
}

async function printed(page, btn, area) {
  await page.evaluate(() => { window.__realPrint = window.print; window.print = () => {}; });
  await page.click(btn);
  const html = await page.evaluate(sel => document.querySelector(sel).innerHTML, area);
  await page.evaluate(() => { window.print = window.__realPrint; });
  await page.dispatchEvent('body', 'keydown', {}).catch(() => {});
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  return html;
}

async function snapshot(page) {
  const stage = await page.evaluate(() => ({
    prompt: document.getElementById('stagePrompt').innerHTML,
    meta: document.getElementById('metaRow').innerHTML,
  }));
  const poster = await printed(page, '#printPosterBtn', '#posterPrintArea');
  const handout = await printed(page, '#printHandoutBtn', '#handoutPrintArea');
  return { stage, poster, handout };
}

/** One scenario's record: a hash per surface, so a change anywhere shows. */
export async function captureScenario(browser, base, sc, prep) {
  const page = await prep(browser, base, { width: 1400, height: 1000 });
  await page.addInitScript(seedScript(sc.seed, sc.store));
  await page.goto(base + PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  const out = { shots: [] };
  const sequence = sc.store.settings && sc.store.settings.mode === 'sequence';
  if (sequence) {
    for (let i = 0; i < 4; i++) {
      out.shots.push(await snapshot(page));
      if (i < 3) { await page.click('#seqNextBtn'); await settle(page, 80); }
    }
  } else {
    for (let i = 0; i < 4; i++) {
      await page.click('#generateBtn');
      await settle(page, 80);
      out.shots.push(await snapshot(page));
    }
  }
  await page.fill('#rosterNamesInput', ROSTER.join('\n'));
  await page.click('#buildRosterSheetBtn');
  await settle(page, 80);
  out.rosterPreview = await page.evaluate(() => document.getElementById('rosterSheetPreview').innerHTML);
  out.roster = await printed(page, '#printRosterSheetBtn', '#rosterPrintArea');
  out.stored = await page.evaluate(k => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(k)) o[key] = localStorage.getItem(key);
    }
    return o;
  }, K);
  const promptTexts = out.shots.map(s => s.stage.prompt.replace(/<[^>]+>/g, ''));
  await page.context().close();
  const hashes = {
    prompts: promptTexts,
    stage: sha(JSON.stringify(out.shots.map(s => s.stage))),
    poster: sha(JSON.stringify(out.shots.map(s => s.poster))),
    handout: sha(JSON.stringify(out.shots.map(s => s.handout))),
    roster: sha(noDate(out.rosterPreview + '\n' + out.roster)),
    stored: sha(noDate(JSON.stringify(out.stored, Object.keys(out.stored).sort()))),
  };
  return { hashes, out };
}
