// Loads _shared/chart-svg.js (a classic script publishing window.ChartSvg) into a bare
// vm context, the way export.test.mjs loads export.js. `mutate` rewrites the source first
// (the suites' break-on-purpose checks).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SRC = fs.readFileSync(path.join(site, '_shared', 'chart-svg.js'), 'utf8');

export function loadChartSvg(mutate) {
  let src = SRC;
  if (mutate) {
    const out = mutate(src);
    if (out === src) throw new Error('mutant changed nothing');
    src = out;
  }
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.ChartSvg;
}
