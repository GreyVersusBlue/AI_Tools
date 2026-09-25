// core.test.mjs — pure-logic tests for Tools/class-screen/cs-core.js.
//
//   node Tools/class-screen/test/core.test.mjs
//
// cs-core.js is a classic script that publishes window.ClassScreenCore, so it
// runs here in a vm context with a stand-in `window`. No browser. Exits 1 on
// any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'cs-core.js'), 'utf8');
const ctx = { window: {}, URL };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const C = ctx.window.ClassScreenCore;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Class Screen — core logic');

// ── YouTube links ────────────────────────────────────────────────────
const ID = 'dQw4w9WgXcQ';
eq(C.parseYouTube(`https://www.youtube.com/watch?v=${ID}`), { id: ID, list: '', start: 0 }, 'watch link');
eq(C.parseYouTube(`https://youtu.be/${ID}?t=90`), { id: ID, list: '', start: 90 }, 'youtu.be with t=90');
eq(C.parseYouTube(`youtu.be/${ID}?t=1m30s`), { id: ID, list: '', start: 90 }, 'no scheme, t=1m30s');
eq(C.parseYouTube(`https://m.youtube.com/watch?v=${ID}&t=2h`), { id: ID, list: '', start: 7200 }, 'mobile host, hours');
eq(C.parseYouTube(`https://www.youtube.com/shorts/${ID}`).id, ID, 'shorts link');
eq(C.parseYouTube(`https://www.youtube.com/live/${ID}`).id, ID, 'live link');
eq(C.parseYouTube(`https://www.youtube-nocookie.com/embed/${ID}?start=5`), { id: ID, list: '', start: 5 }, 'embed link with start');
eq(C.parseYouTube(ID), { id: ID, list: '', start: 0 }, 'bare id');
eq(C.parseYouTube('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'),
   { id: '', list: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', start: 0 }, 'playlist link');
eq(C.parseYouTube(`https://www.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`).list,
   'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', 'video inside a playlist keeps the list');

for (const bad of [
  '', '   ', 'hello', 'https://vimeo.com/123456', `https://evil.example/watch?v=${ID}`,
  `https://youtube.com.evil.example/watch?v=${ID}`, 'javascript:alert(1)', `https://www.youtube.com/watch?v=short`,
  'https://www.youtube.com/@somechannel', `https://www.youtube.com/watch?v=${ID}"><script>`,
  `ftp://youtube.com/watch?v=${ID}`, null, 42,
]) ok(C.parseYouTube(bad) === null, `rejects ${JSON.stringify(bad)}`);

eq(C.embedUrl(C.parseYouTube(`https://youtu.be/${ID}?t=90`)),
   `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&start=90`, 'embed url for a video');
eq(C.embedUrl(C.parseYouTube('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')),
   'https://www.youtube-nocookie.com/embed/videoseries?rel=0&modestbranding=1&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG',
   'embed url for a playlist');
eq(C.embedUrl(null), '', 'embed url for nothing');

// ── durations ────────────────────────────────────────────────────────
eq(C.parseDuration('5'), 300, '"5" is minutes');
eq(C.parseDuration('4:30'), 270, 'm:ss');
eq(C.parseDuration('1:00:00'), 3600, 'h:mm:ss');
eq(C.parseDuration('90s'), 90, 'seconds suffix');
eq(C.parseDuration('0.5'), 30, 'half a minute');
for (const bad of ['', '0', '4:75', 'abc', '-3', '25:00:00', '1:2:3:4']) ok(C.parseDuration(bad) === null, `duration rejects ${bad}`);
eq(C.formatClock(0), '0:00', 'clock 0');
eq(C.formatClock(65000), '1:05', 'clock 1:05');
eq(C.formatClock(64001), '1:05', 'clock rounds up so 0:00 only shows at zero');
eq(C.formatClock(3723000), '1:02:03', 'clock with hours');

// ── geometry ─────────────────────────────────────────────────────────
eq(C.clampRect({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 }), { x: 0.7, y: 0.7, w: 0.3, h: 0.3 }, 'pulled back onto the board');
eq(C.clampRect({ x: -1, y: -1, w: 0.01, h: 5 }), { x: 0, y: 0, w: C.MIN_W, h: 1 }, 'min and max size');
eq(C.clampRect({ x: NaN, y: 'a', w: null, h: undefined }), { x: 0, y: 0, w: 0.25, h: 0.25 }, 'garbage becomes a default');
const a = C.placeNew('timer', []);
const b = C.placeNew('timer', [a]);
ok(a.x !== b.x || a.y !== b.y, 'a second new widget does not land on the first');
// P1's eight fit on one board with no overlap. The fourteen P2 has do not
// (their default areas sum to ~125% of the board), so for those the property
// is weaker: every widget placed before the board is full has a free spot.
const P1_TYPES = ['text', 'timer', 'stopwatch', 'clock', 'youtube', 'traffic', 'names', 'dice'];
const placed = [];
for (const t of P1_TYPES) placed.push(C.placeNew(t, placed));
const hit = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 1e-9 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 1e-9;
ok(placed.every((p, i) => placed.every((q, j) => i === j || !hit(p, q))), 'one of each P1 widget fits on an empty board with no overlap');
const all = [];
let firstOverlap = -1;
for (const t of C.TYPES) {
  const r = C.placeNew(t, all);
  if (firstOverlap === -1 && all.some((q) => hit(r, q))) firstOverlap = all.length;
  all.push(r);
}
ok(firstOverlap === -1 || firstOverlap >= 9, `one of each of the fourteen: at least nine place before any overlap (first overlap at ${firstOverlap})`);
const full = Array.from({ length: 20 }, () => C.placeNew('youtube', []));
ok(full.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1), 'placement on a crowded board stays on the board');

// ── state normalisation ──────────────────────────────────────────────
const blank = C.normalizeState(null);
ok(blank.screens.length === 1 && blank.current === blank.screens[0].id, 'nothing saved gives one empty screen');
ok(C.normalizeState('junk').screens.length === 1, 'a string gives one empty screen');

const messy = C.normalizeState({
  current: 's2',
  screens: [
    { id: 's1', name: 'Period 1', widgets: [
      { id: 'a', type: 'text', x: 0.1, y: 0.1, w: 0.3, h: 0.3, z: 2, data: { text: 'Hello', size: 3 } },
      { id: 'a', type: 'clock', x: 0.5, y: 0.5, w: 0.2, h: 0.2, z: 1 },
      { id: 'b', type: 'iframe', data: { src: 'https://evil.example' } },
      { id: 'c', type: 'youtube', data: { url: 'https://evil.example/x' } },
      { id: 'd', type: 'dice', data: { count: 9, values: [7, 3, 'x'] } },
      { id: 'e', type: 'traffic', data: { light: 'purple' } },
      { id: 'f', type: 'timer', data: { duration: -5, sound: 'yes' } },
      'nonsense',
    ] },
    { id: 's2', name: '', widgets: 'no' },
    null,
  ],
});
eq(messy.current, 's2', 'current screen kept');
eq(messy.screens.length, 2, 'the null screen is dropped, the rest kept');
eq(messy.screens[1].name, 'Screen 2', 'an empty name gets a default');
eq(messy.screens[1].widgets.length, 0, 'a non-array widget list is empty');
const ws = messy.screens[0].widgets;
eq(ws.map((w) => w.type), ['text', 'clock', 'youtube', 'dice', 'traffic', 'timer'], 'unknown types dropped');
ok(ws[0].id !== ws[1].id, 'a duplicate widget id is renamed');
eq(ws[0].data, { text: 'Hello', size: 3 }, 'text data kept');
eq(ws[2].data.url, '', 'a non-YouTube url is emptied');
eq(ws[3].data.count, 6, 'dice count capped');
eq(ws[3].data.values, [1, 3, 1, 1, 1, 1], 'bad die faces become 1');
eq(ws[4].data.light, 'green', 'an unknown light resets');
eq(ws[5].data.duration, 1, 'a negative duration is clamped');
eq(ws[5].data.sound, true, 'a non-boolean sound flag defaults on');
eq(C.normalizeState({ current: 'missing', screens: [{ id: 'x', name: 'X', widgets: [] }] }).current, 'x', 'a missing current falls back to the first screen');

const many = { screens: [{ id: 's', name: 'S', widgets: Array.from({ length: 60 }, (_, i) => ({ type: 'clock', id: 'w' + i })) }] };
eq(C.normalizeState(many).screens[0].widgets.length, C.MAX_WIDGETS, 'widgets per screen capped');
const round = C.normalizeState(JSON.parse(JSON.stringify(messy)));
eq(round, messy, 'normalising twice changes nothing');

// ── P2: new widget data ──────────────────────────────────────────────
eq(C.normalizeWidget({ type: 'symbols', data: { mode: 'shout' } }).data, { mode: 'silent' }, 'an unknown symbol resets');
eq(C.normalizeWidget({ type: 'symbols', data: { mode: 'ask3' } }).data, { mode: 'ask3' }, 'a known symbol survives');
eq(C.normalizeWidget({ type: 'noise', data: { sensitivity: 40, limit: 3 } }).data, { sensitivity: 10, limit: 10 }, 'noise settings clamped');
eq(C.normalizeWidget({ type: 'image', data: { mediaId: '../../etc', alt: 5, fit: 'stretch' } }).data, { mediaId: '', alt: '', fit: 'contain' }, 'a bad media id, alt and fit are dropped');
eq(C.normalizeWidget({ type: 'image', data: { mediaId: 'img123', alt: 'Map', fit: 'cover' } }).data, { mediaId: 'img123', alt: 'Map', fit: 'cover' }, 'a good image survives');
eq(C.normalizeWidget({ type: 'qr', data: { text: 'x'.repeat(900) } }).data.text.length, 500, 'QR text capped');
eq(C.normalizeWidget({ type: 'groups', data: { roster: 'P3', by: 'count', n: 99 } }).data, { roster: 'P3', by: 'count', n: 12 }, 'group count clamped');
eq(C.normalizeWidget({ type: 'groups', data: { by: 'weird', n: 'x' } }).data, { roster: '', by: 'size', n: 4 }, 'bad group settings reset');

// strokes
eq(C.normalizeStrokes([{ c: 'purple', s: 3, p: [0.5, 0.5, 2, -1] }]), [{ c: 'ink', s: 4, p: [0.5, 0.5, 1, 0] }], 'unknown pen and size reset; points clamped');
eq(C.normalizeStrokes([{ c: 'red', s: 8, p: [0.1, 0.2, 'x', 0.3, 0.4, 0.5] }]), [{ c: 'red', s: 8, p: [0.1, 0.2] }], 'a bad point ends the stroke');
eq(C.normalizeStrokes([{ p: [] }, 'x', null, { p: [0.1] }]), [], 'empty and broken strokes dropped');
eq(C.normalizeStrokes([{ p: [0.12345, 0.98765] }])[0].p, [0.123, 0.988], 'points rounded to 3 places');
const big = Array.from({ length: 5 }, () => ({ c: 'ink', s: 2, p: Array.from({ length: 2 * 3000 }, () => 0.5) }));
const capped = C.normalizeStrokes(big);
ok(C.strokePoints(capped) <= C.MAX_POINTS, `points capped (${C.strokePoints(capped)})`);
eq(capped.length, 2, 'the strokes past the cap are the ones dropped');

// groups
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const ten = Array.from({ length: 10 }, (_, i) => 'N' + i);
const sizes = (g) => g.map((x) => x.length);
eq(sizes(C.makeGroups(ten, 'size', 4, rng)), [4, 3, 3], 'ten in fours: a remainder of 2 makes its own group');
eq(sizes(C.makeGroups(ten.slice(0, 9), 'size', 4, rng)), [5, 4], 'nine in fours: a remainder of 1 joins a group');
eq(sizes(C.makeGroups(ten, 'count', 3, rng)), [4, 3, 3], 'ten into three groups');
eq(sizes(C.makeGroups(ten.slice(0, 2), 'count', 5, rng)), [1, 1], 'never more groups than names');
eq(sizes(C.makeGroups(ten.slice(0, 3), 'size', 4, rng)), [3], 'fewer names than a group');
eq(C.makeGroups([], 'size', 4, rng), [], 'no names, no groups');
const everyone = C.makeGroups(ten, 'size', 3, rng).flat().sort();
eq(everyone, [...ten].sort(), 'every name lands in exactly one group');

// backgrounds and media ids
const bgs = C.normalizeState({ screens: [{ id: 'a', bg: 'grid', bgImage: 'img1', widgets: [] }, { id: 'b', bg: 'neon', bgImage: 'bad id!', widgets: [] }] }).screens;
eq([bgs[0].bg, bgs[0].bgImage], ['grid', 'img1'], 'a known background survives');
eq([bgs[1].bg, bgs[1].bgImage], ['dots', ''], 'an unknown background and bad image id reset');
eq(C.blankScreen('X').bg, 'dots', 'a new screen starts on dots');
eq(C.mediaIds({ screens: [
  { bgImage: 'bg1', widgets: [{ type: 'image', data: { mediaId: 'img1' } }, { type: 'text', data: {} }] },
  { bgImage: '', widgets: [{ type: 'image', data: { mediaId: 'img1' } }, { type: 'image', data: { mediaId: '' } }] }
] }), ['bg1', 'img1'], 'media ids: backgrounds and images, each once');
eq(C.TYPES.length, 14, 'fourteen widget types');
C.TYPES.forEach((t) => ok(C.DEFAULT_SIZE[t], `a default size for ${t}`));

// ── P3: periods, starters, files ─────────────────────────────────────
const bell = C.readPeriods({ periods: [
  { id: 'p2', label: 'Period 2', start: '08:55', end: '09:45' },
  { id: 'p1', label: 'Period 1', start: '08:00', end: '08:50' },
  { id: 'p1', label: 'Duplicate', start: '10:00', end: '10:30' },
  { id: 'bad id', label: 'X', start: '11:00', end: '11:30' },
  { id: 'p9', label: 'Backwards', start: '12:00', end: '11:00' },
  { id: 'p8', label: 'Nonsense', start: '25:00', end: '26:00' },
  { id: 'lunch', label: '', start: '11:35', end: '12:10' },
  'junk', null
] });
eq(bell.map((p) => p.id), ['p1', 'p2', 'lunch'], 'bell periods: sorted, junk and duplicates dropped');
eq(bell[2].label, 'lunch', 'a blank label falls back to the id');
eq(C.readPeriods(null), [], 'no settings, no periods');
eq(C.readPeriods({ periods: 'x' }), [], 'a bad periods value, no periods');
eq(C.periodAt(bell, 8 * 60).current.id, 'p1', 'the start minute is inside a period');
eq(C.periodAt(bell, 8 * 60 + 50).current, null, 'the end minute is not');
eq(C.periodAt(bell, 8 * 60 + 50).next.id, 'p2', 'between bells, the next period is known');
eq(C.periodAt(bell, 9 * 60 + 10).current.id, 'p2', 'mid-period');
eq(C.periodAt([], 600), { current: null, next: null }, 'no schedule, no period');
eq(C.normalizeState({ follow: 'yes', screens: [] }).follow, false, 'follow must be a boolean');
eq(C.normalizeState({ follow: true, screens: [] }).follow, true, 'follow survives');
const linked = C.normalizeState({ screens: [{ id: 'a', period: 'p1', widgets: [] }, { id: 'b', period: 'no good!', widgets: [] }] });
eq(linked.screens.map((x) => x.period), ['p1', ''], 'a bad period id is dropped');
eq(C.screenForPeriod(linked, 'p1').id, 'a', 'screen for a period');
eq(C.screenForPeriod(linked, 'p2'), null, 'no screen for an unlinked period');
eq(C.screenForPeriod(linked, ''), null, 'no period, no screen');

eq(C.TEMPLATES.length, 6, 'six starter screens');
for (const t of C.TEMPLATES) {
  const sc = C.fromTemplate(t.id);
  ok(sc && sc.name === t.name && sc.widgets.length >= 4, `starter ${t.id} builds`);
  eq(C.normalizeState({ screens: [sc] }).screens[0], sc, `starter ${t.id} is already normal`);
  const hitAny = sc.widgets.some((p, i) => sc.widgets.some((q, j) => i !== j && hit(p, q)));
  ok(!hitAny, `starter ${t.id} has no overlapping widgets`);
}
eq(C.fromTemplate('nope'), null, 'unknown starter');
ok(C.fromTemplate('donow').id !== C.fromTemplate('donow').id, 'each starter gets a fresh id');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const orig = C.normalizeState({ screens: [{ id: 's1', name: 'Mine', period: 'p1', bg: 'image', bgImage: 'imgBG', widgets: [
  { id: 'w1', type: 'image', data: { mediaId: 'imgA', alt: 'A' } },
  { id: 'w2', type: 'image', data: { mediaId: 'imgGone' } },
  { id: 'w3', type: 'text', data: { text: 'hi' } }
] }] }).screens[0];
const file = C.exportScreen(orig, { imgA: PNG, imgBG: PNG, unrelated: PNG });
eq(file.kind, C.EXPORT_KIND, 'export kind');
eq(Object.keys(file.media).sort(), ['imgA', 'imgBG'], 'export carries only the pictures the screen uses');
eq(file.screen.period, '', 'export drops the period link');
eq(orig.period, 'p1', 'and does not touch the screen it copied');
const back = C.readImport(JSON.parse(JSON.stringify(file)));
ok(!back.error, 'the export reads back');
ok(back.screen.id !== 's1' && back.screen.widgets.every((w) => !/^w[123]$/.test(w.id)), 'import gets fresh ids');
const newA = back.screen.widgets[0].data.mediaId;
ok(newA && newA !== 'imgA' && back.media[newA] === PNG, 'picture ids are remapped with their data');
ok(back.screen.bgImage && back.media[back.screen.bgImage] === PNG, 'background picture remapped');
eq(back.screen.widgets[1].data.mediaId, '', 'a picture missing from the file is emptied');
eq(back.dropped, 1, 'and counted');
eq(back.screen.widgets[2].data.text, 'hi', 'other widgets come through');
eq(C.readImport({ kind: 'other' }).error, 'That file is not a Class Screen export.', 'wrong kind refused');
eq(C.readImport({ kind: C.EXPORT_KIND, version: 2, screen: {} }).error, 'That file was made by a newer version of Class Screen.', 'newer version refused');
eq(C.readImport({ kind: C.EXPORT_KIND, version: 1, screen: 'x' }).error, 'That file has no screen in it.', 'no screen refused');
const evil = C.readImport({ kind: C.EXPORT_KIND, version: 1, screen: { name: 'E', bg: 'image', bgImage: 'b', widgets: [{ type: 'image', data: { mediaId: 'a' } }] },
  media: { a: 'javascript:alert(1)', b: 'data:text/html;base64,PGI+' } });
eq(Object.keys(evil.media), [], 'only image data URLs are accepted');
eq([evil.screen.bg, evil.screen.bgImage], ['dots', ''], 'a refused background falls back to dots');

// ── P4: phone-remote commands ────────────────────────────────────────
eq(C.readCommand({ cmd: 'timer', action: 'toggle' }), { cmd: 'timer', action: 'toggle' }, 'timer toggle');
eq(C.readCommand({ cmd: 'timer', action: 'explode' }), null, 'unknown timer action refused');
eq(C.readCommand({ cmd: 'screen', id: 's_abc-1' }), { cmd: 'screen', id: 's_abc-1' }, 'screen switch');
eq(C.readCommand({ cmd: 'screen', id: '<img src=x>' }), null, 'a bad screen id refused');
eq(C.readCommand({ cmd: 'light', color: 'purple' }), null, 'unknown light refused');
eq(C.readCommand({ cmd: 'light', color: 'red', extra: 1 }), { cmd: 'light', color: 'red' }, 'extra fields dropped');
eq(C.readCommand({ cmd: 'symbol', mode: 'ask3' }), { cmd: 'symbol', mode: 'ask3' }, 'symbol');
eq(C.readCommand({ cmd: 'stopwatch', action: 'add' }), null, 'stopwatch has no add');
for (const c of ['pick', 'groups', 'roll', 'hello']) eq(C.readCommand({ cmd: c }), { cmd: c }, c);
for (const bad of [null, 'pick', [], { cmd: 5 }, { cmd: 'eval' }, { cmd: '__proto__' }]) eq(C.readCommand(bad), null, 'refused: ' + JSON.stringify(bad));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
