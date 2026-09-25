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
const placed = [];
for (const t of C.TYPES) placed.push(C.placeNew(t, placed));
const hit = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 1e-9 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 1e-9;
ok(placed.every((p, i) => placed.every((q, j) => i === j || !hit(p, q))), 'one of each widget fits on an empty board with no overlap');
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
