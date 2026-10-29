// dcb-fit.test.mjs — the curve fits behind 038's scatter (Path 16 P5 step 1), held to datasets whose
// answer is known by construction: points generated from an exact model must give that model's
// coefficients and R² = 1; noisy points must give the R² worked out here by hand-written arithmetic
// (an independent SSres/SStot, not the module's); a point a model cannot take is left out and counted.
// Each property is then checked against a broken copy of the module, which must fail it.
//
//   node Tools/data-chart-builder/test/dcb-fit.test.mjs   (npm run test:chart-fit)
// Pure Node, no browser, no port. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dcb-fit.js');
const load = src => { const w = {}; vm.runInNewContext(src, { window: w, Math, Number, String, isFinite, Array }, { filename: 'dcb-fit.js' }); return w.ChartFit; };

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const xs = [1, 2, 3, 4, 5, 6, 8, 10];
const from = f => xs.map(x => ({ x, y: f(x) }));

function check(F) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };

  // exact models come back exactly
  let f = F.fit('linear', from(x => 2.5 * x - 4));
  ok(f && near(f.a, 2.5) && near(f.b, -4) && near(f.r2, 1), 'linear: ' + JSON.stringify(f && [f.a, f.b, f.r2]));
  ok(f && f.equation === 'y = 2.5x - 4', 'linear equation text: ' + (f && f.equation));
  f = F.fit('power', from(x => 3 * Math.pow(x, 1.5)));
  ok(f && near(f.a, 3) && near(f.b, 1.5) && near(f.r2, 1), 'power: ' + JSON.stringify(f && [f.a, f.b, f.r2]));
  f = F.fit('exponential', from(x => 2 * Math.exp(0.3 * x)));
  ok(f && near(f.a, 2) && near(f.b, 0.3) && near(f.r2, 1), 'exponential: ' + JSON.stringify(f && [f.a, f.b, f.r2]));
  f = F.fit('logarithmic', from(x => 1 + 4 * Math.log(x)));
  ok(f && near(f.a, 1) && near(f.b, 4) && near(f.r2, 1), 'logarithmic: ' + JSON.stringify(f && [f.a, f.b, f.r2]));
  f = F.fit('quadratic', from(x => 0.5 * x * x - 3 * x + 7));
  ok(f && near(f.a, 0.5) && near(f.b, -3) && near(f.c, 7) && near(f.r2, 1), 'quadratic: ' + JSON.stringify(f && [f.a, f.b, f.c, f.r2]));
  ok(f && near(f.predict(7), 0.5 * 49 - 21 + 7), 'quadratic predict');

  // a textbook dataset: x 1..5, y 2 4 5 4 5 -> slope 0.6, intercept 2.2, r = 0.7746, R² = 0.6
  f = F.fit('linear', [1, 2, 3, 4, 5].map((x, i) => ({ x, y: [2, 4, 5, 4, 5][i] })));
  ok(f && near(f.a, 0.6) && near(f.b, 2.2) && near(f.r2, 0.6), 'textbook linear: ' + JSON.stringify(f && [f.a, f.b, f.r2]));
  ok(f && f.label === 'y = 0.6x + 2.2  (R² = 0.6)', 'label: ' + (f && f.label));

  // R² of a power fit on noisy data is measured on the original y, by independent arithmetic
  const noisy = [{ x: 1, y: 2.1 }, { x: 2, y: 8.3 }, { x: 3, y: 17.6 }, { x: 4, y: 33 }, { x: 5, y: 49 }];
  f = F.fit('power', noisy);
  const mean = noisy.reduce((s, p) => s + p.y, 0) / noisy.length;
  const res = noisy.reduce((s, p) => s + (p.y - f.a * Math.pow(p.x, f.b)) ** 2, 0);
  const tot = noisy.reduce((s, p) => s + (p.y - mean) ** 2, 0);
  ok(f && near(f.r2, 1 - res / tot, 1e-12), 'power R² is not the original-scale one');
  const lx = noisy.map(p => Math.log(p.x)), ly = noisy.map(p => Math.log(p.y));
  const mx = lx.reduce((a, b) => a + b) / 5, my = ly.reduce((a, b) => a + b) / 5;
  const sxy = lx.reduce((s, v, i) => s + (v - mx) * (ly[i] - my), 0), sxx = lx.reduce((s, v) => s + (v - mx) ** 2, 0);
  ok(f && near(f.b, sxy / sxx, 1e-12) && near(f.a, Math.exp(my - (sxy / sxx) * mx), 1e-12), 'power coefficients are not the log-log least squares');

  // points a model cannot take are left out and counted, never fitted
  f = F.fit('power', [{ x: 0, y: 1 }, { x: -2, y: 4 }, ...from(x => x * x)]);
  ok(f && f.left.length === 2 && f.used === xs.length && near(f.b, 2) && /2 points left out/.test(f.note), 'power with x <= 0: ' + (f && f.note));
  f = F.fit('exponential', [{ x: 1, y: 0 }, ...from(x => Math.exp(x))]);
  ok(f && f.left.length === 1 && /1 point left out \(y is not above 0\)/.test(f.note), 'exponential with y = 0: ' + (f && f.note));
  f = F.fit('linear', [{ x: 1, y: NaN }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
  ok(f && f.left.length === 1 && f.used === 2, 'a NaN is left out');

  // no fit rather than a wrong one
  ok(F.fit('linear', [{ x: 1, y: 1 }]) === null, 'one point fitted');
  ok(F.fit('linear', [{ x: 2, y: 1 }, { x: 2, y: 5 }]) === null, 'a vertical line fitted');
  ok(F.fit('quadratic', [{ x: 1, y: 1 }, { x: 2, y: 4 }]) === null, 'quadratic on two points');
  ok(F.fit('quadratic', [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]) === null, 'quadratic on one x');
  ok(F.fit('power', [{ x: -1, y: 1 }, { x: -2, y: 2 }]) === null, 'power with nothing usable');
  ok(F.fit('nonsense', from(x => x)) === null, 'an unknown model fitted');
  ok(F.fit('linear', []) === null && F.fit('linear', null) === null, 'empty input fitted');

  // a flat y is R² 1 for a flat fit, not NaN
  f = F.fit('linear', [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
  ok(f && f.r2 === 1 && !Number.isNaN(f.r2), 'flat y gives ' + (f && f.r2));

  // text: three significant figures and a plain exponent for very small numbers
  ok(F.sig(0.00123456) === '0.00123' && F.sig(1234567) === '1.23e6' && F.sig(2) === '2' && F.sig(0) === '0', 'sig: ' + [F.sig(0.00123456), F.sig(1234567)]);
  ok(F.MODELS.map(m => m.id).join() === 'linear,power,exponential,logarithmic,quadratic', 'model list');
  return bad;
}

const src = fs.readFileSync(SRC, 'utf8');
const real = check(load(src));
if (real.length) { console.log('FAIL\n  ' + real.join('\n  ')); process.exit(1); }
console.log('  ok  the five fits on exact, textbook and noisy data; left-out points; no-fit cases');

// mutants: each broken copy must fail the check
const MUTANTS = [
  ['R² on the log line', s => s.replace('var r2 = r2Of(pts, predict);', 'var r2 = id === "power" ? 0.5 : r2Of(pts, predict);')],
  ['power fitted on raw y', s => s.replace('{ x: Math.log(p.x), y: Math.log(p.y) }', '{ x: Math.log(p.x), y: p.y }')],
  ['x <= 0 allowed for power', s => s.replace("(id === 'power' || id === 'logarithmic') && !(p.x > 0)", "false")],
  ['y <= 0 allowed for exponential', s => s.replace("(id === 'power' || id === 'exponential') && !(p.y > 0)", "false")],
  ['two points enough for a quadratic', s => s.replace("id === 'quadratic' ? 3 : 2", '2').replace(/if \(Math\.abs\(m\[piv\]\[i\]\) < [^\n]*return null;/, '')],
  ['flat y gives NaN', s => s.replace('if (tot === 0) return res === 0 ? 1 : 0;', '')],
  ['slope sign flipped', s => s.replace('var m = (n * sxy - sx * sy) / den;', 'var m = -(n * sxy - sx * sy) / den;')],
  ['quadratic a and c swapped', s => s.replace('return { c: sol[0], b: sol[1], a: sol[2] };', 'return { a: sol[0], b: sol[1], c: sol[2] };')],
  ['four figures, not three', s => s.replace('v.toPrecision(3)', 'v.toPrecision(4)')],
];
let missed = 0;
for (const [name, mutate] of MUTANTS) {
  const m = mutate(src);
  if (m === src) { console.log('  FAIL mutant "' + name + '" did not apply'); missed++; continue; }
  let failed;
  try { failed = check(load(m)).length > 0; } catch { failed = true; }
  if (!failed) { console.log('  FAIL mutant survived: ' + name); missed++; }
}
if (missed) process.exit(1);
console.log('  ok  all ' + MUTANTS.length + ' mutants are caught');
