// _golden-math.mjs — a fingerprint of grade-math.mjs's existing exports over
// seeded gradebooks, so grade-scenarios.test.mjs can prove that adding the
// scenario functions changed nothing that was already there.
// OLD_MATH_HASH was recorded from the module at 235dcf3, before any scenario code.
import crypto from 'node:crypto';
import { calcFinals, curveScores, triageStudent, getLetter, qpToFinalLetter } from '../grade-math.mjs';
import { rng } from './_golden-page.mjs';

export const OLD_MATH_HASH = 'e98866d29cc6da7f4638b6d78338511e3a85cdbd35d9871aed1cf60a9886e600';

export function mathHash() {
  const h = crypto.createHash('sha256');
  const r = rng(77);
  const optsList = [
    undefined, {}, { boundary: 'strict' }, { precision: 0 }, { precision: 1 },
    { weights: [40, 20, 20, 20] }, { boundary: 'strict', precision: 1, weights: [10, 20, 30, 40] },
    { weights: [0, 25, 25, 25] }, { weights: [25, 25, 25] },
  ];
  for (let i = 0; i < 4000; i++) {
    const scores = Array.from({ length: 4 }, () => {
      const x = r();
      if (x < 0.08) return null;
      if (x < 0.14) return [59.5, 69.5, 79.5, 89.5, 0, 100, 89.49, 59.45][Math.floor(r() * 8)];
      return Math.round(r() * 10000) / 100;
    });
    const o = optsList[i % optsList.length];
    h.update(JSON.stringify([calcFinals(scores, o), triageStudent(scores, o),
      curveScores(scores, { plus: Math.round((r() - 0.5) * 20), dropLowest: r() < 0.5 }),
      getLetter(scores[0], o), qpToFinalLetter(r() * 4, o)]));
  }
  return h.digest('hex');
}
