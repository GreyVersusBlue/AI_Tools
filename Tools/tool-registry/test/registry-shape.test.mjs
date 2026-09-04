// registry-shape.test.mjs — _shared/tool-registry.js's data and its lookup
// helpers, under plain Node.
//
// check-registry.mjs already proves the registry matches the TREE (every key
// the code writes is declared, nothing declared is dead). This proves the other
// half: that the data is internally coherent and the helpers 009 and 010 now
// depend on actually answer correctly. The two are deliberately separate — a
// guard that walks the source and a suite that drives the module fail for
// different reasons, and the day one of them is wrong it is the disagreement
// that says so.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ctx = vm.createContext({});
vm.runInContext('var window = this;', ctx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'tool-registry.js'), 'utf8'), ctx,
  { filename: '_shared/tool-registry.js' });
const REG = ctx.ToolRegistry;

console.log('Tool registry — shape and lookups (Path 4 P2)');

/* ── 1. Every row is complete and points at a file that exists ────────── */
{
  ok(Array.isArray(REG.tools) && REG.tools.length >= 86,
    `1: the registry has a row per tool (${REG.tools && REG.tools.length})`);

  const bad = [];
  for (const t of REG.tools) {
    for (const f of ['slug', 'title', 'file', 'category']) {
      if (typeof t[f] !== 'string' || !t[f]) bad.push(`${t.slug || '?'}.${f}`);
    }
    if (t.file && !fs.existsSync(path.join(SITE, decodeURIComponent(t.file)))) {
      bad.push(`${t.slug}: ${t.file} not on disk`);
    }
  }
  eq(bad, [], '1: every row has slug/title/file/category and a real file');

  const numbered = fs.readdirSync(path.join(SITE, 'Tools'))
    .filter(n => /^\d{3}-.*\.html$/.test(n)).length;
  const rowsForNumbered = REG.tools.filter(t => /^Tools\/\d{3}-/.test(decodeURIComponent(t.file))).length;
  eq(rowsForNumbered, numbered, '1: one row per numbered tool page');
}

/* ── 2. Slugs and ownership are unique ───────────────────────────────── */
{
  const slugs = REG.tools.map(t => t.slug);
  eq(slugs.length, new Set(slugs).size, '2: no two rows share a slug');

  const owner = new Map();
  const dup = [];
  for (const t of REG.tools) {
    for (const k of t.keys || []) {
      if (owner.has('k:' + k.k)) dup.push(`${k.k} (${owner.get('k:' + k.k)} / ${t.slug})`);
      owner.set('k:' + k.k, t.slug);
    }
    for (const p of t.prefixes || []) {
      if (owner.has('p:' + p.p)) dup.push(`${p.p}* (${owner.get('p:' + p.p)} / ${t.slug})`);
      owner.set('p:' + p.p, t.slug);
    }
  }
  eq(dup, [], '2: no key or prefix is owned twice');
}

/* ── 3. A cross-tool write names a key somebody owns ─────────────────── */
{
  const ownedKeys = new Set(REG.tools.flatMap(t => (t.keys || []).map(k => k.k)));
  const ownedPrefixes = new Set(REG.tools.flatMap(t => (t.prefixes || []).map(p => p.p)));
  const orphans = [];
  for (const t of REG.tools) {
    for (const w of t.writes || []) {
      if (!ownedKeys.has(w) && !ownedPrefixes.has(w)) orphans.push(`${t.slug} -> ${w}`);
    }
  }
  eq(orphans, [], '3: every "writes" entry names an owned key or prefix');

  // the one that motivated the field
  const cc = REG.bySlug('command-center-dashboard');
  ok(cc && (cc.writes || []).includes('hall-pass-log-sections'),
    '3: 010 declares that it writes 001’s key');
  eq(REG.labelFor('hall-pass-log-sections'), 'Digital Hall Pass / Sign-Out Log',
    '3: ...and the key still groups under 001, the tool that owns it');
}

