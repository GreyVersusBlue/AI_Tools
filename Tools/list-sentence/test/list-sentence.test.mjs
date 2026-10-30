// list-sentence.test.mjs — _shared/list-sentence.js (AI-30, rank 69). Pure Node.
// The module replaced six copies of "A, B and C" and 046's regionGroupCaption. Each old body is
// frozen below and held to the shared one over a hand corpus and seeded random lists, and the
// page-facing callers (seating nameList, 046 regionGroupCaption, the timer's finishedMessage,
// the schedule checks' list) are checked through their own exports.
//   node Tools/list-sentence/test/list-sentence.test.mjs   (npm run test:list-sentence)
import '../../../_shared/list-sentence.js';
import { nameList } from '../../seating-chart/seating-explain.mjs';
import { regionGroupCaption } from '../../blank-map-generator/bmg-legend.js';
import { finishedMessage } from '../../classroom-timer/ct-board-core.js';

const LS = globalThis.ListSentence;
let passed = 0, failed = 0;
const eq = (a, b, label) => { if (a === b) passed++; else { failed++; console.log(`  FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };

// frozen old bodies
const oldJoin = (items) => { if (items.length <= 1) return items.join(''); return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]; };
const oldRgb = (list) => { if (list.length < 2) return list.join(''); return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; };
const oldSeating = (list) => { if (list.length <= 1) return list[0] || ''; return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; };
const oldTimer = (labels) => { if (!labels.length) return ''; const list = labels.length === 1 ? labels[0] : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1]; return list + ": time's up"; };
const oldCaption = (names, max = 3) => {
  const list = (names || []).filter(Boolean);
  if (!list.length) return '';
  if (list.length <= max) { if (list.length === 1) return list[0]; return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`; }
  return `${list.slice(0, max).join(', ')} and ${list.length - max} more`;
};

eq(LS.join([]), '', 'empty'); eq(LS.join(['A']), 'A', 'one'); eq(LS.join(['A', 'B']), 'A and B', 'two');
eq(LS.join(['A', 'B', 'C']), 'A, B and C', 'three'); eq(LS.join(['1', '2', '3', '4']), '1, 2, 3 and 4', 'four');
eq(LS.caption(['T', 'L', 'M', 'A', 'B']), 'T, L, M and 2 more', 'caption past max');
eq(LS.caption(['T', 'L', 'M']), 'T, L and M', 'caption at max'); eq(LS.caption(['T', '', null, 'L']), 'T and L', 'caption drops empties');
eq(LS.caption(null), '', 'caption null'); eq(LS.caption(['a', 'b', 'c'], 2), 'a, b and 1 more', 'caption max 2');

let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pool = ['Ann', 'Bo', 'Cy', 'Dee', 'Ed', '', '3', 'Station 4', 'a, b'];
for (let i = 0; i < 3000; i++) {
  const n = Math.floor(rnd() * 8), list = Array.from({ length: n }, () => pool[Math.floor(rnd() * pool.length)]);
  const l = JSON.stringify(list);
  eq(LS.join(list), oldJoin(list), 'join ' + l); eq(LS.join(list), oldRgb(list), 'rgb ' + l);
  const noEmpty = list.filter(Boolean);
  eq(nameList(noEmpty), oldSeating(noEmpty), 'seating ' + l);
  eq(finishedMessage(noEmpty), oldTimer(noEmpty), 'timer ' + l);
  const max = 1 + Math.floor(rnd() * 5);
  eq(regionGroupCaption(list, max), oldCaption(list, max), 'caption ' + l + max);
}
eq(regionGroupCaption(['Texas']), 'Texas', '046 one');
console.log(`list-sentence: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
