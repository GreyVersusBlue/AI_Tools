// _page-hashes.mjs — shared by the golden recorder and smoke-new-sheets.mjs.
// Reads the page's preview markup (worksheet and answer key) for a fixed list
// of saved settings, each with a locked seed, so a sheet saved before the
// fractions / exponents / equations change can be compared byte for byte.
import crypto from 'node:crypto';

export const SEEDS = [31337, 20261007];
const BASE_SETTINGS = {
  sheetTitle: '', problemCount: 30, columns: 3, versions: 1, rangesByTemplate: {},
  timedFluency: false, fluencyTargetSeconds: '', format: 'horizontal', fontSize: 'md',
  perPage: '', avoidTrivial: false, lockSeed: true, sameSheetKey: false,
  sameSheetKeyMode: 'both', reorderedVersions: false, selfCheck: 'none'
};
export const CONFIGS = [];
for (const key of ['addition', 'subtraction', 'multiplication', 'division', 'mixed', 'integers', 'decimals', 'fractions', 'percent', 'ooo', 'mult7', 'div4']) {
  for (const format of ['horizontal', 'vertical']) {
    CONFIGS.push({ name: `${key}/${format}`, s: { templateKey: key, format, seed: SEEDS[0] } });
  }
}
CONFIGS.push({ name: 'addition/paged-key', s: { templateKey: 'addition', seed: SEEDS[1], perPage: 12, sameSheetKey: true, fontSize: 'lg', timedFluency: true, fluencyTargetSeconds: '90' } });
CONFIGS.push({ name: 'fractions/custom-range-small', s: { templateKey: 'fractions', seed: SEEDS[1], problemCount: 12, columns: 2, fontSize: 'sm' } });
CONFIGS.push({ name: 'multiplication/custom-range', s: { templateKey: 'multiplication', seed: SEEDS[1], rangesByTemplate: { multiplication: { operand1: { min: 3, max: 9 }, operand2: { min: 2, max: 5 } } }, avoidTrivial: true } });
for (const selfCheck of ['riddle', 'colorByAnswer', 'maze']) {
  CONFIGS.push({ name: `multiplication/${selfCheck}`, s: { templateKey: 'multiplication', seed: SEEDS[1], selfCheck } });
  CONFIGS.push({ name: `ooo/${selfCheck}`, s: { templateKey: 'ooo', seed: SEEDS[0], selfCheck } });
}

const strip = html => html.replace(/Date: [^<]*</g, 'Date: <');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

/** Open the page with each config saved, return { name: { worksheet, answers } } hashes. */
export async function collect(browser, base, prepPage, settle, url) {
  const out = {};
  for (const cfg of CONFIGS) {
    const page = await prepPage(browser, base, { width: 1400, height: 1000 });
    const saved = JSON.stringify(Object.assign({}, BASE_SETTINGS, cfg.s));
    await page.addInitScript(v => { try { localStorage.setItem('gvb-math-drill:settings', v); } catch (e) { /* none */ } }, saved);
    await page.goto(url, { waitUntil: 'networkidle' });
    await settle(page, 250);
    const w = await page.evaluate(() => document.getElementById('previewArea').innerHTML);
    await page.click('#viewAnswersBtn');
    await settle(page, 150);
    const a = await page.evaluate(() => document.getElementById('previewArea').innerHTML);
    out[cfg.name] = { worksheet: sha(strip(w)), answers: sha(strip(a)), len: w.length + a.length };
    await page.close();
  }
  return out;
}
