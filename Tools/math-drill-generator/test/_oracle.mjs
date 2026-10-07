// _oracle.mjs — exact arithmetic for the fraction, exponent and equation suites.
// BigInt rationals, written apart from the generator (its gcd and fractionText are
// not used), and shared by drill-frac-exp-eq.test.mjs and smoke-frac-exp-eq.mjs.

export const absB = a => (a < 0n ? -a : a);
export const gcdB = (a, b) => { a = absB(a); b = absB(b); while (b) [a, b] = [b, a % b]; return a; };
export function rat(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error('zero denominator');
  if (d < 0n) { n = -n; d = -d; }
  const k = gcdB(n, d) || 1n;
  return { n: n / k, d: d / k };
}
export const mul = (x, y) => rat(x.n * y.n, x.d * y.d);
export const div = (x, y) => { if (y.n === 0n) throw new Error('divide by zero'); return rat(x.n * y.d, x.d * y.n); };
export const add = (x, y) => rat(x.n * y.d + y.n * x.d, x.d * y.d);
export const same = (x, y) => x.n === y.n && x.d === y.d;
const INT_ = /^(-?\d+)$/, FRAC_ = /^(-?\d+)\/(\d+)$/, MIXED_ = /^(-?\d+) (\d+)\/(\d+)$/;
/** Text -> { r: rational, kind: 'int'|'frac'|'mixed', whole, num, den } or null. */
export function parseNum(text) {
  let m;
  if ((m = INT_.exec(text))) return { r: rat(m[1]), kind: 'int' };
  if ((m = FRAC_.exec(text))) { if (BigInt(m[2]) === 0n) return null; return { r: rat(m[1], m[2]), kind: 'frac', num: BigInt(m[1]), den: BigInt(m[2]) }; }
  if ((m = MIXED_.exec(text))) {
    const w = BigInt(m[1]), n = BigInt(m[2]), d = BigInt(m[3]);
    if (d === 0n) return null;
    const neg = m[1].startsWith('-');
    const mag = add(rat(absB(w)), rat(n, d));
    return { r: neg ? rat(-mag.n, mag.d) : mag, kind: 'mixed', whole: w, num: n, den: d };
  }
  return null;
}
/** Is `text` the way the tool writes the rational r: reduced, whole plain, improper as mixed? */
export function writtenAs(text, r) {
  const p = parseNum(text);
  if (!p || !same(p.r, r)) return false;
  if (r.d === 1n) return p.kind === 'int';
  const mag = absB(r.n);
  if (mag < r.d) return p.kind === 'frac' && gcdB(p.num, p.den) === 1n && absB(p.num) < p.den;
  return p.kind === 'mixed' && p.num > 0n && p.num < p.den && gcdB(p.num, p.den) === 1n && p.whole !== 0n;
}

