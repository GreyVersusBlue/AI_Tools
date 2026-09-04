// smoke-rename-follow.mjs — a roster rename, followed through seven tools.
//
//   node Tools/roster/test/smoke-rename-follow.mjs
//
// Path 3 P4. Eight tools keep per-student history and every one of them keys it
// on the NAME STRING, so re-importing a roster whose file switched from
// "Smith, Aiden" to "Aiden Smith" used to orphan the lot — points, hall passes,
// pairing memory, role recency, reading logs, contact logs, safety contracts —
// for every student in the class at once. `Roster.trackRenames` does the id
// bookkeeping (covered as logic in roster.test.mjs); each tool answers what a
// rename means to its own records. This drives the seven that adopted it in P4
// through the real page: 008 has its own suite already.
//
// The shape of every case is the same, and it is the shape a teacher hits:
//
//   1. Seed np_rosters with the OLD names and mint ids for them, exactly as
//      Class Roster Hub does — through Roster.syncRecords, so the fixture and
//      the tool agree about what an id is.
//   2. Seed the tool's own storage with a section/class that has history keyed
//      to those old names, and the id map it would have written on its last
//      visit.
//   3. Re-import: np_rosters gets the flipped names, the sidecar keeps the ids.
//   4. Open the tool, load the roster from the picker.
//   5. The history is under the NEW names, and nothing is left under the old.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8411;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ROSTER = 'Period 3 Science';
const OLD = ['Smith, Aiden', 'Hopper, Grace'];
const NEW = ['Aiden Smith', 'Grace Hopper'];

const server = await serve(PORT);
const browser = await launch();

console.log('Following a roster rename through the tools that keep history (Path 3 P4)');

/**
 * Opens `file`, seeds np_rosters + the sidecar with the OLD names, hands the
 * ids to `seed` so it can write the tool's own storage, then re-imports the
 * NEW names and reloads. Returns the page, ready for the picker.
 */
async function stage(file, seed) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message)));
  const url = BASE + '/Tools/' + file.split('/').map(encodeURIComponent).join('/');
  await page.goto(url, { waitUntil: 'networkidle' });

  const ids = await page.evaluate(([roster, old]) => {
    localStorage.clear();
    window.Roster.setRoster(roster, old);
    window.Roster.syncRecords(roster, old);
    return window.Roster.getStudents(roster).map(r => r.id);
  }, [ROSTER, OLD]);

  await page.evaluate(seed.script, { ids, roster: ROSTER, old: OLD });

  await page.evaluate(([roster, next]) => {
    window.Roster.setRoster(roster, next);
    window.Roster.syncRecords(roster, next);
  }, [ROSTER, NEW]);

  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 350);
  return { page, ids, errors };
}

/** Picks the roster in `sel` and presses `btn`. */
async function loadRoster(page, sel, btn) {
  await page.selectOption(sel, ROSTER);
  await page.click(btn);
  await settle(page, 250);
}

