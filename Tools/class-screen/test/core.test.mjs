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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