/* ── 4. lookupKey resolves exactly, then by the LONGEST prefix ───────── */
{
  eq(REG.labelFor('np_rosters'), 'Name Picker', '4: an exact key');
  eq(REG.classifyKey('np_rosters'), 'student', '4: ...classified per key');
  eq(REG.classifyKey('np_theme'), 'settings', '4: ...and its sibling is not student data');

  eq(REG.labelFor('gtg:data:Period 3'), 'Group / Team Generator', '4: a prefixed key resolves');
  eq(REG.classifyKey('gtg:data:Period 3'), 'student', '4: ...and carries the prefix’s classification');

  /* An exact key must beat any prefix that would also match it, or a tool with
     both loses its own key to a neighbour. Asserted over the whole registry
     rather than one example, because the ordering is what makes it true. */
  const misrouted = [];
  for (const t of REG.tools) {
    for (const k of t.keys || []) {
      const hit = REG.lookupKey(k.k);
      if (!hit || hit.tool.slug !== t.slug) misrouted.push(`${k.k} -> ${hit ? hit.tool.slug : 'nothing'} (owner ${t.slug})`);
    }
  }
  eq(misrouted, [], '4: every declared key resolves to its own owner');

  /* 009 classified gvb-command-center:excluded: as STUDENT data for as long as
     that list existed. It never could have matched anything: 010 keeps that in
     sessionStorage, which dies with the tab and no backup ever sees. There is
     deliberately no student-data rule for it here — asserted so nobody "fixes"
     it back in. It still resolves for labelling, through 010's own legacy
     prefix, which is what a leftover key deserves. */
  const excluded = REG.lookupKey('gvb-command-center:excluded:2026-09-04:Period 3');
  ok(excluded && excluded.tool.slug === 'command-center-dashboard',
    '4: a leftover excluded: key can still be named');
  eq(REG.classifyKey('gvb-command-center:excluded:2026-09-04:Period 3'), 'settings',
    '4: ...but is not student data — that rule was always dead');

  eq(REG.labelFor('nothing-writes-this'), null, '4: an unknown key has no owner');
  eq(REG.classifyKey('nothing-writes-this'), 'settings',
    '4: ...and is settings, so the year-end clear never touches it');
}

/* ── 4b. `legacy` names old data without widening what the guard accepts ─ */
{
  const legacyPrefixes = REG.tools.flatMap(t => (t.prefixes || []).filter(p => p.legacy).map(p => p.p));
  ok(legacyPrefixes.length >= 20,
    `4b: the old broad prefixes are kept for labelling (${legacyPrefixes.length})`);

  /* The whole point of narrowing: a key that only an old broad prefix would
     match must still be nameable, while check-registry.mjs (which ignores
     legacy entries) would refuse to call it covered. If these ever became the
     same set, a new key could be added to any of 20-odd tools and no guard
     would notice. */
  eq(REG.labelFor('gvb-review-board:somethingOldAndForgotten'), 'Quiz / Review Game Board',
    '4b: a leftover key under an old broad prefix is still named');
  const live = REG.tools.flatMap(t => (t.prefixes || []).filter(p => !p.legacy).map(p => p.p));
  ok(!live.some(p => 'gvb-review-board:somethingOldAndForgotten'.startsWith(p)),
    '4b: ...but no live prefix covers it, so a new key there still trips the guard');
}

/* ── 5. Write probes are marked, so a backup cannot capture one ──────── */
{
  const transient = REG.tools.flatMap(t => (t.keys || []).filter(k => k.transient).map(k => k.k));
  ok(transient.length >= 3, '5: the write probes are declared: ' + JSON.stringify(transient));
  ok(transient.every(k => /^__.+__$/.test(k)), '5: ...and every one of them looks like a probe');
  ok(REG.isTransient(transient[0]) && !REG.isTransient('np_rosters'),
    '5: isTransient tells them apart');
}

/* ── 6. Every IndexedDB database on the site is declared ─────────────── */
{
  const dbs = REG.databases().map(d => d.name).sort();
  eq(dbs, ['bmg-maps', 'rgb-audio', 'stviz-recovery'],
    '6: all three databases, not just the one 009 used to know');
  ok(REG.databases().every(d => d.tool && d.tool.title), '6: each names its tool');
}

