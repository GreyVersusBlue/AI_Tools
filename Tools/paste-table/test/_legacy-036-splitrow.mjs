// A frozen copy of 036 Final Grade Checker's splitRow as it was before Path 16 P2 moved its cell
// splitting onto _shared/paste-table.js (taken verbatim from grade-math.mjs at v406). The parity
// suite holds the live splitRow to it; do not edit.
export function splitRow(line) {
  const l = String(line).replace(/\r$/, '');
  if (l.includes('\t')) return l.split('\t').map(c => c.trim());
  return l.trim().split(/ {2,}/).map(c => c.trim()).filter(c => c !== '');
}
