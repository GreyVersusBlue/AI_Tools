// smoke-lab-handoff.mjs — 059 -> 065: "Start a lab report from this plan" (BACKLOG rank 90).
//
//   node Tools/experiment-design-planner/test/smoke-lab-handoff.mjs        (port 8639)
//
// The planner's question, hypothesis, materials and procedure travel in 065's own ?template= link
// and are saved there beside whatever templates are already saved, under a free name. This drives
// both pages: the plan is seeded on 059, the button is pressed with window.open captured, and the
// captured link is opened in 065. What this holds down:
//
//   The link: 065's page and parameter, one tab, noopener, nothing stored on 059's side and no
//   new key; the payload carries exactly the plan's four parts and title, blank rows dropped, a
//   missing hypothesis part as ____, and not the variables, a student's name or anything else.
//   The arrival: saved under the plan's title beside an existing template of the same name (never
//   over it), the fields filled, and everything the link left out (columns, observations prompt,
//   conclusion questions) the generic lab's, so the report is whole. A link that carries an empty
//   columns list still keeps it empty (065's own share is unchanged).
//   The refusals: an empty plan, a blocked tab, a plan too long for a link (no tab opened).
//   Markup in the plan stays text on 065. 360 px, axe on both pages, nothing leaves the site.
//
// Exits 1 on any failure. Every word here is invented; nothing was printed on paper.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8639;
const BASE = `http://127.0.0.1:${PORT}`;
const PLAN = BASE + '/Tools/059-experiment-design-planner.html';
const LAB = BASE + '/Tools/065-lab-report-template-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const row = (t, i) => ({ id: 'r' + i + Math.random().toString(36).slice(2, 5), text: t });
const PLAN_STATE = {
  title: 'Does soil type change how fast water drains?',
  question: 'How does the kind of soil change how quickly 200 mL of water drains through it?',
  hypIf: 'the soil is sandy', hypThen: 'water will drain faster', hypBecause: 'sand has bigger gaps between grains',
  varIndependent: 'type of soil', varDependent: 'seconds to drain',
  controlled: [row('same amount of water', 1), row('same cup size', 2)],
  materials: [row('3 paper cups', 3), row('', 4), row('sand', 5), row('stopwatch', 6)],
  procedure: [row('Poke five holes in each cup.', 7), row('   ', 8), row('Pour 200 mL of water and time it.', 9)],
};

console.log('Experiment Design Planner → Lab Report Template Builder');

const server = await serve(PORT);
const browser = await launch();

async function openPlan(state, opts = {}) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(([s]) => {
    window.__opened = [];
    window.__block = false;
    window.open = (url, target, features) => { window.__opened.push({ url, target, features }); return window.__block ? null : {}; };
    if (s) localStorage.setItem('edp_planner_v1', JSON.stringify(s));
  }, [state]);
  await page.goto(PLAN, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}

// ---- the button, the link
const p = await openPlan(PLAN_STATE);
ok(await p.isVisible('#labReportBtn'), 'the button is on the page');
const keysBefore = await p.evaluate(() => Object.keys(localStorage).sort().join('|'));
await p.click('#labReportBtn');
const opened = await p.evaluate(() => window.__opened);
eq(opened.length, 1, 'one tab is opened');
eq(opened[0] && opened[0].features, 'noopener', 'as a noopener tab');
ok(opened[0] && opened[0].url.indexOf(LAB + '?template=') === 0, "at 065's page with 065's parameter: " + (opened[0] && opened[0].url.slice(0, 120)));
ok(/Started a lab report/.test(await p.textContent('#labReportNote')), 'the note says so: ' + await p.textContent('#labReportNote'));
const payload = await p.evaluate((u) => window.StateLink.decodeState(new URL(u).searchParams.get('template')), opened[0].url);
eq(payload.title, PLAN_STATE.title, 'the title travels');
eq(payload.name, PLAN_STATE.title, 'and is the name');
eq(payload.objective, PLAN_STATE.question, 'the question is the objective');
eq(payload.hypothesisPrompt, 'If the soil is sandy, then water will drain faster, because sand has bigger gaps between grains.', 'the hypothesis fills the prompt');
eq(payload.materials, [{ text: '3 paper cups' }, { text: 'sand' }, { text: 'stopwatch' }], 'materials, blank row dropped, no ids');
eq(payload.procedure, [{ text: 'Poke five holes in each cup.' }, { text: 'Pour 200 mL of water and time it.' }], 'procedure, blank rows dropped');
eq(Object.keys(payload).sort(), ['from', 'hypothesisPrompt', 'materials', 'name', 'objective', 'procedure', 'title', 'v'], 'and nothing else: no variables, no columns');
ok(!/type of soil|seconds to drain|same cup size/.test(JSON.stringify(payload)), 'the variables stay on the plan');
eq(await p.evaluate(() => Object.keys(localStorage).sort().join('|')), keysBefore, '059 stored nothing and added no key');
eq(await p.evaluate(() => JSON.parse(localStorage.getItem('edp_planner_v1')).title), PLAN_STATE.title, 'the plan is as it was');

