// smoke-binder-providers.mjs — 045 Sub Binder reads every other tool's data through the Packet
// Builder's providers (Path 10 P2), and prints what it printed before.
//
//   node Tools/sub-binder-generator/test/smoke-binder-providers.mjs   (or: npm run test:sub-binder-providers; port 8595)
//
// What this pins:
//   - 045's own script names no other tool's storage key: its only localStorage keys are its own two
//     (the lesson note and the section ticks), and it loads sections.js and providers.js
//   - PARITY with the page as it was before the change (_045-frozen.html, a copy of 045 from the
//     commit before, with only its script paths moved): for a full profile, an empty one and a broken
//     one, every card, the checklist, the date hint, and the single-day and all-days printed packets
//     are byte-for-byte the same HTML
//   - the parity check can fail: a deliberately changed page (a provider reading the wrong key) turns it red
//
// print() is stubbed and the clock is pinned. Exits 1 on any failure.

if (!process.env.TZ) process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8595;
const BASE = `http://127.0.0.1:${PORT}`;
const NEW = `${BASE}/Tools/045-sub-binder-generator.html`;
const OLD = `${BASE}/Tools/sub-binder-generator/test/_045-frozen.html`;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };

const STANDING = {
  teacherName: 'Ms. Example', roomNumber: '214', rosterLocation: 'Blue folder', fireRoute: 'East door', lockdownProcedure: 'Lights off', medicalAlerts: 'None',
  phoneNurse: '555-0100', behaviorVariant: 'short', periods: [{ _id: 'p1', label: '1', time: '8:00-8:50' }, { _id: 'p2', label: '2', time: '8:55-9:45' }]
};
const HALL = { sets: { 'Period 1': { destinations: [{ label: 'Restroom', overtimeMin: 5, requiresNote: false }], oneOutAtATime: true, weeklyBudget: 4 }, 'Period 2': { destinations: [] } } };
const CAL = {
  __v: 2, meta: { start: '2026-08-17', end: '2027-06-04', yearLabel: '2026-27' },
  dayTypes: [{ id: 'nosc', label: 'No school', noSchool: true }, { id: 'half', label: 'Half day', half: true }],
  days: { '2026-10-30': { types: ['half'], label: 'Pep rally' } }
};
const SEATING = {
  active: 's1', sections: [
    { id: 's1', name: 'Period 1', students: [{ id: 'a', name: 'Ann Lee', note: 'allergy' }, { id: 'b', name: 'Bo Ray' }, { id: 'c', name: 'Cy Day' }],
      desks: [{ id: 'd1', x: 100, y: 100, rot: 0 }, { id: 'd2', x: 300, y: 100, rot: 0 }], assign: { d1: 'a', d2: 'b' } },
    { id: 's2', name: 'Period 2', students: [{ id: 'e', name: 'Eve Fox' }], desks: [{ id: 'e1', x: 0, y: 0, rot: 0 }], assign: { e1: 'e' } }
  ]
};
const BEHAVIOR = { sets: { 'Period 1': { tags: [{ label: 'On task', delta: 1 }, { label: 'Calling out', delta: -1 }] } } };
const PROMPTS = Array.from({ length: 14 }, (_, i) => ({ text: 'What is <b>prompt</b> ' + (i + 1) + '?' }));
const HISTORY = [
  { date: '2026-10-29', lessonTitle: 'Fall of Rome', overviewText: 'Watch the video', scheduleText: '8:00 start', samePeriods: false, perPeriodValues: { p1: 'Notes sheet', p2: '' }, materialsNote: 'Worksheet A' },
  { date: '2026-10-30', lessonTitle: 'Quiz', samePeriods: true, sharedPeriodNotes: 'Silent reading after' }
];