/* ── 013 Lab Safety Contract Tracker — contracts[name] ────────────────────── */
{
  const { page, errors } = await stage('013-lab-safety-contract-tracker.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('lsct_sections_v1', JSON.stringify({
        'Block A': {
          roster: old.slice(),
          contracts: { [old[0]]: { docs: { d1: true }, note: 'goggles signed' } },
          dueDate: '', documents: [{ id: 'd1', label: 'Safety contract' }],
          rosterName: roster,
          idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
        },
      }));
      localStorage.setItem('lsct_current_v1', 'Block A');
    },
  });
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lsct_sections_v1'))['Block A']);
  eq(saved.roster, NEW, '013: the roster is stored under the new names');
  ok(saved.contracts['Aiden Smith'] && saved.contracts['Aiden Smith'].note === 'goggles signed',
    '013: the signed contract followed the rename');
  ok(!saved.contracts['Smith, Aiden'], '013: ...and nothing is left under the old name');
  ok(errors.length === 0, `013: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 033 SSR Log Tracker — logs[name] and finished[name] ──────────────────── */
{
  const { page, errors } = await stage('033-ssr-log-tracker.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('sslt_sections_v1', JSON.stringify({
        'Block A': {
          roster: old.slice(),
          logs: { [old[0]]: [{ id: 'e1', date: '2026-09-01', book: 'Holes', pagesTo: 40, minutes: 20 }] },
          finished: { [old[0]]: ['Holes'] },
          genres: {}, weeklyGoalPages: 0, weeklyGoalMinutes: 0,
          rosterName: roster,
          idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
        },
      }));
      localStorage.setItem('sslt_current_v1', 'Block A');
    },
  });
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sslt_sections_v1'))['Block A']);
  eq(saved.roster, NEW, '033: the roster is stored under the new names');
  eq((saved.logs['Aiden Smith'] || []).length, 1, '033: the reading log followed the rename');
  eq(saved.finished['Aiden Smith'], ['Holes'], '033: ...and so did the finished books');
  ok(!saved.logs['Smith, Aiden'] && !saved.finished['Smith, Aiden'],
    '033: nothing is left under the old name');
  ok(errors.length === 0, `033: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 001 Hall Pass Log — the log, the archive and the pre-approvals ───────── */
{
  const { page, errors } = await stage('001-hall-pass-log.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('hall-pass-log-sections', JSON.stringify({
        current: 'Block A',
        sets: {
          'Block A': {
            name: 'Block A',
            namesText: old.join('\n'),
            outNow: [],
            log: [{ id: 'p1', name: old[0], destLabel: 'Restroom', outStr: '9:02', outMs: 1, outHour: 9, inStr: '9:07', durationMin: 5, note: '' }],
            history: [{ date: 'Sep 1, 2026', dateMs: 1, rows: [{ name: old[0], destLabel: 'Nurse', outStr: '10:00', outMs: 1, outHour: 10, inStr: '10:20', durationMin: 20, note: '' }] }],
            approvalNames: [old[0]],
            rosterName: roster,
            idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
          },
        },
      }));
    },
  });
  await loadRoster(page, '#rosterSelect', '#loadRosterBtn');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('hall-pass-log-sections')).sets['Block A']);
  eq(saved.log[0].name, 'Aiden Smith', '001: today’s pass log followed the rename');
  eq(saved.history[0].rows[0].name, 'Aiden Smith', '001: the archived day followed it too');
  eq(saved.approvalNames, ['Aiden Smith'], '001: and so did the pre-approval');
  ok(errors.length === 0, `001: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 022 Lab Group Role Randomizer — the role-fairness memory ─────────────── */
{
  const { page, errors } = await stage('022-lab-group-role-randomizer.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('lgrr_rosters', JSON.stringify({
        'Block A': {
          name: 'Block A', students: old.join('\n'),
          roles: [{ name: 'Recorder', description: '' }], stations: [],
          mode: 'count', splitValue: 2, equipment: [],
          history: { [old[0]]: ['Recorder', 'Recorder'] },
          lastGroups: null, checkoutLog: [],
          keepApart: [[old[0], old[1]]], absent: [old[0]],
          rosterName: roster,
          idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
        },
      }));
      localStorage.setItem('lgrr_current', 'Block A');
    },
  });
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lgrr_rosters'))['Block A']);
  eq(saved.history['Aiden Smith'], ['Recorder', 'Recorder'], '022: the role history followed the rename');
  ok(!saved.history['Smith, Aiden'], '022: ...and is not left under the old name');
  eq(saved.absent, ['Aiden Smith'], '022: the absence mark followed it');
  eq(saved.keepApart[0], ['Aiden Smith', 'Grace Hopper'], '022: and so did the keep-apart pair');
  ok(errors.length === 0, `022: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 027 Novel Study Circles — role history, circles and past meetings ────── */
{
  const { page, errors } = await stage('027-novel-study-circles-manager.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('novel-study-circles', JSON.stringify({
        'Holes': {
          name: 'Holes', students: old.join('\n'), bookTitle: 'Holes',
          mode: 'count', splitValue: 2,
          groups: [{ id: 'g1', label: 'Group 1', members: [old[0], old[1]] }],
          roles: [{ name: 'Discussion Director', prompts: '' }],
          together: true,
          history: { [old[0]]: ['Discussion Director'] },
          meetings: [{ id: 'm1', date: '2026-09-01', together: true, vocab: [],
            groups: [{ id: 'g1', label: 'Group 1', checkpoint: '', assignment: [{ name: old[0], role: 'Discussion Director' }] }] }],
          schedule: null,
          rosterName: roster,
          idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
        },
      }));
      localStorage.setItem('novel-study-circles-current', 'Holes');
    },
  });
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('novel-study-circles'))['Holes']);
  eq(saved.history['Aiden Smith'], ['Discussion Director'], '027: the circle role history followed the rename');
  eq(saved.groups[0].members, ['Aiden Smith', 'Grace Hopper'], '027: the current circle followed it');
  eq(saved.meetings[0].groups[0].assignment[0].name, 'Aiden Smith', '027: and so did the recorded meeting');
  ok(errors.length === 0, `027: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 002 Group / Team Generator — the year-long pairing memory ────────────── */
{
  const { page, errors } = await stage('002-group-team-generator.html', {
    script: ({ ids, roster, old }) => {
      const key = old[0] < old[1] ? old[0] + '␟' + old[1] : old[1] + '␟' + old[0];
      localStorage.setItem('gtg:list', JSON.stringify(['Block A']));
      localStorage.setItem('gtg:current', 'Block A');
      localStorage.setItem('gtg:data:Block A', JSON.stringify({
        name: 'Block A', names: old.join('\n'), mode: 'count', splitValue: 2,
        balance: false, keepApart: [], keepTogether: [],
        strategy: 'coverage', oddMode: 'extra', namingMode: 'number', customNames: '',
        absentNames: [old[0]],
        pairHistory: { [key]: { gen: 3, count: 4 } }, pairGen: 3,
        rosterName: roster,
        idNames: { [ids[0]]: old[0], [ids[1]]: old[1] },
      }));
    },
  });
  await loadRoster(page, '#roster-select', '#load-roster-btn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gtg:data:Block A')));
  const wantKey = NEW[0] < NEW[1] ? NEW[0] + '␟' + NEW[1] : NEW[1] + '␟' + NEW[0];
  eq(Object.keys(saved.pairHistory), [wantKey], '002: the pair key was rebuilt under the new names');
  eq(saved.pairHistory[wantKey], { gen: 3, count: 4 },
    '002: ...carrying its generation and its count, so coverage still knows they have met');
  eq(saved.absentNames, ['Aiden Smith'], '002: the absence mark followed the rename');
  ok(errors.length === 0, `002: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── 068 Parent Contact Log — entries, and the only tool that needed a key ── */
{
  const { page, errors } = await stage('068-parent-contact-log.html', {
    script: ({ ids, roster, old }) => {
      localStorage.setItem('pcl_roster_v1', JSON.stringify(old.slice()));
      localStorage.setItem('pcl_entries_v1', JSON.stringify([
        { id: 'c1', student: old[0], date: '2026-09-01', method: 'phone', reason: 'positive', outcome: 'Great news', initials: 'DM' },
      ]));
      localStorage.setItem('pcl_idnames_v1', JSON.stringify({
        roster: roster, ids: { [ids[0]]: old[0], [ids[1]]: old[1] },
      }));
    },
  });
  /* 068 asks which roster through a prompt(), not a dropdown — the one tool the
     picker rollout left on that. Answer it, then press the button. */
  page.once('dialog', d => d.accept(ROSTER));
  await page.click('#loadNamePickerBtn');
  await settle(page, 300);
  const roster = await page.evaluate(() => JSON.parse(localStorage.getItem('pcl_roster_v1')));
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('pcl_entries_v1')));
  eq(roster, NEW, '068: the saved roster followed the rename');
  eq(entries[0].student, 'Aiden Smith', '068: the logged contact followed it');
  ok(errors.length === 0, `068: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── The two-visit journey, which is the one a teacher actually takes ─────── */
{
  /* Every fixture above hands the tool an id map it "wrote on its last visit".
     This one makes the tool write that map itself, because the seeding pass is
     where P4 can silently fail: a boot that computes the map and does not
     PERSIST it leaves the next rename invisible, and the tool looks fine the
     whole time. Visit one has the old names; the re-import happens; visit two
     has to follow it.  (Found exactly this way — every adopter used to save
     only when something moved.) */
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message)));
  await page.goto(BASE + '/Tools/013-lab-safety-contract-tracker.html', { waitUntil: 'networkidle' });

  // Visit one: old names, a signed contract, and no id map yet.
  await page.evaluate(([roster, old]) => {
    localStorage.clear();
    window.Roster.setRoster(roster, old);
    window.Roster.syncRecords(roster, old);
    localStorage.setItem('lsct_sections_v1', JSON.stringify({
      'Block A': {
        roster: old.slice(),
        contracts: { [old[0]]: { docs: { d1: true }, note: 'goggles signed' } },
        dueDate: '', documents: [{ id: 'd1', label: 'Safety contract' }],
        rosterName: roster,
      },
    }));
    localStorage.setItem('lsct_current_v1', 'Block A');
  }, [ROSTER, OLD]);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 350);

  const seeded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lsct_sections_v1'))['Block A'].idNames);
  ok(seeded && Object.keys(seeded).length === 2,
    'two visits: the first boot writes the id map to disk, not just to memory');

  // The re-import, then visit two.
  await page.evaluate(([roster, next]) => {
    window.Roster.setRoster(roster, next);
    window.Roster.syncRecords(roster, next);
  }, [ROSTER, NEW]);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 350);
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lsct_sections_v1'))['Block A']);
  ok(saved.contracts['Aiden Smith'] && saved.contracts['Aiden Smith'].note === 'goggles signed',
    'two visits: the contract followed the rename across a real pair of visits');
  ok(!saved.contracts['Smith, Aiden'], 'two visits: ...and nothing is left under the old name');
  ok(errors.length === 0, `two visits: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

/* ── The do-nothing path, which is the common one ─────────────────────────── */
{
  /* A teacher who has never opened Class Roster Hub has no sidecar at all.
     Every adopter calls followRenames on every load, so this path runs far more
     often than the rename does, and it must leave the tool exactly as it was. */
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message)));
  await page.goto(BASE + '/Tools/013-lab-safety-contract-tracker.html', { waitUntil: 'networkidle' });
  await page.evaluate(([roster, names]) => {
    localStorage.clear();
    localStorage.setItem('np_rosters', JSON.stringify({ [roster]: names }));
    localStorage.setItem('lsct_sections_v1', JSON.stringify({
      'Block A': {
        roster: names.slice(),
        contracts: { [names[0]]: { docs: {}, note: 'kept' } },
        dueDate: '', documents: [{ id: 'd1', label: 'Safety contract' }],
      },
    }));
    localStorage.setItem('lsct_current_v1', 'Block A');
  }, [ROSTER, OLD]);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 350);
  await loadRoster(page, '#rosterHubSelect', '#rosterHubLoadBtn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lsct_sections_v1'))['Block A']);
  ok(saved.contracts['Smith, Aiden'] && saved.contracts['Smith, Aiden'].note === 'kept',
    'no sidecar: the record stays exactly where it was');
  eq(saved.idNames, {}, 'no sidecar: the id map is written, and empty');
  ok(errors.length === 0, `no sidecar: no page errors (${errors.slice(0, 2).join(' | ')})`);
  await page.close();
}

await browser.close();
await server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAIL'); for (const f of fails) console.log('  - ' + f); process.exit(1); }
console.log('PASS');
