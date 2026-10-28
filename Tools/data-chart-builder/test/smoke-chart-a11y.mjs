// smoke-chart-a11y.mjs — Data Table → Chart Builder's accessibility baseline (Path 16 P1 step 2).
//
//   node Tools/data-chart-builder/test/smoke-chart-a11y.mjs
//
// The site sweep opens 038 with no data, so the chart itself was never scanned. This pastes a table,
// draws each of the five chart types, and checks on the running page that:
//   - axe finds no serious/critical violation with the chart on screen (contrast of every label included);
//   - the chart is role="img" labelled by its own <title> and <desc>, and the desc carries the data;
//   - a polite status line says what is on screen after each redraw;
//   - in "Grayscale / print-safe colors" each later series is hatched, not just a different grey;
//   - the SVG the Download button writes has the same title and desc (the file is the chart);
//   - the printed blank worksheet carries ids of its own, so the chart and the sheet never share one.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8577;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/038-data-chart-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

const DATA = 'Group\tMass (g)\tVolume (mL)\tDensity\nAlpha\t12.5\t10\t1.25\nBeta\t18\t14\t1.29\nGamma\t7.5\t9\t0.83\nDelta\t21\t15\t1.4\n';

async function drawn(type, extra) {
  await page.evaluate((t) => {
    const r = document.querySelector(`input[name="chart-type"][value="${t}"]`);
    r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
  }, type);
  if (extra) await page.evaluate(extra);
  await settle(page, 500);
}
const svgInfo = () => page.evaluate(() => {
  const s = document.querySelector('#chart-stage svg');
  if (!s) return null;
  const t = s.querySelector(':scope > title'), d = s.querySelector(':scope > desc');
  return {
    role: s.getAttribute('role'),
    labelledby: s.getAttribute('aria-labelledby'),
    title: t && t.textContent, titleId: t && t.id,
    desc: d && d.textContent, descId: d && d.id,
    announce: document.getElementById('chart-announce').textContent,
    patterns: s.querySelectorAll('pattern').length,
    fills: Array.from(s.querySelectorAll('rect[rx="2"]')).map(r => r.getAttribute('fill')),
  };
});

console.log('Data Table → Chart Builder — chart accessibility');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.fill('#data-input', DATA);
await page.dispatchEvent('#data-input', 'input');
await settle(page, 700);

/* ── 1. bar, with the title typed in ───────────────────────────────────── */
await page.fill('#chart-title', 'Mass by group');
await page.dispatchEvent('#chart-title', 'input');
await drawn('bar');
let info = await svgInfo();
ok(info, 'a bar chart is drawn from the paste');
eq(info && info.role, 'img', 'the chart is role="img"');
eq(info && info.labelledby, 'cs-title cs-desc', 'labelled by its title and desc');
eq(info && info.title, 'Mass by group', 'the title is the one the teacher typed');
ok(info && /Alpha 12\.5/.test(info.desc) && /Delta 21/.test(info.desc), 'the desc carries the values: ' + (info && info.desc));
ok(info && info.announce.startsWith('Mass by group updated.') && /Alpha 12\.5/.test(info.announce), 'a status line announces the redraw: ' + (info && info.announce));
let bad = await a11yScan(page, { impact: 'serious' });
eq(bad.length, 0, 'axe: no serious violation with a bar chart up ' + JSON.stringify(bad));

/* ── 2. the other four types ───────────────────────────────────────────── */
for (const type of ['line', 'pie', 'box', 'scatter']) {
  await drawn(type);
  info = await svgInfo();
  ok(info && info.role === 'img' && info.desc && info.title, `${type}: role, title and desc are present`);
  ok(info && info.announce.length > 20, `${type}: the redraw is announced`);
  bad = await a11yScan(page, { impact: 'serious' });
  eq(bad.length, 0, `axe: no serious violation with a ${type} chart up ` + JSON.stringify(bad));
}

/* ── 3. a pie with values shown: the percentages are readable on every slice ── */
await page.fill('#chart-title', '');
await page.dispatchEvent('#chart-title', 'input');
await drawn('pie');
const pieLabels = await page.evaluate(() => Array.from(document.querySelectorAll('#chart-stage svg text')).filter(t => /^\d+%$/.test(t.textContent)).map(t => t.getAttribute('fill')));
ok(pieLabels.length >= 3, 'the pie shows its percentages');
ok(pieLabels.some(f => f !== '#fff' && f !== '#ffffff'), 'at least one slice takes dark ink: white on the yellow one was 1.6:1 (' + pieLabels.join(' ') + ')');

/* ── 4. grayscale: a hatch per later series ────────────────────────────── */
await drawn('bar', () => {
  document.querySelectorAll('.value-col-cb').forEach(cb => { cb.checked = true; });
  const g = document.getElementById('grayscale-mode'); g.checked = true; g.dispatchEvent(new Event('change', { bubbles: true }));
});
info = await svgInfo();
ok(info && info.patterns >= 2, 'grayscale mode defines hatch patterns (' + (info && info.patterns) + ')');
ok(info && info.fills.some(f => /^url\(#cs-h\d\)$/.test(f)), 'and the later series use them: ' + (info && info.fills.join(' ')));
bad = await a11yScan(page, { impact: 'serious' });
eq(bad.length, 0, 'axe: no serious violation in grayscale mode ' + JSON.stringify(bad));

/* ── 5. the download is the chart, with its title and desc ─────────────── */
const svgFile = await page.evaluate(() => new Promise((resolve) => {
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      fetch(this.href).then(r => r.text()).then(resolve);
      return;
    }
    return realClick.apply(this, arguments);
  };
  document.getElementById('btn-svg').click();
}));
ok(/role="img"/.test(svgFile) && /<title id="cs-title">/.test(svgFile) && /<desc id="cs-desc">/.test(svgFile), 'the downloaded SVG carries its title and desc');

/* ── 6. the blank worksheet has ids of its own ─────────────────────────── */
await drawn('bar', () => {
  const g = document.getElementById('grayscale-mode'); g.checked = false; g.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.evaluate(() => { window.print = () => {}; });
await page.click('#btn-print-worksheet');
await settle(page, 300);
const ids = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('[id]')).map(e => e.id);
  const dup = all.filter((id, i) => all.indexOf(id) !== i);
  const ws = document.querySelector('#print-area svg');
  return { dup, ws: ws && ws.getAttribute('aria-labelledby'), desc: ws && ws.querySelector('desc').textContent };
});
eq(ids.dup.length, 0, 'no duplicate ids with the chart and the worksheet both in the DOM: ' + JSON.stringify(ids.dup));
eq(ids.ws, 'cs-ws-title cs-ws-desc', 'the worksheet svg is labelled by its own title and desc');
ok(ids.desc && /Nothing is plotted/.test(ids.desc) && !/12\.5/.test(ids.desc), 'and its desc does not give the answers away');

/* ── 7. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
