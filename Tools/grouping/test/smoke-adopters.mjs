// smoke-adopters.mjs — the pages that split a class through _shared/grouping.js
// (Path 13 P2), driven in a browser.
//
//   node Tools/grouping/test/smoke-adopters.mjs     (or: npm run test:grouping-adopters)
//
// parity.test.mjs holds the engine, with each tool's options, to a copy of that
// tool's old splitter. What a pure suite cannot see is whether the page really
// loads the engine and calls it with those options. So for each adopter this
// pins the engine's generator in the page (Grouping.pin(seed)), presses the
// tool's own button, reads the groups off the screen, and compares them with
// the old splitter (_legacy.mjs) fed the same seed's numbers in Node. Equal
// groups in equal order, for every seed, is "the port changed nothing".
//
// A new adopter gets an entry in ADOPTERS. Exits 1 on any failure. Every name
// here is invented.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';
import * as L from './_legacy.mjs';

const PORT = 8555;
const BASE = `http://127.0.0.1:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '..', '..', '..', '_shared/grouping.js'), 'utf8'), ctx);
const G = ctx.window.Grouping;

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const J = x => JSON.stringify(x);
// 022 and 027 since the storage step (v342, v343): the role memory is
// groupHistory, and the saved `history` map is exactly the one written from it.
const mirrored = got => !!got.groupHistory && Array.isArray(got.groupHistory.keys) &&
  J(G.history.toLegacyRoles(got.groupHistory)) === J(got.history);

const CLASS = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida B Wells',
  'Mae Jemison', 'Alan Turing', 'Rosa Parks', 'Carl Sagan', 'Mary Seacole', 'Nikola Tesla', 'Katherine Johnson'];
const SEEDS = [1, 7, 42, 20261025, 3735928559];

/* Each adopter: the page, how to load a class, anything to open first, how to
   ask for one case (a count, or [by, n]) and press the button, how to read the
   groups back, and the old splitter for the same case (or, where there is more
   than groups to compare, a compare() that runs the old code itself). */
const ADOPTERS = [
  {
    tool: '007',
    url: '/Tools/007-Name%20Picker.html',
    async load(page, names) {
      await page.evaluate(r => localStorage.setItem('np_current', JSON.stringify(r)), names);
    },
    async split(page, k, seed) {
      return page.evaluate(([k, seed]) => {
        document.getElementById('groupCount').value = String(k);
        window.Grouping.pin(seed);
        document.getElementById('makeGroups').click();
        window.Grouping.pin(null);
        return Array.from(document.querySelectorAll('#groupsResult .group-card-names'))
          .map(el => el.textContent === '' ? [] : el.textContent.split(', '));
      }, [k, seed]);
    },
    cases: [2, 3, 4, 5, 12],
    legacy: (names, k, rng) => L.np007(names, k, rng)
  },
  {
    tool: '087',
    url: '/Tools/087-class-screen.html',
    async load(page, names) {
      await page.evaluate(r => { localStorage.clear(); localStorage.setItem('np_rosters', JSON.stringify({ 'Period 2': r })); }, names);
    },
    async ready(page) {
      await page.click('#dock button[data-add="groups"]');
      await settle(page, 150);
    },
    async split(page, [by, n], seed) {
      const gm = page.locator('#board .w[data-type="groups"]');
      await gm.getByLabel('Group by').selectOption(by);
      await gm.getByLabel('How many').selectOption(String(n));
      await page.evaluate(seed => window.Grouping.pin(seed), seed);
      await gm.getByRole('button', { name: 'Make groups' }).click();
      await page.evaluate(() => window.Grouping.pin(null));
      return gm.locator('.group').evaluateAll(gs => gs.map(g => Array.from(g.querySelectorAll('li'), li => li.textContent)));
    },
    cases: [['size', 2], ['size', 3], ['size', 4], ['size', 5], ['size', 12], ['count', 2], ['count', 4], ['count', 12]],
    legacy: (names, [by, n], rng) => L.cs087(names, by, n, rng)
  },
  {
    tool: '021',
    url: '/Tools/021-pe-tournament-stations.html',
    // a pasted roster is not de-duplicated: two students of one name stay two
    names: CLASS.concat(['Ada Lovelace']),
    async load() {},
    async split(page, k, seed) {
      return page.evaluate(([k, seed, names]) => {
        window.confirm = () => true;
        const ta = document.getElementById('rosterText');
        ta.value = names.join('\n');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('splitCount').value = String(k);
        window.Grouping.pin(seed);
        document.getElementById('splitBtn').click();
        window.Grouping.pin(null);
        const store = JSON.parse(localStorage.getItem('pe-tournament-stations'));
        return store.projects[store.current].groups.map(g => g.members === '' ? [] : g.members.split(', '));
      }, [k, seed, this.names]);
    },
    cases: [1, 2, 4, 5, 13, 20],
    legacy: (names, k, rng) => L.pe021(names, String(k), rng)
  },
  {
    // a split, then three meetings' roles, and the role memory they leave
    tool: '027',
    url: '/Tools/027-novel-study-circles-manager.html',
    names: CLASS.concat(['Ada Lovelace']),
    async load() {},
    async split(page, [mode, v], seed) {
      return page.evaluate(([mode, v, seed, names]) => {
        const cur = () => JSON.parse(localStorage.getItem('novel-study-circles'))[localStorage.getItem('novel-study-circles-current')];
        const ta = document.getElementById('namesInput');
        ta.value = names.join('\n');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const radio = document.getElementById(mode === 'size' ? 'mode-size' : 'mode-count');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        const sv = document.getElementById('splitValue');
        sv.value = String(v);
        sv.dispatchEvent(new Event('input', { bubbles: true }));
        const before = cur().history || {};
        window.Grouping.pin(seed);
        document.getElementById('splitBtn').click();
        for (let m = 0; m < 3; m++) document.getElementById('logMeetingBtn').click();
        window.Grouping.pin(null);
        const st = cur();
        return {
          before, roles: st.roles.map(r => r.name.trim()).filter(Boolean),
          groups: st.groups.map(g => g.members),
          meetings: st.meetings.slice(0, 3).reverse().map(mt => mt.groups.map(g => g.assignment)),
          history: st.history, groupHistory: st.groupHistory
        };
      }, [mode, v, seed, this.names]);
    },
    compare(got, names, [mode, v], rng) {
      const groups = L.nsc027(names, { mode, splitValue: String(v) }, rng);
      const legacyState = { history: JSON.parse(JSON.stringify(got.before)) };
      const meetings = [];
      for (let m = 0; m < 3; m++) {
        const picker = L.rolePicker(legacyState, rng);
        meetings.push(groups.map(g => {
          const asg = picker.assignRolesForGroup(g, got.roles);
          g.forEach(nm => picker.recordHistory(nm, asg[nm]));
          return g.map(nm => ({ name: nm, role: asg[nm] }));
        }));
      }
      const mirror = mirrored(got);
      return [mirror && got.meetings.length === 3 && Object.keys(got.history).length > 0 && J(got.groups) === J(groups) && J(got.meetings) === J(meetings) && J(got.history) === J(legacyState.history),
        `mirror ${mirror}; groups ${J(got.groups)} vs ${J(groups)}; meetings ${J(got.meetings)} vs ${J(meetings)}`];
    },
    cases: [['count', 3], ['count', 5], ['size', 4], ['size', 3], ['count', 20]]
  },
  {
    // three presses of Shuffle (groups and roles each time), and the memory;
    // the last case adds keep-apart pairs, which stay for the rest of the page.
    // No pair names the repeated student: with two of one name, the page's
    // warning (findApartViolations, by name) and the engine (by position) can
    // disagree about which of the two a pair means, as the old page's repair
    // and warning already could.
    tool: '022',
    url: '/Tools/022-lab-group-role-randomizer.html',
    names: CLASS.concat(['Ada Lovelace']),
    async load() {},
    async split(page, [mode, v, pairs], seed) {
      return page.evaluate(([mode, v, pairs, seed, names]) => {
        const cur = () => JSON.parse(localStorage.getItem('lgrr_rosters'))[localStorage.getItem('lgrr_current')];
        const ta = document.getElementById('namesInput');
        ta.value = names.join('\n');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        const radio = document.getElementById(mode === 'size' ? 'mode-size' : 'mode-count');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        const sv = document.getElementById('splitValue');
        sv.value = String(v);
        sv.dispatchEvent(new Event('input', { bubbles: true }));
        pairs.forEach(([a, b]) => {
          document.getElementById('pairA').value = names[a];
          document.getElementById('pairB').value = names[b];
          document.getElementById('addPairBtn').click();
        });
        const before = cur().history || {};
        const out = [];
        window.Grouping.pin(seed);
        for (let m = 0; m < 3; m++) {
          document.getElementById('shuffleBtn').click();
          out.push(cur().lastGroups.map(g => g.members));
        }
        window.Grouping.pin(null);
        const st = cur();
        return { before, roles: st.roles.map(r => (r.name || '').trim()).filter(Boolean), keepApart: st.keepApart,
          presses: out, history: st.history, groupHistory: st.groupHistory, warn: document.getElementById('warnArea').textContent };
      }, [mode, v, pairs, seed, this.names]);
    },
    compare(got, names, [mode, v, pairs], rng) {
      const legacyState = { history: JSON.parse(JSON.stringify(got.before)) };
      const presses = [];
      let apartBroken = 0;
      for (let m = 0; m < 3; m++) {
        let groups;
        if (!pairs.length) groups = L.lab022(names, { mode, splitValue: String(v), keepApart: [] }, rng).groups;
        else { // the page's own construction of the engine call, run here on the same numbers
          const apart = pairs.map(([a, b]) => [String(a), String(b)]);
          const k = Math.max(1, Math.min(mode === 'size' ? Math.ceil(names.length / v) : v, names.length));
          const res = G.formGroups(names.map((n, i) => ({ key: String(i), name: n })), { count: k, apart, rng });
          apartBroken += res.violations.apart.length;
          groups = res.groups.map(g => g.map(key => names[+key]));
        }
        const picker = L.rolePicker(legacyState, rng);
        presses.push(groups.map(g => {
          const asg = picker.assignRolesForGroup(g, got.roles);
          g.forEach(nm => picker.recordHistory(nm, asg[nm]));
          return g.map(nm => ({ name: nm, role: asg[nm] }));
        }));
      }
      const pairsOk = !pairs.length || (got.keepApart.length === pairs.length && apartBroken === 0 && !/keep-apart/.test(got.warn));
      const mirror = mirrored(got);
      return [mirror && pairsOk && Object.keys(got.history).length > 0 && J(got.presses) === J(presses) && J(got.history) === J(legacyState.history),
        `mirror ${mirror}; pairs ok ${pairsOk} (${got.keepApart.length} stored, ${apartBroken} broken, warn ${J(got.warn)}); same presses ${J(got.presses) === J(presses)}; presses ${J(got.presses)} vs ${J(presses)}`];
    },
    cases: [['count', 3, []], ['count', 5, []], ['size', 4, []], ['size', 3, []], ['count', 20, []],
      ['count', 4, [[1, 2], [3, 4], [5, 6], [1, 7]]]]
  },
  {
    // 002 draws from Math.random, which its own golden suite seeds, so here the
    // page's Math.random is the seeded generator for three presses: Make
    // Groups, Reshuffle, and Reshuffle with group 1 locked. Compared with the
    // old makeGroups() on the same numbers: the groups, the floaters, and the
    // pairing memory the page saves (pairHistory/pairGen, and groupHistory,
    // which they are written from). Long memory and roles are gtg-memory.js's
    // and stay off here (smoke-year-memory.mjs holds them). No repeated name:
    // that is the named exception (the old page counted one pair for both).
    // A case ending in true has the class in Class Roster Hub, so since v344
    // every student is keyed by roster id: keys never move a draw.
    tool: '002',
    url: '/Tools/002-group-team-generator.html',
    async load(page) { await page.evaluate(() => localStorage.clear()); },
    async split(page, c, seed) {
      const [strategy, odd, mode, v, apart, together, absent, ids] = c;
      await page.evaluate(() => localStorage.clear());
      if (ids) await page.evaluate(names => { window.Roster.setRoster('Ids', names); window.Roster.syncRecords('Ids', names); }, CLASS);
      await page.reload({ waitUntil: 'networkidle' });
      await settle(page, 200);
      const skills = strategy !== 'random' && strategy !== 'coverage';
      const lines = CLASS.map((n, i) => skills ? n + ', ' + (1 + ((i * 3) % 5)) : n);
      await page.fill('#names-input', lines.join('\n'));
      await page.dispatchEvent('#names-input', 'input');
      await page.click(mode === 'size' ? 'label[for="mode-size"]' : 'label[for="mode-count"]');
      await page.fill('#split-value', String(v));
      await page.selectOption('#strategy-select', strategy);
      await page.selectOption('#odd-mode-select', odd);
      for (const [a, b] of apart) { await page.selectOption('#pair-a', CLASS[a]); await page.selectOption('#pair-b', CLASS[b]); await page.click('#add-pair-btn'); }
      for (const [a, b] of together) { await page.selectOption('#together-a', CLASS[a]); await page.selectOption('#together-b', CLASS[b]); await page.click('#add-together-btn'); }
      for (const i of absent) await page.locator('#absent-list label').nth(i).click();
      await page.evaluate(seed => { window.__rnd = Math.random; Math.random = window.Grouping.rng(seed); }, seed);
      const grab = () => page.evaluate(() => {
        const fl = document.querySelector('#results .floater-box');
        return { groups: [...document.querySelectorAll('#results .group-card')].map(c => [...c.querySelectorAll('li > span:first-child')].map(x => x.textContent)),
          floaters: fl ? fl.textContent : '' };
      });
      const presses = [];
      await page.click('#generate-btn'); presses.push(await grab());
      await page.click('#regenerate-btn'); presses.push(await grab());
      await page.click('[data-lock="0"]'); await page.click('#regenerate-btn'); presses.push(await grab());
      await page.evaluate(() => { Math.random = window.__rnd; });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gtg:data:' + localStorage.getItem('gtg:current'))));
      return { presses, saved, mirror: await page.evaluate(h => Grouping.history.toLegacyPairs(h), saved.groupHistory) };
    },
    compare(got, names, [strategy, odd, mode, v, apart, together, absent, ids], rng) {
      const skills = strategy !== 'random' && strategy !== 'coverage';
      const students = CLASS.map((n, i) => ({ name: n, skill: skills ? 1 + ((i * 3) % 5) : null }));
      const absentSet = {}; absent.forEach(i => { absentSet[CLASS[i]] = true; });
      const state = { pairHistory: {}, pairGen: 0 };
      const ctx = { students, absent: absentSet, mode, splitValue: String(v), strategy, oddMode: odd,
        keepApart: apart.map(([a, b]) => [CLASS[a], CLASS[b]]), keepTogether: together.map(([a, b]) => [CLASS[a], CLASS[b]]), lastGroups: null, state };
      const want = [];
      for (let p = 0; p < 3; p++) {
        const lockedFlags = p === 2 ? ctx.lastGroups.groups.map((_, i) => i === 0) : null;
        const r = L.gtg002(ctx, { lockedFlags }, rng);
        ctx.lastGroups = { groups: r.groups };
        want.push({ groups: r.groups.map(g => g.map(st => st.name)), floaters: r.floaters.map(st => st.name) });
      }
      const gotShape = got.presses.map(x => ({ groups: x.groups, floaters: x.floaters }));
      const sameGroups = got.presses.every((x, i) => J(x.groups) === J(want[i].groups) &&
        want[i].floaters.every(n => x.floaters.includes(n)) && (want[i].floaters.length > 0) === (x.floaters !== ''));
      const sorted = o => J(Object.keys(o).sort().map(k => [k, o[k]]));
      const sameMemory = got.saved.pairGen === 3 && sorted(got.saved.pairHistory) === sorted(state.pairHistory) &&
        J(got.mirror) === J({ pairHistory: got.saved.pairHistory, pairGen: got.saved.pairGen });
      const keys = got.saved.groupHistory ? got.saved.groupHistory.keys : [];
      const keyed = keys.length === CLASS.length && keys.every(k => k.indexOf(ids ? 'i:' : 'n:') === 0);
      return [sameGroups && sameMemory && keyed, `groups ${sameGroups}, memory ${sameMemory}, keys ${keyed} ${J(keys.slice(0, 2))}; ${J(gotShape)} vs ${J(want)}`];
    },
    cases: [
      ['random', 'extra', 'count', 3, [], [], []],
      ['balanced', 'floater', 'size', 4, [], [], [2]],
      ['heterogeneous', 'extra', 'count', 4, [[0, 1], [2, 3]], [[4, 5]], []],
      ['homogeneous', 'floater', 'count', 5, [], [], []],
      ['coverage', 'pair', 'size', 3, [[6, 7]], [], [9]],
      ['heterogeneous', 'extra', 'count', 4, [[0, 1], [2, 3]], [[4, 5]], [], true],
      ['coverage', 'pair', 'size', 3, [[6, 7]], [], [9], true]
    ]
  }
];

const server = await serve(PORT);
const browser = await launch();
try {
  for (const a of ADOPTERS) {
    console.log(`${a.tool} — the page's groups are the old splitter's`);
    const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + a.url, { waitUntil: 'networkidle' });
    const names = a.names || CLASS;
    await a.load(page, names);
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page, 400);
    ok(await page.evaluate(() => typeof window.Grouping === 'object' && typeof window.Grouping.formGroups === 'function'),
      `${a.tool}: the page loads _shared/grouping.js`);
    if (a.ready) await a.ready(page);
    for (const c of a.cases) {
      for (const seed of SEEDS) {
        const got = await a.split(page, c, seed);
        if (a.compare) {
          const [same, detail] = a.compare(got, names.slice(), c, G.rng(seed));
          ok(same, `${a.tool}: ${J(c)}, seed ${seed} (${detail})`);
          continue;
        }
        const want = a.legacy(names.slice(), c, G.rng(seed));
        ok(J(got) === J(want), `${a.tool}: ${J(c)}, seed ${seed} (got ${J(got)}, want ${J(want)})`);
      }
    }
    ok(errors.length === 0, `${a.tool}: no page errors (${errors.join(' | ')})`);
    await page.close();
  }

  /* ── The storage step (022 v342, 027 v343): saves and files of the old shape ──
     Each record below is in a format the pages wrote before groupHistory: the
     old map only (every save before v342/v343), and a groupHistory the map
     disagrees with, as when an older cached page has shuffled, reset or
     renamed since (it writes the map; a restore can put the two side by side).
     The page must hand out roles exactly as the old picker would from
     the old map, with the old map's contents, and save the map it writes from
     the memory. `before` in each adopter's split() is the map as saved, which
     is what the old picker is fed. */
  const OLD = { 'Ada Lovelace': ['Recorder', 'Recorder'], 'Marco Polo': ['Materials Manager'],
    'Zheng He': ['Safety Officer', 'Recorder'], 'Left In June': ['Recorder'] };
  const STALE = { v: 1, gen: 4, keys: ['n:Ada Lovelace', 'n:Rosa Parks', 'n:Marco Polo'],
    names: ['Ada Lovelace', 'Rosa Parks', 'Marco Polo'], seen: [4, 4, 3], pairs: {},
    roles: { 0: ['Recorder'], 1: ['Recorder', 'Recorder'], 2: ['Materials Manager'] } };
  const stores = {
    '022': (rec) => ({ lgrr_rosters: { 'Period 2': Object.assign({ name: 'Period 2', students: '', mode: 'count', splitValue: 3 }, rec) }, lgrr_current: 'Period 2' }),
    '027': (rec) => ({ 'novel-study-circles': { 'Hatchet': Object.assign({ name: 'Hatchet', students: '', groups: [], roles: [], meetings: [] }, rec) }, 'novel-study-circles-current': 'Hatchet' })
  };
  const fileOf = {
    '022': { input: '#importRosterFile', rec: (h) => ({ name: 'Old file', students: '', mode: 'count', splitValue: 3, history: h }) },
    '027': { input: '#importProjectFile', rec: (h) => ({ name: 'Old file', students: '', groups: [], roles: [], meetings: [], history: h }) }
  };
  const exportOf = { '022': '#exportRosterBtn', '027': '#exportProjectBtn' };
  for (const a of ADOPTERS.filter(x => stores[x.tool])) {
    console.log(`${a.tool} — an old save, a disagreeing older page and an old file hand out roles as before`);
    const fixtures = [
      ['a save from before groupHistory', { history: OLD }, OLD],
      ['a groupHistory an older page has since overtaken', { history: OLD, groupHistory: STALE }, OLD],
      ['a groupHistory whose map an older page reset', { history: {}, groupHistory: STALE }, {}]
    ];
    for (const [what, rec, want] of fixtures) {
      const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + a.url, { waitUntil: 'networkidle' });
      await page.evaluate(st => { localStorage.clear(); Object.keys(st).forEach(k => localStorage.setItem(k, typeof st[k] === 'string' ? st[k] : JSON.stringify(st[k]))); }, stores[a.tool](rec));
      await page.reload({ waitUntil: 'networkidle' });
      await settle(page, 300);
      const c = a.cases[0], seed = SEEDS[2];
      const got = await a.split(page, c, seed);
      ok(J(got.before) === J(want), `${a.tool}: ${what}: the page reads the old map as it was (${J(got.before)})`);
      const [same, detail] = a.compare(got, a.names.slice(), c, G.rng(seed));
      ok(same, `${a.tool}: ${what}: roles as the old picker hands them out from the old map (${detail})`);
      ok(!Object.prototype.hasOwnProperty.call(got.history, 'Left In June') === !Object.prototype.hasOwnProperty.call(want, 'Left In June'),
        `${a.tool}: ${what}: a student no longer on the list keeps the list the old map had for them`);
      ok(errors.length === 0, `${a.tool}: ${what}: no page errors (${errors.join(' | ')})`);
      await page.close();
    }
    // A file written before the field: imported, it is the old map; exported
    // again, it carries groupHistory and the map written from it.
    const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + a.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page, 300);
    await page.setInputFiles(fileOf[a.tool].input, { name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileOf[a.tool].rec(OLD))) });
    await settle(page, 400);
    const got = await a.split(page, a.cases[0], SEEDS[3]);
    ok(J(got.before) === J(OLD), `${a.tool}: an old file's map arrives as it was (${J(got.before)})`);
    const [same, detail] = a.compare(got, a.names.slice(), a.cases[0], G.rng(SEEDS[3]));
    ok(same, `${a.tool}: an old file's roles are handed out as the old picker would (${detail})`);
    const out = JSON.parse(await downloadText(page, exportOf[a.tool], { what: a.tool + ' export' }));
    ok(mirrored(out) && J(out.history) === J(got.history), `${a.tool}: the exported file carries groupHistory and the map written from it`);
    // ...and that file, read back, is the same memory.
    await page.setInputFiles(fileOf[a.tool].input, { name: 'new.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(out)) });
    await settle(page, 400);
    const back = await page.evaluate(() => {
      const k = document.getElementById('importRosterFile') ? ['lgrr_rosters', 'lgrr_current'] : ['novel-study-circles', 'novel-study-circles-current'];
      return JSON.parse(localStorage.getItem(k[0]))[localStorage.getItem(k[1])];
    });
    ok(J(back.groupHistory) === J(out.groupHistory) && J(back.history) === J(out.history), `${a.tool}: a new file reads back as the same memory`);
    ok(errors.length === 0, `${a.tool}: files: no page errors (${errors.join(' | ')})`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\ngrouping adopters: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