/* ── 7. href() is what 010 replaced five hardcoded filenames with ────── */
{
  eq(REG.href('classroom-timer'), '004-Classroom%20Timer.html',
    '7: the space is encoded — 010 had this one link unencoded');
  eq(REG.href('hall-pass-log'), '001-hall-pass-log.html', '7: and a plain name is unchanged');
  for (const slug of ['school-calendar-visualizer', 'class-roster-hub', 'seating-chart']) {
    ok(fs.existsSync(path.join(SITE, 'Tools', decodeURIComponent(REG.href(slug)))),
      `7: ${slug} resolves to a file that exists`);
  }
  let threw = false;
  try { REG.href('no-such-tool'); } catch (e) { threw = true; }
  ok(threw, '7: an unknown slug throws instead of returning a dead href');
}

/* ── 8. The categories are the ones index.html actually uses ─────────── */
{
  const idx = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const inIndex = new Set([...idx.matchAll(/<details[^>]*data-cat="([^"]+)"/g)].map(m => m[1]));
  const unknown = [...new Set(REG.tools.map(t => t.category))].filter(c => !inIndex.has(c));
  eq(unknown, [], '8: no row invents a category the landing page does not have');
}

/* ── 9. The migration changed nothing a teacher can see ──────────────── */
{
  /* 009's STUDENT_KEYS and STUDENT_PREFIXES exactly as they stood before the
     registry replaced them (commit bcf8447). This is the whole reason to trust
     the swap: the year-end rollover deletes what classifyKey() calls student
     data, so a single difference here is somebody's roster either surviving a
     clear it should not have, or being deleted when it should not have been. */
  const OLD_STUDENT_KEYS = [
    'np_rosters', 'np_current', 'np_lucky', 'np_stats', 'np_history', 'np_hof', 'np_absent',
    'crh_students_v1', 'crh_archived_students', 'crh_archive_v1',
    'seating-chart-v1', 'behavior-points-tracker-sections', 'hall-pass-log-sections',
    'sslt_sections_v1', 'sslt_current_v1', 'lsct_sections_v1', 'lsct_current_v1',
    'lgrr_rosters', 'lgrr_current', 'gallery-walk-qr-sets',
    'novel-study-circles', 'novel-study-circles-current', 'pe-tournament-stations',
    'gtg-settings',
    'apl_portfolio_v1', 'fsat_tracker_v1', 'pcl_roster_v1', 'pcl_entries_v1',
    'sfpt_tracker_v1', 'tacg_cards_v1',
  ];
  const OLD_STUDENT_PREFIXES = [
    'gtg:', 'gvb-bracket:', 'gvb-grade-distribution:', 'gvb-command-center:excluded:',
    'gvb-exit-ticket:tally',
  ];
  const oldClassify = (k) =>
    (OLD_STUDENT_KEYS.includes(k) || OLD_STUDENT_PREFIXES.some(p => k.startsWith(p)))
      ? 'student' : 'settings';

  const probes = new Set([
    ...OLD_STUDENT_KEYS,
    ...REG.tools.flatMap(t => (t.keys || []).map(k => k.k)),
    ...OLD_STUDENT_PREFIXES.map(p => p + 'SAMPLE'),
    ...REG.tools.flatMap(t => (t.prefixes || []).map(p => p.p + 'SAMPLE')),
  ]);
  const changed = [...probes].filter(k => oldClassify(k) !== REG.classifyKey(k));

  /* The one permitted difference, and it is a fix rather than a regression:
     gvb-command-center:excluded: lives in sessionStorage, so no backup has ever
     contained it and the old rule could never fire. */
  eq(changed, ['gvb-command-center:excluded:SAMPLE'],
    '9: the registry classifies every key exactly as 009 did, except the one dead rule');

  const OLD_LABELLED = ['np_rosters', 'seating-chart-v1', 'scv_calendar_v1', 'ct_prefs',
    'gvb-review-board:current', 'gvb-timeline:current', 'escape-room-builder:rooms',
    'crh_students_v1', 'br_home_teacher', 'pe-tournament-stations'];
  const unnamed = OLD_LABELLED.filter(k => REG.labelFor(k) === null);
  eq(unnamed, [], '9: every key 009 used to name is still named');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