const PROFILES = {
  full: {
    'subPlanBuilder.standingDetails.v1': STANDING, 'hall-pass-log-sections': HALL, scv_calendar_v1: CAL, 'seating-chart-v1': SEATING,
    'behavior-points-tracker-sections': BEHAVIOR, 'gvb-exit-ticket:customPrompts': PROMPTS,
    'subPlanBuilder.lastAbsence.v1': { dates: ['2026-10-29', '2026-10-30'] }, 'subPlanBuilder.history.v1': HISTORY,
    'gvb-sub-binder:today-lesson': 'Bring the <i>blue</i> folder'
  },
  oneDay: { 'subPlanBuilder.standingDetails.v1': { teacherName: 'X' }, 'subPlanBuilder.lastAbsence.v1': { dates: ['2026-10-29'] }, 'subPlanBuilder.history.v1': HISTORY, 'seating-chart-v1': { sections: [] } },
  empty: {},
  broken: {
    'subPlanBuilder.standingDetails.v1': 'x', 'hall-pass-log-sections': { sets: 3 }, scv_calendar_v1: { meta: 1 }, 'seating-chart-v1': { sections: 4 },
    'behavior-points-tracker-sections': [], 'gvb-exit-ticket:customPrompts': 7, 'subPlanBuilder.lastAbsence.v1': { dates: 'x' }, 'subPlanBuilder.history.v1': 'x'
  }
};
const RAW_BROKEN = ['subPlanBuilder.standingDetails.v1', 'seating-chart-v1'];

const IDS = ['bundleDateHint', 'sectionChecklist', 'todayCalBody', 'lessonFromPlanBody', 'seatingBody', 'hallPassBody', 'behaviorBody', 'exitTicketBody', 'feedbackBody'];

async function capture(browser, url, seed, { raw = [] } = {}) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00'));
  await page.addInitScript(([seed, raw]) => {
    window.print = () => {};
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, raw.includes(k) ? '{not json' : (typeof v === 'string' && k === 'gvb-sub-binder:today-lesson' ? v : JSON.stringify(v)));
  }, [seed, raw]);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 300);
  const out = { errors };
  out.cards = await page.evaluate(ids => ids.map(id => [id, (document.getElementById(id) || {}).innerHTML]), IDS);
  out.date = await page.$eval('#bundleDate', e => e.value);
  const printed = async sel => {
    if (sel === '#printAllDaysBtn' && await page.$eval(sel, b => b.disabled || b.hidden || getComputedStyle(b).display === 'none')) return '(not offered)';
    await page.click(sel);
    return page.$eval('#printArea', e => e.innerHTML);
  };
  out.single = await printed('#printBtn');
  out.all = await printed('#printAllDaysBtn');
  if (await page.$('#combineSections') && await page.$eval('#combineRow', e => !e.hidden && getComputedStyle(e).display !== 'none')) {
    await page.check('#combineSections');
    out.combined = await printed('#printBtn');
  }
  await page.close();
  return out;
}

console.log('045 — Sub Binder reads through the Packet Builder providers');