// ---- a plan missing parts: ____
const part = await openPlan({ ...PLAN_STATE, hypIf: '', hypThen: 'it drains', hypBecause: '', title: '' });
await part.click('#labReportBtn');
const pl2 = await part.evaluate(() => window.StateLink.decodeState(new URL(window.__opened[0].url).searchParams.get('template')));
eq(pl2.hypothesisPrompt, 'If ____, then it drains, because ____.', 'a missing hypothesis part is ____');
eq(pl2.name, 'Lab report from an experiment plan', 'no title: a plain name');
eq(pl2.title, '', 'and an empty title, not the name');
await part.close();

// ---- the arrival on 065, beside an existing template of the same name
const lab = await prepPage(browser, BASE, { width: 1200, height: 900 });
await lab.addInitScript(([name]) => {
  if (!localStorage.getItem('lrt_list_v1')) {
    localStorage.setItem('lrt_list_v1', JSON.stringify([name]));
    localStorage.setItem('lrt_current_v1', name);
    localStorage.setItem('lrt_data_v1:' + name, JSON.stringify({ name, title: 'MINE', objective: 'mine', hypothesisPrompt: 'mine', materials: [{ id: 'a', text: 'mine' }], procedure: [], columns: [], dataRows: 5, observationsPrompt: '', conclusion: [] }));
  }
}, [PLAN_STATE.title]);
await lab.goto(opened[0].url, { waitUntil: 'networkidle' });
await settle(lab, 400);
const names = await lab.evaluate(() => JSON.parse(localStorage.getItem('lrt_list_v1')));
eq(names, [PLAN_STATE.title, PLAN_STATE.title + ' (2)'], 'saved beside the template of the same name, under a free name');
eq(await lab.evaluate((n) => JSON.parse(localStorage.getItem('lrt_data_v1:' + n)).title, PLAN_STATE.title), 'MINE', 'and the existing one is untouched');
eq(await lab.inputValue('#labTitle'), PLAN_STATE.title, 'the lab title is filled');
eq(await lab.inputValue('#objective'), PLAN_STATE.question, 'the objective is the question');
eq(await lab.inputValue('#hypothesisPrompt'), payload.hypothesisPrompt, 'the hypothesis is filled');
const lists = await lab.evaluate(() => {
  const vals = (id) => [...document.querySelectorAll('#' + id + ' input[type="text"]')].map((i) => i.value);
  return { materials: vals('materialsWrap'), procedure: vals('procedureWrap'), columns: vals('columnsWrap'), conclusion: vals('conclusionWrap') };
});
eq(lists.materials, ['3 paper cups', 'sand', 'stopwatch'], 'materials are rows');
eq(lists.procedure, ['Poke five holes in each cup.', 'Pour 200 mL of water and time it.'], 'procedure steps are rows');
ok(lists.columns.length >= 2 && lists.columns[0] === 'Trial', "the data table has the generic lab's columns: " + JSON.stringify(lists.columns));
ok(lists.conclusion.length >= 3, "and its conclusion questions: " + JSON.stringify(lists.conclusion));
ok((await lab.inputValue('#observationsPrompt')).length > 10, 'and its observations prompt');
ok(/Loaded a shared template as/.test(await lab.textContent('#shareNote')), 'and 065 says it loaded one: ' + await lab.textContent('#shareNote'));
// the report prints whole: all seven sections come out of the build (a sheet is built by the print button)
await lab.evaluate(() => { window.print = () => {}; });
await lab.click('#printBothBtn');
const printed = await lab.evaluate(() => document.getElementById('printArea').innerText);
ok(/Objective/.test(printed) && /Hypothesis/.test(printed) && /Materials/.test(printed) && /Procedure/.test(printed) && /Data/.test(printed) && /Conclusion/.test(printed), 'the full report builds: ' + printed.slice(0, 80).replace(/\n/g, ' '));
ok(/If the soil is sandy, then water will drain faster/.test(printed) && /Poke five holes/.test(printed), 'with the plan in it');
await lab.close();