// ---- static: no other tool's key in 045's script ----
const src = fs.readFileSync(path.join(SITE, 'Tools', '045-sub-binder-generator.html'), 'utf8');
const script = src.slice(src.lastIndexOf('<script>'));
const keysUsed = [...script.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([^,)]+)/g)].map(m => m[1].trim());
ok(keysUsed.length > 0 && keysUsed.every(k => k === 'LESSON_KEY' || k === 'INCLUDE_KEY'), '045 touches only its own two keys, saw: ' + keysUsed.join(' | '));
const FOREIGN = ['snfs_slip_v1', 'subPlanBuilder.', 'hall-pass-log-sections', 'seating-chart-v1', 'behavior-points-tracker-sections', 'gvb-exit-ticket:customPrompts', 'scv_calendar_v1', 'np_rosters', 'crh_students_v1'];
for (const k of FOREIGN) ok(!script.includes(k), `045's script does not name ${k}`);
ok(/src="packet-builder\/sections\.js"/.test(src) && /src="packet-builder\/providers\.js"/.test(src), '045 loads sections.js and providers.js');
ok(!/SchoolDay\.read\(/.test(script), '045 does not read the calendar itself');

const server = await serve(PORT);
const browser = await launch();
try {
  for (const [name, seed] of Object.entries(PROFILES)) {
    const a = await capture(browser, OLD, seed), b = await capture(browser, NEW, seed);
    ok(a.errors.length === 0 && b.errors.length === 0, `${name}: no page error (old ${a.errors.join(';')} new ${b.errors.join(';')})`);
    ok(a.date === b.date, `${name}: the date defaults the same (${a.date} / ${b.date})`);
    for (let i = 0; i < IDS.length; i++) ok(a.cards[i][1] === b.cards[i][1], `${name}: #${IDS[i]} is the same HTML` + (a.cards[i][1] === b.cards[i][1] ? '' : `\n    old: ${String(a.cards[i][1]).slice(0, 300)}\n    new: ${String(b.cards[i][1]).slice(0, 300)}`));
    ok(a.single === b.single && a.single.length > 100, `${name}: the printed packet is the same HTML (${a.single.length} chars)`);
    ok(a.all === b.all, `${name}: the all-days packet is the same HTML (${a.all.length} chars)`);
    ok(a.combined === b.combined, `${name}: the combined-seating packet is the same HTML`);
  }
  // the feedback page asks the questions on 076's slip when there is one (a design change, so no parity here)
  {
    const slip = { v: 2, sets: [{ id: 'a', name: 'General', prompts: [{ id: 'p', text: 'Old one?' }] }, { id: 'b', name: 'Lab day', prompts: [{ id: 'q', text: 'Did the <b>lab</b> run?' }, { id: 'r', text: '   ' }, { id: 's', text: 'Who stayed late?' }] }], currentId: 'b' };
    const none = await capture(browser, NEW, PROFILES.full), withSlip = await capture(browser, NEW, { ...PROFILES.full, snfs_slip_v1: slip });
    const fb = withSlip.cards.find(c => c[0] === 'feedbackBody')[1], fb0 = none.cards.find(c => c[0] === 'feedbackBody')[1];
    ok(fb.includes('Did the &lt;b&gt;lab&lt;/b&gt; run?') && fb.includes('Who stayed late?') && !fb.includes('Old one?'), 'slip: the current slip\'s questions are on the feedback page, as text');
    ok(!fb.includes('Students who helped') && (fb.match(/class="fb-block"/g) || []).length === 2, 'slip: its two questions replace the four standing blocks (the blank one is skipped)');
    ok(fb.includes('fb-table') && fb.includes('fb-sign'), 'slip: the period rows and the sign-off line stay');
    ok(fb0.includes('Students who helped') && (fb0.match(/class="fb-block"/g) || []).length === 4, 'slip: with no slip saved the four standing blocks stay');
    ok(withSlip.single.includes('Who stayed late?') && withSlip.all.includes('Who stayed late?'), 'slip: the printed packet and the all-days packet carry the questions');
    const old = await capture(browser, NEW, { ...PROFILES.full, snfs_slip_v1: { prompts: [{ text: 'Bare old slip?' }] } });
    ok(old.cards.find(c => c[0] === 'feedbackBody')[1].includes('Bare old slip?'), 'slip: a slip saved before saved slips is read too');
    const badSlip = await capture(browser, NEW, { ...PROFILES.full, snfs_slip_v1: { v: 2, sets: 'x' } });
    ok(badSlip.errors.length === 0 && badSlip.cards.find(c => c[0] === 'feedbackBody')[1] === fb0, 'slip: a broken slip key leaves the standing blocks and throws nothing');
  }
  // a key that is not JSON at all, not just the wrong shape
  {
    const a = await capture(browser, OLD, PROFILES.full, { raw: RAW_BROKEN }), b = await capture(browser, NEW, PROFILES.full, { raw: RAW_BROKEN });
    ok(a.errors.length === 0 && b.errors.length === 0, 'unparseable keys: no page error');
    ok(a.single === b.single && a.all === b.all && a.cards.every((c, i) => c[1] === b.cards[i][1]), 'unparseable keys: the same page and packets as before');
  }
  // the check can fail
  {
    const full = await capture(browser, NEW, PROFILES.full), emptied = await capture(browser, NEW, { ...PROFILES.full, 'hall-pass-log-sections': { sets: {} } });
    ok(full.single !== emptied.single, 'sanity: changing a source changes the printed packet, so equality above means something');
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