// ---- 065's own share is unchanged: an empty columns list sent stays empty
const own = await prepPage(browser, BASE, { width: 1200, height: 900 });
await own.goto(LAB, { waitUntil: 'networkidle' });
const ownUrl = await own.evaluate(() => window.StateLink.buildShareUrl('template', { name: 'Bare', title: 'Bare', objective: 'x', hypothesisPrompt: 'y', materials: [], procedure: [], columns: [], observationsPrompt: '', conclusion: [], dataRows: 5 }, { base: location.origin + location.pathname }));
await own.goto(ownUrl, { waitUntil: 'networkidle' });
await settle(own, 300);
const bare = await own.evaluate(() => JSON.parse(localStorage.getItem('lrt_data_v1:Bare')));
eq([bare.columns.length, bare.conclusion.length, bare.observationsPrompt], [0, 0, ''], 'a link that sends empty sections keeps them empty');
await own.close();

// ---- refusals
const empty = await openPlan({ ...PLAN_STATE, title: '', question: '', hypIf: '', hypThen: '', hypBecause: '', materials: [row('', 1)], procedure: [row('', 2)] });
await empty.click('#labReportBtn');
eq(await empty.evaluate(() => window.__opened.length), 0, 'an empty plan opens no tab');
ok(/Fill in some of the plan first/.test(await empty.textContent('#labReportNote')), 'and says to fill it in');
await empty.close();

const blocked = await openPlan(PLAN_STATE);
await blocked.evaluate(() => { window.__block = true; });
await blocked.click('#labReportBtn');
ok(/blocked the new tab/.test(await blocked.textContent('#labReportNote')), 'a blocked tab is said: ' + await blocked.textContent('#labReportNote'));
await blocked.close();

const longState = { ...PLAN_STATE, procedure: Array.from({ length: 40 }, (_, i) => row('Step ' + i + ': ' + 'a long careful instruction '.repeat(10), 100 + i)) };
const long = await openPlan(longState);
await long.click('#labReportBtn');
eq(await long.evaluate(() => window.__opened.length), 0, 'a plan too long for a link opens no tab');
ok(/Nothing was sent/.test(await long.textContent('#labReportNote')) && /7,500/.test(await long.textContent('#labReportNote')), 'and says why: ' + (await long.textContent('#labReportNote')).slice(0, 120));
ok(await long.evaluate(() => document.getElementById('labReportNote').classList.contains('error')), 'as an error');
await long.close();

// ---- markup in a plan stays text on 065
const evil = await openPlan({ ...PLAN_STATE, title: '<img src=x onerror=window.__x=1>', question: '<b>q</b>', materials: [row('<script>window.__x=1</script>', 1)] });
await evil.click('#labReportBtn');
const evilUrl = await evil.evaluate(() => window.__opened[0].url);
await evil.close();
const lab2 = await prepPage(browser, BASE, { width: 1200, height: 900 });
await lab2.goto(evilUrl, { waitUntil: 'networkidle' });
await settle(lab2, 300);
eq(await lab2.evaluate(() => window.__x === 1 || !!document.querySelector('img[src="x"]')), false, 'markup in a plan does not run on 065');
eq(await lab2.inputValue('#objective'), '<b>q</b>', 'it is the plan’s text');
await lab2.close();

// ---- 360 px and axe on both pages, no request off the site
const mob = await openPlan(PLAN_STATE);
await mob.setViewportSize({ width: 360, height: 800 });
await mob.click('#labReportBtn');
await settle(mob, 150);
eq(await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'the planner fits at 360 px with the button and its note');
await mob.setViewportSize({ width: 1200, height: 900 });
const v1 = await a11yScan(mob);
eq(v1.length, 0, 'axe on 059: ' + JSON.stringify(v1.map((v) => [v.id, v.nodes])));
eq(mob.__errs.length, 0, 'no page/console errors on 059: ' + JSON.stringify(mob.__errs.slice(0, 3)));
eq(mob.__blocked.length, 0, '059 requested nothing off the site: ' + JSON.stringify(mob.__blocked.slice(0, 3)));
await mob.close();

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
